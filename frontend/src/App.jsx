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

/* ================= Time Editor ================= */
function TimeEditor({ task, currentElapsed, onUpdate }) {
  const [val, setVal] = useState(msToMMSS(currentElapsed));

  useEffect(() => {
    setVal(msToMMSS(currentElapsed));
  }, [currentElapsed]);

  const commit = () => {
    const match = val.match(/^(\d+):([0-5]\d)$/);
    if (!match) return;

    const ms = (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000;
    onUpdate(task.id, { elapsed: ms, running: false, startTime: 0 });
  };

  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => e.key === "Enter" && commit()}
      className="w-16 text-xs font-mono text-right border rounded px-1 bg-slate-50"
      title="MM:SS"
    />
  );
}

/* ================= Task ================= */
function TaskItem({ task, onUpdate, onDelete, onToggle }) {
  const currentElapsed =
    (task.elapsed || 0) +
    (task.running && task.startTime ? Date.now() - task.startTime : 0);

  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex gap-3 items-start">
        <button
          onClick={() => onToggle(task.id)}
          className={`w-8 h-8 rounded-full flex items-center justify-center
          ${task.running ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
        >
          {task.running ? <Square size={14} /> : <Play size={14} />}
        </button>

        <textarea
          value={task.title}
          onChange={e => onUpdate(task.id, { title: e.target.value })}
          rows={2}
          className={`flex-1 resize-none text-sm border-none focus:ring-0
          ${task.erledigt ? "line-through text-slate-400" : ""}`}
        />

        <TimeEditor
          task={task}
          currentElapsed={currentElapsed}
          onUpdate={onUpdate}
        />
      </div>

      <div className="flex gap-1 items-center">
        <button onClick={() => onUpdate(task.id, { erledigt: !task.erledigt })}
          className={`p-1 rounded ${task.erledigt ? "bg-green-100 text-green-600" : "text-slate-300"}`}>
          <CheckCircle size={16} />
        </button>

        <button onClick={() => onUpdate(task.id, { aberechnet: !task.aberechnet })}
          className={`p-1 rounded ${task.aberechnet ? "bg-amber-100 text-amber-600" : "text-slate-300"}`}>
          <DollarSign size={16} />
        </button>

        <button onClick={() => onUpdate(task.id, { kulant: !task.kulant })}
          className={`p-1 rounded ${task.kulant ? "bg-rose-100 text-rose-600" : "text-slate-300"}`}>
          <Heart size={16} />
        </button>

        <button onClick={() => onDelete(task.id)} className="ml-auto text-red-500">
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
    if (customer.tasks.some(t => t.running)) {
      const i = setInterval(reload, 1000);
      return () => clearInterval(i);
    }
  }, [customer.tasks]);

  const total = customer.tasks.reduce((s, t) => {
    let e = t.elapsed || 0;
    if (t.running && t.startTime) e += Date.now() - t.startTime;
    return s + e;
  }, 0);

  return (
    <div className="bg-white rounded-xl p-4 shadow flex flex-col min-h-[320px]">
      <div className="flex justify-between mb-3">
        <h2 className="font-bold">{customer.name}</h2>
        <span className="text-sm flex items-center gap-1 text-slate-500">
          <Clock size={14} /> {msToMMSS(total)}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {customer.tasks.map(t => (
          <TaskItem
            key={t.id}
            task={t}
            onUpdate={(id, data) => api.updateTask(id, data).then(reload)}
            onToggle={(id) => api.toggleTimer(id).then(reload)}
            onDelete={(id) => {
              if (confirm("Aufgabe löschen?"))
                api.deleteTask(id).then(reload);
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          placeholder="Neue Aufgabe…"
          className="flex-1 border rounded px-2 text-sm"
          onKeyDown={e => e.key === "Enter" && (
            api.addTask(customer.id, inputRef.current.value)
              .then(() => { inputRef.current.value = ""; reload(); })
          )}
        />
        <button
          className="bg-blue-600 text-white rounded px-3"
          onClick={() => {
            api.addTask(customer.id, inputRef.current.value)
              .then(() => { inputRef.current.value = ""; reload(); });
          }}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/* ================= Pinboard ================= */
function Pinboard() {
  const [note, setNote] = useState({ id: null, content: "" });

  useEffect(() => { api.pinboard().then(setNote); }, []);

  return (
    <div className="bg-yellow-50 rounded-xl p-4 shadow h-full">
      <div className="flex gap-2 mb-2 font-semibold text-yellow-800">
        <StickyNote size={18} /> Notizen
      </div>
      <textarea
        value={note.content}
        onChange={e => {
          setNote({ ...note, content: e.target.value });
          if (note.id) api.savePinboard(note.id, e.target.value);
        }}
        className="w-full h-full resize-none bg-transparent border-none focus:ring-0"
      />
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
    const i = setInterval(load, 2000); // Live Reload
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

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-4 rounded-xl flex gap-3 shadow">
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
                api.addCustomer(newCustomer).then(() => {
                  setNewCustomer("");
                  load();
                });
              }}
            >
              Erstellen
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {customers.map(c => (
              <CustomerCard key={c.id} customer={c} reload={load} />
            ))}
          </div>
        </div>

        <Pinboard />
      </main>
    </div>
  );
}