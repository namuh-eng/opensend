FROM oven/bun:1.3.8-alpine AS build

ENV NODE_ENV=production
WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services ./services
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun build ./packages/smtp-relay/src/index.ts \
  --target bun \
  --minify \
  --outfile /tmp/smtp-relay.js

FROM oven/bun:1.3.8-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV SMTP_RELAY_HOST=0.0.0.0
ENV SMTP_RELAY_PORT=2587

RUN addgroup --system --gid 1001 bunjs \
  && adduser --system --uid 1001 smtprelay

COPY --from=build /tmp/smtp-relay.js ./smtp-relay.js
USER smtprelay

EXPOSE 2587
CMD ["bun", "/app/smtp-relay.js"]
