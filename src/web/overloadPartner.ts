/**
 * The second part of each Overload edge look (designer 2026-11-22, round 30: "all Overload edge selections
 * have two animation components; make Inflow the default and leave it as it is; for every other one change
 * the energy beam animation; make the two components synergise, some with a third; add two new ones").
 *
 * Until round 29 every look's second part was the plasma wave (plasmaFx.ts). Inflow keeps it. Every other
 * look gets a partner drawn here, made to work with its first part (revealFx.ts `drawOverloadRing`), which
 * writes this frame's hot spots (an arch's feet and snap, an ion cloud and a strike, a tear) into `edgeHot`
 * for it to answer:
 *
 * - original: the racing beams set the edge alight behind them (a burning wake shedding embers); where a red
 *   and a violet beam cross, a flash (third part).
 * - loops: a boiling photosphere along the edge under the arches; plumes at the arches' feet; each snap
 *   sends a shock ring inwards (third part).
 * - tempest: the ion clouds get soft bodies that light up when lightning strikes them; ion rain falls from
 *   them into the Field (third part).
 * - torrent: a glowing riverbed under the river; spray flung off at each corner where the river turns.
 * - breath: before each blow the edge breathes in, motes drawn out of the Field into it; the blow gets a
 *   bright shock front ahead of its wall (three parts with the wall).
 * - embers: a molten bed along the bottom, heat plumes rising up the sides; now and then the bed flares and
 *   spits sparks that fall back (third part).
 * - rift: light bends round each tear (an arc of light), and streaks of the Field are pulled in, stretching.
 * - pulsar (new): the nodes' glow, the charge spiralling into each, its flash and the halo of its ring.
 * - swarm (new): the swarm's glowing trails and a soft glow over each flock.
 *
 * Drawn with one pool of soft sprites (additive light, no shapes built each frame: cheap on a tablet),
 * everything worked out from the time alone. Only while an Overload shows and the Field is not resting
 * (the Field's ticker stops after 20 s untouched, idle.ts).
 */

import { Container, Sprite, Texture } from "pixi.js";
import { noise3 } from "./noise.js";
import type { OverloadLook } from "./features.js";

export interface EdgeHot {
  kind: "foot" | "snap" | "cloud" | "strike" | "tear";
  x: number;
  y: number;
  /** The way in from the edge there. */
  nx: number;
  ny: number;
  /** How strong (0..1): grown, flash life, how open; for a snap, how far through it is. */
  k: number;
  /** A size in px (an arch's height, a snap's or tear's half length). */
  s: number;
}
/** This frame's hot spots of the first part (revealFx.ts writes them; cleared at each frame's start). */
export const edgeHot: EdgeHot[] = [];

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const frac = (x: number) => ((x % 1) + 1) % 1;
const INSET = 6;

interface EdgePt {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** Along the edge, clockwise. */
  tx: number;
  ty: number;
}

/** The Field's edge (as revealFx.ts: 6 px in), a point at share t clockwise from the top left. */
function edgeOf(w: number, h: number) {
  const W = w - 2 * INSET;
  const H = h - 2 * INSET;
  const per = 2 * (W + H);
  const at = (t: number): EdgePt => {
    let s = frac(t) * per;
    if (s < W) return { x: INSET + s, y: INSET, nx: 0, ny: 1, tx: 1, ty: 0 };
    s -= W;
    if (s < H) return { x: INSET + W, y: INSET + s, nx: -1, ny: 0, tx: 0, ty: 1 };
    s -= H;
    if (s < W) return { x: INSET + W - s, y: INSET + H, nx: 0, ny: -1, tx: -1, ty: 0 };
    s -= W;
    return { x: INSET, y: INSET + H - s, nx: 1, ny: 0, tx: 0, ty: -1 };
  };
  return { W, H, per, at };
}

