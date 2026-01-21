import { useEffect, useMemo, useState } from "react";
import { Plus, Settings, Trash2, Wrench } from "lucide-react";

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
  const [editingCell, setEditingCell] = useState({ id: null, field: null });
  const [editValue, setEditValue] = useState("");
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

  const startCellEdit = (entry, field) => {
    if (mode === "remote") {
      setRemoteError("Bearbeiten ist fuer NFON-Import aktuell nicht verfuegbar.");
      return;
    }
    setEditingCell({ id: entry.id, field });
    if (field === "is_global") {
      setEditValue(Boolean(entry.is_global));
    } else {
      setEditValue(entry[field] || "");
    }
  };

  const commitCellEdit = async (overrideValue) => {
    if (!editingCell.id) return;
    if (mode === "remote") {
      setRemoteError("Bearbeiten ist fuer NFON-Import aktuell nicht verfuegbar.");
      return;
    }
    const entry = entries.find((item) => item.id === editingCell.id);
    if (!entry) {
      setEditingCell({ id: null, field: null });
      return;
    }
    const field = editingCell.field;
    const nextValue =
      overrideValue !== undefined ? overrideValue : field === "is_global" ? Boolean(editValue) : editValue;
    if ((entry[field] || "") === nextValue || (field === "is_global" && Boolean(entry.is_global) === nextValue)) {
      setEditingCell({ id: null, field: null });
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch(`${API}/${editingCell.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: nextValue })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setEntries((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
    setEditingCell({ id: null, field: null });
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

          <div className="mt-4 overflow-hidden rounded-2xl border border-sand-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-sand-50 text-[10px] uppercase tracking-[0.3em] text-sand-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Rufnummer</th>
                  <th className="px-4 py-3 text-left">Global</th>
                  <th className="px-4 py-3 text-left">Notiz</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {filteredEntries.length ? (
                  filteredEntries.map((entry) => {
                    const isNameEditing =
                      editingCell.id === entry.id && editingCell.field === "name";
                    const isNumberEditing =
                      editingCell.id === entry.id && editingCell.field === "number";
                    const isGlobalEditing =
                      editingCell.id === entry.id && editingCell.field === "is_global";
                    const isNoteEditing =
                      editingCell.id === entry.id && editingCell.field === "note";
                    return (
                      <tr key={entry.id} className="hover:bg-sand-50/70">
                        <td
                          className="px-4 py-3 text-sand-900"
                          onClick={() => startCellEdit(entry, "name")}
                        >
                          {isNameEditing ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(event) => setEditValue(event.target.value)}
                              onMouseDown={(event) => event.stopPropagation()}
                              onBlur={() => commitCellEdit()}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") commitCellEdit();
                                if (event.key === "Escape") setEditingCell({ id: null, field: null });
                              }}
                              className="w-full rounded-md border border-sand-200 bg-white px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="cursor-pointer">
                              {entry.name || <span className="text-sand-400">Unbenannt</span>}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-sand-900"
                          onClick={() => startCellEdit(entry, "number")}
                        >
                          {isNumberEditing ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(event) => setEditValue(event.target.value)}
                              onMouseDown={(event) => event.stopPropagation()}
                              onBlur={() => commitCellEdit()}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") commitCellEdit();
                                if (event.key === "Escape") setEditingCell({ id: null, field: null });
                              }}
                              className="w-full rounded-md border border-sand-200 bg-white px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className="cursor-pointer text-sand-700">
                              {entry.number || <span className="text-sand-400">—</span>}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-sand-900"
                          onClick={() => startCellEdit(entry, "is_global")}
                        >
                          {isGlobalEditing ? (
                            <label className="inline-flex items-center gap-2 text-xs text-sand-700">
                              <input
                                type="checkbox"
                                checked={Boolean(editValue)}
                                onMouseDown={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  setEditValue(checked);
                                  commitCellEdit(checked);
                                }}
                                onBlur={() => commitCellEdit()}
                              />
                              Global
                            </label>
                          ) : entry.is_global ? (
                            <span className="cursor-pointer rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-500">
                              Global
                            </span>
                          ) : (
                            <span className="cursor-pointer text-sand-400">—</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-sand-700"
                          onClick={() => startCellEdit(entry, "note")}
                        >
                          {isNoteEditing ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(event) => setEditValue(event.target.value)}
                              onMouseDown={(event) => event.stopPropagation()}
                              onBlur={() => commitCellEdit()}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") commitCellEdit();
                                if (event.key === "Escape") setEditingCell({ id: null, field: null });
                              }}
                              className="w-full rounded-md border border-sand-200 bg-white px-2 py-1 text-xs"
                              placeholder="Notiz"
                            />
                          ) : (
                            <span className="cursor-pointer">
                              {entry.note || <span className="text-sand-400">—</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry.id)}
                            disabled={mode === "remote"}
                            className="rounded-full border border-sand-200 bg-white p-2 text-sand-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Entfernen"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-sand-500"
                    >
                      {status === "loading" ? "Telefonbuch wird geladen..." : "Noch keine Eintraege."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
