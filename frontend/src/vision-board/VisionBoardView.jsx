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
  Download,
  Eraser,
  FilePlus,
  GitBranch,
  Layers,
  Loader2,
  Minus,
  Paintbrush,
  Palette,
  PenSquare,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  SquareStack,
  Target,
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
const WHITEBOARD_COLORS = ["#111827", "#475569", "#0f766e", "#16a34a", "#1d4ed8", "#0284c7", "#b45309", "#dc2626", "#be123c", "#7c3aed"];
const WHITEBOARD_STROKE_WIDTHS = [2, 4, 6, 10, 14, 20];
const WHITEBOARD_ERASER_WIDTHS = [24, 40, 64];
const WHITEBOARD_MIN_POINT_DISTANCE = 3;
const WHITEBOARD_TOOL_TYPES = {
  PEN: "pen",
  ERASER: "eraser"
};
const VISION_TABS = [
  { id: "pinboard", label: "Pinboard", icon: Pin },
  { id: "mindmap", label: "Mindmap", icon: GitBranch },
  { id: "whiteboard", label: "Whiteboard", icon: Paintbrush }
];

const MINDMAP_NODE_TYPES = [
  { id: "goal", label: "Ziel", className: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500" },
  { id: "idea", label: "Idee", className: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-500" },
  { id: "task", label: "Aufgabe", className: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  { id: "risk", label: "Risiko", className: "border-rose-200 bg-rose-50 text-rose-900", dot: "bg-rose-500" },
  { id: "note", label: "Notiz", className: "border-sand-200 bg-white text-sand-900", dot: "bg-sand-400" }
];

const MINDMAP_NODE_STATUSES = [
  { id: "open", label: "Offen" },
  { id: "active", label: "In Arbeit" },
  { id: "decided", label: "Entschieden" },
  { id: "discarded", label: "Verworfen" }
];

const documentLabelFromKey = (key, fallback = "Standard") => {
  const raw = String(key || "").trim();
  const label = raw.includes(":") ? raw.split(":").slice(1).join(":") : raw;
  return label
    ? label.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : fallback;
};

const createDocumentKey = (kind, label) => {
  const slug = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug ? `${kind}:${slug}` : kind;
};

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
    list: (kind) => fetchJson(`${API}/vision_board/documents?kind=${encodeURIComponent(kind)}`),
    get: (key) => fetchJson(`${API}/vision_board/documents/${encodeURIComponent(key)}`),
    save: (key, content) =>
      fetchJson(`${API}/vision_board/documents/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      })
  },
  createTask: (payload) =>
    fetchJson(`${API}/day_tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
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
  data: { label, parentId, kind: "idea", status: "open", details: "", collapsed: false }
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
    parentId: String(node?.data?.parentId || ""),
    kind: MINDMAP_NODE_TYPES.some((item) => item.id === node?.data?.kind) ? node.data.kind : "idea",
    status: MINDMAP_NODE_STATUSES.some((item) => item.id === node?.data?.status) ? node.data.status : "open",
    details: String(node?.data?.details || ""),
    collapsed: Boolean(node?.data?.collapsed)
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
      data: { label: "Vision", parentId: "", kind: "goal", status: "open", details: "", collapsed: false }
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

const normalizeWhiteboardColor = (color) => {
  const value = String(color || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : WHITEBOARD_COLORS[0];
};

const normalizeWhiteboardDocument = (content) => {
  const source = content && typeof content === "object" ? content : {};
  const strokes = Array.isArray(source.strokes)
    ? source.strokes
        .map((stroke) => ({
          id: String(stroke?.id || uid()),
          color: normalizeWhiteboardColor(stroke?.color),
          width: clamp(Number(stroke?.width || 4), 1, 64),
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

const areWhiteboardDocumentsEqual = (left, right) => JSON.stringify(normalizeWhiteboardDocument(left)) === JSON.stringify(normalizeWhiteboardDocument(right));

const getLastPoint = (points = []) => points[points.length - 1] || null;

const shouldAppendWhiteboardPoint = (points = [], point) => {
  const lastPoint = getLastPoint(points);
  if (!lastPoint) return true;
  return Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= WHITEBOARD_MIN_POINT_DISTANCE;
};

const distanceToSegment = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
};

const strokeIntersectsCircle = (stroke, center, radius) => {
  const points = stroke?.points || [];
  if (!points.length) return false;
  if (points.some((point) => Math.hypot(point.x - center.x, point.y - center.y) <= radius)) return true;
  return points.some((point, index) => index > 0 && distanceToSegment(center, points[index - 1], point) <= radius + Number(stroke.width || 1) / 2);
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
  const typeMeta = MINDMAP_NODE_TYPES.find((item) => item.id === data.kind) || MINDMAP_NODE_TYPES[0];
  const statusMeta = MINDMAP_NODE_STATUSES.find((item) => item.id === data.status) || MINDMAP_NODE_STATUSES[0];
  return (
    <div
      className={`min-w-[210px] rounded-xl border px-3 py-3 shadow-[0_10px_24px_rgba(31,41,55,0.12)] ${
        selected ? "ring-2 ring-sky-300" : ""
      } ${typeMeta.className}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]">
          <span className={`h-2 w-2 rounded-full ${typeMeta.dot}`} />
          {typeMeta.label}
        </span>
        <button
          type="button"
          onClick={() => data.onToggleCollapsed(id)}
          className="rounded-md border border-black/10 bg-white/60 px-1.5 py-0.5 text-[10px] hover:bg-white"
          title={data.collapsed ? "Unterpunkte anzeigen" : "Unterpunkte einklappen"}
        >
          {data.childCount ? (data.collapsed ? `+${data.childCount}` : "-") : "0"}
        </button>
      </div>
      <input
        value={data.label}
        onChange={(event) => data.onChangeLabel(id, event.target.value)}
        onFocus={() => data.onSelect(id)}
        className="w-full border-0 bg-transparent p-0 text-sm font-semibold outline-none"
        placeholder="Thema"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={data.status}
          onChange={(event) => data.onChangeNode(id, { status: event.target.value })}
          className="min-w-0 rounded-md border border-black/10 bg-white/70 px-1.5 py-1 text-[10px] outline-none"
          title="Status"
        >
          {MINDMAP_NODE_STATUSES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={data.kind}
          onChange={(event) => data.onChangeNode(id, { kind: event.target.value })}
          className="min-w-0 rounded-md border border-black/10 bg-white/70 px-1.5 py-1 text-[10px] outline-none"
          title="Typ"
        >
          {MINDMAP_NODE_TYPES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => data.onAddChild(id)}
          className="rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-[11px] hover:bg-white"
        >
          Unterpunkt
        </button>
        <button
          type="button"
          onClick={() => data.onSelect(id)}
          className="rounded-lg border border-black/10 bg-white/70 px-2 py-1 text-[11px] hover:bg-white"
        >
          Details
        </button>
        {id !== "root" ? (
          <button
            type="button"
            onClick={() => data.onDelete(id)}
            className="ml-auto rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-100"
          >
            <Trash2 size={12} />
          </button>
        ) : null}
      </div>
      <div className="mt-2 text-[10px] text-black/45">{statusMeta.label}</div>
    </div>
  );
});

function DocumentExplorer({ kind, activeKey, documents, onRefresh, onSelect, onNew }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={activeKey}
        onChange={(event) => onSelect(event.target.value)}
        className="h-9 min-w-[190px] rounded-lg border border-sand-200 bg-white px-2 text-xs text-sand-700 outline-none hover:bg-sand-50"
        title={`${kind} auswählen`}
      >
        {documents.length ? (
          documents.map((document) => (
            <option key={document.key} value={document.key}>
              {document.label || documentLabelFromKey(document.key)}
            </option>
          ))
        ) : (
          <option value={kind}>Standard</option>
        )}
      </select>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
        title="Explorer aktualisieren"
        aria-label="Explorer aktualisieren"
      >
        <SquareStack size={14} />
      </button>
      <button
        type="button"
        onClick={onNew}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] text-white hover:opacity-85"
        title="Neu"
        aria-label="Neu"
      >
        <FilePlus size={14} />
      </button>
    </div>
  );
}

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

const getMindmapChildMap = (nodes = []) =>
  nodes.reduce((acc, node) => {
    const parentId = String(node?.data?.parentId || "");
    if (!acc[parentId]) acc[parentId] = [];
    acc[parentId].push(node);
    return acc;
  }, {});

const getHiddenMindmapNodeIds = (nodes = []) => {
  const childMap = getMindmapChildMap(nodes);
  const hidden = new Set();
  const hideChildren = (nodeId) => {
    (childMap[nodeId] || []).forEach((child) => {
      hidden.add(child.id);
      hideChildren(child.id);
    });
  };
  nodes.forEach((node) => {
    if (node?.data?.collapsed) hideChildren(node.id);
  });
  return hidden;
};

const layoutMindmapNodes = (nodes = []) => {
  const childMap = getMindmapChildMap(nodes);
  const nextPositions = new Map();
  let cursorY = 0;
  const layoutNode = (nodeId, depth = 0) => {
    const children = childMap[nodeId] || [];
    if (!children.length) {
      const y = cursorY * 110;
      cursorY += 1;
      nextPositions.set(nodeId, { x: depth * 280, y });
      return y;
    }
    const childYs = children.map((child) => layoutNode(child.id, depth + 1));
    const y = childYs.reduce((sum, value) => sum + value, 0) / childYs.length;
    nextPositions.set(nodeId, { x: depth * 280, y });
    return y;
  };
  const roots = nodes.filter((node) => !node?.data?.parentId);
  (roots.length ? roots : nodes.slice(0, 1)).forEach((node) => layoutNode(node.id, 0));
  return nodes.map((node) => ({
    ...node,
    position: nextPositions.get(node.id) || node.position
  }));
};

const mindmapToMarkdown = (nodes = []) => {
  const childMap = getMindmapChildMap(nodes);
  const lines = [];
  const visit = (node, depth = 0) => {
    lines.push(`${"  ".repeat(depth)}- ${node?.data?.label || "Thema"}`);
    (childMap[node.id] || []).forEach((child) => visit(child, depth + 1));
  };
  nodes.filter((node) => !node?.data?.parentId).forEach((node) => visit(node));
  return lines.join("\n");
};

function MindmapBoard({ boardEvent }) {
  const saveTimerRef = useRef(null);
  const dirtyRef = useRef(false);
  const lastUpdatedAtRef = useRef(0);
  const selectedNodeIdRef = useRef("root");
  const flowRef = useRef(null);
  const [documentKey, setDocumentKey] = useState("mindmap");
  const [documents, setDocuments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeIdRef.current) || nodes.find((node) => node.id === "root") || null,
    [nodes]
  );

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("saving");
  }, []);

  const selectNode = useCallback((id) => {
    selectedNodeIdRef.current = id || "root";
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === selectedNodeIdRef.current })));
  }, []);

  const changeNode = useCallback((id, patch) => {
    selectedNodeIdRef.current = id;
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...patch } } : node
      )
    );
    markDirty();
  }, [markDirty]);

  const changeNodeLabel = useCallback((id, label) => changeNode(id, { label }), [changeNode]);

  const deleteNode = useCallback((nodeId) => {
    if (nodeId === "root") return;
    const hidden = new Set([nodeId]);
    const childMap = getMindmapChildMap(nodes);
    const collect = (id) => (childMap[id] || []).forEach((child) => {
      hidden.add(child.id);
      collect(child.id);
    });
    collect(nodeId);
    setNodes((current) => current.filter((node) => !hidden.has(node.id)));
    setEdges((current) => current.filter((edge) => !hidden.has(edge.source) && !hidden.has(edge.target)));
    if (hidden.has(selectedNodeIdRef.current)) selectedNodeIdRef.current = "root";
    markDirty();
  }, [markDirty, nodes]);

  const addChildNode = useCallback((parentId, label = "Neuer Unterpunkt") => {
    selectedNodeIdRef.current = parentId;
    const parent = nodes.find((node) => node.id === parentId) || nodes.find((node) => node.id === "root");
    const nextNode = createMindmapNode(
      label,
      {
        x: Number(parent?.position?.x || 0) + 260,
        y: Number(parent?.position?.y || 0) + 120
      },
      parentId
    );
    selectedNodeIdRef.current = nextNode.id;
    setNodes((current) => current.concat(nextNode));
    setEdges((current) => current.concat(sanitizeMindmapEdge({ id: uid(), source: parentId, target: nextNode.id })));
    markDirty();
  }, [markDirty, nodes]);

  const attachNodeHandlers = useCallback(
    (rawNodes) => {
      const childMap = getMindmapChildMap(rawNodes.map(sanitizeMindmapNode));
      return rawNodes.map((node) => {
        const normalized = sanitizeMindmapNode(node);
        return {
          ...normalized,
          selected: normalized.id === selectedNodeIdRef.current,
          data: {
            ...normalized.data,
            childCount: (childMap[normalized.id] || []).length,
            onSelect: selectNode,
            onChangeLabel: changeNodeLabel,
            onChangeNode: changeNode,
            onAddChild: addChildNode,
            onDelete: deleteNode,
            onToggleCollapsed: (id) => changeNode(id, { collapsed: !normalized.data.collapsed })
          }
        };
      });
    },
    [addChildNode, changeNode, changeNodeLabel, deleteNode, selectNode]
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

  const refreshDocuments = useCallback(async () => {
    const data = await api.documents.list("mindmap");
    const list = Array.isArray(data?.documents) ? data.documents : [];
    setDocuments(list.length ? list : [{ key: "mindmap", label: "Standard", updated_at: 0 }]);
  }, []);

  const persistDocument = useCallback(
    async (nextDocument) => {
      try {
        const saved = await api.documents.save(documentKey, nextDocument);
        lastUpdatedAtRef.current = Number(saved?.updated_at || Date.now());
        dirtyRef.current = false;
        setSaveState("saved");
        setError("");
        refreshDocuments().catch(() => {});
      } catch (saveError) {
        setSaveState("error");
        setError("Mindmap konnte nicht gespeichert werden.");
      }
    },
    [documentKey, refreshDocuments]
  );

  const loadMindmap = useCallback(async (key = documentKey) => {
    try {
      const data = await api.documents.get(key);
      lastUpdatedAtRef.current = Number(data?.updated_at || 0);
      dirtyRef.current = false;
      replaceDocument(data?.content);
      setSaveState("saved");
      setError("");
    } catch (loadError) {
      replaceDocument(createDefaultMindmapDocument());
      setError("Mindmap konnte nicht geladen werden.");
    } finally {
      setLoaded(true);
    }
  }, [documentKey, replaceDocument]);

  useEffect(() => {
    refreshDocuments().catch(() => {});
    loadMindmap(documentKey);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [documentKey, loadMindmap, refreshDocuments]);

  useEffect(() => {
    if (!loaded || !dirtyRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistDocument(currentDocument());
      saveTimerRef.current = null;
    }, MINDMAP_SAVE_DEBOUNCE_MS);
  }, [nodes, edges, loaded, currentDocument, persistDocument]);

  useEffect(() => {
    if (!boardEvent || boardEvent.board !== documentKey || boardEvent.event !== "state") return;
    const updatedAt = Number(boardEvent.updated_at || 0);
    if (!updatedAt || updatedAt <= lastUpdatedAtRef.current || dirtyRef.current) return;
    lastUpdatedAtRef.current = updatedAt;
    replaceDocument(boardEvent.content);
    setSaveState("saved");
  }, [boardEvent, documentKey, replaceDocument]);

  const hiddenNodeIds = useMemo(() => getHiddenMindmapNodeIds(nodes), [nodes]);
  const visibleNodes = useMemo(() => attachNodeHandlers(nodes.filter((node) => !hiddenNodeIds.has(node.id))), [attachNodeHandlers, hiddenNodeIds, nodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target)),
    [edges, hiddenNodeIds]
  );

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((current) => {
        const changedIds = new Set(changes.map((change) => change.id).filter(Boolean));
        const visibleCurrent = current.filter((node) => !hiddenNodeIds.has(node.id));
        const changedVisible = applyNodeChanges(changes, visibleCurrent).map(sanitizeMindmapNode);
        const changedById = new Map(changedVisible.map((node) => [node.id, node]));
        return current
          .filter((node) => !changedIds.has(node.id) || changedById.has(node.id))
          .map((node) => changedById.get(node.id) || node);
      });
      markDirty();
    },
    [hiddenNodeIds, markDirty]
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

  const addRootBranch = () => addChildNode(selectedNodeIdRef.current || "root", "Neue Idee");

  const autoLayout = () => {
    setNodes((current) => attachNodeHandlers(layoutMindmapNodes(current.map(sanitizeMindmapNode))));
    markDirty();
    window.setTimeout(() => flowRef.current?.fitView?.({ padding: 0.18 }), 50);
  };

  const createNewMindmap = async () => {
    const label = window.prompt("Name der neuen Mindmap", "Neue Mindmap");
    if (label === null) return;
    const key = createDocumentKey("mindmap", label || `mindmap-${Date.now()}`);
    const doc = createDefaultMindmapDocument();
    await api.documents.save(key, doc);
    await refreshDocuments();
    setDocumentKey(key);
  };

  const clearMindmap = async () => {
    if (!window.confirm("Mindmap zurücksetzen?")) return;
    const doc = createDefaultMindmapDocument();
    replaceDocument(doc);
    await persistDocument(doc);
  };

  const focusSearchResult = () => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return;
    const match = nodes.find((node) => String(node.data?.label || "").toLowerCase().includes(needle));
    if (!match) return;
    selectNode(match.id);
    flowRef.current?.setCenter?.(match.position.x + 110, match.position.y + 60, { zoom: 1.1, duration: 500 });
  };

  const exportMindmap = (format) => {
    const text = format === "markdown" ? mindmapToMarkdown(nodes) : JSON.stringify(currentDocument(), null, 2);
    const blob = new Blob([text], { type: format === "markdown" ? "text/markdown" : "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentKey.replace(/[^a-z0-9_-]+/gi, "-")}.${format === "markdown" ? "md" : "json"}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createTaskFromSelected = async () => {
    if (!selectedNode) return;
    try {
      await api.createTask({
        title: selectedNode.data?.label || "Mindmap-Aufgabe",
        details: selectedNode.data?.details || "",
        status: "todo"
      });
      changeNode(selectedNode.id, { kind: "task", status: "active" });
      setError("");
    } catch (taskError) {
      setError("Aufgabe konnte nicht erstellt werden.");
    }
  };

  const handleKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (event.key === "Tab") {
      event.preventDefault();
      addChildNode(selectedNodeIdRef.current || "root", "Neuer Unterpunkt");
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = nodes.find((node) => node.id === selectedNodeIdRef.current);
      addChildNode(selected?.data?.parentId || "root", "Neue Idee");
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      deleteNode(selectedNodeIdRef.current);
    }
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col outline-none"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => event.currentTarget.focus()}
      tabIndex={-1}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BoardStatus loaded={loaded} error={error} label="Mindmap" detail={saveState === "saving" ? "Speichert..." : documentLabelFromKey(documentKey)} />
        <div className="flex flex-wrap items-center gap-2">
          <DocumentExplorer kind="mindmap" activeKey={documentKey} documents={documents} onRefresh={refreshDocuments} onSelect={setDocumentKey} onNew={createNewMindmap} />
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") focusSearchResult();
              }}
              placeholder="Suchen"
              className="h-9 w-36 rounded-lg border border-sand-200 bg-white px-2 pr-8 text-xs text-sand-700 outline-none"
            />
            <button type="button" onClick={focusSearchResult} className="absolute right-1 top-1 rounded-md p-1 text-sand-500 hover:bg-sand-100" title="Fokus">
              <Search size={14} />
            </button>
          </div>
          <button type="button" onClick={autoLayout} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100" title="Auto-Layout">
            <Layers size={14} />
          </button>
          <button type="button" onClick={() => exportMindmap("markdown")} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100" title="Markdown exportieren">
            <Download size={14} />
          </button>
          <button type="button" onClick={clearMindmap} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100" title="Reset">
            <Trash2 size={14} />
          </button>
          <button type="button" onClick={addRootBranch} className="inline-flex items-center gap-2 rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-85">
            <Plus size={14} />
            Ast
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-0 overflow-hidden rounded-[18px] border border-sand-300 bg-white shadow-soft">
          <ReactFlowProvider>
            <ReactFlow
              nodes={visibleNodes}
              edges={visibleEdges}
              onInit={(instance) => {
                flowRef.current = instance;
              }}
              onNodeClick={(_, node) => selectNode(node.id)}
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
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) =>
                  node.data?.kind === "goal" ? "#10b981"
                  : node.data?.kind === "task" ? "#f59e0b"
                  : node.data?.kind === "risk" ? "#f43f5e"
                  : node.data?.kind === "note" ? "#94a3b8"
                  : "#0ea5e9"
                }
                maskColor="rgba(241,245,249,0.6)"
              />
              <Controls showInteractive={false} />
              <Background gap={20} size={1} color="rgba(148,163,184,0.24)" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
        <aside className="min-h-0 overflow-auto rounded-[18px] border border-sand-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sand-500">
            <Target size={14} />
            Details
          </div>
          {selectedNode ? (
            <div className="space-y-3">
              <label className="block text-[11px] uppercase tracking-[0.16em] text-sand-500">
                Titel
                <input value={selectedNode.data?.label || ""} onChange={(event) => changeNode(selectedNode.id, { label: event.target.value })} className="mt-1 w-full rounded-lg border border-sand-200 px-2 py-1.5 text-sm normal-case tracking-normal text-sand-900 outline-none" />
              </label>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-sand-500">
                Details
                <textarea value={selectedNode.data?.details || ""} onChange={(event) => changeNode(selectedNode.id, { details: event.target.value })} className="mt-1 min-h-[130px] w-full rounded-lg border border-sand-200 px-2 py-1.5 text-sm normal-case tracking-normal text-sand-900 outline-none" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select value={selectedNode.data?.kind || "idea"} onChange={(event) => changeNode(selectedNode.id, { kind: event.target.value })} className="rounded-lg border border-sand-200 px-2 py-1.5 text-xs">
                  {MINDMAP_NODE_TYPES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select value={selectedNode.data?.status || "open"} onChange={(event) => changeNode(selectedNode.id, { status: event.target.value })} className="rounded-lg border border-sand-200 px-2 py-1.5 text-xs">
                  {MINDMAP_NODE_STATUSES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <button type="button" onClick={createTaskFromSelected} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--nav-accent)] bg-[var(--nav-accent)] px-3 py-2 text-xs uppercase tracking-wide text-white hover:opacity-85">
                <Plus size={14} />
                Aufgabe erstellen
              </button>
              <button type="button" onClick={() => exportMindmap("json")} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-100">
                <Download size={14} />
                JSON exportieren
              </button>
            </div>
          ) : (
            <div className="text-xs text-sand-400">Kein Knoten ausgewählt.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function WhiteboardBoard({ boardEvent, clientId }) {
  const containerRef = useRef(null);
  const boardRef = useRef(null);
  const currentStrokeRef = useRef(null);
  const documentStateRef = useRef(createEmptyWhiteboardDocument());
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const eraseChangedRef = useRef(false);
  const previewFlushTimerRef = useRef(null);
  const lastSavedAtRef = useRef(0);
  const [documentKey, setDocumentKey] = useState("whiteboard");
  const [documents, setDocuments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const [documentState, setDocumentState] = useState(createEmptyWhiteboardDocument());
  const [activeTool, setActiveTool] = useState(WHITEBOARD_TOOL_TYPES.PEN);
  const [toolColor, setToolColor] = useState(WHITEBOARD_COLORS[0]);
  const [toolWidth, setToolWidth] = useState(WHITEBOARD_STROKE_WIDTHS[1]);
  const [eraserWidth, setEraserWidth] = useState(WHITEBOARD_ERASER_WIDTHS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [remotePreviews, setRemotePreviews] = useState({});

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState]);

  const refreshDocuments = useCallback(async () => {
    const data = await api.documents.list("whiteboard");
    const list = Array.isArray(data?.documents) ? data.documents : [];
    setDocuments(list.length ? list : [{ key: "whiteboard", label: "Standard", updated_at: 0 }]);
  }, []);

  const loadDocument = useCallback(async (key = documentKey) => {
    try {
      const data = await api.documents.get(key);
      const normalized = normalizeWhiteboardDocument(data?.content);
      lastSavedAtRef.current = Number(data?.updated_at || 0);
      undoStackRef.current = [];
      redoStackRef.current = [];
      documentStateRef.current = normalized;
      setDocumentState(normalized);
      setError("");
    } catch (loadError) {
      const empty = createEmptyWhiteboardDocument();
      documentStateRef.current = empty;
      setDocumentState(empty);
      setError("Whiteboard konnte nicht geladen werden.");
    } finally {
      setLoaded(true);
    }
  }, [documentKey]);

  useEffect(() => {
    refreshDocuments().catch(() => {});
    loadDocument(documentKey);
    return () => {
      if (previewFlushTimerRef.current) window.clearTimeout(previewFlushTimerRef.current);
    };
  }, [documentKey, loadDocument, refreshDocuments]);

  useEffect(() => {
    if (!boardEvent || boardEvent.board !== documentKey) return;
    if (boardEvent.event === "state") {
      const updatedAt = Number(boardEvent.updated_at || 0);
      if (updatedAt > lastSavedAtRef.current) {
        const normalized = normalizeWhiteboardDocument(boardEvent.content);
        lastSavedAtRef.current = updatedAt;
        if (areWhiteboardDocumentsEqual(normalized, documentStateRef.current)) {
          setSaveState("saved");
          return;
        }
        documentStateRef.current = normalized;
        undoStackRef.current = [];
        redoStackRef.current = [];
        setDocumentState(normalized);
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
  }, [boardEvent, clientId, documentKey]);

  const persistWhiteboard = useCallback(async (nextDocument) => {
    setSaveState("saving");
    try {
      const saved = await api.documents.save(documentKey, nextDocument);
      lastSavedAtRef.current = Number(saved?.updated_at || Date.now());
      setSaveState("saved");
      setError("");
      refreshDocuments().catch(() => {});
    } catch (saveError) {
      setSaveState("error");
      setError("Whiteboard konnte nicht gespeichert werden.");
    }
  }, [documentKey, refreshDocuments]);

  const commitDocument = useCallback(
    async (nextDocument, { addHistory = true, persist = true } = {}) => {
      const normalized = normalizeWhiteboardDocument(nextDocument);
      if (addHistory) {
        undoStackRef.current = undoStackRef.current.concat(documentStateRef.current).slice(-40);
        redoStackRef.current = [];
      }
      documentStateRef.current = normalized;
      setDocumentState(normalized);
      if (persist) await persistWhiteboard(normalized);
    },
    [persistWhiteboard]
  );

  const postPreview = useCallback(
    (stroke, eventName = "preview") => {
      api.pushEvent({
        board: documentKey,
        event: eventName,
        client_id: clientId,
        payload: eventName === "preview" ? { stroke } : {}
      }).catch(() => {});
    },
    [clientId, documentKey]
  );

  const createNewWhiteboard = async () => {
    const label = window.prompt("Name des neuen Whiteboards", "Neues Whiteboard");
    if (label === null) return;
    const key = createDocumentKey("whiteboard", label || `whiteboard-${Date.now()}`);
    const empty = createEmptyWhiteboardDocument();
    await api.documents.save(key, empty);
    await refreshDocuments();
    setDocumentKey(key);
  };

  const getPointFromEvent = (event) => {
    const rect = boardRef.current?.getBoundingClientRect?.();
    if (!rect) return { x: 0, y: 0 };
    const scale = Math.min(rect.width / WHITEBOARD_WIDTH, rect.height / WHITEBOARD_HEIGHT);
    const renderedWidth = WHITEBOARD_WIDTH * scale;
    const renderedHeight = WHITEBOARD_HEIGHT * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    return {
      x: clamp((event.clientX - rect.left - offsetX) / scale, 0, WHITEBOARD_WIDTH),
      y: clamp((event.clientY - rect.top - offsetY) / scale, 0, WHITEBOARD_HEIGHT)
    };
  };

  const eraseAtPoint = useCallback(
    (point) => {
      const nextStrokes = documentStateRef.current.strokes.filter((stroke) => !strokeIntersectsCircle(stroke, point, eraserWidth / 2));
      if (nextStrokes.length === documentStateRef.current.strokes.length) return;
      eraseChangedRef.current = true;
      const nextDocument = { strokes: nextStrokes };
      documentStateRef.current = nextDocument;
      setDocumentState(nextDocument);
    },
    [eraserWidth]
  );

  const startStroke = (event) => {
    if (event.button !== 0) return;
    const point = getPointFromEvent(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDrawing(true);
    if (activeTool === WHITEBOARD_TOOL_TYPES.ERASER) {
      undoStackRef.current = undoStackRef.current.concat(documentStateRef.current).slice(-40);
      redoStackRef.current = [];
      eraseChangedRef.current = false;
      eraseAtPoint(point);
      return;
    }
    const stroke = {
      id: uid(),
      color: toolColor,
      width: toolWidth,
      points: [point]
    };
    currentStrokeRef.current = stroke;
    setCurrentStroke(stroke);
  };

  const moveStroke = (event) => {
    if (!isDrawing) return;
    const point = getPointFromEvent(event);
    if (activeTool === WHITEBOARD_TOOL_TYPES.ERASER) {
      eraseAtPoint(point);
      return;
    }
    if (!currentStrokeRef.current || !shouldAppendWhiteboardPoint(currentStrokeRef.current.points, point)) return;
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

  const endStroke = async (event) => {
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    if (activeTool === WHITEBOARD_TOOL_TYPES.ERASER) {
      setIsDrawing(false);
      if (eraseChangedRef.current) {
        eraseChangedRef.current = false;
        await persistWhiteboard(documentStateRef.current);
      } else {
        undoStackRef.current.pop();
      }
      return;
    }
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
    const nextDocument = { strokes: documentStateRef.current.strokes.concat(finished) };
    postPreview(null, "preview_clear");
    await commitDocument(nextDocument);
  };

  const clearWhiteboard = async () => {
    if (!window.confirm("Whiteboard leeren?")) return;
    setRemotePreviews({});
    await commitDocument(createEmptyWhiteboardDocument());
  };

  const undoWhiteboard = async () => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current = redoStackRef.current.concat(documentStateRef.current).slice(-40);
    documentStateRef.current = previous;
    setDocumentState(previous);
    await persistWhiteboard(previous);
  };

  const redoWhiteboard = async () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current = undoStackRef.current.concat(documentStateRef.current).slice(-40);
    documentStateRef.current = next;
    setDocumentState(next);
    await persistWhiteboard(next);
  };

  const exportWhiteboardPng = () => {
    const svg = boardRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", String(WHITEBOARD_WIDTH));
    clone.setAttribute("height", String(WHITEBOARD_HEIGHT));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = WHITEBOARD_WIDTH;
      canvas.height = WHITEBOARD_HEIGHT;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    };
    image.src = url;
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <BoardStatus loaded={loaded} error={error} label="Whiteboard" detail={saveState === "saving" ? "Speichert..." : `${documentLabelFromKey(documentKey)} · ${documentState.strokes.length} Striche`} />
        <div className="flex flex-wrap items-center gap-2">
          <DocumentExplorer kind="whiteboard" activeKey={documentKey} documents={documents} onRefresh={refreshDocuments} onSelect={setDocumentKey} onNew={createNewWhiteboard} />
          <div className="inline-flex rounded-xl border border-sand-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveTool(WHITEBOARD_TOOL_TYPES.PEN)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${activeTool === WHITEBOARD_TOOL_TYPES.PEN ? "bg-sand-900 text-white" : "text-sand-600 hover:bg-sand-100"}`}
              title="Stift"
              aria-label="Stift"
            >
              <PenSquare size={15} />
            </button>
            <button
              type="button"
              onClick={() => setActiveTool(WHITEBOARD_TOOL_TYPES.ERASER)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${activeTool === WHITEBOARD_TOOL_TYPES.ERASER ? "bg-sand-900 text-white" : "text-sand-600 hover:bg-sand-100"}`}
              title="Radiergummi"
              aria-label="Radiergummi"
            >
              <Eraser size={15} />
            </button>
          </div>
          {WHITEBOARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setToolColor(color);
                setActiveTool(WHITEBOARD_TOOL_TYPES.PEN);
              }}
              className={`h-8 w-8 rounded-full border-2 ${toolColor === color && activeTool === WHITEBOARD_TOOL_TYPES.PEN ? "border-sand-900" : "border-white"}`}
              style={{ backgroundColor: color }}
              title="Farbe wählen"
              aria-label="Farbe wählen"
            />
          ))}
          {(activeTool === WHITEBOARD_TOOL_TYPES.ERASER ? WHITEBOARD_ERASER_WIDTHS : WHITEBOARD_STROKE_WIDTHS).map((width) => (
            <button
              key={width}
              type="button"
              onClick={() => (activeTool === WHITEBOARD_TOOL_TYPES.ERASER ? setEraserWidth(width) : setToolWidth(width))}
              className={`inline-flex items-center justify-center rounded-xl border px-2 py-1 text-xs ${
                (activeTool === WHITEBOARD_TOOL_TYPES.ERASER ? eraserWidth : toolWidth) === width ? "border-sand-900 bg-sand-900 text-white" : "border-sand-200 bg-white text-sand-700"
              }`}
            >
              {width}px
            </button>
          ))}
          <button
            type="button"
            onClick={undoWhiteboard}
            disabled={!undoStackRef.current.length || saveState === "saving"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Rückgängig"
            aria-label="Rückgängig"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={redoWhiteboard}
            disabled={!redoStackRef.current.length || saveState === "saving"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100 disabled:cursor-not-allowed disabled:opacity-40"
            title="Wiederholen"
            aria-label="Wiederholen"
          >
            <RotateCw size={14} />
          </button>
          <button
            type="button"
            onClick={() => loadDocument(documentKey)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            title="Laden"
            aria-label="Laden"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={exportWhiteboardPng}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            title="PNG exportieren"
            aria-label="PNG exportieren"
          >
            <Download size={14} />
          </button>
          <button
            type="button"
            onClick={clearWhiteboard}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-100"
            title="Leeren"
            aria-label="Leeren"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden rounded-[18px] border border-sand-300 bg-slate-100 p-3 shadow-soft">
        <div className="h-full min-h-[420px] rounded-[14px] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          <svg
            ref={boardRef}
            viewBox={`0 0 ${WHITEBOARD_WIDTH} ${WHITEBOARD_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-full w-full touch-none rounded-[14px] bg-white"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.11) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.11) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              cursor: activeTool === WHITEBOARD_TOOL_TYPES.ERASER ? "cell" : "crosshair"
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
