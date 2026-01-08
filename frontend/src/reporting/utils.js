export const uid = () => Math.random().toString(36).slice(2, 9);

export const escapeHTML = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const renderReportHTML = (report) => {
  const period = report.period?.trim() || "ohne Zeitraum";
  const actionBlocks = report.actions
    .map(
      (action) => `
    <tr>
      <td style="padding: 16px; border: 1px solid #e7ded1; background: #fff7ee; border-radius: 12px;">
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
      </td>
    </tr>
  `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #1e1b16; background: #fffdf9; border: 1px solid #eadfd2; border-radius: 18px; padding: 24px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding-bottom: 16px; border-bottom: 1px solid #eadfd2;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td>
                  <img src="https://static.wixstatic.com/media/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png" alt="Quansatech" style="height: 24px;" />
                  <div style="font-size: 16px; font-weight: 700; margin-top: 8px;">QT IT-Kundenbericht</div>
                  <div style="font-size: 12px; color: #6b665f;">${escapeHTML(
                    report.customer
                  )} · ${escapeHTML(period)}</div>
                </td>
                <td style="text-align: right; vertical-align: top;">
                  <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: #fef3c7; font-size: 12px;">
                    Status: ${escapeHTML(report.status)}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 16px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Kurz-Zusammenfassung</div>
            <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(
              report.summary
            )}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 14px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Was wir vom Kunden benötigen</div>
            <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(
              report.customer_action_text
            )}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 18px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Maßnahmen</div>
            <table style="margin-top: 8px; width: 100%; border-collapse: collapse; gap: 12px;">
              ${actionBlocks}
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
};

export const buildPlainText = (report) => {
  const period = report.period?.trim() || "ohne Zeitraum";
  const lines = [
    `QT IT-Kundenbericht – ${report.customer}`,
    `${period} | Status: ${report.status}`,
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
    );
  });

  return lines.filter(Boolean).join("\n");
};
