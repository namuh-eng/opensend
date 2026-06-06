// Package bench contains Go benchmarks for the three hot paths we want to
// compare against the equivalent Bun workloads:
//
//  1. JSON decode of a representative SES/SNS event payload
//  2. HMAC-SHA256 signing matching packages/core/src/webhook-signing.ts format
//  3. Tight-loop webhook dispatch (1000 POSTs to an httptest.Server)
//
// Run with:
//
//	go test -bench=. -benchmem ./internal/bench/
package bench

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// ── Fixture loading ───────────────────────────────────────────────────────────

func fixturesDir() string {
	// Walk up from the package dir to find bench/fixtures.
	_, file, _, _ := runtime.Caller(0)
	dir := filepath.Dir(file)
	for {
		candidate := filepath.Join(dir, "bench", "fixtures")
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	// Fallback: relative to repo root assumed to be 5 levels up from this file.
	_, file, _, _ = runtime.Caller(0)
	root := filepath.Join(filepath.Dir(file), "..", "..", "..", "..", "..")
	return filepath.Join(root, "bench", "fixtures")
}

func loadFixture(name string) []byte {
	data, err := os.ReadFile(filepath.Join(fixturesDir(), name))
	if err != nil {
		panic(fmt.Sprintf("fixture %s not found: %v", name, err))
	}
	return data
}

// ── SES event types (minimal, mirrors the ingester's expected shape) ──────────

type sesNotification struct {
	Type             string `json:"Type"`
	MessageID        string `json:"MessageId"`
	TopicArn         string `json:"TopicArn"`
	Subject          string `json:"Subject"`
	Message          string `json:"Message"`
	Timestamp        string `json:"Timestamp"`
	SignatureVersion string `json:"SignatureVersion"`
	Signature        string `json:"Signature"`
	SigningCertURL   string `json:"SigningCertURL"`
	UnsubscribeURL   string `json:"UnsubscribeURL"`
}

// ── Webhook signing (matches packages/core/src/webhook-signing.ts) ────────────

// signWebhookPayload replicates the Svix-style HMAC-SHA256 format used in
// packages/core/src/webhook-signing.ts:
//
//	toSign = msgId + "." + timestamp + "." + body
//	signature = HMAC-SHA256(secret_without_whsec_, toSign) -> base64
//	result = "v1," + base64
func signWebhookPayload(secret, msgID, timestamp, body string) string {
	key := strings.TrimPrefix(secret, "whsec_")
	toSign := msgID + "." + timestamp + "." + body
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(toSign))
	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return "v1," + sig
}

// ── Benchmark 1: JSON decode of SES SNS event ─────────────────────────────────

func BenchmarkJSONDecodeSESEvent(b *testing.B) {
	data := loadFixture("ses-event.json")
	b.SetBytes(int64(len(data)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var ev sesNotification
		if err := json.Unmarshal(data, &ev); err != nil {
			b.Fatal(err)
		}
	}
}

// ── Benchmark 2: HMAC-SHA256 webhook signing ──────────────────────────────────

func BenchmarkHMACSign(b *testing.B) {
	data := loadFixture("webhook-payload.json")
	secret := "whsec_testsecretkey1234567890abcdef"
	msgID := "msg_01HXYZ1234567890"
	timestamp := "1716980400"
	body := string(data)
	b.SetBytes(int64(len(body)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = signWebhookPayload(secret, msgID, timestamp, body)
	}
}

// ── Benchmark 3: Webhook dispatch loop (1000 POSTs) ──────────────────────────

func BenchmarkWebhookDispatch1000(b *testing.B) {
	data := loadFixture("webhook-payload.json")
	secret := "whsec_testsecretkey1234567890abcdef"

	// Mock webhook receiver — just accepts and discards.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := &http.Client{}
	const batchSize = 1000
	body := string(data)

	b.SetBytes(int64(len(data)) * batchSize)
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		for j := 0; j < batchSize; j++ {
			msgID := fmt.Sprintf("msg_%010d", j)
			timestamp := "1716980400"
			sig := signWebhookPayload(secret, msgID, timestamp, body)

			req, _ := http.NewRequest(http.MethodPost, srv.URL, bytes.NewReader(data))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("svix-id", msgID)
			req.Header.Set("svix-timestamp", timestamp)
			req.Header.Set("svix-signature", sig)

			resp, err := client.Do(req)
			if err != nil {
				b.Fatal(err)
			}
			resp.Body.Close()
		}
	}
}
