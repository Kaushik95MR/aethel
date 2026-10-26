import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaForm } from "./mfa-form";

export default function MfaPage() {
  return (
    <Suspense>
      <MfaGate />
    </Suspense>
  );
}

async function MfaGate() {
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
