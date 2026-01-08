import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ClipboardCopy,
  FileDown,
  FileText,
  Flag,
  Layers,
  Mail,
  Plus,
  Save,
  Sparkles,
  Users2
} from "lucide-react";
import ActionCard from "./components/ActionCard";
import ArchivePanel from "./components/ArchivePanel";
import CatalogManager from "./components/CatalogManager";
import StatusPicker from "./components/StatusPicker";
import useLocalStorage from "./hooks/useLocalStorage";
import { archiveByCustomer, catalog as defaultCatalog, customers, months, years } from "./constants";
import { buildPlainText, renderReportHTML, uid } from "./utils";

const defaultReport = {
  customer: customers[0],
  month: months[new Date().getMonth()],
  year: years[0],
  status: "Gelb",
  summary: "Die Systeme laufen stabil, wir empfehlen jedoch eine zeitnahe Aktualisierung des Servers.",
  customer_action_text: "Bitte Freigabe für Option A oder B bis nächsten Mittwoch.",
  actions: [
    {
      id: "a1",
      priority: "Dringend",
      title: "Serversystem Update",
      system: "Server",
      why_text: "Kritische Patches einspielen, um CVE-Risiken zu schließen.",
      impact: "Wartungsfenster",
      duration: "0,5–1,0 h",
      cost: "€ 120–240",
      security_note: "CVE-2024-8123 betroffen"
    }
  ]
};

const ensureCatalogIds = (items) =>
  items.map((item) => ({
    id: item.id || uid(),
    ...item
  }));

