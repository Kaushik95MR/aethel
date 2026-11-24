import Image from "next/image";
import type { HostSummary } from "@/lib/catalogue";

/** A round host photo. Falls back to the first letter of the name when the host has no photo yet. */
export function HostAvatar({ host, size, ring = false }: { host: Pick<HostSummary, "name" | "photo">; size: number; ring?: boolean }) {
  const frame = `relative inline-block shrink-0 overflow-hidden rounded-full bg-shola ${ring ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`;
  return (
    <span className={frame} style={{ width: size, height: size }}>
      {host.photo ? (
        <Image src={host.photo.src} alt="" fill sizes={`${size * 2}px`} quality={80} className="object-cover" />
      ) : (
        <span aria-hidden className="grid size-full place-items-center font-display text-cream" style={{ fontSize: size * 0.45 }}>
          {host.name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
