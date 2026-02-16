import { useEffect, useMemo, useRef, useState } from "react";
import { FilePlus, Save, X } from "lucide-react";
import { telephonyService } from "./telephonyService";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getDefaultPosition = () => {
  if (typeof window === "undefined") return { x: 24, y: 24 };
  const width = 430;
  return {
    x: Math.max(8, window.innerWidth - width - 24),
    y: 20
  };
};

export default function IncomingCallQuickTaskPopup() {
  const [calls, setCalls] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pbxEntries, setPbxEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [callUuid, setCallUuid] = useState("");
  const [context, setContext] = useState({
    customerName: "",
    customerNumber: "",
    phone: "",
    startedAt: 0
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [liveMode, setLiveMode] = useState("connecting");
  const [dismissedCallUuid, setDismissedCallUuid] = useState("");
  const [position, setPosition] = useState(getDefaultPosition);

  const dragRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });

  const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");

  const displayNumber = (call) => {
    const direction = call?.direction?.toLowerCase() || "";
    if (direction.includes("out")) return call?.to || call?.from || "";
    return call?.from || call?.to || "";
  };

  const customerByPhone = useMemo(() => {
    const map = new Map();
    (Array.isArray(customers) ? customers : []).forEach((customer) => {
      const phones = Array.isArray(customer?.phones) ? customer.phones : [];
      phones.forEach((phone) => {
        const number = normalizeDigits(phone?.number);
        if (!number) return;
        map.set(number, {
          name: customer?.name || "",
          number: customer?.creditor_number || ""
        });
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
      const activeCall = !end || end < start;
      if (!activeCall) return false;
      return now - start < 4 * 60 * 60 * 1000;
    });
    if (!incoming.length) return null;
    return incoming.sort((a, b) => Number(b?.startTime || 0) - Number(a?.startTime || 0))[0];
  }, [calls]);

  const incomingMeta = useMemo(() => {
    const call = activeIncomingCall;
    if (!call) {
      return { customerName: "", customerNumber: "", phone: "", startedAt: 0 };
    }
    const phone = displayNumber(call);
    const key = normalizeDigits(phone);
    const customerMatch = key ? customerByPhone.get(key) : null;
    const pbxName = key ? pbxNameByPhone.get(key) : "";
    const customerName =
      customerMatch?.name ||
      String(call?.customerName || "").trim() ||
      String(pbxName || "").trim();
    return {
      customerName,
      customerNumber: customerMatch?.number || "",
      phone,
      startedAt: Number(call?.startTime || 0)
    };
  }, [activeIncomingCall, customerByPhone, pbxNameByPhone]);

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
      source.addEventListener("open", () => {
        if (!active) return;
        setLiveMode("live");
      });
      source.addEventListener("call", (event) => {
        if (!active) return;
        try {
          const payload = JSON.parse(event.data || "{}");
          if (!payload?.uuid) return;
          setCalls((prev) => {
            const without = prev.filter((item) => item.uuid !== payload.uuid);
            return [payload, ...without].slice(0, 120);
          });
        } catch (error) {
          // ignore malformed stream events
        }
      });
      source.addEventListener("error", () => {
        if (!active) return;
        setLiveMode("reconnecting");
      });
    } else {
      setLiveMode("polling");
    }
    const callsInterval = setInterval(loadCalls, 20000);
    const directoryInterval = setInterval(loadDirectoryData, 60000);

    return () => {
      active = false;
      source?.close();
      clearInterval(callsInterval);
      clearInterval(directoryInterval);
    };
  }, []);

  useEffect(() => {
    const call = activeIncomingCall;
    if (!call) {
      setDismissedCallUuid("");
      if (open && !title.trim()) {
        setOpen(false);
        setCallUuid("");
        setStatus("");
      }
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
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 1800);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const onResize = () => {
      const maxX = Math.max(8, window.innerWidth - 380);
      const maxY = Math.max(8, window.innerHeight - 180);
      setPosition((prev) => ({
        x: clamp(prev.x, 8, maxX),
        y: clamp(prev.y, 8, maxY)
      }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const closePopup = () => {
    if (activeIncomingCall?.uuid) {
      setDismissedCallUuid(activeIncomingCall.uuid);
    }
    setOpen(false);
    setTitle("");
    setCallUuid("");
    setContext({ customerName: "", customerNumber: "", phone: "", startedAt: 0 });
    setStatus("");
  };

  const createQuickTask = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setStatus("Speichere Aufgabe...");
    try {
      const detailsParts = [];
      if (context.phone) detailsParts.push(`Anrufnummer: ${context.phone}`);
      if (context.startedAt) {
        detailsParts.push(`Anrufstart: ${new Date(context.startedAt).toLocaleString("de-DE")}`);
      }

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
      const createdTask = await response.json().catch(() => null);
      window.dispatchEvent(
        new CustomEvent("qt:daytask-created", {
          detail: { task: createdTask || null, source: "incoming-call-popup" }
        })
      );

      setStatus("Aufgabe erstellt.");
      setTitle("");
      if (!activeIncomingCall) {
        setOpen(false);
        setCallUuid("");
      }
    } catch (error) {
      setStatus("Aufgabe konnte nicht erstellt werden.");
    } finally {
      setSaving(false);
    }
  };

  const onPointerDownHandle = (event) => {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) return;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMoveHandle = (event) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const maxX = Math.max(8, window.innerWidth - 380);
    const maxY = Math.max(8, window.innerHeight - 120);
    setPosition({
      x: clamp(drag.originX + deltaX, 8, maxX),
      y: clamp(drag.originY + deltaY, 8, maxY)
    });
  };

  const onPointerUpHandle = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  if (!open) return null;

  return (
    <div
      className="fixed z-[70] w-[420px] max-w-[calc(100vw-1rem)] rounded-2xl border border-white/45 bg-white/35 p-3 text-sand-900 shadow-[0_18px_60px_rgba(15,23,42,0.25)] backdrop-blur-xl"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <div
        className="flex items-start justify-between gap-2 cursor-move select-none"
        onPointerDown={onPointerDownHandle}
        onPointerMove={onPointerMoveHandle}
        onPointerUp={onPointerUpHandle}
        onPointerCancel={onPointerUpHandle}
      >
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-sand-900/90 text-white">
            <FilePlus size={14} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-sand-700">Schnellnotiz Anruf</p>
            <p className="text-sm font-semibold text-sand-900">
              {context.customerName || context.phone || "Unbekannter Anrufer"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={closePopup}
          className="rounded-full border border-white/50 bg-white/50 p-1 text-sand-700 hover:bg-white/80"
          title="Schließen"
          aria-label="Schließen"
        >
          <X size={13} />
        </button>
      </div>

      {context.phone ? <p className="mt-2 text-xs text-sand-700">Rufnummer: {context.phone}</p> : null}

      <textarea
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titel der Aufgabe..."
        rows={3}
        className="mt-2 w-full resize-none rounded-xl border border-white/50 bg-white/45 px-2 py-1.5 text-sm text-sand-900 focus:outline-none"
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-sand-700">
          {status ||
            (liveMode === "live"
              ? "Live-Erkennung aktiv."
              : liveMode === "polling"
                ? "Polling-Fallback aktiv."
                : "Verbindung wird aufgebaut...")}
        </p>
        <button
          type="button"
          onClick={createQuickTask}
          disabled={!title.trim() || saving}
          className="inline-flex items-center gap-1 rounded-full border border-sand-900 bg-sand-900 px-3 py-1.5 text-[10px] uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={12} /> Speichern
        </button>
      </div>
    </div>
  );
}
