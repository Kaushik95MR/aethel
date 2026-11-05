"use client";

import { useState, useTransition } from "react";
import { startPayment } from "./actions";

type CashfreeSdk = { checkout: (o: { paymentSessionId: string; redirectTarget: "_self" }) => Promise<unknown> };
declare global {
  interface Window {
    Cashfree?: (o: { mode: "sandbox" | "production" }) => CashfreeSdk;
  }
}

function loadSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("sdk"));
    document.head.appendChild(s);
  });
}

/** Opens Cashfree's hosted checkout. The phone field appears only when we don't already have a number. */
export function PayButton({ token, amount, needsPhone }: { token: string; amount: string; needsPhone: boolean }) {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function pay() {
    setError(null);
    start(async () => {
      const res = await startPayment({ token, phone: phone || undefined });
      if (!res.ok) return setError(res.error);
      if ("paid" in res) return window.location.reload();
      try {
        await loadSdk();
        await window.Cashfree!({ mode: res.mode }).checkout({ paymentSessionId: res.sessionId, redirectTarget: "_self" });
      } catch {
        setError("The payment window couldn't open. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="mt-6 space-y-3">
      {needsPhone && (
        <label className="block text-sm">
          <span className="text-muted-foreground">Mobile number for the payment receipt</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2"
          />
        </label>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="w-full rounded-full bg-brand px-5 py-3 text-brand-ink hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Opening payment…" : `Pay ${amount}`}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Secure payment by Cashfree. UPI, cards and net banking accepted.</p>
    </div>
  );
}
