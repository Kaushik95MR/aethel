import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPaise } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, btnPrimary, btnText, Empty, Flash, PageHeader, Panel } from "@/components/ui";

type Enquiry = {
  id: string;
  name: string;
  destination_interest: string | null;
  adults: number;
  children: number;
  created_at: string;
  package: { title: string } | null;
};
type Booking = {
  id: string;
  reference: string;
  total_paise: number | string;
  customer: { full_name: string } | null;
  package: { title: string } | null;
  title: string | null;
};
type Departure = { id: string; start_date: string; capacity: number; status: string; package: { title: string; slug: string } | null };

const day = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const dayOf = (d: string) => day.format(new Date(`${d}T00:00:00+05:30`));

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await requireStaff();
  // A host works on their own trips, so that is where they start.
  if (staff.role === "host") redirect("/catalogue");
  const { error } = await searchParams;
  const supabase = await createClient();

  const canSell = ["owner", "manager", "agent"].includes(staff.role);
  const canSeeBookings = canSell || staff.role === "accounts";
  const canEditCatalogue = ["owner", "manager", "content_editor"].includes(staff.role);
  const today = new Date().toISOString().slice(0, 10);

  // Each block asks only for what the role may read; RLS stays the final judge.
  const [enq, enqCount, bks, bkCount, deps, pubCount] = await Promise.all([
    canSell
      ? supabase
          .from("enquiries")
          .select("id, name, destination_interest, adults, children, created_at, package:packages(title)")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(5)
      : null,
    canSell ? supabase.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new") : null,
    canSeeBookings
      ? supabase
          .from("bookings")
          .select("id, reference, total_paise, title, customer:customers(full_name), package:packages(title)")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5)
      : null,
    canSeeBookings ? supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending") : null,
    supabase
      .from("departures")
      .select("id, start_date, capacity, status, package:packages(title, slug)")
      .eq("status", "open")
      .gte("start_date", today)
      .order("start_date")
      .limit(5),
    canEditCatalogue ? supabase.from("packages").select("id", { count: "exact", head: true }).eq("status", "published") : null,
  ]);

  const enquiries = (enq?.data ?? []) as unknown as Enquiry[];
  const bookings = (bks?.data ?? []) as unknown as Booking[];
  const departures = (deps.data ?? []) as unknown as Departure[];

  // Seats taken per departure come from confirmed and completed bookings, as the website counts them.
  const taken = new Map<string, number>();
  if (departures.length && canSeeBookings) {
    const { data } = await supabase
      .from("bookings")
      .select("departure_id, adults, children")
      .in("departure_id", departures.map((d) => d.id))
      .in("status", ["confirmed", "completed"]);
    for (const b of data ?? []) taken.set(b.departure_id, (taken.get(b.departure_id) ?? 0) + b.adults + b.children);
  }

  const newCount = enqCount?.count ?? 0;
  const pendingCount = bkCount?.count ?? 0;
  const next = departures[0];
  const nextTaken = next ? (taken.get(next.id) ?? 0) : 0;

  const kpis: { label: string; value: React.ReactNode; hint?: string; href?: string }[] = [
    ...(canSell ? [{ label: "New enquiries", value: newCount, hint: "waiting for a reply", href: "/enquiries?status=new" }] : []),
    ...(canSeeBookings ? [{ label: "Pending bookings", value: pendingCount, hint: "to confirm", href: "/bookings?status=pending" }] : []),
    ...(next
      ? [
          {
            label: "Next departure",
            value: dayOf(next.start_date),
            hint: canSeeBookings ? `${nextTaken} of ${next.capacity} seats taken` : `${next.capacity} seats`,
          },
        ]
      : []),
    ...(canEditCatalogue ? [{ label: "Published packages", value: pubCount?.count ?? 0, href: "/catalogue" }] : []),
  ];

  const finding =
    canSell && newCount > 0
      ? `${newCount} new ${newCount === 1 ? "enquiry is" : "enquiries are"} waiting for a reply.`
      : canSeeBookings && pendingCount > 0
        ? `${pendingCount} ${pendingCount === 1 ? "booking needs" : "bookings need"} confirming.`
        : "Nothing is waiting on you right now.";

  return (
    <>
      <PageHeader
        title="Overview"
        description={finding}
        actions={
          canEditCatalogue && (
            <Link href="/catalogue/new" className={btnPrimary}>
              New package
            </Link>
          )
        }
      />

      {error === "forbidden" && <Flash tone="error">Your role doesn&apos;t have access to that page.</Flash>}

      {kpis.length > 0 && (
        <dl
          className="grid divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white sm:divide-x sm:divide-y-0"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(190px, 1fr))` }}
        >
          {kpis.map((k) => (
            <div key={k.label} className="px-5 py-4">
              <dt className="text-sm text-zinc-500">{k.label}</dt>
              <dd className="num mt-1 text-2xl font-semibold text-zinc-900">
                {k.href ? (
                  <Link href={k.href} className="hover:underline">
                    {k.value}
                  </Link>
                ) : (
                  k.value
                )}
              </dd>
              {k.hint && <p className="mt-0.5 text-sm text-zinc-500">{k.hint}</p>}
            </div>
          ))}
        </dl>
      )}

      {(canSell || canSeeBookings) && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {canSell && (
            <Panel
              title="Enquiries to answer"
              action={
                <Link href="/enquiries" className={btnText}>
                  View all
                </Link>
              }
            >
              {enquiries.length === 0 ? (
                <Empty>No new enquiries. New website enquiries show up here.</Empty>
              ) : (
                <ul className="-mx-2 divide-y divide-zinc-100">
                  {enquiries.map((e) => (
                    <li key={e.id}>
                      <Link href={`/enquiries/${e.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-zinc-50">
                        <Avatar name={e.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-zinc-900">{e.name}</span>
                          <span className="block truncate text-sm text-zinc-500">
                            {e.package?.title ?? e.destination_interest ?? "No trip chosen"} · {e.adults + e.children}{" "}
                            {e.adults + e.children === 1 ? "traveller" : "travellers"}
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-sm text-zinc-500">{formatDate(e.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {canSeeBookings && (
            <Panel
              title="Bookings to confirm"
              action={
                <Link href="/bookings?status=pending" className={btnText}>
                  View all
                </Link>
              }
            >
              {bookings.length === 0 ? (
                <Empty>No pending bookings. Turn an enquiry into a booking to see it here.</Empty>
              ) : (
                <ul className="-mx-2 divide-y divide-zinc-100">
                  {bookings.map((b) => (
                    <li key={b.id}>
                      <Link href={`/bookings/${b.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-zinc-50">
                        <Avatar name={b.customer?.full_name ?? b.reference} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-zinc-900">{b.customer?.full_name ?? "—"}</span>
                          <span className="block truncate text-sm text-zinc-500">
                            {b.reference} · {b.package?.title ?? b.title ?? "Trip"}
                          </span>
                        </span>
                        <span className="num whitespace-nowrap font-medium text-zinc-900">{formatPaise(b.total_paise)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      )}

      <Panel
        title="Next departures"
        action={
          canEditCatalogue && (
            <Link href="/catalogue" className={btnText}>
              Manage dates
            </Link>
          )
        }
      >
        {departures.length === 0 ? (
          <Empty>No open departures. Add dates to a package in the catalogue.</Empty>
        ) : (
          <ul className="-mx-2 divide-y divide-zinc-100">
            {departures.map((d) => {
              const used = taken.get(d.id) ?? 0;
              const pct = d.capacity > 0 ? Math.min(100, Math.round((used / d.capacity) * 100)) : 0;
              return (
                <li key={d.id} className="grid items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 sm:grid-cols-[120px_1fr_240px]">
                  <span className="num font-medium text-zinc-900">{dayOf(d.start_date)}</span>
                  <span className="truncate text-zinc-700">{d.package?.title ?? "—"}</span>
                  {canSeeBookings ? (
                    <span className="flex items-center gap-3">
                      <span
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200"
                        role="img"
                        aria-label={`${used} of ${d.capacity} seats taken`}
                      >
                        <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="num w-24 text-right text-sm text-zinc-500">
                        {used} of {d.capacity}
                      </span>
                    </span>
                  ) : (
                    <StatusBadge status={d.status} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
