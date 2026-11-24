import type { Metadata } from "next";
import { Suspense } from "react";
import { getAccount } from "@/lib/auth";
import { getPackage } from "@/lib/catalogue";
import { categoriesOf, categoryBySlug } from "@/lib/categories";
import { EnquiryForm } from "./enquiry-form";

export const metadata: Metadata = { title: "Ask for a seat" };

export default function EnquirePage({ searchParams }: PageProps<"/enquire">) {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-10">
      <h1 className="font-display text-4xl font-semibold">Ask for a seat</h1>
      <p className="mt-2 text-muted-foreground">Tell us a little and we&apos;ll confirm your seat.</p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/enquire">["searchParams"] }) {
  const sp = await searchParams;
  const slug = typeof sp.package === "string" ? sp.package : "";
  const pkg = slug ? await getPackage(slug) : null;
  // A trip's own category wins over the one in the link, so the form never contradicts the trip.
  const type = categoryBySlug(typeof sp.type === "string" ? sp.type : null)?.slug ?? categoriesOf(pkg?.tags)[0]?.slug ?? "";
  const place = typeof sp.destination === "string" ? sp.destination.slice(0, 100) : "";
  // A date from a trip's "I'm in" button, but only one of that trip's real open dates.
  const date = typeof sp.date === "string" && pkg?.departures.some((d) => d.start_date === sp.date) ? sp.date : "";
  // Someone who is logged in doesn't retype their details.
  const account = await getAccount();
  const prefill = { name: account?.profile?.full_name ?? account?.name ?? "", email: account?.email ?? "", phone: account?.profile?.phone ?? "" };
  return (
    <EnquiryForm
      packageSlug={pkg ? slug : ""}
      packageTitle={pkg?.title ?? null}
      tripType={type}
      place={place}
      startDate={date}
      prefill={prefill}
      signedIn={!!account}
    />
  );
}
