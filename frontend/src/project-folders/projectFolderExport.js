export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildProjectMarkdown = ({ folder, options, statusMeta, priorityMeta }) => {
  if (!folder) return "";
  const overview = folder.content?.overview || {};
  const lines = [
    `# ${folder.title}`,
    "",
    `- Kunde: ${folder.customer || "-"}`,
    `- Status: ${statusMeta[folder.status]?.label || folder.status}`,
    `- Priorität: ${priorityMeta[folder.priority] || folder.priority}`,
    `- Verantwortlich: ${folder.owner || "-"}`,
    `- Aktueller Stand: ${folder.current_state || "-"}`,
    `- Nächster Schritt: ${folder.next_step || "-"}`,
    ""
  ];
  if (overview.project_description || overview.target_state || overview.scope_notes || overview.ai_guidance) {
    lines.push("## Projektbriefing", "");
    if (overview.project_description) lines.push(`- Beschreibung: ${overview.project_description}`);
    if (overview.target_state) lines.push(`- Zielbild: ${overview.target_state}`);
    if (overview.scope_notes) lines.push(`- Rahmen/Abgrenzung: ${overview.scope_notes}`);
    if (overview.ai_guidance) lines.push(`- KI-Fokus: ${overview.ai_guidance}`);
    lines.push("");
  }
  (folder.content?.streams || []).forEach((stream) => {
    lines.push(`## ${stream.title}`, "");
    lines.push(`- Kurzlage: ${stream.short_status || "-"}`);
    lines.push(`- Zuständig: ${stream.owner || "-"}`);
    lines.push(`- Empfehlung: ${stream.recommendation || "-"}`);
    lines.push(`- Kundenentscheidung: ${stream.customer_decision || "-"}`);
    lines.push(`- Nächster Schritt: ${stream.next_step || "-"}`, "");
    if (options.include_tasks && stream.tasks?.length) {
      lines.push("### Aufgaben");
      stream.tasks.forEach((task) => lines.push(`- [${task.status === "done" ? "x" : " "}] ${task.title}`));
      lines.push("");
    }
    if (options.include_checklists && stream.checklists?.length) {
      lines.push("### Checklisten");
      stream.checklists.forEach((list) => {
        lines.push(`- ${list.title}`);
        (list.items || []).forEach((item) => lines.push(`  - [${item.done ? "x" : " "}] ${item.title}`));
      });
      lines.push("");
    }
    if (options.include_risks && stream.risks?.length) {
      lines.push("### Risiken");
      stream.risks.forEach((item) => lines.push(`- ${item.title} (${item.level || "mittel"})`));
      lines.push("");
    }
  });
  return lines.join("\n");
};

