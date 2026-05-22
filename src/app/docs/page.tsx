import { DocsShell } from "@/components/docs/docs-shell";
import { getAllDocs, getDocsNav } from "@/lib/docs";

const BASE_URL = "https://opensend.namuh.co";

const QUICKSTART_NODE = `import { Resend } from "opensend";

const resend = new Resend(process.env.OPENSEND_API_KEY);

const { data, error } = await resend.emails.send({
  from: "OpenSend <onboarding@updates.example.com>",
  to: ["user@example.com"],
  subject: "Hello from OpenSend",
  html: "<strong>It works.</strong>",
});

if (error) throw error;
console.log(data);`;

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

const STARTER_CARDS = [
  {
    eyebrow: "1 · API key",
    title: "Authenticate requests",
    description:
      "Create an os_ API key and use Bearer auth. Dashboard cookies are not API credentials.",
    href: "/docs/api-reference/authentication",
  },
  {
    eyebrow: "2 · Domain",
    title: "Verify a sending domain",
    description:
      "Add DNS records for DKIM, SPF, DMARC, bounce handling, and optional tracking.",
    href: "/docs/api-reference/domains/create-domain",
  },
  {
    eyebrow: "3 · Send",
    title: "Send your first email",
    description:
      "Use the OpenSend API or SDK to send, schedule, batch, tag, and inspect messages.",
    href: "/docs/api-reference/emails/send-email",
  },
  {
    eyebrow: "4 · Observe",
    title: "Watch logs and webhooks",
    description:
      "Track lifecycle events, signed webhook deliveries, retries, and API request logs.",
    href: "/docs/webhooks/introduction",
  },
];

const COLLECTIONS = [
  [
    "API reference",
    "/docs/api-reference/introduction",
    "Endpoint contracts, auth, pagination, errors, limits, and OpenAPI.",
  ],
  [
    "SDKs",
    "/docs/sdks",
    "TypeScript, Python, Go, Ruby, and framework-specific send examples.",
  ],
  [
    "Domains",
    "/docs/dashboard/domains/introduction",
    "DNS setup, Cloudflare automation, DMARC, tracking, and provider guidance.",
  ],
  [
    "Audience",
    "/docs/dashboard/audiences/contacts",
    "Contacts, segments, topics, properties, preferences, and suppressions.",
  ],
  [
    "Broadcasts and templates",
    "/docs/dashboard/broadcasts/introduction",
    "Campaign creation, template variables, versioning, and performance tracking.",
  ],
  [
    "Self-hosting",
    "/docs/self-hosting",
    "Docker Compose, migrations, SES/SNS ingester, security, and observability.",
  ],
] as const;

const POPULAR_ENDPOINTS = [
  ["POST", "/emails", "Send one email"],
  ["POST", "/emails/batch", "Queue a batch"],
  ["POST", "/emails/:email_id/cancel", "Cancel scheduled email"],
  ["POST", "/contacts", "Create contact"],
  ["POST", "/broadcasts/:id/send", "Send broadcast"],
  ["POST", "/api/webhooks", "Create webhook"],
] as const;

