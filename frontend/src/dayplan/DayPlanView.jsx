import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Trash2 } from "lucide-react";

const API = "/api";

const api = {
  list: () => fetch(`${API}/day_tasks`).then((r) => r.json()),
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
  promote: (id) => fetch(`${API}/day_tasks/${id}/promote`, { method: "POST" }).then((r) => r.json())
};

const columns = [
  { id: "todo", label: "Neu" },
  { id: "doing", label: "In Arbeit" },
  { id: "done", label: "Erledigt" }
];

export default function DayPlanView() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.list().then((data) => {
      setTasks(Array.isArray(data) ? data : []);
    });
  }, []);

  const addTask = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const created = await api.create({
      title: trimmed,
      customer: customer.trim(),
      customer_number: customerNumber.trim()
    });
    setTasks((prev) => [created, ...prev]);
    setTitle("");
    setCustomer("");
    setCustomerNumber("");
  };

  const updateTask = async (task, patch) => {
    const updated = await api.update(task.id, patch);
    setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
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

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
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

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-5">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Aufgabe notieren…"
              className="rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            />
            <input
              value={customer}
              onChange={(event) => setCustomer(event.target.value)}
              placeholder="Kunde (optional)"
              className="rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            />
            <input
              value={customerNumber}
              onChange={(event) => setCustomerNumber(event.target.value)}
              placeholder="Kundennummer"
              className="rounded-2xl border border-sand-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sand-300"
            />
            <button
              type="button"
              onClick={addTask}
              className="rounded-2xl bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
            >
              Hinzufügen
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {columns.map((column) => (
            <div key={column.id} className="rounded-3xl border border-sand-200 bg-white shadow-soft p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm uppercase tracking-[0.3em] text-sand-500">
                  {column.label}
                </h2>
                <span className="text-xs text-sand-500">{grouped[column.id].length}</span>
              </div>
              <div className="space-y-3">
                {grouped[column.id].length ? (
                  grouped[column.id].map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-sand-200 bg-sand-50 px-4 py-3"
                    >
                      <div className="text-sm font-semibold text-sand-900">{task.title}</div>
                      {task.customer ? (
                        <div className="text-xs text-sand-500 mt-1">{task.customer}</div>
                      ) : null}
                      {task.customer_number ? (
                        <div className="text-xs text-sand-400">Nr. {task.customer_number}</div>
                      ) : null}
                      <div className="mt-3 flex items-center gap-2">
                        {!task.task_id ? (
                          <button
                            type="button"
                            onClick={() => promoteTask(task)}
                            className="rounded-full border border-sand-200 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                          >
                            In Zeiterfassung
                          </button>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] uppercase tracking-wide text-emerald-700">
                            In Zeiterfassung
                          </span>
                        )}
                        {column.id !== "todo" ? (
                          <button
                            type="button"
                            onClick={() => updateTask(task, { status: "todo" })}
                            className="rounded-full border border-sand-200 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                          >
                            Neu
                          </button>
                        ) : null}
                        {column.id !== "doing" ? (
                          <button
                            type="button"
                            onClick={() => updateTask(task, { status: "doing" })}
                            className="rounded-full border border-sand-200 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                          >
                            In Arbeit
                          </button>
                        ) : null}
                        {column.id !== "done" ? (
                          <button
                            type="button"
                            onClick={() => updateTask(task, { status: "done" })}
                            className="rounded-full border border-sand-200 px-3 py-1 text-[10px] uppercase tracking-wide text-sand-600 hover:bg-sand-100"
                          >
                            Erledigt
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeTask(task)}
                          className="ml-auto inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700 hover:bg-rose-100"
                          title="Löschen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-sand-400">Keine Aufgaben.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
