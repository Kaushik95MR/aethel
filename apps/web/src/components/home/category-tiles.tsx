import Image from "next/image";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { photoFor } from "@/lib/photos";

// Five ways to travel, each linking to the trips of that kind.
export function CategoryTiles() {
  return (
    <div>
    <section id="kinds" className="mx-auto max-w-[88rem] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
      <h2 className="max-w-[18ch] font-display text-[clamp(2.2rem,4.8vw,4.2rem)] leading-[1.05] text-ink">Who are you travelling with?</h2>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CATEGORIES.map((c) => {
          const photo = photoFor(c.photo);
          return (
            <li key={c.slug}>
              <Link href={`/packages?type=${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-shola">
                {photo && (
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    sizes="(min-width: 1280px) 38vw, (min-width: 1024px) 60vw, (min-width: 640px) 95vw, 190vw"
                    quality={80}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                )}
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-medium bg-background/90 text-ink`}>{c.short}</span>
                <div className="absolute inset-x-0 bottom-0 p-5 text-background">
                  <h3 className="font-display text-2xl leading-tight xl:text-3xl">{c.name}</h3>
                  <p className="mt-2 text-background/90">{c.blurb}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
    </div>
  );
}
