import { useMemo } from "react";
import { PhoneMissed, PhoneCall, PhoneIncoming, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const formatDurationHms = (seconds) => {
  if (!seconds) return "0:00:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const normalizeNumber = (value) => String(value || "").replace(/\D/g, "");

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
  const duration = normalizeDuration(call.duration);
  if (duration) return duration;
  const start = Number(call?.startTime || 0);
  const end = Number(call?.endTime || 0);
  if (start && end && end >= start) return Math.floor((end - start) / 1000);
  if (shouldUseLiveDuration(call)) return Math.floor((Date.now() - start) / 1000);
  return 0;
};

function AnsweredBar({ answered, total }) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] text-sand-500">Annahmequote</span>
        <span className={`text-[11px] font-semibold ${pct >= 80 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-rose-700"}`}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-100">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PeriodCard({ label, data }) {
  const d = data || { total: 0, answered: 0, missed: 0, avgDuration: 0 };
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-sand-500">{label}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
          <p className="text-[11px] text-sand-400">Gesamt</p>
          <p className="text-2xl font-bold text-sand-900 leading-tight">{d.total}</p>
        </div>
        <div>
          <p className="text-[11px] text-sand-400">Ø Dauer</p>
          <p className="text-2xl font-bold text-sand-700 leading-tight">{formatDuration(d.avgDuration)}</p>
        </div>
        <div>
          <p className="text-[11px] text-sand-400">Beantwortet</p>
          <p className="text-xl font-semibold text-emerald-600 leading-tight">{d.answered}</p>
        </div>
        <div>
          <p className="text-[11px] text-sand-400">Verpasst</p>
          <p className="text-xl font-semibold text-rose-600 leading-tight">{d.missed}</p>
        </div>
      </div>
      <AnsweredBar answered={d.answered} total={d.total} />
      {d.totalDuration > 0 ? (
        <p className="mt-2 text-[10px] text-sand-400">Gesamtdauer: {formatDurationHms(d.totalDuration)}</p>
      ) : null}
    </div>
  );
}

