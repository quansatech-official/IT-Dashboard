import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, PhoneOutgoing } from "lucide-react";

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

export default function CallListView({ calls, extensions, onCallback, onResolve }) {
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.min(3, Math.max(1, Math.ceil(calls.length / pageSize)));
  const [callbackTarget, setCallbackTarget] = useState(null);
  const [selectedExtension, setSelectedExtension] = useState("");
  const [callbackStatus, setCallbackStatus] = useState("");
  const [resolvedNames, setResolvedNames] = useState({});
  const [onlyMissed, setOnlyMissed] = useState(false);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const filteredCalls = useMemo(() => {
    if (!onlyMissed) return calls;
    return calls.filter((call) => !call.answered);
  }, [calls, onlyMissed]);

  const pagedCalls = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCalls.slice(start, start + pageSize);
  }, [filteredCalls, page]);

  const displayNumber = (call) => {
    const direction = call.direction?.toLowerCase();
    if (direction?.includes("out")) return call.to || call.from || "-";
    return call.from || call.to || "-";
  };

  const resolveNumber = (call) => {
    if (call.customerName) return "";
    return displayNumber(call);
  };

  const callbackNumber = (call) => {
    const direction = call.direction?.toLowerCase();
    if (direction?.includes("out")) return call.to || "";
    return call.from || "";
  };

  const extensionOptions = Array.isArray(extensions) ? extensions : [];
  const visibleTotalPages = Math.min(
    3,
    Math.max(1, Math.ceil(filteredCalls.length / pageSize))
  );

  useEffect(() => {
    if (page > visibleTotalPages) setPage(1);
  }, [page, visibleTotalPages]);

  useEffect(() => {
    let active = true;
    const lookup = async () => {
      for (const call of pagedCalls) {
        const number = resolveNumber(call);
        if (!number || resolvedNames[number]) continue;
        const result = await onResolve?.(number);
        if (!active) return;
        const name = result?.name || "";
        setResolvedNames((prev) => (prev[number] ? prev : { ...prev, [number]: name }));
      }
    };
    lookup();
    return () => {
      active = false;
    };
  }, [pagedCalls, resolvedNames, onResolve]);

  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Live Calls</p>
          <h2 className="text-xl font-display">Call Monitoring</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-sand-500">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyMissed}
              onChange={(event) => setOnlyMissed(event.target.checked)}
            />
            Nur verpasste
          </label>
          <span>letzte 30 Events</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-sand-500 border-b border-sand-200">
            <tr>
              <th className="text-left py-2">Zeit</th>
              <th className="text-left py-2">Rufnummer</th>
              <th className="text-left py-2">NS</th>
              <th className="text-left py-2">Richtung</th>
              <th className="text-left py-2">Dauer</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Name</th>
              <th className="text-right py-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filteredCalls.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-sand-500">
                  {onlyMissed
                    ? "Keine verpassten Anrufe vorhanden."
                    : "Noch keine Telefonie-Events geladen."}
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
                  <td className="py-3">
                    {call.customerName || resolvedNames[resolveNumber(call)] || "-"}
                  </td>
                  <td className="py-3 text-right">
                    {!call.answered && callbackNumber(call) ? (
                      <button
                        onClick={() => {
                          setCallbackTarget(call);
                          setSelectedExtension(extensionOptions[0]?.extension_number || "");
                          setCallbackStatus("");
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                      >
                        <PhoneOutgoing size={12} /> Rückruf
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filteredCalls.length > pageSize && (
        <div className="mt-4 flex items-center justify-between text-xs text-sand-600">
          <span>
            Seite {page} von {visibleTotalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-sand-200 px-3 py-1 hover:bg-sand-100"
            >
              Zurück
            </button>
            {Array.from({ length: visibleTotalPages }, (_, idx) => (
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
              onClick={() => setPage((current) => Math.min(visibleTotalPages, current + 1))}
              className="rounded-full border border-sand-200 px-3 py-1 hover:bg-sand-100"
            >
              Weiter
            </button>
          </div>
        </div>
      )}
      {callbackTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-200 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Rückruf starten</p>
              <h3 className="text-lg font-display text-sand-900">
                {callbackNumber(callbackTarget) || "Nummer unbekannt"}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <label className="text-xs uppercase tracking-wide text-sand-600">
                Nebenstelle auswählen
                <select
                  value={selectedExtension}
                  onChange={(event) => setSelectedExtension(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm"
                >
                  {extensionOptions.length ? (
                    extensionOptions.map((item) => (
                      <option key={item.uuid || item.extension_number} value={item.extension_number}>
                        {item.extension_number} {item.name ? `– ${item.name}` : ""}
                      </option>
                    ))
                  ) : (
                    <option value="">Keine Nebenstellen</option>
                  )}
                </select>
              </label>
              {callbackStatus ? (
                <p className="text-xs text-sand-500">{callbackStatus}</p>
              ) : null}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCallbackTarget(null)}
                  className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  Abbrechen
                </button>
                <button
                  onClick={async () => {
                    if (!selectedExtension) {
                      setCallbackStatus("Bitte Nebenstelle wählen.");
                      return;
                    }
                    const number = callbackNumber(callbackTarget);
                    if (!number) {
                      setCallbackStatus("Keine Rufnummer gefunden.");
                      return;
                    }
                    setCallbackStatus("Rückruf wird gestartet...");
                    const result = await onCallback?.(selectedExtension, number);
                    if (result) {
                      setCallbackStatus("Rückruf gestartet.");
                      setTimeout(() => setCallbackTarget(null), 900);
                    } else {
                      setCallbackStatus("Rückruf fehlgeschlagen.");
                    }
                  }}
                  className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  Jetzt anrufen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
