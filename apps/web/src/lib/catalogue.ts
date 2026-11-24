import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// Everything the public site shows is read from the database here: trips, dates, hosts and their photos.
// Cached so thousands of visitors do not each ask the database. The admin clears it the moment staff change anything
// (see app/api/revalidate), and a saved copy never lives longer than a few minutes even if that signal is missed.

export type MediaCredit = { title: string; author: string; license: string; licenseUrl: string | null; source: string };
export type Photo = { src: string; alt: string; credit: MediaCredit | null };

type MediaRow = { bucket: string; path: string; alt: string | null; credit: MediaCredit | null };
type PackageMediaRow = { role: string; sort_order: number; media: MediaRow | null };

const MEDIA = "bucket, path, alt, credit";
const HOST_SUMMARY = `slug, name, tagline, photo:media!photo_media_id(${MEDIA})`;
const PACKAGE_MEDIA = `package_media(role, sort_order, media:media(${MEDIA}))`;

function toPhoto(m: MediaRow | null | undefined): Photo | null {
  if (!m) return null;
  return { src: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${m.bucket}/${m.path}`, alt: m.alt ?? "", credit: m.credit };
}

/** A trip's photos, hero first, then the order staff chose. */
function toGallery(rows: PackageMediaRow[] | null | undefined): Photo[] {
  return (rows ?? [])
    .slice()
    .sort((a, b) => Number(b.role === "hero") - Number(a.role === "hero") || a.sort_order - b.sort_order)
    .map((r) => toPhoto(r.media))
    .filter((p): p is Photo => p !== null);
}

export type HostSummary = { slug: string; name: string; tagline: string | null; photo: Photo | null };
type HostRow = { slug: string; name: string; tagline: string | null; photo: MediaRow | null };
const toHostSummary = (h: HostRow | null | undefined): HostSummary | null =>
  h ? { slug: h.slug, name: h.name, tagline: h.tagline, photo: toPhoto(h.photo) } : null;

export type Host = HostSummary & {
  bio: string | null;
  city: string | null;
  instagram: string | null;
  vibes: string[];
  cover: Photo | null;
};

export type PackageCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  duration_days: number;
  base_price_paise: number | null;
  price_note: string | null;
  tags: string[];
  highlights: string[];
  /** The party of the trip in a few words, set by staff. */
  party: string | null;
  photo: Photo | null;
};

/** One thing that happens in a day: a pick-up, a meal, an activity. */
export type PlanStep = {
  kind: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  place: string | null;
  photos: Photo[];
};

export type PackageDay = {
  day_no: number;
  title: string;
  description: string | null;
  location: string | null;
  meals: string | null;
  stay: string | null;
  /** The steps of the day, from the itinerary staff or the host wrote. Empty for older trips. */
  steps: PlanStep[];
};

export type Departure = {
  id: string;
  start_date: string;
  end_date: string;
  capacity: number;
  seats_left: number | null;
  host: HostSummary | null;
};

export type PackageDetail = PackageCard & {
  description: string | null;
  inclusions: string[];
  exclusions: string[];
  seo_title: string | null;
  seo_description: string | null;
  days: PackageDay[];
  departures: Departure[];
  gallery: Photo[];
  destinations: { slug: string; name: string }[];
};

/** One dated trip: a package on a date, with its host. This is what the cards on the site show. */
export type UpcomingDeparture = {
  id: string;
  start_date: string;
  end_date: string;
  seats_left: number | null;
  host: HostSummary | null;
  slug: string;
  title: string;
  summary: string | null;
  duration_days: number;
  base_price_paise: number | null;
  price_note: string | null;
  tags: string[];
  photo: Photo | null;
};

const CARD_COLUMNS = "id, slug, title, summary, duration_days, base_price_paise, price_note, tags, highlights, party";
const todayIso = () => new Date().toISOString().slice(0, 10);

type DepartureRow = {
  id: string;
  start_date: string;
  end_date: string;
  host: HostRow | null;
  package: {
    slug: string;
    title: string;
    summary: string | null;
    duration_days: number;
    base_price_paise: number | null;
    price_note: string | null;
    tags: string[];
    package_media: PackageMediaRow[];
  };
};

const DEPARTURE_SELECT = `id, start_date, end_date, host:hosts(${HOST_SUMMARY}),
  package:packages!inner(slug, title, summary, duration_days, base_price_paise, price_note, tags, status, ${PACKAGE_MEDIA})`;

async function seatsLeft(id: string): Promise<number | null> {
  const { data } = await createPublicClient().rpc("seats_left", { p_departure_id: id });
  return typeof data === "number" ? data : null;
}

async function toUpcoming(r: DepartureRow): Promise<UpcomingDeparture> {
  const p = r.package;
  return {
    id: r.id,
    start_date: r.start_date,
    end_date: r.end_date,
    seats_left: await seatsLeft(r.id),
    host: toHostSummary(r.host),
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    duration_days: p.duration_days,
    base_price_paise: p.base_price_paise,
    price_note: p.price_note,
    tags: p.tags,
    photo: toGallery(p.package_media)[0] ?? null,
  };
}

export async function getUpcomingDepartures(limit = 12): Promise<UpcomingDeparture[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");
  const { data, error } = await createPublicClient()
    .from("departures")
    .select(DEPARTURE_SELECT)
    .eq("status", "open")
    .gte("start_date", todayIso())
    .eq("package.status", "published")
    .order("start_date")
    .limit(limit);
  if (error) throw new Error(`Couldn't load trips: ${error.message}`);
  return Promise.all(((data ?? []) as unknown as DepartureRow[]).map(toUpcoming));
}

export async function getPackages(): Promise<(PackageCard & { gallery: Photo[] })[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");
  const { data, error } = await createPublicClient()
    .from("packages")
    .select(`${CARD_COLUMNS}, ${PACKAGE_MEDIA}`)
    .eq("status", "published")
    .order("title");
  if (error) throw new Error(`Couldn't load trips: ${error.message}`);
  type Row = Omit<PackageCard, "photo"> & { package_media: PackageMediaRow[] };
  return ((data ?? []) as unknown as Row[]).map(({ package_media, ...p }) => {
    const gallery = toGallery(package_media);
    return { ...p, photo: gallery[0] ?? null, gallery };
  });
}

export async function getPackage(slug: string): Promise<PackageDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");
  const supabase = createPublicClient();
  const { data: pkg, error } = await supabase
    .from("packages")
    .select(`${CARD_COLUMNS}, description, inclusions, exclusions, seo_title, seo_description, ${PACKAGE_MEDIA}`)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load trip: ${error.message}`);
  if (!pkg) return null;

  type Row = Omit<PackageDetail, "photo" | "gallery" | "days" | "departures" | "destinations"> & { package_media: PackageMediaRow[] };
  const { package_media, ...rest } = pkg as unknown as Row;

  const [legacyDays, itineraries, deps, links] = await Promise.all([
    supabase.from("package_days").select("day_no, title, description, location, meals, stay").eq("package_id", pkg.id).order("day_no"),
    supabase
      .from("itineraries")
      .select(
        `id, sort_order, itinerary_days(day_no, title, summary, itinerary_steps(sort_order, kind, title, description, start_time, end_time, location:catalogue_options!location_id(label), itinerary_step_media(sort_order, media:media(${MEDIA}))))`,
      )
      .eq("package_id", pkg.id)
      .order("sort_order"),
    supabase
      .from("departures")
      .select(`id, start_date, end_date, capacity, itinerary_id, host:hosts(${HOST_SUMMARY})`)
      .eq("package_id", pkg.id)
      .eq("status", "open")
      .gte("start_date", todayIso())
      .order("start_date")
      .limit(8),
    supabase.from("package_destinations").select("destination:destinations(slug, name, status)").eq("package_id", pkg.id),
  ]);

  const departures: Departure[] = await Promise.all(
    ((deps.data ?? []) as unknown as { id: string; start_date: string; end_date: string; capacity: number; itinerary_id: string | null; host: HostRow | null }[]).map(async (d) => ({
      id: d.id,
      start_date: d.start_date,
      end_date: d.end_date,
      capacity: d.capacity,
      seats_left: await seatsLeft(d.id),
      host: toHostSummary(d.host),
    })),
  );

  type Link = { destination: { slug: string; name: string; status: string } | null };
  const destinations = ((links.data ?? []) as unknown as Link[])
    .map((l) => l.destination)
    .filter((d): d is NonNullable<Link["destination"]> => !!d && d.status === "published")
    .map(({ slug: s, name }) => ({ slug: s, name }));

  // The plan comes from the itinerary the next date runs (or the first one). Older trips fall back to their plain day list.
  type StepRow = {
    sort_order: number;
    kind: string;
    title: string;
    description: string | null;
    start_time: string | null;
    end_time: string | null;
    location: { label: string } | null;
    itinerary_step_media: { sort_order: number; media: MediaRow | null }[];
  };
  type ItineraryRow = { id: string; itinerary_days: { day_no: number; title: string; summary: string | null; itinerary_steps: StepRow[] }[] };
  const plans = (itineraries.data ?? []) as unknown as ItineraryRow[];
  const nextItinerary = ((deps.data ?? []) as unknown as { itinerary_id: string | null }[]).find((d) => d.itinerary_id)?.itinerary_id;
  const plan = plans.find((i) => i.id === nextItinerary) ?? plans[0];
  const days: PackageDay[] = plan
    ? plan.itinerary_days
        .slice()
        .sort((a, b) => a.day_no - b.day_no)
        .map((d) => ({
          day_no: d.day_no,
          title: d.title,
          description: d.summary,
          location: null,
          meals: null,
          stay: null,
          steps: d.itinerary_steps
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((s) => ({
              kind: s.kind,
              title: s.title,
              description: s.description,
              start_time: s.start_time,
              end_time: s.end_time,
              place: s.location?.label ?? null,
              photos: s.itinerary_step_media
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((m) => toPhoto(m.media))
                .filter((p): p is Photo => p !== null),
            })),
        }))
    : ((legacyDays.data ?? []) as Omit<PackageDay, "steps">[]).map((d) => ({ ...d, steps: [] }));

  const gallery = toGallery(package_media);
  return { ...rest, photo: gallery[0] ?? null, gallery, days, departures, destinations };
}

export type HostCard = Host & { upcoming: number };

export async function getHosts(): Promise<HostCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");
  const supabase = createPublicClient();
  const [hosts, deps] = await Promise.all([
    supabase
      .from("hosts")
      .select(`slug, name, tagline, bio, city, instagram, vibes, photo:media!photo_media_id(${MEDIA}), cover:media!cover_media_id(${MEDIA})`)
      .eq("status", "published")
      .order("sort_order")
      .order("name"),
    supabase
      .from("departures")
      .select("host:hosts(slug), package:packages!inner(status)")
      .eq("status", "open")
      .gte("start_date", todayIso())
      .eq("package.status", "published"),
  ]);
  if (hosts.error) throw new Error(`Couldn't load hosts: ${hosts.error.message}`);

  const counts = new Map<string, number>();
  for (const d of (deps.data ?? []) as unknown as { host: { slug: string } | null }[]) {
    if (d.host) counts.set(d.host.slug, (counts.get(d.host.slug) ?? 0) + 1);
  }
  type Row = HostRow & { bio: string | null; city: string | null; instagram: string | null; vibes: string[]; cover: MediaRow | null };
  return ((hosts.data ?? []) as unknown as Row[]).map((h) => ({
    slug: h.slug,
    name: h.name,
    tagline: h.tagline,
    photo: toPhoto(h.photo),
    bio: h.bio,
    city: h.city,
    instagram: h.instagram,
    vibes: h.vibes ?? [],
    cover: toPhoto(h.cover),
    upcoming: counts.get(h.slug) ?? 0,
  }));
}

