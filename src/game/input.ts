/** Unified keyboard / pointer / gamepad → steer, boost, brake. */

export type InputState = {
  steer: number;
  boost: boolean;
  brake: boolean;
  pause: boolean;
};

const GAME_KEYS = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "KeyP",
  "Escape",
]);

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function radialDeadzone(x: number, y: number, dz = 0.18) {
  const m = Math.hypot(x, y);
  if (m < dz) return { x: 0, y: 0 };
  const scale = (m - dz) / (1 - dz) / m;
  return { x: x * scale, y: y * scale };
}

class Input {
  keys = new Set<string>();
  pointerId: number | null = null;
  pointerSteer = 0;
  usingPointer = false;
  injectedSteer: number | null = null;
  injectedKeys: string[] | null = null;
  width = 1;
  originX = 0.5;
  enabled = false;

  attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.clear();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onVis = () => {
    if (document.hidden) this.clear();
  };

  clear = () => {
    this.keys.clear();
    this.pointerId = null;
    this.usingPointer = false;
    this.pointerSteer = 0;
  };

  private isUi(t: EventTarget | null) {
    return t instanceof Element && Boolean(t.closest("button, a, input, [data-ui]"));
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (this.isUi(e.target)) return;
    this.pointerId = e.pointerId;
    this.usingPointer = true;
    this.width = window.innerWidth || 1;
    this.originX = e.clientX;
    this.updatePointer(e.clientX);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.usingPointer || e.pointerId !== this.pointerId) return;
    this.updatePointer(e.clientX);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.usingPointer = false;
    this.pointerSteer = 0;
  };

  private updatePointer(clientX: number) {
    // Analog: drag from press origin, plus screen-center bias so holding
    // a side without a big drag still steers.
    const fromOrigin = (clientX - this.originX) / Math.max(96, this.width * 0.22);
    const fromCenter = (clientX / this.width - 0.5) * 2.2;
    const mixed = fromOrigin * 0.65 + fromCenter * 0.35;
    // Screen-right should steer right → negative yaw (see controls skill).
    this.pointerSteer = clamp(-mixed, -1, 1);
  }

  poll(): InputState {
    if (this.injectedSteer != null || this.injectedKeys) {
      const codes = this.injectedKeys ?? [];
      let steer = this.injectedSteer ?? 0;
      if (this.injectedSteer == null) {
        if (codes.includes("KeyA") || codes.includes("ArrowLeft")) steer += 1;
        if (codes.includes("KeyD") || codes.includes("ArrowRight")) steer -= 1;
      }
      return {
        steer: clamp(steer, -1, 1),
        boost: codes.includes("KeyW") || codes.includes("ArrowUp") || codes.includes("Space"),
        brake: codes.includes("KeyS") || codes.includes("ArrowDown"),
        pause: false,
      };
    }

    let steer = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) steer += 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) steer -= 1;

    const pads = typeof navigator !== "undefined" ? navigator.getGamepads?.() : null;
    if (pads) {
      for (const pad of pads) {
        if (!pad) continue;
        const [ax, ay] = pad.axes;
        const stick = radialDeadzone(ax ?? 0, ay ?? 0);
        steer += -stick.x;
        if (pad.buttons[14]?.pressed) steer += 1;
        if (pad.buttons[15]?.pressed) steer -= 1;
      }
    }

    if (this.usingPointer) steer = this.pointerSteer;

    const boostPad = pads
      ? [...pads].some((p) => p && (p.buttons[0]?.pressed || (p.buttons[7]?.value ?? 0) > 0.4))
      : false;

    return {
      steer: clamp(steer, -1, 1),
      boost:
        this.keys.has("KeyW") ||
        this.keys.has("ArrowUp") ||
        this.keys.has("Space") ||
        boostPad,
      brake: this.keys.has("KeyS") || this.keys.has("ArrowDown"),
      pause: this.keys.has("KeyP") || this.keys.has("Escape"),
    };
  }
}

export const input = new Input();
