import type { Metadata } from "next";
import Link from "next/link";
import { CallbackForm } from "@/components/callback-form";
import { PageShell } from "@/components/page-shell";
import { getPackages } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Contact", description: "Leave your number and a travel planner will call you back." };

export default async function ContactPage() {
  const packages = await getPackages();
  return (
    <PageShell title="Contact" intro="Questions about a trip? Leave your number and a planner will call you back.">
      <CallbackForm trips={packages.map((p) => ({ slug: p.slug, title: p.title }))} />
      <h2 style={{ marginTop: 64 }}>Ready to book?</h2>
      <p>
        Pick a trip and a date, then ask for your seat. <Link href="/packages">See trips</Link>.
      </p>
      <p>Based in Bengaluru, India.</p>
    </PageShell>
  );
}
