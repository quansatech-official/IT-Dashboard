import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Phone, PhoneIncoming, X } from "lucide-react";
import { telephonyService } from "./telephonyService";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const DISMISSED_CALL_STORAGE_KEY = "qt_incoming_call_popup_dismissed_uuid";
const MAX_ACTIVE_INCOMING_AGE_MS = 5 * 60 * 1000;
const DIRECTORY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  const width = 400;
  return { x: Math.max(8, window.innerWidth - width - 24), y: 20 };
};

export default function IncomingCallQuickTaskPopup() {
  const [calls, setCalls] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pbxEntries, setPbxEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [callUuid, setCallUuid] = useState("");
  const [context, setContext] = useState({ customerName: "", customerNumber: "", phone: "", startedAt: 0 });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [createdTask, setCreatedTask] = useState(null);
  const [liveMode, setLiveMode] = useState("connecting");
  const [dismissedCallUuid, setDismissedCallUuid] = useState("");
  const [position, setPosition] = useState(getDefaultPosition);

  const dragRef = useRef({ active: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 });

  const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

  const displayNumber = (call) => {
    const direction = call?.direction?.toLowerCase() || "";
    if (direction.includes("out")) return call?.to || call?.from || "";
    return call?.from || call?.to || "";
  };

  const customerByPhone = useMemo(() => {
    const map = new Map();
    (Array.isArray(customers) ? customers : []).forEach((customer) => {
      (Array.isArray(customer?.phones) ? customer.phones : []).forEach((phone) => {
        const number = normalizeDigits(phone?.number);
        if (!number) return;
        map.set(number, { name: customer?.name || "", number: customer?.creditor_number || "" });
      });
    });
    return map;
  }, [customers]);

  const pbxNameByPhone = useMemo(() => {
    const map = new Map();
    (Array.isArray(pbxEntries) ? pbxEntries : []).forEach((entry) => {
      const number = normalizeDigits(entry?.number);
      if (!number) return;
      map.set(number, String(entry?.name || "").trim());
    });
    return map;
  }, [pbxEntries]);

  const activeIncomingCall = useMemo(() => {
    const now = Date.now();
    const incoming = (Array.isArray(calls) ? calls : []).filter((call) => {
      const direction = call?.direction?.toLowerCase() || "";
      if (!direction.includes("in")) return false;
      const start = Number(call?.startTime || 0);
      if (!start) return false;
      const end = Number(call?.endTime || 0);
      const duration = Number(call?.duration || 0);
      if (duration > 0) return false;
      const age = now - start;
      if (age < 0 || age > MAX_ACTIVE_INCOMING_AGE_MS) return false;
      if (!(!end || end < start)) return false;
      return true;
    });
    if (!incoming.length) return null;
    return incoming.sort((a, b) => Number(b?.startTime || 0) - Number(a?.startTime || 0))[0];
  }, [calls]);

  const incomingMeta = useMemo(() => {
    const call = activeIncomingCall;
    if (!call) return { customerName: "", customerNumber: "", phone: "", startedAt: 0 };
    const phone = displayNumber(call);
    const key = normalizeDigits(phone);
    const customerMatch = key ? customerByPhone.get(key) : null;
    const pbxName = key ? pbxNameByPhone.get(key) : "";
    const customerName = customerMatch?.name || String(call?.customerName || "").trim() || String(pbxName || "").trim();
    return { customerName, customerNumber: customerMatch?.number || "", phone, startedAt: Number(call?.startTime || 0) };
  }, [activeIncomingCall, customerByPhone, pbxNameByPhone]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(DISMISSED_CALL_STORAGE_KEY) || "";
    if (stored) setDismissedCallUuid(stored);
  }, []);

  useEffect(() => {
    let active = true;
    const loadCalls = async () => {
      const nextCalls = await telephonyService.fetchCalls(100);
      if (!active) return;
      setCalls(Array.isArray(nextCalls) ? nextCalls : []);
    };
    const loadDirectoryData = async () => {
      const [nextCustomers, nextPbx] = await Promise.all([
        telephonyService.fetchCustomers(),
        telephonyService.fetchPbxPhonebook()
      ]);
      if (!active) return;
      setCustomers(Array.isArray(nextCustomers) ? nextCustomers : []);
      setPbxEntries(Array.isArray(nextPbx) ? nextPbx : []);
    };

    loadCalls();
    loadDirectoryData();

    let source = null;
    if (typeof window !== "undefined" && typeof window.EventSource !== "undefined") {
      source = new EventSource("/api/telephony/events");
      source.addEventListener("open", () => { if (!active) return; setLiveMode("live"); });
      source.addEventListener("call", (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(event.data || "{}");
          if (!payload?.uuid) return;
          setCalls((prev) => [payload, ...prev.filter((item) => item.uuid !== payload.uuid)].slice(0, 120));
        } catch { /* ignore */ }
      });
      source.addEventListener("error", () => { if (!active) return; setLiveMode("reconnecting"); });
    } else {
      setLiveMode("polling");
    }

    const callsInterval = setInterval(loadCalls, 20000);
    const directoryInterval = setInterval(loadDirectoryData, DIRECTORY_REFRESH_INTERVAL_MS);
    return () => { active = false; source?.close(); clearInterval(callsInterval); clearInterval(directoryInterval); };
  }, []);

  useEffect(() => {
    const call = activeIncomingCall;
    if (!call) {
      setDismissedCallUuid("");
      if (typeof window !== "undefined") window.sessionStorage.removeItem(DISMISSED_CALL_STORAGE_KEY);
      if (open && !title.trim()) { setOpen(false); setCallUuid(""); setStatus(""); }
      return;
    }
    if (dismissedCallUuid && dismissedCallUuid === call.uuid) return;
    if (callUuid === call.uuid) return;
    setOpen(true);
    setCallUuid(call.uuid || "");
    setContext({
      customerName: incomingMeta.customerName || "",
      customerNumber: incomingMeta.customerNumber || "",
      phone: incomingMeta.phone || "",
      startedAt: incomingMeta.startedAt || 0
    });
    setStatus("");
  }, [activeIncomingCall, callUuid, dismissedCallUuid, incomingMeta, open, title]);

  useEffect(() => {
    if (!open || !callUuid) return;
    if (title.trim()) return;
    const currentCall = (Array.isArray(calls) ? calls : []).find((item) => item?.uuid === callUuid);
    if (!currentCall) return;
    const start = Number(currentCall?.startTime || 0);
    const end = Number(currentCall?.endTime || 0);
    const duration = Number(currentCall?.duration || 0);
    const ended = duration > 0 || (!!end && (!start || end >= start));
    if (!ended) return;
    setOpen(false); setCallUuid(""); setStatus("");
    setContext({ customerName: "", customerNumber: "", phone: "", startedAt: 0 });
  }, [callUuid, calls, open, title]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (activeIncomingCall?.uuid) {
        setDismissedCallUuid(activeIncomingCall.uuid);
        if (typeof window !== "undefined") window.sessionStorage.setItem(DISMISSED_CALL_STORAGE_KEY, activeIncomingCall.uuid);
      }
      setOpen(false); setTitle(""); setCallUuid("");
      setContext({ customerName: "", customerNumber: "", phone: "", startedAt: 0 });
      setStatus(""); setCreatedTask(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, activeIncomingCall]);

  useEffect(() => {
    const onResize = () => {
      const maxX = Math.max(8, window.innerWidth - 380);
      const maxY = Math.max(8, window.innerHeight - 180);
      setPosition((prev) => ({ x: clamp(prev.x, 8, maxX), y: clamp(prev.y, 8, maxY) }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const closePopup = () => {
    if (activeIncomingCall?.uuid) {
      const uuid = activeIncomingCall.uuid;
      setDismissedCallUuid(uuid);
      if (typeof window !== "undefined") window.sessionStorage.setItem(DISMISSED_CALL_STORAGE_KEY, uuid);
    }
    setOpen(false); setTitle(""); setCallUuid("");
    setContext({ customerName: "", customerNumber: "", phone: "", startedAt: 0 });
    setStatus(""); setCreatedTask(null);
  };

  const createQuickTask = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const detailsParts = [];
      if (context.phone) detailsParts.push(`Anrufnummer: ${context.phone}`);
      if (context.startedAt) detailsParts.push(`Anrufstart: ${new Date(context.startedAt).toLocaleString("de-DE")}`);
      const response = await fetch("/api/day_tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          customer: context.customerName || "",
          customer_number: context.customerNumber || "",
          details: detailsParts.join("\n")
        })
      });
      if (!response.ok) throw new Error("create_failed");
      const savedTask = await response.json().catch(() => null);
      window.dispatchEvent(new CustomEvent("qt:daytask-created", { detail: { task: savedTask || null, source: "incoming-call-popup" } }));
      setStatus("Aufgabe erstellt");
      setCreatedTask(savedTask || null);
      setTitle("");
      if (!activeIncomingCall) { setOpen(false); setCallUuid(""); }
    } catch {
      setStatus("Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  };

  const onPointerDownHandle = (event) => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) return;
    if (event.target?.closest?.("button, input, textarea, a")) return;
    dragRef.current = { active: true, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMoveHandle = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    setPosition({
      x: clamp(drag.originX + deltaX, 8, Math.max(8, window.innerWidth - 380)),
      y: clamp(drag.originY + deltaY, 8, Math.max(8, window.innerHeight - 120))
    });
  };

  const onPointerUpHandle = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  if (!open) return null;

  const callerLabel = context.customerName || context.phone || "Unbekannter Anrufer";
  const hasCustomer = Boolean(context.customerName);

  return (
    <div
      className="fixed z-[70] w-[400px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-white/30 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.22),0_4px_12px_rgba(15,23,42,0.1)] backdrop-blur-xl"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {/* Drag handle / Header */}
      <div
        className="cursor-move select-none border-b border-sand-100 bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3"
        onPointerDown={onPointerDownHandle}
        onPointerMove={onPointerMoveHandle}
        onPointerUp={onPointerUpHandle}
        onPointerCancel={onPointerUpHandle}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white">
              <PhoneIncoming size={16} />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-emerald-500 bg-white" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-100">Eingehender Anruf</p>
              <p className="text-sm font-semibold text-white leading-tight">{callerLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide ${
              liveMode === "live" ? "bg-white/20 text-white" :
              liveMode === "polling" ? "bg-white/15 text-emerald-100" :
              "bg-white/10 text-emerald-200"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${liveMode === "live" ? "bg-white animate-pulse" : liveMode === "polling" ? "bg-emerald-200" : "bg-emerald-300"}`} />
              {liveMode === "live" ? "Live" : liveMode === "polling" ? "Polling" : "…"}
            </span>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={closePopup}
              className="rounded-lg bg-white/15 p-1 text-white hover:bg-white/25"
              title="Schließen (Esc)"
              aria-label="Schließen"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Caller info */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 rounded-xl border border-sand-200 bg-sand-50 px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600">
            <Phone size={14} />
          </div>
          <div className="min-w-0">
            {hasCustomer ? (
              <>
                <p className="text-sm font-semibold text-sand-900 leading-tight">{context.customerName}</p>
                {context.phone ? <p className="text-xs text-sand-500 mt-0.5">{context.phone}</p> : null}
              </>
            ) : (
              <p className="text-sm font-medium text-sand-700">{context.phone || "Nummer nicht übermittelt"}</p>
            )}
          </div>
        </div>

        {/* Task input */}
        {createdTask ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-emerald-800">Aufgabe erstellt</p>
              <p className="mt-0.5 truncate text-xs text-emerald-700">{createdTask.title || "Aufgabe"}</p>
            </div>
          </div>
        ) : (
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) createQuickTask(); }}
            placeholder="Aufgabe notieren… (Strg+Enter zum Speichern)"
            rows={3}
            autoFocus
            className="mt-3 w-full resize-none rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm text-sand-900 placeholder:text-sand-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 border-t border-sand-100 bg-sand-50/70 px-4 py-3">
        <div className="flex-1">
          {status ? (
            <p className={`text-xs font-medium ${status.includes("Fehler") ? "text-rose-600" : "text-emerald-700"}`}>
              {status}
            </p>
          ) : (
            <p className="text-[10px] text-sand-400">Esc zum Schließen</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {createdTask ? (
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("qt:open-sevdesk-draft", { detail: { task: createdTask } }));
                setCreatedTask(null);
                closePopup();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              <ArrowRight size={13} /> In sevDesk
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={closePopup}
                className="rounded-xl border border-sand-200 bg-white px-3 py-1.5 text-xs text-sand-700 hover:bg-sand-50"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={createQuickTask}
                disabled={!title.trim() || saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sand-900 bg-sand-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-sand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                Speichern
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
