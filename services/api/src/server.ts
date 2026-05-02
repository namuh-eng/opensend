import app from "./index";

type FetchHandler = typeof app.fetch;

declare const Bun: {
  env?: Record<string, string | undefined>;
  serve: (options: {
    fetch: FetchHandler;
    hostname: string;
    port: number;
  }) => { port: number };
};

const DEFAULT_PORT = 3026;
const DEFAULT_HOST = "0.0.0.0";

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_PORT;
}

const port = parsePort(Bun.env?.PORT ?? process.env.PORT);
const hostname = Bun.env?.HOST ?? process.env.HOST ?? DEFAULT_HOST;

const server = Bun.serve({
  fetch: app.fetch,
  hostname,
  port,
});

console.log(`control-plane-api listening on http://${hostname}:${server.port}`);
