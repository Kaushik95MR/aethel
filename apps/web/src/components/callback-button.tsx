"use client";

import { useActionState, useId, useRef } from "react";
import { requestCallback, type CallbackState } from "@/app/callback/actions";

const initial: CallbackState = { ok: false };
const field = "mt-1 w-full rounded-lg border border-line bg-background px-3 py-2";

/** "Request a callback" on a trip card. Opens a small dialog that asks for a name and number only. */
export function CallbackButton({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(requestCallback, initial);
  const id = useId();
  const fe = state.fieldErrors ?? {};

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={
          className ??
          "relative z-10 inline-flex min-h-11 items-center rounded-full border border-ink px-5 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-background"
        }
      >
        Request a callback
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-t`}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl bg-surface p-6 text-ink backdrop:bg-ink/60"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        {state.ok ? (
          <div role="status">
            <h2 id={`${id}-t`} className="font-display text-2xl">
              Thanks, we&apos;ll call you.
            </h2>
            <p className="mt-2 text-muted-foreground">A travel planner will ring you about {title} shortly.</p>
            <button type="button" onClick={() => dialog.current?.close()} className="mt-5 min-h-11 rounded-full bg-primary px-6 font-medium text-primary-foreground">
              Done
            </button>
          </div>
        ) : (
          <form action={action} noValidate className="space-y-4">
            <h2 id={`${id}-t`} className="font-display text-2xl">
              Request a callback
            </h2>
            <p className="text-sm text-muted-foreground">About {title}. Leave your number and a planner will call you. We only use it to call about this trip.</p>
            {state.error && (
              <p role="alert" className="rounded-lg bg-link/10 px-3 py-2 text-sm text-link">
                {state.error}
              </p>
            )}
            <input type="hidden" name="package" value={slug} />
            <div aria-hidden className="absolute -left-[9999px]">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="block text-sm">
              Your name
              <input name="name" required autoComplete="name" className={field} />
              {fe.name && (
                <span role="alert" className="mt-1 block text-sm text-link">
                  {fe.name}
                </span>
              )}
            </label>
            <label className="block text-sm">
              Mobile number
              <input name="phone" type="tel" required autoComplete="tel" inputMode="tel" className={field} />
              {fe.phone && (
                <span role="alert" className="mt-1 block text-sm text-link">
                  {fe.phone}
                </span>
              )}
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 rounded-full bg-primary px-6 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Call me"}
              </button>
              <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 px-3 text-sm underline">
                Cancel
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
