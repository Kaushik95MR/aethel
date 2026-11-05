import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPaise, humanize } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { addTraveller, createPaymentLink, recordPayment, removeTraveller, updateBookingStatus } from "../actions";

// Where customers open their payment link. Set WEB_URL to the public site in production.
const WEB_URL = (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "Saved." },
  invalid: { tone: "error", text: "Check the fields and try again." },
  reason_required: { tone: "error", text: "Add a reason before cancelling a booking." },
  no_seats: { tone: "error", text: "Not enough seats left on this departure to confirm." },
  over_balance: { tone: "error", text: "That is more than the balance still owed on this booking." },
  failed: { tone: "error", text: "Couldn't save. You may not have access." },
};

const input = "rounded-md border border-zinc-300 bg-white px-2 py-1.5";
const card = "space-y-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm";

type Booking = {
  id: string;
  reference: string;
  status: string;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  total_paise: number | string;
  cancel_reason: string | null;
  internal_notes: string | null;
  customer: { full_name: string; email: string | null; phone: string | null } | null;
  package: { title: string } | null;
};

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const staff = await requireStaff(["owner", "manager", "agent", "accounts"]);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const flash = sp.saved ? MESSAGES.saved : sp.error ? MESSAGES[sp.error] : undefined;

  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("*, customer:customers(full_name, email, phone), package:packages(title)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const b = data as unknown as Booking;

  const [travellers, payments, summary, events] = await Promise.all([
    supabase.from("travellers").select("id, full_name, date_of_birth, gender, dietary, is_lead").eq("booking_id", id).order("created_at"),
    supabase.from("payments").select("id, kind, amount_paise, status, method, offline_reference, captured_at, provider, pay_token, pay_expires_at").eq("booking_id", id).order("created_at"),
    supabase.from("booking_payment_summary").select("paid_paise, payment_status").eq("booking_id", id).maybeSingle(),
    supabase.from("booking_events").select("id, type, created_at, data").eq("booking_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  const canEdit = staff.role !== "accounts";
  const canPay = ["owner", "manager", "accounts"].includes(staff.role);
  const paid = Number(summary.data?.paid_paise ?? 0);
  const due = Math.max(Number(b.total_paise) - paid, 0);

  const details: [string, React.ReactNode][] = [
    ["Customer", b.customer?.full_name ?? "—"],
    ["Contact", [b.customer?.email, b.customer?.phone].filter(Boolean).join(", ") || "—"],
    ["Trip", b.package?.title ?? b.title ?? "—"],
    ["Travel dates", `${formatDate(b.start_date)} to ${formatDate(b.end_date)}`],
    ["Travellers", `${b.adults} adult${b.adults === 1 ? "" : "s"}${b.children ? `, ${b.children} child${b.children === 1 ? "" : "ren"}` : ""}`],
    ["Total", formatPaise(b.total_paise)],
    ["Paid", formatPaise(paid)],
    ["Balance", formatPaise(due)],
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/bookings" className="text-sm text-zinc-600 underline">
          Back to bookings
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-medium">{b.reference}</h1>
          <StatusBadge status={b.status} />
          <StatusBadge status={summary.data?.payment_status ?? "unpaid"} />
        </div>
      </div>

      {flash && (
        <p
          role={flash.tone === "error" ? "alert" : "status"}
          className={`rounded-md px-3 py-2 text-sm ${flash.tone === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {flash.text}
        </p>
      )}

      <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        {details.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-zinc-500">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        {b.cancel_reason && (
          <div className="contents">
            <dt className="text-zinc-500">Cancel reason</dt>
            <dd>{b.cancel_reason}</dd>
          </div>
        )}
      </dl>

      {canEdit && (
        <form action={updateBookingStatus} className={card}>
          <input type="hidden" name="id" value={b.id} />
          <h2 className="font-medium">Booking status</h2>
          <p className="text-zinc-500">Confirming takes seats from the departure. Cancelling needs a reason.</p>
          <div className="flex flex-wrap gap-2">
            <select name="status" defaultValue={b.status} className={input}>
              {["pending", "confirmed", "completed", "cancelled"].map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
            <input name="cancel_reason" maxLength={500} defaultValue={b.cancel_reason ?? ""} placeholder="Reason, required if cancelled" className={`${input} min-w-64 flex-1`} />
          </div>
          <button type="submit" className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800">
            Save
          </button>
        </form>
      )}

      <section id="travellers" className={`${card} scroll-mt-6`}>
        <h2 className="font-medium">Travellers</h2>
        <ul className="divide-y divide-zinc-100">
          {(travellers.data ?? []).map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {t.full_name}
                {t.is_lead && <span className="ml-2 text-xs text-zinc-500">Lead</span>}
                <span className="block text-xs text-zinc-500">
                  {[t.date_of_birth && formatDate(t.date_of_birth), t.gender, t.dietary].filter(Boolean).join(", ")}
                </span>
              </span>
              {canEdit && (
                <form action={removeTraveller}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="booking_id" value={b.id} />
                  <button type="submit" className="text-red-700 underline">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
          {(travellers.data ?? []).length === 0 && <li className="py-2 text-zinc-500">No travellers added yet.</li>}
        </ul>
        {canEdit && (
          <form action={addTraveller} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3">
            <input type="hidden" name="booking_id" value={b.id} />
            <input name="full_name" required maxLength={120} placeholder="Full name" aria-label="Full name" className={input} />
            <input type="date" name="date_of_birth" aria-label="Date of birth" className={input} />
            <input name="gender" maxLength={30} placeholder="Gender" aria-label="Gender" className={`${input} w-28`} />
            <input name="dietary" maxLength={200} placeholder="Dietary needs" aria-label="Dietary needs" className={input} />
            <label className="flex items-center gap-1">
              <input type="checkbox" name="is_lead" /> Lead
            </label>
            <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50">
              Add traveller
            </button>
          </form>
        )}
      </section>

      <section id="payments" className={`${card} scroll-mt-6`}>
        <h2 className="font-medium">Payments</h2>
        <ul className="divide-y divide-zinc-100">
          {(payments.data ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {formatPaise(p.amount_paise)} <span className="text-zinc-500">{humanize(p.kind)}</span>
                <span className="block text-xs text-zinc-500">
                  {[humanize(p.provider), p.method, p.offline_reference, formatDate(p.captured_at)].filter(Boolean).join(", ")}
                </span>
                {p.provider === "cashfree" && p.status === "created" && p.pay_token && (
                  <span className="mt-1 block">
                    <input
                      readOnly
                      value={`${WEB_URL}/pay/${p.pay_token}`}
                      aria-label="Payment link"
                      className={`${input} w-full min-w-64 text-xs`}
                    />
                    <span className="text-xs text-zinc-500">
                      Send this link to the customer. It expires {formatDate(p.pay_expires_at)}.
                    </span>
                  </span>
                )}
              </span>
              <StatusBadge status={p.status} />
            </li>
          ))}
          {(payments.data ?? []).length === 0 && <li className="py-2 text-zinc-500">No payments recorded.</li>}
        </ul>
        {canPay && due > 0 && (
          <form action={createPaymentLink} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3">
            <input type="hidden" name="booking_id" value={b.id} />
            <span className="w-full font-medium">Collect online</span>
            <input name="amount" required inputMode="decimal" defaultValue={String(due / 100)} aria-label="Amount in rupees" className={`${input} w-32`} />
            <select name="kind" defaultValue={paid > 0 ? "balance" : "deposit"} aria-label="Payment type" className={input}>
              <option value="deposit">Deposit</option>
              <option value="balance">Balance</option>
              <option value="full">Full</option>
            </select>
            <button type="submit" className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800">
              Create payment link
            </button>
          </form>
        )}
        {canPay && (
          <form action={recordPayment} className="flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3">
            <input type="hidden" name="booking_id" value={b.id} />
            <input name="amount" required inputMode="decimal" placeholder="Amount (₹)" aria-label="Amount in rupees" className={`${input} w-32`} />
            <select name="kind" defaultValue="deposit" aria-label="Payment type" className={input}>
              <option value="deposit">Deposit</option>
              <option value="balance">Balance</option>
              <option value="full">Full</option>
            </select>
            <input name="method" maxLength={40} placeholder="UPI, cash, bank" aria-label="Method" className={`${input} w-36`} />
            <input name="offline_reference" maxLength={120} placeholder="Reference" aria-label="Reference" className={input} />
            <button type="submit" className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50">
              Record payment
            </button>
          </form>
        )}
      </section>

      <section className={card}>
        <h2 className="font-medium">History</h2>
        <ul className="space-y-1 text-zinc-600">
          {(events.data ?? []).map((e) => (
            <li key={e.id}>
              {humanize(e.type)} <span className="text-xs text-zinc-500">{formatDate(e.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
