import { useState } from "react";
import {
  Clock,
  ClipboardList,
  FileText,
  Settings,
  Sparkles,
  StickyNote,
  Users,
  Wrench
} from "lucide-react";
import ReportView from "./reporting/ReportView";
import TimeTrackingView from "./timetracking/TimeTrackingView";
import TelephonyMenu from "./telephony/TelephonyMenu";
import TelephonyView from "./telephony/TelephonyView";
import NotesView from "./notes/NotesView";
import ToolsView from "./tools/ToolsView";
import SettingsView from "./settings/SettingsView";
import CustomerDirectoryView from "./customers/CustomerDirectoryView";
import DayPlanView from "./dayplan/DayPlanView";

export default function App() {
  const [activeView, setActiveView] = useState("dayplan");
  const [sidebarWidth, setSidebarWidth] = useState(200);

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <div className="flex min-h-screen">
        <aside
          className="bg-white border-r border-sand-200 p-4 flex flex-col gap-6"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="flex flex-col items-start gap-2">
            <img src="/QTLogo.jpg" alt="Quansatech" className="h-12 w-auto object-contain" />
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
          </div>

          <nav className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400 px-2">
              Tagesgeschäft
            </p>
            <button
              onClick={() => setActiveView("dayplan")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "dayplan"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <ClipboardList size={18} /> Aufgaben
            </button>
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
              onClick={() => setActiveView("notes")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "notes"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <StickyNote size={18} /> Notizen
            </button>
            <div className="border-t border-sand-200 my-2" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400 px-2">
              Kundenorientierung
            </p>
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
              onClick={() => setActiveView("customers")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "customers"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <Users size={18} /> Kundenstamm
            </button>
            <TelephonyMenu
              active={activeView === "telephony"}
              onClick={() => setActiveView("telephony")}
            />
            <div className="border-t border-sand-200 my-2" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400 px-2">
              Betriebsintern
            </p>
            <button
              onClick={() => setActiveView("tools")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "tools"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <Wrench size={18} /> Tools
            </button>
          </nav>

          <div className="mt-auto space-y-3">
            <div className="border-t border-sand-200 pt-3">
              <button
                onClick={() => setActiveView("settings")}
                className={`w-full text-left px-4 py-3 rounded-2xl border ${
                  activeView === "settings"
                    ? "bg-sand-900 text-white border-sand-900"
                    : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
                } flex items-center gap-3`}
              >
                <Settings size={18} /> Einstellungen
              </button>
            </div>
            <label className="text-[10px] uppercase tracking-[0.3em] text-sand-400">
              Sidebar Breite
              <input
                type="range"
                min={180}
                max={260}
                value={sidebarWidth}
                onChange={(event) => setSidebarWidth(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>
            <div className="text-xs text-sand-500">
              Schnellzugriff für Zeiterfassung, Notizen und Kundenberichte.
            </div>
          </div>
        </aside>

        <div className="flex-1">
          {activeView === "time" ? (
            <TimeTrackingView />
          ) : activeView === "dayplan" ? (
            <DayPlanView />
          ) : activeView === "notes" ? (
            <NotesView />
          ) : activeView === "customers" ? (
            <CustomerDirectoryView />
          ) : activeView === "tools" ? (
            <ToolsView />
          ) : activeView === "settings" ? (
            <SettingsView />
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
