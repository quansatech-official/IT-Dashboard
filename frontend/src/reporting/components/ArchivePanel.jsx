import { Edit3, Eye, Mail, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { statusStyles } from "../constants";

export default function ArchivePanel({
  archive,
  onDelete,
  onExportEmail,
  onPreview,
  onEdit,
  onSendSmtp
}) {
  const [query, setQuery] = useState("");
  const filteredArchive = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return archive;
    return archive.filter((group) => group.customer.toLowerCase().includes(needle));
  }, [archive, query]);

  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
        <h3 className="text-lg font-display">Archiv nach Kunden</h3>
        <label className="relative w-full md:w-72">
          <span className="sr-only">Kunden suchen</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-full border border-sand-200 bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="Kunde suchen..."
          />
        </label>
      </div>
      <div className="space-y-4">
        {filteredArchive.map((group) => (
          <div key={group.customer} className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-sand-500">{group.customer}</div>
            {group.reports.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-sand-500">{item.period}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide border px-3 py-1 rounded-full ${statusStyles[item.status]}`}
                  >
                    {item.status}
                  </span>
                  {item.sentAt ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600">
                      <span>Versand</span>
                      {item.sentVia && item.sentVia !== "manuell" ? (
                        <span className="text-sand-900">{item.sentVia}</span>
                      ) : null}
                      {item.sentTo ? <span className="text-sand-500">· {item.sentTo}</span> : null}
                      {item.sentAtText ? <span className="text-sand-500">· {item.sentAtText}</span> : null}
                    </span>
                  ) : null}
                  {item.openedCount ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] uppercase tracking-wide text-emerald-700">
                      <span>Gelesen</span>
                      <span>{item.openedCount}x</span>
                      {item.openedAtText ? (
                        <span className="text-emerald-600">· {item.openedAtText}</span>
                      ) : null}
                    </span>
                  ) : item.sentAt ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600">
                      Gelesen: nein
                    </span>
                  ) : null}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onPreview?.(item)}
                      className="inline-flex items-center justify-center rounded-full border border-sand-300 bg-white p-2 text-sand-600 hover:bg-sand-100"
                      title="Vorschau"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      onClick={() => onEdit?.(item)}
                      className="inline-flex items-center justify-center rounded-full border border-sand-300 bg-white p-2 text-sand-600 hover:bg-sand-100"
                      title="Bearbeiten"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => onExportEmail?.(item)}
                      className="inline-flex items-center justify-center rounded-full border border-sand-300 bg-white p-2 text-sand-600 hover:bg-sand-100"
                      title="E-Mail-Entwurf"
                    >
                      <Mail size={12} />
                    </button>
                    <button
                      onClick={() => onSendSmtp?.(item)}
                      className="inline-flex items-center justify-center rounded-full border border-sand-300 bg-white p-2 text-sand-600 hover:bg-sand-100"
                      title="SMTP senden"
                    >
                      <Mail size={12} />
                    </button>
                    <button
                      onClick={() => onDelete?.(item)}
                      className="inline-flex items-center justify-center rounded-full border border-sand-300 bg-white p-2 text-sand-600 hover:bg-rose-50 hover:text-rose-600"
                      title="Löschen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {!filteredArchive.length && (
          <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-6 text-sm text-sand-600">
            Kein Kunde gefunden.
          </div>
        )}
      </div>
    </div>
  );
}
