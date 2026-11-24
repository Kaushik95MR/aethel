import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CallbackButton } from "@/components/callback-button";
import { Travellers } from "@/components/travellers";
import { getPackage, getPackages, type Departure } from "@/lib/catalogue";
import { categoriesOf } from "@/lib/categories";
import { dayMonth } from "@/lib/catalogue-view";
import { formatDay, formatPaise, formatTime, nightsLabel, seatsLabel } from "@/lib/format";

export async function generateStaticParams() {
  const packages = await getPackages();
  return packages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/packages/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackage(slug);
  if (!pkg) return {};
  return { title: pkg.seo_title ?? pkg.title, description: pkg.seo_description ?? pkg.summary ?? undefined };
}

const joinHref = (slug: string, d?: Departure) => `/enquire?package=${slug}${d ? `&date=${d.start_date}` : ""}`;

export default async function TripPage({ params }: PageProps<"/packages/[slug]">) {
  const { slug } = await params;
  const pkg = await getPackage(slug);
  if (!pkg) notFound();

  const next = pkg.departures[0];
  const host = next?.host ?? null;
  const kinds = categoriesOf(pkg.tags);
  const [hero, ...rest] = pkg.gallery;
  const credits = pkg.gallery.flatMap((g) => (g.credit ? [g.credit] : []));
  const placeholderPhotos = credits.some((c) => /ai-generated/i.test(c.author));
  const going = next && next.seats_left !== null ? next.capacity - next.seats_left : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: pkg.title,
    description: pkg.summary ?? pkg.description ?? undefined,
    touristType: kinds.map((k) => k.name),
    ...(pkg.base_price_paise !== null && {
      offers: { "@type": "Offer", price: Number(pkg.base_price_paise) / 100, priceCurrency: "INR", availability: next ? "https://schema.org/InStock" : "https://schema.org/PreOrder" },
    }),
  };

  return (
    <div className="gh">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="panel tphero" aria-label={pkg.title}>
        {hero && <Image src={hero.src} alt={hero.alt} fill priority quality={80} sizes="100vw" />}
        <h1 className="d">{pkg.title}</h1>
        <div className="row">
          <p className="cap">
            {next ? <b>{dayMonth(next.start_date)} to {dayMonth(next.end_date)}</b> : <b>Dates coming soon</b>}. {nightsLabel(pkg.duration_days)}. From{" "}
            {formatPaise(pkg.base_price_paise)}
            {pkg.price_note ? ` ${pkg.price_note}` : " per person"}.
            {next && seatsLabel(next.seats_left) ? ` ${seatsLabel(next.seats_left)}.` : ""}
          </p>
          <Link className="btn" href={joinHref(pkg.slug, next)}>
            Book
          </Link>
        </div>
      </section>

      <div className="tbody">
        <div className="tmain">
          {pkg.summary && (
            <section>
              <p className="tsum">{pkg.summary}</p>
            </section>
          )}

          {pkg.party && (
            <section aria-labelledby="party-h">
              <h2 id="party-h" className="d">
                The party
              </h2>
              <div className="tbox">
                <p className="tsum">{pkg.party}</p>
              </div>
            </section>
          )}

          {host && (
            <section aria-labelledby="host">
              <h2 id="host" className="d">
                Your host
              </h2>
              <div className="tbox thost">
                <span className="ph">
                  {host.photo ? <Image src={host.photo.src} alt="" fill sizes="176px" quality={80} style={{ objectFit: "cover" }} /> : host.name.slice(0, 1)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="nm">{host.name}</p>
                  {host.tagline && <p className="tg">{host.tagline}</p>}
                </div>
                <Link className="btn quiet small" href={`/hosts/${host.slug}`}>
                  See profile
                </Link>
              </div>
            </section>
          )}

          {next && (
            <section aria-labelledby="going">
              <h2 id="going" className="d">
                Who is going
              </h2>
              <div className="tbox tgoing">
                <p>
                  {going > 0 ? (
                    <>
                      <span className="n">{going} going</span>. {seatsLabel(next.seats_left)}.
                    </>
                  ) : (
                    <>
                      <span className="n">{seatsLabel(next.seats_left) ?? `${next.capacity} seats`}</span>. Be the first to book.
                    </>
                  )}
                </p>
                <Suspense fallback={null}>
                  <Travellers departureId={next.id} going={going} slug={pkg.slug} />
                </Suspense>
              </div>
            </section>
          )}

          {pkg.description && (
            <section>
              <h2 className="d">About</h2>
              <p className="tdesc">{pkg.description}</p>
              {pkg.highlights.length > 0 && (
                <ul className="thl">
                  {pkg.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {pkg.days.length > 0 && (
            <section id="plan" aria-labelledby="plan-h">
              <h2 id="plan-h" className="d">
                The plan
              </h2>
              <ol className="tplan">
                {pkg.days.map((d) => (
                  <li key={d.day_no}>
                    <span className="dn">Day {d.day_no}</span>
                    <div>
                      <h3>{d.title}</h3>
                      {d.description && <p>{d.description}</p>}
                      {(d.meals || d.stay) && <p className="ms">{[d.meals && `Meals: ${d.meals}`, d.stay && `Stay: ${d.stay}`].filter(Boolean).join(". ")}</p>}
                      {d.steps.length > 0 && (
                        <ul className="steps-list">
                          {d.steps.map((s, i) => (
                            <li key={i}>
                              <span className="when">{formatTime(s.start_time)}</span>
                              <span className="what">
                                <b>{s.title || s.kind.replace("_", " ")}</b>
                                {s.place ? <small>{s.place}</small> : null}
                                {s.description ? <small>{s.description}</small> : null}
                                {s.photos.length > 0 && (
                                  <span className="stepphotos">
                                    {s.photos.slice(0, 3).map((ph) => (
                                      <span key={ph.src} className="sp">
                                        <Image src={ph.src} alt={ph.alt} fill quality={70} sizes="(min-width: 1000px) 14vw, 30vw" style={{ objectFit: "cover" }} />
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(pkg.inclusions.length > 0 || pkg.exclusions.length > 0) && (
            <section aria-label="What is included" className="tinc">
              {pkg.inclusions.length > 0 && (
                <div>
                  <h2 className="d">Included</h2>
                  <ul>
                    {pkg.inclusions.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {pkg.exclusions.length > 0 && (
                <div>
                  <h2 className="d">Not included</h2>
                  <ul className="no">
                    {pkg.exclusions.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {rest.length > 0 && (
            <section aria-label="Photos">
              <ul className="tshots">
                {rest.map((g, i) => (
                  <li key={g.src}>
                    <Image src={g.src} alt={g.alt} fill quality={75} sizes={i === 0 ? "(min-width: 1000px) 60vw, 92vw" : "(min-width: 1000px) 30vw, 46vw"} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {credits.length > 0 &&
            (placeholderPhotos ? (
              <p className="tcredits">Photos on this page are AI-generated placeholders until we add pictures from real trips.</p>
            ) : (
              <details className="tcredits">
                <summary>Photo credits</summary>
                <p style={{ marginTop: 12, maxWidth: "62ch" }}>
                  These photographs are by other photographers, shared under open licences, and show the feel of the coast. Some are from nearby places.
                  We will add pictures from our own trips.
                </p>
                <ul>
                  {[...new Map(credits.map((c) => [c.source, c])).values()].map((c) => (
                    <li key={c.source} style={{ marginBottom: 6 }}>
                      <a href={c.source} target="_blank" rel="noopener noreferrer">
                        {c.title}
                      </a>
                      , {c.author},{" "}
                      {c.licenseUrl ? (
                        <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer">
                          {c.license}
                        </a>
                      ) : (
                        c.license
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
        </div>

        <aside className="tbook" aria-label="Book">
          <p className="from">From</p>
          <p className="d pr">{formatPaise(pkg.base_price_paise)}</p>
          <p className="from">{pkg.price_note ?? "per person"}</p>

          <h2>Pick a date</h2>
          {pkg.departures.length > 0 ? (
            <ul>
              {pkg.departures.map((d) => {
                const soldOut = d.seats_left !== null && d.seats_left <= 0;
                return (
                  <li key={d.id}>
                    <div>
                      <p className="dt">{formatDay(d.start_date)}</p>
                      <p className="sm">
                        {seatsLabel(d.seats_left)}
                        {d.host ? `. With ${d.host.name}` : ""}
                      </p>
                    </div>
                    {!soldOut && (
                      <Link className="btn small" href={joinHref(pkg.slug, d)}>
                        Book
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="sm">New dates are being added. Ask for a callback and we will tell you the next one.</p>
          )}

          <CallbackButton slug={pkg.slug} title={pkg.title} className="cb" />
          <p className="note">Nothing is charged today. We confirm your seat, then send a secure payment link.</p>
        </aside>
      </div>

      <div className="mbar">
        <p>
          <small>From</small>
          <span className="d pr">{formatPaise(pkg.base_price_paise)}</span>
        </p>
        <Link className="btn" href={joinHref(pkg.slug, next)}>
          Book
        </Link>
      </div>
    </div>
  );
}
