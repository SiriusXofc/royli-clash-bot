package main

import (
	"net/http/httptest"
	"testing"
)

func TestValidPlayerTag(t *testing.T) {
	for _, tag := range []string{"#2PP", "#2pp", "#9YJ02"} {
		if !validPlayerTag(tag) {
			t.Errorf("expected valid tag: %s", tag)
		}
	}
	for _, tag := range []string{"2PP", "#INVALID", "#"} {
		if validPlayerTag(tag) {
			t.Errorf("expected invalid tag: %s", tag)
		}
	}
}

func TestAuthorized(t *testing.T) {
	server := &apiServer{relayToken: "secret"}
	request := httptest.NewRequest("GET", "/", nil)
	request.Header.Set("Authorization", "Bearer secret")
	if !server.authorized(request) {
		t.Fatal("expected authorization to succeed")
	}
	request.Header.Set("Authorization", "Bearer wrong")
	if server.authorized(request) {
		t.Fatal("expected authorization to fail")
	}
}
