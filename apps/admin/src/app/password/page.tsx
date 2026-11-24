import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./password-form";

// These screens depend on who is signed in, so they cannot be prepared ahead of time. This turns off the dev-only warning about it.
export const instant = false;

export default function PasswordPage() {
  return (
    <Suspense>
      <PasswordGate />
    </Suspense>
  );
}

async function PasswordGate() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  // Nothing to change: carry on to the app, which asks for the second step if it is needed.
  if (user.user_metadata?.must_change_password !== true) redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <Brand />
      <PasswordForm />
    </main>
  );
}
