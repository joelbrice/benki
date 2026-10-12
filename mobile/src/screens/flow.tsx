import { useState } from "react";
import { ConfirmPayment, type PaymentIntent } from "../components/ConfirmPayment";
import type { Session } from "../session";

/** Shared "review → PIN → result" step for any screen that moves money. */
export function useIntent(session: Session, after: () => void) {
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const screen = intent ? (
    <ConfirmPayment
      api={session.api}
      intent={intent}
      onDone={() => {
        setIntent(null);
        after();
        void session.refresh();
      }}
      onCancel={() => setIntent(null)}
    />
  ) : null;
  return { setIntent, screen };
}
