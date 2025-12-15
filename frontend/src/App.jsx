import { useEffect, useState } from "react";

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pinboardText, setPinboardText] = useState("");

  // Laden der Kunden
  const loadCustomers = () => {
    fetch("/api/customers")
      .then(r => r.json())
      .then(data => {
        setCustomers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Fehler beim Laden der Kunden:", err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCustomers();
    // Pinboard initial laden
    const saved = localStorage.getItem("pinboard") || "";
    setPinboardText(saved);
  }, []);

  // Neuer Kunde anlegen
  const addCustomer = (name) => {
    fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    })
      .then(r => r.json())
      .then(c => setCustomers(prev => [c, ...prev]))
      .catch(err => console.error("Fehler beim Anlegen:", err));
  };

  // Neue Task anlegen
  const addTask = (customerId, title) => {
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId, title })
    })
      .then(r => r.json())
      .then(task => {
        setCustomers(prev => prev.map(c => c.id === customerId ? {...c, tasks: [...c.tasks, task]} : c));
      })
      .catch(err => console.error("Fehler beim Task anlegen:", err));
  };

  // Task Checkbox ändern
  const toggleTask = (customerId, taskId, field) => {
    setCustomers(prev => prev.map(c => {
      if (c.id !== customerId) return c;
      const tasks = c.tasks.map(t => t.id === taskId ? {...t, [field]: !t[field]} : t);
      return {...c, tasks};
    }));
  };

  // Task Timer starten/stoppen
  const toggleTimer = (customerId, taskId) => {
    setCustomers(prev => prev.map(c => {
      if (c.id !== customerId) return c;
      const tasks = c.tasks.map(t => {
        if (t.id !== taskId) return t;
        const now = Date.now();
        let elapsed = t.elapsed || 0;
        let running = !t.running;
        if (!t.running) t.startTime = now;
        else elapsed += now - (t.startTime || now);
        return {...t, running, elapsed, startTime: running ? now : 0};
      });
      return {...c, tasks};
    }));
  };

  // Gesamtzeit eines Kunden berechnen
  const totalTime = (tasks) => {
    const ms = tasks.reduce((sum, t) => sum + (t.elapsed || 0) + (t.running && t.startTime ? Date.now() - t.startTime : 0), 0);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) return <div style={{ padding: 20 }}>Lade Kunden...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>Fehler: {error}</div>;

  return (
    <div style={{ background: "#f0f2f5", minHeight: "100vh", padding: 0 }}>
      {/* Header mit Logo */}
      <div style={{ display: "flex", alignItems: "center", padding: 20, borderBottom: "1px solid #ccc", background: "#fff" }}>
        <img src="https://www.quansatech.at/wp-content/uploads/2024/03/quansatech-logo.svg" alt="Quansatech Logo" style={{ height: 50, marginRight: 16 }} />
        <h1 style={{ margin: 0 }}>Dashboard</h1>
      </div>

      <div style={{ display: "flex", padding: 20 }}>
        {/* Kundenbereich */}
        <div style={{ flex: 1, paddingRight: 20, overflowY: "auto" }}>
          <div style={{ marginBottom: 20 }}>
            <input type="text" placeholder="Neuer Kunde" id="newCustomer" style={{ padding: 8, width: 200, marginRight: 8 }} />
            <button onClick={() => {
              const val = document.getElementById("newCustomer").value.trim();
              if (val) { addCustomer(val); document.getElementById("newCustomer").value=""; }
            }}>+</button>
          </div>

          {customers.length === 0 ? <div>Keine Kunden gefunden.</div> :
            customers.map(c => (
              <div key={c.id} style={{ background: "#fff", padding: 16, marginBottom: 16, borderRadius: 8, boxShadow: "0 2px 5px rgba(0,0,0,0.1)", position: "relative" }}>
                <div style={{ fontWeight: "bold", fontSize: 18 }}>{c.name}</div>
                <div style={{ position: "absolute", top: 16, right: 16, fontSize: 12 }}>Gesamtzeit: {totalTime(c.tasks)}</div>
                <div style={{ marginTop: 8 }}>
                  {c.tasks.map(t => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                      <input type="checkbox" checked={t.erledigt} onChange={() => toggleTask(c.id, t.id, "erledigt")} /> Erledigt
                      <input type="checkbox" checked={t.aberechnet} onChange={() => toggleTask(c.id, t.id, "aberechnet")} style={{ marginLeft: 8 }} /> Aberechnet
                      <input type="checkbox" checked={t.kulant} onChange={() => toggleTask(c.id, t.id, "kulant")} style={{ marginLeft: 8 }} /> Kulant
                      <button onClick={() => toggleTimer(c.id, t.id)} style={{ marginLeft: 8 }}>{t.running ? "⏹" : "⏱"}</button>
                      <span style={{ marginLeft: 8, fontSize: 12 }}>
                        {((t.elapsed || 0) / 1000 / 60).toFixed(1)} min
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    <input type="text" placeholder="Neue Aufgabe" id={`task-${c.id}`} style={{ padding: 4, width: 150, marginRight: 4 }} />
                    <button onClick={() => {
                      const val = document.getElementById(`task-${c.id}`).value.trim();
                      if (val) { addTask(c.id, val); document.getElementById(`task-${c.id}`).value=""; }
                    }}>+</button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Pinboard */}
        <div style={{ width: 300, position: "relative" }}>
          <textarea
            value={pinboardText}
            onChange={e => {
              setPinboardText(e.target.value);
              localStorage.setItem("pinboard", e.target.value);
            }}
            placeholder="Notizen hier eingeben..."
            style={{ width: "100%", height: 400, padding: 12, borderRadius: 8, border: "1px solid #ccc", resize: "none" }}
          />
        </div>
      </div>
    </div>
  );
}