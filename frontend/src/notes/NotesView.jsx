import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { Bold, Italic, Link2, List, ListOrdered, StickyNote, Underline as UnderlineIcon } from "lucide-react";

const API = "/api";

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
  const lastSavedContent = useRef("");
  const latestContentRef = useRef("");
  const hasLocalEdits = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveState, setSaveState] = useState({ status: "idle", at: "" });
  const textRef = useRef("");
  const [filterTag, setFilterTag] = useState("");
  const imageInputRef = useRef(null);
  const [forceSaving, setForceSaving] = useState(false);
  const quickTags = ["todo", "urgent", "kunde", "telefon", "termin"];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: true }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto", "tel"]
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false })
    ],
    content: "",
    onUpdate: ({ editor }) => {
      hasLocalEdits.current = true;
      const html = editor.getHTML();
      latestContentRef.current = html;
      setNote((prev) => ({ ...prev, content: html }));
      const plain = editor.getText().trim();
      textRef.current = plain;
      setIsEmpty(!plain);
    }
  });

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
    const plain = String(note.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
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

  useEffect(() => {
    if (!editor || !isLoaded) return;
    if (hasLocalEdits.current) return;
    editor.commands.setContent(note.content || "", false);
    const plain = editor.getText().trim();
    textRef.current = plain;
    setIsEmpty(!plain);
  }, [editor, isLoaded, note.content]);

  const insertText = (text) => {
    if (!editor) return;
    hasLocalEdits.current = true;
    editor.chain().focus().insertContent(text).run();
  };

  const insertTag = (tag) => insertText(`#${tag} `);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Link", previous);
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        editor.chain().focus().setImage({ src: result }).run();
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const filteredLines = filterTag
    ? textRef.current
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && line.toLowerCase().includes(filterTag.toLowerCase()))
    : [];

  const saveNow = async () => {
    if (!note.id || forceSaving) return;
    setForceSaving(true);
    try {
      const content = latestContentRef.current || note.content || "";
      await api.savePinboard(note.id, content);
      lastSavedContent.current = content;
      setSaveState({ status: "saved", at: new Date().toLocaleTimeString("de-DE") });
    } catch (error) {
      setSaveState((prev) => ({ ...prev, status: "error" }));
    } finally {
      setForceSaving(false);
    }
  };

  const revertChanges = () => {
    if (!editor) return;
    if (!window.confirm("Änderungen verwerfen?")) return;
    const content = lastSavedContent.current || "";
    latestContentRef.current = content;
    setNote((prev) => ({ ...prev, content }));
    hasLocalEdits.current = false;
    editor.commands.setContent(content, false);
    const plain = editor.getText().trim();
    textRef.current = plain;
    setIsEmpty(!plain);
  };

  const clearNote = () => {
    if (!editor) return;
    if (!window.confirm("Notiz wirklich leeren?")) return;
    latestContentRef.current = "";
    setNote((prev) => ({ ...prev, content: "" }));
    hasLocalEdits.current = false;
    editor.commands.clearContent(true);
    textRef.current = "";
    setIsEmpty(true);
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-sand-50 overflow-hidden">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-1.5 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sand-900 text-white flex items-center justify-center">
            <StickyNote size={14} />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-sand-500">QT Workbench</p>
            <h1 className="text-base font-display text-sand-900">Notizen</h1>
          </div>
        </div>
      </header>

      <main className="h-[calc(100dvh-50px)] max-w-6xl mx-auto px-4 py-2 flex flex-col">
        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-3 flex flex-col h-full">
          <div className="flex items-center justify-between gap-3 text-sand-700 mb-3">
            <div className="flex items-center gap-2">
              <StickyNote size={16} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Pinboard</p>
            </div>
            <div className="text-[11px] text-sand-500 flex items-center gap-3">
              <span>
                {saveState.status === "saving"
                  ? "Speichert..."
                  : saveState.status === "saved"
                  ? `Gespeichert ${saveState.at}`
                  : saveState.status === "error"
                  ? "Speichern fehlgeschlagen"
                  : ""}
              </span>
              <span className="text-sand-400">{isEmpty ? "Leer" : "Bearbeitet"}</span>
            </div>
          </div>
          <div
            id="pinboard-toolbar"
            className="sticky top-0 z-10 -mx-3 px-3 py-2 flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur border-b border-sand-200 mb-3"
          >
            <select
              value={editor?.getAttributes("heading").level || 0}
              onChange={(event) => {
                if (!editor) return;
                const level = Number(event.target.value);
                if (level === 0) {
                  editor.chain().focus().setParagraph().run();
                } else {
                  editor.chain().focus().toggleHeading({ level }).run();
                }
              }}
            >
              <option value="">Absatz</option>
              <option value="1">H1</option>
              <option value="2">H2</option>
            </select>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-700 hover:bg-sand-100"
              title="Fett"
            >
              <Bold size={12} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-700 hover:bg-sand-100"
              title="Kursiv"
            >
              <Italic size={12} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-700 hover:bg-sand-100"
              title="Unterstrichen"
            >
              <UnderlineIcon size={12} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              className="rounded-full border border-sand-200 bg-white px-2 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
              title="Durchgestrichen"
            >
              S
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className="rounded-full border border-sand-200 bg-white px-2 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
              title="Zitat"
            >
              “ ”
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              className="rounded-full border border-sand-200 bg-white px-2 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
              title="Code"
            >
              {"</>"}
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-700 hover:bg-sand-100"
              title="Nummeriert"
            >
              <ListOrdered size={12} />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-700 hover:bg-sand-100"
              title="Liste"
            >
              <List size={12} />
            </button>
            <select
              value={editor?.getAttributes("paragraph").textAlign || ""}
              onChange={(event) => {
                if (!editor) return;
                const align = event.target.value;
                if (!align) {
                  editor.chain().focus().unsetTextAlign().run();
                } else {
                  editor.chain().focus().setTextAlign(align).run();
                }
              }}
            >
              <option value="">Links</option>
              <option value="center">Zentriert</option>
              <option value="right">Rechts</option>
              <option value="justify">Blocksatz</option>
            </select>
            <input
              type="color"
              value={editor?.getAttributes("textStyle").color || "#111827"}
              onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
              title="Textfarbe"
              className="h-8 w-8 rounded-full border border-sand-200 bg-white p-1"
            />
            <select
              value={editor?.getAttributes("highlight").color || ""}
              onChange={(event) => {
                if (!editor) return;
                const value = event.target.value;
                if (!value) {
                  editor.chain().focus().unsetHighlight().run();
                } else {
                  editor.chain().focus().setHighlight({ color: value }).run();
                }
              }}
            >
              <option value="">Markierung</option>
              <option value="#fef08a">Gelb</option>
              <option value="#bae6fd">Blau</option>
              <option value="#fecaca">Rot</option>
              <option value="#bbf7d0">Grün</option>
            </select>
            <button
              type="button"
              onClick={setLink}
              className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-700 hover:bg-sand-100"
              title="Link"
            >
              <Link2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="rounded-full border border-sand-200 bg-white px-2 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
              title="Bild einfügen"
            >
              Bild
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().undo().run()}
              className="rounded-full border border-sand-200 bg-white px-2 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().redo().run()}
              className="rounded-full border border-sand-200 bg-white px-2 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
            >
              Redo
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              className="rounded-full border border-sand-200 bg-white px-2 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
              title="Format löschen"
            >
              Clear
            </button>
            <label className="ml-2 flex items-center gap-2 text-[10px] uppercase tracking-wide text-sand-500">
              Filter
              <input
                value={filterTag}
                onChange={(event) => setFilterTag(event.target.value)}
                placeholder="#todo"
                className="w-28 rounded-full border border-sand-200 bg-white px-3 py-1 text-[16px] sm:text-xs"
              />
            </label>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <div className="flex-1 overflow-auto space-y-4 pb-6">
            <div className="flex gap-3">
              <div className="w-[90%] min-w-0">
                <div className="relative">
                  {isEmpty && isLoaded ? (
                    <div className="pointer-events-none absolute left-4 top-3 text-[15px] text-sand-400">
                      Notizen, Ideen und To-Dos hier sammeln...
                    </div>
                  ) : null}
                  {isLoaded ? (
                    <EditorContent
                      editor={editor}
                      onClick={() => editor?.chain().focus().run()}
                      className="min-h-[40vh] h-full cursor-text rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-[16px] text-sand-900 focus-within:ring-2 focus-within:ring-sand-300 [&_.ProseMirror]:min-h-[40vh] [&_.ProseMirror]:outline-none [&_.ProseMirror]:whitespace-pre-wrap"
                    />
                  ) : (
                    <div className="min-h-[40vh] rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-6 text-sm text-sand-400">
                      Pinboard wird geladen...
                    </div>
                  )}
                </div>
              </div>
              <div className="w-[10%] min-w-[110px]">
                <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-sand-500">Hashtags</p>
                <div className="flex flex-col gap-1.5">
                  {quickTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => insertTag(tag)}
                      className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {filterTag ? (
              <div className="rounded-2xl border border-sand-200 bg-white p-4">
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
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sand-200 pt-3 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={saveNow}
              disabled={forceSaving || saveState.status === "saving"}
              className="inline-flex items-center justify-center rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={revertChanges}
              className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-50"
            >
              Verwerfen
            </button>
            <button
              type="button"
              onClick={clearNote}
              className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-100"
            >
              Leeren
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
