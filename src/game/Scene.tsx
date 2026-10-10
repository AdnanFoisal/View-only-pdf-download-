import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { createCar } from "./carModel";
import { createSky, createSun, NightWorld } from "./world";
import {
  bindWorldReset,
  installControlsProbe,
  resetRun,
  roadFrame,
  sim,
  tick,
} from "./sim";
import { sfxCollect, sfxScrape, setEngine, syncDriveMusic } from "./audio";

const FIXED = 1 / 60;
const _look = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function GameLoop() {
  const { camera, gl, scene } = useThree();
  const acc = useRef(0);
  const snapped = useRef(false);
  const reduce = useRef(false);
  const prevPhase = useRef(sim.phase);

  const car = useMemo(() => createCar(), []);
  const world = useMemo(
    () =>
      new NightWorld({
        onCollect: () => sfxCollect(),
        onScrape: () => sfxScrape(),
      }),
    [],
  );
  const sky = useMemo(() => createSky(), []);
  const sun = useMemo(() => createSun(), []);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.FogExp2(0x3a1238, 0.0024);
    installControlsProbe();
    bindWorldReset(() => world.resetDecor());
    if (sim.phase === "menu" && sim.s === 0 && sim.speed === 0) resetRun("menu");
    return () => {
      car.dispose();
      world.dispose();
      sky.dispose();
      sun.dispose();
    };
  }, [car, world, sky, sun, gl, scene]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    acc.current += dt;
    let steps = 0;
    while (acc.current >= FIXED && steps < 5) {
      tick(FIXED);
      acc.current -= FIXED;
      steps++;
    }

    const c = car.group;
    c.position.set(sim.worldX, 0, sim.worldZ);
    c.rotation.order = "YZX";
    c.rotation.y = sim.yaw;
    c.rotation.z = sim.roll;
    car.setMotion(sim.speed, sim.steer, dt, sim.scraped > 0 ? 1 : 0);

    world.update();
    setEngine(sim.speed, sim.boostT);
    syncDriveMusic(sim.phase);

    const road = roadFrame(sim.s);
    const fx = road.fx;
    const fz = road.fz;
    if (prevPhase.current !== sim.phase) {
      snapped.current = false;
      prevPhase.current = sim.phase;
    }
    const dist = 6.4;
    const height = 1.62;
    _desired.set(sim.worldX - fx * dist, height, sim.worldZ - fz * dist);
    if (!snapped.current) {
      camera.position.copy(_desired);
      snapped.current = true;
    } else {
      const k = 1 - Math.exp(-6 * dt);
      camera.position.lerp(_desired, k);
    }

    if (!reduce.current && sim.trauma > 0.01) {
      const sh = sim.trauma * sim.trauma;
      camera.position.x += Math.sin(sim.time * 47) * sh * 0.18;
      camera.position.y += Math.cos(sim.time * 39) * sh * 0.1;
    }

    _look.set(sim.worldX + fx * 32, 1.35, sim.worldZ + fz * 32);
    camera.up.copy(_up);
    camera.lookAt(_look);

    sky.mesh.position.copy(camera.position);
    sky.uniforms.sunDir.value.set(fx, 0.2, fz).normalize();
    sun.group.position.set(camera.position.x + fx * 170, 12, camera.position.z + fz * 170);
    sun.group.quaternion.copy(camera.quaternion);

    const cam = camera as THREE.PerspectiveCamera;
    const want = 62 + Math.min(16, sim.speed * 0.18) + sim.fovKick * 10;
    cam.fov += (want - cam.fov) * (1 - Math.exp(-3 * dt));
    cam.updateProjectionMatrix();

    const qa = window as unknown as { __qa?: Record<string, number> };
    qa.__qa = {
      camX: camera.position.x,
      camY: camera.position.y,
      camZ: camera.position.z,
      carX: c.position.x,
      carY: c.position.y,
      carZ: c.position.z,
      s: sim.s,
      x: sim.x,
      yaw: sim.yaw,
      steer: sim.steer,
      speed: sim.speed,
      fov: cam.fov,
      dist: camera.position.distanceTo(c.position),
    };
  });

  return (
    <>
      <primitive object={sky.mesh} />
      <primitive object={sun.group} />
      <primitive object={world.root} />
      <primitive object={car.group} />
      <hemisphereLight args={["#ff8ac8", "#1a0828", 0.55]} />
      <directionalLight position={[30, 40, -80]} intensity={1.35} color="#ffe7c2" />
      <ambientLight intensity={0.18} color="#c070c0" />
    </>
  );
}

export function GameCanvas() {
  const cheap =
    typeof window !== "undefined" && (window.innerWidth < 640 || window.innerHeight < 500);

  return (
    <Canvas
      dpr={cheap ? [1, 1.25] : [1, 1.6]}
      camera={{ fov: 68, near: 0.15, far: 950, position: [0, 1.5, 7] }}
      gl={{ antialias: !cheap, powerPreference: "high-performance", alpha: false }}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    >
      <color attach="background" args={["#14061f"]} />
      <GameLoop />
      <EffectComposer enableNormalPass={false} multisampling={cheap ? 0 : 2}>
        <Bloom
          intensity={cheap ? 0.55 : 0.85}
          luminanceThreshold={0.28}
          luminanceSmoothing={0.25}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.18} darkness={0.62} />
        {!cheap && <ChromaticAberration offset={[0.0007, 0.0005]} />}
      </EffectComposer>
    </Canvas>
  );
}
