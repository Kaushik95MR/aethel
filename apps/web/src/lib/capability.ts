type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

/** Whether this device should run 3D at all. */
export function canRender3D(): boolean {
  const nav = navigator as Nav;
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 2) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Phones and modest laptops get a lighter mesh and a lower pixel ratio. */
export function isLowPower(): boolean {
  const nav = navigator as Nav;
  const small = window.matchMedia("(max-width: 800px)").matches;
  const weak = (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) || (nav.hardwareConcurrency ?? 8) <= 4;
  return small || weak;
}
