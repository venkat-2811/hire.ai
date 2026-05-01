/**
 * Redis cache wrapper using Upstash REST API.
 * Gracefully degrades to no-op if Upstash is not configured.
 */
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;
let _redisInitAttempted = false;

function getRedis(): Redis | null {
  if (_redisInitAttempted) return _redis;
  _redisInitAttempted = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn('[cache] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured. Cache disabled.');
    return null;
  }

  try {
    _redis = new Redis({ url, token });
  } catch (err) {
    console.warn('[cache] Failed to initialize Redis client:', err);
    _redis = null;
  }

  return _redis;
}

export const cache = {
  async get<T = any>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
      return await redis.get<T>(key);
    } catch (err) {
      console.warn('[cache] GET failed for key:', key, err);
      return null;
    }
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      if (ttlSeconds) {
        await redis.set(key, value, { ex: ttlSeconds });
      } else {
        await redis.set(key, value);
      }
    } catch (err) {
      console.warn('[cache] SET failed for key:', key, err);
    }
  },

  async del(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    try {
      await redis.del(key);
    } catch (err) {
      console.warn('[cache] DEL failed for key:', key, err);
    }
  },
};
