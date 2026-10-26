"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { z } from "zod";

export type EnquiryState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: z.string().trim().max(200).email("Enter a valid email").or(z.literal("")),
    phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, "Enter a valid phone number"),
    package: z.string().trim().max(120),
    destination: z.string().trim().max(160),
    start: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date"),
    flexible: z.boolean(),
    adults: z.coerce.number().int().min(1, "At least 1 adult").max(30),
    children: z.coerce.number().int().min(0).max(30),
    message: z.string().trim().max(2000),
    consent: z.literal(true, { error: "Please agree so we can contact you" }),
  })
  .refine((v) => v.email || v.phone, { path: ["email"], message: "Give an email or a phone number" });

// Best-effort limiter: per server instance only. Real protection (Turnstile + shared store) is still to add.
const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 5;
}

export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  // Honeypot: real people never fill this hidden field. Pretend success so bots don't adapt.
  if (formData.get("website")) return { ok: true };

  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    package: formData.get("package") ?? "",
    destination: formData.get("destination") ?? "",
    start: formData.get("start") ?? "",
    flexible: formData.get("flexible") === "on",
    adults: formData.get("adults") ?? 1,
    children: formData.get("children") ?? 0,
    message: formData.get("message") ?? "",
    consent: formData.get("consent") === "on",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors };
  }
  const v = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return { ok: false, error: "Too many enquiries from this connection. Please try again later." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Enquiry rejected: SUPABASE_SERVICE_ROLE_KEY is not configured.");
    return { ok: false, error: "We can't take enquiries online right now. Please call or email us." };
  }
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let packageId: string | null = null;
  if (v.package) {
    const { data } = await supabase.from("packages").select("id").eq("slug", v.package).eq("status", "published").maybeSingle();
    packageId = data?.id ?? null;
  }

  const { error } = await supabase.from("enquiries").insert({
    name: v.name,
    email: v.email || null,
    phone: v.phone || null,
    package_id: packageId,
    destination_interest: v.destination || null,
    preferred_start: v.start || null,
    flexible_dates: v.flexible,
    adults: v.adults,
    children: v.children,
    message: v.message || null,
    source: "web",
    consent_at: new Date().toISOString(),
  });
  if (error) {
    console.error("Enquiry insert failed:", error.message);
    return { ok: false, error: "Something went wrong saving your enquiry. Please try again, or call us." };
  }
  return { ok: true };
}
