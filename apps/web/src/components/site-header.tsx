"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { SoundToggle } from "@/components/sound-toggle";
import { SITE } from "@/lib/site";

const LINKS = [
  { href: "/destinations", label: "Destinations" },
  { href: "/packages", label: "Trips" },
];

// Ink text on the pale sections; light text over sections marked data-header="dark" (solid) or "photo" (no bar).
export function SiteHeader() {
  const [tone, setTone] = useState<"light" | "dark" | "photo">("light");

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const els = document.elementsFromPoint(window.innerWidth / 2, 36);
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

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        tone === "dark" ? "bg-ink/60 text-background backdrop-blur-md" : tone === "photo" ? "text-background" : "bg-background/75 text-ink backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex max-w-[88rem] items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" aria-label={`${SITE.name} home`}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hidden hover:underline sm:inline">
              {l.label}
            </Link>
          ))}
          <SoundToggle />
          <Link
            href="/enquire"
            className={`inline-flex h-11 items-center rounded-full border px-4 transition-colors ${
              tone === "light" ? "border-ink hover:bg-ink hover:text-background" : "border-background hover:bg-background hover:text-ink"
            }`}
          >
            Plan a trip
          </Link>
        </nav>
      </div>
    </header>
  );
}
