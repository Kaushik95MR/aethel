import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MapPin, X } from "lucide-react";
import { CallbackButton } from "@/components/callback-button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { safeUrl } from "@/components/trek/chapters";
import { getItinerary, getPackage, getPackages, type ItineraryStep } from "@/lib/catalogue";
import { categoriesOf } from "@/lib/categories";
import { formatDate, formatPaise } from "@/lib/format";
import { isTrek } from "@/lib/treks";
import { tripGallery } from "@/lib/trip-gallery";

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

const KIND: Record<string, string> = {
  pickup: "Pick-up",
  travel: "Travel",
  trek: "Trek",
  activity: "Activity",
  meal: "Meal",
  stay: "Stay",
  free_time: "Free time",
  drop_off: "Drop-off",
};

/** "21:00:00" becomes "9:00 pm". */
function clock(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

function Place({ label, url }: { label: string; url: string | null }) {
  const href = safeUrl(url);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link underline underline-offset-4">
      <MapPin aria-hidden className="size-4" />
      {label}
    </a>
  ) : (
    <span>{label}</span>
  );
}

function Step({ s }: { s: ItineraryStep }) {
  const time = clock(s.start_time);
  // Steps are often titled with their own kind ("Travel"), so only show the kind when it adds something.
  const kind = KIND[s.kind] && KIND[s.kind].toLowerCase() !== s.title.trim().toLowerCase() ? KIND[s.kind] : null;
  return (
    <li className="grid grid-cols-[5.5rem_1fr] gap-x-4 border-t border-line py-4 first:border-t-0 first:pt-0">
      <span className="text-sm text-muted-foreground">{time ?? kind ?? ""}</span>
      <div>
        <p className="font-medium text-ink">
          {s.title}
          {time && kind && <span className="ml-2 text-sm font-normal text-muted-foreground">{kind}</span>}
        </p>
        {s.description && <p className="mt-1 text-muted-foreground">{s.description}</p>}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
          {s.vehicle && <span>By {s.vehicle.toLowerCase()}</span>}
          {s.location && <Place label={s.location.label} url={s.location.maps_url} />}
          {s.to_location && (
            <>
              <span aria-hidden>to</span>
              <Place label={s.to_location.label} url={s.to_location.maps_url} />
            </>
          )}
        </p>
        {s.stops.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {s.stops.map((p, i) => (
              <li key={`${p.label}-${i}`} className="flex flex-wrap gap-x-2">
                <span className="text-muted-foreground">Pick-up {i + 1}:</span>
                <Place label={p.label} url={p.maps_url} />
                {clock(p.time) && <span className="text-muted-foreground">at {clock(p.time)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default async function TripPage({ params }: PageProps<"/packages/[slug]">) {
  const { slug } = await params;
  const pkg = await getPackage(slug);
  if (!pkg) notFound();
  const itinerary = await getItinerary(slug);
  const hasStory = !!itinerary?.days.some((d) => d.steps.length) || isTrek(slug);
  const gallery = tripGallery(pkg, itinerary);
  const kinds = categoriesOf(pkg.tags);
  const next = pkg.departures[0];
  const days = itinerary?.days.some((d) => d.steps.length) ? itinerary.days : null;
  const credits = gallery.flatMap((g) => (g.credit ? [g.credit] : []));
  const enquire = `/enquire?package=${pkg.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: pkg.title,
    description: pkg.summary ?? pkg.description ?? undefined,
    touristType: kinds.map((k) => k.name),
    ...(pkg.base_price_paise !== null && {
      offers: { "@type": "Offer", price: Number(pkg.base_price_paise) / 100, priceCurrency: "INR", availability: next ? "https://schema.org/InStock" : "https://schema.org/PreOrder" },
    }),
  };

  return (
    <div className="mx-auto max-w-[88rem] px-5 pb-28 pt-28 sm:px-8 lg:pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/packages" className="underline underline-offset-4">
          All trips
        </Link>
        {kinds[0] && (
          <>
            <span aria-hidden> / </span>
            <Link href={`/packages?type=${kinds[0].slug}`} className="underline underline-offset-4">
              {kinds[0].name}
            </Link>
          </>
        )}
      </nav>

      <header className="mt-4 max-w-3xl">
        <h1 className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[1.05] text-ink">{pkg.title}</h1>
        {pkg.summary && <p className="mt-4 text-lg text-ink">{pkg.summary}</p>}
        <ul className="mt-5 flex flex-wrap gap-2 text-ink">
          <li className="rounded-full border border-ink/25 px-4 py-1.5">
            {pkg.duration_days} {pkg.duration_days === 1 ? "day" : "days"}
          </li>
          {kinds.map((k) => (
            <li key={k.slug} className="rounded-full border border-ink/25 px-4 py-1.5">
              {k.name}
            </li>
          ))}
          {pkg.destinations.map((d) => (
            <li key={d.slug} className="rounded-full border border-ink/25 px-4 py-1.5">
              {d.name}
            </li>
          ))}
        </ul>
      </header>

      {gallery.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-2">
          {gallery.map((g, i) => (
            <div
              key={g.src}
              className={`relative overflow-hidden rounded-3xl bg-shola ${i === 0 ? "col-span-2 aspect-[16/10] lg:row-span-2 lg:aspect-auto lg:min-h-[26rem]" : "aspect-[4/3]"}`}
            >
              <Image src={g.src} alt={g.alt} fill quality={i === 0 ? 90 : 75} priority={i === 0} sizes={i === 0 ? "(min-width: 1024px) 70vw, 100vw" : "(min-width: 1024px) 40vw, 80vw"} className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-14">
          {(pkg.description || pkg.highlights.length > 0) && (
            <section>
              <h2 className="font-display text-3xl text-ink">About this trip</h2>
              {pkg.description && <p className="mt-4 max-w-2xl whitespace-pre-line text-lg text-ink">{pkg.description}</p>}
              {pkg.highlights.length > 0 && (
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {pkg.highlights.map((h) => (
                    <li key={h} className="flex gap-2 text-ink">
                      <Check aria-hidden className="mt-1 size-4 shrink-0 text-link" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section id="itinerary" className="scroll-mt-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-3xl text-ink">Day by day</h2>
              {hasStory && (
                <Link href={`/packages/${pkg.slug}/story`} className="text-lg text-link underline underline-offset-4">
                  See it as a story, with sound
                </Link>
              )}
            </div>
            {days ? (
              <Accordion defaultValue={[0]} className="mt-4">
                {days.map((d, i) => (
                  <AccordionItem key={d.day_no} value={i} className="border-line">
                    <AccordionTrigger className="py-4 font-display text-2xl text-ink hover:no-underline">
                      Day {d.day_no}: {d.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      {d.summary && <p className="mb-4 text-muted-foreground">{d.summary}</p>}
                      <ul>
                        {d.steps.map((s) => (
                          <Step key={s.id} s={s} />
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : pkg.days.length > 0 ? (
              <Accordion defaultValue={[0]} className="mt-4">
                {pkg.days.map((d, i) => (
                  <AccordionItem key={d.day_no} value={i} className="border-line">
                    <AccordionTrigger className="py-4 font-display text-2xl text-ink hover:no-underline">
                      Day {d.day_no}: {d.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      {d.description && <p className="text-muted-foreground">{d.description}</p>}
                      {(d.meals || d.stay || d.location) && (
                        <p className="mt-2 text-sm text-ink">{[d.location, d.meals && `Meals: ${d.meals}`, d.stay && `Stay: ${d.stay}`].filter(Boolean).join(", ")}</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="mt-4 text-lg text-muted-foreground">The detailed plan is shared when you enquire.</p>
            )}
          </section>

          {(pkg.inclusions.length > 0 || pkg.exclusions.length > 0) && (
            <section className="grid gap-8 sm:grid-cols-2">
              {pkg.inclusions.length > 0 && (
                <div>
                  <h2 className="font-display text-3xl text-ink">Included</h2>
                  <ul className="mt-4 space-y-2">
                    {pkg.inclusions.map((x) => (
                      <li key={x} className="flex gap-2 text-ink">
                        <Check aria-hidden className="mt-1 size-4 shrink-0 text-link" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pkg.exclusions.length > 0 && (
                <div>
                  <h2 className="font-display text-3xl text-ink">Not included</h2>
                  <ul className="mt-4 space-y-2">
                    {pkg.exclusions.map((x) => (
                      <li key={x} className="flex gap-2 text-ink">
                        <X aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="font-display text-3xl text-ink">How booking works</h2>
            <ol className="mt-5 grid gap-5 sm:grid-cols-3">
              {[
                ["Ask", "Request a callback or send an enquiry. A planner replies with the plan and price."],
                ["Confirm", "Pick your date and who is travelling. We send a secure payment link."],
                ["Go", "Pay online, then we share pick-up and packing details before you leave."],
              ].map(([t, b], i) => (
                <li key={t} className="rounded-3xl bg-surface p-5">
                  <span className="font-display text-3xl text-link">{i + 1}</span>
                  <h3 className="mt-1 font-display text-xl text-ink">{t}</h3>
                  <p className="mt-1 text-muted-foreground">{b}</p>
                </li>
              ))}
            </ol>
          </section>

          {credits.length > 0 && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer underline underline-offset-4">Photo credits</summary>
              <ul className="mt-3 space-y-1">
                {credits.map((c) => (
                  <li key={c.source}>
                    <a href={c.source} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      {c.title}
                    </a>
                    , {c.author}, {c.license}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <aside className="h-fit overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-lg shadow-ink/10 lg:sticky lg:top-24">
          <p className="text-sm text-muted-foreground">From</p>
          <p className="font-display text-4xl text-ink">{formatPaise(pkg.base_price_paise)}</p>
          <p className="text-sm text-muted-foreground">{pkg.price_note ?? "per person"}</p>

          <h2 className="mt-6 font-display text-xl text-ink">Upcoming dates</h2>
          {pkg.departures.length > 0 ? (
            <ul className="mt-2 divide-y divide-line">
              {pkg.departures.map((d) => (
                <li key={d.id} className="flex justify-between gap-3 py-2 text-ink">
                  <span>{formatDate(d.start_date)}</span>
                  {d.seats_left !== null && <span className="text-muted-foreground">{d.seats_left > 0 ? `${d.seats_left} seats left` : "Sold out"}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">New dates are being added. Ask us and we&apos;ll tell you the next one.</p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={enquire}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-lg font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Plan this trip
            </Link>
            <CallbackButton slug={pkg.slug} title={pkg.title} className="inline-flex min-h-12 items-center justify-center rounded-full border border-ink px-6 text-lg font-medium text-ink transition-colors hover:bg-ink hover:text-background" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">You pay online with a secure link once we confirm your dates. Nothing is charged today.</p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-line bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <p>
          <span className="block text-xs text-muted-foreground">From</span>
          <span className="font-display text-2xl text-ink">{formatPaise(pkg.base_price_paise)}</span>
        </p>
        <Link href={enquire} className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-lg font-medium text-primary-foreground">
          Plan this trip
        </Link>
      </div>
    </div>
  );
}
