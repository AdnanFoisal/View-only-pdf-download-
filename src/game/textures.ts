import * as THREE from "three";

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

export function makeFacadeTexture(seed: number) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = seed % 2 === 0 ? "#14081f" : "#0d1020";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1b0e2a";
    g.fillRect(0, 0, 6, h);
    g.fillRect(w - 6, 0, 6, h);
    const cols = 8;
    const rows = 22;
    const cw = (w - 20) / cols;
    const rh = (h - 24) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const n = Math.sin((r + 1) * 12.9898 + (c + seed) * 78.233 + seed) * 43758.5453;
        const u = n - Math.floor(n);
        if (u < 0.28) continue;
        if (u > 0.86) g.fillStyle = "#ffe7a3";
        else if (u > 0.55) g.fillStyle = "#5ce1ff";
        else g.fillStyle = "#e445c5";
        g.globalAlpha = 0.45 + u * 0.5;
        g.fillRect(12 + c * cw + 2, 12 + r * rh + 2, cw - 5, rh - 5);
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = seed % 3 === 0 ? "#3cf0ff" : "#e445c5";
    g.fillRect(0, 0, 3, h);
    g.fillRect(w - 3, 0, 3, h);
  });
}

export function makeAsphaltTexture() {
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = "#0b0914";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      const n = Math.sin(i * 19.1) * 43758.5;
      const u = n - Math.floor(n);
      g.fillStyle = u > 0.5 ? "#141022" : "#08060e";
      g.globalAlpha = 0.35;
      g.fillRect((u * w) | 0, ((u * 17 + i) % h) | 0, 1, 2);
    }
    g.globalAlpha = 1;
  });
}

export function makeGlowSprite(color: string) {
  return canvasTex(64, 64, (g, w) => {
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, color);
    grd.addColorStop(0.4, color + "88");
    grd.addColorStop(1, "#00000000");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}
