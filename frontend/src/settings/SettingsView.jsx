import { useEffect, useState } from "react";
import { Mail, Settings } from "lucide-react";

const API = "/api";
const STORAGE_KEY = "qt_smtp_settings_cache";

const defaultSmtp = {
  host: "",
  port: 587,
  username: "",
  password: "",
  sender_name: "",
  sender_email: "",
  beacon_base_url: "",
  use_tls: true,
  use_ssl: false,
  has_password: false
};

const loadCachedSmtp = () => {
  if (typeof window === "undefined") return defaultSmtp;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSmtp;
    const cached = JSON.parse(raw);
    return {
      ...defaultSmtp,
      ...cached,
      password: ""
    };
  } catch (error) {
    return defaultSmtp;
  }
};

export default function SettingsView() {
  const [smtp, setSmtp] = useState(loadCachedSmtp);
  const [status, setStatus] = useState("idle");
  const [loadStatus, setLoadStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    fetch(`${API}/smtp_settings`)
      .then((res) => {
        if (!res.ok) throw new Error("load_failed");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setSmtp((prev) => ({
          ...prev,
          ...data,
          password: ""
        }));
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setLoadStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setStatus("saving");
    try {
      const res = await fetch(`${API}/smtp_settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtp.host,
          port: Number(smtp.port) || 587,
          username: smtp.username,
          password: smtp.password,
          sender_name: smtp.sender_name,
          sender_email: smtp.sender_email,
          beacon_base_url: smtp.beacon_base_url,
          use_tls: smtp.use_tls,
          use_ssl: smtp.use_ssl
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      const next = {
        ...smtp,
        ...data,
        password: ""
      };
      setSmtp(next);
      try {
        const { password, ...cacheable } = next;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheable));
      } catch (error) {
        // Ignore cache write errors (private mode, etc.)
      }
      setStatus("saved");
    } catch (error) {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="border-b border-sand-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-sand-900 text-white flex items-center justify-center">
            <Settings size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">QT Workbench</p>
            <h1 className="text-2xl font-display text-sand-900">Allgemeine Einstellungen</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="rounded-3xl border border-sand-200 bg-white shadow-soft p-6">
          <div className="flex items-center gap-2 text-sand-700 mb-4">
            <Mail size={18} />
            <p className="text-xs uppercase tracking-[0.3em] text-sand-500">SMTP Versand</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-sand-500">SMTP Host</label>
              <input
                value={smtp.host}
                onChange={(event) => setSmtp((prev) => ({ ...prev, host: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Port</label>
              <input
                value={smtp.port}
                onChange={(event) => setSmtp((prev) => ({ ...prev, port: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="587"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Benutzername</label>
              <input
                value={smtp.username}
                onChange={(event) => setSmtp((prev) => ({ ...prev, username: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Passwort</label>
              <input
                type="password"
                value={smtp.password}
                onChange={(event) => setSmtp((prev) => ({ ...prev, password: event.target.value }))}
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder={smtp.has_password ? "Gespeichert" : "••••••••"}
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Absender Name</label>
              <input
                value={smtp.sender_name}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, sender_name: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="Quansatech"
              />
            </div>
            <div>
              <label className="text-xs text-sand-500">Absender E-Mail</label>
              <input
                value={smtp.sender_email}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, sender_email: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="reports@example.com"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-sand-500">Beacon Base URL</label>
              <input
                value={smtp.beacon_base_url}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, beacon_base_url: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-sand-200 px-4 py-2"
                placeholder="https://beacon.example.com"
              />
              <p className="mt-2 text-xs text-sand-400">
                Optional: externe Basis-URL oder Template mit {"{guid}"}.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-sand-700">
              <input
                type="checkbox"
                checked={smtp.use_tls}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, use_tls: event.target.checked }))
                }
              />
              TLS verwenden
            </label>
            <label className="flex items-center gap-2 text-sm text-sand-700">
              <input
                type="checkbox"
                checked={smtp.use_ssl}
                onChange={(event) =>
                  setSmtp((prev) => ({ ...prev, use_ssl: event.target.checked }))
                }
              />
              SSL verwenden
            </label>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={save}
              className="rounded-full bg-sand-900 text-white px-4 py-2 text-xs uppercase tracking-wide"
            >
              Speichern
            </button>
            {loadStatus === "error" && (
              <span className="text-sm text-rose-600">Laden fehlgeschlagen</span>
            )}
            {status === "saved" && <span className="text-sm text-emerald-600">Gespeichert</span>}
            {status === "error" && (
              <span className="text-sm text-rose-600">Speichern fehlgeschlagen</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
