import * as THREE from "three";
import { ROAD_HALF, sim, worldOnRoad, collectGate } from "./sim";
import { makeAsphaltTexture, makeFacadeTexture, makeGlowSprite } from "./textures";

const ROAD_LEN = 70;
const BUILDINGS = 72;
const LAMPS = 36;
const DASHES = 90;
const GATES = 10;

function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class NightWorld {
  root = new THREE.Group();
  private asphalt: THREE.Mesh;
  private shoulder: THREE.Mesh;
  private edgeL: THREE.Mesh;
  private edgeR: THREE.Mesh;
  private dashes: THREE.InstancedMesh;
  private posts: THREE.InstancedMesh;
  private arms: THREE.InstancedMesh;
  private bulbs: THREE.InstancedMesh;
  private buildings: THREE.InstancedMesh;
  private neon: THREE.InstancedMesh;
  private gates: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private lastRoadS = -999;
  private lastDecorS = -999;
  private collected = new Set<number>();
  private gateIds: number[] = [];
  private textures: THREE.Texture[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private lastScrape = 0;
  private onCollect?: () => void;
  private onScrape?: () => void;
  private skyline = new THREE.Group();
  private ground!: THREE.Mesh;
  private dS: number[] = [];
  private lS: number[] = [];
  private bS: number[] = [];
  private gIds: number[] = [];

  constructor(hooks: { onCollect?: () => void; onScrape?: () => void }) {
    this.onCollect = hooks.onCollect;
    this.onScrape = hooks.onScrape;
    this.root.name = "world";

    const asphaltTex = makeAsphaltTexture();
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(1, 18);
    this.textures.push(asphaltTex);

    const roadMat = new THREE.MeshStandardMaterial({
      color: "#0c0a14",
      map: asphaltTex,
      roughness: 0.22,
      metalness: 0.45,
      envMapIntensity: 1.4,
    });
    const shoulderMat = new THREE.MeshStandardMaterial({
      color: "#090814",
      roughness: 0.7,
      metalness: 0.1,
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: "#f5e04a",
      emissive: "#f5e04a",
      emissiveIntensity: 1.8,
      roughness: 0.4,
    });
    const dashMat = new THREE.MeshStandardMaterial({
      color: "#f2e7a0",
      emissive: "#c4b56a",
      emissiveIntensity: 0.6,
      roughness: 0.45,
    });
    const postMat = new THREE.MeshStandardMaterial({ color: "#1a1424", metalness: 0.6, roughness: 0.4 });
    const armMat = new THREE.MeshStandardMaterial({ color: "#24182e", metalness: 0.5, roughness: 0.45 });
    const bulbMat = new THREE.MeshStandardMaterial({
      color: "#ffe7a3",
      emissive: "#ffe7a3",
      emissiveIntensity: 3.2,
      roughness: 0.3,
    });
    const facadeA = makeFacadeTexture(1);
    const facadeB = makeFacadeTexture(7);
    facadeA.wrapS = facadeA.wrapT = THREE.RepeatWrapping;
    facadeB.wrapS = facadeB.wrapT = THREE.RepeatWrapping;
    this.textures.push(facadeA, facadeB);
    const bldMat = new THREE.MeshStandardMaterial({
      color: "#c8c4d8",
      map: facadeA,
      roughness: 0.55,
      metalness: 0.25,
      emissive: "#1a0828",
      emissiveIntensity: 0.35,
    });
    const neonMat = new THREE.MeshStandardMaterial({
      color: "#3cf0ff",
      emissive: "#3cf0ff",
      emissiveIntensity: 2.8,
    });
    const gateMat = new THREE.MeshStandardMaterial({
      color: "#7ee7ff",
      emissive: "#7ee7ff",
      emissiveIntensity: 3.4,
      roughness: 0.25,
      metalness: 0.4,
    });
    this.mats.push(
      roadMat,
      shoulderMat,
      lineMat,
      dashMat,
      postMat,
      armMat,
      bulbMat,
      bldMat,
      neonMat,
      gateMat,
    );

    const roadGeo = this.makeRibbon(ROAD_HALF, ROAD_LEN);
    const shoulderGeo = this.makeRibbon(ROAD_HALF + 5.5, ROAD_LEN);
    const edgeGeo = this.makeRibbon(0.08, ROAD_LEN);
    this.geos.push(roadGeo, shoulderGeo, edgeGeo);

    this.asphalt = new THREE.Mesh(roadGeo, roadMat);
    this.asphalt.frustumCulled = false;
    this.shoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    this.shoulder.frustumCulled = false;
    this.shoulder.position.y = -0.02;
    this.edgeL = new THREE.Mesh(edgeGeo, lineMat);
    this.edgeR = new THREE.Mesh(edgeGeo.clone(), lineMat);
    this.edgeL.frustumCulled = false;
    this.edgeR.frustumCulled = false;
    this.asphalt.position.y = 0.01;
    this.edgeL.position.y = 0.03;
    this.edgeR.position.y = 0.03;
    this.root.add(this.shoulder, this.asphalt, this.edgeL, this.edgeR);

    const dashGeo = new THREE.BoxGeometry(0.12, 0.03, 2.4);
    this.dashes = new THREE.InstancedMesh(dashGeo, dashMat, DASHES);
    this.geos.push(dashGeo);
    this.root.add(this.dashes);

    const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 5.2, 8);
    const armGeo = new THREE.BoxGeometry(0.08, 0.08, 2.4);
    const bulbGeo = new THREE.SphereGeometry(0.18, 10, 8);
    this.posts = new THREE.InstancedMesh(postGeo, postMat, LAMPS);
    this.arms = new THREE.InstancedMesh(armGeo, armMat, LAMPS);
    this.bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, LAMPS);
    this.geos.push(postGeo, armGeo, bulbGeo);
    this.root.add(this.posts, this.arms, this.bulbs);

    const bldGeo = new THREE.BoxGeometry(1, 1, 1);
    bldGeo.translate(0, 0.5, 0);
    this.buildings = new THREE.InstancedMesh(bldGeo, bldMat, BUILDINGS);
    this.buildings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.neon = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), neonMat, BUILDINGS);
    this.geos.push(bldGeo);
    this.root.add(this.buildings, this.neon);

    const gateGeo = new THREE.TorusGeometry(2.15, 0.08, 8, 24);
    gateGeo.rotateY(Math.PI / 2);
    this.gates = new THREE.InstancedMesh(gateGeo, gateMat, GATES);
    this.geos.push(gateGeo);
    this.root.add(this.gates);

    for (const mesh of [
      this.dashes,
      this.posts,
      this.arms,
      this.bulbs,
      this.buildings,
      this.neon,
      this.gates,
    ]) {
      mesh.frustumCulled = false;
    }

    this.seedSlots();

    // Ground follows the car so the world never drops into a void.
    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(420, 40),
      new THREE.MeshStandardMaterial({ color: "#070510", roughness: 1, metalness: 0 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.08;
    this.ground.frustumCulled = false;
    this.root.add(this.ground);

    this.skyline.name = "skyline";
    this.root.add(this.skyline);
    this.addHorizonCity();
  }

  private seedSlots() {
    this.dS = Array.from({ length: DASHES }, (_, i) => i * 6 - 24);
    this.lS = Array.from({ length: LAMPS }, (_, i) => i * 16 - 20);
    this.bS = Array.from({ length: BUILDINGS }, (_, i) => (i >> 1) * 13 - 26);
    this.gIds = Array.from({ length: GATES }, (_, i) => i);
  }

  /** Advance a slot to the front of the stream instead of sliding every instance. */
  private recycle(slots: number[], span: number, behind: number) {
    const limit = sim.s - behind;
    for (let i = 0; i < slots.length; i++) {
      let s = slots[i]!;
      if (s < limit) {
        const jumps = Math.ceil((limit - s) / span);
        s += jumps * span;
        slots[i] = s;
      }
    }
  }

  private addHorizonCity() {
    const facade = makeFacadeTexture(3);
    this.textures.push(facade);
    const mat = new THREE.MeshStandardMaterial({
      map: facade,
      color: "#a8a0c0",
      roughness: 0.6,
      metalness: 0.2,
      emissive: "#140820",
      emissiveIntensity: 0.5,
    });
    this.mats.push(mat);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    this.geos.push(geo);
    const n = 40;
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 1.1 - Math.PI * 0.55;
      const dist = 220 + hash(i + 9) * 90;
      const h = 28 + hash(i + 3) * 90;
      const w = 10 + hash(i + 5) * 18;
      d.position.set(Math.sin(a) * dist, 0, -Math.cos(a) * dist - 80);
      d.scale.set(w, h, w * 0.8);
      d.rotation.y = a;
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    this.skyline.add(mesh);
  }

  private makeRibbon(half: number, segs: number) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((segs + 1) * 2 * 3);
    const uv = new Float32Array((segs + 1) * 2 * 2);
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.setDrawRange(0, idx.length);
    return geo;
  }

  private writeRibbon(mesh: THREE.Mesh, half: number, startS: number, offset = 0) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    const segs = pos.count / 2 - 1;
    const step = 8;
    for (let i = 0; i <= segs; i++) {
      const s = startS + i * step;
      const f = worldOnRoad(s, 0);
      const lat = half;
      const lx = f.x + f.rx * (-lat + offset);
      const lz = f.z + f.rz * (-lat + offset);
      const rx = f.x + f.rx * (lat + offset);
      const rz = f.z + f.rz * (lat + offset);
      pos.setXYZ(i * 2, lx, 0, lz);
      pos.setXYZ(i * 2 + 1, rx, 0, rz);
      uv.setXY(i * 2, 0, s * 0.04);
      uv.setXY(i * 2 + 1, 1, s * 0.04);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }

  private layoutDecor() {
    const d = this.dummy;

    const dashSpan = DASHES * 6;
    this.recycle(this.dS, dashSpan, 36);
    for (let i = 0; i < DASHES; i++) {
      const s = this.dS[i]!;
      const lane = i % 2 === 0 ? -2.15 : 2.15;
      const f = worldOnRoad(s, lane);
      d.position.set(f.x, 0.045, f.z);
      d.rotation.set(0, f.h, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.dashes.setMatrixAt(i, d.matrix);
    }
    this.dashes.instanceMatrix.needsUpdate = true;

    const lampSpan = LAMPS * 16;
    this.recycle(this.lS, lampSpan, 24);
    for (let i = 0; i < LAMPS; i++) {
      const s = this.lS[i]!;
      const side = i % 2 === 0 ? -1 : 1;
      const f = worldOnRoad(s, side * (ROAD_HALF + 1.5));
      d.position.set(f.x, 2.6, f.z);
      d.rotation.set(0, f.h, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.posts.setMatrixAt(i, d.matrix);

      d.position.set(f.x - f.rx * side * 1.1, 5.05, f.z - f.rz * side * 1.1);
      d.rotation.set(0, f.h, 0.15 * side);
      d.updateMatrix();
      this.arms.setMatrixAt(i, d.matrix);

      d.position.set(f.x - f.rx * side * 2.15, 5.0, f.z - f.rz * side * 2.15);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.bulbs.setMatrixAt(i, d.matrix);
    }
    this.posts.instanceMatrix.needsUpdate = true;
    this.arms.instanceMatrix.needsUpdate = true;
    this.bulbs.instanceMatrix.needsUpdate = true;

    const pairSpan = (BUILDINGS / 2) * 13;
    this.recycle(this.bS, pairSpan, 48);
    for (let i = 0; i < BUILDINGS; i++) {
      const s = this.bS[i]!;
      const side = i % 2 === 0 ? -1 : 1;
      const depth = 7 + hash(i + 4) * 14;
      const f = worldOnRoad(s, side * (ROAD_HALF + 3.2 + depth));
      const w = 6 + hash(i + 2) * 11;
      const h = 12 + hash(i + 11) * 52;
      const depthZ = 6 + hash(i + 6) * 11;
      d.position.set(f.x, 0, f.z);
      d.rotation.set(0, f.h, 0);
      d.scale.set(w, h, depthZ);
      d.updateMatrix();
      this.buildings.setMatrixAt(i, d.matrix);

      d.position.set(f.x + f.rx * side * (w * 0.48), h * 0.45, f.z + f.rz * side * (w * 0.48));
      d.scale.set(0.28, h * 0.86, 0.28);
      d.updateMatrix();
      this.neon.setMatrixAt(i, d.matrix);
    }
    this.buildings.instanceMatrix.needsUpdate = true;
    this.neon.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < GATES; i++) {
      let id = this.gIds[i]!;
      const behind = sim.s - 40;
      if (id * 160 + 80 < behind) {
        const jumps = Math.ceil((behind - (id * 160 + 80)) / (GATES * 160));
        id += jumps * GATES;
        this.gIds[i] = id;
      }
      const gs = id * 160 + 80;
      const lane = (hash(id) > 0.5 ? 1 : -1) * 3.1 * (hash(id + 1) > 0.4 ? 1 : 0);
      const f = worldOnRoad(gs, lane);
      const taken = this.collected.has(id);
      d.position.set(f.x, 1.55, f.z);
      d.rotation.set(0, f.h, 0);
      d.scale.set(taken ? 0.001 : 1, taken ? 0.001 : 1, taken ? 0.001 : 1);
      d.updateMatrix();
      this.gates.setMatrixAt(i, d.matrix);
      this.gateIds[i] = id;
    }
    this.gates.instanceMatrix.needsUpdate = true;
  }

  update() {
    const s = sim.s;
    if (Math.abs(s - this.lastRoadS) > 4) {
      const start = s - 80;
      this.writeRibbon(this.asphalt, ROAD_HALF, start);
      this.writeRibbon(this.shoulder, ROAD_HALF + 5.5, start);
      this.writeRibbon(this.edgeL, 0.09, start, -ROAD_HALF + 0.12);
      this.writeRibbon(this.edgeR, 0.09, start, ROAD_HALF - 0.12);
      this.lastRoadS = s;
    }
    this.layoutDecor();
    this.ground.position.set(sim.worldX, -0.08, sim.worldZ);
    this.skyline.position.set(sim.worldX, 0, sim.worldZ);

    // Gate pickup
    for (let i = 0; i < this.gateIds.length; i++) {
      const id = this.gateIds[i]!;
      if (this.collected.has(id)) continue;
      const gs = id * 160 + 80;
      if (Math.abs(sim.s - gs) < 2.4) {
        const lane = (hash(id) > 0.5 ? 1 : -1) * 3.2 * (hash(id + 1) > 0.35 ? 1 : 0);
        if (Math.abs(sim.x - lane) < 2.4) {
          this.collected.add(id);
          collectGate(id, 120);
          this.onCollect?.();
          this.dummy.scale.set(0, 0, 0);
          this.dummy.position.set(0, -10, 0);
          this.dummy.updateMatrix();
          this.gates.setMatrixAt(i, this.dummy.matrix);
          this.gates.instanceMatrix.needsUpdate = true;
        }
      }
    }

    if (sim.scraped > 0.4 && sim.time - this.lastScrape > 0.25) {
      this.lastScrape = sim.time;
      this.onScrape?.();
    }
  }

  resetDecor() {
    this.collected.clear();
    this.lastRoadS = -999;
    this.lastDecorS = -999;
    this.seedSlots();
    this.gateIds = [];
  }

  dispose() {
    this.root.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const t of this.textures) t.dispose();
    for (const m of this.mats) m.dispose();
  }
}

