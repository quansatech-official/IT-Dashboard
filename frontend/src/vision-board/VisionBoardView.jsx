import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Palette, Pin, Plus, RefreshCw, Trash2 } from "lucide-react";

const API = "/api";
const NOTE_WIDTH = 220;
const NOTE_HEIGHT = 170;
const NOTE_MIN_WIDTH = 180;
const NOTE_MIN_HEIGHT = 140;
const NOTE_MAX_WIDTH = 520;
const NOTE_MAX_HEIGHT = 420;
const BOARD_MIN_WIDTH = 960;
const BOARD_MIN_HEIGHT = 680;
const LIVE_REFRESH_MS = 1200;
const SAVE_DEBOUNCE_MS = 350;

const COLOR_OPTIONS = [
  {
    id: "lemon",
    label: "Gelb",
    noteClass: "border-[#e7d45c] bg-[#fff4a3] text-[#2d2a13]",
    swatchClass: "border-[#e7d45c] bg-[#fff4a3]"
  },
  {
    id: "coral",
    label: "Koralle",
    noteClass: "border-[#ef9a8d] bg-[#ffd0c7] text-[#33201f]",
    swatchClass: "border-[#ef9a8d] bg-[#ffd0c7]"
  },
  {
    id: "mint",
    label: "Mint",
    noteClass: "border-[#8ed1b1] bg-[#c7f4df] text-[#183025]",
    swatchClass: "border-[#8ed1b1] bg-[#c7f4df]"
  },
  {
    id: "sky",
    label: "Blau",
    noteClass: "border-[#8dbbea] bg-[#cde6ff] text-[#17283b]",
    swatchClass: "border-[#8dbbea] bg-[#cde6ff]"
  },
  {
    id: "rose",
    label: "Rose",
    noteClass: "border-[#dda0c5] bg-[#f7d3ea] text-[#331c2b]",
    swatchClass: "border-[#dda0c5] bg-[#f7d3ea]"
  }
];

const ROTATIONS = [-1.5, 1.2, -0.7, 1.7, -1.1, 0.9];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const createDraftNote = (index = 0, text = "") => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  text,
  color: COLOR_OPTIONS[index % COLOR_OPTIONS.length].id,
  x: 6 + (index % 4) * 20,
  y: 8 + Math.floor(index / 4) * 22,
  width: NOTE_WIDTH,
  height: NOTE_HEIGHT,
  rotation: ROTATIONS[index % ROTATIONS.length],
  locked: false,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

const normalizeNote = (note, index = 0) => ({
  ...createDraftNote(index),
  ...note,
  text: typeof note?.text === "string" ? note.text : "",
  color: COLOR_OPTIONS.some((option) => option.id === note?.color) ? note.color : COLOR_OPTIONS[0].id,
  x: Number.isFinite(Number(note?.x)) ? Number(note.x) : 6 + (index % 4) * 20,
  y: Number.isFinite(Number(note?.y)) ? Number(note.y) : 8 + Math.floor(index / 4) * 22,
  width: Number.isFinite(Number(note?.width)) ? Number(note.width) : NOTE_WIDTH,
  height: Number.isFinite(Number(note?.height)) ? Number(note.height) : NOTE_HEIGHT,
  rotation: Number.isFinite(Number(note?.rotation)) ? Number(note.rotation) : ROTATIONS[index % ROTATIONS.length],
  locked: Boolean(note?.locked),
  createdAt: Number(note?.createdAt || Date.now()),
  updatedAt: Number(note?.updatedAt || Date.now())
});

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
};

const fetchEmpty = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
};

