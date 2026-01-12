import { useEffect, useState } from "react";

export default function RmmDashboardView() {
  const [dashboardUrl, setDashboardUrl] = useState(
    "https://rmm.quansatech.at/dash/goto/cf9zhbtsk0ohsf?orgId=1"
  );

  useEffect(() => {
    let active = true;
    const loadIntegrations = async () => {
      try {
        const response = await fetch("/api/integrations");
        if (!response.ok) return;
        const data = await response.json();
        if (!active || !data?.rmm_host) return;
        setDashboardUrl(data.rmm_host);
      } catch {
        // Keep fallback URL when integrations are unavailable.
      }
    };
    loadIntegrations();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900 px-6 py-6">
      <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl shadow-soft overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-sand-200">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">RMM</p>
            <h2 className="text-lg font-display">Grafana Dashboard</h2>
          </div>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
          >
            In neuem Tab öffnen
          </a>
        </div>
        <div className="h-[calc(100vh-200px)]">
          <iframe
            title="Grafana RMM Dashboard"
            src={dashboardUrl}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
