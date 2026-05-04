export const customers = [];

export const catalog = [
  {
    title: "Serversystem Update",
    group: "Update",
    system: "Server",
    why_text: "Sicherheitslücken schließen und Stabilität verbessern.",
    impact: "Wartungsfenster",
    duration: "0,5–1,0 h",
    cost: "€ 120–240",
    priority: "Dringend"
  },
  {
    title: "Firewall Regeln prüfen",
    group: "Firewall",
    system: "Firewall",
    why_text: "Neue Services absichern und ungenutzte Ports entfernen.",
    impact: "Keine Unterbrechung",
    duration: "0,3–0,6 h",
    cost: "€ 80–160",
    priority: "Planbar"
  },
  {
    title: "Backup-Strategie testen",
    group: "Backup",
    system: "Backup",
    why_text: "Wiederherstellbarkeit verifizieren, Audit-Anforderung erfüllen.",
    impact: "Kurzunterbrechung",
    duration: "1,0–1,5 h",
    cost: "€ 240–360",
    priority: "Hinweis"
  }
];

export const customerActionSuggestions = [
  {
    text: "Bitte geben Sie uns Bescheid, ob und welche Maßnahmen wir für Sie erledigen dürfen."
  },
  {
    text: "Bitte bestätigen Sie das Wartungsfenster und die Freigabe für die geplanten Arbeiten."
  },
  {
    text: "Bitte teilen Sie uns einen Ansprechpartner und ein passendes Zeitfenster mit."
  }
];

export const summarySuggestions = [
  {
    text: "Die Systeme laufen stabil. Wir empfehlen die genannten Maßnahmen zeitnah einzuplanen."
  },
  {
    text: "Insgesamt stabiler Betrieb, offene Punkte betreffen Sicherheit und Wartung."
  },
  {
    text: "Keine akuten Störungen, aber es gibt Optimierungspotenzial bei Updates und Backup."
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

export const archiveStatusStyles = {
  Bestätigt: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Aufgabe erstellt": "bg-emerald-100 text-emerald-700 border-emerald-200",
  Erledigt: "bg-sand-100 text-sand-700 border-sand-200",
  Abgelehnt: "bg-rose-100 text-rose-700 border-rose-200"
};

export const priorityStyles = {
  Dringend: "bg-rose-100 text-rose-700 border-rose-200",
  Planbar: "bg-sky-100 text-sky-700 border-sky-200",
  Hinweis: "bg-slate-100 text-slate-700 border-slate-200"
};
