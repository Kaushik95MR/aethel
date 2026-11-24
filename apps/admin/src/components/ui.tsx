import Link from "next/link";

// Small shared pieces so every screen has the same title row, buttons, messages and empty states.

export const btn =
  "inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50";
export const btnPrimary =
  "inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50";
export const btnText = "text-sm font-medium text-zinc-700 underline-offset-2 hover:text-zinc-900 hover:underline";
export const btnDanger = "text-sm font-medium text-red-700 underline-offset-2 hover:underline";
export const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm";
export const card = "rounded-xl border border-zinc-200 bg-white";

/** The title row every screen opens with: a noun, one plain sentence, and the screen's real actions. */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <header className="space-y-2">
      {back && (
        <Link href={back.href} className="inline-block text-sm text-zinc-500 hover:text-zinc-900">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A success or error message, announced to screen readers. */
export function Flash({ tone, children }: { tone: "ok" | "error" | "info"; children: React.ReactNode }) {
  const styles = {
    ok: "border-green-200 bg-green-50 text-green-800",
    error: "border-red-200 bg-red-50 text-red-800",
    info: "border-zinc-200 bg-zinc-100 text-zinc-800",
  }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

/** A framed panel with an optional title row. */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${card} ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5 pt-3">{children}</div>
    </section>
  );
}

/** An empty section keeps its frame and says what to do next. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">{children}</p>;
}

/** Initials in a pale tint, a stable colour per name. */
export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold text-zinc-900"
      style={{ background: `hsl(${hue} 35% 28%)` }}
    >
      {initials || "?"}
    </span>
  );
}
