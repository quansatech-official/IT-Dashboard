import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PhoneOutgoing,
  BookPlus,
  Users,
  Phone,
  Cloud,
  PhoneMissed,
  PhoneIncoming,
  ChevronLeft,
  ChevronRight as ChevronRightIcon
} from "lucide-react";

const formatTime = (timestamp) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Heute";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
};

const formatDuration = (seconds) => {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");
const PBX_NAME_LIMIT = 40;

const normalizePbxName = (value) => String(value || "").replace(/\s+/g, " ").trim();

const shortenPbxName = (value, limit = PBX_NAME_LIMIT) => {
  const cleaned = normalizePbxName(value);
  if (!cleaned) return "";
  if (cleaned.length <= limit) return cleaned;
  const stripped = cleaned
    .replace(/\b(gmbh\s*&\s*co\.?\s*kg|gmbh\s*&\s*co\.?|gmbh|ag|kg|mbh|inc\.?|ltd\.?|llc|e\.?u\.?|og|e\.?k\.?)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+&\s+/g, " und ")
    .trim();
  if (stripped && stripped.length <= limit) return stripped;
  return cleaned.slice(0, limit).trim();
};

const normalizeDuration = (value) => {
  if (value === undefined || value === null) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric > 86400) return Math.floor(numeric / 1000);
  return Math.floor(numeric);
};

const shouldUseLiveDuration = (call) => {
  const start = Number(call?.startTime || 0);
  const end = Number(call?.endTime || 0);
  if (!call?.answered || !start) return false;
  if (end && end >= start) return false;
  if (normalizeDuration(call?.duration) > 0) return false;
  const ageMs = Date.now() - start;
  return ageMs >= 0 && ageMs <= 4 * 60 * 60 * 1000;
};

const durationSeconds = (call) => {
  const duration = normalizeDuration(call?.duration);
  if (duration) return duration;
  const start = Number(call?.startTime || 0);
  const end = Number(call?.endTime || 0);
  if (start && end && end >= start) return Math.floor((end - start) / 1000);
  if (shouldUseLiveDuration(call)) return Math.floor((Date.now() - start) / 1000);
  return 0;
};

