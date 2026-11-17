/**
 * The Terraformer outro: one terraformer pylon, and the small soft lights the film is painted
 * with. A pylon is a long heavy spike: a blunt heat-shield nose, a shaft with two light bands in
 * the Company's colour, a collar, three anchor fins and an engine bell at the tail. It is drawn
 * between two points of the picture (nose and tail), so it turns and shortens by itself.
 */

import type { CompanyTheme } from "../types.js";

/** A soft round light: white-hot in the middle (core 0..1), the colour round it, nothing at the edge. */
export function softSprite(rgb: string, core: number, size = 96): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const h = size / 2;
  const grd = g.createRadialGradient(h, h, 0, h, h, h);
  grd.addColorStop(0, core > 0 ? `rgb(255 255 255 / ${core})` : `rgb(${rgb} / 0.3)`);
  grd.addColorStop(0.18, `rgb(${rgb} / ${0.25 + core * 0.45})`);
  grd.addColorStop(0.5, `rgb(${rgb} / 0.16)`);
  grd.addColorStop(1, `rgb(${rgb} / 0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return c;
}

/** A flame: bright and narrow at its left end, wide and faint at its right. Drawn stretched along a line. */
export function flameSprite(inner: string, outer: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 48;
  const g = c.getContext("2d")!;
  g.globalCompositeOperation = "lighter";
  for (const [rgb, a, len, wide] of [
    [outer, 0.5, 124, 22],
    [inner, 0.8, 84, 13],
    ["255 255 255", 1, 44, 6],
  ] as const) {
    const grd = g.createLinearGradient(0, 0, len, 0);
    grd.addColorStop(0, `rgb(${rgb} / ${a})`);
    grd.addColorStop(0.35, `rgb(${rgb} / ${a * 0.55})`);
    grd.addColorStop(1, `rgb(${rgb} / 0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, 24 - wide * 0.3);
    g.quadraticCurveTo(len * 0.3, 24 - wide, len, 24);
    g.quadraticCurveTo(len * 0.3, 24 + wide, 0, 24 + wide * 0.3);
    g.closePath();
    g.fill();
  }
  return c;
}

export interface PylonLook {
  theme: CompanyTheme;
  /** How much light falls on it, 0..1 (the bay's lamps, the planet's glow). */
  lit: number;
  /** Its own light bands, 0..1. */
  bands: number;
  /** The engine at its tail, 0..1.6. */
  thrust: number;
  /** How hot its nose glows, 0..1. */
  hot: number;
  /** The flame of its engine (flameSprite). */
  flame: HTMLCanvasElement;
  /** Time, for the flicker. */
  t: number;
}

