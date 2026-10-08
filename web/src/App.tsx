import { useEffect, useState } from "react";
import { AdminConsole } from "./admin/AdminConsole";
import { CustomerApp } from "./customer/CustomerApp";

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
  return hash.startsWith("#/admin") ? <AdminConsole /> : <CustomerApp />;
}
