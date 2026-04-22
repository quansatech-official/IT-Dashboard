import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
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
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

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
            onClick={() => setActiveTab("maintenance")}
            className={`px-4 py-2 rounded-full text-sm border ${
              activeTab === "maintenance"
                ? "bg-sand-900 text-white border-sand-900"
                : "bg-white border-sand-200 text-sand-700 hover:bg-sand-100"
            }`}
          >
            Anlagenwartung
          </button>
        </div>

        {activeTab === "monitoring" ? (
          <>
            <CallStatsView
              stats={stats}
              calls={calls}
              customers={customers}
              pbxEntries={pbxEntries}
            />
            <CallListView
              calls={calls}
              extensions={extensions}
              customers={customers}
              pbxEntries={pbxEntries}
              pbxApiActive={pbxApiActive}
              onResolve={(number) => telephonyService.reverseLookup(number)}
              onCallback={(extension, number) =>
                telephonyService.clickToDial({ extension, number })
              }
              onResolveCallback={handleResolveCallback}
              onAssignNumber={handleAssignNumber}
              onAddToPbx={handleAddToPbx}
            />
          </>
        ) : (
          <TelephonyMaintenanceView />
        )}
      </div>
    </div>
  );
}
