import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  Bot,
  CheckSquare,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  FolderKanban,
  GitBranch,
  ListChecks,
  Mail,
  MessageSquare,
  Plus,
  ShieldAlert,
  Sparkles,
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

function StatTile({ label, value, accent = "sand", icon: Icon = null }) {
  const accents = {
    sand:    "border-sand-200   bg-white          text-sand-900",
    sky:     "border-sky-200    bg-sky-50         text-sky-800",
    emerald: "border-emerald-200 bg-emerald-50    text-emerald-800",
    amber:   "border-amber-200  bg-amber-50       text-amber-800",
    rose:    "border-rose-200   bg-rose-50        text-rose-800",
  };
  const cls = accents[accent] || accents.sand;
  return (
    <div className={`rounded-2xl border p-3 ${cls}`}>
      <div className="flex items-center justify-between gap-1">
        <div className="text-[10px] uppercase tracking-[0.18em] opacity-60">{label}</div>
        {Icon ? <Icon size={13} className="opacity-40" /> : null}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value ?? "—"}</div>
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
  doing: { label: "läuft", tone: "border-sky-200 bg-sky-50 text-sky-700" },
  done: { label: "fertig", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" }
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
  const explicit = String(stream?.workflow_status || "").trim().toLowerCase();
  if (workflowStatusMeta[explicit]) return explicit;
  const marker = String(stream?.marker || "").trim().toLowerCase();
  if (marker === "blocked") return "blocked";
  if (marker === "feedback") return "feedback";
  if ((stream?.tasks || []).some((item) => String(item?.status || "").trim().toLowerCase() === "doing")) return "doing";
  return "open";
};

const getOpenTaskCount = (stream) =>
  (stream?.tasks || []).filter((item) => String(item?.status || "open").trim().toLowerCase() !== "done").length;

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
    description: "",
    template_key: "",
    block_keys: []
  });
  const [draftFolder, setDraftFolder] = useState(null);
  const [draftSelection, setDraftSelection] = useState({});
  const [createBusy, setCreateBusy] = useState(false);
  const [newStreamTitle, setNewStreamTitle] = useState("");
  const [taskDrafts, setTaskDrafts] = useState({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiDialog, setAiDialog] = useState({ open: false, action: "tasks", topic: "", target: null });
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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
        const firstId = Array.isArray(folderRows) && folderRows[0] ? folderRows[0].id : null;
        setSelectedFolderId((prev) => prev || firstId);
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

  const selectedStream = useMemo(() => {
    if (!activeFolder?.content?.streams?.length) return null;
    return (
      activeFolder.content.streams.find((item) => item.id === selectedStreamId) ||
      activeFolder.content.streams[0] ||
      null
    );
  }, [activeFolder, selectedStreamId]);

  const activeSummary = activeFolder?.summary || { stream_count: 0, progress: 0, open_task_count: 0, risk_count: 0 };
  const activeStreams = activeFolder?.content?.streams || [];
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
  const checklistOpenCount = activeSummary.open_task_count || 0;
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
    return {
      today,
      lanes,
      projectDeadline,
      projectDeadlineRaw,
      rangeStart,
      rangeEnd,
      totalDays
    };
  }, [activeStreams, projectDeadline, projectDeadlineRaw]);
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
      folder.content.streams.unshift(stream);
      setSelectedStreamId(stream.id);
      return appendActivity(folder, `Baustein angelegt: ${stream.title}`);
    });
    setNewStreamTitle("");
  };

  const removeStream = (streamId) => {
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
    mutateStreamById(streamId, (current) => ({
      ...current,
      tasks: [
        { id: uid(), title, status: "open", owner: current.owner || "", due_date: "" },
        ...(current.tasks || [])
      ]
    }));
    setTaskDrafts((prev) => ({ ...prev, [streamId]: "" }));
  };

  const appendActivity = (folder, text) => {
    folder.content.activities = Array.isArray(folder.content.activities) ? folder.content.activities : [];
    folder.content.activities.unshift({ id: uid(), text, at: Date.now() });
    folder.content.activities = folder.content.activities.slice(0, 30);
    return folder;
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,#f5f2eb_0%,#eef4f6_52%,#edf3f2_100%)] p-6">
      <div className="mx-auto max-w-[1380px] space-y-5">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(28,64,89,0.86)_42%,rgba(10,132,255,0.68))] p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-4xl">
              <p className="text-[11px] uppercase tracking-[0.26em] text-sky-100/80">Projektkoordination</p>
              <h1 className="mt-2 font-display text-4xl text-white">Projektmappe</h1>
              <p className="mt-3 max-w-3xl text-sm text-sky-50/85">
                Bausteinorientierte Projektübersicht. Fokus auf Scope, offene Aufgaben und darauf, was noch fehlt, bis das Projekt sauber rund ist.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-sky-50"
              >
                <Plus size={16} />
                Neue Projektmappe
              </button>
              <button
                onClick={() => setExportOpen(true)}
                disabled={!activeFolder}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/20 disabled:opacity-50"
              >
                <Download size={16} />
                Export
              </button>
              <button
                onClick={handleDeleteFolder}
                disabled={!activeFolder}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200/40 bg-rose-500/15 px-4 py-2.5 text-sm text-rose-50 hover:bg-rose-500/25 disabled:opacity-50"
              >
                <Trash2 size={16} />
                Löschen
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            {savingState === "saving" ? (
              <Tag className="border-sky-300/40 bg-sky-400/20 text-sky-100">Speichert…</Tag>
            ) : savingState === "saved" ? (
              <Tag className="border-emerald-300/40 bg-emerald-500/20 text-emerald-100">Gespeichert</Tag>
            ) : savingState === "error" ? (
              <Tag className="border-rose-300/40 bg-rose-500/20 text-rose-100">Speicherfehler</Tag>
            ) : savingState === "pending" ? (
              <Tag className="border-amber-300/40 bg-amber-500/15 text-amber-100">Ausstehend…</Tag>
            ) : null}
            {error ? <Tag className="border-rose-200/40 bg-rose-500/15 text-rose-50">{error}</Tag> : null}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/70 bg-white/78 p-4 shadow-soft backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-sand-500">Projektmappen</div>
              <div className="text-lg font-semibold text-sand-900">Aktive Kundenprojekte</div>
            </div>
            <Tag className="border-sky-200 bg-sky-50 text-sky-700">{folders.length}</Tag>
          </div>
          <div className="grid gap-3 xl:grid-cols-4">
            {folders.map((folder) => {
              const active = folder.id === selectedFolderId;
              const meta = statusMeta[folder.status] || statusMeta.yellow;
              return (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={`overflow-hidden rounded-[20px] border text-left transition ${
                    active ? "border-sand-300 bg-white shadow-soft" : "border-sand-200 bg-white/70 hover:bg-white hover:border-sand-300"
                  }`}
                >
                  <div className={`h-1 w-full ${meta.dot}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-sand-900">{folder.title}</div>
                        <div className="mt-0.5 truncate text-xs text-sand-500">{folder.customer || "Ohne Kunde"}</div>
                      </div>
                      <Tag className={`shrink-0 border ${meta.badge}`}>{meta.label}</Tag>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-sand-100">
                        <div
                          className={`h-1.5 rounded-full ${meta.dot}`}
                          style={{ width: `${Math.max(0, Math.min(100, Number(folder.summary?.progress || 0)))}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[11px] text-sand-500 tabular-nums">
                        {folder.summary?.progress || 0}%
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-sand-500">
                      {folder.summary?.open_task_count || 0} offene Aufgaben
                    </div>
                  </div>
                </button>
              );
            })}
            {!folders.length ? (
              <div className="rounded-[24px] border border-dashed border-sand-300 p-6 text-sm text-sand-500">
                Noch keine Projektmappe vorhanden.
              </div>
            ) : null}
          </div>
        </section>

        {activeFolder ? (
          <div ref={exportRef} className="space-y-5">
            <section className="rounded-[30px] border border-white/70 bg-white/84 p-5 shadow-soft backdrop-blur">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-sand-500">Projektkopf</div>
                      <input
                        className="mt-1 w-full border-0 bg-transparent p-0 font-display text-3xl text-sand-900 outline-none"
                        value={activeFolder.title || ""}
                        onChange={(e) => mutateFolder((folder) => ({ ...folder, title: e.target.value }))}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Tag className={`border ${(statusMeta[activeFolder.status] || statusMeta.yellow).badge}`}>
                          {(statusMeta[activeFolder.status] || statusMeta.yellow).label}
                        </Tag>
                        <Tag className="border-sand-200 bg-sand-50">
                          {priorityMeta[activeFolder.priority] || activeFolder.priority}
                        </Tag>
                        <Tag className="border-sand-200 bg-sand-50">{activeFolder.customer || "Ohne Kunde"}</Tag>
                        <Tag className="border-sand-200 bg-sand-50">{activeFolder.owner || "Niemand zugewiesen"}</Tag>
                        {projectDeadlineRaw ? <Tag className="border-rose-200 bg-rose-50 text-rose-700">Deadline {formatDateLabel(projectDeadlineRaw)}</Tag> : null}
                        {feedbackCount ? <Tag className="border-amber-200 bg-amber-50 text-amber-700">{feedbackCount} Rückmeldungen</Tag> : null}
                        {blockedCount ? <Tag className="border-rose-200 bg-rose-50 text-rose-700">{blockedCount} Blockaden</Tag> : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="rounded-[22px] border border-sand-200 bg-white/90 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Projektlage</span>
                        <AiSparkleButton
                          onClick={() => openAiAssist("summary", activeFolder.title, { scope: "folder", field: "current_state" })}
                          label=""
                          title="Projektlage mit KI befüllen"
                        />
                      </div>
                      <textarea
                        className={`${textareaClass} min-h-[96px] border-0 bg-sand-50/80`}
                        value={activeFolder.current_state || ""}
                        onChange={(e) => mutateFolder((folder) => ({ ...folder, current_state: e.target.value }))}
                      />
                    </label>
                    <label className="rounded-[22px] border border-sand-200 bg-white/90 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Nächster Schritt</span>
                        <AiSparkleButton
                          onClick={() => openAiAssist("handover", activeFolder.title, { scope: "folder", field: "next_step" })}
                          label=""
                          title="Nächsten Schritt mit KI befüllen"
                        />
                      </div>
                      <textarea
                        className={`${textareaClass} min-h-[96px] border-0 bg-sand-50/80`}
                        value={activeFolder.next_step || ""}
                        onChange={(e) => mutateFolder((folder) => ({ ...folder, next_step: e.target.value }))}
                      />
                    </label>
                    <label className="rounded-[22px] border border-sand-200 bg-white/90 p-4 md:col-span-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs uppercase tracking-[0.18em] text-sand-500">Gesamtdeadline</span>
                        {projectDeadlineRaw ? (
                          <Tag className="border-rose-200 bg-rose-50 text-rose-700">{formatDateLabel(projectDeadlineRaw)}</Tag>
                        ) : (
                          <Tag className="border-sand-200 bg-sand-50 text-sand-500">optional</Tag>
                        )}
                      </div>
                      <input
                        type="date"
                        className={inputClass}
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
                  <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-sand-200 bg-sand-50/80 p-2">
                    <button
                      type="button"
                      onClick={() => setOverviewOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-800 hover:bg-sand-50"
                    >
                      <FileText size={15} />
                      Projektübersicht
                    </button>
                    <button
                      type="button"
                      onClick={() => setChecklistOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-800 hover:bg-sand-50"
                    >
                      <ListChecks size={15} />
                      Checkliste
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-800 hover:bg-sand-50"
                    >
                      <GitBranch size={15} />
                      Timeline
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatTile
                    label="Fortschritt"
                    value={`${activeSummary.progress || 0}%`}
                    accent={Number(activeSummary.progress || 0) >= 80 ? "emerald" : Number(activeSummary.progress || 0) >= 40 ? "sky" : "sand"}
                    icon={TrendingUp}
                  />
                  <StatTile
                    label="Bausteine"
                    value={activeSummary.stream_count || 0}
                    accent="sand"
                    icon={FolderKanban}
                  />
                  <StatTile
                    label="Checkliste"
                    value={checklistOpenCount}
                    accent={Number(activeSummary.open_task_count || 0) > 0 ? "amber" : "emerald"}
                    icon={ListChecks}
                  />
                  <StatTile
                    label="Blocker"
                    value={blockerCount}
                    accent={blockerCount > 0 ? "rose" : "emerald"}
                    icon={ShieldAlert}
                  />
                  <StatTile
                    label="Rückmeldungen"
                    value={feedbackCount}
                    accent={feedbackCount > 0 ? "amber" : "sand"}
                    icon={Zap}
                  />
                </div>
              </div>
            </section>

            {selectedStream ? (
              <div className="space-y-4">
                <section className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-soft">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-sand-500">Bausteine</div>
                      <Tag className="border-sand-200 bg-sand-50 text-sand-700">{activeStreams.length}</Tag>
                    </div>
                    <div className="flex flex-1 items-center gap-2 md:max-w-xl md:justify-end">
                      <input
                        className={`${inputClass} flex-1 md:max-w-xs`}
                        value={newStreamTitle}
                        onChange={(e) => setNewStreamTitle(e.target.value)}
                        placeholder="Neuer Baustein, z. B. Firewall, Migration, Backup"
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStream(newStreamTitle); } }}
                      />
                      <button
                        onClick={() => addStream(newStreamTitle)}
                        className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-sand-700 hover:bg-sand-50"
                      >
                        <Plus size={14} />
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                  {activeStreams.length ? (
                    <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                      {activeStreams.map((stream) => {
                        const meta = statusMeta[stream.status] || statusMeta.yellow;
                        const isSelected = stream.id === selectedStreamId;
                        const streamOpenTasks = getOpenTaskCount(stream);
                        const marker = streamMarkerMeta[String(stream.marker || "").trim().toLowerCase()] || null;
                        const streamTasks = Array.isArray(stream.tasks) ? stream.tasks : [];
                        const workflowStatus = getWorkflowStatus(stream);
                        return (
                          <section
                            key={stream.id}
                            className={`rounded-[24px] border p-4 text-left transition ${
                              isSelected
                                ? "border-slate-900 bg-slate-900 text-white shadow-soft"
                                : "border-sand-200 bg-white hover:border-sand-300"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <input
                                    value={stream.title || ""}
                                    onFocus={() => setSelectedStreamId(stream.id)}
                                    onChange={(e) =>
                                      mutateStreamById(stream.id, (current) => ({ ...current, title: e.target.value }))
                                    }
                                    className={`w-full border-0 bg-transparent p-0 text-base font-semibold outline-none ${
                                      isSelected ? "text-white placeholder:text-sky-100/70" : "text-sand-900 placeholder:text-sand-400"
                                    }`}
                                    placeholder="Baustein"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeStream(stream.id)}
                                    className={`rounded-full border p-1.5 ${
                                      isSelected
                                        ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                                        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                    }`}
                                    aria-label="Baustein löschen"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                                <div className={`mt-1 text-xs ${isSelected ? "text-sky-100/80" : "text-sand-600"}`}>
                                  {stream.short_status || getPrimaryGap(stream) || "—"}
                                </div>
                              </div>
                              <span className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              {marker ? <Tag className={isSelected ? "border-white/20 bg-white/10 text-white" : marker.tone}>{marker.label}</Tag> : null}
                              <Tag className={isSelected ? "border-white/20 bg-white/10 text-white" : `border ${meta.badge}`}>
                                {meta.label}
                              </Tag>
                              <Tag className={isSelected ? "border-white/20 bg-white/10 text-white" : workflowStatusMeta[workflowStatus]?.tone || workflowStatusMeta.open.tone}>
                                {workflowStatusMeta[workflowStatus]?.label || "offen"}
                              </Tag>
                              <Tag className={isSelected ? "border-white/20 bg-white/10 text-white" : "border-sand-200 bg-sand-50 text-sand-700"}>
                                {stream.progress || 0}%
                              </Tag>
                              {streamOpenTasks > 0 ? (
                                <Tag className={isSelected ? "border-white/20 bg-white/10 text-white" : "border-amber-200 bg-amber-50 text-amber-700"}>
                                  {streamOpenTasks} Aufg.
                                </Tag>
                              ) : null}
                            </div>
                            <div className="mt-3">
                              <select
                                value={workflowStatus}
                                onFocus={() => setSelectedStreamId(stream.id)}
                                onChange={(e) =>
                                  mutateStreamById(stream.id, (current) => {
                                    const nextWorkflow = String(e.target.value || "open").trim().toLowerCase();
                                    return {
                                      ...current,
                                      workflow_status: nextWorkflow,
                                      marker:
                                        nextWorkflow === "feedback"
                                          ? "feedback"
                                          : nextWorkflow === "blocked"
                                          ? "blocked"
                                          : "",
                                    };
                                  })
                                }
                                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                                  isSelected
                                    ? "border-white/15 bg-white/10 text-white"
                                    : "border-sand-200 bg-white text-sand-900"
                                }`}
                              >
                                <option value="open">offen</option>
                                <option value="doing">laufend</option>
                                <option value="feedback">Rückmeldung</option>
                                <option value="blocked">Blockade</option>
                              </select>
                            </div>
                            <div className="mt-4 rounded-[20px] border border-black/5 bg-black/5 p-3">
                              <div className="flex items-center gap-2">
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
                                  className={`flex-1 rounded-xl border px-3 py-2 text-sm outline-none ${
                                    isSelected
                                      ? "border-white/15 bg-white/10 text-white placeholder:text-sky-100/60"
                                      : "border-sand-200 bg-white text-sand-900"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => addTaskToStream(stream)}
                                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs ${
                                    isSelected
                                      ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                                      : "border-sand-200 bg-white text-sand-700 hover:bg-sand-50"
                                  }`}
                                >
                                  <Plus size={13} />
                                  Neu
                                </button>
                              </div>
                              <div className="mt-3 space-y-2">
                                {streamTasks.length ? (
                                  streamTasks.map((task) => {
                                    const taskMeta = taskStatusMeta[String(task.status || "open").trim().toLowerCase()] || taskStatusMeta.open;
                                    const isDone = String(task.status || "open").trim().toLowerCase() === "done";
                                    return (
                                      <div
                                        key={task.id}
                                        className={`rounded-xl border px-3 py-2 ${
                                          isSelected ? "border-white/10 bg-white/10" : taskMeta.tone
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              mutateStreamById(stream.id, (current) => ({
                                                ...current,
                                                tasks: (current.tasks || []).map((item) =>
                                                  item.id === task.id
                                                    ? { ...item, status: isDone ? "open" : "done" }
                                                    : item
                                                )
                                              }))
                                            }
                                            className={`flex min-w-0 flex-1 items-center gap-2 text-left text-sm ${
                                              isSelected ? "text-white" : isDone ? "text-sand-500 line-through" : "text-sand-800"
                                            }`}
                                          >
                                            <span
                                              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                                isSelected
                                                  ? "border-white/25 bg-white/10"
                                                  : isDone
                                                  ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                                  : "border-sand-300 bg-white text-sand-400"
                                              }`}
                                            >
                                              {isDone ? "✓" : ""}
                                            </span>
                                            <span className="truncate">{task.title || "Aufgabe"}</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              mutateStreamById(stream.id, (current) => ({
                                                ...current,
                                                tasks: (current.tasks || []).filter((item) => item.id !== task.id)
                                              }))
                                            }
                                            className={`rounded-full border p-1.5 ${
                                              isSelected
                                                ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                                                : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                            }`}
                                            aria-label="Aufgabe löschen"
                                          >
                                            <X size={11} />
                                          </button>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                          <span className={`text-[11px] ${isSelected ? "text-sky-100/70" : "text-sand-500"}`}>Deadline</span>
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
                                            className={`min-w-0 rounded-lg border px-2.5 py-1.5 text-xs outline-none ${
                                              isSelected
                                                ? "border-white/15 bg-white/10 text-white"
                                                : "border-sand-200 bg-white text-sand-900"
                                            }`}
                                          />
                                          {task.due_date ? (
                                            <span className={`text-[11px] ${isSelected ? "text-sky-100/70" : "text-sand-500"}`}>
                                              {formatDateLabel(task.due_date)}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className={`text-sm ${isSelected ? "text-sky-100/80" : "text-sand-500"}`}>
                                    Noch keine Aufgaben angelegt.
                                  </div>
                                )}
                              </div>
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-sand-300 p-5 text-sm text-sand-500">
                      Noch keine Bausteine vorhanden.
                    </div>
                  )}
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-[30px] border border-white/70 bg-white/84 p-4 shadow-soft">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs uppercase tracking-[0.2em] text-sand-500">Baustein</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                          className="w-full max-w-[320px] border-0 bg-transparent p-0 font-display text-2xl text-sand-900 outline-none"
                          value={selectedStream.title || ""}
                          onChange={(e) => mutateSelectedStream((stream) => ({ ...stream, title: e.target.value }))}
                        />
                        <Tag className={`border ${(statusMeta[selectedStream.status] || statusMeta.yellow).badge}`}>
                          {(statusMeta[selectedStream.status] || statusMeta.yellow).label}
                        </Tag>
                        <Tag className="border-sand-200 bg-sand-50 text-sand-700">{selectedStream.progress || 0}%</Tag>
                        {String(selectedStream.marker || "").trim() ? (
                          <Tag className={streamMarkerMeta[String(selectedStream.marker || "").trim().toLowerCase()]?.tone || "border-sand-200 bg-sand-50 text-sand-700"}>
                            {streamMarkerMeta[String(selectedStream.marker || "").trim().toLowerCase()]?.label || selectedStream.marker}
                          </Tag>
                        ) : null}
                      </div>
                    </div>
                    <select
                      className={`${selectClass} min-w-[120px]`}
                      value={selectedStream.status || "yellow"}
                      onChange={(e) => mutateSelectedStream((stream) => ({ ...stream, status: e.target.value }))}
                    >
                      {Object.entries(statusMeta).map(([key, m]) => (
                        <option key={key} value={key}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(streamMarkerMeta).map(([key, meta]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          mutateSelectedStream((stream) => ({
                            ...stream,
                            marker: String(stream.marker || "").trim().toLowerCase() === key ? "" : key
                          }))
                        }
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                          String(selectedStream.marker || "").trim().toLowerCase() === key
                            ? meta.tone
                            : "border-sand-200 bg-white text-sand-700"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => mutateSelectedStream((stream) => ({ ...stream, marker: "" }))}
                      className="inline-flex items-center rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-sand-600"
                    >
                      Marker löschen
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <SectionCard
                      title="Aufgaben"
                      icon={ListChecks}
                      action={
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              mutateSelectedStream((stream) => ({
                                ...stream,
                                tasks: [...(stream.tasks || []), { id: uid(), title: "Neue Aufgabe", status: "open", owner: stream.owner || "", due_date: "" }]
                              }))
                            }
                            className="rounded-xl border border-sand-200 px-2.5 py-1 text-xs text-sand-700"
                          >
                            + Aufgabe
                          </button>
                          <AiSparkleButton
                            onClick={() => openAiAssist("tasks", selectedStream.title || activeFolder.title, { scope: "stream", field: "tasks" })}
                            label=""
                            title="Aufgaben mit KI vorschlagen"
                          />
                        </div>
                      }
                    >
                      {(selectedStream.tasks || []).length ? (
                        <div className="space-y-2">
                          {(selectedStream.tasks || []).map((task) => (
                            <div key={task.id} className="rounded-2xl border border-sand-200 bg-white/90 p-3">
                              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_92px_110px_36px]">
                                <input
                                  className={inputClass}
                                  value={task.title || ""}
                                  onChange={(e) =>
                                    mutateSelectedStream((stream) => ({
                                      ...stream,
                                      tasks: stream.tasks.map((item) => (item.id === task.id ? { ...item, title: e.target.value } : item))
                                    }))
                                  }
                                />
                                <select
                                  className={selectClass}
                                  value={task.status || "open"}
                                  onChange={(e) =>
                                    mutateSelectedStream((stream) => ({
                                      ...stream,
                                      tasks: stream.tasks.map((item) => (item.id === task.id ? { ...item, status: e.target.value } : item))
                                    }))
                                  }
                                >
                                  <option value="open">offen</option>
                                  <option value="doing">läuft</option>
                                  <option value="done">fertig</option>
                                </select>
                                <input
                                  list="project-folder-employees"
                                  className={inputClass}
                                  value={task.owner || ""}
                                  onChange={(e) =>
                                    mutateSelectedStream((stream) => ({
                                      ...stream,
                                      tasks: stream.tasks.map((item) => (item.id === task.id ? { ...item, owner: e.target.value } : item))
                                    }))
                                  }
                                />
                                <button
                                  onClick={() =>
                                    mutateSelectedStream((stream) => ({
                                      ...stream,
                                      tasks: stream.tasks.filter((item) => item.id !== task.id)
                                    }))
                                  }
                                  className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
                                >
                                  <Trash2 size={14} className="mx-auto" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-sand-500">Noch keine Aufgaben angelegt.</div>
                      )}
                    </SectionCard>

                    <details className="rounded-[20px] border border-sand-200 bg-white/90 p-4">
                      <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-sand-500">
                        Weitere Angaben
                      </summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-[11px] uppercase tracking-[0.18em] text-sand-500">Kurzlage</span>
                          <textarea
                            className={`${textareaClass} min-h-[72px] border-0 bg-sand-50/80`}
                            value={selectedStream.short_status || ""}
                            onChange={(e) => mutateSelectedStream((stream) => ({ ...stream, short_status: e.target.value }))}
                            placeholder="Wie ist der aktuelle Stand dieses Bausteins?"
                          />
                        </label>
                        <div className="space-y-3">
                          <label className="block rounded-[20px] border border-sand-200 bg-white/90 p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-[11px] uppercase tracking-[0.18em] text-sand-500">Empfehlung</span>
                              <AiSparkleButton
                                onClick={() => openAiAssist("summary", selectedStream.title || activeFolder.title, { scope: "stream", field: "recommendation" })}
                                label=""
                                title="Empfehlung mit KI befüllen"
                              />
                            </div>
                            <textarea
                              className={`${textareaClass} min-h-[60px] border-0 bg-sand-50/80`}
                              value={selectedStream.recommendation || ""}
                              onChange={(e) => mutateSelectedStream((stream) => ({ ...stream, recommendation: e.target.value }))}
                              placeholder="Was empfehlen wir dem Kunden?"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-sand-500">Zuständig</span>
                            <input
                              list="project-folder-employees"
                              className={inputClass}
                              value={selectedStream.owner || ""}
                              onChange={(e) => mutateSelectedStream((stream) => ({ ...stream, owner: e.target.value }))}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-sand-500">Fortschritt %</span>
                            <input
                              type="number" min="0" max="100"
                              className={inputClass}
                              value={selectedStream.progress ?? 0}
                              onChange={(e) =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  progress: Math.max(0, Math.min(100, Number(e.target.value || 0)))
                                }))
                              }
                            />
                          </label>
                        </div>
                      </div>
                    </details>

                    <details className="rounded-[20px] border border-sand-200 bg-white/90 p-4">
                      <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-sand-500">
                        Zusätzliche Angaben
                      </summary>
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] uppercase tracking-[0.18em] text-sand-500">Nächster Schritt</span>
                              <AiSparkleButton
                                onClick={() => openAiAssist("handover", selectedStream.title || activeFolder.title, { scope: "stream", field: "next_step" })}
                                label=""
                                title="Nächsten Schritt mit KI"
                              />
                            </div>
                            <input
                              className={inputClass}
                              value={selectedStream.next_step || ""}
                              onChange={(e) => mutateSelectedStream((stream) => ({ ...stream, next_step: e.target.value }))}
                              placeholder="Was ist konkret als nächstes zu tun?"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-sand-500">Kundenentscheidung</span>
                            <input
                              className={inputClass}
                              value={selectedStream.customer_decision || ""}
                              onChange={(e) => mutateSelectedStream((stream) => ({ ...stream, customer_decision: e.target.value }))}
                              placeholder="Was muss der Kunde entscheiden?"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-700"
                          onClick={() =>
                            mutateSelectedStream((stream) => ({
                              ...stream,
                              tasks: [...(stream.tasks || []), { id: uid(), title: "Neue Aufgabe", status: "open", owner: stream.owner || "", due_date: "" }]
                            }))
                          }
                        >
                          <Plus size={14} />
                          Aufgabe direkt hier anlegen
                        </button>
                      </div>
                    </details>
                  </div>
                </section>

                <div className="space-y-4">
                  <SectionCard title="Gesamtübersicht" icon={FolderKanban}>
                    <div className="grid gap-3">
                      <div className={`rounded-[20px] border p-4 ${
                        readinessGapCount <= 0
                          ? "border-emerald-200 bg-emerald-50"
                          : readinessGapCount <= 3
                          ? "border-amber-200 bg-amber-50"
                          : "border-rose-200 bg-rose-50"
                      }`}>
                        <div className={`text-[10px] uppercase tracking-[0.2em] ${
                          readinessGapCount <= 0 ? "text-emerald-600" : readinessGapCount <= 3 ? "text-amber-700" : "text-rose-700"
                        }`}>Bis rund</div>
                        <div className={`mt-1.5 text-base font-semibold ${
                          readinessGapCount <= 0 ? "text-emerald-800" : readinessGapCount <= 3 ? "text-amber-900" : "text-rose-900"
                        }`}>{projectPulseLabel}</div>
                        {waitingStreams.length ? (
                          <div className="mt-1 text-xs text-sand-600">
                            {waitingStreams.length} {waitingStreams.length === 1 ? "Baustein braucht" : "Bausteine brauchen"} Aufmerksamkeit.
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-emerald-700">Alle Bausteine grün.</div>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-sand-200 bg-white px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-sand-500">Checkliste</div>
                          <div className="mt-1 text-2xl font-semibold text-sand-900">{checklistOpenCount}</div>
                          <div className="mt-1 text-xs text-sand-500">Offene Aufgaben im Projekt.</div>
                        </div>
                        <div className="rounded-2xl border border-sand-200 bg-white px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-sand-500">Bausteine</div>
                          <div className="mt-1 text-2xl font-semibold text-sand-900">{activeSummary.stream_count || 0}</div>
                          <div className="mt-1 text-xs text-sand-500">Scope und Struktur.</div>
                        </div>
                        <div className="rounded-2xl border border-sand-200 bg-white px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-sand-500">Blockiert / Wartet</div>
                          <div className="mt-1 text-2xl font-semibold text-sand-900">{blockerCount + feedbackCount + blockedCount}</div>
                          <div className="mt-1 text-xs text-sand-500">Rückmeldung oder Blockade.</div>
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-sand-200 bg-white/90 p-4">
                        <div className="mb-3 text-xs uppercase tracking-[0.18em] text-sand-500">Aktuelle Aufgaben</div>
                        {focusTasks.length ? (
                          <div className="space-y-2">
                            {focusTasks.map((task) => {
                              const meta = taskStatusMeta[task.status] || taskStatusMeta.open;
                              return (
                                <div key={task.id} className="rounded-2xl border border-sand-200 bg-sand-50/70 px-3 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-medium text-sand-900">{task.title}</div>
                                      <div className="mt-1 text-xs text-sand-500">{task.stream_title}</div>
                                    </div>
                                    <Tag className={meta.tone}>{meta.label}</Tag>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-sand-500">Keine offenen Aufgaben mehr.</div>
                        )}
                      </div>
                    </div>
                  </SectionCard>

                  <details className="rounded-[26px] border border-white/70 bg-white/82 p-4 shadow-soft">
                    <summary className="cursor-pointer text-sm font-semibold text-sand-900">
                      Mehr Details zu Risiken, Blockern und Dateien
                    </summary>
                    <div className="mt-4 space-y-4">
                      <SectionCard
                        title="Risiken und Blocker"
                        icon={AlertTriangle}
                        action={
                          <>
                            <button
                              onClick={() =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  risks: [...(stream.risks || []), { id: uid(), title: "Neues Risiko", level: "mittel", mitigation: "" }]
                                }))
                              }
                              className="rounded-xl border border-sand-200 px-2.5 py-1 text-xs text-sand-700"
                            >
                              + Risiko
                            </button>
                            <AiSparkleButton
                              onClick={() => openAiAssist("risks", selectedStream.title || activeFolder.title, { scope: "stream", field: "risks" })}
                              label=""
                              title="Risiken mit KI vorschlagen"
                            />
                          </>
                        }
                      >
                        {(selectedStream.risks || []).map((risk) => (
                          <div key={risk.id} className="grid grid-cols-[1fr_92px_36px] gap-2">
                            <input
                              className={inputClass}
                              value={risk.title || ""}
                              onChange={(e) =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  risks: stream.risks.map((item) => (item.id === risk.id ? { ...item, title: e.target.value } : item))
                                }))
                              }
                            />
                            <select
                              className={selectClass}
                              value={risk.level || "mittel"}
                              onChange={(e) =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  risks: stream.risks.map((item) => (item.id === risk.id ? { ...item, level: e.target.value } : item))
                                }))
                              }
                            >
                              <option value="niedrig">niedrig</option>
                              <option value="mittel">mittel</option>
                              <option value="hoch">hoch</option>
                            </select>
                            <button
                              onClick={() =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  risks: stream.risks.filter((item) => item.id !== risk.id)
                                }))
                              }
                              className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
                            >
                              <Trash2 size={14} className="mx-auto" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            mutateSelectedStream((stream) => ({
                              ...stream,
                              blockers: [...(stream.blockers || []), { id: uid(), title: "Neuer Blocker", owner: stream.owner || "" }]
                            }))
                          }
                          className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-700"
                        >
                          + Blocker
                        </button>
                        {(selectedStream.blockers || []).map((blocker) => (
                          <div key={blocker.id} className="grid grid-cols-[1fr_120px_36px] gap-2">
                            <input
                              className={inputClass}
                              value={blocker.title || ""}
                              onChange={(e) =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  blockers: stream.blockers.map((item) => (item.id === blocker.id ? { ...item, title: e.target.value } : item))
                                }))
                              }
                            />
                            <input
                              list="project-folder-employees"
                              className={inputClass}
                              value={blocker.owner || ""}
                              onChange={(e) =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  blockers: stream.blockers.map((item) => (item.id === blocker.id ? { ...item, owner: e.target.value } : item))
                                }))
                              }
                            />
                            <button
                              onClick={() =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  blockers: stream.blockers.filter((item) => item.id !== blocker.id)
                                }))
                              }
                              className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
                            >
                              <Trash2 size={14} className="mx-auto" />
                            </button>
                          </div>
                        ))}
                      </SectionCard>

                      <SectionCard title="Dateien und Aktivitäten" icon={FileText}>
                        <button
                          onClick={() =>
                            mutateSelectedStream((stream) => ({
                              ...stream,
                              files: [...(stream.files || []), { id: uid(), title: "Neue Datei", url: "" }]
                            }))
                          }
                          className="rounded-xl border border-sand-200 px-3 py-2 text-xs text-sand-700"
                        >
                          + Datei
                        </button>
                        {(selectedStream.files || []).map((file) => (
                          <div key={file.id} className="grid grid-cols-[1fr_1fr_36px] gap-2">
                            <input
                              className={inputClass}
                              value={file.title || ""}
                              onChange={(e) =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  files: stream.files.map((item) => (item.id === file.id ? { ...item, title: e.target.value } : item))
                                }))
                              }
                            />
                            <input
                              className={inputClass}
                              value={file.url || ""}
                              placeholder="Pfad oder URL"
                              onChange={(e) =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  files: stream.files.map((item) => (item.id === file.id ? { ...item, url: e.target.value } : item))
                                }))
                              }
                            />
                            <button
                              onClick={() =>
                                mutateSelectedStream((stream) => ({
                                  ...stream,
                                  files: stream.files.filter((item) => item.id !== file.id)
                                }))
                              }
                              className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
                            >
                              <Trash2 size={14} className="mx-auto" />
                            </button>
                          </div>
                        ))}
                        {(globalActivities || []).slice(0, 5).map((activity) => (
                          <div key={activity.id} className="rounded-2xl border border-sand-200 bg-sand-50/70 px-3 py-2">
                            <div className="text-sm text-sand-800">{activity.text}</div>
                            <div className="mt-1 text-xs text-sand-500">{formatDateTime(activity.at)}</div>
                          </div>
                        ))}
                      </SectionCard>
                    </div>
                  </details>
                </div>
                </div>
              </div>
            ) : (
              <section className="rounded-[28px] border border-dashed border-sand-300 bg-white/80 p-10 text-center text-sand-600 shadow-soft">
                Einen Baustein auswählen oder neu anlegen.
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
                label="Offene Aufgaben"
                value={activeSummary.open_task_count || 0}
                accent={Number(activeSummary.open_task_count || 0) > 0 ? "amber" : "emerald"}
                icon={ListChecks}
              />
              <StatTile
                label="Blocker"
                value={blockerCount}
                accent={blockerCount > 0 ? "rose" : "emerald"}
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
                  const marker = streamMarkerMeta[String(stream.marker || "").trim().toLowerCase()] || null;
                  const workflowStatus = getWorkflowStatus(stream);
                  return (
                    <div key={stream.id} className="rounded-[22px] border border-sand-200 bg-sand-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-sand-900">{stream.title || "Baustein"}</div>
                          <div className="mt-1 text-xs text-sand-600">{stream.short_status || getPrimaryGap(stream) || "—"}</div>
                        </div>
                        <span className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Tag className={`border ${meta.badge}`}>{meta.label}</Tag>
                        <Tag className={workflowStatusMeta[workflowStatus]?.tone || workflowStatusMeta.open.tone}>
                          {workflowStatusMeta[workflowStatus]?.label || "offen"}
                        </Tag>
                        <Tag className="border-sand-200 bg-white text-sand-700">{stream.progress || 0}%</Tag>
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
              <div className="space-y-4">
                {groupedChecklistTasks.map((group) => (
                  <section key={group.id} className="rounded-[24px] border border-sand-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-sand-900">{group.title}</div>
                        <div className="mt-1 text-xs text-sand-500">{group.openCount} offen · {group.tasks.length} gesamt</div>
                      </div>
                      <Tag className={workflowStatusMeta[getWorkflowStatus(activeStreams.find((stream) => stream.id === group.id) || {})]?.tone || workflowStatusMeta.open.tone}>
                        {workflowStatusMeta[getWorkflowStatus(activeStreams.find((stream) => stream.id === group.id) || {})]?.label || "offen"}
                      </Tag>
                    </div>
                    <div className="mt-3 space-y-2">
                      {group.tasks.map((task) => {
                        const statusKey = String(task?.status || "open").trim().toLowerCase();
                        const meta = taskStatusMeta[statusKey] || taskStatusMeta.open;
                        return (
                          <div key={task.id} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${meta.tone}`}>
                            <div className="min-w-0 flex items-center gap-2">
                              <span
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                  statusKey === "done"
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                    : "border-sand-300 bg-white text-sand-400"
                                }`}
                              >
                                {statusKey === "done" ? "✓" : ""}
                              </span>
                              <span className={`truncate text-sm ${statusKey === "done" ? "line-through" : ""}`}>{task.title || "Aufgabe"}</span>
                            </div>
                            <Tag className={meta.tone}>{meta.label}</Tag>
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
                    <div className="relative h-10 rounded-xl bg-sand-50">
                      {Array.from({ length: timelineData.totalDays }).map((_, index) => {
                        const current = new Date(timelineData.rangeStart);
                        current.setDate(current.getDate() + index);
                        const left = `${(index / timelineData.totalDays) * 100}%`;
                        const isToday = diffDays(current, timelineData.today) === 0;
                        return (
                          <div key={`${current.toISOString()}_${index}`} className="absolute inset-y-0" style={{ left }}>
                            <div className={`h-full border-l ${isToday ? "border-rose-400" : "border-sand-200"}`} />
                            <div className={`mt-1 -translate-x-1/2 text-[10px] ${isToday ? "font-semibold text-rose-700" : "text-sand-500"}`}>
                              {current.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                            </div>
                          </div>
                        );
                      })}
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
                          <div className="relative min-h-[92px] rounded-xl border border-sand-200 bg-white">
                            {Array.from({ length: timelineData.totalDays }).map((_, index) => (
                              <div
                                key={`grid_${lane.streamId}_${index}`}
                                className="absolute inset-y-0 border-l border-sand-100"
                                style={{ left: `${(index / timelineData.totalDays) * 100}%` }}
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
