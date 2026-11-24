import Link from "next/link";
import { Suspense } from "react";
import { AccountLink } from "@/components/account-link";
import { Logo } from "@/components/logo";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/packages", label: "Trips" },
  { href: "/hosts", label: "Hosts" },
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

// Top bar on larger screens. On a phone the bar shows the logo only and the tabs at the bottom do the navigating.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-[#0a1322]">
      <div className="site-header-inner flex w-full items-center justify-between gap-6 py-2">
        <Link href="/" aria-label={`${SITE.name} home`} className="shrink-0">
          <Logo className="h-14" />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-9 text-lg md:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="underline-offset-8 hover:text-sun hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-5">
          <Suspense fallback={null}>
            <AccountLink />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
