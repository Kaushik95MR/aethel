"use server";

import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient, serviceKeyConfigured } from "@/lib/supabase/service";

const ROLES = ["owner", "manager", "content_editor", "host"] as const;
const uuid = z.string().uuid();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** "@name", "instagram.com/name/" or "name" all become "name". Blank means no Instagram. */
function cleanInstagram(v: FormDataEntryValue | null): string | undefined | "invalid" {
  const raw = String(v ?? "")
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
  if (!raw) return undefined;
  return /^[A-Za-z0-9._]{1,30}$/.test(raw) ? raw : "invalid";
}

/** Vibes are typed one per line or separated by commas. */
const vibesOf = (v: FormDataEntryValue | null) =>
  [
    ...new Set(
      String(v ?? "")
        .split(/[\n,]/)
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);

const hostSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  tagline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1500).optional(),
  city: z.string().trim().max(80).optional(),
  status: z.enum(["draft", "published", "archived"]),
  sort_order: z.coerce.number().int().min(0).max(999),
});

/** Adds a host, or updates one when an id is sent. */
export async function saveHost(formData: FormData) {
  const staff = await requireStaff([...ROLES]);
  const isHost = staff.role === "host";
  const name = String(formData.get("name") ?? "");
  const instagram = cleanInstagram(formData.get("instagram"));
  const parsed = hostSchema.safeParse({
    id: formData.get("id") || undefined,
    name,
    slug: String(formData.get("slug") ?? "").trim() || slugify(name) || undefined,
    tagline: formData.get("tagline") || undefined,
    bio: formData.get("bio") || undefined,
    city: formData.get("city") || undefined,
    // The database keeps a host's own status, web address and order as they were; these values are placeholders.
    status: isHost ? "draft" : formData.get("status"),
    sort_order: formData.get("sort_order") || 0,
  });
  if (isHost && !(parsed.success && parsed.data.id)) redirect("/catalogue");
  const back = parsed.success && parsed.data.id ? `/hosts/${parsed.data.id}` : "/hosts/new";
  if (!parsed.success || instagram === "invalid") redirect(`${back}?error=invalid`);

  const { id, ...fields } = parsed.data;
  const row = {
    ...fields,
    tagline: fields.tagline ?? null,
    bio: fields.bio ?? null,
    city: fields.city ?? null,
    instagram: instagram ?? null,
    vibes: vibesOf(formData.get("vibes")),
    // Anyone saved through this form is a real person, not one of the placeholder hosts.
    is_sample: false,
  };

  const supabase = await createClient();
  const result = id
    ? await supabase.from("hosts").update(row).eq("id", id).select("id").maybeSingle()
    : await supabase.from("hosts").insert(row).select("id").maybeSingle();
  if (result.error?.code === "23505") redirect(`${back}?error=slug_taken`);
  if (result.error || !result.data) redirect(`${back}?error=failed`);

  revalidatePath("/hosts");
  redirect(`/hosts/${result.data.id}?saved=1`);
}

/** Called after the browser has uploaded the photo straight to storage. Links it to the host and tidies up the old one. */
export async function setHostPhoto(input: { hostId: string; path: string; bytes: number; alt: string }) {
  await requireStaff([...ROLES]);
  const p = z
    .object({
      hostId: uuid,
      path: z.string().regex(/^hosts\/[0-9a-f-]{36}\/[\w.-]+$/),
      bytes: z.number().int().min(0),
      alt: z.string().trim().max(200),
    })
    .safeParse(input);
  if (!p.success || !p.data.path.startsWith(`hosts/${p.data.hostId}/`)) return { ok: false as const };

  const supabase = await createClient();
  const { data: host } = await supabase.from("hosts").select("photo_media_id").eq("id", p.data.hostId).maybeSingle();
  if (!host) return { ok: false as const };

  const { data: media, error } = await supabase
    .from("media")
    .insert({ bucket: "public-media", path: p.data.path, kind: "image", alt: p.data.alt || null, bytes: p.data.bytes })
    .select("id")
    .maybeSingle();
  if (error || !media) return { ok: false as const };

  const { error: linkError } = await supabase.from("hosts").update({ photo_media_id: media.id }).eq("id", p.data.hostId);
  if (linkError) return { ok: false as const };

  await dropMedia(supabase, host.photo_media_id);
  revalidatePath("/hosts");
  return { ok: true as const };
}

export async function removeHostPhoto(formData: FormData) {
  await requireStaff([...ROLES]);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect("/hosts");
  const supabase = await createClient();
  const { data: host } = await supabase.from("hosts").select("photo_media_id").eq("id", id.data).maybeSingle();
  await supabase.from("hosts").update({ photo_media_id: null }).eq("id", id.data);
  await dropMedia(supabase, host?.photo_media_id ?? null);
  revalidatePath("/hosts");
  redirect(`/hosts/${id.data}?saved=1`);
}

/** Deleting a host keeps every trip date: the date simply has no host until you choose one. */
export async function deleteHost(formData: FormData) {
  await requireStaff(["owner", "manager"]);
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect("/hosts");
  const supabase = await createClient();
  const { data: host } = await supabase.from("hosts").select("photo_media_id").eq("id", id.data).maybeSingle();
  const { error } = await supabase.from("hosts").delete().eq("id", id.data);
  if (error) redirect(`/hosts/${id.data}?error=failed`);
  await dropMedia(supabase, host?.photo_media_id ?? null);
  revalidatePath("/hosts");
  redirect("/hosts?deleted=1");
}

async function dropMedia(supabase: Awaited<ReturnType<typeof createClient>>, mediaId: string | null) {
  if (!mediaId) return;
  const { data: m } = await supabase.from("media").select("bucket, path").eq("id", mediaId).maybeSingle();
  if (!m) return;
  await supabase.storage.from(m.bucket).remove([m.path]);
  await supabase.from("media").delete().eq("id", mediaId);
}


