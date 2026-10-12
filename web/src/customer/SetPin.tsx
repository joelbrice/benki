import { useState } from "react";
import type { CustomerApi } from "../api";
import { useI18n } from "../i18n";
import { Banner, PinField, useAction } from "../ui/common";

export function SetPin({ api, onDone }: { api: CustomerApi; onDone: () => void }) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, setError, run } = useAction();

  return (
    <>
      <h2>{t("setPin.title")}</h2>
      <p className="muted">{t("setPin.body")}</p>
      <PinField id="new-pin" label={t("setPin.pin")} value={pin} onChange={setPin} />
      <PinField id="confirm-new-pin" label={t("setPin.confirm")} value={confirm} onChange={setConfirm} />
      {error && <Banner tone="error">{error}</Banner>}
      <button
        className="block"
        disabled={busy || pin.length < 4}
        onClick={() => {
          if (pin !== confirm) return setError(t("setPin.mismatch"));
          void run(async () => {
            await api.setPin(pin);
            onDone();
          });
        }}
      >
        {t("setPin.save")}
      </button>
    </>
  );
}
