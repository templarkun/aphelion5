/**
 * Orbital Claim: the planet (designer 2026-11-19: "the same planet from the intro"). The ground's
 * colours, clouds and lava rifts are the intro's own (`groundAt` in briefing/styles/intro2/planet.ts),
 * and its air glows the same way; here the camera moves, so each frame works out, for every point
 * of a small picture of the screen, where its line of sight meets the globe and how that place is lit.
 *
 * The world is in units of about one ship length / 17: the liberated sector S is at the origin,
 * y is up there, x is the way the Flagship heads, z to its starboard; the planet's middle is RP
 * below S. The ground picture covers the part of the globe round S that the film ever shows (a
 * gnomonic map: a point's place in it is two divisions, no angles), made once and kept. Looks only.
 */

import { airColour, groundAt, soft } from "../../briefing/styles/intro2/planet.js";
import { lerp, smooth, type V3 } from "../../briefing/styles/intro2/math3.js";

/** The planet's radius, world units. */
export const RP = 1500;
/** The ground picture reaches this far from S: tan of the angle (0.35 = about 19 degrees, past every edge the film shows). */
const SPAN = 0.35;
/** Its size when finished, and the first quick one. */
const TEX = 512;
const QUICK = 128;
/** Where S lies on the intro's globe (its own longitude and latitude, degrees): among the lava rifts, as a battlefield. */
const S_LON = 16;
const S_LAT = 26;

const DEG = Math.PI / 180;

/** The camera, in world units. */
export interface GlobeCam {
  pos: V3;
  r: V3;
  d: V3;
  f: V3;
  focal: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** A world point in the planet's own frame (radius 1, middle at 0). */
export const toPlanet = (p: V3): V3 => [p[0] / RP, p[1] / RP + 1, p[2] / RP];
/** The world point on the ground (lifted `lift` units) under the place (a, b) of S's tangent plane. */
export function groundPoint(a: number, b: number, lift = 0, out: V3 = [0, 0, 0]): V3 {
  const x = a / RP;
  const z = b / RP;
  const l = (RP + lift) / Math.sqrt(x * x + 1 + z * z);
  out[0] = x * l;
  out[1] = l - RP;
  out[2] = z * l;
  return out;
}
/** Does the ground at world point p face the camera (not beyond the edge of the globe)? */
export function facing(cam: GlobeCam, p: V3): boolean {
  const nx = p[0];
  const ny = p[1] + RP;
  const nz = p[2];
  return nx * (cam.pos[0] - p[0]) + ny * (cam.pos[1] - p[1]) + nz * (cam.pos[2] - p[2]) > 0;
}

interface Tex {
  n: number;
  /** RGB and lava glow (A), n x n. */
  data: Uint8ClampedArray;
}
let quick: Tex | undefined;
let full: Tex | undefined;
let making: { row: number; data: Uint8ClampedArray } | undefined;

/** The intro globe's point for our planet's unit vector (x, y, z): S's frame turned onto (S_LON, S_LAT). */
const lo = S_LON * DEG;
const la = S_LAT * DEG;
const S0: V3 = [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
const EAST: V3 = [-Math.sin(lo), 0, Math.cos(lo)];
const NORTH: V3 = [-Math.sin(la) * Math.cos(lo), Math.cos(la), -Math.sin(la) * Math.sin(lo)];

function texRows(n: number, data: Uint8ClampedArray, from: number, until: number): number {
  const col: V3 = [0, 0, 0];
  let row = from;
  for (; row < n; row++) {
    const v = ((row + 0.5) / n) * 2 * SPAN - SPAN;
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n) * 2 * SPAN - SPAN;
      const l = 1 / Math.sqrt(u * u + 1 + v * v);
      const x = u * l;
      const y = l;
      const z = v * l;
      const px = y * S0[0] + x * EAST[0] + z * NORTH[0];
      const py = y * S0[1] + x * EAST[1] + z * NORTH[1];
      const pz = y * S0[2] + x * EAST[2] + z * NORTH[2];
      const lava = groundAt(px, py, pz, col);
      const o = (row * n + i) * 4;
      data[o] = col[0];
      data[o + 1] = col[1];
      data[o + 2] = col[2];
      data[o + 3] = lava * 255;
    }
    if (performance.now() > until) return row + 1;
  }
  return row;
}

