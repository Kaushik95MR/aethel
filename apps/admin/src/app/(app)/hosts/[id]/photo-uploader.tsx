"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { setHostPhoto } from "../actions";

const MAX_BYTES = 10 * 1024 * 1024; // matches the public-media bucket limit
const OK = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** Uploads straight from the browser to storage, then links the picture to the host. */
export function PhotoUploader({ hostId, name, hasPhoto }: { hostId: string; name: string; hasPhoto: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setMessage(null);
    if (!OK.includes(file.type)) return setMessage("Use a JPG, PNG, WebP or AVIF photo.");
    if (file.size > MAX_BYTES) return setMessage("That file is over 10 MB. Compress it and try again.");

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `hosts/${hostId}/${crypto.randomUUID()}.${ext}`;
    setMessage("Uploading…");
    const { error } = await createClient().storage.from("public-media").upload(path, file, { contentType: file.type });
    if (error) return setMessage("Upload failed. Check your connection and try again.");

    startTransition(async () => {
      const res = await setHostPhoto({ hostId, path, bytes: file.size, alt: `${name}, trip host` });
      if (!res.ok) return setMessage("Uploaded, but couldn't attach the photo to this host.");
      setMessage(null);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <label className="inline-flex min-h-[34px] cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium hover:bg-zinc-100">
        {busy ? "Saving…" : hasPhoto ? "Replace photo" : "Add photo"}
        <input ref={input} type="file" accept={OK.join(",")} className="sr-only" onChange={(e) => onPick(e.target.files)} />
      </label>
      {message && (
        <p role="status" className="text-xs text-zinc-500">
          {message}
        </p>
      )}
    </div>
  );
}
