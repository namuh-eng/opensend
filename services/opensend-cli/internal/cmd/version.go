package cmd

import (
	"fmt"

	"github.com/namuh-eng/opensend/services/opensend-cli/internal/version"
	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the opensend CLI version",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Fprintf(cmd.OutOrStdout(), "opensend version %s (commit %s, built %s)\n",
			version.Version, version.Commit, version.BuildDate)
		return nil
	},
}
