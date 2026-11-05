import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API_VERSION = "2023-08-01";

/** Keys come from the environment. Sandbox is the default so a missing setting can never take real money. */
function config() {
  const id = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!id || !secret) return null;
  const production = process.env.CASHFREE_ENV === "production";
  return { id, secret, production, base: production ? "https://api.cashfree.com" : "https://sandbox.cashfree.com" };
}

export const cashfreeConfigured = () => config() !== null;
export const cashfreeMode = () => (config()?.production ? "production" : "sandbox");

export type CfOrder = { order_id: string; order_status: string; order_amount: number; payment_session_id: string };
export type CfPayment = {
  cf_payment_id: number | string;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "NOT_ATTEMPTED" | "USER_DROPPED" | string;
  payment_amount: number;
  payment_group?: string;
  payment_message?: string;
};

async function call<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown }): Promise<T> {
  const c = config();
  if (!c) throw new Error("Cashfree is not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY).");
  const res = await fetch(`${c.base}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "x-client-id": c.id,
      "x-client-secret": c.secret,
      "x-api-version": API_VERSION,
      "content-type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cashfree ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Cashfree takes rupees with two decimals; the ledger keeps whole paise. */
const toRupees = (paise: number) => Number((paise / 100).toFixed(2));

export function createOrder(input: {
  orderId: string;
  amountPaise: number;
  customerId: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerName?: string | null;
  returnUrl: string;
  notifyUrl: string;
  note?: string;
}) {
  return call<CfOrder>("/pg/orders", {
    method: "POST",
    body: {
      order_id: input.orderId,
      order_amount: toRupees(input.amountPaise),
      order_currency: "INR",
      order_note: input.note,
      customer_details: {
        customer_id: input.customerId,
        customer_phone: input.customerPhone,
        ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
        ...(input.customerName ? { customer_name: input.customerName } : {}),
      },
      order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
    },
  });
}

export const getOrder = (orderId: string) => call<CfOrder>(`/pg/orders/${encodeURIComponent(orderId)}`);
export const getOrderPayments = (orderId: string) => call<CfPayment[]>(`/pg/orders/${encodeURIComponent(orderId)}/payments`);

/** The webhook signature is base64(HMAC-SHA256(timestamp + rawBody)) keyed with the secret. */
export function verifyWebhook(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const c = config();
  if (!c || !timestamp || !signature) return false;
  const expected = createHmac("sha256", c.secret).update(timestamp + rawBody).digest();
  const given = Buffer.from(signature, "base64");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
