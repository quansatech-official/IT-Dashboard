import { Component, useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Megaphone,
  Phone,
  PhoneForwarded,
  PhoneIncoming,
  RefreshCw,
  RotateCcw,
  Save,
  Users,
  Zap
} from "lucide-react";
import CallListView from "./CallListView";
import CallStatsView from "./CallStatsView";
import TelephonyMaintenanceView from "./TelephonyMaintenanceView";
import { telephonyService } from "./telephonyService";

// ─── Error boundary ──────────────────────────────────────────────────────────

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Fehler beim Laden: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const defaultSettings = {
  baseUrl: "https://providersupportdata.cloud-cfg.com",
  username: "", password: "", streamEnabled: false,
  hasPassword: false, hasRefreshToken: false,
  numerifyReverseUrl: "", numerifyApiHeader: "", numerifyApiKey: "", hasNumerifyApiKey: false
};

const primaryTabs = [
  { key: "monitoring", label: "Monitoring", icon: PhoneIncoming },
  { key: "phonebook", label: "Telefonbuch", icon: Phone }
];

const nfonTabs = [
  { key: "time_rules",    label: "Zeitsteuerung",    icon: CalendarClock },
  { key: "quick_modes",   label: "Schnellmodi",       icon: Zap },
  { key: "forwards",      label: "Weiterleitungen",   icon: PhoneForwarded },
  { key: "groups",        label: "Rufgruppen",        icon: Users },
  { key: "queues",        label: "Warteschlangen",    icon: BellRing },
  { key: "announcements", label: "Ansagen",           icon: Megaphone },
  { key: "oncall",        label: "Bereitschaft",      icon: GitBranch }
];

// Per-tab UI metadata
const panelMeta = {
  time_rules:    { eyebrow: "Geschäftszeiten",  title: "Zeitsteuerung",   hint: "Öffnungszeiten, Feiertage und Sonderzeiten der Telefonanlage verwalten.", icon: CalendarClock, primaryFields: ["active","enabled","isActive","isEnabled","name","displayName","schedule","timeZone"] },
  quick_modes:   { eyebrow: "Betriebsmodus",    title: "Schnellmodi",     hint: "Vordefinierte Modi (Normal, Feiertag, Urlaub, Notdienst) schnell umschalten.", icon: Zap, primaryFields: ["active","enabled","isActive","name","displayName","mode","target","destination"] },
  forwards:      { eyebrow: "Routing",          title: "Weiterleitungen", hint: "Rufweiterleitungen auf Nebenstellen, Gruppen oder externe Nummern steuern.", icon: PhoneForwarded, primaryFields: ["active","enabled","isActive","target","destination","number","extension","displayName","name"] },
  groups:        { eyebrow: "Teams",            title: "Rufgruppen",      hint: "Mitglieder und Klingelstrategien der Rufgruppen verwalten.", icon: Users, primaryFields: ["name","displayName","active","enabled","strategy","timeout","members"] },
  queues:        { eyebrow: "Queue",            title: "Warteschlangen",  hint: "Warteschlangen-Parameter, Agentenstatus und Überlaufziele pflegen.", icon: BellRing, primaryFields: ["name","displayName","active","enabled","maxWaitTime","overflow","agents"] },
  announcements: { eyebrow: "Audio",            title: "Ansagen",         hint: "Ansagedateien für verschiedene Szenarien verwalten.", icon: Megaphone, primaryFields: ["name","displayName","active","enabled","filename","url","type"] },
  oncall:        { eyebrow: "Notdienst",        title: "Bereitschaft",    hint: "Bereitschaftsdienst-Routing und aktive Notdienstnummern steuern.", icon: GitBranch, primaryFields: ["active","enabled","isActive","target","destination","name","displayName","rotation"] }
};

// ─── NFON field helpers ───────────────────────────────────────────────────────

const SKIP_KEYS = new Set(["_links","_embedded","href","self","links"]);

