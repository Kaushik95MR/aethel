import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "owner" | "manager" | "agent" | "content_editor" | "accounts";

export type StaffContext = {
  userId: string;
  email: string | undefined;
  fullName: string;
  role: StaffRole;
};

/**
 * Returns the signed-in, active staff member who has completed MFA, or redirects.
 * Call this at the top of every page, layout data load, and Server Action.
 */
export async function requireStaff(allowedRoles?: StaffRole[]): Promise<StaffContext> {
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

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/mfa");

  if (allowedRoles && !allowedRoles.includes(staff.role as StaffRole)) {
    redirect("/?error=forbidden");
  }

  return {
    userId: user.id,
    email: user.email,
    fullName: staff.full_name,
    role: staff.role as StaffRole,
  };
}
