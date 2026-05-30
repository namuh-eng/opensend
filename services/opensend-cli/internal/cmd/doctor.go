package cmd

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

// checkResult holds the outcome of one doctor check.
type checkResult struct {
	name    string
	status  string // "PASS", "WARN", "FAIL"
	message string
}

var doctorCmd = &cobra.Command{
	Use:   "doctor",
	Short: "Run connectivity and configuration checks",
	RunE:  runDoctor,
}

func init() {}

func runDoctor(cmd *cobra.Command, args []string) error {
	out := cmd.OutOrStdout()
	client := &http.Client{Timeout: 10 * time.Second}

	var results []checkResult
	var anyFail bool

	// ── Check 1: Endpoint reachable + /api/health returns 200 ────────────────
	healthResult := checkHealth(client)
	results = append(results, healthResult)
	if healthResult.status == "FAIL" {
		anyFail = true
	}

	// ── Check 2: API key present and accepted ─────────────────────────────────
	authResult := checkAuth(client)
	results = append(results, authResult)
	if authResult.status == "FAIL" {
		anyFail = true
	}

	// ── Check 3: At least one domain exists ───────────────────────────────────
	domainsResult := checkDomains(client)
	results = append(results, domainsResult)
	if domainsResult.status == "FAIL" {
		anyFail = true
	}

	// Print results.
	for _, r := range results {
		fmt.Fprintf(out, "[%s] %s — %s\n", r.status, r.name, r.message)
	}

	if anyFail {
		return fmt.Errorf("one or more checks failed")
	}
	return nil
}

func checkHealth(client *http.Client) checkResult {
	if endpoint == "" {
		return checkResult{
			name:    "Endpoint reachable",
			status:  "FAIL",
			message: "No endpoint configured — set OPENSEND_ENDPOINT or pass --endpoint",
		}
	}

	url := strings.TrimRight(endpoint, "/") + "/api/health"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return checkResult{
			name:    "Endpoint reachable",
			status:  "FAIL",
			message: fmt.Sprintf("Cannot build request: %v — check OPENSEND_ENDPOINT value", err),
		}
	}

	resp, err := client.Do(req)
	if err != nil {
		return checkResult{
			name:    "Endpoint reachable",
			status:  "FAIL",
			message: fmt.Sprintf("Cannot reach %s: %v — is the server running? Check OPENSEND_ENDPOINT", url, err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return checkResult{
			name:    "Endpoint reachable",
			status:  "FAIL",
			message: fmt.Sprintf("Health check returned HTTP %d (expected 200) — server may be misconfigured", resp.StatusCode),
		}
	}

	return checkResult{
		name:    "Endpoint reachable",
		status:  "PASS",
		message: fmt.Sprintf("%s responded 200 OK", url),
	}
}

func checkAuth(client *http.Client) checkResult {
	if apiKey == "" {
		return checkResult{
			name:    "API key valid",
			status:  "FAIL",
			message: "No API key — set OPENSEND_API_KEY or pass --api-key",
		}
	}

	url := strings.TrimRight(endpoint, "/") + "/api/api-keys"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return checkResult{
			name:    "API key valid",
			status:  "FAIL",
			message: fmt.Sprintf("Cannot build request: %v", err),
		}
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return checkResult{
			name:    "API key valid",
			status:  "FAIL",
			message: fmt.Sprintf("Request failed: %v — check OPENSEND_ENDPOINT", err),
		}
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	switch resp.StatusCode {
	case http.StatusOK:
		return checkResult{
			name:    "API key valid",
			status:  "PASS",
			message: "API key accepted",
		}
	case http.StatusUnauthorized, http.StatusForbidden:
		return checkResult{
			name:    "API key valid",
			status:  "FAIL",
			message: fmt.Sprintf("API key rejected (HTTP %d) — check OPENSEND_API_KEY value", resp.StatusCode),
		}
	default:
		return checkResult{
			name:    "API key valid",
			status:  "WARN",
			message: fmt.Sprintf("Unexpected HTTP %d from /api/api-keys — cannot confirm key validity", resp.StatusCode),
		}
	}
}

func checkDomains(client *http.Client) checkResult {
	if apiKey == "" {
		return checkResult{
			name:    "Domains configured",
			status:  "WARN",
			message: "Skipped — no API key available to check domains",
		}
	}

	url := strings.TrimRight(endpoint, "/") + "/api/domains"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return checkResult{
			name:    "Domains configured",
			status:  "FAIL",
			message: fmt.Sprintf("Cannot build request: %v", err),
		}
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return checkResult{
			name:    "Domains configured",
			status:  "FAIL",
			message: fmt.Sprintf("Request failed: %v", err),
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return checkResult{
			name:    "Domains configured",
			status:  "WARN",
			message: fmt.Sprintf("Could not list domains (HTTP %d) — may need full_access key", resp.StatusCode),
		}
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return checkResult{
			name:    "Domains configured",
			status:  "WARN",
			message: fmt.Sprintf("Could not read domain list: %v", err),
		}
	}

	doms, err := parseDomains(body)
	if err != nil {
		return checkResult{
			name:    "Domains configured",
			status:  "WARN",
			message: fmt.Sprintf("Could not parse domain list: %v", err),
		}
	}

	if len(doms) == 0 {
		return checkResult{
			name:    "Domains configured",
			status:  "WARN",
			message: "No domains found — add one at your OpenSend dashboard under Settings > Domains",
		}
	}

	return checkResult{
		name:    "Domains configured",
		status:  "PASS",
		message: fmt.Sprintf("%d domain(s) found", len(doms)),
	}
}
