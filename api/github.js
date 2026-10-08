// GET /api/github — adi's GitHub contribution calendar for the past year.
// Reads the public calendar page on github.com (no token needed) and returns
// { user, total, days: [{ date, count, level }] }. Cached for an hour.

const USER = "pizzalover125";
const TTL = 60 * 60 * 1000;
let cache = null;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  // Let a CDN (e.g. Vercel) cache it too
  res.setHeader("Cache-Control", status === 200 ? "public, s-maxage=3600, max-age=600" : "no-store");
  res.end(JSON.stringify(body));
}

function parse(html) {
  const tips = {};
  for (const m of html.matchAll(/for="(contribution-day-component-[\d-]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = m[2].match(/^(\d[\d,]*) contribution/);
    tips[m[1]] = n ? Number(n[1].replace(/,/g, "")) : 0;
  }
  const days = [];
  for (const m of html.matchAll(/<td[^>]*data-date="([\d-]+)"[^>]*id="(contribution-day-component-[\d-]+)"[^>]*data-level="(\d)"/g)) {
    days.push({ date: m[1], count: tips[m[2]] ?? 0, level: Number(m[3]) });
  }
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  const t = html.match(/([\d,]+)\s+contributions?\s+in the last year/);
  const total = t ? Number(t[1].replace(/,/g, "")) : days.reduce((n, d) => n + d.count, 0);
  return { user: USER, total, days };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "GET only" });
  if (cache && Date.now() - cache.at < TTL) return send(res, 200, cache.data);
  try {
    const r = await fetch(`https://github.com/users/${USER}/contributions`, {
      headers: { "User-Agent": "apanda.dev contribution graph" },
    });
    if (!r.ok) {
      console.error(`[github] github.com returned ${r.status}`);
      return send(res, 502, { error: `github ${r.status}` });
    }
    const data = parse(await r.text());
    if (!data.days.length) {
      console.error("[github] couldn't find any days in the calendar HTML (layout changed?)");
      return send(res, 502, { error: "couldn't read the calendar" });
    }
    cache = { at: Date.now(), data };
    console.log(`[github] ${data.days.length} days, ${data.total} contributions`);
    return send(res, 200, data);
  } catch (err) {
    console.error("[github] fetch failed:", err);
    return send(res, 502, { error: "couldn't reach github" });
  }
}