export const buildProjectHtml = ({ folder, options, statusMeta }) => {
  if (!folder) return "";
  const streams = folder.content?.streams || [];
  const overview = folder.content?.overview || {};
  const visibleStreams = streams.filter((stream) => !options.customer_view || !stream.internal_only);
  const statusLabel = statusMeta[folder.status]?.label || folder.status || "-";
  const generatedAt = new Date().toLocaleDateString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const taskStatusLabel = (value) => {
    const key = String(value || "todo").toLowerCase();
    if (key === "done") return "Erledigt";
    if (key === "blocked") return "Blockiert";
    if (key === "waiting_customer") return "Wartet";
    if (key === "in_progress") return "In Arbeit";
    return "Offen";
  };
  const statusClass = String(folder.status || "yellow").toLowerCase();
  const renderTasks = (stream) =>
    options.include_tasks && stream.tasks?.length
      ? `<section class="subsection"><h3>Aufgaben</h3><table><thead><tr><th>Aufgabe</th><th>Status</th><th>Termin</th></tr></thead><tbody>${stream.tasks
          .map(
            (task) =>
              `<tr><td>${escapeHtml(task.title || "-")}</td><td>${escapeHtml(taskStatusLabel(task.status))}</td><td>${escapeHtml(task.due_date || task.dueDate || "-")}</td></tr>`
          )
          .join("")}</tbody></table></section>`
      : "";
  const renderChecklists = (stream) =>
    options.include_checklists && stream.checklists?.length
      ? `<section class="subsection"><h3>Checklisten</h3>${stream.checklists
          .map(
            (list) =>
              `<div class="checklist"><strong>${escapeHtml(list.title || "Checkliste")}</strong><ul>${(list.items || [])
                .map((item) => `<li><span class="${item.done ? "check done" : "check"}">${item.done ? "✓" : ""}</span>${escapeHtml(item.title || "-")}</li>`)
                .join("")}</ul></div>`
          )
          .join("")}</section>`
      : "";
  const renderRisks = (stream) =>
    options.include_risks && stream.risks?.length
      ? `<section class="subsection"><h3>Risiken</h3><div class="risk-list">${stream.risks
          .map((risk) => `<div class="risk"><span>${escapeHtml(risk.level || "mittel")}</span>${escapeHtml(risk.title || "-")}</div>`)
          .join("")}</div></section>`
      : "";
  const renderNotes = (stream) =>
    options.include_internal_notes && !options.customer_view && stream.notes?.length
      ? `<section class="subsection"><h3>Interne Notizen</h3>${stream.notes
          .map((note) => `<div class="note"><strong>${escapeHtml(note.title || "Notiz")}</strong><p>${escapeHtml(note.text || "")}</p></div>`)
          .join("")}</section>`
      : "";
  return `
    <html><head><meta charset="utf-8"><title>${escapeHtml(folder.title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #eef2f7; color: #172033; font-family: Inter, Arial, sans-serif; line-height: 1.42; }
      .page { max-width: 980px; margin: 0 auto; padding: 34px; }
      .sheet { background: #fff; border: 1px solid #d9e2ee; border-radius: 18px; overflow: hidden; box-shadow: 0 18px 42px rgba(15,23,42,.08); }
      .hero { padding: 30px 34px 24px; border-top: 7px solid #64748b; background: linear-gradient(180deg, #f8fafc, #ffffff); }
      .hero.red { border-top-color: #e11d48; } .hero.yellow { border-top-color: #f59e0b; } .hero.green { border-top-color: #10b981; } .hero.blue { border-top-color: #0284c7; }
      .eyebrow, h3, th { color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
      h1 { margin: 8px 0 0; color: #0f172a; font-size: 30px; line-height: 1.12; letter-spacing: 0; }
      h2 { margin: 0; color: #0f172a; font-size: 18px; line-height: 1.2; }
      h3 { margin: 0 0 8px; }
      p { margin: 0; }
      .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 22px; }
      .meta-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 11px 12px; background: #fff; }
      .meta-label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .12em; }
      .meta-value { margin-top: 4px; color: #0f172a; font-size: 13px; font-weight: 700; }
      .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 18px 34px 8px; }
      .summary-card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: #f8fafc; }
      .summary-card strong { display: block; margin-bottom: 6px; color: #0f172a; font-size: 13px; }
      .content { padding: 18px 34px 32px; }
      .stream { break-inside: avoid; border: 1px solid #dce5ef; border-radius: 16px; margin: 0 0 14px; overflow: hidden; }
      .stream-head { padding: 15px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
      .stream-body { padding: 14px 16px 16px; }
      .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
      .fact { border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 10px; }
      .fact span { display: block; color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
      .fact b { display: block; margin-top: 3px; color: #1e293b; font-size: 12px; }
      .subsection { margin-top: 13px; }
      table { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 12px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 9px; text-align: left; vertical-align: top; }
      th { background: #f1f5f9; }
      tr:last-child td { border-bottom: 0; }
      ul { margin: 8px 0 0; padding: 0; list-style: none; }
      li { margin: 5px 0; font-size: 12px; }
      .check { display: inline-flex; width: 15px; height: 15px; margin-right: 7px; border: 1px solid #cbd5e1; border-radius: 4px; align-items: center; justify-content: center; font-size: 10px; color: #fff; }
      .check.done { background: #10b981; border-color: #10b981; }
      .risk-list { display: grid; gap: 7px; }
      .risk { border: 1px solid #fed7aa; border-radius: 10px; background: #fff7ed; padding: 8px 10px; font-size: 12px; }
      .risk span { display: inline-block; min-width: 58px; color: #9a3412; font-weight: 700; text-transform: uppercase; font-size: 10px; }
      .note { border: 1px dashed #cbd5e1; border-radius: 10px; padding: 9px 10px; background: #f8fafc; font-size: 12px; }
      .muted { color: #64748b; }
      .footer { padding: 12px 34px 18px; color: #64748b; font-size: 10px; text-align: right; }
      @media print { body { background: #fff; } .page { padding: 0; max-width: none; } .sheet { border: 0; border-radius: 0; box-shadow: none; } }
    </style></head><body>
    <div class="page"><article class="sheet">
      <header class="hero ${escapeHtml(statusClass)}">
        <div class="eyebrow">${options.customer_view ? "Kundenexport" : "Interner Projektexport"} · ${escapeHtml(generatedAt)}</div>
        <h1>${escapeHtml(folder.title)}</h1>
        <div class="meta">
          <div class="meta-card"><div class="meta-label">Kunde</div><div class="meta-value">${escapeHtml(folder.customer || "-")}</div></div>
          <div class="meta-card"><div class="meta-label">Status</div><div class="meta-value">${escapeHtml(statusLabel)}</div></div>
          <div class="meta-card"><div class="meta-label">Verantwortlich</div><div class="meta-value">${escapeHtml(folder.owner || "-")}</div></div>
          <div class="meta-card"><div class="meta-label">Deadline</div><div class="meta-value">${escapeHtml(folder.deadline || "-")}</div></div>
        </div>
      </header>
      <section class="summary">
        <div class="summary-card"><strong>Aktueller Stand</strong><p>${escapeHtml(folder.current_state || "-")}</p></div>
        <div class="summary-card"><strong>Nächster Schritt</strong><p>${escapeHtml(folder.next_step || "-")}</p></div>
      </section>
      ${
        overview.project_description || overview.target_state || overview.scope_notes || overview.ai_guidance
          ? `<section class="summary">
              <div class="summary-card"><strong>Beschreibung</strong><p>${escapeHtml(overview.project_description || "-")}</p></div>
              <div class="summary-card"><strong>Zielbild</strong><p>${escapeHtml(overview.target_state || "-")}</p></div>
              <div class="summary-card"><strong>Rahmen / Abgrenzung</strong><p>${escapeHtml(overview.scope_notes || "-")}</p></div>
              <div class="summary-card"><strong>KI-Fokus</strong><p>${escapeHtml(overview.ai_guidance || "-")}</p></div>
            </section>`
          : ""
      }
      <main class="content">
        ${visibleStreams
          .map(
            (stream) => `
              <section class="stream">
                <div class="stream-head">
                  <h2>${escapeHtml(stream.title || "Baustein")}</h2>
                  <p class="muted">${escapeHtml(stream.short_status || "Keine Kurzlage erfasst.")}</p>
                </div>
                <div class="stream-body">
                  <div class="facts">
                    <div class="fact"><span>Zuständig</span><b>${escapeHtml(stream.owner || "-")}</b></div>
                    <div class="fact"><span>Nächster Schritt</span><b>${escapeHtml(stream.next_step || "-")}</b></div>
                    <div class="fact"><span>Empfehlung</span><b>${escapeHtml(stream.recommendation || "-")}</b></div>
                    <div class="fact"><span>Kundenentscheidung</span><b>${escapeHtml(stream.customer_decision || "-")}</b></div>
                  </div>
                  ${renderTasks(stream)}
                  ${renderChecklists(stream)}
                  ${renderRisks(stream)}
                  ${renderNotes(stream)}
                </div>
              </section>
            `
          )
          .join("")}
      </main>
      <footer class="footer">QT Workbench · Projektmappe · ${escapeHtml(generatedAt)}</footer>
    </article></div>
    </body></html>
  `;
};

const formatExportDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const taskStatusLabel = (value) => {
  const key = String(value || "todo").toLowerCase();
  if (key === "done") return "Erledigt";
  if (key === "blocked") return "Blockiert";
  if (key === "waiting_customer") return "Wartet";
  if (key === "in_progress") return "In Arbeit";
  return "Offen";
};

const streamPriorityLabel = (stream, index) => {
  const priority = String(stream?.priority || stream?.criticality || "").toLowerCase();
  if (priority.includes("hoch") || priority.includes("high") || priority.includes("critical")) return "Hoch";
  if (priority.includes("nied") || priority.includes("low")) return "Niedrig";
  return index < 2 ? "Hoch" : "Normal";
};

const getVisibleStreams = (folder, options = {}) =>
  (folder?.content?.streams || []).filter((stream) => !options.customer_view || !stream.internal_only);

const buildOperationalRows = (folder, options = {}) => {
  const streams = getVisibleStreams(folder, options);
  const tasks = [];
  const checkItems = [];
  const risks = [];
  const phases = [];
  streams.forEach((stream, streamIndex) => {
    const streamTitle = stream.title || `Baustein ${streamIndex + 1}`;
    (stream.tasks || []).forEach((task, taskIndex) => {
      tasks.push({
        nr: `${streamIndex + 1}.${taskIndex + 1}`,
        stream: streamTitle,
        title: task.title || "-",
        status: taskStatusLabel(task.status),
        owner: task.owner || stream.owner || folder?.owner || "-",
        due: task.due_date || task.dueDate || "",
        acceptance: task.acceptance || task.result || ""
      });
    });
    (stream.checklists || []).forEach((list) => {
      (list.items || []).forEach((item, itemIndex) => {
        checkItems.push({
          stream: streamTitle,
          checklist: list.title || "Checkliste",
          title: item.title || `Prüfpunkt ${itemIndex + 1}`,
          status: item.done ? "Erledigt" : "Offen",
          owner: item.owner || stream.owner || folder?.owner || "-",
          due: item.due_date || item.dueDate || ""
        });
      });
    });
    (stream.risks || []).forEach((risk) => {
      risks.push({
        stream: streamTitle,
        level: risk.level || "mittel",
        title: risk.title || "-",
        mitigation: risk.mitigation || risk.recommendation || stream.recommendation || ""
      });
    });
    if (stream.gantt_phases?.length) {
      stream.gantt_phases.forEach((phase) => {
        phases.push({
          phase: phase.title || streamTitle,
          date: [phase.start, phase.start_date, phase.end, phase.end_date].filter(Boolean).map(formatExportDate).join(" - ") || "-",
          owner: phase.owner || stream.owner || folder?.owner || "-",
          content: phase.description || stream.next_step || stream.short_status || "-",
          result: phase.result || phase.acceptance || stream.customer_decision || "-"
        });
      });
    } else {
      phases.push({
        phase: streamTitle,
        date: stream.deadline ? formatExportDate(stream.deadline) : "-",
        owner: stream.owner || folder?.owner || "-",
        content: stream.next_step || stream.short_status || "Baustein vorbereiten und abarbeiten.",
        result: stream.customer_decision || stream.recommendation || "Abnahme dokumentieren."
      });
    }
  });
  return { streams, tasks, checkItems, risks, phases };
};

