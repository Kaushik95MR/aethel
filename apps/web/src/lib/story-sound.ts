// A soundscape for each chapter of the Kumara Parvatha story, synthesized in the browser (nothing is downloaded).
// The palette is small and clean: traffic, soft wind, birds, a cloud-like chord, and music. There are no buzzing
// oscillators (no sawtooth or square waves), no hiss bands and no slow swells, so nothing sounds like static or surf.

import { getAudio, isSoundOn, pinkNoise, setWindBase, subscribe } from "./sound";

export type SceneId = "city" | "bus" | "forest" | "summit" | "jeep" | "camp" | "night" | "morning" | "home";

type Scene = { gain: GainNode; start: () => void; stop: () => void };
type Timer = { start: () => void; stop: () => void };

const scenes = new Map<SceneId, Scene>();
let desired: SceneId | null = null;
let current: SceneId | null = null;
let noiseBuf: AudioBuffer | null = null;
let ctxRef: AudioContext | null = null;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

function loop(ctx: AudioContext, rate = 1, offset = 0) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf!;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(0, offset);
  return src;
}

function filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** A repeating random event, started and stopped with its scene. */
function every(min: number, max: number, fn: () => void): Timer {
  let t: ReturnType<typeof setTimeout> | undefined;
  let on = false;
  const tick = () => {
    if (!on) return;
    fn();
    t = setTimeout(tick, rand(min, max) * 1000);
  };
  return {
    start() {
      if (on) return;
      on = true;
      t = setTimeout(tick, rand(min, max) * 400);
    },
    stop() {
      on = false;
      if (t) clearTimeout(t);
    },
  };
}

function panned(ctx: AudioContext, out: AudioNode, pan: number) {
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(out);
  return p;
}

/** A short, soft burst of filtered noise, used only for drum hits. */
function tap(ctx: AudioContext, out: AudioNode, at: number, dur: number, type: BiquadFilterType, freq: number, peak: number, q = 0.7) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf!;
  const f = filter(ctx, type, freq, q);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.008, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at, rand(0, 3));
  src.stop(at + dur + 0.02);
}

/* ------------------------------------------------------------------ traffic */