export default function CallStatsView({ stats, calls = [], customers = [], pbxEntries = [] }) {
  const periods = [
    { key: "today", label: "Heute" },
    { key: "last7d", label: "Letzte 7 Tage" },
    { key: "currentMonth", label: "Aktueller Monat" }
  ];

  const safeStats = stats || {};
  const extensionStats = safeStats.byExtension || [];

  const customerMatches = useMemo(() => {
    const map = new Map();
    (Array.isArray(customers) ? customers : []).forEach((customer) => {
      const name = customer?.name || "";
      (Array.isArray(customer?.phones) ? customer.phones : []).forEach((phone) => {
        const number = normalizeNumber(phone?.number || "");
        if (number && name) map.set(number, name);
      });
    });
    return map;
  }, [customers]);

  const pbxMatches = useMemo(() => {
    const map = new Map();
    (Array.isArray(pbxEntries) ? pbxEntries : []).forEach((entry) => {
      const number = normalizeNumber(entry?.number || "");
      if (number) map.set(number, entry?.name || "");
    });
    return map;
  }, [pbxEntries]);

  const outboundByNumber = useMemo(() => {
    const map = new Map();
    (Array.isArray(calls) ? calls : []).forEach((call) => {
      const direction = call.direction?.toLowerCase() || "";
      if (!direction.includes("out")) return;
      const number = normalizeNumber(call.to || call.from || "");
      if (!number) return;
      const ts = call.startTime || 0;
      if (ts > (map.get(number) || 0)) map.set(number, ts);
    });
    return map;
  }, [calls]);

  const unreturnedCount = useMemo(() => {
    return (Array.isArray(calls) ? calls : []).filter((call) => {
      if (call.answered || call.callbackResolved) return false;
      const direction = call.direction?.toLowerCase() || "";
      if (direction.includes("out")) return false;
      const number = normalizeNumber(call.from || call.to || "");
      if (!number) return false;
      const lastOut = outboundByNumber.get(number) || 0;
      return !lastOut || lastOut < (call.startTime || 0);
    }).length;
  }, [calls, outboundByNumber]);

  const topTargets = useMemo(() => {
    const counts = new Map();
    const seenByNumber = new Map();
    const labels = new Map();
    (Array.isArray(calls) ? calls.slice(0, 100) : []).forEach((call) => {
      const direction = call.direction?.toLowerCase() || "";
      if (direction.includes("out")) return;
      const rawNumber = call.from || call.to;
      const normalized = normalizeNumber(rawNumber);
      if (!normalized) return;
      const safeNumber = rawNumber ? String(rawNumber) : normalized;
      const name = call.customerName || customerMatches.get(normalized) || pbxMatches.get(normalized) || "";
      const nextLabel = name ? `${name} · ${safeNumber}` : safeNumber;
      const uniqueId = call.uuid || `${call.startTime || ""}-${call.direction || ""}-${call.extension || ""}-${normalized}`;
      const seen = seenByNumber.get(normalized) || new Set();
      if (!seen.has(uniqueId)) {
        seen.add(uniqueId);
        seenByNumber.set(normalized, seen);
        const current = counts.get(normalized) || { count: 0, duration: 0 };
        counts.set(normalized, { count: current.count + 1, duration: current.duration + durationSeconds(call) });
      }
      const currentLabel = labels.get(normalized);
      if (!currentLabel || (name && !currentLabel.includes("·"))) labels.set(normalized, nextLabel);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, payload]) => ({ label: labels.get(key) || key, count: payload.count, duration: payload.duration }));
  }, [calls, customerMatches, pbxMatches]);

  const todayData = safeStats.today || { total: 0, answered: 0, missed: 0 };
  const answeredPct = todayData.total > 0 ? Math.round((todayData.answered / todayData.total) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      <div className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${
        unreturnedCount > 0
          ? "border-amber-200 bg-amber-50"
          : "border-emerald-200 bg-emerald-50"
      }`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          unreturnedCount > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
        }`}>
          {unreturnedCount > 0 ? <PhoneMissed size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-2xl font-bold leading-none ${unreturnedCount > 0 ? "text-amber-800" : "text-emerald-700"}`}>
            {unreturnedCount > 0 ? `${unreturnedCount} offene Rückrufe` : "Keine offenen Rückrufe"}
          </p>
          <p className={`mt-1 text-xs ${unreturnedCount > 0 ? "text-amber-700" : "text-emerald-600"}`}>
            {unreturnedCount > 0
              ? "Eingehende Anrufe ohne Antwort oder erfassten Rückruf."
              : "Alle eingehenden Anrufe beantwortet oder zurückgerufen."}
          </p>
        </div>
        {answeredPct !== null ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-sand-500">Heute</p>
            <p className={`text-lg font-bold ${answeredPct >= 80 ? "text-emerald-700" : answeredPct >= 60 ? "text-amber-700" : "text-rose-700"}`}>
              {answeredPct}% angenommen
            </p>
          </div>
        ) : null}
      </div>

      {/* Period stat cards */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {periods.map((period) => (
          <PeriodCard key={period.key} label={period.label} data={safeStats[period.key]} />
        ))}
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Extension breakdown */}
        <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
          <div className="border-b border-sand-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-sand-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sand-500">Nebenstellen · 7 Tage</p>
            </div>
          </div>
          <div className="p-3">
            {extensionStats.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs text-sand-400">
                <PhoneCall size={14} />
                <span>Keine Daten vorhanden.</span>
              </div>
            ) : (
              <div className="space-y-1">
                {extensionStats.map((row) => (
                  <div key={row.key} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 rounded-xl px-3 py-2 hover:bg-sand-50 text-xs">
                    <span className="truncate font-medium text-sand-800">{row.key}</span>
                    <span className="text-sand-500">{row.total}x</span>
                    <span className="text-emerald-600">{row.answered} ✓</span>
                    <span className="text-rose-600">{row.missed} ✗</span>
                    <span className="text-sand-400">{formatDuration(row.avgDuration)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top callers */}
        <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
          <div className="border-b border-sand-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <PhoneIncoming size={14} className="text-sand-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sand-500">Top Anrufer · letzte 100</p>
            </div>
          </div>
          <div className="p-3">
            {topTargets.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-xs text-sand-400">
                <PhoneCall size={14} />
                <span>Keine Daten vorhanden.</span>
              </div>
            ) : (
              <div className="space-y-1">
                {topTargets.map((entry, idx) => (
                  <div key={entry.label} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-sand-50">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sand-100 text-[10px] font-bold text-sand-500">{idx + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-sand-800">{entry.label}</span>
                    <span className="shrink-0 text-xs text-sand-500">{entry.count}x</span>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-sand-400">
                      <Clock size={11} />{formatDuration(entry.duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
