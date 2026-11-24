import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { mfaRequired } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "./mfa-form";

// These screens depend on who is signed in, so they cannot be prepared ahead of time. This turns off the dev-only warning about it.
export const instant = false;

export default function MfaPage() {
  return (
    <Suspense>
      <MfaGate />
    </Suspense>
  );
}

async function MfaGate() {
  await connection();
  if (!mfaRequired()) redirect("/");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: staff } = await supabase.from("staff").select("active").eq("id", user.id).maybeSingle();
  if (!staff?.active) {
    await supabase.auth.signOut();
    redirect("/login?error=not_staff");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <MfaForm />
    </main>
  );
}
