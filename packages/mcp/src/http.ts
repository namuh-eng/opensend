import {
  type JsonRpcResponse,
  authenticateBearerHeader,
  createMcpServer,
} from "./protocol";

export type McpHttpOptions = {
  apiBaseUrl?: string;
  fetcher?: typeof fetch;
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(new Headers(init?.headers).entries()),
    },
  });
}

function authError(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, { status });
}

async function parseJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

export async function handleMcpHttpRequest(
  request: Request,
  options: McpHttpOptions = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        error: {
          code: "method_not_allowed",
          message: "Use POST for MCP JSON-RPC requests.",
        },
      },
      {
        status: 405,
        headers: { allow: "POST" },
      },
    );
  }

  const auth = authenticateBearerHeader(request.headers.get("authorization"));
  if (!auth.ok) return authError(401, auth.code, auth.message);

  let input: unknown;
  try {
    input = await parseJson(request);
  } catch {
    return jsonResponse(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error." },
      },
      { status: 400 },
    );
  }

  const server = createMcpServer({
    apiKey: auth.apiKey,
    apiBaseUrl: options.apiBaseUrl,
    fetcher: options.fetcher,
  });

  if (Array.isArray(input)) {
    const responses: JsonRpcResponse[] = [];
    for (const item of input) {
      const response = await server.handleJsonRpc(item);
      if (response) responses.push(response);
    }
    return jsonResponse(responses);
  }

  const response = await server.handleJsonRpc(input);
  return response
    ? jsonResponse(response)
    : new Response(null, { status: 202 });
}
