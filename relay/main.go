package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	body      []byte
	expiresAt time.Time
}
type rateWindow struct {
	startedAt time.Time
	count     int
}
type apiServer struct {
	apiKey     string
	relayToken string
	baseURL    string
	ttl        time.Duration
	client     *http.Client
	mu         sync.RWMutex
	cache      map[string]cacheEntry
	rateMu     sync.Mutex
	rates      map[string]rateWindow
}

const maxCacheEntries = 1000
const requestsPerMinute = 60

func main() {
	s := &apiServer{
		apiKey:     mustEnv("CLASH_ROYALE_API_KEY"),
		relayToken: mustEnv("RELAY_TOKEN"),
		baseURL:    envOr("CLASH_ROYALE_API_BASE_URL", "https://api.clashroyale.com/v1"),
		ttl:        30 * time.Second,
		client:     &http.Client{Timeout: 10 * time.Second},
		cache:      make(map[string]cacheEntry),
		rates:      make(map[string]rateWindow),
	}
	if value := os.Getenv("RELAY_CACHE_TTL_MS"); value != "" {
		if duration, err := time.ParseDuration(value + "ms"); err == nil && duration > 0 {
			s.ttl = duration
		}
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.health)
	mux.HandleFunc("/v1/egress-ip", s.egressIP)
	mux.HandleFunc("/v1/players/", s.player)
	port := envOr("PORT", "8080")
	log.Printf("Royli API ouvindo na porta %s", port)
	server := &http.Server{
		Addr: "0.0.0.0:" + port, Handler: securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second,
		WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}

func (s *apiServer) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true, "service": "royli-api"})
}

func (s *apiServer) egressIP(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	if !s.allowRequest(r) {
		rateLimited(w)
		return
	}
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://api.ipify.org?format=json", nil)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": "egress_ip_unavailable"})
		return
	}
	response, err := s.client.Do(req)
	if err != nil {
		writeJSON(w, 502, map[string]string{"error": "egress_ip_unavailable"})
		return
	}
	defer response.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(response.StatusCode)
	_, _ = io.Copy(w, response.Body)
}

func (s *apiServer) player(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, 401, map[string]string{"error": "unauthorized"})
		return
	}
	if !s.allowRequest(r) {
		rateLimited(w)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/v1")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if r.Method != http.MethodGet || len(parts) < 2 || parts[0] != "players" || !validPlayerTag(parts[1]) {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	apiPath := "/players/" + url.PathEscape(parts[1])
	if len(parts) == 3 && parts[2] == "battlelog" {
		apiPath += "/battlelog"
	} else if len(parts) != 2 {
		writeJSON(w, 404, map[string]string{"error": "not_found"})
		return
	}
	body, status, err := s.fetch(r.Context(), apiPath)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": "clash_api_error", "message": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(200)
	_, _ = w.Write(body)
}

func (s *apiServer) fetch(ctx context.Context, path string) ([]byte, int, error) {
	now := time.Now()
	s.mu.RLock()
	entry, found := s.cache[path]
	s.mu.RUnlock()
	if found && now.Before(entry.expiresAt) {
		return entry.body, 200, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(s.baseURL, "/")+path, nil)
	if err != nil {
		return nil, 502, err
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Accept", "application/json")
	response, err := s.client.Do(req)
	if err != nil {
		return nil, 502, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return nil, 502, err
	}
	if response.StatusCode >= 400 {
		var payload struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(body, &payload)
		if payload.Message == "" {
			payload.Message = fmt.Sprintf("API retornou HTTP %d", response.StatusCode)
		}
		return nil, response.StatusCode, errors.New(payload.Message)
	}
	s.mu.Lock()
	for key, cached := range s.cache {
		if !now.Before(cached.expiresAt) {
			delete(s.cache, key)
		}
	}
	if len(s.cache) >= maxCacheEntries {
		oldestKey := ""
		var oldest time.Time
		for key, cached := range s.cache {
			if oldestKey == "" || cached.expiresAt.Before(oldest) {
				oldestKey, oldest = key, cached.expiresAt
			}
		}
		if oldestKey != "" {
			delete(s.cache, oldestKey)
		}
	}
	s.cache[path] = cacheEntry{body: body, expiresAt: now.Add(s.ttl)}
	s.mu.Unlock()
	return body, 200, nil
}

func (s *apiServer) authorized(r *http.Request) bool {
	provided, expected := []byte(r.Header.Get("Authorization")), []byte("Bearer "+s.relayToken)
	return len(provided) == len(expected) && subtle.ConstantTimeCompare(provided, expected) == 1
}

func (s *apiServer) allowRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	now := time.Now()
	s.rateMu.Lock()
	defer s.rateMu.Unlock()
	window, found := s.rates[host]
	if !found || now.Sub(window.startedAt) >= time.Minute {
		s.rates[host] = rateWindow{startedAt: now, count: 1}
		return true
	}
	if window.count >= requestsPerMinute {
		return false
	}
	window.count++
	s.rates[host] = window
	return true
}

func rateLimited(w http.ResponseWriter) {
	w.Header().Set("Retry-After", "60")
	writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate_limited"})
}

func validPlayerTag(value string) bool {
	if !strings.HasPrefix(value, "#") || len(value) < 2 {
		return false
	}
	for _, char := range strings.ToUpper(value[1:]) {
		if !strings.ContainsRune("0289CGJLPQRUVY", char) {
			return false
		}
	}
	return true
}
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func mustEnv(name string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		log.Fatalf("variável obrigatória ausente: %s", name)
	}
	return value
}
func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}
