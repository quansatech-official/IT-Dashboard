import { useEffect, useState } from "react";
import { Mail, Settings, Users2 } from "lucide-react";
import { telephonyService } from "../telephony/telephonyService";
import NotesRichTextEditor from "../components/NotesRichTextEditor";

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
  use_tls: true,
  use_ssl: false,
  signature_html: "",
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

const defaultRmm = {
  rmm_host: "",
  rmm_api_key: "",
  has_rmm_api_key: false,
  rmm_api_key_header: "X-API-KEY"
};

const defaultMarketplace = {
  td_synnex_base_url: "https://api.streamone.com",
  td_synnex_token_url: "https://api.streamone.com/oauth/token",
  td_synnex_client_id: "",
  td_synnex_client_secret: "",
  td_synnex_account_id: "",
  has_td_synnex_client_secret: false,
  also_sftp_host: "",
  also_sftp_port: "22",
  also_sftp_user: "",
  also_sftp_password: "",
  also_sftp_dir: "",
  also_sftp_filename: "pricelist-1.txt.zip",
  has_also_sftp_password: false
};

const defaultIcecat = {
  icecat_api_token: "",
  icecat_enabled: false,
  has_icecat_api_token: false
};

const defaultSevdesk = {
  sevdesk_base_url: "https://my.sevdesk.de/api/v1",
  sevdesk_api_token: "",
  sevdesk_contact_person_id: "",
  sevdesk_address_country_id: "",
  sevdesk_tax_type: "default",
  sevdesk_tax_rule_id: "1",
  sevdesk_tax_text: "zzgl. Umsatzsteuer",
  sevdesk_currency: "EUR",
  sevdesk_invoice_type: "RE",
  sevdesk_default_tax_rate: "19",
  sevdesk_unity_id: "",
  sevdesk_service_unity_id: "",
  sevdesk_device_unity_id: "",
  sevdesk_hourly_rate_eur: "",
  has_sevdesk_api_token: false
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
  const [employees, setEmployees] = useState([]);
  const [employeeDraft, setEmployeeDraft] = useState({
    name: "",
    short_code: "",
    color: "#111827"
  });
  const [employeeOpen, setEmployeeOpen] = useState(false);
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
  const [rmm, setRmm] = useState(defaultRmm);
  const [rmmOpen, setRmmOpen] = useState(false);
  const [rmmStatus, setRmmStatus] = useState("idle");
  const [rmmHealthStatus, setRmmHealthStatus] = useState("idle");
  const [rmmHealth, setRmmHealth] = useState({
    connected: null,
    checkedAt: "",
    hasApiKey: false,
    apiKeyHeader: "X-API-KEY",
    agentsPath: "",
    agentsStatusCode: null,
    sampleCount: 0,
    error: ""
  });
  const [pbxStatus, setPbxStatus] = useState("idle");
  const [pbxLoadStatus, setPbxLoadStatus] = useState("loading");
  const [pbxApiStatus, setPbxApiStatus] = useState("idle");
  const [pbxDebugOpen, setPbxDebugOpen] = useState(false);
  const [marketplace, setMarketplace] = useState(defaultMarketplace);
  const [marketplaceStatus, setMarketplaceStatus] = useState("idle");
  const [marketplaceLoadStatus, setMarketplaceLoadStatus] = useState("loading");
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [marketplaceDebugStatus, setMarketplaceDebugStatus] = useState("idle");
  const [icecat, setIcecat] = useState(defaultIcecat);
  const [icecatStatus, setIcecatStatus] = useState("idle");
  const [icecatLoadStatus, setIcecatLoadStatus] = useState("loading");
  const [icecatHealth, setIcecatHealth] = useState({
    status: "idle",
    ok: null,
    error: ""
  });
  const [icecatProductTest, setIcecatProductTest] = useState({
    query: "",
    status: "idle",
    title: "",
    error: ""
  });
  const [sevdesk, setSevdesk] = useState(defaultSevdesk);
  const [sevdeskStatus, setSevdeskStatus] = useState("idle");
  const [sevdeskLoadStatus, setSevdeskLoadStatus] = useState("loading");
  const [sevdeskOpen, setSevdeskOpen] = useState(false);
  const [sevdeskAdvancedOpen, setSevdeskAdvancedOpen] = useState(false);
  const [sevdeskHealth, setSevdeskHealth] = useState({
    connected: null,
    error: "",
    checkedAt: ""
  });
  const [marketplaceDebugInfo, setMarketplaceDebugInfo] = useState({
    lastCheckAt: "",
    sources: [],
    error: ""
  });
  const [marketplaceSourceDebug, setMarketplaceSourceDebug] = useState({});
  const [alsoStatus, setAlsoStatus] = useState({
    status: "idle",
    lastCheckAt: "",
    connected: null,
    latestFile: "",
    latestSize: 0,
    latestMtime: "",
    lastImportedAt: "",
    lastImportedCount: 0,
    lastSkippedCount: 0,
    lastErrorCount: 0,
    lastFilename: "",
    error: ""
  });
  const [alsoSyncStatus, setAlsoSyncStatus] = useState("idle");
  const [alsoSyncMessage, setAlsoSyncMessage] = useState("");
  const [alsoClearStatus, setAlsoClearStatus] = useState("idle");
  const [alsoClearMessage, setAlsoClearMessage] = useState("");
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
  const [aiPromptsOpen, setAiPromptsOpen] = useState(false);
  const [apiTestOpen, setApiTestOpen] = useState(false);
  const [apiTestPath, setApiTestPath] = useState("/api/telephony/calls");
  const [apiTestStatus, setApiTestStatus] = useState("idle");
  const [apiTestInfo, setApiTestInfo] = useState({
    url: "",
    statusCode: null,
    ok: null,
    preview: "",
    error: ""
  });
  const [pbxOpen, setPbxOpen] = useState(false);
  const [ctiOpen, setCtiOpen] = useState(false);
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
    fetch(`${API}/employees`)
      .then((res) => (res && res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        setEmployees(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setEmployees([]);
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
        setRmm((prev) => ({
          ...prev,
          rmm_host: data?.rmm_host || "",
          rmm_api_key: "",
          has_rmm_api_key: Boolean(data?.has_rmm_api_key),
          rmm_api_key_header: data?.rmm_api_key_header || "X-API-KEY"
        }));
        setPbx((prev) => ({
          ...prev,
          pbx_base_url: data?.pbx_base_url || "",
          pbx_api_key_id: data?.pbx_api_key_id || "",
          pbx_customer_account: data?.pbx_customer_account || "",
          pbx_api_key_secret: "",
          has_pbx_api_key_secret: Boolean(data?.has_pbx_api_key_secret)
        }));
        setMarketplace((prev) => ({
          ...prev,
          td_synnex_base_url: data?.td_synnex_base_url || defaultMarketplace.td_synnex_base_url,
          td_synnex_token_url: data?.td_synnex_token_url || defaultMarketplace.td_synnex_token_url,
          td_synnex_client_id: data?.td_synnex_client_id || "",
          td_synnex_account_id: data?.td_synnex_account_id || "",
          td_synnex_client_secret: "",
          has_td_synnex_client_secret: Boolean(data?.has_td_synnex_client_secret),
          also_sftp_host: data?.also_sftp_host || "",
          also_sftp_port: data?.also_sftp_port || defaultMarketplace.also_sftp_port,
          also_sftp_user: data?.also_sftp_user || "",
          also_sftp_dir: data?.also_sftp_dir || "",
          also_sftp_filename: data?.also_sftp_filename || defaultMarketplace.also_sftp_filename,
          also_sftp_password: "",
          has_also_sftp_password: Boolean(data?.has_also_sftp_password)
        }));
        setIcecat((prev) => ({
          ...prev,
          icecat_api_token: "",
          icecat_enabled: Boolean(data?.icecat_enabled),
          has_icecat_api_token: Boolean(data?.has_icecat_api_token)
        }));
        setSevdesk((prev) => ({
          ...prev,
          sevdesk_base_url: data?.sevdesk_base_url || defaultSevdesk.sevdesk_base_url,
          sevdesk_api_token: "",
          sevdesk_contact_person_id: data?.sevdesk_contact_person_id || "",
          sevdesk_address_country_id: data?.sevdesk_address_country_id || "",
          sevdesk_tax_type: data?.sevdesk_tax_type || defaultSevdesk.sevdesk_tax_type,
          sevdesk_tax_rule_id: data?.sevdesk_tax_rule_id || defaultSevdesk.sevdesk_tax_rule_id,
          sevdesk_tax_text: data?.sevdesk_tax_text || defaultSevdesk.sevdesk_tax_text,
          sevdesk_currency: data?.sevdesk_currency || defaultSevdesk.sevdesk_currency,
          sevdesk_invoice_type: data?.sevdesk_invoice_type || defaultSevdesk.sevdesk_invoice_type,
          sevdesk_default_tax_rate: data?.sevdesk_default_tax_rate || defaultSevdesk.sevdesk_default_tax_rate,
          sevdesk_unity_id: data?.sevdesk_unity_id || "",
          sevdesk_service_unity_id: data?.sevdesk_service_unity_id || "",
          sevdesk_device_unity_id: data?.sevdesk_device_unity_id || "",
          sevdesk_hourly_rate_eur: data?.sevdesk_hourly_rate_eur || "",
          has_sevdesk_api_token: Boolean(data?.has_sevdesk_api_token)
        }));
        setPbxLoadStatus("ready");
        setMarketplaceLoadStatus("ready");
        setIcecatLoadStatus("ready");
        setSevdeskLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setPbxLoadStatus("error");
        setMarketplaceLoadStatus("error");
        setIcecatLoadStatus("error");
        setSevdeskLoadStatus("error");
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
    if (sevdeskLoadStatus !== "ready") return;
    refreshSevdeskHealth();
  }, [sevdeskLoadStatus]);

  useEffect(() => {
    if (!rmmOpen) return;
    refreshRmmHealth();
  }, [rmmOpen]);

  useEffect(() => {
    if (!marketplaceOpen) return;
    refreshMarketplaceDebug();
    refreshAlsoStatus();
  }, [marketplaceOpen]);

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
          use_tls: smtp.use_tls,
          use_ssl: smtp.use_ssl,
          signature_html: smtp.signature_html
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


  const addEmployee = async () => {
    const name = (employeeDraft.name || "").trim();
    if (!name) return;
    try {
      const res = await fetch(`${API}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          short_code: employeeDraft.short_code || "",
          color: employeeDraft.color || "#111827"
        })
      });
      if (!res.ok) throw new Error("create_failed");
      const created = await res.json();
      setEmployees((prev) => [...prev, created]);
      setEmployeeDraft({ name: "", short_code: "", color: "#111827" });
    } catch (error) {
      // ignore create errors for now
    }
  };

  const updateEmployee = async (id, patch) => {
    try {
      const res = await fetch(`${API}/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error("update_failed");
      const updated = await res.json();
      setEmployees((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (error) {
      // ignore update errors for now
    }
  };

  const deleteEmployee = async (id) => {
    const ok = window.confirm("Mitarbeiter wirklich löschen?");
    if (!ok) return;
    try {
      const res = await fetch(`${API}/employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setEmployees((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      // ignore delete errors for now
    }
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

  const refreshRmmHealth = async () => {
    setRmmHealthStatus("loading");
    try {
      const res = await fetch(`${API}/rmm/health`);
      if (!res.ok) throw new Error("health_failed");
      const data = await res.json();
      setRmmHealth({
        connected: Boolean(data?.connected),
        checkedAt: data?.checkedAt || "",
        hasApiKey: Boolean(data?.hasApiKey),
        apiKeyHeader: data?.apiKeyHeader || "X-API-KEY",
        agentsPath: data?.agentsPath || "",
        agentsStatusCode:
          data?.agentsStatusCode === null || typeof data?.agentsStatusCode === "undefined"
            ? null
            : Number(data.agentsStatusCode),
        sampleCount: Number(data?.sampleCount || 0),
        error: data?.error || ""
      });
      setRmmHealthStatus("ready");
    } catch (error) {
      setRmmHealth({
        connected: false,
        checkedAt: new Date().toISOString(),
        hasApiKey: false,
        apiKeyHeader: "X-API-KEY",
        agentsPath: "",
        agentsStatusCode: null,
        sampleCount: 0,
        error: error?.message ? String(error.message) : "RMM Health fehlgeschlagen"
      });
      setRmmHealthStatus("error");
    }
  };

  const saveRmmSettings = async () => {
    setRmmStatus("saving");
    try {
      const res = await fetch(`${API}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rmm_host: rmm.rmm_host,
          rmm_api_key: rmm.rmm_api_key,
          rmm_api_key_header: rmm.rmm_api_key_header
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setRmm((prev) => ({
        ...prev,
        rmm_host: data?.rmm_host || "",
        rmm_api_key: "",
        has_rmm_api_key: Boolean(data?.has_rmm_api_key),
        rmm_api_key_header: data?.rmm_api_key_header || "X-API-KEY"
      }));
      setRmmStatus("saved");
      refreshRmmHealth();
    } catch (error) {
      setRmmStatus("error");
    }
    setTimeout(() => setRmmStatus("idle"), 2000);
  };

  const saveSevdeskSettings = async () => {
    setSevdeskStatus("saving");
    try {
      const res = await fetch(`${API}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sevdesk_base_url: sevdesk.sevdesk_base_url,
          sevdesk_api_token: sevdesk.sevdesk_api_token,
          sevdesk_contact_person_id: sevdesk.sevdesk_contact_person_id,
          sevdesk_address_country_id: sevdesk.sevdesk_address_country_id,
          sevdesk_tax_type: sevdesk.sevdesk_tax_type,
          sevdesk_tax_rule_id: sevdesk.sevdesk_tax_rule_id,
          sevdesk_tax_text: sevdesk.sevdesk_tax_text,
          sevdesk_currency: sevdesk.sevdesk_currency,
          sevdesk_invoice_type: sevdesk.sevdesk_invoice_type,
          sevdesk_default_tax_rate: sevdesk.sevdesk_default_tax_rate,
          sevdesk_unity_id: sevdesk.sevdesk_unity_id,
          sevdesk_service_unity_id: sevdesk.sevdesk_service_unity_id,
          sevdesk_device_unity_id: sevdesk.sevdesk_device_unity_id,
          sevdesk_hourly_rate_eur: sevdesk.sevdesk_hourly_rate_eur
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setSevdesk((prev) => ({
        ...prev,
        sevdesk_base_url: data?.sevdesk_base_url || defaultSevdesk.sevdesk_base_url,
        sevdesk_api_token: "",
        sevdesk_contact_person_id: data?.sevdesk_contact_person_id || "",
        sevdesk_address_country_id: data?.sevdesk_address_country_id || "",
        sevdesk_tax_type: data?.sevdesk_tax_type || defaultSevdesk.sevdesk_tax_type,
        sevdesk_tax_rule_id: data?.sevdesk_tax_rule_id || defaultSevdesk.sevdesk_tax_rule_id,
        sevdesk_tax_text: data?.sevdesk_tax_text || defaultSevdesk.sevdesk_tax_text,
        sevdesk_currency: data?.sevdesk_currency || defaultSevdesk.sevdesk_currency,
        sevdesk_invoice_type: data?.sevdesk_invoice_type || defaultSevdesk.sevdesk_invoice_type,
        sevdesk_default_tax_rate: data?.sevdesk_default_tax_rate || defaultSevdesk.sevdesk_default_tax_rate,
        sevdesk_unity_id: data?.sevdesk_unity_id || "",
        sevdesk_service_unity_id: data?.sevdesk_service_unity_id || "",
        sevdesk_device_unity_id: data?.sevdesk_device_unity_id || "",
        sevdesk_hourly_rate_eur: data?.sevdesk_hourly_rate_eur || "",
        has_sevdesk_api_token: Boolean(data?.has_sevdesk_api_token)
      }));
      setSevdeskStatus("saved");
      refreshSevdeskHealth();
    } catch (error) {
      setSevdeskStatus("error");
    }
    setTimeout(() => setSevdeskStatus("idle"), 2000);
  };

  const saveMarketplaceSettings = async () => {
    setMarketplaceStatus("saving");
    try {
      const res = await fetch(`${API}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          td_synnex_base_url: marketplace.td_synnex_base_url,
          td_synnex_token_url: marketplace.td_synnex_token_url,
          td_synnex_client_id: marketplace.td_synnex_client_id,
          td_synnex_client_secret: marketplace.td_synnex_client_secret,
          td_synnex_account_id: marketplace.td_synnex_account_id,
          also_sftp_host: marketplace.also_sftp_host,
          also_sftp_port: marketplace.also_sftp_port,
          also_sftp_user: marketplace.also_sftp_user,
          also_sftp_password: marketplace.also_sftp_password,
          also_sftp_dir: marketplace.also_sftp_dir,
          also_sftp_filename: marketplace.also_sftp_filename
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setMarketplace((prev) => ({
        ...prev,
        td_synnex_base_url: data?.td_synnex_base_url || defaultMarketplace.td_synnex_base_url,
        td_synnex_token_url: data?.td_synnex_token_url || defaultMarketplace.td_synnex_token_url,
        td_synnex_client_id: data?.td_synnex_client_id || "",
        td_synnex_account_id: data?.td_synnex_account_id || "",
        td_synnex_client_secret: "",
        has_td_synnex_client_secret: Boolean(data?.has_td_synnex_client_secret),
        also_sftp_host: data?.also_sftp_host || "",
        also_sftp_port: data?.also_sftp_port || defaultMarketplace.also_sftp_port,
        also_sftp_user: data?.also_sftp_user || "",
        also_sftp_dir: data?.also_sftp_dir || "",
        also_sftp_filename: data?.also_sftp_filename || "",
        also_sftp_password: "",
        has_also_sftp_password: Boolean(data?.has_also_sftp_password)
      }));
      setMarketplaceStatus("saved");
    } catch (error) {
      setMarketplaceStatus("error");
    }
    setTimeout(() => setMarketplaceStatus("idle"), 2000);
  };

  const saveIcecatSettings = async () => {
    setIcecatStatus("saving");
    try {
      const res = await fetch(`${API}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          icecat_api_token: icecat.icecat_api_token,
          icecat_enabled: icecat.icecat_enabled
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setIcecat((prev) => ({
        ...prev,
        icecat_api_token: "",
        icecat_enabled: Boolean(data?.icecat_enabled),
        has_icecat_api_token: Boolean(data?.has_icecat_api_token)
      }));
      setIcecatStatus("saved");
    } catch (error) {
      setIcecatStatus("error");
    }
    setTimeout(() => setIcecatStatus("idle"), 2000);
  };

  const refreshIcecatHealth = async () => {
    setIcecatHealth({ status: "loading", ok: null, error: "" });
    try {
      const res = await fetch(`${API}/integrations/icecat/status`);
      if (!res.ok) throw new Error("status_failed");
      const data = await res.json();
      setIcecatHealth({
        status: "ready",
        ok: Boolean(data?.ok),
        error: data?.error || ""
      });
    } catch (error) {
      setIcecatHealth({
        status: "error",
        ok: false,
        error: error?.message ? String(error.message) : "Status fehlgeschlagen."
      });
    }
  };

  const runIcecatProductTest = async () => {
    const query = icecatProductTest.query.trim();
    if (!query) return;
    setIcecatProductTest((prev) => ({
      ...prev,
      status: "loading",
      title: "",
      error: ""
    }));
    try {
      const isEan = /^\d{8,14}$/.test(query);
      const params = new URLSearchParams();
      if (isEan) {
        params.set("ean", query);
      } else if (query.includes(":")) {
        const [brand, ...rest] = query.split(":");
        const mpn = rest.join(":").trim();
        if (brand.trim() && mpn) {
          params.set("brand", brand.trim());
          params.set("mpn", mpn);
        }
      } else {
        const parts = query.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          params.set("brand", parts[0]);
          params.set("mpn", parts.slice(1).join(" "));
        }
      }
      if (!params.toString()) {
        throw new Error("Bitte EAN oder Brand+MPN angeben.");
      }
      const res = await fetch(`${API}/marketplace/alternative/icecat?${params.toString()}`);
      if (!res.ok) throw new Error("Test fehlgeschlagen.");
      const data = await res.json();
      setIcecatProductTest((prev) => ({
        ...prev,
        status: "ready",
        title: data?.title || "",
        error: data ? "" : "Kein Treffer"
      }));
    } catch (error) {
      setIcecatProductTest((prev) => ({
        ...prev,
        status: "error",
        title: "",
        error: error?.message ? String(error.message) : "Test fehlgeschlagen."
      }));
    }
  };

  const refreshMarketplaceDebug = async () => {
    setMarketplaceDebugStatus("loading");
    try {
      const res = await fetch(`${API}/marketplace/sources`);
      if (!res.ok) throw new Error("debug_failed");
      const data = await res.json();
      setMarketplaceDebugInfo({
        lastCheckAt: new Date().toISOString(),
        sources: Array.isArray(data) ? data : [],
        error: ""
      });
      setMarketplaceDebugStatus("ready");
    } catch (error) {
      setMarketplaceDebugInfo({
        lastCheckAt: new Date().toISOString(),
        sources: [],
        error: error?.message ? String(error.message) : "Fehler"
      });
      setMarketplaceDebugStatus("error");
    }
    setTimeout(() => setMarketplaceDebugStatus("idle"), 2000);
  };

  const refreshMarketplaceSourceDebug = async (source) => {
    setMarketplaceSourceDebug((prev) => ({
      ...prev,
      [source]: { status: "loading", lastCheckAt: new Date().toISOString(), available: null, error: "" }
    }));
    try {
      const res = await fetch(`${API}/marketplace/debug/${source}`);
      if (!res.ok) throw new Error("debug_failed");
      const data = await res.json();
      setMarketplaceSourceDebug((prev) => ({
        ...prev,
        [source]: {
          status: "ready",
          lastCheckAt: new Date().toISOString(),
          available: Boolean(data?.available),
          error: data?.error || ""
        }
      }));
    } catch (error) {
      setMarketplaceSourceDebug((prev) => ({
        ...prev,
        [source]: {
          status: "error",
          lastCheckAt: new Date().toISOString(),
          available: false,
          error: error?.message ? String(error.message) : "Fehler"
        }
      }));
    }
  };

  const refreshAlsoStatus = async () => {
    setAlsoStatus((prev) => ({
      ...prev,
      status: "loading",
      lastCheckAt: new Date().toISOString(),
      error: ""
    }));
    try {
      const res = await fetch(`${API}/marketplace/also/status`);
      if (!res.ok) {
        const text = await res.text();
        let message = text || `Status fehlgeschlagen (${res.status})`;
        try {
          const parsed = text ? JSON.parse(text) : null;
          if (parsed?.detail) {
            message = String(parsed.detail);
          } else if (parsed) {
            message = JSON.stringify(parsed);
          }
        } catch (error) {
          // keep raw text
        }
        throw new Error(message);
      }
      const data = await res.json();
      setAlsoStatus({
        status: "ready",
        lastCheckAt: new Date().toISOString(),
        connected: Boolean(data?.connected),
        latestFile: data?.latest_file || "",
        latestSize: Number(data?.latest_size || 0),
        latestMtime: data?.latest_mtime || "",
        lastImportedAt: data?.last_imported_at || "",
        lastImportedCount: Number(data?.last_imported_count || 0),
        lastSkippedCount: Number(data?.last_skipped_count || 0),
        lastErrorCount: Number(data?.last_error_count || 0),
        lastFilename: data?.last_filename || "",
        error: data?.error || ""
      });
    } catch (error) {
      setAlsoStatus({
        status: "error",
        lastCheckAt: new Date().toISOString(),
        connected: false,
        latestFile: "",
        latestSize: 0,
        latestMtime: "",
        lastImportedAt: "",
        lastImportedCount: 0,
        lastSkippedCount: 0,
        lastErrorCount: 0,
        lastFilename: "",
        error: error?.message ? String(error.message) : "Fehler"
      });
    }
  };

  const runAlsoSync = async () => {
    if (alsoSyncStatus === "loading") return;
    setAlsoSyncStatus("loading");
    setAlsoSyncMessage("");
    try {
      const syncRes = await fetch(`${API}/marketplace/sync/also`, { method: "POST" });
      if (!syncRes.ok) {
        const text = await syncRes.text();
        throw new Error(text || "sync_failed");
      }
      const runRes = await fetch(`${API}/marketplace/also/run`, { method: "POST" });
      if (!runRes.ok) {
        const text = await runRes.text();
        throw new Error(text || "run_failed");
      }
      await refreshAlsoStatus();
      setAlsoSyncStatus("ready");
      setAlsoSyncMessage("Import gestartet.");
    } catch (error) {
      setAlsoSyncStatus("error");
      setAlsoSyncMessage(error?.message ? String(error.message) : "Import fehlgeschlagen.");
    }
    setTimeout(() => {
      setAlsoSyncStatus("idle");
      setAlsoSyncMessage("");
    }, 4000);
  };

  const clearAlsoDb = async () => {
    if (alsoClearStatus === "loading") return;
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "ALSO-Datenbank wirklich leeren? Danach muss der Import neu gestartet werden."
      );
      if (!confirmed) return;
    }
    setAlsoClearStatus("loading");
    setAlsoClearMessage("");
    try {
      const res = await fetch(`${API}/marketplace/also/clear`, { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "clear_failed");
      }
      await refreshAlsoStatus();
      setAlsoClearStatus("ready");
      setAlsoClearMessage("ALSO-Datenbank geleert.");
    } catch (error) {
      setAlsoClearStatus("error");
      setAlsoClearMessage(error?.message ? String(error.message) : "Löschen fehlgeschlagen.");
    }
    setTimeout(() => {
      setAlsoClearStatus("idle");
      setAlsoClearMessage("");
    }, 4000);
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

  const refreshSevdeskHealth = async () => {
    setSevdeskHealth((prev) => ({
      ...prev,
      connected: null,
      error: ""
    }));
    try {
      const res = await fetch(`${API}/sevdesk/health`);
      const data = await res.json();
      if (!res.ok || !data?.connected) {
        setSevdeskHealth({
          connected: false,
          error: data?.error || "Verbindung fehlgeschlagen",
          checkedAt: new Date().toISOString()
        });
        return;
      }
      setSevdeskHealth({
        connected: true,
        error: "",
        checkedAt: new Date().toISOString()
      });
    } catch (error) {
      setSevdeskHealth({
        connected: false,
        error: error?.message ? String(error.message) : "Fehler",
        checkedAt: new Date().toISOString()
      });
    }
  };

  const buildApiTestUrl = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (normalized.startsWith("/api/") || normalized === "/api") return normalized;
    return `${API}${normalized}`;
  };

  const runApiTest = async () => {
    const url = buildApiTestUrl(apiTestPath);
    if (!url) return;
    setApiTestStatus("loading");
    try {
      const res = await fetch(url);
      const text = await res.text();
      const preview = text.slice(0, 800);
      setApiTestInfo({
        url,
        statusCode: res.status,
        ok: res.ok,
        preview,
        error: res.ok ? "" : preview
      });
      setApiTestStatus("ready");
    } catch (error) {
      setApiTestInfo({
        url,
        statusCode: null,
        ok: false,
        preview: "",
        error: error?.message ? String(error.message) : "Request failed"
      });
      setApiTestStatus("error");
    }
    setTimeout(() => setApiTestStatus("idle"), 2000);
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
                <div className="md:col-span-2">
                  <label className="text-xs text-sand-500">Signatur</label>
                  <div className="mt-2">
                    <NotesRichTextEditor
                      value={smtp.signature_html}
                      onChange={(value) =>
                        setSmtp((prev) => ({ ...prev, signature_html: value }))
                      }
                      placeholder="Mit freundlichen Gruessen"
                      minHeight="140px"
                    />
                  </div>
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
            onClick={() => setEmployeeOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Users2 size={18} />
              <div>
                <h3 className="text-lg font-display text-sand-900">Unternehmensstamm</h3>
              </div>
            </div>
            <span className="text-sm text-sand-500">{employeeOpen ? "–" : "+"}</span>
          </button>
          {employeeOpen ? (
            <>
              <p className="mt-2 text-sm text-sand-600">
                Zuweisungen, Kürzel und Farben für die Aufgaben-Pins.
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto_auto] gap-3 items-end">
                <div>
                  <label className="text-xs text-sand-500">Name</label>
                  <input
                    value={employeeDraft.name}
                    onChange={(event) =>
                      setEmployeeDraft((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="Max Mustermann"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">Kürzel</label>
                  <input
                    value={employeeDraft.short_code}
                    onChange={(event) =>
                      setEmployeeDraft((prev) => ({ ...prev, short_code: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="MM"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">Farbe</label>
                  <input
                    type="color"
                    value={employeeDraft.color}
                    onChange={(event) =>
                      setEmployeeDraft((prev) => ({ ...prev, color: event.target.value }))
                    }
                    className="mt-1 h-10 w-12 rounded-xl border border-sand-200 bg-white p-1"
                  />
                </div>
                <button
                  type="button"
                  onClick={addEmployee}
                  className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                >
                  Hinzufügen
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {employees.length ? (
                  employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto_auto] gap-3 items-center rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2"
                    >
                      <input
                        value={employee.name || ""}
                        onChange={(event) =>
                          setEmployees((prev) =>
                            prev.map((item) =>
                              item.id === employee.id
                                ? { ...item, name: event.target.value }
                                : item
                            )
                          )
                        }
                        onBlur={(event) =>
                          updateEmployee(employee.id, { name: event.target.value })
                        }
                        className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        value={employee.short_code || ""}
                        onChange={(event) =>
                          setEmployees((prev) =>
                            prev.map((item) =>
                              item.id === employee.id
                                ? { ...item, short_code: event.target.value }
                                : item
                            )
                          )
                        }
                        onBlur={(event) =>
                          updateEmployee(employee.id, { short_code: event.target.value })
                        }
                        className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        type="color"
                        value={employee.color || "#111827"}
                        onChange={(event) =>
                          setEmployees((prev) =>
                            prev.map((item) =>
                              item.id === employee.id
                                ? { ...item, color: event.target.value }
                                : item
                            )
                          )
                        }
                        onBlur={(event) =>
                          updateEmployee(employee.id, { color: event.target.value })
                        }
                        className="h-9 w-10 rounded-xl border border-sand-200 bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={() => deleteEmployee(employee.id)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                      >
                        Löschen
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-4 text-xs text-sand-500">
                    Noch keine Mitarbeiter angelegt.
                  </div>
                )}
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
            onClick={() => setApiTestOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">API Test</p>
            </div>
            <span className="text-sm text-sand-500">{apiTestOpen ? "–" : "+"}</span>
          </button>
          {apiTestOpen ? (
            <>
              <div className="mt-4">
                <label className="text-xs text-sand-500">Endpoint</label>
                <input
                  value={apiTestPath}
                  onChange={(event) => setApiTestPath(event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                  placeholder="/api/telephony/calls"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={runApiTest}
                  className="rounded-full border border-sand-200 bg-white px-3 py-2 uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                >
                  Endpoint testen
                </button>
                {apiTestStatus === "error" && (
                  <span className="text-rose-600">Test fehlgeschlagen</span>
                )}
                {apiTestStatus === "ready" && (
                  <span className="text-emerald-600">Antwort erhalten</span>
                )}
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-3 text-xs text-sand-700">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <span className="text-sand-500">URL:</span> {apiTestInfo.url || "n/a"}
                  </div>
                  <div>
                    <span className="text-sand-500">Status Code:</span>{" "}
                    {apiTestInfo.statusCode ?? "n/a"}
                  </div>
                  <div>
                    <span className="text-sand-500">Status:</span>{" "}
                    {apiTestInfo.ok === null
                      ? "unbekannt"
                      : apiTestInfo.ok
                      ? "ok"
                      : "fehlgeschlagen"}
                  </div>
                  <div>
                    <span className="text-sand-500">Fehler:</span>{" "}
                    {apiTestInfo.error || "n/a"}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-sand-500">Response Preview:</span>{" "}
                    {apiTestInfo.preview || "n/a"}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setRmmOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">RMM Verbindung</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  rmmHealth.connected === null
                    ? "bg-sand-300"
                    : rmmHealth.connected === true
                    ? "bg-emerald-500"
                    : "bg-rose-500"
                }`}
              />
              <span>
                API{" "}
                {rmmHealth.connected === null
                  ? "unbekannt"
                  : rmmHealth.connected
                  ? "aktiv"
                  : "getrennt"}
              </span>
              <span className="text-sm text-sand-500">{rmmOpen ? "–" : "+"}</span>
            </div>
          </button>
          {rmmOpen ? (
            <>
              <p className="mt-4 text-xs text-sand-500 mb-4">
                Tactical RMM API-Key Verbindung und Connection-Test. Discovery startet erst nach stabiler API-Verbindung.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs text-sand-500">RMM Host</label>
                  <input
                    value={rmm.rmm_host}
                    onChange={(event) =>
                      setRmm((prev) => ({ ...prev, rmm_host: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="https://rmm.example.tld"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">API Key Header</label>
                  <input
                    value={rmm.rmm_api_key_header}
                    onChange={(event) =>
                      setRmm((prev) => ({ ...prev, rmm_api_key_header: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="X-API-KEY"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">API Key</label>
                  <input
                    type="password"
                    value={rmm.rmm_api_key}
                    onChange={(event) =>
                      setRmm((prev) => ({ ...prev, rmm_api_key: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder={rmm.has_rmm_api_key ? "Gespeichert" : "••••••••"}
                  />
                  <p className="mt-1 text-[11px] text-sand-400">
                    Empfohlen laut TacticalRMM: Header `X-API-KEY`.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={saveRmmSettings}
                  className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={refreshRmmHealth}
                  className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600"
                >
                  Status neu laden
                </button>
                {rmmStatus === "saved" && (
                  <span className="text-sm text-emerald-600">Gespeichert</span>
                )}
                {rmmStatus === "error" && (
                  <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
                )}
                {rmmHealthStatus === "loading" && (
                  <span className="text-sm text-sand-500">Prüfe Verbindung…</span>
                )}
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-3 text-xs text-sand-700">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div>
                    <span className="text-sand-500">Letzter Check:</span>{" "}
                    {rmmHealth.checkedAt ? new Date(rmmHealth.checkedAt).toLocaleString("de-DE") : "n/a"}
                  </div>
                  <div>
                    <span className="text-sand-500">Status:</span>{" "}
                    {rmmHealth.connected === null
                      ? "unbekannt"
                      : rmmHealth.connected
                      ? "ok"
                      : "fehlgeschlagen"}
                  </div>
                  <div>
                    <span className="text-sand-500">API Key:</span>{" "}
                    {rmmHealth.hasApiKey ? `ja (${rmmHealth.apiKeyHeader || "X-API-KEY"})` : "nein"}
                  </div>
                  <div>
                    <span className="text-sand-500">Agents Endpoint:</span>{" "}
                    {rmmHealth.agentsPath || "n/a"}
                  </div>
                  <div>
                    <span className="text-sand-500">Agents Status:</span>{" "}
                    {rmmHealth.agentsStatusCode ?? "n/a"}
                  </div>
                  <div>
                    <span className="text-sand-500">Agent Count:</span>{" "}
                    {rmmHealth.sampleCount ?? 0}
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-sand-500">Fehler:</span>{" "}
                    {rmmHealth.error || "n/a"}
                  </div>
                </div>
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
            onClick={() => setSevdeskOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Faktura API (sevdesk)</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-600">
              <span
                className={`h-2 w-2 rounded-full ${
                  sevdeskHealth.connected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span>
                API{" "}
                {sevdeskHealth.connected === null
                  ? "unbekannt"
                  : sevdeskHealth.connected
                  ? "aktiv"
                  : "getrennt"}
              </span>
              <span className="text-sm text-sand-500">{sevdeskOpen ? "–" : "+"}</span>
            </div>
          </button>
          {sevdeskOpen ? (
            <>
              <p className="mt-4 text-xs text-sand-500 mb-4">
                Einstellungen fuer die Rechnungsentwurf-Integration mit sevdesk.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-sand-500">API Token</label>
                  <input
                    type="password"
                    value={sevdesk.sevdesk_api_token}
                    onChange={(event) =>
                      setSevdesk((prev) => ({ ...prev, sevdesk_api_token: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder={sevdesk.has_sevdesk_api_token ? "Gespeichert" : "••••••••"}
                  />
                  <p className="mt-2 text-[11px] text-sand-400">
                    Nur API Token noetig; weitere Felder optional fuer Rechnungsentwuerfe.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-sand-500">Kontaktperson ID</label>
                  <input
                    value={sevdesk.sevdesk_contact_person_id}
                    onChange={(event) =>
                      setSevdesk((prev) => ({ ...prev, sevdesk_contact_person_id: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="SevUser ID"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">Land ID (Adresse)</label>
                  <input
                    value={sevdesk.sevdesk_address_country_id}
                    onChange={(event) =>
                      setSevdesk((prev) => ({ ...prev, sevdesk_address_country_id: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="StaticCountry ID"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">Steuerregel ID (taxRule)</label>
                  <input
                    value={sevdesk.sevdesk_tax_rule_id}
                    onChange={(event) =>
                      setSevdesk((prev) => ({ ...prev, sevdesk_tax_rule_id: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">Unity ID (Fallback)</label>
                  <input
                    value={sevdesk.sevdesk_unity_id}
                    onChange={(event) =>
                      setSevdesk((prev) => ({ ...prev, sevdesk_unity_id: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="Unity ID"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setSevdeskAdvancedOpen((current) => !current)}
                  className="text-xs uppercase tracking-[0.3em] text-sand-500"
                >
                  {sevdeskAdvancedOpen ? "Erweiterte Einstellungen ausblenden" : "Erweiterte Einstellungen anzeigen"}
                </button>
              </div>
              {sevdeskAdvancedOpen ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-sand-500">Base URL</label>
                    <input
                      value={sevdesk.sevdesk_base_url}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_base_url: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="https://my.sevdesk.de/api/v1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Steuerart (taxType)</label>
                    <input
                      value={sevdesk.sevdesk_tax_type}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_tax_type: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="default"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-sand-500">Steuertext</label>
                    <input
                      value={sevdesk.sevdesk_tax_text}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_tax_text: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="zzgl. Umsatzsteuer"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Waehrung</label>
                    <input
                      value={sevdesk.sevdesk_currency}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_currency: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="EUR"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Rechnungstyp</label>
                    <input
                      value={sevdesk.sevdesk_invoice_type}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_invoice_type: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="RE"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Default Steuer (Rate)</label>
                    <input
                      value={sevdesk.sevdesk_default_tax_rate}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_default_tax_rate: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="19"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Unity ID (Service)</label>
                    <input
                      value={sevdesk.sevdesk_service_unity_id}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_service_unity_id: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Unity ID"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Unity ID (Material)</label>
                    <input
                      value={sevdesk.sevdesk_device_unity_id}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_device_unity_id: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Unity ID"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Stundensatz EUR</label>
                    <input
                      value={sevdesk.sevdesk_hourly_rate_eur}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_hourly_rate_eur: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="120"
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={saveSevdeskSettings}
                  className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={refreshSevdeskHealth}
                  className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600"
                >
                  Status neu laden
                </button>
                {sevdeskLoadStatus === "error" && (
                  <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
                )}
                {sevdeskStatus === "saved" && (
                  <span className="text-sm text-emerald-600">Gespeichert</span>
                )}
                {sevdeskStatus === "error" && (
                  <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
                )}
              </div>
              {sevdeskHealth.error ? (
                <div className="mt-3 text-xs text-rose-600">{sevdeskHealth.error}</div>
              ) : null}
              {sevdeskHealth.connected === true ? (
                <div className="mt-3 text-xs text-emerald-600">
                  Verbindung OK
                  {sevdeskHealth.checkedAt
                    ? ` · Letzter Check: ${new Date(sevdeskHealth.checkedAt).toLocaleString("de-DE")}`
                    : ""}
                </div>
              ) : null}
              {sevdeskHealth.connected === false && !sevdeskHealth.error ? (
                <div className="mt-3 text-xs text-rose-600">
                  Verbindung fehlgeschlagen
                  {sevdeskHealth.checkedAt
                    ? ` · Letzter Check: ${new Date(sevdeskHealth.checkedAt).toLocaleString("de-DE")}`
                    : ""}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setMarketplaceOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                Marketplace Import
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-600">
              <span className="text-sm text-sand-500">{marketplaceOpen ? "–" : "+"}</span>
            </div>
          </button>
          {marketplaceOpen ? (
            <>
              <p className="mt-4 text-xs text-sand-500 mb-4">
                Zugangsdaten und Endpunkte fuer Marketplace-Importe.
              </p>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                    Icecat
                  </p>
                  <span className="text-xs text-sand-500">
                    {icecat.has_icecat_api_token ? "konfiguriert" : "offen"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-sand-500">
                  Alternative Produktbeschreibungen und Bilder via Icecat.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-xs text-sand-500">API Token</label>
                    <input
                      type="password"
                      value={icecat.icecat_api_token}
                      onChange={(event) =>
                        setIcecat((prev) => ({ ...prev, icecat_api_token: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder={icecat.has_icecat_api_token ? "Gespeichert" : "••••••••"}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-sand-700 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={icecat.icecat_enabled}
                      onChange={(event) =>
                        setIcecat((prev) => ({ ...prev, icecat_enabled: event.target.checked }))
                      }
                    />
                    Icecat aktiv
                  </label>
                  <div>
                    <label className="text-xs text-sand-500">Produktname Test</label>
                    <input
                      value={icecatProductTest.query}
                      onChange={(event) =>
                        setIcecatProductTest((prev) => ({
                          ...prev,
                          query: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="hp probook"
                    />
                    <p className="mt-1 text-[10px] text-sand-500">
                      EAN oder Brand+MPN (z.B. hp probook)
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={saveIcecatSettings}
                    className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                  >
                    Speichern
                  </button>
                  <button
                    type="button"
                    onClick={refreshIcecatHealth}
                    className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600"
                  >
                    {icecatHealth.status === "loading" ? "Test läuft..." : "Icecat Test"}
                  </button>
                  <button
                    type="button"
                    onClick={runIcecatProductTest}
                    className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600"
                  >
                    {icecatProductTest.status === "loading" ? "Suche..." : "Produkt testen"}
                  </button>
                  {icecatHealth.ok !== null ? (
                    <span
                      className={`text-xs ${
                        icecatHealth.ok ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {icecatHealth.ok ? "Status OK" : "Status fehlerhaft"}
                      {icecatHealth.error ? ` · ${icecatHealth.error}` : ""}
                    </span>
                  ) : null}
                  {icecatProductTest.status !== "idle" ? (
                    <span
                      className={`text-xs ${
                        icecatProductTest.status === "error" || icecatProductTest.error
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {icecatProductTest.error
                        ? icecatProductTest.error
                        : icecatProductTest.title
                        ? `Treffer: ${icecatProductTest.title}`
                        : "Kein Treffer"}
                    </span>
                  ) : null}
                  {icecatLoadStatus === "error" && (
                    <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
                  )}
                  {icecatStatus === "saved" && (
                    <span className="text-sm text-emerald-600">Gespeichert</span>
                  )}
                  {icecatStatus === "error" && (
                    <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
                  )}
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                    TD SYNNEX (StreamOne)
                  </p>
                  <span className="text-xs text-sand-500">
                    {marketplace.td_synnex_client_id ? "konfiguriert" : "offen"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-sand-500">Base URL</label>
                    <input
                      value={marketplace.td_synnex_base_url}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          td_synnex_base_url: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="https://api.streamone.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Token URL</label>
                    <input
                      value={marketplace.td_synnex_token_url}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          td_synnex_token_url: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="https://api.streamone.com/oauth/token"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Client ID</label>
                    <input
                      value={marketplace.td_synnex_client_id}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          td_synnex_client_id: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Client ID"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Client Secret</label>
                    <input
                      type="password"
                      value={marketplace.td_synnex_client_secret}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          td_synnex_client_secret: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder={
                        marketplace.has_td_synnex_client_secret ? "Gespeichert" : "••••••••"
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Account ID</label>
                    <input
                      value={marketplace.td_synnex_account_id}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          td_synnex_account_id: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Account ID"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">ALSO SFTP</p>
                  <span className="text-xs text-sand-500">
                    {marketplace.also_sftp_host ? "konfiguriert" : "offen"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-sand-500">Host</label>
                    <input
                      value={marketplace.also_sftp_host}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          also_sftp_host: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="sftp.also.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Port</label>
                    <input
                      value={marketplace.also_sftp_port}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          also_sftp_port: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="22"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Benutzer</label>
                    <input
                      value={marketplace.also_sftp_user}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          also_sftp_user: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Username"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Passwort</label>
                    <input
                      type="password"
                      value={marketplace.also_sftp_password}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          also_sftp_password: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder={
                        marketplace.has_also_sftp_password ? "Gespeichert" : "••••••••"
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Verzeichnis</label>
                    <input
                      value={marketplace.also_sftp_dir}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          also_sftp_dir: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="/prices"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Dateiname (optional)</label>
                    <input
                      value={marketplace.also_sftp_filename}
                      onChange={(event) =>
                        setMarketplace((prev) => ({
                          ...prev,
                          also_sftp_filename: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="pricelist-1.txt.zip"
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-sand-600">
                  <button
                    type="button"
                    onClick={runAlsoSync}
                    disabled={alsoSyncStatus === "loading"}
                    className="rounded-full border border-sand-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wide text-sand-600 disabled:opacity-50"
                  >
                    {alsoSyncStatus === "loading" ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border border-sand-400 border-t-transparent" />
                        Import läuft
                      </span>
                    ) : (
                      "ALSO Import starten"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={clearAlsoDb}
                    disabled={alsoClearStatus === "loading"}
                    className="rounded-full border border-rose-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wide text-rose-700 disabled:opacity-50"
                  >
                    {alsoClearStatus === "loading" ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 animate-spin rounded-full border border-rose-400 border-t-transparent" />
                        Lösche
                      </span>
                    ) : (
                      "DB leeren"
                    )}
                  </button>
                  {alsoSyncMessage ? (
                    <span
                      className={`text-xs ${
                        alsoSyncStatus === "error" ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {alsoSyncMessage}
                    </span>
                  ) : null}
                  {alsoClearMessage ? (
                    <span
                      className={`text-xs ${
                        alsoClearStatus === "error" ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {alsoClearMessage}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={refreshAlsoStatus}
                    className="rounded-full border border-sand-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wide text-sand-600"
                  >
                    Status prüfen
                  </button>
                  <span>
                    {alsoStatus.connected === null
                      ? "Status: n/a"
                      : alsoStatus.connected
                      ? "SFTP verbunden"
                      : "SFTP offline"}
                  </span>
                  {alsoStatus.latestFile ? (
                    <span>Datei: {alsoStatus.latestFile}</span>
                  ) : null}
                  {alsoStatus.latestMtime ? (
                    <span>
                      Stand: {new Date(alsoStatus.latestMtime).toLocaleString("de-DE")}
                    </span>
                  ) : null}
                  {alsoStatus.latestSize ? (
                    <span>Größe: {Math.round(alsoStatus.latestSize / 1024)} KB</span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-sand-600">
                  {alsoStatus.lastImportedAt ? (
                    <span>Letzter Import: {alsoStatus.lastImportedAt}</span>
                  ) : null}
                  {alsoStatus.lastFilename ? (
                    <span>Import-Datei: {alsoStatus.lastFilename}</span>
                  ) : null}
                  <span>
                    Importiert: {alsoStatus.lastImportedCount} · Übersprungen:{" "}
                    {alsoStatus.lastSkippedCount} · Fehler: {alsoStatus.lastErrorCount}
                  </span>
                </div>
                {alsoStatus.error ? (
                  <div className="mt-2 text-xs text-rose-600">{alsoStatus.error}</div>
                ) : null}
                <p className="mt-3 text-xs text-sand-500">
                  Hinweis: Der Import ersetzt die ALSO-Tabelle komplett; SKU ist eindeutig,
                  dadurch keine Duplikate.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={saveMarketplaceSettings}
                  className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  Speichern
                </button>
                <button
                  type="button"
                  onClick={refreshMarketplaceDebug}
                  className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600"
                >
                  Status neu laden
                </button>
                {marketplaceLoadStatus === "error" && (
                  <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
                )}
                {marketplaceStatus === "saved" && (
                  <span className="text-sm text-emerald-600">Gespeichert</span>
                )}
                {marketplaceStatus === "error" && (
                  <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
                )}
                {marketplaceDebugStatus === "error" && (
                  <span className="text-sm text-rose-600">Debug fehlgeschlagen</span>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50 p-4 text-xs text-sand-700">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                    Debug Container
                  </p>
                  <span className="text-sand-500">
                    {marketplaceDebugInfo.lastCheckAt || "n/a"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {["td_synnex", "also"].map((source) => {
                    const info = marketplaceDebugInfo.sources.find(
                      (entry) => entry?.source === source
                    );
                    const debug = marketplaceSourceDebug[source];
                    const ok =
                      typeof debug?.available === "boolean"
                        ? debug.available
                        : Boolean(info?.available);
                    return (
                      <div
                        key={source}
                        className="rounded-xl border border-sand-200 bg-white px-3 py-3"
                      >
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-sand-500">
                          <span>Debug {source}</span>
                          <span className={ok ? "text-emerald-600" : "text-rose-500"}>
                            {ok ? "bereit" : "offline"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-sand-600">
                          {ok ? "Adapter aktiv" : "Adapter nicht verfügbar"}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-sand-500">
                          <span>{debug?.lastCheckAt || "n/a"}</span>
                          <button
                            type="button"
                            onClick={() => refreshMarketplaceSourceDebug(source)}
                            className="rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-600"
                          >
                            {debug?.status === "loading" ? "..." : "Test"}
                          </button>
                        </div>
                        {debug?.error ? (
                          <div className="mt-2 text-xs text-rose-600">{debug.error}</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                {marketplaceDebugInfo.error ? (
                  <div className="mt-3 text-rose-600">{marketplaceDebugInfo.error}</div>
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
