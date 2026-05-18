# Send emails with Go

Send email from Go with the first-party OpenSend Go SDK.

Install the tagged module version from a Go module:

```bash
go get github.com/namuh-eng/opensend/packages/go-sdk@v0.1.0
```

If `OPENSEND_BASE_URL` is unset, the SDK targets `https://opensend.namuh.co`.
Set `OPENSEND_BASE_URL` only when pointing the SDK at a self-hosted OpenSend
origin.

See `packages/go-sdk/README.md` for current status and examples.
