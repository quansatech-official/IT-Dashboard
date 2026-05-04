export const PERIOD_OPTIONS = [
  { key: "7", label: "7 Tage", days: 7 },
  { key: "30", label: "30 Tage", days: 30 },
  { key: "90", label: "90 Tage", days: 90 },
  { key: "365", label: "1 Jahr", days: 365 }
];
export const DEFAULT_PERIOD_KEY = "30";
export const FORECAST_WEEKS_PER_MONTH = 4;
export const STEERING_ROWS_LIMIT = 8;
export const RECURRING_TAGS_LIMIT = 8;

export const formatNumber = (value, options = {}) =>
  Number(value || 0).toLocaleString("de-DE", options);

export const formatEur = (value) =>
  `€ ${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

export const formatHours = (value) =>
  `${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} h`;

export const formatDate = (value) => {
  if (!value) return "-";
  return new Date(Number(value)).toLocaleDateString("de-DE");
};

export const formatMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("de-DE", {
    month: "short",
    year: "numeric"
  });

export const formatDelta = (value) => {
  if (value === null || typeof value === "undefined") return "-";
  if (!value) return "±0";
  return `${value > 0 ? "+" : ""}${value}`;
};

export const formatDays = (value) => {
  if (value === null || typeof value === "undefined") return "-";
  return `${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} Tage`;
};

export const formatPercent = (value) => {
  if (value === null || typeof value === "undefined") return "-";
  return `${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
};

export const formatHoursDelta = (value) => {
  const numeric = Number(value || 0);
  if (!numeric) return "0,00 h";
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${formatNumber(numeric, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
};

export const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

export const normalizeKey = (value) => String(value || "").trim().toLowerCase();

export const deltaValueClass = (value) => {
  const n = Number(value || 0);
  if (n > 0) return "text-rose-600 font-medium";
  if (n < 0) return "text-emerald-600";
  return "text-sand-500";
};

export const gradeBadgeClass = (grade) => {
  if (grade === "A") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (grade === "B") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
};

export const contractStatusBadgeClass = (status) => {
  if (status === "proposal") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

export const contractStatusLabel = (status) => {
  if (status === "proposal") return "Vorschlag";
  if (status === "active") return "Aktiv";
  return "Unbekannt";
};

export const contractTypeLabel = (type) => {
  if (type === "wartung") return "Wartung";
  if (type === "monitoring") return "Monitoring";
  if (type === "avv_dsgvo" || type === "avv") return "AVV";
  return "Vertrag";
};
