"use client";

import { useActionState } from "react";
import { saveMyProfile, type AuthState } from "@/app/account/actions";
import { FieldError, FormError, inputClass, primaryButton } from "@/components/form-bits";

const initial: AuthState = { ok: false };

/** Edit your details. In "complete" mode (a login with no profile yet) it also asks for date of birth and consent. */
export function ProfileForm({
  mode,
  defaults,
}: {
  mode: "edit" | "complete";
  defaults: { name: string; phone: string; instagram: string };
}) {
  const [state, action, pending] = useActionState(saveMyProfile, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      <FormError msg={state.error} />
      {state.ok && state.notice && (
        <p role="status" className="rounded-xl border border-sun/50 bg-sun/10 px-4 py-3 text-base text-sun">
          {state.notice}
        </p>
      )}
      <label className="block text-base">
        Your name
        <input name="name" required defaultValue={state.values?.name ?? defaults.name} autoComplete="name" className={inputClass} />
        <FieldError msg={fe.name} />
      </label>
      <label className="block text-base">
        Mobile number
        <input name="phone" type="tel" required defaultValue={state.values?.phone ?? defaults.phone} autoComplete="tel" inputMode="tel" className={inputClass} />
        <FieldError msg={fe.phone} />
      </label>
      <label className="block text-base">
        Instagram username
        <input name="instagram" required defaultValue={state.values?.instagram ?? defaults.instagram} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputClass} />
        <FieldError msg={fe.instagram} />
      </label>
      {mode === "complete" && (
        <>
          <label className="block text-base">
            Date of birth
            <input name="dob" type="date" required defaultValue={state.values?.dob} autoComplete="bday" className={inputClass} />
            <FieldError msg={fe.dob} />
          </label>
          <div>
            <label className="flex items-start gap-3 text-base">
              <input name="consent" type="checkbox" className="mt-1.5 size-5 accent-[var(--blaze)]" />
              <span>I&apos;m 18 or older. I agree that people on trips I join can see my first name, age and Instagram, and that Aethel trip can contact me about my trips.</span>
            </label>
            <FieldError msg={fe.consent} />
          </div>
        </>
      )}
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Saving…" : mode === "complete" ? "Finish my profile" : "Save changes"}
      </button>
    </form>
  );
}
