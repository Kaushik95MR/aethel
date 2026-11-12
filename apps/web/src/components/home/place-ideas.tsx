import Image from "next/image";
import Link from "next/link";
import { photoFor } from "@/lib/photos";

// Places to start from. Each opens a search for that place; when no trip is listed the page offers to plan one.
const PLACES = [
  { name: "Kerala", photo: "kerala" },
  { name: "Ladakh", photo: "ladakh" },
  { name: "Himachal", photo: "himachal" },
  { name: "Goa", photo: "goa" },
  { name: "Rajasthan", photo: "rajasthan" },
  { name: "Varanasi", photo: "varanasi" },
  { name: "Hampi", photo: "hampi" },
  { name: "Amritsar", photo: "golden-temple" },
  { name: "Sikkim", photo: "gurudongmar" },
  { name: "Uttarakhand", photo: "chaukhamba" },
];

export function PlaceIdeas() {
  return (
    <section aria-labelledby="places" className="mx-auto max-w-[88rem] px-5 py-14 sm:px-8 sm:py-20">
      <h2 id="places" className="font-display text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] text-ink">
        Explore by place
      </h2>
      <ul className="-mx-2 mt-6 flex gap-5 overflow-x-auto px-2 pb-3 pt-2 [scrollbar-width:thin]">
        {PLACES.map((p) => {
          const photo = photoFor(p.photo);
          return (
            <li key={p.name} className="shrink-0">
              <Link href={`/packages?q=${encodeURIComponent(p.name)}`} className="group flex w-28 flex-col items-center gap-3 sm:w-32">
                <span className="relative size-28 overflow-hidden rounded-full bg-shola ring-4 ring-white shadow-md shadow-ink/15 transition-shadow group-hover:ring-primary sm:size-32">
                  {photo && <Image src={photo.src} alt="" fill sizes="192px" quality={80} className="object-cover transition-transform duration-500 group-hover:scale-110" />}
                </span>
                <span className="text-center text-lg text-ink">{p.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