export function createSky() {
  const uniforms = {
    sunDir: { value: new THREE.Vector3(0, 0.18, -1).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vDir = worldPos.xyz - cameraPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 sunDir;
      void main() {
        vec3 dir = normalize(vDir);
        vec3 bot = vec3(1.0, 0.48, 0.62);
        vec3 mid = vec3(0.62, 0.12, 0.48);
        vec3 top = vec3(0.06, 0.02, 0.16);
        vec3 col = mix(bot, mid, smoothstep(-0.2, 0.08, dir.y));
        col = mix(col, top, smoothstep(0.05, 0.55, dir.y));
        float d = max(0.0, dot(dir, normalize(sunDir)));
        float sun = pow(d, 180.0);
        float halo = pow(d, 8.0);
        float wash = pow(d, 2.2);
        col += vec3(1.0, 0.86, 0.45) * sun * 3.4;
        col += vec3(1.0, 0.45, 0.62) * halo * 0.85;
        col += vec3(0.85, 0.25, 0.45) * wash * 0.35;
        float n = fract(sin(dot(dir.xy, vec2(12.9898, 78.233))) * 43758.5453);
        float star = step(0.997, n) * smoothstep(0.15, 0.55, dir.y);
        col += vec3(0.95, 0.9, 1.0) * star;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(600, 28, 18), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, uniforms, dispose: () => { mesh.geometry.dispose(); mat.dispose(); } };
}

export function createSun() {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(22, 48),
    new THREE.MeshBasicMaterial({
      color: "#fff1c2",
      toneMapped: false,
      fog: false,
      depthWrite: false,
    }),
  );
  group.add(disc);

  const glowTex = makeGlowSprite("#ffe7a3");
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: "#ffd27a",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.95,
    }),
  );
  glow.scale.set(140, 140, 1);
  group.add(glow);

  const pink = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: "#ff4d9a",
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.55,
    }),
  );
  pink.scale.set(260, 150, 1);
  group.add(pink);

  return {
    group,
    dispose: () => {
      disc.geometry.dispose();
      (disc.material as THREE.Material).dispose();
      glowTex.dispose();
      (glow.material as THREE.Material).dispose();
      (pink.material as THREE.Material).dispose();
    },
  };
}

