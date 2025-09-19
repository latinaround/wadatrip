import { getRedis } from '@wadatrip/common/redis';

const WINDOW_SEC = 60;
const OPEN_SEC = 120;

function cfg() {
  return {
    threshold: Number(process.env.CONNECTOR_CIRCUIT_THRESHOLD || 5),
  };
}

export async function circuitOpen(name: string): Promise<boolean> {
  const redis = getRedis();
  const openUntil = await redis.get(`cb:${name}:open_until`);
  if (!openUntil) return false;
  const now = Math.floor(Date.now() / 1000);
  return now < Number(openUntil);
}

export async function recordFailure(name: string) {
  const redis = getRedis();
  const key = `cb:${name}:errors:${Math.floor(Date.now() / 1000 / WINDOW_SEC)}`;
  const errors = await redis.incr(key);
  await redis.expire(key, WINDOW_SEC * 2);
  if (errors >= cfg().threshold) {
    const openUntil = Math.floor(Date.now() / 1000) + OPEN_SEC;
    await redis.set(`cb:${name}:open_until`, String(openUntil), 'EX', OPEN_SEC);
  }
}

export async function withCircuit<T>(name: string, fn: () => Promise<T>, onFallback: () => Promise<T>): Promise<T> {
  if (await circuitOpen(name)) {
    return onFallback();
  }
  try {
    return await fn();
  } catch (e) {
    await recordFailure(name);
    return onFallback();
  }
}

