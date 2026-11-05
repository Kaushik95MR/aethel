import Link from "next/link";
import { PackageCard } from "@/components/package-card";
import type { PackageCard as Pkg, UpcomingDeparture } from "@/lib/catalogue";

// Trips open for booking. Search and filters live on /packages.
export function OpenTrips({ packages, departures }: { packages: Pkg[]; departures: UpcomingDeparture[] }) {
  return (
    <div className="bg-surface">
    <section className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.05] text-ink">Trips open for booking</h2>
        <Link href="/packages" className="text-lg text-link underline underline-offset-4">
          See all trips
        </Link>
      </div>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {packages.slice(0, 6).map((p) => (
          <li key={p.id}>
            <PackageCard pkg={p} next={departures.find((d) => d.slug === p.slug) ?? null} />
          </li>
        ))}
        {packages.length === 0 && <li className="text-lg text-muted-foreground">New trips are coming soon.</li>}
      </ul>
    </section>
    </div>
  );
}
