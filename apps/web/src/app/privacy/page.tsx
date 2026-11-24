import type { Metadata } from "next";
import { DraftNote, PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <PageShell title="Privacy" intro="What we collect, why, and who can see it.">
      <DraftNote />

      <h2>What we collect</h2>
      <ul>
        <li>Your name, email, phone number, date of birth and Instagram username when you create an account.</li>
        <li>The details you give in an enquiry or a call-back request, such as the trip you are interested in.</li>
        <li>Your bookings: which trip and date, how many seats and the payment status.</li>
      </ul>
      <p>We do not collect your card or bank details. Payments are handled by Cashfree Payments.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To reply to you and to call you back about a trip.</li>
        <li>To confirm seats, take payment and run the trip safely.</li>
        <li>To let the people on the same trip see who is coming (see the next section).</li>
      </ul>

      <h2>Who can see what</h2>
      <p>
        Once your seat is confirmed, the other confirmed travellers on the same date can see your first name, your age and your Instagram username.
        Your phone number, email and date of birth are not shown to other travellers. Our team and your host can see the details they need to run
        the trip.
      </p>

      <h2>Who we share it with</h2>
      <ul>
        <li>Cashfree Payments, to take your payment.</li>
        <li>Our hosting and database providers, who store the data for us.</li>
        <li>The authorities, only when the law requires it.</li>
      </ul>
      <p>We do not sell your data.</p>

      <h2>How long we keep it</h2>
      <p>We keep your account and booking records while your account is open and for as long as the law requires us to keep booking and payment records.</p>

      <h2>Your choices</h2>
      <p>
        You can see and update your details on your account page. You can ask us to correct or delete your data, and to stop calling you, through the
        contact page.
      </p>

      <h2>Cookies</h2>
      <p>We use cookies that keep you logged in. We do not use advertising cookies.</p>
    </PageShell>
  );
}
