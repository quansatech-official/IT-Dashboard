import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  DollarSign,
  Heart,
  Loader2,
  Mail,
  Pin,
  Play,
  Plus,
  Sparkles,
  Square,
  Star,
  Trash2,
  Undo2,
  X
} from "lucide-react";

const API = "/api";

const api = {
  list: () => fetch(`${API}/day_tasks`).then((r) => r.json()),
  customers: () => fetch(`${API}/customers`).then((r) => r.json()),
  groups: () => fetch(`${API}/day_task_groups`).then((r) => r.json()),
  create: (payload) =>
    fetch(`${API}/day_tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  update: (id, payload) =>
    fetch(`${API}/day_tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  toggleTimeTask: (id) =>
    fetch(`${API}/day_tasks/${id}/toggle_timer`, { method: "PATCH" }).then((r) => r.json()),
  remove: (id) => fetch(`${API}/day_tasks/${id}`, { method: "DELETE" }),
  analyzeEmailDraft: (payload) =>
    fetch(`${API}/day_tasks/email_draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  estimateTaskScope: (id, payload) =>
    fetch(`${API}/day_tasks/${id}/scope_estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    }).then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.detail || "Arbeitsumfang konnte nicht analysiert werden.");
      }
      return data;
    }),
  createGroup: (payload) =>
    fetch(`${API}/day_task_groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  updateGroup: (id, payload) =>
    fetch(`${API}/day_task_groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  removeGroup: (id) => fetch(`${API}/day_task_groups/${id}`, { method: "DELETE" })
};

const columns = [{ id: "todo", label: "Aufgaben" }];
const NEW_TASK_HIGHLIGHT_MS = 60 * 1000;
const formatDoneDate = (value) => {
  const date = new Date(Number(value || 0));
  if (!value || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

const openSinceDays = (value) => {
  const ts = Number(value || 0);
  if (!ts) return "";
  const ms = Date.now() - ts;
  if (ms < 0) return "";
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

const URGENCY_FLAG_OPTIONS = [
  { value: "red", label: "Stillstand", dotClass: "border-rose-300 bg-rose-500" },
  { value: "orange", label: "Eingeschränkt", dotClass: "border-amber-300 bg-amber-500" },
  { value: "green", label: "Komfortproblem", dotClass: "border-emerald-300 bg-emerald-500" },
  { value: "blue", label: "Warten auf Rückmeldung", dotClass: "border-sky-300 bg-sky-500" }
];

const URGENCY_FLAG_LOOKUP = URGENCY_FLAG_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option;
  return acc;
}, {});

const URGENCY_SORT_WEIGHT = {
  red: 4,
  orange: 3,
  blue: 2,
  green: 1,
  "": 0
};

const normalizeUrgencyFlag = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const aliases = {
    rot: "red",
    stillstand: "red",
    red: "red",
    orange: "orange",
    eingeschrankt: "orange",
    eingeschränkt: "orange",
    gruen: "green",
    grün: "green",
    green: "green",
    komfortproblem: "green",
    blau: "blue",
    blue: "blue",
    "warten auf rueckmeldung": "blue",
    "warten auf rückmeldung": "blue",
    rueckmeldung: "blue",
    rückmeldung: "blue"
  };
  return aliases[raw] || "";
};

const getUrgencyMeta = (value) => {
  const normalized = normalizeUrgencyFlag(value);
  return URGENCY_FLAG_LOOKUP[normalized] || null;
};

const getNextUrgencyFlag = (value) => {
  const order = ["", "red", "orange", "green", "blue"];
  const current = normalizeUrgencyFlag(value);
  const index = order.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  return order[(safeIndex + 1) % order.length];
};

