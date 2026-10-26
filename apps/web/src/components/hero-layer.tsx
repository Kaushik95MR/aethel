"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { canRender3D, isLowPower } from "@/lib/capability";

const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

// Adds the 3D layer once the page has painted, and only on devices that can run it. Without it the photo stands alone.
export function HeroLayer() {
  const [mode, setMode] = useState<null | { reduced: boolean; low: boolean }>(null);

  useEffect(() => {
    if (!canRender3D()) return;
    const start = () =>
      setMode({ reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches, low: isLowPower() });
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(start, 300);
    return () => clearTimeout(t);
  }, []);

  return mode ? <HeroScene reducedMotion={mode.reduced} lowPower={mode.low} /> : null;
}
