export const uid = () => Math.random().toString(36).slice(2, 9);

export const escapeHTML = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const renderReportHTML = (report) => {
  const actionBlocks = report.actions
    .map(
      (action) => `
    <tr>
      <td style="padding: 14px; border: 1px solid #e7ded1; background: #fff7ee;">
        <div style="font-weight: 600; font-size: 14px;">${escapeHTML(action.title)}</div>
        <div style="color: #6b665f; font-size: 12px;">${escapeHTML(action.system)} · ${escapeHTML(
        action.priority
      )}</div>
        <div style="margin-top: 8px; font-size: 13px;">${escapeHTML(action.why_text)}</div>
        <table style="margin-top: 10px; width: 100%; font-size: 12px;">
          <tr>
            <td style="padding: 6px 0;"><strong>Impact:</strong> ${escapeHTML(action.impact)}</td>
            <td style="padding: 6px 0;"><strong>Dauer:</strong> ${escapeHTML(action.duration)}</td>
            <td style="padding: 6px 0;"><strong>Kosten:</strong> ${escapeHTML(action.cost)}</td>
          </tr>
        </table>
        ${
          action.security_note
            ? `<div style="margin-top: 8px; font-size: 12px; color: #b45309;"><strong>Security:</strong> ${escapeHTML(
                action.security_note
              )}</div>`
            : ""
        }
      </td>
    </tr>
  `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #1e1b16; background: #fffdf9; border: 1px solid #eadfd2; border-radius: 16px; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eadfd2; padding-bottom: 12px;">
        <div>
          <div style="font-size: 18px; font-weight: 700;">QT Workbench Kundenbericht</div>
          <div style="font-size: 12px; color: #6b665f;">${escapeHTML(report.customer)} · ${escapeHTML(
    report.month
  )} ${report.year}</div>
        </div>
        <div style="padding: 6px 12px; border-radius: 999px; background: #fef3c7; font-size: 12px;">Status: ${escapeHTML(
          report.status
        )}</div>
      </div>
      <div style="margin-top: 16px; font-size: 13px;"><strong>Kurz-Zusammenfassung</strong></div>
      <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(report.summary)}</div>
      <div style="margin-top: 16px; font-size: 13px;"><strong>Was wir vom Kunden benötigen</strong></div>
      <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(
        report.customer_action_text
      )}</div>
      <div style="margin-top: 18px; font-size: 13px;"><strong>Maßnahmen</strong></div>
      <table style="margin-top: 8px; width: 100%; border-collapse: collapse;">
        ${actionBlocks}
      </table>
    </div>
  `;
};

export const buildPlainText = (report) => {
  const lines = [
    `QT Workbench Kundenbericht – ${report.customer}`,
    `${report.month} ${report.year} | Status: ${report.status}`,
    "",
    "Kurz-Zusammenfassung:",
    report.summary,
    "",
    "Was wir vom Kunden benötigen:",
    report.customer_action_text,
    "",
    "Maßnahmen:"
  ];

  report.actions.forEach((action, idx) => {
    lines.push(
      "",
      `${idx + 1}. ${action.title} (${action.system}, ${action.priority})`,
      `Warum/Nutzen: ${action.why_text}`,
      `Impact: ${action.impact} | Dauer: ${action.duration} | Kosten: ${action.cost}`,
      action.security_note ? `Security: ${action.security_note}` : ""
    );
  });

  return lines.filter(Boolean).join("\n");
};
