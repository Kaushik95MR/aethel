import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "About", description: "Trips with a party at night, an experienced host and a full plan by day." };

export default function AboutPage() {
  return (
    <PageShell title="About" intro="Travel is better with people. We bring the people.">
      <h2>Why we exist</h2>
      <p>
        Plenty of people want to travel and have nobody to go with. Friends are busy, plans fall apart, and booking a trip alone feels like a lot.
        Aethel trip plans the trip and brings the group.
      </p>
      <p>
        Each trip has a host, a fixed number of seats and a plan that gives the place its day and the night its music, lights and bonfire.
      </p>

      <div className="facts">
        <div>
          <h3>An experienced host on every trip</h3>
          <p>Your host knows the place, plans the trip, travels with the group and looks after everyone. Each host has a profile and a trip history.</p>
        </div>
        <div>
          <h3>Know who is coming</h3>
          <p>Once your seat is confirmed you can see the first names, ages and Instagram of the others on your date. Your phone number and date of birth stay private.</p>
        </div>
        <div>
          <h3>Fixed seats</h3>
          <p>Every date has a fixed number of seats, and each trip shows how many are left.</p>
        </div>
        <div>
          <h3>Simple booking</h3>
          <p>Send a quick enquiry. We confirm your seat, then send a secure payment link.</p>
        </div>
      </div>

      <h2>How it works</h2>
      <ul>
        <li>Pick a trip and a date, and see who is hosting it.</li>
        <li>Say yes with a quick enquiry. Nothing is charged to ask.</li>
        <li>We confirm your seat and send a secure payment link.</li>
        <li>Your host shares the plan and the pick-up details, and you go.</li>
      </ul>

      <p style={{ marginTop: 40 }}>
        <Link href="/packages" className="btn">
          See trips
        </Link>
      </p>
    </PageShell>
  );
}
