import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Clock3, FileText, FolderOpen, Plus, Search, Star, Tags, Trash2 } from "lucide-react";
import NotesRichTextEditor from "../components/NotesRichTextEditor";

const API = "/api";

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${text}`);
  }
};

const api = {
  list: () => fetchJson(`${API}/knowledge_articles`),
  create: (payload) =>
    fetchJson(`${API}/knowledge_articles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  update: (id, payload) =>
    fetchJson(`${API}/knowledge_articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  remove: (id) =>
    fetchJson(`${API}/knowledge_articles/${id}`, {
      method: "DELETE"
    })
};

const toTagArray = (value) =>
  String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-DE");
};

const plainTextFromHtml = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tagClass = "inline-flex max-w-full items-center rounded-full border border-sand-200 bg-sand-50 px-2 py-0.5 text-[11px] text-sand-600";

export default function KnowledgeBaseView() {
  const [articles, setArticles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const saveTimersRef = useRef({});
  const pendingPatchesRef = useRef({});

  useEffect(() => {
    let cancelled = false;
    api
      .list()
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        setArticles(data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Knowledge list load failed", error);
      });
    return () => {
      cancelled = true;
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!articles.length) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    const exists = articles.some((article) => article.id === activeId);
    if (!exists) setActiveId(articles[0].id);
  }, [articles, activeId]);

  const uniqueTags = useMemo(() => {
    const all = articles.flatMap((article) => (Array.isArray(article.tags) ? article.tags : []));
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b, "de"));
  }, [articles]);

  const uniqueCategories = useMemo(() => {
    return Array.from(
      new Set(
        articles
          .map((article) => String(article.category || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "de"));
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const activeTag = tagFilter.trim().toLowerCase();
    const activeCategory = categoryFilter.trim().toLowerCase();
    return articles
      .filter((article) => {
        if (activeCategory) {
          const category = String(article.category || "").trim().toLowerCase();
          if (category !== activeCategory) return false;
        }
        if (activeTag) {
          const hasTag = (article.tags || []).some(
            (tag) => String(tag).toLowerCase() === activeTag
          );
          if (!hasTag) return false;
        }
        if (!needle) return true;
        const haystack = [
          article.title,
          article.category,
          (article.tags || []).join(" "),
          plainTextFromHtml(article.content)
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return String(b.updatedAt).localeCompare(String(a.updatedAt));
      });
  }, [articles, query, tagFilter, categoryFilter]);

  const activeArticle = useMemo(
    () => articles.find((article) => article.id === activeId) || null,
    [articles, activeId]
  );
  const pinnedCount = articles.filter((article) => article.pinned).length;
  const activeArticleWords = activeArticle ? plainTextFromHtml(activeArticle.content).split(/\s+/).filter(Boolean).length : 0;

  const scheduleUpdate = (id, patch) => {
    pendingPatchesRef.current[id] = {
      ...(pendingPatchesRef.current[id] || {}),
      ...patch
    };
    if (saveTimersRef.current[id]) {
      clearTimeout(saveTimersRef.current[id]);
    }
    saveTimersRef.current[id] = setTimeout(async () => {
      const payload = pendingPatchesRef.current[id];
      delete pendingPatchesRef.current[id];
      delete saveTimersRef.current[id];
      if (!payload) return;
      try {
        await api.update(id, payload);
      } catch (error) {
        console.error("Knowledge update failed", error);
      }
    }, 500);
  };

  const addArticle = async () => {
    try {
      const created = await api.create({
        title: "Neuer Artikel",
        category: "",
        tags: [],
        content: "",
        pinned: false
      });
      setArticles((prev) => [created, ...prev]);
      setActiveId(created.id);
    } catch (error) {
      console.error("Knowledge create failed", error);
    }
  };

  const updateArticle = (id, patch) => {
    setArticles((prev) =>
      prev.map((article) =>
        article.id === id
          ? {
              ...article,
              ...patch,
              updatedAt: Date.now()
            }
          : article
      )
    );
    scheduleUpdate(id, patch);
  };

  const removeArticle = async (id) => {
    if (!window.confirm("Artikel wirklich löschen?")) return;
    setArticles((prev) => prev.filter((article) => article.id !== id));
    try {
      await api.remove(id);
    } catch (error) {
      console.error("Knowledge delete failed", error);
    }
    if (saveTimersRef.current[id]) {
      clearTimeout(saveTimersRef.current[id]);
      delete saveTimersRef.current[id];
    }
    delete pendingPatchesRef.current[id];
  };

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-200)] bg-[var(--nav-active-bg)] text-[var(--nav-accent)]">
              <BookOpen size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="truncate text-xl font-display text-sand-900">Wissens-DB</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-sand-600">
            <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1">
              <FileText size={12} />
              {articles.length} Artikel
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
              <Star size={12} className={pinnedCount ? "fill-amber-400" : ""} />
              {pinnedCount} fixiert
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1">
              <FolderOpen size={12} />
              {uniqueCategories.length} Kategorien
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-6 py-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-[26px] border border-sand-200 bg-white shadow-soft">
            <div className="border-b border-sand-200 bg-sand-50/70 p-3">
              <button
                type="button"
                onClick={addArticle}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sand-900 bg-sand-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <Plus size={14} /> Neuer Artikel
              </button>
              <div className="relative mt-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Suche Titel, Inhalt, Tags..."
                  className="w-full rounded-xl border border-sand-200 bg-white py-2 pl-8 pr-2 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Alle Kategorien</option>
                  {uniqueCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Alle Tags</option>
                  {uniqueTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-sand-500">
                <span>{filteredArticles.length} Treffer</span>
                {(query || tagFilter || categoryFilter) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setTagFilter("");
                      setCategoryFilter("");
                    }}
                    className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-sand-600 hover:bg-sand-100"
                  >
                    Filter leeren
                  </button>
                ) : null}
              </div>
            </div>

            <div className="max-h-[calc(100vh-245px)] overflow-auto">
              {filteredArticles.length === 0 ? (
                <div className="p-8 text-center text-sm text-sand-500">
                  Keine passenden Artikel.
                </div>
              ) : (
                filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => setActiveId(article.id)}
                    className={`w-full border-b border-sand-100 px-3 py-3 text-left transition hover:bg-sand-50 ${
                      article.id === activeId ? "bg-sky-50/70 shadow-[inset_3px_0_0_var(--nav-accent)]" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-sand-900">{article.title || "Ohne Titel"}</p>
                      {article.pinned ? <Star size={13} className="mt-0.5 shrink-0 fill-amber-500 text-amber-500" /> : null}
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-sand-500">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <FolderOpen size={11} className="shrink-0 text-sand-400" />
                        <span className="truncate">{article.category || "Keine Kategorie"}</span>
                      </span>
                      <span className="shrink-0 text-sand-300">·</span>
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Clock3 size={11} className="shrink-0 text-sand-400" />
                        <span className="truncate">{formatDate(article.updatedAt)}</span>
                      </span>
                    </div>
                    {(article.tags || []).length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(article.tags || []).slice(0, 4).map((tag) => (
                          <span key={`${article.id}-${tag}`} className={tagClass}>
                            #{tag}
                          </span>
                        ))}
                        {(article.tags || []).length > 4 ? (
                          <span className={tagClass}>+{(article.tags || []).length - 4}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-[26px] border border-sand-200 bg-white p-4 shadow-soft">
            {!activeArticle ? (
              <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 text-sm text-sand-500">
                Artikel auswählen oder neu anlegen.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-sand-200 bg-sand-50/70 p-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      value={activeArticle.title || ""}
                      onChange={(event) =>
                        updateArticle(activeArticle.id, { title: event.target.value })
                      }
                      placeholder="Titel"
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-lg font-semibold text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-[220px_minmax(0,1fr)]">
                      <label className="relative">
                        <FolderOpen size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-400" />
                        <input
                          value={activeArticle.category || ""}
                          onChange={(event) =>
                            updateArticle(activeArticle.id, { category: event.target.value })
                          }
                          placeholder="Kategorie"
                          className="w-full rounded-xl border border-sand-200 bg-white py-2 pl-8 pr-3 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="relative">
                        <Tags size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-400" />
                        <input
                          value={(activeArticle.tags || []).join(", ")}
                          onChange={(event) =>
                            updateArticle(activeArticle.id, { tags: toTagArray(event.target.value) })
                          }
                          placeholder="Tags, Komma-getrennt"
                          className="w-full rounded-xl border border-sand-200 bg-white py-2 pl-8 pr-3 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-sand-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        Aktualisiert: {formatDate(activeArticle.updatedAt)}
                      </span>
                      <span className="text-sand-300">·</span>
                      <span>{activeArticleWords} Wörter</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateArticle(activeArticle.id, { pinned: !Boolean(activeArticle.pinned) })
                      }
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
                        activeArticle.pinned
                          ? "border-amber-300 bg-amber-50 text-amber-700"
                          : "border-sand-200 text-sand-600 hover:bg-sand-100"
                      }`}
                      title="Anpinnen"
                    >
                      <Star size={15} className={activeArticle.pinned ? "fill-amber-500" : ""} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeArticle(activeArticle.id)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sand-200 text-sand-600 hover:bg-rose-50 hover:text-rose-700"
                      title="Löschen"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <NotesRichTextEditor
                  value={activeArticle.content || ""}
                  onChange={(next) => updateArticle(activeArticle.id, { content: next })}
                  placeholder="Wissensartikel hier dokumentieren..."
                  minHeight="520px"
                  aiModule="knowledge"
                  aiContext={{
                    topic: activeArticle.title,
                    module: "Wissens-DB",
                    notes: [activeArticle.category, activeArticle.tags].filter(Boolean).join(" ")
                  }}
                />
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
