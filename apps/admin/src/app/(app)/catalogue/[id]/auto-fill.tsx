"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { autoFillPackagePhotos } from "../itinerary-actions";

/** Shown right after a package is created: finds free photos for its itinerary while staff start filling in details. */
export function AutoFill({ packageId }: { packageId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [state, setState] = useState<{ phase: "working" } | { phase: "done"; added: number } | { phase: "failed" }>({ phase: "working" });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    autoFillPackagePhotos(packageId)
      .then((added) => {
        setState({ phase: "done", added });
        // Drop ?autofill so a refresh doesn't search again, and show the new photos.
        router.replace(`/catalogue/${packageId}`, { scroll: false });
        router.refresh();
      })
      .catch(() => setState({ phase: "failed" }));
  }, [packageId, router]);

  return (
    <p role="status" className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
      {state.phase === "working" && "Package created with a starter itinerary. Finding free photos of this trek in the background, this can take a minute."}
      {state.phase === "done" &&
        (state.added > 0
          ? `Added photos to ${state.added} step${state.added === 1 ? "" : "s"}. Open the itinerary to check them.`
          : "Package created. No free photos were found yet, so add your own or try Find photos again once the places are filled in.")}
      {state.phase === "failed" && "Package created, but the photo search didn't finish. Open the itinerary and click Find photos automatically."}
    </p>
  );
}
