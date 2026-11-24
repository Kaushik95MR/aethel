import Image from "next/image";
import Link from "next/link";
import { Sparkle } from "@/components/sparkle";
import type { Photo, UpcomingDeparture } from "@/lib/catalogue";
import { seatsLabel } from "@/lib/format";

const TILT = ["-rotate-3", "rotate-2", "rotate-3", "-rotate-2"];

// The opening: a big line, two buttons, and a tilted collage of photos from the next trip.
export function HomeHero({ photos, next }: { photos: Photo[]; next: UpcomingDeparture | null }) {
  const collage = photos.slice(0, 4);
  const sticker = next ? seatsLabel(next.seats_left) : null;
  return (
    <section className="hero-glow relative overflow-hidden">
      <div className="mx-auto grid max-w-[88rem] items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:pb-24 lg:pt-16">
        <div className="rise">
          <h1 className="font-display text-[clamp(2.9rem,7vw,5.9rem)]">
            Go somewhere.
            <br />
            Meet your people.
          </h1>
          <p className="mt-5 max-w-md text-xl text-muted-foreground">Trips with a real party at night.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/packages"
              className="inline-flex min-h-14 items-center rounded-full bg-primary px-8 text-lg font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              See upcoming trips
            </Link>
            <Link
              href="/hosts"
              className="inline-flex min-h-14 items-center rounded-full border border-cream/60 px-8 text-lg font-semibold transition-colors hover:bg-cream hover:text-background"
            >
              Meet the hosts
            </Link>
          </div>
        </div>

        {collage.length > 0 && (
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <Sparkle className="twinkle absolute -left-3 top-1/3 z-10 size-7" />
            <Sparkle className="twinkle absolute -right-1 bottom-6 z-10 size-9" />
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              {collage.map((p, i) => (
                <div
                  key={p.src}
                  className={`relative aspect-[4/5] overflow-hidden rounded-3xl bg-shola shadow-2xl shadow-black/40 ring-4 ring-cream/90 ${TILT[i]} ${i % 2 === 1 ? "translate-y-8" : ""}`}
                >
                  <Image
                    src={p.src}
                    alt={p.alt}
                    fill
                    priority={i < 2}
                    quality={80}
                    sizes="(min-width: 1024px) 24vw, (min-width: 640px) 36vw, 44vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
            {sticker && (
              <span className="absolute -top-4 left-2 z-10 rotate-[-8deg] rounded-xl bg-sun px-4 py-2 text-base font-bold text-background shadow-xl">
                {sticker}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
