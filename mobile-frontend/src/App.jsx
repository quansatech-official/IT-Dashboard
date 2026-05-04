import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  Download,
  Eraser,
  FileSignature,
  List,
  Paintbrush,
  PenLine,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Trash2
} from "lucide-react";

const API = "/api";
const ACTIVE_TAB_STORAGE_KEY = "qt_mobile_active_tab";
const VALID_TABS = new Set(["quick", "tasks", "delivery", "whiteboard", "stats"]);
const WHITEBOARD_WIDTH = 2200;
const WHITEBOARD_HEIGHT = 1400;
const WHITEBOARD_COLORS = ["#111827", "#475569", "#0f766e", "#16a34a", "#1d4ed8", "#0284c7", "#b45309", "#dc2626", "#be123c", "#7c3aed"];
const WHITEBOARD_STROKE_WIDTHS = [2, 4, 6, 10, 14, 20];
const WHITEBOARD_ERASER_WIDTHS = [24, 40, 64];
const WHITEBOARD_MIN_POINT_DISTANCE = 3;
const WHITEBOARD_TOOLS = {
  PEN: "pen",
  ERASER: "eraser"
};

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
    }),
  getWhiteboard: () => fetchJson(`${API}/vision_board/documents/whiteboard`),
  saveWhiteboard: (content) =>
    fetchJson(`${API}/vision_board/documents/whiteboard`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    })
};

const tabs = [
  { id: "quick", label: "Schnell", icon: ClipboardList },
  { id: "tasks", label: "Aufgaben", icon: List },
  { id: "delivery", label: "Lieferschein", icon: FileSignature },
  { id: "whiteboard", label: "Board", icon: Paintbrush },
  { id: "stats", label: "Statistik", icon: BarChart3 }
];

const formatNumber = (value, options = {}) =>
  Number(value || 0).toLocaleString("de-DE", options);
