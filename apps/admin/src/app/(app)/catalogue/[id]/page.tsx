import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { myHostId, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { btn, btnDanger, btnPrimary, Empty, field, Flash, PageHeader, Panel } from "@/components/ui";
import { approvePackage, deleteDeparture, saveDeparture, sendBackPackage, submitForReview } from "../actions";
import { createItinerary } from "../itinerary-actions";
import { AutoFill } from "./auto-fill";
import { ConfirmButton } from "./confirm-button";
import { PackageForm, type PackageValues } from "../package-form";
import { TripPhotos, type TripPhoto } from "./trip-photos";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  invalid: { tone: "error", text: "Check the fields and try again. An end date can't be before its start date." },
  slug_taken: { tone: "error", text: "Another package already uses that web address." },
  has_bookings: { tone: "error", text: "This date has bookings, so it can't be deleted. Set its status to Cancelled instead." },
  failed: { tone: "error", text: "Couldn't save. You may not have access." },
  submitted: { tone: "ok", text: "Submitted. An admin will review your trip and set the price." },
  locked: { tone: "error", text: "This trip is with an admin for review, so it can't be changed right now." },
  incomplete: { tone: "error", text: "Before you submit, add a summary, a description, at least one date and at least one itinerary step." },
  price_needed: { tone: "error", text: "Enter the price per person in rupees to approve this trip." },
  note_needed: { tone: "error", text: "Tell the host what to change, in a sentence or two." },
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
  host_id: string | null;
};

const rupees = (p: number | string | null) => (p == null ? "" : String(Number(p) / 100));

