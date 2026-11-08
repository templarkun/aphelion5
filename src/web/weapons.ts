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

export type Look = "laser" | "tractor" | "scan" | "bolt" | "beam" | "field";

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
  if (src.what !== "module") return "laser";
  return src.colour === "Yellow" ? "bolt" : src.colour === "Red" ? "beam" : "field";
}

const colourOf = (src: Source, look: Look): string => {
  if (src.what === "module") return COLOUR[src.colour ?? ""] ?? "#ffffff";
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
  const ms = { laser: 380, tractor: 360, scan: 520, bolt: 280, beam: 420, field: 460 }[look];
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
