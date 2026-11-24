import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  instagram: string | null;
};

export type Account = { userId: string; email: string | null; name: string | null; profile: Profile | null };

async function hasLoginCookie(): Promise<boolean> {
  return (await cookies()).getAll().some((c) => c.name.startsWith("sb-"));
}

/**
 * The signed-in visitor and their profile, or null. Reads cookies, so call it only inside a Suspense boundary.
 * Visitors with no login cookie return at once without asking Supabase.
 */
export async function getAccount(): Promise<Account | null> {
  if (!(await hasLoginCookie())) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, date_of_birth, instagram")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const profile = (data as Profile | null) ?? null;
  const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
  return { userId: user.id, email: user.email ?? null, name: profile?.full_name ?? metaName, profile };
}

/** Just enough for the header: who is signed in, with no database lookup. */
export async function getUserLite(): Promise<{ name: string | null; email: string | null } | null> {
  if (!(await hasLoginCookie())) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null, email: user.email ?? null };
}
