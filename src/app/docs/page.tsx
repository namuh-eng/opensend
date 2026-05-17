"use client";

import { useMemo, useState } from "react";

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Language = "node" | "curl";

type Endpoint = {
  method: Method;
  path: string;
  title: string;
  description: string;
  notes?: string[];
  code: Record<Language, string>;
};

type ApiSection = {
  id: string;
  label: string;
  description: string;
  endpoints: Endpoint[];
};

type GuideCard = {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
};

const BASE_URL = "https://api.opensend.com";
const DOCS_COUNT = 157;

const OPENSEND_GUIDES: GuideCard[] = [
  {
    eyebrow: "REST basics",
    title: "Authentication, base URL, and response codes",
    description:
      "Use os_ API keys with Bearer auth. Dashboard sessions are separate from API authentication.",
    href: "#platform",
  },
  {
    eyebrow: "Sending",
    title: "Send Email request model",
    description:
      "Send HTML or text email, schedule delivery, attach metadata, and protect retries with idempotency keys.",
    href: "#emails",
  },
  {
    eyebrow: "SDK",
    title: "TypeScript SDK quickstart",
    description:
      "Install the opensend package, initialize the client, and send email from your application code.",
    href: "#quickstart",
  },
  {
    eyebrow: "AI clients",
    title: "LLM and MCP integration",
    description:
      "Use llms.txt, OpenAPI, and the MCP server to give agents a stable OpenSend control surface.",
    href: "#llms",
  },
];

const QUICKSTART_NODE = `import { Resend } from "opensend";

const resend = new Resend(process.env.OPENSEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: ["user@example.com"],
  subject: "Hello from OpenSend",
  html: "<strong>It works.</strong>",
});

if (error) throw error;
console.log(data); // { id: "..." }`;

const QUICKSTART_CURL = `curl -X POST ${BASE_URL}/emails \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: welcome-user-123" \\
  -d '{
    "from": "OpenSend <onboarding@updates.example.com>",
    "to": ["user@example.com"],
    "subject": "Hello from OpenSend",
    "html": "<strong>It works.</strong>"
  }'`;

const MCP_EXAMPLE = `{
  "mcpServers": {
    "opensend": {
      "command": "bun",
      "args": ["/path/to/opensend/packages/mcp/src/stdio.ts"],
      "env": {
        "OPENSEND_API_KEY": "os_YOUR_API_KEY",
        "OPENSEND_API_BASE_URL": "https://api.opensend.com"
      }
    }
  }
}`;

