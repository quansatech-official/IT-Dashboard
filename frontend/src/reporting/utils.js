export const uid = () => Math.random().toString(36).slice(2, 9);

export const escapeHTML = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const renderReportHTML = (report, options = {}) => {
  const isEmail = options.mode === "email";
  const isPdf = options.mode === "pdf";
  const period = report.period?.trim() || "ohne Zeitraum";
  const summary = report.summary?.trim() || "";
  const customerAction = report.customer_action_text?.trim() || "";
  const thirdPartyPayload = report.third_party_payload || {};
  const thirdPartyTop = Array.isArray(thirdPartyPayload.top) ? thirdPartyPayload.top : [];
  const thirdPartyTitle = thirdPartyPayload.title || "Sicherheitsreport";
  const thirdPartySource = thirdPartyPayload.sourceName || "";
  const thirdPartyText = "Die Schwachstellen der angezeigten Programme werden bereits aktiv ausgenutzt.";
  const actionSummary = (report.actions || [])
    .map((action) => escapeHTML(action.title || ""))
    .filter(Boolean);
  const actionSummaryLine = actionSummary.length ? actionSummary.join(" · ") : "";
  const summaryLine = summary ? escapeHTML(summary) : "";
  const customerLabel = escapeHTML(report.customer || "");
  const periodLabel = escapeHTML(period);
  const headerSubline = summaryLine
    ? customerLabel
    : period
      ? `${customerLabel} · ${periodLabel}`
      : customerLabel;
  const introText =
    "Sehr geehrter Kunde,\nIm Rahmen unserer monatlichen Systemauswertung erhalten Sie hier eine aktuelle Übersicht über Systeme und Dienste mit Handlungsbedarf.";
  const statusBadge = (status = "") => {
    const map = {
      Grün: { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
      Gelb: { bg: "#fef3c7", text: "#a16207", border: "#fde68a" },
      Rot: { bg: "#fee2e2", text: "#b91c1c", border: "#fecaca" }
    };
    const fallback = { bg: "#f5f5f4", text: "#44403c", border: "#e7e5e4" };
    const style = map[status] || fallback;
    const label = `Status: ${escapeHTML(status || "Status")}`;
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
    return `<span style="display:inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.03em; border: 1px solid ${style.border}; background: ${style.bg}; color: ${style.text};">${label}</span>`;
  };
  const actionBlockContent = (action) => {
    if (action.action_type === "security_report") {
      const customText = String(action.custom_text || "").trim();
      const items = Array.isArray(action.custom_data?.items) ? action.custom_data.items : [];
      const renderChipList = (list, title) => {
        if (!list.length) return "";
        return `<div style="margin-top: 10px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8b8073;">${escapeHTML(
            title
          )}</div>
          <div style="margin-top: 8px;">
            ${list
              .map((entry, index) => {
                const name = escapeHTML(entry.name || "Programm");
                const prio = entry.priority ? escapeHTML(entry.priority) : "Priorität n/a";
                const versionFrom = entry.versionFrom ? escapeHTML(entry.versionFrom) : "";
                const versionLine = versionFrom
                  ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">von ${versionFrom}</div>`
                  : "";
                return `<div style="display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0; background:#ffffff; border-radius:12px; padding:8px 12px; margin-bottom:8px; font-size:12px; color:#334155;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:11px; font-weight:600; color:#94a3b8;">${index + 1}.</span>
                    <div><strong>${name}</strong>${versionLine}</div>
                  </div>
                  <span style="font-size:11px; color:#64748b;">${prio}</span>
                </div>`;
              })
              .join("")}
          </div>
        </div>`;
      };
      return `
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="font-weight: 600; font-size: 12px; line-height: 1.35;">${escapeHTML(
                    action.title || "Sicherheitsreport"
                  )}</td>
                  <td align="right" style="vertical-align: top;">${priorityBadge("Hinweis")}</td>
                </tr>
              </table>
              ${
                customText
                  ? `<div style="margin-top: 8px; font-size: 13px; color:#3f3a33;">${escapeHTML(
                      customText
                    )}</div>`
                  : ""
              }
              ${
                items.length
                  ? `${renderChipList(items, "Programme mit Updatebedarf")}`
                  : `<div style="margin-top: 10px; font-size: 12px; color:#6b665f;">Keine Einträge erkannt.</div>`
              }
            </td>
          </tr>
        </table>
      `;
    }
    return `
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="font-weight: 600; font-size: 12px; line-height: 1.35;">${escapeHTML(
                  action.title
                )}</td>
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
  };
  const actionBlocks = report.actions
    .map((action) => {
      const content = actionBlockContent(action);
      return `
        <tr>
          <td style="padding: 0;">
            <div style="padding: 16px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 14px; page-break-inside: avoid; break-inside: avoid;">
              ${content}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const thirdPartyBlock =
    thirdPartyPayload && (thirdPartyTop.length || thirdPartySource)
      ? `<tr>
            <td style="padding: 10px 24px;">
              <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: #8b8073;">${escapeHTML(
                thirdPartyTitle
              )}</div>
              <div style="margin-top: 10px; padding: 14px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 14px;">
                <div style="font-size: 12px; color: #6b665f; margin-bottom: 10px;">${escapeHTML(
                  thirdPartyText
                )}</div>
                ${
                  thirdPartyTop.length
                    ? `<table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                      ${thirdPartyTop
                        .map((entry) => {
                          const name = escapeHTML(entry.name || "");
                          const installed = escapeHTML(entry.installedVersion || "Version unbekannt");
                          const latest = entry.latestVersion
                            ? ` → ${escapeHTML(entry.latestVersion)}`
                            : "";
                          const severity = entry.severity ? escapeHTML(entry.severity) : "";
                          const cveCount = entry.cveCount ? `${entry.cveCount} CVE` : "";
                          return `<tr>
                            <td style="padding: 6px 0;">
                              <strong>${name}</strong><br/>
                              <span style="color:#6b665f;">${installed}${latest}</span>
                            </td>
                            <td align="right" style="padding: 6px 0; color:#6b665f; white-space: nowrap;">
                              ${[severity, cveCount].filter(Boolean).join(" · ")}
                            </td>
                          </tr>`;
                        })
                        .join("")}
                    </table>`
                    : `<div style="font-size: 12px; color: #6b665f;">Keine Update-Kandidaten erkannt.</div>`
                }
                ${
                  thirdPartySource
                    ? `<div style="margin-top: 8px; font-size: 11px; color: #8b8073;">Quelle: ${escapeHTML(
                        thirdPartySource
                      )}</div>`
                    : ""
                }
              </div>
            </td>
          </tr>`
      : "";

  const containerStyle = isEmail
    ? "width: 640px; max-width: 100%;"
    : isPdf
      ? "width: 100%; max-width: 100%;"
    : "width: 100%; max-width: 720px; margin: 0 auto;";

  const outerBackground = isPdf ? "#ffffff" : "#f7f2ea";
  const outerPadding = isPdf ? "0" : "24px 0";
  const outerCellPadding = isPdf ? "0" : "24px";
  const cardDecoration = isPdf
    ? ""
    : "border-radius: 22px; overflow: hidden; box-shadow: 0 18px 36px rgba(40, 30, 20, 0.12);";

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
                            <div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #d9e2ea; margin-top: 4px;">
                              ${headerSubline}
                            </div>
                            ${
                              summaryLine || actionSummaryLine
                                ? `<div style="font-family: 'Manrope', 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #c6d1da; margin-top: 6px; line-height: 1.4;">
                                  ${summaryLine || actionSummaryLine}
                                </div>`
                                : ""
                            }
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
            ${thirdPartyBlock}
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

  const emailContainer = `
    <table style="${containerStyle} border-collapse: collapse; background: #ffffff; border: 1px solid #e7e1d7; ${cardDecoration}">
      ${innerTable}
    </table>`;

  return `
    <table style="width: 100%; border-collapse: collapse; background: ${outerBackground}; padding: ${outerPadding};">
      <tr>
        <td align="center" style="padding: ${outerCellPadding};">
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
  const thirdPartyPayload = report.third_party_payload || {};
  const thirdPartyTop = Array.isArray(thirdPartyPayload.top) ? thirdPartyPayload.top : [];
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

  if (thirdPartyPayload && (thirdPartyTop.length || thirdPartyPayload.sourceName)) {
    lines.push(thirdPartyPayload.title || "Sicherheitsreport");
    lines.push("Die Schwachstellen der angezeigten Programme werden bereits aktiv ausgenutzt.");
    if (thirdPartyTop.length) {
      thirdPartyTop.forEach((entry) => {
        const name = entry.name || "Programm";
        const installed = entry.installedVersion || "Version unbekannt";
        const latest = entry.latestVersion ? ` -> ${entry.latestVersion}` : "";
        const severity = entry.severity ? ` | ${entry.severity}` : "";
        const cves = entry.cveCount ? ` | ${entry.cveCount} CVE` : "";
        lines.push(`- ${name}: ${installed}${latest}${severity}${cves}`);
      });
    } else {
      lines.push("Keine Update-Kandidaten erkannt.");
    }
    if (thirdPartyPayload.sourceName) {
      lines.push(`Quelle: ${thirdPartyPayload.sourceName}`);
    }
    lines.push("");
  }

  lines.push("Maßnahmen:");

  report.actions.forEach((action, idx) => {
    if (action.action_type === "security_report") {
      const items = Array.isArray(action.custom_data?.items) ? action.custom_data.items : [];
      lines.push(
        "",
        `${idx + 1}. ${action.title || "Sicherheitsreport"}`
      );
      if (action.custom_text) {
        lines.push(action.custom_text);
      }
      if (items.length) {
        lines.push("Programme mit Updatebedarf:");
        items.forEach((item) => {
          const name = item.name || "Programm";
          const suffix = item.versionFrom ? ` (von ${item.versionFrom})` : "";
          lines.push(`- ${name}${suffix}`);
        });
      }
      return;
    }
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
