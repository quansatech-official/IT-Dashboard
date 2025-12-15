import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Trash2, CheckCircle, DollarSign, Heart, Plus, StickyNote, Clock, Users } from "lucide-react";

const API_BASE = "/api"; // in Production über Nginx Proxy

const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms/1000);
  const minutes = Math.floor(totalSeconds/60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
};

// ---------------- TaskItem ----------------
function TaskItem({task, onUpdate, onDelete, onToggleTimer}) {
  const currentElapsed = (task.elapsed||0) + (task.running && task.startTime ? Date.now()-task.startTime : 0);

  return (
    <div className={`group flex flex-col gap-2 p-3 rounded-lg border ${task.erledigt ? "bg-slate-50 border-slate-100 opacity-75" : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"}`}>
      <div className="flex gap-3 items-start">
        <button onClick={()=>onToggleTimer(task.id)} className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full ${task.running ? "bg-red-100 text-red-600 animate-pulse" : "bg-blue-50 text-blue-600"}`}>
          {task.running ? <Square size={14}/> : <Play size={14}/>}
        </button>
        <textarea
          value={task.title}
          onChange={(e)=>onUpdate(task.id,"title",e.target.value)}
          className={`flex-1 bg-transparent border-none focus:ring-0 p-0 text-sm ${task.erledigt ? "text-slate-400 line-through" : "text-slate-700"}`}
          rows={2}
        />
        <div className="text-xs font-mono w-12 text-right">{formatTime(currentElapsed)}</div>
        <button onClick={()=>onDelete(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 rounded-md"><Trash2 size={16}/></button>
      </div>
    </div>
  );
}

// ---------------- CustomerCard ----------------
function CustomerCard({customer, onTaskUpdate, onNewTask, onTaskDelete}) {
  const [_, forceUpdate] = useState(0);
  const newTaskInputRef = useRef(null);

  useEffect(()=>{
    const hasRunning = customer.tasks.some(t=>t.running);
    if(!hasRunning) return;
    const interval = setInterval(()=>forceUpdate(n=>n+1),1000);
    return ()=>clearInterval(interval);
  }, [customer.tasks]);

  const totalTimeMs = (customer.tasks||[]).reduce((sum,t)=>{
    let elapsed = t.elapsed||0;
    if(t.running && t.startTime) elapsed += Date.now()-t.startTime;
    return sum + elapsed;
  },0);

  const handleTaskUpdate = (id,field,value)=>{
    const updated = customer.tasks.map(t=>t.id===id ? {...t,[field]:value} : t);
    onTaskUpdate(customer.id, updated);
  }

  const toggleTimer = async (id)=>{
    await fetch(`${API_BASE}/tasks/${id}/toggle_timer`, {method:"PATCH"});
    onTaskUpdate(customer.id, [...customer.tasks]);
  }

  const handleNewTask = async ()=>{
    const val = newTaskInputRef.current?.value.trim();
    if(!val) return;
    await fetch(`${API_BASE}/tasks`, {
      method:"POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({customer_id:customer.id,title:val})
    });
    newTaskInputRef.current.value="";
    onNewTask(customer.id,val);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden hover:shadow-md">
      <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
            {customer.name.substring(0,2).toUpperCase()}
          </div>
          {customer.name}
        </h2>
        <div className="flex items-center gap-2 text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 text-sm">
          <Clock size={14}/> <span>{formatTime(totalTimeMs)}</span>
        </div>
      </div>
      <div className="p-4 space-y-3 flex-1">
        {customer.tasks.map(t=>(
          <TaskItem key={t.id} task={t} onUpdate={handleTaskUpdate} onDelete={(id)=>onTaskDelete(customer.id,id)} onToggleTimer={toggleTimer}/>
        ))}
        <div className="flex gap-2">
          <input ref={newTaskInputRef} type="text" placeholder="Neue Aufgabe..." className="flex-1 p-2 border rounded-md" onKeyDown={e=>e.key==='Enter' && handleNewTask()}/>
          <button onClick={handleNewTask} className="px-3 py-2 bg-blue-600 text-white rounded-md"><Plus size={18}/></button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Pinboard ----------------
function Pinboard() {
  const [note,setNote] = useState({id:null,content:""});
  const timeoutRef = useRef(null);

  useEffect(()=>{
    fetch(`${API_BASE}/pinboard`).then(r=>r.json()).then(setNote);
  },[]);

  const saveNote = (content)=>{
    if(!note.id) return;
    if(timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(()=>{
      fetch(`${API_BASE}/pinboard/${note.id}`, {
        method:"PATCH",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({content})
      });
    },500);
  }

  return (
    <div className="bg-yellow-50 rounded-xl shadow-sm border border-yellow-200 h-full flex flex-col">
      <div className="p-4 border-b border-yellow-100 flex items-center gap-2 text-yellow-800 font-semibold">
        <StickyNote size={18}/> <span>Notizen</span>
      </div>
      <textarea value={note.content} onChange={e=>{setNote(n=>({...n,content:e.target.value})); saveNote(e.target.value);}}
        className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 p-4 text-slate-700 leading-relaxed text-sm"
        placeholder="Schreiben Sie hier wichtige Notizen..."
      />
    </div>
  )
}

// ---------------- App ----------------
export default function App() {
  const [customers,setCustomers] = useState([]);
  const [newCustomerName,setNewCustomerName] = useState("");

  const fetchCustomers = ()=>fetch(`${API_BASE}/customers`).then(r=>r.json()).then(setCustomers);
  useEffect(()=>fetchCustomers(),[]);

  const addCustomer = async (e)=>{
    e.preventDefault();
    if(!newCustomerName.trim()) return;
    await fetch(`${API_BASE}/customers`, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name:newCustomerName})});
    setNewCustomerName("");
    fetchCustomers();
  }

  const updateTasks = (customerId,tasks)=>{
    setCustomers(prev=>prev.map(c=>c.id===customerId ? {...c,tasks} : c));
  }

  const addTask = (customerId,title)=>{
    fetchCustomers();
  }

  const deleteTask = (customerId,taskId)=>{
    fetchCustomers();
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10 p-4 flex justify-between">
        <h1 className="font-bold">Dashboard</h1>
        <div>{customers.length} Kunden</div>
      </header>
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-3 space-y-6">
          <form onSubmit={addCustomer} className="flex gap-3 mb-4">
            <input value={newCustomerName} onChange={e=>setNewCustomerName(e.target.value)} placeholder="Neuen Kunden..." className="flex-1 p-2 border rounded-md"/>
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-md">Erstellen</button>
          </form>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {customers.map(c=>(
              <CustomerCard key={c.id} customer={c} onTaskUpdate={updateTasks} onNewTask={addTask} onTaskDelete={deleteTask}/>
            ))}
          </div>
        </div>
        <div className="lg:col-span-1 lg:sticky lg:top-24 h-[500px]">
          <Pinboard/>
        </div>
      </div>
    </div>
  )
}