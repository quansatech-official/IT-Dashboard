import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  DollarSign,
  Heart,
  Play,
  Sparkles,
  Square,
  Star,
  Trash2,
  Undo2
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

export default function DayPlanView() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
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
  const [detailOpenId, setDetailOpenId] = useState(null);
  const [detailEdits, setDetailEdits] = useState({});
  const [collapsedTimers, setCollapsedTimers] = useState({});
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

  useEffect(() => {
    api.groups().then((data) => {
      setGroups(Array.isArray(data) ? data : []);
    });
  }, []);

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

  const grouped = useMemo(() => {
    const map = { todo: [], done: [] };
    tasks.forEach((task) => {
      const bucket = task.status === "done" ? "done" : "todo";
      map[bucket].push(task);
    });
    const normalizeCustomer = (value) => String(value || "").trim().toLowerCase();
    const sortByCustomer = (items) =>
      [...items].sort((a, b) => {
        const aCustomer = normalizeCustomer(a.customer);
        const bCustomer = normalizeCustomer(b.customer);
        if (aCustomer && bCustomer && aCustomer !== bCustomer) {
          return aCustomer.localeCompare(bCustomer, "de");
        }
        if (aCustomer && !bCustomer) return -1;
        if (!aCustomer && bCustomer) return 1;
        return (b.created_at || 0) - (a.created_at || 0);
      });
    map.todo = sortByCustomer(map.todo);
    map.done = sortByCustomer(map.done);
    return map;
  }, [tasks]);

  const doneTasks = useMemo(
    () => grouped.done.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
    [grouped.done]
  );

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
    return task?.[field] || "";
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
        deadline: task.deadline || ""
      }
    }));
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
  };

  const normalizeText = (value) => {
    let text = String(value || "").toLowerCase();
    text = text
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss");
    text = text.replace(/ae/g, "a").replace(/oe/g, "o").replace(/ue/g, "u");
    text = text.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    return text;
  };

  const normalizeVariants = (value) => {
    const base = normalizeText(value);
    const noH = base.replace(/([aeiou])h/g, "$1");
    return Array.from(new Set([base, noH])).filter(Boolean);
  };

  const msToHHMMSS = (ms = 0) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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

  const knownCustomerNames = useMemo(
    () =>
      customers
        .map((item) => String(item?.name || "").trim().toLowerCase())
        .filter(Boolean),
    [customers]
  );

  const hasRunningTimer = useMemo(() => tasks.some((task) => task?.running), [tasks]);

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
    const canInvoice = hasCustomer;
    const knownCustomer = isKnownCustomer(task.customer);
    const timeTask = task.time_enabled ? task : null;
    const elapsedMs = timeTask
      ? (timeTask.elapsed || 0) +
        (timeTask.running && timeTask.startTime ? nowMs - timeTask.startTime : 0)
      : 0;
    const timeInputValue = timeEdits[task.id] ?? msToHHMMSS(elapsedMs);
    const isTimerCollapsed = Boolean(collapsedTimers[task.id]);
    return (
      <div
        key={task.id}
        className="relative rounded-lg border border-sand-200 bg-white px-3 py-2 shadow-[0_2px_6px_rgba(150,120,60,0.08)] md:px-2 md:py-1.5"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", `task:${task.id}`);
        }}
      >
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1.5">
              <div className="flex-1 min-w-0">
                {editingId === task.id ? (
                  <input
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => commitEdit(task)}
                    onKeyDown={(event) => {
                      if (event.isComposing || event.keyCode === 229 || event.repeat) return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitEdit(task);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className="w-full rounded-md border border-amber-200 bg-white px-3 py-2 text-base font-medium text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-2 md:py-1 md:text-xs"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(task)}
                    className={`text-left text-xs font-medium hover:text-sand-700 ${
                      isDone ? "line-through text-sand-400" : "text-sand-900"
                    }`}
                    title="Aufgabe bearbeiten"
                  >
                    {task.title}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1 pr-6">
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
                    onClick={() => updateTask(task, { status: "todo" })}
                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                    title="Unerledigt"
                  >
                    <Undo2 size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setError("Faktura (Dummy) ist noch nicht angebunden.")}
                  disabled={!canInvoice}
                  className={`rounded-full border p-1 ${
                    canInvoice
                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-sand-100 text-sand-300 cursor-not-allowed"
                  }`}
                  title={
                    canInvoice
                      ? "In Faktura übernehmen (Dummy)"
                      : "Kunde zuordnen, um zu übernehmen"
                  }
                >
                  <DollarSign size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => removeTask(task)}
                  className="rounded-full border border-rose-200 bg-rose-50 p-1 text-rose-700 hover:bg-rose-100"
                  title="Löschen"
                >
                  <Trash2 size={12} />
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
              <button
                type="button"
                onClick={() => {
                  startCustomerEdit(task);
                }}
                className="mt-1 text-[11px] text-sand-500 hover:text-sand-700"
                title="Kunde ändern"
              >
                {task.customer}
              </button>
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
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggleDetails(task)}
          className="absolute bottom-2 right-2 rounded-full border border-sand-200 bg-white p-1 text-sand-600 hover:bg-sand-100"
          title="Details anzeigen"
        >
          <ChevronDown
            size={12}
            className={`transition ${detailOpenId === task.id ? "rotate-180" : ""}`}
          />
        </button>
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
            <div className="text-sm text-sand-500">{tasks.length} Aufgaben</div>
            <div className="flex items-center gap-2">
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
                className="w-full md:w-40 rounded-full border border-amber-200 bg-white px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-amber-200 md:px-3 md:py-1 md:text-xs"
              />
              <button
                type="button"
                onClick={() => createGroup("todo")}
                className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs uppercase tracking-wide text-sand-700 hover:bg-amber-100 md:px-3 md:py-1 md:text-[10px]"
              >
                Gruppe
              </button>
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
                <div>
                  <h2 className="text-sm uppercase tracking-[0.3em] text-sand-500">
                    {column.label}
                  </h2>
                </div>
                <span className="text-xs text-sand-500">{grouped[column.id].length}</span>
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
            <span className="text-xs text-sand-500">{doneTasks.length}</span>
          </div>
          <div
            className="space-y-2 max-h-[45vh] overflow-auto pr-1"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDoneDrop}
          >
            {doneTasks.length ? (
              doneTasks.map((task) => renderTaskCard(task))
            ) : (
              <div className="text-xs text-sand-400">Noch keine erledigten Aufgaben.</div>
            )}
          </div>
        </section>
      </main>
      <datalist id="dayplan-customers">
        {customers.map((customer) => (
          <option key={customer.id} value={customer.name} />
        ))}
      </datalist>
    </div>
  );
}