export default function CallListView({
  calls,
  extensions,
  customers = [],
  pbxEntries = [],
  pbxApiActive = false,
  loading = false,
  onCallback,
  onResolve,
  onResolveCallback,
  onAssignNumber,
  onAddToPbx
}) {
  const pageSize = 15;
  const [page, setPage] = useState(1);
  const [callbackTarget, setCallbackTarget] = useState(null);
  const [selectedExtension, setSelectedExtension] = useState("");
  const [callbackStatus, setCallbackStatus] = useState("");
  const [resolvedNames, setResolvedNames] = useState({});
  const [callFilter, setCallFilter] = useState("all");
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignStatus, setAssignStatus] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [pbxEditTarget, setPbxEditTarget] = useState(null);
  const [pbxEditName, setPbxEditName] = useState("");
  const [pbxEditError, setPbxEditError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  const displayNumber = (call) => {
    const direction = call.direction?.toLowerCase();
    if (direction?.includes("out")) return call.to || call.from || "-";
    return call.from || call.to || "-";
  };

  const assignNumber = (call) => {
    const number = displayNumber(call);
    if (!number || number === "-") return "";
    return number;
  };

  const resolveNumber = (call) => {
    if (call.customerName) return "";
    return displayNumber(call);
  };

  const resolveKey = (call) => {
    const number = resolveNumber(call);
    if (!number) return "";
    return normalizeDigits(number) || number;
  };

  const callbackNumber = (call) => {
    const direction = call.direction?.toLowerCase();
    if (direction?.includes("out")) return call.to || "";
    return call.from || "";
  };

  const outboundByNumber = useMemo(() => {
    const map = new Map();
    calls.forEach((call) => {
      const direction = call.direction?.toLowerCase() || "";
      if (!direction.includes("out")) return;
      const number = normalizeDigits(call.to || call.from || "");
      if (!number) return;
      const ts = call.startTime || 0;
      if (ts > (map.get(number) || 0)) map.set(number, ts);
    });
    return map;
  }, [calls]);

  const isUnreturned = (call) => {
    if (call.answered || call.callbackResolved) return false;
    const direction = call.direction?.toLowerCase() || "";
    if (direction.includes("out")) return false;
    const number = normalizeDigits(call.from || call.to || "");
    if (!number) return false;
    const lastOut = outboundByNumber.get(number) || 0;
    return !lastOut || lastOut < (call.startTime || 0);
  };

  const missedCount = useMemo(() => calls.filter((call) => !call.answered).length, [calls]);
  const openCallbackCount = useMemo(() => calls.filter((call) => isUnreturned(call)).length, [calls, outboundByNumber]);

  const filteredCalls = useMemo(() => {
    if (callFilter === "missed") return calls.filter((call) => !call.answered);
    if (callFilter === "callbacks") return calls.filter((call) => isUnreturned(call));
    return calls;
  }, [calls, callFilter, outboundByNumber]);

  const totalPages = Math.max(1, Math.ceil(filteredCalls.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const pagedCalls = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCalls.slice(start, start + pageSize);
  }, [filteredCalls, page]);

  const extensionOptions = Array.isArray(extensions) ? extensions : [];

  const assignCandidates = useMemo(() => {
    const needle = assignQuery.trim().toLowerCase();
    const list = Array.isArray(customers) ? customers : [];
    if (!needle) return list.slice(0, 12);
    return list.filter((customer) => {
      const name = String(customer?.name || "").toLowerCase();
      const code = String(customer?.short_code || "").toLowerCase();
      const creditor = String(customer?.creditor_number || "").toLowerCase();
      return name.includes(needle) || code.includes(needle) || creditor.includes(needle);
    }).slice(0, 12);
  }, [customers, assignQuery]);

  const customerMatches = useMemo(() => {
    const map = new Map();
    (Array.isArray(customers) ? customers : []).forEach((customer) => {
      const name = customer?.name || "";
      (Array.isArray(customer?.phones) ? customer.phones : []).forEach((phone) => {
        const number = normalizeDigits(phone?.number || "");
        if (number && name) map.set(number, name);
      });
    });
    return map;
  }, [customers]);

  const pbxMatches = useMemo(() => {
    const map = new Map();
    pbxEntries.forEach((entry) => {
      const number = normalizeDigits(entry?.number || "");
      if (number) map.set(number, entry);
    });
    return map;
  }, [pbxEntries]);

  useEffect(() => {
    if (!assignTarget) return;
    setAssignQuery("");
    setAssignStatus("");
    setAssignBusy(false);
  }, [assignTarget]);

  useEffect(() => {
    if (!pbxEditTarget) return;
    setPbxEditName(pbxEditTarget?.suggestedName || pbxEditTarget?.name || "");
    setPbxEditError(
      pbxEditTarget?.reason === "length"
        ? `Name zu lang (max. ${PBX_NAME_LIMIT} Zeichen).`
        : pbxEditTarget?.reason === "missing"
          ? "Bitte Namen eintragen."
          : ""
    );
  }, [pbxEditTarget]);

  useEffect(() => {
    let active = true;
    const lookup = async () => {
      if (!onResolve) return;
      const pending = new Map();
      for (const call of pagedCalls) {
        const number = resolveNumber(call);
        const key = resolveKey(call);
        if (!number || !key || resolvedNames[key]) continue;
        if (pending.has(key)) continue;
        pending.set(key, number);
      }
      if (!pending.size) return;
      const entries = Array.from(pending.entries());
      const results = await Promise.allSettled(entries.map(([, number]) => onResolve(number)));
      if (!active) return;
      const next = {};
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const name = result.value?.name || "";
        if (name) next[entries[index][0]] = name;
      });
      if (Object.keys(next).length) setResolvedNames((prev) => ({ ...prev, ...next }));
    };
    lookup();
    return () => { active = false; };
  }, [pagedCalls, resolvedNames, onResolve]);

  const customerNameForCall = (call) => {
    const key = resolveKey(call);
    return key ? customerMatches.get(key) : "";
  };

  const pbxEntryForCall = (call) => {
    const key = resolveKey(call);
    return key ? pbxMatches.get(key) : null;
  };

  const resolvedNameForCall = (call) => {
    const key = resolveKey(call);
    return key ? resolvedNames[key] : "";
  };

  const callerName = (call) =>
    call.customerName || customerNameForCall(call) || resolvedNameForCall(call) || pbxEntryForCall(call)?.name || "";

  const nameSourceForCall = (call) => {
    if (call.customerName || customerNameForCall(call)) return { label: "Kundenstamm", Icon: Users };
    if (resolvedNameForCall(call)) return { label: "API", Icon: Cloud };
    if (pbxEntryForCall(call)?.name) return { label: "Telefonbuch", Icon: Phone };
    return null;
  };

  const handleAddToPbx = async (payload) => {
    if (!onAddToPbx) return;
    const rawName = normalizePbxName(payload?.name || "");
    const number = String(payload?.number || "").trim();
    if (!rawName) {
      setPbxEditTarget({ name: "", suggestedName: "", originalName: "", number, reason: "missing" });
      return;
    }
    if (rawName && rawName.length > PBX_NAME_LIMIT) {
      const suggestion = shortenPbxName(rawName, PBX_NAME_LIMIT);
      setPbxEditTarget({ name: suggestion, suggestedName: suggestion, originalName: rawName, number, reason: "length" });
      return;
    }
    try {
      await Promise.resolve(onAddToPbx({ ...payload, name: rawName, number }));
      setToast("Im Telefonbuch gespeichert.");
    } catch {
      setToast("Telefonbuch-Übernahme fehlgeschlagen.");
      setPbxEditTarget({ name: rawName || "", suggestedName: shortenPbxName(rawName || "", PBX_NAME_LIMIT), originalName: rawName || "", number, reason: "error" });
    }
  };

  const handlePbxManualSave = async () => {
    if (!onAddToPbx || !pbxEditTarget?.number) return;
    const trimmed = pbxEditName.trim();
    if (!trimmed) { setPbxEditError("Name fehlt."); return; }
    if (trimmed.length > PBX_NAME_LIMIT) { setPbxEditError(`Name zu lang (max. ${PBX_NAME_LIMIT} Zeichen).`); return; }
    setPbxEditError("");
    try {
      await Promise.resolve(onAddToPbx({ name: trimmed, number: pbxEditTarget.number }));
      setToast("Im Telefonbuch gespeichert.");
      setPbxEditTarget(null);
    } catch {
      setPbxEditError("Speichern fehlgeschlagen. Bitte Namen kürzen.");
    }
  };

  const customerHasNumber = (customer, number) => {
    const target = normalizeDigits(number);
    if (!target) return false;
    return (Array.isArray(customer?.phones) ? customer.phones : []).some(
      (phone) => normalizeDigits(phone?.number) === target
    );
  };

  return (
    <>
      {toast ? (
        <div className="fixed top-5 right-6 z-50 rounded-full border border-sand-700 bg-sand-900 px-4 py-2 text-xs font-medium uppercase tracking-wide text-white shadow-soft">
          {toast}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
        {/* Header */}
        <div className="border-b border-sand-100 bg-sand-50/60 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sand-500">Live</p>
              <h2 className="text-xl font-display text-sand-900">Anrufliste</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "Alle", count: calls.length, Icon: PhoneIncoming, activeClass: "border-sand-900 bg-sand-900 text-white", inactiveClass: "border-sand-200 bg-white text-sand-600 hover:bg-sand-50", countClass: "bg-sand-100 text-sand-500" },
                { key: "missed", label: "Verpasst", count: missedCount, Icon: PhoneMissed, activeClass: "border-rose-600 bg-rose-600 text-white", inactiveClass: "border-sand-200 bg-white text-sand-600 hover:bg-sand-50", countClass: "bg-rose-50 text-rose-600" },
                { key: "callbacks", label: "Offene Rückrufe", count: openCallbackCount, Icon: PhoneOutgoing, activeClass: "border-amber-600 bg-amber-600 text-white", inactiveClass: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100", countClass: "bg-amber-100 text-amber-700" }
              ].map((filter) => {
                const active = callFilter === filter.key;
                const Icon = filter.Icon;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => { setCallFilter(filter.key); setPage(1); }}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                      active ? filter.activeClass : filter.inactiveClass
                    }`}
                  >
                    <Icon size={12} />
                    {filter.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : filter.countClass}`}>
                      {filter.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-px p-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="flex gap-3 rounded-xl bg-sand-50 px-4 py-3 animate-pulse">
                <div className="h-3 w-16 rounded-full bg-sand-200" />
                <div className="h-3 w-24 rounded-full bg-sand-200" />
                <div className="h-3 w-28 rounded-full bg-sand-200" />
                <div className="h-3 flex-1 rounded-full bg-sand-200" />
              </div>
            ))}
          </div>
        ) : null}

        {/* Call rows */}
        <div>
          {filteredCalls.length > 0 && !loading ? (
            <div className="hidden border-b border-sand-200 bg-white px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sand-400 sm:grid sm:grid-cols-[40px_minmax(0,1.5fr)_86px_78px_72px_96px] sm:items-center sm:gap-3 md:grid-cols-[40px_minmax(140px,1fr)_86px_82px_64px_104px_94px] lg:grid-cols-[40px_minmax(0,1.35fr)_96px_92px_78px_124px_96px]">
              <span />
              <span>Kontakt</span>
              <span>Zeit</span>
              <span>Nebenstelle</span>
              <span className="text-right">Dauer</span>
              <span className="hidden text-right md:block">Status</span>
              <span className="text-right">Aktion</span>
            </div>
          ) : null}
          {filteredCalls.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-sand-400">
              <PhoneIncoming size={24} className="text-sand-300" />
              {callFilter === "callbacks"
                ? "Keine offenen Rückrufe."
                : callFilter === "missed"
                  ? "Keine verpassten Anrufe."
                  : "Noch keine Telefonie-Events geladen."}
            </div>
          ) : (
            pagedCalls.map((call) => {
              const unreturned = isUnreturned(call);
              const name = callerName(call);
              const source = nameSourceForCall(call);
              const direction = call.direction?.toLowerCase() || "";
              const isInbound = direction.includes("in");
              const isOutbound = direction.includes("out");
              const dur = durationSeconds(call);
              const rowTone = unreturned
                ? "border-l-amber-400 bg-amber-50/65 hover:bg-amber-50"
                : !call.answered
                  ? "border-l-rose-300 bg-white hover:bg-rose-50/35"
                  : "border-l-transparent bg-white hover:bg-sand-50";
              const primaryLabel = name || displayNumber(call);
              const secondaryLabel = name ? displayNumber(call) : isInbound ? "Eingehender Anruf" : isOutbound ? "Ausgehender Anruf" : "Anruf";
              const statusLabel = unreturned
                ? "Rückruf offen"
                : call.callbackResolved
                  ? "Rückruf erledigt"
                  : call.answered ? "Beantwortet" : "Verpasst";
              const statusClass = unreturned
                ? "border-amber-300 bg-amber-100 text-amber-800"
                : call.callbackResolved
                  ? "border-sky-200 bg-sky-50 text-sky-700"
                  : call.answered
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700";

              return (
                <div
                  key={call.uuid}
                  className={`grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-l-4 border-b border-sand-100 px-5 py-3 transition last:border-b-0 sm:grid-cols-[40px_minmax(0,1.5fr)_86px_78px_72px_96px] md:grid-cols-[40px_minmax(140px,1fr)_86px_82px_64px_104px_94px] lg:grid-cols-[40px_minmax(0,1.35fr)_96px_92px_78px_124px_96px] ${rowTone}`}
                >
                  {/* Direction icon */}
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    call.answered
                      ? isInbound ? "bg-emerald-50 text-emerald-600" : "bg-sand-100 text-sand-500"
                      : "bg-rose-50 text-rose-500"
                  }`}>
                    {isInbound ? <ArrowDownLeft size={15} /> : isOutbound ? <ArrowUpRight size={15} /> : <Phone size={15} />}
                  </div>

                  {/* Number + name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className={`truncate text-sm font-semibold ${unreturned ? "text-amber-900" : "text-sand-900"}`}>
                        {primaryLabel}
                      </span>
                      {source ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-1.5 py-0.5 text-[10px] text-sand-500" title={`Name aus ${source.label}`}>
                          <source.Icon size={10} />
                        </span>
                      ) : null}
                      {unreturned ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!onResolveCallback) return;
                            const updated = await onResolveCallback(call);
                            setToast(updated ? "Rückruf erledigt." : "Status konnte nicht gespeichert werden.");
                          }}
                          className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 hover:bg-amber-200"
                        >
                          Rückruf offen
                        </button>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-sand-500">{secondaryLabel}</p>
                  </div>

                  {/* Date/time */}
                  <div className="hidden shrink-0 sm:block">
                    <p className="text-[11px] font-medium text-sand-700">{formatDate(call.startTime)}</p>
                    <p className="text-[10px] text-sand-400">{formatTime(call.startTime)}</p>
                  </div>

                  {/* Extension */}
                  {call.extension ? (
                    <span className="hidden w-fit shrink-0 rounded-lg border border-sand-200 bg-sand-50 px-2 py-0.5 text-[11px] text-sand-600 sm:block">
                      NS {call.extension}
                    </span>
                  ) : (
                    <span className="hidden text-[11px] text-sand-300 sm:block">-</span>
                  )}

                  {/* Duration */}
                  <span className="hidden shrink-0 text-right text-[11px] text-sand-400 sm:block">
                    {formatDuration(dur)}
                  </span>

                  {/* Status */}
                  <div className="hidden min-w-0 justify-end md:flex">
                    <span className={`inline-flex max-w-full shrink-0 justify-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center justify-end gap-1">
                    {assignNumber(call) && !pbxEntryForCall(call) && onAddToPbx ? (
                      <button
                        onClick={() => handleAddToPbx({ name: name || "", number: assignNumber(call) })}
                        disabled={!pbxApiActive}
                        className={`rounded-lg border p-1.5 text-sand-600 ${
                          pbxApiActive ? "border-sand-200 bg-white hover:bg-sand-100" : "cursor-not-allowed border-sand-100 bg-sand-50 opacity-40"
                        }`}
                        title="In Telefonbuch übernehmen"
                      >
                        <BookPlus size={13} />
                      </button>
                    ) : null}
                    {assignNumber(call) && !call.customerName && !customerNameForCall(call) ? (
                      <button
                        onClick={() => setAssignTarget(call)}
                        className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-700 hover:bg-amber-100"
                        title="Kunde zuweisen"
                      >
                        <ArrowDownLeft size={13} />
                      </button>
                    ) : null}
                    {callbackNumber(call) ? (
                      <button
                        onClick={() => {
                          setCallbackTarget(call);
                          setSelectedExtension(extensionOptions[0]?.extension_number || "");
                          setCallbackStatus("");
                        }}
                        className="rounded-lg border border-sand-200 bg-white p-1.5 text-sand-600 hover:bg-sand-100"
                        title="Rückruf starten"
                      >
                        <PhoneOutgoing size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-sand-100 px-5 py-3 text-xs text-sand-500">
            <span>{filteredCalls.length} Einträge · Seite {page} von {totalPages}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-sand-200 p-1.5 hover:bg-sand-50 disabled:opacity-40"
              >
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`rounded-lg border px-2.5 py-1 ${
                      page === pageNum ? "border-sand-900 bg-sand-900 text-white" : "border-sand-200 hover:bg-sand-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-sand-200 p-1.5 hover:bg-sand-50 disabled:opacity-40"
              >
                <ChevronRightIcon size={13} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Callback modal */}
      {callbackTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-sand-900/40 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-100 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Rückruf starten</p>
              <h3 className="text-lg font-display text-sand-900">{callbackNumber(callbackTarget) || "Nummer unbekannt"}</h3>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-sand-500">Nebenstelle</label>
                <select
                  value={selectedExtension}
                  onChange={(e) => setSelectedExtension(e.target.value)}
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                >
                  {extensionOptions.length ? (
                    extensionOptions.map((item) => (
                      <option key={item.uuid || item.extension_number} value={item.extension_number}>
                        {item.extension_number}{item.name ? ` – ${item.name}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">Keine Nebenstellen</option>
                  )}
                </select>
              </div>
              {callbackStatus ? <p className="text-xs text-sand-500">{callbackStatus}</p> : null}
              <div className="flex items-center justify-between">
                <button onClick={() => setCallbackTarget(null)} className="rounded-xl border border-sand-200 px-4 py-2 text-xs text-sand-600 hover:bg-sand-50">Abbrechen</button>
                <button
                  onClick={async () => {
                    if (!selectedExtension) { setCallbackStatus("Bitte Nebenstelle wählen."); return; }
                    const number = callbackNumber(callbackTarget);
                    if (!number) { setCallbackStatus("Keine Rufnummer gefunden."); return; }
                    setCallbackStatus("Rückruf wird gestartet…");
                    const result = await onCallback?.(selectedExtension, number);
                    if (result) { setCallbackStatus("Rückruf gestartet."); setTimeout(() => setCallbackTarget(null), 900); }
                    else setCallbackStatus("Rückruf fehlgeschlagen.");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sand-900 px-4 py-2 text-xs font-medium text-white hover:bg-sand-800"
                >
                  <PhoneOutgoing size={13} />
                  Jetzt anrufen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Assign customer modal */}
      {assignTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-sand-900/40 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-100 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Kunde zuweisen</p>
              <h3 className="text-lg font-display text-sand-900">{assignNumber(assignTarget) || "Nummer unbekannt"}</h3>
            </div>
            <div className="space-y-4 p-5">
              <input
                value={assignQuery}
                onChange={(e) => setAssignQuery(e.target.value)}
                className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                placeholder="Name, Kürzel, Kundennummer…"
              />
              <div className="max-h-56 space-y-1.5 overflow-auto">
                {assignCandidates.length ? assignCandidates.map((customer) => {
                  const hasNumber = customerHasNumber(customer, assignNumber(assignTarget));
                  return (
                    <div key={customer.id} className="flex items-center justify-between rounded-xl border border-sand-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-sand-900">{customer.name}</p>
                        <p className="text-[10px] text-sand-400">{customer.short_code || customer.creditor_number || "—"}</p>
                      </div>
                      <button
                        type="button"
                        disabled={assignBusy || hasNumber}
                        onClick={async () => {
                          const number = assignNumber(assignTarget);
                          if (!number || !onAssignNumber) { setAssignStatus("Aktion nicht verfügbar."); return; }
                          setAssignBusy(true);
                          setAssignStatus("Speichere…");
                          const result = await onAssignNumber(customer.id, number);
                          if (result?.ok) {
                            setResolvedNames((prev) => ({ ...prev, [number]: result.customer?.name || customer.name }));
                            setAssignStatus("Rufnummer übernommen.");
                            setTimeout(() => setAssignTarget(null), 900);
                          } else {
                            setAssignStatus(result?.error || "Übernahme fehlgeschlagen.");
                          }
                          setAssignBusy(false);
                        }}
                        className={`rounded-xl border px-3 py-1 text-[11px] font-medium ${
                          hasNumber
                            ? "cursor-not-allowed border-sand-200 text-sand-400"
                            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        {hasNumber ? "Vorhanden" : "Übernehmen"}
                      </button>
                    </div>
                  );
                }) : (
                  <p className="py-3 text-center text-xs text-sand-400">Kein Kunde gefunden.</p>
                )}
              </div>
              {assignStatus ? <p className="text-xs text-sand-500">{assignStatus}</p> : null}
              <button onClick={() => setAssignTarget(null)} className="w-full rounded-xl border border-sand-200 py-2 text-xs text-sand-600 hover:bg-sand-50">Schließen</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* PBX name edit modal */}
      {pbxEditTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-sand-900/40 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-100 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Anlagentelefonbuch</p>
              <h3 className="text-lg font-display text-sand-900">
                {pbxEditTarget?.reason === "missing" ? "Name eintragen" : "Name kürzen"}
              </h3>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-sand-500">Rufnummer</label>
                <input value={pbxEditTarget.number} readOnly className="w-full rounded-xl border border-sand-100 bg-sand-50 px-3 py-2 text-sm text-sand-600" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-sand-500">Name</label>
                <input
                  value={pbxEditName}
                  onChange={(e) => { setPbxEditName(e.target.value); setPbxEditError(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePbxManualSave();
                  }}
                  autoFocus
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              {pbxEditTarget?.originalName && pbxEditTarget?.suggestedName && pbxEditTarget.originalName !== pbxEditTarget.suggestedName ? (
                <p className="text-xs text-sand-500">Vorschlag: <span className="font-medium">{pbxEditTarget.suggestedName}</span></p>
              ) : null}
              {pbxEditError ? (
                <p className="text-xs text-rose-600">{pbxEditError}</p>
              ) : (
                <p className="text-xs text-sand-400">Max. {PBX_NAME_LIMIT} Zeichen.</p>
              )}
              <div className="flex items-center justify-between">
                <button onClick={() => setPbxEditTarget(null)} className="rounded-xl border border-sand-200 px-4 py-2 text-xs text-sand-600 hover:bg-sand-50">Abbrechen</button>
                <button onClick={handlePbxManualSave} className="rounded-xl bg-sand-900 px-4 py-2 text-xs font-medium text-white hover:bg-sand-800">Speichern</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
