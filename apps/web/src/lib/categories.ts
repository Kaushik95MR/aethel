// The kinds of trip we sell. A trip belongs to a category when its tags include the category's slug,
// so staff choose categories in the admin and no extra table is needed. Keep the slugs in step with the admin.
export type Category = {
  slug: string;
  name: string;
  /** One word for a small label. */
  short: string;
};

// Priority order: strangers first.
export const CATEGORIES: Category[] = [
  { slug: "social", name: "Trips with strangers", short: "Strangers" },
  { slug: "family", name: "Family holidays", short: "Family" },
  { slug: "couples", name: "Couples trips", short: "Couples" },
  { slug: "groups", name: "Group trips", short: "Groups" },
  { slug: "seniors", name: "Senior group trips", short: "Seniors" },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

export const categoryBySlug = (slug: string | null | undefined) => CATEGORIES.find((c) => c.slug === slug);

export const categoriesOf = (tags: string[] | null | undefined) => CATEGORIES.filter((c) => tags?.includes(c.slug));
