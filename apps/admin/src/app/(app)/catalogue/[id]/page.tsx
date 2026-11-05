import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { btn, btnDanger, btnPrimary, Empty, Flash, PageHeader, Panel } from "@/components/ui";
import { deleteDeparture, saveDeparture } from "../actions";
import { createItinerary } from "../itinerary-actions";
import { AutoFill } from "./auto-fill";
import { ConfirmButton } from "./confirm-button";
import { PackageForm, type PackageValues } from "../package-form";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  invalid: { tone: "error", text: "Check the fields and try again. An end date can't be before its start date." },
  slug_taken: { tone: "error", text: "Another package already uses that web address." },
  has_bookings: { tone: "error", text: "This date has bookings, so it can't be deleted. Set its status to Cancelled instead." },
  failed: { tone: "error", text: "Couldn't save. You may not have access." },
};

const input = "rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm";
const label = "block text-xs text-zinc-500";
const STATUSES = ["open", "closed", "sold_out", "cancelled"] as const;
const TABS = [
  { id: "details", label: "Details" },
  { id: "itineraries", label: "Itineraries" },
  { id: "dates", label: "Dates" },
] as const;

type Itinerary = { id: string; name: string; description: string | null; steps: number };

type Departure = {
  id: string;
  itinerary_id: string | null;
  start_date: string;
  end_date: string;
  capacity: number;
  price_override_paise: number | string | null;
  status: string;
};

const rupees = (p: number | string | null) => (p == null ? "" : String(Number(p) / 100));

