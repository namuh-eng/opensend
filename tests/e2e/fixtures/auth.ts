import { createHmac } from "node:crypto";
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

type AuthFixtures = {
  authenticatedPage: Page;
  e2eDb: Client;
  e2eUser: E2EUser;
};

function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

function getBaseUrl(): string {
  return (
    process.env.E2E_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? "3015"}`
  );
}

export function signBetterAuthSessionToken(sessionToken: string): string {
  const secret =
    process.env.BETTER_AUTH_SECRET ?? "better-auth-secret-12345678901234567890";
  const signature = createHmac("sha256", secret)
    .update(sessionToken)
    .digest("base64");
  return `${sessionToken}.${signature}`;
}

async function insertE2EUser(client: Client, runId: string): Promise<E2EUser> {
  const userId = `e2e-user-${runId}`;
  const sessionToken = `e2e-session-${runId}`;
  const sessionId = `e2e-session-id-${runId}`;
  const email = `${userId}@example.com`;
  const name = "OpenSend E2E User";

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

async function cleanupE2EUser(client: Client, user: E2EUser): Promise<void> {
  await client.query('delete from "session" where token = $1 or user_id = $2', [
    user.sessionToken,
    user.id,
  ]);
  await client.query('delete from "account" where user_id = $1', [user.id]);
  await client.query('delete from "user" where id = $1', [user.id]);
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
  e2eUser: async ({ e2eDb }, use, testInfo) => {
    const runId = `${testInfo.workerIndex}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const user = await insertE2EUser(e2eDb, runId);

    try {
      await use(user);
    } finally {
      await cleanupE2EUser(e2eDb, user);
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
