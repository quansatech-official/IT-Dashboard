import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  Archive,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  FolderKanban,
  GitBranch,
  Link2,
  ListChecks,
  Mail,
  MessageSquare,
  Plus,
  Receipt,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Trash2,
  TrendingUp,
  UserCircle2,
  Wand2,
  X,
  Zap
} from "lucide-react";

const API = "/api";

const api = {
  listFolders: () => fetch(`${API}/project_folders`).then((r) => r.json()),
  getFolder: (id) => fetch(`${API}/project_folders/${id}`).then((r) => r.json()),
  createFolder: (payload) =>
    fetch(`${API}/project_folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Projektmappe konnte nicht erstellt werden.");
      return data;
    }),
  updateFolder: (id, payload) =>
    fetch(`${API}/project_folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Projektmappe konnte nicht gespeichert werden.");
      return data;
    }),
  deleteFolder: (id) =>
    fetch(`${API}/project_folders/${id}`, { method: "DELETE" }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Projektmappe konnte nicht gelöscht werden.");
      return data;
    }),
  bootstrap: (payload) =>
    fetch(`${API}/project_folders/bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Vorschau konnte nicht erzeugt werden.");
      return data;
    }),
  aiAssist: (payload) =>
    fetch(`${API}/project_folders/ai_assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "KI-Aktion fehlgeschlagen.");
      return data;
    }),
  catalog: () => fetch(`${API}/project_folder_catalog`).then((r) => r.json()),
  updateCatalog: (payload) =>
    fetch(`${API}/project_folder_catalog`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.detail || "Bausteinkatalog konnte nicht gespeichert werden.");
      return data;
    }),
  customers: () => fetch(`${API}/customers`).then((r) => r.json()),
  employees: () => fetch(`${API}/employees`).then((r) => r.json())
};

const inputClass =
  "w-full rounded-xl border border-sand-200 bg-white/80 px-3 py-2 text-sm text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100";
const textareaClass = `${inputClass} min-h-[88px] resize-y`;
const selectClass = `${inputClass} appearance-none`;

