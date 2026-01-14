import { useEffect, useState } from "react";
import { BarChart3, FileText, PhoneCall, ClipboardList } from "lucide-react";

const API = "/api";

const StatCard = ({ title, value, subtitle }) => (
  <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-soft">
    <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">{title}</p>
    <p className="text-2xl font-display text-sand-900 mt-2">{value}</p>
    {subtitle ? <p className="text-xs text-sand-500 mt-1">{subtitle}</p> : null}
  </div>
);

export default function StatsView() {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading");
  const [days, setDays] = useState(30);

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

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
              <BarChart3 size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-2xl font-display text-sand-900">Statistik</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-sand-500">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600"
            >
              <option value={7}>7 Tage</option>
              <option value={30}>30 Tage</option>
              <option value={90}>90 Tage</option>
            </select>
            <span>Betriebsintern</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {status === "loading" ? (
          <div className="rounded-2xl border border-sand-200 bg-white p-4 text-sm text-sand-500">
            Kennzahlen laden…
          </div>
        ) : status === "error" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            Kennzahlen konnten nicht geladen werden.
          </div>
        ) : stats ? (
          <>
            <section className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2 mb-4 text-sand-700">
                <ClipboardList size={16} />
                <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Aufgaben</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  title="Tagesplan offen"
                  value={stats.dayTasks?.open ?? 0}
                  subtitle={`Erledigt: ${stats.dayTasks?.done ?? 0}`}
                />
                <StatCard
                  title="Tagesplan gesamt"
                  value={stats.dayTasks?.total ?? 0}
                  subtitle="Alle Eintrage"
                />
                <StatCard
                  title="Umsatzschatzung"
                  value={`€ ${Number(stats.revenueEstimateEur ?? 0).toFixed(2)}`}
                  subtitle={`Stundensatz: € ${Number(stats.hourlyRateEur ?? 0).toFixed(2)}`}
                />
              </div>
            </section>

            <section className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2 mb-4 text-sand-700">
                <PhoneCall size={16} />
                <p className="text-sm uppercase tracking-[0.3em] text-sand-500">
                  Telefonie ({days} Tage)
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
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

            <section className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="flex items-center gap-2 mb-4 text-sand-700">
                <FileText size={16} />
                <p className="text-sm uppercase tracking-[0.3em] text-sand-500">Kundenbericht</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
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
                  title="Bestatigt"
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
