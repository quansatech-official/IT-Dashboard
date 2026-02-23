import { useEffect, useMemo, useState } from "react";
import { Boxes, Check, Pencil, Plus, RefreshCw, ScanSearch, Server, Trash2, Wifi, X } from "lucide-react";

const API = "/api";
const EVENT_TYPE_OPTIONS = [
  { value: "wartung", label: "Wartung" },
  { value: "tausch", label: "Austausch" },
  { value: "update", label: "Update" },
  { value: "pruefung", label: "Prüfung" },
  { value: "stoerung", label: "Störung" }
];
const QUICK_EVENTS = [
  { type: "tausch", text: "USV Akku getauscht" },
  { type: "update", text: "Firewall Firmware aktualisiert" },
  { type: "pruefung", text: "Backup Restore-Test durchgeführt" },
  { type: "wartung", text: "Wartung vor Ort durchgeführt" }
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const managedDeviceKey = (device, index) => {
  const agentId = String(device?.agentId || "").trim();
  if (agentId) return `agent:${agentId}`;
  const hostname = String(device?.hostname || "").trim().toLowerCase();
  const site = String(device?.site || "").trim().toLowerCase();
  return `managed:${hostname}:${site}:${index}`;
};
const discoveredDeviceKey = (device, index) => {
  const mac = String(device?.mac || "").trim().toLowerCase();
  const ip = String(device?.ip || "").trim().toLowerCase();
  const hostname = String(device?.hostname || "").trim().toLowerCase();
  if (mac) return `disc-mac:${mac}`;
  if (ip) return `disc-ip:${ip}`;
  if (hostname) return `disc-host:${hostname}`;
  return `disc:${index}`;
};

const formatLastSeen = (value) => {
  if (value === null || typeof value === "undefined") return "n/a";
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value).toLocaleString("de-DE");
  }
  const text = String(value || "").trim();
  if (!text) return "n/a";
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleString("de-DE");
  return text;
};

