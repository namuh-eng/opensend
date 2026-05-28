import { createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { domainRepo } from "../db/repositories/domainRepo";
import { contacts, type domains, emails, receivedEmails } from "../db/schema";
import { timingSafeStringEqual } from "../security/timing-safe";

const TOKEN_PREFIX = "osr";
const TOKEN_PATTERN = /osr_[0-9a-f]{32}_[0-9a-f]{24}/gi;
const TOKEN_LOCAL_PART_PATTERN =
  /^(?:reply[+._-])?(osr_[0-9a-f]{32}_[0-9a-f]{24})$/i;
const HEADER_TOKEN_NAMES = [
  "x-opensend-reply-token",
  "in-reply-to",
  "references",
] as const;
const DEFAULT_REPLY_TOKEN_SECRET = "opensend-local-reply-token-secret";

type DomainRow = typeof domains.$inferSelect;
type EmailRow = typeof emails.$inferSelect;
type ReceivedEmailRow = typeof receivedEmails.$inferSelect;

export type ReplyTrackingHeaders = {
  "X-OpenSend-Reply-Token": string;
};

export type OutboundReplyTracking = {
  enabled: true;
  threadId: string;
  replyToken: string;
  replyAddress: string;
  replyTo: string[];
  headers: ReplyTrackingHeaders;
};

export type OutboundReplyTrackingDisabled = {
  enabled: false;
};

export type PrepareOutboundReplyTrackingInput = {
  userId: string;
  emailId?: string;
  from: string;
  providedReplyTo?: string[] | null;
  headers?: Record<string, string> | null;
  secret?: string;
};

export type MatchedInboundReply = {
  status: "matched";
  userId: string;
  threadId: string;
  emailId: string;
  contactId: string | null;
  token: string;
};

export type UnmatchedInboundReply = {
  status: "unmatched";
  userId: string;
};

export type ResolveInboundReplyInput = {
  userId: string;
  recipients: string[];
  headers: Record<string, string>;
  from: string;
  secret?: string;
};

function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function parseEmailDomain(address: string): string | null {
  const normalized = normalizeEmailAddress(address);
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

function parseLocalPart(address: string): string | null {
  const normalized = normalizeEmailAddress(address);
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return null;
  return normalized.slice(0, at);
}

function hasReceivingEnabled(domain: Pick<DomainRow, "capabilities">): boolean {
  return Boolean(
    domain.capabilities?.some(
      (capability) => capability.name === "receiving" && capability.enabled,
    ),
  );
}

export function getReplyTokenSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (
    env.OPENSEND_REPLY_TOKEN_SECRET ??
    env.BETTER_AUTH_SECRET ??
    env.AUTH_SECRET ??
    env.NEXTAUTH_SECRET ??
    DEFAULT_REPLY_TOKEN_SECRET
  );
}

export function isVerifiedReceivingDomain(
  domain: DomainRow | undefined,
): domain is DomainRow {
  return Boolean(
    domain && domain.status === "verified" && hasReceivingEnabled(domain),
  );
}

function signatureFor(input: {
  userId: string;
  emailId: string;
  replyDomain: string;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(input.userId)
    .update(":")
    .update(input.emailId)
    .update(":")
    .update(input.replyDomain.toLowerCase())
    .digest("hex")
    .slice(0, 24);
}

function compactUuid(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

function expandCompactUuid(value: string): string | null {
  const normalized = value.toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(normalized)) return null;
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

export function generateReplyToken(input: {
  userId: string;
  emailId: string;
  replyDomain: string;
  secret?: string;
}): string {
  const emailId = compactUuid(input.emailId);
  return `${TOKEN_PREFIX}_${emailId}_${signatureFor({
    userId: input.userId,
    emailId: input.emailId,
    replyDomain: input.replyDomain,
    secret: input.secret ?? getReplyTokenSecret(),
  })}`;
}

export function parseReplyToken(
  token: string,
): { emailId: string; signature: string } | null {
  const normalized = token.trim().toLowerCase();
  const match = /^osr_([0-9a-f]{32})_([0-9a-f]{24})$/.exec(normalized);
  if (!match) return null;
  const emailId = expandCompactUuid(match[1]);
  if (!emailId) return null;
  return { emailId, signature: match[2] };
}

export function validateReplyToken(input: {
  token: string;
  userId: string;
  replyDomain: string;
  secret?: string;
}): { valid: true; emailId: string } | { valid: false } {
  const parsed = parseReplyToken(input.token);
  if (!parsed) return { valid: false };
  const expected = signatureFor({
    userId: input.userId,
    emailId: parsed.emailId,
    replyDomain: input.replyDomain,
    secret: input.secret ?? getReplyTokenSecret(),
  });
  if (!timingSafeStringEqual(parsed.signature, expected)) {
    return { valid: false };
  }
  return { valid: true, emailId: parsed.emailId };
}

export function buildReplyAddress(input: {
  token: string;
  replyDomain: string;
}): string {
  return `reply+${input.token}@${input.replyDomain.toLowerCase()}`;
}

export function extractReplyTokensFromAddresses(addresses: string[]): string[] {
  const tokens = new Set<string>();
  for (const address of addresses) {
    const localPart = parseLocalPart(address);
    if (!localPart) continue;
    const match = TOKEN_LOCAL_PART_PATTERN.exec(localPart);
    if (match?.[1]) tokens.add(match[1].toLowerCase());
  }
  return [...tokens];
}

export function extractReplyTokensFromHeaders(
  headers: Record<string, string>,
): string[] {
  const normalized = new Map<string, string>();
  for (const [name, value] of Object.entries(headers)) {
    normalized.set(name.toLowerCase(), value);
  }

  const tokens = new Set<string>();
  for (const name of HEADER_TOKEN_NAMES) {
    const value = normalized.get(name);
    if (!value) continue;
    for (const match of value.matchAll(TOKEN_PATTERN)) {
      tokens.add(match[0].toLowerCase());
    }
  }
  return [...tokens];
}

export function replyDomainsFromRecipients(recipients: string[]): string[] {
  return [
    ...new Set(
      recipients
        .map(parseEmailDomain)
        .filter((domain): domain is string => Boolean(domain)),
    ),
  ];
}

export function hasInboundReplyTokenCandidate(input: {
  recipients: string[];
  headers: Record<string, string>;
}): boolean {
  return (
    extractReplyTokensFromAddresses(input.recipients).length > 0 ||
    extractReplyTokensFromHeaders(input.headers).length > 0
  );
}

async function findReceivingDomainForOutbound(input: {
  userId: string;
  from: string;
}): Promise<DomainRow | undefined> {
  const domainName = parseEmailDomain(input.from);
  if (!domainName) return undefined;
  const domain = await domainRepo.findByNameForUser(domainName, input.userId);
  return isVerifiedReceivingDomain(domain) ? domain : undefined;
}

export async function prepareOutboundReplyTracking(
  input: PrepareOutboundReplyTrackingInput,
): Promise<OutboundReplyTracking | OutboundReplyTrackingDisabled> {
  let domain: DomainRow | undefined;
  try {
    domain = await findReceivingDomainForOutbound({
      userId: input.userId,
      from: input.from,
    });
  } catch {
    // Reply tracking is additive. Do not fail the established send path if the
    // domain lookup boundary is unavailable or mocked out in route tests.
    return { enabled: false };
  }
  if (!domain) return { enabled: false };

  const emailId = input.emailId ?? randomUUID();
  const token = generateReplyToken({
    userId: input.userId,
    emailId,
    replyDomain: domain.name,
    secret: input.secret,
  });
  const replyAddress = buildReplyAddress({
    token,
    replyDomain: domain.name,
  });
  return {
    enabled: true,
    threadId: emailId,
    replyToken: token,
    replyAddress,
    replyTo:
      input.providedReplyTo && input.providedReplyTo.length > 0
        ? input.providedReplyTo
        : [replyAddress],
    headers: {
      "X-OpenSend-Reply-Token": token,
    },
  };
}

async function findContactIdForReply(input: {
  userId: string;
  from: string;
}): Promise<string | null> {
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.userId, input.userId),
        eq(contacts.email, normalizeEmailAddress(input.from)),
      ),
    )
    .limit(1);
  return contact?.id ?? null;
}

