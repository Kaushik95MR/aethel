"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultItinerary, syncPackageItineraries } from "@/lib/itinerary";
import { fillPackagePhotos } from "@/lib/auto-photos";
import { CATEGORY_SLUGS } from "./categories";

const ROLES = ["owner", "manager", "content_editor", "host"] as const;

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Rupees typed by staff become integer paise. Blank means "no price set". */
function rupeesToPaise(v: FormDataEntryValue | null): number | null | "invalid" {
  const s = String(v ?? "").replace(/[,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return "invalid";
  return Math.round(n * 100);
}

const packageSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  summary: z.string().trim().max(300).optional(),
  party: z.string().trim().max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  duration_days: z.coerce.number().int().min(1).max(60),
  price_note: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "published", "archived"]),
  is_domestic: z.boolean(),
});

export async function savePackage(formData: FormData) {
  const staff = await requireStaff([...ROLES]);
  const isHost = staff.role === "host";

  // A host cannot set a price or publish. The database enforces this too; here the form values are simply ignored.
  const base_price_paise = isHost ? null : rupeesToPaise(formData.get("price"));
  const title = String(formData.get("title") ?? "");
  const parsed = packageSchema.safeParse({
    id: formData.get("id") || undefined,
    title,
    slug: String(formData.get("slug") ?? "").trim() || slugify(title) || undefined,
    summary: formData.get("summary") || undefined,
    party: formData.get("party") || undefined,
    description: formData.get("description") || undefined,
    duration_days: formData.get("duration_days"),
    price_note: formData.get("price_note") || undefined,
    status: isHost ? "draft" : formData.get("status"),
    is_domestic: formData.get("is_domestic") === "on",
  });
  const back = parsed.success && parsed.data.id ? `/catalogue/${parsed.data.id}` : "/catalogue/new";
  if (!parsed.success || base_price_paise === "invalid") redirect(`${back}?error=invalid`);

  const { id, ...fields } = parsed.data;
  const chosen = formData.getAll("categories").map(String).filter((c) => CATEGORY_SLUGS.includes(c));

  const supabase = await createClient();
  const existing = id ? (await supabase.from("packages").select("status, tags").eq("id", id).maybeSingle()).data : null;
  const before = existing?.status ?? null;
  const priceColumn: { base_price_paise?: number | null } = isHost ? {} : { base_price_paise: base_price_paise as number | null };
  const row = {
    ...fields,
    party: fields.party ?? null,
    ...priceColumn,
    inclusions: lines(formData.get("inclusions")),
    exclusions: lines(formData.get("exclusions")),
    highlights: lines(formData.get("highlights")),
    // Categories are tags. Any other tag already on the package is kept.
    tags: [...new Set([...((existing?.tags as string[] | null) ?? []).filter((t) => !CATEGORY_SLUGS.includes(t)), ...chosen])],
  };
  const result = id
    ? await supabase.from("packages").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("packages").insert(row).select("id").maybeSingle();

  if (result.error?.code === "23505") redirect(`${back}?error=slug_taken`);
  if (result.error || !result.data) redirect(`${back}?error=failed`);

  // Changing the number of days reshapes every itinerary of this package to match.
  if (id) await syncPackageItineraries(supabase, id, fields.duration_days);

  // A brand-new package starts with a ready-made itinerary, and the page then finds photos for it in the background.
  if (!id) {
    await seedDefaultItinerary(supabase, result.data.id, fields.duration_days);
    revalidatePath("/catalogue");
    redirect(`/catalogue/${result.data.id}?saved=1${isHost ? "" : "&autofill=1"}`);
  }

  // Publishing is the moment to make sure every step has a photo: fill the gaps with credited free photos.
  if (!isHost && fields.status === "published" && before !== "published") await fillPackagePhotos(supabase, result.data.id);

  revalidatePath("/catalogue");
  redirect(`/catalogue/${result.data.id}?saved=1`);
}

