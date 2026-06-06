package cmd

import (
	"bytes"
	"strings"
	"testing"

	"github.com/namuh-eng/opensend/services/opensend-cli/internal/version"
)

func TestVersionOutput(t *testing.T) {
	version.Version = "1.2.3"
	version.Commit = "abc1234"
	version.BuildDate = "2025-01-01T00:00:00Z"

	var buf bytes.Buffer
	versionCmd.SetOut(&buf)
	if err := versionCmd.RunE(versionCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := buf.String()
	want := "opensend version 1.2.3 (commit abc1234, built 2025-01-01T00:00:00Z)"
	if !strings.Contains(got, want) {
		t.Errorf("output %q does not contain %q", got, want)
	}
}

func TestVersionDefaults(t *testing.T) {
	version.Version = "dev"
	version.Commit = "unknown"
	version.BuildDate = "unknown"

	var buf bytes.Buffer
	versionCmd.SetOut(&buf)
	if err := versionCmd.RunE(versionCmd, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	got := buf.String()
	if !strings.Contains(got, "dev") {
		t.Errorf("expected 'dev' in output, got: %q", got)
	}
}
