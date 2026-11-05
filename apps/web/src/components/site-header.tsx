"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";

const LINKS = [
  ...CATEGORIES.map((c) => ({ href: `/packages?type=${c.slug}`, label: c.short })),
  { href: "/destinations", label: "Destinations" },
];

// Ink text on the pale sections; light text over sections marked data-header="dark" (solid) or "photo" (no bar).
export function SiteHeader({ promo }: { promo: { text: string; href: string } }) {
  const [tone, setTone] = useState<"light" | "dark" | "photo">("light");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const els = document.elementsFromPoint(window.innerWidth / 2, 60);
      const marked = els.map((el) => el.closest<HTMLElement>("[data-header]")).find(Boolean);
      setTone((marked?.dataset.header as "dark" | "photo" | undefined) ?? "light");
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const light = tone === "light";
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <Link href={promo.href} className="block bg-primary px-5 py-2 text-center text-sm font-medium text-primary-foreground hover:underline">
        {promo.text}
      </Link>
      <div
        className={`transition-colors duration-300 ${
          tone === "dark" ? "bg-ink/60 text-background backdrop-blur-md" : tone === "photo" ? "text-background" : "bg-background/90 text-ink backdrop-blur-md"
        }`}
      >
        <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-6 px-5 py-3 sm:px-8">
          <Link href="/" aria-label={`${SITE.name} home`}>
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 text-base lg:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/enquire"
              className={`inline-flex h-11 items-center rounded-full border px-5 transition-colors ${
                light ? "border-ink hover:bg-ink hover:text-background" : "border-background hover:bg-background hover:text-ink"
              }`}
            >
              Plan a trip
            </Link>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-menu" aria-label="Main" className="border-t border-current/15 bg-background px-5 pb-5 pt-2 text-ink lg:hidden">
            <ul>
              {[...LINKS, { href: "/packages", label: "All trips" }].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-line text-lg">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
