/**
 * Redis cache wrapper for the ingester service.
 *
 * Near-verbatim port of src/lib/cache/redis.ts; adapted for the ingester's
 * Node process context (no Next.js module resolution or rate-limit backend).
 *
 * When REDIS_URL is unset, all operations no-op and return "unavailable".
 * A single structured warn is emitted at module-init time so operators know
 * cache invalidations are being silently skipped.
 *
 * Lazy connect — the redis client is constructed on first operation; the
 * module itself does NOT connect at import time.
 */

import { type RedisClientType, createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL?.trim();

export type CacheReadStatus = "hit" | "miss" | "unavailable" | "error";
export type CacheWriteStatus = "written" | "unavailable" | "error";
export type CacheDeleteStatus = "deleted" | "unavailable" | "error";

type RedisClient = RedisClientType;

let client: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;

if (!REDIS_URL) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "cache.disabled.no_redis_url",
      consequence: "domain cache invalidations will be skipped",
    }),
  );
}

export function isRedisConfigured(): boolean {
  return Boolean(REDIS_URL);
}

function getClient(): RedisClient | null {
  if (!REDIS_URL) return null;

  if (!client) {
    client = createClient({ url: REDIS_URL });
    client.on("error", (err) => {
      console.error(
        JSON.stringify({
          level: "error",
          event: "cache.redis_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    });
  }

  return client;
}

async function getConnectedClient(): Promise<RedisClient | null> {
  const redisClient = getClient();
  if (!redisClient) return null;

  if (redisClient.isOpen) return redisClient;

  if (!connectPromise) {
    connectPromise = redisClient
      .connect()
      .then(() => redisClient)
      .catch((err) => {
        connectPromise = null;
        console.error(
          JSON.stringify({
            level: "error",
            event: "cache.redis_connect_error",
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        return null;
      });
  }

  return connectPromise;
}

export async function readCache<T>(
  key: string,
): Promise<{ status: CacheReadStatus; value: T | null }> {
  const redisClient = await getConnectedClient();
  if (!redisClient) {
    return { status: "unavailable", value: null };
  }

  try {
    const value = await redisClient.get(key);
    if (!value) {
      return { status: "miss", value: null };
    }
    return { status: "hit", value: JSON.parse(value) as T };
  } catch {
    return { status: "error", value: null };
  }
}

export async function writeCache(
  key: string,
  value: unknown,
  ttlSeconds = 300,
): Promise<CacheWriteStatus> {
  const redisClient = await getConnectedClient();
  if (!redisClient) return "unavailable";

  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return "written";
  } catch {
    return "error";
  }
}

export async function deleteCache(key: string): Promise<CacheDeleteStatus> {
  const redisClient = await getConnectedClient();
  if (!redisClient) return "unavailable";

  try {
    await redisClient.del(key);
    return "deleted";
  } catch {
    return "error";
  }
}