/** The quick ground picture made smoothly bigger (colour and lava glow apart, so the glow does not darken the colour), so it shows no blocks. */
function enlarge(src: Tex, n: number): Tex {
  if (typeof document === "undefined") return src;
  const m = src.n;
  const rgb = new ImageData(m, m);
  const glow = new ImageData(m, m);
  for (let i = 0; i < m * m * 4; i += 4) {
    rgb.data[i] = src.data[i]!;
    rgb.data[i + 1] = src.data[i + 1]!;
    rgb.data[i + 2] = src.data[i + 2]!;
    rgb.data[i + 3] = 255;
    glow.data[i] = glow.data[i + 1] = glow.data[i + 2] = src.data[i + 3]!;
    glow.data[i + 3] = 255;
  }
  const big = (img: ImageData): Uint8ClampedArray => {
    const c0 = document.createElement("canvas");
    c0.width = c0.height = m;
    c0.getContext("2d")!.putImageData(img, 0, 0);
    const c1 = document.createElement("canvas");
    c1.width = c1.height = n;
    const g1 = c1.getContext("2d", { willReadFrequently: true })!;
    g1.imageSmoothingEnabled = true;
    g1.imageSmoothingQuality = "high";
    g1.drawImage(c0, 0, 0, n, n);
    return g1.getImageData(0, 0, n, n).data;
  };
  const a = big(rgb);
  const b = big(glow);
  for (let i = 3; i < a.length; i += 4) a[i] = b[i - 3]!;
  return { n, data: a };
}

/** Make the ground pictures: the quick one at once, then the full one a little at a time. True when finished. */
export function prepareGround(budget: number): boolean {
  if (full) return true;
  if (!quick) {
    const data = new Uint8ClampedArray(QUICK * QUICK * 4);
    texRows(QUICK, data, 0, Infinity);
    quick = enlarge({ n: QUICK, data }, TEX / 2);
  }
  making ??= { row: 0, data: new Uint8ClampedArray(TEX * TEX * 4) };
  making.row = texRows(TEX, making.data, making.row, performance.now() + budget);
  if (making.row >= TEX) {
    full = { n: TEX, data: making.data };
    making = undefined;
    return true;
  }
  return false;
}

/** Light tables, by the sun's height at a place (the sine, -1..1 in 1024 steps). */
const STEPS = 1024;
const LIGHT = new Float32Array(STEPS * 3);
const NIGHT = new Float32Array(STEPS);
/** The air in front of the ground, by the sun's height and by how slantwise it is seen (64 steps). */
const EDGES = 64;
const AIR = new Float32Array(STEPS * EDGES * 3);
{
  const col: V3 = [0, 0, 0];
  for (let i = 0; i < STEPS; i++) {
    const day = (i / (STEPS - 1)) * 2 - 1;
    // Sunlight: red and weak at first light, white higher up. A little starlight everywhere (as the intro).
    const sl = smooth(-0.04, 0.24, day) * 1.3;
    const high = smooth(0.0, 0.3, day);
    LIGHT[i * 3] = sl + 0.085;
    LIGHT[i * 3 + 1] = sl * lerp(0.42, 0.95, high) + 0.115;
    LIGHT[i * 3 + 2] = sl * lerp(0.18, 0.86, high) + 0.2;
    NIGHT[i] = 1 - smooth(-0.12, 0.02, day);
    for (let e = 0; e < EDGES; e++) {
      const mu = 1 - e / (EDGES - 1);
      const edge = Math.pow(1 - mu, 3);
      const k = airColour(day, 0.55 * (1 - edge), col) * (0.05 + 0.95 * edge);
      const glow = Math.pow(1 - mu, 5) * 0.085;
      const o = (i * EDGES + e) * 3;
      AIR[o] = 255 * soft(col[0] * k + glow * 0.2);
      AIR[o + 1] = 255 * soft(col[1] * k + glow * 0.62);
      AIR[o + 2] = 255 * soft(col[2] * k + glow);
    }
  }
}

