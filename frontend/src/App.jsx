import { useEffect, useState, useRef } from "react";
import { Play, Square, CheckCircle, DollarSign, Heart, Trash2, Plus, Clock, Users, StickyNote } from "lucide-react";

// ----- API -----
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

async function fetchCustomers() { const res = await fetch(`${API_BASE}/customers`); return res.json(); }
async function createCustomer(name) { const res = await fetch(`${API_BASE}/customers`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name})}); return res.json(); }
async function deleteCustomer(id) { await fetch(`${API_BASE}/customers/${id}`, { method:"DELETE"}); }
async function createTask(customer_id, title) { const res = await fetch(`${API_BASE}/tasks`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({customer_id, title})}); return res.json(); }
async function updateTask(task_id, data) { const res = await fetch(`${API_BASE}/tasks/${task_id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(data)}); return res.json(); }
async function toggleTaskTimer(task_id) { const res = await fetch(`${API_BASE}/tasks/${task_id}/toggle_timer`, { method:"PATCH"}); return res.json(); }
async function fetchPinboard() { const res = await fetch(`${API_BASE}/pinboard`); return res.json(); }
async function updatePinboard(id, content) { const res = await fetch(`${API_BASE}/pinboard/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({content})}); return res.json(); }

// ----- TaskItem -----
function TaskItem({ task, onUpdate, onDelete, onToggleTimer }) {
  const currentElapsed = (task.elapsed||0) + (task.running&&task.startTime?Date.now()-task.startTime:0);
  const formatTime = ms => { const s=Math.floor(ms/1000), m=Math.floor(s/60); return `${m.toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`; }

  return (
    <div className="group flex flex-col p-3 rounded-lg border bg-white hover:shadow-sm">
      <div className="flex items-start gap-3">
        <button onClick={()=>onToggleTimer(task.id)} className={`w-8 h-8 flex items-center justify-center rounded-full ${task.running?"bg-red-100 text-red-600":"bg-blue-50 text-blue-600"}`}>
          {task.running?<Square size={14}/>:<Play size={14}/>}
        </button>

        <textarea value={task.title} onChange={e=>onUpdate(task.id,"title",e.target.value)}
          rows={2} className={`flex-1 resize-none bg-transparent border-none focus:ring-0 p-1 text-sm ${task.erledigt?"line-through text-slate-400":"text-slate-700"}`} />

        <div className="text-xs font-mono w-12 text-right">{formatTime(currentElapsed)}</div>
      </div>

      <div className="flex items-center gap-1 mt-2">
        <button onClick={()=>onUpdate(task.id,"erledigt",!task.erledigt)} className={`p-1 rounded-md ${task.erledigt?"bg-green-100 text-green-600":"text-slate-300 hover:bg-slate-100"}`}><CheckCircle size={16}/></button>
        <button onClick={()=>onUpdate(task.id,"aberechnet",!task.aberechnet)} className={`p-1 rounded-md ${task.aberechnet?"bg-amber-100 text-amber-600":"text-slate-300 hover:bg-slate-100"}`}><DollarSign size={16}/></button>
        <button onClick={()=>onUpdate(task.id,"kulant",!task.kulant)} className={`p-1 rounded-md ${task.kulant?"bg-rose-100 text-rose-600":"text-slate-300 hover:bg-slate-100"}`}><Heart size={16}/></button>
        <button onClick={()=>onDelete(task.id)} className="ml-auto text-red-500 hover:text-red-600"><Trash2 size={16}/></button>
      </div>
    </div>
  );
}

