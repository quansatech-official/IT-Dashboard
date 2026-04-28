import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  Info,
  Mail,
  Plus,
  Search,
  Send,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { archiveStatusStyles, statusStyles } from "../constants";

const WORKFLOW_FILTERS = [
  { key: "all", label: "Alle" },
  { key: "open", label: "Offen" },
  { key: "unsent", label: "Nicht gesendet" },
  { key: "unread", label: "Ungelesen" },
  { key: "read", label: "Gelesen" },
  { key: "confirmed", label: "Bestätigt" },
  { key: "rejected", label: "Abgelehnt" }
];

const emptyStats = {
  total: 0,
  unsent: 0,
  sentUnread: 0,
  read: 0,
  confirmed: 0,
  rejected: 0
};

const normalizeText = (value) => String(value || "").trim();
const normalizeLower = (value) => normalizeText(value).toLowerCase();
const isConfirmed = (item) => normalizeLower(item?.customerStatus) === "bestätigt";
const isRejected = (item) => normalizeLower(item?.customerStatus) === "abgelehnt";
const isSent = (item) => Boolean(item?.sentAt);
const isRead = (item) =>
  Number(item?.openedCount || 0) > 0 ||
  normalizeLower(item?.customerStatus) === "gelesen" ||
  isConfirmed(item);

const getNextAction = (item) => {
  if (!isSent(item)) {
    return { label: "Senden", tone: "border-amber-200 bg-amber-50 text-amber-700", icon: Send };
  }
  if (isRejected(item)) {
    return { label: "Klären", tone: "border-rose-200 bg-rose-50 text-rose-700", icon: AlertTriangle };
  }
  if (isConfirmed(item)) {
    return { label: "Aufgabe", tone: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: Plus };
  }
  if (!isRead(item)) {
    return { label: "Nachfassen", tone: "border-amber-200 bg-amber-50 text-amber-700", icon: Clock3 };
  }
  return { label: "Rückmeldung offen", tone: "border-sky-200 bg-sky-50 text-sky-700", icon: Clock3 };
};

const reportPriority = (item) => {
  const action = getNextAction(item).label;
  if (action === "Senden") return 0;
  if (action === "Nachfassen") return 1;
  if (action === "Klären") return 2;
  if (action === "Rückmeldung offen") return 3;
  if (action === "Aufgabe") return 4;
  return 5;
};

const getGroupSummary = (reports) => {
  const summary = reports.reduce(
    (acc, item) => {
      if (!isSent(item)) acc.unsent += 1;
      if (isSent(item) && !isRead(item)) acc.unread += 1;
      if (isConfirmed(item)) acc.confirmed += 1;
      if (isRejected(item)) acc.rejected += 1;
      const status = normalizeText(item.status);
      if (status === "Rot") acc.critical = "Rot";
      if (status === "Gelb" && acc.critical !== "Rot") acc.critical = "Gelb";
      if (status === "Grün" && !acc.critical) acc.critical = "Grün";
      if (!acc.latestPeriod && item.period) acc.latestPeriod = item.period;
      return acc;
    },
    { unsent: 0, unread: 0, confirmed: 0, rejected: 0, critical: "", latestPeriod: "" }
  );
  summary.open = summary.unsent + summary.unread + summary.rejected;
  return summary;
};

const matchesWorkflow = (item, workflowFilter) => {
  if (workflowFilter === "unsent") return !isSent(item);
  if (workflowFilter === "unread") return isSent(item) && !isRead(item);
  if (workflowFilter === "read") return isRead(item);
  if (workflowFilter === "confirmed") return isConfirmed(item);
  if (workflowFilter === "rejected") return isRejected(item);
  if (workflowFilter === "open") return !isSent(item) || (isSent(item) && !isRead(item)) || isRejected(item);
  return true;
};

