/** The Aethel mark: a peak in the brand orange, with the wordmark in the display face. */
export function Brand() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 20 12 4l9 16" />
        <path d="M8.2 20 12 13.5 15.8 20" />
      </svg>
      <span className="font-display text-lg font-semibold tracking-tight text-zinc-900">Aethel</span>
    </span>
  );
}
