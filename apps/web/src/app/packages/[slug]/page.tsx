import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoCredit } from "@/components/photo-credit";
import { TrekStory } from "@/components/trek/trek-story";
import { isTrek } from "@/lib/treks";
import { getPackage, getPackages } from "@/lib/catalogue";
import { formatDate, formatPaise } from "@/lib/format";
import { photoFor } from "@/lib/photos";

export async function generateStaticParams() {
  const packages = await getPackages();
  return packages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/packages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackage(slug);
  if (!pkg) return {};
  return { title: pkg.seo_title ?? pkg.title, description: pkg.seo_description ?? pkg.summary ?? undefined };
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function PackagePage({ params }: PageProps<"/packages/[slug]">) {
  const { slug } = await params;
  const pkg = await getPackage(slug);
  if (!pkg) notFound();
  if (isTrek(slug)) return <TrekStory pkg={pkg} />;
  const photo = photoFor(pkg.cover);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-28">
      <Link href="/packages" className="text-sm text-link underline">
        All packages
      </Link>
      {photo && (
        <div className="relative mt-4 aspect-[21/9] overflow-hidden rounded-2xl border border-line">
          <Image src={photo.src} alt={`${pkg.title}`} fill priority sizes="(min-width: 1152px) 1152px, 100vw" className="object-cover" />
        </div>
      )}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <article>
          <p className="text-xs text-muted-foreground">
            {pkg.duration_days} days
            {pkg.destinations.length > 0 && ` · ${pkg.destinations.map((d) => d.name).join(", ")}`}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">{pkg.title}</h1>
          {pkg.summary && <p className="mt-3 text-lg">{pkg.summary}</p>}
          {pkg.description && <p className="mt-4 max-w-2xl text-muted-foreground">{pkg.description}</p>}

          {pkg.highlights.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {pkg.highlights.map((h) => (
                <li key={h} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
                  {h}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-10 font-display text-2xl font-semibold">Day by day</h2>
          <ol className="mt-4 space-y-4">
            {pkg.days.map((d) => (
              <li key={d.day_no} className="rounded-xl border border-line bg-surface p-4">
                <p className="text-xs text-muted-foreground">
                  Day {d.day_no}
                  {d.location ? ` · ${d.location}` : ""}
                </p>
                <p className="mt-1 font-medium">{d.title}</p>
                {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
              </li>
            ))}
            {pkg.days.length === 0 && <li className="text-muted-foreground">The detailed itinerary is shared when you enquire.</li>}
          </ol>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <List title="Included" items={pkg.inclusions} />
            <List title="Not included" items={pkg.exclusions} />
          </div>
        </article>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-20">
          <p className="text-sm text-muted-foreground">From</p>
          <p className="font-display text-3xl font-semibold">{formatPaise(pkg.base_price_paise)}</p>
          {pkg.price_note && <p className="text-sm text-muted-foreground">{pkg.price_note}</p>}

          {pkg.departures.length > 0 && (
            <>
              <h2 className="mt-5 font-medium">Upcoming departures</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {pkg.departures.map((d) => (
                  <li key={d.id} className="flex justify-between">
                    <span>{formatDate(d.start_date)}</span>
                    {d.seats_left !== null && (
                      <span className="text-muted-foreground">{d.seats_left > 0 ? `${d.seats_left} seats left` : "Sold out"}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <Link
            href={`/enquire?package=${pkg.slug}`}
            className="mt-6 block rounded-full bg-brand px-5 py-3 text-center text-brand-ink hover:opacity-90"
          >
            Enquire about this trip
          </Link>
        </aside>
      </div>
      {photo && <PhotoCredit photo={photo} />}
    </div>
  );
}
