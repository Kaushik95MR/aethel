// Procedural sound: nothing is downloaded. Wind is filtered pink noise; ticks are tiny synthesized taps.
// Browsers only allow audio after a user gesture, so everything starts from enableSound().

type Listener = () => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let windGain: GainNode | null = null;
let on = false;
let lastTick = 0;
const listeners = new Set<Listener>();

export const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const isSoundOn = () => on;

/** The shared audio graph, only while sound is on. Scenes and effects plug into the master gain. */
export function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  return ctx && master && on ? { ctx, master } : null;
}

/** Lowers or restores the always-on wind bed, so a scene can bring its own atmosphere forward. */
export function setWindBase(v: number) {
  if (!ctx || !windGain) return;
  windGain.gain.setTargetAtTime(v, ctx.currentTime, 0.8);
}
const emit = () => listeners.forEach((l) => l());

export function pinkNoise(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  // Fade the loop seam so it doesn't click.
  const fade = Math.floor(c.sampleRate * 0.08);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    d[i] *= g;
    d[len - 1 - i] *= g;
  }
  return buf;
}

function buildWind(c: AudioContext, out: AudioNode) {
  const buf = pinkNoise(c, 5);
  const wind = c.createBufferSource();
  wind.buffer = buf;
  wind.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 650;
  lp.Q.value = 0.4;
  windGain = c.createGain();
  windGain.gain.value = 0.04;
  wind.connect(lp).connect(windGain).connect(out);
  wind.start();
}

export async function enableSound() {
  if (typeof window === "undefined") return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    buildWind(ctx, master);
  }
  await ctx.resume();
  master!.gain.cancelScheduledValues(ctx.currentTime);
  master!.gain.setTargetAtTime(0.7, ctx.currentTime, 0.8);
  on = true;
  try {
    localStorage.setItem("aethel-sound", "on");
  } catch {}
  emit();
}

export function disableSound() {
  if (!ctx || !master) return;
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  const c = ctx;
  setTimeout(() => {
    if (!on) void c.suspend();
  }, 1500);
  on = false;
  try {
    localStorage.setItem("aethel-sound", "off");
  } catch {}
  emit();
}

export function toggleSound() {
  return on ? disableSound() : enableSound();
}

/** Wind swells with scroll speed. v is roughly 0 to 1. */
export function setWind(v: number) {
  if (!ctx || !windGain || !on) return;
  windGain.gain.setTargetAtTime(0.04 + Math.min(Math.abs(v), 1) * 0.04, ctx.currentTime, 0.5);
}

/** A soft stone-on-stone tap for hovers. */
export function tick() {
  if (!ctx || !on || ctx.state !== "running") return;
  const now = ctx.currentTime;
  if (now - lastTick < 0.07) return;
  lastTick = now;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.05, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
  osc.connect(g).connect(master!);
  osc.start(now);
  osc.stop(now + 0.12);
}

/** A slightly deeper tap for presses. */
export function press() {
  if (!ctx || !on || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(g).connect(master!);
  osc.start(now);
  osc.stop(now + 0.24);
}