export default async function PackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; autofill?: string; tab?: string }>;
}) {
  const staff = await requireStaff(["owner", "manager", "content_editor"]);
  const canDelete = staff.role === "owner" || staff.role === "manager";
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "details";
  const flash = sp.saved ? MESSAGES.saved : sp.error ? MESSAGES[sp.error] : undefined;

  const supabase = await createClient();
  const [pkgRes, itnRes, depsRes] = await Promise.all([
    supabase.from("packages").select("*").eq("id", id).maybeSingle(),
    supabase.from("itineraries").select("id, name, description, itinerary_days(itinerary_steps(id))").eq("package_id", id).order("sort_order"),
    supabase.from("departures").select("*").eq("package_id", id).order("start_date"),
  ]);
  if (!pkgRes.data) notFound();
  const pkg = pkgRes.data as unknown as PackageValues & { id: string };
  const itineraries: Itinerary[] = (
    (itnRes.data ?? []) as unknown as { id: string; name: string; description: string | null; itinerary_days: { itinerary_steps: unknown[] }[] }[]
  ).map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    steps: i.itinerary_days.reduce((n, d) => n + d.itinerary_steps.length, 0),
  }));
  const departures = (depsRes.data ?? []) as Departure[];
  const counts: Record<string, number | null> = { details: null, itineraries: itineraries.length, dates: departures.length };

  const itineraryPicker = (current: string | null) => (
    <label className="space-y-1">
      <span className={label}>Itinerary</span>
      <select name="itinerary_id" defaultValue={current ?? ""} className={input}>
        <option value="">None yet</option>
        {itineraries.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/catalogue", label: "Catalogue" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {pkg.title}
            <StatusBadge status={pkg.status} />
          </span>
        }
        description={`${pkg.duration_days} ${pkg.duration_days === 1 ? "day" : "days"} · /${pkg.slug}`}
      />

      {flash && <Flash tone={flash.tone}>{flash.text}</Flash>}
      {sp.autofill && <AutoFill packageId={id} />}

      <nav aria-label="Package sections" className="flex gap-1 border-b border-zinc-200">
        {TABS.map((t) => {
          const current = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/catalogue/${id}?tab=${t.id}`}
              aria-current={current ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                current ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {t.label}
              {counts[t.id] !== null && <span className="num ml-1.5 text-zinc-400">{counts[t.id]}</span>}
            </Link>
          );
        })}
      </nav>

      {tab === "details" && <PackageForm pkg={pkg} />}

      {tab === "itineraries" && (
        <>
          <p className="max-w-2xl text-sm text-zinc-500">
            An itinerary is the day-by-day story of a trip. A package can have several, and each date picks the one it runs.
            Change the number of days in Details and every itinerary adjusts.
          </p>
          {itineraries.length === 0 ? (
            <Empty>No itineraries yet. Create the first one below.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
              {itineraries.map((i) => (
                <li key={i.id}>
                  <Link href={`/catalogue/${id}/itineraries/${i.id}`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-zinc-50">
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-900">{i.name}</span>
                      <span className="block truncate text-sm text-zinc-500">
                        {i.steps} {i.steps === 1 ? "step" : "steps"}
                        {i.description ? ` · ${i.description}` : ""}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-zinc-700">Edit</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Panel title="Add an itinerary">
            <form action={createItinerary} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="package_id" value={id} />
              <label className="space-y-1">
                <span className={label}>Name</span>
                <input name="name" required maxLength={120} defaultValue={`Itinerary ${itineraries.length + 1}`} className={`${input} w-56`} />
              </label>
              {itineraries.length > 0 && (
                <label className="space-y-1">
                  <span className={label}>Start from</span>
                  <select name="copy_from" defaultValue="" className={input}>
                    <option value="">A fresh starter</option>
                    {itineraries.map((i) => (
                      <option key={i.id} value={i.id}>
                        Copy of {i.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button type="submit" className={btnPrimary}>
                Add itinerary
              </button>
            </form>
          </Panel>
        </>
      )}

      {tab === "dates" && (
        <>
          <p className="max-w-2xl text-sm text-zinc-500">
            Each row is one trip date. Leave the price blank to use the package price. Cancel a date rather than deleting it, so
            bookings keep their link.
          </p>
          <Panel>
            <div className="space-y-4">
              {departures.map((d) => (
                <form key={d.id} action={saveDeparture} className="flex flex-wrap items-end gap-3 border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="package_id" value={id} />
                  <label className="space-y-1">
                    <span className={label}>Starts</span>
                    <input type="date" name="start_date" required defaultValue={d.start_date} className={input} />
                  </label>
                  <label className="space-y-1">
                    <span className={label}>Ends</span>
                    <input type="date" name="end_date" required defaultValue={d.end_date} className={input} />
                  </label>
                  <label className="space-y-1">
                    <span className={label}>Seats</span>
                    <input type="number" name="capacity" min={0} max={500} required defaultValue={d.capacity} className={`${input} w-20`} />
                  </label>
                  <label className="space-y-1">
                    <span className={label}>Price (₹)</span>
                    <input name="price" inputMode="decimal" defaultValue={rupees(d.price_override_paise)} placeholder="Package price" className={`${input} w-32`} />
                  </label>
                  {itineraryPicker(d.itinerary_id)}
                  <label className="space-y-1">
                    <span className={label}>Status</span>
                    <select name="status" defaultValue={d.status} className={input}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s === "sold_out" ? "Sold out" : s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className={btn}>
                    Save
                  </button>
                  {canDelete && (
                    <ConfirmButton
                      formAction={deleteDeparture}
                      message={`Delete the date starting ${formatDate(d.start_date)}? This can't be undone.`}
                      className={`${btnDanger} ml-auto min-h-[34px]`}
                    >
                      Delete
                    </ConfirmButton>
                  )}
                </form>
              ))}
              {departures.length === 0 && <Empty>No dates yet. Add the first one below.</Empty>}
            </div>
          </Panel>

          <Panel title="Add a date">
            <form action={saveDeparture} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="package_id" value={id} />
              <input type="hidden" name="status" value="open" />
              <label className="space-y-1">
                <span className={label}>Starts</span>
                <input type="date" name="start_date" required className={input} />
              </label>
              <label className="space-y-1">
                <span className={label}>Ends</span>
                <input type="date" name="end_date" required className={input} />
              </label>
              <label className="space-y-1">
                <span className={label}>Seats</span>
                <input type="number" name="capacity" min={0} max={500} required defaultValue={20} className={`${input} w-20`} />
              </label>
              <label className="space-y-1">
                <span className={label}>Price (₹)</span>
                <input name="price" inputMode="decimal" placeholder="Package price" className={`${input} w-32`} />
              </label>
              {itineraryPicker(itineraries[0]?.id ?? null)}
              <button type="submit" className={btnPrimary}>
                Add date
              </button>
            </form>
            {departures.length > 0 && (
              <p className="mt-3 text-sm text-zinc-500">
                Next date: {formatDate(departures.find((d) => d.status === "open")?.start_date)}
              </p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
