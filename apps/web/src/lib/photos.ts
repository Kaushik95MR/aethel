import credits from "@/data/photo-credits.json";

// Interim photo source: stock images bundled in /public, keyed by name (a destination slug, or "hero" / "band").
// Replaced by the media table + admin uploads once staff manage their own photos.
export type Photo = {
  src: string;
  alt: string;
  title: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  source: string;
};

const byKey = credits as Record<string, Omit<Photo, "src">>;

const FOLDER: Record<string, string> = { hero: "site", band: "site" };
const folderFor = (key: string) =>
  key.startsWith("kp-") ? "kumara" : key.startsWith("story-") ? "story" : (FOLDER[key] ?? "destinations");

// Packages whose photograph is better than their destination's. Keyed by package slug.
const PACKAGE_COVER: Record<string, string> = { "kumara-parvatha-trek-3d": "kp-sunrise" };

export function packagePhoto(slug: string, fallbackDestination: string | null): Photo | null {
  return photoFor(PACKAGE_COVER[slug] ?? fallbackDestination);
}

export function photoFor(key: string | null | undefined): Photo | null {
  if (!key) return null;
  const c = byKey[key];
  if (!c) return null;
  return { src: `/images/${folderFor(key)}/${key}.jpg`, ...c };
}

export function allPhotos(): { slug: string; photo: Photo }[] {
  return Object.keys(byKey).map((slug) => ({ slug, photo: photoFor(slug)! }));
}
