import { z } from "zod";

// Checks shared by sign-up, the profile form and the enquiry form. Run on the server.

export const nameField = z.string().trim().min(2, "Enter your name").max(80, "That name is too long");

export const phoneField = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+()\-\s]+$/, "Enter a valid mobile number")
  .refine((v) => {
    const n = v.replace(/\D/g, "").length;
    return n >= 10 && n <= 13;
  }, "Enter a 10-digit mobile number");

/** Accepts "meera.wanders", "@meera.wanders" or a profile link, and keeps just the username. */
export const instagramField = z
  .string()
  .trim()
  .transform((v) =>
    v
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@/, "")
      .replace(/[/?#].*$/, ""),
  )
  .pipe(z.string().regex(/^[A-Za-z0-9._]{1,30}$/, "Enter your Instagram username, like meera.wanders"));

function ageOn(dob: string, today = new Date()): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age -= 1;
  return age;
}

export const dobField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth")
  .refine((v) => !Number.isNaN(Date.parse(v)) && ageOn(v) < 110, "Enter a valid date of birth")
  .refine((v) => ageOn(v) >= 18, "You need to be 18 or older to join a trip");

/** Only a path on this site, so a "next" link can never send someone elsewhere. */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/account"): string {
  // Browsers read a backslash as a slash, so "/\evil.com" would leave the site. Reject it, control characters and "//".
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if ([...value].some((c) => c.charCodeAt(0) < 32)) return fallback;
  try {
    const u = new URL(value, "http://localhost");
    return u.origin === "http://localhost" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

export function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}
