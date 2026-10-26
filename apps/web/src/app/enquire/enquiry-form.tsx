"use client";

import { useActionState } from "react";
import { submitEnquiry, type EnquiryState } from "./actions";

const initial: EnquiryState = { ok: false };

const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2";

function Err({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1 text-sm text-link">
      {msg}
    </p>
  ) : null;
}

export function EnquiryForm({ packageSlug, packageTitle }: { packageSlug: string; packageTitle: string | null }) {
  const [state, action, pending] = useActionState(submitEnquiry, initial);
  const fe = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-2xl font-semibold">Thank you, we&apos;ve got it.</h2>
        <p className="mt-2 text-muted-foreground">One of our travel planners will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && (
        <p role="alert" className="rounded-lg bg-link/10 px-3 py-2 text-sm text-link">
          {state.error}
        </p>
      )}
      <input type="hidden" name="package" value={packageSlug} />
      {/* Honeypot, hidden from people and assistive tech. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {packageTitle && (
        <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
          Enquiring about: <span className="font-medium">{packageTitle}</span>
        </p>
      )}

      <label className="block text-sm">
        Your name
        <input name="name" required autoComplete="name" className={field} />
        <Err msg={fe.name} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Email
          <input name="email" type="email" autoComplete="email" className={field} />
          <Err msg={fe.email} />
        </label>
        <label className="block text-sm">
          Phone
          <input name="phone" type="tel" autoComplete="tel" className={field} />
          <Err msg={fe.phone} />
        </label>
      </div>

      {!packageTitle && (
        <label className="block text-sm">
          Where would you like to go?
          <input name="destination" className={field} placeholder="e.g. Kerala, Ladakh, Bali" />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm">
          Preferred start date
          <input name="start" type="date" className={field} />
          <Err msg={fe.start} />
        </label>
        <label className="block text-sm">
          Adults
          <input name="adults" type="number" min={1} max={30} defaultValue={2} className={field} />
          <Err msg={fe.adults} />
        </label>
        <label className="block text-sm">
          Children
          <input name="children" type="number" min={0} max={30} defaultValue={0} className={field} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="flexible" type="checkbox" /> My dates are flexible
      </label>

      <label className="block text-sm">
        Anything else we should know?
        <textarea name="message" rows={4} maxLength={2000} className={field} />
      </label>

      <div>
        <label className="flex items-start gap-2 text-sm">
          <input name="consent" type="checkbox" className="mt-1" />
          <span>I agree to be contacted about this enquiry using the details above.</span>
        </label>
        <Err msg={fe.consent} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand px-6 py-3 text-brand-ink hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
