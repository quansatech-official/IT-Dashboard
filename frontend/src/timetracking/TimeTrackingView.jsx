import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      body: JSON.stringify({ name, time_tracking_enabled: true })
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
          <Clock size={14} /> {msToHHMMSS(total)}
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
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const load = useCallback(() => api.customers().then(setCustomersState), []);
  const customerSuggestions = useMemo(() => {
    const seen = new Set();
    return customersState
      .map((item) => (item?.name || "").trim())
      .filter((name) => name && !seen.has(name) && seen.add(name))
      .sort((a, b) => a.localeCompare(b, "de"));
  }, [customersState]);
  const filteredSuggestions = useMemo(() => {
    const needle = newCustomer.trim().toLowerCase();
    if (!needle) return customerSuggestions.slice(0, 12);
    return customerSuggestions
      .filter((name) => name.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [customerSuggestions, newCustomer]);
  const visibleCustomers = useMemo(
    () =>
      customersState.filter(
        (customer) =>
          (customer.tasks && customer.tasks.length > 0) || customer.time_tracking_enabled
      ),
    [customersState]
  );

  useEffect(() => {
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
              <Clock size={18} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
              <h1 className="text-2xl font-display text-sand-900">Zeiterfassung</h1>
            </div>
          </div>
          <span className="text-sm text-sand-500">{visibleCustomers.length} Kunden</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl flex gap-3 shadow">
            <Users />
            <div className="relative flex-1">
              <input
                value={newCustomer}
                onChange={(e) => {
                  setNewCustomer(e.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onBlur={() => setTimeout(() => setSuggestionsOpen(false), 120)}
                placeholder="Neuen Kunden anlegen…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {suggestionsOpen && filteredSuggestions.length ? (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-48 overflow-auto">
                  {filteredSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={() => {
                        setNewCustomer(name);
                        setSuggestionsOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button
              className="bg-slate-900 text-white rounded px-4"
              onClick={() =>
                newCustomer.trim() &&
                api.addCustomer(newCustomer.trim()).then((created) => {
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
            {visibleCustomers.map((c) => (
              <CustomerCard key={c.id} customer={c} reload={load} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
