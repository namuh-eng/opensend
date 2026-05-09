package config

import (
	"fmt"
	"strconv"
)

const (
	DefaultHost = "0.0.0.0"
	DefaultPort = 3027
)

type Config struct {
	Host string
	Port int
}

func (c Config) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

type Getenv func(string) string

func Load(getenv Getenv) Config {
	host := getenv("HOST")
	if host == "" {
		host = DefaultHost
	}

	port := DefaultPort
	if rawPort := getenv("PORT"); rawPort != "" {
		if parsed, err := strconv.Atoi(rawPort); err == nil && parsed > 0 && parsed <= 65535 {
			port = parsed
		}
	}

	return Config{Host: host, Port: port}
}
