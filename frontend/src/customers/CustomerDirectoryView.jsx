import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  BarChart3,
  BadgeCheck,
  Boxes,
  Building2,
  BookPlus,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileDown,
  FileText,
  Mail,
  Pencil,
  Phone,
  PhoneOutgoing,
  Plus,
  Search,
  WalletCards,
  Trash2,
  Users,
  X
} from "lucide-react";
import CustomerInventoryTab from "./CustomerInventoryTab";
import { renderReportHTML, uid } from "../reporting/utils";
import { telephonyService } from "../telephony/telephonyService";
import { sanitizeHtml } from "../utils/sanitizeHtml";

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
  getCustomerMetrics: (customerId, kpiMonthOffset = 0) =>
    fetch(
      `${API}/customers/${customerId}/metrics?kpi_month_offset=${encodeURIComponent(String(kpiMonthOffset || 0))}`
    ).then(async (r) => {
      if (!r.ok) throw new Error("metrics_failed");
      return r.json();
    }),
  getMetricsSettings: () => fetch(`${API}/customer_metrics_settings`).then((r) => r.json()),
  saveMetricsSettings: (payload) =>
    fetch(`${API}/customer_metrics_settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  getAiPrompts: () =>
    fetch(`${API}/ai_prompts`).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "ai_prompts_load_failed");
      return data;
    }),
  listContractTariffs: (activeOnly = true) =>
    fetch(`${API}/contract_tariffs?active_only=${activeOnly ? "1" : "0"}`).then((r) => r.json()),
  createContractTariff: (payload) =>
    fetch(`${API}/contract_tariffs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "tariff_create_failed");
      return data;
    }),
  deactivateContractTariff: (tariffId) =>
    fetch(`${API}/contract_tariffs/${tariffId}/deactivate`, {
      method: "POST"
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "tariff_deactivate_failed");
      return data;
    }),
  listCustomerContracts: (customerId, status = "") =>
    fetch(
      `${API}/customers/${customerId}/contracts${
        String(status || "").trim() ? `?status=${encodeURIComponent(String(status || "").trim())}` : ""
      }`
    ).then((r) => r.json()),
  listCustomerLicenses: (customerId) =>
    fetch(`${API}/customers/${customerId}/licenses`).then(async (r) => {
      const data = await r.json().catch(() => []);
      if (!r.ok) throw new Error(data?.detail || "customer_licenses_load_failed");
      return data;
    }),
  createCustomerLicense: (customerId, payload) =>
    fetch(`${API}/customers/${customerId}/licenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "customer_license_create_failed");
      return data;
    }),
  updateCustomerLicense: (customerId, licenseId, payload) =>
    fetch(`${API}/customers/${customerId}/licenses/${licenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "customer_license_update_failed");
      return data;
    }),
  deleteCustomerLicense: (customerId, licenseId) =>
    fetch(`${API}/customers/${customerId}/licenses/${licenseId}`, {
      method: "DELETE"
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "customer_license_delete_failed");
      return data;
    }),
  getCustomerPrepaidHours: (customerId) =>
    fetch(`${API}/customers/${customerId}/prepaid_hours`).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "prepaid_hours_load_failed");
      return data;
    }),
  createCustomerPrepaidHoursEntry: (customerId, payload) =>
    fetch(`${API}/customers/${customerId}/prepaid_hours/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "prepaid_hours_create_failed");
      return data;
    }),
  deleteCustomerPrepaidHoursEntry: (customerId, entryId) =>
    fetch(`${API}/customers/${customerId}/prepaid_hours/entries/${entryId}`, {
      method: "DELETE"
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "prepaid_hours_delete_failed");
      return data;
    }),
  listCustomerDevelopment: (includeInactive = true, refresh = false) =>
    fetch(
      `${API}/customer_development?include_inactive=${includeInactive ? "1" : "0"}&refresh=${refresh ? "1" : "0"}`
    ).then((r) => r.json()),
  getCustomerDevelopment: (customerId, refresh = false) =>
    fetch(`${API}/customers/${customerId}/development?refresh=${refresh ? "1" : "0"}`).then((r) => r.json()),
  previewCustomerContract: (customerId, payload) =>
    fetch(`${API}/customers/${customerId}/contracts/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_preview_failed");
      return data;
    }),
  createCustomerContract: (customerId, payload) =>
    fetch(`${API}/customers/${customerId}/contracts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_create_failed");
      return data;
    }),
  updateCustomerContract: (customerId, contractId, payload) =>
    fetch(`${API}/customers/${customerId}/contracts/${contractId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_update_failed");
      return data;
    }),
  cancelCustomerContract: (
    customerId,
    contractId,
    payload = { reason: "", stop_service_immediately: false, effective_at: 0 }
  ) =>
    fetch(`${API}/customers/${customerId}/contracts/${contractId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_cancel_failed");
      return data;
    }),
  buildPdf: (html, filename = "dokument.pdf") =>
    fetch(`${API}/reports/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename })
    }).then(async (r) => {
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data?.detail || "pdf_build_failed");
      }
      return r.blob();
    }),
  reactivateCustomerContract: (customerId, contractId) =>
    fetch(`${API}/customers/${customerId}/contracts/${contractId}/reactivate`, {
      method: "POST"
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_reactivate_failed");
      return data;
    }),
  markCustomerContractProposal: (customerId, contractId) =>
    fetch(`${API}/customers/${customerId}/contracts/${contractId}/mark_proposal`, {
      method: "POST"
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_mark_proposal_failed");
      return data;
    }),
  deleteCustomerContract: (customerId, contractId) =>
    fetch(`${API}/customers/${customerId}/contracts/${contractId}`, {
      method: "DELETE"
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_delete_failed");
      return data;
    }),
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
    if (key === "regiekunde" || key === "nachaufwand" || key === "timeandmaterial" || key === "payg") key = "regie";
    if (key !== "monitoring" && key !== "wartung" && key !== "regie") return;
    if (seen.has(key)) return;
    seen.add(key);
    values.push(key);
  });
  if (seen.has("regie") && seen.has("wartung")) {
    return values.filter((entry) => entry !== "regie");
  }
  return values;
};

const normalizeContractDocumentType = (value) => {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!key) return "";
  if (["wartung", "wartungsvertrag", "maintenance", "servicelevelagreement", "sla"].includes(key)) {
    return "wartung";
  }
  if (["monitoring", "monitoringvertrag", "rmm"].includes(key)) {
    return "monitoring";
  }
  if (["avv", "dsgvo", "avv_dsgvo", "auftragsverarbeitungsvertrag"].includes(key)) {
    return "avv_dsgvo";
  }
  return key.replace(/[^a-z0-9_]+/g, "").replace(/^_+|_+$/g, "");
};

const normalizeContractVariableKey = (rawKey) =>
  String(rawKey || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

const RESERVED_CONTRACT_PLACEHOLDERS = new Set([
  "provider_name",
  "provider_address",
  "provider_email",
  "provider_contact_line",
  "customer_name",
  "customer_number",
  "customer_short_code",
  "customer_email",
  "customer_street",
  "customer_postal_code",
  "customer_city",
  "customer_country",
  "customer_address",
  "generated_at",
  "valid_from",
  "contract_start",
  "runtime_months",
  "minimum_term_months",
  "extension_period",
  "auto_extension_months",
  "termination_notice_months",
  "termination_notice",
  "servers",
  "clients",
  "network_devices",
  "iot_devices",
  "monthly_total",
  "yearly_total",
  "monthly_hours_included",
  "service_scope",
]);

const parseBooleanFlag = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "ja", "on"].includes(raw)) return true;
  if (["0", "false", "no", "nein", "off"].includes(raw)) return false;
  return fallback;
};

const normalizeContractVariableDefinitions = (definitionsInput, variablesInput) => {
  const merged = {};
  if (variablesInput && typeof variablesInput === "object" && !Array.isArray(variablesInput)) {
    Object.entries(variablesInput).forEach(([rawKey, rawValue]) => {
      const key = normalizeContractVariableKey(rawKey);
      if (!key || RESERVED_CONTRACT_PLACEHOLDERS.has(key)) return;
      merged[key] = {
        value: String(rawValue || ""),
        label: key,
        customerEditable: false
      };
    });
  }
  if (definitionsInput && typeof definitionsInput === "object" && !Array.isArray(definitionsInput)) {
    Object.entries(definitionsInput).forEach(([rawKey, rawValue]) => {
      const key = normalizeContractVariableKey(rawKey);
      if (!key || RESERVED_CONTRACT_PLACEHOLDERS.has(key)) return;
      const existing = merged[key] || { value: "", label: key, customerEditable: false };
      if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
        const value = rawValue.value ?? rawValue.default ?? rawValue.suggested_value ?? existing.value;
        merged[key] = {
          value: String(value || ""),
          label: String(rawValue.label || existing.label || key).trim() || key,
          customerEditable: parseBooleanFlag(
            rawValue.customer_editable ?? rawValue.customerEditable,
            false
          )
        };
        return;
      }
      merged[key] = {
        ...existing,
        value: String(rawValue || "")
      };
    });
  }
  return Object.fromEntries(
    Object.entries(merged).sort(([a], [b]) => String(a || "").localeCompare(String(b || ""), "de"))
  );
};

const defaultContractTemplates = {
  wartung: {
    title: "IT-Service- und Wartungsvertrag",
    description: "Servicevertrag fuer laufende Betreuung, Wartung und definierte Inklusivstunden.",
    doc_type: "wartung",
    body_template: ""
  },
  monitoring: {
    title: "IT-Monitoringvertrag",
    description: "Template fuer Ueberwachung, Alarmierung und regelmaessige Betriebsinformationen.",
    doc_type: "monitoring",
    body_template: ""
  },
  avv_dsgvo: {
    title: "Vereinbarung zur Auftragsverarbeitung (Art. 28 DSGVO)",
    description: "Rechtliches Datenschutz-Template zur Auftragsverarbeitung.",
    doc_type: "avv_dsgvo",
    body_template: ""
  }
};

const normalizeContractTemplates = (input) => {
  const merged = { ...defaultContractTemplates };
  if (input && typeof input === "object" && !Array.isArray(input)) {
    Object.entries(input).forEach(([rawKey, rawValue]) => {
      const key = normalizeContractDocumentType(rawKey);
      if (!key) return;
      const entry = rawValue && typeof rawValue === "object" ? rawValue : {};
      merged[key] = {
        title: String(entry.title || merged[key]?.title || key).trim() || key,
        description: String(entry.description || merged[key]?.description || "").trim(),
        doc_type: String(entry.doc_type || merged[key]?.doc_type || "").trim(),
        body_template: String(entry.body_template || ""),
        header_html: String(entry.header_html || ""),
        footer_html: String(entry.footer_html || "")
      };
    });
  }
  return merged;
};

const extractContractTemplateVariables = (...fragments) => {
  const found = new Set();
  fragments.forEach((fragment) => {
    const text = String(fragment || "");
    const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
    matches.forEach((match) => {
      const key = normalizeContractVariableKey(match.slice(1, -1));
      if (!key || RESERVED_CONTRACT_PLACEHOLDERS.has(key)) return;
      found.add(key);
    });
  });
  return Array.from(found).sort((a, b) => String(a || "").localeCompare(String(b || ""), "de"));
};

const buildEditableContractVariableValues = (definitions, sourceValues = {}) => {
  const normalizedSource = {};
  if (sourceValues && typeof sourceValues === "object" && !Array.isArray(sourceValues)) {
    Object.entries(sourceValues).forEach(([rawKey, rawValue]) => {
      const key = normalizeContractVariableKey(rawKey);
      if (!key || RESERVED_CONTRACT_PLACEHOLDERS.has(key)) return;
      normalizedSource[key] = String(rawValue || "");
    });
  }
  const next = {};
  Object.entries(definitions || {}).forEach(([key, entry]) => {
    if (!entry?.customerEditable) return;
    next[key] = String(normalizedSource[key] ?? entry.value ?? "");
  });
  return next;
};

const normalizeContractDocumentFlags = (flags) => {
  if (!Array.isArray(flags)) return [];
  const seen = new Set();
  flags.forEach((entry) => {
    const key = normalizeContractDocumentType(entry);
    if (key === "wartung" || key === "monitoring") seen.add(key);
  });
  return ["wartung", "monitoring"].filter((entry) => seen.has(entry));
};

const normalizeContractTypeCounts = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const counts = {};
  Object.entries(input).forEach(([rawType, rawCount]) => {
    const type = normalizeContractDocumentType(rawType);
    const count = Number.parseInt(String(rawCount || "0"), 10);
    if (!type || !Number.isFinite(count) || count <= 0) return;
    counts[type] = (counts[type] || 0) + count;
  });
  return counts;
};

const deriveContractTypeCountsFromContracts = (contracts) => {
  if (!Array.isArray(contracts)) return {};
  const counts = {};
  contracts.forEach((contract) => {
    const type = normalizeContractDocumentType(
      contract?.doc_type ?? contract?.docType ?? contract?.template_key ?? contract?.templateKey
    );
    if (!type) return;
    counts[type] = (counts[type] || 0) + 1;
  });
  return counts;
};

const CONTRACT_TYPE_BADGE_ORDER = ["wartung", "monitoring", "avv_dsgvo"];

const sortContractTypeCountEntries = (counts) => {
  const orderIndex = new Map(CONTRACT_TYPE_BADGE_ORDER.map((key, index) => [key, index]));
  return Object.entries(counts || {}).sort(([typeA], [typeB]) => {
    const rankA = orderIndex.has(typeA) ? orderIndex.get(typeA) : Number.MAX_SAFE_INTEGER;
    const rankB = orderIndex.has(typeB) ? orderIndex.get(typeB) : Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return typeA.localeCompare(typeB, "de");
  });
};

const formatContractTypeLabel = (type) => {
  if (type === "wartung") return "Wartung";
  if (type === "monitoring") return "Monitoring";
  if (type === "avv_dsgvo") return "AVV/DSGVO";
  return String(type || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const contractTypeBadgeClass = (type) => {
  if (type === "wartung") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "monitoring") return "border-sky-200 bg-sky-50 text-sky-700";
  if (type === "avv_dsgvo") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-sand-200 bg-sand-100 text-sand-700";
};

const normalizeCustomer = (customer) => {
  const contractFlags = normalizeContractFlags(
    Array.isArray(customer.contract_flags)
      ? customer.contract_flags
      : Array.isArray(customer.contractFlags)
      ? customer.contractFlags
      : []
  );
  const contractTypeCounts = normalizeContractTypeCounts(
    customer.contract_type_counts ?? customer.contractTypeCounts ?? {}
  );
  const contractDocumentFlags = normalizeContractDocumentFlags(
    Array.isArray(customer.contract_document_flags)
      ? customer.contract_document_flags
      : Array.isArray(customer.contractDocumentFlags)
      ? customer.contractDocumentFlags
      : []
  );
  const primaryEmail = customer.primary_email ?? customer.primaryEmail ?? customer.email ?? "";
  const newsletterEmail =
    customer.newsletter_email ?? customer.newsletterEmail ?? customer.general_email ?? customer.generalEmail ?? "";
  const billingEmail = customer.billing_email ?? customer.billingEmail ?? "";
  const generalStreet = customer.general_street ?? customer.generalStreet ?? "";
  const generalPostalCode = customer.general_postal_code ?? customer.generalPostalCode ?? "";
  const generalCity = customer.general_city ?? customer.generalCity ?? "";
  const generalCountry = customer.general_country ?? customer.generalCountry ?? "";
  const billingStreet = customer.billing_street ?? customer.billingStreet ?? "";
  const billingPostalCode = customer.billing_postal_code ?? customer.billingPostalCode ?? "";
  const billingCity = customer.billing_city ?? customer.billingCity ?? "";
  const billingCountry = customer.billing_country ?? customer.billingCountry ?? "";
  return {
    ...customer,
    creditorNumber:
      customer.creditor_number ?? customer.creditorNumber ?? customer.internal_number ?? "",
    sevdeskContactId: customer.sevdesk_contact_id ?? customer.sevdeskContactId ?? "",
    shortCode: customer.short_code ?? customer.shortCode ?? "",
    email: primaryEmail,
    newsletterEmail,
    billingEmail,
    street: customer.street ?? billingStreet ?? generalStreet ?? "",
    postalCode: customer.postal_code ?? billingPostalCode ?? generalPostalCode ?? "",
    city: customer.city ?? billingCity ?? generalCity ?? "",
    country: customer.country ?? billingCountry ?? generalCountry ?? "",
    generalStreet,
    generalPostalCode,
    generalCity,
    generalCountry,
    billingStreet,
    billingPostalCode,
    billingCity,
    billingCountry,
    primaryAddressSource:
      customer.primary_address_source ?? customer.primaryAddressSource ?? "general",
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
      contractFlags.includes("wartung") ||
      contractDocumentFlags.includes("wartung"),
    contractFlags,
    contractDocumentFlags,
    contractTypeCounts
  };
};

const customerPayload = (customer) => ({
  name: customer.name || "Neuer Kunde",
  creditor_number: customer.creditorNumber || "",
  sevdesk_contact_id: customer.sevdeskContactId || "",
  short_code: customer.shortCode || "",
  email: customer.email || "",
  newsletter_email: customer.newsletterEmail || "",
  street: customer.generalStreet || "",
  postal_code: customer.generalPostalCode || "",
  city: customer.generalCity || "",
  country: customer.generalCountry || "",
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

const buildCustomerAddressLines = ({ street, postalCode, city, country }) => {
  const line2 = [postalCode, city].filter((value) => String(value || "").trim()).join(" ").trim();
  return [street, line2, country].filter((value) => String(value || "").trim());
};

const hasCustomerAddress = ({ street, postalCode, city, country }) =>
  Boolean(buildCustomerAddressLines({ street, postalCode, city, country }).length);

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

const formatNumber = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("de-DE");
};

const formatEurPrecise = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "€ 0,00";
  return number.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const parseHoursInput = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const parseOptionalMoneyInput = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const formatMoneyInputValue = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return "";
  return number.toFixed(2);
};

const formatHours = (value, fractionDigits = 2) => {
  const hours = Number(value || 0);
  if (!Number.isFinite(hours)) return "0,00 h";
  return `${hours.toLocaleString("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })} h`;
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const normalizeDigitsOnly = (value) => String(value || "").replace(/\D/g, "");

const toTextValue = (value) => {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => toTextValue(entry))
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    const preferred = [value.email, value.address, value.name, value.value, value.label]
      .map((entry) => toTextValue(entry))
      .find(Boolean);
    return preferred || "";
  }
  return "";
};

const toTimestampMs = (value) => {
  if (value === null || typeof value === "undefined") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 10_000_000_000) return Math.round(value);
    if (value > 1_000_000_000) return Math.round(value * 1000);
    return 0;
  }
  const raw = String(value || "").trim();
  if (!raw) return 0;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return 0;
    if (parsed > 10_000_000_000) return Math.round(parsed);
    if (parsed > 1_000_000_000) return Math.round(parsed * 1000);
    return 0;
  }
  const parsedDate = Date.parse(raw);
  return Number.isFinite(parsedDate) && parsedDate > 0 ? parsedDate : 0;
};

