import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileDown,
  FilePlus,
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
import EmailComposerModal from "../components/EmailComposerModal";
import html2pdf from "html2pdf.js";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const SMTP_STORAGE_KEY = "qt_smtp_settings_cache";

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
  { value: "Gerät", label: "Material" }
];
const unitOptions = [
  { value: "hours", label: "Stunden" },
  { value: "days", label: "Tage" },
  { value: "weeks", label: "Wochen" },
  { value: "month", label: "Monate" },
  { value: "year", label: "Jahre" },
  { value: "piece", label: "Stück" },
  { value: "flat", label: "Pauschal" },
  { value: "user", label: "User" },
  { value: "device", label: "Gerät" },
  { value: "license", label: "Lizenz" },
  { value: "km", label: "Kilometer" },
  { value: "m", label: "Meter" },
  { value: "gb", label: "GB" },
  { value: "tb", label: "TB" }
];
const billingCycleOptions = [
  { value: "once", label: "Einmalig" },
  { value: "monthly", label: "Monatlich" },
  { value: "yearly", label: "Jährlich" }
];

const buildPdfBlobFromElement = async (element) => {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false
  });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = pageWidth / canvas.width;
  const imgHeight = canvas.height * ratio;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
  let heightLeft = imgHeight - pageHeight;
  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  const arrayBuffer = pdf.output("arraybuffer");
  return new Blob([arrayBuffer], { type: "application/pdf" });
};

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
    dealerLinkDate: "",
    images: [],
    internalNote: ""
  },
  {
    id: "device-backup",
    title: "Backup-Storage",
    manufacturer: "Synology",
    model: "RackStation",
    dealerLink: "",
    dealerLinkDate: "",
    images: [],
    internalNote: ""
  },
  {
    id: "device-wifi",
    title: "WLAN-Upgrade",
    manufacturer: "Ubiquiti",
    model: "UniFi 6",
    dealerLink: "",
    dealerLinkDate: "",
    images: [],
    internalNote: ""
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
  formatMoney(Number(price || 0) * Number(quantity || 0));

const normalizeBillingCycle = (value) => {
  if (value === "monthly" || value === "yearly") return value;
  return "once";
};

const formatBillingCycleLabel = (value) => {
  const normalized = normalizeBillingCycle(value);
  if (normalized === "monthly") return "Monatlich";
  if (normalized === "yearly") return "Jährlich";
  return "Einmalig";
};

const buildOfferConfirmUrl = (guid) => {
  if (!guid) return "";
  if (typeof window === "undefined") return `/offers/confirm/${guid}`;
  return `${window.location.origin}/offers/confirm/${guid}`;
};

const getCostTotalsByCycle = (offer) => {
  const totals = { once: 0, monthly: 0, yearly: 0 };
  if (!offer) return totals;
  const allItems = [...(offer.lineItems || []), ...(offer.deviceItems || [])];
  allItems.forEach((item) => {
    if (item?.optional) return;
    const cycle = normalizeBillingCycle(item.billingCycle);
    totals[cycle] += Number(item.price || 0) * Number(item.quantity || 0);
  });
  return totals;
};

const isOfferEmpty = (offer) => {
  if (!offer) return true;
  const hasPositions =
    (offer.lineItems || []).length > 0 || (offer.deviceItems || []).length > 0;
  const hasAttachments = (offer.attachments || []).length > 0;
  const hasCustomerDetails = [
    offer.customer,
    offer.recipientName,
    offer.recipientCompany,
    offer.recipientStreet,
    offer.recipientPostalCity,
    offer.customerNumber,
    offer.orderNumber
  ].some((value) => String(value || "").trim());
  const hasTextBlocks = [
    offer.overviewText,
    offer.calculationText,
    offer.detailHtml
  ].some((value) => String(value || "").trim());
  return !(hasPositions || hasAttachments || hasCustomerDetails || hasTextBlocks);
};

const isOfferAccepted = (offer) =>
  (offer?.status || "").toString().trim().toLowerCase() === "angenommen";

const getDeviceProduct = (item) =>
  item.product ||
  item.title ||
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

const stripHtml = (value) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildLineItemContext = (offer, item) => {
  const customer = offer?.customer || "Kunde offen";
  const title = item?.title || "Leistung";
  const keywords = Array.isArray(item?.keywords) ? item.keywords.filter(Boolean) : [];
  const unitLine = formatUnitQuantity(item?.quantity ?? "", item?.unit);
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
  const unitLine = formatUnitQuantity(item?.quantity ?? "", "piece");
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
  if (quantity === "" || quantity === null || typeof quantity === "undefined") {
    return "";
  }
  if (Number(quantity) === 0) return "";
  return `${Number(quantity || 0)} ${label}`;
};

const parseNumberInput = (value) => (value === "" ? "" : Number(value));

const normalizeQuantityInput = (value, fallback = 1) => {
  if (value === "" || value === null || typeof value === "undefined") return "";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return fallback;
  return numeric;
};

const formatPieceQuantity = (quantity) => {
  if (quantity === "" || quantity === null || typeof quantity === "undefined") {
    return "";
  }
  if (Number(quantity) === 0) return "";
  return `${Number(quantity || 0)}x`;
};

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
  quantity: normalizeQuantityInput(block.quantity, 1),
  unit: block.unit || "hours",
  researchHours: Number(block.researchHours || 0),
  billingCycle: block.billingCycle || "once",
  aiVersions: [],
  activeAiVersionId: null,
  aiDraft: "",
  internalNotes: [],
  optional: false
});

