export const inputClass =
  "mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-lg text-cream placeholder:text-muted-foreground focus:border-sun focus:outline-none";

export const primaryButton =
  "inline-flex min-h-13 w-full items-center justify-center rounded-full bg-primary px-8 text-lg font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0";

export function FieldError({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="mt-1.5 text-base text-destructive">
      {msg}
    </p>
  ) : null;
}

export function FormError({ msg }: { msg?: string }) {
  return msg ? (
    <p role="alert" className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-base text-destructive">
      {msg}
    </p>
  ) : null;
}
