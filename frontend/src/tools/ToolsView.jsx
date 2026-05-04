import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, FileSpreadsheet, KeyRound, MonitorDown, Search, ShieldCheck, Wrench } from "lucide-react";
import CustomerExportPanel from "./CustomerExportPanel";
import RemoteDeployPanel from "./RemoteDeployPanel";
import RmmAuditsPanel from "./RmmAuditsPanel";

const ACTIVE_TOOL_STORAGE_KEY = "qt_tools_active_tool";
const VALID_TOOL_IDS = new Set(["home", "remote-deploy", "exports", "rmm-audits", "yopass"]);
const YOPASS_URL = "https://share.quansatech.at";
const YOPASS_IFRAME_URL = "/tools/yopass/";

const TOOL_GROUPS = [
  {
    title: "Schnellzugriff",
    description: "Häufige operative Aufgaben mit Kundenbezug.",
    items: ["remote-deploy", "exports"]
  },
  {
    title: "Betrieb & Sicherheit",
    description: "Prüfen, teilen und nachhalten.",
    items: ["rmm-audits", "yopass"]
  }
];

const TOOL_CARDS = [
  {
    id: "remote-deploy",
    label: "Fernwartungslink-Generator",
    eyebrow: "Deployment",
    description: "Kurze öffentliche Download-Links für TeamViewer Host und optionale RMM-Installation erzeugen.",
    icon: MonitorDown,
    action: "Link erstellen",
    status: "Neu"
  },
  {
    id: "exports",
    label: "Export",
    eyebrow: "Daten",
    description: "Kundenlisten für Excel mit Status-, Newsletter-, Kontakt- und Vertragsfiltern exportieren.",
    icon: FileSpreadsheet,
    action: "Export öffnen",
    status: "Bereit"
  },
  {
    id: "rmm-audits",
    label: "RMM Audits",
    eyebrow: "Prüfung",
    description: "Audit-Notes aus TacticalRMM importieren, validieren und als filterbare AuditRecords anzeigen.",
    icon: ShieldCheck,
    action: "Audits öffnen",
    status: "Bereit"
  },
  {
    id: "yopass",
    label: "YoPass",
    eyebrow: "Geheimnisse",
    description: "Sichere Einmal-Links für Kennwörter und andere kurze Geheimnisse öffnen.",
    icon: KeyRound,
    action: "YoPass öffnen",
    status: "Extern"
  }
];

const TOOL_BY_ID = Object.fromEntries(TOOL_CARDS.map((tool) => [tool.id, tool]));

