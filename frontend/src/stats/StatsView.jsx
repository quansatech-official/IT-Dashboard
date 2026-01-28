import { useEffect, useState } from "react";
import { BarChart3, FileText, PhoneCall, ClipboardList, Receipt } from "lucide-react";

const API = "/api";

const StatCard = ({ title, value, subtitle }) => (
  <div className="rounded-2xl border border-sand-200 bg-white p-3 shadow-soft">
    <p className="text-[9px] uppercase tracking-[0.28em] text-sand-500">{title}</p>
    <p className="text-lg font-display text-sand-900 mt-1.5">{value}</p>
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
                <span>{`€ ${Number(item.totalEur || 0).toFixed(2)}`}</span>
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
                {item.count || 0} Rechnungen
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

export default function StatsView() {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading");
  const days = 30;

  useEffect(() => {
    let active = true;
    fetch(`${API}/company_stats?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error("stats_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setStats(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [days]);

  const percent = (part, total) => {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
  };

  const formatEur = (value) => `€ ${Number(value || 0).toFixed(2)}`;

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
        {status === "loading" ? (
          <div className="rounded-2xl border border-sand-200 bg-white p-3 text-sm text-sand-500 flex items-center gap-3">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-sand-300 border-t-transparent" />
            Kennzahlen laden…
          </div>
        ) : status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
            Kennzahlen konnten nicht geladen werden.
          </div>
        ) : stats ? (
          <>
            <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-3 text-sand-700">
                <ClipboardList size={16} />
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Aufgaben & Zeit</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  title="Offen (Tagesplan)"
                  value={stats.dayTasks?.open ?? 0}
                  subtitle={`Erledigt gesamt: ${stats.dayTasks?.done ?? 0}`}
                />
                <StatCard
                  title="Erledigt heute"
                  value={stats.dayTasks?.doneToday ?? 0}
                  subtitle="Abschlusszeit heute"
                />
                <StatCard
                  title="Erledigt diese Woche"
                  value={stats.dayTasks?.doneWeek ?? 0}
                  subtitle="Seit Wochenstart"
                />
                <StatCard
                  title="Gesamt (Tagesplan)"
                  value={stats.dayTasks?.total ?? 0}
                  subtitle="Alle Einträge"
                />
                <StatCard
                  title="Erfasste Zeit heute"
                  value={`${Number(stats.timeTracking?.doneTodayHours ?? 0).toFixed(2)} h`}
                  subtitle="Basis: erledigte Aufgaben"
                />
                <StatCard
                  title="Erfasste Zeit Woche"
                  value={`${Number(stats.timeTracking?.doneWeekHours ?? 0).toFixed(2)} h`}
                  subtitle="Basis: erledigte Aufgaben"
                />
                <StatCard
                  title="Umsatzschätzung heute"
                  value={`€ ${Number(stats.revenueEstimateTodayEur ?? 0).toFixed(2)}`}
                  subtitle="Basis: erfasste Zeit erledigter Aufgaben"
                />
                <StatCard
                  title="Umsatzschätzung Woche"
                  value={`€ ${Number(stats.revenueEstimateWeekEur ?? 0).toFixed(2)}`}
                  subtitle="Basis: erfasste Zeit erledigter Aufgaben"
                />
              </div>
            </section>

            <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-3 text-sand-700">
                <Receipt size={16} />
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">
                  Faktura / sevdesk
                </p>
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
                      value={stats.sevdesk?.drafts?.count ?? 0}
                      subtitle={`Summe ${formatEur(stats.sevdesk?.drafts?.sumEur ?? 0)}`}
                    />
                    <StatCard
                      title="Fällige Rechnungen"
                      value={stats.sevdesk?.due?.count ?? 0}
                      subtitle={`Summe ${formatEur(stats.sevdesk?.due?.sumEur ?? 0)}`}
                    />
                    <StatCard
                      title="Überfällige Rechnungen"
                      value={stats.sevdesk?.overdue?.count ?? 0}
                      subtitle={`Summe ${formatEur(stats.sevdesk?.overdue?.sumEur ?? 0)}`}
                    />
                    <StatCard
                      title="Umsatz laufendes Jahr (bezahlt)"
                      value={formatEur(stats.sevdesk?.paidCurrentYear?.sumEur ?? 0)}
                      subtitle={`Rechnungen ${stats.sevdesk?.paidCurrentYear?.count ?? 0}`}
                    />
                    <StatCard
                      title="Bezahlt (Monat)"
                      value={formatEur(stats.sevdesk?.paidCurrentMonth?.sumEur ?? 0)}
                      subtitle={`Rechnungen ${stats.sevdesk?.paidCurrentMonth?.count ?? 0}`}
                    />
                    <StatCard
                      title="Bezahlt gesamt"
                      value={formatEur(stats.sevdesk?.paid?.sumEur ?? 0)}
                      subtitle={`Rechnungen ${stats.sevdesk?.paid?.count ?? 0}`}
                    />
                    <StatCard
                      title="Ø Rechnungswert (bezahlt)"
                      value={formatEur(stats.sevdesk?.paidAverage?.sumEur ?? 0)}
                      subtitle="Ø aller bezahlten Rechnungen"
                    />
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <TopCustomerCard
                      title="Top 5 Kunden · Dieser Monat"
                      items={stats.sevdesk?.topCustomers?.thisMonth}
                    />
                    <TopCustomerCard
                      title="Top 5 Kunden · Letzte 6 Monate"
                      items={stats.sevdesk?.topCustomers?.halfYear}
                    />
                    <TopCustomerCard
                      title="Top 5 Kunden · Aktuelles Jahr"
                      items={stats.sevdesk?.topCustomers?.currentYear}
                    />
                    <TopCustomerCard
                      title="Top 5 Kunden · Letztes Jahr"
                      items={stats.sevdesk?.topCustomers?.lastYear}
                    />
                  </div>
                </>
              )}
            </section>

            <section className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
              <div className="flex items-center gap-2 mb-3 text-sand-700">
                <PhoneCall size={16} />
                <p className="text-sm uppercase tracking-[0.3em] text-sand-500">
                  Telefonie ({days} Tage)
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard
                  title="Gesprächsminuten"
                  value={`${stats.telephony?.minutes ?? 0} Min`}
                  subtitle="Summe Anrufe"
                />
                <StatCard
                  title="Verpasste Anrufe"
                  value={stats.telephony?.missed ?? 0}
                  subtitle="Anrufe nicht beantwortet"
                />
              </div>
            </section>

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
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
