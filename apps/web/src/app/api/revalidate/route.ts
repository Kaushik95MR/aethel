import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * The admin calls this after staff change a trip, a date, a host or a booking, so the website shows the change straight away.
 * The trip data is saved ("cached") so thousands of visitors do not each ask the database; this clears that saved copy.
 * It only opens for the shared secret in REVALIDATE_SECRET.
 */
export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || expected.length < 16) return Response.json({ ok: false, error: "not configured" }, { status: 503 });

  const given = Buffer.from(request.headers.get("x-revalidate-secret") ?? "");
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return Response.json({ ok: false }, { status: 403 });

  revalidateTag("catalogue", { expire: 0 });
  return Response.json({ ok: true });
}
