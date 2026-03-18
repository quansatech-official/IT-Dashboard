import { useEffect, useState } from "react";
import { Mail, Plus, Settings, Trash2, Users2 } from "lucide-react";
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

const defaultMetaHubMailbox = () => ({
  id: `mbx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  email: "",
  host: "",
  port: 993,
  username: "",
  password: "",
  has_password: false,
  folder: "INBOX",
  enabled: true,
  use_tls: true,
  use_ssl: false,
  read_only: true
});

const normalizeMetaHubMailbox = (raw) => ({
  ...defaultMetaHubMailbox(),
  ...(raw && typeof raw === "object" ? raw : {}),
  id: String(raw?.id || defaultMetaHubMailbox().id),
  name: String(raw?.name || ""),
  email: String(raw?.email || ""),
  host: String(raw?.host || ""),
  port: Number(raw?.port) > 0 ? Number(raw.port) : 993,
  username: String(raw?.username || ""),
  password: "",
  has_password: Boolean(raw?.has_password),
  folder: String(raw?.folder || "INBOX"),
  enabled: raw?.enabled !== false,
  use_tls: raw?.use_tls !== false,
  use_ssl: Boolean(raw?.use_ssl),
  read_only: true
});

const defaultMetaHub = {
  rmm_enabled: true,
  rmm_customer_field_name: "Kundennummer",
  email_enabled: false,
  refresh_seconds: "300",
  mailboxes: []
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

const defaultAiConnection = {
  ai_provider: "ollama",
  ai_base_url: "http://ollama:11434",
  ai_api_key: "",
  has_ai_api_key: false,
  ai_default_model: "",
  ai_internal_model: "",
  ai_action_model: "",
  ai_task_model: "",
  ai_customer_ranking_model: "",
  ai_customer_development_model: "",
  ai_offer_model: "",
  ai_invoice_model: ""
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
const defaultContractVariables = {
  provider_name: "Unternehmen aus Einstellungen",
  customer_name: "Musterkunde GmbH",
  generated_at: "22.02.2026",
  valid_from: "01.03.2026",
  contract_start: "01.03.2026",
  runtime_months: "12",
  minimum_term_months: "12",
  extension_period: "12",
  termination_notice: "3 Monate",
  servers: "3",
  clients: "24",
  network_devices: "14",
  iot_devices: "6",
  monthly_total: "1.250,00 EUR",
  yearly_total: "15.000,00 EUR",
  monthly_hours_included: "4,00 h",
  service_hours: "Montag bis Freitag, 08:00-17:00 Uhr (werktags)",
  reaction_time: "innerhalb von 8 Arbeitsstunden",
  hourly_rate_extra: "120,00 EUR pro Stunde",
  billing_interval: "monatlich",
  additional_systems: "keine",
  monitoring_enabled: "ja",
  backup_monitoring: "nach Vereinbarung",
  patch_management: "ja (sicherheitsrelevant)",
  security_monitoring: "ja (Basis)",
  liability_limit: "gemäß AGB",
  service_scope: "Wartung und Monitoring laut Tarif.",
  note_block: "Hinweis: Monatliche Leistungserbringung nach Vereinbarung."
};
const contractTemplateDocTypeOptions = [
  { value: "wartung", label: "Wartung" },
  { value: "monitoring", label: "Monitoring" },
  { value: "avv_dsgvo", label: "AVV / DSGVO" }
];
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

const normalizeContractTemplates = (input) => {
  const merged = { ...defaultContractTemplates };
  if (input && typeof input === "object") {
    Object.entries(input).forEach(([key, value]) => {
      if (!key) return;
      const row = value && typeof value === "object" ? value : {};
      merged[key] = {
        title: String(row.title || merged[key]?.title || "").trim(),
        description: String(row.description || merged[key]?.description || "").trim(),
        doc_type: String(row.doc_type || merged[key]?.doc_type || "wartung").trim() || "wartung",
        body_template: String(row.body_template || ""),
        header_html: String(row.header_html || ""),
        footer_html: String(row.footer_html || "")
      };
    });
  }
  return merged;
};

const normalizeContractVariables = (input) => {
  const merged = {};
  if (input && typeof input === "object" && !Array.isArray(input)) {
    Object.entries(input).forEach(([rawKey, rawValue]) => {
      const key = normalizeContractVariableKey(rawKey);
      if (!key || RESERVED_CONTRACT_PLACEHOLDERS.has(key)) return;
      merged[key] = String(rawValue || "");
    });
  }
  return merged;
};

const normalizeContractVariableDefinitions = (definitionsInput, variablesInput) => {
  const merged = {};
  const fallbackVariables = normalizeContractVariables(variablesInput);
  Object.entries(fallbackVariables).forEach(([key, value]) => {
    merged[key] = {
      value: String(value || ""),
      customer_editable: false,
      label: key
    };
  });
  if (definitionsInput && typeof definitionsInput === "object" && !Array.isArray(definitionsInput)) {
    Object.entries(definitionsInput).forEach(([rawKey, rawValue]) => {
      const key = normalizeContractVariableKey(rawKey);
      if (!key || RESERVED_CONTRACT_PLACEHOLDERS.has(key)) return;
      const existing = merged[key] || { value: "", customer_editable: false, label: key };
      if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
        const value = rawValue.value ?? rawValue.default ?? rawValue.suggested_value ?? existing.value;
        merged[key] = {
          value: String(value || ""),
          customer_editable: parseBooleanFlag(
            rawValue.customer_editable ?? rawValue.customerEditable,
            false
          ),
          label: String(rawValue.label || existing.label || key).trim() || key
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
    Object.entries(merged)
      .map(([key, value]) => [
        key,
        {
          value: String(value?.value || ""),
          customer_editable: parseBooleanFlag(value?.customer_editable, false),
          label: String(value?.label || key).trim() || key
        }
      ])
      .sort(([a], [b]) => String(a || "").localeCompare(String(b || ""), "de"))
  );
};

const flattenContractVariableDefinitions = (definitions) => {
  if (!definitions || typeof definitions !== "object" || Array.isArray(definitions)) return {};
  const out = {};
  Object.entries(definitions).forEach(([rawKey, rawValue]) => {
    const key = normalizeContractVariableKey(rawKey);
    if (!key || RESERVED_CONTRACT_PLACEHOLDERS.has(key)) return;
    const entry = rawValue && typeof rawValue === "object" ? rawValue : {};
    out[key] = String(entry.value || "");
  });
  return out;
};

const normalizeAiPromptsPayload = (data) => {
  const contractVariableDefinitions = normalizeContractVariableDefinitions(
    data?.contract_variable_definitions,
    data?.contract_variables
  );
  return {
    action_prompt: data?.action_prompt || "",
    offer_base_prompt: data?.offer_base_prompt || "",
    offer_mode_instructions: {
      cover_intro: data?.offer_mode_instructions?.cover_intro || "",
      overview: data?.offer_mode_instructions?.overview || "",
      calculation: data?.offer_mode_instructions?.calculation || "",
      position_text: data?.offer_mode_instructions?.position_text || "",
      device_description: data?.offer_mode_instructions?.device_description || ""
    },
    task_scope_prompt: data?.task_scope_prompt || "",
    invoice_compact_prompt: data?.invoice_compact_prompt || "",
    newsletter_rss_prompts: {
      newsletter: data?.newsletter_rss_prompts?.newsletter || "",
      ideas: data?.newsletter_rss_prompts?.ideas || ""
    },
    email_customer_match_prompt: data?.email_customer_match_prompt || "",
    email_task_prompt: data?.email_task_prompt || "",
    customer_invoice_summary_prompt: data?.customer_invoice_summary_prompt || "",
    customer_development_mode_prompts: {
      summary: data?.customer_development_mode_prompts?.summary || "",
      mail: data?.customer_development_mode_prompts?.mail || "",
      angebot: data?.customer_development_mode_prompts?.angebot || "",
      kundenbericht: data?.customer_development_mode_prompts?.kundenbericht || "",
      newsletter: data?.customer_development_mode_prompts?.newsletter || "",
      leitfaden: data?.customer_development_mode_prompts?.leitfaden || "",
      aktivierung_mail: data?.customer_development_mode_prompts?.aktivierung_mail || "",
      aktivierung_call: data?.customer_development_mode_prompts?.aktivierung_call || "",
      analyse: data?.customer_development_mode_prompts?.analyse || ""
    },
    customer_signal_newsletter_prompt: data?.customer_signal_newsletter_prompt || "",
    contract_header_html: data?.contract_header_html || "",
    contract_footer_html: data?.contract_footer_html || "",
    contract_templates: normalizeContractTemplates(data?.contract_templates),
    contract_variable_definitions: contractVariableDefinitions,
    contract_variables: flattenContractVariableDefinitions(contractVariableDefinitions)
  };
};

const getAiPromptValueByKey = (prompts, key) => {
  return String(
    key.split(".").reduce((current, part) => {
      if (!current || typeof current !== "object") return "";
      return current[part];
    }, prompts) || ""
  );
};

const setAiPromptValueByKey = (prompts, key, value) => {
  const parts = String(key || "").split(".").filter(Boolean);
  if (!parts.length) return prompts;
  const next = {
    ...(prompts || {})
  };
  let cursor = next;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    const current = cursor[part];
    cursor[part] = current && typeof current === "object" && !Array.isArray(current) ? { ...current } : {};
    cursor = cursor[part];
  });
  return next;
};

const AI_PROMPT_OPTIONS = [
  {
    key: "action_prompt",
    label: "Kundenbericht: Action Prompt",
    placeholders: "{text}"
  },
  {
    key: "offer_base_prompt",
    label: "Angebot: Basis Prompt",
    placeholders: "{instruction}, {context}, {current_text}"
  },
  {
    key: "offer_mode_instructions.cover_intro",
    label: "Angebot: Deckblatt Intro",
    placeholders: "Wird als {instruction} in den Basis-Prompt eingesetzt"
  },
  {
    key: "offer_mode_instructions.overview",
    label: "Angebot: Überblick",
    placeholders: "Wird als {instruction} in den Basis-Prompt eingesetzt"
  },
  {
    key: "offer_mode_instructions.calculation",
    label: "Angebot: Kalkulation",
    placeholders: "Wird als {instruction} in den Basis-Prompt eingesetzt"
  },
  {
    key: "offer_mode_instructions.position_text",
    label: "Angebot: Dienstleistung Positionstext",
    placeholders: "Wird als {instruction} in den Basis-Prompt eingesetzt"
  },
  {
    key: "offer_mode_instructions.device_description",
    label: "Angebot: Material Beschreibung",
    placeholders: "Wird als {instruction} in den Basis-Prompt eingesetzt"
  },
  {
    key: "task_scope_prompt",
    label: "Fakturierung: Aufwandsschätzung",
    placeholders: "{title}, {details}, {content_text}, {onsite_text}, {actual_hours}"
  },
  {
    key: "invoice_compact_prompt",
    label: "Fakturierung: Rechnungsposition aus Aufgaben",
    placeholders: "{task_lines}"
  },
  {
    key: "newsletter_rss_prompts.newsletter",
    label: "Newsletter RSS: Entwurf",
    placeholders: "{tone}, {article_count}"
  },
  {
    key: "newsletter_rss_prompts.ideas",
    label: "Newsletter RSS: Themenideen",
    placeholders: "{tone}, {article_count}"
  },
  {
    key: "email_customer_match_prompt",
    label: "E-Mail: Kundenzuordnung",
    placeholders: "{sender_name}, {sender_email}, {subject}, {content}, {choices_block}"
  },
  {
    key: "email_task_prompt",
    label: "E-Mail: Aufgabenentwurf",
    placeholders: "{sender_name}, {sender_email}, {subject}, {content}"
  },
  {
    key: "customer_invoice_summary_prompt",
    label: "Kunde: Zusammenfassung letzter Arbeiten",
    placeholders: "{customer_name}, {invoice_lines}"
  },
  {
    key: "customer_development_mode_prompts.summary",
    label: "Customer Development: Summary",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.mail",
    label: "Customer Development: Mail",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.angebot",
    label: "Customer Development: Angebot",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.kundenbericht",
    label: "Customer Development: Kundenbericht",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.newsletter",
    label: "Customer Development: Newsletter",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.leitfaden",
    label: "Customer Development: Leitfaden",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.aktivierung_mail",
    label: "Customer Development: Aktivierung Mail",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.aktivierung_call",
    label: "Customer Development: Aktivierung Call",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_development_mode_prompts.analyse",
    label: "Customer Development: Analyse",
    placeholders:
      "{tone}, {customer_name}, {state}, {risk}, {service_model_label}, {days_since_interaction}, {contact_due}, {days_since_invoice}, {invoice_due}, {coverage}, {unmanaged_count}, {offline_rate}, {source_lines}, {work_topics}, {signal_lines}, {recommendation_lines}"
  },
  {
    key: "customer_signal_newsletter_prompt",
    label: "Customer Development: Newsletter aus Signalen",
    placeholders: "{tone}, {avg_risk}, {source_lines}, {signal_lines}"
  }
];

const defaultAiPromptsState = () => normalizeAiPromptsPayload({});

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

const formatTimestampOrNa = (value) => {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "n/a";
  return new Date(timestamp).toLocaleString("de-DE");
};

const formatDurationMs = (value) => {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s`;
};

const getMetaHubSummaryBadgeClass = (tone) => {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-sand-200 bg-sand-100 text-sand-700";
};

const getMetaHubRmmSummary = ({ metaHub, rmm, rmmHealthStatus, rmmHealth }) => {
  if (!metaHub?.rmm_enabled) return { label: "RMM aus", tone: "neutral" };
  if (!String(rmm?.rmm_host || "").trim()) return { label: "RMM Host fehlt", tone: "warning" };
  if (!rmm?.has_rmm_api_key && !String(rmm?.rmm_api_key || "").trim()) {
    return { label: "RMM Key fehlt", tone: "warning" };
  }
  if (rmmHealthStatus === "loading") return { label: "RMM prueft", tone: "neutral" };
  if (rmmHealth?.connected === true) return { label: "RMM ok", tone: "success" };
  if (rmmHealthStatus === "error" || rmmHealth?.connected === false) {
    return { label: "RMM Fehler", tone: "danger" };
  }
  return { label: "RMM offen", tone: "neutral" };
};

const getMetaHubEmailSummary = ({ metaHub, metaHubRuntimeStatus, activeMailboxCount }) => {
  if (!metaHub?.email_enabled) return { label: "Mail aus", tone: "neutral" };
  if (activeMailboxCount <= 0) return { label: "Mail ohne Postfach", tone: "warning" };

  const connectedMailboxCount = Number(
    metaHubRuntimeStatus?.health?.email_connected_mailboxes ||
      metaHubRuntimeStatus?.snapshot?.email_connected_mailboxes ||
      0
  );
  const errorCount =
    (metaHubRuntimeStatus?.health?.email_last_error ? 1 : 0) +
    (Array.isArray(metaHubRuntimeStatus?.snapshot?.email_errors)
      ? metaHubRuntimeStatus.snapshot.email_errors.filter(Boolean).length
      : 0);

  if (metaHubRuntimeStatus?.status === "loading") return { label: "Mail prueft", tone: "neutral" };
  if (connectedMailboxCount >= activeMailboxCount && errorCount === 0) {
    return { label: `Mail ${connectedMailboxCount}/${activeMailboxCount} ok`, tone: "success" };
  }
  if (connectedMailboxCount > 0) {
    return { label: `Mail ${connectedMailboxCount}/${activeMailboxCount} ok`, tone: "warning" };
  }
  if (errorCount > 0 || metaHubRuntimeStatus?.status === "error") {
    return { label: "Mail Fehler", tone: "danger" };
  }
  return { label: `Mail 0/${activeMailboxCount}`, tone: "warning" };
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
  const [metaHub, setMetaHub] = useState(defaultMetaHub);
  const [metaHubOpen, setMetaHubOpen] = useState(false);
  const [metaHubStatus, setMetaHubStatus] = useState("idle");
  const [metaHubRuntimeOpen, setMetaHubRuntimeOpen] = useState(false);
  const [metaHubRuntimeStatus, setMetaHubRuntimeStatus] = useState({
    status: "idle",
    checked_at: 0,
    configured: false,
    enabled: false,
    connected: false,
    triggered_refresh: false,
    error: "",
    health: {},
    snapshot: {}
  });
  const [metaHubMailboxTests, setMetaHubMailboxTests] = useState({});
  const [rmmHealthStatus, setRmmHealthStatus] = useState("idle");
  const [rmmHealth, setRmmHealth] = useState({
    connected: null,
    checkedAt: "",
    hasApiKey: false,
    apiKeyHeader: "X-API-KEY",
    agentsPath: "",
    agentsStatusCode: null,
    sampleCount: 0,
    error: "",
    attemptedUrls: []
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
  const [aiConnection, setAiConnection] = useState(defaultAiConnection);
  const [aiConnectionOpen, setAiConnectionOpen] = useState(false);
  const [aiConnectionStatus, setAiConnectionStatus] = useState("idle");
  const [aiConnectionLoadStatus, setAiConnectionLoadStatus] = useState("loading");
  const [aiConnectionModelsStatus, setAiConnectionModelsStatus] = useState("idle");
  const [aiConnectionModels, setAiConnectionModels] = useState([]);
  const [aiConnectionModelsInfo, setAiConnectionModelsInfo] = useState({
    provider: "",
    baseUrl: "",
    defaultModel: "",
    error: ""
  });
  const [aiModelDraft, setAiModelDraft] = useState("");
  const [aiModelManageStatus, setAiModelManageStatus] = useState("idle");
  const [aiModelManageMessage, setAiModelManageMessage] = useState("");
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
  const [debugMessage, setDebugMessage] = useState("");
  const [dbMaintenanceStatus, setDbMaintenanceStatus] = useState("idle");
  const [dbMaintenanceInfo, setDbMaintenanceInfo] = useState("");
  const [debugTablesOpen, setDebugTablesOpen] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [aiPromptsOpen, setAiPromptsOpen] = useState(false);
  const [contractTemplatesOpen, setContractTemplatesOpen] = useState(false);
  const [contractTariffsOpen, setContractTariffsOpen] = useState(false);
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
  const [aiPrompts, setAiPrompts] = useState(() => defaultAiPromptsState());
  const [selectedAiPromptKey, setSelectedAiPromptKey] = useState(AI_PROMPT_OPTIONS[0]?.key || "action_prompt");
  const [contractTemplateDraft, setContractTemplateDraft] = useState({
    key: "",
    title: "",
    description: "",
    doc_type: "wartung"
  });
  const [contractTemplateCreateOpen, setContractTemplateCreateOpen] = useState(false);
  const [contractVariableDraft, setContractVariableDraft] = useState({
    key: "",
    value: "",
    customerEditable: false
  });
  const [selectedContractTemplateKey, setSelectedContractTemplateKey] = useState("wartung");
  const [contractTariffs, setContractTariffs] = useState([]);
  const [contractTariffsStatus, setContractTariffsStatus] = useState("idle");
  const [contractTemplatePreviewOpen, setContractTemplatePreviewOpen] = useState(false);
  const [tariffDraft, setTariffDraft] = useState({
    name: "",
    category: "wartung",
    base_price_monthly: "",
    price_server_monthly: "",
    price_client_monthly: "",
    price_network_monthly: "",
    price_iot_monthly: "",
    hourly_price: "",
    notes: ""
  });
  const [tariffEditId, setTariffEditId] = useState(null);
  const [tariffSaveStatus, setTariffSaveStatus] = useState("idle");
  const [tariffActionMessage, setTariffActionMessage] = useState("");
  const [tariffActionMessageType, setTariffActionMessageType] = useState("info");
  const [aiPromptsStatus, setAiPromptsStatus] = useState("idle");
  const [contractTemplatesStatus, setContractTemplatesStatus] = useState("idle");
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
        setMetaHub((prev) => ({
          ...prev,
          rmm_enabled: data?.meta_hub_rmm_enabled !== false,
          rmm_customer_field_name: data?.meta_hub_rmm_customer_field_name || "Kundennummer",
          email_enabled: Boolean(data?.meta_hub_email_enabled),
          refresh_seconds: String(Number(data?.meta_hub_refresh_seconds || 300)),
          mailboxes: Array.isArray(data?.meta_hub_mailboxes)
            ? data.meta_hub_mailboxes.map((row) => normalizeMetaHubMailbox(row))
            : []
        }));
        setMetaHubMailboxTests({});
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
        setAiConnection((prev) => {
          const provider = data?.ai_provider || defaultAiConnection.ai_provider;
          return {
            ...prev,
            ai_provider: provider,
            ai_base_url:
              data?.ai_base_url ||
              (provider === "openai_compatible" ? "" : defaultAiConnection.ai_base_url),
            ai_api_key: "",
            has_ai_api_key: Boolean(data?.has_ai_api_key),
            ai_default_model: data?.ai_default_model || "",
            ai_internal_model: data?.ai_internal_model || "",
            ai_action_model: data?.ai_action_model || "",
            ai_task_model: data?.ai_task_model || "",
            ai_customer_ranking_model: data?.ai_customer_ranking_model || "",
            ai_customer_development_model: data?.ai_customer_development_model || "",
            ai_offer_model: data?.ai_offer_model || "",
            ai_invoice_model: data?.ai_invoice_model || ""
          };
        });
        setPbxLoadStatus("ready");
        setMarketplaceLoadStatus("ready");
        setIcecatLoadStatus("ready");
        setSevdeskLoadStatus("ready");
        setAiConnectionLoadStatus("ready");
        refreshMetaHubRuntimeStatus(false);
        refreshRmmHealth();
      })
      .catch(() => {
        if (!active) return;
        setPbxLoadStatus("error");
        setMarketplaceLoadStatus("error");
        setIcecatLoadStatus("error");
        setSevdeskLoadStatus("error");
        setAiConnectionLoadStatus("error");
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
    if (!metaHubOpen) return;
    refreshMetaHubRuntimeStatus(false);
  }, [metaHubOpen]);

  useEffect(() => {
    if (!contractTariffsOpen) return;
    setContractTariffsStatus("loading");
    fetch(`${API}/contract_tariffs?active_only=0`)
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        setContractTariffs(Array.isArray(data) ? data : []);
        setContractTariffsStatus("ready");
      })
      .catch(() => {
        setContractTariffs([]);
        setContractTariffsStatus("error");
      });
  }, [contractTariffsOpen]);

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
        setAiPrompts(normalizeAiPromptsPayload(data));
        const keys = Object.keys(normalizeContractTemplates(data?.contract_templates));
        if (keys.length) setSelectedContractTemplateKey(keys[0]);
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

  const refreshMetaHubRuntimeStatus = async (triggerRefresh = false) => {
    setMetaHubRuntimeStatus((prev) => ({
      ...prev,
      status: "loading",
      error: triggerRefresh ? "Refresh wird angestoßen..." : ""
    }));
    try {
      const params = new URLSearchParams();
      if (triggerRefresh) params.set("trigger_refresh", "1");
      const query = params.toString();
      const res = await fetch(`${API}/meta_hub/status${query ? `?${query}` : ""}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "status_failed");
      setMetaHubRuntimeStatus({
        status: "ready",
        checked_at: Number(data?.checked_at || Date.now()),
        configured: Boolean(data?.configured),
        enabled: Boolean(data?.enabled),
        connected: Boolean(data?.connected),
        triggered_refresh: Boolean(data?.triggered_refresh),
        error: String(data?.error || ""),
        health: data?.health && typeof data.health === "object" ? data.health : {},
        snapshot: data?.snapshot && typeof data.snapshot === "object" ? data.snapshot : {}
      });
    } catch (error) {
      setMetaHubRuntimeStatus((prev) => ({
        ...prev,
        status: "error",
        connected: false,
        error: error?.message ? String(error.message) : "Meta-Hub Status fehlgeschlagen",
        checked_at: Date.now()
      }));
    }
  };

  const clearTable = async (table) => {
    if (!window.confirm(`Tabelle "${table}" wirklich leeren?`)) return;
    setClearingTable(table);
    setDebugStatus("clearing");
    setDebugMessage("");
    try {
      const res = await fetch(`${API}/debug/clear_table`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "clear_failed");
      setDebugStatus("cleared");
      setDebugMessage(`Tabelle ${table} geleert.`);
    } catch (error) {
      setDebugStatus("error");
      setDebugMessage(error?.message ? String(error.message) : "Leeren fehlgeschlagen.");
    }
    setClearingTable("");
    setTimeout(() => setDebugStatus("idle"), 2000);
  };

  const runDatabaseMaintenance = async () => {
    setDbMaintenanceStatus("running");
    setDbMaintenanceInfo("");
    try {
      const res = await fetch(`${API}/debug/database_maintenance`, {
        method: "POST"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "database_maintenance_failed");
      const steps = Array.isArray(data?.steps) ? data.steps.join(", ") : "ANALYZE";
      setDbMaintenanceStatus("done");
      setDbMaintenanceInfo(
        `Pflege abgeschlossen (${steps}) in ${formatDurationMs(data?.duration_ms || 0)}.`
      );
    } catch (error) {
      setDbMaintenanceStatus("error");
      setDbMaintenanceInfo(error?.message ? String(error.message) : "Datenbankpflege fehlgeschlagen.");
    }
    setTimeout(() => setDbMaintenanceStatus("idle"), 3000);
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
      setAiPrompts(normalizeAiPromptsPayload(data));
      setAiPromptsStatus("saved");
    } catch (error) {
      setAiPromptsStatus("error");
    }
    setTimeout(() => setAiPromptsStatus("idle"), 2000);
  };

  const selectedAiPromptMeta =
    AI_PROMPT_OPTIONS.find((entry) => entry.key === selectedAiPromptKey) || AI_PROMPT_OPTIONS[0];
  const selectedAiPromptValue = getAiPromptValueByKey(aiPrompts, selectedAiPromptMeta?.key || "");

  const saveContractTemplates = async () => {
    setContractTemplatesStatus("saving");
    try {
      const res = await fetch(`${API}/ai_prompts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_header_html: "",
          contract_footer_html: "",
          contract_templates: aiPrompts.contract_templates,
          contract_variables: flattenContractVariableDefinitions(aiPrompts.contract_variable_definitions),
          contract_variable_definitions: aiPrompts.contract_variable_definitions
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setAiPrompts((prev) => ({
        ...prev,
        ...normalizeAiPromptsPayload(data)
      }));
      setContractTemplatesStatus("saved");
    } catch (error) {
      setContractTemplatesStatus("error");
    }
    setTimeout(() => setContractTemplatesStatus("idle"), 2000);
  };

  const addContractTemplate = () => {
    const rawKey = String(contractTemplateDraft.key || "").trim().toLowerCase();
    const key = rawKey.replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    if (!key) return;
    let created = false;
    setAiPrompts((prev) => {
      if (prev.contract_templates?.[key]) return prev;
      created = true;
      return {
        ...prev,
        contract_templates: {
          ...(prev.contract_templates || {}),
          [key]: {
            title: String(contractTemplateDraft.title || key).trim(),
            description: String(contractTemplateDraft.description || "").trim(),
            doc_type: String(contractTemplateDraft.doc_type || "wartung").trim() || "wartung",
            body_template: ""
          }
        }
      };
    });
    if (!created) return;
    setSelectedContractTemplateKey(key);
    setContractTemplateDraft({ key: "", title: "", description: "", doc_type: "wartung" });
    setContractTemplateCreateOpen(false);
  };

  const removeContractTemplate = (key) => {
    setAiPrompts((prev) => {
      const next = { ...(prev.contract_templates || {}) };
      delete next[key];
      const remaining = Object.keys(next);
      if (selectedContractTemplateKey === key && remaining.length) {
        setSelectedContractTemplateKey(remaining[0]);
      } else if (selectedContractTemplateKey === key && !remaining.length) {
        setSelectedContractTemplateKey("");
      }
      return { ...prev, contract_templates: next };
    });
  };

  const updateContractVariableDefinitions = (nextDefinitionsInput) => {
    setAiPrompts((prev) => {
      const nextDefinitions =
        typeof nextDefinitionsInput === "function"
          ? nextDefinitionsInput(prev.contract_variable_definitions || {})
          : nextDefinitionsInput;
      const normalizedDefinitions = normalizeContractVariableDefinitions(
        nextDefinitions,
        prev.contract_variables || {}
      );
      return {
        ...prev,
        contract_variable_definitions: normalizedDefinitions,
        contract_variables: flattenContractVariableDefinitions(normalizedDefinitions)
      };
    });
  };

  const addContractVariable = () => {
    const key = normalizeContractVariableKey(contractVariableDraft.key);
    if (!key) return;
    updateContractVariableDefinitions((prevDefinitions) => ({
      ...(prevDefinitions || {}),
      [key]: {
        ...(prevDefinitions?.[key] || {}),
        value: String(contractVariableDraft.value || ""),
        customer_editable: Boolean(contractVariableDraft.customerEditable),
        label: String(prevDefinitions?.[key]?.label || key)
      }
    }));
    setContractVariableDraft({ key: "", value: "", customerEditable: false });
  };

  const removeContractVariable = (key) => {
    updateContractVariableDefinitions((prevDefinitions) => {
      const next = { ...(prevDefinitions || {}) };
      delete next[key];
      return next;
    });
  };

  const contractTemplateEntries = Object.entries(aiPrompts.contract_templates || {});
  const contractVariableEntries = Object.entries(aiPrompts.contract_variable_definitions || {}).sort(([a], [b]) =>
    String(a || "").localeCompare(String(b || ""), "de")
  );
  const activeContractTemplateKey = contractTemplateEntries.some(([key]) => key === selectedContractTemplateKey)
    ? selectedContractTemplateKey
    : (contractTemplateEntries[0]?.[0] || "");
  const activeContractTemplate = aiPrompts.contract_templates?.[activeContractTemplateKey] || {
    title: "",
    description: "",
    doc_type: "wartung",
    body_template: "",
  };
  const baseContractPreviewVars = { ...defaultContractVariables };
  const contractPreviewVars = {
    ...baseContractPreviewVars,
    ...flattenContractVariableDefinitions(aiPrompts.contract_variable_definitions)
  };
  const renderTemplatePreview = (value) => {
    let html = String(value || "");
    Object.entries(contractPreviewVars).forEach(([key, replacement]) => {
      html = html.replaceAll(`{${key}}`, replacement);
    });
    return html;
  };
  const contractTemplatePreviewHtml = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vertrag Template Vorschau</title>
    <style>
      body {
        font-family: "Manrope", "Helvetica Neue", Arial, sans-serif;
        margin: 0;
        padding: 24px;
        color: #1f2937;
        background: #ffffff;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      .contract-preview-shell {
        max-width: 960px;
        margin: 0 auto;
      }
    </style>
  </head>
  <body>
    <div class="contract-preview-shell">
      ${renderTemplatePreview(activeContractTemplate?.body_template || "")}
    </div>
  </body>
</html>`;

  const resetTariffDraft = () => {
    setTariffDraft({
      name: "",
      category: "wartung",
      base_price_monthly: "",
      price_server_monthly: "",
      price_client_monthly: "",
      price_network_monthly: "",
      price_iot_monthly: "",
      hourly_price: "",
      notes: ""
    });
    setTariffEditId(null);
  };

  const startTariffEdit = (tariff) => {
    if (!tariff) return;
    setTariffDraft({
      name: String(tariff.name || ""),
      category: String(tariff.category || "wartung"),
      base_price_monthly: String(tariff.base_price_monthly ?? ""),
      price_server_monthly: String(tariff.price_server_monthly ?? ""),
      price_client_monthly: String(tariff.price_client_monthly ?? ""),
      price_network_monthly: String(tariff.price_network_monthly ?? ""),
      price_iot_monthly: String(tariff.price_iot_monthly ?? ""),
      hourly_price: String(tariff.hourly_price ?? ""),
      notes: String(tariff.notes || "")
    });
    setTariffEditId(Number(tariff.id));
  };

  const refreshTariffs = async () => {
    const res = await fetch(`${API}/contract_tariffs?active_only=0`);
    if (!res.ok) throw new Error("load_failed");
    const data = await res.json();
    setContractTariffs(Array.isArray(data) ? data : []);
  };

  const showTariffActionMessage = (message, type = "info") => {
    setTariffActionMessage(String(message || "").trim());
    setTariffActionMessageType(type);
    window.setTimeout(() => {
      setTariffActionMessage("");
      setTariffActionMessageType("info");
    }, 2500);
  };

  const saveTariffDraft = async () => {
    const name = String(tariffDraft.name || "").trim();
    if (!name) {
      setTariffSaveStatus("error");
      setTimeout(() => setTariffSaveStatus("idle"), 1800);
      return;
    }
    setTariffSaveStatus("saving");
    try {
      const payload = {
        name,
        category: String(tariffDraft.category || "wartung"),
        base_price_monthly: Number(tariffDraft.base_price_monthly || 0),
        price_server_monthly: Number(tariffDraft.price_server_monthly || 0),
        price_client_monthly: Number(tariffDraft.price_client_monthly || 0),
        price_network_monthly: Number(tariffDraft.price_network_monthly || 0),
        price_iot_monthly: Number(tariffDraft.price_iot_monthly || 0),
        hourly_price: Number(tariffDraft.hourly_price || 0),
        notes: String(tariffDraft.notes || "")
      };
      const endpoint = tariffEditId
        ? `${API}/contract_tariffs/${tariffEditId}`
        : `${API}/contract_tariffs`;
      const res = await fetch(endpoint, {
        method: tariffEditId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("save_failed");
      await refreshTariffs();
      resetTariffDraft();
      setTariffSaveStatus("saved");
    } catch {
      setTariffSaveStatus("error");
    }
    setTimeout(() => setTariffSaveStatus("idle"), 1800);
  };

  const deactivateTariff = async (tariffId) => {
    try {
      const res = await fetch(`${API}/contract_tariffs/${tariffId}/deactivate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "deactivate_failed");
      }
      await refreshTariffs();
      showTariffActionMessage("Tarif deaktiviert.", "success");
    } catch (error) {
      const message = String(error?.message || "").trim();
      showTariffActionMessage(
        message && message !== "deactivate_failed" ? message : "Deaktivieren fehlgeschlagen.",
        "error"
      );
    }
  };

  const activateTariff = async (tariffId) => {
    try {
      const res = await fetch(`${API}/contract_tariffs/${tariffId}/activate`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "activate_failed");
      }
      await refreshTariffs();
      showTariffActionMessage("Tarif aktiviert.", "success");
    } catch (error) {
      const message = String(error?.message || "").trim();
      showTariffActionMessage(
        message && message !== "activate_failed" ? message : "Aktivieren fehlgeschlagen.",
        "error"
      );
    }
  };

  const deleteTariff = async (tariffId) => {
    if (!tariffId) return;
    if (!window.confirm("Tarif wirklich dauerhaft löschen?")) return;
    try {
      const res = await fetch(`${API}/contract_tariffs/${tariffId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "delete_failed");
      }
      await refreshTariffs();
      if (Number(tariffEditId) === Number(tariffId)) {
        resetTariffDraft();
      }
      showTariffActionMessage("Tarif gelöscht.", "success");
    } catch (error) {
      const message = String(error?.message || "").trim();
      showTariffActionMessage(
        message && message !== "delete_failed" ? message : "Löschen fehlgeschlagen.",
        "error"
      );
    }
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
        error: data?.error || "",
        attemptedUrls: Array.isArray(data?.attemptedUrls)
          ? data.attemptedUrls.map((entry) => String(entry || "").trim()).filter(Boolean)
          : []
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
        error: error?.message ? String(error.message) : "RMM Health fehlgeschlagen",
        attemptedUrls: []
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

  const saveAiConnectionSettings = async () => {
    setAiConnectionStatus("saving");
    try {
      const res = await fetch(`${API}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_provider: aiConnection.ai_provider,
          ai_base_url: aiConnection.ai_base_url,
          ai_api_key: aiConnection.ai_api_key,
          ai_default_model: aiConnection.ai_default_model,
          ai_internal_model: aiConnection.ai_internal_model,
          ai_action_model: aiConnection.ai_action_model,
          ai_task_model: aiConnection.ai_task_model,
          ai_customer_ranking_model: aiConnection.ai_customer_ranking_model,
          ai_customer_development_model: aiConnection.ai_customer_development_model,
          ai_offer_model: aiConnection.ai_offer_model,
          ai_invoice_model: aiConnection.ai_invoice_model
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setAiConnection((prev) => {
        const provider = data?.ai_provider || defaultAiConnection.ai_provider;
        return {
          ...prev,
          ai_provider: provider,
          ai_base_url:
            data?.ai_base_url ||
            (provider === "openai_compatible" ? "" : defaultAiConnection.ai_base_url),
          ai_api_key: "",
          has_ai_api_key: Boolean(data?.has_ai_api_key),
          ai_default_model: data?.ai_default_model || "",
          ai_internal_model: data?.ai_internal_model || "",
          ai_action_model: data?.ai_action_model || "",
          ai_task_model: data?.ai_task_model || "",
          ai_customer_ranking_model: data?.ai_customer_ranking_model || "",
          ai_customer_development_model: data?.ai_customer_development_model || "",
          ai_offer_model: data?.ai_offer_model || "",
          ai_invoice_model: data?.ai_invoice_model || ""
        };
      });
      setAiConnectionStatus("saved");
    } catch (error) {
      setAiConnectionStatus("error");
    }
    setTimeout(() => setAiConnectionStatus("idle"), 2000);
  };

  const loadAiProviderModels = async () => {
    setAiConnectionModelsStatus("loading");
    setAiConnectionModelsInfo((prev) => ({ ...prev, error: "" }));
    try {
      const res = await fetch(`${API}/integrations/ai_models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_provider: aiConnection.ai_provider,
          ai_base_url: aiConnection.ai_base_url,
          ai_api_key: aiConnection.ai_api_key,
          ai_default_model: aiConnection.ai_default_model,
          ai_internal_model: aiConnection.ai_internal_model,
          ai_action_model: aiConnection.ai_action_model,
          ai_task_model: aiConnection.ai_task_model,
          ai_customer_ranking_model: aiConnection.ai_customer_ranking_model,
          ai_customer_development_model: aiConnection.ai_customer_development_model,
          ai_offer_model: aiConnection.ai_offer_model,
          ai_invoice_model: aiConnection.ai_invoice_model
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "model_probe_failed");
      setAiConnectionModels(Array.isArray(data?.models) ? data.models : []);
      setAiConnectionModelsInfo({
        provider: String(data?.provider || aiConnection.ai_provider || ""),
        baseUrl: String(data?.base_url || aiConnection.ai_base_url || ""),
        defaultModel: String(data?.default_model || ""),
        error: ""
      });
      setAiConnectionModelsStatus("ready");
    } catch (error) {
      setAiConnectionModels([]);
      setAiConnectionModelsInfo({
        provider: String(aiConnection.ai_provider || ""),
        baseUrl: String(aiConnection.ai_base_url || ""),
        defaultModel: "",
        error: error?.message ? String(error.message) : "Modellliste konnte nicht geladen werden"
      });
      setAiConnectionModelsStatus("error");
    }
  };

  const manageAiProviderModel = async (action) => {
    const model = String(aiModelDraft || "").trim();
    if (!model) {
      setAiModelManageStatus("error");
      setAiModelManageMessage("Bitte Modellnamen eingeben.");
      return;
    }
    setAiModelManageStatus("loading");
    setAiModelManageMessage("");
    try {
      const res = await fetch(`${API}/integrations/ai_models/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          model,
          ai_provider: aiConnection.ai_provider,
          ai_base_url: aiConnection.ai_base_url,
          ai_api_key: aiConnection.ai_api_key
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "ai_model_manage_failed");
      setAiModelManageStatus("ready");
      setAiModelManageMessage(
        action === "pull"
          ? `Modell ${model} wurde geladen oder aktualisiert.`
          : `Modell ${model} wurde entfernt.`
      );
      if (action === "delete" && aiConnection.ai_default_model === model) {
        setAiConnection((prev) => ({ ...prev, ai_default_model: "" }));
      }
      await loadAiProviderModels();
    } catch (error) {
      setAiModelManageStatus("error");
      setAiModelManageMessage(
        error?.message ? String(error.message) : "Modellverwaltung fehlgeschlagen."
      );
    }
  };

  const addMetaHubMailbox = () => {
    setMetaHub((prev) => ({
      ...prev,
      mailboxes: [...(Array.isArray(prev.mailboxes) ? prev.mailboxes : []), defaultMetaHubMailbox()]
    }));
  };

  const updateMetaHubMailbox = (mailboxId, patch) => {
    setMetaHub((prev) => ({
      ...prev,
      mailboxes: (Array.isArray(prev.mailboxes) ? prev.mailboxes : []).map((row) =>
        row.id === mailboxId ? { ...row, ...patch } : row
      )
    }));
  };

  const removeMetaHubMailbox = (mailboxId) => {
    setMetaHub((prev) => ({
      ...prev,
      mailboxes: (Array.isArray(prev.mailboxes) ? prev.mailboxes : []).filter((row) => row.id !== mailboxId)
    }));
    setMetaHubMailboxTests((prev) => {
      const next = { ...prev };
      delete next[mailboxId];
      return next;
    });
  };

  const testMetaHubMailbox = async (mailbox) => {
    const mailboxId = String(mailbox?.id || "");
    setMetaHubMailboxTests((prev) => ({
      ...prev,
      [mailboxId]: {
        status: "loading",
        ok: null,
        message: "",
        checkedAt: Date.now()
      }
    }));
    try {
      const res = await fetch(`${API}/meta_hub/mailbox_test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailbox: {
            id: String(mailbox?.id || ""),
            name: String(mailbox?.name || ""),
            email: String(mailbox?.email || ""),
            host: String(mailbox?.host || ""),
            port: Number(mailbox?.port) || 993,
            username: String(mailbox?.username || ""),
            password: String(mailbox?.password || ""),
            folder: String(mailbox?.folder || "INBOX"),
            enabled: Boolean(mailbox?.enabled),
            use_tls: Boolean(mailbox?.use_tls),
            use_ssl: Boolean(mailbox?.use_ssl),
            read_only: true
          }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Postfach-Test fehlgeschlagen");
      setMetaHubMailboxTests((prev) => ({
        ...prev,
        [mailboxId]: {
          status: "ready",
          ok: true,
          message: String(data?.message || "Verbindung erfolgreich getestet."),
          checkedAt: Number(data?.checked_at || Date.now())
        }
      }));
    } catch (error) {
      setMetaHubMailboxTests((prev) => ({
        ...prev,
        [mailboxId]: {
          status: "error",
          ok: false,
          message: error?.message ? String(error.message) : "Postfach-Test fehlgeschlagen",
          checkedAt: Date.now()
        }
      }));
    }
  };

  const saveMetaHubSettings = async () => {
    setMetaHubStatus("saving");
    try {
      const payloadMailboxes = (Array.isArray(metaHub.mailboxes) ? metaHub.mailboxes : [])
        .map((row) => ({
          id: String(row?.id || ""),
          name: String(row?.name || ""),
          email: String(row?.email || ""),
          host: String(row?.host || ""),
          port: Number(row?.port) || 993,
          username: String(row?.username || ""),
          password: String(row?.password || ""),
          folder: String(row?.folder || "INBOX"),
          enabled: Boolean(row?.enabled),
          use_tls: Boolean(row?.use_tls),
          use_ssl: Boolean(row?.use_ssl),
          read_only: true
        }))
        .filter((row) => row.host || row.username || row.email || row.name);

      const res = await fetch(`${API}/integrations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta_hub_rmm_enabled: Boolean(metaHub.rmm_enabled),
          meta_hub_rmm_customer_field_name: String(metaHub.rmm_customer_field_name || "Kundennummer"),
          meta_hub_email_enabled: Boolean(metaHub.email_enabled),
          meta_hub_refresh_seconds: Math.max(30, Number(metaHub.refresh_seconds) || 300),
          meta_hub_mailboxes: payloadMailboxes
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setMetaHub((prev) => ({
        ...prev,
        rmm_enabled: data?.meta_hub_rmm_enabled !== false,
        rmm_customer_field_name: data?.meta_hub_rmm_customer_field_name || "Kundennummer",
        email_enabled: Boolean(data?.meta_hub_email_enabled),
        refresh_seconds: String(Number(data?.meta_hub_refresh_seconds || 300)),
        mailboxes: Array.isArray(data?.meta_hub_mailboxes)
          ? data.meta_hub_mailboxes.map((row) => normalizeMetaHubMailbox(row))
          : []
      }));
      setMetaHubStatus("saved");
      refreshMetaHubRuntimeStatus(false);
    } catch (error) {
      setMetaHubStatus("error");
    }
    setTimeout(() => setMetaHubStatus("idle"), 2000);
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

  const activeMetaHubMailboxCount = Array.isArray(metaHub.mailboxes)
    ? metaHub.mailboxes.filter((row) => row?.enabled !== false).length
    : 0;
  const metaHubRmmSummary = getMetaHubRmmSummary({
    metaHub,
    rmm,
    rmmHealthStatus,
    rmmHealth
  });
  const metaHubEmailSummary = getMetaHubEmailSummary({
    metaHub,
    metaHubRuntimeStatus,
    activeMailboxCount: activeMetaHubMailboxCount
  });
  const aiProviderLabel =
    aiConnection.ai_provider === "openai_compatible"
      ? "vLLM / OpenAI-kompatibel"
      : "Ollama";
  const aiBaseUrlPlaceholder =
    aiConnection.ai_provider === "openai_compatible"
      ? "https://llm.example.tld/v1"
      : "http://ollama:11434";
  const aiModelDatalistId = "ai-provider-model-options";
  const aiKnownModels = Array.from(
    new Set(
      [
        ...aiConnectionModels,
        aiConnection.ai_default_model,
        aiConnection.ai_internal_model,
        aiConnection.ai_action_model,
        aiConnection.ai_task_model,
        aiConnection.ai_customer_ranking_model,
        aiConnection.ai_customer_development_model,
        aiConnection.ai_offer_model,
        aiConnection.ai_invoice_model
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

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
            onClick={() => setContractTemplatesOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Vertrags-Templates</p>
            </div>
            <span className="text-sm text-sand-500">{contractTemplatesOpen ? "–" : "+"}</span>
          </button>
          {contractTemplatesOpen ? (
            <>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <p className="text-[11px] text-sand-500">
                  Platzhalter z. B.: {"{customer_name}"}, {"{monthly_total}"}, {"{yearly_total}"}, {"{valid_from}"}, {"{runtime_months}"}, {"{service_hours}"}, {"{reaction_time}"}, {"{extension_period}"}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4">
                  <div className="rounded-xl border border-sand-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-sand-500">Template auswählen</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto]">
                      <select
                        value={activeContractTemplateKey}
                        onChange={(event) => setSelectedContractTemplateKey(event.target.value)}
                        className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
                      >
                        {contractTemplateEntries.map(([key, template]) => (
                          <option key={key} value={key}>
                            {key} · {template?.title || key}
                          </option>
                        ))}
                      </select>
                      <input
                        value={activeContractTemplate?.title || ""}
                        onChange={(event) => {
                          if (!activeContractTemplateKey) return;
                          setAiPrompts((prev) => ({
                            ...prev,
                            contract_templates: {
                              ...prev.contract_templates,
                              [activeContractTemplateKey]: {
                                ...(prev.contract_templates?.[activeContractTemplateKey] || {}),
                                title: event.target.value
                              }
                            }
                          }));
                        }}
                        placeholder="Titel"
                        className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setContractTemplateDraft({ key: "", title: "", description: "", doc_type: "wartung" });
                          setContractTemplateCreateOpen(true);
                        }}
                        className="inline-flex items-center justify-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                      >
                        <Plus size={10} />
                        Neues Template
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto]">
                      <input
                        value={activeContractTemplate?.description || ""}
                        onChange={(event) => {
                          if (!activeContractTemplateKey) return;
                          setAiPrompts((prev) => ({
                            ...prev,
                            contract_templates: {
                              ...prev.contract_templates,
                              [activeContractTemplateKey]: {
                                ...(prev.contract_templates?.[activeContractTemplateKey] || {}),
                                description: event.target.value
                              }
                            }
                          }));
                        }}
                        placeholder="Kurzbeschreibung"
                        className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
                      />
                      <select
                        value={activeContractTemplate?.doc_type || "wartung"}
                        onChange={(event) => {
                          if (!activeContractTemplateKey) return;
                          setAiPrompts((prev) => ({
                            ...prev,
                            contract_templates: {
                              ...prev.contract_templates,
                              [activeContractTemplateKey]: {
                                ...(prev.contract_templates?.[activeContractTemplateKey] || {}),
                                doc_type: event.target.value
                              }
                            }
                          }));
                        }}
                        className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
                      >
                        {contractTemplateDocTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => activeContractTemplateKey && removeContractTemplate(activeContractTemplateKey)}
                        disabled={!activeContractTemplateKey || Object.keys(defaultContractTemplates).includes(activeContractTemplateKey)}
                        className="inline-flex items-center justify-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={10} />
                        Löschen
                      </button>
                    </div>
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-wide text-sand-500">HTML Designer (Body)</p>
                      <div className="mt-2">
                        <NotesRichTextEditor
                          value={activeContractTemplate?.body_template || ""}
                          onChange={(value) => {
                            if (!activeContractTemplateKey) return;
                            setAiPrompts((prev) => ({
                              ...prev,
                              contract_templates: {
                                ...prev.contract_templates,
                                [activeContractTemplateKey]: {
                                  ...(prev.contract_templates?.[activeContractTemplateKey] || {}),
                                  body_template: value
                                }
                              }
                            }));
                          }}
                          minHeight="200px"
                          allowHtmlSource
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-sand-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-sand-500">Vertragsvariablen</p>
                    <p className="mt-1 text-[11px] text-sand-500">
                      Freie Platzhalter im Template werden automatisch erkannt und im Kundenstamm pro Vertrag individuell gepflegt.
                      Globale Beispielwerte werden hier nicht mehr verwaltet.
                    </p>
                  </div>

                  <div className="rounded-xl border border-sand-200 bg-white p-3">
                    <p className="text-[11px] uppercase tracking-wide text-sand-500">Vorschau</p>
                    <p className="mt-1 text-[11px] text-sand-500">
                      Öffnet die gerenderte HTML-Vorschau als Popup.
                    </p>
                    <button
                      type="button"
                      onClick={() => setContractTemplatePreviewOpen(true)}
                      className="mt-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                    >
                      Vorschau öffnen
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                <button
                  onClick={saveContractTemplates}
                  className="rounded-full border border-sand-200 bg-sand-900 px-3 py-2 uppercase tracking-wide text-white hover:opacity-90"
                >
                  Templates speichern
                </button>
                {aiPromptsLoadStatus === "error" && (
                  <span className="text-rose-600">Laden fehlgeschlagen</span>
                )}
                {contractTemplatesStatus === "saved" && (
                  <span className="text-emerald-600">Gespeichert</span>
                )}
                {contractTemplatesStatus === "error" && (
                  <span className="text-rose-600">Speichern fehlgeschlagen</span>
                )}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setContractTariffsOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Tarifpflege Verträge</p>
            </div>
            <span className="text-sm text-sand-500">{contractTariffsOpen ? "–" : "+"}</span>
          </button>
          {contractTariffsOpen ? (
            <>
              <p className="mt-2 text-sm text-sand-600">
                Tarife für Wartung/Monitoring zentral verwalten. Tarife sind Vorschlagswerte; der Endpreis wird pro Kunde individuell übernommen oder angepasst.
              </p>
              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <div className="grid gap-2 md:grid-cols-4">
                  <label className="block md:col-span-2">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Name</span>
                    <input
                      value={tariffDraft.name}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, name: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                      placeholder="z. B. Wartung Pro"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Kategorie</span>
                    <select
                      value={tariffDraft.category}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, category: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    >
                      <option value="wartung">Wartung</option>
                      <option value="monitoring">Monitoring</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Grundpreis/Monat</span>
                    <input
                      value={tariffDraft.base_price_monthly}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, base_price_monthly: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Server/Monat</span>
                    <input
                      value={tariffDraft.price_server_monthly}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, price_server_monthly: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Client/Monat</span>
                    <input
                      value={tariffDraft.price_client_monthly}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, price_client_monthly: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Netzwerkgerät/Monat</span>
                    <input
                      value={tariffDraft.price_network_monthly}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, price_network_monthly: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">IoT/Monat</span>
                    <input
                      value={tariffDraft.price_iot_monthly}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, price_iot_monthly: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Stundenpreis</span>
                    <input
                      value={tariffDraft.hourly_price}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, hourly_price: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block md:col-span-4">
                    <span className="text-[10px] uppercase tracking-wide text-sand-500">Notiz</span>
                    <input
                      value={tariffDraft.notes}
                      onChange={(event) => setTariffDraft((prev) => ({ ...prev, notes: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={saveTariffDraft}
                    className="rounded-full border border-sand-200 bg-sand-900 px-3 py-2 uppercase tracking-wide text-white hover:opacity-90"
                  >
                    {tariffEditId ? "Tarif aktualisieren" : "Tarif anlegen"}
                  </button>
                  {tariffEditId ? (
                    <button
                      type="button"
                      onClick={resetTariffDraft}
                      className="rounded-full border border-sand-300 px-3 py-2 uppercase tracking-wide hover:bg-sand-100"
                    >
                      Abbrechen
                    </button>
                  ) : null}
                  {tariffSaveStatus === "saved" ? <span className="text-emerald-600">Gespeichert</span> : null}
                  {tariffSaveStatus === "error" ? <span className="text-rose-600">Speichern fehlgeschlagen</span> : null}
                  {tariffActionMessage ? (
                    <span className={tariffActionMessageType === "error" ? "text-rose-600" : "text-emerald-600"}>
                      {tariffActionMessage}
                    </span>
                  ) : null}
                  {contractTariffsStatus === "error" ? <span className="text-rose-600">Tarife konnten nicht geladen werden</span> : null}
                </div>
                <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                  {(contractTariffs || []).map((tariff) => (
                    <div key={tariff.id} className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sand-800">
                          {tariff.name} · {String(tariff.category || "").toUpperCase()}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${tariff.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-sand-200 bg-sand-100 text-sand-600"}`}>
                            {tariff.is_active ? "Aktiv" : "Archiv"}
                          </span>
                          <button
                            type="button"
                            onClick={() => startTariffEdit(tariff)}
                            className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                          >
                            Bearbeiten
                          </button>
                          {tariff.is_active ? (
                            <button
                              type="button"
                              onClick={() => deactivateTariff(tariff.id)}
                              className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                            >
                              Deaktivieren
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => activateTariff(tariff.id)}
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 hover:bg-emerald-100"
                            >
                              Aktivieren
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteTariff(tariff.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 size={10} />
                            Löschen
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-sand-600">
                        Grundpreis {formatEurPrecise(tariff.base_price_monthly)} · Server {formatEurPrecise(tariff.price_server_monthly)} · Client {formatEurPrecise(tariff.price_client_monthly)} · Netzwerk {formatEurPrecise(tariff.price_network_monthly)} · IoT {formatEurPrecise(tariff.price_iot_monthly)} · Stunde {formatEurPrecise(tariff.hourly_price)}
                      </p>
                    </div>
                  ))}
                  {!contractTariffs.length && contractTariffsStatus !== "loading" ? (
                    <p className="text-xs text-sand-500">Noch keine Tarife vorhanden.</p>
                  ) : null}
                </div>
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
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Unternehmensstamm</p>
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
            onClick={() => setAiConnectionOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">KI Anbindung</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-600">
              <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1">
                {aiProviderLabel}
              </span>
              <span className="text-sm text-sand-500">{aiConnectionOpen ? "–" : "+"}</span>
            </div>
          </button>
          {aiConnectionOpen ? (
            <>
              <p className="mt-4 text-xs text-sand-500">
                Zentrale KI-Konfiguration fuer Workbench. Damit kann lokal `Ollama` oder ein externer
                `vLLM / OpenAI-kompatibler` Server genutzt werden, ohne die App ueber `.env` zu verdrahten.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs text-sand-500">Provider</label>
                  <select
                    value={aiConnection.ai_provider}
                    onChange={(event) =>
                      setAiConnection((prev) => {
                        const nextProvider = event.target.value;
                        const currentBaseUrl = String(prev.ai_base_url || "").trim();
                        const exampleBaseUrl =
                          nextProvider === "openai_compatible"
                            ? "https://llm.example.tld/v1"
                            : defaultAiConnection.ai_base_url;
                        const shouldReplaceBaseUrl =
                          !currentBaseUrl ||
                          currentBaseUrl === defaultAiConnection.ai_base_url ||
                          currentBaseUrl === "https://llm.example.tld/v1";
                        return {
                          ...prev,
                          ai_provider: nextProvider,
                          ai_base_url: shouldReplaceBaseUrl ? exampleBaseUrl : prev.ai_base_url
                        };
                      })
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                  >
                    <option value="ollama">Ollama</option>
                    <option value="openai_compatible">vLLM / OpenAI-kompatibel</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-sand-500">Base URL</label>
                  <input
                    value={aiConnection.ai_base_url}
                    onChange={(event) =>
                      setAiConnection((prev) => ({ ...prev, ai_base_url: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder={aiBaseUrlPlaceholder}
                  />
                  <p className="mt-1 text-[11px] text-sand-400">
                    Bei `vLLM` funktionieren URLs mit oder ohne `/v1`.
                  </p>
                </div>
                {aiConnection.ai_provider === "openai_compatible" ? (
                  <div>
                    <label className="text-xs text-sand-500">API Key</label>
                    <input
                      type="password"
                      value={aiConnection.ai_api_key}
                      onChange={(event) =>
                        setAiConnection((prev) => ({ ...prev, ai_api_key: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder={aiConnection.has_ai_api_key ? "Gespeichert" : "••••••••"}
                    />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-xs text-sand-500">
                    Ollama verwendet hier keinen API Key.
                  </div>
                )}
                <div>
                  <label className="text-xs text-sand-500">Default Modell</label>
                  <input
                    list={aiKnownModels.length ? aiModelDatalistId : undefined}
                    value={aiConnection.ai_default_model}
                    onChange={(event) =>
                      setAiConnection((prev) => ({ ...prev, ai_default_model: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="z. B. qwen3:8b oder meta-llama/Llama-3.1-8B-Instruct"
                  />
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.25em] text-sand-500">Provider-Modelle</p>
                    <p className="mt-1 text-xs text-sand-500">
                      Fragt den aktuell konfigurierten Ollama- oder vLLM-Endpoint ab und zeigt die angebotenen Modelle.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadAiProviderModels}
                    className="rounded-full border border-sand-200 bg-white px-3 py-2 text-[11px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                  >
                    Modelle abfragen
                  </button>
                </div>
                <div className="mt-3 rounded-2xl border border-sand-200 bg-white p-3">
                  <div className="flex flex-wrap gap-3 text-[11px] text-sand-500">
                    <span>Provider: {aiConnectionModelsInfo.provider || aiProviderLabel}</span>
                    <span>URL: {aiConnectionModelsInfo.baseUrl || aiConnection.ai_base_url || "n/a"}</span>
                    <span>Default: {aiConnectionModelsInfo.defaultModel || aiConnection.ai_default_model || "n/a"}</span>
                  </div>
                  {aiConnectionModelsStatus === "loading" ? (
                    <p className="mt-3 text-xs text-sand-500">Lade Modellliste…</p>
                  ) : null}
                  {aiConnectionModelsStatus === "error" ? (
                    <p className="mt-3 text-xs text-rose-600">
                      {aiConnectionModelsInfo.error || "Modellliste konnte nicht geladen werden."}
                    </p>
                  ) : null}
                  {aiConnectionModelsStatus === "ready" ? (
                    aiConnectionModels.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {aiConnectionModels.map((modelName) => (
                          <button
                            key={modelName}
                            type="button"
                            onClick={() =>
                              {
                                setAiConnection((prev) => ({
                                  ...prev,
                                  ai_default_model: modelName
                                }));
                                setAiModelDraft(modelName);
                              }
                            }
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700"
                            title="Klick setzt dieses Modell als Default."
                          >
                            {modelName}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-sand-500">Keine Modelle zurückgegeben.</p>
                    )
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-sand-500">Modellverwaltung</p>
                {aiConnection.ai_provider === "ollama" ? (
                  <>
                    <p className="mt-1 text-xs text-sand-500">
                      Direkt aus dem Settings-Panel Ollama-Modelle nachladen oder loeschen.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <input
                        list={aiKnownModels.length ? aiModelDatalistId : undefined}
                        value={aiModelDraft}
                        onChange={(event) => setAiModelDraft(event.target.value)}
                        className="rounded-2xl border border-sand-200 px-4 py-2"
                        placeholder="z. B. qwen2.5:32b-instruct-q4_K_M"
                      />
                      <button
                        type="button"
                        onClick={() => manageAiProviderModel("pull")}
                        className="rounded-full border border-emerald-200 bg-emerald-600 px-4 py-2 text-xs uppercase tracking-wide text-white hover:bg-emerald-700"
                      >
                        Modell laden
                      </button>
                      <button
                        type="button"
                        onClick={() => manageAiProviderModel("delete")}
                        className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                      >
                        Modell loeschen
                      </button>
                    </div>
                    {aiModelManageStatus === "loading" ? (
                      <p className="mt-3 text-xs text-sand-500">Ollama verarbeitet den Auftrag…</p>
                    ) : null}
                    {aiModelManageMessage ? (
                      <p
                        className={`mt-3 text-xs ${
                          aiModelManageStatus === "error" ? "text-rose-600" : "text-emerald-700"
                        }`}
                      >
                        {aiModelManageMessage}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-xs text-sand-500">
                    vLLM / OpenAI-kompatibel bietet ueber die Standard-API nur Modellabfrage. Laden oder Loeschen muss auf dem Host bzw. Deployment des Servers passieren.
                  </p>
                )}
              </div>

              <div className="mt-5 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-sand-500">Modell-Overrides</p>
                <p className="mt-1 text-xs text-sand-500">
                  Leer lassen = Default Modell verwenden. Nach `Modelle abfragen` werden die Provider-Modelle direkt als Auswahlvorschläge angeboten.
                </p>
                {aiKnownModels.length ? (
                  <datalist id={aiModelDatalistId}>
                    {aiKnownModels.map((modelName) => (
                      <option key={modelName} value={modelName} />
                    ))}
                  </datalist>
                ) : null}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-sand-500">Interne Tools</label>
                    <input
                      list={aiKnownModels.length ? aiModelDatalistId : undefined}
                      value={aiConnection.ai_internal_model}
                      onChange={(event) =>
                        setAiConnection((prev) => ({ ...prev, ai_internal_model: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Optionales Modell fuer freie interne Prompts"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Kundenbericht / Action</label>
                    <input
                      list={aiKnownModels.length ? aiModelDatalistId : undefined}
                      value={aiConnection.ai_action_model}
                      onChange={(event) =>
                        setAiConnection((prev) => ({ ...prev, ai_action_model: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Optionales Modell fuer Action-Vorschlaege"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Aufgabenentwurf</label>
                    <input
                      list={aiKnownModels.length ? aiModelDatalistId : undefined}
                      value={aiConnection.ai_task_model}
                      onChange={(event) =>
                        setAiConnection((prev) => ({ ...prev, ai_task_model: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Optionales Modell fuer Mail- zu Aufgabenentwurf"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Kundenranking</label>
                    <input
                      list={aiKnownModels.length ? aiModelDatalistId : undefined}
                      value={aiConnection.ai_customer_ranking_model}
                      onChange={(event) =>
                        setAiConnection((prev) => ({
                          ...prev,
                          ai_customer_ranking_model: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Optionales Modell fuer Kundenzuordnung"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Kundenentwicklung</label>
                    <input
                      list={aiKnownModels.length ? aiModelDatalistId : undefined}
                      value={aiConnection.ai_customer_development_model}
                      onChange={(event) =>
                        setAiConnection((prev) => ({
                          ...prev,
                          ai_customer_development_model: event.target.value
                        }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Optionales Modell fuer Entwicklung, Analyse, Leitfaden"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Angebot / Textentwurf</label>
                    <input
                      list={aiKnownModels.length ? aiModelDatalistId : undefined}
                      value={aiConnection.ai_offer_model}
                      onChange={(event) =>
                        setAiConnection((prev) => ({ ...prev, ai_offer_model: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Optionales Modell fuer Angebots- und Newslettertexte"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-sand-500">Rechnungszusammenfassung</label>
                    <input
                      list={aiKnownModels.length ? aiModelDatalistId : undefined}
                      value={aiConnection.ai_invoice_model}
                      onChange={(event) =>
                        setAiConnection((prev) => ({ ...prev, ai_invoice_model: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="Optionales Modell fuer Rechnungs- und Leistungszusammenfassung"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
                <button
                  onClick={saveAiConnectionSettings}
                  className="rounded-full border border-sand-200 bg-sand-900 px-3 py-2 uppercase tracking-wide text-white hover:opacity-90"
                >
                  KI Anbindung speichern
                </button>
                {aiConnectionLoadStatus === "error" && (
                  <span className="text-rose-600">Laden fehlgeschlagen</span>
                )}
                {aiConnectionStatus === "saved" && (
                  <span className="text-emerald-600">Gespeichert</span>
                )}
                {aiConnectionStatus === "error" && (
                  <span className="text-rose-600">Speichern fehlgeschlagen</span>
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
                  <label className="text-xs text-sand-500">Prompt auswählen</label>
                  <select
                    value={selectedAiPromptMeta?.key || ""}
                    onChange={(event) => setSelectedAiPromptKey(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-xs text-sand-800"
                  >
                    {AI_PROMPT_OPTIONS.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-sand-400">
                    {AI_PROMPT_OPTIONS.length} Prompts werden zentral über diese Liste gepflegt.
                  </p>
                </div>
                <div>
                  <label className="text-xs text-sand-500">{selectedAiPromptMeta?.label || "Prompt"}</label>
                  <textarea
                    value={selectedAiPromptValue}
                    onChange={(event) =>
                      setAiPrompts((prev) =>
                        setAiPromptValueByKey(prev, selectedAiPromptMeta?.key || "", event.target.value)
                      )
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 font-mono text-xs text-sand-800"
                    rows={18}
                    placeholder="Prompt Text"
                  />
                  <p className="mt-2 text-xs text-sand-400">
                    Platzhalter: {selectedAiPromptMeta?.placeholders || "keine"}
                  </p>
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
                  <div className="md:col-span-2">
                    <span className="text-sand-500">Getestete Endpunkte:</span>
                    {(rmmHealth.attemptedUrls || []).length ? (
                      <ul className="mt-1 space-y-1">
                        {(rmmHealth.attemptedUrls || []).slice(0, 8).map((entry, index) => (
                          <li key={`rmm-attempt-${index}`} className="rounded-lg border border-sand-200 bg-white px-2 py-1 font-mono text-[11px] text-sand-700">
                            {entry}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span> n/a</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <button
            type="button"
            onClick={() => setMetaHubOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 text-sand-700"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Meta-Hub Quellen</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-600">
              <span
                className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${getMetaHubSummaryBadgeClass(
                  metaHubRmmSummary.tone
                )}`}
              >
                {metaHubRmmSummary.label}
              </span>
              <span
                className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${getMetaHubSummaryBadgeClass(
                  metaHubEmailSummary.tone
                )}`}
              >
                {metaHubEmailSummary.label}
              </span>
              <span className="text-sm text-sand-500">{metaHubOpen ? "–" : "+"}</span>
            </div>
          </button>
          {metaHubOpen ? (
            <>
              <p className="mt-4 text-xs text-sand-500 mb-4">
                Steuerung der Meta-Hub Datenquellen für Kundenentwicklung: RMM-Mapping und mehrere E-Mail-Postfächer (IMAP).
                Meta-Hub greift auf E-Mails nur lesend zu.
              </p>
              <div className="mb-4 rounded-2xl border border-sand-200 bg-sand-50 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setMetaHubRuntimeOpen((current) => !current);
                    if (!metaHubRuntimeOpen) refreshMetaHubRuntimeStatus(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Meta-Hub Status</p>
                    <p className="text-xs text-sand-600">
                      KI-Preanalysis Läufe, Snapshot-Stand und letzte Fehler.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        metaHubRuntimeStatus.connected ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                    <span className="text-sand-600">
                      {metaHubRuntimeStatus.connected ? "verbunden" : "offline"}
                    </span>
                    <span className="text-sm text-sand-500">{metaHubRuntimeOpen ? "–" : "+"}</span>
                  </div>
                </button>
                {metaHubRuntimeOpen ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-sand-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => refreshMetaHubRuntimeStatus(false)}
                        className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                      >
                        Status aktualisieren
                      </button>
                      <button
                        type="button"
                        onClick={() => refreshMetaHubRuntimeStatus(true)}
                        className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                      >
                        Refresh triggern
                      </button>
                      {metaHubRuntimeStatus.status === "loading" ? (
                        <span className="text-sand-500">Lade…</span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-sand-700 md:grid-cols-2">
                      <div>
                        <span className="text-sand-500">Letzte Prüfung:</span>{" "}
                        {formatTimestampOrNa(metaHubRuntimeStatus.checked_at)}
                      </div>
                      <div>
                        <span className="text-sand-500">Intervall:</span>{" "}
                        {Number(metaHubRuntimeStatus.health?.refresh_interval_seconds || 0) > 0
                          ? `${Number(metaHubRuntimeStatus.health?.refresh_interval_seconds || 0)} s`
                          : "n/a"}
                      </div>
                      <div>
                        <span className="text-sand-500">Snapshot Lauf:</span>{" "}
                        {formatTimestampOrNa(metaHubRuntimeStatus.health?.last_refresh_at)}
                      </div>
                      <div>
                        <span className="text-sand-500">Snapshot Dauer:</span>{" "}
                        {formatDurationMs(metaHubRuntimeStatus.health?.last_duration_ms)}
                      </div>
                      <div>
                        <span className="text-sand-500">KI Lauf:</span>{" "}
                        {formatTimestampOrNa(metaHubRuntimeStatus.health?.ai_preanalysis_last_refresh_at)}
                      </div>
                      <div>
                        <span className="text-sand-500">KI Dauer:</span>{" "}
                        {formatDurationMs(metaHubRuntimeStatus.health?.ai_preanalysis_last_duration_ms)}
                      </div>
                      <div>
                        <span className="text-sand-500">KI aktiv:</span>{" "}
                        {metaHubRuntimeStatus.health?.ai_preanalysis_enabled ? "ja" : "nein"}
                      </div>
                      <div>
                        <span className="text-sand-500">KI läuft gerade:</span>{" "}
                        {metaHubRuntimeStatus.health?.ai_preanalysis_refreshing ? "ja" : "nein"}
                      </div>
                      <div>
                        <span className="text-sand-500">KI Ergebnisse im Snapshot:</span>{" "}
                        {Number(metaHubRuntimeStatus.snapshot?.ai_preanalysis_entries || 0)}
                      </div>
                      <div>
                        <span className="text-sand-500">Letzte KI-Snapshot Aktualisierung:</span>{" "}
                        {formatTimestampOrNa(metaHubRuntimeStatus.snapshot?.ai_preanalysis_generated_at)}
                      </div>
                      <div>
                        <span className="text-sand-500">E-Mail Sync:</span>{" "}
                        {metaHubRuntimeStatus.health?.email_sync_enabled ? "ja" : "nein"}
                      </div>
                      <div>
                        <span className="text-sand-500">E-Mail Zugriff:</span>{" "}
                        {metaHubRuntimeStatus.snapshot?.email_access_mode || "read_only"}
                      </div>
                      <div>
                        <span className="text-sand-500">Mailboxen verbunden:</span>{" "}
                        {Number(metaHubRuntimeStatus.health?.email_connected_mailboxes || 0)}
                      </div>
                      <div>
                        <span className="text-sand-500">Geladene Mails:</span>{" "}
                        {Number(metaHubRuntimeStatus.health?.email_message_count || 0)}
                      </div>
                      <div>
                        <span className="text-sand-500">Kunden zugeordnet:</span>{" "}
                        {Number(metaHubRuntimeStatus.health?.email_matched_message_count || 0)}
                      </div>
                      <div>
                        <span className="text-sand-500">E-Mail Lauf:</span>{" "}
                        {formatTimestampOrNa(metaHubRuntimeStatus.health?.email_last_refresh_at)}
                      </div>
                      <div>
                        <span className="text-sand-500">E-Mail Dauer:</span>{" "}
                        {formatDurationMs(metaHubRuntimeStatus.health?.email_last_duration_ms)}
                      </div>
                      <div>
                        <span className="text-sand-500">E-Mail Snapshot:</span>{" "}
                        {formatTimestampOrNa(metaHubRuntimeStatus.snapshot?.email_sync_generated_at)}
                      </div>
                    </div>
                    <div className="text-xs text-sand-600">
                      <span className="text-sand-500">KI Modi:</span>{" "}
                      {(metaHubRuntimeStatus.health?.ai_preanalysis_modes || []).length
                        ? metaHubRuntimeStatus.health.ai_preanalysis_modes.join(", ")
                        : "n/a"}
                    </div>
                    {(metaHubRuntimeStatus.health?.last_error || metaHubRuntimeStatus.health?.email_last_error || metaHubRuntimeStatus.health?.ai_preanalysis_last_error || metaHubRuntimeStatus.error) ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        <div>
                          <span className="font-semibold">Fehler Snapshot:</span>{" "}
                          {metaHubRuntimeStatus.health?.last_error || "n/a"}
                        </div>
                        <div>
                          <span className="font-semibold">Fehler E-Mail:</span>{" "}
                          {metaHubRuntimeStatus.health?.email_last_error || "n/a"}
                        </div>
                        <div>
                          <span className="font-semibold">Fehler KI:</span>{" "}
                          {metaHubRuntimeStatus.health?.ai_preanalysis_last_error || "n/a"}
                        </div>
                        <div>
                          <span className="font-semibold">Statusfehler:</span>{" "}
                          {metaHubRuntimeStatus.error || "n/a"}
                        </div>
                      </div>
                    ) : null}
                    {(metaHubRuntimeStatus.snapshot?.email_errors || []).length ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <div className="font-semibold">Mailbox Fehler</div>
                        <div>{metaHubRuntimeStatus.snapshot.email_errors.join(" | ")}</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-700">
                  <input
                    type="checkbox"
                    checked={Boolean(metaHub.rmm_enabled)}
                    onChange={(event) =>
                      setMetaHub((prev) => ({ ...prev, rmm_enabled: event.target.checked }))
                    }
                  />
                  RMM Quelle im Meta-Hub aktivieren
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-700">
                  <input
                    type="checkbox"
                    checked={Boolean(metaHub.email_enabled)}
                    onChange={(event) =>
                      setMetaHub((prev) => ({ ...prev, email_enabled: event.target.checked }))
                    }
                  />
                  E-Mail Quelle im Meta-Hub aktivieren
                </label>
                <div>
                  <label className="text-xs text-sand-500">RMM Kundennummer-Feldname</label>
                  <input
                    value={metaHub.rmm_customer_field_name}
                    onChange={(event) =>
                      setMetaHub((prev) => ({ ...prev, rmm_customer_field_name: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="Kundennummer"
                  />
                </div>
                <div>
                  <label className="text-xs text-sand-500">Refresh Intervall (Sekunden)</label>
                  <input
                    type="number"
                    min="30"
                    value={metaHub.refresh_seconds}
                    onChange={(event) =>
                      setMetaHub((prev) => ({ ...prev, refresh_seconds: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                    placeholder="300"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-sand-500">E-Mail Postfächer</p>
                  <button
                    type="button"
                    onClick={addMetaHubMailbox}
                    className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                  >
                    <Plus size={12} />
                    Postfach
                  </button>
                </div>
                <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  Zugriff ist fest auf Nur-Lesen gesetzt. Meta-Hub soll keine Nachrichten markieren,
                  verschieben oder loeschen.
                </div>
                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {(metaHub.mailboxes || []).map((mailbox) => {
                    const mailboxTest = metaHubMailboxTests[mailbox.id] || null;
                    return (
                      <div key={mailbox.id} className="rounded-xl border border-sand-200 bg-white p-3">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-sand-500">Zugriffsmodus</p>
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-800">
                            Nur Lesen
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          <div>
                            <label className="text-[11px] text-sand-500">Name</label>
                            <input
                              value={mailbox.name || ""}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { name: event.target.value })}
                              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
                              placeholder="Support Postfach"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-sand-500">E-Mail</label>
                            <input
                              value={mailbox.email || ""}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { email: event.target.value })}
                              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
                              placeholder="support@example.com"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-sand-500">Host</label>
                            <input
                              value={mailbox.host || ""}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { host: event.target.value })}
                              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
                              placeholder="imap.example.com"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-sand-500">Port</label>
                            <input
                              type="number"
                              min="1"
                              max="65535"
                              value={mailbox.port || 993}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { port: event.target.value })}
                              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-sand-500">Benutzername</label>
                            <input
                              value={mailbox.username || ""}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { username: event.target.value })}
                              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
                              placeholder="imap-user"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-sand-500">Passwort</label>
                            <input
                              type="password"
                              value={mailbox.password || ""}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { password: event.target.value })}
                              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
                              placeholder={mailbox.has_password ? "Gespeichert" : "••••••••"}
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-sand-500">Ordner</label>
                            <input
                              value={mailbox.folder || "INBOX"}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { folder: event.target.value })}
                              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-1.5 text-xs"
                              placeholder="INBOX"
                            />
                          </div>
                          <label className="flex items-center gap-2 pt-5 text-xs text-sand-700">
                            <input
                              type="checkbox"
                              checked={Boolean(mailbox.enabled)}
                              onChange={(event) => updateMetaHubMailbox(mailbox.id, { enabled: event.target.checked })}
                            />
                            Aktiv
                          </label>
                          <div className="flex items-center gap-3 pt-5 text-xs text-sand-700">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(mailbox.use_tls)}
                                onChange={(event) => updateMetaHubMailbox(mailbox.id, { use_tls: event.target.checked })}
                              />
                              TLS
                            </label>
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={Boolean(mailbox.use_ssl)}
                                onChange={(event) => updateMetaHubMailbox(mailbox.id, { use_ssl: event.target.checked })}
                              />
                              SSL
                            </label>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-sand-500">
                            {mailboxTest?.status === "loading" ? "Teste Verbindung..." : null}
                            {mailboxTest?.status === "ready" ? (
                              <span className="text-emerald-700">
                                {mailboxTest.message} ({formatTimestampOrNa(mailboxTest.checkedAt)})
                              </span>
                            ) : null}
                            {mailboxTest?.status === "error" ? (
                              <span className="text-rose-700">
                                {mailboxTest.message} ({formatTimestampOrNa(mailboxTest.checkedAt)})
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => testMetaHubMailbox(mailbox)}
                              disabled={mailboxTest?.status === "loading"}
                              className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:opacity-50"
                            >
                              {mailboxTest?.status === "loading" ? "Teste..." : "Postfach testen"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMetaHubMailbox(mailbox.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                            >
                              <Trash2 size={11} />
                              Entfernen
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!metaHub.mailboxes?.length ? (
                    <p className="rounded-xl border border-dashed border-sand-300 bg-white px-3 py-2 text-xs text-sand-500">
                      Noch keine Postfächer konfiguriert.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveMetaHubSettings}
                  className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  Meta-Hub speichern
                </button>
                {metaHubStatus === "saved" ? (
                  <span className="text-sm text-emerald-600">Gespeichert</span>
                ) : null}
                {metaHubStatus === "error" ? (
                  <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
                ) : null}
                {metaHubStatus === "saving" ? (
                  <span className="text-sm text-sand-500">Speichere…</span>
                ) : null}
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
                    <label className="text-xs text-sand-500">Zentraler Stundenpreis EUR</label>
                    <input
                      value={sevdesk.sevdesk_hourly_rate_eur}
                      onChange={(event) =>
                        setSevdesk((prev) => ({ ...prev, sevdesk_hourly_rate_eur: event.target.value }))
                      }
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                      placeholder="120"
                    />
                    <p className="mt-1 text-[11px] text-sand-400">
                      Wird einheitlich für Statistik, Aufgabenwert und sevDesk-Vorschläge verwendet.
                    </p>
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
              <div className="mb-3 rounded-2xl border border-sand-200 bg-sand-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={runDatabaseMaintenance}
                    disabled={dbMaintenanceStatus === "running"}
                    className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {dbMaintenanceStatus === "running" ? "Pflege läuft..." : "Datenbankpflege (ohne Datenverlust)"}
                  </button>
                  <span className="text-xs text-sand-500">
                    Führt VACUUM/ANALYZE aus, ohne Datensätze zu löschen.
                  </span>
                </div>
                {dbMaintenanceInfo ? (
                  <div
                    className={`mt-2 text-xs ${
                      dbMaintenanceStatus === "error" ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {dbMaintenanceInfo}
                  </div>
                ) : null}
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
                {debugStatus === "cleared" && (debugMessage || "Tabelle geleert.")}
                {debugStatus === "error" && (debugMessage || "Leeren fehlgeschlagen.")}
              </div>
            </>
          ) : null}
        </div>
      </main>
      {contractTemplateCreateOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-sand-900/50 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Vertrags-Templates</p>
                <h3 className="text-base font-display text-sand-900">Neues Template anlegen</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setContractTemplateDraft({ key: "", title: "", description: "", doc_type: "wartung" });
                  setContractTemplateCreateOpen(false);
                }}
                className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
              >
                Schließen
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_180px]">
                <input
                  value={contractTemplateDraft.key}
                  onChange={(event) =>
                    setContractTemplateDraft((prev) => ({ ...prev, key: event.target.value }))
                  }
                  placeholder="template_key"
                  className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
                />
                <input
                  value={contractTemplateDraft.title}
                  onChange={(event) =>
                    setContractTemplateDraft((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Titel"
                  className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
                />
                <select
                  value={contractTemplateDraft.doc_type}
                  onChange={(event) =>
                    setContractTemplateDraft((prev) => ({ ...prev, doc_type: event.target.value }))
                  }
                  className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
                >
                  {contractTemplateDocTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={contractTemplateDraft.description}
                onChange={(event) =>
                  setContractTemplateDraft((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Kurzbeschreibung fuer Picker"
                className="w-full rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setContractTemplateDraft({ key: "", title: "", description: "", doc_type: "wartung" });
                    setContractTemplateCreateOpen(false);
                  }}
                  className="rounded-full border border-sand-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={addContractTemplate}
                  className="rounded-full border border-sand-200 bg-sand-900 px-3 py-2 text-[10px] uppercase tracking-wide text-white hover:opacity-90"
                >
                  Template anlegen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {contractTemplatePreviewOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-sand-900/50 px-4 py-6">
          <div className="h-[85vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Vertrags-Templates</p>
                <h3 className="text-base font-display text-sand-900">HTML Vorschau</h3>
              </div>
              <button
                type="button"
                onClick={() => setContractTemplatePreviewOpen(false)}
                className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
              >
                Schließen
              </button>
            </div>
            <iframe
              title="Vertrag Template Vorschau"
              className="h-[calc(85vh-58px)] w-full bg-white"
              srcDoc={contractTemplatePreviewHtml}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
