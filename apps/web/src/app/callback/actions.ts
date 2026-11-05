"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { categoriesOf } from "@/lib/categories";
import { createServiceClient } from "@/lib/service-client";

export type CallbackState = { ok: boolean; error?: string; fieldErrors?: Record<string, string> };

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a 10-digit mobile number"),
  package: z.string().trim().max(120),
});

// Best-effort limiter, per server instance only. Real protection (Turnstile and a shared store) is still to add.
const hits = new Map<string, number[]>();
function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 4;
}

/** A visitor leaves a name and number on a trip card and a planner rings back. It lands in Enquiries as source "callback". */
export async function requestCallback(_prev: CallbackState, formData: FormData): Promise<CallbackState> {
  // Honeypot: people never fill this hidden field. Pretend success so bots don't adapt.
  if (formData.get("website")) return { ok: true };

  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    package: formData.get("package") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, fieldErrors };
  }
  const v = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) return { ok: false, error: "Too many requests from this connection. Please try again later, or call us." };

  try {
    const db = createServiceClient();
    let packageId: string | null = null;
    let tripType: string | null = null;
    if (v.package) {
      const { data } = await db.from("packages").select("id, tags").eq("slug", v.package).eq("status", "published").maybeSingle();
      packageId = data?.id ?? null;
      tripType = categoriesOf(data?.tags)[0]?.slug ?? null;
    }
    const { error } = await db.from("enquiries").insert({
      name: v.name,
      phone: v.phone,
      package_id: packageId,
      trip_type: tripType,
      message: "Asked for a callback from the website.",
      source: "callback",
      consent_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("Callback request failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "Something went wrong. Please try again, or call us." };
  }
  return { ok: true };
}
