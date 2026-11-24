"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type CatalogueTrip = {
  slug: string;
  title: string;
  photo: { src: string; alt: string } | null;
  badge: string | null;
  duration: string;
  dates: string;
  host: string | null;
  seats: string | null;
  highlights: string[];
  party: string | null;
  price: string;
  categories: string[];
};

/** The trip catalogue: a row of cards with filter tabs. The tabs only appear once there is more than one category to choose. */
export function TripCatalogue({ trips, tabs }: { trips: CatalogueTrip[]; tabs: { slug: string; label: string }[] }) {
  const [active, setActive] = useState("all");
  const shown = active === "all" ? trips : trips.filter((t) => t.categories.includes(active));

  return (
    <div>
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Filter trips" className="tabs">
          {[{ slug: "all", label: "All" }, ...tabs].map((t) => (
            <button key={t.slug} role="tab" type="button" aria-selected={active === t.slug} onClick={() => setActive(t.slug)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <ul className="cards">
        {shown.map((t, i) => (
          <li key={t.slug}>
            <Link href={`/packages/${t.slug}`} className="card">
              <span className="pic">
                {t.photo && (
                  <Image
                    src={t.photo.src}
                    alt={t.photo.alt}
                    fill
                    priority={i === 0}
                    quality={75}
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    style={{ objectFit: "cover" }}
                  />
                )}
                {t.badge && <span className="badge">{t.badge}</span>}
              </span>
              <span className="txt">
                <span className="meta">{t.duration}</span>
                <span className="ttl">{t.title}</span>
                <span className="meta">
                  {t.dates}
                  {t.host ? `. Host: ${t.host}` : ""}
                  {t.seats ? `. ${t.seats}` : ""}
                </span>
                {t.highlights.filter((h) => h !== t.party).length > 0 && (
                  <ul className="hl">
                    {t.highlights.filter((h) => h !== t.party).slice(0, 3).map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
                {t.party && (
                  <span className="party">
                    <b>The party</b> {t.party}
                  </span>
                )}
                <span className="price">From {t.price}</span>
                <span className="go">View and book</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p>No trips here yet.</p>}
    </div>
  );
}
