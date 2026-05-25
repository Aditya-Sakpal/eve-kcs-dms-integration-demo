import type { AuthSession } from "../types";

// Hardcoded test credentials — matches what test-dms-mcp.ps1 uses for `-Target deployed`.
// Safe for this demo because the bundle never ships to a public origin (Vite dev server
// only). If you ever deploy this UI, switch to a real login form.
const TEST_EMAIL = "test-admin@example.com";
const TEST_PASSWORD = "AdminPass123!";

export async function login(): Promise<AuthSession> {
  const resp = await fetch("/api/core-tenant/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Login failed: HTTP ${resp.status} ${resp.statusText} — ${text}`);
  }

  const data = await resp.json();
  if (!data.access_token || !data.tenant_id) {
    throw new Error("Login response missing access_token or tenant_id");
  }

  return { token: data.access_token, tenantId: data.tenant_id };
}
