import { useState } from "react";
import { ArrowLeft, ExternalLink, KeyRound, ShieldCheck, Wrench } from "lucide-react";
import RmmAuditsPanel from "./RmmAuditsPanel";

const YOPASS_URL = "https://share.quansatech.at";
const YOPASS_IFRAME_URL = "/tools/yopass/";

export default function ToolsView() {
  const [activeTool, setActiveTool] = useState("home");

  if (activeTool === "yopass") {
    return (
      <div className="min-h-screen bg-sand-50">
        <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sand-900 text-white">
                <KeyRound size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
                <h1 className="text-2xl font-display text-sand-900">YoPass</h1>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sand-900 text-white">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
                <h1 className="text-2xl font-display text-sand-900">RMM Audits</h1>
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

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sand-900 text-white">
            <Wrench size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Tools</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-6 py-8">
        <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
          <button
            type="button"
            onClick={() => setActiveTool("rmm-audits")}
            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-sand-50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sand-900 text-white">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">RMM Audits</p>
                <p className="mt-1 text-sm text-sand-700">
                  Audit-Notes aus TacticalRMM importieren, validieren und als filterbare AuditRecords anzeigen.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-sand-900 bg-sand-900 px-3 py-1 text-xs uppercase tracking-wide text-white">
              Oeffnen
            </span>
          </button>
        </section>

        <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
          <button
            type="button"
            onClick={() => setActiveTool("yopass")}
            className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-sand-50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sand-900 text-white">
                <KeyRound size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">YoPass</p>
                <p className="mt-1 text-sm text-sand-700">
                  Sichere Einmal-Links für Kennwörter und andere kurze Geheimnisse öffnen.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-sand-900 bg-sand-900 px-3 py-1 text-xs uppercase tracking-wide text-white">
              Oeffnen
            </span>
          </button>
        </section>
      </main>
    </div>
  );
}
