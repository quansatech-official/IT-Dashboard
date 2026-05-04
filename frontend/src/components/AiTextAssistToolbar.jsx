import { useState } from "react";
import { Check, ClipboardList, FileText, Loader2, Scissors, Sparkles, UserRoundCheck, Wrench } from "lucide-react";

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
  className = ""
}) {
  const [running, setRunning] = useState("");
  const [error, setError] = useState("");

  const run = async (action) => {
    if (disabled || running) return;
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
        onApply?.(payload.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "KI-Aktion fehlgeschlagen.");
    } finally {
      setRunning("");
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const active = running === action.key;
        return (
          <button
            key={action.key}
            type="button"
            onClick={() => run(action.key)}
            disabled={disabled || Boolean(running)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-800 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
            title={action.label}
          >
            {active ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            <span>{action.label}</span>
          </button>
        );
      })}
      {error ? <span className="ml-1 text-[11px] text-rose-600">{error}</span> : null}
    </div>
  );
}
