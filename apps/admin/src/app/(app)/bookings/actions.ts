"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

function rupeesToPaise(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && String(v ?? "").trim() !== "" ? Math.round(n * 100) : null;
}

const createSchema = z.object({
  enquiry_id: uuid,
  departure_id: uuid,
  adults: z.coerce.number().int().min(0).max(100),
  children: z.coerce.number().int().min(0).max(100),
});

/** Turns an enquiry into a pending booking, reusing the customer by email when one exists. */
export async function createBookingFromEnquiry(formData: FormData) {
  const staff = await requireStaff(["owner", "manager", "agent"]);
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  const total = rupeesToPaise(formData.get("total"));
  const enquiryId = uuid.safeParse(formData.get("enquiry_id"));
  if (!enquiryId.success) redirect("/enquiries");
  const back = `/enquiries/${enquiryId.data}`;
  if (!parsed.success || total === null || parsed.data.adults + parsed.data.children < 1) redirect(`${back}?error=booking_invalid`);
  const { enquiry_id, departure_id, adults, children } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("bookings").select("id").eq("enquiry_id", enquiry_id).maybeSingle();
  if (existing) redirect(`/bookings/${existing.id}`);

  const [{ data: enq }, { data: dep }] = await Promise.all([
    supabase.from("enquiries").select("id, name, email, phone, customer_id").eq("id", enquiry_id).maybeSingle(),
    supabase.from("departures").select("id, package_id, start_date, end_date, package:packages(title)").eq("id", departure_id).maybeSingle(),
  ]);
  if (!enq || !dep) redirect(`${back}?error=booking_failed`);

  let customerId = enq.customer_id as string | null;
  if (!customerId && enq.email) {
    const { data: c } = await supabase.from("customers").select("id").eq("email", enq.email).maybeSingle();
    customerId = c?.id ?? null;
  }
  if (!customerId) {
    const { data: c, error } = await supabase
      .from("customers")
      .insert({ full_name: enq.name, email: enq.email, phone: enq.phone })
      .select("id")
      .maybeSingle();
    if (error || !c) redirect(`${back}?error=booking_failed`);
    customerId = c.id;
  }

  const pkgTitle = (dep.package as unknown as { title: string } | null)?.title ?? "Trip";
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      customer_id: customerId,
      enquiry_id,
      package_id: dep.package_id,
      departure_id,
      start_date: dep.start_date,
      end_date: dep.end_date,
      adults,
      children,
      total_paise: total,
      assigned_to: staff.userId,
      created_by: staff.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !booking) redirect(`${back}?error=booking_failed`);

  await supabase.from("booking_items").insert({
    booking_id: booking.id,
    kind: "package",
    description: `${pkgTitle}, ${adults + children} traveller${adults + children === 1 ? "" : "s"}`,
    unit_price_paise: total,
  });
  await supabase.from("booking_events").insert({
    booking_id: booking.id,
    type: "created",
    actor_type: "staff",
    actor_id: staff.userId,
    data: { enquiry_id },
  });
  await supabase.from("enquiries").update({ status: "won", customer_id: customerId }).eq("id", enquiry_id);

  revalidatePath("/bookings");
  revalidatePath("/enquiries");
  redirect(`/bookings/${booking.id}?saved=1`);
}

const statusSchema = z.object({
  id: uuid,
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
  cancel_reason: z.string().trim().max(500).optional(),
});

