import { BookmarkPlus, Trash2 } from "lucide-react";
import { priorityStyles } from "../constants";

export default function ActionCard({ action, onChange, onRemove, onSaveToCatalog }) {
  return (
    <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-soft space-y-3">
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-semibold uppercase tracking-wide border px-2 py-1 rounded-full ${priorityStyles[action.priority]}`}
        >
          {action.priority}
        </span>
        <input
          value={action.title}
          onChange={(event) => onChange({ title: event.target.value })}
          className="flex-1 text-sm font-semibold border-b border-transparent focus:border-sand-400 focus:outline-none"
          placeholder="Titel der Maßnahme"
        />
        <button
          type="button"
          onClick={onSaveToCatalog}
          className="text-slate-400 hover:text-sand-700"
          title="Als Baustein speichern"
        >
          <BookmarkPlus size={16} />
        </button>
        <button type="button" onClick={onRemove} className="text-slate-400 hover:text-rose-500">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs uppercase tracking-wide text-sand-600">
          System/Betreff
          <input
            value={action.system}
            onChange={(event) => onChange({ system: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="Server, Firewall, Client..."
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Priorität
          <select
            value={action.priority}
            onChange={(event) => onChange({ priority: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          >
            {["Dringend", "Planbar", "Hinweis"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-xs uppercase tracking-wide text-sand-600 block">
        Warum / Nutzen
        <textarea
          value={action.why_text}
          onChange={(event) => onChange({ why_text: event.target.value })}
          rows={2}
          className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          placeholder="Warum ist diese Maßnahme wichtig?"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Auswirkung
          <select
            value={action.impact}
            onChange={(event) => onChange({ impact: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          >
            {["Keine Unterbrechung", "Kurzunterbrechung", "Wartungsfenster"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Dauer
          <input
            value={action.duration}
            onChange={(event) => onChange({ duration: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="0,5–1,0 h"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Kostenrahmen
          <input
            value={action.cost}
            onChange={(event) => onChange({ cost: event.target.value })}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="€ 120–240"
          />
        </label>
      </div>

    </div>
  );
}
