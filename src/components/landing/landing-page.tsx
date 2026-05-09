"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

const GITHUB_URL = "https://github.com/namuh-eng/opensend";
const DOCS_URL = "/docs";
const HOSTED_SIGNIN_URL = "/auth";
const SELF_HOST_URL = `${GITHUB_URL}#self-host`;

function LogoMark({
  size = 26,
  glow = true,
}: { size?: number; glow?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{
        display: "block",
        filter: glow
          ? "drop-shadow(0 0 12px color-mix(in oklch, var(--accent) 40%, transparent))"
          : "none",
      }}
      role="img"
      aria-label="opensend"
    >
      <title>opensend</title>
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.4"
        fill="var(--accent)"
      />
      <path
        d="M6 11.2 L16 17 L26 11.2"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 21.5 L21.5 21.5"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M18.2 18.5 L21.8 21.5 L18.2 24.5"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Logo({
  size = 26,
  gap = 10,
  fontSize = 15,
}: {
  size?: number;
  gap?: number;
  fontSize?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap,
        fontWeight: 500,
        fontSize,
        letterSpacing: "-0.01em",
      }}
    >
      <LogoMark size={size} />
      <span>opensend</span>
    </div>
  );
}

function LogoGlyphLarge({
  size = 280,
  color = "currentColor",
  strokeWidth = 1,
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <title>opensend mark</title>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <path
        d="M6 11.2 L16 17 L26 11.2"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 21.5 L21.5 21.5"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 1.6}
        strokeLinecap="round"
      />
      <path
        d="M18.2 18.5 L21.8 21.5 L18.2 24.5"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth * 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TopNav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgba(10,10,12,0.7)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 60,
        }}
      >
        <Link href="/" aria-label="opensend home">
          <Logo />
        </Link>
        <nav
          className="nav-links-desktop"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            fontSize: 13.5,
            color: "var(--fg-2)",
          }}
        >
          <Link href={DOCS_URL} style={{ cursor: "pointer" }}>
            Docs
          </Link>
          <Link href={`${DOCS_URL}#api`} style={{ cursor: "pointer" }}>
            API
          </Link>
          <a href={SELF_HOST_URL} rel="noreferrer noopener" target="_blank">
            Self-host
          </a>
          <Link href="/pricing" style={{ cursor: "pointer" }}>
            Pricing
          </Link>
          <a
            href={GITHUB_URL}
            rel="noreferrer noopener"
            target="_blank"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid var(--line-2)",
              background: "rgba(255,255,255,0.02)",
              fontSize: 12.5,
              color: "var(--fg-2)",
              fontFamily: "var(--landing-mono)",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <title>star</title>
              <path d="M8 12.4l-4.7 2.6 1-5.3L.6 6l5.3-.7L8 .4l2.1 4.9L15.4 6l-3.7 3.7 1 5.3z" />
            </svg>
            <span>Star</span>
            <span style={{ color: "var(--fg)", fontWeight: 500 }}>2.4k</span>
          </a>
          <Link
            href={HOSTED_SIGNIN_URL}
            data-testid="nav-sign-in"
            className="btn btn-primary"
            style={{ height: 32, fontSize: 13 }}
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

type Token = { t: "k" | "s" | "a" | "p"; s: string };

const TABS: Array<{ id: "curl" | "ts" | "react"; label: string }> = [
  { id: "curl", label: "cURL" },
  { id: "ts", label: "TypeScript" },
  { id: "react", label: "React Email" },
];

