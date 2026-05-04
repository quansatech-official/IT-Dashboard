import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Eye,
  ExternalLink,
  FilePlus2,
  Layers3,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Rss,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users2
} from "lucide-react";
import EmailComposerModal from "../components/EmailComposerModal";
import {
  buildNewsletterHtml,
  buildNewsletterPlainText,
  paragraphsToHtml
} from "./newsletterUtils";
import NotesRichTextEditor from "../components/NotesRichTextEditor";
import { sanitizeHtml } from "../utils/sanitizeHtml";

const defaultDraft = {
  id: null,
  subject: "",
  content: "",
  selected_group_ids: [],
  selected_customer_ids: [],
  manual_recipients: ""
};

const defaultGroupForm = {
  id: null,
  name: "",
  description: "",
  customerIds: []
};

const defaultRssFeedForm = {
  id: null,
  name: "",
  url: "",
  description: "",
  enabled: true
};

const normalizeIdList = (values = []) => {
  const seen = new Set();
  return values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
};

const normalizeEmailList = (value = "") => {
  const seen = new Set();
  return String(value)
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const customerNewsletterEmail = (customer) =>
  String(
    customer?.newsletter_effective_email ??
      customer?.newsletterEffectiveEmail ??
      customer?.newsletter_email ??
      customer?.newsletterEmail ??
      customer?.email ??
      ""
  ).trim();

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const joinContentBlocks = (...values) =>
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("")
    .trim();

const buildDraftPayload = (draft) => ({
  ...draft,
  intro_html: "",
  body_html: String(draft.content || "").trim(),
  closing_html: ""
});

const formatArticleDate = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const date = new Date(numeric);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE");
};

