/**
 * The intro's space scene, drawn on a 2D canvas: a deep field of stars in three depths, nebula
 * and dust, an alien planet (turning, ringed, lit from the upper left with a glowing rim of
 * atmosphere), and the Company's ship flying from beside the camera towards it on ion trails.
 * As it reaches orbit, telemetry brackets close on the planet. Looks only; no game data.
 *
 * "full": the 10-second approach.  "short": a 1.5-second fly-by for a returning player.
 */

import { noise3 } from "../noise.js";

export const FULL_SECONDS = 10.4;
export const SHORT_SECONDS = 1.5;
/** When the brackets start to close (full intro), for the sound hook and the title. */
export const LOCK_AT = 6.5;
export const TITLE_AT = 7.5;
const ZOOM_AT = 9.3;

const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

/** Small fixed random numbers (the scene looks the same every time). */
function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function fbm(x: number, y: number, z: number, oct: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x * f, y * f, z * f);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

/** The planet's surface as a strip that wraps round: seas, coasts, highlands, ice, cloud bands. */
function planetTexture(): HTMLCanvasElement {
  const W = 512;
  const H = 256;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, H);
  const ramp: [number, number, number, number][] = [
    [-1, 10, 60, 110],
    [-0.12, 14, 116, 160],
    [0.0, 45, 190, 200],
    [0.04, 236, 214, 160],
    [0.12, 196, 120, 190],
    [0.26, 130, 78, 190],
    [0.42, 250, 232, 255],
    [1, 255, 255, 255],
  ];
  for (let y = 0; y < H; y++) {
    const lat = (y / H - 0.5) * Math.PI;
    const cy = Math.cos(lat);
    const sy = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * TAU;
      const px = Math.cos(lon) * cy;
      const pz = Math.sin(lon) * cy;
      let n = fbm(px * 1.7 + 3.1, sy * 1.7, pz * 1.7, 5) + Math.abs(sy) * Math.abs(sy) * 0.28 - 0.04;
      n += 0.04 * Math.sin(lat * 9 + fbm(px * 3, sy * 3, pz * 3, 2) * 4);
      let k = 0;
      while (k < ramp.length - 2 && n > ramp[k + 1]![0]) k++;
      const a = ramp[k]!;
      const b = ramp[k + 1]!;
      const t = clamp((n - a[0]) / (b[0] - a[0]));
      let r = lerp(a[1], b[1], t);
      let gr = lerp(a[2], b[2], t);
      let bl = lerp(a[3], b[3], t);
      // Clouds: long bands pulled along the latitude.
      const cl = clamp(fbm(px * 2.2 + 9, sy * 6.5, pz * 2.2, 4) * 2.4 + 0.1);
      r = lerp(r, 255, cl * 0.8);
      gr = lerp(gr, 255, cl * 0.8);
      bl = lerp(bl, 255, cl * 0.8);
      const i = (y * W + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gr;
      img.data[i + 2] = bl;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  ph: number;
  col: string;
}
interface Puff {
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
}

export interface Scene {
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, mode: "full" | "short"): void;
}

