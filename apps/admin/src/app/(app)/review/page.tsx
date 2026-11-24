import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Empty, PageHeader, Panel } from "@/components/ui";

type Row = {
  id: string;
  title: string;
  review_state: string;
  review_note: string | null;
  updated_at: string;
  host: { name: string } | null;
  departures: { id: string }[];
};

export default async function ReviewPage() {
  await requireStaff(["owner", "manager"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("packages")
    .select("id, title, review_state, review_note, updated_at, host:hosts(name), departures(id)")
    .in("review_state", ["submitted", "changes_requested", "draft"])
    .not("host_id", "is", null)
    .order("updated_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const waiting = rows.filter((r) => r.review_state === "submitted");
  const others = rows.filter((r) => r.review_state !== "submitted");

  const list = (items: Row[]) => (
    <ul className="divide-y divide-zinc-100">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/catalogue/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:bg-zinc-50">
            <span className="min-w-0">
              <span className="block font-medium text-zinc-900">{r.title}</span>
              <span className="block text-sm text-zinc-500">
                {r.host ? `Host ${r.host.name}` : "No host"} · {r.departures.length} {r.departures.length === 1 ? "date" : "dates"} · updated {formatDate(r.updated_at)}
              </span>
            </span>
            <StatusBadge status={r.review_state} />
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader title="Review" description="Trips your hosts have written. Open one, check it, then set the price and publish it, or send it back with a note." />
      <Panel title={`Waiting for you (${waiting.length})`}>
        {waiting.length === 0 ? <Empty>Nothing to review right now.</Empty> : list(waiting)}
      </Panel>
      {others.length > 0 && <Panel title="With the host">{list(others)}</Panel>}
    </>
  );
}
