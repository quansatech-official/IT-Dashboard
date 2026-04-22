import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Minus, Palette, Pin, Plus, RefreshCw, Trash2 } from "lucide-react";

const API = "/api";
const NOTE_WIDTH = 220;
const NOTE_HEIGHT = 170;
const NOTE_MIN_WIDTH = 180;
const NOTE_MIN_HEIGHT = 140;
const NOTE_MAX_WIDTH = 520;
const NOTE_MAX_HEIGHT = 420;
const BOARD_MIN_WIDTH = 960;
const BOARD_MIN_HEIGHT = 680;
const BOARD_SCALE_MIN = 0.3;
const BOARD_SCALE_MAX = 1;
const BOARD_SCALE_STEP = 0.1;
const NOTE_FOCUS_SCALE = 1.35;
const NOTE_FOCUS_DELAY_MS = 350;
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
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const hoverZoomTimerRef = useRef(null);
  const saveTimersRef = useRef({});
  const pendingPatchesRef = useRef({});
  const saveSequenceRef = useRef({});
  const dirtyNotesRef = useRef(new Set());
  const deletedNotesRef = useRef(new Set());
  const creatingNotesRef = useRef(new Set());
  const pollInFlightRef = useRef(false);
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState("");
  const [draggingNoteId, setDraggingNoteId] = useState("");
  const [boardScale, setBoardScale] = useState(1);
  const [hoverZoomNoteId, setHoverZoomNoteId] = useState("");
  const [pinnedZoomNoteId, setPinnedZoomNoteId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const [containerSize, setContainerSize] = useState({ width: BOARD_MIN_WIDTH, height: BOARD_MIN_HEIGHT });

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
      if (hoverZoomTimerRef.current) window.clearTimeout(hoverZoomTimerRef.current);
      Object.values(saveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, [loadNotes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setContainerSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    observer.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0) setContainerSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (boardScale < 1) return;
    if (hoverZoomTimerRef.current) {
      window.clearTimeout(hoverZoomTimerRef.current);
      hoverZoomTimerRef.current = null;
    }
    setHoverZoomNoteId("");
    setPinnedZoomNoteId("");
  }, [boardScale]);

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
    if (hoverZoomNoteId === id) setHoverZoomNoteId("");
    if (pinnedZoomNoteId === id) setPinnedZoomNoteId("");
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
    setHoverZoomNoteId("");
    setPinnedZoomNoteId("");
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
    const noteWidth = card?.offsetWidth || NOTE_WIDTH;
    const noteHeight = card?.offsetHeight || NOTE_MIN_HEIGHT;
    dragRef.current = {
      id: note.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: note.x,
      originY: note.y,
      boardWidth: board.offsetWidth,
      boardHeight: board.offsetHeight,
      noteWidth,
      noteHeight,
      boardScale
    };
    setActiveNoteId(note.id);
    setDraggingNoteId(note.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = ((event.clientX - drag.startX) / (drag.boardWidth * drag.boardScale)) * 100;
    const deltaY = ((event.clientY - drag.startY) / (drag.boardHeight * drag.boardScale)) * 100;
    const maxX = Math.max(1, 100 - (drag.noteWidth / drag.boardWidth) * 100 - 1);
    const maxY = Math.max(1, 100 - (drag.noteHeight / drag.boardHeight) * 100 - 1);
    const x = clamp(drag.originX + deltaX, 1, maxX);
    const y = clamp(drag.originY + deltaY, 1, maxY);
    updateNote(drag.id, { x, y });
  };

  const endDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingNoteId("");
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const startResize = (note, event) => {
    if (note.locked) return;
    const board = boardRef.current;
    if (!board) return;
    resizeRef.current = {
      id: note.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: note.width,
      originHeight: note.height,
      boardScale,
      maxWidth: Math.max(NOTE_MIN_WIDTH, Math.min(NOTE_MAX_WIDTH, board.offsetWidth - (note.x / 100) * board.offsetWidth - 12)),
      maxHeight: Math.max(NOTE_MIN_HEIGHT, Math.min(NOTE_MAX_HEIGHT, board.offsetHeight - (note.y / 100) * board.offsetHeight - 12))
    };
    setActiveNoteId(note.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveResize = (event) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const width = clamp(
      resize.originWidth + (event.clientX - resize.startX) / resize.boardScale,
      NOTE_MIN_WIDTH,
      resize.maxWidth
    );
    const height = clamp(
      resize.originHeight + (event.clientY - resize.startY) / resize.boardScale,
      NOTE_MIN_HEIGHT,
      resize.maxHeight
    );
    updateNote(resize.id, { width, height });
  };

  const endResize = (event) => {
    if (!resizeRef.current || resizeRef.current.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const changeBoardScale = (direction) => {
    setBoardScale((current) => {
      const next = clamp(current + direction * BOARD_SCALE_STEP, BOARD_SCALE_MIN, BOARD_SCALE_MAX);
      return Number(next.toFixed(2));
    });
  };

  const startHoverZoom = (id) => {
    if (boardScale >= 1 || pinnedZoomNoteId) return;
    if (hoverZoomTimerRef.current) window.clearTimeout(hoverZoomTimerRef.current);
    hoverZoomTimerRef.current = window.setTimeout(() => {
      setHoverZoomNoteId(id);
      hoverZoomTimerRef.current = null;
    }, NOTE_FOCUS_DELAY_MS);
  };

  const stopHoverZoom = (id) => {
    if (hoverZoomTimerRef.current) {
      window.clearTimeout(hoverZoomTimerRef.current);
      hoverZoomTimerRef.current = null;
    }
    if (hoverZoomNoteId === id) setHoverZoomNoteId("");
  };

  const focusNoteZoom = (id) => {
    if (boardScale >= 1) return;
    if (hoverZoomTimerRef.current) {
      window.clearTimeout(hoverZoomTimerRef.current);
      hoverZoomTimerRef.current = null;
    }
    setPinnedZoomNoteId(id);
    setHoverZoomNoteId("");
  };

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-sand-50 text-sand-900">
      <header className="shrink-0 border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--nav-active-bg)] text-[var(--nav-accent)] flex items-center justify-center border border-[var(--border-200)]">
              <Pin size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">VisionBoard</h1>
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
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-85 transition-opacity duration-150"
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

        <div
          ref={containerRef}
          className="min-h-0 flex-1 overflow-hidden rounded-lg border border-sand-300 bg-white shadow-soft relative"
          onPointerDown={(event) => {
            if (!event.target.closest("[data-note-card]")) setPinnedZoomNoteId("");
          }}
        >
          <div
            ref={boardRef}
            className="absolute top-0 left-0 overflow-hidden rounded-lg border border-sand-200 bg-[#f8fafc]"
            style={{
              width: `${Math.round(containerSize.width / boardScale)}px`,
              height: `${Math.round(containerSize.height / boardScale)}px`,
              transform: `scale(${boardScale})`,
              transformOrigin: "top left",
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
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] px-4 py-3 text-sm uppercase tracking-wide text-white shadow-soft hover:opacity-85 transition-opacity duration-150"
                >
                  <Plus size={16} />
                  Erste Sticky Note
                </button>
              </div>
            ) : null}

            {notes.map((note) => {
              const color = colorLookup[note.color] || COLOR_OPTIONS[0];
              const isZoomed = boardScale < 1 && (pinnedZoomNoteId === note.id || hoverZoomNoteId === note.id);
              return (
                <section
                  key={note.id}
                  data-note-card
                  onMouseEnter={() => startHoverZoom(note.id)}
                  onMouseLeave={() => stopHoverZoom(note.id)}
                  onClick={() => focusNoteZoom(note.id)}
                  className={`absolute flex flex-col rounded-lg border p-3 transition-[box-shadow,transform] duration-200 ${
                    color.noteClass
                  } ${
                    activeNoteId === note.id ? "ring-2 ring-black/20" : ""
                  } ${isZoomed ? "z-30" : activeNoteId === note.id ? "z-20" : "z-10"}`}
                  style={{
                    left: `${note.x}%`,
                    top: `${note.y}%`,
                    width: `${note.width}px`,
                    height: `${note.height}px`,
                    transform: `rotate(${note.rotation || 0}deg) scale(${isZoomed ? NOTE_FOCUS_SCALE : draggingNoteId === note.id ? 1.03 : 1})`,
                    transformOrigin: "center",
                    boxShadow: draggingNoteId === note.id
                      ? "0 24px 48px rgba(31,41,55,0.32), 0 8px 16px rgba(31,41,55,0.18)"
                      : activeNoteId === note.id
                      ? "0 18px 34px rgba(31,41,55,0.22), 0 6px 12px rgba(31,41,55,0.12)"
                      : "0 6px 16px rgba(31,41,55,0.12), 0 2px 6px rgba(31,41,55,0.08)"
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

                  <div className="mt-2 flex items-center gap-1.5">
                    {COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateNote(note.id, { color: option.id })}
                        onPointerDown={(event) => event.stopPropagation()}
                        className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-transform duration-100 hover:scale-110 ${option.swatchClass} ${
                          note.color === option.id ? "ring-2 ring-black/30 ring-offset-1" : "opacity-70 hover:opacity-100"
                        }`}
                        title={option.label}
                      >
                        {note.color === option.id ? <Check size={11} strokeWidth={2.5} /> : null}
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
                    className={`absolute bottom-2 right-2 h-5 w-5 touch-none rounded border border-black/20 bg-white/60 transition-colors duration-100 ${
                      note.locked ? "cursor-not-allowed opacity-30" : "cursor-nwse-resize hover:bg-white/90"
                    }`}
                    title={note.locked ? "Fixiert" : "Größe ändern"}
                    aria-label={note.locked ? "Note ist fixiert" : "Größe ändern"}
                  >
                    <svg viewBox="0 0 10 10" className="h-full w-full p-0.5 opacity-60">
                      <line x1="3" y1="9" x2="9" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <line x1="6" y1="9" x2="9" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </section>
              );
            })}
          </div>
        </div>
      </main>
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-sand-200 bg-white/95 p-2 text-xs text-sand-700 shadow-soft backdrop-blur">
        <button
          type="button"
          onClick={() => changeBoardScale(-1)}
          disabled={boardScale <= BOARD_SCALE_MIN}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sand-200 bg-white hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="VisionBoard verkleinern"
          title="VisionBoard verkleinern"
        >
          <Minus size={15} />
        </button>
        <span className="w-12 text-center font-metrics">{Math.round(boardScale * 100)}%</span>
        <button
          type="button"
          onClick={() => changeBoardScale(1)}
          disabled={boardScale >= BOARD_SCALE_MAX}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sand-200 bg-white hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="VisionBoard vergrößern"
          title="VisionBoard vergrößern"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
