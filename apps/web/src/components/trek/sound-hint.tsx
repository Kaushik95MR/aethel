"use client";

import { useSyncExternalStore } from "react";
import { isSoundOn, subscribe, toggleSound } from "@/lib/sound";

// The story has a soundscape for every chapter. Browsers only allow audio after a click, so this is that click.
export function SoundHint() {
  const on = useSyncExternalStore(subscribe, isSoundOn, () => false);
  return (
    <button
      type="button"
      onClick={() => void toggleSound()}
      aria-pressed={on}
      className="rounded-full border border-background/60 px-4 py-2 text-background transition-colors hover:bg-background hover:text-ink"
    >
      {on ? "Sound on: tap to mute" : "Turn sound on for the full story"}
    </button>
  );
}
