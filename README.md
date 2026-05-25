# eve-kcs-demo

React chat UI for showing the deployed KCS ↔ DMS integration to a non-engineer
(your manager). Auto-logs in as the test-admin account, streams the agent's
response live, and pulls a fresh inventory of the tenant's DMS sources /
connections / runs on every page load so the user can see what's available to
ask about.

## Run it

```powershell
cd d:\eve-projects\eve-kcs-demo
npm install
npm run dev
```

Then open http://localhost:5173. You should see:

1. A header showing `Signed in to tenant testtenant`.
2. Sample-question chips grouped by skill (`dms-explore`, `dms-preview`,
   `dms-sync`, plus safety probes).
3. A left sidebar populated with the live inventory pulled from
   `dev.api.eveaix.com/dms/mcp/`.
4. A chat panel with editable `tenant_id`, `session_id`, `max_loops`,
   `max_tokens` defaults.

Click a sample question to load it into the input box, edit if you want, hit
Enter or **Send**. Tool calls render as collapsible boxes inside the assistant
message; click ▸ to inspect the args / result JSON.

## How it talks to the backend

The Vite dev server proxies `/api/*` to `https://dev.api.eveaix.com/*` (see
[`vite.config.ts`](./vite.config.ts)). This sidesteps CORS — the browser sees
the requests as same-origin, the proxy rewrites the path and forwards them.

- `POST /api/core-tenant/api/v1/auth/login` → JWT + tenant_id
- `POST /api/kcs/api/v1/agent/chat` (SSE-ish stream) → assistant turn
- `POST /api/dms/mcp/` (JSON-RPC over HTTP-SSE) → tenant inventory

The KCS stream parser handles the codes documented in
`test-dms-mcp.ps1`'s `Render-StreamLine`: `0` text delta, `b` tool start,
`9` tool args, `a` tool result, `e` finish, `2` agent error.

## Files

| Path | What it does |
|---|---|
| [src/App.tsx](./src/App.tsx) | Top-level layout, auto-login, inventory bootstrap |
| [src/api/auth.ts](./src/api/auth.ts) | Hardcoded login against `/core-tenant/auth/login` |
| [src/api/agent.ts](./src/api/agent.ts) | Streams `/kcs/.../agent/chat` and emits typed events |
| [src/api/dms.ts](./src/api/dms.ts) | MCP session + four parallel `tools/call` probes |
| [src/components/Chat.tsx](./src/components/Chat.tsx) | Input box, message list, defaults bar |
| [src/components/StreamMessage.tsx](./src/components/StreamMessage.tsx) | Renders one user/assistant message + tool boxes |
| [src/components/Sidebar.tsx](./src/components/Sidebar.tsx) | Live tenant inventory + skill cheat-sheet |
| [src/components/SampleQuestions.tsx](./src/components/SampleQuestions.tsx) | Click-to-fill sample prompts grouped by skill |

## Production deploy

Not currently set up. The Vite proxy only works in dev mode. To host this UI
on a public origin you'd need to either:

1. Configure CORS on APISIX so the production-host origin can call
   `dev.api.eveaix.com/*` directly, or
2. Build a thin Node/serverless proxy (`/api/*` → `dev.api.eveaix.com/*`)
   and point the React build at it, or
3. Server-render through a Next.js backend.

Also: `src/api/auth.ts` hardcodes the test-admin credentials. Replace with a
proper login form before any deploy.