const api = {
  list: () => fetchJson(`${API}/vision_board/notes`),
  create: (note) =>
    fetchJson(`${API}/vision_board/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note)
    }),
  update: (id, patch) =>
    fetchJson(`${API}/vision_board/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    }),
  remove: (id) =>
    fetchEmpty(`${API}/vision_board/notes/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }),
  clear: () =>
    fetchEmpty(`${API}/vision_board/notes`, {
      method: "DELETE"
    })
};

export default function VisionBoardView() {
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const saveTimersRef = useRef({});
  const pendingPatchesRef = useRef({});
  const saveSequenceRef = useRef({});
  const dirtyNotesRef = useRef(new Set());
  const deletedNotesRef = useRef(new Set());
  const creatingNotesRef = useRef(new Set());
  const pollInFlightRef = useRef(false);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");

  const colorLookup = useMemo(
    () =>
      COLOR_OPTIONS.reduce((acc, option) => {
        acc[option.id] = option;
        return acc;
      }, {}),
    []
  );

  const applyRemoteNotes = useCallback((remoteNotes, force = false) => {
    const normalized = remoteNotes.map((note, index) => normalizeNote(note, index));
    setNotes((current) => {
      const currentById = new Map(current.map((note) => [note.id, note]));
      const next = normalized
        .filter((note) => force || !deletedNotesRef.current.has(note.id))
        .map((note) => {
          if (!force && dirtyNotesRef.current.has(note.id)) {
            return currentById.get(note.id) || note;
          }
          return note;
        });

      if (!force) {
        current.forEach((note) => {
          if (dirtyNotesRef.current.has(note.id) && !normalized.some((remote) => remote.id === note.id)) {
            next.push(note);
          }
        });
      }

      return next;
    });
  }, []);

  const loadNotes = useCallback(
    async (force = false) => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const data = await api.list();
        applyRemoteNotes(Array.isArray(data?.notes) ? data.notes : [], force);
        setError("");
      } catch (loadError) {
        setError("VisionBoard konnte nicht synchronisiert werden.");
      } finally {
        pollInFlightRef.current = false;
        setLoaded(true);
      }
    },
    [applyRemoteNotes]
  );

  useEffect(() => {
    loadNotes(true);
    const interval = window.setInterval(() => loadNotes(false), LIVE_REFRESH_MS);
    return () => {
      window.clearInterval(interval);
      Object.values(saveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, [loadNotes]);

  const scheduleSave = useCallback((id, patch) => {
    dirtyNotesRef.current.add(id);
    pendingPatchesRef.current[id] = {
      ...(pendingPatchesRef.current[id] || {}),
      ...patch
    };
    setSaveState("saving");
    saveSequenceRef.current[id] = Number(saveSequenceRef.current[id] || 0) + 1;
    const sequence = saveSequenceRef.current[id];
    if (saveTimersRef.current[id]) {
      window.clearTimeout(saveTimersRef.current[id]);
    }
    const flushSave = async () => {
      delete saveTimersRef.current[id];
      if (creatingNotesRef.current.has(id)) {
        saveTimersRef.current[id] = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS);
        return;
      }
      try {
        const queuedPatch = pendingPatchesRef.current[id] || {};
        const saved = await api.update(id, queuedPatch);
        if (saveSequenceRef.current[id] !== sequence) return;
        delete pendingPatchesRef.current[id];
        dirtyNotesRef.current.delete(id);
        setNotes((current) =>
          current.map((note) => (note.id === id ? { ...note, ...normalizeNote(saved) } : note))
        );
        setSaveState("saved");
        setSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
        setError("");
      } catch (saveError) {
        setSaveState("error");
        setError("Änderung konnte nicht gespeichert werden.");
      }
    };
    saveTimersRef.current[id] = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, []);

  const addNote = async () => {
    const draft = createDraftNote(notes.length);
    setNotes((current) => [...current, draft]);
    setActiveNoteId(draft.id);
    creatingNotesRef.current.add(draft.id);
    dirtyNotesRef.current.add(draft.id);
    setSaveState("saving");
    try {
      const saved = await api.create(draft);
      creatingNotesRef.current.delete(draft.id);
      const hasPendingSave = Boolean(saveTimersRef.current[draft.id]);
      if (!hasPendingSave) {
        dirtyNotesRef.current.delete(draft.id);
      }
      setNotes((current) =>
        current.map((note) =>
          note.id === draft.id
            ? hasPendingSave
              ? { ...note, createdAt: saved.createdAt, updatedAt: Math.max(note.updatedAt || 0, saved.updatedAt || 0) }
              : normalizeNote(saved, current.length)
            : note
        )
      );
      setSaveState(hasPendingSave ? "saving" : "saved");
      setSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
      setError("");
    } catch (createError) {
      creatingNotesRef.current.delete(draft.id);
      setSaveState("error");
      setError("Sticky Note konnte nicht erstellt werden.");
    }
  };

  const updateNote = (id, patch) => {
    setNotes((current) =>
      current.map((note) =>
        note.id === id
          ? {
              ...note,
              ...patch,
              updatedAt: Date.now()
            }
          : note
      )
    );
    scheduleSave(id, patch);
  };

  const removeNote = async (id) => {
    deletedNotesRef.current.add(id);
    dirtyNotesRef.current.delete(id);
    creatingNotesRef.current.delete(id);
    delete pendingPatchesRef.current[id];
    if (saveTimersRef.current[id]) {
      window.clearTimeout(saveTimersRef.current[id]);
      delete saveTimersRef.current[id];
    }
    setNotes((current) => current.filter((note) => note.id !== id));
    if (activeNoteId === id) setActiveNoteId("");
    try {
      await api.remove(id);
      setError("");
    } catch (removeError) {
      setError("Sticky Note konnte nicht gelöscht werden.");
      deletedNotesRef.current.delete(id);
      loadNotes(true);
    }
  };

  const clearBoard = async () => {
    if (!window.confirm("VisionBoard leeren?")) return;
    setNotes([]);
    setActiveNoteId("");
    dirtyNotesRef.current.clear();
    creatingNotesRef.current.clear();
    pendingPatchesRef.current = {};
    Object.values(saveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    saveTimersRef.current = {};
    try {
      await api.clear();
      setSaveState("saved");
      setSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
      setError("");
    } catch (clearError) {
      setError("VisionBoard konnte nicht geleert werden.");
      loadNotes(true);
    }
  };

  const startDrag = (note, event) => {
    if (note.locked) return;
    const board = boardRef.current;
    if (!board) return;
    const card = event.currentTarget.closest("[data-note-card]");
    const boardRect = board.getBoundingClientRect();
    const noteWidth = card?.offsetWidth || NOTE_WIDTH;
    const noteHeight = card?.offsetHeight || NOTE_MIN_HEIGHT;
    dragRef.current = {
      id: note.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: note.x,
      originY: note.y,
      boardWidth: boardRect.width,
      boardHeight: boardRect.height,
      noteWidth,
      noteHeight
    };
    setActiveNoteId(note.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = ((event.clientX - drag.startX) / drag.boardWidth) * 100;
    const deltaY = ((event.clientY - drag.startY) / drag.boardHeight) * 100;
    const maxX = Math.max(1, 100 - (drag.noteWidth / drag.boardWidth) * 100 - 1);
    const maxY = Math.max(1, 100 - (drag.noteHeight / drag.boardHeight) * 100 - 1);
    const x = clamp(drag.originX + deltaX, 1, maxX);
    const y = clamp(drag.originY + deltaY, 1, maxY);
    updateNote(drag.id, { x, y });
  };

  const endDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const startResize = (note, event) => {
    if (note.locked) return;
    const board = boardRef.current;
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    resizeRef.current = {
      id: note.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: note.width,
      originHeight: note.height,
      maxWidth: Math.max(NOTE_MIN_WIDTH, Math.min(NOTE_MAX_WIDTH, boardRect.width - (note.x / 100) * boardRect.width - 12)),
      maxHeight: Math.max(NOTE_MIN_HEIGHT, Math.min(NOTE_MAX_HEIGHT, boardRect.height - (note.y / 100) * boardRect.height - 12))
    };
    setActiveNoteId(note.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveResize = (event) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const width = clamp(resize.originWidth + event.clientX - resize.startX, NOTE_MIN_WIDTH, resize.maxWidth);
    const height = clamp(resize.originHeight + event.clientY - resize.startY, NOTE_MIN_HEIGHT, resize.maxHeight);
    updateNote(resize.id, { width, height });
  };

  const endResize = (event) => {
    if (!resizeRef.current || resizeRef.current.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-sand-50 text-sand-900">
      <header className="shrink-0 border-b border-sand-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sand-900 text-white">
              <Pin size={16} />
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.25em] text-sand-500">Aufgaben</p>
              <h1 className="font-display text-lg text-sand-900">VisionBoard</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-sand-600">
            <span>
              {saveState === "saving"
                ? "Speichert..."
                : saveState === "error"
                ? "Speichern fehlgeschlagen"
                : savedAt
                ? `Gespeichert ${savedAt}`
                : "Live-Sync aktiv"}
            </span>
            <button
              type="button"
              onClick={() => loadNotes(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
            >
              <RefreshCw size={14} />
              Laden
            </button>
            {notes.length > 0 ? (
              <button
                type="button"
                onClick={clearBoard}
                className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
              >
                <Trash2 size={14} />
                Leeren
              </button>
            ) : null}
            <button
              type="button"
              onClick={addNote}
              className="inline-flex items-center gap-2 rounded-lg border border-sand-900 bg-sand-900 px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-90"
            >
              <Plus size={14} />
              Sticky Note
            </button>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-sand-600">
          <div className="flex items-center gap-2">
            {loaded ? <Palette size={14} /> : <Loader2 size={14} className="animate-spin" />}
            <span className="uppercase tracking-[0.25em]">Whiteboard</span>
            {error ? <span className="text-red-600">{error}</span> : null}
          </div>
          <span>{notes.length === 1 ? "1 Notizzettel" : `${notes.length} Notizzettel`}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-sand-300 bg-white p-3 shadow-soft">
          <div
            ref={boardRef}
            className="relative h-full min-h-[680px] overflow-hidden rounded-lg border border-sand-200 bg-[#f8fafc]"
            style={{
              minWidth: `${BOARD_MIN_WIDTH}px`,
              minHeight: `${BOARD_MIN_HEIGHT}px`,
              backgroundImage:
                "linear-gradient(rgba(31, 41, 55, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(31, 41, 55, 0.07) 1px, transparent 1px)",
              backgroundSize: "28px 28px"
            }}
          >
            {loaded && notes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  type="button"
                  onClick={addNote}
                  className="inline-flex items-center gap-2 rounded-lg border border-sand-900 bg-sand-900 px-4 py-3 text-sm uppercase tracking-wide text-white shadow-soft hover:opacity-90"
                >
                  <Plus size={16} />
                  Erste Sticky Note
                </button>
              </div>
            ) : null}

            {notes.map((note) => {
              const color = colorLookup[note.color] || COLOR_OPTIONS[0];
              return (
                <section
                  key={note.id}
                  data-note-card
                  className={`absolute flex flex-col rounded-lg border p-3 shadow-[0_12px_22px_rgba(31,41,55,0.18)] transition-shadow ${
                    color.noteClass
                  } ${activeNoteId === note.id ? "z-20 ring-2 ring-[var(--bg-900)]" : "z-10"}`}
                  style={{
                    left: `${note.x}%`,
                    top: `${note.y}%`,
                    width: `${note.width}px`,
                    height: `${note.height}px`,
                    transform: `rotate(${note.rotation || 0}deg)`
                  }}
                >
                  <div
                    className={`mb-2 flex touch-none items-center justify-between gap-2 ${
                      note.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                    }`}
                    onPointerDown={(event) => startDrag(note, event)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    <button
                      type="button"
                      onClick={() => updateNote(note.id, { locked: !note.locked })}
                      onPointerDown={(event) => event.stopPropagation()}
                      className={`rounded-md border border-black/10 p-1 ${
                        note.locked ? "bg-white/80" : "bg-white/40 hover:bg-white/70"
                      }`}
                      title={note.locked ? "Fixierung lösen" : "Fixieren"}
                    >
                      <Pin size={14} fill={note.locked ? "currentColor" : "none"} />
                    </button>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-black/45">
                        {note.locked ? "fixiert" : "ziehen"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNote(note.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        className="rounded-md border border-black/10 bg-white/40 p-1 hover:bg-white/70"
                        title="Löschen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={note.text}
                    onChange={(event) => updateNote(note.id, { text: event.target.value })}
                    onFocus={() => setActiveNoteId(note.id)}
                    onPointerDown={(event) => event.stopPropagation()}
                    placeholder="Worauf willst du hinarbeiten?"
                    className="min-h-[92px] flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-black/40"
                    spellCheck="false"
                  />

                  <div className="mt-3 flex items-center gap-1">
                    {COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateNote(note.id, { color: option.id })}
                        className={`flex h-5 w-5 items-center justify-center rounded-md border ${option.swatchClass}`}
                        title={option.label}
                      >
                        {note.color === option.id ? <Check size={12} /> : null}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      startResize(note, event);
                    }}
                    onPointerMove={moveResize}
                    onPointerUp={endResize}
                    onPointerCancel={endResize}
                    className={`absolute bottom-1.5 right-1.5 h-4 w-4 touch-none rounded border border-black/15 bg-white/50 ${
                      note.locked ? "cursor-not-allowed opacity-40" : "cursor-nwse-resize hover:bg-white/80"
                    }`}
                    title={note.locked ? "Fixiert" : "Größe ändern"}
                    aria-label={note.locked ? "Note ist fixiert" : "Größe ändern"}
                  >
                    <span className="block h-full w-full rounded-sm bg-[linear-gradient(135deg,transparent_0_45%,rgba(0,0,0,0.28)_45%_52%,transparent_52%_64%,rgba(0,0,0,0.28)_64%_71%,transparent_71%)]" />
                  </button>
                </section>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
