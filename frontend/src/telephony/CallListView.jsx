import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PhoneOutgoing,
  BookPlus,
  Users,
  Phone,
  Cloud
} from "lucide-react";

const formatTime = (timestamp) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("de-DE");
};

const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

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

export default function CallListView({
  calls,
  extensions,
  customers = [],
  pbxEntries = [],
  pbxApiActive = false,
  onCallback,
  onResolve,
  onResolveCallback,
  onAssignNumber,
  onAddToPbx
}) {
  const pageSize = 10;
  const [page, setPage] = useState(1);
  const totalPages = Math.min(3, Math.max(1, Math.ceil(calls.length / pageSize)));
  const [callbackTarget, setCallbackTarget] = useState(null);
  const [selectedExtension, setSelectedExtension] = useState("");
  const [callbackStatus, setCallbackStatus] = useState("");
  const [resolvedNames, setResolvedNames] = useState({});
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignStatus, setAssignStatus] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [pbxEditTarget, setPbxEditTarget] = useState(null);
  const [pbxEditName, setPbxEditName] = useState("");
  const [pbxEditError, setPbxEditError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

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

  const extensionOptions = Array.isArray(extensions) ? extensions : [];
  const visibleTotalPages = Math.min(
    3,
    Math.max(1, Math.ceil(filteredCalls.length / pageSize))
  );

  const assignCandidates = useMemo(() => {
    const needle = assignQuery.trim().toLowerCase();
    const list = Array.isArray(customers) ? customers : [];
    if (!needle) return list.slice(0, 12);
    return list
      .filter((customer) => {
        const name = String(customer?.name || "").toLowerCase();
        const code = String(customer?.short_code || "").toLowerCase();
        const creditor = String(customer?.creditor_number || "").toLowerCase();
        return name.includes(needle) || code.includes(needle) || creditor.includes(needle);
      })
      .slice(0, 12);
  }, [customers, assignQuery]);

  const customerMatches = useMemo(() => {
    const map = new Map();
    const list = Array.isArray(customers) ? customers : [];
    list.forEach((customer) => {
      const name = customer?.name || "";
      const phones = Array.isArray(customer?.phones) ? customer.phones : [];
      phones.forEach((phone) => {
        const number = normalizeDigits(phone?.number || "");
        if (number && name) {
          map.set(number, name);
        }
      });
    });
    return map;
  }, [customers]);

  const pbxMatches = useMemo(() => {
    const map = new Map();
    pbxEntries.forEach((entry) => {
      const number = normalizeDigits(entry?.number || "");
      if (number) {
        map.set(number, entry);
      }
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
    setPbxEditName(pbxEditTarget?.name || "");
    setPbxEditError("");
  }, [pbxEditTarget]);

  useEffect(() => {
    if (page > visibleTotalPages) setPage(1);
  }, [page, visibleTotalPages]);

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
      const results = await Promise.allSettled(
        entries.map(([, number]) => onResolve(number))
      );
      if (!active) return;
      const next = {};
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const name = result.value?.name || "";
        if (name) {
          const key = entries[index][0];
          next[key] = name;
        }
      });
      if (Object.keys(next).length) {
        setResolvedNames((prev) => ({ ...prev, ...next }));
      }
    };
    lookup();
    return () => {
      active = false;
    };
  }, [pagedCalls, resolvedNames, onResolve]);

  const customerHasNumber = (customer, number) => {
    const target = normalizeDigits(number);
    if (!target) return false;
    const phones = Array.isArray(customer?.phones) ? customer.phones : [];
    return phones.some((phone) => normalizeDigits(phone?.number) === target);
  };

  const pbxEntryForCall = (call) => {
    const key = resolveKey(call);
    return key ? pbxMatches.get(key) : null;
  };

  const outboundByNumber = useMemo(() => {
    const map = new Map();
    calls.forEach((call) => {
      const direction = call.direction?.toLowerCase() || "";
      if (!direction.includes("out")) return;
      const number = normalizeDigits(call.to || call.from || "");
      if (!number) return;
      const ts = call.startTime || 0;
      const current = map.get(number) || 0;
      if (ts > current) {
        map.set(number, ts);
      }
    });
    return map;
  }, [calls]);

  const isUnreturned = (call) => {
    if (call.answered) return false;
    const direction = call.direction?.toLowerCase() || "";
    if (direction.includes("out")) return false;
    const number = normalizeDigits(call.from || call.to || "");
    if (!number) return false;
    const lastOut = outboundByNumber.get(number) || 0;
    const ts = call.startTime || 0;
    if (call.callbackResolved) return false;
    return !lastOut || lastOut < ts;
  };

  const customerNameForCall = (call) => {
    const key = resolveKey(call);
    return key ? customerMatches.get(key) : "";
  };

  const nameSourceForCall = (call) => {
    if (call.customerName || customerNameForCall(call)) {
      return { label: "Kundenstamm", Icon: Users };
    }
    if (resolvedNames[resolveKey(call)]) {
      return { label: "API", Icon: Cloud };
    }
    if (pbxEntryForCall(call)?.name) {
      return { label: "Anlagentelefonbuch", Icon: Phone };
    }
    return null;
  };

  const renderNameSource = (call) => {
    const source = nameSourceForCall(call);
    if (!source) return null;
    const Icon = source.Icon;
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-1 text-sand-500"
        title={`Name aus ${source.label}`}
      >
        <Icon size={12} />
      </span>
    );
  };

  const handleAddToPbx = async (payload) => {
    if (!onAddToPbx) return;
    try {
      await Promise.resolve(onAddToPbx(payload));
      setToast("Telefonbuch uebernommen.");
    } catch (error) {
      setToast("Telefonbuch-Uebernahme fehlgeschlagen.");
      setPbxEditTarget({
        name: payload?.name || "",
        number: payload?.number || ""
      });
    }
  };

  const handlePbxManualSave = async () => {
    if (!onAddToPbx || !pbxEditTarget?.number) return;
    const trimmed = pbxEditName.trim();
    if (!trimmed) {
      setPbxEditError("Name fehlt.");
      return;
    }
    setPbxEditError("");
    try {
      await Promise.resolve(
        onAddToPbx({
          name: trimmed,
          number: pbxEditTarget.number
        })
      );
      setToast("Telefonbuch uebernommen.");
      setPbxEditTarget(null);
    } catch (error) {
      setPbxEditError("Speichern fehlgeschlagen. Bitte Namen kuerzen.");
    }
  };

  return (
    <>
      {toast ? (
        <div className="fixed top-5 right-6 z-50 bg-sand-900 text-white text-xs uppercase tracking-wide px-4 py-2 rounded-full shadow-soft">
          {toast}
        </div>
      ) : null}
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
          <span>letzte 100 Events</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-sand-500 border-b border-sand-200">
            <tr>
              <th className="text-left py-2">Datum</th>
              <th className="text-left py-2">Zeit</th>
              <th className="text-left py-2">Rufnummer</th>
              <th className="text-left py-2">NS</th>
              <th className="text-left py-2">Richtung</th>
              <th className="text-left py-2">Dauer</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Name</th>
              <th className="text-left py-2">Quelle</th>
              <th className="text-right py-2">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filteredCalls.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-6 text-center text-sand-500">
                  {onlyMissed
                    ? "Keine verpassten Anrufe vorhanden."
                    : "Noch keine Telefonie-Events geladen."}
                </td>
              </tr>
            ) : (
              pagedCalls.map((call) => {
                const unreturned = isUnreturned(call);
                return (
                <tr
                  key={call.uuid}
                  className={`border-b border-sand-100 ${unreturned ? "bg-amber-50/70" : ""}`}
                >
                  <td className="py-3">{formatDate(call.startTime)}</td>
                  <td className="py-3">{formatTime(call.startTime)}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className={unreturned ? "font-semibold text-amber-800" : ""}>
                        {displayNumber(call)}
                      </span>
                      {unreturned ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!onResolveCallback) return;
                            const updated = await onResolveCallback(call);
                            if (updated) {
                              setToast("Rückruf erledigt.");
                            } else {
                              setToast("Status konnte nicht gespeichert werden.");
                            }
                          }}
                          className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 hover:bg-amber-200"
                          title="Als erledigt markieren"
                        >
                          Rueckruf offen
                        </button>
                      ) : null}
                    </div>
                  </td>
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
                    <span className="flex items-center gap-2">
                      {call.customerName ||
                      customerNameForCall(call) ||
                      resolvedNames[resolveKey(call)] ||
                      pbxEntryForCall(call)?.name ||
                      "-"}
                    </span>
                  </td>
                  <td className="py-3">{renderNameSource(call)}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {assignNumber(call) && !pbxEntryForCall(call) && onAddToPbx ? (
                        <button
                          onClick={() =>
                            handleAddToPbx({
                              name:
                                call.customerName ||
                                customerNameForCall(call) ||
                                resolvedNames[resolveKey(call)] ||
                                "",
                              number: assignNumber(call)
                            })
                          }
                          disabled={!pbxApiActive}
                          className={`rounded-full border p-1 text-sand-600 ${
                            pbxApiActive
                              ? "border-sand-300 bg-white hover:bg-sand-100"
                              : "border-sand-200 bg-sand-100 opacity-50 cursor-not-allowed"
                          }`}
                          title="In Anlagen-Telefonbuch übernehmen"
                        >
                          <BookPlus size={14} />
                        </button>
                      ) : null}
                      {assignNumber(call) && !call.customerName && !customerNameForCall(call) ? (
                        <button
                          onClick={() => setAssignTarget(call)}
                          className="rounded-full border border-amber-200 bg-amber-50 p-1 text-amber-700 hover:bg-amber-100"
                          title="In Kundenstamm übernehmen"
                        >
                          <ArrowDownLeft size={14} />
                        </button>
                      ) : null}
                      {callbackNumber(call) ? (
                        <button
                          onClick={() => {
                            setCallbackTarget(call);
                            setSelectedExtension(extensionOptions[0]?.extension_number || "");
                            setCallbackStatus("");
                          }}
                          className="rounded-full border border-sand-300 bg-white p-1 text-sand-600 hover:bg-sand-100"
                          title="Rückruf"
                        >
                          <PhoneOutgoing size={14} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
              })
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
      {assignTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-200 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                Rufnummer übernehmen
              </p>
              <h3 className="text-lg font-display text-sand-900">
                {assignNumber(assignTarget) || "Nummer unbekannt"}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <label className="text-xs uppercase tracking-wide text-sand-600">
                Kunde suchen
                <input
                  value={assignQuery}
                  onChange={(event) => setAssignQuery(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm"
                  placeholder="Name, Kürzel, Kundennummer..."
                />
              </label>
              <div className="space-y-2 max-h-60 overflow-auto">
                {assignCandidates.length ? (
                  assignCandidates.map((customer) => {
                    const hasNumber = customerHasNumber(customer, assignNumber(assignTarget));
                    return (
                      <div
                        key={customer.id}
                        className="flex items-center justify-between rounded-2xl border border-sand-200 bg-white px-3 py-2"
                      >
                        <div>
                          <p className="text-sm text-sand-900">{customer.name}</p>
                          <p className="text-[11px] text-sand-500">
                            {customer.short_code || customer.creditor_number || "—"}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={assignBusy || hasNumber}
                          onClick={async () => {
                            const number = assignNumber(assignTarget);
                            if (!number) {
                              setAssignStatus("Keine Rufnummer gefunden.");
                              return;
                            }
                            if (!onAssignNumber) {
                              setAssignStatus("Aktion nicht verfügbar.");
                              return;
                            }
                            setAssignBusy(true);
                            setAssignStatus("Speichere...");
                            const result = await onAssignNumber(customer.id, number);
                            if (result?.ok) {
                              setResolvedNames((prev) => ({
                                ...prev,
                                [number]: result.customer?.name || customer.name
                              }));
                              setAssignStatus("Rufnummer übernommen.");
                              setTimeout(() => setAssignTarget(null), 900);
                            } else {
                              setAssignStatus(result?.error || "Übernahme fehlgeschlagen.");
                            }
                            setAssignBusy(false);
                          }}
                          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-wide ${
                            hasNumber
                              ? "border-sand-200 text-sand-400 cursor-not-allowed"
                              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          {hasNumber ? "Schon vorhanden" : "Übernehmen"}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-sand-500">Kein Kunde gefunden.</div>
                )}
              </div>
              {assignStatus ? (
                <p className="text-xs text-sand-500">{assignStatus}</p>
              ) : null}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setAssignTarget(null)}
                  className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {pbxEditTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-md rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-200 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                Anlagentelefonbuch
              </p>
              <h3 className="text-lg font-display text-sand-900">Name kuerzen</h3>
            </div>
            <div className="p-5 space-y-4">
              <label className="text-xs uppercase tracking-wide text-sand-600">
                Rufnummer
                <input
                  value={pbxEditTarget.number}
                  readOnly
                  className="mt-2 w-full rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-sand-600">
                Name (bitte kuerzen)
                <input
                  value={pbxEditName}
                  onChange={(event) => setPbxEditName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              {pbxEditError ? (
                <p className="text-xs text-rose-600">{pbxEditError}</p>
              ) : (
                <p className="text-xs text-sand-500">
                  NFON hat ein Namenslimit. Bitte kuerzen und erneut speichern.
                </p>
              )}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setPbxEditTarget(null)}
                  className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handlePbxManualSave}
                  className="rounded-full bg-sand-900 px-4 py-1 text-xs uppercase tracking-wide text-white hover:opacity-90"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}
