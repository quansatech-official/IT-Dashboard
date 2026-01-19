import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  FileDown,
  Image,
  Link,
  Plus,
  Receipt,
  Save,
  Send,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import html2pdf from "html2pdf.js";

const inputClass =
  "w-full rounded-xl border border-sand-200 bg-sand-50 px-3 py-1.5 text-[13px] text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400";

const textareaClass =
  "w-full min-h-[90px] rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-[13px] text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400";
const noteTextareaClass = `${textareaClass} min-h-[70px]`;

const statusOptions = ["Entwurf", "gesendet", "angenommen", "abgelehnt"];
const complexityOptions = ["niedrig", "mittel", "hoch"];
const positionTypes = [
  { value: "Dienstleistung", label: "Leistung" },
  { value: "Gerät", label: "Geraet" },
  { value: "Sonstiges", label: "Sonstiges" }
];
const unitOptions = [
  { value: "hours", label: "Stunden" },
  { value: "flat", label: "Pauschal" },
  { value: "piece", label: "Stueck" },
  { value: "day", label: "Tag" }
];

const initialServiceBlocks = [
  {
    id: "block-secure",
    title: "Sicherheits-Haertung",
    summary: "Regeln, Logging, Segmentierung",
    type: "Dienstleistung",
    complexity: "hoch",
    securityRelevant: true,
    price: 1800,
    quantity: 1,
    unit: "hours",
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
    unit: "hours",
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
    unit: "hours",
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
    unit: "hours",
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
    unit: "hours",
    researchHours: 1,
    keywords: ["AV", "Policies"]
  }
];