/** Draw a pylon from its nose (nx, ny) to its tail (tx, ty); r = half its thickness in px. */
export function drawPylon(g: CanvasRenderingContext2D, nx: number, ny: number, tx: number, ty: number, r: number, o: PylonLook): void {
  const L = Math.hypot(tx - nx, ty - ny);
  if (!(L > 0.5) || !(r > 0.05)) return;
  g.save();
  g.translate(nx, ny);
  g.rotate(Math.atan2(ty - ny, tx - nx));
  // The engine's flame, behind the tail.
  if (o.thrust > 0.02) {
    const fl = 0.9 + 0.1 * Math.sin(o.t * 53) + 0.06 * Math.sin(o.t * 91 + 2);
    const len = Math.max(r * 5, L * 0.5) * (0.5 + o.thrust) * fl;
    const wide = r * (2.2 + 1.2 * o.thrust);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = Math.min(1, o.thrust);
    g.drawImage(o.flame, L * 0.97, -wide, len, wide * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  if (L < 9) {
    // Far away: a dark sliver with one light on it.
    g.strokeStyle = `rgb(${shade(o.theme.hull, 0.35 + 0.5 * o.lit)})`;
    g.lineWidth = Math.max(1, r * 2);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(L, 0);
    g.stroke();
    if (o.bands > 0.05) {
      g.fillStyle = `rgb(${o.theme.primary} / ${Math.min(1, o.bands)})`;
      g.fillRect(L * 0.4, -Math.max(0.6, r), Math.max(1, L * 0.12), Math.max(1.2, r * 2));
    }
    g.restore();
    return;
  }
  // Fins first (they stand behind the shaft).
  const fin = `rgb(${shade(o.theme.hull, 0.2 + 0.35 * o.lit)})`;
  g.fillStyle = fin;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(L * 0.76, s * r * 0.7);
    g.lineTo(L * 0.9, s * r * 2.3);
    g.lineTo(L * 0.985, s * r * 2.3);
    g.lineTo(L * 0.955, s * r * 0.6);
    g.closePath();
    g.fill();
  }
  // The body.
  const body = g.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, `rgb(${shade(o.theme.hull, 0.9 * (0.25 + 0.75 * o.lit))})`);
  body.addColorStop(0.28, `rgb(${shade(o.theme.hull, 0.62 * (0.3 + 0.7 * o.lit))})`);
  body.addColorStop(0.7, `rgb(${shade(o.theme.hull, 0.2 + 0.2 * o.lit)})`);
  body.addColorStop(1, `rgb(${shade(o.theme.hull, 0.1)})`);
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(L * 0.06, -r * 0.62, L * 0.17, -r * 0.7);
  g.lineTo(L * 0.21, -r * 0.92);
  g.lineTo(L * 0.7, -r * 0.8);
  g.lineTo(L * 0.72, -r * 1.08);
  g.lineTo(L * 0.79, -r * 1.08);
  g.lineTo(L * 0.81, -r * 0.72);
  g.lineTo(L * 0.955, -r * 0.6);
  g.lineTo(L, -r * 0.8);
  g.lineTo(L, r * 0.8);
  g.lineTo(L * 0.955, r * 0.6);
  g.lineTo(L * 0.81, r * 0.72);
  g.lineTo(L * 0.79, r * 1.08);
  g.lineTo(L * 0.72, r * 1.08);
  g.lineTo(L * 0.7, r * 0.8);
  g.lineTo(L * 0.21, r * 0.92);
  g.lineTo(L * 0.17, r * 0.7);
  g.quadraticCurveTo(L * 0.06, r * 0.62, 0, 0);
  g.closePath();
  g.fill();
  // The heat shield: darker, with its joint.
  g.fillStyle = "rgb(8 10 14 / 0.55)";
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(L * 0.06, -r * 0.62, L * 0.17, -r * 0.7);
  g.lineTo(L * 0.17, r * 0.7);
  g.quadraticCurveTo(L * 0.06, r * 0.62, 0, 0);
  g.fill();
  // Plate joints along the shaft.
  if (r > 3) {
    g.strokeStyle = "rgb(0 0 0 / 0.4)";
    g.lineWidth = Math.max(0.6, r * 0.07);
    g.beginPath();
    for (const x of [0.21, 0.34, 0.47, 0.6, 0.7, 0.81]) {
      g.moveTo(L * x, -r * 0.9);
      g.lineTo(L * x, r * 0.9);
    }
    g.stroke();
    // The lit edge.
    g.strokeStyle = `rgb(200 222 255 / ${(0.12 + 0.5 * o.lit).toFixed(3)})`;
    g.lineWidth = Math.max(0.7, r * 0.09);
    g.beginPath();
    g.moveTo(L * 0.02, -r * 0.2);
    g.quadraticCurveTo(L * 0.07, -r * 0.62, L * 0.17, -r * 0.7);
    g.lineTo(L * 0.21, -r * 0.92);
    g.lineTo(L * 0.7, -r * 0.8);
    g.stroke();
  }
  // The Company's light bands.
  if (o.bands > 0.02) {
    g.globalCompositeOperation = "lighter";
    const a = Math.min(1, o.bands);
    g.fillStyle = `rgb(${o.theme.primary} / ${a.toFixed(3)})`;
    g.fillRect(L * 0.255, -r * 0.88, Math.max(1, L * 0.022), r * 1.76);
    g.fillRect(L * 0.64, -r * 0.8, Math.max(1, L * 0.022), r * 1.6);
    g.fillRect(L * 0.3, -r * 0.1, L * 0.3, Math.max(1, r * 0.2));
    g.fillStyle = `rgb(${o.theme.secondary} / ${a.toFixed(3)})`;
    g.fillRect(L * 0.73, -r * 1.05, L * 0.05, r * 2.1);
    if (r > 2.5) {
      g.shadowColor = `rgb(${o.theme.primary})`;
      g.shadowBlur = r * 2.2;
      g.fillStyle = `rgb(${o.theme.primary} / ${(a * 0.7).toFixed(3)})`;
      g.fillRect(L * 0.3, -r * 0.1, L * 0.3, Math.max(1, r * 0.2));
      g.shadowBlur = 0;
    }
    g.globalCompositeOperation = "source-over";
  }
  // The nose glowing with the heat of the air.
  if (o.hot > 0.02) {
    g.globalCompositeOperation = "lighter";
    const heat = g.createLinearGradient(0, 0, L * 0.5, 0);
    heat.addColorStop(0, `rgb(255 244 214 / ${Math.min(1, o.hot).toFixed(3)})`);
    heat.addColorStop(0.3, `rgb(255 150 60 / ${(0.7 * Math.min(1, o.hot)).toFixed(3)})`);
    heat.addColorStop(1, "rgb(255 60 20 / 0)");
    g.fillStyle = heat;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(L * 0.06, -r * 0.62, L * 0.17, -r * 0.7);
    g.lineTo(L * 0.21, -r * 0.92);
    g.lineTo(L * 0.5, -r * 0.84);
    g.lineTo(L * 0.5, r * 0.84);
    g.lineTo(L * 0.21, r * 0.92);
    g.lineTo(L * 0.17, r * 0.7);
    g.quadraticCurveTo(L * 0.06, r * 0.62, 0, 0);
    g.fill();
    g.globalCompositeOperation = "source-over";
  }
  g.restore();
}

/** A colour "r g b" made darker or lighter (k = 1 leaves it). */
export function shade(rgb: string, k: number): string {
  const [r, gr, b] = rgb.split(" ").map(Number);
  const c = (v: number | undefined) => Math.max(0, Math.min(255, Math.round((v ?? 0) * k)));
  return `${c(r)} ${c(gr)} ${c(b)}`;
}
/** Two colours mixed: t = 0 gives a, 1 gives b. */
export function mixRgb(a: string, b: string, t: number): string {
  const x = a.split(" ").map(Number);
  const y = b.split(" ").map(Number);
  return [0, 1, 2].map((i) => Math.round((x[i] ?? 0) + ((y[i] ?? 0) - (x[i] ?? 0)) * t)).join(" ");
}
