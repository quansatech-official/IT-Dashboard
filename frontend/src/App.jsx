import { useEffect, useState } from "react";

// ----- Helper Komponenten -----
function CustomerCard({ customer, onTaskUpdate, onNewTask }) {
  const totalTime = (customer.tasks || []).reduce((sum, t) => sum + (t.elapsed || 0), 0);

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

  return (
    <div style={{ background: "#fff", padding: 16, marginBottom: 16, borderRadius: 8, boxShadow: "0 2px 5px rgba(0,0,0,0.1)", position: "relative" }}>
      <div style={{ fontWeight: "bold", fontSize: 18 }}>{customer.name}</div>
      <div style={{ position: "absolute", top: 16, right: 16, fontSize: 12 }}>
        Gesamtzeit: {(totalTime / 1000 / 60).toFixed(1)} min
      </div>
      <div style={{ marginTop: 8 }}>
        {(customer.tasks || []).map(task => (
          <div key={task.id} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
            <input type="checkbox" checked={task.erledigt} onChange={() => toggleTask(task.id, "erledigt")} /> Erledigt
            <input type="checkbox" checked={task.aberechnet} onChange={() => toggleTask(task.id, "aberechnet")} style={{ marginLeft: 8 }} /> Aberechnet
            <input type="checkbox" checked={task.kulant} onChange={() => toggleTask(task.id, "kulant")} style={{ marginLeft: 8 }} /> Kulant
            <button onClick={() => toggleTimer(task.id)} style={{ marginLeft: 8 }}>{task.running ? "⏹" : "⏱"}</button>
            <span style={{ marginLeft: 8, fontSize: 12 }}>{(((task.elapsed || 0) / 1000 / 60).toFixed(1))} min</span>
          </div>
        ))}
        <div style={{ marginTop: 4 }}>
          <input type="text" placeholder="Neue Aufgabe" id={`task-${customer.id}`} style={{ padding: 4, width: 150, marginRight: 4 }} />
          <button onClick={() => {
            const val = document.getElementById(`task-${customer.id}`).value.trim();
            if (val) {
              onNewTask(customer.id, val);
              document.getElementById(`task-${customer.id}`).value = "";
            }
          }}>+</button>
        </div>
      </div>
    </div>
  );
}

function NewCustomerForm({ onCreated }) {
  const [name, setName] = useState("");

  const addCustomer = () => {
    if (!name.trim()) return;
    fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() })
    })
      .then(r => r.json())
      .then(c => onCreated(c))
      .finally(() => setName(""));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <input type="text" placeholder="Neuer Kunde" value={name} onChange={e => setName(e.target.value)} style={{ padding: 4, marginRight: 4 }} />
      <button onClick={addCustomer}>+</button>
    </div>
  );
}

// ----- Pinboard -----
function Pinboard() {
  const [text, setText] = useState("");

  useEffect(() => {
    // Lade vorhandene Notiz (optional von backend)
    fetch("/api/pinboard")
      .then(r => r.ok && r.text())
      .then(t => setText(t || ""));
  }, []);

  const save = val => {
    setText(val);
    fetch("/api/pinboard", { method: "POST", body: val });
  };

  return (
    <div style={{
      position: "fixed",
      top: 20,
      right: 20,
      width: 300,
      minHeight: 150,
      background: "#fff",
      padding: 16,
      borderRadius: 8,
      boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
    }}>
      <textarea
        value={text}
        onChange={e => save(e.target.value)}
        style={{ width: "100%", height: "100%", border: "none", resize: "none" }}
        placeholder="Notiz eingeben..."
      />
    </div>
  );
}

// ----- Hauptkomponente -----
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/customers")
      .then(r => {
        // Prüfe auf HTTP-Fehler (Status 4xx oder 5xx)
        if (!r.ok) {
            throw new Error(`HTTP-Status ${r.status}: Konnte Kundendaten nicht laden.`);
        }
        return r.json();
      })
      .then(data => {
        // KORREKTUR: Prüfe, ob die Daten ein Array sind, um 'map' sicher aufzurufen.
        // Wenn 'data' kein Array ist (z.B. null oder ein Fehlerobjekt), verwende ein leeres Array.
        const customersArray = Array.isArray(data) ? data : [];
        
        const normalized = customersArray.map(c => ({ 
            ...c, 
            tasks: Array.isArray(c.tasks) ? c.tasks : [] 
        }));
        
        setCustomers(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error("Fehler beim Laden der Kunden:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const updateTasks = (customerId, tasks) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, tasks } : c));
  };

  const addTask = (customerId, title) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? {
      ...c,
      tasks: [...c.tasks, { id: Date.now(), title, erledigt: false, aberechnet: false, kulant: false, elapsed: 0, running: false }]
    } : c));
  };

  const addCustomer = c => setCustomers(prev => [{ ...c, tasks: [] }, ...prev]);

  if (loading) return <div style={{ padding: 20 }}>Kunden werden geladen...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>Fehler: {error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f0f2f5", padding: 20 }}>
      <img src="https://www.quansatech.at/wp-content/uploads/2022/09/cropped-quansatech_logo_2022.svg" alt="Quansatech" style={{ height: 40, marginBottom: 16 }} />
      <NewCustomerForm onCreated={addCustomer} />
      {customers.length === 0 ? <div>Keine Kunden vorhanden.</div> :
        customers.map(c => <CustomerCard key={c.id} customer={c} onTaskUpdate={updateTasks} onNewTask={addTask} />)}
      <Pinboard />
    </div>
  );
}