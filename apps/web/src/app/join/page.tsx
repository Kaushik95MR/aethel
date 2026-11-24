import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { safeNext } from "@/lib/profile";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join" };

export default function JoinPage({ searchParams }: PageProps<"/join">) {
  return (
    <div className="mx-auto max-w-xl px-5 pb-16 pt-10">
      <h1 className="font-display text-[clamp(2.4rem,6vw,3.6rem)]">Join Aethel trip</h1>
      <p className="mt-3 text-lg text-muted-foreground">So your host and the group know who&apos;s coming.</p>
      <p className="mt-3 rounded-2xl border border-border bg-card px-4 py-3 text-base">
        Your phone number and birthday stay private. People on a trip you join see your first name, age and Instagram.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/join">["searchParams"] }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  if (await getAccount()) redirect(next);
  return <JoinForm next={next} />;
}
