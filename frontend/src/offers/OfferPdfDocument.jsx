import { useEffect, useState } from "react";
import { Document, Page, Text, View, Image, StyleSheet, pdf, PDFViewer } from "@react-pdf/renderer";

const COLORS = {
  ink: "#1f2937",
  muted: "#6b7280",
  faint: "#9ca3af",
  hair: "#e5e7eb",
  panel: "#f9fafb",
  accent: "#b45309",
  accentSoft: "#fef3c7",
  positive: "#047857",
  danger: "#b91c1c"
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    lineHeight: 1.4
  },
  cover: {
    paddingTop: 96,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: COLORS.ink
  },
  brand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 0.6,
    borderBottomColor: COLORS.hair
  },
  brandTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", letterSpacing: 0.4 },
  kicker: {
    fontSize: 7.5,
    color: COLORS.faint,
    letterSpacing: 1.6,
    textTransform: "uppercase"
  },
  metaCol: { alignItems: "flex-end" },
  metaLabel: { fontSize: 7.5, color: COLORS.faint, letterSpacing: 1.4, textTransform: "uppercase" },
  metaValue: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 2 },
  senderLine: { fontSize: 7.5, color: COLORS.faint, marginBottom: 8 },
  recipient: { marginBottom: 28, lineHeight: 1.45 },
  recipientName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  docTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    marginBottom: 4
  },
  docMetaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 18,
    fontSize: 9,
    color: COLORS.muted
  },
  paragraph: { marginBottom: 8 },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: COLORS.accent
  },
  tableHead: {
    flexDirection: "row",
    paddingBottom: 4,
    borderBottomWidth: 0.8,
    borderBottomColor: COLORS.ink,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: COLORS.muted
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.4,
    borderBottomColor: COLORS.hair
  },
  rowOptional: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.4,
    borderBottomColor: COLORS.hair,
    backgroundColor: COLORS.panel
  },
  cellPos: { width: 28, fontSize: 9, color: COLORS.muted },
  cellDesc: { flex: 1, paddingRight: 8 },
  cellQty: { width: 60, textAlign: "right", fontSize: 9 },
  cellPrice: { width: 70, textAlign: "right", fontSize: 9 },
  cellTotal: { width: 72, textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold" },
  itemTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 1 },
  itemDesc: { fontSize: 8.5, color: COLORS.muted, marginTop: 1, lineHeight: 1.35 },
  itemMeta: { fontSize: 7.5, color: COLORS.faint, marginTop: 1, letterSpacing: 0.3 },
  optionalTag: {
    fontSize: 6.5,
    backgroundColor: COLORS.accentSoft,
    color: COLORS.accent,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    alignSelf: "flex-start",
    marginBottom: 2,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold"
  },
  discountNote: { fontSize: 7.5, color: COLORS.danger, marginTop: 1 },
  totalsBox: {
    marginTop: 16,
    padding: 12,
    borderWidth: 0.6,
    borderColor: COLORS.hair,
    backgroundColor: COLORS.panel
  },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: COLORS.muted, fontSize: 9.5 },
  totalsValue: { fontSize: 9.5 },
  totalsDivider: { marginTop: 6, paddingTop: 6, borderTopWidth: 0.6, borderTopColor: COLORS.hair },
  totalsGross: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.6,
    borderTopColor: COLORS.ink
  },
  totalsGrossLabel: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  totalsGrossValue: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  cycleBlock: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 0.4,
    borderTopColor: COLORS.hair
  },
  cycleLabel: {
    fontSize: 7.5,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: COLORS.faint,
    marginBottom: 4
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.faint,
    paddingTop: 8,
    borderTopWidth: 0.4,
    borderTopColor: COLORS.hair
  },
  attList: { marginTop: 12 },
  attItem: {
    paddingVertical: 4,
    borderBottomWidth: 0.4,
    borderBottomColor: COLORS.hair,
    fontSize: 9
  },
  photoPage: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.ink
  },
  photoBlock: {
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 0.4,
    borderBottomColor: COLORS.hair
  },
  photoBlockTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    color: COLORS.ink
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  photoCell: {
    borderWidth: 0.4,
    borderColor: COLORS.hair,
    backgroundColor: COLORS.panel,
    padding: 4,
    alignItems: "center",
    justifyContent: "center"
  },
  photoImage: {
    objectFit: "contain"
  },
  coverEyebrow: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 12
  },
  coverHeadline: { fontSize: 30, fontFamily: "Helvetica-Bold", letterSpacing: 0.5, marginBottom: 10 },
  coverSubheadline: { fontSize: 14, color: COLORS.muted, marginBottom: 30 },
  coverIntro: { fontSize: 11, color: COLORS.ink, lineHeight: 1.6, marginBottom: 40 },
  coverMeta: {
    marginTop: "auto",
    paddingTop: 16,
    borderTopWidth: 0.6,
    borderTopColor: COLORS.hair,
    flexDirection: "row",
    justifyContent: "space-between"
  }
});

