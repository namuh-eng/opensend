import Stripe from "stripe";

export class StripeSignatureError extends Error {
  readonly code:
    | "missing_header"
    | "malformed_header"
    | "invalid_signature"
    | "timestamp_out_of_tolerance";

  constructor(code: StripeSignatureError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "StripeSignatureError";
  }
}

export const DEFAULT_STRIPE_TOLERANCE_SECONDS = 300;

export type VerifyStripeSignatureOptions = {
  payload: string;
  header: string | undefined | null;
  secret: string;
  toleranceSeconds?: number;
};

function mapStripeSignatureError(error: unknown): StripeSignatureError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("timestamp")) {
    return new StripeSignatureError("timestamp_out_of_tolerance", message);
  }
  return new StripeSignatureError("invalid_signature", message);
}

export async function constructStripeEvent(
  options: VerifyStripeSignatureOptions,
): Promise<Stripe.Event> {
  const { payload, header, secret } = options;
  const tolerance =
    options.toleranceSeconds ?? DEFAULT_STRIPE_TOLERANCE_SECONDS;

  if (!header) {
    throw new StripeSignatureError(
      "missing_header",
      "Missing Stripe-Signature header",
    );
  }
  if (!secret || secret.trim() === "") {
    throw new StripeSignatureError(
      "missing_header",
      "Stripe webhook secret is not configured",
    );
  }

  try {
    return await Stripe.webhooks.constructEventAsync(
      payload,
      header,
      secret,
      tolerance,
    );
  } catch (error) {
    throw mapStripeSignatureError(error);
  }
}

export async function verifyStripeSignature(
  options: VerifyStripeSignatureOptions,
): Promise<{ event: Stripe.Event }> {
  return { event: await constructStripeEvent(options) };
}

export async function generateStripeSignatureHeader(input: {
  payload: string;
  secret: string;
  timestamp: number;
}): Promise<string> {
  return await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: input.payload,
    secret: input.secret,
    timestamp: input.timestamp,
  });
}
