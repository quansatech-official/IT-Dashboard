import { useEffect, useState, useRef } from "react";

// Dummy logo URL, später durch echte von quansatech.at ersetzen
const LOGO_URL = "https://www.quansatech.at/logo.png";

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pinboard, setPinboard] = useState("");
  const pinRef = useRef(null);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCustomers(data.map(c => ({
        ...c,
        tasks: c.tasks || [],
      })));
      setLoading(false);
    } catch (err) {
      console.error("Fehler beim Laden der Kunden:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();

    // Pinboard laden
    const saved = localStorage.getItem("pinboard") || "";
    setPinboard(saved);
  }, []);

  const addCustomer = async (name) => {
    if (!name.trim()) return;
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) fetchCustomers();
  };

  const addTask = (customerId, title) => {
    if (!title.trim()) return;
    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? { ...c, tasks: [...c.tasks, { id: Date.now(), title, erledigt: false, aberechnet: false, kulant: false, running: false, elapsed: 0 }] }
          : c
      )
    );
  };

  const toggleTask = (customerId, taskId, field) => {
    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? {
              ...c,
              tasks: c.tasks.map(t => t.id === taskId ? { ...t, [field]: !t[field] } : t)
            }
          : c
      )
    );
  };

  const toggleTimer = (customerId, taskId) => {
    setCustomers(prev =>
      prev.map(c =>
        c.id === customerId
          ? {
              ...c,
              tasks: c.tasks.map(t => {
                if (t.id !== taskId) return t;
                if (t.running) {
                  // Stop timer
                  return { ...t, running: false, elapsed: t.elapsed + (Date.now() - t.startTime) };
                } else {
                  // Start timer
                  return { ...t, running: true, startTime: Date.now() };
                }
              })
            }
          : c
      )
    );
  };

  const totalTime = (tasks) =>
    ((tasks || []).reduce((sum, t) => sum + (t.elapsed || 0) + (t.running && t.startTime ? Date.now() - t.startTime : 0), 0) / 1000 / 60).toFixed(1);

  const handlePinboardChange = (e) => {
    const val = e.target.value;
    setPinboard(val);
    localStorage.setItem("pinboard", val);
  };

  if (loading) return <div style={{ padding: 20 }}>Kunden werden geladen...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>Fehler: {error}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#f0f2f5" }}>
      <header style={{ display: "flex", alignItems: "center", padding: 10, background: "#fff", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>
        <img src={LOGO_URL} alt="Quansatech" style={{ height: 40, marginRight: 10 }} />
        <h1 style={{ margin: 0 }}>Quansatech Kunden & Aufgaben</h1>
      </header>
      <div style={{ display: "flex", flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ flex: 1, marginRight: 20 }}>
          <div style={{ marginBottom: 20 }}>
            <input type="text" placeholder="Neuen Kunden anlegen" id="new-customer" style={{ padding: 8, width: 200, marginRight: 8 }} />
            <button onClick={() => {
              const name = document.getElementById("new-customer").value;
              addCustomer(name);
              document.getElementById("new-customer").value = "";
            }}>+</button>
          </div>
          {customers.length === 0 && <div>Keine Kunden gefunden.</div>}
          {customers.map(c => (
            <div key={c.id} style={{ background: "#fff", padding: 16, marginBottom: 16, borderRadius: 8, boxShadow: "0 2px 5px rgba(0,0,0,0.1)", position: "relative" }}>
              <div style={{ fontWeight: "bold", fontSize: 18 }}>{c.name}</div>
              <div style={{ position: "absolute", top: 16, right: 16, fontSize: 12 }}>Gesamtzeit: {totalTime(c.tasks)} min</div>
              <div style={{ marginTop: 8 }}>
                {(c.tasks || []).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
                    <input type="checkbox" checked={t.erledigt} onChange={() => toggleTask(c.id, t.id, "erledigt")} /> Erledigt
                    <input type="checkbox" checked={t.aberechnet} onChange={() => toggleTask(c.id, t.id, "aberechnet")} style={{ marginLeft: 8 }} /> Aberechnet
                    <input type="checkbox" checked={t.kulant} onChange={() => toggleTask(c.id, t.id, "kulant")} style={{ marginLeft: 8 }} /> Kulant
                    <button onClick={() => toggleTimer(c.id, t.id)} style={{ marginLeft: 8 }}>{t.running ? "⏹" : "⏱"}</button>
                    <span style={{ marginLeft: 8, fontSize: 12 }}>{(((t.elapsed || 0) + (t.running && t.startTime ? Date.now() - t.startTime : 0)) / 1000 / 60).toFixed(1)} min</span>
                  </div>
                ))}
                <div style={{ marginTop: 4 }}>
                  <input type="text" placeholder="Neue Aufgabe" id={`task-${c.id}`} style={{ padding: 4, width: 150, marginRight: 4 }} />
                  <button onClick={() => {
                    const title = document.getElementById(`task-${c.id}`).value.trim();
                    if (title) {
                      addTask(c.id, title);
                      document.getElementById(`task-${c.id}`).value = "";
                    }
                  }}>+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ width: 300, position: "sticky", top: 20, height: "fit-content" }}>
          <div style={{ background: "#fff", padding: 16, borderRadius: 8, boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>
            <h2>Pinboard</h2>
            <textarea
              ref={pinRef}
              value={pinboard}
              onChange={handlePinboardChange}
              style={{ width: "100%", height: 200, padding: 8 }}
              placeholder="Hier Notizen eintragen…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}