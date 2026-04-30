import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Check,
  GitBranch,
  Loader2,
  Minus,
  Paintbrush,
  Palette,
  PenSquare,
  Pin,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";

const API = "/api";
const PINBOARD_NOTE_WIDTH = 220;
const PINBOARD_NOTE_HEIGHT = 170;
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
const MINDMAP_SAVE_DEBOUNCE_MS = 500;
const WHITEBOARD_WIDTH = 2200;
const WHITEBOARD_HEIGHT = 1400;
const WHITEBOARD_COLORS = ["#1f2937", "#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed"];
const WHITEBOARD_STROKE_WIDTHS = [2, 4, 6, 10];
const VISION_TABS = [
  { id: "pinboard", label: "Pinboard", icon: Pin },
  { id: "mindmap", label: "Mindmap", icon: GitBranch },
  { id: "whiteboard", label: "Whiteboard", icon: Paintbrush }
];

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
const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
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
  notes: {
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
    remove: (id) => fetchEmpty(`${API}/vision_board/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
    clear: () => fetchEmpty(`${API}/vision_board/notes`, { method: "DELETE" })
  },
  documents: {
    get: (key) => fetchJson(`${API}/vision_board/documents/${encodeURIComponent(key)}`),
    save: (key, content) =>
      fetchJson(`${API}/vision_board/documents/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      })
  },
  pushEvent: (payload) =>
    fetchJson(`${API}/vision_board/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
};

const createDraftNote = (index = 0, text = "") => ({
  id: uid(),
  text,
  color: COLOR_OPTIONS[index % COLOR_OPTIONS.length].id,
  x: 6 + (index % 4) * 20,
  y: 8 + Math.floor(index / 4) * 22,
  width: PINBOARD_NOTE_WIDTH,
  height: PINBOARD_NOTE_HEIGHT,
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
  width: Number.isFinite(Number(note?.width)) ? Number(note.width) : PINBOARD_NOTE_WIDTH,
  height: Number.isFinite(Number(note?.height)) ? Number(note.height) : PINBOARD_NOTE_HEIGHT,
  rotation: Number.isFinite(Number(note?.rotation)) ? Number(note.rotation) : ROTATIONS[index % ROTATIONS.length],
  locked: Boolean(note?.locked),
  createdAt: Number(note?.createdAt || Date.now()),
  updatedAt: Number(note?.updatedAt || Date.now())
});

const createMindmapNode = (label = "Neues Thema", position = { x: 0, y: 0 }, parentId = "") => ({
  id: uid(),
  type: "mindmap",
  position,
  data: { label, parentId }
});

const sanitizeMindmapNode = (node) => ({
  id: String(node?.id || uid()),
  type: "mindmap",
  position: {
    x: Number(node?.position?.x || 0),
    y: Number(node?.position?.y || 0)
  },
  data: {
    label: String(node?.data?.label || "Thema"),
    parentId: String(node?.data?.parentId || "")
  }
});

const sanitizeMindmapEdge = (edge) => ({
  id: String(edge?.id || uid()),
  source: String(edge?.source || ""),
  target: String(edge?.target || ""),
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed },
  animated: false
});

const createDefaultMindmapDocument = () => ({
  nodes: [
    {
      id: "root",
      type: "mindmap",
      position: { x: 0, y: 0 },
      data: { label: "Vision", parentId: "" }
    }
  ],
  edges: []
});

const normalizeMindmapDocument = (content) => {
  const source = content && typeof content === "object" ? content : {};
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  const rawEdges = Array.isArray(source.edges) ? source.edges : [];
  const nodes = rawNodes.length ? rawNodes.map(sanitizeMindmapNode) : createDefaultMindmapDocument().nodes;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = rawEdges
    .map(sanitizeMindmapEdge)
    .filter((edge) => edge.source && edge.target && nodeIds.has(edge.source) && nodeIds.has(edge.target));
  if (!nodeIds.has("root")) {
    nodes.unshift(createDefaultMindmapDocument().nodes[0]);
  }
  return { nodes, edges };
};

const createEmptyWhiteboardDocument = () => ({ strokes: [] });

const normalizeWhiteboardDocument = (content) => {
  const source = content && typeof content === "object" ? content : {};
  const strokes = Array.isArray(source.strokes)
    ? source.strokes
        .map((stroke) => ({
          id: String(stroke?.id || uid()),
          color: String(stroke?.color || WHITEBOARD_COLORS[0]),
          width: Number(stroke?.width || 4),
          points: Array.isArray(stroke?.points)
            ? stroke.points
                .map((point) => ({
                  x: Number(point?.x || 0),
                  y: Number(point?.y || 0)
                }))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            : []
        }))
        .filter((stroke) => stroke.points.length > 1)
    : [];
  return { strokes };
};

const pathFromPoints = (points = []) => {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const controlX = (prev.x + point.x) / 2;
    const controlY = (prev.y + point.y) / 2;
    return `${acc} Q ${prev.x} ${prev.y} ${controlX} ${controlY}`;
  }, "");
};

const BoardStatus = memo(function BoardStatus({ loaded, error, label, detail = "" }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-sand-600">
      <div className="flex items-center gap-2">
        {loaded ? <Palette size={14} /> : <Loader2 size={14} className="animate-spin" />}
        <span className="uppercase tracking-[0.25em]">{label}</span>
        {detail ? <span className="text-sand-400">{detail}</span> : null}
        {error ? <span className="text-rose-600">{error}</span> : null}
      </div>
    </div>
  );
});

const MindMapNode = memo(function MindMapNode({ id, data, selected }) {
  return (
    <div
      className={`min-w-[190px] rounded-2xl border px-3 py-3 shadow-[0_12px_28px_rgba(31,41,55,0.12)] ${
        selected ? "border-sky-300 bg-sky-50" : "border-sand-200 bg-white"
      }`}
    >
      <input
        value={data.label}
        onChange={(event) => data.onChangeLabel(id, event.target.value)}
        className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-sand-900 outline-none"
        placeholder="Thema"
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => data.onAddChild(id)}
          className="rounded-xl border border-sand-200 bg-sand-50 px-2.5 py-1 text-[11px] text-sand-700 hover:bg-sand-100"
        >
          Unterpunkt
        </button>
        {id !== "root" ? (
          <button
            type="button"
            onClick={() => data.onDelete(id)}
            className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-100"
          >
            Entfernen
          </button>
        ) : null}
      </div>
    </div>
  );
});

function PinboardBoard() {
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
        const data = await api.notes.list();
        applyRemoteNotes(Array.isArray(data?.notes) ? data.notes : [], force);
        setError("");
      } catch (loadError) {
        setError("Pinboard konnte nicht synchronisiert werden.");
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
    if (saveTimersRef.current[id]) window.clearTimeout(saveTimersRef.current[id]);
    const flushSave = async () => {
      delete saveTimersRef.current[id];
      if (creatingNotesRef.current.has(id)) {
        saveTimersRef.current[id] = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS);
        return;
      }
      try {
        const queuedPatch = pendingPatchesRef.current[id] || {};
        const saved = await api.notes.update(id, queuedPatch);
        if (saveSequenceRef.current[id] !== sequence) return;
        delete pendingPatchesRef.current[id];
        dirtyNotesRef.current.delete(id);
        setNotes((current) => current.map((note) => (note.id === id ? { ...note, ...normalizeNote(saved) } : note)));
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
      const saved = await api.notes.create(draft);
      creatingNotesRef.current.delete(draft.id);
      const hasPendingSave = Boolean(saveTimersRef.current[draft.id]);
      if (!hasPendingSave) dirtyNotesRef.current.delete(draft.id);
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
      await api.notes.remove(id);
      setError("");
    } catch (removeError) {
      setError("Sticky Note konnte nicht gelöscht werden.");
      deletedNotesRef.current.delete(id);
      loadNotes(true);
    }
  };

  const clearBoard = async () => {
    if (!window.confirm("Pinboard leeren?")) return;
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
      await api.notes.clear();
      setSaveState("saved");
      setSavedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
      setError("");
    } catch (clearError) {
      setError("Pinboard konnte nicht geleert werden.");
      loadNotes(true);
    }
  };

  const startDrag = (note, event) => {
    if (note.locked) return;
    const board = boardRef.current;
    if (!board) return;
    const card = event.currentTarget.closest("[data-note-card]");
    const noteWidth = card?.offsetWidth || PINBOARD_NOTE_WIDTH;
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
    const width = clamp(resize.originWidth + (event.clientX - resize.startX) / resize.boardScale, NOTE_MIN_WIDTH, resize.maxWidth);
    const height = clamp(resize.originHeight + (event.clientY - resize.startY) / resize.boardScale, NOTE_MIN_HEIGHT, resize.maxHeight);
    updateNote(resize.id, { width, height });
  };

  const endResize = (event) => {
    if (!resizeRef.current || resizeRef.current.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const changeBoardScale = (direction) => {
    setBoardScale((current) => Number(clamp(current + direction * BOARD_SCALE_STEP, BOARD_SCALE_MIN, BOARD_SCALE_MAX).toFixed(2)));
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
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BoardStatus loaded={loaded} error={error} label="Pinboard" detail={savedAt ? `Gespeichert ${savedAt}` : "Sticky Notes mit Live-Polling"} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-sand-600">
          <span>{saveState === "saving" ? "Speichert..." : notes.length === 1 ? "1 Notizzettel" : `${notes.length} Notizzettel`}</span>
          <button
            type="button"
            onClick={() => loadNotes(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
          >
            <RefreshCw size={14} />
            Laden
          </button>
          {notes.length ? (
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
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-85"
          >
            <Plus size={14} />
            Sticky Note
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-[26px] border border-sand-300 bg-white shadow-soft"
        onPointerDown={(event) => {
          if (!event.target.closest("[data-note-card]")) setPinnedZoomNoteId("");
        }}
      >
        <div
          ref={boardRef}
          className="absolute left-0 top-0 overflow-hidden rounded-[26px] border border-sand-200 bg-[#f8fafc]"
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
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] px-4 py-3 text-sm uppercase tracking-wide text-white shadow-soft hover:opacity-85"
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
                className={`absolute flex flex-col rounded-lg border p-3 transition-[box-shadow,transform] duration-200 ${color.noteClass} ${
                  activeNoteId === note.id ? "ring-2 ring-black/20" : ""
                } ${isZoomed ? "z-30" : activeNoteId === note.id ? "z-20" : "z-10"}`}
                style={{
                  left: `${note.x}%`,
                  top: `${note.y}%`,
                  width: `${note.width}px`,
                  height: `${note.height}px`,
                  transform: `rotate(${note.rotation || 0}deg) scale(${isZoomed ? NOTE_FOCUS_SCALE : draggingNoteId === note.id ? 1.03 : 1})`,
                  transformOrigin: "center",
                  boxShadow:
                    draggingNoteId === note.id
                      ? "0 24px 48px rgba(31,41,55,0.32), 0 8px 16px rgba(31,41,55,0.18)"
                      : activeNoteId === note.id
                      ? "0 18px 34px rgba(31,41,55,0.22), 0 6px 12px rgba(31,41,55,0.12)"
                      : "0 6px 16px rgba(31,41,55,0.12), 0 2px 6px rgba(31,41,55,0.08)"
                }}
              >
                <div
                  className={`mb-2 flex touch-none items-center justify-between gap-2 ${note.locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
                  onPointerDown={(event) => startDrag(note, event)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <button
                    type="button"
                    onClick={() => updateNote(note.id, { locked: !note.locked })}
                    onPointerDown={(event) => event.stopPropagation()}
                    className={`rounded-md border border-black/10 p-1 ${note.locked ? "bg-white/80" : "bg-white/40 hover:bg-white/70"}`}
                    title={note.locked ? "Fixierung lösen" : "Fixieren"}
                  >
                    <Pin size={14} fill={note.locked ? "currentColor" : "none"} />
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-black/45">{note.locked ? "fixiert" : "ziehen"}</span>
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
                  className={`absolute bottom-2 right-2 h-5 w-5 touch-none rounded border border-black/20 bg-white/60 ${
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
        <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-sand-200 bg-white/95 p-2 text-xs text-sand-700 shadow-soft backdrop-blur">
          <button
            type="button"
            onClick={() => changeBoardScale(-1)}
            disabled={boardScale <= BOARD_SCALE_MIN}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sand-200 bg-white hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Pinboard verkleinern"
            title="Pinboard verkleinern"
          >
            <Minus size={15} />
          </button>
          <span className="w-12 text-center font-metrics">{Math.round(boardScale * 100)}%</span>
          <button
            type="button"
            onClick={() => changeBoardScale(1)}
            disabled={boardScale >= BOARD_SCALE_MAX}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sand-200 bg-white hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Pinboard vergrößern"
            title="Pinboard vergrößern"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MindmapBoard({ boardEvent }) {
  const saveTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const lastUpdatedAtRef = useRef(0);
  const selectedNodeIdRef = useRef("root");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("saving");
  }, []);

  const changeNodeLabel = useCallback((id, label) => {
    selectedNodeIdRef.current = id;
    setNodes((current) =>
      current.map((node) =>
        node.id === id
          ? {
              ...node,
              data: { ...node.data, label }
            }
          : node
      )
    );
    markDirty();
  }, [markDirty]);

  const deleteNode = useCallback((nodeId) => {
    if (nodeId === "root") return;
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNodeIdRef.current === nodeId) selectedNodeIdRef.current = "root";
    markDirty();
  }, [markDirty]);

  const addChildNode = useCallback((parentId) => {
    selectedNodeIdRef.current = parentId;
    const nextNode = createMindmapNode("Neuer Unterpunkt", { x: 220, y: 120 }, parentId);
    setNodes((current) => {
      const parent = current.find((node) => node.id === parentId) || current.find((node) => node.id === "root");
      nextNode.position = {
        x: Number(parent?.position?.x || 0) + 220,
        y: Number(parent?.position?.y || 0) + 120
      };
      return current.concat(nextNode);
    });
    setEdges((current) => current.concat(sanitizeMindmapEdge({ id: uid(), source: parentId, target: nextNode.id })));
    markDirty();
  }, [markDirty]);

  const attachNodeHandlers = useCallback(
    (rawNodes) =>
      rawNodes.map((node) => {
        const normalized = sanitizeMindmapNode(node);
        return {
          ...normalized,
          data: {
            ...normalized.data,
            onChangeLabel: changeNodeLabel,
            onAddChild: addChildNode,
            onDelete: deleteNode
          }
        };
      }),
    [addChildNode, changeNodeLabel, deleteNode]
  );

  const replaceDocument = useCallback((content) => {
    const normalized = normalizeMindmapDocument(content);
    setNodes(attachNodeHandlers(normalized.nodes));
    setEdges(normalized.edges.map(sanitizeMindmapEdge));
  }, [attachNodeHandlers]);

  const currentDocument = useCallback(() => ({
    nodes: nodes.map((node) => sanitizeMindmapNode(node)),
    edges: edges.map((edge) => sanitizeMindmapEdge(edge))
  }), [nodes, edges]);

  const persistDocument = useCallback(
    async (nextDocument) => {
      try {
        const saved = await api.documents.save("mindmap", nextDocument);
        lastUpdatedAtRef.current = Number(saved?.updated_at || Date.now());
        dirtyRef.current = false;
        setSaveState("saved");
        setError("");
      } catch (saveError) {
        setSaveState("error");
        setError("Mindmap konnte nicht gespeichert werden.");
      }
    },
    []
  );

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.documents.get("mindmap");
        lastUpdatedAtRef.current = Number(data?.updated_at || 0);
        replaceDocument(data?.content);
        setError("");
      } catch (loadError) {
        replaceDocument(createDefaultMindmapDocument());
        setError("Mindmap konnte nicht geladen werden.");
      } finally {
        setLoaded(true);
      }
    };
    load();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [replaceDocument]);

  useEffect(() => {
    if (!loaded || !dirtyRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistDocument(currentDocument());
      saveTimerRef.current = null;
    }, MINDMAP_SAVE_DEBOUNCE_MS);
  }, [nodes, edges, loaded, currentDocument, persistDocument]);

  useEffect(() => {
    if (!boardEvent || boardEvent.board !== "mindmap" || boardEvent.event !== "state") return;
    const updatedAt = Number(boardEvent.updated_at || 0);
    if (!updatedAt || updatedAt <= lastUpdatedAtRef.current || dirtyRef.current) return;
    lastUpdatedAtRef.current = updatedAt;
    replaceDocument(boardEvent.content);
    setSaveState("saved");
  }, [boardEvent, replaceDocument]);

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((current) => attachNodeHandlers(applyNodeChanges(changes, current).map(sanitizeMindmapNode)));
      markDirty();
    },
    [attachNodeHandlers, markDirty]
  );

  const onEdgesChange = useCallback((changes) => {
    setEdges((current) => applyEdgeChanges(changes, current).map(sanitizeMindmapEdge));
    markDirty();
  }, [markDirty]);

  const onConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: uid(),
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed }
          },
          current
        ).map(sanitizeMindmapEdge)
      );
      markDirty();
    },
    [markDirty]
  );

  const addRootBranch = () => {
    const parentId = selectedNodeIdRef.current || "root";
    const parent = nodes.find((node) => node.id === parentId) || nodes.find((node) => node.id === "root");
    const nextNode = createMindmapNode(
      "Neue Idee",
      {
        x: Number(parent?.position?.x || 0) + 220,
        y: Number(parent?.position?.y || 0) + 140
      },
      parentId
    );
    setNodes((current) => attachNodeHandlers(current.concat(nextNode)));
    setEdges((current) => current.concat(sanitizeMindmapEdge({ id: uid(), source: parentId, target: nextNode.id })));
    markDirty();
  };

  const clearMindmap = async () => {
    if (!window.confirm("Mindmap zurücksetzen?")) return;
    const doc = createDefaultMindmapDocument();
    replaceDocument(doc);
    await persistDocument(doc);
  };

  const refreshMindmap = async () => {
    try {
      const data = await api.documents.get("mindmap");
      lastUpdatedAtRef.current = Number(data?.updated_at || 0);
      dirtyRef.current = false;
      replaceDocument(data?.content);
      setSaveState("saved");
      setError("");
    } catch (loadError) {
      setError("Mindmap konnte nicht geladen werden.");
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BoardStatus loaded={loaded} error={error} label="Mindmap" detail={saveState === "saving" ? "Speichert..." : "Graph mit gemeinsamem Zustand"} />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshMindmap}
            className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
          >
            <RefreshCw size={14} />
            Laden
          </button>
          <button
            type="button"
            onClick={clearMindmap}
            className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
          >
            <Trash2 size={14} />
            Reset
          </button>
          <button
            type="button"
            onClick={addRootBranch}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-85"
          >
            <Plus size={14} />
            Ast anlegen
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-[26px] border border-sand-300 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(241,245,249,0.94))] shadow-soft">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodeClick={(_, node) => {
              selectedNodeIdRef.current = node.id;
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={{ mindmap: MindMapNode }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 2, stroke: "#64748b" }
            }}
          >
            <MiniMap pannable zoomable nodeColor={() => "#dbeafe"} maskColor="rgba(241,245,249,0.6)" />
            <Controls showInteractive={false} />
            <Background gap={20} size={1} color="rgba(148,163,184,0.24)" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

function WhiteboardBoard({ boardEvent, clientId }) {
  const containerRef = useRef(null);
  const boardRef = useRef(null);
  const currentStrokeRef = useRef(null);
  const previewFlushTimerRef = useRef(null);
  const lastSavedAtRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [documentState, setDocumentState] = useState(createEmptyWhiteboardDocument());
  const [toolColor, setToolColor] = useState(WHITEBOARD_COLORS[0]);
  const [toolWidth, setToolWidth] = useState(WHITEBOARD_STROKE_WIDTHS[1]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [remotePreviews, setRemotePreviews] = useState({});

  const loadDocument = useCallback(async () => {
    try {
      const data = await api.documents.get("whiteboard");
      const normalized = normalizeWhiteboardDocument(data?.content);
      lastSavedAtRef.current = Number(data?.updated_at || 0);
      setDocumentState(normalized);
      setError("");
    } catch (loadError) {
      setDocumentState(createEmptyWhiteboardDocument());
      setError("Whiteboard konnte nicht geladen werden.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadDocument();
    return () => {
      if (previewFlushTimerRef.current) window.clearTimeout(previewFlushTimerRef.current);
    };
  }, [loadDocument]);

  useEffect(() => {
    if (!boardEvent || boardEvent.board !== "whiteboard") return;
    if (boardEvent.event === "state") {
      const updatedAt = Number(boardEvent.updated_at || 0);
      if (updatedAt > lastSavedAtRef.current) {
        lastSavedAtRef.current = updatedAt;
        setDocumentState(normalizeWhiteboardDocument(boardEvent.content));
        setSaveState("saved");
      }
      return;
    }
    if (boardEvent.client_id && boardEvent.client_id === clientId) return;
    if (boardEvent.event === "preview") {
      setRemotePreviews((current) => ({
        ...current,
        [boardEvent.client_id || uid()]: boardEvent.payload?.stroke
      }));
    }
    if (boardEvent.event === "preview_clear") {
      setRemotePreviews((current) => {
        const next = { ...current };
        delete next[boardEvent.client_id || ""];
        return next;
      });
    }
  }, [boardEvent, clientId]);

  const persistWhiteboard = useCallback(async (nextDocument) => {
    setSaveState("saving");
    try {
      const saved = await api.documents.save("whiteboard", nextDocument);
      lastSavedAtRef.current = Number(saved?.updated_at || Date.now());
      setSaveState("saved");
      setError("");
    } catch (saveError) {
      setSaveState("error");
      setError("Whiteboard konnte nicht gespeichert werden.");
    }
  }, []);

  const postPreview = useCallback(
    (stroke, eventName = "preview") => {
      api.pushEvent({
        board: "whiteboard",
        event: eventName,
        client_id: clientId,
        payload: eventName === "preview" ? { stroke } : {}
      }).catch(() => {});
    },
    [clientId]
  );

  const getPointFromEvent = (event) => {
    const rect = boardRef.current?.getBoundingClientRect?.();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(event.clientX - rect.left, 0, WHITEBOARD_WIDTH),
      y: clamp(event.clientY - rect.top, 0, WHITEBOARD_HEIGHT)
    };
  };

  const startStroke = (event) => {
    if (event.button !== 0) return;
    const point = getPointFromEvent(event);
    const stroke = {
      id: uid(),
      color: toolColor,
      width: toolWidth,
      points: [point]
    };
    currentStrokeRef.current = stroke;
    setCurrentStroke(stroke);
    setIsDrawing(true);
  };

  const moveStroke = (event) => {
    if (!isDrawing || !currentStrokeRef.current) return;
    const point = getPointFromEvent(event);
    const nextStroke = {
      ...currentStrokeRef.current,
      points: currentStrokeRef.current.points.concat(point)
    };
    currentStrokeRef.current = nextStroke;
    setCurrentStroke(nextStroke);
    if (previewFlushTimerRef.current) return;
    previewFlushTimerRef.current = window.setTimeout(() => {
      previewFlushTimerRef.current = null;
      if (currentStrokeRef.current) postPreview(currentStrokeRef.current, "preview");
    }, 60);
  };

  const endStroke = async () => {
    if (!currentStrokeRef.current) return;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setCurrentStroke(null);
    setIsDrawing(false);
    setRemotePreviews((current) => {
      const next = { ...current };
      delete next[clientId];
      return next;
    });
    const nextDocument = {
      strokes: documentState.strokes.concat(finished)
    };
    setDocumentState(nextDocument);
    postPreview(null, "preview_clear");
    await persistWhiteboard(nextDocument);
  };

  const clearWhiteboard = async () => {
    if (!window.confirm("Whiteboard leeren?")) return;
    const empty = createEmptyWhiteboardDocument();
    setDocumentState(empty);
    setRemotePreviews({});
    await persistWhiteboard(empty);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BoardStatus loaded={loaded} error={error} label="Whiteboard" detail={saveState === "saving" ? "Speichert..." : "SSE-Live-Zeichnen"} />
        <div className="flex flex-wrap items-center gap-2">
          {WHITEBOARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setToolColor(color)}
              className={`h-9 w-9 rounded-full border-2 ${toolColor === color ? "border-sand-900" : "border-white"}`}
              style={{ backgroundColor: color }}
              title="Farbe wählen"
            />
          ))}
          {WHITEBOARD_STROKE_WIDTHS.map((width) => (
            <button
              key={width}
              type="button"
              onClick={() => setToolWidth(width)}
              className={`inline-flex items-center justify-center rounded-xl border px-2 py-1 text-xs ${
                toolWidth === width ? "border-sand-900 bg-sand-900 text-white" : "border-sand-200 bg-white text-sand-700"
              }`}
            >
              {width}px
            </button>
          ))}
          <button
            type="button"
            onClick={loadDocument}
            className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
          >
            <RefreshCw size={14} />
            Laden
          </button>
          <button
            type="button"
            onClick={clearWhiteboard}
            className="inline-flex items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100"
          >
            <Trash2 size={14} />
            Leeren
          </button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto rounded-[26px] border border-sand-300 bg-slate-50 shadow-soft">
        <div className="p-4">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs text-sand-600">
            <PenSquare size={14} />
            Kolleg:innen sehen laufende Striche direkt, bevor sie gespeichert sind.
          </div>
          <svg
            ref={boardRef}
            width={WHITEBOARD_WIDTH}
            height={WHITEBOARD_HEIGHT}
            className="touch-none rounded-[28px] border border-sand-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.11) 1px, transparent 1px)",
              backgroundSize: "32px 32px"
            }}
            onPointerDown={startStroke}
            onPointerMove={moveStroke}
            onPointerUp={endStroke}
            onPointerLeave={endStroke}
            onPointerCancel={endStroke}
          >
            <defs>
              <filter id="whiteboard-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="rgba(15,23,42,0.18)" />
              </filter>
            </defs>
            {documentState.strokes.map((stroke) => (
              <path
                key={stroke.id}
                d={pathFromPoints(stroke.points)}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#whiteboard-shadow)"
              />
            ))}
            {Object.entries(remotePreviews).map(([key, stroke]) =>
              stroke?.points?.length ? (
                <path
                  key={key}
                  d={pathFromPoints(stroke.points)}
                  fill="none"
                  stroke={stroke.color || "#94a3b8"}
                  strokeWidth={Number(stroke.width || 4)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.55"
                  strokeDasharray="8 5"
                />
              ) : null
            )}
            {currentStroke?.points?.length ? (
              <path
                d={pathFromPoints(currentStroke.points)}
                fill="none"
                stroke={currentStroke.color}
                strokeWidth={currentStroke.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function VisionBoardView() {
  const [activeTab, setActiveTab] = useState("pinboard");
  const [boardEvent, setBoardEvent] = useState(null);
  const clientIdRef = useRef(uid());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") return undefined;
    const source = new EventSource("/api/vision_board/events");
    const handleBoardEvent = (event) => {
      try {
        setBoardEvent(JSON.parse(event.data || "{}"));
      } catch (parseError) {
        // ignore malformed event payloads
      }
    };
    source.addEventListener("board", handleBoardEvent);
    return () => {
      source.removeEventListener("board", handleBoardEvent);
      source.close();
    };
  }, []);

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-sand-50 text-sand-900">
      <header className="shrink-0 border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-200)] bg-[var(--nav-active-bg)] text-[var(--nav-accent)]">
              <Palette size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="text-xl font-display text-sand-900">VisionBoard</h1>
            </div>
          </div>
          <div className="inline-flex flex-wrap rounded-2xl border border-sand-200 bg-sand-50 p-1.5">
            {VISION_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    activeTab === tab.id ? "bg-white text-sand-900 shadow-sm" : "text-sand-500 hover:text-sand-700"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-4">
        {activeTab === "pinboard" ? <PinboardBoard /> : null}
        {activeTab === "mindmap" ? <MindmapBoard boardEvent={boardEvent} /> : null}
        {activeTab === "whiteboard" ? <WhiteboardBoard boardEvent={boardEvent} clientId={clientIdRef.current} /> : null}
      </main>
    </div>
  );
}