function extractFields(raw) {
  if (!raw || typeof raw !== "object") return [];
  // NFON data:[{name,value}] format
  if (Array.isArray(raw.data)) {
    return raw.data
      .filter((f) => f && typeof f === "object" && f.name)
      .map((f) => ({ name: String(f.name), value: f.value, source: "data" }));
  }
  // Direct properties
  return Object.entries(raw)
    .filter(([k]) => !SKIP_KEYS.has(k))
    .map(([k, v]) => ({ name: k, value: v, source: "direct" }));
}

function applyFieldChange(raw, fieldName, newValue, source) {
  if (source === "data") {
    return {
      ...raw,
      data: (Array.isArray(raw.data) ? raw.data : []).map((f) =>
        f.name === fieldName ? { ...f, value: newValue } : f
      )
    };
  }
  return { ...raw, [fieldName]: newValue };
}

function guessFieldType(name, value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "object" || Array.isArray(value)) return "readonly";
  const lc = name.toLowerCase();
  if (lc.includes("active") || lc.includes("enabled") || lc.includes("enable")) return "boolean";
  if (lc.includes("time") || lc.includes("date")) return "text";
  if (lc.includes("number") || lc.includes("extension") || lc.includes("port")) return "text";
  return "text";
}

function humanLabel(name) {
  // camelCase → "Camel Case", snake_case → "Snake case"
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function isBooleanLike(value, name) {
  if (typeof value === "boolean") return true;
  const lc = name.toLowerCase();
  if (lc.includes("active") || lc.includes("enabled")) {
    return value === "true" || value === "false" || value === true || value === false;
  }
  return false;
}

function parseBool(value) {
  if (typeof value === "boolean") return value;
  return String(value).toLowerCase() === "true";
}

// ─── Field editor ─────────────────────────────────────────────────────────────

function FieldRow({ field, onChange }) {
  const { name, value } = field;
  const type = guessFieldType(name, value);
  const label = humanLabel(name);

  if (type === "readonly") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-sand-400">{label}</span>
        <span className="truncate rounded-lg border border-sand-100 bg-sand-50 px-2 py-1.5 font-mono text-[11px] text-sand-500">
          {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
        </span>
      </div>
    );
  }

  if (type === "boolean" || isBooleanLike(value, name)) {
    const checked = parseBool(value);
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-sand-200 bg-white px-3 py-2.5">
        <span className="text-sm font-medium text-sand-800">{label}</span>
        <button
          type="button"
          onClick={() => onChange(name, !checked, field.source)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            checked
              ? "border-emerald-500 bg-emerald-500 focus:ring-emerald-400"
              : "border-sand-300 bg-sand-200 focus:ring-sand-300"
          }`}
          role="switch"
          aria-checked={checked}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] uppercase tracking-[0.18em] text-sand-400">{label}</label>
      <input
        type={type === "number" ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => onChange(name, type === "number" ? Number(e.target.value) : e.target.value, field.source)}
        className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
      />
    </div>
  );
}

// ─── Item card (expandable) ───────────────────────────────────────────────────

function NfonItemCard({ item, itemPath, controlKey, primaryFields, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fields = useMemo(() => {
    const all = extractFields(item.raw || {});
    // Sort: primary fields first, then rest alphabetically
    const primary = new Set(primaryFields.map((f) => f.toLowerCase()));
    const prio = all.filter((f) => primary.has(f.name.toLowerCase()));
    const rest = all.filter((f) => !primary.has(f.name.toLowerCase()));
    return [...prio, ...rest];
  }, [item.raw, primaryFields]);

  const visibleFields = fields.filter((f) => guessFieldType(f.name, f.value) !== "readonly");
  const boolFields = visibleFields.filter((f) => guessFieldType(f.name, f.value) === "boolean" || isBooleanLike(f.value, f.name));
  const activeField = boolFields.find((f) => ["active","enabled","isActive","isEnabled"].includes(f.name.toLowerCase()));
  const isActive = activeField ? parseBool(activeField.value) : null;

  const currentDraft = draft ?? item.raw;

  const handleChange = (fieldName, newValue, source) => {
    setDraft((prev) => applyFieldChange(prev ?? item.raw, fieldName, newValue, source));
    setMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await telephonyService.mutateNfonControl(controlKey, {
        method: "PATCH",
        path: itemPath,
        body: currentDraft
      });
      setMessage({ ok: true, text: "Gespeichert." });
      onSaved?.();
      setDraft(null);
    } catch (err) {
      setMessage({ ok: false, text: err?.message || "Speichern fehlgeschlagen." });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = draft !== null;

  return (
    <div className={`overflow-hidden rounded-2xl border transition ${expanded ? "border-sky-200 shadow-sm" : "border-sand-200"} bg-white`}>
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sand-50 transition"
      >
        {isActive !== null ? (
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? "bg-emerald-500" : "bg-sand-300"}`} />
        ) : (
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sand-200" />
        )}
        <span className="flex-1">
          <span className="block text-sm font-medium text-sand-900">{item.label || item.id}</span>
          {item.id && item.id !== item.label ? (
            <span className="block font-mono text-[10px] text-sand-400">{item.id}</span>
          ) : null}
        </span>
        {isActive !== null ? (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sand-200 bg-sand-50 text-sand-500"}`}>
            {isActive ? "Aktiv" : "Inaktiv"}
          </span>
        ) : null}
        {expanded ? <ChevronDown size={15} className="shrink-0 text-sand-400" /> : <ChevronRight size={15} className="shrink-0 text-sand-400" />}
      </button>

      {/* Expanded editor */}
      {expanded ? (
        <div className="border-t border-sand-100 px-4 pb-4 pt-3">
          {visibleFields.length === 0 ? (
            <p className="text-sm text-sand-400">Keine bearbeitbaren Felder verfügbar.</p>
          ) : (
            <div className="space-y-3">
              {/* Boolean toggles first */}
              {boolFields.length > 0 ? (
                <div className="space-y-2">
                  {boolFields.map((field) => {
                    const currentFields = extractFields(currentDraft || {});
                    const current = currentFields.find((f) => f.name === field.name) || field;
                    return (
                      <FieldRow key={field.name} field={current} onChange={handleChange} />
                    );
                  })}
                </div>
              ) : null}
              {/* Text/number fields */}
              {visibleFields.filter((f) => guessFieldType(f.name, f.value) !== "boolean" && !isBooleanLike(f.value, f.name)).length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {visibleFields
                    .filter((f) => guessFieldType(f.name, f.value) !== "boolean" && !isBooleanLike(f.value, f.name))
                    .map((field) => {
                      const currentFields = extractFields(currentDraft || {});
                      const current = currentFields.find((f) => f.name === field.name) || field;
                      return (
                        <FieldRow key={field.name} field={current} onChange={handleChange} />
                      );
                    })}
                </div>
              ) : null}
            </div>
          )}

          {/* Save row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {message ? (
              <p className={`text-xs font-medium ${message.ok ? "text-emerald-700" : "text-rose-600"}`}>{message.text}</p>
            ) : hasChanges ? (
              <p className="text-xs text-amber-600">Ungespeicherte Änderungen</p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {hasChanges ? (
                <button
                  type="button"
                  onClick={() => { setDraft(null); setMessage(null); }}
                  className="rounded-xl border border-sand-200 bg-white px-3 py-1.5 text-xs text-sand-600 hover:bg-sand-50"
                >
                  Verwerfen
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sand-900 bg-sand-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                Speichern
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Smart NFON control panel ─────────────────────────────────────────────────

function NfonControlPanel({ controlKey }) {
  const meta = panelMeta[controlKey] || { eyebrow: "NFON", title: controlKey, hint: "", icon: Phone, primaryFields: [] };
  const Icon = meta.icon;

  const [state, setState] = useState({ status: "idle", data: null, error: "" });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: "loading", error: "" }));
    try {
      const data = await telephonyService.fetchNfonControl(controlKey);
      setState({ status: "ready", data, error: "" });
    } catch (err) {
      setState({ status: "error", data: null, error: err?.message || "NFON Ressource konnte nicht geladen werden." });
    }
  }, [controlKey]);

  useEffect(() => { load(); }, [load]);

  const items = Array.isArray(state.data?.items) ? state.data.items : [];
  const basePath = String(state.data?.path || "").replace(/\/$/, "");

  const getItemPath = (item) =>
    item?.id ? `${basePath}/${encodeURIComponent(item.id)}` : basePath;

  return (
    <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
      {/* Header */}
      <div className="border-b border-sand-100 bg-sand-50/70 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sand-200 bg-white text-sand-600">
              <Icon size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] font-medium text-sand-500">{meta.eyebrow} · NFON</p>
              <h2 className="text-xl font-display text-sand-900">{meta.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={state.status === "loading"}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-medium text-sand-700 hover:bg-sand-50 disabled:opacity-50"
          >
            <RefreshCw size={13} className={state.status === "loading" ? "animate-spin" : ""} />
            Aktualisieren
          </button>
        </div>
        {meta.hint ? <p className="mt-2 text-sm text-sand-500">{meta.hint}</p> : null}
        {state.data?.path ? (
          <p className="mt-1 font-mono text-[10px] text-sand-300">NFON: {state.data.path}</p>
        ) : null}
      </div>

      {/* Body */}
      <div className="p-6">
        {state.status === "loading" && !items.length ? (
          <div className="flex items-center gap-2.5 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-5 text-sm text-sand-500">
            <RefreshCw size={14} className="animate-spin" />
            Daten werden von NFON geladen…
          </div>
        ) : state.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <p className="font-medium">Fehler beim Laden</p>
            <p className="mt-0.5 text-xs opacity-80">{state.error}</p>
          </div>
        ) : state.data?.available === false ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-medium text-amber-800">Ressource nicht verfügbar</p>
            <p className="mt-0.5 text-xs text-amber-700 opacity-80">
              {state.data.message || "Diese NFON-Funktion ist für den konfigurierten Account nicht freigeschaltet."}
            </p>
          </div>
        ) : items.length ? (
          <div className="space-y-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-sand-400">{items.length} {items.length === 1 ? "Eintrag" : "Einträge"} · Klicken zum Bearbeiten</span>
            </div>
            {items.map((item) => (
              <NfonItemCard
                key={item.id || item.label}
                item={item}
                itemPath={getItemPath(item)}
                controlKey={controlKey}
                primaryFields={meta.primaryFields}
                onSaved={load}
              />
            ))}
          </div>
        ) : state.status === "ready" ? (
          <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-5 text-sm text-sand-500">
            NFON Ressource erreichbar — keine Einträge vorhanden.
          </div>
        ) : null}
      </div>
    </section>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function TelephonyView() {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({ total: 0, answered: 0, missed: 0, avgDuration: 0, byHour: [] });
  const [activeTab, setActiveTab] = useState("monitoring");
  const [settings, setSettings] = useState(defaultSettings);
  const [apiStatus, setApiStatus] = useState("idle");
  const [extensions, setExtensions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pbxEntries, setPbxEntries] = useState([]);
  const [pbxApiActive, setPbxApiActive] = useState(false);

  const hasCredentials = Boolean(
    (settings.hasPassword && settings.username?.trim()) || settings.hasRefreshToken
  );

  const handleResolveCallback = async (call) => {
    if (!call?.uuid) return null;
    const updated = await telephonyService.resolveCallback(call.uuid, true);
    if (updated?.uuid) {
      setCalls((prev) =>
        prev.map((item) => item.uuid === updated.uuid ? { ...item, callbackResolved: updated.callbackResolved } : item)
      );
    }
    return updated;
  };

  useEffect(() => {
    let active = true;
    telephonyService.fetchSettings().then((data) => {
      if (!active) return;
      setSettings({ ...defaultSettings, ...data, baseUrl: data?.baseUrl?.trim() ? data.baseUrl : defaultSettings.baseUrl, password: "" });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchExtensions().then((data) => { if (!active) return; setExtensions(Array.isArray(data) ? data : []); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchCustomers().then((data) => { if (!active) return; setCustomers(Array.isArray(data) ? data : []); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchPbxPhonebook().then((data) => { if (!active) return; setPbxEntries(Array.isArray(data) ? data : []); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.checkPbxHealth().then((ok) => { if (!active) return; setPbxApiActive(ok); });
    return () => { active = false; };
  }, []);

  const handleAddToPbx = async (payload) => {
    const result = await telephonyService.createPbxPhonebookEntry(payload);
    const fresh = await telephonyService.fetchPbxPhonebook();
    setPbxEntries(Array.isArray(fresh) ? fresh : []);
    if (!result) throw new Error("pbx_add_failed");
    return result;
  };

  const handleAssignNumber = async (customerId, number) => {
    if (!customerId || !number) return { ok: false, error: "Kunde oder Rufnummer fehlt." };
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) return { ok: false, error: "Kunde nicht gefunden." };
    const nextPhones = [...(Array.isArray(customer.phones) ? customer.phones : []), { label: "Telefonie", number }];
    const updated = await telephonyService.updateCustomer(customerId, { phones: nextPhones });
    if (updated?.error) return { ok: false, error: updated.error };
    if (!updated?.id) return { ok: false, error: "Konnte Rufnummer nicht speichern." };
    setCustomers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    return { ok: true, customer: updated };
  };

  useEffect(() => {
    if (activeTab !== "monitoring") return;
    let active = true;
    const load = async () => {
      const [nextCalls, nextStats, isHealthy] = await Promise.all([
        telephonyService.fetchCalls(100),
        telephonyService.fetchStats(),
        telephonyService.fetchHealth()
      ]);
      if (!active) return;
      setCalls(nextCalls);
      setStats(nextStats);
      setApiStatus(!hasCredentials ? "missing" : isHealthy ? "connected" : "error");
    };
    load();
    const interval = setInterval(load, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [activeTab, settings]);

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sand-200 bg-sand-100 text-sand-700">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Telefonie</h1>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
            apiStatus === "connected" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : apiStatus === "missing" ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              apiStatus === "connected" ? "bg-emerald-500" : apiStatus === "missing" ? "bg-amber-500" : "bg-rose-500"
            }`} />
            API {apiStatus === "connected" ? "verbunden" : apiStatus === "missing" ? "Zugangsdaten fehlen" : "getrennt"}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Tab navigation */}
        <div className="space-y-2">
          <div className="inline-flex overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
            {primaryTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex min-h-10 items-center gap-2 border-r border-sand-200 px-4 py-2 text-sm font-medium transition last:border-r-0 focus:outline-none ${
                    active ? "bg-sand-900 text-white" : "bg-white text-sand-600 hover:bg-sand-50 hover:text-sand-900"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.22em] text-sand-400 mr-1">NFON</span>
            {nfonTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition focus:outline-none ${
                    active
                      ? "border-sand-800 bg-sand-800 text-white"
                      : "border-sand-200 bg-white text-sand-600 hover:border-sand-300 hover:bg-sand-50 hover:text-sand-900"
                  }`}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "monitoring" ? (
          <>
            <ErrorBoundary>
              <CallStatsView stats={stats} calls={calls} customers={customers} pbxEntries={pbxEntries} />
            </ErrorBoundary>
            <ErrorBoundary>
              <CallListView
                calls={calls}
                extensions={extensions}
                customers={customers}
                pbxEntries={pbxEntries}
                pbxApiActive={pbxApiActive}
                loading={apiStatus === "idle"}
                onResolve={(number) => telephonyService.reverseLookup(number)}
                onCallback={(extension, number) => telephonyService.clickToDial({ extension, number })}
                onResolveCallback={handleResolveCallback}
                onAssignNumber={handleAssignNumber}
                onAddToPbx={handleAddToPbx}
              />
            </ErrorBoundary>
          </>
        ) : activeTab === "phonebook" ? (
          <ErrorBoundary>
            <TelephonyMaintenanceView />
          </ErrorBoundary>
        ) : (
          <ErrorBoundary>
            <NfonControlPanel controlKey={activeTab} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
