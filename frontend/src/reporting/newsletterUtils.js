const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const htmlToText = (value = "") =>
  String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

export const paragraphsToHtml = (value = "") =>
  String(value)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

export const buildNewsletterPlainText = (draft = {}) => {
  const parts = [
    String(draft.title || "").trim(),
    htmlToText(draft.intro_html),
    htmlToText(draft.body_html),
    draft.cta_label && draft.cta_url
      ? `${String(draft.cta_label).trim()}: ${String(draft.cta_url).trim()}`
      : String(draft.cta_url || "").trim(),
    htmlToText(draft.closing_html),
  ].filter(Boolean);
  return parts.join("\n\n").trim();
};

export const buildNewsletterHtml = (draft = {}) => {
  const title = escapeHtml(String(draft.title || draft.subject || "Newsletter").trim() || "Newsletter");
  const preheader = escapeHtml(String(draft.preheader || "").trim());
  const intro = String(draft.intro_html || "").trim();
  const body = String(draft.body_html || "").trim();
  const closing = String(draft.closing_html || "").trim();
  const ctaLabel = escapeHtml(String(draft.cta_label || "").trim());
  const ctaUrl = escapeHtml(String(draft.cta_url || "").trim());
  const preheaderText = preheader || title;
  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:collapse;">
          <tr>
            <td bgcolor="#ff5c3e" style="background-color:#ff5c3e;">
              <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>
      `
      : "";
  const introBlock = intro
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:30px;font-weight:700;color:#000000;mso-line-height-rule:exactly;">${intro}</div>`
    : "";
  const bodyBlock = body
    ? `<div style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:26px;color:#000000;mso-line-height-rule:exactly;">${body}</div>`
    : "";
  const closingBlock = closing
    ? `<div style="margin-top:24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:26px;color:#000000;mso-line-height-rule:exactly;">${closing}</div>`
    : "";
  return `
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${preheaderText}
    </div>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#e7e7e7" style="width:100%;border-collapse:collapse;background-color:#e7e7e7;margin:0;padding:0;">
      <tr>
        <td align="center" style="padding:20px 12px 24px;">
          <!--[if mso]>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="700">
            <tr>
              <td>
          <![endif]-->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:700px;border-collapse:collapse;">
            <tr>
              <td align="right" style="padding:0 6px 8px 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;color:#7e878d;">
                ${preheaderText}
              </td>
            </tr>
            <tr>
              <td bgcolor="#ffffff" style="background-color:#ffffff;border-collapse:collapse;">
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td height="112" bgcolor="#123046" style="height:112px;background-color:#123046;line-height:112px;font-size:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td height="8" bgcolor="#72b5cc" style="height:8px;background-color:#72b5cc;line-height:8px;font-size:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:30px 30px 18px 30px;font-family:Arial,Helvetica,sans-serif;">
                      <div style="font-size:30px;line-height:36px;font-weight:700;color:#72b5cc;mso-line-height-rule:exactly;">
                        ${title}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 30px 34px 30px;font-family:Arial,Helvetica,sans-serif;">
                      ${introBlock}
                      ${bodyBlock}
                      ${ctaBlock}
                      ${closingBlock}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 30px 28px 30px;">
                      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td style="border-top:1px solid #d9d9d9;font-size:0;line-height:0;">&nbsp;</td>
                        </tr>
                        <tr>
                          <td style="padding-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:22px;color:#7e878d;mso-line-height-rule:exactly;">
                            QT Workbench Newsletter
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!--[if mso]>
              </td>
            </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  `.trim();
};
