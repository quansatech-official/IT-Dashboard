import { useEffect, useState } from "react";
import CustomerCard from "./components/CustomerCard";
import Pinboard from "./components/Pinboard";

export default function App() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetch("/api/customers")
      .then(r => r.json())
      .then(setCustomers);
  }, []);

  return (
    <div style={{display:"flex"}}>
      <h1>Hello World!</h1>
      <div style={{flex:1, padding:20}}>
        {customers.map(c => <CustomerCard key={c.id} customer={c} />)}
      </div>
      <Pinboard />
    </div>
  );
}