const fmtMoney = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(number);
};

const fmtDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const unitLabels = {
  hours: "Std.",
  days: "Tage",
  weeks: "Wo.",
  month: "Monate",
  year: "Jahre",
  piece: "Stk.",
  flat: "Pauschal",
  user: "User",
  device: "Geräte",
  license: "Lizenzen",
  km: "km",
  m: "m",
  gb: "GB",
  tb: "TB"
};
const cycleLabels = { once: "Einmalig", monthly: "monatlich", yearly: "jährlich" };

const formatQty = (item) => {
  const qty = Number(item?.quantity || 0);
  const unit = unitLabels[item?.unit] || item?.unit || "";
  if (unit === "Pauschal") return "1 Pauschal";
  if (!unit) return String(qty);
  return `${qty.toLocaleString("de-DE")} ${unit}`;
};

const calcLineBase = (item) =>
  Number(item?.price || 0) * Number(item?.quantity || 0);

const calcLineDiscount = (item) => {
  const base = calcLineBase(item);
  const type = String(item?.discountType || "").toLowerCase();
  const value = Number(item?.discountValue || 0);
  if (!value) return 0;
  if (type === "percent") return base * (value / 100);
  return Math.min(base, value);
};

const calcLineNet = (item) => calcLineBase(item) - calcLineDiscount(item);

const calcOfferDiscount = (offer, net) => {
  const type = String(offer?.discountType || "").toLowerCase();
  const value = Number(offer?.discountValue || 0);
  if (!value) return 0;
  if (type === "percent") return net * (value / 100);
  return Math.min(net, value);
};

const calcVat = (net, offer) => {
  const rate = Number(offer?.vatRate ?? 20);
  if (offer?.vatMode === "none") return 0;
  return net * (rate / 100);
};

const cycleTotals = (offer) => {
  const totals = { once: 0, monthly: 0, yearly: 0 };
  [...(offer?.lineItems || []), ...(offer?.deviceItems || [])].forEach((item) => {
    if (item?.optional) return;
    const cycle = item?.billingCycle || "once";
    if (totals[cycle] === undefined) return;
    totals[cycle] += calcLineNet(item);
  });
  return totals;
};

const stripHtmlToParagraphs = (html) => {
  if (!html) return [];
  const decoded = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, " ").trim())
    .filter(Boolean);
};

