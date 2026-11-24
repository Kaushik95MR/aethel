"use client";

import { useActionState } from "react";
import { requestCallback, type CallbackState } from "@/app/callback/actions";

const initial: CallbackState = { ok: false };

/** "Call me back": name, number and the trip they are curious about. Lands in Enquiries as a callback. */
export function CallbackForm({ trips, defaultSlug = "" }: { trips: { slug: string; title: string }[]; defaultSlug?: string }) {
  const [state, action, pending] = useActionState(requestCallback, initial);
  const fe = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <div className="gform" role="status">
        <div className="ok">
          <h3>Thanks, we&apos;ll call you.</h3>
          <p style={{ marginTop: 12 }}>A travel planner will ring you shortly. We only use your number to call about your trip.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="gform">
      {state.error && (
        <p role="alert" className="err">
          {state.error}
        </p>
      )}
      <div aria-hidden className="hp">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label>
        Your name
        <input name="name" required autoComplete="name" />
        {fe.name && (
          <span role="alert" className="err">
            {fe.name}
          </span>
        )}
      </label>
      <label>
        Mobile number
        <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" />
        {fe.phone && (
          <span role="alert" className="err">
            {fe.phone}
          </span>
        )}
      </label>
      {trips.length > 0 && (
        <label>
          Which trip?
          <select name="package" defaultValue={defaultSlug}>
            <option value="">Not sure yet</option>
            {trips.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        <button type="submit" disabled={pending} className="btn">
          {pending ? "Sending…" : "Call me back"}
        </button>
      </div>
      <small>We only use your number to call you about your trip.</small>
    </form>
  );
}
