import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, sanitizeSearch } from "@/lib/format";
import { PAGE_SIZE, Pagination, parsePage } from "@/components/pagination";
import { StatusBadge } from "@/components/status-badge";

const STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  destination_interest: string | null;
  adults: number;
  children: number;
  preferred_start: string | null;
  status: string;
  created_at: string;
  package: { title: string } | null;
  assigned: { full_name: string } | null;
};

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireStaff(["owner", "manager", "agent"]);
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === sp.status);
  const q = sanitizeSearch(sp.q);
  const page = parsePage(sp.page);

  const supabase = await createClient();
  let query = supabase
    .from("enquiries")
    .select(
      "id, name, email, phone, destination_interest, adults, children, preferred_start, status, created_at, package:packages(title), assigned:staff!assigned_to(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-medium">Enquiries</h1>
        <p className="text-sm text-zinc-500">Newest first. Agents see unassigned enquiries and their own.</p>
      </div>

      <form className="flex flex-wrap items-center gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email or phone"
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
          <Link href="/enquiries" className="text-zinc-600 underline">
            Clear
          </Link>
        )}
      </form>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn&apos;t load enquiries. Refresh to try again.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500">
            <tr>
              {["Received", "Name", "Contact", "Interest", "Travellers", "Start", "Status", "Assigned"].map((h) => (
                <th key={h} className="px-3 py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                <td className="whitespace-nowrap px-3 py-2">{formatDate(r.created_at)}</td>
                <td className="px-3 py-2">
                  <Link href={`/enquiries/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-600">{r.email ?? r.phone ?? "—"}</td>
                <td className="px-3 py-2">{r.package?.title ?? r.destination_interest ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.adults}A{r.children > 0 ? ` ${r.children}C` : ""}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatDate(r.preferred_start)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-zinc-600">{r.assigned?.full_name ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                  {q || status ? "No enquiries match those filters." : "No enquiries yet. New website enquiries will show up here."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={count ?? 0} basePath="/enquiries" params={{ q, status }} />
    </div>
  );
}
