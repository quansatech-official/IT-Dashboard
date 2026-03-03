import { useEffect, useRef, useState } from "react";
import { BrainCircuit, ExternalLink, KeyRound, ShieldAlert, Sparkles, Wrench } from "lucide-react";

const YOPASS_URL = "https://share.quansatech.at";
const API = "/api";

const defaultDraft = {
  prompt: "",
  model: "",
};

export default function ToolsView() {
  const [aiDraft, setAiDraft] = useState(defaultDraft);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState("Bereit.");
  const [aiResult, setAiResult] = useState("");
  const [aiMeta, setAiMeta] = useState(null);
  const [toast, setToast] = useState("");
  const [aiModels, setAiModels] = useState([]);
  const [aiModelsBusy, setAiModelsBusy] = useState(false);
  const [aiPromptLimit, setAiPromptLimit] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      setAiModelsBusy(true);
      try {
        const response = await fetch(`${API}/tools/internal_ai_models`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.detail || "model_list_failed");
        }
        const models = Array.isArray(data?.models)
          ? data.models.map((entry) => String(entry || "").trim()).filter(Boolean)
          : [];
        const defaultModel = String(data?.default_model || "").trim();
        const promptLimit = Math.max(0, Number(data?.prompt_limit_chars || 0));
        if (cancelled) return;
        setAiModels(models);
        setAiPromptLimit(promptLimit);
        setAiDraft((prev) => ({
          ...prev,
          model: prev.model || defaultModel || models[0] || "",
        }));
      } catch (error) {
        if (cancelled) return;
        setToast(error?.message ? String(error.message) : "Modellliste konnte nicht geladen werden.");
      } finally {
        if (!cancelled) {
          setAiModelsBusy(false);
        }
      }
    };
    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const runInternalAi = async () => {
    const prompt = String(aiDraft.prompt || "").trim();
    if (!prompt) {
      setToast("Bitte Prompt eingeben.");
      return;
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setAiBusy(true);
    setAiResult("");
    setAiMeta(null);
    setAiStatus("Verbinde mit interner KI…");
    try {
      const response = await fetch(`${API}/tools/internal_ai_prompt_stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          prompt,
          model: aiDraft.model,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.detail || "ai_request_failed");
      }
      if (!response.body) {
        throw new Error("stream_unavailable");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedText = false;

      const handleLine = (line) => {
        const trimmed = String(line || "").trim();
        if (!trimmed) return false;
        let payload = null;
        try {
          payload = JSON.parse(trimmed);
        } catch {
          return false;
        }
        if (!payload || typeof payload !== "object") return false;
        if (payload.type === "status") {
          const detail = String(payload.detail || "").trim();
          if (detail) {
            setAiStatus(detail.endsWith("…") || detail.endsWith(".") ? detail : `${detail}…`);
          }
          if (payload.model) {
            setAiMeta((prev) => ({
              model: String(payload.model || prev?.model || "").trim(),
              provider: String(prev?.provider || "ollama").trim(),
              generatedAt: Number(prev?.generatedAt || 0),
            }));
          }
          return false;
        }
        if (payload.type === "meta") {
          setAiMeta({
            model: String(payload.model || "").trim(),
            provider: String(payload.provider || "ollama").trim(),
            generatedAt: 0,
          });
          setAiStatus(
            payload.model
              ? `KI streamt mit ${String(payload.model).trim()}…`
              : "KI streamt…",
          );
          return false;
        }
        if (payload.type === "delta") {
          const chunk = String(payload.text || "");
          if (!chunk) return false;
          receivedText = true;
          setAiResult((prev) => prev + chunk);
          setAiStatus("Antwort streamt…");
          return false;
        }
        if (payload.type === "done") {
          setAiMeta((prev) => ({
            model: String(payload.model || prev?.model || "").trim(),
            provider: String(payload.provider || prev?.provider || "ollama").trim(),
            generatedAt: Number(payload.generated_at || 0),
          }));
          setAiStatus(receivedText ? "Fertig." : "Fertig ohne Inhalt.");
          return true;
        }
        if (payload.type === "error") {
          throw new Error(payload.detail || "ai_stream_failed");
        }
        return false;
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (handleLine(line)) {
            await reader.cancel();
            abortRef.current = null;
            setAiBusy(false);
            return;
          }
          newlineIndex = buffer.indexOf("\n");
        }
        if (done) {
          const tail = buffer.trim();
          if (tail) {
            handleLine(tail);
          }
          break;
        }
      }
      if (!receivedText) {
        setAiStatus("Fertig ohne Inhalt.");
      } else if (aiStatus !== "Fertig.") {
        setAiStatus("Fertig.");
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setAiStatus("Abgebrochen.");
        return;
      }
      setAiStatus(error?.message ? `Fehlgeschlagen: ${String(error.message)}` : "Fehlgeschlagen.");
      setToast(error?.message ? String(error.message) : "KI-Anfrage fehlgeschlagen.");
    } finally {
      abortRef.current = null;
      setAiBusy(false);
    }
  };

  const cancelInternalAi = () => {
    if (!abortRef.current) return;
    abortRef.current.abort();
  };

  const promptLength = aiDraft.prompt.length;

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
              Gib der internen KI einen freien Arbeitsauftrag direkt im Prompt. Geeignet für Listen, Tabellen,
              Bereinigung, Umformatierung oder strukturierte Aufbereitung.
            </p>
          </div>

          <div className="grid items-stretch gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="flex min-h-[640px] flex-col gap-3">
              <div className="flex flex-1 flex-col rounded-2xl border border-sand-200 bg-white p-3">
                <label className="flex flex-1 flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Prompt</span>
                  <textarea
                    value={aiDraft.prompt}
                    onChange={(event) => setAiDraft((prev) => ({ ...prev, prompt: event.target.value }))}
                    placeholder="z. B. Bereite diese Passwortliste als Tabelle mit Spalten Kunde, System, Benutzer, Passwort, Notiz auf."
                    className="mt-1 min-h-[320px] flex-1 w-full rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-900 outline-none focus:border-sand-300"
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-sand-500">
                  <span>
                    Zeichen {promptLength}
                    {aiPromptLimit > 0 ? ` / ${aiPromptLimit}` : ""}
                  </span>
                  <span>{aiPromptLimit > 0 ? "Aktuelles Server-Limit" : "Kein Limit geladen"}</span>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[220px]">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Modell</span>
                    <select
                      value={aiDraft.model}
                      onChange={(event) => setAiDraft((prev) => ({ ...prev, model: event.target.value }))}
                      disabled={aiBusy || aiModelsBusy || aiModels.length === 0}
                      className="mt-1 w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {aiModels.length ? null : <option value="">{aiModelsBusy ? "Lade Modelle…" : "Kein Modell"}</option>}
                      {aiModels.map((modelName) => (
                        <option key={modelName} value={modelName}>
                          {modelName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={runInternalAi}
                    disabled={aiBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles size={13} />
                    {aiBusy ? "Verarbeite…" : "Intern auswerten"}
                  </button>
                  {aiBusy ? (
                    <button
                      type="button"
                      onClick={cancelInternalAi}
                      className="rounded-full border border-rose-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-50"
                    >
                      Abbrechen
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (abortRef.current) {
                        abortRef.current.abort();
                      }
                      setAiDraft(defaultDraft);
                      setAiResult("");
                      setAiMeta(null);
                      setAiStatus("Bereit.");
                    }}
                    className="rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                  >
                    Zurücksetzen
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-sand-200 bg-white px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Status</p>
                <div
                  className={`mt-1.5 rounded-2xl border px-3 py-2 text-sm ${
                    aiBusy
                      ? "border-sky-200 bg-sky-50 text-sky-800"
                      : aiStatus === "Fehlgeschlagen."
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-sand-200 bg-sand-50 text-sand-700"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        aiBusy
                          ? "animate-pulse bg-sky-500"
                          : aiStatus === "Fertig."
                          ? "bg-emerald-500"
                          : aiStatus === "Fehlgeschlagen."
                          ? "bg-rose-500"
                        : "bg-sand-300"
                      }`}
                    />
                    <span className="font-medium">{aiStatus}</span>
                    <span className="rounded-full border border-sand-200 bg-white/70 px-2.5 py-1">
                      Modell {aiDraft.model || "Standard"}
                    </span>
                    <span className="rounded-full border border-sand-200 bg-white/70 px-2.5 py-1">
                      Zeichen {aiResult.length}
                    </span>
                    {aiMeta?.model ? (
                      <span className="rounded-full border border-sand-200 bg-white/70 px-2.5 py-1">
                        Modell {aiMeta.model}
                      </span>
                    ) : null}
                  </div>
                </div>
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
