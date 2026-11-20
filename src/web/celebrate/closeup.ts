/**
 * The close-up every kill shares (designer 2026-11-20; Alpha Down in killFx.ts, Alpha Purge in
 * purgeFx.ts, Beta Breach in breachFx.ts). The Field zooms in on the unit and the rest darkens; the
 * tile (or its stand-in) looks as the piece wants until it breaks, then its Wreck (4.8), or what lies
 * beneath, shows again; a label beside it counts up ("ALPHA DOWN · 5 / 6" to "6 / 6"); the zoom eases
 * back. The piece draws the rest.
 *
 * One Step of the Field's animation player (anim.ts): two taps skip it; reduced motion and Instant
 * show a still close-up with the label (STILL seconds). Everything is worked out from the time alone.
 * Screen only: nothing here is a rule.
 */

import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { NodeLook, Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playKillConfirmed } from "../briefing/soundHooks.js";
import { STILL, span } from "./timeline.js";

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
  /** A unit that left the Field (no Wreck): its stand-in, in the board, shown until it breaks. */
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

type Span = readonly [number, number];

/** A piece's times (seconds at Normal speed), as far as the close-up needs them. */
export interface CloseTimes {
  total: number;
  zoomIn: Span;
  back: Span;
  /** The unit breaks: from here on its tile (or stand-in) is gone. */
  breakAt: number;
  /** Its Wreck, or what lies beneath, shows again. */
  wreckIn: Span;
  label: Span;
  /** The count goes up (playKillConfirmed). */
  count: number;
  /** The moment the still picture shows. */
  stillAt: number;
}

/** What a piece's drawing gets each frame. */
export interface Frame {
  t: number;
  /** The still picture (reduced motion, Instant) and its fade in and out. */
  still: boolean;
  fade: number;
  /** The unit's centre and radius on the screen now; the hex radius on the Field; the zoom now, at its fullest, and how far in (0-1). */
  Sx: number;
  Sy: number;
  Rs: number;
  R: number;
  z: number;
  Z: number;
  q: number;
  w: number;
  h: number;
  wide: boolean;
  broke: boolean;
  look: (key: string) => NodeLook;
}

export interface CloseupPiece<P> {
  times: CloseTimes;
  /** The unit's radius on the screen at the full zoom, as a share of the Field's smaller side (Alpha 0.2). */
  size?: number;
  /** The clear hole round the unit, in its radii (Alpha 1.25). */
  hole?: number;
  /** "ALPHA DOWN": the label's words before the count. */
  title: string;
  /** The label's colours: its edge and bar, its number, the number's outline; its size (Alpha 1). */
  accent: number;
  ink: number;
  inkLine: number;
  labelScale?: number;
  /** The piece's own things, behind the Wreck's stamp (`back`) and in front of it (`front`). */
  build: (back: Container, front: Container) => P;
  /** The screen's shake at time t (pixels). */
  shake?: (t: number, Rs: number) => readonly [number, number];
  /** How dark round the unit at time t (0-1; normally 1). */
  dark?: (t: number) => number;
  /** How the tile looks before it breaks. */
  tile: (t: number) => { scale: number; alpha: number };
  draw: (f: Frame, p: P) => void;
  /** Sound hooks, as their times are crossed (the count's own is the close-up's). */
  sounds: (crossed: (at: number) => boolean) => void;
}

let sparkTex: Texture | undefined;
/** A particle: a bright point with a short soft falloff (sharper than the puff). */
export function spark(): Texture {
  if (sparkTex) return sparkTex;
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.18, "rgba(255,255,255,0.9)");
  r.addColorStop(0.45, "rgba(255,255,255,0.28)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  sparkTex = Texture.from(c);
  return sparkTex;
}

/**
 * A pool of particles (designer 2026-11-20: things made of energy are drawn with particles). Each
 * frame: `begin()`, then `dot()` for every particle shown, then `end()` hides the rest.
 */
export interface Motes {
  begin: () => void;
  /** A particle at (x, y), `size` pixels across; `stretch` > 1 draws it long along angle `rot` (radians). */
  dot: (x: number, y: number, size: number, tint: number, alpha: number, stretch?: number, rot?: number) => void;
  end: () => void;
}
export function motes(parent: Container, n: number): Motes {
  const pool: Sprite[] = [];
  for (let i = 0; i < n; i++) {
    const s = new Sprite({ texture: spark(), anchor: 0.5 });
    s.blendMode = "add";
    s.visible = false;
    parent.addChild(s);
    pool.push(s);
  }
  let used = 0;
  return {
    begin: () => {
      used = 0;
    },
    dot: (x, y, size, tint, alpha, stretch = 1, rot = 0) => {
      if (used >= pool.length || alpha < 0.01 || size < 0.2) return;
      const s = pool[used++]!;
      s.visible = true;
      s.position.set(x, y);
      s.tint = tint;
      s.alpha = Math.min(1, alpha);
      s.rotation = rot;
      s.scale.set((size * stretch) / 32, size / 32);
    },
    end: () => {
      for (let i = used; i < pool.length; i++) pool[i]!.visible = false;
    },
  };
}

