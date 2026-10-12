import { useRef, useState } from "react";
import { AFRICAN_COUNTRIES, USSD_SHORT_CODE } from "@benki/shared";
import { ussdDial } from "../api";

/**
 * A feature phone in the browser. Sends the same callbacks a USSD aggregator
 * would ("text" accumulates every reply joined by "*") to the development-only
 * simulator endpoint.
 */
export function UssdSimulator() {
  const [phone, setPhone] = useState(`${AFRICAN_COUNTRIES[0].callingCode}7`);
  const [screen, setScreen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useRef({ id: "", replies: [] as string[] });

  const send = async (replies: string[]) => {
    setBusy(true);
    const raw = await ussdDial(session.current.id, phone, replies.join("*"));
    setBusy(false);
    session.current.replies = replies;
    setOpen(raw.startsWith("CON "));
    setScreen(raw.replace(/^(CON|END) /, ""));
    setInput("");
  };

  const dial = () => {
    session.current = { id: `sim-${crypto.randomUUID()}`, replies: [] };
    void send([]);
  };

  // PIN prompts are masked on screen, as on a real handset.
  const isPinPrompt = !!screen && /PIN/i.test(screen.split("\n").pop() ?? "");

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>Benki</strong>
          <span>USSD simulator</span>
        </div>
        <a className="small" href="#/">
          ← Back to the app
        </a>
      </header>
      <div className="card">
        <p className="muted">
          Benki works on any phone — no data or smartphone needed. Dial <strong>{USSD_SHORT_CODE}</strong> to register, check your balance, send
          money, buy airtime, withdraw cash or get a mini statement. This simulator is only available in development.
        </p>
        <label htmlFor="ussd-phone">
          Your phone number
          <input id="ussd-phone" inputMode="tel" value={phone} disabled={open} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} />
        </label>
      </div>
      <div className="phone" aria-label="Feature phone">
        <div className="phone-screen" role="log" aria-live="polite">
          {screen === null ? <span className="muted">Dial {USSD_SHORT_CODE}</span> : <pre>{screen}</pre>}
        </div>
        {open ? (
          <form
            className="phone-input"
            onSubmit={(e) => {
              e.preventDefault();
              if (input) void send([...session.current.replies, input]);
            }}
          >
            <input
              aria-label="Reply"
              autoFocus
              type={isPinPrompt ? "password" : "text"}
              inputMode="numeric"
              autoComplete="off"
              maxLength={24}
              value={input}
              onChange={(e) => setInput(e.target.value.replace(/[^0-9+]/g, ""))}
            />
            <div className="row">
              <button type="submit" disabled={busy || !input}>
                Send
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setOpen(false);
                  setScreen(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button disabled={busy || phone.length < 10} onClick={dial}>
            {busy ? "Dialling…" : `Call ${USSD_SHORT_CODE}`}
          </button>
        )}
      </div>
    </div>
  );
}
