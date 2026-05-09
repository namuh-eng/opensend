package httpapi

import (
	"encoding/json"
	"net/http"
)

type StatusResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /readyz", readyzHandler)
	return mux
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	writeStatus(w, StatusResponse{Status: "ok", Service: "ingester-go"})
}

func readyzHandler(w http.ResponseWriter, r *http.Request) {
	writeStatus(w, StatusResponse{Status: "ready", Service: "ingester-go"})
}

func writeStatus(w http.ResponseWriter, response StatusResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(response)
}
