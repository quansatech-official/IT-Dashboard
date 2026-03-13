import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Eye,
  Layers3,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users2
} from "lucide-react";
import EmailComposerModal from "../components/EmailComposerModal";
import RichTextEditor from "../components/RichTextEditor";
import {
  buildNewsletterHtml,
  buildNewsletterPlainText,
  paragraphsToHtml
} from "./newsletterUtils";

const defaultDraft = {
  id: null,
  title: "",
  subject: "",
  preheader: "",
  intro_html: "",
  body_html: "",
  cta_label: "",
  cta_url: "",
  closing_html: "",
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

const cleanIdeaHeadline = (value = "") =>
  String(value)
    .replace(/^\s*(thema\s*\d+|idee\s*\d+|\d+[\).:-])\s*/i, "")
    .trim();

const mapNewsletterToDraft = (item = {}) => ({
  ...defaultDraft,
  id: item.id ?? null,
  title: String(item.title || ""),
  subject: String(item.subject || ""),
  preheader: String(item.preheader || ""),
  intro_html: String(item.intro_html || ""),
  body_html: String(item.body_html || ""),
  cta_label: String(item.cta_label || ""),
  cta_url: String(item.cta_url || ""),
  closing_html: String(item.closing_html || ""),
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

export default function NewsletterView() {
  const [draft, setDraft] = useState(defaultDraft);
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newsletters, setNewsletters] = useState([]);
  const [groupForm, setGroupForm] = useState(defaultGroupForm);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTone, setAiTone] = useState("sachlich");
  const [aiText, setAiText] = useState("");
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
      const [customersRes, groupsRes, newslettersRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/newsletter_groups"),
        fetch("/api/newsletters")
      ]);
      const [customersData, groupsData, newslettersData] = await Promise.all([
        customersRes.json().catch(() => []),
        groupsRes.json().catch(() => []),
        newslettersRes.json().catch(() => [])
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
    } catch {
      setToast("Newsletter-Daten konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const newsletterCustomers = useMemo(
    () => customers.filter((customer) => customer.newsletter),
    [customers]
  );

  const customerById = useMemo(
    () => new Map(newsletterCustomers.map((customer) => [customer.id, customer])),
    [newsletterCustomers]
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
      .map((customerId) => customerById.get(customerId)?.email || "")
      .filter(Boolean);
    return normalizeEmailList([...emails, ...manualRecipientList].join(","));
  }, [customerById, manualRecipientList, resolvedCustomerIds]);

  const missingEmailCustomers = useMemo(
    () =>
      resolvedCustomerIds
        .map((customerId) => customerById.get(customerId))
        .filter((customer) => customer && !customer.email),
    [customerById, resolvedCustomerIds]
  );

  const previewHtml = useMemo(() => buildNewsletterHtml(draft), [draft]);
  const previewText = useMemo(() => buildNewsletterPlainText(draft), [draft]);

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
        title: draft.title,
        subject: draft.subject,
        preheader: draft.preheader,
        intro_html: draft.intro_html,
        body_html: draft.body_html,
        cta_label: draft.cta_label,
        cta_url: draft.cta_url,
        closing_html: draft.closing_html,
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
    const normalized = mapNewsletterToDraft(item);
    setSendComposer({
      open: true,
      newsletterId: item.id,
      recipient: Array.isArray(item.recipient_emails) ? item.recipient_emails.join(", ") : resolvedRecipients.join(", "),
      subject: normalized.subject,
      html: buildNewsletterHtml(normalized),
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
      const res = await fetch(`/api/newsletters/${sendComposer.newsletterId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_emails: recipients,
          subject: sendComposer.subject,
          html: sendComposer.html,
          text: sendComposer.text
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
      title: normalized.title || normalized.subject || "Newsletter Vorschau",
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

  const handleAiIdeas = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/customer_development/ai_assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "newsletter", tone: aiTone })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.text) {
        throw new Error(typeof data?.detail === "string" ? data.detail : "");
      }
      setAiText(String(data.text || "").trim());
    } catch (error) {
      setToast(`KI-Vorschläge nicht verfügbar.${error?.message ? ` (${error.message})` : ""}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const applyAiText = () => {
    const lines = String(aiText || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      setToast("Keine KI-Vorschläge vorhanden.");
      return;
    }
    const firstLine = cleanIdeaHeadline(lines[0]);
    setDraft((prev) => ({
      ...prev,
      title: prev.title || firstLine,
      subject: prev.subject || firstLine,
      body_html: prev.body_html || paragraphsToHtml(lines.join("\n"))
    }));
    setToast("KI-Vorschlag in Entwurf übernommen.");
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

      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-600 text-white">
              <Mail size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
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
                setAiText("");
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
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-amber-700">Aufgelöst</p>
                  <p className="text-lg font-semibold text-amber-900">{resolvedRecipients.length}</p>
                </div>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
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

                <div className="space-y-3">
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
                  <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {filteredRecipientCustomers.map((customer) => {
                      const checked = draft.selected_customer_ids.includes(customer.id);
                      return (
                        <label
                          key={customer.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${
                            checked
                              ? "border-amber-300 bg-amber-50"
                              : "border-sand-200 bg-sand-50 hover:bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDraftCustomer(customer.id)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-sand-900">{customer.name}</p>
                            <p className="truncate text-xs text-sand-500">
                              {customer.email || "Keine E-Mail hinterlegt"}
                            </p>
                            {customer.status !== "active" ? (
                              <p className="mt-1 text-[10px] uppercase tracking-wide text-rose-600">Inaktiv</p>
                            ) : null}
                          </div>
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
            </div>

            <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="mb-4">
                <h2 className="text-lg font-display text-sand-900">Inhalt</h2>
                <p className="text-sm text-sand-600">Betreff, Einleitung, Hauptinhalt und Abschluss separat pflegen.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Interner Titel</span>
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    placeholder="z. B. Security Update März"
                  />
                </label>
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

              <label className="mt-4 block">
                <span className="text-xs uppercase tracking-[0.24em] text-sand-500">Preheader / Eyebrow</span>
                <input
                  value={draft.preheader}
                  onChange={(event) => setDraft((prev) => ({ ...prev, preheader: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="Kurzer Teaser oberhalb der Überschrift"
                />
              </label>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.24em] text-sand-500">Einleitung</p>
                  <RichTextEditor
                    value={draft.intro_html}
                    onChange={(value) => setDraft((prev) => ({ ...prev, intro_html: value }))}
                    placeholder="Kurze Einleitung für den Newsletter"
                    minHeight="140px"
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.24em] text-sand-500">Hauptinhalt</p>
                  <RichTextEditor
                    value={draft.body_html}
                    onChange={(value) => setDraft((prev) => ({ ...prev, body_html: value }))}
                    placeholder="Abschnitte, Listen und Hinweise"
                    minHeight="240px"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_1fr]">
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.24em] text-sand-500">CTA Text</span>
                    <input
                      value={draft.cta_label}
                      onChange={(event) => setDraft((prev) => ({ ...prev, cta_label: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                      placeholder="z. B. Termin anfragen"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.24em] text-sand-500">CTA URL</span>
                    <input
                      value={draft.cta_url}
                      onChange={(event) => setDraft((prev) => ({ ...prev, cta_url: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.24em] text-sand-500">Abschluss</p>
                  <RichTextEditor
                    value={draft.closing_html}
                    onChange={(value) => setDraft((prev) => ({ ...prev, closing_html: value }))}
                    placeholder="Sign-off, Kontaktmöglichkeit oder kurze Schlussnotiz"
                    minHeight="140px"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-display text-sand-900">KI-Themenhilfe</h2>
                  <p className="text-sm text-sand-600">Unabhängige Themenvorschläge für den Newsletter laden.</p>
                </div>
                <div className="flex items-center gap-2">
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
                    onClick={handleAiIdeas}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-4 py-2 text-xs uppercase tracking-wide hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Sparkles size={14} /> {isGenerating ? "Lädt..." : "Themen laden"}
                  </button>
                </div>
              </div>
              <textarea
                value={aiText}
                onChange={(event) => setAiText(event.target.value)}
                rows={8}
                placeholder="Hier erscheinen Newsletter-Ideen aus der KI."
                className="w-full rounded-2xl border border-sand-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={applyAiText}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90"
                >
                  <Sparkles size={14} /> In Entwurf übernehmen
                </button>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
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
                      title: draft.title || draft.subject || "Newsletter Vorschau",
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

            <div className="rounded-3xl border border-sand-200 bg-white p-4 shadow-soft">
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Plain Text</p>
              <textarea
                value={previewText}
                readOnly
                rows={12}
                className="mt-3 w-full rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3 text-sm text-sand-700"
              />
            </div>
          </aside>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-3xl border border-sand-200 bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-display text-sand-900">Empfängergruppen</h2>
                <p className="text-sm text-sand-600">Kunden zu Gruppen zusammenfassen und wiederverwenden.</p>
              </div>
              <button
                type="button"
                onClick={() => setGroupForm(defaultGroupForm)}
                className="inline-flex items-center gap-2 rounded-full border border-sand-300 bg-white px-3 py-1.5 text-xs uppercase tracking-wide hover:bg-sand-100"
              >
                <Plus size={13} /> Neue Gruppe
              </button>
            </div>

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
                          : "border-sand-200 bg-sand-50 hover:bg-white"
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
                  <p className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 px-4 py-5 text-sm text-sand-500">
                    Noch keine Gruppen vorhanden.
                  </p>
                )}
              </div>

              <div className="space-y-4 rounded-3xl border border-sand-200 bg-sand-50 p-4">
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

                <div className="max-h-80 space-y-2 overflow-auto pr-1">
                  {filteredGroupCustomers.map((customer) => (
                    <label
                      key={customer.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 ${
                        groupForm.customerIds.includes(customer.id)
                          ? "border-amber-300 bg-white"
                          : "border-sand-200 bg-white/70"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={groupForm.customerIds.includes(customer.id)}
                        onChange={() => toggleGroupCustomer(customer.id)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-sand-900">{customer.name}</p>
                        <p className="truncate text-xs text-sand-500">
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
                          {item.title || item.subject || "Newsletter"}
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