export default function ArchivePanel({
  archive,
  onDelete,
  onExportEmail,
  onPreview,
  onEdit,
  onSendSmtp,
  onTakeAsTask,
  onUpdateStatus
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("open");
  const [periodFilter, setPeriodFilter] = useState("");
  const [hideConfirmed, setHideConfirmed] = useState(false);
  const [openInfoId, setOpenInfoId] = useState(null);
  const [collapsedCustomers, setCollapsedCustomers] = useState(() => new Set());

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

  const flatReports = useMemo(
    () =>
      archive.flatMap((group) =>
        (group.reports || []).map((item) => ({
          ...item,
          customer: item.customer || group.customer
        }))
      ),
    [archive]
  );

  const stats = useMemo(
    () =>
      flatReports.reduce((acc, item) => {
        acc.total += 1;
        if (!isSent(item)) acc.unsent += 1;
        if (isSent(item) && !isRead(item)) acc.sentUnread += 1;
        if (isRead(item)) acc.read += 1;
        if (isConfirmed(item)) acc.confirmed += 1;
        if (isRejected(item)) acc.rejected += 1;
        return acc;
      }, { ...emptyStats }),
    [flatReports]
  );

  const filteredArchive = useMemo(() => {
    const needle = normalizeLower(query);
    const periodNeedle = normalizeLower(periodFilter);
    const matchesStatus = (item) =>
      !statusFilter || normalizeLower(item.status) === normalizeLower(statusFilter);
    const matchesConfirmed = (item) => !hideConfirmed || !isConfirmed(item);
    const matchesPeriod = (item) => !periodNeedle || normalizeLower(item.period).includes(periodNeedle);
    const matchesQuery = (group, item) => {
      if (!needle) return true;
      return [group.customer, item.customer, item.label, item.period, item.status, item.customerStatus]
        .map(normalizeLower)
        .some((value) => value.includes(needle));
    };

    return archive
      .map((group) => {
        const reports = (group.reports || [])
          .filter(
            (item) =>
              matchesStatus(item) &&
              matchesWorkflow(item, workflowFilter) &&
              matchesConfirmed(item) &&
              matchesPeriod(item) &&
              matchesQuery(group, item)
          )
          .slice()
          .sort((a, b) => reportPriority(a) - reportPriority(b));
        return { ...group, reports };
      })
      .filter((group) => group.reports.length)
      .sort((a, b) => {
        const aSummary = getGroupSummary(a.reports);
        const bSummary = getGroupSummary(b.reports);
        return bSummary.open - aSummary.open || a.customer.localeCompare(b.customer, "de");
      });
  }, [archive, query, statusFilter, workflowFilter, hideConfirmed, periodFilter]);

  const filteredCount = filteredArchive.reduce((sum, group) => sum + group.reports.length, 0);

  const toggleCustomer = (customer) => {
    setCollapsedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customer)) next.delete(customer);
      else next.add(customer);
      return next;
    });
  };

  const collapseAll = () => {
    setCollapsedCustomers(new Set(filteredArchive.map((group) => group.customer)));
  };

  const expandAll = () => {
    setCollapsedCustomers(new Set());
  };

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sand-500">Archiv</p>
          <h3 className="mt-0.5 text-xl font-display text-sand-900">Kundenbericht-Archiv</h3>
          <p className="mt-1 text-sm text-sand-600">
            {filteredCount} von {stats.total} Berichten sichtbar.
          </p>
        </div>
        <label className="relative w-full xl:w-96">
          <span className="sr-only">Archiv durchsuchen</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full rounded-xl border border-sand-200 bg-sand-50 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            placeholder="Kunde, Bericht, Zeitraum oder Status suchen..."
          />
        </label>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Gesamt", value: stats.total, tone: "border-sand-200 bg-sand-50 text-sand-900" },
          { label: "Nicht gesendet", value: stats.unsent, tone: "border-amber-200 bg-amber-50 text-amber-800" },
          { label: "Ungelesen", value: stats.sentUnread, tone: "border-amber-200 bg-white text-amber-800" },
          { label: "Gelesen", value: stats.read, tone: "border-sky-200 bg-sky-50 text-sky-800" },
          { label: "Bestätigt", value: stats.confirmed, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
          { label: "Abgelehnt", value: stats.rejected, tone: "border-rose-200 bg-rose-50 text-rose-800" }
        ].map((card) => (
          <div key={card.label} className={`rounded-xl border px-3 py-2 ${card.tone}`}>
            <p className="text-[11px] font-medium text-current opacity-75">{card.label}</p>
            <p className="mt-1 text-lg font-semibold leading-none">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 space-y-3 rounded-2xl border border-sand-200 bg-sand-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {WORKFLOW_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setWorkflowFilter(filter.key)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${
                workflowFilter === filter.key
                  ? "border-sand-900 bg-sand-900 text-white"
                  : "border-sand-200 bg-white text-sand-700 hover:bg-sand-100"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700"
          >
            <option value="">Ampel: alle</option>
            <option value="Grün">Grün</option>
            <option value="Gelb">Gelb</option>
            <option value="Rot">Rot</option>
          </select>
          <input
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
            placeholder="Zeitraum filtern..."
            className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs text-sand-700"
          />
          <label className="flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700">
            <input
              type="checkbox"
              checked={hideConfirmed}
              onChange={(event) => setHideConfirmed(event.target.checked)}
              className="h-3.5 w-3.5 rounded border border-sand-300 text-sand-700"
            />
            Bestätigte ausblenden
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
            >
              Alle öffnen
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs font-medium text-sand-700 hover:bg-sand-100"
            >
              Alle schließen
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredArchive.map((group) => {
          const collapsed = collapsedCustomers.has(group.customer);
          const summary = getGroupSummary(group.reports);
          return (
            <section key={group.customer} className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
              <button
                type="button"
                onClick={() => toggleCustomer(group.customer)}
                className="flex w-full flex-wrap items-center justify-between gap-3 bg-sand-50 px-4 py-3 text-left hover:bg-sand-100"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {collapsed ? <ChevronRight size={16} className="text-sand-500" /> : <ChevronDown size={16} className="text-sand-500" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-sand-900">{group.customer}</p>
                    <p className="mt-0.5 text-[11px] text-sand-600">
                      {group.reports.length} Bericht{group.reports.length === 1 ? "" : "e"}
                      {summary.latestPeriod ? ` · zuletzt ${summary.latestPeriod}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {summary.critical ? (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyles[summary.critical] || "border-sand-200 bg-white text-sand-600"}`}>
                      {summary.critical}
                    </span>
                  ) : null}
                  {summary.unsent ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      {summary.unsent} nicht gesendet
                    </span>
                  ) : null}
                  {summary.unread ? (
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      {summary.unread} ungelesen
                    </span>
                  ) : null}
                  {summary.rejected ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                      {summary.rejected} abgelehnt
                    </span>
                  ) : null}
                  {summary.confirmed ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      {summary.confirmed} bestätigt
                    </span>
                  ) : null}
                </div>
              </button>

              {!collapsed ? (
                <div className="overflow-x-auto">
                  <table className="min-w-[1040px] w-full text-sm">
                    <thead className="border-y border-sand-200 bg-white text-[11px] uppercase tracking-wide text-sand-500">
                      <tr>
                        <th className="px-4 py-2 text-left">Zeitraum</th>
                        <th className="px-4 py-2 text-left">Bericht</th>
                        <th className="px-4 py-2 text-left">Ampel</th>
                        <th className="px-4 py-2 text-left">Versand</th>
                        <th className="px-4 py-2 text-left">Gelesen</th>
                        <th className="px-4 py-2 text-left">Kundenreaktion</th>
                        <th className="px-4 py-2 text-left">Nächste Aktion</th>
                        <th className="px-4 py-2 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sand-200/80">
                      {group.reports.map((item) => {
                        const nextAction = getNextAction(item);
                        const NextIcon = nextAction.icon;
                        return (
                          <tr key={item.id} className={openInfoId === item.id ? "relative z-20 bg-sand-50" : "relative hover:bg-sand-50"}>
                            <td className="px-4 py-3 align-top text-sand-700">{item.period || "ohne Zeitraum"}</td>
                            <td className="px-4 py-3 align-top">
                              <p className="font-semibold text-sand-900">{item.label || "Bericht"}</p>
                              {item.sentTo ? <p className="mt-0.5 text-[11px] text-sand-500">An {item.sentTo}</p> : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {item.status ? (
                                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyles[item.status] || "border-sand-200 bg-white text-sand-600"}`}>
                                  {item.status}
                                </span>
                              ) : (
                                <span className="text-[12px] text-sand-400">Keine Ampel</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {isSent(item) ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                  <CheckCircle2 size={11} /> Gesendet
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sand-500">
                                  <Clock3 size={11} /> Offen
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {isRead(item) ? (
                                <span className="text-sand-800">
                                  {Number(item.openedCount || 0) ? `${item.openedCount}x` : "Gelesen"}
                                </span>
                              ) : isSent(item) ? (
                                <span className="text-amber-700">Noch nicht geöffnet</span>
                              ) : (
                                <span className="text-sand-400">Nicht gesendet</span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <select
                                value={item.customerStatus || ""}
                                onChange={(event) => onUpdateStatus?.(item, event.target.value)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide focus:outline-none ${
                                  item.customerStatus
                                    ? archiveStatusStyles[item.customerStatus] || "border-sand-200 bg-white text-sand-700"
                                    : "border-sand-200 bg-white text-sand-500"
                                }`}
                              >
                                <option value="">Offen</option>
                                <option value="Gelesen">Gelesen</option>
                                <option value="Bestätigt">Bestätigt</option>
                                <option value="Abgelehnt">Abgelehnt</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${nextAction.tone}`}>
                                <NextIcon size={11} /> {nextAction.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center justify-end gap-1">
                                {isConfirmed(item) ? (
                                  <button
                                    onClick={() => onTakeAsTask?.(item)}
                                    className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100"
                                    title="Als Aufgabe übernehmen"
                                  >
                                    <Plus size={12} />
                                  </button>
                                ) : null}
                                <details className="relative z-40" open={openInfoId === item.id} data-info-dropdown>
                                  <summary
                                    onClick={(event) => {
                                      event.preventDefault();
                                      setOpenInfoId((prev) => (prev === item.id ? null : item.id));
                                    }}
                                    className="inline-flex cursor-pointer list-none items-center justify-center rounded-full border border-sand-300 bg-white p-2 text-sand-600 hover:bg-sand-100"
                                    title="Details"
                                  >
                                    <Info size={12} />
                                  </summary>
                                  <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-sand-200 bg-white p-4 text-xs text-sand-600 shadow-soft">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sand-500">Details</p>
                                    <div className="mt-3 space-y-2">
                                      <div className="flex justify-between gap-4">
                                        <span className="text-sand-500">Versandweg</span>
                                        <span className="text-right text-sand-800">{item.sentVia || "n/a"}</span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-sand-500">Gesendet</span>
                                        <span className="text-right text-sand-800">{item.sentAtText || "Noch nicht gesendet"}</span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-sand-500">Zuletzt gelesen</span>
                                        <span className="text-right text-sand-800">{item.openedAtText || "Noch nicht geöffnet"}</span>
                                      </div>
                                      <div className="flex justify-between gap-4">
                                        <span className="text-sand-500">Öffnungen</span>
                                        <span className="text-right text-sand-800">{Number(item.openedCount || 0)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </details>
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
                                  <Send size={12} />
                                </button>
                                <button
                                  onClick={() => onDelete?.(item)}
                                  className="inline-flex items-center justify-center rounded-full border border-sand-300 bg-white p-2 text-sand-600 hover:bg-rose-50 hover:text-rose-600"
                                  title="Löschen"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          );
        })}
        {!filteredArchive.length ? (
          <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-6 text-sm text-sand-600">
            Keine Berichte für die aktuellen Filter gefunden.
          </div>
        ) : null}
      </div>
    </div>
  );
}