/** A vehicle passing: soft tyre and road noise sweeping up and down, with a low engine that drops in pitch. */
function pass(ctx: AudioContext, out: AudioNode, level: number) {
  const t = ctx.currentTime + 0.02;
  const dur = rand(2, 3.8);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(-0.9 * dir, t);
  pan.pan.linearRampToValueAtTime(0.9 * dir, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  pan.connect(g).connect(out);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const lp = filter(ctx, "lowpass", 200, 0.6);
  lp.frequency.setValueAtTime(200, t);
  lp.frequency.exponentialRampToValueAtTime(560, t + dur * 0.5);
  lp.frequency.exponentialRampToValueAtTime(220, t + dur);
  src.connect(lp).connect(pan);
  src.start(t, rand(0, 3));
  src.stop(t + dur + 0.05);

  const base = rand(68, 100);
  const eng = ctx.createGain();
  eng.gain.value = 0.5;
  eng.connect(pan);
  for (const [mult, amp] of [
    [1, 1],
    [2, 0.35],
  ] as const) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(base * mult * 1.1, t);
    o.frequency.exponentialRampToValueAtTime(base * mult * 0.88, t + dur);
    const og = ctx.createGain();
    og.gain.value = amp;
    o.connect(og).connect(eng);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

/** A friendly two-tone car horn: soft attack, rounded tone, one or two short pips. */
function horn(ctx: AudioContext, out: AudioNode, level: number) {
  let t = ctx.currentTime + 0.02;
  const p = panned(ctx, out, rand(-0.8, 0.8));
  const pitch = rand(0.92, 1.12);
  const honks = Math.random() < 0.4 ? 2 : 1;
  for (let i = 0; i < honks; i++) {
    const dur = rand(0.2, 0.42);
    const lp = filter(ctx, "lowpass", 800);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + 0.03);
    g.gain.setValueAtTime(level, t + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(p);
    for (const hz of [392 * pitch, 494 * pitch]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = hz;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    t += dur + rand(0.09, 0.16);
  }
}

/** Steady low road rumble. Low-passed so it has no hiss, and constant so it never rolls. */
function roadHum(ctx: AudioContext, out: AudioNode, level: number) {
  const g = ctx.createGain();
  g.gain.value = level;
  loop(ctx, 0.6, 0.6).connect(filter(ctx, "lowpass", 230, 0.5)).connect(g).connect(out);
}

/* --------------------------------------------------------------------- air */

/** Soft wind: low-passed so it is a gentle rush, not a hiss. Its strength only changes in small random steps. */
function softWind(ctx: AudioContext, out: AudioNode, level: number): Timer {
  const g = ctx.createGain();
  g.gain.value = level;
  const lp = filter(ctx, "lowpass", 650, 0.4);
  loop(ctx, 0.8, 1.4).connect(lp).connect(g).connect(out);
  return every(1.5, 3.5, () => {
    const now = ctx.currentTime;
    g.gain.setTargetAtTime(level * rand(0.75, 1.2), now, 1.1);
    lp.frequency.setTargetAtTime(rand(520, 800), now, 1.4);
  });
}

function chirp(ctx: AudioContext, out: AudioNode, loudness: number) {
  const pan = panned(ctx, out, rand(-0.8, 0.8));
  let t = ctx.currentTime + 0.02;
  const base = rand(2200, 3900);
  const notes = Math.floor(rand(2, 6));
  for (let i = 0; i < notes; i++) {
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * rand(1.15, 1.45), t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(loudness, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g).connect(pan);
    o.start(t);
    o.stop(t + 0.13);
    t += rand(0.11, 0.17);
  }
}

/** A soft, slow chord that reads as cloud: sine pairs a few cents apart, no tremolo. */
function cloudPad(ctx: AudioContext, out: AudioNode, level: number, chord: readonly number[] = [196, 246.9, 293.7]) {
  const lp = filter(ctx, "lowpass", 800);
  const g = ctx.createGain();
  g.gain.value = level;
  lp.connect(g).connect(out);
  for (const hz of chord) {
    for (const detune of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = hz;
      o.detune.value = detune;
      o.connect(lp);
      o.start();
    }
  }
}

/* ------------------------------------------------------------------- music */

// Am - F - C - G, one bar each: bass root, chord, and the notes a melody can use.
const BARS = [
  { bass: 110, chord: [220, 261.6, 329.6], lead: [440, 523.3, 659.3, 784] },
  { bass: 87.3, chord: [174.6, 220, 261.6], lead: [440, 523.3, 698.5, 880] },
  { bass: 130.8, chord: [261.6, 329.6, 392], lead: [523.3, 659.3, 784, 1046.5] },
  { bass: 98, chord: [196, 246.9, 293.7], lead: [392, 493.9, 587.3, 784] },
] as const;

/** Plays one pitched note: a rounded tone with a quick pluck envelope. */
function note(ctx: AudioContext, out: AudioNode, hz: number, at: number, dur: number, peak: number, type: OscillatorType = "triangle", cutoff = 2200) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  const lp = filter(ctx, "lowpass", cutoff);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(lp).connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** A scheduler that calls play(step, time) on a steady grid, a little ahead of the audio clock. */
function sequencer(ctx: AudioContext, stepSeconds: number, play: (step: number, at: number) => void): Timer {
  let timer: ReturnType<typeof setInterval> | undefined;
  let next = 0;
  let step = 0;
  return {
    start() {
      if (timer) return;
      next = ctx.currentTime + 0.12;
      step = 0;
      timer = setInterval(() => {
        while (next < ctx.currentTime + 0.4) {
          play(step, next);
          next += stepSeconds;
          step++;
        }
      }, 90);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}

/** The party-bus groove: four-on-the-floor, soft claps, a round bass, offbeat chords and a little melody. */
function groove(ctx: AudioContext, out: AudioNode, level: number): Timer {
  const bus = ctx.createGain();
  bus.gain.value = level;
  bus.connect(out);
  const bpm = 108;
  const eighth = 60 / bpm / 2;
  const bassPattern = [1, 0, 0, 1, 1, 0, 1, 0];
  return sequencer(ctx, eighth, (step, t) => {
    const bar = BARS[Math.floor(step / 8) % 4];
    const i = step % 8;
    if (i % 2 === 0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.14);
      g.gain.setValueAtTime(0.75, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.22);
    }
    if (i === 2 || i === 6) tap(ctx, bus, t, 0.1, "bandpass", 1500, 0.22, 1);
    if (i % 2 === 1) tap(ctx, bus, t, 0.03, "highpass", 7500, 0.05);
    if (bassPattern[i]) note(ctx, bus, i === 3 || i === 6 ? bar.bass * 2 : bar.bass, t, eighth * 1.8, 0.5, "sine", 400);
    if (i % 2 === 1) for (const hz of bar.chord) note(ctx, bus, hz * 2, t, 0.2, 0.07, "triangle", 2200);
    if (i === 0 || i === 3 || i === 5) note(ctx, bus, pick(bar.lead), t, 0.45, 0.16, "triangle", 2600);
  });
}

/** Calm music: a slow arpeggio over the same chords, with a soft echo and a low root note each bar. */
function calmMusic(ctx: AudioContext, out: AudioNode, level: number, bpm = 76): Timer {
  const bus = ctx.createGain();
  bus.gain.value = level;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 60 / bpm * 0.75;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  bus.connect(out);
  bus.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(filter(ctx, "lowpass", 1800)).connect(wet).connect(out);
  const eighth = 60 / bpm / 2;
  const order = [0, 1, 2, 1, 0, 2, 1, 2];
  return sequencer(ctx, eighth, (step, t) => {
    const bar = BARS[Math.floor(step / 8) % 4];
    const i = step % 8;
    if (i === 0) note(ctx, bus, bar.bass, t, eighth * 7, 0.45, "sine", 500);
    if (Math.random() < 0.12 && i !== 0) return;
    note(ctx, bus, bar.chord[order[i]] * 2, t, 1.1, 0.34, "triangle", 1700);
  });
}

/* ------------------------------------------------------------------ scenes */

function build(id: SceneId, ctx: AudioContext, out: GainNode): Scene {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out);
  const timers: Timer[] = [];
  const mk = (): Scene => ({
    gain,
    start: () => timers.forEach((t) => t.start()),
    stop: () => timers.forEach((t) => t.stop()),
  });
  const traffic = (min: number, max: number, level: number, hornEvery: [number, number] | null) => {
    timers.push(every(min, max, () => pass(ctx, gain, level)));
    if (hornEvery) timers.push(every(hornEvery[0], hornEvery[1], () => horn(ctx, gain, 0.045)));
  };

  switch (id) {
    case "city": {
      // Friday night in Bengaluru: busy traffic, passing vehicles and the odd horn.
      roadHum(ctx, gain, 0.7);
      traffic(0.7, 1.7, 0.4, [1.5, 3.8]);
      return mk();
    }

    case "bus": {
      // The party bus: music you can hear, the road underneath and the odd vehicle outside.
      roadHum(ctx, gain, 0.3);
      traffic(3, 6, 0.16, null);
      timers.push(groove(ctx, gain, 0.7));
      return mk();
    }

    case "forest": {
      timers.push(softWind(ctx, gain, 0.05));
      timers.push(every(0.6, 2.6, () => chirp(ctx, gain, 0.05)));
      return mk();
    }

    case "summit": {
      timers.push(softWind(ctx, gain, 0.09));
      cloudPad(ctx, gain, 0.04);
      return mk();
    }

    case "jeep": {
      // A jeep on a hill track: a low engine idle, the odd vehicle, and light music.
      const engine = ctx.createGain();
      engine.gain.value = 0.16;
      engine.connect(filter(ctx, "lowpass", 200)).connect(gain);
      for (const hz of [46, 92]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = hz;
        o.connect(engine);
        o.start();
      }
      const chug = ctx.createOscillator();
      chug.frequency.value = 8;
      const chugDepth = ctx.createGain();
      chugDepth.gain.value = 0.07;
      chug.connect(chugDepth).connect(engine.gain);
      chug.start();
      traffic(3, 6, 0.14, [8, 14]);
      timers.push(calmMusic(ctx, gain, 0.22, 84));
      return mk();
    }

    case "camp": {
      timers.push(calmMusic(ctx, gain, 0.3, 72));
      timers.push(softWind(ctx, gain, 0.025));
      return mk();
    }

    case "night": {
      timers.push(calmMusic(ctx, gain, 0.2, 60));
      cloudPad(ctx, gain, 0.03, [174.6, 220, 261.6]);
      return mk();
    }

    case "morning": {
      timers.push(softWind(ctx, gain, 0.035));
      timers.push(every(0.3, 1.4, () => chirp(ctx, gain, 0.07)));
      cloudPad(ctx, gain, 0.035);
      return mk();
    }

    case "home": {
      // The ride back: the road, a little traffic, and the music again, softer and slower.
      roadHum(ctx, gain, 0.4);
      traffic(2.5, 5, 0.2, [7, 13]);
      timers.push(calmMusic(ctx, gain, 0.22, 70));
      return mk();
    }
  }
}

function apply() {
  const audio = getAudio();
  if (!audio || !isSoundOn()) {
    // Sound is off: stop whatever was playing so its timers don't keep running.
    if (current) scenes.get(current)?.stop();
    current = null;
    return;
  }
  const { ctx, master } = audio;
  if (ctxRef !== ctx) {
    ctxRef = ctx;
    scenes.clear();
    noiseBuf = pinkNoise(ctx, 4);
  }
  if (desired === current) return;

  const now = ctx.currentTime;
  if (current) {
    const oldId = current;
    const old = scenes.get(oldId);
    if (old) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setTargetAtTime(0, now, 0.35);
      // Only stop it if the visitor hasn't scrolled back to it in the meantime.
      setTimeout(() => {
        if (current !== oldId) old.stop();
      }, 1600);
    }
  }
  if (desired) {
    let sc = scenes.get(desired);
    if (!sc) {
      sc = build(desired, ctx, master);
      scenes.set(desired, sc);
    }
    sc.start();
    sc.gain.gain.cancelScheduledValues(now);
    sc.gain.gain.setTargetAtTime(1, now, 0.5);
    setWindBase(0.0001);
  } else {
    setWindBase(0.04);
  }
  current = desired;
}

let wired = false;

/** Picks the soundscape for the chapter on screen. Pass null when the story is off screen. */
export function setStoryScene(id: SceneId | null) {
  desired = id;
  if (!wired) {
    wired = true;
    // Sound toggled on or off: start the right scene, or silence everything.
    subscribe(apply);
  }
  apply();
}
