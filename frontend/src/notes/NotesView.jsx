import { useEffect, useRef, useState } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Bold, Italic, Link2, List, ListOrdered, StickyNote, Underline } from "lucide-react";

const API = "/api";

if (Quill) {
  const Link = Quill.import("formats/link");
  const originalSanitize = Link.sanitize;
  Link.sanitize = (url) => {
    if (!url) return "";
    try {
      return originalSanitize(url);
    } catch {
      const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      try {
        return originalSanitize(normalized);
      } catch {
        return "";
      }
    }
  };
}

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${text}`);
  }
};

const api = {
  pinboard: () => fetchJson(`${API}/pinboard`),
  savePinboard: (id, content) =>
    fetchJson(`${API}/pinboard/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    })
};

export default function NotesView() {
  const [note, setNote] = useState({ id: null, content: "" });
  const saveTimer = useRef(null);
  const lastLoadedId = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const inputTimer = useRef(null);
  const lastSavedContent = useRef("");
  const latestContentRef = useRef("");
  const hasLocalEdits = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveState, setSaveState] = useState({ status: "idle", at: "" });
  const textRef = useRef("");
  const quillRef = useRef(null);
  const [filterTag, setFilterTag] = useState("");
  const quickTags = ["todo", "urgent", "kunde", "telefon", "termin"];

  useEffect(() => {
    let cancelled = false;
    api
      .pinboard()
      .then((data) => {
        if (cancelled) return;
        lastSavedContent.current = data.content || "";
        latestContentRef.current = data.content || "";
        setNote({
          id: data.id,
          content: data.content || ""
        });
        setIsLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Pinboard load failed", error);
        setIsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!note.id || lastLoadedId.current === note.id) return;
    lastLoadedId.current = note.id;
    const plain = String(note.content || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    textRef.current = plain;
    setIsEmpty(!plain);
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

  const handleInput = (content, delta, source, editor) => {
    hasLocalEdits.current = true;
    latestContentRef.current = content;
    const plain = editor.getText().trim();
    textRef.current = plain;
    setIsEmpty(!plain);
    setNote((prev) => ({ ...prev, content }));
  };

  const insertText = (text) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;
    hasLocalEdits.current = true;
    const range = editor.getSelection(true);
    const index = range ? range.index : editor.getLength();
    editor.insertText(index, text, "user");
    editor.setSelection(index + text.length, 0);
    const plain = editor.getText().trim();
    textRef.current = plain;
    setIsEmpty(!plain);
    const nextContent = editor.root.innerHTML;
    latestContentRef.current = nextContent;
    setNote((prev) => ({ ...prev, content: nextContent }));
  };

  const insertTag = (tag) => insertText(`#${tag} `);

  const quillModules = {
    toolbar: {
      container: "#pinboard-toolbar",
      handlers: {
        insertTable: () => {}
      }
    },
    clipboard: { matchVisual: false },
  };

  const quillFormats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "script",
    "blockquote",
    "code-block",
    "list",
    "indent",
    "align",
    "direction",
    "color",
    "background",
    "font",
    "size",
    "link",
    "image",
    "video",
    "table",
    "table-row",
    "table-cell"
  ];

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
          <div
            id="pinboard-toolbar"
            className="sticky top-0 z-10 -mx-6 px-6 py-3 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur border-b border-sand-200 mb-4"
          >
            <select className="ql-font" defaultValue="">
              <option value="">Schrift</option>
              <option value="serif">Serif</option>
              <option value="monospace">Mono</option>
            </select>
            <select className="ql-size" defaultValue="">
              <option value="small">Klein</option>
              <option value="">Normal</option>
              <option value="large">Groß</option>
              <option value="huge">Sehr groß</option>
            </select>
            <select className="ql-header" defaultValue="">
              <option value="">Absatz</option>
              <option value="1">H1</option>
              <option value="2">H2</option>
            </select>
            <button className="ql-bold" title="Fett">
              <Bold size={12} />
            </button>
            <button className="ql-italic" title="Kursiv">
              <Italic size={12} />
            </button>
            <button className="ql-underline" title="Unterstrichen">
              <Underline size={12} />
            </button>
            <button className="ql-strike" title="Durchgestrichen">S</button>
            <button className="ql-script" value="sub" title="Tiefgestellt">x₂</button>
            <button className="ql-script" value="super" title="Hochgestellt">x²</button>
            <button className="ql-blockquote" title="Zitat">“ ”</button>
            <button className="ql-code-block" title="Code">{"</>"}</button>
            <button className="ql-list" value="ordered" title="Nummeriert">
              <ListOrdered size={12} />
            </button>
            <button className="ql-list" value="bullet" title="Liste">
              <List size={12} />
            </button>
            <button className="ql-indent" value="-1" title="Einzug verringern">-</button>
            <button className="ql-indent" value="+1" title="Einzug erhöhen">+</button>
            <select className="ql-align" defaultValue="">
              <option value="">Links</option>
              <option value="center">Zentriert</option>
              <option value="right">Rechts</option>
              <option value="justify">Blocksatz</option>
            </select>
            <button className="ql-direction" value="rtl" title="Rechts nach links">RTL</button>
            <select className="ql-color" defaultValue="">
              <option value="">Textfarbe</option>
              <option value="#111827">Dunkel</option>
              <option value="#dc2626">Rot</option>
              <option value="#2563eb">Blau</option>
              <option value="#16a34a">Grün</option>
              <option value="#ca8a04">Gold</option>
            </select>
            <select className="ql-background" defaultValue="">
              <option value="">Markierung</option>
              <option value="#fef08a">Gelb</option>
              <option value="#bae6fd">Blau</option>
              <option value="#fecaca">Rot</option>
              <option value="#bbf7d0">Grün</option>
            </select>
            <button className="ql-link" title="Link">
              <Link2 size={12} />
            </button>
            <button className="ql-image" title="Bild einfügen">Bild</button>
            <button className="ql-video" title="Video">Video</button>
            <button className="ql-insertTable" title="Tabelle">Tabelle</button>
            <button className="ql-clean" title="Format löschen">Clear</button>
          </div>
          <div className="relative">
            {isEmpty && isLoaded ? (
              <div className="pointer-events-none absolute left-4 top-3 text-sm text-sand-400">
                Notizen, Ideen und To-Dos hier sammeln...
              </div>
            ) : null}
            {isLoaded ? (
              <ReactQuill
                ref={quillRef}
                theme="snow"
                modules={quillModules}
                formats={quillFormats}
                value={String(note.content || "")}
                onChange={handleInput}
                className="pinboard-editor [&_.ql-toolbar]:border-sand-200 [&_.ql-toolbar]:rounded-t-2xl [&_.ql-container]:border-sand-200 [&_.ql-container]:rounded-b-2xl [&_.ql-editor]:min-h-[60vh] [&_.ql-editor]:bg-sand-50 [&_.ql-editor]:text-sand-900 [&_.ql-editor]:text-sm [&_.ql-editor]:px-4 [&_.ql-editor]:py-3 [&_.ql-editor]:focus:outline-none [&_.ql-editor]:focus:ring-2 [&_.ql-editor]:focus:ring-sand-300 [&_.ql-editor_ol]:pl-6 [&_.ql-editor_ul]:pl-6"
              />
            ) : (
              <div className="min-h-[60vh] rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-6 text-sm text-sand-400">
                Pinboard wird geladen...
              </div>
            )}
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
