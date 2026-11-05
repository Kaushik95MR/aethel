import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";

// Published catalogue reads. Cached, and invalidated by the "catalogue" tag when staff publish.

export type Destination = {
  id: string;
  slug: string;
  name: string;
  country: string;
  region: string | null;
  summary: string | null;
  lat: number | null;
  lng: number | null;
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
  is_domestic: boolean;
  /** Slug of the destination whose photo represents this package. */
  cover: string | null;
  /** Names of the destinations the package visits. Used by search. */
  places?: string[];
};

export type PackageDay = {
  day_no: number;
  title: string;
  description: string | null;
  location: string | null;
  meals: string | null;
  stay: string | null;
};

export type Departure = { id: string; start_date: string; end_date: string; seats_left: number | null };

export type PackageDetail = PackageCard & {
  description: string | null;
  inclusions: string[];
  exclusions: string[];
  highlights: string[];
  seo_title: string | null;
  seo_description: string | null;
  days: PackageDay[];
  departures: Departure[];
  destinations: Pick<Destination, "slug" | "name">[];
};

const CARD_COLUMNS = "id, slug, title, summary, duration_days, base_price_paise, price_note, tags, highlights, is_domestic";

export async function getDestinations(): Promise<Destination[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");
  const { data, error } = await createPublicClient()
    .from("destinations")
    .select("id, slug, name, country, region, summary, lat, lng")
    .eq("status", "published")
    .order("sort_order");
  if (error) throw new Error(`Couldn't load destinations: ${error.message}`);
  return data ?? [];
}

export async function getDestination(slug: string): Promise<(Destination & { packages: PackageCard[] }) | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");
  const supabase = createPublicClient();
  const { data: dest, error } = await supabase
    .from("destinations")
    .select("id, slug, name, country, region, summary, lat, lng")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load destination: ${error.message}`);
  if (!dest) return null;

  const { data: links } = await supabase.from("package_destinations").select("package_id").eq("destination_id", dest.id);
  const ids = (links ?? []).map((l) => l.package_id);
  const { data: packages } = ids.length
    ? await supabase.from("packages").select(CARD_COLUMNS).eq("status", "published").in("id", ids).order("title")
    : { data: [] };
  return { ...dest, packages: ((packages ?? []) as unknown as Omit<PackageCard, "cover">[]).map((p) => ({ ...p, cover: dest.slug })) };
}

export type UpcomingDeparture = {
  id: string;
  start_date: string;
  seats_left: number | null;
  title: string;
  slug: string;
  base_price_paise: number | null;
  duration_days: number;
};

export async function getUpcomingDepartures(limit = 6, packageSlug?: string): Promise<UpcomingDeparture[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("departures")
    .select("id, start_date, package:packages(title, slug, base_price_paise, duration_days, status)")
    .eq("status", "open")
    .gte("start_date", today)
    .order("start_date")
    .limit(limit * 6);
  if (error) throw new Error(`Couldn't load departures: ${error.message}`);

  type Row = {
    id: string;
    start_date: string;
    package: { title: string; slug: string; base_price_paise: number | null; duration_days: number; status: string } | null;
  };
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => r.package?.status === "published" && (!packageSlug || r.package.slug === packageSlug))
    .slice(0, limit);
  return Promise.all(
    rows.map(async (r) => {
      const { data: left } = await supabase.rpc("seats_left", { p_departure_id: r.id });
      const p = r.package!;
      return {
        id: r.id,
        start_date: r.start_date,
        seats_left: typeof left === "number" ? left : null,
        title: p.title,
        slug: p.slug,
        base_price_paise: p.base_price_paise,
        duration_days: p.duration_days,
      };
    }),
  );
}

export async function getPackages(): Promise<PackageCard[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");
  const { data, error } = await createPublicClient()
    .from("packages")
    .select(`${CARD_COLUMNS}, package_destinations(destination:destinations(slug, name, status))`)
    .eq("status", "published")
    .order("title");
  if (error) throw new Error(`Couldn't load packages: ${error.message}`);

  type Row = Omit<PackageCard, "cover" | "places"> & {
    package_destinations: { destination: { slug: string; name: string; status: string } | null }[];
  };
  return ((data ?? []) as unknown as Row[]).map(({ package_destinations, ...p }) => ({
    ...p,
    cover: package_destinations.map((l) => l.destination).find((d) => d?.status === "published")?.slug ?? null,
    places: package_destinations.map((l) => l.destination?.name).filter((n): n is string => !!n),
  }));
}

export type MediaCredit = { title: string; author: string; license: string; licenseUrl: string | null; source: string };

export type ItineraryStep = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  start_time: string | null;
  vehicle: string | null;
  location: { label: string; maps_url: string | null } | null;
  to_location: { label: string; maps_url: string | null } | null;
  sound: string | null;
  /** Pick-up points, in order. */
  stops: { label: string; maps_url: string | null; time: string | null }[];
  media: { kind: "image" | "video"; src: string; alt: string; credit: MediaCredit | null }[];
};
export type ItineraryDay = { day_no: number; title: string; summary: string | null; steps: ItineraryStep[] };
export type TripItinerary = { name: string; start_date: string; days: ItineraryDay[] };

