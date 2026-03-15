const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const NEWSLETTER_FOOTER = {
  company: "Quansatech GmbH",
  street: "Steyrtalstraße 88",
  postalCity: "A-4523 Neuzeug",
  country: "Österreich",
  phoneLabel: "Telefon",
  phone: "+43 720 895056",
  websiteLabel: "www.quansatech.at",
  websiteUrl: "https://www.quansatech.at",
  email: "office@quansatech.at"
};

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
    String(draft.subject || draft.title || "").trim(),
    htmlToText(draft.intro_html),
    htmlToText(draft.body_html),
    htmlToText(draft.closing_html),
    [
      NEWSLETTER_FOOTER.company,
      NEWSLETTER_FOOTER.street,
      NEWSLETTER_FOOTER.postalCity,
      NEWSLETTER_FOOTER.country,
      `${NEWSLETTER_FOOTER.phoneLabel}: ${NEWSLETTER_FOOTER.phone}`,
      NEWSLETTER_FOOTER.websiteLabel,
      NEWSLETTER_FOOTER.email
    ].join("\n")
  ].filter(Boolean);
  return parts.join("\n\n").trim();
};

export const buildNewsletterHtml = (draft = {}) => {
  const title = escapeHtml(String(draft.subject || draft.title || "Newsletter").trim() || "Newsletter");
  const intro = String(draft.intro_html || "").trim();
  const body = String(draft.body_html || "").trim();
  const closing = String(draft.closing_html || "").trim();
  const logoSrc = escapeHtml(String(draft.logo_src || "/QTLogo.jpg").trim() || "/QTLogo.jpg");
  const footerCompany = escapeHtml(NEWSLETTER_FOOTER.company);
  const footerStreet = escapeHtml(NEWSLETTER_FOOTER.street);
  const footerPostalCity = escapeHtml(NEWSLETTER_FOOTER.postalCity);
  const footerCountry = escapeHtml(NEWSLETTER_FOOTER.country);
  const footerPhoneLabel = escapeHtml(NEWSLETTER_FOOTER.phoneLabel);
  const footerPhone = escapeHtml(NEWSLETTER_FOOTER.phone);
  const footerWebsiteLabel = escapeHtml(NEWSLETTER_FOOTER.websiteLabel);
  const footerWebsiteUrl = escapeHtml(NEWSLETTER_FOOTER.websiteUrl);
  const footerEmail = escapeHtml(NEWSLETTER_FOOTER.email);
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
              <td bgcolor="#ffffff" style="background-color:#ffffff;border-collapse:collapse;">
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td bgcolor="#1c2733" style="padding:22px 30px 18px 30px;background-color:#1c2733;">
                      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td align="left" valign="middle">
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
                              <tr>
                                <td bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 20px 14px 20px;border:1px solid #dbe4ea;">
                                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                                    <tr>
                                      <td valign="middle">
                                        <img
                                          src="${logoSrc}"
                                          alt="Quansatech"
                                          width="260"
                                          style="display:block;width:260px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"
                                        />
                                      </td>
                                      <td valign="middle" style="padding-left:18px;font-family:Arial,Helvetica,sans-serif;border-left:1px solid #dbe4ea;">
                                        <div style="font-size:18px;line-height:20px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#1c2733;mso-line-height-rule:exactly;">
                                          Newsletter
                                        </div>
                                        <div style="padding-top:6px;font-size:12px;line-height:18px;color:#5e6a74;mso-line-height-rule:exactly;">
                                          Stabile IT. Klare Loesungen. Persoenlich betreut.
                                        </div>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td height="8" bgcolor="#c58a2d" style="height:8px;background-color:#c58a2d;line-height:8px;font-size:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:34px 30px 18px 30px;font-family:Arial,Helvetica,sans-serif;">
                      <div style="font-size:30px;line-height:36px;font-weight:700;color:#1c2733;mso-line-height-rule:exactly;">
                        ${title}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 30px 34px 30px;font-family:Arial,Helvetica,sans-serif;">
                      ${introBlock}
                      ${bodyBlock}
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
                            <strong style="color:#1c2733;">${footerCompany}</strong><br />
                            ${footerStreet}<br />
                            ${footerPostalCity}<br />
                            ${footerCountry}<br />
                            ${footerPhoneLabel}: ${footerPhone}<br />
                            <a href="${footerWebsiteUrl}" target="_blank" style="color:#1c2733;text-decoration:none;">${footerWebsiteLabel}</a><br />
                            <a href="mailto:${footerEmail}" style="color:#1c2733;text-decoration:none;">${footerEmail}</a>
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
