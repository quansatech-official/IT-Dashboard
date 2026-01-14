import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Eye,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Users
} from "lucide-react";
import { renderReportHTML, uid } from "../reporting/utils";

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
    }).then((r) => r.json())
};

const blankPhone = () => ({
  id: uid(),
  label: "",
  number: ""
});

const normalizeCustomer = (customer) => ({
  ...customer,
  creditorNumber:
    customer.creditor_number ?? customer.creditorNumber ?? customer.internal_number ?? "",
  shortCode: customer.short_code ?? customer.shortCode ?? "",
  street: customer.street ?? "",
  postalCode: customer.postal_code ?? customer.postalCode ?? "",
  city: customer.city ?? "",
  country: customer.country ?? "",
  phones: customer.phones?.length ? customer.phones : [blankPhone()]
});

const customerPayload = (customer) => ({
  name: customer.name || "Neuer Kunde",
  creditor_number: customer.creditorNumber || "",
  short_code: customer.shortCode || "",
  email: customer.email || "",
  street: customer.street || "",
  postal_code: customer.postalCode || "",
  city: customer.city || "",
  country: customer.country || "",
  phones: (customer.phones || [])
    .filter((phone) => (phone.label || "").trim() || (phone.number || "").trim())
    .map((phone) => ({
      id: Number.isInteger(phone.id) ? phone.id : undefined,
      label: phone.label || "",
      number: phone.number || ""
    }))
});

export default function CustomerDirectoryView() {
  const [customers, setCustomers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [metricsStatus, setMetricsStatus] = useState("idle");
  const [importPreview, setImportPreview] = useState(null);
  const [importApplyCreate, setImportApplyCreate] = useState(true);
  const [importApplyUpdate, setImportApplyUpdate] = useState(true);
  const [reportOverview, setReportOverview] = useState([]);
  const [reportStatus, setReportStatus] = useState("idle");
  const [settingsTab, setSettingsTab] = useState("details");
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
    if (!trimmed) return customers;
    const filtered = customers.filter((customer) => {
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
  }, [customers, query]);

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

  const activeCustomer = customers.find((customer) => customer.id === activeId) || null;

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

  const handleCreate = () => {
    api
      .create({ name: "Neuer Kunde", phones: [{ label: "", number: "" }] })
      .then((created) => {
        const normalized = normalizeCustomer(created);
        setCustomers((prev) => [normalized, ...prev]);
        setActiveId(normalized.id);
      });
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

  return (
    <div className="min-h-screen bg-sand-50">
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
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-2xl font-display text-sand-900">Kundenstamm</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-200 bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide hover:opacity-90"
            >
              <Plus size={14} /> Neuer Kunde
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              CSV exportieren
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
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

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-sand-200 bg-white shadow-soft p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Übersicht</p>
                <h2 className="text-lg font-display text-sand-900">Kundendatei</h2>
              </div>
              <span className="rounded-full border border-sand-200 px-3 py-1 text-xs text-sand-600">
                {customers.length} Kunde{customers.length === 1 ? "" : "n"}
              </span>
            </div>
            <label className="relative block mb-3">
              <span className="sr-only">Suche</span>
              <Search size={14} className="absolute left-3 top-3 text-sand-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Suche nach Name, Nummer, Telefon…"
                className="w-full rounded-2xl border border-sand-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
              />
            </label>
            <div className="mt-4 space-y-2 max-h-[520px] overflow-auto pr-1">
              {filteredCustomers.length ? (
                sortedCustomers.map((customer) => {
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setActiveId(customer.id)}
                      className={`w-full text-left rounded-2xl border px-3 py-3 transition ${
                        customer.id === activeId
                          ? "border-sand-900 bg-sand-900 text-white"
                          : "border-sand-200 bg-sand-50 text-sand-700 hover:bg-sand-100"
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        {customer.name?.trim() || "Unbenannter Kunde"}
                      </div>
                      <div className="mt-1 text-xs text-sand-500">
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
                        className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_auto] items-center"
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
                          className="rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                        />
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
                    <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Kennzahlen</p>
                  </div>
                  {metricsStatus === "loading" ? (
                    <p className="text-sm text-sand-500">Lädt Kennzahlen…</p>
                  ) : metricsStatus === "error" ? (
                    <p className="text-sm text-rose-600">Kennzahlen konnten nicht geladen werden.</p>
                  ) : metrics ? (
                    <div className="grid gap-3 sm:grid-cols-4 text-sm text-sand-700">
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