async function findOriginalEmailForToken(input: {
  userId: string;
  token: string;
  replyDomain: string;
  secret?: string;
}): Promise<EmailRow | null> {
  const validated = validateReplyToken(input);
  if (!validated.valid) return null;

  const [email] = await db
    .select()
    .from(emails)
    .where(
      and(
        eq(emails.id, validated.emailId),
        eq(emails.userId, input.userId),
        eq(emails.replyToken, input.token),
      ),
    )
    .limit(1);
  return email ?? null;
}

export async function resolveInboundReply(
  input: ResolveInboundReplyInput,
): Promise<MatchedInboundReply | UnmatchedInboundReply> {
  const tokens = [
    ...new Set([
      ...extractReplyTokensFromAddresses(input.recipients),
      ...extractReplyTokensFromHeaders(input.headers),
    ]),
  ];
  const domains = replyDomainsFromRecipients(input.recipients);

  for (const token of tokens) {
    for (const replyDomain of domains) {
      const email = await findOriginalEmailForToken({
        userId: input.userId,
        token,
        replyDomain,
        secret: input.secret,
      });
      if (!email) continue;
      return {
        status: "matched",
        userId: input.userId,
        threadId: email.threadId ?? email.id,
        emailId: email.id,
        contactId: await findContactIdForReply({
          userId: input.userId,
          from: input.from,
        }),
        token,
      };
    }
  }

  return { status: "unmatched", userId: input.userId };
}

