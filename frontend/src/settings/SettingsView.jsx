import { useEffect, useState } from "react";
import { Mail, Settings } from "lucide-react";
import { telephonyService } from "../telephony/telephonyService";

const API = "/api";
const STORAGE_KEY = "qt_smtp_settings_cache";
const defaultOfferFormat = "AN-XXXX";
const DEBUG_TABLE_LABELS = {
  day_tasks: "Aufgaben",
  day_task_groups: "Aufgabengruppen"
};
const DEBUG_CLEARABLE_TABLES = new Set(Object.keys(DEBUG_TABLE_LABELS));

const defaultSmtp = {
  host: "",
  port: 587,
  username: "",
  password: "",
  sender_name: "",
  sender_email: "",
  beacon_base_url: "https://work.quansatech.at/beacon",
  use_tls: true,
  use_ssl: false,
  has_password: false
};

const defaultCti = {
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

const defaultPbx = {
  pbx_base_url: "",
  pbx_api_key_id: "",
  pbx_api_key_secret: "",
  pbx_customer_account: "",
  has_pbx_api_key_secret: false
};

const loadCachedSmtp = () => {
  if (typeof window === "undefined") return defaultSmtp;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSmtp;
    const cached = JSON.parse(raw);
    return {
      ...defaultSmtp,
      ...cached,
      password: ""
    };
  } catch (error) {
    return defaultSmtp;
  }
};

const makeOfferNumber = (format, index) => {
  const template = (format || defaultOfferFormat).trim() || defaultOfferFormat;
  const match = template.match(/X+/);
  if (!match) return template;
  const width = match[0].length;
  const number = String(index).padStart(width, "0");
  return template.replace(match[0], number);
};