// ---------------------------------------------------------------- host logins (admin only)

export type LoginState = { ok: boolean; error?: string; email?: string; password?: string; hostId?: string };

/** A temporary password the admin passes on. The host must replace it on first sign-in. */
const tempPassword = () => randomBytes(12).toString("base64url");

const accountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  hostId: uuid.optional(),
});

/** Creates a host's sign-in (and their profile, unless one exists) and returns the temporary password once. */
export async function createHostAccount(_prev: LoginState, formData: FormData): Promise<LoginState> {
  await requireStaff(["owner", "manager"]);
  if (!serviceKeyConfigured()) return { ok: false, error: "The service key is not set up yet. See the note above the form." };
  const parsed = accountSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    hostId: formData.get("host_id") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Enter the host's name and a valid email address." };
  const { name, email, hostId } = parsed.data;

  const service = createServiceClient();
  const supabase = await createClient();

  // An existing profile can get a login only once.
  if (hostId) {
    const { data: h } = await supabase.from("hosts").select("staff_id").eq("id", hostId).maybeSingle();
    if (!h) return { ok: false, error: "That host could not be found." };
    if (h.staff_id) return { ok: false, error: "This host already has a login." };
  }

  const password = tempPassword();
  const { data: created, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { must_change_password: true, full_name: name },
  });
  if (error || !created.user) {
    const taken = /already|registered|exists/i.test(error?.message ?? "");
    return { ok: false, error: taken ? "Someone already has a login with that email." : "Couldn't create the login. Try again." };
  }
  const userId = created.user.id;
  const undo = async () => {
    await service.auth.admin.deleteUser(userId);
  };

  const { error: staffError } = await service.from("staff").insert({ id: userId, full_name: name, role: "host", active: true });
  if (staffError) {
    await undo();
    return { ok: false, error: "Couldn't create the login. Try again." };
  }

  let id = hostId;
  if (id) {
    const { error: linkError } = await service.from("hosts").update({ staff_id: userId }).eq("id", id).is("staff_id", null);
    if (linkError) {
      await undo();
      return { ok: false, error: "Couldn't link the login to the host. Try again." };
    }
  } else {
    const base = slugify(name) || "host";
    for (const slug of [base, `${base}-${randomBytes(2).toString("hex")}`]) {
      const { data, error: insertError } = await service
        .from("hosts")
        .insert({ slug, name, staff_id: userId, status: "draft", is_sample: false })
        .select("id")
        .maybeSingle();
      if (data) {
        id = data.id;
        break;
      }
      if (insertError?.code !== "23505") break;
    }
    if (!id) {
      await undo();
      return { ok: false, error: "Couldn't create the host profile. Try again." };
    }
  }

  revalidatePath("/hosts");
  return { ok: true, email, password, hostId: id };
}

/** A new temporary password for a host who is locked out. They choose their own again on the next sign-in. */
export async function resetHostPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  await requireStaff(["owner", "manager"]);
  if (!serviceKeyConfigured()) return { ok: false, error: "The service key is not set up yet." };
  const id = uuid.safeParse(formData.get("host_id"));
  if (!id.success) return { ok: false, error: "That host could not be found." };

  const supabase = await createClient();
  const { data: h } = await supabase.from("hosts").select("staff_id").eq("id", id.data).maybeSingle();
  if (!h?.staff_id) return { ok: false, error: "This host has no login yet." };

  const password = tempPassword();
  const { data, error } = await createServiceClient().auth.admin.updateUserById(h.staff_id, {
    password,
    user_metadata: { must_change_password: true },
  });
  if (error || !data.user) return { ok: false, error: "Couldn't reset the password. Try again." };
  return { ok: true, email: data.user.email ?? undefined, password, hostId: id.data };
}

/** Removes the host's authenticator so they set up a new one at their next sign-in (for example after losing a phone). */
export async function resetHostMfa(formData: FormData) {
  await requireStaff(["owner", "manager"]);
  const id = uuid.safeParse(formData.get("host_id"));
  if (!id.success || !serviceKeyConfigured()) redirect("/hosts");
  const supabase = await createClient();
  const { data: h } = await supabase.from("hosts").select("staff_id").eq("id", id.data).maybeSingle();
  if (!h?.staff_id) redirect(`/hosts/${id.data}?error=failed`);

  const service = createServiceClient();
  const { data: factors, error } = await service.auth.admin.mfa.listFactors({ userId: h.staff_id });
  if (error) redirect(`/hosts/${id.data}?error=failed`);
  for (const f of factors?.factors ?? []) await service.auth.admin.mfa.deleteFactor({ id: f.id, userId: h.staff_id });
  redirect(`/hosts/${id.data}?saved=1`);
}

/** Turns a host's login off or on. A host with the login off cannot sign in or see anything. */
export async function setHostLoginActive(formData: FormData) {
  await requireStaff(["owner", "manager"]);
  const p = z.object({ host_id: uuid, active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!p.success || !serviceKeyConfigured()) redirect("/hosts");
  const supabase = await createClient();
  const { data: h } = await supabase.from("hosts").select("staff_id").eq("id", p.data.host_id).maybeSingle();
  if (!h?.staff_id) redirect(`/hosts/${p.data.host_id}?error=failed`);
  const { error } = await createServiceClient().from("staff").update({ active: p.data.active === "true" }).eq("id", h.staff_id);
  if (error) redirect(`/hosts/${p.data.host_id}?error=failed`);
  revalidatePath("/hosts");
  redirect(`/hosts/${p.data.host_id}?saved=1`);
}
