// Package webhooksigning mirrors OpenSend's TypeScript webhook delivery
// signing helper for the shadow Go ingester.
package webhooksigning

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strings"
)

const (
	SvixIDHeader        = "svix-id"
	SvixTimestampHeader = "svix-timestamp"
	SvixSignatureHeader = "svix-signature"
)

// SignedHeaders contains the Svix-compatible headers OpenSend sends with each
// webhook delivery attempt.
type SignedHeaders struct {
	ID        string
	Timestamp string
	Signature string
}

// SignPayload signs body using the same formula as packages/core/src/webhook-signing.ts:
//
//	HMAC-SHA256(secret without first "whsec_", msgID + "." + timestamp + "." + body)
//
// The returned value includes the OpenSend/Svix version prefix: "v1,<base64>".
func SignPayload(secret string, msgID string, timestamp string, body string) string {
	toSign := msgID + "." + timestamp + "." + body
	mac := hmac.New(sha256.New, []byte(stripSigningSecretPrefix(secret)))
	_, _ = mac.Write([]byte(toSign))
	return "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

// BuildSignedHeaders returns the three signature headers used by the current
// TypeScript webhook dispatcher. It does not send or enqueue anything; the Go
// ingester remains shadow-only until later parity slices wire a dispatcher.
func BuildSignedHeaders(secret string, msgID string, timestamp string, body string) SignedHeaders {
	return SignedHeaders{
		ID:        msgID,
		Timestamp: timestamp,
		Signature: SignPayload(secret, msgID, timestamp, body),
	}
}

// Map returns a header map suitable for assertions or future HTTP request construction.
func (headers SignedHeaders) Map() map[string]string {
	return map[string]string{
		SvixIDHeader:        headers.ID,
		SvixTimestampHeader: headers.Timestamp,
		SvixSignatureHeader: headers.Signature,
	}
}

func stripSigningSecretPrefix(secret string) string {
	return strings.Replace(secret, "whsec_", "", 1)
}
