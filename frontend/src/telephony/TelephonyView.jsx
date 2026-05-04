import { Component, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarClock,
  GitBranch,
  Megaphone,
  Phone,
  PhoneForwarded,
  PhoneIncoming,
  Users,
  Zap
} from "lucide-react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
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
import CallListView from "./CallListView";
import CallStatsView from "./CallStatsView";
import TelephonyMaintenanceView from "./TelephonyMaintenanceView";
import { telephonyService } from "./telephonyService";

const defaultSettings = {
  baseUrl: "https://providersupportdata.cloud-cfg.com",
  username: "",
  password: "",
  streamEnabled: false,
  hasPassword: false,
  hasRefreshToken: false,
  numerifyReverseUrl: "",
  numerifyApiHeader: "",
  numerifyApiKey: "",
  hasNumerifyApiKey: false
};

const telephonyTabs = [
  { key: "monitoring", label: "Monitoring", icon: PhoneIncoming },
  { key: "phonebook", label: "Telefonbuch", icon: Phone },
  { key: "time_rules", label: "Zeitsteuerung", icon: CalendarClock },
  { key: "quick_modes", label: "Schnellmodi", icon: Zap },
  { key: "forwards", label: "Rufweiterleitungen", icon: PhoneForwarded },
  { key: "groups", label: "Rufgruppen", icon: Users },
  { key: "queues", label: "Warteschlangen", icon: BellRing },
  { key: "announcements", label: "Ansagen", icon: Megaphone },
  { key: "oncall", label: "Bereitschaft", icon: GitBranch }
];

const telephonyControlPanels = {
  time_rules: {
    title: "Zeitsteuerung",
    eyebrow: "Geschäftszeiten",
    text: "Öffnungszeiten, Mittagspausen, Feiertage, Betriebsurlaub und Sonderzeiten pro Standort oder Hauptnummer vorbereiten.",
    items: ["Wochenplan", "Feiertagskalender", "Sonderöffnungszeiten", "Automatische Rückstellung"]
  },
  quick_modes: {
    title: "Schnellmodi",
    eyebrow: "Betriebsmodus",
    text: "Vordefinierte Zustände wie Normalbetrieb, Feiertag, Urlaub, Störung oder Notdienst zentral umschalten.",
    items: ["Normalbetrieb", "Feiertag", "Betriebsurlaub", "Notdienst aktiv"]
  },
  forwards: {
    title: "Rufweiterleitungen",
    eyebrow: "Routing",
    text: "Temporäre und dauerhafte Umleitungen auf Nebenstellen, Gruppen, Mobilnummern oder externe Ziele verwalten.",
    items: ["Hauptnummer umleiten", "Temporäre Umleitung", "Überlaufziel", "Automatisch zurücksetzen"]
  },
  groups: {
    title: "Rufgruppen",
    eyebrow: "Teams",
    text: "Gruppenmitglieder, Klingelstrategie, Parallelruf, Reihenfolge und Timeout je Team steuern.",
    items: ["Mitglieder aktivieren", "Klingelreihenfolge", "Timeout", "Überlauf"]
  },
  queues: {
    title: "Warteschlangen",
    eyebrow: "Queue",
    text: "Agentenstatus, Wartezeiten, Überlaufziele und Hinweise für Anrufer übersichtlich pflegen.",
    items: ["Agenten an-/abmelden", "Maximale Wartezeit", "Warteansage", "Überlaufziel"]
  },
  announcements: {
    title: "Ansagen",
    eyebrow: "Audio",
    text: "Ansagen für geöffnet, geschlossen, Feiertag, Urlaub, Notfall und Warteschleife verwalten.",
    items: ["Geschlossen-Ansage", "Feiertagsansage", "Notfallansage", "Wartemusik"]
  },
  oncall: {
    title: "Bereitschaft",
    eyebrow: "Notdienst",
    text: "Bereitschaftspläne, aktive Notdienstnummern und zeitabhängige Weiterleitungen abbilden.",
    items: ["Aktive Bereitschaft", "Rotationsplan", "Notdienstziel", "Eskalation"]
  }
};

