import { Edit3, Eye, Mail, Search, Trash2, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { archiveStatusStyles } from "../constants";

export default function ArchivePanel({
  archive,
  onDelete,
  onExportEmail,
  onPreview,
  onEdit,
  onSendSmtp,
  onUpdateStatus
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [readFilter, setReadFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("");
  const [openInfoId, setOpenInfoId] = useState(null);
  useEffect(() => {
    if (!openInfoId) return;
    const handleClick = (event) => {
      if (event.target.closest?.("[data-info-dropdown]")) return;
      setOpenInfoId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [openInfoId]);
  const beaconStatus = useMemo(() => {
    if (typeof window === "undefined") return { ok: false, label: "Beacon: unbekannt" };
    try {
      const raw = window.localStorage.getItem("qt_smtp_settings_cache");
      if (!raw) return { ok: false, label: "Beacon: nicht gesetzt" };
      const cached = JSON.parse(raw);
      const base = String(cached?.beacon_base_url || "").trim();
      return base
        ? { ok: true, label: "Beacon: konfiguriert" }
        : { ok: false, label: "Beacon: nicht gesetzt" };
    } catch (error) {
      return { ok: false, label: "Beacon: ungültig" };
    }
  }, []);
  const filteredArchive = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const periodNeedle = periodFilter.trim().toLowerCase();
    const matchesStatus = (item) =>
      !statusFilter || String(item.status || "").toLowerCase() === statusFilter.toLowerCase();
    const matchesRead = (item) => {
      if (readFilter === "read") return item.openedCount > 0;
      if (readFilter === "unread") return !item.openedCount;
      return true;
    };
    const matchesPeriod = (item) =>
      !periodNeedle || String(item.period || "").toLowerCase().includes(periodNeedle);

    return archive
      .filter((group) => (needle ? group.customer.toLowerCase().includes(needle) : true))
      .map((group) => ({
        ...group,
        reports: group.reports.filter(
          (item) => matchesStatus(item) && matchesRead(item) && matchesPeriod(item)
        )
      }))
      .filter((group) => group.reports.length);
  }, [archive, query, statusFilter, readFilter, periodFilter]);

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
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600"
        >
          <option value="">Status: alle</option>
          <option value="Grün">Grün</option>
          <option value="Gelb">Gelb</option>
          <option value="Rot">Rot</option>
        </select>
        <select
          value={readFilter}
          onChange={(event) => setReadFilter(event.target.value)}
          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600"
        >
          <option value="all">Gelesen: alle</option>
          <option value="read">Gelesen</option>
          <option value="unread">Ungelesen</option>
        </select>
        <input
          value={periodFilter}
          onChange={(event) => setPeriodFilter(event.target.value)}
          placeholder="Zeitraum filtern..."
          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs"
        />
      </div>
      <div className="space-y-4">
        {filteredArchive.map((group) => (
          <div key={group.customer} className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-sand-500">{group.customer}</div>
            {group.reports.map((item) => (
              <div
                key={item.id}
                className={`relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 ${
                  openInfoId === item.id ? "z-30" : "z-0"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-sand-500">{item.period}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.customerStatus ? (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide border px-3 py-1 rounded-full ${
                        archiveStatusStyles[item.customerStatus]
                      }`}
                    >
                      {item.customerStatus}
                    </span>
                  ) : null}
                  <details
                    className="relative z-40"
                    open={openInfoId === item.id}
                    data-info-dropdown
                  >
                    <summary
                      onClick={(event) => {
                        event.preventDefault();
                        setOpenInfoId((prev) => (prev === item.id ? null : item.id));
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 cursor-pointer list-none hover:bg-sand-100"
                    >
                      <Info size={12} /> Info
                    </summary>
                    <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-sand-200 bg-white p-4 shadow-soft text-xs text-sand-600 z-50">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-sand-400 mb-2">
                        Bericht
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sand-500">Kundenstatus</span>
                          <select
                            value={item.customerStatus || ""}
                            onChange={(event) => onUpdateStatus?.(item, event.target.value)}
                            className="rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-700 focus:outline-none"
                          >
                            <option value="">Offen</option>
                            <option value="Gelesen">Gelesen</option>
                            <option value="Bestätigt">Bestätigt</option>
                            <option value="Abgelehnt">Abgelehnt</option>
                          </select>
                        </div>
                        {item.customerStatus ? (
                          <div
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                              archiveStatusStyles[item.customerStatus]
                            }`}
                          >
                            {item.customerStatus}
                          </div>
                        ) : null}
                        <div className="border-t border-sand-100 pt-2">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-sand-400 mb-2">
                            Versand
                          </div>
                          {item.sentAt ? (
                            <div className="space-y-1">
                              <div>
                                {item.sentVia && item.sentVia !== "manuell" ? item.sentVia : "Manuell"}
                              </div>
                              {item.sentAtText ? <div>{item.sentAtText}</div> : null}
                            </div>
                          ) : (
                            <div className="text-sand-400">Noch nicht gesendet</div>
                          )}
                        </div>
                        <div className="border-t border-sand-100 pt-2">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-sand-400 mb-2">
                            Gelesen
                          </div>
                          {item.openedCount ? (
                            <div className="space-y-1">
                              <div>{item.openedCount}x</div>
                              {item.openedAtText ? <div>Zuletzt: {item.openedAtText}</div> : null}
                            </div>
                          ) : item.sentAt ? (
                            <div className="text-sand-400">Noch nicht geöffnet</div>
                          ) : (
                            <div className="text-sand-400">Nicht gesendet</div>
                          )}
                        </div>
                        <div className="border-t border-sand-100 pt-2">
                          <div className="text-[10px] uppercase tracking-[0.3em] text-sand-400 mb-2">
                            Tracking
                          </div>
                          <div
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                              beaconStatus.ok
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-sand-200 bg-sand-50 text-sand-500"
                            }`}
                          >
                            {beaconStatus.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
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
