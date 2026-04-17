import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  RefreshCw,
  Search
} from "lucide-react";
import * as XLSX from "xlsx";

const API = "/api";

const boolLabel = (value) => (value ? "Ja" : "Nein");

const cleanText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizeKey = (value) => cleanText(value).toLowerCase();

const slug = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const contractTypeLabels = {
  wartung: "Wartung",
  monitoring: "Monitoring",
  backup: "Backup",
  domain: "Domain",
  hosting: "Hosting",
  lizenz: "Lizenz",
  sonstiges: "Sonstiges"
};

const contractTypeLabel = (value) => contractTypeLabels[normalizeKey(value)] || cleanText(value) || "Vertrag";

const normalizeCustomer = (customer) => {
  const phones = Array.isArray(customer?.phones) ? customer.phones : [];
  const contractFlags = Array.isArray(customer?.contract_flags)
    ? customer.contract_flags
    : Array.isArray(customer?.contractFlags)
    ? customer.contractFlags
    : [];
  const contractDocumentFlags = Array.isArray(customer?.contract_document_flags)
    ? customer.contract_document_flags
    : Array.isArray(customer?.contractDocumentFlags)
    ? customer.contractDocumentFlags
    : [];
  const contractTypeCounts =
    customer?.contract_type_counts && typeof customer.contract_type_counts === "object"
      ? customer.contract_type_counts
      : customer?.contractTypeCounts && typeof customer.contractTypeCounts === "object"
      ? customer.contractTypeCounts
      : {};
  const contractTypes = [...new Set([...contractFlags, ...contractDocumentFlags, ...Object.keys(contractTypeCounts)])]
    .map(normalizeKey)
    .filter(Boolean);
  const primaryEmail = cleanText(customer?.primary_email ?? customer?.primaryEmail ?? customer?.email);
  const newsletterEmail = cleanText(
    customer?.newsletter_effective_email ??
      customer?.newsletterEffectiveEmail ??
      customer?.newsletter_email ??
      customer?.newsletterEmail ??
      customer?.general_email ??
      customer?.generalEmail
  );
  const billingEmail = cleanText(customer?.billing_email ?? customer?.billingEmail);
  return {
    id: customer?.id,
    name: cleanText(customer?.name),
    creditorNumber: cleanText(customer?.creditor_number ?? customer?.creditorNumber),
    sevdeskContactId: cleanText(customer?.sevdesk_contact_id ?? customer?.sevdeskContactId),
    shortCode: cleanText(customer?.short_code ?? customer?.shortCode),
    email: primaryEmail,
    newsletterEmail,
    billingEmail,
    newsletter: Boolean(customer?.newsletter),
    customerReport: Boolean(customer?.customer_report ?? customer?.customerReport),
    timeTracking: Boolean(customer?.time_tracking_enabled ?? customer?.timeTrackingEnabled),
    status: normalizeKey(customer?.status) === "inactive" ? "inactive" : "active",
    maintenanceContract:
      Boolean(customer?.maintenance_contract ?? customer?.maintenanceContract) || contractTypes.includes("wartung"),
    contractTypes,
    contractTypeCounts,
    street: cleanText(customer?.street),
    postalCode: cleanText(customer?.postal_code ?? customer?.postalCode),
    city: cleanText(customer?.city),
    country: cleanText(customer?.country),
    phones: phones
      .map((phone) => ({
        label: cleanText(phone?.label),
        number: cleanText(phone?.number)
      }))
      .filter((phone) => phone.label || phone.number)
  };
};

const filterOptions = {
  status: [
    { value: "all", label: "Alle" },
    { value: "active", label: "Nur aktiv" },
    { value: "inactive", label: "Nur inaktiv" }
  ],
  triState: [
    { value: "all", label: "Alle" },
    { value: "yes", label: "Ja" },
    { value: "no", label: "Nein" }
  ],
  contract: [
    { value: "all", label: "Alle" },
    { value: "any", label: "Mit Vertrag" },
    { value: "none", label: "Ohne Vertrag" },
    { value: "wartung", label: "Wartung" },
    { value: "monitoring", label: "Monitoring" },
    { value: "backup", label: "Backup" },
    { value: "domain", label: "Domain" },
    { value: "hosting", label: "Hosting" },
    { value: "lizenz", label: "Lizenz" }
  ],
  contact: [
    { value: "all", label: "Alle" },
    { value: "yes", label: "Vorhanden" },
    { value: "no", label: "Fehlt" }
  ]
};

const emptyFilters = {
  query: "",
  status: "active",
  newsletter: "all",
  customerReport: "all",
  timeTracking: "all",
  contract: "all",
  email: "all",
  phone: "all"
};

