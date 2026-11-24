"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthState } from "@/app/account/actions";
import { FieldError, FormError, inputClass, primaryButton } from "@/components/form-bits";

const initial: AuthState = { ok: false };

export function JoinForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, initial);
  const fe = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div role="status" className="rounded-3xl border border-border bg-card p-6">
        <h2 className="font-display text-3xl">You&apos;re almost in.</h2>
        <p className="mt-3 text-lg text-muted-foreground">{state.notice ?? "Thanks for joining."}</p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      <FormError msg={state.error} />
      <input type="hidden" name="next" value={next} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="block text-base">
        Your name
        <input name="name" required defaultValue={state.values?.name} autoComplete="name" className={inputClass} />
        <FieldError msg={fe.name} />
      </label>

      <label className="block text-base">
        Email
        <input name="email" type="email" required defaultValue={state.values?.email} autoComplete="email" className={inputClass} />
        <FieldError msg={fe.email} />
      </label>

      <label className="block text-base">
        Password
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        <span className="mt-1 block text-sm text-muted-foreground">At least 8 characters.</span>
        <FieldError msg={fe.password} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-base">
          Mobile number
          <input name="phone" type="tel" required defaultValue={state.values?.phone} autoComplete="tel" inputMode="tel" className={inputClass} />
          <FieldError msg={fe.phone} />
        </label>
        <label className="block text-base">
          Date of birth
          <input name="dob" type="date" required defaultValue={state.values?.dob} autoComplete="bday" className={inputClass} />
          <FieldError msg={fe.dob} />
        </label>
      </div>

      <label className="block text-base">
        Instagram username
        <input name="instagram" required defaultValue={state.values?.instagram} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="your.username" className={inputClass} />
        <FieldError msg={fe.instagram} />
      </label>

      <div>
        <label className="flex items-start gap-3 text-base">
          <input name="consent" type="checkbox" className="mt-1.5 size-5 accent-[var(--blaze)]" />
          <span>
            I&apos;m 18 or older. I agree that people on trips I join can see my first name, age and Instagram, and that Aethel trip can contact me about my trips.
          </span>
        </label>
        <FieldError msg={fe.consent} />
      </div>

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Creating your account…" : "Create my account"}
      </button>
      <p className="text-center text-base text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-link underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
