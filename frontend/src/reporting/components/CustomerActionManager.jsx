import { Edit3, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";

const emptyItem = {
  text: ""
};

export default function CustomerActionManager({ items, onAdd, onRemove, onUpdate }) {
  const [draft, setDraft] = useState(emptyItem);
  const [editingId, setEditingId] = useState(null);

  const reset = () => {
    setDraft(emptyItem);
    setEditingId(null);
  };

  const add = () => {
    if (!draft.text.trim()) return;
    onAdd({ text: draft.text.trim() });
    reset();
  };

  const saveEdit = () => {
    if (!editingId || !draft.text.trim()) return;
    onUpdate(editingId, { text: draft.text.trim() });
    reset();
  };

  return (
    <div className="space-y-4">
      <label className="text-xs uppercase tracking-wide text-sand-600 block">
        Vorschlagstext
        <textarea
          value={draft.text}
          onChange={(event) => setDraft((prev) => ({ ...prev, text: event.target.value }))}
          rows={3}
          className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
          placeholder="z. B. Bitte geben Sie uns das OK zur Umsetzung."
        />
      </label>

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
            <Plus size={14} /> Vorschlag speichern
          </button>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-sand-200">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3"
          >
            <p className="text-sm text-sand-700">{item.text}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingId(item.id);
                  setDraft({ text: item.text || "" });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                <Edit3 size={12} /> Bearbeiten
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-rose-50 hover:text-rose-600"
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
