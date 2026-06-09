import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
  },
  resolve: {
    alias: [
      {
        find: "@opensend/core/src/webhook-events",
        replacement: path.resolve(
          __dirname,
          "./packages/core/src/webhook-events.ts",
        ),
      },
      {
        find: "@opensend/core",
        replacement: path.resolve(__dirname, "./packages/core/src/index.ts"),
      },
      {
        find: "@opensend/mcp",
        replacement: path.resolve(__dirname, "./packages/mcp/src/index.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
