// Runs the Vercel/Node-style handlers in api/ ((req, res) => ...) as Netlify Functions
// ((Request, context) => Response), so the same code works on Vercel, Netlify and server.js.

export async function adapt(handler, request, context) {
  const headers = Object.fromEntries(request.headers);
  // Netlify gives the visitor's IP on the context; the rate limiter reads x-real-ip
  if (context?.ip) headers["x-real-ip"] = context.ip;
  const req = {
    method: request.method,
    url: new URL(request.url).pathname,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    socket: { remoteAddress: context?.ip },
  };
  return new Promise((resolve) => {
    const out = new Headers();
    const res = {
      statusCode: 200,
      setHeader: (k, v) => out.set(k, String(v)),
      end: (body) => resolve(new Response(body ?? null, { status: res.statusCode, headers: out })),
    };
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error("[netlify] handler crashed:", err);
      resolve(new Response(JSON.stringify({ error: "server error" }), { status: 500 }));
    });
  });
}
