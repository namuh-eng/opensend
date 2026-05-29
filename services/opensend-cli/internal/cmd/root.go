// Package cmd wires together all opensend CLI subcommands.
package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var (
	endpoint string
	apiKey   string
)

// rootCmd is the base command when called without any subcommands.
var rootCmd = &cobra.Command{
	Use:   "opensend",
	Short: "CLI for the OpenSend email platform",
	Long: `opensend is a command-line tool for managing your OpenSend instance.

It speaks directly to the OpenSend REST API, so you can inspect domain
status, check server health, and more — all from your terminal.`,
}

// Execute runs the root command. Called by main.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(
		&endpoint,
		"endpoint",
		envOrDefault("OPENSEND_ENDPOINT", "http://localhost:3015"),
		"OpenSend API base URL (env: OPENSEND_ENDPOINT)",
	)
	rootCmd.PersistentFlags().StringVar(
		&apiKey,
		"api-key",
		os.Getenv("OPENSEND_API_KEY"),
		"OpenSend API key (env: OPENSEND_API_KEY)",
	)

	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(healthCmd)
	rootCmd.AddCommand(domainsCmd)
	rootCmd.AddCommand(apiKeysCmd)
	rootCmd.AddCommand(logsCmd)
	rootCmd.AddCommand(sendCmd)
}

// envOrDefault returns the value of the named environment variable, or def if unset/empty.
func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
