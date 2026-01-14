import { useEffect, useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";

const API = "/api";

const api = {
  customers: () => fetch(`${API}/customers`).then((r) => r.json()),
  createTimeTask: (payload) =>
    fetch(`${API}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
  updateTimeTask: (id, payload) =>
    fetch(`${API}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json())
};

const parseTimeToMinutes = (value) => {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

export default function App() {
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("new");
  const [taskTitle, setTaskTitle] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [travelMinutes, setTravelMinutes] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    api.customers().then((data) => {
      setCustomers(Array.isArray(data) ? data : []);
    });
  }, []);

  const customerNames = useMemo(
    () => customers.map((item) => item.name).filter(Boolean),
    [customers]
  );

  const activeCustomer = useMemo(() => {
    const needle = selectedCustomer.trim().toLowerCase();
    if (!needle) return null;
    return customers.find((item) => (item.name || "").trim().toLowerCase() === needle);
  }, [customers, selectedCustomer]);

  const activeTasks = useMemo(() => activeCustomer?.tasks || [], [activeCustomer]);

  const resetForm = () => {
    setSelectedTaskId("new");
    setTaskTitle("");
    setArrivalTime("");
    setDepartureTime("");
    setTravelMinutes("");
    setNote("");
  };

  const saveTimeEntry = async () => {
    setStatus("");
    if (!activeCustomer) {
      setStatus("Bitte Kunde auswaehlen.");
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
    const travelOffset = Number.parseInt(travelMinutes || "0", 10);
    const totalMinutes = diffMinutes + (Number.isFinite(travelOffset) ? travelOffset : 0);
    const noteText = note.trim();

    let targetTaskId = selectedTaskId;
    let targetTitle = taskTitle.trim() || "Vor-Ort Einsatz";
    if (noteText) {
      targetTitle = `${targetTitle} - ${noteText}`;
    }

    if (!targetTaskId || targetTaskId === "new") {
      const created = await api.createTimeTask({
        customer_id: activeCustomer.id,
        title: targetTitle
      });
      if (!created?.id) {
        setStatus("Aufgabe konnte nicht erstellt werden.");
        return;
      }
      targetTaskId = created.id;
    } else if (noteText) {
      const existing = activeTasks.find((task) => String(task.id) === String(targetTaskId));
      const updatedTitle = existing?.title
        ? `${existing.title} - ${noteText}`
        : targetTitle;
      await api.updateTimeTask(targetTaskId, { title: updatedTitle });
    }

    await api.updateTimeTask(targetTaskId, {
      elapsed: totalMinutes * 60000,
      running: false,
      startTime: 0
    });
    setStatus("Zeit gespeichert.");
    resetForm();
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>QT Workbench Mobil</h1>
        <p>Aufgabe -> Zeit -> Notiz</p>
      </header>

      <main className="main">
        {status ? <div className="status-pill">{status}</div> : null}

        <div className="card stack">
          <div className="card-header">
            <div className="section-title">Zeit nacherfassen</div>
            <p className="hint">Aufgabe auswaehlen, Ankunft & Abfahrt setzen.</p>
          </div>

          <div className="field">
            <label>Kunde</label>
            <input
              list="customer-list"
              value={selectedCustomer}
              onChange={(event) => setSelectedCustomer(event.target.value)}
              placeholder="Kunde auswaehlen"
            />
          </div>

          <div className="field">
            <label>Aufgabe</label>
            <select
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
            >
              <option value="new">Neue Aufgabe</option>
              {activeTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          {selectedTaskId === "new" ? (
            <div className="field">
              <label>Aufgabentitel</label>
              <input
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="z.B. Vor-Ort Einsatz"
              />
            </div>
          ) : null}

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

          <div className="field">
            <label>Fahrt (Minuten, optional)</label>
            <input
              type="number"
              min="0"
              value={travelMinutes}
              onChange={(event) => setTravelMinutes(event.target.value)}
              placeholder="z.B. 25"
            />
          </div>

          <div className="field">
            <label>Notiz</label>
            <textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Kurze Notiz zur Arbeit"
            />
          </div>

          <button className="primary-btn" type="button" onClick={saveTimeEntry}>
            Zeit speichern
          </button>

          <div className="hint" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <ClipboardList size={16} />
            Aufgabe -> Zeit -> Abrechnung (im Backend unveraendert)
          </div>
        </div>
      </main>

      <datalist id="customer-list">
        {customerNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}
