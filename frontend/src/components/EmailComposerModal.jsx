import { X } from "lucide-react";
import NotesRichTextEditor from "./NotesRichTextEditor";

const inputClass =
  "w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200";
export default function EmailComposerModal({
  open,
  title,
  recipient = "",
  subject = "",
  body = "",
  showBody = true,
  helperText = "",
  trackingText = "",
  isSending = false,
  sendLabel = "Senden",
  onClose,
  onSend,
  onRecipientChange,
  onSubjectChange,
  onBodyChange
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-sand-900/50 px-4 py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-sand-100 px-6 py-4">
          <h3 className="text-lg font-display text-sand-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand-200 bg-white p-2 text-sand-500 hover:bg-sand-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
            Empfänger E-Mail
            <input
              className={inputClass}
              value={recipient}
              onChange={(event) => onRecipientChange?.(event.target.value)}
              placeholder="kunde@example.com"
            />
          </label>
          <label className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
            Betreff
            <input
              className={inputClass}
              value={subject}
              onChange={(event) => onSubjectChange?.(event.target.value)}
              placeholder="Betreff"
            />
          </label>
          {showBody ? (
            <label className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
              Nachricht
              <div className="mt-2">
                <NotesRichTextEditor
                  value={body}
                  onChange={onBodyChange}
                  placeholder="Sehr geehrte Damen und Herren,"
                  minHeight="140px"
                />
              </div>
            </label>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 border-t border-sand-100 px-6 py-4 text-[11px] text-sand-500">
          {trackingText ? <p>{trackingText}</p> : null}
          {helperText ? <p>{helperText}</p> : null}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-sand-200 px-4 py-1.5 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={isSending || !recipient}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs uppercase tracking-wide text-white ${
                isSending
                  ? "bg-sand-400 cursor-wait"
                  : "bg-sand-900 hover:opacity-90 disabled:cursor-not-allowed"
              }`}
            >
              {isSending ? "Sende..." : sendLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