const initialDeviceBlocks = [
  {
    id: "device-fw",
    title: "Firewall-Appliance",
    manufacturer: "Sophos",
    model: "XGS",
    dealerLink: "",
    dealerLinkDate: ""
  },
  {
    id: "device-backup",
    title: "Backup-Storage",
    manufacturer: "Synology",
    model: "RackStation",
    dealerLink: "",
    dealerLinkDate: ""
  },
  {
    id: "device-wifi",
    title: "WLAN-Upgrade",
    manufacturer: "Ubiquiti",
    model: "UniFi 6",
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

const formatLineTotal = (price, quantity) =>
  formatMoney(Number(price || 0) * Number(quantity || 1));

const formatDeviceTitle = (item) =>
  `${item.manufacturer || "Geraet"}${item.model ? ` · ${item.model}` : ""}`;

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
  const keywordLine = keywords.length ? `Schwerpunkte: ${keywords.join(", ")}.` : "";
  const quantityLine = item.quantity ? `Menge: ${item.quantity}x.` : "";
  const securityLine = item.securityRelevant
    ? "Sicherheitsrelevant: Umsetzung nach Best Practices und mit enger Abstimmung."
    : "";

  if (item.complexity === "hoch") {
    return [
      `Wir planen und realisieren ${title} in klaren Phasen, damit Ablauf und Risiko sauber kontrolliert bleiben.`,
      keywordLine,
      "Vorgehen: Analyse der Ausgangslage, abgestimmte Umsetzung, anschliessender Funktionscheck.",
      securityLine || "Abnahme erfolgt nach gemeinsam definierten Kriterien.",
      quantityLine
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (item.complexity === "niedrig") {
    return [
      `Wir setzen ${title} kompakt und nachvollziehbar um.`,
      keywordLine || "Umfang und Ergebnis werden kurz dokumentiert.",
      quantityLine
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Wir realisieren ${title} strukturiert und mit Fokus auf stabile Ergebnisse.`,
    keywordLine,
    "Im Anschluss pruefen wir die Wirkung und dokumentieren die wichtigsten Punkte.",
    securityLine,
    quantityLine
  ]
    .filter(Boolean)
    .join("\n");
};

const generateCoverIntro = (offer) => {
  const customer = offer.customer || "Ihrem Team";
  const positionTexts = [...(offer.lineItems || []), ...(offer.deviceItems || [])]
    .map((item) => ensureDraft(item).trim())
    .filter(Boolean);
  if (!positionTexts.length) {
    return `Im folgenden Angebot zeigen wir die wichtigsten Positionen fuer ${customer} und fassen Umfang sowie Kalkulation kompakt zusammen.`;
  }
  const excerpts = positionTexts.slice(0, 3).map((text) => `- ${text}`);
  return `Im folgenden Angebot zeigen wir die wichtigsten Positionen fuer ${customer} und fassen Umfang sowie Kalkulation kompakt zusammen.\n\nBereits erfasste Positionen:\n${excerpts.join("\n")}`;
};

const VAT_MODE_OPTIONS = [
  { value: "standard", label: "MwSt. ausweisen" },
  { value: "intra_community", label: "Innergemeinschaftlicher Erwerb" },
  { value: "reverse_charge", label: "Reverse Charge" }
];
const DEFAULT_VAT_RATE = 20;
const calcVat = (net, offer) => {
  if (!offer || offer.vatMode !== "standard") return 0;
  const rate = Number(offer.vatRate ?? DEFAULT_VAT_RATE) / 100;
  return Number(net || 0) * rate;
};
const formatVatLabel = (offer) => {
  if (!offer) return "MwSt";
  if (offer.vatMode === "reverse_charge") return "Reverse Charge (0%)";
  if (offer.vatMode === "intra_community") return "Innerg. Erwerb (0%)";
  const rate = Number(offer.vatRate ?? DEFAULT_VAT_RATE);
  return `MwSt (${rate}%)`;
};
const formatUnitLabel = (unit) => {
  switch (unit) {
    case "hours":
      return "Std";
    case "flat":
      return "pauschal";
    case "piece":
      return "Stk";
    case "day":
      return "Tag";
    default:
      return unit || "Std";
  }
};
const formatUnitQuantity = (quantity, unit) => {
  const label = formatUnitLabel(unit);
  if (label === "pauschal") return "pauschal";
  return `${Number(quantity || 0)} ${label}`;
};

const buildSevDeskPayload = (offer) => ({
  offer_reference: offer.reference,
  items: [...offer.lineItems, ...offer.deviceItems].map((item) => ({
    title: item.title || `${item.manufacturer || "Geraet"} ${item.model || ""}`.trim(),
    quantity: Number(item.quantity || 1),
    price: Number(item.price || 0)
  }))
});

const internalNoteOptions = [
  { value: "", label: "Kein Vermerk" },
  { value: "bezugslink", label: "Bezugslink (URL)" },
  { value: "kundenwunsch", label: "Kundenwunsch" },
  { value: "anmerkungen", label: "Anmerkungen" }
];

const initialOffers = [];
const AUTOSAVE_KEY = "qt_offer_autosave";

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
  unit: block.unit || "hours",
  researchHours: Number(block.researchHours || 0),
  aiVersions: [],
  activeAiVersionId: null,
  aiDraft: "",
  internalNotes: []
});

const buildDeviceItemFromBlock = (block = {}) => ({
  id: uid(),
  manufacturer: block.manufacturer || "",
  model: block.model || block.modelFamily || "",
  price: Number(block.price || 0),
  quantity: Number(block.quantity || 1),
  images: [],
  internalNotes: []
});

const defaultOfferFormat = "AN-XXXX";
const makeReference = (format, index) => {
  const template = (format || defaultOfferFormat).trim() || defaultOfferFormat;
  const match = template.match(/X+/);
  if (!match) return template;
  const width = match[0].length;
  const number = String(index).padStart(width, "0");
  return template.replace(match[0], number);
};

const createEmptyOffer = (index, format) => ({
  id: uid(),
  reference: makeReference(format, index),
  customer: "",
  status: "Entwurf",
  createdAt: new Date().toISOString(),
  vatMode: "standard",
  vatRate: DEFAULT_VAT_RATE,
  coverEnabled: false,
  coverHeadline: "",
  coverSubheadline: "",
  coverIntro: "",
  overviewText: "",
  calculationText: "",
  detailHtml: "",
  attachments: [],
  lineItems: [],
  deviceItems: []
});

const sanitizeOffersForSave = (offers) =>
  offers.map((offer) => ({
    ...offer,
    attachments: (offer.attachments || []).map((item) => {
      if (item.url && item.url.startsWith("blob:")) {
        return { ...item, url: "", source: "upload" };
      }
      return item;
    })
  }));

const buildPreviewPositions = (offer) => {
  if (!offer) return [];
  const linePositions = (offer.lineItems || []).map((item) => {
    const activeVersion = getActiveVersion(item);
    return {
      id: item.id,
      title: item.title || "Position",
      quantity: item.quantity,
      price: item.price,
      unit: item.unit || "hours",
      text: item.aiDraft || activeVersion?.text || "",
      images: [],
      category: "service"
    };
  });
  const devicePositions = (offer.deviceItems || []).map((item) => ({
    id: item.id,
    title: formatDeviceTitle(item),
    quantity: item.quantity,
    price: item.price,
    unit: "piece",
    text: "",
    images: item.images || [],
    category: "device"
  }));
  return [...linePositions, ...devicePositions];
};

const buildOfferEmailHtml = (offer) => {
  const positions = buildPreviewPositions(offer);
  const rows = positions
    .map(
      (item, index) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${index + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.title}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${formatUnitQuantity(
          item.quantity,
          item.unit
        )}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${formatLineTotal(
          item.price,
          item.quantity
        )}</td>
      </tr>
      ${item.text ? `<tr><td></td><td colspan="3" style="padding:4px 8px;color:#666;">${item.text.replace(/\n/g, "<br/>")}</td></tr>` : ""}
    `
    )
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937">
      <h2>Ihr Angebot ${offer.reference || ""}</h2>
      <p>Kunde: ${offer.customer || "Kunde offen"}</p>
      ${offer.overviewText ? `<p>${offer.overviewText.replace(/\n/g, "<br/>")}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Pos</th>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Ueberschrift</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">Menge</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">Netto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

function OfferPreview({ offer, scale = 1, containerRef }) {
  if (!offer) {
    return (
      <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-4 text-sm text-sand-500">
        Kein Angebot ausgewaehlt.
      </div>
    );
  }
  const previewPositions = buildPreviewPositions(offer);
  const serviceTotal = (offer.lineItems || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );
  const deviceTotal = (offer.deviceItems || []).reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );
  const totalNet = serviceTotal + deviceTotal;
  const totalVat = calcVat(totalNet, offer);
  const totalGross = totalNet + totalVat;
  const hasPositionText = previewPositions.some((item) => item.text);
  const hasProductPhotos = previewPositions.some((item) => item.images?.length);
  const a4WidthPx = 210 * 3.7795275591;
  const a4HeightPx = 297 * 3.7795275591;

  return (
    <div ref={containerRef} className="space-y-6 overflow-auto">
      {offer.coverEnabled ? (
        <div
          className="mx-auto"
          style={{
            width: `${a4WidthPx * scale}px`,
            height: `${a4HeightPx * scale}px`
          }}
        >
          <div
            className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft flex flex-col"
            style={{
              width: `${a4WidthPx}px`,
              height: `${a4HeightPx}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left"
            }}
          >
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <img src="/QTLogo.jpg" alt="QT" className="h-24 w-auto mb-8" />
              <h2 className="text-4xl font-display text-sand-900">Angebot</h2>
              {offer.coverHeadline ? (
                <p className="mt-4 text-lg text-sand-700">{offer.coverHeadline}</p>
              ) : null}
              {offer.coverIntro ? (
                <p className="mt-6 text-sm text-sand-600 whitespace-pre-line max-w-xl">
                  {offer.coverIntro}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between text-sm text-sand-600">
              <div>
                <p>{offer.customer || "Kunde offen"}</p>
                <p>{formatDate(offer.createdAt)}</p>
              </div>
              <span className="text-xs uppercase tracking-[0.3em] text-sand-400">
                {offer.reference}
              </span>
            </div>
            <div className="mt-4 border-t border-sand-200 pt-3 text-[10px] text-sand-500">
              Es gelten unsere AGB. Firmendaten siehe AGB.
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="mx-auto"
        style={{
          width: `${a4WidthPx * scale}px`,
          height: `${a4HeightPx * scale}px`
        }}
      >
        <div
          className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft flex flex-col"
          style={{
            width: `${a4WidthPx}px`,
            height: `${a4HeightPx}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left"
          }}
        >
          <div className="flex items-center justify-between border-b border-sand-200 pb-4">
            <div className="flex items-center gap-2">
              <img src="/QTLogo.jpg" alt="QT" className="h-6 w-auto" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                Angebot
              </span>
            </div>
            <span className="text-xs text-sand-500">{offer.reference}</span>
          </div>
          <div className="mt-4 flex-1 space-y-6">
            <div>
              <h2 className="text-2xl font-display text-sand-900">
                {offer.customer || "Kunde offen"}
              </h2>
              <p className="text-xs text-sand-500">{formatDate(offer.createdAt)}</p>
            </div>

            {offer.overviewText ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Uebersicht
                </p>
                <p className="mt-2 text-sm text-sand-700 whitespace-pre-line">
                  {offer.overviewText}
                </p>
              </div>
            ) : null}

            {previewPositions.length ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Kalkulation
                </p>
                <div className="mt-2 rounded-xl border border-sand-200">
                  <div className="grid grid-cols-[0.2fr_1.2fr_0.4fr_0.5fr_0.5fr] gap-2 border-b border-sand-200 bg-sand-50 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-sand-400">
                    <span>Pos</span>
                    <span>Ueberschrift</span>
                    <span className="text-right">Menge</span>
                    <span className="text-right">{formatVatLabel(offer)}</span>
                    <span className="text-right">Netto</span>
                  </div>
                  {previewPositions.some((item) => item.category === "service") ? (
                    <>
                      <div className="border-b border-sand-200 bg-white/70 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-sand-400">
                        Leistungen
                      </div>
                      {previewPositions
                        .filter((item) => item.category === "service")
                        .map((item, index) => (
                          <div key={item.id} className="border-b border-sand-100">
                            <div className="grid grid-cols-[0.2fr_1.2fr_0.4fr_0.5fr_0.5fr] gap-2 px-3 py-2 text-xs text-sand-700">
                              <span>Pos. {index + 1}</span>
                              <span>{item.title}</span>
                              <span className="text-right">
                                {formatUnitQuantity(item.quantity, item.unit)}
                              </span>
                              <span className="text-right">
                                {formatMoney(
                                  calcVat(
                                    Number(item.price || 0) * Number(item.quantity || 1),
                                    offer
                                  )
                                )}
                              </span>
                              <span className="text-right">
                                {formatLineTotal(item.price, item.quantity)}
                              </span>
                            </div>
                            {item.text ? (
                              <div className="px-3 pb-2 text-xs text-sand-500 whitespace-pre-line">
                                {item.text}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      <div className="grid grid-cols-[0.2fr_1.2fr_0.4fr_0.5fr_0.5fr] gap-2 border-b border-sand-100 bg-sand-50 px-3 py-2 text-xs font-semibold text-sand-700">
                        <span />
                        <span>Zwischensumme Leistungen</span>
                        <span />
                        <span className="text-right">
                          {formatMoney(calcVat(serviceTotal, offer))}
                        </span>
                        <span className="text-right">{formatMoney(serviceTotal)}</span>
                      </div>
                    </>
                  ) : null}
                  {previewPositions.some((item) => item.category === "device") ? (
                    <>
                      <div className="border-b border-sand-200 bg-white/70 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-sand-400">
                        Geraete
                      </div>
                      {previewPositions
                        .filter((item) => item.category === "device")
                        .map((item, index) => (
                          <div key={item.id} className="border-b border-sand-100">
                            <div className="grid grid-cols-[0.2fr_1.2fr_0.4fr_0.5fr_0.5fr] gap-2 px-3 py-2 text-xs text-sand-700">
                              <span>Pos. {index + 1 + offer.lineItems.length}</span>
                              <span>{item.title}</span>
                              <span className="text-right">{item.quantity}x</span>
                              <span className="text-right">
                                {formatMoney(
                                  calcVat(
                                    Number(item.price || 0) * Number(item.quantity || 1),
                                    offer
                                  )
                                )}
                              </span>
                              <span className="text-right">
                                {formatLineTotal(item.price, item.quantity)}
                              </span>
                            </div>
                          </div>
                        ))}
                      <div className="grid grid-cols-[0.2fr_1.2fr_0.4fr_0.5fr_0.5fr] gap-2 border-b border-sand-100 bg-sand-50 px-3 py-2 text-xs font-semibold text-sand-700">
                        <span />
                        <span>Zwischensumme Geraete</span>
                        <span />
                        <span className="text-right">
                          {formatMoney(calcVat(deviceTotal, offer))}
                        </span>
                        <span className="text-right">{formatMoney(deviceTotal)}</span>
                      </div>
                    </>
                  ) : null}
                </div>
                {offer.calculationText ? (
                  <p className="mt-2 text-xs text-sand-600 whitespace-pre-line">
                    {offer.calculationText}
                  </p>
                ) : null}
                <div className="mt-3 space-y-2 text-sm text-sand-700">
                  <div className="flex items-center justify-between">
                    <span>Summe Leistungen (netto)</span>
                    <span>{formatMoney(serviceTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Summe Geraete (netto)</span>
                    <span>{formatMoney(deviceTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between font-semibold text-sand-900">
                    <span>Gesamt netto</span>
                    <span>{formatMoney(totalNet)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{formatVatLabel(offer)}</span>
                    <span>{formatMoney(totalVat)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-semibold text-sand-900">
                    <span>Gesamt brutto</span>
                    <span>{formatMoney(totalGross)}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {hasProductPhotos ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Produktfotos
                </p>
                <div className="mt-2 space-y-3">
                  {previewPositions.map((item, index) =>
                    item.images?.length ? (
                      <div key={item.id} className="rounded-xl border border-sand-200 p-3">
                        <p className="text-xs font-semibold text-sand-900">
                          Pos. {index + 1}: {item.title}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {item.images.map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt="Produkt"
                              className="h-28 w-40 rounded-xl object-cover"
                            />
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ) : null}

            {hasPositionText ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Positionen
                </p>
                <div className="mt-2 space-y-3">
                  {previewPositions.map((item, index) =>
                    item.text ? (
                      <div key={item.id} className="rounded-xl border border-sand-200 p-3">
                        <p className="text-sm font-semibold text-sand-900">
                          Pos. {index + 1}: {item.title}
                        </p>
                        <p className="mt-1 text-xs text-sand-600 whitespace-pre-line">
                          {item.text}
                        </p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            ) : null}

            {(offer.attachments || []).length ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Beilagen
                </p>
                <div className="mt-2 space-y-2 text-xs text-sand-600">
                  {offer.attachments.map((item) => (
                    <div key={item.id}>
                      <p className="font-semibold text-sand-800">
                        {item.title || item.fileName || "Beilage"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <div className="border-t border-sand-200 pt-3 text-[10px] text-sand-500">
            Es gelten unsere AGB. Firmendaten siehe AGB.
          </div>
        </div>
      </div>

      {offer.detailHtml ? (
        <div
          className="mx-auto"
          style={{
            width: `${a4WidthPx * scale}px`,
            height: `${a4HeightPx * scale}px`
          }}
        >
          <div
            className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft flex flex-col"
            style={{
              width: `${a4WidthPx}px`,
              height: `${a4HeightPx}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left"
            }}
          >
            <div className="flex items-center justify-between border-b border-sand-200 pb-4">
              <div className="flex items-center gap-2">
                <img src="/QTLogo.jpg" alt="QT" className="h-6 w-auto" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Angebot
                </span>
              </div>
              <span className="text-xs text-sand-500">{offer.reference}</span>
            </div>
            <div className="mt-4 flex-1 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Angebotsdetails
                </p>
                <p className="mt-2 text-sm text-sand-700 whitespace-pre-line">
                  {offer.detailHtml}
                </p>
              </div>
            </div>
            <div className="border-t border-sand-200 pt-3 text-[10px] text-sand-500">
              Es gelten unsere AGB. Firmendaten siehe AGB.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const extractDropUrl = (event) => {
  const dataTransfer = event?.dataTransfer;
  if (!dataTransfer || typeof dataTransfer.getData !== "function") return "";
  const uriList = dataTransfer.getData("text/uri-list");
  if (typeof uriList === "string" && uriList.trim()) {
    return uriList.split("\n")[0].trim();
  }
  const plain = dataTransfer.getData("text/plain");
  if (typeof plain === "string" && plain.trim().startsWith("http")) {
    return plain.split(/\s+/)[0];
  }
  const html = dataTransfer.getData("text/html");
  if (typeof html === "string" && html.trim()) {
    const match = html.match(/src=["']([^"']+)["']/i);
    if (match?.[1]) return match[1];
  }
  return "";
};

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
  const [activeId, setActiveId] = useState("");
  const [detailOpen, setDetailOpen] = useState({});
  const [payloadPreview, setPayloadPreview] = useState(null);
  const [payloadTimestamp, setPayloadTimestamp] = useState("");
  const [positionType, setPositionType] = useState(
    positionTypes[0]?.value || "Dienstleistung"
  );
  const [serviceBlocks, setServiceBlocks] = useState(initialServiceBlocks);
  const [deviceBlocks, setDeviceBlocks] = useState(initialDeviceBlocks);
  const [servicePick, setServicePick] = useState(initialServiceBlocks[0]?.id || "");
  const [devicePick, setDevicePick] = useState(initialDeviceBlocks[0]?.id || "");
  const [mainTab, setMainTab] = useState("new");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [imageDrafts, setImageDrafts] = useState({});
  const [importingItemId, setImportingItemId] = useState("");
  const [attachmentLinkDraft, setAttachmentLinkDraft] = useState("");
  const [blockOpen, setBlockOpen] = useState({});
  const [customers, setCustomers] = useState([]);
  const [offerNumberFormat, setOfferNumberFormat] = useState(defaultOfferFormat);
  const [offerSettingsLoaded, setOfferSettingsLoaded] = useState(false);
  const [previewOfferId, setPreviewOfferId] = useState("");
  const [exportOfferId, setExportOfferId] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendStatus, setSendStatus] = useState("idle");
  const previewRef = useRef(null);
  const exportRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const autosaveTimer = useRef(null);
  const [detailDraft, setDetailDraft] = useState("");

  const activeOffer = offers.find((offer) => offer.id === activeId) || null;
  const previewOffer = offers.find((offer) => offer.id === previewOfferId) || null;
  const exportOffer = offers.find((offer) => offer.id === exportOfferId) || null;

  const persistToStorage = (withStatus) => {
    if (typeof window === "undefined") return;
    const payload = {
      offers: sanitizeOffersForSave(offers),
      activeId,
      serviceBlocks,
      deviceBlocks
    };
    try {
      window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      if (withStatus) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    } catch (error) {
      if (withStatus) {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    }
  };

  useEffect(() => {
    if (!previewRef.current) return;
    const element = previewRef.current;
    const updateScale = () => {
      const width =
        element.clientWidth ||
        element.getBoundingClientRect().width ||
        window.innerWidth ||
        0;
      const a4WidthPx = 210 * 3.7795275591;
      if (!width) {
        setPreviewScale(1);
        return;
      }
      const next = Math.min(1, width / a4WidthPx);
      setPreviewScale(Math.max(0.35, next));
    };
    updateScale();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScale);
      return () => window.removeEventListener("resize", updateScale);
    }
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (Array.isArray(stored?.offers)) {
        setOffers(stored.offers);
      }
      if (stored?.activeId) {
        setActiveId(stored.activeId);
      }
      if (Array.isArray(stored?.serviceBlocks) && stored.serviceBlocks.length) {
        setServiceBlocks(stored.serviceBlocks);
      }
      if (Array.isArray(stored?.deviceBlocks) && stored.deviceBlocks.length) {
        setDeviceBlocks(stored.deviceBlocks);
      }
    } catch (error) {
      // ignore load errors
    }
  }, []);

  useEffect(() => {
    if (offers.length || !offerSettingsLoaded) return;
    const starter = createEmptyOffer(1, offerNumberFormat);
    setOffers([starter]);
    setActiveId(starter.id);
  }, [offers.length, offerNumberFormat, offerSettingsLoaded]);

  useEffect(() => {
    let active = true;
    fetch("/api/customers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        setCustomers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setCustomers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!serviceBlocks.length) return;
    if (serviceBlocks.some((item) => item.id === servicePick)) return;
    setServicePick(serviceBlocks[0]?.id || "");
  }, [serviceBlocks, servicePick]);

  useEffect(() => {
    if (!deviceBlocks.length) return;
    if (deviceBlocks.some((item) => item.id === devicePick)) return;
    setDevicePick(deviceBlocks[0]?.id || "");
  }, [deviceBlocks, devicePick]);

  useEffect(() => {
    setDetailDraft(activeOffer?.detailHtml || "");
  }, [activeOffer?.id]);

  useEffect(() => {
    if (!activeOffer) return;
    if (detailDraft === (activeOffer.detailHtml || "")) return;
    const timer = setTimeout(() => {
      updateOffer(activeOffer.id, (offer) => ({
        ...offer,
        detailHtml: detailDraft
      }));
    }, 400);
    return () => clearTimeout(timer);
  }, [detailDraft, activeOffer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!offers.length) return;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = setTimeout(() => {
      persistToStorage(false);
    }, 700);
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, [offers, activeId, serviceBlocks, deviceBlocks]);

  useEffect(() => {
    if (!exportOfferId) return;
    const offer = offers.find((item) => item.id === exportOfferId);
    if (!offer || !exportRef.current) return;
    const element = exportRef.current;
    const options = {
      margin: 0,
      filename: `${offer.reference || "angebot"}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    };
    html2pdf()
      .set(options)
      .from(element)
      .save()
      .finally(() => {
        setExportOfferId("");
      });
  }, [exportOfferId, offers]);

  useEffect(() => {
    let active = true;
    fetch("/api/offer_settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setOfferNumberFormat(data?.offer_number_format || defaultOfferFormat);
        setOfferSettingsLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setOfferSettingsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const positionCount = useMemo(() => {
    if (!activeOffer) return 0;
    return activeOffer.lineItems.length + activeOffer.deviceItems.length;
  }, [activeOffer]);

  const customerNames = useMemo(
    () =>
      customers
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean),
    [customers]
  );

  const serviceTotal = useMemo(
    () =>
      activeOffer
        ? activeOffer.lineItems.reduce(
            (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
            0
          )
        : 0,
    [activeOffer]
  );

  const deviceTotal = useMemo(
    () =>
      activeOffer
        ? activeOffer.deviceItems.reduce(
            (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
            0
          )
        : 0,
    [activeOffer]
  );

  const totalNet = serviceTotal + deviceTotal;
  const totalVat = calcVat(totalNet, activeOffer);
  const totalGross = totalNet + totalVat;

  const totals = useMemo(() => {
    if (!activeOffer) return { total: 0, count: 0 };
    const count = activeOffer.lineItems.length + activeOffer.deviceItems.length;
    return { total: totalNet, count };
  }, [activeOffer, totalNet]);

  const offerBuckets = useMemo(() => {
    const open = [];
    const accepted = [];
    const declined = [];
    offers.forEach((offer) => {
      if (offer.status === "angenommen") {
        accepted.push(offer);
      } else if (offer.status === "abgelehnt") {
        declined.push(offer);
      } else {
        open.push(offer);
      }
    });
    return { open, accepted, declined };
  }, [offers]);

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

  const removeLineItem = (offerId, itemId) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      lineItems: offer.lineItems.filter((item) => item.id !== itemId)
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

  const normalizeInternalNotes = (item) => {
    if (Array.isArray(item.internalNotes) && item.internalNotes.length) {
      return item.internalNotes;
    }
    if (item.internalNoteType) {
      return [
        {
          id: uid(),
          type: item.internalNoteType,
          text: item.internalNoteText || ""
        }
      ];
    }
    return [];
  };

  const updateLineItemNotes = (offerId, itemId, updater) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      lineItems: offer.lineItems.map((item) => {
        if (item.id !== itemId) return item;
        const nextNotes = updater(normalizeInternalNotes(item));
        return {
          ...item,
          internalNotes: nextNotes,
          internalNoteType: "",
          internalNoteText: ""
        };
      })
    }));
  };

  const updateDeviceItemNotes = (offerId, itemId, updater) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      deviceItems: offer.deviceItems.map((item) => {
        if (item.id !== itemId) return item;
        const nextNotes = updater(normalizeInternalNotes(item));
        return {
          ...item,
          internalNotes: nextNotes,
          internalNoteType: "",
          internalNoteText: ""
        };
      })
    }));
  };

  const removeDeviceItem = (offerId, itemId) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      deviceItems: offer.deviceItems.filter((item) => item.id !== itemId)
    }));
  };

  const removeOffer = (offerId) => {
    setOffers((prev) => {
      const next = prev.filter((offer) => offer.id !== offerId);
      if (offerId === activeId) {
        setActiveId(next[0]?.id || "");
      }
      return next;
    });
  };

  const addAttachmentFiles = (files) => {
    if (!activeOffer) return;
    const list = Array.from(files || []);
    if (!list.length) return;
    updateOffer(activeOffer.id, (offer) => ({
      ...offer,
      attachments: [
        ...(offer.attachments || []),
        ...list.map((file) => ({
          id: uid(),
          title: file.name,
          description: "",
          url: URL.createObjectURL(file),
          fileName: file.name,
          fileType: file.type,
          source: "upload"
        }))
      ]
    }));
  };

  const addAttachmentLink = (rawUrl) => {
    if (!activeOffer) return;
    const trimmed = String(rawUrl || "").trim();
    if (!trimmed) return;
    const safeUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    let fileName = "";
    try {
      const url = new URL(safeUrl);
      fileName = url.pathname.split("/").filter(Boolean).pop() || url.hostname;
    } catch (error) {
      fileName = "Link";
    }
    updateOffer(activeOffer.id, (offer) => ({
      ...offer,
      attachments: [
        ...(offer.attachments || []),
        {
          id: uid(),
          title: "",
          description: "",
          url: safeUrl,
          fileName,
          source: "link"
        }
      ]
    }));
  };

  const updateAttachment = (offerId, attachmentId, patch) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      attachments: (offer.attachments || []).map((item) =>
        item.id === attachmentId ? { ...item, ...patch } : item
      )
    }));
  };

  const removeAttachment = (offerId, attachmentId) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      attachments: (offer.attachments || []).filter((item) => {
        if (item.id !== attachmentId) return true;
        if (item.url && item.url.startsWith("blob:")) {
          URL.revokeObjectURL(item.url);
        }
        return false;
      })
    }));
  };

  const addDeviceImage = (offerId, itemId, url) => {
    if (!url) return;
    updateOffer(offerId, (offer) => ({
      ...offer,
      deviceItems: offer.deviceItems.map((item) => {
        if (item.id !== itemId) return item;
        const images = Array.isArray(item.images) ? item.images : [];
        if (images.includes(url)) return item;
        return { ...item, images: [...images, url] };
      })
    }));
  };

  const removeDeviceImage = (offerId, itemId, url) => {
    updateOffer(offerId, (offer) => ({
      ...offer,
      deviceItems: offer.deviceItems.map((item) => {
        if (item.id !== itemId) return item;
        const images = Array.isArray(item.images) ? item.images : [];
        return { ...item, images: images.filter((entry) => entry !== url) };
      })
    }));
  };

  const importFromReferenceLink = async (item, note) => {
    if (!activeOffer || !note?.text) return;
    const url = note.text;
    setImportingItemId(`${item.id}:${note.id}`);
    let headline = "";
    try {
      const normalized = url.replace(/^https?:\/\//, "");
      const response = await fetch(`https://r.jina.ai/http://${normalized}`);
      if (response.ok) {
        const text = await response.text();
        const line = text.split("\n").find((entry) => entry.trim());
        if (line) headline = line.trim().slice(0, 120);
      }
    } catch (error) {
      // ignore fetch failures
    }
    let fallback = "";
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      fallback = hostname;
    } catch (error) {
      fallback = "";
    }
    const nextTitle = headline || fallback || item.title || "Position";
    updateLineItem(activeOffer.id, item.id, {
      title: item.title || nextTitle,
      aiDraft: item.aiDraft || generateAiText({ ...item, title: nextTitle })
    });
    setImportingItemId("");
  };

  const downloadAttachment = (attachment) => {
    if (!attachment?.url) return;
    const link = document.createElement("a");
    link.href = attachment.url;
    if (attachment.fileName) link.download = attachment.fileName;
    link.rel = "noreferrer";
    link.target = "_blank";
    link.click();
  };

  const toggleDetail = (key) =>
    setDetailOpen((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));

  const toggleBlockOpen = (key) =>
    setBlockOpen((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));

  const addOffer = () => {
    setOffers((prev) => {
      const next = createEmptyOffer(prev.length + 1, offerNumberFormat);
      setActiveId(next.id);
      return [next, ...prev];
    });
  };

  const exportOfferPdf = (offer) => {
    if (!offer) return;
    setExportOfferId(offer.id);
  };

  const sendOfferEmail = async () => {
    if (!activeOffer || !sendTo) return;
    setSendStatus("sending");
    try {
      const res = await fetch("/api/offers/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo,
          subject:
            sendSubject ||
            `Angebot ${activeOffer.reference || ""}`.trim(),
          html: buildOfferEmailHtml(activeOffer),
          text: `Angebot ${activeOffer.reference || ""}`
        })
      });
      if (!res.ok) throw new Error("send_failed");
      setSendStatus("sent");
    } catch (error) {
      setSendStatus("error");
    }
    setTimeout(() => setSendStatus("idle"), 3000);
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

  const addServiceBlock = () => {
    setServiceBlocks((prev) => [
      ...prev,
      {
        id: uid(),
        title: "",
        summary: "",
        type: "Dienstleistung",
        complexity: "mittel",
        securityRelevant: false,
        price: 0,
        quantity: 1,
        unit: "hours",
        researchHours: 0,
        keywords: []
      }
    ]);
  };

  const addDeviceBlock = () => {
    setDeviceBlocks((prev) => [
      ...prev,
      {
        id: uid(),
        title: "",
        manufacturer: "",
        model: "",
        price: 0,
        quantity: 1
      }
    ]);
  };

  const updateServiceBlock = (id, patch) => {
    setServiceBlocks((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateDeviceBlock = (id, patch) => {
    setDeviceBlocks((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeServiceBlock = (id) => {
    setServiceBlocks((prev) => prev.filter((item) => item.id !== id));
  };

  const removeDeviceBlock = (id) => {
    setDeviceBlocks((prev) => prev.filter((item) => item.id !== id));
  };

  const saveLineItemAsBlock = (item) => {
    const summary =
      item.aiDraft?.split("\n").find((line) => line.trim()) ||
      (item.keywords?.length ? item.keywords.join(", ") : "");
    setServiceBlocks((prev) => [
      {
        id: uid(),
        title: item.title || "Service",
        summary,
        type: item.type || "Dienstleistung",
        complexity: item.complexity || "mittel",
        securityRelevant: Boolean(item.securityRelevant),
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        unit: item.unit || "hours",
        researchHours: Number(item.researchHours || 0),
        keywords: item.keywords || []
      },
      ...prev
    ]);
    setActiveTab("blocks");
  };

  const saveDeviceItemAsBlock = (item) => {
    setDeviceBlocks((prev) => [
      {
        id: uid(),
        title: item.model || item.manufacturer || "Geraet",
        manufacturer: item.manufacturer || "",
        model: item.model || "",
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1)
      },
      ...prev
    ]);
    setActiveTab("blocks");
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
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center shadow-soft">
            <Receipt size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Angebote</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMainTab("new")}
            className={`rounded-full px-4 py-1 text-xs uppercase tracking-wide ${
              mainTab === "new"
                ? "bg-sand-900 text-white"
                : "border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            }`}
          >
            Neues Angebot
          </button>
          <button
            type="button"
            onClick={() => setMainTab("status")}
            className={`rounded-full px-4 py-1 text-xs uppercase tracking-wide ${
              mainTab === "status"
                ? "bg-sand-900 text-white"
                : "border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            }`}
          >
            Angebote
          </button>
          <button
            type="button"
            onClick={() => setMainTab("blocks")}
            className={`rounded-full px-4 py-1 text-xs uppercase tracking-wide ${
              mainTab === "blocks"
                ? "bg-sand-900 text-white"
                : "border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            }`}
          >
            Textbausteine
          </button>
        </div>

        {mainTab === "new" ? (
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-3">
            <section className="space-y-4">
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
                <div
                  key={offer.id}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    offer.id === activeId
                      ? "border-sand-900 bg-sand-900 text-white shadow-soft"
                      : "border-sand-200 bg-sand-50 text-sand-700 hover:bg-sand-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(offer.id)}
                    className="w-full text-left"
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
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeOffer(offer.id)}
                      className={`rounded-full border p-1 ${
                        offer.id === activeId
                          ? "border-white/40 text-white hover:bg-white/10"
                          : "border-sand-200 bg-white text-sand-500 hover:bg-sand-100"
                      }`}
                      title="Angebot entfernen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {activeOffer ? (
            <>
              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-4 shadow-soft animate-fade-in">
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
                    <button
                      type="button"
                      onClick={() => persistToStorage(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                    >
                      <Save size={12} /> Speichern
                    </button>
                    {saveStatus === "saved" && (
                      <span className="text-xs text-emerald-600">Gespeichert</span>
                    )}
                    {saveStatus === "error" && (
                      <span className="text-xs text-rose-600">Speichern fehlgeschlagen</span>
                    )}
                    <button
                      type="button"
                      onClick={() => exportOfferPdf(activeOffer)}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                    >
                      <FileDown size={12} /> PDF
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-sand-200 bg-sand-100 p-3">
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
                  <div className="rounded-xl border border-sand-200 bg-sand-100 p-3">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                      Kunde
                    </p>
                    <p className="mt-2 text-sm font-semibold text-sand-900">
                      {activeOffer.customer || "Noch offen"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
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
                        list="offer-customers"
                      />
                    </Field>
                  </div>
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
                  <Field label="MwSt Modus">
                    <select
                      className={inputClass}
                      value={activeOffer.vatMode || "standard"}
                      onChange={(event) =>
                        updateOffer(activeOffer.id, (offer) => ({
                          ...offer,
                          vatMode: event.target.value
                        }))
                      }
                    >
                      {VAT_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="MwSt Satz (%)">
                    <input
                      className={inputClass}
                      type="number"
                      value={activeOffer.vatRate ?? DEFAULT_VAT_RATE}
                      onChange={(event) =>
                        updateOffer(activeOffer.id, (offer) => ({
                          ...offer,
                          vatRate: Number(event.target.value)
                        }))
                      }
                      disabled={activeOffer.vatMode !== "standard"}
                    />
                  </Field>
                  <Field label="Empfaenger E-Mail">
                    <input
                      className={inputClass}
                      value={sendTo}
                      onChange={(event) => setSendTo(event.target.value)}
                      placeholder="kunde@example.com"
                    />
                  </Field>
                  <Field label="Betreff">
                    <input
                      className={inputClass}
                      value={sendSubject}
                      onChange={(event) => setSendSubject(event.target.value)}
                      placeholder={`Angebot ${activeOffer.reference || ""}`}
                    />
                  </Field>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={sendOfferEmail}
                      disabled={!sendTo}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send size={12} /> Senden
                    </button>
                    {sendStatus === "sent" && (
                      <span className="text-xs text-emerald-600">Gesendet</span>
                    )}
                    {sendStatus === "error" && (
                      <span className="text-xs text-rose-600">Versand fehlgeschlagen</span>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-4 shadow-soft animate-fade-in">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                    Dokumentaufbau
                  </p>
                  <h2 className="text-lg font-display text-sand-900">
                    Deckblatt & Abschnitte
                  </h2>
                  <p className="text-sm text-sand-600">
                    Angebot strukturieren und optionale Bereiche pflegen.
                  </p>
                </div>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      id="offer-cover-enabled"
                      type="checkbox"
                      checked={activeOffer.coverEnabled}
                      onChange={(event) =>
                        updateOffer(activeOffer.id, (offer) => ({
                          ...offer,
                          coverEnabled: event.target.checked
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <label htmlFor="offer-cover-enabled" className="text-sm text-sand-700">
                      Deckblatt aktivieren
                    </label>
                  </div>
                  {activeOffer.coverEnabled ? (
                    <div className="space-y-3">
                      <Field label="Deckblatt Titel">
                        <input
                          className={inputClass}
                          value={activeOffer.coverHeadline}
                          onChange={(event) =>
                            updateOffer(activeOffer.id, (offer) => ({
                              ...offer,
                              coverHeadline: event.target.value
                            }))
                          }
                          placeholder="z.B. Angebot IT-Modernisierung"
                        />
                      </Field>
                      <Field label="Kurzintro">
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateOffer(activeOffer.id, (offer) => ({
                                ...offer,
                                coverIntro: generateCoverIntro(offer)
                              }))
                            }
                            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                          >
                            <Sparkles size={12} /> Text
                          </button>
                          <textarea
                            className={noteTextareaClass}
                            value={activeOffer.coverIntro}
                            onChange={(event) =>
                              updateOffer(activeOffer.id, (offer) => ({
                                ...offer,
                                coverIntro: event.target.value
                              }))
                            }
                            placeholder="Einleitung fuer das Deckblatt"
                          />
                        </div>
                      </Field>
                    </div>
                  ) : null}
                  <Field label="Uebersicht">
                    <textarea
                      className={noteTextareaClass}
                      value={activeOffer.overviewText}
                      onChange={(event) =>
                        updateOffer(activeOffer.id, (offer) => ({
                          ...offer,
                          overviewText: event.target.value
                        }))
                      }
                      placeholder="Kurzer Überblick zum Angebot"
                    />
                  </Field>
                  <Field label="Kalkulation (Zusatztext)">
                    <textarea
                      className={noteTextareaClass}
                      value={activeOffer.calculationText}
                      onChange={(event) =>
                        updateOffer(activeOffer.id, (offer) => ({
                          ...offer,
                          calculationText: event.target.value
                        }))
                      }
                      placeholder="Hinweise zur Kalkulation"
                    />
                  </Field>
                </div>
              </section>

              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-4 shadow-soft animate-fade-in">
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
                      {activeOffer.lineItems.length} Leistungspositionen
                    </span>
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      {activeOffer.deviceItems.length} Geraetepositionen
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="bg-white border border-sand-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sand-700">
                          <Plus size={16} />
                          <p className="text-xs uppercase tracking-wide text-sand-600">
                            Neue Position
                          </p>
                        </div>
                        <p className="text-sm text-sand-600">
                          Leistung oder Geraet direkt anlegen.
                        </p>
                        <div className="flex flex-col gap-2">
                          <select
                            value={positionType}
                            onChange={(event) => setPositionType(event.target.value)}
                            className="rounded-full border border-sand-200 px-3 py-2 text-sm bg-white"
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
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                          >
                            <Plus size={12} /> Hinzufuegen
                          </button>
                        </div>
                      </div>

                      <div className="bg-white border border-sand-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2">
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
                          className="rounded-full border border-sand-200 px-3 py-2 text-sm bg-white"
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

                      <div className="bg-white border border-sand-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2">
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
                          className="rounded-full border border-sand-200 px-3 py-2 text-sm bg-white"
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
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-sand-200 bg-sand-100 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                          Leistungspositionen
                        </p>
                        <span className="text-xs text-sand-500">
                          {activeOffer.lineItems.length} Positionen
                        </span>
                      </div>
                      {activeOffer.lineItems.length ? (
                        activeOffer.lineItems.map((item) => {
                          const detailKey = `line-details-${item.id}`;
                          const detailsOpen = !!detailOpen[detailKey];
                          const notes = normalizeInternalNotes(item);
                          return (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-sand-200 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-sand-900">
                                    {item.title || "Unbenannte Position"}
                                  </p>
                                  {ensureDraft(item) ? (
                                    <p className="mt-1 text-xs text-sand-600 whitespace-pre-line">
                                      {ensureDraft(item)}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-xs text-sand-400">
                                      Kein Positionstext hinterlegt.
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-sand-500">
                                  <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-1">
                                    {formatMoney(item.price)} · {formatUnitQuantity(item.quantity, item.unit)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => saveLineItemAsBlock(item)}
                                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                                    title="Als Baustein speichern"
                                  >
                                    <Save size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeLineItem(activeOffer.id, item.id)}
                                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                                    title="Position entfernen"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 space-y-3">
                                  <div className="grid gap-2 md:grid-cols-4">
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
                                    <Field label="Einheit">
                                      <select
                                        className={inputClass}
                                        value={item.unit || "hours"}
                                        onChange={(event) =>
                                          updateLineItem(activeOffer.id, item.id, {
                                            unit: event.target.value
                                          })
                                        }
                                      >
                                        {unitOptions.map((unit) => (
                                          <option key={unit.value} value={unit.value}>
                                            {unit.label}
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
                                    <>
                                      <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                            Interne Vermerke
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateLineItemNotes(activeOffer.id, item.id, (prev) => [
                                                ...prev,
                                                { id: uid(), type: "", text: "" }
                                              ])
                                            }
                                            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                          >
                                            <Plus size={12} /> Vermerk
                                          </button>
                                        </div>
                                        {notes.length ? (
                                          notes.map((note) => (
                                            <div
                                              key={note.id}
                                              className="rounded-xl border border-sand-200 bg-sand-50 p-2"
                                            >
                                              <div className="flex items-center justify-between">
                                                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                                  Vermerk
                                                </p>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    updateLineItemNotes(activeOffer.id, item.id, (prev) =>
                                                      prev.filter((entry) => entry.id !== note.id)
                                                    )
                                                  }
                                                  className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                                                  title="Vermerk entfernen"
                                                >
                                                  <Trash2 size={12} />
                                                </button>
                                              </div>
                                              <div className="mt-2 grid gap-2 md:grid-cols-2">
                                                <Field label="Typ">
                                                  <select
                                                    className={inputClass}
                                                    value={note.type || ""}
                                                    onChange={(event) =>
                                                      updateLineItemNotes(activeOffer.id, item.id, (prev) =>
                                                        prev.map((entry) =>
                                                          entry.id === note.id
                                                            ? {
                                                                ...entry,
                                                                type: event.target.value
                                                              }
                                                            : entry
                                                        )
                                                      )
                                                    }
                                                  >
                                                    {internalNoteOptions.map((option) => (
                                                      <option key={option.value} value={option.value}>
                                                        {option.label}
                                                      </option>
                                                    ))}
                                                  </select>
                                                </Field>
                                                <Field label="Vermerktext">
                                                  {note.type === "bezugslink" ? (
                                                    <div className="space-y-2">
                                                      <input
                                                        className={inputClass}
                                                        value={note.text || ""}
                                                        onChange={(event) =>
                                                          updateLineItemNotes(activeOffer.id, item.id, (prev) =>
                                                            prev.map((entry) =>
                                                              entry.id === note.id
                                                                ? { ...entry, text: event.target.value }
                                                                : entry
                                                            )
                                                          )
                                                        }
                                                        placeholder="https://..."
                                                      />
                                                      <button
                                                        type="button"
                                                        onClick={() => importFromReferenceLink(item, note)}
                                                        disabled={
                                                          !note.text ||
                                                          importingItemId === `${item.id}:${note.id}`
                                                        }
                                                        className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                      >
                                                        <Sparkles size={12} />
                                                        {importingItemId === `${item.id}:${note.id}`
                                                          ? "Import..."
                                                          : "Import"}
                                                      </button>
                                                    </div>
                                                  ) : (
                                                    <textarea
                                                      className={noteTextareaClass}
                                                      value={note.text || ""}
                                                      onChange={(event) =>
                                                        updateLineItemNotes(activeOffer.id, item.id, (prev) =>
                                                          prev.map((entry) =>
                                                            entry.id === note.id
                                                              ? { ...entry, text: event.target.value }
                                                              : entry
                                                          )
                                                        )
                                                      }
                                                      placeholder="Interner Vermerk"
                                                    />
                                                  )}
                                                </Field>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-2 text-xs text-sand-500">
                                            Noch keine Vermerke.
                                          </div>
                                        )}
                                      </div>
                                      <div className="mt-3">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                            Positionstext
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              updateLineItem(activeOffer.id, item.id, {
                                                aiDraft: generateAiText(item)
                                              })
                                            }
                                            className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                          >
                                            <Sparkles size={12} /> Text
                                          </button>
                                        </div>
                                        <textarea
                                          className={noteTextareaClass}
                                          value={item.aiDraft || ""}
                                          onChange={(event) =>
                                            updateLineItem(activeOffer.id, item.id, {
                                              aiDraft: event.target.value
                                            })
                                          }
                                          placeholder="Optionaler Positionstext fuer die Vorschau"
                                        />
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-4 text-sm text-sand-500">
                          Noch keine Leistungspositionen ausgewaehlt.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-sand-200 bg-sand-100 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                          Geraeteprofile
                        </p>
                        <span className="text-xs text-sand-500">
                          {activeOffer.deviceItems.length} Positionen
                        </span>
                      </div>
                      {activeOffer.deviceItems.length ? (
                        activeOffer.deviceItems.map((item) => {
                          const detailKey = `device-${item.id}`;
                          const showDetails = !!detailOpen[detailKey];
                          const notes = normalizeInternalNotes(item);
                          return (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-sand-200 bg-white p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                    Geraeteprofil
                                  </p>
                                  <p className="text-sm font-semibold text-sand-900">
                                    {item.manufacturer || "Hersteller"} · {item.model || "Modell"}
                                  </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-sand-500">
                                    {formatLineTotal(item.price, item.quantity)} · {item.quantity}x
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => saveDeviceItemAsBlock(item)}
                                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                                    title="Als Baustein speichern"
                                  >
                                    <Save size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeDeviceItem(activeOffer.id, item.id)}
                                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                                    title="Position entfernen"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleDetail(detailKey)}
                                    className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                  >
                                    {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    Bearbeiten
                                  </button>
                                </div>
                              </div>

                              {showDetails ? (
                                <>
                                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <Field label="Preis">
                                      <input
                                        className={inputClass}
                                        type="number"
                                        value={item.price}
                                        onChange={(event) =>
                                          updateDeviceItem(activeOffer.id, item.id, {
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
                                          updateDeviceItem(activeOffer.id, item.id, {
                                            quantity: Number(event.target.value)
                                          })
                                        }
                                      />
                                    </Field>
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
                                    <Field label="Modell">
                                      <input
                                        className={inputClass}
                                        value={item.model}
                                        onChange={(event) =>
                                          updateDeviceItem(activeOffer.id, item.id, {
                                            model: event.target.value
                                          })
                                        }
                                        placeholder="Modell"
                                      />
                                    </Field>
                                  </div>
                                  <div className="mt-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                        Interne Vermerke
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateDeviceItemNotes(activeOffer.id, item.id, (prev) => [
                                            ...prev,
                                            { id: uid(), type: "", text: "" }
                                          ])
                                        }
                                        className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                      >
                                        <Plus size={12} /> Vermerk
                                      </button>
                                    </div>
                                    {notes.length ? (
                                      notes.map((note) => (
                                        <div
                                          key={note.id}
                                          className="rounded-xl border border-sand-200 bg-sand-50 p-2"
                                        >
                                          <div className="flex items-center justify-between">
                                            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                              Vermerk
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                updateDeviceItemNotes(activeOffer.id, item.id, (prev) =>
                                                  prev.filter((entry) => entry.id !== note.id)
                                                )
                                              }
                                              className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                                              title="Vermerk entfernen"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                                            <Field label="Typ">
                                              <select
                                                className={inputClass}
                                                value={note.type || ""}
                                                onChange={(event) =>
                                                  updateDeviceItemNotes(activeOffer.id, item.id, (prev) =>
                                                    prev.map((entry) =>
                                                      entry.id === note.id
                                                        ? { ...entry, type: event.target.value }
                                                        : entry
                                                    )
                                                  )
                                                }
                                              >
                                                {internalNoteOptions.map((option) => (
                                                  <option key={option.value} value={option.value}>
                                                    {option.label}
                                                  </option>
                                                ))}
                                              </select>
                                            </Field>
                                            <Field label="Vermerktext">
                                              {note.type === "bezugslink" ? (
                                                <input
                                                  className={inputClass}
                                                  value={note.text || ""}
                                                  onChange={(event) =>
                                                    updateDeviceItemNotes(activeOffer.id, item.id, (prev) =>
                                                      prev.map((entry) =>
                                                        entry.id === note.id
                                                          ? { ...entry, text: event.target.value }
                                                          : entry
                                                      )
                                                    )
                                                  }
                                                  placeholder="https://..."
                                                />
                                              ) : (
                                                <textarea
                                                  className={noteTextareaClass}
                                                  value={note.text || ""}
                                                  onChange={(event) =>
                                                    updateDeviceItemNotes(activeOffer.id, item.id, (prev) =>
                                                      prev.map((entry) =>
                                                        entry.id === note.id
                                                          ? { ...entry, text: event.target.value }
                                                          : entry
                                                      )
                                                    )
                                                  }
                                                  placeholder="Interner Vermerk"
                                                />
                                              )}
                                            </Field>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-2 text-xs text-sand-500">
                                        Noch keine Vermerke.
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-3">
                                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                        Produktbilder
                                      </p>
                                      <div
                                        className="mt-2 rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-3 text-xs text-sand-600"
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={(event) => {
                                          event.preventDefault();
                                          const url = extractDropUrl(event);
                                          addDeviceImage(activeOffer.id, item.id, url);
                                        }}
                                      >
                                        Bild-URL einfuegen oder per Drag & Drop aus dem Browser.
                                      </div>
                                      <div className="mt-2 flex items-center gap-2">
                                        <input
                                          className={inputClass}
                                          value={imageDrafts[item.id] || ""}
                                          onChange={(event) =>
                                            setImageDrafts((prev) => ({
                                              ...prev,
                                              [item.id]: event.target.value
                                            }))
                                          }
                                          onKeyDown={(event) => {
                                            if (event.key !== "Enter") return;
                                            event.preventDefault();
                                            const url = imageDrafts[item.id];
                                            addDeviceImage(activeOffer.id, item.id, url);
                                            setImageDrafts((prev) => ({
                                              ...prev,
                                              [item.id]: ""
                                            }));
                                          }}
                                          placeholder="https://bild.png"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const url = imageDrafts[item.id];
                                            addDeviceImage(activeOffer.id, item.id, url);
                                            setImageDrafts((prev) => ({
                                              ...prev,
                                              [item.id]: ""
                                            }));
                                          }}
                                          className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                                        >
                                          <Image size={12} /> Hinzufuegen
                                        </button>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {(item.images || []).map((url) => (
                                          <div
                                            key={url}
                                            className="relative w-24 rounded-xl border border-sand-200 bg-white p-2"
                                          >
                                            <img
                                              src={url}
                                              alt="Produkt"
                                              className="h-16 w-full rounded-lg object-cover"
                                            />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeDeviceImage(activeOffer.id, item.id, url)
                                              }
                                              className="absolute -right-2 -top-2 rounded-full border border-sand-200 bg-white p-1 text-sand-500 shadow"
                                              title="Entfernen"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        ))}
                                        {item.images?.length ? null : (
                                          <div className="text-xs text-sand-500">
                                            Noch keine Bilder hinzugefuegt.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                </>
                              ) : null}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-4 text-sm text-sand-500">
                          Keine Geraetepositionen hinterlegt.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-4 shadow-soft animate-fade-in">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                      Angebotsdetail
                    </p>
                    <h2 className="text-lg font-display text-sand-900">
                      Ablauf & Erläuterung
                    </h2>
                    <p className="text-sm text-sand-600">
                      Optionaler Text, z.B. Projektablauf oder Detailbeschreibung.
                    </p>
                  </div>
                </div>
                <textarea
                  className="mt-3 min-h-[160px] rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-[13px] text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                  value={detailDraft}
                  onChange={(event) => setDetailDraft(event.target.value)}
                  placeholder="Projektablauf, Hintergrund, Vorgehen..."
                />
                {!detailDraft ? (
                  <p className="mt-2 text-xs text-sand-500">
                    Formatierter Text aus Word/anderen Tools kann hier eingefügt werden.
                  </p>
                ) : null}
              </section>

              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-4 shadow-soft animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                      Beilagen
                    </p>
                    <p className="text-sm text-sand-600">
                      Dokumente und Bilder zum Angebot.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100 cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(event) => {
                          addAttachmentFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                      <Plus size={12} /> Upload
                    </label>
                    <div className="flex items-center gap-2 rounded-full border border-sand-200 bg-white px-2 py-1">
                      <input
                        className="w-40 bg-transparent text-xs text-sand-700 placeholder:text-sand-400 focus:outline-none"
                        value={attachmentLinkDraft}
                        onChange={(event) => setAttachmentLinkDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          addAttachmentLink(attachmentLinkDraft);
                          setAttachmentLinkDraft("");
                        }}
                        placeholder="https://link"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addAttachmentLink(attachmentLinkDraft);
                          setAttachmentLinkDraft("");
                        }}
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-sand-600 hover:text-sand-800"
                      >
                        <Link size={12} /> Link
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {(activeOffer.attachments || []).length ? (
                    activeOffer.attachments.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-sand-200 bg-white p-2"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                            Beilage
                          </p>
                          <button
                            type="button"
                            onClick={() => removeAttachment(activeOffer.id, item.id)}
                            className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                            title="Entfernen"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-3">
                          <Field label="Titel">
                            <input
                              className={inputClass}
                              value={item.title || ""}
                              onChange={(event) =>
                                updateAttachment(activeOffer.id, item.id, {
                                  title: event.target.value
                                })
                              }
                              placeholder="z.B. Leistungsblatt"
                            />
                          </Field>
                          <Field label="Beschreibung">
                            <textarea
                              className={noteTextareaClass}
                              value={item.description || ""}
                              onChange={(event) =>
                                updateAttachment(activeOffer.id, item.id, {
                                  description: event.target.value
                                })
                              }
                              placeholder="Kurztext zur Beilage"
                            />
                          </Field>
                          <Field label="Datei">
                            <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-2 text-xs text-sand-600 flex items-center justify-between gap-2">
                              <span className="truncate">{item.fileName || "Datei"}</span>
                              {item.url ? (
                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(item)}
                                  className="rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                >
                                  Download
                                </button>
                              ) : null}
                            </div>
                          </Field>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-2 text-xs text-sand-500">
                      Noch keine Beilagen hinterlegt.
                    </div>
                  )}
                </div>
              </section>


              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-4 shadow-soft animate-fade-in">
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
                  <button
                    type="button"
                    onClick={handleSevDesk}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90"
                  >
                    Rechnungsentwurf in sevDesk erzeugen
                  </button>
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
            <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft text-sm text-sand-500">
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
                <h3 className="text-lg font-display text-sand-900">PDF Layout</h3>
              </div>
              {activeOffer ? (
                <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600">
                  {activeOffer.status}
                </span>
              ) : null}
            </div>
            <OfferPreview offer={activeOffer} scale={previewScale} containerRef={previewRef} />
          </section>
        </aside>
      </div>
    ) : mainTab === "status" ? (
      <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
              Angebotsstatus
            </p>
            <h2 className="text-lg font-display text-sand-900">
              Offene & abgeschlossene Angebote
            </h2>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
              Offen
            </p>
            <div className="mt-3 space-y-2">
              {offerBuckets.open.length ? (
                offerBuckets.open.map((offer) => (
                  <div
                    key={offer.id}
                    className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-left text-xs text-sand-700 flex items-center justify-between"
                  >
                    <button type="button" onClick={() => setActiveId(offer.id)} className="flex-1 text-left">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                        {offer.reference}
                      </p>
                      <p className="text-sm font-semibold">
                        {offer.customer || "Neues Angebot"}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewOfferId(offer.id)}
                        className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                        title="Vorschau"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportOfferPdf(offer)}
                        className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                        title="PDF exportieren"
                      >
                        <FileDown size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-sand-500">Keine offenen Angebote.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-600">
              Akzeptiert
            </p>
            <div className="mt-3 space-y-2">
              {offerBuckets.accepted.length ? (
                offerBuckets.accepted.map((offer) => (
                  <div
                    key={offer.id}
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left text-xs text-sand-700 flex items-center justify-between"
                  >
                    <button type="button" onClick={() => setActiveId(offer.id)} className="flex-1 text-left">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400">
                        {offer.reference}
                      </p>
                      <p className="text-sm font-semibold">
                        {offer.customer || "Angebot"}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewOfferId(offer.id)}
                        className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-500 hover:bg-emerald-50"
                        title="Vorschau"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportOfferPdf(offer)}
                        className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-500 hover:bg-emerald-50"
                        title="PDF exportieren"
                      >
                        <FileDown size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-emerald-600">
                  Keine akzeptierten Angebote.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-rose-500">
              Abgelehnt / Abgelaufen
            </p>
            <div className="mt-3 space-y-2">
              {offerBuckets.declined.length ? (
                offerBuckets.declined.map((offer) => (
                  <div
                    key={offer.id}
                    className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-left text-xs text-sand-700 flex items-center justify-between"
                  >
                    <button type="button" onClick={() => setActiveId(offer.id)} className="flex-1 text-left">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-rose-400">
                        {offer.reference}
                      </p>
                      <p className="text-sm font-semibold">
                        {offer.customer || "Angebot"}
                      </p>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewOfferId(offer.id)}
                        className="rounded-full border border-rose-200 bg-white p-1 text-rose-500 hover:bg-rose-50"
                        title="Vorschau"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => exportOfferPdf(offer)}
                        className="rounded-full border border-rose-200 bg-white p-1 text-rose-500 hover:bg-rose-50"
                        title="PDF exportieren"
                      >
                        <FileDown size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-rose-500">
                  Keine abgelehnten Angebote.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    ) : (
      <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
              Textbausteine
            </p>
            <h2 className="text-lg font-display text-sand-900">
              Service & Geraete pflegen
            </h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-sand-200 bg-sand-100 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Servicebausteine
              </p>
              <button
                type="button"
                onClick={addServiceBlock}
                className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
              >
                <Plus size={12} /> Neu
              </button>
            </div>
            {serviceBlocks.length ? (
              serviceBlocks.map((block) => {
                const key = `service-${block.id}`;
                const isOpen = !!blockOpen[key];
                return (
                  <div
                    key={block.id}
                    className="rounded-2xl border border-sand-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-sand-900">
                          {block.title || "Servicebaustein"}
                        </p>
                        <p className="mt-1 text-xs text-sand-500">
                          {formatMoney(block.price || 0)} ·{" "}
                          {formatUnitQuantity(block.quantity || 1, block.unit)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleBlockOpen(key)}
                          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                        >
                          {isOpen ? "Schliessen" : "Bearbeiten"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeServiceBlock(block.id)}
                          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                          title="Entfernen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {isOpen ? (
                      <div className="mt-3 space-y-2">
                        <div className="grid gap-2 md:grid-cols-4">
                          <Field label="Titel">
                            <input
                              className={inputClass}
                              value={block.title || ""}
                              onChange={(event) =>
                                updateServiceBlock(block.id, { title: event.target.value })
                              }
                              placeholder="Titel"
                            />
                          </Field>
                          <Field label="Preis">
                            <input
                              className={inputClass}
                              type="number"
                              value={block.price || 0}
                              onChange={(event) =>
                                updateServiceBlock(block.id, {
                                  price: Number(event.target.value)
                                })
                              }
                            />
                          </Field>
                          <Field label="Menge">
                            <input
                              className={inputClass}
                              type="number"
                              value={block.quantity || 1}
                              onChange={(event) =>
                                updateServiceBlock(block.id, {
                                  quantity: Number(event.target.value)
                                })
                              }
                            />
                          </Field>
                          <Field label="Einheit">
                            <select
                              className={inputClass}
                              value={block.unit || "hours"}
                              onChange={(event) =>
                                updateServiceBlock(block.id, {
                                  unit: event.target.value
                                })
                              }
                            >
                              {unitOptions.map((unit) => (
                                <option key={unit.value} value={unit.value}>
                                  {unit.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-2 md:grid-cols-3">
                          <Field label="Komplexitaet">
                            <select
                              className={inputClass}
                              value={block.complexity || "mittel"}
                              onChange={(event) =>
                                updateServiceBlock(block.id, {
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
                          <Field label="Stichworte">
                            <input
                              className={inputClass}
                              value={(block.keywords || []).join(", ")}
                              onChange={(event) =>
                                updateServiceBlock(block.id, {
                                  keywords: event.target.value
                                    .split(",")
                                    .map((entry) => entry.trim())
                                    .filter(Boolean)
                                })
                              }
                              placeholder="z.B. MFA, Logging"
                            />
                          </Field>
                          <div className="flex items-center gap-3 pt-6">
                            <input
                              id={`block-security-${block.id}`}
                              type="checkbox"
                              checked={Boolean(block.securityRelevant)}
                              onChange={(event) =>
                                updateServiceBlock(block.id, {
                                  securityRelevant: event.target.checked
                                })
                              }
                              className="h-4 w-4"
                            />
                            <label
                              htmlFor={`block-security-${block.id}`}
                              className="text-sm text-sand-700"
                            >
                              Sicherheit
                            </label>
                          </div>
                        </div>
                        <Field label="Kurzbeschreibung">
                          <textarea
                            className={noteTextareaClass}
                            value={block.summary || ""}
                            onChange={(event) =>
                              updateServiceBlock(block.id, {
                                summary: event.target.value
                              })
                            }
                            placeholder="Kurztext"
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-3 text-xs text-sand-500">
                Noch keine Servicebausteine hinterlegt.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sand-200 bg-sand-100 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Geraetebausteine
              </p>
              <button
                type="button"
                onClick={addDeviceBlock}
                className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
              >
                <Plus size={12} /> Neu
              </button>
            </div>
            {deviceBlocks.length ? (
              deviceBlocks.map((block) => {
                const key = `device-${block.id}`;
                const isOpen = !!blockOpen[key];
                return (
                  <div
                    key={block.id}
                    className="rounded-2xl border border-sand-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-sand-900">
                          {block.title || "Geraetebaustein"}
                        </p>
                        <p className="mt-1 text-xs text-sand-500">
                          {block.manufacturer || "Hersteller"} · {block.model || "Modell"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleBlockOpen(key)}
                          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                        >
                          {isOpen ? "Schliessen" : "Bearbeiten"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDeviceBlock(block.id)}
                          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                          title="Entfernen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {isOpen ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        <Field label="Titel">
                          <input
                            className={inputClass}
                            value={block.title || ""}
                            onChange={(event) =>
                              updateDeviceBlock(block.id, { title: event.target.value })
                            }
                            placeholder="Titel"
                          />
                        </Field>
                        <Field label="Hersteller">
                          <input
                            className={inputClass}
                            value={block.manufacturer || ""}
                            onChange={(event) =>
                              updateDeviceBlock(block.id, {
                                manufacturer: event.target.value
                              })
                            }
                            placeholder="Hersteller"
                          />
                        </Field>
                        <Field label="Modell">
                          <input
                            className={inputClass}
                            value={block.model || ""}
                            onChange={(event) =>
                              updateDeviceBlock(block.id, { model: event.target.value })
                            }
                            placeholder="Modell"
                          />
                        </Field>
                        <Field label="Preis">
                          <input
                            className={inputClass}
                            type="number"
                            value={block.price || 0}
                            onChange={(event) =>
                              updateDeviceBlock(block.id, {
                                price: Number(event.target.value)
                              })
                            }
                          />
                        </Field>
                        <Field label="Menge">
                          <input
                            className={inputClass}
                            type="number"
                            value={block.quantity || 1}
                            onChange={(event) =>
                              updateDeviceBlock(block.id, {
                                quantity: Number(event.target.value)
                              })
                            }
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-3 text-xs text-sand-500">
                Noch keine Geraetebausteine hinterlegt.
              </div>
            )}
          </div>
        </div>
      </section>
    )}
    {previewOffer ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                Vorschau
              </p>
              <h3 className="text-lg font-display text-sand-900">
                {previewOffer.customer || "Angebot"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportOfferPdf(previewOffer)}
                className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
              >
                <FileDown size={12} /> PDF
              </button>
              <button
                type="button"
                onClick={() => setPreviewOfferId("")}
                className="rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                title="Schliessen"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <OfferPreview offer={previewOffer} scale={0.9} />
        </div>
      </div>
    ) : null}
    {exportOffer ? (
      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        <OfferPreview offer={exportOffer} scale={1} containerRef={exportRef} />
      </div>
    ) : null}
  </main>
      <datalist id="offer-customers">
        {customerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