function TelephonyControlPlaceholder({ panel }) {
  if (!panel) return null;
  return (
    <section className="rounded-3xl border border-sand-200 bg-white/90 p-5 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">{panel.eyebrow}</p>
          <h2 className="mt-1 text-xl font-display text-sand-900">{panel.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sand-600">{panel.text}</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          Steuerung in Vorbereitung
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {panel.items.map((item) => (
          <div key={item} className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-3 text-sm font-medium text-sand-800">
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatNfonValue(value) {
  if (value === null || typeof value === "undefined") return "-";
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function NfonControlPanel({ controlKey, panel }) {
  const [state, setState] = useState({ status: "idle", data: null, error: "" });
  const [selectedId, setSelectedId] = useState("");
  const [method, setMethod] = useState("PUT");
  const [jsonDraft, setJsonDraft] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setState((prev) => ({ ...prev, status: "loading", error: "" }));
    setMessage("");
    try {
      const data = await telephonyService.fetchNfonControl(controlKey);
      setState({ status: "ready", data, error: "" });
      const first = Array.isArray(data.items) ? data.items[0] : null;
      setSelectedId(first?.id || "");
      setJsonDraft(first?.raw ? JSON.stringify(first.raw, null, 2) : "");
    } catch (error) {
      const detail = error?.message || "NFON Ressource konnte nicht geladen werden.";
      setState({ status: "error", data: null, error: detail });
      setJsonDraft("");
    }
  };

  useEffect(() => {
    load();
  }, [controlKey]);

  const items = Array.isArray(state.data?.items) ? state.data.items : [];
  const selectedItem = useMemo(
    () => items.find((item) => String(item.id || "") === String(selectedId || "")) || items[0] || null,
    [items, selectedId]
  );
  const selectedPath = selectedItem?.id
    ? `${String(state.data?.path || "").replace(/\/$/, "")}/${encodeURIComponent(selectedItem.id)}`
    : String(state.data?.path || "");
  const previewFields = selectedItem?.raw && typeof selectedItem.raw === "object"
    ? Object.entries(selectedItem.raw).slice(0, 6)
    : [];

  useEffect(() => {
    if (selectedItem?.raw) {
      setJsonDraft(JSON.stringify(selectedItem.raw, null, 2));
    }
  }, [selectedItem?.id]);

  const save = async () => {
    setMessage("");
    let body = null;
    if (method !== "DELETE") {
      try {
        body = jsonDraft.trim() ? JSON.parse(jsonDraft) : {};
      } catch (error) {
        setMessage("JSON ist ungültig.");
        return;
      }
    }
    try {
      await telephonyService.mutateNfonControl(controlKey, {
        method,
        path: selectedPath,
        body
      });
      setMessage("Änderung an NFON übertragen.");
      await load();
    } catch (error) {
      setMessage(error?.message || "NFON Änderung fehlgeschlagen.");
    }
  };

  return (
    <section className="rounded-3xl border border-sand-200 bg-white/90 p-5 shadow-soft">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">{panel.eyebrow}</p>
          <h2 className="mt-1 text-xl font-display text-sand-900">{panel.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sand-600">{panel.text}</p>
          {state.data?.path ? (
            <p className="mt-2 font-mono text-[11px] text-sand-500">NFON: {state.data.path}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-50"
        >
          Aktualisieren
        </button>
      </div>

      {state.status === "loading" ? (
        <div className="mt-5 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-5 text-sm text-sand-500">NFON-Daten werden geladen...</div>
      ) : null}

      {state.error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      {state.data?.available === false ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
          {state.data.message || "Diese NFON Steuerungsressource ist fuer den konfigurierten Account nicht verfuegbar."}
        </div>
      ) : items.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
            <div className="border-b border-sand-100 bg-sand-50 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-sand-500">
              NFON Einträge
            </div>
            <div className="max-h-[460px] overflow-auto divide-y divide-sand-100">
              {items.map((item, index) => {
                const active = selectedItem === item;
                return (
                  <button
                    key={`${item.id || index}`}
                    type="button"
                    onClick={() => setSelectedId(item.id || "")}
                    className={`block w-full px-3 py-3 text-left text-sm transition ${active ? "bg-sand-900 text-white" : "bg-white text-sand-800 hover:bg-sand-50"}`}
                  >
                    <span className="block font-medium">{item.label || item.id || "NFON Eintrag"}</span>
                    <span className={`mt-0.5 block truncate font-mono text-[10px] ${active ? "text-sand-200" : "text-sand-400"}`}>
                      {item.id || "ohne ID"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
              <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-sand-500">Kurzansicht</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {previewFields.map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-sand-200 bg-white px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-sand-400">{key}</div>
                    <div className="mt-1 truncate text-xs text-sand-800">{formatNfonValue(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-sand-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.24em] text-sand-500">NFON JSON bearbeiten</div>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs text-sand-700"
                >
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="POST">POST</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <textarea
                value={jsonDraft}
                onChange={(event) => setJsonDraft(event.target.value)}
                spellCheck={false}
                className="min-h-[260px] w-full rounded-xl border border-sand-200 bg-slate-950 px-3 py-2 font-mono text-xs leading-5 text-slate-100 outline-none focus:ring-2 focus:ring-sand-300"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-sand-400">{selectedPath}</span>
                <button
                  type="button"
                  onClick={save}
                  disabled={!state.data?.path}
                  className="rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  An NFON senden
                </button>
              </div>
              {message ? (
                <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-700">{message}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : state.status === "ready" ? (
        <div className="mt-5 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-5 text-sm text-sand-500">
          NFON Ressource erreichbar, aber keine Einträge gefunden.
        </div>
      ) : null}
    </section>
  );
}

export default function TelephonyView() {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    answered: 0,
    missed: 0,
    avgDuration: 0,
    byHour: []
  });
  const [activeTab, setActiveTab] = useState("monitoring");
  const [settings, setSettings] = useState(defaultSettings);
  const [apiStatus, setApiStatus] = useState("idle");
  const [extensions, setExtensions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pbxEntries, setPbxEntries] = useState([]);
  const [pbxApiActive, setPbxApiActive] = useState(false);
  const hasPasswordAuth = settings.hasPassword && settings.username?.trim();
  const hasRefreshAuth = settings.hasRefreshToken;
  const hasCredentials = Boolean(hasPasswordAuth || hasRefreshAuth);

  const handleResolveCallback = async (call) => {
    if (!call?.uuid) return null;
    const updated = await telephonyService.resolveCallback(call.uuid, true);
    if (updated?.uuid) {
      setCalls((prev) =>
        prev.map((item) =>
          item.uuid === updated.uuid
            ? { ...item, callbackResolved: updated.callbackResolved }
            : item
        )
      );
    }
    return updated;
  };

  useEffect(() => {
    let active = true;
    telephonyService.fetchSettings().then((data) => {
      if (!active) return;
      const merged = {
        ...defaultSettings,
        ...data,
        baseUrl: data?.baseUrl?.trim() ? data.baseUrl : defaultSettings.baseUrl,
        password: ""
      };
      setSettings(merged);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchExtensions().then((data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setExtensions(data);
      } else {
        setExtensions([]);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchCustomers().then((data) => {
      if (!active) return;
      if (Array.isArray(data)) {
        setCustomers(data);
      } else {
        setCustomers([]);
      }
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
    telephonyService.checkPbxHealth().then((ok) => {
      if (!active) return;
      setPbxApiActive(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleAddToPbx = async (payload) => {
    const result = await telephonyService.createPbxPhonebookEntry(payload);
    const fresh = await telephonyService.fetchPbxPhonebook();
    setPbxEntries(Array.isArray(fresh) ? fresh : []);
    if (!result) {
      throw new Error("pbx_add_failed");
    }
    return result;
  };

  const handleAssignNumber = async (customerId, number) => {
    if (!customerId || !number) {
      return { ok: false, error: "Kunde oder Rufnummer fehlt." };
    }
    const customer = customers.find((item) => item.id === customerId);
    if (!customer) {
      return { ok: false, error: "Kunde nicht gefunden." };
    }
    const existingPhones = Array.isArray(customer.phones) ? customer.phones : [];
    const nextPhones = [
      ...existingPhones,
      {
        label: "Telefonie",
        number
      }
    ];
    const updated = await telephonyService.updateCustomer(customerId, { phones: nextPhones });
    if (updated?.error) {
      return { ok: false, error: updated.error };
    }
    if (!updated?.id) {
      return { ok: false, error: "Konnte Rufnummer nicht speichern." };
    }
    setCustomers((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
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
      if (!hasCredentials) {
        setApiStatus("missing");
      } else {
        setApiStatus(isHealthy ? "connected" : "error");
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTab, settings]);

  return (
    <div className="min-h-screen bg-hero-pattern">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
              <Phone size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Telefonie Monitoring</h1>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              apiStatus === "connected"
                ? "bg-emerald-100 text-emerald-700"
                : apiStatus === "missing"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                apiStatus === "connected"
                  ? "bg-emerald-500"
                  : apiStatus === "missing"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            />
            API{" "}
            {apiStatus === "connected"
              ? "verbunden"
              : apiStatus === "missing"
                ? "Zugangsdaten fehlen"
                : "getrennt"}
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
          {telephonyTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 border-r border-sand-200 px-3.5 py-2 text-sm transition last:border-r-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sand-900/25 ${
                  active
                    ? "bg-sand-900 text-white"
                    : "bg-white text-sand-700 hover:bg-sand-100"
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            );
          })}
          </div>
        </div>

        {activeTab === "monitoring" ? (
          <>
            <ErrorBoundary>
              <CallStatsView
                stats={stats}
                calls={calls}
                customers={customers}
                pbxEntries={pbxEntries}
              />
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
                onCallback={(extension, number) =>
                  telephonyService.clickToDial({ extension, number })
                }
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
            <NfonControlPanel controlKey={activeTab} panel={telephonyControlPanels[activeTab]} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}
