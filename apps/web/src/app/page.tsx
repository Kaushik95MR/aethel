import Image from "next/image";
import Link from "next/link";
import { CallbackForm } from "@/components/callback-form";
import { TripCatalogue } from "@/components/trip-catalogue";
import { UpcomingMonths, type MonthTrip } from "@/components/upcoming-months";
import { getHosts, getPackages, getUpcomingDepartures } from "@/lib/catalogue";
import { buildCatalogue, categoryTabs, dayMonth } from "@/lib/catalogue-view";
import { formatPaise, seatsLabel } from "@/lib/format";
import { SITE } from "@/lib/site";

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })} '${String(y).slice(2)}`;
};

const STEPS = [
  ["Pick a trip", "Choose a place and a date. Each trip page lists the plan, the price and what is included."],
  ["Ask for a seat", "Send your name and number. Nothing is charged yet."],
  ["Pay and go", "We confirm your seat and send a secure payment link. Your host shares the plan and the pick-up details."],
];

const GETS = [
  ["An experienced host", "Your host knows the place, plans the trip and looks after the group from start to finish."],
  ["Fixed seats", "Each date has a set number of seats, and the trip page shows how many are left."],
  ["A full plan", "Travel, stay and meals are set. You see what is included before you book."],
  ["A real party at night", "Music, lights and a bonfire with the people you met on day one."],
];

const FAQ = [
  ["Can I come on my own?", "Yes. Most people do. Your host introduces the group on the first evening, so you are never standing alone."],
  ["Is it safe to travel solo?", "An experienced host stays with the group for the whole trip. You can read their profile before you book, and you see who else is coming once your seat is confirmed. Call us first if you want to talk it through."],
  ["What is included?", "Travel, stay, meals and activities are listed day by day on each trip page, along with what you pay for yourself."],
  ["How does payment work?", "Asking for a seat costs nothing. Once we confirm it, we send a secure payment link and you pay online through Cashfree."],
  ["What if I need to cancel?", "Your refund depends on how early you tell us. The cancellation page has the details."],
  ["Who can see my details?", "Travellers confirmed on your date see your first name, age and Instagram. Your phone number and date of birth stay private."],
];

export default async function Home() {
  const [trips, hosts, packages] = await Promise.all([getUpcomingDepartures(12), getHosts(), getPackages()]);
  const next = trips[0] ?? null;

  const catalogue = buildCatalogue(packages, trips);
  const tabs = categoryTabs(packages);

  const monthTrips: MonthTrip[] = trips.map((t) => ({
    id: t.id,
    month: monthKey(t.start_date),
    slug: t.slug,
    title: t.title,
    dates: `${dayMonth(t.start_date)} to ${dayMonth(t.end_date)}`,
    host: t.host?.name ?? null,
    seats: seatsLabel(t.seats_left),
  }));
  const months = [...new Map(trips.map((t) => [monthKey(t.start_date), { key: monthKey(t.start_date), label: monthLabel(t.start_date) }])).values()];

  // The hero photo: the blue-lit beach party picture from the trip's gallery (an open-licence photo, credited on the Gallery page).
  const allPhotos = packages.flatMap((p) => p.gallery);
  const heroPhoto = allPhotos.find((p) => /lights at a beach party|vagator/i.test(p.alt)) ?? allPhotos.find((p) => /party|night/i.test(p.alt)) ?? null;

  return (
    <div className="gh">
      <section className={`panel hero${heroPhoto ? " photo" : ""}`} aria-label={SITE.name}>
        {heroPhoto && <Image src={heroPhoto.src} alt={heroPhoto.alt} fill priority quality={80} sizes="100vw" style={{ objectFit: "cover", objectPosition: "50% 40%" }} />}
        <div>
          <h1 className="d">
            Every trip has a party.
            <br />
            Every party has a trip.
          </h1>
          <p className="sub">Experienced hosts, adventures by day, parties by night. Ready for Aethel tripping?</p>
        </div>
        <Link className="btn herocta" href="#trips">
          See trips
        </Link>
      </section>

      {catalogue.length > 0 && (
        <section id="trips" className="catalogue" aria-labelledby="trips-h">
          <h2 id="trips-h" className="d sec-h">
            Pick your party
          </h2>
          <TripCatalogue trips={catalogue} tabs={tabs} />
        </section>
      )}

      <section id="how" className="steps" aria-labelledby="how-h">
        <h2 id="how-h" className="d sec-h">
          How it works
        </h2>
        <ol>
          {STEPS.map(([a, b], i) => (
            <li key={a}>
              <span className="d n">{i + 1}</span>
              <div>
                <h3>{a}</h3>
                <p>{b}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="why" aria-label="What you get">
        {GETS.map(([a, b]) => (
          <div key={a}>
            <h3 className="d">{a}</h3>
            <p>{b}</p>
          </div>
        ))}
      </section>

      {months.length > 0 && (
        <section id="months" className="months" aria-labelledby="months-h">
          <h2 id="months-h" className="d sec-h">
            Pick a date
          </h2>
          <UpcomingMonths months={months} trips={monthTrips} />
        </section>
      )}

      {hosts.length > 0 && (
        <section id="hosts" className="hosts" aria-labelledby="hosts-h">
          <h2 id="hosts-h" className="d sec-h">
            Meet our hosts
          </h2>
          <p className="hsub">Every trip is led by an experienced host. Read about them before you book.</p>
          <ul className="hgrid">
            {hosts.slice(0, 4).map((h) => (
              <li key={h.slug}>
                <Link href={`/hosts/${h.slug}`} className="hcard">
                  <span className="hph">
                    {h.photo ? (
                      <Image src={h.photo.src} alt={h.photo.alt} fill quality={75} sizes="(min-width: 1000px) 22vw, (min-width: 600px) 45vw, 90vw" style={{ objectFit: "cover" }} />
                    ) : (
                      <span className="d ini">{h.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="htxt">
                    <span className="hn">{h.name}</span>
                    {h.tagline && <span className="ht">{h.tagline}</span>}
                    {h.vibes.length > 0 && (
                      <span className="vibes">
                        {h.vibes.slice(0, 3).map((v) => (
                          <span key={v}>{v}</span>
                        ))}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: 32 }}>
            <Link className="btn quiet" href="/hosts">
              See all hosts
            </Link>
          </p>
        </section>
      )}

      <section id="faq" className="faq" aria-labelledby="faq-h">
        <h2 id="faq-h" className="d sec-h">
          Questions
        </h2>
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <section id="call" className="lead" aria-labelledby="call-h">
        <div>
          <h2 id="call-h" className="d">
            Call me back
          </h2>
          <p className="sub">Leave your number. A planner calls with dates, what is included and answers to whatever you want to ask.</p>
        </div>
        <CallbackForm trips={packages.map((p) => ({ slug: p.slug, title: p.title }))} defaultSlug={next?.slug ?? ""} />
      </section>
    </div>
  );
}
