import { useEffect, useMemo, useState } from "react";
import { Boxes, CalendarClock, Check, Pencil, Plus, RefreshCw, ScanSearch, Search, Server, Trash2, Wifi } from "lucide-react";

const API = "/api";

const managedDeviceKey = (device, index) => {
  const agentId = String(device?.agentId || "").trim();
  if (agentId) return `agent:${agentId}`;
  const hostname = String(device?.hostname || "").trim().toLowerCase();
  const site = String(device?.site || "").trim().toLowerCase();
  return `managed:${hostname}:${site}:${index}`;
};

const discoveredDeviceKey = (device, index) => {
  const mac = String(device?.mac || "").trim().toLowerCase();
  const ip = String(device?.ip || "").trim().toLowerCase();
  const hostname = String(device?.hostname || "").trim().toLowerCase();
  if (mac) return `disc-mac:${mac}`;
  if (ip) return `disc-ip:${ip}`;
  if (hostname) return `disc-host:${hostname}`;
  return `disc:${index}`;
};

const formatLastSeen = (value) => {
  if (value === null || typeof value === "undefined") return "n/a";
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value).toLocaleString("de-DE");
  }
  const text = String(value || "").trim();
  if (!text) return "n/a";
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleString("de-DE");
  return text;
};

const compactText = (value) => String(value || "").trim();

const CONTRACT_TYPE_OPTIONS = [
  { value: "contract_o365", label: "Microsoft 365 / SaaS" },
  { value: "contract_external", label: "Externer Vertrag" },
  { value: "contract_other", label: "Sonstiger Vertrag" }
];

const BILLING_CYCLE_OPTIONS = [
  { value: "monthly", label: "Monatlich" },
  { value: "quarterly", label: "Quartalsweise" },
  { value: "yearly", label: "Jaehrlich" },
  { value: "biyearly", label: "Halbjaehrlich" },
  { value: "custom", label: "Individuell" }
];

const getContractTypeLabel = (type) => {
  const key = compactText(type).toLowerCase();
  const hit = CONTRACT_TYPE_OPTIONS.find((entry) => entry.value === key);
  if (hit) return hit.label;
  return "Wiederkehrender Vertrag";
};

const getBillingCycleLabel = (value) => {
  const key = compactText(value).toLowerCase();
  const hit = BILLING_CYCLE_OPTIONS.find((entry) => entry.value === key);
  if (hit) return hit.label;
  return "Individuell";
};

const normalizeContractTypeValue = (value) => {
  const key = compactText(value).toLowerCase();
  return CONTRACT_TYPE_OPTIONS.some((entry) => entry.value === key) ? key : "contract_other";
};

const normalizeBillingCycleValue = (value) => {
  const key = compactText(value).toLowerCase();
  return BILLING_CYCLE_OPTIONS.some((entry) => entry.value === key) ? key : "monthly";
};

const createContractDraft = () => ({
  device_label: "",
  event_type: "contract_o365",
  provider: "",
  billing_cycle: "monthly",
  cancellation_date: "",
  reminder_days: "60",
  is_external: false,
  note: ""
});

const normalizeIsoDate = (value) => {
  const text = compactText(value);
  if (!text) return "";
  const hit = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!hit) return "";
  const parsed = Date.parse(`${hit[1]}-${hit[2]}-${hit[3]}T00:00:00`);
  if (Number.isNaN(parsed)) return "";
  return `${hit[1]}-${hit[2]}-${hit[3]}`;
};

const toDateLabel = (value) => {
  const iso = normalizeIsoDate(value);
  if (!iso) return "n/a";
  const parsed = Date.parse(`${iso}T00:00:00`);
  if (Number.isNaN(parsed)) return "n/a";
  return new Date(parsed).toLocaleDateString("de-DE");
};

const toPositiveInt = (value, fallback = 60) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 3650) return 3650;
  return parsed;
};

