package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

// sendEmailRequest matches the POST /api/emails body (sendEmailSchema fields).
type sendEmailRequest struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Subject string `json:"subject"`
	Text    string `json:"text,omitempty"`
	HTML    string `json:"html,omitempty"`
	ReplyTo string `json:"reply_to,omitempty"`
}

// sendEmailResponse is the shape returned by POST /api/emails on success.
type sendEmailResponse struct {
	ID string `json:"id"`
}

var (
	sendFrom      string
	sendTo        string
	sendSubject   string
	sendText      string
	sendHTML      string
	sendReplyTo   string
	sendTextFile  string
	sendHTMLFile  string
)

var sendCmd = &cobra.Command{
	Use:   "send",
	Short: "Send an email via the OpenSend API",
	RunE:  runSend,
}

func init() {
	sendCmd.Flags().StringVar(&sendFrom, "from", "", "Sender email address (required)")
	sendCmd.Flags().StringVar(&sendTo, "to", "", "Recipient email address (required)")
	sendCmd.Flags().StringVar(&sendSubject, "subject", "", "Email subject (required)")
	sendCmd.Flags().StringVar(&sendText, "text", "", "Plain-text body")
	sendCmd.Flags().StringVar(&sendHTML, "html", "", "HTML body")
	sendCmd.Flags().StringVar(&sendReplyTo, "reply-to", "", "Reply-to address")
	sendCmd.Flags().StringVar(&sendTextFile, "text-file", "", "Path to plain-text body file")
	sendCmd.Flags().StringVar(&sendHTMLFile, "html-file", "", "Path to HTML body file")
}

func runSend(cmd *cobra.Command, args []string) error {
	if err := requireAPIKey(); err != nil {
		return err
	}
	if sendFrom == "" {
		return fmt.Errorf("--from is required")
	}
	if sendTo == "" {
		return fmt.Errorf("--to is required")
	}
	if sendSubject == "" {
		return fmt.Errorf("--subject is required")
	}

	// Resolve text body.
	textBody := sendText
	if sendTextFile != "" {
		data, err := os.ReadFile(sendTextFile)
		if err != nil {
			return fmt.Errorf("reading --text-file %q: %w", sendTextFile, err)
		}
		textBody = string(data)
	}

	// Resolve HTML body.
	htmlBody := sendHTML
	if sendHTMLFile != "" {
		data, err := os.ReadFile(sendHTMLFile)
		if err != nil {
			return fmt.Errorf("reading --html-file %q: %w", sendHTMLFile, err)
		}
		htmlBody = string(data)
	}

	if textBody == "" && htmlBody == "" {
		return fmt.Errorf("at least one of --text, --html, --text-file, or --html-file is required")
	}

	payload := sendEmailRequest{
		From:    sendFrom,
		To:      sendTo,
		Subject: sendSubject,
		Text:    textBody,
		HTML:    htmlBody,
		ReplyTo: sendReplyTo,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshalling request: %w", err)
	}

	resp, err := doRequest(http.MethodPost, "/api/emails", bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		// Try to extract a server-side error message.
		var errEnv struct {
			Error   string `json:"error"`
			Message string `json:"message"`
		}
		if jsonErr := json.Unmarshal(respBody, &errEnv); jsonErr == nil {
			msg := errEnv.Error
			if msg == "" {
				msg = errEnv.Message
			}
			if msg != "" {
				return fmt.Errorf("server error: %s", msg)
			}
		}
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var result sendEmailResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("parsing response: %w", err)
	}

	fmt.Fprintf(cmd.OutOrStdout(), "Sent email %s\n", result.ID)
	return nil
}
