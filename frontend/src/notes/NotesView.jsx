import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListOrdered, StickyNote, Underline } from "lucide-react";

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
  const editorRef = useRef(null);
  const lastLoadedId = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    api.pinboard().then(setNote);
  }, []);

  useEffect(() => {
    if (!note.id || !editorRef.current || lastLoadedId.current === note.id) return;
    lastLoadedId.current = note.id;
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(note.content || "");
    if (looksLikeHtml) {
      editorRef.current.innerHTML = note.content;
    } else {
      editorRef.current.innerText = note.content || "";
    }
    setIsEmpty(!editorRef.current.textContent?.trim());
  }, [note.id, note.content]);

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

  const exec = (command, value) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    setNote((prev) => ({ ...prev, content: editorRef.current.innerHTML }));
    setIsEmpty(!editorRef.current.textContent?.trim());
  };

  const insertLink = () => {
    const url = prompt("Link URL");
    if (!url) return;
    exec("createLink", url);
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    setNote((prev) => ({ ...prev, content: editorRef.current.innerHTML }));
    setIsEmpty(!editorRef.current.textContent?.trim());
  };

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
            className="hidden"
            value={note.content}
            readOnly
          />
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => exec("bold")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <Bold size={12} /> Fett
            </button>
            <button
              type="button"
              onClick={() => exec("italic")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <Italic size={12} /> Kursiv
            </button>
            <button
              type="button"
              onClick={() => exec("underline")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <Underline size={12} /> Unterstr.
            </button>
            <button
              type="button"
              onClick={() => exec("insertUnorderedList")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <List size={12} /> Liste
            </button>
            <button
              type="button"
              onClick={() => exec("insertOrderedList")}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <ListOrdered size={12} /> Nummeriert
            </button>
            <button
              type="button"
              onClick={insertLink}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <Link2 size={12} /> Link
            </button>
          </div>
          <div className="relative">
            {isEmpty ? (
              <div className="pointer-events-none absolute left-4 top-3 text-sm text-sand-400">
                Notizen, Ideen und To-Dos hier sammeln...
              </div>
            ) : null}
            <div
              ref={editorRef}
              onInput={handleInput}
              contentEditable
              suppressContentEditableWarning
              className="w-full min-h-[60vh] rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-sand-300"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
