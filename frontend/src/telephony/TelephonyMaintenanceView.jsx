import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Settings, Trash2, Wrench } from "lucide-react";

const API = "/api/pbx_phonebook";

const emptyDraft = {
  name: "",
  number: "",
  is_global: true,
  note: ""
};

export default function TelephonyMaintenanceView() {
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState("idle");
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);
  const [mode, setMode] = useState("local");
  const [remoteError, setRemoteError] = useState("");

  const loadEntries = () => {
    setStatus("loading");
    fetch(`${API}/remote?_pagesize=100`)
      .then((res) => {
        if (!res.ok) throw new Error("remote_failed");
        return res.json();
      })
      .then((data) => {
        setEntries(Array.isArray(data) ? data : []);
        setMode("remote");
        setRemoteError("");
        setStatus("ready");
      })
      .catch(() => {
        fetch(API)
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => {
            setEntries(Array.isArray(data) ? data : []);
            setMode("local");
            setRemoteError("NFON Zugriff nicht konfiguriert oder fehlgeschlagen.");
            setStatus("ready");
          })
          .catch(() => setStatus("error"));
      });
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const filteredEntries = useMemo(() => {
    if (!filter.trim()) return entries;
    const query = filter.trim().toLowerCase();
    return entries.filter((entry) =>
      [entry.name, entry.number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [entries, filter]);

  const createEntry = async () => {
    if (!draft.name.trim() && !draft.number.trim()) {
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(mode === "remote" ? `${API}/remote` : API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "remote"
            ? { name: draft.name, number: draft.number }
            : draft
        )
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      if (mode === "remote") {
        loadEntries();
      } else {
        setEntries((prev) => [data, ...prev]);
      }
      setDraft(emptyDraft);
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  const startEdit = (entry) => {
    setEditId(entry.id);
    setEditDraft({
      name: entry.name || "",
      number: entry.number || "",
      is_global: Boolean(entry.is_global),
      note: entry.note || ""
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    if (mode === "remote") {
      setRemoteError("Bearbeiten ist fuer NFON-Import aktuell nicht verfuegbar.");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`${API}/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft)
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setEntries((prev) => prev.map((entry) => (entry.id === data.id ? data : entry)));
      setEditId(null);
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  const deleteEntry = async (entryId) => {
    if (!window.confirm("Eintrag wirklich entfernen?")) return;
    if (mode === "remote") {
      setRemoteError("Loeschen ist fuer NFON-Import aktuell nicht verfuegbar.");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`${API}/${entryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete_failed");
      setEntries((prev) => prev.filter((entry) => entry.id !== entryId));
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
            <Wrench size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Anlagenwartung</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-sand-700">
              <Settings size={18} />
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Telefonbuch</p>
            </div>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs"
              placeholder="Suche"
            />
          </div>
          {remoteError ? (
            <p className="mb-3 text-xs text-rose-600">{remoteError}</p>
          ) : null}

          <div className="grid gap-3 md:grid-cols-4">
            <input
              className="rounded-2xl border border-sand-200 px-3 py-2 text-xs"
              placeholder="Name"
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="rounded-2xl border border-sand-200 px-3 py-2 text-xs"
              placeholder="Rufnummer"
              value={draft.number}
              onChange={(event) => setDraft((prev) => ({ ...prev, number: event.target.value }))}
            />
            <label className="flex items-center gap-2 text-xs text-sand-600">
              <input
                type="checkbox"
                checked={draft.is_global}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, is_global: event.target.checked }))
                }
                disabled={mode === "remote"}
              />
              Global
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={createEntry}
                className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
              >
                <Plus size={12} /> Neu
              </button>
              {status === "saved" && <span className="text-xs text-emerald-600">Gespeichert</span>}
              {status === "error" && <span className="text-xs text-rose-600">Fehler</span>}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {filteredEntries.length ? (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-sand-200 bg-sand-50 p-3"
                >
                  {editId === entry.id ? (
                    <div className="grid gap-3 md:grid-cols-4">
                      <input
                        className="rounded-2xl border border-sand-200 px-3 py-2 text-xs"
                        value={editDraft.name}
                        onChange={(event) =>
                          setEditDraft((prev) => ({ ...prev, name: event.target.value }))
                        }
                      />
                      <input
                        className="rounded-2xl border border-sand-200 px-3 py-2 text-xs"
                        value={editDraft.number}
                        onChange={(event) =>
                          setEditDraft((prev) => ({ ...prev, number: event.target.value }))
                        }
                      />
                      <label className="flex items-center gap-2 text-xs text-sand-600">
                        <input
                          type="checkbox"
                          checked={editDraft.is_global}
                          onChange={(event) =>
                            setEditDraft((prev) => ({
                              ...prev,
                              is_global: event.target.checked
                            }))
                          }
                        />
                        Global
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="inline-flex items-center gap-2 rounded-full border border-sand-900 bg-sand-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
                        >
                          <Save size={12} /> Speichern
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditId(null)}
                          className="rounded-full border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600"
                        >
                          Abbrechen
                        </button>
                      </div>
                      <textarea
                        className="md:col-span-5 rounded-2xl border border-sand-200 px-3 py-2 text-xs"
                        value={editDraft.note}
                        onChange={(event) =>
                          setEditDraft((prev) => ({ ...prev, note: event.target.value }))
                        }
                        placeholder="Notiz"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-sand-900">
                          {entry.name || "Unbenannt"}
                        </p>
                        <div className="text-xs text-sand-500">
                          {[entry.number].filter(Boolean).join(" · ")}
                        </div>
                        {entry.is_global ? (
                          <span className="mt-2 inline-flex rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-500">
                            Global
                          </span>
                        ) : null}
                        {entry.note ? (
                          <p className="mt-2 text-xs text-sand-500">{entry.note}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          disabled={mode === "remote"}
                          className="rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-600"
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          className="rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100"
                          title="Entfernen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-sand-200 bg-white p-4 text-sm text-sand-500">
                {status === "loading" ? "Telefonbuch wird geladen..." : "Noch keine Eintraege."}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
