import { ClipboardCopy, FileDown, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { statusStyles } from "../constants";

export default function ArchivePanel({ archive, onDelete, onExportHtml, onExportPdf }) {
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
                  <button
                    onClick={() => onExportHtml?.(item)}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <ClipboardCopy size={12} /> HTML
                  </button>
                  <button
                    onClick={() => onExportPdf?.(item)}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <FileDown size={12} /> PDF
                  </button>
                  <button
                    onClick={() => onDelete?.(item)}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={12} /> Löschen
                  </button>
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
