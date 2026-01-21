import { useEffect, useState } from "react";
import { Mail, Settings } from "lucide-react";
import { telephonyService } from "../telephony/telephonyService";

const API = "/api";
const STORAGE_KEY = "qt_smtp_settings_cache";
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
    requestUrl: "",
    versionStatusCode: null,
    versionOk: null,
    versionError: "",
    versionPreview: ""
  });
  const [tables, setTables] = useState([]);
  const [debugStatus, setDebugStatus] = useState("idle");
  const [debugTablesOpen, setDebugTablesOpen] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [beaconOpen, setBeaconOpen] = useState(false);
  const [beaconDebugOpen, setBeaconDebugOpen] = useState(false);
  const [beaconSaveStatus, setBeaconSaveStatus] = useState("idle");
  const [aiPromptsOpen, setAiPromptsOpen] = useState(false);
  const [pbxOpen, setPbxOpen] = useState(false);
  const [ctiOpen, setCtiOpen] = useState(false);
  const [beaconCheckStatus, setBeaconCheckStatus] = useState("idle");
  const [beaconHealth, setBeaconHealth] = useState({
    checkedAt: "",
    offers: { ok: null, status_code: null, error: "", url: "" },
    reports: { ok: null, status_code: null, error: "", url: "" }
  });
  const [aiPrompts, setAiPrompts] = useState({
    action_prompt: "",
    offer_base_prompt: "",
    offer_mode_instructions: {
      cover_intro: "",
      overview: "",
      calculation: "",
      position_text: "",
      device_description: ""
    }
  });
  const [aiPromptsStatus, setAiPromptsStatus] = useState("idle");
  const [aiPromptsLoadStatus, setAiPromptsLoadStatus] = useState("loading");
  const [clearingTable, setClearingTable] = useState("");
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
    fetch(`${API}/ai_prompts`)
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setAiPrompts({
          action_prompt: data?.action_prompt || "",
          offer_base_prompt: data?.offer_base_prompt || "",
          offer_mode_instructions: {
            cover_intro: data?.offer_mode_instructions?.cover_intro || "",
            overview: data?.offer_mode_instructions?.overview || "",
            calculation: data?.offer_mode_instructions?.calculation || "",
            position_text: data?.offer_mode_instructions?.position_text || "",
            device_description: data?.offer_mode_instructions?.device_description || ""
          }
        });
        setAiPromptsLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setAiPromptsLoadStatus("error");
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

  const saveBeacon = async () => {
    setBeaconSaveStatus("saving");
    try {
      const res = await fetch(`${API}/smtp_settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beacon_base_url: smtp.beacon_base_url })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      const next = {
        ...smtp,
        beacon_base_url: data?.beacon_base_url || smtp.beacon_base_url
      };
      setSmtp(next);
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const cached = raw ? JSON.parse(raw) : {};
        const { password, ...cacheable } = { ...cached, beacon_base_url: next.beacon_base_url };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheable));
      } catch (error) {
        // Ignore cache write errors.
      }
      setBeaconSaveStatus("saved");
    } catch (error) {
      setBeaconSaveStatus("error");
    }
    setTimeout(() => setBeaconSaveStatus("idle"), 2000);
  };

  const refreshBeaconHealth = async () => {
    setBeaconCheckStatus("loading");
    try {
      const res = await fetch(`${API}/beacon/health`);
      if (!res.ok) throw new Error("health_failed");
      const data = await res.json();
      setBeaconHealth({
        checkedAt: data?.checked_at || "",
        offers: data?.offers || { ok: false, status_code: null, error: "", url: "" },
        reports: data?.reports || { ok: false, status_code: null, error: "", url: "" }
      });
      setBeaconCheckStatus("ready");
    } catch (error) {
      setBeaconCheckStatus("error");
    }
    setTimeout(() => setBeaconCheckStatus("idle"), 2000);
  };

  const saveAiPrompts = async () => {
    setAiPromptsStatus("saving");
    try {
      const res = await fetch(`${API}/ai_prompts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPrompts)
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setAiPrompts({
        action_prompt: data?.action_prompt || "",
        offer_base_prompt: data?.offer_base_prompt || "",
        offer_mode_instructions: {
          cover_intro: data?.offer_mode_instructions?.cover_intro || "",
          overview: data?.offer_mode_instructions?.overview || "",
          calculation: data?.offer_mode_instructions?.calculation || "",
          position_text: data?.offer_mode_instructions?.position_text || "",
          device_description: data?.offer_mode_instructions?.device_description || ""
        }
      });
      setAiPromptsStatus("saved");
    } catch (error) {
      setAiPromptsStatus("error");
    }
    setTimeout(() => setAiPromptsStatus("idle"), 2000);
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
        requestPath:
          data?.request_path ||
          (pbx.pbx_customer_account ? `/api/customers/${pbx.pbx_customer_account}/phone-books?_pagesize=1` : ""),
        requestUrl:
          data?.request_url ||
          (pbx.pbx_base_url && pbx.pbx_customer_account
            ? `${pbx.pbx_base_url}/api/customers/${pbx.pbx_customer_account}/phone-books?_pagesize=1`
            : "")
        ,
        versionStatusCode: data?.version_status_code ?? null,
        versionOk: data?.version_ok ?? null,
        versionError: data?.version_error || "",
        versionPreview: data?.version_preview || ""
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
        requestUrl: "",
        versionStatusCode: null,
        versionOk: null,
        versionError: "",
        versionPreview: ""
      });
    }
  };

  const formatBeaconDebugValue = (value) => {
    if (value === null || value === undefined || value === "") return "n/a";
    return value;
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
          <button
            type="button"
            onClick={() => setSmtpOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Mail size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">SMTP Versand</p>
            </div>
            <span className="text-sm text-sand-500">{smtpOpen ? "–" : "+"}</span>
          </button>
          {smtpOpen ? (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setBeaconOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Beacon</p>
            </div>
            <span className="text-sm text-sand-500">{beaconOpen ? "–" : "+"}</span>
          </button>
          {beaconOpen ? (
            <>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={saveBeacon}
                      className="rounded-full border border-sand-200 bg-white px-3 py-2 uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                    >
                      Beacon speichern
                    </button>
                    {beaconSaveStatus === "saved" && (
                      <span className="text-emerald-600">Gespeichert</span>
                    )}
                    {beaconSaveStatus === "error" && (
                      <span className="text-rose-600">Speichern fehlgeschlagen</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-sand-600">
                <div className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
                  <span>Angebote</span>
                  <span
                    className={`inline-flex items-center gap-2 ${
                      beaconHealth.offers.ok === null
                        ? "text-sand-500"
                        : beaconHealth.offers.ok
                        ? "text-emerald-700"
                        : "text-rose-600"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        beaconHealth.offers.ok === null
                          ? "bg-sand-400"
                          : beaconHealth.offers.ok
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                      }`}
                    />
                    {beaconHealth.offers.ok === null
                      ? "unbekannt"
                      : beaconHealth.offers.ok
                      ? "erreichbar"
                      : "nicht erreichbar"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2">
                  <span>Kundenberichte</span>
                  <span
                    className={`inline-flex items-center gap-2 ${
                      beaconHealth.reports.ok === null
                        ? "text-sand-500"
                        : beaconHealth.reports.ok
                        ? "text-emerald-700"
                        : "text-rose-600"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        beaconHealth.reports.ok === null
                          ? "bg-sand-400"
                          : beaconHealth.reports.ok
                          ? "bg-emerald-500"
                          : "bg-rose-500"
                      }`}
                    />
                    {beaconHealth.reports.ok === null
                      ? "unbekannt"
                      : beaconHealth.reports.ok
                      ? "erreichbar"
                      : "nicht erreichbar"}
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <button
                  onClick={refreshBeaconHealth}
                  className="rounded-full border border-sand-200 bg-white px-3 py-2 uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                >
                  Beacon testen
                </button>
                {beaconCheckStatus === "error" && (
                  <span className="text-rose-600">Test fehlgeschlagen</span>
                )}
                {beaconHealth.checkedAt ? (
                  <span className="text-sand-500">Letzter Check: {beaconHealth.checkedAt}</span>
                ) : null}
              </div>
              <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50 p-4 text-xs text-sand-700">
                <button
                  type="button"
                  onClick={() => setBeaconDebugOpen((current) => !current)}
                  className="w-full flex items-center justify-between uppercase tracking-[0.3em] text-[10px] text-sand-500"
                >
                  <span>Beacon Debug</span>
                  <span>{beaconDebugOpen ? "–" : "+"}</span>
                </button>
                {beaconDebugOpen ? (
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                        Angebote
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <div>
                          <span className="text-sand-500">Status:</span>{" "}
                          {beaconHealth.offers.ok === null
                            ? "unbekannt"
                            : beaconHealth.offers.ok
                            ? "ok"
                            : "fehlgeschlagen"}
                        </div>
                        <div>
                          <span className="text-sand-500">Status Code:</span>{" "}
                          {beaconHealth.offers.status_code ?? "n/a"}
                        </div>
                        <div>
                          <span className="text-sand-500">URL:</span>{" "}
                          {beaconHealth.offers.url || "n/a"}
                        </div>
                        <div>
                          <span className="text-sand-500">Fehler:</span>{" "}
                          {beaconHealth.offers.error || "n/a"}
                        </div>
                        <div>
                          <span className="text-sand-500">Dauer (ms):</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.offers?.debug?.duration_ms)}
                        </div>
                        <div>
                          <span className="text-sand-500">Content-Type:</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.offers?.debug?.content_type)}
                        </div>
                        <div>
                          <span className="text-sand-500">Reason:</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.offers?.debug?.reason)}
                        </div>
                        <div>
                          <span className="text-sand-500">Preview:</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.offers?.debug?.preview)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                        Kundenberichte
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <div>
                          <span className="text-sand-500">Status:</span>{" "}
                          {beaconHealth.reports.ok === null
                            ? "unbekannt"
                            : beaconHealth.reports.ok
                            ? "ok"
                            : "fehlgeschlagen"}
                        </div>
                        <div>
                          <span className="text-sand-500">Status Code:</span>{" "}
                          {beaconHealth.reports.status_code ?? "n/a"}
                        </div>
                        <div>
                          <span className="text-sand-500">URL:</span>{" "}
                          {beaconHealth.reports.url || "n/a"}
                        </div>
                        <div>
                          <span className="text-sand-500">Fehler:</span>{" "}
                          {beaconHealth.reports.error || "n/a"}
                        </div>
                        <div>
                          <span className="text-sand-500">Dauer (ms):</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.reports?.debug?.duration_ms)}
                        </div>
                        <div>
                          <span className="text-sand-500">Content-Type:</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.reports?.debug?.content_type)}
                        </div>
                        <div>
                          <span className="text-sand-500">Reason:</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.reports?.debug?.reason)}
                        </div>
                        <div>
                          <span className="text-sand-500">Preview:</span>{" "}
                          {formatBeaconDebugValue(beaconHealth.reports?.debug?.preview)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setAiPromptsOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">KI Prompts</p>
            </div>
            <span className="text-sm text-sand-500">{aiPromptsOpen ? "–" : "+"}</span>
          </button>
          {aiPromptsOpen ? (
            <>
              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs text-sand-500">Kundenbericht: Action Prompt</label>
                  <textarea
                    value={aiPrompts.action_prompt}
                    onChange={(event) =>
                      setAiPrompts((prev) => ({ ...prev, action_prompt: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                    rows={8}
                    placeholder="Prompt fuer Kundenbericht-Aktionen"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">Angebot: Basis Prompt</label>
                  <textarea
                    value={aiPrompts.offer_base_prompt}
                    onChange={(event) =>
                      setAiPrompts((prev) => ({ ...prev, offer_base_prompt: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                    rows={6}
                    placeholder="Basis-Prompt fuer Angebots-Texte"
                  />
                  <p className="mt-2 text-xs text-sand-400">
                    Platzhalter: {"{instruction}"}, {"{context}"}, {"{current_text}"}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-sand-500">Deckblatt Intro</label>
                    <textarea
                      value={aiPrompts.offer_mode_instructions.cover_intro}
                      onChange={(event) =>
                        setAiPrompts((prev) => ({
                          ...prev,
                          offer_mode_instructions: {
                            ...prev.offer_mode_instructions,
                            cover_intro: event.target.value
                          }
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Ueberblick</label>
                    <textarea
                      value={aiPrompts.offer_mode_instructions.overview}
                      onChange={(event) =>
                        setAiPrompts((prev) => ({
                          ...prev,
                          offer_mode_instructions: {
                            ...prev.offer_mode_instructions,
                            overview: event.target.value
                          }
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Kalkulation</label>
                    <textarea
                      value={aiPrompts.offer_mode_instructions.calculation}
                      onChange={(event) =>
                        setAiPrompts((prev) => ({
                          ...prev,
                          offer_mode_instructions: {
                            ...prev.offer_mode_instructions,
                            calculation: event.target.value
                          }
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Dienstleistung Positionstext</label>
                    <textarea
                      value={aiPrompts.offer_mode_instructions.position_text}
                      onChange={(event) =>
                        setAiPrompts((prev) => ({
                          ...prev,
                          offer_mode_instructions: {
                            ...prev.offer_mode_instructions,
                            position_text: event.target.value
                          }
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-sand-500">Material Beschreibung</label>
                    <textarea
                      value={aiPrompts.offer_mode_instructions.device_description}
                      onChange={(event) =>
                        setAiPrompts((prev) => ({
                          ...prev,
                          offer_mode_instructions: {
                            ...prev.offer_mode_instructions,
                            device_description: event.target.value
                          }
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <button
                  onClick={saveAiPrompts}
                  className="rounded-full border border-sand-200 bg-sand-900 px-3 py-2 uppercase tracking-wide text-white hover:opacity-90"
                >
                  Prompts speichern
                </button>
                {aiPromptsLoadStatus === "error" && (
                  <span className="text-rose-600">Laden fehlgeschlagen</span>
                )}
                {aiPromptsStatus === "saved" && (
                  <span className="text-emerald-600">Gespeichert</span>
                )}
                {aiPromptsStatus === "error" && (
                  <span className="text-rose-600">Speichern fehlgeschlagen</span>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setPbxOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Anlagen API</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-600">
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
                  ? "Zugangsdaten fehlen"
                  : "getrennt"}
              </span>
              <span className="text-sm text-sand-500">{pbxOpen ? "–" : "+"}</span>
            </div>
          </button>
          {pbxOpen ? (
            <>
              <p className="mt-4 text-xs text-sand-500 mb-4">
                Zugangsdaten fuer das Telefonanlagen-API (nicht CTI).
              </p>
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
                    <div className="md:col-span-2">
                      <span className="text-sand-500">Version Status:</span>{" "}
                      {pbxDebugInfo.versionOk === null
                        ? "n/a"
                        : pbxDebugInfo.versionOk
                        ? "ok"
                        : "fehlgeschlagen"}
                      {pbxDebugInfo.versionStatusCode !== null
                        ? ` (${pbxDebugInfo.versionStatusCode})`
                        : ""}
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sand-500">Version Preview:</span>{" "}
                      {pbxDebugInfo.versionPreview || pbxDebugInfo.versionError || "n/a"}
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setCtiOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
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
              <span className="text-sm text-sand-500">{ctiOpen ? "–" : "+"}</span>
            </div>
          </button>
          {ctiOpen ? (
            <>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setDebugTablesOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Datenbank-Settings</p>
            </div>
            <span className="text-sm text-sand-500">{debugTablesOpen ? "–" : "+"}</span>
          </button>
          {debugTablesOpen ? (
            <>
              <div className="mt-4 text-xs text-sand-500 mb-3">
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
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
