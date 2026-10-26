import Link from "next/link";
import type { UpcomingDeparture } from "@/lib/catalogue";
import { formatPaise } from "@/lib/format";

function when(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    day: dt.toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" }),
    date: dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }),
  };
}

// The next departures, straight from the database. Each row is a link; the orange rule is the trail marker.
export function Departures({ items }: { items: UpcomingDeparture[] }) {
  return (
    <section className="mx-auto max-w-[88rem] px-5 py-28 sm:px-8 sm:py-40">
      <h2 className="font-display text-[clamp(2.4rem,6vw,5rem)] text-ink">Leaving soon</h2>
      <p className="mt-3 max-w-md text-muted-foreground">Seats are counted live. Pick a date and we&apos;ll confirm it with you.</p>

      <ul className="mt-12 border-t border-ink/20">
        {items.map((d) => {
          const w = when(d.start_date);
          const sold = d.seats_left !== null && d.seats_left <= 0;
          return (
            <li key={d.id} className="border-b border-ink/20">
              <Link
                href={`/packages/${d.slug}`}
                data-tick
                data-cursor="View"
                className="group relative grid grid-cols-[auto_1fr] items-baseline gap-x-6 gap-y-1 py-6 sm:grid-cols-[9rem_1fr_auto_auto] sm:gap-x-10"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[-1px] h-[2px] origin-left scale-x-0 bg-brand transition-transform duration-500 ease-out group-hover:scale-x-100"
                />
                <span className="font-display text-4xl text-ink sm:text-5xl">{w.date}</span>
                <span className="text-lg text-ink sm:text-xl">
                  {d.title}
                  <span className="ml-3 text-sm text-muted-foreground">{w.day}, {d.duration_days} days</span>
                </span>
                <span className="col-start-2 text-sm text-muted-foreground sm:col-start-auto">
                  {sold ? "Sold out" : d.seats_left === null ? "" : `${d.seats_left} seats left`}
                </span>
                <span className="col-start-2 text-sm text-ink sm:col-start-auto">From {formatPaise(d.base_price_paise)}</span>
              </Link>
            </li>
          );
        })}
        {items.length === 0 && <li className="py-8 text-muted-foreground">New dates are being added. Tell us what you&apos;re after and we&apos;ll plan it.</li>}
      </ul>
    </section>
  );
}
