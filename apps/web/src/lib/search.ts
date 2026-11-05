import type { PackageCard, UpcomingDeparture } from "@/lib/catalogue";
import { categoriesOf } from "@/lib/categories";

export const LENGTHS = [
  { id: "weekend", label: "Weekend, up to 3 days", test: (d: number) => d <= 3 },
  { id: "week", label: "4 to 7 days", test: (d: number) => d >= 4 && d <= 7 },
  { id: "long", label: "8 days or more", test: (d: number) => d >= 8 },
] as const;

export const SORTS = [
  { id: "", label: "Name" },
  { id: "soonest", label: "Leaving soonest" },
  { id: "low", label: "Price, low to high" },
  { id: "high", label: "Price, high to low" },
] as const;

export type Query = { q: string; type: string; length: string; sort: string };

/** Every word typed must appear somewhere in the trip's own text, so "goa beach" narrows and never widens. */
function haystack(p: PackageCard): string {
  return [p.title, p.summary, p.highlights.join(" "), p.tags.join(" "), (p.places ?? []).join(" "), categoriesOf(p.tags).map((c) => c.name).join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function searchTrips(packages: PackageCard[], query: Query, departures: UpcomingDeparture[]): PackageCard[] {
  const words = query.q.toLowerCase().split(/\s+/).filter(Boolean);
  const length = LENGTHS.find((l) => l.id === query.length);
  const next = new Map<string, string>();
  for (const d of departures) if (!next.has(d.slug)) next.set(d.slug, d.start_date);

  const found = packages.filter((p) => {
    if (query.type && !p.tags.includes(query.type)) return false;
    if (length && !length.test(p.duration_days)) return false;
    const text = haystack(p);
    return words.every((w) => text.includes(w));
  });

  const price = (p: PackageCard) => (p.base_price_paise === null ? Number.MAX_SAFE_INTEGER : Number(p.base_price_paise));
  if (query.sort === "low") found.sort((a, b) => price(a) - price(b));
  else if (query.sort === "high") found.sort((a, b) => (b.base_price_paise === null ? -1 : price(b)) - (a.base_price_paise === null ? -1 : price(a)));
  else if (query.sort === "soonest") found.sort((a, b) => (next.get(a.slug) ?? "9999").localeCompare(next.get(b.slug) ?? "9999"));
  return found;
}
