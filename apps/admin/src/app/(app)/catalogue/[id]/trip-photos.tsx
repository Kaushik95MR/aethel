import { btn, btnDanger, Empty, Panel } from "@/components/ui";
import { publicUrl } from "@/lib/media";
import { removePackagePhoto, setCoverPhoto } from "../actions";
import { PhotoUploader } from "./photo-uploader";

export type TripPhoto = { media_id: string; role: string; sort_order: number; media: { bucket: string; path: string; alt: string | null } | null };

/** The trip's photos: the first one is the cover on the website, the rest fill its gallery. */
export function TripPhotos({ packageId, photos }: { packageId: string; photos: TripPhoto[] }) {
  const sorted = [...photos]
    .filter((p) => p.media)
    .sort((a, b) => Number(b.role === "hero") - Number(a.role === "hero") || a.sort_order - b.sort_order);

  return (
    <Panel title="Photos" action={<PhotoUploader packageId={packageId} />}>
      <p className="mb-4 max-w-2xl text-sm text-zinc-500">
        These show on the trip page and its card on the website. The cover is the first picture people see. Use bright, sharp photos you have the right to use.
        Photos for single itinerary steps are added in the itinerary.
      </p>
      {sorted.length === 0 ? (
        <Empty>No photos yet. Add the first one.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {sorted.map((p, i) => (
            <li key={p.media_id} className="space-y-2">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-zinc-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicUrl(p.media!)} alt={p.media!.alt ?? ""} className="size-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">Cover</span>}
              </span>
              <div className="flex items-center justify-between gap-2">
                {i === 0 ? (
                  <span className="text-sm text-zinc-500">Cover photo</span>
                ) : (
                  <form action={setCoverPhoto}>
                    <input type="hidden" name="package_id" value={packageId} />
                    <input type="hidden" name="media_id" value={p.media_id} />
                    <button type="submit" className={btn}>
                      Make cover
                    </button>
                  </form>
                )}
                <form action={removePackagePhoto}>
                  <input type="hidden" name="package_id" value={packageId} />
                  <input type="hidden" name="media_id" value={p.media_id} />
                  <button type="submit" className={btnDanger}>
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
