"use client";

import { useSyncExternalStore } from "react";
import { isSoundOn, subscribe, toggleSound } from "@/lib/sound";

// Four bars that move while sound is on and flatten when it's off.
export function SoundToggle() {
  const on = useSyncExternalStore(subscribe, isSoundOn, () => false);
  return (
    <button
      type="button"
      onClick={() => void toggleSound()}
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      className="flex h-11 items-center gap-2 rounded-full px-2 text-sm"
    >
      <span aria-hidden className="flex h-4 items-center gap-[3px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-full w-[2px] origin-center rounded-full bg-current"
            style={{
              transform: on ? undefined : "scaleY(0.12)",
              transition: "transform 0.3s ease-out",
              animation: on ? `bar ${0.9 + i * 0.17}s ease-in-out ${i * 0.1}s infinite alternate` : "none",
            }}
          />
        ))}
      </span>
      <span className="hidden sm:inline">{on ? "Sound on" : "Sound off"}</span>
      <style>{`@keyframes bar { from { transform: scaleY(0.25) } to { transform: scaleY(1) } }`}</style>
    </button>
  );
}