export async function updateBookingStatus(formData: FormData) {
  const staff = await requireStaff(["owner", "manager", "agent"]);
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    cancel_reason: formData.get("cancel_reason") || undefined,
  });
  if (!parsed.success) redirect("/bookings");
  const { id, status, cancel_reason } = parsed.data;
  // The "Who is going" screen asks to come back to itself afterwards. Only that exact kind of address is allowed.
  const returnTo = String(formData.get("return_to") ?? "");
  const back = /^\/catalogue\/[0-9a-f-]{36}\/dates\/[0-9a-f-]{36}$/.test(returnTo) ? returnTo : `/bookings/${id}`;
  if (status === "cancelled" && !cancel_reason) redirect(`${back}?error=reason_required`);

  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("id, departure_id, adults, children")
    .eq("id", id)
    .maybeSingle();
  if (!b) redirect(`${back}?error=failed`);

  // Confirming takes seats, so refuse when the departure would be oversold.
  if (status === "confirmed" && b.departure_id) {
    const [{ data: dep }, { data: taken }] = await Promise.all([
      supabase.from("departures").select("capacity").eq("id", b.departure_id).maybeSingle(),
      supabase
        .from("bookings")
        .select("adults, children")
        .eq("departure_id", b.departure_id)
        .in("status", ["confirmed", "completed"])
        .neq("id", id),
    ]);
    const used = (taken ?? []).reduce((n, r) => n + r.adults + r.children, 0);
    if (dep && used + b.adults + b.children > dep.capacity) redirect(`${back}?error=no_seats`);
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({
      status,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
      cancel_reason: status === "cancelled" ? cancel_reason : null,
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) redirect(`${back}?error=failed`);

  await supabase.from("booking_events").insert({
    booking_id: id,
    type: `status_${status}`,
    actor_type: "staff",
    actor_id: staff.userId,
    data: cancel_reason ? { reason: cancel_reason } : {},
  });
  revalidatePath("/bookings");
  redirect(`${back}?saved=1`);
}

const travellerSchema = z.object({
  booking_id: uuid,
  full_name: z.string().trim().min(1).max(120),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.string().trim().max(30).optional(),
  dietary: z.string().trim().max(200).optional(),
  is_lead: z.boolean(),
});

export async function addTraveller(formData: FormData) {
  await requireStaff(["owner", "manager", "agent"]);
  const parsed = travellerSchema.safeParse({
    booking_id: formData.get("booking_id"),
    full_name: formData.get("full_name"),
    date_of_birth: formData.get("date_of_birth") || undefined,
    gender: formData.get("gender") || undefined,
    dietary: formData.get("dietary") || undefined,
    is_lead: formData.get("is_lead") === "on",
  });
  const bid = uuid.safeParse(formData.get("booking_id"));
  if (!bid.success) redirect("/bookings");
  if (!parsed.success) redirect(`/bookings/${bid.data}?error=invalid#travellers`);

  const supabase = await createClient();
  const { error } = await supabase.from("travellers").insert(parsed.data);
  if (error) redirect(`/bookings/${bid.data}?error=failed#travellers`);
  revalidatePath(`/bookings/${bid.data}`);
  redirect(`/bookings/${bid.data}?saved=1#travellers`);
}

export async function removeTraveller(formData: FormData) {
  await requireStaff(["owner", "manager", "agent"]);
  const p = z.object({ id: uuid, booking_id: uuid }).safeParse(Object.fromEntries(formData));
  if (!p.success) redirect("/bookings");
  const supabase = await createClient();
  await supabase.from("travellers").delete().eq("id", p.data.id);
  revalidatePath(`/bookings/${p.data.booking_id}`);
  redirect(`/bookings/${p.data.booking_id}#travellers`);
}

const paymentSchema = z.object({
  booking_id: uuid,
  kind: z.enum(["deposit", "balance", "full"]),
  method: z.string().trim().max(40).optional(),
  offline_reference: z.string().trim().max(120).optional(),
});

const linkSchema = z.object({ booking_id: uuid, kind: z.enum(["deposit", "balance", "full"]) });

/** Creates a payment link the customer opens to pay online. The webhook marks it paid, so staff never type that in. */
export async function createPaymentLink(formData: FormData) {
  const staff = await requireStaff(["owner", "manager", "accounts"]);
  const bid = uuid.safeParse(formData.get("booking_id"));
  if (!bid.success) redirect("/bookings");
  const amount = rupeesToPaise(formData.get("amount"));
  const parsed = linkSchema.safeParse({ booking_id: formData.get("booking_id"), kind: formData.get("kind") });
  if (!parsed.success || !amount || amount < 100) redirect(`/bookings/${bid.data}?error=invalid#payments`);

  const supabase = await createClient();
  // A link can never ask for more than is still owed.
  const { data: s } = await supabase.from("booking_payment_summary").select("total_paise, paid_paise").eq("booking_id", bid.data).maybeSingle();
  if (!s || amount > Number(s.total_paise) - Number(s.paid_paise)) redirect(`/bookings/${bid.data}?error=over_balance#payments`);

  const { error } = await supabase.from("payments").insert({
    ...parsed.data,
    provider: "cashfree",
    amount_paise: amount,
    status: "created",
    pay_token: randomBytes(24).toString("base64url"),
    pay_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    recorded_by: staff.userId,
  });
  if (error) redirect(`/bookings/${bid.data}?error=failed#payments`);

  await supabase.from("booking_events").insert({
    booking_id: bid.data,
    type: "payment_link_created",
    actor_type: "staff",
    actor_id: staff.userId,
    data: { amount_paise: amount, kind: parsed.data.kind },
  });
  revalidatePath(`/bookings/${bid.data}`);
  redirect(`/bookings/${bid.data}?saved=1#payments`);
}

/** Records money received outside the gateway (cash, bank transfer, UPI). Online payments arrive through the webhook. */
export async function recordPayment(formData: FormData) {
  const staff = await requireStaff(["owner", "manager", "accounts"]);
  const bid = uuid.safeParse(formData.get("booking_id"));
  if (!bid.success) redirect("/bookings");
  const amount = rupeesToPaise(formData.get("amount"));
  const parsed = paymentSchema.safeParse({
    booking_id: formData.get("booking_id"),
    kind: formData.get("kind"),
    method: formData.get("method") || undefined,
    offline_reference: formData.get("offline_reference") || undefined,
  });
  if (!parsed.success || !amount || amount <= 0) redirect(`/bookings/${bid.data}?error=invalid#payments`);

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    ...parsed.data,
    provider: "offline",
    amount_paise: amount,
    status: "captured",
    captured_at: new Date().toISOString(),
    recorded_by: staff.userId,
  });
  if (error) redirect(`/bookings/${bid.data}?error=failed#payments`);

  await supabase.from("booking_events").insert({
    booking_id: bid.data,
    type: "payment_recorded",
    actor_type: "staff",
    actor_id: staff.userId,
    data: { amount_paise: amount, kind: parsed.data.kind },
  });
  revalidatePath(`/bookings/${bid.data}`);
  redirect(`/bookings/${bid.data}?saved=1#payments`);
}
