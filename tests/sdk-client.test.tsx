import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { DEFAULT_BASE_URL, Opensend, Resend } from "../packages/sdk/src";
import type {
  ApiError,
  ApiResponse,
  BatchEmailResponse,
  EmailOptions,
  EmailResponse,
  RequestOptions,
  SDKOptions,
  SendEmailPayload,
} from "../packages/sdk/src";

describe("Opensend SDK", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs Resend and Opensend clients with the hosted default baseUrl", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_default" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const resend = new Resend("re_test");
    const opensend = new Opensend("re_test");

    expect(resend).toBeInstanceOf(Resend);
    expect(opensend).toBeInstanceOf(Opensend);

    await resend.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_BASE_URL}/emails`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("validates invalid baseUrl overrides", () => {
    expect(() => new Resend("re_test", { baseUrl: "" })).toThrow(
      "baseUrl must be a non-empty string when provided",
    );
    expect(
      () => new Resend("re_test", { baseUrl: "ftp://example.com" }),
    ).toThrow("baseUrl must use http or https");
  });

  it("normalizes the baseUrl and sends requests to the Resend-compatible root email API", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com/",
    });

    const response = await client.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
        }),
      }),
    );
    expect(response).toEqual({
      data: { id: "email_123" },
      error: null,
    });
  });

  it("forwards Idempotency-Key for single and batch send request options", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_789" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com",
    });
    const payload = {
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    };

    await client.emails.send(payload, { idempotencyKey: "send-key-1" });
    await client.emails.sendBatch([payload], { idempotencyKey: "batch-key-1" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "send-key-1",
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/emails/batch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "batch-key-1",
        }),
      }),
    );
  });

  it("keeps SDK public type exports available from the entrypoint", () => {
    expectTypeOf<SDKOptions>().toMatchTypeOf<{ baseUrl?: string }>();
    expectTypeOf<RequestOptions>().toMatchTypeOf<{ idempotencyKey?: string }>();
    expectTypeOf<SendEmailPayload>().toMatchTypeOf<
      EmailOptions & { react?: unknown }
    >();
    expectTypeOf<ApiResponse<EmailResponse>>().toEqualTypeOf<{
      data: EmailResponse | null;
      error: ApiError | null;
    }>();
    expectTypeOf<BatchEmailResponse>().toMatchTypeOf<{ data: unknown[] }>();
  });

  it("renders react payloads to html before sending", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_456" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com",
    });

    await client.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      react: <strong>Hello</strong>,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(options?.body).toContain("<strong>Hello</strong>");
  });

  it("passes email lifecycle status filters when listing emails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ object: "list", has_more: false, data: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com",
    });

    await client.emails.list({ status: "queued", limit: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/emails?limit=10&status=queued",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("exposes machine-readable API error fields without dropping message or status", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: "validation_error",
          code: "validation_error",
          message: "Validation failed.",
          statusCode: 422,
          details: { fieldErrors: { to: ["Required"] }, formErrors: [] },
        }),
        { status: 422, statusText: "Unprocessable Entity" },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com",
    });

    const response = await client.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(response).toEqual({
      data: null,
      error: {
        name: "validation_error",
        code: "validation_error",
        message: "Validation failed.",
        statusCode: 422,
        details: { fieldErrors: { to: ["Required"] }, formErrors: [] },
      },
    });
  });

  it("keeps legacy string error parsing for older routes", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "Missing or invalid API key" }), {
        status: 401,
        statusText: "Unauthorized",
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com",
    });

    const response = await client.emails.list();

    expect(response).toEqual({
      data: null,
      error: {
        message: "Missing or invalid API key",
        statusCode: 401,
      },
    });
  });

  it("treats empty successful responses as null data", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com",
    });

    const response = await client.apiKeys.delete("key_123");

    expect(response).toEqual({
      data: null,
      error: null,
    });
  });

  it("exposes automations and events clients", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ object: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("re_test", {
      baseUrl: "https://api.example.com",
    });

    await client.automations.create({
      name: "Welcome",
      steps: [
        {
          key: "trigger",
          type: "trigger",
          config: { event_name: "user.signed_up" },
        },
      ],
    });
    await client.automations.listRuns("auto_1", { status: "queued", limit: 5 });
    await client.events.send({
      event: "user.signed_up",
      email: "user@example.com",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/api/automations",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/api/automations/auto_1/runs?limit=5&status=queued",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/api/events/send",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
