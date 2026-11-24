"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dobField, fieldErrors, instagramField, nameField, phoneField, safeNext } from "@/lib/profile";
import { createServiceClient } from "@/lib/service-client";
import { createClient } from "@/lib/supabase/server";

/** `values` echoes what was typed (never the password) so a form with an error doesn't lose it. */
export type AuthState = { ok: boolean; error?: string; notice?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

const keep = (formData: FormData, keys: string[]): Record<string, string> =>
  Object.fromEntries(keys.map((k) => [k, typeof formData.get(k) === "string" ? (formData.get(k) as string) : ""]));

// Best-effort limiter, per server instance only. Real protection (Turnstile and a shared store) is still to add.
const hits = new Map<string, number[]>();
async function limited(scope: string, max: number): Promise<boolean> {
  const h = await headers();
  const key = `${scope}:${h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

const emailField = z.string().trim().toLowerCase().max(200).email("Enter a valid email");

type ProfileInput = { name: string; phone: string; instagram: string; dob?: string };

/** Creates or updates the customer row for a login. Uses the service role: customers can't write their own row. */
async function saveProfile(authUserId: string, email: string | null, v: ProfileInput, consent: boolean) {
  const db = createServiceClient();
  const fields = {
    full_name: v.name,
    phone: v.phone,
    instagram: v.instagram,
    ...(v.dob ? { date_of_birth: v.dob } : {}),
    ...(consent ? { consent_at: new Date().toISOString() } : {}),
  };

  const { data: mine } = await db.from("customers").select("id").eq("auth_user_id", authUserId).maybeSingle();
  if (mine) {
    const { error } = await db.from("customers").update(fields).eq("id", mine.id);
    if (error) throw new Error(error.message);
    return;
  }
  // Never attach a login to a customer the staff already hold by email. Anyone can type any email at sign-up, so linking
  // would hand over that person's bookings and details. A new login gets its own row; staff can merge the two in the admin.
  const { data: taken } = email ? await db.from("customers").select("id").eq("email", email).maybeSingle() : { data: null };
  const { error } = await db.from("customers").insert({ ...fields, auth_user_id: authUserId, email: taken ? null : email });
  if (error) throw new Error(error.message);
}

const signUpSchema = z.object({
  name: nameField,
  email: emailField,
  password: z.string().min(8, "Use at least 8 characters").max(72, "That password is too long"),
  phone: phoneField,
  dob: dobField,
  instagram: instagramField,
  consent: z.literal(true, { error: "Please tick the box to continue" }),
});

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (formData.get("website")) return { ok: true }; // honeypot
  const values = keep(formData, ["name", "email", "phone", "dob", "instagram"]);
  const parsed = signUpSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    phone: formData.get("phone") ?? "",
    dob: formData.get("dob") ?? "",
    instagram: formData.get("instagram") ?? "",
    consent: formData.get("consent") === "on",
  });
  if (!parsed.success) return { ok: false, values, fieldErrors: fieldErrors(parsed.error.issues) };
  const v = parsed.data;
  if (await limited("signup", 6)) return { ok: false, values, error: "Too many sign-ups from this connection. Please try again later." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.name } } });
  if (error) {
    console.error("Sign-up failed:", error.message);
    const msg = /rate limit/i.test(error.message)
      ? "We can't send more confirmation emails right now. Please try again in a little while."
      : /invalid/i.test(error.message)
        ? "That email address doesn't look right. Please check it."
        : "We couldn't create your account. Check your details and try again.";
    return { ok: false, values, error: msg };
  }
  // An email that already has a login comes back with no identities.
  if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
    return { ok: false, values, fieldErrors: { email: "That email already has an account. Try logging in." } };
  }

  try {
    await saveProfile(data.user.id, v.email, { name: v.name, phone: v.phone, instagram: v.instagram, dob: v.dob }, true);
  } catch (e) {
    console.error("Saving profile failed:", e instanceof Error ? e.message : e);
    // The login exists, so send them to finish the profile instead of making them start again.
    if (data.session) redirect("/account");
    return { ok: false, values, error: "Your login was created but we couldn't save your details. Please log in and finish your profile." };
  }

  if (data.session) redirect(safeNext(formData.get("next")));
  return { ok: true, notice: "Check your email. We sent you a link to confirm your account, then you can log in." };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const values = keep(formData, ["email"]);
  const parsed = z.object({ email: emailField, password: z.string().min(1, "Enter your password").max(72) }).safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { ok: false, values, fieldErrors: fieldErrors(parsed.error.issues) };
  if (await limited("login", 20)) return { ok: false, values, error: "Too many attempts. Please try again later." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      ok: false,
      values,
      error: /not confirmed/i.test(error.message) ? "Confirm your email first. Check your inbox for our link." : "That email and password don't match.",
    };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

const profileSchema = z.object({ name: nameField, phone: phoneField, instagram: instagramField });
const completeSchema = profileSchema.extend({ dob: dobField, consent: z.literal(true, { error: "Please tick the box to continue" }) });

/** Edit your details. If the login has no profile yet, the same form also asks for date of birth and consent. */
export async function saveMyProfile(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const values = keep(formData, ["name", "phone", "instagram", "dob"]);
  const db = createServiceClient();
  const { data: existing } = await db.from("customers").select("id").eq("auth_user_id", user.id).maybeSingle();
  const raw = {
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    instagram: formData.get("instagram") ?? "",
    dob: formData.get("dob") ?? "",
    consent: formData.get("consent") === "on",
  };
  const parsed = existing ? profileSchema.safeParse(raw) : completeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, values, fieldErrors: fieldErrors(parsed.error.issues) };

  try {
    const v = parsed.data as ProfileInput;
    await saveProfile(user.id, user.email ?? null, { name: v.name, phone: v.phone, instagram: v.instagram, dob: existing ? undefined : v.dob }, !existing);
  } catch (e) {
    console.error("Saving profile failed:", e instanceof Error ? e.message : e);
    return { ok: false, values, error: "We couldn't save that. Please try again." };
  }
  // A new profile moves on to the account page; an edit stays put and says so.
  if (!existing) redirect("/account");
  return { ok: true, values, notice: "Saved." };
}