const buildArticleBlock = (article = {}) => {
  const title = escapeHtml(String(article.title || "").trim());
  const summary = escapeHtml(String(article.summary || "").trim());
  const link = String(article.link || "").trim();
  return `
    <section>
      ${title ? `<h2>${title}</h2>` : ""}
      ${summary ? `<p>${summary}</p>` : ""}
      ${link ? `<p><a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">Mehr dazu</a></p>` : ""}
    </section>
  `.trim();
};

const ALLOWED_HTML_TAGS = /^(h2|p|ul|ol|li|strong|em|b|u|br)$/i;

// Inline styles matching the established newsletter design (see BitLocker muster)
const KPI_BOX_STYLES = {
  "box-red":    "background:#fff3f3;border-left:4px solid #d60000;padding:12px;margin:15px 0;font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;",
  "box-yellow": "background:#fffbf0;border-left:4px solid #d97706;padding:12px;margin:15px 0;font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;",
  "box-green":  "background:#f0fff4;border-left:4px solid #16a34a;padding:12px;margin:15px 0;font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222;line-height:1.5;",
  "box-info":   "background:#f5f7fa;padding:10px;margin-top:20px;font-size:12px;color:#555;font-family:Segoe UI,Arial,sans-serif;line-height:1.5;",
};

const LABEL_STYLES = {
  "box-red":    "color:#d60000;",
  "box-yellow": "color:#b45309;",
  "box-green":  "color:#15803d;",
  "box-info":   "color:#444;",
};

// Replace <div class="box-*">…</div> with inline-styled divs matching the newsletter muster
const applyKpiBoxStyles = (html = "") => {
  return String(html).replace(
    /<div\s+class="(box-red|box-yellow|box-green|box-info)">([\s\S]*?)<\/div>/gi,
    (_, cls, inner) => {
      const style = KPI_BOX_STYLES[cls] || "";
      // Bold the first sentence if it starts with <b> — add label color
      const styledInner = inner.replace(
        /^(\s*)<b>/,
        `$1<b style="${LABEL_STYLES[cls] || ""}">`
      );
      return `<div style="${style}">${styledInner}</div>`;
    }
  );
};

const sanitizeAiHtml = (html = "") => {
  let result = String(html);

  // First: convert class-based KPI boxes to inline-styled divs (before tag stripping)
  result = applyKpiBoxStyles(result);

  // Then: strip all tags except the allowed set and already-inlined divs
  result = result.replace(/<(\/?)([\w]+)([^>]*)>/g, (match, slash, tag, attrs) => {
    if (ALLOWED_HTML_TAGS.test(tag)) return match;
    // Preserve already-processed <div style="..."> from applyKpiBoxStyles
    if (tag.toLowerCase() === "div" && attrs.trim().startsWith('style=')) return match;
    if (/^(section|article|blockquote|header|footer)$/i.test(tag)) return "";
    return "";
  });

  return result.replace(/\n{3,}/g, "\n\n").trim();
};

const extractNewsletterDraftFromAi = (value = "") => {
  const raw = String(value).trim();
  if (!raw) return { subject: "", preheader: "", content: "" };

  const lines = raw.split("\n");
  let subject = "";
  let preheader = "";
  let bodyStartIndex = 0;

  // Parse structured header: BETREFF: … / PREHEADER: …
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i].trim();
    if (!subject && /^BETREFF:\s*/i.test(line)) {
      subject = line.replace(/^BETREFF:\s*/i, "").trim();
      bodyStartIndex = i + 1;
    } else if (!preheader && /^PREHEADER:\s*/i.test(line)) {
      preheader = line.replace(/^PREHEADER:\s*/i, "").trim();
      bodyStartIndex = i + 1;
    }
  }

  // Skip blank lines after the header block
  while (bodyStartIndex < lines.length && !lines[bodyStartIndex].trim()) {
    bodyStartIndex++;
  }

  const bodyText = lines.slice(bodyStartIndex).join("\n").trim();

  // Decide if body is HTML or plain text
  const looksLikeHtml = /<(h2|p|ul|li|strong|em|b|div)\b/i.test(bodyText);
  const content = looksLikeHtml ? sanitizeAiHtml(bodyText) : paragraphsToHtml(bodyText);

  // Fallback: if no structured header found, treat first line as subject
  if (!subject) {
    const nonEmpty = lines.filter((l) => l.trim());
    subject = nonEmpty[0]?.trim() || "";
    const rest = raw.slice(raw.indexOf("\n")).trim();
    return { subject, preheader: "", content: looksLikeHtml ? sanitizeAiHtml(rest) : paragraphsToHtml(rest) };
  }

  return { subject, preheader, content };
};

const mapNewsletterToDraft = (item = {}) => ({
  ...defaultDraft,
  id: item.id ?? null,
  subject: String(item.subject || item.title || ""),
  content: joinContentBlocks(item.intro_html, item.body_html, item.closing_html),
  selected_group_ids: normalizeIdList(item.selected_group_ids || []),
  selected_customer_ids: normalizeIdList(item.selected_customer_ids || []),
  manual_recipients: Array.isArray(item.recipient_emails) ? item.recipient_emails.join(", ") : ""
});

const formatDateTime = (value) => {
  if (!value) return "Noch nicht gesendet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Noch nicht gesendet";
  return date.toLocaleString("de-DE");
};

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export default function NewsletterView() {
  const [draft, setDraft] = useState(defaultDraft);
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newsletters, setNewsletters] = useState([]);
  const [groupForm, setGroupForm] = useState(defaultGroupForm);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [rssFeeds, setRssFeeds] = useState([]);
  const [rssFeedForm, setRssFeedForm] = useState(defaultRssFeedForm);
  const [rssModalOpen, setRssModalOpen] = useState(false);
  const [rssArticles, setRssArticles] = useState([]);
  const [rssFeedResults, setRssFeedResults] = useState([]);
  const [selectedRssFeedId, setSelectedRssFeedId] = useState("all");
  const [selectedRssArticleIds, setSelectedRssArticleIds] = useState([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRssLoading, setIsRssLoading] = useState(false);
  const [isRssSaving, setIsRssSaving] = useState(false);
  const [isRssGenerating, setIsRssGenerating] = useState(false);
  const [rawNewsletterText, setRawNewsletterText] = useState("");
  const [isRawGenerating, setIsRawGenerating] = useState(false);
  const [aiTone, setAiTone] = useState("sachlich");
  const [newsletterTab, setNewsletterTab] = useState("draft");
  const [previewVisible, setPreviewVisible] = useState(true);
  const [manualRecipientsOpen, setManualRecipientsOpen] = useState(false);
  const [previewModal, setPreviewModal] = useState({ open: false, title: "", html: "" });
  const [sendComposer, setSendComposer] = useState({
    open: false,
    newsletterId: null,
    recipient: "",
    subject: "",
    html: "",
    text: "",
    isSending: false
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [customersRes, groupsRes, newslettersRes, rssFeedsRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/newsletter_groups"),
        fetch("/api/newsletters"),
        fetch("/api/newsletter_rss_feeds")
      ]);
      const [customersData, groupsData, newslettersData, rssFeedsData] = await Promise.all([
        customersRes.json().catch(() => []),
        groupsRes.json().catch(() => []),
        newslettersRes.json().catch(() => []),
        rssFeedsRes.json().catch(() => [])
      ]);
      setCustomers(
        Array.isArray(customersData)
          ? customersData
              .map((item) => ({
                id: Number(item.id || 0),
                name: String(item.name || "").trim(),
                email: String(item.email || "").trim(),
                newsletter: Boolean(item.newsletter),
                status: String(item.status || "active").trim().toLowerCase() || "active"
              }))
              .filter((item) => item.id > 0 && item.name)
              .sort((a, b) => a.name.localeCompare(b.name, "de"))
          : []
      );
      setGroups(
        Array.isArray(groupsData)
          ? groupsData
              .map((item) => ({
                id: Number(item.id || 0),
                name: String(item.name || "").trim(),
                description: String(item.description || "").trim(),
                customer_ids: normalizeIdList(item.customer_ids || []),
                customers: Array.isArray(item.customers) ? item.customers : [],
                recipient_count: Number(item.recipient_count || 0)
              }))
              .filter((item) => item.id > 0 && item.name)
          : []
      );
      setNewsletters(Array.isArray(newslettersData) ? newslettersData : []);
      setRssFeeds(
        Array.isArray(rssFeedsData)
          ? rssFeedsData
              .map((item) => ({
                id: Number(item.id || 0),
                name: String(item.name || "").trim(),
                url: String(item.url || "").trim(),
                description: String(item.description || "").trim(),
                enabled: item.enabled !== false
              }))
              .filter((item) => item.id > 0 && item.name && item.url)
              .sort((a, b) => a.name.localeCompare(b.name, "de"))
          : []
      );
    } catch {
      setToast("Newsletter-Daten konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    loadRssArticles(selectedRssFeedId);
  }, [selectedRssFeedId, isLoading]);

  const newsletterCustomers = useMemo(
    () => customers.filter((customer) => customer.newsletter && customer.status === "active"),
    [customers]
  );

  const allCustomersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const newsletterCustomerById = useMemo(
    () => new Map(newsletterCustomers.map((customer) => [customer.id, customer])),
    [newsletterCustomers]
  );

  const optedOutEmailSet = useMemo(
    () =>
      new Set(
        customers
          .filter((customer) => !customer.newsletter && customerNewsletterEmail(customer))
          .map((customer) => customerNewsletterEmail(customer).toLowerCase())
          .filter(Boolean)
      ),
    [customers]
  );

  const groupCustomerIds = useMemo(() => {
    const ids = [];
    groups.forEach((group) => {
      if (!draft.selected_group_ids.includes(group.id)) return;
      ids.push(...normalizeIdList(group.customer_ids));
    });
    return normalizeIdList(ids);
  }, [draft.selected_group_ids, groups]);

  const resolvedCustomerIds = useMemo(
    () => normalizeIdList([...groupCustomerIds, ...draft.selected_customer_ids]),
    [draft.selected_customer_ids, groupCustomerIds]
  );

  const manualRecipientList = useMemo(
    () => normalizeEmailList(draft.manual_recipients),
    [draft.manual_recipients]
  );

  const resolvedRecipients = useMemo(() => {
    const emails = resolvedCustomerIds
      .map((customerId) => customerNewsletterEmail(newsletterCustomerById.get(customerId)) || "")
      .filter(Boolean);
    return normalizeEmailList([...emails, ...manualRecipientList].join(",")).filter(
      (email) => !optedOutEmailSet.has(String(email || "").trim().toLowerCase())
    );
  }, [newsletterCustomerById, manualRecipientList, optedOutEmailSet, resolvedCustomerIds]);

  const missingEmailCustomers = useMemo(
    () =>
      resolvedCustomerIds
        .map((customerId) => newsletterCustomerById.get(customerId))
        .filter((customer) => customer && !customerNewsletterEmail(customer)),
    [newsletterCustomerById, resolvedCustomerIds]
  );

  const optedOutCustomers = useMemo(
    () =>
      resolvedCustomerIds
        .map((customerId) => allCustomersById.get(customerId))
        .filter((customer) => customer && !customer.newsletter),
    [allCustomersById, resolvedCustomerIds]
  );

  const resolvedDraft = useMemo(() => buildDraftPayload(draft), [draft]);
  const previewHtml = useMemo(
    () => sanitizeHtml(buildNewsletterHtml({ ...resolvedDraft, logo_src: "/QTLogo.jpg" })),
    [resolvedDraft]
  );

  const filteredRecipientCustomers = useMemo(() => {
    const needle = recipientSearch.trim().toLowerCase();
    if (!needle) return newsletterCustomers;
    return newsletterCustomers.filter((customer) => {
      const haystack = `${customer.name} ${customerNewsletterEmail(customer)}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [newsletterCustomers, recipientSearch]);

  const filteredGroupCustomers = useMemo(() => {
    const needle = groupSearch.trim().toLowerCase();
    if (!needle) return newsletterCustomers;
    return newsletterCustomers.filter((customer) => {
      const haystack = `${customer.name} ${customerNewsletterEmail(customer)}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [groupSearch, newsletterCustomers]);

  const selectedRssArticles = useMemo(() => {
    const wanted = new Set(selectedRssArticleIds);
    return rssArticles.filter((article) => wanted.has(article.id));
  }, [rssArticles, selectedRssArticleIds]);

  const selectedRssFeedSummary = useMemo(() => {
    if (selectedRssFeedId === "all") return null;
    return rssFeeds.find((feed) => feed.id === Number(selectedRssFeedId)) || null;
  }, [rssFeeds, selectedRssFeedId]);

  const upsertNewsletter = (item) =>
    setNewsletters((prev) => {
      const exists = prev.some((entry) => entry.id === item.id);
      if (!exists) return [item, ...prev];
      return prev
        .map((entry) => (entry.id === item.id ? item : entry))
        .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
    });

  const upsertGroup = (item) =>
    setGroups((prev) => {
      const exists = prev.some((entry) => entry.id === item.id);
      if (!exists) return [...prev, item].sort((a, b) => a.name.localeCompare(b.name, "de"));
      return prev
        .map((entry) => (entry.id === item.id ? item : entry))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
    });

  const upsertRssFeed = (item) =>
    setRssFeeds((prev) => {
      const exists = prev.some((entry) => entry.id === item.id);
      if (!exists) return [...prev, item].sort((a, b) => a.name.localeCompare(b.name, "de"));
      return prev
        .map((entry) => (entry.id === item.id ? item : entry))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
    });

  const loadRssArticles = async (feedId = selectedRssFeedId) => {
    setIsRssLoading(true);
    try {
      const query = feedId && feedId !== "all" ? `?feed_id=${encodeURIComponent(feedId)}&limit=24` : "?limit=24";
      const res = await fetch(`/api/newsletter_rss_articles${query}`);
      const data = await res.json().catch(() => ({ feeds: [], items: [] }));
      if (!res.ok) {
        throw new Error(typeof data?.detail === "string" ? data.detail : `status_${res.status}`);
      }
      setRssArticles(Array.isArray(data.items) ? data.items : []);
      setRssFeedResults(Array.isArray(data.feeds) ? data.feeds : []);
      setSelectedRssArticleIds((prev) => prev.filter((id) => (data.items || []).some((item) => item.id === id)));
    } catch (error) {
      setToast(`RSS-Artikel konnten nicht geladen werden.${error?.message ? ` (${error.message})` : ""}`);
      setRssArticles([]);
      setRssFeedResults([]);
    } finally {
      setIsRssLoading(false);
    }
  };

  const saveNewsletter = async () => {
    if (!draft.subject.trim()) {
      setToast("Bitte Betreff eingeben.");
      return null;
    }
    if (!resolvedRecipients.length) {
      setToast("Bitte mindestens einen Empfänger wählen.");
      return null;
    }
    setIsSaving(true);
    try {
      const payload = {
        title: draft.subject,
        subject: draft.subject,
        preheader: "",
        intro_html: resolvedDraft.intro_html,
        body_html: resolvedDraft.body_html,
        cta_label: "",
        cta_url: "",
        closing_html: resolvedDraft.closing_html,
        selected_group_ids: draft.selected_group_ids,
        selected_customer_ids: draft.selected_customer_ids,
        recipient_emails: manualRecipientList
      };
      const url = draft.id ? `/api/newsletters/${draft.id}` : "/api/newsletters";
      const method = draft.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `status_${res.status}`);
      }
      const saved = await res.json();
      upsertNewsletter(saved);
      setDraft(mapNewsletterToDraft(saved));
      setToast(draft.id ? "Newsletter aktualisiert." : "Newsletter gespeichert.");
      return saved;
    } catch (error) {
      setToast(`Speichern fehlgeschlagen.${error?.message ? ` (${error.message})` : ""}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const openSendComposer = (item) => {
    const normalized = buildDraftPayload(mapNewsletterToDraft(item));
    const storedRecipients = Array.isArray(item.recipient_emails)
      ? normalizeEmailList(item.recipient_emails.join(", ")).filter(
          (email) => !optedOutEmailSet.has(String(email || "").trim().toLowerCase())
        )
      : [];
    setSendComposer({
      open: true,
      newsletterId: item.id,
      recipient: storedRecipients.length ? storedRecipients.join(", ") : resolvedRecipients.join(", "),
      subject: normalized.subject,
      html: buildNewsletterHtml({ ...normalized, logo_src: "cid:qtlogo" }),
      text: buildNewsletterPlainText(normalized),
      isSending: false
    });
  };

  const handleSendPreparation = async () => {
    const saved = await saveNewsletter();
    if (!saved) return;
    openSendComposer(saved);
  };

  const handleComposerSend = async () => {
    const recipients = normalizeEmailList(sendComposer.recipient);
    if (!sendComposer.newsletterId || !recipients.length) {
      setToast("Bitte mindestens eine Empfängeradresse angeben.");
      return;
    }
    setSendComposer((prev) => ({ ...prev, isSending: true }));
    try {
      const attachments = [];
      let htmlForSend = String(sendComposer.html || "");
      try {
        const logoRes = await fetch("/QTLogo.jpg");
        if (logoRes.ok) {
          const logoBlob = await logoRes.blob();
          const logoBase64 = String(await blobToBase64(logoBlob)).split(",")[1] || "";
          if (logoBase64) {
            attachments.push({
              filename: "QTLogo.jpg",
              content_base64: logoBase64,
              content_type: "image/jpeg",
              content_id: "qtlogo",
              inline: true
            });
          } else {
            htmlForSend = htmlForSend.replace(/cid:qtlogo/g, "/QTLogo.jpg");
          }
        } else {
          htmlForSend = htmlForSend.replace(/cid:qtlogo/g, "/QTLogo.jpg");
        }
      } catch {
        htmlForSend = htmlForSend.replace(/cid:qtlogo/g, "/QTLogo.jpg");
      }
      const res = await fetch(`/api/newsletters/${sendComposer.newsletterId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_emails: recipients,
          subject: sendComposer.subject,
          html: htmlForSend,
          text: sendComposer.text,
          attachments
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `status_${res.status}`);
      }
      const updated = await res.json();
      upsertNewsletter(updated);
      if (draft.id === updated.id) {
        setDraft(mapNewsletterToDraft(updated));
      }
      setSendComposer((prev) => ({ ...prev, open: false, isSending: false }));
      setToast(`Newsletter an ${recipients.length} Empfänger gesendet.`);
    } catch (error) {
      setSendComposer((prev) => ({ ...prev, isSending: false }));
      setToast(`Versand fehlgeschlagen.${error?.message ? ` (${error.message})` : ""}`);
    }
  };

  const handleDeleteNewsletter = async (newsletterId) => {
    if (!window.confirm("Archivierten Newsletter löschen?")) return;
    try {
      const res = await fetch(`/api/newsletters/${newsletterId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setNewsletters((prev) => prev.filter((item) => item.id !== newsletterId));
      if (draft.id === newsletterId) {
        setDraft(defaultDraft);
      }
      setToast("Newsletter gelöscht.");
    } catch {
      setToast("Löschen fehlgeschlagen.");
    }
  };

  const handleEditNewsletter = (item) => {
    setDraft(mapNewsletterToDraft(item));
    setToast("Newsletter aus Archiv geladen.");
  };

  const handlePreviewNewsletter = (item) => {
    const normalized = buildDraftPayload(mapNewsletterToDraft(item));
    setPreviewModal({
      open: true,
      title: normalized.subject || "Newsletter Vorschau",
      html: buildNewsletterHtml(normalized)
    });
  };

  const handleGroupSelect = (group) => {
    setGroupForm({
      id: group.id,
      name: group.name || "",
      description: group.description || "",
      customerIds: normalizeIdList(group.customer_ids || [])
    });
  };

  const handleGroupSave = async () => {
    if (!groupForm.name.trim()) {
      setToast("Bitte Gruppennamen eingeben.");
      return;
    }
    try {
      const payload = {
        name: groupForm.name,
        description: groupForm.description,
        customer_ids: groupForm.customerIds
      };
      const res = await fetch(
        groupForm.id ? `/api/newsletter_groups/${groupForm.id}` : "/api/newsletter_groups",
        {
          method: groupForm.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `status_${res.status}`);
      }
      const saved = await res.json();
      upsertGroup(saved);
      setGroupForm({
        id: saved.id,
        name: saved.name || "",
        description: saved.description || "",
        customerIds: normalizeIdList(saved.customer_ids || [])
      });
      setToast(groupForm.id ? "Gruppe aktualisiert." : "Gruppe angelegt.");
    } catch (error) {
      setToast(`Gruppe konnte nicht gespeichert werden.${error?.message ? ` (${error.message})` : ""}`);
    }
  };

  const handleGroupDelete = async () => {
    if (!groupForm.id) return;
    if (!window.confirm("Newsletter-Gruppe löschen?")) return;
    try {
      const res = await fetch(`/api/newsletter_groups/${groupForm.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setGroups((prev) => prev.filter((group) => group.id !== groupForm.id));
      setDraft((prev) => ({
        ...prev,
        selected_group_ids: prev.selected_group_ids.filter((groupId) => groupId !== groupForm.id)
      }));
      setGroupForm(defaultGroupForm);
      setToast("Gruppe gelöscht.");
    } catch {
      setToast("Gruppe konnte nicht gelöscht werden.");
    }
  };

  const toggleDraftGroup = (groupId) =>
    setDraft((prev) => ({
      ...prev,
      selected_group_ids: prev.selected_group_ids.includes(groupId)
        ? prev.selected_group_ids.filter((entry) => entry !== groupId)
        : [...prev.selected_group_ids, groupId]
    }));

  const toggleDraftCustomer = (customerId) =>
    setDraft((prev) => ({
      ...prev,
      selected_customer_ids: prev.selected_customer_ids.includes(customerId)
        ? prev.selected_customer_ids.filter((entry) => entry !== customerId)
        : [...prev.selected_customer_ids, customerId]
    }));

  const toggleGroupCustomer = (customerId) =>
    setGroupForm((prev) => ({
      ...prev,
      customerIds: prev.customerIds.includes(customerId)
        ? prev.customerIds.filter((entry) => entry !== customerId)
        : [...prev.customerIds, customerId]
    }));

  const handleRssFeedSelect = (feed) => {
    setRssFeedForm({
      id: feed.id,
      name: feed.name || "",
      url: feed.url || "",
      description: feed.description || "",
      enabled: feed.enabled !== false
    });
    setSelectedRssFeedId(feed.id);
  };

  const handleRssFeedSave = async () => {
    if (!rssFeedForm.name.trim() || !rssFeedForm.url.trim()) {
      setToast("Bitte Feed-Name und URL eingeben.");
      return;
    }
    setIsRssSaving(true);
    try {
      const payload = {
        name: rssFeedForm.name,
        url: rssFeedForm.url,
        description: rssFeedForm.description,
        enabled: rssFeedForm.enabled
      };
      const res = await fetch(
        rssFeedForm.id ? `/api/newsletter_rss_feeds/${rssFeedForm.id}` : "/api/newsletter_rss_feeds",
        {
          method: rssFeedForm.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const saved = await res.json().catch(() => null);
      if (!res.ok || !saved) {
        throw new Error(typeof saved?.detail === "string" ? saved.detail : `status_${res.status}`);
      }
      const normalized = {
        id: Number(saved.id || 0),
        name: String(saved.name || "").trim(),
        url: String(saved.url || "").trim(),
        description: String(saved.description || "").trim(),
        enabled: saved.enabled !== false
      };
      upsertRssFeed(normalized);
      setRssFeedForm({
        id: normalized.id,
        name: normalized.name,
        url: normalized.url,
        description: normalized.description,
        enabled: normalized.enabled
      });
      setSelectedRssFeedId(normalized.id);
      setToast(rssFeedForm.id ? "RSS-Feed aktualisiert." : "RSS-Feed angelegt.");
    } catch (error) {
      setToast(`RSS-Feed konnte nicht gespeichert werden.${error?.message ? ` (${error.message})` : ""}`);
    } finally {
      setIsRssSaving(false);
    }
  };

  const handleRssFeedDelete = async () => {
    if (!rssFeedForm.id) return;
    if (!window.confirm("RSS-Feed löschen?")) return;
    try {
      const res = await fetch(`/api/newsletter_rss_feeds/${rssFeedForm.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRssFeeds((prev) => prev.filter((feed) => feed.id !== rssFeedForm.id));
      setRssFeedForm(defaultRssFeedForm);
      setSelectedRssFeedId("all");
      setSelectedRssArticleIds([]);
      setToast("RSS-Feed gelöscht.");
    } catch {
      setToast("RSS-Feed konnte nicht gelöscht werden.");
    }
  };

  const toggleRssArticle = (articleId) =>
    setSelectedRssArticleIds((prev) =>
      prev.includes(articleId) ? prev.filter((entry) => entry !== articleId) : [...prev, articleId]
    );

  const importSelectedRssArticles = () => {
    if (!selectedRssArticles.length) {
      setToast("Bitte mindestens einen RSS-Artikel wählen.");
      return;
    }
    const block = selectedRssArticles.map((article) => buildArticleBlock(article)).filter(Boolean).join("\n\n");
    setDraft((prev) => ({
      ...prev,
      subject: prev.subject || (selectedRssArticles[0]?.title || ""),
      content: `${prev.content || ""}${prev.content ? "\n" : ""}${block}`.trim()
    }));
    setToast(`${selectedRssArticles.length} RSS-Artikel als Baustein übernommen.`);
  };

  const generateFromRssArticles = async (mode) => {
    if (!selectedRssArticles.length) {
      setToast("Bitte mindestens einen RSS-Artikel wählen.");
      return;
    }
    setIsRssGenerating(true);
    try {
      const res = await fetch("/api/newsletter_rss_generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          tone: aiTone,
          articles: selectedRssArticles.map((article) => ({
            feed_name: article.feed_name,
            title: article.title,
            link: article.link,
            summary: article.summary,
            content: article.content,
            published_at: article.published_at
          }))
        })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.text) {
        throw new Error(typeof data?.detail === "string" ? data.detail : `status_${res.status}`);
      }
      const generatedText = String(data.text || "").trim();
      if (mode === "newsletter") {
        const parsed = extractNewsletterDraftFromAi(generatedText);
        const preheaderBlock = parsed.preheader
          ? `<p><em>${escapeHtml(parsed.preheader)}</em></p>`
          : "";
        const fullContent = preheaderBlock
          ? preheaderBlock + (parsed.content || "")
          : parsed.content || generatedText;
        setDraft((prev) => ({
          ...prev,
          subject: parsed.subject || prev.subject || selectedRssArticles[0]?.title || "",
          content: fullContent
        }));
        setToast("KI-Newsletter aus RSS-Artikeln übernommen.");
      }
    } catch (error) {
      setToast(`RSS-KI konnte nicht erstellt werden.${error?.message ? ` (${error.message})` : ""}`);
    } finally {
      setIsRssGenerating(false);
    }
  };

  const generateFromRawText = async () => {
    const rawText = rawNewsletterText.trim();
    if (rawText.length < 20) {
      setToast("Bitte Rohtext mit mindestens 20 Zeichen eingeben.");
      return;
    }
    setIsRawGenerating(true);
    try {
      const res = await fetch("/api/newsletter_generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText, generate_subject: true })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.html) {
        throw new Error(typeof data?.detail === "string" ? data.detail : `status_${res.status}`);
      }
      const htmlBody = sanitizeHtml(String(data.html || "").trim());
      setDraft((prev) => ({
        ...prev,
        subject: prev.subject || data.subject || "",
        content: htmlBody
      }));
      setToast("KI-Newsletter aus Rohtext übernommen.");
    } catch (error) {
      setToast(`Newsletter-KI konnte nicht erstellt werden.${error?.message ? ` (${error.message})` : ""}`);
    } finally {
      setIsRawGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand-50 text-sand-900">
      {toast ? (
        <div className="fixed right-6 top-5 z-50 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white shadow-soft">
          {toast}
        </div>
      ) : null}

      {previewModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Newsletter Vorschau</p>
                <h3 className="text-lg font-display text-sand-900">{previewModal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal({ open: false, title: "", html: "" })}
                className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                Schließen
              </button>
            </div>
            <div className="max-h-[74vh] overflow-y-auto bg-sand-50 p-6">
              <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewModal.html) }} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {groupModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Popup</p>
                <h3 className="text-lg font-display text-sand-900">Empfängergruppen pflegen</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGroupForm(defaultGroupForm)}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  <Plus size={13} /> Neue Gruppe
                </button>
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  Schließen
                </button>
              </div>
            </div>
            <div className="max-h-[78vh] overflow-y-auto bg-sand-50 p-6">
              <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="space-y-2">
                  {groups.length ? (
                    groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => handleGroupSelect(group)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left ${
                          groupForm.id === group.id
                            ? "border-amber-300 bg-amber-50"
                            : "border-sand-200 bg-white hover:bg-sand-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-sand-900">{group.name}</p>
                            {group.description ? (
                              <p className="mt-1 text-xs text-sand-600">{group.description}</p>
                            ) : null}
                          </div>
                          <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-500">
                            {group.recipient_count}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-sand-300 bg-white px-4 py-5 text-sm text-sand-500">
                      Noch keine Gruppen vorhanden.
                    </p>
                  )}
                </div>

                <div className="space-y-4 rounded-3xl border border-sand-200 bg-white p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Name</span>
                      <input
                        value={groupForm.name}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                        className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="z. B. Wartungskunden"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Beschreibung</span>
                      <input
                        value={groupForm.description}
                        onChange={(event) =>
                          setGroupForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                        placeholder="Optionaler Kontext"
                      />
                    </label>
                  </div>

                  <input
                    value={groupSearch}
                    onChange={(event) => setGroupSearch(event.target.value)}
                    placeholder="Kunden für Gruppe suchen"
                    className="w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />

                  <div className="max-h-80 grid gap-2 overflow-auto pr-1 md:grid-cols-2">
                    {filteredGroupCustomers.map((customer) => (
                      <label
                        key={customer.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 ${
                          groupForm.customerIds.includes(customer.id)
                            ? "border-amber-300 bg-amber-50"
                            : "border-sand-200 bg-sand-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={groupForm.customerIds.includes(customer.id)}
                          onChange={() => toggleGroupCustomer(customer.id)}
                          className="h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-sand-900">{customer.name}</p>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                                customerNewsletterEmail(customer)
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-sand-200 text-sand-500"
                              }`}
                            >
                              {customerNewsletterEmail(customer) ? "Mail" : "Ohne Mail"}
                            </span>
                          </div>
                          <p className="truncate text-[11px] leading-4 text-sand-500">
                            {customerNewsletterEmail(customer) || "Keine E-Mail hinterlegt"}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {groupForm.id ? (
                      <button
                        type="button"
                        onClick={handleGroupDelete}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 size={13} /> Löschen
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleGroupSave}
                      className="inline-flex items-center gap-2 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90"
                    >
                      <Save size={13} /> {groupForm.id ? "Gruppe speichern" : "Gruppe anlegen"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rssModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-sand-900/40 px-4 py-8">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
            <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Popup</p>
                <h3 className="text-lg font-display text-sand-900">RSS-Feeds pflegen</h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRssFeedForm(defaultRssFeedForm);
                    setSelectedRssFeedId("all");
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  <Plus size={13} /> Neuer Feed
                </button>
                <button
                  type="button"
                  onClick={() => setRssModalOpen(false)}
                  className="rounded-full border border-sand-300 px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  Schließen
                </button>
              </div>
            </div>

            <div className="max-h-[80vh] overflow-y-auto bg-sand-50 p-6">
              <div className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
                <div className="space-y-2">
                  {rssFeeds.length ? (
                    rssFeeds.map((feed) => (
                      <button
                        key={feed.id}
                        type="button"
                        onClick={() => handleRssFeedSelect(feed)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left ${
                          Number(selectedRssFeedId) === feed.id
                            ? "border-amber-300 bg-amber-50"
                            : "border-sand-200 bg-white hover:bg-sand-100"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-sand-900">{feed.name}</p>
                            <p className="truncate text-xs text-sand-500">{feed.url}</p>
                            {feed.description ? <p className="mt-1 text-xs text-sand-600">{feed.description}</p> : null}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              feed.enabled ? "bg-emerald-100 text-emerald-700" : "bg-sand-200 text-sand-600"
                            }`}
                          >
                            {feed.enabled ? "aktiv" : "aus"}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-sand-300 bg-white px-4 py-5 text-sm text-sand-500">
                      Noch keine RSS-Feeds hinterlegt.
                    </p>
                  )}
                </div>

                <div className="space-y-4 rounded-3xl border border-sand-200 bg-white p-4">
                  <div className="mb-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-sand-500">Feed pflegen</p>
                  </div>
                  <div className="space-y-4">
                      <label className="block">
                        <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Name</span>
                        <input
                          value={rssFeedForm.name}
                          onChange={(event) => setRssFeedForm((prev) => ({ ...prev, name: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="z. B. Security Blog"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Feed URL</span>
                        <input
                          value={rssFeedForm.url}
                          onChange={(event) => setRssFeedForm((prev) => ({ ...prev, url: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="https://..."
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Beschreibung</span>
                        <textarea
                          value={rssFeedForm.description}
                          onChange={(event) =>
                            setRssFeedForm((prev) => ({ ...prev, description: event.target.value }))
                          }
                          rows={3}
                          className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                          placeholder="Optionaler Hinweis zum Feed"
                        />
                      </label>
                      <label className="inline-flex items-center gap-3 rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-700">
                        <input
                          type="checkbox"
                          checked={rssFeedForm.enabled}
                          onChange={(event) =>
                            setRssFeedForm((prev) => ({ ...prev, enabled: event.target.checked }))
                          }
                          className="h-4 w-4"
                        />
                        Feed aktiv für Sammelabruf verwenden
                      </label>
                      <div className="flex flex-wrap justify-end gap-2">
                        {rssFeedForm.id ? (
                          <button
                            type="button"
                            onClick={handleRssFeedDelete}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 size={13} /> Löschen
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleRssFeedSave}
                          disabled={isRssSaving}
                          className="inline-flex items-center gap-2 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save size={13} /> {isRssSaving ? "Speichert..." : rssFeedForm.id ? "Feed speichern" : "Feed anlegen"}
                        </button>
                      </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <header className="border-b border-sand-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">Newsletter</h1>
            </div>
          </div>

          {/* KPI strip */}
          <div className="hidden md:flex items-center gap-1.5">
            <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-sand-400">Abonnenten</p>
              <p className="text-sm font-bold text-sand-900">{newsletterCustomers.length}</p>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-violet-400">Gruppen</p>
              <p className="text-sm font-bold text-violet-900">{groups.length}</p>
            </div>
            <div className={`rounded-xl border px-3 py-1.5 text-center ${resolvedRecipients.length > 0 ? "border-amber-200 bg-amber-50" : "border-sand-200 bg-sand-50"}`}>
              <p className={`text-[10px] uppercase tracking-wide ${resolvedRecipients.length > 0 ? "text-amber-500" : "text-sand-400"}`}>Auswahl</p>
              <p className={`text-sm font-bold ${resolvedRecipients.length > 0 ? "text-amber-900" : "text-sand-900"}`}>{resolvedRecipients.length}</p>
            </div>
            <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-1.5 text-center">
              <p className="text-[10px] uppercase tracking-wide text-sand-400">Archiv</p>
              <p className="text-sm font-bold text-sand-900">{newsletters.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              title="Aktualisieren"
              className="rounded-full border border-sand-200 bg-white p-2 text-sand-500 hover:bg-sand-100"
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              onClick={() => { setDraft(defaultDraft); setSelectedRssArticleIds([]); setNewsletterTab("draft"); }}
              title="Neuer Entwurf"
              className="rounded-full border border-sand-200 bg-white p-2 text-sand-500 hover:bg-sand-100"
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={saveNewsletter}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={13} /> {isSaving ? "Speichert…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={handleSendPreparation}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-full bg-sand-900 px-4 py-1.5 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={13} /> Versenden
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mx-auto max-w-7xl flex items-center gap-0 px-6 border-t border-sand-100">
          {[
            { key: "draft", icon: Pencil, label: "Entwurf" },
            { key: "recipients", icon: Users2, label: "Empfänger" },
            { key: "rss", icon: Rss, label: "RSS" },
            { key: "archive", icon: Archive, label: "Archiv" },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setNewsletterTab(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs uppercase tracking-wide border-b-2 -mb-px transition-colors ${
                newsletterTab === key
                  ? "border-sand-900 text-sand-900 font-semibold"
                  : "border-transparent text-sand-500 hover:text-sand-700 hover:border-sand-300"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">

        {/* ── ENTWURF TAB ─────────────────────────────────────────── */}
        {newsletterTab === "draft" ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="mb-5 rounded-2xl border border-sand-200 bg-sand-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-sand-500">KI aus Rohtext</p>
                    <h2 className="mt-1 text-sm font-semibold text-sand-900">Quansatech-Newsletter erzeugen</h2>
                    <p className="mt-1 max-w-2xl text-xs leading-relaxed text-sand-500">
                      Die KI erstellt nur den HTML-Body im Quansatech-Stil. Header, Footer und Versandlayout ergänzt das Dashboard.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={generateFromRawText}
                    disabled={isRawGenerating || rawNewsletterText.trim().length < 20}
                    className="inline-flex items-center gap-1.5 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles size={13} /> {isRawGenerating ? "Generiert…" : "HTML-Body erzeugen"}
                  </button>
                </div>
                <textarea
                  value={rawNewsletterText}
                  onChange={(event) => setRawNewsletterText(event.target.value)}
                  rows={6}
                  className="mt-3 w-full rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="Rohtext einfügen, z. B. Hinweis zu Update, Sicherheitsprüfung, Wartung oder geplanter Umstellung. Die KI formuliert daraus eine kurze Kundeninformation."
                />
                <p className="mt-2 text-[11px] text-sand-400">
                  Der erzeugte HTML-Body ersetzt den aktuellen Inhalt im Entwurf. Ein Betreff wird nur gesetzt, wenn das Feld noch leer ist.
                </p>
              </div>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.24em] text-sand-500">Betreff</span>
                <input
                  value={draft.subject}
                  onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-sand-200 px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="Betreff für den E-Mail-Versand"
                />
              </label>
              <div className="mt-4">
                <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-sand-500">Inhalt</p>
                <NotesRichTextEditor
                  value={draft.content}
                  onChange={(value) => setDraft((prev) => ({ ...prev, content: value }))}
                  minHeight="480px"
                  placeholder="Newsletter hier formatieren oder direkt als HTML einfügen."
                  allowHtmlSource
                  aiModule="newsletter"
                  aiContext={{
                    topic: draft.subject,
                    module: "Newsletter"
                  }}
                />
                <p className="mt-2 text-[11px] text-sand-400">
                  HTML wird direkt gespeichert. Im HTML-Modus kannst du Inhalte aus ChatGPT direkt einfügen.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sand-700">Vorschau</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({ open: true, title: draft.subject || "Vorschau", html: previewHtml })}
                      className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide hover:bg-sand-100"
                    >
                      <Eye size={11} /> Vollbild
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewVisible((v) => !v)}
                      className="rounded-full border border-sand-200 bg-white p-1 text-sand-400 hover:bg-sand-100"
                    >
                      {previewVisible ? <Eye size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                {previewVisible ? (
                  <div className="overflow-hidden bg-white">
                    <div className="max-h-[640px] overflow-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                ) : (
                  <div className="px-4 py-6 text-center text-xs text-sand-400">Vorschau ausgeblendet</div>
                )}
              </div>

              {resolvedRecipients.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-amber-600 font-medium">{resolvedRecipients.length} Empfänger aufgelöst</p>
                  <p className="mt-1 text-[11px] text-amber-700 break-all leading-relaxed">
                    {resolvedRecipients.slice(0, 6).join(", ")}{resolvedRecipients.length > 6 ? ` +${resolvedRecipients.length - 6} weitere` : ""}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3">
                  <p className="text-xs text-sand-500">Noch keine Empfänger — im Tab <button type="button" onClick={() => setNewsletterTab("recipients")} className="underline hover:text-sand-700">Empfänger</button> auswählen.</p>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ── EMPFÄNGER TAB ───────────────────────────────────────── */}
        {newsletterTab === "recipients" ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-sand-900">Gruppen</h2>
                  <p className="text-xs text-sand-500 mt-0.5">Empfängersegmente — aktivieren um in den Versand einzuschließen.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <Layers3 size={13} /> Gruppen pflegen
                  </button>
                </div>
              </div>
              {groups.length ? (
                <div className="flex flex-wrap gap-2">
                  {groups.map((group) => {
                    const checked = draft.selected_group_ids.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => toggleDraftGroup(group.id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                          checked
                            ? "border-amber-400 bg-amber-100 text-amber-900 font-semibold"
                            : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                        }`}
                      >
                        <span>{group.name}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${checked ? "bg-amber-200 text-amber-800" : "bg-sand-100 text-sand-500"}`}>
                          {group.recipient_count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-sand-200 px-4 py-4 text-sm text-sand-400">
                  Noch keine Gruppen — über "Gruppen pflegen" anlegen.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-base font-semibold text-sand-900">Einzelkunden</h2>
                  <p className="text-xs text-sand-500 mt-0.5">Direkt ergänzen — unabhängig von Gruppen.</p>
                </div>
                {draft.selected_customer_ids.length > 0 ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {draft.selected_customer_ids.length} gewählt
                  </span>
                ) : null}
              </div>
              <input
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Name oder E-Mail suchen…"
                className="mb-2 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <div className="max-h-72 overflow-auto rounded-xl border border-sand-200 bg-sand-50">
                {filteredRecipientCustomers.map((customer) => {
                  const checked = draft.selected_customer_ids.includes(customer.id);
                  const email = customerNewsletterEmail(customer);
                  return (
                    <label
                      key={customer.id}
                      className={`flex cursor-pointer items-center gap-3 border-b border-sand-100 px-3 py-2 last:border-b-0 ${checked ? "bg-amber-50" : "hover:bg-white"}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleDraftCustomer(customer.id)} className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-sand-900">{customer.name}</p>
                        <p className={`truncate text-[11px] ${email ? "text-sand-500" : "text-rose-500"}`}>{email || "Keine E-Mail"}</p>
                      </div>
                      {!email ? <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-600">Fehlt</span> : null}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
              <button
                type="button"
                onClick={() => setManualRecipientsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-sand-50"
              >
                <div>
                  <p className="text-sm font-semibold text-sand-900">Manuelle Empfänger</p>
                  <p className="text-xs text-sand-500">Externe Adressen per Komma oder Zeilenumbruch</p>
                </div>
                <span className="text-sand-400">{manualRecipientsOpen ? "▲" : "▼"}</span>
              </button>
              {manualRecipientsOpen ? (
                <div className="border-t border-sand-100 px-5 pb-4 pt-3">
                  <textarea
                    value={draft.manual_recipients}
                    onChange={(event) => setDraft((prev) => ({ ...prev, manual_recipients: event.target.value }))}
                    rows={4}
                    placeholder="name@domain.de, name2@domain.de"
                    className="w-full rounded-xl border border-sand-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
              ) : null}
            </div>

            {missingEmailCustomers.length ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Ohne E-Mail: {missingEmailCustomers.map((c) => c.name).join(", ")}
              </div>
            ) : null}
            {optedOutCustomers.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Newsletter deaktiviert: {optedOutCustomers.map((c) => c.name).join(", ")}
              </div>
            ) : null}
            {resolvedRecipients.length > 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{resolvedRecipients.length} E-Mail-Adressen aufgelöst</p>
                <p className="mt-1 text-[11px] text-emerald-600 break-all leading-relaxed">
                  {resolvedRecipients.slice(0, 8).join(", ")}{resolvedRecipients.length > 8 ? ` +${resolvedRecipients.length - 8} weitere` : ""}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── RSS TAB ─────────────────────────────────────────────── */}
        {newsletterTab === "rss" ? (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="rounded-2xl border border-sand-200 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedRssFeedId("all"); loadRssArticles("all"); }}
                  className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wide transition-colors ${selectedRssFeedId === "all" ? "bg-amber-600 text-white" : "border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"}`}
                >
                  Alle
                </button>
                {rssFeeds.map((feed) => (
                  <button
                    key={feed.id}
                    type="button"
                    onClick={() => { setSelectedRssFeedId(feed.id); loadRssArticles(feed.id); }}
                    className={`rounded-full px-3 py-1.5 text-xs uppercase tracking-wide transition-colors ${Number(selectedRssFeedId) === feed.id ? "bg-amber-600 text-white" : "border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"}`}
                  >
                    {feed.name}
                  </button>
                ))}
                <button type="button" onClick={() => loadRssArticles(selectedRssFeedId)} className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-500 hover:bg-sand-100" title="Neu laden">
                  <RefreshCw size={13} />
                </button>
                <button type="button" onClick={() => setRssModalOpen(true)} className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1.5 text-xs text-sand-600 hover:bg-sand-100">
                  <Rss size={12} /> Feeds pflegen
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedRssArticles.length > 0 ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {selectedRssArticles.length} gewählt
                  </span>
                ) : null}
                <select
                  value={aiTone}
                  onChange={(event) => setAiTone(event.target.value)}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs text-sand-600"
                >
                  <option value="sachlich">Sachlich</option>
                  <option value="freundlich">Freundlich</option>
                  <option value="direkt">Direkt</option>
                </select>
                <div className="h-4 w-px bg-sand-200" />
                <button
                  type="button"
                  onClick={importSelectedRssArticles}
                  className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  <FilePlus2 size={12} /> Als Baustein
                </button>
                <button
                  type="button"
                  onClick={() => generateFromRssArticles("newsletter")}
                  disabled={isRssGenerating}
                  className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-60"
                >
                  <Sparkles size={12} /> {isRssGenerating ? "Generiert…" : "KI-Newsletter"}
                </button>
              </div>
            </div>

            {rssFeedResults.some((item) => item.status === "error") ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                Nicht alle Feeds konnten geladen werden.
              </div>
            ) : null}

            <div className="space-y-2">
              {isRssLoading ? (
                <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 px-4 py-8 text-center text-sm text-sand-400">
                  RSS-Artikel werden geladen…
                </div>
              ) : rssArticles.length ? (
                rssArticles.map((article) => {
                  const checked = selectedRssArticleIds.includes(article.id);
                  return (
                    <label
                      key={article.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${checked ? "border-amber-300 bg-amber-50" : "border-sand-200 bg-white hover:bg-sand-50"}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleRssArticle(article.id)} className="mt-1 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-500">{article.feed_name || "Feed"}</span>
                          {article.published_at ? <span className="text-[10px] text-sand-400 shrink-0">{formatArticleDate(article.published_at)}</span> : null}
                        </div>
                        <p className="text-sm font-semibold text-sand-900 leading-snug">{article.title}</p>
                        {article.summary ? (
                          <p className="mt-1 text-xs text-sand-600 leading-relaxed line-clamp-2">{article.summary}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5 pt-0.5">
                        {article.link ? (
                          <a href={article.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-500 hover:bg-sand-100" title="Artikel öffnen">
                            <ExternalLink size={12} />
                          </a>
                        ) : null}
                        <button
                          type="button"
                          title="Direkt in Entwurf übernehmen"
                          onClick={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            setDraft((prev) => ({
                              ...prev,
                              subject: prev.subject || article.title || "",
                              content: `${prev.content || ""}${prev.content ? "\n" : ""}${buildArticleBlock(article)}`.trim()
                            }));
                            setToast("Artikel übernommen.");
                          }}
                          className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-500 hover:bg-sand-100"
                        >
                          <FilePlus2 size={12} />
                        </button>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 px-4 py-8 text-center text-sm text-sand-400">
                  Keine Artikel — Feed wählen und laden.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ── ARCHIV TAB ──────────────────────────────────────────── */}
        {newsletterTab === "archive" ? (
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-sand-500 py-4">Lade Newsletter…</p>
            ) : newsletters.length ? (
              newsletters.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-sand-200 bg-white px-4 py-3 hover:bg-sand-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-sand-900 truncate">{item.subject || item.title || "Newsletter"}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      {item.sent_at ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700">Gesendet</span>
                      ) : (
                        <span className="rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-500">Entwurf</span>
                      )}
                      <span className="text-[11px] text-sand-500">{formatDateTime(item.sent_at)}</span>
                      {Number(item.recipient_count || 0) > 0 ? (
                        <span className="text-[11px] text-sand-400">{Number(item.recipient_count)} Empfänger</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button type="button" onClick={() => handlePreviewNewsletter(item)} title="Vorschau" className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-500 hover:bg-sand-100">
                      <Eye size={13} />
                    </button>
                    <button type="button" onClick={() => { handleEditNewsletter(item); setNewsletterTab("draft"); }} title="In Entwurf laden" className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-500 hover:bg-sand-100">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => openSendComposer(item)} title="Senden" className="rounded-full border border-sand-200 bg-white p-1.5 text-sand-500 hover:bg-sand-100">
                      <Send size={13} />
                    </button>
                    <button type="button" onClick={() => handleDeleteNewsletter(item.id)} title="Löschen" className="rounded-full border border-rose-100 bg-white p-1.5 text-rose-400 hover:bg-rose-50">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50 px-4 py-10 text-center text-sm text-sand-400">
                Noch keine Newsletter gespeichert.
              </div>
            )}
          </div>
        ) : null}

      </main>

      <EmailComposerModal
        open={sendComposer.open}
        title="Newsletter versenden"
        recipient={sendComposer.recipient}
        subject={sendComposer.subject}
        body=""
        showBody={false}
        helperText={`Empfänger gesamt: ${normalizeEmailList(sendComposer.recipient).length}`}
        trackingText=""
        isSending={sendComposer.isSending}
        onClose={() => setSendComposer((prev) => ({ ...prev, open: false, isSending: false }))}
        onSend={handleComposerSend}
        onRecipientChange={(value) => setSendComposer((prev) => ({ ...prev, recipient: value }))}
        onSubjectChange={(value) => setSendComposer((prev) => ({ ...prev, subject: value }))}
        onBodyChange={() => {}}
        sendLabel="Newsletter senden"
      />
    </div>
  );
}