/** A small fixed random sequence (the same every time). */
export function seq(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

/** Pointy-top hex corners (as the Field draws its tiles), radius r. */
export function hexCorners(cx: number, cy: number, r: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}
export const flat = (pts: [number, number][]) => pts.flatMap((p) => p);

/** VIG_HOLE of the picture's half-width is clear; dark beyond. */
const VIG_HOLE = 0.1;
let vignetteTex: Texture | undefined;
/** Dark all round, clear in the middle (a soft hole a tenth of the way out). */
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
/** A soft round puff (smoke, glows, flashes). */
export function puff(): Texture {
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
/** A soft sprite (puff) added to a layer. */
export function glowSprite(parent: Container, tint: number, add = true): Sprite {
  const s = new Sprite({ texture: puff(), anchor: 0.5 });
  if (add) s.blendMode = "add";
  s.tint = tint;
  s.visible = false;
  parent.addChild(s);
  return s;
}

/** Cracks from a point a little off the middle to the tile's edge, in tile radii. */
export function makeCracks(seed: number, n = 7): { pts: [number, number][]; at: number }[] {
  const rnd = seq(seed);
  const hx = 0.12;
  const hy = -0.08;
  const out: { pts: [number, number][]; at: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
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

/** The cracks grown to `grow` (0-1) on a tile of radius r at (x, y): a soft glow line and a bright core line. */
export function drawCracks(g: Graphics, cracks: { pts: [number, number][]; at: number }[], grow: number, x0: number, y0: number, r: number, glow: number, core: number, glowAlpha = 0.3): void {
  for (const c of cracks) {
    const f = Math.max(0, Math.min(1, (grow - c.at) / (1 - c.at)));
    if (f <= 0) continue;
    const pts = c.pts.map(([x, y]) => [x0 + x * r, y0 + y * r] as [number, number]);
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
    let left = easeOut(f) * lens.reduce((a, x) => a + x, 0);
    const path: [number, number][] = [pts[0]!];
    for (let i = 0; i < lens.length && left > 0; i++) {
      const take = Math.min(1, left / lens[i]!);
      const a = pts[i]!;
      const b = pts[i + 1]!;
      path.push([a[0] + (b[0] - a[0]) * take, a[1] + (b[1] - a[1]) * take]);
      left -= lens[i]!;
    }
    const line = (width: number, color: number, alpha: number) => {
      g.moveTo(path[0]![0], path[0]![1]);
      for (const p of path.slice(1)) g.lineTo(p[0], p[1]);
      g.stroke({ width, color, alpha });
    };
    line(Math.max(4, r * 0.09), glow, glowAlpha);
    line(Math.max(1.3, r * 0.025), core, 0.95);
  }
}

/** A jagged bolt from (x1, y1) to (x2, y2): its points, the same for the same `seed`. */
export function bolt(x1: number, y1: number, x2: number, y2: number, seed: number, jag = 0.18, steps = 7): [number, number][] {
  const rnd = seq(seed);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / (len || 1);
  const ny = (x2 - x1) / (len || 1);
  const pts: [number, number][] = [[x1, y1]];
  for (let i = 1; i < steps; i++) {
    const f = i / steps;
    const off = (rnd() - 0.5) * 2 * jag * len * Math.sin(Math.PI * f);
    pts.push([x1 + (x2 - x1) * f + nx * off, y1 + (y2 - y1) * f + ny * off]);
  }
  pts.push([x2, y2]);
  return pts;
}
export function strokePath(g: Graphics, pts: [number, number][], width: number, color: number, alpha: number): void {
  if (pts.length < 2 || alpha <= 0.01) return;
  g.moveTo(pts[0]![0], pts[0]![1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.stroke({ width, color, alpha });
}

/** The six sectors round "q,r" and which way each lies on the screen (r+1 = right, q+1 = up-right, Core Rules 3.8). */
export function around(sector: string): { key: string; dx: number; dy: number }[] {
  const [q, r] = sector.split(",").map(Number) as [number, number];
  return [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, -1],
    [-1, 1],
  ].map(([dq, dr]) => {
    const x = dr! + dq! * 0.5;
    const y = -dq! * 0.866;
    const d = Math.hypot(x, y);
    return { key: `${q + dq!},${r + dr!}`, dx: x / d, dy: y / d };
  });
}

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

/** A kill as a Field step (and its still picture for reduced motion and Instant). */
export function closeupStep<P>(env: KillEnv, k: KillTarget, piece: CloseupPiece<P>): Step {
  const T = piece.times;
  let built: { root: Container; vig: Sprite; back: Container; front: Container; stamp: Text; plate: Graphics; pop: Graphics; title: Text; num: Text; own: P } | undefined;
  let playing = false;
  let lastT = -1;
  const dpr = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);

  function build() {
    if (built) return built;
    const root = new Container();
    root.eventMode = "none";
    const vig = new Sprite({ texture: vignette(), anchor: 0.5 });
    const back = new Container();
    const front = new Container();
    // The Wreck's stamp on the stand-in, when the Wreck leaves the Field later in the same answer.
    const stamp = new Text({ text: "WRECK", resolution: dpr * 2, style: { fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: "700", fill: 0x9b1c1c } });
    stamp.anchor.set(0.5);
    stamp.visible = false;
    const plate = new Graphics();
    const pop = new Graphics();
    pop.blendMode = "add";
    const title = new Text({ text: `${piece.title} ·`, resolution: dpr * 1.5, style: { fontFamily: "system-ui, sans-serif", fontSize: 16, fontWeight: "800", fill: 0xffffff, letterSpacing: 2 } });
    const num = new Text({ text: `${k.count - 1} / ${k.count}`, resolution: dpr * 1.5, style: { fontFamily: "system-ui, sans-serif", fontSize: 28, fontWeight: "900", fill: piece.ink, stroke: { color: piece.inkLine, width: 3 } } });
    num.anchor.set(0.5);
    root.addChild(vig, back, stamp, front, plate, pop, title, num);
    env.layer.addChild(root);
    const own = piece.build(back, front);
    built = { root, vig, back, front, stamp, plate, pop, title, num, own };
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
    const Z = Math.max(1.2, Math.min(2.6, (Math.min(w, h) * (piece.size ?? 0.2)) / R));
    const F = wide ? { x: w * 0.4, y: h * 0.5 } : { x: w * 0.5, y: h * 0.38 };
    // The zoom: in at the start, out at the end.
    const q = still ? 1 : t < T.back[0] ? easeInOut(span(t, T.zoomIn)) : 1 - easeInOut(span(t, T.back));
    const z = 1 + (Z - 1) * q;
    let Sx = n.cx + (F.x - n.cx) * q;
    let Sy = n.cy + (F.y - n.cy) * q;
    const Rs = R * z;
    const [shx, shy] = !still && piece.shake ? piece.shake(t, Rs) : [0, 0];
    env.zoom(z, Sx + shx - n.cx * z, Sy + shy - n.cy * z);
    Sx += shx;
    Sy += shy;
    sharpen(n.node, Math.ceil(dpr * z));

    // The darkness round it.
    const hole = piece.hole ?? 1.25;
    const corner = Math.max(Math.hypot(Sx, Sy), Math.hypot(w - Sx, Sy), Math.hypot(Sx, h - Sy), Math.hypot(w - Sx, h - Sy));
    const half = Math.max((hole * Rs) / VIG_HOLE, corner + 24);
    b.vig.position.set(Sx, Sy);
    b.vig.width = b.vig.height = half * 2;
    b.vig.alpha = 0.85 * q * fade * (piece.dark && !still ? piece.dark(t) : 1);

    // The tile as the piece wants it until it breaks; then the Wreck settles in. It is the real tile when its
    // Wreck stays on the board; else its stand-in (and what is beneath shows after it breaks, or, for a Wreck
    // that leaves later in the same answer, the stand-in stays as the Wreck).
    const L = look(k.sector);
    const broke = still || t >= T.breakAt;
    const label = wreckLabel(n.node);
    if (label) label.visible = broke;
    const g0 = env.ghost && !env.ghost.destroyed ? env.ghost : undefined;
    const wreckGhost = !k.onBoard && k.wreck;
    const wi = still ? 1 : span(t, T.wreckIn);
    if (!broke) {
      const tl = piece.tile(t);
      L.scale = tl.scale;
      L.alpha = k.onBoard ? tl.alpha : 0;
      if (g0) {
        g0.visible = true;
        g0.position.set(n.cx, n.cy);
        g0.scale.set(tl.scale);
        g0.alpha = tl.alpha;
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

    piece.draw({ t, still, fade, Sx, Sy, Rs, R, z, Z, q, w, h, wide, broke, look }, b.own);
    drawLabel(b, t, still, fade, { Sx, Sy, Rs, R, Z, w, h, wide });
  }

  /** The label beside it: "ALPHA DOWN · 5 / 6", then "6 / 6". */
  function drawLabel(b: NonNullable<typeof built>, t: number, still: boolean, fade: number, f: { Sx: number; Sy: number; Rs: number; R: number; Z: number; w: number; h: number; wide: boolean }) {
    const { Sx, Sy, Rs, R, Z, w, h, wide } = f;
    const plate = b.plate.clear();
    const pop = b.pop.clear();
    const la = still ? fade : span(t, T.label) * (1 - span(t, [T.back[0], T.back[0] + 0.35]));
    const flipped = still || t >= T.count;
    const want = `${flipped ? k.count : k.count - 1} / ${k.count}`;
    if (b.num.text !== want) b.num.text = want;
    b.title.visible = b.num.visible = la > 0.01;
    if (la <= 0.01) return;
    // Sized for the full zoom (the label goes before the zoom eases back).
    const ls = piece.labelScale ?? 1;
    const fs1 = Math.round(Math.max(13, Math.min(22 * ls, R * Z * 0.2 * ls)));
    const fs2 = Math.round(Math.max(20, Math.min(38 * ls, R * Z * 0.38 * ls)));
    if (b.title.style.fontSize !== fs1) b.title.style.fontSize = fs1;
    if (b.num.style.fontSize !== fs2) b.num.style.fontSize = fs2;
    b.num.scale.set(1);
    const pad = fs1 * 0.8;
    const pw = pad * 2 + b.title.width + fs1 * 0.6 + b.num.width;
    const ph = Math.max(fs2 * 1.5, fs1 * 2.2);
    const slide = (1 - easeOut(still ? 1 : span(t, T.label))) * 26;
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
    const popU = flipped && !still ? span(t, [T.count, T.count + 0.3]) : 1;
    const edge = popU < 1 ? 1 - popU : 0;
    // A leader from the tile's edge to the plate.
    const ex = Sx + dir[0] * Rs * 1.02;
    const ey = Sy + dir[1] * Rs * 1.02;
    const tx = dir[0] === 1 ? px : dir[0] === -1 ? px + pw : Sx;
    const ty = dir[1] === 1 ? py : dir[1] === -1 ? py + ph : Sy;
    plate.moveTo(ex, ey).lineTo(dir[1] !== 0 ? Math.max(px + 10, Math.min(px + pw - 10, tx)) : tx, ty).stroke({ width: 1.5, color: piece.accent, alpha: 0.9 * la });
    plate.circle(ex, ey, 3).fill({ color: piece.ink, alpha: la });
    plate.roundRect(px, py, pw, ph, 8).fill({ color: 0x0d0a18, alpha: 0.86 * la }).stroke({ width: 1.5 + 1.5 * edge, color: edge > 0 ? 0xffffff : piece.accent, alpha: la });
    plate.roundRect(px, py, 4, ph, 2).fill({ color: piece.accent, alpha: la });
    b.title.alpha = la;
    b.num.alpha = la;
    b.title.position.set(px + pad, py + (ph - b.title.height) / 2);
    const nx = px + pad + b.title.width + fs1 * 0.6 + b.num.width / 2;
    const ny = py + ph / 2;
    b.num.position.set(nx, ny);
    b.num.scale.set(1 + 0.45 * (1 - easeOut(popU)));
    if (popU < 1) pop.circle(nx, ny, fs2 * (0.5 + 1.3 * easeOut(popU))).stroke({ width: 3 * (1 - popU) + 0.5, color: piece.ink, alpha: 0.9 * (1 - popU) });
  }

  function sounds(t: number) {
    const crossed = (at: number) => lastT < at && t >= at;
    piece.sounds(crossed);
    if (crossed(T.count)) playKillConfirmed();
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
    ms: T.total * 1000,
    hides: k.onBoard ? [] : [k.sector],
    twoTap: true,
    start: () => begin(true),
    frame: (p, look) => {
      const t = p * T.total;
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
      draw(T.stillAt, look, true, Math.min(1, s / 0.15, (STILL - s) / 0.15));
    },
    end: cleanup,
  };
  return main;
}
