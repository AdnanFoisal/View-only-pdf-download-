import { input } from "./input";

export const ROAD_HALF = 7.15;
export const MAX_SPEED = 68;
export const SAMPLE_STEP = 4;

export type Phase = "menu" | "playing" | "paused" | "crash";

export type Sample = {
  s: number;
  x: number;
  z: number;
  h: number;
  c: number;
};

export type Sim = {
  phase: Phase;
  s: number;
  x: number;
  yaw: number;
  speed: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  roll: number;
  steer: number;
  score: number;
  combo: number;
  distance: number;
  time: number;
  trauma: number;
  fovKick: number;
  scraped: number;
  gateFlash: number;
  high: number;
  lastGate: number;
  boostT: number;
};

const HIGH_KEY = "nightline-high";

export const sim: Sim = {
  phase: "menu",
  s: 0,
  x: 0,
  yaw: 0,
  speed: 0,
  worldX: 0,
  worldY: 0.0,
  worldZ: 0,
  roll: 0,
  steer: 0,
  score: 0,
  combo: 1,
  distance: 0,
  time: 0,
  trauma: 0,
  fovKick: 0,
  scraped: 0,
  gateFlash: 0,
  high: 0,
  lastGate: -1,
  boostT: 0,
};

const samples: Sample[] = [];
let sampleUntil = 0;
let pauseEdge = false;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function wrapPi(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function loadHigh() {
  try {
    sim.high = Number(localStorage.getItem(HIGH_KEY) || 0) || 0;
  } catch {
    sim.high = 0;
  }
}

function saveHigh() {
  sim.high = Math.max(sim.high, Math.floor(sim.score));
  try {
    localStorage.setItem(HIGH_KEY, String(sim.high));
  } catch {
    /* ignore */
  }
}

/** Road curvature in rad/m. Intro stretch stays almost straight (matches the still). */
export function curvature(s: number) {
  const intro = clamp((s - 90) / 220, 0, 1);
  return (
    intro *
    (0.0068 * Math.sin(s * 0.0062) +
      0.0052 * Math.sin(s * 0.0135 + 1.7) +
      0.0034 * Math.sin(s * 0.027 + 4.1) +
      0.004 * Math.sin(s * 0.0044 + 2.4) * Math.sin(s * 0.0011))
  );
}

function ensureSamples(upto: number) {
  if (samples.length === 0) {
    samples.push({ s: 0, x: 0, z: 0, h: 0, c: 0 });
    sampleUntil = 0;
  }
  while (sampleUntil < upto + 80) {
    const prev = samples[samples.length - 1]!;
    const ds = SAMPLE_STEP;
    const c = curvature(prev.s + ds * 0.5);
    const h = prev.h + c * ds;
    const x = prev.x + -Math.sin(h) * ds;
    const z = prev.z + -Math.cos(h) * ds;
    sampleUntil += ds;
    samples.push({ s: sampleUntil, x, z, h, c });
  }
  const dropBefore = sim.s - 280;
  while (samples.length > 8 && samples[1]!.s < dropBefore) samples.shift();
}

function lerpSample(s: number): Sample {
  if (s < 0) {
    return { s, x: 0, z: -s, h: 0, c: 0 };
  }
  ensureSamples(s + 40);
  const i = clamp(
    Math.floor((s - samples[0]!.s) / SAMPLE_STEP),
    0,
    samples.length - 2,
  );
  const a = samples[i]!;
  const b = samples[i + 1]!;
  const t = clamp((s - a.s) / SAMPLE_STEP, 0, 1);
  return {
    s,
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    h: a.h + wrapPi(b.h - a.h) * t,
    c: a.c + (b.c - a.c) * t,
  };
}

export function sampleAt(s: number): Sample {
  return lerpSample(s);
}

export function roadFrame(s: number) {
  const p = lerpSample(s);
  const fx = -Math.sin(p.h);
  const fz = -Math.cos(p.h);
  const rx = Math.cos(p.h);
  const rz = -Math.sin(p.h);
  return { ...p, fx, fz, rx, rz };
}

export function worldOnRoad(s: number, lat: number, y = 0) {
  const f = roadFrame(s);
  return { x: f.x + f.rx * lat, y, z: f.z + f.rz * lat, h: f.h, fx: f.fx, fz: f.fz, rx: f.rx, rz: f.rz };
}

function writeWorld() {
  const w = worldOnRoad(sim.s, sim.x, 0);
  sim.worldX = w.x;
  sim.worldZ = w.z;
  sim.worldY = 0;
}

let worldReset: () => void = () => {};

export function bindWorldReset(fn: () => void) {
  worldReset = fn;
}

export function startPlaying() {
  resetRun("playing");
  worldReset();
  input.enabled = true;
}

export function returnToMenu() {
  resetRun("menu");
  worldReset();
  input.enabled = false;
}

export function resetRun(phase: Phase = "playing") {
  sim.phase = phase;
  sim.s = 0;
  sim.x = 0;
  sim.yaw = 0;
  sim.speed = phase === "menu" ? 22 : 18;
  sim.roll = 0;
  sim.steer = 0;
  sim.score = 0;
  sim.combo = 1;
  sim.distance = 0;
  sim.time = 0;
  sim.trauma = 0;
  sim.fovKick = 0;
  sim.scraped = 0;
  sim.gateFlash = 0;
  sim.lastGate = -1;
  sim.boostT = 0;
  vx = 0;
  samples.length = 0;
  sampleUntil = 0;
  ensureSamples(400);
  writeWorld();
}

let vx = 0;

function autoSteer(): number {
  const look = curvature(sim.s + 38);
  const ahead = curvature(sim.s + 18);
  return clamp(-sim.x * 0.28 - look * 90 - ahead * 40 - sim.steer * 0.05, -1, 1);
}

export function tick(dtRaw: number) {
  const dt = Math.min(dtRaw, 0.1);
  const actions = input.poll();

  if (actions.pause && (sim.phase === "playing" || sim.phase === "paused")) {
    if (!pauseEdge) {
      sim.phase = sim.phase === "playing" ? "paused" : "playing";
    }
    pauseEdge = true;
  } else {
    pauseEdge = false;
  }

  const driving = sim.phase === "playing" || sim.phase === "menu";
  if (!driving) return;

  const steerIn = sim.phase === "menu" ? autoSteer() : actions.steer;
  sim.steer += (steerIn - sim.steer) * (1 - Math.exp(-14 * dt));

  const off = Math.max(0, Math.abs(sim.x) - (ROAD_HALF - 0.55));
  const onShoulder = off > 0;

  const cruise = Math.min(
    MAX_SPEED,
    (sim.phase === "menu" ? 32 : 26) + sim.time * 0.7 + sim.distance * 0.008,
  );
  let target = cruise;
  if (sim.phase === "playing" && actions.boost) {
    target = Math.min(MAX_SPEED + 10, cruise + 14);
    sim.boostT = 0.25;
  }
  if (sim.phase === "playing" && actions.brake) target = Math.max(8, sim.speed * 0.42);
  if (onShoulder) target *= 0.42;

  sim.speed += (target - sim.speed) * (1 - Math.exp(-1.8 * dt));
  if (onShoulder) sim.speed *= 1 - 0.35 * dt;
  if (sim.speed < 10) sim.speed = 10;

  const roadNow = roadFrame(sim.s);
  const nose = sim.steer * 0.52;
  sim.yaw = roadNow.h + nose;

  const targetVx = -Math.sin(nose) * sim.speed;
  const grip = onShoulder ? 2.2 : 5.5;
  vx += (targetVx - vx) * (1 - Math.exp(-grip * dt));
  sim.x += vx * dt;
  sim.s += sim.speed * Math.cos(nose) * dt;

  if (sim.s < 0) sim.s = 0;

  const limit = ROAD_HALF + 0.15;
  if (Math.abs(sim.x) > limit) {
    const side = Math.sign(sim.x) || 1;
    sim.x = side * limit;
    vx = -side * Math.min(8, Math.abs(vx) * 0.45 + 2);
    sim.speed *= 0.78;
    sim.trauma = Math.min(1, sim.trauma + 0.28);
    sim.combo = 1;
    sim.scraped = 0.45;
    if (sim.phase === "playing" && sim.speed > 40) {
      crash();
      return;
    }
  }

  sim.roll += (-sim.steer * 0.18 - sim.roll) * (1 - Math.exp(-10 * dt));
  sim.trauma = Math.max(0, sim.trauma - dt * 1.6);
  sim.fovKick = Math.max(0, sim.fovKick - dt * 2.2);
  sim.scraped = Math.max(0, sim.scraped - dt);
  sim.gateFlash = Math.max(0, sim.gateFlash - dt);
  sim.boostT = Math.max(0, sim.boostT - dt);
  sim.time += dt;
  const ds = sim.speed * dt;
  sim.distance += ds;
  if (sim.phase === "playing") sim.score += ds * (0.8 + sim.combo * 0.2);

  writeWorld();
  ensureSamples(sim.s + 420);
}

export function collectGate(id: number, bonus: number) {
  if (sim.phase !== "playing") return;
  if (sim.lastGate === id) return;
  sim.lastGate = id;
  sim.combo = Math.min(12, sim.combo + 1);
  sim.score += bonus * sim.combo;
  sim.speed = Math.min(MAX_SPEED + 8, sim.speed + 4);
  sim.fovKick = 0.4;
  sim.gateFlash = 0.35;
}

function crash() {
  sim.phase = "crash";
  sim.trauma = 0.9;
  sim.speed = 0;
  saveHigh();
}

export function snapshot() {
  return {
    phase: sim.phase,
    speed: sim.speed,
    kmh: sim.speed * 3.6,
    distance: sim.distance,
    score: Math.floor(sim.score),
    combo: sim.combo,
    high: sim.high,
    steer: sim.steer,
    scraped: sim.scraped,
  };
}

export function installControlsProbe() {
  window.__controlsTest = {
    getYaw: () => sim.yaw,
    getSpeed: () => sim.speed,
    setSteer: (v: number) => {
      input.injectedSteer = v;
    },
    setKeys: (codes: string[]) => {
      input.injectedKeys = codes;
      input.injectedSteer = null;
    },
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
  }
}

export { samples };
