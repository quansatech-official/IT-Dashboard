import { formatEur, formatNumber } from "./statsUtils";

const getBarPercent = (value, maxValue) => {
  const numericValue = Number(value || 0);
  const numericMax = Number(maxValue || 0);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericMax) || numericValue <= 0 || numericMax <= 0) return 0;
  return Math.min(100, Math.max(6, (numericValue / numericMax) * 100));
};

export const Sparkline = ({ values = [], stroke = "#0284c7", height = 24, width = 80 }) => {
  const points = Array.isArray(values) ? values.filter((v) => Number.isFinite(Number(v))) : [];
  if (points.length < 2) return <span className="text-[10px] text-sand-300">—</span>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  const last = points[points.length - 1];
  const lastY = height - ((last - min) / range) * height;
  const trendUp = points[points.length - 1] >= points[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={trendUp ? stroke : "#dc2626"}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={(points.length - 1) * step} cy={lastY} r="2" fill={trendUp ? stroke : "#dc2626"} />
    </svg>
  );
};

export const StatCard = ({ title, value, subtitle, valueClassName, className, sparkline, trend, onClick, comparisonValue }) => {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-sand-200 bg-white p-3 shadow-soft text-left w-full ${onClick ? "transition hover:border-sand-400 hover:shadow-md cursor-pointer" : ""} ${className || ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.2em] font-medium text-sand-500">{title}</p>
        {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} /> : null}
      </div>
      <p className={`text-xl font-metrics mt-1.5 ${valueClassName || "text-sand-900"}`}>{value}</p>
      {subtitle || trend || comparisonValue ? (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-sand-500">
          {trend ? (
            <span className={trend.tone === "up" ? "text-emerald-600" : trend.tone === "down" ? "text-rose-600" : "text-sand-500"}>
              {trend.label}
            </span>
          ) : null}
          {subtitle ? <span>{subtitle}</span> : null}
          {comparisonValue ? <span className="text-sand-400">vs. {comparisonValue}</span> : null}
        </div>
      ) : null}
    </Wrapper>
  );
};

export const ContractMetricLine = ({ icon: Icon, label, value, valueClassName }) => (
  <div className="flex items-center gap-1.5 text-[11px] text-sand-500">
    <Icon size={11} className="text-sand-400 shrink-0" />
    <span className="text-sand-400 shrink-0">{label}:</span>
    <span className={valueClassName || "text-sand-700"}>{value}</span>
  </div>
);

export const TopCustomerCard = ({ title, items }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const maxValue = Math.max(1, ...safeItems.map((item) => Number(item?.totalEur || 0)));
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-3 shadow-soft">
      <p className="text-[11px] uppercase tracking-[0.18em] font-medium text-sand-500">{title}</p>
      {safeItems.length ? (
        <div className="mt-2 space-y-2">
          {safeItems.map((item, index) => (
            <div key={`${title}-${item.name || "unknown"}-${index}`} className="space-y-1">
              <div className="flex min-w-0 items-center gap-2 text-[11px]">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sand-100 text-[10px] font-bold text-sand-500">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sand-700">{item.name || "Unbekannt"}</span>
                <span className="shrink-0 font-metrics font-semibold text-sand-900">{formatEur(item.totalEur || 0)}</span>
              </div>
              <div className="pl-6">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-100">
                  <div
                    className="h-1.5 rounded-full bg-[var(--nav-accent)]"
                    style={{
                      width: `${getBarPercent(item.totalEur, maxValue)}%`
                    }}
                  />
                </div>
              </div>
              <div className="text-[11px] text-sand-400 pl-6">
                {formatNumber(item.count || 0)} Rechnungen
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-sand-400">Keine Daten vorhanden.</p>
      )}
    </div>
  );
};
