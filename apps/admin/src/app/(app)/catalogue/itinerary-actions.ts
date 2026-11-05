"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncItineraryDays } from "@/lib/itinerary";
import { fillItineraryPhotos, fillPackagePhotos } from "@/lib/auto-photos";
import { SOUND_SCENES, STEP_KINDS, stepLabel } from "./itinerary-options";

const ROLES = ["owner", "manager", "content_editor"] as const;
const uuid = z.string().uuid();
type Client = Awaited<ReturnType<typeof createClient>>;

const base = (pkg: string, itn: string) => `/catalogue/${pkg}/itineraries/${itn}`;

const ids = z.object({ package_id: uuid, itinerary_id: uuid });

/** Parses the two ids every itinerary form carries, or sends the user back to the catalogue. */
function parseIds(formData: FormData) {
  const p = ids.safeParse({ package_id: formData.get("package_id"), itinerary_id: formData.get("itinerary_id") });
  if (!p.success) redirect("/catalogue");
  return p.data;
}

export async function createItinerary(formData: FormData) {
  await requireStaff([...ROLES]);
  const pkg = uuid.safeParse(formData.get("package_id"));
  if (!pkg.success) redirect("/catalogue");
  const name = z.string().trim().min(1).max(120).safeParse(formData.get("name"));
  if (!name.success) redirect(`/catalogue/${pkg.data}?tab=itineraries&error=invalid`);
  const copyFrom = uuid.safeParse(formData.get("copy_from"));

  const supabase = await createClient();
  const [{ data: p }, { count }] = await Promise.all([
    supabase.from("packages").select("duration_days").eq("id", pkg.data).maybeSingle(),
    supabase.from("itineraries").select("id", { count: "exact", head: true }).eq("package_id", pkg.data),
  ]);
  if (!p) redirect("/catalogue");

  const { data: itn, error } = await supabase
    .from("itineraries")
    .insert({ package_id: pkg.data, name: name.data, sort_order: count ?? 0 })
    .select("id")
    .maybeSingle();
  if (error || !itn) redirect(`/catalogue/${pkg.data}?tab=itineraries&error=failed`);

  if (copyFrom.success) {
    await copyItinerary(supabase, copyFrom.data, itn.id);
  }
  await syncItineraryDays(supabase, itn.id, p.duration_days);

  revalidatePath(`/catalogue/${pkg.data}`);
  redirect(base(pkg.data, itn.id));
}

/** Duplicates days, steps and attached media so a new itinerary starts from an existing one. */
async function copyItinerary(supabase: Client, fromId: string, toId: string) {
  const { data: days } = await supabase.from("itinerary_days").select("id, day_no, title, summary").eq("itinerary_id", fromId);
  for (const d of days ?? []) {
    const { data: nd } = await supabase
      .from("itinerary_days")
      .insert({ itinerary_id: toId, day_no: d.day_no, title: d.title, summary: d.summary })
      .select("id")
      .maybeSingle();
    if (!nd) continue;
    const { data: steps } = await supabase.from("itinerary_steps").select("*").eq("day_id", d.id).order("sort_order");
    for (const s of steps ?? []) {
      const { id: oldId, day_id: _day, created_at: _c, ...rest } = s;
      void _day;
      void _c;
      const { data: ns } = await supabase.from("itinerary_steps").insert({ ...rest, day_id: nd.id }).select("id").maybeSingle();
      if (!ns) continue;
      const { data: stops } = await supabase.from("itinerary_step_stops").select("location_id, stop_time, sort_order").eq("step_id", oldId);
      if (stops?.length) await supabase.from("itinerary_step_stops").insert(stops.map((x) => ({ ...x, step_id: ns.id })));
      const { data: media } = await supabase.from("itinerary_step_media").select("media_id, sort_order").eq("step_id", oldId);
      if (media?.length) await supabase.from("itinerary_step_media").insert(media.map((m) => ({ ...m, step_id: ns.id })));
    }
  }
}

export async function renameItinerary(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const name = z.string().trim().min(1).max(120).safeParse(formData.get("name"));
  if (!name.success) redirect(`${base(package_id, itinerary_id)}?error=invalid`);
  const description = String(formData.get("description") ?? "").trim().slice(0, 1000) || null;

  const supabase = await createClient();
  const { error } = await supabase.from("itineraries").update({ name: name.data, description }).eq("id", itinerary_id);
  if (error) redirect(`${base(package_id, itinerary_id)}?error=failed`);
  revalidatePath(`/catalogue/${package_id}`);
  redirect(`${base(package_id, itinerary_id)}?saved=1`);
}

export async function deleteItinerary(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const supabase = await createClient();
  const { error } = await supabase.from("itineraries").delete().eq("id", itinerary_id);
  if (error) redirect(`${base(package_id, itinerary_id)}?error=failed`);
  revalidatePath(`/catalogue/${package_id}`);
  redirect(`/catalogue/${package_id}?tab=itineraries&saved=1`);
}

