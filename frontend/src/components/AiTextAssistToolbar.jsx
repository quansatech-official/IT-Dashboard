import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardList, FileText, Loader2, RotateCcw, Scissors, Sparkles, UserRoundCheck, Wrench } from "lucide-react";

const ACTIONS = [
  { key: "improve", label: "Verbessern", icon: Sparkles },
  { key: "shorten", label: "Kuerzen", icon: Scissors },
  { key: "professional", label: "Professioneller", icon: Check },
  { key: "customer_friendly", label: "Kundenfreundlich", icon: UserRoundCheck },
  { key: "technical", label: "Technischer", icon: Wrench },
  { key: "summary", label: "Zusammenfassung", icon: FileText },
  { key: "todos", label: "To-dos", icon: ClipboardList }
];

const stripHtml = (value) =>
  String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function AiTextAssistToolbar({
  value,
  onApply,
  module = "notes",
  context = {},
  format = "html",
  disabled = false,
  variant = "combo",
  className = ""
}) {
  const [running, setRunning] = useState("");
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [undoState, setUndoState] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!undoState) return;
    if (value !== undoState.previous && value !== undoState.applied) {
      setUndoState(null);
    }
  }, [value, undoState]);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setDropdownOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [dropdownOpen]);

  const run = async (action) => {
    if (disabled || running) return;
    setDropdownOpen(false);
    const text = String(value || "").trim();
    if (!stripHtml(text)) {
      setError("Text fehlt.");
      return;
    }
    setError("");
    setRunning(action);
    try {
      const response = await fetch("/api/ai/text_assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          text,
          module,
          format,
          context
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail || `HTTP ${response.status}`);
      }
      if (typeof payload?.text === "string" && payload.text.trim()) {
        const previous = String(value ?? "");
        const applied = payload.text;
        onApply?.(applied);
        if (previous !== applied) {
          setUndoState({ previous, applied, action });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "KI-Aktion fehlgeschlagen.");
    } finally {
      setRunning("");
    }
  };

  const primaryAction = ACTIONS[0];
  const specialActions = ACTIONS.slice(1);

  const undoButton = undoState ? (
    <button
      type="button"
      onClick={() => {
        onApply?.(undoState.previous);
        setUndoState(null);
      }}
      disabled={disabled || Boolean(running)}
      className="ai-action inline-flex min-h-7 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      title="KI-Änderung rückgängig machen"
    >
      <RotateCcw size={11} />
      <span>Rückgängig</span>
    </button>
  ) : null;

  if (variant === "combo") {
    const PrimaryIcon = running ? Loader2 : primaryAction.icon;
    const activeAction = ACTIONS.find((action) => action.key === running);

    return (
      <div ref={rootRef} className={`ai-panel relative inline-flex items-center gap-1 rounded-xl border border-sky-100 bg-sky-50/70 p-1 ${className}`}>
        <div className="inline-flex overflow-hidden rounded-full border border-sky-200 bg-sky-50 shadow-sm">
          <button
            type="button"
            onClick={() => run(primaryAction.key)}
            disabled={disabled || Boolean(running)}
            className="ai-action inline-flex min-h-7 items-center gap-1 px-2.5 py-0.5 text-[10px] font-medium leading-none text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={primaryAction.label}
          >
            <PrimaryIcon size={11} className={running ? "animate-spin" : ""} />
            <span className="whitespace-nowrap">{running ? `${activeAction?.label || primaryAction.label}...` : primaryAction.label}</span>
          </button>
          <button
            type="button"
            onClick={() => setDropdownOpen((open) => !open)}
            disabled={disabled || Boolean(running)}
            className="ai-action inline-flex min-h-7 items-center justify-center border-l border-sky-200 px-1.5 text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="Spezial-KI auswählen"
            aria-label="Spezial-KI auswählen"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
          >
            <ChevronDown size={12} className={`transition ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        {dropdownOpen ? (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-sky-100 bg-white py-0.5 text-[11px] shadow-xl" role="menu">
            <div className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-sand-400">
              Spezial KI
            </div>
            {specialActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => run(action.key)}
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-sand-700 hover:bg-sky-50 hover:text-sky-800"
                  role="menuitem"
                >
                  <Icon size={12} className="text-sky-600" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {undoButton}
        {error ? <span className="ml-1 text-[10px] text-rose-600">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className={`ai-panel flex flex-wrap items-center gap-1 rounded-xl border border-sky-100 bg-sky-50/70 p-1 ${className}`}>
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const active = running === action.key;
        return (
          <button
            key={action.key}
            type="button"
            onClick={() => run(action.key)}
            disabled={disabled || Boolean(running)}
            className="ai-action inline-flex min-h-7 items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={action.label}
          >
            {active ? <Loader2 size={11} className="animate-spin" /> : <Icon size={11} />}
            <span>{action.label}</span>
          </button>
        );
      })}
      {undoButton}
      {error ? <span className="ml-1 text-[10px] text-rose-600">{error}</span> : null}
    </div>
  );
}
