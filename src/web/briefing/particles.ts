/**
 * Light particle effects of the briefing and the Threat screen: bursts (a tap, a selection, a
 * Threat column added) and small emitters round a selected card. One list of particles, drawn by
 * FxLayer on one canvas above the page (it never takes a tap). Looks only; with reduced motion
 * nothing is made.
 */

import { isStill } from "../motion.js";

export type Shape = "spark" | "mote" | "ember" | "ring" | "streak";
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rgb: string;
  shape: Shape;
  /** Speed kept per second (1 = no drag). */
  drag: number;
  /** Pull downwards (negative: rises), px/s². */
  grav: number;
  /** Rings: growth in px/s. */
  grow: number;
}

export const particles: Particle[] = [];
const MAX = 700;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export interface BurstOptions {
  count?: number;
  /** "r g b", as the accent colour is written. */
  rgb?: string;
  speed?: number;
  life?: number;
  size?: number;
  shape?: Shape;
  /** Direction (radians, 0 = right) and how wide the fan is; default all round. */
  angle?: number;
  spread?: number;
  grav?: number;
  drag?: number;
  /** Start somewhere inside this box round the point instead of at the point. */
  box?: [number, number];
}

export function burst(x: number, y: number, o: BurstOptions = {}): void {
  if (isStill()) return;
  const n = o.count ?? 14;
  for (let i = 0; i < n && particles.length < MAX; i++) {
    const a = (o.angle ?? 0) + rnd(-0.5, 0.5) * (o.spread ?? Math.PI * 2);
    const v = (o.speed ?? 160) * rnd(0.35, 1);
    particles.push({
      x: x + (o.box ? rnd(-0.5, 0.5) * o.box[0] : 0),
      y: y + (o.box ? rnd(-0.5, 0.5) * o.box[1] : 0),
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      age: 0,
      life: (o.life ?? 0.7) * rnd(0.6, 1.2),
      size: (o.size ?? 2.2) * rnd(0.6, 1.3),
      rgb: o.rgb ?? "125 211 252",
      shape: o.shape ?? "spark",
      drag: o.drag ?? 0.12,
      grav: o.grav ?? 0,
      grow: 0,
    });
  }
}

/** A ring of light that widens and fades. */
export function ring(x: number, y: number, rgb: string, grow = 260, life = 0.6, size = 6): void {
  if (isStill() || particles.length >= MAX) return;
  particles.push({ x, y, vx: 0, vy: 0, age: 0, life, size, rgb, shape: "ring", drag: 1, grav: 0, grow });
}

const centre = (el: Element): [number, number, DOMRect] => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2, r];
};

/** A small burst from the middle of something on the page (a tapped card or button). */
export function burstFrom(el: Element | null | undefined, o: BurstOptions = {}): void {
  if (!el) return;
  const [x, y] = centre(el);
  burst(x, y, o);
}

/** Sparks running out along the edges of a card: a selection. */
export function sparkEdges(el: Element | null | undefined, rgb: string, count = 26): void {
  if (!el || isStill()) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const [x, y, a] = edgePoint(r);
    burst(x, y, { count: 1, rgb, speed: 70, angle: a, spread: 1.2, life: 0.6, size: 1.8 });
  }
}

/** A point on the edge of a box and the direction pointing out of it. */
function edgePoint(r: DOMRect): [number, number, number] {
  const p = Math.random() * 2 * (r.width + r.height);
  if (p < r.width) return [r.left + p, r.top, -Math.PI / 2];
  if (p < r.width + r.height) return [r.right, r.top + p - r.width, 0];
  if (p < 2 * r.width + r.height) return [r.left + p - r.width - r.height, r.bottom, Math.PI / 2];
  return [r.left, r.top + p - 2 * r.width - r.height, Math.PI];
}

/** Emitters: a steady trickle of particles round an element (the selected card), until removed. */
export type EmitterLook = "grid" | "thruster" | "menace";
interface Emitter {
  el: Element;
  look: EmitterLook;
  rgb: string;
  rate: number;
  owed: number;
}
const emitters = new Map<string, Emitter>();
export function setEmitter(key: string, el: Element | null | undefined, look: EmitterLook = "grid", rgb = "125 211 252", rate = 14): void {
  if (!el) emitters.delete(key);
  else emitters.set(key, { el, look, rgb, rate, owed: emitters.get(key)?.owed ?? 0 });
}

/** Called once per frame by FxLayer. */
export function stepEmitters(dt: number): void {
  if (isStill()) return;
  for (const [key, e] of emitters) {
    if (!e.el.isConnected) {
      emitters.delete(key);
      continue;
    }
    const r = e.el.getBoundingClientRect();
    if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
    e.owed += e.rate * dt;
    while (e.owed >= 1) {
      e.owed -= 1;
      if (e.look === "thruster") {
        // Exhaust glow drifting down from the bottom edge.
        burst(rnd(r.left + r.width * 0.2, r.right - r.width * 0.2), r.bottom - 2, { count: 1, rgb: e.rgb, speed: 46, angle: Math.PI / 2, spread: 0.7, life: 1.1, size: 2.6, shape: "mote", drag: 0.5 });
      } else if (e.look === "menace") {
        // Embers rising from the whole edge.
        const [x, y] = edgePoint(r);
        burst(x, y, { count: 1, rgb: e.rgb, speed: 40, angle: -Math.PI / 2, spread: 1, life: 1.3, size: 2.4, shape: "ember", grav: -60, drag: 0.6 });
      } else {
        // Holographic grid sparks: tiny squares hopping off the edge.
        const [x, y, a] = edgePoint(r);
        burst(x, y, { count: 1, rgb: e.rgb, speed: 34, angle: a, spread: 0.9, life: 0.9, size: 1.9, shape: Math.random() < 0.3 ? "mote" : "spark", drag: 0.3 });
      }
    }
  }
}

/** Move every particle on by dt seconds and drop the dead ones. */
export function stepParticles(dt: number): void {
  let w = 0;
  for (const p of particles) {
    p.age += dt;
    if (p.age >= p.life) continue;
    const k = Math.pow(p.drag, dt);
    p.vx *= k;
    p.vy = p.vy * k + p.grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.shape === "ring") p.size += p.grow * dt;
    particles[w++] = p;
  }
  particles.length = w;
}

export function drawParticles(g: CanvasRenderingContext2D): void {
  g.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const t = p.age / p.life;
    const a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    const c = `rgb(${p.rgb} / ${Math.max(0, a).toFixed(3)})`;
    if (p.shape === "ring") {
      g.strokeStyle = c;
      g.lineWidth = 2.5 * (1 - t) + 0.5;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.stroke();
    } else if (p.shape === "streak") {
      g.strokeStyle = c;
      g.lineWidth = p.size * 0.6;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      g.stroke();
    } else if (p.shape === "mote" || p.shape === "ember") {
      const r = p.size * (p.shape === "ember" ? 1 + (1 - t) : 1.6);
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
      grd.addColorStop(0, `rgb(255 255 255 / ${(a * 0.9).toFixed(3)})`);
      grd.addColorStop(0.3, c);
      grd.addColorStop(1, `rgb(${p.rgb} / 0)`);
      g.fillStyle = grd;
      g.beginPath();
      g.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = c;
      const s = p.size * (1 - t * 0.4);
      g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
  g.globalCompositeOperation = "source-over";
}
