import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrekStory } from "@/components/trek/trek-story";
import { getItinerary, getPackage, getPackages } from "@/lib/catalogue";
import { isTrek } from "@/lib/treks";

export async function generateStaticParams() {
  const packages = await getPackages();
  return packages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/packages/[slug]/story">): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await getPackage(slug);
  return pkg ? { title: `${pkg.title}, the trip story`, description: pkg.summary ?? undefined } : {};
}

// The scroll-through story of the trip: photos, video and sound for every step of the itinerary.
export default async function TripStoryPage({ params }: PageProps<"/packages/[slug]/story">) {
  const { slug } = await params;
  const pkg = await getPackage(slug);
  if (!pkg) notFound();
  const itinerary = await getItinerary(slug);
  if (!itinerary?.days.some((d) => d.steps.length) && !isTrek(slug)) notFound();
  return <TrekStory pkg={pkg} itinerary={itinerary} />;
}
