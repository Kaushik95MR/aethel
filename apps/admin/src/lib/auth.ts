import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "manager" | "agent" | "content_editor" | "accounts" | "host";

/** The two kinds of people who sign in: an Admin runs the business, a Host arranges and looks after trips. */
export const roleLabel = (role: StaffRole) => (role === "host" ? "Host" : "Admin");

/**
 * Two-step sign-in with an authenticator app. On unless REQUIRE_MFA=false is set in apps/admin/.env.local.
 * Leave it on for anything that holds real customers' data.
 */
export const mfaRequired = () => process.env.REQUIRE_MFA !== "false";

/** The host profile that belongs to this login, or null. */
export const myHostId = cache(async (userId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("hosts").select("id").eq("staff_id", userId).maybeSingle();
  return data?.id ?? null;
});

export type StaffContext = {
  userId: string;
  email: string | undefined;
  fullName: string;
  role: StaffRole;
};

/**
 * Looks the signed-in person up once per request. The layout and the page both ask, so the answer is kept for the rest of
 * the request instead of calling the database again (each call costs a round trip to Supabase).
 */
const loadStaff = cache(async (): Promise<StaffContext> => {
  // Per-request data: tell Next it cannot be prepared ahead of time (this also silences a dev warning about Date.now).
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staff } = await supabase
    .from("staff")
    .select("full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!staff || !staff.active) {
    await supabase.auth.signOut();
    redirect("/login?error=not_staff");
  }

  // A host signs in the first time with a password the admin chose. They must replace it before anything else.
  if (user.user_metadata?.must_change_password === true) redirect("/password");

  if (mfaRequired()) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel !== "aal2") redirect("/mfa");
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: staff.full_name,
    role: staff.role as StaffRole,
  };
});

/**
 * Returns the signed-in, active staff member who has completed MFA, or redirects.
 * Call this at the top of every page, layout data load, and Server Action.
 */
export async function requireStaff(allowedRoles?: StaffRole[]): Promise<StaffContext> {
  const staff = await loadStaff();
  if (allowedRoles && !allowedRoles.includes(staff.role)) redirect("/?error=forbidden");
  return staff;
}
