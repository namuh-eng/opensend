import type { RequestPlan, SandboxPlanOptions } from "./types";

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed)
    throw new Error("baseUrl is required for sandbox request planning");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("baseUrl must use http or https");
  }
  return parsed.toString().replace(/\/$/, "");
}

function redactedAuthorization(apiKey?: string): string {
  if (!apiKey) return "Bearer <OPENSEND_API_KEY>";
  return "Bearer <redacted>";
}

export function buildSandboxRequestPlan(
  options: SandboxPlanOptions,
): RequestPlan[] {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const headers = {
    Authorization: redactedAuthorization(options.apiKey),
    "Content-Type": "application/json",
  };

  return [
    {
      id: "sandbox-single-send",
      label: "Plan a single sandbox email send",
      method: "POST",
      url: `${baseUrl}/emails`,
      headers,
      body: {
        from: "OpenSend Migration <onboarding@resend.dev>",
        to: "delivered@resend.dev",
        subject: "OpenSend migration verifier sandbox plan",
        html: "<p>This v1 verifier renders the request only; it does not send.</p>",
      },
      status: "planned-not-sent",
      safety:
        "Uses Resend-compatible sandbox recipients and is rendered only; the CLI does not execute this request in v1.",
      caveat:
        "Run your own application tests against a sandbox OpenSend deployment before production cutover.",
    },
    {
      id: "sandbox-batch-send",
      label: "Plan a batch sandbox email send",
      method: "POST",
      url: `${baseUrl}/emails/batch`,
      headers,
      body: [
        {
          from: "OpenSend Migration <onboarding@resend.dev>",
          to: "delivered+batch@resend.dev",
          subject: "Batch sandbox plan",
          html: "<p>Rendered only by migrate-from-resend v1.</p>",
        },
      ],
      status: "planned-not-sent",
      safety:
        "Rendered as a dry-run request plan only; no network call or queued email is created.",
      caveat:
        "Batch idempotency and quota behavior should be verified in a sandbox deployment.",
    },
    {
      id: "sandbox-cancel-scheduled",
      label: "Plan scheduled email cancel check",
      method: "POST",
      url: `${baseUrl}/emails/{scheduled_email_id}/cancel`,
      headers,
      status: "planned-not-sent",
      safety:
        "Placeholder ID prevents accidental mutation; v1 only documents the request shape.",
      caveat:
        "Create a scheduled sandbox email in your own test harness before exercising cancel behavior.",
    },
  ];
}
