import * as THREE from "three";

/**
 * One-piece rear-view wedge. Local frame: +Y up, +Z is the tail,
 * so yaw = 0 faces world −Z.
 */
export type CarRig = {
  group: THREE.Group;
  setMotion: (speed: number, steer: number, dt: number, brake: number) => void;
  dispose: () => void;
};

function mat(opts: ConstructorParameters<typeof THREE.MeshStandardMaterial>[0]) {
  return new THREE.MeshStandardMaterial(opts);
}

export function createCar(): CarRig {
  const group = new THREE.Group();
  group.name = "car";

  const steel = mat({
    color: "#e4e7ee",
    metalness: 0.82,
    roughness: 0.22,
    envMapIntensity: 1.1,
  });
  const steelDark = mat({ color: "#9aa0ac", metalness: 0.85, roughness: 0.3 });
  const trim = mat({ color: "#14141a", metalness: 0.55, roughness: 0.5 });
  const rubber = mat({ color: "#121214", metalness: 0.12, roughness: 0.94 });
  const rim = mat({ color: "#d5d8e0", metalness: 0.9, roughness: 0.16 });
  const disc = mat({ color: "#6a6e78", metalness: 0.75, roughness: 0.35 });
  const glass = mat({
    color: "#120818",
    metalness: 0.7,
    roughness: 0.05,
    transparent: true,
    opacity: 0.78,
  });
  const lightRed = mat({
    color: "#ff2a22",
    emissive: "#ff1a12",
    emissiveIntensity: 5,
    roughness: 0.2,
    metalness: 0.05,
  });
  const lightWhite = mat({
    color: "#fff6d8",
    emissive: "#ffe9b0",
    emissiveIntensity: 3,
    roughness: 0.2,
  });

  const body = makeBody(steel);
  group.add(body);

  // Rear glass, inset into the deck — not a second shell.
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.36, 0.04), glass);
  rearGlass.position.set(0, 0.92, 0.95);
  rearGlass.rotation.x = -0.42;
  group.add(rearGlass);

  const sideGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.85), glass);
  sideGlassL.position.set(-0.78, 0.9, 0.15);
  const sideGlassR = sideGlassL.clone();
  sideGlassR.position.x = 0.78;
  group.add(sideGlassL, sideGlassR);

  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.42, 0.04), glass);
  wind.position.set(0, 0.86, -0.72);
  wind.rotation.x = 0.55;
  group.add(wind);

  // Flush black rear fascia
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.46, 0.05), trim);
  fascia.position.set(0, 0.46, 2.02);
  group.add(fascia);

  const tlGeo = new THREE.BoxGeometry(0.48, 0.16, 0.05);
  const tlL = new THREE.Mesh(tlGeo, lightRed);
  tlL.position.set(-0.46, 0.58, 2.06);
  const tlR = tlL.clone();
  tlR.position.x = 0.46;
  group.add(tlL, tlR);

  const glowL = new THREE.PointLight("#ff2218", 1.6, 6, 2);
  glowL.position.set(-0.46, 0.58, 1.7);
  const glowR = glowL.clone();
  glowR.position.x = 0.46;
  group.add(glowL, glowR);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.03), steelDark);
  plate.position.set(0, 0.32, 2.06);
  group.add(plate);

  const hlGeo = new THREE.BoxGeometry(0.26, 0.08, 0.05);
  const hlL = new THREE.Mesh(hlGeo, lightWhite);
  hlL.position.set(-0.48, 0.42, -2.08);
  const hlR = hlL.clone();
  hlR.position.x = 0.48;
  group.add(hlL, hlR);

  const wheels = [
    placeWheel(-0.9, 1.22, rubber, rim, disc),
    placeWheel(0.9, 1.22, rubber, rim, disc),
    placeWheel(-0.9, -1.28, rubber, rim, disc),
    placeWheel(0.9, -1.28, rubber, rim, disc),
  ];
  wheels[1]!.rotation.y = Math.PI;
  wheels[3]!.rotation.y = Math.PI;
  group.add(...wheels);

  const mats = [steel, steelDark, trim, rubber, rim, disc, glass, lightRed, lightWhite];

  return {
    group,
    setMotion(speed, steer, dt, brake) {
      const spin = (speed / 0.34) * dt;
      for (const w of wheels) {
        w.children[0]!.rotation.x += spin;
      }
      wheels[2]!.rotation.y = steer * 0.42;
      wheels[3]!.rotation.y = Math.PI + steer * 0.42;
      lightRed.emissiveIntensity = 4.2 + brake * 4;
    },
    dispose() {
      group.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      for (const m of mats) m.dispose();
    },
  };
}

function placeWheel(
  x: number,
  z: number,
  rubber: THREE.Material,
  rim: THREE.Material,
  disc: THREE.Material,
) {
  const g = makeWheel(rubber, rim, disc);
  g.position.set(x, 0.34, z);
  return g;
}

function makeBody(steel: THREE.Material) {
  const s = new THREE.Shape();
  // One continuous shell. x runs tail → nose, y is height.
  s.moveTo(0.05, 0.18);
  s.lineTo(0.05, 0.62);
  s.lineTo(0.35, 0.72);
  s.lineTo(0.7, 0.78);
  s.lineTo(1.15, 1.08);
  s.lineTo(1.7, 1.16);
  s.lineTo(2.35, 1.1);
  s.lineTo(2.95, 0.68);
  s.lineTo(3.7, 0.48);
  s.lineTo(4.2, 0.34);
  s.lineTo(4.22, 0.18);
  s.lineTo(0.2, 0.16);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.72,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.05,
    bevelSegments: 2,
    steps: 1,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate(-0.86, 0, 2.08);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, steel);
}

function makeWheel(rubber: THREE.Material, rim: THREE.Material, disc: THREE.Material) {
  const g = new THREE.Group();
  const rolling = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 20), rubber);
  tire.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 14), rim);
  hub.rotation.z = Math.PI / 2;
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 14), disc);
  rotor.rotation.z = Math.PI / 2;
  rolling.add(tire, hub, rotor);
  g.add(rolling);
  return g;
}
