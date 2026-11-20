/**
 * Alpha Down, the kill (designer 2026-11-20; plan agreed that day), drawn on the Field (PixiJS):
 *
 * 1. Slow-down (0-0.8 s): the Field zooms in on the unit and the rest darkens; the hit's sparks hang
 *    almost still; targeting brackets close in on the tile and lock.
 * 2. Break (0.8-2.2 s): violet light through cracks in the tile, the glyph flares and collapses into
 *    a bright core, then bursts into shards, a violet shock ring and sparks, with a small shake.
 * 3. Confirmed (2.2-3.6 s): the Wreck stays on the Field (4.8), smoking; a label beside it counts up
 *    from "ALPHA DOWN · 5 / 6" to "6 / 6".
 * 4. Back (3.6-4.5 s): the zoom eases back to the whole Field and the game goes on.
 *
 * One Step of the Field's animation player (anim.ts): two taps skip it; reduced motion and Instant
 * show a still close-up with the label (STILL seconds). Everything is worked out from the time alone.
 * Screen only: nothing here is a rule.
 */

import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { NodeLook, Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playKillConfirmed, playOmegaBreak, playTargetLock } from "../briefing/soundHooks.js";
import { KILL, STILL, span } from "./timeline.js";

export interface KillEnv {
  /** A layer on top of the Field, in screen pixels (not zoomed): everything the kill draws goes here. */
  layer: Container;
  /** Zoom the board: scale z, then moved by (x, y) (zoom(1, 0, 0) puts it back). */
  zoom: (z: number, x: number, y: number) => void;
  /** The unit's sector as drawn now (the board can be redrawn while this plays). */
  node: () => { node: Container; cx: number; cy: number } | undefined;
  /** Hex size (centre to corner is 0.9 of it on the Field). */
  size: () => number;
  field: () => { w: number; h: number };
  /** The unit's glyph badge picture. */
  badge: (unitId: string) => Texture | undefined;
  /** A unit that left the Field (no Wreck): its stand-in, in the board, shown until the burst. */
  ghost?: Container | undefined;
  /** Told when the kill starts and ends (the screen shows "Tap twice to skip"). */
  onPlay?: ((on: boolean) => void) | undefined;
}

export interface KillTarget {
  sector: string;
  unitId: string;
  /** It becomes a Wreck (4.8). */
  wreck: boolean;
  /** It is still on the board when these events end (its Wreck); otherwise drawn from its stand-in (env.ghost). */
  onBoard: boolean;
  /** "Alpha". */
  name: string;
  /** The objective's number: the label goes from count − 1 to count. */
  count: number;
}

const VIOLET = 0x9b6bd6;
const LILAC = 0xc9a6ff;
const PALE = 0xf3e8ff;
const HOT = 0xff5a36;

