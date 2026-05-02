import Stripe from "stripe";

// Keep this pinned to the API version bundled as Stripe.API_VERSION by stripe@22.1.0.
export const STRIPE_API_VERSION = "2026-04-22.dahlia" as const;

let cachedClient: Stripe | null = null;
let cachedFromKey: string | null = null;

export function getStripe(
  env: Record<string, string | undefined> = process.env,
): Stripe {
  const secret = env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is required to use the Stripe client");
  }

  if (cachedClient && cachedFromKey === secret) return cachedClient;

  cachedClient = new Stripe(secret, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: {
      name: "opensend",
    },
  });
  cachedFromKey = secret;
  return cachedClient;
}

export function __resetStripeForTests() {
  cachedClient = null;
  cachedFromKey = null;
}
