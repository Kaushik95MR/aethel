"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/account/actions";
import { FieldError, FormError, inputClass, primaryButton } from "@/components/form-bits";

const initial: AuthState = { ok: false };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      <FormError msg={state.error} />
      <input type="hidden" name="next" value={next} />
      <label className="block text-base">
        Email
        <input name="email" type="email" required defaultValue={state.values?.email} autoComplete="email" className={inputClass} />
        <FieldError msg={fe.email} />
      </label>
      <label className="block text-base">
        Password
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        <FieldError msg={fe.password} />
      </label>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-base text-muted-foreground">
        New here?{" "}
        <Link href={`/join?next=${encodeURIComponent(next)}`} className="text-link underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </form>
  );
}
