import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, ClipboardList, FileSignature, List, RefreshCw } from "lucide-react";

const API = "/api";

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
};

const api = {
  customers: () => fetchJson(`${API}/customers`),
  tasks: () => fetchJson(`${API}/day_tasks`),
  stats: () => fetchJson(`${API}/company_stats?days=30`),
  deliveryNotes: (customerId) =>
    fetchJson(`${API}/delivery_notes?customer_id=${customerId}`),
  createDeliveryNote: (payload) =>
    fetchJson(`${API}/delivery_notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  createTask: (payload) =>
    fetchJson(`${API}/day_tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateTask: (id, payload) =>
    fetchJson(`${API}/day_tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
};

const tabs = [
  { id: "quick", label: "Schnell", icon: ClipboardList },
  { id: "tasks", label: "Aufgaben", icon: List },
  { id: "delivery", label: "Lieferschein", icon: FileSignature },
  { id: "stats", label: "Statistik", icon: BarChart3 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("quick");
  const [customers, setCustomers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [nowMs, setNowMs] = useState(Date.now());

  const [quickCustomer, setQuickCustomer] = useState("");
  const [quickText, setQuickText] = useState("");
  const quickTextareaRef = useRef(null);

  const [taskFilter, setTaskFilter] = useState("");

  const [deliveryCustomer, setDeliveryCustomer] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const signatureCanvasRef = useRef(null);
  const signatureWrapRef = useRef(null);
  const drawingRef = useRef(false);

  const load = async () => {
    setLoading(true);
    try {
      const [customersData, tasksData, statsData] = await Promise.all([
        api.customers(),
        api.tasks(),
        api.stats()
      ]);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setStats(statsData || null);
    } catch (error) {
      setStatus("Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (activeTab !== "quick") return;
    const timer = setTimeout(() => {
      quickTextareaRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const hasRunningTask = useMemo(() => tasks.some((task) => task.running), [tasks]);

  useEffect(() => {
    if (!hasRunningTask) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRunningTask]);

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
    const customer = quickCustomer.trim() ? findCustomer(quickCustomer) : null;
    if (quickCustomer.trim() && !customer) {
      setStatus("Bitte Kunde aus der Liste waehlen oder leer lassen.");
      return;
    }
    for (const line of lines) {
      await api.createTask({
        customer: customer?.name ?? "",
        customer_number: customer?.creditor_number ?? "",
        title: line,
        status: "todo"
      });
    }
    setQuickText("");
    setStatus("Aufgabe(n) gespeichert.");
    load();
  };

  const deliveryCustomerMatch = useMemo(() => {
    if (!deliveryCustomer.trim()) return null;
    return findCustomer(deliveryCustomer);
  }, [deliveryCustomer, customers]);

  useEffect(() => {
    if (!deliveryCustomerMatch?.id) {
      setDeliveryNotes([]);
      return;
    }
    let active = true;
    api
      .deliveryNotes(deliveryCustomerMatch.id)
      .then((data) => {
        if (!active) return;
        setDeliveryNotes(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setDeliveryNotes([]);
      });
    return () => {
      active = false;
    };
  }, [deliveryCustomerMatch?.id]);

  const visibleTasks = useMemo(() => {
    const needle = taskFilter.trim().toLowerCase();
    const base = tasks.filter((task) => task.status !== "done");
    if (!needle) return base;
    return base.filter((task) => {
      const title = String(task.title || "").toLowerCase();
      const customer = String(task.customer || "").toLowerCase();
      return title.includes(needle) || customer.includes(needle);
    });
  }, [tasks, taskFilter]);

  const formatMinutes = (ms) => {
    const total = Math.floor((ms || 0) / 60000);
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const toggleTaskTimer = async (task) => {
    if (!task) return;
    setStatus("");
    const now = Date.now();
    if (task.running && task.startTime) {
      const elapsed = (task.elapsed || 0) + Math.max(0, now - task.startTime);
      const updated = await api.updateTask(task.id, {
        running: false,
        startTime: 0,
        elapsed,
        time_enabled: true
      });
      setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
      return;
    }
    const updated = await api.updateTask(task.id, {
      running: true,
      startTime: now,
      time_enabled: true
    });
    setTasks((prev) => prev.map((item) => (item.id === task.id ? updated : item)));
  };

  const resizeSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    const wrap = signatureWrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2f2a24";
  };

  useEffect(() => {
    if (activeTab !== "delivery") return;
    resizeSignatureCanvas();
  }, [activeTab]);

  const handlePointerDown = (event) => {
    event.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
  };

  const handlePointerMove = (event) => {
    event.preventDefault();
    if (!drawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
    ctx.stroke();
  };

  const handlePointerUp = (event) => {
    event?.preventDefault?.();
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    setSignatureData(canvas.toDataURL("image/png"));
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  };

  const saveDeliveryNote = async () => {
    if (!deliveryCustomerMatch) {
      setStatus("Bitte Kunde auswaehlen.");
      return;
    }
    if (!signatureData) {
      setStatus("Bitte Unterschrift erfassen.");
      return;
    }
    await api.createDeliveryNote({
      customer_id: deliveryCustomerMatch.id,
      note: deliveryNote,
      signature_base64: signatureData
    });
    setDeliveryNote("");
    clearSignature();
    setStatus("Lieferschein gespeichert.");
    const list = await api.deliveryNotes(deliveryCustomerMatch.id);
    setDeliveryNotes(Array.isArray(list) ? list : []);
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <h1>QT Workbench Mobil</h1>
          <p>Mobil kompakt</p>
        </div>
        <button className="icon-btn" type="button" onClick={load} disabled={loading}>
          <RefreshCw size={16} />
        </button>
      </header>

      <main className="main">
        {status ? <div className="status-pill">{status}</div> : null}

        {activeTab === "quick" && (
          <div className="card stack quick-card">
            <div className="card-header">
              <div className="section-title">Schnellerfassung</div>
              <p className="hint">Eine Aufgabe pro Zeile. Fokus: schnell notieren.</p>
            </div>
            <div className="field">
              <label>Kunde (optional)</label>
              <input
                list="customer-list"
                value={quickCustomer}
                onChange={(event) => setQuickCustomer(event.target.value)}
                placeholder="Kunde auswaehlen (optional)"
              />
            </div>
            <div className="field quick-field">
              <label>Aufgaben</label>
              <textarea
                rows={8}
                value={quickText}
                onChange={(event) => setQuickText(event.target.value)}
                placeholder="z.B. Backup pruefen\nRouter Neustart"
                ref={quickTextareaRef}
              />
            </div>
            <div className="quick-actions">
              <button className="primary-btn" type="button" onClick={addQuickTasks}>
                Speichern
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setQuickText("")}
              >
                Leeren
              </button>
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Aufgaben</div>
              <p className="hint">Tippen zum Start/Stop der Zeit.</p>
            </div>
            <div className="field">
              <label>Suche</label>
              <input
                value={taskFilter}
                onChange={(event) => setTaskFilter(event.target.value)}
                placeholder="Kunde oder Aufgabe"
              />
            </div>
            <div className="list scroll-area compact-list">
              {visibleTasks.map((task) => {
                const elapsed =
                  task.running && task.startTime
                    ? (task.elapsed || 0) + Math.max(0, nowMs - task.startTime)
                    : task.elapsed || 0;
                return (
                  <div key={task.id} className="list-item compact-item">
                    <div className="list-row">
                      <div>
                        <div className="list-title">{task.title}</div>
                        <div className="list-sub">
                          {task.customer || "Ohne Kunde"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className={task.running ? "timer-btn active" : "timer-btn"}
                        onClick={() => toggleTaskTimer(task)}
                      >
                        {task.running ? "Stop" : "Start"}
                      </button>
                    </div>
                    <div className="list-meta">{formatMinutes(elapsed)}</div>
                  </div>
                );
              })}
              {!visibleTasks.length ? (
                <div className="hint">Keine offenen Aufgaben.</div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === "delivery" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Lieferschein</div>
              <p className="hint">Kunde wählen, Notiz erfassen, unterschreiben.</p>
            </div>
            <div className="field">
              <label>Kunde</label>
              <input
                list="customer-list"
                value={deliveryCustomer}
                onChange={(event) => setDeliveryCustomer(event.target.value)}
                placeholder="Kunde auswaehlen"
              />
            </div>
            <div className="field">
              <label>Notiz</label>
              <textarea
                rows={4}
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
                placeholder="Kurzbeschreibung der Leistung"
              />
            </div>
            <div className="signature-box" ref={signatureWrapRef}>
              <canvas
                ref={signatureCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </div>
            <div className="inline">
              <button className="secondary-btn" type="button" onClick={clearSignature}>
                Leeren
              </button>
              <button className="primary-btn" type="button" onClick={saveDeliveryNote}>
                Lieferschein speichern
              </button>
            </div>
            {deliveryCustomerMatch ? (
              <div className="list scroll-area">
                <div className="section-title">Letzte Lieferscheine</div>
                {deliveryNotes.slice(0, 4).map((note) => (
                  <div key={note.id} className="list-item">
                    <div className="list-title">Lieferschein</div>
                    <div className="list-sub">
                      {note.created_at
                        ? new Date(note.created_at).toLocaleDateString("de-DE")
                        : ""}
                    </div>
                  </div>
                ))}
                {!deliveryNotes.length ? (
                  <div className="hint">Keine Lieferscheine vorhanden.</div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "stats" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Statistik</div>
              <p className="hint">Kompakt fuer unterwegs.</p>
            </div>
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="stat-label">Offen</div>
                <div className="stat-value">{stats?.dayTasks?.open ?? 0}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Erledigt heute</div>
                <div className="stat-value">{stats?.dayTasks?.doneToday ?? 0}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Zeit Woche</div>
                <div className="stat-value">
                  {Number(stats?.timeTracking?.doneWeekHours ?? 0).toFixed(1)} h
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Umsatz Woche</div>
                <div className="stat-value">
                  € {Number(stats?.revenueEstimateWeekEur ?? 0).toFixed(0)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Entwurf</div>
                <div className="stat-value">{stats?.sevdesk?.drafts?.count ?? 0}</div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Faellig</div>
                <div className="stat-value">
                  € {Number(stats?.sevdesk?.due?.sumEur ?? 0).toFixed(0)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Verpasst</div>
                <div className="stat-value">{stats?.telephony?.missed ?? 0}</div>
              </div>
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