export interface Globe {
  /** Draw the globe and its air for this camera (world units); `sun` is the way to the sun; `budget` points at most in the small picture. */
  draw(g: CanvasRenderingContext2D, cam: GlobeCam, sun: V3, budget: number): void;
}

export function createGlobe(): Globe {
  let gbuf: HTMLCanvasElement | undefined;
  let abuf: HTMLCanvasElement | undefined;
  let gimg: ImageData | undefined;
  let aimg: ImageData | undefined;
  const col: V3 = [0, 0, 0];

  function buffers(bw: number, bh: number): void {
    if (gbuf && gbuf.width === bw && gbuf.height === bh) return;
    gbuf ??= document.createElement("canvas");
    abuf ??= document.createElement("canvas");
    gbuf.width = abuf.width = bw;
    gbuf.height = abuf.height = bh;
    gimg = gbuf.getContext("2d")!.createImageData(bw, bh);
    aimg = abuf.getContext("2d")!.createImageData(bw, bh);
  }

  return {
    draw(g, cam, sun, budget) {
      const tex = full ?? quick;
      const scale = Math.min(0.6, Math.sqrt(budget / (cam.w * cam.h)));
      const bw = Math.max(8, Math.round(cam.w * scale));
      const bh = Math.max(8, Math.round(cam.h * scale));
      buffers(bw, bh);
      const gd = gimg!.data;
      const ad = aimg!.data;
      gd.fill(0);
      ad.fill(0);
      const P = toPlanet(cam.pos);
      const P2 = P[0] * P[0] + P[1] * P[1] + P[2] * P[2];
      const c2 = P2 - 1;
      const { r, d, f } = cam;
      const sx = cam.w / bw / cam.focal;
      const sy = cam.h / bh / cam.focal;
      // The ground picture reaches a little past the true edge (a point's width); the edge is cut sharp later.
      const over = (2.5 * Math.sqrt(Math.max(0, c2))) / (cam.focal * scale);
      const n = tex?.n ?? 1;
      const td = tex?.data;
      const half = n / (2 * SPAN);
      for (let py = 0; py < bh; py++) {
        const dy0 = (py + 0.5) * sy - cam.cy / cam.focal;
        for (let px = 0; px < bw; px++) {
          const dx0 = (px + 0.5) * sx - cam.cx / cam.focal;
          let dx = f[0] + dx0 * r[0] + dy0 * d[0];
          let dy = f[1] + dx0 * r[1] + dy0 * d[1];
          let dz = f[2] + dx0 * r[2] + dy0 * d[2];
          const il = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
          dx *= il;
          dy *= il;
          dz *= il;
          const b = P[0] * dx + P[1] * dy + P[2] * dz;
          if (b >= 0) continue; // looking away from the globe
          // Looking up out of the air the glow of the air fades away (the camera itself is in its upper reaches).
          const up = smooth(0, 0.16, -b / Math.sqrt(P2));
          const disc = b * b - c2;
          const hgt = Math.sqrt(Math.max(0, P2 - b * b)) - 1;
          const o = (py * bw + px) * 4;
          let toSun = dx * sun[0] + dy * sun[1] + dz * sun[2];
          toSun = toSun > 0 ? toSun : 0;
          const q2 = toSun * toSun;
          const q4 = q2 * q2;
          const q8 = q4 * q4;
          const q16 = q8 * q8;
          const fwd = 1 + 1.3 * q16 * q4 * q2;
          if (hgt > -over && hgt < 0.2) {
            // The air seen edge-on, above the edge.
            const hh = hgt > 0 ? hgt : 0;
            if (hh < 0.12) {
              let qx = P[0] - b * dx;
              let qy = P[1] - b * dy;
              let qz = P[2] - b * dz;
              const ql = 1 / Math.sqrt(qx * qx + qy * qy + qz * qz);
              qx *= ql;
              qy *= ql;
              qz *= ql;
              const day = qx * sun[0] + qy * sun[1] + qz * sun[2];
              const lit = airColour(day, smooth(0.002, 0.03, hh), col);
              const warm = 0.85 * q16 * q16 * q8;
              const cr = lerp(col[0], 1.0, warm);
              const cg = lerp(col[1], 0.86, warm);
              const cb = lerp(col[2], 0.62, warm);
              const k = up * lit * fwd * (0.6 * Math.exp(-hh / 0.005) + 0.31 * Math.exp(-hh / 0.02) + 0.09 * Math.exp(-hh / 0.075));
              const glow = up * 0.085 * Math.exp(-hh / 0.006);
              const rr = soft(cr * k + glow * 0.2);
              const gg = soft(cg * k + glow * 0.62);
              const bb = soft(cb * k + glow);
              const mx = Math.max(rr, gg, bb, 1e-4);
              ad[o] = (rr / mx) * 255;
              ad[o + 1] = (gg / mx) * 255;
              ad[o + 2] = (bb / mx) * 255;
              ad[o + 3] = mx * 255;
            }
          }
          if (disc >= 0 || hgt < over) {
            const s = disc >= 0 ? -b - Math.sqrt(disc) : -b;
            let nx = P[0] + s * dx;
            let ny = P[1] + s * dy;
            let nz = P[2] + s * dz;
            const nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
            nx *= nl;
            ny *= nl;
            nz *= nl;
            const day = nx * sun[0] + ny * sun[1] + nz * sun[2];
            const di = Math.round((day + 1) * 0.5 * (STEPS - 1));
            const mu = -(dx * nx + dy * ny + dz * nz);
            const ei = Math.round((1 - (mu > 0 ? mu : 0)) * (EDGES - 1));
            let tr = 40;
            let tg = 40;
            let tb = 46;
            let lava = 0;
            if (td && ny > 0.9) {
              let iu = ((nx / ny) * half + n / 2) | 0;
              let iv = ((nz / ny) * half + n / 2) | 0;
              iu = iu < 0 ? 0 : iu >= n ? n - 1 : iu;
              iv = iv < 0 ? 0 : iv >= n ? n - 1 : iv;
              const ti = (iv * n + iu) * 4;
              tr = td[ti]!;
              tg = td[ti + 1]!;
              tb = td[ti + 2]!;
              lava = td[ti + 3]! * NIGHT[di]!;
            }
            const ai = (di * EDGES + ei) * 3;
            gd[o] = tr * LIGHT[di * 3]! + AIR[ai]! * fwd + lava * 0.5;
            gd[o + 1] = tg * LIGHT[di * 3 + 1]! + AIR[ai + 1]! * fwd + lava * 0.15;
            gd[o + 2] = tb * LIGHT[di * 3 + 2]! + AIR[ai + 2]! * fwd + lava * 0.03;
            gd[o + 3] = 255;
          }
        }
      }
      abuf!.getContext("2d")!.putImageData(aimg!, 0, 0);
      gbuf!.getContext("2d")!.putImageData(gimg!, 0, 0);

      // The edge of the globe: the circle where the lines of sight graze it.
      const limb = limbRuns(cam, P, P2, sun);
      g.save();
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.globalCompositeOperation = "lighter";
      g.drawImage(abuf!, 0, 0, cam.w, cam.h);
      g.globalCompositeOperation = "source-over";
      g.save();
      if (limb.runs.length) {
        g.beginPath();
        for (const run of limb.runs) {
          g.moveTo(run[0]!.x, run[0]!.y);
          for (let i = 1; i < run.length; i++) g.lineTo(run[i]!.x, run[i]!.y);
          g.lineTo(limb.cx, limb.cy);
          g.closePath();
        }
        g.clip();
      }
      g.drawImage(gbuf!, 0, 0, cam.w, cam.h);
      g.restore();
      // A thin bright thread along the edge: gold towards the sun, faint blue round the night side.
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      for (const run of limb.runs) {
        for (let i = 2; i < run.length; i += 2) {
          const p = run[i - 2]!;
          const q = run[i]!;
          if (Math.max(p.x, q.x) < -8 || Math.min(p.x, q.x) > cam.w + 8 || Math.max(p.y, q.y) < -8 || Math.min(p.y, q.y) > cam.h + 8) continue;
          const k = airColour((p.day + q.day) / 2, 0, col);
          const a = 0.08 + 0.5 * k;
          g.strokeStyle = `rgb(${Math.round(lerp(110, 255 * Math.min(1, col[0] * 1.5), k))} ${Math.round(lerp(180, 255 * Math.min(1, col[1] * 1.45), k))} ${Math.round(lerp(235, 255 * Math.min(1, col[2] * 1.3 + 0.25), k))} / ${a.toFixed(3)})`;
          g.lineWidth = 0.8 + 0.8 * k;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(q.x, q.y);
          g.stroke();
        }
      }
      g.restore();
    },
  };
}

