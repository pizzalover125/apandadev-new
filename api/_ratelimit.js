// Fixed-window rate limiter for /api/chat, so visitors can't burn the Hack Club AI budget.
// (The leading underscore keeps Vercel from deploying this file as its own endpoint.)
//
// Storage:
//   - Redis over REST when configured (Upstash, or Vercel KV / Upstash from the Vercel marketplace):
//     UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL + KV_REST_API_TOKEN.
//     Counts are shared by every serverless instance, so the limits actually hold in production.
//   - Otherwise an in-memory Map. Fine for `npm run dev`; on serverless each instance counts on its own.
//
// Every limit can be changed with an env var (see LIMITS).

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const env = process.env;

export const LIMITS = [
  // per visitor (IP)
  { name: "minute", scope: "ip", windowSec: 60, max: num(env.CHAT_LIMIT_PER_MINUTE, 6) },
  { name: "hour", scope: "ip", windowSec: 3600, max: num(env.CHAT_LIMIT_PER_HOUR, 40) },
  { name: "day", scope: "ip", windowSec: 86400, max: num(env.CHAT_LIMIT_PER_DAY, 100) },
  // everyone combined, so a crowd (or many IPs) can't pass the daily AI budget
  { name: "global-day", scope: "global", windowSec: 86400, max: num(env.CHAT_LIMIT_GLOBAL_PER_DAY, 1000) },
];

const REDIS_URL = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
const REDIS_TOKEN = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
export const store = REDIS_URL && REDIS_TOKEN ? "redis" : "memory";

// key -> { count, resetAt }
const mem = new Map();

function memIncr(key, windowSec, now) {
  let e = mem.get(key);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + windowSec * 1000 };
    mem.set(key, e);
  }
  e.count++;
  // Drop expired entries now and then so the map doesn't grow forever
  if (mem.size > 5000) for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k);
  return e.count;
}

// One round trip: INCR + set the expiry only on a new key, for every window.
async function redisIncr(keys) {
  const cmds = keys.flatMap(({ key, windowSec }) => [
    ["INCR", key],
    ["EXPIRE", key, String(windowSec), "NX"],
  ]);
  const r = await fetch(`${REDIS_URL.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`redis ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const out = await r.json();
  return keys.map((_, i) => {
    const res = out[i * 2];
    if (res.error) throw new Error(`redis: ${res.error}`);
    return Number(res.result);
  });
}

// The visitor's IP. On Vercel, x-real-ip / x-forwarded-for are set by the platform, not the client.
export function clientIp(req) {
  return (
    String(req.headers["x-real-ip"] || "").trim() ||
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

async function count(keys, now) {
  if (store === "redis") {
    try {
      return await redisIncr(keys);
    } catch (err) {
      // Redis down: fall back to memory rather than letting everything through
      console.error("[ratelimit] redis failed, using memory:", err.message);
    }
  }
  return keys.map((k) => memIncr(k.key, k.windowSec, now));
}

// Counts this request against the per-IP windows, then (only if those pass) the global one,
// so one visitor hammering the endpoint can't use up everyone's daily budget.
// Returns { ok, limit, remaining, resetSec, retryAfter, blockedBy } for the tightest window.
export async function rateLimit(ip) {
  const now = Date.now();
  const keys = LIMITS.map((l) => {
    const win = Math.floor(now / 1000 / l.windowSec);
    const who = l.scope === "global" ? "all" : ip;
    return { ...l, key: `rl:chat:${l.name}:${who}:${win}`, resetSec: (win + 1) * l.windowSec - Math.floor(now / 1000) };
  });

  const results = [];
  for (const group of [keys.filter((k) => k.scope === "ip"), keys.filter((k) => k.scope === "global")]) {
    const counts = await count(group, now);
    group.forEach((k, i) => results.push({ ...k, count: counts[i], remaining: Math.max(0, k.max - counts[i]) }));
    if (results.some((r) => r.count > r.max)) break;
  }

  const blocked = results.filter((r) => r.count > r.max).sort((a, b) => b.resetSec - a.resetSec)[0];
  const tightest = blocked || results.reduce((a, b) => (b.remaining < a.remaining ? b : a));
  return {
    ok: !blocked,
    limit: tightest.max,
    remaining: tightest.remaining,
    resetSec: tightest.resetSec,
    retryAfter: blocked ? blocked.resetSec : 0,
    blockedBy: blocked ? blocked.name : null,
  };
}

// Standard headers (IETF RateLimit draft + Retry-After)
export function setRateHeaders(res, rl) {
  res.setHeader("RateLimit-Limit", String(rl.limit));
  res.setHeader("RateLimit-Remaining", String(rl.remaining));
  res.setHeader("RateLimit-Reset", String(rl.resetSec));
  if (!rl.ok) res.setHeader("Retry-After", String(rl.retryAfter));
}
