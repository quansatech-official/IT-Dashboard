import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Clock3,
  ChevronDown,
  ChevronUp,
  Cpu,
  Eye,
  Info,
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
  const flags = normalizeContractFlags(item);
  const isRegieCustomer = flags.includes("regie") && !Boolean(item?.hasMaintenanceContract);
  const backendPriority = Number(item?.priority);
  const risk = Number(item?.riskScore || 0);
  const contactDue = Boolean(item?.contactDue);
  const invoiceActivityDue = Boolean(item?.invoiceActivityDue);
  const score = Number.isFinite(backendPriority)
    ? backendPriority
    : Math.max(
        0,
        Math.min(
          100,
          risk +
            (contactDue ? 12 : 0) +
            (invoiceActivityDue ? 16 : 0) +
            (!Boolean(item?.hasMaintenanceContract) && !isRegieCustomer ? 6 : 0)
        )
      );

  if (isRegieCustomer) {
    if (score >= 70 || (contactDue && invoiceActivityDue && risk >= 60)) {
      return {
        key: "amber",
        index: 1,
        label: "Regie",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      };
    }
    return {
      key: "green",
      index: 0,
      label: "Regie",
      badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
    };
  }

  if (score >= 70 || ((contactDue || invoiceActivityDue) && risk >= 55)) {
    return {
      key: "red",
      index: 2,
      label: "Aktivieren",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (score < 40 && !contactDue && !invoiceActivityDue && risk < 45) {
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

const normalizeContractFlags = (item) => {
  if (!Array.isArray(item?.contractFlags)) return [];
  return item.contractFlags.map((entry) => String(entry || "").trim().toLowerCase()).filter(Boolean);
};

const contractSummary = (item) => {
  const flags = normalizeContractFlags(item);
  const isRegieCustomer = flags.includes("regie") && !Boolean(item?.hasMaintenanceContract);
  const hasMonitoring = flags.includes("monitoring");
  const hasMaintenance = Boolean(item?.hasMaintenanceContract) || flags.includes("wartung");
  if (isRegieCustomer) return "Regie (nach Aufwand)";
  if (hasMonitoring && hasMaintenance) return "Wartung + Monitoring";
  if (hasMonitoring) return "Monitoring";
  if (hasMaintenance) return "Wartung";
  return "Kein Vertrag";
};

const inventorySummary = (item) => {
  const mix = item?.infra?.inventoryMix || {};
  const server = Number(mix?.server || 0);
  const firewall = Number(mix?.firewall || 0);
  const printer = Number(mix?.printer || 0);
  const network = Number(mix?.network || 0);
  const iot = Number(mix?.iot || 0);
  const workstation = Number(mix?.workstation || 0);
  const total = server + firewall + printer + network + iot + workstation + Number(mix?.other || 0);
  return {
    total,
    text: `Srv ${server} · FW ${firewall} · Drucker ${printer} · Netz ${network}${iot > 0 ? ` · IoT ${iot}` : ""}`,
  };
};

const neglectScore = (item) => {
  const backendPriority = Number(item?.priority);
  const risk = Number(item?.riskScore || 0);
  const contactDue = Boolean(item?.contactDue);
  const invoiceDue = Boolean(item?.invoiceActivityDue);
  const hasContract = Boolean(item?.hasMaintenanceContract);
  const flags = normalizeContractFlags(item);
  const isRegieCustomer = flags.includes("regie") && !hasContract;
  let score = Number.isFinite(backendPriority) ? backendPriority : risk;
  if (contactDue) score += 8;
  if (invoiceDue) score += 12;
  if (!hasContract && !isRegieCustomer) score += 6;
  if (isRegieCustomer) score -= 14;
  return Math.round(Math.max(0, Math.min(100, score)));
};

const callFocusPoints = (item) => {
  const points = [];
  const daysSinceInteraction = Number(item?.daysSinceInteraction || 0);
  const daysSinceInvoice = Number(item?.daysSinceLastInvoice || 0);
  const flags = normalizeContractFlags(item);
  const isRegieCustomer = flags.includes("regie") && !Boolean(item?.hasMaintenanceContract);
  const infra = item?.infra || {};
  if (Boolean(item?.contactDue)) {
    points.push(
      `Letzter dokumentierter Kontakt vor ${daysSinceInteraction > 0 ? `${daysSinceInteraction} Tagen` : "längerer Zeit"}.`
    );
  }
  if (Boolean(item?.invoiceActivityDue) || daysSinceInvoice >= 45) {
    points.push(
      `Seit ${daysSinceInvoice > 0 ? `${daysSinceInvoice} Tagen` : "länger"} keine neue umgesetzte Leistung fakturiert.`
    );
  }
  if (isRegieCustomer) {
    points.push("Regie-Kunde: Betreuung erfolgt nach Aufwand, kein Wartungsvertrag gewünscht.");
  } else if (!Boolean(item?.hasMaintenanceContract)) {
    points.push("Kein Wartungs-/Monitoringvertrag hinterlegt.");
  }
  if (Number(infra?.openUpdates || 0) > 0) {
    points.push(
      `Update-Backlog: ${Number(infra?.openUpdates || 0)} offen (Windows ${Number(infra?.windowsUpdates || 0)}, 3rd-Party ${Number(infra?.thirdPartyUpdates || 0)}).`
    );
  }
  if (Number(infra?.osExpiredCount || 0) > 0 || Number(infra?.osEolSoonCount || 0) > 0) {
    points.push(
      `OS-Lifecycle: ${Number(infra?.osExpiredCount || 0)} abgelaufen, ${Number(infra?.osEolSoonCount || 0)} zeitnah EOL.`
    );
  }
  const topRec = item?.topRecommendations?.[0];
  if (topRec?.title) {
    points.push(`Konkretes Gesprächsthema: ${String(topRec.title)}.`);
  }
  return points.slice(0, 4);
};

const buildInfraActionHints = (item) => {
  const infra = item?.infra || {};
  const hints = [];
  const errorCount = Number(infra?.errorCount || 0);
  const warningCount = Number(infra?.warningCount || 0);
  const windowsUpdates = Number(infra?.windowsUpdates || 0);
  const thirdPartyUpdates = Number(infra?.thirdPartyUpdates || 0);
  const openCves = Number(infra?.openCves || 0);
  const openUpdates = Number(infra?.openUpdates || 0);
  const osExpiredCount = Number(infra?.osExpiredCount || 0);
  const osEolSoonCount = Number(infra?.osEolSoonCount || 0);
  const effectiveOpenUpdates = Math.max(openUpdates, windowsUpdates + thirdPartyUpdates + openCves);

  if (errorCount > 0) {
    hints.push({
      type: "security",
      title: "Agent-Fehler priorisiert beheben",
      why: `Es liegen ${errorCount} Fehlerhinweise auf den zugeordneten RMM-Agents vor.`,
    });
  }
  if (warningCount > 0) {
    hints.push({
      type: "lifecycle",
      title: "Agent-Warnungen prüfen",
      why: `Es liegen ${warningCount} Warnhinweise auf den zugeordneten RMM-Agents vor.`,
    });
  }
  if (effectiveOpenUpdates > 0) {
    hints.push({
      type: "security",
      title: "Patch-Backlog abbauen",
      why: `Offene Updates: Windows ${windowsUpdates}, 3rd-Party ${thirdPartyUpdates}, CVE-bezogen ${openCves}.`,
    });
  }
  if (osExpiredCount > 0) {
    hints.push({
      type: "lifecycle",
      title: "OS-Migration sofort planen",
      why: `${osExpiredCount} Systeme sind außerhalb des Supports (EOL überschritten).`,
    });
  } else if (osEolSoonCount > 0) {
    hints.push({
      type: "lifecycle",
      title: "OS-Upgrade-Roadmap festlegen",
      why: `${osEolSoonCount} Systeme erreichen innerhalb von 12 Monaten das Supportende.`,
    });
  }
  return hints.slice(0, 6);
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

const normalizeWorkSnippet = (value) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.replace(/-\s*-\s*/g, " - ");
};

const compactWorkSnippet = (value, maxLength = 220) => {
  const text = normalizeWorkSnippet(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const deriveWorkHighlights = (summary, items, maxItems = 5) => {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const cleaned = compactWorkSnippet(value, 150);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) return;
    seen.add(key);
    out.push(cleaned);
  };
  String(summary || "")
    .split(/[;•\n]+/g)
    .map((entry) => normalizeWorkSnippet(entry))
    .forEach((entry) => push(entry));
  (items || []).slice(0, 5).forEach((row) => {
    (row?.positionSnippets || []).slice(0, 2).forEach((snippet) => push(snippet));
  });
  if (!out.length) push("Keine aussagekräftigen Leistungsdetails vorhanden.");
  return out.slice(0, Math.max(1, maxItems));
};

const signalScore = (signal) => {
  const text = String(signal || "").toLowerCase();
  if (
    text.includes("lange ohne") ||
    text.includes("kontaktfällig") ||
    text.includes("kontaktfaellig") ||
    text.includes("veraltete") ||
    text.includes("offline-agents")
  ) {
    return 3;
  }
  if (
    text.includes("offene updates") ||
    text.includes("warnungen") ||
    text.includes("kein wartungs") ||
    text.includes("niedrige rmm")
  ) {
    return 2;
  }
  return 1;
};

const deriveDisplaySignals = (item, maxItems = 4) => {
  const raw = [...(item?.reasons || item?.signals || [])]
    .map((entry) => String(entry || "").trim())
    .filter(Boolean)
    .filter((entry) => !/aktive kundeninteraktion/i.test(entry));
  const unique = [];
  const seen = new Set();
  raw.forEach((entry) => {
    const key = entry.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(entry);
  });
  unique.sort((a, b) => signalScore(b) - signalScore(a));
  return unique.slice(0, Math.max(1, maxItems));
};

const classifyWorkSnippet = (value) => {
  const text = String(value || "").toLowerCase();
  if (text.includes("sicherung") || text.includes("backup")) return "Backup";
  if (text.includes("server")) return "Server";
  if (text.includes("update") || text.includes("patch")) return "Update";
  if (text.includes("lizenz") || text.includes("windows")) return "Lizenz";
  if (text.includes("drucker")) return "Drucker";
  if (text.includes("firewall") || text.includes("switch") || text.includes("router") || text.includes("netz")) return "Netzwerk";
  if (text.includes("arbeitszeit") || text.includes("support")) return "Service";
  return "Leistung";
};

const deriveWorkSummaryTags = (summary, items) => {
  const tags = [];
  const pushTag = (value) => {
    const tag = String(value || "").trim();
    if (!tag) return;
    if (tags.includes(tag)) return;
    tags.push(tag);
  };
  const summaryText = String(summary || "").toLowerCase();
  [
    ["firewall", "Firewall"],
    ["backup", "Backup"],
    ["sicherung", "Backup"],
    ["server", "Server"],
    ["windows 11", "Windows 11"],
    ["windows server", "Windows Server"],
    ["terminalserver", "Terminalserver"],
    ["netz", "Netzwerk"],
    ["drucker", "Drucker"],
    ["bmd", "BMD"],
  ].forEach(([needle, label]) => {
    if (summaryText.includes(needle)) pushTag(label);
  });
  (items || []).slice(0, 5).forEach((row) => {
    (row?.positionSnippets || []).slice(0, 3).forEach((snippet) => {
      pushTag(classifyWorkSnippet(snippet));
    });
  });
  if (!tags.length) pushTag("Allgemeiner Support");
  return tags.slice(0, 10);
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

const inferWindowsLifecycleFromOs = (osValue) => {
  const os = String(osValue || "").toLowerCase();
  const entries = [
    { marker: "windows server 2012 r2", eol: "2023-10-10" },
    { marker: "windows server 2012", eol: "2023-10-10" },
    { marker: "windows server 2016", eol: "2027-01-12" },
    { marker: "windows server 2019", eol: "2029-01-09" },
    { marker: "windows server 2022", eol: "2031-10-14" },
  ];
  for (const entry of entries) {
    if (!os.includes(entry.marker)) continue;
    const eolDate = new Date(`${entry.eol}T00:00:00Z`);
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysToEol = Math.floor((eolDate.getTime() - now.getTime()) / msPerDay);
    const status = daysToEol < 0 ? "expired" : daysToEol <= 365 ? "soon" : "supported";
    return {
      family: entry.marker,
      eol_date: entry.eol,
      days_to_eol: daysToEol,
      status,
      inferred: true,
    };
  }
  return { family: "", eol_date: "", days_to_eol: null, status: "unknown", inferred: true };
};

const resolveAgentLifecycle = (device) => {
  const existing = device?.lifecycle && typeof device.lifecycle === "object" ? device.lifecycle : {};
  const existingStatus = String(existing?.status || "").toLowerCase();
  const hasUsefulExisting = Boolean(existing?.eol_date) || ["expired", "soon", "supported"].includes(existingStatus);
  if (hasUsefulExisting) return existing;
  return inferWindowsLifecycleFromOs(device?.os);
};

const getDiscoveryIcon = (device) => {
  const deviceType = String(device?.deviceType || "").toLowerCase();
  const protocol = String(device?.protocol || "").toLowerCase();
  if (deviceType.includes("printer")) return Printer;
  if (deviceType.includes("server") || deviceType.includes("nas")) return Server;
  if (
    deviceType.includes("workstation") ||
    deviceType.includes("pc") ||
    deviceType.includes("desktop") ||
    deviceType.includes("laptop")
  ) {
    return Monitor;
  }
  if (
    deviceType.includes("firewall") ||
    deviceType.includes("router") ||
    deviceType.includes("switch") ||
    deviceType.includes("gateway") ||
    deviceType.includes("access_point") ||
    deviceType.includes("access point") ||
    deviceType.includes("wlan") ||
    deviceType.includes("wifi") ||
    protocol.includes("snmp")
  ) {
    return Router;
  }
  return Cpu;
};

const formatDiscoveryTypeLabel = (value) => {
  const type = String(value || "").toLowerCase().trim();
  if (!type) return "Unknown";
  const labels = {
    firewall: "Firewall",
    switch: "Switch",
    router: "Router",
    access_point: "Access Point",
    workstation: "PC",
    server: "Server",
    nas: "NAS",
    printer: "Drucker",
    iot: "IoT",
    unknown: "Unknown",
  };
  if (labels[type]) return labels[type];
  return type.replaceAll("_", " ");
};

const normalizeTextKey = (value) => String(value || "").trim().toLowerCase();

const versionParts = (value) => {
  const parts = String(value || "")
    .match(/\d+/g)
    ?.map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry));
  return Array.isArray(parts) ? parts : [];
};

const isNewerVersion = (candidate, current) => {
  const a = versionParts(candidate);
  const b = versionParts(current);
  if (!a.length || !b.length) {
    const cand = String(candidate || "").trim();
    const cur = String(current || "").trim();
    return Boolean(cand) && Boolean(cur) && cand !== cur;
  }
  const maxLen = Math.max(a.length, b.length);
  for (let index = 0; index < maxLen; index += 1) {
    const left = a[index] || 0;
    const right = b[index] || 0;
    if (left > right) return true;
    if (left < right) return false;
  }
  return false;
};

const latestFixedVersion = (finding) => {
  const versions = Array.isArray(finding?.fixedVersions)
    ? finding.fixedVersions.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  return versions.length ? versions[versions.length - 1] : "";
};

const maxCveScore = (finding) => {
  const scores = (finding?.cves || [])
    .map((entry) => Number(entry?.score))
    .filter((entry) => Number.isFinite(entry));
  if (!scores.length) return null;
  return Math.max(...scores);
};

const cveStatusBadge = ({ hasFinding, updateAvailable, cveCount }) => {
  if (updateAvailable) return "border-rose-200 bg-rose-50 text-rose-700";
  if (hasFinding && cveCount > 0) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
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

const InlineSpinner = () => (
  <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
);

export default function CustomerDevelopmentView() {
  const aiModes = [
    { value: "aktivierung_mail", label: "Aktivierungs-Mail" },
    { value: "aktivierung_call", label: "Telefonleitfaden" },
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
  const [aiActionKey, setAiActionKey] = useState("");
  const [detailAi, setDetailAi] = useState({
    open: false,
    customerId: null,
    customerName: "",
    mode: "angebot",
    text: "",
    error: "",
    sources: {},
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
  const [expandedCveAgents, setExpandedCveAgents] = useState({});
  const [workItemsExpanded, setWorkItemsExpanded] = useState(false);
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
  const detailRequestRef = useRef(0);
  const detailAbortRef = useRef(null);

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
    return () => {
      if (detailAbortRef.current) {
        try {
          detailAbortRef.current.abort();
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
    detailRequestRef.current += 1;
    const requestId = detailRequestRef.current;
    if (detailAbortRef.current) {
      try {
        detailAbortRef.current.abort();
      } catch {
        // ignore stale abort errors
      }
    }
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort("timeout"), 25000);
    setDetailStatus("loading");
    setDetailProgress(8);
    fetch(`${API}/customers/${detailModal.customerId}/development?refresh=${forceRefresh ? "1" : "0"}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (requestId !== detailRequestRef.current) return null;
        if (!res.ok) throw new Error("detail_failed");
        setDetailProgress((prev) => Math.max(prev, 58));
        return res.json();
      })
      .then((data) => {
        if (requestId !== detailRequestRef.current) return;
        if (data === null) return;
        setDetailProgress(100);
        setDetailData(data || null);
        const managedCount = Array.isArray(data?.managedInfrastructureDevices)
          ? data.managedInfrastructureDevices.length
          : 0;
        if (managedCount > 0) {
          setDiscoveryRun((prev) => {
            const msg = String(prev?.message || "");
            const err = String(prev?.error || "");
            const hasStaleNoAgentHint =
              msg.toLowerCase().includes("keine zugeordneten rmm-agenten") ||
              err.toLowerCase().includes("keine zugeordneten rmm-agenten");
            if (!hasStaleNoAgentHint) return prev;
            return { status: "idle", message: "", error: "" };
          });
        }
        setDetailStatus("ready");
      })
      .catch(() => {
        if (requestId !== detailRequestRef.current) return;
        setDetailProgress(100);
        setDetailStatus("error");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (requestId === detailRequestRef.current) {
          detailAbortRef.current = null;
        }
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
      const discovered = Number(
        ((detailData?.discoveredInfrastructureDevices || []).filter((device) => device?.active !== false).length || 0)
      );
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

  const runAiAssist = async (mode, targetCustomer = null) => {
    const targetCustomerId =
      targetCustomer && typeof targetCustomer.customerId !== "undefined"
        ? Number(targetCustomer.customerId || 0)
        : Number(detailModal.customerId || 0);
    const targetCustomerName =
      targetCustomer && typeof targetCustomer.customerName !== "undefined"
        ? String(targetCustomer.customerName || "")
        : String(detailModal.customerName || "");
    if (!targetCustomerId && mode !== "newsletter") return;
    const actionKey = `${targetCustomerId || 0}:${String(mode || "summary").toLowerCase()}`;
    setAiActionKey(actionKey);
    setAiBusy(true);
    setDetailAi((prev) => ({
      open: true,
      customerId: targetCustomerId || null,
      customerName: targetCustomerName,
      mode,
      text: "",
      error: "",
      sources: {},
    }));
    try {
      const response = await fetch(`${API}/customer_development/ai_assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "newsletter"
            ? { mode }
            : {
                customer_id: targetCustomerId,
                mode,
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
        customerId: targetCustomerId || null,
        customerName: targetCustomerName,
        mode: data?.mode || mode,
        text: data?.text || "",
        error: "",
        sources: data?.sources && typeof data.sources === "object" ? data.sources : {},
      }));
    } catch (error) {
      setDetailAi((prev) => ({
        ...prev,
        open: true,
        customerId: targetCustomerId || null,
        customerName: targetCustomerName,
        mode,
        text: "",
        error: error?.message ? String(error.message) : "KI Vorschlag fehlgeschlagen",
        sources: {},
      }));
    } finally {
      setAiBusy(false);
      setAiActionKey("");
    }
  };

  const isAiActionRunning = (customerId, mode) =>
    Boolean(aiBusy) &&
    aiActionKey === `${Number(customerId || 0)}:${String(mode || "summary").toLowerCase()}`;

  const openDetail = (context) => {
    setDetailData(null);
    setDetailStatus("idle");
    setDetailTab("overview");
    setWorkItemsExpanded(false);
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
      error: "",
      sources: {},
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
    setWorkItemsExpanded(false);
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
      error: "",
      sources: {},
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
      const serverMessage = String(data?.message || "").trim();
      const serverHint = String(data?.hint || "").trim();
      setDiscoveryRun({
        status: "ready",
        message: serverMessage || `Discovery gestartet${agentLabel}.${apiLabel}${serverHint ? ` ${serverHint}` : ""}`,
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

  const cveOverview = useMemo(() => {
    const agents = Array.isArray(cveScan.agents) ? cveScan.agents : [];
    let findingPrograms = 0;
    let totalCves = 0;
    let updateCandidates = 0;
    agents.forEach((agent) => {
      const findings = Array.isArray(agent?.findings) ? agent.findings : [];
      findings.forEach((finding) => {
        findingPrograms += 1;
        const cves = Array.isArray(finding?.cves) ? finding.cves : [];
        totalCves += cves.length;
        const latest = latestFixedVersion(finding);
        if (latest) updateCandidates += 1;
      });
    });
    return {
      findingPrograms,
      totalCves,
      updateCandidates,
    };
  }, [cveScan.agents]);

  const grouped = useMemo(() => {
    const groups = { STABLE: [], POTENTIAL: [], ATTENTION: [], RISK: [], INACTIVE: [] };
    filteredContexts.forEach((item) => {
      const key = groups[item.developmentState] ? item.developmentState : "STABLE";
      groups[key].push(item);
    });
    return groups;
  }, [filteredContexts]);

  const neglectedCustomers = useMemo(() => {
    return filteredContexts
      .map((item) => {
        const score = neglectScore(item);
        return {
          item,
          score,
          callPoints: callFocusPoints(item),
        };
      })
      .filter((entry) => entry.score >= 35 || Boolean(entry.item?.contactDue) || Boolean(entry.item?.invoiceActivityDue))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aDays = Number(a.item?.daysSinceInteraction || 0);
        const bDays = Number(b.item?.daysSinceInteraction || 0);
        return bDays - aDays;
      });
  }, [filteredContexts]);

  const neglectedStats = useMemo(() => {
    const overdueByContact = filteredContexts.filter((item) => Boolean(item?.contactDue)).length;
    const overdueByInvoice = filteredContexts.filter((item) => Boolean(item?.invoiceActivityDue)).length;
    const highPriority = neglectedCustomers.filter((entry) => entry.score >= 60).length;
    return {
      overdueByContact,
      overdueByInvoice,
      highPriority,
    };
  }, [filteredContexts, neglectedCustomers]);

  const revenueBars = revenueComparisonPercents(
    detailData?.revenueLastYearEur,
    detailData?.revenueCurrentYearEur
  );
  const detailPriorityTier = getPriorityTier(detailData || {});
  const workSummaryTags = deriveWorkSummaryTags(
    detailData?.workSummary?.summary,
    detailData?.workSummary?.items || []
  );
  const workHighlights = useMemo(
    () => deriveWorkHighlights(detailData?.workSummary?.summary, detailData?.workSummary?.items || [], 5),
    [detailData?.workSummary?.summary, detailData?.workSummary?.items]
  );
  const detailSignals = useMemo(() => deriveDisplaySignals(detailData || {}, 5), [detailData]);
  const infraActionHints = useMemo(() => buildInfraActionHints(detailData || {}), [detailData]);
  const overviewBusinessRecommendations = useMemo(() => {
    const source = detailData?.recommendations || detailData?.topRecommendations || [];
    if (!Array.isArray(source)) return [];
    return source
      .filter((rec) => {
        const recType = String(rec?.type || "").toLowerCase();
        return recType !== "security" && recType !== "lifecycle";
      })
      .slice(0, 3);
  }, [detailData]);
  return (
      <div className="min-h-screen bg-sand-50 text-sand-900">
      {detailModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 p-3 sm:p-4">
          <div className="flex h-[calc(100dvh-1.5rem)] max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Details</p>
                <h3 className="text-lg font-display text-sand-900">
                  {detailModal.customerName || "Kunde"} · Kundenanalyse
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadDetail(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                >
                  <RefreshCw size={11} />
                  Aktualisieren
                </button>
                <button
                  type="button"
                  onClick={() => createTask(actionSuggestions?.[0]?.title || "Follow-up Kundenentwicklung")}
                  className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                >
                  <Plus size={11} />
                  Aufgabe
                </button>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                  title="Schließen"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="border-b border-sand-200 bg-white px-5 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "overview", label: "Übersicht", icon: Eye },
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
                <button
                  type="button"
                  onClick={() => setDetailTab("ki")}
                  className={`ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                    detailTab === "ki"
                      ? "border-sand-900 bg-sand-900 text-white"
                      : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                  }`}
                >
                  <Sparkles size={11} />
                  KI Unterstützung
                </button>
              </div>
            </div>
            {detailData ? (
              <div className="border-b border-sand-200 bg-sand-50 px-5 py-2">
                <div className="grid gap-1.5 md:grid-cols-5 text-[11px]">
                  <div className="rounded-lg border border-sand-200 bg-white px-2 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Status</p>
                    <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${stateBadgeClass(detailData.developmentState)}`}>
                      {detailData.developmentState || "STABLE"}
                    </span>
                  </div>
                  <div className="rounded-lg border border-sand-200 bg-white px-2 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Risiko</p>
                    <p className="text-sm font-semibold text-sand-900">{detailData.riskScore ?? 0}/100</p>
                  </div>
                  <div className="rounded-lg border border-sand-200 bg-white px-2 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Priorität</p>
                    <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${detailPriorityTier.badgeClass}`}>
                      {detailPriorityTier.label}
                    </span>
                  </div>
                  <div className="rounded-lg border border-sand-200 bg-white px-2 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Kontakt</p>
                    <p className="text-sm text-sand-800">
                      {typeof detailData.daysSinceInteraction === "number"
                        ? `vor ${detailData.daysSinceInteraction} Tagen`
                        : "n/a"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-sand-200 bg-white px-2 py-1">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Letzte Rechnung</p>
                    <p className="text-sm text-sand-800">
                      {typeof detailData.daysSinceLastInvoice === "number"
                        ? `vor ${detailData.daysSinceLastInvoice} Tagen`
                        : "n/a"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-auto bg-sand-50 p-5">
              {detailStatus === "loading" ? (
                <LoadingProgress label="Lade Analytics" progress={detailProgress} />
              ) : detailStatus === "error" ? (
                <p className="text-sm text-rose-600">Details konnten nicht geladen werden.</p>
              ) : detailData ? (
                <div className="space-y-4">
                  {detailTab === "ki" ? (
                    <div className="rounded-2xl border border-sand-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">KI Unterstützung</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                          const running = isAiActionRunning(detailModal.customerId, "aktivierung_call");
                          return (
                        <button
                          type="button"
                          onClick={() => runAiAssist("aktivierung_call")}
                          disabled={aiBusy}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-900 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
                        >
                          {running ? <InlineSpinner /> : <Sparkles size={11} />}
                          {running ? "Lädt..." : "Telefonleitfaden jetzt"}
                        </button>
                          );
                        })()}
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {aiModes.map((item) => {
                            const running = isAiActionRunning(detailModal.customerId, item.value);
                            return (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => runAiAssist(item.value)}
                                disabled={aiBusy}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide disabled:cursor-wait disabled:opacity-70 ${
                                  detailAi.mode === item.value
                                    ? "border-sand-900 bg-sand-900 text-white"
                                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                                }`}
                              >
                                {running ? <InlineSpinner /> : <Sparkles size={11} />}
                                {running ? "Lädt..." : item.label}
                              </button>
                            );
                          })}
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
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="rounded-2xl border border-sand-200 bg-white p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Umsatzvergleich</p>
                      <div className="mt-1.5 space-y-1.5">
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-sand-600">
                            <span>Vorjahr</span>
                            <span>{formatEur(detailData.revenueLastYearEur)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-sand-100">
                            <div className="h-1.5 rounded-full bg-sand-500" style={{ width: `${revenueBars.lastPct}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-sand-600">
                            <span>Aktuelles Jahr</span>
                            <span>{formatEur(detailData.revenueCurrentYearEur)}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-sand-100">
                            <div
                              className={`h-1.5 rounded-full ${
                                Number(detailData.revenueTrendPct || 0) < 0 ? "bg-rose-400" : "bg-emerald-500"
                              }`}
                              style={{ width: `${revenueBars.currentPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[10px] text-sand-600">Trend: {formatPct(detailData.revenueTrendPct)}</p>
                    </div>

                    <div className="rounded-2xl border border-sand-200 bg-white p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Risikozusammensetzung</p>
                      <div className="mt-1.5 space-y-1.5">
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-sand-600">
                            <span>Business</span>
                            <span>{detailData.businessRisk ?? 0}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-sand-100">
                            <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${clampPercent(detailData.businessRisk)}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-sand-600">
                            <span>Infrastruktur</span>
                            <span>{detailData.infrastructureRisk ?? 0}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-sand-100">
                            <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${clampPercent(detailData.infrastructureRisk)}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Signale</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {detailSignals.map((signal, idx) => (
                            <span key={`${signal}-${idx}`} className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] text-sand-700">
                              {signal}
                            </span>
                          ))}
                          {!detailSignals.length ? (
                            <span className="text-[10px] text-sand-500">Keine besonderen Signale.</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Empfehlungen</p>
                        <div className="mt-1 space-y-1">
                          {overviewBusinessRecommendations.map((rec, idx) => (
                            <p key={`${rec?.title || "r"}-${idx}`} className="text-[11px] text-sand-700">
                              <span className="font-semibold">{rec?.title || "Empfehlung"}:</span>{" "}
                              {compactWorkSnippet(rec?.why || "", 120)}
                            </p>
                          ))}
                          {!overviewBusinessRecommendations.length ? (
                            <p className="text-[10px] text-sand-500">Keine Empfehlungen vorhanden.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sand-200 bg-white p-3">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Handlungsempfehlungen</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {infraActionHints.length ? (
                        infraActionHints.map((rec, idx) => {
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

                  <div className="rounded-2xl border border-sand-200 bg-white p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Letzte Arbeiten (Rechnungen)</p>
                      <button
                        type="button"
                        onClick={() => setWorkItemsExpanded((prev) => !prev)}
                        disabled={!(detailData.workSummary?.items || []).length}
                        className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {workItemsExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        {workItemsExpanded
                          ? "Rechnungen ausblenden"
                          : (detailData.workSummary?.items || []).length
                            ? `Top ${Math.min(5, (detailData.workSummary?.items || []).length)} anzeigen`
                            : "Keine Rechnungen"}
                      </button>
                    </div>
                    <div className="mt-1.5 rounded-lg border border-sand-200 bg-sand-50 px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Stichworte</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {workSummaryTags.map((tag) => (
                          <span key={tag} className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 space-y-1">
                        {workHighlights.map((line, idx) => (
                          <p key={`work-highlight-${idx}`} className="flex items-start gap-1 text-[11px] leading-5 text-sand-700">
                            <span className="mt-0.5 text-sand-400">•</span>
                            <span>{line}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                    {workItemsExpanded ? (
                      <div className="mt-2 space-y-1.5">
                        {(detailData.workSummary?.items || []).slice(0, 5).map((row, idx) => {
                          const invoiceLabel = row.invoiceNumber || `Rechnung #${row.invoiceId || "n/a"}`;
                          const snippets = (row.positionSnippets || [])
                            .map((snippet) => normalizeWorkSnippet(snippet))
                            .filter(Boolean);
                          const categories = [...new Set(snippets.map((snippet) => classifyWorkSnippet(snippet)))].slice(0, 3);
                          return (
                          <div
                            key={`work-row-${row.invoiceId || idx}`}
                            className="rounded-lg border border-sand-200 bg-sand-50 px-2 py-2"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-sand-900">{invoiceLabel}</span>
                              <span className="rounded-full border border-sand-200 bg-white px-1.5 py-0.5 text-[10px] text-sand-600">
                                {row.date || "n/a"}
                              </span>
                              <span className="rounded-full border border-sand-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-sand-800">
                                {formatEur(row.amountEur)}
                              </span>
                              {categories.map((category) => (
                                <span
                                  key={`${invoiceLabel}-${category}`}
                                  className="rounded-full border border-sand-200 bg-white px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sand-700"
                                >
                                  {category}
                                </span>
                              ))}
                            </div>
                            <div className="mt-1.5 space-y-1">
                              {(snippets.length ? snippets : ["Keine Positionsdetails vorhanden."]).slice(0, 3).map((line, lineIdx) => (
                                <p key={`${invoiceLabel}-line-${lineIdx}`} className="flex items-start gap-1 text-[11px] leading-5 text-sand-700">
                                  <span className="mt-0.5 text-sand-400">•</span>
                                  <span>{compactWorkSnippet(line, 200)}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                        })}
                        {!(detailData.workSummary?.items || []).length ? (
                          <p className="text-xs text-sand-500">Keine Rechnungspositionen für die letzten Arbeiten gefunden.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-sand-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Kundenbriefing</p>
                      <button
                        type="button"
                        onClick={() => setDetailTab("ki")}
                        className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-sand-50 p-1.5 text-sand-600 hover:bg-sand-100"
                        title="KI Unterstützung"
                        aria-label="KI Unterstützung"
                      >
                        <Sparkles size={12} />
                      </button>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {callFocusPoints(detailData || {}).map((line, idx) => (
                        <li key={`call-brief-${idx}`} className="text-sm text-sand-700">
                          - {line}
                        </li>
                      ))}
                    </ul>
                    {!callFocusPoints(detailData || {}).length ? (
                      <p className="mt-1 text-xs text-sand-500">Keine akuten Gesprächspunkte erkannt.</p>
                    ) : null}
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
                      {(() => {
                        const activeDiscoveryDevices = (detailData?.discoveredInfrastructureDevices || []).filter(
                          (device) => device?.active !== false
                        );
                        return (
                          <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">RMM Agents</p>
                          <p className="text-xs font-semibold text-sand-800">
                            {(detailData.managedInfrastructureDevices || []).length}
                          </p>
                        </div>
                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Discovery Geräte</p>
                          <p className="text-xs font-semibold text-sand-800">
                            {activeDiscoveryDevices.length}
                          </p>
                        </div>
                      </div>
                      {detailData?.infra?.rmmMappingHint &&
                      (detailData?.managedInfrastructureDevices || []).length === 0 ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2">
                          <p className="text-xs text-amber-800">{detailData.infra.rmmMappingHint}</p>
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">RMM Agenten</p>
                        {(detailData.managedInfrastructureDevices || []).length ? (
                          (detailData.managedInfrastructureDevices || []).map((device, idx) => {
                            const expanded = Boolean(expandedInfraAgents[device?.agentId || `idx-${idx}`]);
                            const errorCount = Number(device?.errorCount || 0);
                            const warningCount = Number(device?.warningCount || 0);
                            const updatesCount = Number(device?.openUpdates || 0);
                            const lifecycle = resolveAgentLifecycle(device);
                            const lifecycleStatus = String(lifecycle?.status || "").toLowerCase();
                            const lifecycleLabel =
                              lifecycleStatus === "expired"
                                ? "EOL erreicht"
                                : lifecycleStatus === "soon"
                                  ? "EOL bald"
                                  : "";
                            const lifecycleClass =
                              lifecycleStatus === "expired"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : lifecycleStatus === "soon"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700";
                            return (
                              <div key={`${device?.agentId || idx}`} className="rounded-xl border border-sand-200 bg-white p-2 text-xs text-sand-700 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sand-200 bg-sand-50 text-sand-700">
                                      {(() => {
                                        const AgentIcon = getAgentIcon(device);
                                        return <AgentIcon size={14} />;
                                      })()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-sand-900">{device?.hostname || "Unbekannter Agent"}</p>
                                      <p className="truncate text-[10px] text-sand-500">
                                        {device?.client || "Client n/a"} · {device?.site || "Site n/a"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-1.5">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${
                                        typeof device?.online === "boolean"
                                          ? device.online
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                            : "border-rose-200 bg-rose-50 text-rose-700"
                                          : "border-sand-200 bg-white text-sand-600"
                                      }`}
                                    >
                                      {typeof device?.online === "boolean" ? (device.online ? "Online" : "Offline") : "Status n/a"}
                                    </span>
                                    {lifecycleLabel ? (
                                      <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wide ${lifecycleClass}`}>
                                        {lifecycleLabel}
                                      </span>
                                    ) : null}
                                    <div className="flex flex-col items-stretch gap-1">
                                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] uppercase tracking-wide text-rose-700">
                                        E {errorCount}
                                      </span>
                                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] uppercase tracking-wide text-amber-700">
                                        W {warningCount}
                                      </span>
                                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] uppercase tracking-wide text-sky-700">
                                        U {updatesCount}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedInfraAgents((prev) => ({
                                          ...prev,
                                          [device?.agentId || `idx-${idx}`]: !prev[device?.agentId || `idx-${idx}`]
                                        }))
                                      }
                                      className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[9px] uppercase tracking-wide hover:bg-sand-100"
                                    >
                                      {expanded ? "Details ausblenden" : "Details anzeigen"}
                                      {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-sand-600">
                                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5">
                                    OS: {device?.os || "n/a"}
                                  </span>
                                  <span className={`rounded-full border px-2 py-0.5 ${lifecycleClass}`}>
                                    EOL: {lifecycle?.eol_date || "n/a"}
                                  </span>
                                </div>

                                {expanded ? (
                                  <div className="mt-1.5 rounded-lg border border-sand-200 bg-sand-50 px-2 py-1.5 text-[10px] text-sand-700 space-y-1">
                                    <p>
                                      <span className="font-semibold text-sand-800">Updates:</span> {updatesCount}
                                      {" "} (Windows {Number(device?.windowsUpdates || 0)} · 3rd-Party {Number(device?.thirdPartyUpdates || 0)} · CVE {Number(device?.openCves || 0)})
                                    </p>
                                    {lifecycleStatus === "expired" ? (
                                      <p className="text-rose-700">
                                        <span className="font-semibold">OS Lifecycle:</span> Support abgelaufen (EOL {lifecycle?.eol_date || "n/a"})
                                      </p>
                                    ) : lifecycleStatus === "soon" ? (
                                      <p className="text-amber-700">
                                        <span className="font-semibold">OS Lifecycle:</span> Support endet bald (EOL {lifecycle?.eol_date || "n/a"})
                                      </p>
                                    ) : (
                                      <p className="text-emerald-700">
                                        <span className="font-semibold">OS Lifecycle:</span> Support aktiv
                                      </p>
                                    )}
                                    <p className="inline-flex items-center gap-1 text-sand-600"><Clock3 size={11} /> Last Seen: {formatDateTime(device?.lastSeen)}</p>
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
                        {activeDiscoveryDevices.length ? (
                          activeDiscoveryDevices.map((device, idx) => (
                            <div
                              key={`${device?.ip || device?.mac || device?.hostname || idx}`}
                              className="grid items-center gap-2 rounded-lg border border-sand-200 bg-white px-2 py-1.5 text-xs text-sand-700 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)]"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-sand-200 bg-sand-50 text-sand-700">
                                  {(() => {
                                    const DiscoveryIcon = getDiscoveryIcon(device);
                                    return <DiscoveryIcon size={12} />;
                                  })()}
                                </div>
                                <p className="truncate text-[11px] font-semibold text-sand-800">
                                  {device?.hostname || device?.ip || "Unbekanntes Gerät"}
                                </p>
                                <span className="shrink-0 rounded-full border border-sand-200 bg-sand-50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-sand-600">
                                  {formatDiscoveryTypeLabel(device?.deviceType)}
                                </span>
                                {device?.vendor ? (
                                  <span className="shrink-0 rounded-full border border-sand-200 bg-sand-50 px-1.5 py-0.5 text-[9px] text-sand-600">
                                    {String(device.vendor)}
                                  </span>
                                ) : null}
                              </div>
                              <div className="truncate text-[10px] text-sand-600">
                                {device?.ip ? `IP ${device.ip}` : "IP n/a"}
                                {device?.mac ? ` · MAC ${device.mac}` : ""}
                                {device?.protocol ? ` · ${String(device.protocol).toUpperCase()}` : ""}
                              </div>
                              <div className="truncate text-right text-[10px] text-sand-500">
                                {device?.source || "Discovery"}
                                {typeof device?.confidence === "number"
                                  ? ` · ${Math.max(0, Math.min(100, Number(device.confidence || 0)))}%`
                                  : ""}
                                {device?.lastSeenAt ? ` · ${formatDateTime(device.lastSeenAt)}` : ""}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-sand-500">
                            Noch keine Discovery-Geräte vorhanden. Starte den Scan über den Button oben.
                          </p>
                        )}
                      </div>
                          </>
                        );
                      })()}
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
                          <div className="grid gap-2 sm:grid-cols-4">
                            <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-sand-500">Geprüfte Software</p>
                              <p className="text-sm font-semibold text-sand-800">{Number(cveScan.scannedSoftware || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-sand-500">RMM Agents</p>
                              <p className="text-sm font-semibold text-sand-800">{Number(cveScan.matchedAgents || 0)}</p>
                            </div>
                            <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-sand-500">Betroffene Programme</p>
                              <p className="text-sm font-semibold text-amber-700">{cveOverview.findingPrograms}</p>
                            </div>
                            <div className="rounded-xl border border-sand-200 bg-sand-50 p-2">
                              <p className="text-[10px] uppercase tracking-wide text-sand-500">Updates möglich</p>
                              <p className="text-sm font-semibold text-rose-700">{cveOverview.updateCandidates}</p>
                            </div>
                          </div>
                          <p className="text-xs text-sand-500">
                            Datenstand: {cveScan.fromCache ? "Cache" : "Live"} · CVE-Einträge: {cveOverview.totalCves}
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
                            <div className="space-y-2">
                              {(cveScan.agents || []).map((agent, idx) => {
                                const findings = Array.isArray(agent?.findings) ? agent.findings : [];
                                const softwareRows = Array.isArray(agent?.software) ? agent.software : [];
                                const findingByNameVersion = new Map();
                                const findingByName = new Map();
                                findings.forEach((finding) => {
                                  const nameKey = normalizeTextKey(finding?.name);
                                  const versionKey = normalizeTextKey(finding?.version);
                                  if (!nameKey) return;
                                  if (versionKey) findingByNameVersion.set(`${nameKey}|${versionKey}`, finding);
                                  if (!findingByName.has(nameKey)) findingByName.set(nameKey, finding);
                                });
                                const resolveFinding = (pkg) => {
                                  const nameKey = normalizeTextKey(pkg?.name);
                                  const versionKey = normalizeTextKey(pkg?.version);
                                  if (!nameKey) return null;
                                  return findingByNameVersion.get(`${nameKey}|${versionKey}`) || findingByName.get(nameKey) || null;
                                };
                                const rows = softwareRows.map((pkg) => {
                                  const finding = resolveFinding(pkg);
                                  const latestVersion = latestFixedVersion(finding);
                                  const cveCount = Array.isArray(finding?.cves) ? finding.cves.length : 0;
                                  const highestScore = maxCveScore(finding);
                                  const hasFinding = Boolean(finding) && (cveCount > 0 || Boolean(latestVersion));
                                  const currentVersion = String(pkg?.version || "").trim();
                                  const updateAvailable =
                                    hasFinding && Boolean(latestVersion) && (!currentVersion || isNewerVersion(latestVersion, currentVersion));
                                  return {
                                    name: String(pkg?.name || "Unbekannt"),
                                    currentVersion,
                                    latestVersion,
                                    cveCount,
                                    highestScore,
                                    hasFinding,
                                    updateAvailable,
                                  };
                                });
                                const sortedRows = [...rows].sort((left, right) => {
                                  if (left.updateAvailable !== right.updateAvailable) return Number(right.updateAvailable) - Number(left.updateAvailable);
                                  if (left.hasFinding !== right.hasFinding) return Number(right.hasFinding) - Number(left.hasFinding);
                                  if ((left.cveCount || 0) !== (right.cveCount || 0)) return (right.cveCount || 0) - (left.cveCount || 0);
                                  if ((left.highestScore || 0) !== (right.highestScore || 0)) return (right.highestScore || 0) - (left.highestScore || 0);
                                  return String(left.name || "").localeCompare(String(right.name || ""), "de", { sensitivity: "base" });
                                });
                                const relevantRows = sortedRows.filter((row) => row.hasFinding || row.updateAvailable);
                                const agentKey = String(agent?.agentId || `agent-${idx}`);
                                const showAllRows = Boolean(expandedCveAgents[agentKey]);
                                const rowsToRender = showAllRows ? sortedRows : relevantRows;
                                const hiddenRows = Math.max(0, sortedRows.length - rowsToRender.length);
                                const agentUpdates = findings.filter((item) => Boolean(latestFixedVersion(item))).length;
                                return (
                                  <div key={agentKey} className="rounded-xl border border-sand-200 bg-sand-50 p-2 space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-semibold text-sand-800">{agent?.hostname || "Unbekannter Agent"}</p>
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] text-sand-600">
                                          Software {Number(agent?.softwareCount || 0)}
                                        </span>
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                                          Treffer {Number(agent?.findingCount || 0)}
                                        </span>
                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">
                                          Updates {agentUpdates}
                                        </span>
                                        {sortedRows.length > relevantRows.length ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedCveAgents((prev) => ({
                                                ...prev,
                                                [agentKey]: !prev[agentKey],
                                              }))
                                            }
                                            className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] text-sand-700 hover:bg-sand-100"
                                          >
                                            {showAllRows ? "Nur Treffer" : `Alle ${sortedRows.length}`}
                                          </button>
                                        ) : null}
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-sand-600">
                                      {agent?.client || "Client n/a"} · {agent?.site || "Site n/a"} · {typeof agent?.online === "boolean" ? (agent.online ? "Online" : "Offline") : "Status n/a"} · Last Seen: {agent?.lastSeen || "n/a"}
                                    </p>
                                    {rowsToRender.length ? (
                                      <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white">
                                        <table className="min-w-full text-[11px]">
                                          <thead className="bg-sand-100 text-sand-600 uppercase tracking-wide">
                                            <tr>
                                              <th className="px-2 py-1.5 text-left">Programm</th>
                                              <th className="px-2 py-1.5 text-left">Aktuell</th>
                                              <th className="px-2 py-1.5 text-left">Neuere Version</th>
                                              <th className="px-2 py-1.5 text-left">CVEs</th>
                                              <th className="px-2 py-1.5 text-left">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {rowsToRender.map((row, rowIdx) => {
                                              const statusText = row.updateAvailable
                                                ? "Update verfügbar"
                                                : row.hasFinding
                                                ? "Prüfen"
                                                : "Kein Treffer";
                                              return (
                                                <tr key={`${row.name}-${row.currentVersion || "na"}-${rowIdx}`} className={rowIdx % 2 === 0 ? "bg-white" : "bg-sand-50/60"}>
                                                  <td className="px-2 py-1.5 text-sand-800">{row.name || "Unbekannt"}</td>
                                                  <td className="px-2 py-1.5 text-sand-700">{row.currentVersion || "n/a"}</td>
                                                  <td className="px-2 py-1.5 text-sand-700">{row.latestVersion || "—"}</td>
                                                  <td className="px-2 py-1.5 text-sand-700">
                                                    {row.cveCount}
                                                    {row.highestScore !== null ? ` · max ${row.highestScore}` : ""}
                                                  </td>
                                                  <td className="px-2 py-1.5">
                                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${cveStatusBadge(row)}`}>{statusText}</span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : null}
                                    {!showAllRows && hiddenRows > 0 ? (
                                      <p className="text-[11px] text-sand-500">
                                        {hiddenRows} Programme ohne CVE-Hinweis ausgeblendet.
                                      </p>
                                    ) : null}
                                    {!sortedRows.length && Number(agent?.softwareCount || 0) > 0 ? (
                                      <p className="text-[11px] text-sand-500">Programm-Liste im Cache noch nicht enthalten. Bitte „Neu scannen“.</p>
                                    ) : null}
                                    {!sortedRows.length && Number(agent?.softwareCount || 0) === 0 ? (
                                      <p className="text-[11px] text-sand-500">Keine auswertbare Softwareliste auf diesem Agent.</p>
                                    ) : null}
                                    {sortedRows.length > 0 && relevantRows.length === 0 && !showAllRows ? (
                                      <p className="text-[11px] text-emerald-700">Keine CVE-Treffer auf diesem Agent.</p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
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

        <div className="grid gap-3 xl:grid-cols-5 items-start">
          <section className="xl:col-span-4 rounded-2xl border border-sand-200 bg-white p-2.5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-2 text-sand-700">
                <ScanSearch size={13} />
                <p className="text-[11px] uppercase tracking-[0.2em] text-sand-500">Filterleiste</p>
                <span className="relative inline-flex items-center group">
                  <button
                    type="button"
                    className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-sand-200 bg-white text-sand-500 hover:bg-sand-100 hover:text-sand-700"
                    aria-label="Prioritätslogik anzeigen"
                  >
                    <Info size={10} />
                  </button>
                  <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-60 -translate-x-1/2 rounded-xl border border-sand-200 bg-white px-2.5 py-2 text-[10px] leading-relaxed text-sand-600 opacity-0 shadow-soft transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    Priorität basiert auf Risiko, Kontakt-/Rechnungsaktivität und Vertragsstatus.
                    Grün: stabil. Orange: beobachten. Rot: Kunde aktivieren.
                  </span>
                </span>
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
                className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
              >
                <X size={11} /> Zurücksetzen
              </button>
            </div>
            <div className="mt-1.5 grid gap-1 sm:grid-cols-2 xl:grid-cols-5 text-[10px]">
              <label className="rounded-lg border border-sand-200 bg-sand-50 px-2 py-1 flex items-center gap-1.5 leading-none">
                <Users size={12} className="text-sand-500" />
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                  className="h-3 w-3"
                />
                Inaktive anzeigen
              </label>
              <label className="rounded-lg border border-sand-200 bg-sand-50 px-2 py-1 flex items-center gap-1.5 leading-none">
                <Shield size={12} className="text-sand-500" />
                <input
                  type="checkbox"
                  checked={filters.noContract}
                  onChange={(event) => setFilters((prev) => ({ ...prev, noContract: event.target.checked }))}
                  className="h-3 w-3"
                />
                Ohne Vertrag
              </label>
              <label className="rounded-lg border border-sand-200 bg-sand-50 px-2 py-1 flex items-center gap-1.5 leading-none">
                <TrendingDown size={12} className="text-sand-500" />
                <input
                  type="checkbox"
                  checked={filters.revenueFalling}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, revenueFalling: event.target.checked }))
                  }
                  className="h-3 w-3"
                />
                Umsatz sinkt
              </label>
              <label className="rounded-lg border border-sand-200 bg-sand-50 px-2 py-1 flex items-center gap-1.5 leading-none">
                <Clock3 size={12} className="text-sand-500" />
                <input
                  type="checkbox"
                  checked={filters.highCommunication}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, highCommunication: event.target.checked }))
                  }
                  className="h-3 w-3"
                />
                Hohe Kommunikationslast
              </label>
              <label className="rounded-lg border border-sand-200 bg-sand-50 px-2 py-1 flex items-center gap-1.5 leading-none">
                <AlertTriangle size={12} className="text-sand-500" />
                <input
                  type="checkbox"
                  checked={filters.infraRisk}
                  onChange={(event) => setFilters((prev) => ({ ...prev, infraRisk: event.target.checked }))}
                  className="h-3 w-3"
                />
                Infrastruktur-Risiko
              </label>
            </div>
            <label className="mt-1.5 block">
              <span className="sr-only">Suche</span>
              <div className="mt-1 relative">
                <Search size={11} className="absolute left-2 top-1.5 text-sand-400" />
                <input
                  value={filters.searchNeedle}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, searchNeedle: event.target.value }))
                  }
                  placeholder="Kunde, Nr., Empfehlung, Signal ..."
                  className="w-full rounded-lg border border-sand-200 bg-white pl-6 pr-2 py-1 text-[11px]"
                />
              </div>
            </label>
          </section>

          <section className="xl:col-span-1 rounded-2xl border border-sand-200 bg-white p-2.5 shadow-soft">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sand-700">
                <Users size={12} />
                <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Radar</p>
              </div>
              <span className="text-[10px] text-sand-500">{neglectedCustomers.length}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                Kontakt {neglectedStats.overdueByContact}
              </span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                Umsetzung {neglectedStats.overdueByInvoice}
              </span>
              <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-sand-700">
                Druck {neglectedStats.highPriority}
              </span>
              {!neglectedCustomers.length ? (
                <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-sand-500">
                  Keine auffälligen Kunden
                </span>
              ) : null}
            </div>
          </section>
        </div>

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
                  <th className="py-2 pr-3">Vertrag & Inventar</th>
                  <th className="py-2 pr-3">Priorität</th>
                  <th className="py-2 pr-3">Kontakt</th>
                  <th className="py-2 pr-3">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredContexts.map((item, index) => {
                  const inventory = inventorySummary(item);
                  const score = neglectScore(item);
                  return (
                  <tr
                    key={item.customerId}
                    className={`cursor-pointer border-t border-sand-100 ${index % 2 === 1 ? "bg-sand-50/70" : "bg-white"} hover:bg-sand-100/60`}
                    onClick={() => openDetail(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDetail(item);
                      }
                    }}
                  >
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
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${
                          Boolean(item.hasMaintenanceContract)
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {contractSummary(item)}
                      </span>
                      <p className="mt-1 text-[11px] text-sand-600">
                        {inventory.text}
                      </p>
                      <p className="text-[10px] text-sand-500">
                        Gesamtinventar (geschätzt): {inventory.total}
                      </p>
                    </td>
                    <td className="py-2 pr-3">
                      <PriorityBar item={item} />
                      <p className="mt-1 text-[10px] text-sand-500">Aktivierungs-Score: {score}</p>
                      <p className="text-[10px] text-sand-500">
                        Thema: {item.topRecommendations?.[0]?.title || "Kein Top-Thema"}
                      </p>
                    </td>
                    <td className="py-2 pr-3">
                      <p className="text-[11px] text-sand-700">
                        Letzter Kontakt:{" "}
                        {typeof item.daysSinceInteraction === "number"
                          ? `${item.daysSinceInteraction} Tage`
                          : "n/a"}
                      </p>
                      <p className="text-[11px] text-sand-700">
                        Letzte Rechnung:{" "}
                        {typeof item.daysSinceLastInvoice === "number"
                          ? `${item.daysSinceLastInvoice} Tage`
                          : "n/a"}
                      </p>
                      {Boolean(item.invoiceActivityDue) ? (
                        <span className="mt-1 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                          Umsetzung stockt
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 hover:bg-sand-100"
                        >
                          <Eye size={12} /> Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openDetail(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                        >
                          <Eye size={11} /> Details
                        </button>
                      </div>
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
