import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Makes Day 1..n exist. Extra days are dropped only when they are still empty, so nobody loses written work. */
export async function syncItineraryDays(supabase: Client, itineraryId: string, dayCount: number) {
  const { data: days } = await supabase.from("itinerary_days").select("id, day_no, title, summary").eq("itinerary_id", itineraryId);
  const have = new Set((days ?? []).map((d) => d.day_no));
  const missing = Array.from({ length: dayCount }, (_, i) => i + 1)
    .filter((n) => !have.has(n))
    .map((day_no) => ({ itinerary_id: itineraryId, day_no }));
  if (missing.length) await supabase.from("itinerary_days").insert(missing);

  const extra = (days ?? []).filter((d) => d.day_no > dayCount && !d.title && !d.summary);
  if (extra.length) {
    const { data: used } = await supabase.from("itinerary_steps").select("day_id").in("day_id", extra.map((d) => d.id));
    const busy = new Set((used ?? []).map((s) => s.day_id));
    const removable = extra.filter((d) => !busy.has(d.id)).map((d) => d.id);
    if (removable.length) await supabase.from("itinerary_days").delete().in("id", removable);
  }
}

type StepSeed = { kind: string; title: string; start_time: string; vehicle?: "Bus" | "On foot"; sound?: string };

/** A sensible first draft for the number of days: overnight bus out, trek days, and the way home. Staff edit it from there. */
function templateFor(day: number, days: number): StepSeed[] {
  if (day === 1) {
    return [
      { kind: "pickup", title: "Pick-up", start_time: "21:00", vehicle: "Bus", sound: "city" },
      { kind: "travel", title: "The road", start_time: "22:00", vehicle: "Bus", sound: "bus" },
    ];
  }
  if (day === days) {
    return days === 2
      ? [
          { kind: "trek", title: "The trek", start_time: "06:30", vehicle: "On foot" },
          { kind: "drop_off", title: "Heading home", start_time: "18:00", vehicle: "Bus", sound: "home" },
        ]
      : [
          { kind: "free_time", title: "Morning", start_time: "07:00" },
          { kind: "drop_off", title: "Heading home", start_time: "18:00", vehicle: "Bus", sound: "home" },
        ];
  }
  return [
    { kind: "trek", title: "The trek", start_time: "07:00", vehicle: "On foot" },
    { kind: "meal", title: "Lunch", start_time: "13:00" },
    { kind: "stay", title: "Night stay", start_time: "20:00" },
  ];
}

/**
 * Gives a new package its first itinerary: Day 1..n with starter steps, ready to edit. Everything the customer page
 * needs (the story, the sounds, the photos) then follows from the itinerary, so staff only fill in details.
 */
export async function seedDefaultItinerary(supabase: Client, packageId: string, dayCount: number) {
  const { data: itn } = await supabase
    .from("itineraries")
    .insert({ package_id: packageId, name: "Itinerary 1", sort_order: 0 })
    .select("id")
    .maybeSingle();
  if (!itn) return null;
  await syncItineraryDays(supabase, itn.id, dayCount);

  const [{ data: days }, { data: vehicles }] = await Promise.all([
    supabase.from("itinerary_days").select("id, day_no").eq("itinerary_id", itn.id),
    supabase.from("catalogue_options").select("id, label").eq("kind", "vehicle"),
  ]);
  const vehicleId = (label: string) => vehicles?.find((v) => v.label === label)?.id ?? null;

  const steps = (days ?? []).flatMap((d) =>
    templateFor(d.day_no, dayCount).map((s, i) => ({
      day_id: d.id,
      sort_order: i,
      kind: s.kind,
      title: s.title,
      start_time: s.start_time,
      vehicle_id: s.vehicle ? vehicleId(s.vehicle) : null,
      sound: s.sound ?? null,
    })),
  );
  if (steps.length) await supabase.from("itinerary_steps").insert(steps);
  return itn.id as string;
}

/** Runs the day sync for every itinerary of a package, after its length changes. */
export async function syncPackageItineraries(supabase: Client, packageId: string, dayCount: number) {
  const { data } = await supabase.from("itineraries").select("id").eq("package_id", packageId);
  for (const i of data ?? []) await syncItineraryDays(supabase, i.id, dayCount);
}
