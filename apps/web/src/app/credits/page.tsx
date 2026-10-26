import type { Metadata } from "next";
import { PhotoCredit } from "@/components/photo-credit";
import { allPhotos } from "@/lib/photos";

export const metadata: Metadata = { title: "Photo credits" };

const LABELS: Record<string, string> = { hero: "Home page, main photo", band: "Home page, trail photo" };

export default function CreditsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-12 pt-28">
      <h1 className="font-display text-5xl font-semibold">Photo credits</h1>
      <p className="mt-3 text-muted-foreground">
        Placeholder photos from Wikimedia Commons under Creative Commons licences, used until we have our own.
      </p>
      <ul className="mt-6 space-y-1">
        {allPhotos().map(({ slug, photo }) => (
          <li key={slug}>
            <span className="text-sm">{LABELS[slug] ?? slug.replace("-", " ")}</span>
            <PhotoCredit photo={photo} />
          </li>
        ))}
      </ul>
    </div>
  );
}
