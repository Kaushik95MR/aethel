import "server-only";
import { revalidatePath as nextRevalidatePath } from "next/cache";
import { after } from "next/server";

/** Tells the public website to drop its saved trip data, so staff changes show up straight away. */
export async function refreshWebsite() {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return;
  const base = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/revalidate`, { method: "POST", headers: { "x-revalidate-secret": secret }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) console.error(`The website did not accept the refresh (status ${res.status}).`);
  } catch (e) {
    console.error("Couldn't tell the website to refresh:", e instanceof Error ? e.message : e);
  }
}

/**
 * Use this instead of next/cache's revalidatePath in the admin's actions. It refreshes the admin screen as before, and also
 * (after the reply has gone to the browser, so nothing waits) tells the website to refresh.
 */
export function revalidatePath(path: string, type?: "layout" | "page") {
  nextRevalidatePath(path, type);
  after(refreshWebsite);
}
