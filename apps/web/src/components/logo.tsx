import { SITE } from "@/lib/site";

/** An "A" drawn as a single peak, followed by the name in the display face. Takes its colour from the parent. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden className="h-7 w-7">
        <path
          d="M4 28 16 4l12 24M9.6 20.5h12.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-display text-2xl">{SITE.name}</span>
    </span>
  );
}
