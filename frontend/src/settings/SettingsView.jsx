import { useEffect, useState } from "react";
import { Mail, Settings } from "lucide-react";

const API = "/api";

export default function SettingsView() {
  const [smtp, setSmtp] = useState({
    host: "",
    port: 587,
    username: "",
    password: "",
    sender_name: "",
    sender_email: "",
    use_tls: true,
    use_ssl: false,
    has_password: false
  });
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let active = true;
    fetch(`${API}/smtp_settings`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setSmtp((prev) => ({
          ...prev,
          ...data,
          password: ""
        }));
      })
      .catch(() => {});
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
          use_tls: smtp.use_tls,
          use_ssl: smtp.use_ssl
        })
      });
      if (!res.ok) throw new Error("save_failed");
      const data = await res.json();
      setSmtp((prev) => ({
        ...prev,
        ...data,
        password: ""
      }));
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
