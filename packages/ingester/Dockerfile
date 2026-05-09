FROM oven/bun:1.3.8-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
COPY packages ./packages
COPY services ./services
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun build ./packages/ingester/src/server.ts \
  --target bun \
  --minify \
  --outfile /tmp/ingester-server.js \
  && bun build ./packages/ingester/src/job-scheduler.ts \
    --target bun \
    --minify \
    --outfile /tmp/ingester-job-scheduler.js

FROM oven/bun:1.3.8-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3016
RUN addgroup --system --gid 1001 bunjs \
  && adduser --system --uid 1001 ingester
COPY --from=build /tmp/ingester-server.js ./server.js
COPY --from=build /tmp/ingester-job-scheduler.js ./job-scheduler.js
USER ingester
EXPOSE 3016
CMD ["bun", "/app/server.js"]