const SNIPPETS: Record<"curl" | "ts" | "react", Token[]> = {
  curl: [
    { t: "k", s: "curl" },
    { t: "p", s: " -X POST https://api.opensend.dev/emails \\" },
    { t: "p", s: "\n  -H " },
    { t: "s", s: '"Authorization: Bearer os_live_•••"' },
    { t: "p", s: " \\" },
    { t: "p", s: "\n  -H " },
    { t: "s", s: '"Idempotency-Key: 4f9d…"' },
    { t: "p", s: " \\" },
    { t: "p", s: "\n  -d " },
    {
      t: "s",
      s: `'{"from":"hi@acme.com","to":"jane@example.com","subject":"Welcome to Acme","html":"<h1>Hi Jane</h1>"}'`,
    },
  ],
  ts: [
    { t: "k", s: "import" },
    { t: "p", s: " { Opensend } " },
    { t: "k", s: "from" },
    { t: "s", s: ' "opensend"' },
    { t: "p", s: ";\n\n" },
    { t: "k", s: "const" },
    { t: "p", s: " send = " },
    { t: "k", s: "new" },
    { t: "p", s: " Opensend(" },
    { t: "s", s: "process.env.OPENSEND_KEY" },
    { t: "p", s: ");\n\n" },
    { t: "k", s: "await" },
    { t: "p", s: " send.emails.send({\n  " },
    { t: "a", s: "from" },
    { t: "p", s: ": " },
    { t: "s", s: '"hi@acme.com"' },
    { t: "p", s: ",\n  " },
    { t: "a", s: "to" },
    { t: "p", s: ":   " },
    { t: "s", s: '"jane@example.com"' },
    { t: "p", s: ",\n  " },
    { t: "a", s: "subject" },
    { t: "p", s: ": " },
    { t: "s", s: '"Welcome to Acme"' },
    { t: "p", s: ",\n  " },
    { t: "a", s: "react" },
    { t: "p", s: ": <Welcome name=" },
    { t: "s", s: '"Jane"' },
    { t: "p", s: " />,\n});" },
  ],
  react: [
    { t: "k", s: "export default function" },
    { t: "p", s: " Welcome({ name }) {\n  " },
    { t: "k", s: "return" },
    { t: "p", s: " (\n    <Email>\n      <Header logo=" },
    { t: "s", s: '"/acme.svg"' },
    {
      t: "p",
      s: " />\n      <Heading>Hi {name},</Heading>\n      <Text>Thanks for joining Acme. Your sandbox is ready.</Text>\n      <Button href=",
    },
    { t: "s", s: '"https://acme.com/start"' },
    {
      t: "p",
      s: ">\n        Open dashboard\n      </Button>\n    </Email>\n  );\n}",
    },
  ],
};

const TOK_COLOR: Record<Token["t"], string> = {
  k: "#b18cff",
  s: "#c4ff5a",
  a: "#ffd591",
  p: "var(--fg-2)",
};

function CodeWindow({
  tab,
  setTab,
}: {
  tab: "curl" | "ts" | "react";
  setTab: (id: "curl" | "ts" | "react") => void;
}) {
  const tokens = SNIPPETS[tab];
  return (
    <div
      aria-label="TypeScript SDK code sample"
      style={{
        position: "relative",
        borderRadius: 14,
        border: "1px solid var(--line-2)",
        background: "linear-gradient(180deg, #131318 0%, #0d0d11 100%)",
        boxShadow:
          "0 30px 60px -30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid var(--line)",
          background: "rgba(255,255,255,0.015)",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: "#3a3a40",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: "#3a3a40",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 99,
              background: "#3a3a40",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                background:
                  tab === t.id ? "rgba(255,255,255,0.06)" : "transparent",
                color: tab === t.id ? "var(--fg)" : "var(--fg-3)",
                border: "none",
                fontFamily: "var(--landing-mono)",
                fontSize: 12,
                padding: "5px 10px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>
          POST /emails
        </span>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "20px 22px",
          fontFamily: "var(--landing-mono)",
          fontSize: 13,
          lineHeight: 1.65,
          color: "var(--fg)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          minHeight: 260,
        }}
      >
        {tokens.map((t, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: stable token order
            key={i}
            style={{ color: TOK_COLOR[t.t] || "var(--fg)" }}
          >
            {t.s}
          </span>
        ))}
      </pre>
    </div>
  );
}

const HERO_EVENTS: Array<{ t: string; ms: string; color: string }> = [
  { t: "email.queued", ms: "0ms", color: "var(--fg-2)" },
  { t: "email.accepted", ms: "124ms", color: "var(--violet)" },
  { t: "email.sent", ms: "418ms", color: "#7ed1ff" },
  { t: "email.delivered", ms: "1.4s", color: "var(--accent)" },
  { t: "email.opened", ms: "37s", color: "var(--accent)" },
];

