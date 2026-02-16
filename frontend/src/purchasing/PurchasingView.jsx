import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  PackageCheck,
  Plus,
  ShoppingCart,
  Trash2,
  Truck
} from "lucide-react";

const API = "/api";
const CUSTOMER_DATALIST_ID = "purchasing-customer-options";

const EMPTY_DRAFT = {
  customer: "",
  title: "",
  sourceUrl: "",
  quantity: "",
  purchasePrice: "",
  salePrice: ""
};

const toCurrency = (value) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR"
  }).format(value);

const parsePrice = (value) => {
  if (typeof value !== "string") return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
};

const normalizeUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const normalizeStatus = (item) => {
  const status = String(item?.status || "").trim().toLowerCase();
  if (status === "open" || status === "ordered" || status === "received") return status;
  return item?.done ? "received" : "open";
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${text}`);
  }
};

const api = {
  list: () => fetchJson(`${API}/purchasing_items`),
  create: (payload) =>
    fetchJson(`${API}/purchasing_items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  update: (id, payload) =>
    fetchJson(`${API}/purchasing_items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  remove: (id) =>
    fetchJson(`${API}/purchasing_items/${id}`, {
      method: "DELETE"
    })
};

export default function PurchasingView() {
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [showReceived, setShowReceived] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const [queryFilter, setQueryFilter] = useState("");
  const saveTimersRef = useRef({});
  const pendingPatchesRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.list(), fetchJson(`${API}/customers`)]).then(([itemsRes, customersRes]) => {
      if (cancelled) return;
      if (itemsRes.status === "fulfilled" && Array.isArray(itemsRes.value)) {
        setItems(itemsRes.value);
      }
      if (customersRes.status === "fulfilled" && Array.isArray(customersRes.value)) {
        const options = customersRes.value
          .map((customer) => {
            const name = String(customer?.name || "").trim();
            if (!name) return "";
            const creditorNumber = String(
              customer?.creditor_number ?? customer?.creditorNumber ?? customer?.internal_number ?? ""
            ).trim();
            return creditorNumber ? `${name} (${creditorNumber})` : name;
          })
          .filter(Boolean);
        setCustomerOptions(Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, "de")));
      }
    });
    return () => {
      cancelled = true;
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (sum, item) => {
        const status = normalizeStatus(item);
        if (status === "received") return sum;
        return {
          purchase: sum.purchase + parsePrice(item.purchasePrice),
          sale: sum.sale + parsePrice(item.salePrice)
        };
      },
      { purchase: 0, sale: 0 }
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const customerNeedle = customerFilter.trim().toLowerCase();
    const queryNeedle = queryFilter.trim().toLowerCase();

    return items.filter((item) => {
      const status = normalizeStatus(item);
      if (!showReceived && status === "received") return false;

      if (customerNeedle) {
        const customer = String(item.customer || "").toLowerCase();
        if (!customer.includes(customerNeedle)) return false;
      }

      if (queryNeedle) {
        const haystack = [item.title, item.customer, item.sourceUrl, item.quantity]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        if (!haystack.includes(queryNeedle)) return false;
      }

      return true;
    });
  }, [items, showReceived, customerFilter, queryFilter]);

  const openGrouped = useMemo(() => {
    const groups = new Map();
    filteredItems.forEach((item) => {
      if (normalizeStatus(item) !== "open") return;
      const customer = String(item.customer || "").trim();
      const key = customer ? customer.toLowerCase() : "__general__";
      const label = customer || "Allgemein / Unzugeordnet";
      if (!groups.has(key)) groups.set(key, { key, label, items: [] });
      groups.get(key).items.push(item);
    });
    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === "__general__") return 1;
      if (b.key === "__general__") return -1;
      return a.label.localeCompare(b.label, "de");
    });
  }, [filteredItems]);

  const orderedItems = useMemo(
    () => filteredItems.filter((item) => normalizeStatus(item) === "ordered"),
    [filteredItems]
  );

  const receivedItems = useMemo(
    () => filteredItems.filter((item) => normalizeStatus(item) === "received"),
    [filteredItems]
  );

  const scheduleUpdate = (id, patch) => {
    pendingPatchesRef.current[id] = {
      ...(pendingPatchesRef.current[id] || {}),
      ...patch
    };
    if (saveTimersRef.current[id]) {
      clearTimeout(saveTimersRef.current[id]);
    }
    saveTimersRef.current[id] = setTimeout(async () => {
      const payload = pendingPatchesRef.current[id];
      delete pendingPatchesRef.current[id];
      delete saveTimersRef.current[id];
      if (!payload) return;
      try {
        await api.update(id, payload);
      } catch (error) {
        console.error("Purchasing update failed", error);
      }
    }, 300);
  };

  const addItem = async () => {
    const title = draft.title.trim();
    if (!title) return;

    const payload = {
      done: false,
      status: "open",
      customer: draft.customer.trim(),
      title,
      sourceUrl: normalizeUrl(draft.sourceUrl),
      quantity: draft.quantity.trim(),
      purchasePrice: draft.purchasePrice.trim(),
      salePrice: draft.salePrice.trim()
    };
    try {
      const created = await api.create(payload);
      setItems((prev) => [created, ...prev]);
      setDraft(EMPTY_DRAFT);
    } catch (error) {
      console.error("Purchasing create failed", error);
    }
  };

  const updateItem = (id, key, value) => {
    const patch = key === "status" ? { [key]: value, done: value === "received" } : { [key]: value };
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              updatedAt: Date.now()
            }
          : item
      )
    );
    scheduleUpdate(id, patch);
  };

  const removeItem = async (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.remove(id);
    } catch (error) {
      console.error("Purchasing delete failed", error);
    }
    if (saveTimersRef.current[id]) {
      clearTimeout(saveTimersRef.current[id]);
      delete saveTimersRef.current[id];
    }
    delete pendingPatchesRef.current[id];
  };

  const isEditing = (id, field) => editingCell?.id === id && editingCell?.field === field;

  const handleCellDoubleClick = (id, field, event) => {
    const input = event.currentTarget;
    setEditingCell({ id, field });
    window.requestAnimationFrame(() => {
      input.focus();
      if (typeof input.select === "function") input.select();
    });
  };

  const handleCellBlur = (id, field) => {
    if (!isEditing(id, field)) return;
    setEditingCell(null);
  };

  const renderRows = (rows, status) =>
    rows.map((item) => {
      const purchase = parsePrice(item.purchasePrice);
      const sale = parsePrice(item.salePrice);
      const margin = sale - purchase;
      return (
        <tr key={item.id} className="border-b border-sand-200 align-top">
          <td className="px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              {status === "open" ? (
                <button
                  type="button"
                  onClick={() => updateItem(item.id, "status", "ordered")}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-700 hover:bg-amber-100"
                  title="Als bestellt markieren"
                >
                  <Truck size={11} /> Bestellt
                </button>
              ) : null}
              {status === "ordered" ? (
                <>
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, "status", "received")}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-700 hover:bg-emerald-100"
                    title="Lieferung erhalten"
                  >
                    <Check size={11} /> Erhalten
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItem(item.id, "status", "open")}
                    className="inline-flex items-center rounded-md border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                    title="Zurück auf offen"
                  >
                    Zurück
                  </button>
                </>
              ) : null}
              {status === "received" ? (
                <button
                  type="button"
                  onClick={() => updateItem(item.id, "status", "open")}
                  className="inline-flex items-center rounded-md border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                  title="Wieder öffnen"
                >
                  Wieder offen
                </button>
              ) : null}
            </div>
          </td>
          <td className="px-3 py-1.5">
            <textarea
              value={item.title || ""}
              onChange={(event) => updateItem(item.id, "title", event.target.value)}
              readOnly={!isEditing(item.id, "title")}
              onDoubleClick={(event) => handleCellDoubleClick(item.id, "title", event)}
              onBlur={() => handleCellBlur(item.id, "title")}
              rows={2}
              className={`w-full resize-none rounded-md border-0 bg-transparent px-1 py-1 text-sm leading-tight focus:outline-none ${
                status === "received" ? "line-through text-sand-500" : ""
              }`}
              title="Doppelklick zum Bearbeiten"
            />
          </td>
          <td className="px-3 py-1.5">
            <div className="flex items-center gap-2">
              <input
                value={item.sourceUrl || ""}
                onChange={(event) => updateItem(item.id, "sourceUrl", event.target.value)}
                readOnly={!isEditing(item.id, "sourceUrl")}
                onDoubleClick={(event) => handleCellDoubleClick(item.id, "sourceUrl", event)}
                onBlur={() => handleCellBlur(item.id, "sourceUrl")}
                className="w-full rounded-md border-0 bg-transparent px-1 py-1 text-sm focus:outline-none"
                placeholder="https://..."
                title="Doppelklick zum Bearbeiten"
              />
              {item.sourceUrl ? (
                <a
                  href={normalizeUrl(item.sourceUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-sand-300 p-1.5 text-xs hover:bg-sand-100"
                  title="Link öffnen"
                  aria-label="Link öffnen"
                >
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </div>
          </td>
          <td className="px-3 py-1.5">
            <input
              value={item.customer || ""}
              onChange={(event) => updateItem(item.id, "customer", event.target.value)}
              readOnly={!isEditing(item.id, "customer")}
              onDoubleClick={(event) => handleCellDoubleClick(item.id, "customer", event)}
              onBlur={() => handleCellBlur(item.id, "customer")}
              list={CUSTOMER_DATALIST_ID}
              placeholder="Kunde"
              className="w-full rounded-md border-0 bg-transparent px-1 py-1 text-sm focus:outline-none"
              title="Doppelklick zum Bearbeiten"
            />
          </td>
          <td className="px-2 py-1.5">
            <input
              value={item.quantity || ""}
              onChange={(event) => updateItem(item.id, "quantity", event.target.value)}
              readOnly={!isEditing(item.id, "quantity")}
              onDoubleClick={(event) => handleCellDoubleClick(item.id, "quantity", event)}
              onBlur={() => handleCellBlur(item.id, "quantity")}
              className="w-full rounded-md border-0 bg-transparent px-0.5 py-1 text-sm focus:outline-none"
              placeholder="1"
              title="Doppelklick zum Bearbeiten"
            />
          </td>
          <td className="px-2 py-1.5">
            <div className="relative">
              <input
                value={item.purchasePrice || ""}
                onChange={(event) => updateItem(item.id, "purchasePrice", event.target.value)}
                readOnly={!isEditing(item.id, "purchasePrice")}
                onDoubleClick={(event) => handleCellDoubleClick(item.id, "purchasePrice", event)}
                onBlur={() => handleCellBlur(item.id, "purchasePrice")}
                className="w-full rounded-md border-0 bg-transparent px-0.5 py-1 pr-5 text-sm focus:outline-none"
                placeholder="0,00"
                title="Doppelklick zum Bearbeiten"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sand-500">
                €
              </span>
            </div>
          </td>
          <td className="px-2 py-1.5">
            <div className="relative">
              <input
                value={item.salePrice || ""}
                onChange={(event) => updateItem(item.id, "salePrice", event.target.value)}
                readOnly={!isEditing(item.id, "salePrice")}
                onDoubleClick={(event) => handleCellDoubleClick(item.id, "salePrice", event)}
                onBlur={() => handleCellBlur(item.id, "salePrice")}
                className="w-full rounded-md border-0 bg-transparent px-0.5 py-1 pr-5 text-sm focus:outline-none"
                placeholder="0,00"
                title="Doppelklick zum Bearbeiten"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sand-500">
                €
              </span>
            </div>
          </td>
          <td
            className={`px-3 py-1.5 text-sm font-medium ${
              margin >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {toCurrency(margin)}
          </td>
          <td className="px-3 py-1.5">
            <button
              type="button"
              onClick={() => removeItem(item.id)}
              className="inline-flex items-center justify-center rounded-lg border border-sand-200 p-2 text-sand-500 hover:bg-sand-100"
              title="Eintrag löschen"
              aria-label="Eintrag löschen"
            >
              <Trash2 size={14} />
            </button>
          </td>
        </tr>
      );
    });

  const renderSectionTable = (title, subtitle, rows, status, icon) => (
    <section className="rounded-2xl border border-sand-200 bg-white shadow-soft overflow-hidden">
      <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sand-700">
          {icon}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">{title}</p>
            <p className="text-xs text-sand-500">{subtitle}</p>
          </div>
        </div>
        <p className="text-xs text-sand-500">{rows.length} Einträge</p>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.2em] text-sand-500">
              <th className="px-3 py-2 w-44">Status</th>
              <th className="px-3 py-2">Bezeichnung</th>
              <th className="px-3 py-2">Bezugsquelle</th>
              <th className="px-3 py-2">Kunde</th>
              <th className="px-2 py-2 w-24">Menge</th>
              <th className="px-2 py-2 w-24">EK</th>
              <th className="px-2 py-2 w-24">VK</th>
              <th className="px-3 py-2 w-24">Marge</th>
              <th className="px-3 py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              renderRows(rows, status)
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-sand-500">
                  Keine Einträge vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
            <ShoppingCart size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Einkauf</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <section className="rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
          <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sand-700">
              <PackageCheck size={16} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Neuer Einkauf</p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-sand-600 select-none">
              <input
                type="checkbox"
                checked={showReceived}
                onChange={(event) => setShowReceived(event.target.checked)}
                className="h-4 w-4"
              />
              Erhaltene einblenden
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-sand-200 px-4 py-2.5">
            <input
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              list={CUSTOMER_DATALIST_ID}
              placeholder="Filter Kunde"
              className="w-full rounded-md border border-sand-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none"
            />
            <input
              value={queryFilter}
              onChange={(event) => setQueryFilter(event.target.value)}
              placeholder="Suche: Bezeichnung, Link, Kunde"
              className="w-full rounded-md border border-sand-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setCustomerFilter("");
                setQueryFilter("");
              }}
              className="inline-flex items-center justify-center rounded-md border border-sand-200 bg-white px-3 py-1.5 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
            >
              Filter zurücksetzen
            </button>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.2em] text-sand-500">
                  <th className="px-3 py-2 w-44">Status</th>
                  <th className="px-3 py-2">Bezeichnung</th>
                  <th className="px-3 py-2">Bezugsquelle</th>
                  <th className="px-3 py-2">Kunde</th>
                  <th className="px-2 py-2 w-24">Menge</th>
                  <th className="px-2 py-2 w-24">EK</th>
                  <th className="px-2 py-2 w-24">VK</th>
                  <th className="px-3 py-2 w-24">Marge</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-sand-200 bg-sand-50 align-top">
                  <td className="px-3 py-1.5 text-xs text-sand-500">Offen</td>
                  <td className="px-3 py-1.5">
                    <textarea
                      value={draft.title}
                      onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Bezeichnung"
                      rows={2}
                      className="w-full resize-none rounded-md border-0 bg-transparent px-1 py-1 text-sm leading-tight focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={draft.sourceUrl}
                      onChange={(event) => setDraft((prev) => ({ ...prev, sourceUrl: event.target.value }))}
                      placeholder="https://..."
                      className="w-full rounded-md border-0 bg-transparent px-1 py-1 text-sm focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      value={draft.customer}
                      onChange={(event) => setDraft((prev) => ({ ...prev, customer: event.target.value }))}
                      list={CUSTOMER_DATALIST_ID}
                      placeholder="Kunde (frei oder Suche)"
                      className="w-full rounded-md border-0 bg-transparent px-1 py-1 text-sm focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      value={draft.quantity}
                      onChange={(event) => setDraft((prev) => ({ ...prev, quantity: event.target.value }))}
                      placeholder="1"
                      className="w-full rounded-md border-0 bg-transparent px-0.5 py-1 text-sm focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        value={draft.purchasePrice}
                        onChange={(event) => setDraft((prev) => ({ ...prev, purchasePrice: event.target.value }))}
                        placeholder="0,00"
                        className="w-full rounded-md border-0 bg-transparent px-0.5 py-1 pr-5 text-sm focus:outline-none"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sand-500">€</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="relative">
                      <input
                        value={draft.salePrice}
                        onChange={(event) => setDraft((prev) => ({ ...prev, salePrice: event.target.value }))}
                        placeholder="0,00"
                        className="w-full rounded-md border-0 bg-transparent px-0.5 py-1 pr-5 text-sm focus:outline-none"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-sand-500">€</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-sm text-sand-500">Neu</td>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={addItem}
                      disabled={!draft.title.trim()}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-sand-900 bg-sand-900 px-2 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                      title="Neue Bestellung hinzufügen"
                    >
                      <Plus size={12} /> Hinzufügen
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <datalist id={CUSTOMER_DATALIST_ID}>
              {customerOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-sand-200 px-4 py-3 text-sm">
            <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Offen EK</p>
              <p className="font-semibold text-sand-900">{toCurrency(totals.purchase)}</p>
            </div>
            <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Offen VK</p>
              <p className="font-semibold text-sand-900">{toCurrency(totals.sale)}</p>
            </div>
            <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-sand-500">Offene Marge</p>
              <p className={`font-semibold ${totals.sale - totals.purchase >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {toCurrency(totals.sale - totals.purchase)}
              </p>
            </div>
          </div>
        </section>

        {openGrouped.length ? (
          openGrouped.map((group) =>
            renderSectionTable(
              "Offene Einkäufe",
              group.label,
              group.items,
              "open",
              <ShoppingCart size={16} />
            )
          )
        ) : (
          <section className="rounded-2xl border border-sand-200 bg-white px-4 py-8 text-center text-sm text-sand-500">
            Keine offenen Einkäufe.
          </section>
        )}

        {renderSectionTable(
          "Container",
          "Bestellt",
          orderedItems,
          "ordered",
          <Truck size={16} />
        )}

        {showReceived
          ? renderSectionTable(
              "Container",
              "Erhalten",
              receivedItems,
              "received",
              <Check size={16} />
            )
          : null}
      </main>
    </div>
  );
}
