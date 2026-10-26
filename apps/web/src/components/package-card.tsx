import Image from "next/image";
import Link from "next/link";
import type { PackageCard as Pkg } from "@/lib/catalogue";
import { formatPaise } from "@/lib/format";
import { packagePhoto } from "@/lib/photos";

export function PackageCard({ pkg }: { pkg: Pkg }) {
  const photo = packagePhoto(pkg.slug, pkg.cover);
  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-brand"
    >
      <div className="relative aspect-[16/10] bg-line">
        {photo && (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/80 px-3 py-1 text-xs backdrop-blur">
          {pkg.duration_days} days{pkg.is_domestic ? "" : ", international"}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h3 className="font-display text-2xl font-semibold leading-tight group-hover:text-link">{pkg.title}</h3>
          {pkg.summary && <p className="mt-2 text-sm text-muted-foreground">{pkg.summary}</p>}
        </div>
        <p className="mt-5 text-sm">
          <span className="text-muted-foreground">From </span>
          <span className="font-medium">{formatPaise(pkg.base_price_paise)}</span>
          {pkg.price_note && <span className="text-muted-foreground">, {pkg.price_note}</span>}
        </p>
      </div>
    </Link>
  );
}
