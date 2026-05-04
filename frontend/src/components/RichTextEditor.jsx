import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { Bold, Italic, Link2, List, ListOrdered, Underline as UnderlineIcon } from "lucide-react";
import AiTextAssistToolbar from "./AiTextAssistToolbar";

const toolbarButtonClass =
  "inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-50";

const editorWrapperClass =
  "rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus-within:ring-2 focus-within:ring-amber-200";

const editorContentClass = "prose prose-sm max-w-none text-sand-900";

const normalizeHtml = (value) => (typeof value === "string" ? value : "");

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  minHeight = "120px",
  disabled = false,
  showToolbar = true,
  enableAi = true,
  aiModule = "notes",
  aiContext = {}
}) {
  const [isEmpty, setIsEmpty] = useState(true);
  const lastValueRef = useRef("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: true }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ["http", "https", "mailto", "tel"]
      })
    ],
    content: normalizeHtml(value),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastValueRef.current = html;
      setIsEmpty(editor.isEmpty);
      onChange?.(html);
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

  const applyAiText = (html) => {
    const next = normalizeHtml(html);
    lastValueRef.current = next;
    onChange?.(next);
    if (editor) {
      editor.commands.setContent(next || "", false);
      setIsEmpty(editor.isEmpty);
    }
  };

  return (
    <div className="space-y-2">
      {showToolbar ? (
        <div className="flex flex-wrap items-center gap-1">
          {enableAi ? (
            <AiTextAssistToolbar
              value={editor?.getHTML?.() || value}
              onApply={applyAiText}
              module={aiModule}
              context={aiContext}
              format="html"
              disabled={disabled}
              className="mr-1"
            />
          ) : null}
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={toolbarButtonClass}
            title="Fett"
          >
            <Bold size={12} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={toolbarButtonClass}
            title="Kursiv"
          >
            <Italic size={12} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={toolbarButtonClass}
            title="Unterstrichen"
          >
            <UnderlineIcon size={12} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={toolbarButtonClass}
            title="Liste"
          >
            <List size={12} />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={toolbarButtonClass}
            title="Nummerierte Liste"
          >
            <ListOrdered size={12} />
          </button>
          <button
            type="button"
            onClick={setLink}
            className={toolbarButtonClass}
            title="Link"
          >
            <Link2 size={12} />
          </button>
        </div>
      ) : null}
      <div className={`${editorWrapperClass} relative`} style={{ minHeight }}>
        {placeholder && isEmpty ? (
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-sand-400">
            {placeholder}
          </div>
        ) : null}
        <div>
          <EditorContent editor={editor} className={editorContentClass} />
        </div>
      </div>
    </div>
  );
}
