import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-less anon client for reading published catalogue data.
 * Safe in statically generated pages; RLS limits it to published rows.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
    );
  }
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
