// Package version holds build-time metadata injected via ldflags.
package version

// These variables are set at build time via:
//
//	-ldflags "-X github.com/namuh-eng/opensend/services/opensend-cli/internal/version.Version=..."
var (
	Version   = "dev"
	Commit    = "unknown"
	BuildDate = "unknown"
)
