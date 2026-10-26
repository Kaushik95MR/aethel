import Image from "next/image";
import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { PackageDetail } from "@/lib/catalogue";
import { formatDate, formatPaise } from "@/lib/format";
import { photoFor } from "@/lib/photos";
import type { SceneId } from "@/lib/story-sound";
import { SoundHint } from "./sound-hint";
import { StoryScroll, type Chapter, type Scene } from "./story-scroll";

const FACTS = [
  { value: "about 1,712 m", label: "Summit height" },
  { value: "Friday night", label: "Leaves Bengaluru" },
  { value: "By jeep", label: "The way down" },
  { value: "Campfire", label: "Saturday night" },
];

// The weekend, told in the order it happens. Each chapter has a scene: a photograph, or the bus drawn in code.
const CHAPTERS: { label: string; when: string; title: string; text: string; scene: string; sound: SceneId }[] = [
  {
    label: "Pick-up",
    when: "Friday night",
    title: "Bags on, bus at the kerb.",
    text: "We pick you up in Bengaluru after work. The weekend starts the moment you sit down.",
    scene: "story-bengaluru",
    sound: "city",
  },
  {
    label: "The bus",
    when: "Still Friday night",
    title: "The bus is the first party.",
    text: "Music up, seats shuffled, strangers dancing in the aisle. By the time the city is behind you, the group already feels like a group.",
    scene: "bus",
    sound: "bus",
  },
  {
    label: "The trail",
    when: "Saturday, first light",
    title: "Boots on, forest ahead.",
    text: "The bus pulls into Kukke Subramanya. Tea, a permit check, and you step onto the trail as the forest wakes up.",
    scene: "kp-forest",
    sound: "forest",
  },
  {
    label: "The top",
    when: "Saturday, midday",
    title: "Nothing above you.",
    text: "Forest turns to grass, grass to rock, and then the mountain runs out. Everything you came for is spread below, wrapped in cloud.",
    scene: "kp-sunrise",
    sound: "summit",
  },
  {
    label: "The jeep",
    when: "Saturday afternoon",
    title: "The way down is by jeep.",
    text: "Your legs have done their share. A jeep carries the group down to base camp, so the evening is for talking, not hobbling.",
    scene: "kp-ridge",
    sound: "jeep",
  },
  {
    label: "Camp",
    when: "Saturday evening",
    title: "Base camp and a campfire.",
    text: "Tents go up, the fire is lit and the stories start: the climb, the cloud, whoever nearly missed the bus. Hot dinner, no hurry.",
    scene: "story-fire-night",
    sound: "camp",
  },
  {
    label: "Stars",
    when: "Saturday night",
    title: "Sleep under a big sky.",
    text: "Zip the tent, listen to the forest, and fall asleep tired in the good way.",
    scene: "kp-dawn",
    sound: "night",
  },
  {
    label: "Morning",
    when: "Sunday morning",
    title: "Wake up above the mist.",
    text: "Cold air, hot tea, and valleys filled with cloud. Nobody is in a rush to leave.",
    scene: "kp-mist",
    sound: "morning",
  },
  {
    label: "Home",
    when: "Sunday night",
    title: "Home, with the memories.",
    text: "The bus heads back to Bengaluru with a quieter, happier group, a few hundred photos and a plan for the next one.",
    scene: "kp-valley",
    sound: "home",
  },
];

