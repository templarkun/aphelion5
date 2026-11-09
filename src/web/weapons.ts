/**
 * Weapon and aura looks (Program Spec "Interaction and animation" > "Weapon and
 * aura looks", build step 3): every hit, move or look made by a Bay, an Order or a
 * Module starts at that thing on the screen and travels to its target on the
 * Field. Drawn in a page-wide SVG over everything (the panels are HTML, the Field
 * a canvas), one short step before the event it belongs to. Placeholder looks;
 * the designer's art can replace them later.
 *
 * - Bay or Order that deals damage: laser (a thin bright beam, held 0.2 s).
 * - Bay or Order that moves or swaps: tractor beam (a pale wavy ray that grips the unit).
 * - Bay or Order that looks at tiles: scanning aura (a ring travels to the sector and wraps it).
 * - Yellow Module: bolt (a quick projectile with a short trail).
 * - Red Module: heavy beam (wide, with heat shimmer).
 * - Blue Module: field (a wave that spreads over the target).
 * A Module that moves units or looks at tiles uses the tractor or scan look in its colour.
 */

import type { Step } from "./anim.js";

export interface Source {
  what: "bay" | "order" | "module";
  rule: string;
  bay?: number | undefined;
  module?: number | undefined;
  colour?: string | undefined;
}

export type Look = "laser" | "tractor" | "scan" | "bolt" | "beam" | "field" | ShotLook;

/** The newer looks (designer 2026-11-09: every damage source but Company1's Bay 1 laser looks different). */
export type ShotLook = "rail" | "missile" | "lob" | "bomb" | "heat" | "plasma" | "lash" | "sting" | "disc" | "void" | "shell" | "fuse";

const SVG = "http://www.w3.org/2000/svg";
const COLOUR: Record<string, string> = { Yellow: "#f2c230", Red: "#ff4d3d", Blue: "#3d8bff" };

/** The thing on the screen that fired (a Bay or Order button, a Module card). */
export function sourceElement(src: Source): HTMLElement | null {
  if (src.what === "bay") return document.querySelector<HTMLElement>(`[data-bay="${src.bay}"]`);
  if (src.what === "order") return document.querySelector<HTMLElement>(`[data-order="${CSS.escape(src.rule)}"]`);
  return document.querySelector<HTMLElement>(`[data-module="${src.module}"]`);
}

/** The look for this source and kind of event. */
export function lookFor(src: Source, kind: "hit" | "move" | "look"): Look {
  if (kind === "move") return "tractor";
  if (kind === "look") return "scan";
  // Company1's Bay 1 keeps the laser (designer 2026-11-09); every other Bay shoots a rail slug, Orders a missile.
  if (src.what === "bay") return src.rule === "V1_BAY1" ? "laser" : "rail";
  if (src.what === "order") return "missile";
  return src.colour === "Yellow" ? "bolt" : src.colour === "Red" ? "beam" : "field";
}

const colourOf = (src: Source, look: Look): string => {
  if (src.what === "module") return COLOUR[src.colour ?? ""] ?? "#ffffff";
  if (look === "rail") return "#7af4ff";
  if (look === "missile") return "#ffb347";
  return look === "laser" ? "#ff5a5a" : look === "tractor" ? "#9fe8ff" : "#8a6cff";
};

function el<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** The thing that fired glows (Program Spec: "The Bay panel glows, its weapon or aura fires"). */
export function fireGlow(src: Source): void {
  const e = sourceElement(src);
  if (!e) return;
  e.classList.remove("fx-fire");
  void e.offsetWidth;
  e.style.setProperty("--fire", src.what === "module" ? (COLOUR[src.colour ?? ""] ?? "#ffd27a") : "#ffd27a");
  e.classList.add("fx-fire");
  window.setTimeout(() => e.classList.remove("fx-fire"), 900);
}

/**
 * One weapon step from the source to a point on the page (`to()`, read when the step starts,
 * so the Field's layout is the current one). `size`: the target's tile radius in px.
 */