export default function SettingsView() {
  const [smtp, setSmtp] = useState(loadCachedSmtp);
  const [status, setStatus] = useState("idle");
  const [loadStatus, setLoadStatus] = useState("loading");
  const [cti, setCti] = useState(defaultCti);
  const [ctiStatus, setCtiStatus] = useState("idle");
  const [ctiLoadStatus, setCtiLoadStatus] = useState("loading");
  const [ctiDebugOpen, setCtiDebugOpen] = useState(false);
  const [ctiApiStatus, setCtiApiStatus] = useState("idle");
  const [ctiDebugInfo, setCtiDebugInfo] = useState({
    lastSettingsFetchAt: "",
    lastHealthCheckAt: "",
    lastHealthCheckOk: null,
    lastSettingsSaveAt: "",
    lastSettingsSaveOk: null,
    lastCallsCount: null,
    lastStatsTotals: null,
    lastSettingsResponse: null,
    lastCallRawKeys: null,
    lastCallRawPreview: "",
    lastCallRawLength: null,
    lastCallSnapshot: null
  });
  const [pbx, setPbx] = useState(defaultPbx);
  const [pbxStatus, setPbxStatus] = useState("idle");
  const [pbxLoadStatus, setPbxLoadStatus] = useState("loading");
  const [pbxApiStatus, setPbxApiStatus] = useState("idle");
  const [pbxDebugOpen, setPbxDebugOpen] = useState(false);
  const [pbxDebugInfo, setPbxDebugInfo] = useState({
    lastCheckAt: "",
    lastCheckOk: null,
    lastError: "",
    sampleCount: null,
    statusCode: null,
    baseUrl: "",
    customerAccount: "",
    responsePreview: "",
    requestPath: "",
    requestUrl: ""
  });
  const [tables, setTables] = useState([]);
  const [debugStatus, setDebugStatus] = useState("idle");
  const [clearingTable, setClearingTable] = useState("");
  const [offerNumberFormat, setOfferNumberFormat] = useState(defaultOfferFormat);
  const [offerLoadStatus, setOfferLoadStatus] = useState("loading");
  const [offerStatus, setOfferStatus] = useState("idle");
  const beaconDisplay =
    smtp.beacon_base_url && smtp.beacon_base_url.trim()
      ? smtp.beacon_base_url.trim()
      : "Nicht gesetzt";
  const hasCtiPasswordAuth = cti.hasPassword && cti.username?.trim();
  const hasCtiRefreshAuth = cti.hasRefreshToken;
  const hasCtiCredentials = Boolean(hasCtiPasswordAuth || hasCtiRefreshAuth);

  useEffect(() => {
    let active = true;
    fetch(`${API}/smtp_settings`)
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setSmtp((prev) => ({
          ...prev,
          ...data,
          password: ""
        }));
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setLoadStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    telephonyService.fetchSettings().then((data) => {
      if (!active) return;
      const merged = {
        ...defaultCti,
        ...data,
        baseUrl: data?.baseUrl?.trim() ? data.baseUrl : defaultCti.baseUrl,
        password: "",
        numerifyApiKey: ""
      };
      setCti(merged);
      setCtiDebugInfo((current) => ({
        ...current,
        lastSettingsFetchAt: new Date().toISOString(),
        lastSettingsResponse: {
          baseUrl: data?.baseUrl ?? "",
          username: data?.username ?? "",
          hasPassword: Boolean(data?.hasPassword),
          hasRefreshToken: Boolean(data?.hasRefreshToken),
          streamEnabled: Boolean(data?.streamEnabled),
          numerifyReverseUrl: data?.numerifyReverseUrl ?? "",
          numerifyApiHeader: data?.numerifyApiHeader ?? "",
          hasNumerifyApiKey: Boolean(data?.hasNumerifyApiKey)
        }
      }));
      setCtiLoadStatus("ready");
    }).catch(() => {
      if (!active) return;
      setCtiLoadStatus("error");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API}/integrations`)
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setPbx((prev) => ({
          ...prev,
          pbx_base_url: data?.pbx_base_url || "",
          pbx_api_key_id: data?.pbx_api_key_id || "",
          pbx_customer_account: data?.pbx_customer_account || "",
          pbx_api_key_secret: "",
          has_pbx_api_key_secret: Boolean(data?.has_pbx_api_key_secret)
        }));
        setPbxLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setPbxLoadStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (pbxLoadStatus !== "ready") return;
    refreshPbxDebug();
  }, [pbxLoadStatus]);

  useEffect(() => {
    let active = true;
    fetch(`${API}/debug/tables`)
      .then((res) => {
        if (!res.ok) throw new Error("tables_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setTables(Array.isArray(data?.tables) ? data.tables : []);
      })
      .catch(() => {
        if (!active) return;
        setTables([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API}/offer_settings`)
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setOfferNumberFormat(data?.offer_number_format || defaultOfferFormat);
        setOfferLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setOfferLoadStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (ctiLoadStatus !== "ready") return;
    refreshCtiDebug();
  }, [ctiLoadStatus]);

  const clearTable = async (table) => {
    if (!window.confirm(`Tabelle "${table}" wirklich leeren?`)) return;
    setClearingTable(table);
    setDebugStatus("clearing");
    try {
      const res = await fetch(`${API}/debug/clear_table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table })
      });
      if (!res.ok) throw new Error("clear_failed");
      setDebugStatus("cleared");
    } catch (error) {
      setDebugStatus("error");
    }
    setClearingTable("");
    setTimeout(() => setDebugStatus("idle"), 2000);
  };

  const save = async () => {
    setStatus("saving");
    try {
      const res = await fetch(`${API}/smtp_settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtp.host,
          port: Number(smtp.port) || 587,
          username: smtp.username,
          password: smtp.password,
          sender_name: smtp.sender_name,
          sender_email: smtp.sender_email,
          beacon_base_url: smtp.beacon_base_url,
          use_tls: smtp.use_tls,
          use_ssl: smtp.use_ssl
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      const next = {
        ...smtp,
        ...data,
        password: ""
      };
      setSmtp(next);
      try {
        const { password, ...cacheable } = next;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheable));
      } catch (error) {
        // Ignore cache write errors (private mode, etc.)
      }
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  const saveOfferSettings = async () => {
    setOfferStatus("saving");
    const safeFormat = (offerNumberFormat || defaultOfferFormat).trim() || defaultOfferFormat;
    try {
      const res = await fetch(`${API}/offer_settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer_number_format: safeFormat
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setOfferNumberFormat(data?.offer_number_format || safeFormat);
      setOfferStatus("saved");
    } catch (error) {
      setOfferStatus("error");
    }
    setTimeout(() => setOfferStatus("idle"), 2000);
  };

  const refreshCtiDebug = async () => {
    const [isHealthy, stats, latestCalls] = await Promise.all([
      telephonyService.fetchHealth(),
      telephonyService.fetchStats(),
      telephonyService.fetchLatestCallDebug()
    ]);
    const latestCall = Array.isArray(latestCalls) ? latestCalls[0] : null;
    let latestRawKeys = null;
    let latestRawPreview = "";
    let latestRawLength = null;
    if (latestCall?.rawPayload) {
      try {
        const rawObject = JSON.parse(latestCall.rawPayload);
        latestRawKeys = Object.keys(rawObject).sort();
        latestRawPreview = JSON.stringify(rawObject).slice(0, 500);
        latestRawLength = latestCall.rawPayload.length;
      } catch (error) {
        latestRawPreview = String(latestCall.rawPayload).slice(0, 500);
        latestRawLength = String(latestCall.rawPayload).length;
      }
    } else if (latestCall?.rawPayload === "") {
      latestRawPreview = "leer";
      latestRawLength = 0;
    }
    const latestCallSnapshot = latestCall
      ? {
          uuid: latestCall.uuid,
          from: latestCall.from,
          to: latestCall.to,
          extension: latestCall.extension,
          direction: latestCall.direction,
          startTime: latestCall.startTime,
          duration: latestCall.duration,
          answered: latestCall.answered
        }
      : null;
    setCtiDebugInfo((current) => ({
      ...current,
      lastHealthCheckAt: new Date().toISOString(),
      lastHealthCheckOk: isHealthy,
      lastCallsCount: Array.isArray(latestCalls) ? latestCalls.length : null,
      lastStatsTotals: stats
        ? {
            today: stats.today?.total ?? null,
            last24h: stats.last24h?.total ?? null,
            last7d: stats.last7d?.total ?? null
          }
        : null,
      lastCallRawKeys: latestRawKeys,
      lastCallRawPreview: latestRawPreview,
      lastCallRawLength: latestRawLength,
      lastCallSnapshot: latestCallSnapshot
    }));
    if (!hasCtiCredentials) {
      setCtiApiStatus("missing");
    } else {
      setCtiApiStatus(isHealthy ? "connected" : "error");
    }
  };

  const saveCtiSettings = async () => {
    setCtiStatus("saving");
    const payload = {
      baseUrl: cti.baseUrl,
      username: cti.username,
      password: cti.password,
      streamEnabled: cti.streamEnabled,
      numerifyReverseUrl: cti.numerifyReverseUrl,
      numerifyApiHeader: cti.numerifyApiHeader,
      numerifyApiKey: cti.numerifyApiKey
    };
    const result = await telephonyService.updateSettings(payload);
    if (result) {
      setCti({
        ...defaultCti,
        ...result,
        password: "",
        numerifyApiKey: ""
      });
      setCtiStatus("saved");
      setCtiDebugInfo((current) => ({
        ...current,
        lastSettingsSaveAt: new Date().toISOString(),
        lastSettingsSaveOk: true
      }));
      refreshCtiDebug();
    } else {
      setCtiStatus("error");
      setCtiDebugInfo((current) => ({
        ...current,
        lastSettingsSaveAt: new Date().toISOString(),
        lastSettingsSaveOk: false
      }));
    }
    setTimeout(() => setCtiStatus("idle"), 2000);
  };

  const savePbxSettings = async () => {
    setPbxStatus("saving");
    try {
      const res = await fetch(`${API}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pbx_base_url: pbx.pbx_base_url,
          pbx_api_key_id: pbx.pbx_api_key_id,
          pbx_api_key_secret: pbx.pbx_api_key_secret,
          pbx_customer_account: pbx.pbx_customer_account
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setPbx((prev) => ({
        ...prev,
        pbx_base_url: data?.pbx_base_url || "",
        pbx_api_key_id: data?.pbx_api_key_id || "",
        pbx_customer_account: data?.pbx_customer_account || "",
        pbx_api_key_secret: "",
        has_pbx_api_key_secret: Boolean(data?.has_pbx_api_key_secret)
      }));
      setPbxStatus("saved");
    } catch (error) {
      setPbxStatus("error");
    }
    setTimeout(() => setPbxStatus("idle"), 2000);
  };

  const refreshPbxDebug = async () => {
    let response;
    try {
      response = await fetch(`${API}/pbx_phonebook/health`);
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (error) {
        data = null;
      }
      const ok = Boolean(response.ok && data?.ok);
      setPbxApiStatus(ok ? "connected" : "error");
      setPbxDebugInfo({
        lastCheckAt: new Date().toISOString(),
        lastCheckOk: ok,
        lastError: ok
          ? ""
          : data?.error || (!response.ok ? text.slice(0, 300) : "PBX check failed"),
        sampleCount: data?.entry_count ?? null,
        statusCode: data?.status_code ?? response.status,
        baseUrl: data?.base_url || pbx.pbx_base_url || "",
        customerAccount: data?.customer_account || pbx.pbx_customer_account || "",
        responsePreview: data?.response_preview || text.slice(0, 300),
        requestPath: data?.request_path || "",
        requestUrl: data?.request_url || ""
      });
    } catch (error) {
      setPbxApiStatus("error");
      setPbxDebugInfo({
        lastCheckAt: new Date().toISOString(),
        lastCheckOk: false,
        lastError: error?.message ? String(error.message) : "Fehler",
        sampleCount: null,
        statusCode: response?.status ?? null,
        baseUrl: pbx.pbx_base_url || "",
        customerAccount: pbx.pbx_customer_account || "",
        responsePreview: "",
        requestPath: "",
        requestUrl: ""
      });
    }
  };

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
            <Settings size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Allgemeine Einstellungen</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center gap-2 text-sand-700 mb-4">
            <Mail size={18} />
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">SMTP Versand</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-sand-500">SMTP Host</label>
              <input
                value={smtp.host}
                onChange={(event) => setSmtp((prev) => ({ ...prev, host: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Port</label>
              <input
                value={smtp.port}
                onChange={(event) => setSmtp((prev) => ({ ...prev, port: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="587"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Benutzername</label>
              <input
                value={smtp.username}
                onChange={(event) => setSmtp((prev) => ({ ...prev, username: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Passwort</label>
              <input
                type="password"
                value={smtp.password}
                onChange={(event) => setSmtp((prev) => ({ ...prev, password: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder={smtp.has_password ? "Gespeichert" : "••••••••"}
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Absender Name</label>
              <input
                value={smtp.sender_name}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, sender_name: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="Quansatech"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Absender E-Mail</label>
              <input
                value={smtp.sender_email}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, sender_email: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="reports@example.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-sand-500">Beacon Base URL</label>
              <input
                value={smtp.beacon_base_url}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, beacon_base_url: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="https://beacon.example.com"
              />
              <div className="mt-2 text-xs text-sand-500">
                Aktuell: <span className="text-sand-700">{beaconDisplay}</span>
              </div>
              <p className="mt-2 text-xs text-sand-400">
                Optional: externe Basis-URL oder Template mit {"{guid}"}.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-sand-700">
              <input
                type="checkbox"
                checked={smtp.use_tls}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, use_tls: event.target.checked }))
                }
              />
              TLS verwenden
            </label>
            <label className="flex items-center gap-2 text-sm text-sand-700">
              <input
                type="checkbox"
                checked={smtp.use_ssl}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, use_ssl: event.target.checked }))
                }
              />
              SSL verwenden
            </label>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={save}
              className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
            >
              Speichern
            </button>
            {loadStatus === "error" && (
              <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
            )}
            {status === "saved" && <span className="text-sm text-emerald-600">Gespeichert</span>}
            {status === "error" && (
              <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center gap-2 text-sand-700 mb-4">
            <Settings size={18} />
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Anlagen API</p>
          </div>
          <p className="text-xs text-sand-500 mb-4">
            Zugangsdaten fuer das Telefonanlagen-API (nicht CTI).
          </p>
          <div className="mb-4 flex items-center gap-2 text-xs text-sand-600">
            <span
              className={`h-2 w-2 rounded-full ${
                pbxApiStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span>
              API{" "}
              {pbxApiStatus === "connected"
                ? "aktiv"
                : pbxApiStatus === "idle"
                ? "unbekannt"
                : "getrennt"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-sand-500">API Base URL</label>
              <input
                value={pbx.pbx_base_url}
                onChange={(event) =>
                  setPbx((prev) => ({ ...prev, pbx_base_url: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="https://portal-api.nfon.net:8090"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">API Key ID</label>
              <input
                value={pbx.pbx_api_key_id}
                onChange={(event) =>
                  setPbx((prev) => ({ ...prev, pbx_api_key_id: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="API Key ID"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">API Key Secret</label>
              <input
                type="password"
                value={pbx.pbx_api_key_secret}
                onChange={(event) =>
                  setPbx((prev) => ({ ...prev, pbx_api_key_secret: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder={pbx.has_pbx_api_key_secret ? "Gespeichert" : "••••••••"}
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Customer Account</label>
              <input
                value={pbx.pbx_customer_account}
                onChange={(event) =>
                  setPbx((prev) => ({ ...prev, pbx_customer_account: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="Customer Account"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={savePbxSettings}
              className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={refreshPbxDebug}
              className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600"
            >
              Status neu laden
            </button>
            {pbxLoadStatus === "error" && (
              <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
            )}
            {pbxStatus === "saved" && (
              <span className="text-sm text-emerald-600">Gespeichert</span>
            )}
            {pbxStatus === "error" && (
              <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
            )}
          </div>
          <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50 p-4 text-xs text-sand-700">
            <button
              type="button"
              onClick={() => setPbxDebugOpen((current) => !current)}
              className="w-full flex items-center justify-between uppercase tracking-[0.3em] text-[10px] text-sand-500"
            >
              <span>Anlagen API Debug</span>
              <span>{pbxDebugOpen ? "–" : "+"}</span>
            </button>
            {pbxDebugOpen ? (
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <span className="text-sand-500">Letzter Check:</span>{" "}
                  {pbxDebugInfo.lastCheckAt || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Status:</span>{" "}
                  {pbxDebugInfo.lastCheckOk === null
                    ? "unbekannt"
                    : pbxDebugInfo.lastCheckOk
                    ? "ok"
                    : "fehlgeschlagen"}
                </div>
                <div>
                  <span className="text-sand-500">Status Code:</span>{" "}
                  {pbxDebugInfo.statusCode ?? "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Base URL:</span>{" "}
                  {pbxDebugInfo.baseUrl || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Customer Account:</span>{" "}
                  {pbxDebugInfo.customerAccount || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Request Path:</span>{" "}
                  {pbxDebugInfo.requestPath || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Request URL:</span>{" "}
                  {pbxDebugInfo.requestUrl || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Beispielanzahl:</span>{" "}
                  {pbxDebugInfo.sampleCount ?? "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Letzter Fehler:</span>{" "}
                  {pbxDebugInfo.lastError || "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Response Preview:</span>{" "}
                  {pbxDebugInfo.responsePreview || "n/a"}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sand-700">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">NFON CTI</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  ctiApiStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span>
                API{" "}
                {ctiApiStatus === "connected"
                  ? "aktiv"
                  : ctiApiStatus === "missing"
                  ? "Zugangsdaten fehlen"
                  : "getrennt"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-sand-500">Base URL</label>
              <input
                value={cti.baseUrl}
                onChange={(event) =>
                  setCti((current) => ({ ...current, baseUrl: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="https://providersupportdata.cloud-cfg.com"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Benutzername</label>
              <input
                value={cti.username}
                onChange={(event) =>
                  setCti((current) => ({ ...current, username: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="cti-user"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Passwort</label>
              <input
                type="password"
                value={cti.password}
                onChange={(event) =>
                  setCti((current) => ({ ...current, password: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder={cti.hasPassword ? "Gespeichert" : "••••••••"}
              />
            </div>
            <div className="md:col-span-2 rounded-2xl border border-sand-200 bg-sand-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Numerify</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-sand-500">Reverse URL</label>
                  <input
                    value={cti.numerifyReverseUrl}
                    onChange={(event) =>
                      setCti((current) => ({
                        ...current,
                        numerifyReverseUrl: event.target.value
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="https://api.numerify.at/v1/reverse?number={number}"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">API Header</label>
                  <input
                    value={cti.numerifyApiHeader}
                    onChange={(event) =>
                      setCti((current) => ({
                        ...current,
                        numerifyApiHeader: event.target.value
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="X-API-Key"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">API Key</label>
                  <input
                    type="password"
                    value={cti.numerifyApiKey}
                    onChange={(event) =>
                      setCti((current) => ({
                        ...current,
                        numerifyApiKey: event.target.value
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder={cti.hasNumerifyApiKey ? "Gespeichert" : "••••••••"}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <input
                id="cti-stream"
                type="checkbox"
                checked={cti.streamEnabled}
                onChange={(event) =>
                  setCti((current) => ({
                    ...current,
                    streamEnabled: event.target.checked
                  }))
                }
              />
              <label htmlFor="cti-stream" className="text-sm text-sand-700">
                Live-Stream aktivieren
              </label>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={saveCtiSettings}
              className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
            >
              Speichern
            </button>
            {ctiLoadStatus === "error" && (
              <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
            )}
            {ctiStatus === "saved" && (
              <span className="text-sm text-emerald-600">Gespeichert</span>
            )}
            {ctiStatus === "error" && (
              <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
            )}
            <button
              type="button"
              onClick={refreshCtiDebug}
              className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600"
            >
              Status neu laden
            </button>
          </div>
          <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50 p-4 text-xs text-sand-700">
            <button
              type="button"
              onClick={() => setCtiDebugOpen((current) => !current)}
              className="w-full flex items-center justify-between uppercase tracking-[0.3em] text-[10px] text-sand-500"
            >
              <span>CTI Debug</span>
              <span>{ctiDebugOpen ? "–" : "+"}</span>
            </button>
            {ctiDebugOpen ? (
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <span className="text-sand-500">Base URL:</span> {cti.baseUrl || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Username gesetzt:</span>{" "}
                  {cti.username?.trim() ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Passwort eingegeben:</span>{" "}
                  {cti.password ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Password-Auth aktiv:</span>{" "}
                  {cti.hasPassword ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Refresh Token vorhanden:</span>{" "}
                  {cti.hasRefreshToken ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Credentials erkannt:</span>{" "}
                  {hasCtiCredentials ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">API Status:</span> {ctiApiStatus}
                </div>
                <div>
                  <span className="text-sand-500">Health Check:</span>{" "}
                  {ctiDebugInfo.lastHealthCheckOk === null
                    ? "unbekannt"
                    : ctiDebugInfo.lastHealthCheckOk
                    ? "ok"
                    : "fehlgeschlagen"}
                </div>
                <div>
                  <span className="text-sand-500">Letzter Health Check:</span>{" "}
                  {ctiDebugInfo.lastHealthCheckAt || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Letzte Settings-Abfrage:</span>{" "}
                  {ctiDebugInfo.lastSettingsFetchAt || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Letztes Settings-Update:</span>{" "}
                  {ctiDebugInfo.lastSettingsSaveAt || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Letztes Settings-Update OK:</span>{" "}
                  {ctiDebugInfo.lastSettingsSaveOk === null
                    ? "unbekannt"
                    : ctiDebugInfo.lastSettingsSaveOk
                    ? "ja"
                    : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Letzte Call-Anzahl:</span>{" "}
                  {ctiDebugInfo.lastCallsCount ?? "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Stats Totals:</span>{" "}
                  {ctiDebugInfo.lastStatsTotals
                    ? `today ${ctiDebugInfo.lastStatsTotals.today}, 24h ${ctiDebugInfo.lastStatsTotals.last24h}, 7d ${ctiDebugInfo.lastStatsTotals.last7d}`
                    : "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Stream aktiv:</span>{" "}
                  {cti.streamEnabled ? "ja" : "nein"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Settings Response:</span>{" "}
                  {ctiDebugInfo.lastSettingsResponse
                    ? JSON.stringify(ctiDebugInfo.lastSettingsResponse)
                    : "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Letzte Event-Keys:</span>{" "}
                  {ctiDebugInfo.lastCallRawKeys?.length
                    ? ctiDebugInfo.lastCallRawKeys.join(", ")
                    : "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Letzter Call (DB Snapshot):</span>{" "}
                  {ctiDebugInfo.lastCallSnapshot
                    ? JSON.stringify(ctiDebugInfo.lastCallSnapshot)
                    : "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Raw Payload Laenge:</span>{" "}
                  {ctiDebugInfo.lastCallRawLength ?? "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Letztes Event (Preview):</span>{" "}
                  {ctiDebugInfo.lastCallRawPreview || "n/a"}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center gap-2 text-sand-700 mb-4">
            <Settings size={18} />
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Angebote</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-sand-500">Angebotsnummer Format</label>
              <input
                value={offerNumberFormat}
                onChange={(event) => setOfferNumberFormat(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder={defaultOfferFormat}
              />
              <p className="mt-2 text-xs text-sand-500">
                Beispiel: {makeOfferNumber(offerNumberFormat, 1)}
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={saveOfferSettings}
              className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
            >
              Speichern
            </button>
            {offerLoadStatus === "error" && (
              <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
            )}
            {offerStatus === "saved" && (
              <span className="text-sm text-emerald-600">Gespeichert</span>
            )}
            {offerStatus === "error" && (
              <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center gap-2 text-sand-700 mb-4">
            <Settings size={18} />
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Debug</p>
          </div>
          <div className="text-xs text-sand-500 mb-3">
            Datenbanktabellen (nur freigegebene Tabellen koennen geleert werden).
          </div>
          <div className="space-y-2">
            {tables.length ? (
              tables.map((table) => (
                <div
                  key={table}
                  className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-700"
                >
                  <div>
                    <div className="text-xs uppercase tracking-wide text-sand-500">{table}</div>
                    {DEBUG_TABLE_LABELS[table] ? (
                      <div className="text-sm">{DEBUG_TABLE_LABELS[table]}</div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => clearTable(table)}
                    disabled={!DEBUG_CLEARABLE_TABLES.has(table) || clearingTable === table}
                    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                      DEBUG_CLEARABLE_TABLES.has(table)
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "border-sand-200 bg-white text-sand-300 cursor-not-allowed"
                    }`}
                  >
                    {clearingTable === table ? "Leert..." : "Leeren"}
                  </button>
                </div>
              ))
            ) : (
              <div className="text-xs text-sand-500">Keine Tabellen gefunden.</div>
            )}
          </div>
          <div className="mt-3 text-xs text-sand-500">
            {debugStatus === "cleared" && "Tabelle geleert."}
            {debugStatus === "error" && "Leeren fehlgeschlagen."}
          </div>
        </div>
      </main>
    </div>
  );
}
