import { describe, expect, it, vi } from "vitest";
import {
  authenticateBearerHeader,
  createMcpServer,
  handleMcpHttpRequest,
  listMcpTools,
} from "../packages/mcp/src/index";
import { createApp } from "../services/api/src/index";

describe("OpenSend MCP tool registry", () => {
  it("registers deterministic initial parity tools with schemas", () => {
    const tools = listMcpTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "opensend_send_email",
      "opensend_list_emails",
      "opensend_get_email",
      "opensend_create_contact",
      "opensend_list_contacts",
      "opensend_get_contact",
      "opensend_create_domain",
      "opensend_list_domains",
      "opensend_get_domain",
      "opensend_create_webhook",
      "opensend_list_webhooks",
      "opensend_get_webhook",
    ]);

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBe(false);
    }
  });
});

describe("OpenSend MCP JSON-RPC protocol", () => {
  it("lists tools through the MCP tools/list method", async () => {
    const server = createMcpServer({ apiKey: "os_test_key" });

    const response = await server.handleJsonRpc({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    expect(response).toMatchObject({ jsonrpc: "2.0", id: 1 });
    expect(JSON.stringify(response)).toContain("opensend_send_email");
  });

  it("returns a deterministic error for unknown tools", async () => {
    const server = createMcpServer({ apiKey: "os_test_key" });

    const response = await server.handleJsonRpc({
      jsonrpc: "2.0",
      id: "call-1",
      method: "tools/call",
      params: { name: "opensend_fake_tool", arguments: {} },
    });

    expect(response).toEqual({
      jsonrpc: "2.0",
      id: "call-1",
      error: { code: -32602, message: "Unknown or invalid tool call." },
    });
  });

  it("maps tool calls to stable OpenSend public API paths", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ object: "list", data: [], has_more: false }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const server = createMcpServer({
      apiKey: "os_test_key",
      apiBaseUrl: "https://opensend.example",
      fetcher,
    });

    const response = await server.handleJsonRpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "opensend_list_contacts",
        arguments: { limit: 10, after: "contact_123" },
      },
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://opensend.example/api/contacts?limit=10&after=contact_123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer os_test_key",
        }),
      }),
    );
    expect(JSON.stringify(response)).toContain('\\"ok\\": true');
  });
});

describe("OpenSend MCP HTTP auth and transport", () => {
  it("requires Bearer authorization for /mcp", async () => {
    expect(authenticateBearerHeader(null)).toEqual({
      ok: false,
      code: "missing_api_key",
      message:
        "Missing API key. Provide an Authorization: Bearer <api_key> header.",
    });
    expect(authenticateBearerHeader("Basic abc")).toEqual({
      ok: false,
      code: "malformed_api_key",
      message:
        "Malformed API key. Use the Authorization: Bearer <api_key> header format.",
    });

    const response = await handleMcpHttpRequest(
      new Request("https://api.example/mcp", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "missing_api_key",
        message:
          "Missing API key. Provide an Authorization: Bearer <api_key> header.",
      },
    });
  });

  it("serves /mcp from the Hono control-plane app", async () => {
    const app = createApp();
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { authorization: "Bearer os_test_key" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "tools",
        method: "tools/list",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.tools[0].name).toBe("opensend_send_email");
  });
});
