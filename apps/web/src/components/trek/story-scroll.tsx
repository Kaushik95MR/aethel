"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { setStoryScene, type SceneId } from "@/lib/story-sound";

export type Scene = { kind: "photo"; src: string; alt: string } | { kind: "bus" };
export type Chapter = { label: string; when: string; title: string; text: string; scene: Scene; sound: SceneId };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);

// The bus is chapter 1 (zero-based). It drives in from the left as the chapter opens, then on to the destination at the
// right as you scroll into the next chapter. Chapter 1 stays on screen until the bus has gone.
const BUS = 1;
const BUS_LEAVES_AT = 1.75;

function busX(pos: number) {
  if (pos < BUS) return -75 + 75 * ease(clamp((pos - 0.5) / 0.5));
  return 85 * ease(clamp((pos - BUS) / (BUS_LEAVES_AT - BUS)));
}

function activeFor(pos: number) {
  const i = Math.floor(pos + 0.5);
  return i === BUS + 1 && pos < BUS_LEAVES_AT ? BUS : Math.max(0, i);
}

type Mode = "bus" | "walk" | "jeep" | "fire" | "tent";

/** What is carrying you along the timeline in each chapter. */
const MODE: Record<SceneId, Mode> = {
  city: "bus",
  bus: "bus",
  forest: "walk",
  summit: "walk",
  jeep: "jeep",
  camp: "fire",
  night: "tent",
  morning: "tent",
  home: "bus",
};

