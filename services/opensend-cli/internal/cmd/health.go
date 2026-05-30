package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "Check the health of the OpenSend server",
	Long:  `Makes a GET request to /api/health and reports the server status.`,
	RunE:  runHealth,
}

func runHealth(cmd *cobra.Command, args []string) error {
	client := &http.Client{Timeout: 10 * time.Second}

	url := strings.TrimRight(endpoint, "/") + "/api/health"
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("could not reach %s: %w", url, err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))

	// Try to extract a short summary from a JSON body (e.g. {"status":"ok"}).
	summary := oneliner(body)

	if resp.StatusCode == http.StatusOK {
		fmt.Fprintf(cmd.OutOrStdout(), "status: ok (%d)  %s\n", resp.StatusCode, summary)
		return nil
	}

	fmt.Fprintf(cmd.OutOrStderr(), "status: unhealthy (%d)  %s\n", resp.StatusCode, summary)
	return fmt.Errorf("server returned %d", resp.StatusCode)
}

// oneliner extracts a short human-readable string from a JSON body, or falls
// back to the raw bytes (trimmed). Returns empty string if body is empty.
func oneliner(body []byte) string {
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" {
		return ""
	}
	var m map[string]any
	if err := json.Unmarshal(body, &m); err == nil {
		// Prefer "status", then "message", then first string value.
		for _, key := range []string{"status", "message", "error"} {
			if v, ok := m[key]; ok {
				if s, ok := v.(string); ok {
					return s
				}
			}
		}
	}
	if len(trimmed) > 80 {
		return trimmed[:80] + "…"
	}
	return trimmed
}
