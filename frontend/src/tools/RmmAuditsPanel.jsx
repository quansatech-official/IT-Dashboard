import { Fragment, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronUp, Database, Download, FileText, Filter, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

const API = "/api/rmm/audits";

const STATUS_STYLES = {
  pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fail: "bg-rose-50 text-rose-700 border-rose-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  error: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-slate-100 text-slate-700 border-slate-200"
};

const EMPTY_FILTERS = {
  query: "",
  auditDateFrom: "",
  auditDateTo: "",
  customer: "",
  device: "",
  topic: "",
  status: "",
  latestOnly: false
};

const DEFAULT_SORT = {
  key: "auditAt",
  direction: "desc"
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (!text) return {};
  return JSON.parse(text);
}

function formatDateTime(value) {
  const numeric = Number(value || 0);
  if (!numeric) return "n/a";
  try {
    return new Date(numeric).toLocaleString("de-DE");
  } catch {
    return "n/a";
  }
}

function toDateStartMs(value) {
  if (!value) return 0;
  const parsed = new Date(`${value}T00:00:00`);
  const timestamp = parsed.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toDateEndMs(value) {
  if (!value) return 0;
  const parsed = new Date(`${value}T23:59:59.999`);
  const timestamp = parsed.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.customer) params.set("customer", filters.customer);
  if (filters.device) params.set("device", filters.device);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.status) params.set("status", filters.status);
  const auditAtFrom = toDateStartMs(filters.auditDateFrom);
  const auditAtTo = toDateEndMs(filters.auditDateTo);
  if (auditAtFrom > 0) params.set("audit_at_from", String(auditAtFrom));
  if (auditAtTo > 0) params.set("audit_at_to", String(auditAtTo));
  if (filters.latestOnly) params.set("latest_only", "true");
  const query = params.toString();
  return query ? `${API}?${query}` : API;
}

function formatIsoDate(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("de-DE");
}

function getSecureBootCertificateText(item) {
  if (String(item?.topic || "").trim().toLowerCase() !== "secure-boot") return "";

  const facts = item?.payload?.facts;
  const certificates = Array.isArray(facts?.relevantSecureBootCertificates)
    ? facts.relevantSecureBootCertificates
    : [];

  if (!certificates.length) return "";

  const parts = certificates
    .map((certificate) => {
      const label = String(certificate?.label || certificate?.simpleName || "").trim();
      const notAfter = formatIsoDate(certificate?.notAfter);
      if (!label || !notAfter) return "";
      return `${label} bis ${notAfter}`;
    })
    .filter(Boolean);

  return parts.length ? `Zertifikate: ${parts.join(", ")}` : "";
}

function hasDisplayValue(value) {
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).trim() !== "";
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${
        STATUS_STYLES[status] || STATUS_STYLES.unknown
      }`}
    >
      {status || "unknown"}
    </span>
  );
}

function safeJsonStringify(value, spacing = 0) {
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, spacing);
  } catch {
    return String(value);
  }
}

function isComplexValue(value) {
  if (!hasDisplayValue(value)) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => entry && typeof entry === "object");
  }
  return typeof value === "object";
}

function formatInlineValue(value) {
  if (!hasDisplayValue(value)) return "n/a";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.every((entry) => entry === null || entry === undefined || ["string", "number", "boolean"].includes(typeof entry))) {
      return value.map((entry) => formatInlineValue(entry)).join(", ");
    }
    return `${value.length} Einträge`;
  }
  if (typeof value === "object") {
    return `${Object.keys(value).length} Felder`;
  }
  return String(value);
}

function buildMarkdownField(label, value, headingLevel = 3) {
  if (!hasDisplayValue(value)) return "";
  if (isComplexValue(value)) {
    return [
      `${"#".repeat(headingLevel)} ${label}`,
      "",
      "```json",
      safeJsonStringify(value, 2),
      "```"
    ].join("\n");
  }
  return `- **${label}:** ${formatInlineValue(value)}`;
}

