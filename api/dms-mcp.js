// Vercel Edge Function — proxies POST /api/dms-mcp to the FastMCP-mounted
// upstream at https://dev.api.eveaix.com/dms/mcp/ (trailing slash REQUIRED).
//
// Why this exists instead of a vercel.json rewrite:
//   Vercel's edge rewrite layer silently strips trailing slashes from the
//   destination URL. Upstream FastMCP at /dms/mcp/ requires the slash —
//   without it APISIX returns a 307 redirect to http://dev.api.eveaix.com/mcp/
//   which the browser blocks (mixed content + missing /dms prefix).
//
// Plain JS to keep Vercel's build pipeline happy — no TypeScript compile step
// involved in deploying serverless functions.

export const config = { runtime: "edge" };

const UPSTREAM = "https://dev.api.eveaix.com/dms/mcp/";

export default async function handler(req) {
  // Re-build headers, dropping hop-by-hop and Vercel-internal ones.
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (
      k === "host" ||
      k === "connection" ||
      k === "cookie" ||
      k.startsWith("x-vercel-") ||
      k.startsWith("x-forwarded-") ||
      k === "x-real-ip"
    ) return;
    headers.set(key, value);
  });

  const method = req.method.toUpperCase();
  const init = {
    method,
    headers,
    redirect: "manual",
  };
  // Read the body up-front (vs streaming) so we avoid the "duplex" RequestInit
  // option that breaks under some build pipelines.
  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }

  const resp = await fetch(UPSTREAM, init);

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: resp.headers,
  });
}
