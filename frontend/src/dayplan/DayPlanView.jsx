import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  DollarSign,
  Heart,
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
  const lastCreateRef = useRef({ text: "", groupId: null, at: 0 });

  useEffect(() => {
    api.list().then((data) => {
      setTasks(Array.isArray(data) ? data : []);
    });
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
    const payload = event.dataTransfer.getData("text/plain");
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

  const commitDetail = async (task, field) => {
    const value = getDetailValue(task, field);
    if (value === (task?.[field] || "")) return;
    const patch = { [field]: value };
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
        randzeit: Boolean(task.randzeit),
        details: task.details || ""
      }
    }));
  };

  const openSevdeskDraft = async (task) => {
    const latestDefaults = (await refreshSevdeskDefaults()) || sevdeskDefaults;
    setSevdeskDraftTask(task);
    setSevdeskDraftForm(buildSevdeskDraftDefaults(task, latestDefaults));
    setSevdeskDraftStatus({ state: "idle", error: "" });
    setSevdeskDraftAdvancedOpen(false);
    setSevdeskDraftOpen(true);
  };

  const updateSevdeskDraftForm = (field, value) => {
    setSevdeskDraftForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  };

  const closeSevdeskDraft = () => {
    setSevdeskDraftOpen(false);
    setSevdeskDraftTask(null);
    setSevdeskDraftForm(null);
    setSevdeskDraftStatus({ state: "idle", error: "" });
    setSevdeskDraftAiLoading(false);
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
      const contextParts = [
        sevdeskDraftTask.title ? `Aufgabe: ${sevdeskDraftTask.title}` : "",
        sevdeskDraftTask.customer ? `Kunde: ${sevdeskDraftTask.customer}` : "",
        sevdeskDraftTask.details ? `Notiz: ${sevdeskDraftTask.details}` : ""
      ]
        .filter(Boolean)
        .join("\n");
      const res = await fetch(`${API}/offer_ai_text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "position_text",
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
      await updateTask(task, { customer: trimmed });
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

  function getCustomerShortCodeForTask(task) {
    const name = String(task?.customer || "").trim().toLowerCase();
    if (!name) return "";
    const match = customers.find(
      (customer) => String(customer?.name || "").trim().toLowerCase() === name
    );
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
    map.todo =
      openSort === "age_desc"
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
        .sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
    [grouped.done]
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
    const name = String(task?.customer || "").trim().toLowerCase();
    if (!name) return "";
    const match = customers.find(
      (customer) => String(customer?.name || "").trim().toLowerCase() === name
    );
    return String(match?.creditor_number || "").trim();
  };


  const buildSevdeskDraftDefaults = (task, defaultsOverride) => {
    const defaults = defaultsOverride || sevdeskDefaults;
    const elapsedMs = getElapsedMsForTask(task);
    const hours = elapsedMs > 0 ? elapsedMs / 3_600_000 : 0;
    const roundedHours = roundUpToQuarterHours(hours);
    const unityDefault = defaults.service_unity_id || defaults.unity_id || "";
    const title = String(task?.title || "").trim();
    const details = String(task?.details || "").trim();
    const positionText = title && details ? `${title}. Notiz: ${details}` : title || details;
    return {
      customer_number: getCustomerNumberForTask(task),
      header: "Leistungsnachweis",
      name: "Arbeitszeit",
      text: positionText,
      quantity: roundedHours > 0 ? String(roundedHours) : "1",
      price: defaults.hourly_rate_eur ? String(defaults.hourly_rate_eur) : "",
      tax_rate: defaults.default_tax_rate ? String(defaults.default_tax_rate) : "",
      unity_id: unityDefault ? String(unityDefault) : "",
      use_existing_draft: true
    };
  };

  const knownCustomerNames = useMemo(
    () =>
      customers
        .map((item) => String(item?.name || "").trim().toLowerCase())
        .filter(Boolean),
    [customers]
  );

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

  const isKnownCustomer = (value) => {
    const name = String(value || "").trim().toLowerCase();
    return name ? knownCustomerNames.includes(name) : false;
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
    const canInvoice = Boolean(customerNumber);
    const isBilled = Boolean(task.aberechnet);
    const knownCustomer = isKnownCustomer(task.customer);
    const assignedEmployee = employees.find((employee) => employee.id === task.employee_id);
    const timeTask = task.time_enabled ? task : null;
    const elapsedMs = timeTask
      ? (timeTask.elapsed || 0) +
        (timeTask.running && timeTask.startTime ? nowMs - timeTask.startTime : 0)
      : 0;
    const timeInputValue = timeEdits[task.id] ?? msToHHMMSS(elapsedMs);
    const isTimerCollapsed = Boolean(collapsedTimers[task.id]);
    const hasDeadline = Boolean(String(task?.deadline || "").trim());
    const isDetailsCollapsed = detailOpenId !== task.id;
    return (
      <div
        key={task.id}
        className="relative rounded-lg border border-sand-200 bg-white px-3 py-2 shadow-[0_2px_6px_rgba(150,120,60,0.08)] md:px-2 md:py-1.5"
        draggable={editingId !== task.id}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", `task:${task.id}`);
        }}
      >
        {hasDeadline && isDetailsCollapsed ? (
          <div className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[14px] border-t-[14px] border-l-transparent border-t-rose-500" />
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
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
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
              <div className="mt-1 flex w-full items-start gap-2">
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
                {!isDone ? (
                  <span className="ml-auto whitespace-nowrap text-[10px] text-sand-400">
                    offen seit {openSinceDays(task.created_at)} Tagen
                  </span>
                ) : null}
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
                <div className="grid gap-2 md:grid-cols-3">
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
                  <div className="md:col-span-3">
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
            <div className="flex items-center gap-2">
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
              <span className="text-xs text-sand-500">
                {doneFilter.trim()
                  ? `${filteredDoneTasks.length} / ${doneTasks.length}`
                  : doneTasks.length}
              </span>
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
        onClose={closeSevdeskDraft}
        onSubmit={submitSevdeskDraft}
        onGenerateAi={generateSevdeskDraftText}
        onToggleAdvanced={() => setSevdeskDraftAdvancedOpen((current) => !current)}
        onChange={updateSevdeskDraftForm}
      />
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
  onClose,
  onSubmit,
  onGenerateAi,
  onToggleAdvanced,
  onChange
}) {
  if (!open || !task || !form) return null;
  const isSaving = status?.state === "saving";
  const hasCustomerNumber = String(form.customer_number || "").trim().length > 0;
  const hasDraft = Boolean(draftCheck?.hasDraft);
  const contactFound = draftCheck?.contactFound !== false;
  const hasMissingInvoiceFields = Array.isArray(missingInvoiceFields) && missingInvoiceFields.length > 0;
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