const exportDefinitions = [
  {
    id: "customers",
    label: "Kundenstamm",
    status: "ready",
    icon: FileSpreadsheet,
    description: "Kontakt-, Newsletter-, Status- und Vertragsfelder.",
    detail: "Basisliste fuer Pflege, Newsletter-Selektion und Vertragskontrolle."
  },
  {
    id: "contracts",
    label: "Vertraege",
    status: "planned",
    icon: FileText,
    description: "Vertragsdokumente, Laufzeiten, Status und monatliche Werte.",
    detail: "Naechster Ausbau: aktive Vertraege, Vorschlaege, Kuendigungen und Fristen."
  },
  {
    id: "newsletter",
    label: "Newsletter",
    status: "planned",
    icon: Mail,
    description: "Empfaengerlisten, Gruppen und fehlende Newsletter-Adressen.",
    detail: "Naechster Ausbau: Verteilerpruefung und bereinigte Versandlisten."
  },
  {
    id: "licenses",
    label: "Lizenzen",
    status: "planned",
    icon: BadgeCheck,
    description: "Kundenlizenzen mit Kosten, Laufzeit und Status.",
    detail: "Naechster Ausbau: aktive/inaktive Lizenzen und monatliche Kostenbasis."
  },
  {
    id: "tasks",
    label: "Aufgaben",
    status: "planned",
    icon: ClipboardList,
    description: "Aufgabenlisten nach Kunde, Status, Zeitraum und Abrechnung.",
    detail: "Naechster Ausbau: operative Listen fuer Abrechnung und Nachverfolgung."
  }
];

const matchesTriState = (filter, value) => {
  if (filter === "yes") return Boolean(value);
  if (filter === "no") return !value;
  return true;
};

const buildSearchText = (customer) =>
  [
    customer.name,
    customer.creditorNumber,
    customer.shortCode,
    customer.email,
    customer.newsletterEmail,
    customer.billingEmail,
    customer.city,
    customer.phones.map((phone) => `${phone.label} ${phone.number}`).join(" ")
  ]
    .join(" ")
    .toLowerCase();

const buildRows = (customers) =>
  customers.map((customer) => {
    const phoneText = customer.phones.map((phone) => [phone.label, phone.number].filter(Boolean).join(": ")).join(" | ");
    const contractText = customer.contractTypes.length
      ? customer.contractTypes
          .map((type) => {
            const count = Number(customer.contractTypeCounts[type] || 0);
            return count > 0 ? `${contractTypeLabel(type)} (${count})` : contractTypeLabel(type);
          })
          .join(", ")
      : "";
    return {
      "Kundennummer": customer.creditorNumber,
      "Name": customer.name,
      "Status": customer.status === "inactive" ? "Inaktiv" : "Aktiv",
      "Kurzcode": customer.shortCode,
      "Sevdesk Contact ID": customer.sevdeskContactId,
      "E-Mail": customer.email,
      "Newsletter E-Mail": customer.newsletterEmail,
      "Rechnungs-E-Mail": customer.billingEmail,
      "Newsletter": boolLabel(customer.newsletter),
      "Kundenbericht": boolLabel(customer.customerReport),
      "Zeiterfassung": boolLabel(customer.timeTracking),
      "Wartungsvertrag": boolLabel(customer.maintenanceContract),
      "Vertragstypen": contractText,
      "Telefon": phoneText,
      "Strasse": customer.street,
      "PLZ": customer.postalCode,
      "Ort": customer.city,
      "Land": customer.country
    };
  });

const buildXlsxBlob = (rows, sheetName = "Export") => {
  const fallbackRows = buildRows([normalizeCustomer({})]);
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : fallbackRows);
  const headers = rows.length ? Object.keys(rows[0]) : Object.keys(fallbackRows[0]);
  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.min(42, Math.max(12, header.length + 2))
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
};

