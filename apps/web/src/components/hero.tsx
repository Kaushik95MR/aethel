import Image from "next/image";
import { photoFor } from "@/lib/photos";
import { HeroLayer } from "./hero-layer";

// A full-bleed mountain photograph with a 3D layer drawn over it. All text is real HTML on a dark scrim.
export function Hero() {
  const photo = photoFor("hero");
  return (
    <section data-header="photo" className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink text-background">
      {photo && (
        <Image src={photo.src} alt={photo.alt} fill priority sizes="100vw" className="-z-30 object-cover object-[50%_35%]" />
      )}
      {/* Keeps the text above 4.5:1 contrast wherever it sits on the photo. */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/40" />
      <div className="-z-10">
        <HeroLayer />
      </div>

      <div className="rise relative z-10 mx-auto w-full max-w-[88rem] px-5 pb-14 pt-32 sm:px-8 sm:pb-20">
        <h1 className="max-w-[13ch] font-display text-[clamp(3.6rem,11vw,10rem)]">The trail starts before sunrise.</h1>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-md text-lg text-background">
            Weekend treks and longer trips from Bengaluru, planned and led by people who have walked them.
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <a
              href="#tours"
              className="rounded-full bg-primary px-7 py-3.5 text-lg font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              See the tours
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
