# opensend CLI

A minimal Go-based CLI for the [OpenSend](https://github.com/namuh-eng/opensend) email platform.
Speaks directly to the OpenSend REST API — no Node.js required.

## Build

```sh
# From the repo root:
make cli-build
# Binary is written to bin/opensend

# Or from this directory:
go build -o ../../bin/opensend ./
```

## Usage

```sh
opensend [--endpoint URL] [--api-key KEY] <command>
```

### version

Print the CLI version, git commit, and build date.

```sh
opensend version
# opensend version 0.1.0 (commit abc1234, built 2025-01-01T00:00:00Z)
```

### health

Check that the OpenSend server is reachable and healthy.
Exits 0 on HTTP 200, exits 1 otherwise.

```sh
opensend health
opensend health --endpoint https://mail.example.com
```

### domains list

List all domains registered on the OpenSend instance.
Requires an API key.

```sh
opensend domains list
opensend domains list --endpoint https://mail.example.com --api-key os_live_...
```

Output:

```
NAME        STATUS    REGION      CREATED
acme.com    verified  us-east-1   2025-01-15T10:00:00Z
beta.io     pending   eu-west-1   2025-03-20T08:30:00Z
```

## Environment variables

| Variable           | Description                              | Default                  |
|--------------------|------------------------------------------|--------------------------|
| `OPENSEND_API_KEY` | API key for authenticated endpoints      | _(none — required)_      |
| `OPENSEND_ENDPOINT`| Base URL of the OpenSend instance        | `http://localhost:3015`  |

Flags (`--api-key`, `--endpoint`) take precedence over environment variables.

## Development

```sh
# Tests
make cli-test

# Vet + tests
make cli-check

# All Go checks (aggregator)
make go-all
```