// The weekend as a scroll story. One full-screen stage stays put and its scene changes with each chapter, while the
// chapter text sits on top. A simple timeline on the right runs from Friday night to Sunday night, and whatever is
// carrying you (the bus, a walker, the jeep, the campfire, a tent) travels down it as you scroll.
export function StoryScroll({ chapters }: { chapters: Chapter[] }) {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const inView = useRef(false);

  // Track scroll position as a chapter number (1.5 means halfway between chapter 1 and 2).
  useEffect(() => {
    const el = root.current;
    const st = stage.current;
    if (!el || !st) return;
    const last = chapters.length - 1;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const pos = (window.scrollY - (el.getBoundingClientRect().top + window.scrollY)) / vh;
      st.style.setProperty("--bus-x", String(busX(pos)));
      st.style.setProperty("--dest", String(ease(clamp((pos - 0.9) / 0.6))));
      st.style.setProperty("--p", String(clamp(pos / last)));
      const next = Math.min(last, activeFor(pos));
      if (next !== activeRef.current) {
        activeRef.current = next;
        setActive(next);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [chapters.length]);

  // The soundscape follows the chapter on screen and goes quiet when the story is off screen.
  useEffect(() => {
    if (!inView.current) return;
    setStoryScene(chapters[active]?.sound ?? null);
  }, [active, chapters]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      inView.current = entry.isIntersecting;
      setStoryScene(entry.isIntersecting ? (chapters[activeRef.current]?.sound ?? null) : null);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      setStoryScene(null);
    };
  }, [chapters]);

  const mode = MODE[chapters[active]?.sound ?? "city"];
  const last = chapters.length - 1;
  // Day markers: where each day begins on the line.
  const days = [
    { label: "Friday night", at: 0, chapter: 0 },
    { label: "Saturday", at: 2 / last, chapter: 2 },
    { label: "Sunday night", at: 1, chapter: last },
  ];

  return (
    <section ref={root} data-header="photo" aria-label="Your weekend, chapter by chapter" className="relative bg-ink text-background">
      <div ref={stage} className="sticky top-0 z-0 h-[100svh] overflow-hidden">
        <div aria-hidden>
          {chapters.map((c, k) => (
            <div
              key={c.label}
              className="absolute inset-0 transition-opacity duration-700 ease-out"
              style={{ opacity: k === active ? 1 : 0 }}
            >
              {c.scene.kind === "photo" ? (
                <Image
                  src={c.scene.src}
                  alt=""
                  fill
                  sizes="100vw"
                  priority={k < 2}
                  className={`object-cover transition-transform duration-[7000ms] ease-out ${k === active ? "scale-100" : "scale-[1.07]"}`}
                />
              ) : (
                <BusScene />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/45 to-ink/10" />
            </div>
          ))}
        </div>

        <nav aria-label="Weekend timeline" className="absolute inset-y-0 right-3 z-20 flex items-center sm:right-8">
          <div className="relative h-[62svh] w-12 sm:w-36">
            <div aria-hidden className="absolute bottom-0 right-[19px] top-0 w-0.5 bg-background/25" />
            <div
              aria-hidden
              className="absolute bottom-0 right-[19px] top-0 w-0.5 origin-top bg-primary"
              style={{ transform: "scaleY(var(--p, 0))" }}
            />
            {days.map((d) => (
              <a
                key={d.label}
                href={`#chapter-${d.chapter}`}
                className="absolute right-12 -translate-y-1/2 whitespace-nowrap text-sm text-background/80 transition-colors hover:text-background max-sm:sr-only"
                style={{ top: `${d.at * 100}%` }}
              >
                {d.label}
              </a>
            ))}
            <div
              aria-hidden
              className="absolute right-0 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-primary text-ink"
              style={{ top: "calc(var(--p, 0) * 100%)" }}
            >
              <span key={mode} className="story-pop grid place-items-center">
                <Glyph mode={mode} />
              </span>
            </div>
          </div>
        </nav>
      </div>

      <div className="relative z-10 -mt-[100svh]">
        {chapters.map((c, i) => (
          <article key={c.label} id={`chapter-${i}`} data-chapter={i} className="flex h-[100svh] items-center">
            <div className="mx-auto w-full max-w-[88rem] px-5 sm:px-8">
              <div
                className={`max-w-xl transition duration-500 ease-out ${i === active ? "translate-y-0 opacity-100" : "translate-y-4 opacity-20"}`}
              >
                <p className="text-lg text-background/85">{c.when}</p>
                <h2 className="mt-3 font-display text-[clamp(3rem,8vw,7rem)]">{c.title}</h2>
                <p className="mt-6 max-w-md text-xl text-background">{c.text}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Small line drawings of whatever is carrying you: a bus, a walker, a jeep, a campfire, a tent. */
function Glyph({ mode }: { mode: Mode }) {
  const common = { viewBox: "0 0 24 24", width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (mode) {
    case "bus":
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="19" height="11" rx="2.5" />
          <path d="M2.5 11h19M8 5v6M14 5v6" />
          <circle cx="7" cy="18.5" r="1.7" fill="currentColor" />
          <circle cx="17" cy="18.5" r="1.7" fill="currentColor" />
        </svg>
      );
    case "walk":
      return (
        <svg {...common}>
          <circle cx="11" cy="4.5" r="1.8" fill="currentColor" />
          <path d="M11 7.5v6M11 9l-3 3M11 9l3 2.5M19 8l-2 12" />
          <path className="story-leg-a" d="M11 13.5l-3 6.5" style={{ transformOrigin: "11px 13.5px" }} />
          <path className="story-leg-b" d="M11 13.5l3 6.5" style={{ transformOrigin: "11px 13.5px" }} />
        </svg>
      );
    case "jeep":
      return (
        <svg {...common}>
          <path d="M2.5 15V9.5l2-3h9l3.5 3.5h2.5V15z" />
          <path d="M8.5 6.5V10M2.5 10h18" />
          <circle cx="7" cy="17.5" r="1.9" fill="currentColor" />
          <circle cx="17" cy="17.5" r="1.9" fill="currentColor" />
        </svg>
      );
    case "fire":
      return (
        <svg {...common}>
          <path d="M12 3c.6 3 4 4.6 4 8.5a4 4 0 0 1-8 0c0-2 1-3.3 2.2-4.2.1 1.6.8 2.6 1.8 2.7C11.6 8 11 5.5 12 3z" />
          <path d="M5 20l14-2.5M5 17.5l14 2.5" />
        </svg>
      );
    case "tent":
      return (
        <svg {...common}>
          <path d="M12 4.5 3 19h18z" />
          <path d="M12 4.5V19M12 10.5 8.5 19h7z" />
        </svg>
      );
  }
}

/**
 * The Friday-night bus, drawn in code. It reads --bus-x (set from the scroll position): it rolls in from the left,
 * then drives off to the right toward Kukke Subramanya, which rises out of the haze as it gets closer.
 */
function BusScene() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#071211]">
      <div className="story-beam" />
      <div className="story-beam story-beam-b" />

      {/* The destination, on the right: a ridge and a signpost that fade in as the bus approaches. */}
      <div className="absolute inset-x-0 bottom-[17%] h-[48%]" style={{ opacity: "var(--dest, 0)" }}>
        <svg viewBox="0 0 600 300" preserveAspectRatio="xMaxYMax meet" className="absolute bottom-0 right-0 h-full w-[62%]">
          <path d="M0 300 90 190l55 38 110-150 70 70 90-120 85 110 100-70v232Z" fill="#0f2824" />
          <path d="M120 300 230 210l60 40 120-110 80 60 90-70v170Z" fill="#163630" />
        </svg>
        <p className="absolute bottom-[10%] right-[8%] rounded-sm border border-background/40 px-3 py-1.5 font-display text-2xl text-background">
          Kukke Subramanya
        </p>
      </div>

      {/* The road and the bus. */}
      <div className="story-road absolute inset-x-0 bottom-[14%] h-[3%] bg-[#0b1a18]" />
      <div
        className="absolute bottom-[16%] left-1/2 w-[min(70vw,760px)]"
        style={{ transform: "translateX(calc(-50% + var(--bus-x, -75) * 1vw))" }}
      >
        <svg viewBox="0 0 800 220" className="story-bus w-full">
          <rect x="20" y="40" width="760" height="130" rx="26" fill="#0f2421" stroke="#2c4a45" strokeWidth="3" />
          {Array.from({ length: 9 }).map((_, i) => (
            <rect
              key={i}
              x={50 + i * 78}
              y="62"
              width="58"
              height="46"
              rx="8"
              fill={i % 3 === 0 ? "#ffb36b" : i % 3 === 1 ? "#ff7a45" : "#ffd9a8"}
              opacity="0.9"
            />
          ))}
          <rect x="20" y="124" width="760" height="10" fill="#ff5a1f" opacity="0.9" />
          <path d="M780 70h18l-6 40h-12Z" fill="#ffd9a8" opacity="0.55" />
          <g className="story-wheel" style={{ transformOrigin: "170px 176px" }}>
            <circle cx="170" cy="176" r="26" fill="#08100f" stroke="#2c4a45" strokeWidth="4" />
            <path d="M170 156v40M150 176h40" stroke="#2c4a45" strokeWidth="4" />
          </g>
          <g className="story-wheel" style={{ transformOrigin: "620px 176px" }}>
            <circle cx="620" cy="176" r="26" fill="#08100f" stroke="#2c4a45" strokeWidth="4" />
            <path d="M620 156v40M600 176h40" stroke="#2c4a45" strokeWidth="4" />
          </g>
        </svg>
      </div>

      <div className="story-eq absolute inset-x-0 bottom-0 flex h-[12%] items-end gap-1 px-4">
        {Array.from({ length: 48 }).map((_, i) => (
          <span key={i} style={{ ["--i" as string]: i }} className="flex-1 bg-primary/70" />
        ))}
      </div>
    </div>
  );
}
