// Vercel Edge Function that proxies POST /api/dms-mcp to the FastMCP-mounted
// upstream at https://dev.api.eveaix.com/dms/mcp/ (trailing slash required).
//
// Why this exists instead of a vercel.json rewrite:
//   Vercel's edge rewrite layer silently normalises the trailing slash off the
//   destination URL. Upstream FastMCP at /dms/mcp requires the slash —
//   without it APISIX 307-redirects to http://dev.api.eveaix.com/mcp/ which is
//   blocked by the browser (mixed content + missing /dms prefix). An Edge
//   Function lets us pin the upstream URL exactly.

export const config = { runtime: "edge" };

const UPSTREAM = "https://dev.api.eveaix.com/dms/mcp/";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const upstream = new URL(UPSTREAM);
  upstream.search = url.search;

  const headers = new Headers(req.headers);
  // Strip headers that don't belong on the upstream request. `host` would point
  // at the Vercel domain; `cookie` and `connection` are hop-by-hop or irrelevant.
  headers.delete("host");
  headers.delete("connection");
  headers.delete("cookie");
  headers.delete("x-vercel-id");
  headers.delete("x-forwarded-for");
  headers.delete("x-forwarded-host");
  headers.delete("x-forwarded-proto");
  headers.delete("x-real-ip");

  const method = req.method.toUpperCase();
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    redirect: "manual",
  };
  if (method !== "GET" && method !== "HEAD") {
    init.body = req.body;
    // Required when forwarding a streaming request body in fetch-on-edge.
    init.duplex = "half";
  }

  const resp = await fetch(upstream.toString(), init);

  // Re-emit the response so the SSE body streams through unbuffered.
  const respHeaders = new Headers(resp.headers);
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
  });
}
