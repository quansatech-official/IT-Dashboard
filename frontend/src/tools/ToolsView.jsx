import { ExternalLink, KeyRound, Wrench } from "lucide-react";

const YOPASS_URL = "https://share.quansatech.at";

export default function ToolsView() {
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
        <section className="rounded-3xl border border-sand-200 bg-white px-5 py-4 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Übersicht</p>
          <p className="mt-2 max-w-3xl text-sm text-sand-700">
            Der freie KI-Prompt wurde aus der Workbench entfernt und wird künftig über eine separate WebGUI
            außerhalb dieses Bereichs bereitgestellt.
          </p>
          <p className="mt-2 text-sm text-sand-600">
            In den Tools bleibt aktuell die sichere Übergabe über YoPass direkt verfügbar.
          </p>
        </section>

        <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
          <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sand-700">
              <KeyRound size={16} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">YoPass</p>
            </div>
            <a
              href={YOPASS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <ExternalLink size={12} /> Neu öffnen
            </a>
          </div>
          <iframe
            title="YoPass Compact"
            src={YOPASS_URL}
            className="h-[640px] w-full bg-white"
            referrerPolicy="no-referrer"
          />
        </section>
      </main>
    </div>
  );
}