export async function saveDayInfo(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const day = uuid.safeParse(formData.get("day_id"));
  if (!day.success) redirect(base(package_id, itinerary_id));
  const supabase = await createClient();
  const { error } = await supabase
    .from("itinerary_days")
    .update({
      title: String(formData.get("title") ?? "").trim().slice(0, 120),
      summary: String(formData.get("summary") ?? "").trim().slice(0, 2000) || null,
    })
    .eq("id", day.data);
  if (error) redirect(`${base(package_id, itinerary_id)}?error=failed#day-${day.data}`);
  revalidatePath(base(package_id, itinerary_id));
  redirect(`${base(package_id, itinerary_id)}?saved=1#day-${day.data}`);
}

export async function addStep(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const day = uuid.safeParse(formData.get("day_id"));
  const kind = z.enum(STEP_KINDS.map((k) => k.value) as [string, ...string[]]).safeParse(formData.get("kind"));
  if (!day.success || !kind.success) redirect(`${base(package_id, itinerary_id)}?error=invalid`);

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("itinerary_steps")
    .select("sort_order")
    .eq("day_id", day.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: step, error } = await supabase
    .from("itinerary_steps")
    .insert({ day_id: day.data, kind: kind.data, title: stepLabel(kind.data), sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .maybeSingle();
  if (error || !step) redirect(`${base(package_id, itinerary_id)}?error=failed#day-${day.data}`);
  revalidatePath(base(package_id, itinerary_id));
  redirect(`${base(package_id, itinerary_id)}#step-${step.id}`);
}

const time = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .optional();

/** Finds a vehicle or place by name, creating it (with its Google Maps link) the first time it is typed. */
async function resolveOption(supabase: Client, kind: "vehicle" | "location", pickedId: FormDataEntryValue | null, newName: FormDataEntryValue | null, newUrl: FormDataEntryValue | null) {
  const name = String(newName ?? "").trim().slice(0, 120);
  if (name) {
    const url = String(newUrl ?? "").trim();
    const row: { kind: string; label: string; maps_url?: string } = { kind, label: name };
    if (/^https?:\/\//.test(url)) row.maps_url = url;
    const { data } = await supabase.from("catalogue_options").upsert(row, { onConflict: "kind,label" }).select("id").maybeSingle();
    return data?.id ?? null;
  }
  const id = uuid.safeParse(pickedId);
  return id.success ? id.data : null;
}

export async function saveStep(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const step = uuid.safeParse(formData.get("step_id"));
  if (!step.success) redirect(base(package_id, itinerary_id));
  const back = base(package_id, itinerary_id);

  const parsed = z
    .object({
      kind: z.enum(STEP_KINDS.map((k) => k.value) as [string, ...string[]]),
      title: z.string().trim().max(120),
      description: z.string().trim().max(2000).optional(),
      start_time: time,
      end_time: time,
      sound: z.enum(SOUND_SCENES.map((s) => s.value) as [string, ...string[]]).optional(),
    })
    .safeParse({
      kind: formData.get("kind"),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      start_time: formData.get("start_time") || undefined,
      end_time: formData.get("end_time") || undefined,
      sound: formData.get("sound") || undefined,
    });
  if (!parsed.success) redirect(`${back}?error=invalid#step-${step.data}`);

  const supabase = await createClient();
  const [vehicle_id, location_id, to_location_id] = await Promise.all([
    resolveOption(supabase, "vehicle", formData.get("vehicle_id"), formData.get("vehicle_new"), null),
    resolveOption(supabase, "location", formData.get("location_id"), formData.get("location_new"), formData.get("location_url")),
    resolveOption(supabase, "location", formData.get("to_location_id"), formData.get("to_location_new"), formData.get("to_location_url")),
  ]);

  const { error } = await supabase
    .from("itinerary_steps")
    .update({
      kind: parsed.data.kind,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      start_time: parsed.data.start_time ?? null,
      end_time: parsed.data.end_time ?? null,
      sound: parsed.data.sound ?? null,
      vehicle_id,
      location_id,
      to_location_id,
    })
    .eq("id", step.data);
  if (error) redirect(`${back}?error=failed#step-${step.data}`);
  revalidatePath(back);
  redirect(`${back}?saved=1#step-${step.data}`);
}

/** Finds free-licensed photos of the trek's places and attaches them to steps that have none. */
export async function autoPhotos(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const supabase = await createClient();
  const added = await fillItineraryPhotos(supabase, itinerary_id);
  revalidatePath(base(package_id, itinerary_id));
  redirect(`${base(package_id, itinerary_id)}?photos=${added}`);
}

/** Runs after a package is created: finds photos for every step that has none. Called from the page, not a form. */
export async function autoFillPackagePhotos(packageId: string): Promise<number> {
  await requireStaff([...ROLES]);
  if (!uuid.safeParse(packageId).success) return 0;
  const supabase = await createClient();
  const added = await fillPackagePhotos(supabase, packageId);
  revalidatePath(`/catalogue/${packageId}`);
  return added;
}

/** Adds one pick-up point (a place and a time) to a step. A pick-up can have as many as needed. */
export async function addStop(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const step = uuid.safeParse(formData.get("step_id"));
  if (!step.success) redirect(base(package_id, itinerary_id));
  const back = `${base(package_id, itinerary_id)}`;
  const t = time.safeParse(formData.get("stop_time") || undefined);

  const supabase = await createClient();
  const location_id = await resolveOption(supabase, "location", formData.get("location_id"), formData.get("location_new"), formData.get("location_url"));
  if (!location_id || !t.success) redirect(`${back}?error=stop_invalid#step-${step.data}`);

  const { count } = await supabase.from("itinerary_step_stops").select("id", { count: "exact", head: true }).eq("step_id", step.data);
  const { error } = await supabase
    .from("itinerary_step_stops")
    .insert({ step_id: step.data, location_id, stop_time: t.data ?? null, sort_order: count ?? 0 });
  if (error) redirect(`${back}?error=failed#step-${step.data}`);
  revalidatePath(back);
  redirect(`${back}?saved=1#step-${step.data}`);
}

export async function removeStop(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const p = z.object({ stop_id: uuid, step_id: uuid }).safeParse({ stop_id: formData.get("stop_id"), step_id: formData.get("step_id") });
  if (!p.success) redirect(base(package_id, itinerary_id));
  const supabase = await createClient();
  await supabase.from("itinerary_step_stops").delete().eq("id", p.data.stop_id);
  revalidatePath(base(package_id, itinerary_id));
  redirect(`${base(package_id, itinerary_id)}#step-${p.data.step_id}`);
}

export async function deleteStep(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const step = uuid.safeParse(formData.get("step_id"));
  if (!step.success) redirect(base(package_id, itinerary_id));
  const supabase = await createClient();
  await supabase.from("itinerary_steps").delete().eq("id", step.data);
  revalidatePath(base(package_id, itinerary_id));
  redirect(base(package_id, itinerary_id));
}

/** Swaps a step with its neighbour in the same day. */
export async function moveStep(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const step = uuid.safeParse(formData.get("step_id"));
  const dir = formData.get("direction") === "up" ? -1 : 1;
  if (!step.success) redirect(base(package_id, itinerary_id));

  const supabase = await createClient();
  const { data: me } = await supabase.from("itinerary_steps").select("id, day_id").eq("id", step.data).maybeSingle();
  if (me) {
    const { data: all } = await supabase.from("itinerary_steps").select("id").eq("day_id", me.day_id).order("sort_order").order("created_at");
    const order = (all ?? []).map((s) => s.id);
    const i = order.indexOf(me.id);
    const j = i + dir;
    if (i >= 0 && j >= 0 && j < order.length) {
      [order[i], order[j]] = [order[j], order[i]];
      await Promise.all(order.map((id, n) => supabase.from("itinerary_steps").update({ sort_order: n }).eq("id", id)));
    }
  }
  revalidatePath(base(package_id, itinerary_id));
  redirect(`${base(package_id, itinerary_id)}#step-${step.data}`);
}

/** Called after the browser has uploaded a file straight to storage. Records it and links it to the step. */
export async function attachMedia(input: { stepId: string; path: string; kind: "image" | "video"; alt: string; bytes: number }) {
  await requireStaff([...ROLES]);
  const p = z
    .object({
      stepId: uuid,
      path: z.string().regex(/^itinerary\/[0-9a-f-]{36}\/[\w.-]+$/),
      kind: z.enum(["image", "video"]),
      alt: z.string().trim().max(200),
      bytes: z.number().int().min(0),
    })
    .safeParse(input);
  if (!p.success) return { ok: false as const };

  const supabase = await createClient();
  const { data: media, error } = await supabase
    .from("media")
    .insert({ bucket: "public-media", path: p.data.path, kind: p.data.kind, alt: p.data.alt || null, bytes: p.data.bytes })
    .select("id")
    .maybeSingle();
  if (error || !media) return { ok: false as const };
  const { count } = await supabase.from("itinerary_step_media").select("media_id", { count: "exact", head: true }).eq("step_id", p.data.stepId);
  const { error: linkError } = await supabase
    .from("itinerary_step_media")
    .insert({ step_id: p.data.stepId, media_id: media.id, sort_order: count ?? 0 });
  return { ok: !linkError as boolean };
}

export async function detachMedia(formData: FormData) {
  await requireStaff([...ROLES]);
  const { package_id, itinerary_id } = parseIds(formData);
  const p = z.object({ step_id: uuid, media_id: uuid }).safeParse({ step_id: formData.get("step_id"), media_id: formData.get("media_id") });
  if (!p.success) redirect(base(package_id, itinerary_id));

  const supabase = await createClient();
  const { data: m } = await supabase.from("media").select("bucket, path").eq("id", p.data.media_id).maybeSingle();
  await supabase.from("itinerary_step_media").delete().eq("step_id", p.data.step_id).eq("media_id", p.data.media_id);
  const { count } = await supabase.from("itinerary_step_media").select("media_id", { count: "exact", head: true }).eq("media_id", p.data.media_id);
  if (m && !count) {
    await supabase.storage.from(m.bucket).remove([m.path]);
    await supabase.from("media").delete().eq("id", p.data.media_id);
  }
  revalidatePath(base(package_id, itinerary_id));
  redirect(`${base(package_id, itinerary_id)}#step-${p.data.step_id}`);
}
