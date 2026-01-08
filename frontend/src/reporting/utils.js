export const uid = () => Math.random().toString(36).slice(2, 9);

export const escapeHTML = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const renderReportHTML = (report) => {
  const period = report.period?.trim() || "ohne Zeitraum";
  const summary = report.summary?.trim() || "";
  const customerAction = report.customer_action_text?.trim() || "";
  const priorityBadge = (priority = "") => {
    const map = {
      Dringend: { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" },
      Planbar: { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
      Hinweis: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" }
    };
    const fallback = { bg: "#f5f5f4", text: "#44403c", border: "#e7e5e4" };
    const style = map[priority] || fallback;
    return `<span style="display:inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; border: 1px solid ${style.border}; background: ${style.bg}; color: ${style.text};">${escapeHTML(
      priority || "Priorität"
    )}</span>`;
  };
  const actionBlocks = report.actions
    .map(
      (action) => `
    <tr>
      <td style="padding: 16px; border: 1px solid #e7ded1; background: #fff7ee; border-radius: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
          <div style="font-weight: 600; font-size: 14px;">${escapeHTML(action.title)}</div>
          ${priorityBadge(action.priority)}
        </div>
        <div style="color: #6b665f; font-size: 12px; margin-top: 2px;">${escapeHTML(
          action.system
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
                  <div style="font-size: 16px; font-weight: 700; margin-top: 8px;">IT-Kundenbericht</div>
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
            <div style="font-size: 13px; color: #3f3a33; white-space: pre-line;">${escapeHTML(
              report.intro_text || ""
            )}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 12px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Status-Hinweis</div>
            <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(
              report.status_note || ""
            )}</div>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 12px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Prioritäten</div>
            <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(
              report.priority_note || ""
            )}</div>
          </td>
        </tr>
        ${
          summary
            ? `<tr>
          <td style="padding-top: 14px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Kurz-Zusammenfassung</div>
            <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(
              summary
            )}</div>
          </td>
        </tr>`
            : ""
        }
        ${
          customerAction
            ? `<tr>
          <td style="padding-top: 14px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Was wir vom Kunden benötigen</div>
            <div style="margin-top: 6px; font-size: 13px; color: #3f3a33;">${escapeHTML(
              customerAction
            )}</div>
          </td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding-top: 18px;">
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b665f;">Maßnahmen</div>
            <table style="margin-top: 8px; width: 100%; border-collapse: collapse; gap: 12px;">
              ${actionBlocks}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding-top: 16px; border-top: 1px solid #eadfd2;">
            <div style="font-size: 11px; color: #6b665f;">
              Kosten und Dauer sind Schätzwerte und stellen kein verbindliches Angebot dar.
            </div>
            <div style="margin-top: 6px; font-size: 11px; color: #6b665f;">
              Prioritäten: Dringend = kurzfristig empfohlen, Planbar = in den nächsten Wochen, Hinweis = sinnvoll, aber optional.
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
};

export const buildPlainText = (report) => {
  const period = report.period?.trim() || "ohne Zeitraum";
  const summary = report.summary?.trim() || "";
  const customerAction = report.customer_action_text?.trim() || "";
  const lines = [
    `IT-Kundenbericht – ${report.customer}`,
    `${period} | Status: ${report.status}`,
    "",
    report.intro_text || "",
    "",
    "Status-Hinweis:",
    report.status_note || "",
    "",
    "Prioritäten:",
    report.priority_note || "",
    "",
    "Maßnahmen:"
  ];

  if (summary) {
    lines.push("", "Kurz-Zusammenfassung:", summary);
  }

  if (customerAction) {
    lines.push("", "Was wir vom Kunden benötigen:", customerAction);
  }

  report.actions.forEach((action, idx) => {
    lines.push(
      "",
      `${idx + 1}. ${action.title} (${action.system}, ${action.priority})`,
      `Warum/Nutzen: ${action.why_text}`,
      `Impact: ${action.impact} | Dauer: ${action.duration} | Kosten: ${action.cost}`,
    );
  });

  lines.push(
    "",
    "Hinweis:",
    "Kosten und Dauer sind Schätzwerte und stellen kein verbindliches Angebot dar.",
    "Prioritäten: Dringend = kurzfristig empfohlen, Planbar = in den nächsten Wochen, Hinweis = sinnvoll, aber optional."
  );

  return lines.filter(Boolean).join("\n");
};
