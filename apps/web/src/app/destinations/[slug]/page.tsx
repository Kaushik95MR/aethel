import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCard } from "@/components/package-card";
import { PhotoCredit } from "@/components/photo-credit";
import { getDestination, getDestinations } from "@/lib/catalogue";
import { photoFor } from "@/lib/photos";

export async function generateStaticParams() {
  const destinations = await getDestinations();
  return destinations.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/destinations/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const dest = await getDestination(slug);
  return dest ? { title: dest.name, description: dest.summary ?? undefined } : {};
}

export default async function DestinationPage({ params }: PageProps<"/destinations/[slug]">) {
  const { slug } = await params;
  const dest = await getDestination(slug);
  if (!dest) notFound();
  const photo = photoFor(dest.slug);

  return (
    <>
      <header data-header="dark" className="relative isolate flex min-h-[46vh] items-end overflow-hidden border-b border-line">
        {photo && <Image src={photo.src} alt="" fill priority sizes="100vw" className="-z-10 object-cover" />}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/40 to-black/20" />
        <div className="mx-auto w-full max-w-6xl px-5 pb-10 pt-24">
          <Link href="/destinations" className="text-sm text-link underline">
            All destinations
          </Link>
          <h1 className="mt-3 font-display text-6xl font-bold leading-none sm:text-8xl">{dest.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {dest.region ? `${dest.region} · ` : ""}
            {dest.country}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12">
        {dest.summary && <p className="max-w-2xl text-lg">{dest.summary}</p>}

        <h2 className="mt-10 font-display text-3xl font-semibold">Trips in {dest.name}</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dest.packages.map((p) => (
            <li key={p.id}>
              <PackageCard pkg={p} />
            </li>
          ))}
          {dest.packages.length === 0 && (
            <li className="text-muted-foreground">
              No trips listed yet.{" "}
              <Link href="/enquire" className="text-link underline">
                Tell us what you have in mind.
              </Link>
            </li>
          )}
        </ul>
        {photo && <PhotoCredit photo={photo} />}
      </div>
    </>
  );
}
