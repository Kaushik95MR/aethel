import type { Metadata } from "next";
import Image from "next/image";
import { PageShell } from "@/components/page-shell";
import { getPackages } from "@/lib/catalogue";

export const metadata: Metadata = { title: "Gallery", description: "Pictures from the places our trips go." };

export default async function GalleryPage() {
  const packages = await getPackages();
  const photos = [...new Map(packages.flatMap((p) => p.gallery).map((g) => [g.src, g])).values()];
  const credits = [...new Map(photos.flatMap((g) => (g.credit ? [g.credit] : [])).map((c) => [c.source, c])).values()];

  return (
    <PageShell title="Gallery" intro="Beaches, sunsets and bonfire nights from the places we travel to." wide>
      {photos.length > 0 ? (
        <div className="shots">
          {photos.map((g, i) => (
            <figure key={g.src}>
              <Image src={g.src} alt={g.alt} fill priority={i < 3} quality={75} sizes="(min-width: 860px) 33vw, 50vw" />
            </figure>
          ))}
        </div>
      ) : (
        <p>Pictures are on the way.</p>
      )}

      {credits.length > 0 && (
        <details id="credits" className="credits">
          <summary>Photo credits</summary>
          <p style={{ marginTop: 12 }}>
            These photographs are by other photographers, shared under open licences, and show the feel of the coast. Some are from nearby places.
            We will add pictures from our own trips.
          </p>
          <ul>
            {credits.map((c) => (
              <li key={c.source}>
                <a href={c.source} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                  {c.title}
                </a>
                , {c.author},{" "}
                {c.licenseUrl ? (
                  <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                    {c.license}
                  </a>
                ) : (
                  c.license
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </PageShell>
  );
}
