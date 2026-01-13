import { useEffect, useState } from "react";
import CallListView from "./CallListView";
import CallStatsView from "./CallStatsView";
import { telephonyService } from "./telephonyService";

const defaultSettings = {
  baseUrl: "https://providersupportdata.cloud-cfg.com",
  username: "",
  password: "",
  streamEnabled: false,
  hasPassword: false,
  hasRefreshToken: false
};

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
  const [settingsStatus, setSettingsStatus] = useState("idle");
  const [apiStatus, setApiStatus] = useState("idle");
  const [extensions, setExtensions] = useState([]);
  const [debugInfo, setDebugInfo] = useState({
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
  const hasPasswordAuth = settings.hasPassword && settings.username?.trim();
  const hasRefreshAuth = settings.hasRefreshToken;
  const hasCredentials = Boolean(hasPasswordAuth || hasRefreshAuth);

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
      setDebugInfo((current) => ({
        ...current,
        lastSettingsFetchAt: new Date().toISOString(),
        lastSettingsResponse: {
          baseUrl: data?.baseUrl ?? "",
          username: data?.username ?? "",
          hasPassword: Boolean(data?.hasPassword),
          hasRefreshToken: Boolean(data?.hasRefreshToken),
          streamEnabled: Boolean(data?.streamEnabled)
        }
      }));
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
    if (activeTab !== "monitoring") return;
    let active = true;

    const load = async () => {
      const [nextCalls, nextStats, isHealthy, latestCalls] = await Promise.all([
        telephonyService.fetchCalls(50),
        telephonyService.fetchStats(),
        telephonyService.fetchHealth(),
        telephonyService.fetchLatestCallDebug()
      ]);
      if (!active) return;
      setCalls(nextCalls);
      setStats(nextStats);
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
      setDebugInfo((current) => ({
        ...current,
        lastHealthCheckAt: new Date().toISOString(),
        lastHealthCheckOk: isHealthy,
        lastCallsCount: Array.isArray(nextCalls) ? nextCalls.length : null,
        lastStatsTotals: nextStats
          ? {
              today: nextStats.today?.total ?? null,
              last24h: nextStats.last24h?.total ?? null,
              last7d: nextStats.last7d?.total ?? null
            }
          : null,
        lastCallRawKeys: latestRawKeys,
        lastCallRawPreview: latestRawPreview,
        lastCallRawLength: latestRawLength,
        lastCallSnapshot: latestCallSnapshot
      }));
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
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">NFON CTI</p>
            <h1 className="text-3xl font-display text-sand-900">Telefonie Monitoring</h1>
            <p className="text-sand-600 max-w-2xl">
              Live-Status fuer eingehende und ausgehende Anrufe inklusive KPI-Widgets und
              CRM-Mapping.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-sand-600">
            <span
              className={`h-2 w-2 rounded-full ${
                apiStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
            <span>
              API{" "}
              {apiStatus === "connected"
                ? "aktiv"
                : apiStatus === "missing"
                ? "Zugangsdaten fehlen"
                : "getrennt"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("monitoring")}
            className={`px-4 py-2 rounded-full text-sm border ${
              activeTab === "monitoring"
                ? "bg-sand-900 text-white border-sand-900"
                : "bg-white border-sand-200 text-sand-700 hover:bg-sand-100"
            }`}
          >
            Monitoring
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-full text-sm border ${
              activeTab === "settings"
                ? "bg-sand-900 text-white border-sand-900"
                : "bg-white border-sand-200 text-sand-700 hover:bg-sand-100"
            }`}
          >
            Einstellungen
          </button>
        </div>

        {activeTab === "monitoring" ? (
          <>
            <CallStatsView stats={stats} />
            <CallListView
              calls={calls}
              extensions={extensions}
              onCallback={(extension, number) =>
                telephonyService.clickToDial({ extension, number })
              }
            />
          </>
        ) : (
          <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft">
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Settings</p>
            <h2 className="text-xl font-display mb-4">NFON CTI Konfiguration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-sand-500">Base URL</label>
                <input
                  value={settings.baseUrl}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, baseUrl: event.target.value }))
                  }
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                  placeholder="https://providersupportdata.cloud-cfg.com"
                />
              </div>
              <div>
                <label className="text-xs text-sand-500">Benutzername</label>
                <input
                  value={settings.username}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, username: event.target.value }))
                  }
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                  placeholder="cti-user"
                />
              </div>
              <div>
                <label className="text-xs text-sand-500">Passwort</label>
                <input
                  type="password"
                  value={settings.password}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, password: event.target.value }))
                  }
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                  placeholder={settings.hasPassword ? "Gespeichert" : "••••••••"}
                />
              </div>
              <div className="flex items-center gap-3 mt-4">
                <input
                  id="telephony-stream"
                  type="checkbox"
                  checked={settings.streamEnabled}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      streamEnabled: event.target.checked
                    }))
                  }
                />
                <label htmlFor="telephony-stream" className="text-sm text-sand-700">
                  Live-Stream aktivieren
                </label>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={async () => {
                  setSettingsStatus("saving");
                  const payload = {
                    baseUrl: settings.baseUrl,
                    username: settings.username,
                    password: settings.password,
                    streamEnabled: settings.streamEnabled
                  };
                  const result = await telephonyService.updateSettings(payload);
                  if (result) {
                    setSettings({ ...defaultSettings, ...result, password: "" });
                    setSettingsStatus("saved");
                    setDebugInfo((current) => ({
                      ...current,
                      lastSettingsSaveAt: new Date().toISOString(),
                      lastSettingsSaveOk: true
                    }));
                  } else {
                    setSettingsStatus("error");
                    setDebugInfo((current) => ({
                      ...current,
                      lastSettingsSaveAt: new Date().toISOString(),
                      lastSettingsSaveOk: false
                    }));
                  }
                  setTimeout(() => setSettingsStatus("idle"), 2000);
                }}
                className="px-4 py-2 rounded-full text-sm border bg-sand-900 text-white border-sand-900"
              >
                Speichern
              </button>
              {settingsStatus === "saved" && (
                <span className="text-sm text-emerald-600">Gespeichert</span>
              )}
              {settingsStatus === "error" && (
                <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
              )}
              <span className="text-xs text-sand-500">
                Passwort/Refresh Token leer lassen, um das bestehende zu behalten.
              </span>
              {settings.hasRefreshToken && (
                <span className="text-xs text-sand-500">
                  Refresh Token wird automatisch vom API hinterlegt.
                </span>
              )}
            </div>
            <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50 p-4 text-xs text-sand-700">
              <p className="uppercase tracking-[0.3em] text-[10px] text-sand-500">Debug</p>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <span className="text-sand-500">Aktiver Tab:</span> {activeTab}
                </div>
                <div>
                  <span className="text-sand-500">Base URL:</span> {settings.baseUrl || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Username gesetzt:</span>{" "}
                  {settings.username?.trim() ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Passwort eingegeben:</span>{" "}
                  {settings.password ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Password-Auth aktiv:</span>{" "}
                  {settings.hasPassword ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Refresh Token vorhanden:</span>{" "}
                  {settings.hasRefreshToken ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Credentials erkannt:</span>{" "}
                  {hasCredentials ? "ja" : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">API Status:</span> {apiStatus}
                </div>
                <div>
                  <span className="text-sand-500">Health Check:</span>{" "}
                  {debugInfo.lastHealthCheckOk === null
                    ? "unbekannt"
                    : debugInfo.lastHealthCheckOk
                    ? "ok"
                    : "fehlgeschlagen"}
                </div>
                <div>
                  <span className="text-sand-500">Letzter Health Check:</span>{" "}
                  {debugInfo.lastHealthCheckAt || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Letzte Settings-Abfrage:</span>{" "}
                  {debugInfo.lastSettingsFetchAt || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Letztes Settings-Update:</span>{" "}
                  {debugInfo.lastSettingsSaveAt || "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Letztes Settings-Update OK:</span>{" "}
                  {debugInfo.lastSettingsSaveOk === null
                    ? "unbekannt"
                    : debugInfo.lastSettingsSaveOk
                    ? "ja"
                    : "nein"}
                </div>
                <div>
                  <span className="text-sand-500">Letzte Call-Anzahl:</span>{" "}
                  {debugInfo.lastCallsCount ?? "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Stats Totals:</span>{" "}
                  {debugInfo.lastStatsTotals
                    ? `today ${debugInfo.lastStatsTotals.today}, 24h ${debugInfo.lastStatsTotals.last24h}, 7d ${debugInfo.lastStatsTotals.last7d}`
                    : "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Stream aktiv:</span>{" "}
                  {settings.streamEnabled ? "ja" : "nein"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Settings Response (sanitized):</span>{" "}
                  {debugInfo.lastSettingsResponse
                    ? JSON.stringify(debugInfo.lastSettingsResponse)
                    : "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Letzte Event-Keys:</span>{" "}
                  {debugInfo.lastCallRawKeys?.length
                    ? debugInfo.lastCallRawKeys.join(", ")
                    : "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Letzter Call (DB Snapshot):</span>{" "}
                  {debugInfo.lastCallSnapshot
                    ? JSON.stringify(debugInfo.lastCallSnapshot)
                    : "n/a"}
                </div>
                <div>
                  <span className="text-sand-500">Raw Payload Laenge:</span>{" "}
                  {debugInfo.lastCallRawLength ?? "n/a"}
                </div>
                <div className="md:col-span-2">
                  <span className="text-sand-500">Letztes Event (Preview):</span>{" "}
                  {debugInfo.lastCallRawPreview || "n/a"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