const ToolHeader = ({ activeTool, setActiveTool, actions = null }) => {
  const activeMeta = TOOL_BY_ID[activeTool] || null;
  const Icon = activeMeta?.icon || Wrench;
  const title = activeMeta?.label || "Tools";
  return (
    <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-200)] bg-[var(--nav-active-bg)] text-[var(--nav-accent)]">
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
            <h1 className="truncate text-xl font-display text-sand-900">{title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {activeTool !== "home" ? (
            <button
              type="button"
              onClick={() => setActiveTool("home")}
              className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-medium text-sand-700 hover:bg-sand-50"
            >
              <ArrowLeft size={14} />
              Übersicht
            </button>
          ) : (
            <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
              {TOOL_CARDS.length} Werkzeuge
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-sand-100 bg-white/70">
        <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-6 py-2">
          <button
            type="button"
            onClick={() => setActiveTool("home")}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium ${
              activeTool === "home" ? "bg-sand-900 text-white" : "text-sand-600 hover:bg-sand-100"
            }`}
          >
            Übersicht
          </button>
          {TOOL_CARDS.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ${
                  activeTool === tool.id ? "bg-sand-900 text-white" : "text-sand-600 hover:bg-sand-100"
                }`}
              >
                <ToolIcon size={13} />
                {tool.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

const ToolPanelShell = ({ activeTool, setActiveTool, children, actions = null }) => (
  <div className="min-h-screen bg-sand-50">
    <ToolHeader activeTool={activeTool} setActiveTool={setActiveTool} actions={actions} />
    <main className="mx-auto max-w-[1440px] px-6 py-5">{children}</main>
  </div>
);

export default function ToolsView() {
  const [activeTool, setActiveTool] = useState(() => {
    if (typeof window === "undefined") return "home";
    const stored = window.localStorage.getItem(ACTIVE_TOOL_STORAGE_KEY);
    return VALID_TOOL_IDS.has(stored) ? stored : "home";
  });
  const [toolQuery, setToolQuery] = useState("");
  const filteredToolIds = useMemo(() => {
    const query = toolQuery.trim().toLowerCase();
    if (!query) return new Set(TOOL_CARDS.map((tool) => tool.id));
    return new Set(
      TOOL_CARDS.filter((tool) =>
        [tool.label, tool.eyebrow, tool.description, tool.status].join(" ").toLowerCase().includes(query)
      ).map((tool) => tool.id)
    );
  }, [toolQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!VALID_TOOL_IDS.has(activeTool)) return;
    window.localStorage.setItem(ACTIVE_TOOL_STORAGE_KEY, activeTool);
  }, [activeTool]);

  if (activeTool === "yopass") {
    return (
      <ToolPanelShell
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        actions={(
          <a
            href={YOPASS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs font-medium text-sand-700 hover:bg-sand-50"
          >
            <ExternalLink size={14} />
            Neu öffnen
          </a>
        )}
      >
        <section className="overflow-hidden rounded-[26px] border border-sand-200 bg-white shadow-soft">
          <iframe
            title="YoPass Compact"
            src={YOPASS_IFRAME_URL}
            className="h-[calc(100vh-10.5rem)] min-h-[640px] w-full bg-white"
            referrerPolicy="no-referrer"
          />
        </section>
      </ToolPanelShell>
    );
  }

  if (activeTool === "rmm-audits") {
    return (
      <ToolPanelShell activeTool={activeTool} setActiveTool={setActiveTool}>
        <RmmAuditsPanel />
      </ToolPanelShell>
    );
  }

  if (activeTool === "exports") {
    return (
      <ToolPanelShell activeTool={activeTool} setActiveTool={setActiveTool}>
        <CustomerExportPanel />
      </ToolPanelShell>
    );
  }

  if (activeTool === "remote-deploy") {
    return (
      <ToolPanelShell activeTool={activeTool} setActiveTool={setActiveTool}>
        <RemoteDeployPanel />
      </ToolPanelShell>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <ToolHeader activeTool={activeTool} setActiveTool={setActiveTool} />

      <main className="mx-auto max-w-[1440px] space-y-5 px-6 py-5">
        <section className="rounded-[26px] border border-sand-200 bg-white p-4 shadow-soft">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] font-medium text-sand-500">Werkzeugauswahl</p>
              <h2 className="mt-1 text-xl font-display text-sand-900">Interne Werkzeuge schnell öffnen.</h2>
              <p className="mt-1 max-w-3xl text-sm text-sand-600">
                Die Tools sind nach Aufgabe gruppiert. Suche oder nutze den Strip oben für den direkten Wechsel.
              </p>
            </div>
            <label className="relative flex items-center">
              <Search className="absolute left-3 text-sand-400" size={16} />
              <input
                value={toolQuery}
                onChange={(event) => setToolQuery(event.target.value)}
                className="w-full rounded-xl border border-sand-200 bg-sand-50 py-2.5 pl-9 pr-4 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="Tool suchen"
              />
            </label>
          </div>
        </section>

        {TOOL_GROUPS.map((group) => {
          const tools = group.items
            .map((id) => TOOL_CARDS.find((tool) => tool.id === id))
            .filter((tool) => tool && filteredToolIds.has(tool.id));
          if (!tools.length) return null;
          return (
            <section key={group.title} className="rounded-[26px] border border-sand-200 bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-sand-500">{group.title}</h3>
                  <p className="mt-1 text-sm text-sand-600">{group.description}</p>
                </div>
                <span className="text-xs text-sand-500">{tools.length} verfügbar</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveTool(tool.id)}
                      className="group flex min-h-[128px] flex-col justify-between rounded-2xl border border-sand-200 bg-sand-50/60 p-4 text-left transition hover:border-sand-300 hover:bg-white hover:shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sand-900 text-white">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs uppercase tracking-[0.25em] text-sand-500">{tool.eyebrow}</p>
                              <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-600">
                                {tool.status}
                              </span>
                            </div>
                            <h4 className="mt-1 text-base font-semibold text-sand-900">{tool.label}</h4>
                          </div>
                        </div>
                        <ArrowRight className="mt-1 shrink-0 text-sand-400 transition group-hover:translate-x-1 group-hover:text-sand-700" size={18} />
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-5 text-sand-600">{tool.description}</p>
                      <div className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-3 py-1 text-xs uppercase tracking-wide text-white">
                        {tool.action}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        {Array.from(filteredToolIds).length === 0 ? (
          <section className="rounded-3xl border border-dashed border-sand-300 bg-white px-5 py-8 text-center text-sm text-sand-500">
            Kein Tool passt zur Suche.
          </section>
        ) : null}
      </main>
    </div>
  );
}