function EventLog({ pulse }: { pulse: number }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid var(--line)",
        background: "rgba(13,13,16,0.65)",
        padding: "14px 16px",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--landing-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
          marginBottom: 10,
        }}
      >
        <span>events · jane@example.com</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: "var(--accent)",
              boxShadow: "0 0 10px var(--accent)",
            }}
          />
          live
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {HERO_EVENTS.map((e, i) => (
          <div
            key={e.t}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--landing-mono)",
              fontSize: 12.5,
              opacity: pulse >= i ? 1 : 0.25,
              transform: pulse >= i ? "translateX(0)" : "translateX(-6px)",
              transition: "opacity 350ms ease, transform 350ms ease",
            }}
          >
            <span style={{ color: pulse >= i ? e.color : "var(--fg-4)" }}>
              {e.t}
            </span>
            <span style={{ color: "var(--fg-3)" }}>{e.ms}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroDemo() {
  const [tab, setTab] = useState<"curl" | "ts" | "react">("ts");
  const [pulse, setPulse] = useState(-1);

  // biome-ignore lint/correctness/useExhaustiveDependencies: tab change resets the pulse loop
  useEffect(() => {
    setPulse(-1);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 5; i++) {
      timers.push(
        setTimeout(() => setPulse((p) => Math.max(p, i)), 350 + i * 600),
      );
    }
    timers.push(setTimeout(() => setPulse(-1), 5500));
    const loop = setInterval(() => {
      setPulse(-1);
      for (let i = 0; i < 5; i++) {
        timers.push(
          setTimeout(() => setPulse((p) => Math.max(p, i)), 350 + i * 600),
        );
      }
    }, 7000);
    return () => {
      for (const t of timers) clearTimeout(t);
      clearInterval(loop);
    };
  }, [tab]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
      }}
    >
      <CodeWindow tab={tab} setTab={setTab} />
      <EventLog pulse={pulse} />
    </div>
  );
}

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        paddingTop: 80,
        paddingBottom: 80,
        overflow: "hidden",
      }}
    >
      <div className="ambient" aria-hidden />
      <div className="wrap" style={{ position: "relative" }}>
        <div
          className="hero-grid"
          style={{
            display: "grid",
            gap: 56,
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
              maxWidth: 580,
            }}
          >
            <span className="pill">
              <span className="dot" /> v0.4 · ELv2 · self-hostable
            </span>
            <h1 className="title-xl">
              Email infrastructure,
              <br />
              <span className="serif" style={{ color: "var(--fg-2)" }}>
                open by default.
              </span>
            </h1>
            <p
              style={{
                maxWidth: 520,
                fontSize: 18,
                lineHeight: 1.5,
                color: "var(--fg-2)",
              }}
            >
              A drop-in Resend-compatible API, a typed SDK, broadcasts,
              contacts, and a real dashboard — running on your AWS&nbsp;SES,
              your Postgres, your domain. No per-email pricing. No vendor
              lock-in.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
              }}
            >
              <a
                href={SELF_HOST_URL}
                data-testid="cta-self-host"
                rel="noreferrer noopener"
                target="_blank"
                className="btn btn-primary"
              >
                <span>$ docker compose up</span>
                <span style={{ opacity: 0.6 }}>↗</span>
              </a>
              <Link href={DOCS_URL} className="btn btn-ghost">
                Read the docs
              </Link>
              <a
                href={GITHUB_URL}
                data-testid="cta-github"
                rel="noreferrer noopener"
                target="_blank"
                className="btn btn-link mono"
                style={{ fontSize: 13 }}
              >
                ★ 2.4k on github →
              </a>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 18,
                alignItems: "center",
                paddingTop: 12,
                color: "var(--fg-3)",
                fontSize: 12.5,
                fontFamily: "var(--landing-mono)",
              }}
            >
              {["Resend-compatible", "HMAC webhooks", "React Email"].map(
                (label) => (
                  <span
                    key={label}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 99,
                        border: "1px solid var(--accent)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--accent)",
                        fontSize: 9,
                      }}
                    >
                      ✓
                    </span>
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>
          <HeroDemo />
        </div>
      </div>
    </section>
  );
}