// --- Helfer für den Einsatzplan (Arbeitszettel) ---

const STEP_PHASE_KEYS = ["Vorbereitung", "Umsetzung", "Prüfung", "Abschluss"];

const classifyStep = (title) => {
  const t = String(title || "").toLowerCase();
  if (/\b(sicher|backup|vorbereit|zugang|abstimm|terminier|wartungsfenster|inform|brief|bereitstell)\b/.test(t)) return "Vorbereitung";
  if (/\b(test|prüf|pruef|kontroll|funktion|verifi|smoke|abnahme|monitoring)\b/.test(t)) return "Prüfung";
  if (/\b(doku|übergab|uebergab|abschlu|cleanup|aufräum|aufraeum|protokoll|ergebnis.*dokument|deinstall|temp.*entfern)\b/.test(t)) return "Abschluss";
  return "Umsetzung";
};

const phaseRank = (phase) => STEP_PHASE_KEYS.indexOf(phase);

const stepStatusInfo = (rawStatus) => {
  const status = String(rawStatus || "open").toLowerCase();
  if (status === "done") return { key: "done", label: "erledigt", checkbox: "☒" };
  if (status === "blocked") return { key: "problem", label: "Problem", checkbox: "⚠" };
  if (status === "skipped") return { key: "skipped", label: "übersprungen", checkbox: "—" };
  if (status === "waiting_customer") return { key: "open", label: "wartet", checkbox: "☐" };
  return { key: "open", label: "offen", checkbox: "☐" };
};

