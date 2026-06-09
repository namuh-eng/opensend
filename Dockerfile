FROM oven/bun:1.3.8-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services ./services
RUN bun install --frozen-lockfile --ignore-scripts


FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* must be present at build time — Next.js inlines them into the client bundle.
# These are intentionally optional; if unset, the client falls back to no-op observability.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST=""
ARG SENTRY_ENVIRONMENT=""
ARG SENTRY_RELEASE=""
# Better Auth is imported during static generation. This non-secret value only
# prevents default-secret build noise; runtime still requires BETTER_AUTH_SECRET.
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    SENTRY_ENVIRONMENT=$SENTRY_ENVIRONMENT \
    SENTRY_RELEASE=$SENTRY_RELEASE \
    NEXT_TELEMETRY_DISABLED=1 \
    BETTER_AUTH_SECRET=build-time-better-auth-secret-not-used-at-runtime
RUN bun run build

# Migration runner — lightweight image with drizzle-kit + pg
FROM base AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY src/lib/db/schema.ts ./src/lib/db/schema.ts
COPY src/lib/db/migrate.ts ./src/lib/db/migrate.ts
COPY package.json ./
CMD ["bun", "src/lib/db/migrate.ts"]

# Production app
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
CMD ["bun", "server.js"]
