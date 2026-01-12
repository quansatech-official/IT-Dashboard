const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function CallStatsView({ stats }) {
  const periods = [
    { key: "today", label: "Heute" },
    { key: "last24h", label: "24 Stunden" },
    { key: "last7d", label: "Letzte 7 Tage" }
  ];

  const safeStats = stats || {};

  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Analytics</p>
          <h2 className="text-xl font-display">Call Statistik</h2>
        </div>
        <span className="text-xs text-sand-500">Zeitraeume</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {periods.map((period) => {
          const data = safeStats[period.key] || {
            total: 0,
            answered: 0,
            missed: 0,
            avgDuration: 0
          };
          return (
            <div key={period.key} className="border border-sand-200 rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500 mb-4">
                {period.label}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-sand-500">Gesamt</p>
                  <p className="text-2xl font-semibold">{data.total}</p>
                </div>
                <div>
                  <p className="text-xs text-sand-500">Beantwortet</p>
                  <p className="text-2xl font-semibold text-emerald-600">
                    {data.answered}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-sand-500">Verpasst</p>
                  <p className="text-2xl font-semibold text-rose-600">{data.missed}</p>
                </div>
                <div>
                  <p className="text-xs text-sand-500">Ø Dauer</p>
                  <p className="text-2xl font-semibold">
                    {formatDuration(data.avgDuration)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
