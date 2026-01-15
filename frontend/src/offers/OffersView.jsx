import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Link, Plus, Receipt, Sparkles } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400";

const textareaClass =
  "w-full min-h-[110px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400";

const impulses = ["Gespräch", "Bericht", "Standardleistung", "Erneuerung", "Empfehlung"];
const statusOptions = ["Entwurf", "gesendet", "angenommen", "abgelehnt"];
const complexityOptions = ["niedrig", "mittel", "hoch"];

const uid = () => Math.random().toString(36).slice(2, 10);

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const formatMoney = (value) => {
  const number = Number(value || 0);
  return number.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });
};

const shorten = (value, limit = 120) => {
  const text = String(value || "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
};

const makeVersion = (text, createdAt) => ({
  id: uid(),
  text,
  createdAt: createdAt || new Date().toISOString()
});

const generateAiText = (item) => {
  const title = item.title || "die Leistung";
  const keywords = Array.isArray(item.keywords) ? item.keywords.filter(Boolean) : [];
  const keywordLine = keywords.length ? ` (${keywords.join(", ")})` : "";

  if (item.complexity === "niedrig") {
    return `Wir liefern ${title}${keywordLine} in klaren, kurzen Schritten.`;
  }

  if (item.complexity === "hoch") {
    return `Wir setzen ${title}${keywordLine} in mehreren Phasen um, damit Ablauf und Risiko sauber kontrolliert bleiben.\n\nDetails:\n- Planung und Absicherung der Reihenfolge\n- Abstimmung der Systemabhängigkeiten`;
  }

  return `Wir erledigen ${title}${keywordLine} strukturiert und prüfen die Wirkung direkt im Anschluss, damit der Betrieb stabil bleibt.`;
};

const buildSevDeskPayload = (offer) => ({
  offer_reference: offer.reference,
  items: offer.lineItems.map((item) => ({
    title: item.title || "Position",
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0)
  }))
});

const initialOffers = [
  {
    id: uid(),
    reference: "ANG-2024-004",
    customer: "Holzwerk Alpin",
    impulse: "Gespräch",
    status: "Entwurf",
    linkedTask: "",
    linkedReport: "Q3 Stabilitätscheck",
    createdAt: "2024-09-02T09:12:00.000Z",
    lineItems: [
      {
        id: uid(),
        type: "Dienstleistung",
        title: "Firewall-Härtung",
        keywords: ["Regeln", "Logging", "Segmentierung"],
        complexity: "hoch",
        securityRelevant: true,
        price: 1800,
        quantity: 1,
        researchHours: 3,
        aiVersions: [makeVersion("Wir sichern die Firewall-Regeln, reduzieren unnötige Wege und dokumentieren die neue Segmentierung.", "2024-09-02T10:12:00.000Z")],
        activeAiVersionId: null,
        aiDraft: ""
      },
      {
        id: uid(),
        type: "Dienstleistung",
        title: "VPN-Refresh",
        keywords: ["MFA", "Client-Update"],
        complexity: "mittel",
        securityRelevant: true,
        price: 620,
        quantity: 1,
        researchHours: 1.5,
        aiVersions: [makeVersion("Wir erneuern die VPN-Konfiguration, aktivieren MFA und testen den Zugriff mit den aktuellen Clients.", "2024-09-02T10:24:00.000Z")],
        activeAiVersionId: null,
        aiDraft: ""
      }
    ],
    deviceItems: [
      {
        id: uid(),
        manufacturer: "Sophos",
        modelFamily: "XGS",
        minSpec: "XGS 116, 10GbE, 8 GB RAM",
        qualityCriteria: "Support bis 2029, HA-fähig",
        decisionReason: "Beste Integration in bestehendes Monitoring",
        dealerLink: "https://haendler.example/angebot-2024-09",
        dealerLinkDate: "2024-09-01"
      }
    ]
  },
  {
    id: uid(),
    reference: "ANG-2024-005",
    customer: "Moser & Partner",
    impulse: "Empfehlung",
    status: "gesendet",
    linkedTask: "Ticket #2341",
    linkedReport: "",
    createdAt: "2024-09-05T08:40:00.000Z",
    lineItems: [
      {
        id: uid(),
        type: "Dienstleistung",
        title: "Patch-Standardisierung",
        keywords: ["Windows", "Mac", "Zeitfenster"],
        complexity: "mittel",
        securityRelevant: false,
        price: 900,
        quantity: 1,
        researchHours: 2,
        aiVersions: [makeVersion("Wir vereinheitlichen den Patch-Prozess über alle Systeme hinweg und stimmen feste Wartungsfenster ab.", "2024-09-05T09:00:00.000Z")],
        activeAiVersionId: null,
        aiDraft: ""
      }
    ],
    deviceItems: []
  }
];

