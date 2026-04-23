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
      <div className="min-h-screen bg-sand-50">
        <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
                <KeyRound size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
                <h1 className="text-xl font-display text-sand-900">YoPass</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={YOPASS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
              >
                <ExternalLink size={14} />
                Neu öffnen
              </a>
              <button
                type="button"
                onClick={() => setActiveTool("home")}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
              >
                <ArrowLeft size={14} />
                Zurueck zu Tools
              </button>
            </div>
          </div>
        </header>

        <main className="px-6 py-8">
          <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <iframe
              title="YoPass Compact"
              src={YOPASS_IFRAME_URL}
              className="h-[calc(100vh-11rem)] min-h-[640px] w-full bg-white"
              referrerPolicy="no-referrer"
            />
          </section>
        </main>
      </div>
    );
  }

  if (activeTool === "rmm-audits") {
    return (
      <div className="min-h-screen bg-sand-50">
        <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
                <h1 className="text-xl font-display text-sand-900">RMM Audits</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTool("home")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              <ArrowLeft size={14} />
              Zurueck zu Tools
            </button>
          </div>
        </header>

        <main className="px-6 py-8">
          <RmmAuditsPanel />
        </main>
      </div>
    );
  }

  if (activeTool === "exports") {
    return (
      <div className="min-h-screen bg-sand-50">
        <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
                <h1 className="text-xl font-display text-sand-900">Export</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTool("home")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              <ArrowLeft size={14} />
              Zurueck zu Tools
            </button>
          </div>
        </header>

        <main className="px-6 py-8">
          <CustomerExportPanel />
        </main>
      </div>
    );
  }

  if (activeTool === "remote-deploy") {
    return (
      <div className="min-h-screen bg-sand-50">
        <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
                <MonitorDown size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
                <h1 className="text-xl font-display text-sand-900">Fernwartungslink-Generator</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTool("home")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              <ArrowLeft size={14} />
              Zurueck zu Tools
            </button>
          </div>
        </header>

        <main className="px-6 py-8">
          <RemoteDeployPanel />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
              <Wrench size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Tools</h1>
            </div>
          </div>
          <div className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
            {TOOL_CARDS.length} Werkzeuge
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Werkzeugauswahl</p>
            <h2 className="mt-2 text-xl font-display text-sand-900">Wähle das passende interne Werkzeug.</h2>
            <p className="mt-2 max-w-3xl text-sm text-sand-600">
              Deployment, Export, Audit und sichere Freigaben sind als eigene Arbeitsbereiche getrennt.
            </p>
          </div>
          <label className="relative flex items-center rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
            <Search className="absolute left-8 text-sand-400" size={17} />
            <input
              value={toolQuery}
              onChange={(event) => setToolQuery(event.target.value)}
              className="w-full rounded-2xl border border-sand-200 py-3 pl-10 pr-4 text-sm text-sand-900 outline-none focus:border-sand-400"
              placeholder="Tool suchen"
            />
          </label>
        </section>

        {TOOL_GROUPS.map((group) => {
          const tools = group.items
            .map((id) => TOOL_CARDS.find((tool) => tool.id === id))
            .filter((tool) => tool && filteredToolIds.has(tool.id));
          if (!tools.length) return null;
          return (
            <section key={group.title} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-sand-500">{group.title}</h3>
                  <p className="mt-1 text-sm text-sand-600">{group.description}</p>
                </div>
                <span className="text-xs text-sand-500">{tools.length} verfügbar</span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => setActiveTool(tool.id)}
                      className="group flex min-h-[176px] flex-col justify-between rounded-3xl border border-sand-200 bg-white p-5 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-sand-300 hover:bg-sand-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sand-900 text-white">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs uppercase tracking-[0.25em] text-sand-500">{tool.eyebrow}</p>
                              <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-600">
                                {tool.status}
                              </span>
                            </div>
                            <h4 className="mt-2 text-lg font-display text-sand-900">{tool.label}</h4>
                          </div>
                        </div>
                        <ArrowRight className="mt-1 shrink-0 text-sand-400 transition group-hover:translate-x-1 group-hover:text-sand-700" size={18} />
                      </div>
                      <p className="mt-4 text-sm leading-6 text-sand-600">{tool.description}</p>
                      <div className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-3 py-1 text-xs uppercase tracking-wide text-white">
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
