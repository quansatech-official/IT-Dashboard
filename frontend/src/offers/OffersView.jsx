import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Link, Plus, Receipt, Sparkles } from "lucide-react";

const inputClass =
  "w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400";

const textareaClass =
  "w-full min-h-[120px] rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400";
const noteTextareaClass = `${textareaClass} min-h-[90px]`;

const impulses = ["Gespräch", "Bericht", "Standardleistung", "Erneuerung", "Empfehlung"];
const statusOptions = ["Entwurf", "gesendet", "angenommen", "abgelehnt"];
const complexityOptions = ["niedrig", "mittel", "hoch"];
const positionTypes = [
  { value: "Dienstleistung", label: "Leistung" },
  { value: "Gerät", label: "Geraet" },
  { value: "Sonstiges", label: "Sonstiges" }
];

const serviceBlocks = [
  {
    id: "block-secure",
    title: "Sicherheits-Haertung",
    summary: "Regeln, Logging, Segmentierung",
    type: "Dienstleistung",
    complexity: "hoch",
    securityRelevant: true,
    price: 1800,
    quantity: 1,
    researchHours: 3,
    keywords: ["Regeln", "Logging", "Segmentierung"]
  },
  {
    id: "block-vpn",
    title: "VPN-Refresh",
    summary: "MFA aktivieren, Clients aktualisieren",
    type: "Dienstleistung",
    complexity: "mittel",
    securityRelevant: true,
    price: 620,
    quantity: 1,
    researchHours: 1.5,
    keywords: ["MFA", "Client-Update"]
  },
  {
    id: "block-patch",
    title: "Patch-Standardisierung",
    summary: "Windows, Mac, Wartungsfenster",
    type: "Dienstleistung",
    complexity: "mittel",
    securityRelevant: false,
    price: 900,
    quantity: 1,
    researchHours: 2,
    keywords: ["Windows", "Mac", "Zeitfenster"]
  },
  {
    id: "block-backup",
    title: "Backup-Optimierung",
    summary: "Retention, Restore-Tests, Monitoring",
    type: "Dienstleistung",
    complexity: "mittel",
    securityRelevant: true,
    price: 750,
    quantity: 1,
    researchHours: 2,
    keywords: ["Retention", "Restore", "Monitoring"]
  },
  {
    id: "block-endpoint",
    title: "Endpoint-Baseline",
    summary: "AV, Hardening, Policies",
    type: "Dienstleistung",
    complexity: "niedrig",
    securityRelevant: true,
    price: 420,
    quantity: 1,
    researchHours: 1,
    keywords: ["AV", "Policies"]
  }
];

const deviceBlocks = [
  {
    id: "device-fw",
    title: "Firewall-Appliance",
    manufacturer: "Sophos",
    modelFamily: "XGS",
    minSpec: "XGS 116, 10GbE, 8 GB RAM",
    qualityCriteria: "Support bis 2029, HA-faehig",
    decisionReason: "Passt zum bestehenden Monitoring",
    dealerLink: "",
    dealerLinkDate: ""
  },
  {
    id: "device-backup",
    title: "Backup-Storage",
    manufacturer: "Synology",
    modelFamily: "RackStation",
    minSpec: "10GbE, 4-Bay, Btrfs",
    qualityCriteria: "Snapshot-Backups, 5 Jahre Garantie",
    decisionReason: "Gute Integration in vorhandene Workflows",
    dealerLink: "",
    dealerLinkDate: ""
  },
  {
    id: "device-wifi",
    title: "WLAN-Upgrade",
    manufacturer: "Ubiquiti",
    modelFamily: "UniFi 6",
    minSpec: "WiFi 6E, PoE, Cloud-Controller",
    qualityCriteria: "Zentrales Management, Roaming",
    decisionReason: "Einheitliche Abdeckung fuer Standorte",
    dealerLink: "",
    dealerLinkDate: ""
  }
];

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

const emptyInternalNotes = {
  deviceLink: "",
  remarks: "",
  customerWish: ""
};

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
    internalNotes: {
      ...emptyInternalNotes
    },
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
    internalNotes: {
      ...emptyInternalNotes
    },
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

const buildLineItemFromBlock = (block = {}) => ({
  id: uid(),
  type: block.type || "Dienstleistung",
  title: block.title || "",
  keywords: block.keywords || [],
  complexity: block.complexity || "niedrig",
  securityRelevant: Boolean(block.securityRelevant),
  price: Number(block.price || 0),
  quantity: Number(block.quantity || 1),
  researchHours: Number(block.researchHours || 0),
  aiVersions: [],
  activeAiVersionId: null,
  aiDraft: ""
});

