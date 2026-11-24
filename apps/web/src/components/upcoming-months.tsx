"use client";

import Link from "next/link";
import { useState } from "react";

export type MonthTrip = { id: string; month: string; slug: string; title: string; dates: string; host: string | null; seats: string | null };

/** Upcoming trips by month: pills for each month that has a trip, and the trips for the chosen month underneath. */
export function UpcomingMonths({ months, trips }: { months: { key: string; label: string }[]; trips: MonthTrip[] }) {
  const [active, setActive] = useState(months[0]?.key ?? "");
  const shown = trips.filter((t) => t.month === active);

  return (
    <div>
      {months.length > 1 && (
        <div role="tablist" aria-label="Choose a month" className="tabs">
          {months.map((m) => (
            <button key={m.key} role="tab" type="button" aria-selected={active === m.key} onClick={() => setActive(m.key)}>
              {m.label}
            </button>
          ))}
        </div>
      )}
      <ul className="rows">
        {shown.map((t) => (
          <li key={t.id}>
            <span className="when">{t.dates}</span>
            <span className="what">
              {t.title}
              {t.host ? <small>Hosted by {t.host}</small> : null}
            </span>
            <span className="left">{t.seats ?? ""}</span>
            <Link href={`/packages/${t.slug}`} className="btn small">
              I&apos;m in
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
