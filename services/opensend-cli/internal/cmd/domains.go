package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
)

// domain is a minimal representation of the domain object returned by /api/domains.
// Fields are kept loose so the CLI is not brittle against schema changes.
type domain struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	Region    string `json:"region"`
	CreatedAt string `json:"createdAt"`
}

// domainsListResponse accommodates both a bare array and a wrapped {"data":[...]} shape.
type domainsListResponse struct {
	Data []domain `json:"data"`
}

var domainsCmd = &cobra.Command{
	Use:   "domains",
	Short: "Manage domains",
}

var domainsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all verified domains",
	RunE:  runDomainsList,
}

func init() {
	domainsCmd.AddCommand(domainsListCmd)
}

func runDomainsList(cmd *cobra.Command, args []string) error {
	if apiKey == "" {
		return fmt.Errorf("API key required — set OPENSEND_API_KEY or pass --api-key")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := strings.TrimRight(endpoint, "/") + "/api/domains"

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("could not reach %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MiB
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	domains, err := parseDomains(body)
	if err != nil {
		return fmt.Errorf("parsing response: %w", err)
	}

	if len(domains) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No domains found.")
		return nil
	}

	w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 3, ' ', 0)
	fmt.Fprintln(w, "NAME\tSTATUS\tREGION\tCREATED")
	for _, d := range domains {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n",
			d.Name,
			d.Status,
			orDash(d.Region),
			formatCreated(d.CreatedAt),
		)
	}
	return w.Flush()
}

// parseDomains handles both a bare JSON array and a {"data":[...]} envelope.
func parseDomains(body []byte) ([]domain, error) {
	// Try wrapped shape first.
	var wrapped domainsListResponse
	if err := json.Unmarshal(body, &wrapped); err == nil && wrapped.Data != nil {
		return wrapped.Data, nil
	}
	// Fall back to bare array.
	var list []domain
	if err := json.Unmarshal(body, &list); err != nil {
		return nil, err
	}
	return list, nil
}

// orDash returns s if non-empty, otherwise "-".
func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}

// formatCreated trims sub-second precision from ISO-8601 timestamps for readability.
func formatCreated(s string) string {
	if s == "" {
		return "-"
	}
	// Trim anything after the seconds field (e.g. ".000Z" → "Z").
	if i := strings.IndexByte(s, '.'); i > 0 {
		rest := s[i+1:]
		if z := strings.IndexAny(rest, "Z+-"); z >= 0 {
			s = s[:i] + rest[z:]
		}
	}
	return s
}
