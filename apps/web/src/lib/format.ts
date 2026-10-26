const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatPaise(paise: number | string | null | undefined): string {
  if (paise === null || paise === undefined) return "On request";
  return inr.format(Number(paise) / 100);
}

/** Date-only values (YYYY-MM-DD) are calendar dates, so format them without timezone shifting. */
export function formatDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
