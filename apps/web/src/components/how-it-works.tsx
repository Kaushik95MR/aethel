import { Sparkle } from "@/components/sparkle";

const STEPS = [
  ["Pick a trip", "Choose a date and see who is hosting it."],
  ["Say you're in", "Send a quick enquiry. We confirm your seat and send a secure payment link."],
  ["Meet your people", "Your host shares the plan and pick-up details. Then it's the beach, the music and the bonfire."],
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-[88rem] scroll-mt-24 px-5 pb-20 pt-6 sm:px-8 sm:pb-28">
      <h2 id="how-title" className="font-display text-[clamp(2rem,4vw,3.2rem)]">
        How it works
      </h2>
      <ol className="mt-8 grid gap-5 md:grid-cols-3">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="relative rounded-3xl border border-border bg-card p-6">
            <span className="grid size-11 place-items-center rounded-full bg-sun font-display text-2xl text-background">{i + 1}</span>
            <h3 className="mt-4 font-display text-2xl">{title}</h3>
            <p className="mt-2 text-lg text-muted-foreground">{body}</p>
            {i === 2 && <Sparkle className="twinkle absolute right-5 top-5 size-6" />}
          </li>
        ))}
      </ol>
    </section>
  );
}
