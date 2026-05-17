export const PRICING_CONTACT_URL = "mailto:hello@opensend.namuh.co";
export const PRICING_AUTH_URL = "/auth";

export type PricingPlanFamily = "free" | "starter" | "growth" | "scale";

export type PricingTierSlug =
  | "free"
  | "cloud_starter_55k_monthly"
  | "cloud_starter_100k_monthly"
  | "cloud_growth_120k_monthly"
  | "cloud_growth_250k_monthly"
  | "cloud_growth_500k_monthly"
  | "scale_custom";

export type PricingCtaStyle = "primary" | "ghost";
export type PricingCheckoutKind = "free" | "stripe" | "contact";

export interface PricingDisplayPlan {
  slug: PricingTierSlug;
  family: PricingPlanFamily;
  name: string;
  blurb: string;
  monthlyPrice: number | null;
  quota: string;
  quotaValue: number | null;
  domains: string;
  maxDomains: number | null;
  keys: string;
  maxApiKeys: number | null;
  cta: string;
  ctaStyle: PricingCtaStyle;
  ctaHref: string;
  checkoutKind: PricingCheckoutKind;
  featured?: boolean;
  selectorLabel: string;
  perks: string[];
}

const FREE_PLAN: PricingDisplayPlan = {
  slug: "free",
  family: "free",
  name: "Free",
  blurb: "For tinkering and side projects.",
  monthlyPrice: 0,
  quota: "5,000 API + broadcast emails/mo",
  quotaValue: 5000,
  domains: "1 verified domain",
  maxDomains: 1,
  keys: "2 API keys",
  maxApiKeys: 2,
  cta: "Get started",
  ctaStyle: "ghost",
  ctaHref: PRICING_AUTH_URL,
  checkoutKind: "free",
  selectorLabel: "5k",
  perks: [
    "Resend-compatible REST API",
    "TypeScript SDK + React Email",
    "HMAC-signed webhooks",
    "Open/click analytics",
    "Community support",
  ],
};

const STARTER_55K: PricingDisplayPlan = {
  slug: "cloud_starter_55k_monthly",
  family: "starter",
  name: "Starter",
  blurb: "For small teams shipping production email.",
  monthlyPrice: 19,
  quota: "55,000 API + broadcast emails/mo",
  quotaValue: 55000,
  domains: "10 verified domains",
  maxDomains: 10,
  keys: "10 API keys",
  maxApiKeys: 10,
  cta: "Start Starter",
  ctaStyle: "ghost",
  ctaHref: PRICING_AUTH_URL,
  checkoutKind: "stripe",
  selectorLabel: "55k",
  perks: [
    "Everything in Free",
    "API sends + broadcast fanout",
    "Contacts, segments, and broadcasts",
    "Email automations",
    "Email support · 48h",
  ],
};

const STARTER_100K: PricingDisplayPlan = {
  ...STARTER_55K,
  slug: "cloud_starter_100k_monthly",
  monthlyPrice: 35,
  quota: "100,000 API + broadcast emails/mo",
  quotaValue: 100000,
  selectorLabel: "100k",
};

const GROWTH_120K: PricingDisplayPlan = {
  slug: "cloud_growth_120k_monthly",
  family: "growth",
  name: "Growth",
  blurb: "For domain-heavy teams growing broadcast and API volume.",
  monthlyPrice: 99,
  quota: "120,000 API + broadcast emails/mo",
  quotaValue: 120000,
  domains: "1,000 verified domains",
  maxDomains: 1000,
  keys: "25 API keys",
  maxApiKeys: 25,
  cta: "Start Growth",
  ctaStyle: "primary",
  ctaHref: PRICING_AUTH_URL,
  checkoutKind: "stripe",
  featured: true,
  selectorLabel: "120k",
  perks: [
    "Everything in Starter",
    "Advanced broadcast and audience workflows",
    "Custom Return-Path domains",
    "Audit log & SSO (Google)",
    "Priority support · 12h",
  ],
};

const GROWTH_250K: PricingDisplayPlan = {
  ...GROWTH_120K,
  slug: "cloud_growth_250k_monthly",
  monthlyPrice: 160,
  quota: "250,000 API + broadcast emails/mo",
  quotaValue: 250000,
  selectorLabel: "250k",
};

const GROWTH_500K: PricingDisplayPlan = {
  ...GROWTH_120K,
  slug: "cloud_growth_500k_monthly",
  monthlyPrice: 350,
  quota: "500,000 API + broadcast emails/mo",
  quotaValue: 500000,
  selectorLabel: "500k",
};

const SCALE_CUSTOM: PricingDisplayPlan = {
  slug: "scale_custom",
  family: "scale",
  name: "Scale",
  blurb: "High-volume, regulated, custom needs.",
  monthlyPrice: null,
  quota: "Unlimited (your SES)",
  quotaValue: null,
  domains: "Unlimited",
  maxDomains: null,
  keys: "Unlimited",
  maxApiKeys: null,
  cta: "Talk to us",
  ctaStyle: "ghost",
  ctaHref: PRICING_CONTACT_URL,
  checkoutKind: "contact",
  selectorLabel: "custom",
  perks: [
    "Everything in Growth",
    "BYO AWS account",
    "Dedicated infra & VPC peering",
    "BAA / SOC 2 assistance",
    "Slack channel · 1h SLA",
  ],
};

export const PRICING_TIERS: PricingDisplayPlan[] = [
  FREE_PLAN,
  STARTER_55K,
  STARTER_100K,
  GROWTH_120K,
  GROWTH_250K,
  GROWTH_500K,
  SCALE_CUSTOM,
];

export const DEFAULT_PRICING_TIER_SLUG: PricingTierSlug =
  "cloud_growth_120k_monthly";

export const PRICING_SELECTOR_TIERS = PRICING_TIERS;

export function isPricingTierSlug(value: string): value is PricingTierSlug {
  return PRICING_TIERS.some((tier) => tier.slug === value);
}

export function findPricingTier(slug: string): PricingDisplayPlan | null {
  return PRICING_TIERS.find((tier) => tier.slug === slug) ?? null;
}

export function defaultTierForFamily(
  family: PricingPlanFamily,
): PricingDisplayPlan {
  if (family === "starter") return STARTER_55K;
  if (family === "growth") return GROWTH_120K;
  if (family === "scale") return SCALE_CUSTOM;
  return FREE_PLAN;
}

export function getPricingCardsForSelection(
  selectedSlug: PricingTierSlug,
): PricingDisplayPlan[] {
  const selected = findPricingTier(selectedSlug) ?? GROWTH_120K;
  const starter = selected.family === "starter" ? selected : STARTER_55K;
  const growth = selected.family === "growth" ? selected : GROWTH_120K;
  return [FREE_PLAN, starter, growth, SCALE_CUSTOM];
}
