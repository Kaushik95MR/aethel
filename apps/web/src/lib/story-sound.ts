// The soundscape for the trek story. Each chapter plays real, freely licensed recordings (field recordings and two music
// tracks, see data/audio-credits.json) instead of synthesized noise. Files load only when their chapter is first reached,
// loop with a soft crossfade so there is no seam, and are levelled by measured loudness so none is louder than another.

import { getAudio, isSoundOn, setWindBase, subscribe } from "./sound";

export type SceneId = "city" | "bus" | "forest" | "summit" | "jeep" | "camp" | "night" | "morning" | "home";

type Kind = "ambience" | "music";
type Layer = { file: string; kind: Kind; level: number };

// Loudness targets (RMS of the decoded file) for each kind, so recordings made at very different volumes sit together.
const TARGET: Record<Kind, number> = { ambience: 0.05, music: 0.06 };

const SCENES: Record<SceneId, Layer[]> = {
  // Friday night in Bengaluru: traffic at the kerb.
  city: [{ file: "city", kind: "ambience", level: 1 }],
  // The party bus: the music is the star, the road sits underneath.
  bus: [
    { file: "music-bus", kind: "music", level: 1 },
    { file: "road", kind: "ambience", level: 0.35 },
  ],
  forest: [{ file: "forest", kind: "ambience", level: 1 }],
  summit: [{ file: "summit", kind: "ambience", level: 1 }],
  // A jeep on a hill track with the calm music low underneath.
  jeep: [
    { file: "jeep", kind: "ambience", level: 0.8 },
    { file: "music-calm", kind: "music", level: 0.35 },
  ],
  camp: [
    { file: "camp", kind: "ambience", level: 0.85 },
    { file: "music-calm", kind: "music", level: 0.55 },
  ],
  night: [{ file: "night", kind: "ambience", level: 0.9 }],
  morning: [{ file: "morning", kind: "ambience", level: 1 }],
  // The ride back: the road and the calm music again.
  home: [
    { file: "road", kind: "ambience", level: 0.6 },
    { file: "music-calm", kind: "music", level: 0.5 },
  ],
};

type Scene = { gain: GainNode; start: () => void; stop: () => void };

const scenes = new Map<SceneId, Scene>();
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let desired: SceneId | null = null;
let current: SceneId | null = null;
let ctxRef: AudioContext | null = null;

/** How much to scale a decoded file so its loudness matches the target for its kind. */
function loudnessGain(buf: AudioBuffer, kind: Kind) {
  const data = buf.getChannelData(0);
  let sum = 0;
  let n = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.abs(data[i]);
    sum += v * v;
    n++;
    if (v > peak) peak = v;
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  if (rms < 0.0005) return 1;
  // Match the target loudness, but never boost a file so far that its loudest moments distort.
  return Math.min(6, Math.max(0.2, TARGET[kind] / rms), 0.8 / Math.max(peak, 0.01));
}

function load(ctx: AudioContext, file: string): Promise<AudioBuffer | null> {
  let p = buffers.get(file);
  if (!p) {
    p = fetch(`/audio/${file}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    buffers.set(file, p);
  }
  return p;
}

/** Plays a buffer on repeat. Each pass fades in and out while the next begins, so the loop point is inaudible. */
function loopLayer(ctx: AudioContext, buf: AudioBuffer, out: AudioNode, level: number) {
  const fade = Math.min(3, buf.duration / 4);
  const sources = new Set<AudioBufferSourceNode>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const play = (at: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(level, at + fade);
    g.gain.setValueAtTime(level, at + buf.duration - fade);
    g.gain.linearRampToValueAtTime(0.0001, at + buf.duration);
    src.connect(g).connect(out);
    src.onended = () => {
      sources.delete(src);
      src.disconnect();
      g.disconnect();
    };
    sources.add(src);
    src.start(at);

    const next = at + buf.duration - fade;
    timer = setTimeout(() => {
      if (!stopped) play(next);
    }, Math.max(0, (next - ctx.currentTime - 0.6) * 1000));
  };
  play(ctx.currentTime + 0.05);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // already ended
      }
    });
  };
}

function build(id: SceneId, ctx: AudioContext, out: GainNode): Scene {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out);
  let running = false;
  let stops: (() => void)[] = [];

  return {
    gain,
    start() {
      if (running) return;
      running = true;
      void Promise.all(SCENES[id].map((l) => load(ctx, l.file))).then((bufs) => {
        // The visitor may have scrolled on, or turned sound off, while the files were loading.
        if (!running || stops.length) return;
        bufs.forEach((buf, i) => {
          const layer = SCENES[id][i];
          if (buf) stops.push(loopLayer(ctx, buf, gain, layer.level * loudnessGain(buf, layer.kind)));
        });
      });
    },
    stop() {
      running = false;
      stops.forEach((s) => s());
      stops = [];
    },
  };
}

function apply() {
  const audio = getAudio();
  if (!audio || !isSoundOn()) {
    // Sound is off: stop whatever was playing so nothing keeps running.
    if (current) scenes.get(current)?.stop();
    current = null;
    return;
  }
  const { ctx, master } = audio;
  if (ctxRef !== ctx) {
    ctxRef = ctx;
    scenes.clear();
    buffers.clear();
  }
  if (desired === current) return;

  const now = ctx.currentTime;
  if (current) {
    const oldId = current;
    const old = scenes.get(oldId);
    if (old) {
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setTargetAtTime(0, now, 0.5);
      // Only stop it if the visitor hasn't scrolled back to it in the meantime.
      setTimeout(() => {
        if (current !== oldId) old.stop();
      }, 2400);
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
    sc.gain.gain.setTargetAtTime(1, now, 0.8);
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