function StatsBar() {
  const stats: Array<[string, string]> = [
    ["10k+", "sends/mo · free tier"],
    ["<1.4s", "p50 send → delivered"],
    ["Resend", "API parity"],
    ["ELv2", "free to self-host"],
  ];
  return (
    <section
      style={{
        padding: "40px 0",
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="wrap stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 0,
        }}
      >
        {stats.map(([n, label], i) => (
          <div
            key={label}
            style={{
              padding: "16px 24px",
              borderLeft: i ? "1px solid var(--line)" : "none",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              className="serif"
              style={{ fontSize: 40, lineHeight: 1, letterSpacing: "-0.02em" }}
            >
              {n}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--fg-3)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type GlyphKind =
  | "rest"
  | "idem"
  | "dns"
  | "broadcast"
  | "hook"
  | "ses"
  | "team";

function Glyph({ kind }: { kind: GlyphKind }) {
  const common = {
    width: 22,
    height: 22,
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": "true" as const,
    focusable: "false" as const,
    viewBox: "0 0 22 22",
  };
  switch (kind) {
    case "rest":
      return (
        <svg {...common}>
          <title>{kind}</title>
          <path d="M3 11h7M3 7h13M3 15h10" />
          <path d="M14 8l4 3-4 3" />
        </svg>
      );
    case "idem":
      return (
        <svg {...common}>
          <title>{kind}</title>
          <circle cx="11" cy="11" r="6" />
          <path d="M11 8v3l2 2" />
        </svg>
      );
    case "dns":
      return (
        <svg {...common}>
          <title>{kind}</title>
          <circle cx="11" cy="11" r="7" />
          <path d="M4 11h14M11 4c2.5 2 2.5 12 0 14M11 4c-2.5 2-2.5 12 0 14" />
        </svg>
      );
    case "broadcast":
      return (
        <svg {...common}>
          <title>{kind}</title>
          <path d="M5 8l11-3v12L5 14V8z" />
          <path d="M5 8v6" />
          <circle cx="5" cy="11" r="1.5" fill="currentColor" />
        </svg>
      );
    case "hook":
      return (
        <svg {...common}>
          <title>{kind}</title>
          <path d="M7 5v6a4 4 0 008 0V8" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="7" cy="17" r="2" />
        </svg>
      );
    case "ses":
      return (
        <svg {...common}>
          <title>{kind}</title>
          <rect x="3" y="6" width="16" height="11" rx="2" />
          <path d="M3 8l8 5 8-5" />
        </svg>
      );
    case "team":
      return (
        <svg {...common}>
          <title>{kind}</title>
          <circle cx="8" cy="9" r="3" />
          <circle cx="15" cy="10" r="2.5" />
          <path d="M3 18c0-3 2.5-5 5-5s5 2 5 5M13 18c0-2.5 2-4 4-4s2 .5 2 .5" />
        </svg>
      );
  }
}

type Feature = {
  span: number;
  title: string;
  body: string;
  glyph: GlyphKind;
  extra: GlyphKind;
};

const FEATURES: Feature[] = [
  {
    span: 5,
    title: "Resend-compatible REST",
    body: "Same payloads, same headers, same SDK shape. Migrate by changing a base URL — not your code.",
    glyph: "rest",
    extra: "rest",
  },
  {
    span: 7,
    title: "Typed SDK + idempotency",
    body: "Opt-in Idempotency-Key on send and per-row keys on batch sends, so retries collapse safely on the server.",
    glyph: "idem",
    extra: "idem",
  },
  {
    span: 4,
    title: "Domain verification",
    body: "DKIM, SPF, DMARC and click-tracking subdomains written straight to Cloudflare DNS.",
    glyph: "dns",
    extra: "dns",
  },
  {
    span: 4,
    title: "Broadcasts & audiences",
    body: "Block editor with slash commands. Segments, topics, custom properties, CSV import.",
    glyph: "broadcast",
    extra: "broadcast",
  },
  {
    span: 4,
    title: "Webhooks, signed",
    body: "Svix-compatible HMAC headers across delivered, opened, clicked, bounced, complained.",
    glyph: "hook",
    extra: "hook",
  },
  {
    span: 6,
    title: "Runs on your SES quota",
    body: "Bring your own AWS account. Your sending reputation, your data, your bill — caps only at the SES limit.",
    glyph: "ses",
    extra: "ses",
  },
  {
    span: 6,
    title: "Multi-tenant by design",
    body: "Better Auth with Google OAuth, organization invites, per-tenant suppression list, scoped API keys.",
    glyph: "team",
    extra: "team",
  },
];

function Extra({ kind }: { kind: GlyphKind }) {
  if (kind === "rest") {
    return (
      <div
        className="mono"
        style={{
          marginTop: "auto",
          fontSize: 12,
          border: "1px solid var(--line)",
          borderRadius: 8,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.015)",
          color: "var(--fg-2)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div>
          <span style={{ color: "var(--violet)" }}>POST</span> /v1/emails
        </div>
        <div>
          <span style={{ color: "var(--violet)" }}>POST</span> /v1/emails/batch
        </div>
        <div>
          <span style={{ color: "#7ed1ff" }}>GET</span> /v1/domains
        </div>
        <div style={{ color: "var(--fg-3)" }}>+ 24 more</div>
      </div>
    );
  }
  if (kind === "idem") {
    return (
      <div
        style={{
          marginTop: "auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="mono"
            style={{
              fontSize: 11,
              padding: "8px 10px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.015)",
              color: n === 1 ? "var(--accent)" : "var(--fg-3)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>retry #{n}</span>
            <span>{n === 1 ? "202 sent" : "collapsed"}</span>
          </div>
        ))}
        <div
          className="mono"
          style={{
            fontSize: 11,
            padding: "8px 10px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.015)",
            color: "var(--fg-3)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>key</span>
          <span>4f9d…</span>
        </div>
      </div>
    );
  }
  if (kind === "dns") {
    const rows: Array<[string, string, string, string]> = [
      ["DKIM", "TXT", "os._domainkey", "v=DKIM1; p=…"],
      ["SPF", "TXT", "@", "v=spf1 include:…"],
      ["DMARC", "TXT", "_dmarc", "v=DMARC1; p=…"],
    ];
    return (
      <div
        className="mono"
        style={{
          marginTop: "auto",
          fontSize: 11,
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "rgba(255,255,255,0.015)",
          overflow: "hidden",
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r[0]}
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto 1fr auto",
              gap: 10,
              padding: "7px 10px",
              borderTop: i ? "1px solid var(--line)" : "none",
              color: "var(--fg-2)",
            }}
          >
            <span style={{ color: "var(--accent)" }}>✓</span>
            <span style={{ color: "var(--fg-3)" }}>{r[1]}</span>
            <span>{r[2]}</span>
            <span style={{ color: "var(--fg-4)" }}>set</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "broadcast") {
    return (
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
          audience: paid · 12,847
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 99,
            background: "var(--bg-3)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "72%",
              height: "100%",
              background: "var(--accent)",
            }}
          />
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--fg-2)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>72% delivered</span>
          <span>9,250 / 12,847</span>
        </div>
      </div>
    );
  }
  if (kind === "hook") {
    return (
      <div
        className="mono"
        style={{
          marginTop: "auto",
          fontSize: 11.5,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ color: "var(--fg-3)" }}>svix-id: msg_2x9b…</div>
        <div style={{ color: "var(--fg-3)" }}>svix-timestamp: 1730…</div>
        <div style={{ color: "var(--accent)" }}>svix-signature: v1,Az9…</div>
      </div>
    );
  }
  if (kind === "ses") {
    const heights = [20, 32, 28, 44, 38, 52, 46, 60, 54, 68, 62, 76];
    return (
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          height: 56,
        }}
      >
        {heights.map((h, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: chart index
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              background:
                i === heights.length - 1
                  ? "var(--accent)"
                  : "rgba(255,255,255,0.12)",
              borderRadius: 2,
            }}
          />
        ))}
      </div>
    );
  }
  if (kind === "team") {
    const initials = ["JH", "AH", "MK", "+"];
    const bg = [
      "rgba(177,140,255,0.15)",
      "rgba(196,255,90,0.15)",
      "rgba(255,158,199,0.15)",
      "transparent",
    ];
    return (
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        {initials.map((c, i) => (
          <span
            key={c}
            className="mono"
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--line-2)",
              background: bg[i],
              color: i === 3 ? "var(--fg-3)" : "var(--fg)",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {c}
          </span>
        ))}
        <span
          className="mono"
          style={{ fontSize: 12, color: "var(--fg-3)", marginLeft: 4 }}
        >
          4 admins · 12 senders
        </span>
      </div>
    );
  }
  return null;
}

function FeatureCell({ f }: { f: Feature }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        padding: "28px 28px 32px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        minHeight: 220,
        position: "relative",
        gridColumn: `span ${f.span}`,
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          border: "1px solid var(--line-2)",
          background: "rgba(255,255,255,0.025)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent)",
        }}
      >
        <Glyph kind={f.glyph} />
      </span>
      <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em" }}>
        {f.title}
      </div>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--fg-2)" }}>
        {f.body}
      </div>
      <Extra kind={f.extra} />
    </div>
  );
}

