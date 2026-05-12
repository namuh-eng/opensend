import type { ReactNode } from "react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { DEFAULT_BASE_URL, Opensend, Resend } from "../packages/sdk/src";
import type {
  ApiError,
  ApiResponse,
  AudienceListResponse,
  AudienceResponse,
  BatchEmailResponse,
  BroadcastListResponse,
  BroadcastResponse,
  CancelEmailResponse,
  ContactListResponse,
  ContactResponse,
  CreateBroadcastPayload,
  CreateTemplatePayload,
  DeleteAudienceResponse,
  DeleteBroadcastResponse,
  DeleteContactResponse,
  DeleteTemplateResponse,
  EmailOptions,
  EmailResponse,
  RequestOptions,
  SDKOptions,
  SegmentContactListResponse,
  SegmentListResponse,
  SegmentResponse,
  SendBroadcastPayload,
  SendEmailPayload,
  TemplateListResponse,
  TemplateResponse,
  UpdateBroadcastPayload,
  UpdateTemplatePayload,
} from "../packages/sdk/src";

describe("Opensend SDK", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock("react-dom/server");
  });

  it("constructs Resend and Opensend clients with the hosted default baseUrl", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_default" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const resend = new Resend("os_test");
    const opensend = new Opensend("os_test");

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
    expect(() => new Resend("os_test", { baseUrl: "" })).toThrow(
      "baseUrl must be a non-empty string when provided",
    );
    expect(
      () => new Resend("os_test", { baseUrl: "ftp://example.com" }),
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

    const client = new Opensend("os_test", {
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
          Authorization: "Bearer os_test",
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

    const client = new Opensend("os_test", {
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

  it("serializes Resend replyTo arrays to REST reply_to for single sends", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_reply_to" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Resend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      replyTo: ["support@example.com", "billing@example.com"],
    });

    const sendCallOptions = fetchMock.mock.calls[0]?.[1];
    const outgoingBody = JSON.parse(String(sendCallOptions?.body)) as Record<
      string,
      unknown
    >;

    expect(outgoingBody).toMatchObject({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      reply_to: ["support@example.com", "billing@example.com"],
    });
    expect(outgoingBody).not.toHaveProperty("replyTo");
  });

  it("keeps snake_case reply_to precedence over the replyTo send alias", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_reply_to_precedence" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      reply_to: ["snake@example.com"],
      replyTo: ["camel@example.com"],
    });

    const sendCallOptions = fetchMock.mock.calls[0]?.[1];
    const outgoingBody = JSON.parse(String(sendCallOptions?.body)) as Record<
      string,
      unknown
    >;

    expect(outgoingBody.reply_to).toEqual(["snake@example.com"]);
    expect(outgoingBody).not.toHaveProperty("replyTo");
  });

  it("builds Resend-compatible root segments API requests", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ object: "segment", id: "seg_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Resend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.segments.create({ name: "Registered Users" });
    await client.segments.list({ limit: 10, after: "seg_1", search: "vip" });
    await client.segments.get("seg_123");
    await client.segments.delete("seg_123");
    await client.segments.listContacts("seg_123", { limit: 5, after: "c_1" });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/segments",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/segments?limit=10&after=seg_1&search=vip",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/segments/seg_123",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/segments/seg_123",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.example.com/segments/seg_123/contacts?limit=5&after=c_1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uses Resend-compatible root API key management endpoints", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "key_123", token: "re_test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Resend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.apiKeys.create({
      name: "Production",
      permission: "full_access",
    });
    await client.apiKeys.list();
    await client.apiKeys.delete("key_123");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/api-keys",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/api-keys",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/api-keys/key_123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("keeps SDK public type exports available from the entrypoint", () => {
    expectTypeOf<SDKOptions>().toMatchTypeOf<{ baseUrl?: string }>();
    expectTypeOf<RequestOptions>().toMatchTypeOf<{ idempotencyKey?: string }>();
    expectTypeOf<SendEmailPayload>().toMatchTypeOf<
      EmailOptions & { react?: ReactNode; replyTo?: string | string[] }
    >();
    expectTypeOf<ApiResponse<EmailResponse>>().toEqualTypeOf<{
      data: EmailResponse | null;
      error: ApiError | null;
    }>();
    expectTypeOf<ApiResponse<CancelEmailResponse>>().toEqualTypeOf<{
      data: CancelEmailResponse | null;
      error: ApiError | null;
    }>();
    expectTypeOf<BatchEmailResponse>().toMatchTypeOf<{ data: unknown[] }>();
    expectTypeOf<AudienceListResponse>().toMatchTypeOf<{
      object: "list";
      data: Array<{
        id: string;
        name: string;
        created_at: string;
      }>;
      has_more: boolean;
    }>();
    expectTypeOf<AudienceResponse>().toMatchTypeOf<{
      object: "audience";
      id: string;
      name: string;
    }>();
    expectTypeOf<DeleteAudienceResponse>().toMatchTypeOf<{
      object: "audience";
      deleted: true;
    }>();
    expectTypeOf<SegmentResponse>().toMatchTypeOf<{
      object: "segment";
      id: string;
      name: string;
    }>();
    expectTypeOf<SegmentListResponse>().toMatchTypeOf<{
      object: "list";
      data: Array<{ id: string; name: string; created_at: string }>;
      has_more: boolean;
    }>();
    expectTypeOf<SegmentContactListResponse>().toMatchTypeOf<{
      object: "list";
      data: Array<{ email: string; status: "subscribed" | "unsubscribed" }>;
      has_more: boolean;
    }>();
    expectTypeOf<CreateBroadcastPayload>().toMatchTypeOf<{
      from: string;
      subject: string;
      segmentId?: string;
      scheduledAt?: string;
    }>();
    expectTypeOf<UpdateBroadcastPayload>().toMatchTypeOf<{
      previewText?: string;
      replyTo?: string;
    }>();
    expectTypeOf<SendBroadcastPayload>().toMatchTypeOf<{
      scheduledAt?: string;
    }>();
    expectTypeOf<BroadcastListResponse>().toMatchTypeOf<{
      object: "list";
      data: Array<{ id: string; scheduled_at: string | null }>;
      has_more: boolean;
    }>();
    expectTypeOf<BroadcastResponse>().toMatchTypeOf<{
      object: "broadcast";
      id: string;
      reply_to?: string | null;
    }>();
    expectTypeOf<DeleteBroadcastResponse>().toMatchTypeOf<{
      object: "broadcast";
      deleted: true;
    }>();
    expectTypeOf<CreateTemplatePayload>().toMatchTypeOf<{
      name: string;
      html?: string;
      replyTo?: string | string[] | null;
    }>();
    expectTypeOf<UpdateTemplatePayload>().toMatchTypeOf<{
      subject?: string | null;
      status?: "draft" | "published";
    }>();
    expectTypeOf<TemplateListResponse>().toMatchTypeOf<{
      object: "list";
      data: Array<{ object: "template"; id: string; alias: string | null }>;
      has_more: boolean;
    }>();
    expectTypeOf<TemplateResponse>().toMatchTypeOf<{
      object: "template";
      id: string;
      reply_to?: string | string[] | null;
    }>();
    expectTypeOf<DeleteTemplateResponse>().toMatchTypeOf<{
      object: "template";
      id: string;
      deleted: true;
    }>();
    expectTypeOf<ContactListResponse>().toMatchTypeOf<{
      object: "list";
      data: Array<{
        email: string;
        first_name: string | null;
        last_name: string | null;
        unsubscribed: boolean;
      }>;
    }>();
    expectTypeOf<ContactResponse>().toMatchTypeOf<{ object: "contact" }>();
    expectTypeOf<DeleteContactResponse>().toMatchTypeOf<{
      object: "contact";
      deleted: true;
    }>();
  });

  it("renders react payloads to html before sending", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: "email_456" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
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
    const outgoingBody = JSON.parse(String(options?.body)) as Record<
      string,
      unknown
    >;
    expect(outgoingBody).toMatchObject({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      html: "<strong>Hello</strong>",
    });
    expect(outgoingBody).not.toHaveProperty("react");
  });

  it("returns a clear SDK error when the React renderer cannot load", async () => {
    vi.resetModules();
    vi.doMock("react-dom/server", () => ({
      renderToStaticMarkup: "missing renderer",
    }));

    const { Opensend: MockedOpensend } = await import("../packages/sdk/src");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const client = new MockedOpensend("os_test", {
      baseUrl: "https://api.example.com",
    });

    const response = await client.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      react: <strong>Hello</strong>,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response).toEqual({
      data: null,
      error: {
        name: "react_render_error",
        code: "react_render_error",
        statusCode: 500,
        message:
          "Unable to render React email in the OpenSend SDK. Install react and react-dom in your application, then pass a renderable React element to emails.send({ react }).",
        details: {
          cause:
            "react-dom/server is unavailable: renderToStaticMarkup export was not found.",
        },
      },
    });

    vi.doUnmock("react-dom/server");
    vi.resetModules();
  });

  it("returns a clear SDK error when React rendering throws", async () => {
    function BrokenEmail(): ReactNode {
      throw new Error("template exploded");
    }

    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });

    const response = await client.emails.send({
      from: "hello@example.com",
      to: "user@example.com",
      subject: "Hello",
      react: <BrokenEmail />,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.error).toMatchObject({
      name: "react_render_error",
      code: "react_render_error",
      statusCode: 500,
      message:
        "Unable to render React email in the OpenSend SDK. Install react and react-dom in your application, then pass a renderable React element to emails.send({ react }).",
      details: { cause: "template exploded" },
    });
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

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.emails.list({ status: "queued", limit: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/emails?limit=10&status=queued",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("fetches email details from the public detail endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          object: "email",
          id: "email_123",
          from: "sender@example.com",
          to: ["user@example.com"],
          subject: "Hello",
          html: "<p>Hello</p>",
          text: null,
          cc: null,
          bcc: null,
          reply_to: null,
          last_event: "delivered",
          provider_retry_count: 0,
          provider_last_attempted_at: null,
          provider_next_retry_at: null,
          provider_last_error: null,
          provider_dead_lettered_at: null,
          scheduled_at: null,
          sent_at: "2026-01-01T00:00:05.000Z",
          tags: null,
          created_at: "2026-01-01T00:00:00.000Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });

    const response = await client.emails.get("email_123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/emails/email_123",
      expect.objectContaining({ method: "GET" }),
    );
    expect(response.data).toMatchObject({
      object: "email",
      id: "email_123",
      last_event: "delivered",
    });
  });

  it("cancels scheduled emails through the Resend-compatible root endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ object: "email", id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Resend("os_test", {
      baseUrl: "https://api.example.com",
    });

    const response = await client.emails.cancel("email_123");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/emails/email_123/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(response).toEqual({
      data: { object: "email", id: "email_123" },
      error: null,
    });
  });

  it("uses Resend-compatible root contacts endpoints for CRUD", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ object: "contact", id: "contact_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.contacts.create({ email: "user@example.com" });
    await client.contacts.list();
    await client.contacts.get("user@example.com");
    await client.contacts.update("user@example.com", { unsubscribed: true });
    await client.contacts.delete("user@example.com");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/contacts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/contacts",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/contacts/user@example.com",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/contacts/user@example.com",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.example.com/contacts/user@example.com",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("uses Resend-compatible root audiences endpoints for CRUD", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ object: "audience", id: "aud_123", name: "VIP" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });
    const resend = new Resend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.audiences.create({ name: "Registered Users" });
    await client.audiences.list({ limit: 10, after: "aud_100", search: "vip" });
    await resend.audiences.get("aud_123");
    await resend.audiences.delete("aud_123");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/audiences",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/audiences?limit=10&after=aud_100&search=vip",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/audiences/aud_123",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/audiences/aud_123",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("builds Resend-compatible root templates API requests and maps camelCase payload aliases", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ object: "template", id: "tmpl_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });
    const resend = new Resend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.templates.create({
      name: "Receipt",
      alias: "receipt",
      from: "Acme <billing@example.com>",
      subject: "Your receipt",
      html: "<p>Hello</p>",
      text: "Hello",
      replyTo: "reply@example.com",
      previewText: "Receipt preview",
      variables: [{ key: "name", type: "string", fallbackValue: "friend" }],
    });
    await client.templates.list({
      limit: 10,
      after: "tmpl_100",
      search: "receipt",
      status: "draft",
    });
    await resend.templates.get("receipt");
    await resend.templates.update("receipt", {
      replyTo: "support@example.com",
      previewText: "Updated preview",
      subject: "Updated",
    });
    await resend.templates.publish("receipt");
    await resend.templates.duplicate("receipt");
    await resend.templates.delete("receipt");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/templates",
      expect.objectContaining({ method: "POST" }),
    );
    const createCallOptions = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(createCallOptions?.body))).toEqual({
      name: "Receipt",
      alias: "receipt",
      from: "Acme <billing@example.com>",
      subject: "Your receipt",
      html: "<p>Hello</p>",
      text: "Hello",
      reply_to: "reply@example.com",
      preview_text: "Receipt preview",
      variables: [{ key: "name", type: "string", fallbackValue: "friend" }],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/templates?limit=10&after=tmpl_100&search=receipt&status=draft",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/templates/receipt",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/templates/receipt",
      expect.objectContaining({ method: "PATCH" }),
    );
    const updateCallOptions = fetchMock.mock.calls[3]?.[1];
    expect(JSON.parse(String(updateCallOptions?.body))).toEqual({
      reply_to: "support@example.com",
      preview_text: "Updated preview",
      subject: "Updated",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.example.com/templates/receipt/publish",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.example.com/templates/receipt/duplicate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "https://api.example.com/templates/receipt",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("uses Resend-compatible root broadcasts endpoints and maps camelCase payload aliases", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ object: "broadcast", id: "broadcast_123" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const client = new Opensend("os_test", {
      baseUrl: "https://api.example.com",
    });
    const resend = new Resend("os_test", {
      baseUrl: "https://api.example.com",
    });

    await client.broadcasts.create(
      {
        name: "Newsletter",
        from: "Acme <news@example.com>",
        subject: "Updates",
        html: "<p>Hello</p>",
        segmentId: "seg_123",
        topicId: "topic_123",
        replyTo: "reply@example.com",
        previewText: "Preview",
        scheduledAt: "in 1 min",
        send: true,
      },
      { idempotencyKey: "broadcast-create-key" },
    );
    await client.broadcasts.list({
      limit: 10,
      after: "broadcast_100",
      search: "news",
      status: "draft",
      segmentId: "seg_123",
    });
    await resend.broadcasts.get("broadcast_123");
    await resend.broadcasts.update("broadcast_123", {
      previewText: "Updated preview",
      replyTo: "support@example.com",
      scheduledAt: "2026-06-01T00:00:00.000Z",
    });
    await resend.broadcasts.delete("broadcast_123");
    await resend.broadcasts.send(
      "broadcast_123",
      { scheduledAt: "in 1 min" },
      { idempotencyKey: "broadcast-send-key" },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.example.com/broadcasts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "broadcast-create-key",
        }),
      }),
    );
    const createCallOptions = fetchMock.mock.calls[0]?.[1];
    expect(JSON.parse(String(createCallOptions?.body))).toEqual({
      name: "Newsletter",
      from: "Acme <news@example.com>",
      subject: "Updates",
      html: "<p>Hello</p>",
      send: true,
      segment_id: "seg_123",
      topic_id: "topic_123",
      reply_to: "reply@example.com",
      preview_text: "Preview",
      scheduled_at: "in 1 min",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.example.com/broadcasts?limit=10&after=broadcast_100&search=news&status=draft&segmentId=seg_123",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.example.com/broadcasts/broadcast_123",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/broadcasts/broadcast_123",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
    const updateCallOptions = fetchMock.mock.calls[3]?.[1];
    expect(JSON.parse(String(updateCallOptions?.body))).toEqual({
      preview_text: "Updated preview",
      reply_to: "support@example.com",
      scheduled_at: "2026-06-01T00:00:00.000Z",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.example.com/broadcasts/broadcast_123",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      "https://api.example.com/broadcasts/broadcast_123/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "broadcast-send-key",
        }),
        body: JSON.stringify({ scheduled_at: "in 1 min" }),
      }),
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

    const client = new Opensend("os_test", {
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

    const client = new Opensend("os_test", {
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

    const client = new Opensend("os_test", {
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

    const client = new Opensend("os_test", {
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
    await client.automations.cancelRun("auto_1", "run_1", {
      reason: "operator stop",
    });
    await client.automations.getRunMetrics("auto_1", {
      from: "2026-05-02T00:00:00.000Z",
      to: "2026-05-03T00:00:00.000Z",
    });
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
      "https://api.example.com/api/automations/auto_1/runs/run_1/cancel",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://api.example.com/api/automations/auto_1/runs/metrics?from=2026-05-02T00%3A00%3A00.000Z&to=2026-05-03T00%3A00%3A00.000Z",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "https://api.example.com/api/events/send",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
