import { OpensendApiClient } from "./client";
import {
  type JsonObject,
  type JsonValue,
  type OpensendMcpToolName,
  listMcpTools,
} from "./schema";

export type JsonRpcId = string | number | null;

export type McpAuthResult =
  | { ok: true; apiKey: string }
  | {
      ok: false;
      code: "missing_api_key" | "malformed_api_key";
      message: string;
    };

export type McpServerOptions = {
  apiBaseUrl?: string;
  apiKey?: string;
  fetcher?: typeof fetch;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: JsonValue;
};

type JsonRpcFailure = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: JsonValue;
  };
};

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

const TOOL_NAMES = new Set<string>(listMcpTools().map((tool) => tool.name));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]),
    );
  }
  return String(value);
}

function success(id: JsonRpcId, result: JsonValue): JsonRpcSuccess {
  return { jsonrpc: "2.0", id, result };
}

function failure(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: JsonValue,
): JsonRpcFailure {
  return data === undefined
    ? { jsonrpc: "2.0", id, error: { code, message } }
    : { jsonrpc: "2.0", id, error: { code, message, data } };
}

function requestId(input: unknown): JsonRpcId {
  if (!isRecord(input)) return null;
  const id = input.id;
  return typeof id === "string" || typeof id === "number" || id === null
    ? id
    : null;
}

function parseRequest(input: unknown): JsonRpcRequest | null {
  if (!isRecord(input)) return null;
  const id = input.id;
  const method = input.method;
  if (
    id !== undefined &&
    typeof id !== "string" &&
    typeof id !== "number" &&
    id !== null
  )
    return null;
  if (typeof method !== "string") return null;
  return {
    jsonrpc: typeof input.jsonrpc === "string" ? input.jsonrpc : undefined,
    id: id as JsonRpcId | undefined,
    method,
    params: input.params,
  };
}

function paramsObject(params: unknown): JsonObject {
  return isRecord(params) ? (toJsonValue(params) as JsonObject) : {};
}

function getCallParams(
  params: unknown,
): { name: OpensendMcpToolName; arguments: JsonObject } | null {
  if (
    !isRecord(params) ||
    typeof params.name !== "string" ||
    !TOOL_NAMES.has(params.name)
  ) {
    return null;
  }
  return {
    name: params.name as OpensendMcpToolName,
    arguments: paramsObject(params.arguments),
  };
}

export function authenticateBearerHeader(
  authHeader: string | null | undefined,
): McpAuthResult {
  if (!authHeader) {
    return {
      ok: false,
      code: "missing_api_key",
      message:
        "Missing API key. Provide an Authorization: Bearer <api_key> header.",
    };
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return {
      ok: false,
      code: "malformed_api_key",
      message:
        "Malformed API key. Use the Authorization: Bearer <api_key> header format.",
    };
  }

  return { ok: true, apiKey: parts[1] };
}

export function createMcpServer(options: McpServerOptions = {}) {
  async function handleJsonRpc(
    input: unknown,
  ): Promise<JsonRpcResponse | null> {
    const id = requestId(input);
    const request = parseRequest(input);
    if (!request) return failure(id, -32600, "Invalid JSON-RPC request.");

    if (request.id === undefined) return null;

    switch (request.method) {
      case "initialize":
        return success(request.id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "opensend-mcp", version: "0.1.0" },
        });
      case "tools/list":
        return success(request.id, { tools: listMcpTools() });
      case "tools/call": {
        const call = getCallParams(request.params);
        if (!call)
          return failure(request.id, -32602, "Unknown or invalid tool call.");

        const apiKey = options.apiKey;
        if (!apiKey) {
          return failure(
            request.id,
            -32001,
            "OpenSend API key is required for tool calls.",
            {
              code: "missing_api_key",
            },
          );
        }

        try {
          const client = new OpensendApiClient({
            apiKey,
            baseUrl: options.apiBaseUrl,
            fetcher: options.fetcher,
          });
          const apiResult = await client.callTool(call.name, call.arguments);
          return success(request.id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: apiResult.status,
                    ok: apiResult.ok,
                    body: apiResult.body,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: !apiResult.ok,
          });
        } catch (error) {
          return failure(
            request.id,
            -32000,
            error instanceof Error ? error.message : "Tool execution failed.",
          );
        }
      }
      default:
        return failure(
          request.id,
          -32601,
          `Unsupported MCP method: ${request.method}`,
        );
    }
  }

  return { handleJsonRpc };
}
