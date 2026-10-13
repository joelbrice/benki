import { useRef, useState } from "react";
import { AFRICAN_COUNTRIES, USSD_SHORT_CODE } from "@benki/shared";
import { ussdDial } from "../api";
import { useI18n } from "../i18n";
import { LanguageSelect } from "../ui/LanguageSelect";

/**
 * A feature phone in the browser. Sends the same callbacks a USSD aggregator
 * would ("text" accumulates every reply joined by "*") to the development-only
 * simulator endpoint.
 */
export function UssdSimulator() {
  const { t } = useI18n();
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
  const isPinPrompt = !!screen && /PIN|الرقم السري/i.test(screen.split("\n").pop() ?? "");

  return (
    <div className="auth-shell">
      <div className="auth-card wide">
        <div className="auth-top">
          <a className="link-back" href="#/">
            <span className="back-arrow" aria-hidden="true">←</span> {t("ussdSim.backToApp")}
          </a>
          <LanguageSelect compact />
        </div>
        <h1>{t("ussdSim.title")}</h1>
        <p className="muted">{t("ussdSim.intro", { code: USSD_SHORT_CODE })}</p>
        <label htmlFor="ussd-phone">
          {t("ussdSim.phone")}
          <input id="ussd-phone" inputMode="tel" value={phone} disabled={open} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} />
        </label>
        <div className="phone" aria-label="Feature phone">
          <div className="phone-screen" role="log" aria-live="polite">
            {screen === null ? <span className="muted">{t("ussdSim.dial", { code: USSD_SHORT_CODE })}</span> : <pre dir="auto">{screen}</pre>}
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
                aria-label={t("ussdSim.reply")}
                autoFocus
                type={isPinPrompt ? "password" : "text"}
                inputMode="numeric"
                autoComplete="off"
                maxLength={24}
                value={input}
                onChange={(e) => setInput(e.target.value.replace(/[^0-9+]/g, ""))}
              />
              <div className="button-pair">
                <button type="submit" disabled={busy || !input}>
                  {t("ussdSim.send")}
                </button>
                <button
                  type="button"
                  className="ghost on-dark"
                  onClick={() => {
                    setOpen(false);
                    setScreen(null);
                  }}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : (
            <button disabled={busy || phone.length < 10} onClick={dial}>
              {busy ? t("ussdSim.dialling") : t("ussdSim.call", { code: USSD_SHORT_CODE })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