const buildDeploymentSteps = (folder) => {
  const streams = folder?.content?.streams || [];
  const seen = new Set();
  const steps = [];
  streams.forEach((stream) => {
    (stream.tasks || []).forEach((task) => {
      const title = String(task?.title || "").trim();
      if (!title) return;
      const dedupeKey = title.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      const phase = classifyStep(title);
      steps.push({
        title,
        phase,
        rank: phaseRank(phase),
        statusInfo: stepStatusInfo(task.status),
        note: String(task?.note || "").trim()
      });
    });
  });
  steps.sort((a, b) => (a.rank - b.rank) || a.title.localeCompare(b.title, "de"));
  return steps;
};

const buildPreparationItems = (folder) => {
  const streams = folder?.content?.streams || [];
  const fromTasks = streams
    .flatMap((stream) => stream.tasks || [])
    .filter((task) => task?.title && classifyStep(task.title) === "Vorbereitung")
    .slice(0, 3)
    .map((task) => ({ title: String(task.title).trim(), done: String(task.status || "").toLowerCase() === "done" }));
  const generic = [
    "Termin / Wartungsfenster geklärt",
    "Zugangsdaten vorhanden",
    "Backup / Rückfallmöglichkeit geprüft",
    "Benötigte Software / Hardware bereit",
    "Kunde / Benutzer informiert"
  ].map((title) => ({ title, done: false }));
  // De-Dupe gegen die generischen Standardpunkte
  const seen = new Set(fromTasks.map((item) => item.title.toLowerCase()));
  const merged = [...fromTasks];
  generic.forEach((item) => {
    if (!seen.has(item.title.toLowerCase())) merged.push(item);
  });
  return merged.slice(0, 6);
};

const buildControlPoints = (folder) => {
  const streams = folder?.content?.streams || [];
  const points = [];
  const seen = new Set();
  streams.forEach((stream) => {
    (stream.checklists || []).forEach((list) => {
      (list.items || []).forEach((item) => {
        const title = String(item?.title || "").trim();
        if (!title) return;
        const key = title.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        points.push({ title, done: !!item.done });
      });
    });
  });
  if (points.length) return points.slice(0, 8);
  return [
    { title: "Hauptfunktion getestet", done: false },
    { title: "Benutzerzugriff geprüft", done: false },
    { title: "Backup / Rückfallpunkt vorhanden", done: false },
    { title: "Monitoring / Dienste kontrolliert", done: false },
    { title: "Kunde kurz informiert", done: false },
    { title: "Offene Punkte notiert", done: false }
  ];
};

const buildOpenItems = (folder) => {
  const streams = folder?.content?.streams || [];
  const out = [];
  const seen = new Set();
  streams.forEach((stream) => {
    (stream.tasks || []).forEach((task) => {
      const status = String(task?.status || "").toLowerCase();
      if (!(status === "blocked" || status === "waiting_customer")) return;
      const title = String(task?.title || "").trim();
      if (!title) return;
      const key = title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        title,
        owner: task.owner || stream.owner || folder?.owner || "",
        statusLabel: status === "blocked" ? "Problem" : "Wartet auf Kunde"
      });
    });
    (stream.open_points || []).forEach((point) => {
      const text = typeof point === "string" ? point : (point?.title || point?.text || "");
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ title: trimmed, owner: stream.owner || "", statusLabel: "offen" });
    });
  });
  return out;
};

