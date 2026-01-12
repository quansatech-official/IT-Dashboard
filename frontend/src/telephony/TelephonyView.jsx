import { useEffect, useMemo, useState } from "react";
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

  const hasStats = useMemo(() => stats.byHour && stats.byHour.length > 0, [stats.byHour]);

  useEffect(() => {
    let active = true;
    telephonyService.fetchSettings().then((data) => {
      if (!active) return;
      setSettings({ ...defaultSettings, ...data, password: "" });
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "monitoring") return;
    let active = true;

    const load = async () => {
      const [nextCalls, nextStats, isHealthy] = await Promise.all([
        telephonyService.fetchCalls(),
        telephonyService.fetchStats(),
        telephonyService.fetchHealth()
      ]);
      if (!active) return;
      setCalls(nextCalls);
      setStats(nextStats);
      setApiStatus(isHealthy ? "connected" : "error");
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-hero-pattern">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">NFON CTI</p>
          <h1 className="text-3xl font-display text-sand-900">Telefonie Monitoring</h1>
          <p className="text-sand-600 max-w-2xl">
            Live-Status fuer eingehende und ausgehende Anrufe inklusive KPI-Widgets und
            CRM-Mapping.
          </p>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CallStatsView stats={stats} />
              <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft">
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Setup</p>
                <h2 className="text-xl font-display mb-2">Integration</h2>
                <p className="text-sm text-sand-600">
                  Der Stream nutzt die gespeicherten API-Zugangsdaten. Aktiviere den
                  Live-Stream im Settings-Tab oder setze
                  <span className="font-semibold"> TELEPHONY_STREAM_ENABLED</span> als Fallback.
                </p>
                {!hasStats && (
                  <p className="mt-4 text-xs text-sand-500">
                    Noch keine Statistikdaten verfuegbar. Pruefe die API-Konfiguration.
                  </p>
                )}
                <div className="mt-4 flex items-center justify-end gap-2 text-xs">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      apiStatus === "connected" ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                  />
                  <span className="text-sand-500">
                    API-Verbindung {apiStatus === "connected" ? "aktiv" : "getrennt"}
                  </span>
                </div>
              </div>
            </div>
            <CallListView calls={calls} />
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
                  } else {
                    setSettingsStatus("error");
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
          </div>
        )}
      </div>
    </div>
  );
}
