const formatDuration = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function CallStatsView({ stats }) {
  const buckets = stats.byHour && stats.byHour.length ? stats.byHour : [];
  const maxValue = Math.max(1, ...buckets.map((b) => b.answered + b.missed));

  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Analytics</p>
          <h2 className="text-xl font-display">Call Statistik</h2>
        </div>
        <span className="text-xs text-sand-500">heute</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border border-sand-200 rounded-2xl p-4">
          <p className="text-xs text-sand-500">Gesamt</p>
          <p className="text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="border border-sand-200 rounded-2xl p-4">
          <p className="text-xs text-sand-500">Beantwortet</p>
          <p className="text-2xl font-semibold text-emerald-600">{stats.answered}</p>
        </div>
        <div className="border border-sand-200 rounded-2xl p-4">
          <p className="text-xs text-sand-500">Verpasst</p>
          <p className="text-2xl font-semibold text-rose-600">{stats.missed}</p>
        </div>
        <div className="border border-sand-200 rounded-2xl p-4">
          <p className="text-xs text-sand-500">Ø Dauer</p>
          <p className="text-2xl font-semibold">{formatDuration(stats.avgDuration)}</p>
        </div>
      </div>

      <div className="space-y-2">
        {buckets.length === 0 ? (
          <p className="text-sm text-sand-500">Keine Statistikdaten geladen.</p>
        ) : (
          buckets.map((bucket) => {
            const total = bucket.answered + bucket.missed;
            return (
              <div key={bucket.hour} className="flex items-center gap-3 text-xs">
                <span className="w-8 text-sand-500">{bucket.hour}:00</span>
                <div className="flex-1 h-2 bg-sand-100 rounded-full overflow-hidden">
                  <div className="flex h-full">
                    <div
                      className="bg-emerald-400"
                      style={{ width: `${Math.round((bucket.answered / maxValue) * 100)}%` }}
                    />
                    <div
                      className="bg-rose-400"
                      style={{ width: `${Math.round((bucket.missed / maxValue) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sand-500">{total}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
