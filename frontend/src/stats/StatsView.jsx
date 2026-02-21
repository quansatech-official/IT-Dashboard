import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, PhoneCall, ClipboardList, Receipt, Users } from "lucide-react";

const API = "/api";

const formatNumber = (value, options = {}) =>
  Number(value || 0).toLocaleString("de-DE", options);
const formatEur = (value) =>
  `€ ${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
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

const StatCard = ({ title, value, subtitle }) => (
  <div className="rounded-2xl border border-sand-200 bg-white p-3 shadow-soft">
    <p className="text-[9px] uppercase tracking-[0.28em] text-sand-500">{title}</p>
    <p className="text-lg font-metrics text-sand-900 mt-1.5">{value}</p>
    {subtitle ? <p className="text-[11px] text-sand-500 mt-1">{subtitle}</p> : null}
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

const customerTabs = [
  { key: "general", label: "Allgemein", icon: ClipboardList },
  { key: "telephony", label: "Telefonie", icon: PhoneCall },
  { key: "billing", label: "Faktura", icon: Receipt },
  { key: "reports", label: "Berichte", icon: FileText },
  { key: "customers", label: "Kunden", icon: Users }
];

export default function StatsView() {
  const [stats, setStats] = useState({});
  const [activeTab, setActiveTab] = useState("general");
  const [tabStatus, setTabStatus] = useState({});
  const [reloadTick, setReloadTick] = useState(0);
  const days = 30;

  useEffect(() => {
    const activeTabState = tabStatus[activeTab];
    if (activeTabState === "loading" || activeTabState === "ready") return;
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    setTabStatus((prev) => ({ ...prev, [activeTab]: "loading" }));
    fetch(`${API}/company_stats?days=${days}&section=${encodeURIComponent(activeTab)}`, {
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

  const currentStatus = tabStatus[activeTab] || "idle";

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
                  <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Aufgaben & Zeit</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Offen (Tagesplan)"
                    value={formatNumber(stats.dayTasks?.open ?? 0)}
                    subtitle={`Erledigt gesamt: ${formatNumber(stats.dayTasks?.done ?? 0)}`}
                  />
                  <StatCard
                    title="Erledigt heute"
                    value={formatNumber(stats.dayTasks?.doneToday ?? 0)}
                    subtitle="Abschlusszeit heute"
                  />
                  <StatCard
                    title="Erledigt diese Woche"
                    value={formatNumber(stats.dayTasks?.doneWeek ?? 0)}
                    subtitle="Seit Wochenstart"
                  />
                  <StatCard
                    title="Gesamt (Tagesplan)"
                    value={formatNumber(stats.dayTasks?.total ?? 0)}
                    subtitle="Alle Einträge"
                  />
                  <StatCard
                    title="Erfasste Zeit heute"
                    value={`${formatNumber(stats.timeTracking?.doneTodayHours ?? 0, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} h`}
                    subtitle="Basis: erledigte Aufgaben"
                  />
                  <StatCard
                    title="Erfasste Zeit Woche"
                    value={`${formatNumber(stats.timeTracking?.doneWeekHours ?? 0, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })} h`}
                    subtitle="Basis: erledigte Aufgaben"
                  />
                  <StatCard
                    title="Umsatzschätzung heute"
                    value={formatEur(stats.revenueEstimateTodayEur ?? 0)}
                    subtitle="Basis: erfasste Zeit erledigter Aufgaben"
                  />
                  <StatCard
                    title="Umsatzschätzung Woche"
                    value={formatEur(stats.revenueEstimateWeekEur ?? 0)}
                    subtitle="Basis: erfasste Zeit erledigter Aufgaben"
                  />
                </div>
              </section>
            ) : null}

            {activeTab === "telephony" ? (
              <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
                <div className="flex items-center gap-2 mb-3 text-sand-700">
                  <PhoneCall size={16} />
                  <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Telefonie ({days} Tage)</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard
                    title="Gesprächsminuten"
                    value={`${formatNumber(stats.telephony?.minutes ?? 0)} Min`}
                    subtitle="Summe Anrufe"
                  />
                  <StatCard
                    title="Verpasste Anrufe"
                    value={formatNumber(stats.telephony?.missed ?? 0)}
                    subtitle="Anrufe nicht beantwortet"
                  />
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
                        title="Umsatz gesamt"
                        value={formatEur(customerPaymentSummary.revenueTotalEur || 0)}
                        subtitle="Alle Jahre"
                      />
                      <StatCard
                        title="Umsatz lfd. Jahr"
                        value={formatEur(customerPaymentSummary.revenueCurrentYearEur || 0)}
                        subtitle="Aktuelles Jahr"
                      />
                      <StatCard
                        title="Umsatz Vorjahr"
                        value={formatEur(customerPaymentSummary.revenueLastYearEur || 0)}
                        subtitle="Vorjahr"
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
                            <th className="px-3 py-2">Kunde</th>
                            <th className="px-3 py-2">Klasse</th>
                            <th className="px-3 py-2">Umsatz gesamt</th>
                            <th className="px-3 py-2">Umsatz lfd.</th>
                            <th className="px-3 py-2">Umsatz Vorjahr</th>
                            <th className="px-3 py-2">Zahlungsmoral Historie</th>
                            <th className="px-3 py-2">Mahnungen</th>
                            <th className="px-3 py-2">Offen / überfällig</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerPaymentStats.length ? (
                            customerPaymentStats.map((item, index) => (
                              <tr key={`${item.contactId || item.name || "customer"}-${index}`} className="border-t border-sand-100">
                                <td className="px-3 py-2 text-sand-800">{item.name || "Unbekannt"}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${gradeBadgeClass(item.grade)}`}>
                                    {String(item.grade || "-")}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-sand-700">{formatEur(item.totalAmountEur || 0)}</td>
                                <td className="px-3 py-2 text-sand-700">{formatEur(item.revenueCurrentYearEur || 0)}</td>
                                <td className="px-3 py-2 text-sand-700">{formatEur(item.revenueLastYearEur || 0)}</td>
                                <td className="px-3 py-2 text-sand-700">
                                  Ø Zahlung: {formatDays(item.avgPaymentDays)}
                                  <div className="text-[10px] text-sand-400">
                                    Spät: {formatPercent(item.latePaidRatePct)} ({formatNumber(item.latePaidInvoices || 0)} / {formatNumber(item.paidInvoices || 0)})
                                  </div>
                                  <div className="text-[10px] text-sand-400">
                                    Sehr spät {'>'}30T: {formatNumber(item.veryLatePaidInvoices || 0)} · Zeitraum: {item.historyFrom || "-"} bis {item.historyTo || "-"}
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