const API_SECTIONS: ApiSection[] = [
  {
    id: "emails",
    label: "Emails",
    description: "Send, batch, cancel, and inspect delivery state.",
    endpoints: [
      {
        method: "POST",
        path: "/emails",
        title: "Send an email",
        description:
          "Accepts the Resend-compatible send body. Duplicate Idempotency-Key retries within 24 hours replay the original accepted id.",
        notes: ["Requires a verified sending domain for production traffic."],
        code: {
          node: `await resend.emails.send({
  from: "Acme <onboarding@example.com>",
  to: ["user@example.com"],
  subject: "Welcome",
  html: "<p>Hello world</p>",
});`,
          curl: `curl -X POST ${BASE_URL}/emails \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: welcome-user-123" \\
  -d '{ "from": "Acme <onboarding@example.com>", "to": ["user@example.com"], "subject": "Welcome", "html": "<p>Hello world</p>" }'`,
        },
      },
      {
        method: "POST",
        path: "/emails/batch",
        title: "Send a batch",
        description:
          "Queue multiple messages in one request. The batch idempotency key protects the whole accepted envelope.",
        code: {
          node: `await resend.emails.sendBatch([
  {
    from: "Acme <news@example.com>",
    to: ["a@example.com"],
    subject: "For A",
    html: "<p>A</p>",
  },
  {
    from: "Acme <news@example.com>",
    to: ["b@example.com"],
    subject: "For B",
    html: "<p>B</p>",
  },
]);`,
          curl: `curl -X POST ${BASE_URL}/emails/batch \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: batch-campaign-123" \\
  -d '[{"from":"Acme <news@example.com>","to":["a@example.com"],"subject":"For A","html":"<p>A</p>"}]'`,
        },
      },
      {
        method: "POST",
        path: "/emails/:email_id/cancel",
        title: "Cancel scheduled email",
        description: "Cancel a scheduled message before it leaves the queue.",
        code: {
          node: `await resend.emails.cancel("email_id");`,
          curl: `curl -X POST ${BASE_URL}/emails/email_id/cancel \\
  -H "Authorization: Bearer os_YOUR_API_KEY"`,
        },
      },
      {
        method: "GET",
        path: "/api/emails/:id",
        title: "Retrieve email details",
        description:
          "OpenSend dashboard/API detail route for status, metadata, and lifecycle events.",
        code: {
          node: `const email = await client.emails.get("email_id");`,
          curl: `curl ${BASE_URL}/api/emails/email_id \\
  -H "Authorization: Bearer os_YOUR_API_KEY"`,
        },
      },
    ],
  },
  {
    id: "domains",
    label: "Domains",
    description:
      "Add sender domains and verify DKIM, SPF, DMARC, and tracking DNS.",
    endpoints: [
      {
        method: "POST",
        path: "/api/domains",
        title: "Create domain",
        description:
          "Add a domain and receive the DNS records required for SES-backed sending.",
        code: {
          node: `await client.domains.create({ name: "updates.example.com" });`,
          curl: `curl -X POST ${BASE_URL}/api/domains \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "updates.example.com" }'`,
        },
      },
      {
        method: "POST",
        path: "/api/domains/:id/auto-configure",
        title: "Auto-configure DNS",
        description:
          "Operator/self-host Cloudflare token flow for writing the generated records automatically.",
        code: {
          node: `await fetch("https://api.opensend.com/api/domains/domain_id/auto-configure", {
  method: "POST",
  headers: { Authorization: "Bearer " + apiKey },
});`,
          curl: `curl -X POST ${BASE_URL}/api/domains/domain_id/auto-configure \\
  -H "Authorization: Bearer os_YOUR_API_KEY"`,
        },
      },
      {
        method: "GET",
        path: "/api/domains/:id",
        title: "Retrieve domain",
        description: "Inspect verification status and copy DNS records.",
        code: {
          node: `const domain = await client.domains.get("domain_id");`,
          curl: `curl ${BASE_URL}/api/domains/domain_id \\
  -H "Authorization: Bearer os_YOUR_API_KEY"`,
        },
      },
    ],
  },
  {
    id: "audience",
    label: "Audience",
    description: "Contacts, segments, topics, and contact properties.",
    endpoints: [
      {
        method: "POST",
        path: "/contacts",
        title: "Create contact",
        description:
          "Create a contact through the Resend-compatible root alias.",
        code: {
          node: `await client.contacts.create({
  email: "jane@example.com",
  firstName: "Jane",
});`,
          curl: `curl -X POST ${BASE_URL}/contacts \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "email": "jane@example.com", "first_name": "Jane" }'`,
        },
      },
      {
        method: "POST",
        path: "/segments",
        title: "Create segment",
        description:
          "Create a named audience segment for filtering contacts and campaigns.",
        code: {
          node: `await client.segments.create({ name: "Active users" });`,
          curl: `curl -X POST ${BASE_URL}/segments \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Active users" }'`,
        },
      },
      {
        method: "GET",
        path: "/segments/:id/contacts",
        title: "List segment contacts",
        description: "Fetch contacts that currently match a segment.",
        code: {
          node: `const contacts = await client.segments.listContacts("segment_id");`,
          curl: `curl ${BASE_URL}/segments/segment_id/contacts \\
  -H "Authorization: Bearer os_YOUR_API_KEY"`,
        },
      },
    ],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    description: "Broadcasts and reusable templates for one-to-many sends.",
    endpoints: [
      {
        method: "POST",
        path: "/broadcasts",
        title: "Create broadcast",
        description:
          "Create a draft broadcast with sender, subject, segment, and preview text.",
        code: {
          node: `await client.broadcasts.create({
  name: "March newsletter",
  from: "Acme <news@example.com>",
  subject: "March updates",
  segmentId: "segment_id",
});`,
          curl: `curl -X POST ${BASE_URL}/broadcasts \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "March newsletter", "from": "Acme <news@example.com>", "subject": "March updates", "segment_id": "segment_id" }'`,
        },
      },
      {
        method: "POST",
        path: "/broadcasts/:id/send",
        title: "Send broadcast",
        description:
          "Send immediately or schedule with the same narrow natural-language window as email sends.",
        code: {
          node: `await client.broadcasts.send("broadcast_id", {
  scheduledAt: "in 1 hour",
});`,
          curl: `curl -X POST ${BASE_URL}/broadcasts/broadcast_id/send \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "scheduled_at": "in 1 hour" }'`,
        },
      },
      {
        method: "POST",
        path: "/templates",
        title: "Create template",
        description:
          "Store versioned HTML templates that can be rendered for future sends.",
        code: {
          node: `await client.templates.create({
  name: "Welcome",
  alias: "welcome",
  subject: "Welcome",
  html: "<p>Hi {{name}}</p>",
});`,
          curl: `curl -X POST ${BASE_URL}/templates \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Welcome", "alias": "welcome", "subject": "Welcome", "html": "<p>Hi {{name}}</p>" }'`,
        },
      },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    description: "API keys, webhooks, OpenAPI, and MCP integrations.",
    endpoints: [
      {
        method: "POST",
        path: "/api-keys",
        title: "Create API key",
        description:
          "Create scoped keys. OpenSend keys use the os_ prefix while preserving Resend-compatible API semantics.",
        code: {
          node: `await client.apiKeys.create({ name: "Production" });`,
          curl: `curl -X POST ${BASE_URL}/api-keys \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Production" }'`,
        },
      },
      {
        method: "POST",
        path: "/api/webhooks",
        title: "Create webhook",
        description:
          "Subscribe an HTTPS endpoint to signed delivery and lifecycle events.",
        code: {
          node: `await fetch("https://api.opensend.com/api/webhooks", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    endpoint: "https://example.com/webhooks/opensend",
    events: ["email.delivered"],
  }),
});`,
          curl: `curl -X POST ${BASE_URL}/api/webhooks \\
  -H "Authorization: Bearer os_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "endpoint": "https://example.com/webhooks/opensend", "events": ["email.delivered"] }'`,
        },
      },
      {
        method: "GET",
        path: "/openapi.json",
        title: "OpenAPI document",
        description:
          "Unauthenticated OpenAPI 3.0 contract for SDKs, generated clients, and audits.",
        code: {
          node: `const spec = await fetch("${BASE_URL}/openapi.json").then((res) => res.json());`,
          curl: `curl ${BASE_URL}/openapi.json`,
        },
      },
    ],
  },
];

const METHOD_STYLES: Record<Method, string> = {
  GET: "border-blue/30 bg-blue/10 text-blue",
  POST: "border-accent/30 bg-accent-soft text-accent",
  PATCH: "border-amber/30 bg-amber/10 text-amber",
  DELETE: "border-red/30 bg-red/10 text-red",
};

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

function CodeBlock({ value }: { value: string }) {
  return (
    <div className="group relative overflow-hidden rounded-card border border-line bg-[#08080a]">
      <button
        type="button"
        onClick={() => copyText(value)}
        className="mono absolute right-2 top-2 z-10 rounded-md border border-line-2 bg-white/[0.04] px-2 py-1 text-[10.5px] text-fg-3 opacity-0 transition group-hover:opacity-100 hover:text-fg"
      >
        copy
      </button>
      <pre className="mono overflow-x-auto p-4 pr-14 text-[12px] leading-6 text-fg-2">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: Method }) {
  return (
    <span
      className={`mono inline-flex h-6 min-w-14 items-center justify-center rounded-md border px-2 text-[10.5px] font-semibold ${METHOD_STYLES[method]}`}
    >
      {method}
    </span>
  );
}

function EndpointCard({
  endpoint,
  language,
}: { endpoint: Endpoint; language: Language }) {
  return (
    <article className="rounded-card border border-line bg-bg-card p-4 shadow-[0_18px_70px_-55px_rgba(196,255,90,0.55)] transition hover:border-line-2">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={endpoint.method} />
            <code className="mono rounded-md bg-white/[0.03] px-2 py-1 text-[13px] text-fg">
              {endpoint.path}
            </code>
          </div>
          <h3 className="mt-3 text-[17px] font-medium tracking-tight text-fg">
            {endpoint.title}
          </h3>
          <p className="mt-1 max-w-2xl text-[13px] leading-6 text-fg-2">
            {endpoint.description}
          </p>
          {endpoint.notes && endpoint.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-[12px] leading-5 text-fg-3">
              {endpoint.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="text-accent">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mt-4">
        <CodeBlock value={endpoint.code[language]} />
      </div>
    </article>
  );
}

function Sidebar({ sections }: { sections: ApiSection[] }) {
  return (
    <aside className="hidden 2xl:block">
      <div className="sticky top-8 rounded-card border border-line bg-white/[0.02] p-3 backdrop-blur">
        <p className="kicker px-2 py-2">On this page</p>
        <nav className="space-y-1">
          {[
            "start",
            "guides",
            ...sections.map((section) => section.id),
            "llms",
          ].map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className="block rounded-md px-2 py-1.5 text-[12.5px] capitalize text-fg-3 transition hover:bg-white/[0.04] hover:text-fg"
            >
              {id === "llms" ? "LLMs" : id}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export default function DocsPage() {
  const [language, setLanguage] = useState<Language>("node");
  const highlightedEndpointCount = useMemo(
    () =>
      API_SECTIONS.reduce((sum, section) => sum + section.endpoints.length, 0),
    [],
  );
  const quickstart = language === "node" ? QUICKSTART_NODE : QUICKSTART_CURL;

  return (
    <main className="landing-root min-h-screen">
      <div className="grain" aria-hidden />
      <div className="ambient" aria-hidden />
      <div className="landing-content">
        <header className="border-b border-line bg-bg/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between px-6 lg:px-8">
            <a
              href="/"
              className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-fg"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
                O
              </span>
              OpenSend Docs
            </a>
            <nav className="hidden items-center gap-5 text-[13px] text-fg-3 md:flex">
              <a className="transition hover:text-fg" href="/openapi.json">
                OpenAPI
              </a>
              <a className="transition hover:text-fg" href="/docs/llms.txt">
                llms.txt
              </a>
              <a className="transition hover:text-fg" href="/auth">
                Dashboard
              </a>
            </nav>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-[1500px] gap-8 px-6 py-10 lg:px-8 2xl:grid-cols-[220px_minmax(0,1fr)_260px]">
          <Sidebar sections={API_SECTIONS} />

          <div className="min-w-0 space-y-12">
            <section
              id="start"
              className="overflow-hidden rounded-[24px] border border-line bg-bg-card shadow-[0_40px_120px_-80px_rgba(196,255,90,0.9)]"
            >
              <div className="grid gap-0">
                <div className="p-6 sm:p-8 lg:p-10">
                  <div className="pill success">
                    <span className="dot" /> Resend-compatible · self-hosted on
                    AWS SES
                  </div>
                  <h1 className="mt-6 text-[42px] font-medium leading-[0.96] tracking-[-0.04em] text-fg sm:text-[56px]">
                    Email API docs that agents and humans can actually use.
                  </h1>
                  <p className="mt-5 max-w-xl text-[16px] leading-7 text-fg-2">
                    OpenSend keeps the familiar Resend API shape, swaps in{" "}
                    <code className="mono text-fg">os_</code> keys, and runs on
                    your own infrastructure. Start with the send path, then
                    expand into domains, audience, broadcasts, webhooks,
                    OpenAPI, and MCP.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a className="btn btn-primary" href="#quickstart">
                      Send your first email
                    </a>
                    <a className="btn btn-ghost" href="/openapi.json">
                      View OpenAPI
                    </a>
                  </div>
                </div>
                <div
                  id="quickstart"
                  className="border-t border-line bg-[#08080a] p-4 sm:p-5"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="kicker">Quickstart</p>
                      <p className="mt-1 text-[13px] text-fg-3">
                        Base URL:{" "}
                        <code className="mono text-fg">{BASE_URL}</code>
                      </p>
                    </div>
                    <div className="inline-flex rounded-md border border-line bg-white/[0.03] p-1">
                      {(["node", "curl"] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setLanguage(tab)}
                          className={`mono rounded px-2.5 py-1 text-[11px] transition ${language === tab ? "bg-accent text-accent-ink" : "text-fg-3 hover:text-fg"}`}
                        >
                          {tab === "node" ? "Node.js" : "cURL"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <CodeBlock value={quickstart} />
                  <p className="mt-3 text-[12px] leading-5 text-fg-3">
                    For production, verify a sending domain first. Use a real
                    recipient only after your domain records are healthy.
                  </p>
                </div>
              </div>
            </section>

            <section id="guides" className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="kicker">OpenSend guides</p>
                  <h2 className="title-m mt-2">
                    Everything you need to integrate OpenSend
                  </h2>
                </div>
                <a className="btn btn-ghost btn-sm" href="/docs/llms.txt">
                  OpenSend llms.txt
                </a>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {OPENSEND_GUIDES.map((reference) => (
                  <a
                    key={reference.href}
                    href={reference.href}
                    className="rounded-card border border-line bg-white/[0.02] p-4 transition hover:border-line-2 hover:bg-white/[0.04]"
                  >
                    <p className="kicker">{reference.eyebrow}</p>
                    <h3 className="mt-2 text-[15px] font-medium text-fg">
                      {reference.title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-6 text-fg-2">
                      {reference.description}
                    </p>
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-card border border-line bg-white/[0.02] p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="mono text-[28px] text-accent">{DOCS_COUNT}</p>
                  <p className="text-[12px] text-fg-3">markdown docs</p>
                </div>
                <div>
                  <p className="mono text-[28px] text-blue">OpenAPI 3.0</p>
                  <p className="text-[12px] text-fg-3">
                    machine-readable contract
                  </p>
                </div>
                <div>
                  <p className="mono text-[28px] text-violet">
                    {highlightedEndpointCount}
                  </p>
                  <p className="text-[12px] text-fg-3">
                    highlighted API examples
                  </p>
                </div>
              </div>
            </section>

            {API_SECTIONS.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-8 space-y-4"
              >
                <div>
                  <p className="kicker">{section.label}</p>
                  <h2 className="title-m mt-2">{section.description}</h2>
                </div>
                <div className="space-y-3">
                  {section.endpoints.map((endpoint) => (
                    <EndpointCard
                      key={`${endpoint.method}-${endpoint.path}`}
                      endpoint={endpoint}
                      language={language}
                    />
                  ))}
                </div>
              </section>
            ))}

            <section
              id="llms"
              className="rounded-[20px] border border-accent/20 bg-accent-soft p-5 sm:p-6"
            >
              <p className="kicker text-accent">LLM docs</p>
              <h2 className="mt-2 text-[24px] font-medium tracking-tight text-fg">
                Give agents a small, stable map first.
              </h2>
              <p className="mt-3 max-w-2xl text-[14px] leading-7 text-fg-2">
                OpenSend exposes the canonical LLM entrypoint at{" "}
                <a
                  className="text-fg underline decoration-line-3 underline-offset-4"
                  href="/docs/llms.txt"
                >
                  /docs/llms.txt
                </a>{" "}
                so coding agents can discover the API, SDKs, MCP server,
                operational setup, and parity notes before generating
                integration code.
              </p>
              <div className="mt-5">
                <CodeBlock value={MCP_EXAMPLE} />
              </div>
            </section>
          </div>

          <aside className="hidden 2xl:block">
            <div className="sticky top-8 space-y-3">
              <div className="rounded-card border border-line bg-bg-card p-4">
                <p className="kicker">Auth</p>
                <p className="mt-2 text-[13px] leading-6 text-fg-2">
                  Use{" "}
                  <code className="mono text-fg">
                    Authorization: Bearer os_...
                  </code>
                  . Dashboard cookies are never API credentials.
                </p>
              </div>
              <div className="rounded-card border border-line bg-bg-card p-4">
                <p className="kicker">Contracts</p>
                <div className="mt-3 space-y-2 text-[13px]">
                  <a
                    className="block text-fg-2 transition hover:text-fg"
                    href="/openapi.json"
                  >
                    OpenAPI JSON
                  </a>
                  <a
                    className="block text-fg-2 transition hover:text-fg"
                    href="/docs/llms.txt"
                  >
                    Docs llms.txt
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
