"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { cashfreeConfigured, cashfreeMode, createOrder, getOrder } from "@/lib/cashfree";
import { orderIdFor, settlePayment } from "@/lib/payments";
import { createServiceClient } from "@/lib/service-client";

export type StartResult =
  | { ok: true; sessionId: string; mode: "sandbox" | "production" }
  | { ok: true; paid: true }
  | { ok: false; error: string };

const input = z.object({
  token: z.string().min(20).max(80).regex(/^[A-Za-z0-9_-]+$/),
  phone: z.string().trim().max(30).optional(),
});

/** Where Cashfree sends the customer back to, and where it posts webhooks. Prefer the configured address over request headers. */
async function origin(): Promise<string> {
  const configured = process.env.SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Creates (or reuses) the Cashfree order for a payment link and returns the session the browser needs to open checkout. */
export async function startPayment(raw: { token: string; phone?: string }): Promise<StartResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "This payment link isn't valid." };
  if (!cashfreeConfigured()) return { ok: false, error: "Online payment isn't switched on yet. Please contact us to pay." };

  const db = createServiceClient();
  const { data: p } = await db
    .from("payments")
    .select(
      "id, amount_paise, status, provider, provider_order_id, pay_expires_at, booking:bookings(reference, title, package:packages(title), customer:customers(id, full_name, email, phone))",
    )
    .eq("pay_token", parsed.data.token)
    .maybeSingle();
  if (!p || p.provider !== "cashfree") return { ok: false, error: "This payment link isn't valid." };
  if (p.status === "captured") return { ok: true, paid: true };
  if (p.status !== "created") return { ok: false, error: "This payment link is no longer active. Please ask us for a new one." };
  if (p.pay_expires_at && new Date(p.pay_expires_at) < new Date()) {
    return { ok: false, error: "This payment link has expired. Please ask us for a new one." };
  }

  const booking = p.booking as unknown as {
    reference: string;
    title: string | null;
    package: { title: string } | null;
    customer: { id: string; full_name: string; email: string | null; phone: string | null };
  };
  // Cashfree needs a 10-digit mobile number. Use the one on file, or the one typed on the pay page.
  const digits = (parsed.data.phone || booking.customer.phone || "").replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return { ok: false, error: "Enter a 10-digit mobile number." };

  const orderId = orderIdFor(p.id);
  try {
    // A retry reuses the open order, so one link never charges twice.
    if (p.provider_order_id) {
      const existing = await getOrder(p.provider_order_id);
      if (existing.order_status === "PAID") {
        await settlePayment(p.id);
        return { ok: true, paid: true };
      }
      return { ok: true, sessionId: existing.payment_session_id, mode: cashfreeMode() };
    }

    const base = await origin();
    const order = await createOrder({
      orderId,
      amountPaise: Number(p.amount_paise),
      customerId: booking.customer.id,
      customerPhone: digits,
      customerEmail: booking.customer.email,
      customerName: booking.customer.full_name,
      returnUrl: `${base}/pay/${parsed.data.token}`,
      notifyUrl: `${base}/api/webhooks/cashfree`,
      note: `${booking.reference} ${booking.package?.title ?? booking.title ?? ""}`.trim().slice(0, 100),
    });
    await db.from("payments").update({ provider_order_id: orderId }).eq("id", p.id);
    return { ok: true, sessionId: order.payment_session_id, mode: cashfreeMode() };
  } catch (e) {
    console.error("startPayment failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "We couldn't start the payment. Please try again in a minute." };
  }
}