function FeaturesSection() {
  return (
    <section style={{ padding: "120px 0 60px", position: "relative" }}>
      <div className="wrap">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxWidth: 720,
            marginBottom: 56,
          }}
        >
          <span className="kicker">{"// in the box"}</span>
          <h2 className="title-l">
            Everything Resend has.
            <br />
            <span className="serif" style={{ color: "var(--fg-2)" }}>
              None of the lock-in.
            </span>
          </h2>
        </div>
        <div
          className="feat-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: 1,
            background: "var(--line-2)",
            border: "1px solid var(--line-2)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          {FEATURES.map((f) => (
            <FeatureCell key={f.title} f={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareSection() {
  const rows: Array<[string, string, string]> = [
    ["Where it runs", "Managed at opensend.dev", "Your infrastructure"],
    ["Setup", "Sign in with Google", "docker compose up -d"],
    ["Pricing", "Free 10k/mo, $19+ paid", "You pay AWS SES only"],
    ["Data residency", "us-east-1 / eu-west-1", "Wherever you run it"],
    ["SES quota", "Shared, soft caps", "Your own account"],
    ["Best for", "Teams that want zero ops", "Teams that want full control"],
  ];
  return (
    <section style={{ padding: "60px 0 100px" }} id="pricing">
      <div className="wrap">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            maxWidth: 720,
            marginBottom: 32,
          }}
        >
          <span className="kicker">{"// two ways to run it"}</span>
          <h2 className="title-l">Cloud, or yours.</h2>
        </div>
        <div
          style={{
            border: "1px solid var(--line-2)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr",
              background: "rgba(255,255,255,0.025)",
              borderBottom: "1px solid var(--line-2)",
            }}
          >
            <div style={{ padding: "18px 22px" }} />
            <div
              style={{
                padding: "18px 22px",
                borderLeft: "1px solid var(--line-2)",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                option A
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>
                opensend Cloud
              </div>
            </div>
            <div
              style={{
                padding: "18px 22px",
                borderLeft: "1px solid var(--line-2)",
                position: "relative",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                option B · default
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, marginTop: 4 }}>
                Self-host
              </div>
              <span
                style={{
                  position: "absolute",
                  top: 12,
                  right: 14,
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: "var(--accent)",
                  boxShadow: "0 0 10px var(--accent)",
                }}
              />
            </div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r[0]}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                borderTop: i ? "1px solid var(--line)" : "none",
              }}
            >
              <div
                style={{
                  padding: "14px 22px",
                  fontFamily: "var(--landing-mono)",
                  fontSize: 12,
                  color: "var(--fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {r[0]}
              </div>
              <div
                style={{
                  padding: "14px 22px",
                  borderLeft: "1px solid var(--line)",
                  fontSize: 14,
                  color: "var(--fg-2)",
                }}
              >
                {r[1]}
              </div>
              <div
                style={{
                  padding: "14px 22px",
                  borderLeft: "1px solid var(--line)",
                  fontSize: 14,
                  color: "var(--fg)",
                }}
              >
                {r[2]}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SelfHostSection() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 5), 1400);
    return () => clearInterval(id);
  }, []);
  const lines: Array<{ p: string; s: string; c?: string }> = [
    { p: "$", s: "git clone github.com/namuh-eng/opensend" },
    { p: "$", s: "cd opensend && cp .env.example .env" },
    { p: "$", s: "docker compose up -d" },
    { p: "✓", s: "app  ready on :3015", c: "var(--accent)" },
    { p: "✓", s: "ingester  on :3016", c: "var(--accent)" },
  ];
  return (
    <section style={{ padding: "60px 0", position: "relative" }}>
      <div
        className="wrap sh-grid"
        style={{
          display: "grid",
          gap: 56,
          gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            maxWidth: 520,
          }}
        >
          <span className="kicker">{"// self-host"}</span>
          <h2 className="title-l">
            Four lines.
            <br />
            <span className="serif" style={{ color: "var(--fg-2)" }}>
              Then you own it.
            </span>
          </h2>
          <p className="body">
            A multi-stage Dockerfile and a docker-compose.yml with
            auto-migration. Bring your own AWS SES credentials and Postgres —
            your data stays on your infrastructure, on your network, behind your
            perimeter.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={SELF_HOST_URL}
              rel="noreferrer noopener"
              target="_blank"
              className="btn btn-ghost"
            >
              Self-host guide ↗
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/Dockerfile`}
              rel="noreferrer noopener"
              target="_blank"
              className="btn btn-link mono"
              style={{ fontSize: 13 }}
            >
              ./Dockerfile →
            </a>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 1,
              background: "var(--line)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            {[
              ["ELv2", "free + modify + self-host"],
              ["Bun + Next 16", "turbopack monorepo"],
              ["Postgres", "drizzle + migrations"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{ padding: "14px 16px", background: "var(--bg)" }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {k}
                </div>
                <div
                  style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 4 }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            borderRadius: 14,
            border: "1px solid var(--line-2)",
            background: "linear-gradient(180deg, #0f0f13 0%, #0a0a0c 100%)",
            boxShadow: "0 30px 60px -30px rgba(0,0,0,0.7)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              background: "rgba(255,255,255,0.015)",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  background: "#3a3a40",
                }}
              />
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  background: "#3a3a40",
                }}
              />
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  background: "#3a3a40",
                }}
              />
            </div>
            <span
              className="mono"
              style={{ fontSize: 11, color: "var(--fg-4)" }}
            >
              ~/opensend
            </span>
            <span />
          </div>
          <div
            style={{
              padding: "18px 22px",
              minHeight: 220,
              fontFamily: "var(--landing-mono)",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            {lines.map((l, i) => (
              <div
                key={l.s}
                style={{
                  display: "flex",
                  gap: 12,
                  opacity: step >= i ? 1 : 0.18,
                  color: step >= i ? l.c || "var(--fg)" : "var(--fg-4)",
                  transition: "opacity 250ms ease",
                }}
              >
                <span style={{ color: l.c || "var(--fg-3)", width: 14 }}>
                  {l.p}
                </span>
                <span>
                  {l.s}
                  {step === i && i < 3 && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 7,
                        height: 14,
                        background: "var(--accent)",
                        marginLeft: 4,
                        verticalAlign: "middle",
                        animation: "landing-blink 1s steps(1) infinite",
                      }}
                    />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoadmapSection() {
  const items: Array<{ done: boolean; t: string; s: string }> = [
    { done: true, t: "HMAC-signed webhooks", s: "Svix-compatible headers" },
    { done: true, t: "Email scheduling", s: "EventBridge → SQS workers" },
    { done: true, t: "Multi-tenant teams", s: "Org invites + scoped keys" },
    { done: true, t: "Built-in analytics", s: "No external dependency" },
    { done: false, t: "SMTP relay", s: "Send without AWS SES" },
    { done: false, t: "Inbound parsing", s: "Reply threading + parsing" },
  ];
  return (
    <section style={{ padding: "100px 0" }}>
      <div className="wrap">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <span className="kicker">{"// roadmap"}</span>
          <h2 className="title-l">Shipping in public.</h2>
        </div>
        <div
          className="road-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 1,
            background: "var(--line)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {items.map((it) => (
            <div
              key={it.t}
              style={{
                background: "var(--bg)",
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minHeight: 110,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 99,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: it.done ? "var(--accent)" : "transparent",
                    border: it.done ? "none" : "1px dashed var(--fg-4)",
                    color: "var(--accent-ink)",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {it.done ? "✓" : ""}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: it.done ? "var(--accent)" : "var(--fg-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  {it.done ? "shipped" : "next"}
                </span>
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                }}
              >
                {it.t}
              </div>
              <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{it.s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BigCTA() {
  const cornerStyle: CSSProperties = {
    position: "absolute",
    top: 16,
    fontSize: 11,
    color: "var(--fg-4)",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  };
  return (
    <section style={{ padding: "80px 0 100px", position: "relative" }}>
      <div className="wrap">
        <div
          style={{
            position: "relative",
            borderRadius: 20,
            border: "1px solid var(--line-2)",
            background:
              "radial-gradient(900px 400px at 50% 120%, color-mix(in oklch, var(--accent) 20%, transparent) 0%, transparent 60%), linear-gradient(180deg, #0e0e12 0%, #0a0a0c 100%)",
            padding: "80px 32px",
            textAlign: "center",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: -40,
              bottom: -40,
              opacity: 0.06,
              color: "var(--accent)",
              pointerEvents: "none",
            }}
          >
            <LogoGlyphLarge size={320} />
          </div>
          <div className="mono" style={{ ...cornerStyle, left: 18 }}>
            opensend / 0.4.0
          </div>
          <div className="mono" style={{ ...cornerStyle, right: 18 }}>
            send.email()
          </div>
          <h2 className="title-l" style={{ maxWidth: 760, margin: "0 auto" }}>
            Stop renting your
            <br />
            <span className="serif" style={{ color: "var(--accent)" }}>
              email infrastructure.
            </span>
          </h2>
          <p className="body" style={{ maxWidth: 540, margin: "18px auto 0" }}>
            Clone the repo, set your SES keys, run docker compose. The same
            developer experience you already love — on your servers.
          </p>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              marginTop: 32,
              flexWrap: "wrap",
            }}
          >
            <a
              href={SELF_HOST_URL}
              rel="noreferrer noopener"
              target="_blank"
              className="btn btn-primary"
            >
              $ docker compose up
            </a>
            <Link
              href={HOSTED_SIGNIN_URL}
              data-testid="cta-hosted"
              className="btn btn-ghost"
            >
              Try Cloud free
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const cols: Array<[string, string[]]> = [
    [
      "Product",
      ["REST API", "TypeScript SDK", "React Email", "Broadcasts", "Webhooks"],
    ],
    [
      "Self-host",
      [
        "Docker compose",
        "Architecture",
        "Migrations",
        "Observability",
        "Ingester",
      ],
    ],
    [
      "Resources",
      ["Docs", "API reference", "Changelog", "Contributing", "License (ELv2)"],
    ],
    ["Community", ["GitHub", "Discussions", "Issues", "X / Twitter", "Status"]],
  ];
  return (
    <footer
      style={{ borderTop: "1px solid var(--line)", padding: "60px 0 40px" }}
    >
      <div
        className="wrap footer-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(4, 1fr)",
          gap: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            maxWidth: 280,
          }}
        >
          <Logo size={24} gap={10} fontSize={15} />
          <p className="body-s" style={{ color: "var(--fg-3)" }}>
            Open-source email infrastructure for developers. Built by
            <span style={{ color: "var(--fg-2)" }}> Jaeyun Ha</span> and
            <span style={{ color: "var(--fg-2)" }}> Ashley Ha</span>.
          </p>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--fg-4)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ELv2 · {new Date().getFullYear()}
          </div>
        </div>
        {cols.map(([h, items]) => (
          <div
            key={h}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--fg-3)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {h}
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 9,
              }}
            >
              {items.map((i) => (
                <li key={i}>
                  <span
                    style={{
                      fontSize: 13.5,
                      color: "var(--fg-2)",
                      cursor: "pointer",
                    }}
                  >
                    {i}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="wrap"
        style={{
          marginTop: 40,
          paddingTop: 20,
          borderTop: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="mono" style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
          curl -X POST opensend.dev/emails — one API for everywhere you ship
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11.5,
            color: "var(--fg-4)",
            display: "flex",
            gap: 16,
          }}
        >
          <span>status: all systems normal</span>
          <span>·</span>
          <span>build: 06d5384</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="landing-root">
      <div className="grain" aria-hidden />
      <div className="landing-content">
        <TopNav />
        <Hero />
        <hr className="line" />
        <StatsBar />
        <FeaturesSection />
        <CompareSection />
        <SelfHostSection />
        <RoadmapSection />
        <BigCTA />
        <SiteFooter />
      </div>
    </div>
  );
}
