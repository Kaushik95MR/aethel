import type { Metadata } from "next";
import { DestinationCard } from "@/components/destination-card";
import { getDestinations } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Destinations" };

export default async function DestinationsPage() {
  const destinations = await getDestinations();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-28">
      <h1 className="font-display text-5xl font-semibold">Destinations</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {destinations.map((d) => (
          <li key={d.id}>
            <DestinationCard destination={d} />
          </li>
        ))}
        {destinations.length === 0 && <li className="text-muted-foreground">Destinations are coming soon.</li>}
      </ul>
    </div>
  );
}
