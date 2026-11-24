"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { attachPackagePhoto } from "../actions";

const MAX_BYTES = 10 * 1024 * 1024; // matches the public-media bucket limit
const OK = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Uploads straight from the browser to storage, then adds each picture to the trip's gallery. Several can be chosen at once. */
export function PhotoUploader({ packageId }: { packageId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    const supabase = createClient();
    let added = 0;
    for (const file of Array.from(files)) {
      if (!OK.includes(file.type)) {
        setMessage(`${file.name}: use a JPG, PNG, WebP or AVIF photo.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setMessage(`${file.name} is over 10 MB. Compress it and try again.`);
        continue;
      }
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `packages/${packageId}/${crypto.randomUUID()}.${ext}`;
      setMessage(`Uploading ${file.name}…`);
      const { error } = await supabase.storage.from("public-media").upload(path, file, { contentType: file.type });
      if (error) {
        setMessage("Upload failed. You may not have permission to add photos to this trip, or the connection dropped.");
        continue;
      }
      const res = await attachPackagePhoto({ packageId, path, bytes: file.size, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") });
      if (!res.ok) {
        setMessage("Uploaded, but couldn't add the photo to this trip.");
        continue;
      }
      added += 1;
    }
    if (added) setMessage(null);
    if (input.current) input.current.value = "";
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-1 text-right">
      <label className="inline-flex min-h-[34px] cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100">
        {busy ? "Adding…" : "Add photos"}
        <input ref={input} type="file" multiple accept={OK.join(",")} className="sr-only" onChange={(e) => onPick(e.target.files)} />
      </label>
      {message && (
        <p role="status" className="max-w-xs text-xs text-zinc-500">
          {message}
        </p>
      )}
    </div>
  );
}
