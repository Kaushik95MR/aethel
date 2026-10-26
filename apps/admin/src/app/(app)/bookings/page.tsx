import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPaise, sanitizeSearch } from "@/lib/format";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";

const STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

type Row = {
  id: string;
  reference: string;
  title: string | null;
  start_date: string | null;
  status: string;
  total_paise: number | string;
  customer: { full_name: string } | null;
  package: { title: string } | null;
};

type PaymentSummary = { booking_id: string; paid_paise: number | string; payment_status: string };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireStaff(["owner", "manager", "agent", "accounts"]);
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = sanitizeSearch(sp.q);
  const page = parsePage(sp.page);

  const supabase = await createClient();

  // Searching by customer name needs the customer ids first (PostgREST can't OR across an embedded table).
  let customerIds: string[] = [];
  if (q) {
    const { data: matches } = await supabase
      .from("customers")
      .select("id")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(200);
    customerIds = (matches ?? []).map((c: { id: string }) => c.id);
  }

  let query = supabase
    .from("bookings")
    .select(
      "id, reference, title, start_date, status, total_paise, customer:customers(full_name), package:packages(title)",
      { count: "exact" },
    )
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) {
    const ref = `reference.ilike.%${q}%`;
    query = customerIds.length ? query.or(`${ref},customer_id.in.(${customerIds.join(",")})`) : query.or(ref);
  }

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // Payment status is derived from the ledger by the booking_payment_summary view.
  const summaries = new Map<string, PaymentSummary>();
  if (rows.length) {
    const { data: s } = await supabase
      .from("booking_payment_summary")
      .select("booking_id, paid_paise, payment_status")
      .in("booking_id", rows.map((r) => r.id));
    for (const row of (s ?? []) as PaymentSummary[]) summaries.set(row.booking_id, row);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Bookings</h1>
        <p className="text-sm text-zinc-500">Latest travel dates first.</p>
      </div>

      <form className="flex flex-wrap items-center gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search reference or customer"
          className="w-64 rounded-md border border-zinc-300 bg-white px-3 py-1.5"
        />
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-zinc-300 bg-white px-2 py-1.5">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 hover:bg-zinc-50">
          Filter
        </button>
        {(q || status) && (
          <Link href="/bookings" className="text-zinc-600 underline">
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load bookings. Refresh to try again.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              {["Reference", "Customer", "Trip", "Travel date", "Total", "Status", "Payment"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pay = summaries.get(r.id);
              return (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{r.reference}</td>
                  <td className="px-3 py-2">{r.customer?.full_name ?? "—"}</td>
                  <td className="px-3 py-2">{r.package?.title ?? r.title ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatDate(r.start_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatPaise(r.total_paise)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={pay?.payment_status ?? "unpaid"} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  {q || status ? "No bookings match those filters." : "No bookings yet. Convert an enquiry to create the first one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={count ?? 0} basePath="/bookings" params={{ q, status }} />
    </div>
  );
}