export function weaponStep(src: Source, kind: "hit" | "move" | "look", to: () => { x: number; y: number; size: number } | undefined): Step {
  const look = lookFor(src, kind);
  const colour = colourOf(src, look);
  if (isShot(look)) return shotStep(look, colour, (t) => edgeOf(sourceElement(src), t), to, { onStart: () => fireGlow(src) });
  const ms = { laser: 380, tractor: 360, scan: 520, bolt: 280, beam: 420, field: 460 }[look as "laser"];
  let svg: SVGSVGElement | undefined;
  let a = { x: 0, y: 0 };
  let b = { x: 0, y: 0, size: 30 };
  const parts: SVGElement[] = [];
  return {
    ms,
    start: () => {
      const s = sourceElement(src)?.getBoundingClientRect();
      const t = to();
      if (!s || !t) return;
      b = t;
      // From the source's edge nearest the target.
      a = { x: Math.max(s.left, Math.min(s.right, t.x)), y: Math.max(s.top, Math.min(s.bottom, t.y)) };
      fireGlow(src);
      svg = el("svg", { class: `weapon-fx look-${look}`, width: window.innerWidth, height: window.innerHeight, "aria-hidden": "true" });
      if (look === "laser" || look === "beam") {
        const w = look === "laser" ? 3 : 12;
        parts.push(el("line", { x1: a.x, y1: a.y, x2: a.x, y2: a.y, stroke: colour, "stroke-width": w * 2.4, "stroke-linecap": "round", opacity: 0.35 }));
        parts.push(el("line", { x1: a.x, y1: a.y, x2: a.x, y2: a.y, stroke: look === "laser" ? "#fff" : colour, "stroke-width": w, "stroke-linecap": "round" }));
        parts.push(el("circle", { cx: b.x, cy: b.y, r: 0, fill: "#fff", opacity: 0 }));
      } else if (look === "tractor") {
        parts.push(el("path", { d: "", fill: "none", stroke: colour, "stroke-width": 5, opacity: 0.35, "stroke-linecap": "round" }));
        parts.push(el("path", { d: "", fill: "none", stroke: colour, "stroke-width": 2, "stroke-dasharray": "6 6", "stroke-linecap": "round" }));
        parts.push(el("circle", { cx: b.x, cy: b.y, r: b.size * 0.8, fill: "none", stroke: colour, "stroke-width": 2, opacity: 0 }));
      } else if (look === "scan") {
        parts.push(el("circle", { cx: a.x, cy: a.y, r: 6, fill: "none", stroke: colour, "stroke-width": 3 }));
        parts.push(el("circle", { cx: b.x, cy: b.y, r: 0, fill: colour, opacity: 0 }));
      } else if (look === "bolt") {
        parts.push(el("line", { x1: a.x, y1: a.y, x2: a.x, y2: a.y, stroke: colour, "stroke-width": 4, "stroke-linecap": "round", opacity: 0.6 }));
        parts.push(el("circle", { cx: a.x, cy: a.y, r: 6, fill: "#fff", stroke: colour, "stroke-width": 3 }));
      } else {
        parts.push(el("circle", { cx: a.x, cy: a.y, r: 4, fill: "none", stroke: colour, "stroke-width": 4, opacity: 0.8 }));
        parts.push(el("circle", { cx: b.x, cy: b.y, r: 0, fill: colour, opacity: 0 }));
      }
      for (const p of parts) svg.appendChild(p);
      document.body.appendChild(svg);
    },
    frame: (p) => {
      if (!svg) return;
      const at = (q: number) => ({ x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q });
      if (look === "laser" || look === "beam") {
        const reach = ease(Math.min(1, p / 0.35));
        const end = at(reach);
        const fade = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1;
        const shimmer = look === "beam" ? 1 + 0.25 * Math.sin(p * 70) : 1;
        for (const l of parts.slice(0, 2)) {
          l.setAttribute("x2", String(end.x));
          l.setAttribute("y2", String(end.y));
          l.setAttribute("opacity", String((l === parts[0] ? 0.35 : 1) * fade));
        }
        parts[0]!.setAttribute("stroke-width", String((look === "laser" ? 7 : 28) * shimmer));
        const hitP = Math.max(0, (p - 0.35) / 0.65);
        parts[2]!.setAttribute("r", String(b.size * 0.5 * Math.sin(Math.PI * Math.min(1, hitP * 1.4))));
        parts[2]!.setAttribute("opacity", String(hitP > 0 ? 0.8 * (1 - hitP) : 0));
      } else if (look === "tractor") {
        const reach = ease(Math.min(1, p / 0.5));
        const n = 24;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        let d = "";
        for (let i = 0; i <= n; i++) {
          const q = (i / n) * reach;
          const w = Math.sin(q * 18 - p * 20) * 7 * Math.sin(Math.PI * Math.min(1, q * 1.2));
          const pt = at(q);
          d += `${i ? "L" : "M"}${pt.x + nx * w},${pt.y + ny * w}`;
        }
        const fade = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
        parts[0]!.setAttribute("d", d);
        parts[1]!.setAttribute("d", d);
        parts[1]!.setAttribute("stroke-dashoffset", String(-p * 80));
        parts[0]!.setAttribute("opacity", String(0.35 * fade));
        parts[1]!.setAttribute("opacity", String(fade));
        const grip = Math.max(0, (p - 0.45) / 0.55);
        parts[2]!.setAttribute("opacity", String(grip > 0 ? Math.sin(Math.PI * grip) * 0.9 : 0));
        parts[2]!.setAttribute("r", String(b.size * (0.95 - 0.2 * grip)));
      } else if (look === "scan") {
        const travel = ease(Math.min(1, p / 0.45));
        const pt = at(travel);
        const wrap = Math.max(0, (p - 0.45) / 0.55);
        parts[0]!.setAttribute("cx", String(pt.x));
        parts[0]!.setAttribute("cy", String(pt.y));
        parts[0]!.setAttribute("r", String(6 + travel * b.size * 0.4 + wrap * b.size * 0.7));
        parts[0]!.setAttribute("opacity", String(1 - wrap));
        parts[1]!.setAttribute("r", String(b.size * 0.9 * Math.min(1, wrap * 1.5)));
        parts[1]!.setAttribute("opacity", String(wrap > 0 ? 0.35 * (1 - wrap) : 0));
      } else if (look === "bolt") {
        const q = Math.min(1, p / 0.8);
        const head = at(ease(q));
        const tail = at(Math.max(0, ease(q) - 0.18));
        parts[0]!.setAttribute("x1", String(tail.x));
        parts[0]!.setAttribute("y1", String(tail.y));
        parts[0]!.setAttribute("x2", String(head.x));
        parts[0]!.setAttribute("y2", String(head.y));
        parts[1]!.setAttribute("cx", String(head.x));
        parts[1]!.setAttribute("cy", String(head.y));
        const pop = Math.max(0, (p - 0.8) / 0.2);
        parts[1]!.setAttribute("r", String(6 + pop * b.size * 0.4));
        parts[1]!.setAttribute("opacity", String(1 - pop));
        parts[0]!.setAttribute("opacity", String(0.6 * (1 - pop)));
      } else {
        const q = ease(Math.min(1, p / 0.55));
        const pt = at(q);
        parts[0]!.setAttribute("cx", String(pt.x));
        parts[0]!.setAttribute("cy", String(pt.y));
        parts[0]!.setAttribute("r", String(4 + q * b.size * 0.5));
        parts[0]!.setAttribute("opacity", String(0.8 * (1 - Math.max(0, (p - 0.55) / 0.45))));
        const spread = Math.max(0, (p - 0.45) / 0.55);
        parts[1]!.setAttribute("r", String(b.size * 1.1 * spread));
        parts[1]!.setAttribute("opacity", String(spread > 0 ? 0.45 * (1 - spread) : 0));
      }
    },
    end: () => {
      svg?.remove();
      svg = undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Shots (designer 2026-11-09). Each is redrawn whole every frame in its own page-wide SVG.

export interface Pt {
  x: number;
  y: number;
}
export interface Target extends Pt {
  /** The target's tile radius in px. */
  size: number;
}

const SHOT_MS: Record<ShotLook, number> = { rail: 420, missile: 560, lob: 620, bomb: 380, heat: 660, plasma: 380, lash: 460, sting: 400, disc: 440, void: 460, shell: 340, fuse: 560 };
/** When the shot lands (fraction of its time): the hit flash follows the step. */
const IMPACT: Record<ShotLook, number> = { rail: 0.5, missile: 0.62, lob: 0.66, bomb: 0.55, heat: 0.45, plasma: 0.62, lash: 0.42, sting: 0.5, disc: 0.62, void: 0.15, shell: 0.5, fuse: 0.55 };

export const isShot = (l: Look): l is ShotLook => l in SHOT_MS;

/** The point of an element's box nearest the target. */
export function edgeOf(e: Element | null | undefined, t: Pt): Pt | undefined {
  const s = e?.getBoundingClientRect();
  if (!s) return undefined;
  return { x: Math.max(s.left, Math.min(s.right, t.x)), y: Math.max(s.top, Math.min(s.bottom, t.y)) };
}

/** The look and colour of damage dealt by a unit's own effect, by its type (designer 2026-11-09). */
export const UNIT_SHOT: Record<string, { look: ShotLook; colour: string }> = {
  Sentinel: { look: "plasma", colour: "#ff4d6d" },
  Flare: { look: "lash", colour: "#ffcf3f" },
  Sleeper: { look: "sting", colour: "#5aa0ff" },
  Gyro: { look: "disc", colour: "#5fd47a" },
  Omega: { look: "void", colour: "#b07cff" },
  Mecha: { look: "shell", colour: "#ff9a3c" },
  Bot: { look: "shell", colour: "#e8e6e1" },
};

/** A small repeatable random number from a seed. */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * One shot from `from(target)` to `to()` (both read when the step starts). `onStart`: the source glows;
 * `onHit`: called once as the shot lands (e.g. the Flagship shakes).
 */
export function shotStep(look: ShotLook, colour: string, from: (t: Target) => Pt | undefined, to: () => Target | undefined, opts: { onStart?: () => void; onHit?: () => void; seed?: number } = {}): Step {
  let svg: SVGSVGElement | undefined;
  let a: Pt = { x: 0, y: 0 };
  let b: Target = { x: 0, y: 0, size: 30 };
  let hit = false;
  const seed = opts.seed ?? Math.floor(Math.random() * 1000);
  return {
    ms: SHOT_MS[look],
    start: () => {
      const t = to();
      if (!t) return;
      b = t;
      a = from(t) ?? t;
      opts.onStart?.();
      svg = el("svg", { class: `weapon-fx look-${look}`, width: window.innerWidth, height: window.innerHeight, "aria-hidden": "true" });
      document.body.appendChild(svg);
    },
    frame: (p) => {
      if (!svg) return;
      svg.replaceChildren(...drawShot(look, colour, a, b, p, seed));
      if (!hit && p >= IMPACT[look]) {
        hit = true;
        opts.onHit?.();
      }
    },
    end: () => {
      svg?.remove();
      svg = undefined;
      if (!hit) opts.onHit?.();
      hit = true;
    },
  };
}

function drawShot(look: ShotLook, col: string, a: Pt, b: Target, p: number, seed: number): SVGElement[] {
  const out: SVGElement[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const at = (q: number): Pt => ({ x: a.x + dx * q, y: a.y + dy * q });
  const S = b.size;
  const circle = (c: Pt, r: number, attrs: Record<string, string | number>) => out.push(el("circle", { cx: c.x, cy: c.y, r: Math.max(0, r), ...attrs }));
  const line = (p1: Pt, p2: Pt, attrs: Record<string, string | number>) => out.push(el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, "stroke-linecap": "round", ...attrs }));
  const poly = (pts: Pt[], attrs: Record<string, string | number>) => out.push(el("polyline", { points: pts.map((q) => `${q.x},${q.y}`).join(" "), fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", ...attrs }));
  /** A burst at the target: flash, ring(s) and flying bits. */
  const burst = (r: number, opts: { ring?: string; bits?: number; flash?: string; size?: number } = {}) => {
    if (r <= 0 || r >= 1) return;
    const k = opts.size ?? 1;
    circle(b, S * k * (0.25 + 0.5 * r) * (1 - r * 0.3), { fill: opts.flash ?? "#fff", opacity: 0.85 * (1 - r) ** 2 });
    circle(b, S * k * (0.3 + 0.9 * r), { fill: "none", stroke: opts.ring ?? col, "stroke-width": 3 * (1 - r) + 0.5, opacity: 1 - r });
    for (let i = 0; i < (opts.bits ?? 0); i++) {
      const ang = (i / (opts.bits ?? 1)) * Math.PI * 2 + rnd(seed + i) * 0.6;
      const d0 = S * k * (0.2 + 0.7 * r);
      const d1 = d0 + S * 0.18 * (1 - r);
      line({ x: b.x + Math.cos(ang) * d0, y: b.y + Math.sin(ang) * d0 }, { x: b.x + Math.cos(ang) * d1, y: b.y + Math.sin(ang) * d1 }, { stroke: i % 2 ? "#fff" : col, "stroke-width": 2.5, opacity: 1 - r });
    }
  };
  const fadeAfter = (p0: number) => (p > p0 ? 1 - (p - p0) / (1 - p0) : 1);

  switch (look) {
    case "rail": {
      // Charge at the source, a slug with a spiral trail, two shock rings.
      const charge = clamp01(p / 0.25);
      if (p < 0.4) circle(a, 3 + 9 * charge, { fill: "none", stroke: col, "stroke-width": 3, opacity: charge * (1 - clamp01((p - 0.25) / 0.15)) });
      const q = clamp01((p - 0.25) / 0.25);
      const fade = 1 - clamp01((p - 0.5) / 0.35);
      if (q > 0 && fade > 0) {
        const tail = Math.max(0, q - 0.45);
        line(at(tail), at(q), { stroke: col, "stroke-width": 7, opacity: 0.3 * fade });
        line(at(tail), at(q), { stroke: "#fff", "stroke-width": 2, opacity: fade });
        for (let i = 0; i < 16; i++) {
          const t = tail + ((q - tail) * i) / 15;
          const w = Math.sin(t * len * 0.12 - p * 40) * 6;
          circle({ x: at(t).x + nx * w, y: at(t).y + ny * w }, 1.6, { fill: col, opacity: fade * (i / 15) });
        }
      }
      const r = clamp01((p - 0.5) / 0.5);
      burst(r, { bits: 6 });
      if (r > 0.25 && r < 1) circle(b, S * (0.2 + 0.9 * (r - 0.25)), { fill: "none", stroke: "#fff", "stroke-width": 1.5, opacity: 1 - r });
      break;
    }
    case "missile":
    case "lob": {
      // A curved flight with a smoke trail (missile), or a high lobbed shell (Mortar).
      const up = ny < 0 ? 1 : -1;
      const arc = look === "lob" ? len * 0.6 + S : len * 0.3;
      const c = { x: (a.x + b.x) / 2 + nx * up * arc * 0.3, y: (a.y + b.y) / 2 + ny * up * arc - (look === "lob" ? arc * 0.5 : 0) };
      const bez = (t: number): Pt => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
      const land = IMPACT[look];
      const q = clamp01(p / land) ** 1.3;
      if (p < land) {
        if (look === "missile")
          for (let i = 10; i >= 1; i--) {
            const t = q - i * 0.035;
            if (t > 0) circle(bez(t), 3 + i * 0.9, { fill: "#c9c4bd", opacity: 0.32 * (1 - i / 11) });
          }
        const h = bez(q);
        const h2 = bez(Math.max(0, q - 0.03));
        line(h2, h, { stroke: look === "lob" ? "#5a1010" : "#fff", "stroke-width": look === "lob" ? 7 : 4 });
        circle(h2, 4 + Math.sin(p * 90) * 1.5, { fill: col, opacity: 0.9 });
      }
      const r = clamp01((p - land) / (1 - land));
      if (r > 0 && r < 1) {
        circle(b, S * (0.25 + 0.6 * Math.sqrt(r)), { fill: col, opacity: 0.8 * (1 - r) });
        circle(b, S * (0.15 + 0.35 * Math.sqrt(r)), { fill: "#fff3c4", opacity: 0.9 * (1 - r) ** 2 });
      }
      burst(r, { bits: 8, flash: "#ffe8a8" });
      break;
    }
    case "bomb": {
      // A shell falling from the sky onto the target (fast "field bombing").
      const land = IMPACT.bomb;
      const q = clamp01(p / land) ** 2;
      if (p < land) {
        line(at(Math.max(0, q - 0.3)), at(q), { stroke: col, "stroke-width": 9, opacity: 0.25 });
        line(at(Math.max(0, q - 0.22)), at(q), { stroke: "#fff", "stroke-width": 3 });
      }
      const r = clamp01((p - land) / (1 - land));
      if (r > 0 && r < 1) circle(b, S * (0.3 + 0.55 * Math.sqrt(r)), { fill: col, opacity: 0.7 * (1 - r) });
      burst(r, { bits: 8, flash: "#fff2c8" });
      break;
    }
    case "heat": {
      // Heat Wave (H5): a shimmering heat ray from the Heat bar, then heat haze and embers on the Bot.
      const reach = clamp01(p / 0.45);
      const fade = fadeAfter(0.6);
      for (const [w, c2, o, ph] of [
        [12, "#ff4a1a", 0.22, 0],
        [6, "#ff9a3c", 0.45, 1.7],
        [2.5, "#ffe1a1", 0.85, 3.1],
      ] as const) {
        const pts: Pt[] = [];
        for (let i = 0; i <= 28; i++) {
          const t = (i / 28) * reach;
          const wv = Math.sin(t * len * 0.07 - p * 26 + ph) * 8 * Math.sin(Math.PI * Math.min(1, t * 1.15));
          pts.push({ x: at(t).x + nx * wv, y: at(t).y + ny * wv });
        }
        poly(pts, { stroke: c2, "stroke-width": w, opacity: o * fade });
      }
      const h = clamp01((p - 0.35) / 0.65);
      if (h > 0 && h < 1) {
        for (let k = 0; k < 3; k++) circle(b, S * (0.45 + 0.18 * k + 0.06 * Math.sin(p * 30 + k)), { fill: "none", stroke: "#ffb070", "stroke-width": 2, opacity: 0.6 * (1 - h) });
        circle(b, S * 0.75, { fill: "#ff6a2a", opacity: 0.22 * Math.sin(Math.PI * h) });
        for (let k = 0; k < 9; k++) {
          const u = (h * 1.4 + rnd(seed + k)) % 1;
          circle({ x: b.x + (rnd(seed + k * 3) - 0.5) * S * 1.2 + Math.sin(p * 18 + k) * 4, y: b.y + S * 0.5 - u * S * 1.4 }, 2.2, { fill: k % 2 ? "#ffd27a" : "#ff6a2a", opacity: (1 - u) * (1 - h) });
        }
      }
      break;
    }
    case "plasma": {
      // Sentinel: two plasma balls that wobble towards the target, then a splash.
      const land = IMPACT.plasma;
      const q = clamp01(p / land);
      if (p < land)
        for (const side of [-1, 1]) {
          const t = Math.max(0, q - (side > 0 ? 0.08 : 0));
          const w = side * (7 + Math.sin(p * 40) * 3) * Math.sin(Math.PI * t);
          const pos = { x: at(t).x + nx * w, y: at(t).y + ny * w };
          circle(pos, Math.max(10, S * 0.22), { fill: col, opacity: 0.35 });
          circle(pos, Math.max(4.5, S * 0.1), { fill: "#fff" });
        }
      const r = clamp01((p - land) / (1 - land));
      burst(r, { bits: 7, flash: "#ffc2cc" });
      break;
    }
    case "lash": {
      // Flare: a fiery solar whip that cracks onto the target.
      const reach = clamp01(p / IMPACT.lash);
      const fade = fadeAfter(0.62);
      const bend = len * 0.22 * (rnd(seed) > 0.5 ? 1 : -1);
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * reach;
        const w = Math.sin(Math.PI * t) * bend + Math.sin(t * 30 - p * 50) * 3;
        pts.push({ x: at(t).x + nx * w, y: at(t).y + ny * w });
      }
      const flick = 1 + 0.3 * Math.sin(p * 80);
      poly(pts, { stroke: "#ff6a1a", "stroke-width": 14 * flick, opacity: 0.3 * fade });
      poly(pts, { stroke: col, "stroke-width": 6, opacity: 0.85 * fade });
      poly(pts, { stroke: "#fff", "stroke-width": 2, opacity: fade });
      burst(clamp01((p - IMPACT.lash) / (1 - IMPACT.lash)), { bits: 10, flash: "#fff2b0" });
      break;
    }
    case "sting": {
      // Sleeper: a thin needle, then ripples of venom.
      const q = clamp01(p / IMPACT.sting) ** 1.6;
      if (p < IMPACT.sting) {
        line(at(Math.max(0, q - 0.14)), at(q), { stroke: col, "stroke-width": 6, opacity: 0.35 });
        line(at(Math.max(0, q - 0.1)), at(q), { stroke: "#fff", "stroke-width": 1.8 });
      }
      const r = clamp01((p - IMPACT.sting) / (1 - IMPACT.sting));
      if (r > 0 && r < 1) {
        for (let k = 0; k < 3; k++) {
          const rr = clamp01(r * 1.4 - k * 0.2);
          if (rr > 0) circle(b, S * (0.15 + 0.85 * rr), { fill: "none", stroke: col, "stroke-width": 2, opacity: 1 - rr });
        }
        circle(b, S * 0.25 * (1 + 0.3 * Math.sin(p * 60)), { fill: "#1d3f80", opacity: 0.55 * (1 - r) });
      }
      break;
    }
    case "disc": {
      // Gyro: a spinning blade disc on a curve, then green sparks.
      const land = IMPACT.disc;
      const q = clamp01(p / land);
      const bend = len * 0.18;
      const pos = (t: number): Pt => ({ x: at(t).x + nx * Math.sin(Math.PI * t) * bend, y: at(t).y + ny * Math.sin(Math.PI * t) * bend });
      if (p < land) {
        const r0 = Math.max(7, S * 0.2);
        for (const back of [0.1, 0.05]) circle(pos(Math.max(0, q - back)), r0, { fill: col, opacity: 0.15 });
        const c = pos(q);
        circle(c, r0, { fill: col, "fill-opacity": 0.3, stroke: col, "stroke-width": 2 });
        for (let k = 0; k < 3; k++) {
          const ang = p * 45 + (k * 2 * Math.PI) / 3;
          line(c, { x: c.x + Math.cos(ang) * r0, y: c.y + Math.sin(ang) * r0 }, { stroke: "#fff", "stroke-width": 2 });
        }
      }
      burst(clamp01((p - land) / (1 - land)), { bits: 10, ring: "#b8ffc8" });
      break;
    }
    case "void": {
      // Omega: violet lightning that flickers between the two, then an implosion.
      const flick = Math.floor(p * 26);
      if (p < 0.6 && flick % 4 !== 3) {
        const pts: Pt[] = [a];
        const n = 9;
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const w = (rnd(seed + flick * 13 + i) - 0.5) * Math.min(len * 0.35, 60) * Math.sin(Math.PI * t);
          pts.push({ x: at(t).x + nx * w, y: at(t).y + ny * w });
        }
        pts.push(b);
        const o = 1 - p / 0.6;
        poly(pts, { stroke: col, "stroke-width": 9, opacity: 0.35 * o });
        poly(pts, { stroke: "#fff", "stroke-width": 2, opacity: o });
      }
      const r = clamp01((p - 0.15) / 0.85);
      if (r > 0 && r < 1) {
        circle(b, S * 0.9 * (1 - r), { fill: "#2a0a4a", opacity: 0.6 * Math.sin(Math.PI * r) });
        circle(b, S * (0.2 + 0.9 * r), { fill: "none", stroke: col, "stroke-width": 3, opacity: 1 - r });
      }
      break;
    }
    case "shell": {
      // Mecha: a muzzle flash, a fast shell, a blast.
      if (p < 0.2) circle(a, 5 + 30 * p, { fill: "#fff2c8", opacity: 1 - p / 0.2 });
      const q = clamp01(p / IMPACT.shell);
      if (p < IMPACT.shell) line(at(Math.max(0, q - 0.08)), at(q), { stroke: "#ffe0a0", "stroke-width": 4 });
      burst(clamp01((p - IMPACT.shell) / (1 - IMPACT.shell)), { bits: 8, flash: "#ffd9a0" });
      break;
    }
    case "fuse": {
      // A Fuse token goes off on its unit: a spark runs round a shrinking spiral, then it blows.
      const land = IMPACT.fuse;
      if (p < land) {
        const q = p / land;
        const ang = q * Math.PI * 6;
        const rr = S * 0.6 * (1 - q) + 2;
        const s0 = { x: b.x + Math.cos(ang) * rr, y: b.y + Math.sin(ang) * rr };
        circle(s0, 4 + Math.sin(p * 120) * 1.5, { fill: "#fff2a8" });
        circle(s0, 9, { fill: col, opacity: 0.4 });
        for (let k = 1; k < 6; k++) {
          const a2 = ang - k * 0.35;
          const r2 = rr + k * S * 0.02;
          circle({ x: b.x + Math.cos(a2) * r2, y: b.y + Math.sin(a2) * r2 }, 2, { fill: col, opacity: 0.8 - k * 0.14 });
        }
      }
      burst(clamp01((p - land) / (1 - land)), { bits: 10, flash: "#ffd0c0", size: 1.2 });
      break;
    }
  }
  return out;
}
