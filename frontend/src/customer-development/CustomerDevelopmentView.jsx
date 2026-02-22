import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Bot,
  Clock3,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  Monitor,
  Plus,
  Printer,
  RefreshCw,
  Router,
  ScanSearch,
  Search,
  Server,
  Shield,
  Sparkles,
  TrendingDown,
  Users,
  X,
} from "lucide-react";

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

const getPriorityTier = (item) => {
  const risk = Number(item?.riskScore || 0);
  const trend = Number(item?.revenueTrendPct || 0);
  const revenueCurrent = Number(item?.revenueCurrentYearEur || 0);
  const daysSince = Number(item?.daysSinceInteraction || 0);
  const contactDue = Boolean(item?.contactDue);
  const daysSinceLastInvoice = Number(item?.daysSinceLastInvoice || 0);
  const invoiceActivityDue = Boolean(item?.invoiceActivityDue);

  if (
    contactDue &&
    (
      daysSince >= 60 ||
      daysSinceLastInvoice >= 75 ||
      invoiceActivityDue ||
      trend < -8 ||
      revenueCurrent <= 1000 ||
      risk >= 60
    )
  ) {
    return {
      key: "red",
      index: 2,
      label: "Aktivieren",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (!contactDue && revenueCurrent > 0 && trend >= 0 && risk < 45) {
    return {
      key: "green",
      index: 0,
      label: "Stabil",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  return {
    key: "amber",
    index: 1,
    label: "Beobachten",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  };
};

const PriorityBar = ({ item }) => {
  const tier = getPriorityTier(item);
  const activeClass =
    tier.key === "green"
      ? "bg-emerald-500 border-emerald-500"
      : tier.key === "amber"
      ? "bg-amber-500 border-amber-500"
      : "bg-rose-500 border-rose-500";
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((idx) => (
          <div
            key={`tier-${idx}`}
            className={`h-2 rounded-full border ${idx === tier.index ? activeClass : "border-sand-200 bg-sand-100"}`}
          />
        ))}
      </div>
      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${tier.badgeClass}`}>
        {tier.label}
      </span>
    </div>
  );
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

const formatDateTime = (value) => {
  if (!value && value !== 0) return "n/a";
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0 ? new Date(numeric) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
};

const getAgentIcon = (device) => {
  const hostname = String(device?.hostname || "").toLowerCase();
  const os = String(device?.os || "").toLowerCase();
  if (hostname.includes("dc") || hostname.includes("srv") || hostname.includes("fs") || hostname.includes("rds")) {
    return Server;
  }
  if (os.includes("server")) return Server;
  return Monitor;
};

const getDiscoveryIcon = (device) => {
  const deviceType = String(device?.deviceType || "").toLowerCase();
  const protocol = String(device?.protocol || "").toLowerCase();
  if (deviceType.includes("printer")) return Printer;
  if (
    deviceType.includes("firewall") ||
    deviceType.includes("router") ||
    deviceType.includes("switch") ||
    deviceType.includes("gateway") ||
    protocol.includes("snmp")
  ) {
    return Router;
  }
  return Cpu;
};

const LoadingProgress = ({ label, progress }) => (
  <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">{label}</p>
      <p className="text-xs font-semibold text-sand-700">{Math.max(0, Math.min(100, Math.round(progress)))}%</p>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded-full border border-sand-200 bg-white">
      <div
        className="h-full rounded-full bg-sand-500 transition-[width] duration-200"
        style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
      />
    </div>
    <div className="mt-2 h-1.5 w-24 rounded-full bg-sand-300 animate-pulse" />
  </div>
);

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
  const [detailProgress, setDetailProgress] = useState(0);
  const [detailData, setDetailData] = useState(null);
  const [aiProgress, setAiProgress] = useState(0);
  const [cveScan, setCveScan] = useState({
    status: "idle",
    scannedSoftware: 0,
    matchedAgents: 0,
    nameOnlyCandidates: 0,
    mappingHint: "",
    agents: [],
    fromCache: false,
    error: ""
  });
  const [discoveryRun, setDiscoveryRun] = useState({
    status: "idle",
    message: "",
    error: "",
  });
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [expandedInfraAgents, setExpandedInfraAgents] = useState({});
  const [cveProgress, setCveProgress] = useState(0);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [viewMode, setViewMode] = useState("list");
  const [filters, setFilters] = useState({
    noContract: false,
    revenueFalling: false,
    highCommunication: false,
    infraRisk: false,
    searchNeedle: ""
  });
  const loadRequestRef = useRef(0);
  const loadAbortRef = useRef(null);

  const load = async (forceRefresh = false) => {
    loadRequestRef.current += 1;
    const requestId = loadRequestRef.current;
    if (loadAbortRef.current) {
      try {
        loadAbortRef.current.abort();
      } catch {
        // ignore stale abort errors
      }
    }
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort("timeout"), 25000);
    setStatus("loading");
    setLoadingProgress(6);
    try {
      const response = await fetch(
        `${API}/customer_development?include_inactive=${includeInactive ? "1" : "0"}&refresh=${forceRefresh ? "1" : "0"}`,
        { signal: controller.signal }
      );
      if (requestId !== loadRequestRef.current) return;
      if (!response.ok) throw new Error("load_failed");
      setLoadingProgress((prev) => Math.max(prev, 72));
      const data = await response.json();
      if (requestId !== loadRequestRef.current) return;
      setLoadingProgress((prev) => Math.max(prev, 96));
      setContexts(Array.isArray(data?.contexts) ? data.contexts : []);
      setLoadingProgress(100);
      // Keep overlay briefly so the progress bar visually reaches 100%.
      window.setTimeout(() => setStatus("ready"), 180);
    } catch {
      if (requestId !== loadRequestRef.current) return;
      setLoadingProgress(100);
      window.setTimeout(() => setStatus("error"), 180);
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === loadRequestRef.current) {
        loadAbortRef.current = null;
      }
    }
  };

  useEffect(() => {
    load(false);
  }, [includeInactive]);

  useEffect(() => {
    return () => {
      if (loadAbortRef.current) {
        try {
          loadAbortRef.current.abort();
        } catch {
          // ignore teardown abort errors
        }
      }
    };
  }, []);

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
    setDetailProgress(8);
    fetch(`${API}/customers/${detailModal.customerId}/development?refresh=${forceRefresh ? "1" : "0"}`)
      .then((res) => {
        if (!res.ok) throw new Error("detail_failed");
        setDetailProgress((prev) => Math.max(prev, 58));
        return res.json();
      })
      .then((data) => {
        setDetailProgress(100);
        setDetailData(data || null);
        setDetailStatus("ready");
      })
      .catch(() => {
        setDetailProgress(100);
        setDetailStatus("error");
      });
  };

  const filteredContexts = useMemo(() => {
    return contexts.filter((item) => {
      if (filters.noContract && item.hasMaintenanceContract) return false;
      if (filters.revenueFalling && Number(item.revenueTrendPct || 0) >= 0) return false;
      if (filters.highCommunication && Number(item.communicationLoad || 0) < 120) return false;
      if (filters.infraRisk && Number(item.infrastructureRisk || 0) < 25) return false;
      const needle = String(filters.searchNeedle || "").trim().toLowerCase();
      if (needle) {
        const terms = needle.split(/\s+/).filter(Boolean);
        const searchPool = [
          item.customerName,
          item.customerNumber,
          item.developmentState,
          item.status,
          ...(item.signals || []),
          ...(item.contractFlags || []),
          ...(item.topRecommendations || []).flatMap((rec) => [rec?.title, rec?.type, rec?.why]),
          String(item.priority || ""),
          String(item.ticketLoad || ""),
          String(item.communicationLoad || ""),
          String(item.infrastructureRisk || ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesAllTerms = terms.every((term) => searchPool.includes(term));
        if (!matchesAllTerms) return false;
      }
      return true;
    });
  }, [contexts, filters]);

  const createTask = async (prefillTitle) => {
    if (!detailModal.customerId) return;
    const suggestionTitle =
      prefillTitle ||
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

  const actionSuggestions = useMemo(() => {
    const suggestions = [];
    if (!detailData) return suggestions;

    if (detailTab === "overview") {
      const recs = (detailData.recommendations || detailData.topRecommendations || []).slice(0, 3);
      recs.forEach((rec) => {
        const title = String(rec?.title || "").trim();
        if (!title) return;
        suggestions.push({ label: title, title: `Empfehlung umsetzen: ${title}` });
      });
      if (!suggestions.length) {
        suggestions.push({ label: "Allgemeines Follow-up", title: "Follow-up Kundenentwicklung" });
      }
      return suggestions;
    }

    if (detailTab === "infra") {
      const unmanaged = Number(detailData?.infra?.unmanagedCount || 0);
      const coveragePct = Math.round(ratioToPercent(detailData?.infra?.coverageRatio));
      const discovered = Number((detailData?.discoveredInfrastructureDevices || []).length || 0);
      if (unmanaged > 0) {
        suggestions.push({
          label: `Unmanaged Geräte prüfen (${unmanaged})`,
          title: `Unmanaged Geräte inventarisieren (${unmanaged})`,
        });
      }
      if (coveragePct < 70) {
        suggestions.push({
          label: `RMM-Abdeckung erhöhen (${coveragePct}%)`,
          title: `RMM-Abdeckung erhöhen (aktuell ${coveragePct}%)`,
        });
      }
      if (discovered > 0) {
        suggestions.push({
          label: `Discovery-Inventar prüfen (${discovered})`,
          title: `Discovery-Inventar validieren (${discovered} Geräte)`,
        });
      }
      if (!suggestions.length) {
        suggestions.push({ label: "Infrastruktur prüfen", title: "Infrastruktur Review durchführen" });
      }
      return suggestions;
    }

    if (detailTab === "cve") {
      const findingSuggestions = [];
      (cveScan.agents || []).forEach((agent) => {
        (agent?.findings || []).slice(0, 2).forEach((item) => {
          findingSuggestions.push({
            label: `${item?.name || "Software"} @ ${agent?.hostname || "Agent"}`,
            title: `CVE prüfen: ${item?.name || "Software"} auf ${agent?.hostname || "Agent"}`,
          });
        });
      });
      if (findingSuggestions.length) {
        return findingSuggestions.slice(0, 4);
      }
      const matchedAgents = Number(cveScan.matchedAgents || 0);
      const scannedSoftware = Number(cveScan.scannedSoftware || 0);
      if (matchedAgents > 0 && scannedSoftware === 0) {
        suggestions.push({
          label: "Software-Inventar auf Agenten prüfen",
          title: "RMM-Softwareinventar prüfen (keine Pakete für CVE-Scan)",
        });
      } else if (matchedAgents === 0) {
        suggestions.push({
          label: "Agent-Zuordnung korrigieren",
          title: "Kunden-Agent-Zuordnung für CVE-Analyse prüfen",
        });
      } else {
        suggestions.push({
          label: "CVE-Review dokumentieren",
          title: "CVE-Analyse prüfen und dokumentieren",
        });
      }
      return suggestions;
    }

    if (detailTab === "ki") {
      if (String(detailAi.text || "").trim()) {
        suggestions.push({
          label: "KI-Vorschlag nachfassen",
          title: "KI-Vorschlag mit Kunde abstimmen und nachverfolgen",
        });
      } else {
        suggestions.push({
          label: "KI-Entwurf erstellen",
          title: "KI-Entwurf erzeugen und als Maßnahme planen",
        });
      }
      return suggestions;
    }

    suggestions.push({ label: "Follow-up", title: "Follow-up Kundenentwicklung" });
    return suggestions;
  }, [detailData, detailTab, cveScan, detailAi.text]);

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
      nameOnlyCandidates: 0,
      mappingHint: "",
      agents: [],
      fromCache: false,
      error: ""
    });
    setDiscoveryRun({ status: "idle", message: "", error: "" });
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
      nameOnlyCandidates: 0,
      mappingHint: "",
      agents: [],
      fromCache: false,
      error: ""
    });
    setDiscoveryRun({ status: "idle", message: "", error: "" });
    setDetailAi({
      open: false,
      customerId: null,
      customerName: "",
      mode: "angebot",
      text: "",
      error: ""
    });
  };

  const runCveScan = async (forceRefresh = true) => {
    if (!detailModal.customerId) return;
    setCveProgress(10);
    setCveScan({
      status: "loading",
      scannedSoftware: 0,
      matchedAgents: 0,
      nameOnlyCandidates: 0,
      mappingHint: "",
      agents: [],
      fromCache: false,
      error: ""
    });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(
        `${API}/customers/${detailModal.customerId}/development/cve_scan?refresh=${forceRefresh ? "1" : "0"}`,
        { signal: controller.signal }
      );
      const data = await response.json().catch(() => ({}));
      setCveProgress((prev) => Math.max(prev, 72));
      if (!response.ok) throw new Error(data?.detail || "CVE Analyse fehlgeschlagen");
      setCveProgress(100);
      setCveScan({
        status: "ready",
        scannedSoftware: Number(data?.scannedSoftware || 0),
        matchedAgents: Number(data?.matchedAgents || 0),
        nameOnlyCandidates: Number(data?.nameOnlyCandidates || 0),
        mappingHint: String(data?.mappingHint || ""),
        agents: Array.isArray(data?.agents) ? data.agents : [],
        fromCache: Boolean(data?.fromCache),
        error: ""
      });
    } catch (error) {
      setCveProgress(100);
      setCveScan({
        status: "error",
        scannedSoftware: 0,
        matchedAgents: 0,
        nameOnlyCandidates: 0,
        mappingHint: "",
        agents: [],
        fromCache: false,
        error:
          error?.name === "AbortError"
            ? "CVE Analyse Timeout (90s). Bitte erneut versuchen."
            : error?.message
              ? String(error.message)
              : "CVE Analyse fehlgeschlagen"
      });
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const runInfrastructureDiscovery = async () => {
    if (!detailModal.customerId) return;
    setDiscoveryRun({ status: "loading", message: "", error: "" });
    setDiscoveryProgress(10);
    try {
      const response = await fetch(`${API}/customers/${detailModal.customerId}/development/discovery_run`, {
        method: "POST",
      });
      const textPayload = await response.text().catch(() => "");
      let data = {};
      try {
        data = textPayload ? JSON.parse(textPayload) : {};
      } catch {
        data = {};
      }
      setDiscoveryProgress((prev) => Math.max(prev, 75));
      if (!response.ok) {
        if (data?.detail) {
          throw new Error(String(data.detail));
        }
        const plain = textPayload?.trim();
        throw new Error(plain || "Discovery konnte nicht gestartet werden");
      }
      if (data && data.started === false) {
        setDiscoveryProgress(100);
        setDiscoveryRun({
          status: "ready",
          message: String(data?.hint || "Discovery nicht gestartet."),
          error: "",
        });
        return;
      }
      setDiscoveryProgress(100);
      const agentLabel = data?.agentHostname ? ` auf ${String(data.agentHostname)}` : "";
      const apiLabel = data?.apiUrl ? ` Ziel: ${String(data.apiUrl)}` : "";
      setDiscoveryRun({
        status: "ready",
        message: `Discovery gestartet${agentLabel}.${apiLabel}`,
        error: "",
      });
      loadDetail(true);
    } catch (error) {
      setDiscoveryProgress(100);
      setDiscoveryRun({
        status: "error",
        message: "",
        error: error?.message ? String(error.message) : "Discovery konnte nicht gestartet werden",
      });
    }
  };

  useEffect(() => {
    if (detailStatus !== "loading") return;
    const timer = window.setInterval(() => {
      setDetailProgress((prev) => (prev >= 92 ? prev : Math.min(92, prev + (prev < 35 ? 7 : 3))));
    }, 170);
    return () => window.clearInterval(timer);
  }, [detailStatus]);

  useEffect(() => {
    if (!aiBusy) return;
    setAiProgress(10);
    const timer = window.setInterval(() => {
      setAiProgress((prev) => (prev >= 90 ? prev : Math.min(90, prev + (prev < 40 ? 8 : 4))));
    }, 180);
    return () => window.clearInterval(timer);
  }, [aiBusy]);

  useEffect(() => {
    if (!aiBusy && aiProgress > 0) {
      setAiProgress(100);
      const timer = window.setTimeout(() => setAiProgress(0), 220);
      return () => window.clearTimeout(timer);
    }
  }, [aiBusy, aiProgress]);

  useEffect(() => {
    if (cveScan.status !== "loading") return;
    const timer = window.setInterval(() => {
      setCveProgress((prev) => (prev >= 92 ? prev : Math.min(92, prev + (prev < 30 ? 6 : 2))));
    }, 190);
    return () => window.clearInterval(timer);
  }, [cveScan.status]);

  useEffect(() => {
    if (discoveryRun.status !== "loading") return;
    const timer = window.setInterval(() => {
      setDiscoveryProgress((prev) => (prev >= 92 ? prev : Math.min(92, prev + (prev < 50 ? 5 : 2))));
    }, 200);
    return () => window.clearInterval(timer);
  }, [discoveryRun.status]);

  useEffect(() => {
    if (!detailModal.open || !detailModal.customerId) return;
    if (detailTab !== "cve") return;
    if (cveScan.status !== "idle") return;
    runCveScan(false);
  }, [detailModal.open, detailModal.customerId, detailTab, cveScan.status]);

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
                  { id: "overview", label: "Übersicht", icon: Eye },
                  { id: "ki", label: "KI Auswertung", icon: Plus },
                  { id: "infra", label: "Infrastruktur", icon: Shield },
                  { id: "cve", label: "CVE Analyse", icon: AlertTriangle }
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDetailTab(tab.id)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                      detailTab === tab.id
                        ? "border-sand-900 bg-sand-900 text-white"
                        : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                    }`}
                  >
                    <Icon size={11} />
                    {tab.label}
                  </button>
                  );
                })}
              </div>
            </div>
            <div className="max-h-[83vh] overflow-auto p-5 bg-sand-50">
              {detailStatus === "loading" ? (
                <LoadingProgress label="Lade Analytics" progress={detailProgress} />
              ) : detailStatus === "error" ? (
                <p className="text-sm text-rose-600">Details konnten nicht geladen werden.</p>
              ) : detailData ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-sand-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Aktionen</p>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => createTask(actionSuggestions?.[0]?.title || "Follow-up Kundenentwicklung")}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                        >
                          <Plus size={12} /> Aufgabe anlegen
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
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${
                                detailAi.mode === item.value
                                  ? "border-sand-900 bg-sand-900 text-white"
                                  : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                              }`}
                            >
                              <Sparkles size={11} />
                              {item.label}
                            </button>
                          ))}
                        </div>
                        {aiBusy ? <LoadingProgress label="KI generiert Vorschlag" progress={aiProgress} /> : null}
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

                  {detailTab === "overview" ? (
                  <>
                  <div className="grid gap-3 md:grid-cols-5">
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
                      <div className="mt-1">
                        <PriorityBar item={detailData || {}} />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Vertrag</p>
                      <p className="text-sm text-sand-700">
                        {detailData.hasMaintenanceContract ? "vorhanden" : "kein Vertrag"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Letzte Rechnung</p>
                      <p className="text-sm text-sand-700">
                        {typeof detailData.daysSinceLastInvoice === "number"
                          ? `vor ${detailData.daysSinceLastInvoice} Tagen`
                          : "n/a"}
                      </p>
                      {detailData.invoiceActivityDue ? (
                        <span className="mt-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                          Reaktivierung nötig
                        </span>
                      ) : null}
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

                  <div className="rounded-2xl border border-sand-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Letzte Arbeiten (Rechnungen)</p>
                      <span className="text-[11px] text-sand-500">Top 5</span>
                    </div>
                    <p className="mt-2 text-sm text-sand-700">
                      {String(detailData.workSummary?.summary || "").trim() || "Noch keine Zusammenfassung vorhanden."}
                    </p>
                    <div className="mt-3 space-y-2">
                      {(detailData.workSummary?.items || []).slice(0, 5).map((row, idx) => (
                        <div key={`work-row-${row.invoiceId || idx}`} className="rounded-xl border border-sand-200 bg-sand-50 p-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-sand-600">
                            <span className="font-semibold text-sand-800">{row.invoiceNumber || `Rechnung #${row.invoiceId || "n/a"}`}</span>
                            <span>{row.date || "n/a"} · {formatEur(row.amountEur)}</span>
                          </div>
                          {(row.positionSnippets || []).length ? (
                            <ul className="mt-1.5 space-y-1">
                              {(row.positionSnippets || []).slice(0, 3).map((snippet, sIdx) => (
                                <li key={`snippet-${sIdx}`} className="text-[11px] text-sand-700">
                                  - {snippet}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1.5 text-[11px] text-sand-500">Keine Positionsdetails vorhanden.</p>
                          )}
                        </div>
                      ))}
                      {!(detailData.workSummary?.items || []).length ? (
                        <p className="text-xs text-sand-500">Keine Rechnungspositionen für die letzten Arbeiten gefunden.</p>
                      ) : null}
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
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </>
                  ) : null}

                  {detailTab === "infra" ? (
                    <div className="rounded-2xl border border-sand-200 bg-white p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Infrastruktur (RMM + Discovery)</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => loadDetail(true)}
                            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                          >
                            <RefreshCw size={12} />
                            Aktualisieren
                          </button>
                          <button
                            type="button"
                            onClick={runInfrastructureDiscovery}
                            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                          >
                            <ScanSearch size={12} />
                            Discovery starten
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-sand-500">
                        Quelle: Tactical RMM Agents + Discovery-Ingest aus RMM-Script (Ping/SNMP).
                      </p>
                      {discoveryRun.status === "loading" ? (
                        <LoadingProgress label="Discovery läuft" progress={discoveryProgress} />
                      ) : null}
                      {discoveryRun.message ? <p className="text-sm text-emerald-700">{discoveryRun.message}</p> : null}
                      {discoveryRun.error ? <p className="text-sm text-rose-600">{discoveryRun.error}</p> : null}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">RMM Agents</p>
                          <p className="text-sm font-semibold text-sand-800">
                            {(detailData.managedInfrastructureDevices || []).length}
                          </p>
                        </div>
                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Discovery Geräte</p>
                          <p className="text-sm font-semibold text-sand-800">
                            {(detailData.discoveredInfrastructureDevices || []).length}
                          </p>
                        </div>
                      </div>
                      {detailData?.infra?.rmmMappingHint ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                          <p className="text-xs text-amber-800">{detailData.infra.rmmMappingHint}</p>
                        </div>
                      ) : null}
                      <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">Handlungsempfehlungen</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {(detailData.infraActionHints || []).length ? (
                            (detailData.infraActionHints || []).map((rec, idx) => {
                              const recType = String(rec?.type || "").toLowerCase();
                              const isSecurity = recType === "security";
                              const isLifecycle = recType === "lifecycle";
                              const RecIcon = isSecurity ? Shield : isLifecycle ? Clock3 : AlertTriangle;
                              const typeClass = isSecurity
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : isLifecycle
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-sand-200 bg-sand-100 text-sand-700";
                              const cardClass = isSecurity
                                ? "border-rose-200"
                                : isLifecycle
                                  ? "border-amber-200"
                                  : "border-sand-200";
                              const typeLabel = isSecurity ? "Security" : isLifecycle ? "Lifecycle" : "Hinweis";
                              return (
                                <div
                                  key={`${rec?.title || "infra-rec"}-${idx}`}
                                  className={`rounded-xl border bg-white p-2.5 ${cardClass}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-start gap-2">
                                      <div className={`mt-0.5 rounded-lg border p-1 ${typeClass}`}>
                                        <RecIcon size={13} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-sand-900 leading-5">
                                          {rec?.title || "Empfehlung"}
                                        </p>
                                      </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${typeClass}`}>
                                      {typeLabel}
                                    </span>
                                  </div>
                                  <p className="mt-1.5 text-[11px] leading-5 text-sand-600">
                                    {rec?.why || ""}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-sand-500">Keine akuten Infrastruktur-Maßnahmen erkannt.</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">RMM Agenten</p>
                        {(detailData.managedInfrastructureDevices || []).length ? (
                          (detailData.managedInfrastructureDevices || []).map((device, idx) => {
                            const expanded = Boolean(expandedInfraAgents[device?.agentId || `idx-${idx}`]);
                            const errorCount = Number(device?.errorCount || 0);
                            const warningCount = Number(device?.warningCount || 0);
                            const updatesCount = Number(device?.openUpdates || 0);
                            const lifecycleStatus = String(device?.lifecycle?.status || "").toLowerCase();
                            const lifecycleLabel =
                              lifecycleStatus === "expired"
                                ? "EOL erreicht"
                                : lifecycleStatus === "soon"
                                  ? "EOL bald"
                                  : "Im Support";
                            const lifecycleClass =
                              lifecycleStatus === "expired"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : lifecycleStatus === "soon"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700";
                            return (
                              <div key={`${device?.agentId || idx}`} className="rounded-2xl border border-sand-200 bg-white p-3 text-xs text-sand-700 shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sand-200 bg-sand-50 text-sand-700">
                                      {(() => {
                                        const AgentIcon = getAgentIcon(device);
                                        return <AgentIcon size={16} />;
                                      })()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-sand-900">{device?.hostname || "Unbekannter Agent"}</p>
                                      <p className="truncate text-[11px] text-sand-500">
                                        {device?.client || "Client n/a"} · {device?.site || "Site n/a"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                        typeof device?.online === "boolean"
                                          ? device.online
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-rose-200 bg-rose-50 text-rose-700"
                                          : "border-sand-200 bg-white text-sand-600"
                                      }`}
                                    >
                                      {typeof device?.online === "boolean" ? (device.online ? "Online" : "Offline") : "Status n/a"}
                                    </span>
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${lifecycleClass}`}>
                                      {lifecycleLabel}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedInfraAgents((prev) => ({
                                          ...prev,
                                          [device?.agentId || `idx-${idx}`]: !prev[device?.agentId || `idx-${idx}`]
                                        }))
                                      }
                                      className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                                    >
                                      {expanded ? "Details ausblenden" : "Details anzeigen"}
                                      {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-wide text-rose-700">Fehler</p>
                                    <p className="text-sm font-semibold text-rose-800">{errorCount}</p>
                                  </div>
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-wide text-amber-700">Warnungen</p>
                                    <p className="text-sm font-semibold text-amber-800">{warningCount}</p>
                                  </div>
                                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5">
                                    <p className="text-[10px] uppercase tracking-wide text-sky-700">Updates</p>
                                    <p className="text-sm font-semibold text-sky-800">{updatesCount}</p>
                                  </div>
                                  <div className={`rounded-lg border px-2 py-1.5 ${lifecycleClass}`}>
                                    <p className="text-[10px] uppercase tracking-wide">Lifecycle</p>
                                    <p className="text-sm font-semibold">{device?.lifecycle?.eol_date || "n/a"}</p>
                                  </div>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-sand-600">
                                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5">RMM</span>
                                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5">
                                    OS: {device?.os || "n/a"}
                                  </span>
                                </div>

                                {expanded ? (
                                  <div className="mt-2 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-2 text-[11px] text-sand-700 space-y-1.5">
                                    <p>
                                      <span className="font-semibold text-sand-800">Updates:</span> {updatesCount}
                                      {" "} (Windows {Number(device?.windowsUpdates || 0)} · 3rd-Party {Number(device?.thirdPartyUpdates || 0)} · CVE {Number(device?.openCves || 0)})
                                    </p>
                                    {lifecycleStatus === "expired" ? (
                                      <p className="text-rose-700">
                                        <span className="font-semibold">OS Lifecycle:</span> Support abgelaufen (EOL {device?.lifecycle?.eol_date || "n/a"})
                                      </p>
                                    ) : lifecycleStatus === "soon" ? (
                                      <p className="text-amber-700">
                                        <span className="font-semibold">OS Lifecycle:</span> Support endet bald (EOL {device?.lifecycle?.eol_date || "n/a"})
                                      </p>
                                    ) : (
                                      <p className="text-emerald-700">
                                        <span className="font-semibold">OS Lifecycle:</span> Support aktiv
                                      </p>
                                    )}
                                    <p className="inline-flex items-center gap-1 text-sand-600"><Clock3 size={12} /> Last Seen: {formatDateTime(device?.lastSeen)}</p>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-sand-500">Keine zugeordneten RMM-Agenten gefunden.</p>
                        )}
                      </div>
                      <div className="space-y-2 pt-1">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">Discovery Geräte</p>
                        {(detailData.discoveredInfrastructureDevices || []).length ? (
                          (detailData.discoveredInfrastructureDevices || []).map((device, idx) => (
                            <div key={`${device?.source || "d"}-${device?.hostname || idx}-${idx}`} className="rounded-2xl border border-sand-200 bg-white p-3 text-xs text-sand-700">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="h-8 w-8 rounded-lg border border-sand-200 bg-sand-50 text-sand-700 flex items-center justify-center shrink-0">
                                    {(() => {
                                      const DiscoveryIcon = getDiscoveryIcon(device);
                                      return <DiscoveryIcon size={15} />;
                                    })()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sand-800 truncate">{device?.hostname || "Unbekanntes Gerät"}</p>
                                    <p className="text-[11px] text-sand-500 truncate">
                                      {device?.deviceType ? `Typ: ${String(device.deviceType)}` : "Typ: n/a"}
                                      {device?.vendor ? ` · ${String(device.vendor)}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                  {device?.source || "Discovery"}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-sand-600">
                                <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5">{device?.ip ? `IP ${device.ip}` : "IP n/a"}</span>
                                {device?.mac ? <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5">MAC {device.mac}</span> : null}
                                {device?.protocol ? <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5">{String(device.protocol).toUpperCase()}</span> : null}
                                {typeof device?.confidence === "number" ? (
                                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5">
                                    Confidence {Math.max(0, Math.min(100, Number(device.confidence || 0)))}%
                                  </span>
                                ) : null}
                              </div>
                              {Array.isArray(device?.evidence) && device.evidence.length ? (
                                <p className="mt-1 text-[10px] text-sand-500">Hinweise: {device.evidence.slice(0, 4).join(", ")}</p>
                              ) : null}
                              <p className="mt-1 text-[10px] text-sand-500 inline-flex items-center gap-1">
                                <Clock3 size={11} /> Last Seen: {formatDateTime(device?.lastSeenAt)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-sand-500">
                            Noch keine Discovery-Geräte vorhanden. Starte den Scan über den Button oben.
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
                            <Sparkles size={12} />
                            Cache laden
                          </button>
                          <button
                            type="button"
                            onClick={() => runCveScan(true)}
                            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-xs hover:bg-sand-100"
                          >
                            <RefreshCw size={12} />
                            Neu scannen
                          </button>
                        </div>
                      </div>
                      {cveScan.status === "loading" ? (
                        <LoadingProgress label="Scanne Software gegen CVE-Datenbanken" progress={cveProgress} />
                      ) : null}
                      {cveScan.status === "idle" ? (
                        <p className="text-sm text-sand-500">
                          CVE Analyse startet automatisch beim Öffnen dieses Tabs.
                        </p>
                      ) : null}
                      {cveScan.error ? <p className="text-sm text-rose-600">{cveScan.error}</p> : null}
                      {cveScan.status === "ready" ? (
                        <div className="space-y-2">
                          <p className="text-xs text-sand-500">
                            Geprüfte Software: {cveScan.scannedSoftware} · RMM Agents: {cveScan.matchedAgents}
                            {cveScan.fromCache ? " · aus Cache" : " · live"}
                          </p>
                          {Number(cveScan.matchedAgents || 0) === 0 ? (
                            <p className="text-sm text-sand-500">
                              {cveScan.mappingHint || "Keine zugeordneten RMM-Agenten für diesen Kunden gefunden."}
                            </p>
                          ) : null}
                          {Number(cveScan.matchedAgents || 0) > 0 && Number(cveScan.scannedSoftware || 0) === 0 ? (
                            <p className="text-sm text-sand-500">
                              Agenten gefunden, aber keine auswertbare Softwareliste vom RMM geliefert.
                            </p>
                          ) : null}
                          {(cveScan.agents || []).length ? (
                            (cveScan.agents || []).map((agent, idx) => (
                              <div key={`${agent?.agentId || idx}`} className="rounded-xl border border-sand-200 bg-sand-50 p-2 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-sand-800">
                                    {agent?.hostname || "Unbekannter Agent"}
                                  </p>
                                  <span className="text-[10px] text-sand-500">
                                    Findings: {agent?.findingCount || 0} · Software: {agent?.softwareCount || 0}
                                  </span>
                                </div>
                                <p className="text-[11px] text-sand-600">
                                  {agent?.client || "Client n/a"} · {agent?.site || "Site n/a"} ·{" "}
                                  {typeof agent?.online === "boolean" ? (agent.online ? "Online" : "Offline") : "Status n/a"}
                                </p>
                                <p className="text-[11px] text-sand-600">OS: {agent?.os || "n/a"} · Last Seen: {agent?.lastSeen || "n/a"}</p>
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
                                {(agent?.software || []).length ? (
                                  <div className="rounded-lg border border-sand-200 bg-white px-2 py-1.5">
                                    <p className="text-[11px] font-semibold text-sand-700">Geprüfte Programme</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {(agent.software || []).map((pkg, pkgIdx) => (
                                        <span
                                          key={`${pkg?.name || "pkg"}-${pkgIdx}`}
                                          className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] text-sand-700"
                                        >
                                          {pkg?.name || "Unbekannt"}
                                          {pkg?.version ? ` ${pkg.version}` : ""}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : Number(agent?.softwareCount || 0) > 0 ? (
                                  <p className="text-[11px] text-sand-500">Programm-Liste im Cache noch nicht enthalten. Bitte „Neu scannen“.</p>
                                ) : null}
                              </div>
                            ))
                          ) : Number(cveScan.matchedAgents || 0) > 0 ? (
                            <p className="text-sm text-sand-500">Agenten vorhanden, aber keine Softwaredaten vom RMM geliefert.</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sand-700">
              <ScanSearch size={14} />
              <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Filterleiste</p>
            </div>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  noContract: false,
                  revenueFalling: false,
                  highCommunication: false,
                  infraRisk: false,
                  searchNeedle: ""
                })
              }
              className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
            >
              <X size={12} /> Zurücksetzen
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5 text-xs">
            <label className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 flex items-center gap-2">
              <Users size={13} className="text-sand-500" />
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                className="h-4 w-4"
              />
              Inaktive anzeigen
            </label>
            <label className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 flex items-center gap-2">
              <Shield size={13} className="text-sand-500" />
              <input
                type="checkbox"
                checked={filters.noContract}
                onChange={(event) => setFilters((prev) => ({ ...prev, noContract: event.target.checked }))}
                className="h-4 w-4"
              />
              Ohne Vertrag
            </label>
            <label className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 flex items-center gap-2">
              <TrendingDown size={13} className="text-sand-500" />
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
            <label className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 flex items-center gap-2">
              <Clock3 size={13} className="text-sand-500" />
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
            <label className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={13} className="text-sand-500" />
              <input
                type="checkbox"
                checked={filters.infraRisk}
                onChange={(event) => setFilters((prev) => ({ ...prev, infraRisk: event.target.checked }))}
                className="h-4 w-4"
              />
              Infrastruktur-Risiko
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Suche</span>
            <div className="mt-1 relative">
              <Search size={13} className="absolute left-3 top-2.5 text-sand-400" />
              <input
                value={filters.searchNeedle}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, searchNeedle: event.target.value }))
                }
                placeholder="Kunde, Nr., Empfehlung, Signal ..."
                className="w-full rounded-xl border border-sand-200 bg-white pl-8 pr-3 py-2 text-xs"
              />
            </div>
          </label>
          <div className="mt-3 rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Prioritätslogik</p>
            <p className="mt-1 text-[11px] text-sand-600">Grün: stabiler Umsatz und kein akuter Handlungsbedarf. Orange: beobachten. Rot: Kunde aktivieren.</p>
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
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredContexts.map((item) => (
                  <tr key={item.customerId} className="border-t border-sand-100">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-sand-800">{item.customerName || "Unbekannt"}</div>
                      <div className="text-sand-500">{item.customerNumber || "ohne Nr."}</div>
                      {Boolean(item.contactDue) ? (
                        <div className="mt-1 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                          Kontakt fällig
                          {typeof item.daysSinceInteraction === "number" ? ` · ${item.daysSinceInteraction} Tage` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${stateBadgeClass(item.developmentState)}`}>
                        {item.developmentState}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <PriorityBar item={item} />
                    </td>
                    <td className="py-2 pr-3">
                      <span className={Number(item.revenueTrendPct) < 0 ? "text-rose-600" : "text-emerald-700"}>
                        {formatPct(item.revenueTrendPct)}
                      </span>
                    </td>
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
                      <div className="mt-1">
                        <PriorityBar item={item} />
                      </div>
                      {Boolean(item.contactDue) ? (
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-700">
                          Kontakt fällig{typeof item.daysSinceInteraction === "number" ? ` · ${item.daysSinceInteraction} Tage` : ""}
                        </p>
                      ) : null}
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
