import { useEffect, useState } from "react";
import {
  LineChart,
  BarChart3,
  Brain,
  ClipboardList,
  FileText,
  Moon,
  Receipt,
  Settings,
  ShoppingCart,
  StickyNote,
  Sun,
  Users,
  Wrench
} from "lucide-react";
import ReportView from "./reporting/ReportView";
import TelephonyMenu from "./telephony/TelephonyMenu";
import TelephonyView from "./telephony/TelephonyView";
import NotesView from "./notes/NotesView";
import ErrorBoundary from "./components/ErrorBoundary";
import ToolsView from "./tools/ToolsView";
import SettingsView from "./settings/SettingsView";
import CustomerDirectoryView from "./customers/CustomerDirectoryView";
import DayPlanView from "./dayplan/DayPlanView";
import OffersView from "./offers/OffersView";
import StatsView from "./stats/StatsView";
import PurchasingView from "./purchasing/PurchasingView";
import KnowledgeBaseView from "./knowledge/KnowledgeBaseView";
import IncomingCallQuickTaskPopup from "./telephony/IncomingCallQuickTaskPopup";
import CustomerDevelopmentView from "./customer-development/CustomerDevelopmentView";

export default function App() {
  const [activeView, setActiveView] = useState("dayplan");
  const sidebarWidth = 207;
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("qt_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("qt_theme", theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <IncomingCallQuickTaskPopup />
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
              onClick={() => setActiveView("customers")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "customers"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <Users size={18} /> Kundenstamm
            </button>
            <button
              onClick={() => setActiveView("customer-development")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "customer-development"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <LineChart size={18} /> Kundenentwicklung
            </button>
            <button
              onClick={() => setActiveView("offers")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "offers"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <Receipt size={18} /> Angebote
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
            <TelephonyMenu
              active={activeView === "telephony"}
              onClick={() => setActiveView("telephony")}
            />
            <div className="border-t border-sand-200 my-2" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400 px-2">
              Betriebsintern
            </p>
            <button
              onClick={() => setActiveView("stats")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "stats"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <BarChart3 size={18} /> Statistik
            </button>
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
            <button
              onClick={() => setActiveView("purchasing")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "purchasing"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <ShoppingCart size={18} /> Einkauf
            </button>
            <button
              onClick={() => setActiveView("knowledge")}
              className={`w-full text-left px-4 py-3 rounded-2xl border ${
                activeView === "knowledge"
                  ? "bg-sand-900 text-white border-sand-900"
                  : "bg-sand-50 border-sand-200 text-sand-700 hover:bg-sand-100"
              } flex items-center gap-3`}
            >
              <Brain size={18} className="shrink-0" /> Wissens-DB
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
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 shadow-soft hover:bg-sand-100"
              title={theme === "dark" ? "Tagmodus" : "Nachtmodus"}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Tag" : "Nacht"}
            </button>
            <div className="text-xs text-sand-500">Version 1.2</div>
          </div>
        </aside>

        <div className="flex-1">
          {activeView === "dayplan" ? (
            <DayPlanView />
          ) : activeView === "notes" ? (
            <ErrorBoundary>
              <NotesView />
            </ErrorBoundary>
          ) : activeView === "customers" ? (
            <CustomerDirectoryView />
          ) : activeView === "tools" ? (
            <ToolsView />
          ) : activeView === "settings" ? (
            <SettingsView />
          ) : activeView === "telephony" ? (
            <TelephonyView />
          ) : activeView === "stats" ? (
            <StatsView />
          ) : activeView === "purchasing" ? (
            <PurchasingView />
          ) : activeView === "knowledge" ? (
            <KnowledgeBaseView />
          ) : activeView === "customer-development" ? (
            <CustomerDevelopmentView />
          ) : activeView === "offers" ? (
            <OffersView />
          ) : (
            <ReportView />
          )}
        </div>
      </div>
    </div>
  );
}
