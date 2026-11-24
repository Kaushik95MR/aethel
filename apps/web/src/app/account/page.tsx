import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-10 sm:px-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading your account…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

type BookingRow = { reference: string; status: string; start_date: string | null; title: string | null; package: { slug: string; title: string } | null };
type EnquiryRow = { id: string; status: string; preferred_start: string | null; package: { slug: string; title: string } | null };

const STATUS: Record<string, string> = { pending: "Waiting for payment", confirmed: "You're in", completed: "Done", cancelled: "Cancelled" };

async function Content() {
  const account = await getAccount();
  if (!account) redirect("/login?next=/account");
  const { profile } = account;
  const name = account.name ?? "there";

  if (!profile) {
    return (
      <>
        <h1 className="font-display text-[clamp(2.2rem,5vw,3.2rem)]">Finish your profile</h1>
        <p className="mt-3 text-lg text-muted-foreground">We need a few details so your host and the group know who&apos;s coming.</p>
        <div className="mt-8">
          <ProfileForm mode="complete" defaults={{ name: account.name ?? "", phone: "", instagram: "" }} />
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const [bookings, enquiries] = await Promise.all([
    supabase.from("bookings").select("reference, status, start_date, title, package:packages(slug, title)").order("start_date", { ascending: false }).limit(10),
    supabase
      .from("enquiries")
      .select("id, status, preferred_start, package:packages(slug, title)")
      .in("status", ["new", "contacted", "quoted"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const bookingRows = (bookings.data ?? []) as unknown as BookingRow[];
  const requestRows = (enquiries.data ?? []) as unknown as EnquiryRow[];

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="grid size-16 place-items-center rounded-full bg-sun font-display text-3xl text-background">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[clamp(2rem,5vw,3rem)]">Hi, {name.split(" ")[0]}</h1>
          <p className="text-lg text-muted-foreground">{account.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-full border border-cream/60 px-5 font-semibold transition-colors hover:bg-cream hover:text-background">
            Log out
          </button>
        </form>
      </div>

      <section aria-labelledby="trips" className="mt-12">
        <h2 id="trips" className="font-display text-3xl">
          Your trips
        </h2>
        {bookingRows.length === 0 && requestRows.length === 0 ? (
          <p className="mt-4 text-lg text-muted-foreground">
            Nothing yet.{" "}
            <Link href="/packages" className="text-link underline underline-offset-4">
              See upcoming trips
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {bookingRows.map((b) => (
              <li key={b.reference} className="rounded-2xl border border-border bg-card p-4">
                <p className="font-display text-xl">{b.package?.title ?? b.title ?? "Your trip"}</p>
                <p className="mt-1 text-base text-muted-foreground">
                  {b.start_date ? `${formatDate(b.start_date)} · ` : ""}
                  <span className={b.status === "confirmed" ? "text-sun" : ""}>{STATUS[b.status] ?? b.status}</span> · {b.reference}
                </p>
              </li>
            ))}
            {requestRows.map((r) => (
              <li key={r.id} className="rounded-2xl border border-dashed border-border p-4">
                <p className="font-display text-xl">{r.package?.title ?? "Your trip request"}</p>
                <p className="mt-1 text-base text-muted-foreground">
                  {r.preferred_start ? `${formatDate(r.preferred_start)} · ` : ""}We&apos;re checking your request and will be in touch.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="details" className="mt-12">
        <h2 id="details" className="font-display text-3xl">
          Your details
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          People on your trips see your first name, age and Instagram. Your phone number and birthday stay private
          {profile.date_of_birth ? ` (birthday on file: ${formatDate(profile.date_of_birth)})` : ""}.
        </p>
        <div className="mt-6">
          <ProfileForm mode="edit" defaults={{ name: profile.full_name, phone: profile.phone ?? "", instagram: profile.instagram ?? "" }} />
        </div>
      </section>
    </>
  );
}