export function createScene(): Scene {
  const R = rng(4242);
  const cols = ["255 255 255", "190 227 255", "255 236 179", "224 215 255"];
  const stars: Star[] = Array.from({ length: 380 }, (_, i) => ({ x: R(), y: R(), z: i < 220 ? 0.2 : i < 330 ? 0.5 : 1, r: 0.4 + R() * 1.3, ph: R() * TAU, col: cols[Math.floor(R() * cols.length)]! }));
  const dust = Array.from({ length: 36 }, () => ({ a: R() * TAU, d: R(), sp: 0.03 + R() * 0.06, r: 10 + R() * 40 }));
  const nebula: [number, number, number, string][] = [
    [0.18, 0.22, 0.55, "56 189 248"],
    [0.82, 0.78, 0.6, "167 139 250"],
    [0.55, 0.12, 0.42, "45 212 191"],
    [0.1, 0.85, 0.5, "232 121 249"],
    [0.9, 0.2, 0.4, "96 165 250"],
  ];
  let tex: HTMLCanvasElement | undefined;
  const D = 440;
  const disc = document.createElement("canvas");
  disc.width = disc.height = D;
  const dg = disc.getContext("2d")!;
  const trail: Puff[] = [];
  let lastT = 0;

  function drawDisc(rot: number): void {
    tex ??= planetTexture();
    dg.clearRect(0, 0, D, D);
    const half = D / 2;
    for (let x = 0; x < D; x++) {
      const nx = (x + 0.5 - half) / half;
      const hh = Math.sqrt(Math.max(0, 1 - nx * nx)) * half;
      if (hh < 0.5) continue;
      const u = (((Math.asin(nx) / TAU + rot) % 1) + 1) % 1;
      dg.drawImage(tex, Math.floor(u * tex.width), 0, 1, tex.height, x, half - hh, 1, hh * 2);
    }
  }

  function planet(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number): void {
    const tilt = -0.32;
    const ringBand = (front: boolean) => {
      g.save();
      g.translate(cx, cy);
      g.rotate(tilt);
      g.scale(1, 0.2);
      for (const [k, wdt, a, col] of [
        [1.55, 0.12, 0.5, "253 230 190"],
        [1.75, 0.1, 0.34, "216 180 254"],
        [1.95, 0.05, 0.22, "186 230 253"],
        [2.1, 0.02, 0.3, "255 255 255"],
      ] as const) {
        g.strokeStyle = `rgb(${col} / ${a})`;
        g.lineWidth = r * wdt;
        g.beginPath();
        g.arc(0, 0, r * k, front ? 0 : Math.PI, front ? Math.PI : TAU);
        g.stroke();
      }
      g.restore();
    };
    // Atmosphere: a soft halo, brightest towards the light.
    g.globalCompositeOperation = "lighter";
    const halo = g.createRadialGradient(cx - r * 0.12, cy - r * 0.1, r * 0.9, cx, cy, r * 1.28);
    halo.addColorStop(0, "rgb(125 230 255 / 0.55)");
    halo.addColorStop(0.35, "rgb(110 190 255 / 0.2)");
    halo.addColorStop(1, "rgb(110 190 255 / 0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(cx, cy, r * 1.3, 0, TAU);
    g.fill();
    g.globalCompositeOperation = "source-over";
    ringBand(false);
    // The globe, turning slowly on a tilted axis.
    drawDisc(0.2 + t * 0.006);
    g.save();
    g.beginPath();
    g.arc(cx, cy, r * 0.992, 0, TAU);
    g.clip();
    g.translate(cx, cy);
    g.rotate(tilt);
    g.imageSmoothingQuality = "high";
    g.drawImage(disc, -r, -r, r * 2, r * 2);
    g.restore();
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.clip();
    // Night side.
    const night = g.createRadialGradient(cx - r * 0.5, cy - r * 0.42, r * 0.25, cx - r * 0.12, cy - r * 0.1, r * 1.35);
    night.addColorStop(0, "rgb(255 255 255 / 0.1)");
    night.addColorStop(0.45, "rgb(10 20 60 / 0)");
    night.addColorStop(0.8, "rgb(8 12 48 / 0.72)");
    night.addColorStop(1, "rgb(6 8 36 / 0.92)");
    g.fillStyle = night;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Rim light inside the edge.
    const rim = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, r);
    rim.addColorStop(0, "rgb(140 230 255 / 0)");
    rim.addColorStop(1, "rgb(170 240 255 / 0.5)");
    g.fillStyle = rim;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
    // A bright arc on the lit limb.
    g.strokeStyle = "rgb(220 250 255 / 0.85)";
    g.lineWidth = Math.max(1, r * 0.012);
    g.beginPath();
    g.arc(cx, cy, r, Math.PI * 0.86, Math.PI * 1.62);
    g.stroke();
    ringBand(true);
    // A small moon.
    const ma = 2.4 + t * 0.05;
    const mx = cx + Math.cos(ma) * r * 2.6;
    const my = cy + Math.sin(ma) * r * 0.8 - r * 0.5;
    const mr = r * 0.09;
    const mg = g.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
    mg.addColorStop(0, "#f5f3ff");
    mg.addColorStop(0.6, "#a5b4fc");
    mg.addColorStop(1, "#312e81");
    g.fillStyle = mg;
    g.beginPath();
    g.arc(mx, my, mr, 0, TAU);
    g.fill();
  }

  /** The ship, nose towards +x, about one unit long. */
  function ship(g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, t: number): void {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.scale(len, len);
    // Ion exhaust: two long tapering flames.
    g.globalCompositeOperation = "lighter";
    const flick = 0.9 + 0.1 * Math.sin(t * 40);
    for (const ey of [-0.045, 0.045]) {
      const fl = g.createLinearGradient(-0.46, 0, -0.46 - 1.5 * flick, 0);
      fl.addColorStop(0, "rgb(255 255 255 / 0.95)");
      fl.addColorStop(0.08, "rgb(125 240 255 / 0.8)");
      fl.addColorStop(0.4, "rgb(56 189 248 / 0.3)");
      fl.addColorStop(1, "rgb(99 102 241 / 0)");
      g.fillStyle = fl;
      g.beginPath();
      g.moveTo(-0.46, ey - 0.028);
      g.quadraticCurveTo(-1, ey - 0.02, -0.46 - 1.5 * flick, ey);
      g.quadraticCurveTo(-1, ey + 0.02, -0.46, ey + 0.028);
      g.fill();
      const gl = g.createRadialGradient(-0.47, ey, 0, -0.47, ey, 0.13);
      gl.addColorStop(0, "rgb(255 255 255 / 0.9)");
      gl.addColorStop(0.3, "rgb(125 240 255 / 0.5)");
      gl.addColorStop(1, "rgb(56 189 248 / 0)");
      g.fillStyle = gl;
      g.beginPath();
      g.arc(-0.47, ey, 0.13, 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
    // Wings behind the hull.
    const wing = g.createLinearGradient(0, -0.26, 0, 0.22);
    wing.addColorStop(0, "#93a5c9");
    wing.addColorStop(0.5, "#33405f");
    wing.addColorStop(1, "#1b2440");
    g.fillStyle = wing;
    g.beginPath();
    g.moveTo(0.04, -0.05);
    g.lineTo(-0.3, -0.27);
    g.lineTo(-0.41, -0.26);
    g.lineTo(-0.32, -0.06);
    g.closePath();
    g.moveTo(0.02, 0.045);
    g.lineTo(-0.28, 0.21);
    g.lineTo(-0.38, 0.2);
    g.lineTo(-0.3, 0.055);
    g.closePath();
    g.fill();
    // Hull.
    const hull = g.createLinearGradient(0, -0.08, 0, 0.08);
    hull.addColorStop(0, "#e2e8f5");
    hull.addColorStop(0.35, "#8fa0c4");
    hull.addColorStop(1, "#27324f");
    g.fillStyle = hull;
    g.beginPath();
    g.moveTo(0.5, 0);
    g.quadraticCurveTo(0.26, -0.05, -0.08, -0.072);
    g.lineTo(-0.4, -0.078);
    g.lineTo(-0.47, -0.05);
    g.lineTo(-0.47, 0.05);
    g.lineTo(-0.4, 0.078);
    g.lineTo(-0.08, 0.062);
    g.quadraticCurveTo(0.26, 0.036, 0.5, 0);
    g.closePath();
    g.fill();
    // Rim light along the top, cockpit and running lights.
    g.strokeStyle = "rgb(255 255 255 / 0.85)";
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(0.5, 0);
    g.quadraticCurveTo(0.26, -0.05, -0.08, -0.072);
    g.lineTo(-0.4, -0.078);
    g.moveTo(0.04, -0.05);
    g.lineTo(-0.3, -0.27);
    g.lineTo(-0.41, -0.26);
    g.stroke();
    g.fillStyle = "#7dd3fc";
    g.beginPath();
    g.moveTo(0.3, -0.018);
    g.quadraticCurveTo(0.2, -0.05, 0.08, -0.05);
    g.lineTo(0.1, -0.024);
    g.closePath();
    g.fill();
    g.fillStyle = "#fde68a";
    for (const lx of [-0.05, -0.15, -0.25]) g.fillRect(lx, 0.005, 0.03, 0.012);
    g.restore();
  }

  function brackets(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number, k: number, fade: number): void {
    // k: 0 wide open, 1 closed on the planet.
    const half = r * lerp(2.3, 1.22, easeBack(k));
    const arm = half * 0.24;
    g.save();
    g.globalAlpha = clamp(k * 3) * fade;
    g.strokeStyle = "#a5f3fc";
    g.fillStyle = "#e0faff";
    g.shadowColor = "rgb(34 211 238 / 0.9)";
    g.shadowBlur = 8;
    g.lineWidth = 2;
    g.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      g.moveTo(cx + sx * half, cy + sy * (half - arm));
      g.lineTo(cx + sx * half, cy + sy * half);
      g.lineTo(cx + sx * (half - arm), cy + sy * half);
    }
    g.stroke();
    // A turning dashed ring and four ticks.
    g.lineWidth = 1.2;
    g.setLineDash([half * 0.16, half * 0.07]);
    g.lineDashOffset = -t * 30;
    g.beginPath();
    g.arc(cx, cy, half * 0.94, 0, TAU);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.moveTo(cx + Math.cos(a) * half * 1.02, cy + Math.sin(a) * half * 1.02);
      g.lineTo(cx + Math.cos(a) * half * 1.12, cy + Math.sin(a) * half * 1.12);
    }
    g.stroke();
    // Telemetry beside the brackets, once they are closed.
    const on = seg(k, 0.75, 1);
    if (on > 0) {
      g.globalAlpha = on * fade;
      g.shadowBlur = 4;
      const fs = Math.max(11, Math.min(15, r * 0.085));
      g.font = `600 ${fs}px ui-monospace, Menlo, Consolas, monospace`;
      g.textBaseline = "top";
      // Beside the brackets where there is room: right, else left, else above (never under the title).
      const wide = fs * 12.5;
      const room = g.canvas.clientWidth;
      let tx = cx + half + 16;
      let ty = cy - half;
      if (tx + wide > room) {
        if (cx - half - 16 - wide > 0) tx = cx - half - 16 - wide;
        else {
          tx = Math.max(10, cx - half);
          ty = cy - half - fs * 1.45 * 4 - 10;
        }
      }
      const range = Math.round(lerp(18400, 420, easeOut(seg(t, LOCK_AT, ZOOM_AT + 0.6))));
      const rows = ["ORBIT LOCK", `RANGE  ${range.toLocaleString("en-US").replace(/,/g, " ")} km`, "VECTOR  STABLE", "INSERTION  GO"];
      rows.forEach((s, i) => {
        if (i === 0) g.fillStyle = "#fde68a";
        else g.fillStyle = "#e0faff";
        g.fillText(s, tx, ty + i * fs * 1.45);
      });
    }
    g.restore();
  }

  function backdrop(g: CanvasRenderingContext2D, w: number, h: number, t: number, drift: number, streak: number): void {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#0b1238");
    bg.addColorStop(0.5, "#141d55");
    bg.addColorStop(1, "#2a1857");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    const m = Math.max(w, h);
    for (const [nx, ny, nr, col] of nebula) {
      const x = (nx - drift * 0.05) * w;
      const y = ny * h;
      const grd = g.createRadialGradient(x, y, 0, x, y, nr * m);
      grd.addColorStop(0, `rgb(${col} / 0.2)`);
      grd.addColorStop(0.5, `rgb(${col} / 0.07)`);
      grd.addColorStop(1, `rgb(${col} / 0)`);
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    }
    // The sun, off the upper left corner.
    const sun = g.createRadialGradient(w * 0.04, h * 0.06, 0, w * 0.04, h * 0.06, m * 0.5);
    sun.addColorStop(0, "rgb(255 250 235 / 0.9)");
    sun.addColorStop(0.05, "rgb(255 236 190 / 0.45)");
    sun.addColorStop(0.3, "rgb(255 220 170 / 0.08)");
    sun.addColorStop(1, "rgb(255 220 170 / 0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    for (const s of stars) {
      const x = ((((s.x - drift * s.z * 0.25) % 1) + 1) % 1) * w;
      const y = s.y * h;
      const a = (0.4 + 0.6 * s.z) * (0.7 + 0.3 * Math.sin(t * (1 + s.z) + s.ph));
      g.fillStyle = `rgb(${s.col} / ${a.toFixed(3)})`;
      const r = s.r * (0.6 + s.z * 0.8);
      if (streak > 0.02) g.fillRect(x, y - r / 2, r + streak * s.z * w * 0.12, r);
      else {
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  function drawTrail(g: CanvasRenderingContext2D, dt: number): void {
    g.globalCompositeOperation = "lighter";
    let wr = 0;
    for (const p of trail) {
      p.age += dt;
      if (p.age >= p.life) continue;
      trail[wr++] = p;
      const k = 1 - p.age / p.life;
      const r = p.r * (1 + (1 - k) * 1.6);
      const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grd.addColorStop(0, `rgb(190 245 255 / ${(0.5 * k).toFixed(3)})`);
      grd.addColorStop(0.4, `rgb(56 189 248 / ${(0.22 * k).toFixed(3)})`);
      grd.addColorStop(1, "rgb(99 102 241 / 0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(p.x, p.y, r, 0, TAU);
      g.fill();
    }
    trail.length = wr;
    g.globalCompositeOperation = "source-over";
  }

  return {
    draw(g, w, h, t, mode) {
      const dt = clamp(t - lastT, 0, 0.05);
      lastT = t;
      const m = Math.min(w, h);
      const tall = h > w * 1.15;
      if (mode === "short") {
        // Fly-by: the planet sweeps in from the right and fills the view.
        const k = ease(seg(t, 0, SHORT_SECONDS));
        backdrop(g, w, h, t, t * 0.5, Math.sin(k * Math.PI) * 0.9);
        const r = m * lerp(0.3, 1.5, k * k);
        const cx = lerp(w * 0.86, w * 0.5, k);
        const cy = lerp(h * 0.42, h * 0.5 + r * 0.55, k);
        planet(g, cx, cy, r, t * 6);
        const sk = seg(t, 0.05, 0.95);
        if (sk < 1) {
          const sx = lerp(-w * 0.15, cx - r * 0.2, easeOut(sk));
          const sy = lerp(h * 0.78, cy - r * 0.95, easeOut(sk));
          const len = m * lerp(0.5, 0.03, easeOut(sk));
          trail.push({ x: sx, y: sy, r: len * 0.1 + 2, age: 0, life: 0.5 });
          drawTrail(g, dt);
          ship(g, sx, sy, Math.atan2(cy - r * 0.95 - h * 0.78, cx - r * 0.2 + w * 0.15), len, t);
        }
        const veil = seg(t, 1.0, SHORT_SECONDS);
        if (veil > 0) {
          g.fillStyle = `rgb(150 215 255 / ${(veil * 0.55).toFixed(3)})`;
          g.fillRect(0, 0, w, h);
        }
        return;
      }

      const zoom = ease(seg(t, ZOOM_AT, FULL_SECONDS));
      const approach = ease(seg(t, 0, 8.6));
      backdrop(g, w, h, t, t * 0.035 + approach * 0.25, zoom * 0.7);
      // Dust drifting past the camera, outwards from where we are heading.
      const px0 = tall ? w * 0.5 : w * 0.66;
      const py0 = tall ? h * 0.36 : h * 0.45;
      g.globalCompositeOperation = "lighter";
      for (const d of dust) {
        const dd = (d.d + t * d.sp) % 1;
        const x = px0 + Math.cos(d.a) * dd * dd * Math.max(w, h) * 0.9;
        const y = py0 + Math.sin(d.a) * dd * dd * Math.max(w, h) * 0.9;
        const r = d.r * (0.3 + dd * 1.4);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, `rgb(186 215 255 / ${(0.07 * Math.sin(dd * Math.PI)).toFixed(3)})`);
        grd.addColorStop(1, "rgb(186 215 255 / 0)");
        g.fillStyle = grd;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = "source-over";

      const r = m * (lerp(0.13, 0.27, approach) + zoom * zoom * 1.6);
      const cx = lerp(px0, w * 0.5, zoom);
      const cy = lerp(py0, h * 0.5 + r * 0.3 * zoom, zoom);
      planet(g, cx, cy, r, t);

      // The ship: from beside the camera (lower left) away towards the planet's left limb.
      const e = seg(t, 0.5, 7.9);
      const depth = 1 + 15 * Math.pow(e, 1.9);
      const sx0 = -w * 0.2;
      const sy0 = h * 1.02;
      const ex = px0 - m * 0.27 * 0.75;
      const ey = py0 + m * 0.27 * 0.1;
      const sx = ex + (sx0 - ex) / depth;
      const sy = ey + (sy0 - ey) / depth;
      const len = (m * 0.95) / depth;
      const fadeShip = 1 - seg(t, 7.6, 8.5);
      if (t > 0.45 && fadeShip > 0) {
        const ang = Math.atan2(ey - sy0, ex - sx0);
        if (dt > 0) trail.push({ x: sx - Math.cos(ang) * len * 0.6, y: sy - Math.sin(ang) * len * 0.6, r: len * 0.16 + 1.5, age: 0, life: 1.5 });
        drawTrail(g, dt);
        g.save();
        g.globalAlpha = fadeShip;
        ship(g, sx, sy, ang, len, t);
        g.restore();
      } else drawTrail(g, dt);
      // In orbit: a glint going round the limb.
      const orbit = seg(t, 7.6, FULL_SECONDS);
      if (orbit > 0 && zoom < 0.6) {
        const a = Math.PI * 1.05 + orbit * 1.3;
        const gx = cx + Math.cos(a) * r * 1.12;
        const gy = cy + Math.sin(a) * r * 0.5 + r * 0.08;
        g.globalCompositeOperation = "lighter";
        const gl = g.createRadialGradient(gx, gy, 0, gx, gy, 9);
        gl.addColorStop(0, `rgb(255 255 255 / ${(0.95 * (1 - zoom)).toFixed(3)})`);
        gl.addColorStop(0.3, "rgb(125 240 255 / 0.5)");
        gl.addColorStop(1, "rgb(125 240 255 / 0)");
        g.fillStyle = gl;
        g.beginPath();
        g.arc(gx, gy, 9, 0, TAU);
        g.fill();
        g.globalCompositeOperation = "source-over";
      }

      const lock = seg(t, LOCK_AT, LOCK_AT + 0.9);
      if (lock > 0) brackets(g, cx, cy, r, t, lock, 1 - zoom);

      // Opening fade from black, closing glow into the command deck.
      const open = 1 - seg(t, 0, 1.1);
      if (open > 0) {
        g.fillStyle = `rgb(5 8 30 / ${open.toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
      if (zoom > 0) {
        g.fillStyle = `rgb(160 220 255 / ${(zoom * 0.5).toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
    },
  };
}
