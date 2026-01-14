import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Users
} from "lucide-react";
import { uid } from "../reporting/utils";

const API = "/api";

const api = {
  list: () => fetch(`${API}/customers`).then((r) => r.json()),
  create: (payload) =>
    fetch(`${API}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  update: (id, payload) =>
    fetch(`${API}/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  remove: (id) => fetch(`${API}/customers/${id}`, { method: "DELETE" })
};

const blankPhone = () => ({
  id: uid(),
  label: "",
  number: ""
});

const normalizeCustomer = (customer) => ({
  ...customer,
  internalNumber: customer.internal_number ?? customer.internalNumber ?? "",
  creditorNumber: customer.creditor_number ?? customer.creditorNumber ?? "",
  phones: customer.phones?.length ? customer.phones : [blankPhone()]
});

const customerPayload = (customer) => ({
  name: customer.name || "Neuer Kunde",
  internal_number: customer.internalNumber || "",
  creditor_number: customer.creditorNumber || "",
  email: customer.email || "",
  phones: (customer.phones || [])
    .filter((phone) => (phone.label || "").trim() || (phone.number || "").trim())
    .map((phone) => ({
      label: phone.label || "",
      number: phone.number || ""
    }))
});

export default function CustomerDirectoryView() {
  const [customers, setCustomers] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const saveTimers = useRef({});

  useEffect(() => {
    api.list().then((data) => {
      const next = (data || []).map(normalizeCustomer);
      setCustomers(next);
      if (next.length) {
        setActiveId(next[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!customers.length) {
      setActiveId(null);
      return;
    }
    const stillExists = customers.some((customer) => customer.id === activeId);
    if (!stillExists) {
      setActiveId(customers[0].id);
    }
  }, [customers, activeId]);

  const filteredCustomers = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return customers;
    return customers.filter((customer) => {
      const phoneMatch = customer.phones?.some((phone) =>
        `${phone.label} ${phone.number}`.toLowerCase().includes(trimmed)
      );
      return (
        customer.name?.toLowerCase().includes(trimmed) ||
        customer.internalNumber?.toLowerCase().includes(trimmed) ||
        customer.creditorNumber?.toLowerCase().includes(trimmed) ||
        customer.email?.toLowerCase().includes(trimmed) ||
        phoneMatch
      );
    });
  }, [customers, query]);

  const activeCustomer = customers.find((customer) => customer.id === activeId) || null;

  const scheduleSave = (customer) => {
    if (!customer) return;
    if (saveTimers.current[customer.id]) {
      clearTimeout(saveTimers.current[customer.id]);
    }
    saveTimers.current[customer.id] = setTimeout(() => {
      api
        .update(customer.id, customerPayload(customer))
        .then((saved) => {
          setCustomers((prev) =>
            prev.map((entry) => (entry.id === saved.id ? normalizeCustomer(saved) : entry))
          );
        })
        .catch(() => {});
    }, 400);
  };

  const updateCustomer = (id, patch) => {
    setCustomers((prev) => {
      const next = prev.map((customer) =>
        customer.id === id ? { ...customer, ...patch } : customer
      );
      const updated = next.find((customer) => customer.id === id);
      scheduleSave(updated);
      return next;
    });
  };

  const handleCreate = () => {
    api
      .create({ name: "Neuer Kunde", phones: [{ label: "", number: "" }] })
      .then((created) => {
        const normalized = normalizeCustomer(created);
        setCustomers((prev) => [normalized, ...prev]);
        setActiveId(normalized.id);
      });
  };

  const handleRemove = (id) => {
    api.remove(id).then(() => {
      setCustomers((prev) => prev.filter((customer) => customer.id !== id));
    });
  };

  const updatePhone = (phoneId, patch) => {
    if (!activeCustomer) return;
    const nextPhones = activeCustomer.phones.map((phone) =>
      phone.id === phoneId ? { ...phone, ...patch } : phone
    );
    updateCustomer(activeCustomer.id, { phones: nextPhones });
  };

  const addPhone = () => {
    if (!activeCustomer) return;
    updateCustomer(activeCustomer.id, {
      phones: [...(activeCustomer.phones || []), blankPhone()]
    });
  };

  const removePhone = (phoneId) => {
    if (!activeCustomer) return;
    const nextPhones = activeCustomer.phones.filter((phone) => phone.id !== phoneId);
    updateCustomer(activeCustomer.id, { phones: nextPhones.length ? nextPhones : [blankPhone()] });
  };

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
            <Users size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Kundenstamm</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <section className="rounded-3xl border border-sand-200 bg-white shadow-soft p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Übersicht</p>
                <h2 className="text-lg font-display text-sand-900">Kundendatei</h2>
              </div>
              <span className="rounded-full border border-sand-200 px-3 py-1 text-xs text-sand-600">
                {customers.length} Kunde{customers.length === 1 ? "" : "n"}
              </span>
            </div>
            <label className="relative block mb-3">
              <span className="sr-only">Suche</span>
              <Search size={14} className="absolute left-3 top-3 text-sand-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Suche nach Name, Nummer, Telefon…"
                className="w-full rounded-2xl border border-sand-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
              />
            </label>
            <button
              type="button"
              onClick={handleCreate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-sand-200 bg-sand-900 text-white px-4 py-2 text-sm hover:opacity-90"
            >
              <Plus size={16} /> Neuer Kunde
            </button>
            <div className="mt-4 space-y-2 max-h-[420px] overflow-auto pr-1">
              {filteredCustomers.length ? (
                filteredCustomers.map((customer) => {
                  const phoneCount = (customer.phones || []).filter(
                    (phone) => (phone.label || "").trim() || (phone.number || "").trim()
                  ).length;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setActiveId(customer.id)}
                      className={`w-full text-left rounded-2xl border px-3 py-3 transition ${
                        customer.id === activeId
                          ? "border-sand-900 bg-sand-900 text-white"
                          : "border-sand-200 bg-sand-50 text-sand-700 hover:bg-sand-100"
                      }`}
                    >
                      <div className="text-sm font-semibold">
                        {customer.name?.trim() || "Unbenannter Kunde"}
                      </div>
                      <div className="mt-1 text-xs text-sand-500">
                        {customer.internalNumber
                          ? `Interne Nr. ${customer.internalNumber}`
                          : "Ohne Nummer"}
                      </div>
                      <div className="mt-1 text-xs">
                        {customer.email || "Keine E-Mail"} · {phoneCount} Rufnummern
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-sand-200 p-4 text-xs text-sand-500">
                  Keine Treffer. Tipp: über den Namen oder die interne Nummer suchen.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
            {activeCustomer ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Stammdaten</p>
                    <h2 className="text-xl font-display text-sand-900">
                      {activeCustomer.name?.trim() || "Kunde bearbeiten"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(activeCustomer.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 size={12} /> Entfernen
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">Name</span>
                    <input
                      value={activeCustomer.name}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { name: event.target.value })
                      }
                      placeholder="z. B. Quansatech GmbH"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Interne Kundennummer
                    </span>
                    <input
                      value={activeCustomer.internalNumber}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { internalNumber: event.target.value })
                      }
                      placeholder="z. B. K-1042"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">
                      Kreditorennummer (Faktura)
                    </span>
                    <input
                      value={activeCustomer.creditorNumber}
                      onChange={(event) =>
                        updateCustomer(activeCustomer.id, { creditorNumber: event.target.value })
                      }
                      placeholder="z. B. KR-777"
                      className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-sand-500">E-Mail-Adresse</span>
                    <div className="mt-1 flex items-center gap-2 rounded-2xl border border-sand-200 px-3 py-2">
                      <Mail size={14} className="text-sand-400" />
                      <input
                        value={activeCustomer.email}
                        onChange={(event) =>
                          updateCustomer(activeCustomer.id, { email: event.target.value })
                        }
                        placeholder="name@kunde.de"
                        className="w-full text-sm focus:outline-none"
                        type="email"
                      />
                    </div>
                  </label>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-sand-700">
                      <Phone size={16} />
                      <p className="text-sm uppercase tracking-[0.3em] text-sand-500">
                        Rufnummern
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addPhone}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                    >
                      <Plus size={12} /> Rufnummer
                    </button>
                  </div>
                  <div className="space-y-3">
                    {activeCustomer.phones?.map((phone) => (
                      <div
                        key={phone.id}
                        className="grid gap-2 md:grid-cols-[160px_minmax(0,1fr)_auto] items-center"
                      >
                        <input
                          value={phone.label}
                          onChange={(event) => updatePhone(phone.id, { label: event.target.value })}
                          placeholder="z. B. Arbeit"
                          className="rounded-2xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                        />
                        <input
                          value={phone.number}
                          onChange={(event) => updatePhone(phone.id, { number: event.target.value })}
                          placeholder="+49 40 123456"
                          className="rounded-2xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                        />
                        <button
                          type="button"
                          onClick={() => removePhone(phone.id)}
                          className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-sand-200 bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-3 text-xs text-sand-600">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={14} />
                      <span>Stammdaten gepflegt</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 size={14} />
                      <span>Faktura bereit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={14} />
                      <span>E-Mail verfügbar</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Start</p>
                  <h2 className="text-xl font-display text-sand-900">Ersten Kunden anlegen</h2>
                  <p className="text-sm text-sand-500 mt-2">
                    Lege Namen, Nummern, E-Mail und mehrere Rufnummern pro Kunde ab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex items-center gap-2 rounded-2xl border border-sand-200 bg-sand-900 text-white px-4 py-2 text-sm hover:opacity-90"
                >
                  <Plus size={16} /> Kundenstamm starten
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