const buildDeploymentTermin = (folder) => {
  const phases = (folder?.content?.streams || []).flatMap((s) => s.gantt_phases || []);
  for (const phase of phases) {
    const start = phase?.start_date || phase?.start;
    const end = phase?.end_date || phase?.end;
    if (start && end) return `${formatExportDate(start)} – ${formatExportDate(end)}`;
    if (start) return formatExportDate(start);
  }
  if (folder?.deadline) return `bis ${formatExportDate(folder.deadline)}`;
  if (folder?.start_date) return formatExportDate(folder.start_date);
  return "—";
};

export const buildProjectOperationalPlanHtml = ({ folder }) => {
  if (!folder) return "";
  const generatedAt = new Date().toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
  const title = folder.title || "Projektmappe";
  const customer = folder.customer || "—";
  const ziel = folder.next_step
    || folder.content?.overview?.target_state
    || folder.current_state
    || "—";
  const termin = buildDeploymentTermin(folder);

  const prep = buildPreparationItems(folder);
  const steps = buildDeploymentSteps(folder);
  const controls = buildControlPoints(folder);
  const openItems = buildOpenItems(folder);

  const checkbox = (checked) => (checked ? "☒" : "☐");

  const prepRows = prep
    .map((item) => `<tr><td class="cb">${checkbox(item.done)}</td><td>${escapeHtml(item.title)}</td></tr>`)
    .join("");

  let lastPhase = "";
  const stepRows = steps.length
    ? steps
        .map((step, index) => {
          const groupRow = step.phase !== lastPhase
            ? `<tr class="group"><td colspan="4">${escapeHtml(step.phase)}</td></tr>`
            : "";
          lastPhase = step.phase;
          return `${groupRow}<tr>
            <td class="nr">${index + 1}</td>
            <td>${escapeHtml(step.title)}</td>
            <td class="status"><span class="cbx">${step.statusInfo.checkbox}</span> <span class="pill ${step.statusInfo.key}">${escapeHtml(step.statusInfo.label)}</span></td>
            <td class="note">${escapeHtml(step.note)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="empty">Keine Arbeitsschritte erfasst – bitte vor Einsatz ergänzen.</td></tr>`;

  const controlRows = controls
    .map((item) => `<tr><td>${escapeHtml(item.title)}</td><td class="cb">${checkbox(item.done)}</td><td></td></tr>`)
    .join("");

  const openRows = openItems
    .map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.owner || "—")}</td><td>${escapeHtml(item.statusLabel)}</td></tr>`)
    .join("");

  return `
    <html><head><meta charset="utf-8"><title>${escapeHtml(title)} – Einsatzplan</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #1f2937; font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.4; font-size: 11px; }
      .page { max-width: 720px; margin: 0 auto; padding: 18px; }
      h1 { margin: 0; font-size: 18px; color: #0f172a; letter-spacing: -0.005em; }
      h2 { margin: 14px 0 5px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 600; }
      .head { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 16px; margin-top: 6px; font-size: 11px; }
      .head .label { color: #94a3b8; margin-right: 4px; }
      .ziel { margin: 8px 0 0; padding: 6px 9px; background: #f8fafc; border-left: 2px solid #cbd5e1; font-size: 11px; }
      .ziel .label { color: #64748b; font-weight: 600; margin-right: 4px; }
      table { width: 100%; border-collapse: collapse; margin: 0; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 5px 7px; text-align: left; vertical-align: top; font-size: 11px; }
      thead th { background: #f8fafc; color: #64748b; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 7px; }
      td.cb { width: 28px; text-align: center; font-size: 13px; line-height: 1; }
      td.nr { width: 26px; color: #94a3b8; text-align: right; }
      td.status { white-space: nowrap; }
      td.note { color: #6b7280; font-size: 10.5px; }
      td.empty { color: #94a3b8; font-style: italic; padding: 10px; text-align: center; }
      tr.group td { background: #f1f5f9; color: #475569; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 7px; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
      .pill { display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 9.5px; font-weight: 600; }
      .pill.open { background: #f1f5f9; color: #475569; }
      .pill.done { background: #dcfce7; color: #166534; }
      .pill.problem { background: #fee2e2; color: #991b1b; }
      .pill.skipped { background: #fef3c7; color: #92400e; }
      .cbx { display: inline-block; width: 13px; font-size: 12px; line-height: 1; color: #475569; }
      .einsatzart .cbx { font-size: 13px; margin-right: 2px; }
      .abschluss { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; font-size: 11px; }
      .abschluss span.cbx { font-size: 14px; color: #475569; }
      .bemerkung { margin-top: 6px; border-bottom: 1px solid #cbd5e1; padding-bottom: 22px; font-size: 10.5px; color: #64748b; }
      .meta-line { margin-top: 8px; font-size: 10px; color: #6b7280; display: flex; gap: 16px; flex-wrap: wrap; }
      .meta-line span { border-bottom: 1px solid #cbd5e1; padding-bottom: 1px; min-width: 110px; display: inline-block; }
      .footer { margin-top: 14px; color: #94a3b8; font-size: 9px; text-align: right; }
      @media print { body { background: #fff; } .page { padding: 0; max-width: none; } table, tr, td, th { page-break-inside: avoid; } h2 { page-break-after: avoid; } }
    </style></head><body>
    <div class="page">
      <header>
        <h1>${escapeHtml(title)} – Einsatzplan</h1>
        <div class="head">
          <div><span class="label">Kunde:</span>${escapeHtml(customer)}</div>
          <div><span class="label">Termin:</span>${escapeHtml(termin)}</div>
          <div class="einsatzart"><span class="label">Einsatzart:</span><span class="cbx">☐</span> vor Ort &nbsp;<span class="cbx">☐</span> remote &nbsp;<span class="cbx">☐</span> gemischt</div>
          <div><span class="label">Stand:</span>${escapeHtml(generatedAt)}</div>
        </div>
        <p class="ziel"><span class="label">Ziel:</span>${escapeHtml(ziel)}</p>
      </header>

      <h2>Vorbereitung vor Start</h2>
      <table><tbody>${prepRows}</tbody></table>

      <h2>Ablauf / Arbeitsschritte</h2>
      <table>
        <thead><tr><th class="nr">Nr.</th><th>Arbeitsschritt</th><th>Status</th><th>Notiz</th></tr></thead>
        <tbody>${stepRows}</tbody>
      </table>

      <h2>Kontrollpunkte</h2>
      <table>
        <thead><tr><th>Prüfung</th><th class="cb">OK</th><th>Bemerkung</th></tr></thead>
        <tbody>${controlRows}</tbody>
      </table>

      ${openItems.length ? `<h2>Offene Punkte</h2>
      <table>
        <thead><tr><th>Offener Punkt</th><th>Zuständig / Hinweis</th><th>Status</th></tr></thead>
        <tbody>${openRows}</tbody>
      </table>` : ""}

      <h2>Abschluss</h2>
      <div class="abschluss">
        <div><span class="cbx">☐</span> Arbeiten abgeschlossen</div>
        <div><span class="cbx">☐</span> Funktion geprüft</div>
        <div><span class="cbx">☐</span> Kunde informiert</div>
      </div>
      <div class="bemerkung">Bemerkung / Abschlussnotiz:</div>
      <div class="meta-line">
        <div>Datum: <span></span></div>
        <div>Techniker: <span></span></div>
        <div>Ansprechpartner: <span></span></div>
      </div>

      <div class="footer">QT Workbench · Einsatzplan · ${escapeHtml(generatedAt)}</div>
    </div>
    </body></html>
  `;
};

export const buildProjectOperationalMatrixHtml = (folder, options = {}) => {
  const { streams, tasks, checkItems, risks, phases } = buildOperationalRows(folder, options);
  const table = (title, headers, items, renderer) => `
    <h2>${escapeHtml(title)}</h2>
    <table><thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>
      ${items.length ? items.map(renderer).join("") : `<tr><td colspan="${headers.length}">Keine Einträge vorhanden.</td></tr>`}
    </tbody></table>
  `;
  return `
    <html><head><meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #172033; }
        h1 { margin: 0 0 6px; font-size: 22px; color: #1f5f99; }
        h2 { margin: 20px 0 8px; font-size: 16px; color: #1f5f99; }
        .meta { margin: 0 0 16px; color: #475569; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
        th { background: #eef4fb; color: #1f5f99; text-align: left; font-weight: 700; }
        th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
      </style>
    </head><body>
      <h1>${escapeHtml(folder?.title || "Projektmappe")} · Einsatzplan</h1>
      <div class="meta">Kunde: ${escapeHtml(folder?.customer || "-")} · Verantwortlich: ${escapeHtml(folder?.owner || "-")} · Deadline: ${escapeHtml(formatExportDate(folder?.deadline))}</div>
      ${table("Ablaufplan", ["Phase", "Termin/Zeitraum", "Verantwortlich", "Inhalt", "Ergebnis/Abnahme"], phases, (phase) => `<tr><td>${escapeHtml(phase.phase)}</td><td>${escapeHtml(phase.date)}</td><td>${escapeHtml(phase.owner)}</td><td>${escapeHtml(phase.content)}</td><td>${escapeHtml(phase.result)}</td></tr>`)}
      ${table("Priorisierung", ["Priorität", "Baustein", "Kurzlage", "Zuständig", "Nächster Schritt"], streams, (stream, index) => `<tr><td>${escapeHtml(streamPriorityLabel(stream, index))}</td><td>${escapeHtml(stream.title || "-")}</td><td>${escapeHtml(stream.short_status || stream.recommendation || "-")}</td><td>${escapeHtml(stream.owner || folder?.owner || "-")}</td><td>${escapeHtml(stream.next_step || "-")}</td></tr>`)}
      ${table("Aufgabenmatrix", ["Nr.", "Baustein", "Aufgabe", "Status", "Zuständig", "Termin", "Abnahme"], tasks, (task) => `<tr><td>${escapeHtml(task.nr)}</td><td>${escapeHtml(task.stream)}</td><td>${escapeHtml(task.title)}</td><td>${escapeHtml(task.status)}</td><td>${escapeHtml(task.owner)}</td><td>${escapeHtml(formatExportDate(task.due))}</td><td>${escapeHtml(task.acceptance || "")}</td></tr>`)}
      ${table("Checklistenmatrix", ["Baustein", "Checkliste", "Prüfpunkt", "Status", "Zuständig", "Termin"], checkItems, (item) => `<tr><td>${escapeHtml(item.stream)}</td><td>${escapeHtml(item.checklist)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.owner)}</td><td>${escapeHtml(formatExportDate(item.due))}</td></tr>`)}
      ${table("Risiken", ["Baustein", "Stufe", "Risiko", "Gegenmaßnahme"], risks, (risk) => `<tr><td>${escapeHtml(risk.stream)}</td><td>${escapeHtml(risk.level)}</td><td>${escapeHtml(risk.title)}</td><td>${escapeHtml(risk.mitigation)}</td></tr>`)}
    </body></html>
  `;
};

export const buildProjectExcelHtml = (folder) => {
  const rows = [["Baustein", "Aufgabe", "Status", "Risiko", "Nächster Schritt"]];
  (folder?.content?.streams || []).forEach((stream) => {
    const tasks = stream.tasks?.length ? stream.tasks : [{ title: "", status: "" }];
    tasks.forEach((task, index) => {
      rows.push([
        index === 0 ? stream.title : "",
        task.title || "",
        task.status || "",
        index === 0 ? stream.risks?.map((risk) => risk.title).join(" | ") || "" : "",
        index === 0 ? stream.next_step || "" : ""
      ]);
    });
  });
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #172033; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin: 0 0 16px; color: #475569; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #e2e8f0; color: #0f172a; text-align: left; font-weight: 700; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
          tr:nth-child(even) td { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(folder?.title || "Projektmappe")}</h1>
        <div class="meta">
          Kunde: ${escapeHtml(folder?.customer || "-")} · Verantwortlich: ${escapeHtml(folder?.owner || "-")} · Deadline: ${escapeHtml(folder?.deadline || "-")}
        </div>
        <table>
          <thead><tr>${rows[0].map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>
          <tbody>${rows.slice(1).map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </body>
    </html>
  `;
};

export const getProjectExportBaseName = (folder) => `${folder?.title || "projektmappe"}`.replace(/[^\w-]+/g, "_");
