export const uid = () => Math.random().toString(36).slice(2, 9);

export const escapeHTML = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const renderReportHTML = (report, options = {}) => {
  const isEmail = options.mode === "email";
  const enableMso = isEmail;
  const period = report.period?.trim() || "ohne Zeitraum";
  const summary = report.summary?.trim() || "";
  const customerAction = report.customer_action_text?.trim() || "";
  const introText =
    "Sehr geehrter Kunde,\nIm Rahmen unserer monatlichen Systemauswertung erhalten Sie hier eine aktuelle Übersicht über Systeme und Dienste mit Handlungsbedarf.";
  const vmlRoundRect = ({ fill, stroke, arc, height, content, textStyle }) =>
    enableMso
      ? `
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" arcsize="${arc}" fillcolor="${fill}" strokecolor="${stroke}" strokeweight="1px" style="height:${height}; v-text-anchor:middle; mso-fit-shape-to-text:t;">
          <w:anchorlock/>
          <center style="${textStyle}">${content}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
  `
      : "";
  const vmlRoundRectEnd = enableMso ? `<!--<![endif]-->` : "";
  const statusBadge = (status = "") => {
    const map = {
      Grün: { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
      Gelb: { bg: "#fef3c7", text: "#a16207", border: "#fde68a" },
      Rot: { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" }
    };
    const fallback = { bg: "#f5f5f4", text: "#44403c", border: "#e7e5e4" };
    const style = map[status] || fallback;
    const label = `Status: ${escapeHTML(status || "Status")}`;
    if (enableMso) {
      return `
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" arcsize="50%" fillcolor="${style.bg}" strokecolor="${style.border}" strokeweight="1px" style="height:24px; v-text-anchor:middle; mso-fit-shape-to-text:t;">
          <w:anchorlock/>
          <center style="color:${style.text}; font-family: Arial, sans-serif; font-size:12px; font-weight:600; padding:0 12px;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: ${style.bg}; color: ${style.text}; border: 1px solid ${style.border}; font-size: 12px;">
          ${label}
        </div>
        <!--<![endif]-->
      `;
    }
    return `<div style="display: inline-block; padding: 6px 12px; border-radius: 999px; background: ${style.bg}; color: ${style.text}; border: 1px solid ${style.border}; font-size: 12px;">
      ${label}
    </div>`;
  };
  const priorityBadge = (priority = "") => {
    const map = {
      Dringend: { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" },
      Planbar: { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
      Hinweis: { bg: "#f1f5f9", text: "#475569", border: "#e2e8f0" }
    };
    const fallback = { bg: "#f5f5f4", text: "#44403c", border: "#e7e5e4" };
    const style = map[priority] || fallback;
    const label = escapeHTML(priority || "Priorität");
    if (enableMso) {
      return `
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" arcsize="50%" fillcolor="${style.bg}" strokecolor="${style.border}" strokeweight="1px" style="height:20px; v-text-anchor:middle; mso-fit-shape-to-text:t;">
          <w:anchorlock/>
          <center style="color:${style.text}; font-family: Arial, sans-serif; font-size:11px; font-weight:600; letter-spacing:0.03em; padding:0 10px;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <span style="display:inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; border: 1px solid ${style.border}; background: ${style.bg}; color: ${style.text};">${label}</span>
        <!--<![endif]-->
      `;
    }
    return `<span style="display:inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; border: 1px solid ${style.border}; background: ${style.bg}; color: ${style.text};">${label}</span>`;
  };
  const actionBlockContent = (action) => `
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="font-weight: 600; font-size: 14px;">${escapeHTML(action.title)}</td>
              <td align="right" style="vertical-align: top;">${priorityBadge(action.priority)}</td>
            </tr>
          </table>
          <div style="color: #6b665f; font-size: 12px; margin-top: 2px;">${escapeHTML(
            action.system
          )}</div>
          <div style="margin-top: 8px; font-size: 13px;">${escapeHTML(action.why_text)}</div>
          <table style="margin-top: 10px; width: 100%; font-size: 12px;">
            <tr>
              <td style="padding: 6px 0;" colspan="3"><strong>Auswirkung:</strong> ${escapeHTML(
                action.impact
              )}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0;"><strong>Dauer:</strong> ${escapeHTML(action.duration)}</td>
              <td style="padding: 6px 0;"><strong>Kosten:</strong> ${escapeHTML(action.cost)}</td>
              <td style="padding: 6px 0;"></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
  const actionBlocks = report.actions
    .map((action) => {
      const content = actionBlockContent(action);
      if (enableMso) {
        return `
          <tr>
            <td style="padding: 0;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" arcsize="12%" fillcolor="#f8fafc" strokecolor="#e2e8f0" strokeweight="1px" style="width:100%; mso-width-percent:1000;">
                <w:anchorlock/>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 16px;">
                      ${content}
                    </td>
                  </tr>
                </table>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-- -->
              <div style="padding: 16px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 14px;">
                ${content}
              </div>
              <!--<![endif]-->
            </td>
          </tr>
        `;
      }
      return `
        <tr>
          <td style="padding: 0;">
            <div style="padding: 16px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 14px;">
              ${content}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const containerStyle = isEmail
    ? "width: 640px; max-width: 100%;"
    : "width: 900px; max-width: 100%; margin: 0 auto;";
  const containerMsoStyle = isEmail
    ? "width: 640px;"
    : "width: 900px;";

  const innerTable = `
            <tr>
              <td style="background: #24425a; padding: 18px 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="vertical-align: middle;">
                      <table style="border-collapse: collapse;">
                        <tr>
                          <td style="padding-right: 14px;">
                            <img src="/QTLogo.jpg" alt="Quansatech" width="44" height="44" style="height: 44px; width: 44px; object-fit: contain; display: block;" />
                          </td>
                          <td>
                            <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 18px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">IT-Kundenbericht</div>
                            <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #d9e2ea; margin-top: 4px;">${escapeHTML(
                              report.customer
                            )} · ${escapeHTML(period)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="vertical-align: middle;">
                      ${statusBadge(report.status)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 22px 24px 10px;">
                <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #3f3a33; line-height: 1.55; white-space: pre-line;">
                  ${escapeHTML(introText)}
                </div>
              </td>
            </tr>
            ${
              summary
                ? `<tr>
              <td style="padding: 10px 24px;">
                <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8b8073;">Kurz-Zusammenfassung</div>
                <div style="margin-top: 8px; font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #3f3a33; line-height: 1.55;">${escapeHTML(
                  summary
                )}</div>
              </td>
            </tr>`
                : ""
            }
            ${
              customerAction
                ? `<tr>
              <td style="padding: 10px 24px;">
                <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8b8073;">Was wir vom Kunden benötigen</div>
                <div style="margin-top: 8px; font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #3f3a33; line-height: 1.55;">${escapeHTML(
                  customerAction
                )}</div>
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding: 16px 24px 6px;">
                <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8b8073;">Maßnahmen</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 24px 10px;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                  ${actionBlocks}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 14px 24px 22px; border-top: 1px solid #efe7db;">
                <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #7a7064; line-height: 1.5;">
                  Kosten und Dauer sind Schätzwerte und stellen kein verbindliches Angebot dar.
                </div>
                <div style="margin-top: 6px; font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #7a7064; line-height: 1.5;">
                  Prioritäten: Dringend = kurzfristig empfohlen, Planbar = in den nächsten Wochen, Hinweis = sinnvoll, aber optional.
                </div>
              </td>
            </tr>
  `;

  const emailContainer = enableMso
    ? `
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" arcsize="10%" fillcolor="#ffffff" strokecolor="#e7e1d7" strokeweight="1px" style="${containerMsoStyle}">
      <w:anchorlock/>
      <table style="width: 100%; border-collapse: collapse;">
        ${innerTable}
      </table>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-- -->
    <table style="${containerStyle} border-collapse: collapse; background: #ffffff; border: 1px solid #e7e1d7; border-radius: 22px; overflow: hidden; box-shadow: 0 18px 36px rgba(40, 30, 20, 0.12);">
      ${innerTable}
    </table>
    <!--<![endif]-->`
    : `
    <table style="${containerStyle} border-collapse: collapse; background: #ffffff; border: 1px solid #e7e1d7; border-radius: 22px; overflow: hidden; box-shadow: 0 18px 36px rgba(40, 30, 20, 0.12);">
      ${innerTable}
    </table>`;

  return `
    <table style="width: 100%; border-collapse: collapse; background: #f7f2ea; padding: 24px 0;">
      <tr>
        <td align="center" style="padding: 24px;">
          ${emailContainer}
        </td>
      </tr>
    </table>
  `;
};

export const buildPlainText = (report) => {
  const period = report.period?.trim() || "ohne Zeitraum";
  const summary = report.summary?.trim() || "";
  const customerAction = report.customer_action_text?.trim() || "";
  const introText =
    "Sehr geehrter Kunde,\nIm Rahmen unserer monatlichen Systemauswertung erhalten Sie hier eine aktuelle Übersicht über Systeme und Dienste mit Handlungsbedarf.";
  const lines = [
    `IT-Kundenbericht – ${report.customer}`,
    `${period} | Status: ${report.status}`,
    ""
  ];

  lines.push(introText, "");

  if (summary) {
    lines.push("Kurz-Zusammenfassung:", summary, "");
  }

  if (customerAction) {
    lines.push("Was wir vom Kunden benötigen:", customerAction, "");
  }

  lines.push("Maßnahmen:");

  report.actions.forEach((action, idx) => {
    lines.push(
      "",
      `${idx + 1}. ${action.title} (${action.system}, ${action.priority})`,
      `Warum/Nutzen: ${action.why_text}`,
      `Auswirkung: ${action.impact}`,
      `Dauer: ${action.duration} | Kosten: ${action.cost}`
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
