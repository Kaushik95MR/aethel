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
  is_domestic: boolean;
  /** Slug of the destination whose photo represents this package. */
  cover: string | null;
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

const CARD_COLUMNS = "id, slug, title, summary, duration_days, base_price_paise, price_note, tags, is_domestic";

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
    .select(`${CARD_COLUMNS}, package_destinations(destination:destinations(slug, status))`)
    .eq("status", "published")
    .order("title");
  if (error) throw new Error(`Couldn't load packages: ${error.message}`);

  type Row = Omit<PackageCard, "cover"> & {
    package_destinations: { destination: { slug: string; status: string } | null }[];
  };
  return ((data ?? []) as unknown as Row[]).map(({ package_destinations, ...p }) => ({
    ...p,
    cover: package_destinations.map((l) => l.destination).find((d) => d?.status === "published")?.slug ?? null,
  }));
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
