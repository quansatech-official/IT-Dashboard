import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  ClipboardList,
  Clock,
  DollarSign,
  Sparkles,
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
  remove: (id) => fetch(`${API}/day_tasks/${id}`, { method: "DELETE" }),
  promote: (id) => fetch(`${API}/day_tasks/${id}/promote`, { method: "POST" }).then((r) => r.json()),
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
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [editingCustomerValue, setEditingCustomerValue] = useState("");

  useEffect(() => {
    api.list().then((data) => {
      setTasks(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    api.customers().then((data) => {
      setCustomers(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    api.groups().then((data) => {
      setGroups(Array.isArray(data) ? data : []);
    });
  }, []);

  const addTaskToGroup = async (groupId, text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return;
    const created = await api.create({
      title: trimmed,
      group_id: groupId ?? null,
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
    await api.remove(task.id);
    setTasks((prev) => prev.filter((item) => item.id !== task.id));
  };

  const promoteTask = async (task) => {
    setError("");
    const updated = await api.promote(task.id);
    if (updated?.status === "todo" && updated?.task_id) {
      // keep local state consistent if backend didn't adjust status
      updated.status = "doing";
    }
    if (updated?.id) {
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
    } else {
      setError("Kunde nicht gefunden. Bitte Kundennummer oder Namen prüfen.");
    }
  };

  const grouped = useMemo(() => {
    const map = { todo: [], doing: [], done: [] };
    tasks.forEach((task) => {
      const bucket = map[task.status] ? task.status : "todo";
      map[bucket].push(task);
    });
    return map;
  }, [tasks]);

  const doneTasks = useMemo(
    () => grouped.done.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)),
    [grouped.done]
  );

  const groupsByColumn = useMemo(() => {
    const map = { todo: [], doing: [], done: [] };
    groups.forEach((group) => {
      const bucket = map[group.column] ? group.column : "todo";
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

  const commitCustomerEdit = async (task) => {
    const trimmed = editingCustomerValue.trim();
    if (trimmed === task.customer) {
      cancelCustomerEdit();
      return;
    }
    await updateTask(task, { customer: trimmed });
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
  };

  const normalizeText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const knownCustomerNames = useMemo(
    () =>
      customers
        .map((item) => String(item?.name || "").trim().toLowerCase())
        .filter(Boolean),
    [customers]
  );

  const isKnownCustomer = (value) => {
    const name = String(value || "").trim().toLowerCase();
    return name ? knownCustomerNames.includes(name) : false;
  };

  const getCustomerSuggestions = (task) => {
    const titleText = normalizeText(`${task?.title || ""} ${task?.customer || ""}`);
    if (!titleText) return [];
    const tokens = titleText.split(" ").filter((token) => token.length > 2);
    const scored = customers
      .map((customerItem) => {
        const name = String(customerItem?.name || "").trim();
        if (!name) return null;
        const nameText = normalizeText(name);
        if (!nameText) return null;
        let score = 0;
        if (titleText.includes(nameText)) {
          score += 100 + nameText.length;
        } else {
          tokens.forEach((token) => {
            if (nameText.includes(token)) {
              score += 5;
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

  const renderTaskCard = (task) => {
    const suggestions = getCustomerSuggestions(task);
    const hasCustomer = Boolean(task.customer || task.customer_number);
    const canPromote = hasCustomer;
    const isDone = task.status === "done";
    const canInvoice = hasCustomer;
    const knownCustomer = isKnownCustomer(task.customer);
    return (
      <div
        key={task.id}
        className="relative rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 shadow-[0_4px_10px_rgba(150,120,60,0.08)]"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", `task:${task.id}`);
        }}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={() => updateTask(task, { status: isDone ? "todo" : "done" })}
            className={`mt-1 h-4 w-4 rounded-full border flex items-center justify-center ${
              isDone ? "border-emerald-400 bg-emerald-400" : "border-amber-300 bg-white"
            }`}
            title={isDone ? "Als unzugeordnet markieren" : "Als erledigt markieren"}
          >
            {isDone ? <span className="text-[10px] text-white">✓</span> : null}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {editingId === task.id ? (
                  <input
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => commitEdit(task)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitEdit(task);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm font-medium text-sand-900 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(task)}
                    className={`text-left text-sm font-medium hover:text-sand-700 ${
                      isDone ? "line-through text-sand-400" : "text-sand-900"
                    }`}
                    title="Aufgabe bearbeiten"
                  >
                    {task.title}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!knownCustomer ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!suggestions.length) {
                        setError("Kein Kundenvorschlag gefunden.");
                        return;
                      }
                      if (suggestions.length === 1) {
                        updateTask(task, { customer: suggestions[0] });
                        return;
                      }
                      toggleSuggestionMenu(task.id, true);
                    }}
                    className="rounded-full border border-amber-200 bg-white p-1 text-sand-600 hover:bg-amber-100"
                    title={
                      suggestions.length
                        ? `Kundenvorschlag${suggestions.length > 1 ? "e" : ""}`
                        : "Kein Kundenvorschlag"
                    }
                    disabled={!suggestions.length}
                  >
                    <Sparkles size={12} />
                  </button>
                ) : null}
                {!task.task_id ? (
                  <button
                    type="button"
                    onClick={() => promoteTask(task)}
                    disabled={!canPromote}
                    className={`rounded-full border p-1 ${
                      canPromote
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-sand-100 text-sand-300 cursor-not-allowed"
                    }`}
                    title={
                      canPromote
                        ? "In Zeiterfassung übernehmen"
                        : "Kunde zuordnen, um zu übernehmen"
                    }
                  >
                    <Clock size={12} />
                  </button>
                ) : (
                  <span
                    className="rounded-full border border-emerald-200 bg-emerald-50 p-1 text-emerald-700"
                    title="In Zeiterfassung"
                  >
                    <Clock size={12} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => updateTask(task, { status: "done" })}
                  className="rounded-full border border-emerald-200 bg-emerald-50 p-1 text-emerald-700 hover:bg-emerald-100"
                  title="Erledigt"
                >
                  <CheckCircle size={12} />
                </button>
                {isDone ? (
                  <button
                    type="button"
                    onClick={() => updateTask(task, { status: "todo" })}
                    className="rounded-full border border-sand-200 bg-white p-1 text-sand-500 hover:bg-sand-100"
                    title="Unerledigt"
                  >
                    <Undo2 size={12} />
                  </button>
                ) : null}
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
            {editingCustomerId === task.id && !task.task_id ? (
              <input
                value={editingCustomerValue}
                onChange={(event) => setEditingCustomerValue(event.target.value)}
                onBlur={() => commitCustomerEdit(task)}
                onKeyDown={(event) => {
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
                className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px] text-sand-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
                autoFocus
              />
            ) : task.customer ? (
              <button
                type="button"
                onClick={() => {
                  if (!task.task_id) startCustomerEdit(task);
                }}
                className={`mt-1 text-[11px] text-sand-500 hover:text-sand-700 ${
                  task.task_id ? "cursor-default" : ""
                }`}
                title={task.task_id ? "Kunde ist fixiert (Zeiterfassung)" : "Kunde ändern"}
              >
                {task.customer}
              </button>
            ) : null}
            {!knownCustomer && suggestions.length > 1 && suggestionOpenId === task.id ? (
              <div className="absolute right-3 top-full mt-2 w-56 rounded-xl border border-amber-200 bg-white shadow-soft z-20">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-sand-400">
                  Kundenvorschlage
                </div>
                <div className="max-h-40 overflow-auto">
                  {suggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        updateTask(task, { customer: name });
                        setSuggestionOpenId(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-sand-700 hover:bg-amber-50"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {task.customer_number ? (
              <div className="text-[10px] text-sand-400">Nr. {task.customer_number}</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7e6,_#f6efe1_55%,_#efe7d6_100%)]">
      <header className="border-b border-sand-200/70 bg-white/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-soft">
              <ClipboardList size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-2xl font-display text-sand-900">Tagesplan</h1>
            </div>
          </div>
          <div className="text-sm text-sand-500">{tasks.length} Aufgaben</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-1">
          {columns.map((column) => (
            <div
              key={column.id}
              className={`rounded-2xl border bg-white/80 shadow-[0_6px_20px_rgba(150,120,60,0.08)] p-4 transition min-h-[60vh] ${
                dragOver === column.id
                  ? "border-amber-400 bg-amber-50/60"
                  : "border-amber-100"
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
                  <p className="text-xs text-sand-400 mt-1">Gruppe per Drag & Drop</p>
                </div>
                <span className="text-xs text-sand-500">{grouped[column.id].length}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={groupDrafts[column.id] || ""}
                  onChange={(event) =>
                    setGroupDrafts((prev) => ({ ...prev, [column.id]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      createGroup(column.id);
                    }
                  }}
                  placeholder="Neue Gruppe…"
                  className="flex-1 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="button"
                  onClick={() => createGroup(column.id)}
                  className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-700 hover:bg-amber-100"
                >
                  Gruppe
                </button>
              </div>
              <div className="space-y-3 max-h-[65vh] overflow-auto pr-1">
                <div
                  className="rounded-xl border border-dashed border-amber-200 bg-white/70 px-3 py-2"
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
                  <div className="mt-3 space-y-3">
                    {grouped[column.id].filter((task) => !task.group_id).length ? (
                      grouped[column.id]
                        .filter((task) => !task.group_id)
                        .map((task) => renderTaskCard(task))
                    ) : (
                      <div className="text-xs text-sand-400">Keine Aufgaben.</div>
                    )}
                    <input
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          const value = event.currentTarget.value;
                          addTaskToGroup(null, value);
                          event.currentTarget.value = "";
                        }
                      }}
                      placeholder="Neue Aufgabe…"
                      className="w-full rounded-full border border-amber-200 bg-white px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>
                {groupsByColumn[column.id].map((group) => (
                  <div
                    key={group.id}
                    className={`rounded-xl border border-amber-200 bg-white/80 px-3 py-2 ${
                      dragOverGroupId === group.id ? "ring-2 ring-amber-300" : ""
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
                      className="mt-2 space-y-3"
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
                          if (event.key === "Enter") {
                            event.preventDefault();
                            const value = event.currentTarget.value;
                            addTaskToGroup(group.id, value);
                            event.currentTarget.value = "";
                          }
                        }}
                        placeholder="Neue Aufgabe…"
                        className="w-full rounded-full border border-amber-200 bg-white px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border border-amber-100 bg-white/80 p-4 shadow-[0_6px_20px_rgba(150,120,60,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm uppercase tracking-[0.3em] text-sand-500">Erledigt</h2>
              <p className="text-xs text-sand-400 mt-1">Ziehe Aufgaben hierher</p>
            </div>
            <span className="text-xs text-sand-500">{doneTasks.length}</span>
          </div>
          <div
            className="space-y-3 max-h-[45vh] overflow-auto pr-1"
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
