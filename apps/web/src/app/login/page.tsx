import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { safeNext } from "@/lib/profile";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-md px-5 pb-16 pt-10">
      <h1 className="font-display text-[clamp(2.4rem,6vw,3.6rem)]">Log in</h1>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await getAccount()) redirect(next);
  return <LoginForm next={next} />;
}
