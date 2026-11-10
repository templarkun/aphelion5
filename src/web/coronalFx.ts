/**
 * Coronal waves effect (designer 2026-11-10; the name to use for it from now on): during an
 * Overload, solar energy round the edge of the Field like an active sun's rim: glowing magnetic
 * arcs (coronal loops) rooted on the edge with plasma streaming along them, a glowing surface band,
 * and soft wisps that billow outwards and dissolve.
 *
 * - One PixiJS layer of soft particles (sprites of one glow texture, updated every frame by the
 *   Field's ticker) with additive blending, so where particles overlap they glow white-hot and
 *   golden. (Not a ParticleContainer: in PixiJS 8.6 it breaks on this page, which runs without
 *   eval(); a plain layer of sprites is batched just as well at this size.)
 * - Motion is slow: each loop rises and sinks over 9-15 s, is pushed about by a 3D Perlin noise
 *   field (billowing, stretching), and dissolves and forms again in place; no gravity, no flicker.
 * - Colours from deep solar orange #ff4500 through amber #ffaa00 to a white-hot core #ffffff.
 * Screen only; nothing here touches the rules.
 */

import { Container, Sprite, Texture } from "pixi.js";

type Particle = Sprite;
import { fbm3, noise3, solar, SOLAR_AMBER, SOLAR_ORANGE } from "./noise.js";

const TEX = 64;
let soft: Texture | undefined;
/** A soft round glow, white (tinted per particle). */
function softTexture(): Texture {
  if (soft) return soft;
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(TEX / 2, TEX / 2, 0, TEX / 2, TEX / 2, TEX / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.75)");
  g.addColorStop(0.55, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, TEX, TEX);
  soft = Texture.from(c);
  return soft;
}

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** A straight side of the Field's edge: origin, direction along it, inward normal, length. */
interface Side {
  ox: number;
  oy: number;
  ax: number;
  ay: number;
  nx: number;
  ny: number;
  len: number;
}

interface Loop {
  side: Side;
  /** Centre along the side and half its footprint, px. */
  c: number;
  half: number;
  height: number;
  cycle: number;
  phase: number;
  flow: number;
  seed: number;
  parts: Particle[];
}

interface Band {
  side: Side;
  x: number;
  seed: number;
  p: Particle;
}

interface Wisp {
  side: Side;
  x: number;
  seed: number;
  life: number;
  p: Particle;
}

const SAMPLES = 34;

export class CoronalWaves {
  readonly view: Container;
  private loops: Loop[] = [];
  private band: Band[] = [];
  private wisps: Wisp[] = [];
  private size = "";
  /** Fades in when an Overload starts and out when it ends. */
  private shown = 0;
  private last = 0;

  constructor() {
    this.view = new Container();
    this.view.blendMode = "add";
    this.view.eventMode = "none";
    this.view.visible = false;
  }

