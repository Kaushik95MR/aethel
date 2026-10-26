"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Mode =
  | { kind: "loading" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qr: string; secret: string }
  | { kind: "error"; message: string };

export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error || !data) return setMode({ kind: "error", message: "Couldn't load your sign-in settings. Refresh to retry." });

      const verified = data.totp[0];
      if (verified) return setMode({ kind: "verify", factorId: verified.id });

      // Clear abandoned, never-verified enrolments so a fresh QR code can be issued.
      for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (cancelled) return;
      if (enrollError || !enrolled) return setMode({ kind: "error", message: "Couldn't start authenticator setup. Refresh to retry." });
      setMode({ kind: "enroll", factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode.kind !== "verify" && mode.kind !== "enroll") return;
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your authenticator app.");

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mode.factorId });
    if (challengeError || !challenge) {
      setBusy(false);
      return setError("Couldn't check that code. Try again.");
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: mode.factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setBusy(false);
      setCode("");
      return setError("That code didn't match. Try the newest one.");
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <h1 className="text-lg font-medium">
          {mode.kind === "enroll" ? "Set up two-step sign in" : "Enter your code"}
        </h1>
        <p className="text-sm text-zinc-500">
          {mode.kind === "enroll"
            ? "Scan this with an authenticator app, then enter the 6-digit code."
            : "Open your authenticator app and enter the current code."}
        </p>
      </div>

      {mode.kind === "loading" && <p className="text-sm text-zinc-500">Loading…</p>}
      {mode.kind === "error" && <p role="alert" className="text-sm text-red-700">{mode.message}</p>}

      {mode.kind === "enroll" && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mode.qr} alt="QR code for your authenticator app" className="mx-auto h-44 w-44" />
          <p className="break-all text-center text-xs text-zinc-500">
            Can&apos;t scan? Enter this key: <code>{mode.secret}</code>
          </p>
        </div>
      )}

      {(mode.kind === "verify" || mode.kind === "enroll") && (
        <>
          <label className="block text-sm">
            6-digit code
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 tracking-widest"
            />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy ? "Checking…" : "Verify"}
          </button>
        </>
      )}
    </form>
  );
}
