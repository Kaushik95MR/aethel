"use client";

import { useActionState } from "react";
import Link from "next/link";
import { btn, btnPrimary, field, Flash } from "@/components/ui";
import { createHostAccount, resetHostPassword, type LoginState } from "./actions";

const initial: LoginState = { ok: false };

/** Shown once, right after a login is made or reset. The password is not stored anywhere the admin can read it again. */
function Credentials({ state, host }: { state: LoginState; host?: { name: string; id: string } }) {
  const webUrl = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div role="status" className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
      <p className="font-medium">Login ready. Send these to the host now, by message or in person.</p>
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
        <dt className="text-green-700">Address</dt>
        <dd className="break-all font-mono">{webUrl}/login</dd>
        <dt className="text-green-700">Email</dt>
        <dd className="break-all font-mono">{state.email}</dd>
        <dt className="text-green-700">Temporary password</dt>
        <dd className="break-all font-mono">{state.password}</dd>
      </dl>
      <p>
        This password is shown only once. The host replaces it when they first sign in, then sets up an authenticator app for two-step sign-in.
      </p>
      {state.hostId && (!host || host.id !== state.hostId) && (
        <Link href={`/hosts/${state.hostId}`} className={btn}>
          Open the host&apos;s profile
        </Link>
      )}
    </div>
  );
}

/** Add a host: a name and an email make the profile and the login together. */
export function AddHostForm() {
  const [state, action, pending] = useActionState(createHostAccount, initial);
  return (
    <div className="max-w-xl space-y-4">
      {state.ok ? (
        <Credentials state={state} />
      ) : (
        <form action={action} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
          {state.error && <Flash tone="error">{state.error}</Flash>}
          <label className="block space-y-1.5 text-sm font-medium text-zinc-900">
            Host&apos;s name
            <input name="name" required minLength={2} maxLength={80} className={`${field} font-normal`} />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-zinc-900">
            Email address
            <input name="email" type="email" required maxLength={200} autoComplete="off" className={`${field} font-normal`} />
            <span className="block text-sm font-normal text-zinc-500">This is the host&apos;s login name.</span>
          </label>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Creating…" : "Create host login"}
          </button>
        </form>
      )}
    </div>
  );
}

/** For a host who has a profile but no login yet. */
export function CreateLoginForm({ host }: { host: { id: string; name: string } }) {
  const [state, action, pending] = useActionState(createHostAccount, initial);
  if (state.ok) return <Credentials state={state} host={host} />;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="host_id" value={host.id} />
      <input type="hidden" name="name" value={host.name} />
      {state.error && (
        <div className="w-full">
          <Flash tone="error">{state.error}</Flash>
        </div>
      )}
      <label className="space-y-1 text-sm text-zinc-500">
        Host&apos;s email address
        <input name="email" type="email" required maxLength={200} autoComplete="off" className={`${field} w-72`} />
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Creating…" : "Create login"}
      </button>
    </form>
  );
}

/** A new temporary password for a host who is locked out. */
export function ResetPasswordForm({ hostId }: { hostId: string }) {
  const [state, action, pending] = useActionState(resetHostPassword, initial);
  if (state.ok) return <Credentials state={state} host={{ id: hostId, name: "" }} />;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="host_id" value={hostId} />
      {state.error && <Flash tone="error">{state.error}</Flash>}
      <button type="submit" disabled={pending} className={btn}>
        {pending ? "Resetting…" : "Give a new temporary password"}
      </button>
    </form>
  );
}