/** The itinerary of the next open departure that has one. Null when staff haven't built one yet. */
export async function getItinerary(slug: string): Promise<TripItinerary | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: linked } = await supabase
    .from("departures")
    .select("start_date, itinerary_id, package:packages!inner(slug, status)")
    .eq("package.slug", slug)
    .eq("package.status", "published")
    .eq("status", "open")
    .gte("start_date", today)
    .not("itinerary_id", "is", null)
    .order("start_date")
    .limit(1)
    .maybeSingle();
  let dep: { start_date: string; itinerary_id: string | null } | null = linked;

  // No departure is linked to an itinerary yet: show the package's first itinerary, dated from its next departure.
  if (!dep?.itinerary_id) {
    const { data: first } = await supabase
      .from("itineraries")
      .select("id, package:packages!inner(slug, status)")
      .eq("package.slug", slug)
      .eq("package.status", "published")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (!first) return null;
    const { data: next } = await supabase
      .from("departures")
      .select("start_date, package:packages!inner(slug)")
      .eq("package.slug", slug)
      .eq("status", "open")
      .gte("start_date", today)
      .order("start_date")
      .limit(1)
      .maybeSingle();
    dep = { start_date: next?.start_date ?? today, itinerary_id: first.id };
  }
  if (!dep.itinerary_id) return null;

  const { data: itn, error } = await supabase
    .from("itineraries")
    .select(
      `name, itinerary_days(day_no, title, summary, itinerary_steps(
        id, sort_order, kind, title, description, start_time, sound,
        vehicle:catalogue_options!vehicle_id(label),
        location:catalogue_options!location_id(label, maps_url),
        to_location:catalogue_options!to_location_id(label, maps_url),
        itinerary_step_media(sort_order, media:media(bucket, path, kind, alt, credit)),
        itinerary_step_stops(sort_order, stop_time, location:catalogue_options!location_id(label, maps_url))
      ))`,
    )
    .eq("id", dep.itinerary_id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load itinerary: ${error.message}`);
  if (!itn) return null;

  type Raw = {
    name: string;
    itinerary_days: {
      day_no: number;
      title: string;
      summary: string | null;
      itinerary_steps: (Omit<ItineraryStep, "vehicle" | "media" | "stops"> & {
        sort_order: number;
        vehicle: { label: string } | null;
        itinerary_step_stops: { sort_order: number; stop_time: string | null; location: { label: string; maps_url: string | null } | null }[];
        itinerary_step_media: { sort_order: number; media: { bucket: string; path: string; kind: string; alt: string | null; credit: MediaCredit | null } | null }[];
      })[];
    }[];
  };
  const raw = itn as unknown as Raw;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const days: ItineraryDay[] = raw.itinerary_days
    .sort((a, b) => a.day_no - b.day_no)
    .map((d) => ({
      day_no: d.day_no,
      title: d.title,
      summary: d.summary,
      steps: d.itinerary_steps
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ sort_order: _o, itinerary_step_media, itinerary_step_stops, vehicle, ...s }) => {
          void _o;
          return {
            ...s,
            vehicle: vehicle?.label ?? null,
            stops: itinerary_step_stops
              .sort((a, b) => a.sort_order - b.sort_order)
              .flatMap((p) => (p.location ? [{ label: p.location.label, maps_url: p.location.maps_url, time: p.stop_time }] : [])),
            media: itinerary_step_media
              .sort((a, b) => a.sort_order - b.sort_order)
              .flatMap((m) =>
                m.media && (m.media.kind === "image" || m.media.kind === "video")
                  ? [{ kind: m.media.kind, src: `${base}/storage/v1/object/public/${m.media.bucket}/${m.media.path}`, alt: m.media.alt ?? "", credit: m.media.credit }]
                  : [],
              ),
          };
        }),
    }));
  return { name: raw.name, start_date: dep.start_date, days };
}

export async function getPackage(slug: string): Promise<PackageDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalogue");
  const supabase = createPublicClient();
  const { data: pkg, error } = await supabase
    .from("packages")
    .select(`${CARD_COLUMNS}, description, inclusions, exclusions, highlights, seo_title, seo_description`)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load package: ${error.message}`);
  if (!pkg) return null;

  const today = new Date().toISOString().slice(0, 10);
  const [days, deps, links] = await Promise.all([
    supabase.from("package_days").select("day_no, title, description, location, meals, stay").eq("package_id", pkg.id).order("day_no"),
    supabase
      .from("departures")
      .select("id, start_date, end_date")
      .eq("package_id", pkg.id)
      .eq("status", "open")
      .gte("start_date", today)
      .order("start_date")
      .limit(6),
    supabase.from("package_destinations").select("destination:destinations(slug, name, status)").eq("package_id", pkg.id),
  ]);

  const departures: Departure[] = await Promise.all(
    (deps.data ?? []).map(async (d) => {
      const { data: left } = await supabase.rpc("seats_left", { p_departure_id: d.id });
      return { ...d, seats_left: typeof left === "number" ? left : null };
    }),
  );

  type Link = { destination: { slug: string; name: string; status: string } | null };
  const destinations = ((links.data ?? []) as unknown as Link[])
    .map((l) => l.destination)
    .filter((d): d is NonNullable<Link["destination"]> => !!d && d.status === "published")
    .map(({ slug: s, name }) => ({ slug: s, name }));

  return {
    ...(pkg as unknown as Omit<PackageDetail, "days" | "departures" | "destinations" | "cover">),
    cover: destinations[0]?.slug ?? null,
    days: days.data ?? [],
    departures,
    destinations,
  };
}
