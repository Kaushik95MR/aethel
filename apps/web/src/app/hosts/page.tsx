import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HostAvatar } from "@/components/host-avatar";
import { getHosts } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Meet the hosts" };

export default async function HostsPage() {
  const hosts = await getHosts();
  return (
    <div className="mx-auto max-w-[88rem] px-5 pb-20 pt-10 sm:px-8">
      <h1 className="font-display text-[clamp(2.4rem,5vw,4.2rem)]">Meet the hosts</h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">Every trip is led by someone who travels with you. Look them up before you say you&apos;re in.</p>

      {hosts.length > 0 ? (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hosts.map((h) => (
            <li key={h.slug}>
              <Link href={`/hosts/${h.slug}`} className="group block overflow-hidden rounded-[2rem] border border-border bg-card transition-transform duration-300 hover:-translate-y-1">
                <div className="relative h-36 bg-shola">
                  {h.cover && <Image src={h.cover.src} alt="" fill quality={75} sizes="(min-width: 1024px) 30vw, 92vw" className="object-cover" />}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </div>
                <div className="-mt-12 px-6 pb-6">
                  <HostAvatar host={h} size={88} ring />
                  <p className="mt-4 font-display text-3xl">{h.name}</p>
                  {h.tagline && <p className="mt-1 text-lg text-muted-foreground">{h.tagline}</p>}
                  <p className="mt-4 text-base text-sun">
                    {h.upcoming > 0 ? `${h.upcoming} upcoming ${h.upcoming === 1 ? "trip" : "trips"}` : "New host"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 max-w-md text-lg text-muted-foreground">Our hosts are being added.</p>
      )}
    </div>
  );
}