/** Pulsar's nodes: where each stands, how charged (0..1) and how far its last ring has gone (-1: none). */
export function pulsarNodes(w: number, h: number, now: number): (EdgePt & { charge: number; fired: number })[] {
  const E = edgeOf(w, h);
  if (E.W <= 0 || E.H <= 0) return [];
  const n = Math.round(Math.min(20, Math.max(8, E.per / 150)));
  const P = 3400;
  return Array.from({ length: n }, (_, i) => {
    // Two charges run round the edge, opposite each other: each node fires twice a lap.
    const ph = frac(now / P - (2 * i) / n);
    const e = E.at((i + 0.5) / n);
    return { ...e, charge: ph < 0.72 ? (ph / 0.72) ** 2 : 0, fired: ph >= 0.72 ? (ph - 0.72) / 0.28 : -1 };
  });
}

const FLOCKS = 5;
export const swarmCount = (per: number) => Math.round(Math.min(200, Math.max(90, per / 14)));

/** The middle of flock f along the edge (a share of the way round) and how spread out it is (0..1). */
function flock(f: number, T: number) {
  const v = (0.016 + 0.022 * rnd(f + 7)) * (f % 2 ? 1 : -1);
  const u = rnd(f + 3) + T * v + 0.012 * Math.sin(T * 0.7 + f);
  return { u, spread: 0.5 + 0.5 * Math.sin(T * 0.85 + f * 1.7) };
}

/** One mote of the swarm at time `now` (ms): where, and how near its flock's heart (hot 0..1). */
export function swarmMote(i: number, now: number, w: number, h: number): { x: number; y: number; hot: number } | undefined {
  const E = edgeOf(w, h);
  if (E.W <= 0 || E.H <= 0) return undefined;
  const T = now / 1000;
  const F = flock(i % FLOCKS, T);
  const off = (rnd(i + 11) - 0.5) * 2;
  const reachU = (0.018 + 0.06 * F.spread) * (180 / Math.max(180, E.per / 12));
  const wig = 0.004 * Math.sin(T * (2 + 2 * rnd(i + 13)) + i);
  const e = E.at(F.u + off * reachU + wig);
  const d = 6 + (6 + 34 * F.spread) * rnd(i + 17) ** 1.5 + 5 * Math.cos(T * (1.6 + 1.4 * rnd(i + 19)) + i * 2) + 6 * noise3(i * 0.3, T * 0.5, 4);
  return { x: e.x + e.nx * Math.max(2, d), y: e.y + e.ny * Math.max(2, d), hot: 1 - Math.abs(off) };
}

const TEX = 64;
let softTex: Texture | undefined;
function soft(): Texture {
  if (softTex) return softTex;
  const c = document.createElement("canvas");
  c.width = c.height = TEX;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(TEX / 2, TEX / 2, 0, TEX / 2, TEX / 2, TEX / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.55)");
  g.addColorStop(0.7, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, TEX, TEX);
  softTex = Texture.from(c);
  return softTex;
}

const MAX = 1100;

export class EdgePartner {
  readonly view: Container;
  private sprites: Sprite[] = [];
  private used = 0;
  private shown = 0;
  private last = 0;
  private fade = 1;

  constructor() {
    this.view = new Container();
    this.view.blendMode = "add";
    this.view.eventMode = "none";
    this.view.visible = false;
  }

  /** A soft dot: radius r, stretched `sx` times along angle `rot`. */
  private dot(x: number, y: number, r: number, tint: number, a: number, sx = 1, rot = 0): void {
    if (a <= 0.01 || r <= 0.2 || this.used >= MAX) return;
    let s = this.sprites[this.used];
    if (!s) {
      s = new Sprite(soft());
      s.anchor.set(0.5);
      this.view.addChild(s);
      this.sprites.push(s);
    }
    this.used++;
    s.visible = true;
    s.position.set(x, y);
    s.rotation = rot;
    s.scale.set(((r * 2) / TEX) * sx, (r * 2) / TEX);
    s.tint = tint;
    s.alpha = Math.min(1, a * this.fade);
  }

