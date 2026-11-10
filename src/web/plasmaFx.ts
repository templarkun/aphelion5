/**
 * Plasma wave round the Field's edge during an Overload (designer 2026-11-10; it was the End the
 * Overload button's look in round 14, now the two looks have swapped places): a cosmic plasma wave
 * like stellar wind and coronal mass ejections. Billowing wisps of semi-transparent golden-yellow
 * and white energy leave the edge, drift inwards, swell, warp and fade, over a soft glow along the
 * edge that breathes slowly. Smooth, slow motion; no flicker.
 *
 * One PixiJS layer of soft sprites with additive blending, moved every frame by the Field's ticker,
 * pushed about by the shared Perlin noise (noise.ts). Screen only; nothing here touches the rules.
 */

import { Container, Sprite, Texture } from "pixi.js";
import { fbm3, noise3 } from "./noise.js";

const TEX = 64;
let soft: Texture | undefined;
function softTexture(): Texture {
  if (soft) return soft;
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(TEX / 2, TEX / 2, 0, TEX / 2, TEX / 2, TEX / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.35, "rgba(255,255,255,0.45)");
  g.addColorStop(0.7, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, TEX, TEX);
  soft = Texture.from(c);
  return soft;
}

const GOLD = 0xffc446;
const ORANGE = 0xff781e;
const WHITE = 0xfffaeb;

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Side {
  ox: number;
  oy: number;
  ax: number;
  ay: number;
  nx: number;
  ny: number;
  len: number;
}

interface Wisp {
  side: Side;
  x: number;
  seed: number;
  life: number;
  off: number;
  body: Sprite;
  core: Sprite;
}

interface Glow {
  side: Side;
  x: number;
  seed: number;
  p: Sprite;
}

export class PlasmaWave {
  readonly view: Container;
  private wisps: Wisp[] = [];
  private glows: Glow[] = [];
  private size = "";
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
    this.shown = Math.max(0, Math.min(1, this.shown + (on ? dt / 1100 : -dt / 800)));
    this.view.visible = this.shown > 0 && w > 0 && h > 0;
    if (!this.view.visible) return;
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (key !== this.size) this.build(w, h, key);
    const fade = this.shown * this.shown * (3 - 2 * this.shown);
    const t = now / 1000;
    const scale = Math.max(0.55, Math.min(1.15, Math.min(w, h) / 640));

    // The edge glow, breathing slowly.
    const br = 0.5 + 0.5 * Math.sin(t * 0.9);
    for (const G of this.glows) {
      const n = fbm3(G.x * 0.005, G.seed, t * 0.1);
      const depth = (6 + 6 * n) * scale;
      G.p.x = G.side.ox + G.side.ax * G.x + G.side.nx * depth;
      G.p.y = G.side.oy + G.side.ay * G.x + G.side.ny * depth;
      G.p.scale = ((46 + 12 * br + 10 * n) * scale) / TEX;
      G.p.tint = n > 0.15 ? GOLD : ORANGE;
      G.p.alpha = fade * (0.12 + 0.05 * br + 0.04 * n);
    }

    // Wisps of stellar wind: born on the edge, carried inwards, turned by the noise, stretched along their path.
    for (const W of this.wisps) {
      const u = ((t / W.life + W.off) % 1 + 1) % 1;
      const out = (4 + 70 * scale * (1 - (1 - u) * (1 - u))) * (0.75 + 0.5 * W.seed);
      const bend = 0.6 * fbm3(W.x * 0.004 + W.seed * 7, u * 0.9, t * 0.1);
      const along = W.x + bend * 40 * scale * u;
      const x = W.side.ox + W.side.ax * along + W.side.nx * out;
      const y = W.side.oy + W.side.ay * along + W.side.ny * out;
      const grow = (9 + 26 * u) * scale * (1 + 0.2 * noise3(W.seed * 9, t * 0.2, 3.3));
      const alpha = Math.pow(Math.sin(Math.PI * u), 1.6);
      // Stretched along the way it travels (inwards, leaning with the bend).
      const dir = Math.atan2(W.side.ny + W.side.ay * bend * 0.6, W.side.nx + W.side.ax * bend * 0.6);
      for (const sp of [W.body, W.core]) {
        sp.x = x;
        sp.y = y;
        sp.rotation = dir;
      }
      W.body.scale.set(((grow * 2) / TEX) * (1.5 + 1.1 * u), ((grow * 2) / TEX) * 0.85);
      W.body.tint = u < 0.5 ? GOLD : ORANGE;
      W.body.alpha = fade * 0.24 * alpha;
      W.core.scale.set(((grow * 1.1) / TEX) * (1.5 + 1.1 * u), ((grow * 1.1) / TEX) * 0.85);
      W.core.tint = WHITE;
      W.core.alpha = fade * 0.3 * alpha * (1 - u);
    }
  }

  private build(w: number, h: number, key: string): void {
    this.size = key;
    for (const c of this.view.removeChildren()) c.destroy();
    this.wisps = [];
    this.glows = [];
    const inset = 4;
    const W = w - 2 * inset;
    const H = h - 2 * inset;
    const sides: Side[] = [
      { ox: inset, oy: inset, ax: 1, ay: 0, nx: 0, ny: 1, len: W },
      { ox: inset + W, oy: inset, ax: 0, ay: 1, nx: -1, ny: 0, len: H },
      { ox: inset + W, oy: inset + H, ax: -1, ay: 0, nx: 0, ny: -1, len: W },
      { ox: inset, oy: inset + H, ax: 0, ay: -1, nx: 1, ny: 0, len: H },
    ];
    const tex = softTexture();
    const make = () => {
      const p = new Sprite({ texture: tex, anchor: 0.5, alpha: 0 });
      this.view.addChild(p);
      return p;
    };
    let seed = 1;
    for (const side of sides) {
      const ng = Math.max(4, Math.round(side.len / 26));
      for (let k = 0; k < ng; k++) this.glows.push({ side, x: (side.len * (k + 0.5)) / ng, seed: (seed += 1) * 0.73, p: make() });
      // Wisps: about one per 48 px of edge.
      const nw = Math.max(3, Math.round(side.len / 48));
      for (let k = 0; k < nw; k++) {
        seed++;
        this.wisps.push({ side, x: side.len * ((k + rnd(seed)) / nw), seed: rnd(seed + 7), life: 4.5 + 2.8 * rnd(seed + 3), off: rnd(seed + 11), body: make(), core: make() });
      }
    }
  }

  destroy(): void {
    this.view.destroy();
  }
}
