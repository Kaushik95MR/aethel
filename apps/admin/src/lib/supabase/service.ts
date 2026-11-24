import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * A client with the database's service key. It skips every access rule, so it is used only inside server actions
 * that first check the caller is an admin, and only to create or repair sign-in accounts.
 * The key lives in apps/admin/.env.local as SUPABASE_SERVICE_ROLE_KEY and is never sent to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in apps/admin/.env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const serviceKeyConfigured = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