const subDaysIso = (isoDate, days) => {
  const normalized = normalizeIsoDate(isoDate);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map((part) => Number.parseInt(part, 10));
  const cursor = new Date(year, month - 1, day);
  if (!Number.isFinite(cursor.getTime())) return "";
  cursor.setDate(cursor.getDate() - Math.max(0, toPositiveInt(days, 0)));
  const y = String(cursor.getFullYear()).padStart(4, "0");
  const m = String(cursor.getMonth() + 1).padStart(2, "0");
  const d = String(cursor.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const parseIsoMs = (isoDate) => {
  const normalized = normalizeIsoDate(isoDate);
  if (!normalized) return 0;
  const parsed = Date.parse(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
};

export default function CustomerInventoryTab({ customerId }) {
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState("idle");
  const [discoveryRun, setDiscoveryRun] = useState({ status: "idle", message: "", error: "" });
  const [deviceStates, setDeviceStates] = useState([]);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [stateBusyKey, setStateBusyKey] = useState("");
  const [stateError, setStateError] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [contractRows, setContractRows] = useState([]);
  const [contractsStatus, setContractsStatus] = useState("idle");
  const [contractsError, setContractsError] = useState("");
  const [contractBusy, setContractBusy] = useState(false);
  const [editingContractId, setEditingContractId] = useState(null);
  const [contractDraft, setContractDraft] = useState(createContractDraft);

  const recurringContractTypeSet = useMemo(
    () =>
      new Set(
        CONTRACT_TYPE_OPTIONS.map((entry) => String(entry?.value || "").trim().toLowerCase()).filter(Boolean)
      ),
    []
  );

  const load = async (refresh = false) => {
    if (!customerId) return;
    setStatus("loading");
    try {
      const response = await fetch(`${API}/customers/${customerId}/development?refresh=${refresh ? "1" : "0"}`);
      if (!response.ok) throw new Error("inventory_load_failed");
      const data = await response.json();
      setContext(data || null);
      setStatus("ready");
      if ((data?.managedInfrastructureDevices || []).length > 0) {
        setDiscoveryRun((prev) => {
          const message = String(prev?.message || "").toLowerCase();
          const error = String(prev?.error || "").toLowerCase();
          if (!message.includes("keine zugeordneten rmm-agenten") && !error.includes("keine zugeordneten rmm-agenten")) {
            return prev;
          }
          return { status: "idle", message: "", error: "" };
        });
      }
    } catch {
      setStatus("error");
    }
  };

  const runDiscovery = async () => {
    if (!customerId) return;
    setDiscoveryRun({ status: "loading", message: "", error: "" });
    try {
      const response = await fetch(`${API}/customers/${customerId}/development/discovery_run`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof data?.detail === "string" && data.detail.trim() ? data.detail.trim() : "Discovery konnte nicht gestartet werden";
        throw new Error(message);
      }
      if (data && data.started === false) {
        setDiscoveryRun({
          status: "ready",
          message: typeof data?.hint === "string" && data.hint.trim() ? data.hint.trim() : "Discovery nicht gestartet.",
          error: ""
        });
        return;
      }
      const serverMessage = typeof data?.message === "string" ? data.message.trim() : "";
      const serverHint = typeof data?.hint === "string" ? data.hint.trim() : "";
      setDiscoveryRun({
        status: "done",
        message: serverMessage || `Discovery gestartet.${serverHint ? ` ${serverHint}` : ""}`.trim(),
        error: ""
      });
      await load(true);
    } catch (error) {
      setDiscoveryRun({
        status: "error",
        message: "",
        error: error?.message ? String(error.message) : "Discovery konnte nicht gestartet werden"
      });
    }
  };

  const loadDeviceStates = async () => {
    if (!customerId) return;
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_device_states`);
      if (!response.ok) throw new Error("inventory_states_load_failed");
      const data = await response.json();
      setDeviceStates(Array.isArray(data) ? data : []);
    } catch {
      setDeviceStates([]);
    }
  };

  const loadContracts = async () => {
    if (!customerId) return;
    setContractsStatus("loading");
    setContractsError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_events`);
      if (!response.ok) throw new Error("inventory_contracts_load_failed");
      const data = await response.json();
      const rows = (Array.isArray(data) ? data : []).filter((row) => {
        const type = compactText(row?.event_type).toLowerCase();
        return Boolean(row?.is_recurring) || type.startsWith("contract_") || recurringContractTypeSet.has(type);
      });
      setContractRows(rows);
      setContractsStatus("ready");
    } catch {
      setContractRows([]);
      setContractsStatus("error");
      setContractsError("Wiederkehrende Vertraege konnten nicht geladen werden.");
    }
  };

  const resetContractDraft = () => {
    setEditingContractId(null);
    setContractDraft(createContractDraft());
  };

  const saveContract = async () => {
    if (!customerId) return;
    const label = compactText(contractDraft.device_label);
    const cancellationDate = normalizeIsoDate(contractDraft.cancellation_date);
    if (!label) {
      setContractsError("Bitte mindestens einen Vertragsnamen eintragen.");
      return;
    }
    if (!cancellationDate) {
      setContractsError("Bitte ein gueltiges Kuendigungsdatum setzen.");
      return;
    }
    setContractBusy(true);
    setContractsError("");
    const payload = {
      device_label: label,
      event_type: normalizeContractTypeValue(contractDraft.event_type),
      provider: compactText(contractDraft.provider),
      billing_cycle: normalizeBillingCycleValue(contractDraft.billing_cycle),
      cancellation_date: cancellationDate,
      event_date: cancellationDate,
      reminder_days: toPositiveInt(contractDraft.reminder_days, 60),
      is_external: Boolean(contractDraft.is_external),
      is_recurring: true,
      note: compactText(contractDraft.note)
    };
    try {
      const url = editingContractId
        ? `${API}/customers/${customerId}/inventory_events/${editingContractId}`
        : `${API}/customers/${customerId}/inventory_events`;
      const method = editingContractId ? "PATCH" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("inventory_contract_save_failed");
      await loadContracts();
      resetContractDraft();
    } catch {
      setContractsError("Vertrag konnte nicht gespeichert werden.");
    } finally {
      setContractBusy(false);
    }
  };

  const editContract = (row) => {
    if (!row?.id) return;
    setEditingContractId(row.id);
    setContractDraft({
      device_label: compactText(row.device_label),
      event_type: normalizeContractTypeValue(row.event_type || "contract_other"),
      provider: compactText(row.provider),
      billing_cycle: normalizeBillingCycleValue(row.billing_cycle || "monthly"),
      cancellation_date: normalizeIsoDate(row.cancellation_date || row.event_date),
      reminder_days: String(toPositiveInt(row.reminder_days, 60)),
      is_external: Boolean(row.is_external),
      note: compactText(row.note)
    });
    setContractsError("");
  };

  const deleteContract = async (eventId) => {
    if (!customerId || !eventId) return;
    if (!window.confirm("Wiederkehrenden Vertrag wirklich entfernen?")) return;
    setContractBusy(true);
    setContractsError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_events/${eventId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("inventory_contract_delete_failed");
      if (editingContractId === eventId) resetContractDraft();
      await loadContracts();
    } catch {
      setContractsError("Vertrag konnte nicht geloescht werden.");
    } finally {
      setContractBusy(false);
    }
  };

  const upsertDeviceState = async ({ source, deviceKey, label, retired, note }) => {
    if (!customerId || !source || !deviceKey) return;
    const busyKey = `${source}:${deviceKey}`;
    setStateBusyKey(busyKey);
    setStateError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_device_states`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          device_key: deviceKey,
          device_label: label || "",
          retired: Boolean(retired),
          note: compactText(note)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("state_upsert_failed");
      setDeviceStates((prev) => {
        const idx = prev.findIndex(
          (item) => String(item?.source || "") === String(data?.source || "") && String(item?.device_key || "") === String(data?.device_key || "")
        );
        if (idx === -1) return [data, ...prev];
        const next = prev.slice();
        next[idx] = data;
        return next;
      });
      setNoteDrafts((prev) => ({ ...prev, [busyKey]: String(data?.note || "") }));
    } catch {
      setStateError("Änderung konnte nicht gespeichert werden.");
    } finally {
      setStateBusyKey("");
    }
  };

  useEffect(() => {
    setDiscoveryRun({ status: "idle", message: "", error: "" });
    setStateError("");
    setNoteDrafts({});
    setContractsError("");
    setContractRows([]);
    setContractsStatus("idle");
    resetContractDraft();
    load(false);
    loadDeviceStates();
    loadContracts();
  }, [customerId]);

  const managed = useMemo(() => (Array.isArray(context?.managedInfrastructureDevices) ? context.managedInfrastructureDevices : []), [context]);
  const discovered = useMemo(
    () => (Array.isArray(context?.discoveredInfrastructureDevices) ? context.discoveredInfrastructureDevices : []),
    [context]
  );

  const stateMap = useMemo(() => {
    const map = new Map();
    (deviceStates || []).forEach((entry) => {
      const source = String(entry?.source || "").trim().toLowerCase();
      const key = String(entry?.device_key || "");
      if (!source || !key) return;
      map.set(`${source}:${key}`, entry);
    });
    return map;
  }, [deviceStates]);

  const unifiedDevices = useMemo(() => {
    const rows = [];

    managed.forEach((device, index) => {
      const deviceKey = managedDeviceKey(device, index);
      const compositeKey = `rmm:${deviceKey}`;
      const state = stateMap.get(compositeKey);
      rows.push({
        rowKey: `row:${compositeKey}`,
        source: "rmm",
        sourceLabel: "RMM",
        sourceIcon: "rmm",
        label: compactText(device?.hostname) || compactText(device?.agentId) || "Unbekanntes Gerät",
        secondary:
          [
            compactText(device?.os) ? `OS: ${compactText(device?.os)}` : "",
            compactText(device?.site) ? `Site: ${compactText(device?.site)}` : ""
          ]
            .filter(Boolean)
            .join(" · ") || "Keine Detaildaten",
        tertiary: `Last Seen: ${formatLastSeen(device?.lastSeen)}`,
        online: Boolean(device?.online),
        deviceKey,
        retired: Boolean(state?.retired),
        inactive: false,
        note: compactText(state?.note)
      });
    });

    discovered.forEach((device, index) => {
      const deviceKey = discoveredDeviceKey(device, index);
      const compositeKey = `discovery:${deviceKey}`;
      const state = stateMap.get(compositeKey);
      rows.push({
        rowKey: `row:${compositeKey}`,
        source: "discovery",
        sourceLabel: "Discovery",
        sourceIcon: "discovery",
        label: compactText(device?.hostname) || compactText(device?.ip) || compactText(device?.mac) || "Discovery Gerät",
        secondary:
          [
            compactText(device?.deviceType) ? `Typ: ${compactText(device?.deviceType)}` : "",
            compactText(device?.vendor) ? `Hersteller: ${compactText(device?.vendor)}` : "",
            compactText(device?.ip) ? `IP: ${compactText(device?.ip)}` : "",
            compactText(device?.mac) ? `MAC: ${compactText(device?.mac)}` : ""
          ]
            .filter(Boolean)
            .join(" · ") || "Keine Detaildaten",
        tertiary: `Last Seen: ${formatLastSeen(device?.lastSeenAt)}`,
        online: null,
        deviceKey,
        retired: Boolean(state?.retired),
        inactive: device?.active === false,
        note: compactText(state?.note)
      });
    });

    rows.sort((a, b) => {
      const retiredDelta = Number(a.retired) - Number(b.retired);
      if (retiredDelta !== 0) return retiredDelta;
      const inactiveDelta = Number(a.inactive) - Number(b.inactive);
      if (inactiveDelta !== 0) return inactiveDelta;
      const sourceDelta = a.source === b.source ? 0 : a.source === "rmm" ? -1 : 1;
      if (sourceDelta !== 0) return sourceDelta;
      return a.label.localeCompare(b.label, "de", { sensitivity: "base" });
    });

    return rows;
  }, [managed, discovered, stateMap]);

  useEffect(() => {
    setNoteDrafts((prev) => {
      const next = {};
      let changed = false;
      unifiedDevices.forEach((entry) => {
        const key = `${entry.source}:${entry.deviceKey}`;
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key];
          return;
        }
        next[key] = entry.note || "";
        changed = true;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (!changed && prevKeys.length === nextKeys.length && prevKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [unifiedDevices]);

  const filteredDevices = useMemo(() => {
    const query = compactText(searchTerm).toLowerCase();
    return unifiedDevices.filter((entry) => {
      if (deviceFilter === "active" && (entry.retired || entry.inactive)) return false;
      if (deviceFilter === "retired" && !entry.retired) return false;
      if (!query) return true;
      const haystack = [
        entry.label,
        entry.sourceLabel,
        entry.secondary,
        entry.tertiary,
        entry.inactive ? "inaktiv" : "aktiv",
        noteDrafts[`${entry.source}:${entry.deviceKey}`] || entry.note || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deviceFilter, noteDrafts, searchTerm, unifiedDevices]);

  const totalDevices = unifiedDevices.length;
  const totalRetired = unifiedDevices.filter((entry) => entry.retired).length;
  const totalInactive = unifiedDevices.filter((entry) => entry.inactive).length;
  const totalActive = Math.max(0, totalDevices - totalRetired - totalInactive);

  const sortedContracts = useMemo(() => {
    const rows = Array.isArray(contractRows) ? contractRows.slice() : [];
    rows.sort((a, b) => {
      const aDate = parseIsoMs(a?.cancellation_date || a?.event_date);
      const bDate = parseIsoMs(b?.cancellation_date || b?.event_date);
      if (!aDate && bDate) return 1;
      if (aDate && !bDate) return -1;
      if (aDate && bDate && aDate !== bDate) return aDate - bDate;
      return compactText(a?.device_label).localeCompare(compactText(b?.device_label), "de", { sensitivity: "base" });
    });
    return rows;
  }, [contractRows]);

  const contractsWithSteering = useMemo(() => {
    const nowMs = Date.now();
    return sortedContracts.map((row) => {
      const cancellationDate = normalizeIsoDate(row?.cancellation_date || row?.event_date);
      const reminderDays = toPositiveInt(row?.reminder_days, 60);
      const steeringDate = subDaysIso(cancellationDate, reminderDays);
      const steeringDue = Boolean(parseIsoMs(steeringDate) && parseIsoMs(steeringDate) <= nowMs);
      const cancellationDue = Boolean(parseIsoMs(cancellationDate) && parseIsoMs(cancellationDate) <= nowMs);
      return {
        ...row,
        cancellationDate,
        reminderDays,
        steeringDate,
        steeringDue,
        cancellationDue
      };
    });
  }, [sortedContracts]);

  const upcomingContractCount = contractsWithSteering.filter((row) => row.steeringDue && !row.cancellationDue).length;

  const saveNote = async (entry) => {
    const noteKey = `${entry.source}:${entry.deviceKey}`;
    await upsertDeviceState({
      source: entry.source,
      deviceKey: entry.deviceKey,
      label: entry.label,
      retired: entry.retired,
      note: noteDrafts[noteKey] ?? ""
    });
  };

  const toggleRetired = async (entry) => {
    const noteKey = `${entry.source}:${entry.deviceKey}`;
    await upsertDeviceState({
      source: entry.source,
      deviceKey: entry.deviceKey,
      label: entry.label,
      retired: !entry.retired,
      note: noteDrafts[noteKey] ?? entry.note ?? ""
    });
  };

  if (!customerId) {
    return <p className="text-sm text-sand-500">Kein Kunde ausgewählt.</p>;
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Inventar konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Inventar</p>
          <h3 className="text-lg font-display text-sand-900">Geräteübersicht</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(true)}
            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
          >
            <RefreshCw size={12} />
            Aktualisieren
          </button>
          <button
            type="button"
            onClick={runDiscovery}
            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
          >
            <ScanSearch size={12} />
            Discovery starten
          </button>
        </div>
      </div>

      {discoveryRun.status === "loading" ? <p className="text-xs text-sand-500">Discovery läuft…</p> : null}
      {discoveryRun.message ? <p className="text-xs text-emerald-700">{discoveryRun.message}</p> : null}
      {discoveryRun.error ? <p className="text-xs text-rose-600">{discoveryRun.error}</p> : null}
      {stateError ? <p className="text-xs text-rose-600">{stateError}</p> : null}

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Gesamt</p>
          <p className="text-sm font-semibold text-sand-900">{totalDevices}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Aktiv</p>
          <p className="text-sm font-semibold text-emerald-700">{totalActive}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Ausgeschieden</p>
          <p className="text-sm font-semibold text-slate-700">{totalRetired}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Discovery Inaktiv</p>
          <p className="text-sm font-semibold text-amber-700">{totalInactive}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-xs text-sand-600">
          <Search size={12} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Gerät, IP, OS, Notiz..."
            className="w-44 bg-transparent text-xs outline-none placeholder:text-sand-400"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDeviceFilter("all")}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              deviceFilter === "all" ? "border-sand-900 bg-sand-900 text-white" : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            }`}
          >
            Alle
          </button>
          <button
            type="button"
            onClick={() => setDeviceFilter("active")}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              deviceFilter === "active"
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Aktiv
          </button>
          <button
            type="button"
            onClick={() => setDeviceFilter("retired")}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              deviceFilter === "retired"
                ? "border-slate-700 bg-slate-700 text-white"
                : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Ausgeschieden
          </button>
        </div>
      </div>

      {context?.infra?.rmmMappingHint && managed.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">{context.infra.rmmMappingHint}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-sand-200 bg-white">
        <div className="border-b border-sand-200 px-3 py-2 text-xs text-sand-600">
          Einheitliche Liste aus RMM und Discovery. Pro Gerät nur Status und Anmerkung pflegen.
        </div>
        <div className="divide-y divide-sand-200">
          {filteredDevices.length ? (
            filteredDevices.map((entry, index) => {
              const noteKey = `${entry.source}:${entry.deviceKey}`;
              const busy = stateBusyKey === noteKey;
              const draftNote = noteDrafts[noteKey] ?? "";
              const noteChanged = draftNote !== (entry.note || "");
              const rowBackground = index % 2 === 0 ? "bg-white" : "bg-sand-50/70";
              return (
                <div key={entry.rowKey} className={`${rowBackground} px-3 py-2`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className={`min-w-[220px] flex-1 ${entry.retired || entry.inactive ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {entry.sourceIcon === "rmm" ? <Server size={13} className="text-sand-500" /> : <Wifi size={13} className="text-sand-500" />}
                        <p className="text-sm font-semibold text-sand-900">{entry.label}</p>
                        <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-600">
                          {entry.sourceLabel}
                        </span>
                        {entry.inactive ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                            Inaktiv
                          </span>
                        ) : null}
                        {entry.online === true ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">
                            Online
                          </span>
                        ) : null}
                        {entry.online === false ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                            Offline
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-sand-600">{entry.secondary}</p>
                      <p className="mt-0.5 text-[11px] text-sand-500">{entry.tertiary}</p>
                    </div>
                    <div className="flex min-w-[260px] flex-1 flex-wrap items-center justify-end gap-1.5">
                      <input
                        value={draftNote}
                        onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [noteKey]: event.target.value }))}
                        placeholder="Anmerkung, z. B. letzter Akkutausch 02/2026"
                        className="w-full min-w-[220px] flex-1 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveNote(entry)}
                        disabled={busy || !noteChanged}
                        className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Anmerkung speichern"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRetired(entry)}
                        disabled={busy}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] uppercase tracking-wide ${
                          entry.retired
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {busy ? "..." : entry.retired ? "Ausgeschieden" : "Aktiv"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="px-3 py-3 text-xs text-sand-500">
              {totalDevices ? "Keine Geräte für den aktuellen Filter gefunden." : "Noch keine Geräte vorhanden."}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white">
        <div className="border-b border-sand-200 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-sand-500">Wiederkehrende Vertraege</p>
              <p className="text-sm font-semibold text-sand-900">Kuendigungs- und Vorlaufsteuerung</p>
            </div>
            {upcomingContractCount > 0 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                {upcomingContractCount} im Vorlauf
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2 border-b border-sand-200 px-3 py-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={contractDraft.device_label}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, device_label: event.target.value }))}
              placeholder="Vertragsname, z. B. Microsoft 365 Business Premium"
              className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs"
            />
            <input
              value={contractDraft.provider}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, provider: event.target.value }))}
              placeholder="Anbieter, z. B. Microsoft, A1, Lease-Partner"
              className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs"
            />
            <select
              value={contractDraft.event_type}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, event_type: event.target.value }))}
              className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs"
            >
              {CONTRACT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={contractDraft.billing_cycle}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, billing_cycle: event.target.value }))}
              className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs"
            >
              {BILLING_CYCLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs text-sand-700">
              <span className="text-sand-500">Kuendigungsdatum</span>
              <input
                type="date"
                value={contractDraft.cancellation_date}
                onChange={(event) => setContractDraft((prev) => ({ ...prev, cancellation_date: event.target.value }))}
                className="min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs text-sand-700">
              <span className="text-sand-500">Vorlauf (Tage)</span>
              <input
                type="number"
                min={0}
                step={1}
                value={contractDraft.reminder_days}
                onChange={(event) => setContractDraft((prev) => ({ ...prev, reminder_days: event.target.value }))}
                className="min-w-0 flex-1 bg-transparent text-right outline-none"
              />
            </label>
            <label className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs text-sand-700">
              <input
                type="checkbox"
                checked={Boolean(contractDraft.is_external)}
                onChange={(event) => setContractDraft((prev) => ({ ...prev, is_external: event.target.checked }))}
                className="h-3.5 w-3.5 rounded border-sand-300"
              />
              Externer Vertrag
            </label>
            <input
              value={contractDraft.note}
              onChange={(event) => setContractDraft((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Notiz (optional)"
              className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-sand-500">
              Steuerungsstart: {toDateLabel(subDaysIso(contractDraft.cancellation_date, contractDraft.reminder_days))}
            </p>
            <div className="flex items-center gap-2">
              {editingContractId ? (
                <button
                  type="button"
                  onClick={resetContractDraft}
                  disabled={contractBusy}
                  className="rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Bearbeitung verwerfen
                </button>
              ) : null}
              <button
                type="button"
                onClick={saveContract}
                disabled={contractBusy}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingContractId ? <Check size={13} /> : <Plus size={13} />}
                {editingContractId ? "Vertrag speichern" : "Vertrag erfassen"}
              </button>
            </div>
          </div>
          {contractsError ? <p className="text-xs text-rose-600">{contractsError}</p> : null}
        </div>

        <div className="divide-y divide-sand-200">
          {contractsStatus === "loading" ? <p className="px-3 py-3 text-xs text-sand-500">Lade Vertraege…</p> : null}
          {contractsStatus === "error" ? <p className="px-3 py-3 text-xs text-rose-600">{contractsError}</p> : null}
          {contractsStatus !== "loading" && contractsWithSteering.length === 0 ? (
            <p className="px-3 py-3 text-xs text-sand-500">Noch keine wiederkehrenden Vertraege hinterlegt.</p>
          ) : null}
          {contractsWithSteering.map((row, index) => {
            const rowBackground = index % 2 === 0 ? "bg-white" : "bg-sand-50/70";
            return (
              <div key={`contract:${row.id}`} className={`${rowBackground} px-3 py-2`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-[220px] flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <CalendarClock size={13} className="text-sand-500" />
                      <p className="text-sm font-semibold text-sand-900">{compactText(row.device_label) || "Vertrag"}</p>
                      <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-600">
                        {getContractTypeLabel(row.event_type)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          row.is_external
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {row.is_external ? "Extern" : "Intern"}
                      </span>
                      {row.cancellationDue ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                          Kuendigung faellig
                        </span>
                      ) : row.steeringDue ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                          Vorlauf aktiv
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-sand-600">
                      Anbieter: {compactText(row.provider) || "n/a"} · Intervall: {getBillingCycleLabel(row.billing_cycle)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-sand-500">
                      Kuendigungsdatum: {toDateLabel(row.cancellationDate)} · Steuerung ab: {toDateLabel(row.steeringDate)} (
                      {row.reminderDays} Tage Vorlauf)
                    </p>
                    {compactText(row.note) ? <p className="mt-0.5 text-[11px] text-sand-500">Notiz: {compactText(row.note)}</p> : null}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => editContract(row)}
                      disabled={contractBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil size={12} />
                      Bearbeiten
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteContract(row.id)}
                      disabled={contractBusy}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      Loeschen
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {status === "loading" ? (
        <p className="inline-flex items-center gap-1 text-xs text-sand-500">
          <Boxes size={12} /> Inventar wird geladen…
        </p>
      ) : null}
    </div>
  );
}
