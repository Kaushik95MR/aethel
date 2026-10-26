import Image from "next/image";
import Link from "next/link";
import type { PackageCard, UpcomingDeparture } from "@/lib/catalogue";
import { formatDate, formatPaise } from "@/lib/format";
import { packagePhoto } from "@/lib/photos";

// The tour packages, one large card each. Today there is a single package, so the card is wide and photo-led;
// more packages stack below it in the same format.
export function TourPackages({ packages, departures }: { packages: PackageCard[]; departures: UpcomingDeparture[] }) {
  return (
    <section id="tours" className="mx-auto max-w-[88rem] scroll-mt-16 px-5 py-28 sm:px-8 sm:py-40">
      <h2 className="font-display text-[clamp(3rem,8vw,7.5rem)] text-ink">Tour packages</h2>
      <p className="mt-5 max-w-lg text-lg text-ink">Everything is included, from the bus in Bengaluru to the campfire on Saturday night.</p>

      <ul className="mt-14 flex flex-col gap-10">
        {packages.map((p) => {
          const photo = packagePhoto(p.slug, p.cover);
          const next = departures.find((d) => d.slug === p.slug);
          return (
            <li key={p.id}>
              <Link href={`/packages/${p.slug}`} className="group grid overflow-hidden bg-ink text-background lg:grid-cols-12">
                <div className="relative aspect-[4/3] bg-shola lg:col-span-7 lg:aspect-auto lg:min-h-[32rem]">
                  {photo && (
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      sizes="(min-width: 1024px) 58vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <div className="flex flex-col justify-between gap-10 p-6 sm:p-10 lg:col-span-5">
                  <div>
                    <p className="text-background/80">{p.duration_days} days from Bengaluru</p>
                    <h3 className="mt-3 font-display text-[clamp(2.4rem,4.5vw,4rem)]">{p.title}</h3>
                    {p.summary && <p className="mt-5 max-w-md text-lg text-background">{p.summary}</p>}
                    <dl className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-background/80">The weekend</dt>
                        <dd className="mt-1 text-lg">Friday night bus, Saturday summit, Sunday home</dd>
                      </div>
                      <div>
                        <dt className="text-background/80">Next Friday out</dt>
                        <dd className="mt-1 text-lg">
                          {next ? `${formatDate(next.start_date)}${next.seats_left !== null ? `, ${next.seats_left} seats left` : ""}` : "Dates coming soon"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-5">
                    <p className="text-lg">
                      <span className="font-display text-4xl">{formatPaise(p.base_price_paise)}</span>
                      <span className="ml-2 text-background/80">per person</span>
                    </p>
                    <span className="rounded-full bg-primary px-7 py-3.5 text-lg font-medium text-primary-foreground transition-opacity group-hover:opacity-90">
                      View the trek
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
        {packages.length === 0 && <li className="text-lg text-muted-foreground">Tours are being added. Tell us what you&apos;re after and we&apos;ll plan it.</li>}
      </ul>
    </section>
  );
}
