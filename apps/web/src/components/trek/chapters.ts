import type { TripItinerary, ItineraryStep } from "@/lib/catalogue";
import { photoFor, type Photo } from "@/lib/photos";
import type { SceneId } from "@/lib/story-sound";
import type { Chapter } from "./story-scroll";

// Turns the itinerary staff build in the admin app into the scroll story. A step becomes one chapter.

const SOUNDS: SceneId[] = ["city", "bus", "forest", "summit", "jeep", "camp", "night", "morning", "home"];

/** The soundscape for a step when staff leave it on "Automatic". */
function autoSound(s: ItineraryStep): SceneId {
  const vehicle = s.vehicle?.toLowerCase() ?? "";
  switch (s.kind) {
    case "pickup":
      return "city";
    case "travel":
      return vehicle.includes("jeep") ? "jeep" : vehicle.includes("foot") ? "forest" : "bus";
    case "trek":
      return "forest";
    case "activity":
    case "meal":
      return "camp";
    case "stay":
      return "night";
    case "free_time":
      return "morning";
    case "drop_off":
      return "home";
    default:
      return "forest";
  }
}

/** Bundled photo shown when a step has no photo or video of its own. */
const FALLBACK_PHOTO: Record<SceneId, string> = {
  city: "story-bengaluru",
  bus: "story-bengaluru",
  forest: "kp-forest",
  summit: "kp-sunrise",
  jeep: "kp-ridge",
  camp: "story-fire-night",
  night: "kp-dawn",
  morning: "kp-mist",
  home: "kp-valley",
};

/** Only http(s) links reach the page, whatever is stored. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekday(startDate: string, dayNo: number) {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayNo - 1);
  return WEEKDAYS[d.getUTCDay()];
}

function clock(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export function chaptersFromItinerary(trip: TripItinerary): { chapters: Chapter[]; credits: Photo[] } {
  const chapters: Chapter[] = [];
  const credits: Photo[] = [];

  for (const day of trip.days) {
    const dayLabel = weekday(trip.start_date, day.day_no);
    for (const s of day.steps) {
      const sound = s.sound && (SOUNDS as string[]).includes(s.sound) ? (s.sound as SceneId) : autoSound(s);
      const first = s.media[0];
      let scene: Chapter["scene"];
      if (first) {
        if (first.credit) credits.push({ src: first.src, alt: first.alt, ...first.credit });
        scene = first.kind === "video" ? { kind: "video", src: first.src } : { kind: "photo", src: first.src, alt: first.alt };
      } else if (sound === "bus") {
        scene = { kind: "bus" };
      } else {
        const ph = photoFor(FALLBACK_PHOTO[sound]);
        if (ph) credits.push(ph);
        scene = ph ? { kind: "photo", src: ph.src, alt: ph.alt } : { kind: "bus" };
      }

      const place = s.location?.label
        ? s.to_location?.label
          ? `${s.location.label} to ${s.to_location.label}`
          : s.location.label
        : (s.to_location?.label ?? null);
      chapters.push({
        id: s.id,
        label: s.title,
        when: [dayLabel, clock(s.start_time)].filter(Boolean).join(", "),
        title: s.title,
        text: s.description ?? "",
        meta: [s.vehicle, s.stops.length ? null : place].filter(Boolean).join(" · "),
        stops: s.stops.map((p) => ({ label: p.label, time: clock(p.time), url: safeUrl(p.maps_url) })),
        destination: s.to_location?.label ?? null,
        mapsUrl: safeUrl(s.to_location?.maps_url) ?? safeUrl(s.location?.maps_url),
        scene,
        sound,
        dayNo: day.day_no,
        dayLabel,
      });
    }
  }
  return { chapters, credits: [...new Map(credits.map((c) => [c.src, c])).values()] };
}