/** The edge of the globe in the picture: runs of points (and the sun's height there), and the globe's middle in the picture. */
function limbRuns(cam: GlobeCam, P: V3, P2: number, sun: V3): { runs: { x: number; y: number; day: number }[][]; cx: number; cy: number } {
  const runs: { x: number; y: number; day: number }[][] = [];
  const inv = 1 / P2;
  // The circle's middle and radius (planet frame), and two directions across it.
  const m: V3 = [P[0] * inv, P[1] * inv, P[2] * inv];
  const rad = Math.sqrt(Math.max(0, 1 - inv));
  const pl = Math.sqrt(P2);
  const k: V3 = [P[0] / pl, P[1] / pl, P[2] / pl];
  const ref: V3 = Math.abs(k[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let ax: V3 = [k[1] * ref[2] - k[2] * ref[1], k[2] * ref[0] - k[0] * ref[2], k[0] * ref[1] - k[1] * ref[0]];
  const al = Math.hypot(ax[0], ax[1], ax[2]);
  ax = [ax[0] / al, ax[1] / al, ax[2] / al];
  const bx: V3 = [k[1] * ax[2] - k[2] * ax[1], k[2] * ax[0] - k[0] * ax[2], k[0] * ax[1] - k[1] * ax[0]];
  const see = (q: V3): [number, number, number] => {
    // Planet frame -> world -> camera.
    const wx = q[0] * RP - cam.pos[0];
    const wy = (q[1] - 1) * RP - cam.pos[1];
    const wz = q[2] * RP - cam.pos[2];
    const z = wx * cam.f[0] + wy * cam.f[1] + wz * cam.f[2];
    return [cam.cx + (cam.focal * (wx * cam.r[0] + wy * cam.r[1] + wz * cam.r[2])) / z, cam.cy + (cam.focal * (wx * cam.d[0] + wy * cam.d[1] + wz * cam.d[2])) / z, z];
  };
  let run: { x: number; y: number; day: number }[] = [];
  const N = 1440;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const ca = Math.cos(a) * rad;
    const sa = Math.sin(a) * rad;
    const q: V3 = [m[0] + ax[0] * ca + bx[0] * sa, m[1] + ax[1] * ca + bx[1] * sa, m[2] + ax[2] * ca + bx[2] * sa];
    const [x, y, z] = see(q);
    if (!(z > 0.5 && x > -2 * cam.w && x < 3 * cam.w && y > -2 * cam.h && y < 3 * cam.h)) {
      if (run.length > 1) runs.push(run);
      run = [];
      continue;
    }
    run.push({ x, y, day: q[0] * sun[0] + q[1] * sun[1] + q[2] * sun[2] });
  }
  if (run.length > 1) runs.push(run);
  // The clip is closed far off on the globe's side of its edge (the ground picture is empty outside
  // the globe anyway): towards the globe's middle as seen from the camera.
  const ox = -cam.pos[0];
  const oy = -RP - cam.pos[1];
  const oz = -cam.pos[2];
  const X = ox * cam.r[0] + oy * cam.r[1] + oz * cam.r[2];
  const Y = ox * cam.d[0] + oy * cam.d[1] + oz * cam.d[2];
  const Z = ox * cam.f[0] + oy * cam.f[1] + oz * cam.f[2];
  const far = 20 * (cam.w + cam.h);
  const first = runs[0];
  const mid = first ? first[first.length >> 1]! : { x: cam.cx, y: cam.cy };
  let dx = X;
  let dy = Y;
  if (Z > RP * 0.05) {
    dx = cam.cx + (cam.focal * X) / Z - mid.x;
    dy = cam.cy + (cam.focal * Y) / Z - mid.y;
  }
  const l = Math.hypot(dx, dy) || 1;
  return { runs, cx: mid.x + (dx / l) * far, cy: mid.y + (dy / l) * far };
}
