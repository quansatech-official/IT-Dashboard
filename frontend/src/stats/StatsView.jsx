import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, ClipboardList, Receipt, Users, Gauge, Wrench, Sigma } from "lucide-react";

const API = "/api";

const formatNumber = (value, options = {}) =>
  Number(value || 0).toLocaleString("de-DE", options);
const formatEur = (value) =>
  `€ ${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
const formatHours = (value) =>
  `${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} h`;
const formatDate = (value) => {
  if (!value) return "-";
  return new Date(Number(value)).toLocaleDateString("de-DE");
};
const formatMonthLabel = (year, month) =>
  new Date(year, month - 1, 1).toLocaleDateString("de-DE", {
    month: "short",
    year: "numeric"
  });
const formatDelta = (value) => {
  if (value === null || typeof value === "undefined") return "-";
  if (!value) return "±0";
  return `${value > 0 ? "+" : ""}${value}`;
};
const formatDays = (value) => {
  if (value === null || typeof value === "undefined") return "-";
  return `${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} Tage`;
};
const formatPercent = (value) => {
  if (value === null || typeof value === "undefined") return "-";
  return `${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
};
const formatHoursDelta = (value) => {
  const numeric = Number(value || 0);
  if (!numeric) return "0,00 h";
  const prefix = numeric > 0 ? "+" : "";
  return `${prefix}${formatNumber(numeric, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
};
const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const StatCard = ({ title, value, subtitle }) => (
  <div className="rounded-2xl border border-sand-200 bg-white p-3 shadow-soft">
    <p className="text-[9px] uppercase tracking-[0.28em] text-sand-500">{title}</p>
    <p className="text-lg font-metrics text-sand-900 mt-1.5">{value}</p>
    {subtitle ? <p className="text-[11px] text-sand-500 mt-1">{subtitle}</p> : null}
  </div>
);

const ContractMetricLine = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-1.5 text-[10px] text-sand-500">
    <Icon size={11} className="text-sand-400" />
    <span className="text-sand-400">{label}:</span>
    <span className="text-sand-700">{value}</span>
  </div>
);

const TopCustomerCard = ({ title, items }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const maxValue = Math.max(1, ...safeItems.map((item) => Number(item?.totalEur || 0)));
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-3 shadow-soft">
      <p className="text-[9px] uppercase tracking-[0.28em] text-sand-500">{title}</p>
      {safeItems.length ? (
        <div className="mt-2 space-y-2">
          {safeItems.map((item, index) => (
            <div key={`${title}-${item.name || "unknown"}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-sand-600">
                <span className="truncate pr-2">{item.name || "Unbekannt"}</span>
                <span className="font-metrics">{formatEur(item.totalEur || 0)}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-sand-100">
                <div
                  className="h-2 rounded-full bg-amber-400"
                  style={{
                    width: `${Math.max(6, (Number(item.totalEur || 0) / maxValue) * 100)}%`
                  }}
                />
              </div>
              <div className="text-[10px] text-sand-400">
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

const gradeBadgeClass = (grade) => {
  if (grade === "A") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (grade === "B") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
};
const contractStatusBadgeClass = (status) => {
  if (status === "proposal") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};
const contractStatusLabel = (status) => {
  if (status === "proposal") return "Vorschlag";
  if (status === "active") return "Aktiv";
  return "Unbekannt";
};
const contractTypeLabel = (type) => {
  if (type === "wartung") return "Wartung";
  if (type === "monitoring") return "Monitoring";
  if (type === "avv_dsgvo" || type === "avv") return "AVV";
  return "Vertrag";
};

const customerTabs = [
  { key: "general", label: "Allgemein", icon: ClipboardList },
  { key: "billing", label: "Faktura", icon: Receipt },
  { key: "reports", label: "Berichte", icon: FileText },
  { key: "contracts", label: "Verträge", icon: FileText },
  { key: "customers", label: "Kunden", icon: Users }
];

export default function StatsView() {
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState("general");
  const [tabStatus, setTabStatus] = useState({});
  const [reloadTick, setReloadTick] = useState(0);
  const [customerSort, setCustomerSort] = useState({ key: "businessWeight", direction: "desc" });
  const [contractsCustomerFilter, setContractsCustomerFilter] = useState("all");
  const days = 30;

  useEffect(() => {
    const activeTabState = tabStatus[activeTab];
    if (activeTabState === "loading" || activeTabState === "ready") return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setTabStatus((prev) => ({ ...prev, [activeTab]: "loading" }));
    const sectionParam = activeTab === "general" ? "" : `&section=${encodeURIComponent(activeTab)}`;
    fetch(`${API}/company_stats?days=${days}${sectionParam}`, {
      signal: controller.signal
    })
      .then((res) => {
        if (!res.ok) throw new Error("stats_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setStats((prev) => {
          const next = { ...prev, ...data };
          if (data?.sevdesk && typeof data.sevdesk === "object") {
            next.sevdesk = { ...(prev.sevdesk || {}), ...data.sevdesk };
          }
          return next;
        });
        setTabStatus((prev) => ({ ...prev, [activeTab]: "ready" }));
      })
      .catch(() => {
        if (!active) return;
        setTabStatus((prev) => ({ ...prev, [activeTab]: "error" }));
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [activeTab, days, reloadTick]);

  const percent = (part, total) => {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  };

  const reportMonthly = Array.isArray(stats?.reportsMonthly) ? stats.reportsMonthly : [];
  const customerPaymentStats = Array.isArray(stats?.sevdesk?.customerPaymentStats)
    ? stats.sevdesk.customerPaymentStats
    : [];
  const customerPaymentSummary =
    stats?.sevdesk?.customerPaymentSummary && typeof stats.sevdesk.customerPaymentSummary === "object"
      ? stats.sevdesk.customerPaymentSummary
      : {};
  const recurringTags =
    stats?.sevdesk?.recurringTagOverview && typeof stats.sevdesk.recurringTagOverview === "object"
      ? stats.sevdesk.recurringTagOverview
      : {};
  const recurringTagTotals = Array.isArray(recurringTags?.tagTotals) ? recurringTags.tagTotals : [];
  const recurringCustomerRows = Array.isArray(recurringTags?.customerRows) ? recurringTags.customerRows : [];
  const taskPerformance =
    stats?.taskPerformance && typeof stats.taskPerformance === "object" ? stats.taskPerformance : {};
  const taskPerformanceToday =
    taskPerformance?.today && typeof taskPerformance.today === "object" ? taskPerformance.today : {};
  const taskPerformanceWeek =
    taskPerformance?.week && typeof taskPerformance.week === "object" ? taskPerformance.week : {};
  const taskPerformanceWeekAverage =
    taskPerformanceWeek?.averagePerWorkday && typeof taskPerformanceWeek.averagePerWorkday === "object"
      ? taskPerformanceWeek.averagePerWorkday
      : {};
  const contracts =
    stats?.contracts && typeof stats.contracts === "object" ? stats.contracts : {};
  const contractMonthLabels =
    contracts?.monthLabels && typeof contracts.monthLabels === "object"
      ? contracts.monthLabels
      : { current: "Aktueller Monat", previous: "Vormonat" };
  const contractRows = Array.isArray(contracts?.rows) ? contracts.rows : [];
  const contractCustomerOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    contractRows.forEach((item) => {
      const id = Number(item?.customerId || 0);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const name = String(item?.customerName || "").trim() || `Kunde #${id}`;
      const number = String(item?.customerNumber || "").trim();
      options.push({ id, name, number });
    });
    options.sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
    return options;
  }, [contractRows]);
  useEffect(() => {
    if (contractsCustomerFilter === "all") return;
    const hasSelected = contractCustomerOptions.some(
      (entry) => String(entry.id) === String(contractsCustomerFilter)
    );
    if (!hasSelected) {
      setContractsCustomerFilter("all");
    }
  }, [contractsCustomerFilter, contractCustomerOptions]);
  const filteredContractRows = useMemo(() => {
    if (contractsCustomerFilter === "all") return contractRows;
    return contractRows.filter(
      (item) => String(item?.customerId || "") === String(contractsCustomerFilter)
    );
  }, [contractRows, contractsCustomerFilter]);
  const filteredContractSummary = useMemo(() => {
    const summary = {
      totalContracts: 0,
      customersWithContract: filteredContractRows.length,
      proposalContracts: 0,
      unpaidContracts: 0,
      invoicedContracts: 0,
      soll: 0,
      currentMonth: 0,
      previousMonth: 0,
      consumedCurrentMonth: 0,
      consumedPreviousMonth: 0,
      outsideCurrentMonth: 0,
      outsidePreviousMonth: 0,
      revenueMonthly: 0,
      revenueMonthlyActive: 0,
      deltaCurrentMonth: 0,
      deltaPreviousMonth: 0
    };
    filteredContractRows.forEach((item) => {
      const contractCount = Number(
        item?.contractCount ??
          (Array.isArray(item?.contracts) ? item.contracts.length : 0)
      );
      const unpaidCount =
        item?.unpaidContractCount !== undefined ? Number(item.unpaidContractCount || 0) : 0;
      const proposalCount =
        item?.proposalContractCount !== undefined
          ? Number(item.proposalContractCount || 0)
          : item?.contractStatus === "proposal"
            ? 1
            : 0;
      const invoicedCount =
        item?.invoicedContractCount !== undefined
          ? Number(item.invoicedContractCount || 0)
          : item?.contractStatus === "active"
            ? 1
            : 0;
      summary.totalContracts += contractCount;
      summary.unpaidContracts += unpaidCount;
      summary.proposalContracts += proposalCount;
      summary.invoicedContracts += invoicedCount;
      summary.soll += Number(item?.contractHoursSoll || 0);
      summary.currentMonth += Number(item?.contractHoursCurrentMonth || 0);
      summary.previousMonth += Number(item?.contractHoursPreviousMonth || 0);
      summary.consumedCurrentMonth += Number(item?.consumedHoursCurrentMonth || 0);
      summary.consumedPreviousMonth += Number(item?.consumedHoursPreviousMonth || 0);
      summary.outsideCurrentMonth += Number(item?.outsideContractHoursCurrentMonth || 0);
      summary.outsidePreviousMonth += Number(item?.outsideContractHoursPreviousMonth || 0);
      summary.revenueMonthly += Number(item?.contractRevenueMonthly || 0);
      summary.revenueMonthlyActive += Number(item?.contractRevenueMonthlyActive || 0);
      summary.deltaCurrentMonth += Number(item?.deltaHoursCurrentMonth || 0);
      summary.deltaPreviousMonth += Number(item?.deltaHoursPreviousMonth || 0);
    });
    return {
      ...summary,
      totalContracts: Math.max(0, Math.round(summary.totalContracts)),
      customersWithContract: Math.max(0, Math.round(summary.customersWithContract)),
      proposalContracts: Math.max(0, Math.round(summary.proposalContracts)),
      unpaidContracts: Math.max(0, Math.round(summary.unpaidContracts)),
      invoicedContracts: Math.max(0, Math.round(summary.invoicedContracts)),
      soll: round2(summary.soll),
      currentMonth: round2(summary.currentMonth),
      previousMonth: round2(summary.previousMonth),
      consumedCurrentMonth: round2(summary.consumedCurrentMonth),
      consumedPreviousMonth: round2(summary.consumedPreviousMonth),
      outsideCurrentMonth: round2(summary.outsideCurrentMonth),
      outsidePreviousMonth: round2(summary.outsidePreviousMonth),
      revenueMonthly: round2(summary.revenueMonthly),
      revenueMonthlyActive: round2(summary.revenueMonthlyActive),
      revenuePerContractMonthly:
        summary.totalContracts > 0 ? round2(summary.revenueMonthly / summary.totalContracts) : 0,
      deltaCurrentMonth: round2(summary.deltaCurrentMonth),
      deltaPreviousMonth: round2(summary.deltaPreviousMonth)
    };
  }, [filteredContractRows]);
  const contractDocumentRows = useMemo(
    () =>
      filteredContractRows.flatMap((item) =>
        Array.isArray(item?.contracts) ? item.contracts.filter((entry) => !entry?.inferred) : []
      ),
    [filteredContractRows]
  );
  const contractPipelineStats = useMemo(() => {
    const nowMs = Date.now();
    const renewalThresholdMs = nowMs + 45 * 24 * 60 * 60 * 1000;
    let proposal = 0;
    let active = 0;
    let dueSoon = 0;
    let missingHours = 0;
    contractDocumentRows.forEach((contract) => {
      const status = String(contract?.status || "").toLowerCase();
      if (status === "proposal") proposal += 1;
      if (status === "active") active += 1;
      const createdAt = Number(contract?.createdAt || 0);
      if (createdAt > 0) {
        const renewalAt = createdAt + 365 * 24 * 60 * 60 * 1000;
        if (renewalAt <= renewalThresholdMs) dueSoon += 1;
      }
      const type = String(contract?.type || "").toLowerCase();
      if ((type === "wartung" || type === "monitoring") && Number(contract?.monthlyHoursIncluded || 0) <= 0) {
        missingHours += 1;
      }
    });
    return { proposal, active, dueSoon, missingHours };
  }, [contractDocumentRows]);
  const leadershipKpis = useMemo(() => {
    const sevdesk = stats?.sevdesk || {};
    const customerSummary = sevdesk?.customerPaymentSummary || {};
    const reports = stats?.reports || {};
    const contractsRevenue = contracts?.revenue || {};
    const contractsHours = contracts?.hours || {};
    const customerPaymentRows = Array.isArray(sevdesk?.customerPaymentStats) ? sevdesk.customerPaymentStats : [];
    const churnRiskCustomers = customerPaymentRows.filter((entry) => String(entry?.grade || "").toUpperCase() === "C").length;
    const trendRevenueYear = Number(customerSummary.revenueCurrentYearEur || 0) - Number(customerSummary.revenueLastYearEur || 0);
    const trendSla = Number(contractsHours.deltaCurrentMonth || 0) - Number(contractsHours.deltaPreviousMonth || 0);
    const forecastMonthly =
      Number(contractsRevenue.monthlyActiveTotal || 0) + Number(stats?.revenueEstimateWeekEur || 0) * 4;
    const alerts = [];
    if (Number(sevdesk?.overdue?.count || 0) > 0) {
      alerts.push(`Faktura: ${formatNumber(sevdesk.overdue.count)} überfällige Rechnungen (${formatEur(sevdesk?.overdue?.sumEur || 0)}).`);
    }
    if (Number(contractsHours.deltaCurrentMonth || 0) > 0) {
      alerts.push(`SLA: ${formatHours(contractsHours.deltaCurrentMonth)} Überzug in laufenden Verträgen.`);
    }
    if (Number(reports.unread || 0) > 0) {
      alerts.push(`Kommunikation: ${formatNumber(reports.unread)} Berichte sind noch ungelesen.`);
    }
    const nextAction =
      Number(contractsHours.deltaCurrentMonth || 0) > 0
        ? "SLA-Überzug mit den 3 größten Delta-Kunden klären."
        : Number(sevdesk?.overdue?.count || 0) > 0
          ? "Überfällige Rechnungen priorisiert nachfassen."
          : "Keine kritische Abweichung. Fokus auf Forecast-Verbesserung.";
    return {
      cards: [
        {
          title: "Umsatz YTD (bezahlt)",
          value: formatEur(sevdesk?.paidCurrentYear?.sumEur || 0),
          subtitle: `Trend ggü. Vorjahr: ${formatEur(trendRevenueYear)}`
        },
        {
          title: "MRR (aktive Verträge)",
          value: formatEur(contractsRevenue.monthlyActiveTotal || 0),
          subtitle: "Owner: Stats"
        },
        {
          title: "Forecast Monatsumsatz",
          value: formatEur(forecastMonthly),
          subtitle: "MRR + Wochenhochrechnung"
        },
        {
          title: "Überfällige Rechnungen",
          value: formatNumber(sevdesk?.overdue?.count || 0),
          subtitle: formatEur(sevdesk?.overdue?.sumEur || 0)
        },
        {
          title: "SLA-Risiko (Monat)",
          value: formatHours(contractsHours.deltaCurrentMonth || 0),
          subtitle: `Trend: ${formatHoursDelta(trendSla)}`
        },
        {
          title: "Churn-Risiko Kunden",
          value: formatNumber(churnRiskCustomers),
          subtitle: "Klasse C (Zahlungsmoral)"
        },
        {
          title: "Berichte ungelesen",
          value: formatNumber(reports.unread || 0),
          subtitle: `Gesamt Berichte: ${formatNumber(reports.total || 0)}`
        }
      ],
      alerts,
      nextAction
    };
  }, [stats, contracts, contractPipelineStats]);
  const customerGradeCounts = useMemo(() => {
    const base = { A: 0, B: 0, C: 0 };
    customerPaymentStats.forEach((item) => {
      const grade = String(item?.grade || "").toUpperCase();
      if (base[grade] !== undefined) {
        base[grade] += 1;
      }
    });
    return base;
  }, [customerPaymentStats]);
  const sortedCustomerPaymentStats = useMemo(() => {
    const list = [...customerPaymentStats];
    const direction = customerSort.direction === "asc" ? 1 : -1;
    const key = customerSort.key;
    const valueFor = (item) => {
      switch (key) {
        case "name":
          return String(item?.name || "").toLowerCase();
        case "grade":
          return String(item?.grade || "Z");
        case "avgPaymentDays":
          return Number(item?.avgPaymentDays ?? Number.MAX_SAFE_INTEGER);
        case "latePaidRatePct":
          return Number(item?.latePaidRatePct ?? Number.MAX_SAFE_INTEGER);
        case "remindersTotal":
          return Number(item?.remindersTotal ?? 0);
        case "openOverdueInvoices":
          return Number(item?.openOverdueInvoices ?? item?.openInvoices ?? 0);
        case "revenueCurrentYearEur":
          return Number(item?.revenueCurrentYearEur ?? 0);
        case "revenueLastYearEur":
          return Number(item?.revenueLastYearEur ?? 0);
        case "totalAmountEur":
          return Number(item?.totalAmountEur ?? 0);
        default:
          return Number(item?.businessWeight ?? 0);
      }
    };
    list.sort((a, b) => {
      const av = valueFor(a);
      const bv = valueFor(b);
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv), "de", { sensitivity: "base" }) * direction;
      }
      return (Number(av) - Number(bv)) * direction;
    });
    return list;
  }, [customerPaymentStats, customerSort]);
  const topRecurringTags = useMemo(() => recurringTagTotals.slice(0, 8), [recurringTagTotals]);

  const currentStatus = tabStatus[activeTab] || "idle";
  const sortIndicator = (key) =>
    customerSort.key === key ? (customerSort.direction === "asc" ? "▲" : "▼") : "";
  const toggleCustomerSort = (key) => {
    setCustomerSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "desc" }
    );
  };

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Statistik</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-sand-500">
            <span>Betriebsintern</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-5 space-y-4">
        <section className="rounded-3xl border border-sand-200 bg-white p-2 shadow-soft">
          <div className="flex flex-wrap gap-2">
            {customerTabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-wide ${
                    active
                      ? "bg-sand-900 text-white"
                      : "border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
                  }`}
                >
                  <Icon size={12} /> {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {currentStatus === "loading" || currentStatus === "idle" ? (
          <div className="rounded-2xl border border-sand-200 bg-white p-3 text-sm text-sand-500 flex items-center gap-3">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-sand-300 border-t-transparent" />
            Kennzahlen laden...
          </div>
        ) : currentStatus === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600 flex items-center justify-between gap-3">
            <span>Kennzahlen konnten nicht geladen werden.</span>
            <button
              type="button"
              onClick={() => {
                setTabStatus((prev) => ({ ...prev, [activeTab]: "idle" }));
                setReloadTick((value) => value + 1);
              }}
              className="rounded-full border border-rose-300 bg-white px-3 py-1 text-[11px] uppercase tracking-wide text-rose-700 hover:bg-rose-100"
            >
              Erneut laden
            </button>
          </div>
        ) : (
          <>
            {activeTab === "general" ? (
              <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3 text-sand-700">
                  <ClipboardList size={16} />
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Führungs-Cockpit</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {leadershipKpis.cards.map((card) => (
                    <StatCard key={card.title} title={card.title} value={card.value} subtitle={card.subtitle} />
                  ))}
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Trends</p>
                    <div className="mt-2 space-y-1.5 text-[11px] text-sand-700">
                      <p>Umsatzschätzung heute: {formatEur(stats.revenueEstimateTodayEur ?? 0)}</p>
                      <p>Umsatzschätzung Woche: {formatEur(stats.revenueEstimateWeekEur ?? 0)}</p>
                      <p>
                        Vertragsdelta {contractMonthLabels.current}: {formatHoursDelta(filteredContractSummary.deltaCurrentMonth)}{" "}
                        ({contractMonthLabels.previous}: {formatHoursDelta(filteredContractSummary.deltaPreviousMonth)})
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Alerts & Nächste Aktion</p>
                    <div className="mt-2 space-y-1.5 text-[11px] text-sand-700">
                      {leadershipKpis.alerts.length ? (
                        leadershipKpis.alerts.map((entry, index) => <p key={`alert-${index}`}>• {entry}</p>)
                      ) : (
                        <p>• Keine kritischen Alerts.</p>
                      )}
                      <p className="pt-1 font-semibold text-sand-900">Nächste Aktion: {leadershipKpis.nextAction}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-700">Aufgaben-Leistung</p>
                      <p className="mt-1 text-[11px] text-sand-600">
                        Erledigte Aufgaben auf einen Blick, inklusive geschätztem Tages- und Wochenwert.
                      </p>
                    </div>
                    <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] text-emerald-700">
                      Stundenpreis: {formatEur(stats.hourlyRateEur ?? 0)}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-soft">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-700">Heute</p>
                      <p className="mt-2 text-2xl font-metrics text-emerald-900">
                        {formatEur(taskPerformanceToday.revenueEur ?? 0)}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Erledigt</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {formatNumber(taskPerformanceToday.doneCount ?? stats.dayTasks?.doneToday ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Stunden</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {formatHours(taskPerformanceToday.doneHours ?? stats.timeTracking?.doneTodayHours ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-soft">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-700">Diese Woche</p>
                      <p className="mt-2 text-2xl font-metrics text-emerald-900">
                        {formatEur(taskPerformanceWeek.revenueEur ?? 0)}
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Erledigt</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {formatNumber(taskPerformanceWeek.doneCount ?? stats.dayTasks?.doneWeek ?? 0)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Stunden</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {formatHours(taskPerformanceWeek.doneHours ?? stats.timeTracking?.doneWeekHours ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-soft">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-700">Ø pro Werktag</p>
                      <p className="mt-2 text-2xl font-metrics text-emerald-900">
                        {formatEur(taskPerformanceWeekAverage.revenueEur ?? 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-sand-500">
                        Basis: {formatNumber(taskPerformanceWeek.workdayCount ?? 0)} Werktage dieser Woche
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Erledigt</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {formatNumber(taskPerformanceWeekAverage.doneCount ?? 0, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 1
                            })}
                          </p>
                        </div>
                        <div className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-sand-500">Stunden</p>
                          <p className="text-sm font-semibold text-sand-900">
                            {formatHours(taskPerformanceWeekAverage.doneHours ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === "billing" ? (
              <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3 text-sand-700">
                  <Receipt size={16} />
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Faktura / sevdesk</p>
                </div>
                {!stats.sevdesk?.connected ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    {stats.sevdesk?.error
                      ? `Sevdesk nicht verbunden: ${stats.sevdesk.error}`
                      : "Sevdesk nicht verbunden."}
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCard
                        title="Entwurfsrechnungen"
                        value={formatNumber(stats.sevdesk?.drafts?.count ?? 0)}
                        subtitle={`Summe ${formatEur(stats.sevdesk?.drafts?.sumEur ?? 0)}`}
                      />
                      <StatCard
                        title="Fällige Rechnungen"
                        value={formatNumber(stats.sevdesk?.due?.count ?? 0)}
                        subtitle={`Summe ${formatEur(stats.sevdesk?.due?.sumEur ?? 0)}`}
                      />
                      <StatCard
                        title="Überfällige Rechnungen"
                        value={formatNumber(stats.sevdesk?.overdue?.count ?? 0)}
                        subtitle={`Summe ${formatEur(stats.sevdesk?.overdue?.sumEur ?? 0)}`}
                      />
                      <StatCard
                        title="Umsatz laufendes Jahr (bezahlt)"
                        value={formatEur(stats.sevdesk?.paidCurrentYear?.sumEur ?? 0)}
                        subtitle={`Rechnungen ${formatNumber(stats.sevdesk?.paidCurrentYear?.count ?? 0)}`}
                      />
                      <StatCard
                        title="Bezahlt (Monat)"
                        value={formatEur(stats.sevdesk?.paidCurrentMonth?.sumEur ?? 0)}
                        subtitle={`Rechnungen ${formatNumber(stats.sevdesk?.paidCurrentMonth?.count ?? 0)}`}
                      />
                      <StatCard
                        title="Bezahlt gesamt"
                        value={formatEur(stats.sevdesk?.paid?.sumEur ?? 0)}
                        subtitle={`Rechnungen ${formatNumber(stats.sevdesk?.paid?.count ?? 0)}`}
                      />
                      <StatCard
                        title="Ø Rechnungswert (bezahlt)"
                        value={formatEur(stats.sevdesk?.paidAverage?.sumEur ?? 0)}
                        subtitle="Ø aller bezahlten Rechnungen"
                      />
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <TopCustomerCard title="Top 5 Kunden - Dieser Monat" items={stats.sevdesk?.topCustomers?.thisMonth} />
                      <TopCustomerCard title="Top 5 Kunden - Letzte 6 Monate" items={stats.sevdesk?.topCustomers?.halfYear} />
                      <TopCustomerCard title="Top 5 Kunden - Aktuelles Jahr" items={stats.sevdesk?.topCustomers?.currentYear} />
                      <TopCustomerCard title="Top 5 Kunden - Letztes Jahr" items={stats.sevdesk?.topCustomers?.lastYear} />
                    </div>
                    <div className="mt-6 rounded-2xl border border-sand-200 bg-sand-50/70 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Wiederkehrende Rechnungen</p>
                          <p className="mt-1 text-[11px] text-sand-600">
                            Nur sevdesk: wiederkehrende Rechnungen je Kunde und Tag, auf Monatswert normalisiert.
                          </p>
                        </div>
                        <div className="text-[11px] text-sand-500">
                          Kunden: {formatNumber(recurringTags?.customersCount || 0)} · Vorlagen:{" "}
                          {formatNumber(recurringTags?.invoiceCount || 0)}
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                          title="Wiederkehrend / Monat"
                          value={formatEur(recurringTags?.monthlyTotalEur || 0)}
                          subtitle="Monatswert aus accountIntervall"
                        />
                        <StatCard
                          title="Kunden mit WKR"
                          value={formatNumber(recurringTags?.customersCount || 0)}
                          subtitle="mit mindestens einer wiederkehrenden Rechnung"
                        />
                        <StatCard
                          title="Tags"
                          value={formatNumber(recurringTags?.tagCount || 0)}
                          subtitle="sevdesk Tag-Namen"
                        />
                        <StatCard
                          title="Ohne Tag"
                          value={formatNumber(recurringTagTotals.reduce((sum, entry) => {
                            if (String(entry?.tagId || "").trim()) return sum;
                            return sum + Number(entry?.invoiceCount || 0);
                          }, 0))}
                          subtitle="Vorlagen ohne Tag"
                        />
                      </div>
                      <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_1.35fr]">
                        <div className="rounded-2xl border border-sand-200 bg-white p-3">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Nach Tag</p>
                          {topRecurringTags.length ? (
                            <div className="mt-2 space-y-2">
                              {topRecurringTags.map((entry) => (
                                <div key={entry.tagId || entry.tagName} className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-2">
                                  <div className="flex items-center justify-between gap-2 text-[11px] text-sand-700">
                                    <span>{entry.tagName || "Ohne Tag"}</span>
                                    <span className="font-metrics">{formatEur(entry.monthlyEur || 0)}</span>
                                  </div>
                                  <div className="mt-1 text-[10px] text-sand-400">
                                    {formatNumber(entry.invoiceCount || 0)} Vorlagen · {formatNumber(entry.customersCount || 0)} Kunden
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-[11px] text-sand-400">Noch keine wiederkehrenden Rechnungen in sevdesk gefunden.</p>
                          )}
                        </div>
                        <div className="rounded-2xl border border-sand-200 bg-white p-3">
                          <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">Alle Kunden</p>
                          <div className="mt-2 max-h-[24rem] overflow-auto rounded-xl border border-sand-100">
                            <table className="min-w-full text-left text-[11px]">
                              <thead className="sticky top-0 z-10 bg-sand-100 text-sand-600 uppercase tracking-wide">
                                <tr>
                                  <th className="px-2.5 py-1.5">Kunde</th>
                                  <th className="px-2.5 py-1.5">Tags</th>
                                  <th className="px-2.5 py-1.5">WKR</th>
                                  <th className="px-2.5 py-1.5">Gesamt / Monat</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recurringCustomerRows.length ? (
                                  recurringCustomerRows.map((row) => (
                                    <tr key={`recurring-cost-row-${row.contactId || row.customerName}`} className="border-t border-sand-100">
                                      <td className="px-2.5 py-1.5 align-top text-sand-800">
                                        <div className="max-w-[16rem] truncate font-medium whitespace-nowrap">
                                          {row.customerName || "Unbekannt"}
                                        </div>
                                      </td>
                                      <td className="px-2.5 py-1.5 align-top text-sand-700">
                                        <div className="flex flex-nowrap gap-1 overflow-hidden whitespace-nowrap">
                                          {(Array.isArray(row.tags) ? row.tags : []).slice(0, 4).map((entry) => (
                                            <span
                                              key={`${row.contactId || row.customerName}-${entry.tagId || entry.tagName}`}
                                              className="truncate rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] text-sand-600"
                                            >
                                              {entry.tagName}: {formatEur(entry.monthlyEur || 0)}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="px-2.5 py-1.5 align-top text-sand-700">{formatNumber(row.invoiceCount || 0)}</td>
                                      <td className="px-2.5 py-1.5 align-top text-sand-900 font-semibold">{formatEur(row.monthlyTotalEur || 0)}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={4} className="px-2.5 py-3 text-sand-500">
                                      Keine sevdesk-Tagauswertung vorhanden.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>
            ) : null}

            {activeTab === "reports" ? (
              <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3 text-sand-700">
                  <FileText size={16} />
                  <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Kundenbericht</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <StatCard title="Gesamt" value={stats.reports?.total ?? 0} />
                  <StatCard
                    title="Gesendet"
                    value={stats.reports?.sent ?? 0}
                    subtitle={percent(stats.reports?.sent ?? 0, stats.reports?.total ?? 0)}
                  />
                  <StatCard
                    title="Gelesen"
                    value={stats.reports?.opened ?? 0}
                    subtitle={percent(stats.reports?.opened ?? 0, stats.reports?.total ?? 0)}
                  />
                  <StatCard
                    title="Ungelesen"
                    value={stats.reports?.unread ?? 0}
                    subtitle={percent(stats.reports?.unread ?? 0, stats.reports?.total ?? 0)}
                  />
                  <StatCard
                    title="Bestätigt"
                    value={stats.reports?.confirmed ?? 0}
                    subtitle={percent(stats.reports?.confirmed ?? 0, stats.reports?.total ?? 0)}
                  />
                </div>
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500 mb-2">Berichte pro Monat</p>
                  {reportMonthly.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {reportMonthly.map((item, index) => {
                        const prev = reportMonthly[index - 1];
                        const deltaTotal = prev ? (item.total || 0) - (prev.total || 0) : null;
                        return (
                          <div
                            key={item.key || `${item.year}-${item.month}`}
                            className="rounded-2xl border border-sand-200 bg-white p-3 shadow-soft"
                          >
                            <p className="text-[10px] uppercase tracking-[0.28em] text-sand-500">
                              {formatMonthLabel(item.year, item.month)}
                            </p>
                            <p className="text-lg font-metrics text-sand-900 mt-1.5">
                              {formatNumber(item.total ?? 0)}
                            </p>
                            <p className="text-[11px] text-sand-500 mt-1">
                              Veränderung zum Vormonat: {formatDelta(deltaTotal)}
                            </p>
                            <div className="mt-2 text-[11px] text-sand-500 flex flex-wrap gap-x-3 gap-y-1">
                              <span>Gesendet: {formatNumber(item.sent ?? 0)}</span>
                              <span>Gelesen: {formatNumber(item.opened ?? 0)}</span>
                              <span>Bestätigt: {formatNumber(item.confirmed ?? 0)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-4 text-sm text-sand-500">
                      Keine Monatsdaten vorhanden.
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "contracts" ? (
              <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3 text-sand-700">
                  <FileText size={16} />
                  <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Verträge</p>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <label className="text-[11px] uppercase tracking-[0.22em] text-sand-500">Filter Kunde</label>
                  <select
                    value={contractsCustomerFilter}
                    onChange={(event) => setContractsCustomerFilter(event.target.value)}
                    className="h-8 rounded-lg border border-sand-200 bg-white px-2 text-xs text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  >
                    <option value="all">Alle Kunden</option>
                    {contractCustomerOptions.map((entry) => (
                      <option key={`contract-filter-${entry.id}`} value={String(entry.id)}>
                        {entry.name}
                        {entry.number ? ` (${entry.number})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Verträge gesamt"
                    value={formatNumber(filteredContractSummary.totalContracts)}
                    subtitle={`Kunden mit Vertrag: ${formatNumber(filteredContractSummary.customersWithContract)}`}
                  />
                  <StatCard
                    title="Vertragsvorschläge"
                    value={formatNumber(filteredContractSummary.proposalContracts)}
                    subtitle="Status Vorschlag"
                  />
                  <StatCard
                    title="Aktive Verträge"
                    value={formatNumber(filteredContractSummary.invoicedContracts)}
                    subtitle="Status Aktiv"
                  />
                  <StatCard
                    title="Vertragsstunden Soll"
                    value={formatHours(filteredContractSummary.soll)}
                    subtitle="Monatlich gesamt"
                  />
                  <StatCard
                    title="Vertragsumsatz pro Monat"
                    value={formatEur(filteredContractSummary.revenueMonthly)}
                    subtitle={`Aktive Verträge: ${formatEur(filteredContractSummary.revenueMonthlyActive)}`}
                  />
                  <StatCard
                    title="Verlängerung <= 45 Tage"
                    value={formatNumber(contractPipelineStats.dueSoon)}
                    subtitle="Referenz im Kundenstamm"
                  />
                  <StatCard
                    title="Tarifabweichung"
                    value={formatNumber(contractPipelineStats.missingHours)}
                    subtitle="Servicevertrag ohne Inklusivstunden"
                  />
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-sand-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-sand-100 text-sand-600 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2">Kunde</th>
                        <th className="px-3 py-2">Verträge</th>
                        <th className="px-3 py-2">Soll</th>
                        <th className="px-3 py-2">Akt. Monat</th>
                        <th className="px-3 py-2">Vormonat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContractRows.length ? (
                        filteredContractRows.map((item, index) => (
                          <tr
                            key={`${item.customerId || item.customerName || "contract-customer"}-${index}`}
                            className="border-t border-sand-100"
                          >
                            <td className="px-3 py-2 text-sand-800">
                              {item.customerName || "Unbekannt"}
                              <div className="text-[10px] text-sand-400">
                                {item.customerNumber || "Keine Kundennummer"}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sand-700">
                              {(() => {
                                const rowContracts = Array.isArray(item?.contracts) ? item.contracts : [];
                                if (!rowContracts.length) {
                                  return (
                                    <div className="text-[10px] text-sand-400">
                                      Keine hinterlegten Verträge
                                    </div>
                                  );
                                }
                                return (
                                  <div className="space-y-1.5">
                                    {rowContracts.map((contract, contractIndex) => (
                                      <div
                                        key={`contract-row-${item.customerId || "c"}-${
                                          contract.id || `contract-${contractIndex}`
                                        }`}
                                        className="rounded-lg border border-sand-200 bg-sand-50 px-2 py-1"
                                      >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span
                                            className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${contractStatusBadgeClass(
                                              contract.status
                                            )}`}
                                          >
                                            {contractStatusLabel(contract.status)}
                                          </span>
                                          <span className="inline-flex rounded-full border border-sand-300 bg-white px-2 py-0.5 font-semibold text-sand-600">
                                            {contractTypeLabel(contract.type)}
                                          </span>
                                          {contract.unpaidPayment ? (
                                            <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                              !
                                            </span>
                                          ) : null}
                                        </div>
                                        <div className="mt-1 text-[10px] text-sand-700">
                                          {contract.title || "Vertrag"}
                                        </div>
                                        <div className="text-[10px] text-sand-400">
                                          Inklusiv: {formatHours(contract.monthlyHoursIncluded || 0)}
                                        </div>
                                        <div className="text-[10px] text-sand-400">
                                          Wert/Monat: {formatEur(contract.monthlyValue || 0)}
                                        </div>
                                        <div className="text-[10px] text-sand-400">
                                          Verlängerung:{" "}
                                          {contract.createdAt
                                            ? formatDate(Number(contract.createdAt) + 365 * 24 * 60 * 60 * 1000)
                                            : "-"}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-2 text-sand-700">
                              {formatHours(item.contractHoursSoll ?? 0)}
                              <div className="text-[10px] text-sand-400">
                                Umsatz/Monat: {formatEur(item.contractRevenueMonthly ?? 0)}
                              </div>
                              <div className="text-[10px] text-sand-400">
                                je Vertrag: {formatEur(item.contractRevenuePerContractMonthly ?? 0)}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sand-700">
                              <div className="space-y-0.5">
                                <ContractMetricLine
                                  icon={FileText}
                                  label="Vertrag"
                                  value={formatHours(item.contractHoursCurrentMonth ?? 0)}
                                />
                                <ContractMetricLine
                                  icon={Gauge}
                                  label="Verbrauch"
                                  value={formatHours(item.consumedHoursCurrentMonth ?? 0)}
                                />
                                <ContractMetricLine
                                  icon={Wrench}
                                  label="Aufgaben · Telefonie"
                                  value={`${formatHours(item.taskHoursCurrentMonth ?? 0)} · ${formatHours(item.telephonyHoursCurrentMonth ?? 0)}`}
                                />
                                <ContractMetricLine
                                  icon={Sigma}
                                  label="Delta"
                                  value={formatHoursDelta(item.deltaHoursCurrentMonth ?? 0)}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-sand-700">
                              <div className="space-y-0.5">
                                <ContractMetricLine
                                  icon={FileText}
                                  label="Vertrag"
                                  value={formatHours(item.contractHoursPreviousMonth ?? 0)}
                                />
                                <ContractMetricLine
                                  icon={Gauge}
                                  label="Verbrauch"
                                  value={formatHours(item.consumedHoursPreviousMonth ?? 0)}
                                />
                                <ContractMetricLine
                                  icon={Wrench}
                                  label="Aufgaben · Telefonie"
                                  value={`${formatHours(item.taskHoursPreviousMonth ?? 0)} · ${formatHours(
                                    item.telephonyHoursPreviousMonth ?? 0
                                  )}`}
                                />
                                <ContractMetricLine
                                  icon={Sigma}
                                  label="Delta"
                                  value={formatHoursDelta(item.deltaHoursPreviousMonth ?? 0)}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-sand-500">
                            Keine Vertragsdaten vorhanden.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {activeTab === "customers" ? (
              <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3 text-sand-700">
                  <Users size={16} />
                  <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Kundenstatistik (A/B/C)</p>
                </div>
                {!stats.sevdesk?.connected ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Sevdesk nicht verbunden.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCard title="A-Kunden" value={formatNumber(customerGradeCounts.A)} subtitle="Zahlungsmoral stabil" />
                      <StatCard title="B-Kunden" value={formatNumber(customerGradeCounts.B)} subtitle="Beobachtung empfohlen" />
                      <StatCard title="C-Kunden" value={formatNumber(customerGradeCounts.C)} subtitle="Erhöhtes Risiko / Überfällig" />
                      <StatCard
                        title="Ø Offen (alle Kunden)"
                        value={formatDays(customerPaymentSummary.avgOpenAgeDays)}
                        subtitle="Gewichtet über alle offenen Rechnungen"
                      />
                      <StatCard
                        title="Ø Zahlung (Historie)"
                        value={formatDays(customerPaymentSummary.avgPaymentDays)}
                        subtitle="Über bezahlte Rechnungen"
                      />
                      <StatCard
                        title="Spätzahler-Quote"
                        value={formatPercent(customerPaymentSummary.latePaidRatePct)}
                        subtitle="Anteil >14 Tage"
                      />
                      <StatCard
                        title="Mahnungen (Historie)"
                        value={formatNumber(customerPaymentSummary.remindersTotal || 0)}
                        subtitle="Soweit vom Backend gemeldet"
                      />
                      <StatCard
                        title="Offen / überfällig"
                        value={formatNumber(customerPaymentSummary.openOverdueInvoices || 0)}
                        subtitle={formatEur(customerPaymentSummary.openOverdueAmountEur || 0)}
                      />
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-2xl border border-sand-200">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-sand-100 text-sand-600 uppercase tracking-wide">
                          <tr>
                            <th className="px-3 py-2">
                              <button type="button" onClick={() => toggleCustomerSort("name")} className="inline-flex items-center gap-1">
                                Kunde <span>{sortIndicator("name")}</span>
                              </button>
                            </th>
                            <th className="px-3 py-2">
                              <button type="button" onClick={() => toggleCustomerSort("grade")} className="inline-flex items-center gap-1">
                                Klasse <span>{sortIndicator("grade")}</span>
                              </button>
                            </th>
                            <th className="px-3 py-2">
                              <button type="button" onClick={() => toggleCustomerSort("avgPaymentDays")} className="inline-flex items-center gap-1">
                                Zahlungsmoral Historie <span>{sortIndicator("avgPaymentDays")}</span>
                              </button>
                            </th>
                            <th className="px-3 py-2">
                              <button type="button" onClick={() => toggleCustomerSort("remindersTotal")} className="inline-flex items-center gap-1">
                                Mahnungen <span>{sortIndicator("remindersTotal")}</span>
                              </button>
                            </th>
                            <th className="px-3 py-2">
                              <button type="button" onClick={() => toggleCustomerSort("openOverdueInvoices")} className="inline-flex items-center gap-1">
                                Offen / überfällig <span>{sortIndicator("openOverdueInvoices")}</span>
                              </button>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedCustomerPaymentStats.length ? (
                            sortedCustomerPaymentStats.map((item, index) => (
                              <tr key={`${item.contactId || item.name || "customer"}-${index}`} className="border-t border-sand-100">
                                <td className="px-3 py-2 text-sand-800">{item.name || "Unbekannt"}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${gradeBadgeClass(item.grade)}`}>
                                    {String(item.grade || "-")}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sand-700">
                                  Ø Zahlung: {formatDays(item.avgPaymentDays)}
                                  <div className="text-[10px] text-sand-400">
                                    Spät: {formatPercent(item.latePaidRatePct)} ({formatNumber(item.latePaidInvoices || 0)} / {formatNumber(item.paidInvoices || 0)})
                                  </div>
                                  <div className="text-[10px] text-sand-400">
                                    Sehr spät {'>'}30T: {formatNumber(item.veryLatePaidInvoices || 0)}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-sand-700">
                                  {formatNumber(item.remindersTotal || 0)}
                                  <div className="text-[10px] text-sand-400">Historisch</div>
                                </td>
                                <td className="px-3 py-2 text-sand-700">
                                  {formatNumber(item.openOverdueInvoices || item.openInvoices || 0)}
                                  <div className="text-[10px] text-sand-400">
                                    davon überfällig: {formatNumber(item.overdueInvoices || 0)} · {formatEur(item.openOverdueAmountEur || item.openAmountEur || 0)}
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="px-3 py-4 text-sand-500">
                                Keine Kunden-Zahlungsmoral vorhanden.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
