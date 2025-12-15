import { useEffect, useState } from "react";
import CustomerCard from "./components/CustomerCard";
import Pinboard from "./components/Pinboard";

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
        console.error("Failed to fetch customers:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading customers...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>Error: {error}</div>;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f0f2f5" }}>
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        <h1>Customers</h1>
        {customers.length === 0
          ? <div>No customers found.</div>
          : customers.map(c => <CustomerCard key={c.id} customer={c} />)}
      </div>
      <div style={{ width: 400, padding: 20, borderLeft: "1px solid #ccc" }}>
        <h2>Pinboard</h2>
        <Pinboard />
      </div>
    </div>
  );
}