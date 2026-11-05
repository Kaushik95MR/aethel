// The kinds of trip we sell. A package belongs to a category when its tags include the category's slug,
// so staff choose categories in the admin and no extra table is needed. Add a row here to add a category.
export type Category = {
  slug: string;
  name: string;
  /** One line on a tile. */
  blurb: string;
  /** A sentence on the category's own page. */
  intro: string;
  /** Key of a bundled photo (see lib/photos.ts). */
  photo: string;
  /** One word for a small label. */
  short: string;
};

// Priority order: this is the order shown everywhere on the site.
export const CATEGORIES: Category[] = [
  {
    slug: "social",
    name: "Trips with strangers",
    blurb: "Travelling solo? Join a small group.",
    intro: "Fixed-date group trips for people travelling on their own. You arrive as strangers and leave as a group.",
    photo: "story-fire-night",
    short: "Strangers",
  },
  {
    slug: "family",
    name: "Family holidays",
    blurb: "Easy pace, everything arranged.",
    intro: "Holidays planned around children and grandparents: short drives, comfortable stays and time to rest.",
    photo: "kerala",
    short: "Family",
  },
  {
    slug: "couples",
    name: "Couples trips",
    blurb: "Time for just the two of you.",
    intro: "Trips for two, from honeymoons to anniversary breaks: quiet stays, good views and no crowds to manage.",
    photo: "bali",
    short: "Couples",
  },
  {
    slug: "groups",
    name: "Group trips",
    blurb: "Friends, colleagues or relatives.",
    intro: "Trips for a group you bring yourself: friends, colleagues or relatives, with one plan and one booking.",
    photo: "himachal",
    short: "Groups",
  },
  {
    slug: "seniors",
    name: "Senior group trips",
    blurb: "Relaxed and comfortable, together.",
    intro: "Unhurried group trips for older travellers: gentle schedules, easy sightseeing and no rushing between stops.",
    photo: "galtaji",
    short: "Seniors",
  },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

export const categoryBySlug = (slug: string | null | undefined) => CATEGORIES.find((c) => c.slug === slug);

export const categoriesOf = (tags: string[] | null | undefined) => CATEGORIES.filter((c) => tags?.includes(c.slug));
