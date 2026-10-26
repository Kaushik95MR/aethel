import type { Metadata } from "next";
import { Suspense } from "react";
import { getPackage } from "@/lib/catalogue";
import { EnquiryForm } from "./enquiry-form";

export const metadata: Metadata = { title: "Plan my trip" };

export default function EnquirePage({ searchParams }: PageProps<"/enquire">) {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-28">
      <h1 className="font-display text-4xl font-semibold">Plan my trip</h1>
      <p className="mt-2 text-muted-foreground">Tell us a little and we&apos;ll come back with ideas and a quote.</p>
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
  return <EnquiryForm packageSlug={pkg ? slug : ""} packageTitle={pkg?.title ?? null} />;
}
