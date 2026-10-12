import { useEffect, useState } from "react";
import { AdminConsole } from "./admin/AdminConsole";
import { CustomerApp } from "./customer/CustomerApp";
import { I18nProvider } from "./i18n";
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
  return (
    <I18nProvider>
      {hash.startsWith("#/admin") ? <AdminConsole /> : hash.startsWith("#/ussd") ? <UssdSimulator /> : <CustomerApp />}
    </I18nProvider>
  );
}
