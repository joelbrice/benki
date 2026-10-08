import { useState } from "react";
import type { CustomerApi } from "../api";
import { Banner, useAction } from "../ui/common";

export function SetPin({ api, onDone }: { api: CustomerApi; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, setError, run } = useAction();
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <div className="card">
      <h2>Create your transaction PIN</h2>
      <p className="muted">You'll enter this PIN to approve every payment. Avoid birthdays, repeated digits (1111) or sequences (1234).</p>
      <label htmlFor="new-pin">
        PIN (4–6 digits)
        <input id="new-pin" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(digits(e.target.value))} />
      </label>
      <label htmlFor="confirm-new-pin">
        Confirm PIN
        <input id="confirm-new-pin" type="password" inputMode="numeric" value={confirm} onChange={(e) => setConfirm(digits(e.target.value))} />
      </label>
      {error && <Banner tone="error">{error}</Banner>}
      <button
        disabled={busy || pin.length < 4}
        onClick={() => {
          if (pin !== confirm) return setError("The PINs don't match");
          run(async () => {
            await api.setPin(pin);
            onDone();
          });
        }}
      >
        Save PIN
      </button>
    </div>
  );
}
