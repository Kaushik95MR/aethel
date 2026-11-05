import type { MediaCredit, PackageCard, TripItinerary } from "@/lib/catalogue";
import { categoriesOf } from "@/lib/categories";
import { isTrek } from "@/lib/treks";
import { packagePhoto, photoFor, type Photo } from "@/lib/photos";

export type GalleryImage = { src: string; alt: string; credit: MediaCredit | null };

const fromPhoto = (p: Photo): GalleryImage => ({
  src: p.src,
  alt: p.alt,
  credit: { title: p.title, author: p.author, license: p.license, licenseUrl: p.licenseUrl, source: p.source },
});

// Bundled photographs of the Kumara Parvatha trail, used until staff upload their own.
const KUMARA = ["kp-sunrise", "kp-ridge", "kp-forest", "kp-mist", "kp-valley"];

/** Up to five pictures for a trip: the ones staff attached to the itinerary first, then bundled photographs. */
export function tripGallery(pkg: Pick<PackageCard, "slug" | "cover" | "tags">, itinerary: TripItinerary | null): GalleryImage[] {
  const seen = new Set<string>();
  const out: GalleryImage[] = [];
  for (const day of itinerary?.days ?? []) {
    for (const step of day.steps) {
      for (const m of step.media) {
        if (m.kind !== "image" || seen.has(m.src)) continue;
        seen.add(m.src);
        out.push({ src: m.src, alt: m.alt || "A moment from the trip", credit: m.credit });
      }
    }
  }
  if (out.length < 5 && isTrek(pkg.slug)) {
    for (const key of KUMARA) {
      const p = photoFor(key);
      if (p && !seen.has(p.src)) {
        seen.add(p.src);
        out.push(fromPhoto(p));
      }
    }
  }
  if (out.length === 0) {
    // No photos of its own yet: the destination's picture, or a scenic one for its kind of trip.
    const cover = packagePhoto(pkg.slug, pkg.cover) ?? photoFor(categoriesOf(pkg.tags)[0]?.photo);
    if (cover) out.push(fromPhoto(cover));
  }
  return out.slice(0, 5);
}
