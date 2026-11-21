import { Redis } from "@upstash/redis";

const KEY = "hhc:inventory:v1";

export function redisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

function client(): Redis | null {
  const credentials = redisCredentials();
  if (!credentials) return null;
  return new Redis(credentials);
}

export async function readShared<T>(): Promise<T | null> {
  const redis = client();
  if (!redis) return null;
  return redis.get<T>(KEY);
}

export async function writeShared(value: unknown): Promise<void> {
  const redis = client();
  if (!redis) throw new Error("Shared storage is not configured.");
  await redis.set(KEY, value);
}

/** Store the seed only when the key is still empty. */
export async function writeSharedIfEmpty(value: unknown): Promise<void> {
  const redis = client();
  if (!redis) throw new Error("Shared storage is not configured.");
  await redis.set(KEY, value, { nx: true });
}
