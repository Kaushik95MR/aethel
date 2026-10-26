import type { Metadata } from "next";
import { PackageCard } from "@/components/package-card";
import { getPackages } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesPage() {
  const packages = await getPackages();
  return (
    <div className="mx-auto max-w-6xl px-5 pb-12 pt-28">
      <h1 className="font-display text-4xl font-semibold">Packages</h1>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((p) => (
          <li key={p.id}>
            <PackageCard pkg={p} />
          </li>
        ))}
        {packages.length === 0 && <li className="text-muted-foreground">Packages are coming soon.</li>}
      </ul>
    </div>
  );
}
