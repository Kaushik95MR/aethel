import type { Metadata } from "next";
import { DraftNote, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Cancellation and refunds" };

export default function CancellationPage() {
  return (
    <PageShell title="Cancellation" intro="What you get back if you cancel, and when.">
      <DraftNote />
      <p className="note">
        <b>To confirm:</b> the refund steps below are a suggestion, not a decision. Choose the real schedule before launch, then update this page.
      </p>

      <h2>If you cancel</h2>
      <p>Tell us in writing through the contact page. The refund depends on how many days before the trip starts we hear from you:</p>
      <ul>
        <li>30 days or more before: full refund, less the payment gateway charges.</li>
        <li>15 to 29 days before: 50% refund.</li>
        <li>Fewer than 15 days before: no refund.</li>
      </ul>
      <p>If someone else can take your seat and is confirmed by us, we will refund you in full, less the payment gateway charges.</p>

      <h2>If we cancel</h2>
      <p>If we cancel a trip, or cannot run it because too few people booked, you can choose a full refund or a seat on another date.</p>

      <h2>If something changes on the trip</h2>
      <p>
        If a part of the plan cannot go ahead for weather or safety, your host will offer the closest alternative. Parts of a trip that you choose not
        to join are not refunded.
      </p>

      <h2>How refunds are paid</h2>
      <p>Refunds go back to the original payment method through Cashfree Payments. They usually reach your account within 5 to 7 working days after we approve them.</p>
    </PageShell>
  );
}