const departureSchema = z
  .object({
    id: z.string().uuid().optional(),
    package_id: z.string().uuid(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    capacity: z.coerce.number().int().min(0).max(500),
    itinerary_id: z.string().uuid().optional(),
    host_id: z.string().uuid().optional(),
    status: z.enum(["open", "closed", "sold_out", "cancelled"]),
  })
  .refine((d) => d.end_date >= d.start_date);

/** Deletes a date nobody has booked. A date with bookings must be cancelled instead, so those bookings keep their trip. */
export async function deleteDeparture(formData: FormData) {
  // Admins can read bookings, so the check below can be trusted. A host has none to read: their trips are unpublished.
  await requireStaff(["owner", "manager", "host"]);
  const p = z.object({ id: z.string().uuid(), package_id: z.string().uuid() }).safeParse({
    id: formData.get("id"),
    package_id: formData.get("package_id"),
  });
  if (!p.success) redirect("/catalogue");
  const back = `/catalogue/${p.data.package_id}?tab=dates`;

  const supabase = await createClient();
  const { count } = await supabase.from("bookings").select("id", { count: "exact", head: true }).eq("departure_id", p.data.id);
  if (count) redirect(`${back}&error=has_bookings`);

  const { error } = await supabase.from("departures").delete().eq("id", p.data.id);
  if (error) redirect(`${back}&error=failed`);

  revalidatePath(`/catalogue/${p.data.package_id}`);
  redirect(`${back}&saved=1`);
}

/** Adds a departure, or updates one when an id is sent. Departures are cancelled, never deleted, so bookings keep their link. */
export async function saveDeparture(formData: FormData) {
  const staff = await requireStaff([...ROLES]);
  const isHost = staff.role === "host";
  const price = isHost ? null : rupeesToPaise(formData.get("price"));
  const parsed = departureSchema.safeParse({
    id: formData.get("id") || undefined,
    package_id: formData.get("package_id"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    capacity: formData.get("capacity"),
    itinerary_id: formData.get("itinerary_id") || undefined,
    host_id: formData.get("host_id") || undefined,
    status: formData.get("status") || "open",
  });
  const pid = z.string().uuid().safeParse(formData.get("package_id"));
  if (!pid.success) redirect("/catalogue");
  if (!parsed.success || price === "invalid") redirect(`/catalogue/${pid.data}?tab=dates&error=invalid`);

  const { id, ...fields } = parsed.data;
  const row = {
    ...fields,
    itinerary_id: fields.itinerary_id ?? null,
    // The database fixes a host's own date to that host, with no price. Admins choose both.
    ...(isHost ? {} : { host_id: fields.host_id ?? null, price_override_paise: price }),
  };

  const supabase = await createClient();
  // A new date with no itinerary chosen runs the package's first one, so it never goes out without a story.
  if (!id && !row.itinerary_id) {
    const { data: first } = await supabase.from("itineraries").select("id").eq("package_id", pid.data).order("sort_order").limit(1).maybeSingle();
    row.itinerary_id = first?.id ?? null;
  }
  const { error } = id
    ? await supabase.from("departures").update(row).eq("id", id)
    : await supabase.from("departures").insert(row);
  if (error) redirect(`/catalogue/${pid.data}?tab=dates&error=failed`);

  revalidatePath(`/catalogue/${pid.data}`);
  redirect(`/catalogue/${pid.data}?tab=dates&saved=1`);
}


/** A host sends the finished trip to an admin. From then on it is locked for the host until the admin sends it back. */
export async function submitForReview(formData: FormData) {
  await requireStaff(["host"]);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/catalogue");
  const back = `/catalogue/${id.data}`;

  const supabase = await createClient();
  const [{ data: pkg }, { count: dates }, { data: itns }] = await Promise.all([
    supabase.from("packages").select("title, summary, description, review_state").eq("id", id.data).maybeSingle(),
    supabase.from("departures").select("id", { count: "exact", head: true }).eq("package_id", id.data),
    supabase.from("itineraries").select("itinerary_days(itinerary_steps(id))").eq("package_id", id.data),
  ]);
  if (!pkg) redirect("/catalogue");
  if (!["draft", "changes_requested"].includes(pkg.review_state)) redirect(`${back}?error=locked`);

  type Itn = { itinerary_days: { itinerary_steps: unknown[] }[] };
  const steps = ((itns ?? []) as unknown as Itn[]).reduce((n, i) => n + i.itinerary_days.reduce((m, d) => m + d.itinerary_steps.length, 0), 0);
  if (!pkg.summary || !pkg.description || !dates || steps < 1) redirect(`${back}?error=incomplete`);

  const { data, error } = await supabase.from("packages").update({ review_state: "submitted" }).eq("id", id.data).select("id");
  if (error || !data?.length) redirect(`${back}?error=failed`);
  revalidatePath("/catalogue");
  redirect(`${back}?submitted=1`);
}

const approveSchema = z.object({ id: z.string().uuid() });

/** An admin sets the price and publishes the trip a host submitted. */
export async function approvePackage(formData: FormData) {
  await requireStaff(["owner", "manager"]);
  const p = approveSchema.safeParse({ id: formData.get("id") });
  if (!p.success) redirect("/catalogue");
  const back = `/catalogue/${p.data.id}`;
  const price = rupeesToPaise(formData.get("price"));
  if (price === "invalid" || price === null || price < 100) redirect(`${back}?error=price_needed`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packages")
    .update({ base_price_paise: price, review_state: "approved", status: "published", review_note: null })
    .eq("id", p.data.id)
    .select("id");
  if (error || !data?.length) redirect(`${back}?error=failed`);

  await fillPackagePhotos(supabase, p.data.id);
  revalidatePath("/catalogue");
  revalidatePath("/review");
  redirect(`${back}?saved=1`);
}

/** An admin sends a submitted trip back to its host with a note on what to change. */
export async function sendBackPackage(formData: FormData) {
  await requireStaff(["owner", "manager"]);
  const p = z.object({ id: z.string().uuid(), note: z.string().trim().min(3).max(1000) }).safeParse({
    id: formData.get("id"),
    note: formData.get("note"),
  });
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/catalogue");
  if (!p.success) redirect(`/catalogue/${id.data}?error=note_needed`);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packages")
    .update({ review_state: "changes_requested", review_note: p.data.note, status: "draft" })
    .eq("id", p.data.id)
    .select("id");
  if (error || !data?.length) redirect(`/catalogue/${p.data.id}?error=failed`);
  revalidatePath("/catalogue");
  revalidatePath("/review");
  redirect(`/catalogue/${p.data.id}?saved=1`);
}


// ---------------------------------------------------------------- the trip's own photos (cover and gallery)

/** Called after the browser has uploaded a picture straight to storage. Adds it to the trip's gallery. */
export async function attachPackagePhoto(input: { packageId: string; path: string; bytes: number; alt: string }) {
  await requireStaff([...ROLES]);
  const p = z
    .object({
      packageId: z.string().uuid(),
      path: z.string().regex(/^packages\/[0-9a-f-]{36}\/[\w.-]+$/),
      bytes: z.number().int().min(0),
      alt: z.string().trim().max(200),
    })
    .safeParse(input);
  if (!p.success || !p.data.path.startsWith(`packages/${p.data.packageId}/`)) return { ok: false as const };

  const supabase = await createClient();
  const { data: media, error } = await supabase
    .from("media")
    .insert({ bucket: "public-media", path: p.data.path, kind: "image", alt: p.data.alt || null, bytes: p.data.bytes })
    .select("id")
    .maybeSingle();
  if (error || !media) return { ok: false as const };

  const { count } = await supabase.from("package_media").select("media_id", { count: "exact", head: true }).eq("package_id", p.data.packageId);
  const { error: linkError } = await supabase
    .from("package_media")
    .insert({ package_id: p.data.packageId, media_id: media.id, role: count ? "gallery" : "hero", sort_order: count ?? 0 });
  if (linkError) {
    // Do not leave a picture that belongs to nothing.
    await supabase.from("media").delete().eq("id", media.id);
    await supabase.storage.from("public-media").remove([p.data.path]);
    return { ok: false as const };
  }
  revalidatePath(`/catalogue/${p.data.packageId}`);
  return { ok: true as const };
}

const photoIds = z.object({ package_id: z.string().uuid(), media_id: z.string().uuid() });

/** Makes one picture the cover: the first one people see. */
export async function setCoverPhoto(formData: FormData) {
  await requireStaff([...ROLES]);
  const p = photoIds.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/catalogue");
  const supabase = await createClient();
  const { data: rows } = await supabase.from("package_media").select("media_id, role, sort_order").eq("package_id", p.data.package_id);
  const ordered = [...(rows ?? [])].sort((a, b) => Number(b.role === "hero") - Number(a.role === "hero") || a.sort_order - b.sort_order);
  const order = [p.data.media_id, ...ordered.map((r) => r.media_id).filter((m) => m !== p.data.media_id)];
  for (const [i, mediaId] of order.entries()) {
    await supabase
      .from("package_media")
      .update({ role: i === 0 ? "hero" : "gallery", sort_order: i })
      .eq("package_id", p.data.package_id)
      .eq("media_id", mediaId);
  }
  revalidatePath(`/catalogue/${p.data.package_id}`);
  redirect(`/catalogue/${p.data.package_id}?saved=1`);
}

/** Removes a picture from the trip, and deletes the file too when nothing else uses it. */
export async function removePackagePhoto(formData: FormData) {
  await requireStaff([...ROLES]);
  const p = photoIds.safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/catalogue");
  const back = `/catalogue/${p.data.package_id}`;
  const supabase = await createClient();

  const { data: media } = await supabase.from("media").select("bucket, path").eq("id", p.data.media_id).maybeSingle();
  const { data: gone } = await supabase.from("package_media").delete().eq("package_id", p.data.package_id).eq("media_id", p.data.media_id).select("role");
  if (!gone?.length) redirect(`${back}?error=failed`);

  const [{ count: elsewhere }, { count: inItinerary }] = await Promise.all([
    supabase.from("package_media").select("media_id", { count: "exact", head: true }).eq("media_id", p.data.media_id),
    supabase.from("itinerary_step_media").select("media_id", { count: "exact", head: true }).eq("media_id", p.data.media_id),
  ]);
  if (media && !elsewhere && !inItinerary) {
    await supabase.storage.from(media.bucket).remove([media.path]);
    await supabase.from("media").delete().eq("id", p.data.media_id);
  }

  // If the cover went, the next picture becomes the cover.
  if (gone[0].role === "hero") {
    const { data: next } = await supabase.from("package_media").select("media_id").eq("package_id", p.data.package_id).order("sort_order").limit(1).maybeSingle();
    if (next) await supabase.from("package_media").update({ role: "hero" }).eq("package_id", p.data.package_id).eq("media_id", next.media_id);
  }
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}