function CodePanel({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-[#08080a]">
      <div className="border-b border-line bg-white/[0.03] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-3">
        {title}
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-6 text-fg-2">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default async function DocsPage() {
  const [nav, docs] = await Promise.all([getDocsNav(), getAllDocs()]);

  return (
    <DocsShell nav={nav}>
      <div className="space-y-10">
        <section className="overflow-hidden rounded-[24px] border border-line bg-bg-card shadow-[0_40px_120px_-80px_rgba(196,255,90,0.9)]">
          <div className="grid gap-0 lg:grid-cols-[1.04fr_0.96fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="pill success">
                <span className="dot" /> First-party docs · human and LLM ready
              </div>
              <h1 className="mt-6 max-w-3xl text-[42px] font-medium leading-[0.96] tracking-[-0.04em] text-fg sm:text-[60px]">
                Email infrastructure docs without the guesswork.
              </h1>
              <p className="mt-5 max-w-2xl text-[16px] leading-7 text-fg-2">
                Start with a verified domain and one send, then expand into
                audiences, broadcasts, templates, webhooks, receiving, MCP, and
                self-hosted operations. This docs shell renders the same
                markdown corpus that powers{" "}
                <code className="mono text-fg">/docs/llms.txt</code>.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  className="btn btn-primary"
                  href="/docs/api-reference/emails/send-email"
                >
                  Send your first email
                </a>
                <a className="btn btn-ghost" href="/docs/self-hosting">
                  Self-hosting guide
                </a>
                <a className="btn btn-ghost" href="/openapi.json">
                  OpenAPI
                </a>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="rounded-card border border-line bg-white/[0.02] p-4">
                  <p className="font-mono text-[26px] text-accent">
                    {docs.length}
                  </p>
                  <p className="text-[12px] text-fg-3">markdown guides</p>
                </div>
                <div className="rounded-card border border-line bg-white/[0.02] p-4">
                  <p className="font-mono text-[26px] text-blue">OpenAPI</p>
                  <p className="text-[12px] text-fg-3">schema source</p>
                </div>
                <div className="rounded-card border border-line bg-white/[0.02] p-4">
                  <p className="font-mono text-[26px] text-violet">MCP</p>
                  <p className="text-[12px] text-fg-3">agent tooling</p>
                </div>
              </div>
            </div>
            <div
              id="quickstart"
              className="border-t border-line bg-[#08080a] p-4 sm:p-5 lg:border-l lg:border-t-0"
            >
              <p className="kicker">Quickstart</p>
              <p className="mt-2 text-[13px] leading-6 text-fg-3">
                Base URL: <code className="mono text-fg">{BASE_URL}</code>
              </p>
              <div className="mt-4 space-y-4">
                <CodePanel title="Node.js" code={QUICKSTART_NODE} />
                <CodePanel title="cURL" code={QUICKSTART_CURL} />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="kicker">Recommended path</p>
            <h2 className="title-m mt-2">Do these four things first</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {STARTER_CARDS.map((card) => (
              <a
                key={card.href}
                href={card.href}
                className="rounded-card border border-line bg-bg-card p-4 transition hover:border-line-2 hover:bg-white/[0.04]"
              >
                <p className="kicker">{card.eyebrow}</p>
                <h3 className="mt-3 text-[16px] font-medium text-fg">
                  {card.title}
                </h3>
                <p className="mt-2 text-[13px] leading-6 text-fg-2">
                  {card.description}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="kicker">Docs library</p>
              <h2 className="title-m mt-2">Browse by job to be done</h2>
            </div>
            <a className="btn btn-ghost btn-sm" href="/docs/llms.txt">
              Raw LLM index
            </a>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {COLLECTIONS.map(([title, href, description]) => (
              <a
                key={href}
                href={href}
                className="rounded-card border border-line bg-bg-card p-4 transition hover:border-line-2 hover:bg-white/[0.04]"
              >
                <h3 className="text-[15px] font-medium text-fg">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-fg-2">
                  {description}
                </p>
              </a>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[20px] border border-line bg-bg-card p-5">
            <p className="kicker">Popular endpoints</p>
            <h2 className="mt-2 text-[22px] font-medium tracking-tight text-fg">
              Common API surface
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-fg-2">
              Use the styled reference for humans and{" "}
              <a
                className="text-accent underline decoration-accent/30 underline-offset-4"
                href="/openapi.json"
              >
                OpenAPI
              </a>{" "}
              for exact schemas.
            </p>
          </div>
          <div className="rounded-[20px] border border-line bg-bg-card p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {POPULAR_ENDPOINTS.map(([method, route, label]) => (
                <div
                  key={route}
                  className="rounded-card border border-line bg-white/[0.02] p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-accent">
                      {method}
                    </span>
                    <code className="font-mono text-[12px] text-fg">
                      {route}
                    </code>
                  </div>
                  <p className="mt-2 text-[12.5px] text-fg-3">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DocsShell>
  );
}