const statusMeta = {
  red: { label: "Kritisch", badge: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  yellow: { label: "Achtung", badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  green: { label: "Stabil", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  blue: { label: "Wartet", badge: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500" }
};

const priorityMeta = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  critical: "Kritisch"
};

const creationModes = [
  { key: "empty", label: "Leere Projektmappe", text: "Freier Start ohne Vorlage." },
  { key: "ai", label: "KI-Projektmappe", text: "Aus Freitext Struktur erzeugen." },
  { key: "blocks", label: "Bausteine auswählen", text: "Einzelne Themenblöcke kombinieren." },
  { key: "template", label: "Vorlage verwenden", text: "Fertige Sammlung mehrerer Bausteine." }
];

const projectFolderTagOptions = {
  intern: { label: "Intern", className: "border-slate-200 bg-slate-100 text-slate-700" },
  kundenprojekt: { label: "Kundenprojekt", className: "border-sky-200 bg-sky-50 text-sky-700" },
  wartung: { label: "Wartung", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  vorverkauf: { label: "Vorverkauf", className: "border-amber-200 bg-amber-50 text-amber-700" },
  sonstiges: { label: "Sonstiges", className: "border-violet-200 bg-violet-50 text-violet-700" }
};
const projectFolderTagOrder = ["kundenprojekt", "intern", "wartung", "vorverkauf", "sonstiges"];
const getProjectFolderTagMeta = (value) => {
  const key = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return projectFolderTagOptions[key] || { label: "Ohne Kennzeichen", className: "border-sand-200 bg-sand-50 text-sand-600" };
};

const aiActions = [
  { key: "checklist", label: "Checkliste", icon: CheckSquare },
  { key: "risks", label: "Risiken", icon: ShieldAlert },
  { key: "questions", label: "Kundenfragen", icon: MessageSquare },
  { key: "tasks", label: "Aufgaben", icon: ListChecks },
  { key: "gantt", label: "Gantt", icon: GitBranch },
  { key: "summary", label: "Projektstand", icon: FileText },
  { key: "customer_mail", label: "Kundenmail", icon: Mail },
  { key: "offer_basis", label: "Angebotsgrundlage", icon: FolderKanban },
  { key: "handover", label: "Interne Übergabe", icon: Clock3 }
];

const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const blankStream = (owner = "") => ({
  id: uid(),
  title: "Neuer Arbeitsstrang",
  block_key: "",
  status: "yellow",
  marker: "",
  priority: "medium",
  owner,
  progress: 0,
  short_status: "",
  facts: [],
  open_points: [],
  recommendation: "",
  customer_decision: "",
  next_step: "",
  tasks: [],
  task_links: [],
  checklists: [],
  risks: [],
  blockers: [],
  decisions: [],
  notes: [],
  files: [],
  gantt_phases: [],
  offer_positions: [],
  comments: [],
  activities: []
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const formatDateTime = (value) => {
  const date = new Date(Number(value || 0));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const parseDateInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDateLabel = (value) => {
  const date = parseDateInput(value);
  if (!date) return "";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit"
  });
};

const formatAxisDateLabel = (date, withMonth = false) =>
  date.toLocaleDateString("de-DE", withMonth ? { day: "2-digit", month: "2-digit" } : { day: "2-digit" });

const formatCurrency = (value) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
    Number(value || 0)
  );

const parseMoneyValue = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value || "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoneyInput = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(parseMoneyValue(raw));
};

const getEffectivePrice = (item) => {
  const custom = parseMoneyValue(item?.custom_value);
  if (custom > 0) return custom;
  return parseMoneyValue(item?.rule_value || item?.price);
};

const getEffectiveCost = (item) => parseMoneyValue(item?.cost_value || item?.purchase_price || item?.cost_price);

const getItemQuantity = (item) => {
  const quantity = parseMoneyValue(item?.quantity);
  return quantity > 0 ? quantity : 1;
};

const normalizeProjectMaterialStatus = (value) => {
  const status = String(value || "").trim().toLowerCase();
  if (status === "ordered" || status === "received") return status;
  return "open";
};

const getIsoWeek = (date) => {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7));
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
};

const diffDays = (start, end) => Math.round((end.getTime() - start.getTime()) / 86400000);

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isFolderArchived = (folder) => Boolean(folder?.archived || folder?.content?.archive?.is_archived);
const getFolderArchivedAt = (folder) => Number(folder?.archived_at || folder?.content?.archive?.archived_at || 0);
const getFolderInvoices = (folder) => (Array.isArray(folder?.content?.invoices) ? folder.content.invoices : []);
const getInvoiceCandidates = (folder) =>
  (folder?.content?.streams || []).flatMap((stream) =>
    (stream?.tasks || []).map((task) => ({
      id: task.id,
      title: task.title || "Aufgabe",
      status: String(task.status || "open").trim().toLowerCase(),
      streamId: stream.id,
      streamTitle: stream.title || "Baustein",
      suggestedText: String(task.invoice_text || task.title || "Aufgabe").trim(),
      invoicedAt: Number(task?.invoiced_at || 0)
    }))
  );

function Modal({ title, children, onClose, width = "max-w-5xl" }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className={`mx-auto w-full ${width} rounded-[28px] border border-white/60 bg-[#f7fafc] shadow-soft`}>
        <div className="flex items-center justify-between border-b border-sand-200 px-6 py-4">
          <h3 className="font-display text-2xl text-sand-900">{title}</h3>
          <button onClick={onClose} className="rounded-full border border-sand-200 p-2 text-sand-600 hover:bg-white">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, action = null }) {
  return (
    <section className="rounded-[22px] border border-sand-200 bg-white/90 p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-sand-100 p-2 text-sand-600">
            <Icon size={15} />
          </span>
          <h4 className="text-sm font-semibold text-sand-900">{title}</h4>
        </div>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Tag({ children, className = "" }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}>{children}</span>;
}

function StatTile({ label, value, accent = "sand", icon: Icon = null, compact = false }) {
  const accents = {
    sand:    "border-sand-200   bg-white          text-sand-900",
    sky:     "border-sky-200    bg-sky-50         text-sky-800",
    emerald: "border-emerald-200 bg-emerald-50    text-emerald-800",
    amber:   "border-amber-200  bg-amber-50       text-amber-800",
    rose:    "border-rose-200   bg-rose-50        text-rose-800",
  };
  const cls = accents[accent] || accents.sand;
  return (
    <div className={`border ${compact ? "rounded-xl px-3 py-2" : "rounded-2xl p-3"} ${cls}`}>
      <div className="flex items-center justify-between gap-1">
        <div className={`${compact ? "text-[10px] tracking-[0.14em]" : "text-[10px] tracking-[0.18em]"} uppercase opacity-55`}>{label}</div>
        {Icon ? <Icon size={compact ? 12 : 13} className="opacity-35" /> : null}
      </div>
      <div className={`mt-1 break-words font-semibold tabular-nums ${compact ? "text-[15px]" : "text-base sm:text-xl"}`}>{value ?? "—"}</div>
    </div>
  );
}

function AiSparkleButton({ onClick, label = "KI", title = "Mit KI befüllen" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-2 py-1 text-sky-700 hover:bg-sky-100"
    >
      <Sparkles size={14} />
      {label ? <span className="ml-1 text-[11px] font-medium">{label}</span> : null}
    </button>
  );
}

const taskStatusMeta = {
  open: { label: "offen", tone: "border-sand-200 bg-white text-sand-700" },
  waiting_customer: { label: "wartet auf Kunde", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  blocked: { label: "Blockade", tone: "border-rose-200 bg-rose-50 text-rose-700" },
  doing: { label: "läuft", tone: "border-sky-200 bg-sky-50 text-sky-700" },
  done: { label: "fertig", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" }
};
const taskStatusOrder = ["open", "doing", "waiting_customer", "blocked", "done"];
const nextTaskStatus = (currentStatus) => {
  const current = String(currentStatus || "open").trim().toLowerCase();
  const index = taskStatusOrder.indexOf(current);
  return taskStatusOrder[(index >= 0 ? index + 1 : 0) % taskStatusOrder.length];
};
const getTaskAccentClass = (status) => {
  const key = String(status || "open").trim().toLowerCase();
  if (key === "blocked") return "border-l-[3px] border-l-rose-500";
  if (key === "waiting_customer") return "border-l-[3px] border-l-amber-400";
  if (key === "doing") return "border-l-[3px] border-l-sky-400";
  if (key === "done") return "border-l-[3px] border-l-emerald-400";
  return "";
};
const getTaskDeadlineMeta = (value) => {
  const date = parseDateInput(value);
  if (!date) return { label: "Ohne Fälligkeit", cornerClass: "", tooltip: "" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = diffDays(today, date);
  if (diff < 0) {
    return {
      label: `Fällig ${formatDateLabel(value)}`,
      cornerClass: "border-t-rose-500",
      tooltip: `Fälligkeit überschritten (${Math.abs(diff)} Tage)`
    };
  }
  if (diff <= 2) {
    return {
      label: `Fällig ${formatDateLabel(value)}`,
      cornerClass: "border-t-amber-400",
      tooltip: `Fällig in ${Math.max(1, diff)} Tagen`
    };
  }
  return {
    label: `Fällig ${formatDateLabel(value)}`,
    cornerClass: "border-t-emerald-500",
    tooltip: `Fällig in ${diff} Tagen`
  };
};

const streamMarkerMeta = {
  feedback: { label: "Rückmeldung", tone: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  blocked: { label: "Blockade", tone: "border-rose-200 bg-rose-50 text-rose-700", dot: "bg-rose-500" }
};

const workflowStatusMeta = {
  open: { label: "offen", tone: "border-sand-200 bg-white text-sand-700" },
  doing: { label: "laufend", tone: "border-sky-200 bg-sky-50 text-sky-700" },
  feedback: { label: "Rückmeldung", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  blocked: { label: "Blockade", tone: "border-rose-200 bg-rose-50 text-rose-700" }
};

const getWorkflowStatus = (stream) => {
  if ((stream?.tasks || []).some((item) => String(item?.status || "").trim().toLowerCase() === "blocked")) return "blocked";
  if ((stream?.tasks || []).some((item) => String(item?.status || "").trim().toLowerCase() === "waiting_customer")) return "feedback";
  if ((stream?.tasks || []).some((item) => String(item?.status || "").trim().toLowerCase() === "doing")) return "doing";
  return "open";
};

const getOpenTaskCount = (stream) =>
  (stream?.tasks || []).filter((item) => String(item?.status || "open").trim().toLowerCase() !== "done").length;

const getTaskDepth = (task) => {
  const depth = Number(task?.depth);
  if (!Number.isFinite(depth)) return 0;
  return Math.max(0, Math.min(2, Math.round(depth)));
};

const getStreamProgress = (stream) => {
  const tasks = Array.isArray(stream?.tasks) ? stream.tasks : [];
  if (tasks.length) {
    const doneCount = tasks.filter((item) => String(item?.status || "open").trim().toLowerCase() === "done").length;
    return Math.max(0, Math.min(100, Math.round((doneCount / tasks.length) * 100)));
  }
  return Math.max(0, Math.min(100, Number(stream?.progress || 0)));
};

const getProjectProgress = (streams) => {
  const list = Array.isArray(streams) ? streams : [];
  const taskCount = list.reduce((sum, stream) => sum + ((Array.isArray(stream?.tasks) ? stream.tasks.length : 0)), 0);
  if (taskCount > 0) {
    const doneCount = list.reduce(
      (sum, stream) =>
        sum +
        (Array.isArray(stream?.tasks) ? stream.tasks.filter((task) => String(task?.status || "open").trim().toLowerCase() === "done").length : 0),
      0
    );
    return Math.max(0, Math.min(100, Math.round((doneCount / taskCount) * 100)));
  }
  if (!list.length) return 0;
  const total = list.reduce((sum, stream) => sum + getStreamProgress(stream), 0);
  return Math.max(0, Math.min(100, Math.round(total / list.length)));
};

const getOpenChecklistItemCount = (stream) =>
  (stream?.checklists || []).reduce(
    (sum, checklist) => sum + (checklist?.items || []).filter((item) => !item?.done).length,
    0
  );

const getPrimaryGap = (stream) => {
  const marker = String(stream?.marker || "").trim().toLowerCase();
  if (marker === "blocked") return "Blockade gemeldet";
  if (marker === "feedback") return "Rückmeldung ausstehend";
  const blocker = (stream?.blockers || []).find((item) => String(item?.title || "").trim());
  if (blocker) return `Blockiert: ${blocker.title}`;
  const openTask = (stream?.tasks || []).find((item) => String(item?.status || "open").trim().toLowerCase() !== "done");
  if (openTask?.title) return `Nächste Aufgabe: ${openTask.title}`;
  const openQuestion = (stream?.open_points || []).find((item) => String(item || "").trim());
  if (openQuestion) return `Offen: ${openQuestion}`;
  const openChecklist = (stream?.checklists || [])
    .flatMap((checklist) => checklist?.items || [])
    .find((item) => !item?.done && String(item?.title || "").trim());
  if (openChecklist?.title) return `Fehlt noch: ${openChecklist.title}`;
  return "Baustein ist rund.";
};

const FLOW_GRID_SIZE = 24;
const snapFlowValue = (value) => Math.round(Number(value || 0) / FLOW_GRID_SIZE) * FLOW_GRID_SIZE;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getFlowPathGeometry = (fromX, fromY, fromWidth, toX, toY) => {
  const startX = fromX + fromWidth;
  const startY = fromY + 34;
  const endX = toX;
  const endY = toY + 34;
  const deltaX = Math.max(60, Math.abs(endX - startX) * 0.45);
  const control1X = startX + deltaX;
  const control2X = endX - deltaX;
  return {
    startX,
    startY,
    endX,
    endY,
    midX: startX + (endX - startX) / 2,
    midY: startY + (endY - startY) / 2,
    path: `M ${startX} ${startY} C ${control1X} ${startY}, ${control2X} ${endY}, ${endX} ${endY}`
  };
};

const getTaskFlowPosition = (task, index = 0) => {
  const x = Number(task?.flow?.x);
  const y = Number(task?.flow?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 24 + column * 180, y: 24 + row * 116 };
};
const getTaskFlowSize = (task) => {
  const size = String(task?.flow?.size || "").trim().toLowerCase();
  if (size === "small" || size === "large") return size;
  return "medium";
};
const getTaskFlowDimensions = (task, expanded = false) => {
  const size = getTaskFlowSize(task);
  const baseWidth = size === "small" ? 148 : size === "large" ? 196 : 168;
  const minWidth = expanded ? 240 : 156;
  const minHeight = expanded ? 156 : 88;
  const rawWidth = Number(task?.flow?.width);
  const rawHeight = Number(task?.flow?.height);
  return {
    width: Math.max(minWidth, Number.isFinite(rawWidth) ? rawWidth : expanded ? 240 : baseWidth),
    height: Math.max(minHeight, Number.isFinite(rawHeight) ? rawHeight : expanded ? 172 : 96)
  };
};
const flowStreamTones = [
  { shell: "border-sky-200 bg-sky-50/70", header: "bg-sky-100/90", tag: "border-sky-200 bg-sky-50 text-sky-700", line: "rgba(14,165,233,0.45)" },
  { shell: "border-emerald-200 bg-emerald-50/70", header: "bg-emerald-100/90", tag: "border-emerald-200 bg-emerald-50 text-emerald-700", line: "rgba(16,185,129,0.45)" },
  { shell: "border-amber-200 bg-amber-50/70", header: "bg-amber-100/90", tag: "border-amber-200 bg-amber-50 text-amber-700", line: "rgba(245,158,11,0.45)" },
  { shell: "border-rose-200 bg-rose-50/70", header: "bg-rose-100/90", tag: "border-rose-200 bg-rose-50 text-rose-700", line: "rgba(244,63,94,0.45)" },
  { shell: "border-violet-200 bg-violet-50/70", header: "bg-violet-100/90", tag: "border-violet-200 bg-violet-50 text-violet-700", line: "rgba(139,92,246,0.45)" },
  { shell: "border-cyan-200 bg-cyan-50/70", header: "bg-cyan-100/90", tag: "border-cyan-200 bg-cyan-50 text-cyan-700", line: "rgba(6,182,212,0.45)" }
];
const getFlowStreamTone = (index = 0) => flowStreamTones[index % flowStreamTones.length];
const flowArrangeStatusPriority = {
  blocked: 0,
  waiting_customer: 1,
  doing: 2,
  open: 3,
  done: 4
};
const compareFlowTasks = (left, right) => {
  const leftStatus = String(left?.status || "open").trim().toLowerCase();
  const rightStatus = String(right?.status || "open").trim().toLowerCase();
  const leftPriority = flowArrangeStatusPriority[leftStatus] ?? 9;
  const rightPriority = flowArrangeStatusPriority[rightStatus] ?? 9;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;
  const leftDue = parseDateInput(left?.due_date);
  const rightDue = parseDateInput(right?.due_date);
  if (leftDue && rightDue) return leftDue.getTime() - rightDue.getTime();
  if (leftDue) return -1;
  if (rightDue) return 1;
  return String(left?.title || "").localeCompare(String(right?.title || ""), "de", { sensitivity: "base" });
};
const FLOW_LANE_PADDING_X = 32;
const FLOW_LANE_PADDING_Y = 30;
const FLOW_LANE_COLUMN_GAP = 236;
const FLOW_LANE_ROW_GAP = 138;
const FLOW_LANE_GAP = 36;

const buildFlowAutoLayout = (streams = [], expandedTaskMap = {}) => {
  const taskPositions = new Map();
  const lanes = [];
  let boardWidth = 1080;
  let currentLaneY = FLOW_GRID_SIZE;

  streams.forEach((stream, streamIndex) => {
    const tasks = Array.isArray(stream?.tasks) ? [...stream.tasks] : [];
    if (!tasks.length) {
      lanes.push({
        streamId: stream?.id || `lane_${streamIndex}`,
        streamTitle: stream?.title || "Baustein",
        top: currentLaneY,
        height: 180
      });
      currentLaneY += 180 + FLOW_LANE_GAP;
      return;
    }

    const tone = getFlowStreamTone(streamIndex);
    const sortedTasks = [...tasks].sort(compareFlowTasks);
    const taskIds = new Set(sortedTasks.map((task) => task.id));
    const links = (Array.isArray(stream?.task_links) ? stream.task_links : []).filter(
      (link) => taskIds.has(link.fromTaskId) && taskIds.has(link.toTaskId)
    );
    const indegree = new Map(sortedTasks.map((task) => [task.id, 0]));
    const parents = new Map(sortedTasks.map((task) => [task.id, []]));
    const adjacency = new Map(sortedTasks.map((task) => [task.id, []]));

    links.forEach((link) => {
      indegree.set(link.toTaskId, (indegree.get(link.toTaskId) || 0) + 1);
      parents.set(link.toTaskId, [...(parents.get(link.toTaskId) || []), link.fromTaskId]);
      adjacency.set(link.fromTaskId, [...(adjacency.get(link.fromTaskId) || []), link.toTaskId]);
    });

    const queue = sortedTasks
      .filter((task) => (indegree.get(task.id) || 0) === 0)
      .sort(compareFlowTasks);
    const orderedIds = [];

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      orderedIds.push(current.id);
      (adjacency.get(current.id) || []).forEach((nextId) => {
        const nextInDegree = (indegree.get(nextId) || 0) - 1;
        indegree.set(nextId, nextInDegree);
        if (nextInDegree === 0) {
          const nextTask = sortedTasks.find((task) => task.id === nextId);
          if (nextTask) {
            queue.push(nextTask);
            queue.sort(compareFlowTasks);
          }
        }
      });
    }

    sortedTasks.forEach((task) => {
      if (!orderedIds.includes(task.id)) orderedIds.push(task.id);
    });

    const levelMap = new Map();
    orderedIds.forEach((taskId) => {
      const parentLevels = (parents.get(taskId) || []).map((parentId) => levelMap.get(parentId) || 0);
      levelMap.set(taskId, parentLevels.length ? Math.max(...parentLevels) + 1 : 0);
    });

    const columns = new Map();
    orderedIds.forEach((taskId) => {
      const level = levelMap.get(taskId) || 0;
      const task = sortedTasks.find((entry) => entry.id === taskId);
      if (!task) return;
      columns.set(level, [...(columns.get(level) || []), task]);
    });

    const columnIndices = [...columns.keys()].sort((a, b) => a - b);
    const rowHeights = {};
    columnIndices.forEach((columnIndex) => {
      (columns.get(columnIndex) || []).forEach((task, rowIndex) => {
        const expanded = Boolean(expandedTaskMap[task.id]);
        const dimensions = getTaskFlowDimensions(task, expanded);
        rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] || 0, dimensions.height);
      });
    });

    const rowOffsets = [];
    let runningOffsetY = 0;
    Object.keys(rowHeights)
      .map((value) => Number(value))
      .sort((a, b) => a - b)
      .forEach((rowIndex) => {
        rowOffsets[rowIndex] = runningOffsetY;
        runningOffsetY += Math.max(FLOW_LANE_ROW_GAP, snapFlowValue((rowHeights[rowIndex] || 96) + 36));
      });

    const laneHeight = Math.max(184, runningOffsetY + FLOW_LANE_PADDING_Y * 2);
    const laneTop = currentLaneY;
    let laneWidth = 520;

    columnIndices.forEach((columnIndex) => {
      (columns.get(columnIndex) || []).forEach((task, rowIndex) => {
        const expanded = Boolean(expandedTaskMap[task.id]);
        const dimensions = getTaskFlowDimensions(task, expanded);
        const x = FLOW_LANE_PADDING_X + columnIndex * FLOW_LANE_COLUMN_GAP;
        const y = laneTop + FLOW_LANE_PADDING_Y + (rowOffsets[rowIndex] || 0);
        taskPositions.set(task.id, {
          x: snapFlowValue(x),
          y: snapFlowValue(y)
        });
        laneWidth = Math.max(laneWidth, x + dimensions.width + FLOW_LANE_PADDING_X);
      });
    });

    boardWidth = Math.max(boardWidth, laneWidth + 60);
    lanes.push({
      streamId: stream?.id || `lane_${streamIndex}`,
      streamTitle: stream?.title || "Baustein",
      top: laneTop,
      height: laneHeight,
      width: laneWidth,
      tone
    });
    currentLaneY += laneHeight + FLOW_LANE_GAP;
  });

  return {
    taskPositions,
    lanes,
    width: boardWidth,
    height: Math.max(680, currentLaneY + 24)
  };
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addMonths = (date, amount) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
const toDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const toMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export default function ProjectFoldersView() {
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedStreamId, setSelectedStreamId] = useState("");
  const [catalog, setCatalog] = useState({ blocks: [], templates: [], export_profiles: [] });
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingState, setSavingState] = useState("idle");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    mode: "empty",
    title: "",
    customer: "",
    owner: "",
    project_tag: "kundenprojekt",
    description: "",
    template_key: "",
    block_keys: []
  });
  const [draftFolder, setDraftFolder] = useState(null);
  const [draftSelection, setDraftSelection] = useState({});
  const [createBusy, setCreateBusy] = useState(false);
  const [overviewSection, setOverviewSection] = useState("explorer");
  const [catalogEditorTab, setCatalogEditorTab] = useState("blocks");
  const [catalogSaveBusy, setCatalogSaveBusy] = useState(false);
  const [blockCatalogDraft, setBlockCatalogDraft] = useState([]);
  const [templateCatalogDraft, setTemplateCatalogDraft] = useState([]);
  const [selectedBlockCatalogIndex, setSelectedBlockCatalogIndex] = useState(0);
  const [selectedTemplateCatalogIndex, setSelectedTemplateCatalogIndex] = useState(0);
  const [blockTemplatePrompt, setBlockTemplatePrompt] = useState("");
  const [blockTemplateBusy, setBlockTemplateBusy] = useState(false);
  const [blockTemplatePreview, setBlockTemplatePreview] = useState(null);
  const [newStreamTitle, setNewStreamTitle] = useState("");
  const [streamLayoutMode, setStreamLayoutMode] = useState("cards");
  const [calendarMonthSpan, setCalendarMonthSpan] = useState(1);
  const [calendarAnchor, setCalendarAnchor] = useState("");
  const [taskDrafts, setTaskDrafts] = useState({});
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [flowExpandedTasks, setFlowExpandedTasks] = useState({});
  const [flowLinkSource, setFlowLinkSource] = useState(null);
  const [flowLinkTarget, setFlowLinkTarget] = useState(null);
  const [flowCanvasDragging, setFlowCanvasDragging] = useState(false);
  const [dueDateEditorId, setDueDateEditorId] = useState("");
  const [taskNoteEditorId, setTaskNoteEditorId] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiDialog, setAiDialog] = useState({ open: false, action: "tasks", topic: "", target: null });
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [calculationOpen, setCalculationOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [invoiceDialog, setInvoiceDialog] = useState({
    open: false,
    folderId: null,
    folderTitle: "",
    invoiceTitle: "",
    note: "",
    positions: [],
    improveBusy: false,
    saveBusy: false
  });
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportProfile, setExportProfile] = useState("internal_status");
  const [exportOptions, setExportOptions] = useState({
    include_internal_notes: true,
    include_risks: true,
    include_tasks: true,
    include_checklists: true,
    include_gantt: true,
    include_offer_positions: false,
    customer_view: false,
    internal_view: true
  });
  const exportRef = useRef(null);
  const saveTimerRef = useRef(null);
  const dragStateRef = useRef(null);
  const flowBoardDataRef = useRef(null);

  const employeeNames = useMemo(() => employees.map((item) => item.name).filter(Boolean), [employees]);
  const customerNames = useMemo(() => customers.map((item) => item.name).filter(Boolean), [customers]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listFolders(), api.catalog(), api.customers(), api.employees()])
      .then(([folderRows, catalogPayload, customerRows, employeeRows]) => {
        if (cancelled) return;
        setFolders(Array.isArray(folderRows) ? folderRows : []);
        setCatalog(catalogPayload || { blocks: [], templates: [], export_profiles: [] });
        setCustomers(Array.isArray(customerRows) ? customerRows : []);
        setEmployees(Array.isArray(employeeRows) ? employeeRows : []);
        setLoading(false);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(String(loadError?.message || "Daten konnten nicht geladen werden."));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedFolderId) {
      setActiveFolder(null);
      setSelectedStreamId("");
      return;
    }
    let cancelled = false;
    api
      .getFolder(selectedFolderId)
      .then((folder) => {
        if (cancelled) return;
        setActiveFolder(folder);
        const nextStreamId = folder?.content?.streams?.[0]?.id || "";
        setSelectedStreamId((prev) =>
          folder?.content?.streams?.some((item) => item.id === prev) ? prev : nextStreamId
        );
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(String(loadError?.message || "Projektmappe konnte nicht geladen werden."));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFolderId]);

  useEffect(() => {
    const projectStart = Number(activeFolder?.created_at || 0)
      ? new Date(Number(activeFolder.created_at))
      : new Date();
    setCalendarAnchor(toMonthKey(startOfMonth(projectStart)));
  }, [activeFolder?.id, activeFolder?.created_at]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-due-editor='true']")) return;
      if (target instanceof Element && target.closest("[data-task-note-editor='true']")) return;
      setDueDateEditorId("");
      setTaskNoteEditorId("");
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setSelectedBlockCatalogIndex((current) => Math.min(current, Math.max(0, blockCatalogDraft.length - 1)));
  }, [blockCatalogDraft.length]);

  useEffect(() => {
    setSelectedTemplateCatalogIndex((current) => Math.min(current, Math.max(0, templateCatalogDraft.length - 1)));
  }, [templateCatalogDraft.length]);

  const selectedStream = useMemo(() => {
    if (!activeFolder?.content?.streams?.length) return null;
    return (
      activeFolder.content.streams.find((item) => item.id === selectedStreamId) ||
      activeFolder.content.streams[0] ||
      null
    );
  }, [activeFolder, selectedStreamId]);

  const activeStreams = activeFolder?.content?.streams || [];
  const activeProgress = useMemo(() => getProjectProgress(activeStreams), [activeStreams]);
  const activeSummary = activeFolder?.summary
    ? { ...activeFolder.summary, progress: activeProgress }
    : { stream_count: 0, progress: activeProgress, open_task_count: 0, risk_count: 0 };
  const globalActivities = activeFolder?.content?.activities || [];
  const projectDeadlineRaw = String(activeFolder?.content?.overview?.project_deadline || "").trim();
  const projectDeadline = parseDateInput(projectDeadlineRaw);
  const blockerCount = useMemo(
    () => activeStreams.reduce((sum, stream) => sum + (stream?.blockers?.length || 0), 0),
    [activeStreams]
  );
  const feedbackCount = useMemo(
    () => activeStreams.filter((stream) => getWorkflowStatus(stream) === "feedback").length,
    [activeStreams]
  );
  const blockedCount = useMemo(
    () => activeStreams.filter((stream) => getWorkflowStatus(stream) === "blocked").length,
    [activeStreams]
  );
  const totalTaskCount = useMemo(
    () => activeStreams.reduce((sum, stream) => sum + ((stream?.tasks || []).length || 0), 0),
    [activeStreams]
  );
  const doneTaskCount = useMemo(
    () =>
      activeStreams.reduce(
        (sum, stream) =>
          sum +
          (stream?.tasks || []).filter((task) => String(task?.status || "open").trim().toLowerCase() === "done").length,
        0
      ),
    [activeStreams]
  );
  const checklistOpenCount = activeSummary.open_task_count || 0;
  const taskCompletionLabel = `${doneTaskCount}/${totalTaskCount || 0}`;
  const readinessGapCount = checklistOpenCount + blockerCount + feedbackCount + blockedCount;
  const projectPulseLabel =
    readinessGapCount <= 0 ? "Projekt ist rund" : `${readinessGapCount} Punkte fehlen noch bis rund`;
  const focusTasks = useMemo(
    () =>
      activeStreams
        .flatMap((stream) =>
          (stream?.tasks || [])
            .filter((task) => String(task?.status || "open").trim().toLowerCase() !== "done")
            .map((task) => ({ ...task, stream_title: stream.title || "Baustein" }))
        )
        .slice(0, 8),
    [activeStreams]
  );
  const groupedChecklistTasks = useMemo(
    () =>
      activeStreams
        .map((stream) => {
          const tasks = Array.isArray(stream?.tasks) ? stream.tasks : [];
          return {
            id: stream?.id || uid(),
            title: stream?.title || "Baustein",
            tasks,
            openCount: tasks.filter((task) => String(task?.status || "open").trim().toLowerCase() !== "done").length
          };
        })
        .filter((entry) => entry.tasks.length > 0),
    [activeStreams]
  );
  const activeBlockDraft = blockCatalogDraft[selectedBlockCatalogIndex] || null;
  const activeTemplateDraft = templateCatalogDraft[selectedTemplateCatalogIndex] || null;
  const explorerFolders = useMemo(() => folders.filter((folder) => !isFolderArchived(folder)), [folders]);
  const archivedFolders = useMemo(() => folders.filter((folder) => isFolderArchived(folder)), [folders]);
  const timelineData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lanes = activeStreams.map((stream) => {
      const workflowStatus = getWorkflowStatus(stream);
      const datedTasks = (stream?.tasks || [])
        .filter((task) => parseDateInput(task?.due_date))
        .map((task) => ({
          id: `task_${stream.id}_${task.id}`,
          title: task.title || "Aufgabe",
          status: String(task.status || "open").trim().toLowerCase(),
          date: parseDateInput(task?.due_date),
          dueDate: String(task?.due_date || "")
        }));
      const undatedTasks = (stream?.tasks || [])
        .filter((task) => !parseDateInput(task?.due_date))
        .map((task) => ({
          id: `undated_${stream.id}_${task.id}`,
          title: task.title || "Aufgabe",
          status: String(task.status || "open").trim().toLowerCase()
        }));
      const phases = (stream?.gantt_phases || [])
        .filter((phase) => parseDateInput(phase?.start_date) || parseDateInput(phase?.end_date))
        .map((phase) => ({
          id: `phase_${stream.id}_${phase.id}`,
          title: phase.title || "Phase",
          status: String(phase.status || "geplant").trim().toLowerCase(),
          startDate: parseDateInput(phase?.start_date) || parseDateInput(phase?.end_date),
          endDate: parseDateInput(phase?.end_date) || parseDateInput(phase?.start_date),
        }));
      return {
        streamId: stream.id,
        streamTitle: stream.title || "Baustein",
        workflowStatus,
        datedTasks,
        undatedTasks,
        phases
      };
    });
    const dates = lanes.flatMap((lane) => [
      projectDeadline,
      ...lane.datedTasks.map((item) => item.date),
      ...lane.phases.flatMap((item) => [item.startDate, item.endDate])
    ]).filter(Boolean);
    const sortedDates = dates
      .sort((a, b) => a.getTime() - b.getTime());
    const minDate = sortedDates[0] || today;
    const maxDate = sortedDates[sortedDates.length - 1] || today;
    const rangeStart = new Date(minDate);
    rangeStart.setDate(rangeStart.getDate() - 2);
    const rangeEnd = new Date(maxDate);
    rangeEnd.setDate(rangeEnd.getDate() + 4);
    const totalDays = Math.max(1, diffDays(rangeStart, rangeEnd) + 1);
    const days = Array.from({ length: totalDays }).map((_, index) => {
      const current = new Date(rangeStart);
      current.setDate(current.getDate() + index);
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      const isToday = diffDays(current, today) === 0;
      const isWeekStart = current.getDay() === 1 || index === 0;
      const isMonthStart = current.getDate() === 1 || index === 0;
      return {
        index,
        date: current,
        leftPercent: (index / totalDays) * 100,
        isWeekend,
        isToday,
        isWeekStart,
        isMonthStart
      };
    });
    const monthSegments = [];
    let activeMonth = null;
    days.forEach((day) => {
      const key = `${day.date.getFullYear()}-${day.date.getMonth()}`;
      if (!activeMonth || activeMonth.key !== key) {
        activeMonth = {
          key,
          label: day.date.toLocaleDateString("de-DE", { month: "short", year: "numeric" }),
          startIndex: day.index,
          endIndex: day.index
        };
        monthSegments.push(activeMonth);
      } else {
        activeMonth.endIndex = day.index;
      }
    });
    const tickStep = totalDays <= 14 ? 1 : totalDays <= 35 ? 2 : totalDays <= 70 ? 7 : 14;
    const tickDays = days.filter((day) => day.index === 0 || day.index === totalDays - 1 || day.isMonthStart || day.index % tickStep === 0);
    return {
      today,
      lanes,
      projectDeadline,
      projectDeadlineRaw,
      rangeStart,
      rangeEnd,
      totalDays,
      days,
      monthSegments,
      tickDays
    };
  }, [activeStreams, projectDeadline, projectDeadlineRaw]);
  const calendarViewData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parsedAnchor = calendarAnchor ? parseDateInput(`${calendarAnchor}-01`) : null;
    const anchorDate = startOfMonth(parsedAnchor || today);
    const visibleStart = startOfMonth(anchorDate);
    const visibleEnd = endOfMonth(addMonths(anchorDate, Math.max(1, calendarMonthSpan) - 1));
    const gridStart = new Date(visibleStart);
    gridStart.setDate(gridStart.getDate() - ((gridStart.getDay() + 6) % 7));
    const gridEnd = new Date(visibleEnd);
    gridEnd.setDate(gridEnd.getDate() + (6 - ((gridEnd.getDay() + 6) % 7)));
    const totalDays = diffDays(gridStart, gridEnd) + 1;
    const days = Array.from({ length: totalDays }).map((_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        date,
        key: toDateKey(date),
        inMonth: date >= visibleStart && date <= visibleEnd,
        isToday: diffDays(date, today) === 0,
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      };
    });
    const months = Array.from({ length: Math.max(1, calendarMonthSpan) }).map((_, index) => {
      const monthDate = addMonths(visibleStart, index);
      return {
        key: toMonthKey(monthDate),
        label: monthDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" })
      };
    });
    const allTasks = activeStreams.flatMap((stream) =>
      (stream?.tasks || []).map((task) => ({
        ...task,
        streamId: stream.id,
        streamTitle: stream.title || "Baustein",
        statusKey: String(task?.status || "open").trim().toLowerCase(),
        due: parseDateInput(task?.due_date),
        dueDate: String(task?.due_date || "")
      }))
    );
    const tasksByDay = {};
    allTasks
      .filter((task) => task.due)
      .forEach((task) => {
        const key = toDateKey(task.due);
        tasksByDay[key] = [...(tasksByDay[key] || []), task];
      });
    const undatedTasks = allTasks.filter((task) => !task.due);
    const projectStart = Number(activeFolder?.created_at || 0) ? new Date(Number(activeFolder.created_at)) : today;
    projectStart.setHours(0, 0, 0, 0);
    const datedValues = allTasks.filter((task) => task.due).map((task) => task.due);
    const latestDue = datedValues.length
      ? datedValues.sort((a, b) => a.getTime() - b.getTime())[datedValues.length - 1]
      : null;
    const projectEnd = projectDeadline || latestDue || visibleEnd;
    const rangeLabel = `${projectStart.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} bis ${projectEnd.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`;
    return {
      visibleStart,
      visibleEnd,
      months,
      days,
      tasksByDay,
      undatedTasks,
      rangeLabel
    };
  }, [activeFolder, activeStreams, calendarAnchor, calendarMonthSpan, projectDeadline]);
  const calculationGroups = useMemo(
    () =>
      activeStreams.map((stream) => {
        const tasks = (stream?.tasks || []).map((task) => ({
          ...task,
          kind: "task",
          effectivePrice: getEffectivePrice(task),
          effectiveCost: getEffectiveCost(task),
          lineRevenue: getEffectivePrice(task),
          lineCost: getEffectiveCost(task)
        }));
        return {
          streamId: stream.id,
          streamTitle: stream.title || "Baustein",
          tasks
        };
      }),
    [activeStreams]
  );
  const materialInventory = useMemo(() => {
    const projectMaterials = Array.isArray(activeFolder?.content?.materials) ? activeFolder.content.materials : [];
    if (projectMaterials.length) {
      return projectMaterials.map((item) => {
        const quantity = getItemQuantity(item);
        const effectivePrice = parseMoneyValue(item?.price);
        const effectiveCost = parseMoneyValue(item?.purchase_price);
        return {
          ...item,
          status: normalizeProjectMaterialStatus(item?.status),
          quantityValue: quantity,
          effectivePrice,
          effectiveCost,
          lineRevenue: effectivePrice * quantity,
          lineCost: effectiveCost * quantity
        };
      });
    }
    return activeStreams.flatMap((stream) =>
      (stream?.offer_positions || []).map((item) => {
        const quantity = getItemQuantity(item);
        const effectivePrice = getEffectivePrice(item);
        const effectiveCost = getEffectiveCost(item);
        return {
          ...item,
          legacyStreamId: stream.id,
          legacyStreamTitle: stream.title || "Baustein",
          status: normalizeProjectMaterialStatus(item?.status),
          link: item?.link || item?.url || "",
          quantityValue: quantity,
          effectivePrice,
          effectiveCost,
          lineRevenue: effectivePrice * quantity,
          lineCost: effectiveCost * quantity
        };
      })
    );
  }, [activeFolder, activeStreams]);
  const calculationTotals = useMemo(() => {
    const allRows = [...calculationGroups.flatMap((group) => group.tasks), ...materialInventory];
    const revenue = allRows.reduce((sum, row) => sum + Number(row.lineRevenue ?? row.effectivePrice ?? 0), 0);
    const cost = allRows.reduce((sum, row) => sum + Number(row.lineCost ?? row.effectiveCost ?? 0), 0);
    return {
      revenue,
      cost,
      profit: revenue - cost,
      taskCount: calculationGroups.reduce((sum, group) => sum + group.tasks.length, 0),
      materialCount: materialInventory.length
    };
  }, [calculationGroups, materialInventory]);
  const waitingStreams = useMemo(
    () =>
      activeStreams.filter(
        (stream) =>
          stream?.status === "blue" ||
          getWorkflowStatus(stream) === "feedback" ||
          getWorkflowStatus(stream) === "blocked" ||
          (stream?.blockers || []).length ||
          !(stream?.owner || "").trim()
      ),
    [activeStreams]
  );
  const flowBoardData = useMemo(() => {
    const autoLayout = buildFlowAutoLayout(activeStreams, flowExpandedTasks);
    const streams = activeStreams.map((stream, streamIndex) => ({
      stream,
      streamIndex,
      tone: getFlowStreamTone(streamIndex)
    }));
    const tasks = streams.flatMap(({ stream, streamIndex, tone }) =>
      (Array.isArray(stream.tasks) ? stream.tasks : []).map((task, taskIndex) => {
        const expanded = Boolean(flowExpandedTasks[task.id]);
        const dimensions = getTaskFlowDimensions(task, expanded);
        const rawPosition = autoLayout.taskPositions.get(task.id) || getTaskFlowPosition(task, taskIndex);
        return {
          streamId: stream.id,
          streamIndex,
          streamTitle: stream.title || "Baustein",
          tone,
          task,
          position: {
            x: Math.max(FLOW_GRID_SIZE, snapFlowValue(rawPosition.x)),
            y: Math.max(FLOW_GRID_SIZE, snapFlowValue(rawPosition.y))
          },
          dimensions
        };
      })
    );
    const taskMap = new Map(tasks.map((entry) => [entry.task.id, entry]));
    const links = streams.flatMap(({ stream, tone }) =>
      (Array.isArray(stream.task_links) ? stream.task_links : []).map((link) => ({
        ...link,
        streamId: stream.id,
        tone
      }))
    );
    const bounds = tasks.reduce(
      (acc, entry) => ({
        width: Math.max(acc.width, entry.position.x + entry.dimensions.width + 80),
        height: Math.max(acc.height, entry.position.y + entry.dimensions.height + 80)
      }),
      { width: autoLayout.width, height: autoLayout.height }
    );
    return {
      streams,
      lanes: autoLayout.lanes,
      tasks,
      taskMap,
      links,
      width: bounds.width,
      height: bounds.height
    };
  }, [activeStreams, flowExpandedTasks]);

  flowBoardDataRef.current = flowBoardData;

  const queueSave = (nextFolder) => {
    if (!nextFolder?.id) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSavingState("pending");
    saveTimerRef.current = window.setTimeout(() => {
      setSavingState("saving");
      api
        .updateFolder(nextFolder.id, {
          title: nextFolder.title,
          customer: nextFolder.customer,
          owner: nextFolder.owner,
          status: nextFolder.status,
          priority: nextFolder.priority,
          current_state: nextFolder.current_state,
          next_step: nextFolder.next_step,
          source_mode: nextFolder.source_mode,
          content: nextFolder.content
        })
        .then((saved) => {
          setActiveFolder((prev) => (prev?.id === saved.id ? saved : prev));
          setFolders((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
          setSavingState("saved");
          window.setTimeout(() => setSavingState((state) => (state === "saved" ? "idle" : state)), 1200);
        })
        .catch((saveError) => {
          setSavingState("error");
          setError(String(saveError?.message || "Speichern fehlgeschlagen."));
        });
    }, 500);
  };

  const mutateFolder = (updater) => {
    setActiveFolder((prev) => {
      if (!prev) return prev;
      const next = typeof updater === "function" ? updater(clone(prev)) : prev;
      if (!next) return prev;
      next.updated_at = Date.now();
      setFolders((rows) => [next, ...rows.filter((item) => item.id !== next.id)]);
      queueSave(next);
      return next;
    });
  };

  const mutateSelectedStream = (updater) => {
    mutateFolder((folder) => {
      folder.content = folder.content || { streams: [] };
      folder.content.streams = Array.isArray(folder.content.streams) ? folder.content.streams : [];
      folder.content.streams = folder.content.streams.map((stream) =>
        stream.id === selectedStreamId ? updater(stream) : stream
      );
      return folder;
    });
  };

  const mutateStreamById = (streamId, updater) => {
    mutateFolder((folder) => {
      folder.content = folder.content || { streams: [] };
      folder.content.streams = Array.isArray(folder.content.streams) ? folder.content.streams : [];
      folder.content.streams = folder.content.streams.map((stream) =>
        stream.id === streamId ? updater(stream) : stream
      );
      return folder;
    });
  };

  const addStream = (title = "") => {
    mutateFolder((folder) => {
      const owner = folder.owner || "";
      const stream = blankStream(owner);
      stream.title = String(title || "").trim() || "Neuer Baustein";
      folder.content = folder.content || { streams: [] };
      folder.content.streams = Array.isArray(folder.content.streams) ? folder.content.streams : [];
      folder.content.streams.unshift(stream);
      setSelectedStreamId(stream.id);
      return appendActivity(folder, `Baustein angelegt: ${stream.title}`);
    });
    setNewStreamTitle("");
  };

  const removeStream = (streamId) => {
    const currentStream = activeStreams.find((stream) => stream.id === streamId);
    const label = currentStream?.title || "diesen Baustein";
    if (!window.confirm(`Baustein "${label}" wirklich löschen?`)) return;
    mutateFolder((folder) => {
      folder.content = folder.content || { streams: [] };
      folder.content.streams = Array.isArray(folder.content.streams) ? folder.content.streams : [];
      const removed = folder.content.streams.find((stream) => stream.id === streamId);
      folder.content.streams = folder.content.streams.filter((stream) => stream.id !== streamId);
      if (selectedStreamId === streamId) {
        setSelectedStreamId(folder.content.streams[0]?.id || "");
      }
      return appendActivity(folder, `Baustein gelöscht: ${removed?.title || "Baustein"}`);
    });
  };

  const addTaskToStream = (stream) => {
    const streamId = String(stream?.id || "");
    const title = String(taskDrafts[streamId] || "").trim();
    if (!streamId) return;
    if (!title) return;
    const taskCount = Array.isArray(stream?.tasks) ? stream.tasks.length : 0;
    const defaultPos = getTaskFlowPosition({}, taskCount);
    mutateStreamById(streamId, (current) => ({
      ...current,
      tasks: [
        { id: uid(), title, status: "open", owner: current.owner || "", due_date: "", note: "", depth: 0, flow: defaultPos },
        ...(current.tasks || [])
      ]
    }));
    setTaskDrafts((prev) => ({ ...prev, [streamId]: "" }));
  };

  const handleTaskHierarchyKeyDown = (streamId, taskId, orderedTaskIds, event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const orderedIds = Array.isArray(orderedTaskIds) ? orderedTaskIds : [];
    const currentIndex = orderedIds.indexOf(taskId);
    mutateStreamById(streamId, (current) => {
      const tasks = Array.isArray(current.tasks) ? current.tasks : [];
      const currentTask = tasks.find((item) => item.id === taskId);
      if (!currentTask) return current;
      const currentDepth = getTaskDepth(currentTask);
      let nextDepth = currentDepth;
      if (event.shiftKey) {
        nextDepth = Math.max(0, currentDepth - 1);
      } else if (currentIndex > 0) {
        const previousTask = tasks.find((item) => item.id === orderedIds[currentIndex - 1]);
        nextDepth = Math.min(2, getTaskDepth(previousTask) + 1);
      }
      if (nextDepth === currentDepth) return current;
      return {
        ...current,
        tasks: tasks.map((item) => (item.id === taskId ? { ...item, depth: nextDepth } : item))
      };
    });
  };

  const autoArrangeFlowBoard = () => {
    mutateFolder((folder) => {
      folder.content = folder.content || { streams: [] };
      folder.content.streams = Array.isArray(folder.content.streams) ? folder.content.streams : [];
      const layout = buildFlowAutoLayout(folder.content.streams, flowExpandedTasks);
      folder.content.streams = folder.content.streams.map((stream) => {
        return {
          ...stream,
          tasks: (stream.tasks || []).map((task) => {
            const nextPosition = layout.taskPositions.get(task.id);
            if (!nextPosition) return task;
            return {
              ...task,
              flow: {
                ...(task.flow || {}),
                x: nextPosition.x,
                y: nextPosition.y
              }
            };
          })
        };
      });
      return appendActivity(folder, "Flowchart automatisch angeordnet");
    });
    setFlowLinkSource(null);
    setFlowLinkTarget(null);
  };

  const addTaskLinkToStream = (streamId, fromTaskId, toTaskId) => {
    const fromId = String(fromTaskId || "").trim();
    const toId = String(toTaskId || "").trim();
    if (!streamId || !fromId || !toId || fromId === toId) return;
    mutateStreamById(streamId, (current) => {
      const nextLinks = Array.isArray(current.task_links) ? current.task_links : [];
      if (nextLinks.some((link) => link.fromTaskId === fromId && link.toTaskId === toId)) return current;
      return {
        ...current,
        task_links: [...nextLinks, { id: uid(), fromTaskId: fromId, toTaskId: toId }]
      };
    });
    setFlowLinkSource(null);
    setFlowLinkTarget(null);
  };

  const removeTaskLinkFromStream = (streamId, linkId) => {
    mutateStreamById(streamId, (current) => ({
      ...current,
      task_links: (current.task_links || []).filter((link) => link.id !== linkId)
    }));
  };

  const startTaskDrag = (event, streamId, taskId, task) => {
    event.preventDefault();
    const position = flowBoardDataRef.current?.taskMap?.get(taskId)?.position || getTaskFlowPosition(task, 0);
    const canvas = event.currentTarget.closest("[data-flow-canvas='true']");
    const rect = canvas?.getBoundingClientRect?.();
    dragStateRef.current = {
      mode: "move",
      streamId,
      taskId,
      expanded: Boolean(flowExpandedTasks[taskId]),
      canvas,
      offsetX: event.clientX - (rect?.left || 0) - position.x + (canvas?.scrollLeft || 0),
      offsetY: event.clientY - (rect?.top || 0) - position.y + (canvas?.scrollTop || 0)
    };
  };

  const startFlowCanvasPan = (event) => {
    if (event.target !== event.currentTarget) return;
    const canvas = event.currentTarget;
    dragStateRef.current = {
      mode: "pan",
      canvas,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: canvas.scrollLeft,
      startScrollTop: canvas.scrollTop
    };
    setFlowCanvasDragging(true);
  };

  const startTaskResize = (event, streamId, taskId, task, expanded = false) => {
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest("[data-flow-canvas='true']");
    const dimensions = getTaskFlowDimensions(task, expanded);
    dragStateRef.current = {
      mode: "resize",
      streamId,
      taskId,
      canvas,
      expanded,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height
    };
  };

  useEffect(() => {
    const handleMove = (event) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const rect = drag.canvas?.getBoundingClientRect?.();
      const scrollLeft = drag.canvas?.scrollLeft || 0;
      const scrollTop = drag.canvas?.scrollTop || 0;
      if (drag.mode === "pan") {
        if (drag.canvas) {
          drag.canvas.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startClientX);
          drag.canvas.scrollTop = drag.startScrollTop - (event.clientY - drag.startClientY);
        }
        return;
      }
      if (drag.mode === "resize") {
        const minWidth = drag.expanded ? 240 : 156;
        const minHeight = drag.expanded ? 156 : 88;
        mutateStreamById(drag.streamId, (current) => ({
          ...current,
          tasks: (current.tasks || []).map((item) =>
            item.id === drag.taskId
              ? {
                  ...item,
                  flow: {
                    ...(item.flow || {}),
                    width: Math.max(minWidth, Math.round(drag.startWidth + (event.clientX - drag.startClientX))),
                    height: Math.max(minHeight, Math.round(drag.startHeight + (event.clientY - drag.startClientY)))
                  }
                }
              : item
          )
        }));
        return;
      }
      mutateStreamById(drag.streamId, (current) => ({
        ...current,
        tasks: (current.tasks || []).map((item) =>
          item.id === drag.taskId
            ? (() => {
                const dimensions = getTaskFlowDimensions(item, drag.expanded);
                const absoluteX = event.clientX - (rect?.left || 0) - drag.offsetX + scrollLeft;
                const absoluteY = event.clientY - (rect?.top || 0) - drag.offsetY + scrollTop;
                const maxX = Math.max(FLOW_GRID_SIZE, (flowBoardDataRef.current?.width || 1080) - dimensions.width - 24);
                const maxY = Math.max(FLOW_GRID_SIZE, (flowBoardDataRef.current?.height || 680) - dimensions.height - 24);
                return {
                  ...item,
                  flow: {
                    ...(item.flow || {}),
                    x: clamp(snapFlowValue(absoluteX), FLOW_GRID_SIZE, maxX),
                    y: clamp(snapFlowValue(absoluteY), FLOW_GRID_SIZE, maxY)
                  }
                };
              })()
            : item
        )
      }));
    };
    const handleUp = () => {
      setFlowCanvasDragging(false);
      dragStateRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const addOfferPositionToStream = (streamId) => {
    if (!streamId) return;
    mutateStreamById(streamId, (current) => ({
      ...current,
      offer_positions: [
        {
          id: uid(),
          title: "Neue Materialposition",
          quantity: "1",
          unit: "Stück",
          billing_cycle: "einmalig",
          rule_value: "",
          custom_value: "",
          cost_value: ""
        },
        ...(current.offer_positions || [])
      ]
    }));
  };

  const addProjectMaterial = () => {
    mutateFolder((folder) => {
      folder.content = folder.content || {};
      folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
      folder.content.materials.unshift({
        id: uid(),
        title: "Neues Material",
        quantity: "1",
        unit: "Stück",
        status: "open",
        link: "",
        price: "",
        purchase_price: ""
      });
      return folder;
    });
  };

  const appendActivity = (folder, text) => {
    folder.content.activities = Array.isArray(folder.content.activities) ? folder.content.activities : [];
    folder.content.activities.unshift({ id: uid(), text, at: Date.now() });
    folder.content.activities = folder.content.activities.slice(0, 30);
    return folder;
  };

  const updateFolderRow = (saved) => {
    setFolders((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
    setActiveFolder((prev) => (prev?.id === saved.id ? saved : prev));
  };

  const loadFolderForAction = async (folderId) => {
    if (activeFolder?.id === folderId) return activeFolder;
    return api.getFolder(folderId);
  };

  const handleArchiveFolder = async (folderId, archived) => {
    try {
      const folder = clone(await loadFolderForAction(folderId));
      folder.content = folder.content || {};
      folder.content.archive = {
        ...(typeof folder.content.archive === "object" && folder.content.archive ? folder.content.archive : {}),
        is_archived: archived,
        archived_at: archived ? Date.now() : 0
      };
      appendActivity(folder, archived ? "Projektmappe archiviert" : "Projektmappe reaktiviert");
      const saved = await api.updateFolder(folderId, {
        title: folder.title,
        customer: folder.customer,
        owner: folder.owner,
        status: folder.status,
        priority: folder.priority,
        current_state: folder.current_state,
        next_step: folder.next_step,
        source_mode: folder.source_mode,
        content: folder.content
      });
      updateFolderRow(saved);
      if (selectedFolderId === folderId && archived) {
        setSelectedFolderId(null);
      }
    } catch (archiveError) {
      setError(String(archiveError?.message || "Archiv-Status konnte nicht geändert werden."));
    }
  };

  const openInvoiceModal = async (folderId) => {
    try {
      const folder = await loadFolderForAction(folderId);
      const candidates = getInvoiceCandidates(folder);
      const preferredIds = candidates.filter((item) => item.status === "done" && !item.invoicedAt).map((item) => item.id);
      const fallbackIds = candidates.filter((item) => !item.invoicedAt).map((item) => item.id);
      const selectedIds = new Set((preferredIds.length ? preferredIds : fallbackIds).slice(0, 12));
      setInvoiceDialog({
        open: true,
        folderId,
        folderTitle: folder.title || "Projektmappe",
        invoiceTitle: `Rechnungsentwurf ${folder.title || "Projektmappe"}`,
        note: "",
        improveBusy: false,
        saveBusy: false,
        positions: candidates.map((item) => ({
          taskId: item.id,
          streamId: item.streamId,
          streamTitle: item.streamTitle,
          taskTitle: item.title,
          status: item.status,
          invoicedAt: item.invoicedAt,
          selected: selectedIds.has(item.id),
          text: item.suggestedText
        }))
      });
    } catch (invoiceError) {
      setError(String(invoiceError?.message || "Fakturierungsdialog konnte nicht geöffnet werden."));
    }
  };

  const improveInvoiceTexts = async () => {
    const selectedPositions = invoiceDialog.positions.filter((item) => item.selected);
    if (!selectedPositions.length) return;
    setInvoiceDialog((prev) => ({ ...prev, improveBusy: true }));
    try {
      const folder = await loadFolderForAction(invoiceDialog.folderId);
      const topic = selectedPositions.map((item) => item.text || item.taskTitle).join("; ");
      const result = await api.aiAssist({
        action: "invoice_positions",
        topic,
        project_folder: folder,
        stream_id: "",
        context: "Verbessere kurze, kundentaugliche Rechnungspositionen."
      });
      const improved = Array.isArray(result?.items) ? result.items : [];
      setInvoiceDialog((prev) => ({
        ...prev,
        improveBusy: false,
        positions: prev.positions.map((item, index) => {
          const selectedIndex = selectedPositions.findIndex((entry) => entry.taskId === item.taskId);
          return selectedIndex >= 0 && improved[selectedIndex]
            ? { ...item, text: String(improved[selectedIndex] || item.text) }
            : item;
        })
      }));
    } catch (improveError) {
      setInvoiceDialog((prev) => ({ ...prev, improveBusy: false }));
      setError(String(improveError?.message || "KI-Textverbesserung fehlgeschlagen."));
    }
  };

  const saveInvoiceDraft = async () => {
    const selectedPositions = invoiceDialog.positions.filter((item) => item.selected);
    if (!invoiceDialog.folderId || !selectedPositions.length) return;
    setInvoiceDialog((prev) => ({ ...prev, saveBusy: true }));
    try {
      const folder = clone(await loadFolderForAction(invoiceDialog.folderId));
      folder.content = folder.content || {};
      folder.content.invoices = Array.isArray(folder.content.invoices) ? folder.content.invoices : [];
      const invoiceId = uid();
      const savedAt = Date.now();
      folder.content.invoices.unshift({
        id: invoiceId,
        title: String(invoiceDialog.invoiceTitle || "").trim() || `Rechnungsentwurf ${folder.title || "Projektmappe"}`,
        note: String(invoiceDialog.note || "").trim(),
        created_at: savedAt,
        positions: selectedPositions.map((item) => ({
          task_id: item.taskId,
          stream_id: item.streamId,
          stream_title: item.streamTitle,
          task_title: item.taskTitle,
          text: String(item.text || item.taskTitle).trim() || item.taskTitle
        }))
      });
      folder.content.streams = (folder.content.streams || []).map((stream) => ({
        ...stream,
        tasks: (stream.tasks || []).map((task) => {
          const position = selectedPositions.find((item) => item.taskId === task.id);
          return position
            ? {
                ...task,
                invoice_text: String(position.text || task.title || "").trim(),
                invoiced_at: savedAt,
                invoice_run_id: invoiceId
              }
            : task;
        })
      }));
      appendActivity(folder, `Rechnungsentwurf gespeichert: ${invoiceDialog.invoiceTitle || "Fakturierung"}`);
      const saved = await api.updateFolder(folder.id, {
        title: folder.title,
        customer: folder.customer,
        owner: folder.owner,
        status: folder.status,
        priority: folder.priority,
        current_state: folder.current_state,
        next_step: folder.next_step,
        source_mode: folder.source_mode,
        content: folder.content
      });
      updateFolderRow(saved);
      setInvoiceDialog({
        open: false,
        folderId: null,
        folderTitle: "",
        invoiceTitle: "",
        note: "",
        positions: [],
        improveBusy: false,
        saveBusy: false
      });
    } catch (saveError) {
      setInvoiceDialog((prev) => ({ ...prev, saveBusy: false }));
      setError(String(saveError?.message || "Rechnungsentwurf konnte nicht gespeichert werden."));
    }
  };

  const handleBootstrap = async () => {
    setCreateBusy(true);
    setError("");
    try {
      const draft = await api.bootstrap(createForm);
      setDraftFolder(draft);
      const streamSelection = {};
      (draft?.content?.streams || []).forEach((stream) => {
        streamSelection[stream.id] = true;
      });
      setDraftSelection(streamSelection);
    } catch (bootstrapError) {
      setError(String(bootstrapError?.message || "Vorschau fehlgeschlagen."));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleBlockTemplatePreview = async () => {
    const prompt = String(blockTemplatePrompt || "").trim();
    if (!prompt) return;
    setBlockTemplateBusy(true);
    setError("");
    try {
      const draft = await api.bootstrap({
        mode: "ai",
        title: "Baustein-Vorschau",
        customer: "",
        owner: "",
        description: prompt,
        template_key: "",
        block_keys: []
      });
      setBlockTemplatePreview(draft);
    } catch (bootstrapError) {
      setError(String(bootstrapError?.message || "Baustein-Vorschau fehlgeschlagen."));
    } finally {
      setBlockTemplateBusy(false);
    }
  };

  const openBlockTemplatePanel = () => {
    setCatalogEditorTab("blocks");
    setBlockCatalogDraft(
      (catalog.blocks || []).map((block) => ({
        ...clone(block),
        tasksText: (block.tasks || []).join("\n"),
        checklistText: (block.checklist || []).join("\n"),
        risksText: (block.risks || []).join("\n"),
        questionsText: (block.questions || []).join("\n"),
        ganttText: (block.gantt || []).join("\n"),
        positionsText: (block.positions || []).join("\n"),
      }))
    );
    setTemplateCatalogDraft((catalog.templates || []).map((template) => ({ ...clone(template) })));
    setSelectedBlockCatalogIndex(0);
    setSelectedTemplateCatalogIndex(0);
    setBlockTemplatePreview(null);
    setOverviewSection("blocks");
  };

  const saveProjectCatalog = async () => {
    setCatalogSaveBusy(true);
    setError("");
    try {
      const saved = await api.updateCatalog({
        blocks: blockCatalogDraft.map((block) => ({
          key: block.key,
          label: block.label,
          summary: block.summary,
          tasks: String(block.tasksText || "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          checklist: String(block.checklistText || "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          risks: String(block.risksText || "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          questions: String(block.questionsText || "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          gantt: String(block.ganttText || "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
          positions: String(block.positionsText || "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        })),
        templates: templateCatalogDraft.map((template) => ({
          key: template.key,
          label: template.label,
          blocks: Array.isArray(template.blocks) ? template.blocks : []
        }))
      });
      setCatalog(saved || { blocks: [], templates: [], export_profiles: [] });
      setBlockCatalogDraft(
        (saved?.blocks || []).map((block) => ({
          ...clone(block),
          tasksText: (block.tasks || []).join("\n"),
          checklistText: (block.checklist || []).join("\n"),
          risksText: (block.risks || []).join("\n"),
          questionsText: (block.questions || []).join("\n"),
          ganttText: (block.gantt || []).join("\n"),
          positionsText: (block.positions || []).join("\n"),
        }))
      );
      setTemplateCatalogDraft((saved?.templates || []).map((template) => ({ ...clone(template) })));
      setSelectedBlockCatalogIndex(0);
      setSelectedTemplateCatalogIndex(0);
    } catch (saveError) {
      setError(String(saveError?.message || "Bausteinpflege konnte nicht gespeichert werden."));
    } finally {
      setCatalogSaveBusy(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!draftFolder) return;
    const payload = clone(draftFolder);
    payload.content.streams = (payload.content.streams || []).filter((stream) => draftSelection[stream.id] !== false);
    setCreateBusy(true);
    try {
      const saved = await api.createFolder(payload);
      setFolders((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
      setSelectedFolderId(saved.id);
      setCreateOpen(false);
      setDraftFolder(null);
      setDraftSelection({});
      setCreateForm({
        mode: "empty",
        title: "",
        customer: "",
        owner: "",
        project_tag: "kundenprojekt",
        description: "",
        template_key: "",
        block_keys: []
      });
      setNewStreamTitle("");
    } catch (createError) {
      setError(String(createError?.message || "Erstellen fehlgeschlagen."));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!activeFolder?.id) return;
    if (!window.confirm(`Projektmappe "${activeFolder.title}" löschen?`)) return;
    try {
      await api.deleteFolder(activeFolder.id);
      const nextFolders = folders.filter((item) => item.id !== activeFolder.id);
      setFolders(nextFolders);
      setSelectedFolderId(nextFolders[0]?.id || null);
      setActiveFolder(null);
    } catch (deleteError) {
      setError(String(deleteError?.message || "Löschen fehlgeschlagen."));
    }
  };

  const openAiAssist = (action, topic, target = null) => {
    setAiDialog({ open: true, action, topic: topic || "", target });
    setAiResult(null);
  };

  const triggerAiAction = async () => {
    if (!activeFolder) return;
    setAiBusy(true);
    try {
      const result = await api.aiAssist({
        action: aiDialog.action,
        topic: aiDialog.topic,
        project_folder: activeFolder,
        stream_id: selectedStreamId,
        context: selectedStream?.short_status || activeFolder.current_state || ""
      });
      setAiResult(result);
    } catch (assistError) {
      setError(String(assistError?.message || "KI-Aktion fehlgeschlagen."));
    } finally {
      setAiBusy(false);
    }
  };

  const applyAiResult = () => {
    if (!aiResult || !activeFolder || !selectedStream) return;
    const action = aiDialog.action;
    const target = aiDialog.target || { scope: "stream", field: "next_step" };
    mutateFolder((folder) => {
      folder.content = folder.content || { streams: [] };
      folder.content.overview = folder.content.overview || {};
      folder.content.open_customer_questions = Array.isArray(folder.content.open_customer_questions) ? folder.content.open_customer_questions : [];
      folder.content.last_ai_outputs = Array.isArray(folder.content.last_ai_outputs) ? folder.content.last_ai_outputs : [];
      const stream = folder.content.streams.find((item) => item.id === selectedStreamId);
      if (!stream) return folder;
      if (target.scope === "folder") {
        if (target.field === "next_step") {
          folder.next_step = aiResult.text || folder.next_step;
          folder.content.overview.next_step = aiResult.text || folder.content.overview?.next_step || "";
        } else {
          folder.current_state = aiResult.text || folder.current_state;
          folder.content.overview.current_status = aiResult.text || folder.content.overview?.current_status || "";
        }
      } else if (target.field === "short_status") {
        stream.short_status = aiResult.text || stream.short_status;
      } else if (target.field === "open_points") {
        const nextItems = (aiResult.items || []).map((item) => String(item || "")).filter(Boolean);
        stream.open_points = [...(stream.open_points || []), ...nextItems];
        folder.content.open_customer_questions = [
          ...(folder.content.open_customer_questions || []),
          ...nextItems.map((item) => ({ id: uid(), title: item, kind: "customer_question" }))
        ];
      } else if (target.field === "recommendation") {
        stream.recommendation = aiResult.text || stream.recommendation;
      } else if (target.field === "next_step") {
        stream.next_step = aiResult.text || stream.next_step;
      } else if (target.field === "tasks" || action === "tasks") {
        stream.tasks = [...(stream.tasks || []), ...(aiResult.items || []).map((item) => ({ id: uid(), owner: stream.owner || "", due_date: "", ...item }))];
      } else if (target.field === "checklists" || action === "checklist") {
        stream.checklists.unshift({
          id: uid(),
          title: aiResult.title || "KI-Checkliste",
          items: (aiResult.items || []).map((item) => ({ id: uid(), title: String(item || ""), done: false }))
        });
      } else if (target.field === "risks" || action === "risks") {
        stream.risks = [...(stream.risks || []), ...(aiResult.items || []).map((item) => ({ id: uid(), ...item }))];
      } else if (action === "questions") {
        const nextItems = (aiResult.items || []).map((item) => String(item || "")).filter(Boolean);
        stream.open_points = [...(stream.open_points || []), ...nextItems];
        folder.content.open_customer_questions = [
          ...(folder.content.open_customer_questions || []),
          ...nextItems.map((item) => ({ id: uid(), title: item, kind: "customer_question" }))
        ];
      } else if (action === "gantt") {
        stream.gantt_phases = [
          ...(stream.gantt_phases || []),
          ...(aiResult.items || []).map((item) => ({
            id: uid(),
            start_date: "",
            end_date: "",
            owner: stream.owner || "",
            ...item
          }))
        ];
      } else if (action === "summary") {
        folder.current_state = aiResult.text || folder.current_state;
        folder.content.overview.current_status = aiResult.text || folder.content.overview?.current_status || "";
      } else {
        stream.notes = [...(stream.notes || []), { id: uid(), title: aiResult.title || "KI-Ausgabe", text: aiResult.text || "" }];
      }
      folder.content.last_ai_outputs = [{ id: uid(), title: aiResult.title || "KI-Ausgabe", text: aiResult.text || "" }, ...(folder.content.last_ai_outputs || [])].slice(0, 10);
      return appendActivity(folder, `KI-Aktion übernommen: ${aiResult.title || aiDialog.action}`);
    });
    setAiDialog({ open: false, action: "tasks", topic: "", target: null });
    setAiResult(null);
  };

  const renderMarkdown = () => {
    if (!activeFolder) return "";
    const lines = [
      `# ${activeFolder.title}`,
      "",
      `- Kunde: ${activeFolder.customer || "-"}`,
      `- Status: ${statusMeta[activeFolder.status]?.label || activeFolder.status}`,
      `- Priorität: ${priorityMeta[activeFolder.priority] || activeFolder.priority}`,
      `- Verantwortlich: ${activeFolder.owner || "-"}`,
      `- Aktueller Stand: ${activeFolder.current_state || "-"}`,
      `- Nächster Schritt: ${activeFolder.next_step || "-"}`,
      ""
    ];
    (activeFolder.content?.streams || []).forEach((stream) => {
      lines.push(`## ${stream.title}`, "");
      lines.push(`- Kurzlage: ${stream.short_status || "-"}`);
      lines.push(`- Zuständig: ${stream.owner || "-"}`);
      lines.push(`- Empfehlung: ${stream.recommendation || "-"}`);
      lines.push(`- Kundenentscheidung: ${stream.customer_decision || "-"}`);
      lines.push(`- Nächster Schritt: ${stream.next_step || "-"}`, "");
      if (exportOptions.include_tasks && stream.tasks?.length) {
        lines.push("### Aufgaben");
        stream.tasks.forEach((task) => lines.push(`- [${task.status === "done" ? "x" : " "}] ${task.title}`));
        lines.push("");
      }
      if (exportOptions.include_checklists && stream.checklists?.length) {
        lines.push("### Checklisten");
        stream.checklists.forEach((list) => {
          lines.push(`- ${list.title}`);
          (list.items || []).forEach((item) => lines.push(`  - [${item.done ? "x" : " "}] ${item.title}`));
        });
        lines.push("");
      }
      if (exportOptions.include_risks && stream.risks?.length) {
        lines.push("### Risiken");
        stream.risks.forEach((item) => lines.push(`- ${item.title} (${item.level || "mittel"})`));
        lines.push("");
      }
    });
    return lines.join("\n");
  };

  const renderHtml = () => {
    if (!activeFolder) return "";
    return `
      <html><head><meta charset="utf-8"><title>${escapeHtml(activeFolder.title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #1c2733; }
        h1, h2, h3 { color: #14324d; }
        .card { border: 1px solid #d1dbe6; border-radius: 16px; padding: 16px; margin: 0 0 16px; }
        .muted { color: #5b6b7c; }
      </style></head><body>
      <h1>${escapeHtml(activeFolder.title)}</h1>
      <p class="muted">Kunde: ${escapeHtml(activeFolder.customer)} | Status: ${escapeHtml(statusMeta[activeFolder.status]?.label || activeFolder.status)}</p>
      <p><strong>Aktueller Stand:</strong> ${escapeHtml(activeFolder.current_state || "-")}</p>
      <p><strong>Nächster Schritt:</strong> ${escapeHtml(activeFolder.next_step || "-")}</p>
      ${(activeFolder.content?.streams || [])
        .map(
          (stream) => `
            <div class="card">
              <h2>${escapeHtml(stream.title)}</h2>
              <p><strong>Kurzlage:</strong> ${escapeHtml(stream.short_status || "-")}</p>
              <p><strong>Verantwortlich:</strong> ${escapeHtml(stream.owner || "-")}</p>
              <p><strong>Empfehlung:</strong> ${escapeHtml(stream.recommendation || "-")}</p>
              ${exportOptions.include_tasks ? `<h3>Aufgaben</h3><ul>${(stream.tasks || []).map((task) => `<li>${escapeHtml(task.title)}</li>`).join("")}</ul>` : ""}
              ${exportOptions.include_risks ? `<h3>Risiken</h3><ul>${(stream.risks || []).map((risk) => `<li>${escapeHtml(risk.title)}</li>`).join("")}</ul>` : ""}
            </div>
          `
        )
        .join("")}
      </body></html>
    `;
  };

  const exportProjectPdf = async (baseName) => {
    if (!exportRef.current) return;
    const canvas = await html2canvas(exportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#f4f7fb",
      logging: false
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = pageWidth / canvas.width;
    const imgHeight = canvas.height * ratio;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
    let remaining = imgHeight - pageHeight;
    while (remaining > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, pageWidth, imgHeight);
      remaining -= pageHeight;
    }
    pdf.save(`${baseName}.pdf`);
  };

  const handleExport = async () => {
    if (!activeFolder) return;
    const baseName = `${activeFolder.title || "projektmappe"}`.replace(/[^\w\-]+/g, "_");
    if (exportFormat === "json") {
      downloadBlob(new Blob([JSON.stringify(activeFolder, null, 2)], { type: "application/json" }), `${baseName}.json`);
      return;
    }
    if (exportFormat === "md") {
      downloadBlob(new Blob([renderMarkdown()], { type: "text/markdown;charset=utf-8" }), `${baseName}.md`);
      return;
    }
    if (exportFormat === "html") {
      downloadBlob(new Blob([renderHtml()], { type: "text/html;charset=utf-8" }), `${baseName}.html`);
      return;
    }
    if (exportFormat === "word") {
      downloadBlob(new Blob([renderHtml()], { type: "application/msword" }), `${baseName}.doc`);
      return;
    }
    if (exportFormat === "excel") {
      const rows = [["Arbeitsstrang", "Aufgabe", "Status", "Risiko", "Nächster Schritt"]];
      (activeFolder.content?.streams || []).forEach((stream) => {
        const tasks = stream.tasks?.length ? stream.tasks : [{ title: "", status: "" }];
        tasks.forEach((task, index) => {
          rows.push([
            index === 0 ? stream.title : "",
            task.title || "",
            task.status || "",
            index === 0 ? (stream.risks?.map((risk) => risk.title).join(" | ") || "") : "",
            index === 0 ? (stream.next_step || "") : ""
          ]);
        });
      });
      const tableHtml = `<table>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</table>`;
      downloadBlob(new Blob([tableHtml], { type: "application/vnd.ms-excel" }), `${baseName}.xls`);
      return;
    }
    if (exportFormat === "pdf") {
      await exportProjectPdf(baseName);
    }
  };

  const applyExportProfile = (profileKey) => {
    const profile = (catalog.export_profiles || []).find((item) => item.key === profileKey);
    if (!profile) return;
    setExportProfile(profileKey);
    setExportOptions({
      ...profile.defaults,
      internal_view: !profile.defaults?.customer_view
    });
  };

  if (loading) {
    return <div className="p-8 text-sand-600">Projektmappen werden geladen…</div>;
  }

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            {activeFolder ? (
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                title="Zurück zur Projektmappenübersicht"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sand-200 bg-sand-100 text-sand-700">
                <FolderKanban size={18} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] font-medium text-sand-500">QT Workbench</p>
              <h1 className="truncate text-xl font-display text-sand-900">
                {activeFolder ? (activeFolder.title || "Projektmappe") : "Projektmappen"}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {savingState === "saving" ? (
              <Tag className="border-sky-200 bg-sky-50 text-sky-700">Speichert…</Tag>
            ) : savingState === "saved" ? (
              <Tag className="border-emerald-200 bg-emerald-50 text-emerald-700">Gespeichert</Tag>
            ) : savingState === "error" ? (
              <Tag className="border-rose-200 bg-rose-50 text-rose-700">Speicherfehler</Tag>
            ) : savingState === "pending" ? (
              <Tag className="border-amber-200 bg-amber-50 text-amber-700">Ausstehend…</Tag>
            ) : null}
            {error ? <Tag className="border-rose-200 bg-rose-50 text-rose-700">{error}</Tag> : null}
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
            >
              <Plus size={14} />
              Neue Mappe
            </button>
            <button
              onClick={() => setExportOpen(true)}
              disabled={!activeFolder}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-sand-800 hover:bg-sand-50 disabled:opacity-40"
            >
              <Download size={14} />
              Export
            </button>
            <button
              onClick={handleDeleteFolder}
              disabled={!activeFolder}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-40"
            >
              <Trash2 size={14} />
              Löschen
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1380px] space-y-5 p-6">

        {!activeFolder ? (
        <>
        <section className="rounded-[30px] border border-white/70 bg-white/78 p-4 shadow-soft backdrop-blur">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-sand-500">Projektmappen</div>
              <div className="text-lg font-semibold text-sand-900">Übersicht und Arbeitsbereiche</div>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="border-sky-200 bg-sky-50 text-sky-700">{explorerFolders.length} aktiv</Tag>
              <Tag className="border-sand-200 bg-white text-sand-700">{archivedFolders.length} archiviert</Tag>
            </div>
          </div>

          <div className="mb-4 inline-flex rounded-2xl border border-sand-200 bg-sand-50 p-1">
            {[
              { key: "explorer", label: "Explorer", icon: FolderKanban },
              { key: "archive", label: "Archiv", icon: Archive },
              { key: "blocks", label: "Bausteinpflege", icon: CheckSquare }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (item.key === "blocks") openBlockTemplatePanel();
                    else setOverviewSection(item.key);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    overviewSection === item.key ? "bg-white text-sand-900 shadow-sm" : "text-sand-600 hover:text-sand-900"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </button>
              );
            })}
          </div>

          {overviewSection === "explorer" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-sand-900">Aktive Kundenprojekte</div>
                  <div className="mt-0.5 text-xs text-sand-500">Kacheln mit Direktaktionen für Archivierung und Fakturierung.</div>
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-4">
                {explorerFolders.map((folder) => {
                  const meta = statusMeta[folder.status] || statusMeta.yellow;
                  const folderProgress = Number(folder.summary?.progress ?? 0);
                  return (
                    <div
                      key={folder.id}
                      className="overflow-hidden rounded-[20px] border border-sand-200 bg-white/70 transition hover:border-sand-300 hover:bg-white hover:shadow-md"
                    >
                      <div className={`h-1.5 w-full ${meta.dot}`} />
                      <div className="p-4">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-sand-900">{folder.title}</div>
                            <div className="mt-0.5 truncate text-xs text-sand-500">{folder.customer || "Ohne Kunde"}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleArchiveFolder(folder.id, true)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sand-200 bg-white text-sand-600 hover:bg-sand-50"
                              title="Archivieren"
                              aria-label="Archivieren"
                            >
                              <Archive size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openInvoiceModal(folder.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                              title="Fakturieren"
                              aria-label="Fakturieren"
                            >
                              <Receipt size={14} />
                            </button>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedFolderId(folder.id)} className="block w-full text-left">
                          <div className="flex flex-wrap gap-1">
                            {folder.project_tag ? (
                              <Tag className={getProjectFolderTagMeta(folder.project_tag).className}>
                                {folder.project_tag_label || getProjectFolderTagMeta(folder.project_tag).label}
                              </Tag>
                            ) : null}
                            {priorityMeta[folder.priority] ? (
                              <Tag className="border-sand-200 bg-sand-50 text-sand-600">{priorityMeta[folder.priority]}</Tag>
                            ) : null}
                            {folder.summary?.stream_count ? (
                              <Tag className="border-sand-200 bg-sand-50 text-sand-600">{folder.summary.stream_count} Bausteine</Tag>
                            ) : null}
                            {folder.invoice_draft_count ? (
                              <Tag className="border-sky-200 bg-sky-50 text-sky-700">{folder.invoice_draft_count} Rechnungen</Tag>
                            ) : null}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-sand-100">
                              <div className={`h-1.5 rounded-full ${meta.dot}`} style={{ width: `${folderProgress}%` }} />
                            </div>
                            <span className="shrink-0 text-[11px] tabular-nums text-sand-500">{folderProgress}%</span>
                          </div>
                          <div className="mt-1.5 text-[11px] text-sand-500">{folder.summary?.open_task_count || 0} offene Aufgaben</div>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!explorerFolders.length ? (
                  <div className="rounded-[24px] border border-dashed border-sand-300 p-6 text-sm text-sand-500">
                    Noch keine aktive Projektmappe vorhanden.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {overviewSection === "archive" ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-sand-900">Archivierte Projektmappen</div>
                <div className="mt-0.5 text-xs text-sand-500">Reaktivieren oder zur Detailansicht öffnen.</div>
              </div>
              <div className="grid gap-3 xl:grid-cols-3">
                {archivedFolders.map((folder) => (
                    <div key={folder.id} className="rounded-[20px] border border-sand-200 bg-sand-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-sand-900">{folder.title}</div>
                          <div className="mt-0.5 truncate text-xs text-sand-500">{folder.customer || "Ohne Kunde"}</div>
                          <div className="mt-2">
                            {folder.project_tag ? (
                              <Tag className={getProjectFolderTagMeta(folder.project_tag).className}>
                                {folder.project_tag_label || getProjectFolderTagMeta(folder.project_tag).label}
                              </Tag>
                            ) : null}
                          </div>
                          <div className="mt-2 text-[11px] text-sand-500">
                            Archiviert: {getFolderArchivedAt(folder) ? formatDateTime(getFolderArchivedAt(folder)) : "unbekannt"}
                          </div>
                        </div>
                      <Tag className="border-sand-200 bg-white text-sand-700">{folder.summary?.stream_count || 0} Bausteine</Tag>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedFolderId(folder.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-sand-800 hover:bg-sand-100"
                      >
                        <FolderKanban size={14} />
                        Öffnen
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveFolder(folder.id, false)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-100"
                      >
                        <RotateCcw size={14} />
                        Reaktivieren
                      </button>
                    </div>
                  </div>
                ))}
                {!archivedFolders.length ? (
                  <div className="rounded-[24px] border border-dashed border-sand-300 p-6 text-sm text-sand-500">
                    Noch keine archivierten Projektmappen vorhanden.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {overviewSection === "blocks" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-sand-200 bg-sand-50/70 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-sand-900">Bausteinpflege</div>
                  <div className="mt-0.5 text-xs text-sand-600">Kompakte Listen links, Detailbearbeitung rechts.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="border-sky-200 bg-sky-50 text-sky-700">{blockCatalogDraft.length} Bausteine</Tag>
                  <Tag className="border-sand-200 bg-white text-sand-700">{templateCatalogDraft.length} Vorlagen</Tag>
                  <button
                    type="button"
                    onClick={saveProjectCatalog}
                    disabled={catalogSaveBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    <CheckSquare size={14} />
                    {catalogSaveBusy ? "Speichert…" : "Speichern"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)_320px]">
                <section className="rounded-[22px] border border-sand-200 bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="inline-flex rounded-xl border border-sand-200 bg-sand-50 p-1">
                      <button
                        type="button"
                        onClick={() => setCatalogEditorTab("blocks")}
                        className={`rounded-lg px-2.5 py-1 text-[11px] ${catalogEditorTab === "blocks" ? "bg-white text-sand-900 shadow-sm" : "text-sand-500"}`}
                      >
                        Bausteine
                      </button>
                      <button
                        type="button"
                        onClick={() => setCatalogEditorTab("templates")}
                        className={`rounded-lg px-2.5 py-1 text-[11px] ${catalogEditorTab === "templates" ? "bg-white text-sand-900 shadow-sm" : "text-sand-500"}`}
                      >
                        Vorlagen
                      </button>
                    </div>
                    {catalogEditorTab === "blocks" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBlockCatalogDraft((prev) => [
                            ...prev,
                            {
                              key: `baustein_${prev.length + 1}`,
                              label: "Neuer Baustein",
                              summary: "",
                              tasksText: "",
                              checklistText: "",
                              risksText: "",
                              questionsText: "",
                              ganttText: "",
                              positionsText: ""
                            }
                          ]);
                          setSelectedBlockCatalogIndex(blockCatalogDraft.length);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] text-sand-700 hover:bg-sand-50"
                      >
                        <Plus size={12} />
                        Neu
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateCatalogDraft((prev) => [
                            ...prev,
                            { key: `projektvorlage_${prev.length + 1}`, label: "Neue Projektvorlage", blocks: [] }
                          ]);
                          setSelectedTemplateCatalogIndex(templateCatalogDraft.length);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] text-sand-700 hover:bg-sand-50"
                      >
                        <Plus size={12} />
                        Neu
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {catalogEditorTab === "blocks" ? (
                      blockCatalogDraft.length ? blockCatalogDraft.map((block, index) => (
                        <button
                          key={`${block.key}_${index}`}
                          type="button"
                          onClick={() => setSelectedBlockCatalogIndex(index)}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                            selectedBlockCatalogIndex === index ? "border-sky-300 bg-sky-50" : "border-sand-200 bg-sand-50/40 hover:bg-sand-50"
                          }`}
                        >
                          <div className="truncate text-sm font-semibold text-sand-900">{block.label || "Ohne Titel"}</div>
                          <div className="mt-0.5 truncate text-[11px] text-sand-500">{block.key || "ohne_key"}</div>
                          <div className="mt-1 line-clamp-2 text-[11px] text-sand-600">{block.summary || "Keine Kurzbeschreibung."}</div>
                        </button>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/40 px-4 py-6 text-center text-sm text-sand-500">
                          Noch keine Bausteine vorhanden.
                        </div>
                      )
                    ) : (
                      templateCatalogDraft.length ? templateCatalogDraft.map((template, index) => (
                        <button
                          key={`${template.key}_${index}`}
                          type="button"
                          onClick={() => setSelectedTemplateCatalogIndex(index)}
                          className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                            selectedTemplateCatalogIndex === index ? "border-sky-300 bg-sky-50" : "border-sand-200 bg-sand-50/40 hover:bg-sand-50"
                          }`}
                        >
                          <div className="truncate text-sm font-semibold text-sand-900">{template.label || "Ohne Titel"}</div>
                          <div className="mt-0.5 truncate text-[11px] text-sand-500">{template.key || "ohne_key"}</div>
                          <div className="mt-1 text-[11px] text-sand-600">{(template.blocks || []).length} zugeordnete Bausteine</div>
                        </button>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/40 px-4 py-6 text-center text-sm text-sand-500">
                          Noch keine Vorlagen vorhanden.
                        </div>
                      )
                    )}
                  </div>
                </section>

                <section className="rounded-[22px] border border-sand-200 bg-white p-4">
                  {catalogEditorTab === "blocks" ? (
                    activeBlockDraft ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-sand-900">Baustein bearbeiten</div>
                            <div className="mt-0.5 text-xs text-sand-500">Ein Eintrag pro Zeile in den Listenfeldern.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBlockCatalogDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== selectedBlockCatalogIndex))}
                            className="rounded-full border border-rose-200 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100"
                            aria-label="Baustein entfernen"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-sand-500">Key</span>
                            <input
                              className={inputClass}
                              value={activeBlockDraft.key || ""}
                              onChange={(e) => setBlockCatalogDraft((prev) => prev.map((item, itemIndex) => itemIndex === selectedBlockCatalogIndex ? { ...item, key: e.target.value } : item))}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-sand-500">Titel</span>
                            <input
                              className={inputClass}
                              value={activeBlockDraft.label || ""}
                              onChange={(e) => setBlockCatalogDraft((prev) => prev.map((item, itemIndex) => itemIndex === selectedBlockCatalogIndex ? { ...item, label: e.target.value } : item))}
                            />
                          </label>
                        </div>
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.14em] text-sand-500">Kurzbeschreibung</span>
                          <input
                            className={inputClass}
                            value={activeBlockDraft.summary || ""}
                            onChange={(e) => setBlockCatalogDraft((prev) => prev.map((item, itemIndex) => itemIndex === selectedBlockCatalogIndex ? { ...item, summary: e.target.value } : item))}
                          />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                          {[
                            ["tasksText", "Aufgaben"],
                            ["checklistText", "Checkliste"],
                            ["risksText", "Risiken"],
                            ["questionsText", "Fragen"],
                            ["ganttText", "Gantt-Phasen"],
                            ["positionsText", "Positionen"],
                          ].map(([field, label]) => (
                            <label key={field} className="space-y-1">
                              <span className="text-[11px] uppercase tracking-[0.14em] text-sand-500">{label}</span>
                              <textarea
                                rows={4}
                                className={textareaClass}
                                value={activeBlockDraft[field] || ""}
                                onChange={(e) => setBlockCatalogDraft((prev) => prev.map((item, itemIndex) => itemIndex === selectedBlockCatalogIndex ? { ...item, [field]: e.target.value } : item))}
                                placeholder="Eine Zeile pro Eintrag"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/40 px-4 py-10 text-center text-sm text-sand-500">
                        Baustein auswählen oder neu anlegen.
                      </div>
                    )
                  ) : (
                    activeTemplateDraft ? (
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-sand-900">Vorlage bearbeiten</div>
                            <div className="mt-0.5 text-xs text-sand-500">Bausteine direkt per Checkbox zuordnen.</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTemplateCatalogDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== selectedTemplateCatalogIndex))}
                            className="rounded-full border border-rose-200 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100"
                            aria-label="Projektvorlage entfernen"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-sand-500">Key</span>
                            <input
                              className={inputClass}
                              value={activeTemplateDraft.key || ""}
                              onChange={(e) => setTemplateCatalogDraft((prev) => prev.map((item, itemIndex) => itemIndex === selectedTemplateCatalogIndex ? { ...item, key: e.target.value } : item))}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.14em] text-sand-500">Titel</span>
                            <input
                              className={inputClass}
                              value={activeTemplateDraft.label || ""}
                              onChange={(e) => setTemplateCatalogDraft((prev) => prev.map((item, itemIndex) => itemIndex === selectedTemplateCatalogIndex ? { ...item, label: e.target.value } : item))}
                            />
                          </label>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-[0.14em] text-sand-500">Bausteine auswählen</div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {blockCatalogDraft.map((block) => {
                              const checked = Array.isArray(activeTemplateDraft.blocks) && activeTemplateDraft.blocks.includes(block.key);
                              return (
                                <label key={`${activeTemplateDraft.key}_${block.key}`} className="flex items-center gap-2 rounded-xl border border-sand-200 bg-sand-50/50 px-3 py-2 text-sm text-sand-700">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setTemplateCatalogDraft((prev) =>
                                        prev.map((item, itemIndex) =>
                                          itemIndex === selectedTemplateCatalogIndex
                                            ? {
                                                ...item,
                                                blocks: e.target.checked
                                                  ? [...(item.blocks || []), block.key]
                                                  : (item.blocks || []).filter((entry) => entry !== block.key)
                                              }
                                            : item
                                        )
                                      )
                                    }
                                  />
                                  <span>{block.label || block.key}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50/40 px-4 py-10 text-center text-sm text-sand-500">
                        Vorlage auswählen oder neu anlegen.
                      </div>
                    )
                  )}
                </section>

                <aside className="rounded-[22px] border border-sand-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-sand-900">KI-Vorschau</div>
                      <div className="mt-0.5 text-xs leading-5 text-sand-600">
                        Aus Freitext einen plausiblen Baustein-Entwurf erzeugen.
                      </div>
                    </div>
                    <AiSparkleButton onClick={handleBlockTemplatePreview} label="" title="Baustein-Vorschau per KI erzeugen" />
                  </div>
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={blockTemplatePrompt}
                      onChange={(e) => setBlockTemplatePrompt(e.target.value)}
                      rows={5}
                      placeholder='Beispiel: "Servermigration mit Analyse, Cutover, Tests und Abnahme."'
                      className="w-full rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-900 outline-none placeholder:text-sand-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                    <button
                      type="button"
                      onClick={handleBlockTemplatePreview}
                      disabled={blockTemplateBusy || !String(blockTemplatePrompt || "").trim()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                    >
                      <Sparkles size={14} />
                      {blockTemplateBusy ? "Erzeuge Vorschau…" : "Vorschau erzeugen"}
                    </button>
                    {blockTemplatePreview?.content?.streams?.length ? (
                      <div className="space-y-2 rounded-[18px] border border-sand-200 bg-sand-50/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-sand-500">Erkannt</div>
                          <Tag className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            {blockTemplatePreview.content.streams.length} Bausteine
                          </Tag>
                        </div>
                        {(blockTemplatePreview.content.streams || []).slice(0, 3).map((stream) => (
                          <div key={stream.id} className="rounded-2xl border border-sand-200 bg-white px-3 py-2">
                            <div className="text-sm font-semibold text-sand-900">{stream.title || "Baustein"}</div>
                            <div className="mt-0.5 text-xs text-sand-600">{stream.short_status || "Ohne Kurztext"}</div>
                            <div className="mt-2 space-y-1 text-[11px] text-sand-500">
                              {(stream.tasks || []).slice(0, 3).map((task) => (
                                <div key={task.id} className="truncate">{task.title || "Aufgabe"}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-sand-300 bg-sand-50/50 p-4 text-sm text-sand-500">
                        Noch keine Vorschau erzeugt.
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          ) : null}
        </section>
        </>
        ) : null}

        {activeFolder ? (
          <div ref={exportRef} className="space-y-2">
            {(() => {
              const folderMeta = statusMeta[activeFolder.status] || statusMeta.yellow;
              const today = new Date(); today.setHours(0,0,0,0);
              const deadlineDate = projectDeadline;
              const deadlineDiff = deadlineDate ? diffDays(today, deadlineDate) : null;
              const deadlineUrgent = deadlineDiff !== null && deadlineDiff <= 7;
              const deadlineOverdue = deadlineDiff !== null && deadlineDiff < 0;
              return (
              <section className="overflow-hidden rounded-[22px] border border-white/70 bg-white/84 shadow-soft backdrop-blur">
                <div className={`h-[3px] w-full ${folderMeta.dot}`} />
                <div className="space-y-3 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <input
                        className="w-full border-0 bg-transparent p-0 font-display text-xl text-sand-900 outline-none md:text-[1.7rem]"
                        value={activeFolder.title || ""}
                        onChange={(e) => mutateFolder((folder) => ({ ...folder, title: e.target.value }))}
                      />
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Tag className={getProjectFolderTagMeta(activeFolder.project_tag).className}>
                          {activeFolder.project_tag_label || getProjectFolderTagMeta(activeFolder.project_tag).label}
                        </Tag>
                        <Tag className="border-sand-200 bg-sand-50">{activeFolder.customer || "Ohne Kunde"}</Tag>
                        {feedbackCount ? <Tag className="border-amber-200 bg-amber-50 text-amber-700">{feedbackCount} Rückmeldungen</Tag> : null}
                        {blockedCount ? <Tag className="border-rose-200 bg-rose-50 text-rose-700">{blockedCount} Blockaden</Tag> : null}
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-sand-700">
                        <span className="uppercase tracking-[0.14em] text-sand-500">Kennzeichen</span>
                        <select
                          className="border-0 bg-transparent p-0 text-xs outline-none"
                          value={activeFolder.project_tag || ""}
                          onChange={(e) =>
                            mutateFolder((folder) => {
                              folder.content = folder.content || {};
                              folder.content.meta = folder.content.meta || {};
                              folder.content.meta.project_tag = e.target.value;
                              return folder;
                            })
                          }
                        >
                          <option value="">Ohne Kennzeichen</option>
                          {projectFolderTagOrder.map((key) => {
                            const option = projectFolderTagOptions[key];
                            return (
                              <option key={key} value={key}>
                                {option?.label || key}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    </div>
                    <label className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs ${
                      deadlineOverdue ? "border-rose-300 bg-rose-50 text-rose-700" :
                      deadlineUrgent  ? "border-amber-300 bg-amber-50 text-amber-700" :
                      "border-sand-200 bg-white text-sand-700"
                    }`}>
                      <Clock3 size={12} />
                      <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">Fällig</span>
                      <input
                        type="date"
                        className="border-0 bg-transparent p-0 text-[11px] outline-none"
                        value={projectDeadlineRaw}
                        onChange={(e) =>
                          mutateFolder((folder) => {
                            folder.content = folder.content || {};
                            folder.content.overview = folder.content.overview || {};
                            folder.content.overview.project_deadline = e.target.value;
                            return folder;
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 rounded-[14px] border border-sand-200 bg-sand-50/80 p-1.5">
                    <button type="button" onClick={() => setChecklistOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100">
                      <ListChecks size={12} /> Checkliste
                    </button>
                    <button type="button" onClick={() => setTimelineOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-700 hover:bg-sky-100">
                      <GitBranch size={12} /> Timeline
                    </button>
                    <button type="button" onClick={() => setCalculationOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs text-violet-700 hover:bg-violet-100">
                      <TrendingUp size={12} /> Kalkulation
                    </button>
                    <button type="button" onClick={() => setMaterialOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-100">
                      <FolderKanban size={12} /> Material
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                    <StatTile label="Fortschritt" value={`${activeSummary.progress || 0}%`}
                      accent={Number(activeSummary.progress || 0) >= 80 ? "emerald" : Number(activeSummary.progress || 0) >= 40 ? "sky" : "sand"}
                      icon={TrendingUp} compact />
                    <StatTile label="Bausteine" value={activeSummary.stream_count || 0} accent="sand" icon={FolderKanban} compact />
                    <StatTile label="Aufgaben" value={taskCompletionLabel}
                      accent="sand" icon={ListChecks} compact />
                    <StatTile label="Blocker" value={blockerCount}
                      accent="rose" icon={ShieldAlert} compact />
                    <StatTile label="Rückmeldungen" value={feedbackCount}
                      accent="amber" icon={Zap} compact />
                  </div>
                </div>
              </section>
              );
            })()}

            {selectedStream ? (
              <div className="space-y-2">
                <section className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-soft">
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="text-xs uppercase tracking-[0.2em] text-sand-500">Bausteine</div>
                        <Tag className="border-sand-200 bg-sand-50 text-sand-700">{activeStreams.length}</Tag>
                      </div>
                      <div className="inline-flex rounded-xl border border-sand-200 bg-sand-50 p-1">
                        <button
                          type="button"
                          onClick={() => setStreamLayoutMode("cards")}
                          className={`rounded-lg px-2.5 py-1 text-[11px] ${streamLayoutMode === "cards" ? "bg-white text-sand-900 shadow-sm" : "text-sand-500 hover:text-sand-700"}`}
                        >
                          Kacheln
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreamLayoutMode("flow")}
                          className={`rounded-lg px-2.5 py-1 text-[11px] ${streamLayoutMode === "flow" ? "bg-white text-sand-900 shadow-sm" : "text-sand-500 hover:text-sand-700"}`}
                        >
                          Flowchart
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreamLayoutMode("checklist")}
                          className={`rounded-lg px-2.5 py-1 text-[11px] ${streamLayoutMode === "checklist" ? "bg-white text-sand-900 shadow-sm" : "text-sand-500 hover:text-sand-700"}`}
                        >
                          Checkliste
                        </button>
                        <button
                          type="button"
                          onClick={() => setStreamLayoutMode("calendar")}
                          className={`rounded-lg px-2.5 py-1 text-[11px] ${streamLayoutMode === "calendar" ? "bg-white text-sand-900 shadow-sm" : "text-sand-500 hover:text-sand-700"}`}
                        >
                          Kalender
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className={`${inputClass} flex-1`}
                        value={newStreamTitle}
                        onChange={(e) => setNewStreamTitle(e.target.value)}
                        placeholder="Neuer Baustein anlegen, z. B. Firewall, Migration, Backup"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStream(newStreamTitle); } }}
                      />
                      <button
                        onClick={() => addStream(newStreamTitle)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-sand-700 hover:bg-sand-50"
                      >
                        <Plus size={13} />
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                  {activeStreams.length ? (
                    streamLayoutMode === "cards" ? (
                    <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                      {activeStreams.map((stream) => {
                        const isSelected = stream.id === selectedStreamId;
                        const streamOpenTasks = getOpenTaskCount(stream);
                        const streamProgress = getStreamProgress(stream);
                        const streamTasks = Array.isArray(stream.tasks) ? stream.tasks : [];
                        const workflowStatus = getWorkflowStatus(stream);
                        return (
                          <section
                            key={stream.id}
                            onClick={() => setSelectedStreamId(stream.id)}
                            className={`overflow-visible rounded-[18px] border text-left transition ${
                              isSelected
                                ? "border-sky-200 bg-sky-50/80 shadow-soft"
                                : "border-sand-200 bg-white hover:scale-[1.004] hover:border-sand-300 hover:shadow-md"
                            }`}
                          >
                            <div className={`h-[3px] w-full ${(statusMeta[stream.status] || statusMeta.yellow).dot}`} />
                            <div className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={stream.title || ""}
                                    onFocus={() => setSelectedStreamId(stream.id)}
                                    onChange={(e) =>
                                      mutateStreamById(stream.id, (current) => ({ ...current, title: e.target.value }))
                                    }
                                    className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] font-semibold leading-5 outline-none ${
                                      isSelected ? "text-slate-900 placeholder:text-slate-400" : "text-sand-900 placeholder:text-sand-400"
                                    }`}
                                    placeholder="Baustein"
                                  />
                                  <Tag className={workflowStatusMeta[workflowStatus]?.tone || workflowStatusMeta.open.tone}>
                                    {workflowStatusMeta[workflowStatus]?.label || "offen"}
                                  </Tag>
                                  <button
                                    type="button"
                                    onClick={() => removeStream(stream.id)}
                                    className={`shrink-0 rounded-full border p-1 ${
                                      isSelected
                                        ? "border-sky-200 bg-white text-slate-700 hover:bg-slate-50"
                                        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    }`}
                                    aria-label="Baustein löschen"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                                <div className={`mt-0.5 text-[10px] leading-4 ${isSelected ? "text-slate-600" : "text-sand-600"}`}>
                                  {stream.short_status || getPrimaryGap(stream) || "—"}
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-sand-100">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${(statusMeta[stream.status] || statusMeta.yellow).dot}`}
                                  style={{ width: `${streamProgress}%` }}
                                />
                              </div>
                              <span className="shrink-0 tabular-nums text-[10px] text-sand-500">{streamProgress}%</span>
                              {streamOpenTasks > 0 ? (
                                <Tag className="border-amber-200 bg-amber-50 text-amber-700">
                                  {streamOpenTasks} offen
                                </Tag>
                              ) : null}
                            </div>
                            <div className={`mt-2.5 rounded-[14px] border p-1.5 ${isSelected ? "border-sky-100 bg-white/80" : "border-black/5 bg-black/5"}`}>
                              <div className="flex items-center gap-1.5">
                                <input
                                  value={taskDrafts[stream.id] || ""}
                                  onFocus={() => setSelectedStreamId(stream.id)}
                                  onChange={(e) => setTaskDrafts((prev) => ({ ...prev, [stream.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addTaskToStream(stream);
                                    }
                                  }}
                                  placeholder="Aufgabe anlegen"
                                  className={`flex-1 rounded-md border px-2 py-1 text-[11px] outline-none ${
                                    isSelected
                                      ? "border-sky-200 bg-white text-slate-900 placeholder:text-slate-400"
                                      : "border-sand-200 bg-white text-sand-900"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => addTaskToStream(stream)}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
                                    isSelected
                                      ? "border-sky-200 bg-white text-slate-700 hover:bg-slate-50"
                                      : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                                  }`}
                                >
                                  <Plus size={11} />
                                  Neu
                                </button>
                              </div>
                              <div className="mt-1.5 space-y-1">
                                {streamTasks.length ? (() => {
                                  const openTasks = streamTasks.filter((t) => String(t.status || "open").trim().toLowerCase() !== "done");
                                  const doneTasks = streamTasks.filter((t) => String(t.status || "open").trim().toLowerCase() === "done");
                                  const openTaskIds = openTasks.map((task) => task.id);
                                  const doneTaskIds = doneTasks.map((task) => task.id);
                                  const renderTask = (task, orderedTaskIds) => {
                                    const taskMeta = taskStatusMeta[String(task.status || "open").trim().toLowerCase()] || taskStatusMeta.open;
                                    const isDone = String(task.status || "open").trim().toLowerCase() === "done";
                                    const accentClass = getTaskAccentClass(task.status);
                                    const deadlineMeta = getTaskDeadlineMeta(task.due_date);
                                    const taskDepth = getTaskDepth(task);
                                    const isTaskSelected = selectedTaskId === task.id;
                                    return (
                                      <div
                                        key={task.id}
                                        className={`relative rounded-lg border bg-white px-2.5 py-2 shadow-[0_2px_6px_rgba(150,120,60,0.08)] transition-colors ${accentClass} ${
                                          isTaskSelected ? "ring-2 ring-sky-200" : ""
                                        } ${isSelected ? "border-sky-200" : "border-sand-200"
                                        }`}
                                        style={{ marginLeft: `${taskDepth * 18}px` }}
                                        onMouseDown={() => setSelectedTaskId(task.id)}
                                      >
                                        {deadlineMeta.cornerClass ? (
                                          <div
                                            className={`pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[12px] border-t-[12px] border-l-transparent ${deadlineMeta.cornerClass}`}
                                            title={deadlineMeta.tooltip}
                                          />
                                        ) : null}
                                        <div className="flex items-start gap-1.5">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-1.5">
                                              <div className="flex min-w-0 flex-1 items-start gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    mutateStreamById(stream.id, (current) => ({
                                                      ...current,
                                                      tasks: (current.tasks || []).map((item) =>
                                                        item.id === task.id
                                                          ? { ...item, status: String(item.status || "open").trim().toLowerCase() === "done" ? "open" : "done" }
                                                          : item
                                                      )
                                                    }))
                                                  }
                                                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] ${
                                                    isDone
                                                      ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                                      : "border-sand-300 bg-white text-transparent hover:border-emerald-300"
                                                  }`}
                                                  aria-label={isDone ? "Als offen markieren" : "Als erledigt markieren"}
                                                  title={isDone ? "Als offen markieren" : "Als erledigt markieren"}
                                                >
                                                  ✓
                                                </button>
                                                <label className="min-w-0 flex-1">
                                                  <input
                                                    value={task.title || ""}
                                                    onFocus={() => setSelectedTaskId(task.id)}
                                                    onKeyDown={(e) => handleTaskHierarchyKeyDown(stream.id, task.id, orderedTaskIds, e)}
                                                    onChange={(e) =>
                                                      mutateStreamById(stream.id, (current) => ({
                                                        ...current,
                                                        tasks: (current.tasks || []).map((item) =>
                                                          item.id === task.id ? { ...item, title: e.target.value } : item
                                                        )
                                                      }))
                                                    }
                                                    className={`w-full border-0 bg-transparent p-0 text-left text-[12px] font-medium outline-none ${
                                                      isDone ? "text-sand-500 line-through" : "text-sand-900"
                                                    }`}
                                                    placeholder="Aufgabe"
                                                  />
                                                </label>
                                              </div>
                                              <div className="ml-auto flex items-center gap-1 pr-1">
                                                <div data-task-note-editor="true" className="relative">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setTaskNoteEditorId((current) =>
                                                        current === `card_note_${stream.id}_${task.id}` ? "" : `card_note_${stream.id}_${task.id}`
                                                      )
                                                    }
                                                    className={`inline-flex h-5 w-5 items-center justify-center rounded-[5px] border p-0 ${
                                                      String(task.note || "").trim()
                                                        ? "border-amber-400 bg-amber-300 text-amber-900 shadow-sm"
                                                        : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                                    }`}
                                                    aria-label="Notiz zur Aufgabe"
                                                    title="Notiz zur Aufgabe"
                                                  >
                                                    <StickyNote size={11} />
                                                  </button>
                                                  {taskNoteEditorId === `card_note_${stream.id}_${task.id}` ? (
                                                    <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-2xl border border-amber-200 bg-amber-50 p-2 shadow-soft">
                                                      <textarea
                                                        rows={4}
                                                        value={task.note || ""}
                                                        onChange={(e) =>
                                                          mutateStreamById(stream.id, (current) => ({
                                                            ...current,
                                                            tasks: (current.tasks || []).map((item) =>
                                                              item.id === task.id ? { ...item, note: e.target.value } : item
                                                            )
                                                          }))
                                                        }
                                                        placeholder="z. B. Herrn XY zurückrufen, Liefertermin bestätigen ..."
                                                        className="w-full resize-y rounded-xl border border-amber-200 bg-yellow-50 px-2.5 py-2 text-[11px] text-sand-900 outline-none placeholder:text-amber-500 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                                                      />
                                                    </div>
                                                  ) : null}
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    mutateStreamById(stream.id, (current) => ({
                                                      ...current,
                                                      tasks: (current.tasks || []).map((item) =>
                                                        item.id === task.id
                                                          ? { ...item, status: nextTaskStatus(item.status) }
                                                          : item
                                                      )
                                                    }))
                                                  }
                                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${taskMeta.tone}`}
                                                  title="Status wechseln"
                                                >
                                                  {taskMeta.label}
                                                </button>
                                                <div data-due-editor="true" className="relative">
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      setDueDateEditorId((current) =>
                                                        current === `card_${stream.id}_${task.id}` ? "" : `card_${stream.id}_${task.id}`
                                                      )
                                                    }
                                                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] text-sand-500 hover:text-sand-700"
                                                    title="Fälligkeit bearbeiten"
                                                  >
                                                    <Clock3 size={10} />
                                                    {deadlineMeta.label}
                                                  </button>
                                                  {dueDateEditorId === `card_${stream.id}_${task.id}` ? (
                                                    <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-sand-200 bg-white p-2 shadow-soft">
                                                      <input
                                                        type="date"
                                                        value={task.due_date || ""}
                                                        onChange={(e) =>
                                                          mutateStreamById(stream.id, (current) => ({
                                                            ...current,
                                                            tasks: (current.tasks || []).map((item) =>
                                                              item.id === task.id ? { ...item, due_date: e.target.value } : item
                                                            )
                                                          }))
                                                        }
                                                        className="w-full rounded-md border border-sand-200 bg-white px-2 py-1 text-[11px] text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                                                      />
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          mutateStreamById(stream.id, (current) => ({
                                                            ...current,
                                                            tasks: (current.tasks || []).map((item) =>
                                                              item.id === task.id ? { ...item, due_date: "" } : item
                                                            )
                                                          }))
                                                        }
                                                        className="mt-1 w-full rounded-md border border-sand-200 bg-sand-50 px-2 py-1 text-[10px] text-sand-600 hover:bg-sand-100"
                                                      >
                                                        Leeren
                                                      </button>
                                                    </div>
                                                  ) : null}
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    mutateStreamById(stream.id, (current) => ({
                                                      ...current,
                                                      tasks: (current.tasks || []).filter((item) => item.id !== task.id)
                                                    }))
                                                  }
                                                  className="rounded-full border border-rose-200 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100"
                                                  aria-label="Aufgabe löschen"
                                                  title="Löschen"
                                                >
                                                  <X size={11} />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  };
                                  return (
                                    <>
                                      {openTasks.length ? openTasks.map((task) => renderTask(task, openTaskIds)) : (
                                        <div className="py-1 text-center text-[11px] italic text-sand-400">
                                          Keine offenen Aufgaben
                                        </div>
                                      )}
                                      {doneTasks.length ? (
                                        <details className="mt-1">
                                          <summary className="cursor-pointer select-none text-[10px] text-sand-400 hover:text-sand-600">
                                            {doneTasks.length} erledigt
                                          </summary>
                                          <div className="mt-1 space-y-1 opacity-60">
                                            {doneTasks.map((task) => renderTask(task, doneTaskIds))}
                                          </div>
                                        </details>
                                      ) : null}
                                    </>
                                  );
                                })() : (
                                  <div className="py-2 text-center text-[11px] italic text-sand-400">
                                    Noch keine Aufgaben
                                  </div>
                                )}
                              </div>
                            </div>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                    ) : streamLayoutMode === "flow" ? (
                    <div className="space-y-4">
                      <section className="rounded-[18px] border border-sand-200 bg-white p-3">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-sand-900">Flowchart aller Bausteine</div>
                            <div className="mt-0.5 text-[11px] text-sand-500">Ein gemeinsames Canvas mit Grid-Snap und direkter Verbindungsführung.</div>
                          </div>
                        </div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={autoArrangeFlowBoard}
                            className="rounded-lg border border-sand-200 bg-sand-50 px-2.5 py-1.5 text-[11px] text-sand-700 hover:bg-sand-100"
                            title="Alle Aufgaben ohne Links sinnvoll anordnen"
                          >
                            Auto anordnen
                          </button>
                          {flowLinkSource ? (
                            <div className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-700">
                              <Link2 size={12} />
                              Verbindung aktiv. Zielkarte anklicken.
                              <button
                                type="button"
                                onClick={() => {
                                  setFlowLinkSource(null);
                                  setFlowLinkTarget(null);
                                }}
                                className="rounded-md border border-sky-200 bg-white px-1.5 py-0.5 text-[10px] text-sky-700 hover:bg-sky-100"
                              >
                                Abbrechen
                              </button>
                            </div>
                          ) : null}
                          <div className="inline-flex items-center rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-[11px] text-sand-500">
                            Freie Fläche ziehen = Canvas verschieben
                          </div>
                        </div>

                        <div
                          data-flow-canvas="true"
                          onMouseDown={startFlowCanvasPan}
                          className={`relative min-h-[340px] overflow-auto rounded-[18px] border border-sand-200 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,0.18)_1px,_transparent_0)] [background-size:24px_24px] ${flowCanvasDragging ? "cursor-grabbing" : "cursor-grab"}`}
                        >
                          <div className="sticky right-0 top-0 z-20 flex justify-end p-3">
                            <div className="w-56 rounded-2xl border border-sand-200 bg-white/92 p-2 shadow-soft backdrop-blur">
                              <div className="px-1 pb-1 text-[10px] uppercase tracking-[0.16em] text-sand-500">Bausteine</div>
                              <div className="space-y-1">
                                {flowBoardData.streams.map(({ stream, tone }) => (
                                  <button
                                    key={stream.id}
                                    type="button"
                                    onClick={() => setSelectedStreamId(stream.id)}
                                    className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[11px] ${
                                      selectedStreamId === stream.id ? "bg-sand-100 text-sand-900" : "text-sand-600 hover:bg-sand-50"
                                    }`}
                                    title={stream.short_status || getPrimaryGap(stream) || "Baustein"}
                                  >
                                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${tone.tag.split(" ").find((item) => item.startsWith("border-")) || "border-sand-200"} ${tone.tag.split(" ").find((item) => item.startsWith("bg-")) || "bg-sand-50"}`} />
                                    <span className="truncate">{stream.title || "Baustein"}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <svg className="pointer-events-none absolute inset-0 h-full w-full">
                            <defs>
                              <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(71,85,105,0.55)" />
                              </marker>
                              <marker id="flow-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(2,132,199,0.8)" />
                              </marker>
                            </defs>
                            {flowBoardData.links.map((link) => {
                              const from = flowBoardData.taskMap.get(link.fromTaskId);
                              const to = flowBoardData.taskMap.get(link.toTaskId);
                              if (!from || !to) return null;
                              const geometry = getFlowPathGeometry(from.position.x, from.position.y, from.dimensions.width, to.position.x, to.position.y);
                              return (
                                <path
                                  key={link.id}
                                  d={geometry.path}
                                  fill="none"
                                  stroke={link.tone.line}
                                  strokeWidth="2"
                                  strokeDasharray="6 4"
                                  markerEnd="url(#flow-arrow)"
                                />
                              );
                            })}
                            {flowLinkSource && flowLinkTarget && flowLinkSource.taskId !== flowLinkTarget.taskId ? (() => {
                              const from = flowBoardData.taskMap.get(flowLinkSource.taskId);
                              const to = flowBoardData.taskMap.get(flowLinkTarget.taskId);
                              if (!from || !to) return null;
                              const geometry = getFlowPathGeometry(from.position.x, from.position.y, from.dimensions.width, to.position.x, to.position.y);
                              return (
                                <path
                                  d={geometry.path}
                                  fill="none"
                                  stroke="rgba(2,132,199,0.8)"
                                  strokeWidth="3"
                                  strokeDasharray="10 6"
                                  markerEnd="url(#flow-arrow-active)"
                                />
                              );
                            })() : null}
                          </svg>
                          <div className="relative" style={{ width: flowBoardData.width, height: flowBoardData.height, minWidth: 860, minHeight: 640 }}>
                            {flowBoardData.lanes.map((lane) => (
                              <div
                                key={`lane_${lane.streamId}`}
                                className="absolute left-4 right-4 rounded-[28px] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-[1px]"
                                style={{ top: lane.top - 14, height: lane.height + 12, width: Math.max(flowBoardData.width - 32, lane.width) }}
                              >
                                <div className="absolute left-4 top-3 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[11px] font-medium text-sand-700 shadow-sm">
                                  <span className={`h-2.5 w-2.5 rounded-full ${lane.tone?.tag.split(" ").find((item) => item.startsWith("bg-")) || "bg-sky-100"}`} />
                                  {lane.streamTitle}
                                </div>
                              </div>
                            ))}
                            {flowBoardData.links.map((link) => {
                              const from = flowBoardData.taskMap.get(link.fromTaskId);
                              const to = flowBoardData.taskMap.get(link.toTaskId);
                              if (!from || !to) return null;
                              const geometry = getFlowPathGeometry(from.position.x, from.position.y, from.dimensions.width, to.position.x, to.position.y);
                              return (
                                <button
                                  key={`remove_${link.id}`}
                                  type="button"
                                  onClick={() => removeTaskLinkFromStream(link.streamId, link.id)}
                                  className="absolute z-10 inline-flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-rose-200 bg-white text-[11px] text-rose-600 shadow-sm hover:bg-rose-50"
                                  style={{ left: geometry.midX, top: geometry.midY }}
                                  title="Verbindung entfernen"
                                >
                                  ×
                                </button>
                              );
                            })}
                            {flowBoardData.tasks.map(({ streamId, streamTitle, tone, task, position }) => {
                              const expanded = Boolean(flowExpandedTasks[task.id]);
                              const taskMeta = taskStatusMeta[String(task.status || "open").trim().toLowerCase()] || taskStatusMeta.open;
                              const dimensions = getTaskFlowDimensions(task, expanded);
                              const isSelectedTask = selectedTaskId === task.id;
                              const isLinkSource = flowLinkSource?.streamId === streamId && flowLinkSource?.taskId === task.id;
                              const isLinkTarget = flowLinkTarget?.streamId === streamId && flowLinkTarget?.taskId === task.id;
                              const isLinkCandidate = Boolean(flowLinkSource && flowLinkSource.taskId !== task.id);
                              return (
                                <div
                                  key={task.id}
                                  className={`absolute z-10 rounded-xl border shadow-sm transition duration-150 ${tone.shell} ${
                                    isLinkSource ? "ring-2 ring-sky-300" : isLinkTarget ? "ring-2 ring-sky-200" : isSelectedTask ? "ring-2 ring-sand-300" : ""
                                  } ${isLinkCandidate ? "hover:ring-2 hover:ring-sky-100" : ""}`}
                                  data-flow-task="true"
                                  style={{ left: position.x, top: position.y, width: dimensions.width, minHeight: dimensions.height }}
                                  onMouseDown={() => {
                                    setSelectedStreamId(streamId);
                                    setSelectedTaskId(task.id);
                                  }}
                                  onMouseEnter={() => {
                                    if (flowLinkSource && flowLinkSource.taskId !== task.id) {
                                      setFlowLinkTarget({ streamId, taskId: task.id });
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (flowLinkTarget?.taskId === task.id) setFlowLinkTarget(null);
                                  }}
                                  onClick={() => {
                                    if (flowLinkSource && flowLinkSource.taskId !== task.id) {
                                      addTaskLinkToStream(streamId, flowLinkSource.taskId, task.id);
                                    }
                                  }}
                                >
                                  <div
                                    className={`flex cursor-move items-center justify-between gap-2 rounded-t-xl border-b border-black/5 px-2 py-1.5 ${tone.header} ${flowCanvasDragging ? "cursor-grabbing" : "cursor-grab"}`}
                                    onMouseDown={(event) => startTaskDrag(event, streamId, task.id, task)}
                                  >
                                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          mutateStreamById(streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) =>
                                              item.id === task.id
                                                ? { ...item, status: String(item.status || "open").trim().toLowerCase() === "done" ? "open" : "done" }
                                                : item
                                            )
                                          }));
                                        }}
                                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] ${
                                          String(task.status || "open").trim().toLowerCase() === "done"
                                            ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                            : "border-sand-300 bg-white text-transparent hover:border-emerald-300"
                                        }`}
                                        aria-label={String(task.status || "open").trim().toLowerCase() === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                                        title={String(task.status || "open").trim().toLowerCase() === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                                      >
                                        ✓
                                      </button>
                                      <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-sand-900">{task.title || "Aufgabe"}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (flowLinkSource?.streamId === streamId && flowLinkSource?.taskId && flowLinkSource.taskId !== task.id) {
                                            addTaskLinkToStream(streamId, flowLinkSource.taskId, task.id);
                                            return;
                                          }
                                          setFlowLinkSource((current) =>
                                            current?.streamId === streamId && current?.taskId === task.id
                                              ? null
                                              : { streamId, taskId: task.id }
                                          );
                                          setFlowLinkTarget(null);
                                        }}
                                        className={`rounded-md border p-1 ${
                                          isLinkSource
                                            ? "border-sky-300 bg-sky-100 text-sky-700"
                                            : "border-black/10 bg-white/80 text-sand-600"
                                        }`}
                                        title={isLinkSource ? "Quelle gewählt" : "Als Verbindungsquelle wählen"}
                                      >
                                        <Link2 size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setFlowExpandedTasks((prev) => ({ ...prev, [task.id]: !prev[task.id] }));
                                        }}
                                        className="rounded-md border border-black/10 bg-white/80 p-1"
                                      >
                                        <ChevronDown size={12} className={`transition ${expanded ? "rotate-180" : ""}`} />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex flex-col px-2 py-1.5">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                      <Tag className={tone.tag}>{streamTitle}</Tag>
                                      <div data-due-editor="true" className="relative">
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setDueDateEditorId((current) => (current === `flow_${streamId}_${task.id}` ? "" : `flow_${streamId}_${task.id}`));
                                          }}
                                          className="truncate text-[11px] text-sand-700 hover:text-sand-900"
                                        >
                                          {task.due_date ? `Fällig ${formatDateLabel(task.due_date)}` : "Ohne Fälligkeit"}
                                        </button>
                                        {dueDateEditorId === `flow_${streamId}_${task.id}` ? (
                                          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-sand-200 bg-white p-2 shadow-soft">
                                            <input
                                              type="date"
                                              value={task.due_date || ""}
                                              onClick={(event) => event.stopPropagation()}
                                              onChange={(e) =>
                                                mutateStreamById(streamId, (current) => ({
                                                  ...current,
                                                  tasks: (current.tasks || []).map((item) => (item.id === task.id ? { ...item, due_date: e.target.value } : item))
                                                }))
                                              }
                                              className="w-full rounded-md border border-sand-200 bg-white px-2 py-1 text-[11px] text-sand-900 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                                            />
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                mutateStreamById(streamId, (current) => ({
                                                  ...current,
                                                  tasks: (current.tasks || []).map((item) => (item.id === task.id ? { ...item, due_date: "" } : item))
                                                }));
                                              }}
                                              className="mt-1 w-full rounded-md border border-sand-200 bg-sand-50 px-2 py-1 text-[10px] text-sand-600 hover:bg-sand-100"
                                            >
                                              Leeren
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="mb-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateStreamById(streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) => (item.id === task.id ? { ...item, status: nextTaskStatus(item.status) } : item))
                                          }))
                                        }
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${taskMeta.tone}`}
                                      >
                                        {taskMeta.label}
                                      </button>
                                    </div>
                                    {expanded ? (
                                      <div className="mt-2 space-y-2">
                                        <input
                                          value={task.title || ""}
                                          onClick={(event) => event.stopPropagation()}
                                          onChange={(e) =>
                                            mutateStreamById(streamId, (current) => ({
                                              ...current,
                                              tasks: (current.tasks || []).map((item) => (item.id === task.id ? { ...item, title: e.target.value } : item))
                                            }))
                                          }
                                          className="w-full rounded-md border border-sand-200 bg-white px-2 py-1 text-[11px] outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            mutateStreamById(streamId, (current) => ({
                                              ...current,
                                              tasks: (current.tasks || []).filter((item) => item.id !== task.id),
                                              task_links: (current.task_links || []).filter((link) => link.fromTaskId !== task.id && link.toTaskId !== task.id)
                                            }));
                                          }}
                                          className="w-full rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700"
                                        >
                                          Aufgabe löschen
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    onMouseDown={(event) => startTaskResize(event, streamId, task.id, task, expanded)}
                                    className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 cursor-se-resize rounded-sm border border-sand-300 bg-white/90 shadow-sm hover:border-sky-300"
                                    title="Größe frei ziehen"
                                    aria-label="Größe frei ziehen"
                                  >
                                    <span className="pointer-events-none absolute bottom-[2px] right-[2px] h-[6px] w-[6px] border-b border-r border-sand-400" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </section>
                    </div>
                    ) : streamLayoutMode === "checklist" ? (
                    <div className="overflow-hidden rounded-[24px] border border-sand-200 bg-white">
                      {groupedChecklistTasks.length ? (
                        groupedChecklistTasks.map((group) => (
                          <section key={group.id} className="border-b border-sand-200 last:border-b-0">
                            <div className="flex items-center justify-between gap-3 bg-sand-50/70 px-4 py-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-sand-900">{group.title}</div>
                                <div className="mt-0.5 text-xs text-sand-500">{group.openCount} offen · {group.tasks.length} gesamt</div>
                              </div>
                              <Tag className={workflowStatusMeta[getWorkflowStatus(activeStreams.find((stream) => stream.id === group.id) || {})]?.tone || workflowStatusMeta.open.tone}>
                                {workflowStatusMeta[getWorkflowStatus(activeStreams.find((stream) => stream.id === group.id) || {})]?.label || "offen"}
                              </Tag>
                            </div>
                            <div className="divide-y divide-sand-100">
                              {group.tasks.map((task, index) => {
                                const statusKey = String(task?.status || "open").trim().toLowerCase();
                                const meta = taskStatusMeta[statusKey] || taskStatusMeta.open;
                                const taskDepth = getTaskDepth(task);
                                return (
                                  <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0 flex items-center gap-3" style={{ marginLeft: `${taskDepth * 18}px` }}>
                                      <span className="w-5 shrink-0 text-right text-xs tabular-nums text-sand-400">{index + 1}.</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateStreamById(group.id, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) =>
                                              item.id === task.id
                                                ? { ...item, status: String(item.status || "open").trim().toLowerCase() === "done" ? "open" : "done" }
                                                : item
                                            )
                                          }))
                                        }
                                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                          statusKey === "done"
                                            ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                            : "border-sand-300 bg-white text-sand-400"
                                        }`}
                                        aria-label={statusKey === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                                        title={statusKey === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                                      >
                                        {statusKey === "done" ? "✓" : ""}
                                      </button>
                                      <span className={`text-sm text-sand-900 ${statusKey === "done" ? "line-through text-sand-400" : ""}`}>{task.title || "Aufgabe"}</span>
                                    </div>
                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${meta.tone}`}>{meta.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ))
                      ) : (
                        <div className="p-8 text-center text-sm text-sand-500">Noch keine Aufgaben in den Bausteinen vorhanden.</div>
                      )}
                    </div>
                    ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-sand-200 bg-sand-50/70 px-3 py-2">
                        <div>
                          <div className="text-sm font-semibold text-sand-900">
                            {calendarViewData.months.map((month) => month.label).join(" + ")}
                          </div>
                          <div className="text-[11px] text-sand-500">
                            Projektzeitraum {calendarViewData.rangeLabel}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="inline-flex rounded-xl border border-sand-200 bg-white p-1">
                            <button
                              type="button"
                              onClick={() => setCalendarMonthSpan(1)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] ${calendarMonthSpan === 1 ? "bg-sand-100 text-sand-900" : "text-sand-500"}`}
                            >
                              Monat
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalendarMonthSpan(2)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] ${calendarMonthSpan === 2 ? "bg-sand-100 text-sand-900" : "text-sand-500"}`}
                            >
                              2 Monate
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextAnchor = addMonths(calendarViewData.visibleStart, -calendarMonthSpan);
                              setCalendarAnchor(toMonthKey(nextAnchor));
                            }}
                            className="inline-flex items-center rounded-lg border border-sand-200 bg-white px-2 py-1 text-sand-700 hover:bg-sand-50"
                            title="Zurück"
                          >
                            <ChevronRight size={14} className="rotate-180" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextAnchor = addMonths(calendarViewData.visibleStart, calendarMonthSpan);
                              setCalendarAnchor(toMonthKey(nextAnchor));
                            }}
                            className="inline-flex items-center rounded-lg border border-sand-200 bg-white px-2 py-1 text-sand-700 hover:bg-sand-50"
                            title="Weiter"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      {calendarViewData.undatedTasks.length ? (
                        <div className="rounded-[18px] border border-sand-200 bg-white p-3">
                          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-sand-500">
                            Ohne Fälligkeit / ganze Projektphase
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {calendarViewData.undatedTasks.map((task) => {
                              const meta = taskStatusMeta[task.statusKey] || taskStatusMeta.open;
                              return (
                                <div key={`undated_${task.streamId}_${task.id}`} className={`rounded-full border px-2.5 py-1 text-[11px] ${meta.tone}`}>
                                  <span className="font-medium">{task.streamTitle}:</span> {task.title || "Aufgabe"}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="overflow-hidden rounded-[20px] border border-sand-200 bg-white">
                        <div className="grid grid-cols-7 border-b border-sand-200 bg-sand-50/80">
                          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => (
                            <div key={label} className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-sand-500">
                              {label}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7">
                          {calendarViewData.days.map((day) => {
                            const tasks = calendarViewData.tasksByDay[day.key] || [];
                            return (
                              <div
                                key={day.key}
                                className={`min-h-[150px] border-b border-r border-sand-100 px-2 py-2 ${
                                  day.inMonth ? "bg-white" : "bg-sand-50/50"
                                } ${day.isWeekend ? "bg-sand-50/70" : ""}`}
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className={`text-[11px] font-medium ${day.isToday ? "rounded-full bg-rose-100 px-2 py-0.5 text-rose-700" : day.inMonth ? "text-sand-900" : "text-sand-400"}`}>
                                    {day.date.getDate()}
                                  </span>
                                  {day.date.getDate() === 1 ? (
                                    <span className="text-[10px] uppercase tracking-[0.12em] text-sand-400">
                                      {day.date.toLocaleDateString("de-DE", { month: "short" })}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="space-y-1">
                                  {tasks.length ? (
                                    tasks.map((task) => {
                                      const meta = taskStatusMeta[task.statusKey] || taskStatusMeta.open;
                                      return (
                                        <div key={`day_${day.key}_${task.streamId}_${task.id}`} className={`rounded-md border px-2 py-1 text-[11px] ${meta.tone}`}>
                                          <div className="truncate font-medium">{task.title || "Aufgabe"}</div>
                                          <div className="truncate text-[10px] opacity-70">{task.streamTitle}</div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-[10px] text-sand-300"> </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    )
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-sand-300 p-5 text-sm text-sand-500">
                      Noch keine Bausteine vorhanden.
                    </div>
                  )}
                </section>

              </div>
            ) : (
              <section className="rounded-[28px] border border-dashed border-sand-300 bg-white/80 p-10 text-center text-sand-600 shadow-soft">
                Wähle einen Baustein.
              </section>
            )}
          </div>
        ) : (
          <section className="rounded-[28px] border border-white/70 bg-white/80 p-10 text-center text-sand-600 shadow-soft">
            Keine Projektmappe ausgewählt.
          </section>
        )}
      </div>

      <datalist id="project-folder-customers">
        {customerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="project-folder-employees">
        {employeeNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {invoiceDialog.open ? (
        <Modal
          title={`Fakturierung · ${invoiceDialog.folderTitle || "Projektmappe"}`}
          onClose={() =>
            setInvoiceDialog({
              open: false,
              folderId: null,
              folderTitle: "",
              invoiceTitle: "",
              note: "",
              positions: [],
              improveBusy: false,
              saveBusy: false
            })
          }
          width="max-w-5xl"
        >
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Rechnungstitel</span>
                <input
                  className={inputClass}
                  value={invoiceDialog.invoiceTitle}
                  onChange={(e) => setInvoiceDialog((prev) => ({ ...prev, invoiceTitle: e.target.value }))}
                />
              </label>
              <div className="rounded-2xl border border-sand-200 bg-sand-50/70 px-4 py-3 text-sm text-sand-700">
                {invoiceDialog.positions.filter((item) => item.selected).length} Positionen ausgewählt
              </div>
            </div>

            <label className="space-y-1">
              <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Hinweis</span>
              <textarea
                className={textareaClass}
                value={invoiceDialog.note}
                onChange={(e) => setInvoiceDialog((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Optionaler interner Hinweis oder Freitext zur Abrechnung"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-sand-200 bg-sand-50/70 px-4 py-3">
              <div className="text-sm text-sand-700">Aufgaben auswählen und Rechnungstexte bei Bedarf anpassen.</div>
              <button
                type="button"
                onClick={improveInvoiceTexts}
                disabled={invoiceDialog.improveBusy || !invoiceDialog.positions.some((item) => item.selected)}
                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-40"
              >
                <Sparkles size={14} />
                {invoiceDialog.improveBusy ? "Verbessert…" : "KI-Textverbesserung"}
              </button>
            </div>

            <div className="space-y-3">
              {invoiceDialog.positions.length ? invoiceDialog.positions.map((item) => {
                const statusTone = taskStatusMeta[item.status]?.tone || taskStatusMeta.open.tone;
                return (
                  <label key={item.taskId} className="block rounded-[22px] border border-sand-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={(e) =>
                          setInvoiceDialog((prev) => ({
                            ...prev,
                            positions: prev.positions.map((entry) =>
                              entry.taskId === item.taskId ? { ...entry, selected: e.target.checked } : entry
                            )
                          }))
                        }
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-sand-900">{item.taskTitle}</div>
                            <div className="mt-0.5 text-xs text-sand-500">{item.streamTitle}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Tag className={statusTone}>{taskStatusMeta[item.status]?.label || item.status}</Tag>
                            {item.invoicedAt ? <Tag className="border-amber-200 bg-amber-50 text-amber-700">bereits fakturiert</Tag> : null}
                          </div>
                        </div>
                        <textarea
                          className={textareaClass}
                          value={item.text}
                          onChange={(e) =>
                            setInvoiceDialog((prev) => ({
                              ...prev,
                              positions: prev.positions.map((entry) =>
                                entry.taskId === item.taskId ? { ...entry, text: e.target.value } : entry
                              )
                            }))
                          }
                          placeholder="Text für die Rechnungsposition"
                        />
                      </div>
                    </div>
                  </label>
                );
              }) : (
                <div className="rounded-[24px] border border-dashed border-sand-300 p-6 text-sm text-sand-500">
                  In dieser Projektmappe sind keine Aufgaben für die Fakturierung vorhanden.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setInvoiceDialog({
                    open: false,
                    folderId: null,
                    folderTitle: "",
                    invoiceTitle: "",
                    note: "",
                    positions: [],
                    improveBusy: false,
                    saveBusy: false
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm text-sand-800 hover:bg-sand-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveInvoiceDraft}
                disabled={invoiceDialog.saveBusy || !invoiceDialog.positions.some((item) => item.selected)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                <Receipt size={16} />
                {invoiceDialog.saveBusy ? "Speichert…" : "Rechnungsentwurf speichern"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {createOpen ? (
        <Modal title="Projektmappe erstellen" onClose={() => setCreateOpen(false)}>
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="grid gap-2">
                {creationModes.map((mode) => (
                  <button
                    key={mode.key}
                    onClick={() => {
                      setCreateForm((prev) => ({ ...prev, mode: mode.key }));
                      setDraftFolder(null);
                    }}
                    className={`rounded-2xl border p-4 text-left ${createForm.mode === mode.key ? "border-sky-300 bg-sky-50" : "border-sand-200 bg-white"}`}
                  >
                    <div className="font-medium text-sand-900">{mode.label}</div>
                    <div className="mt-1 text-sm text-sand-600">{mode.text}</div>
                  </button>
                ))}
              </div>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Titel</span>
                <input className={inputClass} value={createForm.title} onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Kunde</span>
                <input list="project-folder-customers" className={inputClass} value={createForm.customer} onChange={(e) => setCreateForm((prev) => ({ ...prev, customer: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Verantwortlich</span>
                <input list="project-folder-employees" className={inputClass} value={createForm.owner} onChange={(e) => setCreateForm((prev) => ({ ...prev, owner: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Kennzeichen</span>
                <select
                  className={selectClass}
                  value={createForm.project_tag}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, project_tag: e.target.value }))}
                >
                  {projectFolderTagOrder.map((key) => {
                    const option = projectFolderTagOptions[key];
                    return (
                      <option key={key} value={key}>
                        {option?.label || key}
                      </option>
                    );
                  })}
                </select>
              </label>
              {createForm.mode === "ai" ? (
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Projektbeschreibung</span>
                  <textarea className={textareaClass} value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} />
                </label>
              ) : null}
              {createForm.mode === "blocks" ? (
                <div className="rounded-2xl border border-sand-200 bg-white p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-sand-500">Bausteine</div>
                  <div className="grid gap-2">
                    {(catalog.blocks || []).map((block) => {
                      const checked = createForm.block_keys.includes(block.key);
                      return (
                        <label key={block.key} className="flex items-start gap-2 text-sm text-sand-700">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setCreateForm((prev) => ({
                                ...prev,
                                block_keys: e.target.checked
                                  ? [...prev.block_keys, block.key]
                                  : prev.block_keys.filter((item) => item !== block.key)
                              }))
                            }
                          />
                          <span>
                            <span className="font-medium text-sand-900">{block.label}</span>
                            <span className="block text-sand-600">{block.summary}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {createForm.mode === "template" ? (
                <label className="space-y-1">
                  <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Vorlage</span>
                  <select className={selectClass} value={createForm.template_key} onChange={(e) => setCreateForm((prev) => ({ ...prev, template_key: e.target.value }))}>
                    <option value="">Vorlage wählen</option>
                    {(catalog.templates || []).map((template) => (
                      <option key={template.key} value={template.key}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button onClick={handleBootstrap} disabled={createBusy} className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white">
                <Sparkles size={16} />
                {createBusy ? "Erzeuge Vorschau…" : "Vorschau erzeugen"}
              </button>
            </div>
            <div className="rounded-[24px] border border-sand-200 bg-white p-5">
              {!draftFolder ? (
                <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-sand-500">
                  Vorschau erscheint hier.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-sand-500">Vorschau</div>
                    <h3 className="mt-1 text-2xl font-semibold text-sand-900">{draftFolder.title}</h3>
                    <p className="mt-1 text-sm text-sand-600">{draftFolder.customer || "Ohne Kunde"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {draftFolder.project_tag ? (
                        <Tag className={getProjectFolderTagMeta(draftFolder.project_tag).className}>
                          {draftFolder.project_tag_label || getProjectFolderTagMeta(draftFolder.project_tag).label}
                        </Tag>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(draftFolder.content?.streams || []).map((stream) => (
                      <label key={stream.id} className="rounded-2xl border border-sand-200 p-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={draftSelection[stream.id] !== false}
                            onChange={(e) => setDraftSelection((prev) => ({ ...prev, [stream.id]: e.target.checked }))}
                          />
                          <div>
                            <div className="font-medium text-sand-900">{stream.title}</div>
                            <div className="mt-1 text-sm text-sand-600">{stream.short_status || "Kein Kurztext"}</div>
                            <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-sand-500">
                              <span>{stream.tasks?.length || 0} Aufgaben</span>
                              <span>{stream.checklists?.length || 0} Checklisten</span>
                              <span>{stream.risks?.length || 0} Risiken</span>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleCreateFolder} disabled={createBusy} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white">
                      <ChevronRight size={16} />
                      Projektmappe anlegen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      ) : null}

      {aiDialog.open ? (
        <Modal title="KI-Unterstützung" onClose={() => { setAiDialog({ open: false, action: "tasks", topic: "", target: null }); setAiResult(null); }} width="max-w-4xl">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
              <select className={selectClass} value={aiDialog.action} onChange={(e) => setAiDialog((prev) => ({ ...prev, action: e.target.value }))}>
                {aiActions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
              <input className={inputClass} value={aiDialog.topic} onChange={(e) => setAiDialog((prev) => ({ ...prev, topic: e.target.value }))} />
              <button onClick={triggerAiAction} disabled={aiBusy} className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white">
                <Wand2 size={16} />
                {aiBusy ? "Lädt…" : "Vorschlag erzeugen"}
              </button>
            </div>
            {aiDialog.target ? (
              <div className="text-xs uppercase tracking-[0.18em] text-sand-500">
                Ziel: {aiDialog.target.scope === "folder" ? "Projekt" : "Baustein"} / {aiDialog.target.field}
              </div>
            ) : null}
            <div className="rounded-[24px] border border-sand-200 bg-white p-5">
              {!aiResult ? (
                <div className="min-h-[220px] text-sm text-sand-500 flex items-center justify-center">
                  KI-Vorschlag erscheint hier.
                </div>
              ) : aiResult.mode === "text" ? (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sand-700">
                    <Bot size={16} />
                    <span className="font-medium">{aiResult.title || "KI-Ausgabe"}</span>
                  </div>
                  <pre className="whitespace-pre-wrap rounded-2xl bg-sand-50 p-4 text-sm text-sand-800">{aiResult.text || ""}</pre>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="mb-2 flex items-center gap-2 text-sand-700">
                    <Bot size={16} />
                    <span className="font-medium">{aiResult.title || "KI-Ausgabe"}</span>
                  </div>
                  {(aiResult.items || []).map((item, index) => (
                    <div key={`${index}_${typeof item === "string" ? item : item?.title || index}`} className="rounded-2xl border border-sand-200 bg-sand-50/70 p-3 text-sm text-sand-800">
                      {typeof item === "string" ? item : item?.title || JSON.stringify(item)}
                      {typeof item === "object" && item?.mitigation ? <div className="mt-1 text-xs text-sand-600">Maßnahme: {item.mitigation}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {aiResult ? (
              <div className="flex justify-end">
                <button onClick={applyAiResult} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white">
                  <Sparkles size={16} />
                  In Arbeitsstrang übernehmen
                </button>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {overviewOpen && activeFolder ? (
        <Modal title="Projektübersicht" onClose={() => setOverviewOpen(false)} width="max-w-5xl">
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <StatTile
                label="Bausteine"
                value={activeSummary.stream_count || 0}
                accent="sand"
                icon={FolderKanban}
              />
              <StatTile
                label="Aufgaben"
                value={taskCompletionLabel}
                accent="sand"
                icon={ListChecks}
              />
              <StatTile
                label="Blocker"
                value={blockerCount}
                accent="rose"
                icon={ShieldAlert}
              />
              <StatTile
                label="Rückmeldungen"
                value={feedbackCount}
                accent={feedbackCount > 0 ? "amber" : "sand"}
                icon={Zap}
              />
            </div>
            <div className="rounded-[24px] border border-sand-200 bg-white p-5">
              <div className="text-xs uppercase tracking-[0.18em] text-sand-500">Visualisierung</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {activeStreams.map((stream) => {
                  const meta = statusMeta[stream.status] || statusMeta.yellow;
                  const openTasks = getOpenTaskCount(stream);
                  const streamProgress = getStreamProgress(stream);
                  const marker = streamMarkerMeta[String(stream.marker || "").trim().toLowerCase()] || null;
                  const workflowStatus = getWorkflowStatus(stream);
                  return (
                    <div key={stream.id} className="rounded-[22px] border border-sand-200 bg-sand-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-sand-900">{stream.title || "Baustein"}</div>
                          <div className="mt-1 text-xs text-sand-600">{stream.short_status || getPrimaryGap(stream) || "—"}</div>
                        </div>
                        <span
                          className={`mt-1 inline-flex h-2 w-2 shrink-0 rounded-full ring-1 ring-black/5 ${meta.dot}`}
                          title={meta.label}
                          aria-label={`Status: ${meta.label}`}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Tag className={workflowStatusMeta[workflowStatus]?.tone || workflowStatusMeta.open.tone}>
                          {workflowStatusMeta[workflowStatus]?.label || "offen"}
                        </Tag>
                        <Tag className="border-sand-200 bg-white text-sand-700">{streamProgress}%</Tag>
                        {marker ? <Tag className={marker.tone}>{marker.label}</Tag> : null}
                        <Tag className={openTasks > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                          {openTasks} offen
                        </Tag>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={async () => {
                  await exportProjectPdf(`${activeFolder.title || "projektmappe"}`.replace(/[^\w\-]+/g, "_"));
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white"
              >
                <Download size={16} />
                PDF export
              </button>
              <button
                type="button"
                onClick={() => {
                  setOverviewOpen(false);
                  setExportOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-sand-200 bg-white px-4 py-2.5 text-sm text-sand-800 hover:bg-sand-50"
              >
                Weitere Exporte
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {checklistOpen && activeFolder ? (
        <Modal title="Checkliste" onClose={() => setChecklistOpen(false)} width="max-w-4xl">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-sand-200 bg-sand-50/70 px-4 py-3 text-sm text-sand-700">
              Gruppierte Liste aller Aufgaben aus allen Bausteinen.
            </div>
            {groupedChecklistTasks.length ? (
              <div className="overflow-hidden rounded-[24px] border border-sand-200 bg-white">
                {groupedChecklistTasks.map((group) => (
                  <section key={group.id} className="border-b border-sand-200 last:border-b-0">
                    <div className="flex items-center justify-between gap-3 bg-sand-50/70 px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-sand-900">{group.title}</div>
                        <div className="mt-0.5 text-xs text-sand-500">{group.openCount} offen · {group.tasks.length} gesamt</div>
                      </div>
                      <Tag className={workflowStatusMeta[getWorkflowStatus(activeStreams.find((stream) => stream.id === group.id) || {})]?.tone || workflowStatusMeta.open.tone}>
                        {workflowStatusMeta[getWorkflowStatus(activeStreams.find((stream) => stream.id === group.id) || {})]?.label || "offen"}
                      </Tag>
                    </div>
                    <div className="divide-y divide-sand-100">
                      {group.tasks.map((task, index) => {
                        const statusKey = String(task?.status || "open").trim().toLowerCase();
                        const meta = taskStatusMeta[statusKey] || taskStatusMeta.open;
                        const taskDepth = getTaskDepth(task);
                        return (
                          <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0 flex items-center gap-3" style={{ marginLeft: `${taskDepth * 18}px` }}>
                              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-sand-400">{index + 1}.</span>
                              <button
                                type="button"
                                onClick={() =>
                                  mutateStreamById(group.id, (current) => ({
                                    ...current,
                                    tasks: (current.tasks || []).map((item) =>
                                      item.id === task.id
                                        ? { ...item, status: String(item.status || "open").trim().toLowerCase() === "done" ? "open" : "done" }
                                        : item
                                    )
                                  }))
                                }
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                  statusKey === "done"
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                    : "border-sand-300 bg-white text-sand-400"
                                }`}
                                aria-label={statusKey === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                                title={statusKey === "done" ? "Als offen markieren" : "Als erledigt markieren"}
                              >
                                {statusKey === "done" ? "✓" : ""}
                              </button>
                              <span className={`text-sm text-sand-900 ${statusKey === "done" ? "line-through text-sand-400" : ""}`}>{task.title || "Aufgabe"}</span>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${meta.tone}`}>{meta.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-sand-300 p-8 text-center text-sm text-sand-500">
                Noch keine Aufgaben in den Bausteinen vorhanden.
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {calculationOpen && activeFolder ? (
        <Modal title="Kalkulation" onClose={() => setCalculationOpen(false)} width="max-w-7xl">
          <div className="space-y-5">
            <div className="rounded-[22px] border border-sand-200 bg-sand-50/70 px-4 py-3 text-sm text-sand-700">
              Aufgaben stehen je Baustein zuerst, danach Material. `Regelwert` ist Vorschlag aus Baustein oder KI, `Eigenwert` der tatsächlich veranschlagte Preis. `Kosten` dient für die Gewinnschätzung.
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <StatTile label="Geschätzter Umsatz" value={formatCurrency(calculationTotals.revenue)} accent="sky" icon={TrendingUp} />
              <StatTile label="Geschätzter Gewinn" value={formatCurrency(calculationTotals.profit)} accent={calculationTotals.profit >= 0 ? "emerald" : "rose"} icon={TrendingUp} />
              <StatTile label="Aufgaben" value={calculationTotals.taskCount} accent="sand" icon={ListChecks} />
              <StatTile label="Material" value={calculationTotals.materialCount} accent="sand" icon={FolderKanban} />
            </div>
            {calculationGroups.length ? (
              <div className="space-y-4">
                {calculationGroups.map((group) => {
                  return (
                    <section key={group.streamId} className="overflow-hidden rounded-[24px] border border-sand-200 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 bg-sand-50/70 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-sand-900">{group.streamTitle}</div>
                          <div className="mt-0.5 text-xs text-sand-500">
                            {group.tasks.length} Aufgaben
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-sand-200 bg-white text-left text-[11px] uppercase tracking-[0.16em] text-sand-500">
                              <th className="px-4 py-3 font-medium">Position</th>
                              <th className="px-4 py-3 font-medium">Status / Menge</th>
                              <th className="px-4 py-3 font-medium">Regelwert</th>
                              <th className="px-4 py-3 font-medium">Eigenwert</th>
                              <th className="px-4 py-3 font-medium">Kosten</th>
                              <th className="px-4 py-3 font-medium">Effektiv</th>
                              <th className="px-4 py-3 font-medium">Aktion</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-sand-200 bg-sand-50/60">
                              <td colSpan={7} className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-sand-500">
                                Aufgaben
                              </td>
                            </tr>
                            {group.tasks.length ? (
                              group.tasks.map((task) => {
                                const meta = taskStatusMeta[String(task.status || "open").trim().toLowerCase()] || taskStatusMeta.open;
                                return (
                                  <tr key={task.id} className="border-b border-sand-100 align-top last:border-b-0">
                                    <td className="px-4 py-3">
                                      <input
                                        value={task.title || ""}
                                        onChange={(e) =>
                                          mutateStreamById(group.streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) =>
                                              item.id === task.id ? { ...item, title: e.target.value } : item
                                            )
                                          }))
                                        }
                                        className={`${inputClass} px-3 py-2`}
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateStreamById(group.streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) =>
                                              item.id === task.id ? { ...item, status: nextTaskStatus(item.status) } : item
                                            )
                                          }))
                                        }
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${meta.tone}`}
                                      >
                                        {meta.label}
                                      </button>
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        value={task.rule_value || ""}
                                        onChange={(e) =>
                                          mutateStreamById(group.streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) =>
                                              item.id === task.id ? { ...item, rule_value: e.target.value } : item
                                            )
                                          }))
                                        }
                                        className={inputClass}
                                        placeholder="0,00"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        value={task.custom_value || ""}
                                        onChange={(e) =>
                                          mutateStreamById(group.streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) =>
                                              item.id === task.id ? { ...item, custom_value: e.target.value } : item
                                            )
                                          }))
                                        }
                                        className={inputClass}
                                        placeholder="0,00"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        value={task.cost_value || ""}
                                        onChange={(e) =>
                                          mutateStreamById(group.streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).map((item) =>
                                              item.id === task.id ? { ...item, cost_value: e.target.value } : item
                                            )
                                          }))
                                        }
                                        className={inputClass}
                                        placeholder="0,00"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="font-medium text-sand-900">{formatCurrency(task.lineRevenue ?? getEffectivePrice(task))}</div>
                                      <div className={`mt-1 text-xs ${(task.lineRevenue ?? getEffectivePrice(task)) - (task.lineCost ?? getEffectiveCost(task)) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                        Gewinn {formatCurrency((task.lineRevenue ?? getEffectivePrice(task)) - (task.lineCost ?? getEffectiveCost(task)))}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          mutateStreamById(group.streamId, (current) => ({
                                            ...current,
                                            tasks: (current.tasks || []).filter((item) => item.id !== task.id)
                                          }))
                                        }
                                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                                      >
                                        Löschen
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr className="border-b border-sand-100">
                                <td colSpan={7} className="px-4 py-4 text-sm text-sand-400">
                                  Keine Aufgaben vorhanden.
                                </td>
                              </tr>
                            )}

                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
                <section className="overflow-hidden rounded-[24px] border border-sand-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand-200 bg-sand-50/70 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-sand-900">Material</div>
                      <div className="mt-0.5 text-xs text-sand-500">{materialInventory.length} Positionen projektweit</div>
                    </div>
                    <button
                      type="button"
                      onClick={addProjectMaterial}
                      className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-800 hover:bg-sand-50"
                    >
                      <Plus size={14} />
                      Material
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-sand-200 bg-white text-left text-[11px] uppercase tracking-[0.16em] text-sand-500">
                          <th className="px-4 py-3 font-medium">Material</th>
                          <th className="px-4 py-3 font-medium">Status / Menge</th>
                          <th className="px-4 py-3 font-medium">Link</th>
                          <th className="px-4 py-3 font-medium">Preis</th>
                          <th className="px-4 py-3 font-medium">EK</th>
                          <th className="px-4 py-3 font-medium">Effektiv</th>
                          <th className="px-4 py-3 font-medium">Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materialInventory.length ? (
                          materialInventory.map((item) => (
                            <tr key={item.id} className="border-b border-sand-100 align-top last:border-b-0 bg-white">
                              <td className="px-4 py-3">
                                <input
                                  value={item.title || ""}
                                  onChange={(e) =>
                                    mutateFolder((folder) => {
                                      folder.content = folder.content || {};
                                      folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                      folder.content.materials = folder.content.materials.map((row) =>
                                        row.id === item.id ? { ...row, title: e.target.value } : row
                                      );
                                      return folder;
                                    })
                                  }
                                  className={inputClass}
                                  placeholder="Materialposition"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_96px_70px]">
                                  <select
                                    value={normalizeProjectMaterialStatus(item.status)}
                                    onChange={(e) =>
                                      mutateFolder((folder) => {
                                        folder.content = folder.content || {};
                                        folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                        folder.content.materials = folder.content.materials.map((row) =>
                                          row.id === item.id ? { ...row, status: e.target.value } : row
                                        );
                                        return folder;
                                      })
                                    }
                                    className={selectClass}
                                  >
                                    <option value="open">offen</option>
                                    <option value="ordered">bestellt</option>
                                    <option value="received">geliefert</option>
                                  </select>
                                  <input
                                    value={item.quantity || ""}
                                    onChange={(e) =>
                                      mutateFolder((folder) => {
                                        folder.content = folder.content || {};
                                        folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                        folder.content.materials = folder.content.materials.map((row) =>
                                          row.id === item.id ? { ...row, quantity: e.target.value } : row
                                        );
                                        return folder;
                                      })
                                    }
                                    className={inputClass}
                                    placeholder="Menge"
                                  />
                                  <div className="inline-flex items-center justify-center rounded-xl border border-sand-200 bg-sand-50 px-3 text-sm font-medium text-sand-600">
                                    Stück
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    value={item.link || ""}
                                    onChange={(e) =>
                                      mutateFolder((folder) => {
                                        folder.content = folder.content || {};
                                        folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                        folder.content.materials = folder.content.materials.map((row) =>
                                          row.id === item.id ? { ...row, link: e.target.value } : row
                                        );
                                        return folder;
                                      })
                                    }
                                    className={inputClass}
                                    placeholder="https://..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => item.link ? window.open(item.link, "_blank", "noopener,noreferrer") : null}
                                    disabled={!String(item.link || "").trim()}
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sand-200 bg-white text-sand-700 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Materiallink öffnen"
                                    title="Link öffnen"
                                  >
                                    <Link2 size={14} />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="relative">
                                  <input
                                    value={item.price || ""}
                                    onChange={(e) =>
                                      mutateFolder((folder) => {
                                        folder.content = folder.content || {};
                                        folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                        folder.content.materials = folder.content.materials.map((row) =>
                                          row.id === item.id ? { ...row, price: e.target.value } : row
                                        );
                                        return folder;
                                      })
                                    }
                                    onBlur={() =>
                                      mutateFolder((folder) => {
                                        folder.content = folder.content || {};
                                        folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                        folder.content.materials = folder.content.materials.map((row) =>
                                          row.id === item.id ? { ...row, price: formatMoneyInput(row.price) } : row
                                        );
                                        return folder;
                                      })
                                    }
                                    inputMode="decimal"
                                    className={`${inputClass} pr-10 text-right tabular-nums`}
                                    placeholder="0,0 €"
                                  />
                                  <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-sm text-sand-400">€</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="relative">
                                  <input
                                    value={item.purchase_price || ""}
                                    onChange={(e) =>
                                      mutateFolder((folder) => {
                                        folder.content = folder.content || {};
                                        folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                        folder.content.materials = folder.content.materials.map((row) =>
                                          row.id === item.id ? { ...row, purchase_price: e.target.value } : row
                                        );
                                        return folder;
                                      })
                                    }
                                    onBlur={() =>
                                      mutateFolder((folder) => {
                                        folder.content = folder.content || {};
                                        folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                        folder.content.materials = folder.content.materials.map((row) =>
                                          row.id === item.id ? { ...row, purchase_price: formatMoneyInput(row.purchase_price) } : row
                                        );
                                        return folder;
                                      })
                                    }
                                    inputMode="decimal"
                                    className={`${inputClass} pr-10 text-right tabular-nums`}
                                    placeholder="0,0 €"
                                  />
                                  <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-sm text-sand-400">€</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-sand-900">{formatCurrency(item.lineRevenue ?? 0)}</div>
                                <div className={`mt-1 text-xs ${(item.lineRevenue ?? 0) - (item.lineCost ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                  Gewinn {formatCurrency((item.lineRevenue ?? 0) - (item.lineCost ?? 0))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    mutateFolder((folder) => {
                                      folder.content = folder.content || {};
                                      folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                                      folder.content.materials = folder.content.materials.filter((row) => row.id !== item.id);
                                      return folder;
                                    })
                                  }
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
                                >
                                  Löschen
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-4 text-sm text-sand-400">
                              Noch kein Material angelegt.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-sand-300 p-8 text-center text-sm text-sand-500">
                Für die Kalkulation fehlen noch Bausteine.
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {materialOpen && activeFolder ? (
        <Modal title="Materialbedarf" onClose={() => setMaterialOpen(false)} width="max-w-6xl">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-sand-200 bg-sand-50/70 px-4 py-3 text-sm text-sand-700">
              <span>Projektweite Liste aller benötigten Materialien ohne Bausteinbezug.</span>
              <button
                type="button"
                onClick={addProjectMaterial}
                className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-800 hover:bg-sand-50"
              >
                <Plus size={14} />
                Material hinzufügen
              </button>
            </div>
            {materialInventory.length ? (
              <div className="overflow-hidden rounded-[24px] border border-sand-200 bg-white shadow-soft">
                <div className="grid grid-cols-[minmax(0,1.5fr)_120px_140px_minmax(0,1.2fr)_140px_36px] gap-3 border-b border-sand-200 bg-sand-50 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-sand-500">
                  <div>Material</div>
                  <div>Status</div>
                  <div>Menge</div>
                  <div>Link</div>
                  <div>Preis</div>
                  <div />
                </div>
                <div className="divide-y divide-sand-100 bg-white">
                  {materialInventory.map((item) => (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1.5fr)_120px_140px_minmax(0,1.2fr)_140px_36px] gap-3 bg-sand-50/30 px-4 py-3">
                      <div className="rounded-2xl border border-sand-200 bg-white p-2">
                        <input
                          value={item.title || ""}
                          onChange={(e) =>
                            mutateFolder((folder) => {
                              folder.content = folder.content || {};
                              folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                              folder.content.materials = folder.content.materials.map((row) =>
                                row.id === item.id ? { ...row, title: e.target.value } : row
                              );
                              return folder;
                            })
                          }
                          className="w-full border-0 bg-transparent px-2 py-1 text-sm text-sand-900 outline-none"
                          placeholder="z. B. Firewall"
                        />
                      </div>
                      <select
                        value={normalizeProjectMaterialStatus(item.status)}
                        onChange={(e) =>
                          mutateFolder((folder) => {
                            folder.content = folder.content || {};
                            folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                            folder.content.materials = folder.content.materials.map((row) =>
                              row.id === item.id ? { ...row, status: e.target.value } : row
                            );
                            return folder;
                          })
                        }
                        className={selectClass}
                      >
                        <option value="open">offen</option>
                        <option value="ordered">bestellt</option>
                        <option value="received">geliefert</option>
                      </select>
                      <div className="grid grid-cols-[1fr_76px] gap-2">
                        <input
                          value={item.quantity || ""}
                          onChange={(e) =>
                            mutateFolder((folder) => {
                              folder.content = folder.content || {};
                              folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                              folder.content.materials = folder.content.materials.map((row) =>
                                row.id === item.id ? { ...row, quantity: e.target.value } : row
                              );
                              return folder;
                            })
                          }
                          className={inputClass}
                          placeholder="1"
                        />
                        <div className="inline-flex items-center justify-center rounded-xl border border-sand-200 bg-sand-50 px-3 text-sm font-medium text-sand-600">
                          Stück
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={item.link || ""}
                          onChange={(e) =>
                            mutateFolder((folder) => {
                              folder.content = folder.content || {};
                              folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                              folder.content.materials = folder.content.materials.map((row) =>
                                row.id === item.id ? { ...row, link: e.target.value } : row
                              );
                              return folder;
                            })
                          }
                          className={inputClass}
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          onClick={() => item.link ? window.open(item.link, "_blank", "noopener,noreferrer") : null}
                          disabled={!String(item.link || "").trim()}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sand-200 bg-white text-sand-700 hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Materiallink öffnen"
                          title="Link öffnen"
                        >
                          <Link2 size={14} />
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          value={item.price || ""}
                          onChange={(e) =>
                            mutateFolder((folder) => {
                              folder.content = folder.content || {};
                              folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                              folder.content.materials = folder.content.materials.map((row) =>
                                row.id === item.id ? { ...row, price: e.target.value } : row
                              );
                              return folder;
                            })
                          }
                          onBlur={() =>
                            mutateFolder((folder) => {
                              folder.content = folder.content || {};
                              folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                              folder.content.materials = folder.content.materials.map((row) =>
                                row.id === item.id ? { ...row, price: formatMoneyInput(row.price) } : row
                              );
                              return folder;
                            })
                          }
                          inputMode="decimal"
                          className={`${inputClass} pr-10 text-right tabular-nums`}
                          placeholder="0,0 €"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-sm text-sand-400">€</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          mutateFolder((folder) => {
                            folder.content = folder.content || {};
                            folder.content.materials = Array.isArray(folder.content.materials) ? folder.content.materials : [];
                            folder.content.materials = folder.content.materials.filter((row) => row.id !== item.id);
                            return folder;
                          })
                        }
                        className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        aria-label="Material löschen"
                      >
                        <X size={12} className="mx-auto" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-sand-300 p-8 text-center text-sm text-sand-500">
                Noch kein Material erfasst. Beispiel: Firewall, Monitore, PCs, Access Points.
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {timelineOpen && activeFolder ? (
        <Modal title="Timeline" onClose={() => setTimelineOpen(false)} width="max-w-6xl">
          <div className="space-y-4">
            <div className="rounded-[22px] border border-sand-200 bg-sand-50/70 px-4 py-3 text-sm text-sand-700">
              Visualisierung von Bausteinen, Aufgaben und Fertigstellungs-Deadlines. Undatierte Aufgaben bleiben je Baustein sichtbar; datierte Elemente werden zusätzlich auf der Zeitachse verankert.
            </div>
            {timelineData.lanes.some((lane) => lane.datedTasks.length || lane.phases.length || lane.undatedTasks.length) || timelineData.projectDeadline ? (
              <div className="overflow-x-auto rounded-[24px] border border-sand-200 bg-white p-4">
                <div className="min-w-[1100px]">
                  <div className="mb-3 grid grid-cols-[260px_220px_minmax(0,1fr)] gap-3">
                    <div />
                    <div className="text-[10px] uppercase tracking-[0.18em] text-sand-500">Aufgaben ohne Datum</div>
                    <div className="overflow-hidden rounded-xl border border-sand-200 bg-sand-50/70">
                      <div className="relative h-7 border-b border-sand-200 bg-white/70">
                        {timelineData.monthSegments.map((segment) => {
                          const left = (segment.startIndex / timelineData.totalDays) * 100;
                          const width = (Math.max(1, segment.endIndex - segment.startIndex + 1) / timelineData.totalDays) * 100;
                          return (
                            <div
                              key={segment.key}
                              className="absolute inset-y-0 border-r border-sand-200 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-sand-600"
                              style={{ left: `${left}%`, width: `${width}%` }}
                            >
                              <span className="whitespace-nowrap">{segment.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="relative h-12 bg-sand-50">
                        {timelineData.days.map((day) => (
                          <div
                            key={`axis_bg_${day.date.toISOString()}_${day.index}`}
                            className={`absolute inset-y-0 ${day.isWeekend ? "bg-sand-100/80" : ""}`}
                            style={{
                              left: `${day.leftPercent}%`,
                              width: `${100 / timelineData.totalDays}%`
                            }}
                          />
                        ))}
                        {timelineData.days.map((day) => (
                          <div key={`axis_line_${day.date.toISOString()}_${day.index}`} className="absolute inset-y-0" style={{ left: `${day.leftPercent}%` }}>
                            <div className={`h-full border-l ${day.isToday ? "border-rose-400" : day.isWeekStart ? "border-sand-300" : "border-sand-200"}`} />
                          </div>
                        ))}
                        {timelineData.tickDays.map((day) => (
                          <div key={`axis_tick_${day.date.toISOString()}_${day.index}`} className="absolute inset-y-0 -translate-x-1/2" style={{ left: `${day.leftPercent}%` }}>
                            <div className={`mt-1 text-[10px] ${day.isToday ? "font-semibold text-rose-700" : day.isMonthStart || day.isWeekStart ? "font-medium text-sand-700" : "text-sand-500"}`}>
                              {formatAxisDateLabel(day.date, day.isMonthStart || timelineData.totalDays <= 21)}
                            </div>
                            {day.isWeekStart ? <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-sand-400">KW {getIsoWeek(day.date)}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {timelineData.lanes.map((lane) => {
                      const laneHasTimeline = lane.datedTasks.length || lane.phases.length;
                      if (!laneHasTimeline && !lane.undatedTasks.length) return null;
                      return (
                        <div key={lane.streamId} className="grid grid-cols-[260px_220px_minmax(0,1fr)] gap-3">
                          <div className="rounded-xl border border-sand-200 bg-sand-50 px-3 py-3">
                            <div className="text-sm font-semibold text-sand-900">{lane.streamTitle}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Tag className={workflowStatusMeta[lane.workflowStatus]?.tone || workflowStatusMeta.open.tone}>
                                {workflowStatusMeta[lane.workflowStatus]?.label || "offen"}
                              </Tag>
                            </div>
                          </div>
                          <div className="rounded-xl border border-sand-200 bg-sand-50/60 px-3 py-3">
                            {lane.undatedTasks.length ? (
                              <div className="space-y-2">
                                {lane.undatedTasks.map((task) => {
                                  const meta = taskStatusMeta[task.status] || taskStatusMeta.open;
                                  return (
                                    <div key={task.id} className={`rounded-lg border px-2.5 py-2 text-xs ${meta.tone}`}>
                                      {task.title}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-sand-400">Keine</div>
                            )}
                          </div>
                          <div className="relative min-h-[92px] overflow-hidden rounded-xl border border-sand-200 bg-white">
                            {timelineData.days.map((day) => (
                              <div
                                key={`bg_${lane.streamId}_${day.index}`}
                                className={`absolute inset-y-0 ${day.isWeekend ? "bg-sand-50/70" : ""}`}
                                style={{
                                  left: `${day.leftPercent}%`,
                                  width: `${100 / timelineData.totalDays}%`
                                }}
                              />
                            ))}
                            {timelineData.days.map((day) => (
                              <div
                                key={`grid_${lane.streamId}_${day.index}`}
                                className={`absolute inset-y-0 border-l ${day.isToday ? "border-rose-300" : day.isWeekStart ? "border-sand-300" : "border-sand-100"}`}
                                style={{ left: `${day.leftPercent}%` }}
                              />
                            ))}
                            {lane.phases.map((item) => {
                                const startOffset = Math.max(0, diffDays(timelineData.rangeStart, item.startDate));
                                const endOffset = Math.max(startOffset, diffDays(timelineData.rangeStart, item.endDate));
                                const left = (startOffset / timelineData.totalDays) * 100;
                                const width = (Math.max(1, endOffset - startOffset + 1) / timelineData.totalDays) * 100;
                                return (
                                  <div
                                    key={item.id}
                                    className="absolute top-3 h-5 rounded-full bg-sky-100 text-[10px] font-medium text-sky-800"
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                    title={`${item.title} · ${formatDateLabel(item.startDate?.toISOString?.().slice(0, 10) || "")} - ${formatDateLabel(item.endDate?.toISOString?.().slice(0, 10) || "")}`}
                                  >
                                    <div className="truncate px-2 py-0.5">{item.title}</div>
                                  </div>
                                );
                            })}
                            {timelineData.projectDeadline ? (() => {
                              const offset = Math.max(0, diffDays(timelineData.rangeStart, timelineData.projectDeadline));
                              const left = ((offset + 0.5) / timelineData.totalDays) * 100;
                              const daysToDue = diffDays(timelineData.today, timelineData.projectDeadline);
                              const markerClass =
                                daysToDue < 0
                                  ? "border-rose-300 bg-rose-500"
                                  : daysToDue <= 2
                                  ? "border-amber-300 bg-amber-500"
                                  : "border-slate-300 bg-slate-700";
                              return (
                                <div
                                  className="absolute inset-y-0 -translate-x-1/2"
                                  style={{ left: `${left}%` }}
                                  title={`Projekt-Deadline ${formatDateLabel(timelineData.projectDeadlineRaw)}`}
                                >
                                  <div className="mx-auto h-full border-l-2 border-dashed border-rose-300" />
                                  <div className={`absolute top-8 left-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 ${markerClass}`} />
                                  <div className="absolute top-12 left-1/2 w-24 -translate-x-1/2 text-center text-[10px] font-medium text-rose-700">
                                    Projekt-Deadline
                                  </div>
                                </div>
                              );
                            })() : null}
                            {lane.datedTasks.map((item, rowIndex) => {
                              const offset = Math.max(0, diffDays(timelineData.rangeStart, item.date));
                              const left = ((offset + 0.5) / timelineData.totalDays) * 100;
                              const daysToDue = diffDays(timelineData.today, item.date);
                              const markerClass =
                                daysToDue < 0
                                  ? "border-rose-300 bg-rose-500"
                                  : daysToDue <= 2
                                  ? "border-amber-300 bg-amber-500"
                                  : item.status === "blocked"
                                  ? "border-rose-300 bg-rose-500"
                                  : item.status === "waiting_customer"
                                  ? "border-amber-300 bg-amber-500"
                                  : item.status === "done"
                                  ? "border-emerald-300 bg-emerald-500"
                                  : "border-sky-300 bg-sky-500";
                              return (
                                <div
                                  key={item.id}
                                  className="absolute -translate-x-1/2"
                                  style={{ left: `${left}%`, top: `${36 + rowIndex * 18}px` }}
                                  title={`${item.title} · Deadline ${formatDateLabel(item.dueDate)}`}
                                >
                                  <div className={`mx-auto h-3 w-3 rounded-full border-2 ${markerClass}`} />
                                  <div className="mt-1 w-24 -translate-x-1/2 text-center text-[10px] text-sand-700">
                                    {item.title}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-sand-300 p-8 text-center text-sm text-sand-500">
                Für die Timeline fehlen noch Aufgaben, Phasen oder eine Projekt-Deadline.
              </div>
            )}
          </div>
        </Modal>
      ) : null}

      {exportOpen ? (
        <Modal title="Export" onClose={() => setExportOpen(false)} width="max-w-3xl">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Exportprofil</span>
                <select className={selectClass} value={exportProfile} onChange={(e) => applyExportProfile(e.target.value)}>
                  {(catalog.export_profiles || []).map((profile) => (
                    <option key={profile.key} value={profile.key}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Format</span>
                <select className={selectClass} value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
                  <option value="pdf">PDF</option>
                  <option value="word">Word</option>
                  <option value="excel">Excel</option>
                  <option value="html">HTML</option>
                  <option value="md">Markdown</option>
                  <option value="json">JSON</option>
                </select>
              </label>
            </div>
            <div className="grid gap-2 rounded-[24px] border border-sand-200 bg-white p-4">
              {[
                ["include_internal_notes", "Interne Notizen"],
                ["include_risks", "Risiken"],
                ["include_tasks", "Aufgaben"],
                ["include_checklists", "Checklisten"],
                ["include_gantt", "Gantt-Zeitplan"],
                ["include_offer_positions", "Angebotspositionen"],
                ["customer_view", "Kundenansicht"],
                ["internal_view", "Interne Ansicht"]
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-sand-700">
                  <input
                    type="checkbox"
                    checked={Boolean(exportOptions[key])}
                    onChange={(e) => setExportOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-2xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white">
              <Download size={16} />
              Export starten
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
