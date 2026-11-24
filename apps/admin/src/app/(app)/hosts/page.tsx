import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { publicUrl } from "@/lib/media";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, btnPrimary, Empty, Flash, PageHeader } from "@/components/ui";

type Row = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  status: string;
  is_sample: boolean;
  staff_id: string | null;
  photo: { bucket: string; path: string } | null;
  departures: { start_date: string; status: string }[];
};

export default async function HostsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const staff = await requireStaff(["owner", "manager", "content_editor", "host"]);
  const sp = await searchParams;
  const supabase = await createClient();
  if (staff.role === "host") {
    // A host has one profile: their own.
    const { data: mine } = await supabase.from("hosts").select("id").eq("staff_id", staff.userId).maybeSingle();
    redirect(mine ? `/hosts/${mine.id}` : "/catalogue");
  }
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("hosts")
    .select("id, slug, name, tagline, status, is_sample, staff_id, photo:media!photo_media_id(bucket, path), departures(start_date, status)")
    .order("sort_order")
    .order("name");
  const rows = (data ?? []) as unknown as Row[];
  // Who has a login, and whether it is switched on.
  const loginIds = rows.map((r) => r.staff_id).filter((x): x is string => !!x);
  const { data: logins } = loginIds.length ? await supabase.from("staff").select("id, active").in("id", loginIds) : { data: [] as { id: string; active: boolean }[] };
  const loginState = new Map((logins ?? []).map((l) => [l.id, l.active]));

  return (
    <>
      <PageHeader
        title="Hosts"
        description="The experienced people who arrange and lead your trips. You create each host's login. Published hosts show on the website."
        actions={
          <Link href="/hosts/new" className={btnPrimary}>
            Add host
          </Link>
        }
      />

      {sp.deleted && <Flash tone="ok">Host deleted. Their trip dates are kept, with no host chosen.</Flash>}
      {error && <Flash tone="error">Couldn&apos;t load hosts. Refresh to try again.</Flash>}

      {rows.length === 0 && !error ? (
        <Empty>No hosts yet. Add the first one, then choose them on a trip date.</Empty>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {rows.map((r) => {
            const upcoming = r.departures.filter((d) => d.status === "open" && d.start_date >= today).length;
            return (
              <li key={r.id}>
                <Link href={`/hosts/${r.id}`} className="grid items-center gap-x-5 gap-y-1 px-5 py-4 hover:bg-zinc-50 sm:grid-cols-[48px_1fr_150px_120px]">
                  <span className="hidden sm:block">
                    {r.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={publicUrl(r.photo)} alt="" className="size-12 rounded-lg object-cover" />
                    ) : (
                      <Avatar name={r.name} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-900">
                      {r.name}
                      {r.is_sample && <span className="ml-2 text-xs font-normal text-zinc-500">Sample</span>}
                    </span>
                    <span className="block truncate text-sm text-zinc-500">{r.tagline ?? "No tagline yet"}</span>
                  </span>
                  <span className="text-sm text-zinc-500">
                    {upcoming} upcoming {upcoming === 1 ? "date" : "dates"}
                    <span className="block">{r.staff_id ? (loginState.get(r.staff_id) === false ? "Login is off" : "Has a login") : "No login yet"}</span>
                  </span>
                  <span className="sm:text-right">
                    <StatusBadge status={r.status} />
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
