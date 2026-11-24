import Link from "next/link";
import { myHostId, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPaise } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { btnPrimary, Empty, Flash, PageHeader } from "@/components/ui";

type Row = {
  id: string;
  review_state: string;
  host: { name: string } | null;
  title: string;
  slug: string;
  status: string;
  duration_days: number;
  base_price_paise: number | string | null;
  departures: { start_date: string; status: string }[];
};

export default async function CataloguePage() {
  const staff = await requireStaff(["owner", "manager", "content_editor", "host"]);
  const isHost = staff.role === "host";
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Published trips are public, so the database lets a host read them all. A host's list shows only their own.
  const mine = isHost ? await myHostId(staff.userId) : null;
  let query = supabase
    .from("packages")
    .select("id, title, slug, status, review_state, host:hosts(name), duration_days, base_price_paise, departures(start_date, status)")
    .order("created_at", { ascending: false });
  if (isHost) query = query.eq("host_id", mine ?? "00000000-0000-0000-0000-000000000000");
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title={isHost ? "My trips" : "Catalogue"}
        description={
          isHost
            ? "The trips you arrange. Write one, submit it, and an admin sets the price and publishes it."
            : "The trips on your website. Only published ones are public."
        }
        actions={
          <Link href="/catalogue/new" className={btnPrimary}>
            {isHost ? "New trip" : "New package"}
          </Link>
        }
      />

      {error && <Flash tone="error">Couldn&apos;t load packages. Refresh to try again.</Flash>}

      {rows.length === 0 && !error ? (
        <Empty>{isHost ? "No trips yet. Start your first one and a starter itinerary is set up for you." : "No packages yet. Create your first trip and an itinerary is set up for you."}</Empty>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {rows.map((r) => {
            const upcoming = r.departures.filter((d) => d.status === "open" && d.start_date >= today).map((d) => d.start_date).sort();
            return (
              <li key={r.id}>
                <Link
                  href={`/catalogue/${r.id}`}
                  className="grid items-center gap-x-6 gap-y-1 px-5 py-4 hover:bg-zinc-50 sm:grid-cols-[1fr_auto_110px_170px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-900">{r.title}</span>
                    <span className="block truncate text-sm text-zinc-500">
                      {r.duration_days} {r.duration_days === 1 ? "day" : "days"}
                      {r.host ? ` · host ${r.host.name}` : ""}
                      {isHost ? "" : ` · /${r.slug}`}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge status={r.status} />
                    {r.review_state !== "approved" && <StatusBadge status={r.review_state} />}
                  </span>
                  <span className="num text-sm text-zinc-700 sm:text-right">{isHost && r.base_price_paise === null ? "Admin sets" : formatPaise(r.base_price_paise)}</span>
                  <span className="text-sm text-zinc-500 sm:text-right">
                    {upcoming.length
                      ? `Next ${formatDate(upcoming[0])}${upcoming.length > 1 ? ` · +${upcoming.length - 1} more` : ""}`
                      : "No dates yet"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
