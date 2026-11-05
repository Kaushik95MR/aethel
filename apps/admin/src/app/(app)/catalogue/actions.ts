"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { seedDefaultItinerary, syncPackageItineraries } from "@/lib/itinerary";
import { fillPackagePhotos } from "@/lib/auto-photos";
import { CATEGORY_SLUGS } from "./categories";

const ROLES = ["owner", "manager", "content_editor"] as const;

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
  description: z.string().trim().max(5000).optional(),
  duration_days: z.coerce.number().int().min(1).max(60),
  price_note: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "published", "archived"]),
  is_domestic: z.boolean(),
});

export async function savePackage(formData: FormData) {
  await requireStaff([...ROLES]);

  const base_price_paise = rupeesToPaise(formData.get("price"));
  const title = String(formData.get("title") ?? "");
  const parsed = packageSchema.safeParse({
    id: formData.get("id") || undefined,
    title,
    slug: String(formData.get("slug") ?? "").trim() || slugify(title) || undefined,
    summary: formData.get("summary") || undefined,
    description: formData.get("description") || undefined,
    duration_days: formData.get("duration_days"),
    price_note: formData.get("price_note") || undefined,
    status: formData.get("status"),
    is_domestic: formData.get("is_domestic") === "on",
  });
  const back = parsed.success && parsed.data.id ? `/catalogue/${parsed.data.id}` : "/catalogue/new";
  if (!parsed.success || base_price_paise === "invalid") redirect(`${back}?error=invalid`);

  const { id, ...fields } = parsed.data;
  const chosen = formData.getAll("categories").map(String).filter((c) => CATEGORY_SLUGS.includes(c));

  const supabase = await createClient();
  const existing = id ? (await supabase.from("packages").select("status, tags").eq("id", id).maybeSingle()).data : null;
  const before = existing?.status ?? null;
  const row = {
    ...fields,
    base_price_paise,
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
    redirect(`/catalogue/${result.data.id}?saved=1&autofill=1`);
  }

  // Publishing is the moment to make sure every step has a photo: fill the gaps with credited free photos.
  if (fields.status === "published" && before !== "published") await fillPackagePhotos(supabase, result.data.id);

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
    status: z.enum(["open", "closed", "sold_out", "cancelled"]),
  })
  .refine((d) => d.end_date >= d.start_date);

/** Deletes a date nobody has booked. A date with bookings must be cancelled instead, so those bookings keep their trip. */
export async function deleteDeparture(formData: FormData) {
  // Only roles that can read bookings may delete, so the booking check below can be trusted.
  await requireStaff(["owner", "manager"]);
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
  await requireStaff([...ROLES]);
  const price = rupeesToPaise(formData.get("price"));
  const parsed = departureSchema.safeParse({
    id: formData.get("id") || undefined,
    package_id: formData.get("package_id"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    capacity: formData.get("capacity"),
    itinerary_id: formData.get("itinerary_id") || undefined,
    status: formData.get("status") || "open",
  });
  const pid = z.string().uuid().safeParse(formData.get("package_id"));
  if (!pid.success) redirect("/catalogue");
  if (!parsed.success || price === "invalid") redirect(`/catalogue/${pid.data}?tab=dates&error=invalid`);

  const { id, ...fields } = parsed.data;
  const row = { ...fields, itinerary_id: fields.itinerary_id ?? null, price_override_paise: price };

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
