import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPaise, sanitizeSearch } from "@/lib/format";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";
import { btn, Flash, PageHeader } from "@/components/ui";

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
    <>
      <PageHeader title="Bookings" description="Latest travel dates first." />

      <form className="flex flex-wrap items-center gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search reference or customer"
          className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-1.5"
        />
        <select name="status" defaultValue={status ?? ""} className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <button type="submit" className={btn}>
          Filter
        </button>
        {(q || status) && (
          <Link href="/bookings" className="text-zinc-600 underline">
            Clear
          </Link>
        )}
      </form>

      {error && <Flash tone="error">Couldn&apos;t load bookings. Refresh to try again.</Flash>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-zinc-500">
            <tr>
              {["Reference", "Customer", "Trip", "Travel date", "Total", "Status", "Payment"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-normal">
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
                  <td className="whitespace-nowrap px-4 py-3 font-medium">
                    <Link href={`/bookings/${r.id}`} className="underline-offset-2 hover:underline">
                      {r.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.customer?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{r.package?.title ?? r.title ?? "—"}</td>
                  <td className="num whitespace-nowrap px-4 py-3">{formatDate(r.start_date)}</td>
                  <td className="num whitespace-nowrap px-4 py-3">{formatPaise(r.total_paise)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={pay?.payment_status ?? "unpaid"} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  {q || status ? "No bookings match those filters." : "No bookings yet. Convert an enquiry to create the first one."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={count ?? 0} basePath="/bookings" params={{ q, status }} />
    </>
  );
}
