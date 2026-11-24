import Image from "next/image";
import Link from "next/link";
import { HostAvatar } from "@/components/host-avatar";
import type { UpcomingDeparture } from "@/lib/catalogue";
import { formatDay, formatPaise, seatsLabel } from "@/lib/format";

// A trip poster: one dated departure with its host. The whole card opens the trip; "I'm in" sits above that link.
export function TripCard({ trip, priority = false }: { trip: UpcomingDeparture; priority?: boolean }) {
  const seats = seatsLabel(trip.seats_left);
  const soldOut = trip.seats_left !== null && trip.seats_left <= 0;
  return (
    <article className="group relative isolate overflow-hidden rounded-[2rem] border border-border bg-card transition-transform duration-300 hover:-translate-y-1">
      <div className="relative aspect-[4/5] bg-shola">
        {trip.photo && (
          <Image
            src={trip.photo.src}
            alt={trip.photo.alt}
            fill
            priority={priority}
            quality={80}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 92vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
        <span className="absolute left-4 top-4 rounded-full border border-cream/70 bg-background/40 px-3.5 py-1 text-sm font-medium backdrop-blur">
          {formatDay(trip.start_date)}
        </span>
        {seats && (
          <span className={`absolute right-4 top-5 -rotate-3 rounded-lg px-3 py-1.5 text-sm font-bold shadow-lg ${soldOut ? "bg-cream text-background" : "bg-sun text-background"}`}>
            {seats}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h3 className="font-display text-3xl">
            <Link href={`/packages/${trip.slug}`} className="after:absolute after:inset-0">
              {trip.title}
            </Link>
          </h3>
          {trip.host && (
            <p className="mt-3 flex items-center gap-2.5 text-base text-cream/90">
              <HostAvatar host={trip.host} size={30} />
              Hosted by {trip.host.name}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-4 pl-5">
        <p>
          <span className="block text-sm text-muted-foreground">From</span>
          <span className="font-display text-2xl">{formatPaise(trip.base_price_paise)}</span>
        </p>
        {!soldOut && (
          <Link
            href={`/enquire?package=${trip.slug}&date=${trip.start_date}`}
            className="relative z-10 inline-flex min-h-12 items-center rounded-full bg-primary px-7 text-lg font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            I&apos;m in
          </Link>
        )}
      </div>
    </article>
  );
}
