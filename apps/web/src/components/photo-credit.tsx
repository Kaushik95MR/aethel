import type { Photo } from "@/lib/photos";

// Creative Commons licences require attribution next to the image's use.
export function PhotoCredit({ photo }: { photo: Photo }) {
  return (
    <p className="mt-8 text-xs text-muted-foreground">
      Photo:{" "}
      <a href={photo.source} className="underline hover:text-foreground" rel="noopener noreferrer">
        {photo.title}
      </a>{" "}
      by {photo.author},{" "}
      {photo.licenseUrl ? (
        <a href={photo.licenseUrl} className="underline hover:text-foreground" rel="noopener noreferrer">
          {photo.license}
        </a>
      ) : (
        photo.license
      )}
      , via Wikimedia Commons.
    </p>
  );
}
