import { useEffect, useState } from "react";
import { FileText, Mail } from "lucide-react";
import CustomerReportView from "./CustomerReportView";
import NewsletterView from "./NewsletterView";

const STORAGE_KEY = "qt_reporting_workspace";

export default function ReportView() {
  const [workspace, setWorkspace] = useState(() => {
    if (typeof window === "undefined") return "report";
    const cached = window.localStorage.getItem(STORAGE_KEY);
    return cached === "newsletter" ? "newsletter" : "report";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, workspace);
  }, [workspace]);

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="sticky top-0 z-40 border-b border-sand-200 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-3">
          <button
            type="button"
            onClick={() => setWorkspace("report")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
              workspace === "report"
                ? "border-sand-900 bg-sand-900 text-white"
                : "border-sand-300 bg-white text-sand-700 hover:bg-sand-100"
            }`}
          >
            <FileText size={14} /> Kundenbericht
          </button>
          <button
            type="button"
            onClick={() => setWorkspace("newsletter")}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-wide ${
              workspace === "newsletter"
                ? "border-amber-600 bg-amber-600 text-white"
                : "border-sand-300 bg-white text-sand-700 hover:bg-sand-100"
            }`}
          >
            <Mail size={14} /> Newsletter
          </button>
        </div>
      </div>
      {workspace === "report" ? <CustomerReportView /> : <NewsletterView />}
    </div>
  );
}
