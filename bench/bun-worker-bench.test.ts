// @ts-nocheck
//
// This file uses `bun:test` and the `Bun` global runtime API — neither is in
// the project's TypeScript lib path (no @types/bun dependency is installed
// because Bun is the runtime, not a TS-library dependency). The file is only
// loaded by `bun test`, never by the Next.js TS compiler in production. Skip
// typecheck rather than add a runtime-only dependency.
/**
 * Bun-side benchmarks for the three hot paths compared against Go.
 *
 * Workloads:
 *   1. JSON decode of a representative SES/SNS event payload
 *   2. HMAC-SHA256 signing matching packages/core/src/webhook-signing.ts format
 *   3. Tight-loop webhook dispatch (1000 POSTs to an in-process HTTP server)
 *
 * Run with:
 *   bun test bench/bun-worker-bench.ts
 *
 * Fixtures at bench/fixtures/ are shared with the Go benchmarks.
 */

import { describe, test } from "bun:test";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── Fixture loading ────────────────────────────────────────────────────────────

const fixturesDir = join(import.meta.dir, "fixtures");

const sesEventRaw = readFileSync(join(fixturesDir, "ses-event.json"), "utf8");
const webhookPayloadRaw = readFileSync(
  join(fixturesDir, "webhook-payload.json"),
  "utf8",
);

// ── Webhook signing (matches packages/core/src/webhook-signing.ts) ─────────────

function signWebhookPayload(
  secret: string,
  msgId: string,
  timestamp: string,
  body: string,
): string {
  const key = secret.replace("whsec_", "");
  const toSign = `${msgId}.${timestamp}.${body}`;
  const hmac = createHmac("sha256", key);
  const signature = hmac.update(toSign).digest("base64");
  return `v1,${signature}`;
}

// ── Micro-benchmark harness ────────────────────────────────────────────────────

function benchSync(label: string, iterations: number, fn: () => void): void {
  // Warmup
  for (let i = 0; i < Math.min(iterations / 10, 100); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;

  const nsPerOp = (elapsed * 1_000_000) / iterations;
  const opsPerSec = Math.round(iterations / (elapsed / 1000));
  console.log(
    `  ${label}: ${nsPerOp.toFixed(1)} ns/op  (${opsPerSec.toLocaleString()} ops/sec, ${iterations} iterations, ${elapsed.toFixed(1)} ms total)`,
  );
}

async function benchAsync(
  label: string,
  iterations: number,
  fn: () => Promise<void>,
): Promise<void> {
  // Warmup
  for (let i = 0; i < Math.min(iterations / 10, 5); i++) await fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;

  const nsPerOp = (elapsed * 1_000_000) / iterations;
  const opsPerSec = Math.round(iterations / (elapsed / 1000));
  console.log(
    `  ${label}: ${nsPerOp.toFixed(1)} ns/op  (${opsPerSec.toLocaleString()} ops/sec, ${iterations} iterations, ${elapsed.toFixed(1)} ms total)`,
  );
}

// ── Benchmark 1: JSON decode of SES SNS event ─────────────────────────────────

describe("Bench: JSON decode SES event", () => {
  test("JSON.parse ses-event.json (100k iterations)", () => {
    benchSync("Bun JSON.parse ses-event", 100_000, () => {
      const _ev = JSON.parse(sesEventRaw);
    });
  });
});

// ── Benchmark 2: HMAC-SHA256 webhook signing ──────────────────────────────────

describe("Bench: HMAC-SHA256 sign webhook payload", () => {
  test("signWebhookPayload (100k iterations)", () => {
    const secret = "whsec_testsecretkey1234567890abcdef";
    const msgId = "msg_01HXYZ1234567890";
    const timestamp = "1716980400";

    benchSync("Bun HMAC-SHA256 sign", 100_000, () => {
      const _sig = signWebhookPayload(
        secret,
        msgId,
        timestamp,
        webhookPayloadRaw,
      );
    });
  });
});

// ── Benchmark 3: Webhook dispatch loop (1000 POSTs) ───────────────────────────

describe("Bench: Webhook dispatch 1000 requests", () => {
  test("dispatch 1000 webhook POSTs sequential (5 iterations)", async () => {
    const mockServer = Bun.serve({
      port: 0,
      fetch(_req) {
        return new Response("ok", { status: 200 });
      },
    });

    const serverUrl = `http://localhost:${mockServer.port}`;
    const secret = "whsec_testsecretkey1234567890abcdef";
    const timestamp = "1716980400";

    await benchAsync("Bun webhook dispatch 1000 POSTs", 5, async () => {
      for (let j = 0; j < 1000; j++) {
        const msgId = `msg_${String(j).padStart(10, "0")}`;
        const sig = signWebhookPayload(
          secret,
          msgId,
          timestamp,
          webhookPayloadRaw,
        );
        await fetch(serverUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "svix-id": msgId,
            "svix-timestamp": timestamp,
            "svix-signature": sig,
          },
          body: webhookPayloadRaw,
        });
      }
    });

    mockServer.stop();
  }, 120_000);
});
