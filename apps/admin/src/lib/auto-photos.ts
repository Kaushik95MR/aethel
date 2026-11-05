import "server-only";
import { randomUUID } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// Finds free-licensed photos of a trek's real places on Wikimedia Commons and attaches them to itinerary steps that have
// no photo or video yet. Google Images results are copyrighted and can't be reused, so they are not used here.

const HEADERS = { "User-Agent": "AethelTreks/1.0 (trek photo finder; contact kaumr@deloitte.com)" };
const MAX_IMAGES = 8;
const MAX_BYTES = 9 * 1024 * 1024; // the public-media bucket allows 10 MB

// Reusable licences only: no NonCommercial or NoDerivatives.
const LICENSE_OK = /^(CC0|Public domain|PD|CC BY(-SA)? \d)/i;
// Titles that usually mean people, vehicles or non-scenic files.
const TITLE_SKIP = /\b(people|person|group|portrait|selfie|man|men|woman|women|boy|girl|tourists?|trekkers?|ranger|crowd|family|map|logo|flag|bus|train|poster|diagram|sign|board|banner|river|bridge|temple|railway|dam|city|town|road|highway)\b/i;
// Places that are a city or a building, not a scenic spot worth searching.
const PLACE_SKIP = /bengaluru|bangalore|homestay|checkpost|pick-?up|bus stand|station|airport|hotel|resort/i;

type Candidate = { title: string; url: string; author: string; license: string; licenseUrl: string | null; source: string };

const strip = (html: string | undefined) => (html ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();

/** Commons often spells Indian names differently ("Netravathi" is filed as "Netravati"), so try both. */
function variants(term: string): string[] {
  const t = term.trim();
  const short = t.replace(/avathi/gi, "avati").replace(/athi\b/gi, "ati").replace(/thi\b/gi, "ti");
  // The mountain first: a bare name like "Netravathi" also matches a river and a city.
  return [...new Set([`${t} peak`, `${short} peak`, t, short])].filter((v) => v.length > 2);
}

async function search(term: string): Promise<Candidate[]> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20" +
    `&gsrsearch=${encodeURIComponent(`${term} filetype:bitmap`)}` +
    "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2000";
  let res = await fetch(url, { headers: HEADERS });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(url, { headers: HEADERS });
  }
  if (!res.ok) return [];
  const json = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          index?: number;
          imageinfo?: { width: number; height: number; thumburl?: string; extmetadata?: Record<string, { value: string }> }[];
        }
      >;
    };
  };
  return Object.values(json.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const i = p.imageinfo?.[0];
      const meta = i?.extmetadata ?? {};
      const license = strip(meta.LicenseShortName?.value);
      const name = p.title.replace(/^File:/, "");
      if (!i?.thumburl || i.width < 1600 || i.width <= i.height) return [];
      if (!LICENSE_OK.test(license) || TITLE_SKIP.test(name)) return [];
      return [
        {
          title: name.replace(/\.[a-z0-9]+$/i, ""),
          url: i.thumburl,
          author: strip(meta.Artist?.value) || "Unknown",
          license,
          licenseUrl: strip(meta.LicenseUrl?.value) || null,
          source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`,
        },
      ];
    });
}

type StepRow = {
  id: string;
  kind: string;
  sound: string | null;
  vehicle: { label: string } | null;
  location: { label: string } | null;
  to_location: { label: string } | null;
  itinerary_step_media: { media_id: string }[];
};

/** Attaches found photos to steps without media. Returns how many steps got a photo. */
export async function fillItineraryPhotos(supabase: Client, itineraryId: string): Promise<number> {
  const [{ data: itn }, { data: days }] = await Promise.all([
    supabase.from("itineraries").select("package:packages(title)").eq("id", itineraryId).maybeSingle(),
    supabase
      .from("itinerary_days")
      .select(
        "day_no, itinerary_steps(id, kind, sound, sort_order, vehicle:catalogue_options!vehicle_id(label), location:catalogue_options!location_id(label), to_location:catalogue_options!to_location_id(label), itinerary_step_media(media_id))",
      )
      .eq("itinerary_id", itineraryId)
      .order("day_no"),
  ]);
  const packageTitle = (itn?.package as unknown as { title: string } | null)?.title ?? "";

  const steps = ((days ?? []) as unknown as { itinerary_steps: (StepRow & { sort_order: number })[] }[]).flatMap((d) =>
    [...d.itinerary_steps].sort((a, b) => a.sort_order - b.sort_order),
  );
  // The drawn bus scene and city pick-ups don't need photos.
  const targets = steps.filter(
    (s) =>
      s.itinerary_step_media.length === 0 &&
      s.kind !== "pickup" &&
      !(s.sound === "bus" || (s.kind === "travel" && !s.sound && /bus/i.test(s.vehicle?.label ?? ""))),
  );
  if (targets.length === 0) return 0;

  // Search the trek's own name first, then each scenic place on the itinerary.
  const places = [...new Set(steps.flatMap((s) => [s.location?.label, s.to_location?.label]).filter((x): x is string => !!x))]
    .filter((p) => !PLACE_SKIP.test(p))
    .map((p) => p.replace(/\b(village|camp|summit)\b/gi, "").trim());
  const name = packageTitle.replace(/\b(trek|summit|weekend|package|tour|peak)\b/gi, "").trim();
  const terms = [...new Set([name, ...places].filter(Boolean))];

  const pool = new Map<string, Candidate>();
  for (const term of terms) {
    for (const v of variants(term)) {
      for (const c of await search(v)) if (!pool.has(c.title)) pool.set(c.title, c);
      if (pool.size >= MAX_IMAGES) break;
    }
    if (pool.size >= MAX_IMAGES) break;
  }
  const picks = [...pool.values()].slice(0, MAX_IMAGES);
  if (picks.length === 0) return 0;

  // Upload each chosen photo once, then link it to the steps it covers. Fewer photos than steps means some repeat.
  const mediaIds = new Map<number, string>();
  let added = 0;
  for (const [n, step] of targets.slice(0, MAX_IMAGES * 2).entries()) {
    const idx = n % picks.length;
    let mediaId = mediaIds.get(idx);
    if (!mediaId) {
      const c = picks[idx];
      const res = await fetch(c.url, { headers: HEADERS });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES) continue;
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = `itinerary/${step.id}/${randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("public-media").upload(path, bytes, { contentType: type });
      if (upErr) continue;
      const { data: media } = await supabase
        .from("media")
        .insert({
          bucket: "public-media",
          path,
          kind: "image",
          alt: c.title.replace(/[_-]+/g, " "),
          bytes: bytes.length,
          credit: { title: c.title, author: c.author, license: c.license, licenseUrl: c.licenseUrl, source: c.source },
        })
        .select("id")
        .maybeSingle();
      if (!media) continue;
      mediaId = media.id as string;
      mediaIds.set(idx, mediaId);
    }
    const { error } = await supabase.from("itinerary_step_media").insert({ step_id: step.id, media_id: mediaId, sort_order: 0 });
    if (!error) added++;
  }
  return added;
}

/** Fills every itinerary of a package. Never throws: photos are a bonus, not a reason to fail a save. */
export async function fillPackagePhotos(supabase: Client, packageId: string): Promise<number> {
  try {
    const { data } = await supabase.from("itineraries").select("id").eq("package_id", packageId);
    let total = 0;
    for (const i of data ?? []) total += await fillItineraryPhotos(supabase, i.id);
    return total;
  } catch {
    return 0;
  }
}
