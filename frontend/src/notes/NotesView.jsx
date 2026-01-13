import { useEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";

const API = "/api";

const api = {
  pinboard: () => fetch(`${API}/pinboard`).then((r) => r.json()),
  savePinboard: (id, content) =>
    fetch(`${API}/pinboard/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    })
};

export default function NotesView() {
  const [note, setNote] = useState({ id: null, content: "" });
  const saveTimer = useRef(null);

  useEffect(() => {
    api.pinboard().then(setNote);
  }, []);

  useEffect(() => {
    if (!note.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.savePinboard(note.id, note.content);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [note.id, note.content]);

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
            <StickyNote size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Notizen</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center gap-2 text-sand-700 mb-4">
            <StickyNote size={18} />
            <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Pinboard</p>
          </div>
          <textarea
            value={note.content}
            onChange={(e) => setNote({ ...note, content: e.target.value })}
            className="w-full min-h-[60vh] resize-none rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="Notizen, Ideen und To-Dos hier sammeln..."
          />
        </div>
      </main>
    </div>
  );
}
