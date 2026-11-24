"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavLink = { label: string; href: string; icon: "overview" | "enquiries" | "bookings" | "catalogue" | "hosts" | "review"; badge?: number | null };

const ICONS: Record<NavLink["icon"], React.ReactNode> = {
  overview: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  enquiries: <path d="M4 5h16v11H8l-4 4zM8 9.5h8M8 12.5h5" />,
  bookings: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  catalogue: <path d="m3 20 6-11 4 6 2.5-4L21 20zM17 5.5a1.5 1.5 0 1 1 0 .01" />,
  review: <path d="M4 5h16v14H4zM8 10l2.2 2.2L15 8M8 16h8" />,
  hosts: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16.5 4.4a3.5 3.5 0 0 1 0 6.2M18 14.8c2 .6 3.2 2.2 3.5 5.2" />,
};

/** The sidebar links. The current section gets a quiet grey pill, nothing louder. */
export function Nav({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {links.map((l) => {
        const current = l.href === "/" ? pathname === "/" : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors ${
              current ? "bg-[var(--active)] font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {ICONS[l.icon]}
            </svg>
            <span className="flex-1">{l.label}</span>
            {l.badge ? (
              <span className="rounded-full bg-[var(--accent)] px-1.5 text-xs font-medium text-[#0a1322]">{l.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
