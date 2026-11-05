import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { btn, btnDanger, btnPrimary, Empty, Flash, PageHeader } from "@/components/ui";
import {
  addStep,
  addStop,
  autoPhotos,
  deleteItinerary,
  deleteStep,
  detachMedia,
  moveStep,
  removeStop,
  renameItinerary,
  saveDayInfo,
  saveStep,
} from "../../../itinerary-actions";
import { SOUND_SCENES, STEP_KINDS, stepLabel } from "../../../itinerary-options";
import { MediaUploader } from "./media-uploader";

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  invalid: { tone: "error", text: "Check the fields and try again." },
  stop_invalid: { tone: "error", text: "Choose a place, or type a new one, before adding a pick-up point." },
  failed: { tone: "error", text: "Couldn't save. You may not have access." },
};

const input = "rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm";
const label = "block text-xs text-zinc-500";

type Option = { id: string; kind: string; label: string; maps_url: string | null };
type Media = { sort_order: number; media: { id: string; bucket: string; path: string; kind: string; alt: string | null } | null };
type Step = {
  id: string;
  sort_order: number;
  kind: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  vehicle_id: string | null;
  location_id: string | null;
  to_location_id: string | null;
  sound: string | null;
  itinerary_step_media: Media[];
  itinerary_step_stops: { id: string; sort_order: number; stop_time: string | null; location: { label: string; maps_url: string | null } | null }[];
};
type Day = { id: string; day_no: number; title: string; summary: string | null; itinerary_steps: Step[] };

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

