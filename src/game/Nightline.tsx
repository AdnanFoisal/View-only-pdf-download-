import { useEffect, useState, type ReactNode } from "react";
import { Gauge, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { GameCanvas } from "./Scene";
import { input } from "./input";
import {
  loadHigh,
  resetRun,
  returnToMenu,
  sim,
  snapshot,
  startPlaying,
} from "./sim";
import { isMuted, playDriveMusic, resumeIfNeeded, sfxCrash, toggleMute, unlockAudio } from "./audio";

type Hud = ReturnType<typeof snapshot>;

export default function Nightline() {
  const [hud, setHud] = useState<Hud>(() => snapshot());
  const [muted, setMuted] = useState(false);
  const [hint, setHint] = useState(true);

  useEffect(() => {
    loadHigh();
    resetRun("menu");
    input.attach();
    const id = window.setInterval(() => setHud(snapshot()), 80);
    return () => {
      window.clearInterval(id);
      input.detach();
    };
  }, []);

  useEffect(() => {
    const onVis = () => resumeIfNeeded();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (hud.phase === "crash") sfxCrash();
  }, [hud.phase]);

  useEffect(() => {
    if (hud.phase !== "playing") return;
    const t = window.setTimeout(() => setHint(false), 3500);
    return () => window.clearTimeout(t);
  }, [hud.phase]);

  const start = () => {
    unlockAudio();
    playDriveMusic();
    setHint(true);
    startPlaying();
    setHud(snapshot());
  };

  const retry = () => start();

  const menu = () => {
    returnToMenu();
    setHud(snapshot());
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0">
        <GameCanvas />
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, color-mix(in oklab, var(--color-bg) 78%, transparent) 100%)",
        }}
      />

      <HudChrome hud={hud} hint={hint} />

      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-20 flex gap-2">
        <IconBtn
          label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted(toggleMute())}
        >
          {muted || isMuted() ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </IconBtn>
        {hud.phase === "playing" || hud.phase === "paused" ? (
          <IconBtn
            label={hud.phase === "paused" ? "Resume" : "Pause"}
            onClick={() => {
              sim.phase = sim.phase === "paused" ? "playing" : "paused";
              input.enabled = sim.phase === "playing";
              setHud(snapshot());
            }}
          >
            {hud.phase === "paused" ? <Play className="size-5" /> : <Pause className="size-5" />}
          </IconBtn>
        ) : null}
      </div>

      {hud.phase === "menu" && <Menu onStart={start} high={hud.high} />}
      {hud.phase === "paused" && (
        <Overlay>
          <h2 className="font-display text-2xl tracking-[0.28em]">Paused</h2>
          <p className="text-muted">The strip keeps its heat. Resume when ready.</p>
          <Primary onClick={() => {
            sim.phase = "playing";
            input.enabled = true;
            setHud(snapshot());
          }}>
            Resume
          </Primary>
          <Ghost onClick={menu}>Menu</Ghost>
        </Overlay>
      )}
      {hud.phase === "crash" && (
        <Overlay>
          <p className="font-display text-xs tracking-[0.42em] text-danger">Signal lost</p>
          <h2 className="font-display text-3xl tracking-[0.18em]">Spinout</h2>
          <p className="tabular-nums text-lg text-fg">
            {hud.score.toLocaleString()} <span className="text-muted">pts</span>
          </p>
          <p className="text-sm text-muted">{(hud.distance / 1000).toFixed(2)} km · best {hud.high.toLocaleString()}</p>
          <Primary onClick={retry}>Start</Primary>
          <Ghost onClick={menu}>Menu</Ghost>
        </Overlay>
      )}
    </main>
  );
}

function HudChrome({ hud, hint }: { hud: Hud; hint: boolean }) {
  if (hud.phase !== "playing" && hud.phase !== "paused") return null;
  const kmh = Math.round(hud.kmh);
  return (
    <>
      <div className="pointer-events-none absolute left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-10">
        <p className="font-display text-[11px] tracking-[0.42em] text-accent">NIGHTLINE</p>
        <div className="mt-3 flex items-end gap-3">
          <Gauge className="mb-1 size-4 text-muted" />
          <p className="font-display text-4xl tabular-nums leading-none tracking-tight">
            {kmh}
            <span className="ml-1 text-sm text-muted">km/h</span>
          </p>
        </div>
      </div>
      <div className="pointer-events-none absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-10 text-right md:top-[max(1rem,env(safe-area-inset-top))] md:bottom-auto">
        <p className="font-display text-[11px] tracking-[0.32em] text-muted">Score</p>
        <p className="font-display text-2xl tabular-nums">{hud.score.toLocaleString()}</p>
        <p className="text-sm text-muted tabular-nums">
          {(hud.distance / 1000).toFixed(2)} km
          {hud.combo > 1 ? <span className="ml-2 text-accent">×{hud.combo}</span> : null}
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-10 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2">
        <div className="relative h-2 rounded-full bg-surface-2">
          <div className="absolute inset-y-0 left-1/2 w-px bg-fg/30" />
          <div
            className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-line"
            style={{ left: `${50 - hud.steer * 46}%`, transform: "translate(-50%, -50%)" }}
          />
        </div>
        {hint ? (
          <p className="mt-2 text-center text-xs tracking-[0.22em] text-muted uppercase">
            Drag to steer · A / D
          </p>
        ) : null}
      </div>
    </>
  );
}

function Menu({ onStart, high }: { onStart: () => void; high: number }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-end px-6 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] md:justify-center md:pb-24">
      <div className="mb-auto md:mb-10 text-center">
        <p className="font-display text-[11px] tracking-[0.55em] text-accent">SYNTH HIGHWAY</p>
        <h1 className="mt-3 font-display text-5xl tracking-[0.22em] md:text-7xl">NIGHTLINE</h1>
        <p className="mx-auto mt-4 max-w-sm text-base leading-snug text-muted">
          Auto-drive into the sun. Steer the wedge. Hold the wet lane. No traffic — just the city and the curve.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col items-center gap-3">
        {high > 0 ? (
          <p className="font-display text-sm tabular-nums tracking-widest text-sun">
            BEST {high.toLocaleString()}
          </p>
        ) : null}
        <Primary onClick={onStart}>Start</Primary>
        <p className="text-center text-xs leading-relaxed text-muted">
          Touch: drag left / right · Keys: A D · Boost: W / Space · Brake: S
        </p>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-bg/55 px-6 text-center backdrop-blur-[2px]">
      <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-xl bg-surface/90 px-6 py-8">
        {children}
      </div>
    </div>
  );
}

function Primary({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-12 w-full max-w-xs rounded-md bg-fg px-6 font-display text-sm tracking-[0.28em] text-bg transition-transform duration-(--motion-quick,150ms) hover:opacity-90 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

function Ghost({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 w-full max-w-xs rounded-md border border-fg/15 bg-transparent px-6 text-sm tracking-[0.18em] text-muted transition-opacity hover:text-fg"
    >
      {children}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      data-ui
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-md border border-fg/15 bg-surface/80 text-fg backdrop-blur-sm"
    >
      {children}
    </button>
  );
}
