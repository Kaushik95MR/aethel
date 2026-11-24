import type { Metadata } from "next";
import Link from "next/link";
import { TripCatalogue } from "@/components/trip-catalogue";
import { getPackages, getUpcomingDepartures } from "@/lib/catalogue";
import { buildCatalogue, categoryTabs } from "@/lib/catalogue-view";

export const metadata: Metadata = { title: "Trips", description: "Group trips with a host. Pick a trip, see who is hosting and book." };

export default async function TripsPage() {
  const [trips, packages] = await Promise.all([getUpcomingDepartures(60), getPackages()]);
  const catalogue = buildCatalogue(packages, trips);

  return (
    <div className="gh">
      <header className="pagehead">
        <h1 className="d">Trips</h1>
        <p>Every trip has an experienced host and a full plan. Pick one and book.</p>
      </header>
      <section className="catalogue tight" aria-label="Trips to book">
        {catalogue.length > 0 ? (
          <TripCatalogue trips={catalogue} tabs={categoryTabs(packages)} />
        ) : (
          <div>
            <p className="sub" style={{ fontSize: 28, maxWidth: "24ch" }}>
              New trips are on the way. Leave your number and we will tell you first.
            </p>
            <p style={{ marginTop: 24 }}>
              <Link className="btn" href="/contact">
                Call me back
              </Link>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