export type HostDetail = Host & { upcoming: UpcomingDeparture[]; past: UpcomingDeparture[]; pastCount: number };

export async function getHost(slug: string): Promise<HostDetail | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalogue");
  const supabase = createPublicClient();
  const { data: h, error } = await supabase
    .from("hosts")
    .select(`id, slug, name, tagline, bio, city, instagram, vibes, photo:media!photo_media_id(${MEDIA}), cover:media!cover_media_id(${MEDIA})`)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load host: ${error.message}`);
  if (!h) return null;

  const today = todayIso();
  const base = () => supabase.from("departures").select(DEPARTURE_SELECT).eq("host_id", h.id).eq("package.status", "published");
  const [up, past] = await Promise.all([
    base().eq("status", "open").gte("start_date", today).order("start_date").limit(12),
    base().neq("status", "cancelled").lt("end_date", today).order("start_date", { ascending: false }).limit(6),
  ]);

  type Row = HostRow & { bio: string | null; city: string | null; instagram: string | null; vibes: string[]; cover: MediaRow | null };
  const row = h as unknown as Row;
  const pastRows = (past.data ?? []) as unknown as DepartureRow[];
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    photo: toPhoto(row.photo),
    bio: row.bio,
    city: row.city,
    instagram: row.instagram,
    vibes: row.vibes ?? [],
    cover: toPhoto(row.cover),
    upcoming: await Promise.all(((up.data ?? []) as unknown as DepartureRow[]).map(toUpcoming)),
    past: await Promise.all(pastRows.map(toUpcoming)),
    pastCount: pastRows.length,
  };
}
