import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PackageCard } from "@/components/package-card";
import { getPackages, getUpcomingDepartures } from "@/lib/catalogue";
import { CATEGORIES, categoryBySlug } from "@/lib/categories";
import { LENGTHS, SORTS, searchTrips, type Query } from "@/lib/search";

export const metadata: Metadata = { title: "Find a trip" };

export default function PackagesPage({ searchParams }: PageProps<"/packages">) {
  return (
    <div className="mx-auto max-w-[88rem] px-5 pb-20 pt-28 sm:px-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading trips…</p>}>
        <Trips searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 80) : "");

async function Trips({ searchParams }: { searchParams: PageProps<"/packages">["searchParams"] }) {
  const sp = await searchParams;
  const category = categoryBySlug(one(sp.type));
  const query: Query = {
    q: one(sp.q).trim(),
    type: category?.slug ?? "",
    length: LENGTHS.find((l) => l.id === one(sp.length))?.id ?? "",
    sort: SORTS.find((s) => s.id === one(sp.sort))?.id ?? "",
  };

  const [all, departures] = await Promise.all([getPackages(), getUpcomingDepartures(60)]);
  const packages = searchTrips(all, query, departures);
  const nextBySlug = new Map(departures.slice().reverse().map((d) => [d.slug, d]));

  // Links keep the other filters and change one.
  const href = (change: Partial<Query>) => {
    const next = { ...query, ...change };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/packages?${s}` : "/packages";
  };
  const chip = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-5 text-base transition-colors ${
      active ? "border-primary bg-primary text-primary-foreground" : "border-ink/30 text-ink hover:border-ink"
    }`;
  const filtered = !!(query.q || query.type || query.length);

  return (
    <>
      <h1 className="font-display text-[clamp(2.4rem,5vw,4.4rem)] leading-[1.05] text-ink">
        {category && !query.q ? category.name : query.q ? `Trips for “${query.q}”` : "Find a trip"}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-ink">
        {category && !query.q ? category.intro : "Search by place, kind of trip or activity. Every trip here is open for booking."}
      </p>

      <form action="/packages" className="mt-8 flex max-w-3xl flex-wrap gap-3" role="search">
        {query.type && <input type="hidden" name="type" value={query.type} />}
        {query.length && <input type="hidden" name="length" value={query.length} />}
        {query.sort && <input type="hidden" name="sort" value={query.sort} />}
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search trips</span>
          <input
            name="q"
            defaultValue={query.q}
            placeholder="Try Goa, trek, family or Himachal"
            className="min-h-12 w-full rounded-full border border-ink/30 bg-surface px-6 text-lg"
          />
        </label>
        <button type="submit" className="min-h-12 rounded-full bg-primary px-8 text-lg font-medium text-primary-foreground hover:opacity-90">
          Search
        </button>
      </form>

      <nav aria-label="Trip types" className="mt-6 flex flex-wrap gap-2">
        <Link href={href({ type: "" })} aria-current={!query.type ? "page" : undefined} className={chip(!query.type)}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={href({ type: c.slug })} aria-current={query.type === c.slug ? "page" : undefined} className={chip(query.type === c.slug)}>
            {c.name}
          </Link>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink">
        <span className="flex flex-wrap items-center gap-2">
          Length:
          <Link href={href({ length: "" })} className={`underline-offset-4 ${!query.length ? "font-medium underline" : "hover:underline"}`}>
            Any
          </Link>
          {LENGTHS.map((l) => (
            <Link key={l.id} href={href({ length: l.id })} className={`underline-offset-4 ${query.length === l.id ? "font-medium underline" : "hover:underline"}`}>
              {l.label}
            </Link>
          ))}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          Sort:
          {SORTS.map((s) => (
            <Link key={s.id} href={href({ sort: s.id })} className={`underline-offset-4 ${query.sort === s.id ? "font-medium underline" : "hover:underline"}`}>
              {s.label}
            </Link>
          ))}
        </span>
        {filtered && (
          <Link href="/packages" className="underline underline-offset-4">
            Clear all
          </Link>
        )}
      </div>

      <p className="mt-8 text-muted-foreground" aria-live="polite">
        {packages.length} {packages.length === 1 ? "trip" : "trips"}
      </p>
      <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => (
          <li key={p.id}>
            <PackageCard pkg={p} next={nextBySlug.get(p.slug) ?? null} />
          </li>
        ))}
      </ul>

      {packages.length === 0 && (
        <div className="max-w-xl rounded-3xl bg-surface p-8">
          <p className="font-display text-2xl text-ink">
            {query.q ? `No trips for “${query.q}” are listed yet.` : category ? `No ${category.name.toLowerCase()} are listed yet.` : "No trips match."}
          </p>
          <p className="mt-2 text-muted-foreground">Tell us what you have in mind and we&apos;ll plan it for you.</p>
          <Link
            href={`/enquire?${new URLSearchParams({ ...(query.type ? { type: query.type } : {}), ...(query.q ? { destination: query.q } : {}) }).toString()}`}
            className="mt-5 inline-flex min-h-12 items-center rounded-full bg-primary px-7 text-lg font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Plan my trip
          </Link>
        </div>
      )}
    </>
  );
}
