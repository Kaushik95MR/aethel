import Image from "next/image";
import Link from "next/link";
import type { Destination } from "@/lib/catalogue";
import { photoFor } from "@/lib/photos";

export function DestinationCard({
  destination: d,
  priority = false,
  wide = false,
}: {
  destination: Destination;
  priority?: boolean;
  wide?: boolean;
}) {
  const photo = photoFor(d.slug);
  return (
    <Link
      href={`/destinations/${d.slug}`}
      className={`group relative block overflow-hidden rounded-sm bg-shola ${wide ? "aspect-[4/3]" : "aspect-[4/5]"}`}
    >
      {photo && (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          priority={priority}
          sizes={wide ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 640px) 33vw, 100vw"}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-background">
        <p className="text-sm text-background/85">{d.region ?? d.country}</p>
        <p className="font-display text-4xl">{d.name}</p>
      </div>
    </Link>
  );
}
