import Redis from 'ioredis';

let redis: Redis | undefined;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redis = new Redis(url);
  }
  return redis;
}

export async function getOrSet<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const client = getRedis();
  const cached = await client.get(key);
  if (cached) return JSON.parse(cached) as T;
  const value = await fn();
  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return value;
}

export async function getOrSetWithHit<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<{ value: T; hit: boolean }>{
  const client = getRedis();
  const cached = await client.get(key);
  if (cached) return { value: JSON.parse(cached) as T, hit: true };
  const value = await fn();
  await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return { value, hit: false };
}
