# Migrate from Resend

Use the in-tree OpenSend migration verifier to inspect an existing Resend integration before you point it at OpenSend. Always pass the application repository you want to scan; the verifier fails closed when the target directory is omitted.

The verifier is a bounded v1 compatibility tool. It scans source code for common Resend SDK imports, SDK calls, environment variables, and raw REST endpoint usage. It then maps each finding to a committed OpenSend compatibility matrix and writes a shareable Markdown report.

## Install and run from this repository

The verifier lives in `packages/migrate-from-resend` and is private in-tree tooling for this release.

```bash
bun run --cwd packages/migrate-from-resend migrate-from-resend /path/to/your/app
```

By default it writes:

```txt
migrate-from-resend-report.md
```

To print the report instead:

```bash
bun run --cwd packages/migrate-from-resend migrate-from-resend /path/to/your/app --stdout
```

## What the report includes

- Prior-provider SDK imports and compatibility-client construction sites.
- Common SDK calls such as email send, batch send, cancel, contacts, domains, segments, broadcasts, templates, API keys, webhooks, and suppressions.
- Raw REST usage against prior-provider email API endpoints.
- Environment variable diffs such as `RESEND_API_KEY` to `OPENSEND_API_KEY`.
- A status for each finding: `full`, `partial`, `unsupported`, or `unknown`.
- Caveats and evidence references for the compatibility decision.
- Rerun commands and cutover notes.

Static scan is advisory. Dynamic wrappers, generated endpoint strings, uncommon SDK helpers, and payload-specific behavior may require manual review.

## Sandbox dry-run request plan

Add `--sandbox-plan` to include redacted request plans for OpenSend sandbox checks:

```bash
bun run --cwd packages/migrate-from-resend migrate-from-resend /path/to/your/app \
  --sandbox-plan \
  --base-url https://opensend.namuh.co \
  --api-key "$OPENSEND_API_KEY"
```

The v1 verifier does not execute those requests. It does not call the network, does not send email, and does not mutate contacts, domains, audiences, broadcasts, or templates. The request plan is only a review artifact for your own sandbox test harness.

## Environment changes

```bash
# Before
RESEND_API_KEY=re_your_resend_key
RESEND_BASE_URL=<prior-provider-api-origin>

# After
OPENSEND_API_KEY=os_your_opensend_key
OPENSEND_BASE_URL=https://opensend.namuh.co
```

Use your self-hosted OpenSend origin for `OPENSEND_BASE_URL` when running your own deployment.

## Compatibility status meanings

- `full` — OpenSend has a verified v1-compatible route or SDK behavior for the detected usage, subject to the listed caveats.
- `partial` — OpenSend has a related route or feature, but behavior, SDK coverage, response shape, deployed proof, or edge cases differ.
- `unsupported` — the v1 verifier has no safe OpenSend migration path for that usage.
- `unknown` — the scanner found Resend-shaped usage outside the committed matrix. Review manually before claiming compatibility.

## Non-goals in v1

- No codemods or automatic rewrites.
- No historical data migration from Resend.
- No npm publishing from this repository package.
- No live sends or customer-resource mutations.

## Recommended migration flow

1. Run the verifier against your app and commit the generated report to your internal migration notes.
2. Replace API keys and base URL configuration in a sandbox environment.
3. Exercise your own integration tests against OpenSend using sandbox recipients.
4. Resolve every `partial`, `unsupported`, and `unknown` finding before production cutover.
5. Keep the verifier report with your launch checklist so compatibility claims remain auditable.