const lifecycleBadge = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "expired") {
    return { label: "EOL erreicht", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }
  if (normalized === "soon") {
    return { label: "EOL bald", className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  return { label: "Im Support", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
};

export default function CustomerInventoryTab({ customerId }) {
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState("idle");
  const [discoveryRun, setDiscoveryRun] = useState({ status: "idle", message: "", error: "" });
  const [events, setEvents] = useState([]);
  const [eventsStatus, setEventsStatus] = useState("idle");
  const [eventsError, setEventsError] = useState("");
  const [deviceStates, setDeviceStates] = useState([]);
  const [stateBusyKey, setStateBusyKey] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [eventSaving, setEventSaving] = useState(false);
  const [eventDraft, setEventDraft] = useState({
    device_label: "",
    event_type: "wartung",
    event_date: todayIso(),
    note: ""
  });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    device_label: "",
    event_type: "wartung",
    event_date: "",
    note: ""
  });

  const load = async (refresh = false) => {
    if (!customerId) return;
    setStatus("loading");
    try {
      const response = await fetch(`${API}/customers/${customerId}/development?refresh=${refresh ? "1" : "0"}`);
      if (!response.ok) throw new Error("inventory_load_failed");
      const data = await response.json();
      setContext(data || null);
      setStatus("ready");
      if ((data?.managedInfrastructureDevices || []).length > 0) {
        setDiscoveryRun((prev) => {
          const message = String(prev?.message || "").toLowerCase();
          const error = String(prev?.error || "").toLowerCase();
          if (!message.includes("keine zugeordneten rmm-agenten") && !error.includes("keine zugeordneten rmm-agenten")) {
            return prev;
          }
          return { status: "idle", message: "", error: "" };
        });
      }
    } catch {
      setStatus("error");
    }
  };

  const runDiscovery = async () => {
    if (!customerId) return;
    setDiscoveryRun({ status: "loading", message: "", error: "" });
    try {
      const response = await fetch(`${API}/customers/${customerId}/development/discovery_run`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof data?.detail === "string" && data.detail.trim() ? data.detail.trim() : "Discovery konnte nicht gestartet werden";
        throw new Error(message);
      }
      setDiscoveryRun({
        status: "done",
        message:
          typeof data?.message === "string" && data.message.trim()
            ? data.message.trim()
            : "Discovery gestartet. Ergebnisse werden nach Abschluss in Inventar sichtbar.",
        error: ""
      });
      await load(true);
    } catch (error) {
      setDiscoveryRun({
        status: "error",
        message: "",
        error: error?.message ? String(error.message) : "Discovery konnte nicht gestartet werden"
      });
    }
  };

  const loadEvents = async () => {
    if (!customerId) return;
    setEventsStatus("loading");
    setEventsError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_events`);
      if (!response.ok) throw new Error("inventory_events_load_failed");
      const data = await response.json();
      setEvents(Array.isArray(data) ? data : []);
      setEventsStatus("ready");
    } catch {
      setEventsStatus("error");
      setEventsError("Inventar-Historie konnte nicht geladen werden.");
    }
  };

  const loadDeviceStates = async () => {
    if (!customerId) return;
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_device_states`);
      if (!response.ok) throw new Error("inventory_states_load_failed");
      const data = await response.json();
      setDeviceStates(Array.isArray(data) ? data : []);
    } catch {
      setDeviceStates([]);
    }
  };

  const upsertDeviceState = async ({ source, deviceKey, label, retired }) => {
    if (!customerId || !source || !deviceKey) return;
    const busyKey = `${source}:${deviceKey}`;
    setStateBusyKey(busyKey);
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_device_states`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          device_key: deviceKey,
          device_label: label || "",
          retired: Boolean(retired),
          note: ""
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error("state_upsert_failed");
      setDeviceStates((prev) => {
        const idx = prev.findIndex(
          (item) => String(item?.source || "") === String(data?.source || "") && String(item?.device_key || "") === String(data?.device_key || "")
        );
        if (idx === -1) return [data, ...prev];
        const next = prev.slice();
        next[idx] = data;
        return next;
      });
    } catch {
      setEventsError("Status konnte nicht gespeichert werden.");
    } finally {
      setStateBusyKey("");
    }
  };

  const createEvent = async () => {
    if (!customerId || eventSaving) return;
    if (!String(eventDraft.note || "").trim()) {
      setEventsError("Bitte mindestens eine Notiz eingeben.");
      return;
    }
    setEventSaving(true);
    setEventsError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_label: String(eventDraft.device_label || "").trim(),
          event_type: String(eventDraft.event_type || "wartung").trim().toLowerCase(),
          event_date: String(eventDraft.event_date || "").trim(),
          note: String(eventDraft.note || "").trim()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "Eintrag konnte nicht gespeichert werden.");
      setEvents((prev) => [data, ...prev]);
      setEventDraft({
        device_label: "",
        event_type: eventDraft.event_type || "wartung",
        event_date: todayIso(),
        note: ""
      });
    } catch (error) {
      setEventsError(error?.message ? String(error.message) : "Eintrag konnte nicht gespeichert werden.");
    } finally {
      setEventSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditDraft({
      device_label: String(item?.device_label || ""),
      event_type: String(item?.event_type || "wartung"),
      event_date: String(item?.event_date || ""),
      note: String(item?.note || "")
    });
  };

  const saveEdit = async () => {
    if (!customerId || !editingId) return;
    if (!String(editDraft.note || "").trim()) {
      setEventsError("Bitte mindestens eine Notiz eingeben.");
      return;
    }
    setEventSaving(true);
    setEventsError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_events/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_label: String(editDraft.device_label || "").trim(),
          event_type: String(editDraft.event_type || "wartung").trim().toLowerCase(),
          event_date: String(editDraft.event_date || "").trim(),
          note: String(editDraft.note || "").trim()
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "Eintrag konnte nicht aktualisiert werden.");
      setEvents((prev) => prev.map((entry) => (entry.id === data.id ? data : entry)));
      setEditingId(null);
    } catch (error) {
      setEventsError(error?.message ? String(error.message) : "Eintrag konnte nicht aktualisiert werden.");
    } finally {
      setEventSaving(false);
    }
  };

  const deleteEvent = async (eventId) => {
    if (!customerId || !eventId) return;
    if (!window.confirm("Eintrag wirklich löschen?")) return;
    setEventsError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_events/${eventId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete_failed");
      setEvents((prev) => prev.filter((item) => item.id !== eventId));
      if (editingId === eventId) setEditingId(null);
    } catch {
      setEventsError("Eintrag konnte nicht gelöscht werden.");
    }
  };

  useEffect(() => {
    setDiscoveryRun({ status: "idle", message: "", error: "" });
    load(false);
    loadEvents();
    loadDeviceStates();
  }, [customerId]);

  const managed = useMemo(() => (Array.isArray(context?.managedInfrastructureDevices) ? context.managedInfrastructureDevices : []), [context]);
  const discovered = useMemo(
    () => (Array.isArray(context?.discoveredInfrastructureDevices) ? context.discoveredInfrastructureDevices : []),
    [context]
  );

  const mix = context?.infra?.inventoryMix && typeof context.infra.inventoryMix === "object" ? context.infra.inventoryMix : {};
  const mixEntries = Object.entries(mix).filter(([, value]) => Number(value || 0) > 0);
  const retiredMap = useMemo(() => {
    const map = new Map();
    (deviceStates || []).forEach((entry) => {
      const source = String(entry?.source || "");
      const key = String(entry?.device_key || "");
      if (source && key) {
        map.set(`${source}:${key}`, Boolean(entry?.retired));
      }
    });
    return map;
  }, [deviceStates]);
  const isVisibleByFilter = (retired) => {
    if (deviceFilter === "active") return !retired;
    if (deviceFilter === "retired") return retired;
    return true;
  };
  const managedWithState = useMemo(
    () =>
      managed.map((device, index) => {
        const deviceKey = managedDeviceKey(device, index);
        const retired = Boolean(retiredMap.get(`rmm:${deviceKey}`));
        return { device, index, deviceKey, retired };
      }),
    [managed, retiredMap]
  );
  const discoveredWithState = useMemo(
    () =>
      discovered.map((device, index) => {
        const deviceKey = discoveredDeviceKey(device, index);
        const retired = Boolean(retiredMap.get(`discovery:${deviceKey}`));
        return { device, index, deviceKey, retired };
      }),
    [discovered, retiredMap]
  );
  const visibleManaged = useMemo(
    () => managedWithState.filter((entry) => isVisibleByFilter(entry.retired)),
    [managedWithState, deviceFilter]
  );
  const visibleDiscovered = useMemo(
    () => discoveredWithState.filter((entry) => isVisibleByFilter(entry.retired)),
    [discoveredWithState, deviceFilter]
  );
  const totalDevices = managedWithState.length + discoveredWithState.length;
  const totalRetired =
    managedWithState.filter((entry) => entry.retired).length + discoveredWithState.filter((entry) => entry.retired).length;
  const totalActive = Math.max(0, totalDevices - totalRetired);

  if (!customerId) {
    return <p className="text-sm text-sand-500">Kein Kunde ausgewählt.</p>;
  }

  if (status === "error") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        Inventar konnte nicht geladen werden.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Inventar</p>
          <h3 className="text-lg font-display text-sand-900">RMM + Discovery</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(true)}
            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
          >
            <RefreshCw size={12} />
            Aktualisieren
          </button>
          <button
            type="button"
            onClick={runDiscovery}
            className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
          >
            <ScanSearch size={12} />
            Discovery starten
          </button>
        </div>
      </div>

      {discoveryRun.status === "loading" ? <p className="text-xs text-sand-500">Discovery läuft…</p> : null}
      {discoveryRun.message ? <p className="text-xs text-emerald-700">{discoveryRun.message}</p> : null}
      {discoveryRun.error ? <p className="text-xs text-rose-600">{discoveryRun.error}</p> : null}

      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">RMM Agents</p>
          <p className="text-sm font-semibold text-sand-900">{managed.length}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Discovery Geräte</p>
          <p className="text-sm font-semibold text-sand-900">{discovered.length}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Fehler/Warnungen</p>
          <p className="text-sm text-sand-700">
            {Number(context?.infra?.errorCount || 0)} / {Number(context?.infra?.warningCount || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Offene Updates</p>
          <p className="text-sm text-sand-700">{Number(context?.infra?.openUpdates || 0)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2">
        <p className="text-xs text-sand-600">
          Geräte gesamt {totalDevices} · aktiv {totalActive} · ausgeschieden {totalRetired}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDeviceFilter("all")}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              deviceFilter === "all" ? "border-sand-900 bg-sand-900 text-white" : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            }`}
          >
            Alle
          </button>
          <button
            type="button"
            onClick={() => setDeviceFilter("active")}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              deviceFilter === "active"
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Aktiv
          </button>
          <button
            type="button"
            onClick={() => setDeviceFilter("retired")}
            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
              deviceFilter === "retired"
                ? "border-slate-700 bg-slate-700 text-white"
                : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            Ausgeschieden
          </button>
        </div>
      </div>

      {context?.infra?.rmmMappingHint && managed.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">{context.infra.rmmMappingHint}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-sand-200 bg-white p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Inventar-Historie (schnelle Pflege)</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_EVENTS.map((entry, idx) => (
            <button
              key={`${entry.type}-${idx}`}
              type="button"
              onClick={() =>
                setEventDraft((prev) => ({
                  ...prev,
                  event_type: entry.type,
                  note: prev.note ? `${prev.note}\n${entry.text}` : entry.text
                }))
              }
              className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              + {entry.text}
            </button>
          ))}
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-12">
          <input
            value={eventDraft.device_label}
            onChange={(event) => setEventDraft((prev) => ({ ...prev, device_label: event.target.value }))}
            placeholder="Gerät, z. B. USV Serverraum"
            className="md:col-span-3 rounded-xl border border-sand-200 px-2.5 py-1.5 text-xs"
          />
          <select
            value={eventDraft.event_type}
            onChange={(event) => setEventDraft((prev) => ({ ...prev, event_type: event.target.value }))}
            className="md:col-span-2 rounded-xl border border-sand-200 px-2.5 py-1.5 text-xs"
          >
            {EVENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={eventDraft.event_date}
            onChange={(event) => setEventDraft((prev) => ({ ...prev, event_date: event.target.value }))}
            className="md:col-span-2 rounded-xl border border-sand-200 px-2.5 py-1.5 text-xs"
          />
          <input
            value={eventDraft.note}
            onChange={(event) => setEventDraft((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="Ereignis / Notiz, z. B. Letzter Akkutausch erfolgreich."
            className="md:col-span-4 rounded-xl border border-sand-200 px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={createEvent}
            disabled={eventSaving}
            className="md:col-span-1 inline-flex items-center justify-center gap-1 rounded-xl border border-sand-200 bg-white px-2 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:opacity-60"
            title="Eintrag speichern"
          >
            <Plus size={12} />
          </button>
        </div>
        {eventsError ? <p className="mt-1 text-xs text-rose-600">{eventsError}</p> : null}
        <div className="mt-2 space-y-2">
          {events.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <div key={item.id} className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2 text-xs">
                {isEditing ? (
                  <div className="grid gap-2 md:grid-cols-12">
                    <input
                      value={editDraft.device_label}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, device_label: event.target.value }))}
                      className="md:col-span-3 rounded-lg border border-sand-200 px-2 py-1"
                    />
                    <select
                      value={editDraft.event_type}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, event_type: event.target.value }))}
                      className="md:col-span-2 rounded-lg border border-sand-200 px-2 py-1"
                    >
                      {EVENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={editDraft.event_date}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, event_date: event.target.value }))}
                      className="md:col-span-2 rounded-lg border border-sand-200 px-2 py-1"
                    />
                    <input
                      value={editDraft.note}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, note: event.target.value }))}
                      className="md:col-span-3 rounded-lg border border-sand-200 px-2 py-1"
                    />
                    <div className="md:col-span-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={eventSaving}
                        className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sand-900">
                        {item?.device_label || "Allgemein"} · {String(item?.event_type || "wartung").toUpperCase()}
                      </p>
                      <p className="text-[11px] text-sand-500">{item?.event_date || "ohne Datum"}</p>
                      <p className="mt-0.5 text-[11px] text-sand-700">{item?.note || ""}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center justify-center rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-100"
                        title="Bearbeiten"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEvent(item.id)}
                        className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100"
                        title="Löschen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!events.length && eventsStatus !== "loading" ? (
            <p className="text-xs text-sand-500">Noch keine Inventar-Ereignisse erfasst.</p>
          ) : null}
          {eventsStatus === "loading" ? <p className="text-xs text-sand-500">Lade Historie…</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <Server size={14} className="text-sand-600" />
          <p className="text-xs uppercase tracking-[0.2em] text-sand-500">RMM Geräte</p>
        </div>
        <div className="space-y-2">
          {visibleManaged.length ? (
            visibleManaged.map(({ device, index, deviceKey, retired }) => {
              const life = lifecycleBadge(device?.lifecycle?.status);
              const busy = stateBusyKey === `rmm:${deviceKey}`;
              return (
                <div
                  key={`${device?.agentId || index}`}
                  className={`rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs ${retired ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-sand-900">{device?.hostname || "Unbekanntes Gerät"}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          device?.online
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {device?.online ? "Online" : "Offline"}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${life.className}`}>
                        {life.label}
                      </span>
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                        E {Number(device?.errorCount || 0)}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                        W {Number(device?.warningCount || 0)}
                      </span>
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-700">
                        U {Number(device?.openUpdates || 0)}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          upsertDeviceState({
                            source: "rmm",
                            deviceKey,
                            label: String(device?.hostname || device?.agentId || ""),
                            retired: !retired
                          })
                        }
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          retired
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                        title="Gerät als ausgeschieden markieren"
                      >
                        {busy ? "..." : retired ? "Ausgeschieden" : "Aktiv"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-sand-600">
                    {device?.client || "Client n/a"} · {device?.site || "Site n/a"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-sand-600">OS: {device?.os || "n/a"}</p>
                  <p className="mt-0.5 text-[11px] text-sand-500">Last Seen: {formatLastSeen(device?.lastSeen)}</p>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-sand-500">
              {managed.length ? "Keine RMM-Geräte für den aktuellen Filter." : "Keine zugeordneten RMM-Agenten gefunden."}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2">
          <Wifi size={14} className="text-sand-600" />
          <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Discovery Geräte</p>
        </div>
        {mixEntries.length ? (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {mixEntries.map(([key, value]) => (
              <span key={key} className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-700">
                {key}: {Number(value || 0)}
              </span>
            ))}
          </div>
        ) : null}
        <div className="space-y-2">
          {visibleDiscovered.length ? (
            visibleDiscovered.map(({ device, index, deviceKey, retired }) => {
              const busy = stateBusyKey === `discovery:${deviceKey}`;
              return (
                <div
                  key={`${device?.ip || device?.mac || device?.hostname || index}`}
                  className={`rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs ${retired ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-sand-900">{device?.hostname || device?.ip || "Discovery Gerät"}</p>
                    <div className="flex items-center gap-1.5">
                    {device?.deviceType ? (
                      <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-600">
                        {device.deviceType}
                      </span>
                    ) : null}
                    {device?.managed ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">
                        Managed
                      </span>
                    ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          upsertDeviceState({
                            source: "discovery",
                            deviceKey,
                            label: String(device?.hostname || device?.ip || device?.mac || ""),
                            retired: !retired
                          })
                        }
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          retired
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                        title="Gerät als ausgeschieden markieren"
                      >
                        {busy ? "..." : retired ? "Ausgeschieden" : "Aktiv"}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-sand-600">
                    IP: {device?.ip || "n/a"} · MAC: {device?.mac || "n/a"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-sand-600">
                    Hersteller: {device?.vendor || "n/a"} · Protokoll: {device?.protocol || "n/a"} · Confidence:{" "}
                    {Number(device?.confidence || 0)}%
                  </p>
                  <p className="mt-0.5 text-[11px] text-sand-500">Last Seen: {formatLastSeen(device?.lastSeenAt)}</p>
                </div>
              );
            })
          ) : (
            <p className="text-xs text-sand-500">
              {discovered.length ? "Keine Discovery-Geräte für den aktuellen Filter." : "Noch keine Discovery-Geräte vorhanden."}
            </p>
          )}
        </div>
      </div>

      {status === "loading" ? (
        <p className="inline-flex items-center gap-1 text-xs text-sand-500">
          <Boxes size={12} /> Inventar wird geladen…
        </p>
      ) : null}
    </div>
  );
}
