import { createHash, createHmac, randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { Client } from "pg";

export interface E2EUser {
  id: string;
  email: string;
  name: string;
  sessionId: string;
  sessionToken: string;
  signedSessionToken: string;
}

export interface E2EApiKey {
  id: string;
  name: string;
  token: string;
  tokenHash: string;
  authorization: string;
  userId: string;
  permission: "full_access" | "sending_access";
}

export interface E2ERunContext {
  runId: string;
  emailPrefix: string;
}

type AuthFixtures = {
  authenticatedPage: Page;
  e2eApiKey: E2EApiKey;
  e2eDb: Client;
  e2eRun: E2ERunContext;
  e2eTenantA: E2EUser;
  e2eTenantB: E2EUser;
  e2eUser: E2EUser;
};

function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

function getBaseUrl(): string {
  return (
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.PORT ?? "3015"}`
  );
}

function normalizeRunPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
}

export function makeE2ERunContext(testInfo: {
  workerIndex: number;
  title: string;
}): E2ERunContext {
  const title = normalizeRunPart(testInfo.title).slice(0, 32) || "test";
  const runId = `${testInfo.workerIndex}-${Date.now()}-${randomUUID().slice(0, 8)}-${title}`;
  return {
    runId,
    emailPrefix: `e2e-${runId}`,
  };
}

export function signBetterAuthSessionToken(sessionToken: string): string {
  const secret =
    process.env.BETTER_AUTH_SECRET ?? "better-auth-secret-12345678901234567890";
  const signature = createHmac("sha256", secret)
    .update(sessionToken)
    .digest("base64");
  return `${sessionToken}.${signature}`;
}

export async function createE2EUser(
  client: Client,
  runId: string,
  label = "user",
): Promise<E2EUser> {
  const normalizedLabel = normalizeRunPart(label);
  const userId = `e2e-${normalizedLabel}-${runId}`;
  const sessionToken = `e2e-session-${normalizedLabel}-${runId}`;
  const sessionId = `e2e-session-id-${normalizedLabel}-${runId}`;
  const email = `${userId}@example.com`;
  const name = `OpenSend E2E ${label}`;

  await client.query(
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ($1, $2, $3, true, now(), now())
     on conflict (id) do update set updated_at = now()`,
    [userId, name, email],
  );
  await client.query(
    `insert into "session" (id, token, user_id, expires_at, created_at, updated_at)
     values ($1, $2, $3, now() + interval '1 hour', now(), now())
     on conflict (token) do update set expires_at = excluded.expires_at`,
    [sessionId, sessionToken, userId],
  );

  return {
    id: userId,
    email,
    name,
    sessionId,
    sessionToken,
    signedSessionToken: signBetterAuthSessionToken(sessionToken),
  };
}

export async function cleanupE2EUser(
  client: Client,
  user: E2EUser,
): Promise<void> {
  await client.query('delete from "session" where token = $1 or user_id = $2', [
    user.sessionToken,
    user.id,
  ]);
  await client.query('delete from "account" where user_id = $1', [user.id]);
  await client.query('delete from "email_events" where user_id = $1', [
    user.id,
  ]);
  await client.query("delete from api_keys where user_id = $1", [user.id]);
  await client.query("delete from contacts where user_id = $1", [user.id]);
  await client.query('delete from "user" where id = $1', [user.id]);
}

export function hashE2EApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createE2EApiKey(
  client: Client,
  options: {
    userId: string;
    runId: string;
    label?: string;
    permission?: "full_access" | "sending_access";
  },
): Promise<E2EApiKey> {
  const label = normalizeRunPart(options.label ?? "api-key");
  const token = `os_e2e_${options.runId}_${label}_${randomUUID()}`;
  const tokenHash = hashE2EApiKey(token);
  const permission = options.permission ?? "full_access";
  const name = `E2E ${label} ${options.runId}`;

  const { rows } = await client.query<{ id: string }>(
    `insert into api_keys (name, token_hash, token_preview, permission, user_id, created_at)
     values ($1, $2, $3, $4, $5, now())
     returning id`,
    [
      name,
      tokenHash,
      `${token.slice(0, 8)}...${token.slice(-4)}`,
      permission,
      options.userId,
    ],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Failed to create E2E API key");

  return {
    id,
    name,
    token,
    tokenHash,
    authorization: `Bearer ${token}`,
    userId: options.userId,
    permission,
  };
}

export async function cleanupE2EApiKey(
  client: Client,
  apiKey: E2EApiKey,
): Promise<void> {
  await client.query("delete from api_keys where id = $1 and token_hash = $2", [
    apiKey.id,
    apiKey.tokenHash,
  ]);
}

export async function cleanupE2EContactsByEmailPrefix(
  client: Client,
  emailPrefix: string,
): Promise<void> {
  await client.query("delete from contacts where email like $1", [
    `${emailPrefix}%@example.com`,
  ]);
}

export async function countE2ERowsByPrefix(
  client: Client,
  emailPrefix: string,
): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `select count(*)::text as count
     from contacts
     where email like $1`,
    [`${emailPrefix}%@example.com`],
  );
  return Number(rows[0]?.count ?? "0");
}

export const test = base.extend<AuthFixtures>({
  e2eDb: async ({ browserName: _browserName }, use, testInfo) => {
    const databaseUrl = getDatabaseUrl();
    testInfo.skip(!databaseUrl, "DATABASE_URL is required for auth-backed E2E");
    if (!databaseUrl) return;

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    try {
      await use(client);
    } finally {
      await client.end();
    }
  },
  e2eRun: async ({ browserName: _browserName }, use, testInfo) => {
    await use(makeE2ERunContext(testInfo));
  },
  e2eUser: async ({ e2eDb, e2eRun }, use) => {
    const user = await createE2EUser(e2eDb, e2eRun.runId, "user");

    try {
      await use(user);
    } finally {
      await cleanupE2EUser(e2eDb, user);
    }
  },
  e2eTenantA: async ({ e2eDb, e2eRun }, use) => {
    const user = await createE2EUser(e2eDb, e2eRun.runId, "tenant-a");

    try {
      await use(user);
    } finally {
      await cleanupE2EUser(e2eDb, user);
    }
  },
  e2eTenantB: async ({ e2eDb, e2eRun }, use) => {
    const user = await createE2EUser(e2eDb, e2eRun.runId, "tenant-b");

    try {
      await use(user);
    } finally {
      await cleanupE2EUser(e2eDb, user);
    }
  },
  e2eApiKey: async ({ e2eDb, e2eRun, e2eUser }, use) => {
    const apiKey = await createE2EApiKey(e2eDb, {
      userId: e2eUser.id,
      runId: e2eRun.runId,
    });

    try {
      await use(apiKey);
    } finally {
      await cleanupE2EApiKey(e2eDb, apiKey);
    }
  },
  authenticatedPage: async ({ context, e2eUser, page }, use) => {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: e2eUser.signedSessionToken,
        url: getBaseUrl(),
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await use(page);
  },
});

export { expect };