const buildDeviceItemFromBlock = (block = {}) => ({
  id: uid(),
  product:
    block.product ||
    block.title ||
    [block.manufacturer, block.model].filter(Boolean).join(" · "),
  manufacturer: block.manufacturer || "",
  model: block.model || block.modelFamily || "",
  description: block.description || "",
  price: Number(block.price || 0),
  quantity: normalizeQuantityInput(block.quantity, 1),
  billingCycle: block.billingCycle || "once",
  images: Array.isArray(block.images) ? [...block.images] : [],
  internalNotes: block.internalNote
    ? [
        {
          id: uid(),
          type: "internal",
          text: block.internalNote
        }
      ]
    : [],
  optional: false
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

const getNextOfferIndex = (offers, format) => {
  const template = (format || defaultOfferFormat).trim() || defaultOfferFormat;
  const match = template.match(/X+/);
  if (!match) return offers.length + 1;
  const width = match[0].length;
  const prefix = template.slice(0, match.index);
  const suffix = template.slice((match.index || 0) + width);
  let max = 0;
  offers.forEach((offer) => {
    const reference = String(offer?.reference || "");
    if (!reference.startsWith(prefix) || !reference.endsWith(suffix)) return;
    const numberPart = reference.slice(prefix.length, reference.length - suffix.length);
    if (numberPart.length !== width || !/^\d+$/.test(numberPart)) return;
    const value = Number(numberPart);
    if (value > max) max = value;
  });
  return max ? max + 1 : offers.length + 1;
};

const createEmptyOffer = (index, format) => ({
  id: uid(),
  reference: makeReference(format, index),
  customer: "",
  customerAutoFill: "",
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
  trackingGuid: "",
  handoverLocked: false
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

const htmlToPlainText = (html = "") =>
  String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/\n\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const normalizeHtmlBody = (html = "") => (htmlToPlainText(html) ? String(html).trim() : "");

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
  if (typeof next.handoverLocked === "undefined") {
    next.handoverLocked = false;
  }
  return next;
};

const loadCachedSignature = () => {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(SMTP_STORAGE_KEY);
    const cached = raw ? JSON.parse(raw) : {};
    return String(cached?.signature_html || "");
  } catch (error) {
    return "";
  }
};

const dedupeOffers = (list = []) => {
  const byKey = new Map();
  list.forEach((offer) => {
    const key = offer.serverId || offer.guid || offer.id;
    if (!key) return;
    const current = byKey.get(key);
    // prefer entries that have a serverId (fetched from backend) and newer updatedAt timestamps
    if (
      !current ||
      (!!offer.serverId && !current.serverId) ||
      (offer.updatedAt && current.updatedAt && offer.updatedAt > current.updatedAt)
    ) {
      byKey.set(key, offer);
    }
  });
  return Array.from(byKey.values());
};

const buildPreviewPositions = (offer) => {
  if (!offer) return [];
  let index = 0;
  const linePositions = (offer.lineItems || []).map((item) => {
    const activeVersion = getActiveVersion(item);
    const isOptional = Boolean(item.optional);
    const positionIndex = isOptional ? null : (index += 1);
    return {
      id: item.id,
      title: item.title || "Position",
      quantity: item.quantity,
      price: item.price,
      unit: item.unit || "hours",
      billingCycle: item.billingCycle || "once",
      text: item.aiDraft || activeVersion?.text || "",
      images: [],
      category: "service",
      optional: isOptional,
      positionIndex
    };
  });
  const devicePositions = (offer.deviceItems || []).map((item) => {
    const isOptional = Boolean(item.optional);
    const positionIndex = isOptional ? null : (index += 1);
    return {
      id: item.id,
      title: formatDeviceTitle(item),
      quantity: item.quantity,
      price: item.price,
      unit: "piece",
      billingCycle: item.billingCycle || "once",
      text: item.description || "",
      images: item.images || [],
      category: "device",
      optional: isOptional,
      positionIndex
    };
  });
  return [...linePositions, ...devicePositions];
};

const buildOfferEmailHtml = (offer, confirmUrl, mode = "offer", options = {}) => {
  const introHtml = options?.introHtml || "";
  const signatureHtml = options?.signatureHtml || "";
  const showDetails = mode === "confirmation";
  const positions = showDetails ? buildPreviewPositions(offer) : [];
  const headline =
    mode === "confirmation" ? "Ihre Auftragsbestätigung" : "Ihr Angebot";
  let emailIndex = 0;
  const rows = positions
    .map((item) => {
      const isOptional = Boolean(item.optional);
      const label = isOptional ? "Optional" : `${(emailIndex += 1)}`;
      return `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${label}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.title} (${formatBillingCycleLabel(
          item.billingCycle
        )})</td>
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
    `;
    })
    .join("");
  const confirmBlock = "";
  const introBlock = introHtml
    ? `<div style="margin:12px 0 16px;">${introHtml}</div>`
    : "";
  const signatureBlock = signatureHtml
    ? `<div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">${signatureHtml}</div>`
    : "";
  const detailsBlock = showDetails && rows
    ? `
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;">Pos</th>
            <th style="text-align:left;border-bottom:1px solid #ddd;padding:6px 8px;">Überschrift</th>
            <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px 8px;">Menge</th>
            <th style="text-align:right;border-bottom:1px solid #ddd;padding:6px 8px;">Netto</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `
    : "";
  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937">
      <h2>${headline} ${offer.reference || ""}</h2>
      <p>Kunde: ${offer.customer || "Kunde offen"}</p>
      ${introBlock}
      ${showDetails && offer.overviewText ? `<p>${offer.overviewText.replace(/\n/g, "<br/>")}</p>` : ""}
      ${confirmBlock}
      ${detailsBlock}
      ${signatureBlock}
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
    (sum, item) =>
      sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
    0
  );
  const deviceTotal = (offer.deviceItems || []).reduce(
    (sum, item) =>
      sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
    0
  );
  const optionalTotal = [...(offer.lineItems || []), ...(offer.deviceItems || [])].reduce(
    (sum, item) =>
      sum + (item?.optional ? Number(item.price || 0) * Number(item.quantity || 0) : 0),
    0
  );
  const totalNet = serviceTotal + deviceTotal;
  const totalVat = calcVat(totalNet, offer);
  const recipientName = offer.recipientName || offer.customer || "Kunde offen";
  const recipientCompany = (offer.recipientCompany || "").trim();
  const totalGross = totalNet + totalVat;
  const costTotals = getCostTotalsByCycle(offer);
  const hasPositionText = previewPositions.some((item) => item.text);
  const hasProductPhotos = previewPositions.some((item) => item.images?.length);
  const isExport = Boolean(containerRef);
  const rowsPerPage = isExport ? 8 : Number.POSITIVE_INFINITY;
  const previewRowsPerPage = 10;
  const pageSize = isExport ? rowsPerPage : previewRowsPerPage;
  const forceTotalsPageBreak = isExport && previewPositions.length > rowsPerPage;
  const pagedPositions = [];
  for (let i = 0; i < previewPositions.length; i += pageSize) {
    const chunk = previewPositions
      .slice(i, i + pageSize)
      .map((item, index) => ({ ...item, overallIndex: i + index }));
    pagedPositions.push(chunk);
  }
  if (!pagedPositions.length) {
    pagedPositions.push([]);
  }
  const shouldInsertBreak = (index) =>
    isExport &&
    (index + 1) % rowsPerPage === 0 &&
    index + 1 < previewPositions.length;
  const a4WidthPx = 210 * 3.7795275591;
  const a4HeightPx = 297 * 3.7795275591;

  return (
    <div
      ref={containerRef}
      className={isExport ? "space-y-6 bg-white" : "space-y-6 overflow-auto"}
      style={isExport ? { backgroundColor: "#ffffff" } : undefined}
    >
      {offer.coverEnabled ? (
        <div
          className="mx-auto"
          style={{
            width: `${a4WidthPx * scale}px`,
            height: isExport ? "auto" : `${a4HeightPx * scale}px`,
            minHeight: `${a4HeightPx * scale}px`
          }}
        >
          <div
            className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft flex flex-col"
              style={{
                width: `${a4WidthPx}px`,
                height: isExport ? "auto" : `${a4HeightPx}px`,
                minHeight: `${a4HeightPx}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                ...(isExport ? { transform: "none" } : {}),
                pageBreakAfter: isExport ? "always" : "auto"
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

      {pagedPositions.map((pagePositions, pageIndex) => {
        const pageServicePositions = pagePositions.filter(
          (item) => item.category === "service"
        );
        const pageDevicePositions = pagePositions.filter(
          (item) => item.category === "device"
        );
        const showTotals = pageIndex === pagedPositions.length - 1;
        const totalsShouldBreak =
          isExport &&
          showTotals &&
          (forceTotalsPageBreak ||
            Boolean((offer.calculationText || "").trim().length > 240) ||
            (offer.attachments || []).length > 0);
        return (
          <div
            key={`page-${pageIndex}`}
            className="mx-auto"
            style={{
              width: `${a4WidthPx * scale}px`,
              height: isExport ? "auto" : `${a4HeightPx * scale}px`,
              minHeight: isExport ? `${a4HeightPx}px` : `${a4HeightPx * scale}px`
            }}
          >
            <div
              className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft flex flex-col"
              style={{
                width: `${a4WidthPx}px`,
                height: isExport ? "auto" : `${a4HeightPx}px`,
                minHeight: `${a4HeightPx}px`,
                paddingBottom: isExport ? "48px" : undefined,
                transform: isExport ? "none" : `scale(${scale})`,
                transformOrigin: "top left",
                pageBreakAfter:
                  isExport && pageIndex < pagedPositions.length - 1 ? "always" : "auto"
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
                {pageIndex === 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 text-xs text-sand-600">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                        Absender
                      </p>
                      {splitSenderLines(
                        offer.senderLine ||
                          "Quansatech GmbH - Steyrtalstraße 88 - 4523 Neuzeug"
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
                      {offer.recipientPostalCity ? (
                        <p>{offer.recipientPostalCity}</p>
                      ) : null}
                      {offer.recipientCountry ? <p>{offer.recipientCountry}</p> : null}
                      {offer.customerNumber ? (
                        <p>Kundennummer {offer.customerNumber}</p>
                      ) : null}
                      <p>Angebots-Nr. {offer.orderNumber || offer.reference || "-"}</p>
                      <p>Datum: {formatDate(offer.createdAt) || "-"}</p>
                    </div>
                  </div>
                ) : null}

                {pageIndex === 0 ? (
                  <div className="space-y-2 text-sm text-sand-700">
                    <p className="text-base font-semibold text-sand-900">
                      {mode === "confirmation" ? "Auftragsbestätigung" : "Angebot"}{" "}
                      {offer.reference || "-"}
                    </p>
                    <p>{offer.salutation || "Sehr geehrte Damen und Herren,"}</p>
                    <p>{offer.introText || "Vielen Dank für Ihre Anfrage."}</p>
                  </div>
                ) : null}

                {pageIndex === 0 && offer.overviewText ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
                      Übersicht
                    </p>
                    <p className="mt-2 text-sm text-sand-700 whitespace-pre-line">
                      {offer.overviewText}
                    </p>
                  </div>
                ) : null}

                {pagePositions.length ? (
                  <div>
                    <div className="mt-2 rounded-xl border border-sand-200">
                      <div className="grid grid-cols-[0.2fr_1.2fr_0.35fr_0.45fr_0.55fr] gap-2 border-b border-sand-200 bg-sand-50 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-sand-400">
                        <span>Pos</span>
                        <span>Leistung</span>
                        <span className="text-right">Menge</span>
                        <span className="text-right">Einzelpreis</span>
                        <span className="text-right">Gesamt (netto)</span>
                      </div>
                      {pageServicePositions.length ? (
                        <>
                          <div className="border-b border-sand-200 bg-white/70 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-sand-400">
                            Leistungen
                          </div>
                          {pageServicePositions.map((item) => (
                            <div key={item.id}>
                              <div
                                className="border-b border-sand-100"
                                style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                              >
                                <div className="grid grid-cols-[0.2fr_1.2fr_0.35fr_0.45fr_0.55fr] gap-2 px-3 py-2 text-xs text-sand-700">
                                  <span>
                                    {item.optional ? "Optional" : `Pos. ${item.positionIndex || "-"}`}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-sand-800">{item.title}</p>
                                    {item.text ? (
                                      <p className="mt-1 text-xs text-sand-500 whitespace-pre-line">
                                        {item.text}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="text-right">
                                    <div>{formatUnitQuantity(item.quantity, item.unit)}</div>
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-sand-300">
                                      {formatBillingCycleLabel(item.billingCycle)}
                                    </div>
                                  </div>
                                  <span className="text-right">
                                    {formatMoney(Number(item.price || 0))}
                                  </span>
                                  <span className="text-right">
                                    {formatLineTotal(item.price, item.quantity)}
                                  </span>
                                </div>
                              </div>
                              {shouldInsertBreak(item.overallIndex) ? (
                                <div className="html2pdf__page-break" />
                              ) : null}
                            </div>
                          ))}
                          {showTotals ? (
                            <div
                              className="grid grid-cols-[0.2fr_1.2fr_0.35fr_0.45fr_0.55fr] gap-2 border-b border-sand-100 bg-sand-50 px-3 py-2 text-xs font-semibold text-sand-700"
                              style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                            >
                              <span />
                              <span>Zwischensumme Leistungen</span>
                              <span />
                              <span />
                              <span className="text-right">{formatMoney(serviceTotal)}</span>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                      {pageDevicePositions.length ? (
                        <>
                          <div className="border-b border-sand-200 bg-white/70 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-sand-400">
                            Material
                          </div>
                          {pageDevicePositions.map((item) => (
                            <div key={item.id}>
                              <div
                                className="border-b border-sand-100"
                                style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                              >
                                <div className="grid grid-cols-[0.2fr_1.2fr_0.35fr_0.45fr_0.55fr] gap-2 px-3 py-2 text-xs text-sand-700">
                                  <span>
                                    {item.optional ? "Optional" : `Pos. ${item.positionIndex || "-"}`}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-sand-800">{item.title}</p>
                                    {item.text ? (
                                      <p className="mt-1 text-xs text-sand-500 whitespace-pre-line">
                                        {item.text}
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="text-right">
                                    <div>{formatPieceQuantity(item.quantity)}</div>
                                    <div className="text-[9px] uppercase tracking-[0.18em] text-sand-300">
                                      {formatBillingCycleLabel(item.billingCycle)}
                                    </div>
                                  </div>
                                  <span className="text-right">
                                    {formatMoney(Number(item.price || 0))}
                                  </span>
                                  <span className="text-right">
                                    {formatLineTotal(item.price, item.quantity)}
                                  </span>
                                </div>
                              </div>
                              {shouldInsertBreak(item.overallIndex) ? (
                                <div className="html2pdf__page-break" />
                              ) : null}
                            </div>
                          ))}
                          {showTotals ? (
                            <div
                              className="grid grid-cols-[0.2fr_1.2fr_0.35fr_0.45fr_0.55fr] gap-2 border-b border-sand-100 bg-sand-50 px-3 py-2 text-xs font-semibold text-sand-700"
                              style={{ breakInside: "avoid", pageBreakInside: "avoid" }}
                            >
                              <span />
                              <span>Zwischensumme Material</span>
                              <span />
                              <span />
                              <span className="text-right">{formatMoney(deviceTotal)}</span>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {showTotals ? (
                      <>
                        {totalsShouldBreak ? (
                          <div className="html2pdf__page-break" />
                        ) : null}
                        <div
                          className="mt-2"
                          style={{
                            breakInside: "avoid",
                            pageBreakInside: "avoid",
                            breakBefore: totalsShouldBreak ? "page" : "auto",
                            pageBreakBefore: totalsShouldBreak ? "always" : "auto"
                          }}
                        >
                          {offer.calculationText ? (
                            <p className="text-xs text-sand-600 whitespace-pre-line">
                              {offer.calculationText}
                            </p>
                          ) : null}
                          <div className="mt-3 rounded-xl border border-sand-200 bg-sand-50 p-4 text-sm text-sand-700 space-y-4">
                            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
                              <div className="space-y-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-sand-600">
                                  Netto nach Bereich
                                </p>
                                <div className="flex items-center justify-between">
                                  <span>Leistungen</span>
                                  <span className="font-semibold text-sand-900">
                                    {formatMoney(serviceTotal)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Material</span>
                                  <span className="font-semibold text-sand-900">
                                    {formatMoney(deviceTotal)}
                                  </span>
                                </div>
                              </div>
                              <div className="hidden md:block w-px bg-sand-200" aria-hidden="true" />
                              <div className="space-y-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-sand-600">
                                  Laufende Kosten
                                </p>
                                {costTotals.monthly ? (
                                  <div className="flex items-center justify-between">
                                    <span>Monatlich</span>
                                    <span className="font-semibold text-sand-900">
                                      {formatMoney(costTotals.monthly)}
                                    </span>
                                  </div>
                                ) : null}
                                {costTotals.yearly ? (
                                  <div className="flex items-center justify-between">
                                    <span>Jährlich</span>
                                    <span className="font-semibold text-sand-900">
                                      {formatMoney(costTotals.yearly)}
                                    </span>
                                  </div>
                                ) : null}
                                {costTotals.once ? (
                                  <div className="flex items-center justify-between">
                                    <span>Einmalig</span>
                                    <span className="font-semibold text-sand-900">
                                      {formatMoney(costTotals.once)}
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <div className="border-t border-sand-200 pt-3 space-y-2">
                              <div className="flex items-center justify-between font-semibold text-sand-900">
                                <span>Gesamt netto</span>
                                <span>{formatMoney(totalNet)}</span>
                              </div>
                              {optionalTotal > 0 ? (
                                <div className="flex items-center justify-between text-sand-600">
                                  <span>Optional (netto)</span>
                                  <span>{formatMoney(optionalTotal)}</span>
                                </div>
                              ) : null}
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
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {showTotals && (offer.attachments || []).length ? (
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
        );
      })}

      {hasProductPhotos ? (
        <div
          className="mx-auto"
          style={{
            width: `${a4WidthPx * scale}px`,
            height: isExport ? "auto" : `${a4HeightPx * scale}px`,
            minHeight: isExport ? `${a4HeightPx}px` : `${a4HeightPx * scale}px`
          }}
        >
          <div
            className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft flex flex-col"
            style={{
              width: `${a4WidthPx}px`,
              height: isExport ? "auto" : `${a4HeightPx}px`,
              minHeight: `${a4HeightPx}px`,
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
            height: isExport ? "auto" : `${a4HeightPx * scale}px`,
            minHeight: isExport ? `${a4HeightPx}px` : `${a4HeightPx * scale}px`
          }}
        >
          <div
            className="rounded-2xl border border-sand-200 bg-white p-8 shadow-soft flex flex-col"
            style={{
              width: `${a4WidthPx}px`,
              height: isExport ? "auto" : `${a4HeightPx}px`,
              minHeight: `${a4HeightPx}px`,
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

function HandoverModal({
  open,
  offer,
  summary,
  text,
  aiLoading,
  onClose,
  onConfirm,
  onTextChange,
  onGenerateAi
}) {
  if (!open || !offer || !summary) return null;
  const trackingText = offer.trackingGuid
    ? `Tracking aktiv (ID ${offer.trackingGuid}).`
    : "Tracking wird beim Versand aktiviert, sofern Beacon konfiguriert ist.";
  const statusLabel = summary.accepted ? "Angebot angenommen" : "Angebot nicht angenommen";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-sand-900/50 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-sand-100 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Pre-Check</p>
            <h3 className="text-lg font-display text-sand-900">Übergabe an Faktura</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand-200 bg-white p-2 text-sand-500 hover:bg-sand-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4">
          <div className="grid gap-2 text-xs text-sand-600 md:grid-cols-3">
            <div>
              <p className="font-semibold text-sand-900">{statusLabel}</p>
              {!summary.accepted && (
                <p className="text-rose-600">Das Angebot muss angenommen sein, bevor die Übergabe erfolgt.</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-sand-900">{summary.positions} Positionen</p>
              <p>Zeilen inkl. Gerätepositionen</p>
            </div>
            <div>
              <p className="font-semibold text-sand-900">
                {summary.serverId ? `Server ID ${summary.serverId}` : "Noch nicht synchronisiert"}
              </p>
              <p className="text-sand-500">Serverdaten</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-[11px] text-sand-500">
            <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sand-600">
              <p className="text-[10px] uppercase tracking-[0.3em]">Netto</p>
              <p className="text-sand-900">{formatMoney(summary.totalNet)}</p>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sand-600">
              <p className="text-[10px] uppercase tracking-[0.3em]">MwSt</p>
              <p className="text-sand-900">{formatMoney(summary.totalVat)}</p>
            </div>
            <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sand-600">
              <p className="text-[10px] uppercase tracking-[0.3em]">Brutto</p>
              <p className="text-sand-900">{formatMoney(summary.totalGross)}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-sand-100 px-6 py-4">
          <label className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
            Positionstext für Aufgaben (Plaintext)
            <textarea
              className="mt-2 w-full min-h-[140px] rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={text}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="Beschreiben Sie die erwarteten Aufgaben, Ergebnisse oder Hinweise."
            />
          </label>
          <div className="mt-2 flex items-center justify-between text-[11px] text-sand-500">
            <button
              type="button"
              onClick={onGenerateAi}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-wait"
            >
              <Sparkles size={12} />
              {aiLoading ? "KI generiert..." : "KI-Text generieren"}
            </button>
            <p className="text-sand-400">{trackingText}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-sand-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand-200 px-4 py-1.5 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={aiLoading || !summary.accepted}
            className="inline-flex items-center justify-center rounded-full bg-sand-900 px-4 py-1.5 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Übergabe an Faktura starten
          </button>
        </div>
      </div>
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

function PositionCard({ item, onUpdate, onRemove, onSaveAsBlock }) {
  if (!item) return null;
  const [open, setOpen] = useState(false);
  const billingOptions = [
    { value: "once", label: "Einmalig" },
    { value: "monthly", label: "Monatlich" },
    { value: "yearly", label: "Jährlich" }
  ];
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-3 text-sm text-sand-700 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
          title={open ? "Details ausblenden" : "Details anzeigen"}
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <input
          className={`${inputClass} flex-[7] min-w-[280px]`}
          value={item.title || ""}
          onChange={(event) => onUpdate({ title: event.target.value })}
          placeholder="Leistungstitel"
        />
        <div className="flex items-center rounded-xl border border-sand-200 bg-sand-50 px-2 flex-[1.5] min-w-[110px]">
          <span className="text-sand-500 mr-1">€</span>
          <input
            className="w-full bg-transparent py-1 text-[13px] text-sand-900 outline-none appearance-none"
            type="number"
            value={item.price ?? ""}
            onChange={(event) => onUpdate({ price: parseNumberInput(event.target.value) })}
          />
        </div>
        <input
          className={`${quantityInputClass} flex-[1.5] min-w-[90px]`}
          type="number"
          value={item.quantity ?? ""}
          onChange={(event) => onUpdate({ quantity: parseNumberInput(event.target.value) })}
          placeholder="Menge"
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
          title="Entfernen"
        >
          <Trash2 size={12} />
        </button>
        <button
          type="button"
          onClick={() => onSaveAsBlock?.(item)}
          className="text-slate-400 hover:text-sand-700"
          title="Als Baustein speichern"
        >
          <BookmarkPlus size={16} />
        </button>
      </div>
      {open ? (
        <div className="space-y-2">
          <Field label="Beschreibung">
            <textarea
              className={noteTextareaClass}
              value={item.aiDraft || ""}
              onChange={(event) => onUpdate({ aiDraft: event.target.value })}
              placeholder="Leistungsbeschreibung"
            />
          </Field>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Einheit">
              <SelectField
                value={item.unit || "hours"}
                onChange={(event) => onUpdate({ unit: event.target.value })}
              >
                {unitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </Field>
            <Field label="Abrechnung">
              <SelectField
                value={item.billingCycle || "once"}
                onChange={(event) => onUpdate({ billingCycle: event.target.value })}
              >
                {billingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </Field>
            <div className="flex items-center gap-3 pt-6">
              <input
                id={`line-optional-${item.id}`}
                type="checkbox"
                checked={Boolean(item.optional)}
                onChange={(event) => onUpdate({ optional: event.target.checked })}
                className="h-4 w-4"
              />
              <label
                htmlFor={`line-optional-${item.id}`}
                className="text-sm text-sand-700"
              >
                Optional
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const UnitOptions = () => (
  <datalist id="unit-options">
    <option value="hours" />
    <option value="days" />
    <option value="weeks" />
    <option value="month" />
    <option value="year" />
    <option value="piece" />
    <option value="flat" />
    <option value="user" />
    <option value="device" />
    <option value="license" />
    <option value="km" />
    <option value="m" />
    <option value="gb" />
    <option value="tb" />
  </datalist>
);

function DeviceCard({
  item,
  onUpdate,
  onRemove,
  onAddImage = () => {},
  onRemoveImage = () => {},
  onSaveAsBlock
}) {
  if (!item) return null;
  const [open, setOpen] = useState(false);
  const [imageUrlDraft, setImageUrlDraft] = useState("");
  const billingOptions = [
    { value: "once", label: "Einmalig" },
    { value: "monthly", label: "Monatlich" },
    { value: "yearly", label: "Jährlich" }
  ];

  const handleAddImageUrl = () => {
    const url = (imageUrlDraft || "").trim();
    if (!url) return;
    onAddImage(url);
    setImageUrlDraft("");
  };

  const handleFiles = (files) => {
    if (!files || !files.length) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        if (result) onAddImage(result);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (event.dataTransfer?.files?.length) {
      handleFiles(event.dataTransfer.files);
    } else {
      const text = event.dataTransfer?.getData("text/plain");
      if (text) {
        onAddImage(text.trim());
      }
    }
  };

  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-3 text-sm text-sand-700 space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
          title={open ? "Details ausblenden" : "Details anzeigen"}
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <input
          className={`${inputClass} flex-[7] min-w-[280px]`}
          value={item.product || ""}
          onChange={(event) => onUpdate({ product: event.target.value })}
          placeholder="Gerät / Material"
        />
        <div className="flex items-center rounded-xl border border-sand-200 bg-sand-50 px-2 flex-[1.5] min-w-[110px]">
          <span className="text-sand-500 mr-1">€</span>
          <input
            className="w-full bg-transparent py-1 text-[13px] text-sand-900 outline-none appearance-none"
            type="number"
            value={item.price ?? ""}
            onChange={(event) => onUpdate({ price: parseNumberInput(event.target.value) })}
          />
        </div>
        <input
          className={`${quantityInputClass} flex-[1.5] min-w-[90px]`}
          type="number"
          value={item.quantity ?? ""}
          onChange={(event) => onUpdate({ quantity: parseNumberInput(event.target.value) })}
          placeholder="Menge"
        />
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
          title="Entfernen"
        >
          <Trash2 size={12} />
        </button>
        <button
          type="button"
          onClick={() => onSaveAsBlock?.(item)}
          className="text-slate-400 hover:text-sand-700"
          title="Als Baustein speichern"
        >
          <BookmarkPlus size={16} />
        </button>
      </div>
      {open ? (
        <div className="space-y-2">
          <Field label="Beschreibung">
            <textarea
              className={noteTextareaClass}
              value={item.description || ""}
              onChange={(event) => onUpdate({ description: event.target.value })}
              placeholder="Beschreibung"
            />
          </Field>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Abrechnung">
              <SelectField
                value={item.billingCycle || "once"}
                onChange={(event) => onUpdate({ billingCycle: event.target.value })}
              >
                {billingOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </Field>
            <div className="flex items-center gap-3 pt-6">
              <input
                id={`device-optional-${item.id}`}
                type="checkbox"
                checked={Boolean(item.optional)}
                onChange={(event) => onUpdate({ optional: event.target.checked })}
                className="h-4 w-4"
              />
              <label
                htmlFor={`device-optional-${item.id}`}
                className="text-sm text-sand-700"
              >
                Optional
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.25em] text-sand-500">Bilder</p>
              <div className="flex items-center gap-2">
                <input
                  className="w-52 rounded-xl border border-sand-200 bg-sand-50 px-3 py-1.5 text-[13px] text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                  value={imageUrlDraft}
                  onChange={(e) => setImageUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddImageUrl();
                    }
                  }}
                  placeholder="https://bild.url"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                >
                  URL hinzufügen
                </button>
                <label className="rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100 cursor-pointer">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="rounded-xl border border-dashed border-sand-300 bg-sand-50 px-3 py-2 text-xs text-sand-500"
            >
              Link einfügen oder Bild-Dateien hierher ziehen.
            </div>
            {(item.images || []).length ? (
              <div className="flex flex-wrap gap-2">
                {item.images.map((url) => (
                  <div
                    key={url}
                    className="relative h-20 w-28 overflow-hidden rounded-xl border border-sand-200 bg-white"
                  >
                    <img
                      src={url}
                      alt="Material"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveImage(url)}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-sand-600 hover:bg-white"
                      title="Entfernen"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-sand-500">Keine Bilder hinterlegt.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function OffersView() {
  const [offers, setOffers] = useState(initialOffers);
  const [activeId, setActiveId] = useState("");
  const [starterCreated, setStarterCreated] = useState(false);
  const [detailOpen, setDetailOpen] = useState({});
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
  const [emailExportOfferId, setEmailExportOfferId] = useState("");
  const [emailExportMode, setEmailExportMode] = useState("offer");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendStatus, setSendStatus] = useState("idle");
  const [offerEmailBody, setOfferEmailBody] = useState("");
  const [offerEmailModalOpen, setOfferEmailModalOpen] = useState(false);
  const [emailOfferId, setEmailOfferId] = useState("");
  const [emailHelperText, setEmailHelperText] = useState("");
  const [smtpSignatureHtml, setSmtpSignatureHtml] = useState(loadCachedSignature);
  const [handoverModal, setHandoverModal] = useState({
    open: false,
    offerId: "",
    text: "",
    aiLoading: false,
    summary: null
  });
  const [sevdeskStatus, setSevdeskStatus] = useState({});
  const [expandedOffers, setExpandedOffers] = useState({});
  const [confirmationMenuOfferId, setConfirmationMenuOfferId] = useState("");
  const [aiLoading, setAiLoading] = useState({});
  const previewWrapperRef = useRef(null);
  const previewSectionRef = useRef(null);
  const documentBuildRef = useRef(null);
  const offerHeaderRef = useRef(null);
  const exportRef = useRef(null);
  const emailPdfRef = useRef(null);
  const emailExportPromiseRef = useRef(null);
  const offersFetchedRef = useRef(false);
  const [previewScale, setPreviewScale] = useState(0.7);
  const [previewMaxHeight, setPreviewMaxHeight] = useState("70vh");
  const autosaveTimer = useRef(null);
  const serverSaveInFlightRef = useRef({});
  const [detailDraft, setDetailDraft] = useState("");
  const [importerOpen, setImporterOpen] = useState(false);
  const [importSources, setImportSources] = useState([]);
  const [importSource, setImportSource] = useState("");
  const [importQuery, setImportQuery] = useState("");
  const [importResults, setImportResults] = useState([]);
  const [importStatus, setImportStatus] = useState("idle");
  const [importError, setImportError] = useState("");
  const [importSourcesStatus, setImportSourcesStatus] = useState({
    status: "idle",
    lastCheckAt: "",
    error: ""
  });
  const [icecatApiStatus, setIcecatApiStatus] = useState({
    status: "idle",
    enabled: false,
    hasToken: false,
    error: ""
  });

  const activeOffer = offers.find((offer) => offer.id === activeId) || null;
  const previewOffer = offers.find((offer) => offer.id === previewOfferId) || null;
  const exportOffer = offers.find((offer) => offer.id === exportOfferId) || null;
  const emailExportOffer = offers.find((offer) => offer.id === emailExportOfferId) || null;
  const emailOffer = offers.find((offer) => offer.id === emailOfferId) || null;
  const activeSevdeskKey = activeOffer ? activeOffer.serverId || activeOffer.id : null;
  const activeSevdeskState = activeSevdeskKey ? sevdeskStatus[activeSevdeskKey] : null;
  const offerTrackingText = activeOffer?.trackingGuid
    ? `Tracking aktiv (ID ${activeOffer.trackingGuid}).`
    : "Tracking wird beim Versand aktiviert, sofern Beacon konfiguriert ist.";
  const emailTrackingText = emailOffer?.trackingGuid
    ? `Tracking aktiv (ID ${emailOffer.trackingGuid}).`
    : "Tracking wird beim Versand aktiviert, sofern Beacon konfiguriert ist.";
  const offerDefaultSubject = `Angebot ${activeOffer?.reference || ""}`.trim();
  const emailDefaultSubject = `Angebot ${emailOffer?.reference || ""}`.trim();
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

  const persistOfferToServer = async (offer, withStatus) => {
    if (!offer || isOfferEmpty(offer)) return null;
    if (serverSaveInFlightRef.current[offer.id]) return null;
    serverSaveInFlightRef.current[offer.id] = true;
    try {
      const saved = await persistOfferForCustomer(offer);
      if (withStatus) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
      return saved;
    } catch (error) {
      if (withStatus) {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
      return null;
    } finally {
      delete serverSaveInFlightRef.current[offer.id];
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
      setPreviewScale(Math.max(0.5, next * 0.9));
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
    let active = true;
    fetch("/api/smtp_settings")
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const signature = String(data?.signature_html || "");
        setSmtpSignatureHtml(signature);
        try {
          const raw = window.localStorage.getItem(SMTP_STORAGE_KEY);
          const cached = raw ? JSON.parse(raw) : {};
          window.localStorage.setItem(
            SMTP_STORAGE_KEY,
            JSON.stringify({ ...cached, signature_html: signature })
          );
        } catch (error) {
          // ignore cache errors
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const computeHeight = () => {
      const headerEl = offerHeaderRef.current;
      const previewEl = previewWrapperRef.current;
      if (!headerEl || !previewEl) return;
      const available = headerEl.getBoundingClientRect().height;
      if (available > 0) {
        const px = `${Math.max(240, available)}px`;
        setPreviewMaxHeight(px);
        previewEl.style.height = px;
      }
    };
    computeHeight();
    window.addEventListener("resize", computeHeight);
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(computeHeight);
      if (offerHeaderRef.current) observer.observe(offerHeaderRef.current);
    }
    return () => {
      window.removeEventListener("resize", computeHeight);
      if (observer) observer.disconnect();
    };
  }, [mainTab, activeOffer?.id]);

  useEffect(() => {
    if (!importerOpen) return;
    let active = true;
    setImportStatus("loading");
    setImportError("");
    setImportSourcesStatus({
      status: "loading",
      lastCheckAt: new Date().toISOString(),
      error: ""
    });
    fetch("/api/marketplace/sources")
      .then((res) => (res && res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        const sources = Array.isArray(data) ? data : [];
        setImportSources(sources);
        setImportSource((prev) => prev || "all");
        setImportSourcesStatus({
          status: "ready",
          lastCheckAt: new Date().toISOString(),
          error: ""
        });
        setImportStatus("idle");
      })
      .catch((error) => {
        if (!active) return;
        setImportError(error?.message || "Import-Service nicht erreichbar.");
        setImportSourcesStatus({
          status: "error",
          lastCheckAt: new Date().toISOString(),
          error: error?.message || "Import-Service nicht erreichbar."
        });
        setImportStatus("error");
      });
    setIcecatApiStatus({ status: "loading", enabled: false, hasToken: false, error: "" });
    fetch("/api/integrations")
      .then((res) => (res && res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setIcecatApiStatus({
          status: "ready",
          enabled: Boolean(data?.icecat_enabled),
          hasToken: Boolean(data?.has_icecat_api_token),
          error: ""
        });
      })
      .catch((error) => {
        if (!active) return;
        setIcecatApiStatus({
          status: "error",
          enabled: false,
          hasToken: false,
          error: error?.message || "Icecat Status nicht verfügbar."
        });
      });
    return () => {
      active = false;
    };
  }, [importerOpen]);

  const loadOffersFromServer = () =>
    fetch("/api/offers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const fetched = Array.isArray(data) ? data.map(normalizeServerOffer).filter(Boolean) : [];
        setOffers((prev) => {
          const drafts = prev.filter((offer) => !offer.serverId);
          const merged = dedupeOffers([...drafts, ...fetched]);
          setActiveId((current) =>
            merged.some((offer) => offer.id === current || offer.serverId === current)
              ? current
              : merged[0]?.id || ""
          );
          return merged;
        });
      })
      .catch(() => {});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
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
    if (offersFetchedRef.current) return;
    offersFetchedRef.current = true;
    let active = true;
    loadOffersFromServer();
    return () => {
      active = false;
    };
  }, [offerNumberFormat, offerSettingsLoaded, starterCreated]);

  useEffect(() => {
    if (starterCreated || !offerSettingsLoaded) return;
    const starter = createEmptyOffer(offers.length + 1 || 1, offerNumberFormat);
    setOffers((prev) => [starter, ...prev]);
    setActiveId(starter.id);
    setStarterCreated(true);
    setMainTab("new");
  }, [offerNumberFormat, offerSettingsLoaded, starterCreated]);

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
      const next = { ...offer };
      let changed = false;
      const matchName = match.name || offer.customer;
      const shouldOverwrite = offer.customerAutoFill !== matchName;
      if (shouldOverwrite) {
        next.recipientCompany = match.name || "";
        next.recipientStreet = match.street || "";
        next.recipientPostalCity = postalCity || "";
        next.recipientCountry = match.country || "";
        next.customerNumber = customerNumber || "";
        next.customerAutoFill = matchName;
        changed = true;
      } else {
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
        if (!offer.customerAutoFill && matchName) {
          next.customerAutoFill = matchName;
          changed = true;
        }
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
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy", "avoid-all"] }
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
    if (!emailExportOfferId) return;
    const offer = offers.find((item) => item.id === emailExportOfferId);
    if (!offer || !emailPdfRef.current) return;
    const element = emailPdfRef.current;
    const handlers = emailExportPromiseRef.current;
    const run = async () => {
      try {
        const options = {
          margin: 0,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy", "avoid-all"] }
        };
        const buffer = await html2pdf()
          .set(options)
          .from(element)
          .toPdf()
          .get("pdf")
          .then((pdf) => pdf.output("arraybuffer"));
        const blob = new Blob([buffer], { type: "application/pdf" });
        handlers?.resolve?.(blob);
      } catch (error) {
        try {
          const blob = await buildPdfBlobFromElement(element);
          handlers?.resolve?.(blob);
        } catch (fallbackError) {
          handlers?.reject?.(fallbackError);
        }
      } finally {
        emailExportPromiseRef.current = null;
        setEmailExportOfferId("");
        setEmailExportMode("offer");
      }
    };
    run();
  }, [emailExportOfferId, offers, emailExportMode]);

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
    return (
      activeOffer.lineItems.filter((item) => !item?.optional).length +
      activeOffer.deviceItems.filter((item) => !item?.optional).length
    );
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
    (sum, item) =>
            sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
            0
          )
        : 0,
    [activeOffer]
  );

  const deviceTotal = useMemo(
    () =>
      activeOffer
        ? activeOffer.deviceItems.reduce(
    (sum, item) =>
            sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
            0
          )
        : 0,
    [activeOffer]
  );

  const costTotals = useMemo(
    () => (activeOffer ? getCostTotalsByCycle(activeOffer) : { once: 0, monthly: 0, yearly: 0 }),
    [activeOffer]
  );

  const totalNet = serviceTotal + deviceTotal;
  const totalVat = calcVat(totalNet, activeOffer);
  const totalGross = totalNet + totalVat;

  const totals = useMemo(() => {
    if (!activeOffer) return { total: 0, count: 0 };
    const count =
      activeOffer.lineItems.filter((item) => !item?.optional).length +
      activeOffer.deviceItems.filter((item) => !item?.optional).length;
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

  const updateOfferStatus = (offerId, status) => {
    const offer = offers.find((entry) => entry.id === offerId);
    if (!offer) return;
    if (offer.handoverLocked && status === "Entwurf") return;
    const nextOffer = { ...offer, status };
    updateOffer(offerId, () => nextOffer);
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
      if (!next.length) {
        const starter = createEmptyOffer(1, offerNumberFormat);
        setActiveId(starter.id);
        return [starter];
      }
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
        if (url && url.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(url);
          } catch (error) {
            // ignore revoke errors
          }
        }
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
      const nextIndex = getNextOfferIndex(prev, offerNumberFormat);
      const next = createEmptyOffer(nextIndex, offerNumberFormat);
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
      const reference = makeReference(offerNumberFormat, getNextOfferIndex(prev, offerNumberFormat));
      const copy = {
        ...offer,
        id: newId,
        reference,
        status: "Entwurf",
        createdAt: new Date().toISOString(),
        serverId: null,
        confirmGuid: "",
        trackingGuid: ""
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

  const generateOfferPdfBlob = (offer, mode = "offer") =>
    new Promise((resolve, reject) => {
      if (!offer) {
        reject(new Error("offer_missing"));
        return;
      }
      emailExportPromiseRef.current = { resolve, reject };
      setEmailExportMode(mode);
      setEmailExportOfferId(offer.id);
    });

  const blobToBase64 = async (blob) => {
    const buffer = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const buildEmailAttachments = async (offer, pdfBlob) => {
    const attachments = [];
    const skippedLinks = [];
    const pdfBase64 = await blobToBase64(pdfBlob);
    const filenameBase = offer.reference || "angebot";
    attachments.push({
      filename: `${filenameBase}.pdf`,
      content_base64: pdfBase64,
      content_type: "application/pdf"
    });
    const list = offer.attachments || [];
    for (const item of list) {
      if (!item?.url) continue;
      try {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error("fetch_failed");
        const blob = await res.blob();
        const contentBase64 = await blobToBase64(blob);
        attachments.push({
          filename: item.fileName || item.title || "beilage",
          content_base64: contentBase64,
          content_type: item.fileType || blob.type || "application/octet-stream"
        });
      } catch (error) {
        if (item.url) skippedLinks.push(item.url);
      }
    }
    return { attachments, skippedLinks };
  };

  const toggleOfferExpanded = (offerId) => {
    setExpandedOffers((prev) => ({
      ...prev,
      [offerId]: !prev[offerId]
    }));
  };

  const getOfferTotal = (offer) => {
    const serviceTotal = (offer.lineItems || []).reduce(
      (sum, item) =>
        sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
      0
    );
    const deviceTotal = (offer.deviceItems || []).reduce(
      (sum, item) =>
        sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
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

  const openOfferEmailComposerForOffer = (offer) => {
    if (!offer) return;
    if (!offer.serverId) {
      setSendStatus("error");
      return;
    }
    setEmailOfferId(offer.id);
    const defaultText = `Angebot ${offer.reference || ""}`.trim();
    setSendSubject((prev) => prev || defaultText);
    setOfferEmailBody((prev) => prev || defaultText);
    const customer = customersByName.get(String(offer.customer || "").toLowerCase());
    if (!sendTo && customer?.email) {
      setSendTo(customer.email);
    }
    const attachmentCount = (offer.attachments || []).length + 1;
    setEmailHelperText(`Anhänge: ${attachmentCount} (PDF + Beilagen)`);
    setOfferEmailModalOpen(true);
  };

  const openOfferEmailComposer = () => {
    if (!activeOffer) return;
    openOfferEmailComposerForOffer(activeOffer);
  };

  const closeOfferEmailComposer = () => {
    setOfferEmailModalOpen(false);
    setEmailOfferId("");
    setEmailHelperText("");
  };

  const handleOfferEmailSend = async () => {
    const offer = emailOffer || activeOffer;
    if (!offer || !sendTo) return;
    if (!offer.serverId) {
      setSendStatus("error");
      return;
    }
    setSendStatus("sending");
    try {
      const confirmUrl = buildOfferConfirmUrl(offer.confirmGuid);
      const introHtml = normalizeHtmlBody(offerEmailBody || "");
      const signatureHtml = String(smtpSignatureHtml || "").trim();
      let html = buildOfferEmailHtml(offer, confirmUrl, "offer", {
        introHtml,
        signatureHtml
      });
      const baseText =
        htmlToPlainText(introHtml) ||
        (offerEmailBody || `Angebot ${offer.reference || ""} im Anhang.`).trim() ||
        `Angebot ${offer.reference || ""} im Anhang.`;
      const signatureText = htmlToPlainText(signatureHtml);
      let text = baseText;
      if (signatureText) {
        text = `${text}\n\n${signatureText}`;
      }
      const pdfBlob = await generateOfferPdfBlob(offer, "offer");
      const { attachments } = await buildEmailAttachments(offer, pdfBlob);
      const res = await fetch("/api/offers/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo,
          subject: sendSubject || `Angebot ${offer.reference || ""}`.trim(),
          html,
          text,
          attachments
        })
      });
      if (!res.ok) throw new Error("send_failed");
      const responsePayload = await res.json();
      if (responsePayload?.tracking_guid) {
        const nextOffer = {
          ...offer,
          trackingGuid: responsePayload.tracking_guid
        };
        updateOffer(offer.id, () => nextOffer);
        try {
          await persistOfferForCustomer(nextOffer);
        } catch (error) {
          // Ignore tracking persist errors.
        }
      }
      setSendStatus("sent");
      closeOfferEmailComposer();
    } catch (error) {
      setSendStatus("error");
    }
    setTimeout(() => setSendStatus("idle"), 3000);
  };

  const sendConfirmationEmail = async (offer) => {
    if (!offer || !sendTo) return;
    if (!offer.serverId) {
      setSendStatus("error");
      return;
    }
    setSendStatus("sending");
    try {
      const confirmUrl = buildOfferConfirmUrl(offer.confirmGuid);
      const signatureHtml = String(smtpSignatureHtml || "").trim();
      const signatureText = htmlToPlainText(signatureHtml);
      let text = `Auftragsbestätigung ${offer.reference || ""}`.trim();
      if (signatureText) {
        text = `${text}\n\n${signatureText}`;
      }
      const res = await fetch("/api/offers/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: sendTo,
          subject: `Auftragsbestätigung ${offer.reference || ""}`.trim(),
          html: buildOfferEmailHtml(offer, confirmUrl, "confirmation", {
            signatureHtml
          }),
          text
        })
      });
      if (!res.ok) throw new Error("send_failed");
      const responsePayload = await res.json();
      if (responsePayload?.tracking_guid) {
        const nextOffer = {
          ...offer,
          trackingGuid: responsePayload.tracking_guid
        };
        updateOffer(offer.id, () => nextOffer);
        try {
          await persistOfferForCustomer(nextOffer);
        } catch (error) {
          // Ignore tracking persist errors.
        }
      }
      setSendStatus("sent");
    } catch (error) {
      setSendStatus("error");
    }
    setTimeout(() => setSendStatus("idle"), 3000);
  };

  const parseApiResponse = async (res) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      return { raw: text };
    }
  };

  const createSevdeskDraft = async (offerId) => {
    setSevdeskStatus((prev) => ({
      ...prev,
      [offerId]: { status: "sending", message: "" }
    }));
    let success = false;
    try {
      const res = await fetch(`/api/sevdesk/offers/${offerId}/draft`, { method: "POST" });
      const data = await parseApiResponse(res);
      if (!res.ok || !data?.ok) {
        const detail = data?.detail || data?.error || data?.message || data?.raw || "Fehler";
        throw new Error(detail);
      }
      setSevdeskStatus((prev) => ({
        ...prev,
        [offerId]: { status: "sent", message: "Rechnungsentwurf erstellt" }
      }));
      success = true;
    } catch (error) {
      setSevdeskStatus((prev) => ({
        ...prev,
        [offerId]: {
          status: "error",
          message: error?.message ? String(error.message) : "Fehler"
        }
      }));
    }
    setTimeout(() => {
      setSevdeskStatus((prev) => {
        const next = { ...prev };
        delete next[offerId];
        return next;
      });
    }, 4000);
    return success;
  };

  const createSevdeskDraftForOffer = async (offer) => {
    if (!offer) return;
    if (!isOfferAccepted(offer)) {
      setSevdeskStatus((prev) => ({
        ...prev,
        [offer.serverId || offer.id]: { status: "error", message: "Angebot nicht akzeptiert" }
      }));
      return;
    }
    let serverId = offer.serverId || offer.id;
    if (!offer.serverId) {
      try {
        const saved = await persistOfferForCustomer(offer);
        serverId = saved?.id || serverId;
      } catch (error) {
        setSevdeskStatus((prev) => ({
          ...prev,
          [serverId]: {
            status: "error",
            message: "Angebot konnte nicht gespeichert werden"
          }
        }));
        return;
      }
    }
    const ok = await createSevdeskDraft(serverId);
    if (ok) {
      const updated = { ...offer, serverId, handoverLocked: true };
      updateOffer(offer.id, () => updated);
      try {
        await persistOfferForCustomer(updated);
      } catch (error) {
        // locking is still applied locally even if sync fails
      }
    }
  };

  const getHandoverSummary = (offer) => {
    if (!offer) return null;
    const serviceTotal = (offer.lineItems || []).reduce(
      (sum, item) =>
        sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
      0
    );
    const deviceTotal = (offer.deviceItems || []).reduce(
      (sum, item) =>
        sum + (item?.optional ? 0 : Number(item.price || 0) * Number(item.quantity || 0)),
      0
    );
    const net = serviceTotal + deviceTotal;
    const vat = calcVat(net, offer);
    return {
      positions:
        (offer.lineItems || []).filter((item) => !item?.optional).length +
        (offer.deviceItems || []).filter((item) => !item?.optional).length,
      totalNet: net,
      totalVat: vat,
      totalGross: net + vat,
      accepted: isOfferAccepted(offer),
      serverId: offer.serverId || ""
    };
  };

  const getHandoverDefaultText = (offer) => {
    if (!offer) return "";
    const fromDetail = stripHtml(offer.detailHtml);
    if (fromDetail) return fromDetail;
    return offer.introText || `Details zur Übergabe von Angebot ${offer.reference || ""}.`;
  };

  const openHandoverModal = (offer) => {
    if (!offer) return;
    setHandoverModal({
      open: true,
      offerId: offer.id,
      text: offer.handoverNote || getHandoverDefaultText(offer),
      aiLoading: false,
      summary: getHandoverSummary(offer)
    });
  };

  const closeHandoverModal = () => {
    setHandoverModal((prev) => ({ ...prev, open: false }));
  };

  const handleHandoverTextChange = (value) => {
    setHandoverModal((prev) => ({ ...prev, text: value }));
  };

  const handleHandoverAi = async () => {
    const offer = offers.find((entry) => entry.id === handoverModal.offerId);
    if (!offer) return;
    const currentText = handoverModal.text;
    setHandoverModal((prev) => ({ ...prev, aiLoading: true }));
    try {
      const aiText = await requestOfferAiText({
        mode: "handover",
        currentText,
        context: buildOfferContext(offer),
        fallback: () =>
          generateAiText({
            title: offer.reference || "Leistung",
            keywords: []
          })
      });
      if (aiText) {
        setHandoverModal((prev) => ({ ...prev, text: aiText }));
      }
    } finally {
      setHandoverModal((prev) => ({ ...prev, aiLoading: false }));
    }
  };

  const handleHandoverConfirm = () => {
    const offer = offers.find((entry) => entry.id === handoverModal.offerId);
    if (!offer) return;
    closeHandoverModal();
    createSevdeskDraftForOffer(offer);
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
        keywords: [],
        billingCycle: "once"
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
        description: "",
        price: 0,
        quantity: 1,
        billingCycle: "once",
        images: [],
        internalNote: ""
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

  const appendDeviceBlockImages = (id, urls) => {
    if (!urls || !urls.length) return;
    setDeviceBlocks((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const current = Array.isArray(item.images) ? item.images : [];
        const next = [...current];
        urls.forEach((url) => {
          const trimmed = String(url || "").trim();
          if (!trimmed || next.includes(trimmed)) return;
          next.push(trimmed);
        });
        return { ...item, images: next };
      })
    );
  };

  const handleDeviceBlockDrop = (event, blockId) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length) {
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          if (result) appendDeviceBlockImages(blockId, [result]);
        };
        reader.readAsDataURL(file);
      });
      return;
    }
    const text = event.dataTransfer?.getData("text/plain") || "";
    if (text) {
      const urls = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      appendDeviceBlockImages(blockId, urls);
    }
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
        quantity: normalizeQuantityInput(item.quantity, 1),
        unit: item.unit || "hours",
        researchHours: Number(item.researchHours || 0),
        keywords: item.keywords || [],
        billingCycle: item.billingCycle || "once"
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
        description: item.description || "",
        price: Number(item.price || 0),
        quantity: normalizeQuantityInput(item.quantity, 1),
        billingCycle: item.billingCycle || "once"
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
    addLineItem({ type: "Dienstleistung" });
  };

  const addSelectedService = () => {
    if (!activeOffer) return;
    const block = serviceBlocks.find((item) => item.id === servicePick);
    if (!block) return;
    addLineItem({ ...block, type: "Dienstleistung" });
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

  const runImporterSearch = async () => {
    if (!importQuery) return;
    setImportStatus("loading");
    setImportError("");
    try {
      if (importSource === "icecat") {
        const query = importQuery.trim();
        const isEan = /^\d{8,14}$/.test(query);
        const params = new URLSearchParams();
        if (isEan) {
          params.set("ean", query);
        } else if (query.includes(":")) {
          const [brand, ...rest] = query.split(":");
          const mpn = rest.join(":").trim();
          if (brand.trim() && mpn) {
            params.set("brand", brand.trim());
            params.set("mpn", mpn);
          }
        } else {
          const parts = query.split(/\s+/).filter(Boolean);
          if (parts.length >= 2) {
            params.set("brand", parts[0]);
            params.set("mpn", parts.slice(1).join(" "));
          }
        }
        if (!params.toString()) {
          throw new Error("Icecat benötigt EAN oder Brand+MPN.");
        }
        const res = await fetch(`/api/marketplace/alternative/icecat?${params.toString()}`);
        if (!res.ok) throw new Error("Icecat Suche fehlgeschlagen.");
        const data = await res.json();
        if (data) {
          const sku = params.get("ean") || params.get("mpn") || "icecat";
          setImportResults([
            {
              source: "icecat",
              sku,
              title: data.title || sku,
              shortDescription: data.description || "",
              recommendedVK: null,
              ekMin: null,
              ekMax: null,
              currency: ""
            }
          ]);
        } else {
          setImportResults([]);
        }
        setImportStatus("idle");
        return;
      }
      if (importSource === "all") {
        const activeSources = importSources
          .filter((entry) => entry?.source)
          .map((entry) => entry.source);
        if (!activeSources.length) {
          throw new Error("Keine Marketplace-Quellen verfügbar.");
        }
        const errors = [];
        const results = await Promise.all(
          activeSources.map(async (source) => {
            const params = new URLSearchParams({
              source,
              query: importQuery
            });
            const res = await fetch(`/api/marketplace/search?${params.toString()}`);
            if (!res.ok) {
              const text = await res.text();
              errors.push(`${source}: ${text || res.status}`);
              return [];
            }
            const data = await res.json();
            return Array.isArray(data) ? data : [];
          })
        );
        const flat = results.flat();
        setImportResults(flat);
        if (!flat.length && errors.length) {
          setImportError(errors.slice(0, 2).join(" · "));
        }
      } else {
        const params = new URLSearchParams({
          source: importSource,
          query: importQuery
        });
        const res = await fetch(`/api/marketplace/search?${params.toString()}`);
        if (!res.ok) throw new Error("Import-Suche fehlgeschlagen.");
        const text = await res.text();
        let data = [];
        try {
          data = text ? JSON.parse(text) : [];
        } catch (error) {
          data = [];
        }
        console.log("[materialimporter] response", {
          source: importSource,
          query: importQuery,
          status: res.status,
          length: Array.isArray(data) ? data.length : -1,
          preview: text.slice(0, 500)
        });
        setImportResults(Array.isArray(data) ? data : []);
      }
      setImportStatus("idle");
    } catch (error) {
      setImportError(error?.message || "Import-Suche fehlgeschlagen.");
      setImportStatus("error");
    }
  };

  const addImportedItem = (item) => {
    if (!activeOffer || !item) return;
    const price = Number(item.recommendedVK ?? item.ekMin ?? item.ekMax ?? 0);
    addDeviceItem({
      title: item.title || item.sku || "Material",
      product: item.title || item.sku || "Material",
      description: item.shortDescription || item.title || "",
      price,
      quantity: 1
    });
    setImporterOpen(false);
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
          <div className="flex-1" />
          {mainTab === "new" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!activeOffer) return;
                  persistToStorage(false);
                  persistOfferToServer(activeOffer, true);
                }}
                disabled={!activeOffer}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
                  activeOffer
                    ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                    : "border-sand-200 bg-sand-100 text-sand-400 cursor-not-allowed"
                }`}
              >
                <Save size={12} /> Speichern
              </button>
              {saveStatus === "saved" && (
                <span className="text-xs text-emerald-600">Gespeichert</span>
              )}
              {saveStatus === "error" && (
                <span className="text-xs text-rose-600">Speichern fehlgeschlagen</span>
              )}
            </div>
          ) : null}
        </div>

        {mainTab === "new" ? (
          activeOffer ? (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-3 items-start">
                <section className="xl:col-span-2 rounded-3xl border border-sand-200 bg-white/80 backdrop-blur p-3 shadow-soft animate-fade-in">
                  <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-3 items-start">
                    <section
                      ref={offerHeaderRef}
                      className="self-start rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-display text-sand-900 leading-tight">Angebotskopf</h2>
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
                          <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                            Einmal {formatMoney(costTotals.once)}
                          </span>
                          <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                            Laufend {formatMoney(costTotals.monthly)} / {formatMoney(costTotals.yearly)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 items-stretch">
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

                    <aside
                      className="space-y-4 xl:sticky xl:top-4 self-start"
                      ref={previewSectionRef}
                    >
                      <section className="rounded-3xl border border-sand-200 bg-white p-3 shadow-soft">
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
                            style={{ maxHeight: previewMaxHeight, height: previewMaxHeight }}
                            className={`w-full overflow-auto ${activeOffer ? "cursor-zoom-in" : ""}`}
                          >
                            <OfferPreview offer={activeOffer} scale={previewScale} />
                          </div>
                        </button>
                      </section>
                    </aside>
                  </div>
                </section>

                <section className="xl:col-span-2 rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-3 shadow-soft animate-fade-in">
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
                        {activeOffer.lineItems.filter((item) => !item?.optional).length} Leistungspositionen
                      </span>
                      <span className="rounded-full border border-sand-200 bg-sand-100 px-3 py-1 text-xs uppercase tracking-wide text-sand-600">
                        {activeOffer.deviceItems.filter((item) => !item?.optional).length} Materialpositionen
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-4">
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
                          <button
                            type="button"
                            onClick={() => {
                              setPositionType("Dienstleistung");
                              addLineItem({ type: "Dienstleistung" });
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                          >
                            <Plus size={12} /> Leistung
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPositionType("Gerät");
                              addDeviceItem();
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                          >
                            <Plus size={12} /> Material
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
                              {block.product || block.title || "Material"}
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

                      <div className="bg-white border border-sand-200 rounded-2xl p-3 shadow-sm flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-sand-700">
                          <Sparkles size={16} />
                          <p className="text-xs uppercase tracking-wide text-sand-600">
                            Materialimporter
                          </p>
                        </div>
                        <p className="text-sm text-sand-600">
                          Import aus Marketplace-APIs übernehmen.
                        </p>
                        <button
                          type="button"
                          onClick={() => setImporterOpen(true)}
                          className="mt-auto inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                        >
                          <Plus size={14} /> Öffnen
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
                            {activeOffer.lineItems.filter((item) => !item?.optional).length} Positionen
                          </span>
                        </div>
                        <div className="grid gap-2">
                          {(activeOffer.lineItems || []).map((item) => (
                            <PositionCard
                              key={item.id}
                              item={item}
                              kind="service"
                              customers={customers}
                              onUpdate={(patch) => updateLineItem(activeOffer.id, item.id, patch)}
                              onRemove={() => removeLineItem(activeOffer.id, item.id)}
                              onSaveAsBlock={saveLineItemAsBlock}
                              onNoteChange={(updater) => updateLineItemNotes(activeOffer.id, item.id, updater)}
                              onAiDraft={(text) =>
                                updateLineItem(activeOffer.id, item.id, { aiDraft: text || "" })
                              }
                              onAddNote={(note) => addLineItemNote(activeOffer.id, item.id, note)}
                              onDeleteNote={(noteId) => deleteLineItemNote(activeOffer.id, item.id, noteId)}
                              onUpdateNote={(noteId, patch) =>
                                updateLineItemNote(activeOffer.id, item.id, noteId, patch)
                              }
                              onVersionsChange={(versions) =>
                                updateLineItem(activeOffer.id, item.id, { aiVersions: versions })
                              }
                              onActiveVersionChange={(versionId) =>
                                updateLineItem(activeOffer.id, item.id, { activeAiVersionId: versionId })
                              }
                            />
                          ))}
                          {!activeOffer.lineItems.length ? (
                            <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-3 text-xs text-sand-500">
                              Keine Leistungspositionen.
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-sand-200 bg-sand-100 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                            Materialpositionen
                          </p>
                          <span className="text-xs text-sand-500">
                            {activeOffer.deviceItems.filter((item) => !item?.optional).length} Positionen
                          </span>
                        </div>
                        <div className="grid gap-2">
                          {(activeOffer.deviceItems || []).map((item) => (
                            <DeviceCard
                              key={item.id}
                              item={item}
                              onUpdate={(patch) => updateDeviceItem(activeOffer.id, item.id, patch)}
                              onRemove={() => removeDeviceItem(activeOffer.id, item.id)}
                              onSaveAsBlock={saveDeviceItemAsBlock}
                              onAddImage={(image) => addDeviceImage(activeOffer.id, item.id, image)}
                              onRemoveImage={(imageId) => removeDeviceImage(activeOffer.id, item.id, imageId)}
                              onAddNote={(note) => addDeviceItemNote(activeOffer.id, item.id, note)}
                              onDeleteNote={(noteId) => deleteDeviceItemNote(activeOffer.id, item.id, noteId)}
                              onUpdateNote={(noteId, patch) =>
                                updateDeviceItemNote(activeOffer.id, item.id, noteId, patch)
                              }
                            />
                          ))}
                          {!activeOffer.deviceItems.length ? (
                            <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-3 text-sm text-sand-500">
                              Keine Materialpositionen hinterlegt.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="space-y-3 xl:col-span-2">
                  <section
                    ref={documentBuildRef}
                    className="rounded-3xl border border-sand-200 bg-white p-3 shadow-soft animate-fade-in"
                  >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                        Dokumentaufbau
                      </p>
                      <h2 className="text-base font-display text-sand-900">
                        Deckblatt & Abschnitte
                      </h2>
                      <p className="text-xs text-sand-600">
                        Struktur & optionale Bereiche.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-sand-700">
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
                      Deckblatt aktivieren
                    </label>
                  </div>
                  <div className="mt-2 space-y-2">
                    {activeOffer.coverEnabled ? (
                      <div className="space-y-2">
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
                          <div className="space-y-1">
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
                                className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-600"
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
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-sand-500">Kurzer Überblick zum Angebot</span>
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
                            className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-600"
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
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="min-w-[170px]">
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
                            className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-600"
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

                  <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-3 shadow-soft animate-fade-in">
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

                  <section className="rounded-3xl border border-sand-200 bg-white/90 backdrop-blur p-3 shadow-soft animate-fade-in">
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
                </div>
              </div>
              <UnitOptions />
            </>
          ) : (
            <section className="rounded-3xl border border-sand-200 bg-white p-3 shadow-soft text-sm text-sand-500">
              Kein Angebot ausgewählt.
            </section>
          )
        ) : mainTab === "status" ? (
      <section className="rounded-3xl border border-sand-200 bg-white p-3 shadow-soft animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
              Angebotsstatus
            </p>
            <h2 className="text-lg font-display text-sand-900">
              Offene & abgeschlossene Angebote
            </h2>
          </div>
          <button
            type="button"
            onClick={loadOffersFromServer}
            className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
          >
            Aktualisieren
          </button>
        </div>
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
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
                            updateOfferStatus(offer.id, "angenommen")
                          }
                          className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-600 hover:bg-emerald-50"
                          title="Akzeptieren"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateOfferStatus(offer.id, "abgelehnt")
                          }
                          className="rounded-full border border-rose-200 bg-white p-1 text-rose-600 hover:bg-rose-50"
                          title="Ablehnen"
                        >
                          <X size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteArchivedOffer(offer)}
                          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                          title="Löschen"
                        >
                          <Trash2 size={14} />
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
                        <button
                          type="button"
                          onClick={() => openOfferEmailComposerForOffer(offer)}
                          disabled={!offer.serverId}
                          className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            offer.serverId
                              ? "Angebot per E-Mail senden"
                              : "Bitte zuerst speichern"
                          }
                        >
                          <Send size={14} />
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

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3">
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
                          onClick={() => openHandoverModal(offer)}
                          disabled={sevdeskStatus[offer.serverId || offer.id]?.status === "sending"}
                          className="rounded-full border border-emerald-200 bg-white p-1 text-emerald-500 hover:bg-emerald-50 disabled:opacity-50"
                          title="Rechnungsentwurf in sevdesk"
                        >
                          <FilePlus size={14} />
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
                                disabled={sendStatus === "sending" || !offer.serverId}
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
                        {sevdeskStatus[offer.serverId || offer.id] ? (
                          <div className="mt-2 text-xs">
                            {sevdeskStatus[offer.serverId || offer.id].status === "sending" && (
                              <span className="text-emerald-700">Erstelle Rechnungsentwurf...</span>
                            )}
                            {sevdeskStatus[offer.serverId || offer.id].status === "sent" && (
                              <span className="text-emerald-700">
                                {sevdeskStatus[offer.serverId || offer.id].message}
                              </span>
                            )}
                            {sevdeskStatus[offer.serverId || offer.id].status === "error" && (
                              <span className="text-rose-600">
                                {sevdeskStatus[offer.serverId || offer.id].message}
                              </span>
                            )}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateOfferStatus(offer.id, "Entwurf")
                          }
                          disabled={offer.handoverLocked}
                          className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Wieder öffnen
                        </button>
                        {offer.handoverLocked ? (
                          <span className="text-[10px] uppercase tracking-wide text-sand-500">
                            an Faktura übergeben
                          </span>
                        ) : null}
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

          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3">
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
                              updateOfferStatus(offer.id, "Entwurf")
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
      <section className="rounded-3xl border border-sand-200 bg-white p-3 shadow-soft animate-fade-in">
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
                          {formatUnitQuantity(block.quantity ?? "", block.unit)}
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
                            <Field label="Preis (netto)">
                              <div className="relative">
                                <input
                                  className={priceInputClass}
                                  type="number"
                                  value={block.price ?? ""}
                                  onChange={(event) =>
                                    updateServiceBlock(block.id, {
                                      price: parseNumberInput(event.target.value)
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
                                value={block.quantity ?? ""}
                                disabled={block.unit === "flat"}
                                onChange={(event) =>
                                  updateServiceBlock(block.id, {
                                    quantity: parseNumberInput(event.target.value)
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
                          {block.product || block.title || "Materialbaustein"}
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
                      <div className="mt-3 space-y-2">
                        <div className="grid gap-2 md:grid-cols-2">
                          <Field label="Produkt">
                            <input
                              className={inputClass}
                              value={block.product ?? block.title ?? ""}
                              onChange={(event) =>
                                updateDeviceBlock(block.id, {
                                  product: event.target.value,
                                  title: event.target.value
                                })
                              }
                              placeholder={getDeviceProduct(block) || "Produkt"}
                            />
                          </Field>
                          <Field label="Preis (netto)">
                            <div className="relative">
                              <input
                                className={priceInputClass}
                                type="number"
                                value={block.price ?? ""}
                                onChange={(event) =>
                                  updateDeviceBlock(block.id, {
                                    price: parseNumberInput(event.target.value)
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
                              value={block.quantity ?? ""}
                              onChange={(event) =>
                                updateDeviceBlock(block.id, {
                                  quantity: parseNumberInput(event.target.value)
                                })
                              }
                            />
                          </Field>
                          <Field label="Abrechnung">
                            <SelectField
                              value={block.billingCycle || "once"}
                              onChange={(event) =>
                                updateDeviceBlock(block.id, {
                                  billingCycle: event.target.value
                                })
                              }
                            >
                              {billingCycleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </SelectField>
                          </Field>
                          <div className="md:col-span-2">
                            <Field label="Produktbeschreibung">
                              <textarea
                                className={noteTextareaClass}
                                value={block.description || ""}
                                onChange={(event) =>
                                  updateDeviceBlock(block.id, {
                                    description: event.target.value
                                  })
                                }
                                placeholder="Kurzbeschreibung zum Material"
                              />
                            </Field>
                          </div>
                          <div className="md:col-span-2">
                            <Field label="Bilder (URLs, eine pro Zeile)">
                              <textarea
                                className={noteTextareaClass}
                                value={(block.images || []).join("\n")}
                                onChange={(event) =>
                                  updateDeviceBlock(block.id, {
                                    images: event.target.value
                                      .split("\n")
                                      .map((line) => line.trim())
                                      .filter(Boolean)
                                  })
                                }
                                placeholder="https://…"
                              />
                              <div
                                className="mt-2 flex items-center justify-center rounded-2xl border border-dashed border-sand-200 bg-sand-50 px-4 py-6 text-[11px] uppercase tracking-[0.2em] text-sand-500"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={(event) => handleDeviceBlockDrop(event, block.id)}
                              >
                                Dateien hierher ziehen (Drag & Drop)
                              </div>
                              {(block.images || []).length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {block.images.map((url) => (
                                    <div
                                      key={url}
                                      className="relative h-20 w-28 overflow-hidden rounded-xl border border-sand-200 bg-white"
                                    >
                                      <img
                                        src={url}
                                        alt="Material"
                                        className="h-full w-full object-cover"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          updateDeviceBlock(block.id, {
                                            images: (block.images || []).filter((entry) => entry !== url)
                                          })
                                        }
                                        className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-sand-600 hover:bg-white"
                                        title="Entfernen"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </Field>
                          </div>
                          <div className="md:col-span-2">
                            <Field label="Interner Vermerk">
                              <textarea
                                className={noteTextareaClass}
                                value={block.internalNote || ""}
                                onChange={(event) =>
                                  updateDeviceBlock(block.id, {
                                    internalNote: event.target.value
                                  })
                                }
                                placeholder="Nur intern, wird nicht ausgegeben"
                              />
                            </Field>
                          </div>
                        </div>
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
    {importerOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                Materialimporter
              </p>
              <h3 className="text-lg font-display text-sand-900">
                Marketplace durchsuchen
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setImporterOpen(false)}
              className="rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
              title="Schließen"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-[0.6fr_1fr_auto] items-end">
            <Field label="Quelle">
              <SelectField
                value={importSource}
                onChange={(event) => setImportSource(event.target.value)}
              >
                <option value="all">Alle Quellen</option>
                {importSources.map((source) => (
                  <option key={source.source} value={source.source}>
                    {source.source}
                    {source.available ? "" : " (nicht aktiv)"}
                  </option>
                ))}
                <option value="icecat">
                  icecat
                  {icecatApiStatus.enabled && icecatApiStatus.hasToken
                    ? ""
                    : " (nicht aktiv)"}
                </option>
              </SelectField>
            </Field>
            <Field label="Suche">
              <input
                className={inputClass}
                value={importQuery}
                onChange={(event) => setImportQuery(event.target.value)}
                placeholder="Gerät, SKU oder Hersteller..."
              />
            </Field>
            <button
              type="button"
              onClick={runImporterSearch}
              disabled={!importQuery || importStatus === "loading"}
              className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-50"
            >
              {importStatus === "loading" ? "Suche..." : "Suchen"}
            </button>
          </div>
          {importSources.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-sand-600">
              {importSources.map((source) => (
                <span
                  key={`${source.source}-chip`}
                  className={`rounded-full border px-3 py-1 uppercase tracking-[0.2em] ${
                    source.available
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-sand-200 bg-white text-sand-500"
                  }`}
                >
                  {source.source}
                </span>
              ))}
            </div>
          ) : null}

          {importError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
              {importError}
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {importResults.length ? (
              importResults.map((item) => (
                <div
                  key={`${item.source}-${item.sku}`}
                  className="rounded-2xl border border-sand-200 bg-white px-3 py-3 text-sm text-sand-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-sand-900">
                      {item.title || item.sku}
                    </p>
                    <p className="text-xs text-sand-500">
                      {item.source ? `${item.source.toUpperCase()} · ` : ""}SKU {item.sku}
                      {item.currency ? ` · ${item.currency}` : ""}
                    </p>
                    {item.shortDescription ? (
                      <p className="mt-1 text-xs text-sand-600 line-clamp-2">
                        {item.shortDescription}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-sand-500">
                      <p>VK {formatMoney(item.recommendedVK ?? 0)}</p>
                      <p>
                        EK {formatMoney(item.ekMin ?? 0)}
                        {item.ekMax && item.ekMax !== item.ekMin
                          ? ` - ${formatMoney(item.ekMax)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addImportedItem(item)}
                      className="inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                    >
                      In Angebot übernehmen
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 p-4 text-sm text-sand-500">
                {importStatus === "loading"
                  ? "Suche läuft..."
                  : "Noch keine Ergebnisse."}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] text-sand-500">
            <div className="flex flex-wrap items-center gap-2">
              {["td_synnex", "also"].map((source) => {
                const info = importSources.find((item) => item.source === source);
                const available = Boolean(info?.available);
                return (
                  <span
                    key={`status-${source}`}
                    className={`rounded-full border px-2 py-1 ${
                      available
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-sand-200 bg-white text-sand-500"
                    }`}
                  >
                    {source}
                  </span>
                );
              })}
              <span
                className={`rounded-full border px-2 py-1 ${
                  icecatApiStatus.enabled && icecatApiStatus.hasToken
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-sand-200 bg-white text-sand-500"
                }`}
              >
                icecat
              </span>
            </div>
            <span>
              {importSourcesStatus.lastCheckAt
                ? `Stand: ${new Date(importSourcesStatus.lastCheckAt).toLocaleString("de-DE")}`
                : "Stand: n/a"}
            </span>
            {importSourcesStatus.error ? (
              <span className="text-rose-600">{importSourcesStatus.error}</span>
            ) : null}
            {icecatApiStatus.error ? (
              <span className="text-rose-600">{icecatApiStatus.error}</span>
            ) : null}
          </div>
        </div>
      </div>
    ) : null}
    {exportOffer ? (
      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        <OfferPreview offer={exportOffer} scale={1} containerRef={exportRef} mode={exportMode} />
      </div>
    ) : null}
    {emailExportOffer ? (
      <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
        <OfferPreview
          offer={emailExportOffer}
          scale={1}
          containerRef={emailPdfRef}
          mode={emailExportMode}
        />
      </div>
    ) : null}
  </main>
  <EmailComposerModal
    open={offerEmailModalOpen}
    title="Angebot per E-Mail senden"
    recipient={sendTo}
    subject={sendSubject || emailDefaultSubject || offerDefaultSubject}
    body={offerEmailBody}
    helperText={emailHelperText || "HTML wird gesendet, Plaintext wird automatisch erstellt."}
    trackingText={emailTrackingText}
    isSending={sendStatus === "sending"}
    onClose={closeOfferEmailComposer}
    onSend={handleOfferEmailSend}
    onRecipientChange={setSendTo}
    onSubjectChange={setSendSubject}
    onBodyChange={setOfferEmailBody}
    sendLabel="Senden"
  />
  <HandoverModal
    open={handoverModal.open}
    offer={offers.find((item) => item.id === handoverModal.offerId)}
    summary={handoverModal.summary}
    text={handoverModal.text}
    aiLoading={handoverModal.aiLoading}
    onClose={closeHandoverModal}
    onConfirm={handleHandoverConfirm}
    onTextChange={handleHandoverTextChange}
    onGenerateAi={handleHandoverAi}
  />
  <datalist id="offer-customers">
        {customerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