/** A small fixed random sequence (the same every time). */
function seq(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

/** Pointy-top hex corners (as the Field draws its tiles), radius r. */
function hexCorners(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
const flat = (pts: [number, number][]) => pts.flatMap((p) => p);

/** VIG_HOLE of the picture's half-width is clear; dark beyond. */
const VIG_HOLE = 0.1;
let vignetteTex: Texture | undefined;
/** Dark all round, clear in the middle (a soft hole an eighth of the way out). */
function vignette(): Texture {
  if (vignetteTex) return vignetteTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(256, 256, 0, 256, 256, 256);
  r.addColorStop(0, "rgba(3,2,10,0)");
  r.addColorStop(VIG_HOLE, "rgba(3,2,10,0)");
  r.addColorStop(0.16, "rgba(3,2,10,0.72)");
  r.addColorStop(0.24, "rgba(3,2,10,0.88)");
  r.addColorStop(0.4, "rgba(3,2,10,0.94)");
  r.addColorStop(1, "rgba(3,2,10,0.95)");
  g.fillStyle = r;
  g.fillRect(0, 0, 512, 512);
  vignetteTex = Texture.from(c);
  return vignetteTex;
}
let puffTex: Texture | undefined;
/** A soft round puff (smoke). */
function puff(): Texture {
  if (puffTex) return puffTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,0.9)");
  r.addColorStop(0.45, "rgba(255,255,255,0.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  puffTex = Texture.from(c);
  return puffTex;
}
const PUFFS = 12;

/** Cracks from a point a little off the middle to the tile's edge, in tile radii. */
function makeCracks(): { pts: [number, number][]; at: number }[] {
  const rnd = seq(9137);
  const hx = 0.12;
  const hy = -0.08;
  const out: { pts: [number, number][]; at: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.5;
    const pts: [number, number][] = [[hx, hy]];
    let r = 0;
    let ang = a;
    const reach = 0.82 + rnd() * 0.12;
    while (r < reach) {
      r = Math.min(reach, r + 0.16 + rnd() * 0.14);
      ang += (rnd() - 0.5) * 0.7;
      pts.push([hx + Math.cos(ang) * r, hy + Math.sin(ang) * r]);
    }
    out.push({ pts, at: i * 0.04 });
    // A short branch from the middle of the main crack.
    const mid = pts[Math.floor(pts.length / 2)]!;
    const b = ang + (rnd() > 0.5 ? 0.9 : -0.9);
    const len = 0.18 + rnd() * 0.16;
    out.push({ pts: [mid, [mid[0] + Math.cos(b) * len, mid[1] + Math.sin(b) * len]], at: 0.18 + i * 0.04 });
  }
  return out;
}
const CRACKS = makeCracks();

/** Shards: each sixth of the hex cut in two (tile radii; a point inside each, the direction it flies). */
const SHARDS = (() => {
  const rnd = seq(4421);
  const v = hexCorners(0, 0, 1);
  const out: { tri: [number, number][]; dir: number; speed: number; spin: number; shade: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = v[i]!;
    const b = v[(i + 1) % 6]!;
    const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const c: [number, number] = [(rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.15];
    for (const tri of [
      [c, a, m],
      [c, m, b],
    ] as [number, number][][]) {
      const gx = (tri[0]![0] + tri[1]![0] + tri[2]![0]) / 3;
      const gy = (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3;
      out.push({ tri: tri.map(([x, y]) => [x - gx, y - gy] as [number, number]).concat([[gx, gy]]), dir: Math.atan2(gy, gx), speed: 0.75 + rnd() * 0.6, spin: (rnd() - 0.5) * 7, shade: rnd() });
    }
  }
  return out;
})();

const SPARKS = (() => {
  const rnd = seq(771);
  return Array.from({ length: 30 }, () => ({ a: rnd() * Math.PI * 2, far: 1.7 + rnd() * 2.4, len: 0.12 + rnd() * 0.22, hue: rnd() }));
})();
const HANG = (() => {
  const rnd = seq(2603);
  return Array.from({ length: 16 }, () => ({ a: rnd() * Math.PI * 2, r: 1.0 + rnd() * 0.65, len: 0.07 + rnd() * 0.1, far: 2.2 + rnd() * 1.6 }));
})();

/** Make every Text in a tile sharp at the zoom (they are drawn for the Field's normal size). */
function sharpen(c: Container, res: number): void {
  for (const ch of c.children) {
    if (ch instanceof Text) {
      if (ch.resolution < res) ch.resolution = res;
    } else if (ch instanceof Container && ch.children.length) sharpen(ch, res);
  }
}
function wreckLabel(c: Container): Text | undefined {
  for (const ch of c.children) if (ch instanceof Text && ch.text === "WRECK") return ch;
  return undefined;
}

/** The kill as a Field step (and its still picture for reduced motion and Instant). */
export function alphaDownStep(env: KillEnv, k: KillTarget): Step {
  let built: { root: Container; vig: Sprite; smoke: Sprite[]; under: Graphics; light: Graphics; bloom: Sprite; flash: Sprite; glyph: Sprite | undefined; glow: Sprite | undefined; over: Graphics; stamp: Text; title: Text; num: Text } | undefined;
  let playing = false;
  let lastT = -1;
  const dpr = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);

  function build() {
    if (built) return built;
    const root = new Container();
    root.eventMode = "none";
    const vig = new Sprite({ texture: vignette(), anchor: 0.5 });
    const smoke = Array.from({ length: PUFFS }, () => {
      const p = new Sprite({ texture: puff(), anchor: 0.5 });
      p.tint = 0x4a4458;
      p.visible = false;
      return p;
    });
    const under = new Graphics();
    const light = new Graphics();
    light.blendMode = "add";
    // Soft glows: the core and the bloom of the burst (violet), the flash (white).
    const bloom = new Sprite({ texture: puff(), anchor: 0.5 });
    bloom.blendMode = "add";
    bloom.tint = LILAC;
    const flash = new Sprite({ texture: puff(), anchor: 0.5 });
    flash.blendMode = "add";
    const tex = env.badge(k.unitId);
    const glyph = tex ? new Sprite({ texture: tex, anchor: 0.5 }) : undefined;
    const glow = tex ? new Sprite({ texture: tex, anchor: 0.5 }) : undefined;
    if (glow) glow.blendMode = "add";
    const over = new Graphics();
    const title = new Text({ text: `${k.name.toUpperCase()} DOWN ·`, resolution: dpr * 1.5, style: { fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: "800", fill: 0xffffff, letterSpacing: 2 } });
    const num = new Text({ text: `${k.count - 1} / ${k.count}`, resolution: dpr * 1.5, style: { fontFamily: "system-ui, sans-serif", fontSize: 28, fontWeight: "900", fill: PALE, stroke: { color: 0x2a1450, width: 3 } } });
    num.anchor.set(0.5);
    // The Wreck's stamp on the stand-in, when the Wreck leaves the Field later in the same answer.
    const stamp = new Text({ text: "WRECK", resolution: dpr * 2, style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "700", fill: 0x9b1c1c } });
    stamp.anchor.set(0.5);
    stamp.visible = false;
    root.addChild(vig, ...smoke, under, light, bloom, flash);
    if (glyph) root.addChild(glyph);
    if (glow) root.addChild(glow);
    root.addChild(stamp, over, title, num);
    env.layer.addChild(root);
    built = { root, vig, smoke, under, light, bloom, flash, glyph, glow, over, stamp, title, num };
    return built;
  }

  function cleanup() {
    env.zoom(1, 0, 0);
    if (built) {
      built.root.destroy({ children: true });
      built = undefined;
    }
    if (playing) {
      playing = false;
      env.onPlay?.(false);
    }
  }

  /** One frame at time t (s). `still`: the close-up held (reduced motion, Instant), `fade` its fade in and out. */
  function draw(t: number, look: (key: string) => NodeLook, still = false, fade = 1) {
    const b = build();
    const n = env.node();
    const { w, h } = env.field();
    if (!n || w <= 0) return;
    const R = env.size() * 0.9;
    const wide = w >= h * 0.9;
    const Z = Math.max(1.2, Math.min(2.6, (Math.min(w, h) * 0.2) / R));
    const F = wide ? { x: w * 0.4, y: h * 0.5 } : { x: w * 0.5, y: h * 0.38 };
    // The zoom: in during act 1, out during act 4.
    const q = still ? 1 : t < KILL.back[0] ? easeInOut(span(t, KILL.zoomIn)) : 1 - easeInOut(span(t, KILL.back));
    const z = 1 + (Z - 1) * q;
    let Sx = n.cx + (F.x - n.cx) * q;
    let Sy = n.cy + (F.y - n.cy) * q;
    const Rs = R * z;
    // A small shake at the burst.
    const us = still ? 1 : span(t, [KILL.burst, KILL.burst + 0.38]);
    const amp = us > 0 && us < 1 ? Rs * 0.07 * (1 - us) ** 2 : 0;
    const shx = amp * Math.sin(us * 55);
    const shy = amp * Math.cos(us * 47);
    env.zoom(z, Sx + shx - n.cx * z, Sy + shy - n.cy * z);
    Sx += shx;
    Sy += shy;
    sharpen(n.node, Math.ceil(dpr * z));

    // The darkness round it.
    const corner = Math.max(Math.hypot(Sx, Sy), Math.hypot(w - Sx, Sy), Math.hypot(Sx, h - Sy), Math.hypot(w - Sx, h - Sy));
    const half = Math.max((1.25 * Rs) / VIG_HOLE, corner + 24);
    b.vig.position.set(Sx, Sy);
    b.vig.width = b.vig.height = half * 2;
    b.vig.alpha = 0.85 * q * fade;

    const L = look(k.sector);
    const under = b.under.clear();
    const light = b.light.clear();
    const over = b.over.clear();
    const burst = still ? 1 : span(t, [KILL.burst, KILL.burst + 0.9]);
    const broke = still || t >= KILL.burst;

    // The tile: whole (the Wreck's stamp hidden) until it collapses and bursts; then the Wreck settles in.
    // It is the real tile when its Wreck stays on the board; else its stand-in (and what is beneath shows after
    // the burst, or, for a Wreck that leaves later in the same answer, the stand-in stays as the Wreck).
    const cs = still ? 1 : t < KILL.burst ? 1 - 0.85 * span(t, KILL.collapse) ** 2 : 1;
    const label = wreckLabel(n.node);
    if (label) label.visible = broke;
    const g0 = env.ghost && !env.ghost.destroyed ? env.ghost : undefined;
    const wreckGhost = !k.onBoard && k.wreck;
    const wi = still ? 1 : span(t, KILL.wreckIn);
    if (!broke) {
      L.scale = cs;
      L.alpha = k.onBoard ? 1 - 0.4 * span(t, KILL.collapse) : 0;
      if (g0) {
        g0.visible = true;
        g0.position.set(n.cx, n.cy);
        g0.scale.set(cs);
        g0.alpha = 1 - 0.4 * span(t, KILL.collapse);
      }
    } else if (wreckGhost) {
      L.alpha = 0;
      if (g0) {
        g0.visible = true;
        g0.position.set(n.cx, n.cy);
        g0.scale.set(1.12 - 0.12 * easeOut(wi));
        g0.alpha = 0.75 * wi;
      }
    } else {
      L.alpha = wi;
      L.scale = 1.12 - 0.12 * easeOut(wi);
      if (g0) g0.visible = false;
    }
    b.stamp.visible = wreckGhost && broke && wi > 0;
    if (b.stamp.visible) {
      // As the Field's own Wreck stamp (FieldView: 0.16 of the hex size), at the zoom.
      const fs = Math.round(Math.max(9, (R / 0.9) * 0.16 * Z));
      if (b.stamp.style.fontSize !== fs) b.stamp.style.fontSize = fs;
      b.stamp.position.set(Sx, Sy + Rs * 0.02);
      b.stamp.scale.set(z / Z);
      b.stamp.alpha = wi * fade;
    }

    // Act 1: the hit's sparks hang almost still round the tile; at the burst they fly out.
    if (!still) {
      const show = span(t, [0, 0.25]);
      for (const s of HANG) {
        const out = broke ? easeOut(burst) : 0;
        const r = Rs * (s.r + 0.05 * Math.min(t, KILL.burst) + (s.far - s.r) * out);
        const a0 = show * (broke ? 1 - burst : 1);
        if (a0 <= 0.01) continue;
        const x = Sx + Math.cos(s.a) * r;
        const y = Sy + Math.sin(s.a) * r;
        const len = Rs * s.len * (broke ? 1 + 2 * (1 - burst) : 1);
        const x2 = x + Math.cos(s.a) * len;
        const y2 = y + Math.sin(s.a) * len;
        light.moveTo(x, y).lineTo(x2, y2).stroke({ width: 6, color: 0xff9a4a, alpha: 0.35 * a0 });
        light.moveTo(x, y).lineTo(x2, y2).stroke({ width: 2, color: 0xfff1c4, alpha: 0.95 * a0 });
      }
    }

    // Brackets close in and lock.
    if (!still && t < KILL.burst + 0.3) {
      const bi = easeOut(span(t, KILL.bracketsIn));
      const out = broke ? span(t, [KILL.burst, KILL.burst + 0.3]) : 0;
      const rb = Rs * (2.0 - 0.88 * bi + 1.2 * out);
      const al = span(t, [KILL.bracketsIn[0], KILL.bracketsIn[0] + 0.15]) * (1 - out);
      const flash = t >= KILL.lock ? Math.max(0, 1 - (t - KILL.lock) / 0.25) : 0;
      const arm = Rs * 0.32;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        const x = Sx + sx * rb * 0.82;
        const y = Sy + sy * rb * 0.82;
        over.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm).stroke({ width: 3, color: flash > 0 ? 0xffffff : HOT, alpha: al });
        light.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm).stroke({ width: 9, color: HOT, alpha: 0.25 * al + 0.4 * flash });
      }
      if (flash > 0) light.circle(Sx, Sy, Rs * (1.2 + 0.3 * (1 - flash))).stroke({ width: 2 + 3 * flash, color: 0xffb08a, alpha: 0.8 * flash });
    }

    // Act 2: light through cracks.
    if (!still && !broke) {
      const glowIn = span(t, [0.9, 1.45]);
      if (glowIn > 0) light.poly(flat(hexCorners(Sx, Sy, Rs * cs))).fill({ color: VIOLET, alpha: 0.32 * glowIn });
      const grow = span(t, KILL.cracks);
      for (const c of CRACKS) {
        const f = Math.max(0, Math.min(1, (grow - c.at) / (1 - c.at)));
        if (f <= 0) continue;
        const pts = c.pts.map(([x, y]) => [Sx + x * Rs * cs, Sy + y * Rs * cs] as [number, number]);
        const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
        let left = easeOut(f) * lens.reduce((a, x) => a + x, 0);
        const path: [number, number][] = [pts[0]!];
        for (let i = 0; i < lens.length && left > 0; i++) {
          const take = Math.min(1, left / lens[i]!);
          const a = pts[i]!;
          const z2 = pts[i + 1]!;
          path.push([a[0] + (z2[0] - a[0]) * take, a[1] + (z2[1] - a[1]) * take]);
          left -= lens[i]!;
        }
        const line = (width: number, color: number, alpha: number) => {
          light.moveTo(path[0]![0], path[0]![1]);
          for (const p of path.slice(1)) light.lineTo(p[0], p[1]);
          light.stroke({ width, color, alpha });
        };
        line(Math.max(4, Rs * 0.09), LILAC, 0.3);
        line(Math.max(1.3, Rs * 0.025), PALE, 0.95);
      }
      // The core it collapses into.
      const core = span(t, [KILL.flare[0] + 0.1, KILL.burst]);
      if (core > 0) light.circle(Sx, Sy, Rs * (0.03 + 0.16 * core * core)).fill({ color: 0xffffff, alpha: 0.6 + 0.4 * core });
    }
    // Soft light: the core's glow growing as the tile collapses, the burst's bloom and flash.
    {
      const core = !still && !broke ? span(t, [KILL.flare[0] + 0.1, KILL.burst]) : 0;
      const fb = !still && broke ? span(t, [KILL.burst, KILL.burst + 0.55]) : 1;
      const fl = !still && broke ? span(t, [KILL.burst, KILL.burst + 0.25]) : 1;
      b.bloom.visible = core > 0 || fb < 1;
      b.bloom.position.set(Sx, Sy);
      b.bloom.width = b.bloom.height = Rs * (core > 0 ? 0.8 + 1.4 * core : 2.2 + 2.6 * easeOut(fb));
      b.bloom.alpha = core > 0 ? 0.9 * core : 0.95 * (1 - fb);
      b.flash.visible = fl < 1;
      b.flash.position.set(Sx, Sy);
      b.flash.width = b.flash.height = Rs * (0.9 + 2.4 * easeOut(fl));
      b.flash.alpha = (1 - fl) ** 1.5;
    }

    // The glyph flares out of the tile, then collapses with it.
    if (b.glyph && b.glow) {
      const on = !still && !broke ? span(t, [KILL.flare[0], KILL.flare[0] + 0.12]) : 0;
      const grow = easeOut(span(t, KILL.flare));
      const shrink = span(t, KILL.collapse);
      const sc = (0.55 + 0.6 * grow) * (1 - 0.95 * shrink * shrink);
      const H = Rs * 1.15 * sc;
      for (const sp of [b.glyph, b.glow]) {
        sp.visible = on > 0;
        sp.position.set(Sx, Sy);
        sp.height = H;
        sp.width = H * (sp.texture.width / Math.max(1, sp.texture.height));
      }
      b.glyph.alpha = on;
      b.glow.alpha = on * (0.35 + 0.65 * shrink);
    }

    // The burst: flash, shards, two shock rings, sparks.
    if (!still && broke && burst < 1) {
      const r1 = span(t, [KILL.burst, KILL.burst + 0.7]);
      if (r1 < 1) light.circle(Sx, Sy, Rs * (0.5 + 3.4 * easeOut(r1))).stroke({ width: Math.max(1, Rs * 0.14 * (1 - r1)), color: LILAC, alpha: 0.9 * (1 - r1) });
      const r2 = span(t, [KILL.burst + 0.08, KILL.burst + 0.68]);
      if (r2 > 0 && r2 < 1) light.circle(Sx, Sy, Rs * (0.4 + 2.7 * easeOut(r2))).stroke({ width: Math.max(1, Rs * 0.05 * (1 - r2)), color: 0xffffff, alpha: 0.8 * (1 - r2) });
      const sh = span(t, [KILL.burst, KILL.burst + 0.85]);
      for (const s of SHARDS) {
        const d = Rs * (0.15 + 2.6 * s.speed * easeOut(sh));
        const ang = s.spin * sh;
        const cx = Sx + s.tri[3]![0] * Rs + Math.cos(s.dir) * d;
        const cy = Sy + s.tri[3]![1] * Rs + Math.sin(s.dir) * d + Rs * 0.6 * sh * sh;
        const k2 = Rs * 0.42;
        const pts = s.tri.slice(0, 3).map(([x, y]) => [cx + (x * Math.cos(ang) - y * Math.sin(ang)) * k2, cy + (x * Math.sin(ang) + y * Math.cos(ang)) * k2] as [number, number]);
        const a = 1 - sh ** 1.5;
        under.poly(flat(pts)).fill({ color: s.shade > 0.5 ? 0x7d52c4 : 0x5a3596, alpha: a }).stroke({ width: 1.2, color: LILAC, alpha: 0.85 * a });
      }
      const sp = span(t, [KILL.burst, KILL.burst + 0.75]);
      for (const s of SPARKS) {
        const r0 = Rs * (0.25 + (s.far - 0.25) * easeOut(sp));
        const len = Rs * s.len * (1 - sp);
        const col = s.hue < 0.4 ? 0xffffff : s.hue < 0.75 ? LILAC : 0xffc27a;
        light.moveTo(Sx + Math.cos(s.a) * r0, Sy + Math.sin(s.a) * r0).lineTo(Sx + Math.cos(s.a) * (r0 + len), Sy + Math.sin(s.a) * (r0 + len)).stroke({ width: 2.2, color: col, alpha: 1 - sp });
      }
    }

    // Act 3: smoke and embers rise from the Wreck.
    b.smoke.forEach((sp, j) => {
      const born = KILL.burst + 0.25 + j * 0.2;
      const age = still ? 0.3 + (j % 4) * 0.35 : t - born;
      if (!broke || age < 0 || age > 1.7 || (still && j > 3)) return void (sp.visible = false);
      const u = age / 1.7;
      const x = Sx + Rs * (Math.sin(j * 1.7 + age * 1.3) * 0.25 + ((j % 3) - 1) * 0.12);
      const y = Sy - Rs * (0.1 + 1.4 * u);
      sp.visible = true;
      sp.position.set(x, y);
      sp.width = sp.height = Rs * (0.45 + 0.9 * u);
      sp.alpha = 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.4 + 0.08)) * fade * (still ? 1 : 1 - span(t, [KILL.back[0] + 0.3, KILL.back[1]]));
      if (j % 2 === 0) light.circle(x + Rs * 0.1, y + Rs * 0.05, Math.max(1.2, Rs * 0.022)).fill({ color: j % 4 === 0 ? 0xffa45c : LILAC, alpha: 0.9 * (1 - u) * sp.alpha });
    });

    // The label beside it: "ALPHA DOWN · 5 / 6", then "6 / 6".
    const la = still ? fade : span(t, KILL.label) * (1 - span(t, [KILL.back[0], KILL.back[0] + 0.35]));
    const flipped = still || t >= KILL.count;
    const want = `${flipped ? k.count : k.count - 1} / ${k.count}`;
    if (b.num.text !== want) b.num.text = want;
    b.title.visible = b.num.visible = la > 0.01;
    if (la > 0.01) {
      // Sized for the full zoom (the label goes before the zoom eases back).
      const fs1 = Math.round(Math.max(13, Math.min(22, R * Z * 0.2)));
      const fs2 = Math.round(Math.max(20, Math.min(38, R * Z * 0.38)));
      b.num.scale.set(1);
      if (b.title.style.fontSize !== fs1) b.title.style.fontSize = fs1;
      if (b.num.style.fontSize !== fs2) b.num.style.fontSize = fs2;
      const pad = fs1 * 0.8;
      const pw = pad * 2 + b.title.width + fs1 * 0.6 + b.num.width;
      const ph = Math.max(fs2 * 1.5, fs1 * 2.2);
      const slide = (1 - easeOut(still ? 1 : span(t, KILL.label))) * 26;
      let px: number;
      let py: number;
      let dir: [number, number];
      if (wide) {
        px = Sx + Rs * 1.32 + slide;
        dir = [1, 0];
        if (px + pw > w - 8) {
          px = Sx - Rs * 1.32 - pw - slide;
          dir = [-1, 0];
        }
        py = Sy - ph / 2;
      } else {
        py = Sy + Rs * 1.3 + slide;
        dir = [0, 1];
        if (py + ph > h - 8) {
          py = Sy - Rs * 1.3 - ph - slide;
          dir = [0, -1];
        }
        px = Math.max(8, Math.min(w - 8 - pw, Sx - pw / 2));
      }
      const pop = flipped && !still ? span(t, [KILL.count, KILL.count + 0.3]) : 1;
      const edge = pop < 1 ? 1 - pop : 0;
      // A leader from the tile's edge to the plate.
      const ex = Sx + dir[0] * Rs * 1.02;
      const ey = Sy + dir[1] * Rs * 1.02;
      const tx = dir[0] === 1 ? px : dir[0] === -1 ? px + pw : Sx;
      const ty = dir[1] === 1 ? py : dir[1] === -1 ? py + ph : Sy;
      over.moveTo(ex, ey).lineTo(dir[1] !== 0 ? Math.max(px + 10, Math.min(px + pw - 10, tx)) : tx, ty).stroke({ width: 1.5, color: LILAC, alpha: 0.9 * la });
      over.circle(ex, ey, 3).fill({ color: PALE, alpha: la });
      over.roundRect(px, py, pw, ph, 8).fill({ color: 0x0d0a18, alpha: 0.86 * la }).stroke({ width: 1.5 + 1.5 * edge, color: edge > 0 ? 0xffffff : VIOLET, alpha: la });
      over.roundRect(px, py, 4, ph, 2).fill({ color: VIOLET, alpha: la });
      b.title.alpha = la;
      b.num.alpha = la;
      b.title.position.set(px + pad, py + (ph - b.title.height) / 2);
      const nx = px + pad + b.title.width + fs1 * 0.6 + b.num.width / 2;
      const ny = py + ph / 2;
      b.num.position.set(nx, ny);
      b.num.scale.set(1 + 0.45 * (1 - easeOut(pop)));
      if (pop < 1) light.circle(nx, ny, fs2 * (0.5 + 1.3 * easeOut(pop))).stroke({ width: 3 * (1 - pop) + 0.5, color: PALE, alpha: 0.9 * (1 - pop) });
    }
  }

  function sounds(t: number) {
    const crossed = (at: number) => lastT < at && t >= at;
    if (crossed(KILL.lock)) playTargetLock();
    if (crossed(KILL.burst)) playOmegaBreak();
    if (crossed(KILL.count)) playKillConfirmed();
    lastT = t;
  }

  function begin(ghost: boolean) {
    build();
    if (env.ghost && !env.ghost.destroyed) env.ghost.visible = ghost;
    if (!playing) {
      playing = true;
      env.onPlay?.(true);
    }
  }

  const main: Step = {
    ms: KILL.total * 1000,
    hides: k.onBoard ? [] : [k.sector],
    twoTap: true,
    start: () => begin(true),
    frame: (p, look) => {
      const t = p * KILL.total;
      sounds(t);
      draw(t, look);
    },
    end: () => {
      if (env.ghost && !env.ghost.destroyed) env.ghost.destroy({ children: true });
      cleanup();
    },
  };
  main.still = {
    ms: STILL * 1000,
    fixed: true,
    twoTap: true,
    start: () => {
      begin(!k.onBoard && k.wreck);
      playKillConfirmed();
    },
    frame: (p, look) => {
      const s = p * STILL;
      draw(KILL.count + 0.5, look, true, Math.min(1, s / 0.15, (STILL - s) / 0.15));
    },
    end: cleanup,
  };
  return main;
}
