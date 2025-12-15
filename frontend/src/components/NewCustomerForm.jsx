import { useState } from "react";

export default function NewCustomerForm({ onCreated }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, company }),
    });

    if (res.ok) {
      const created = await res.json();
      onCreated(created);
      setName("");
      setEmail("");
      setCompany("");
    }

    setSaving(false);
  }

  return (
    <form onSubmit={submit} style={card}>
      <h3 style={{ marginBottom: 12 }}>New Customer</h3>

      <input style={input} placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
      <input style={input} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input style={input} placeholder="Company" value={company} onChange={e => setCompany(e.target.value)} />

      <button style={button} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

const card = {
  background: "#fff",
  padding: 20,
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,.08)",
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
};

const button = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
};