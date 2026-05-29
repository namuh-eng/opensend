package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
)

// apiKeyListItem represents one entry in GET /api/api-keys response.
type apiKeyListItem struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Permission string `json:"permission"`
	Domain     *struct {
		Name string `json:"name"`
	} `json:"domain"`
	CreatedAt  string `json:"created_at"`
	LastUsedAt string `json:"last_used_at"`
}

// apiKeyListResponse is the envelope returned by GET /api/api-keys.
type apiKeyListResponse struct {
	Object  string           `json:"object"`
	Data    []apiKeyListItem `json:"data"`
	HasMore bool             `json:"has_more"`
}

// apiKeyCreateResponse is the envelope returned by POST /api/api-keys.
type apiKeyCreateResponse struct {
	ID    string `json:"id"`
	Token string `json:"token"`
}

var apiKeysCmd = &cobra.Command{
	Use:   "api-keys",
	Short: "Manage API keys",
}

var apiKeysListCmd = &cobra.Command{
	Use:   "list",
	Short: "List API keys",
	RunE:  runApiKeysList,
}

var (
	apiKeyCreateName       string
	apiKeyCreatePermission string
)

var apiKeysCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create an API key",
	RunE:  runApiKeysCreate,
}

var apiKeyRevokeYes bool

var apiKeysRevokeCmd = &cobra.Command{
	Use:   "revoke <id>",
	Short: "Revoke (delete) an API key",
	Args:  cobra.ExactArgs(1),
	RunE:  runApiKeysRevoke,
}

func init() {
	apiKeysCreateCmd.Flags().StringVar(&apiKeyCreateName, "name", "", "Name for the new API key (required)")
	apiKeysCreateCmd.Flags().StringVar(&apiKeyCreatePermission, "permissions", "full_access", "Permission level: full_access, sending_access, read_only")

	apiKeysRevokeCmd.Flags().BoolVar(&apiKeyRevokeYes, "yes", false, "Skip confirmation prompt")

	apiKeysCmd.AddCommand(apiKeysListCmd)
	apiKeysCmd.AddCommand(apiKeysCreateCmd)
	apiKeysCmd.AddCommand(apiKeysRevokeCmd)
}

func runApiKeysList(cmd *cobra.Command, args []string) error {
	if apiKey == "" {
		return fmt.Errorf("API key required — set OPENSEND_API_KEY or pass --api-key")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := strings.TrimRight(endpoint, "/") + "/api/api-keys"

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

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	var listResp apiKeyListResponse
	if err := json.Unmarshal(body, &listResp); err != nil {
		return fmt.Errorf("parsing response: %w", err)
	}

	if len(listResp.Data) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No API keys found.")
		return nil
	}

	w := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 3, ' ', 0)
	fmt.Fprintln(w, "ID\tNAME\tPERMISSIONS\tLAST USED\tCREATED")
	for _, k := range listResp.Data {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n",
			k.ID,
			k.Name,
			orDash(k.Permission),
			formatCreated(k.LastUsedAt),
			formatCreated(k.CreatedAt),
		)
	}
	return w.Flush()
}

func runApiKeysCreate(cmd *cobra.Command, args []string) error {
	if apiKey == "" {
		return fmt.Errorf("API key required — set OPENSEND_API_KEY or pass --api-key")
	}
	if apiKeyCreateName == "" {
		return fmt.Errorf("--name is required")
	}

	payload := map[string]string{
		"name":       apiKeyCreateName,
		"permission": apiKeyCreatePermission,
	}
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshalling request: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := strings.TrimRight(endpoint, "/") + "/api/api-keys"

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("building request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("could not reach %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	var created apiKeyCreateResponse
	if err := json.Unmarshal(body, &created); err != nil {
		return fmt.Errorf("parsing response: %w", err)
	}

	out := cmd.OutOrStdout()
	fmt.Fprintln(out, "")
	fmt.Fprintln(out, "  WARNING: This key is shown only ONCE. Copy it now — you cannot retrieve it again.")
	fmt.Fprintln(out, "")
	fmt.Fprintf(out, "  Key ID:    %s\n", created.ID)
	fmt.Fprintf(out, "  API Key:   %s\n", created.Token)
	fmt.Fprintln(out, "")
	return nil
}

func runApiKeysRevoke(cmd *cobra.Command, args []string) error {
	if apiKey == "" {
		return fmt.Errorf("API key required — set OPENSEND_API_KEY or pass --api-key")
	}

	id := args[0]

	if !apiKeyRevokeYes {
		fmt.Fprintf(cmd.OutOrStdout(), "Revoke API key %s? This cannot be undone. [y/N] ", id)
		var answer string
		fmt.Fscan(cmd.InOrStdin(), &answer)
		if strings.ToLower(strings.TrimSpace(answer)) != "y" {
			fmt.Fprintln(cmd.OutOrStdout(), "Aborted.")
			return nil
		}
	}

	client := &http.Client{Timeout: 10 * time.Second}
	url := strings.TrimRight(endpoint, "/") + "/api/api-keys/" + id

	req, err := http.NewRequest(http.MethodDelete, url, nil)
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

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	fmt.Fprintf(cmd.OutOrStdout(), "API key %s has been revoked.\n", id)
	return nil
}
