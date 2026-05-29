package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
)

// logListItem represents one entry from GET /api/logs.
type logListItem struct {
	ID             string `json:"id"`
	Method         string `json:"method"`
	Endpoint       string `json:"endpoint"`
	ResponseStatus int    `json:"response_status"`
	UserAgent      string `json:"user_agent"`
	APIKeyID       string `json:"api_key_id"`
	CreatedAt      string `json:"created_at"`
}

// logListResponse is the envelope from GET /api/logs.
type logListResponse struct {
	Object  string        `json:"object"`
	Data    []logListItem `json:"data"`
	HasMore bool          `json:"has_more"`
}

var (
	logsLimit  int
	logsFollow bool
)

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "View API request logs",
}

var logsTailCmd = &cobra.Command{
	Use:   "tail",
	Short: "Print recent log entries (use --follow to poll continuously)",
	RunE:  runLogsTail,
}

func init() {
	logsTailCmd.Flags().IntVar(&logsLimit, "limit", 20, "Number of log entries to fetch")
	logsTailCmd.Flags().BoolVar(&logsFollow, "follow", false, "Poll every 2 seconds for new entries")

	logsCmd.AddCommand(logsTailCmd)
}

func fetchLogs(limit int) ([]logListItem, error) {
	if err := requireAPIKey(); err != nil {
		return nil, err
	}

	resp, err := doRequest(http.MethodGet, fmt.Sprintf("/api/logs?limit=%d", limit), nil)
	if err != nil {
		return nil, err
	}
	body, err := readOKBody(resp, http.StatusOK)
	if err != nil {
		return nil, err
	}

	var listResp logListResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		return nil, fmt.Errorf("parsing response: %w", err)
	}

	return listResp.Data, nil
}

func printLogEntries(w io.Writer, entries []logListItem) {
	tw := tabwriter.NewWriter(w, 0, 0, 3, ' ', 0)
	for _, e := range entries {
		fmt.Fprintf(tw, "%s\t%s\t%s\t%d\n",
			formatCreated(e.CreatedAt),
			orDash(e.Method),
			orDash(e.Endpoint),
			e.ResponseStatus,
		)
	}
	tw.Flush()
}

func runLogsTail(cmd *cobra.Command, args []string) error {
	if apiKey == "" {
		return fmt.Errorf("API key required — set OPENSEND_API_KEY or pass --api-key")
	}

	out := cmd.OutOrStdout()

	if !logsFollow {
		entries, err := fetchLogs(logsLimit)
		if err != nil {
			return err
		}
		if len(entries) == 0 {
			fmt.Fprintln(out, "No logs found.")
			return nil
		}
		printLogEntries(out, entries)
		return nil
	}

	// --follow mode: poll every 2s, deduplicate by ID.
	seen := make(map[string]bool)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	fmt.Fprintln(out, "Tailing logs (Ctrl-C to stop)...")

	for {
		entries, err := fetchLogs(logsLimit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: %v\n", err)
		} else {
			// Print only new entries (reverse order: oldest new first).
			var newEntries []logListItem
			for _, e := range entries {
				if !seen[e.ID] {
					newEntries = append(newEntries, e)
					seen[e.ID] = true
				}
			}
			// entries come newest-first from the API; print oldest-first.
			for i := len(newEntries) - 1; i >= 0; i-- {
				printLogEntries(out, newEntries[i:i+1])
			}
		}

		select {
		case <-stop:
			fmt.Fprintln(out, "\nStopped.")
			return nil
		case <-time.After(2 * time.Second):
		}
	}
}
