#!/usr/bin/env bun
import { createMcpServer } from "./protocol";

const apiKey = process.env.OPENSEND_API_KEY;
const apiBaseUrl = process.env.OPENSEND_API_BASE_URL;
const server = createMcpServer({ apiKey, apiBaseUrl });
let buffer = "";

async function handleLine(line: string): Promise<void> {
  if (!line.trim()) return;
  let input: unknown;
  try {
    input = JSON.parse(line) as unknown;
  } catch {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } })}\n`,
    );
    return;
  }

  const response = await server.handleJsonRpc(input);
  if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";
  for (const line of lines) {
    void handleLine(line);
  }
});
process.stdin.on("end", () => {
  if (buffer.trim()) void handleLine(buffer);
});
