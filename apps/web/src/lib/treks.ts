import { getPackage, type PackageDetail } from "@/lib/catalogue";

// Treks that have their own editorial page. Everything else uses the generic package page.
export const TREK_SLUGS = ["kumara-parvatha-trek-3d"] as const;

export function isTrek(slug: string): boolean {
  return (TREK_SLUGS as readonly string[]).includes(slug);
}

export async function getTrek(slug: string): Promise<PackageDetail | null> {
  return getPackage(slug);
}
