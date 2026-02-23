import { useEffect, useMemo, useState } from "react";
import { Boxes, Check, RefreshCw, ScanSearch, Search, Server, Wifi } from "lucide-react";

const API = "/api";

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

const compactText = (value) => String(value || "").trim();

export default function CustomerInventoryTab({ customerId }) {
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState("idle");
  const [discoveryRun, setDiscoveryRun] = useState({ status: "idle", message: "", error: "" });
  const [deviceStates, setDeviceStates] = useState([]);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [stateBusyKey, setStateBusyKey] = useState("");
  const [stateError, setStateError] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});

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
      if (data && data.started === false) {
        setDiscoveryRun({
          status: "ready",
          message: typeof data?.hint === "string" && data.hint.trim() ? data.hint.trim() : "Discovery nicht gestartet.",
          error: ""
        });
        return;
      }
      const serverMessage = typeof data?.message === "string" ? data.message.trim() : "";
      const serverHint = typeof data?.hint === "string" ? data.hint.trim() : "";
      setDiscoveryRun({
        status: "done",
        message: serverMessage || `Discovery gestartet.${serverHint ? ` ${serverHint}` : ""}`.trim(),
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

  const upsertDeviceState = async ({ source, deviceKey, label, retired, note }) => {
    if (!customerId || !source || !deviceKey) return;
    const busyKey = `${source}:${deviceKey}`;
    setStateBusyKey(busyKey);
    setStateError("");
    try {
      const response = await fetch(`${API}/customers/${customerId}/inventory_device_states`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          device_key: deviceKey,
          device_label: label || "",
          retired: Boolean(retired),
          note: compactText(note)
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
      setNoteDrafts((prev) => ({ ...prev, [busyKey]: String(data?.note || "") }));
    } catch {
      setStateError("Änderung konnte nicht gespeichert werden.");
    } finally {
      setStateBusyKey("");
    }
  };

  useEffect(() => {
    setDiscoveryRun({ status: "idle", message: "", error: "" });
    setStateError("");
    setNoteDrafts({});
    load(false);
    loadDeviceStates();
  }, [customerId]);

  const managed = useMemo(() => (Array.isArray(context?.managedInfrastructureDevices) ? context.managedInfrastructureDevices : []), [context]);
  const discovered = useMemo(
    () => (Array.isArray(context?.discoveredInfrastructureDevices) ? context.discoveredInfrastructureDevices : []),
    [context]
  );

  const stateMap = useMemo(() => {
    const map = new Map();
    (deviceStates || []).forEach((entry) => {
      const source = String(entry?.source || "").trim().toLowerCase();
      const key = String(entry?.device_key || "");
      if (!source || !key) return;
      map.set(`${source}:${key}`, entry);
    });
    return map;
  }, [deviceStates]);

  const unifiedDevices = useMemo(() => {
    const rows = [];

    managed.forEach((device, index) => {
      const deviceKey = managedDeviceKey(device, index);
      const compositeKey = `rmm:${deviceKey}`;
      const state = stateMap.get(compositeKey);
      rows.push({
        rowKey: `row:${compositeKey}`,
        source: "rmm",
        sourceLabel: "RMM",
        sourceIcon: "rmm",
        label: compactText(device?.hostname) || compactText(device?.agentId) || "Unbekanntes Gerät",
        secondary:
          [
            compactText(device?.os) ? `OS: ${compactText(device?.os)}` : "",
            compactText(device?.site) ? `Site: ${compactText(device?.site)}` : ""
          ]
            .filter(Boolean)
            .join(" · ") || "Keine Detaildaten",
        tertiary: `Last Seen: ${formatLastSeen(device?.lastSeen)}`,
        online: Boolean(device?.online),
        deviceKey,
        retired: Boolean(state?.retired),
        inactive: false,
        note: compactText(state?.note)
      });
    });

    discovered.forEach((device, index) => {
      const deviceKey = discoveredDeviceKey(device, index);
      const compositeKey = `discovery:${deviceKey}`;
      const state = stateMap.get(compositeKey);
      rows.push({
        rowKey: `row:${compositeKey}`,
        source: "discovery",
        sourceLabel: "Discovery",
        sourceIcon: "discovery",
        label: compactText(device?.hostname) || compactText(device?.ip) || compactText(device?.mac) || "Discovery Gerät",
        secondary:
          [
            compactText(device?.deviceType) ? `Typ: ${compactText(device?.deviceType)}` : "",
            compactText(device?.vendor) ? `Hersteller: ${compactText(device?.vendor)}` : "",
            compactText(device?.ip) ? `IP: ${compactText(device?.ip)}` : "",
            compactText(device?.mac) ? `MAC: ${compactText(device?.mac)}` : ""
          ]
            .filter(Boolean)
            .join(" · ") || "Keine Detaildaten",
        tertiary: `Last Seen: ${formatLastSeen(device?.lastSeenAt)}`,
        online: null,
        deviceKey,
        retired: Boolean(state?.retired),
        inactive: device?.active === false,
        note: compactText(state?.note)
      });
    });

    rows.sort((a, b) => {
      const retiredDelta = Number(a.retired) - Number(b.retired);
      if (retiredDelta !== 0) return retiredDelta;
      const inactiveDelta = Number(a.inactive) - Number(b.inactive);
      if (inactiveDelta !== 0) return inactiveDelta;
      const sourceDelta = a.source === b.source ? 0 : a.source === "rmm" ? -1 : 1;
      if (sourceDelta !== 0) return sourceDelta;
      return a.label.localeCompare(b.label, "de", { sensitivity: "base" });
    });

    return rows;
  }, [managed, discovered, stateMap]);

  useEffect(() => {
    setNoteDrafts((prev) => {
      const next = {};
      let changed = false;
      unifiedDevices.forEach((entry) => {
        const key = `${entry.source}:${entry.deviceKey}`;
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key];
          return;
        }
        next[key] = entry.note || "";
        changed = true;
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (!changed && prevKeys.length === nextKeys.length && prevKeys.every((key) => prev[key] === next[key])) {
        return prev;
      }
      return next;
    });
  }, [unifiedDevices]);

  const filteredDevices = useMemo(() => {
    const query = compactText(searchTerm).toLowerCase();
    return unifiedDevices.filter((entry) => {
      if (deviceFilter === "active" && (entry.retired || entry.inactive)) return false;
      if (deviceFilter === "retired" && !entry.retired) return false;
      if (!query) return true;
      const haystack = [
        entry.label,
        entry.sourceLabel,
        entry.secondary,
        entry.tertiary,
        entry.inactive ? "inaktiv" : "aktiv",
        noteDrafts[`${entry.source}:${entry.deviceKey}`] || entry.note || ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [deviceFilter, noteDrafts, searchTerm, unifiedDevices]);

  const totalDevices = unifiedDevices.length;
  const totalRetired = unifiedDevices.filter((entry) => entry.retired).length;
  const totalInactive = unifiedDevices.filter((entry) => entry.inactive).length;
  const totalActive = Math.max(0, totalDevices - totalRetired - totalInactive);

  const saveNote = async (entry) => {
    const noteKey = `${entry.source}:${entry.deviceKey}`;
    await upsertDeviceState({
      source: entry.source,
      deviceKey: entry.deviceKey,
      label: entry.label,
      retired: entry.retired,
      note: noteDrafts[noteKey] ?? ""
    });
  };

  const toggleRetired = async (entry) => {
    const noteKey = `${entry.source}:${entry.deviceKey}`;
    await upsertDeviceState({
      source: entry.source,
      deviceKey: entry.deviceKey,
      label: entry.label,
      retired: !entry.retired,
      note: noteDrafts[noteKey] ?? entry.note ?? ""
    });
  };

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
          <h3 className="text-lg font-display text-sand-900">Geräteübersicht</h3>
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
      {stateError ? <p className="text-xs text-rose-600">{stateError}</p> : null}

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Gesamt</p>
          <p className="text-sm font-semibold text-sand-900">{totalDevices}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Aktiv</p>
          <p className="text-sm font-semibold text-emerald-700">{totalActive}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Ausgeschieden</p>
          <p className="text-sm font-semibold text-slate-700">{totalRetired}</p>
        </div>
        <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-sand-500">Discovery Inaktiv</p>
          <p className="text-sm font-semibold text-amber-700">{totalInactive}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-xs text-sand-600">
          <Search size={12} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Gerät, IP, OS, Notiz..."
            className="w-44 bg-transparent text-xs outline-none placeholder:text-sand-400"
          />
        </div>
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

      <div className="rounded-2xl border border-sand-200 bg-white">
        <div className="border-b border-sand-200 px-3 py-2 text-xs text-sand-600">
          Einheitliche Liste aus RMM und Discovery. Pro Gerät nur Status und Anmerkung pflegen.
        </div>
        <div className="divide-y divide-sand-200">
          {filteredDevices.length ? (
            filteredDevices.map((entry, index) => {
              const noteKey = `${entry.source}:${entry.deviceKey}`;
              const busy = stateBusyKey === noteKey;
              const draftNote = noteDrafts[noteKey] ?? "";
              const noteChanged = draftNote !== (entry.note || "");
              const rowBackground = index % 2 === 0 ? "bg-white" : "bg-sand-50/70";
              return (
                <div key={entry.rowKey} className={`${rowBackground} px-3 py-2`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className={`min-w-[220px] flex-1 ${entry.retired || entry.inactive ? "opacity-60" : ""}`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {entry.sourceIcon === "rmm" ? <Server size={13} className="text-sand-500" /> : <Wifi size={13} className="text-sand-500" />}
                        <p className="text-sm font-semibold text-sand-900">{entry.label}</p>
                        <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-600">
                          {entry.sourceLabel}
                        </span>
                        {entry.inactive ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700">
                            Inaktiv
                          </span>
                        ) : null}
                        {entry.online === true ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">
                            Online
                          </span>
                        ) : null}
                        {entry.online === false ? (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-700">
                            Offline
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-sand-600">{entry.secondary}</p>
                      <p className="mt-0.5 text-[11px] text-sand-500">{entry.tertiary}</p>
                    </div>
                    <div className="flex min-w-[260px] flex-1 flex-wrap items-center justify-end gap-1.5">
                      <input
                        value={draftNote}
                        onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [noteKey]: event.target.value }))}
                        placeholder="Anmerkung, z. B. letzter Akkutausch 02/2026"
                        className="w-full min-w-[220px] flex-1 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => saveNote(entry)}
                        disabled={busy || !noteChanged}
                        className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Anmerkung speichern"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRetired(entry)}
                        disabled={busy}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] uppercase tracking-wide ${
                          entry.retired
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {busy ? "..." : entry.retired ? "Ausgeschieden" : "Aktiv"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="px-3 py-3 text-xs text-sand-500">
              {totalDevices ? "Keine Geräte für den aktuellen Filter gefunden." : "Noch keine Geräte vorhanden."}
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
