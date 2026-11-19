/**
 * redis.js
 * --------
 * Small cache wrapper used for:
 *   1. Logout token blacklist   (key: bl:<tokenId>)
 *   2. Failed-login counters    (key: login-fail:<email>)
 *   3. Role permission cache    (key: perms:role:<roleId>)
 *
 * If REDIS_URL is set we use real Redis. If not (simple local dev or
 * tests) we fall back to an in-memory Map with the SAME functions,
 * so the rest of the code never needs to know which one is used.
 */
const config = require('./env');

/* ---------- In-memory fallback (single server only) ---------- */
function createMemoryStore() {
  const data = new Map(); // key -> { value, expiresAt }

  const isExpired = (entry) => entry.expiresAt && entry.expiresAt < Date.now();

  return {
    async get(key) {
      const entry = data.get(key);
      if (!entry || isExpired(entry)) { data.delete(key); return null; }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      data.set(key, { value: String(value), expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
    },
    async incr(key, ttlSeconds) {
      const current = Number(await this.get(key)) || 0;
      const entry = data.get(key);
      // keep the original expiry when the key already exists
      const expiresAt = entry && !isExpired(entry) ? entry.expiresAt : Date.now() + ttlSeconds * 1000;
      data.set(key, { value: String(current + 1), expiresAt });
      return current + 1;
    },
    async del(key) { data.delete(key); },
    async quit() {},
  };
}

/* ---------- Real Redis ---------- */
function createRedisStore(url) {
  const Redis = require('ioredis');
  const client = new Redis(url, { maxRetriesPerRequest: 2 });
  client.on('error', (err) => console.error('[redis] error:', err.message));

  return {
    get: (key) => client.get(key),
    set: (key, value, ttlSeconds) =>
      ttlSeconds ? client.set(key, String(value), 'EX', ttlSeconds) : client.set(key, String(value)),
    async incr(key, ttlSeconds) {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, ttlSeconds); // start the timer on first failure
      return count;
    },
    del: (key) => client.del(key),
    quit: () => client.quit(),
  };
}

const cache = config.redisUrl ? createRedisStore(config.redisUrl) : createMemoryStore();
cache.mode = config.redisUrl ? 'redis' : 'memory';

module.exports = cache;
