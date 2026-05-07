export type SandboxTestOutcome =
  | "delivered"
  | "bounced"
  | "complained"
  | "suppressed";

export type SandboxTestRecipient = {
  email: string;
  outcome: SandboxTestOutcome;
};

const RESEND_TEST_DOMAIN = "resend.dev";
const LABELED_OUTCOMES = new Set<SandboxTestOutcome>([
  "delivered",
  "bounced",
  "complained",
]);
const UNLABELED_OUTCOMES = new Set<SandboxTestOutcome>([
  "delivered",
  "bounced",
  "complained",
  "suppressed",
]);

export function detectSandboxTestRecipient(
  recipient: string,
): SandboxTestRecipient | null {
  const normalized = recipient.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0) return null;

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (domain !== RESEND_TEST_DOMAIN) return null;

  const plusIndex = localPart.indexOf("+");
  const outcomeName =
    plusIndex === -1 ? localPart : localPart.slice(0, plusIndex);
  if (!isSandboxTestOutcome(outcomeName)) return null;

  if (plusIndex === -1) {
    if (!UNLABELED_OUTCOMES.has(outcomeName)) return null;
    return { email: normalized, outcome: outcomeName };
  }

  if (!LABELED_OUTCOMES.has(outcomeName)) return null;
  return { email: normalized, outcome: outcomeName };
}

export function getSandboxTestOutcomeForRecipients(
  recipients: readonly string[],
): SandboxTestOutcome | null {
  if (recipients.length === 0) return null;

  let outcome: SandboxTestOutcome | null = null;
  for (const recipient of recipients) {
    const sandboxRecipient = detectSandboxTestRecipient(recipient);
    if (!sandboxRecipient) return null;
    if (outcome && outcome !== sandboxRecipient.outcome) return null;
    outcome = sandboxRecipient.outcome;
  }

  return outcome;
}

function isSandboxTestOutcome(value: string): value is SandboxTestOutcome {
  return (
    value === "delivered" ||
    value === "bounced" ||
    value === "complained" ||
    value === "suppressed"
  );
}
