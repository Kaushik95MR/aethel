import type { CatalogueTrip } from "@/components/trip-catalogue";
import type { PackageCard, Photo, UpcomingDeparture } from "@/lib/catalogue";
import { CATEGORIES } from "@/lib/categories";
import { formatPaise, seatsLabel } from "@/lib/format";

/** "18 Dec", read as a calendar date so the timezone never shifts it. */
export const dayMonth = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

type Pkg = PackageCard & { gallery: Photo[] };

/** One card per trip, with its next dates, host, seats left and a few highlights. */
export function buildCatalogue(packages: Pkg[], trips: UpcomingDeparture[]): CatalogueTrip[] {
  return packages.map((p) => {
    const deps = trips.filter((t) => t.slug === p.slug);
    const first = deps[0];
    const left = first?.seats_left ?? null;
    return {
      slug: p.slug,
      title: p.title,
      photo: p.photo ? { src: p.photo.src, alt: p.photo.alt } : null,
      badge: left !== null && left > 0 && left <= 5 ? `${left} ${left === 1 ? "slot" : "slots"} left` : null,
      duration: `${Math.max(p.duration_days - 1, 0)} nights, ${p.duration_days} days`,
      dates: !first
        ? "Dates coming soon"
        : deps.length > 1
          ? `Next: ${dayMonth(first.start_date)}. ${deps.length} dates`
          : `${dayMonth(first.start_date)} to ${dayMonth(first.end_date)}`,
      host: first?.host?.name ?? null,
      seats: seatsLabel(left),
      highlights: p.highlights,
      party: p.party ?? p.highlights.find((h) => /party|bonfire|music|dj|festival/i.test(h)) ?? null,
      price: formatPaise(p.base_price_paise),
      categories: p.tags,
    };
  });
}

/** Filter tabs for the categories that at least one trip belongs to. */
export function categoryTabs(packages: Pkg[]) {
  return CATEGORIES.filter((c) => packages.some((p) => p.tags.includes(c.slug))).map((c) => ({ slug: c.slug, label: c.name }));
}