function buildMarkdownObjectSection(title, value, excludedKeys = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const excluded = new Set(excludedKeys);
  const entries = Object.entries(value).filter(([key, entryValue]) => !excluded.has(key) && hasDisplayValue(entryValue));
  if (!entries.length) return "";

  const inlineLines = [];
  const detailBlocks = [];

  entries.forEach(([key, entryValue]) => {
    const label = humanizeKey(key);
    const field = buildMarkdownField(label, entryValue, 3);
    if (!field) return;
    if (isComplexValue(entryValue)) {
      detailBlocks.push(field);
    } else {
      inlineLines.push(field);
    }
  });

  return [
    `## ${title}`,
    inlineLines.join("\n"),
    detailBlocks.join("\n\n")
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildCheckMarkdown(check, index) {
  const lines = [
    `### ${check.label || humanizeKey(check.key || `Check ${index + 1}`)}`,
    `- **Key:** ${check.key || `check-${index + 1}`}`,
    `- **Status:** ${String(check.status || "unknown").toLowerCase()}`
  ];

  const detailBlocks = [];
  ["expected", "actual", "message"].forEach((fieldKey) => {
    const value = check[fieldKey];
    if (!hasDisplayValue(value)) return;
    const label = humanizeKey(fieldKey);
    const field = buildMarkdownField(label, value, 4);
    if (!field) return;
    if (isComplexValue(value)) {
      detailBlocks.push(field);
    } else {
      lines.push(field);
    }
  });

  return [lines.join("\n"), detailBlocks.join("\n\n")].filter(Boolean).join("\n\n");
}

function buildAuditDetailsMarkdown(item) {
  const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
  const checks = Array.isArray(payload.checks)
    ? payload.checks.filter((entry) => entry && typeof entry === "object")
    : [];
  const sections = [];

  sections.push(
    [
      "## Überblick",
      `- **Topic:** ${item.topic || "n/a"}`,
      `- **Status:** ${item.status || "unknown"}`,
      `- **Auditzeit:** ${formatDateTime(item.auditAt)}`,
      `- **Importzeit:** ${formatDateTime(item.importedAt)}`,
      `- **Kunde:** ${item.customerName || "Unbekannter Kunde"}`,
      `- **Gerät:** ${item.deviceName || item.agentHostname || "Unbekanntes Gerät"}`,
      `- **Agent:** ${item.sourceAgentId || "n/a"}`,
      `- **Note:** ${item.sourceNotePk || "n/a"}`,
      `- **Schema:** ${item.schemaName || "n/a"}/${item.schemaVersion || "?"}`
    ].join("\n")
  );

  if (item.summary) {
    sections.push(["## Zusammenfassung", item.summary].join("\n\n"));
  }

  if (item.validationErrors?.length) {
    sections.push(
      ["## Validierung", item.validationErrors.map((entry) => `- ${entry}`).join("\n")].join("\n\n")
    );
  }

  if (checks.length) {
    sections.push(
      [
        "## Checks",
        checks.map((check, index) => buildCheckMarkdown(check, index)).join("\n\n")
      ].join("\n\n")
    );
  }

  const rootSection = buildMarkdownObjectSection("Weitere Felder", payload, [
    "schema",
    "topic",
    "status",
    "summary",
    "collectedAt",
    "customer",
    "device",
    "source",
    "checks",
    "facts",
    "metadata"
  ]);
  const customerSection = buildMarkdownObjectSection("Customer", payload.customer || {});
  const deviceSection = buildMarkdownObjectSection("Device", payload.device || {});
  const sourceSection = buildMarkdownObjectSection("Source", payload.source || {});
  const factsSection = buildMarkdownObjectSection("Facts", payload.facts || {});
  const metadataSection = buildMarkdownObjectSection("Metadata", payload.metadata || {});

  [rootSection, customerSection, deviceSection, sourceSection, factsSection, metadataSection]
    .filter(Boolean)
    .forEach((section) => sections.push(section));

  return sections.join("\n\n");
}

function csvEscape(value = "") {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvFilename(filters) {
  const parts = ["rmm-audits"];
  if (filters.customer) parts.push(filters.customer);
  if (filters.device) parts.push(filters.device);
  if (filters.topic) parts.push(filters.topic);
  if (filters.status) parts.push(filters.status);
  if (filters.latestOnly) parts.push("latest");
  if (parts.length === 1) parts.push("alle");
  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "rmm-audits-export";
  return `${slug}.csv`;
}

function getSortValue(item, key) {
  switch (key) {
    case "customer":
      return String(item.customerName || "").toLocaleLowerCase("de-DE");
    case "device":
      return String(item.deviceName || item.agentHostname || "").toLocaleLowerCase("de-DE");
    case "topic":
      return String(item.topic || "").toLocaleLowerCase("de-DE");
    case "status":
      return String(item.status || "").toLocaleLowerCase("de-DE");
    case "summary":
      return String(item.summary || "").toLocaleLowerCase("de-DE");
    case "auditAt":
      return Number(item.auditAt || 0);
    case "importedAt":
      return Number(item.importedAt || 0);
    case "isLatest":
      return item.isLatest ? 1 : 0;
    default:
      return "";
  }
}

function sortAuditItems(items, sortConfig) {
  const directionFactor = sortConfig.direction === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = getSortValue(left, sortConfig.key);
    const rightValue = getSortValue(right, sortConfig.key);

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      if (leftValue === rightValue) return 0;
      return leftValue > rightValue ? directionFactor : -directionFactor;
    }

    const comparison = String(leftValue).localeCompare(String(rightValue), "de-DE", {
      numeric: true,
      sensitivity: "base"
    });
    return comparison * directionFactor;
  });
}

