import { useEffect, useState } from "react";
import {
  BarChart3,
  Brain,
  ClipboardList,
  FileText,
  Moon,
  Pin,
  Receipt,
  Settings,
  ShoppingCart,
  StickyNote,
  Sun,
  Users,
  Wrench
} from "lucide-react";

function NavButton({ view, active, onClick, icon: Icon, children, className = "" }) {
  const isActive = active === view;
  return (
    <button
      onClick={() => onClick(view)}
      className={`relative w-full text-left pl-4 pr-3 py-2.5 rounded-xl text-sm font-medium
        flex items-center gap-3 transition-colors duration-150
        ${isActive
          ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
          : "text-sand-700 hover:bg-sand-100 hover:text-sand-900"
        } ${className}`}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-[var(--nav-accent)]" />
      )}
      <Icon size={16} className="shrink-0 opacity-80" />
      {children}
    </button>
  );
}
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
import VisionBoardView from "./vision-board/VisionBoardView";

const APP_VIEW_STORAGE_KEY = "qt_active_view";
const VALID_APP_VIEWS = new Set([
  "dayplan",
  "visionboard",
  "notes",
  "customers",
  "tools",
  "settings",
  "telephony",
  "stats",
  "purchasing",
  "knowledge",
  "offers",
  "report"
]);

const detectDeviceClass = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";
  const ua = String(navigator.userAgent || "").toLowerCase();
  const width = Number(window.innerWidth || window.screen?.width || 0);
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  const isIpadOs = ua.includes("macintosh") && maxTouchPoints > 1;
  const isTabletUa = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua);
  const isMobileUa = /(iphone|ipod|android.*mobile|windows phone|blackberry|bb10|mobile)/i.test(ua);
  if (isTabletUa || isIpadOs || (maxTouchPoints > 1 && width >= 768 && width <= 1366)) {
    return "tablet";
  }
  if (isMobileUa || (width > 0 && width < 768)) {
    return "mobile";
  }
  return "desktop";
};

export default function App() {
  const [activeView, setActiveView] = useState(() => {
    if (typeof window === "undefined") return "dayplan";
    const stored = window.localStorage.getItem(APP_VIEW_STORAGE_KEY);
    return VALID_APP_VIEWS.has(stored) ? stored : "dayplan";
  });
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!VALID_APP_VIEWS.has(activeView)) return;
    window.localStorage.setItem(APP_VIEW_STORAGE_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("client") === "desktop") return;
    const deviceClass = detectDeviceClass();
    document.documentElement.dataset.deviceClass = deviceClass;
    if (deviceClass === "mobile" || deviceClass === "tablet") {
      if (!window.location.pathname.startsWith("/mobil")) {
        window.location.replace("/mobil/");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const selector = "input, textarea, select, form";
    const applyPasswordManagerIgnore = (root = document) => {
      root.querySelectorAll(selector).forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        if (el.dataset.allowPasswordManager === "true") return;
        el.setAttribute("data-bwignore", "true");
        el.setAttribute("data-lpignore", "true");
        el.setAttribute("data-1p-ignore", "true");
        if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "FORM") && !el.getAttribute("autocomplete")) {
          el.setAttribute("autocomplete", "off");
        }
      });
    };
    applyPasswordManagerIgnore(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.(selector)) applyPasswordManagerIgnore(node.parentElement || document);
          else applyPasswordManagerIgnore(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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
            <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
          </div>

          <nav className="space-y-0.5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-sand-500 px-2 pb-1 font-medium">
              Tagesgeschäft
            </p>
            <NavButton view="dayplan" active={activeView} onClick={setActiveView} icon={ClipboardList}>
              Aufgaben
            </NavButton>
            <NavButton view="visionboard" active={activeView} onClick={setActiveView} icon={Pin}>
              VisionBoard
            </NavButton>
            <NavButton view="notes" active={activeView} onClick={setActiveView} icon={StickyNote}>
              Notizen
            </NavButton>
            <div className="border-t border-sand-200 my-2" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-sand-500 px-2 pb-1 font-medium">
              Kundenorientierung
            </p>
            <NavButton view="offers" active={activeView} onClick={setActiveView} icon={Receipt}>
              Angebote
            </NavButton>
            <NavButton view="purchasing" active={activeView} onClick={setActiveView} icon={ShoppingCart}>
              Einkauf
            </NavButton>
            <NavButton view="report" active={activeView} onClick={setActiveView} icon={FileText}>
              Kundenbericht
            </NavButton>
            <TelephonyMenu
              active={activeView === "telephony"}
              onClick={() => setActiveView("telephony")}
            />
            <div className="border-t border-sand-200 my-2" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-sand-500 px-2 pb-1 font-medium">
              Betriebsintern
            </p>
            <NavButton view="customers" active={activeView} onClick={setActiveView} icon={Users}>
              Kundenstamm
            </NavButton>
            <NavButton view="stats" active={activeView} onClick={setActiveView} icon={BarChart3}>
              Statistik
            </NavButton>
            <NavButton view="tools" active={activeView} onClick={setActiveView} icon={Wrench}>
              Tools
            </NavButton>
            <NavButton view="knowledge" active={activeView} onClick={setActiveView} icon={Brain}>
              Wissens-DB
            </NavButton>
          </nav>

          <div className="mt-auto space-y-2">
            <div className="border-t border-sand-200 pt-2">
              <NavButton view="settings" active={activeView} onClick={setActiveView} icon={Settings}>
                Einstellungen
              </NavButton>
            </div>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sand-200 bg-sand-50 px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100 transition-colors duration-150"
              title={theme === "dark" ? "Tagmodus" : "Nachtmodus"}
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              {theme === "dark" ? "Tag" : "Nacht"}
            </button>
            <div className="text-xs text-sand-500 px-1">Version 1.3</div>
          </div>
        </aside>

        <div className="flex-1">
          {activeView === "dayplan" ? (
            <DayPlanView />
          ) : activeView === "visionboard" ? (
            <VisionBoardView />
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
