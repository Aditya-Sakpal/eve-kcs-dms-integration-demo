import type { TenantInventory } from "../types";

interface Props {
  inventory: TenantInventory | null;
  loading: boolean;
  onRefresh: () => void;
}

export function Sidebar({ inventory, loading, onRefresh }: Props) {
  return (
    <aside className="w-96 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-5 text-sm">
      <h2 className="mb-1 text-base font-semibold text-slate-900">What's in your tenant</h2>
      <p className="mb-4 text-xs text-slate-500">
        Live snapshot from DMS. Ask the agent questions about the items below.
      </p>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="mb-5 inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        {loading ? "Refreshing…" : "↻ Refresh inventory"}
      </button>

      {inventory?.loadError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <div className="font-semibold">Could not load inventory</div>
          <div className="mt-1 font-mono">{inventory.loadError}</div>
        </div>
      )}

      <SectionConnections inventory={inventory} />
      <SectionSources inventory={inventory} />
      <SectionRuns inventory={inventory} />
      <SectionObjectStores inventory={inventory} />
      <SectionConcepts />
    </aside>
  );
}

function SectionConnections({ inventory }: { inventory: TenantInventory | null }) {
  const conns = inventory?.connections ?? [];
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Connections ({conns.length})
      </h3>
      {conns.length === 0 && <EmptyHint text="No connections yet." />}
      <ul className="space-y-2">
        {conns.map((c) => (
          <li key={c.id} className="rounded border border-slate-200 bg-white p-2">
            <div className="font-medium text-slate-900">{c.name ?? c.id}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {c.status && <Pill>{c.status}</Pill>}
              {c.schedule && <Pill>{c.schedule}</Pill>}
              {c.update_method && <Pill>{c.update_method}</Pill>}
            </div>
            {Array.isArray(c.streams) && c.streams.length > 0 && (
              <div className="mt-1 text-xs text-slate-600">
                <span className="text-slate-400">streams:</span>{" "}
                {(c.streams as string[]).join(", ")}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionSources({ inventory }: { inventory: TenantInventory | null }) {
  const sources = inventory?.sources ?? [];
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Sources ({sources.length})
      </h3>
      {sources.length === 0 && <EmptyHint text="No sources." />}
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id ?? s.name} className="rounded border border-slate-200 bg-white p-2">
            <div className="font-medium text-slate-900">{s.name ?? s.id}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {s.connector_type && <Pill>{s.connector_type}</Pill>}
              {s.status && <Pill>{s.status}</Pill>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionRuns({ inventory }: { inventory: TenantInventory | null }) {
  const runs = inventory?.runs ?? [];
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Recent sync runs ({runs.length})
      </h3>
      {runs.length === 0 && <EmptyHint text="No runs recorded." />}
      <ul className="space-y-1.5">
        {runs.map((r, i) => (
          <li key={r.id ?? i} className="rounded border border-slate-200 bg-white p-2 text-xs">
            <div className="font-medium text-slate-800">
              {r.connection_name ?? r.connection_id ?? "(unknown)"}
            </div>
            <div className="mt-0.5 flex flex-wrap gap-1 text-slate-500">
              {r.status && <Pill>{r.status}</Pill>}
              {r.started_at && <span>{r.started_at}</span>}
              {typeof r.duration_ms === "number" && (
                <span>· {Math.round(r.duration_ms / 1000)}s</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionObjectStores({ inventory }: { inventory: TenantInventory | null }) {
  const stores = inventory?.objectStores ?? [];
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Object stores ({stores.length})
      </h3>
      {stores.length === 0 && <EmptyHint text="None registered." />}
      <ul className="space-y-1">
        {stores.map((s, i) => (
          <li key={s.id ?? i} className="rounded border border-slate-200 bg-white p-2 text-xs">
            {s.name ?? s.bucket ?? "(unknown)"}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionConcepts() {
  return (
    <section className="mb-3 mt-6 rounded border border-slate-200 bg-white p-3 text-xs">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        How the agent thinks
      </h3>
      <p className="mb-2 text-slate-700">
        The router picks one of three DMS skills based on intent:
      </p>
      <ul className="space-y-1.5 text-slate-700">
        <li>
          <span className="font-mono font-semibold text-emerald-700">dms-explore</span> — list
          connections / sources / runs. Read-only.
        </li>
        <li>
          <span className="font-mono font-semibold text-blue-700">dms-preview</span> — schema +
          row samples for an ingested stream.
        </li>
        <li>
          <span className="font-mono font-semibold text-amber-700">dms-sync</span> — trigger,
          poll, cancel sync runs.
        </li>
      </ul>
      <p className="mt-2 text-slate-600">
        <span className="font-semibold">Not available:</span> create / delete / decrypt credentials
        — the agent will refuse and point you to the admin UI.
      </p>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
      {children}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="text-xs italic text-slate-400">{text}</div>;
}
