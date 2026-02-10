import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Plus, Search, Star, Trash2 } from "lucide-react";
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Wissens-DB</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-4 rounded-3xl border border-sand-200 bg-white shadow-soft overflow-hidden">
            <div className="border-b border-sand-200 p-3 space-y-2">
              <button
                type="button"
                onClick={addArticle}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-sand-900 bg-sand-900 px-3 py-2 text-sm text-white hover:opacity-90"
              >
                <Plus size={14} /> Neuer Artikel
              </button>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Suche Titel, Inhalt, Tags..."
                  className="w-full rounded-xl border border-sand-200 bg-white pl-8 pr-2 py-2 text-sm focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm focus:outline-none"
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
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">Alle Tags</option>
                  {uniqueTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="max-h-[65vh] overflow-auto">
              {filteredArticles.length === 0 ? (
                <p className="p-4 text-sm text-sand-500">Keine passenden Artikel.</p>
              ) : (
                filteredArticles.map((article) => (
                  <button
                    key={article.id}
                    type="button"
                    onClick={() => setActiveId(article.id)}
                    className={`w-full text-left border-b border-sand-200 px-3 py-2.5 hover:bg-sand-100 ${
                      article.id === activeId ? "bg-sand-100" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-sand-900 line-clamp-1">{article.title || "Ohne Titel"}</p>
                      {article.pinned ? <Star size={13} className="text-amber-500 fill-amber-500" /> : null}
                    </div>
                    <p className="text-xs text-sand-500 line-clamp-1">
                      {(article.category || "Keine Kategorie") + " · " + formatDate(article.updatedAt)}
                    </p>
                    {(article.tags || []).length ? (
                      <p className="text-xs text-sand-600 line-clamp-1 mt-1">
                        {(article.tags || []).map((tag) => `#${tag}`).join(" ")}
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="lg:col-span-8 rounded-3xl border border-sand-200 bg-white shadow-soft p-4">
            {!activeArticle ? (
              <div className="h-full min-h-[420px] flex items-center justify-center text-sand-500 text-sm">
                Kein Artikel ausgewählt.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <input
                      value={activeArticle.title || ""}
                      onChange={(event) =>
                        updateArticle(activeArticle.id, { title: event.target.value })
                      }
                      placeholder="Titel"
                      className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-base font-medium focus:outline-none"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        value={activeArticle.category || ""}
                        onChange={(event) =>
                          updateArticle(activeArticle.id, { category: event.target.value })
                        }
                        placeholder="Kategorie (z. B. Netzwerk, Microsoft, SOP)"
                        className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm focus:outline-none"
                      />
                      <input
                        value={(activeArticle.tags || []).join(", ")}
                        onChange={(event) =>
                          updateArticle(activeArticle.id, { tags: toTagArray(event.target.value) })
                        }
                        placeholder="Tags (Komma-getrennt)"
                        className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm focus:outline-none"
                      />
                    </div>
                    <p className="text-xs text-sand-500">
                      Aktualisiert: {formatDate(activeArticle.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateArticle(activeArticle.id, { pinned: !Boolean(activeArticle.pinned) })
                      }
                      className={`inline-flex items-center justify-center rounded-xl border p-2 ${
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
                      className="inline-flex items-center justify-center rounded-xl border border-sand-200 p-2 text-sand-600 hover:bg-sand-100"
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
                  minHeight="420px"
                />
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
