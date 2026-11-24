import Link from "next/link";
import { HostAvatar } from "@/components/host-avatar";
import type { HostCard } from "@/lib/catalogue";

// The people who lead the trips. Each opens their profile.
export function HostsRow({ hosts }: { hosts: HostCard[] }) {
  if (hosts.length === 0) return null;
  return (
    <section aria-labelledby="hosts" className="mx-auto max-w-[88rem] px-5 py-14 sm:px-8 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="hosts" className="font-display text-[clamp(2rem,4vw,3.2rem)]">
            Meet your hosts
          </h2>
          <p className="mt-2 max-w-lg text-lg text-muted-foreground">Every trip is led by someone you can look up first.</p>
        </div>
        <Link href="/hosts" className="text-lg text-link underline underline-offset-4">
          See all hosts
        </Link>
      </div>
      <ul className="mt-8 flex gap-8 overflow-x-auto px-2 pb-4 pt-2 [scrollbar-width:thin]">
        {hosts.map((h) => (
          <li key={h.slug} className="shrink-0">
            <Link href={`/hosts/${h.slug}`} className="group flex w-32 flex-col items-center gap-3 text-center">
              <span className="transition-transform duration-300 group-hover:scale-105">
                <HostAvatar host={h} size={112} ring />
              </span>
              <span className="font-display text-xl">{h.name}</span>
              {h.tagline && <span className="text-sm text-muted-foreground">{h.tagline}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
