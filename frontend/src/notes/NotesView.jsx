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
  const contentRef = useRef("");
  const inputTimer = useRef(null);
  const lastSavedContent = useRef("");
  const [saveState, setSaveState] = useState({ status: "idle", at: "" });
  const textRef = useRef("");
  const [filterTag, setFilterTag] = useState("");
  const quickTags = ["todo", "urgent", "kunde", "telefon", "termin"];

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
    contentRef.current = editorRef.current.innerHTML;
    textRef.current = editorRef.current.innerText || "";
    lastSavedContent.current = editorRef.current.innerHTML;
    setIsEmpty(!editorRef.current.textContent?.trim());
  }, [note.id, note.content]);

  useEffect(() => {
    if (!note.id) return;
    if (note.content === lastSavedContent.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState((prev) => (prev.status === "saving" ? prev : { ...prev, status: "saving" }));
    saveTimer.current = setTimeout(() => {
      api
        .savePinboard(note.id, note.content)
        .then(() => {
          lastSavedContent.current = note.content;
          setSaveState({ status: "saved", at: new Date().toLocaleTimeString("de-DE") });
        })
        .catch(() => {
          setSaveState((prev) => ({ ...prev, status: "error" }));
        });
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [note.id, note.content]);

  const exec = (command, value) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    contentRef.current = editorRef.current.innerHTML;
    textRef.current = editorRef.current.innerText || "";
    setNote((prev) => ({ ...prev, content: contentRef.current }));
    setIsEmpty(!editorRef.current.textContent?.trim());
  };

  const insertLink = () => {
    const url = prompt("Link URL");
    if (!url) return;
    exec("createLink", url);
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    contentRef.current = editorRef.current.innerHTML;
    textRef.current = editorRef.current.innerText || "";
    setIsEmpty(!editorRef.current.textContent?.trim());
    if (inputTimer.current) clearTimeout(inputTimer.current);
    inputTimer.current = setTimeout(() => {
      setNote((prev) => ({ ...prev, content: contentRef.current }));
    }, 300);
  };

  const insertTag = (tag) => exec("insertText", `#${tag} `);
  const insertChecklistItem = () => exec("insertText", "- [ ] ");

  const filteredLines = filterTag
    ? textRef.current
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line.toLowerCase().includes(filterTag.toLowerCase()))
    : [];

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
          <div className="mb-3 text-xs text-sand-500">
            {saveState.status === "saving"
              ? "Speichert..."
              : saveState.status === "saved"
              ? `Gespeichert ${saveState.at}`
              : saveState.status === "error"
              ? "Speichern fehlgeschlagen"
              : ""}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={insertChecklistItem}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              Checkliste
            </button>
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                #{tag}
              </button>
            ))}
            <label className="ml-auto text-xs uppercase tracking-wide text-sand-500">
              Filter
              <input
                value={filterTag}
                onChange={(event) => setFilterTag(event.target.value)}
                placeholder="z. B. #todo"
                className="ml-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs"
              />
            </label>
          </div>
          <textarea
            className="hidden"
            value={note.content}
            readOnly
          />
          <div className="sticky top-0 z-10 -mx-6 px-6 py-3 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur border-b border-sand-200 mb-4">
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
          {filterTag ? (
            <div className="mt-4 rounded-2xl border border-sand-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500 mb-2">
                Treffer für "{filterTag}"
              </p>
              {filteredLines.length ? (
                <ul className="space-y-2 text-sm text-sand-700">
                  {filteredLines.map((line, idx) => (
                    <li key={`${line}-${idx}`} className="border-b border-sand-100 pb-2">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-sand-500">Keine Treffer.</p>
              )}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
