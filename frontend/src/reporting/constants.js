export const customers = ["Albatros GmbH", "Nordlicht AG", "Rheinline Systems", "Stadtwerke Hafen"];

export const months = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember"
];

export const years = [2024, 2025, 2026];

export const catalog = [
  {
    title: "Serversystem Update",
    system: "Server",
    why_text: "Sicherheitslücken schließen und Stabilität verbessern.",
    impact: "Wartungsfenster",
    duration: "0,5–1,0 h",
    cost: "€ 120–240",
    priority: "Dringend"
  },
  {
    title: "Firewall Regeln prüfen",
    system: "Firewall",
    why_text: "Neue Services absichern und ungenutzte Ports entfernen.",
    impact: "Keine Unterbrechung",
    duration: "0,3–0,6 h",
    cost: "€ 80–160",
    priority: "Planbar"
  },
  {
    title: "Backup-Strategie testen",
    system: "Backup",
    why_text: "Wiederherstellbarkeit verifizieren, Audit-Anforderung erfüllen.",
    impact: "Kurzunterbrechung",
    duration: "1,0–1,5 h",
    cost: "€ 240–360",
    priority: "Hinweis"
  }
];

export const archiveByCustomer = [
  {
    customer: "Albatros GmbH",
    reports: [
      { id: "r1", label: "Sommer-Check 2024", status: "Grün", period: "August 2024" },
      { id: "r2", label: "Security Review", status: "Gelb", period: "Juli 2024" }
    ]
  },
  {
    customer: "Nordlicht AG",
    reports: [{ id: "r3", label: "Monitoring Update", status: "Grün", period: "Juni 2024" }]
  }
];

export const statusStyles = {
  Grün: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Gelb: "bg-amber-100 text-amber-800 border-amber-200",
  Rot: "bg-rose-100 text-rose-800 border-rose-200"
};

export const priorityStyles = {
  Dringend: "bg-rose-100 text-rose-700 border-rose-200",
  Planbar: "bg-sky-100 text-sky-700 border-sky-200",
  Hinweis: "bg-slate-100 text-slate-700 border-slate-200"
};
