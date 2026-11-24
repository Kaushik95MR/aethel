const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatPaise(paise: number | string | null | undefined): string {
  if (paise === null || paise === undefined) return "On request";
  return inr.format(Number(paise) / 100);
}

const utc = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Date-only values (YYYY-MM-DD) are calendar dates, so format them without timezone shifting. */
export function formatDate(value: string): string {
  return utc(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Fri 18 Dec", for date pills. */
export function formatDay(value: string): string {
  const d = utc(value);
  const day = d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
  const rest = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${day} ${rest}`;
}

/** "6 seats left", "1 seat left" or "Sold out". Null when the seat count is unknown. */
export function seatsLabel(left: number | null): string | null {
  if (left === null) return null;
  if (left <= 0) return "Sold out";
  return `${left} ${left === 1 ? "seat" : "seats"} left`;
}

/** "21:30:00" becomes "9:30 pm". */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** A 3-day trip is 2 nights. */
export function nightsLabel(days: number): string {
  const n = Math.max(days - 1, 0);
  return n === 0 ? "Day trip" : `${n} ${n === 1 ? "night" : "nights"}`;
}
