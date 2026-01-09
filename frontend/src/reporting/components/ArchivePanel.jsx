import { ClipboardCopy, FileDown, Trash2 } from "lucide-react";
import { statusStyles } from "../constants";

export default function ArchivePanel({ archive, onDelete, onExportHtml, onExportPdf }) {
  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-5 shadow-soft">
      <h3 className="text-lg font-display mb-3">Archiv nach Kunden</h3>
      <div className="space-y-4">
        {archive.map((group) => (
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
      </div>
    </div>
  );
}
