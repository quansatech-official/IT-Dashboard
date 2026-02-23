import { useEffect, useState } from "react";
import { Plus, Shield, Sparkles, TrendingDown } from "lucide-react";

const API = "/api";

const stateBadgeClass = (state) => {
  if (state === "RISK") return "border-rose-200 bg-rose-50 text-rose-700";
  if (state === "ATTENTION") return "border-amber-200 bg-amber-50 text-amber-700";
  if (state === "POTENTIAL") return "border-sky-200 bg-sky-50 text-sky-700";
  if (state === "INACTIVE") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

const InlineSpinner = () => (
  <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
);

export default function CustomerDevelopmentCustomerTab({ customerId, customerName, customerNumber }) {
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState("idle");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiActionKey, setAiActionKey] = useState("");
  const [aiMode, setAiMode] = useState("summary");
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");
  const aiActions = [
    { mode: "summary", label: "Summary" },
    { mode: "mail", label: "Mail" },
    { mode: "leitfaden", label: "Leitfaden" },
    { mode: "analyse", label: "Analyse" },
    { mode: "angebot", label: "Angebot" },
    { mode: "kundenbericht", label: "Bericht" },
    { mode: "newsletter", label: "Newsletter" },
  ];

  const load = async () => {
    if (!customerId) return;
    setStatus("loading");
    try {
      const response = await fetch(`${API}/customers/${customerId}/development`);
      if (!response.ok) throw new Error("load_failed");
      const data = await response.json();
      setContext(data || null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, [customerId]);

  const createTask = async (recommendation) => {
    const title = window.prompt(
      "Aufgabentitel",
      `${customerName}: ${recommendation?.title || "Kundenentwicklung Follow-up"}`
    );
    if (!title || !title.trim()) return;
    await fetch(`${API}/day_tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        customer: customerName || "",
        customer_number: customerNumber || "",
        status: "todo"
      })
    });
  };

  const runAiAssist = async (mode = "summary") => {
    if (!customerId) return;
    const actionKey = `${Number(customerId || 0)}:${String(mode || "summary").toLowerCase()}`;
    setAiActionKey(actionKey);
    setAiMode(mode);
    setAiBusy(true);
    setAiError("");
    setAiText("");
    try {
      const response = await fetch(`${API}/customer_development/ai_assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          mode
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "KI Vorschlag fehlgeschlagen");
      setAiText(data?.text || "");
    } catch (error) {
      setAiError(error?.message ? String(error.message) : "KI Vorschlag fehlgeschlagen");
    } finally {
      setAiBusy(false);
      setAiActionKey("");
    }
  };

  const isAiActionRunning = (mode) =>
    Boolean(aiBusy) &&
    aiActionKey === `${Number(customerId || 0)}:${String(mode || "summary").toLowerCase()}`;

  if (!customerId) {
    return <p className="text-sm text-sand-500">Kein Kunde ausgewählt.</p>;
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Kundenentwicklung konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Kundenentwicklung</p>
          <h3 className="text-lg font-display text-sand-900">Status & Empfehlungen</h3>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
        >
          Aktualisieren
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Entwicklungsstatus</p>
          <div className="mt-1">
            <span
              className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${stateBadgeClass(
                context?.developmentState
              )}`}
            >
              {context?.developmentState || "STABLE"}
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Risiko</p>
          <p className="text-lg font-metrics text-sand-900">{context?.riskScore ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Umsatztrend</p>
          <p className={`text-lg font-metrics ${Number(context?.revenueTrendPct || 0) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {Number(context?.revenueTrendPct || 0) > 0 ? "+" : ""}
            {Number(context?.revenueTrendPct || 0).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Infrastruktur</p>
          <p className="text-sm text-sand-700">
            {(context?.infra?.unmanagedCount || 0)} unmanaged · {Math.round((context?.infra?.coverageRatio || 0) * 100)}% Coverage
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sand-700 mb-2">
          <Shield size={15} />
          <p className="text-sm uppercase tracking-[0.2em] text-sand-500">Begründung</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(context?.reasons || context?.signals || []).length ? (
            (context?.reasons || context?.signals || []).map((reason, idx) => (
              <span key={`${reason}-${idx}`} className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1 text-xs text-sand-700">
                {reason}
              </span>
            ))
          ) : (
            <p className="text-sm text-sand-500">Keine kritischen Signale.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sand-700 mb-2">
          <TrendingDown size={15} />
          <p className="text-sm uppercase tracking-[0.2em] text-sand-500">Empfehlungen</p>
        </div>
        <div className="space-y-2">
          {(context?.recommendations || context?.topRecommendations || []).length ? (
            (context?.recommendations || context?.topRecommendations || []).map((rec, idx) => (
              <div key={`${rec?.title || "rec"}-${idx}`} className="rounded-2xl border border-sand-200 bg-sand-50 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sand-800">{rec?.title || "Empfehlung"}</p>
                    <p className="text-xs text-sand-500 mt-0.5">{rec?.why || ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => createTask(rec)}
                    className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <Plus size={12} /> Aufgabe
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-sand-500">Keine Empfehlungen vorhanden.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-sand-500">KI Assist</p>
          <div className="flex flex-wrap gap-2">
            {aiActions.map((entry) => {
              const running = isAiActionRunning(entry.mode);
              return (
                <button
                  key={entry.mode}
                  type="button"
                  onClick={() => runAiAssist(entry.mode)}
                  disabled={aiBusy}
                  className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-wait disabled:opacity-70"
                >
                  {running ? <InlineSpinner /> : <Sparkles size={12} />}
                  {running ? "Lädt..." : entry.label}
                </button>
              );
            })}
          </div>
        </div>
        {aiBusy ? <p className="mt-2 text-sm text-sand-500">KI generiert Vorschlag…</p> : null}
        {aiError ? <p className="mt-2 text-sm text-rose-600">{aiError}</p> : null}
        {aiText ? (
          <textarea
            readOnly
            value={aiText}
            className="mt-2 w-full min-h-[180px] rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-800"
          />
        ) : (
          !aiBusy && <p className="mt-2 text-sm text-sand-500">Noch kein KI-Vorschlag geladen ({aiMode}).</p>
        )}
      </div>
    </div>
  );
}