// ----- CustomerCard -----
function CustomerCard({ customer, onTaskUpdate, onNewTask, onTaskDelete }) {
  const [_, forceUpdate] = useState(0);
  const newTaskRef = useRef(null);

  useEffect(()=>{
    if(customer.tasks.some(t=>t.running)){
      const interval=setInterval(()=>forceUpdate(n=>n+1),1000);
      return ()=>clearInterval(interval);
    }
  },[customer.tasks]);

  const totalElapsed = customer.tasks.reduce((sum,t)=>{let e=t.elapsed||0;if(t.running&&t.startTime)e+=Date.now()-t.startTime;return sum+e;},0);
  const handleNewTask = ()=>{
    const val=newTaskRef.current?.value.trim();
    if(val){onNewTask(customer.id,val); newTaskRef.current.value="";}
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 flex flex-col h-full min-h-[300px]">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-bold text-lg">{customer.name}</h2>
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <Clock size={14}/> {Math.floor(totalElapsed/1000/60)}:{Math.floor((totalElapsed/1000)%60).toString().padStart(2,"0")}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {customer.tasks.map(task=>(
          <TaskItem key={task.id} task={task} onUpdate={onTaskUpdate} onDelete={onTaskDelete} onToggleTimer={taskId=>onTaskUpdate(taskId,"toggleTimer")} />
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <input ref={newTaskRef} type="text" placeholder="Neue Aufgabe..." className="flex-1 rounded border px-2 py-1 text-sm" onKeyDown={e=>e.key==='Enter'&&handleNewTask()}/>
        <button onClick={handleNewTask} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"><Plus size={16}/></button>
      </div>
    </div>
  );
}

// ----- Pinboard -----
function Pinboard() {
  const [note,setNote]=useState({id:null,content:""});
  useEffect(()=>{fetchPinboard().then(setNote)},[]);
  const handleChange=e=>{setNote({...note,content:e.target.value}); if(note.id)updatePinboard(note.id,e.target.value);}

  return (
    <div className="bg-yellow-50 rounded-xl shadow p-4 flex flex-col h-full">
      <div className="flex items-center gap-2 font-semibold text-yellow-800 mb-2"><StickyNote size={18}/> Notizen</div>
      <textarea value={note.content} onChange={handleChange} className="flex-1 w-full resize-none bg-transparent border-none focus:ring-0 p-2"/>
    </div>
  )
}

// ----- App -----
export default function App(){
  const [customers,setCustomers]=useState([]);
  const [newCustomer,setNewCustomer]=useState("");

  const load=()=>fetchCustomers().then(setCustomers);
  useEffect(()=>{load();},[]);
  useEffect(()=>{const interval=setInterval(load,2000); return ()=>clearInterval(interval);},[]); // Live reload polling

  const handleAddCustomer=()=>{if(!newCustomer.trim())return; createCustomer(newCustomer).then(()=>{setNewCustomer("");load();});}
  const handleDeleteCustomer=id=>{if(window.confirm("Kunde löschen?")){deleteCustomer(id).then(load);}}
  
  const handleTaskUpdate=async(taskId,field,value)=>{
    if(field==="toggleTimer") await toggleTaskTimer(taskId);
    else await updateTask(taskId,{[field]:value});
    load();
  }

  const handleNewTask=(customerId,title)=>{createTask(customerId,title).then(load);}
  const handleDeleteTask=(taskId)=>{updateTask(taskId,{title:""}).then(load);} // einfache Löschung
  

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://static.wixstatic.com/media/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png" alt="QT-Workbench Logo" className="h-10 w-auto"/>
            <h1 className="text-xl font-bold text-slate-800">QT-Workbench</h1>
          </div>
          <div className="flex items-center gap-4 text-slate-500 text-sm">{customers.length} aktive Kunden</div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          <div className="lg:col-span-3 space-y-6">

            <div className="bg-white p-4 rounded-xl shadow flex gap-3">
              <div className="bg-slate-100 p-2 rounded-md flex items-center justify-center text-slate-400"><Users size={20}/></div>
              <input type="text" placeholder="Neuen Kunden anlegen..." value={newCustomer} onChange={e=>setNewCustomer(e.target.value)} className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 placeholder-slate-400"/>
              <button onClick={handleAddCustomer} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg">Erstellen</button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {customers.length===0?<div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400">Keine Kunden vorhanden.</div>:
                customers.map(c=>(
                  <div key={c.id} className="relative group">
                    <CustomerCard customer={c} onTaskUpdate={handleTaskUpdate} onNewTask={handleNewTask} onTaskDelete={handleDeleteTask}/>
                    <button onClick={()=>handleDeleteCustomer(c.id)} className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-600 shadow-sm border border-slate-200 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                  </div>
                ))
              }
            </div>

          </div>

          <div className="lg:col-span-1 lg:sticky lg:top-24 h-[500px]">
            <Pinboard />
          </div>
        </div>
      </div>
    </div>
  )
}