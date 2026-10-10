/** Engine bed + the driving track. The song loops only while you are driving. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfx: GainNode | null = null;
let engineOsc: OscillatorNode | null = null;
let engineGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let track: HTMLAudioElement | null = null;
let muted = false;
let started = false;

export function isMuted() {
  return muted;
}

export function unlockAudio() {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!ctx) ctx = new AC({ latencyHint: "interactive" });
  if (ctx.state === "suspended") void ctx.resume();
  if (started) return;
  started = true;
  buildGraph();
  startEngine();
}

function buildGraph() {
  if (!ctx) return;
  master = ctx.createGain();
  sfx = ctx.createGain();
  master.gain.value = 0.85;
  sfx.gain.value = 0.35;
  sfx.connect(master);
  master.connect(ctx.destination);
}

function ensureTrack() {
  if (track) return track;
  track = new Audio("/sunset-drive.mp3");
  track.loop = true;
  track.preload = "auto";
  track.volume = 0.82;
  return track;
}

/** Start or resume Sunset Drive. Call from the Start gesture. */
export function playDriveMusic() {
  unlockAudio();
  const el = ensureTrack();
  el.volume = muted ? 0 : 0.82;
  if (el.paused) void el.play().catch(() => {});
}

/** Loop only during a live run. Pause on menu, pause, and crash. */
export function syncDriveMusic(phase: string) {
  if (!track) return;
  track.volume = muted ? 0 : 0.82;
  const on = phase === "playing" && !muted;
  if (on && track.paused) void track.play().catch(() => {});
  if (!on && !track.paused) track.pause();
  const probe = window as unknown as { __music?: { paused: boolean; t: number; loop: boolean } };
  probe.__music = { paused: track.paused, t: track.currentTime, loop: track.loop };
}

function startEngine() {
  if (!ctx || !sfx || engineOsc) return;
  engineOsc = ctx.createOscillator();
  engineOsc.type = "sawtooth";
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 240;
  engineGain = ctx.createGain();
  engineGain.gain.value = 0.02;
  engineOsc.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(sfx);
  engineOsc.start();
}

export function setMuted(next: boolean) {
  muted = next;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.03);
  if (track) track.volume = muted ? 0 : 0.82;
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

export function setEngine(speed: number, boost: number) {
  if (!ctx || !engineOsc || !engineFilter || !engineGain) return;
  const t = ctx.currentTime;
  const f = 38 + speed * 1.6 + boost * 12;
  engineOsc.frequency.setTargetAtTime(f, t, 0.05);
  engineFilter.frequency.setTargetAtTime(180 + speed * 4, t, 0.08);
  engineGain.gain.setTargetAtTime(0.012 + speed * 0.0004, t, 0.08);
}

function beep(freq: number, dur: number, type: OscillatorType, gain: number) {
  if (!ctx || !sfx || muted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(sfx);
  o.start();
  o.stop(ctx.currentTime + dur);
}

export function sfxCollect() {
  beep(880, 0.12, "sine", 0.1);
  beep(1320, 0.18, "triangle", 0.06);
}

export function sfxScrape() {
  beep(90, 0.16, "sawtooth", 0.06);
}

export function sfxCrash() {
  beep(60, 0.5, "sawtooth", 0.16);
  beep(40, 0.7, "square", 0.08);
}

export function resumeIfNeeded() {
  if (ctx?.state === "suspended") void ctx.resume();
}
