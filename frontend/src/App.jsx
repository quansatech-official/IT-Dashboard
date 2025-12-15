import { useEffect, useState, useRef } from "react";
import {
  Play, Square, CheckCircle, DollarSign, Heart,
  Trash2, Plus, Clock, Users, StickyNote
} from "lucide-react";

/* ================= API ================= */
const API = "/api";

const api = {
  customers: () => fetch(`${API}/customers`).then(r => r.json()),
  addCustomer: (name) =>
    fetch(`${API}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    }).then(r => r.json()),

  deleteCustomer: (id) =>
    fetch(`${API}/customers/${id}`, { method: "DELETE" }),

  addTask: (customer_id, title) =>
    fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id, title })
    }).then(r => r.json()),

  updateTask: (id, data) =>
    fetch(`${API}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }),

  toggleTimer: (id) =>
    fetch(`${API}/tasks/${id}/toggle_timer`, { method: "PATCH" }),

  deleteTask: (id) =>
    fetch(`${API}/tasks/${id}`, { method: "DELETE" }),

  pinboard: () => fetch(`${API}/pinboard`).then(r => r.json()),
  savePinboard: (id, content) =>
    fetch(`${API}/pinboard/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    })
};

/* ================= Helpers ================= */
const msToMMSS = (ms) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
};

/* ================= Task ================= */
function TaskItem({ task, reload }) {
  const currentElapsed =
    (task.elapsed || 0) +
    (task.running && task.startTime ? Date.now() - task.startTime : 0);

  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex gap-3 items-start">
        <button
          onClick={() => api.toggleTimer(task.id).then(reload)}
          className={`w-8 h-8 rounded-full flex items-center justify-center
          ${task.running ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
        >
          {task.running ? <Square size={14} /> : <Play size={14} />}
        </button>

        <textarea
          value={task.title}
          onChange={e => api.updateTask(task.id, { title: e.target.value }).then(reload)}
          rows={2}
          className={`flex-1 resize-none text-sm border-none focus:ring-0
          ${task.erledigt ? "line-through text-slate-400" : ""}`}
        />

        <input
          className="w-16 text-xs font-mono text-right border rounded px-1 bg-slate-50"
          value={msToMMSS(currentElapsed)}
          onBlur={e => {
            const m = e.target.value.match(/^(\d+):([0-5]\d)$/);
            if (!m) return;
            const ms = (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000;
            api.updateTask(task.id, { elapsed: ms, running: false, startTime: 0 }).then(reload);
          }}
        />
      </div>

      <div className="flex gap-1 items-center">
        <button onClick={() => api.updateTask(task.id, { erledigt: !task.erledigt }).then(reload)}
          className={`p-1 rounded ${task.erledigt ? "bg-green-100 text-green-600" : "text-slate-300"}`}>
          <CheckCircle size={16} />
        </button>

        <button onClick={() => api.updateTask(task.id, { aberechnet: !task.aberechnet }).then(reload)}
          className={`p-1 rounded ${task.aberechnet ? "bg-amber-100 text-amber-600" : "text-slate-300"}`}>
          <DollarSign size={16} />
        </button>

        <button onClick={() => api.updateTask(task.id, { kulant: !task.kulant }).then(reload)}
          className={`p-1 rounded ${task.kulant ? "bg-rose-100 text-rose-600" : "text-slate-300"}`}>
          <Heart size={16} />
        </button>

        <button
          onClick={() => confirm("Aufgabe löschen?") && api.deleteTask(task.id).then(reload)}
          className="ml-auto text-red-500"
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

  const total = customer.tasks.reduce((s, t) => {
    let e = t.elapsed || 0;
    if (t.running && t.startTime) e += Date.now() - t.startTime;
    return s + e;
  }, 0);

  return (
    <div className="bg-white rounded-2xl p-5 shadow space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">{customer.name}</h2>
          <div className="text-sm text-slate-500 flex gap-1 items-center">
            <Clock size={14} /> {msToMMSS(total)}
          </div>
        </div>

        <button
          onClick={() =>
            confirm(`Kunde "${customer.name}" wirklich löschen?`)
            && api.deleteCustomer(customer.id).then(reload)
          }
          className="text-red-500 hover:bg-red-50 rounded-full p-2"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="space-y-2 max-h-[360px] overflow-y-auto">
        {customer.tasks.map(t => (
          <TaskItem key={t.id} task={t} reload={reload} />
        ))}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          placeholder="Neue Aufgabe…"
          className="flex-1 border rounded px-3 py-1 text-sm"
          onKeyDown={e => {
            if (e.key === "Enter" && inputRef.current.value.trim()) {
              api.addTask(customer.id, inputRef.current.value.trim())
                .then(() => { inputRef.current.value = ""; reload(); });
            }
          }}
        />
        <button
          className="bg-blue-600 text-white rounded px-3"
          onClick={() => {
            if (!inputRef.current.value.trim()) return;
            api.addTask(customer.id, inputRef.current.value.trim())
              .then(() => { inputRef.current.value = ""; reload(); });
          }}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/* ================= App ================= */
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState("");

  const load = () => api.customers().then(setCustomers);

  useEffect(() => {
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between px-4">
          <div className="flex gap-3 items-center">
            <img src="https://static.wixstatic.com/media/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png" className="h-9" />
            <h1 className="font-bold text-xl">QT-Workbench</h1>
          </div>
          <span className="text-sm text-slate-500">{customers.length} Kunden</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="col-span-full bg-white p-4 rounded-xl shadow flex gap-3">
          <Users />
          <input
            value={newCustomer}
            onChange={e => setNewCustomer(e.target.value)}
            placeholder="Neuen Kunden anlegen…"
            className="flex-1 border-none focus:ring-0"
          />
          <button
            className="bg-slate-900 text-white rounded px-4"
            onClick={() => {
              if (!newCustomer.trim()) return;
              api.addCustomer(newCustomer.trim()).then(() => {
                setNewCustomer("");
                load();
              });
            }}
          >
            Erstellen
          </button>
        </div>

        {customers.map(c => (
          <CustomerCard key={c.id} customer={c} reload={load} />
        ))}
      </main>
    </div>
  );
}