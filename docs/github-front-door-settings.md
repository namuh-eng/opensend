# GitHub Front Door Settings

This runbook captures repository settings that are not fully represented by git-tracked files. Apply these only after the README, public docs, templates, and `SECURITY.md` changes have been reviewed.

## Current intent

OpenSend should present as a self-hostable, source-available email API and dashboard for teams that want to run on their own AWS SES quota.

Recommended repository description:

```text
Self-hosted email API, dashboard, and SES-powered delivery for teams that want control.
```

Recommended topics:

```text
self-hosted
transactional-email
email-api
aws-ses
resend-alternative
nextjs
typescript
docker
webhooks
openapi
```

## Manual settings

These require a maintainer or admin with repository settings access:

1. Update the repository description to the recommended text above.
2. Add the recommended topics.
3. Enable Discussions if maintainers want community support and announcements in GitHub.
4. Disable Wiki so docs stay in the repository and public docs routes.
5. Upload a custom social preview image.
6. Create the first release only after maintainers approve release notes and any container/image publishing plan.

## Security policy

`SECURITY.md` is git-tracked. After it lands on the default branch, GitHub should show the security policy indicator. Verify after GitHub indexes the default branch:

```bash
gh repo view namuh-eng/opensend --json isSecurityPolicyEnabled,securityPolicyUrl
```

Expected:

- `isSecurityPolicyEnabled` is `true`.
- `securityPolicyUrl` is non-empty.

## CODE_OF_CONDUCT.md

Do not add `CODE_OF_CONDUCT.md` without maintainer approval of the exact wording. The recommendation is to add one before a broader community launch, but this front-door pass intentionally defers it.

## Live metadata verification

After applying approved live settings, capture:

```bash
gh repo view namuh-eng/opensend --json description,homepageUrl,repositoryTopics,usesCustomOpenGraphImage,hasDiscussionsEnabled,hasWikiEnabled,isSecurityPolicyEnabled,securityPolicyUrl,latestRelease
```

Expected if settings are applied:

- Description matches the recommended self-hosting position.
- Topics cover self-hosting, email API, SES, Docker, webhooks, TypeScript, Next.js, and OpenAPI.
- Discussions and Wiki match the maintainer decision.
- Security policy is enabled after `SECURITY.md` is on the default branch.
- Custom Open Graph image is present if uploaded.
- Latest release is documented, even if the first release remains deferred.

## Social preview direction

Use a real OpenSend signal rather than abstract stock art. Good first version:

- Dashboard screenshot or simple product topology.
- Short message: `Self-host email on AWS SES`.
- Include API, dashboard, ingester, and SES as visible concepts.
- Avoid fake metrics, unsupported release claims, or hidden hosted-cloud telemetry claims.
