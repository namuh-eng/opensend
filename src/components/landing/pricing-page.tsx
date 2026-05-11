"use client";

import Link from "next/link";
import { useState } from "react";

const GITHUB_URL = "https://github.com/namuh-eng/opensend";
const DOCS_URL = "/docs";
const HOSTED_SIGNIN_URL = "/auth";
const SELF_HOST_URL = `${GITHUB_URL}#self-host`;
const CONTACT_URL = "mailto:hello@opensend.namuh.co";

type Plan = {
  slug: string;
  name: string;
  blurb: string;
  monthly: number | string;
  yearly: number | string;
  quota: string;
  domains: string;
  keys: string;
  cta: string;
  ctaStyle: "primary" | "ghost";
  ctaHref: string;
  featured?: boolean;
  perks: string[];
};

export type BillingPeriod = "monthly" | "yearly";

const PLANS: Plan[] = [
  {
    slug: "free",
    name: "Free",
    blurb: "For tinkering and side projects.",
    monthly: 0,
    yearly: 0,
    quota: "10,000 emails/mo",
    domains: "1 verified domain",
    keys: "2 API keys",
    cta: "Get started",
    ctaStyle: "ghost",
    ctaHref: HOSTED_SIGNIN_URL,
    perks: [
      "Resend-compatible REST API",
      "TypeScript SDK + React Email",
      "HMAC-signed webhooks",
      "Open/click analytics",
      "Community support",
    ],
  },
  {
    slug: "starter",
    name: "Starter",
    blurb: "For small teams shipping production email.",
    monthly: 19,
    yearly: 15,
    quota: "50,000 emails/mo",
    domains: "5 verified domains",
    keys: "10 API keys",
    cta: "Start Starter",
    ctaStyle: "ghost",
    ctaHref: HOSTED_SIGNIN_URL,
    perks: [
      "Everything in Free",
      "Higher SES quota allocation",
      "Broadcast & audience segments",
      "Email automations",
      "Email support · 48h",
    ],
  },
  {
    slug: "growth",
    name: "Growth",
    blurb: "For teams scaling to millions.",
    monthly: 79,
    yearly: 65,
    quota: "500,000 emails/mo",
    domains: "25 verified domains",
    keys: "50 API keys",
    cta: "Start Growth",
    ctaStyle: "primary",
    ctaHref: HOSTED_SIGNIN_URL,
    featured: true,
    perks: [
      "Everything in Starter",
      "Dedicated IPs (add-on)",
      "Custom Return-Path domains",
      "Audit log & SSO (Google)",
      "Priority support · 12h",
    ],
  },
  {
    slug: "scale",
    name: "Scale",
    blurb: "High-volume, regulated, custom needs.",
    monthly: "Custom",
    yearly: "Custom",
    quota: "Unlimited (your SES)",
    domains: "Unlimited",
    keys: "Unlimited",
    cta: "Talk to us",
    ctaStyle: "ghost",
    ctaHref: CONTACT_URL,
    perks: [
      "Everything in Growth",
      "BYO AWS account",
      "Dedicated infra & VPC peering",
      "BAA / SOC 2 assistance",
      "Slack channel · 1h SLA",
    ],
  },
];

const FAQ: Array<[string, string]> = [
  [
    "What happens if I exceed my quota?",
    "You get a soft warning at 80% and a notification at 100%. Sends are not blocked — overage is billed at $0.40 per 1,000 emails until you upgrade.",
  ],
  [
    "Do I have to use AWS SES?",
    "On Cloud, no — we manage the SES side for you. On Self-host, yes (for now). SMTP relay is on the roadmap.",
  ],
  [
    "Can I switch between Cloud and Self-host?",
    "Yes. Self-host is always free under the Elastic License 2.0 — you only pay AWS. You can also export your data and migrate at any time.",
  ],
  [
    "What does ELv2 mean for me?",
    "You can use, modify, and self-host opensend for free, including for commercial purposes. The only restriction is offering opensend itself as a hosted service to third parties.",
  ],
  [
    "Is there a yearly discount?",
    "Yes — paying yearly saves roughly 20% on Starter and Growth. Toggle the switch above the plans.",
  ],
  [
    "How do I cancel?",
    "From Settings → Billing. There's no contract — you can cancel anytime and keep your current period.",
  ],
];

const COMPARE_ROWS: string[][] = [
  ["Monthly emails", "10k", "50k", "500k", "Unlimited"],
  ["Verified domains", "1", "5", "25", "Unlimited"],
  ["API keys", "2", "10", "50", "Unlimited"],
  ["Webhooks", "✓", "✓", "✓", "✓"],
  ["Broadcasts", "—", "✓", "✓", "✓"],
  ["Automations", "—", "✓", "✓", "✓"],
  ["Dedicated IP", "—", "—", "Add-on", "Included"],
  ["SSO (Google)", "—", "—", "✓", "✓"],
  ["Audit log", "—", "—", "90 days", "Unlimited"],
  ["SLA", "—", "99.9%", "99.95%", "99.99%"],
  ["Support", "Community", "48h email", "12h email", "1h Slack"],
];

