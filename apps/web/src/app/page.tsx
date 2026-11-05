import { CategoryTiles } from "@/components/home/category-tiles";
import { HomeHero } from "@/components/home/home-hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { OpenTrips } from "@/components/home/open-trips";
import { PlaceIdeas } from "@/components/home/place-ideas";
import { getPackages, getUpcomingDepartures } from "@/lib/catalogue";

export default async function Home() {
  const [packages, departures] = await Promise.all([getPackages(), getUpcomingDepartures(30)]);

  return (
    <>
      <HomeHero />
      <CategoryTiles />
      <OpenTrips packages={packages} departures={departures} />
      <PlaceIdeas />
      <HowItWorks />
    </>
  );
}
