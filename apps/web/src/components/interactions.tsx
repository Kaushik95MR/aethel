"use client";

import { useEffect } from "react";
import { press, tick } from "@/lib/sound";

// Quiet hover and press sounds on links and buttons. Does nothing unless sound is on, and only on pointer devices.
export function Interactions() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const target = (e: Event) => (e.target as Element | null)?.closest("a, button");
    const over = (e: PointerEvent) => {
      const t = target(e);
      if (t && t !== (e.relatedTarget as Element | null)?.closest?.("a, button")) tick();
    };
    const down = (e: PointerEvent) => {
      if (target(e)) press();
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerdown", down);
    };
  }, []);
  return null;
}