function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={{
        display: "block",
        filter:
          "drop-shadow(0 0 12px color-mix(in oklch, var(--accent) 40%, transparent))",
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
        <Link
          href="/"
          aria-label="opensend home"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 500,
            fontSize: 15,
            letterSpacing: "-0.01em",
          }}
        >
          <LogoMark />
          <span>opensend</span>
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
          <Link href={DOCS_URL}>Docs</Link>
          <Link href={`${DOCS_URL}#api`}>API</Link>
          <a href={SELF_HOST_URL} rel="noreferrer noopener" target="_blank">
            Self-host
          </a>
          <Link href="/pricing" style={{ color: "var(--fg)" }}>
            Pricing
          </Link>
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

function CheckIcon({ accent }: { accent: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      style={{
        flex: "none",
        marginTop: 3,
        color: accent ? "var(--accent)" : "var(--fg)",
      }}
      aria-hidden="true"
      focusable="false"
    >
      <title>included</title>
      <path
        d="M3 7.5l2.5 2.5L11 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanCard({
  plan,
  billing,
}: {
  plan: Plan;
  billing: BillingPeriod;
}) {
  const isCustom = typeof plan.monthly === "string";
  const eff =
    billing === "yearly" && typeof plan.yearly === "number"
      ? plan.yearly
      : plan.monthly;
  const showSave =
    billing === "yearly" &&
    typeof plan.yearly === "number" &&
    typeof plan.monthly === "number" &&
    plan.yearly < plan.monthly;

  const ctaIsExternal =
    plan.ctaHref.startsWith("mailto:") || plan.ctaHref.startsWith("http");

  return (
    <div
      data-testid={`plan-${plan.slug}`}
      style={{
        position: "relative",
        borderRadius: 14,
        border: plan.featured
          ? "1px solid color-mix(in oklch, var(--accent) 60%, transparent)"
          : "1px solid var(--line-2)",
        background: plan.featured
          ? "linear-gradient(180deg, rgba(196,255,90,0.04) 0%, rgba(13,13,16,0.85) 60%)"
          : "linear-gradient(180deg, #131318 0%, #0d0d11 100%)",
        padding: "28px 26px 26px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        minHeight: 480,
        boxShadow: plan.featured
          ? "0 30px 60px -30px rgba(196,255,90,0.25)"
          : "0 30px 60px -40px rgba(0,0,0,0.6)",
      }}
    >
      {plan.featured && (
        <span
          style={{
            position: "absolute",
            top: -12,
            right: 20,
            padding: "4px 10px",
            borderRadius: 99,
            background: "var(--accent)",
            color: "var(--accent-ink)",
            fontFamily: "var(--landing-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow:
              "0 0 0 1px rgba(196,255,90,0.35), 0 0 24px -4px rgba(196,255,90,0.5)",
          }}
        >
          most popular
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: plan.featured ? "var(--accent)" : "var(--fg-3)",
          }}
        >
          {plan.name.toLowerCase()}
        </span>
        <h3
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.015em",
          }}
        >
          {plan.name}
        </h3>
        <p style={{ margin: 0, color: "var(--fg-2)", fontSize: 13.5 }}>
          {plan.blurb}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          minHeight: 56,
        }}
      >
        {isCustom ? (
          <span
            className="serif"
            style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}
          >
            Let's talk
          </span>
        ) : (
          <>
            <span
              style={{
                fontSize: 12,
                color: "var(--fg-3)",
                fontFamily: "var(--landing-mono)",
              }}
            >
              $
            </span>
            <span
              style={{
                fontSize: 44,
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1,
              }}
            >
              {eff}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: "var(--fg-3)" }}
            >
              /mo
            </span>
            {showSave && (
              <span
                style={{
                  marginLeft: "auto",
                  alignSelf: "center",
                  fontFamily: "var(--landing-mono)",
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(196,255,90,0.12)",
                  color: "var(--accent)",
                  border: "1px solid rgba(196,255,90,0.25)",
                }}
              >
                billed yearly
              </span>
            )}
          </>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "rgba(255,255,255,0.015)",
          overflow: "hidden",
        }}
      >
        {[plan.quota, plan.domains, plan.keys].map((row, i) => {
          const labels = ["quota", "domains", "keys"];
          return (
            <div
              key={labels[i]}
              className="mono"
              style={{
                padding: "9px 12px",
                fontSize: 12,
                color: "var(--fg-2)",
                borderTop: i ? "1px solid var(--line)" : "none",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "var(--fg-3)" }}>{labels[i]}</span>
              <span
                style={{
                  color:
                    plan.featured && i === 0 ? "var(--accent)" : "var(--fg)",
                }}
              >
                {row}
              </span>
            </div>
          );
        })}
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
        {plan.perks.map((p) => (
          <li
            key={p}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              fontSize: 13.5,
              color: "var(--fg-2)",
            }}
          >
            <CheckIcon accent={!!plan.featured} />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "auto" }}>
        {ctaIsExternal ? (
          <a
            href={plan.ctaHref}
            className={`btn btn-${plan.ctaStyle}`}
            style={{ width: "100%" }}
            rel={
              plan.ctaHref.startsWith("http")
                ? "noreferrer noopener"
                : undefined
            }
            target={plan.ctaHref.startsWith("http") ? "_blank" : undefined}
          >
            {plan.cta}
          </a>
        ) : (
          <Link
            href={plan.ctaHref}
            className={`btn btn-${plan.ctaStyle}`}
            style={{ width: "100%" }}
            data-testid={`cta-${plan.slug}`}
          >
            {plan.cta}
          </Link>
        )}
      </div>
    </div>
  );
}

