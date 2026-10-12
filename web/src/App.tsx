import { useEffect, useState } from "react";
import { AdminConsole } from "./admin/AdminConsole";
import { CustomerApp } from "./customer/CustomerApp";
import { UssdSimulator } from "./ussd/UssdSimulator";

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  if (hash.startsWith("#/admin")) return <AdminConsole />;
  if (hash.startsWith("#/ussd")) return <UssdSimulator />;
  return <CustomerApp />;
}
