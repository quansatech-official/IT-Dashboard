import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileDown,
  Image,
  Link,
  Plus,
  Copy,
  Pencil,
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
const selectClass = `${inputClass} appearance-none pr-10 bg-[url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"%234B5563\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 7l5 5 5-5\"/></svg>')] bg-no-repeat bg-[right_0.9rem_center] bg-[length:18px]`;
const priceInputClass = `${inputClass} pr-8 appearance-none [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const quantityInputClass = `${inputClass} appearance-none [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

const statusOptions = ["Entwurf", "gesendet", "angenommen", "abgelehnt"];
const complexityOptions = ["niedrig", "mittel", "hoch"];
const positionTypes = [
  { value: "Dienstleistung", label: "Leistung" },
  { value: "Gerät", label: "Material" },
  { value: "Sonstiges", label: "Sonstiges" }
];
const unitOptions = [
  { value: "hours", label: "Stunden" },
  { value: "flat", label: "Pauschal" },
  { value: "piece", label: "Stück" },
  { value: "day", label: "Tag" }
];

const initialServiceBlocks = [
  {
    id: "block-secure",
    title: "Sicherheits-Härtung",
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

const initialCalcBlocks = [
  {
    id: "calc-terms",
    title: "Gültigkeit & Zahlung",
    text:
      "Das Angebot ist 14 Tage gültig.\n" +
      "Zahlungsmodalität: 50% bei Auftragserteilung, Rest nach Projektabschluss/Lieferung."
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

const getDeviceProduct = (item) =>
  item.product ||
  [item.manufacturer, item.model].filter(Boolean).join(" · ") ||
  "Material";

const formatDeviceTitle = (item) => getDeviceProduct(item);

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

const fetchPagePreview = async (url) => {
  if (!url) return { headline: "", snippet: "", hostname: "" };
  const normalized = String(url || "").replace(/^https?:\/\//, "");
  let headline = "";
  let snippet = "";
  try {
    const response = await fetch(`https://r.jina.ai/http://${normalized}`);
    if (response.ok) {
      const lines = (await response.text())
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length) {
        headline = lines[0].slice(0, 120);
      }
      if (lines.length > 1) {
        snippet = lines.slice(1, 4).join(" ").slice(0, 300);
      }
    }
  } catch (error) {
    // ignore fetch failures
  }
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    hostname = "";
  }
  return { headline, snippet, hostname };
};

const generateAiText = (item) => {
  const title = item.title || "die Leistung";
  const keywords = Array.isArray(item.keywords) ? item.keywords.filter(Boolean) : [];
  const scopeLine = keywords.length
    ? `Leistungsumfang: ${keywords.join(", ")}.`
    : "Leistungsumfang wird gemeinsam abgestimmt und dokumentiert.";
  const approachLine =
    "Vorgehen: Aufnahme der Ausgangslage, zielgerichtete Umsetzung, Funktionscheck.";
  const outcomeLine =
    "Ergebnis: Umsetzung inkl. kurzer Dokumentation und Übergabe der wichtigsten Punkte.";
  const securityLine = item.securityRelevant
    ? "Sicherheitsrelevante Aspekte setzen wir nach Best Practices um."
    : "";

  return [
    `Wir setzen ${title} klar strukturiert und nachvollziehbar um.`,
    scopeLine,
    approachLine,
    outcomeLine,
    securityLine
  ]
    .filter(Boolean)
    .join("\n");
};

const generateDeviceDescription = (item) => {
  const title = formatDeviceTitle(item);
  return [
    "Kurzbeschreibung: Funktionsumfang, technische Eckdaten und Lieferumfang.",
    "Integration: Einbindung in die bestehende Umgebung sowie Inbetriebnahme-Hinweise.",
    "Hinweis: Garantie- und Supportbedingungen nach Herstellerangaben."
  ]
    .filter(Boolean)
    .join("\n");
};

const buildOfferContext = (offer) => {
  if (!offer) return "n/a";
  const customer = offer.customer || "Kunde offen";
  const reference = offer.reference || "";
  const positions = [...(offer.lineItems || []), ...(offer.deviceItems || [])]
    .map((item) => item.title || formatDeviceTitle(item))
    .filter(Boolean)
    .slice(0, 6);
  const list = positions.length ? positions.map((title) => `- ${title}`).join("\n") : "n/a";
  return `Kunde: ${customer}\nReferenz: ${reference}\nPositionen:\n${list}`;
};

const buildLineItemContext = (offer, item) => {
  const customer = offer?.customer || "Kunde offen";
  const title = item?.title || "Leistung";
  const keywords = Array.isArray(item?.keywords) ? item.keywords.filter(Boolean) : [];
  const unitLine = formatUnitQuantity(item?.quantity || 1, item?.unit);
  return [
    `Kunde: ${customer}`,
    `Position: ${title}`,
    `Menge/Einheit: ${unitLine}`,
    keywords.length ? `Stichworte: ${keywords.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
};

const buildDeviceContext = (offer, item) => {
  const customer = offer?.customer || "Kunde offen";
  const product = getDeviceProduct(item) || "Material";
  const unitLine = `${Number(item?.quantity || 1)} Stk`;
  return [
    `Kunde: ${customer}`,
    `Produkt: ${product}`,
    `Menge: ${unitLine}`
  ]
    .filter(Boolean)
    .join("\n");
};

const requestOfferAiText = async ({ mode, currentText, context, fallback }) => {
  try {
    const res = await fetch("/api/offer_ai_text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        current_text: currentText || "",
        context: context || ""
      })
    });
    if (!res.ok) throw new Error("ai_failed");
    const data = await res.json();
    const text = String(data?.text || "").trim();
    if (text) return text;
  } catch (error) {
    // fall through to fallback
  }
  return typeof fallback === "function" ? fallback() : "";
};

const splitSenderLines = (value) =>
  String(value || "")
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

const generateCoverIntro = (offer) => {
  const customer = offer.customer || "Ihrem Team";
  const positionTexts = [...(offer.lineItems || []), ...(offer.deviceItems || [])]
    .map((item) => ensureDraft(item).trim())
    .filter(Boolean);
  if (!positionTexts.length) {
    return `Im folgenden Angebot bündeln wir die wichtigsten Leistungen für ${customer} und geben einen kompakten Überblick zu Umfang und Kosten.`;
  }
  const excerpts = positionTexts.slice(0, 2).map((text) => `- ${text}`);
  return `Im folgenden Angebot bündeln wir die wichtigsten Leistungen für ${customer} und geben einen kompakten Überblick zu Umfang und Kosten.\n\nAuszug:\n${excerpts.join("\n")}`;
};

const generateOverviewText = (offer) => {
  const customer = offer.customer || "Ihrem Team";
  const titles = [...(offer.lineItems || []), ...(offer.deviceItems || [])]
    .map((item) => item.title || formatDeviceTitle(item))
    .filter(Boolean);
  if (!titles.length) {
    return `Überblick für ${customer}: Leistungsumfang, Ziele und erwartete Ergebnisse werden im Angebot zusammengefasst.`;
  }
  const shortlist = titles.slice(0, 3).map((title) => `- ${title}`);
  return `Überblick für ${customer}: Die wichtigsten Leistungen und Materialien im Angebot.\n\n${shortlist.join("\n")}`;
};

const generateCalculationText = (offer) => {
  const total = (offer.lineItems || []).length + (offer.deviceItems || []).length;
  if (!total) {
    return "Hinweis zur Kalkulation: Preise verstehen sich netto pro Position, zzgl. gesetzlicher Umsatzsteuer.";
  }
  return "Hinweis zur Kalkulation: Alle Preise sind netto pro Position angegeben. Mengen und Einheiten sind im Kalkulationsblatt ausgewiesen; die Umsatzsteuer wird gesondert ausgewiesen.";
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

const buildItemTitle = (item) =>
  item.title ||
  (item.product || item.manufacturer || item.model
    ? getDeviceProduct(item)
    : "Position");

const buildItemText = (item) =>
  (item.aiDraft || getActiveVersion(item)?.text || item.description || "").trim();

const buildItemUnit = (item, fallback) => item.unit || fallback;

const buildSevDeskPayload = (offer) => ({
  offer_reference: offer.reference,
  items: [...offer.lineItems, ...offer.deviceItems].map((item) => {
    const isDevice = Boolean(item.manufacturer || item.model || item.product);
    const unit = buildItemUnit(item, isDevice ? "piece" : "hours");
    return {
      title: buildItemTitle(item),
      quantity: Number(item.quantity || 1),
      unit,
      unit_label: formatUnitLabel(unit),
      position_text: buildItemText(item),
      price: Number(item.price || 0)
    };
  })
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
  product:
    block.product ||
    [block.manufacturer, block.model].filter(Boolean).join(" · "),
  manufacturer: block.manufacturer || "",
  model: block.model || block.modelFamily || "",
  description: block.description || "",
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
  senderLine: "Quansatech GmbH - Steyrtalstraße 88 - 4523 Neuzeug",
  recipientName: "",
  recipientCompany: "",
  recipientStreet: "",
  recipientPostalCity: "",
  recipientCountry: "Österreich",
  customerNumber: "",
  orderNumber: "",
  salutation: "Sehr geehrte Damen und Herren,",
  introText:
    "vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen das gewünschte freibleibende Angebot:",
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
  deviceItems: [],
  serverId: null,
  confirmGuid: "",
  trackingGuid: ""
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

const sanitizeOfferForSave = (offer) => sanitizeOffersForSave([offer])[0];

const normalizeServerOffer = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  const next = { ...payload };
  if (!next.id) {
    next.id = uid();
  }
  if (!next.serverId) {
    next.serverId = payload.serverId ?? payload.id ?? null;
  }
  if (!next.status) {
    next.status = "Entwurf";
  }
  return next;
};

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
    text: item.description || "",
    images: item.images || [],
    category: "device"
  }));
  return [...linePositions, ...devicePositions];
};

const buildOfferEmailHtml = (offer, confirmUrl, mode = "offer") => {
  const positions = buildPreviewPositions(offer);
  const headline =
    mode === "confirmation" ? "Ihre Auftragsbestätigung" : "Ihr Angebot";
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
  const confirmBlock = confirmUrl
    ? `
      <div style="margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
        <p style="margin:0 0 12px;">Bitte bestätigen Sie das Angebot:</p>
        <a href="${confirmUrl}" style="display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;text-decoration:none;border-radius:999px;font-size:12px;text-transform:uppercase;letter-spacing:0.2em;">
          Angebot bestätigen
        </a>
      </div>
    `
    : "";
  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937">
      <h2>${headline} ${offer.reference || ""}</h2>
      <p>Kunde: ${offer.customer || "Kunde offen"}</p>
      ${offer.overviewText ? `<p>${offer.overviewText.replace(/\n/g, "<br/>")}</p>` : ""}
      ${confirmBlock}
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Pos</th>
            <th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;">Überschrift</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">Menge</th>
            <th style="text-align:right;padding:6px 8px;border-bottom:1px solid #ddd;">Netto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

function OfferPreview({ offer, scale = 1, containerRef, mode = "offer" }) {
  if (!offer) {
    return (
      <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-4 text-sm text-sand-500">
        Kein Angebot ausgewählt.
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
  const recipientName = offer.recipientName || offer.customer || "Kunde offen";
  const recipientCompany = (offer.recipientCompany || "").trim();
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
              <img src="/QTLogo.jpg" alt="QT" className="h-28 w-auto mb-8" />
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
              Es gelten die AGB auf unserer Homepage: https://www.quansatech.at
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
              <img src="/QTLogo.jpg" alt="QT" className="h-8 w-auto" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                Angebot
              </span>
            </div>
            <span className="text-xs text-sand-500">{offer.reference}</span>
          </div>
          <div className="mt-4 flex-1 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 text-xs text-sand-600">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Absender
                </p>
                {splitSenderLines(
                  offer.senderLine || "Quansatech GmbH - Steyrtalstraße 88 - 4523 Neuzeug"
                ).map((line) => (
                  <p key={line} className="mt-1 text-sm font-semibold text-sand-900">
                    {line}
                  </p>
                ))}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Empfänger
                </p>
                <p className="mt-1 text-sm font-semibold text-sand-900">
                  {recipientName}
                </p>
                {recipientCompany && recipientCompany !== recipientName.trim() ? (
                  <p>{recipientCompany}</p>
                ) : null}
                {offer.recipientStreet ? <p>{offer.recipientStreet}</p> : null}
                {offer.recipientPostalCity ? <p>{offer.recipientPostalCity}</p> : null}
                {offer.recipientCountry ? <p>{offer.recipientCountry}</p> : null}
                {offer.customerNumber ? <p>Kundennummer {offer.customerNumber}</p> : null}
                <p>Angebots-Nr. {offer.orderNumber || offer.reference || "-"}</p>
                <p>Datum: {formatDate(offer.createdAt) || "-"}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-sand-700">
              <p className="text-base font-semibold text-sand-900">
                {mode === "confirmation" ? "Auftragsbestätigung" : "Angebot"}{" "}
                {offer.reference || "-"}
              </p>
              <p>{offer.salutation || "Sehr geehrte Damen und Herren,"}</p>
              <p>{offer.introText || "Vielen Dank für Ihre Anfrage."}</p>
            </div>

            {offer.overviewText ? (
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                  Übersicht
                </p>
                <p className="mt-2 text-sm text-sand-700 whitespace-pre-line">
                  {offer.overviewText}
                </p>
              </div>
            ) : null}

            {previewPositions.length ? (
              <div>
                <div className="mt-2 rounded-xl border border-sand-200">
                  <div className="grid grid-cols-[0.2fr_1.2fr_0.4fr_0.5fr_0.5fr] gap-2 border-b border-sand-200 bg-sand-50 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-sand-400">
                    <span>Pos</span>
                    <span>Leistung</span>
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
                              <div>
                                <p className="font-semibold text-sand-800">{item.title}</p>
                                {item.text ? (
                                  <p className="mt-1 text-xs text-sand-500 whitespace-pre-line">
                                    {item.text}
                                  </p>
                                ) : null}
                              </div>
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
                        Material
                      </div>
                      {previewPositions
                        .filter((item) => item.category === "device")
                        .map((item, index) => (
                          <div key={item.id} className="border-b border-sand-100">
                            <div className="grid grid-cols-[0.2fr_1.2fr_0.4fr_0.5fr_0.5fr] gap-2 px-3 py-2 text-xs text-sand-700">
                              <span>Pos. {index + 1 + offer.lineItems.length}</span>
                              <div>
                                <p className="font-semibold text-sand-800">{item.title}</p>
                                {item.text ? (
                                  <p className="mt-1 text-xs text-sand-500 whitespace-pre-line">
                                    {item.text}
                                  </p>
                                ) : null}
                              </div>
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
                        <span>Zwischensumme Material</span>
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
                    <span>Summe Material (netto)</span>
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
            Es gelten die AGB auf unserer Homepage: https://www.quansatech.at
          </div>
        </div>
      </div>

      {hasProductPhotos ? (
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
            </div>
            <div className="border-t border-sand-200 pt-3 text-[10px] text-sand-500">
              Es gelten die AGB auf unserer Homepage: https://www.quansatech.at
            </div>
          </div>
        </div>
      ) : null}

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
              Es gelten die AGB auf unserer Homepage: https://www.quansatech.at
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
    <div className="text-[11px] uppercase tracking-[0.2em] text-sand-500">
      <span>{label}</span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SelectField({ value, onChange, disabled, children }) {
  return (
    <div className="relative">
      <select
        className={selectClass}
        value={value}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500"
        aria-hidden="true"
      />
    </div>
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
  const [calcBlocks, setCalcBlocks] = useState(initialCalcBlocks);
  const [servicePick, setServicePick] = useState(initialServiceBlocks[0]?.id || "");
  const [devicePick, setDevicePick] = useState(initialDeviceBlocks[0]?.id || "");
  const [calcPick, setCalcPick] = useState(initialCalcBlocks[0]?.id || "");
  const [mainTab, setMainTab] = useState("new");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [imageDrafts, setImageDrafts] = useState({});
  const [importingItemId, setImportingItemId] = useState("");
  const [attachmentLinkDraft, setAttachmentLinkDraft] = useState("");
  const [blockOpen, setBlockOpen] = useState({});
  const [customers, setCustomers] = useState([]);
  const [offerNumberFormat, setOfferNumberFormat] = useState(defaultOfferFormat);
  const [offerSettingsLoaded, setOfferSettingsLoaded] = useState(false);
  const [blocksLoaded, setBlocksLoaded] = useState(false);
  const [previewOfferId, setPreviewOfferId] = useState("");
  const [previewMode, setPreviewMode] = useState("offer");
  const [exportOfferId, setExportOfferId] = useState("");
  const [exportMode, setExportMode] = useState("offer");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendStatus, setSendStatus] = useState("idle");
  const [expandedOffers, setExpandedOffers] = useState({});
  const [confirmationMenuOfferId, setConfirmationMenuOfferId] = useState("");
  const [aiLoading, setAiLoading] = useState({});
  const previewWrapperRef = useRef(null);
  const exportRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(0.75);
  const autosaveTimer = useRef(null);
  const [detailDraft, setDetailDraft] = useState("");

  const activeOffer = offers.find((offer) => offer.id === activeId) || null;
  const previewOffer = offers.find((offer) => offer.id === previewOfferId) || null;
  const exportOffer = offers.find((offer) => offer.id === exportOfferId) || null;
  const customersByName = useMemo(() => {
    const map = new Map();
    customers.forEach((customer) => {
      if (customer?.name) {
        map.set(customer.name.toLowerCase(), customer);
      }
    });
    return map;
  }, [customers]);

  const persistToStorage = (withStatus) => {
    if (typeof window === "undefined") return;
    const payload = {
      offers: sanitizeOffersForSave(offers),
      activeId,
      serviceBlocks,
      deviceBlocks,
      calcBlocks
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
    if (!previewWrapperRef.current) return;
    const element = previewWrapperRef.current;
    const updateScale = () => {
      const width =
        element.clientWidth ||
        element.getBoundingClientRect().width ||
        window.innerWidth ||
        0;
      const a4WidthPx = 210 * 3.7795275591;
      if (!width) {
        setPreviewScale(0.75);
        return;
      }
      const next = Math.min(1, width / a4WidthPx);
      setPreviewScale(Math.max(0.5, next));
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
      if (Array.isArray(stored?.calcBlocks) && stored.calcBlocks.length) {
        setCalcBlocks(stored.calcBlocks);
      }
    } catch (error) {
      // ignore load errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/offer_blocks")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.serviceBlocks?.length) {
          setServiceBlocks(data.serviceBlocks);
        }
        if (data?.deviceBlocks?.length) {
          setDeviceBlocks(data.deviceBlocks);
        }
        if (data?.calcBlocks?.length) {
          setCalcBlocks(data.calcBlocks);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBlocksLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!blocksLoaded) return;
    const timer = setTimeout(() => {
      fetch("/api/offer_blocks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceBlocks,
          deviceBlocks,
          calcBlocks
        })
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [blocksLoaded, serviceBlocks, deviceBlocks, calcBlocks]);

  useEffect(() => {
    let active = true;
    fetch("/api/offers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        if (!Array.isArray(data) || !data.length) return;
        const next = data.map(normalizeServerOffer).filter(Boolean);
        if (!next.length) return;
        setOffers(next);
        setActiveId(next[0]?.id || "");
        setMainTab("new");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
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
    if (!activeOffer || !activeOffer.customer || !customersByName.size) return;
    const match = customersByName.get(activeOffer.customer.trim().toLowerCase());
    if (!match) return;
    const postalCity = [match.postal_code, match.city].filter(Boolean).join(" ");
    const customerNumber = match.creditor_number || match.short_code || "";
    updateOffer(activeOffer.id, (offer) => {
      let changed = false;
      const next = { ...offer };
      if (!offer.recipientCompany && match.name) {
        next.recipientCompany = match.name;
        changed = true;
      }
      if (!offer.recipientStreet && match.street) {
        next.recipientStreet = match.street;
        changed = true;
      }
      if (!offer.recipientPostalCity && postalCity) {
        next.recipientPostalCity = postalCity;
        changed = true;
      }
      if (!offer.recipientCountry && match.country) {
        next.recipientCountry = match.country;
        changed = true;
      }
      if (!offer.customerNumber && customerNumber) {
        next.customerNumber = customerNumber;
        changed = true;
      }
      return changed ? next : offer;
    });
    if (!sendTo && match.email) {
      setSendTo(match.email);
    }
  }, [activeOffer?.id, activeOffer?.customer, customersByName, sendTo]);

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
    if (!calcBlocks.length) return;
    if (calcBlocks.some((item) => item.id === calcPick)) return;
    setCalcPick(calcBlocks[0]?.id || "");
  }, [calcBlocks, calcPick]);

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
  }, [offers, activeId, serviceBlocks, deviceBlocks, calcBlocks]);

  useEffect(() => {
    if (!exportOfferId) return;
    const offer = offers.find((item) => item.id === exportOfferId);
    if (!offer || !exportRef.current) return;
    const element = exportRef.current;
    const filenameBase =
      exportMode === "confirmation"
        ? `auftragsbestaetigung_${offer.reference || "angebot"}`
        : offer.reference || "angebot";
    const options = {
      margin: 0,
      filename: `${filenameBase}.pdf`,
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
        setExportMode("offer");
      });
  }, [exportOfferId, offers, exportMode]);

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

  const deleteArchivedOffer = async (offer) => {
    if (!offer) return;
    const ok = window.confirm("Angebot wirklich löschen?");
    if (!ok) return;
    if (offer.serverId) {
      try {
        const res = await fetch(`/api/offers/${offer.serverId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete_failed");
      } catch (error) {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2000);
        return;
      }
    }
    removeOffer(offer.id);
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
    const { headline, hostname } = await fetchPagePreview(url);
    const nextTitle = headline || hostname || item.title || "Position";
    updateLineItem(activeOffer.id, item.id, {
      title: item.title || nextTitle,
      aiDraft: item.aiDraft || generateAiText({ ...item, title: nextTitle })
    });
    setImportingItemId("");
  };

  const importDeviceFromReferenceLink = async (item, note) => {
    if (!activeOffer || !note?.text) return;
    const url = note.text;
    setImportingItemId(`${item.id}:${note.id}`);
    const { headline, snippet, hostname } = await fetchPagePreview(url);
    const nextDescription =
      item.description ||
      [
        headline ? `Produkt: ${headline}.` : "",
        snippet ? `Kurzbeschreibung: ${snippet}` : "",
        hostname ? `Quelle: ${hostname}` : ""
      ]
        .filter(Boolean)
        .join("\n");
    updateDeviceItem(activeOffer.id, item.id, {
      description: nextDescription
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

  const setAiBusy = (key, value) => {
    setAiLoading((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const isAiBusy = (key) => Boolean(aiLoading[key]);

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

  const editOfferFromArchive = (offerId) => {
    setActiveId(offerId);
    setMainTab("new");
  };

  const duplicateOffer = (offer) => {
    if (!offer) return;
    const newId = uid();
    setOffers((prev) => {
      const reference = makeReference(offerNumberFormat, prev.length + 1);
      const copy = {
        ...offer,
        id: newId,
        reference,
        status: "Entwurf",
        createdAt: new Date().toISOString()
      };
      return [copy, ...prev];
    });
    setActiveId(newId);
    setMainTab("new");
  };

  const exportOfferPdf = (offer, mode = "offer") => {
    if (!offer) return;
    setExportMode(mode);
    setExportOfferId(offer.id);
  };

  const toggleOfferExpanded = (offerId) => {
    setExpandedOffers((prev) => ({
      ...prev,
      [offerId]: !prev[offerId]
    }));
  };

  const getOfferTotal = (offer) => {
    const serviceTotal = (offer.lineItems || []).reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    const deviceTotal = (offer.deviceItems || []).reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
      0
    );
    return serviceTotal + deviceTotal;
  };

  const persistOfferForCustomer = async (offer) => {
    if (!offer) return null;
    const payload = {
      reference: offer.reference || "",
      customer: offer.customer || "",
      status: offer.status || "",
      data: sanitizeOfferForSave(offer)
    };
    const options = {
      method: offer.serverId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    };
    const endpoint = offer.serverId
      ? `/api/offers/${offer.serverId}`
      : "/api/offers";
    const res = await fetch(endpoint, options);
    if (!res.ok) throw new Error("offer_save_failed");
    const saved = await res.json();
    updateOffer(offer.id, (current) => ({
      ...current,
      serverId: saved.id,
      confirmGuid: saved.guid
    }));
    return saved;
  };

  const sendOfferEmail = async () => {
    if (!activeOffer || !sendTo) return;
    setSendStatus("sending");
    try {
      let confirmUrl = "";
      try {
        const saved = await persistOfferForCustomer(activeOffer);
        confirmUrl = saved?.confirm_url || "";
      } catch (error) {
        confirmUrl = "";
      }
      const res = await fetch("/api/offers/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo,
          subject:
            sendSubject ||
            `Angebot ${activeOffer.reference || ""}`.trim(),
          html: buildOfferEmailHtml(activeOffer, confirmUrl, "offer"),
          text: `Angebot ${activeOffer.reference || ""}${
            confirmUrl ? `\nBestätigungslink: ${confirmUrl}` : ""
          }`
        })
      });
      if (!res.ok) throw new Error("send_failed");
      const responsePayload = await res.json();
      if (responsePayload?.tracking_guid) {
        updateOffer(activeOffer.id, (offer) => ({
          ...offer,
          trackingGuid: responsePayload.tracking_guid
        }));
      }
      setSendStatus("sent");
    } catch (error) {
      setSendStatus("error");
    }
    setTimeout(() => setSendStatus("idle"), 3000);
  };

  const sendConfirmationEmail = async (offer) => {
    if (!offer || !sendTo) return;
    setSendStatus("sending");
    try {
      let confirmUrl = "";
      try {
        const saved = await persistOfferForCustomer(offer);
        confirmUrl = saved?.confirm_url || "";
      } catch (error) {
        confirmUrl = "";
      }
      const res = await fetch("/api/offers/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo,
          subject: `Auftragsbestätigung ${offer.reference || ""}`.trim(),
          html: buildOfferEmailHtml(offer, confirmUrl, "confirmation"),
          text: `Auftragsbestätigung ${offer.reference || ""}`.trim()
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
        product: "",
        manufacturer: "",
        model: "",
        price: 0,
        quantity: 1
      }
    ]);
  };

  const addCalcBlock = () => {
    setCalcBlocks((prev) => [
      ...prev,
      {
        id: uid(),
        title: "",
        text: ""
      }
    ]);
  };

  const updateServiceBlock = (id, patch) => {
    setServiceBlocks((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateDeviceBlock = (id, patch) => {
    setDeviceBlocks((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const updateCalcBlock = (id, patch) => {
    setCalcBlocks((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeServiceBlock = (id) => {
    setServiceBlocks((prev) => prev.filter((item) => item.id !== id));
  };

  const removeDeviceBlock = (id) => {
    setDeviceBlocks((prev) => prev.filter((item) => item.id !== id));
  };

  const removeCalcBlock = (id) => {
    setCalcBlocks((prev) => prev.filter((item) => item.id !== id));
  };

  const applyCalcBlock = () => {
    if (!activeOffer) return;
    const block = calcBlocks.find((item) => item.id === calcPick);
    if (!block || !block.text) return;
    updateOffer(activeOffer.id, (offer) => ({
      ...offer,
      calculationText: [offer.calculationText, block.text].filter(Boolean).join("\n")
    }));
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
        title: getDeviceProduct(item),
        product: getDeviceProduct(item),
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
          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-2">
            <section className="space-y-3">

          {activeOffer ? (
            <>
              <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-4 shadow-soft animate-fade-in">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
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

                <div className="mt-4 grid gap-3 md:grid-cols-3 items-stretch">
                  <div className="rounded-xl border border-sand-200 bg-sand-100 p-3 h-full">
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
                  <div className="rounded-xl border border-sand-200 bg-sand-100 p-3 h-full flex flex-col">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                      Kunde
                    </p>
                      <p className="mt-2 text-sm font-semibold text-sand-900">
                        {activeOffer.customer || "Noch offen"}
                      </p>
                    {activeOffer.recipientCompany ? (
                      <p className="mt-1 text-xs text-sand-500">
                        {activeOffer.recipientCompany}
                      </p>
                    ) : null}
                    {activeOffer.recipientStreet ? (
                      <p className="text-xs text-sand-500">
                        {activeOffer.recipientStreet}
                      </p>
                    ) : null}
                    {activeOffer.recipientPostalCity ? (
                      <p className="text-xs text-sand-500">
                        {activeOffer.recipientPostalCity}
                      </p>
                    ) : null}
                    {activeOffer.recipientCountry ? (
                      <p className="text-xs text-sand-500">
                        {activeOffer.recipientCountry}
                      </p>
                    ) : null}
                    {activeOffer.customerNumber ? (
                      <p className="mt-1 text-xs text-sand-500">
                        Kundennummer {activeOffer.customerNumber}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-sand-200 bg-white p-3 h-full">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                      Versand
                    </p>
                    <div className="mt-3 space-y-3">
                      <Field label="Empfänger E-Mail">
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
                      <button
                        type="button"
                        onClick={sendOfferEmail}
                        disabled={!sendTo || sendStatus === "sending"}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send size={12} />
                        {sendStatus === "sending" ? "Sende..." : "Senden"}
                      </button>
                      {sendStatus === "sent" && (
                        <span className="text-xs text-emerald-600">Gesendet</span>
                      )}
                      {sendStatus === "error" && (
                        <span className="text-xs text-rose-600">Versand fehlgeschlagen</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="rounded-2xl border border-sand-200 bg-sand-50/60 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
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
                      <Field label="Status">
                        <SelectField
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
                        </SelectField>
                      </Field>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,220px)_140px]">
                      <Field label="MwSt Modus">
                        <SelectField
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
                        </SelectField>
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
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <Field label="Anrede">
                    <input
                      className={inputClass}
                      value={activeOffer.salutation || ""}
                      onChange={(event) =>
                        updateOffer(activeOffer.id, (offer) => ({
                          ...offer,
                          salutation: event.target.value
                        }))
                      }
                      placeholder="Sehr geehrte Damen und Herren,"
                    />
                  </Field>
                  <Field label="Einleitung">
                    <textarea
                      className={noteTextareaClass}
                      value={activeOffer.introText || ""}
                      onChange={(event) =>
                        updateOffer(activeOffer.id, (offer) => ({
                          ...offer,
                          introText: event.target.value
                        }))
                      }
                      placeholder="Vielen Dank für Ihre Anfrage..."
                    />
                  </Field>
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
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={async () => {
                                const key = "cover-intro";
                                if (isAiBusy(key)) return;
                                setAiBusy(key, true);
                                try {
                                  const text = await requestOfferAiText({
                                    mode: "cover_intro",
                                    currentText: activeOffer.coverIntro || "",
                                    context: buildOfferContext(activeOffer),
                                    fallback: () => generateCoverIntro(activeOffer)
                                  });
                                  updateOffer(activeOffer.id, (offer) => ({
                                    ...offer,
                                    coverIntro: text
                                  }));
                                } finally {
                                  setAiBusy(key, false);
                                }
                              }}
                              className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600"
                            >
                              {isAiBusy("cover-intro") ? (
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-sand-400 border-t-transparent" />
                              ) : (
                                <Sparkles size={12} />
                              )}{" "}
                              Text
                            </button>
                          </div>
                          <textarea
                            className={noteTextareaClass}
                            value={activeOffer.coverIntro}
                            onChange={(event) =>
                              updateOffer(activeOffer.id, (offer) => ({
                                ...offer,
                                coverIntro: event.target.value
                              }))
                            }
                            placeholder="Einleitung für das Deckblatt"
                          />
                        </div>
                      </Field>
                    </div>
                  ) : null}
                  <Field label="Übersicht">
                    <div className="space-y-1.5">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={async () => {
                            const key = "overview";
                            if (isAiBusy(key)) return;
                            setAiBusy(key, true);
                            try {
                              const text = await requestOfferAiText({
                                mode: "overview",
                                currentText: activeOffer.overviewText || "",
                                context: buildOfferContext(activeOffer),
                                fallback: () => generateOverviewText(activeOffer)
                              });
                              updateOffer(activeOffer.id, (offer) => ({
                                ...offer,
                                overviewText: text
                              }));
                            } finally {
                              setAiBusy(key, false);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600"
                        >
                          {isAiBusy("overview") ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-sand-400 border-t-transparent" />
                          ) : (
                            <Sparkles size={12} />
                          )}{" "}
                          Text
                        </button>
                      </div>
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
                    </div>
                  </Field>
                  <Field label="Kalkulation (Zusatztext)">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-[180px]">
                            <SelectField
                              value={calcPick}
                              onChange={(event) => setCalcPick(event.target.value)}
                              disabled={!calcBlocks.length}
                            >
                              {calcBlocks.map((block) => (
                                <option key={block.id} value={block.id}>
                                  {block.title || "Zusatztext"}
                                </option>
                              ))}
                            </SelectField>
                          </div>
                          <button
                            type="button"
                            onClick={applyCalcBlock}
                            disabled={!calcBlocks.length || !calcPick}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sand-200 bg-white text-sand-600 hover:bg-sand-100 disabled:opacity-40"
                            title="Baustein einfügen"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const key = "calculation";
                            if (isAiBusy(key)) return;
                            setAiBusy(key, true);
                            try {
                              const text = await requestOfferAiText({
                                mode: "calculation",
                                currentText: activeOffer.calculationText || "",
                                context: buildOfferContext(activeOffer),
                                fallback: () => generateCalculationText(activeOffer)
                              });
                              updateOffer(activeOffer.id, (offer) => ({
                                ...offer,
                                calculationText: text
                              }));
                            } finally {
                              setAiBusy(key, false);
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600"
                        >
                          {isAiBusy("calculation") ? (
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-sand-400 border-t-transparent" />
                          ) : (
                            <Sparkles size={12} />
                          )}{" "}
                          Text
                        </button>
                      </div>
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
                    </div>
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
                      Leistung oder Material anlegen, Vorlagen nutzen.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      {activeOffer.lineItems.length} Leistungspositionen
                    </span>
                    <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                      {activeOffer.deviceItems.length} Materialpositionen
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
                          Leistung oder Material direkt anlegen.
                        </p>
                        <div className="flex flex-col gap-2">
                          <SelectField
                            value={positionType}
                            onChange={(event) => setPositionType(event.target.value)}
                          >
                            {positionTypes.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </SelectField>
                          <button
                            type="button"
                            onClick={addPosition}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                          >
                            <Plus size={12} /> Hinzufügen
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
                          Vorgefertigte Leistung übernehmen.
                        </p>
                        <SelectField
                          value={servicePick}
                          onChange={(event) => setServicePick(event.target.value)}
                          disabled={!serviceBlocks.length}
                        >
                          {serviceBlocks.map((block) => (
                            <option key={block.id} value={block.id}>
                              {block.title}
                            </option>
                          ))}
                        </SelectField>
                        <button
                          type="button"
                          onClick={addSelectedService}
                          disabled={!serviceBlocks.length || !servicePick}
                          className="mt-auto inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} /> Hinzufügen
                        </button>
                      </div>

                      <div className="bg-white border border-sand-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sand-700">
                          <Link size={16} />
                          <p className="text-xs uppercase tracking-wide text-sand-600">
                            Material-Baustein
                          </p>
                        </div>
                        <p className="text-sm text-sand-600">
                          Vorgefertigtes Materialprofil übernehmen.
                        </p>
                        <SelectField
                          value={devicePick}
                          onChange={(event) => setDevicePick(event.target.value)}
                          disabled={!deviceBlocks.length}
                        >
                          {deviceBlocks.map((block) => (
                            <option key={block.id} value={block.id}>
                              {block.title}
                            </option>
                          ))}
                        </SelectField>
                        <button
                          type="button"
                          onClick={addSelectedDevice}
                          disabled={!deviceBlocks.length || !devicePick}
                          className="mt-auto inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} /> Hinzufügen
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
                                  <div className="space-y-2">
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
                                    <div className="grid gap-2 md:grid-cols-3">
                                    <Field label="Preis">
                                      <div className="relative">
                                        <input
                                          className={priceInputClass}
                                          type="number"
                                          value={item.price}
                                          onChange={(event) =>
                                            updateLineItem(activeOffer.id, item.id, {
                                              price: Number(event.target.value)
                                            })
                                          }
                                        />
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sand-400">
                                          €
                                        </span>
                                      </div>
                                    </Field>
                                    <Field label="Menge">
                                      <input
                                        className={quantityInputClass}
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
                                      <SelectField
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
                                      </SelectField>
                                    </Field>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                        Positionstext
                                      </p>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const key = `line-ai-${item.id}`;
                                          if (isAiBusy(key)) return;
                                          setAiBusy(key, true);
                                          try {
                                            const text = await requestOfferAiText({
                                              mode: "position_text",
                                              currentText: item.aiDraft || "",
                                              context: buildLineItemContext(activeOffer, item),
                                              fallback: () => generateAiText(item)
                                            });
                                            updateLineItem(activeOffer.id, item.id, {
                                              aiDraft: text
                                            });
                                          } finally {
                                            setAiBusy(key, false);
                                          }
                                        }}
                                        className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                      >
                                        {isAiBusy(`line-ai-${item.id}`) ? (
                                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-sand-400 border-t-transparent" />
                                        ) : (
                                          <Sparkles size={12} />
                                        )}{" "}
                                        Text
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
                                      placeholder="Optionaler Positionstext für die Vorschau"
                                    />
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
                                      <div className="mt-3 rounded-2xl border border-sand-200/70 bg-sand-50/70 p-3">
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
                                        <div className="mt-2 space-y-2">
                                          {notes.length ? (
                                            notes.map((note) => (
                                              <div
                                                key={note.id}
                                                className="rounded-xl border border-sand-200 bg-white p-2"
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
                                                    <SelectField
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
                                                    </SelectField>
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
                                                          {importingItemId === `${item.id}:${note.id}` ? (
                                                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-sand-400 border-t-transparent" />
                                                          ) : (
                                                            <Sparkles size={12} />
                                                          )}
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
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-4 text-sm text-sand-500">
                          Noch keine Leistungspositionen ausgewählt.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-sand-200 bg-sand-100 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                          Materialprofile
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
                                    Materialprofil
                                  </p>
                                  <p className="text-sm font-semibold text-sand-900">
                                    {getDeviceProduct(item)}
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
                                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    <Field label="Produkt">
                                      <input
                                        className={inputClass}
                                        value={item.product || getDeviceProduct(item)}
                                        onChange={(event) =>
                                          updateDeviceItem(activeOffer.id, item.id, {
                                            product: event.target.value
                                          })
                                        }
                                        placeholder="Produkt"
                                      />
                                    </Field>
                                    <Field label="Preis">
                                      <div className="relative">
                                        <input
                                          className={priceInputClass}
                                          type="number"
                                          value={item.price}
                                          onChange={(event) =>
                                            updateDeviceItem(activeOffer.id, item.id, {
                                              price: Number(event.target.value)
                                            })
                                          }
                                        />
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sand-400">
                                          €
                                        </span>
                                      </div>
                                    </Field>
                                    <Field label="Menge">
                                      <input
                                        className={quantityInputClass}
                                        type="number"
                                        value={item.quantity}
                                        onChange={(event) =>
                                          updateDeviceItem(activeOffer.id, item.id, {
                                            quantity: Number(event.target.value)
                                          })
                                        }
                                      />
                                    </Field>
                                  </div>
                                  <div className="mt-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                                        Produktbeschreibung
                                      </p>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const key = `device-ai-${item.id}`;
                                          if (isAiBusy(key)) return;
                                          setAiBusy(key, true);
                                          try {
                                            const text = await requestOfferAiText({
                                              mode: "device_description",
                                              currentText: item.description || "",
                                              context: buildDeviceContext(activeOffer, item),
                                              fallback: () => generateDeviceDescription(item)
                                            });
                                            updateDeviceItem(activeOffer.id, item.id, {
                                              description: text
                                            });
                                          } finally {
                                            setAiBusy(key, false);
                                          }
                                        }}
                                        className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                                      >
                                        {isAiBusy(`device-ai-${item.id}`) ? (
                                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-sand-400 border-t-transparent" />
                                        ) : (
                                          <Sparkles size={12} />
                                        )}{" "}
                                        Text
                                      </button>
                                    </div>
                                    <textarea
                                      className={noteTextareaClass}
                                      value={item.description || ""}
                                      onChange={(event) =>
                                        updateDeviceItem(activeOffer.id, item.id, {
                                          description: event.target.value
                                        })
                                      }
                                      placeholder="Produktbeschreibung oder kurzer Freitext"
                                    />
                                  </div>
                                  <div className="mt-3 rounded-2xl border border-sand-200/70 bg-sand-50/70 p-3">
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
                                    <div className="mt-2 space-y-2">
                                      {notes.length ? (
                                        notes.map((note) => (
                                          <div
                                            key={note.id}
                                            className="rounded-xl border border-sand-200 bg-white p-2"
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
                                                <SelectField
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
                                                </SelectField>
                                              </Field>
                                              <Field label="Vermerktext">
                                                {note.type === "bezugslink" ? (
                                                  <div className="space-y-2">
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
                                                    <button
                                                      type="button"
                                                      onClick={() => importDeviceFromReferenceLink(item, note)}
                                                      disabled={
                                                        !note.text ||
                                                        importingItemId === `${item.id}:${note.id}`
                                                      }
                                                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                      {importingItemId === `${item.id}:${note.id}` ? (
                                                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-sand-400 border-t-transparent" />
                                                      ) : (
                                                        <Sparkles size={12} />
                                                      )}
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
                                        Bild-URL einfügen oder per Drag & Drop aus dem Browser.
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
                                          <Image size={12} /> Hinzufügen
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
                                            Noch keine Bilder hinzugefügt.
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
                          Keine Materialpositionen hinterlegt.
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
                  className="mt-3 w-full min-h-[160px] rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-[13px] text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
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
                      Übergabe
                    </p>
                    <h2 className="text-lg font-display text-sand-900">
                      Übergabe & Abrechnung
                    </h2>
                    <p className="text-sm text-sand-600">
                      Es werden nur Kurzpositionstitel, Menge, Preis und Referenz-ID
                      übergeben.
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
                    Noch keine Übergabe erzeugt.
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft text-sm text-sand-500">
              Kein Angebot ausgewählt.
            </section>
          )}
        </section>

        <aside className="space-y-4 xl:max-w-sm xl:justify-self-end">
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
            <button
              type="button"
              onClick={() => {
                if (!activeOffer) return;
                setPreviewOfferId(activeOffer.id);
                setPreviewMode("offer");
              }}
              className="w-full overflow-hidden text-left"
              title={activeOffer ? "Vorschau vergrößern" : ""}
            >
              <div
                ref={previewWrapperRef}
                className={`w-full overflow-hidden ${activeOffer ? "cursor-zoom-in" : ""}`}
              >
                <OfferPreview offer={activeOffer} scale={previewScale} />
              </div>
            </button>
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
                  <div key={offer.id}>
                    <div className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-left text-xs text-sand-700 flex items-center justify-between">
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
                          onClick={() => toggleOfferExpanded(offer.id)}
                          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                          title="Details"
                        >
                          {expandedOffers[offer.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateOffer(offer.id, (entry) => ({
                              ...entry,
                              status: "angenommen"
                            }))
                          }
                          className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-600 hover:bg-emerald-50"
                          title="Akzeptieren"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateOffer(offer.id, (entry) => ({
                              ...entry,
                              status: "abgelehnt"
                            }))
                          }
                          className="rounded-full border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                          title="Ablehnen"
                        >
                          <X size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => editOfferFromArchive(offer.id)}
                          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                          title="Bearbeiten"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewMode("offer");
                            setPreviewOfferId(offer.id);
                          }}
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
                    {expandedOffers[offer.id] ? (
                      <div className="mt-2 rounded-xl border border-sand-200 bg-sand-50 p-3 text-xs text-sand-600">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>Summe: {formatMoney(getOfferTotal(offer))}</span>
                          <span>Datum: {formatDate(offer.createdAt)}</span>
                          <span>
                            Tracking: {offer.trackingGuid ? "aktiv" : "nicht gesetzt"}
                          </span>
                        </div>
                      </div>
                    ) : null}
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
                  <div key={offer.id}>
                    <div className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-left text-xs text-sand-700 flex items-center justify-between">
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
                          onClick={() => toggleOfferExpanded(offer.id)}
                          className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-500 hover:bg-emerald-50"
                          title="Details"
                        >
                          {expandedOffers[offer.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateOffer(offer)}
                          className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-500 hover:bg-emerald-50"
                          title="Duplizieren"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewMode("offer");
                            setPreviewOfferId(offer.id);
                          }}
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
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmationMenuOfferId((prev) =>
                                prev === offer.id ? "" : offer.id
                              )
                            }
                            className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-500 hover:bg-emerald-50"
                            title="Auftragsbestätigung"
                          >
                            <Receipt size={14} />
                          </button>
                          {confirmationMenuOfferId === offer.id ? (
                            <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-emerald-200 bg-white p-2 shadow-soft text-xs text-sand-700 z-30">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewMode("confirmation");
                                  setPreviewOfferId(offer.id);
                                  setConfirmationMenuOfferId("");
                                }}
                                className="w-full rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                              >
                                Vorschau
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  exportOfferPdf(offer, "confirmation");
                                  setConfirmationMenuOfferId("");
                                }}
                                className="w-full rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                              >
                                PDF exportieren
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveId(offer.id);
                                  sendConfirmationEmail(offer);
                                  setConfirmationMenuOfferId("");
                                }}
                                disabled={sendStatus === "sending"}
                                className="w-full rounded-xl px-3 py-2 text-left hover:bg-emerald-50 disabled:opacity-50"
                              >
                                E-Mail senden
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteArchivedOffer(offer)}
                          className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-500 hover:bg-emerald-50"
                          title="Löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {expandedOffers[offer.id] ? (
                      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-700">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>Summe: {formatMoney(getOfferTotal(offer))}</span>
                          <span>Datum: {formatDate(offer.createdAt)}</span>
                          <span>
                            Tracking: {offer.trackingGuid ? "aktiv" : "nicht gesetzt"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateOffer(offer.id, (entry) => ({
                                ...entry,
                                status: "Entwurf"
                              }))
                            }
                            className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-emerald-600 hover:bg-emerald-50"
                          >
                            Wieder öffnen
                          </button>
                        </div>
                      </div>
                    ) : null}
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
                  <div key={offer.id}>
                    <div className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-left text-xs text-sand-700 flex items-center justify-between">
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
                          onClick={() => toggleOfferExpanded(offer.id)}
                          className="rounded-full border border-rose-200 bg-white p-1 text-rose-500 hover:bg-rose-50"
                          title="Details"
                        >
                          {expandedOffers[offer.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateOffer(offer)}
                          className="rounded-full border border-rose-200 bg-white p-1 text-rose-500 hover:bg-rose-50"
                          title="Duplizieren"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewMode("offer");
                            setPreviewOfferId(offer.id);
                          }}
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
                        <button
                          type="button"
                          onClick={() => deleteArchivedOffer(offer)}
                          className="rounded-full border border-rose-200 bg-white p-1 text-rose-500 hover:bg-rose-50"
                          title="Löschen"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {expandedOffers[offer.id] ? (
                      <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-700">
                        <div className="flex flex-wrap items-center gap-3">
                          <span>Summe: {formatMoney(getOfferTotal(offer))}</span>
                          <span>Datum: {formatDate(offer.createdAt)}</span>
                          <span>
                            Tracking: {offer.trackingGuid ? "aktiv" : "nicht gesetzt"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateOffer(offer.id, (entry) => ({
                                ...entry,
                                status: "Entwurf"
                              }))
                            }
                            className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-rose-600 hover:bg-rose-50"
                          >
                            Wieder öffnen
                          </button>
                        </div>
                      </div>
                    ) : null}
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
              Service & Material pflegen
            </h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
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
                          {isOpen ? "Schließen" : "Bearbeiten"}
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
                        <div className="space-y-2">
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
                          <div className="grid gap-2 md:grid-cols-3">
                            <Field label="Preis">
                              <div className="relative">
                                <input
                                  className={priceInputClass}
                                  type="number"
                                  value={block.price || 0}
                                  onChange={(event) =>
                                    updateServiceBlock(block.id, {
                                      price: Number(event.target.value)
                                    })
                                  }
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sand-400">
                                  €
                                </span>
                              </div>
                            </Field>
                            <Field label="Menge">
                              <input
                                className={quantityInputClass}
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
                              <SelectField
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
                              </SelectField>
                            </Field>
                          </div>
                        </div>
                        <div className="grid gap-2 md:grid-cols-3">
                          <Field label="Komplexität">
                            <SelectField
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
                            </SelectField>
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
                Materialbausteine
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
                          {block.title || "Materialbaustein"}
                        </p>
                        <p className="mt-1 text-xs text-sand-500">
                          {getDeviceProduct(block)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleBlockOpen(key)}
                          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                        >
                          {isOpen ? "Schließen" : "Bearbeiten"}
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
                        <Field label="Produkt">
                          <input
                            className={inputClass}
                            value={block.product ?? ""}
                            onChange={(event) =>
                              updateDeviceBlock(block.id, { product: event.target.value })
                            }
                            placeholder={getDeviceProduct(block) || "Produkt"}
                          />
                        </Field>
                        <Field label="Preis">
                          <div className="relative">
                            <input
                              className={priceInputClass}
                              type="number"
                              value={block.price || 0}
                              onChange={(event) =>
                                updateDeviceBlock(block.id, {
                                  price: Number(event.target.value)
                                })
                              }
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sand-400">
                              €
                            </span>
                          </div>
                        </Field>
                        <Field label="Menge">
                          <input
                            className={quantityInputClass}
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
                Noch keine Materialbausteine hinterlegt.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-sand-200 bg-sand-100 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Kalkulationsbausteine
              </p>
              <button
                type="button"
                onClick={addCalcBlock}
                className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
              >
                <Plus size={12} /> Neu
              </button>
            </div>
            {calcBlocks.length ? (
              calcBlocks.map((block) => {
                const key = `calc-${block.id}`;
                const isOpen = !!blockOpen[key];
                return (
                  <div
                    key={block.id}
                    className="rounded-2xl border border-sand-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-sand-900">
                          {block.title || "Zusatztext"}
                        </p>
                        <p className="mt-1 text-xs text-sand-500 line-clamp-2">
                          {block.text || "Kein Inhalt"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleBlockOpen(key)}
                          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                        >
                          {isOpen ? "Schließen" : "Bearbeiten"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCalcBlock(block.id)}
                          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                          title="Entfernen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {isOpen ? (
                      <div className="mt-3 space-y-2">
                        <Field label="Titel">
                          <input
                            className={inputClass}
                            value={block.title || ""}
                            onChange={(event) =>
                              updateCalcBlock(block.id, { title: event.target.value })
                            }
                            placeholder="Titel"
                          />
                        </Field>
                        <Field label="Text">
                          <textarea
                            className={noteTextareaClass}
                            value={block.text || ""}
                            onChange={(event) =>
                              updateCalcBlock(block.id, { text: event.target.value })
                            }
                            placeholder="Zusatztext zur Kalkulation"
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-3 text-xs text-sand-500">
                Noch keine Kalkulationsbausteine hinterlegt.
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
                {previewMode === "confirmation"
                  ? "Auftragsbestätigung"
                  : previewOffer.customer || "Angebot"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportOfferPdf(previewOffer, previewMode)}
                className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
              >
                <FileDown size={12} /> PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewOfferId("");
                  setPreviewMode("offer");
                }}
                className="rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                title="Schließen"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <OfferPreview offer={previewOffer} scale={0.9} mode={previewMode} />
        </div>
      </div>
    ) : null}
    {exportOffer ? (
      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        <OfferPreview offer={exportOffer} scale={1} containerRef={exportRef} mode={exportMode} />
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
