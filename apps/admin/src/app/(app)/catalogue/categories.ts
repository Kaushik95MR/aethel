// Trip categories. They are stored as tags on the package and drive the filters on the public site.
// Keep the slugs in step with apps/web/src/lib/categories.ts.
export const CATEGORIES = [
  { slug: "social", name: "Trips with strangers", hint: "Solo travellers join a group" },
  { slug: "family", name: "Family holidays", hint: "Easy pace, kid-friendly" },
  { slug: "couples", name: "Couples trips", hint: "Honeymoons and trips for two" },
  { slug: "groups", name: "Group trips", hint: "Friends, colleagues, relatives" },
  { slug: "seniors", name: "Senior group trips", hint: "Relaxed, comfortable" },
] as const;

export const CATEGORY_SLUGS: string[] = CATEGORIES.map((c) => c.slug);
