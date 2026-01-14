import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, FileText, Timer } from "lucide-react";

const API = "/api";

const api = {
  customers: () => fetch(`${API}/customers`).then((r) => r.json()),
  dayTask: (payload) =>
    fetch(`${API}/day_tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then((r) => r.json()),
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
    })
};

const tabs = [
  { id: "quick", label: "Schnell", icon: ClipboardList },
  { id: "delivery", label: "Lieferschein", icon: FileText },
  { id: "timer", label: "Stoppuhr", icon: Timer }
];

const formatElapsed = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${remMinutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState("quick");
  const [customers, setCustomers] = useState([]);
  const [status, setStatus] = useState("");
  const [quickCustomer, setQuickCustomer] = useState("");
  const [quickText, setQuickText] = useState("");
  const [deliveryCustomer, setDeliveryCustomer] = useState("");
  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [deliveryItems, setDeliveryItems] = useState("");
  const [deliveryTemplate, setDeliveryTemplate] = useState("");
  const [deliveryWorkTime, setDeliveryWorkTime] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [timerCustomer, setTimerCustomer] = useState("");
  const [timerTitle, setTimerTitle] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerStart, setTimerStart] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const signatureRef = useRef(null);

  const deliveryTemplates = [
    "Backup pruefen",
    "Update/ Patch einspielen",
    "Monitoring kontrollieren",
    "Sicherheitstest",
    "Stoerung behoben",
    "Netzwerk optimiert",
    "Benutzer anlegen",
    "Hardware getauscht",
    "Dokumentation aktualisiert"
  ];

  useEffect(() => {
    api.customers().then((data) => {
      setCustomers(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    if (!timerRunning || !timerStart) return;
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - timerStart);
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [timerRunning, timerStart]);

  const customerNames = useMemo(
    () => customers.map((item) => item.name).filter(Boolean),
    [customers]
  );

  const findCustomer = (name) =>
    customers.find((item) => (item.name || "").toLowerCase() === name.trim().toLowerCase());

  const addQuickTasks = async () => {
    const lines = quickText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    for (const line of lines) {
      await api.dayTask({
        title: line,
        customer: quickCustomer.trim(),
        status: "todo"
      });
    }
    setQuickText("");
    setStatus("Schnellerfassung gespeichert.");
  };

  const addDeliveryNote = async () => {
    const title = deliveryTitle.trim() || "Lieferschein";
    const items = deliveryItems
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(", ");
    const timeText = deliveryWorkTime.trim();
    if (timeText && !timeText.match(/^\d{1,2}:\d{2}$/)) {
      setStatus("Arbeitszeit bitte als HH:MM eingeben.");
      return;
    }
    const summary = [
      items ? `${title}: ${items}` : title,
      timeText ? `Arbeitszeit ${timeText} h` : "",
      signatureData ? "Unterschrift erfasst" : "Unterschrift fehlt"
    ]
      .filter(Boolean)
      .join(" | ");
    await api.dayTask({
      title: summary,
      customer: deliveryCustomer.trim(),
      status: "todo",
      signature_base64: signatureData || ""
    });
    setDeliveryTitle("");
    setDeliveryItems("");
    setDeliveryTemplate("");
    setDeliveryWorkTime("");
    setSignatureData("");
    setStatus("Lieferschein gespeichert.");
  };

  const handleTemplateSelect = (template) => {
    setDeliveryTemplate(template);
    setDeliveryItems((prev) => {
      const next = prev ? `${prev}\n${template}` : template;
      return next;
    });
  };

  const startSignature = (event) => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2f2a24";
    ctx.beginPath();
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    setIsDrawing(true);
  };

  const drawSignature = (event) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    ctx.stroke();
  };

  const endSignature = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = signatureRef.current;
    if (!canvas) return;
    setSignatureData(canvas.toDataURL("image/png"));
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  };

  const startTimer = () => {
    setTimerStart(Date.now() - (timerPaused ? elapsed : 0));
    setTimerRunning(true);
    setTimerPaused(false);
  };

  const pauseTimer = () => {
    if (timerRunning && timerStart) {
      setElapsed(Date.now() - timerStart);
    }
    setTimerRunning(false);
    setTimerPaused(true);
  };

  const stopTimer = async () => {
    if (!timerStart && !elapsed) return;
    const customer = findCustomer(timerCustomer);
    if (!customer) {
      setStatus("Bitte Kunde aus der Liste wählen.");
      return;
    }
    const totalElapsed = timerRunning ? Date.now() - timerStart : elapsed;
    const taskTitle = timerTitle.trim() || "Vor-Ort Einsatz";
    const created = await api.createTimeTask({
      customer_id: customer.id,
      title: taskTitle
    });
    if (created?.id) {
      await api.updateTimeTask(created.id, {
        elapsed: totalElapsed,
        running: false,
        startTime: 0
      });
      setStatus("Stoppuhr an Zeiterfassung übertragen.");
    }
    setTimerRunning(false);
    setTimerPaused(false);
    setTimerStart(null);
    setElapsed(0);
  };

  return (
    <div className="app-shell">
      <header className="header">
        <h1>QT Workbench Mobil</h1>
        <p>Unterwegs Module</p>
      </header>

      <main className="main">
        {status ? <div className="status-pill">{status}</div> : null}

        {activeTab === "quick" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Schnellerfassung</div>
              <p className="hint">Eintrag pro Zeile, optional Kunde.</p>
            </div>
            <div className="field">
              <label>Kunde (optional)</label>
              <input
                list="customer-list"
                value={quickCustomer}
                onChange={(event) => setQuickCustomer(event.target.value)}
                placeholder="Kunde auswählen"
              />
            </div>
            <div className="field">
              <label>Aufgaben</label>
              <textarea
                rows={6}
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                placeholder="z.B. Firewall prüfen\nSicherung testen"
              />
            </div>
            <button className="primary-btn" type="button" onClick={addQuickTasks}>
              Speichern
            </button>
          </div>
        )}

        {activeTab === "delivery" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Lieferschein</div>
              <p className="hint">Schneller Lieferschein als Aufgabe.</p>
            </div>
            <div className="field">
              <label>Bausteine (Tippen um einzufuegen)</label>
              <div className="chip-row">
                {deliveryTemplates.map((template) => (
                  <button
                    key={template}
                    type="button"
                    className={`chip ${deliveryTemplate === template ? "chip-active" : ""}`}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Kunde</label>
              <input
                list="customer-list"
                value={deliveryCustomer}
                onChange={(event) => setDeliveryCustomer(event.target.value)}
                placeholder="Kunde auswählen"
              />
            </div>
            <div className="field">
              <label>Titel (optional)</label>
              <input
                value={deliveryTitle}
                onChange={(event) => setDeliveryTitle(event.target.value)}
                placeholder="z.B. Hardware Lieferung"
              />
            </div>
            <div className="field">
              <label>Positionen</label>
              <textarea
                rows={5}
                value={deliveryItems}
                onChange={(event) => setDeliveryItems(event.target.value)}
                placeholder="1x Router\n2x Patchkabel"
              />
            </div>
            <div className="field">
              <label>Freitext</label>
              <textarea
                rows={3}
                value={deliveryTitle}
                onChange={(event) => setDeliveryTitle(event.target.value)}
                placeholder="Zusatzinfo (optional)"
              />
            </div>
            <div className="field">
              <label>Arbeitszeit (HH:MM)</label>
              <input
                value={deliveryWorkTime}
                onChange={(event) => setDeliveryWorkTime(event.target.value)}
                placeholder="01:30"
              />
            </div>
            <div className="field">
              <label>Unterschrift</label>
              <div className="signature-box">
                <canvas
                  ref={signatureRef}
                  width={320}
                  height={140}
                  onPointerDown={startSignature}
                  onPointerMove={drawSignature}
                  onPointerUp={endSignature}
                  onPointerLeave={endSignature}
                />
              </div>
              <div className="inline">
                <button className="secondary-btn" type="button" onClick={clearSignature}>
                  Leeren
                </button>
                <span className="hint">
                  {signatureData ? "Unterschrift erfasst" : "Noch nicht unterschrieben"}
                </span>
              </div>
            </div>
            <button className="primary-btn" type="button" onClick={addDeliveryNote}>
              Lieferschein speichern
            </button>
          </div>
        )}

        {activeTab === "timer" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Stoppuhr</div>
              <p className="hint">Einmal stoppen und in Zeiterfassung uebergeben.</p>
            </div>
            <div className="field">
              <label>Kunde</label>
              <input
                list="customer-list"
                value={timerCustomer}
                onChange={(event) => setTimerCustomer(event.target.value)}
                placeholder="Kunde auswaehlen"
              />
            </div>
            <div className="field">
              <label>Aufgabe (optional)</label>
              <input
                value={timerTitle}
                onChange={(event) => setTimerTitle(event.target.value)}
                placeholder="z.B. Vor-Ort Einsatz"
              />
            </div>
            <div className="badge">
              <Timer size={16} />
              <span className="timer">{formatElapsed(elapsed)}</span>
            </div>
            <div className="inline">
              {!timerRunning && !timerPaused ? (
                <button className="secondary-btn" type="button" onClick={startTimer}>
                  Start
                </button>
              ) : timerRunning ? (
                <>
                  <button className="secondary-btn" type="button" onClick={pauseTimer}>
                    Pause
                  </button>
                  <button className="primary-btn" type="button" onClick={stopTimer}>
                    Stop & uebertragen
                  </button>
                </>
              ) : (
                <button className="primary-btn" type="button" onClick={stopTimer}>
                  Stop & uebertragen
                </button>
              )}
              {timerPaused ? (
                <button className="secondary-btn" type="button" onClick={startTimer}>
                  Weiter
                </button>
              ) : null}
            </div>
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