export default function ReportView() {
  const [report, setReport] = useState(defaultReport);
  const [catalogItems, setCatalogItems] = useLocalStorage(
    "report_catalog_v1",
    ensureCatalogIds(defaultCatalog)
  );
  const [catalogPick, setCatalogPick] = useState(catalogItems[0]?.id ?? "");
  const [archiveItems] = useLocalStorage("report_archive_v1", archiveByCustomer);

  const previewHtml = useMemo(() => renderReportHTML(report), [report]);
  const plainText = useMemo(() => buildPlainText(report), [report]);

  const addAction = (payload = {}) => {
    setReport((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          id: uid(),
          priority: "Planbar",
          title: "Neue Maßnahme",
          system: "",
          why_text: "",
          impact: "Keine Unterbrechung",
          duration: "",
          cost: "",
          security_note: "",
          ...payload
        }
      ]
    }));
  };

  const addFromCatalog = () => {
    const item = catalogItems.find((entry) => entry.id === catalogPick);
    if (item) addAction({ ...item });
  };

  const updateAction = (id, patch) => {
    setReport((prev) => ({
      ...prev,
      actions: prev.actions.map((action) => (action.id === id ? { ...action, ...patch } : action))
    }));
  };

  const removeAction = (id) => {
    setReport((prev) => ({
      ...prev,
      actions: prev.actions.filter((action) => action.id !== id)
    }));
  };

  const addCatalogItem = (item) => {
    const next = [...catalogItems, { ...item, id: uid() }];
    setCatalogItems(next);
    if (!catalogPick) setCatalogPick(next[0]?.id ?? "");
  };

  const removeCatalogItem = (id) => {
    const next = catalogItems.filter((item) => item.id !== id);
    setCatalogItems(next);
    if (catalogPick === id) setCatalogPick(next[0]?.id ?? "");
  };

  const updateCatalogItem = (id, patch) => {
    setCatalogItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      <div className="absolute inset-0 -z-10 bg-hero-pattern" />

      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-sand-900 text-white flex items-center justify-center shadow-soft">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-2xl font-display">Kundenbericht Generator</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-xs text-sand-500">
              <Users2 size={16} />
              4 Kunden
            </div>
            <div className="flex items-center gap-2 text-xs text-sand-500">
              <Calendar size={16} />
              Bericht in 2–3 Minuten
            </div>
            <button className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100">
              <Layers size={14} /> Vorlagen verwalten
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-8">
        <section className="space-y-6">
          <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-6 shadow-soft space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display">Report Builder</h2>
                <p className="text-sm text-sand-600">
                  Fülle alle Felder aus, um Kundenfragen sofort zu beantworten.
                </p>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide">
                  <Save size={14} /> Speichern
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100">
                  <FileText size={14} /> Archiv
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-xs uppercase tracking-wide text-sand-600">
                Kunde
                <select
                  value={report.customer}
                  onChange={(event) => setReport((prev) => ({ ...prev, customer: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                >
                  {customers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-wide text-sand-600">
                Zeitraum
                <select
                  value={report.month}
                  onChange={(event) => setReport((prev) => ({ ...prev, month: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                >
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-wide text-sand-600">
                Jahr
                <select
                  value={report.year}
                  onChange={(event) => setReport((prev) => ({ ...prev, year: Number(event.target.value) }))}
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-sand-600 mb-2 flex items-center gap-2">
                <Flag size={14} /> Ampelstatus
              </p>
              <StatusPicker
                value={report.status}
                onChange={(status) => setReport((prev) => ({ ...prev, status }))}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="text-xs uppercase tracking-wide text-sand-600 block">
                Kurz-Zusammenfassung
                <textarea
                  value={report.summary}
                  onChange={(event) => setReport((prev) => ({ ...prev, summary: event.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-sand-600 block">
                Was wir vom Kunden benötigen
                <textarea
                  value={report.customer_action_text}
                  onChange={(event) =>
                    setReport((prev) => ({ ...prev, customer_action_text: event.target.value }))
                  }
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
                />
              </label>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-6 shadow-soft space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-display">Maßnahmenverwaltung</h2>
                <p className="text-sm text-sand-600">Standard-Textbausteine plus individuelle Ergänzungen.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => addAction()}
                  className="inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  <Plus size={14} /> Neue Maßnahme
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center bg-sand-100-70 border border-sand-200 rounded-2xl p-3">
              <label className="text-xs uppercase tracking-wide text-sand-600 flex items-center gap-2">
                <Sparkles size={14} /> Aus Bausteinen
              </label>
              <select
                value={catalogPick}
                onChange={(event) => setCatalogPick(event.target.value)}
                className="rounded-full border border-sand-200 px-4 py-2 text-sm bg-white"
              >
                {catalogItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <button
                onClick={addFromCatalog}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                <Plus size={14} /> Hinzufügen
              </button>
            </div>

            <div className="space-y-4">
              {report.actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onChange={(patch) => updateAction(action.id, patch)}
                  onRemove={() => removeAction(action.id)}
                />
              ))}
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-6 shadow-soft space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-display">Textbausteine verwalten</h2>
                <p className="text-sm text-sand-600">
                  Bausteine bleiben gespeichert und stehen beim Zusammenklicken zur Auswahl.
                </p>
              </div>
            </div>
            <CatalogManager
              items={catalogItems}
              onAdd={addCatalogItem}
              onRemove={removeCatalogItem}
              onUpdate={updateCatalogItem}
            />
          </div>

          <div className="bg-white/90 backdrop-blur border border-sand-200 rounded-3xl p-6 shadow-soft space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-display">Export & Nutzung</h2>
                <p className="text-sm text-sand-600">HTML, Text und PDF liegen exakt wie im Preview vor.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigator.clipboard?.writeText(previewHtml)}
                  className="inline-flex items-center gap-2 rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
                >
                  <ClipboardCopy size={14} /> HTML kopieren
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(plainText)}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  <FileText size={14} /> Plain-Text
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100">
                  <FileDown size={14} /> PDF
                </button>
                <button className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100">
                  <Save size={14} /> Archivieren
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-sand-100-60 border border-sand-200 rounded-2xl p-4 text-sm text-sand-600">
                <p className="font-semibold text-sand-800 mb-2 flex items-center gap-2">
                  <Mail size={16} /> HTML Export
                </p>
                <p>Das HTML wird serverseitig gerendert, um für E-Mail und PDF identisch zu bleiben.</p>
              </div>
              <div className="bg-sand-100-60 border border-sand-200 rounded-2xl p-4 text-sm text-sand-600">
                <p className="font-semibold text-sand-800 mb-2 flex items-center gap-2">
                  <CheckCircle2 size={16} /> Nachweis & Historie
                </p>
                <p>Berichte werden pro Kunde archiviert, unabhängig vom Monatsrhythmus.</p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="bg-white border border-sand-200 rounded-3xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display">Live Preview</h3>
              <span
                className={`text-xs font-semibold uppercase tracking-wide border px-3 py-1 rounded-full ${
                  report.status === "Grün"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                    : report.status === "Gelb"
                    ? "bg-amber-100 text-amber-800 border-amber-200"
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}
              >
                {report.status}
              </span>
            </div>
            <div className="border border-sand-200 rounded-2xl p-4 bg-white">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>

          <div className="bg-white border border-sand-200 rounded-3xl p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-display">Plain-Text Version</h3>
              <button
                onClick={() => navigator.clipboard?.writeText(plainText)}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                <ClipboardCopy size={12} /> Kopieren
              </button>
            </div>
            <textarea
              value={plainText}
              readOnly
              rows={10}
              className="w-full rounded-2xl border border-sand-200 bg-sand-50 px-3 py-3 text-xs font-mono text-sand-700"
            />
          </div>

          <ArchivePanel archive={archiveItems} />
        </aside>
      </main>
    </div>
  );
}
