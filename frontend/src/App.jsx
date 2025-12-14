import { useEffect, useState } from "react";
import CustomerCard from "./components/CustomerCard";
import Pinboard from "./components/Pinboard";

export default function App() {
  const [customers, setCustomers] = useState([]);
  const API_URL = import.meta.env.VITE_API_URL;

useEffect(() => {
  fetch(`${API_URL}/customers`)
    .then(r => r.json())
    .then(setCustomers);
}, []);

  return (
    <div style={{display:"flex"}}>
      <div style={{flex:1, padding:20}}>
        {customers.map(c => <CustomerCard key={c.id} customer={c} />)}
      </div>
      <Pinboard />
    </div>
  );
}
