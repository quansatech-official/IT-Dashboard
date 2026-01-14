import { useEffect, useMemo, useState } from "react";
import { ClipboardList, List } from "lucide-react";

const API = "/api";

const api = {
  customers: () => fetch(`${API}/customers`).then((r) => r.json()),
  tasks: () => fetch(`${API}/tasks`).then((r) => r.json()),
  createTask: (payload) =>
    fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  updateTask: (id, payload) =>
    fetch(`${API}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json())
};

const tabs = [
  { id: "quick", label: "Schnell", icon: ClipboardList },
  { id: "time", label: "Aufgaben", icon: List }
];

const parseTimeToMinutes = (value) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

export default function App() {
  const [activeTab, setActiveTab] = useState("quick");
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [status, setStatus] = useState("");

  const [quickCustomer, setQuickCustomer] = useState("");
  const [quickText, setQuickText] = useState("");

  const [timeCustomer, setTimeCustomer] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");

  const load = () => {
    api.customers().then((data) => {
      setCustomers(Array.isArray(data) ? data : []);
    });
    api.tasks().then((data) => {
      setTasks(Array.isArray(data) ? data : []);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const customerNames = useMemo(
    () => customers.map((item) => item.name).filter(Boolean),
    [customers]
  );

  const customerById = useMemo(() => {
    const map = {};
    customers.forEach((customer) => {
      if (customer?.id) {
        map[customer.id] = customer;
      }
    });
    return map;
  }, [customers]);

  const findCustomer = (name) =>
    customers.find((item) => (item.name || "").toLowerCase() === name.trim().toLowerCase());

  const timeCustomerMatch = useMemo(() => {
    if (!timeCustomer.trim()) return null;
    return findCustomer(timeCustomer);
  }, [timeCustomer, customers]);

  const visibleTasks = useMemo(() => {
    if (!timeCustomerMatch) return tasks;
    return tasks.filter((task) => task.customer_id === timeCustomerMatch.id);
  }, [tasks, timeCustomerMatch]);

  const addQuickTasks = async () => {
    const lines = quickText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    const customer = quickCustomer.trim() ? findCustomer(quickCustomer) : null;
    if (quickCustomer.trim() && !customer) {
      setStatus("Bitte Kunde aus der Liste waehlen oder leer lassen.");
      return;
    }
    for (const line of lines) {
      await api.createTask({
        customer_id: customer?.id ?? null,
        title: line
      });
    }
    setQuickText("");
    setStatus("Aufgabe(n) gespeichert.");
    load();
  };

  const saveTimeEntry = async () => {
    setStatus("");
    if (!selectedTaskId) {
      setStatus("Bitte Aufgabe auswaehlen.");
      return;
    }
    const arrivalMinutes = parseTimeToMinutes(arrivalTime);
    const departureMinutes = parseTimeToMinutes(departureTime);
    if (arrivalMinutes === null || departureMinutes === null) {
      setStatus("Bitte Ankunft und Abfahrt angeben.");
      return;
    }
    let diffMinutes = departureMinutes - arrivalMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60;
    }
    const totalMinutes = diffMinutes;

    await api.updateTask(selectedTaskId, {
      elapsed: totalMinutes * 60000,
      running: false,
      startTime: 0
    });
    setStatus("Zeit gespeichert.");
    setArrivalTime("");
    setDepartureTime("");
    load();
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>QT Workbench Mobil</h1>
        <p>Aufgabe -> Zeit</p>
      </header>

      <main className="main">
        {status ? <div className="status-pill">{status}</div> : null}

        {activeTab === "quick" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Schnellerfassung</div>
              <p className="hint">Eine Aufgabe pro Zeile, Stichworte reichen.</p>
            </div>
            <div className="field">
              <label>Kunde (optional)</label>
              <input
                list="customer-list"
                value={quickCustomer}
                onChange={(event) => setQuickCustomer(event.target.value)}
                placeholder="Kunde auswaehlen"
              />
            </div>
            <div className="field">
              <label>Aufgaben</label>
              <textarea
                rows={6}
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                placeholder="z.B. Backup pruefen\nRouter Neustart"
              />
            </div>
            <button className="primary-btn" type="button" onClick={addQuickTasks}>
              Speichern
            </button>
          </div>
        )}

        {activeTab === "time" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Aufgaben & Zeit</div>
              <p className="hint">Aufgabe auswaehlen und Ankunft/Abfahrt erfassen.</p>
            </div>
            <div className="field">
              <label>Kunde (optional, Filter)</label>
              <input
                list="customer-list"
                value={timeCustomer}
                onChange={(event) => setTimeCustomer(event.target.value)}
                placeholder="Kunde filtern"
              />
            </div>
            <div className="field">
              <label>Aufgabe</label>
              <select
                value={selectedTaskId}
                onChange={(event) => setSelectedTaskId(event.target.value)}
              >
                <option value="">Bitte waehlen</option>
                {visibleTasks.map((task) => {
                  const customerName = task.customer_id
                    ? customerById[task.customer_id]?.name
                    : "";
                  return (
                    <option key={task.id} value={task.id}>
                      {customerName ? `${customerName}: ` : ""}{task.title}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="field">
              <label>Ankunft</label>
              <input
                type="time"
                value={arrivalTime}
                onChange={(event) => setArrivalTime(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Abfahrt</label>
              <input
                type="time"
                value={departureTime}
                onChange={(event) => setDepartureTime(event.target.value)}
              />
            </div>
            <button className="primary-btn" type="button" onClick={saveTimeEntry}>
              Zeit speichern
            </button>
            {!visibleTasks.length ? (
              <div className="hint">Keine Aufgaben gefunden.</div>
            ) : null}
          </div>
        )}
      </main>

      <datalist id="customer-list">
        {customerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <nav className="nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