export default function CustomerExportPanel() {
  const [activeExportId, setActiveExportId] = useState("customers");
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const loadCustomers = async () => {
    setStatus("loading");
    try {
      const response = await fetch(`${API}/customers`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.detail || "customers_load_failed");
      setCustomers(Array.isArray(data) ? data.map(normalizeCustomer) : []);
      setError("");
      setStatus("ready");
    } catch (loadError) {
      setError("Kundenliste konnte nicht geladen werden.");
      setStatus("error");
    }
  };

  useEffect(() => {
    if (activeExportId !== "customers") return;
    if (customers.length || status === "loading") return;
    loadCustomers();
  }, [activeExportId, customers.length, status]);

  const activeExport = exportDefinitions.find((item) => item.id === activeExportId) || exportDefinitions[0];
  const ActiveExportIcon = activeExport.icon;

  const filteredCustomers = useMemo(() => {
    const query = normalizeKey(filters.query);
    return customers.filter((customer) => {
      if (filters.status !== "all" && customer.status !== filters.status) return false;
      if (!matchesTriState(filters.newsletter, customer.newsletter)) return false;
      if (!matchesTriState(filters.customerReport, customer.customerReport)) return false;
      if (!matchesTriState(filters.timeTracking, customer.timeTracking)) return false;
      if (!matchesTriState(filters.email, customer.email || customer.newsletterEmail || customer.billingEmail)) return false;
      if (!matchesTriState(filters.phone, customer.phones.length > 0)) return false;
      if (filters.contract === "any" && customer.contractTypes.length === 0) return false;
      if (filters.contract === "none" && customer.contractTypes.length > 0) return false;
      if (!["all", "any", "none"].includes(filters.contract) && !customer.contractTypes.includes(filters.contract)) {
        return false;
      }
      if (query && !buildSearchText(customer).includes(query)) return false;
      return true;
    });
  }, [customers, filters]);

  const summary = useMemo(() => {
    const active = filteredCustomers.filter((customer) => customer.status === "active").length;
    const newsletter = filteredCustomers.filter((customer) => customer.newsletter).length;
    const contracts = filteredCustomers.filter((customer) => customer.contractTypes.length > 0).length;
    const missingEmail = filteredCustomers.filter(
      (customer) => !(customer.email || customer.newsletterEmail || customer.billingEmail)
    ).length;
    return { active, newsletter, contracts, missingEmail };
  }, [filteredCustomers]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const exportCustomers = () => {
    const rows = buildRows(filteredCustomers);
    const blob = buildXlsxBlob(rows, "Kundenstamm");
    const today = new Date().toISOString().slice(0, 10);
    const suffixParts = [
      filters.status !== "all" ? filters.status : "",
      filters.contract !== "all" ? filters.contract : "",
      filters.newsletter !== "all" ? `newsletter-${filters.newsletter}` : ""
    ].filter(Boolean);
    const filename = `kundenliste-${today}${suffixParts.length ? `-${slug(suffixParts.join("-"))}` : ""}.xlsx`;
    downloadBlob(blob, filename);
  };

  const filterSelect = (label, key, options) => (
    <label className="grid gap-1 text-xs text-sand-600">
      <span className="uppercase tracking-[0.2em]">{label}</span>
      <select
        value={filters[key]}
        onChange={(event) => updateFilter(key, event.target.value)}
        className="rounded-lg border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 outline-none focus:border-sand-900"
      >
        {options.map((option) => (
          <option key={`${key}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="rounded-lg border border-sand-200 bg-white p-4 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Exportarten</p>
          <div className="mt-4 space-y-2">
            {exportDefinitions.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeExportId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveExportId(item.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    active
                      ? "border-sand-900 bg-sand-900 text-white"
                      : "border-sand-200 bg-white text-sand-800 hover:bg-sand-50"
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        active ? "border-white/25 bg-white/10" : "border-sand-200 bg-sand-50"
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{item.label}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            active
                              ? "border-white/25 text-white/80"
                              : item.status === "ready"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-sand-200 bg-sand-50 text-sand-500"
                          }`}
                        >
                          {item.status === "ready" ? "Aktiv" : "Vorbereitet"}
                        </span>
                      </span>
                      <span className={`mt-1 block text-xs ${active ? "text-white/75" : "text-sand-600"}`}>
                        {item.description}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-sand-200 bg-white p-4 text-sm text-sand-700 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Format</p>
          <p className="mt-2">
            Aktuell wird als echtes .xlsx exportiert. Neue Listen koennen dieselbe Vorschau- und
            Filterstruktur verwenden.
          </p>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {activeExport.status !== "ready" ? (
          <div className="rounded-lg border border-sand-200 bg-white p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sand-900 text-white">
                <ActiveExportIcon size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Vorbereitet</p>
                <h2 className="mt-1 text-xl font-display text-sand-900">{activeExport.label}</h2>
                <p className="mt-2 max-w-3xl text-sm text-sand-700">{activeExport.detail}</p>
                <p className="mt-4 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-600">
                  Dieser Exporttyp ist in der Navigation vorgesehen. Die Datenquelle und Filter koennen als naechstes
                  angebunden werden.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {activeExportId === "customers" ? (
          <>
      <div className="rounded-lg border border-sand-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Aktiver Export</p>
            <h2 className="mt-1 text-xl font-display text-sand-900">Kundenstamm</h2>
            <p className="mt-2 max-w-3xl text-sm text-sand-700">
              Excel-Export der Kunden mit Kontakt-, Newsletter-, Status- und Vertragsfeldern.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadCustomers}
              className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              <RefreshCw size={14} />
              Aktualisieren
            </button>
            <button
              type="button"
              onClick={exportCustomers}
              disabled={!filteredCustomers.length || status === "loading"}
              className="inline-flex items-center gap-2 rounded-lg border border-sand-900 bg-sand-900 px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={14} />
              Excel exportieren
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-sand-200 bg-sand-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Treffer</p>
            <p className="mt-1 text-xl font-semibold text-sand-900">{filteredCustomers.length}</p>
          </div>
          <div className="rounded-lg border border-sand-200 bg-sand-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Aktiv</p>
            <p className="mt-1 text-xl font-semibold text-sand-900">{summary.active}</p>
          </div>
          <div className="rounded-lg border border-sand-200 bg-sand-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Newsletter</p>
            <p className="mt-1 text-xl font-semibold text-sand-900">{summary.newsletter}</p>
          </div>
          <div className="rounded-lg border border-sand-200 bg-sand-50 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Mit Vertrag</p>
            <p className="mt-1 text-xl font-semibold text-sand-900">{summary.contracts}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs text-sand-600 md:col-span-2">
            <span className="uppercase tracking-[0.2em]">Suche</span>
            <span className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-500" />
              <input
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                placeholder="Name, Nummer, Ort, E-Mail, Telefon"
                className="w-full rounded-lg border border-sand-200 bg-white py-2 pl-9 pr-3 text-sm text-sand-900 outline-none focus:border-sand-900"
              />
            </span>
          </label>
          {filterSelect("Status", "status", filterOptions.status)}
          {filterSelect("Newsletter", "newsletter", filterOptions.triState)}
          {filterSelect("Vertraege", "contract", filterOptions.contract)}
          {filterSelect("Kundenbericht", "customerReport", filterOptions.triState)}
          {filterSelect("Zeiterfassung", "timeTracking", filterOptions.triState)}
          {filterSelect("E-Mail", "email", filterOptions.contact)}
          {filterSelect("Telefon", "phone", filterOptions.contact)}
        </div>

        {status === "loading" ? (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-sand-600">
            <Loader2 size={15} className="animate-spin" />
            Lade Kunden...
          </p>
        ) : null}
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-sand-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-sand-900">
            <FileSpreadsheet size={16} />
            Vorschau
          </div>
          <span className="text-xs text-sand-500">
            Fehlende E-Mail: {summary.missingEmail}
          </span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 bg-sand-100 text-xs uppercase tracking-wide text-sand-600">
              <tr>
                <th className="px-3 py-2">Kunde</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Newsletter</th>
                <th className="px-3 py-2">Kontakt</th>
                <th className="px-3 py-2">Vertraege</th>
                <th className="px-3 py-2">Ort</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.slice(0, 120).map((customer) => (
                <tr key={customer.id || customer.name} className="border-t border-sand-100">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-sand-900">{customer.name || "Unbenannter Kunde"}</p>
                    <p className="text-xs text-sand-500">{customer.creditorNumber || "Keine Kundennummer"}</p>
                  </td>
                  <td className="px-3 py-2">{customer.status === "inactive" ? "Inaktiv" : "Aktiv"}</td>
                  <td className="px-3 py-2">{boolLabel(customer.newsletter)}</td>
                  <td className="px-3 py-2">
                    <p>{customer.email || customer.newsletterEmail || customer.billingEmail || "Keine E-Mail"}</p>
                    <p className="text-xs text-sand-500">
                      {customer.phones[0]?.number || "Keine Telefonnummer"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {customer.contractTypes.length
                      ? customer.contractTypes.map(contractTypeLabel).join(", ")
                      : "Keine"}
                  </td>
                  <td className="px-3 py-2">{[customer.postalCode, customer.city].filter(Boolean).join(" ") || "-"}</td>
                </tr>
              ))}
              {!filteredCustomers.length && status !== "loading" ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sand-500">
                    Keine Kunden fuer diese Filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filteredCustomers.length > 120 ? (
          <p className="border-t border-sand-200 px-4 py-3 text-xs text-sand-500">
            Vorschau zeigt die ersten 120 Treffer. Der Export enthaelt alle {filteredCustomers.length} Treffer.
          </p>
        ) : null}
      </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
