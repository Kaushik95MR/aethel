import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, humanize } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { btn, btnPrimary, Empty, Flash, PageHeader, Panel } from "@/components/ui";
import { updateBookingStatus } from "../../../../bookings/actions";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  no_seats: { tone: "error", text: "Not enough seats left on this date to confirm that booking." },
  failed: { tone: "error", text: "Couldn't save. You may not have access." },
};

type Booking = {
  id: string;
  reference: string;
  status: string;
  adults: number;
  children: number;
  created_at: string;
  customer: { full_name: string; phone: string | null; instagram: string | null; date_of_birth: string | null } | null;
};

const ageOf = (dob: string | null | undefined) => {
  if (!dob) return null;
  const d = new Date(`${dob}T00:00:00Z`);
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a -= 1;
  return a;
};

const ORDER: Record<string, number> = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };

export default async function DatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; departureId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const staff = await requireStaff(["owner", "manager", "host"]);
  const { id, departureId } = await params;
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(departureId).success) notFound();
  const sp = await searchParams;
  const flash = sp.saved ? MESSAGES.saved : sp.error ? MESSAGES[sp.error] : undefined;
  const here = `/catalogue/${id}/dates/${departureId}`;

  const supabase = await createClient();
  const { data: dep } = await supabase
    .from("departures")
    .select("id, start_date, end_date, capacity, status, package:packages(title), host:hosts(name)")
    .eq("id", departureId)
    .eq("package_id", id)
    .maybeSingle();
  if (!dep) notFound();
  const d = dep as unknown as {
    start_date: string;
    end_date: string;
    capacity: number;
    status: string;
    package: { title: string } | null;
    host: { name: string } | null;
  };

  // A host sees the same group list the travellers see: first name, age and Instagram. No contact details, no payments.
  if (staff.role === "host") {
    const { data: people } = await supabase.rpc("departure_travellers", { p_departure_id: departureId });
    const group = (people ?? []) as { first_name: string; instagram: string | null; age: number | null }[];
    return (
      <>
        <PageHeader
          back={{ href: `/catalogue/${id}?tab=dates`, label: "Dates" }}
          title="Who is going"
          description={`${d.package?.title ?? "Trip"}, ${formatDate(d.start_date)} to ${formatDate(d.end_date)}. ${group.length} confirmed so far, ${d.capacity} seats in all.`}
        />
        <Panel title="The group">
          {group.length === 0 ? (
            <Empty>Nobody is confirmed yet. People appear here once an admin confirms their booking.</Empty>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.map((g, i) => (
                <li key={`${g.first_name}-${i}`} className="rounded-lg border border-zinc-200 px-3 py-2.5">
                  <span className="block font-medium text-zinc-900">
                    {g.first_name}
                    {g.age !== null ? `, ${g.age}` : ""}
                  </span>
                  <span className="block text-sm text-zinc-500">{g.instagram ? `@${g.instagram}` : "No Instagram"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </>
    );
  }

  const { data } = await supabase
    .from("bookings")
    .select("id, reference, status, adults, children, created_at, customer:customers(full_name, phone, instagram, date_of_birth)")
    .eq("departure_id", departureId)
    .order("created_at");
  const bookings = ((data ?? []) as unknown as Booking[]).sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
  const ids = bookings.map((b) => b.id);
  const { data: pay } = ids.length
    ? await supabase.from("booking_payment_summary").select("booking_id, payment_status").in("booking_id", ids)
    : { data: [] as { booking_id: string; payment_status: string }[] };
  const paymentOf = new Map((pay ?? []).map((p) => [p.booking_id, p.payment_status]));

  const going = bookings.filter((b) => b.status === "confirmed" || b.status === "completed");
  const taken = going.reduce((n, b) => n + b.adults + b.children, 0);
  const waiting = bookings.filter((b) => b.status === "pending");

  return (
    <>
      <PageHeader
        back={{ href: `/catalogue/${id}?tab=dates`, label: "Dates" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            Who is going
            <StatusBadge status={d.status} />
          </span>
        }
        description={`${d.package?.title ?? "Trip"}, ${formatDate(d.start_date)} to ${formatDate(d.end_date)}${d.host ? `, host ${d.host.name}` : ", no host chosen yet"}.`}
      />

      {flash && <Flash tone={flash.tone}>{flash.text}</Flash>}

      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Seats taken", `${taken} of ${d.capacity}`],
          ["Seats left", String(Math.max(d.capacity - taken, 0))],
          ["Requests waiting", String(waiting.length)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-zinc-200 bg-white px-5 py-4">
            <dt className="text-sm text-zinc-500">{k}</dt>
            <dd className="num font-display text-xl text-zinc-900">{v}</dd>
          </div>
        ))}
      </dl>

      <Panel title="Bookings on this date">
        {bookings.length === 0 ? (
          <Empty>No bookings on this date yet. Turn an enquiry into a booking and it shows here.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {bookings.map((b) => {
              const age = ageOf(b.customer?.date_of_birth);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-900">
                      {b.customer?.full_name ?? "Customer"}
                      {age !== null ? `, ${age}` : ""}
                    </span>
                    <span className="block text-sm text-zinc-500">
                      {[b.customer?.phone, b.customer?.instagram ? `@${b.customer.instagram}` : null, `${b.adults + b.children} ${b.adults + b.children === 1 ? "seat" : "seats"}`, b.reference]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={b.status} />
                    <StatusBadge status={paymentOf.get(b.id) ?? "unpaid"} />
                    {b.status === "pending" && (
                      <form action={updateBookingStatus}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="status" value="confirmed" />
                        <input type="hidden" name="return_to" value={here} />
                        <button type="submit" className={btnPrimary}>
                          Confirm
                        </button>
                      </form>
                    )}
                    <Link href={`/bookings/${b.id}`} className={btn}>
                      Open booking
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-sm text-zinc-500">Confirming takes seats from this date, and the person then appears in the group list on the website.</p>
      </Panel>

      <Panel title="What the group sees">
        <p className="mb-3 text-sm text-zinc-500">
          Confirmed travellers on this date see each other&apos;s first name, age and Instagram. Phone numbers and dates of birth stay private.
        </p>
        {going.length === 0 ? (
          <Empty>Nobody is confirmed yet, so the group list is empty.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {going.map((b) => {
              const age = ageOf(b.customer?.date_of_birth);
              return (
                <li key={b.id} className="rounded-lg border border-zinc-200 px-3 py-2.5">
                  <span className="block font-medium text-zinc-900">
                    {(b.customer?.full_name ?? "Traveller").split(" ")[0]}
                    {age !== null ? `, ${age}` : ""}
                  </span>
                  <span className="block text-sm text-zinc-500">{b.customer?.instagram ? `@${b.customer.instagram}` : humanize("no instagram")}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
