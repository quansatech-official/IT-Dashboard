const formatTime = (timestamp) => {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const formatDuration = (seconds) => {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const directionLabel = (direction) => {
  if (!direction) return "-";
  const value = direction.toLowerCase();
  if (value.includes("in")) return "Eingehend";
  if (value.includes("out")) return "Ausgehend";
  return direction;
};

export default function CallListView({ calls }) {
  return (
    <div className="bg-white border border-sand-200 rounded-3xl p-6 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Live Calls</p>
          <h2 className="text-xl font-display">Call Monitoring</h2>
        </div>
        <span className="text-xs text-sand-500">letzte 200 Events</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-sand-500 border-b border-sand-200">
            <tr>
              <th className="text-left py-2">Zeit</th>
              <th className="text-left py-2">Rufnummer</th>
              <th className="text-left py-2">Richtung</th>
              <th className="text-left py-2">Dauer</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Kunde</th>
            </tr>
          </thead>
          <tbody>
            {calls.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-sand-500">
                  Noch keine Telefonie-Events geladen.
                </td>
              </tr>
            ) : (
              calls.map((call) => (
                <tr key={call.uuid} className="border-b border-sand-100">
                  <td className="py-3">{formatTime(call.startTime)}</td>
                  <td className="py-3">{call.from || call.to || "-"}</td>
                  <td className="py-3">{directionLabel(call.direction)}</td>
                  <td className="py-3">{formatDuration(call.duration)}</td>
                  <td className="py-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        call.answered
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {call.answered ? "Beantwortet" : "Verpasst"}
                    </span>
                  </td>
                  <td className="py-3">{call.customerName || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
