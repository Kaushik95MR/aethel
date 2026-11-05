import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { formatDate, formatPaise } from "@/lib/format";
import { settlePayment } from "@/lib/payments";
import { createServiceClient } from "@/lib/service-client";
import { PayButton } from "./pay-button";

export const metadata: Metadata = { title: "Pay for your trip", robots: { index: false, follow: false } };

type Row = {
  id: string;
  amount_paise: number | string;
  status: string;
  provider: string;
  provider_order_id: string | null;
  pay_expires_at: string | null;
  captured_at: string | null;
  booking: {
    reference: string;
    title: string | null;
    start_date: string | null;
    package: { title: string } | null;
    customer: { full_name: string; phone: string | null };
  };
};

const SELECT =
  "id, amount_paise, status, provider, provider_order_id, pay_expires_at, captured_at, booking:bookings(reference, title, start_date, package:packages(title), customer:customers(full_name, phone))";

export default function PayPage({ params }: PageProps<"/pay/[token]">) {
  return (
    <div className="mx-auto max-w-md px-5 pb-12 pt-28">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/pay/[token]">["params"] }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) notFound();

  const db = createServiceClient();
  const load = async () => {
    const { data } = await db.from("payments").select(SELECT).eq("pay_token", token).maybeSingle();
    return data as unknown as Row | null;
  };
  let p = await load();
  if (!p || p.provider !== "cashfree") notFound();

  // Coming back from checkout: confirm with Cashfree right now instead of waiting for the webhook.
  if (p.status === "created" && p.provider_order_id) {
    await settlePayment(p.id).catch(() => null);
    p = (await load()) ?? p;
  }

  const trip = p.booking.package?.title ?? p.booking.title ?? "Your trip";
  const amount = formatPaise(p.amount_paise);
  const expired = p.status === "created" && p.pay_expires_at !== null && new Date(p.pay_expires_at) < new Date();

  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <p className="text-sm text-muted-foreground">Booking {p.booking.reference}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">{trip}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {p.booking.customer.full_name}
        {p.booking.start_date ? `, starting ${formatDate(p.booking.start_date)}` : ""}
      </p>

      {p.status === "captured" ? (
        <div className="mt-6 rounded-xl bg-green-50 p-4 text-green-800">
          <p className="font-medium">Payment received, thank you.</p>
          <p className="mt-1 text-sm">
            {amount} paid. We&apos;ll confirm your seat and send trip details soon. Keep this reference: {p.booking.reference}.
          </p>
        </div>
      ) : expired ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-900">This link has expired. Please ask us for a new one.</p>
      ) : p.status !== "created" ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-900">This payment link is no longer active. Please ask us for a new one.</p>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">Amount to pay</p>
          <p className="font-display text-4xl font-semibold">{amount}</p>
          <PayButton token={token} amount={amount} needsPhone={(p.booking.customer.phone ?? "").replace(/\D/g, "").length < 10} />
        </>
      )}
    </div>
  );
}
