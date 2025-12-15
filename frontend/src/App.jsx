import { useEffect, useState } from "react";

/* =====================
   APP
===================== */
export default function App() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/customers")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setCustomers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  function addCustomer(c) {
    setCustomers(prev => [c, ...prev]);
  }

  if (loading) return <PageMessage>Loading customers…</PageMessage>;
  if (error) return <PageMessage error>Error: {error}</PageMessage>;

  return (
    <div style={layout}>
      <Pinboard />

      <div style={content}>
        <h1 style={{ marginBottom: 20 }}>Customers</h1>

        <NewCustomerForm onCreated={addCustomer} />

        {customers.length === 0 && (
          <EmptyState>No customers yet</EmptyState>
        )}

        {customers.map(c => (
          <CustomerCard key={c.id} customer={c} />
        ))}
      </div>
    </div>
  );
}

/* =====================
   COMPONENTS
===================== */

function NewCustomerForm({ onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });

    const data = await res.json();
    onCreated(data);
    setName("");
    setSaving(false);
  }

  return (
    <form onSubmit={submit} style={card}>
      <h3 style={{ marginBottom: 10 }}>New customer</h3>
      <input
        placeholder="Customer name"
        value={name}
        onChange={e => setName(e.target.value)}
        style={input}
      />
      <button style={button} disabled={saving}>
        {saving ? "Creating…" : "Add customer"}
      </button>
    </form>
  );
}

function CustomerCard({ customer }) {
  return (
    <div style={card}>
      <strong>{customer.name}</strong>
      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
        {customer.tasks?.length || 0} tasks
      </div>
    </div>
  );
}

function Pinboard() {
  return (
    <div style={pinboard}>
      <strong>📌 Pinboard</strong>
      <div style={{ fontSize: 13, marginTop: 8 }}>
        – Quick notes  
        <br />– Ideas  
        <br />– Todos
      </div>
    </div>
  );
}

/* =====================
   UI HELPERS
===================== */

function PageMessage({ children, error }) {
  return (
    <div style={{
      padding: 40,
      fontSize: 18,
      color: error ? "#b91c1c" : "#333"
    }}>
      {children}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div style={{
      padding: 20,
      color: "#666",
      fontStyle: "italic"
    }}>
      {children}
    </div>
  );
}

/* =====================
   STYLES
===================== */

const layout = {
  minHeight: "100vh",
  background: "#f0f2f5"
};

const content = {
  maxWidth: 800,
  margin: "0 auto",
  padding: 20
};

const card = {
  background: "#fff",
  padding: 16,
  borderRadius: 14,
  boxShadow: "0 4px 12px rgba(0,0,0,.06)",
  marginBottom: 16
};

const input = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  marginBottom: 10
};

const button = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer"
};

const pinboard = {
  position: "fixed",
  top: 20,
  right: 20,
  width: 220,
  background: "#fff",
  padding: 14,
  borderRadius: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,.15)",
  zIndex: 1000
};