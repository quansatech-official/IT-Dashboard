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
import { Bold, Italic, Link2, List, ListOrdered, Underline as UnderlineIcon } from "lucide-react";

const normalizeHtml = (value) => (typeof value === "string" ? value : "");

export default function NotesRichTextEditor({
  value,
  onChange,
  placeholder = "",
  minHeight = "140px",
  disabled = false,
  fontFamily = ""
}) {
  const [isEmpty, setIsEmpty] = useState(true);
  const [headingLevel, setHeadingLevel] = useState(0);
  const lastValueRef = useRef("");
  const imageInputRef = useRef(null);

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
    content: normalizeHtml(value),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastValueRef.current = html;
      setIsEmpty(editor.isEmpty);
      setHeadingLevel(editor.getAttributes("heading").level || 0);
      onChange?.(html);
    },
    onSelectionUpdate: ({ editor }) => {
      setHeadingLevel(editor.getAttributes("heading").level || 0);
    }
  });

  useEffect(() => {
    if (!editor) return;
    const next = normalizeHtml(value);
    if (next === lastValueRef.current) return;
    lastValueRef.current = next;
    editor.commands.setContent(next || "", false);
    setIsEmpty(editor.isEmpty);
  }, [editor, value]);

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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={headingLevel}
          onChange={(event) => {
            if (!editor) return;
            const level = Number(event.target.value);
            if (level === 0) {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level }).run();
            }
          }}
          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs text-sand-700"
        >
          <option value="">Absatz</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
        </select>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className="rounded-full border border-sand-200 bg-white p-2 text-sand-700 hover:bg-sand-100"
          title="Fett"
        >
          <Bold size={12} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className="rounded-full border border-sand-200 bg-white p-2 text-sand-700 hover:bg-sand-100"
          title="Kursiv"
        >
          <Italic size={12} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className="rounded-full border border-sand-200 bg-white p-2 text-sand-700 hover:bg-sand-100"
          title="Unterstrichen"
        >
          <UnderlineIcon size={12} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          className="rounded-full border border-sand-200 bg-white px-3 py-2 text-xs text-sand-700 hover:bg-sand-100"
          title="Durchgestrichen"
        >
          S
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className="rounded-full border border-sand-200 bg-white px-3 py-2 text-xs text-sand-700 hover:bg-sand-100"
          title="Zitat"
        >
          “ ”
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          className="rounded-full border border-sand-200 bg-white px-3 py-2 text-xs text-sand-700 hover:bg-sand-100"
          title="Code"
        >
          {"</>"}
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className="rounded-full border border-sand-200 bg-white p-2 text-sand-700 hover:bg-sand-100"
          title="Nummeriert"
        >
          <ListOrdered size={12} />
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className="rounded-full border border-sand-200 bg-white p-2 text-sand-700 hover:bg-sand-100"
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
          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs text-sand-700"
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
          className="h-9 w-9 rounded-full border border-sand-200 bg-white p-1"
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
          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs text-sand-700"
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
          className="rounded-full border border-sand-200 bg-white p-2 text-sand-700 hover:bg-sand-100"
          title="Link"
        >
          <Link2 size={12} />
        </button>
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="rounded-full border border-sand-200 bg-white px-3 py-2 text-xs text-sand-700 hover:bg-sand-100"
          title="Bild einfügen"
        >
          Bild
        </button>
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <div
        className="relative rounded-2xl border border-sand-200 bg-white px-4 py-3"
        style={fontFamily ? { fontFamily } : undefined}
      >
        {placeholder && isEmpty ? (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-sand-400">
            {placeholder}
          </div>
        ) : null}
        <EditorContent
          editor={editor}
          onClick={() => editor?.chain().focus().run()}
          className="cursor-text text-sm text-sand-900 [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:whitespace-pre-wrap"
          style={{ minHeight, fontFamily: fontFamily || undefined }}
        />
      </div>
    </div>
  );
}
