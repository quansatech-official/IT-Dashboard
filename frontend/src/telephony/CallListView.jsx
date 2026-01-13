import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

const formatTime = (timestamp) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const directionLabel = (direction) => {
  if (!direction) return "-";
  const value = direction.toLowerCase();
  if (value.includes("in")) return "Eingehend";
  if (value.includes("out")) return "Ausgehend";
  return direction;
};

const directionMeta = (direction) => {
  const value = direction?.toLowerCase() || "";
  if (value.includes("in")) {
    return {
      label: "Eingehend",
      icon: ArrowDownLeft,
      className: "text-emerald-600"
    };
  }
  if (value.includes("out")) {
    return {
      label: "Ausgehend",
      icon: ArrowUpRight,
      className: "text-rose-600"
    };
  }
  return {
    label: directionLabel(direction),
    icon: null,
    className: "text-sand-600"
  };
};

const durationSeconds = (call) => {
  if (call.duration) return call.duration;
  if (call.startTime && call.endTime && call.endTime >= call.startTime) {
    return Math.floor((call.endTime - call.startTime) / 1000);
  }
  if (call.answered && call.startTime) {
    return Math.floor((Date.now() - call.startTime) / 1000);
  }
  return 0;
};

export default function CallListView({ calls }) {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const totalPages = Math.min(3, Math.max(1, Math.ceil(calls.length / pageSize)));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const pagedCalls = useMemo(() => {
    const start = (page - 1) * pageSize;
    return calls.slice(start, start + pageSize);
  }, [calls, page]);

  const displayNumber = (call) => {
    const direction = call.direction?.toLowerCase();
    if (direction?.includes("out")) return call.to || call.from || "-";
    return call.from || call.to || "-";
  };

  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Live Calls</p>
          <h2 className="text-xl font-display">Call Monitoring</h2>
        </div>
        <span className="text-xs text-sand-500">letzte 50 Events</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-sand-500 border-b border-sand-200">
            <tr>
              <th className="text-left py-2">Zeit</th>
              <th className="text-left py-2">Rufnummer</th>
              <th className="text-left py-2">Nebenstelle</th>
              <th className="text-left py-2">Richtung</th>
              <th className="text-left py-2">Dauer</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Kunde</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sand-500">
                  Noch keine Telefonie-Events geladen.
                </td>
              </tr>
            ) : (
              pagedCalls.map((call) => (
                <tr key={call.uuid} className="border-b border-sand-100">
                  <td className="py-3">{formatTime(call.startTime)}</td>
                  <td className="py-3">{displayNumber(call)}</td>
                  <td className="py-3">{call.extension || "-"}</td>
                  <td className="py-3">
                    {(() => {
                      const meta = directionMeta(call.direction);
                      const Icon = meta.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 ${meta.className}`}>
                          {Icon ? <Icon size={14} /> : null}
                          {meta.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3">{formatDuration(durationSeconds(call))}</td>
                  <td className="py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        call.answered
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {call.answered ? "Beantwortet" : "Verpasst"}
                    </span>
                  </td>
                  <td className="py-3">{call.customerName || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {calls.length > pageSize && (
        <div className="mt-4 flex items-center justify-between text-xs text-sand-600">
          <span>
            Seite {page} von {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-sand-200 px-3 py-1 hover:bg-sand-100"
            >
              Zurück
            </button>
            {Array.from({ length: totalPages }, (_, idx) => (
              <button
                key={idx + 1}
                onClick={() => setPage(idx + 1)}
                className={`rounded-full border px-3 py-1 ${
                  page === idx + 1
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 hover:bg-sand-100"
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-full border border-sand-200 px-3 py-1 hover:bg-sand-100"
            >
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