const FAQ = [
  {
    q: "Where do we sleep?",
    a: "In tents at base camp, with a campfire and dinner. Camping on the mountain itself is no longer allowed, so base camp sits below it.",
  },
  {
    q: "How do we get down?",
    a: "By jeep. Your leader arranges the pick-up from the trail down to base camp.",
  },
  {
    q: "How hard is the climb?",
    a: "Kumara Parvatha is one of the toughest treks in Karnataka. Indiahikes says very fit beginners can attempt it, but recommends earlier Western Ghats trekking first.",
  },
  {
    q: "When can I go?",
    a: "The trail is closed from March to mid-September, and permits aren't issued in the monsoon or summer. October to February is the comfortable window. Our first Fridays are in November.",
  },
  {
    q: "Do I need a permit?",
    a: "Yes. Every trekker needs an online permit from the Karnataka Forest Department's Aranya Vihaara portal, booked for the specific route and checked at the checkpost. Daily numbers are capped. We book it for you.",
  },
  {
    q: "What about plastic?",
    a: "Your bag is checked at the checkpost and you pay a refundable deposit for plastic. Pack light and carry it all back out.",
  },
];

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="font-display text-3xl text-ink">{title}</h3>
      <ul className="mt-4 flex flex-col gap-2 text-lg text-ink">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export function TrekStory({ pkg }: { pkg: PackageDetail }) {
  const hero = photoFor("kp-dawn");
  const chapters: Chapter[] = CHAPTERS.flatMap((c) => {
    if (c.scene === "bus") return [{ ...c, scene: { kind: "bus" } as Scene }];
    const ph = photoFor(c.scene);
    return ph ? [{ ...c, scene: { kind: "photo", src: ph.src, alt: ph.alt } as Scene }] : [];
  });
  const credits = [...new Set(["kp-dawn", ...CHAPTERS.map((c) => c.scene).filter((k) => k !== "bus")])]
    .map((k) => photoFor(k))
    .filter((p) => p !== null);
  const enquire = `/enquire?package=${pkg.slug}`;

  return (
    <>
      <header data-header="photo" className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-ink text-background">
        {hero && <Image src={hero.src} alt={hero.alt} fill priority sizes="100vw" className="-z-20 object-cover" />}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/35 to-ink/30" />
        <div className="rise mx-auto w-full max-w-[88rem] px-5 pb-12 pt-32 sm:px-8 sm:pb-16">
          <h1 className="font-display text-[clamp(3.6rem,13vw,12rem)]">Kumara Parvatha</h1>
          <p className="mt-6 max-w-xl text-xl text-background">
            A weekend out of Bengaluru: an overnight bus, a summit, a jeep ride down and a campfire at base camp.
          </p>
          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            {FACTS.map((f) => (
              <div key={f.label}>
                <dt className="text-background/80">{f.label}</dt>
                <dd className="mt-1 font-display text-[clamp(1.6rem,3vw,2.4rem)]">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <a
              href="#dates"
              className="rounded-full bg-primary px-8 py-4 text-lg font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Pick a Friday
            </a>
            <Link href={enquire} className="text-lg text-background underline underline-offset-4">
              Ask us a question
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-background/80">
            <p>Keep scrolling to live the weekend.</p>
            <SoundHint />
          </div>
        </div>
      </header>

      <StoryScroll chapters={chapters} />

      <section className="mx-auto max-w-[88rem] px-5 py-28 sm:px-8 sm:py-40">
        <h2 className="max-w-[14ch] font-display text-[clamp(3rem,8vw,7rem)] text-ink">What&apos;s in the weekend.</h2>
        <div className="mt-12 grid gap-14 sm:grid-cols-2 lg:max-w-4xl">
          <List title="Included" items={pkg.inclusions} />
          <List title="Not included" items={pkg.exclusions} />
        </div>
      </section>

      <section data-header="dark" className="bg-ink text-background">
        <div className="mx-auto grid max-w-[88rem] gap-12 px-5 py-28 sm:px-8 sm:py-40 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <h2 className="font-display text-[clamp(2.8rem,7vw,6rem)]">Before you book</h2>
            <p className="mt-6 max-w-md text-lg text-background">
              The rules of the mountain change with the forest department. These are the current ones, and we confirm them with you
              before every departure.
            </p>
          </div>
          <Accordion className="lg:col-span-7">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={i} className="border-background/25">
                <AccordionTrigger className="py-5 text-left font-display text-2xl text-background hover:no-underline sm:text-3xl">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent>
                  <p className="max-w-xl text-lg text-background">{f.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section id="dates" className="mx-auto max-w-[88rem] scroll-mt-20 px-5 py-28 sm:px-8 sm:py-40">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="max-w-[12ch] font-display text-[clamp(3rem,9vw,8rem)] text-ink">Pick a Friday.</h2>
          <p className="text-xl text-ink">{formatPaise(pkg.base_price_paise)} per person, from Bengaluru</p>
        </div>
        <ul className="mt-12 flex flex-col divide-y divide-ink/20 border-y border-ink/20">
          {pkg.departures.map((d) => {
            const sold = d.seats_left !== null && d.seats_left <= 0;
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 py-6">
                <span className="font-display text-4xl text-ink sm:text-5xl">{formatDate(d.start_date)}</span>
                <span className="text-lg text-muted-foreground">
                  {sold ? "Sold out" : d.seats_left === null ? "" : `${d.seats_left} seats left`}
                </span>
                {!sold && (
                  <Link
                    href={enquire}
                    className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Enquire about this date
                  </Link>
                )}
              </li>
            );
          })}
          {pkg.departures.length === 0 && (
            <li className="py-8 text-lg text-muted-foreground">New dates are being added. Ask us and we&apos;ll tell you the next one.</li>
          )}
        </ul>

        <p className="mt-12 max-w-2xl text-sm text-muted-foreground">
          Mountain facts from{" "}
          <a className="underline" href="https://indiahikes.com/documented-trek/kumara-parvatha-trek" rel="noopener noreferrer">
            Indiahikes
          </a>{" "}
          and{" "}
          <a className="underline" href="https://en.wikipedia.org/wiki/Pushpagiri_(mountain)" rel="noopener noreferrer">
            Wikipedia
          </a>
          . Check the current rules on the forest department&apos;s Aranya Vihaara portal before you travel.
        </p>
        <ul className="mt-4 flex max-w-3xl flex-col gap-1 text-xs text-muted-foreground">
          {credits.map((c) => (
            <li key={c.src}>
              <a href={c.source} className="underline" rel="noopener noreferrer">
                {c.title}
              </a>{" "}
              by {c.author}, {c.license}, via Wikimedia Commons
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
