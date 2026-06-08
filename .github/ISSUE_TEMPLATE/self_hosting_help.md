---
name: Self-hosting or install help
about: Get help with Docker Compose, env vars, SES, DNS, or ingester setup
title: "self-host: "
labels: self-hosting
assignees: ""
---

## Goal

What are you trying to run or configure?

## Deployment shape

- Docker Compose / VM / ECS / Fly / Railway / Kubernetes / other:
- App URL:
- Ingester URL:
- Postgres provider:
- SES region:
- Queue/cache provider, if any:

## What fails?

Paste the exact command or page that fails.

## Checks already run

- [ ] `docker compose --env-file .env.example config`
- [ ] App health endpoint
- [ ] Ingester `/health`
- [ ] Migrations
- [ ] SES identity status
- [ ] Scheduler or `/jobs/*` logs

## Sanitized logs

Remove API keys, bearer tokens, OAuth secrets, AWS credentials, database passwords, and customer data.
