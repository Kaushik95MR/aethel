import Link from "next/link";
import { AtSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserLite } from "@/lib/auth";

type Row = { first_name: string; instagram: string | null; age: number | null; is_you: boolean };

/**
 * Who is going on a date. The database only returns names to people confirmed on that same date;
 * everyone else gets a prompt to log in. Reads cookies, so it sits in Suspense.
 */
export async function Travellers({ departureId, going, slug }: { departureId: string; going: number; slug: string }) {
  const user = await getUserLite();
  if (!user) {
    // The seat count on the page can be an hour old, so it only decides whether to mention the list at all.
    if (going <= 0) return null;
    return (
      <p className="mt-4 text-base text-muted-foreground">
        Booked on this trip?{" "}
        <Link href={`/login?next=${encodeURIComponent(`/packages/${slug}`)}`} className="text-link underline underline-offset-4">
          Log in to meet the group
        </Link>
        .
      </p>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("departure_travellers", { p_departure_id: departureId });
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) {
    if (going <= 0) return null;
    return <p className="mt-4 text-base text-muted-foreground">You&apos;ll see who&apos;s going here once your seat is confirmed.</p>;
  }
  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <li key={`${r.first_name}-${i}`} className="flex items-center gap-3 rounded-2xl border border-border p-3">
          <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-shola font-display text-xl">
            {r.first_name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold">
              {r.first_name}
              {r.age !== null ? `, ${r.age}` : ""}
              {r.is_you ? <span className="ml-2 text-sm font-normal text-sun">You</span> : null}
            </p>
            {r.instagram && (
              <a
                href={`https://instagram.com/${r.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-base text-muted-foreground hover:text-sun"
              >
                <AtSign aria-hidden className="size-4" />
                {r.instagram}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
