"use client";

import Link from "next/link";
import {
  PRICING_SELECTOR_TIERS,
  type PricingDisplayPlan,
  type PricingTierSlug,
} from "./pricing-catalog";

function CheckIcon({ accent = false }: { accent?: boolean }) {
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
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

interface PricingTierSelectorProps {
  selectedSlug: PricingTierSlug;
  onChange: (slug: PricingTierSlug) => void;
}

export function PricingTierSelector({
  selectedSlug,
  onChange,
}: PricingTierSelectorProps) {
  return (
    <div
      data-testid="pricing-tier-selector"
      aria-label="OpenSend monthly package"
      style={{
        width: "min(900px, 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--fg-3)",
        }}
      >
        Choose one pooled API + broadcast package
      </div>
      <fieldset
        style={{
          width: "100%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 6,
          padding: 6,
          border: "1px solid var(--line-2)",
          borderRadius: 18,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <legend className="sr-only">
          Choose included monthly email package
        </legend>
        {PRICING_SELECTOR_TIERS.map((tier) => {
          const active = tier.slug === selectedSlug;
          return (
            <button
              key={tier.slug}
              type="button"
              aria-pressed={active}
              data-testid={`pricing-tier-${tier.slug}`}
              onClick={() => onChange(tier.slug)}
              style={{
                flex: "1 1 108px",
                minWidth: 96,
                maxWidth: 132,
                minHeight: 52,
                padding: "8px 10px",
                borderRadius: 14,
                border: active
                  ? "1px solid color-mix(in oklch, var(--accent) 76%, white)"
                  : "1px solid transparent",
                background: active
                  ? "linear-gradient(180deg, var(--accent), color-mix(in oklch, var(--accent) 82%, black))"
                  : "rgba(255,255,255,0.02)",
                color: active ? "var(--accent-ink)" : "var(--fg-2)",
                cursor: "pointer",
                boxShadow: active
                  ? "0 12px 32px -18px var(--accent), inset 0 1px 0 rgba(255,255,255,0.32)"
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                transition:
                  "background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity: active ? 0.72 : 0.68,
                }}
              >
                {tier.name}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  textTransform: "uppercase",
                }}
              >
                {tier.selectorLabel}
              </span>
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}

interface PricingPlanCardProps {
  plan: PricingDisplayPlan;
  current?: boolean;
  pending?: boolean;
  disabled?: boolean;
  ctaLabel?: string;
  onAction?: () => void;
  testId?: string;
}

export function PricingPlanCard({
  plan,
  current = false,
  pending = false,
  disabled = false,
  ctaLabel,
  onAction,
  testId,
}: PricingPlanCardProps) {
  const isCustom = plan.monthlyPrice === null;
  const buttonLabel = ctaLabel ?? plan.cta;
  const actionDisabled = current || pending || disabled;
  const ctaIsExternal =
    plan.ctaHref.startsWith("mailto:") || plan.ctaHref.startsWith("http");

  const ctaClassName = `btn btn-${plan.ctaStyle}`;
  const ctaStyle = { width: "100%" };

  return (
    <div
      data-current={current ? "true" : undefined}
      data-testid={testId ?? `plan-${plan.family}`}
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
      {plan.featured ? (
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
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
        >
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
          {current ? (
            <span
              className="mono"
              style={{
                borderRadius: 99,
                background: "rgba(177,140,255,0.18)",
                color: "var(--violet)",
                padding: "2px 8px",
                fontSize: 10,
                textTransform: "uppercase",
              }}
            >
              current
            </span>
          ) : null}
        </div>
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
            Let&apos;s talk
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
              {plan.monthlyPrice}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: "var(--fg-3)" }}
            >
              /mo
            </span>
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
                gap: 12,
              }}
            >
              <span style={{ color: "var(--fg-3)" }}>{labels[i]}</span>
              <span
                style={{
                  color:
                    plan.featured && i === 0 ? "var(--accent)" : "var(--fg)",
                  textAlign: "right",
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
        {plan.perks.map((perk) => (
          <li
            key={perk}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              fontSize: 13.5,
              color: "var(--fg-2)",
            }}
          >
            <CheckIcon accent={!!plan.featured} />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: "auto" }}>
        {onAction ? (
          <button
            type="button"
            className={ctaClassName}
            data-testid={`pricing-card-${plan.family}-upgrade`}
            disabled={actionDisabled}
            onClick={onAction}
            style={{
              ...ctaStyle,
              opacity: actionDisabled ? 0.55 : 1,
              cursor: actionDisabled ? "not-allowed" : "pointer",
            }}
          >
            {pending ? "Opening checkout…" : buttonLabel}
          </button>
        ) : ctaIsExternal ? (
          <a
            href={plan.ctaHref}
            className={ctaClassName}
            data-testid={`cta-${plan.family}`}
            rel={
              plan.ctaHref.startsWith("http")
                ? "noreferrer noopener"
                : undefined
            }
            style={ctaStyle}
            target={plan.ctaHref.startsWith("http") ? "_blank" : undefined}
          >
            {buttonLabel}
          </a>
        ) : (
          <Link
            href={plan.ctaHref}
            className={ctaClassName}
            data-testid={`cta-${plan.family}`}
            style={ctaStyle}
          >
            {buttonLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
