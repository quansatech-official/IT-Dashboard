import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Trash2, 
  CheckCircle, 
  DollarSign, 
  Heart, 
  Plus, 
  StickyNote, 
  Clock, 
  Users
} from 'lucide-react';

// ----- Utilities -----

const API_BASE = "/api"; // Reversproxy zu Backend in Nginx

const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
};

// ----- Components -----

function TaskItem({ task, onUpdate, onDelete, onToggleTimer }) {
  const currentElapsed = (task.elapsed || 0) + (task.running && task.startTime ? Date.now() - task.startTime : 0);

  return (
    <div className={`group flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 
      ${task.erledigt ? "bg-slate-50 border-slate-100 opacity-75" : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"}`}>
      
      {/* Timer */}
      <button
        onClick={() => onToggleTimer(task.id)}
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors 
          ${task.running 
            ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse" 
            : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
        title={task.running ? "Stop Timer" : "Start Timer"}
      >
        {task.running ? <Square size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}
      </button>

      {/* Title */}
      <input
        type="text"
        value={task.title}
        onChange={(e) => onUpdate(task.id, { title: e.target.value })}
        className={`flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm font-medium 
          ${task.erledigt ? "text-slate-400 line-through" : "text-slate-700"}`}
      />

      {/* Time */}
      <div className={`text-xs font-mono w-12 text-right ${task.running ? "text-blue-600 font-bold" : "text-slate-500"}`}>
        {formatTime(currentElapsed)}
      </div>

      {/* Status */}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => onUpdate(task.id, { erledigt: !task.erledigt })}
          className={`p-1.5 rounded-md transition-colors ${task.erledigt ? "bg-green-100 text-green-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
          title="Erledigt"
        >
          <CheckCircle size={16}/>
        </button>
        <button 
          onClick={() => onUpdate(task.id, { aberechnet: !task.aberechnet })}
          className={`p-1.5 rounded-md transition-colors ${task.aberechnet ? "bg-amber-100 text-amber-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
          title="Aberechnet"
        >
          <DollarSign size={16}/>
        </button>
        <button 
          onClick={() => onUpdate(task.id, { kulant: !task.kulant })}
          className={`p-1.5 rounded-md transition-colors ${task.kulant ? "bg-rose-100 text-rose-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
          title="Kulant"
        >
          <Heart size={16}/>
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
        title="Löschen"
      >
        <Trash2 size={16}/>
      </button>
    </div>
  );
}

function CustomerCard({ customer, onTaskUpdate, onNewTask, onTaskDelete, onToggleTimer }) {
  const [_, forceUpdate] = useState(0);
  const newTaskInputRef = useRef(null);

  // Re-render für laufende Tasks
  useEffect(() => {
    const hasRunning = customer.tasks.some(t => t.running);
    if (!hasRunning) return;
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, [customer.tasks]);

  const totalTimeMs = customer.tasks.reduce((sum, t) => {
    let elapsed = t.elapsed || 0;
    if (t.running && t.startTime) elapsed += Date.now() - t.startTime;
    return sum + elapsed;
  }, 0);

  const handleNewTask = () => {
    const val = newTaskInputRef.current?.value.trim();
    if (val) {
      onNewTask(customer.id, val);
      newTaskInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
            {customer.name.substring(0,2).toUpperCase()}
          </div>
          {customer.name}
        </h2>
        <div className="flex items-center gap-2 text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 text-sm">
          <Clock size={14}/>
          <span>{Math.floor(totalTimeMs / 1000 / 60)} min</span>
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1">
        {customer.tasks.length === 0 && <div className="text-center py-6 text-slate-400 text-sm italic">Noch keine Aufgaben erfasst.</div>}
        {customer.tasks.map(task => (
          <TaskItem 
            key={task.id} 
            task={task} 
            onUpdate={(taskId, updates) => onTaskUpdate(customer.id, taskId, updates)}
            onDelete={(taskId) => onTaskDelete(customer.id, taskId)}
            onToggleTimer={(taskId) => onToggleTimer(customer.id, taskId)}
          />
        ))}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100">
        <div className="flex gap-2">
          <input 
            ref={newTaskInputRef}
            type="text" 
            placeholder="Neue Aufgabe..." 
            className="flex-1 text-sm px-3 py-2 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleNewTask()}
          />
          <button
            onClick={handleNewTask}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            <Plus size={18}/>
          </button>
        </div>
      </div>
    </div>
  );
}

function Pinboard() {
  const [text, setText] = useState("");

  return (
    <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 h-full flex flex-col">
      <div className="p-4 border-b border-yellow-100 flex items-center gap-2 text-yellow-800 font-semibold">
        <StickyNote size={18}/>
        <span>Notizen</span>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 p-4 text-slate-700 leading-relaxed text-sm"
        placeholder="Schreiben Sie hier wichtige Notizen..."
      />
    </div>
  );
}

// ----- Main App -----

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState("");

  // Kunden vom Server laden
  useEffect(() => {
    fetch(`${API_BASE}/customers`)
      .then(res => res.json())
      .then(data => setCustomers(data))
      .catch(console.error);
  }, []);

  const addCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCustomerName.trim() })
      });
      const newCustomer = await res.json();
      setCustomers(prev => [newCustomer, ...prev]);
      setNewCustomerName("");
    } catch (err) {
      console.error(err);
    }
  };

  const addTask = async (customerId, title) => {
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId, title })
      });
      const newTask = await res.json();
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, tasks: [...c.tasks, newTask] } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const updateTask = async (customerId, taskId, updates) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const updatedTask = await res.json();
      setCustomers(prev => prev.map(c => c.id === customerId ? { 
        ...c, 
        tasks: c.tasks.map(t => t.id === taskId ? updatedTask : t) 
      } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTimer = async (customerId, taskId) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${taskId}/toggle_timer`, { method: "PATCH" });
      const updatedTask = await res.json();
      setCustomers(prev => prev.map(c => c.id === customerId ? { 
        ...c, 
        tasks: c.tasks.map(t => t.id === taskId ? updatedTask : t) 
      } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTask = async (customerId, taskId) => {
    try {
      await fetch(`${API_BASE}/tasks/${taskId}`, { method: "DELETE" });
      setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, tasks: c.tasks.filter(t => t.id !== taskId) } : c));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteCustomer = async (id) => {
    if (!window.confirm("Kunde wirklich löschen?")) return;
    try {
      await fetch(`${API_BASE}/customers/${id}`, { method: "DELETE" });
      setCustomers(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="https://static.wixstatic.com/media/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png" alt="Logo" className="h-8" />
          </div>
          <div className="flex items-center gap-4">
             <div className="text-sm text-slate-500">{customers.length} Aktive Kunden</div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          <div className="lg:col-span-3 space-y-6">
            <form onSubmit={addCustomer} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-3">
              <div className="bg-slate-100 p-2 rounded-md flex items-center justify-center text-slate-400">
                <Users size={20}/>
              </div>
              <input
                type="text"
                placeholder="Neuen Kunden anlegen..."
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400"
              />
              <button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors">Erstellen</button>
            </form>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {customers.length === 0 ? (
                <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">
                  Keine Kunden vorhanden. Starten Sie oben mit einem neuen Kunden.
                </div>
              ) : (
                customers.map(c => (
                  <div key={c.id} className="relative group">
                    <CustomerCard
                      customer={c}
                      onTaskUpdate={updateTask}
                      onNewTask={addTask}
                      onTaskDelete={deleteTask}
                      onToggleTimer={toggleTimer}
                    />
                    <button 
                      onClick={() => deleteCustomer(c.id)}
                      className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-600 shadow-sm border border-slate-200 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-1 lg:sticky lg:top-24 h-[500px]">
            <Pinboard/>
          </div>
        </div>
      </div>
    </div>
  );
}