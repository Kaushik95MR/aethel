import type { Metadata } from "next";
import { DraftNote, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Terms and conditions" };

export default function TermsPage() {
  return (
    <PageShell title="Terms" intro="The rules for using the site and joining a trip.">
      <DraftNote />

      <h2>Who we are</h2>
      <p>Aethel trip plans group trips and is based in Bengaluru, India. In these terms, &ldquo;we&rdquo; means Aethel trip and &ldquo;you&rdquo; means the person using the site or joining a trip.</p>

      <h2>Who can join</h2>
      <p>You must be 18 or older to create an account and to book a seat. You must give true details, including your name, date of birth and phone number.</p>

      <h2>Booking a seat</h2>
      <ul>
        <li>Sending an enquiry does not book a seat and does not charge you.</li>
        <li>A seat is yours once we confirm it and you pay through the secure payment link.</li>
        <li>Prices are in Indian rupees. The price, dates and what is included are shown on each trip page.</li>
        <li>Seats are limited. We may close a date when it is full.</li>
      </ul>

      <h2>Payments</h2>
      <p>Payments are processed by Cashfree Payments. We never see or store your card or bank details.</p>

      <h2>Changes by us</h2>
      <p>
        Plans can change because of weather, safety, transport or a host&apos;s availability. We will tell you as early as we can and offer a
        sensible alternative. If we cancel a trip, we refund what you paid for it. See the cancellation and refunds page.
      </p>

      <h2>On the trip</h2>
      <ul>
        <li>Follow your host&apos;s instructions on safety, timings and pick-up points.</li>
        <li>Respect the other travellers, local people and the places you visit.</li>
        <li>You are responsible for your belongings and for any health or travel needs you have. Tell your host about anything they should know.</li>
        <li>We may ask a person who puts others at risk, or breaks the law, to leave the trip. No refund applies in that case.</li>
      </ul>

      <h2>Photos</h2>
      <p>Your host or our team may take photos on a trip and use them on this site or our social pages. Tell your host if you would rather not appear.</p>

      <h2>Our responsibility</h2>
      <p>
        We take care in planning each trip, but travel carries risks that nobody controls. To the extent the law allows, we are not responsible for
        loss or harm that comes from events outside our control. Nothing here limits your rights under Indian consumer law.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms? Use the contact page and a planner will call you back.</p>
    </PageShell>
  );
}
