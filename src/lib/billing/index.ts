import type { BillingBackend } from "@opensend/core";

const STRIPE_REQUIRED_KEYS = ["STRIPE_SECRET_KEY"] as const;

export function getBillingBackend(
  env: Record<string, string | undefined> = process.env,
): BillingBackend {
  const declared = env.BILLING_BACKEND?.trim().toLowerCase();
  if (declared !== "stripe") return "disabled";

  for (const key of STRIPE_REQUIRED_KEYS) {
    const value = env[key];
    if (!value || value.trim() === "") return "disabled";
  }

  return "stripe";
}

export function isBillingEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return getBillingBackend(env) === "stripe";
}
