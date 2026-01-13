import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCopy,
  FileDown,
  FileText,
  Flag,
  Mail,
  Plus,
  Save,
  Sparkles,
  Users2,
  PenLine
} from "lucide-react";
import ActionCard from "./components/ActionCard";
import ArchivePanel from "./components/ArchivePanel";
import CatalogManager from "./components/CatalogManager";
import CustomerActionManager from "./components/CustomerActionManager";
import StatusPicker from "./components/StatusPicker";
import {
  catalog as defaultCatalog,
  customerActionSuggestions as defaultCustomerActions,
  customers as fallbackCustomers,
  summarySuggestions as defaultSummarySuggestions
} from "./constants";
import { buildPlainText, renderReportHTML, uid } from "./utils";

function CustomerCombobox({ customers, value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = customers.filter((item) =>
    item.toLowerCase().includes(query.trim().toLowerCase())
  );

  const selectValue = (nextValue) => {
    onChange(nextValue);
    setQuery(nextValue);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 120);
        }}
        className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
        placeholder="Kunde suchen oder frei eingeben…"
        role="combobox"
        aria-expanded={open}
      />
      {open ? (
        <div className="absolute z-20 mt-2 w-full rounded-2xl border border-sand-200 bg-white shadow-soft max-h-48 overflow-auto">
          {filtered.length ? (
            filtered.map((item) => (
              <button
                key={item}
                type="button"
                onMouseDown={() => selectValue(item)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-sand-100"
              >
                {item}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-xs text-sand-500">Kein Treffer — freie Eingabe möglich.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const monthNames = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember"
];

const getCurrentPeriod = () => {
  const now = new Date();
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
};

const defaultReport = {
  customer: "",
  period: "",
  status: "",
  summary: "",
  customer_action_text: "",
  actions: []
};

const ensureCatalogIds = (items) =>
  items.map((item) => ({
    id: item.id || uid(),
    ...item
  }));

const ensureCustomerActionIds = (items) =>
  items.map((item) => ({
    id: item.id || uid(),
    ...item
  }));

const ensureSummaryIds = (items) =>
  items.map((item) => ({
    id: item.id || uid(),
    ...item
  }));

const normalizeId = (value) => (value === null || value === undefined ? "" : String(value));

const parseActionFromText = (rawText) => {
  const text = rawText.trim();
  const base = {
    priority: "Planbar",
    title: "Neue Maßnahme",
    system: "",
    why_text: "",
    impact: "Keine Unterbrechung",
    duration: "",
    cost: ""
  };

  if (!text) return base;

  const normalized = text.toLowerCase();
  const fields = { ...base };
  const unusedLines = [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  const matchLabel = (label) => {
    const key = label.toLowerCase();
    if (key.includes("titel") || key.includes("maßnahme") || key.includes("title")) return "title";
    if (key.includes("system") || key.includes("betreff")) return "system";
    if (key.includes("warum") || key.includes("nutzen") || key.includes("grund") || key.includes("why"))
      return "why_text";
    if (key.includes("priorit")) return "priority";
    if (key.includes("auswirkung") || key.includes("impact")) return "impact";
    if (key.includes("dauer") || key.includes("zeit") || key.includes("duration")) return "duration";
    if (key.includes("kosten") || key.includes("cost") || key.includes("budget")) return "cost";
    return "";
  };

  lines.forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const field = matchLabel(match[1]);
      if (field) {
        fields[field] = match[2].trim();
        return;
      }
    }
    unusedLines.push(line);
  });

  if (!fields.title || fields.title === base.title) {
    const firstLine = unusedLines[0] || text;
    fields.title = firstLine.split(".")[0].trim() || base.title;
  }

  if (!fields.why_text) {
    const remainder = unusedLines.slice(1).join(" ").trim();
    fields.why_text = remainder || "";
  }

  if (!fields.priority || fields.priority === base.priority) {
    if (normalized.includes("dringend") || normalized.includes("sofort")) fields.priority = "Dringend";
    if (normalized.includes("hinweis") || normalized.includes("optional")) fields.priority = "Hinweis";
  }

  if (!fields.impact || fields.impact === base.impact) {
    if (normalized.includes("wartungsfenster")) fields.impact = "Wartungsfenster";
    if (normalized.includes("kurzunterbrechung") || normalized.includes("kurze unterbrechung"))
      fields.impact = "Kurzunterbrechung";
  }

  return fields;
};

const buildSentInfo = ({ sentAt, sentVia, sentTo, openedAt, openedCount }) => {
  if (!sentAt) return "Nicht gesendet";
  const sentAtText = sentAt ? new Date(sentAt).toLocaleString("de-DE") : "";
  const openedAtText = openedAt ? new Date(openedAt).toLocaleString("de-DE") : "";
  return [
    `Versand: ${sentVia || "manuell"}`,
    sentTo ? `An: ${sentTo}` : "",
    sentAtText ? `Am: ${sentAtText}` : "",
    openedCount
      ? `Gelesen: ${openedCount}x${openedAtText ? ` (zuletzt ${openedAtText})` : ""}`
      : "Gelesen: nein"
  ]
    .filter(Boolean)
    .join(" | ");
};

export default function ReportView() {
  const [report, setReport] = useState(defaultReport);
  const [catalogItems, setCatalogItems] = useState(ensureCatalogIds(defaultCatalog));
  const [catalogPick, setCatalogPick] = useState("");
  const [customerActionItems, setCustomerActionItems] = useState(
    ensureCustomerActionIds(defaultCustomerActions)
  );
  const [customerActionPick, setCustomerActionPick] = useState("");
  const [summaryItems, setSummaryItems] = useState(
    ensureSummaryIds(defaultSummarySuggestions)
  );
  const [summaryPick, setSummaryPick] = useState("");
  const [archiveItems, setArchiveItems] = useState([]);
  const [customerList, setCustomerList] = useState(fallbackCustomers);
  const [section, setSection] = useState("builder");
  const [toast, setToast] = useState("");
  const [customerInput, setCustomerInput] = useState(defaultReport.customer);
  const [editReportId, setEditReportId] = useState(null);
  const [previewModal, setPreviewModal] = useState({
    open: false,
    title: "",
    html: ""
  });
  const [freeText, setFreeText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [integrationSettings, setIntegrationSettings] = useState({
    rmm_host: "",
    rmm_user: "",
    rmm_password: ""
  });

  const updateIntegration = (patch) =>
    setIntegrationSettings((prev) => ({
      ...prev,
      ...patch
    }));

  const previewHtml = useMemo(() => renderReportHTML(report), [report]);
  const suggestedCustomers = useMemo(() => {
    const seen = new Set();
    const merged = [];
    const push = (name) => {
      const trimmed = (name || "").trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      merged.push(trimmed);
    };

    customerList.forEach(push);
    archiveItems.forEach((group) => push(group.customer));
    return merged;
  }, [archiveItems, customerList]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setCustomerInput(report.customer || "");
  }, [report.customer]);

  useEffect(() => {
    if (!catalogPick && catalogItems.length) {
      setCatalogPick(normalizeId(catalogItems[0]?.id ?? ""));
    }
  }, [catalogItems, catalogPick]);

  useEffect(() => {
    if (!customerActionPick && customerActionItems.length) {
      setCustomerActionPick(normalizeId(customerActionItems[0]?.id ?? ""));
    }
  }, [customerActionItems, customerActionPick]);

  useEffect(() => {
    if (!summaryPick && summaryItems.length) {
      setSummaryPick(normalizeId(summaryItems[0]?.id ?? ""));
    }
  }, [summaryItems, summaryPick]);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      const data = await res.json();
      if (Array.isArray(data)) {
    const grouped = data.reduce((acc, reportItem) => {
      const key = reportItem.customer || "Unbekannt";
      const entry = acc[key] || { customer: key, reports: [] };
      const sentAt = reportItem.sent_at || 0;
      const sentVia = reportItem.sent_via || "";
      const sentTo = reportItem.sent_to || "";
      const openedAt = reportItem.opened_at || 0;
      const openedCount = reportItem.opened_count || 0;
      const sentInfo = buildSentInfo({
        sentAt,
        sentVia,
        sentTo,
        openedAt,
        openedCount
      });
          entry.reports.push({
            id: reportItem.id,
            label: reportItem.period || "Bericht",
            status: reportItem.status || "",
            period: reportItem.period || "",
            sentAt,
            sentVia,
            sentTo,
            openedAt,
            openedCount,
            sentInfo
          });
          acc[key] = entry;
          return acc;
        }, {});
        setArchiveItems(Object.values(grouped));
      }
    } catch (error) {
      // Keep empty list.
    }
  }, []);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const res = await fetch("/api/report_customers");
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          setCustomerList(data.map((item) => item.name).filter(Boolean));
        }
      } catch (error) {
        // Keep fallback list.
      }
    };

    const loadCatalog = async () => {
      try {
        const res = await fetch("/api/report_catalog");
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          setCatalogItems(data);
          setCatalogPick(normalizeId(data[0]?.id ?? ""));
          return;
        }

        const seeded = await Promise.all(
          defaultCatalog.map((item) =>
            fetch("/api/report_catalog", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item)
            }).then((r) => r.json())
          )
        );
        setCatalogItems(seeded);
        setCatalogPick(normalizeId(seeded[0]?.id ?? ""));
      } catch (error) {
        setCatalogPick((prev) => prev || normalizeId(catalogItems[0]?.id ?? ""));
      }
    };

    const loadCustomerActions = async () => {
      try {
        const res = await fetch("/api/report_customer_actions");
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          setCustomerActionItems(data);
          setCustomerActionPick(normalizeId(data[0]?.id ?? ""));
          return;
        }

        const seeded = await Promise.all(
          defaultCustomerActions.map((item) =>
            fetch("/api/report_customer_actions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item)
            }).then((r) => r.json())
          )
        );
        setCustomerActionItems(seeded);
        setCustomerActionPick(normalizeId(seeded[0]?.id ?? ""));
      } catch (error) {
        setCustomerActionPick((prev) => prev || normalizeId(customerActionItems[0]?.id ?? ""));
      }
    };

    const loadSummaries = async () => {
      try {
        const res = await fetch("/api/report_summaries");
        const data = await res.json();
        if (Array.isArray(data) && data.length) {
          setSummaryItems(data);
          setSummaryPick(normalizeId(data[0]?.id ?? ""));
          return;
        }

        const seeded = await Promise.all(
          defaultSummarySuggestions.map((item) =>
            fetch("/api/report_summaries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item)
            }).then((r) => r.json())
          )
        );
        setSummaryItems(seeded);
        setSummaryPick(normalizeId(seeded[0]?.id ?? ""));
      } catch (error) {
        setSummaryPick((prev) => prev || normalizeId(summaryItems[0]?.id ?? ""));
      }
    };

    const loadIntegrations = async () => {
      try {
        const res = await fetch("/api/integrations");
        const data = await res.json();
        if (data) {
          setIntegrationSettings((prev) => ({ ...prev, ...data }));
        }
      } catch (error) {
        // Keep defaults.
      }
    };

    loadCustomers();
    loadCatalog();
    loadCustomerActions();
    loadSummaries();
    loadReports();
    loadIntegrations();
  }, [loadReports]);


  const copyToClipboard = async (value) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setToast("Kopiert.");
        return;
      }
    } catch (error) {
      // Fallback below.
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
      setToast("Kopiert.");
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const printHtml = (contentHtml) => {
    const htmlDoc = `
      <html>
        <head>
          <title>IT-Kundenbericht</title>
          <style>
            @page { size: A4; margin: 16mm; }
            body { margin: 0; font-family: Arial, sans-serif; }
          </style>
        </head>
        <body>${contentHtml}</body>
      </html>
    `;
    const popup = window.open("", "_blank", "width=960,height=720");
    if (!popup) {
      setToast("Popup blockiert.");
      return;
    }
    popup.document.open();
    popup.document.write(htmlDoc);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const downloadPdf = () => {
    printHtml(previewHtml);
  };

  const addAction = (payload = {}) => {
    setReport((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          id: uid(),
          priority: "Planbar",
          title: "Neue Maßnahme",
          system: "",
          why_text: "",
          impact: "Keine Unterbrechung",
          duration: "",
          cost: "",
          ...payload
        }
      ]
    }));
  };

  const addFromCatalog = () => {
    const pick = catalogPick || normalizeId(catalogItems[0]?.id ?? "");
    const item = catalogItems.find((entry) => normalizeId(entry.id) === pick);
    if (item) {
      const { id, ...payload } = item;
      addAction(payload);
    }
  };

  const applyCustomerActionSuggestion = () => {
    const pick = customerActionPick || normalizeId(customerActionItems[0]?.id ?? "");
    const item = customerActionItems.find((entry) => normalizeId(entry.id) === pick);
    if (!item) {
      setToast("Kein Vorschlag gewählt.");
      return;
    }
    setReport((prev) => ({ ...prev, customer_action_text: item.text || "" }));
  };

  const applySummarySuggestion = () => {
    const pick = summaryPick || normalizeId(summaryItems[0]?.id ?? "");
    const item = summaryItems.find((entry) => normalizeId(entry.id) === pick);
    if (!item) {
      setToast("Kein Vorschlag gewählt.");
      return;
    }
    setReport((prev) => ({ ...prev, summary: item.text || "" }));
  };

  const addFromFreeText = async () => {
    if (!freeText.trim()) {
      setToast("Bitte Freitext eingeben.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai_action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: freeText })
      });
      if (!res.ok) throw new Error("ai_failed");
      const data = await res.json();
      if (!data?.action) throw new Error("ai_invalid");
      addAction(data.action);
      setFreeText("");
    } catch (error) {
      const payload = parseActionFromText(freeText);
      addAction(payload);
      setToast("KI nicht erreichbar, Freitext lokal ausgewertet.");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveIntegrations = async () => {
    try {
      const res = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(integrationSettings)
      });
      const data = await res.json();
      setIntegrationSettings((prev) => ({ ...prev, ...data }));
      setToast("Anbindungen gespeichert.");
    } catch (error) {
      setToast("Speichern fehlgeschlagen.");
    }
  };

  const updateAction = (id, patch) => {
    setReport((prev) => ({
      ...prev,
      actions: prev.actions.map((action) => (action.id === id ? { ...action, ...patch } : action))
    }));
  };

  const removeAction = (id) => {
    setReport((prev) => ({
      ...prev,
      actions: prev.actions.filter((action) => action.id !== id)
    }));
  };

  const addCatalogItem = async (item) => {
    const res = await fetch("/api/report_catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    const created = await res.json();
    const next = [...catalogItems, created];
    setCatalogItems(next);
    if (!catalogPick) setCatalogPick(normalizeId(created?.id ?? next[0]?.id ?? ""));
  };

  const addActionToCatalog = async (action) => {
    if (!action?.title?.trim()) {
      setToast("Titel fehlt.");
      return;
    }
    await addCatalogItem({
      title: action.title,
      system: action.system || "",
      why_text: action.why_text || "",
      impact: action.impact || "",
      duration: action.duration || "",
      cost: action.cost || "",
      priority: action.priority || "Planbar"
    });
    setToast("Baustein gespeichert.");
  };

  const removeCatalogItem = async (id) => {
    await fetch(`/api/report_catalog/${id}`, { method: "DELETE" });
    const next = catalogItems.filter((item) => item.id !== id);
    setCatalogItems(next);
    if (catalogPick === normalizeId(id)) {
      setCatalogPick(normalizeId(next[0]?.id ?? ""));
    }
  };

  const updateCatalogItem = async (id, patch) => {
    const res = await fetch(`/api/report_catalog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const updated = await res.json();
    setCatalogItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const addCustomerActionItem = async (item) => {
    const res = await fetch("/api/report_customer_actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item)
    });
    const created = await res.json();
    const next = [...customerActionItems, created];
    setCustomerActionItems(next);
    if (!customerActionPick) setCustomerActionPick(normalizeId(created?.id ?? next[0]?.id ?? ""));
  };

  const removeCustomerActionItem = async (id) => {
    await fetch(`/api/report_customer_actions/${id}`, { method: "DELETE" });
    const next = customerActionItems.filter((item) => item.id !== id);
    setCustomerActionItems(next);
    if (customerActionPick === normalizeId(id)) {
      setCustomerActionPick(normalizeId(next[0]?.id ?? ""));
    }
  };

  const updateCustomerActionItem = async (id, patch) => {
    const res = await fetch(`/api/report_customer_actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const updated = await res.json();
    setCustomerActionItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
  };

  const archiveReport = async () => {
    if (!report.customer?.trim()) {
      setToast("Bitte Kunde angeben.");
      return;
    }
    const payload = {
      customer: report.customer.trim(),
      period: report.period,
      status: report.status,
      summary: report.summary,
      customer_action_text: report.customer_action_text,
      items: report.actions
    };
    if (editReportId) {
      const res = await fetch(`/api/reports/${editReportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setToast("Archiv-Update fehlgeschlagen.");
        return;
      }
      setToast("Archiv aktualisiert.");
      setEditReportId(null);
      await loadReports();
    } else {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setToast("Speichern fehlgeschlagen.");
        return;
      }
      const created = await res.json();
      setToast("Archiviert.");
      setArchiveItems((prev) => {
        const grouped = [...prev];
        const idx = grouped.findIndex((item) => item.customer === created.customer);
        const entry = {
          id: created.id,
          label: created.period || "Bericht",
          status: created.status || "",
          period: created.period || "",
          sentAt: created.sent_at || 0,
          sentVia: created.sent_via || "",
          sentTo: created.sent_to || "",
          openedAt: created.opened_at || 0,
          openedCount: created.opened_count || 0,
          sentInfo: buildSentInfo({
            sentAt: created.sent_at || 0,
            sentVia: created.sent_via || "",
            sentTo: created.sent_to || "",
            openedAt: created.opened_at || 0,
            openedCount: created.opened_count || 0
          })
        };
        if (idx >= 0) {
          grouped[idx] = {
            ...grouped[idx],
            reports: [entry, ...grouped[idx].reports]
          };
          return grouped;
        }
        return [{ customer: created.customer, reports: [entry] }, ...grouped];
      });
    }
    setReport(defaultReport);
    setCustomerInput(defaultReport.customer);
    setSection("builder");
  };

  const resetReport = () => {
    if (!confirm("Aktuellen Bericht verwerfen?")) return;
    setReport(defaultReport);
    setCustomerInput(defaultReport.customer);
    setSection("builder");
  };

  const deleteArchivedReport = async (item) => {
    if (!item?.id) return;
    if (!confirm("Archivierten Bericht löschen?")) return;
    await fetch(`/api/reports/${item.id}`, { method: "DELETE" });
    setArchiveItems((prev) =>
      prev
        .map((group) => ({
          ...group,
          reports: group.reports.filter((reportItem) => reportItem.id !== item.id)
        }))
        .filter((group) => group.reports.length)
    );
    setToast("Gelöscht.");
  };

  const fetchArchivedReport = async (item) => {
    if (!item?.id) return null;
    const res = await fetch(`/api/reports/${item.id}`);
    if (!res.ok) {
      setToast("Report nicht gefunden.");
      return null;
    }
    return res.json();
  };

  const normalizeReport = (data) => ({
    guid: data.guid,
    customer: data.customer,
    period: data.period,
    status: data.status,
    summary: data.summary,
    customer_action_text: data.customer_action_text,
    actions: data.items || []
  });


  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const chunkBase64 = (value, size = 76) => {
    const chunks = [];
    for (let i = 0; i < value.length; i += size) {
      chunks.push(value.slice(i, i + size));
    }
    return chunks.join("\r\n");
  };

  const downloadEmailDraft = async (data) => {
    if (!data?.customer?.trim()) {
      setToast("Bitte Kunde angeben.");
      return;
    }
    try {
      const subject = `IT-Kundenbericht – ${data.customer} (${data.period || "ohne Zeitraum"})`;
      const beaconUrl = data.guid
        ? `${window.location.origin}/api/reports/open?guid=${encodeURIComponent(data.guid)}`
        : "";
      const htmlBody = renderReportHTML(data, { mode: "email", beaconUrl }).replace(
        /src="\/QTLogo\.jpg"/g,
        'src="cid:qtlogo"'
      );
      const logoRes = await fetch("/QTLogo.jpg");
      if (!logoRes.ok) throw new Error("logo_missing");
      const logoBlob = await logoRes.blob();
      const logoDataUrl = await blobToBase64(logoBlob);
      const logoBase64 = String(logoDataUrl).split(",")[1] || "";
      const boundary = `----qt-report-${uid()}`;
      const eml = [
        "MIME-Version: 1.0",
        `Subject: ${subject}`,
        `Content-Type: multipart/related; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/html; charset="utf-8"',
        "Content-Transfer-Encoding: 7bit",
        "",
        htmlBody,
        "",
        `--${boundary}`,
        "Content-Type: image/jpeg",
        "Content-Transfer-Encoding: base64",
        "Content-ID: <qtlogo>",
        'Content-Disposition: inline; filename="QTLogo.jpg"',
        "",
        chunkBase64(logoBase64),
        "",
        `--${boundary}--`,
        ""
      ].join("\r\n");
      const blob = new Blob([eml], { type: "message/rfc822;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const filename = `IT-Kundenbericht_${data.customer}_${data.period || "ohne Zeitraum"}.eml`
        .replaceAll(" ", "_")
        .replaceAll("/", "-");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setToast("E-Mail-Entwurf konnte nicht erstellt werden.");
    }
  };

  const exportArchivedEmail = async (item) => {
    const data = await fetchArchivedReport(item);
    if (!data) return;
    const normalized = normalizeReport(data);
    downloadEmailDraft(normalized);
    await fetch(`/api/reports/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sent: true, sent_via: "eml" })
    }).then(async (res) => {
      if (!res.ok) return;
      const updated = await res.json();
      setArchiveItems((prev) =>
        prev.map((group) => ({
          ...group,
          reports: group.reports.map((reportItem) =>
            reportItem.id === item.id
              ? {
                  ...reportItem,
                  sentAt: updated.sent_at || 0,
                  sentVia: updated.sent_via || "",
                  sentTo: updated.sent_to || "",
                  openedAt: updated.opened_at || 0,
                  openedCount: updated.opened_count || 0,
                  sentInfo: buildSentInfo({
                    sentAt: updated.sent_at || 0,
                    sentVia: updated.sent_via || "",
                    sentTo: updated.sent_to || "",
                    openedAt: updated.opened_at || 0,
                    openedCount: updated.opened_count || 0
                  })
                }
              : reportItem
          )
        }))
      );
    });
  };

  const editArchivedReport = async (item) => {
    const data = await fetchArchivedReport(item);
    if (!data) return;
    const normalized = normalizeReport(data);
    setEditReportId(data.id);
    setReport({ ...defaultReport, ...normalized });
    setCustomerInput(normalized.customer || "");
    setSection("builder");
  };

  const toggleArchivedSent = async (item, nextValue) => {
    if (!item?.id) return;
    try {
      const res = await fetch(`/api/reports/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sent: nextValue,
          sent_via: nextValue ? "manuell" : ""
        })
      });
      if (!res.ok) throw new Error("update_failed");
      const updated = await res.json();
      setArchiveItems((prev) =>
        prev.map((group) => ({
          ...group,
          reports: group.reports.map((reportItem) =>
            reportItem.id === item.id
              ? {
                  ...reportItem,
                  sentAt: updated.sent_at || 0,
                  sentVia: updated.sent_via || "",
                  sentTo: updated.sent_to || "",
                  openedAt: updated.opened_at || 0,
                  openedCount: updated.opened_count || 0,
                  sentInfo: buildSentInfo({
                    sentAt: updated.sent_at || 0,
                    sentVia: updated.sent_via || "",
                    sentTo: updated.sent_to || "",
                    openedAt: updated.opened_at || 0,
                    openedCount: updated.opened_count || 0
                  })
                }
              : reportItem
          )
        }))
      );
      setToast(nextValue ? "Als gesendet markiert." : "Gesendet-Markierung entfernt.");
    } catch (error) {
      setToast("Markierung fehlgeschlagen.");
    }
  };

  const previewArchivedReport = async (item) => {
    const data = await fetchArchivedReport(item);
    if (!data) return;
    const normalized = normalizeReport(data);
    setPreviewModal({
      open: true,
      title: `${normalized.customer || "Kunde"} – ${normalized.period || "ohne Zeitraum"}`,
      html: renderReportHTML(normalized)
    });
  };

  const sendArchivedReport = async (item) => {
    const data = await fetchArchivedReport(item);
    if (!data) return;
    const recipient = prompt("Empfänger E-Mail-Adresse");
    if (!recipient) return;
    const normalized = normalizeReport(data);
    const beaconUrl = normalized.guid
      ? `${window.location.origin}/api/reports/open?guid=${encodeURIComponent(normalized.guid)}`
      : "";
    const html = renderReportHTML(normalized, { mode: "email", beaconUrl }).replace(
      /src="\/QTLogo\.jpg"/g,
      `src="${window.location.origin}/QTLogo.jpg"`
    );
    const text = buildPlainText(normalized);
    const subject = `IT-Kundenbericht – ${normalized.customer} (${normalized.period || "ohne Zeitraum"})`;
    try {
      const res = await fetch(`/api/reports/${item.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient, subject, html, text })
      });
      if (!res.ok) throw new Error("send_failed");
      const updated = await res.json();
      setArchiveItems((prev) =>
        prev.map((group) => ({
          ...group,
          reports: group.reports.map((reportItem) =>
            reportItem.id === item.id
              ? {
                  ...reportItem,
                  sentAt: updated.sent_at || 0,
                  sentVia: updated.sent_via || "",
                  sentTo: updated.sent_to || "",
                  openedAt: updated.opened_at || 0,
                  openedCount: updated.opened_count || 0,
                  sentInfo: buildSentInfo({
                    sentAt: updated.sent_at || 0,
                    sentVia: updated.sent_via || "",
                    sentTo: updated.sent_to || "",
                    openedAt: updated.opened_at || 0,
                    openedCount: updated.opened_count || 0
                  })
                }
              : reportItem
          )
        }))
      );
      setToast("E-Mail gesendet.");
    } catch (error) {
      setToast("SMTP Versand fehlgeschlagen.");
    }
  };

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => copyToClipboard(previewHtml)}
        className="inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
      >
        <ClipboardCopy size={14} /> HTML kopieren
      </button>
      <button
        onClick={() => downloadEmailDraft(report)}
        className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
      >
        <Mail size={14} /> E-Mail Entwurf
      </button>
      <button
        onClick={downloadPdf}
        className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
      >
        <FileDown size={14} /> PDF
      </button>
      <button
        onClick={archiveReport}
        disabled={!report.customer?.trim()}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
          report.customer?.trim()
            ? "border-sand-300 bg-white hover:bg-sand-100"
            : "border-sand-200 bg-sand-100 text-sand-500 cursor-not-allowed"
        }`}
      >
        <Save size={14} /> Archivieren
      </button>
    </div>
  );

  const subnavItems = [
    { id: "builder", label: "Bericht erstellen" },
    { id: "archive", label: "Archiv" },
    { id: "templates", label: "Vorlagenverwaltung" },
    { id: "blocks", label: "Textbausteine" }
  ];

  const subnav = (
    <div className="border-t border-sand-200 bg-white/80 backdrop-blur">
      <div className="w-full px-6 flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {subnavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`px-4 py-3 text-xs uppercase tracking-wide border-b-2 ${
                section === item.id
                  ? "border-sand-900 text-sand-900"
                  : "border-transparent text-sand-500 hover:text-sand-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          onClick={resetReport}
          className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
        >
          <PenLine size={14} /> Verwerfen
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <div className="absolute inset-0 -z-10 bg-hero-pattern" />
      {toast ? (
        <div className="fixed top-5 right-6 z-50 bg-sand-900 text-white text-xs uppercase tracking-wide px-4 py-2 rounded-full shadow-soft">
          {toast}
        </div>
      ) : null}
      {previewModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-5xl rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Schnellvorschau</p>
                <h3 className="text-lg font-display">{previewModal.title}</h3>
              </div>
              <button
                onClick={() => setPreviewModal({ open: false, title: "", html: "" })}
                className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                Schließen
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6 bg-sand-50">
              <div className="bg-white border border-sand-200 rounded-2xl p-4">
                <div dangerouslySetInnerHTML={{ __html: previewModal.html }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="w-full px-6 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img src="/QTLogo.jpg" alt="Quansatech" className="h-11 w-auto object-contain" />
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-2xl font-display">IT-Kundenbericht</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center justify-end">
            <div className="flex items-center gap-2 text-xs text-sand-500">
              <Users2 size={16} />
              {suggestedCustomers.length} Kunden
            </div>
            {headerActions}
          </div>
        </div>
        {subnav}
      </header>

      {section === "builder" && (
        <main className="w-full px-6 py-7 grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
          <section className="space-y-6">
            <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-5 shadow-soft space-y-5">
              <div>
                <h2 className="text-lg font-display">Bericht zusammenstellen</h2>
                <p className="text-sm text-sand-600">
                  Fokus auf Kundenfragen: Warum? Impact? Dauer? Kosten?
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="text-xs uppercase tracking-wide text-sand-600">
                  Kunde
                  <CustomerCombobox
                    customers={suggestedCustomers}
                    value={customerInput}
                    onChange={(nextValue) => {
                      setCustomerInput(nextValue);
                      setReport((prev) => ({ ...prev, customer: nextValue }));
                    }}
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-sand-600 md:col-span-2">
                  Zeitraum (optional)
                  <input
                    value={report.period}
                    onChange={(event) =>
                      setReport((prev) => ({ ...prev, period: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    placeholder="z. B. Q3 Review, Sonderbericht, August 2024"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-sand-600 mb-2 flex items-center gap-2">
                  <Flag size={14} /> Ampelstatus
                </p>
                <StatusPicker
                  value={report.status}
                  onChange={(status) => setReport((prev) => ({ ...prev, status }))}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-xs uppercase tracking-wide text-sand-600 block">
                  Kurz-Zusammenfassung
                  <textarea
                    value={report.summary}
                    onChange={(event) => setReport((prev) => ({ ...prev, summary: event.target.value }))}
                    rows={4}
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={summaryPick}
                      onChange={(event) => setSummaryPick(event.target.value)}
                      className="rounded-full border border-sand-200 px-3 py-1 text-xs bg-white uppercase tracking-wide text-sand-600 max-w-[260px] w-auto"
                    >
                      {summaryItems.length ? (
                        summaryItems.map((item) => (
                          <option key={item.id} value={normalizeId(item.id)}>
                            {item.text.length > 60 ? `${item.text.slice(0, 57)}...` : item.text}
                          </option>
                        ))
                      ) : (
                        <option value="">Keine Vorschläge</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={applySummarySuggestion}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                    >
                      Vorschlag übernehmen
                    </button>
                  </div>
                </label>
                <label className="text-xs uppercase tracking-wide text-sand-600 block">
                  Was wir vom Kunden benötigen
                  <textarea
                    value={report.customer_action_text}
                    onChange={(event) =>
                      setReport((prev) => ({ ...prev, customer_action_text: event.target.value }))
                    }
                    rows={4}
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={customerActionPick}
                      onChange={(event) => setCustomerActionPick(event.target.value)}
                      className="rounded-full border border-sand-200 px-3 py-1 text-xs bg-white uppercase tracking-wide text-sand-600 max-w-[260px] w-auto"
                    >
                      {customerActionItems.length ? (
                        customerActionItems.map((item) => (
                          <option key={item.id} value={normalizeId(item.id)}>
                            {item.text.length > 60 ? `${item.text.slice(0, 57)}...` : item.text}
                          </option>
                        ))
                      ) : (
                        <option value="">Keine Vorschläge</option>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={applyCustomerActionSuggestion}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                    >
                      Vorschlag übernehmen
                    </button>
                  </div>
                </label>
              </div>

            </div>

            <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-5 shadow-soft space-y-4">
              <div>
                <h2 className="text-lg font-display">Bausteine zusammenstellen</h2>
                <p className="text-sm text-sand-600">Standard-Textbausteine plus individuelle Ergänzungen.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sand-700">
                    <Plus size={16} />
                    <p className="text-xs uppercase tracking-wide text-sand-600">Neue Maßnahme</p>
                  </div>
                  <p className="text-sm text-sand-600">
                    Leeres Formular für individuelle Inhalte starten.
                  </p>
                  <button
                    onClick={() => addAction()}
                    className="mt-auto inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                  >
                    <Plus size={14} /> Jetzt anlegen
                  </button>
                </div>

                <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-sand-700">
                    <PenLine size={16} />
                    <p className="text-xs uppercase tracking-wide text-sand-600">Aus Baustein</p>
                  </div>
                  <p className="text-sm text-sand-600">
                    Vorgefertigten Textbaustein auswählen und übernehmen.
                  </p>
                  <select
                    value={catalogPick}
                    onChange={(event) => setCatalogPick(event.target.value)}
                    className="rounded-full border border-sand-200 px-4 py-2 text-sm bg-white"
                  >
                    {Object.entries(
                      catalogItems.reduce((groups, item) => {
                        const key = (item.group || item.system || "Allgemein").trim() || "Allgemein";
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                        return groups;
                      }, {})
                    ).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map((item) => (
                          <option key={item.id} value={normalizeId(item.id)}>
                            {item.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    onClick={addFromCatalog}
                    className="mt-auto inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <Plus size={14} /> Hinzufügen
                  </button>
                </div>

                <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3 lg:col-span-2">
                  <div className="flex items-center gap-2 text-sand-700">
                    <Sparkles size={16} />
                    <p className="text-xs uppercase tracking-wide text-sand-600">Mit KI erstellen</p>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sand-700">
                      <Sparkles size={10} /> KI
                    </span>
                  </div>
                  <p className="text-sm text-sand-600">
                    Kurzer Freitext, wir füllen die bekannten Felder vor.
                  </p>
                  <textarea
                    value={freeText}
                    onChange={(event) => setFreeText(event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    placeholder="z. B. Server-Updates einspielen, um kritische Sicherheitslücken zu schließen. Wartungsfenster nötig. Dauer 1h."
                  />
                  <button
                    type="button"
                    onClick={addFromFreeText}
                    disabled={isGenerating}
                    className="mt-auto inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-sand-300 border-t-sand-700 animate-spin" />
                        KI erstellt ...
                      </span>
                    ) : (
                      <>
                        <Plus size={14} /> Aus Freitext erzeugen
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {report.actions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onChange={(patch) => updateAction(action.id, patch)}
                    onRemove={() => removeAction(action.id)}
                    onSaveToCatalog={() => addActionToCatalog(action)}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="bg-white border border-sand-200 rounded-3xl p-4 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display">Live Preview</h3>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide border px-3 py-1 rounded-full ${
                    report.status === "Grün"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : report.status === "Gelb"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-rose-100 text-rose-800 border-rose-200"
                  }`}
                >
                  {report.status}
                </span>
              </div>
              <div className="border border-sand-200 rounded-2xl p-4 bg-white overflow-x-hidden">
                <div className="w-full" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </aside>
        </main>
      )}

      {section === "archive" && (
        <main className="w-full px-6 py-8">
            <ArchivePanel
              archive={archiveItems}
              onDelete={deleteArchivedReport}
              onExportEmail={exportArchivedEmail}
              onPreview={previewArchivedReport}
              onToggleSent={toggleArchivedSent}
              onEdit={editArchivedReport}
              onSendSmtp={sendArchivedReport}
            />
          </main>
      )}

      {section === "templates" && (
        <main className="w-full px-6 py-8">
          <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft space-y-3">
            <h2 className="text-lg font-display">Vorlagenverwaltung</h2>
            <p className="text-sm text-sand-600">
              Hier entstehen zukünftig verschiedene Report-Layouts und CI-Varianten.
            </p>
            <div className="bg-sand-50 border border-sand-200 rounded-2xl p-4 text-sm text-sand-600">
              Status: geplant. Platzhalter vorhanden, um später Templates zentral zu pflegen.
            </div>
          </div>
        </main>
      )}

      {section === "blocks" && (
        <main className="w-full px-6 py-8">
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-6 shadow-soft space-y-4">
              <div>
                <h2 className="text-lg font-display">Textbausteine verwalten</h2>
                <p className="text-sm text-sand-600">
                  Bausteine sind global und stehen für alle Kundenberichte zur Verfügung.
                </p>
              </div>
              <CatalogManager
                items={catalogItems}
                onAdd={addCatalogItem}
                onRemove={removeCatalogItem}
                onUpdate={updateCatalogItem}
              />
            </div>

            <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-6 shadow-soft space-y-4">
              <div>
                <h2 className="text-lg font-display">Kundenbedarf verwalten</h2>
                <p className="text-sm text-sand-600">
                  Vorschläge für das Feld „Was wir vom Kunden benötigen“.
                </p>
              </div>
              <CustomerActionManager
                items={customerActionItems}
                onAdd={addCustomerActionItem}
                onRemove={removeCustomerActionItem}
                onUpdate={updateCustomerActionItem}
              />
            </div>
          </div>
        </main>
      )}

      {section === "integrations" && (
        <main className="w-full px-6 py-8 space-y-6">
          <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft space-y-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-display">Anbindungen pflegen</h2>
                <p className="text-sm text-sand-600">
                  Zugangsdaten und Links für das RMM/Grafana Dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={saveIntegrations}
                className="inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
              >
                <Save size={14} /> Speichern
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-6 shadow-soft space-y-4">
              <div>
                <h3 className="text-base font-display">Grafana Login</h3>
                <p className="text-sm text-sand-600">URL, Benutzer und Passwort.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-xs uppercase tracking-wide text-sand-600">
                  URL
                  <input
                    value={integrationSettings.rmm_host}
                    onChange={(event) => updateIntegration({ rmm_host: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    placeholder="https://rmm.quansatech.at"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-sand-600">
                  Benutzer
                  <input
                    value={integrationSettings.rmm_user}
                    onChange={(event) => updateIntegration({ rmm_user: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    placeholder="grafana_user"
                  />
                </label>
                <label className="text-xs uppercase tracking-wide text-sand-600 md:col-span-2">
                  Passwort
                  <input
                    type="password"
                    value={integrationSettings.rmm_password}
                    onChange={(event) => updateIntegration({ rmm_password: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    placeholder="••••••••"
                  />
                </label>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
