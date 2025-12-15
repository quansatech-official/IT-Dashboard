import { useEffect, useState } from "react";

// Basis-URL für das FastAPI Backend
const API_BASE_URL = "http://localhost:8000"; // Passen Sie den Port an, falls Ihr Backend woanders läuft.

// Hilfsfunktion zur Formatierung der Zeit (in Millisekunden)
const formatTime = (milliseconds) => (milliseconds / 1000 / 60).toFixed(1);

// ----- Helper Komponenten -----
function CustomerCard({ customer, onNewTask, toggleTaskStatus, toggleTimerAPI }) {
  // Lokaler State, der nur für die Echtzeit-Anzeige des Timers genutzt wird (Tick pro Sekunde)
  const [now, setNow] = useState(Date.now());

  // 1. ECHTZEIT-TIMER-LOGIK: Aktualisiere die lokale Zeit jede Sekunde, WENN mindestens ein Task läuft
  useEffect(() => {
    const runningTask = (customer.tasks || []).find(t => t.running);
    let intervalId;

    if (runningTask) {
      intervalId = setInterval(() => {
        setNow(Date.now());
      }, 1000); // Aktualisiere jede Sekunde
    }

    // Cleanup-Funktion: Stoppt den Intervall, wenn die Komponente unmounted wird oder Tasks sich ändern
    return () => clearInterval(intervalId);
  }, [customer.tasks]);

  // Funktion zur Berechnung der Task-Zeit (einschließlich laufender Zeit)
  const getTaskTime = (task) => {
      if (task.running) {
          // Berechne die aktuelle Zeit: bereits erfasste Zeit + (jetzige Zeit - Startzeit)
          return (task.elapsed || 0) + (now - task.startTime);
      }
      return task.elapsed || 0;
  };
    
  // Gesamtzeit berechnen (nutzt die getTaskTime Funktion für laufende Tasks)
  const totalTime = (customer.tasks || []).reduce((sum, t) => sum + getTaskTime(t), 0);

  // KORREKTUR: Checkbox-Logik ruft API-Funktion auf
  const toggleTask = (taskId, field) => {
    toggleTaskStatus(customer.id, taskId, field);
  };

  // KORREKTUR: Timer-Logik ruft API-Funktion auf
  const toggleTimer = taskId => {
    toggleTimerAPI(customer.id, taskId);
  };
    
  return (
    <div style={{ background: "#ffffff", padding: 20, marginBottom: 20, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", borderLeft: '5px solid #007bff' }}>
      
      {/* HEADER: Name und Gesamtzeit */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottom: '1px solid #eee', paddingBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 20, color: '#333' }}>{customer.name}</h3>
        <span style={{ fontSize: 14, fontWeight: 'bold', color: '#007bff', background: '#e9f5ff', padding: '5px 10px', borderRadius: 5 }}>
          Gesamtzeit: {formatTime(totalTime)} min
        </span>
      </div>

      {/* TASK LISTE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(customer.tasks || []).map(task => (
          <div key={task.id} style={{ display: "flex", alignItems: "center", background: task.running ? '#fff3e0' : '#f9f9f9', padding: 10, borderRadius: 8, border: task.running ? '1px solid #ff9800' : '1px solid #eee' }}>
            
            {/* Task Title */}
            <span style={{ flexGrow: 1, fontWeight: '500', color: '#555', textDecoration: task.erledigt ? 'line-through' : 'none' }}>
                {task.title}
            </span>

            {/* Timer Button */}
            <button 
                onClick={() => toggleTimer(task.id)} 
                style={{ 
                    marginLeft: 15, 
                    padding: '6px 12px', 
                    border: 'none', 
                    borderRadius: 4, 
                    cursor: 'pointer', 
                    background: task.running ? "#f44336" : "#4CAF50",
                    color: "white",
                    fontWeight: 'bold'
                }}
            >
                {task.running ? "⏹ STOP" : "⏱ START"}
            </button>
            
            {/* Timer Zeit Anzeige (LIVE) */}
            <span style={{ marginLeft: 15, fontSize: 16, fontWeight: 'bold', color: '#333', minWidth: 60, textAlign: 'right' }}>
                {formatTime(getTaskTime(task))} min
            </span>

            {/* Checkboxen Container */}
            <div style={{ marginLeft: 20, display: 'flex', gap: 10, fontSize: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', color: task.erledigt ? '#4CAF50' : '#888' }}>
                    <input type="checkbox" checked={task.erledigt} onChange={() => toggleTask(task.id, "erledigt")} style={{ marginRight: 3 }} /> Erledigt
                </label>
                <label style={{ display: 'flex', alignItems: 'center', color: task.aberechnet ? '#007bff' : '#888' }}>
                    <input type="checkbox" checked={task.aberechnet} onChange={() => toggleTask(task.id, "aberechnet")} style={{ marginRight: 3 }} /> Abgerechnet
                </label>
                <label style={{ display: 'flex', alignItems: 'center', color: task.kulant ? '#ff9800' : '#888' }}>
                    <input type="checkbox" checked={task.kulant} onChange={() => toggleTask(task.id, "kulant")} style={{ marginRight: 3 }} /> Kulant
                </label>
            </div>
            
          </div>
        ))}

        {/* Neue Aufgabe Eingabe */}
        <div style={{ marginTop: 15, display: 'flex' }}>
          <input 
            type="text" 
            placeholder="Neue Aufgabe hinzufügen..." 
            id={`task-${customer.id}`} 
            style={{ padding: 8, flexGrow: 1, border: '1px solid #ccc', borderRadius: '4px 0 0 4px' }} 
          />
          <button onClick={() => {
            const val = document.getElementById(`task-${customer.id}`).value.trim();
            if (val) {
              onNewTask(customer.id, val);
              document.getElementById(`task-${customer.id}`).value = "";
            }
          }} style={{ padding: '8px 15px', border: 'none', background: '#007bff', color: 'white', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}>
            + Aufgabe
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------------------
// Die restlichen Komponenten (NewCustomerForm, Pinboard, App) benötigen die API_BASE_URL
// und die API-Logik. Ich nehme an, Sie möchten die bereits korrigierte API-Logik nutzen.
// Ich füge die API-Logik und die Komponenten-Anpassungen aus der vorherigen Antwort hier ein.
// -----------------------------------------------------------------------------------------


function NewCustomerForm({ onCreated }) {
  const [name, setName] = useState("");

  const addCustomer = () => {
    if (!name.trim()) return;
    fetch(`${API_BASE_URL}/api/customers`, {
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
      <input type="text" placeholder="Neuer Kunde" value={name} onChange={e => setName(e.target.value)} style={{ padding: 8, marginRight: 8, border: '1px solid #ccc', borderRadius: 4 }} />
      <button onClick={addCustomer} style={{ padding: '8px 15px', border: 'none', background: '#4CAF50', color: 'white', borderRadius: 4, cursor: 'pointer' }}>+ Kunde</button>
    </div>
  );
}

function Pinboard() {
  const [text, setText] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/pinboard`)
      .then(r => r.ok && r.text())
      .then(t => setText(t || ""));
  }, []);

  const save = val => {
    setText(val);
    fetch(`${API_BASE_URL}/api/pinboard`, { method: "POST", body: val });
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
      boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
      borderTop: '5px solid #ff9800'
    }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Notizbrett</h4>
      <textarea
        value={text}
        onChange={e => save(e.target.value)}
        style={{ width: "100%", height: "100%", minHeight: 100, border: "1px solid #eee", padding: 8, resize: "none", boxSizing: 'border-box' }}
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

  // API-LOGIK FÜR FETCH
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/customers`)
      .then(r => {
        if (!r.ok) {
            throw new Error(`HTTP-Status ${r.status}: Konnte Kundendaten nicht laden.`);
        }
        return r.json();
      })
      .then(data => {
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

  // HILFSFUNKTION: Aktualisiert einen Task lokal nach erfolgreicher API-Antwort
  const updateTaskInState = (customerId, updatedTask) => {
    setCustomers(prev => prev.map(c => 
      c.id === customerId ? { 
        ...c, 
        tasks: c.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) 
      } : c
    ));
  };
  
  // API-CALL: Timer Start/Stopp
  const toggleTimerAPI = (customerId, taskId) => {
      fetch(`${API_BASE_URL}/api/tasks/${taskId}/toggle_timer`, {
          method: 'PATCH'
      })
      .then(r => r.json())
      .then(updatedTask => {
          updateTaskInState(customerId, updatedTask);
      })
      .catch(err => console.error("Fehler beim Umschalten des Timers:", err));
  };

  // API-CALL: Checkbox-Status Update
  const toggleTaskStatus = (customerId, taskId, field) => {
      const customer = customers.find(c => c.id === customerId);
      const currentTask = customer?.tasks.find(t => t.id === taskId);
      if (!currentTask) return;

      const payload = { [field]: !currentTask[field] };

      fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(updatedTask => {
          updateTaskInState(customerId, updatedTask);
      })
      .catch(err => console.error("Fehler beim Aktualisieren des Status:", err));
  };
  
  // API-CALL: Neue Aufgabe erstellen
  const addTask = (customerId, title) => {
      const payload = { customer_id: customerId, title };
      
      fetch(`${API_BASE_URL}/api/tasks`, {
          method: 'POST',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
      })
      .then(r => r.json())
      .then(newTask => {
          setCustomers(prev => prev.map(c => c.id === customerId ? {
            ...c,
            tasks: [...c.tasks, newTask]
          } : c));
      })
      .catch(err => console.error("Fehler beim Hinzufügen der Aufgabe:", err));
  };

  const addCustomer = c => setCustomers(prev => [{ ...c, tasks: [] }, ...prev]);

  if (loading) return <div style={{ padding: 20 }}>Kunden werden geladen...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>Fehler: {error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f0f2f5", padding: 20 }}>
      <img src="https://www.quansatech.at/wp-content/uploads/2022/09/cropped-quansatech_logo_2022.svg" alt="Quansatech" style={{ height: 40, marginBottom: 20 }} />
      <NewCustomerForm onCreated={addCustomer} />
      {customers.length === 0 ? <div style={{ color: '#555', padding: 10, background: '#fff', borderRadius: 8 }}>Keine Kunden vorhanden.</div> :
        customers.map(c => 
          <CustomerCard 
            key={c.id} 
            customer={c} 
            onNewTask={addTask} 
            toggleTaskStatus={toggleTaskStatus}
            toggleTimerAPI={toggleTimerAPI}
          />)}
      <Pinboard />
    </div>
  );
}