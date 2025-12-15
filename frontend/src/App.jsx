import { useEffect, useState } from "react";

// ----- Customer Card -----
function CustomerCard({ customer, onTaskUpdate, onNewTask, onTaskDelete }) {
  const [_, forceUpdate] = useState(0); // Für Live-Timer

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
    <div className="bg-white p-4 rounded-lg shadow-md mb-4 relative">
      <div className="font-bold text-lg">{customer.name}</div>
      <div className="absolute top-4 right-4 text-sm text-gray-500">
        Gesamtzeit: {Math.floor(totalTime / 1000 / 60)} min
      </div>

      <div className="mt-2">
        {(customer.tasks || []).map(task => {
          const elapsed = (task.elapsed || 0) + (task.running && task.startTime ? Date.now() - task.startTime : 0);
          return (
            <div key={task.id} className="flex items-center mb-2 gap-2">
              <input type="checkbox" checked={task.erledigt} onChange={() => toggleTask(task.id, "erledigt")} className="w-4 h-4" />
              <input type="checkbox" checked={task.aberechnet} onChange={() => toggleTask(task.id, "aberechnet")} className="w-4 h-4" />
              <input type="checkbox" checked={task.kulant} onChange={() => toggleTask(task.id, "kulant")} className="w-4 h-4" />

              <input
                type="text"
                value={task.title}
                onChange={e => handleEdit(task.id, e.target.value)}
                className="border rounded px-2 py-1 flex-1"
              />

              <button
                onClick={() => toggleTimer(task.id)}
                className={`px-2 py-1 rounded ${task.running ? "bg-red-500 hover:bg-red-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}`}
              >
                {task.running ? "⏹" : "⏱"}
              </button>
              <span className="text-sm text-gray-600">
                {Math.floor(elapsed / 1000 / 60)}:{Math.floor((elapsed / 1000) % 60).toString().padStart(2, "0")} min
              </span>

              <button
                onClick={() => onTaskDelete(customer.id, task.id)}
                className="px-2 py-1 bg-gray-300 hover:bg-gray-400 rounded"
              >
                🗑
              </button>
            </div>
          );
        })}

        <div className="flex mt-1 gap-2">
          <input type="text" placeholder="Neue Aufgabe" id={`task-${customer.id}`} className="border rounded px-2 py-1 flex-1" />
          <button
            onClick={() => {
              const val = document.getElementById(`task-${customer.id}`).value.trim();
              if (val) {
                onNewTask(customer.id, val);
                document.getElementById(`task-${customer.id}`).value = "";
              }
            }}
            className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
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
    <div className="flex mb-4 gap-2">
      <input
        type="text"
        placeholder="Neuer Kunde"
        value={name}
        onChange={e => setName(e.target.value)}
        className="border rounded px-2 py-1 flex-1"
      />
      <button onClick={addCustomer} className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded">
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
    <div className="fixed top-5 right-5 w-72 min-h-[150px] bg-white p-4 rounded-lg shadow-md">
      <textarea
        value={text}
        onChange={e => save(e.target.value)}
        className="w-full h-full border-none resize-none"
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
    <div className="flex flex-col min-h-screen bg-gray-100 p-5">
      <img src="https://www.quansatech.at/wp-content/uploads/2022/09/cropped-quansatech_logo_2022.svg" alt="Quansatech" className="h-10 mb-4" />
      <NewCustomerForm onCreated={addCustomer} />
      {customers.length === 0 ? <div>Keine Kunden vorhanden.</div> :
        customers.map(c => (
          <CustomerCard
            key={c.id}
            customer={c}
            onTaskUpdate={updateTasks}
            onNewTask={addTask}
            onTaskDelete={deleteTask}
          />
        ))
      }
      <Pinboard />
    </div>
  );
}