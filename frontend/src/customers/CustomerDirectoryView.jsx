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
  Pencil,
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
import CustomerInventoryTab from "./CustomerInventoryTab";

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
  listCustomerContractCalculations: (customerId) =>
    fetch(`${API}/customers/${customerId}/contract_calculations`).then((r) => r.json()),
  createCustomerContractCalculation: (customerId, payload) =>
    fetch(`${API}/customers/${customerId}/contract_calculations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_calc_failed");
      return data;
    }),
  listCustomerContracts: (customerId, status = "") =>
    fetch(
      `${API}/customers/${customerId}/contracts${
        String(status || "").trim() ? `?status=${encodeURIComponent(String(status || "").trim())}` : ""
      }`
    ).then((r) => r.json()),
  downloadLatestCustomerContract: (customerId, status) =>
    fetch(
      `${API}/customers/${customerId}/contracts/download_latest?status=${encodeURIComponent(
        String(status || "").trim() || "active"
      )}`
    ),
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
  cancelCustomerContract: (customerId, contractId, reason = "") =>
    fetch(`${API}/customers/${customerId}/contracts/${contractId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "contract_cancel_failed");
      return data;
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
  if (seen.has("regie") && (seen.has("wartung") || seen.has("monitoring"))) {
    return values.filter((entry) => entry !== "regie");
  }
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

const CONTRACT_FLAG_ORDER = ["wartung", "monitoring", "regie"];

const applyContractFlagChange = (flags, contractId, checked) => {
  const current = new Set(normalizeContractFlags(flags));
  const key = String(contractId || "").trim().toLowerCase();
  if (!key) return CONTRACT_FLAG_ORDER.filter((item) => current.has(item));
  if (checked) {
    current.add(key);
    if (key === "regie") {
      current.delete("wartung");
      current.delete("monitoring");
    } else if (key === "wartung" || key === "monitoring") {
      current.delete("regie");
    }
  } else {
    current.delete(key);
  }
  return CONTRACT_FLAG_ORDER.filter((item) => current.has(item));
};

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

const parseMoneyInput = (value, fallback = 0) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    const fallbackNumber = Number(fallback || 0);
    return Number.isFinite(fallbackNumber) ? Math.max(0, fallbackNumber) : 0;
  }
  let normalized = raw.replace(/\s/g, "");
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    const fallbackNumber = Number(fallback || 0);
    return Number.isFinite(fallbackNumber) ? Math.max(0, fallbackNumber) : 0;
  }
  return Math.max(0, parsed);
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
  const [contractTariffs, setContractTariffs] = useState([]);
  const [contractTariffsStatus, setContractTariffsStatus] = useState("idle");
  const [calcInput, setCalcInput] = useState({
    tariffId: null,
    servers: "0",
    clients: "0",
    networkDevices: "0",
    iotDevices: "0",
    note: ""
  });
  const [calcHistory, setCalcHistory] = useState([]);
  const [calcHistoryStatus, setCalcHistoryStatus] = useState("idle");
  const [calcSaveStatus, setCalcSaveStatus] = useState("idle");
  const [calcImportStatus, setCalcImportStatus] = useState("idle");
  const [customerContracts, setCustomerContracts] = useState([]);
  const [contractsStatus, setContractsStatus] = useState("idle");
  const [contractPreviewStatus, setContractPreviewStatus] = useState("idle");
  const [contractSaveStatus, setContractSaveStatus] = useState("idle");
  const [generatedContract, setGeneratedContract] = useState(null);
  const [contractDraft, setContractDraft] = useState({
    title: "",
    docType: "vertrag",
    note: "",
    validFrom: "",
    runtimeMonths: "12",
    monthlyTotal: "",
    yearlyTotal: "",
    markAsProposal: true
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
    if (!activeId) {
      setCalcHistory([]);
      return;
    }
    let active = true;
    setCalcHistoryStatus("loading");
    api
      .listCustomerContractCalculations(activeId)
      .then((rows) => {
        if (!active) return;
        setCalcHistory(Array.isArray(rows) ? rows : []);
        setCalcHistoryStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setCalcHistoryStatus("error");
      });
    return () => {
      active = false;
    };
  }, [activeId]);

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

  const parseCount = (value) => {
    const parsed = Number.parseInt(String(value || "0"), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const selectedTariff = useMemo(
    () => contractTariffs.find((item) => Number(item?.id) === Number(calcInput.tariffId)) || null,
    [contractTariffs, calcInput.tariffId]
  );

  const tariffCategoryForContractType = useMemo(() => {
    const type = String(contractDraft.docType || "vertrag").trim().toLowerCase();
    if (type === "wartung") return "wartung";
    if (type === "monitoring") return "monitoring";
    return "";
  }, [contractDraft.docType]);

  const filteredActiveTariffs = useMemo(() => {
    const activeTariffs = (contractTariffs || []).filter((item) => Boolean(item?.is_active));
    if (!tariffCategoryForContractType) return activeTariffs;
    return activeTariffs.filter(
      (item) => String(item?.category || "").trim().toLowerCase() === tariffCategoryForContractType
    );
  }, [contractTariffs, tariffCategoryForContractType]);

  useEffect(() => {
    setCalcInput((prev) => {
      const currentExists = filteredActiveTariffs.some((item) => Number(item?.id) === Number(prev.tariffId));
      if (currentExists) return prev;
      return { ...prev, tariffId: filteredActiveTariffs[0]?.id ?? null };
    });
  }, [filteredActiveTariffs]);

  const contractPreview = useMemo(() => {
    if (!selectedTariff) {
      return { monthly: 0, yearly: 0, counts: { servers: 0, clients: 0, networkDevices: 0, iotDevices: 0 } };
    }
    const counts = {
      servers: parseCount(calcInput.servers),
      clients: parseCount(calcInput.clients),
      networkDevices: parseCount(calcInput.networkDevices),
      iotDevices: parseCount(calcInput.iotDevices)
    };
    const monthly =
      Number(selectedTariff.base_price_monthly || 0) +
      counts.servers * Number(selectedTariff.price_server_monthly || 0) +
      counts.clients * Number(selectedTariff.price_client_monthly || 0) +
      counts.networkDevices * Number(selectedTariff.price_network_monthly || 0) +
      counts.iotDevices * Number(selectedTariff.price_iot_monthly || 0);
    return { monthly, yearly: monthly * 12, counts };
  }, [selectedTariff, calcInput]);

  const contractTotals = useMemo(() => {
    const hasMonthlyOverride = String(contractDraft.monthlyTotal || "").trim() !== "";
    const hasYearlyOverride = String(contractDraft.yearlyTotal || "").trim() !== "";
    const monthly = hasMonthlyOverride
      ? parseMoneyInput(contractDraft.monthlyTotal, contractPreview.monthly)
      : Number(contractPreview.monthly || 0);
    const yearly = hasYearlyOverride
      ? parseMoneyInput(contractDraft.yearlyTotal, contractPreview.yearly)
      : monthly * 12;
    return { monthly, yearly, hasMonthlyOverride, hasYearlyOverride };
  }, [contractDraft.monthlyTotal, contractDraft.yearlyTotal, contractPreview.monthly, contractPreview.yearly]);

  useEffect(() => {
    setGeneratedContract(null);
  }, [
    activeId,
    contractDraft.title,
    contractDraft.docType,
    contractDraft.note,
    contractDraft.validFrom,
    contractDraft.runtimeMonths,
    contractDraft.monthlyTotal,
    contractDraft.yearlyTotal,
    selectedTariff?.id,
    contractPreview.monthly,
    contractPreview.yearly,
    contractPreview.counts.servers,
    contractPreview.counts.clients,
    contractPreview.counts.networkDevices,
    contractPreview.counts.iotDevices
  ]);

  const refreshTariffs = async () => {
    const list = await api.listContractTariffs(false);
    const rows = Array.isArray(list) ? list : [];
    setContractTariffs(rows);
    setCalcInput((prev) => {
      const currentExists = rows.some((item) => Number(item.id) === Number(prev.tariffId));
      if (currentExists) return prev;
      const firstActive = rows.find((item) => Boolean(item?.is_active));
      return { ...prev, tariffId: firstActive?.id ?? null };
    });
  };

  const saveTariffSuggestion = async () => {
    if (!activeId || !selectedTariff?.id) return;
    setCalcSaveStatus("saving");
    try {
      const saved = await api.createCustomerContractCalculation(activeId, {
        tariff_id: selectedTariff.id,
        servers: contractPreview.counts.servers,
        clients: contractPreview.counts.clients,
        network_devices: contractPreview.counts.networkDevices,
        iot_devices: contractPreview.counts.iotDevices,
        note: String(calcInput.note || "")
      });
      setCalcHistory((prev) => [saved, ...prev].slice(0, 50));
      setCalcSaveStatus("saved");
      setTimeout(() => setCalcSaveStatus("idle"), 1800);
    } catch {
      setCalcSaveStatus("error");
      setTimeout(() => setCalcSaveStatus("idle"), 2200);
    }
  };

  const applySuggestionToCalculator = (row) => {
    if (!row) return;
    setCalcInput((prev) => ({
      ...prev,
      tariffId: row.tariff_id || row.tariffId || prev.tariffId || null,
      servers: String(row.servers ?? 0),
      clients: String(row.clients ?? 0),
      networkDevices: String(row.network_devices ?? row.networkDevices ?? 0),
      iotDevices: String(row.iot_devices ?? row.iotDevices ?? 0),
      note: String(row.note || "")
    }));
    setContractCalcModalOpen(true);
  };

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
        note: String(
          prev.note ||
            `Auto-Import Meta-Hub: ${counts.managed} RMM-Agents, ${counts.discovered} Inventar-Geräte`
        ),
      }));
      setCalcImportStatus("done");
      setTimeout(() => setCalcImportStatus("idle"), 1800);
    } catch {
      setCalcImportStatus("error");
      setTimeout(() => setCalcImportStatus("idle"), 2200);
    }
  };

  const contractHtmlToPdfDataUri = async (html) => {
    const container = document.createElement("div");
    container.innerHTML = html;
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "210mm";
    container.style.background = "#ffffff";
    container.style.padding = "12mm";
    document.body.appendChild(container);
    try {
      const images = Array.from(container.querySelectorAll("img"));
      await Promise.all(
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
      );
      const canvas = await html2canvas(container, {
        scale: 1,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
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
      return pdf.output("datauristring");
    } finally {
      if (container.parentNode) container.parentNode.removeChild(container);
    }
  };

  const generateContractPreview = async (openModal = true) => {
    if (!activeId) return null;
    setContractPreviewStatus("saving");
    try {
      const preview = await api.previewCustomerContract(activeId, {
        title: String(contractDraft.title || "").trim(),
        doc_type: String(contractDraft.docType || "vertrag"),
        note: String(contractDraft.note || ""),
        valid_from: String(contractDraft.validFrom || ""),
        runtime_months: Number(contractDraft.runtimeMonths || 12),
        tariff_id: selectedTariff?.id || null,
        servers: contractPreview.counts.servers,
        clients: contractPreview.counts.clients,
        network_devices: contractPreview.counts.networkDevices,
        iot_devices: contractPreview.counts.iotDevices,
        monthly_total: contractTotals.monthly,
        yearly_total: contractTotals.yearly
      });
      setGeneratedContract(preview);
      setContractPreviewStatus("saved");
      if (openModal) {
        setPreviewModal({
          open: true,
          title: preview?.title || "Vertragsvorschau",
          html: preview?.html || ""
        });
      }
      setTimeout(() => setContractPreviewStatus("idle"), 1800);
      return preview;
    } catch {
      setContractPreviewStatus("error");
      setToast("Vorschau konnte nicht erstellt werden.");
      setTimeout(() => setContractPreviewStatus("idle"), 2200);
      return null;
    }
  };

  const exportGeneratedContractPdf = async () => {
    const source = generatedContract || (await generateContractPreview(false));
    if (!source?.html) return;
    try {
      const dataUri = await contractHtmlToPdfDataUri(source.html);
      const anchor = document.createElement("a");
      anchor.href = dataUri;
      anchor.download = source.file_name || "vertrag.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      setToast("PDF-Erzeugung fehlgeschlagen.");
    }
  };

  const saveGeneratedContract = async ({ downloadAfterSave = false } = {}) => {
    if (!activeId) return;
    setContractSaveStatus("saving");
    try {
      const source = generatedContract || (await generateContractPreview(false));
      if (!source?.html) throw new Error("no_preview");
      const dataUri = await contractHtmlToPdfDataUri(source.html);
      const marker = "base64,";
      const idx = String(dataUri).indexOf(marker);
      if (idx === -1) throw new Error("pdf_base64_missing");
      const contentBase64 = String(dataUri).slice(idx + marker.length);
      const saved = await api.createCustomerContract(activeId, {
        title: String(source.title || contractDraft.title || "Vertrag").trim(),
        doc_type: String(source.doc_type || contractDraft.docType || "vertrag"),
        file_name: String(source.file_name || "vertrag.pdf"),
        mime_type: "application/pdf",
        content_base64: contentBase64,
        html_content: String(source.html || ""),
        template_key: String(source.template_key || contractDraft.docType || "vertrag"),
        note: String(contractDraft.note || ""),
        status: contractDraft.markAsProposal ? "proposal" : "active"
      });
      setCustomerContracts((prev) => [saved, ...prev]);
      setGeneratedContract(source);
      if (downloadAfterSave) {
        const anchor = document.createElement("a");
        anchor.href = dataUri;
        anchor.download = source.file_name || "vertrag.pdf";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setContractSaveStatus("saved");
      setTimeout(() => setContractSaveStatus("idle"), 1800);
    } catch {
      setContractSaveStatus("error");
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

  const downloadLatestContractByStatus = async (status, fallbackName = "vertrag.pdf") => {
    if (!activeId) return;
    try {
      const res = await api.downloadLatestCustomerContract(activeId, status);
      if (!res.ok) throw new Error("download_latest_failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fallbackName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setToast("Kein passendes Vertragsdokument für diesen Status gefunden.");
    }
  };

  const cancelContractDocument = async (contractId) => {
    if (!activeId || !contractId) return;
    const reason = window.prompt("Stornogrund (optional):", "") || "";
    try {
      const updated = await api.cancelCustomerContract(activeId, contractId, reason);
      setCustomerContracts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setToast("Stornierung fehlgeschlagen.");
    }
  };

  const reactivateContractDocument = async (contractId) => {
    if (!activeId || !contractId) return;
    try {
      const updated = await api.reactivateCustomerContract(activeId, contractId);
      setCustomerContracts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setToast("Reaktivierung fehlgeschlagen.");
    }
  };

  const markContractDocumentAsProposal = async (contractId) => {
    if (!activeId || !contractId) return;
    try {
      const updated = await api.markCustomerContractProposal(activeId, contractId);
      setCustomerContracts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch {
      setToast("Markierung als Vorschlag fehlgeschlagen.");
    }
  };

  const openContractCreator = () => {
    if (!activeCustomer) return;
    const customerLabel = String(activeCustomer.name || "").trim();
    const context = developmentByCustomerId[activeCustomer.id] || null;
    const counts = deriveContractCountsFromDevelopment(context);
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
      title: customerLabel ? `Wartungsvertrag ${customerLabel}` : "",
      docType: "wartung",
      note: "",
      validFrom: "",
      runtimeMonths: "12",
      monthlyTotal: "",
      yearlyTotal: "",
      markAsProposal: true
    });
    setGeneratedContract(null);
    setContractCalcModalOpen(true);
  };

  const deleteContractDocument = async (contractId) => {
    if (!activeId || !contractId) return;
    if (!window.confirm("Vertrag wirklich endgültig löschen?")) return;
    try {
      await api.deleteCustomerContract(activeId, contractId);
      setCustomerContracts((prev) => prev.filter((item) => item.id !== contractId));
    } catch {
      setToast("Löschen fehlgeschlagen.");
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

  const activeCustomer = customers.find((customer) => customer.id === activeId) || null;
  const editCustomer = customers.find((customer) => customer.id === editCustomerId) || null;
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

  const renderContractCalculationContent = () => (
    <div className="space-y-3">
      <div className="rounded-2xl border border-sand-200 bg-white p-3.5">
        <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Kundenspezifische Kalkulation</p>
        <div className="mt-2.5 grid gap-2 md:grid-cols-4">
          <label className="block md:col-span-2">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">1) Vertragstyp</span>
            <select
              value={contractDraft.docType}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, docType: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
            >
              <option value="vertrag">IT-Servicevertrag</option>
              <option value="wartung">Wartungsvertrag</option>
              <option value="monitoring">Monitoringvertrag</option>
              <option value="avv_dsgvo">AVV / DSGVO</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">2) Tarif</span>
            <select
              value={calcInput.tariffId || ""}
              onChange={(event) => setCalcInput((prev) => ({ ...prev, tariffId: Number(event.target.value) || null }))}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
            >
              <option value="">
                {tariffCategoryForContractType
                  ? `Tarif für ${tariffCategoryForContractType} wählen`
                  : "Tarif wählen (optional)"}
              </option>
              {filteredActiveTariffs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.category})
                  </option>
                ))}
            </select>
          </label>
          <div className="md:col-span-2 flex items-end" />
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">3) Server</span>
            <input value={calcInput.servers} onChange={(event) => setCalcInput((prev) => ({ ...prev, servers: event.target.value }))} className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Clients</span>
            <input value={calcInput.clients} onChange={(event) => setCalcInput((prev) => ({ ...prev, clients: event.target.value }))} className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Netzwerkgeräte</span>
            <input value={calcInput.networkDevices} onChange={(event) => setCalcInput((prev) => ({ ...prev, networkDevices: event.target.value }))} className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">IoT</span>
            <input value={calcInput.iotDevices} onChange={(event) => setCalcInput((prev) => ({ ...prev, iotDevices: event.target.value }))} className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block md:col-span-4">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Notiz</span>
            <input value={calcInput.note} onChange={(event) => setCalcInput((prev) => ({ ...prev, note: event.target.value }))} className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm" />
          </label>
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-[1fr_1fr_auto] items-center">
          <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-sand-500">Monat</p>
            <p className="text-base font-semibold text-sand-900">{formatEurPrecise(contractPreview.monthly)}</p>
          </div>
          <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-sand-500">Jahr</p>
            <p className="text-base font-semibold text-sand-900">{formatEurPrecise(contractPreview.yearly)}</p>
          </div>
          <button
            type="button"
            onClick={saveTariffSuggestion}
            disabled={!selectedTariff}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
              selectedTariff ? "border-sand-200 bg-sand-900 text-white" : "border-sand-200 bg-sand-100 text-sand-400"
            }`}
          >
            Tarif als Vorschlag speichern
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {calcSaveStatus === "saved" ? <span className="text-xs text-emerald-600">Gespeichert</span> : null}
          {calcSaveStatus === "error" ? <span className="text-xs text-rose-600">Speichern fehlgeschlagen</span> : null}
          {calcImportStatus === "loading" ? <span className="text-xs text-sand-500">Importiere aus Meta-Hub…</span> : null}
          {calcImportStatus === "done" ? <span className="text-xs text-emerald-600">Werte übernommen</span> : null}
          {calcImportStatus === "empty" ? <span className="text-xs text-amber-700">Keine Meta-Hub Infrastrukturdaten gefunden</span> : null}
          {calcImportStatus === "error" ? <span className="text-xs text-rose-600">Meta-Hub Import fehlgeschlagen</span> : null}
        </div>
        <div className="mt-3">
          <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Vorschlags-Historie</p>
          <div className="mt-1.5 space-y-1.5 max-h-48 overflow-auto pr-1">
            {(calcHistory || []).map((row) => (
              <div key={row.id} className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs">
                <p className="font-semibold text-sand-800">
                  {row.tariff_name} ({row.tariff_category})
                </p>
                <p className="text-[11px] text-sand-600">
                  Server {row.servers} · Clients {row.clients} · Netzwerk {row.network_devices} · IoT {row.iot_devices}
                </p>
                <p className="text-[11px] text-sand-700">
                  {formatEurPrecise(row.monthly_total)} / Monat · {formatEurPrecise(row.yearly_total)} / Jahr
                </p>
                <p className="text-[10px] text-sand-500">
                  {new Date(row.created_at || Date.now()).toLocaleString("de-DE")}
                </p>
              </div>
            ))}
            {calcHistoryStatus === "loading" ? <p className="text-xs text-sand-500">Lade Historie…</p> : null}
            {!calcHistory.length && calcHistoryStatus !== "loading" ? (
              <p className="text-xs text-sand-500">Noch keine gespeicherten Vorschläge.</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-sand-200 bg-white p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Neuen Vertrag anlegen</p>
          <span className="text-[11px] text-sand-500">
            Grundlage: {selectedTariff ? `${selectedTariff.name}` : "Ohne Tarif (z.B. AVV)"}
          </span>
        </div>
        <div className="mt-2.5 grid gap-2 md:grid-cols-2">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Titel</span>
            <input
              value={contractDraft.title}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
              placeholder="z.B. Wartungsvertrag Kunde"
            />
          </label>
          <div className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Vertragstyp</span>
            <p className="mt-1 rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-sm text-sand-800">
              {String(contractDraft.docType || "vertrag")
                .replace("avv_dsgvo", "AVV / DSGVO")
                .replace("wartung", "Wartung")
                .replace("monitoring", "Monitoring")
                .replace("vertrag", "IT-Servicevertrag")}
            </p>
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Gültig ab</span>
            <input
              type="date"
              value={contractDraft.validFrom}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, validFrom: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Laufzeit (Monate)</span>
            <input
              type="number"
              min="1"
              value={contractDraft.runtimeMonths}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, runtimeMonths: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Hinweis im Vertrag</span>
            <input
              value={contractDraft.note}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, note: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Monatspreis (optional)</span>
            <input
              value={contractDraft.monthlyTotal}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, monthlyTotal: event.target.value }))}
              placeholder={formatEurPrecise(contractPreview.monthly)}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-sand-500">Jahrespreis (optional)</span>
            <input
              value={contractDraft.yearlyTotal}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, yearlyTotal: event.target.value }))}
              placeholder={formatEurPrecise(contractPreview.yearly)}
              className="mt-1 w-full rounded-xl border border-sand-200 px-2.5 py-1.5 text-sm"
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-sand-500">
          Tarifpreise sind Vorschlagswerte. Leer = Vorschlag verwenden.
          {` Aktuell: ${formatEurPrecise(contractTotals.monthly)} / Monat · ${formatEurPrecise(contractTotals.yearly)} / Jahr.`}
        </p>
        <label className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          <input
            type="checkbox"
            checked={Boolean(contractDraft.markAsProposal)}
            onChange={(event) => setContractDraft((prev) => ({ ...prev, markAsProposal: event.target.checked }))}
            className="h-4 w-4"
          />
          Als Vorschlag markieren, solange der Kunde noch nicht eingewilligt hat
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => generateContractPreview(true)}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide hover:bg-sand-100"
          >
            <Eye size={12} />
            Vorschau öffnen
          </button>
          <button
            type="button"
            onClick={exportGeneratedContractPdf}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide hover:bg-sand-100"
          >
            <FileDown size={12} />
            PDF laden
          </button>
          <button
            type="button"
            onClick={() => saveGeneratedContract()}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-sand-900 px-3 py-1.5 text-[11px] uppercase tracking-wide text-white hover:opacity-90"
          >
            <BadgeCheck size={12} />
            {contractDraft.markAsProposal ? "Als Vorschlag speichern" : "Als aktiv speichern"}
          </button>
          <button
            type="button"
            onClick={() => saveGeneratedContract({ downloadAfterSave: true })}
            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide hover:bg-sand-100"
          >
            <FileDown size={12} />
            Speichern + PDF laden
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {contractPreviewStatus === "saving" ? <span className="text-xs text-sand-500">Erzeuge Vorschau…</span> : null}
          {contractPreviewStatus === "saved" ? <span className="text-xs text-emerald-600">Vorschau aktualisiert</span> : null}
          {contractPreviewStatus === "error" ? <span className="text-xs text-rose-600">Vorschau fehlgeschlagen</span> : null}
          {contractSaveStatus === "saving" ? <span className="text-xs text-sand-500">Speichere Vertrag…</span> : null}
          {contractSaveStatus === "saved" ? <span className="text-xs text-emerald-600">Vertrag gespeichert</span> : null}
          {contractSaveStatus === "error" ? <span className="text-xs text-rose-600">Speichern fehlgeschlagen</span> : null}
        </div>
      </div>
    </div>
  );

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
      {editCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-3 py-3 md:px-4 md:py-6">
          <div className="h-[94vh] w-[96vw] max-w-[1440px] rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Kunde bearbeiten</p>
                <h3 className="text-lg font-display text-sand-900">{editCustomer.name || "Kunde"}</h3>
              </div>
              <button
                onClick={() => setEditCustomerId(null)}
                className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                Schließen
              </button>
            </div>
            <div className="border-b border-sand-200 px-6 py-3 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSettingsTab("details")}
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${
                    settingsTab === "details"
                      ? "border-sand-900 bg-sand-900 text-white"
                      : "border-sand-200 bg-white hover:bg-sand-100"
                  }`}
                >
                  Stammdaten
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("development")}
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${
                    settingsTab === "development"
                      ? "border-sand-900 bg-sand-900 text-white"
                      : "border-sand-200 bg-white hover:bg-sand-100"
                  }`}
                >
                  Kundenentwicklung
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("contracts")}
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${
                    settingsTab === "contracts"
                      ? "border-sand-900 bg-sand-900 text-white"
                      : "border-sand-200 bg-white hover:bg-sand-100"
                  }`}
                >
                  Verträge
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("inventory")}
                  className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${
                    settingsTab === "inventory"
                      ? "border-sand-900 bg-sand-900 text-white"
                      : "border-sand-200 bg-white hover:bg-sand-100"
                  }`}
                >
                  Inventar
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(editCustomer.id)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                >
                  Kunde löschen
                </button>
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
                  <span className="text-xs uppercase tracking-wide text-sand-500">Kürzel</span>
                  <input
                    value={editCustomer.shortCode}
                    onChange={(event) => updateCustomer(editCustomer.id, { shortCode: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block md:col-span-3">
                  <span className="text-xs uppercase tracking-wide text-sand-500">E-Mail</span>
                  <input
                    type="email"
                    value={editCustomer.email}
                    onChange={(event) => updateCustomer(editCustomer.id, { email: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
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
              <div className="mt-2 rounded-xl border border-sand-200 bg-white px-3 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-sand-500 mb-2">Vertragsstatus</p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-sand-700">
                  {[
                    { id: "wartung", label: "Wartung" },
                    { id: "monitoring", label: "Monitoring" },
                    { id: "regie", label: "Regie (kein Vertrag)" }
                  ].map((contract) => (
                    <label key={contract.id} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean((editCustomer.contractFlags || []).includes(contract.id))}
                        onChange={(event) => {
                          const nextFlags = applyContractFlagChange(
                            editCustomer.contractFlags || [],
                            contract.id,
                            event.target.checked
                          );
                          updateCustomer(editCustomer.id, {
                            contractFlags: nextFlags,
                            maintenanceContract: nextFlags.includes("wartung")
                          });
                        }}
                        className="h-4 w-4"
                      />
                      {contract.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="text-xs uppercase tracking-wide text-sand-500">Straße</span>
                  <input
                    value={editCustomer.street}
                    onChange={(event) => updateCustomer(editCustomer.id, { street: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-sand-500">PLZ</span>
                  <input
                    value={editCustomer.postalCode}
                    onChange={(event) => updateCustomer(editCustomer.id, { postalCode: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-sand-500">Ort</span>
                  <input
                    value={editCustomer.city}
                    onChange={(event) => updateCustomer(editCustomer.id, { city: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-sand-500">Land</span>
                  <input
                    value={editCustomer.country}
                    onChange={(event) => updateCustomer(editCustomer.id, { country: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-sm"
                  />
                </label>
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
              {settingsTab === "development" ? (
                <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-3">
                  <CustomerDevelopmentCustomerTab
                    customerId={editCustomer.id}
                    customerName={editCustomer.name || ""}
                    customerNumber={editCustomer.creditorNumber || ""}
                  />
                </div>
              ) : null}
              {settingsTab === "contracts" ? (
                <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Verträge</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadLatestContractByStatus("proposal", "vertrag_vorschlag.pdf")}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-700 hover:bg-amber-100"
                      >
                        Letzten Vorschlag laden
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadLatestContractByStatus("active", "vertrag_final.pdf")}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] uppercase tracking-wide text-emerald-700 hover:bg-emerald-100"
                      >
                        Aktiven Vertrag laden
                      </button>
                      <button
                        type="button"
                        onClick={openContractCreator}
                        className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[11px] uppercase tracking-wide hover:bg-sand-100"
                      >
                        Neuer Vertrag anlegen (inkl. Kalkulation)
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-auto pr-1">
                    {(customerContracts || []).map((item) => (
                      <div key={item.id} className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sand-800">{item.title || "Vertrag"}</p>
                          {(() => {
                            const status = String(item.status || "active").toLowerCase();
                            const badgeClass =
                              status === "cancelled"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : status === "proposal"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700";
                            const label = status === "cancelled" ? "Storniert" : status === "proposal" ? "Vorschlag" : "Aktiv";
                            return (
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${badgeClass}`}>
                                {label}
                              </span>
                            );
                          })()}
                        </div>
                        {String(item.status || "active").toLowerCase() === "proposal" ? (
                          <p className="mt-1 text-[11px] text-amber-700">
                            Kunde hat noch nicht eingewilligt. Als Vorschlag geführt.
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewModal({
                                open: true,
                                title: item.title || "Vertrag",
                                html: String(item.html_content || "<p>Keine Vorschau hinterlegt.</p>")
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                          >
                            <Eye size={11} /> Vorschau
                          </button>
                          {(() => {
                            const status = String(item.status || "active").toLowerCase();
                            const label =
                              status === "proposal"
                                ? "Vorschlag PDF"
                                : status === "active"
                                ? "Final PDF"
                                : "PDF";
                            return (
                              <button
                                type="button"
                                onClick={() => downloadContractDocument(item.id, item.file_name || "vertrag.pdf")}
                                className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                              >
                                <FileDown size={11} /> {label}
                              </button>
                            );
                          })()}
                          {String(item.status || "active").toLowerCase() === "cancelled" ? (
                            <button
                              type="button"
                              onClick={() => reactivateContractDocument(item.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                            >
                              Reaktivieren
                            </button>
                          ) : String(item.status || "active").toLowerCase() === "proposal" ? (
                            <button
                              type="button"
                              onClick={() => reactivateContractDocument(item.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-emerald-700 hover:bg-emerald-100"
                            >
                              Als aktiv markieren
                            </button>
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
                          {String(item.status || "active").toLowerCase() === "proposal" ? (
                            <button
                              type="button"
                              onClick={() => cancelContractDocument(item.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                            >
                              Stornieren
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => deleteContractDocument(item.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 size={11} /> Löschen
                          </button>
                        </div>
                      </div>
                    ))}
                    {contractsStatus === "loading" ? <p className="text-xs text-sand-500">Lade Verträge…</p> : null}
                    {contractsStatus === "error" ? <p className="text-xs text-rose-600">Verträge konnten nicht geladen werden.</p> : null}
                    {!customerContracts.length && contractsStatus !== "loading" ? (
                      <p className="text-xs text-sand-500">Noch keine Verträge für diesen Kunden.</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-sand-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Vorschläge</p>
                      <span className="text-[11px] text-sand-500">Aus Vertragskalkulation gespeichert</span>
                    </div>
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {(calcHistory || []).map((row) => (
                        <div key={row.id} className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sand-800">
                              {row.tariff_name || "Tarif"} · {String(row.tariff_category || "").toUpperCase()}
                            </p>
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-700">
                              Vorschlag
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-sand-600">
                            {formatEurPrecise(row.monthly_total)} / Monat · {formatEurPrecise(row.yearly_total)} / Jahr
                          </p>
                          <p className="text-[10px] text-sand-500">
                            {new Date(row.created_at || Date.now()).toLocaleString("de-DE")}
                          </p>
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => applySuggestionToCalculator(row)}
                              className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                            >
                              In Kalkulation übernehmen
                            </button>
                          </div>
                        </div>
                      ))}
                      {calcHistoryStatus === "loading" ? <p className="text-xs text-sand-500">Lade Vorschläge…</p> : null}
                      {!calcHistory.length && calcHistoryStatus !== "loading" ? (
                        <p className="text-xs text-sand-500">Noch keine Vorschläge vorhanden.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {settingsTab === "inventory" ? (
                <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-3">
                  <CustomerInventoryTab customerId={editCustomer.id} />
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
                <h3 className="text-lg font-display text-sand-900">Vertragskalkulation</h3>
              </div>
              <button
                onClick={() => setContractCalcModalOpen(false)}
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-gradient-to-r from-white via-sand-50 to-sand-100 px-3 py-2.5 shadow-soft">
            <div className="h-12 w-12 rounded-xl border border-sand-200 bg-white text-sand-800 flex items-center justify-center">
              <BookPlus size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900 leading-tight">Kundenkartei</h1>
            </div>
            <div className="hidden sm:flex h-8 w-8 rounded-lg bg-sand-900 text-white items-center justify-center">
              <Users size={15} />
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
                      } hover:bg-sand-100`}
                      onClick={() => setActiveId(customer.id)}
                    >
                      <td className="px-3 py-2 align-top">
                        <p className="font-semibold text-sand-900">{customer.name?.trim() || "Unbenannter Kunde"}</p>
                        <p className="text-[11px] text-sand-500">
                          {customer.creditorNumber || "Ohne Nr."}
                          {customer.shortCode ? ` · ${customer.shortCode}` : ""}
                        </p>
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
                          <label className="inline-flex items-center gap-1">
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
                          <label className="inline-flex items-center gap-1">
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
                      <td className="px-3 py-2 align-top">
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
                        <div className="flex flex-wrap items-center gap-2">
                          {[
                            { id: "wartung", label: "Wartung" },
                            { id: "monitoring", label: "Monitoring" },
                            { id: "regie", label: "Regie" }
                          ].map((contract) => (
                            <label key={contract.id} className="inline-flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={Boolean((customer.contractFlags || []).includes(contract.id))}
                                onChange={(event) => {
                                  const nextFlags = applyContractFlagChange(
                                    customer.contractFlags || [],
                                    contract.id,
                                    event.target.checked
                                  );
                                  updateCustomer(customer.id, {
                                    contractFlags: nextFlags,
                                    maintenanceContract: nextFlags.includes("wartung")
                                  });
                                }}
                                className="h-3.5 w-3.5"
                              />
                              {contract.label}
                            </label>
                          ))}
                        </div>
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
