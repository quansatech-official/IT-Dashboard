import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatEur, formatNumber, formatHours, formatPercent, formatDays } from "./statsUtils";

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const escapeCsvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const rowsToCsv = (rows) =>
  rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");

export const exportStatsAsCsv = (stats, activeTab, periodLabel) => {
  const today = new Date().toLocaleDateString("de-DE");
  const sevdesk = stats?.sevdesk || {};
  const contracts = stats?.contracts || {};
  const reports = stats?.reports || {};
  const taskPerformance = stats?.taskPerformance || {};
  const customerPaymentStats = Array.isArray(sevdesk?.customerPaymentStats) ? sevdesk.customerPaymentStats : [];

  const sections = [];
  sections.push([
    [`Statistik-Export ${today}`],
    [`Zeitraum: ${periodLabel}`],
    [`Aktiver Tab: ${activeTab}`],
    []
  ]);

  sections.push([
    ["Führungs-Cockpit"],
    ["Kennzahl", "Wert"],
    ["Umsatz YTD (bezahlt)", formatEur(sevdesk?.paidCurrentYear?.sumEur || 0)],
    ["MRR (aktive Verträge)", formatEur(contracts?.revenue?.monthlyActiveTotal || 0)],
    ["Überfällige Rechnungen (Anzahl)", formatNumber(sevdesk?.overdue?.count || 0)],
    ["Überfällige Rechnungen (Summe)", formatEur(sevdesk?.overdue?.sumEur || 0)],
    ["SLA-Risiko (Monat)", formatHours(contracts?.hours?.deltaCurrentMonth || 0)],
    ["Berichte offen", formatNumber(reports?.open || 0)],
    []
  ]);

  if (taskPerformance?.today || taskPerformance?.week) {
    sections.push([
      ["Aufgaben-Leistung"],
      ["Zeitraum", "Erledigt", "Stunden", "Umsatz"],
      [
        "Heute",
        formatNumber(taskPerformance?.today?.doneCount || 0),
        formatHours(taskPerformance?.today?.doneHours || 0),
        formatEur(taskPerformance?.today?.revenueEur || 0)
      ],
      [
        "Diese Woche",
        formatNumber(taskPerformance?.week?.doneCount || 0),
        formatHours(taskPerformance?.week?.doneHours || 0),
        formatEur(taskPerformance?.week?.revenueEur || 0)
      ],
      []
    ]);
  }

  if (customerPaymentStats.length) {
    const header = [
      "Kunde",
      "Kundennummer",
      "Klasse",
      "Umsatz lfd. Jahr",
      "Umsatz Vorjahr",
      "Ø Zahlungsdauer",
      "Quote spät bezahlt",
      "Mahnungen gesamt",
      "Offen/überfällig"
    ];
    const rows = customerPaymentStats.map((row) => [
      row?.name || "",
      row?.customerNumber || "",
      row?.grade || "",
      formatEur(row?.revenueCurrentYearEur || 0),
      formatEur(row?.revenueLastYearEur || 0),
      formatDays(row?.avgPaymentDays),
      formatPercent(row?.latePaidRatePct),
      formatNumber(row?.remindersTotal || 0),
      formatNumber(row?.openOverdueInvoices || row?.openInvoices || 0)
    ]);
    sections.push([["Kunden (Zahlungsmoral)"], header, ...rows, []]);
  }

  if (Array.isArray(contracts?.rows) && contracts.rows.length) {
    const header = ["Kunde", "Vertrag", "Typ", "Status", "Stunden geleistet", "Stunden vereinbart", "Delta"];
    const rows = contracts.rows.map((row) => [
      row?.customerName || "",
      row?.title || "",
      row?.type || "",
      row?.status || "",
      formatHours(row?.hoursDone || 0),
      formatHours(row?.hoursAgreed || 0),
      formatHours(row?.hoursDelta || 0)
    ]);
    sections.push([["Verträge"], header, ...rows, []]);
  }

  const flat = sections.flat();
  const csv = "﻿" + rowsToCsv(flat);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `statistik-${activeTab}-${today.replace(/\./g, "-")}.csv`);
};

export const exportStatsAsPdf = async (containerEl, activeTab) => {
  if (!containerEl) return;
  const canvas = await html2canvas(containerEl, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#f8fafc",
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
  let remaining = imgHeight - pageHeight;
  while (remaining > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
    remaining -= pageHeight;
  }
  const today = new Date().toLocaleDateString("de-DE").replace(/\./g, "-");
  pdf.save(`statistik-${activeTab}-${today}.pdf`);
};
