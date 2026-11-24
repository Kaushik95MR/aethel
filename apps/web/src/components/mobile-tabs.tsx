"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Home, UserRound, Users } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", Icon: Home, match: ["/"] },
  { href: "/packages", label: "Trips", Icon: Compass, match: ["/packages"] },
  { href: "/hosts", label: "Hosts", Icon: Users, match: ["/hosts"] },
  { href: "/account", label: "Me", Icon: UserRound, match: ["/account", "/login", "/join"] },
];

// The bottom tab bar on phones. A trip page has its own bar with the price and "I'm in", so the tabs step aside there.
export function MobileTabs() {
  const path = usePathname();
  if (/^\/packages\/[^/]+/.test(path) || path.startsWith("/pay")) return null;
  const active = (match: string[]) => match.some((m) => (m === "/" ? path === "/" : path.startsWith(m)));
  return (
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ href, label, Icon, match }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={active(match) ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-sm ${active(match) ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              <Icon aria-hidden className="size-6" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