const buildDeviceItemFromBlock = (block = {}) => ({
  id: uid(),
  manufacturer: block.manufacturer || "",
  modelFamily: block.modelFamily || "",
  minSpec: block.minSpec || "",
  qualityCriteria: block.qualityCriteria || "",
  decisionReason: block.decisionReason || "",
  dealerLink: block.dealerLink || "",
  dealerLinkDate: block.dealerLinkDate || ""
});

function Field({ label, children }) {
  return (
    <label className="text-[11px] uppercase tracking-[0.2em] text-sand-500">
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
  const [positionType, setPositionType] = useState(
    positionTypes[0]?.value || "Dienstleistung"
  );
  const [servicePick, setServicePick] = useState(serviceBlocks[0]?.id || "");
  const [devicePick, setDevicePick] = useState(deviceBlocks[0]?.id || "");

  const activeOffer = offers.find((offer) => offer.id === activeId) || null;

  const totals = useMemo(() => {
    if (!activeOffer) return { total: 0, count: 0 };
    const total = activeOffer.lineItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    return { total, count: activeOffer.lineItems.length };
  }, [activeOffer]);

  const positionCount = useMemo(() => {
    if (!activeOffer) return 0;
    return activeOffer.lineItems.length + activeOffer.deviceItems.length;
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
      internalNotes: {
        ...emptyInternalNotes
      },
      lineItems: [],
      deviceItems: []
    };
    setOffers((prev) => [newOffer, ...prev]);
    setActiveId(newOffer.id);
  };

  const addLineItem = (block) => {
    if (!activeOffer) return;
    const newItem = buildLineItemFromBlock(block);
    updateOffer(activeOffer.id, (offer) => ({
      ...offer,
      lineItems: [...offer.lineItems, newItem]
    }));
  };

  const addDeviceItem = (block) => {
    if (!activeOffer) return;
    const newItem = buildDeviceItemFromBlock(block);
    updateOffer(activeOffer.id, (offer) => ({
      ...offer,
      deviceItems: [...offer.deviceItems, newItem]
    }));
  };

  const addPosition = () => {
    if (!activeOffer) return;
    if (positionType === "Gerät") {
      addDeviceItem();
      return;
    }
    addLineItem({ type: positionType });
  };

  const addSelectedService = () => {
    if (!activeOffer) return;
    const block = serviceBlocks.find((item) => item.id === servicePick);
    if (!block) return;
    addLineItem(block);
  };

  const addSelectedDevice = () => {
    if (!activeOffer) return;
    const block = deviceBlocks.find((item) => item.id === devicePick);
    if (!block) return;
    addDeviceItem(block);
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
    <div className="min-h-screen bg-sand-50 bg-[radial-gradient(circle_at_20%_0%,rgba(253,242,227,0.7),transparent_40%),radial-gradient(circle_at_85%_15%,rgba(209,236,255,0.55),transparent_45%)]">
      <header className="border-b border-sand-200 bg-hero-pattern">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sand-900 text-white flex items-center justify-center shadow-soft">
              <Receipt size={20} />
            </div>
            <div className="min-w-[220px]">
              <p className="text-xs uppercase tracking-[0.4em] text-sand-500">
                Angebotswerkstatt
              </p>
              <h1 className="text-3xl font-display text-sand-900">Angebotsworkflow</h1>
              <p className="mt-1 text-sm text-sand-600">
                Bausteine auswaehlen, KI erklaert, sevDesk verrechnet.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("internal")}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
                  viewMode === "internal"
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                }`}
              >
                Intern
              </button>
              <button
                type="button"
                onClick={() => setViewMode("customer")}
                className={`rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
                  viewMode === "customer"
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                }`}
              >
                Kundenansicht
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {[
              {
                step: "Schritt 1",
                title: "Kontext setzen",
                detail: "Kunde, Anlass, Status"
              },
              {
                step: "Schritt 2",
                title: "Bausteine waehlen",
                detail: "Services und Geraete"
              },
              {
                step: "Schritt 3",
                title: "KI-Text formen",
                detail: "Kurz erklaeren, Wert zeigen"
              },
              {
                step: "Schritt 4",
                title: "Uebergabe",
                detail: "sevDesk Payload erzeugen"
              }
            ].map((card, index) => (
              <div
                key={card.title}
                className="rounded-2xl border border-sand-200 bg-sand-100-60 p-4 backdrop-blur animate-fade-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                  {card.step}
                </p>
                <p className="mt-2 text-sm font-semibold text-sand-900">{card.title}</p>
                <p className="mt-1 text-xs text-sand-600">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <section className="space-y-6">
          <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Angebote</p>
              <button
                type="button"
                onClick={addOffer}
                className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-3 py-1 text-xs uppercase tracking-wide text-white hover:opacity-90"
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
                      ? "border-sand-900 bg-sand-900 text-white shadow-soft"
                      : "border-sand-200 bg-sand-50 text-sand-700 hover:bg-sand-100"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.3em] opacity-70">
                    {offer.reference}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {offer.customer || "Neues Angebot"}
                  </p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.3em] opacity-70">
                    {offer.status} · {formatDate(offer.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {activeOffer ? (
            <>
              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-6 shadow-soft animate-fade-in">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                      Header Konfigurator
                    </p>
                    <h2 className="text-lg font-display text-sand-900">Angebotskopf</h2>
                    <p className="text-sm text-sand-600">
                      Kunde, Anlass, Status und Referenzen.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      {activeOffer.status}
                    </span>
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      {positionCount} Positionen
                    </span>
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      Gesamt {formatMoney(totals.total)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-sand-200 bg-sand-100 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                      Referenz
                    </p>
                    <p className="mt-2 text-sm font-semibold text-sand-900">
                      {activeOffer.reference}
                    </p>
                    <p className="mt-1 text-xs text-sand-500">
                      Erstellt {formatDate(activeOffer.createdAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-sand-100 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                      Kunde
                    </p>
                    <p className="mt-2 text-sm font-semibold text-sand-900">
                      {activeOffer.customer || "Noch offen"}
                    </p>
                    <p className="mt-1 text-xs text-sand-500">{activeOffer.impulse}</p>
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-sand-100 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                      Verknuepfung
                    </p>
                    <p className="mt-2 text-sm text-sand-900">
                      {activeOffer.linkedTask || "Keine Aufgabe"}
                    </p>
                    <p className="mt-1 text-xs text-sand-500">
                      {activeOffer.linkedReport || "Kein Bericht"}
                    </p>
                  </div>
                </div>

                {viewMode === "internal" ? (
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
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
                        placeholder="z.B. Q3 Stabilitaetscheck"
                      />
                    </Field>
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-sand-200 bg-sand-100 p-4 text-sm text-sand-700">
                    <p>
                      <span className="text-sand-500">Kunde:</span>{" "}
                      {activeOffer.customer || "—"}
                    </p>
                    <p>
                      <span className="text-sand-500">Anlass:</span> {activeOffer.impulse}
                    </p>
                    <p>
                      <span className="text-sand-500">Status:</span> {activeOffer.status}
                    </p>
                  </div>
                )}
              </section>

              {viewMode === "internal" ? (
                <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-6 shadow-soft animate-fade-in">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                      Interne Vermerke
                    </p>
                    <h2 className="text-lg font-display text-sand-900">Interne Vermerke</h2>
                    <p className="text-sm text-sand-600">
                      Geraete-Link, Kundenwuensche und Kontext sichern.
                    </p>
                  </div>
                  <div className="mt-4 space-y-4">
                    <Field label="Geraete-Link">
                      <input
                        className={inputClass}
                        value={activeOffer.internalNotes.deviceLink}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            internalNotes: {
                              ...(offer.internalNotes || emptyInternalNotes),
                              deviceLink: event.target.value
                            }
                          }))
                        }
                        placeholder="https://..."
                      />
                    </Field>
                    <Field label="Kundenwunsch">
                      <textarea
                        className={noteTextareaClass}
                        value={activeOffer.internalNotes.customerWish}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            internalNotes: {
                              ...(offer.internalNotes || emptyInternalNotes),
                              customerWish: event.target.value
                            }
                          }))
                        }
                        placeholder="z.B. Umsetzung bis Jahresende"
                      />
                    </Field>
                    <Field label="Interne Anmerkungen">
                      <textarea
                        className={noteTextareaClass}
                        value={activeOffer.internalNotes.remarks}
                        onChange={(event) =>
                          updateOffer(activeOffer.id, (offer) => ({
                            ...offer,
                            internalNotes: {
                              ...(offer.internalNotes || emptyInternalNotes),
                              remarks: event.target.value
                            }
                          }))
                        }
                        placeholder="Kurznotizen fuer intern"
                      />
                    </Field>
                  </div>
                </section>
              ) : null}

              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-6 shadow-soft animate-fade-in">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                      Positionen
                    </p>
                    <h2 className="text-lg font-display text-sand-900">
                      Positionen zusammenstellen
                    </h2>
                    <p className="text-sm text-sand-600">
                      Leistung oder Geraet anlegen, Vorlagen nutzen.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      {activeOffer.lineItems.length} Leistungen
                    </span>
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      {activeOffer.deviceItems.length} Geraete
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-4">
                    {viewMode === "internal" ? (
                      <>
                        <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-sand-700">
                            <Plus size={16} />
                            <p className="text-xs uppercase tracking-wide text-sand-600">
                              Neue Position
                            </p>
                          </div>
                          <p className="text-sm text-sand-600">
                            Leistung oder Geraet direkt anlegen.
                          </p>
                          <div className="flex items-center gap-2">
                            <select
                              value={positionType}
                              onChange={(event) => setPositionType(event.target.value)}
                              className="flex-1 rounded-full border border-sand-200 px-3 py-2 text-sm bg-white"
                            >
                              {positionTypes.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={addPosition}
                              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                            >
                              <Plus size={12} /> Hinzufuegen
                            </button>
                          </div>
                        </div>

                        <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-sand-700">
                            <Sparkles size={16} />
                            <p className="text-xs uppercase tracking-wide text-sand-600">
                              Service-Baustein
                            </p>
                          </div>
                          <p className="text-sm text-sand-600">
                            Vorgefertigte Leistung uebernehmen.
                          </p>
                          <select
                            value={servicePick}
                            onChange={(event) => setServicePick(event.target.value)}
                            className="rounded-full border border-sand-200 px-4 py-2 text-sm bg-white"
                            disabled={!serviceBlocks.length}
                          >
                            {serviceBlocks.map((block) => (
                              <option key={block.id} value={block.id}>
                                {block.title}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addSelectedService}
                            disabled={!serviceBlocks.length || !servicePick}
                            className="mt-auto inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Plus size={14} /> Hinzufuegen
                          </button>
                        </div>

                        <div className="bg-white border border-sand-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-sand-700">
                            <Link size={16} />
                            <p className="text-xs uppercase tracking-wide text-sand-600">
                              Geraete-Baustein
                            </p>
                          </div>
                          <p className="text-sm text-sand-600">
                            Vorgefertigtes Geraeteprofil uebernehmen.
                          </p>
                          <select
                            value={devicePick}
                            onChange={(event) => setDevicePick(event.target.value)}
                            className="rounded-full border border-sand-200 px-4 py-2 text-sm bg-white"
                            disabled={!deviceBlocks.length}
                          >
                            {deviceBlocks.map((block) => (
                              <option key={block.id} value={block.id}>
                                {block.title}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={addSelectedDevice}
                            disabled={!deviceBlocks.length || !devicePick}
                            className="mt-auto inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Plus size={14} /> Hinzufuegen
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-4 text-sm text-sand-500">
                        Positionen sind in der Kundenansicht gesperrt.
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-sand-200 bg-sand-100 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                          Leistungspositionen
                        </p>
                        <span className="text-xs text-sand-500">
                          {activeOffer.lineItems.length} Bausteine
                        </span>
                      </div>
                      {activeOffer.lineItems.length ? (
                        activeOffer.lineItems.map((item) => {
                          const detailKey = `line-details-${item.id}`;
                          const detailsOpen = !!detailOpen[detailKey];
                          return (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-sand-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                    {item.type}
                                  </p>
                                  <p className="text-sm font-semibold text-sand-900">
                                    {item.title || "Unbenannte Position"}
                                  </p>
                                  <p className="text-xs text-sand-500">
                                    {item.keywords?.length
                                      ? item.keywords.join(" · ")
                                      : "Keine Stichworte"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sand-500">
                                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1">
                                    {item.complexity}
                                  </span>
                                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1">
                                    {formatMoney(item.price)} · {item.quantity}x
                                  </span>
                                  {item.securityRelevant ? (
                                    <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1">
                                      Sicherheit
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {viewMode === "internal" ? (
                                <div className="mt-4 space-y-3">
                                  <div className="grid gap-3 md:grid-cols-4">
                                    <Field label="Titel">
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
                                    <Field label="Preis">
                                      <input
                                        className={inputClass}
                                        type="number"
                                        value={item.price}
                                        onChange={(event) =>
                                          updateLineItem(activeOffer.id, item.id, {
                                            price: Number(event.target.value)
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Menge">
                                      <input
                                        className={inputClass}
                                        type="number"
                                        value={item.quantity}
                                        onChange={(event) =>
                                          updateLineItem(activeOffer.id, item.id, {
                                            quantity: Number(event.target.value)
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field label="Komplexitaet">
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
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleDetail(detailKey)}
                                    className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                  >
                                    {detailsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    Details
                                  </button>
                                  {detailsOpen ? (
                                    <div className="grid gap-3 md:grid-cols-4">
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
                                          <option value="Sonstiges">Sonstiges</option>
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
                                          placeholder="Kurz, getrennt durch Komma"
                                        />
                                      </Field>
                                      <Field label="Recherche (h)">
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
                                        <label
                                          htmlFor={`security-${item.id}`}
                                          className="text-sm text-sand-700"
                                        >
                                          Sicherheitsrelevant
                                        </label>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-4 text-sm text-sand-500">
                          Noch keine Leistungsbausteine ausgewaehlt.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-sand-200 bg-sand-100 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                          Geraeteprofile
                        </p>
                        <span className="text-xs text-sand-500">
                          {activeOffer.deviceItems.length} Profile
                        </span>
                      </div>
                      {activeOffer.deviceItems.length ? (
                        activeOffer.deviceItems.map((item) => {
                          const detailKey = `device-${item.id}`;
                          const showDetails = !!detailOpen[detailKey];
                          return (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-sand-200 bg-white p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                    Geraeteprofil
                                  </p>
                                  <p className="text-sm font-semibold text-sand-900">
                                    {item.manufacturer || "Hersteller"} ·{" "}
                                    {item.modelFamily || "Modellfamilie"}
                                  </p>
                                  <p className="text-xs text-sand-500">
                                    {item.minSpec || "Mindest-Spezifikation definieren"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {viewMode === "customer" && item.dealerLink ? (
                                    <a
                                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                      href={item.dealerLink}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <Link size={12} /> Haendlerlink
                                    </a>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => toggleDetail(detailKey)}
                                    className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                  >
                                    {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    {viewMode === "internal" ? "Bearbeiten" : "Details"}
                                  </button>
                                </div>
                              </div>

                              {showDetails ? (
                                <>
                                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                        Qualitaetskriterien
                                      </p>
                                      <p className="mt-2 text-sm text-sand-700">
                                        {item.qualityCriteria || "Noch nicht hinterlegt."}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                        Entscheidungsgrund
                                      </p>
                                      <p className="mt-2 text-sm text-sand-700">
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
                                      <Field label="Qualitaetskriterien">
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
                                      <Field label="Vergaenglicher Haendlerlink">
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
                        <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-4 text-sm text-sand-500">
                          Keine Geraeteprofile hinterlegt.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-6 shadow-soft animate-fade-in">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                      Leistungsbeschreibung
                    </p>
                    <h2 className="text-lg font-display text-sand-900">KI-Text formen</h2>
                    <p className="text-sm text-sand-600">
                      Kurz, ruhig, ohne Preise. Versioniert fuer spaeter.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {activeOffer.lineItems.length ? (
                    activeOffer.lineItems.map((item) => {
                      const aiKey = `line-ai-${item.id}`;
                      const aiOpen = !!detailOpen[aiKey];
                      const activeVersion = getActiveVersion(item);
                      const aiPreview = activeVersion?.text
                        ? shorten(activeVersion.text.split("\n")[0] || "")
                        : "Noch kein Text";
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-sand-200 bg-sand-100 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-sand-900">
                                {item.title || "Unbenannte Position"}
                              </p>
                              <p className="text-xs text-sand-500">{aiPreview}</p>
                            </div>
                            {viewMode === "internal" ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateLineItem(activeOffer.id, item.id, {
                                      aiDraft: generateAiText(item)
                                    })
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                >
                                  <Sparkles size={12} /> Entwurf
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveAiVersion(item)}
                                  className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                >
                                  Version sichern
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleDetail(aiKey)}
                                  className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                >
                                  {aiOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  Bearbeiten
                                </button>
                              </div>
                            ) : null}
                          </div>

                          {viewMode === "customer" ? (
                            <div className="mt-3 text-sm text-sand-700 whitespace-pre-line">
                              {activeVersion?.text || "Noch keine Erklaerung hinterlegt."}
                            </div>
                          ) : null}

                          {viewMode === "internal" && aiOpen ? (
                            <div className="mt-4 space-y-3">
                              <textarea
                                className={textareaClass}
                                value={ensureDraft(item)}
                                onChange={(event) =>
                                  updateLineItem(activeOffer.id, item.id, {
                                    aiDraft: event.target.value
                                  })
                                }
                                placeholder="KI-Text bearbeiten oder erzeugen..."
                              />

                              {activeVersion ? (
                                <div className="rounded-xl border border-sand-200 bg-white p-3 text-sm text-sand-700 whitespace-pre-line">
                                  {activeVersion.text}
                                </div>
                              ) : (
                                <div className="text-sm text-sand-500">
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
                                          ? "border-sand-900 bg-sand-900 text-white"
                                          : "border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
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
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-100 p-4 text-sm text-sand-500">
                      Keine Positionen fuer KI-Text vorhanden.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-6 shadow-soft animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                      Uebergabe
                    </p>
                    <h2 className="text-lg font-display text-sand-900">
                      Uebergabe & Abrechnung
                    </h2>
                    <p className="text-sm text-sand-600">
                      Es werden nur Kurzpositionstitel, Menge, Preis und Referenz-ID
                      uebergeben.
                    </p>
                  </div>
                  {viewMode === "internal" ? (
                    <button
                      type="button"
                      onClick={handleSevDesk}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90"
                    >
                      Rechnungsentwurf in sevDesk erzeugen
                    </button>
                  ) : null}
                </div>

                {payloadPreview ? (
                  <div className="mt-4 rounded-2xl border border-sand-200 bg-sand-100 p-4 text-xs text-sand-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="uppercase tracking-[0.3em] text-sand-500">Preview</span>
                      <span>{formatDate(payloadTimestamp)}</span>
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap">
                      {JSON.stringify(payloadPreview, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-sand-200 bg-sand-100 p-4 text-sm text-sand-500">
                    Noch keine Uebergabe erzeugt.
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-sand-200 bg-white p-6 shadow-soft text-sm text-sand-500">
              Kein Angebot ausgewaehlt.
            </section>
          )}
        </section>

        <aside className="space-y-6 xl:max-w-sm xl:justify-self-end">
          <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                  Live Vorschau
                </p>
                <h3 className="text-lg font-display text-sand-900">Angebot</h3>
              </div>
              {activeOffer ? (
                <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600">
                  {activeOffer.status}
                </span>
              ) : null}
            </div>
            {activeOffer ? (
              <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4 text-sm text-sand-700 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                    Kunde
                  </p>
                  <p className="mt-1 text-sm font-semibold text-sand-900">
                    {activeOffer.customer || "Noch offen"}
                  </p>
                  <p className="text-xs text-sand-500">
                    {activeOffer.reference} · {formatDate(activeOffer.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                    Leistungen
                  </p>
                  {activeOffer.lineItems.length ? (
                    <div className="mt-2 space-y-2">
                      {activeOffer.lineItems.map((item) => {
                        const activeVersion = getActiveVersion(item);
                        const previewText = activeVersion?.text
                          ? shorten(activeVersion.text.split("\n")[0] || "", 90)
                          : "Beschreibung fehlt.";
                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-sand-200 bg-white p-3"
                          >
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-sand-500">
                              <span>{item.title || "Position"}</span>
                              <span>
                                {formatMoney(item.price)} · {item.quantity}x
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-sand-600">{previewText}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-sand-500">
                      Keine Leistungen hinterlegt.
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                    Geraete
                  </p>
                  {activeOffer.deviceItems.length ? (
                    <div className="mt-2 space-y-2">
                      {activeOffer.deviceItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-sand-200 bg-white p-3"
                        >
                          <p className="text-xs font-semibold text-sand-900">
                            {item.manufacturer || "Hersteller"} ·{" "}
                            {item.modelFamily || "Modellfamilie"}
                          </p>
                          <p className="text-[11px] text-sand-500">
                            {item.minSpec || "Keine Spezifikation"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-sand-500">
                      Keine Geraeteprofile.
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-sand-200 pt-3 text-sm font-semibold text-sand-900">
                  <span>Gesamt</span>
                  <span>{formatMoney(totals.total)}</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-4 text-sm text-sand-500">
                Kein Angebot ausgewaehlt.
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}
