import { revalidateTag } from "next/cache";
import { verifyWebhook } from "@/lib/cashfree";
import { paymentIdFromOrder, settlePayment } from "@/lib/payments";
import { createServiceClient } from "@/lib/service-client";

type Hook = {
  type?: string;
  data?: { order?: { order_id?: string }; payment?: { cf_payment_id?: number | string } };
};

/** Cashfree calls this when a payment succeeds or fails. We check the signature, then ask Cashfree for the truth. */
export async function POST(request: Request) {
  const raw = await request.text();
  const ok = verifyWebhook(raw, request.headers.get("x-webhook-timestamp"), request.headers.get("x-webhook-signature"));
  if (!ok) return new Response("Invalid signature", { status: 401 });

  let hook: Hook;
  try {
    hook = JSON.parse(raw) as Hook;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const orderId = hook.data?.order?.order_id ?? "";
  const paymentId = paymentIdFromOrder(orderId);
  // Connection tests and orders that aren't ours get a quiet yes so Cashfree stops retrying.
  if (!paymentId || !/^[0-9a-f-]{36}$/.test(paymentId)) return new Response("Ignored", { status: 200 });

  const db = createServiceClient();
  const eventId = `${hook.type ?? "event"}:${orderId}:${hook.data?.payment?.cf_payment_id ?? ""}`;
  await db.from("payment_events").upsert(
    { provider_event_id: eventId, type: hook.type ?? "unknown", payload: JSON.parse(raw) },
    { onConflict: "provider_event_id", ignoreDuplicates: true },
  );

  try {
    await settlePayment(paymentId);
    await db.from("payment_events").update({ processed_at: new Date().toISOString(), error: null }).eq("provider_event_id", eventId);
    revalidateTag("catalogue", { expire: 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "settle failed";
    await db.from("payment_events").update({ error: message.slice(0, 500) }).eq("provider_event_id", eventId);
    // A 500 makes Cashfree retry later.
    return new Response("Retry", { status: 500 });
  }
  return new Response("OK", { status: 200 });
}
