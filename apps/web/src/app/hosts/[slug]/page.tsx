import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AtSign } from "lucide-react";
import { HostAvatar } from "@/components/host-avatar";
import { TripCard } from "@/components/trip-card";
import { getHost, getHosts } from "@/lib/catalogue";

export async function generateStaticParams() {
  const hosts = await getHosts();
  return hosts.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: PageProps<"/hosts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const host = await getHost(slug);
  if (!host) return {};
  return { title: `${host.name}, trip host`, description: host.tagline ?? host.bio ?? undefined };
}

export default async function HostPage({ params }: PageProps<"/hosts/[slug]">) {
  const { slug } = await params;
  const host = await getHost(slug);
  if (!host) notFound();

  return (
    <div>
      <div className="relative h-52 bg-shola sm:h-72">
        {host.cover && <Image src={host.cover.src} alt="" fill priority quality={80} sizes="100vw" className="object-cover" />}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      <div className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8">
        <div className="relative -mt-16 flex flex-col items-center text-center sm:-mt-20 sm:flex-row sm:items-end sm:gap-6 sm:text-left">
          <HostAvatar host={host} size={136} ring />
          <div className="mt-4 sm:mb-2">
            <h1 className="font-display text-[clamp(2.4rem,5vw,3.8rem)]">{host.name}</h1>
            <p className="mt-1 text-lg text-muted-foreground">Trip host{host.city ? ` · ${host.city}` : ""}</p>
          </div>
          {host.instagram && (
            <a
              href={`https://instagram.com/${host.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-5 text-base transition-colors hover:border-sun hover:text-sun sm:mb-3 sm:ml-auto sm:mt-0"
            >
              <AtSign aria-hidden className="size-4" />
              {host.instagram}
            </a>
          )}
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-3 text-center sm:justify-start">
          <li>
            <span className="block font-display text-3xl">{host.upcoming.length}</span>
            <span className="text-muted-foreground">upcoming {host.upcoming.length === 1 ? "trip" : "trips"}</span>
          </li>
          {host.pastCount > 0 ? (
            <li>
              <span className="block font-display text-3xl">{host.pastCount}</span>
              <span className="text-muted-foreground">{host.pastCount === 1 ? "trip" : "trips"} hosted</span>
            </li>
          ) : (
            <li className="self-center rounded-full bg-sun px-4 py-1.5 text-base font-bold text-background">New host</li>
          )}
        </ul>

        {host.bio && <p className="mx-auto mt-8 max-w-2xl text-xl sm:mx-0">{host.bio}</p>}
        {host.vibes.length > 0 && (
          <ul className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            {host.vibes.map((v) => (
              <li key={v} className="rounded-full border border-border bg-card px-4 py-1.5 text-base">
                {v}
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="up" className="mt-14">
          <h2 id="up" className="font-display text-3xl">
            Upcoming trips
          </h2>
          {host.upcoming.length > 0 ? (
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {host.upcoming.map((t) => (
                <li key={t.id}>
                  <TripCard trip={t} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-lg text-muted-foreground">No trips are open right now. New dates are on the way.</p>
          )}
        </section>

        {host.past.length > 0 && (
          <section aria-labelledby="past" className="mt-14">
            <h2 id="past" className="font-display text-3xl">
              Past trips
            </h2>
            <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {host.past.map((t) => (
                <li key={t.id}>
                  <TripCard trip={t} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
