import Link from "next/link";

export function HowItWorks() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-[88rem] flex-wrap items-center justify-between gap-6 px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.05]">Don&apos;t see your trip? We&apos;ll plan it.</h2>
        <Link
          href="/enquire"
          className="inline-flex min-h-12 items-center rounded-full bg-ink px-8 text-lg font-medium text-background transition-opacity hover:opacity-90"
        >
          Plan my trip
        </Link>
      </div>
    </section>
  );
}