export type ThreadMessageDirection = "outbound" | "inbound";

export type ThreadMessage = {
  id: string;
  direction: ThreadMessageDirection;
  subject: string;
  from: string;
  to: string[];
  text: string | null;
  html: string | null;
  created_at: Date;
};

export type ThreadSummary = {
  thread_id: string | null;
  match_status: "matched" | "unmatched";
  original_email_id: string | null;
  contact_id: string | null;
  messages: ThreadMessage[];
};

export async function getThreadForOutboundEmail(input: {
  userId: string;
  emailId: string;
}): Promise<ThreadSummary> {
  const [email] = await db
    .select()
    .from(emails)
    .where(and(eq(emails.id, input.emailId), eq(emails.userId, input.userId)))
    .limit(1);
  if (!email?.threadId) {
    return {
      thread_id: email?.threadId ?? null,
      match_status: "unmatched",
      original_email_id: email?.id ?? null,
      contact_id: null,
      messages: [],
    };
  }

  const [outboundRows, inboundRows] = await Promise.all([
    db
      .select()
      .from(emails)
      .where(
        and(
          eq(emails.userId, input.userId),
          eq(emails.threadId, email.threadId),
        ),
      ),
    db
      .select()
      .from(receivedEmails)
      .where(
        and(
          eq(receivedEmails.userId, input.userId),
          eq(receivedEmails.threadId, email.threadId),
        ),
      ),
  ]);

  const messages: ThreadMessage[] = [
    ...outboundRows.map((row) => ({
      id: row.id,
      direction: "outbound" as const,
      subject: row.subject,
      from: row.from,
      to: row.to,
      text: row.text,
      html: row.html,
      created_at: row.createdAt,
    })),
    ...inboundRows.map((row) => ({
      id: row.id,
      direction: "inbound" as const,
      subject: row.subject,
      from: row.from,
      to: row.to,
      text: row.text,
      html: row.html,
      created_at: row.createdAt,
    })),
  ].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

  const firstMatched = inboundRows.find((row) => row.replyToEmailId);
  return {
    thread_id: email.threadId,
    match_status: inboundRows.length > 0 ? "matched" : "unmatched",
    original_email_id: email.id,
    contact_id: firstMatched?.contactId ?? null,
    messages,
  };
}

export async function getThreadForReceivedEmail(input: {
  userId: string;
  receivedEmailId: string;
}): Promise<ThreadSummary> {
  const [received] = await db
    .select()
    .from(receivedEmails)
    .where(
      and(
        eq(receivedEmails.id, input.receivedEmailId),
        eq(receivedEmails.userId, input.userId),
      ),
    )
    .limit(1);

  if (!received?.threadId) {
    return {
      thread_id: null,
      match_status: "unmatched",
      original_email_id: null,
      contact_id: null,
      messages: received
        ? [
            {
              id: received.id,
              direction: "inbound",
              subject: received.subject,
              from: received.from,
              to: received.to,
              text: received.text,
              html: received.html,
              created_at: received.createdAt,
            },
          ]
        : [],
    };
  }

  const outbound = received.replyToEmailId
    ? await getThreadForOutboundEmail({
        userId: input.userId,
        emailId: received.replyToEmailId,
      })
    : null;

  return (
    outbound ?? {
      thread_id: received.threadId,
      match_status:
        received.replyMatchStatus === "matched" ? "matched" : "unmatched",
      original_email_id: received.replyToEmailId,
      contact_id: received.contactId,
      messages: [],
    }
  );
}
