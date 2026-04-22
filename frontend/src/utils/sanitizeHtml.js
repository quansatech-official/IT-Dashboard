import DOMPurify from "dompurify";

const HTML_PREVIEW_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target", "rel", "style"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "object", "embed", "iframe", "form", "input", "button"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "oninput"]
};

export const sanitizeHtml = (html = "") =>
  DOMPurify.sanitize(String(html || ""), HTML_PREVIEW_CONFIG);