const splitLines = (value) =>
  String(value || "")
    .split(/\r?\n|\s+-\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

function PositionRow({ item, index, category }) {
  const lineNet = calcLineNet(item);
  const lineDiscount = calcLineDiscount(item);
  const isOptional = Boolean(item?.optional);
  const title =
    category === "device"
      ? [item.manufacturer, item.product || item.title].filter(Boolean).join(" ")
      : item.title || "Position";
  const desc = String(item?.description || "").trim();
  const cycle = cycleLabels[item?.billingCycle] || "";
  return (
    <View style={isOptional ? styles.rowOptional : styles.row} wrap={false}>
      <Text style={styles.cellPos}>{isOptional ? "opt." : `${index}.`}</Text>
      <View style={styles.cellDesc}>
        {isOptional ? <Text style={styles.optionalTag}>Optional</Text> : null}
        <Text style={styles.itemTitle}>{title || "—"}</Text>
        {desc ? <Text style={styles.itemDesc}>{desc}</Text> : null}
        {cycle && cycle !== "Einmalig" ? (
          <Text style={styles.itemMeta}>Abrechnung: {cycle}</Text>
        ) : null}
      </View>
      <Text style={styles.cellQty}>{formatQty(item)}</Text>
      <Text style={styles.cellPrice}>{fmtMoney(item?.price)}</Text>
      <View style={styles.cellTotal}>
        <Text>{fmtMoney(lineNet)}</Text>
        {lineDiscount > 0 ? (
          <Text style={styles.discountNote}>−{fmtMoney(lineDiscount)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PositionsSection({ title, items, startIndex, category }) {
  if (!items.length) return null;
  return (
    <View>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.tableHead}>
        <Text style={styles.cellPos}>Pos.</Text>
        <Text style={styles.cellDesc}>Beschreibung</Text>
        <Text style={styles.cellQty}>Menge</Text>
        <Text style={styles.cellPrice}>Einzelpreis</Text>
        <Text style={styles.cellTotal}>Summe</Text>
      </View>
      {items.map((item, idx) => (
        <PositionRow
          key={item.id || `${category}-${idx}`}
          item={item}
          index={startIndex + idx}
          category={category}
        />
      ))}
    </View>
  );
}

function TotalsBox({ offer }) {
  const lineItems = offer?.lineItems || [];
  const deviceItems = offer?.deviceItems || [];
  const serviceTotal = lineItems.reduce(
    (sum, item) => sum + (item?.optional ? 0 : calcLineNet(item)),
    0
  );
  const deviceTotal = deviceItems.reduce(
    (sum, item) => sum + (item?.optional ? 0 : calcLineNet(item)),
    0
  );
  const optionalTotal = [...lineItems, ...deviceItems].reduce(
    (sum, item) => sum + (item?.optional ? calcLineNet(item) : 0),
    0
  );
  const subTotal = serviceTotal + deviceTotal;
  const offerDiscount = calcOfferDiscount(offer, subTotal);
  const net = subTotal - offerDiscount;
  const vat = calcVat(net, offer);
  const gross = net + vat;
  const vatRate = Number(offer?.vatRate ?? 20);
  const cycles = cycleTotals(offer);
  return (
    <View style={styles.totalsBox} wrap={false}>
      {serviceTotal > 0 ? (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Leistungen netto</Text>
          <Text style={styles.totalsValue}>{fmtMoney(serviceTotal)}</Text>
        </View>
      ) : null}
      {deviceTotal > 0 ? (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Material netto</Text>
          <Text style={styles.totalsValue}>{fmtMoney(deviceTotal)}</Text>
        </View>
      ) : null}
      <View style={styles.totalsDivider}>
        {offerDiscount > 0 ? (
          <>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Zwischensumme netto</Text>
              <Text style={styles.totalsValue}>{fmtMoney(subTotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={[styles.totalsLabel, { color: COLORS.danger }]}>Angebotsrabatt</Text>
              <Text style={[styles.totalsValue, { color: COLORS.danger }]}>
                −{fmtMoney(offerDiscount)}
              </Text>
            </View>
          </>
        ) : null}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalsLabel, { fontFamily: "Helvetica-Bold", color: COLORS.ink }]}>
            Gesamt netto
          </Text>
          <Text style={[styles.totalsValue, { fontFamily: "Helvetica-Bold" }]}>
            {fmtMoney(net)}
          </Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>
            zzgl. {vatRate}% USt
            {offer?.vatMode === "none" ? " (steuerfrei)" : ""}
          </Text>
          <Text style={styles.totalsValue}>{fmtMoney(vat)}</Text>
        </View>
      </View>
      <View style={styles.totalsGross}>
        <Text style={styles.totalsGrossLabel}>Gesamt brutto</Text>
        <Text style={styles.totalsGrossValue}>{fmtMoney(gross)}</Text>
      </View>
      {optionalTotal > 0 ? (
        <View style={styles.totalsRow}>
          <Text style={[styles.totalsLabel, { color: COLORS.muted, fontStyle: "italic" }]}>
            Optional (nicht enthalten)
          </Text>
          <Text style={[styles.totalsValue, { fontStyle: "italic" }]}>{fmtMoney(optionalTotal)}</Text>
        </View>
      ) : null}
      {cycles.monthly > 0 || cycles.yearly > 0 ? (
        <View style={styles.cycleBlock}>
          <Text style={styles.cycleLabel}>Laufende Kosten (netto)</Text>
          {cycles.monthly > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>monatlich</Text>
              <Text style={styles.totalsValue}>{fmtMoney(cycles.monthly)}</Text>
            </View>
          ) : null}
          {cycles.yearly > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>jährlich</Text>
              <Text style={styles.totalsValue}>{fmtMoney(cycles.yearly)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PageFooter({ offer }) {
  const senderLines = splitLines(offer?.senderLine);
  const senderShort = senderLines.join(" · ");
  return (
    <View style={styles.footer} fixed>
      <Text>{senderShort || "Quansatech GmbH"}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function PageHeader({ offer, mode }) {
  const isConfirmation = mode === "confirmation";
  return (
    <View style={styles.brand} fixed>
      <View>
        <Text style={styles.kicker}>{isConfirmation ? "Auftragsbestätigung" : "Angebot"}</Text>
        <Text style={styles.brandTitle}>
          {(splitLines(offer?.senderLine)[0]) || "Quansatech GmbH"}
        </Text>
      </View>
      <View style={styles.metaCol}>
        <Text style={styles.metaLabel}>Referenz</Text>
        <Text style={styles.metaValue}>{offer?.reference || "—"}</Text>
        <Text style={[styles.metaLabel, { marginTop: 4 }]}>Datum</Text>
        <Text style={styles.metaValue}>
          {fmtDate(offer?.sentAt || offer?.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function PhotoPage({ offer, mode, photoItems }) {
  const getCellSize = (count) => {
    if (count <= 1) return { width: 460, height: 320 };
    if (count === 2) return { width: 226, height: 240 };
    if (count <= 4) return { width: 226, height: 180 };
    return { width: 148, height: 140 };
  };
  return (
    <Page size="A4" style={styles.photoPage}>
      <PageHeader offer={offer} mode={mode} />
      <Text style={styles.sectionHeader}>Produktfotos</Text>
      {photoItems.map((entry) => {
        const cell = getCellSize(entry.images.length);
        return (
          <View key={entry.key} style={styles.photoBlock} wrap={false}>
            <Text style={styles.photoBlockTitle}>
              Pos. {entry.posIndex}: {entry.title}
            </Text>
            <View style={styles.photoGrid}>
              {entry.images.map((url, idx) => (
                <View
                  key={`${entry.key}-${idx}`}
                  style={[styles.photoCell, { width: cell.width, height: cell.height }]}
                >
                  <Image
                    src={url}
                    style={[
                      styles.photoImage,
                      { width: cell.width - 8, height: cell.height - 8 }
                    ]}
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}
      <PageFooter offer={offer} />
    </Page>
  );
}

function CoverPage({ offer, mode }) {
  const isConfirmation = mode === "confirmation";
  return (
    <Page size="A4" style={styles.cover}>
      <Text style={styles.coverEyebrow}>
        {isConfirmation ? "Auftragsbestätigung" : "Angebot"}
        {offer?.reference ? ` · ${offer.reference}` : ""}
      </Text>
      <Text style={styles.coverHeadline}>
        {offer?.coverHeadline || (isConfirmation ? "Auftragsbestätigung" : "Ihr Angebot")}
      </Text>
      {offer?.coverSubheadline ? (
        <Text style={styles.coverSubheadline}>{offer.coverSubheadline}</Text>
      ) : null}
      {offer?.coverIntro ? (
        <Text style={styles.coverIntro}>{offer.coverIntro}</Text>
      ) : null}
      <View style={styles.coverMeta}>
        <View>
          <Text style={styles.metaLabel}>Empfänger</Text>
          <Text style={[styles.metaValue, { fontSize: 12 }]}>
            {offer?.recipientCompany || offer?.recipientName || offer?.customer || "—"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.metaLabel}>Datum</Text>
          <Text style={[styles.metaValue, { fontSize: 12 }]}>
            {fmtDate(offer?.sentAt || offer?.createdAt)}
          </Text>
        </View>
      </View>
    </Page>
  );
}

export function OfferPdfDocument({ offer, mode = "offer" }) {
  if (!offer) return <Document />;
  const isConfirmation = mode === "confirmation";
  const lineItems = offer.lineItems || [];
  const deviceItems = offer.deviceItems || [];
  const recipientLines = [
    offer.recipientCompany,
    offer.recipientName,
    offer.recipientStreet,
    offer.recipientPostalCity,
    offer.recipientCountry
  ]
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const detailParagraphs = stripHtmlToParagraphs(offer.detailHtml);
  const calculationText = String(offer.calculationText || "").trim();
  const overviewText = String(offer.overviewText || "").trim();
  const attachments = (offer.attachments || []).filter(
    (item) => item?.title || item?.fileName || item?.url
  );
  const showCover = Boolean(
    offer.coverEnabled && (offer.coverHeadline || offer.coverSubheadline || offer.coverIntro)
  );
  const allItemsOrdered = [
    ...lineItems.map((item, idx) => ({
      item,
      key: item.id || `service-${idx}`,
      posIndex: idx + 1,
      title: item.title || "Position"
    })),
    ...deviceItems.map((item, idx) => ({
      item,
      key: item.id || `device-${idx}`,
      posIndex: lineItems.length + idx + 1,
      title:
        [item.manufacturer, item.product || item.title].filter(Boolean).join(" ") ||
        "Material"
    }))
  ];
  const photoItems = allItemsOrdered
    .map((entry) => {
      const images = Array.isArray(entry.item?.images)
        ? entry.item.images.filter((url) => typeof url === "string" && url)
        : [];
      return images.length ? { ...entry, images } : null;
    })
    .filter(Boolean);
  return (
    <Document
      title={`${isConfirmation ? "Auftragsbestätigung" : "Angebot"} ${offer.reference || ""}`.trim()}
      author={splitLines(offer.senderLine)[0] || "Quansatech"}
    >
      {showCover ? <CoverPage offer={offer} mode={mode} /> : null}
      <Page size="A4" style={styles.page}>
        <PageHeader offer={offer} mode={mode} />
        <Text style={styles.senderLine}>{(offer.senderLine || "").trim()}</Text>
        <View style={styles.recipient}>
          {recipientLines.length ? (
            recipientLines.map((line, idx) => (
              <Text
                key={idx}
                style={idx === 0 ? styles.recipientName : undefined}
              >
                {line}
              </Text>
            ))
          ) : (
            <Text style={{ color: COLORS.faint }}>Empfänger offen</Text>
          )}
        </View>
        <Text style={styles.docTitle}>
          {isConfirmation ? "Auftragsbestätigung" : "Angebot"}
          {offer.reference ? ` ${offer.reference}` : ""}
        </Text>
        <View style={styles.docMetaRow}>
          {offer.customerNumber ? <Text>Kundennr. {offer.customerNumber}</Text> : null}
          {offer.orderNumber ? <Text>Auftragsnr. {offer.orderNumber}</Text> : null}
          <Text>Datum {fmtDate(offer.sentAt || offer.createdAt) || "—"}</Text>
        </View>
        {offer.salutation ? <Text style={styles.paragraph}>{offer.salutation}</Text> : null}
        {offer.introText ? <Text style={styles.paragraph}>{offer.introText}</Text> : null}
        {overviewText ? <Text style={styles.paragraph}>{overviewText}</Text> : null}

        <PositionsSection
          title="Leistungen"
          items={lineItems}
          startIndex={1}
          category="service"
        />
        <PositionsSection
          title="Material"
          items={deviceItems}
          startIndex={lineItems.length + 1}
          category="device"
        />

        <TotalsBox offer={offer} />

        {calculationText ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionHeader}>Kalkulation & Konditionen</Text>
            {calculationText.split(/\n+/).filter(Boolean).map((line, idx) => (
              <Text key={idx} style={styles.paragraph}>{line}</Text>
            ))}
          </View>
        ) : null}

        {detailParagraphs.length ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.sectionHeader}>Details</Text>
            {detailParagraphs.map((para, idx) => (
              <Text key={idx} style={styles.paragraph}>{para}</Text>
            ))}
          </View>
        ) : null}

        {attachments.length ? (
          <View style={styles.attList} wrap={false}>
            <Text style={styles.sectionHeader}>Beilagen</Text>
            {attachments.map((item, idx) => (
              <Text key={item.id || idx} style={styles.attItem}>
                {item.title || item.fileName || item.url}
              </Text>
            ))}
          </View>
        ) : null}

        <PageFooter offer={offer} />
      </Page>
      {photoItems.length ? (
        <PhotoPage offer={offer} mode={mode} photoItems={photoItems} />
      ) : null}
    </Document>
  );
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read_failed"));
    reader.readAsDataURL(blob);
  });

const inlineBlobUrl = async (url, cache) => {
  if (typeof url !== "string" || !url) return url;
  if (!url.startsWith("blob:")) return url;
  if (cache.has(url)) return cache.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch_failed");
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    cache.set(url, dataUrl);
    return dataUrl;
  } catch (error) {
    cache.set(url, "");
    return "";
  }
};

const inlineItemImages = async (item, cache) => {
  if (!item || !Array.isArray(item.images) || !item.images.length) return item;
  const resolved = await Promise.all(item.images.map((url) => inlineBlobUrl(url, cache)));
  return { ...item, images: resolved.filter(Boolean) };
};

const prepareOfferForPdf = async (offer) => {
  if (!offer) return offer;
  const cache = new Map();
  const lineItems = await Promise.all(
    (offer.lineItems || []).map((item) => inlineItemImages(item, cache))
  );
  const deviceItems = await Promise.all(
    (offer.deviceItems || []).map((item) => inlineItemImages(item, cache))
  );
  return { ...offer, lineItems, deviceItems };
};

export const buildOfferPdfBlob = async (offer, mode = "offer") => {
  const prepared = await prepareOfferForPdf(offer);
  return pdf(<OfferPdfDocument offer={prepared} mode={mode} />).toBlob();
};

export function OfferPdfPreview({ offer, mode = "offer", style }) {
  const [prepared, setPrepared] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setPrepared(null);
    prepareOfferForPdf(offer)
      .then((next) => {
        if (!cancelled) setPrepared(next);
      })
      .catch(() => {
        if (!cancelled) setPrepared(offer);
      });
    return () => {
      cancelled = true;
    };
  }, [offer]);
  if (!prepared) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: 13
        }}
      >
        PDF wird vorbereitet …
      </div>
    );
  }
  return (
    <PDFViewer showToolbar style={style || { width: "100%", height: "100%", border: "none" }}>
      <OfferPdfDocument offer={prepared} mode={mode} />
    </PDFViewer>
  );
}

export default OfferPdfDocument;
