const API_ENDPOINT = "/api/telemetry/events";
const SLOW_THRESHOLD_MS = 800;
const FLUSH_INTERVAL_MS = 10000;
const MAX_BATCH_SIZE = 50;

let installed = false;
let buildTag = "";
let queue = [];
let flushTimer = null;
let originalFetch = null;

const now = () => Date.now();

const getSessionId = () => {
  if (typeof window === "undefined") return "";
  const key = "qt_telemetry_session_id";
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `session_${now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return "";
  }
};

export const detectTelemetryDeviceClass = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";
  const ua = String(navigator.userAgent || "").toLowerCase();
  const width = Number(window.innerWidth || window.screen?.width || 0);
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  const isIpadOs = ua.includes("macintosh") && maxTouchPoints > 1;
  const isTabletUa = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua);
  const isMobileUa = /(iphone|ipod|android.*mobile|windows phone|blackberry|bb10|mobile)/i.test(ua);
  if (isTabletUa || isIpadOs || (maxTouchPoints > 1 && width >= 768 && width <= 1366)) return "tablet";
  if (isMobileUa || (width > 0 && width < 768)) return "mobile";
  return "desktop";
};

const sanitizeRoute = (input) => {
  try {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url) return "";
    const parsed = new URL(url, window.location.origin);
    if (!parsed.pathname.startsWith("/api/")) return "";
    return parsed.pathname;
  } catch {
    return "";
  }
};

const moduleFromRoute = (route) => {
  if (!route) return "";
  if (route.includes("day_tasks") || route.includes("day_task_groups")) return "dayplan";
  if (route.includes("project_folders")) return "projectfolders";
  if (route.includes("offer")) return "offers";
  if (route.includes("newsletter")) return "tools";
  if (route.includes("purchasing") || route.includes("marketplace")) return "purchasing";
  if (route.includes("report")) return "report";
  if (route.includes("telephony") || route.includes("pbx") || route.includes("nfon")) return "telephony";
  if (route.includes("customer")) return "customers";
  if (route.includes("vision_board") || route.includes("pinboard")) return "visionboard";
  if (route.includes("knowledge")) return "knowledge";
  if (route.includes("integrations") || route.includes("mail_") || route.includes("debug")) return "settings";
  if (route.includes("stats")) return "stats";
  return "";
};

const sendEvents = (events, keepalive = false) => {
  if (!events.length || typeof window === "undefined") return;
  const body = JSON.stringify({ events });
  if (keepalive && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(API_ENDPOINT, blob)) return;
    } catch {
      // Fall through to fetch.
    }
  }
  const fetchImpl = originalFetch || window.fetch?.bind(window);
  if (!fetchImpl) return;
  fetchImpl(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive
  }).catch(() => {});
};

export const flushTelemetry = (keepalive = false) => {
  if (!queue.length) return;
  const batch = queue.splice(0, MAX_BATCH_SIZE);
  sendEvents(batch, keepalive);
};

export const trackTelemetry = (event) => {
  if (typeof window === "undefined") return;
  const eventType = String(event?.event_type || "").trim();
  if (!eventType) return;
  queue.push({
    event_type: eventType,
    module: String(event?.module || "").slice(0, 80),
    component: String(event?.component || "").slice(0, 120),
    action: String(event?.action || "").slice(0, 120),
    route: String(event?.route || "").slice(0, 220),
    method: String(event?.method || "").slice(0, 12),
    status_code: Number(event?.status_code || 0),
    duration_ms: Math.max(0, Math.round(Number(event?.duration_ms || 0))),
    success: event?.success !== false,
    session_id: getSessionId(),
    device_class: detectTelemetryDeviceClass(),
    build_tag: buildTag,
    created_at: now(),
    meta: event?.meta && typeof event.meta === "object" ? event.meta : {}
  });
  if (queue.length >= MAX_BATCH_SIZE) flushTelemetry(false);
};

const installFetchTelemetry = () => {
  if (typeof window === "undefined" || !window.fetch || originalFetch) return;
  originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const route = sanitizeRoute(input);
    const method = String(init?.method || input?.method || "GET").toUpperCase();
    const shouldTrack = route && !route.startsWith("/api/telemetry/");
    const startedAt = performance.now();
    try {
      const response = await originalFetch(input, init);
      if (shouldTrack) {
        const durationMs = Math.round(performance.now() - startedAt);
        trackTelemetry({
          event_type: "api",
          module: moduleFromRoute(route),
          component: "fetch",
          action: "request",
          route,
          method,
          status_code: response.status,
          duration_ms: durationMs,
          success: response.ok,
          meta: durationMs >= SLOW_THRESHOLD_MS ? { slow: true } : {}
        });
      }
      return response;
    } catch (error) {
      if (shouldTrack) {
        trackTelemetry({
          event_type: "api",
          module: moduleFromRoute(route),
          component: "fetch",
          action: "request",
          route,
          method,
          duration_ms: Math.round(performance.now() - startedAt),
          success: false,
          meta: { network_error: true }
        });
      }
      throw error;
    }
  };
};

export const installTelemetry = (options = {}) => {
  if (installed || typeof window === "undefined") return;
  installed = true;
  buildTag = String(options.buildTag || "");
  installFetchTelemetry();
  flushTimer = window.setInterval(() => flushTelemetry(false), FLUSH_INTERVAL_MS);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTelemetry(true);
  });
  window.addEventListener("pagehide", () => flushTelemetry(true));
  trackTelemetry({
    event_type: "action",
    module: "app",
    component: "App",
    action: "session_start",
    meta: { path: window.location.pathname }
  });
};
