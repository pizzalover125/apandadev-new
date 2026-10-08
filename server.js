// Local dev server: `node server.js`, then open http://localhost:3000
// Serves index.html and POST /api/chat. Loads HACK_CLUB_AI_KEY from .env.
// Only index.html, gamepanda.js, apps.js, phoenix-map.png and imessage-received.m4a are served, so .env and other files are never exposed.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(new URL(".env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

// Imported after .env is loaded, since the API modules read env vars when they load
const { default: handler } = await import("./api/chat.js");
const { default: github } = await import("./api/github.js");

const PORT = process.env.PORT || 3000;

createServer(async (req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  console.log(`${req.method} ${path}`);
  if (path === "/api/chat") {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 20000) return req.destroy();
    }
    req.body = raw;
    return handler(req, res);
  }
  if (path === "/api/github") return github(req, res);
  if (path === "/gamepanda.js" || path === "/apps.js") {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    return res.end(readFileSync(new URL(path.slice(1), import.meta.url)));
  }
  if (path === "/imessage-received.m4a") {
    res.setHeader("Content-Type", "audio/mp4");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.end(readFileSync(new URL("imessage-received.m4a", import.meta.url)));
  }
  if (path === "/phoenix-map.png") {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.end(readFileSync(new URL("phoenix-map.png", import.meta.url)));
  }
  if (path === "/" || path === "/index.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(readFileSync(new URL("index.html", import.meta.url)));
  }
  res.statusCode = 404;
  res.end("not found");
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  console.log(`HACK_CLUB_AI_KEY ${process.env.HACK_CLUB_AI_KEY ? "loaded" : "MISSING — check .env"}`);
});
