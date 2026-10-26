import Link from "next/link";
import { Departures } from "@/components/departures";
import { Hero } from "@/components/hero";
import { TourPackages } from "@/components/tour-packages";
import { getPackages, getUpcomingDepartures } from "@/lib/catalogue";

export default async function Home() {
  const [packages, departures] = await Promise.all([getPackages(), getUpcomingDepartures(6)]);

  return (
    <>
      <Hero />

      <TourPackages packages={packages} departures={departures} />

      <Departures items={departures} />

      <section className="mx-auto max-w-[88rem] px-5 pb-28 sm:px-8 sm:pb-40">
        <h2 className="max-w-[14ch] font-display text-[clamp(3rem,9vw,8rem)] text-ink">Tell us where you want to walk</h2>
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Link
            href="/enquire"
            className="inline-block rounded-full bg-primary px-8 py-4 text-lg font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Plan my trip
          </Link>
        </div>
      </section>
    </>
  );
}
