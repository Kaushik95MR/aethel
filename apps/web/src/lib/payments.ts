import "server-only";
import { getOrderPayments } from "@/lib/cashfree";
import { createServiceClient } from "@/lib/service-client";

export const orderIdFor = (paymentId: string) => `aethel_${paymentId}`;
export const paymentIdFromOrder = (orderId: string) => (orderId.startsWith("aethel_") ? orderId.slice(7) : null);

/**
 * Asks Cashfree what really happened to this payment and updates the ledger to match.
 * It never trusts the browser or the webhook body, so it is safe to call from both and as often as needed.
 */
export async function settlePayment(paymentId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data: p } = await db
    .from("payments")
    .select("id, booking_id, amount_paise, status, provider, provider_order_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!p || p.provider !== "cashfree") return null;
  if (p.status === "captured" || !p.provider_order_id) return p.status;

  const attempts = await getOrderPayments(p.provider_order_id);
  const win = attempts.find((a) => a.payment_status === "SUCCESS");

  if (win) {
    // Only count the money when it matches what we asked for.
    if (Math.round(Number(win.payment_amount) * 100) !== Number(p.amount_paise)) {
      console.error(`Payment ${p.id}: gateway amount ${win.payment_amount} does not match ${p.amount_paise} paise.`);
      await db.from("payments").update({ failure_code: "amount_mismatch", raw: win }).eq("id", p.id);
      return p.status;
    }
    const { data: done } = await db
      .from("payments")
      .update({
        status: "captured",
        captured_at: new Date().toISOString(),
        method: win.payment_group ?? null,
        provider_payment_id: String(win.cf_payment_id),
        failure_code: null,
        failure_reason: null,
        raw: win,
      })
      .eq("id", p.id)
      .neq("status", "captured")
      .select("id");
    // Only the call that flips the status writes the history line, so repeat webhooks don't duplicate it.
    if (done?.length) {
      await db.from("booking_events").insert({
        booking_id: p.booking_id,
        type: "payment_received",
        actor_type: "system",
        data: { amount_paise: Number(p.amount_paise), provider: "cashfree" },
      });
    }
    return "captured";
  }

  // A failed attempt leaves the link usable so the customer can try another method.
  const failed = attempts.find((a) => a.payment_status === "FAILED" || a.payment_status === "USER_DROPPED");
  if (failed) {
    await db
      .from("payments")
      .update({ failure_code: failed.payment_status, failure_reason: failed.payment_message?.slice(0, 200) ?? null })
      .eq("id", p.id);
  }
  return p.status;
}