export default function DayPlanView() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupDrafts, setGroupDrafts] = useState({});
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupTitle, setEditingGroupTitle] = useState("");
  const [dragOver, setDragOver] = useState("");
  const [dragOverGroupId, setDragOverGroupId] = useState(null);
  const [suggestionOpenId, setSuggestionOpenId] = useState(null);
  const [suggestionQuery, setSuggestionQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editingCustomerValue, setEditingCustomerValue] = useState("");
  const [employeeMenuOpenId, setEmployeeMenuOpenId] = useState(null);
  const [customerFilter, setCustomerFilter] = useState("");
  const [contentFilter, setContentFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [openSinceFilter, setOpenSinceFilter] = useState("");
  const [openSort, setOpenSort] = useState("name");
  const [doneFilter, setDoneFilter] = useState("");
  const [billedFilter, setBilledFilter] = useState("");
  const [showKulantDone, setShowKulantDone] = useState(false);
  const [detailOpenId, setDetailOpenId] = useState(null);
  const [detailEdits, setDetailEdits] = useState({});
  const [sevdeskDefaults, setSevdeskDefaults] = useState({
    hourly_rate_eur: "",
    default_tax_rate: "",
    unity_id: "",
    service_unity_id: "",
    contact_person_id: "",
    address_country_id: "",
    tax_rule_id: "",
    has_sevdesk_api_token: false
  });
  const [sevdeskTokenAvailable, setSevdeskTokenAvailable] = useState(false);
  const [sevdeskDraftOpen, setSevdeskDraftOpen] = useState(false);
  const [sevdeskDraftTask, setSevdeskDraftTask] = useState(null);
  const [sevdeskDraftForm, setSevdeskDraftForm] = useState(null);
  const [sevdeskDraftAdvancedOpen, setSevdeskDraftAdvancedOpen] = useState(false);
  const [sevdeskDraftStatus, setSevdeskDraftStatus] = useState({ state: "idle", error: "" });
  const [sevdeskDraftAiLoading, setSevdeskDraftAiLoading] = useState(false);
  const [sevdeskDraftCheck, setSevdeskDraftCheck] = useState({
    state: "idle",
    hasDraft: false,
    contactFound: true
  });
  const [sevdeskDraftMetrics, setSevdeskDraftMetrics] = useState(null);
  const [sevdeskDraftMetricsStatus, setSevdeskDraftMetricsStatus] = useState("idle");
  const [sevdeskDraftEstimate, setSevdeskDraftEstimate] = useState(null);
  const [sevdeskDraftEstimateStatus, setSevdeskDraftEstimateStatus] = useState({
    state: "idle",
    error: ""
  });
  const [collapsedTimers, setCollapsedTimers] = useState(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("qt_dayplan_collapsed_timers");
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  });
  const [timeEdits, setTimeEdits] = useState({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [emailDropHover, setEmailDropHover] = useState(false);
  const [emailDropBusy, setEmailDropBusy] = useState(false);
  const [emailTaskDraft, setEmailTaskDraft] = useState(null);
  const [emailTaskModalOpen, setEmailTaskModalOpen] = useState(false);
  const [emailTaskAnalyzing, setEmailTaskAnalyzing] = useState(false);
  const [emailTaskError, setEmailTaskError] = useState("");
  const [emailTaskSaving, setEmailTaskSaving] = useState(false);
  const emailDropGuardRef = useRef(0);
  const emailDropBadgeRef = useRef(null);
  const sevdeskDraftMetricsRequestRef = useRef(0);
  const sevdeskDraftEstimateRequestRef = useRef(0);
  const lastCreateRef = useRef({ text: "", groupId: null, at: 0 });
  const taskHighlightTimeoutsRef = useRef({});
  const [highlightedTaskIds, setHighlightedTaskIds] = useState({});

  const markTaskAsNew = (taskId) => {
    const id = Number(taskId || 0);
    if (!id) return;
    setHighlightedTaskIds((prev) => ({ ...prev, [id]: true }));
    if (taskHighlightTimeoutsRef.current[id]) {
      clearTimeout(taskHighlightTimeoutsRef.current[id]);
    }
    taskHighlightTimeoutsRef.current[id] = setTimeout(() => {
      setHighlightedTaskIds((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      delete taskHighlightTimeoutsRef.current[id];
    }, NEW_TASK_HIGHLIGHT_MS);
  };

  useEffect(() => {
    return () => {
      Object.values(taskHighlightTimeoutsRef.current).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      taskHighlightTimeoutsRef.current = {};
    };
  }, []);

  useEffect(() => {
    api.list().then((data) => {
      setTasks(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    const refreshTasks = () => {
      api.list().then((data) => {
        setTasks(Array.isArray(data) ? data : []);
      });
    };
    const handleTaskCreated = (event) => {
      const createdTaskId = Number(event?.detail?.task?.id || 0);
      if (createdTaskId) {
        markTaskAsNew(createdTaskId);
      }
      refreshTasks();
    };
    window.addEventListener("qt:daytask-created", handleTaskCreated);
    return () => window.removeEventListener("qt:daytask-created", handleTaskCreated);
  }, []);

  const refreshCustomers = () =>
    api.customers().then((data) => {
      setCustomers(Array.isArray(data) ? data : []);
    });

  useEffect(() => {
    refreshCustomers();
  }, []);

  const refreshEmployees = () =>
    fetch(`${API}/employees`)
      .then((res) => (res && res.ok ? res.json() : []))
      .then((data) => {
        setEmployees(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setEmployees([]);
      });

  useEffect(() => {
    refreshEmployees();
  }, []);

  useEffect(() => {
    api.groups().then((data) => {
      setGroups(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    const load = () => refreshSevdeskDefaults();
    load();
  }, []);

  const refreshSevdeskDefaults = async () => {
    try {
      const res = await fetch(`${API}/integrations`);
      const data = res && res.ok ? await res.json() : null;
      const metricsRes = await fetch(`${API}/customer_metrics_settings`);
      const metricsData = metricsRes && metricsRes.ok ? await metricsRes.json() : null;
      if (!data && !metricsData) return sevdeskDefaults;
      const hourlyRate =
        data?.sevdesk_hourly_rate_eur ||
        metricsData?.hourly_rate_eur ||
        sevdeskDefaults.hourly_rate_eur ||
        "";
      const nextDefaults = {
        hourly_rate_eur: hourlyRate,
        default_tax_rate: data?.sevdesk_default_tax_rate || "",
        unity_id: data?.sevdesk_unity_id || "",
        service_unity_id: data?.sevdesk_service_unity_id || "",
        contact_person_id: data?.sevdesk_contact_person_id || "",
        address_country_id: data?.sevdesk_address_country_id || "",
        tax_rule_id: data?.sevdesk_tax_rule_id || "",
        has_sevdesk_api_token: Boolean(data?.has_sevdesk_api_token)
      };
      setSevdeskDefaults(nextDefaults);
      setSevdeskTokenAvailable(Boolean(data?.has_sevdesk_api_token));
      return nextDefaults;
    } catch (error) {
      setSevdeskDefaults((prev) => ({ ...prev, has_sevdesk_api_token: false }));
      setSevdeskTokenAvailable(false);
      return sevdeskDefaults;
    }
  };

  useEffect(() => {
    if (!sevdeskDraftOpen || !sevdeskDraftForm) return;
    if (!sevdeskTokenAvailable) {
      setSevdeskDraftCheck({ state: "idle", hasDraft: false, contactFound: true });
      return;
    }
    const customerNumber = String(sevdeskDraftForm.customer_number || "").trim();
    if (!customerNumber) {
      setSevdeskDraftCheck({ state: "idle", hasDraft: false, contactFound: true });
      return;
    }
    let active = true;
    const timeout = setTimeout(() => {
      setSevdeskDraftCheck((prev) => ({ ...prev, state: "loading" }));
      fetch(`${API}/sevdesk/drafts/check?customer_number=${encodeURIComponent(customerNumber)}`)
        .then((res) => (res && res.ok ? res.json() : null))
        .then((data) => {
          if (!active) return;
          setSevdeskDraftCheck({
            state: "ready",
            hasDraft: Boolean(data?.has_draft),
            contactFound: data?.contact_found !== false
          });
        })
        .catch(() => {
          if (!active) return;
          setSevdeskDraftCheck({ state: "error", hasDraft: false, contactFound: true });
        });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [sevdeskDraftOpen, sevdeskDraftForm?.customer_number, sevdeskTokenAvailable]);

  const addTaskToGroup = async (groupId, text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    const normalizedGroupId = groupId ?? null;
    const now = Date.now();
    const last = lastCreateRef.current;
    if (last.text === trimmed && last.groupId === normalizedGroupId && now - last.at < 800) {
      return;
    }
    lastCreateRef.current = { text: trimmed, groupId: normalizedGroupId, at: now };
    const created = await api.create({
      title: trimmed,
      group_id: normalizedGroupId,
      status: "todo"
    });
    if (created?.id) {
      setTasks((prev) => [created, ...prev]);
      markTaskAsNew(created.id);
    }
  };

  const updateTask = async (task, patch) => {
    const updated = await api.update(task.id, patch);
    setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
  };

  const updateGroup = async (group, patch) => {
    const updated = await api.updateGroup(group.id, patch);
    setGroups((prev) => prev.map((item) => (item.id === group.id ? updated : item)));
  };

  const removeGroup = async (group) => {
    await api.removeGroup(group.id);
    setGroups((prev) => prev.filter((item) => item.id !== group.id));
    setTasks((prev) =>
      prev.map((item) => (item.group_id === group.id ? { ...item, group_id: null } : item))
    );
  };

  const removeTask = async (task) => {
    const label = String(task?.title || "").trim();
    const ok = window.confirm(
      label ? `Aufgabe "${label}" wirklich löschen?` : "Aufgabe wirklich löschen?"
    );
    if (!ok) return;
    await api.remove(task.id);
    setTasks((prev) => prev.filter((item) => item.id !== task.id));
  };

  const enableTime = async (task) => {
    setError("");
    const updated = await api.update(task.id, { time_enabled: true });
    if (updated?.id) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
    } else {
      setError("Zeit konnte nicht aktiviert werden.");
    }
  };

  const groupsByColumn = useMemo(() => {
    const map = { todo: [], done: [] };
    groups.forEach((group) => {
      const bucket = group.column === "done" ? "done" : "todo";
      map[bucket].push(group);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => {
        const pinnedA = a.pinned ? 1 : 0;
        const pinnedB = b.pinned ? 1 : 0;
        if (pinnedA !== pinnedB) return pinnedB - pinnedA;
        return (a.position ?? 0) - (b.position ?? 0);
      });
    });
    return map;
  }, [groups]);

  const handleDrop = (event, status) => {
    event.preventDefault();
    setDragOver("");
    const transfer = event.dataTransfer || event.nativeEvent?.dataTransfer;
    const payload = transfer?.getData("text/plain") || "";
    const isInternalTaskDrag = payload.startsWith("task:") || payload.startsWith("group:");
    if (status === "todo" && !isInternalTaskDrag && emailDropBadgeRef.current) {
      const rect = emailDropBadgeRef.current.getBoundingClientRect();
      const x = Number(event.clientX || 0);
      const y = Number(event.clientY || 0);
      const droppedOnBadge = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (droppedOnBadge && transfer) {
        triggerEmailDropTransfer(transfer);
        return;
      }
    }
    if (!payload) return;
    if (payload.startsWith("group:")) {
      const id = Number(payload.replace("group:", ""));
      const group = groups.find((item) => item.id === id);
      if (!group) return;
      const columnGroups = groups.filter((item) => item.column === status && item.id !== id);
      const position = columnGroups.length;
      updateGroup(group, { column: status, position });
      return;
    }
    const id = Number(payload.replace("task:", ""));
    if (!id) return;
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status === status) return;
    updateTask(task, { status, group_id: null });
  };

  const handleGroupDrop = (event, group, columnId) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverGroupId(null);
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    if (payload.startsWith("task:")) {
      const id = Number(payload.replace("task:", ""));
      const task = tasks.find((item) => item.id === id);
      if (!task) return;
      updateTask(task, { group_id: group.id, status: columnId });
      return;
    }
    if (payload.startsWith("group:")) {
      const id = Number(payload.replace("group:", ""));
      if (id === group.id) return;
      const columnGroups = groups
        .filter((item) => item.column === columnId && item.id !== id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const targetIndex = columnGroups.findIndex((item) => item.id === group.id);
      if (targetIndex < 0) return;
      const moved = groups.find((item) => item.id === id);
      if (!moved) return;
      const nextGroups = [...columnGroups];
      const insertIndex = Math.max(0, targetIndex);
      nextGroups.splice(insertIndex, 0, { ...moved, column: columnId });
      const updatedGroups = groups.map((item) => {
        const inColumn = nextGroups.find((candidate) => candidate.id === item.id);
        if (!inColumn) return item;
        const position = nextGroups.findIndex((candidate) => candidate.id === item.id);
        return { ...item, column: columnId, position };
      });
      setGroups(updatedGroups);
      nextGroups.forEach((item, index) => {
        updateGroup(item, { column: columnId, position: index });
      });
    }
  };

  const handleGroupDragOver = (event, groupId) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverGroupId(groupId);
  };

  const handleUngroupedDrop = (event, columnId) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload || !payload.startsWith("task:")) return;
    const id = Number(payload.replace("task:", ""));
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    updateTask(task, { group_id: null, status: columnId });
  };

  const handleDoneDrop = (event) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload || !payload.startsWith("task:")) return;
    const id = Number(payload.replace("task:", ""));
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    updateTask(task, { status: "done" });
  };

  const createGroup = async (columnId) => {
    const titleText = String(groupDrafts[columnId] || "").trim();
    if (!titleText) return;
    const columnGroups = groups.filter((item) => item.column === columnId);
    const position = columnGroups.length;
    const created = await api.createGroup({ title: titleText, column: columnId, position });
    if (created?.id) {
      setGroups((prev) => [...prev, created]);
    }
    setGroupDrafts((prev) => ({ ...prev, [columnId]: "" }));
  };

  const startGroupEdit = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupTitle(group.title || "");
  };

  const commitGroupEdit = async (group) => {
    const titleText = editingGroupTitle.trim();
    if (!titleText) {
      setEditingGroupId(null);
      setEditingGroupTitle("");
      return;
    }
    if (titleText !== group.title) {
      await updateGroup(group, { title: titleText });
    }
    setEditingGroupId(null);
    setEditingGroupTitle("");
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditingTitle(task.title || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const startCustomerEdit = (task) => {
    setEditingCustomerId(task.id);
    setEditingCustomerValue(task.customer || "");
  };

  const cancelCustomerEdit = () => {
    setEditingCustomerId(null);
    setEditingCustomerValue("");
  };

  const getDetailValue = (task, field) => {
    const current = detailEdits[task.id]?.[field];
    if (current !== undefined) return current;
    const value = task?.[field];
    return value === undefined ? "" : value;
  };

  const setDetailValue = (taskId, field, value) => {
    setDetailEdits((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [field]: value
      }
    }));
  };

  const parseTimeToMinutes = (value) => {
    const parts = String(value || "").split(":");
    if (parts.length < 2) return null;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  };

  const commitDetail = async (task, field, overrideValue) => {
    const value =
      overrideValue === undefined ? getDetailValue(task, field) : overrideValue;
    if (overrideValue !== undefined) {
      setDetailValue(task.id, field, overrideValue);
    }
    const currentValue = task?.[field];
    const isSameValue =
      typeof currentValue === "boolean"
        ? Boolean(value) === currentValue
        : value === (currentValue ?? "");
    if (isSameValue) return;
    const patch = {};
    if (field === "kulant" || field === "wartungsvertrag") {
      const boolValue = Boolean(value);
      patch[field] = boolValue;
      if (boolValue && task.aberechnet) {
        patch.aberechnet = false;
      }
    } else {
      patch[field] = value;
    }
    if (field === "arrival_time" || field === "departure_time") {
      const arrival = field === "arrival_time" ? value : getDetailValue(task, "arrival_time");
      const departure =
        field === "departure_time" ? value : getDetailValue(task, "departure_time");
      const startMinutes = parseTimeToMinutes(arrival);
      const endMinutes = parseTimeToMinutes(departure);
      if (startMinutes !== null && endMinutes !== null) {
        let diffMinutes = endMinutes - startMinutes;
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        const runningExtra =
          task.running && task.startTime ? Math.max(0, Date.now() - task.startTime) : 0;
        const baseElapsed = (task.elapsed || 0) + runningExtra;
        patch.elapsed = baseElapsed + diffMinutes * 60 * 1000;
        patch.time_enabled = true;
        patch.running = false;
        patch.startTime = 0;
      }
    }
    await updateTask(task, patch);
  };

  const toggleDetails = (task) => {
    setDetailOpenId((prev) => (prev === task.id ? null : task.id));
    setDetailEdits((prev) => ({
      ...prev,
      [task.id]: {
        arrival_time: task.arrival_time || "",
        departure_time: task.departure_time || "",
        deadline: task.deadline || "",
        urgency_flag: normalizeUrgencyFlag(task.urgency_flag),
        randzeit: Boolean(task.randzeit),
        kulant: Boolean(task.kulant),
        wartungsvertrag: Boolean(task.wartungsvertrag),
        details: task.details || ""
      }
    }));
  };

  const cycleUrgencyFlag = async (task) => {
    const next = getNextUrgencyFlag(task?.urgency_flag);
    if (detailOpenId === task?.id) {
      setDetailValue(task.id, "urgency_flag", next);
    }
    await updateTask(task, { urgency_flag: next });
  };

  const openSevdeskDraft = async (task) => {
    const latestDefaults = (await refreshSevdeskDefaults()) || sevdeskDefaults;
    const nextDraftForm = buildSevdeskDraftDefaults(task, latestDefaults);
    setSevdeskDraftTask(task);
    setSevdeskDraftForm(nextDraftForm);
    setSevdeskDraftStatus({ state: "idle", error: "" });
    setSevdeskDraftAdvancedOpen(false);
    setSevdeskDraftMetrics(null);
    setSevdeskDraftMetricsStatus("idle");
    setSevdeskDraftEstimate(null);
    setSevdeskDraftEstimateStatus({ state: "idle", error: "" });
    setSevdeskDraftOpen(true);
    const matchedCustomer = findCustomerByTaskName(task?.customer);
    const customerId = Number(matchedCustomer?.id || 0);
    if (!customerId) return;
    const requestId = Date.now();
    sevdeskDraftMetricsRequestRef.current = requestId;
    setSevdeskDraftMetricsStatus("loading");
    fetch(`${API}/customers/${customerId}/metrics`)
      .then((res) => {
        if (!res.ok) throw new Error("draft_metrics_failed");
        return res.json();
      })
      .then((data) => {
        if (sevdeskDraftMetricsRequestRef.current !== requestId) return;
        setSevdeskDraftMetrics(data);
        setSevdeskDraftMetricsStatus("ready");
      })
      .catch(() => {
        if (sevdeskDraftMetricsRequestRef.current !== requestId) return;
        setSevdeskDraftMetrics(null);
        setSevdeskDraftMetricsStatus("error");
      });
  };

  const updateSevdeskDraftForm = (field, value) => {
    setSevdeskDraftForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const persistSevdeskDraftDocumentation = async (patch) => {
    if (!sevdeskDraftTask?.id) return;
    try {
      const updated = await api.update(sevdeskDraftTask.id, patch);
      if (!updated?.id) return;
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSevdeskDraftTask(updated);
      setSevdeskDraftForm((prev) => {
        if (!prev) return prev;
        const elapsedMs = getElapsedMsForTask(updated);
        const actualHours = elapsedMs > 0 ? Number((elapsedMs / 3_600_000).toFixed(2)) : 0;
        return {
          ...prev,
          actual_hours: actualHours,
          actual_rounded_hours: roundUpToQuarterHours(actualHours),
          minimum_billable_hours:
            Number(updated.billing_min_hours || 0) > 0 ? String(updated.billing_min_hours) : "",
          billing_note: String(updated.billing_note || "")
        };
      });
    } catch (error) {
      console.error("Could not persist billing documentation", error);
    }
  };

  const refreshSevdeskDraftEstimate = async (textOverride) => {
    if (!sevdeskDraftTask) return;
    const requestId = Date.now() + Math.random();
    sevdeskDraftEstimateRequestRef.current = requestId;
    setSevdeskDraftEstimateStatus({ state: "loading", error: "" });
    try {
      const data = await api.estimateTaskScope(sevdeskDraftTask.id, {
        text: textOverride !== undefined ? textOverride : sevdeskDraftForm?.text || ""
      });
      if (sevdeskDraftEstimateRequestRef.current !== requestId) return;
      setSevdeskDraftEstimate(data || null);
      setSevdeskDraftEstimateStatus({ state: "ready", error: "" });
    } catch (error) {
      if (sevdeskDraftEstimateRequestRef.current !== requestId) return;
      setSevdeskDraftEstimate(null);
      setSevdeskDraftEstimateStatus({
        state: "error",
        error: error?.message || "Arbeitsumfang konnte nicht analysiert werden."
      });
    }
  };

  const closeSevdeskDraft = () => {
    sevdeskDraftMetricsRequestRef.current += 1;
    sevdeskDraftEstimateRequestRef.current += 1;
    setSevdeskDraftOpen(false);
    setSevdeskDraftTask(null);
    setSevdeskDraftForm(null);
    setSevdeskDraftStatus({ state: "idle", error: "" });
    setSevdeskDraftAiLoading(false);
    setSevdeskDraftMetrics(null);
    setSevdeskDraftMetricsStatus("idle");
    setSevdeskDraftEstimate(null);
    setSevdeskDraftEstimateStatus({ state: "idle", error: "" });
  };

  const submitSevdeskDraft = async () => {
    if (!sevdeskDraftTask || !sevdeskDraftForm) return;
    const customerNumber = String(sevdeskDraftForm.customer_number || "").trim();
    if (!customerNumber) {
      setSevdeskDraftStatus({ state: "error", error: "Bitte Kundennummer angeben." });
      return;
    }
    setSevdeskDraftStatus({ state: "saving", error: "" });
    const payload = {
      customer_number: customerNumber,
      header: String(sevdeskDraftForm.header || "").trim() || undefined,
      name: String(sevdeskDraftForm.name || "").trim() || undefined,
      text: String(sevdeskDraftForm.text || "").trim() || undefined,
      use_existing_draft: sevdeskDraftForm.use_existing_draft !== false
    };
    const quantity = roundUpToQuarterHours(Number(sevdeskDraftForm.quantity));
    if (Number.isFinite(quantity) && quantity > 0) payload.quantity = quantity;
    const price = Number(sevdeskDraftForm.price);
    if (Number.isFinite(price)) payload.price = price;
    const taxRate = Number(sevdeskDraftForm.tax_rate);
    if (Number.isFinite(taxRate)) payload.tax_rate = taxRate;
    const unityId = Number(sevdeskDraftForm.unity_id);
    if (Number.isFinite(unityId) && unityId > 0) payload.unity_id = unityId;
    const mileageEur = Number(sevdeskDraftMetrics?.mileageEur || 0);
    const roundTripKm = Number(
      sevdeskDraftMetrics?.distanceRoundTripKm ||
        (Number(sevdeskDraftMetrics?.distanceKm || 0) > 0
          ? Number(sevdeskDraftMetrics.distanceKm) * 2
          : 0)
    );
    if (sevdeskDraftForm.include_mileage && Number.isFinite(mileageEur) && mileageEur > 0) {
      payload.add_mileage = true;
      payload.mileage_name = "Anfahrt";
      payload.mileage_price = mileageEur;
      payload.mileage_text =
        roundTripKm > 0
          ? `Anfahrt laut Kundenstamm (${roundTripKm.toLocaleString("de-DE", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1
            })} km Hin/Rueckfahrt).`
          : "Anfahrt laut Kundenstamm.";
    }

    try {
      const res = await fetch(`${API}/sevdesk/tasks/${sevdeskDraftTask.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.detail || "Sevdesk-Übergabe fehlgeschlagen.";
        setSevdeskDraftStatus({ state: "error", error: message });
        return;
      }
      if (data?.task?.id) {
        setTasks((prev) => prev.map((item) => (item.id === data.task.id ? data.task : item)));
      }
      setSevdeskDraftStatus({ state: "saved", error: "" });
      closeSevdeskDraft();
    } catch (error) {
      setSevdeskDraftStatus({ state: "error", error: "Sevdesk-Übergabe fehlgeschlagen." });
    }
  };

  const generateSevdeskDraftText = async () => {
    if (!sevdeskDraftTask || !sevdeskDraftForm) return;
    setSevdeskDraftAiLoading(true);
    try {
      const quantity = roundUpToQuarterHours(Number(sevdeskDraftForm.quantity));
      const contextParts = [
        sevdeskDraftTask.customer ? `Kunde: ${sevdeskDraftTask.customer}` : "",
        sevdeskDraftTask.title ? `Leistung/Thema: ${sevdeskDraftTask.title}` : "",
        sevdeskDraftTask.details ? `Ausgangslage/Details: ${sevdeskDraftTask.details}` : "",
        sevdeskDraftTask.arrival_time || sevdeskDraftTask.departure_time
          ? `Vor Ort: ${sevdeskDraftTask.arrival_time || "?"} bis ${sevdeskDraftTask.departure_time || "?"}`
          : "",
        Number.isFinite(quantity) && quantity > 0 ? `Abrechenbare Zeit: ${quantity} h` : "",
        sevdeskDraftForm.name ? `Positionsname: ${sevdeskDraftForm.name}` : "",
        sevdeskDraftForm.include_mileage ? "Anfahrt wird separat als eigene Position berechnet." : "",
        "Ziel: kurze, professionelle Rechnungsposition fuer sevdesk."
      ]
        .filter(Boolean)
        .join("\n");
      const res = await fetch(`${API}/offer_ai_text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "invoice_position_text",
          current_text: sevdeskDraftForm.text || "",
          context: contextParts || "n/a"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.text) {
        updateSevdeskDraftForm("text", data.text);
      }
    } finally {
      setSevdeskDraftAiLoading(false);
    }
  };

  const commitCustomerEdit = async (task) => {
    const trimmed = editingCustomerValue.trim();
    if (trimmed === task.customer) {
      cancelCustomerEdit();
      return;
    }
    if (!trimmed) {
      await updateTask(task, { customer: "", customer_number: "" });
    } else {
      const matchedCustomer = findCustomerByTaskName(trimmed);
      await updateTask(task, {
        customer: trimmed,
        customer_number: getCustomerReferenceNumber(matchedCustomer)
      });
    }
    cancelCustomerEdit();
  };

  const commitEdit = async (task) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed !== task.title) {
      await updateTask(task, { title: trimmed });
    }
    cancelEdit();
  };

  const toggleSuggestionMenu = (taskId, hasMultiple) => {
    if (!hasMultiple) return;
    setSuggestionOpenId((prev) => (prev === taskId ? null : taskId));
    setSuggestionQuery("");
    setEmployeeMenuOpenId(null);
  };

  const toggleEmployeeMenu = (taskId) => {
    setEmployeeMenuOpenId((prev) => (prev === taskId ? null : taskId));
    setSuggestionOpenId(null);
  };

  function normalizeText(value) {
    let text = String(value || "").toLowerCase();
    text = text
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");
    text = text.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
    text = text.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    return text;
  }

  function normalizeVariants(value) {
    const base = normalizeText(value);
    const noH = base.replace(/([aeiou])h/g, "$1");
    return Array.from(new Set([base, noH])).filter(Boolean);
  }

  function getCustomerReferenceNumber(customer) {
    return String(
      customer?.creditor_number || customer?.creditorNumber || customer?.short_code || customer?.shortCode || ""
    ).trim();
  }

  function findCustomerByTaskName(nameValue) {
    const rawName = String(nameValue || "").trim();
    if (!rawName) return null;
    const lowerName = rawName.toLowerCase();
    const exactMatches = customers.filter(
      (customer) => String(customer?.name || "").trim().toLowerCase() === lowerName
    );
    if (exactMatches.length) {
      return [...exactMatches].sort((a, b) => {
        const aHasNumber = Boolean(getCustomerReferenceNumber(a));
        const bHasNumber = Boolean(getCustomerReferenceNumber(b));
        if (aHasNumber !== bHasNumber) return bHasNumber ? 1 : -1;
        const aActive = String(a?.status || "active").toLowerCase() === "active";
        const bActive = String(b?.status || "active").toLowerCase() === "active";
        if (aActive !== bActive) return bActive ? 1 : -1;
        return 0;
      })[0];
    }
    const targetVariants = new Set(normalizeVariants(rawName));
    let best = null;
    let bestScore = -1;
    customers.forEach((customer) => {
      const customerName = String(customer?.name || "").trim();
      if (!customerName) return;
      const customerVariants = normalizeVariants(customerName);
      const overlap = customerVariants.some((variant) => targetVariants.has(variant));
      if (!overlap) return;
      let score = 10;
      if (getCustomerReferenceNumber(customer)) score += 3;
      if (String(customer?.status || "active").toLowerCase() === "active") score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = customer;
      }
    });
    return best;
  }

  function getCustomerShortCodeForTask(task) {
    const match = findCustomerByTaskName(task?.customer);
    return String(match?.short_code || match?.shortCode || "").trim();
  }

  function matchesTask(task, needle) {
    if (!needle) return true;
    const title = normalizeText(task?.title || "");
    const details = normalizeText(task?.details || "");
    const customer = normalizeText(task?.customer || "");
    const number = normalizeText(task?.customer_number || "");
    const shortCode = normalizeText(getCustomerShortCodeForTask(task));
    return (
      (title && title.includes(needle)) ||
      (details && details.includes(needle)) ||
      (customer && customer.includes(needle)) ||
      (number && number.includes(needle)) ||
      (shortCode && shortCode.includes(needle))
    );
  }

  const filteredTasks = useMemo(() => {
    const customerNeedle = normalizeText(customerFilter);
    const contentNeedle = normalizeText(contentFilter);
    const minOpenDays = Number(openSinceFilter);
    return tasks.filter((task) => {
      const name = normalizeText(task?.customer || "");
      const number = normalizeText(task?.customer_number || "");
      const shortCode = normalizeText(getCustomerShortCodeForTask(task));
      const matchesCustomer =
        !customerNeedle ||
        (name && name.includes(customerNeedle)) ||
        (number && number.includes(customerNeedle)) ||
        (shortCode && shortCode.includes(customerNeedle));
      const matchesContent = matchesTask(task, contentNeedle);
      const matchesEmployee =
        employeeFilter === "all"
          ? true
          : employeeFilter === "assigned"
          ? Boolean(task.employee_id)
          : employeeFilter === "unassigned"
          ? !task.employee_id
          : String(task.employee_id || "") === employeeFilter;
      const matchesOpenDays =
        !Number.isFinite(minOpenDays) ||
        minOpenDays <= 0 ||
        (task.status !== "done" &&
          openSinceDays(task.created_at) >= Math.floor(minOpenDays));
      return matchesCustomer && matchesContent && matchesEmployee && matchesOpenDays;
    });
  }, [tasks, customerFilter, contentFilter, employeeFilter, openSinceFilter]);

  const totalOpenTasks = useMemo(
    () => tasks.filter((task) => task.status !== "done").length,
    [tasks]
  );

  const filteredOpenTasks = useMemo(
    () => filteredTasks.filter((task) => task.status !== "done").length,
    [filteredTasks]
  );

  const grouped = useMemo(() => {
    const map = { todo: [], done: [] };
    filteredTasks.forEach((task) => {
      const bucket = task.status === "done" ? "done" : "todo";
      map[bucket].push(task);
    });
    const normalizeName = (value) => String(value || "").trim().toLowerCase();
    const hasRecordedTime = (task) => Boolean(task?.elapsed && task.elapsed > 0);
    const sortByName = (items) =>
      [...items].sort((a, b) => {
        const aHasTime = hasRecordedTime(a);
        const bHasTime = hasRecordedTime(b);
        if (aHasTime !== bHasTime) {
          return aHasTime ? -1 : 1;
        }
        const aName = normalizeName(a.customer);
        const bName = normalizeName(b.customer);
        if (aName && bName && aName !== bName) {
          return aName.localeCompare(bName, "de");
        }
        if (aName && !bName) return -1;
        if (!aName && bName) return 1;
        return (b.created_at || 0) - (a.created_at || 0);
      });
    const sortByOpenAge = (items, direction = "desc") =>
      [...items].sort((a, b) => {
        const aTs = a.created_at || 0;
        const bTs = b.created_at || 0;
        return direction === "desc" ? aTs - bTs : bTs - aTs;
      });
    const sortByUrgency = (items) =>
      [...items].sort((a, b) => {
        const aHasTime = hasRecordedTime(a);
        const bHasTime = hasRecordedTime(b);
        if (aHasTime !== bHasTime) {
          return aHasTime ? -1 : 1;
        }
        const aUrgency = URGENCY_SORT_WEIGHT[normalizeUrgencyFlag(a?.urgency_flag)] ?? 0;
        const bUrgency = URGENCY_SORT_WEIGHT[normalizeUrgencyFlag(b?.urgency_flag)] ?? 0;
        if (aUrgency !== bUrgency) {
          return bUrgency - aUrgency;
        }
        const aName = normalizeName(a.customer);
        const bName = normalizeName(b.customer);
        if (aName && bName && aName !== bName) {
          return aName.localeCompare(bName, "de");
        }
        if (aName && !bName) return -1;
        if (!aName && bName) return 1;
        return (b.created_at || 0) - (a.created_at || 0);
      });
    map.todo =
      openSort === "urgency"
        ? sortByUrgency(map.todo)
        : openSort === "age_desc"
        ? sortByOpenAge(map.todo, "desc")
        : openSort === "age_asc"
        ? sortByOpenAge(map.todo, "asc")
        : sortByName(map.todo);
    map.done = sortByName(map.done);
    return map;
  }, [filteredTasks, openSort]);

  const doneTasks = useMemo(
    () =>
      grouped.done
        .filter((task) => !task.aberechnet)
        .filter((task) => showKulantDone || (!task.kulant && !task.wartungsvertrag))
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
    [grouped.done, showKulantDone]
  );

  const filteredDoneTasks = useMemo(() => {
    const needle = normalizeText(doneFilter);
    if (!needle) return doneTasks;
    return doneTasks.filter((task) => matchesTask(task, needle));
  }, [doneTasks, doneFilter]);

  const billedTasks = useMemo(
    () =>
      grouped.done
        .filter((task) => task.aberechnet)
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
    [grouped.done]
  );

  const filteredBilledTasks = useMemo(() => {
    const needle = normalizeText(billedFilter);
    if (!needle) return billedTasks;
    return billedTasks.filter((task) => matchesTask(task, needle));
  }, [billedTasks, billedFilter]);

  const msToHHMMSS = (ms = 0) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const roundUpToQuarterHours = (hours) => {
    const value = Number(hours);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.ceil(value * 4) / 4;
  };

  const parseDurationInput = (value) => {
    const parts = String(value || "")
      .trim()
      .split(":")
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length < 2 || parts.length > 3) return null;
    const numbers = parts.map((part) => Number(part));
    if (numbers.some((num) => !Number.isFinite(num) || num < 0)) return null;
    if (parts.length === 2) {
      const [minutes, seconds] = numbers;
      if (seconds >= 60) return null;
      return (minutes * 60 + seconds) * 1000;
    }
    const [hours, minutes, seconds] = numbers;
    if (minutes >= 60 || seconds >= 60) return null;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  };

  const getElapsedMsForTask = (task) => {
    if (!task) return 0;
    const base = Number(task.elapsed || 0);
    if (!task.running || !task.startTime) return base;
    return Math.max(0, base + (nowMs - Number(task.startTime || 0)));
  };

  const getCustomerNumberForTask = (task) => {
    const existingNumber = String(task?.customer_number || "").trim();
    if (existingNumber) return existingNumber;
    const match = findCustomerByTaskName(task?.customer);
    return getCustomerReferenceNumber(match);
  };


  const buildSevdeskDraftDefaults = (task, defaultsOverride) => {
    const defaults = defaultsOverride || sevdeskDefaults;
    const elapsedMs = getElapsedMsForTask(task);
    const hours = elapsedMs > 0 ? elapsedMs / 3_600_000 : 0;
    const actualHours = Number(hours.toFixed(2));
    const roundedHours = roundUpToQuarterHours(hours);
    const minimumBillableHours = roundUpToQuarterHours(Number(task?.billing_min_hours || 0));
    const suggestedQuantity = Math.max(roundedHours, minimumBillableHours);
    const unityDefault = defaults.service_unity_id || defaults.unity_id || "";
    const title = String(task?.title || "").trim();
    const details = String(task?.details || "").trim();
    const positionText = title && details ? `${title}. ${details}` : title || details;
    return {
      customer_number: getCustomerNumberForTask(task),
      header: "Leistungsnachweis",
      name: "Arbeitszeit",
      text: positionText,
      quantity: suggestedQuantity > 0 ? String(suggestedQuantity) : "1",
      actual_hours: actualHours,
      actual_rounded_hours: roundedHours,
      minimum_billable_hours: minimumBillableHours > 0 ? String(minimumBillableHours) : "",
      billing_note: String(task?.billing_note || ""),
      price: defaults.hourly_rate_eur ? String(defaults.hourly_rate_eur) : "",
      tax_rate: defaults.default_tax_rate ? String(defaults.default_tax_rate) : "",
      unity_id: unityDefault ? String(unityDefault) : "",
      use_existing_draft: true,
      include_mileage: false
    };
  };

  const hasRunningTimer = useMemo(() => tasks.some((task) => task?.running), [tasks]);

  const missingSevdeskInvoiceFields = useMemo(() => [], []);

  useEffect(() => {
    if (!hasRunningTimer) return;
    let frame = 0;
    let lastTick = 0;
    const tick = (now) => {
      if (now - lastTick >= 250) {
        lastTick = now;
        setNowMs(Date.now());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hasRunningTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "qt_dayplan_collapsed_timers",
        JSON.stringify(collapsedTimers)
      );
    } catch (error) {
      // ignore storage errors
    }
  }, [collapsedTimers]);

  const toggleTimeTask = async (timeTask) => {
    if (!timeTask?.id) return;
    const updated = await api.toggleTimeTask(timeTask.id);
    if (updated?.id) {
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setTimeEdits((prev) => {
        if (!prev[updated.id]) return prev;
        const next = { ...prev };
        delete next[updated.id];
        return next;
      });
    }
  };

  const commitManualTime = async (taskId, timeTask, value) => {
    const parsedMs = parseDurationInput(value);
    if (parsedMs === null) {
      setError("Zeitformat ungültig. Beispiel: 96:00 oder 01:30:00");
      return;
    }
    const updated = await api.update(timeTask.id, {
      elapsed: parsedMs,
      running: false,
      startTime: 0,
      time_enabled: true
    });
    if (updated?.id) {
      setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    }
    setTimeEdits((prev) => {
      if (!prev[taskId]) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    setError("");
  };

  const shortenTaskTitle = (value, maxLength = 78) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  };

  const htmlToText = (value) => {
    const html = String(value || "").trim();
    if (!html) return "";
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      return String(doc.body?.textContent || "").replace(/\s+/g, " ").trim();
    } catch (error) {
      return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }
  };

  const parseEmailMeta = (plainText = "") => {
    const text = String(plainText || "");
    const subjectMatch = text.match(/^Subject:\s*(.+)$/im);
    const fromMatch = text.match(/^From:\s*(.+)$/im);
    const fromRaw = fromMatch?.[1] ? String(fromMatch[1]).trim() : "";
    const fromEmailMatch = fromRaw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const fromEmail = fromEmailMatch ? fromEmailMatch[0] : "";
    const fromName = fromRaw
      ? fromRaw.replace(/[<\[].*[>\]]/, "").replace(fromEmail, "").replace(/["<>]/g, "").trim()
      : "";
    return {
      subject: subjectMatch?.[1] ? String(subjectMatch[1]).trim() : "",
      fromEmail,
      fromName
    };
  };

  const stripAttachmentLines = (value = "") =>
    String(value || "")
      .split(/\r?\n/)
      .filter((line) => {
        const text = String(line || "").trim();
        if (!text) return true;
        if (/^(attachments?|anh[aä]nge?)\s*:/i.test(text)) return false;
        if (/^(attachment|anlage)\s*:/i.test(text)) return false;
        if (/^\[cid:.*\]$/i.test(text)) return false;
        return true;
      })
      .join("\n");

  const readDroppedEmailFromTransfer = async (transfer) => {
    const readStringItem = (item, timeoutMs = 400) =>
      new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          resolve(String(value || ""));
        };
        const timer = setTimeout(() => finish(""), timeoutMs);
        try {
          item.getAsString((value) => {
            clearTimeout(timer);
            finish(value);
          });
        } catch (error) {
          clearTimeout(timer);
          finish("");
        }
      });
    const readFileText = async (file) => {
      if (!file) return "";
      if (typeof file.text === "function") {
        try {
          return await file.text();
        } catch (error) {
          return "";
        }
      }
      return await new Promise((resolve) => {
        try {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => resolve("");
          reader.readAsText(file);
        } catch (error) {
          resolve("");
        }
      });
    };

    const getTransferValue = (types = []) => {
      if (!transfer || typeof transfer.getData !== "function") return "";
      for (const type of types) {
        const value = transfer.getData(type);
        if (typeof value === "string" && value.trim()) return value;
      }
      return "";
    };

    const text = getTransferValue([
      "text/plain",
      "public.utf8-plain-text",
      "public.plain-text",
      "NSStringPboardType"
    ]);
    const uriList = getTransferValue(["text/uri-list"]);
    const uriName = getTransferValue(["public.url-name", "text/x-moz-url-desc"]);
    const rtf = getTransferValue(["text/rtf", "public.rtf"]);
    const html = getTransferValue(["text/html", "public.html", "Apple Web Archive pasteboard type"]);

    let itemText = "";
    let itemHtml = "";
    const items = transfer?.items ? Array.from(transfer.items) : [];
    if (items.length) {
      const stringItems = items.filter((item) => item.kind === "string");
      const stringValues = await Promise.all(
        stringItems.map(async (item) => ({
          type: String(item.type || "").toLowerCase(),
          value: await readStringItem(item)
        }))
      );
      itemText =
        stringValues.find((entry) =>
          /(text\/plain|plain-text|public\.utf8-plain-text)/.test(entry.type)
        )?.value || "";
      itemHtml =
        stringValues.find((entry) => /(text\/html|public\.html)/.test(entry.type))?.value || "";
    }

    let fileText = "";
    const transferFiles = transfer?.files ? Array.from(transfer.files) : [];
    const itemFiles = items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile?.())
      .filter(Boolean);
    const allFiles = [...transferFiles, ...itemFiles];
    let fileName = "";
    if (allFiles.length) {
      const preferred =
        allFiles.find((file) => {
          const type = String(file?.type || "").toLowerCase();
          const name = String(file?.name || "");
          return (
            type.startsWith("text/") ||
            type.includes("message/rfc822") ||
            type.includes("application/emlx") ||
            /\.(eml|emlx|txt|md)$/i.test(name)
          );
        }) || allFiles[0];
      fileName = String(preferred?.name || "").trim();
      fileText = await readFileText(preferred);
    }

    const cleanedUriList = String(uriList || "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !/^message:\/\//i.test(line));
    const rawText = String(
      text || itemText || fileText || htmlToText(html || itemHtml) || cleanedUriList || rtf || ""
    ).trim();
    const plainTextOnly = stripAttachmentLines(rawText).trim();
    const parsed = parseEmailMeta(plainTextOnly);
    const subjectFromName = fileName
      ? fileName.replace(/\.(eml|emlx|txt|md)$/i, "").replace(/\s+/g, " ").trim()
      : "";
    const normalizedSubject = String(parsed.subject || uriName || subjectFromName || "").trim();
    const safeHtml = stripAttachmentLines(String(html || itemHtml || "")).trim();
    return {
      text: plainTextOnly,
      html: safeHtml,
      subject: normalizedSubject,
      fromEmail: parsed.fromEmail,
      fromName: parsed.fromName
    };
  };

  const closeEmailTaskModal = () => {
    setEmailTaskModalOpen(false);
    setEmailTaskDraft(null);
    setEmailTaskAnalyzing(false);
    setEmailTaskError("");
    setEmailTaskSaving(false);
  };

  const submitEmailTaskDraft = async () => {
    if (!emailTaskDraft) return;
    const title = shortenTaskTitle(emailTaskDraft.title);
    if (!title) {
      setEmailTaskError("Bitte einen Titel angeben.");
      return;
    }
    setEmailTaskSaving(true);
    setEmailTaskError("");
    try {
      const selectedCustomer = customers.find(
        (item) =>
          String(item?.name || "").trim().toLowerCase() ===
          String(emailTaskDraft.customer || "").trim().toLowerCase()
      );
      const customerName = String(emailTaskDraft.customer || "").trim();
      const payload = {
        title,
        details: String(emailTaskDraft.details || "").trim(),
        customer: customerName,
        customer_number: String(
          selectedCustomer?.creditor_number || emailTaskDraft.customer_number || ""
        ).trim(),
        status: "todo",
        group_id: emailTaskDraft.group_id ?? null
      };
      const created = await api.create(payload);
      if (created?.id) {
        setTasks((prev) => [created, ...prev]);
        markTaskAsNew(created.id);
      }
      closeEmailTaskModal();
    } catch (error) {
      setEmailTaskError("Aufgabe konnte aus der E-Mail nicht erstellt werden.");
      setEmailTaskSaving(false);
    }
  };

  const handleEmailDropTransfer = async (transfer) => {
    setEmailDropHover(false);
    setEmailDropBusy(true);
    setEmailTaskModalOpen(true);
    setEmailTaskAnalyzing(true);
    setEmailTaskDraft({
      title: "",
      details: "",
      customer: "",
      customer_number: "",
      group_id: null,
      from_email: "",
      subject: ""
    });
    setEmailTaskError("");
    setError("");
    try {
      const dropped = await readDroppedEmailFromTransfer(transfer);
      setEmailTaskDraft((prev) => ({
        ...(prev || {}),
        from_email: String(dropped.fromEmail || "").trim(),
        subject: String(dropped.subject || "").trim()
      }));
      if (!dropped.text && !dropped.subject && !dropped.html) {
        setEmailTaskError("Keine auswertbaren E-Mail-Daten erkannt.");
        setError("Keine auswertbaren E-Mail-Daten erkannt.");
        setEmailDropBusy(false);
        setEmailTaskAnalyzing(false);
        return;
      }
      const result = await api.analyzeEmailDraft(dropped);
      if (!result || result.error) {
        setEmailTaskError(result?.error || "E-Mail konnte nicht analysiert werden.");
        setError(result?.error || "E-Mail konnte nicht analysiert werden.");
        setEmailDropBusy(false);
        setEmailTaskAnalyzing(false);
        return;
      }
      setEmailTaskDraft({
        title: shortenTaskTitle(result.title || dropped.subject || "Neue Aufgabe aus E-Mail"),
        details: String(result.details || "").trim(),
        customer: String(result.customer || "").trim(),
        customer_number: String(result.customer_number || "").trim(),
        group_id: null,
        from_email: String(result.from_email || dropped.fromEmail || "").trim(),
        subject: String(result.subject || dropped.subject || "").trim()
      });
    } catch (error) {
      setEmailTaskError("E-Mail konnte nicht analysiert werden.");
      setError("E-Mail konnte nicht analysiert werden.");
    } finally {
      setEmailTaskAnalyzing(false);
      setEmailDropBusy(false);
    }
  };

  const triggerEmailDropTransfer = (transfer) => {
    const now = Date.now();
    if (now - emailDropGuardRef.current < 250) return;
    emailDropGuardRef.current = now;
    handleEmailDropTransfer(transfer);
  };

  // no extra time task fetch needed; timing fields live on day_tasks

  const getCustomerSuggestions = (task) => {
    const titleVariants = normalizeVariants(`${task?.title || ""} ${task?.customer || ""}`);
    const titleText = titleVariants[0] || "";
    if (!titleText) return [];
    const tokens = titleText.split(" ").filter((token) => token.length > 2);
    const scored = customers
      .map((customerItem) => {
        const name = String(customerItem?.name || "").trim();
        const shortCode = String(customerItem?.short_code || customerItem?.shortCode || "").trim();
        if (!name) return null;
        const nameVariants = normalizeVariants(name);
        const shortCodeVariants = shortCode ? normalizeVariants(shortCode) : [];
        const nameText = nameVariants[0] || "";
        const shortCodeText = shortCodeVariants[0] || "";
        if (!nameText) return null;
        let score = 0;
        if (nameVariants.some((variant) => titleVariants.some((t) => t.includes(variant)))) {
          score += 100 + nameText.length;
        }
        if (
          shortCodeVariants.length &&
          shortCodeVariants.some((variant) => titleVariants.some((t) => t.includes(variant)))
        ) {
          score += 80 + shortCodeText.length;
        }
        if (
          !score &&
          titleVariants.some((t) => nameVariants.some((variant) => variant.includes(t))) &&
          titleText.length > 2
        ) {
          score += 40 + titleText.length;
        }
        if (!score) {
          tokens.forEach((token) => {
            if (nameVariants.some((variant) => variant.includes(token))) {
              score += 5;
            }
            if (shortCodeVariants.some((variant) => variant.includes(token))) {
              score += 8;
            }
            if (token.length > 2 && nameVariants.some((variant) => token.includes(variant))) {
              score += 3;
            }
          });
        }
        return score > 0 ? { name, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return scored.map((item) => item.name);
  };

  const filteredCustomerNames = useMemo(() => {
    const needle = suggestionQuery.trim().toLowerCase();
    const names = customers.map((item) => String(item?.name || "").trim()).filter(Boolean);
    if (!needle) return names;
    return names.filter((name) => name.toLowerCase().includes(needle));
  }, [customers, suggestionQuery]);

  const renderTaskCard = (task) => {
    const suggestions = getCustomerSuggestions(task);
    const hasCustomer = Boolean(task.customer || task.customer_number);
    const canPromote = !task.time_enabled;
    const isDone = task.status === "done";
    const customerNumber = getCustomerNumberForTask(task);
    const isKulant = Boolean(task.kulant);
    const isWartungsvertrag = Boolean(task.wartungsvertrag);
    const canInvoice = Boolean(customerNumber) && !isKulant && !isWartungsvertrag;
    const isBilled = Boolean(task.aberechnet);
    const urgencyMeta = getUrgencyMeta(task.urgency_flag);
    const assignedEmployee = employees.find((employee) => employee.id === task.employee_id);
    const timeTask = task.time_enabled ? task : null;
    const elapsedMs = timeTask
      ? (timeTask.elapsed || 0) +
        (timeTask.running && timeTask.startTime ? nowMs - timeTask.startTime : 0)
      : 0;
    const timeInputValue = timeEdits[task.id] ?? msToHHMMSS(elapsedMs);
    const isTimerCollapsed = Boolean(collapsedTimers[task.id]);
    const rawDeadline = String(task?.deadline || "").trim();
    const hasDeadline = Boolean(rawDeadline);
    const deadlineMs = hasDeadline ? new Date(rawDeadline).getTime() : NaN;
    const deadlineDiffMs = Number.isFinite(deadlineMs) ? deadlineMs - nowMs : NaN;
    const deadlineCornerClass = !Number.isFinite(deadlineMs)
      ? ""
      : deadlineDiffMs < 0
      ? "border-t-rose-500"
      : deadlineDiffMs <= 2 * 24 * 60 * 60 * 1000
      ? "border-t-amber-400"
      : "border-t-emerald-500";
    const deadlineTooltip = !Number.isFinite(deadlineMs)
      ? ""
      : deadlineDiffMs < 0
      ? `Deadline überschritten (${Math.ceil(Math.abs(deadlineDiffMs) / 86400000)} Tage)`
      : deadlineDiffMs <= 2 * 24 * 60 * 60 * 1000
      ? `Deadline in ${Math.max(1, Math.ceil(deadlineDiffMs / 86400000))} Tagen`
      : `Deadline in ${Math.ceil(deadlineDiffMs / 86400000)} Tagen`;
    const isDetailsCollapsed = detailOpenId !== task.id;
    const isNewlyCreated = Boolean(highlightedTaskIds[task.id]);
    return (
      <div
        key={task.id}
        className={`relative rounded-lg border px-3 py-2 shadow-[0_2px_6px_rgba(150,120,60,0.08)] transition-colors duration-500 md:px-2 md:py-1.5 ${
          isNewlyCreated
            ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-200/70"
            : "border-sand-200 bg-white"
        }`}
        draggable={editingId !== task.id}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", `task:${task.id}`);
        }}
      >
        {hasDeadline && isDetailsCollapsed && deadlineCornerClass ? (
          <div
            className={`pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[14px] border-t-[14px] border-l-transparent ${deadlineCornerClass}`}
            title={deadlineTooltip}
          />
        ) : null}
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                {editingId === task.id ? (
                  <textarea
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => commitEdit(task)}
                    onKeyDown={(event) => {
                      if (event.isComposing || event.keyCode === 229 || event.repeat) return;
                      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                        event.preventDefault();
                        commitEdit(task);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    rows={3}
                    className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-base font-medium text-sand-900 shadow-soft focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-2 md:py-1 md:text-xs"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => startEdit(task)}
                    className={`text-left text-xs font-medium hover:text-sand-700 ${
                      isDone ? "line-through text-sand-400" : "text-sand-900"
                    }`}
                    title="Doppelklick zum Bearbeiten"
                  >
                    {task.title}
                  </button>
                )}
                {isKulant ? (
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-600">
                    Kulant
                  </p>
                ) : null}
                {isWartungsvertrag ? (
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-sky-700">
                    Wartungsvertrag
                  </p>
                ) : null}
                {isDone && task.completed_at ? (
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-sand-400">
                    Erledigt {formatDoneDate(task.completed_at)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1 ml-auto pr-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleSuggestionMenu(task.id, true);
                  }}
                  className="rounded-full border border-amber-200 bg-white p-1 text-sand-600 hover:bg-amber-100"
                  title="Kundenvorschlag"
                >
                  <Sparkles size={12} />
                </button>
                <div className="inline-flex flex-col items-center gap-0.5">
                  {!task.time_enabled || isTimerCollapsed ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (task.time_enabled) {
                          setCollapsedTimers((prev) => {
                            if (!prev[task.id]) return prev;
                            const next = { ...prev };
                            delete next[task.id];
                            return next;
                          });
                          return;
                        }
                        enableTime(task);
                      }}
                      disabled={!canPromote && !task.time_enabled}
                      className={`rounded-full border p-1 ${
                        canPromote || task.time_enabled
                          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          : "border-sand-100 text-sand-300 cursor-not-allowed"
                      }`}
                      title="Zeit in Aufgabe aktivieren"
                    >
                      <Clock size={12} />
                    </button>
                  ) : (
                    <div
                      className="flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2 py-1"
                      onDoubleClick={() =>
                        setCollapsedTimers((prev) => ({ ...prev, [task.id]: true }))
                      }
                      title="Doppelklick zum Ausblenden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTimeTask(timeTask)}
                        className={`rounded-full border p-1 ${
                          timeTask?.running
                            ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                            : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        }`}
                        title={timeTask?.running ? "Zeit stoppen" : "Zeit starten"}
                        disabled={!timeTask}
                      >
                        {timeTask?.running ? <Square size={10} /> : <Play size={10} />}
                      </button>
                      <input
                        value={timeInputValue}
                        onChange={(event) =>
                          setTimeEdits((prev) => ({ ...prev, [task.id]: event.target.value }))
                        }
                        onBlur={() => commitManualTime(task.id, timeTask, timeInputValue)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitManualTime(task.id, timeTask, timeInputValue);
                          }
                        }}
                        className="w-[78px] bg-transparent text-base font-mono text-sand-600 focus:outline-none md:text-[10px]"
                        title="Zeit manuell bearbeiten (MM:SS oder HH:MM:SS)"
                        disabled={!timeTask}
                      />
                    </div>
                  )}
                </div>
                {!isDone ? (
                  <button
                    type="button"
                    onClick={() => updateTask(task, { status: "done" })}
                    className="rounded-full border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100"
                    title="Erledigt"
                  >
                    <CheckCircle size={12} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => updateTask(task, { status: "todo", aberechnet: false })}
                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                    title="Unerledigt"
                  >
                    <Undo2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openSevdeskDraft(task)}
                  disabled={!canInvoice}
                  className={`rounded-full border p-1 ${
                    canInvoice
                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-sand-100 text-sand-300 cursor-not-allowed"
                  }`}
                  title={
                    !hasCustomer
                      ? "Kunde zuweisen"
                      : isKulant
                      ? "Kulante Aufgaben werden nicht fakturiert"
                      : isWartungsvertrag
                      ? "Wartungsvertrag-Aufgaben werden archiviert und nicht fakturiert"
                      : !customerNumber
                      ? "Kundennummer im Kundenstamm fehlt"
                      : sevdeskTokenAvailable
                      ? "Rechnungsentwurf in sevdesk"
                      : "Sevdesk API Token fehlt"
                  }
                >
                  <DollarSign size={12} />
                </button>
                {isBilled ? (
                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm("Fakturierung wirklich rueckgaengig machen?");
                      if (!ok) return;
                      updateTask(task, { aberechnet: false });
                    }}
                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                    title="Fakturierung rueckgaengig"
                  >
                    <Undo2 size={12} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeTask(task)}
                  className="rounded-full border border-rose-200 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100"
                  title="Löschen"
                >
                  <Trash2 size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleEmployeeMenu(task.id)}
                  className="rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-100"
                  title={
                    assignedEmployee
                      ? `Mitarbeiter: ${assignedEmployee.short_code || assignedEmployee.name}`
                      : "Mitarbeiter zuweisen"
                  }
                  style={{
                    borderColor: assignedEmployee?.color || undefined,
                    color: assignedEmployee?.color || undefined
                  }}
                >
                  <Pin size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleDetails(task)}
                  className="rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-100"
                  title="Details anzeigen"
                >
                  <ChevronDown
                    size={12}
                    className={`transition ${detailOpenId === task.id ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>
            {editingCustomerId === task.id ? (
              <input
                value={editingCustomerValue}
                onChange={(event) => setEditingCustomerValue(event.target.value)}
                onBlur={() => commitCustomerEdit(task)}
                onKeyDown={(event) => {
                  if (event.isComposing || event.keyCode === 229 || event.repeat) return;
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitCustomerEdit(task);
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelCustomerEdit();
                  }
                }}
                list="dayplan-customers"
                placeholder="Kunde zuordnen…"
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-base text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-2 md:py-1 md:text-[11px]"
                autoFocus
              />
            ) : task.customer ? (
              <div className="mt-1 flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    startCustomerEdit(task);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-sand-500 hover:text-sand-700"
                  title="Kunde ändern"
                >
                  {task.customer}
                </button>
                <div className="ml-auto inline-flex min-h-[16px] items-center gap-1">
                  {!isDone ? (
                    <>
                      <button
                        type="button"
                        onClick={() => cycleUrgencyFlag(task)}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-sand-200 bg-white hover:bg-sand-50"
                        title={
                          urgencyMeta
                            ? `Dringlichkeits-Flag: ${urgencyMeta.label} (klicken zum Wechseln)`
                            : "Dringlichkeits-Flag setzen"
                        }
                      >
                        <span
                          className={`h-2.5 w-2.5 rounded-full border ${
                            urgencyMeta ? urgencyMeta.dotClass : "border-sand-300 bg-sand-200"
                          }`}
                        />
                      </button>
                      <span className="whitespace-nowrap text-[10px] text-sand-400">
                        offen seit {openSinceDays(task.created_at)} Tagen
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
            {suggestionOpenId === task.id ? (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-amber-200 bg-white shadow-soft z-20">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-sand-400">
                  Kundenvorschlaege
                </div>
                <div className="px-3 pb-2">
                  <input
                    value={suggestionQuery}
                    onChange={(event) => setSuggestionQuery(event.target.value)}
                    placeholder="Kunde suchen..."
                    className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-base text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-2 md:py-1 md:text-xs"
                  />
                </div>
                <div className="max-h-48 overflow-auto border-t border-amber-100">
                  {(suggestionQuery.trim()
                    ? filteredCustomerNames
                    : suggestions.length
                      ? suggestions
                      : filteredCustomerNames.slice(0, 12)
                  ).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        updateTask(task, { customer: name });
                        setSuggestionOpenId(null);
                        setSuggestionQuery("");
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-sand-700 hover:bg-amber-50"
                    >
                      {name}
                    </button>
                  ))}
                  {!suggestions.length && !suggestionQuery.trim() ? (
                    <div className="px-3 py-2 text-xs text-sand-400">Keine Vorschlaege.</div>
                  ) : null}
                  {suggestionQuery.trim() && !filteredCustomerNames.length ? (
                    <div className="px-3 py-2 text-xs text-sand-400">Kein Kunde gefunden.</div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {employeeMenuOpenId === task.id ? (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-sand-200 bg-white shadow-soft z-20">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-sand-400">
                  Mitarbeiter
                </div>
                <div className="px-3 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateTask(task, { employee_id: null });
                      setEmployeeMenuOpenId(null);
                    }}
                    className="w-full text-left rounded-lg border border-sand-200 px-3 py-2 text-xs text-sand-600 hover:bg-sand-50"
                  >
                    Keine Zuweisung
                  </button>
                </div>
                <div className="max-h-48 overflow-auto border-t border-sand-100">
                  {employees.length ? (
                    employees.map((employee) => (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => {
                          updateTask(task, { employee_id: employee.id });
                          setEmployeeMenuOpenId(null);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-sand-700 hover:bg-sand-50"
                      >
                        <span
                          className="mr-2 inline-flex h-2 w-2 rounded-full"
                          style={{ backgroundColor: employee.color || "#111827" }}
                        />
                        {employee.short_code || employee.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-xs text-sand-400">Keine Mitarbeiter.</div>
                  )}
                </div>
              </div>
            ) : null}
            {detailOpenId === task.id ? (
              <div className="mt-2 rounded-xl border border-sand-200 bg-white p-2 space-y-2">
                <div className="grid gap-2 md:grid-cols-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-sand-500">
                      Anfahrtszeit
                    </label>
                    <input
                      type="time"
                      value={getDetailValue(task, "arrival_time")}
                      onChange={(event) =>
                        setDetailValue(task.id, "arrival_time", event.target.value)
                      }
                      onBlur={() => commitDetail(task, "arrival_time")}
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-sand-500">
                      Abfahrtszeit
                    </label>
                    <input
                      type="time"
                      value={getDetailValue(task, "departure_time")}
                      onChange={(event) =>
                        setDetailValue(task.id, "departure_time", event.target.value)
                      }
                      onBlur={() => commitDetail(task, "departure_time")}
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-sand-500">
                      Deadline
                    </label>
                    <input
                      type="datetime-local"
                      value={getDetailValue(task, "deadline")}
                      onChange={(event) => setDetailValue(task.id, "deadline", event.target.value)}
                      onBlur={() => commitDetail(task, "deadline")}
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wide text-sand-500">
                      Dringlichkeit
                    </label>
                    <select
                      value={normalizeUrgencyFlag(getDetailValue(task, "urgency_flag"))}
                      onChange={(event) => {
                        const next = normalizeUrgencyFlag(event.target.value);
                        setDetailValue(task.id, "urgency_flag", next);
                        commitDetail(task, "urgency_flag", next);
                      }}
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    >
                      <option value="">Keine Kennzeichnung</option>
                      {URGENCY_FLAG_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-sand-500">
                    <input
                      type="checkbox"
                      checked={Boolean(getDetailValue(task, "randzeit"))}
                      onChange={(event) =>
                        setDetailValue(task.id, "randzeit", event.target.checked)
                      }
                      onBlur={() => commitDetail(task, "randzeit")}
                      className="h-4 w-4 rounded border border-amber-200 text-amber-600 focus:ring-2 focus:ring-amber-200"
                    />
                    Randzeit
                  </label>
                  <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-sand-500">
                    <input
                      type="checkbox"
                      checked={Boolean(getDetailValue(task, "kulant"))}
                      onChange={(event) => {
                        const nextValue = event.target.checked;
                        setDetailValue(task.id, "kulant", nextValue);
                        commitDetail(task, "kulant", nextValue);
                      }}
                      className="h-4 w-4 rounded border border-amber-200 text-amber-600 focus:ring-2 focus:ring-amber-200"
                    />
                    Kulant
                  </label>
                  <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-sand-500">
                    <input
                      type="checkbox"
                      checked={Boolean(getDetailValue(task, "wartungsvertrag"))}
                      onChange={(event) => {
                        const nextValue = event.target.checked;
                        setDetailValue(task.id, "wartungsvertrag", nextValue);
                        commitDetail(task, "wartungsvertrag", nextValue);
                      }}
                      className="h-4 w-4 rounded border border-amber-200 text-amber-600 focus:ring-2 focus:ring-amber-200"
                    />
                    Wartungsvertrag
                  </label>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-sand-500">
                    Notiz
                  </label>
                  <textarea
                    value={getDetailValue(task, "details")}
                    onChange={(event) => setDetailValue(task.id, "details", event.target.value)}
                    onBlur={() => commitDetail(task, "details")}
                    placeholder="Interne Notiz zur Aufgabe"
                    className="mt-1 w-full min-h-[80px] rounded-lg border border-amber-200 bg-white px-2 py-2 text-xs text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-sand-50 touch-manipulation md:touch-auto">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center shadow-soft">
              <ClipboardList size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-2xl font-display text-sand-900">Tagesplan</h1>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 md:flex-row md:items-center">
            <div className="text-sm text-sand-500">
              {customerFilter.trim()
                ? `${filteredOpenTasks} von ${totalOpenTasks} Aufgaben`
                : `${totalOpenTasks} Aufgaben`}
            </div>
            <div className="w-full rounded-xl border border-sand-200 bg-white/70 p-2 shadow-soft">
              <div className="grid gap-1.5 md:grid-cols-12 md:items-end">
                <label className="md:col-span-3 text-[9px] uppercase tracking-[0.25em] text-sand-500">
                  Kunde
                  <div className="relative mt-1">
                    <input
                      value={customerFilter}
                      onChange={(event) => setCustomerFilter(event.target.value)}
                      placeholder="Name oder Nummer"
                      className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 pr-7 text-[11px] text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                    {customerFilter.trim() ? (
                      <button
                        type="button"
                        onClick={() => setCustomerFilter("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border border-sand-200 bg-white p-0.5 text-sand-400 hover:bg-sand-100"
                        title="Filter löschen"
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </div>
                </label>
                <label className="md:col-span-3 text-[9px] uppercase tracking-[0.25em] text-sand-500">
                  Inhalt
                  <div className="relative mt-1">
                    <input
                      value={contentFilter}
                      onChange={(event) => setContentFilter(event.target.value)}
                      placeholder="Titel oder Notiz"
                      className="w-full rounded-lg border border-sand-200 bg-white px-2 py-1 pr-7 text-[11px] text-sand-700 focus:outline-none focus:ring-2 focus:ring-sand-200"
                    />
                    {contentFilter.trim() ? (
                      <button
                        type="button"
                        onClick={() => setContentFilter("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full border border-sand-200 bg-white p-0.5 text-sand-400 hover:bg-sand-100"
                        title="Suche löschen"
                      >
                        <X size={12} />
                      </button>
                    ) : null}
                  </div>
                </label>
                <label className="md:col-span-2 text-[9px] uppercase tracking-[0.25em] text-sand-500">
                  Offen seit
                  <input
                    type="number"
                    min="0"
                    value={openSinceFilter}
                    onChange={(event) => setOpenSinceFilter(event.target.value)}
                    placeholder="Tage"
                    className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-2 py-1 text-[11px] text-sand-700 focus:outline-none focus:ring-2 focus:ring-sand-200"
                  />
                </label>
                <label className="md:col-span-2 text-[9px] uppercase tracking-[0.25em] text-sand-500">
                  Mitarbeiter
                  <select
                    value={employeeFilter}
                    onChange={(event) => setEmployeeFilter(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-2 py-1 text-[11px] text-sand-700 focus:outline-none focus:ring-2 focus:ring-sand-200"
                  >
                    <option value="all">Alle</option>
                    <option value="assigned">Zugewiesen</option>
                    <option value="unassigned">Unzugewiesen</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={String(employee.id)}>
                        {employee.short_code || employee.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 text-[9px] uppercase tracking-[0.25em] text-sand-500">
                  Sortierung
                  <select
                    value={openSort}
                    onChange={(event) => setOpenSort(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-sand-200 bg-white px-2 py-1 text-[11px] text-sand-700 focus:outline-none focus:ring-2 focus:ring-sand-200"
                  >
                    <option value="urgency">Dringlichkeit</option>
                    <option value="name">Kunde</option>
                    <option value="age_desc">Offen (älteste)</option>
                    <option value="age_asc">Offen (neueste)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-1">
          {columns.map((column) => (
            <div
              key={column.id}
              className={`rounded-2xl border shadow-[0_6px_20px_rgba(150,120,60,0.08)] p-4 transition min-h-[60vh] ${
                dragOver === column.id
                  ? "border-sand-300 bg-sand-100"
                  : "border-sand-200 bg-white"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(column.id);
              }}
              onDragLeave={() => setDragOver("")}
              onDrop={(event) => handleDrop(event, column.id)}
            >
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm uppercase tracking-[0.3em] text-sand-500">
                    {column.label}
                  </h2>
                  {column.id === "todo" ? (
                    <div
                      ref={emailDropBadgeRef}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${
                        emailDropHover
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-sand-200 bg-sand-50 text-sand-500"
                      }`}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setEmailDropHover(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setEmailDropHover(true);
                        if (event.dataTransfer) {
                          event.dataTransfer.dropEffect = "copy";
                        }
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setEmailDropHover(false);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const transfer = event.dataTransfer || event.nativeEvent?.dataTransfer;
                        if (!transfer) return;
                        triggerEmailDropTransfer(transfer);
                      }}
                      title="E-Mail hier ablegen, um Aufgabe per KI vorzubereiten"
                    >
                      <Plus size={9} />
                      <Mail size={9} />
                      <span>email drag&drop</span>
                      {emailDropBusy ? <span className="text-[8px]">…</span> : null}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-sand-500">{grouped[column.id].length}</span>
                  <input
                    value={groupDrafts.todo || ""}
                    onChange={(event) =>
                      setGroupDrafts((prev) => ({ ...prev, todo: event.target.value }))
                    }
                    onKeyDown={(event) => {
                      if (event.isComposing || event.keyCode === 229 || event.repeat) return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createGroup("todo");
                      }
                    }}
                    placeholder="Neue Gruppe…"
                    className="w-28 rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <button
                    type="button"
                    onClick={() => createGroup("todo")}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-1 text-sand-700 hover:bg-amber-100"
                    title="Gruppe anlegen"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                  <div
                    className="rounded-xl border border-dashed border-sand-200 bg-white px-3 py-2"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleUngroupedDrop(event, column.id)}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase tracking-[0.25em] text-sand-400">
                        Ohne Gruppe
                      </h3>
                      <span className="text-[10px] text-sand-400">
                        {grouped[column.id].filter((task) => !task.group_id).length}
                      </span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <input
                        onKeyDown={(event) => {
                          if (event.isComposing || event.keyCode === 229 || event.repeat) return;
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const value = event.currentTarget.value;
                            addTaskToGroup(null, value);
                            event.currentTarget.value = "";
                          }
                        }}
                        placeholder="Neue Aufgabe…"
                        className="w-full rounded-full border border-amber-200 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-3 md:py-1 md:text-xs"
                      />
                      {grouped[column.id].filter((task) => !task.group_id).length ? (
                        grouped[column.id]
                          .filter((task) => !task.group_id)
                          .map((task) => renderTaskCard(task))
                      ) : (
                        <div className="text-xs text-sand-400">Keine Aufgaben.</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                  {groupsByColumn[column.id].map((group) => (
                    <div
                      key={group.id}
                      className={`rounded-lg border border-sand-200 bg-white px-2 py-1.5 ${
                        dragOverGroupId === group.id ? "ring-2 ring-sand-300" : ""
                      }`}
                      onDragOver={(event) => handleGroupDragOver(event, group.id)}
                      onDragLeave={() => setDragOverGroupId(null)}
                      onDrop={(event) => handleGroupDrop(event, group, column.id)}
                    >
                      <div
                        className="flex items-center gap-2"
                        onDragOver={(event) => handleGroupDragOver(event, group.id)}
                        onDrop={(event) => handleGroupDrop(event, group, column.id)}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", `group:${group.id}`);
                          }}
                          className="rounded-full border border-sand-200 bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-sand-400 hover:bg-sand-100"
                          title="Gruppe verschieben"
                        >
                          ::
                        </button>
                        {editingGroupId === group.id ? (
                          <input
                            value={editingGroupTitle}
                            onChange={(event) => setEditingGroupTitle(event.target.value)}
                            onBlur={() => commitGroupEdit(group)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitGroupEdit(group);
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditingGroupId(null);
                                setEditingGroupTitle("");
                              }
                            }}
                            className="flex-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startGroupEdit(group)}
                            className="text-left text-xs uppercase tracking-[0.25em] text-sand-600 hover:text-sand-800"
                            title="Gruppe umbenennen"
                          >
                            {group.title}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => updateGroup(group, { pinned: !group.pinned })}
                          className={`rounded-full border p-1 ${
                            group.pinned
                              ? "border-amber-300 bg-amber-100 text-amber-700"
                              : "border-sand-200 bg-white text-sand-400 hover:bg-amber-50"
                          }`}
                          title={group.pinned ? "Gruppe lösen" : "Gruppe anheften"}
                        >
                          <Star size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeGroup(group)}
                          className="ml-auto text-[10px] uppercase tracking-wide text-rose-500 hover:text-rose-700"
                        >
                          Entfernen
                        </button>
                      </div>
                      <div
                        className="mt-2 space-y-2"
                        onDragOver={(event) => handleGroupDragOver(event, group.id)}
                        onDrop={(event) => handleGroupDrop(event, group, column.id)}
                      >
                        {grouped[column.id].filter((task) => task.group_id === group.id).length ? (
                          grouped[column.id]
                            .filter((task) => task.group_id === group.id)
                            .map((task) => renderTaskCard(task))
                        ) : (
                          <div className="text-xs text-sand-400">Ziehe Aufgaben hierher.</div>
                        )}
                        <input
                          onKeyDown={(event) => {
                            if (event.isComposing || event.keyCode === 229 || event.repeat) return;
                            if (event.key === "Enter") {
                              event.preventDefault();
                              const value = event.currentTarget.value;
                              addTaskToGroup(group.id, value);
                              event.currentTarget.value = "";
                            }
                          }}
                          placeholder="Neue Aufgabe…"
                          className="w-full rounded-full border border-amber-200 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-3 md:py-1 md:text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-[0_6px_20px_rgba(150,120,60,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm uppercase tracking-[0.3em] text-sand-500">Erledigt</h2>
              <p className="text-xs text-sand-400 mt-1">Ziehe Aufgaben hierher</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-full md:w-52">
                <input
                  value={doneFilter}
                  onChange={(event) => setDoneFilter(event.target.value)}
                  placeholder="Suche..."
                  className="w-full rounded-full border border-amber-200 bg-white px-4 py-2 pr-9 text-base focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-3 md:py-1 md:text-xs"
                />
                {doneFilter.trim() ? (
                  <button
                    type="button"
                    onClick={() => setDoneFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-sand-200 bg-white p-1 text-sand-400 hover:bg-sand-100"
                    title="Filter löschen"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-3 text-xs text-sand-500">
                <span>
                  {doneFilter.trim()
                    ? `${filteredDoneTasks.length} / ${doneTasks.length}`
                    : doneTasks.length}
                </span>
                <label className="flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-sand-500">
                  <input
                    type="checkbox"
                    checked={showKulantDone}
                    onChange={(event) => setShowKulantDone(event.target.checked)}
                    className="h-3 w-3 rounded border border-sand-300 text-amber-600 focus:ring-2 focus:ring-amber-200"
                  />
                  Kulant/Wartungsvertrag anzeigen
                </label>
              </div>
            </div>
          </div>
          <div
            className="space-y-2 max-h-[45vh] overflow-auto pr-1"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDoneDrop}
          >
            {filteredDoneTasks.length ? (
              filteredDoneTasks.map((task) => renderTaskCard(task))
            ) : (
              <div className="text-xs text-sand-400">Noch keine erledigten Aufgaben.</div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-[0_6px_20px_rgba(150,120,60,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm uppercase tracking-[0.3em] text-amber-700">Fakturiert</h2>
              <p className="text-xs text-amber-600 mt-1">Automatisch via Faktura-Button</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-52">
                <input
                  value={billedFilter}
                  onChange={(event) => setBilledFilter(event.target.value)}
                  placeholder="Suche..."
                  className="w-full rounded-full border border-amber-200 bg-white px-4 py-2 pr-9 text-base focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-3 md:py-1 md:text-xs"
                />
                {billedFilter.trim() ? (
                  <button
                    type="button"
                    onClick={() => setBilledFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-sand-200 bg-white p-1 text-sand-400 hover:bg-sand-100"
                    title="Filter löschen"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
              <span className="text-xs text-amber-700">
                {billedFilter.trim()
                  ? `${filteredBilledTasks.length} / ${billedTasks.length}`
                  : billedTasks.length}
              </span>
            </div>
          </div>
          <div className="space-y-2 max-h-[45vh] overflow-auto pr-1">
            {filteredBilledTasks.length ? (
              filteredBilledTasks.map((task) => renderTaskCard(task))
            ) : (
              <div className="text-xs text-amber-600">Noch keine fakturierten Aufgaben.</div>
            )}
          </div>
        </section>
      </main>
      <datalist id="dayplan-customers">
        {customers.map((customer) => (
          <option key={customer.id} value={customer.name} />
        ))}
      </datalist>
      <FakturaTaskModal
        open={sevdeskDraftOpen}
        task={sevdeskDraftTask}
        form={sevdeskDraftForm}
        status={sevdeskDraftStatus}
        aiLoading={sevdeskDraftAiLoading}
        advancedOpen={sevdeskDraftAdvancedOpen}
        hasToken={sevdeskTokenAvailable || sevdeskDefaults.has_sevdesk_api_token}
        missingInvoiceFields={missingSevdeskInvoiceFields}
        draftCheck={sevdeskDraftCheck}
        travelMetrics={sevdeskDraftMetrics}
        travelStatus={sevdeskDraftMetricsStatus}
        scopeEstimate={sevdeskDraftEstimate}
        scopeEstimateStatus={sevdeskDraftEstimateStatus}
        onClose={closeSevdeskDraft}
        onSubmit={submitSevdeskDraft}
        onGenerateAi={generateSevdeskDraftText}
        onRefreshScopeEstimate={() => refreshSevdeskDraftEstimate()}
        onApplyScopeEstimate={() => {
          if (!sevdeskDraftEstimate?.estimated_hours) return;
          updateSevdeskDraftForm("quantity", String(sevdeskDraftEstimate.estimated_hours));
        }}
        onApplyActualHours={() => {
          const actualRoundedHours = roundUpToQuarterHours(Number(sevdeskDraftForm?.actual_rounded_hours || 0));
          if (!actualRoundedHours) return;
          updateSevdeskDraftForm("quantity", String(actualRoundedHours));
        }}
        onApplyMinimumHours={() => {
          const minimumHours = roundUpToQuarterHours(Number(sevdeskDraftForm?.minimum_billable_hours || 0));
          if (!minimumHours) return;
          updateSevdeskDraftForm("quantity", String(minimumHours));
        }}
        onApplyDocumentedMaximum={() => {
          const actualRoundedHours = roundUpToQuarterHours(Number(sevdeskDraftForm?.actual_rounded_hours || 0));
          const minimumHours = roundUpToQuarterHours(Number(sevdeskDraftForm?.minimum_billable_hours || 0));
          const documentedMaximum = Math.max(actualRoundedHours, minimumHours);
          if (!documentedMaximum) return;
          updateSevdeskDraftForm("quantity", String(documentedMaximum));
        }}
        onPersistDocumentation={persistSevdeskDraftDocumentation}
        onToggleAdvanced={() => setSevdeskDraftAdvancedOpen((current) => !current)}
        onChange={updateSevdeskDraftForm}
      />
      <EmailTaskModal
        open={emailTaskModalOpen}
        draft={emailTaskDraft}
        analyzing={emailTaskAnalyzing}
        error={emailTaskError}
        saving={emailTaskSaving}
        onClose={closeEmailTaskModal}
        onSubmit={submitEmailTaskDraft}
        onChange={(field, value) =>
          setEmailTaskDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
        }
      />
    </div>
  );
}

function EmailTaskModal({ open, draft, analyzing, error, saving, onClose, onSubmit, onChange }) {
  if (!open || !draft) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-sand-900/50 px-4 py-6">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-sand-100 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">E-Mail zu Aufgabe</p>
            <h3 className="text-lg font-display text-sand-900">Neue Aufgabe aus E-Mail</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand-200 bg-white p-2 text-sand-500 hover:bg-sand-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3 px-6 py-4 text-xs text-sand-600">
          {analyzing ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              KI analysiert E-Mail...
            </div>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Titel</span>
            <input
              value={draft.title || ""}
              onChange={(event) => onChange("title", event.target.value)}
              disabled={analyzing}
              className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Kunde</span>
            <input
              value={draft.customer || ""}
              onChange={(event) => onChange("customer", event.target.value)}
              list="dayplan-customers"
              disabled={analyzing}
              placeholder="Kundenvorschlag aus E-Mail"
              className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Notiz</span>
            <textarea
              value={draft.details || ""}
              onChange={(event) => onChange("details", event.target.value)}
              disabled={analyzing}
              className="min-h-[130px] w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </label>
          {draft.subject || draft.from_email ? (
            <div className="rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-[11px] text-sand-500">
              {draft.subject ? <div>Betreff: {draft.subject}</div> : null}
              {draft.from_email ? <div>Absender: {draft.from_email}</div> : null}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-sand-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand-200 px-4 py-1.5 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || analyzing || !String(draft.title || "").trim()}
            className="inline-flex items-center justify-center rounded-full bg-sand-900 px-4 py-1.5 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analyzing ? "Analysiere..." : saving ? "Erstelle..." : "Aufgabe anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FakturaTaskModal({
  open,
  task,
  form,
  status,
  aiLoading,
  advancedOpen,
  hasToken,
  missingInvoiceFields,
  draftCheck,
  travelMetrics,
  travelStatus,
  scopeEstimate,
  scopeEstimateStatus,
  onClose,
  onSubmit,
  onGenerateAi,
  onRefreshScopeEstimate,
  onApplyScopeEstimate,
  onApplyActualHours,
  onApplyMinimumHours,
  onApplyDocumentedMaximum,
  onPersistDocumentation,
  onToggleAdvanced,
  onChange
}) {
  if (!open || !task || !form) return null;
  const isSaving = status?.state === "saving";
  const isScopeEstimateLoading = scopeEstimateStatus?.state === "loading";
  const hasScopeEstimateError = scopeEstimateStatus?.state === "error";
  const hasScopeEstimate = Boolean(scopeEstimate);
  const hasCustomerNumber = String(form.customer_number || "").trim().length > 0;
  const hasDraft = Boolean(draftCheck?.hasDraft);
  const contactFound = draftCheck?.contactFound !== false;
  const hasMissingInvoiceFields = Array.isArray(missingInvoiceFields) && missingInvoiceFields.length > 0;
  const mileageEur = Number(travelMetrics?.mileageEur || 0);
  const roundTripKm = Number(
    travelMetrics?.distanceRoundTripKm ||
      (Number(travelMetrics?.distanceKm || 0) > 0 ? Number(travelMetrics.distanceKm) * 2 : 0)
  );
  const hasMileageSuggestion = Number.isFinite(mileageEur) && mileageEur > 0;
  const formatHourValue = (value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return "-";
    return numeric.toLocaleString("de-DE", {
      minimumFractionDigits: numeric % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
  };
  const roundHourValue = (value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.ceil(numeric * 4) / 4;
  };
  const actualHours = Number(form.actual_hours || 0);
  const actualRoundedHours = roundHourValue(Number(form.actual_rounded_hours || actualHours || 0));
  const minimumBillableHours = roundHourValue(Number(form.minimum_billable_hours || 0));
  const invoiceQuantity = roundHourValue(Number(form.quantity || 0));
  const documentedMaximum = Math.max(actualRoundedHours, minimumBillableHours);
  const confidenceLabel =
    scopeEstimate?.confidence === "high"
      ? "Hohe Sicherheit"
      : scopeEstimate?.confidence === "medium"
      ? "Mittlere Sicherheit"
      : "Niedrige Sicherheit";
  const comparisonToneClass =
    scopeEstimate?.comparison === "within"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : scopeEstimate?.comparison === "below"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : scopeEstimate?.comparison === "above"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-sand-200 bg-sand-50 text-sand-600";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-sand-900/50 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-sand-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-sand-100 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Faktura</p>
            <h3 className="text-lg font-display text-sand-900">Rechnungsentwurf aus Aufgabe</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand-200 bg-white p-2 text-sand-500 hover:bg-sand-50"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-sand-400">Aufgabe</p>
            <p className="text-sm text-sand-900">{task.title}</p>
          </div>
          {!hasToken ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Sevdesk API Token fehlt in den Einstellungen.
            </div>
          ) : null}
          {hasToken && hasMissingInvoiceFields ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              In den sevdesk-Einstellungen fehlen: Kontaktperson-ID, Adressland-ID,
              Standard-Unity-ID. Bitte in den Einstellungen ergänzen.
            </div>
          ) : null}
          {!task.customer ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Bitte zuerst einen Kunden zuweisen. Ohne Kunde keine Übergabe an sevdesk.
            </div>
          ) : null}
          {task.customer && !hasCustomerNumber ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Kundennummer fehlt im Kundenstamm.
            </div>
          ) : null}
          {hasToken && !contactFound ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Kunde in sevdesk nicht gefunden.
            </div>
          ) : null}
          {hasToken && contactFound && hasDraft ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Es existiert bereits ein offener Entwurf. Bitte wählen, ob dieser genutzt werden soll.
            </div>
          ) : null}
          {hasToken && contactFound && hasDraft ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-sand-600">
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Entwurf wählen
              </span>
              <button
                type="button"
                onClick={() => onChange("use_existing_draft", true)}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
                  form.use_existing_draft !== false
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50"
                }`}
              >
                Bestehenden verwenden
              </button>
              <button
                type="button"
                onClick={() => onChange("use_existing_draft", false)}
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
                  form.use_existing_draft === false
                    ? "border-sand-900 bg-sand-900 text-white"
                    : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50"
                }`}
              >
                Neuen Entwurf erstellen
              </button>
            </div>
          ) : null}
          {travelStatus === "loading" ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              Lade Anfahrtsvorschlag aus dem Kundenstamm...
            </div>
          ) : null}
          {travelStatus === "error" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Anfahrtsvorschlag konnte nicht geladen werden.
            </div>
          ) : null}
          {travelStatus === "ready" && hasMileageSuggestion ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-sky-700">Anfahrt Vorschlag</p>
                  <p className="mt-1 text-sm font-semibold text-sand-900">
                    {mileageEur.toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </p>
                  <p className="text-[11px] text-sand-600">
                    {roundTripKm > 0
                      ? `${roundTripKm.toLocaleString("de-DE", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1
                        })} km Hin/Rueckfahrt`
                      : "Betrag aus Kundenstamm"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange("include_mileage", !form.include_mileage)}
                  className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${
                    form.include_mileage
                      ? "border-sand-900 bg-sand-900 text-white"
                      : "border-sand-200 bg-white text-sand-600 hover:bg-sand-50"
                  }`}
                >
                  {form.include_mileage ? "Anfahrt aktiv" : "Zur Rechnung hinzufügen"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="rounded-2xl border border-sand-200 bg-sand-50/80 px-3 py-2.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Aufwandsübersicht</p>
                <span className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[10px] text-sand-600">
                  Ist-Zeit bleibt Dokumentation
                </span>
              </div>
              <button
                type="button"
                onClick={onRefreshScopeEstimate}
                className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100"
              >
                <Sparkles size={12} />
                {hasScopeEstimate ? "KI neu" : "KI schätzen"}
              </button>
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 text-xs text-sand-600">
              <div className="rounded-xl border border-white/80 bg-white px-3 py-2.5 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.25em] text-sand-500">Tatsächlich</p>
                <p className="text-base font-semibold text-sand-900">
                  {actualHours > 0 ? `${formatHourValue(actualHours)} h` : "Keine Zeit"}
                </p>
                <p className="text-[10px] text-sand-500">
                  Gerundet: {formatHourValue(actualRoundedHours)} h
                </p>
                <button
                  type="button"
                  onClick={onApplyActualHours}
                  disabled={!actualRoundedHours}
                  className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:opacity-50"
                >
                  Übernehmen
                </button>
              </div>

              <div className="rounded-xl border border-white/80 bg-white px-3 py-2.5 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.25em] text-sand-500">Mindestens wert</p>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.minimum_billable_hours || ""}
                  onChange={(event) => onChange("minimum_billable_hours", event.target.value)}
                  onBlur={() =>
                    onPersistDocumentation({
                      billing_min_hours: roundHourValue(Number(form.minimum_billable_hours || 0))
                    })
                  }
                  className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="0,75"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] text-sand-500">Interner Mindestwert.</p>
                  <button
                    type="button"
                    onClick={onApplyMinimumHours}
                    disabled={!minimumBillableHours}
                    className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:opacity-50"
                  >
                    Übernehmen
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/80 bg-white px-3 py-2.5 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.25em] text-sand-500">Rechnungsmenge</p>
                <p className="text-base font-semibold text-sand-900">
                  {invoiceQuantity > 0 ? `${formatHourValue(invoiceQuantity)} h` : "Nicht gesetzt"}
                </p>
                <p className="text-[10px] text-sand-500">
                  {documentedMaximum > 0
                    ? `Dokumentiert: ${formatHourValue(documentedMaximum)} h`
                    : "Kein Richtwert"}
                </p>
                <button
                  type="button"
                  onClick={onApplyDocumentedMaximum}
                  disabled={!documentedMaximum}
                  className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:opacity-50"
                >
                  Max übernehmen
                </button>
              </div>

              <div className="rounded-xl border border-white/80 bg-white px-3 py-2.5 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-sand-500">KI Schätzung</p>
                  {hasScopeEstimate ? (
                    <span className="rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-700">
                      {confidenceLabel}
                    </span>
                  ) : null}
                </div>
                {hasScopeEstimate ? (
                  <>
                    <p className="text-base font-semibold text-sand-900">
                      {formatHourValue(scopeEstimate.estimated_hours)} h
                    </p>
                    <p className="text-[10px] text-sand-500">
                      {formatHourValue(scopeEstimate.estimated_min_hours)} bis{" "}
                      {formatHourValue(scopeEstimate.estimated_max_hours)} h
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={onApplyScopeEstimate}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[10px] uppercase tracking-wide text-sky-700 hover:bg-sky-100"
                      >
                        <Sparkles size={12} />
                        Übernehmen
                      </button>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${comparisonToneClass}`}
                      >
                        {scopeEstimate.comparison_label}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-sand-500">Optional per Klick abrufen.</p>
                )}
              </div>
            </div>

            {isScopeEstimateLoading ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700 inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                KI analysiert Arbeitsumfang...
              </div>
            ) : null}
            {hasScopeEstimateError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {scopeEstimateStatus?.error || "Arbeitsumfang konnte nicht analysiert werden."}
              </div>
            ) : null}
            {hasScopeEstimate ? (
              <div className="text-[10px] text-sand-500">
                Quelle: {scopeEstimate.provider === "ollama" ? "KI" : "Fallback"}
                {scopeEstimate.provider === "ollama" && scopeEstimate.model
                  ? ` (${scopeEstimate.model})`
                  : ""}
              </div>
            ) : null}

            <label className="flex flex-col gap-2 text-xs text-sand-600">
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Interner Abrechnungsvermerk
              </span>
              <textarea
                value={form.billing_note || ""}
                onChange={(event) => onChange("billing_note", event.target.value)}
                onBlur={() =>
                  onPersistDocumentation({
                    billing_note: String(form.billing_note || "")
                  })
                }
                rows={2}
                className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="z. B. vor Ort Eskalation, mehrere Unterbrechungen, hoher Abstimmungsaufwand"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2 text-xs text-sand-600">
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Kundennummer (Kundenstamm)
              </span>
              <input
                value={form.customer_number}
                onChange={(event) => onChange("customer_number", event.target.value)}
                disabled
                className="w-full rounded-2xl border border-sand-200 bg-sand-50 px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Keine Kundennummer"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Rechnungsheader
              </span>
              <input
                value={form.header}
                onChange={(event) => onChange("header", event.target.value)}
                className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Leistungsnachweis"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">Menge (h)</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={form.quantity}
                onChange={(event) => onChange("quantity", event.target.value)}
                className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Preis (EUR)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(event) => onChange("price", event.target.value)}
                className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                Positionsname
              </span>
              <input
                value={form.name}
                onChange={(event) => onChange("name", event.target.value)}
                className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Erledigte Aufgabe"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-xs text-sand-600">
            <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
              Positionstext
            </span>
            <textarea
              value={form.text}
              onChange={(event) => onChange("text", event.target.value)}
              className="min-h-[120px] w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="Leistung, Ergebnis oder Hinweise"
            />
          </label>
          <div className="flex items-center justify-between text-[11px] text-sand-500">
            <button
              type="button"
              onClick={onGenerateAi}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 rounded-full border border-sand-200 bg-white px-3 py-1 text-xs uppercase tracking-wide text-sand-700 hover:bg-sand-100 disabled:cursor-wait"
            >
              <Sparkles size={12} />
              {aiLoading ? "KI verbessert..." : "Text verbessern"}
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleAdvanced}
            className="text-xs uppercase tracking-[0.3em] text-sand-500"
          >
            {advancedOpen ? "Erweiterte Felder ausblenden" : "Erweiterte Felder anzeigen"}
          </button>
          {advancedOpen ? (
            <div className="grid gap-3 md:grid-cols-2 text-xs text-sand-600">
              <label className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                  Steuer (Rate)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.tax_rate}
                  onChange={(event) => onChange("tax_rate", event.target.value)}
                  className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[10px] uppercase tracking-[0.3em] text-sand-500">
                  Unity ID
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.unity_id}
                  onChange={(event) => onChange("unity_id", event.target.value)}
                  className="w-full rounded-2xl border border-sand-200 bg-white px-3 py-2 text-sm text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </label>
            </div>
          ) : null}
          {status?.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {status.error}
            </div>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-sand-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-sand-200 px-4 py-1.5 text-xs uppercase tracking-wide text-sand-600 hover:bg-sand-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!hasToken || !hasCustomerNumber || isSaving || hasMissingInvoiceFields}
            className="inline-flex items-center justify-center rounded-full bg-sand-900 px-4 py-1.5 text-xs uppercase tracking-wide text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Übergabe läuft..."
              : hasDraft && form.use_existing_draft !== false
              ? "Position hinzufügen"
              : "Rechnungsentwurf erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}
