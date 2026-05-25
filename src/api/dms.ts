import type { AuthSession, TenantInventory } from "../types";

// Talks to the deployed DMS MCP server (via the Vite proxy) using the same JSON-RPC
// flow as test-dms-mcp.ps1's Initialize-McpSession / Invoke-McpTool.
//
//   POST /api/dms/mcp/    initialize          -> { mcp-session-id in headers }
//   POST /api/dms/mcp/    notifications/initialized
//   POST /api/dms/mcp/    tools/call          -> SSE-wrapped JSON result

// DMS is called DIRECTLY from the browser, bypassing the Vercel proxy.
// APISIX returns `Access-Control-Allow-Origin: *` on this route (verified via
// OPTIONS preflight) so cross-origin POSTs from any host are allowed. This
// sidesteps two Vercel quirks at once:
//   1. Edge rewrite strips trailing slash off destination → FastMCP 307s
//   2. Adding an Edge Function at /api/dms-mcp.* caused deploys to fail
// Login + KCS keep using the Vercel proxy (/api/core-tenant/*, /api/kcs/*)
// because those paths don't depend on a trailing slash.
const DMS_MCP_URL = "https://dev.api.eveaix.com/dms/mcp/";

async function initSession(token: string): Promise<string> {
  const initBody = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "eve-kcs-demo", version: "0.1" },
    },
  };

  const resp = await fetch(DMS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(initBody),
  });

  if (!resp.ok) throw new Error(`DMS initialize: HTTP ${resp.status}`);
  const sessionId = resp.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("DMS did not return mcp-session-id header");

  // Drain body so the connection cleans up.
  await resp.text().catch(() => "");

  // Send the "initialized" notification (no response expected, but DMS needs it).
  await fetch(DMS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  return sessionId;
}

async function callTool<T>(
  token: string,
  sessionId: string,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const resp = await fetch(DMS_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${token}`,
      "mcp-session-id": sessionId,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 99999),
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });

  if (!resp.ok) throw new Error(`${name}: HTTP ${resp.status}`);
  const raw = await resp.text();

  // Response is SSE-framed: lines like `data: {...}`. Pick the first data line.
  const dataLine = raw
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("data: "));
  if (!dataLine) throw new Error(`${name}: no data line in response`);

  const payload = JSON.parse(dataLine.slice(6));
  if (payload.error) throw new Error(`${name}: ${payload.error.message ?? "RPC error"}`);

  // Unwrap content[0].text -> JSON
  const block = payload.result?.content?.[0];
  if (!block) throw new Error(`${name}: empty content`);
  try {
    return JSON.parse(block.text) as T;
  } catch {
    return block.text as unknown as T;
  }
}

export async function fetchTenantInventory(session: AuthSession): Promise<TenantInventory> {
  const inventory: TenantInventory = {
    sources: [],
    connections: [],
    runs: [],
    objectStores: [],
  };

  try {
    const sid = await initSession(session.token);

    const [srcRes, connRes, runRes, storeRes] = await Promise.allSettled([
      callTool<{ sources: TenantInventory["sources"] }>(session.token, sid, "dms_list_sources"),
      callTool<{ connections: TenantInventory["connections"] }>(session.token, sid, "dms_list_connections"),
      callTool<{ runs: TenantInventory["runs"] }>(session.token, sid, "dms_list_runs", { limit: 5 }),
      callTool<{ object_stores: TenantInventory["objectStores"] }>(session.token, sid, "dms_list_object_stores"),
    ]);

    if (srcRes.status === "fulfilled") inventory.sources = srcRes.value.sources ?? [];
    if (connRes.status === "fulfilled") inventory.connections = connRes.value.connections ?? [];
    if (runRes.status === "fulfilled") inventory.runs = runRes.value.runs ?? [];
    if (storeRes.status === "fulfilled") inventory.objectStores = storeRes.value.object_stores ?? [];
  } catch (err) {
    inventory.loadError = err instanceof Error ? err.message : String(err);
  }

  return inventory;
}