export default function RmmAuditsPanel() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [items, setItems] = useState([]);
  const [availableFilters, setAvailableFilters] = useState({
    customers: [],
    devices: [],
    topics: [],
    statuses: []
  });
  const [meta, setMeta] = useState({ totalRecords: 0, latestRecords: 0, lastImportedAt: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [cleanupScope, setCleanupScope] = useState("");
  const [cleanupResult, setCleanupResult] = useState(null);
  const [openDetailId, setOpenDetailId] = useState(null);
  const [sortConfig, setSortConfig] = useState(DEFAULT_SORT);

  const applySnapshot = (data) => {
    setItems(Array.isArray(data.items) ? data.items : []);
    setAvailableFilters(
      data.filters || {
        customers: [],
        devices: [],
        topics: [],
        statuses: []
      }
    );
    setMeta(
      data.meta || {
        totalRecords: 0,
        latestRecords: 0,
        lastImportedAt: 0
      }
    );
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchJson(buildQuery(filters));
        if (cancelled) return;
        applySnapshot(data);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Audits konnten nicht geladen werden.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setOpenDetailId(null);
  };

  const importAudits = async () => {
    setImporting(true);
    setError("");
    setCleanupResult(null);
    try {
      const result = await fetchJson(`${API}/import`, { method: "POST" });
      setImportResult(result);
      const refreshed = await fetchJson(buildQuery(filters));
      applySnapshot(refreshed);
    } catch (importError) {
      setError(importError.message || "Import fehlgeschlagen.");
    } finally {
      setImporting(false);
    }
  };

  const cleanupAudits = async (scope) => {
    const payload = { scope };
    let confirmationText = "Alle QT-AUDIT-Agent-Notes in TacticalRMM wirklich bereinigen?";

    if (scope === "customer") {
      if (!filters.customer) {
        setError("Für die Bereinigung pro Kunde muss zuerst ein Kunde gewählt werden.");
        return;
      }
      payload.customer = filters.customer;
      confirmationText = `Alle QT-AUDIT-Agent-Notes für ${filters.customer} wirklich bereinigen?`;
    }

    if (scope === "topic") {
      if (!filters.topic) {
        setError("Für die Bereinigung pro Topic muss zuerst ein Topic gewählt werden.");
        return;
      }
      payload.topic = filters.topic;
      confirmationText = `Alle QT-AUDIT-Agent-Notes für Topic ${filters.topic} wirklich bereinigen?`;
    }

    if (!window.confirm(confirmationText)) {
      return;
    }

    setCleanupScope(scope);
    setError("");
    setImportResult(null);
    try {
      const result = await fetchJson(`${API}/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setCleanupResult(result);
      const refreshed = await fetchJson(buildQuery(filters));
      applySnapshot(refreshed);
    } catch (cleanupError) {
      setError(cleanupError.message || "Bereinigung fehlgeschlagen.");
    } finally {
      setCleanupScope("");
    }
  };

  const toggleDetails = (itemId) => {
    setOpenDetailId((current) => (current === itemId ? null : itemId));
  };

  const toggleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc"
        };
      }
      return {
        key,
        direction: "desc"
      };
    });
  };

  const sortedItems = sortAuditItems(items, sortConfig);

  const exportCsv = () => {
    const header = [
      "Kunde",
      "Gerät",
      "Agent-Hostname",
      "Topic",
      "Status",
      "Summary",
      "Auditzeit",
      "Importzeit",
      "Quelle Agent-ID",
      "Quelle Note-PK",
      "Schema",
      "Neuester Datensatz",
      "Validierungsfehler",
      "Details Markdown",
      "Payload JSON"
    ];

    const rows = sortedItems.map((item) => [
      item.customerName || "",
      item.deviceName || "",
      item.agentHostname || "",
      item.topic || "",
      item.status || "",
      item.summary || "",
      formatDateTime(item.auditAt),
      formatDateTime(item.importedAt),
      item.sourceAgentId || "",
      item.sourceNotePk || "",
      `${item.schemaName || ""}/${item.schemaVersion || ""}`,
      item.isLatest ? "Ja" : "Nein",
      Array.isArray(item.validationErrors) ? item.validationErrors.join(" | ") : "",
      buildAuditDetailsMarkdown(item),
      safeJsonStringify(item.payload)
    ]);

    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildCsvFilename(filters);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const renderSortButton = (key, label, className = "") => {
    const isActive = sortConfig.key === key;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-1 font-medium hover:text-sand-700 ${className}`}
        title={`${label} sortieren`}
      >
        <span>{label}</span>
        {isActive ? (
          sortConfig.direction === "asc" ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )
        ) : (
          <ChevronDown size={14} className="opacity-30" />
        )}
      </button>
    );
  };

  return (
    <section className="rounded-3xl border border-sand-200 bg-white shadow-soft">
      <div className="flex flex-col gap-4 border-b border-sand-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sand-700">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sand-900 text-white">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">RMM-Audits</p>
              <h2 className="text-lg font-display text-sand-900">Audit-Notes</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-sand-500">
            <span className="rounded-full bg-sand-100 px-3 py-1">Gesamt: {meta.totalRecords || 0}</span>
            <span className="rounded-full bg-sand-100 px-3 py-1">Neueste: {meta.latestRecords || 0}</span>
            <span className="rounded-full bg-sand-100 px-3 py-1">
              Letzter Import: {formatDateTime(meta.lastImportedAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={importAudits}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} className={importing ? "animate-spin" : ""} />
            {importing ? "Import läuft" : "Import starten"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-sand-700 hover:bg-sand-100"
          >
            <Filter size={14} />
            Filter zurücksetzen
          </button>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {importResult ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {Number(importResult.matchedNotes || 0) === 0 ? (
              <>
                Keine passenden <code>[QT-AUDIT]</code>-Notes gefunden.
              </>
            ) : (
              <>
                Import: {importResult.imported || 0} neu, {importResult.updated || 0} aktualisiert,{" "}
                {importResult.invalid || 0} fehlerhaft, {importResult.skipped || 0} übersprungen.
              </>
            )}
          </div>
        ) : null}

        {cleanupResult ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Bereinigung: {cleanupResult.deletedNotes || 0} Notes in RMM gelöscht, {cleanupResult.deletedRecords || 0}{" "}
            lokale Records entfernt, {cleanupResult.failedDeletes || 0} Fehler.
            {cleanupResult.scope === "customer" && cleanupResult.customer
              ? ` Kunde: ${cleanupResult.customer}.`
              : cleanupResult.scope === "topic" && cleanupResult.topic
                ? ` Topic: ${cleanupResult.topic}.`
                : " Scope: gesamt."}
            {cleanupResult.errors?.length ? (
              <div className="mt-2 text-xs text-amber-800">
                {cleanupResult.errors.slice(0, 3).join(" | ")}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <label className="space-y-1 xl:col-span-2">
            <span className="text-xs uppercase tracking-wide text-sand-500">Freitext</span>
            <input
              type="text"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Kunde, Gerät, Topic, Hinweis"
              className="w-full rounded-2xl border border-sand-300 bg-white px-3 py-2 text-sm text-sand-800"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-sand-500">Von</span>
            <input
              type="date"
              value={filters.auditDateFrom}
              onChange={(event) => updateFilter("auditDateFrom", event.target.value)}
              className="w-full rounded-2xl border border-sand-300 bg-white px-3 py-2 text-sm text-sand-800"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-sand-500">Bis</span>
            <input
              type="date"
              value={filters.auditDateTo}
              onChange={(event) => updateFilter("auditDateTo", event.target.value)}
              className="w-full rounded-2xl border border-sand-300 bg-white px-3 py-2 text-sm text-sand-800"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-sand-500">Kunde</span>
            <select
              value={filters.customer}
              onChange={(event) => updateFilter("customer", event.target.value)}
              className="w-full rounded-2xl border border-sand-300 bg-white px-3 py-2 text-sm text-sand-800"
            >
              <option value="">Alle Kunden</option>
              {availableFilters.customers.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-sand-500">Gerät</span>
            <select
              value={filters.device}
              onChange={(event) => updateFilter("device", event.target.value)}
              className="w-full rounded-2xl border border-sand-300 bg-white px-3 py-2 text-sm text-sand-800"
            >
              <option value="">Alle Geräte</option>
              {availableFilters.devices.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-sand-500">Topic</span>
            <select
              value={filters.topic}
              onChange={(event) => updateFilter("topic", event.target.value)}
              className="w-full rounded-2xl border border-sand-300 bg-white px-3 py-2 text-sm text-sand-800"
            >
              <option value="">Alle Topics</option>
              {availableFilters.topics.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wide text-sand-500">Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
              className="w-full rounded-2xl border border-sand-300 bg-white px-3 py-2 text-sm text-sand-800"
            >
              <option value="">Alle Stati</option>
              {availableFilters.statuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-sand-200 bg-sand-50 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="flex items-center gap-3 text-sm text-sand-700">
            <input
              type="checkbox"
              checked={filters.latestOnly}
              onChange={(event) => updateFilter("latestOnly", event.target.checked)}
              className="h-4 w-4 rounded border-sand-300 text-sand-900"
            />
            <span>Nur neueste Datensätze</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || items.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={14} />
              CSV Export
            </button>
            <button
              type="button"
              onClick={() => cleanupAudits("all")}
              disabled={importing || Boolean(cleanupScope)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-700 bg-rose-700 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={14} className={cleanupScope === "all" ? "animate-pulse" : ""} />
              {cleanupScope === "all" ? "Bereinigt..." : "Gesamt bereinigen"}
            </button>
            <button
              type="button"
              onClick={() => cleanupAudits("customer")}
              disabled={importing || Boolean(cleanupScope) || !filters.customer}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={14} className={cleanupScope === "customer" ? "animate-pulse" : ""} />
              {cleanupScope === "customer" ? "Bereinigt..." : "Pro Kunde"}
            </button>
            <button
              type="button"
              onClick={() => cleanupAudits("topic")}
              disabled={importing || Boolean(cleanupScope) || !filters.topic}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 size={14} className={cleanupScope === "topic" ? "animate-pulse" : ""} />
              {cleanupScope === "topic" ? "Bereinigt..." : "Pro Topic"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-sand-200">
          <div className="flex items-center justify-between border-b border-sand-200 bg-sand-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sand-700">
              <Database size={15} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Audit-Records</p>
            </div>
            <p className="text-xs text-sand-500">{loading ? "Lädt..." : `${items.length} Einträge`}</p>
          </div>

          {items.length === 0 && !loading ? (
            <div className="px-4 py-8 text-sm text-sand-500">
              Keine Audit-Records für die aktuelle Filterkombination vorhanden.
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-sand-200 text-sm">
                <thead className="bg-white">
                  <tr className="text-left text-xs uppercase tracking-wide text-sand-500">
                    <th className="px-4 py-3 font-medium">{renderSortButton("customer", "Kunde / Gerät")}</th>
                    <th className="px-4 py-3 font-medium">{renderSortButton("topic", "Topic")}</th>
                    <th className="px-4 py-3 font-medium">{renderSortButton("status", "Status")}</th>
                    <th className="w-[32rem] px-4 py-3 font-medium">{renderSortButton("summary", "Hinweis")}</th>
                    <th className="w-16 px-4 py-3 text-center font-medium">MD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200 bg-white">
                  {sortedItems.map((item) => {
                    const isOpen = openDetailId === item.id;
                    return (
                      <Fragment key={item.id}>
                        <tr className="align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium text-sand-900">{item.customerName || "Unbekannter Kunde"}</div>
                            <div className="text-sand-600">{item.deviceName || item.agentHostname || "Unbekanntes Gerät"}</div>
                            <div className="text-xs text-sand-400">
                              Audit: {formatDateTime(item.auditAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-sand-800">{item.topic}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs text-sand-600">
                                {item.schemaName}/{item.schemaVersion || "?"}
                              </span>
                              {item.isLatest ? (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                                  latest
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="max-w-2xl text-sand-700">{item.summary || "Kein Summary"}</div>
                            {getSecureBootCertificateText(item) ? (
                              <div className="mt-1 text-xs text-sand-500">{getSecureBootCertificateText(item)}</div>
                            ) : null}
                            {item.validationErrors?.length ? (
                              <div className="mt-1 text-xs text-amber-700">
                                Validierung: {item.validationErrors.join(" | ")}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleDetails(item.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-sand-300 bg-white text-sand-700 hover:bg-sand-100"
                              title={isOpen ? "Markdown ausblenden" : "Markdown anzeigen"}
                              aria-expanded={isOpen}
                            >
                              <FileText size={15} />
                            </button>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="bg-sand-50">
                            <td colSpan={5} className="px-4 pb-4 pt-0">
                              <div className="rounded-3xl border border-sand-200 bg-white shadow-soft">
                                <button
                                  type="button"
                                  onClick={() => toggleDetails(item.id)}
                                  className="flex w-full items-center justify-between border-b border-sand-200 px-4 py-3 text-left"
                                >
                                  <div className="flex items-center gap-2 text-sand-800">
                                    <FileText size={16} />
                                    <span className="text-sm font-medium">Markdown-Details</span>
                                  </div>
                                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <div className="audit-markdown p-4">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {buildAuditDetailsMarkdown(item)}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
