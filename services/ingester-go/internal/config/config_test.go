package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	cfg := Load(func(string) string { return "" })

	if cfg.Host != DefaultHost {
		t.Fatalf("expected default host %q, got %q", DefaultHost, cfg.Host)
	}
	if cfg.Port != DefaultPort {
		t.Fatalf("expected default port %d, got %d", DefaultPort, cfg.Port)
	}
	if cfg.Addr() != "0.0.0.0:3027" {
		t.Fatalf("expected default addr 0.0.0.0:3027, got %q", cfg.Addr())
	}
}

func TestLoadHostAndPortFromEnv(t *testing.T) {
	env := map[string]string{
		"HOST": "127.0.0.1",
		"PORT": "4027",
	}

	cfg := Load(func(key string) string { return env[key] })

	if cfg.Host != "127.0.0.1" {
		t.Fatalf("expected host from env, got %q", cfg.Host)
	}
	if cfg.Port != 4027 {
		t.Fatalf("expected port from env, got %d", cfg.Port)
	}
}

func TestLoadFallsBackForInvalidPorts(t *testing.T) {
	tests := []string{"not-a-number", "0", "-1", "65536"}

	for _, rawPort := range tests {
		t.Run(rawPort, func(t *testing.T) {
			cfg := Load(func(key string) string {
				if key == "PORT" {
					return rawPort
				}
				return ""
			})

			if cfg.Port != DefaultPort {
				t.Fatalf("expected invalid port %q to fall back to %d, got %d", rawPort, DefaultPort, cfg.Port)
			}
		})
	}
}
