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

const extractNewsletterDraftFromAi = (value = "") => {
  const lines = String(value)
    .split("\n")
    .map((line) => line.trimEnd());
  const nonEmpty = lines.filter((line) => line.trim());
  if (!nonEmpty.length) {
    return { subject: "", content: "" };
  }
  const subject = String(nonEmpty[0] || "").trim();
  let contentLines = lines.slice(lines.findIndex((line) => line.trim() === subject) + 1);
  const content = paragraphsToHtml(contentLines.join("\n").trim());
  return {
    subject,
    content
  };
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
  const [aiTone, setAiTone] = useState("sachlich");
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
          .filter((customer) => !customer.newsletter && customer.email)
          .map((customer) => String(customer.email || "").trim().toLowerCase())
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
      .map((customerId) => newsletterCustomerById.get(customerId)?.email || "")
      .filter(Boolean);
    return normalizeEmailList([...emails, ...manualRecipientList].join(",")).filter(
      (email) => !optedOutEmailSet.has(String(email || "").trim().toLowerCase())
    );
  }, [newsletterCustomerById, manualRecipientList, optedOutEmailSet, resolvedCustomerIds]);

  const missingEmailCustomers = useMemo(
    () =>
      resolvedCustomerIds
        .map((customerId) => newsletterCustomerById.get(customerId))
        .filter((customer) => customer && !customer.email),
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
    () => buildNewsletterHtml({ ...resolvedDraft, logo_src: "/QTLogo.jpg" }),
    [resolvedDraft]
  );

  const filteredRecipientCustomers = useMemo(() => {
    const needle = recipientSearch.trim().toLowerCase();
    if (!needle) return newsletterCustomers;
    return newsletterCustomers.filter((customer) => {
      const haystack = `${customer.name} ${customer.email}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [newsletterCustomers, recipientSearch]);

  const filteredGroupCustomers = useMemo(() => {
    const needle = groupSearch.trim().toLowerCase();
    if (!needle) return newsletterCustomers;
    return newsletterCustomers.filter((customer) => {
      const haystack = `${customer.name} ${customer.email}`.toLowerCase();
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
    const normalized = mapNewsletterToDraft(item);
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
        setDraft((prev) => ({
          ...prev,
          subject: parsed.subject || prev.subject || selectedRssArticles[0]?.title || "",
          content: parsed.content || generatedText
        }));
        setToast("KI-Newsletter aus RSS-Artikeln übernommen.");
      }
    } catch (error) {
      setToast(`RSS-KI konnte nicht erstellt werden.${error?.message ? ` (${error.message})` : ""}`);
    } finally {
      setIsRssGenerating(false);
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
                <div dangerouslySetInnerHTML={{ __html: previewModal.html }} />
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
                                customer.email
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-sand-200 text-sand-500"
                              }`}
                            >
                              {customer.email ? "Mail" : "Ohne Mail"}
                            </span>
                          </div>
                          <p className="truncate text-[11px] leading-4 text-sand-500">
                            {customer.email || "Keine E-Mail hinterlegt"}
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

      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-600 text-white">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Quansatech</p>
              <h1 className="text-2xl font-display text-sand-900">Newsletter</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <RefreshCw size={14} /> Aktualisieren
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(defaultDraft);
                setSelectedRssArticleIds([]);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
            >
              <Plus size={14} /> Neu
            </button>
            <button
              type="button"
              onClick={saveNewsletter}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={14} /> {isSaving ? "Speichert..." : "Speichern"}
            </button>
            <button
              type="button"
              onClick={handleSendPreparation}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-sand-900 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={14} /> Versenden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-7">
        <section className="grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Abonnenten</p>
            <p className="mt-2 text-2xl font-display text-sand-900">{newsletterCustomers.length}</p>
            <p className="mt-1 text-xs text-sand-500">Kunden mit aktivem Newsletter-Flag.</p>
          </div>
          <div className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Gruppen</p>
            <p className="mt-2 text-2xl font-display text-sand-900">{groups.length}</p>
            <p className="mt-1 text-xs text-sand-500">Empfängersegmente für Wiederverwendung.</p>
          </div>
          <div className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Aktuelle Auswahl</p>
            <p className="mt-2 text-2xl font-display text-sand-900">{resolvedRecipients.length}</p>
            <p className="mt-1 text-xs text-sand-500">Aufgelöste E-Mail-Empfänger im Entwurf.</p>
          </div>
          <div className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Archiv</p>
            <p className="mt-2 text-2xl font-display text-sand-900">{newsletters.length}</p>
            <p className="mt-1 text-xs text-sand-500">Gespeicherte Newsletter-Stände.</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-display text-sand-900">Empfänger</h2>
                  <p className="text-sm text-sand-600">
                    Gruppen wählen oder einzelne Kunden direkt ergänzen.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-2 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <Layers3 size={13} /> Gruppen pflegen
                  </button>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-amber-700">Aufgelöst</p>
                    <p className="text-lg font-semibold text-amber-900">{resolvedRecipients.length}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sand-700">
                    <Layers3 size={15} />
                    <p className="text-xs uppercase tracking-[0.24em] text-sand-500">Gruppen</p>
                  </div>
                  <div className="space-y-2">
                    {groups.length ? (
                      groups.map((group) => {
                        const checked = draft.selected_group_ids.includes(group.id);
                        return (
                          <label
                            key={group.id}
                            className={`flex cursor-pointer items-start justify-between gap-3 rounded-2xl border px-3 py-3 ${
                              checked
                                ? "border-amber-300 bg-amber-50"
                                : "border-sand-200 bg-sand-50 hover:bg-white"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleDraftGroup(group.id)}
                                className="mt-1 h-4 w-4"
                              />
                              <div>
                                <p className="text-sm font-semibold text-sand-900">{group.name}</p>
                                {group.description ? (
                                  <p className="mt-1 text-xs text-sand-600">{group.description}</p>
                                ) : null}
                              </div>
                            </div>
                            <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-500">
                              {group.recipient_count}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <p className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-5 text-sm text-sand-500">
                        Noch keine Gruppen angelegt.
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sand-700">
                    <Users2 size={15} />
                    <p className="text-xs uppercase tracking-[0.24em] text-sand-500">Einzelkunden</p>
                  </div>
                  <input
                    value={recipientSearch}
                    onChange={(event) => setRecipientSearch(event.target.value)}
                    placeholder="Kunde oder E-Mail suchen"
                    className="w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <div className="max-h-72 overflow-auto rounded-2xl border border-sand-200 bg-sand-50">
                    {filteredRecipientCustomers.map((customer) => {
                      const checked = draft.selected_customer_ids.includes(customer.id);
                      return (
                        <label
                          key={customer.id}
                          className={`flex cursor-pointer items-center gap-3 border-b border-sand-200 px-3 py-2 last:border-b-0 ${
                            checked
                              ? "bg-amber-50"
                              : "bg-transparent hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDraftCustomer(customer.id)}
                            className="h-4 w-4"
                          />
                          <div className="min-w-0 flex-1 truncate text-sm">
                            <span className="font-semibold text-sand-900">{customer.name}</span>
                            <span className="mx-2 text-sand-300">•</span>
                            <span className={customer.email ? "text-sand-500" : "text-rose-600"}>
                              {customer.email || "Keine E-Mail hinterlegt"}
                            </span>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              customer.email ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {customer.email ? "Mail" : "Fehlt"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Zusätzliche Empfänger</span>
                  <textarea
                    value={draft.manual_recipients}
                    onChange={(event) => setDraft((prev) => ({ ...prev, manual_recipients: event.target.value }))}
                    rows={3}
                    placeholder="Optional: externe Empfänger per Komma, Semikolon oder Zeilenumbruch"
                    className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </label>
                <div className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-sand-500">Empfängerliste</p>
                  <p className="mt-2 max-w-xs text-sm text-sand-700">
                    {resolvedRecipients.length
                      ? resolvedRecipients.join(", ")
                      : "Noch keine E-Mail-Adresse aufgelöst."}
                  </p>
                </div>
              </div>

              {missingEmailCustomers.length ? (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Ohne E-Mail-Adresse in der Auswahl:{" "}
                  {missingEmailCustomers.map((customer) => customer.name).join(", ")}
                </div>
              ) : null}

              {optedOutCustomers.length ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Vom Versand ausgeschlossen, da Newsletter im Kundenstamm deaktiviert ist:{" "}
                  {optedOutCustomers.map((customer) => customer.name).join(", ")}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-display text-sand-900">Inhalt</h2>
                  <p className="text-sm text-sand-600">
                    Newsletter direkt formatieren oder HTML einfügen.
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Betreff</span>
                  <input
                    value={draft.subject}
                    onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="Betreff für den E-Mail-Versand"
                  />
                </label>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.24em] text-sand-500">Newsletter-Inhalt</p>
                  <NotesRichTextEditor
                    value={draft.content}
                    onChange={(value) => setDraft((prev) => ({ ...prev, content: value }))}
                    minHeight="420px"
                    placeholder="Newsletter hier formatieren oder direkt als HTML einfügen."
                    allowHtmlSource
                  />
                  <p className="mt-2 text-xs text-sand-500">
                    Der Inhalt wird direkt als HTML gespeichert. Im HTML-Modus kannst du Inhalte aus ChatGPT oder externen Vorlagen direkt einfügen.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-display text-sand-900">RSS-Import</h2>
                  <p className="text-sm text-sand-600">Feeds laden, Artikel auswählen und direkt in den Newsletter übernehmen.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRssModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <Rss size={13} /> Feeds pflegen
                  </button>
                  <button
                    type="button"
                    onClick={() => loadRssArticles(selectedRssFeedId)}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                  >
                    <RefreshCw size={13} /> Laden
                  </button>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRssFeedId("all")}
                  className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wide ${
                    selectedRssFeedId === "all"
                      ? "bg-amber-600 text-white"
                      : "border border-sand-300 bg-white text-sand-600 hover:bg-sand-100"
                  }`}
                >
                  Alle Feeds
                </button>
                {rssFeeds.map((feed) => (
                  <button
                    key={feed.id}
                    type="button"
                    onClick={() => setSelectedRssFeedId(feed.id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-wide ${
                      Number(selectedRssFeedId) === feed.id
                        ? "bg-amber-600 text-white"
                        : "border border-sand-300 bg-white text-sand-600 hover:bg-sand-100"
                    }`}
                  >
                    {feed.name}
                  </button>
                ))}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs text-sand-600">
                  {selectedRssArticles.length} gewählt
                </span>
                <select
                  value={aiTone}
                  onChange={(event) => setAiTone(event.target.value)}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs uppercase tracking-wide text-sand-600"
                >
                  <option value="sachlich">Sachlich</option>
                  <option value="freundlich">Freundlich</option>
                  <option value="direkt">Direkt</option>
                </select>
                <button
                  type="button"
                  onClick={importSelectedRssArticles}
                  className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  <FilePlus2 size={13} /> Als Baustein
                </button>
                <button
                  type="button"
                  onClick={() => generateFromRssArticles("newsletter")}
                  disabled={isRssGenerating}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-3 py-1.5 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Sparkles size={13} /> KI-Newsletter
                </button>
              </div>

              {rssFeedResults.some((item) => item.status === "error") ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Nicht alle Feeds konnten geladen werden. Fehlerhafte Quellen bleiben in der Feed-Pflege sichtbar.
                </div>
              ) : null}

              <div className="max-h-[540px] space-y-3 overflow-auto pr-1">
                {isRssLoading ? (
                  <p className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-sm text-sand-500">
                    RSS-Artikel werden geladen…
                  </p>
                ) : rssArticles.length ? (
                  rssArticles.map((article) => {
                    const checked = selectedRssArticleIds.includes(article.id);
                    return (
                      <label
                        key={article.id}
                        className={`block cursor-pointer rounded-2xl border px-4 py-4 ${
                          checked
                            ? "border-amber-300 bg-amber-50"
                            : "border-sand-200 bg-sand-50 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRssArticle(article.id)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sand-500">
                                {article.feed_name || "Feed"}
                              </span>
                              {article.published_at ? (
                                <span className="text-[11px] uppercase tracking-wide text-sand-500">
                                  {formatArticleDate(article.published_at)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-sand-900">{article.title}</p>
                            {article.summary ? <p className="mt-2 text-sm leading-6 text-sand-700">{article.summary}</p> : null}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {article.link ? (
                                <a
                                  href={article.link}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                                >
                                  <ExternalLink size={12} /> Artikel
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setSelectedRssArticleIds([article.id]);
                                  setDraft((prev) => ({
                                    ...prev,
                                    subject: prev.subject || article.title || "",
                                    content: `${prev.content || ""}${prev.content ? "\n" : ""}${buildArticleBlock(article)}`.trim()
                                  }));
                                  setToast("RSS-Artikel in Entwurf übernommen.");
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100"
                              >
                                <FilePlus2 size={12} /> Direkt übernehmen
                              </button>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })
                ) : (
                  <p className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-sm text-sand-500">
                    Keine Artikel gefunden. Feed prüfen oder neu laden.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display text-sand-900">Live Preview</h2>
                  <p className="text-sm text-sand-600">Eigenständige Newsletter-Vorschau.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewModal({
                      open: true,
                      title: draft.subject || "Newsletter Vorschau",
                      html: previewHtml
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
                >
                  <Eye size={13} /> Groß
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white">
                <div className="max-h-[820px] overflow-auto" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </aside>
        </section>

        <section>
          <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-display text-sand-900">Archiv</h2>
                <p className="text-sm text-sand-600">Gespeicherte Newsletter separat verwalten.</p>
              </div>
              <div className="rounded-full border border-sand-200 bg-sand-50 px-3 py-1 text-xs text-sand-600">
                <Archive size={12} className="mr-1 inline" />
                {newsletters.length}
              </div>
            </div>

            {isLoading ? (
              <p className="text-sm text-sand-500">Lade Newsletter…</p>
            ) : newsletters.length ? (
              <div className="space-y-3">
                {newsletters.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-sand-900">
                          {item.subject || item.title || "Newsletter"}
                        </p>
                        <p className="mt-1 text-xs text-sand-500">
                          Betreff: {item.subject || "ohne Betreff"}
                        </p>
                        <p className="mt-1 text-xs text-sand-500">
                          Empfänger {Number(item.recipient_count || 0)} · Versand {formatDateTime(item.sent_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handlePreviewNewsletter(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                        >
                          <Eye size={12} /> Vorschau
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditNewsletter(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                        >
                          <Pencil size={12} /> Laden
                        </button>
                        <button
                          type="button"
                          onClick={() => openSendComposer(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-3 py-1 text-xs uppercase tracking-wide hover:bg-sand-100"
                        >
                          <Send size={12} /> Senden
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNewsletter(item.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs uppercase tracking-wide text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 size={12} /> Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-6 text-sm text-sand-500">
                Noch keine Newsletter gespeichert.
              </p>
            )}
          </div>
        </section>
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
