const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const formatDurationHms = (seconds) => {
  if (!seconds) return "0:00:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

export default function CallStatsView({ stats }) {
  const periods = [
    { key: "today", label: "Heute" },
    { key: "last24h", label: "24 Stunden" },
    { key: "last7d", label: "Letzte 7 Tage" }
  ];

  const safeStats = stats || {};
  const extensionStats = safeStats.byExtension || [];

  const renderBreakdown = (title, rows) => (
    <div className="border border-sand-200 rounded-2xl p-3">
      <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500 mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-sand-500">Keine Daten vorhanden.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-sand-500 border-b border-sand-200">
              <tr>
                <th className="text-left py-2">Name</th>
                <th className="text-left py-2">Gesamt</th>
                <th className="text-left py-2">Beantwortet</th>
                <th className="text-left py-2">Verpasst</th>
                <th className="text-left py-2">Ø Dauer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-sand-100">
                  <td className="py-1.5">{row.key}</td>
                  <td className="py-1.5">{row.total}</td>
                  <td className="py-1.5 text-emerald-600">{row.answered}</td>
                  <td className="py-1.5 text-rose-600">{row.missed}</td>
                  <td className="py-1.5">{formatDuration(row.avgDuration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-4 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Analytics</p>
          <h2 className="text-lg font-display">Call Statistik</h2>
        </div>
        <span className="text-[10px] text-sand-500">Zeitraeume</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {periods.map((period) => {
          const data = safeStats[period.key] || {
            total: 0,
            answered: 0,
            missed: 0,
            avgDuration: 0
          };
          return (
            <div key={period.key} className="border border-sand-200 rounded-2xl p-3">
              <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500 mb-3">
                {period.label}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-sand-500">Gesamt</p>
                  <p className="text-xl font-semibold">{data.total}</p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Beantwortet</p>
                  <p className="text-xl font-semibold text-emerald-600">
                    {data.answered}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Verpasst</p>
                  <p className="text-xl font-semibold text-rose-600">{data.missed}</p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Ø Dauer</p>
                  <p className="text-xl font-semibold">
                    {formatDuration(data.avgDuration)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-sand-500">Gesamtdauer</p>
                  <p className="text-xl font-semibold">
                    {formatDurationHms(data.totalDuration)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {renderBreakdown("Nebenstellen (letzte 7 Tage)", extensionStats)}
      </div>
    </div>
  );
}
