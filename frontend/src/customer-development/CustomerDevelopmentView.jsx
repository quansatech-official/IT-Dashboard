import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, Eye, Plus, Shield, TrendingDown, Users, X } from "lucide-react";

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

const formatEur = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "€ 0";
  return `€ ${n.toLocaleString("de-DE", { maximumFractionDigits: 0 })}`;
};

const clampPercent = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
};

const ratioToPercent = (ratio) => {
  const n = Number(ratio || 0);
  if (!Number.isFinite(n)) return 0;
  return clampPercent(n <= 1 ? n * 100 : n);
};

const revenueComparisonPercents = (lastYear, currentYear) => {
  const last = Math.max(0, Number(lastYear || 0));
  const current = Math.max(0, Number(currentYear || 0));
  if (!Number.isFinite(last) || !Number.isFinite(current)) {
    return { lastPct: 0, currentPct: 0 };
  }
  if (last <= 0 && current <= 0) {
    return { lastPct: 0, currentPct: 0 };
  }
  if (last <= 0) {
    return { lastPct: 0, currentPct: 100 };
  }
  return {
    lastPct: 100,
    currentPct: clampPercent((current / last) * 100),
  };
};

export default function CustomerDevelopmentView() {
  const aiModes = [
    { value: "angebot", label: "Angebot" },
    { value: "kundenbericht", label: "Kundenbericht" },
    { value: "mail", label: "Mail" },
    { value: "leitfaden", label: "Leitfaden" },
    { value: "analyse", label: "Analyse" },
    { value: "summary", label: "Summary" }
  ];
  const [contexts, setContexts] = useState([]);
  const [status, setStatus] = useState("idle");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [aiBusy, setAiBusy] = useState(false);
  const [detailAi, setDetailAi] = useState({
    open: false,
    customerId: null,
    customerName: "",
    mode: "angebot",
    text: "",
    error: ""
  });
  const [detailModal, setDetailModal] = useState({
    open: false,
    customerId: null,
    customerName: ""
  });
  const [detailTab, setDetailTab] = useState("overview");
  const [detailStatus, setDetailStatus] = useState("idle");
  const [detailData, setDetailData] = useState(null);
  const [cveScan, setCveScan] = useState({
    status: "idle",
    scannedSoftware: 0,
    matchedAgents: 0,
    agents: [],
    fromCache: false,
    error: ""
  });
  const [reportSuggestion, setReportSuggestion] = useState({
    status: "idle",
    title: "",
    text: "",
    error: ""
  });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [filters, setFilters] = useState({
    noContract: false,
    revenueFalling: false,
    highCommunication: false,
    infraRisk: false,
    recommendationNeedle: ""
  });

  const load = async (forceRefresh = false) => {
    setStatus("loading");
    setLoadingProgress(6);
    try {
      const response = await fetch(
        `${API}/customer_development?include_inactive=${includeInactive ? "1" : "0"}&refresh=${forceRefresh ? "1" : "0"}`
      );
      if (!response.ok) throw new Error("load_failed");
      setLoadingProgress((prev) => Math.max(prev, 72));
      const data = await response.json();
      setLoadingProgress((prev) => Math.max(prev, 96));
      setContexts(Array.isArray(data?.contexts) ? data.contexts : []);
      setLoadingProgress(100);
      // Keep overlay briefly so the progress bar visually reaches 100%.
      window.setTimeout(() => setStatus("ready"), 180);
    } catch {
      setLoadingProgress(100);
      window.setTimeout(() => setStatus("error"), 180);
    }
  };

  useEffect(() => {
    load(false);
  }, [includeInactive]);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 92) return prev;
        const step = prev < 30 ? 8 : prev < 60 ? 5 : 3;
        return Math.min(92, prev + step);
      });
    }, 160);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (!detailModal.open || !detailModal.customerId) return;
    loadDetail(false);
  }, [detailModal.open, detailModal.customerId]);

  const loadDetail = (forceRefresh = false) => {
    if (!detailModal.open || !detailModal.customerId) return;
    setDetailStatus("loading");
    fetch(`${API}/customers/${detailModal.customerId}/development?refresh=${forceRefresh ? "1" : "0"}`)
      .then((res) => {
        if (!res.ok) throw new Error("detail_failed");
        return res.json();
      })
      .then((data) => {
        setDetailData(data || null);
        setDetailStatus("ready");
      })
      .catch(() => {
        setDetailStatus("error");
      });
  };

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

  const createTask = async () => {
    if (!detailModal.customerId) return;
    const suggestionTitle =
      detailData?.topRecommendations?.[0]?.title ||
      detailData?.recommendations?.[0]?.title ||
      "Follow-up Kundenentwicklung";
    const title = window.prompt(
      "Aufgabentitel",
      `${detailModal.customerName || "Kunde"}: ${suggestionTitle}`
    );
    if (!title || !title.trim()) return;
    await fetch(`${API}/day_tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        customer: detailModal.customerName || "",
        customer_number: detailData?.customerNumber || "",
        status: "todo"
      })
    });
  };

  const runAiAssist = async (mode) => {
    if (!detailModal.customerId && mode !== "newsletter") return;
    setAiBusy(true);
    setDetailAi((prev) => ({
      open: true,
      customerId: detailModal.customerId,
      customerName: detailModal.customerName || "",
      mode,
      text: "",
      error: ""
    }));
    try {
      const response = await fetch(`${API}/customer_development/ai_assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "newsletter"
            ? { mode }
            : {
                customer_id: detailModal.customerId,
                mode
              }
        )
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "KI Vorschlag fehlgeschlagen");
      }
      setDetailAi((prev) => ({
        ...prev,
        open: true,
        customerId: detailModal.customerId,
        customerName: detailModal.customerName || "",
        mode: data?.mode || mode,
        text: data?.text || "",
        error: ""
      }));
    } catch (error) {
      setDetailAi((prev) => ({
        ...prev,
        open: true,
        customerId: detailModal.customerId,
        customerName: detailModal.customerName || "",
        mode,
        text: "",
        error: error?.message ? String(error.message) : "KI Vorschlag fehlgeschlagen"
      }));
    } finally {
      setAiBusy(false);
    }
  };

  const openDetail = (context) => {
    setDetailData(null);
    setDetailStatus("idle");
    setDetailTab("overview");
    setCveScan({
      status: "idle",
      scannedSoftware: 0,
      matchedAgents: 0,
      agents: [],
      fromCache: false,
      error: ""
    });
    setReportSuggestion({ status: "idle", title: "", text: "", error: "" });
    setDetailAi({
      open: false,
      customerId: context.customerId,
      customerName: context.customerName || "",
      mode: "angebot",
      text: "",
      error: ""
    });
    setDetailModal({
      open: true,
      customerId: context.customerId,
      customerName: context.customerName || ""
    });
  };

  const closeDetail = () => {
    setDetailModal({ open: false, customerId: null, customerName: "" });
    setDetailData(null);
    setDetailStatus("idle");
    setDetailTab("overview");
    setCveScan({
      status: "idle",
      scannedSoftware: 0,
      matchedAgents: 0,
      agents: [],
      fromCache: false,
      error: ""
    });
    setReportSuggestion({ status: "idle", title: "", text: "", error: "" });
    setDetailAi({
      open: false,
      customerId: null,
      customerName: "",
      mode: "angebot",
      text: "",
      error: ""
    });
  };

  const previewReportSuggestion = async (recommendationIndex) => {
    if (!detailModal.customerId) return;
    setReportSuggestion({ status: "loading", title: "", text: "", error: "" });
    try {
      const response = await fetch(`${API}/customer_development/report_suggestion_preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: detailModal.customerId,
          recommendation_index: recommendationIndex
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail || "Vorschau konnte nicht geladen werden");
      }
      setReportSuggestion({
        status: "ready",
        title: data?.suggestion?.title || "Berichtsvorschlag",
        text: data?.suggestion?.preview_text || "",
        error: ""
      });
    } catch (error) {
      setReportSuggestion({
        status: "error",
        title: "",
        text: "",
        error: error?.message ? String(error.message) : "Vorschau konnte nicht geladen werden"
      });
    }
  };

  const runCveScan = async (forceRefresh = true) => {
    if (!detailModal.customerId) return;
    setCveScan({
      status: "loading",
      scannedSoftware: 0,
      matchedAgents: 0,
      agents: [],
      fromCache: false,
      error: ""
    });
    try {
      const response = await fetch(
        `${API}/customers/${detailModal.customerId}/development/cve_scan?refresh=${forceRefresh ? "1" : "0"}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "CVE Analyse fehlgeschlagen");
      setCveScan({
        status: "ready",
        scannedSoftware: Number(data?.scannedSoftware || 0),
        matchedAgents: Number(data?.matchedAgents || 0),
        agents: Array.isArray(data?.agents) ? data.agents : [],
        fromCache: Boolean(data?.fromCache),
        error: ""
      });
    } catch (error) {
      setCveScan({
        status: "error",
        scannedSoftware: 0,
        matchedAgents: 0,
        agents: [],
        fromCache: false,
        error: error?.message ? String(error.message) : "CVE Analyse fehlgeschlagen"
      });
    }
  };

  const grouped = useMemo(() => {
    const groups = { STABLE: [], POTENTIAL: [], ATTENTION: [], RISK: [], INACTIVE: [] };
    filteredContexts.forEach((item) => {
      const key = groups[item.developmentState] ? item.developmentState : "STABLE";
      groups[key].push(item);
    });
    return groups;
  }, [filteredContexts]);

  const revenueBars = revenueComparisonPercents(
    detailData?.revenueLastYearEur,
    detailData?.revenueCurrentYearEur
  );

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      {detailModal.open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-sand-900/40 px-4 pt-5 pb-8">
          <div className="w-full max-w-6xl rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Details</p>
                <h3 className="text-lg font-display text-sand-900">
                  {detailModal.customerName || "Kunde"} · Kundenanalyse
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                title="Schließen"
              >
                <X size={14} />
              </button>
            </div>
            <div className="border-b border-sand-200 bg-white px-5 py-2">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "overview", label: "Übersicht" },
                  { id: "ki", label: "KI Auswertung" },
                  { id: "infra", label: "Infrastruktur" },
                  { id: "cve", label: "CVE Analyse" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDetailTab(tab.id)}
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                      detailTab === tab.id
                        ? "border-sand-900 bg-sand-900 text-white"
                        : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[83vh] overflow-auto p-5 bg-sand-50">
              {detailStatus === "loading" ? (
                <p className="text-sm text-sand-500">Lade Analytics…</p>
              ) : detailStatus === "error" ? (
                <p className="text-sm text-rose-600">Details konnten nicht geladen werden.</p>
              ) : detailData ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-sand-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Aktionen</p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={createTask}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                        >
                          <Plus size={12} /> Aufgabe
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetailTab("ki")}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                        >
                          KI Auswertung
                        </button>
                      </div>
                    </div>
                  </div>

                  {detailTab === "ki" ? (
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">KI Auswertung</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {aiModes.map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => runAiAssist(item.value)}
                              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${
                                detailAi.mode === item.value
                                  ? "border-sand-900 bg-sand-900 text-white"
                                  : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        {aiBusy ? <p className="text-sm text-sand-500">KI generiert Vorschlag…</p> : null}
                        {detailAi.error ? <p className="text-sm text-rose-600">{detailAi.error}</p> : null}
                        <textarea
                          readOnly
                          value={detailAi.text}
                          placeholder={`Vorschlag für "${detailAi.mode}" erscheint hier nach Auswahl.`}
                          className="w-full min-h-[160px] rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-800"
                        />
                      </div>
                    </div>
                  ) : null}

                  {detailTab === "overview" && reportSuggestion.status !== "idle" ? (
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">
                        Berichtsvorschau (ohne Änderung am Kundenbericht)
                      </p>
                      {reportSuggestion.status === "loading" ? (
                        <p className="mt-2 text-sm text-sand-500">Erzeuge Vorschau…</p>
                      ) : null}
                      {reportSuggestion.error ? (
                        <p className="mt-2 text-sm text-rose-600">{reportSuggestion.error}</p>
                      ) : null}
                      {reportSuggestion.status === "ready" && !reportSuggestion.error ? (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm font-semibold text-sand-800">{reportSuggestion.title}</p>
                          <textarea
                            readOnly
                            value={reportSuggestion.text}
                            className="w-full min-h-[130px] rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-800"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {detailTab === "overview" ? (
                  <>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Status</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${stateBadgeClass(detailData.developmentState)}`}>
                        {detailData.developmentState || "STABLE"}
                      </span>
                    </div>
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Risiko</p>
                      <p className="text-lg font-metrics">{detailData.riskScore ?? 0}/100</p>
                    </div>
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Priorität</p>
                      <p className="text-lg font-metrics">{detailData.priority ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Vertrag</p>
                      <p className="text-sm text-sand-700">
                        {detailData.hasMaintenanceContract ? "vorhanden" : "kein Vertrag"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Umsatzvergleich</p>
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-sand-600">
                            <span>Vorjahr</span>
                            <span>{formatEur(detailData.revenueLastYearEur)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-sand-100">
                            <div
                              className="h-2 rounded-full bg-sand-500"
                              style={{
                                width: `${revenueBars.lastPct}%`
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-sand-600">
                            <span>Aktuelles Jahr</span>
                            <span>{formatEur(detailData.revenueCurrentYearEur)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-sand-100">
                            <div
                              className={`h-2 rounded-full ${
                                Number(detailData.revenueTrendPct || 0) < 0 ? "bg-rose-400" : "bg-emerald-500"
                              }`}
                              style={{
                                width: `${revenueBars.currentPct}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-sand-500">
                        Trend: {formatPct(detailData.revenueTrendPct)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Risikozusammensetzung</p>
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-sand-600">
                            <span>Business Risk</span>
                            <span>{detailData.businessRisk ?? 0}</span>
                          </div>
                          <div className="h-2 rounded-full bg-sand-100">
                            <div
                              className="h-2 rounded-full bg-amber-400"
                              style={{ width: `${clampPercent(detailData.businessRisk)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-sand-600">
                            <span>Infra Risk</span>
                            <span>{detailData.infrastructureRisk ?? 0}</span>
                          </div>
                          <div className="h-2 rounded-full bg-sand-100">
                            <div
                              className="h-2 rounded-full bg-rose-400"
                              style={{ width: `${clampPercent(detailData.infrastructureRisk)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sand-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Infrastruktur Analytics</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-3 text-xs">
                      <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                        <p className="text-sand-500">Coverage</p>
                        <p className="font-semibold text-sand-800">
                          {Math.round(ratioToPercent(detailData.infra?.coverageRatio))}%
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-sand-200">
                          <div
                            className="h-1.5 rounded-full bg-emerald-500"
                            style={{ width: `${ratioToPercent(detailData.infra?.coverageRatio)}%` }}
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                        <p className="text-sand-500">Unmanaged</p>
                        <p className="font-semibold text-sand-800">{detailData.infra?.unmanagedCount || 0}</p>
                      </div>
                      <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                        <p className="text-sand-500">Offline Rate</p>
                        <p className="font-semibold text-sand-800">
                          {Math.round(ratioToPercent(detailData.infra?.offlineRate))}%
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-sand-200">
                          <div
                            className="h-1.5 rounded-full bg-rose-500"
                            style={{ width: `${ratioToPercent(detailData.infra?.offlineRate)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Signale</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(detailData.reasons || detailData.signals || []).length ? (
                          (detailData.reasons || detailData.signals || []).map((signal, idx) => (
                            <span
                              key={`${signal}-${idx}`}
                              className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1 text-xs text-sand-700"
                            >
                              {signal}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-sand-500">Keine besonderen Signale.</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Empfehlungen</p>
                      <div className="mt-2 space-y-2">
                        {(detailData.recommendations || detailData.topRecommendations || []).slice(0, 5).map((rec, idx) => (
                          <div key={`${rec?.title || "r"}-${idx}`} className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                            <p className="text-xs font-semibold text-sand-800">{rec?.title || "Empfehlung"}</p>
                            <p className="text-[11px] text-sand-500">{rec?.why || ""}</p>
                            <button
                              type="button"
                              onClick={() => previewReportSuggestion(idx)}
                              className="mt-2 inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                            >
                              In Bericht vorschlagen
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </>
                  ) : null}

                  {detailTab === "infra" ? (
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Infrastruktur (RMM + Discovery)</p>
                        <button
                          type="button"
                          onClick={() => loadDetail(true)}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                        >
                          Aktualisieren
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-sand-500">
                        Quelle: Tactical RMM Agents + Discovery-Ingest aus RMM-Script (Ping/SNMP).
                      </p>
                      <div className="mt-2 space-y-2">
                        {(detailData.infrastructureDevices || []).length ? (
                          (detailData.infrastructureDevices || []).map((device, idx) => (
                            <div key={`${device?.source || "d"}-${device?.hostname || idx}-${idx}`} className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-700">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold text-sand-800">{device?.hostname || "Unbekanntes Gerät"}</p>
                                <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                  {device?.source === "tactical_rmm" ? "RMM" : device?.source || "Discovery"}
                                </span>
                              </div>
                              <p className="mt-1 text-[11px] text-sand-600">
                                {device?.ip ? `IP ${device.ip}` : "IP n/a"}
                                {device?.mac ? ` · MAC ${device.mac}` : ""}
                                {device?.protocol ? ` · ${String(device.protocol).toUpperCase()}` : ""}
                                {typeof device?.online === "boolean" ? ` · ${device.online ? "Online" : "Offline"}` : ""}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-sand-500">
                            Keine Geräte gefunden. Prüfe RMM-Zuordnung und Discovery-Agent (Ping/SNMP).
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {detailTab === "cve" ? (
                    <div className="rounded-2xl border border-sand-200 bg-white p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-sand-500">CVE Analyse</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => runCveScan(false)}
                            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                          >
                            Cache laden
                          </button>
                          <button
                            type="button"
                            onClick={() => runCveScan(true)}
                            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                          >
                            Neu scannen
                          </button>
                        </div>
                      </div>
                      {cveScan.status === "loading" ? <p className="text-sm text-sand-500">Scanne Software gegen öffentliche CVE-Datenbanken…</p> : null}
                      {cveScan.error ? <p className="text-sm text-rose-600">{cveScan.error}</p> : null}
                      {cveScan.status === "ready" ? (
                        <div className="space-y-2">
                          <p className="text-xs text-sand-500">
                            Geprüfte Software: {cveScan.scannedSoftware} · RMM Agents: {cveScan.matchedAgents}
                            {cveScan.fromCache ? " · aus Cache" : " · live"}
                          </p>
                          {(cveScan.agents || []).length ? (
                            (cveScan.agents || []).map((agent, idx) => (
                              <div key={`${agent?.agentId || idx}`} className="rounded-xl border border-sand-200 bg-sand-50 p-2 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-sand-800">
                                    {agent?.hostname || "Unbekannter Agent"} ({agent?.agentId || "n/a"})
                                  </p>
                                  <span className="text-[10px] text-sand-500">
                                    Findings: {agent?.findingCount || 0} · Software: {agent?.softwareCount || 0}
                                  </span>
                                </div>
                                <p className="text-[11px] text-sand-600">
                                  {agent?.client || "Client n/a"} · {agent?.site || "Site n/a"} ·{" "}
                                  {typeof agent?.online === "boolean" ? (agent.online ? "Online" : "Offline") : "Status n/a"}
                                </p>
                                {(agent?.findings || []).length ? (
                                  <div className="space-y-1">
                                    {(agent.findings || []).map((item, itemIdx) => (
                                      <div key={`${item?.name || "s"}-${itemIdx}`} className="rounded-lg border border-sand-200 bg-white px-2 py-1.5">
                                        <p className="text-xs font-semibold text-sand-800">
                                          {item?.name || "Software"} {item?.version ? `(${item.version})` : ""}
                                        </p>
                                        <p className="text-[11px] text-sand-600">
                                          CVEs: {(item?.cves || []).map((cve) => cve?.id).filter(Boolean).join(", ") || "keine"}
                                        </p>
                                        <p className="text-[11px] text-sand-600">
                                          Neuere/Fix-Versionen: {(item?.fixedVersions || []).join(", ") || "keine Daten"}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-sand-500">Keine Treffer auf diesem Agent.</p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-sand-500">Keine CVE-Treffer in den geprüften Einträgen gefunden.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
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
              onClick={() => load(true)}
              className="rounded-full border border-sand-200 bg-white px-3 py-1 uppercase tracking-wide"
            >
              Aktualisieren
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-5 space-y-4">
        {status === "loading" ? (
          <section className="rounded-3xl border border-sand-200 bg-sand-100/70 p-8 shadow-soft min-h-[220px] flex items-center justify-center">
            <div className="w-full max-w-md space-y-3">
              <p className="text-center text-xs uppercase tracking-[0.25em] text-sand-500">
                Daten werden gesammelt
              </p>
              <div className="relative h-3 rounded-full bg-sand-200 border border-sand-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-sand-500 transition-[width] duration-150"
                  style={{ width: `${Math.max(0, Math.min(100, loadingProgress))}%` }}
                />
              </div>
              <p className="text-center text-sm font-semibold text-sand-700">
                {Math.max(0, Math.min(100, Math.round(loadingProgress)))}%
              </p>
            </div>
          </section>
        ) : null}

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
                        {Math.round(ratioToPercent(item.infra?.coverageRatio))}% · {item.infra?.unmanagedCount || 0} unmg.
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-sand-700">{item.topRecommendations?.[0]?.title || "-"}</td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 hover:bg-sand-100"
                      >
                        <Eye size={12} /> Details
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
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="mt-2 inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                      >
                        <Eye size={11} /> Details
                      </button>
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
