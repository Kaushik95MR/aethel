import Image from "next/image";
import Link from "next/link";
import { CallbackButton } from "@/components/callback-button";
import type { PackageCard as Pkg, UpcomingDeparture } from "@/lib/catalogue";
import { categoriesOf } from "@/lib/categories";
import { formatDate, formatPaise } from "@/lib/format";
import { packagePhoto, photoFor } from "@/lib/photos";

// One card per trip. The whole card opens the trip (a stretched link on the title); the callback button sits above it.
export function PackageCard({ pkg, next }: { pkg: Pkg; next?: UpcomingDeparture | null }) {
  const kinds = categoriesOf(pkg.tags);
  // A trip with no photo of its own borrows a scenic one for its kind, until staff add theirs.
  const photo = packagePhoto(pkg.slug, pkg.cover) ?? photoFor(kinds[0]?.photo);
  const left = next?.seats_left ?? null;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface transition-colors hover:border-ink/40">
      <div className="relative aspect-[16/10] bg-line">
        {photo && (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(min-width: 1024px) 480px, (min-width: 640px) 60vw, 100vw"
            quality={80}
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-sm text-ink">
          {pkg.duration_days} {pkg.duration_days === 1 ? "day" : "days"}
          {pkg.is_domestic ? "" : ", international"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          {kinds.length > 0 && (
            <p className="mb-2 flex flex-wrap gap-1.5">
              {kinds.map((c) => (
                <span key={c.slug} className={`rounded-full px-3 py-0.5 text-sm font-medium bg-sun text-ink`}>
                  {c.name}
                </span>
              ))}
            </p>
          )}
          <h3 className="font-display text-2xl leading-tight">
            <Link href={`/packages/${pkg.slug}`} className="after:absolute after:inset-0 group-hover:underline">
              {pkg.title}
            </Link>
          </h3>
          {pkg.summary && <p className="mt-2 line-clamp-2 text-muted-foreground">{pkg.summary}</p>}
        </div>

        <div className="mt-auto space-y-4">
          {next && (
            <p className="text-sm text-ink">
              Next trip {formatDate(next.start_date)}
              {left !== null && <span className="text-muted-foreground">{left > 0 ? `, ${left} seats left` : ", sold out"}</span>}
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p>
              <span className="block text-sm text-muted-foreground">From</span>
              <span className="font-display text-3xl">{formatPaise(pkg.base_price_paise)}</span>
              {pkg.price_note && <span className="ml-1 text-sm text-muted-foreground">{pkg.price_note}</span>}
            </p>
            <CallbackButton slug={pkg.slug} title={pkg.title} />
          </div>
        </div>
      </div>
    </article>
  );
}