const normalizeVersionId = (item) => {
  const first = item.aiVersions?.[0]?.id || null;
  return item.activeAiVersionId || first;
};

const getActiveVersion = (item) => {
  const id = normalizeVersionId(item);
  return item.aiVersions?.find((version) => version.id === id) || null;
};

const ensureDraft = (item) => item.aiDraft || getActiveVersion(item)?.text || "";

function Field({ label, children }) {
  return (
    <label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export default function OffersView() {
  const [offers, setOffers] = useState(initialOffers);
  const [activeId, setActiveId] = useState(initialOffers[0]?.id || "");
  const [viewMode, setViewMode] = useState("internal");
  const [detailOpen, setDetailOpen] = useState({});
  const [payloadPreview, setPayloadPreview] = useState(null);
  const [payloadTimestamp, setPayloadTimestamp] = useState("");

  const activeOffer = offers.find((offer) => offer.id === activeId) || null;
  const headKey = activeOffer ? `head-${activeOffer.id}` : "head";
  const headOpen = !!detailOpen[headKey];

  const totals = useMemo(() => {
    if (!activeOffer) return { total: 0, count: 0 };
    const total = activeOffer.lineItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    return { total, count: activeOffer.lineItems.length };
  }, [activeOffer]);

  const updateOffer = (offerId, updater) => {
    setOffers((prev) =>
      prev.map((offer) => (offer.id === offerId ? updater(offer) : offer))
    );
  };

  const updateLineItem = (offerId, itemId, patch) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      lineItems: offer.lineItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    }));
  };

  const updateDeviceItem = (offerId, itemId, patch) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      deviceItems: offer.deviceItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    }));
  };

  const toggleDetail = (key) =>
    setDetailOpen((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));

  const addOffer = () => {
    const year = new Date().getFullYear();
    const index = offers.length + 1;
    const reference = `ANG-${year}-${String(index).padStart(3, "0")}`;
    const newOffer = {
      id: uid(),
      reference,
      customer: "",
      impulse: impulses[0],
      status: "Entwurf",
      linkedTask: "",
      linkedReport: "",
      createdAt: new Date().toISOString(),
      lineItems: [],
      deviceItems: []
    };
    setOffers((prev) => [newOffer, ...prev]);
    setActiveId(newOffer.id);
  };

  const addLineItem = () => {
    if (!activeOffer) return;
    const newItem = {
      id: uid(),
      type: "Dienstleistung",
      title: "",
      keywords: [],
      complexity: "niedrig",
      securityRelevant: false,
      price: 0,
      quantity: 1,
      researchHours: 0,
      aiVersions: [],
      activeAiVersionId: null,
      aiDraft: ""
    };
    updateOffer(activeOffer.id, (offer) => ({
      ...offer,
      lineItems: [...offer.lineItems, newItem]
    }));
  };

  const addDeviceItem = () => {
    if (!activeOffer) return;
    const newItem = {
      id: uid(),
      manufacturer: "",
      modelFamily: "",
      minSpec: "",
      qualityCriteria: "",
      decisionReason: "",
      dealerLink: "",
      dealerLinkDate: ""
    };
    updateOffer(activeOffer.id, (offer) => ({
      ...offer,
      deviceItems: [...offer.deviceItems, newItem]
    }));
  };

  const saveAiVersion = (item) => {
    if (!activeOffer) return;
    const text = ensureDraft(item).trim();
    if (!text) return;
    const newVersion = makeVersion(text);
    updateLineItem(activeOffer.id, item.id, {
      aiVersions: [newVersion, ...(item.aiVersions || [])],
      activeAiVersionId: newVersion.id,
      aiDraft: text
    });
  };

  const handleSevDesk = () => {
    if (!activeOffer) return;
    setPayloadPreview(buildSevDeskPayload(activeOffer));
    setPayloadTimestamp(new Date().toISOString());
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
            <Receipt size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kundenorientierung</p>
            <h1 className="text-2xl font-semibold text-slate-900">Angebote</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode("internal")}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
                viewMode === "internal"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              Intern
            </button>
            <button
              type="button"
              onClick={() => setViewMode("customer")}
              className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
                viewMode === "customer"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              Kundenansicht
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Leitsatz</p>
              <p className="text-sm text-slate-700">
                Workbench erklärt das Warum – sevDesk verrechnet das Was.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSevDesk}
              className="inline-flex items-center gap-2 rounded-full border border-blue-600 bg-blue-600 px-4 py-2 text-xs uppercase tracking-wide text-white hover:bg-blue-700"
            >
              Rechnungsentwurf in sevDesk erzeugen
            </button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Angebote</p>
              <button
                type="button"
                onClick={addOffer}
                className="inline-flex items-center gap-2 rounded-full border border-blue-600 bg-blue-600 px-3 py-1 text-xs uppercase tracking-wide text-white hover:bg-blue-700"
              >
                <Plus size={12} /> Neu
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {offers.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setActiveId(offer.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    offer.id === activeId
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.3em] opacity-70">
                    {offer.reference}
                  </p>
                  <p className="mt-1 text-sm font-medium">{offer.customer || "Neues Angebot"}</p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.3em] opacity-70">
                    {offer.status}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {activeOffer ? (
            <section className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Angebotskopf</p>
                    <h2 className="text-xl font-semibold text-slate-900">{activeOffer.reference}</h2>
                    <p className="text-sm text-slate-500">
                      Erstellt {formatDate(activeOffer.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                      {activeOffer.status}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                      {totals.count} Positionen
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                      Gesamt {formatMoney(totals.total)}
                    </span>
                    {viewMode === "internal" ? (
                      <button
                        type="button"
                        onClick={() => toggleDetail(headKey)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                      >
                        {headOpen ? "Fertig" : "Bearbeiten"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Kunde</p>
                    <p className="mt-2 text-sm text-slate-800">{activeOffer.customer || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      Angebotsursprung
                    </p>
                    <p className="mt-2 text-sm text-slate-800">{activeOffer.impulse}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Status</p>
                    <p className="mt-2 text-sm text-slate-800">{activeOffer.status}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      Optionale Aufgabe
                    </p>
                    <p className="mt-2 text-sm text-slate-800">{activeOffer.linkedTask || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                      Optionaler Bericht
                    </p>
                    <p className="mt-2 text-sm text-slate-800">
                      {activeOffer.linkedReport || "—"}
                    </p>
                  </div>
                </div>

                {viewMode === "internal" && headOpen ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Kunde">
                      <input
                        className={inputClass}
                        value={activeOffer.customer}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            customer: event.target.value
                          }))
                        }
                        placeholder="Kunde eingeben"
                      />
                    </Field>
                    <Field label="Angebotsursprung">
                      <select
                        className={inputClass}
                        value={activeOffer.impulse}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            impulse: event.target.value
                          }))
                        }
                      >
                        {impulses.map((impulse) => (
                          <option key={impulse} value={impulse}>
                            {impulse}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select
                        className={inputClass}
                        value={activeOffer.status}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            status: event.target.value
                          }))
                        }
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Optionale Aufgabe">
                      <input
                        className={inputClass}
                        value={activeOffer.linkedTask}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            linkedTask: event.target.value
                          }))
                        }
                        placeholder="z.B. Ticket #2341"
                      />
                    </Field>
                    <Field label="Optionaler Bericht">
                      <input
                        className={inputClass}
                        value={activeOffer.linkedReport}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            linkedReport: event.target.value
                          }))
                        }
                        placeholder="z.B. Q3 Stabilitätscheck"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Angebotspositionen
                    </p>
                    <p className="text-sm text-slate-600">
                      Dienstleistung oder Gerät, kurze Titel und klare Stichworte.
                    </p>
                  </div>
                  {viewMode === "internal" ? (
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                    >
                      <Plus size={12} /> Position
                    </button>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {activeOffer.lineItems.length ? (
                    activeOffer.lineItems.map((item) => {
                      const activeVersion = getActiveVersion(item);
                      const editKey = `line-${item.id}`;
                      const aiKey = `line-ai-${item.id}`;
                      const detailsOpen =
                        viewMode === "internal" ? !!detailOpen[editKey] : !!detailOpen[item.id];
                      const aiOpen = !!detailOpen[aiKey];
                      const aiPreview = activeVersion?.text
                        ? shorten(activeVersion.text.split("\n")[0] || "")
                        : "";
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                                {item.type}
                              </p>
                              <p className="text-lg font-medium text-slate-900">
                                {item.title || "Unbenannte Position"}
                              </p>
                              {viewMode === "internal" || detailsOpen ? (
                                <p className="text-sm text-slate-600">
                                  {item.keywords?.length
                                    ? item.keywords.join(" · ")
                                    : "Keine Stichworte"}
                                </p>
                              ) : null}
                              {viewMode === "internal" && aiPreview ? (
                                <p className="mt-2 text-xs text-slate-500">
                                  KI: {aiPreview}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                                {item.complexity}
                              </span>
                              {item.securityRelevant ? (
                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                                  Sicherheitsrelevant
                                </span>
                              ) : null}
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                                {formatMoney(item.price)} · {item.quantity}x
                              </span>
                              {viewMode === "internal" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => toggleDetail(editKey)}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                  >
                                    {detailsOpen ? (
                                      <>
                                        <ChevronUp size={12} /> Schliessen
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown size={12} /> Bearbeiten
                                      </>
                                    )}
                                  </button>
                                  {detailsOpen ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleDetail(aiKey)}
                                      className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                    >
                                      {aiOpen ? (
                                        <>
                                          <ChevronUp size={12} /> KI-Text
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown size={12} /> KI-Text
                                        </>
                                      )}
                                    </button>
                                  ) : null}
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleDetail(item.id)}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                >
                                  {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  Details
                                </button>
                              )}
                            </div>
                          </div>

                          {viewMode === "customer" ? (
                            <div className="mt-4 text-sm text-slate-700 whitespace-pre-line">
                              {activeVersion?.text || "Noch keine Erklärung hinterlegt."}
                            </div>
                          ) : null}

                          {detailsOpen ? (
                            <div className="mt-4 space-y-4">
                              {viewMode === "internal" ? (
                                <div className="grid gap-4 md:grid-cols-3">
                                  <Field label="Titel (fakturierbar)">
                                    <input
                                      className={inputClass}
                                      value={item.title}
                                      onChange={(event) =>
                                        updateLineItem(activeOffer.id, item.id, {
                                          title: event.target.value
                                        })
                                      }
                                      placeholder="Kurz & fakturierbar"
                                    />
                                  </Field>
                                  <Field label="Typ">
                                    <select
                                      className={inputClass}
                                      value={item.type}
                                      onChange={(event) =>
                                        updateLineItem(activeOffer.id, item.id, {
                                          type: event.target.value
                                        })
                                      }
                                    >
                                      <option value="Dienstleistung">Dienstleistung</option>
                                      <option value="Gerät">Gerät</option>
                                    </select>
                                  </Field>
                                  <Field label="Komplexität">
                                    <select
                                      className={inputClass}
                                      value={item.complexity}
                                      onChange={(event) =>
                                        updateLineItem(activeOffer.id, item.id, {
                                          complexity: event.target.value
                                        })
                                      }
                                    >
                                      {complexityOptions.map((level) => (
                                        <option key={level} value={level}>
                                          {level}
                                        </option>
                                      ))}
                                    </select>
                                  </Field>
                                  <Field label="Leistungs-Stichworte">
                                    <input
                                      className={inputClass}
                                      value={item.keywords?.join(", ") || ""}
                                      onChange={(event) =>
                                        updateLineItem(activeOffer.id, item.id, {
                                          keywords: event.target.value
                                            .split(",")
                                            .map((entry) => entry.trim())
                                            .filter(Boolean)
                                        })
                                      }
                                      placeholder="Kurze Stichworte, getrennt durch Komma"
                                    />
                                  </Field>
                                  <Field label="Preis / Menge">
                                    <div className="flex gap-2">
                                      <input
                                        className={inputClass}
                                        type="number"
                                        value={item.price}
                                        onChange={(event) =>
                                          updateLineItem(activeOffer.id, item.id, {
                                            price: Number(event.target.value)
                                          })
                                        }
                                        placeholder="Preis"
                                      />
                                      <input
                                        className={inputClass}
                                        type="number"
                                        value={item.quantity}
                                        onChange={(event) =>
                                          updateLineItem(activeOffer.id, item.id, {
                                            quantity: Number(event.target.value)
                                          })
                                        }
                                        placeholder="Menge"
                                      />
                                    </div>
                                  </Field>
                                  <Field label="Interner Rechercheaufwand (h)">
                                    <input
                                      className={inputClass}
                                      type="number"
                                      value={item.researchHours}
                                      onChange={(event) =>
                                        updateLineItem(activeOffer.id, item.id, {
                                          researchHours: Number(event.target.value)
                                        })
                                      }
                                      placeholder="Nur intern"
                                    />
                                  </Field>
                                  <div className="flex items-center gap-3 pt-6">
                                    <input
                                      id={`security-${item.id}`}
                                      type="checkbox"
                                      checked={item.securityRelevant}
                                      onChange={(event) =>
                                        updateLineItem(activeOffer.id, item.id, {
                                          securityRelevant: event.target.checked
                                        })
                                      }
                                      className="h-4 w-4"
                                    />
                                    <label htmlFor={`security-${item.id}`} className="text-sm text-slate-700">
                                      Sicherheitsrelevant
                                    </label>
                                  </div>
                                </div>
                              ) : null}

                              {viewMode === "customer" ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                                    Details
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    <p>
                                      <span className="text-slate-500">Stichworte:</span>{" "}
                                      {item.keywords?.length
                                        ? item.keywords.join(", ")
                                        : "Keine"}
                                    </p>
                                    <p>
                                      <span className="text-slate-500">Sicherheitsrelevant:</span>{" "}
                                      {item.securityRelevant ? "Ja" : "Nein"}
                                    </p>
                                  </div>
                                </div>
                              ) : null}

                              {viewMode === "internal" && aiOpen ? (
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                                        KI-Erklärung
                                      </p>
                                      <p className="text-sm text-slate-600">
                                        Ruhig, kurz, ohne Preise. Versioniert.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateLineItem(activeOffer.id, item.id, {
                                            aiDraft: generateAiText(item)
                                          })
                                        }
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                      >
                                        <Sparkles size={12} /> Text erzeugen
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => saveAiVersion(item)}
                                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                      >
                                        Neue Version
                                      </button>
                                    </div>
                                  </div>

                                  <textarea
                                    className={textareaClass}
                                    value={ensureDraft(item)}
                                    onChange={(event) =>
                                      updateLineItem(activeOffer.id, item.id, {
                                        aiDraft: event.target.value
                                      })
                                    }
                                    placeholder="KI-Text bearbeiten oder erzeugen…"
                                  />

                                  {activeVersion ? (
                                    <div className="text-sm text-slate-700 whitespace-pre-line">
                                      {activeVersion.text}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-slate-500">
                                      Noch keine Version gespeichert.
                                    </div>
                                  )}

                                  {item.aiVersions?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                      {item.aiVersions.map((version) => (
                                        <button
                                          key={version.id}
                                          type="button"
                                          onClick={() =>
                                            updateLineItem(activeOffer.id, item.id, {
                                              activeAiVersionId: version.id,
                                              aiDraft: version.text
                                            })
                                          }
                                          className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
                                            version.id === normalizeVersionId(item)
                                              ? "border-blue-600 bg-blue-600 text-white"
                                              : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                                          }`}
                                        >
                                          Version {formatDate(version.createdAt)}
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Noch keine Positionen erfasst.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Gerätepositionen
                    </p>
                    <p className="text-sm text-slate-600">
                      Geräteprofil statt fixer Link. Reproduzierbar ohne Händler-URL.
                    </p>
                  </div>
                  {viewMode === "internal" ? (
                    <button
                      type="button"
                      onClick={addDeviceItem}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                    >
                      <Plus size={12} /> Gerät
                    </button>
                  ) : null}
                </div>

                <div className="space-y-4">
                  {activeOffer.deviceItems.length ? (
                    activeOffer.deviceItems.map((item) => {
                      const detailKey = `device-${item.id}`;
                      const showDetails = !!detailOpen[detailKey];
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                                Geräteprofil
                              </p>
                              <p className="text-lg font-medium text-slate-900">
                                {item.manufacturer || "Hersteller"} ·{" "}
                                {item.modelFamily || "Modellfamilie"}
                              </p>
                              <p className="text-sm text-slate-600">
                                {item.minSpec || "Mindest-Spezifikation definieren"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {viewMode === "customer" && item.dealerLink ? (
                                <a
                                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                  href={item.dealerLink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Link size={12} /> Händlerlink
                                </a>
                              ) : null}
                              {viewMode === "internal" ? (
                                <button
                                  type="button"
                                  onClick={() => toggleDetail(detailKey)}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                >
                                  {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  {showDetails ? "Schliessen" : "Bearbeiten"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleDetail(detailKey)}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-slate-100"
                                >
                                  {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  Details
                                </button>
                              )}
                            </div>
                          </div>

                          {showDetails ? (
                            <>
                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                                    Qualitätskriterien
                                  </p>
                                  <p className="mt-2 text-sm text-slate-700">
                                    {item.qualityCriteria || "Noch nicht hinterlegt."}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                                    Entscheidungsgrund
                                  </p>
                                  <p className="mt-2 text-sm text-slate-700">
                                    {item.decisionReason || "Noch nicht hinterlegt."}
                                  </p>
                                </div>
                              </div>

                              {viewMode === "internal" ? (
                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <Field label="Hersteller">
                                    <input
                                      className={inputClass}
                                      value={item.manufacturer}
                                      onChange={(event) =>
                                        updateDeviceItem(activeOffer.id, item.id, {
                                          manufacturer: event.target.value
                                        })
                                      }
                                      placeholder="Hersteller"
                                    />
                                  </Field>
                                  <Field label="Modellfamilie">
                                    <input
                                      className={inputClass}
                                      value={item.modelFamily}
                                      onChange={(event) =>
                                        updateDeviceItem(activeOffer.id, item.id, {
                                          modelFamily: event.target.value
                                        })
                                      }
                                      placeholder="Modellfamilie"
                                    />
                                  </Field>
                                  <Field label="Mindest-Spezifikation">
                                    <input
                                      className={inputClass}
                                      value={item.minSpec}
                                      onChange={(event) =>
                                        updateDeviceItem(activeOffer.id, item.id, {
                                          minSpec: event.target.value
                                        })
                                      }
                                      placeholder="z.B. 10GbE, 8 GB RAM"
                                    />
                                  </Field>
                                  <Field label="Qualitätskriterien">
                                    <input
                                      className={inputClass}
                                      value={item.qualityCriteria}
                                      onChange={(event) =>
                                        updateDeviceItem(activeOffer.id, item.id, {
                                          qualityCriteria: event.target.value
                                        })
                                      }
                                      placeholder="Support, Zertifikate, Garantie"
                                    />
                                  </Field>
                                  <Field label="Entscheidungsgrund">
                                    <input
                                      className={inputClass}
                                      value={item.decisionReason}
                                      onChange={(event) =>
                                        updateDeviceItem(activeOffer.id, item.id, {
                                          decisionReason: event.target.value
                                        })
                                      }
                                      placeholder="Warum dieses Profil?"
                                    />
                                  </Field>
                                  <Field label="Vergänglicher Händlerlink">
                                    <div className="space-y-2">
                                      <input
                                        className={inputClass}
                                        value={item.dealerLink}
                                        onChange={(event) =>
                                          updateDeviceItem(activeOffer.id, item.id, {
                                            dealerLink: event.target.value
                                          })
                                        }
                                        placeholder="https://..."
                                      />
                                      <input
                                        className={inputClass}
                                        type="date"
                                        value={item.dealerLinkDate}
                                        onChange={(event) =>
                                          updateDeviceItem(activeOffer.id, item.id, {
                                            dealerLinkDate: event.target.value
                                          })
                                        }
                                      />
                                    </div>
                                  </Field>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Keine Gerätepositionen angelegt.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">sevDesk Übergabe</p>
                <p className="mt-2 text-sm text-slate-600">
                  Es werden nur Kurzpositionstitel, Menge, Preis und Referenz-ID übergeben.
                </p>
                {payloadPreview ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="uppercase tracking-[0.3em] text-slate-500">Preview</span>
                      <span>{formatDate(payloadTimestamp)}</span>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap">
                      {JSON.stringify(payloadPreview, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Noch keine Übergabe erzeugt.
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-sm text-slate-500">
              Kein Angebot ausgewählt.
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
