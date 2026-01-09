import { useState } from "react";
import { Edit3, Plus, Save, Trash2, X } from "lucide-react";

const emptyItem = {
  title: "",
  system: "",
  why_text: "",
  impact: "Keine Unterbrechung",
  duration: "",
  cost: "",
  priority: "Planbar"
};

export default function CatalogManager({ items, onAdd, onRemove, onUpdate }) {
  const [draft, setDraft] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);

  const reset = () => {
    setDraft(emptyItem);
    setEditingId(null);
  };

  const add = () => {
    if (!draft.title.trim()) return;
    onAdd({ ...draft, title: draft.title.trim() });
    reset();
  };

  const saveEdit = () => {
    if (!editingId || !draft.title.trim()) return;
    onUpdate(editingId, { ...draft, title: draft.title.trim() });
    reset();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Titel
          <input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="z. B. Serversystem Update"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          System/Betreff
          <input
            value={draft.system}
            onChange={(event) => setDraft((prev) => ({ ...prev, system: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="Server, Firewall, Backup..."
          />
        </label>
      </div>

      <label className="text-xs uppercase tracking-wide text-sand-600 block">
        Warum / Nutzen
        <textarea
          value={draft.why_text}
          onChange={(event) => setDraft((prev) => ({ ...prev, why_text: event.target.value }))}
          rows={2}
          className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          placeholder="Warum ist dieser Baustein wichtig?"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Impact
          <select
            value={draft.impact}
            onChange={(event) => setDraft((prev) => ({ ...prev, impact: event.target.value }))}
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
            value={draft.duration}
            onChange={(event) => setDraft((prev) => ({ ...prev, duration: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="0,5–1,0 h"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Kostenrahmen
          <input
            value={draft.cost}
            onChange={(event) => setDraft((prev) => ({ ...prev, cost: event.target.value }))}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="60-120 €"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs uppercase tracking-wide text-sand-600">
          Priorität
          <select
            value={draft.priority}
            onChange={(event) => setDraft((prev) => ({ ...prev, priority: event.target.value }))}
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

      <div className="flex flex-wrap gap-2">
        {editingId ? (
          <>
            <button
              onClick={saveEdit}
              className="inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
            >
              <Save size={14} /> Speichern
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <X size={14} /> Abbrechen
            </button>
          </>
        ) : (
          <button
            onClick={add}
            className="inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
          >
            <Plus size={14} /> Baustein speichern
          </button>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-sand-200">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-sand-500">{item.system} · {item.priority}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setDraft({
                    title: item.title || "",
                    system: item.system || "",
                    why_text: item.why_text || "",
                    impact: item.impact || "Keine Unterbrechung",
                  duration: item.duration || "",
                  cost: item.cost || "",
                  priority: item.priority || "Planbar"
                });
              }}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                <Edit3 size={12} /> Bearbeiten
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                <Trash2 size={12} /> Entfernen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