function SelfHostLane() {
  return (
    <div
      className="sh-lane"
      style={{
        marginTop: 24,
        borderRadius: 16,
        border: "1px dashed var(--line-2)",
        background:
          "linear-gradient(180deg, rgba(177,140,255,0.04) 0%, transparent 60%)",
        padding: "24px 28px",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 24,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          border: "1px solid var(--line-2)",
          background: "rgba(255,255,255,0.025)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--violet)",
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <title>self-host</title>
          <rect x="3" y="4" width="16" height="14" rx="2" />
          <path d="M3 9h16M7 14l2 2 4-4" />
        </svg>
      </div>
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            Self-host
          </span>
          <span
            className="mono"
            style={{
              padding: "2px 8px",
              borderRadius: 99,
              fontSize: 11,
              background: "rgba(177,140,255,0.12)",
              color: "var(--violet)",
              border: "1px solid rgba(177,140,255,0.25)",
            }}
          >
            free forever · ELv2
          </span>
        </div>
        <div
          style={{
            color: "var(--fg-2)",
            fontSize: 13.5,
            lineHeight: 1.5,
            maxWidth: 640,
          }}
        >
          Run opensend on your infrastructure. You only pay AWS SES — no
          per-email fees, no seat caps. Same source. Same dashboard. Same SDK.
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href={SELF_HOST_URL}
          rel="noreferrer noopener"
          target="_blank"
          className="btn btn-ghost mono"
          style={{ fontSize: 12.5 }}
          data-testid="cta-self-host"
        >
          $ docker compose up
        </a>
        <a
          href={SELF_HOST_URL}
          rel="noreferrer noopener"
          target="_blank"
          className="btn btn-ghost"
          style={{ fontSize: 13 }}
        >
          Self-host docs ↗
        </a>
      </div>
    </div>
  );
}

function CompareTable() {
  const headers = ["Free", "Starter", "Growth", "Scale"];
  return (
    <section style={{ padding: "80px 0" }}>
      <div className="wrap">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 32,
            maxWidth: 720,
          }}
        >
          <span className="kicker">{"// compare plans"}</span>
          <h2 className="title-l">All the details.</h2>
        </div>
        <div
          style={{
            border: "1px solid var(--line-2)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div
            className="cmp-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr repeat(4, 1fr)",
              background: "rgba(255,255,255,0.025)",
              borderBottom: "1px solid var(--line-2)",
            }}
          >
            <div style={{ padding: "18px 22px" }} />
            {headers.map((n, i) => (
              <div
                key={n}
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
                    color: i === 2 ? "var(--accent)" : "var(--fg-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                  }}
                >
                  {i === 2 ? "most popular" : "plan"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>
                  {n}
                </div>
                {i === 2 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 14,
                      right: 16,
                      width: 6,
                      height: 6,
                      borderRadius: 99,
                      background: "var(--accent)",
                      boxShadow: "0 0 10px var(--accent)",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {COMPARE_ROWS.map((r, i) => (
            <div
              key={r[0]}
              className="cmp-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr repeat(4, 1fr)",
                borderTop: i ? "1px solid var(--line)" : "none",
              }}
            >
              <div
                style={{
                  padding: "13px 22px",
                  fontFamily: "var(--landing-mono)",
                  fontSize: 12,
                  color: "var(--fg-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {r[0]}
              </div>
              {r.slice(1).map((cell, j) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells are positional
                  key={j}
                  style={{
                    padding: "13px 22px",
                    borderLeft: "1px solid var(--line)",
                    fontSize: 13.5,
                    color:
                      cell === "—"
                        ? "var(--fg-4)"
                        : j === 2
                          ? "var(--fg)"
                          : "var(--fg-2)",
                    fontFamily:
                      cell === "✓" || cell === "—"
                        ? "var(--landing-mono)"
                        : "inherit",
                  }}
                >
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection() {
  const [open, setOpen] = useState(0);
  return (
    <section style={{ padding: "40px 0 100px" }}>
      <div className="wrap">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 32,
            maxWidth: 720,
          }}
        >
          <span className="kicker">{"// questions"}</span>
          <h2 className="title-l">Things people ask.</h2>
        </div>
        <div
          style={{
            border: "1px solid var(--line-2)",
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          {FAQ.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <div
                key={q}
                style={{ borderTop: i ? "1px solid var(--line)" : "none" }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    padding: "18px 22px",
                    background: isOpen
                      ? "rgba(255,255,255,0.02)"
                      : "transparent",
                    border: "none",
                    color: "var(--fg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 15,
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                  }}
                >
                  <span>{q}</span>
                  <span
                    aria-hidden="true"
                    style={{
                      transition: "transform 200ms ease",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                      color: "var(--fg-3)",
                      fontSize: 18,
                    }}
                  >
                    +
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: isOpen ? 240 : 0,
                    overflow: "hidden",
                    transition: "max-height 250ms ease",
                  }}
                >
                  <div
                    style={{
                      padding: "0 22px 20px",
                      color: "var(--fg-2)",
                      fontSize: 14,
                      lineHeight: 1.6,
                      maxWidth: 720,
                    }}
                  >
                    {a}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MiniFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "32px 0" }}>
      <div
        className="wrap"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="mono" style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
          ELv2 · {new Date().getFullYear()} · opensend
        </div>
        <div
          style={{
            display: "flex",
            gap: 22,
            fontSize: 13,
            color: "var(--fg-3)",
          }}
        >
          <Link href="/">← Back to home</Link>
          <Link href={DOCS_URL}>Docs</Link>
          <a href={GITHUB_URL} rel="noreferrer noopener" target="_blank">
            GitHub
          </a>
          <span>Status</span>
        </div>
      </div>
    </footer>
  );
}

export function PricingPage({
  billing = "monthly",
}: { billing?: BillingPeriod }) {
  return (
    <div className="landing-root">
      <div className="grain" aria-hidden="true" />
      <div className="landing-content">
        <TopNav />

        <section style={{ padding: "80px 0 30px", position: "relative" }}>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -200,
              left: "50%",
              transform: "translateX(-50%)",
              width: 1100,
              height: 600,
              background:
                "radial-gradient(ellipse at center, color-mix(in oklch, var(--accent) 18%, transparent) 0%, transparent 60%)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />
          <div
            className="wrap"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              gap: 22,
            }}
          >
            <span className="pill">
              <span className="dot" /> simple pricing · cancel anytime
            </span>
            <h1 className="title-l" style={{ maxWidth: 820 }}>
              Pay for sending,
              <br />
              <span className="serif" style={{ color: "var(--fg-2)" }}>
                not for licenses.
              </span>
            </h1>
            <p className="body" style={{ maxWidth: 580 }}>
              Start free. Upgrade when your volume grows. Or self-host the same
              source for free forever — opensend is ELv2 either way.
            </p>

            <form
              aria-label="Billing period"
              action="/pricing"
              method="get"
              style={{
                display: "inline-flex",
                padding: 4,
                borderRadius: 999,
                border: "1px solid var(--line-2)",
                background: "rgba(255,255,255,0.02)",
                marginTop: 8,
                marginInline: 0,
                minWidth: 0,
              }}
            >
              {(
                [
                  ["monthly", "Monthly"],
                  ["yearly", "Yearly · save 20%"],
                ] as const
              ).map(([k, label]) => {
                const active = billing === k;
                return (
                  <button
                    key={k}
                    type="submit"
                    name="billing"
                    value={k}
                    aria-pressed={active}
                    data-testid={`billing-${k}`}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 999,
                      cursor: "pointer",
                      border: "none",
                      background: active ? "var(--fg)" : "transparent",
                      color: active ? "var(--bg)" : "var(--fg-2)",
                      fontSize: 13,
                      fontWeight: 500,
                      transition: "background 150ms ease, color 150ms ease",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </form>
          </div>
        </section>

        <section style={{ padding: "40px 0" }}>
          <div className="wrap">
            <div
              className="plan-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 18,
              }}
            >
              {PLANS.map((p) => (
                <PlanCard key={p.slug} plan={p} billing={billing} />
              ))}
            </div>
            <SelfHostLane />
          </div>
        </section>

        <CompareTable />
        <hr className="line" />
        <FAQSection />
        <MiniFooter />
      </div>
    </div>
  );
}