export default async function PackagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string; autofill?: string; tab?: string; submitted?: string }>;
}) {
  const staff = await requireStaff(["owner", "manager", "content_editor", "host"]);
  const isHost = staff.role === "host";
  const canDelete = staff.role === "owner" || staff.role === "manager" || isHost;
  const canReview = staff.role === "owner" || staff.role === "manager";
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "details";
  const flash = sp.submitted ? MESSAGES.submitted : sp.saved ? MESSAGES.saved : sp.error ? MESSAGES[sp.error] : undefined;

  const supabase = await createClient();
  const [pkgRes, itnRes, depsRes, hostsRes] = await Promise.all([
    supabase.from("packages").select("*").eq("id", id).maybeSingle(),
    supabase.from("itineraries").select("id, name, description, itinerary_days(itinerary_steps(id))").eq("package_id", id).order("sort_order"),
    supabase.from("departures").select("*").eq("package_id", id).order("start_date"),
    supabase.from("hosts").select("id, name, status").order("sort_order").order("name"),
  ]);
  if (!pkgRes.data) notFound();
  // A host opens only their own trips, even though published ones are readable by everyone.
  if (isHost && (pkgRes.data as { host_id?: string | null }).host_id !== (await myHostId(staff.userId))) notFound();
  const pkg = pkgRes.data as unknown as PackageValues & { id: string };
  const itineraries: Itinerary[] = (
    (itnRes.data ?? []) as unknown as { id: string; name: string; description: string | null; itinerary_days: { itinerary_steps: unknown[] }[] }[]
  ).map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    steps: i.itinerary_days.reduce((n, d) => n + d.itinerary_steps.length, 0),
  }));
  const { data: photoRows } = tab === "details" ? await supabase.from("package_media").select("media_id, role, sort_order, media:media(bucket, path, alt)").eq("package_id", id) : { data: [] };
  const reviewState = pkg.review_state ?? "approved";
  // A host edits only while the trip is a draft or has been sent back. After that it waits for an admin.
  const locked = isHost && !["draft", "changes_requested"].includes(reviewState);
  const { data: owner } = pkg.host_id ? await supabase.from("hosts").select("name").eq("id", pkg.host_id).maybeSingle() : { data: null };
  const departures = (depsRes.data ?? []) as Departure[];
  const hosts = (hostsRes.data ?? []) as { id: string; name: string; status: string }[];
  const canSeeBookings = staff.role === "owner" || staff.role === "manager";
  const canSeeGroup = canSeeBookings || (isHost && reviewState === "approved");

  // Seats taken and requests waiting, per date, so each row says how full it is.
  const tally = new Map<string, { taken: number; pending: number }>();
  if (canSeeBookings && departures.length > 0) {
    const { data: bk } = await supabase
      .from("bookings")
      .select("departure_id, status, adults, children")
      .in(
        "departure_id",
        departures.map((d) => d.id),
      );
    for (const b of (bk ?? []) as { departure_id: string; status: string; adults: number; children: number }[]) {
      const t = tally.get(b.departure_id) ?? { taken: 0, pending: 0 };
      if (b.status === "confirmed" || b.status === "completed") t.taken += b.adults + b.children;
      if (b.status === "pending") t.pending += 1;
      tally.set(b.departure_id, t);
    }
  }
  const counts: Record<string, number | null> = { details: null, itineraries: itineraries.length, dates: departures.length };

  const hostPicker = (current: string | null) => (
    <label className="space-y-1">
      <span className={label}>Host</span>
      <select name="host_id" defaultValue={current ?? ""} className={input}>
        <option value="">No host yet</option>
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
            {h.status === "published" ? "" : ` (${h.status})`}
          </option>
        ))}
      </select>
    </label>
  );

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
        description={`${pkg.duration_days} ${pkg.duration_days === 1 ? "day" : "days"}${owner ? ` · host ${owner.name}` : ""}${isHost ? "" : ` · /${pkg.slug}`}`}
      />

      {flash && <Flash tone={flash.tone}>{flash.text}</Flash>}
      {sp.autofill && <AutoFill packageId={id} />}

      {isHost && (
        <Panel title="Review">
          {reviewState === "draft" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">
                This trip is private. Fill in the details, the itinerary and at least one date, then submit it. An admin will review it and set the price.
              </p>
              <form action={submitForReview}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className={btnPrimary}>
                  Submit for review
                </button>
              </form>
            </div>
          )}
          {reviewState === "changes_requested" && (
            <div className="space-y-3">
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                <span className="block font-medium">An admin asked for changes</span>
                {pkg.review_note ?? "No note was left."}
              </p>
              <form action={submitForReview}>
                <input type="hidden" name="id" value={id} />
                <button type="submit" className={btnPrimary}>
                  Submit again
                </button>
              </form>
            </div>
          )}
          {reviewState === "submitted" && <p className="text-sm text-zinc-500">Submitted. An admin is reviewing it. You can&apos;t change it until they reply.</p>}
          {reviewState === "approved" && (
            <p className="text-sm text-zinc-500">
              Approved{pkg.status === "published" ? " and live on the website" : ""}. The price is set by the admin. To change the trip, ask an admin.
            </p>
          )}
        </Panel>
      )}

      {canReview && reviewState !== "approved" && (
        <Panel title={reviewState === "submitted" ? "Review this trip" : "Host's trip"}>
          {reviewState === "submitted" ? (
            <div className="space-y-5">
              <p className="text-sm text-zinc-500">
                {owner?.name ?? "A host"} submitted this trip. Check the details and itinerary, then set the price and publish it, or send it back with a note.
              </p>
              <form action={approvePackage} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={id} />
                <label className="space-y-1">
                  <span className={label}>Price per person (₹)</span>
                  <input name="price" inputMode="decimal" required defaultValue={rupees(pkg.base_price_paise)} className={`${input} w-40`} />
                </label>
                <button type="submit" className={btnPrimary}>
                  Approve and publish
                </button>
              </form>
              <form action={sendBackPackage} className="space-y-2 border-t border-zinc-100 pt-4">
                <input type="hidden" name="id" value={id} />
                <label className="block space-y-1">
                  <span className={label}>Or send it back with a note</span>
                  <textarea name="note" rows={3} maxLength={1000} placeholder="What should the host change?" className={field} />
                </label>
                <button type="submit" className={btn}>
                  Send back to host
                </button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              {reviewState === "draft" ? "The host is still writing this trip." : "Sent back to the host for changes."}
              {pkg.review_note ? ` Your note: ${pkg.review_note}` : ""}
            </p>
          )}
        </Panel>
      )}

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

      <fieldset disabled={locked} className="min-w-0 space-y-6 border-0 p-0">
      {tab === "details" && (
        <>
          <TripPhotos packageId={id} photos={(photoRows ?? []) as unknown as TripPhoto[]} />
          <PackageForm pkg={pkg} isHost={isHost} />
        </>
      )}

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
                  {!isHost && (
                    <>
                      <label className="space-y-1">
                        <span className={label}>Price (₹)</span>
                        <input name="price" inputMode="decimal" defaultValue={rupees(d.price_override_paise)} placeholder="Package price" className={`${input} w-32`} />
                      </label>
                      {hostPicker(d.host_id)}
                    </>
                  )}
                  {itineraryPicker(d.itinerary_id)}
                  {!isHost && (
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
                  )}
                  <button type="submit" className={btn}>
                    Save
                  </button>
                  {canSeeGroup && (
                    <Link href={`/catalogue/${id}/dates/${d.id}`} className={btn}>
                      Who is going{canSeeBookings ? " " : ""}
                      {canSeeBookings && (
                        <span className="num text-zinc-500">
                          {tally.get(d.id)?.taken ?? 0}/{d.capacity}
                          {tally.get(d.id)?.pending ? `, ${tally.get(d.id)?.pending} waiting` : ""}
                        </span>
                      )}
                    </Link>
                  )}
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
              {!isHost && (
                <>
                  <label className="space-y-1">
                    <span className={label}>Price (₹)</span>
                    <input name="price" inputMode="decimal" placeholder="Package price" className={`${input} w-32`} />
                  </label>
                  {hostPicker(null)}
                </>
              )}
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
      </fieldset>
    </>
  );
}
