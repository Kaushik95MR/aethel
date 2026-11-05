import Image from "next/image";
import { Search } from "lucide-react";
import { photoFor } from "@/lib/photos";

function Tile({ photo, className = "" }: { photo: string; className?: string }) {
  const p = photoFor(photo);
  return (
    <div className={`relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-shola ${className}`}>
      {p && <Image src={p.src} alt="" fill sizes="(min-width: 1024px) 60vw, 80vw" quality={90} className="object-cover" />}
    </div>
  );
}

// A full-screen opening: a big headline and search in the middle, tall photographs down both sides.
// On a phone the photographs become a row under the search.
export function HomeHero() {
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 hidden w-[24%] flex-col gap-4 py-28 pl-5 lg:flex">
        <Tile photo="ladakh" />
        <Tile photo="goa" />
        <Tile photo="nandi-hills" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[24%] flex-col gap-4 py-28 pr-5 lg:flex">
        <Tile photo="taj-mahal" />
        <Tile photo="munnar" />
        <Tile photo="kerala" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-12 pt-36 text-center sm:px-8 lg:pb-0 lg:pt-28">
        <h1 className="font-display text-[clamp(3.2rem,7.5vw,6.6rem)] leading-[1] text-ink">
          Find your next{" "}
          <span className="bg-[linear-gradient(transparent_62%,var(--sun)_62%,var(--sun)_92%,transparent_92%)] px-1">trip.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-md text-xl text-ink">Strangers, family, couples, groups and seniors.</p>

        <form action="/packages" role="search" className="mx-auto mt-10 flex max-w-2xl gap-2 rounded-full border border-ink/20 bg-surface p-2 shadow-xl shadow-ink/10 focus-within:border-ink">
          <label className="flex min-w-0 flex-1 items-center gap-3 pl-5">
            <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Search trips</span>
            <input name="q" placeholder="Where do you want to go?" autoComplete="off" className="min-h-14 w-full bg-transparent text-lg outline-none" />
          </label>
          <button type="submit" className="min-h-14 shrink-0 rounded-full bg-primary px-9 text-lg font-medium text-primary-foreground transition-opacity hover:opacity-90">
            Search
          </button>
        </form>

        <div aria-hidden className="mx-auto mt-10 grid max-w-md grid-cols-3 gap-3 lg:hidden">
          {["ladakh", "taj-mahal", "goa"].map((k) => (
            <div key={k} className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-shola">
              {photoFor(k) && <Image src={photoFor(k)!.src} alt="" fill sizes="33vw" quality={90} className="object-cover" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
