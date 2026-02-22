import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  BadgeCheck,
  Building2,
  BookPlus,
  Eye,
  FileDown,
  Mail,
  Phone,
  PhoneOutgoing,
  Plus,
  Search,
  Trash2,
  Users
} from "lucide-react";
import { renderReportHTML, uid } from "../reporting/utils";
import { telephonyService } from "../telephony/telephonyService";
import CustomerDevelopmentCustomerTab from "../customer-development/CustomerDevelopmentCustomerTab";

const API = "/api";

const api = {
  list: () => fetch(`${API}/customers`).then((r) => r.json()),
  create: (payload) =>
    fetch(`${API}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  update: (id, payload) =>
    fetch(`${API}/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  remove: (id) => fetch(`${API}/customers/${id}`, { method: "DELETE" }),
  getMetricsSettings: () => fetch(`${API}/customer_metrics_settings`).then((r) => r.json()),
  saveMetricsSettings: (payload) =>
    fetch(`${API}/customer_metrics_settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  syncSevdesk: () =>
    fetch(`${API}/customers/sync_sevdesk`, {
      method: "POST"
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.detail || "sevdesk_sync_failed");
      }
      return data;
    })
};

const blankPhone = () => ({
  id: uid(),
  label: "",
  number: ""
});

const normalizeContractFlags = (flags) => {
  if (!Array.isArray(flags)) return [];
  const values = [];
  const seen = new Set();
  flags.forEach((entry) => {
    let key = String(entry || "").trim().toLowerCase();
    if (key === "sla" || key === "servicelevelagreement") key = "wartung";
    if (key !== "monitoring" && key !== "wartung") return;
    if (seen.has(key)) return;
    seen.add(key);
    values.push(key);
  });
  return values;
};

const normalizeCustomer = (customer) => {
  const contractFlags = normalizeContractFlags(
    Array.isArray(customer.contract_flags)
      ? customer.contract_flags
      : Array.isArray(customer.contractFlags)
      ? customer.contractFlags
      : []
  );
  return {
    ...customer,
  creditorNumber:
    customer.creditor_number ?? customer.creditorNumber ?? customer.internal_number ?? "",
  shortCode: customer.short_code ?? customer.shortCode ?? "",
  street: customer.street ?? "",
  postalCode: customer.postal_code ?? customer.postalCode ?? "",
  city: customer.city ?? "",
  country: customer.country ?? "",
  phones: customer.phones?.length ? customer.phones : [blankPhone()],
  customerReport:
    customer.customer_report ??
    customer.customerReport ??
    customer.report_enabled ??
    customer.reportEnabled ??
    true,
  newsletter:
    customer.newsletter ??
    customer.newsletter_enabled ??
    customer.newsletterEnabled ??
    true,
  status: String(customer.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
  maintenanceContract:
    Boolean(customer.maintenance_contract ?? customer.maintenanceContract ?? false) ||
    contractFlags.includes("wartung"),
  contractFlags
  };
};

const customerPayload = (customer) => ({
  name: customer.name || "Neuer Kunde",
  creditor_number: customer.creditorNumber || "",
  short_code: customer.shortCode || "",
  email: customer.email || "",
  street: customer.street || "",
  postal_code: customer.postalCode || "",
  city: customer.city || "",
  country: customer.country || "",
  customer_report: Boolean(customer.customerReport),
  newsletter: Boolean(customer.newsletter),
  status: String(customer.status || "active").toLowerCase() === "inactive" ? "inactive" : "active",
  maintenance_contract: Boolean(customer.maintenanceContract),
  contract_flags: normalizeContractFlags(customer.contractFlags),
  phones: (customer.phones || [])
    .filter((phone) => (phone.label || "").trim() || (phone.number || "").trim())
    .map((phone) => ({
      id: Number.isInteger(phone.id) ? phone.id : undefined,
      label: phone.label || "",
      number: phone.number || ""
    }))
});

const formatEur = (value) => {
  if (value === null || typeof value === "undefined") return "n/a";
  const number = Number(value);
  if (Number.isNaN(number)) return "n/a";
  return number.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });
};

export default function CustomerDirectoryView() {
  const [customers, setCustomers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [metricsStatus, setMetricsStatus] = useState("idle");
  const [importPreview, setImportPreview] = useState(null);
  const [importApplyCreate, setImportApplyCreate] = useState(true);
  const [importApplyUpdate, setImportApplyUpdate] = useState(true);
  const [reportOverview, setReportOverview] = useState([]);
  const [reportStatus, setReportStatus] = useState("idle");
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [deliveryStatus, setDeliveryStatus] = useState("idle");
  const [settingsTab, setSettingsTab] = useState("details");
  const [pbxApiActive, setPbxApiActive] = useState(false);
  const [pbxEntries, setPbxEntries] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [telephonyHealthy, setTelephonyHealthy] = useState(false);
  const [c2dTarget, setC2dTarget] = useState(null);
  const [c2dExtension, setC2dExtension] = useState("");
  const [c2dStatus, setC2dStatus] = useState("");
  const [c2dBusy, setC2dBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [previewModal, setPreviewModal] = useState({
    open: false,
    title: "",
    html: ""
  });
  const [metricsSettings, setMetricsSettings] = useState({
    office_address: "",
    km_rate_eur: "",
    min_distance_km: "",
    min_fee_eur: "",
    hourly_rate_eur: ""
  });
  const [metricsSettingsStatus, setMetricsSettingsStatus] = useState("idle");
  const saveTimers = useRef({});
  const importInputRef = useRef(null);

  useEffect(() => {
    api.list().then((data) => {
      const next = (data || []).map(normalizeCustomer);
      setCustomers(next);
      if (next.length) {
        setActiveId(next[0].id);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.checkPbxHealth().then((ok) => {
      if (!active) return;
      setPbxApiActive(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchPbxPhonebook().then((data) => {
      if (!active) return;
      setPbxEntries(Array.isArray(data) ? data : []);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchExtensions().then((data) => {
      if (!active) return;
      setExtensions(Array.isArray(data) ? data : []);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchHealth().then((ok) => {
      if (!active) return;
      setTelephonyHealthy(Boolean(ok));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!c2dExtension && extensions.length) {
      setC2dExtension(extensions[0]?.extension_number || "");
    }
  }, [extensions, c2dExtension]);

  const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

  const pbxMatches = useMemo(() => {
    const map = new Map();
    pbxEntries.forEach((entry) => {
      const key = normalizeDigits(entry?.number);
      if (key) {
        map.set(key, entry);
      }
    });
    return map;
  }, [pbxEntries]);
  const isC2DReady = telephonyHealthy && extensions.length > 0;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    api
      .getMetricsSettings()
      .then((data) => {
        if (!active) return;
        setMetricsSettings((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!customers.length) {
      setActiveId(null);
      return;
    }
    const stillExists = customers.some((customer) => customer.id === activeId);
    if (!stillExists) {
      setActiveId(customers[0].id);
    }
  }, [customers, activeId]);

  const filteredCustomers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const baseList = showInactive
      ? customers
      : customers.filter((customer) => String(customer.status || "active").toLowerCase() !== "inactive");
    if (!trimmed) return baseList;
    const filtered = baseList.filter((customer) => {
      const phoneMatch = customer.phones?.some((phone) =>
        `${phone.label} ${phone.number}`.toLowerCase().includes(trimmed)
      );
      return (
        customer.name?.toLowerCase().includes(trimmed) ||
        customer.creditorNumber?.toLowerCase().includes(trimmed) ||
        customer.shortCode?.toLowerCase().includes(trimmed) ||
        customer.email?.toLowerCase().includes(trimmed) ||
        phoneMatch
      );
    });
    return filtered;
  }, [customers, query, showInactive]);

  const sortedCustomers = useMemo(() => {
    const list = filteredCustomers.slice();
    list.sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      if (nameA && nameB) return nameA.localeCompare(nameB, "de");
      if (nameA) return -1;
      if (nameB) return 1;
      return String(a.id).localeCompare(String(b.id));
    });
    return list;
  }, [filteredCustomers]);

  useEffect(() => {
    if (!sortedCustomers.length) {
      setActiveId(null);
      return;
    }
    if (!sortedCustomers.some((customer) => customer.id === activeId)) {
      setActiveId(sortedCustomers[0].id);
    }
  }, [sortedCustomers, activeId]);

  const activeCustomer = customers.find((customer) => customer.id === activeId) || null;
  const totalCustomers = customers.length;
  const inactiveCustomers = customers.filter(
    (customer) => String(customer.status || "active").toLowerCase() === "inactive"
  ).length;
  const activeCustomers = Math.max(0, totalCustomers - inactiveCustomers);

  useEffect(() => {
    if (!activeCustomer?.id) {
      setMetrics(null);
      return;
    }
    let active = true;
    setMetricsStatus("loading");
    fetch(`${API}/customers/${activeCustomer.id}/metrics`)
      .then((res) => {
        if (!res.ok) throw new Error("metrics_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setMetrics(data);
        setMetricsStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setMetricsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [activeCustomer?.id]);

  useEffect(() => {
    if (!activeCustomer?.name) {
      setReportOverview([]);
      return;
    }
    let active = true;
    setReportStatus("loading");
    fetch(`${API}/reports?customer_id=${activeCustomer.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("reports_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        setReportOverview(list);
        setReportStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setReportStatus("error");
      });
    return () => {
      active = false;
    };
  }, [activeCustomer?.name]);

  useEffect(() => {
    if (!activeCustomer?.id) {
      setDeliveryNotes([]);
      return;
    }
    let active = true;
    setDeliveryStatus("loading");
    fetch(`/api/delivery_notes?customer_id=${activeCustomer.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("delivery_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        setDeliveryNotes(list);
        setDeliveryStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setDeliveryStatus("error");
      });
    return () => {
      active = false;
    };
  }, [activeCustomer?.id]);

  const scheduleSave = (customer) => {
    if (!customer) return;
    if (saveTimers.current[customer.id]) {
      clearTimeout(saveTimers.current[customer.id]);
    }
    saveTimers.current[customer.id] = setTimeout(() => {
      api
        .update(customer.id, customerPayload(customer))
        .then((saved) => {
          setCustomers((prev) =>
            prev.map((entry) => (entry.id === saved.id ? normalizeCustomer(saved) : entry))
          );
        })
        .catch(() => {});
    }, 400);
  };

  const updateCustomer = (id, patch) => {
    setCustomers((prev) => {
      const next = prev.map((customer) =>
        customer.id === id ? { ...customer, ...patch } : customer
      );
      const updated = next.find((customer) => customer.id === id);
      scheduleSave(updated);
      return next;
    });
  };

  const openReportPreview = async (report) => {
    if (!report?.id) return;
    try {
      const res = await fetch(`/api/reports/${report.id}`);
      if (!res.ok) throw new Error("report_failed");
      const data = await res.json();
      const normalized = {
        customer: data.customer || report.customer || "",
        period: data.period || report.period || "",
        status: data.status || "",
        summary: data.summary || "",
        customer_action_text: data.customer_action_text || "",
        actions: data.items || []
      };
      setPreviewModal({
        open: true,
        title: normalized.period || "Bericht",
        html: renderReportHTML(normalized)
      });
    } catch (error) {
      setPreviewModal({
        open: true,
        title: "Bericht",
        html: "<p>Vorschau konnte nicht geladen werden.</p>"
      });
    }
  };

  const renderDeliveryHtml = (note) => {
    const rawSignature = String(note.signature_base64 || "").trim();
    const signatureSrc = rawSignature
      ? rawSignature.startsWith("data:")
        ? rawSignature
        : `data:image/png;base64,${rawSignature}`
      : "";
    const signature = signatureSrc
      ? `<img src="${signatureSrc}" alt="Unterschrift" style="max-width: 240px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 6px;" />`
      : "<span style=\"color:#94a3b8;\">Keine Unterschrift gespeichert.</span>";
    const createdDate = new Date(note.created_at || Date.now()).toLocaleDateString("de-DE");
    const timeFrom = String(note.time_from || "").trim();
    const timeTo = String(note.time_to || "").trim();
    const timeRange =
      timeFrom || timeTo ? `${timeFrom || "--:--"} - ${timeTo || "--:--"}` : "—";
    const customerLines = [
      activeCustomer?.name,
      activeCustomer?.street,
      [activeCustomer?.postalCode, activeCustomer?.city].filter(Boolean).join(" "),
      activeCustomer?.country
    ].filter(Boolean);
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#1f2937; padding: 18px 24px; max-width: 180mm; margin: 0 auto;">
        <div style="display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid #e2e8f0; padding-bottom:12px; margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <img src="/QTLogo.jpg" alt="Quansatech" width="48" height="48" style="height:48px; width:48px; object-fit:contain;" />
            <div>
              <div style="font-size:18px; font-weight:700;">Lieferschein</div>
              <div style="font-size:12px; color:#64748b;">QT Workbench</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px; color:#64748b;">Datum</div>
            <div style="font-size:13px; font-weight:600;">${createdDate}</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px;">
          <div>
            <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">Empfänger</div>
            ${customerLines.map((line) => `<div style="font-size:13px; font-weight:600;">${line}</div>`).join("")}
            ${
              activeCustomer?.creditorNumber
                ? `<div style="font-size:11px; color:#64748b; margin-top:4px;">Kundennummer ${activeCustomer.creditorNumber}</div>`
                : ""
            }
          </div>
          <div>
            <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">Leistungszeit</div>
            <div style="font-size:14px; font-weight:600;">${timeRange}</div>
            <div style="font-size:11px; color:#64748b; margin-top:4px;">Erfasst am ${createdDate}</div>
          </div>
        </div>

        <div style="border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; margin-bottom: 18px;">
          <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#94a3b8; margin-bottom:6px;">Leistung</div>
          <div style="font-size:13px; line-height:1.5; white-space:pre-line;">
            ${String(note.note || "Lieferschein").replaceAll("\n", "<br/>")}
          </div>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:12px;">
          <div style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#94a3b8; margin-bottom:8px;">Unterschrift</div>
          ${signature}
        </div>
      </div>
    `;
  };

  const openDeliveryPreview = (note) => {
    setPreviewModal({
      open: true,
      title: "Lieferschein",
      html: renderDeliveryHtml(note)
    });
  };

  const exportDeliveryPdf = (note) => {
    const html = renderDeliveryHtml(note);
    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "210mm";
    container.style.background = "#ffffff";
    document.body.appendChild(container);
    const filename = `Lieferschein_${activeCustomer?.name || "Kunde"}_${
      note?.created_at ? new Date(note.created_at).toLocaleDateString("de-DE") : "Datum"
    }`
      .replaceAll(" ", "_")
      .replaceAll("/", "-");
    const images = Array.from(container.querySelectorAll("img"));
    Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = resolve;
            img.onerror = resolve;
          })
      )
    )
      .then(async () => {
        try {
          const canvas = await html2canvas(container, {
            scale: 1,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false
          });
          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const ratio = pageWidth / canvas.width;
          const imgHeight = canvas.height * ratio;
          let position = 0;
          pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
          let heightLeft = imgHeight - pageHeight;
          while (heightLeft > 0) {
            position -= pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
            heightLeft -= pageHeight;
          }
          pdf.save(`${filename}.pdf`);
        } catch (error) {
          const win = window.open("", "_blank", "width=900,height=700");
          if (!win) return;
          win.document.write(
            `<html><head><title>Lieferschein</title></head><body>${html}</body></html>`
          );
          win.document.close();
          win.focus();
          win.print();
        }
      })
      .finally(() => {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      });
  };

  const removeDeliveryNote = async (noteId) => {
    if (!noteId) return;
    if (!confirm("Lieferschein löschen?")) return;
    await fetch(`/api/delivery_notes/${noteId}`, { method: "DELETE" });
    setDeliveryNotes((prev) => prev.filter((item) => item.id !== noteId));
  };

  const handleCreate = () => {
    api
      .create({ name: "Neuer Kunde", phones: [{ label: "", number: "" }] })
      .then((created) => {
        const normalized = normalizeCustomer(created);
        setCustomers((prev) => [normalized, ...prev]);
        setActiveId(normalized.id);
      });
  };

  const handleSevdeskSync = async () => {
    setSyncBusy(true);
    try {
      const result = await api.syncSevdesk();
      const refreshed = await api.list();
      setCustomers((refreshed || []).map(normalizeCustomer));
      setImportStatus(
        `sevDesk Sync: ${result.created || 0} neu, ${result.updated || 0} aktualisiert, ${result.inactivated || 0} inaktiv.`
      );
      setTimeout(() => setImportStatus(""), 5000);
    } catch {
      setImportStatus("sevDesk Sync fehlgeschlagen.");
      setTimeout(() => setImportStatus(""), 4000);
    } finally {
      setSyncBusy(false);
    }
  };

  const handleRemove = (id) => {
    api.remove(id).then(() => {
      setCustomers((prev) => prev.filter((customer) => customer.id !== id));
    });
  };

  const csvEscape = (value = "") => {
    const text = String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const exportHeader = [
    "Kunden-Nr.",
    "Anrede",
    "Titel",
    "Nachname",
    "Vorname",
    "Organisation",
    "Namenszusatz",
    "Position",
    "Kategorie",
    "IBAN",
    "BIC",
    "Umsatzsteuer-ID",
    "Strasse",
    "PLZ",
    "Ort",
    "Land",
    "Adresse-Kategorie",
    "Telefon",
    "Telefon-Kategorie",
    "Mobil",
    "Fax",
    "E-Mail",
    "E-Mail-Kategorie",
    "Webseite",
    "Webseite-Kategorie",
    "Beschreibung",
    "Geburtstag",
    "Tags",
    "Debitoren-Nr.",
    "Kreditoren-Nr.",
    "Leitweg-ID / Leitwegsnummer",
    "Steuernummer",
    "Skonto Tage",
    "Skonto Prozent",
    "Zahlungsziel Tage",
    "Kundenrabatt",
    "Ist Kundenrabatt prozentual"
  ];

  const buildPhonesField = (phones = []) =>
    phones
      .filter((phone) => (phone.label || "").trim() || (phone.number || "").trim())
      .map((phone) => `${phone.label || ""}:${phone.number || ""}`.trim())
      .join("; ");

  const pickPhones = (phones = []) => {
    const list = phones.filter((phone) => (phone.number || "").trim());
    const mobile = list.find((phone) =>
      (phone.label || "").toLowerCase().includes("mobil")
    );
    const phone = list.find((entry) => entry !== mobile) || mobile || null;
    return {
      phoneNumber: phone?.number || "",
      phoneLabel: phone?.label || "",
      mobileNumber: mobile?.number || "",
      mobileLabel: mobile?.label || ""
    };
  };

  const downloadCsv = () => {
    const rows = customers.map((customer) => {
      const phones = pickPhones(customer.phones || []);
      const values = {
        "Kunden-Nr.": customer.creditorNumber || "",
        Organisation: customer.name || "",
        Strasse: customer.street || "",
        PLZ: customer.postalCode || "",
        Ort: customer.city || "",
        Land: customer.country || "",
        Telefon: phones.phoneNumber,
        "Telefon-Kategorie": phones.phoneLabel || (phones.phoneNumber ? "Arbeit" : ""),
        Mobil: phones.mobileNumber,
        "E-Mail": customer.email || "",
        "E-Mail-Kategorie": customer.email ? "Arbeit" : "",
        "Kreditoren-Nr.": customer.creditorNumber || "",
        Beschreibung: buildPhonesField(customer.phones || [])
      };
      return exportHeader.map((key) => values[key] ?? "");
    });
    const csv = [exportHeader, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kundenstamm_export.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const detectDelimiter = (line) => {
    const counts = {
      ",": (line.match(/,/g) || []).length,
      "\t": (line.match(/\t/g) || []).length,
      ";": (line.match(/;/g) || []).length
    };
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : ",";
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const value = text.replace(/^\ufeff/, "");
    const firstLine = value.split(/\r?\n/).find((line) => line.trim()) || "";
    const delimiter = detectDelimiter(firstLine);
    for (let i = 0; i < value.length; i += 1) {
      const char = value[i];
      if (inQuotes) {
        if (char === '"') {
          if (value[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char === "\r") {
        // ignore
      } else {
        field += char;
      }
    }
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  };

  const normalizeHeader = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");

  const parsePhones = (raw) => {
    const value = String(raw || "").trim();
    if (!value) return [];
    return value
      .split(/[;|]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const parts = entry.split(":");
        if (parts.length >= 2) {
          const label = parts.shift().trim();
          const number = parts.join(":").trim();
          return { label, number };
        }
        return { label: "", number: entry.trim() };
      })
      .filter((phone) => phone.label || phone.number);
  };

  const buildNameFromParts = (parts) =>
    parts
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");

  const parsePhonesFromColumns = ({ phone, phoneCategory, mobile, fax, extraPhones }) => {
    const phones = [];
    if (phone) {
      phones.push({
        label: phoneCategory || "Telefon",
        number: phone
      });
    }
    if (mobile) {
      phones.push({
        label: "Mobil",
        number: mobile
      });
    }
    if (fax) {
      phones.push({
        label: "Fax",
        number: fax
      });
    }
    if (extraPhones?.length) {
      phones.push(...extraPhones);
    }
    return phones.filter((entry) => entry.label || entry.number);
  };

  const buildImportRows = (text) => {
    const rows = parseCsv(text);
    if (!rows.length) return [];
    const header = rows.shift().map(normalizeHeader);
    const findIndex = (aliases) =>
      aliases.map((alias) => header.indexOf(alias)).find((idx) => idx >= 0) ?? -1;
    const indexes = {
      name: findIndex(["name", "kunde", "kundenname"]),
      organisation: findIndex(["organisation", "organization", "firma"]),
      lastName: findIndex(["nachname", "lastname", "surname"]),
      firstName: findIndex(["vorname", "firstname", "givenname"]),
      title: findIndex(["titel", "title"]),
      nameSuffix: findIndex(["namenszusatz", "suffix"]),
      customerNumber: findIndex([
        "internal_number",
        "internal",
        "interne_nummer",
        "kundennummer",
        "kundennr",
        "kunden_nr",
        "kunden_nr_"
      ]),
      creditor: findIndex(["creditor_number", "creditor", "kreditor", "kreditorennummer"]),
      email: findIndex(["email", "e_mail", "mail"]),
      street: findIndex(["strasse", "straße", "street"]),
      postalCode: findIndex(["plz", "postal_code", "zip"]),
      city: findIndex(["ort", "city"]),
      country: findIndex(["land", "country"]),
      phones: findIndex(["phones", "phone", "telefonnummern", "rufnummern"]),
      phone: findIndex(["telefon"]),
      phoneCategory: findIndex(["telefon_kategorie"]),
      mobile: findIndex(["mobil", "handy"]),
      fax: findIndex(["fax"]),
      creditorAlt: findIndex(["kreditoren_nr", "kreditoren_nr_"])
    };

    return rows.map((row) => {
      const nameValue = indexes.name >= 0 ? String(row[indexes.name] || "").trim() : "";
      const organisation =
        indexes.organisation >= 0 ? String(row[indexes.organisation] || "").trim() : "";
      const name = organisation || nameValue;
      const fallbackName = buildNameFromParts([
        indexes.title >= 0 ? row[indexes.title] : "",
        indexes.firstName >= 0 ? row[indexes.firstName] : "",
        indexes.lastName >= 0 ? row[indexes.lastName] : "",
        indexes.nameSuffix >= 0 ? row[indexes.nameSuffix] : ""
      ]);
      const customerNumber =
        indexes.customerNumber >= 0 ? String(row[indexes.customerNumber] || "").trim() : "";
      const creditorNumberRaw =
        indexes.creditor >= 0 ? String(row[indexes.creditor] || "").trim() : "";
      const creditorNumber =
        creditorNumberRaw ||
        (indexes.creditorAlt >= 0 ? String(row[indexes.creditorAlt] || "").trim() : "");
      const email = indexes.email >= 0 ? String(row[indexes.email] || "").trim() : "";
      const street = indexes.street >= 0 ? String(row[indexes.street] || "").trim() : "";
      const postalCode =
        indexes.postalCode >= 0 ? String(row[indexes.postalCode] || "").trim() : "";
      const city = indexes.city >= 0 ? String(row[indexes.city] || "").trim() : "";
      const country = indexes.country >= 0 ? String(row[indexes.country] || "").trim() : "";
      const phones = parsePhonesFromColumns({
        phone: indexes.phone >= 0 ? String(row[indexes.phone] || "").trim() : "",
        phoneCategory:
          indexes.phoneCategory >= 0 ? String(row[indexes.phoneCategory] || "").trim() : "",
        mobile: indexes.mobile >= 0 ? String(row[indexes.mobile] || "").trim() : "",
        fax: indexes.fax >= 0 ? String(row[indexes.fax] || "").trim() : "",
        extraPhones: indexes.phones >= 0 ? parsePhones(row[indexes.phones]) : []
      });
      const finalName = name || fallbackName;
      const resolvedCreditorNumber = creditorNumber || customerNumber;
      return {
        name: finalName,
        creditorNumber: resolvedCreditorNumber,
        email,
        street,
        postalCode,
        city,
        country,
        phones
      };
    });
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const rows = buildImportRows(text);
    if (!rows.length) {
      setImportStatus("CSV ist leer.");
      return;
    }
    const byNumber = new Map(
      customers
        .filter((customer) => customer.creditorNumber)
        .map((customer) => [String(customer.creditorNumber).trim(), customer])
    );
    const byName = new Map(
      customers
        .filter((customer) => customer.name)
        .map((customer) => [String(customer.name).trim().toLowerCase(), customer])
    );
    const preview = rows.map((row) => {
      const existing =
        (row.creditorNumber && byNumber.get(row.creditorNumber)) ||
        (row.name && byName.get(row.name.toLowerCase()));
      if (!row.name && !row.creditorNumber) {
        return { action: "skip", row, reason: "Kein Name/Nummer" };
      }
      if (existing) {
        return { action: "update", row };
      }
      if (!row.name) {
        return { action: "skip", row, reason: "Kein Name" };
      }
      return { action: "create", row };
    });
    setImportPreview(preview);
  };

  const applyImport = async () => {
    if (!importPreview?.length) return;
    setImportStatus("Import läuft...");
    const byNumber = new Map(
      customers
        .filter((customer) => customer.creditorNumber)
        .map((customer) => [String(customer.creditorNumber).trim(), customer])
    );
    const byName = new Map(
      customers
        .filter((customer) => customer.name)
        .map((customer) => [String(customer.name).trim().toLowerCase(), customer])
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const entry of importPreview) {
      const { row, action } = entry;
      const existing =
        (row.creditorNumber && byNumber.get(row.creditorNumber)) ||
        (row.name && byName.get(row.name.toLowerCase()));

      if (action === "create") {
        if (!importApplyCreate) {
          skipped += 1;
          continue;
        }
        await api.create({
          name: row.name,
          creditor_number: row.creditorNumber,
          email: row.email,
          street: row.street,
          postal_code: row.postalCode,
          city: row.city,
          country: row.country,
          phones: row.phones
        });
        created += 1;
        continue;
      }

      if (action === "update" && existing) {
        if (!importApplyUpdate) {
          skipped += 1;
          continue;
        }
        const payload = {};
        if (row.name) payload.name = row.name;
        if (row.creditorNumber) payload.creditor_number = row.creditorNumber;
        if (row.email) payload.email = row.email;
        if (row.street) payload.street = row.street;
        if (row.postalCode) payload.postal_code = row.postalCode;
        if (row.city) payload.city = row.city;
        if (row.country) payload.country = row.country;
        if (row.phones?.length) payload.phones = row.phones;
        if (!Object.keys(payload).length) {
          skipped += 1;
          continue;
        }
        await api.update(existing.id, payload);
        updated += 1;
        continue;
      }
      skipped += 1;
    }

    const refreshed = await api.list();
    setCustomers((refreshed || []).map(normalizeCustomer));
    setImportStatus(`Import fertig: ${created} neu, ${updated} aktualisiert, ${skipped} übersprungen.`);
    setImportPreview(null);
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
    setTimeout(() => setImportStatus(""), 4000);
  };

  const updatePhone = (phoneId, patch) => {
    if (!activeCustomer) return;
    const nextPhones = activeCustomer.phones.map((phone) =>
      phone.id === phoneId ? { ...phone, ...patch } : phone
    );
    updateCustomer(activeCustomer.id, { phones: nextPhones });
  };

  const addPhone = () => {
    if (!activeCustomer) return;
    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === activeCustomer.id
          ? { ...customer, phones: [...(customer.phones || []), blankPhone()] }
          : customer
      )
    );
  };

  const removePhone = (phoneId) => {
    if (!activeCustomer) return;
    const nextPhones = activeCustomer.phones.filter((phone) => phone.id !== phoneId);
    updateCustomer(activeCustomer.id, { phones: nextPhones.length ? nextPhones : [blankPhone()] });
  };

  const addPhoneToPbx = async (phone) => {
    if (!activeCustomer) return;
    const number = String(phone?.number || "").trim();
    if (!number) return;
    try {
      const result = await telephonyService.createPbxPhonebookEntry(
        {
        name: activeCustomer.name || "",
        number,
        is_global: false
        },
        { allowFallback: !pbxApiActive }
      );
      if (!result) {
        throw new Error("pbx_add_failed");
      }
      setToast("Telefonbuch uebernommen.");
    } catch (error) {
      setToast("Telefonbuch-Uebernahme fehlgeschlagen.");
    }
  };

  const openClickToDial = (phone) => {
    const number = String(phone?.number || "").trim();
    if (!number || !isC2DReady) return;
    setC2dTarget({
      number,
      label: phone.label || activeCustomer?.name || ""
    });
    setC2dStatus("");
    setC2dBusy(false);
    setC2dExtension(extensions[0]?.extension_number || "");
  };

  const closeClickToDial = () => {
    setC2dTarget(null);
    setC2dStatus("");
    setC2dBusy(false);
  };

  const handleStartClickToDial = async () => {
    if (!c2dTarget) return;
    if (!c2dExtension) {
      setC2dStatus("Bitte Nebenstelle wählen.");
      return;
    }
    setC2dBusy(true);
    setC2dStatus("Rückruf wird gestartet...");
    try {
      const result = await telephonyService.clickToDial({
        extension: c2dExtension,
        number: c2dTarget.number
      });
      if (result) {
        setC2dStatus("Rückruf gestartet.");
        setTimeout(() => closeClickToDial(), 900);
      } else {
        setC2dStatus("Rückruf fehlgeschlagen.");
      }
    } catch (error) {
      setC2dStatus("Rückruf fehlgeschlagen.");
    } finally {
      setC2dBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50">
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
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Vorschau</p>
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
      {c2dTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-200 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Click to Dial</p>
              <h3 className="text-lg font-display text-sand-900">{c2dTarget.number}</h3>
              {c2dTarget.label ? (
                <p className="text-[11px] text-sand-500">{c2dTarget.label}</p>
              ) : null}
            </div>
            <div className="p-5 space-y-4">
              <label className="text-xs uppercase tracking-wide text-sand-500">
                Nebenstelle auswählen
                <select
                  value={c2dExtension}
                  onChange={(event) => setC2dExtension(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm"
                >
                  {extensions.length ? (
                    extensions.map((item) => (
                      <option key={item.uuid || item.extension_number} value={item.extension_number}>
                        {item.extension_number} {item.name ? `– ${item.name}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">Keine Nebenstellen</option>
                  )}
                </select>
              </label>
              {c2dStatus ? <p className="text-xs text-sand-500">{c2dStatus}</p> : null}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={closeClickToDial}
                  className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleStartClickToDial}
                  disabled={c2dBusy || !isC2DReady}
                  className={`rounded-full px-4 py-2 text-xs uppercase tracking-wide ${
                    c2dBusy || !isC2DReady
                      ? "border border-sand-300 bg-sand-100 text-sand-400 cursor-not-allowed"
                      : "border border-sand-900 bg-sand-900 text-white hover:opacity-90"
                  }`}
                >
                  Jetzt anrufen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Kundenstamm</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-200 bg-sand-900 text-white px-4 py-1.5 text-xs uppercase tracking-wide hover:opacity-90"
            >
              <Plus size={14} /> Neuer Kunde
            </button>
            <button
              type="button"
              onClick={handleSevdeskSync}
              disabled={syncBusy}
              className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-1.5 text-xs uppercase tracking-wide ${
                syncBusy
                  ? "border-sand-200 bg-sand-100 text-sand-400 cursor-not-allowed"
                  : "border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
              }`}
            >
              sevDesk Sync
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-200 bg-white px-4 py-1.5 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              CSV exportieren
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-200 bg-white px-4 py-1.5 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              CSV importieren
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => handleImportFile(event.target.files?.[0])}
            />
            {importStatus ? <div className="text-xs text-sand-500">{importStatus}</div> : null}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5">
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-sand-200 bg-white shadow-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Übersicht</p>
                <h2 className="text-base font-display text-sand-900">Kundendatei</h2>
              </div>
              <span className="rounded-full border border-sand-200 px-3 py-1 text-xs text-sand-600">
                Gesamt {totalCustomers} · Aktiv {activeCustomers} · Inaktiv {inactiveCustomers}
              </span>
            </div>
            <label className="relative block mb-3">
              <span className="sr-only">Suche</span>
              <Search size={14} className="absolute left-3 top-3 text-sand-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Suche nach Name, Nummer, Telefon…"
                className="w-full rounded-2xl border border-sand-200 pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-sand-300"
              />
            </label>
            <label className="mb-2 flex items-center gap-2 text-xs text-sand-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4"
              />
              Inaktive Kunden einblenden
            </label>
            <div className="mt-3 space-y-1.5 max-h-[520px] overflow-auto pr-1">
              {filteredCustomers.length ? (
                sortedCustomers.map((customer) => {
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setActiveId(customer.id)}
                      className={`w-full text-left rounded-2xl border px-2.5 py-1 transition ${
                        customer.id === activeId
                          ? "border-sand-900 bg-sand-900 text-white"
                          : "border-sand-200 bg-sand-50 text-sand-700 hover:bg-sand-100"
                      }`}
                    >
                      <div className="text-[11px] font-semibold leading-tight">
                        {customer.name?.trim() || "Unbenannter Kunde"}
                      </div>
                      <div className="mt-0.5 text-[9px] text-sand-500 leading-tight">
                        {customer.creditorNumber || customer.shortCode ? (
                          <>
                            {customer.creditorNumber
                              ? `Kunden-Nr. ${customer.creditorNumber}`
                              : "Ohne Nummer"}
                            {customer.shortCode ? ` · ${customer.shortCode}` : ""}
                          </>
                        ) : (
                          "Ohne Nummer"
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-sand-200 p-4 text-xs text-sand-500">
                  Keine Treffer. Tipp: über den Namen oder die interne Nummer suchen.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-sand-200 pb-3 mb-4">
              <button
                type="button"
                onClick={() => setSettingsTab("details")}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
                  settingsTab === "details"
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                }`}
              >
                Kunde
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("settings")}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
                  settingsTab === "settings"
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                }`}
              >
                Kennzahlenbasis
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("development")}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
                  settingsTab === "development"
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                }`}
              >
                Kundenentwicklung
              </button>
            </div>
            {settingsTab === "settings" ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Firmenstandort
                    </span>
                    <input
                      value={metricsSettings.office_address}
                      onChange={(event) =>
                        setMetricsSettings((prev) => ({
                          ...prev,
                          office_address: event.target.value
                        }))
                      }
                      placeholder="z. B. Steyrtalstraße 88, 4523 Neuzeug"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Kilometergeld (€/km)
                    </span>
                    <input
                      value={metricsSettings.km_rate_eur}
                      onChange={(event) =>
                        setMetricsSettings((prev) => ({
                          ...prev,
                          km_rate_eur: event.target.value
                        }))
                      }
                      placeholder="0.80"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Stundensatz (€)
                    </span>
                    <input
                      value={metricsSettings.hourly_rate_eur}
                      onChange={(event) =>
                        setMetricsSettings((prev) => ({
                          ...prev,
                          hourly_rate_eur: event.target.value
                        }))
                      }
                      placeholder="90"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Mindeststrecke (km)
                    </span>
                    <input
                      value={metricsSettings.min_distance_km}
                      onChange={(event) =>
                        setMetricsSettings((prev) => ({
                          ...prev,
                          min_distance_km: event.target.value
                        }))
                      }
                      placeholder="15"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Mindestbetrag (€)
                    </span>
                    <input
                      value={metricsSettings.min_fee_eur}
                      onChange={(event) =>
                        setMetricsSettings((prev) => ({
                          ...prev,
                          min_fee_eur: event.target.value
                        }))
                      }
                      placeholder="15"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setMetricsSettingsStatus("saving");
                    try {
                      const saved = await api.saveMetricsSettings(metricsSettings);
                      setMetricsSettings(saved);
                      setMetricsSettingsStatus("saved");
                    } catch (error) {
                      setMetricsSettingsStatus("error");
                    }
                    setTimeout(() => setMetricsSettingsStatus("idle"), 2000);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  Speichern
                </button>
                {metricsSettingsStatus === "saved" ? (
                  <span className="text-xs text-emerald-600">Gespeichert</span>
                ) : metricsSettingsStatus === "error" ? (
                  <span className="text-xs text-rose-600">Speichern fehlgeschlagen</span>
                ) : null}
              </div>
            ) : settingsTab === "development" ? (
              <CustomerDevelopmentCustomerTab
                customerId={activeCustomer?.id}
                customerName={activeCustomer?.name || ""}
                customerNumber={activeCustomer?.creditorNumber || ""}
              />
            ) : activeCustomer ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Stammdaten</p>
                    <h2 className="text-xl font-display text-sand-900">
                      {activeCustomer.name?.trim() || "Kunde bearbeiten"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(activeCustomer.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 size={12} /> Entfernen
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">Name</span>
                    <input
                      value={activeCustomer.name}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { name: event.target.value })
                      }
                      placeholder="z. B. Quansatech GmbH"
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Kundennummer (Faktura)
                    </span>
                    <input
                      value={activeCustomer.creditorNumber}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { creditorNumber: event.target.value })
                      }
                      placeholder="z. B. 1042"
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Kundenkürzel
                    </span>
                    <input
                      value={activeCustomer.shortCode}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { shortCode: event.target.value })
                      }
                      placeholder="z. B. QT"
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">E-Mail-Adresse</span>
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-sand-200 px-3 py-2">
                      <Mail size={14} className="text-sand-400" />
                      <input
                        value={activeCustomer.email}
                        onChange={(event) =>
                          updateCustomer(activeCustomer.id, { email: event.target.value })
                        }
                        placeholder="name@kunde.de"
                        className="w-full text-sm focus:outline-none"
                        type="email"
                      />
                    </div>
                  </label>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Kommunikation</p>
                    {!activeCustomer.customerReport ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] uppercase tracking-wide text-rose-600">
                        Kundenbericht deaktiviert
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={Boolean(activeCustomer.customerReport)}
                        onChange={(event) =>
                          updateCustomer(activeCustomer.id, {
                            customerReport: event.target.checked
                          })
                        }
                        className="h-4 w-4"
                      />
                      <span>Kundenbericht</span>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-700">
                      <input
                        type="checkbox"
                        checked={Boolean(activeCustomer.newsletter)}
                        onChange={(event) =>
                          updateCustomer(activeCustomer.id, {
                            newsletter: event.target.checked
                          })
                        }
                        className="h-4 w-4"
                      />
                      <span>Newsletter</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Verträge & Status</p>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-sand-500">Kundenstatus</span>
                      <select
                        value={activeCustomer.status || "active"}
                        onChange={(event) =>
                          updateCustomer(activeCustomer.id, { status: event.target.value })
                        }
                        className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                      >
                        <option value="active">Aktiv</option>
                        <option value="inactive">Inaktiv</option>
                      </select>
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { id: "monitoring", label: "Monitoring" },
                        { id: "wartung", label: "Wartung (inkl. SLA)" }
                      ].map((contract) => (
                        <label
                          key={contract.id}
                          className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-700"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean((activeCustomer.contractFlags || []).includes(contract.id))}
                            onChange={(event) => {
                              const current = new Set(activeCustomer.contractFlags || []);
                              if (event.target.checked) current.add(contract.id);
                              else current.delete(contract.id);
                              const nextFlags = Array.from(current);
                              updateCustomer(activeCustomer.id, {
                                contractFlags: nextFlags,
                                maintenanceContract: nextFlags.includes("wartung")
                              });
                            }}
                            className="h-4 w-4"
                          />
                          <span>{contract.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block md:col-span-2">
                    <span className="text-xs uppercase tracking-wide text-sand-500">Straße</span>
                    <input
                      value={activeCustomer.street}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { street: event.target.value })
                      }
                      placeholder="z. B. Steyrtalstraße 88"
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">PLZ</span>
                    <input
                      value={activeCustomer.postalCode}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { postalCode: event.target.value })
                      }
                      placeholder="z. B. 4523"
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">Ort</span>
                    <input
                      value={activeCustomer.city}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { city: event.target.value })
                      }
                      placeholder="z. B. Neuzeug"
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">Land</span>
                    <input
                      value={activeCustomer.country}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { country: event.target.value })
                      }
                      placeholder="z. B. Österreich"
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 text-sand-700">
                      <Phone size={16} />
                      <p className="text-sm uppercase tracking-[0.3em] text-sand-500">
                        Rufnummern
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addPhone}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                    >
                      <Plus size={12} /> Rufnummer
                    </button>
                  </div>
                  <div className="space-y-2">
                    {activeCustomer.phones?.map((phone) => (
                      <div
                        key={phone.id}
                        className="grid gap-2 md:grid-cols-[140px_180px_repeat(3,auto)] items-center"
                      >
                        <input
                          value={phone.label}
                          onChange={(event) => updatePhone(phone.id, { label: event.target.value })}
                          placeholder="z. B. Arbeit"
                          className="rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                        />
                        <input
                          value={phone.number}
                          onChange={(event) => updatePhone(phone.id, { number: event.target.value })}
                          placeholder="+49 40 123456"
                          className="rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300 max-w-[180px]"
                        />
                        {pbxMatches.has(normalizeDigits(phone.number)) ? null : (
                          <button
                            type="button"
                            onClick={() => addPhoneToPbx(phone)}
                            disabled={!pbxApiActive}
                            className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs text-sand-600 ${
                              pbxApiActive
                                ? "border-sand-200 bg-white hover:bg-sand-100"
                                : "border-sand-200 bg-sand-100 opacity-50 cursor-not-allowed"
                            }`}
                            title="Ins Anlagen-Telefonbuch übernehmen"
                          >
                            <BookPlus size={12} />
                          </button>
                        )}
                        {String(phone.number || "").trim() ? (
                          <button
                            type="button"
                            onClick={() => openClickToDial(phone)}
                            disabled={!isC2DReady}
                            className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs ${
                              isC2DReady
                                ? "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                                : "border-sand-200 bg-sand-100 text-sand-400 opacity-60 cursor-not-allowed"
                            }`}
                            title={
                              !telephonyHealthy
                                ? "Telefonie-API nicht erreichbar"
                                : !extensions.length
                                ? "Keine Nebenstelle verfügbar"
                                : "Click-to-dial starten"
                            }
                          >
                            <PhoneOutgoing size={12} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removePhone(phone.id)}
                          className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sand-700 mb-3">
                    <Building2 size={16} />
                    <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Operative Kennzahlen</p>
                  </div>
                  {metricsStatus === "loading" ? (
                    <p className="text-sm text-sand-500">Lädt Kennzahlen…</p>
                  ) : metricsStatus === "error" ? (
                    <p className="text-sm text-rose-600">Kennzahlen konnten nicht geladen werden.</p>
                  ) : metrics ? (
                    <div className="grid gap-3 sm:grid-cols-5 text-sm text-sand-700">
                      <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">Entfernung</p>
                        <p className="text-base font-semibold">
                          {metrics.distanceKm != null ? `${metrics.distanceKm} km` : "Adresse fehlt"}
                        </p>
                        <p className="text-xs text-sand-500">
                          {metrics.mileageEur != null ? `Vorschlag: € ${metrics.mileageEur}` : ""}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">
                          Offene Tasks
                        </p>
                        <p className="text-base font-semibold">{metrics.openTasks}</p>
                        <p className="text-xs text-sand-500">
                          Tagesplan: {metrics.openDayTasks ?? 0} · Zeit: {metrics.openTimeTasks ?? 0}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">
                          Offene Zeit
                        </p>
                        <p className="text-base font-semibold">
                          {metrics.openTimeMinutes ?? 0} Min
                        </p>
                        <p className="text-xs text-sand-500">
                          Umsatz: € {Number(metrics.estimatedRevenueEur ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">
                          Umsatz (Sevdesk)
                        </p>
                        <p className="text-base font-semibold">
                          {formatEur(metrics.revenueCurrentYearEur)}
                        </p>
                        <p className="text-xs text-sand-500">
                          Vorjahr: {formatEur(metrics.revenueLastYearEur)}
                        </p>
                        <p className="text-xs text-sand-500">
                          Veränderung:{" "}
                          {metrics.revenueDeltaEur == null
                            ? "n/a"
                            : `${metrics.revenueDeltaEur >= 0 ? "+" : ""}${formatEur(
                                metrics.revenueDeltaEur
                              )}`}
                          {metrics.revenueDeltaPct != null
                            ? ` (${metrics.revenueDeltaPct >= 0 ? "+" : ""}${metrics.revenueDeltaPct}%)`
                            : ""}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">
                          Telefonie (30 Tage)
                        </p>
                        <p className="text-base font-semibold">
                          {metrics.totalMinutes} Min
                        </p>
                        <p className="text-xs text-sand-500">Verpasst: {metrics.missedCalls}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-sand-500">Noch keine Kennzahlen.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-sand-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sand-700 mb-3">
                    <BadgeCheck size={16} />
                    <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Berichte</p>
                  </div>
                  {reportStatus === "loading" ? (
                    <p className="text-sm text-sand-500">Berichte laden…</p>
                  ) : reportStatus === "error" ? (
                    <p className="text-sm text-rose-600">Berichte konnten nicht geladen werden.</p>
                  ) : reportOverview.length ? (
                    <div className="space-y-2">
                      {reportOverview.slice(0, 5).map((report) => (
                        <div
                          key={report.id}
                          className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700"
                        >
                          <div>
                            <div className="font-semibold">
                              {report.period || "Bericht"}
                            </div>
                            <div className="text-xs text-sand-500">
                              {report.created_at
                                ? new Date(report.created_at).toLocaleDateString("de-DE")
                                : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase tracking-wide text-sand-500">
                              {report.opened_count
                                ? `${report.opened_count}x gelesen`
                                : "nicht gelesen"}
                            </span>
                            <button
                              type="button"
                              onClick={() => openReportPreview(report)}
                              className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                              title="Vorschau"
                            >
                              <Eye size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {reportOverview.length > 5 ? (
                        <p className="text-xs text-sand-500">
                          +{reportOverview.length - 5} weitere Berichte
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-sand-500">Keine Berichte vorhanden.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-sand-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-sand-700 mb-3">
                    <FileDown size={16} />
                    <p className="text-sm uppercase tracking-[0.3em] text-sand-500">
                      Lieferscheine
                    </p>
                  </div>
                  {deliveryStatus === "loading" ? (
                    <p className="text-sm text-sand-500">Lieferscheine laden…</p>
                  ) : deliveryStatus === "error" ? (
                    <p className="text-sm text-rose-600">Lieferscheine konnten nicht geladen werden.</p>
                  ) : deliveryNotes.length ? (
                    <div className="space-y-2">
                      {deliveryNotes.slice(0, 5).map((note) => (
                        <div
                          key={note.id}
                          className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700"
                        >
                          <div>
                            <div className="font-semibold">Lieferschein</div>
                            <div className="text-xs text-sand-500">
                              {note.created_at
                                ? new Date(note.created_at).toLocaleDateString("de-DE")
                                : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openDeliveryPreview(note)}
                              className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                              title="Vorschau"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => exportDeliveryPdf(note)}
                              className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                              title="PDF exportieren"
                            >
                              <FileDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDeliveryNote(note.id)}
                              className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"
                              title="Löschen"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {deliveryNotes.length > 5 ? (
                        <p className="text-xs text-sand-500">
                          +{deliveryNotes.length - 5} weitere Lieferscheine
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-sand-500">Keine Lieferscheine vorhanden.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-sand-200 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-3 text-xs text-sand-600">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={14} />
                      <span>Stammdaten gepflegt</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 size={14} />
                      <span>Faktura bereit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} />
                      <span>E-Mail verfügbar</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Start</p>
                  <h2 className="text-xl font-display text-sand-900">Ersten Kunden anlegen</h2>
                  <p className="text-sm text-sand-500 mt-2">
                    Lege Namen, Nummern, E-Mail und mehrere Rufnummern pro Kunde ab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 rounded-2xl border border-sand-200 bg-sand-900 text-white px-4 py-2 text-sm hover:opacity-90"
                >
                  <Plus size={16} /> Kundenstamm starten
                </button>
              </div>
            )}
          </section>
        </div>
        {importPreview ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">CSV Import</p>
                  <h3 className="text-xl font-display text-sand-900">Vorschau</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setImportPreview(null)}
                  className="rounded-full border border-sand-200 px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                >
                  Schließen
                </button>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-sand-600 mb-4">
                <span>
                  Neu: {importPreview.filter((item) => item.action === "create").length}
                </span>
                <span>
                  Update: {importPreview.filter((item) => item.action === "update").length}
                </span>
                <span>
                  Übersprungen: {importPreview.filter((item) => item.action === "skip").length}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 mb-4">
                <label className="inline-flex items-center gap-2 text-xs text-sand-700">
                  <input
                    type="checkbox"
                    checked={importApplyCreate}
                    onChange={(event) => setImportApplyCreate(event.target.checked)}
                  />
                  Neue Kunden anlegen
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-sand-700">
                  <input
                    type="checkbox"
                    checked={importApplyUpdate}
                    onChange={(event) => setImportApplyUpdate(event.target.checked)}
                  />
                  Bestehende aktualisieren
                </label>
              </div>
              <div className="max-h-64 overflow-auto rounded-2xl border border-sand-200 bg-sand-50 p-3 text-sm text-sand-700">
                {importPreview.slice(0, 10).map((item, idx) => (
                  <div key={`${item.action}-${idx}`} className="flex items-center justify-between py-1">
                    <span>{item.row.name || "Unbenannt"}</span>
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      {item.action === "create"
                        ? "Neu"
                        : item.action === "update"
                        ? "Update"
                        : "Skip"}
                    </span>
                  </div>
                ))}
                {importPreview.length > 10 ? (
                  <div className="pt-2 text-xs text-sand-500">
                    +{importPreview.length - 10} weitere Einträge
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportPreview(null)}
                  className="rounded-full border border-sand-200 px-4 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={applyImport}
                  className="rounded-full border border-sand-200 bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  Import starten
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
