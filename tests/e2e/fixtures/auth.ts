import { createHash, createHmac } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
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
  token: string;
  tokenHash: string;
  userId: string;
  authorization: string;
}

export interface E2ETenant {
  user: E2EUser;
  apiKey: E2EApiKey;
}

type AuthFixtures = {
  authenticatedPage: Page;
  e2eApiRequest: APIRequestContext;
  e2eDb: Client;
  e2eRunId: string;
  e2eTenant: E2ETenant;
  e2eUser: E2EUser;
};

function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

export function getE2EBaseUrl(): string {
  return (
    process.env.E2E_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? "3015"}`
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildRunId(testInfo: TestInfo): string {
  const provided = process.env.E2E_RUN_ID?.trim();
  if (provided) return slugify(provided);

  const stableTitle = slugify(testInfo.titlePath.slice(1).join("-"));
  return [
    "e2e",
    stableTitle,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
    `p${testInfo.parallelIndex}`,
  ].join("-");
}

function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function signBetterAuthSessionToken(sessionToken: string): string {
  const secret =
    process.env.BETTER_AUTH_SECRET ?? "better-auth-secret-12345678901234567890";
  const signature = createHmac("sha256", secret)
    .update(sessionToken)
    .digest("base64");
  return `${sessionToken}.${signature}`;
}

export async function cleanupE2ERun(
  client: Client,
  runId: string,
): Promise<void> {
  const userPrefix = `e2e-user-${runId}`;
  const apiKeyPrefix = `e2e-api-key-${runId}`;
  const emailPattern = `%@${runId}.e2e.opensend.test`;

  await client.query(
    `delete from webhook_deliveries
     where event_id in (
       select id from email_events
       where user_id like $1
     )`,
    [`${userPrefix}%`],
  );
  await client.query("delete from email_events where user_id like $1", [
    `${userPrefix}%`,
  ]);
  await client.query(
    "delete from contacts_to_segments where contact_id in (select id from contacts where user_id like $1 or email like $2 or document->>'test_run_id' = $3)",
    [`${userPrefix}%`, emailPattern, runId],
  );
  await client.query(
    "delete from contacts where user_id like $1 or email like $2 or document->>'test_run_id' = $3",
    [`${userPrefix}%`, emailPattern, runId],
  );
  await client.query(
    "delete from contacts_to_segments where segment_id in (select id from segments where user_id like $1 or document->>'test_run_id' = $2)",
    [`${userPrefix}%`, runId],
  );
  await client.query(
    "delete from segments where user_id like $1 or document->>'test_run_id' = $2",
    [`${userPrefix}%`, runId],
  );
  await client.query(
    "delete from api_keys where user_id like $1 or name like $2 or document->>'test_run_id' = $3",
    [`${userPrefix}%`, `${apiKeyPrefix}%`, runId],
  );
  await client.query('delete from "session" where user_id like $1', [
    `${userPrefix}%`,
  ]);
  await client.query('delete from "account" where user_id like $1', [
    `${userPrefix}%`,
  ]);
  await client.query('delete from "user" where id like $1', [`${userPrefix}%`]);
}

export async function createE2EUser(
  client: Client,
  runId: string,
  suffix = "primary",
): Promise<E2EUser> {
  const userId = `e2e-user-${runId}-${suffix}`;
  const sessionToken = `e2e-session-${runId}-${suffix}`;
  const sessionId = `e2e-session-id-${runId}-${suffix}`;
  const email = `${userId}@${runId}.e2e.opensend.test`;
  const name = `OpenSend E2E ${suffix}`;

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

export async function createE2EApiKey(
  client: Client,
  runId: string,
  userId: string,
  suffix = "primary",
): Promise<E2EApiKey> {
  const rawKey = `re_e2e_${hashApiKey(`${runId}:${suffix}:${userId}`).slice(0, 32)}`;
  const tokenHash = hashApiKey(rawKey);
  const { rows } = await client.query<{ id: string }>(
    `insert into api_keys (name, token_hash, token_preview, permission, user_id, document)
     values ($1, $2, $3, 'full_access', $4, $5::jsonb)
     on conflict (token_hash) do update set user_id = excluded.user_id
     returning id`,
    [
      `e2e-api-key-${runId}-${suffix}`,
      tokenHash,
      `${rawKey.slice(0, 6)}...${rawKey.slice(-4)}`,
      userId,
      JSON.stringify({ test_run_id: runId }),
    ],
  );

  return {
    id: rows[0]?.id ?? "",
    token: rawKey,
    tokenHash,
    userId,
    authorization: `Bearer ${rawKey}`,
  };
}

export async function createE2ETenant(
  client: Client,
  runId: string,
  suffix: string,
): Promise<E2ETenant> {
  const user = await createE2EUser(client, runId, suffix);
  const apiKey = await createE2EApiKey(client, runId, user.id, suffix);
  return { user, apiKey };
}

export const test = base.extend<AuthFixtures>({
  e2eRunId: async ({ browserName: _browserName }, use, testInfo) => {
    await use(buildRunId(testInfo));
  },
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
  e2eTenant: async ({ e2eDb, e2eRunId }, use) => {
    await cleanupE2ERun(e2eDb, e2eRunId);
    const tenant = await createE2ETenant(e2eDb, e2eRunId, "primary");

    try {
      await use(tenant);
    } finally {
      await cleanupE2ERun(e2eDb, e2eRunId);
    }
  },
  e2eUser: async ({ e2eTenant }, use) => {
    await use(e2eTenant.user);
  },
  e2eApiRequest: async ({ playwright, e2eTenant }, use) => {
    const request = await playwright.request.newContext({
      baseURL: getE2EBaseUrl(),
      extraHTTPHeaders: {
        Authorization: e2eTenant.apiKey.authorization,
      },
    });

    try {
      await use(request);
    } finally {
      await request.dispose();
    }
  },
  authenticatedPage: async ({ context, e2eUser, page }, use) => {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: e2eUser.signedSessionToken,
        url: getE2EBaseUrl(),
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await use(page);
  },
});

export { expect };