  update(w: number, h: number, now: number, on: boolean, look: OverloadLook): void {
    const dt = this.last ? Math.min(100, now - this.last) : 16;
    this.last = now;
    this.shown = Math.max(0, Math.min(1, this.shown + (on ? dt / 900 : -dt / 700)));
    this.used = 0;
    const E = edgeOf(w, h);
    if (this.shown > 0 && E.W > 0 && E.H > 0 && look !== "inflow") {
      this.fade = this.shown * this.shown * (3 - 2 * this.shown);
      this.draw(look, w, h, now, E);
    }
    for (let i = this.used; i < this.sprites.length; i++) this.sprites[i]!.visible = false;
    this.view.visible = this.used > 0;
  }

  private draw(look: OverloadLook, w: number, h: number, now: number, E: ReturnType<typeof edgeOf>): void {
    const T = now / 1000;
    const reach = Math.min(120, Math.min(E.W, E.H) * 0.24);
    const along = (e: EdgePt) => Math.atan2(e.ty, e.tx);
    const inward = (e: { nx: number; ny: number }) => Math.atan2(e.ny, e.nx);
    const hot = (kind: EdgeHot["kind"]) => edgeHot.filter((x) => x.kind === kind);

    if (look === "original") {
      // The beams (as revealFx.ts): red ones clockwise, violet ones the other way.
      const beams = [
        { t: (ms: number) => ms / 10400, dir: 1, col: 0xff5a1f, core: 0xffd9a0 },
        { t: (ms: number) => ms / 10400 + 0.5, dir: 1, col: 0xff5a1f, core: 0xffd9a0 },
        { t: (ms: number) => -ms / 14800 + 0.25, dir: -1, col: 0x9a6cff, core: 0xe8ddff },
        { t: (ms: number) => -ms / 14800 + 0.75, dir: -1, col: 0x9a6cff, core: 0xe8ddff },
      ];
      beams.forEach((b, k) => {
        const head = b.t(now);
        // The burning wake: the edge stays alight behind the head, flickering, dying down.
        for (let j = 0; j < 44; j++) {
          const age = j / 44;
          const u = head - b.dir * age * 0.17;
          const e = E.at(u);
          const fl = noise3(u * 40, T * 3, k);
          const d = 3 + (6 + 20 * age) * (0.6 + 0.4 * fl);
          this.dot(e.x + e.nx * d, e.y + e.ny * d, 6 + 10 * age, age < 0.15 ? b.core : b.col, 0.34 * (1 - age) ** 1.4, 1.8, along(e));
        }
        // Embers shed by the head as it passed, drifting in.
        for (let j = 0; j < 12; j++) {
          const P = 900 + 500 * rnd(k * 20 + j);
          const c = now / P + rnd(k * 20 + j + 5);
          const q = c - Math.floor(c);
          const e = E.at(b.t(now - q * P));
          const d = 4 + reach * 0.75 * q * (0.5 + 0.5 * rnd(k * 20 + j + Math.floor(c)));
          const side = (rnd(j + k + Math.floor(c) * 3) - 0.5) * 24 * q;
          this.dot(e.x + e.nx * d + e.tx * side, e.y + e.ny * d + e.ty * side, 2.6 * (1 - q) + 0.8, j % 3 ? b.col : b.core, 0.85 * (1 - q), 2, inward(e));
        }
      });
      // Where a red and a violet beam cross: a flash and a spray of sparks.
      for (const r of [0, 1])
        for (const v of [2, 3]) {
          const tr = beams[r]!.t(now);
          const tv = beams[v]!.t(now);
          const diff = frac(tr - tv + 0.5) - 0.5;
          const px = Math.abs(diff) * E.per;
          if (px > 80) continue;
          const kq = 1 - px / 80;
          const e = E.at(tr - diff / 2);
          this.dot(e.x + e.nx * 6, e.y + e.ny * 6, 46 * kq, 0xffc0e0, 0.4 * kq * kq);
          this.dot(e.x + e.nx * 4, e.y + e.ny * 4, 14 * kq, 0xffffff, 0.8 * kq * kq);
          const flick = Math.floor(now / 50);
          for (let j = 0; j < 16; j++) {
            const ang = inward(e) + (rnd(j + flick * 7) - 0.5) * 2.6;
            const d = 6 + 50 * kq * rnd(j + flick * 3 + 1);
            this.dot(e.x + Math.cos(ang) * d, e.y + Math.sin(ang) * d, 2, j % 2 ? 0xffffff : 0xffa0d0, 0.9 * kq, 2.2, ang);
          }
        }
    } else if (look === "loops") {
      // A boiling photosphere under the arches.
      const N = Math.round(Math.min(160, Math.max(60, E.per / 22)));
      for (let i = 0; i < N; i++) {
        const u = i / N + T / 200;
        const e = E.at(u);
        const b = 0.5 + 0.5 * noise3(u * 30, T * 0.5, 3);
        this.dot(e.x + e.nx * (4 + 5 * b), e.y + e.ny * (4 + 5 * b), 9 + 9 * b, b > 0.7 ? 0xffd27a : b > 0.45 ? 0xff7a2a : 0xff3b1a, 0.1 + 0.24 * b, 1.6, along(e));
      }
      // Plumes rising where each arch stands.
      for (const f of hot("foot")) {
        for (let j = 0; j < 5; j++) {
          const q = frac(T * 1.3 + j / 5 + f.x * 0.01);
          const d = 3 + f.s * 0.45 * q;
          this.dot(f.x + f.nx * d, f.y + f.ny * d, 9 * (1 - q * 0.5), 0xff6a2a, 0.3 * f.k * (1 - q), 1.4, inward(f));
        }
        this.dot(f.x, f.y, 16, 0xffb060, 0.35 * f.k);
      }
      // Each snap sends a shock ring inwards.
      for (const s of hot("snap")) {
        const q = s.k;
        const rad = 12 + reach * 1.15 * (1 - (1 - q) ** 2);
        const tx = -s.ny;
        const ty = s.nx;
        for (let j = 0; j < 30; j++) {
          const ang = (j / 29) * Math.PI;
          const x = s.x + tx * Math.cos(ang) * rad * 1.2 + s.nx * Math.sin(ang) * rad;
          const y = s.y + ty * Math.cos(ang) * rad * 1.2 + s.ny * Math.sin(ang) * rad;
          this.dot(x, y, 5 * (1 - q) + 2, j % 3 ? 0xff8a3a : 0xfff0d0, 0.7 * (1 - q), 2.4, Math.atan2(y - s.y, x - s.x) + Math.PI / 2);
        }
        this.dot(s.x, s.y, s.s * 0.7 * (1 - q) + 6, 0xffc070, 0.35 * (1 - q));
      }
    } else if (look === "tempest") {
      const clouds = hot("cloud");
      const strikes = hot("strike");
      clouds.forEach((c, ci) => {
        // A soft body, lit up while lightning touches it.
        const lit = Math.max(0, ...strikes.filter((s) => Math.hypot(s.x - c.x, s.y - c.y) < 4).map((s) => s.k));
        for (let j = 0; j < 6; j++) {
          const ox = noise3(ci * 3 + j, T * 0.3, 1) * 22;
          const oy = noise3(ci * 3 + j, T * 0.3, 2) * 14;
          this.dot(c.x + ox + c.nx * 8, c.y + oy + c.ny * 8, 22 + 16 * rnd(ci * 9 + j), j % 2 ? 0x5a3cff : 0x9a6cff, 0.06 + 0.06 * c.k + 0.3 * lit);
        }
        if (lit > 0) this.dot(c.x, c.y, 16 * lit + 6, 0xffffff, 0.6 * lit);
        // Ion rain falling in from it.
        for (let j = 0; j < 9; j++) {
          const q = frac(T / (1.3 + 0.7 * rnd(ci * 20 + j)) + rnd(ci * 20 + j + 3));
          const side = (rnd(ci * 20 + j + 6) - 0.5) * 44;
          const tx = -c.ny;
          const ty = c.nx;
          const d = 12 + reach * 1.1 * q;
          this.dot(c.x + c.nx * d + tx * side, c.y + c.ny * d + ty * side, 2, q > 0.7 ? 0xffffff : 0xc8b0ff, 0.75 * Math.sin(Math.PI * q) * (0.5 + 0.5 * c.k + lit), 3, inward(c));
        }
      });
      for (const s of strikes) this.dot(s.x, s.y, 48 * s.k, 0xb090ff, 0.3 * s.k);
    } else if (look === "torrent") {
      // A glowing riverbed flowing with the river.
      const N = Math.round(Math.min(110, Math.max(50, E.per / 30)));
      for (let i = 0; i < N; i++) {
        const u = i / N + (T / 26) * 0.9;
        const e = E.at(u);
        const b = 0.5 + 0.5 * noise3(u * 12, T * 0.6, 9);
        this.dot(e.x + e.nx * (14 + 4 * b), e.y + e.ny * (14 + 4 * b), 20, b > 0.7 ? 0xff8a3a : 0xff4a1a, 0.07 + 0.09 * b, 2.4, along(e));
      }
      // Spray flung off at each corner, where the river turns.
      const cornersAt = [0, E.W / E.per, (E.W + E.H) / E.per, (2 * E.W + E.H) / E.per];
      cornersAt.forEach((cu, k) => {
        const inc = E.at(cu - 0.002);
        const out = E.at(cu + 0.002);
        const dx = (inc.nx + out.nx) / Math.SQRT2;
        const dy = (inc.ny + out.ny) / Math.SQRT2;
        const cx = INSET + (k === 1 || k === 2 ? E.W : 0);
        const cy = INSET + (k >= 2 ? E.H : 0);
        const vx = inc.tx * 0.7 + dx * 0.8;
        const vy = inc.ty * 0.7 + dy * 0.8;
        for (let j = 0; j < 22; j++) {
          const q = frac(T / (0.8 + 0.5 * rnd(k * 40 + j)) + rnd(k * 40 + j + 1));
          const spread = (rnd(k * 40 + j + 2) - 0.5) * 34 * q;
          const d = reach * 0.9 * q * (0.6 + 0.4 * rnd(k * 40 + j + 3));
          this.dot(cx + dx * 10 + vx * d - vy * spread, cy + dy * 10 + vy * d + vx * spread, 2.4 * (1 - q) + 0.8, j % 3 ? 0xffa050 : 0xfff0d0, 0.85 * (1 - q), 2.4, Math.atan2(vy, vx));
        }
        this.dot(cx + dx * 12, cy + dy * 12, 26, 0xff7a2a, 0.18);
      });
    } else if (look === "breath") {
      const t = (now % 3600) / 3600;
      if (t < 0.35) {
        // Breathing in: motes drawn out of the Field into the edge.
        const q = t / 0.35;
        for (let i = 0; i < 110; i++) {
          const e = E.at(rnd(i + 30));
          const d0 = reach * (1.2 + 1.4 * rnd(i + 31));
          const qq = Math.min(1, q * (1 + 0.5 * rnd(i + 32)));
          const d = 4 + d0 * (1 - qq ** 1.6);
          this.dot(e.x + e.nx * d, e.y + e.ny * d, 1.8, rnd(i + 33) > 0.7 ? 0xfff0d0 : 0xffa060, 0.8 * Math.sin(Math.PI * Math.min(1, qq * 1.1)), 1.5 + 2.5 * qq, inward(e));
        }
      } else if (t < 0.7) {
        // The blow: a bright shock front running ahead of the wall.
        const q = (t - 0.35) / 0.35;
        const N = Math.round(Math.min(180, Math.max(80, E.per / 18)));
        for (let i = 0; i < N; i++) {
          const u = i / N;
          const e = E.at(u);
          const wave = Math.sin(u * Math.PI * 2 * 6 + T * 2) * 0.15;
          const d = 4 + reach * (1.05 + wave) * (1 - (1 - q) ** 3) + reach * 0.25 * q;
          this.dot(e.x + e.nx * d, e.y + e.ny * d, 5, 0xffe0b0, 0.42 * (1 - q), 3, along(e));
          if (i % 2 === 0) this.dot(e.x + e.nx * (d - 10), e.y + e.ny * (d - 10), 13, 0xff5a1f, 0.12 * (1 - q), 2, along(e));
        }
      }
    } else if (look === "embers") {
      // The molten bed along the bottom.
      const N = Math.round(Math.min(90, Math.max(30, E.W / 14)));
      for (let i = 0; i < N; i++) {
        const b = 0.5 + 0.5 * noise3(i * 0.4, T * 0.8, 5);
        this.dot(INSET + ((i + 0.5) / N) * E.W, INSET + E.H - 3, 10 + 10 * b, b > 0.7 ? 0xffb060 : 0xff4a1a, 0.1 + 0.25 * b, 1.8);
      }
      // Heat plumes rising up the sides.
      for (let i = 0; i < 26; i++) {
        const q = frac(T / (3.5 + 2 * rnd(i + 70)) + rnd(i + 71));
        const left = i % 2 === 0;
        const band = Math.min(70, E.W * 0.16) * rnd(i + 72) ** 1.4;
        const x = left ? INSET + band : INSET + E.W - band;
        this.dot(x + noise3(i, T * 0.4, 6) * 10, INSET + E.H - q * E.H, 14 + 10 * q, 0xff6a2a, 0.09 * Math.sin(Math.PI * q), 2.2, Math.PI / 2);
      }
      // Now and then the bed flares and spits sparks that arc up and fall back.
      const P = 2600;
      const cyc = now / P;
      const n = Math.floor(cyc);
      const q = cyc - n;
      if (q < 0.55) {
        const f = q / 0.55;
        const x0 = INSET + E.W * (0.1 + 0.8 * rnd(n * 3 + 1));
        const y0 = INSET + E.H - 4;
        this.dot(x0, y0, 44 * (1 - f) + 8, 0xffb060, 0.5 * (1 - f));
        this.dot(x0, y0, 14 * (1 - f) + 3, 0xffffff, 0.7 * (1 - f));
        const tt = f * 1.4;
        for (let j = 0; j < 26; j++) {
          const ang = -Math.PI / 2 + (rnd(n * 40 + j) - 0.5) * 1.6;
          const v = 110 + 170 * rnd(n * 40 + j + 1);
          const x = x0 + Math.cos(ang) * v * tt;
          const y = y0 + Math.sin(ang) * v * tt + 0.5 * 280 * tt * tt;
          const vy = Math.sin(ang) * v + 280 * tt;
          this.dot(x, y, 2.2, j % 3 ? 0xffa050 : 0xfff0d0, 0.95 * (1 - f), 2.2, Math.atan2(vy, Math.cos(ang) * v));
        }
      }
    } else if (look === "rift") {
      hot("tear").forEach((c, ci) => {
        const tx = -c.ny;
        const ty = c.nx;
        // Light bent round the tear: an arc of light that shimmers.
        for (let j = 0; j < 36; j++) {
          const ang = (j / 35) * Math.PI;
          const x = c.x + tx * Math.cos(ang) * c.s * 0.95 + c.nx * Math.sin(ang) * c.s * 0.5;
          const y = c.y + ty * Math.cos(ang) * c.s * 0.95 + c.ny * Math.sin(ang) * c.s * 0.5;
          const sh = 0.5 + 0.5 * Math.sin(ang * 3 - T * 4 + ci);
          this.dot(x, y, 4 + 3 * sh, sh > 0.8 ? 0xf0e6ff : 0x9a5cff, 0.28 * c.k * (0.4 + 0.6 * sh), 2.2, Math.atan2(y - c.y, x - c.x) + Math.PI / 2);
        }
        this.dot(c.x + c.nx * 6, c.y + c.ny * 6, c.s * 0.6, 0x6a2cff, 0.16 * c.k);
        // Streaks of the Field pulled in, stretching as they near it.
        for (let j = 0; j < 14; j++) {
          const q = frac(T * (0.55 + 0.4 * rnd(ci * 30 + j)) + rnd(ci * 30 + j + 1));
          const s0 = (rnd(ci * 30 + j + 2) - 0.5) * c.s * 2.2;
          const sx = c.x + c.nx * reach * 1.6 + tx * s0;
          const sy = c.y + c.ny * reach * 1.6 + ty * s0;
          const ex = c.x + tx * s0 * 0.25;
          const ey = c.y + ty * s0 * 0.25;
          const p = q ** 2.2;
          this.dot(sx + (ex - sx) * p, sy + (ey - sy) * p, 1.8, q > 0.8 ? 0xffffff : 0xb07cff, 0.75 * c.k * Math.sin(Math.PI * q), 1.5 + 5 * p, Math.atan2(ey - sy, ex - sx));
        }
      });
    } else if (look === "pulsar") {
      for (const [i, nd] of pulsarNodes(w, h, now).entries()) {
        this.dot(nd.x + nd.nx * 3, nd.y + nd.ny * 3, 8 + 18 * nd.charge, 0xff7a2a, 0.14 + 0.4 * nd.charge);
        // The charge spiralling into the node.
        if (nd.charge > 0.05)
          for (let j = 0; j < 9; j++) {
            const q = frac(nd.charge * 3 + j / 9);
            const rad = 38 * (1 - q) + 3;
            const ang = j * 0.7 + q * 5 + i;
            this.dot(nd.x + Math.cos(ang) * rad + nd.nx * rad * 0.4, nd.y + Math.sin(ang) * rad + nd.ny * rad * 0.4, 1.8, q > 0.8 ? 0xffffff : 0xffb070, 0.8 * q * nd.charge);
          }
        if (nd.fired >= 0) {
          const q = nd.fired;
          if (q < 0.3) this.dot(nd.x, nd.y, 34 * (1 - q / 0.3) + 8, 0xfff0d0, 0.55 * (1 - q / 0.3));
          // A soft halo riding the ring.
          const rad = 8 + reach * 1.25 * (1 - (1 - q) ** 2);
          const tx = -nd.ny;
          const ty = nd.nx;
          for (let j = 0; j < 14; j++) {
            const ang = (j / 13) * Math.PI;
            this.dot(nd.x + tx * Math.cos(ang) * rad + nd.nx * Math.sin(ang) * rad, nd.y + ty * Math.cos(ang) * rad + nd.ny * Math.sin(ang) * rad, 11, 0xff6a2a, 0.13 * (1 - q));
          }
        }
      }
    } else if (look === "swarm") {
      const n = swarmCount(E.per);
      for (let i = 0; i < n; i++) {
        // Its trail: where it was a moment ago, drawn as streaks joining the places.
        let prev = swarmMote(i, now, w, h);
        if (!prev) continue;
        for (let k = 1; k <= 3; k++) {
          const p = swarmMote(i, now - 70 * k, w, h);
          if (!p) break;
          const dx = prev.x - p.x;
          const dy = prev.y - p.y;
          const L = Math.hypot(dx, dy);
          const r = 2.6;
          this.dot((prev.x + p.x) / 2, (prev.y + p.y) / 2, r, prev.hot > 0.7 ? 0xffa050 : 0xff5a1f, 0.2 * (1 - k / 4) * (0.5 + 0.5 * prev.hot), Math.max(1, L / (2 * r) + 0.6), Math.atan2(dy, dx));
          prev = p;
        }
      }
      for (let f = 0; f < FLOCKS; f++) {
        const F = flock(f, T);
        const e = E.at(F.u);
        this.dot(e.x + e.nx * 18, e.y + e.ny * 18, 30 + 24 * F.spread, 0xff6a2a, 0.08 + 0.06 * (1 - F.spread));
      }
    }
  }
}
