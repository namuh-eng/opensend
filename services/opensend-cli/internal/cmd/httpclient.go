package cmd

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// sharedClient is the package-wide HTTP client with a 10s timeout.
// Reused across subcommands so we don't reallocate per request.
var sharedClient = &http.Client{Timeout: 10 * time.Second}

// maxBodyBytes caps response bodies at 1 MiB so a misbehaving server
// can't OOM the CLI.
const maxBodyBytes = 1 << 20

// requireAPIKey returns a CLI-friendly error when --api-key/OPENSEND_API_KEY
// is missing. Use at the top of any subcommand that hits an authenticated
// endpoint.
func requireAPIKey() error {
	if apiKey == "" {
		return fmt.Errorf("API key required — set OPENSEND_API_KEY or pass --api-key")
	}
	return nil
}

// doRequest builds and executes a request against endpoint+path with Bearer
// auth (when apiKey is set), Accept: application/json, and Content-Type:
// application/json when body is non-nil. Returns the raw response — caller
// must close resp.Body.
func doRequest(method, path string, body io.Reader) (*http.Response, error) {
	url := strings.TrimRight(endpoint, "/") + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, fmt.Errorf("building request: %w", err)
	}
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := sharedClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("could not reach %s: %w", url, err)
	}
	return resp, nil
}

// readOKBody closes resp.Body and returns its bytes when the status is one
// of okStatuses (default: any 2xx). On a non-OK status it returns a
// "server returned N: <excerpt>" error so callers don't repeat the boilerplate.
func readOKBody(resp *http.Response, okStatuses ...int) ([]byte, error) {
	defer resp.Body.Close()
	ok := false
	if len(okStatuses) == 0 {
		ok = resp.StatusCode >= 200 && resp.StatusCode < 300
	} else {
		for _, s := range okStatuses {
			if resp.StatusCode == s {
				ok = true
				break
			}
		}
	}
	if !ok {
		excerpt, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, strings.TrimSpace(string(excerpt)))
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
}