export default async function ItineraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; itineraryId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; photos?: string }>;
}) {
  await requireStaff(["owner", "manager", "content_editor"]);
  const { id, itineraryId } = await params;
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(itineraryId).success) notFound();
  const sp = await searchParams;
  const flash = sp.saved ? MESSAGES.saved : sp.error ? MESSAGES[sp.error] : undefined;

  const supabase = await createClient();
  const [itnRes, daysRes, optsRes, depsRes, pkgRes] = await Promise.all([
    supabase.from("itineraries").select("id, name, description, package_id").eq("id", itineraryId).eq("package_id", id).maybeSingle(),
    supabase
      .from("itinerary_days")
      .select(
        "id, day_no, title, summary, itinerary_steps(*, itinerary_step_media(sort_order, media:media(id, bucket, path, kind, alt)), itinerary_step_stops(id, sort_order, stop_time, location:catalogue_options!location_id(label, maps_url)))",
      )
      .eq("itinerary_id", itineraryId)
      .order("day_no"),
    supabase.from("catalogue_options").select("id, kind, label, maps_url").order("label"),
    supabase.from("departures").select("start_date").eq("itinerary_id", itineraryId).order("start_date"),
    supabase.from("packages").select("title, duration_days").eq("id", id).maybeSingle(),
  ]);
  if (!itnRes.data || !pkgRes.data) notFound();
  const itn = itnRes.data;
  const days = ((daysRes.data ?? []) as unknown as Day[]).map((d) => ({
    ...d,
    itinerary_steps: [...d.itinerary_steps].sort((a, b) => a.sort_order - b.sort_order),
  }));
  const options = (optsRes.data ?? []) as Option[];
  const vehicles = options.filter((o) => o.kind === "vehicle");
  const places = options.filter((o) => o.kind === "location");
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const used = (depsRes.data ?? []).map((d) => formatDate(d.start_date));
  const stepCount = days.reduce((n, d) => n + d.itinerary_steps.length, 0);

  const hidden = (
    <>
      <input type="hidden" name="package_id" value={id} />
      <input type="hidden" name="itinerary_id" value={itineraryId} />
    </>
  );

  return (
    <>
      <PageHeader
        back={{ href: `/catalogue/${id}?tab=itineraries`, label: pkgRes.data.title }}
        title={itn.name}
        description={
          <>
            {days.length} {days.length === 1 ? "day" : "days"}, {stepCount} {stepCount === 1 ? "step" : "steps"}.{" "}
            {used.length ? `Runs on ${used.join(", ")}.` : "No date uses this itinerary yet. Choose it on the Dates tab."}
          </>
        }
        actions={
          <form action={autoPhotos}>
            {hidden}
            <button type="submit" className={btn} title="Searches Wikimedia Commons for free, credited photos of this trek's places">
              Find photos
            </button>
          </form>
        }
      />

      {sp.photos !== undefined && (
        <Flash tone="info">
          {Number(sp.photos) > 0
            ? `Added photos to ${sp.photos} ${sp.photos === "1" ? "step" : "steps"}. Check them and remove any that don't fit.`
            : "No new photos found. Steps that already have a photo are left alone, and some places have no free photos yet."}
        </Flash>
      )}
      {flash && <Flash tone={flash.tone}>{flash.text}</Flash>}

      {days.map((day) => (
        <section key={day.id} id={`day-${day.id}`} className="scroll-mt-6 rounded-xl border border-zinc-200 bg-white">
          <form action={saveDayInfo} className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-5 py-3">
            {hidden}
            <input type="hidden" name="day_id" value={day.id} />
            <h2 className="text-base font-semibold text-zinc-900">Day {day.day_no}</h2>
            <input
              name="title"
              maxLength={120}
              defaultValue={day.title}
              placeholder="Name this day, e.g. Summit day"
              aria-label={`Day ${day.day_no} title`}
              className={`${input} min-w-52 flex-1`}
            />
            <details className="text-sm">
              <summary className="font-medium text-zinc-600 hover:text-zinc-900">Summary</summary>
              <textarea
                name="summary"
                rows={2}
                maxLength={2000}
                defaultValue={day.summary ?? ""}
                placeholder="A line about the day (optional)"
                aria-label={`Day ${day.day_no} summary`}
                className={`${input} mt-2 w-72`}
              />
            </details>
            <button type="submit" className={btn}>
              Save day
            </button>
          </form>

          <ol className="divide-y divide-zinc-100">
            {day.itinerary_steps.map((s, idx) => {
              const media = [...s.itinerary_step_media].sort((a, b) => a.sort_order - b.sort_order).flatMap((m) => (m.media ? [m.media] : []));
              const vehicle = vehicles.find((v) => v.id === s.vehicle_id)?.label;
              const place = places.find((p) => p.id === s.location_id)?.label;
              const to = places.find((p) => p.id === s.to_location_id)?.label;
              const where = s.kind === "pickup" ? s.itinerary_step_stops.map((p) => p.location?.label).filter(Boolean).join(", ") : [place, to].filter(Boolean).join(" to ");
              const meta = [vehicle, where].filter(Boolean).join(" · ");
              const hasTo = ["travel", "trek", "drop_off"].includes(s.kind);

              return (
                <li key={s.id} id={`step-${s.id}`} className="scroll-mt-6">
                  <details className="group">
                    <summary className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50">
                      <span className="num w-12 shrink-0 text-sm text-zinc-500">{hhmm(s.start_time) || "—"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-zinc-900">{s.title || stepLabel(s.kind)}</span>
                        <span className="block truncate text-sm text-zinc-500">
                          {stepLabel(s.kind)}
                          {meta ? ` · ${meta}` : ""}
                        </span>
                      </span>
                      <span className="hidden whitespace-nowrap text-sm text-zinc-500 sm:block">
                        {media.length > 0 ? `${media.length} ${media.length === 1 ? "photo" : "photos"}` : "No photo"}
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
                        aria-hidden
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>

                    <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
                      <form action={saveStep} className="space-y-4">
                        {hidden}
                        <input type="hidden" name="step_id" value={s.id} />

                        <div className="grid gap-3 sm:grid-cols-[150px_1fr_110px_110px]">
                          <label className="space-y-1">
                            <span className={label}>Type</span>
                            <select name="kind" defaultValue={s.kind} className={`${input} w-full`}>
                              {STEP_KINDS.map((k) => (
                                <option key={k.value} value={k.value}>
                                  {k.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1">
                            <span className={label}>Title</span>
                            <input
                              name="title"
                              maxLength={120}
                              defaultValue={s.title}
                              placeholder={STEP_KINDS.find((k) => k.value === s.kind)?.placeholder}
                              className={`${input} w-full`}
                            />
                          </label>
                          <label className="space-y-1">
                            <span className={label}>Starts</span>
                            <input type="time" name="start_time" defaultValue={hhmm(s.start_time)} className={`${input} w-full`} />
                          </label>
                          <label className="space-y-1">
                            <span className={label}>Ends</span>
                            <input type="time" name="end_time" defaultValue={hhmm(s.end_time)} className={`${input} w-full`} />
                          </label>
                        </div>

                        <div className={`grid gap-3 ${s.kind === "pickup" ? "sm:grid-cols-1" : hasTo ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                          <label className="space-y-1">
                            <span className={label}>Vehicle</span>
                            <select name="vehicle_id" defaultValue={s.vehicle_id ?? ""} className={`${input} w-full`}>
                              <option value="">None</option>
                              {vehicles.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {s.kind !== "pickup" && (
                            <label className="space-y-1">
                              <span className={label}>{hasTo ? "From" : "Place"}</span>
                              <select name="location_id" defaultValue={s.location_id ?? ""} className={`${input} w-full`}>
                                <option value="">None</option>
                                {places.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {s.kind !== "pickup" && hasTo && (
                            <label className="space-y-1">
                              <span className={label}>To</span>
                              <select name="to_location_id" defaultValue={s.to_location_id ?? ""} className={`${input} w-full`}>
                                <option value="">None</option>
                                {places.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>

                        <label className="block space-y-1">
                          <span className={label}>What happens (optional)</span>
                          <textarea name="description" rows={2} maxLength={2000} defaultValue={s.description ?? ""} className={`${input} w-full`} />
                        </label>

                        <details className="text-sm">
                          <summary className="font-medium text-zinc-600 hover:text-zinc-900">New place or vehicle, and sound</summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <input name="vehicle_new" maxLength={120} placeholder="New vehicle name" aria-label="New vehicle" className={input} />
                            <span />
                            {s.kind !== "pickup" && (
                              <>
                                <input name="location_new" maxLength={120} placeholder={hasTo ? "New starting place" : "New place"} aria-label="New place" className={input} />
                                <input name="location_url" type="url" placeholder="Google Maps link for it" aria-label="Maps link for the new place" className={input} />
                              </>
                            )}
                            {s.kind !== "pickup" && hasTo && (
                              <>
                                <input name="to_location_new" maxLength={120} placeholder="New destination" aria-label="New destination" className={input} />
                                <input name="to_location_url" type="url" placeholder="Google Maps link for it" aria-label="Maps link for the new destination" className={input} />
                              </>
                            )}
                            <label className="space-y-1 sm:col-span-2">
                              <span className={label}>Sound on the trek page</span>
                              <select name="sound" defaultValue={s.sound ?? ""} className={`${input} w-full sm:w-64`}>
                                <option value="">Automatic</option>
                                {SOUND_SCENES.map((x) => (
                                  <option key={x.value} value={x.value}>
                                    {x.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </details>

                        <button type="submit" className={btnPrimary}>
                          Save step
                        </button>
                      </form>

                      {s.kind === "pickup" && (
                        <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4">
                          <h3 className="text-sm font-semibold text-zinc-900">Pick-up points</h3>
                          <ul className="divide-y divide-zinc-100">
                            {[...s.itinerary_step_stops]
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((p) => (
                                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                                  <span>
                                    {p.location?.label}
                                    {p.stop_time && <span className="num ml-2 text-zinc-500">{hhmm(p.stop_time)}</span>}
                                    {p.location?.maps_url && (
                                      <a href={p.location.maps_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-zinc-600 underline">
                                        Maps
                                      </a>
                                    )}
                                  </span>
                                  <form action={removeStop}>
                                    {hidden}
                                    <input type="hidden" name="step_id" value={s.id} />
                                    <input type="hidden" name="stop_id" value={p.id} />
                                    <button type="submit" className={btnDanger}>
                                      Remove
                                    </button>
                                  </form>
                                </li>
                              ))}
                            {s.itinerary_step_stops.length === 0 && <li className="py-1.5 text-sm text-zinc-500">No pick-up points yet.</li>}
                          </ul>
                          <form action={addStop} className="grid gap-2 border-t border-zinc-100 pt-3 sm:grid-cols-[1fr_1fr_1fr_110px_auto]">
                            {hidden}
                            <input type="hidden" name="step_id" value={s.id} />
                            <select name="location_id" defaultValue="" aria-label="Pick-up place" className={input}>
                              <option value="">Choose a place</option>
                              {places.map((pl) => (
                                <option key={pl.id} value={pl.id}>
                                  {pl.label}
                                </option>
                              ))}
                            </select>
                            <input name="location_new" maxLength={120} placeholder="Or a new place" aria-label="New place" className={input} />
                            <input name="location_url" type="url" placeholder="Google Maps link" aria-label="Maps link" className={input} />
                            <input type="time" name="stop_time" aria-label="Pick-up time" className={input} />
                            <button type="submit" className={btn}>
                              Add
                            </button>
                          </form>
                        </div>
                      )}

                      <div className="space-y-2">
                        {media.length > 0 && (
                          <ul className="flex flex-wrap gap-3">
                            {media.map((m) => {
                              const src = `${baseUrl}/storage/v1/object/public/${m.bucket}/${m.path}`;
                              return (
                                <li key={m.id} className="space-y-1">
                                  {m.kind === "video" ? (
                                    <video src={src} className="h-24 w-36 rounded-lg bg-black object-cover" muted controls preload="metadata" />
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={src} alt={m.alt ?? ""} className="h-24 w-36 rounded-lg object-cover" />
                                  )}
                                  <form action={detachMedia}>
                                    {hidden}
                                    <input type="hidden" name="step_id" value={s.id} />
                                    <input type="hidden" name="media_id" value={m.id} />
                                    <button type="submit" className={`${btnDanger} text-xs`}>
                                      Remove
                                    </button>
                                  </form>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <MediaUploader stepId={s.id} />
                      </div>

                      <div className="flex flex-wrap gap-4 border-t border-zinc-200 pt-3 text-sm">
                        {(["up", "down"] as const).map((dir) => (
                          <form key={dir} action={moveStep}>
                            {hidden}
                            <input type="hidden" name="step_id" value={s.id} />
                            <input type="hidden" name="direction" value={dir} />
                            <button
                              type="submit"
                              disabled={(dir === "up" && idx === 0) || (dir === "down" && idx === day.itinerary_steps.length - 1)}
                              className="font-medium text-zinc-700 underline-offset-2 hover:underline disabled:text-zinc-400 disabled:no-underline"
                            >
                              Move {dir}
                            </button>
                          </form>
                        ))}
                        <form action={deleteStep} className="ml-auto">
                          {hidden}
                          <input type="hidden" name="step_id" value={s.id} />
                          <button type="submit" className={btnDanger}>
                            Delete step
                          </button>
                        </form>
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
            {day.itinerary_steps.length === 0 && (
              <li className="px-5 py-4">
                <Empty>Nothing planned yet. Add a pick-up, a journey, a trek or anything else.</Empty>
              </li>
            )}
          </ol>

          <form action={addStep} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-5 py-3">
            {hidden}
            <input type="hidden" name="day_id" value={day.id} />
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              Add to day {day.day_no}
              <select name="kind" defaultValue="trek" className={input} aria-label="Step type to add">
                {STEP_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btn}>
              Add step
            </button>
          </form>
        </section>
      ))}

      <details className="rounded-xl border border-zinc-200 bg-white">
        <summary className="flex items-center justify-between px-5 py-4 text-base font-semibold text-zinc-900">
          Itinerary settings
          <span className="text-sm font-normal text-zinc-500">Rename or delete</span>
        </summary>
        <div className="space-y-4 border-t border-zinc-100 px-5 py-4">
          <form action={renameItinerary} className="flex flex-wrap items-end gap-3">
            {hidden}
            <label className="space-y-1">
              <span className={label}>Name</span>
              <input name="name" required maxLength={120} defaultValue={itn.name} className={`${input} w-64`} />
            </label>
            <label className="min-w-64 flex-1 space-y-1">
              <span className={label}>Note for staff</span>
              <input name="description" maxLength={1000} defaultValue={itn.description ?? ""} className={`${input} w-full`} />
            </label>
            <button type="submit" className={btn}>
              Save
            </button>
          </form>
          <form action={deleteItinerary} className="flex flex-wrap items-center gap-3">
            {hidden}
            <button type="submit" className={btnDanger}>
              Delete this itinerary
            </button>
            <span className="text-sm text-zinc-500">Dates using it keep their dates and lose the itinerary.</span>
          </form>
        </div>
      </details>
    </>
  );
}
