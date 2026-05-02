import app from "./index";
import { queueWorker } from "./queue-worker";

const DEFAULT_PORT = 3016;
const DEFAULT_HOST = "0.0.0.0";

const rawPort = Bun.env.PORT ?? process.env.PORT;
const parsedPort = rawPort ? Number(rawPort) : DEFAULT_PORT;
const port = Number.isFinite(parsedPort) ? parsedPort : DEFAULT_PORT;
const hostname = Bun.env.HOST ?? process.env.HOST ?? DEFAULT_HOST;

const server = Bun.serve({
  fetch: app.fetch,
  hostname,
  port,
});

console.log(`opensend-ingester listening on http://${hostname}:${server.port}`);

if (
  (Bun.env.BACKGROUND_WORKER_POLL ?? process.env.BACKGROUND_WORKER_POLL) ===
  "true"
) {
  queueWorker.start();
  console.log("opensend-ingester background job polling enabled");
}
