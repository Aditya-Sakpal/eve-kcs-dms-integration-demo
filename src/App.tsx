import { useCallback, useEffect, useState } from "react";
import { login } from "./api/auth";
import { fetchTenantInventory } from "./api/dms";
import { Chat } from "./components/Chat";
import { SampleQuestions } from "./components/SampleQuestions";
import { Sidebar } from "./components/Sidebar";
import type { AuthSession, ChatPayloadDefaults, TenantInventory } from "./types";

const DEFAULTS: ChatPayloadDefaults = { maxLoops: 8, maxTokens: 1500 };

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<TenantInventory | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [defaults, setDefaults] = useState<ChatPayloadDefaults>(DEFAULTS);
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());
  const [pendingPrompt, setPendingPrompt] = useState<string>("");

  // Auto-login on mount.
  useEffect(() => {
    let cancelled = false;
    login()
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setAuthError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setAuthError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Inventory load once we have a session.
  const refreshInventory = useCallback(async () => {
    if (!session) return;
    setInvLoading(true);
    try {
      const inv = await fetchTenantInventory(session);
      setInventory(inv);
    } finally {
      setInvLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) refreshInventory();
  }, [session, refreshInventory]);

  if (authError) {
    return (
      <FullPage>
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <div className="mb-2 font-semibold">Could not log in</div>
          <div className="mb-3 font-mono text-xs">{authError}</div>
          <div className="text-xs text-red-600">
            Check that the Vite dev server proxy reaches{" "}
            <span className="font-mono">dev.api.eveaix.com</span>, and that the test-admin
            credentials in <span className="font-mono">src/api/auth.ts</span> are still valid.
          </div>
        </div>
      </FullPage>
    );
  }

  if (!session) {
    return (
      <FullPage>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          Signing in as test-admin…
        </div>
      </FullPage>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <Header tenantId={session.tenantId} />
      <SampleQuestions onPick={setPendingPrompt} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar inventory={inventory} loading={invLoading} onRefresh={refreshInventory} />
        <Chat
          session={session}
          defaults={defaults}
          onDefaultsChange={setDefaults}
          sessionId={sessionId}
          onNewSession={() => setSessionId(crypto.randomUUID())}
          pendingPrompt={pendingPrompt}
          onPromptConsumed={() => setPendingPrompt("")}
        />
      </div>
    </div>
  );
}

function Header({ tenantId }: { tenantId: string }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">EVE KCS Integration Demo</h1>
        <p className="text-xs text-slate-500">
          Talks to deployed KCS &rarr; DMS via{" "}
          <span className="font-mono">dev.api.eveaix.com</span>
        </p>
      </div>
      <div className="text-xs text-slate-500">
        Signed in to tenant{" "}
        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
          {tenantId}
        </span>
      </div>
    </header>
  );
}

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 p-6">{children}</div>
  );
}
