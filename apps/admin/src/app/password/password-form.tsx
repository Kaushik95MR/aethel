"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, field, Flash } from "@/components/ui";
import { createClient } from "@/lib/supabase/browser";

/** First sign-in: replace the password the admin gave you with one only you know. */
export function PasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const pw = String(form.get("password") ?? "");
    const again = String(form.get("again") ?? "");
    if (pw.length < 12) return setError("Use at least 12 characters.");
    if (pw !== again) return setError("The two passwords don't match.");

    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password: pw, data: { must_change_password: false } });
    if (error) {
      setBusy(false);
      return setError(error.message.includes("different") ? "Choose a password you haven't used before." : "Couldn't save the password. Try again.");
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Choose your password</h1>
        <p className="text-sm text-zinc-500">The password you were given was temporary. Pick one only you know. Next, you will set up two-step sign-in.</p>
      </div>
      {error && <Flash tone="error">{error}</Flash>}
      <label className="block space-y-1.5 text-sm font-medium">
        New password
        <input name="password" type="password" autoComplete="new-password" required minLength={12} className={`${field} font-normal`} />
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        Type it again
        <input name="again" type="password" autoComplete="new-password" required minLength={12} className={`${field} font-normal`} />
      </label>
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {busy ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
