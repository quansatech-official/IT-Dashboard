import { useState } from "react";
import { Clock, FileText, Monitor, Sparkles, StickyNote } from "lucide-react";
import ReportView from "./reporting/ReportView";
import TimeTrackingView from "./timetracking/TimeTrackingView";
import RmmDashboardView from "./rmm/RmmDashboardView";
import TelephonyMenu from "./telephony/TelephonyMenu";
import TelephonyView from "./telephony/TelephonyView";
import NotesView from "./notes/NotesView";

export default function App() {
  const [activeView, setActiveView] = useState("time");

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <div className="flex min-h-screen">
        <aside className="w-56 bg-white border-r border-sand-200 p-4 flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center shadow-soft">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <p className="text-base font-display">Dashboard</p>
            </div>
          </div>

          <nav className="space-y-2">
            <button
              onClick={() => setActiveView("time")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "time"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <Clock size={18} /> Zeiterfassung
            </button>
            <button
              onClick={() => setActiveView("report")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "report"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <FileText size={18} /> Kundenbericht
            </button>
            <button
              onClick={() => setActiveView("notes")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "notes"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <StickyNote size={18} /> Notizen
            </button>
            <button
              onClick={() => setActiveView("rmm")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "rmm"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <Monitor size={18} /> RMM Dashboard
            </button>
            <TelephonyMenu
              active={activeView === "telephony"}
              onClick={() => setActiveView("telephony")}
            />
          </nav>

          <div className="mt-auto text-xs text-sand-500">
            Schnellzugriff für Zeiterfassung, Notizen und Kundenberichte.
          </div>
        </aside>

        <div className="flex-1">
          {activeView === "time" ? (
            <TimeTrackingView />
          ) : activeView === "notes" ? (
            <NotesView />
          ) : activeView === "rmm" ? (
            <RmmDashboardView />
          ) : activeView === "telephony" ? (
            <TelephonyView />
          ) : (
            <ReportView />
          )}
        </div>
      </div>
    </div>
  );
}
