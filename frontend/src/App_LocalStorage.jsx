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

// Format milliseconds to MM:SS
const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// ----- Components -----

function TaskItem({ task, onUpdate, onDelete, onToggleTimer }) {
  // Calculate elapsed time for display
  const currentElapsed = (task.elapsed || 0) + (task.running && task.startTime ? Date.now() - task.startTime : 0);

  return (
    <div className={`group flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 
      ${task.erledigt ? "bg-slate-50 border-slate-100 opacity-75" : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"}`}>
      
      {/* Timer Control */}
      <button
        onClick={() => onToggleTimer(task.id)}
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors 
          ${task.running 
            ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse" 
            : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
        title={task.running ? "Stop Timer" : "Start Timer"}
      >
        {task.running ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      {/* Title Input */}
      <input
        type="text"
        value={task.title}
        onChange={(e) => onUpdate(task.id, 'title', e.target.value)}
        className={`flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm font-medium 
          ${task.erledigt ? "text-slate-400 line-through" : "text-slate-700"}`}
      />

      {/* Time Display */}
      <div className={`text-xs font-mono w-12 text-right ${task.running ? "text-blue-600 font-bold" : "text-slate-500"}`}>
        {formatTime(currentElapsed)}
      </div>

      {/* Status Toggles */}
      <div className="flex items-center gap-1">
        <button 
          onClick={() => onUpdate(task.id, 'erledigt', !task.erledigt)}
          className={`p-1.5 rounded-md transition-colors ${task.erledigt ? "bg-green-100 text-green-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
          title="Erledigt (Done)"
        >
          <CheckCircle size={16} />
        </button>
        
        <button 
          onClick={() => onUpdate(task.id, 'aberechnet', !task.aberechnet)}
          className={`p-1.5 rounded-md transition-colors ${task.aberechnet ? "bg-amber-100 text-amber-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
          title="Aberechnet (Billed)"
        >
          <DollarSign size={16} />
        </button>
        
        <button 
          onClick={() => onUpdate(task.id, 'kulant', !task.kulant)}
          className={`p-1.5 rounded-md transition-colors ${task.kulant ? "bg-rose-100 text-rose-600" : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"}`}
          title="Kulant (Goodwill)"
        >
          <Heart size={16} />
        </button>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
        title="Löschen"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function CustomerCard({ customer, onTaskUpdate, onNewTask, onTaskDelete }) {
  const [_, forceUpdate] = useState(0);
  const newTaskInputRef = useRef(null);

  // Re-render logic only for running tasks to save performance
  useEffect(() => {
    const hasRunningTasks = customer.tasks.some(t => t.running);
    if (!hasRunningTasks) return;

    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, [customer.tasks]);

  const totalTimeMs = (customer.tasks || []).reduce((sum, t) => {
    let elapsed = t.elapsed || 0;
    if (t.running && t.startTime) elapsed += Date.now() - t.startTime;
    return sum + elapsed;
  }, 0);

  const handleTaskUpdate = (taskId, field, value) => {
    const updatedTasks = customer.tasks.map(t =>
      t.id === taskId ? { ...t, [field]: value } : t
    );
    onTaskUpdate(customer.id, updatedTasks);
  };

  const toggleTimer = (taskId) => {
    const updatedTasks = customer.tasks.map(t => {
      if (t.id === taskId) {
        const now = Date.now();
        if (t.running) {
          // Stop
          return { ...t, running: false, elapsed: (t.elapsed || 0) + (now - t.startTime), startTime: null };
        } else {
          // Start
          return { ...t, running: true, startTime: now };
        }
      }
      return t;
    });
    onTaskUpdate(customer.id, updatedTasks);
  };

  const handleNewTask = () => {
    const val = newTaskInputRef.current?.value.trim();
    if (val) {
      onNewTask(customer.id, val);
      newTaskInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
            {customer.name.substring(0, 2).toUpperCase()}
          </div>
          {customer.name}
        </h2>
        <div className="flex items-center gap-2 text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 text-sm">
          <Clock size={14} />
          <span>{Math.floor(totalTimeMs / 1000 / 60)} min</span>
        </div>
      </div>

      {/* Task List */}
      <div className="p-4 space-y-3 flex-1">
        {customer.tasks.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-sm italic">
            Noch keine Aufgaben erfasst.
          </div>
        )}
        
        {customer.tasks.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onUpdate={handleTaskUpdate}
            onDelete={(taskId) => onTaskDelete(customer.id, taskId)}
            onToggleTimer={toggleTimer}
          />
        ))}
      </div>

      {/* Footer / Add Task */}
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
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Pinboard() {
  // Using LocalStorage for persistence in this demo instead of API
  const [text, setText] = useState(() => localStorage.getItem("pinboard_content") || "");

  useEffect(() => {
    localStorage.setItem("pinboard_content", text);
  }, [text]);

  return (
    <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 h-full flex flex-col">
      <div className="p-4 border-b border-yellow-100 flex items-center gap-2 text-yellow-800 font-semibold">
        <StickyNote size={18} />
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
  // Load initial state from LocalStorage or default to empty
  const [customers, setCustomers] = useState(() => {
    const saved = localStorage.getItem("customers_data");
    return saved ? JSON.parse(saved) : [];
  });
  const [newCustomerName, setNewCustomerName] = useState("");

  // Persist to LocalStorage whenever customers change
  useEffect(() => {
    localStorage.setItem("customers_data", JSON.stringify(customers));
  }, [customers]);

  const updateTasks = (customerId, tasks) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, tasks } : c));
  };

  const addTask = (customerId, title) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? {
      ...c,
      tasks: [...c.tasks, { 
        id: Date.now(), 
        title, 
        erledigt: false, 
        aberechnet: false, 
        kulant: false, 
        elapsed: 0, 
        running: false 
      }]
    } : c));
  };

  const deleteTask = (customerId, taskId) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? {
      ...c,
      tasks: c.tasks.filter(t => t.id !== taskId)
    } : c));
  };

  const addCustomer = (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    const newCustomer = { id: Date.now(), name: newCustomerName.trim(), tasks: [] };
    setCustomers(prev => [newCustomer, ...prev]);
    setNewCustomerName("");
  };

  const deleteCustomer = (id) => {
    if(window.confirm("Kunde wirklich löschen?")) {
      setCustomers(prev => prev.filter(c => c.id !== id));
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      
      {/* Navbar */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="https://static.wixstatic.com/media/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png/v1/fill/w_239,h_41,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png" alt="Logo" className="h-8" />
          </div>
          <div className="flex items-center gap-4">
             <div className="text-sm text-slate-500">
               {customers.length} Aktive Kunden
             </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          
          {/* Main Content Area (Customers) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* New Customer Input */}
            <form onSubmit={addCustomer} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex gap-3">
              <div className="bg-slate-100 p-2 rounded-md flex items-center justify-center text-slate-400">
                <Users size={20} />
              </div>
              <input
                type="text"
                placeholder="Neuen Kunden anlegen..."
                value={newCustomerName}
                onChange={e => setNewCustomerName(e.target.value)}
                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Erstellen
              </button>
            </form>

            {/* Customer Grid */}
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
                      onTaskUpdate={updateTasks}
                      onNewTask={addTask}
                      onTaskDelete={deleteTask}
                    />
                    <button 
                      onClick={() => deleteCustomer(c.id)}
                      className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-600 shadow-sm border border-slate-200 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar (Pinboard) */}
          <div className="lg:col-span-1 lg:sticky lg:top-24 h-[500px]">
            <Pinboard />
          </div>

        </div>
      </div>
    </div>
  );
}