const formatEur = (value, options = {}) =>
  `€ ${Number(value || 0).toLocaleString("de-DE", options)}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
};
const createEmptyWhiteboardDocument = () => ({ strokes: [] });
const normalizeWhiteboardColor = (color) => {
  const value = String(color || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : WHITEBOARD_COLORS[0];
};
const normalizeWhiteboardDocument = (content) => {
  const source = content && typeof content === "object" ? content : {};
  const strokes = Array.isArray(source.strokes)
    ? source.strokes
        .map((stroke) => ({
          id: String(stroke?.id || uid()),
          color: normalizeWhiteboardColor(stroke?.color),
          width: clamp(Number(stroke?.width || 4), 1, 64),
          points: Array.isArray(stroke?.points)
            ? stroke.points
                .map((point) => ({
                  x: Number(point?.x || 0),
                  y: Number(point?.y || 0)
                }))
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
            : []
        }))
        .filter((stroke) => stroke.points.length > 1)
    : [];
  return { strokes };
};
const getLastPoint = (points = []) => points[points.length - 1] || null;
const shouldAppendWhiteboardPoint = (points = [], point) => {
  const lastPoint = getLastPoint(points);
  if (!lastPoint) return true;
  return Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= WHITEBOARD_MIN_POINT_DISTANCE;
};
const distanceToSegment = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
};
const strokeIntersectsCircle = (stroke, center, radius) => {
  const points = stroke?.points || [];
  if (!points.length) return false;
  if (points.some((point) => Math.hypot(point.x - center.x, point.y - center.y) <= radius)) return true;
  return points.some((point, index) => index > 0 && distanceToSegment(center, points[index - 1], point) <= radius + Number(stroke.width || 1) / 2);
};
const pathFromPoints = (points = []) => {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev = points[index - 1];
    const controlX = (prev.x + point.x) / 2;
    const controlY = (prev.y + point.y) / 2;
    return `${acc} Q ${prev.x} ${prev.y} ${controlX} ${controlY}`;
  }, "");
};

const detectDeviceClass = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "desktop";
  const ua = String(navigator.userAgent || "").toLowerCase();
  const width = Number(window.innerWidth || window.screen?.width || 0);
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  const isIpadOs = ua.includes("macintosh") && maxTouchPoints > 1;
  const isTabletUa = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(ua);
  const isMobileUa = /(iphone|ipod|android.*mobile|windows phone|blackberry|bb10|mobile)/i.test(ua);
  if (isTabletUa || isIpadOs || (maxTouchPoints > 1 && width >= 768 && width <= 1366)) {
    return "tablet";
  }
  if (isMobileUa || (width > 0 && width < 768)) {
    return "mobile";
  }
  return "desktop";
};

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "quick";
    const stored = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return VALID_TABS.has(stored) ? stored : "quick";
  });
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
  const [deliveryTimeFrom, setDeliveryTimeFrom] = useState("");
  const [deliveryTimeTo, setDeliveryTimeTo] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const signatureCanvasRef = useRef(null);
  const signatureWrapRef = useRef(null);
  const drawingRef = useRef(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

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
    if (typeof window === "undefined") return;
    if (!VALID_TABS.has(activeTab)) return;
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("client") === "mobile") return;
    const deviceClass = detectDeviceClass();
    document.documentElement.dataset.deviceClass = deviceClass;
    if (deviceClass === "desktop") {
      if (window.location.pathname.startsWith("/mobil")) {
        window.location.replace("/");
      }
    }
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
    const pad = canvas.parentElement || wrap;
    const rect = pad.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2f2a24";
  };

  useEffect(() => {
    if (activeTab !== "delivery") return;
    resizeSignatureCanvas();
  }, [activeTab]);

  useEffect(() => {
    if (!signatureModalOpen) return;
    const frame = window.requestAnimationFrame(() => {
      resizeSignatureCanvas();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [signatureModalOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (signatureModalOpen) {
      document.body.classList.add("modal-open");
      return () => document.body.classList.remove("modal-open");
    }
    document.body.classList.remove("modal-open");
  }, [signatureModalOpen]);

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
      signature_base64: signatureData,
      time_from: deliveryTimeFrom,
      time_to: deliveryTimeTo
    });
    setDeliveryNote("");
    setDeliveryTimeFrom("");
    setDeliveryTimeTo("");
    clearSignature();
    setStatus("Lieferschein gespeichert.");
    const list = await api.deliveryNotes(deliveryCustomerMatch.id);
    setDeliveryNotes(Array.isArray(list) ? list : []);
  };

  const handleSignatureAccept = () => {
    if (!signatureData) {
      setStatus("Bitte Unterschrift erfassen.");
      return;
    }
    setSignatureModalOpen(false);
  };

  const clearDeliveryForm = () => {
    setDeliveryCustomer("");
    setDeliveryNote("");
    setDeliveryTimeFrom("");
    setDeliveryTimeTo("");
    clearSignature();
    setSignatureModalOpen(false);
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
          <>
            <QuickCaptureSection
              quickCustomer={quickCustomer}
              quickTextareaRef={quickTextareaRef}
              quickText={quickText}
              setQuickCustomer={setQuickCustomer}
              setQuickText={setQuickText}
            />
            <div className="quick-actions-fixed fixed-action-bar">
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
          </>
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
          <>
            <DeliverySection
              deliveryCustomer={deliveryCustomer}
              setDeliveryCustomer={setDeliveryCustomer}
              deliveryTimeFrom={deliveryTimeFrom}
              setDeliveryTimeFrom={setDeliveryTimeFrom}
              deliveryTimeTo={deliveryTimeTo}
              setDeliveryTimeTo={setDeliveryTimeTo}
              deliveryNote={deliveryNote}
              setDeliveryNote={setDeliveryNote}
              deliveryCustomerMatch={deliveryCustomerMatch}
              deliveryNotes={deliveryNotes}
              signatureData={signatureData}
              onSignatureTrigger={() => setSignatureModalOpen(true)}
            />
            <div className="delivery-actions-fixed fixed-action-bar">
              <button className="primary-btn" type="button" onClick={saveDeliveryNote}>
                Speichern
              </button>
              <button className="secondary-btn" type="button" onClick={clearDeliveryForm}>
                Leeren
              </button>
            </div>
          </>
        )}

        {activeTab === "whiteboard" && <WhiteboardSection setStatus={setStatus} />}

        {activeTab === "stats" && (
          <div className="card stack">
            <div className="card-header">
              <div className="section-title">Statistik</div>
              <p className="hint">Ueberblick der wichtigsten Kennzahlen.</p>
            </div>
            <div className="stat-grid">
              <div className="stat-tile">
                <div className="stat-label">Offen</div>
                <div className="stat-value">
                  {formatNumber(stats?.dayTasks?.open ?? 0)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Erledigt heute</div>
                <div className="stat-value">
                  {formatNumber(stats?.dayTasks?.doneToday ?? 0)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Erledigt Woche</div>
                <div className="stat-value">
                  {formatNumber(stats?.dayTasks?.doneWeek ?? 0)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Zeit heute</div>
                <div className="stat-value">
                  {formatNumber(stats?.timeTracking?.doneTodayHours ?? 0, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1
                  })}{" "}
                  h
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Zeit Woche</div>
                <div className="stat-value">
                  {formatNumber(stats?.timeTracking?.doneWeekHours ?? 0, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1
                  })}{" "}
                  h
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Umsatz heute</div>
                <div className="stat-value">
                  {formatEur(stats?.revenueEstimateTodayEur ?? 0, {
                    maximumFractionDigits: 0
                  })}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Umsatz Woche</div>
                <div className="stat-value">
                  {formatEur(stats?.revenueEstimateWeekEur ?? 0, {
                    maximumFractionDigits: 0
                  })}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Entwurf</div>
                <div className="stat-value">
                  {formatNumber(stats?.sevdesk?.drafts?.count ?? 0)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Faellig</div>
                <div className="stat-value">
                  {formatNumber(stats?.sevdesk?.due?.count ?? 0)}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-label">Verpasst</div>
                <div className="stat-value">
                  {formatNumber(stats?.telephony?.missed ?? 0)}
                </div>
              </div>
            </div>
          </div>
        )}
        <SignatureModal
          open={signatureModalOpen}
          canvasRef={signatureCanvasRef}
          wrapRef={signatureWrapRef}
          onClose={() => setSignatureModalOpen(false)}
          onClear={clearSignature}
          onAccept={handleSignatureAccept}
          pointerHandlers={{
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            onPointerLeave: handlePointerUp,
            onPointerCancel: handlePointerUp
          }}
        />
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

function QuickCaptureSection({
  quickCustomer,
  setQuickCustomer,
  quickText,
  setQuickText,
  quickTextareaRef
}) {
  return (
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
    </div>
  );
}

function DeliverySection({
  deliveryCustomer,
  setDeliveryCustomer,
  deliveryTimeFrom,
  setDeliveryTimeFrom,
  deliveryTimeTo,
  setDeliveryTimeTo,
  deliveryNote,
  setDeliveryNote,
  deliveryCustomerMatch,
  deliveryNotes,
  signatureData,
  onSignatureTrigger
}) {
  return (
    <div className="card stack delivery-compact">
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
      <div className="field-row">
        <div className="field">
          <label>Arbeitszeit von</label>
          <input
            type="time"
            value={deliveryTimeFrom}
            onChange={(event) => setDeliveryTimeFrom(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Arbeitszeit bis</label>
          <input
            type="time"
            value={deliveryTimeTo}
            onChange={(event) => setDeliveryTimeTo(event.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label>Notiz</label>
        <textarea
          rows={3}
          value={deliveryNote}
          onChange={(event) => setDeliveryNote(event.target.value)}
          placeholder="Kurzbeschreibung der Leistung"
        />
      </div>
      <div className="field signature-field">
        <label>Unterschrift</label>
        <div className="signature-status">
          <span className="signature-status__text">
            {signatureData ? "Unterschrift erfasst" : "Keine Unterschrift"}
          </span>
          <button className="signature-trigger" type="button" onClick={onSignatureTrigger}>
            {signatureData ? "Unterschrift ändern" : "Unterschreiben"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SignatureModal({
  open,
  canvasRef,
  wrapRef,
  onClose,
  onClear,
  onAccept,
  pointerHandlers
}) {
  if (!open) return null;
  return (
    <div className="signature-modal">
      <div className="signature-modal__content">
        <div className="signature-modal__header">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">Unterschrift</p>
            <h3 className="text-lg font-display text-sand-900">Unterschrift erfassen</h3>
          </div>
          <button type="button" className="signature-modal__close" onClick={onClose}>
            Abbrechen
          </button>
        </div>
        <div className="signature-box signature-modal__box" ref={wrapRef}>
          <div className="signature-modal__pad">
            <canvas
              ref={canvasRef}
              onPointerDown={pointerHandlers.onPointerDown}
              onPointerMove={pointerHandlers.onPointerMove}
              onPointerUp={pointerHandlers.onPointerUp}
              onPointerLeave={pointerHandlers.onPointerLeave}
              onPointerCancel={pointerHandlers.onPointerCancel}
            />
          </div>
        </div>
        <div className="signature-modal__actions fixed-action-bar">
          <button className="secondary-btn" type="button" onClick={onClear}>
            Wiederholen
          </button>
          <button className="primary-btn" type="button" onClick={onAccept}>
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

function WhiteboardSection({ setStatus }) {
  const boardRef = useRef(null);
  const documentStateRef = useRef(createEmptyWhiteboardDocument());
  const currentStrokeRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const eraseChangedRef = useRef(false);
  const [documentState, setDocumentState] = useState(createEmptyWhiteboardDocument());
  const [currentStroke, setCurrentStroke] = useState(null);
  const [activeTool, setActiveTool] = useState(WHITEBOARD_TOOLS.PEN);
  const [toolColor, setToolColor] = useState(WHITEBOARD_COLORS[0]);
  const [toolWidth, setToolWidth] = useState(WHITEBOARD_STROKE_WIDTHS[1]);
  const [eraserWidth, setEraserWidth] = useState(WHITEBOARD_ERASER_WIDTHS[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    documentStateRef.current = documentState;
  }, [documentState]);

  const touchHistory = () => setHistoryVersion((value) => value + 1);

  const loadWhiteboard = async () => {
    setSaveState("loading");
    try {
      const data = await api.getWhiteboard();
      const normalized = normalizeWhiteboardDocument(data?.content);
      undoStackRef.current = [];
      redoStackRef.current = [];
      documentStateRef.current = normalized;
      setDocumentState(normalized);
      setSaveState("saved");
      setStatus("");
      touchHistory();
    } catch (error) {
      setSaveState("error");
      setStatus("Whiteboard konnte nicht geladen werden.");
    }
  };

  useEffect(() => {
    loadWhiteboard();
  }, []);

  const persistWhiteboard = async (nextDocument) => {
    setSaveState("saving");
    try {
      await api.saveWhiteboard(normalizeWhiteboardDocument(nextDocument));
      setSaveState("saved");
      setStatus("");
    } catch (error) {
      setSaveState("error");
      setStatus("Whiteboard konnte nicht gespeichert werden.");
    }
  };

  const commitDocument = async (nextDocument, { addHistory = true } = {}) => {
    const normalized = normalizeWhiteboardDocument(nextDocument);
    if (addHistory) {
      undoStackRef.current = undoStackRef.current.concat(documentStateRef.current).slice(-40);
      redoStackRef.current = [];
      touchHistory();
    }
    documentStateRef.current = normalized;
    setDocumentState(normalized);
    await persistWhiteboard(normalized);
  };

  const getPointFromEvent = (event) => {
    const rect = boardRef.current?.getBoundingClientRect?.();
    if (!rect) return { x: 0, y: 0 };
    const scale = Math.min(rect.width / WHITEBOARD_WIDTH, rect.height / WHITEBOARD_HEIGHT);
    const renderedWidth = WHITEBOARD_WIDTH * scale;
    const renderedHeight = WHITEBOARD_HEIGHT * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    return {
      x: clamp((event.clientX - rect.left - offsetX) / scale, 0, WHITEBOARD_WIDTH),
      y: clamp((event.clientY - rect.top - offsetY) / scale, 0, WHITEBOARD_HEIGHT)
    };
  };

  const eraseAtPoint = (point) => {
    const nextStrokes = documentStateRef.current.strokes.filter((stroke) => !strokeIntersectsCircle(stroke, point, eraserWidth / 2));
    if (nextStrokes.length === documentStateRef.current.strokes.length) return;
    eraseChangedRef.current = true;
    const nextDocument = { strokes: nextStrokes };
    documentStateRef.current = nextDocument;
    setDocumentState(nextDocument);
  };

  const startStroke = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const point = getPointFromEvent(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDrawing(true);
    if (activeTool === WHITEBOARD_TOOLS.ERASER) {
      undoStackRef.current = undoStackRef.current.concat(documentStateRef.current).slice(-40);
      redoStackRef.current = [];
      eraseChangedRef.current = false;
      touchHistory();
      eraseAtPoint(point);
      return;
    }
    const stroke = {
      id: uid(),
      color: toolColor,
      width: toolWidth,
      points: [point]
    };
    currentStrokeRef.current = stroke;
    setCurrentStroke(stroke);
  };

  const moveStroke = (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const point = getPointFromEvent(event);
    if (activeTool === WHITEBOARD_TOOLS.ERASER) {
      eraseAtPoint(point);
      return;
    }
    if (!currentStrokeRef.current || !shouldAppendWhiteboardPoint(currentStrokeRef.current.points, point)) return;
    const nextStroke = {
      ...currentStrokeRef.current,
      points: currentStrokeRef.current.points.concat(point)
    };
    currentStrokeRef.current = nextStroke;
    setCurrentStroke(nextStroke);
  };

  const endStroke = async (event) => {
    event?.preventDefault?.();
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    setIsDrawing(false);
    if (activeTool === WHITEBOARD_TOOLS.ERASER) {
      if (eraseChangedRef.current) {
        eraseChangedRef.current = false;
        await persistWhiteboard(documentStateRef.current);
      } else {
        undoStackRef.current.pop();
        touchHistory();
      }
      return;
    }
    if (!currentStrokeRef.current) return;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setCurrentStroke(null);
    await commitDocument({ strokes: documentStateRef.current.strokes.concat(finished) });
  };

  const undoWhiteboard = async () => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current = redoStackRef.current.concat(documentStateRef.current).slice(-40);
    documentStateRef.current = previous;
    setDocumentState(previous);
    touchHistory();
    await persistWhiteboard(previous);
  };

  const redoWhiteboard = async () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current = undoStackRef.current.concat(documentStateRef.current).slice(-40);
    documentStateRef.current = next;
    setDocumentState(next);
    touchHistory();
    await persistWhiteboard(next);
  };

  const clearWhiteboard = async () => {
    if (!window.confirm("Whiteboard leeren?")) return;
    setCurrentStroke(null);
    currentStrokeRef.current = null;
    await commitDocument(createEmptyWhiteboardDocument());
  };

  const exportWhiteboardPng = () => {
    const svg = boardRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("width", String(WHITEBOARD_WIDTH));
    clone.setAttribute("height", String(WHITEBOARD_HEIGHT));
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = WHITEBOARD_WIDTH;
      canvas.height = WHITEBOARD_HEIGHT;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    };
    image.src = url;
  };

  const activeWidth = activeTool === WHITEBOARD_TOOLS.ERASER ? eraserWidth : toolWidth;

  return (
    <div className="whiteboard-view">
      <div className="whiteboard-toolbar">
        <div className="tool-segment">
          <button
            type="button"
            className={activeTool === WHITEBOARD_TOOLS.PEN ? "active" : ""}
            onClick={() => setActiveTool(WHITEBOARD_TOOLS.PEN)}
            aria-label="Stift"
            title="Stift"
          >
            <PenLine size={16} />
          </button>
          <button
            type="button"
            className={activeTool === WHITEBOARD_TOOLS.ERASER ? "active" : ""}
            onClick={() => setActiveTool(WHITEBOARD_TOOLS.ERASER)}
            aria-label="Radiergummi"
            title="Radiergummi"
          >
            <Eraser size={16} />
          </button>
        </div>
        <div className="color-strip">
          {WHITEBOARD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={toolColor === color && activeTool === WHITEBOARD_TOOLS.PEN ? "active" : ""}
              style={{ backgroundColor: color }}
              onClick={() => {
                setToolColor(color);
                setActiveTool(WHITEBOARD_TOOLS.PEN);
              }}
              aria-label="Farbe wählen"
              title="Farbe wählen"
            />
          ))}
        </div>
        <div className="width-strip">
          {(activeTool === WHITEBOARD_TOOLS.ERASER ? WHITEBOARD_ERASER_WIDTHS : WHITEBOARD_STROKE_WIDTHS).map((width) => (
            <button
              key={width}
              type="button"
              className={activeWidth === width ? "active" : ""}
              onClick={() => (activeTool === WHITEBOARD_TOOLS.ERASER ? setEraserWidth(width) : setToolWidth(width))}
            >
              {width}
            </button>
          ))}
        </div>
        <div className="whiteboard-actions">
          <button type="button" onClick={undoWhiteboard} disabled={!undoStackRef.current.length || saveState === "saving"} aria-label="Rückgängig" title="Rückgängig">
            <RotateCcw size={16} />
          </button>
          <button type="button" onClick={redoWhiteboard} disabled={!redoStackRef.current.length || saveState === "saving"} aria-label="Wiederholen" title="Wiederholen">
            <RotateCw size={16} />
          </button>
          <button type="button" onClick={loadWhiteboard} disabled={saveState === "loading"} aria-label="Neu laden" title="Neu laden">
            <RefreshCw size={16} />
          </button>
          <button type="button" onClick={exportWhiteboardPng} aria-label="PNG exportieren" title="PNG exportieren">
            <Download size={16} />
          </button>
          <button type="button" onClick={clearWhiteboard} aria-label="Leeren" title="Leeren">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="whiteboard-meta" aria-live="polite">
        <span>{saveState === "saving" ? "Speichert..." : saveState === "loading" ? "Laedt..." : `${documentState.strokes.length} Striche`}</span>
        {historyVersion ? <span>{undoStackRef.current.length} zurück / {redoStackRef.current.length} vor</span> : null}
      </div>

      <div className="whiteboard-canvas-shell">
        <svg
          ref={boardRef}
          viewBox={`0 0 ${WHITEBOARD_WIDTH} ${WHITEBOARD_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          className="whiteboard-canvas"
          onPointerDown={startStroke}
          onPointerMove={moveStroke}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
        >
          <defs>
            <filter id="mobile-whiteboard-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="rgba(15,23,42,0.18)" />
            </filter>
          </defs>
          {documentState.strokes.map((stroke) => (
            <path
              key={stroke.id}
              d={pathFromPoints(stroke.points)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#mobile-whiteboard-shadow)"
            />
          ))}
          {currentStroke?.points?.length ? (
            <path
              d={pathFromPoints(currentStroke.points)}
              fill="none"
              stroke={currentStroke.color}
              strokeWidth={currentStroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </svg>
      </div>
    </div>
  );
}
