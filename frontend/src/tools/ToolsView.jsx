import { useEffect, useState } from "react";
import { BrainCircuit, ExternalLink, KeyRound, ShieldAlert, Sparkles, Wrench } from "lucide-react";

const YOPASS_URL = "https://share.quansatech.at";
const API = "/api";

const defaultDraft = {
  prompt: "",
  content: "",
  outputFormat: "markdown",
};

export default function ToolsView() {
  const [aiDraft, setAiDraft] = useState(defaultDraft);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiMeta, setAiMeta] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runInternalAi = async () => {
    const prompt = String(aiDraft.prompt || "").trim();
    const content = String(aiDraft.content || "").trim();
    if (!prompt) {
      setToast("Bitte Prompt eingeben.");
      return;
    }
    setAiBusy(true);
    try {
      const response = await fetch(`${API}/tools/internal_ai_prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          content,
          output_format: aiDraft.outputFormat,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "ai_request_failed");
      setAiResult(String(data?.text || "").trim());
      setAiMeta({
        model: String(data?.model || "").trim(),
        provider: String(data?.provider || "").trim(),
        generatedAt: Number(data?.generated_at || 0),
      });
    } catch (error) {
      setAiResult("");
      setAiMeta(null);
      setToast(error?.message ? String(error.message) : "KI-Anfrage fehlgeschlagen.");
    } finally {
      setAiBusy(false);
    }
  };

  const copyResult = async () => {
    if (!aiResult) return;
    try {
      await navigator.clipboard.writeText(aiResult);
      setToast("Ausgabe kopiert.");
    } catch {
      setToast("Kopieren fehlgeschlagen.");
    }
  };

  return (
    <div className="min-h-screen bg-sand-50">
      {toast ? (
        <div className="fixed top-5 right-6 z-50 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white shadow-soft">
          {toast}
        </div>
      ) : null}
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
        <section className="overflow-hidden rounded-3xl border border-rose-200 bg-gradient-to-br from-white via-rose-50/60 to-amber-50 shadow-soft">
          <div className="border-b border-rose-200 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="rounded-2xl border border-rose-200 bg-white p-2 text-rose-700">
                  <BrainCircuit size={16} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-rose-700">Interne KI</p>
                  <h2 className="mt-1 text-lg font-display text-sand-900">Freier Prompt für interne Datenaufbereitung</h2>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-800">
                <ShieldAlert size={12} />
                Nur für interne sensible Daten
              </div>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-sand-700">
              Gib der internen KI einen freien Arbeitsauftrag und optional Rohdaten. Geeignet für Listen, Tabellen,
              Bereinigung, Umformatierung oder strukturierte Aufbereitung.
            </p>
          </div>

          <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-sand-200 bg-white p-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Prompt</span>
                  <textarea
                    value={aiDraft.prompt}
                    onChange={(event) => setAiDraft((prev) => ({ ...prev, prompt: event.target.value }))}
                    placeholder="z. B. Bereite diese Passwortliste als Tabelle mit Spalten Kunde, System, Benutzer, Passwort, Notiz auf."
                    className="mt-1 min-h-[92px] w-full rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-900 outline-none focus:border-sand-300"
                  />
                </label>
                <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Ausgabeformat</span>
                    <select
                      value={aiDraft.outputFormat}
                      onChange={(event) => setAiDraft((prev) => ({ ...prev, outputFormat: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm"
                    >
                      <option value="markdown">Markdown</option>
                      <option value="table">Tabelle</option>
                      <option value="text">Text</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <button
                      type="button"
                      onClick={runInternalAi}
                      disabled={aiBusy}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={13} />
                      {aiBusy ? "Verarbeite…" : "Intern auswerten"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAiDraft(defaultDraft);
                        setAiResult("");
                        setAiMeta(null);
                      }}
                      className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                    >
                      Zurücksetzen
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-sand-200 bg-white p-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Rohdaten / Kontext</span>
                  <textarea
                    value={aiDraft.content}
                    onChange={(event) => setAiDraft((prev) => ({ ...prev, content: event.target.value }))}
                    placeholder={"Beliebiger interner Inhalt, z. B. CSV, Passwortliste, Notizen, Rohtext, Log-Auszug..."}
                    className="mt-1 min-h-[320px] w-full rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 font-mono text-[13px] text-sand-900 outline-none focus:border-sand-300"
                    spellCheck={false}
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-sand-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 pb-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Ausgabe</p>
                  <p className="mt-1 text-sm text-sand-600">Die KI-Antwort bleibt als kopierbarer Text im Tool.</p>
                </div>
                <button
                  type="button"
                  onClick={copyResult}
                  disabled={!aiResult}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Kopieren
                </button>
              </div>

              {aiMeta ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-sand-500">
                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1">
                    Provider {aiMeta.provider || "ollama"}
                  </span>
                  {aiMeta.model ? (
                    <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1">
                      Modell {aiMeta.model}
                    </span>
                  ) : null}
                  {aiMeta.generatedAt ? (
                    <span className="rounded-full border border-sand-200 bg-sand-50 px-2.5 py-1">
                      {new Date(aiMeta.generatedAt).toLocaleString("de-DE")}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 min-h-[480px] rounded-2xl border border-sand-200 bg-sand-50 p-3">
                {aiResult ? (
                  <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-sand-900">
                    {aiResult}
                  </pre>
                ) : (
                  <div className="flex h-full min-h-[450px] items-center justify-center text-center text-sm text-sand-400">
                    Noch keine Ausgabe. Starte eine interne KI-Anfrage.
                  </div>
                )}
              </div>
            </div>
          </div>
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
            className="h-[420px] w-full bg-white"
            referrerPolicy="no-referrer"
          />
        </section>
      </main>
    </div>
  );
}
