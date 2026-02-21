import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, Plus, Shield, TrendingDown, Users } from "lucide-react";

const API = "/api";

const stateBadgeClass = (state) => {
  if (state === "RISK") return "border-rose-200 bg-rose-50 text-rose-700";
  if (state === "ATTENTION") return "border-amber-200 bg-amber-50 text-amber-700";
  if (state === "POTENTIAL") return "border-sky-200 bg-sky-50 text-sky-700";
  if (state === "INACTIVE") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const formatPct = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0%";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
};

export default function CustomerDevelopmentView() {
  const [contexts, setContexts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [filters, setFilters] = useState({
    noContract: false,
    revenueFalling: false,
    highCommunication: false,
    infraRisk: false,
    recommendationNeedle: ""
  });

  const load = async () => {
    setStatus("loading");
    try {
      const response = await fetch(
        `${API}/customer_development?include_inactive=${includeInactive ? "1" : "0"}`
      );
      if (!response.ok) throw new Error("load_failed");
      const data = await response.json();
      setContexts(Array.isArray(data?.contexts) ? data.contexts : []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, [includeInactive]);

  const filteredContexts = useMemo(() => {
    return contexts.filter((item) => {
      if (filters.noContract && item.hasMaintenanceContract) return false;
      if (filters.revenueFalling && Number(item.revenueTrendPct || 0) >= 0) return false;
      if (filters.highCommunication && Number(item.communicationLoad || 0) < 120) return false;
      if (filters.infraRisk && Number(item.infrastructureRisk || 0) < 25) return false;
      const needle = String(filters.recommendationNeedle || "").trim().toLowerCase();
      if (needle) {
        const inTop = (item.topRecommendations || []).some((rec) =>
          `${rec?.title || ""} ${rec?.type || ""}`.toLowerCase().includes(needle)
        );
        if (!inTop) return false;
      }
      return true;
    });
  }, [contexts, filters]);

  const createTask = async (context) => {
    const title = window.prompt(
      "Aufgabentitel",
      `${context.customerName}: ${context.topRecommendations?.[0]?.title || "Follow-up Kundenentwicklung"}`
    );
    if (!title || !title.trim()) return;
    await fetch(`${API}/day_tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        customer: context.customerName || "",
        customer_number: context.customerNumber || "",
        status: "todo"
      })
    });
  };

  const grouped = useMemo(() => {
    const groups = { STABLE: [], POTENTIAL: [], ATTENTION: [], RISK: [], INACTIVE: [] };
    filteredContexts.forEach((item) => {
      const key = groups[item.developmentState] ? item.developmentState : "STABLE";
      groups[key].push(item);
    });
    return groups;
  }, [filteredContexts]);

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Kundenentwicklung</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-sand-500">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-full border px-3 py-1 uppercase tracking-wide ${
                viewMode === "list"
                  ? "border-sand-900 bg-sand-900 text-white"
                  : "border-sand-200 bg-white text-sand-600"
              }`}
            >
              Liste
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`rounded-full border px-3 py-1 uppercase tracking-wide ${
                viewMode === "board"
                  ? "border-sand-900 bg-sand-900 text-white"
                  : "border-sand-200 bg-white text-sand-600"
              }`}
            >
              Board
            </button>
            <button
              type="button"
              onClick={load}
              className="rounded-full border border-sand-200 bg-white px-3 py-1 uppercase tracking-wide"
            >
              Aktualisieren
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-5 space-y-4">
        <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                className="h-4 w-4"
              />
              Inaktive anzeigen
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.noContract}
                onChange={(event) => setFilters((prev) => ({ ...prev, noContract: event.target.checked }))}
                className="h-4 w-4"
              />
              Ohne Vertrag
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.revenueFalling}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, revenueFalling: event.target.checked }))
                }
                className="h-4 w-4"
              />
              Umsatz sinkt
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.highCommunication}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, highCommunication: event.target.checked }))
                }
                className="h-4 w-4"
              />
              Hohe Kommunikationslast
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={filters.infraRisk}
                onChange={(event) => setFilters((prev) => ({ ...prev, infraRisk: event.target.checked }))}
                className="h-4 w-4"
              />
              Infrastruktur-Risiko
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Empfehlung enthält</span>
              <input
                value={filters.recommendationNeedle}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, recommendationNeedle: event.target.value }))
                }
                placeholder="z. B. Security"
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
              />
            </label>
          </div>
        </section>

        {status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Kundenentwicklung konnte nicht geladen werden.
          </div>
        ) : null}

        {viewMode === "list" ? (
          <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="text-sand-500 uppercase tracking-[0.2em]">
                  <th className="py-2 pr-3">Kunde</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Priorität</th>
                  <th className="py-2 pr-3">Umsatztrend</th>
                  <th className="py-2 pr-3">Infra</th>
                  <th className="py-2 pr-3">Top-Empfehlung</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredContexts.map((item) => (
                  <tr key={item.customerId} className="border-t border-sand-100">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-sand-800">{item.customerName || "Unbekannt"}</div>
                      <div className="text-sand-500">{item.customerNumber || "ohne Nr."}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${stateBadgeClass(item.developmentState)}`}>
                        {item.developmentState}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-metrics">{item.priority}</td>
                    <td className="py-2 pr-3">
                      <span className={Number(item.revenueTrendPct) < 0 ? "text-rose-600" : "text-emerald-700"}>
                        {formatPct(item.revenueTrendPct)}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <Shield size={12} className="text-sand-400" />
                        {Math.round((item.infra?.coverageRatio || 0) * 100)}% · {item.infra?.unmanagedCount || 0} unmg.
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-sand-700">{item.topRecommendations?.[0]?.title || "-"}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => createTask(item)}
                        className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 hover:bg-sand-100"
                      >
                        <Plus size={12} /> Aufgabe
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredContexts.length && status !== "loading" ? (
              <p className="mt-3 text-xs text-sand-500">Keine Treffer für die aktuelle Filterung.</p>
            ) : null}
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {Object.entries(grouped).map(([state, items]) => (
              <div key={state} className="rounded-3xl border border-sand-200 bg-white p-3 shadow-soft min-h-[260px]">
                <div className="mb-2 flex items-center justify-between">
                  <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${stateBadgeClass(state)}`}>
                    {state}
                  </span>
                  <span className="text-[11px] text-sand-500">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.customerId} className="rounded-2xl border border-sand-200 bg-sand-50 p-2">
                      <p className="text-xs font-semibold text-sand-800">{item.customerName}</p>
                      <p className="text-[11px] text-sand-500">Prio {item.priority}</p>
                      <div className="mt-1 text-[11px] text-sand-600">{item.topRecommendations?.[0]?.title || "-"}</div>
                    </div>
                  ))}
                  {!items.length ? <p className="text-[11px] text-sand-400">Keine Kunden</p> : null}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sand-700">
            <ArrowDownUp size={14} />
            <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Hinweise</p>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-2 text-xs text-sand-600">
            <div className="rounded-2xl border border-sand-200 bg-sand-50 p-2">
              <p className="font-semibold text-sand-700">Business-Signale</p>
              <p>Umsatztrend, Aufgabenlast, Kommunikationslast, Vertragslage.</p>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-sand-50 p-2">
              <p className="font-semibold text-sand-700">Infrastruktur-Signale</p>
              <p>Tactical RMM + Discovery-Snapshot (SNMP/Ping Agent) als Frühindikator.</p>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-sand-500 flex items-center gap-2">
            <Users size={12} />
            {filteredContexts.length} Kunden in der aktuellen Sicht
            <AlertTriangle size={12} />
            Empfehlungen sind heuristisch (Phase 1)
          </div>
        </section>
      </main>
    </div>
  );
}
