import { useState } from "react";
import { X } from "lucide-react";

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
  busyText = "",
  sendLabel = "Senden",
  bodyFontFamily = "Arial, Helvetica, sans-serif",
  trackingResetChecked = false,
  onTrackingResetChange,
  previewSignatureHtml = "",
  previewSubject,
  previewRecipient,
  onClose,
  onSend,
  onRecipientChange,
  onSubjectChange,
  onBodyChange
}) {
  if (!open) return null;
  const [showPreview, setShowPreview] = useState(false);
  const busyLabel = busyText || "Bitte warten...";
  const previewTo = previewRecipient ?? recipient;
  const previewTitle = previewSubject ?? subject;
  const signatureBlock = previewSignatureHtml
    ? `<div style="margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px;">${previewSignatureHtml}</div>`
    : "";
  const previewHtml = `${body || ""}${signatureBlock}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-sand-900/50 px-4 py-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
        {isSending ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur">
            <div className="flex flex-col items-center gap-3 text-xs uppercase tracking-wide text-sand-600">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-sand-300 border-t-transparent" />
              <span>{busyLabel}</span>
            </div>
          </div>
        ) : null}
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
          <label className="text-xs text-sand-500">
            Empfänger E-Mail
            <input
              className={inputClass}
              value={recipient}
              onChange={(event) => onRecipientChange?.(event.target.value)}
              placeholder="kunde@example.com"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="text-xs text-sand-500">
            Betreff
            <input
              className={inputClass}
              value={subject}
              onChange={(event) => onSubjectChange?.(event.target.value)}
              placeholder="Betreff"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
          {showBody ? (
            <label className="text-xs text-sand-500">
              Nachricht
              <textarea
                className={`${inputClass} mt-2 min-h-[140px] resize-y`}
                value={body}
                onChange={(event) => onBodyChange?.(event.target.value)}
                placeholder="Sehr geehrte Damen und Herren,"
                style={bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined}
              />
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Vorschau
                </p>
                <button
                  type="button"
                  onClick={() => setShowPreview((current) => !current)}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-50"
                >
                  {showPreview ? "Ausblenden" : "Anzeigen"}
                </button>
              </div>
              {showPreview ? (
                <div className="mt-2 rounded-2xl border border-sand-200 bg-white text-sm text-sand-800 shadow-soft">
                  <div className="border-b border-sand-100 bg-sand-50 px-4 py-2">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                      E-Mail Vorschau
                    </p>
                  </div>
                  <div className="px-4 py-3 text-[11px] text-sand-600 space-y-1">
                    <div className="flex gap-2">
                      <span className="min-w-[48px] uppercase tracking-wide text-sand-400">
                        An
                      </span>
                      <span className="text-sand-700">{previewTo || "—"}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="min-w-[48px] uppercase tracking-wide text-sand-400">
                        Betreff
                      </span>
                      <span className="text-sand-700">{previewTitle || "—"}</span>
                    </div>
                  </div>
                  <div
                    className="px-4 pb-4 text-sm text-sand-800"
                    style={bodyFontFamily ? { fontFamily: bodyFontFamily } : undefined}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              ) : null}
            </label>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 border-t border-sand-100 px-6 py-4 text-[11px] text-sand-500">
          {trackingText ? <p>{trackingText}</p> : null}
          {helperText ? <p>{helperText}</p> : null}
          {onTrackingResetChange ? (
            <label className="mt-2 inline-flex items-center gap-2 text-[10px] uppercase tracking-wide text-sand-500">
              <input
                type="checkbox"
                checked={trackingResetChecked}
                onChange={(event) => onTrackingResetChange?.(event.target.checked)}
              />
              Tracking-ID neu erzeugen
            </label>
          ) : null}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-sand-200 px-4 py-1.5 text-xs text-sand-600 hover:bg-sand-50"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={isSending || !recipient}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs text-white ${
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
