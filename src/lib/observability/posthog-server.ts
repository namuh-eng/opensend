import { PostHog } from "posthog-node";

let client: PostHog | null = null;

export function getPosthogServer(): PostHog | null {
  const key =
    process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: host || "https://us.i.posthog.com",
      flushAt: 20,
      flushInterval: 10_000,
    });
  }
  return client;
}

export async function shutdownPosthog(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
