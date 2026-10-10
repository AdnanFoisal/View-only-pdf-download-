import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const Nightline = lazy(() => import("@/game/Nightline"));

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  if (!on) return <Boot />;
  return (
    <Suspense fallback={<Boot />}>
      <Nightline />
    </Suspense>
  );
}

function Boot() {
  return (
    <main className="flex h-dvh items-center justify-center bg-bg text-fg">
      <p className="font-display text-sm tracking-[0.48em] text-muted">NIGHTLINE</p>
    </main>
  );
}
