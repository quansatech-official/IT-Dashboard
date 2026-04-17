import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  Loader2,
  MonitorDown,
  RefreshCw,
  Search,
  Trash2
} from "lucide-react";

const API = "/api";

const packageLabels = {
  tv: "TeamViewer Host",
  tv_rmm: "TeamViewer Host + RMM-Agent",
  rmm: "RMM-Agent"
};

const emptyDraft = {
  id: null,
  customer_id: "",
  customer_name: "",
  package_type: "tv",
  slug: "",
  alias_prefix: "",
  expires_at: "",
  max_installs: "",
  is_active: true,
  internal_note: ""
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = data?.detail;
    if (detail && typeof detail === "object") {
      throw new Error(detail.message || JSON.stringify(detail));
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }
  return data;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function formatDateTime(value) {
  const numeric = Number(value || 0);
  if (!numeric) return "n/a";
  try {
    return new Date(numeric).toLocaleString("de-DE");
  } catch {
    return "n/a";
  }
}

function formatDateInput(value) {
  const numeric = Number(value || 0);
  if (!numeric) return "";
  try {
    return new Date(numeric).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function dateInputToMs(value) {
  if (!value) return null;
  const timestamp = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeLinkForDraft(link) {
  if (!link) return emptyDraft;
  return {
    id: link.id,
    customer_id: link.customerId ? String(link.customerId) : "",
    customer_name: link.customerName || "",
    package_type: link.packageType || "tv",
    slug: link.slug || "",
    alias_prefix: link.aliasPrefix || "",
    expires_at: formatDateInput(link.expiresAt),
    max_installs: link.maxInstalls ? String(link.maxInstalls) : "",
    is_active: Boolean(link.isActive),
    internal_note: link.internalNote || ""
  };
}

function normalizeCustomer(customer) {
  return {
    id: customer?.id,
    name: cleanText(customer?.name),
    shortCode: cleanText(customer?.short_code ?? customer?.shortCode),
    status: cleanText(customer?.status || "active")
  };
}

export default function RemoteDeployPanel() {
  const [links, setLinks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState({});
  const [draft, setDraft] = useState(emptyDraft);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const selectedLink = useMemo(
    () => links.find((link) => Number(link.id) === Number(selectedId)) || null,
    [links, selectedId]
  );

  const customersById = useMemo(() => {
    const map = new Map();
    customers.forEach((customer) => map.set(Number(customer.id), customer));
    return map;
  }, [customers]);

  const filteredLinks = useMemo(() => {
    const search = query.trim().toLowerCase();
    return links.filter((link) => {
      if (customerFilter && String(link.customerId) !== String(customerFilter)) return false;
      if (!search) return true;
      return [link.customerName, link.slug, link.aliasPrefix, packageLabels[link.packageType] || link.packageType]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [customerFilter, links, query]);

  const loadAll = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const [customersData, linksData, settingsData] = await Promise.all([
        fetchJson(`${API}/customers`),
        fetchJson(`${API}/remote-deploy/links`),
        fetchJson(`${API}/remote-deploy/settings`)
      ]);
      setCustomers(Array.isArray(customersData) ? customersData.map(normalizeCustomer) : []);
      setLinks(Array.isArray(linksData) ? linksData : []);
      setSettings(settingsData && typeof settingsData === "object" ? settingsData : {});
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Fernwartungslinks konnten nicht geladen werden.");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadDetail = async (linkId) => {
    if (!linkId) return;
    setStatus("loading");
    setMessage("");
    try {
      const data = await fetchJson(`${API}/remote-deploy/links/${linkId}`);
      setDetail(data);
      setSelectedId(linkId);
      setDraft(normalizeLinkForDraft(data));
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Detail konnte nicht geladen werden.");
    }
  };

  const startCreate = () => {
    setSelectedId(null);
    setDetail(null);
    setDraft({
      ...emptyDraft,
      max_installs: settings.defaultMaxInstalls ? String(settings.defaultMaxInstalls) : ""
    });
    setSuggestions([]);
    setMessage("");
  };

  const suggestSlug = async () => {
    setStatus("loading");
    setMessage("");
    try {
      const customer = customersById.get(Number(draft.customer_id));
      const data = await fetchJson(`${API}/remote-deploy/slug_suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: draft.customer_id ? Number(draft.customer_id) : undefined,
          customer_name: draft.customer_name || customer?.name || "",
          preferred: draft.slug || ""
        })
      });
      const nextSuggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setSuggestions(nextSuggestions);
      if (nextSuggestions[0]) {
        setDraft((prev) => ({ ...prev, slug: nextSuggestions[0] }));
      }
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Kürzel-Vorschlag fehlgeschlagen.");
    }
  };

  const saveDraft = async () => {
    if (!cleanText(draft.customer_name)) {
      setStatus("error");
      setMessage("Bitte einen Kunden angeben.");
      return;
    }
    setStatus("saving");
    setMessage("");
    try {
      const payload = {
        customer_id: draft.customer_id ? Number(draft.customer_id) : null,
        customer_name: cleanText(draft.customer_name),
        package_type: draft.package_type,
        slug: draft.slug,
        alias_prefix: draft.alias_prefix,
        expires_at: dateInputToMs(draft.expires_at),
        max_installs: draft.max_installs ? Number(draft.max_installs) : null,
        is_active: Boolean(draft.is_active),
        internal_note: draft.internal_note
      };
      const url = draft.id ? `${API}/remote-deploy/links/${draft.id}` : `${API}/remote-deploy/links`;
      const method = draft.id ? "PATCH" : "POST";
      const saved = await fetchJson(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      await loadAll();
      await loadDetail(saved.id);
      setStatus("saved");
      setMessage("Fernwartungslink gespeichert.");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Speichern fehlgeschlagen.");
    }
  };

  const patchLink = async (link, patch) => {
    setStatus("saving");
    setMessage("");
    try {
      await fetchJson(`${API}/remote-deploy/links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      await loadAll();
      if (selectedId === link.id) await loadDetail(link.id);
      setStatus("saved");
      setMessage("Status aktualisiert.");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Aktualisierung fehlgeschlagen.");
    }
  };

  const deleteLink = async (link) => {
    if (!window.confirm(`Fernwartungslink-Kürzel "${link.slug}" wirklich löschen?`)) return;
    setStatus("saving");
    setMessage("");
    try {
      await fetchJson(`${API}/remote-deploy/links/${link.id}`, { method: "DELETE" });
      if (selectedId === link.id) startCreate();
      await loadAll();
      setStatus("saved");
      setMessage("Fernwartungslink gelöscht.");
    } catch (error) {
      setStatus("error");
      setMessage(error?.message || "Löschen fehlgeschlagen.");
    }
  };

  const copyLink = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link kopiert.");
      setStatus("saved");
    } catch {
      setMessage("Link konnte nicht kopiert werden.");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Diese Links können öffentlich erreichbar sein. Nur aktive, nicht abgelaufene Links unterhalb der Installationsgrenze
        liefern Konfigurationen an den Deploy-Container aus.
      </section>

      <section className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Fernwartungslink-Generator</p>
            <h2 className="mt-1 text-xl font-display text-sand-900">Links verwalten</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
            >
              <RefreshCw size={13} />
              Aktualisieren
            </button>
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-2 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
            >
              <MonitorDown size={13} />
              Neuer Link
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-400" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-2xl border border-sand-200 py-2 pl-9 pr-3 text-sm"
              placeholder="Kunde, Kürzel oder Alias suchen"
            />
          </label>
          <select
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            className="rounded-2xl border border-sand-200 px-3 py-2 text-sm"
          >
            <option value="">Alle Kunden</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-sand-500">
              <tr>
                <th className="px-3 py-2">Kunde</th>
                <th className="px-3 py-2">Kürzel</th>
                <th className="px-3 py-2">Paket</th>
                <th className="px-3 py-2">Aktiv</th>
                <th className="px-3 py-2">Gültig bis</th>
                <th className="px-3 py-2">Installationen</th>
                <th className="px-3 py-2">Erstellt</th>
                <th className="px-3 py-2 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {filteredLinks.map((link) => (
                <tr key={link.id} className={selectedId === link.id ? "bg-sand-50" : "bg-white"}>
                  <td className="px-3 py-2 font-medium text-sand-900">{link.customerName || "n/a"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => loadDetail(link.id)}
                      className="font-mono text-sand-900 underline decoration-sand-300 underline-offset-2"
                    >
                      {link.slug}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-sand-600">{packageLabels[link.packageType] || link.packageType}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${
                        link.isActive
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-sand-200 bg-sand-100 text-sand-600"
                      }`}
                    >
                      {link.isActive ? "Aktiv" : "Inaktiv"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sand-600">{link.expiresAt ? formatDateTime(link.expiresAt) : "offen"}</td>
                  <td className="px-3 py-2 text-sand-600">
                    {link.currentInstalls || 0}
                    {link.maxInstalls ? ` / ${link.maxInstalls}` : ""}
                  </td>
                  <td className="px-3 py-2 text-sand-600">{formatDateTime(link.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(link.publicUrl)}
                        className="rounded-full border border-sand-200 px-2 py-1 text-[10px] uppercase tracking-wide text-sand-700"
                      >
                        Kopieren
                      </button>
                      <button
                        type="button"
                        onClick={() => patchLink(link, { is_active: !link.isActive })}
                        className="rounded-full border border-sand-200 px-2 py-1 text-[10px] uppercase tracking-wide text-sand-700"
                      >
                        {link.isActive ? "Deaktivieren" : "Aktivieren"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLink(link)}
                        className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] uppercase tracking-wide text-rose-700"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredLinks.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-sand-500">
                    Keine Fernwartungslinks gefunden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                {draft.id ? "Bearbeiten" : "Erstellen"}
              </p>
              <h3 className="mt-1 text-lg font-display text-sand-900">Fernwartungslink</h3>
            </div>
            {status === "loading" || status === "saving" ? <Loader2 className="animate-spin text-sand-500" size={18} /> : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-sand-500">Kunde</label>
              <input
                value={draft.customer_name}
                onChange={(event) => setDraft((prev) => ({ ...prev, customer_name: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                placeholder="z. B. Dr. Mayer"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Optional aus Kundenstamm</label>
              <select
                value={draft.customer_id}
                onChange={(event) => {
                  const customer = customersById.get(Number(event.target.value));
                  setDraft((prev) => ({
                    ...prev,
                    customer_id: event.target.value,
                    customer_name: customer?.name || prev.customer_name,
                    alias_prefix: prev.alias_prefix || customer?.shortCode || customer?.name || ""
                  }));
                }}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              >
                <option value="">Keine Verknüpfung</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-sand-500">Paket</label>
              <select
                value={draft.package_type}
                onChange={(event) => setDraft((prev) => ({ ...prev, package_type: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              >
                <option value="tv">{packageLabels.tv}</option>
                <option value="tv_rmm">{packageLabels.tv_rmm}</option>
                <option value="rmm">{packageLabels.rmm}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-sand-500">Kürzel</label>
              <div className="mt-1 flex gap-2">
                <input
                  value={draft.slug}
                  onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value.toLowerCase() }))}
                  className="min-w-0 flex-1 rounded-xl border border-sand-200 px-3 py-2 font-mono text-sm"
                  placeholder="marek"
                />
                <button
                  type="button"
                  onClick={suggestSlug}
                  className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-[10px] uppercase tracking-wide text-sand-700"
                >
                  Vorschlagen
                </button>
              </div>
              {suggestions.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, slug: item }))}
                      className="rounded-full border border-sand-200 px-2 py-1 font-mono text-[11px] text-sand-700"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <label className="text-xs text-sand-500">Alias-Präfix</label>
              <input
                value={draft.alias_prefix}
                onChange={(event) => setDraft((prev) => ({ ...prev, alias_prefix: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                placeholder="Marek"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Gültig bis</label>
              <input
                type="date"
                value={draft.expires_at}
                onChange={(event) => setDraft((prev) => ({ ...prev, expires_at: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Max. Installationen</label>
              <input
                type="number"
                min="1"
                value={draft.max_installs}
                onChange={(event) => setDraft((prev) => ({ ...prev, max_installs: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
                placeholder="offen"
              />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm text-sand-700">
              <input
                type="checkbox"
                checked={Boolean(draft.is_active)}
                onChange={(event) => setDraft((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Aktiv
            </label>
          </div>

          <p className="mt-4 rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-600">
            TeamViewer-ID, Assignment-ID und RMM Deployment-Link kommen aus der Hintergrundkonfiguration.
          </p>

          <div className="mt-4">
            <label className="text-xs text-sand-500">Interne Notiz</label>
            <textarea
              value={draft.internal_note}
              onChange={(event) => setDraft((prev) => ({ ...prev, internal_note: event.target.value }))}
              className="mt-1 min-h-[90px] w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="inline-flex items-center gap-2 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
            >
              <CheckCircle2 size={14} />
              Speichern
            </button>
            {message ? (
              <span className={`text-xs ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}>
                {message}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Detail</p>
          {selectedLink || detail ? (
            <div className="mt-4 space-y-3 text-sm text-sand-700">
              <div>
                <div className="text-xs text-sand-500">Öffentlicher Link</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-xl bg-sand-100 px-3 py-2 text-xs">
                    {(detail || selectedLink)?.publicUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyLink((detail || selectedLink)?.publicUrl)}
                    className="rounded-xl border border-sand-200 p-2 text-sand-700"
                    title="Link kopieren"
                  >
                    <Clipboard size={14} />
                  </button>
                  <a
                    href={(detail || selectedLink)?.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-sand-200 p-2 text-sand-700"
                    title="Öffentlichen Link öffnen"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                <div><dt className="text-sand-500">Kunde</dt><dd>{(detail || selectedLink)?.customerName}</dd></div>
                <div><dt className="text-sand-500">Paket</dt><dd>{packageLabels[(detail || selectedLink)?.packageType]}</dd></div>
                <div><dt className="text-sand-500">Alias</dt><dd>{(detail || selectedLink)?.aliasPrefix || "n/a"}</dd></div>
                <div><dt className="text-sand-500">Status</dt><dd>{(detail || selectedLink)?.isActive ? "Aktiv" : "Inaktiv"}</dd></div>
                <div><dt className="text-sand-500">Gültigkeit</dt><dd>{(detail || selectedLink)?.expiresAt ? formatDateTime((detail || selectedLink)?.expiresAt) : "offen"}</dd></div>
                <div><dt className="text-sand-500">Verwendungen</dt><dd>{(detail || selectedLink)?.currentInstalls || 0}{(detail || selectedLink)?.maxInstalls ? ` / ${(detail || selectedLink)?.maxInstalls}` : ""}</dd></div>
                <div className="md:col-span-2"><dt className="text-sand-500">Interner Token</dt><dd className="break-all font-mono">{(detail || selectedLink)?.internalToken || "n/a"}</dd></div>
                <div className="md:col-span-2"><dt className="text-sand-500">Notiz</dt><dd>{(detail || selectedLink)?.internalNote || "n/a"}</dd></div>
              </dl>
              {detail?.events?.length ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-sand-500">Letzte Rückmeldungen</p>
                  <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {detail.events.map((event) => (
                      <div key={event.id} className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sand-900">{event.status || event.eventType}</span>
                          <span className="text-sand-500">{formatDateTime(event.createdAt)}</span>
                        </div>
                        <div className="mt-1 text-sand-600">
                          {[event.hostname, event.username, event.deviceAlias].filter(Boolean).join(" · ") || "ohne Gerätedaten"}
                        </div>
                        {event.message ? <div className="mt-1 text-sand-500">{event.message}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-sand-500">Noch keine Rückmeldungen.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-sand-500">Wähle einen Link aus oder erstelle einen neuen.</p>
          )}
        </div>
      </section>
    </div>
  );
}