const firstTimestampMs = (...values) => {
  for (const value of values) {
    const parsed = toTimestampMs(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

const formatDateTime = (value) => {
  const timestamp = toTimestampMs(value);
  if (!timestamp) return "n/a";
  const date = new Date(timestamp);
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};
const formatDate = (value) => {
  const timestamp = toTimestampMs(value);
  if (!timestamp) return "n/a";
  return new Date(timestamp).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};
const todayInputValue = () => {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return localTime.toISOString().slice(0, 10);
};

const blobToBase64 = async (blob) => {
  const buffer = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
};

const downloadBlob = (blob, filename) => {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
};

const getQtLogoDataUrl = async () => {
  const response = await fetch("/QTLogo.jpg");
  if (!response.ok) return "";
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  return `data:${blob.type || "image/jpeg"};base64,${base64}`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildPrepaidHoursPdfFilename = (customer) => {
  const base = String(customer?.name || "kunde")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "kunde"}_stundenkontingent.pdf`;
};

const contractTypeLabel = (value) => {
  const type = normalizeContractDocumentType(value) || "wartung";
  if (type === "monitoring") return "Monitoringvertrag";
  if (type === "avv_dsgvo") return "AVV / DSGVO";
  return "Wartungsvertrag";
};
const resolveContractBaseType = (templateKey, templateEntry, fallback = "wartung") => {
  const explicitType = normalizeContractDocumentType(templateEntry?.doc_type || "");
  if (["wartung", "monitoring", "avv_dsgvo"].includes(explicitType)) return explicitType;
  const directType = normalizeContractDocumentType(templateKey);
  if (["wartung", "monitoring", "avv_dsgvo"].includes(directType)) return directType;
  const raw = String(templateKey || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (raw.startsWith("wartung_")) return "wartung";
  if (raw.startsWith("monitoring_")) return "monitoring";
  if (raw.startsWith("avv_dsgvo_") || raw.startsWith("avv_") || raw.startsWith("dsgvo_")) return "avv_dsgvo";
  return fallback;
};
const buildDefaultContractTitle = (templateTitle, customerLabel, docType = "wartung") => {
  const base = String(templateTitle || "").trim() || contractTypeLabel(docType);
  const name = String(customerLabel || "").trim();
  return name ? `${base} ${name}` : base;
};
const daysUntilTimestamp = (timestampMs) => {
  const target = Number(timestampMs || 0);
  if (!Number.isFinite(target) || target <= 0) return null;
  const diffMs = target - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
};

const addMonthsToTimestamp = (timestampMs, months) => {
  const base = new Date(Number(timestampMs || 0));
  if (!Number.isFinite(base.getTime()) || base.getTime() <= 0) return 0;
  const totalMonths = base.getMonth() + Number(months || 0);
  const year = base.getFullYear() + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = base.getDate();
  const maxDay = new Date(year, month + 1, 0).getDate();
  const shifted = new Date(base);
  shifted.setFullYear(year, month, Math.min(day, maxDay));
  return shifted.getTime();
};

const contractTimelineFromItem = (item) => {
  const timeline = item?.timeline && typeof item.timeline === "object" ? item.timeline : {};
  if (Number(timeline?.next_renewal_at || 0) > 0) {
    return {
      nextRenewalAt: Number(timeline.next_renewal_at || 0),
      cancellationDeadlineAt: Number(timeline.cancellation_deadline_at || 0),
      termEndAt: Number(timeline.term_end_at || 0),
      cancelledEffectiveAt: Number(item?.cancelled_effective_at || timeline.cancelled_effective_at || 0),
      remainingAfterCancelDays: Number(timeline.remaining_days_after_cancel),
      stopServiceImmediately: Boolean(item?.stop_service_immediately ?? timeline.stop_service_immediately),
    };
  }
  const createdAt = Number(item?.created_at || 0);
  if (!createdAt) {
    return {
      nextRenewalAt: 0,
      cancellationDeadlineAt: 0,
      termEndAt: 0,
      cancelledEffectiveAt: Number(item?.cancelled_effective_at || 0),
      remainingAfterCancelDays: null,
      stopServiceImmediately: Boolean(item?.stop_service_immediately),
    };
  }
  const runtimeMonths = Math.max(1, Number(item?.runtime_months || 12) || 12);
  const noticeMonths = Math.max(0, Number(item?.termination_notice_months || 3) || 3);
  const extensionMonths = Math.max(1, Number(item?.auto_extension_months || 12) || 12);
  const termEndAt = addMonthsToTimestamp(createdAt, runtimeMonths);
  const cancellationDeadlineAt = noticeMonths > 0 ? addMonthsToTimestamp(termEndAt, -noticeMonths) : termEndAt;
  const nextRenewalAt = Date.now() <= cancellationDeadlineAt ? termEndAt : addMonthsToTimestamp(termEndAt, extensionMonths);
  return {
    nextRenewalAt,
    cancellationDeadlineAt,
    termEndAt,
    cancelledEffectiveAt: Number(item?.cancelled_effective_at || 0),
    remainingAfterCancelDays: null,
    stopServiceImmediately: Boolean(item?.stop_service_immediately),
  };
};

const formatCallDuration = (value) => {
  const seconds = Number.parseInt(String(value || "0"), 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const buildPrepaidHoursPdfHtml = ({ customer, prepaidHoursSummary, logoSrc = "", generatedAt = Date.now() }) => {
  const summary =
    prepaidHoursSummary && typeof prepaidHoursSummary === "object" && !Array.isArray(prepaidHoursSummary)
      ? prepaidHoursSummary
      : null;
  const entries = Array.isArray(summary?.entries) ? summary.entries : [];
  const addressParts = [
    String(customer?.street || "").trim(),
    [String(customer?.postalCode || "").trim(), String(customer?.city || "").trim()].filter(Boolean).join(" "),
    String(customer?.country || "").trim()
  ].filter(Boolean);
  const rows = entries.length
    ? entries
        .map((entry) => {
          const isDebit = String(entry?.entry_type || "").toLowerCase() === "debit";
          const label = String(entry?.label || "").trim() || "Buchung";
          const detailParts = [];
          if (entry?.task_title) detailParts.push(`Aufgabe: ${String(entry.task_title).trim()}`);
          if (entry?.note) detailParts.push(String(entry.note).trim());
          return `
            <tr>
              <td>${escapeHtml(formatDateTime(entry?.effective_at || entry?.created_at))}</td>
              <td>${escapeHtml(isDebit ? "Abbuchung" : "Kauf")}</td>
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(detailParts.join(" · ") || "-")}</td>
              <td style="text-align:right; color:${isDebit ? "#a63d40" : "#256f52"}; font-weight:700;">
                ${escapeHtml(`${isDebit ? "-" : "+"}${formatHours(entry?.hours || 0)}`)}
              </td>
            </tr>
          `;
        })
        .join("")
    : `
        <tr>
          <td colspan="5" style="text-align:center; color:#6b7280; padding:18px 12px;">
            Noch keine Buchungen vorhanden.
          </td>
        </tr>
      `;
  return `
    <style>
      @page {
        size: A4;
        margin: 12mm 11mm;
      }
      body {
        font-family: "Aptos", "Segoe UI", sans-serif;
        color: #1f2937;
      }
      .sheet {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .hero {
        align-items: flex-start;
        background: linear-gradient(135deg, #17324d 0%, #285b78 62%, #d8e8ef 100%);
        border-radius: 16px;
        color: #f8fafc;
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 15px 18px;
      }
      .hero h1 {
        font-size: 22px;
        line-height: 1.12;
        margin: 5px 0 0;
      }
      .eyebrow {
        font-size: 10px;
        letter-spacing: 0.24em;
        margin: 0;
        opacity: 0.8;
        text-transform: uppercase;
      }
      .hero-copy {
        flex: 1 1 auto;
      }
      .hero-meta {
        display: grid;
        gap: 4px;
        margin-top: 10px;
      }
      .hero-meta-line {
        font-size: 11px;
        line-height: 1.35;
        opacity: 0.92;
      }
      .hero-logo {
        background: rgba(255, 255, 255, 0.96);
        border-radius: 12px;
        padding: 10px 12px;
      }
      .hero-logo img {
        display: block;
        height: 34px;
        width: auto;
      }
      .section {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 14px;
      }
      .section-title {
        color: #64748b;
        font-size: 10px;
        letter-spacing: 0.2em;
        margin: 0 0 10px;
        text-transform: uppercase;
      }
      .grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .metric {
        background: #f8fafc;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 11px 12px;
      }
      .metric-label {
        color: #64748b;
        font-size: 10px;
        letter-spacing: 0.16em;
        margin: 0 0 6px;
        text-transform: uppercase;
      }
      .metric-value {
        color: #111827;
        font-size: 18px;
        font-weight: 700;
        margin: 0;
      }
      .muted {
        color: #6b7280;
        font-size: 11px;
        line-height: 1.5;
        margin: 4px 0 0;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th,
      td {
        border-bottom: 1px solid #e5e7eb;
        font-size: 11px;
        padding: 8px 6px;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: #64748b;
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .footer {
        color: #94a3b8;
        font-size: 10px;
        text-align: right;
      }
    </style>
    <div class="sheet">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Quansatech · Stundenkontingent</p>
          <h1>${escapeHtml(String(customer?.name || "Unbenannter Kunde").trim() || "Unbenannter Kunde")}</h1>
          <div class="hero-meta">
            <div class="hero-meta-line">Kundennummer ${escapeHtml(String(customer?.creditorNumber || "ohne").trim() || "ohne")}</div>
            ${
              addressParts.length
                ? `<div class="hero-meta-line">${escapeHtml(addressParts.join(", "))}</div>`
                : ""
            }
            <div class="hero-meta-line">Stand ${escapeHtml(formatDateTime(generatedAt))}</div>
          </div>
        </div>
        ${
          logoSrc
            ? `<div class="hero-logo"><img src="${escapeHtml(logoSrc)}" alt="Quansatech" /></div>`
            : ""
        }
      </section>

      <section class="section">
        <p class="section-title">Saldo</p>
        <div class="grid">
          <div class="metric">
            <p class="metric-label">Gekauft</p>
            <p class="metric-value">${escapeHtml(formatHours(summary?.purchasedHours || 0))}</p>
          </div>
          <div class="metric">
            <p class="metric-label">Abgebucht</p>
            <p class="metric-value">${escapeHtml(formatHours(summary?.debitedHours || 0))}</p>
          </div>
          <div class="metric">
            <p class="metric-label">Rest</p>
            <p class="metric-value">${escapeHtml(formatHours(summary?.balanceHours || 0))}</p>
            <p class="muted">${escapeHtml(`${entries.length} Buchungen in der Historie`)}</p>
          </div>
        </div>
      </section>

      <section class="section">
        <p class="section-title">Historie</p>
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Typ</th>
              <th>Bezeichnung</th>
              <th>Bemerkung / Bezug</th>
              <th style="text-align:right;">Stunden</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>

      <p class="footer">QT Workbench · Stundenkontingent-Export ${escapeHtml(formatDateTime(generatedAt))}</p>
    </div>
  `;
};

const normalizeEmailDirection = (entry) => {
  const candidates = [
    entry?.direction,
    entry?.emailDirection,
    entry?.mailDirection,
    entry?.kind,
    entry?.type,
    entry?.folder,
    entry?.mailbox
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  for (const value of candidates) {
    if (/^(out|outbound|sent|gesendet)/.test(value)) return "outgoing";
    if (/^(in|inbound|received|eingang|inbox)/.test(value)) return "incoming";
  }
  return "";
};

const extractMetaHubEmailsFromContext = (context) => {
  if (!context || typeof context !== "object") return [];
  const sources = [
    context?.emails,
    context?.emailEvents,
    context?.email_events,
    context?.emailMessages,
    context?.email_messages,
    context?.communication?.emails,
    context?.communications?.emails,
    context?.metaHub?.emails,
    context?.meta_hub?.emails,
    context?.metaHubEmail?.emails,
    context?.meta_hub_email?.emails
  ];
  const dedupe = new Set();
  const out = [];
  sources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const subject =
        toTextValue(entry?.subject) ||
        toTextValue(entry?.title) ||
        toTextValue(entry?.betreff) ||
        "(ohne Betreff)";
      const from =
        toTextValue(entry?.from) ||
        toTextValue(entry?.fromEmail) ||
        toTextValue(entry?.from_email) ||
        toTextValue(entry?.sender) ||
        toTextValue(entry?.senderEmail) ||
        toTextValue(entry?.sender_email) ||
        "";
      const to =
        toTextValue(entry?.to) ||
        toTextValue(entry?.toEmail) ||
        toTextValue(entry?.to_email) ||
        toTextValue(entry?.recipient) ||
        toTextValue(entry?.recipientEmail) ||
        toTextValue(entry?.recipient_email) ||
        toTextValue(entry?.recipients) ||
        "";
      const snippetRaw =
        toTextValue(entry?.snippet) ||
        toTextValue(entry?.preview) ||
        toTextValue(entry?.text) ||
        toTextValue(entry?.body) ||
        toTextValue(entry?.content) ||
        "";
      const snippet =
        snippetRaw.length > 280 ? `${snippetRaw.slice(0, 277).trimEnd()}...` : snippetRaw;
      const timestamp = firstTimestampMs(
        entry?.timestamp,
        entry?.time,
        entry?.ts,
        entry?.sentAt,
        entry?.sent_at,
        entry?.receivedAt,
        entry?.received_at,
        entry?.date,
        entry?.createdAt,
        entry?.created_at
      );
      const rawId =
        toTextValue(entry?.id) ||
        toTextValue(entry?.messageId) ||
        toTextValue(entry?.message_id) ||
        toTextValue(entry?.emailId) ||
        toTextValue(entry?.email_id) ||
        toTextValue(entry?.uid) ||
        `entry-${index}`;
      const dedupeKey = [
        rawId,
        String(timestamp || 0),
        normalizeText(subject),
        normalizeText(from),
        normalizeText(to),
        normalizeText(snippet),
      ].join("|");
      if (dedupe.has(dedupeKey)) return;
      dedupe.add(dedupeKey);
      out.push({
        id: rawId,
        subject,
        from,
        to,
        snippet,
        direction: normalizeEmailDirection(entry),
        timestamp,
      });
    });
  });
  out.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  return out;
};

const buildCustomerCallEntries = (calls, customer) => {
  const list = Array.isArray(calls) ? calls : [];
  const customerName = normalizeText(customer?.name);
  const phoneDigits = (customer?.phones || [])
    .map((phone) => normalizeDigitsOnly(phone?.number))
    .filter((digits) => digits.length >= 4);
  const entries = list
    .filter((entry) => entry && typeof entry === "object")
    .filter((entry) => {
      const fromDigits = normalizeDigitsOnly(entry?.from);
      const toDigits = normalizeDigitsOnly(entry?.to);
      const hasNumberMatch = phoneDigits.some(
        (digits) => fromDigits.includes(digits) || toDigits.includes(digits)
      );
      if (hasNumberMatch) return true;
      const entryCustomerName = normalizeText(entry?.customerName);
      if (!customerName || !entryCustomerName) return false;
      return (
        entryCustomerName === customerName ||
        entryCustomerName.includes(customerName) ||
        customerName.includes(entryCustomerName)
      );
    })
    .map((entry, index) => ({
      id: toTextValue(entry?.uuid) || `call-${index}`,
      from: toTextValue(entry?.from),
      to: toTextValue(entry?.to),
      direction: normalizeText(entry?.direction),
      extension: toTextValue(entry?.extension),
      customerName: toTextValue(entry?.customerName),
      answered: Boolean(entry?.answered),
      duration: Number.parseInt(String(entry?.duration || "0"), 10) || 0,
      timestamp: firstTimestampMs(entry?.startTime, entry?.endTime),
    }));
  entries.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  return entries;
};

const deriveContractCountsFromDevelopment = (context) => {
  if (!context || typeof context !== "object") {
    return {
      servers: 0,
      clients: 0,
      networkDevices: 0,
      iotDevices: 0,
      managed: 0,
      discovered: 0
    };
  }
  const infra = context.infra && typeof context.infra === "object" ? context.infra : {};
  const mix = infra.inventoryMix && typeof infra.inventoryMix === "object" ? infra.inventoryMix : {};
  const toCount = (value) => {
    const parsed = Number.parseInt(String(value ?? "0"), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  };
  return {
    servers: toCount(mix.server),
    clients: toCount(mix.workstation) + toCount(mix.other),
    networkDevices: toCount(mix.network) + toCount(mix.firewall) + toCount(mix.printer),
    iotDevices: toCount(mix.iot),
    managed: toCount(infra.managedAssets),
    discovered: toCount(infra.discoveredAssets)
  };
};

const EMPTY_CUSTOMER_COMMUNICATION = {
  customerId: null,
  emails: [],
  calls: [],
  loadedAt: 0,
  metaHubAvailable: false,
  metaHubError: false,
  telephonyError: false
};

const LICENSE_BILLING_CYCLE_OPTIONS = [
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Quartal" },
  { value: "yearly", label: "Jährlich" },
  { value: "once", label: "Einmalig" }
];

const LICENSE_STATUS_OPTIONS = [
  { value: "active", label: "Aktiv" },
  { value: "inactive", label: "Inaktiv" }
];

const CUSTOMER_LICENSE_VENDOR_PRESETS = [
  "Microsoft",
  "Microsoft 365",
  "Veeam",
  "ESET",
  "Hornetsecurity",
  "Acronis"
];

const buildEmptyCustomerLicenseDraft = () => ({
  vendor: "",
  product_name: "",
  quantity: "1",
  billing_cycle: "monthly",
  cost_eur: "",
  valid_until: "",
  status: "active",
  notes: ""
});

const formatLicenseBillingCycle = (value) => {
  const key = String(value || "").trim().toLowerCase();
  return LICENSE_BILLING_CYCLE_OPTIONS.find((item) => item.value === key)?.label || "Monatlich";
};

const calculateLicenseMonthlyEquivalent = (costValue, billingCycle) => {
  const cost = parseOptionalMoneyInput(costValue) ?? 0;
  const cycle = String(billingCycle || "monthly").trim().toLowerCase();
  if (cycle === "yearly") return Number((cost / 12).toFixed(2));
  if (cycle === "quarterly") return Number((cost / 3).toFixed(2));
  if (cycle === "once") return 0;
  return Number(cost.toFixed(2));
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
  const [metricsReloadTick, setMetricsReloadTick] = useState(0);
  const [kpiMonthOffset, setKpiMonthOffset] = useState(0);
  const [importPreview, setImportPreview] = useState(null);
  const [importApplyCreate, setImportApplyCreate] = useState(true);
  const [importApplyUpdate, setImportApplyUpdate] = useState(true);
  const [reportOverview, setReportOverview] = useState([]);
  const [reportStatus, setReportStatus] = useState("idle");
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [deliveryStatus, setDeliveryStatus] = useState("idle");
  const [settingsTab, setSettingsTab] = useState("details");
  const [customerStatsPeriod, setCustomerStatsPeriod] = useState("currentYear");
  const [contractCalcModalOpen, setContractCalcModalOpen] = useState(false);
  const [pbxApiActive, setPbxApiActive] = useState(false);
  const [pbxEntries, setPbxEntries] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [telephonyHealthy, setTelephonyHealthy] = useState(false);
  const [c2dTarget, setC2dTarget] = useState(null);
  const [c2dExtension, setC2dExtension] = useState("");
  const [c2dStatus, setC2dStatus] = useState("");
  const [c2dBusy, setC2dBusy] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [toast, setToast] = useState("");
  const [developmentByCustomerId, setDevelopmentByCustomerId] = useState({});
  const [developmentListStatus, setDevelopmentListStatus] = useState("idle");
  const [communicationStatus, setCommunicationStatus] = useState("idle");
  const [customerCommunication, setCustomerCommunication] = useState(EMPTY_CUSTOMER_COMMUNICATION);
  const [previewModal, setPreviewModal] = useState({
    open: false,
    title: "",
    html: "",
    filename: ""
  });
  const [previewPdfBusy, setPreviewPdfBusy] = useState(false);
  const [contractTariffs, setContractTariffs] = useState([]);
  const [contractTariffsStatus, setContractTariffsStatus] = useState("idle");
  const [calcInput, setCalcInput] = useState({
    tariffId: null,
    servers: "0",
    clients: "0",
    networkDevices: "0",
    iotDevices: "0"
  });
  const [calcImportStatus, setCalcImportStatus] = useState("idle");
  const [customerContracts, setCustomerContracts] = useState([]);
  const [contractsStatus, setContractsStatus] = useState("idle");
  const [customerLicenses, setCustomerLicenses] = useState([]);
  const [customerLicensesStatus, setCustomerLicensesStatus] = useState("idle");
  const [customerLicenseDraft, setCustomerLicenseDraft] = useState(buildEmptyCustomerLicenseDraft);
  const [customerLicenseBusy, setCustomerLicenseBusy] = useState("");
  const [prepaidHoursData, setPrepaidHoursData] = useState(null);
  const [prepaidHoursStatus, setPrepaidHoursStatus] = useState("idle");
  const [prepaidHoursReloadTick, setPrepaidHoursReloadTick] = useState(0);
  const [prepaidHoursBusy, setPrepaidHoursBusy] = useState(false);
  const [prepaidHoursPurchaseDraft, setPrepaidHoursPurchaseDraft] = useState({
    hours: "",
    label: "",
    note: "",
    effectiveAt: todayInputValue()
  });
  const [prepaidHoursDebitDraft, setPrepaidHoursDebitDraft] = useState({
    hours: "",
    taskId: "",
    note: "",
    effectiveAt: todayInputValue()
  });
  const [contractPreviewStatus, setContractPreviewStatus] = useState("idle");
  const [contractSaveStatus, setContractSaveStatus] = useState("idle");
  const [generatedContract, setGeneratedContract] = useState(null);
  const [editingContractId, setEditingContractId] = useState(null);
  const [contractAdvancedOpen, setContractAdvancedOpen] = useState(false);
  const [contractPriceTouched, setContractPriceTouched] = useState({
    monthly: false,
    yearly: false
  });
  const [contractTitleAuto, setContractTitleAuto] = useState(true);
  const [contractTemplates, setContractTemplates] = useState(normalizeContractTemplates(null));
  const [contractVariableDefinitions, setContractVariableDefinitions] = useState({});
  const [contractVariableValues, setContractVariableValues] = useState({});
  const [contractDraft, setContractDraft] = useState({
    title: "",
    docType: "wartung",
    templateKey: "wartung",
    validFrom: "",
    runtimeMonths: "12",
    terminationNoticeMonths: "3",
    autoExtensionMonths: "12",
    monthlyHoursIncluded: "0",
    monthlyTotalOverride: "",
    yearlyTotalOverride: ""
  });
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
    setDevelopmentListStatus("loading");
    api
      .listCustomerDevelopment(true, false)
      .then((payload) => {
        if (!active) return;
        const contexts = Array.isArray(payload?.contexts) ? payload.contexts : [];
        const next = {};
        contexts.forEach((row) => {
          const id = Number(row?.customerId);
          if (!Number.isFinite(id) || id <= 0) return;
          next[id] = row;
        });
        setDevelopmentByCustomerId(next);
        setDevelopmentListStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setDevelopmentByCustomerId({});
        setDevelopmentListStatus("error");
      });
    return () => {
      active = false;
    };
  }, [customers.length]);

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
  const activeCustomer = customers.find((customer) => customer.id === activeId) || null;
  const editCustomer = customers.find((customer) => customer.id === editCustomerId) || null;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    setContractTariffsStatus("loading");
    api
      .listContractTariffs(false)
      .then((rows) => {
        if (!active) return;
        const list = Array.isArray(rows) ? rows : [];
        setContractTariffs(list);
        setContractTariffsStatus("ready");
        setCalcInput((prev) => {
          if (prev.tariffId) return prev;
          const firstActive = list.find((item) => Boolean(item?.is_active));
          return { ...prev, tariffId: firstActive?.id ?? null };
        });
      })
      .catch(() => {
        if (!active) return;
        setContractTariffsStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    api
      .getAiPrompts()
      .then((data) => {
        if (!active) return;
        setContractTemplates(normalizeContractTemplates(data?.contract_templates));
        setContractVariableDefinitions({});
      })
      .catch(() => {
        if (!active) return;
        setContractTemplates(normalizeContractTemplates(null));
        setContractVariableDefinitions({});
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeId) {
      setCustomerContracts([]);
      return;
    }
    let active = true;
    setContractsStatus("loading");
    api
      .listCustomerContracts(activeId)
      .then((rows) => {
        if (!active) return;
        setCustomerContracts(Array.isArray(rows) ? rows : []);
        setContractsStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setContractsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [activeId]);

  useEffect(() => {
    setPrepaidHoursData(null);
    setPrepaidHoursStatus("idle");
    setPrepaidHoursPurchaseDraft({
      hours: "",
      label: "",
      note: "",
      effectiveAt: todayInputValue()
    });
    setPrepaidHoursDebitDraft({
      hours: "",
      taskId: "",
      note: "",
      effectiveAt: todayInputValue()
    });
  }, [editCustomer?.id]);

  useEffect(() => {
    setCustomerLicenses([]);
    setCustomerLicensesStatus("idle");
    setCustomerLicenseDraft(buildEmptyCustomerLicenseDraft());
    setCustomerLicenseBusy("");
  }, [editCustomer?.id]);

  useEffect(() => {
    if (settingsTab !== "contracts" || !editCustomer?.id) return;
    let active = true;
    setPrepaidHoursStatus("loading");
    api
      .getCustomerPrepaidHours(editCustomer.id)
      .then((payload) => {
        if (!active) return;
        setPrepaidHoursData(payload && typeof payload === "object" ? payload : null);
        setPrepaidHoursStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setPrepaidHoursData(null);
        setPrepaidHoursStatus("error");
      });
    return () => {
      active = false;
    };
  }, [editCustomer?.id, prepaidHoursReloadTick, settingsTab]);

  useEffect(() => {
    if (settingsTab !== "licenses" || !editCustomer?.id) return;
    let active = true;
    setCustomerLicensesStatus("loading");
    api
      .listCustomerLicenses(editCustomer.id)
      .then((rows) => {
        if (!active) return;
        setCustomerLicenses(Array.isArray(rows) ? rows : []);
        setCustomerLicensesStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setCustomerLicenses([]);
        setCustomerLicensesStatus("error");
      });
    return () => {
      active = false;
    };
  }, [editCustomer?.id, settingsTab]);

  const parseCount = (value) => {
    const parsed = Number.parseInt(String(value || "0"), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const selectedTariff = useMemo(
    () => contractTariffs.find((item) => Number(item?.id) === Number(calcInput.tariffId)) || null,
    [contractTariffs, calcInput.tariffId]
  );

  const contractTemplateOptions = useMemo(() => {
    const order = new Map([
      ["wartung", 0],
      ["monitoring", 1],
      ["avv_dsgvo", 2]
    ]);
    return Object.entries(contractTemplates || {})
      .map(([key, entry]) => {
        const templateEntry = entry && typeof entry === "object" ? entry : {};
        return {
          key,
          title: String(templateEntry?.title || key).trim() || key,
          description: String(templateEntry?.description || "").trim(),
          docType: resolveContractBaseType(key, templateEntry),
          body_template: String(templateEntry?.body_template || ""),
          hasBodyTemplate: Boolean(String(templateEntry?.body_template || "").trim())
        };
      })
      .sort((a, b) => {
        const orderDiff = (order.get(a.docType) ?? 99) - (order.get(b.docType) ?? 99);
        if (orderDiff !== 0) return orderDiff;
        return a.title.localeCompare(b.title, "de");
      });
  }, [contractTemplates]);

  const activeContractTemplate =
    contractTemplateOptions.find((item) => item.key === contractDraft.templateKey) || contractTemplateOptions[0] || null;
  const activeContractBaseType = activeContractTemplate?.docType || contractDraft.docType || "wartung";

  const tariffCategoryForContractType = useMemo(() => {
    const type = String(activeContractBaseType || "wartung").trim().toLowerCase();
    if (type === "wartung") return "wartung";
    if (type === "monitoring") return "monitoring";
    return "";
  }, [activeContractBaseType]);

  const filteredActiveTariffs = useMemo(() => {
    const activeTariffs = (contractTariffs || []).filter((item) => Boolean(item?.is_active));
    if (!tariffCategoryForContractType) return [];
    return activeTariffs.filter(
      (item) => String(item?.category || "").trim().toLowerCase() === tariffCategoryForContractType
    );
  }, [contractTariffs, tariffCategoryForContractType]);

  const tariffRequired = Boolean(tariffCategoryForContractType);
  const tariffSelectionMissing = tariffRequired && !selectedTariff;

  useEffect(() => {
    setCalcInput((prev) => {
      if (!tariffCategoryForContractType) {
        if (prev.tariffId === null) return prev;
        return { ...prev, tariffId: null };
      }
      const currentExists = filteredActiveTariffs.some((item) => Number(item?.id) === Number(prev.tariffId));
      if (currentExists) return prev;
      return { ...prev, tariffId: filteredActiveTariffs[0]?.id ?? null };
    });
  }, [filteredActiveTariffs, tariffCategoryForContractType]);

  const supportsHoursBudget = useMemo(
    () => String(activeContractBaseType || "").trim().toLowerCase() === "wartung",
    [activeContractBaseType]
  );

  const monthlyHoursIncluded = useMemo(
    () => (supportsHoursBudget ? parseHoursInput(contractDraft.monthlyHoursIncluded) : 0),
    [contractDraft.monthlyHoursIncluded, supportsHoursBudget]
  );
  const runtimeMonthsValue = useMemo(() => {
    const parsed = Number.parseInt(String(contractDraft.runtimeMonths || "12"), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  }, [contractDraft.runtimeMonths]);
  const terminationNoticeMonthsValue = useMemo(() => {
    const parsed = Number.parseInt(String(contractDraft.terminationNoticeMonths || "3"), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 3;
  }, [contractDraft.terminationNoticeMonths]);
  const autoExtensionMonthsValue = useMemo(() => {
    const parsed = Number.parseInt(String(contractDraft.autoExtensionMonths || "12"), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  }, [contractDraft.autoExtensionMonths]);
  const contractRuntimeInvalid = terminationNoticeMonthsValue > runtimeMonthsValue;
  const contractGenerationBlocked = tariffSelectionMissing || contractRuntimeInvalid;
  useEffect(() => {
    const variableKeys = extractContractTemplateVariables(activeContractTemplate?.body_template || "");
    const nextDefinitions = Object.fromEntries(
      variableKeys.map((key) => [
        key,
        {
          value: "",
          label: key,
          customerEditable: true
        }
      ])
    );
    setContractVariableDefinitions(nextDefinitions);
  }, [activeContractTemplate]);

  const editableContractVariables = useMemo(
    () =>
      Object.entries(contractVariableDefinitions || {}).map(([key, entry]) => ({
        key,
        label: String(entry?.label || key),
        suggestedValue: String(entry?.value || "")
      })),
    [contractVariableDefinitions]
  );

  useEffect(() => {
    setContractVariableValues((prev) =>
      buildEditableContractVariableValues(contractVariableDefinitions, prev)
    );
  }, [contractVariableDefinitions]);

  const contractPreview = useMemo(() => {
    const counts = {
      servers: parseCount(calcInput.servers),
      clients: parseCount(calcInput.clients),
      networkDevices: parseCount(calcInput.networkDevices),
      iotDevices: parseCount(calcInput.iotDevices)
    };
    if (!selectedTariff) {
      return { tariffMonthly: 0, hourlyPrice: 0, counts };
    }
    const tariffMonthly =
      Number(selectedTariff.base_price_monthly || 0) +
      counts.servers * Number(selectedTariff.price_server_monthly || 0) +
      counts.clients * Number(selectedTariff.price_client_monthly || 0) +
      counts.networkDevices * Number(selectedTariff.price_network_monthly || 0) +
      counts.iotDevices * Number(selectedTariff.price_iot_monthly || 0);
    const hourlyPrice = Number(selectedTariff.hourly_price || 0);
    return { tariffMonthly, hourlyPrice, counts };
  }, [selectedTariff, calcInput]);

  const contractTotals = useMemo(() => {
    const tariffMonthly = Number(contractPreview.tariffMonthly || 0);
    const hourlyRate = Number(contractPreview.hourlyPrice || 0);
    const hourlyMonthly = monthlyHoursIncluded * hourlyRate;
    const monthlyAuto = tariffMonthly + hourlyMonthly;
    const monthlyAutoRounded = Number(monthlyAuto.toFixed(2));
    const yearlyAutoRounded = Number((monthlyAutoRounded * 12).toFixed(2));

    const monthlyOverride = parseOptionalMoneyInput(contractDraft.monthlyTotalOverride);
    const yearlyOverride = parseOptionalMoneyInput(contractDraft.yearlyTotalOverride);

    const monthlyFinal = Number((monthlyOverride !== null ? monthlyOverride : monthlyAutoRounded).toFixed(2));
    const yearlyFinal = Number(
      (
        yearlyOverride !== null
          ? yearlyOverride
          : monthlyFinal * 12
      ).toFixed(2)
    );
    const monthlyDelta = Number((monthlyFinal - monthlyAutoRounded).toFixed(2));
    const yearlyDelta = Number((yearlyFinal - yearlyAutoRounded).toFixed(2));

    return {
      monthly: monthlyFinal,
      yearly: yearlyFinal,
      monthlyAuto: monthlyAutoRounded,
      yearlyAuto: yearlyAutoRounded,
      monthlyOverridden: Math.abs(monthlyDelta) >= 0.01,
      yearlyOverridden: Math.abs(yearlyDelta) >= 0.01,
      monthlyHasInput: monthlyOverride !== null,
      yearlyHasInput: yearlyOverride !== null,
      monthlyDelta,
      yearlyDelta,
      tariffMonthly: Number(tariffMonthly.toFixed(2)),
      hourlyMonthly: Number(hourlyMonthly.toFixed(2)),
      hourlyRate
    };
  }, [
    contractDraft.monthlyTotalOverride,
    contractDraft.yearlyTotalOverride,
    contractPreview.tariffMonthly,
    contractPreview.hourlyPrice,
    monthlyHoursIncluded,
  ]);

  useEffect(() => {
    const suggestedMonthlyInput = formatMoneyInputValue(contractTotals.monthlyAuto);
    setContractDraft((prev) => {
      const next = { ...prev };
      let changed = false;
      if (!contractPriceTouched.monthly && next.monthlyTotalOverride !== suggestedMonthlyInput) {
        next.monthlyTotalOverride = suggestedMonthlyInput;
        changed = true;
      }
      const baseMonthly =
        parseOptionalMoneyInput(!contractPriceTouched.monthly ? suggestedMonthlyInput : next.monthlyTotalOverride) ??
        contractTotals.monthlyAuto;
      const derivedYearlyInput = formatMoneyInputValue(baseMonthly * 12);
      if (!contractPriceTouched.yearly && next.yearlyTotalOverride !== derivedYearlyInput) {
        next.yearlyTotalOverride = derivedYearlyInput;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [
    contractDraft.monthlyTotalOverride,
    contractPriceTouched.monthly,
    contractPriceTouched.yearly,
    contractTotals.monthlyAuto
  ]);

  useEffect(() => {
    setGeneratedContract(null);
  }, [
    activeId,
    contractDraft.title,
    contractDraft.docType,
    contractDraft.templateKey,
    contractDraft.validFrom,
    contractDraft.runtimeMonths,
    contractDraft.terminationNoticeMonths,
    contractDraft.autoExtensionMonths,
    contractDraft.monthlyHoursIncluded,
    contractDraft.monthlyTotalOverride,
    contractDraft.yearlyTotalOverride,
    selectedTariff?.id,
    contractTotals.monthly,
    contractTotals.yearly,
    contractPreview.counts.servers,
    contractPreview.counts.clients,
    contractPreview.counts.networkDevices,
    contractPreview.counts.iotDevices
  ]);

  const importCalcValuesFromRmm = async () => {
    if (!activeId) return;
    setCalcImportStatus("loading");
    try {
      let context = developmentByCustomerId[activeId] || null;
      if (!context) {
        context = await api.getCustomerDevelopment(activeId, true);
      }
      const counts = deriveContractCountsFromDevelopment(context);
      if (!counts.servers && !counts.clients && !counts.networkDevices && !counts.iotDevices) {
        setCalcImportStatus("empty");
        setTimeout(() => setCalcImportStatus("idle"), 2200);
        return;
      }

      setCalcInput((prev) => ({
        ...prev,
        servers: String(counts.servers),
        clients: String(counts.clients),
        networkDevices: String(counts.networkDevices),
        iotDevices: String(counts.iotDevices),
      }));
      setCalcImportStatus("done");
      setTimeout(() => setCalcImportStatus("idle"), 1800);
    } catch {
      setCalcImportStatus("error");
      setTimeout(() => setCalcImportStatus("idle"), 2200);
    }
  };

  const renderContractPdfBlob = async (html, filename = "vertrag.pdf") => api.buildPdf(html, filename);

  const generateContractPreview = async (openModal = true) => {
    if (!activeId) return null;
    if (tariffSelectionMissing) {
      setToast("Für Wartung/Monitoring muss eine Preisvorlage gewählt werden.");
      return null;
    }
    if (contractRuntimeInvalid) {
      setToast("Kündigungsfrist darf die Laufzeit nicht überschreiten.");
      return null;
    }
    const selectedTariffId = tariffRequired ? selectedTariff?.id || null : null;
    setContractPreviewStatus("saving");
    try {
      const preview = await api.previewCustomerContract(activeId, {
        title: String(contractDraft.title || "").trim(),
        doc_type: String(activeContractBaseType || "wartung"),
        template_key: String(activeContractTemplate?.key || contractDraft.templateKey || "wartung"),
        note: "",
        valid_from: String(contractDraft.validFrom || ""),
        runtime_months: runtimeMonthsValue,
        termination_notice_months: terminationNoticeMonthsValue,
        auto_extension_months: autoExtensionMonthsValue,
        tariff_id: selectedTariffId,
        servers: contractPreview.counts.servers,
        clients: contractPreview.counts.clients,
        network_devices: contractPreview.counts.networkDevices,
        iot_devices: contractPreview.counts.iotDevices,
        monthly_total: contractTotals.monthly,
        yearly_total: contractTotals.yearly,
        monthly_hours_included: monthlyHoursIncluded,
        contract_variable_values: contractVariableValues
      });
      if (Array.isArray(preview?.meta?.individual_variables)) {
        const previewValues = {};
        preview.meta.individual_variables.forEach((entry) => {
          const key = normalizeContractVariableKey(entry?.key);
          if (!key) return;
          previewValues[key] = String(entry?.value ?? entry?.suggested_value ?? "");
        });
        setContractVariableValues((prev) =>
          buildEditableContractVariableValues(contractVariableDefinitions, {
            ...prev,
            ...previewValues
          })
        );
      }
      setGeneratedContract(preview);
      setContractPreviewStatus("saved");
      if (openModal) {
        setPreviewModal({
          open: true,
          title: preview?.title || "Vertragsvorschau",
          html: preview?.html || "",
          filename: ""
        });
      }
      setTimeout(() => setContractPreviewStatus("idle"), 1800);
      return preview;
    } catch (error) {
      setContractPreviewStatus("error");
      setToast(error?.message ? String(error.message) : "Vorschau konnte nicht erstellt werden.");
      setTimeout(() => setContractPreviewStatus("idle"), 2200);
      return null;
    }
  };

  const exportGeneratedContractPdf = async () => {
    const source = generatedContract || (await generateContractPreview(false));
    if (!source?.html) return;
    try {
      const pdfBlob = await renderContractPdfBlob(source.html, source.file_name || "vertrag.pdf");
      const objectUrl = window.URL.createObjectURL(pdfBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = source.file_name || "vertrag.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      setToast("PDF-Erzeugung fehlgeschlagen.");
    }
  };

  const saveGeneratedContract = async () => {
    if (!activeId) return;
    if (tariffSelectionMissing) {
      setToast("Für Wartung/Monitoring muss eine Preisvorlage gewählt werden.");
      return;
    }
    if (contractRuntimeInvalid) {
      setToast("Kündigungsfrist darf die Laufzeit nicht überschreiten.");
      return;
    }
    setContractSaveStatus("saving");
    try {
      const source = generatedContract || (await generateContractPreview(false));
      if (!source?.html) throw new Error("no_preview");
      const pdfBlob = await renderContractPdfBlob(source.html, source.file_name || "vertrag.pdf");
      const contentBase64 = await blobToBase64(pdfBlob);
      const selectedTariffId = tariffRequired
        ? Number(source?.meta?.tariff?.id || selectedTariff?.id || 0) || null
        : null;
      const payload = {
        title: String(source.title || contractDraft.title || "Vertrag").trim(),
        doc_type: String(source.doc_type || activeContractBaseType || "wartung"),
        file_name: String(source.file_name || "vertrag.pdf"),
        mime_type: "application/pdf",
        content_base64: contentBase64,
        html_content: String(source.html || ""),
        template_key: String(source.template_key || activeContractTemplate?.key || contractDraft.templateKey || "wartung"),
        tariff_id: selectedTariffId,
        monthly_hours_included: Number(source?.meta?.monthly_hours_included ?? monthlyHoursIncluded),
        valid_from: String(source?.meta?.valid_from || contractDraft.validFrom || ""),
        runtime_months: Number(source?.meta?.runtime_months || runtimeMonthsValue),
        termination_notice_months: Number(
          source?.meta?.termination_notice_months ?? terminationNoticeMonthsValue
        ),
        auto_extension_months: Number(
          source?.meta?.auto_extension_months ?? autoExtensionMonthsValue
        ),
        servers: Number(source?.meta?.servers ?? contractPreview.counts.servers ?? 0),
        clients: Number(source?.meta?.clients ?? contractPreview.counts.clients ?? 0),
        network_devices: Number(source?.meta?.network_devices ?? contractPreview.counts.networkDevices ?? 0),
        iot_devices: Number(source?.meta?.iot_devices ?? contractPreview.counts.iotDevices ?? 0),
        monthly_total: Number(source?.meta?.monthly_total ?? contractTotals.monthly),
        yearly_total: Number(source?.meta?.yearly_total ?? contractTotals.yearly),
        suggested_monthly_total: Number(
          source?.meta?.suggested_monthly_total ?? contractTotals.monthlyAuto
        ),
        suggested_yearly_total: Number(
          source?.meta?.suggested_yearly_total ?? contractTotals.yearlyAuto
        ),
        contract_variable_values: contractVariableValues,
        note: "",
        status: "proposal"
      };
      const saved = editingContractId
        ? await api.updateCustomerContract(activeId, editingContractId, payload)
        : await api.createCustomerContract(activeId, payload);
      setCustomerContracts((prev) =>
        editingContractId ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev]
      );
      setGeneratedContract(source);
      setMetricsReloadTick((prev) => prev + 1);
      setContractSaveStatus("saved");
      setTimeout(() => setContractSaveStatus("idle"), 1800);
    } catch (error) {
      setContractSaveStatus("error");
      setToast(error?.message ? String(error.message) : "Speichern fehlgeschlagen.");
      setTimeout(() => setContractSaveStatus("idle"), 2200);
    }
  };

  const downloadContractDocument = async (contractId, fallbackName = "vertrag.pdf") => {
    if (!activeId || !contractId) return;
    try {
      const res = await fetch(`${API}/customers/${activeId}/contracts/${contractId}/download`);
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fallbackName || "vertrag.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setToast("Vertrag konnte nicht heruntergeladen werden.");
    }
  };

  const cancelContractDocument = async (contractId) => {
    if (!activeId || !contractId) return;
    const reason = window.prompt("Stornogrund (optional):", "") || "";
    const stopImmediately = window.confirm("Leistung sofort stoppen?");
    try {
      const updated = await api.cancelCustomerContract(activeId, contractId, {
        reason,
        stop_service_immediately: Boolean(stopImmediately),
        effective_at: 0,
      });
      setCustomerContracts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMetricsReloadTick((prev) => prev + 1);
    } catch {
      setToast("Stornierung fehlgeschlagen.");
    }
  };

  const reactivateContractDocument = async (contractId) => {
    if (!activeId || !contractId) return;
    try {
      const updated = await api.reactivateCustomerContract(activeId, contractId);
      setCustomerContracts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMetricsReloadTick((prev) => prev + 1);
    } catch {
      setToast("Reaktivierung fehlgeschlagen.");
    }
  };

  const markContractDocumentAsProposal = async (contractId) => {
    if (!activeId || !contractId) return;
    try {
      const updated = await api.markCustomerContractProposal(activeId, contractId);
      setCustomerContracts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setMetricsReloadTick((prev) => prev + 1);
    } catch {
      setToast("Markierung als Vorschlag fehlgeschlagen.");
    }
  };

  const closeContractCreator = () => {
    setContractCalcModalOpen(false);
    setEditingContractId(null);
    setContractAdvancedOpen(false);
    setContractPriceTouched({ monthly: false, yearly: false });
    setContractTitleAuto(true);
  };

  const openContractProposalEditor = (item) => {
    if (!item) return;
    const docType = String(item?.doc_type || "wartung").trim().toLowerCase() || "wartung";
    const templateKey = String(item?.template_key || "").trim() || docType;
    const preferredTariffCategory = docType === "monitoring" ? "monitoring" : docType === "wartung" ? "wartung" : "";
    const savedCounts = item?.counts && typeof item.counts === "object" ? item.counts : {};
    const savedPricing = item?.pricing && typeof item.pricing === "object" ? item.pricing : {};
    const savedVariableValues =
      item?.contract_variable_values && typeof item.contract_variable_values === "object"
        ? item.contract_variable_values
        : {};
    const savedTariffId = Number(item?.tariff?.id || 0) || null;
    const matchingTariff = savedTariffId
      ? (contractTariffs || []).find((tariff) => Number(tariff?.id) === savedTariffId) || null
      : preferredTariffCategory
      ? (contractTariffs || []).find(
          (tariff) =>
            Boolean(tariff?.is_active) &&
            String(tariff?.category || "").trim().toLowerCase() === preferredTariffCategory
        ) || null
      : null;
    setCalcInput((prev) => ({
      ...prev,
      tariffId: matchingTariff?.id ?? null,
      servers: String(Number(savedCounts?.servers || 0)),
      clients: String(Number(savedCounts?.clients || 0)),
      networkDevices: String(Number(savedCounts?.network_devices || 0)),
      iotDevices: String(Number(savedCounts?.iot_devices || 0))
    }));
    setEditingContractId(Number(item.id || 0) || null);
    setContractDraft({
      title: String(item?.title || "").trim(),
      docType,
      templateKey,
      validFrom: String(item?.valid_from || "").trim() || todayInputValue(),
      runtimeMonths: String(Number(item?.runtime_months || 12) || 12),
      terminationNoticeMonths: String(Number(item?.termination_notice_months || 3) || 3),
      autoExtensionMonths: String(Number(item?.auto_extension_months || 12) || 12),
      monthlyHoursIncluded: String(Number(item?.monthly_hours_included || 0)),
      monthlyTotalOverride: formatMoneyInputValue(savedPricing?.monthly_total),
      yearlyTotalOverride: formatMoneyInputValue(savedPricing?.yearly_total)
    });
    setGeneratedContract({
      title: String(item?.title || "").trim() || "Vertrag",
      doc_type: docType,
      template_key: templateKey,
      file_name: String(item?.file_name || "vertrag.pdf"),
      html: String(item?.html_content || ""),
      meta: {
        monthly_hours_included: Number(item?.monthly_hours_included || 0),
        tariff: item?.tariff || null,
        servers: Number(savedCounts?.servers || 0),
        clients: Number(savedCounts?.clients || 0),
        network_devices: Number(savedCounts?.network_devices || 0),
        iot_devices: Number(savedCounts?.iot_devices || 0),
        monthly_total: Number(savedPricing?.monthly_total || 0),
        yearly_total: Number(savedPricing?.yearly_total || 0),
        suggested_monthly_total: Number(savedPricing?.suggested_monthly_total || 0),
        suggested_yearly_total: Number(savedPricing?.suggested_yearly_total || 0),
        contract_variable_values: savedVariableValues
      }
    });
    setContractVariableValues(buildEditableContractVariableValues(contractVariableDefinitions, savedVariableValues));
    setContractPriceTouched({
      monthly: Number(savedPricing?.monthly_total || 0) > 0,
      yearly: Number(savedPricing?.yearly_total || 0) > 0
    });
    setContractAdvancedOpen(true);
    setContractTitleAuto(false);
    setContractCalcModalOpen(true);
  };

  const openContractCreator = () => {
    if (!activeCustomer) return;
    const context = developmentByCustomerId[activeCustomer.id] || null;
    const counts = deriveContractCountsFromDevelopment(context);
    const preferredTemplate =
      contractTemplateOptions.find((item) => item.docType === "wartung") || contractTemplateOptions[0] || null;
    setCalcInput((prev) => ({
      ...prev,
      servers: String(counts.servers),
      clients: String(counts.clients),
      networkDevices: String(counts.networkDevices),
      iotDevices: String(counts.iotDevices),
      note: String(
        prev.note ||
          `Meta-Hub Vorschlag: ${counts.managed} RMM-Agents, ${counts.discovered} Inventar-Geräte`
      ),
    }));
    setContractDraft({
      title: buildDefaultContractTitle(
        preferredTemplate?.title,
        activeCustomerLabel,
        preferredTemplate?.docType || "wartung"
      ),
      docType: preferredTemplate?.docType || "wartung",
      templateKey: preferredTemplate?.key || "wartung",
      validFrom: todayInputValue(),
      runtimeMonths: "12",
      terminationNoticeMonths: "3",
      autoExtensionMonths: "12",
      monthlyHoursIncluded: "0",
      monthlyTotalOverride: "",
      yearlyTotalOverride: ""
    });
    setEditingContractId(null);
    setGeneratedContract(null);
    setContractVariableValues(buildEditableContractVariableValues(contractVariableDefinitions));
    setContractAdvancedOpen(false);
    setContractPriceTouched({ monthly: false, yearly: false });
    setContractTitleAuto(true);
    setContractCalcModalOpen(true);
  };

  const deleteContractDocument = async (contractId) => {
    if (!activeId || !contractId) return;
    if (!window.confirm("Vertrag wirklich endgültig löschen?")) return;
    try {
      await api.deleteCustomerContract(activeId, contractId);
      setCustomerContracts((prev) => prev.filter((item) => item.id !== contractId));
      setMetricsReloadTick((prev) => prev + 1);
    } catch {
      setToast("Löschen fehlgeschlagen.");
    }
  };

  const createPrepaidHoursEntry = async (entryType) => {
    const customerId = Number(editCustomer?.id || 0);
    if (!customerId) return;
    const isPurchase = entryType === "purchase";
    const draft = isPurchase ? prepaidHoursPurchaseDraft : prepaidHoursDebitDraft;
    const hoursValue = parseHoursInput(draft.hours);
    if (hoursValue <= 0) {
      setToast("Bitte Stunden > 0 eingeben.");
      return;
    }
    setPrepaidHoursBusy(true);
    try {
      await api.createCustomerPrepaidHoursEntry(customerId, {
        entry_type: isPurchase ? "purchase" : "debit",
        hours: hoursValue,
        label: isPurchase ? String(draft.label || "").trim() : "",
        note: String(draft.note || "").trim(),
        task_id: isPurchase ? null : Number(draft.taskId || 0) || null,
        effective_at: toTimestampMs(draft.effectiveAt) || Date.now()
      });
      setPrepaidHoursReloadTick((prev) => prev + 1);
      if (isPurchase) {
        setPrepaidHoursPurchaseDraft({
          hours: "",
          label: "",
          note: "",
          effectiveAt: todayInputValue()
        });
        setToast("Stundenkauf gespeichert.");
      } else {
        setPrepaidHoursDebitDraft({
          hours: "",
          taskId: "",
          note: "",
          effectiveAt: todayInputValue()
        });
        setToast("Abbuchung gespeichert.");
      }
    } catch (error) {
      setToast(error?.message ? String(error.message) : "Buchung fehlgeschlagen.");
    } finally {
      setPrepaidHoursBusy(false);
    }
  };

  const deletePrepaidHoursEntry = async (entryId) => {
    const customerId = Number(editCustomer?.id || 0);
    if (!customerId || !entryId) return;
    if (!window.confirm("Buchung wirklich löschen?")) return;
    setPrepaidHoursBusy(true);
    try {
      await api.deleteCustomerPrepaidHoursEntry(customerId, entryId);
      setPrepaidHoursReloadTick((prev) => prev + 1);
      setToast("Buchung gelöscht.");
    } catch (error) {
      setToast(error?.message ? String(error.message) : "Löschen fehlgeschlagen.");
    } finally {
      setPrepaidHoursBusy(false);
    }
  };

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

  const activeCustomerLabel = String(activeCustomer?.name || "").trim();
  const autoContractTitle = buildDefaultContractTitle(
    activeContractTemplate?.title,
    activeCustomerLabel,
    activeContractBaseType
  );
  const applyContractTemplateChange = (nextTemplateKey) => {
    const nextTemplate = contractTemplateOptions.find((item) => item.key === nextTemplateKey) || null;
    if (!nextTemplate) return;
    const previousAutoTitle = buildDefaultContractTitle(
      activeContractTemplate?.title,
      activeCustomerLabel,
      activeContractBaseType
    );
    const currentTitle = String(contractDraft.title || "").trim();
    const shouldUpdateTitle = contractTitleAuto || !currentTitle || currentTitle === previousAutoTitle;
    setContractDraft((prev) => ({
      ...prev,
      docType: nextTemplate.docType,
      templateKey: nextTemplate.key,
      title: shouldUpdateTitle
        ? buildDefaultContractTitle(nextTemplate.title, activeCustomerLabel, nextTemplate.docType)
        : prev.title,
      monthlyHoursIncluded: nextTemplate.docType === "avv_dsgvo" ? "0" : prev.monthlyHoursIncluded
    }));
    if (shouldUpdateTitle) {
      setContractTitleAuto(true);
    }
  };
  const metricsCustomerId = Number(editCustomer?.id || activeCustomer?.id || 0);
  const selectedCustomerMetrics =
    metrics &&
    Number(metrics?.customerId || 0) === metricsCustomerId &&
    typeof metrics === "object"
      ? metrics
      : null;
  const contractTimeBudget =
    selectedCustomerMetrics?.contractTimeBudget &&
    typeof selectedCustomerMetrics.contractTimeBudget === "object"
      ? selectedCustomerMetrics.contractTimeBudget
      : null;
  const editHasHoursBudgetContract = useMemo(() => {
    const contracts = Array.isArray(customerContracts) ? customerContracts : [];
    return contracts.some((item) => {
      const status = String(item?.status || "").trim().toLowerCase();
      const type = normalizeContractDocumentType(item?.doc_type ?? item?.template_key);
      return status === "active" && type === "wartung";
    });
  }, [customerContracts]);
  const openEffortHours = Number(selectedCustomerMetrics?.openTimeMinutes || 0) / 60;
  const travelRoundTripKm = Number(
    selectedCustomerMetrics?.distanceRoundTripKm ||
      (Number(selectedCustomerMetrics?.distanceKm || 0) > 0
        ? Number(selectedCustomerMetrics.distanceKm) * 2
        : 0)
  );
  const periodStats =
    selectedCustomerMetrics?.periodStats && typeof selectedCustomerMetrics.periodStats === "object"
      ? selectedCustomerMetrics.periodStats
      : {};
  const selectedPeriodStats =
    periodStats?.[customerStatsPeriod] && typeof periodStats[customerStatsPeriod] === "object"
      ? periodStats[customerStatsPeriod]
      : null;
  const sevdeskRecurringTagsSummary =
    selectedCustomerMetrics?.sevdeskRecurringTags && typeof selectedCustomerMetrics.sevdeskRecurringTags === "object"
      ? selectedCustomerMetrics.sevdeskRecurringTags
      : null;
  const sevdeskRecurringTagTotals = Array.isArray(sevdeskRecurringTagsSummary?.tagTotals)
    ? sevdeskRecurringTagsSummary.tagTotals
    : [];
  const sevdeskRecurringTagInvoices = Array.isArray(sevdeskRecurringTagsSummary?.invoices)
    ? sevdeskRecurringTagsSummary.invoices
    : [];
  const prepaidHoursSummary =
    prepaidHoursData && typeof prepaidHoursData === "object" ? prepaidHoursData : null;
  const prepaidHoursEntries = Array.isArray(prepaidHoursSummary?.entries) ? prepaidHoursSummary.entries : [];
  const prepaidHoursTaskOptions = Array.isArray(prepaidHoursSummary?.taskOptions)
    ? prepaidHoursSummary.taskOptions
    : [];
  const prepaidHoursBalance = Number(prepaidHoursSummary?.balanceHours || 0);
  const prepaidHoursPurchaseValue = parseHoursInput(prepaidHoursPurchaseDraft.hours);
  const prepaidHoursDebitValue = parseHoursInput(prepaidHoursDebitDraft.hours);
  const selectedPrepaidTask = prepaidHoursTaskOptions.find(
    (item) => Number(item?.id || 0) === Number(prepaidHoursDebitDraft.taskId || 0)
  ) || null;
  const projectedPrepaidBalance = Number((prepaidHoursBalance - prepaidHoursDebitValue).toFixed(2));
  const monthlyActivity =
    selectedCustomerMetrics?.monthlyActivity && typeof selectedCustomerMetrics.monthlyActivity === "object"
      ? selectedCustomerMetrics.monthlyActivity
      : null;
  const selectedMonthOffset = Number(monthlyActivity?.monthOffset ?? kpiMonthOffset);
  const selectedMonthLabel = String(monthlyActivity?.monthLabel || "Aktueller Monat");
  const selectedMonthTaskHours = Number(monthlyActivity?.taskHours ?? contractTimeBudget?.taskHours ?? 0);
  const selectedMonthTaskRevenue = Number(monthlyActivity?.taskRevenueEur || 0);
  const selectedMonthTaskCount = Number(monthlyActivity?.taskCount || 0);
  const selectedMonthTelephonyHours = Number(
    monthlyActivity?.telephonyHours ?? contractTimeBudget?.telephonyHours ?? 0
  );
  const selectedMonthTelephonyMinutes = Number(monthlyActivity?.telephonyMinutes || 0);
  const selectedMonthCallCount = Number(monthlyActivity?.callCount || 0);
  const selectedMonthMissedCalls = Number(monthlyActivity?.missedCalls || 0);
  const selectedMonthConsumedHours = Number(
    monthlyActivity?.consumedHours ?? contractTimeBudget?.consumedHours ?? 0
  );
  const selectedMonthConsumedRevenue = Number(monthlyActivity?.consumedRevenueEur || 0);
  const thirtyDayTotalCalls = Number(selectedCustomerMetrics?.totalCalls || 0);
  const thirtyDayMissedCalls = Number(selectedCustomerMetrics?.missedCalls || 0);
  const thirtyDayAnsweredCalls = Math.max(0, thirtyDayTotalCalls - thirtyDayMissedCalls);
  const thirtyDayTalkHours = Number(selectedCustomerMetrics?.totalMinutes || 0) / 60;
  const thirtyDayMissRate = thirtyDayTotalCalls > 0 ? Math.round((thirtyDayMissedCalls / thirtyDayTotalCalls) * 100) : 0;
  const canShowNewerMonth = selectedMonthOffset < 0;
  const canShowOlderMonth = selectedMonthOffset > -120;
  const totalCustomers = customers.length;
  const inactiveCustomers = customers.filter(
    (customer) => String(customer.status || "active").toLowerCase() === "inactive"
  ).length;
  const activeCustomers = Math.max(0, totalCustomers - inactiveCustomers);
  const communicationDataForEditCustomer =
    Number(customerCommunication.customerId || 0) === Number(editCustomer?.id || 0)
      ? customerCommunication
      : EMPTY_CUSTOMER_COMMUNICATION;
  const communicationEmailEntries = communicationDataForEditCustomer.emails || [];
  const communicationCallEntries = communicationDataForEditCustomer.calls || [];
  const contractControlStats = useMemo(() => {
    const contracts = Array.isArray(customerContracts) ? customerContracts : [];
    const nowMs = Date.now();
    const serviceContracts = contracts.filter((item) => {
      const type = String(item?.doc_type || item?.template_key || "").toLowerCase();
      return type === "wartung" || type === "monitoring";
    });
    const budgetContracts = contracts.filter((item) => {
      const type = String(item?.doc_type || item?.template_key || "").toLowerCase();
      return type === "wartung";
    });
    const activeContracts = contracts.filter((item) => String(item?.status || "").toLowerCase() === "active");
    const proposalContracts = contracts.filter((item) => String(item?.status || "").toLowerCase() === "proposal");
    let nextRenewalAt = 0;
    let nextCancellationDeadlineAt = 0;
    let renewalsDueSoon = 0;
    contracts.forEach((item) => {
      const status = String(item?.status || "").toLowerCase();
      if (status !== "active" && status !== "proposal") return;
      const timeline = contractTimelineFromItem(item);
      if (timeline.nextRenewalAt > 0) {
        if (!nextRenewalAt || timeline.nextRenewalAt < nextRenewalAt) nextRenewalAt = timeline.nextRenewalAt;
        if (timeline.nextRenewalAt <= nowMs + 45 * 24 * 60 * 60 * 1000) renewalsDueSoon += 1;
      }
      if (timeline.cancellationDeadlineAt > 0) {
        if (
          !nextCancellationDeadlineAt ||
          timeline.cancellationDeadlineAt < nextCancellationDeadlineAt
        ) {
          nextCancellationDeadlineAt = timeline.cancellationDeadlineAt;
        }
      }
    });
    const missingIncludedHours = budgetContracts.filter(
      (item) => Number(item?.monthly_hours_included || 0) <= 0
    ).length;
    const runtimeDaysAvg = contracts.length
      ? Math.round(
          contracts.reduce((sum, item) => {
            const createdAt = Number(item?.created_at || 0);
            if (!createdAt) return sum;
            return sum + Math.max(0, Math.round((nowMs - createdAt) / (24 * 60 * 60 * 1000)));
          }, 0) / contracts.length
        )
      : 0;
    return {
      total: contracts.length,
      active: activeContracts.length,
      proposal: proposalContracts.length,
      service: serviceContracts.length,
      missingIncludedHours,
      renewalsDueSoon,
      nextRenewalAt,
      nextRenewalDays: daysUntilTimestamp(nextRenewalAt),
      nextCancellationDeadlineAt,
      nextCancellationDeadlineDays: daysUntilTimestamp(nextCancellationDeadlineAt),
      runtimeDaysAvg
    };
  }, [customerContracts]);
  const customerLicenseSummary = useMemo(() => {
    const licenses = Array.isArray(customerLicenses) ? customerLicenses : [];
    const activeLicenses = licenses.filter((item) => String(item?.status || "").trim().toLowerCase() === "active");
    const monthlyEquivalent = activeLicenses.reduce(
      (sum, item) => sum + Number(item?.monthly_equivalent_eur || 0),
      0
    );
    const dueSoonCount = activeLicenses.filter((item) => {
      const validUntilTimestamp = toTimestampMs(item?.valid_until);
      if (!validUntilTimestamp) return false;
      const days = Math.ceil((validUntilTimestamp - Date.now()) / (24 * 60 * 60 * 1000));
      return days >= 0 && days <= 45;
    }).length;
    return {
      total: licenses.length,
      active: activeLicenses.length,
      dueSoonCount,
      monthlyEquivalent: Number(monthlyEquivalent.toFixed(2))
    };
  }, [customerLicenses]);
  const customerSteering = useMemo(() => {
    const revenueYtd = Number(selectedCustomerMetrics?.revenueCurrentYearEur || 0);
    const hasServiceContract = Boolean(contractTimeBudget?.hasServiceContract);
    const monthlyBudget = Number(contractTimeBudget?.includedHours || 0);
    const monthlyConsumed = Number(contractTimeBudget?.consumedHours || 0);
    const overrun = Number(contractTimeBudget?.overrunHours || 0);
    const missedCalls = Number(selectedCustomerMetrics?.missedCalls || 0);
    const totalCalls = Number(selectedCustomerMetrics?.totalCalls || 0);
    const openTasks = Number(selectedCustomerMetrics?.openTasks || 0);
    const callMissRate = totalCalls > 0 ? (missedCalls / totalCalls) * 100 : 0;
    const communicationGap = (totalCalls === 0 && openTasks > 0) || callMissRate >= 35;
    const profitabilityLabel =
      monthlyBudget > 0
        ? monthlyConsumed > monthlyBudget
          ? `Negativ: ${formatHours(overrun)} Überzug`
          : `Stabil: ${formatHours(monthlyBudget - monthlyConsumed)} Rest`
        : revenueYtd > 0
          ? `Kein SLA-Budget, YTD ${formatEur(revenueYtd)}`
          : "Keine Profitabilitätsbasis";
    const slaLabel = !hasServiceContract
      ? "Kein Servicevertrag, kein SLA-Soll"
      : contractTimeBudget?.isOverrun
        ? `SLA-Verstoß: ${formatHours(overrun)} über Soll`
        : "SLA im Rahmen";
    const renewalLabel =
      contractControlStats.nextRenewalDays === null && contractControlStats.nextCancellationDeadlineDays === null
        ? "Keine Vertragsfälligkeit verfügbar"
        : contractControlStats.nextCancellationDeadlineDays !== null &&
          contractControlStats.nextCancellationDeadlineDays <= 0
          ? `Kündigungsfrist überschritten seit ${formatDate(contractControlStats.nextCancellationDeadlineAt)}. Bei Fristversäumnis automatische Verlängerung.`
          : contractControlStats.nextCancellationDeadlineDays !== null
            ? `Kündigungsfrist bis ${formatDate(contractControlStats.nextCancellationDeadlineAt)}${contractControlStats.nextRenewalAt ? ` · nächste Verlängerung ${formatDate(contractControlStats.nextRenewalAt)}` : ""}`
            : `Nächste Verlängerung in ${contractControlStats.nextRenewalDays} Tagen (${formatDate(contractControlStats.nextRenewalAt)})`;
    const nextAction =
      contractControlStats.missingIncludedHours > 0
        ? "Inklusivstunden in Serviceverträgen nachziehen."
        : hasServiceContract && contractTimeBudget?.isOverrun
          ? "SLA-Überzug mit Kunde abstimmen und Nachtrag anbieten."
          : contractControlStats.nextCancellationDeadlineDays !== null &&
            contractControlStats.nextCancellationDeadlineDays <= 30
            ? "Kündigungs-/Verlängerungsentscheidung mit Kunde terminieren."
          : contractControlStats.renewalsDueSoon > 0
            ? "Verlängerungsgespräch terminieren."
            : communicationGap
              ? "Kommunikationslücke schließen (Call + E-Mail Follow-up)."
      : contractControlStats.proposal > 0
                ? "Offene Vertragsvorschläge in aktiv überführen."
                : "Keine akute Eskalation.";
    return {
      profitabilityLabel,
      communicationLabel: `${missedCalls}/${totalCalls} verpasste Calls · ${openTasks} offene Aufgaben`,
      communicationGap,
      slaLabel,
      renewalLabel,
      nextAction
    };
  }, [selectedCustomerMetrics, contractTimeBudget, contractControlStats]);

  const fetchCustomerCommunication = async (customer, refresh = false) => {
    const customerId = Number(customer?.id || 0);
    if (!customerId) return { ...EMPTY_CUSTOMER_COMMUNICATION };
    const [developmentResult, callsResult] = await Promise.allSettled([
      api.getCustomerDevelopment(customerId, refresh),
      telephonyService.fetchCalls(800)
    ]);
    const developmentPayload =
      developmentResult.status === "fulfilled" &&
      developmentResult.value &&
      typeof developmentResult.value === "object" &&
      !Array.isArray(developmentResult.value) &&
      !developmentResult.value?.detail
        ? developmentResult.value
        : null;
    const emails = extractMetaHubEmailsFromContext(developmentPayload);
    const rawCalls =
      callsResult.status === "fulfilled" && Array.isArray(callsResult.value)
        ? callsResult.value
        : [];
    const calls = buildCustomerCallEntries(rawCalls, customer);
    return {
      customerId,
      emails,
      calls,
      loadedAt: Date.now(),
      metaHubAvailable: Boolean(developmentPayload),
      metaHubError: developmentResult.status === "rejected" || Boolean(developmentResult.value?.detail),
      telephonyError: callsResult.status === "rejected"
    };
  };

  const refreshCustomerCommunication = async (refresh = false) => {
    if (!editCustomer?.id) return;
    const expectedCustomerId = Number(editCustomer.id);
    setCommunicationStatus("loading");
    try {
      const payload = await fetchCustomerCommunication(editCustomer, refresh);
      if (Number(editCustomerId || 0) !== expectedCustomerId) return;
      setCustomerCommunication(payload);
      setCommunicationStatus("ready");
    } catch {
      if (Number(editCustomerId || 0) !== expectedCustomerId) return;
      setCustomerCommunication({
        ...EMPTY_CUSTOMER_COMMUNICATION,
        customerId: expectedCustomerId,
      });
      setCommunicationStatus("error");
    }
  };

  useEffect(() => {
    if (settingsTab !== "communication" || !editCustomer?.id) return;
    let active = true;
    setCommunicationStatus("loading");
    fetchCustomerCommunication(editCustomer, false)
      .then((payload) => {
        if (!active) return;
        setCustomerCommunication(payload);
        setCommunicationStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setCustomerCommunication({
          ...EMPTY_CUSTOMER_COMMUNICATION,
          customerId: Number(editCustomer.id || 0),
        });
        setCommunicationStatus("error");
      });
    return () => {
      active = false;
    };
  }, [settingsTab, editCustomer?.id]);

  const openPrepaidHoursPdfPreview = async () => {
    if (!editCustomer || !prepaidHoursSummary) return;
    let logoSrc = "";
    try {
      logoSrc = await getQtLogoDataUrl();
    } catch {
      logoSrc = "";
    }
    setPreviewModal({
      open: true,
      title: `Stundenkontingent ${editCustomer.name || "Kunde"}`,
      html: buildPrepaidHoursPdfHtml({
        customer: editCustomer,
        prepaidHoursSummary,
        logoSrc,
        generatedAt: Date.now()
      }),
      filename: buildPrepaidHoursPdfFilename(editCustomer)
    });
  };

  const downloadPreviewModalPdf = async () => {
    const html = String(previewModal?.html || "").trim();
    const filename = String(previewModal?.filename || "").trim();
    if (!html || !filename) return;
    setPreviewPdfBusy(true);
    try {
      const pdfBlob = await api.buildPdf(html, filename);
      downloadBlob(pdfBlob, filename);
    } catch {
      setToast("PDF-Erzeugung fehlgeschlagen.");
    } finally {
      setPreviewPdfBusy(false);
    }
  };

  const renderPrepaidHoursContainer = () => (
    <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/35 to-sky-100/35 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 rounded-xl border border-sky-200 bg-white p-1.5 text-sky-700">
            <WalletCards size={14} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-sky-700">Stundenkontingent</p>
            <p className="mt-0.5 text-[11px] text-sand-600">
              Käufe, Abbuchungen und Saldo in kompakter Ansicht.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPrepaidHoursPdfPreview}
            disabled={!prepaidHoursSummary || prepaidHoursStatus === "loading" || prepaidHoursStatus === "error"}
            className="rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Eye size={11} className="inline mr-1" />
            PDF Vorschau
          </button>
          <button
            type="button"
            onClick={() => setPrepaidHoursReloadTick((prev) => prev + 1)}
            className="rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
          >
            Aktualisieren
          </button>
        </div>
      </div>
      {prepaidHoursStatus === "loading" ? (
        <p className="mt-2 text-xs text-sand-500">Lade Stundenkontingent…</p>
      ) : null}
      {prepaidHoursStatus === "error" ? (
        <p className="mt-2 text-xs text-rose-600">Stundenkontingent konnte nicht geladen werden.</p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Gekauft</p>
          <p className="text-sm font-semibold text-sand-900">{formatHours(prepaidHoursSummary?.purchasedHours || 0)}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Abgebucht</p>
          <p className="text-sm font-semibold text-sand-900">{formatHours(prepaidHoursSummary?.debitedHours || 0)}</p>
        </div>
        <div
          className={`rounded-xl border px-3 py-2 ${
            prepaidHoursBalance < 0 ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Rest</p>
          <p className={`text-sm font-semibold ${prepaidHoursBalance < 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {formatHours(prepaidHoursBalance)}
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Buchungen</p>
          <p className="text-sm font-semibold text-sand-900">{prepaidHoursEntries.length}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="rounded-xl border border-sky-100 bg-white p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-sand-500">Kontingent erhöhen</p>
            <p className="text-[11px] text-sand-500">
              Neu: {formatHours(prepaidHoursBalance + prepaidHoursPurchaseValue)}
            </p>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-[96px_minmax(0,1fr)]">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Stunden</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={prepaidHoursPurchaseDraft.hours}
                onChange={(event) =>
                  setPrepaidHoursPurchaseDraft((prev) => ({ ...prev, hours: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Bezeichnung</span>
              <input
                value={prepaidHoursPurchaseDraft.label}
                onChange={(event) =>
                  setPrepaidHoursPurchaseDraft((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="z. B. 10h Paket März"
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-[150px_minmax(0,1fr)]">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Datum</span>
              <input
                type="date"
                value={prepaidHoursPurchaseDraft.effectiveAt}
                onChange={(event) =>
                  setPrepaidHoursPurchaseDraft((prev) => ({ ...prev, effectiveAt: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Notiz</span>
              <input
                value={prepaidHoursPurchaseDraft.note}
                onChange={(event) =>
                  setPrepaidHoursPurchaseDraft((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="optional"
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => createPrepaidHoursEntry("purchase")}
              disabled={prepaidHoursBusy || prepaidHoursPurchaseValue <= 0}
              className="rounded-full border border-sand-900 bg-sand-900 px-3 py-1.5 text-[10px] uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Stundenkauf speichern
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-sand-500">Kontingent abbuchen</p>
            <p className={`text-[11px] ${projectedPrepaidBalance < 0 ? "text-rose-700" : "text-sand-500"}`}>
              Saldo: {formatHours(projectedPrepaidBalance)}
            </p>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-[96px_140px_minmax(0,1fr)]">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Stunden</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={prepaidHoursDebitDraft.hours}
                onChange={(event) =>
                  setPrepaidHoursDebitDraft((prev) => ({ ...prev, hours: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Datum</span>
              <input
                type="date"
                value={prepaidHoursDebitDraft.effectiveAt}
                onChange={(event) =>
                  setPrepaidHoursDebitDraft((prev) => ({ ...prev, effectiveAt: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">Aufgabe</span>
                {selectedPrepaidTask ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPrepaidHoursDebitDraft((prev) => ({
                        ...prev,
                        hours: String(selectedPrepaidTask.remaining_hours || selectedPrepaidTask.elapsed_hours || "")
                      }))
                    }
                    className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                  >
                    Rest übernehmen
                  </button>
                ) : null}
              </div>
              <select
                value={prepaidHoursDebitDraft.taskId}
                onChange={(event) =>
                  setPrepaidHoursDebitDraft((prev) => ({ ...prev, taskId: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              >
                <option value="">Ohne Aufgabenbezug</option>
                {prepaidHoursTaskOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.title} · ${formatHours(item.elapsed_hours || 0)} · gebucht ${formatHours(
                      item.booked_hours || 0
                    )}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Bemerkung</span>
              <input
                value={prepaidHoursDebitDraft.note}
                onChange={(event) =>
                  setPrepaidHoursDebitDraft((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="wofür abgebucht wurde"
                className="mt-1 w-full rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => createPrepaidHoursEntry("debit")}
              disabled={prepaidHoursBusy || prepaidHoursDebitValue <= 0}
              className="self-end rounded-full border border-sand-900 bg-sand-900 px-3 py-1.5 text-[10px] uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Manuell abbuchen
            </button>
          </div>
          {selectedPrepaidTask ? (
            <div className="mt-2 rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-2 text-[11px] text-sand-600">
              <p className="font-semibold text-sand-800">{selectedPrepaidTask.title}</p>
              <p className="mt-0.5">
                Erfasst {formatHours(selectedPrepaidTask.elapsed_hours || 0)} · gebucht{" "}
                {formatHours(selectedPrepaidTask.booked_hours || 0)} · Rest{" "}
                {formatHours(selectedPrepaidTask.remaining_hours || 0)}
              </p>
              {selectedPrepaidTask.details ? <p className="mt-0.5">{selectedPrepaidTask.details}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wide text-sand-500">Letzte Buchungen</p>
            <span className="text-[11px] text-sand-500">{prepaidHoursEntries.length} gesamt</span>
          </div>
          <div className="mt-2 space-y-1.5 max-h-60 overflow-auto pr-1">
          {prepaidHoursEntries.map((entry) => (
            <div
              key={entry.id}
              className={`rounded-lg border px-2.5 py-2 ${
                entry.entry_type === "debit" ? "border-rose-200 bg-white" : "border-emerald-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        entry.entry_type === "debit"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {entry.entry_type_label}
                    </span>
                    <p className="text-sm font-semibold text-sand-900">{entry.label || "Buchung"}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-sand-500">
                    {formatDateTime(entry.effective_at || entry.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      entry.entry_type === "debit" ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {entry.entry_type === "debit" ? "-" : "+"}
                    {formatHours(entry.hours || 0)}
                  </p>
                  <button
                    type="button"
                    onClick={() => deletePrepaidHoursEntry(entry.id)}
                    className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-1.5 text-sand-500 hover:bg-sand-100"
                    title="Buchung löschen"
                    aria-label="Buchung löschen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {entry.task_title ? (
                <p className="mt-1 text-[11px] text-sand-700">
                  Aufgabe: {entry.task_title}
                  {entry.task_elapsed_hours > 0 ? ` · Erfasst ${formatHours(entry.task_elapsed_hours)}` : ""}
                </p>
              ) : null}
              {entry.note ? <p className="mt-1 text-[11px] text-sand-600">{entry.note}</p> : null}
            </div>
          ))}
          {!prepaidHoursEntries.length && prepaidHoursStatus !== "loading" ? (
            <p className="text-xs text-sand-500">Noch keine Buchungen vorhanden.</p>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContractListItem = (item) => {
    const status = String(item?.status || "active").toLowerCase();
    const monthlyHoursIncluded = Number(item?.monthly_hours_included || 0);
    const pricing = item?.pricing && typeof item.pricing === "object" ? item.pricing : {};
    const counts = item?.counts && typeof item.counts === "object" ? item.counts : {};
    const monthlyTotal = Number(pricing?.monthly_total || 0);
    const suggestedMonthlyTotal = Number(pricing?.suggested_monthly_total || 0);
    const hasPricing = monthlyTotal > 0 || suggestedMonthlyTotal > 0;
    const pricingDiff = Number((monthlyTotal - suggestedMonthlyTotal).toFixed(2));
    const timeline = contractTimelineFromItem(item);
    const cancellationDeadlineDays = daysUntilTimestamp(timeline.cancellationDeadlineAt);
    const renewalDays = daysUntilTimestamp(timeline.nextRenewalAt);
    const cancelledEffectiveDays = daysUntilTimestamp(timeline.cancelledEffectiveAt);
    const isCancelled = status === "cancelled";
    const badgeClass =
      isCancelled
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : status === "proposal"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
    const label = isCancelled ? "Gekündigt" : status === "proposal" ? "Vorschlag" : "Aktiv";
    return (
      <div key={item.id} className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sand-800">{item.title || "Vertrag"}</p>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${badgeClass}`}>{label}</span>
        </div>
        {monthlyHoursIncluded > 0 ? (
          <p className="mt-1 text-[11px] text-sand-600">Inklusivstunden: {formatHours(monthlyHoursIncluded)}</p>
        ) : null}
        {hasPricing ? (
          <div className="mt-1.5 rounded-lg border border-sand-200 bg-white px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold text-sand-800">
                Individualpreis: {formatEurPrecise(monthlyTotal || suggestedMonthlyTotal)}
                <span className="text-sand-500"> / Monat</span>
              </p>
              {Math.abs(pricingDiff) >= 0.01 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                  Vorschlag {formatEurPrecise(suggestedMonthlyTotal)}
                </span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">
                  Preis entspricht Vorschlag
                </span>
              )}
            </div>
            {(Number(counts?.servers || 0) > 0 ||
              Number(counts?.clients || 0) > 0 ||
              Number(counts?.network_devices || 0) > 0 ||
              Number(counts?.iot_devices || 0) > 0) ? (
              <p className="mt-1 text-[11px] text-sand-600">
                Bestand: {Number(counts?.servers || 0)} Server · {Number(counts?.clients || 0)} Clients ·{" "}
                {Number(counts?.network_devices || 0)} Netzwerk · {Number(counts?.iot_devices || 0)} IoT
              </p>
            ) : null}
          </div>
        ) : null}
        {cancellationDeadlineDays !== null && !isCancelled ? (
          <p className={`mt-1 text-[11px] ${cancellationDeadlineDays <= 14 ? "text-amber-700" : "text-sand-600"}`}>
            Kündigungsfrist: {formatDate(timeline.cancellationDeadlineAt)}{cancellationDeadlineDays <= 0 ? " (überschritten)" : ""}
          </p>
        ) : null}
        {renewalDays !== null && !isCancelled ? (
          <p className="mt-1 text-[11px] text-sand-600">
            Nächste Verlängerung: {formatDate(timeline.nextRenewalAt)} ({renewalDays} Tage)
          </p>
        ) : null}
        {isCancelled ? (
          <p className="mt-1 text-[11px] text-rose-700">
            Ende: {timeline.cancelledEffectiveAt ? formatDate(timeline.cancelledEffectiveAt) : "sofort"}
            {timeline.stopServiceImmediately ? " · Leistungsstopp sofort" : ""}
            {cancelledEffectiveDays !== null && cancelledEffectiveDays > 0 ? ` · Restlaufzeit ${cancelledEffectiveDays} Tage` : ""}
          </p>
        ) : null}
        {status === "proposal" ? (
          <p className="mt-1 text-[11px] text-amber-700">Kunde hat noch nicht eingewilligt. Als Vorschlag geführt.</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPreviewModal({
                open: true,
                title: item.title || "Vertrag",
                html: String(item.html_content || "<p>Keine Vorschau hinterlegt.</p>"),
                filename: ""
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
          >
            <Eye size={11} /> Vorschau
          </button>
          <button
            type="button"
            onClick={() => downloadContractDocument(item.id, item.file_name || "vertrag.pdf")}
            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
          >
            <FileDown size={11} /> {status === "proposal" ? "Vorschlag PDF" : status === "active" ? "Final PDF" : "PDF"}
          </button>
          {status === "cancelled" ? (
            <button
              type="button"
              onClick={() => reactivateContractDocument(item.id)}
              className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
            >
              Reaktivieren
            </button>
          ) : status === "proposal" ? (
            <>
              <button
                type="button"
                onClick={() => openContractProposalEditor(item)}
                className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
              >
                <Pencil size={11} /> Bearbeiten
              </button>
              <button
                type="button"
                onClick={() => reactivateContractDocument(item.id)}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-emerald-700 hover:bg-emerald-100"
              >
                Als aktiv markieren
              </button>
              <button
                type="button"
                onClick={() => cancelContractDocument(item.id)}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
              >
                Stornieren
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => markContractDocumentAsProposal(item.id)}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-amber-700 hover:bg-amber-100"
              >
                Als Vorschlag
              </button>
              <button
                type="button"
                onClick={() => cancelContractDocument(item.id)}
                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
              >
                Stornieren
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => deleteContractDocument(item.id)}
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
          >
            <Trash2 size={11} /> Löschen
          </button>
        </div>
      </div>
    );
  };

  const buildCustomerLicensePayload = (source) => ({
    vendor: String(source?.vendor || "").trim(),
    product_name: String(source?.product_name || "").trim(),
    quantity: Math.max(0, parseCount(source?.quantity || 0)),
    billing_cycle: String(source?.billing_cycle || "monthly").trim().toLowerCase() || "monthly",
    cost_eur: parseOptionalMoneyInput(source?.cost_eur) ?? 0,
    valid_until: String(source?.valid_until || "").trim(),
    status: String(source?.status || "active").trim().toLowerCase() === "inactive" ? "inactive" : "active",
    notes: String(source?.notes || "").trim()
  });

  const updateCustomerLicenseDraftField = (field, value) => {
    setCustomerLicenseDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateCustomerLicenseField = (licenseId, field, value) => {
    setCustomerLicenses((prev) =>
      prev.map((item) => (Number(item?.id || 0) === Number(licenseId) ? { ...item, [field]: value } : item))
    );
  };

  const handleCreateCustomerLicense = async () => {
    if (!editCustomer?.id) return;
    const payload = buildCustomerLicensePayload(customerLicenseDraft);
    if (!payload.vendor && !payload.product_name) {
      setToast("Bitte Hersteller oder Produkt angeben.");
      return;
    }
    setCustomerLicenseBusy("create");
    try {
      const created = await api.createCustomerLicense(editCustomer.id, payload);
      setCustomerLicenses((prev) => [created, ...prev]);
      setCustomerLicenseDraft(buildEmptyCustomerLicenseDraft());
    } catch (error) {
      setToast(error?.message ? String(error.message) : "Lizenz konnte nicht angelegt werden.");
    } finally {
      setCustomerLicenseBusy("");
    }
  };

  const saveCustomerLicense = async (licenseId) => {
    if (!editCustomer?.id || !licenseId) return;
    const current = customerLicenses.find((item) => Number(item?.id || 0) === Number(licenseId));
    if (!current) return;
    const payload = buildCustomerLicensePayload(current);
    if (!payload.vendor && !payload.product_name) {
      setToast("Bitte Hersteller oder Produkt angeben.");
      return;
    }
    setCustomerLicenseBusy(`save-${licenseId}`);
    try {
      const updated = await api.updateCustomerLicense(editCustomer.id, licenseId, payload);
      setCustomerLicenses((prev) =>
        prev.map((item) => (Number(item?.id || 0) === Number(licenseId) ? updated : item))
      );
    } catch (error) {
      setToast(error?.message ? String(error.message) : "Lizenz konnte nicht gespeichert werden.");
    } finally {
      setCustomerLicenseBusy("");
    }
  };

  const deleteCustomerLicense = async (licenseId) => {
    if (!editCustomer?.id || !licenseId) return;
    if (!window.confirm("Lizenz wirklich löschen?")) return;
    setCustomerLicenseBusy(`delete-${licenseId}`);
    try {
      await api.deleteCustomerLicense(editCustomer.id, licenseId);
      setCustomerLicenses((prev) => prev.filter((item) => Number(item?.id || 0) !== Number(licenseId)));
    } catch (error) {
      setToast(error?.message ? String(error.message) : "Lizenz konnte nicht gelöscht werden.");
    } finally {
      setCustomerLicenseBusy("");
    }
  };

  const renderCustomerLicensesTab = () => (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/40 to-sky-100/30 p-3.5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 rounded-xl border border-sky-200 bg-white p-2 text-sky-700">
              <WalletCards size={15} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Lizenzen</p>
              <p className="mt-1 text-[11px] text-sand-600">
                Einfache Pflege von Microsoft-, Veeam-, ESET- und SaaS-Lizenzen ohne komplexe Maske.
              </p>
            </div>
          </div>
          <div className="grid min-w-[220px] gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-sand-500">Aktiv</p>
              <p className="text-base font-semibold text-sand-900">{customerLicenseSummary.active}</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-sand-500">Monatswert</p>
              <p className="text-base font-semibold text-sand-900">
                {formatEurPrecise(customerLicenseSummary.monthlyEquivalent)}
              </p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-sand-500">Fällig ≤ 45T</p>
              <p className="text-base font-semibold text-sand-900">{customerLicenseSummary.dueSoonCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sand-500">Schnellerfassung</p>
            <p className="mt-1 text-[11px] text-sand-600">Hersteller, Produkt, Menge, Intervall und optional Ablauf/Kosten.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CUSTOMER_LICENSE_VENDOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => updateCustomerLicenseDraftField("vendor", preset)}
                className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[1.05fr_1.2fr_90px_120px_120px_120px]">
          <input
            value={customerLicenseDraft.vendor}
            onChange={(event) => updateCustomerLicenseDraftField("vendor", event.target.value)}
            placeholder="Hersteller, z. B. Microsoft"
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          />
          <input
            value={customerLicenseDraft.product_name}
            onChange={(event) => updateCustomerLicenseDraftField("product_name", event.target.value)}
            placeholder="Produkt, z. B. Microsoft 365 Business Premium"
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          />
          <input
            value={customerLicenseDraft.quantity}
            onChange={(event) => updateCustomerLicenseDraftField("quantity", event.target.value)}
            placeholder="Menge"
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          />
          <select
            value={customerLicenseDraft.billing_cycle}
            onChange={(event) => updateCustomerLicenseDraftField("billing_cycle", event.target.value)}
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          >
            {LICENSE_BILLING_CYCLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={customerLicenseDraft.cost_eur}
            onChange={(event) => updateCustomerLicenseDraftField("cost_eur", event.target.value)}
            placeholder="Kosten"
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={customerLicenseDraft.valid_until}
            onChange={(event) => updateCustomerLicenseDraftField("valid_until", event.target.value)}
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_140px]">
          <input
            value={customerLicenseDraft.notes}
            onChange={(event) => updateCustomerLicenseDraftField("notes", event.target.value)}
            placeholder="Kurznotiz, z. B. Tenant A / Nonprofit / Serverlizenz"
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          />
          <select
            value={customerLicenseDraft.status}
            onChange={(event) => updateCustomerLicenseDraftField("status", event.target.value)}
            className="rounded-xl border border-sand-200 px-3 py-2 text-sm"
          >
            {LICENSE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateCustomerLicense}
            disabled={customerLicenseBusy === "create"}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-sand-200 bg-sand-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} />
            Anlegen
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-sand-500">Bestand</p>
            <p className="mt-1 text-[11px] text-sand-600">
              {customerLicenseSummary.total
                ? `${customerLicenseSummary.total} Einträge. Änderungen direkt in der Liste vornehmen und speichern.`
                : "Noch keine Lizenzen für diesen Kunden hinterlegt."}
            </p>
          </div>
        </div>
        {customerLicensesStatus === "loading" ? <p className="mt-3 text-xs text-sand-500">Lade Lizenzen…</p> : null}
        {customerLicensesStatus === "error" ? (
          <p className="mt-3 text-xs text-rose-600">Lizenzen konnten nicht geladen werden.</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {customerLicenses.map((item) => (
            <div key={item.id} className="rounded-2xl border border-sand-200 bg-sand-50 p-2.5">
              <div className="grid gap-2 xl:grid-cols-[1fr_1.2fr_90px_120px_120px_120px_120px]">
                <input
                  value={item.vendor || ""}
                  onChange={(event) => updateCustomerLicenseField(item.id, "vendor", event.target.value)}
                  placeholder="Hersteller"
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={item.product_name || ""}
                  onChange={(event) => updateCustomerLicenseField(item.id, "product_name", event.target.value)}
                  placeholder="Produkt"
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  value={String(item.quantity ?? "")}
                  onChange={(event) => updateCustomerLicenseField(item.id, "quantity", event.target.value)}
                  placeholder="Menge"
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
                <select
                  value={String(item.billing_cycle || "monthly")}
                  onChange={(event) => updateCustomerLicenseField(item.id, "billing_cycle", event.target.value)}
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                >
                  {LICENSE_BILLING_CYCLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={String(item.cost_eur ?? "")}
                  onChange={(event) => updateCustomerLicenseField(item.id, "cost_eur", event.target.value)}
                  placeholder="Kosten"
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={item.valid_until || ""}
                  onChange={(event) => updateCustomerLicenseField(item.id, "valid_until", event.target.value)}
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
                <select
                  value={String(item.status || "active")}
                  onChange={(event) => updateCustomerLicenseField(item.id, "status", event.target.value)}
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                >
                  {LICENSE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={item.notes || ""}
                  onChange={(event) => updateCustomerLicenseField(item.id, "notes", event.target.value)}
                  placeholder="Notiz"
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-[11px] text-sand-500">
                    {formatLicenseBillingCycle(item.billing_cycle)} ·{" "}
                    {formatEurPrecise(calculateLicenseMonthlyEquivalent(item.cost_eur, item.billing_cycle))}/Monat
                  </span>
                  <button
                    type="button"
                    onClick={() => saveCustomerLicense(item.id)}
                    disabled={customerLicenseBusy === `save-${item.id}`}
                    className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCustomerLicense(item.id)}
                    disabled={customerLicenseBusy === `delete-${item.id}`}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] uppercase tracking-wide text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!customerLicenses.length && customerLicensesStatus === "ready" ? (
            <p className="text-xs text-sand-500">Noch keine Lizenzen hinterlegt.</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  const renderCustomerKpiTab = () => {
    const summaryCards = [
      {
        key: "month",
        icon: BarChart3,
        label: "Monat gesamt",
        value: formatHours(selectedMonthConsumedHours),
        detail: `${formatEurPrecise(selectedMonthConsumedRevenue)} · ${selectedMonthTaskCount} Aufgaben`,
        tone: "border-emerald-200 bg-emerald-50 text-emerald-700"
      },
      {
        key: "reachability",
        icon: Phone,
        label: "Erreichbarkeit 30T",
        value: `${thirtyDayAnsweredCalls}/${thirtyDayTotalCalls || 0}`,
        detail: `${thirtyDayMissRate}% Miss-Quote · ${thirtyDayMissedCalls} verpasst`,
        tone: thirtyDayMissedCalls > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-sky-200 bg-sky-50 text-sky-700"
      },
      {
        key: "open",
        icon: FileText,
        label: "Offene Aufgaben",
        value: formatNumber(selectedCustomerMetrics?.openTasks || 0),
        detail: `${formatHours(openEffortHours, 1)} offen · ${formatEurPrecise(selectedCustomerMetrics?.estimatedRevenueEur || 0)}`,
        tone: Number(selectedCustomerMetrics?.openTasks || 0) > 0 ? "border-sand-300 bg-sand-100 text-sand-800" : "border-sand-200 bg-sand-50 text-sand-700"
      },
      {
        key: "recurring",
        icon: WalletCards,
        label: "WKR / Monat",
        value: formatEurPrecise(sevdeskRecurringTagsSummary?.monthlyTotalEur || 0),
        detail: `${formatNumber(sevdeskRecurringTagsSummary?.invoiceCount || 0)} Vorlagen · ${formatNumber(sevdeskRecurringTagsSummary?.tagCount || 0)} Tags`,
        tone: "border-violet-200 bg-violet-50 text-violet-700"
      }
    ];

    return (
      <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">KPI</p>
            <p className="mt-1 text-[11px] text-sand-600">Monat, Kommunikation, Umsatz und Steuerung sauber getrennt.</p>
          </div>
          <button
            type="button"
            onClick={() => setMetricsReloadTick((prev) => prev + 1)}
            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] uppercase tracking-wide hover:bg-sand-100"
          >
            Aktualisieren
          </button>
        </div>
        {metricsStatus === "loading" ? (
          <p className="mt-3 text-xs text-sand-500">Lade Kennzahlen…</p>
        ) : null}
        {metricsStatus === "error" ? (
          <p className="mt-3 text-xs text-rose-600">Kennzahlen konnten nicht geladen werden.</p>
        ) : null}
        {metricsStatus === "ready" && selectedCustomerMetrics ? (
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.key} className="relative overflow-hidden rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-sand-400">{card.label}</p>
                        <p className="mt-2 text-2xl font-bold text-sand-900 leading-none">{card.value}</p>
                        <p className="mt-1.5 text-[11px] text-sand-500">{card.detail}</p>
                      </div>
                      <div className={`flex-shrink-0 rounded-xl border p-2.5 ${card.tone}`}>
                        <Icon size={16} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
              <div className="space-y-3">
                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Monatsbild</p>
                      <p className="mt-1 text-sm font-semibold text-sand-900">{selectedMonthLabel}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setKpiMonthOffset((prev) => Math.max(-120, prev - 1))}
                        disabled={!canShowOlderMonth || metricsStatus === "loading"}
                        className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Vorheriger Monat"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <div className="min-w-[9rem] rounded-full border border-sand-200 bg-white px-3 py-1 text-center text-[11px] font-semibold text-sand-900">
                        {selectedMonthLabel}
                      </div>
                      <button
                        type="button"
                        onClick={() => setKpiMonthOffset((prev) => Math.min(0, prev + 1))}
                        disabled={!canShowNewerMonth || metricsStatus === "loading"}
                        className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Nächster Monat"
                      >
                        <ChevronRight size={14} />
                      </button>
                      {selectedMonthOffset !== 0 ? (
                        <button
                          type="button"
                          onClick={() => setKpiMonthOffset(0)}
                          className="rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-50"
                        >
                          Aktuell
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
                          <BarChart3 size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Arbeitszeit</p>
                          <p className="text-sm font-semibold text-sand-900">{formatHours(selectedMonthTaskHours)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-sand-600">
                        {formatEurPrecise(selectedMonthTaskRevenue)} · {selectedMonthTaskCount} Aufgaben
                      </p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-sky-700">
                          <Phone size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Telefon</p>
                          <p className="text-sm font-semibold text-sand-900">{formatHours(selectedMonthTelephonyHours)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-sand-600">
                        {selectedMonthCallCount} Calls · {selectedMonthMissedCalls} verpasst ·{" "}
                        {selectedMonthTelephonyMinutes.toLocaleString("de-DE", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1
                        })} min
                      </p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-sand-300 bg-sand-100 p-2 text-sand-800">
                          <FileText size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Gesamtaufwand</p>
                          <p className="text-sm font-semibold text-sand-900">{formatHours(selectedMonthConsumedHours)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-sand-600">{formatEurPrecise(selectedMonthConsumedRevenue)}</p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700">
                          <Building2 size={14} />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Anfahrt</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {travelRoundTripKm > 0
                              ? `${travelRoundTripKm.toLocaleString("de-DE", {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1
                                })} km`
                              : "n/a"}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-sand-600">
                        {selectedCustomerMetrics.mileageEur !== null &&
                        typeof selectedCustomerMetrics.mileageEur !== "undefined"
                          ? `${formatEurPrecise(selectedCustomerMetrics.mileageEur)} Vorschlag`
                          : "kein Vorschlag"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Kommunikation 30 Tage</p>
                    <p className="text-[11px] font-medium text-sand-700">{thirtyDayMissRate}% Miss-Quote</p>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Calls</p>
                      <p className="mt-1 text-sm font-semibold text-sand-900">{thirtyDayTotalCalls}</p>
                      <p className="mt-1 text-[11px] text-sand-600">{thirtyDayAnsweredCalls} angenommen</p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Verpasst</p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">{thirtyDayMissedCalls}</p>
                      <p className="mt-1 text-[11px] text-sand-600">Erreichbarkeit im 30T-Fenster</p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Gesprächszeit</p>
                      <p className="mt-1 text-sm font-semibold text-sand-900">{formatHours(thirtyDayTalkHours, 1)}</p>
                      <p className="mt-1 text-[11px] text-sand-600">
                        {Number(selectedCustomerMetrics.totalMinutes || 0).toLocaleString("de-DE", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1
                        })} min
                      </p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Offene Aufgaben</p>
                      <p className="mt-1 text-sm font-semibold text-sand-900">{Number(selectedCustomerMetrics.openTasks || 0)}</p>
                      <p className="mt-1 text-[11px] text-sand-600">
                        {formatHours(openEffortHours, 1)} offen
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-sand-500">
                      <span>Antwortquote</span>
                      <span>
                        {thirtyDayAnsweredCalls} angenommen · {thirtyDayMissedCalls} verpasst
                      </span>
                    </div>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-sand-200">
                      {thirtyDayTotalCalls > 0 ? (
                        <>
                          <div
                            className="bg-emerald-500"
                            style={{ width: `${(thirtyDayAnsweredCalls / thirtyDayTotalCalls) * 100}%` }}
                          />
                          <div
                            className="bg-rose-400"
                            style={{ width: `${(thirtyDayMissedCalls / thirtyDayTotalCalls) * 100}%` }}
                          />
                        </>
                      ) : (
                        <div className="w-full bg-sand-300" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Zeitraumvergleich</p>
                    <div className="flex flex-wrap items-center gap-1">
                      {["currentYear", "lastYear"].map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCustomerStatsPeriod(key)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${
                            customerStatsPeriod === key
                              ? "border-sand-900 bg-sand-900 text-white"
                              : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50"
                          }`}
                        >
                          {periodStats?.[key]?.label || (key === "currentYear" ? "Lfd. Jahr" : "Vorjahr")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Arbeitszeit</p>
                      <p className="mt-1 text-sm font-semibold text-sand-900">
                        {selectedPeriodStats?.workHours === null || typeof selectedPeriodStats?.workHours === "undefined"
                          ? "n/a"
                          : formatHours(selectedPeriodStats.workHours)}
                      </p>
                      <p className="mt-1 text-[11px] text-sand-600">
                        {selectedPeriodStats?.workRevenueEur === null ||
                        typeof selectedPeriodStats?.workRevenueEur === "undefined"
                          ? "n/a"
                          : formatEurPrecise(selectedPeriodStats.workRevenueEur)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Material</p>
                      <p className="mt-1 text-sm font-semibold text-sand-900">
                        {selectedPeriodStats?.materialRevenueEur === null ||
                        typeof selectedPeriodStats?.materialRevenueEur === "undefined"
                          ? "n/a"
                          : formatEurPrecise(selectedPeriodStats.materialRevenueEur)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Gesamtumsatz</p>
                      <p className="mt-1 text-sm font-semibold text-sand-900">
                        {selectedPeriodStats?.totalRevenueEur === null ||
                        typeof selectedPeriodStats?.totalRevenueEur === "undefined"
                          ? "n/a"
                          : formatEurPrecise(selectedPeriodStats.totalRevenueEur)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-sand-600">
                    {selectedPeriodStats?.invoiceCount
                      ? `${selectedPeriodStats.invoiceCount} bezahlte sevdesk-Rechnungen im Zeitraum.`
                      : "Keine bezahlten sevdesk-Rechnungen im Zeitraum."}
                  </p>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Wiederkehrende Rechnungen</p>
                    <p className="text-[11px] text-sand-500">
                      {formatNumber(sevdeskRecurringTagsSummary?.invoiceCount || 0)} Vorlagen
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(sevdeskRecurringTagTotals.length ? sevdeskRecurringTagTotals.slice(0, 5) : [null]).map((entry, index) =>
                      entry ? (
                        <div
                          key={entry.tagId || entry.tagName || index}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-semibold text-sand-900">{entry.tagName || "Ohne Tag"}</p>
                            <p className="text-[11px] text-sand-500">{formatNumber(entry.invoiceCount || 0)} Vorlagen</p>
                          </div>
                          <p className="text-sm font-semibold text-sand-900">{formatEurPrecise(entry.monthlyEur || 0)}</p>
                        </div>
                      ) : (
                        <p key="empty-recurring" className="text-[11px] text-sand-500">
                          Keine getaggten wiederkehrenden Rechnungen in sevdesk gefunden.
                        </p>
                      )
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-sand-500">Steuerung</p>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Profitabilität</p>
                      <p className="mt-1 text-[12px] text-sand-800">{customerSteering.profitabilityLabel}</p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">Kommunikation</p>
                      <p className={`mt-1 text-[12px] ${customerSteering.communicationGap ? "text-amber-700" : "text-sand-800"}`}>
                        {customerSteering.communicationLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-sand-200 bg-white p-3">
                      <p className="text-[10px] uppercase tracking-wide text-sand-500">SLA & Vertrag</p>
                      <p
                        className={`mt-1 text-[12px] ${
                          contractTimeBudget?.hasServiceContract && contractTimeBudget?.isOverrun
                            ? "text-rose-700"
                            : "text-sand-800"
                        }`}
                      >
                        {customerSteering.slaLabel}
                      </p>
                      <p className={`mt-1 text-[12px] ${contractControlStats.renewalsDueSoon ? "text-amber-700" : "text-sand-600"}`}>
                        {customerSteering.renewalLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-sand-900 bg-sand-900 p-3 text-white">
                      <p className="text-[10px] uppercase tracking-wide text-white/70">Nächste Aktion</p>
                      <p className="mt-1 text-sm font-semibold">{customerSteering.nextAction}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {metricsStatus === "ready" && !selectedCustomerMetrics ? (
          <p className="mt-3 text-xs text-sand-500">Keine Kennzahlen für diesen Kunden verfügbar.</p>
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    setKpiMonthOffset(0);
  }, [metricsCustomerId]);

  useEffect(() => {
    if (!metricsCustomerId) {
      setMetrics(null);
      setMetricsStatus("idle");
      return;
    }
    let active = true;
    setMetricsStatus("loading");
    api
      .getCustomerMetrics(metricsCustomerId, kpiMonthOffset)
      .then((data) => {
        if (!active) return;
        setMetrics(data);
        setMetricsStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setMetrics(null);
        setMetricsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [kpiMonthOffset, metricsCustomerId, metricsReloadTick]);

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
        html: renderReportHTML(normalized),
        filename: ""
      });
    } catch (error) {
      setPreviewModal({
        open: true,
        title: "Bericht",
        html: "<p>Vorschau konnte nicht geladen werden.</p>",
        filename: ""
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
      html: renderDeliveryHtml(note),
      filename: ""
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

  const renderContractCalculationContent = () => {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-sand-200 bg-gradient-to-br from-white via-sand-50 to-sand-100 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Schnellstart</p>
              <h4 className="mt-1 text-lg font-semibold text-sand-900">
                {editingContractId ? "Vertragsvorschlag aktualisieren" : "Neuen Vertrag einfacher anlegen"}
              </h4>
              <p className="mt-1 text-sm text-sand-600">
                Template, Preisvorschlag und Startdatum prüfen. Titel, Preis und Standardlaufzeit werden automatisch vorbelegt.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setContractAdvancedOpen((prev) => !prev)}
              className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              {contractAdvancedOpen ? "Weniger anzeigen" : "Erweiterte Felder"}
            </button>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <span className="text-[10px] uppercase tracking-wide text-sand-500">1) Template</span>
              <div className="mt-1.5 grid gap-2 md:grid-cols-3">
                {contractTemplateOptions.map((option) => {
                  const active = activeContractTemplate?.key === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => applyContractTemplateChange(option.key)}
                      className={`rounded-2xl border px-3 py-3 text-left ${
                        active
                          ? "border-sand-900 bg-sand-900 text-white"
                          : "border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide">{option.title}</p>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                            active ? "border-white/30 text-white" : "border-sand-200 text-sand-500"
                          }`}
                        >
                          {contractTypeLabel(option.docType)}
                        </span>
                      </div>
                      <p className={`mt-1 text-xs ${active ? "text-sand-200" : "text-sand-500"}`}>
                        {option.description || "Ohne Kurzbeschreibung"}
                      </p>
                      {!option.hasBodyTemplate ? (
                        <p className={`mt-2 text-[10px] ${active ? "text-amber-200" : "text-amber-700"}`}>
                          Template ohne Inhalt
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">2) Preisvorlage</span>
                <select
                  value={calcInput.tariffId || ""}
                  onChange={(event) =>
                    setCalcInput((prev) => ({ ...prev, tariffId: Number(event.target.value) || null }))
                  }
                  disabled={!tariffRequired}
                  className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    {tariffRequired
                      ? `Preisvorlage für ${contractTypeLabel(activeContractBaseType)} wählen`
                      : "Für AVV / DSGVO nicht erforderlich"}
                  </option>
                  {filteredActiveTariffs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">3) Gültig ab</span>
                <input
                  type="date"
                  value={contractDraft.validFrom}
                  onChange={(event) => setContractDraft((prev) => ({ ...prev, validFrom: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">Titel</span>
                <button
                  type="button"
                  onClick={() => {
                    setContractDraft((prev) => ({ ...prev, title: autoContractTitle }));
                    setContractTitleAuto(true);
                  }}
                  className="rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                >
                  Auto-Titel
                </button>
              </div>
              <input
                value={contractDraft.title}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setContractDraft((prev) => ({ ...prev, title: nextValue }));
                  setContractTitleAuto(String(nextValue || "").trim() === autoContractTitle);
                }}
                className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                placeholder={autoContractTitle}
              />
            </label>
            {editableContractVariables.length ? (
              <div className="rounded-xl border border-sand-200 bg-sand-50 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-sand-500">Vertragsinhalte</p>
                    <p className="mt-1 text-[11px] text-sand-600">
                      Vertragsdetails und kundenbezogene Angaben direkt hier anpassen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setContractVariableValues(buildEditableContractVariableValues(contractVariableDefinitions));
                      setGeneratedContract(null);
                    }}
                    className="rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                  >
                    Standardwerte laden
                  </button>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {editableContractVariables.map((item) => (
                    <label key={item.key} className="block">
                      <span className="text-[10px] uppercase tracking-wide text-sand-500">
                        {item.label}
                        <span className="ml-1 text-sand-400">({item.key})</span>
                      </span>
                      <input
                        value={String(contractVariableValues[item.key] ?? "")}
                        onChange={(event) => {
                          setContractVariableValues((prev) => ({
                            ...prev,
                            [item.key]: event.target.value
                          }));
                          setGeneratedContract(null);
                        }}
                        placeholder={item.suggestedValue || "-"}
                        className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            {supportsHoursBudget ? (
              <label className="block md:max-w-xs">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">Inklusivstunden / Monat</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={contractDraft.monthlyHoursIncluded}
                  onChange={(event) =>
                    setContractDraft((prev) => ({ ...prev, monthlyHoursIncluded: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-sand-600">
              <span className="rounded-full border border-sand-200 bg-white px-2.5 py-1">
                Laufzeit {runtimeMonthsValue} Mon.
              </span>
              <span className="rounded-full border border-sand-200 bg-white px-2.5 py-1">
                Kündigungsfrist {terminationNoticeMonthsValue} Mon.
              </span>
              <span className="rounded-full border border-sand-200 bg-white px-2.5 py-1">
                Verlängerung {autoExtensionMonthsValue} Mon.
              </span>
              <span className="rounded-full border border-sand-200 bg-white px-2.5 py-1">
                {contractTitleAuto ? "Titel automatisch" : "Titel manuell"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {tariffSelectionMissing ? (
                <span className="text-rose-600">Wartungs- und Monitoringverträge benötigen eine Preisvorlage.</span>
              ) : null}
              {contractRuntimeInvalid ? (
                <span className="text-rose-600">Kündigungsfrist darf die Laufzeit nicht überschreiten.</span>
              ) : null}
              {contractTariffsStatus === "loading" ? <span className="text-sand-500">Lade Tarife…</span> : null}
              {contractTariffsStatus === "error" ? (
                <span className="text-rose-600">Tarife konnten nicht geladen werden.</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Bestand</p>
              <p className="mt-1 text-sm text-sand-600">
                Geräteanzahl direkt aus Meta-Hub übernehmen oder manuell anpassen.
              </p>
            </div>
            <button
              type="button"
              onClick={importCalcValuesFromRmm}
              className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[10px] uppercase tracking-wide hover:bg-sand-100"
            >
              Aus RMM/Discovery übernehmen
            </button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Server</span>
              <input
                value={calcInput.servers}
                onChange={(event) => setCalcInput((prev) => ({ ...prev, servers: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Clients</span>
              <input
                value={calcInput.clients}
                onChange={(event) => setCalcInput((prev) => ({ ...prev, clients: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">Netzwerkgeräte</span>
              <input
                value={calcInput.networkDevices}
                onChange={(event) => setCalcInput((prev) => ({ ...prev, networkDevices: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">IoT</span>
              <input
                value={calcInput.iotDevices}
                onChange={(event) => setCalcInput((prev) => ({ ...prev, iotDevices: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {calcImportStatus === "loading" ? (
              <span className="text-xs text-sand-500">Importiere aus Meta-Hub…</span>
            ) : null}
            {calcImportStatus === "done" ? (
              <span className="text-xs text-emerald-600">Werte übernommen</span>
            ) : null}
            {calcImportStatus === "empty" ? (
              <span className="text-xs text-amber-700">Keine Meta-Hub Infrastrukturdaten gefunden</span>
            ) : null}
            {calcImportStatus === "error" ? (
              <span className="text-xs text-rose-600">Meta-Hub Import fehlgeschlagen</span>
            ) : null}
          </div>
        </div>

        {contractAdvancedOpen ? (
          <div className="rounded-2xl border border-sand-200 bg-white p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Erweitert</p>
                <p className="mt-1 text-sm text-sand-600">
                  Laufzeit und individuelle Vertragsvariablen nur bei Bedarf anpassen.
                </p>
              </div>
              <span className="text-[11px] text-sand-500">
                Grundlage: {selectedTariff ? selectedTariff.name : tariffRequired ? "Preisvorlage fehlt" : "Ohne Tarif"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">Laufzeit (Monate)</span>
                <input
                  type="number"
                  min="1"
                  value={contractDraft.runtimeMonths}
                  onChange={(event) =>
                    setContractDraft((prev) => ({ ...prev, runtimeMonths: event.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">
                  Kündigungsfrist (Monate)
                </span>
                <input
                  type="number"
                  min="0"
                  value={contractDraft.terminationNoticeMonths}
                  onChange={(event) =>
                    setContractDraft((prev) => ({
                      ...prev,
                      terminationNoticeMonths: event.target.value
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-sand-500">
                  Auto-Verlängerung (Monate)
                </span>
                <input
                  type="number"
                  min="1"
                  value={contractDraft.autoExtensionMonths}
                  onChange={(event) =>
                    setContractDraft((prev) => ({
                      ...prev,
                      autoExtensionMonths: event.target.value
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-sand-200 bg-white p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Preis & Aktion</p>
              <p className="mt-1 text-sm text-sand-600">
                {tariffRequired
                  ? "Der Tarif liefert den Vorschlag. Gespeichert wird immer dein individueller Preis."
                  : "AVV / DSGVO wird ohne Tarif kalkuliert."}
              </p>
            </div>
            <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-[11px] text-sand-600">
              {contractTypeLabel(activeContractBaseType)}
            </span>
          </div>
          <div
            className={`mt-3 grid gap-2 ${
              supportsHoursBudget ? "md:grid-cols-3" : "md:grid-cols-2"
            }`}
          >
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700">Individualpreis pro Monat</p>
              <p className="text-base font-semibold text-emerald-900">{formatEurPrecise(contractTotals.monthly)}</p>
              <p className="mt-1 text-[11px] text-emerald-800">
                Vorschlag: {formatEurPrecise(contractTotals.monthlyAuto)}
                {contractTotals.monthlyOverridden
                  ? ` · Abweichung ${formatEurPrecise(Math.abs(contractTotals.monthlyDelta))}`
                  : " · entspricht Vorschlag"}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-emerald-700">Individualpreis pro Jahr</p>
              <p className="text-base font-semibold text-emerald-900">{formatEurPrecise(contractTotals.yearly)}</p>
              <p className="mt-1 text-[11px] text-emerald-800">
                Vorschlag: {formatEurPrecise(contractTotals.yearlyAuto)}
                {contractTotals.yearlyOverridden
                  ? ` · Abweichung ${formatEurPrecise(Math.abs(contractTotals.yearlyDelta))}`
                  : " · entspricht Vorschlag"}
              </p>
            </div>
            {supportsHoursBudget ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-sky-700">Stundenbudget / Monat</p>
                <p className="text-base font-semibold text-sky-900">{formatHours(monthlyHoursIncluded)}</p>
                <p className="mt-1 text-[11px] text-sky-800">
                  Stundensatz {formatEurPrecise(contractTotals.hourlyRate)} · Anteil{" "}
                  {formatEurPrecise(contractTotals.hourlyMonthly)}
                </p>
              </div>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">
                Individualpreis pro Monat
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={contractDraft.monthlyTotalOverride}
                onChange={(event) => {
                  setContractDraft((prev) => ({ ...prev, monthlyTotalOverride: event.target.value }));
                  setContractPriceTouched((prev) => ({ ...prev, monthly: true }));
                }}
                placeholder={`Vorschlag: ${formatEurPrecise(contractTotals.monthlyAuto)}`}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wide text-sand-500">
                Individualpreis pro Jahr
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={contractDraft.yearlyTotalOverride}
                onChange={(event) => {
                  setContractDraft((prev) => ({ ...prev, yearlyTotalOverride: event.target.value }));
                  setContractPriceTouched((prev) => ({ ...prev, yearly: true }));
                }}
                placeholder={`Vorschlag: ${formatEurPrecise(contractTotals.yearlyAuto)}`}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-sand-500">
            {tariffRequired
              ? `Gesamtpreis = Grund-/Gerätepreise (${formatEurPrecise(contractTotals.tariffMonthly)}) + Stundenbudget (${formatHours(
                  monthlyHoursIncluded
                )}) x Stundensatz (${formatEurPrecise(contractTotals.hourlyRate)}).`
              : "AVV/DSGVO: kein Tarif erforderlich."}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setContractPriceTouched({ monthly: false, yearly: false });
                setContractDraft((prev) => ({
                  ...prev,
                  monthlyTotalOverride: "",
                  yearlyTotalOverride: ""
                }));
              }}
              disabled={!contractPriceTouched.monthly && !contractPriceTouched.yearly}
              className="rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Preisvorschlag übernehmen
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => saveGeneratedContract()}
              disabled={contractGenerationBlocked}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-sand-900 px-3 py-1.5 text-[11px] uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <BadgeCheck size={12} />
              {editingContractId ? "Vorschlag aktualisieren" : "Direkt als Vorschlag speichern"}
            </button>
            <button
              type="button"
              onClick={() => generateContractPreview(true)}
              disabled={contractGenerationBlocked}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye size={12} />
              Vorschau öffnen
            </button>
            <button
              type="button"
              onClick={exportGeneratedContractPdf}
              disabled={contractGenerationBlocked}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileDown size={12} />
              PDF laden
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {contractPreviewStatus === "saving" ? (
              <span className="text-xs text-sand-500">Erzeuge Vorschau…</span>
            ) : null}
            {contractPreviewStatus === "saved" ? (
              <span className="text-xs text-emerald-600">Vorschau aktualisiert</span>
            ) : null}
            {contractPreviewStatus === "error" ? (
              <span className="text-xs text-rose-600">Vorschau fehlgeschlagen</span>
            ) : null}
            {contractSaveStatus === "saving" ? (
              <span className="text-xs text-sand-500">Speichere Vertrag…</span>
            ) : null}
            {contractSaveStatus === "saved" ? (
              <span className="text-xs text-emerald-600">Vertrag gespeichert</span>
            ) : null}
            {contractSaveStatus === "error" ? (
              <span className="text-xs text-rose-600">Speichern fehlgeschlagen</span>
            ) : null}
            {Array.isArray(generatedContract?.meta?.unresolved_placeholders) &&
            generatedContract.meta.unresolved_placeholders.length ? (
              <span className="text-xs text-amber-700">
                Unbekannte Template-Variablen: {generatedContract.meta.unresolved_placeholders.join(", ")}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-sand-50">
      {toast ? (
        <div className="fixed top-5 right-6 z-50 bg-sand-900 text-white text-xs uppercase tracking-wide px-4 py-2 rounded-full shadow-soft">
          {toast}
        </div>
      ) : null}
      {previewModal.open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-5xl rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Vorschau</p>
                <h3 className="text-lg font-display">{previewModal.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {previewModal.filename ? (
                  <button
                    type="button"
                    onClick={downloadPreviewModalPdf}
                    disabled={previewPdfBusy}
                    className="rounded-full border border-sand-200 bg-sand-900 px-3 py-1 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {previewPdfBusy ? "PDF…" : "PDF laden"}
                  </button>
                ) : null}
                <button
                  onClick={() => setPreviewModal({ open: false, title: "", html: "", filename: "" })}
                  className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  Schließen
                </button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6 bg-sand-50">
              <div className="bg-white border border-sand-200 rounded-2xl p-4">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewModal.html) }} />
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
      {editCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-3 py-3 md:px-4 md:py-6">
          <div className="h-[94vh] w-[96vw] max-w-[1440px] rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-100 text-sm font-bold text-sand-700 select-none">
                  {(editCustomer.name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("")}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">Kunde bearbeiten</p>
                  <h3 className="text-base font-display text-sand-900 leading-tight">{editCustomer.name || "Kunde"}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRemove(editCustomer.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 size={12} />
                  Löschen
                </button>
                <button
                  onClick={() => setEditCustomerId(null)}
                  className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                >
                  <X size={12} />
                  Schließen
                </button>
              </div>
            </div>
            <div className="border-b border-sand-200 bg-sand-50/50 px-2 overflow-x-auto">
              <div className="flex items-end min-w-max">
                {[
                  { key: "details", icon: Building2, label: "Stammdaten" },
                  { key: "kpi", icon: BarChart3, label: "KPI" },
                  { key: "communication", icon: Mail, label: "Kommunikation" },
                  { key: "contracts", icon: FileDown, label: "Verträge" },
                  { key: "licenses", icon: WalletCards, label: "Lizenzen" },
                  { key: "inventory", icon: Boxes, label: "Inventar" },
                ].map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSettingsTab(key)}
                    className={`inline-flex items-center gap-1.5 px-4 py-3 text-[11px] uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap ${
                      settingsTab === key
                        ? "border-sand-900 text-sand-900 font-semibold"
                        : "border-transparent text-sand-500 hover:text-sand-700 hover:border-sand-300"
                    }`}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[calc(94vh-132px)] overflow-y-auto p-4 bg-sand-50">
              {settingsTab === "details" ? (
                <>
              <div className="mb-2">
                <p className="text-xs uppercase tracking-[0.25em] text-sand-500">Stammdaten</p>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-sand-500">Name</span>
                  <input
                    value={editCustomer.name}
                    onChange={(event) => updateCustomer(editCustomer.id, { name: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-sand-500">Kundennummer</span>
                  <input
                    value={editCustomer.creditorNumber}
                    onChange={(event) => updateCustomer(editCustomer.id, { creditorNumber: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-sand-500">sevDesk Kontakt-ID</span>
                  <input
                    value={editCustomer.sevdeskContactId}
                    onChange={(event) => updateCustomer(editCustomer.id, { sevdeskContactId: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                    placeholder="z. B. 12345678"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-sand-500">Kürzel</span>
                  <input
                    value={editCustomer.shortCode}
                    onChange={(event) => updateCustomer(editCustomer.id, { shortCode: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block md:col-span-3">
                  <span className="text-xs uppercase tracking-wide text-sand-500">Haupt-E-Mail</span>
                  <input
                    type="email"
                    value={editCustomer.email}
                    onChange={(event) => updateCustomer(editCustomer.id, { email: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                    placeholder="kunde@example.com"
                  />
                </label>
                <div className="md:col-span-3 rounded-2xl border border-sand-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-sand-500">Kommunikation & Allgemeine Adresse</p>
                      <p className="mt-1 text-xs text-sand-500">
                        Optionale separate E-Mail für Newsletter und ähnliche Aussendungen. Wenn leer, wird die Haupt-E-Mail verwendet. Die Postadresse darunter bleibt die allgemeine Kontaktadresse.
                      </p>
                    </div>
                    <Mail size={16} className="mt-0.5 text-sand-400" />
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className="text-xs uppercase tracking-wide text-sand-500">Newsletter-/Kommunikations-E-Mail</span>
                      <input
                        type="email"
                        value={editCustomer.newsletterEmail}
                        onChange={(event) => updateCustomer(editCustomer.id, { newsletterEmail: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                        placeholder="optional, z. B. marketing@example.com"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-xs uppercase tracking-wide text-sand-500">Straße</span>
                      <input
                        value={editCustomer.generalStreet}
                        onChange={(event) => updateCustomer(editCustomer.id, { generalStreet: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-sand-500">PLZ</span>
                      <input
                        value={editCustomer.generalPostalCode}
                        onChange={(event) => updateCustomer(editCustomer.id, { generalPostalCode: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-sand-500">Ort</span>
                      <input
                        value={editCustomer.generalCity}
                        onChange={(event) => updateCustomer(editCustomer.id, { generalCity: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-xs uppercase tracking-wide text-sand-500">Land</span>
                      <input
                        value={editCustomer.generalCountry}
                        onChange={(event) => updateCustomer(editCustomer.id, { generalCountry: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-1.5 text-sm text-sand-700">
                  <input
                    type="checkbox"
                    checked={Boolean(editCustomer.customerReport)}
                    onChange={(event) => updateCustomer(editCustomer.id, { customerReport: event.target.checked })}
                    className="h-4 w-4"
                  />
                  Kundenbericht
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-1.5 text-sm text-sand-700">
                  <input
                    type="checkbox"
                    checked={Boolean(editCustomer.newsletter)}
                    onChange={(event) => updateCustomer(editCustomer.id, { newsletter: event.target.checked })}
                    className="h-4 w-4"
                  />
                  Newsletter
                </label>
                <label className="block rounded-xl border border-sand-200 bg-white px-3 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-sand-500">Kundenstatus</span>
                  <select
                    value={String(editCustomer.status || "active")}
                    onChange={(event) => updateCustomer(editCustomer.id, { status: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-sand-200 px-2 py-1 text-sm"
                  >
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv</option>
                  </select>
                </label>
              </div>
              <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Rechnungsadresse (sevDesk)</p>
                    <p className="mt-1 text-xs text-sky-700/80">
                      Wird aus sevDesk synchronisiert und als Hauptadresse verwendet, wenn keine allgemeine Adresse gepflegt ist.
                    </p>
                  </div>
                  <Building2 size={16} className="mt-0.5 text-sky-700" />
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-sky-700/70">Rechnungs-E-Mail</p>
                    <p className="mt-1 text-sm text-slate-800">
                      {editCustomer.billingEmail || "Keine Rechnungs-E-Mail aus sevDesk"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-sky-700/70">Adressquelle</p>
                    <p className="mt-1 text-sm text-slate-800">
                      {editCustomer.primaryAddressSource === "billing"
                        ? "Aktuell ist die Rechnungsadresse zugleich Hauptadresse."
                        : "Allgemeine Adresse überschreibt die Rechnungsadresse."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-sky-100 bg-white/80 px-3 py-2 md:col-span-2">
                    <p className="text-[10px] uppercase tracking-wide text-sky-700/70">Rechnungsanschrift</p>
                    {hasCustomerAddress({
                      street: editCustomer.billingStreet,
                      postalCode: editCustomer.billingPostalCode,
                      city: editCustomer.billingCity,
                      country: editCustomer.billingCountry
                    }) ? (
                      <div className="mt-1 space-y-0.5 text-sm text-slate-800">
                        {buildCustomerAddressLines({
                          street: editCustomer.billingStreet,
                          postalCode: editCustomer.billingPostalCode,
                          city: editCustomer.billingCity,
                          country: editCustomer.billingCountry
                        }).map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-sand-500">Keine Rechnungsadresse aus sevDesk vorhanden.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 rounded-2xl border border-sand-200 bg-white p-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Rufnummern</p>
                  <button
                    type="button"
                    onClick={addPhone}
                    className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                  >
                    <Plus size={11} /> Neu
                  </button>
                </div>
                <div className="space-y-1.5">
                  {editCustomer.phones?.map((phone) => (
                    <div
                      key={phone.id}
                      className="grid items-center gap-1.5 md:grid-cols-[minmax(0,180px)_minmax(0,240px)_auto_auto_auto]"
                    >
                      <input
                        value={phone.label}
                        onChange={(event) => updatePhone(phone.id, { label: event.target.value })}
                        placeholder="z. B. Arbeit"
                        className="rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                      />
                      <input
                        value={phone.number}
                        onChange={(event) => updatePhone(phone.id, { number: event.target.value })}
                        placeholder="+49 40 123456"
                        className="rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
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
                </>
              ) : null}
              {settingsTab === "kpi" ? renderCustomerKpiTab() : null}
              {settingsTab === "communication" ? (
                <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Kommunikation</p>
                    <button
                      type="button"
                      onClick={() => refreshCustomerCommunication(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] uppercase tracking-wide hover:bg-sand-100"
                    >
                      Aktualisieren
                    </button>
                  </div>
                  {communicationStatus === "loading" ? (
                    <p className="text-xs text-sand-500">Lade Kommunikation aus Meta-Hub und Telefonie…</p>
                  ) : null}
                  {communicationStatus === "error" ? (
                    <p className="text-xs text-rose-600">Kommunikationsdaten konnten nicht geladen werden.</p>
                  ) : null}
                  {communicationStatus === "ready" ? (
                    <>
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">E-Mails (Meta-Hub)</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {Number(communicationEmailEntries.length || 0)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Telefonate (Telefonie-API)</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {Number(communicationCallEntries.length || 0)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Stand</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {communicationDataForEditCustomer.loadedAt
                              ? formatDateTime(communicationDataForEditCustomer.loadedAt)
                              : "n/a"}
                          </p>
                        </div>
                      </div>
                      {communicationDataForEditCustomer.metaHubError ? (
                        <p className="text-xs text-amber-700">
                          Meta-Hub-E-Mails konnten nicht vollständig geladen werden.
                        </p>
                      ) : null}
                      {communicationDataForEditCustomer.telephonyError ? (
                        <p className="text-xs text-amber-700">
                          Telefonie-API konnte nicht erreicht werden.
                        </p>
                      ) : null}
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-2.5">
                          <div className="mb-2 flex items-center gap-1.5 text-sand-700">
                            <Mail size={13} />
                            <p className="text-[11px] uppercase tracking-wide">E-Mail-Verlauf</p>
                          </div>
                          <div className="max-h-80 space-y-1.5 overflow-auto pr-1">
                            {communicationEmailEntries.length ? (
                              communicationEmailEntries.map((entry) => (
                                <div key={`${entry.id}-${entry.timestamp}`} className="rounded-lg border border-sand-200 bg-white px-2.5 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-semibold text-sand-900">{entry.subject || "(ohne Betreff)"}</p>
                                    <span className="text-[10px] text-sand-500">{formatDateTime(entry.timestamp)}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-sand-600">
                                    {entry.from || "n/a"} → {entry.to || "n/a"}
                                  </p>
                                  {entry.direction ? (
                                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-sand-500">
                                      {entry.direction === "incoming" ? "Eingehend" : "Ausgehend"}
                                    </p>
                                  ) : null}
                                  {entry.snippet ? <p className="mt-1 text-[11px] text-sand-700">{entry.snippet}</p> : null}
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-sand-500">Keine E-Mails im Meta-Hub-Snapshot gefunden.</p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-sand-200 bg-sand-50 p-2.5">
                          <div className="mb-2 flex items-center gap-1.5 text-sand-700">
                            <Phone size={13} />
                            <p className="text-[11px] uppercase tracking-wide">Telefonate</p>
                          </div>
                          <div className="max-h-80 space-y-1.5 overflow-auto pr-1">
                            {communicationCallEntries.length ? (
                              communicationCallEntries.map((entry) => (
                                <div key={`${entry.id}-${entry.timestamp}`} className="rounded-lg border border-sand-200 bg-white px-2.5 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-semibold text-sand-900">
                                      {entry.answered ? "Angenommen" : "Nicht angenommen"}
                                    </p>
                                    <span className="text-[10px] text-sand-500">{formatDateTime(entry.timestamp)}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-sand-600">
                                    {entry.from || "n/a"} → {entry.to || "n/a"}
                                  </p>
                                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-sand-500">
                                    {entry.direction || "n/a"} · Dauer {formatCallDuration(entry.duration)}
                                    {entry.extension ? ` · Nebenstelle ${entry.extension}` : ""}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-sand-500">Keine Telefonate für diesen Kunden gefunden.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              {settingsTab === "inventory" ? (
                <div className="mt-4">
                  <CustomerInventoryTab customerId={editCustomer.id} />
                </div>
              ) : null}
              {settingsTab === "licenses" ? renderCustomerLicensesTab() : null}
              {settingsTab === "contracts" ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 p-3.5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 rounded-xl border border-emerald-200 bg-white p-2 text-emerald-700">
                          <FileText size={15} />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-emerald-700">Verträge</p>
                          <p className="mt-1 text-[11px] text-sand-600">
                            Laufende Verträge, Laufzeiten und Vertragssteuerung.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={openContractCreator}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] uppercase tracking-wide hover:bg-sand-100"
                        >
                          <Plus size={12} />
                          Neuer Vertrag
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-2.5">
                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">Verlängerung</p>
                        <p className="text-sm font-semibold text-sand-900">{contractControlStats.renewalsDueSoon}</p>
                        <p className="text-[11px] text-sand-600">{"<= 45 Tage fällig"}</p>
                        </div>
                        <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">Laufzeit</p>
                        <p className="text-sm font-semibold text-sand-900">{contractControlStats.runtimeDaysAvg} Tage</p>
                        <p className="text-[11px] text-sand-600">Ø Vertragsalter</p>
                        </div>
                        <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">Tarifabweichung</p>
                        <p className="text-sm font-semibold text-sand-900">{contractControlStats.missingIncludedHours}</p>
                        <p className="text-[11px] text-sand-600">Servicevertrag ohne Inklusivstunden</p>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[11px] text-sand-600">
                        Nächste Verlängerung:{" "}
                        {contractControlStats.nextRenewalAt
                          ? `${formatDate(contractControlStats.nextRenewalAt)} (${contractControlStats.nextRenewalDays} Tage)`
                          : "n/a"}
                      </p>
                    </div>
                    {editHasHoursBudgetContract ? (
                      <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Stundenbudget (aktueller Monat)</p>
                          <span className="text-[11px] text-sand-500">{contractTimeBudget?.monthLabel || "Aktueller Monat"}</span>
                        </div>
                        {metricsStatus === "loading" ? (
                          <p className="mt-1.5 text-xs text-sand-500">Berechne Vertragsstunden…</p>
                        ) : null}
                        {metricsStatus === "error" ? (
                          <p className="mt-1.5 text-xs text-rose-600">Stundenbilanz konnte nicht geladen werden.</p>
                        ) : null}
                        {metricsStatus === "ready" && contractTimeBudget ? (
                          <>
                            <div className="mt-2 grid gap-2 md:grid-cols-4">
                              <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-sand-500">Inkludiert</p>
                                <p className="text-sm font-semibold text-sand-900">{formatHours(contractTimeBudget.includedHours)}</p>
                              </div>
                              <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-sand-500">Verbraucht</p>
                                <p className="text-sm font-semibold text-sand-900">{formatHours(contractTimeBudget.consumedHours)}</p>
                              </div>
                              <div
                                className={`rounded-lg border px-2.5 py-1.5 ${
                                  contractTimeBudget.isOverrun
                                    ? "border-rose-200 bg-rose-50"
                                    : "border-emerald-200 bg-emerald-50"
                                }`}
                              >
                                <p className="text-[10px] uppercase tracking-wide text-sand-500">
                                  {contractTimeBudget.isOverrun ? "Überzug" : "Rest"}
                                </p>
                                <p
                                  className={`text-sm font-semibold ${
                                    contractTimeBudget.isOverrun ? "text-rose-700" : "text-emerald-700"
                                  }`}
                                >
                                  {formatHours(
                                    contractTimeBudget.isOverrun
                                      ? contractTimeBudget.overrunHours
                                      : contractTimeBudget.remainingHours
                                  )}
                                </p>
                              </div>
                              <div className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5">
                                <p className="text-[10px] uppercase tracking-wide text-sand-500">Aufteilung</p>
                                <p className="text-sm font-semibold text-sand-900">
                                  Aufgabe {formatHours(contractTimeBudget.taskHours, 1)}
                                </p>
                                <p className="text-[11px] text-sand-600">
                                  Telefon {formatHours(contractTimeBudget.telephonyHours, 1)}
                                </p>
                              </div>
                            </div>
                            <p className="mt-2 text-[11px] text-sand-600">
                              Verbrauch aus {contractTimeBudget.taskCount || 0} Zeitaufgaben und {contractTimeBudget.callCount || 0} Telefonaten.
                            </p>
                            {contractTimeBudget.missingIncludedHours ? (
                              <p className="mt-1 text-[11px] text-amber-700">
                                Vertrag vorhanden, aber keine Inklusivstunden hinterlegt. Bitte im Vertragsdetail setzen.
                              </p>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {contractsStatus === "loading" ? <p className="mt-3 text-xs text-sand-500">Lade Verträge…</p> : null}
                    {contractsStatus === "error" ? <p className="mt-3 text-xs text-rose-600">Verträge konnten nicht geladen werden.</p> : null}
                    <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                      {(customerContracts || []).map((item) => renderContractListItem(item))}
                      {!customerContracts.length && contractsStatus !== "loading" ? (
                        <p className="text-xs text-sand-500">Noch keine Verträge für diesen Kunden.</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-white via-sky-50/40 to-sky-100/30 p-3.5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 rounded-xl border border-sky-200 bg-white p-2 text-sky-700">
                          <WalletCards size={15} />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.28em] text-sky-700">Wiederkehrende Rechnungen</p>
                          <p className="mt-1 text-[11px] text-sand-600">
                            Rein lesend aus sevdesk: wiederkehrende Rechnungen je Kunde und Tag.
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-sky-100 bg-white px-3 py-2 text-right">
                        <p className="text-[10px] uppercase tracking-wide text-sand-500">Aktuell / Monat</p>
                        <p className="text-base font-semibold text-sand-900">
                          {formatEurPrecise(sevdeskRecurringTagsSummary?.monthlyTotalEur || 0)}
                        </p>
                        <p className="text-[11px] text-sand-500">
                          Tags {formatNumber(sevdeskRecurringTagsSummary?.tagCount || 0)} · Vorlagen{" "}
                          {formatNumber(sevdeskRecurringTagsSummary?.invoiceCount || 0)}
                        </p>
                      </div>
                    </div>
                    {sevdeskRecurringTagTotals.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {sevdeskRecurringTagTotals.slice(0, 8).map((entry) => (
                          <div key={entry.tagId || entry.tagName} className="rounded-xl border border-sand-200 bg-white px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-sand-900">{entry.tagName || "Ohne Tag"}</p>
                              <p className="text-sm font-semibold text-sand-900">{formatEurPrecise(entry.monthlyEur || 0)}</p>
                            </div>
                            <p className="mt-0.5 text-[11px] text-sand-500">
                              {formatNumber(entry.invoiceCount || 0)} Vorlagen
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-sand-500">Keine getaggten wiederkehrenden Rechnungen in sevdesk gefunden.</p>
                    )}
                  </div>
                  {renderPrepaidHoursContainer()}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {contractCalcModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-6xl rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Popup</p>
                <h3 className="text-lg font-display text-sand-900">
                  {editingContractId ? "Vertragsvorschlag bearbeiten" : "Neuen Vertrag anlegen"}
                </h3>
              </div>
              <button
                onClick={closeContractCreator}
                className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                Schließen
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-6 bg-sand-50">{renderContractCalculationContent()}</div>
          </div>
        </div>
      ) : null}
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
              <BookPlus size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Kundenkartei</h1>
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

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        <section className="rounded-3xl border border-sand-200 bg-white shadow-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Übersicht</p>
              <h2 className="text-base font-display text-sand-900">Kundendatei</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs text-sand-700">
                Gesamt {totalCustomers}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                Aktiv {activeCustomers}
              </span>
              <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700">
                Inaktiv {inactiveCustomers}
              </span>
            </div>
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] items-center">
            <label className="relative block">
              <span className="sr-only">Suche</span>
              <Search size={14} className="absolute left-3 top-3 text-sand-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Suche nach Name, Nummer, Telefon…"
                className="w-full rounded-2xl border border-sand-200 pl-9 pr-3 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-sand-300"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-sand-600">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4"
              />
              Inaktive Kunden einblenden
            </label>
          </div>
          <div className="overflow-auto rounded-2xl border border-sand-200">
            <table className="min-w-full text-xs">
              <thead className="bg-sand-100 text-sand-600 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 text-left">Kunde</th>
                  <th className="px-3 py-2 text-left">Kommunikation</th>
                  <th className="px-3 py-2 text-left">Kundenstatus</th>
                  <th className="px-3 py-2 text-left">Vertragsstatus</th>
                  <th className="px-3 py-2 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-200/70">
                {sortedCustomers.length ? (
                  sortedCustomers.map((customer, index) => (
                    <tr
                      key={customer.id}
                      className={`${
                        customer.id === activeId
                          ? "bg-sand-200/70"
                          : index % 2 === 0
                          ? "bg-white"
                          : "bg-slate-100"
                      } hover:bg-sand-100 cursor-pointer`}
                      onClick={() => setActiveId(customer.id)}
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-sand-900">{customer.name?.trim() || "Unbenannter Kunde"}</p>
                          <span className="text-[11px] text-sand-500">
                            Nr. {customer.creditorNumber || "ohne"}
                          </span>
                          {customer.shortCode ? (
                            <span className="text-[11px] text-sand-500">· {customer.shortCode}</span>
                          ) : null}
                        </div>
                        {(() => {
                          const context = developmentByCustomerId[customer.id];
                          if (!context) {
                            return (
                              <p className="mt-1 text-[10px] text-sand-400">
                                {developmentListStatus === "loading" ? "Meta-Hub lädt…" : "Keine Meta-Hub Daten"}
                              </p>
                            );
                          }
                          const infra = context?.infra || {};
                          const managedAssets = Number(infra?.managedAssets || 0);
                          const openUpdates = Number(infra?.openUpdates || 0);
                          const errorCount = Number(infra?.errorCount || 0);
                          const warningCount = Number(infra?.warningCount || 0);
                          if (managedAssets === 0 && openUpdates === 0 && errorCount === 0 && warningCount === 0) {
                            return null;
                          }
                          return (
                            <p className="mt-1 text-[10px] text-sand-600">
                              {managedAssets} Agents · Updates {openUpdates} · Fehler {errorCount} · Warnungen {warningCount}
                            </p>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={Boolean(customer.customerReport)}
                              onChange={(event) =>
                                updateCustomer(customer.id, { customerReport: event.target.checked })
                              }
                              className="h-3.5 w-3.5"
                            />
                            Bericht
                          </label>
                          <label className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={Boolean(customer.newsletter)}
                              onChange={(event) =>
                                updateCustomer(customer.id, { newsletter: event.target.checked })
                              }
                              className="h-3.5 w-3.5"
                            />
                            Newsletter
                          </label>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={String(customer.status || "active")}
                          onChange={(event) => updateCustomer(customer.id, { status: event.target.value })}
                          className="rounded-lg border border-sand-200 px-2 py-1 text-xs"
                        >
                          <option value="active">Aktiv</option>
                          <option value="inactive">Inaktiv</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {(() => {
                          const contractTypeCounts =
                            customer.id === activeId
                              ? deriveContractTypeCountsFromContracts(customerContracts)
                              : normalizeContractTypeCounts(customer.contractTypeCounts || {});
                          const entries = sortContractTypeCountEntries(contractTypeCounts);
                          if (!entries.length) {
                            return <span className="text-[11px] text-sand-400">Kein Vertrag</span>;
                          }
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {entries.map(([type, count]) => (
                                <span
                                  key={type}
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${contractTypeBadgeClass(type)}`}
                                >
                                  {formatContractTypeLabel(type)} {count}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveId(customer.id);
                            setSettingsTab("details");
                            setEditCustomerId(customer.id);
                          }}
                          className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                          title="Bearbeiten"
                          aria-label="Bearbeiten"
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sand-500">
                      Keine Treffer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
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
