import { useMemo } from "react";
import { PhoneMissed, PhoneCall } from "lucide-react";

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
  if (numeric > 86400) {
    return Math.floor(numeric / 1000);
  }
  return Math.floor(numeric);
};

const shouldUseLiveDuration = (call) => {
  const start = Number(call?.startTime || 0);
  const end = Number(call?.endTime || 0);
  if (!call?.answered || !start) return false;
  if (end && end >= start) return false;
  if (normalizeDuration(call?.duration) > 0) return false;
  const ageMs = Date.now() - start;
  // Treat as active only for fresh calls; stale records should not keep growing forever.
  return ageMs >= 0 && ageMs <= 4 * 60 * 60 * 1000;
};

const durationSeconds = (call) => {
  const duration = normalizeDuration(call.duration);
  if (duration) return duration;
  const start = Number(call?.startTime || 0);
  const end = Number(call?.endTime || 0);
  if (start && end && end >= start) {
    return Math.floor((end - start) / 1000);
  }
  if (shouldUseLiveDuration(call)) {
    return Math.floor((Date.now() - start) / 1000);
  }
  return 0;
};

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
    const list = Array.isArray(customers) ? customers : [];
    list.forEach((customer) => {
      const name = customer?.name || "";
      const phones = Array.isArray(customer?.phones) ? customer.phones : [];
      phones.forEach((phone) => {
        const number = normalizeNumber(phone?.number || "");
        if (number && name) {
          map.set(number, name);
        }
      });
    });
    return map;
  }, [customers]);
  const pbxMatches = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(pbxEntries) ? pbxEntries : [];
    list.forEach((entry) => {
      const number = normalizeNumber(entry?.number || "");
      if (number) {
        map.set(number, entry?.name || "");
      }
    });
    return map;
  }, [pbxEntries]);
  const outboundByNumber = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(calls) ? calls : [];
    list.forEach((call) => {
      const direction = call.direction?.toLowerCase() || "";
      if (!direction.includes("out")) return;
      const number = normalizeNumber(call.to || call.from || "");
      if (!number) return;
      const ts = call.startTime || 0;
      const current = map.get(number) || 0;
      if (ts > current) {
        map.set(number, ts);
      }
    });
    return map;
  }, [calls]);
  const unreturnedCount = useMemo(() => {
    const list = Array.isArray(calls) ? calls : [];
    return list.filter((call) => {
      if (call.answered) return false;
      if (call.callbackResolved) return false;
      const direction = call.direction?.toLowerCase() || "";
      if (direction.includes("out")) return false;
      const number = normalizeNumber(call.from || call.to || "");
      if (!number) return false;
      const lastOut = outboundByNumber.get(number) || 0;
      const ts = call.startTime || 0;
      return !lastOut || lastOut < ts;
    }).length;
  }, [calls, outboundByNumber]);
  const topTargets = (() => {
    const counts = new Map();
    const seenByNumber = new Map();
    const labels = new Map();
    const recent = Array.isArray(calls) ? calls.slice(0, 100) : [];
    recent.forEach((call) => {
      const direction = call.direction?.toLowerCase() || "";
      if (direction.includes("out")) return;
      const rawNumber = call.from || call.to;
      const normalized = normalizeNumber(rawNumber);
      if (!normalized) return;
      const safeNumber = rawNumber ? String(rawNumber) : normalized;
      const name =
        call.customerName ||
        customerMatches.get(normalized) ||
        pbxMatches.get(normalized) ||
        "";
      const nextLabel = name ? `${name} · ${safeNumber}` : safeNumber;
      const uniqueId =
        call.uuid ||
        `${call.startTime || ""}-${call.direction || ""}-${call.extension || ""}-${normalized}`;
      const callDuration = durationSeconds(call);
      const seen = seenByNumber.get(normalized) || new Set();
      if (!seen.has(uniqueId)) {
        seen.add(uniqueId);
        seenByNumber.set(normalized, seen);
        const current = counts.get(normalized) || { count: 0, duration: 0 };
        counts.set(normalized, {
          count: current.count + 1,
          duration: current.duration + callDuration
        });
      }
      const currentLabel = labels.get(normalized);
      if (!currentLabel || (name && !currentLabel.includes("·"))) {
        labels.set(normalized, nextLabel);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([key, payload]) => ({
        label: labels.get(key) || key,
        count: payload.count,
        duration: payload.duration
      }));
  })();

  const renderBreakdown = (title, rows) => (
    <div className="border border-sand-200 rounded-2xl p-3">
      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500 mb-2">{title}</p>
      {rows.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-sand-400">
          <PhoneCall size={14} />
          <span>Keine Daten vorhanden.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-sand-500 border-b border-sand-200">
              <tr>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Gesamt</th>
                <th className="text-left py-2">Beantwortet</th>
                <th className="text-left py-2">Verpasst</th>
                <th className="text-left py-2">Ø Dauer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-sand-100">
                  <td className="py-1.5">{row.key}</td>
                  <td className="py-1.5">{row.total}</td>
                  <td className="py-1.5 text-emerald-600">{row.answered}</td>
                  <td className="py-1.5 text-rose-600">{row.missed}</td>
                  <td className="py-1.5">{formatDuration(row.avgDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-4 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Analytics</p>
          <h2 className="text-lg font-display">Call Statistik</h2>
        </div>
      </div>

      <div className="mb-4">
        <div
          className={`flex items-center gap-4 rounded-2xl border p-4 ${
            unreturnedCount > 0
              ? "border-amber-200 bg-amber-50"
              : "border-sand-200 bg-sand-50"
          }`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              unreturnedCount > 0 ? "bg-amber-100 text-amber-600" : "bg-sand-100 text-sand-400"
            }`}
          >
            <PhoneMissed size={18} />
          </div>
          <div>
            <p
              className={`text-3xl font-bold leading-none ${
                unreturnedCount > 0 ? "text-amber-700" : "text-sand-400"
              }`}
            >
              {unreturnedCount}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-sand-500">
              Offene Rückrufe
            </p>
          </div>
          {unreturnedCount === 0 ? (
            <p className="ml-2 text-xs text-sand-400">Alle eingehenden Anrufe beantwortet oder zurückgerufen.</p>
          ) : (
            <p className="ml-2 text-xs text-amber-700">Eingehend, nicht beantwortet, kein Rückruf erfasst.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {periods.map((period) => {
          const data = safeStats[period.key] || {
            total: 0,
            answered: 0,
            missed: 0,
            avgDuration: 0
          };
          return (
            <div key={period.key} className="border border-sand-200 rounded-2xl p-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500 mb-3">
                {period.label}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-sand-500">Gesamt</p>
                  <p className="text-xl font-semibold">{data.total}</p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Beantwortet</p>
                  <p className="text-xl font-semibold text-emerald-600">
                    {data.answered}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Verpasst</p>
                  <p className="text-xl font-semibold text-rose-600">{data.missed}</p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Ø Gesprächsdauer</p>
                  <p className="text-xl font-semibold">
                    {formatDuration(data.avgDuration)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Gesamtdauer</p>
                  <p className="text-xl font-semibold">
                    {formatDurationHms(data.totalDuration)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {renderBreakdown("Nebenstellen (letzte 7 Tage)", extensionStats)}
        <div className="border border-sand-200 rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500 mb-2">
            Top 5 Kunden / Rufnummern (letzte 100)
          </p>
          {topTargets.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-xs text-sand-400">
              <PhoneCall size={14} />
              <span>Keine Daten vorhanden.</span>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {topTargets.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center justify-between rounded-xl border border-sand-200 bg-sand-50 px-4 py-3"
                >
                  <span className="text-sand-700">{entry.label}</span>
                  <span className="text-sand-500">
                    {entry.count}x · {formatDuration(entry.duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