  /** One frame. `on`: an Overload under way and motion allowed; `now` in ms. */
  update(w: number, h: number, now: number, on: boolean): void {
    const dt = this.last ? Math.min(100, now - this.last) : 16;
    this.last = now;
    this.shown = Math.max(0, Math.min(1, this.shown + (on ? dt / 900 : -dt / 700)));
    this.view.visible = this.shown > 0 && w > 0 && h > 0;
    if (!this.view.visible) return;
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (key !== this.size) this.build(w, h, key);
    const fade = this.shown * this.shown * (3 - 2 * this.shown);
    const t = now / 1000;
    const scale = Math.max(0.55, Math.min(1.15, Math.min(w, h) / 640));

    for (const L of this.loops) {
      const ph = ((t / L.cycle + L.phase) % 1 + 1) % 1;
      // Rises, holds, sinks and dissolves, then forms again (smooth, no sudden change).
      const life = Math.pow(0.5 - 0.5 * Math.cos(ph * Math.PI * 2), 1.4);
      const rise = 0.35 + 0.65 * life;
      for (let j = 0; j < SAMPLES; j++) {
        // Plasma streams along the arc from one foot to the other.
        const s = ((((j + 0.5) / SAMPLES + t / L.flow) % 1) + 1) % 1;
        const arch = Math.sin(Math.PI * s);
        const n1 = fbm3(s * 2.2 + L.seed, L.seed * 0.37, t * 0.12);
        const n2 = noise3(s * 3.1 - L.seed, t * 0.09, L.seed * 0.61);
        const along = L.c + (s - 0.5) * 2 * L.half * (1 + 0.18 * n2) + n1 * 10 * scale;
        const depth = L.height * rise * arch * (1 + 0.32 * n1) + 3;
        const x = L.side.ox + L.side.ax * along + L.side.nx * depth;
        const y = L.side.oy + L.side.ay * along + L.side.ny * depth;
        // Hotter (whiter) near the feet and at the crest; a little dimmer between.
        const heat = 0.55 + 0.45 * Math.abs(Math.cos(Math.PI * s * 2)) * 0.6 + 0.25 * arch;
        const a = fade * (0.25 + 0.75 * life);
        const [halo, mid, core] = [L.parts[j * 3]!, L.parts[j * 3 + 1]!, L.parts[j * 3 + 2]!];
        const breathe = 1 + 0.25 * noise3(L.seed + j * 0.4, t * 0.2, 5.3);
        halo.x = mid.x = core.x = x;
        halo.y = mid.y = core.y = y;
        halo.scale = ((34 * scale) / TEX) * breathe * (0.7 + 0.5 * arch);
        mid.scale = ((17 * scale) / TEX) * breathe;
        core.scale = ((9 * scale) / TEX) * (0.8 + 0.4 * heat);
        halo.tint = SOLAR_ORANGE;
        mid.tint = solar(0.3 + 0.35 * heat);
        core.tint = solar(0.65 + 0.35 * heat);
        halo.alpha = 0.05 * a;
        mid.alpha = 0.11 * a;
        core.alpha = 0.2 * a * (0.6 + 0.4 * heat);
      }
    }

    // The glowing surface: a band along the edge, slowly billowing.
    for (const B of this.band) {
      const n = fbm3(B.x * 0.006, B.seed, t * 0.15);
      const depth = 4 + (8 + 10 * n) * scale;
      const along = B.x + 14 * noise3(B.seed, t * 0.07, 2.2) * scale;
      B.p.x = B.side.ox + B.side.ax * along + B.side.nx * depth;
      B.p.y = B.side.oy + B.side.ay * along + B.side.ny * depth;
      B.p.scale = ((40 + 18 * n) * scale) / TEX;
      B.p.tint = solar(0.15 + 0.3 * (0.5 + 0.5 * n));
      B.p.alpha = fade * (0.09 + 0.05 * n);
    }

    // Wisps of stellar wind: born at the edge, they expand outwards, stretch and fade away.
    for (const W of this.wisps) {
      const u = ((t / W.life + W.seed) % 1 + 1) % 1;
      const drift = 70 * scale * (1 - Math.pow(1 - u, 2));
      const sway = 26 * scale * fbm3(W.seed * 3.1, u * 1.4, t * 0.08);
      const along = W.x + sway;
      const depth = 6 + drift;
      W.p.x = W.side.ox + W.side.ax * along + W.side.nx * depth;
      W.p.y = W.side.oy + W.side.ay * along + W.side.ny * depth;
      W.p.scale = ((14 + 46 * u) * scale) / TEX;
      W.p.tint = u < 0.4 ? solar(0.75 - u) : SOLAR_AMBER;
      W.p.alpha = fade * 0.11 * Math.pow(Math.sin(Math.PI * u), 1.5);
    }
  }

  private build(w: number, h: number, key: string): void {
    this.size = key;
    for (const c of this.view.removeChildren()) c.destroy();
    this.loops = [];
    this.band = [];
    this.wisps = [];
    const inset = 6;
    const W = w - 2 * inset;
    const H = h - 2 * inset;
    const sides: Side[] = [
      { ox: inset, oy: inset, ax: 1, ay: 0, nx: 0, ny: 1, len: W },
      { ox: inset + W, oy: inset, ax: 0, ay: 1, nx: -1, ny: 0, len: H },
      { ox: inset + W, oy: inset + H, ax: -1, ay: 0, nx: 0, ny: -1, len: W },
      { ox: inset, oy: inset + H, ax: 0, ay: -1, nx: 1, ny: 0, len: H },
    ];
    const scale = Math.max(0.55, Math.min(1.15, Math.min(w, h) / 640));
    const tex = softTexture();
    const make = () => {
      const p = new Sprite({ texture: tex, anchor: 0.5, alpha: 0 });
      this.view.addChild(p);
      return p;
    };
    let seed = 1;
    for (const side of sides) {
      // Loops: about one per 150 px, their feet kept on this side (none round a corner).
      const n = Math.max(1, Math.round(side.len / 150));
      for (let k = 0; k < n; k++) {
        seed++;
        const slot = side.len / n;
        const half = Math.min(slot * 0.48, (38 + 40 * rnd(seed)) * scale);
        const c = slot * (k + 0.5) + (slot / 2 - half) * (rnd(seed + 50) - 0.5);
        const parts: Particle[] = [];
        for (let j = 0; j < SAMPLES * 3; j++) parts.push(make());
        this.loops.push({ side, c, half, height: (28 + 46 * rnd(seed + 9)) * scale, cycle: 9 + 6 * rnd(seed + 20), phase: rnd(seed + 30), flow: (7 + 6 * rnd(seed + 40)) * (rnd(seed + 60) < 0.5 ? 1 : -1), seed: seed * 1.7, parts });
      }
      // Surface band: one glow per 22 px.
      const nb = Math.max(4, Math.round(side.len / 22));
      for (let k = 0; k < nb; k++) this.band.push({ side, x: (side.len * (k + 0.5)) / nb, seed: (seed += 1) * 0.73, p: make() });
      // Wisps: one per 45 px.
      const nw = Math.max(2, Math.round(side.len / 45));
      for (let k = 0; k < nw; k++) {
        seed++;
        this.wisps.push({ side, x: side.len * ((k + rnd(seed)) / nw), seed: rnd(seed + 7), life: 5 + 4 * rnd(seed + 3), p: make() });
      }
    }
  }

  destroy(): void {
    this.view.destroy();
  }
}
