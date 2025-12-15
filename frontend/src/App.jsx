import { useState, useEffect } from "react";

// ----- Customer Card -----
function CustomerCard({ customer, onTaskUpdate, onNewTask, onTaskDelete }) {
  const [_, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const totalTime = (customer.tasks || []).reduce((sum, t) => {
    let elapsed = t.elapsed || 0;
    if (t.running && t.startTime) elapsed += Date.now() - t.startTime;
    return sum + elapsed;
  }, 0);

  const toggleTask = (taskId, field) => {
    const updatedTasks = (customer.tasks || []).map(t =>
      t.id === taskId ? { ...t, [field]: !t[field] } : t
    );
    onTaskUpdate(customer.id, updatedTasks);
  };

  const toggleTimer = taskId => {
    const updatedTasks = (customer.tasks || []).map(t => {
      if (t.id === taskId) {
        const now = Date.now();
        if (t.running) {
          const elapsed = (t.elapsed || 0) + (now - t.startTime);
          return { ...t, running: false, elapsed };
        } else {
          return { ...t, running: true, startTime: now };
        }
      }
      return t;
    });
    onTaskUpdate(customer.id, updatedTasks);
  };

  const handleEdit = (taskId, value) => {
    const updatedTasks = (customer.tasks || []).map(t =>
      t.id === taskId ? { ...t, title: value } : t
    );
    onTaskUpdate(customer.id, updatedTasks);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6 hover:shadow-2xl transition-shadow duration-300">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{customer.name}</h2>
        <span className="text-sm text-gray-500">
          Gesamt: {Math.floor(totalTime / 1000 / 60)} min
        </span>
      </div>

      <div className="space-y-2">
        {(customer.tasks || []).map(task => {
          const elapsed = (task.elapsed || 0) + (task.running && task.startTime ? Date.now() - task.startTime : 0);
          return (
            <div
              key={task.id}
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors duration-200
                ${task.erledigt ? "bg-gray-100 text-gray-400 line-through" : "bg-gray-50 hover:bg-gray-100"}
              `}
            >
              <input type="checkbox" checked={task.erledigt} onChange={() => toggleTask(task.id, "erledigt")} className="w-5 h-5" />
              <input type="checkbox" checked={task.aberechnet} onChange={() => toggleTask(task.id, "aberechnet")} className="w-5 h-5" />
              <input type="checkbox" checked={task.kulant} onChange={() => toggleTask(task.id, "kulant")} className="w-5 h-5" />

              <input
                type="text"
                value={task.title}
                onChange={e => handleEdit(task.id, e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-sm"
              />

              <button
                onClick={() => toggleTimer(task.id)}
                className={`px-3 py-1 rounded-md text-white text-sm font-medium transition-colors
                  ${task.running ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}
                `}
              >
                {task.running ? "⏹" : "⏱"}
              </button>

              <span className="text-sm text-gray-600 w-16 text-right">
                {Math.floor(elapsed / 1000 / 60)}:{Math.floor((elapsed / 1000) % 60).toString().padStart(2, "0")}
              </span>

              <button
                onClick={() => onTaskDelete(customer.id, task.id)}
                className="px-2 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm"
              >
                🗑
              </button>
            </div>
          );
        })}

        <div className="flex mt-2 gap-2">
          <input type="text" placeholder="Neue Aufgabe" id={`task-${customer.id}`} className="border rounded px-2 py-1 flex-1" />
          <button
            onClick={() => {
              const val = document.getElementById(`task-${customer.id}`).value.trim();
              if (val) {
                onNewTask(customer.id, val);
                document.getElementById(`task-${customer.id}`).value = "";
              }
            }}
            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- New Customer Form -----
function NewCustomerForm({ onCreated }) {
  const [name, setName] = useState("");

  const addCustomer = () => {
    if (!name.trim()) return;
    const newCustomer = { id: Date.now(), name: name.trim(), tasks: [] };
    onCreated(newCustomer);
    setName("");
  };

  return (
    <div className="flex mb-6 gap-2">
      <input
        type="text"
        placeholder="Neuer Kunde"
        value={name}
        onChange={e => setName(e.target.value)}
        className="border rounded px-3 py-1 flex-1"
      />
      <button
        onClick={addCustomer}
        className="px-4 py-1 bg-green-500 hover:bg-green-600 text-white rounded-md"
      >
        +
      </button>
    </div>
  );
}

// ----- Pinboard -----
function Pinboard() {
  const [text, setText] = useState("");

  useEffect(() => {
    fetch("/api/pinboard")
      .then(r => r.ok && r.text())
      .then(t => setText(t || ""));
  }, []);

  const save = val => {
    setText(val);
    fetch("/api/pinboard", { method: "POST", body: val });
  };

  return (
    <div className="fixed top-5 right-5 w-80 min-h-[180px] bg-white p-4 rounded-xl shadow-lg">
      <textarea
        value={text}
        onChange={e => save(e.target.value)}
        className="w-full h-full border-none resize-none focus:outline-none"
        placeholder="Notiz eingeben..."
      />
    </div>
  );
}

// ----- App -----
export default function App() {
  const [customers, setCustomers] = useState([]);

  const updateTasks = (customerId, tasks) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, tasks } : c));
  };

  const addTask = (customerId, title) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? {
      ...c,
      tasks: [...c.tasks, { id: Date.now(), title, erledigt: false, aberechnet: false, kulant: false, elapsed: 0, running: false }]
    } : c));
  };

  const deleteTask = (customerId, taskId) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? {
      ...c,
      tasks: c.tasks.filter(t => t.id !== taskId)
    } : c));
  };

  const addCustomer = c => setCustomers(prev => [c, ...prev]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 p-6">
      <img src="https://static.wixstatic.com/media/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png/v1/fill/w_239,h_41,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/d613cf_81e665f4b1be40469a05c0b3b30b6cb4~mv2.png" alt="Logo" className="h-10 mb-6" />
      <NewCustomerForm onCreated={addCustomer} />

      {customers.length === 0 ? (
        <div className="text-gray-500">Keine Kunden vorhanden.</div>
      ) : (
        customers.map(c => (
          <CustomerCard
            key={c.id}
            customer={c}
            onTaskUpdate={updateTasks}
            onNewTask={addTask}
            onTaskDelete={deleteTask}
          />
        ))
      )}

      <Pinboard />
    </div>
  );
}