const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Money is stored as integer paise. */
export function formatPaise(paise: number | string | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  return inr.format(Number(paise) / 100);
}

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Date-only values (YYYY-MM-DD) are calendar dates, not instants: avoid timezone shifts.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+05:30`) : new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : date.format(d);
}

export function humanize(value: string): string {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Keeps free-text search safe to interpolate into a PostgREST `or`/`ilike` filter. */
export function sanitizeSearch(input: string | undefined): string {
  return (input ?? "").replace(/[^\p{L}\p{N}\s@.\-+]/gu, "").trim().slice(0, 60);
}
