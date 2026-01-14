import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle,
  Clock,
  DollarSign,
  Heart,
  Play,
  Plus,
  Square,
  Trash2,
  Users
} from "lucide-react";

/* ================= API ================= */
const API = "/api";

const api = {
  customers: () => fetch(`${API}/customers`).then((r) => r.json()),
  addCustomer: (name) =>
    fetch(`${API}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    }).then((r) => r.json()),
  deleteCustomer: (id) => fetch(`${API}/customers/${id}`, { method: "DELETE" }),

  addTask: (customer_id, title) =>
    fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id, title })
    }).then((r) => r.json()),

  updateTask: (id, data) =>
    fetch(`${API}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }),

  deleteTask: (id) => fetch(`${API}/tasks/${id}`, { method: "DELETE" }),

  toggleTimer: (id) => fetch(`${API}/tasks/${id}/toggle_timer`, { method: "PATCH" }),

  pinboard: () => fetch(`${API}/pinboard`).then((r) => r.json()),
  savePinboard: (id, content) =>
    fetch(`${API}/pinboard/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    })
};

/* ================= Helpers ================= */
const msToHHMMSS = (ms = 0) => {
  const s = Math.floor(ms / 1000);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

/* ================= Time Editor ================= */
function TimeEditor({ task, elapsed, onSave }) {
  const [value, setValue] = useState(msToHHMMSS(elapsed));

  useEffect(() => setValue(msToHHMMSS(elapsed)), [elapsed]);

  const commit = () => {
    const match = value.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (!match) return;
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
    onSave(task.id, { elapsed: ms, running: false, startTime: 0 });
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="w-24 text-xs font-mono text-right border rounded px-1 bg-slate-50"
      title="HH:MM:SS"
    />
  );
}

/* ================= Task ================= */
function TaskItem({ task, reload }) {
  const elapsed =
    (task.elapsed || 0) + (task.running && task.startTime ? Date.now() - task.startTime : 0);
  const [title, setTitle] = useState(task.title || "");
  const saveTimer = useRef(null);

  const saveTitle = useCallback(
    (nextTitle) => api.updateTask(task.id, { title: nextTitle }).then(reload),
    [task.id, reload]
  );

  useEffect(() => {
    setTitle(task.title || "");
  }, [task.title]);

  useEffect(() => {
    if (title === task.title) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveTitle(title);
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, task.title, saveTitle]);

  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex gap-3 items-start">
        <button
          onClick={() => api.toggleTimer(task.id).then(reload)}
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            task.running ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
          }`}
          title={task.running ? "Timer stoppen" : "Timer starten"}
        >
          {task.running ? <Square size={14} /> : <Play size={14} />}
        </button>

        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = null;
            if (title !== task.title) saveTitle(title);
          }}
          rows={2}
          className={`flex-1 resize-none text-sm border-none focus:ring-0 ${
            task.erledigt ? "line-through text-slate-400" : ""
          }`}
        />

        <TimeEditor
          task={task}
          elapsed={elapsed}
          onSave={(id, d) => api.updateTask(id, d).then(reload)}
        />
      </div>

      <div className="flex gap-1 items-center">
        <button
          onClick={() => api.updateTask(task.id, { erledigt: !task.erledigt }).then(reload)}
          className={`p-1 rounded ${task.erledigt ? "bg-green-100 text-green-600" : "text-slate-300"}`}
          title={task.erledigt ? "Als offen markieren" : "Als erledigt markieren"}
        >
          <CheckCircle size={16} />
        </button>
        <button
          onClick={() => api.updateTask(task.id, { aberechnet: !task.aberechnet }).then(reload)}
          className={`p-1 rounded ${
            task.aberechnet ? "bg-amber-100 text-amber-600" : "text-slate-300"
          }`}
          title={task.aberechnet ? "Nicht abgerechnet" : "Als abgerechnet markieren"}
        >
          <DollarSign size={16} />
        </button>
        <button
          onClick={() => api.updateTask(task.id, { kulant: !task.kulant }).then(reload)}
          className={`p-1 rounded ${task.kulant ? "bg-rose-100 text-rose-600" : "text-slate-300"}`}
          title={task.kulant ? "Kulanz entfernen" : "Kulanz markieren"}
        >
          <Heart size={16} />
        </button>
        <button
          onClick={() => confirm("Aufgabe löschen?") && api.deleteTask(task.id).then(reload)}
          className="ml-auto text-red-500"
          title="Aufgabe löschen"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/* ================= Customer ================= */
function CustomerCard({ customer, reload }) {
  const inputRef = useRef();

  useEffect(() => {
    if (customer.tasks.some((t) => t.running)) {
      const i = setInterval(reload, 1000);
      return () => clearInterval(i);
    }
    return undefined;
  }, [customer.tasks, reload]);

  const submitTask = () => {
    const value = inputRef.current?.value.trim();
    if (!value) return;
    api.addTask(customer.id, value).then(() => {
      inputRef.current.value = "";
      reload();
    });
  };

  const total = customer.tasks.reduce((s, t) => {
    let e = t.elapsed || 0;
    if (t.running && t.startTime) e += Date.now() - t.startTime;
    return s + e;
  }, 0);

  return (
    <div className="bg-white rounded-xl p-4 shadow flex flex-col min-h-[320px] relative">
      <button
        onClick={() => confirm("Kunde löschen?") && api.deleteCustomer(customer.id).then(reload)}
        className="absolute -top-2 -right-2 bg-white border rounded-full p-1 text-red-500"
        title="Kunde löschen"
      >
        <Trash2 size={14} />
      </button>

      <div className="flex justify-between mb-3">
        <h2 className="font-bold">{customer.name}</h2>
        <span className="text-sm flex items-center gap-1 text-slate-500">
          <Clock size={14} /> {msToMMSS(total)}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
        {customer.tasks.map((t) => (
          <TaskItem key={t.id} task={t} reload={reload} />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          placeholder="Neue Aufgabe…"
          className="flex-1 border rounded px-2 text-sm"
          onKeyDown={(e) => e.key === "Enter" && submitTask()}
        />
        <button
          className="bg-blue-600 text-white rounded px-3"
          onClick={submitTask}
          title="Aufgabe hinzufügen"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export default function TimeTrackingView() {
  const [customersState, setCustomersState] = useState([]);
  const [newCustomer, setNewCustomer] = useState("");

  const load = useCallback(() => api.customers().then(setCustomersState), []);

  useEffect(() => {
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex gap-3 items-center">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Clock size={18} />
            </div>
            <h1 className="font-bold text-xl">QT-Workbench · Zeiterfassung</h1>
          </div>
          <span className="text-sm text-slate-500">{customersState.length} Kunden</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl flex gap-3 shadow">
            <Users />
            <input
              value={newCustomer}
              onChange={(e) => setNewCustomer(e.target.value)}
              placeholder="Neuen Kunden anlegen…"
              className="flex-1 border-none focus:ring-0"
            />
            <button
              className="bg-slate-900 text-white rounded px-4"
              onClick={() =>
                newCustomer.trim() &&
                api.addCustomer(newCustomer.trim()).then(() => {
                  setNewCustomer("");
                  load();
                })
              }
              title="Kunden anlegen"
            >
              Erstellen
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {customersState.map((c) => (
              <CustomerCard key={c.id} customer={c} reload={load} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
