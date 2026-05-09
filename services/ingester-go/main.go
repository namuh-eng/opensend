package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/namuh-eng/opensend/services/ingester-go/internal/config"
	"github.com/namuh-eng/opensend/services/ingester-go/internal/httpapi"
)

func main() {
	cfg := config.Load(os.Getenv)
	server := &http.Server{
		Addr:              cfg.Addr(),
		Handler:           httpapi.NewHandler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("ingester-go shutdown failed", "error", err)
		}
	}()

	slog.Info("ingester-go listening", "addr", cfg.Addr(), "mode", "experimental-shadow")
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("ingester-go failed", "error", err)
		os.Exit(1)
	}
}
