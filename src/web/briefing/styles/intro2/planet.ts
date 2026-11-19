/**
 * Style "intro2": the planet under the ship, seen from low orbit on its night side, looking
 * towards the sunrise. Only the part near the horizon is in daylight; under the camera lie dark
 * deserts, cloud and the glow of lava rifts. The ground slides towards the camera as the ship
 * flies on.
 *
 * How it is drawn (2D canvas, no WebGL): the ground is one picture made once from noise (its
 * colours, cloud and lava), wrapped on the globe. For every point of a small picture of the
 * screen, where its line of sight meets the globe, the light there and the glow of the air are
 * worked out once (when the screen size is known); each frame only looks the ground colour up,
 * a little further along the track. The air's bright edge is then drawn sharp on top.
 * Lengths are in planet radii. Looks only; no game data.
 */

import { noise3 } from "../../../noise.js";
import { clamp, cross, dot, lerp, mul, rng, smooth, sub, TAU, unit, type V3 } from "./math3.js";

const DEG = Math.PI / 180;
/** The piece of the globe the ground picture covers: along the track and across it, degrees. */
const LON0 = -4;
const LON1 = 40;
const LAT0 = -31;
const LAT1 = 31;
/** Ground picture: texels per degree as made, and after it is enlarged. */
const PER_DEG = 9;
const W0 = (LON1 - LON0) * PER_DEG;
const H0 = (LAT1 - LAT0) * PER_DEG;
const UP = 2;
const TW = W0 * UP;
const TH = H0 * UP;
/** How fast the ground slides, degrees a second. */
export const DRIFT = 0.42;

function fbm(x: number, y: number, z: number, oct: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x * f, y * f, z * f);
    a *= 0.5;
    f *= 2.07;
  }
  return v;
}

/** Where lava shows, 0..1, at a point of the globe: thin cracks, in a few regions only. */
function rift(x: number, y: number, z: number): number {
  const region = smooth(0.1, 0.36, fbm(x * 3.1 + 7.3, y * 3.1 + 1.9, z * 3.1 + 4.4, 2));
  if (region <= 0) return 0;
  const a = 1 - Math.abs(noise3(x * 17 + 31.5, y * 17 + 8.2, z * 17 + 2.7));
  const b = 1 - Math.abs(noise3(x * 37 + 3.5, y * 37 + 18.2, z * 37 + 22.7));
  return region * (Math.pow(a, 22) + 0.6 * Math.pow(b, 26));
}

/** The soft glow round the cracks (the ground picture is too coarse to hold the cracks themselves). */
function riftGlow(x: number, y: number, z: number): number {
  const region = smooth(0.1, 0.36, fbm(x * 3.1 + 7.3, y * 3.1 + 1.9, z * 3.1 + 4.4, 2));
  if (region <= 0) return 0;
  const a = 1 - Math.abs(noise3(x * 17 + 31.5, y * 17 + 8.2, z * 17 + 2.7));
  return region * Math.pow(a, 5) * 0.5;
}

const globe = (lonDeg: number, latDeg: number): V3 => {
  const lo = lonDeg * DEG;
  const la = latDeg * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
};

/** The ground picture, made once and kept for every later intro: RGB = colour, A = lava glow. */
let ground: Uint8ClampedArray | undefined;
interface Making {
  row: number;
  rgb: ImageData;
  glow: ImageData;
}
let making: Making | undefined;

const RAMP: [number, number, number, number][] = [
  [-1, 26, 30, 46],
  [-0.1, 40, 46, 66],
  [-0.03, 92, 84, 82],
  [0.0, 196, 150, 98],
  [0.1, 176, 106, 64],
  [0.24, 122, 68, 50],
  [0.36, 150, 104, 82],
  [0.5, 226, 214, 198],
  [1, 240, 234, 226],
];

/**
 * The ground's colour at a point of the unit globe (r, g, b 0..255 into `out`: deserts, basins,
 * ridges and cloud), and the lava glow there (returned, 0..1). Shared with the Orbital Claim outro,
 * which shows the same planet.
 */
export function groundAt(px: number, py: number, pz: number, out: V3): number {
  // Land: broad basins and deserts, then ridges.
  const wx = px + 0.07 * noise3(px * 5 + 3, py * 5, pz * 5);
  const wz = pz + 0.07 * noise3(px * 5, py * 5 + 9, pz * 5);
  let hgt = fbm(wx * 5.2 + 11.3, py * 5.2 + 4.1, wz * 5.2 + 2.2, 5) * 1.25;
  const ridge = 1 - Math.abs(noise3(px * 19 + 5, py * 19 + 5, pz * 19 + 5));
  hgt += 0.07 * ridge * ridge - 0.02;
  let k = 0;
  while (k < RAMP.length - 2 && hgt > RAMP[k + 1]![0]) k++;
  const a = RAMP[k]!;
  const b = RAMP[k + 1]!;
  const t = clamp((hgt - a[0]) / (b[0] - a[0]));
  const shade = 0.82 + 0.3 * fbm(px * 40, py * 40, pz * 40, 2);
  let r = lerp(a[1], b[1], t) * shade;
  let g = lerp(a[2], b[2], t) * shade;
  let bl = lerp(a[3], b[3], t) * shade;
  // Cloud: long swirls pulled along the wind.
  const sw = noise3(px * 4 + 20, py * 4 + 20, pz * 4 + 20);
  const cl = smooth(0.06, 0.42, fbm(px * 6 + sw * 0.7 + 9, py * 13 + sw * 0.5, pz * 6 + 3, 4) + 0.04);
  r = lerp(r, 246, cl * 0.88);
  g = lerp(g, 240, cl * 0.88);
  bl = lerp(bl, 236, cl * 0.88);
  out[0] = r;
  out[1] = g;
  out[2] = bl;
  return clamp(riftGlow(px, py, pz)) * (1 - cl);
}

/** Make some more rows of the ground picture; true when it is finished. */
function makeGround(budgetMs: number): boolean {
  if (ground) return true;
  if (typeof document === "undefined") return false;
  making ??= { row: 0, rgb: new ImageData(W0, H0), glow: new ImageData(W0, H0) };
  const m = making;
  const until = performance.now() + budgetMs;
  const col: V3 = [0, 0, 0];
  while (m.row < H0) {
    const y = m.row;
    const lat = LAT0 + ((y + 0.5) / H0) * (LAT1 - LAT0);
    for (let x = 0; x < W0; x++) {
      const lon = LON0 + ((x + 0.5) / W0) * (LON1 - LON0);
      const [px, py, pz] = globe(lon, lat);
      const lava = groundAt(px, py, pz, col);
      const r = col[0];
      const g = col[1];
      const bl = col[2];
      const i = (y * W0 + x) * 4;
      m.rgb.data[i] = r;
      m.rgb.data[i + 1] = g;
      m.rgb.data[i + 2] = bl;
      m.rgb.data[i + 3] = 255;
      m.glow.data[i] = m.glow.data[i + 1] = m.glow.data[i + 2] = lava * 255;
      m.glow.data[i + 3] = 255;
    }
    m.row++;
    if (performance.now() > until) return false;
  }
  // Enlarge both pictures smoothly and put them together.
  const big = (src: ImageData): Uint8ClampedArray => {
    const c0 = document.createElement("canvas");
    c0.width = W0;
    c0.height = H0;
    c0.getContext("2d")!.putImageData(src, 0, 0);
    const c1 = document.createElement("canvas");
    c1.width = TW;
    c1.height = TH;
    const g1 = c1.getContext("2d", { willReadFrequently: true })!;
    g1.imageSmoothingEnabled = true;
    g1.imageSmoothingQuality = "high";
    g1.drawImage(c0, 0, 0, TW, TH);
    return g1.getImageData(0, 0, TW, TH).data;
  };
  const rgb = big(m.rgb);
  const glow = big(m.glow);
  for (let i = 3; i < rgb.length; i += 4) rgb[i] = glow[i - 3]!;
  ground = rgb;
  making = undefined;
  return true;
}

export interface PlanetSetup {
  /** The picture, CSS px. */
  w: number;
  h: number;
  focal: number;
  cx: number;
  cy: number;
  /** Camera space (x right, y down, z in): towards the planet's centre; the sun; the way the ship flies. */
  centre: V3;
  sun: V3;
  /** Where the daylight on the ground and in the air comes from: the sun, a little higher (so more of the far ground is lit). */
  daylight: V3;
  ahead: V3;
  /** How big the globe looks: the angle from its centre to its edge, radians. */
  angle: number;
}

interface Ember {
  lon: number;
  lat: number;
  ph: number;
  size: number;
}

export interface Planet {
  /** Give the screen and the camera; call again when either changes. */
  layout(s: PlanetSetup): void;
  /** Work on the ground picture for a few ms (true when ready). */
  work(budgetMs: number): boolean;
  /** Draw the globe, its air and the embers of its rifts at time t (seconds). */
  draw(g: CanvasRenderingContext2D, t: number): void;
  /** The edge of the globe at one side-to-side place of the picture: its height there (CSS px), if any. */
  limbY(x: number): number | undefined;
  /** Where the sun stands in the picture. */
  sunXY(): [number, number];
}

/** Bright light rolls off softly instead of stopping dead at white (no hard-edged white patches). */
export const soft = (v: number) => 1 - Math.exp(-1.35 * v);

/**
 * The colour of the lit air: `day` is the sine of the sun's height at that place, `high` how far
 * up the air it is (0 at the ground, 1 at the top of the glow). Low air goes from the red of
 * first light through gold to white; higher air is blue. Returns how strongly it is lit, 0..1.
 */
export function airColour(day: number, high: number, out: V3): number {
  const warm = smooth(-0.2, -0.02, day);
  const white = smooth(-0.02, 0.22, day);
  let r = lerp(lerp(0.16, 1.0, warm), 0.82, white);
  let g = lerp(lerp(0.14, 0.5, warm), 0.9, white);
  let b = lerp(lerp(0.42, 0.16, warm), 1.0, white);
  r = lerp(r, 0.16, high);
  g = lerp(g, 0.46, high);
  b = lerp(b, 1.0, high);
  out[0] = r;
  out[1] = g;
  out[2] = b;
  return smooth(-0.3, 0.08, day);
}

export function createPlanet(): Planet {
  let S: PlanetSetup | undefined;
  // Planet frame, in camera space: e2 = up at the point under the camera, A = across the track, e3 = along it.
  let Pc: V3 = [0, 0, 1];
  let e2: V3 = [0, -1, 0];
  let e3: V3 = [0, 0, 1];
  let A: V3 = [1, 0, 0];
  let dist = 1.13;
  // Two small pictures of the screen: the air above the edge (made once), and the ground (each frame).
  let sky: HTMLCanvasElement | undefined;
  let buf: HTMLCanvasElement | undefined;
  let bg: CanvasRenderingContext2D | undefined;
  let img: ImageData | undefined;
  // What is known of each point of the ground picture.
  let n = 0;
  let at = new Int32Array(0);
  let tu = new Float32Array(0);
  let tv = new Int32Array(0);
  let light = new Float32Array(0);
  let night = new Float32Array(0);
  let air = new Uint8Array(0);
  let limb: { x: number; y: number; day: number }[][] = [];
  let centreXY: [number, number] = [0, 0];
  let embers: Ember[] | undefined;

  function makeEmbers(): Ember[] {
    const R = rng(90210);
    const out: Ember[] = [];
    for (let tries = 0; out.length < 900 && tries < 200000; tries++) {
      const lon = LON0 + R() * (LON1 - LON0);
      const lat = LAT0 + R() * (LAT1 - LAT0);
      const [x, y, z] = globe(lon, lat);
      if (rift(x, y, z) > 0.06 + R() * 0.45) out.push({ lon, lat, ph: R() * TAU, size: 0.6 + R() * R() * 1.5 });
    }
    return out;
  }

  function layout(s: PlanetSetup): void {
    S = s;
    dist = 1 / Math.sin(s.angle);
    Pc = mul(unit(s.centre), dist);
    e2 = mul(unit(s.centre), -1);
    A = unit(cross(s.centre, s.ahead));
    e3 = cross(A, e2);
    if (dot(e3, s.ahead) < 0) {
      A = mul(A, -1);
      e3 = mul(e3, -1);
    }
    centreXY = [s.cx + (s.focal * Pc[0]) / Math.max(0.05, Pc[2]), s.cy + (s.focal * Pc[1]) / Math.max(0.05, Pc[2])];
    const sun = unit(s.daylight);
    const glare = unit(s.sun);
    // The small pictures: about 230 000 points at most.
    const scale = Math.min(0.62, Math.sqrt(230000 / (s.w * s.h)));
    const bw = Math.max(8, Math.round(s.w * scale));
    const bh = Math.max(8, Math.round(s.h * scale));
    buf ??= document.createElement("canvas");
    buf.width = bw;
    buf.height = bh;
    bg = buf.getContext("2d")!;
    img = bg.createImageData(bw, bh);
    sky ??= document.createElement("canvas");
    sky.width = bw;
    sky.height = bh;
    const sg = sky.getContext("2d")!;
    const skyImg = sg.createImageData(bw, bh);
    const N = bw * bh;
    at = new Int32Array(N);
    tu = new Float32Array(N);
    tv = new Int32Array(N);
    light = new Float32Array(N * 3);
    night = new Float32Array(N);
    air = new Uint8Array(N * 3);
    n = 0;
    const c2 = dist * dist - 1;
    const col: V3 = [0, 0, 0];
    const data = img.data;
    const sd = skyImg.data;
    // The ground picture reaches a little past the true edge and the air picture a little inside it;
    // the edge itself is cut sharp when they are drawn (so it has no steps).
    const over = (3 * Math.sqrt(c2)) / (s.focal * scale);
    for (let py = 0; py < bh; py++) {
      const yy = ((py + 0.5) / bh) * s.h;
      const dy0 = (yy - s.cy) / s.focal;
      for (let px = 0; px < bw; px++) {
        const xx = ((px + 0.5) / bw) * s.w;
        const dx0 = (xx - s.cx) / s.focal;
        const il = 1 / Math.hypot(dx0, dy0, 1);
        const dx = dx0 * il;
        const dy = dy0 * il;
        const dz = il;
        const b = dx * Pc[0] + dy * Pc[1] + dz * Pc[2];
        if (b <= 0) continue;
        const disc = b * b - c2;
        const o = (py * bw + px) * 4;
        // How far the line of sight passes above the ground (below 0: it meets the ground).
        const hgt = Math.sqrt(Math.max(0, dist * dist - b * b)) - 1;
        const toSun = Math.max(0, dx * glare[0] + dy * glare[1] + dz * glare[2]);
        const fwd = 1 + 1.3 * Math.pow(toSun, 22);
        if (hgt > -over && hgt < 0.24) {
          // The air seen edge-on, above the edge (and just inside it, as at the edge).
          const hh = Math.max(0, hgt);
          const qx = dx * b - Pc[0];
          const qy = dy * b - Pc[1];
          const qz = dz * b - Pc[2];
          const ql = 1 / Math.hypot(qx, qy, qz);
          const day = (qx * sun[0] + qy * sun[1] + qz * sun[2]) * ql;
          const lit = airColour(day, smooth(0.002, 0.03, hh), col);
          // Close round the sun the air glows with the sun's own warm white, not the blue of high air.
          const warm = 0.85 * Math.pow(toSun, 40);
          col[0] = lerp(col[0], 1.0, warm);
          col[1] = lerp(col[1], 0.86, warm);
          col[2] = lerp(col[2], 0.62, warm);
          const k = lit * fwd * (0.6 * Math.exp(-hh / 0.005) + 0.31 * Math.exp(-hh / 0.02) + 0.09 * Math.exp(-hh / 0.075));
          const glow = 0.085 * Math.exp(-hh / 0.006);
          const r = soft(col[0] * k + glow * 0.2);
          const gg = soft(col[1] * k + glow * 0.62);
          const bb = soft(col[2] * k + glow);
          const mx = Math.max(r, gg, bb, 1e-4);
          sd[o] = (r / mx) * 255;
          sd[o + 1] = (gg / mx) * 255;
          sd[o + 2] = (bb / mx) * 255;
          sd[o + 3] = mx * 255;
        }
        if (disc >= 0 || hgt < over) {
          // On the globe (or a hair outside it: then the point of the edge nearest the line of sight).
          const tt = disc >= 0 ? b - Math.sqrt(disc) : b;
          let nx = dx * tt - Pc[0];
          let ny = dy * tt - Pc[1];
          let nz = dz * tt - Pc[2];
          const nl = 1 / Math.hypot(nx, ny, nz);
          nx *= nl;
          ny *= nl;
          nz *= nl;
          const mu = clamp(-(dx * nx + dy * ny + dz * nz));
          const day = nx * sun[0] + ny * sun[1] + nz * sun[2];
          const lat = Math.asin(clamp(nx * A[0] + ny * A[1] + nz * A[2], -1, 1)) / DEG;
          const lon = Math.atan2(nx * e3[0] + ny * e3[1] + nz * e3[2], nx * e2[0] + ny * e2[1] + nz * e2[2]) / DEG;
          at[n] = o;
          tu[n] = ((lon - LON0) / (LON1 - LON0)) * TW;
          tv[n] = clamp(Math.floor(((lat - LAT0) / (LAT1 - LAT0)) * TH), 0, TH - 1) * TW;
          // Sunlight: red and weak at first light, white higher up. A little starlight everywhere.
          const sl = smooth(-0.04, 0.24, day) * 1.3;
          const high = smooth(0.0, 0.3, day);
          light[n * 3] = sl + 0.085;
          light[n * 3 + 1] = sl * lerp(0.42, 0.95, high) + 0.115;
          light[n * 3 + 2] = sl * lerp(0.18, 0.86, high) + 0.2;
          night[n] = 1 - smooth(-0.12, 0.02, day);
          // The air between: thicker towards the edge, brightest towards the sun.
          const edge = Math.pow(1 - mu, 3);
          const k = airColour(day, 0.55 * (1 - edge), col) * (0.05 + 0.95 * edge) * fwd;
          const glow = Math.pow(1 - mu, 5) * 0.085;
          air[n * 3] = 255 * soft(col[0] * k + glow * 0.2);
          air[n * 3 + 1] = 255 * soft(col[1] * k + glow * 0.62);
          air[n * 3 + 2] = 255 * soft(col[2] * k + glow);
          data[o + 3] = 255;
          n++;
        }
      }
    }
    sg.putImageData(skyImg, 0, 0);
    // The edge of the globe, as lines across the picture.
    limb = [];
    const ea = unit(sub([0, -1, 0], mul(e2, dot([0, -1, 0], e2))));
    const eb = cross(mul(e2, -1), ea);
    let run: { x: number; y: number; day: number }[] = [];
    const ca = Math.cos(s.angle);
    const sa = Math.sin(s.angle);
    const STEPS = 1440;
    for (let i = 0; i <= STEPS; i++) {
      const ph = (i / STEPS) * TAU;
      const dir: V3 = [-e2[0] * ca + (ea[0] * Math.cos(ph) + eb[0] * Math.sin(ph)) * sa, -e2[1] * ca + (ea[1] * Math.cos(ph) + eb[1] * Math.sin(ph)) * sa, -e2[2] * ca + (ea[2] * Math.cos(ph) + eb[2] * Math.sin(ph)) * sa];
      const x = dir[2] > 0.02 ? s.cx + (s.focal * dir[0]) / dir[2] : NaN;
      const y = dir[2] > 0.02 ? s.cy + (s.focal * dir[1]) / dir[2] : NaN;
      if (!(x > -2 * s.w && x < 3 * s.w && y > -2 * s.h && y < 3 * s.h)) {
        if (run.length > 1) limb.push(run);
        run = [];
        continue;
      }
      const nl = unit(sub(mul(dir, dist * ca), Pc));
      run.push({ x, y, day: dot(nl, sun) });
    }
    if (run.length > 1) limb.push(run);
  }

  function limbY(x: number): number | undefined {
    for (const run of limb)
      for (let i = 1; i < run.length; i++) {
        const a = run[i - 1]!;
        const b = run[i]!;
        if ((a.x - x) * (b.x - x) <= 0 && a.x !== b.x) return lerp(a.y, b.y, (x - a.x) / (b.x - a.x));
      }
    return undefined;
  }

  function draw(g: CanvasRenderingContext2D, t: number): void {
    if (!S || !img || !bg || !buf || !sky) return;
    const data = img.data;
    const du = DRIFT * t * PER_DEG * UP;
    if (ground) {
      const tex = ground;
      const maxU = TW - 1;
      for (let k = 0; k < n; k++) {
        let u = (tu[k]! + du) | 0;
        if (u < 0) u = 0;
        else if (u > maxU) u = maxU;
        const i = (tv[k]! + u) << 2;
        const o = at[k]!;
        const k3 = k * 3;
        const e = tex[i + 3]! * night[k]!;
        data[o] = tex[i]! * light[k3]! + air[k3]! + e * 0.5;
        data[o + 1] = tex[i + 1]! * light[k3 + 1]! + air[k3 + 1]! + e * 0.15;
        data[o + 2] = tex[i + 2]! * light[k3 + 2]! + air[k3 + 2]! + e * 0.03;
      }
    } else {
      // The ground picture is still being made: the dark globe and its air.
      for (let k = 0; k < n; k++) {
        const o = at[k]!;
        const k3 = k * 3;
        data[o] = air[k3]!;
        data[o + 1] = air[k3 + 1]!;
        data[o + 2] = air[k3 + 2]!;
      }
    }
    bg.putImageData(img, 0, 0);
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    // The air first (it is light: it adds to the stars and the sun's glare behind it), then the ground cut off sharp along the edge of the globe.
    g.globalCompositeOperation = "lighter";
    g.drawImage(sky, 0, 0, S.w, S.h);
    g.globalCompositeOperation = "source-over";
    g.save();
    if (limb.length) {
      g.beginPath();
      for (const run of limb) {
        g.moveTo(run[0]!.x, run[0]!.y);
        for (let i = 1; i < run.length; i++) g.lineTo(run[i]!.x, run[i]!.y);
        g.lineTo(centreXY[0], centreXY[1]);
        g.closePath();
      }
      g.clip();
    }
    g.drawImage(buf, 0, 0, S.w, S.h);
    g.restore();

    // Embers along the rifts of the night side: small sharp points over the soft glow.
    if (ground) {
      embers ??= makeEmbers();
      const sun = unit(S.daylight);
      g.globalCompositeOperation = "lighter";
      for (const e of embers) {
        const lo = (e.lon - DRIFT * t) * DEG;
        const la = e.lat * DEG;
        const c = Math.cos(la);
        const a = c * Math.cos(lo);
        const b = Math.sin(la);
        const d = c * Math.sin(lo);
        const nx = a * e2[0] + b * A[0] + d * e3[0];
        const ny = a * e2[1] + b * A[1] + d * e3[1];
        const nz = a * e2[2] + b * A[2] + d * e3[2];
        const px = Pc[0] + nx;
        const py = Pc[1] + ny;
        const pz = Pc[2] + nz;
        if (pz < 0.02) continue;
        const pl = Math.hypot(px, py, pz);
        const facing = -(px * nx + py * ny + pz * nz) / pl;
        if (facing < 0.06) continue;
        const x = S.cx + (S.focal * px) / pz;
        const y = S.cy + (S.focal * py) / pz;
        if (x < -4 || y < -4 || x > S.w + 4 || y > S.h + 4) continue;
        const dark = 1 - smooth(-0.1, 0.02, nx * sun[0] + ny * sun[1] + nz * sun[2]);
        const al = dark * clamp(facing * 5) * (0.55 + 0.45 * Math.sin(t * 1.7 + e.ph));
        if (al < 0.03) continue;
        const r = clamp((e.size * S.focal * 0.0011) / pl, 0.5, 2.6);
        g.fillStyle = `rgb(255 ${Math.round(150 + 60 * Math.sin(e.ph))} 70 / ${al.toFixed(3)})`;
        g.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2);
      }
      g.globalCompositeOperation = "source-over";
    }

    // A thin bright thread along the edge: gold towards the sun, faint blue round the night side.
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    const col: V3 = [0, 0, 0];
    for (const run of limb) {
      for (let i = 2; i < run.length; i += 2) {
        const p = run[i - 2]!;
        const q = run[i]!;
        if (Math.max(p.x, q.x) < -8 || Math.min(p.x, q.x) > S.w + 8 || Math.max(p.y, q.y) < -8 || Math.min(p.y, q.y) > S.h + 8) continue;
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
  }

  return {
    layout,
    work: makeGround,
    draw,
    limbY,
    sunXY() {
      if (!S) return [0, 0];
      const s = unit(S.sun);
      return [S.cx + (S.focal * s[0]) / s[2], S.cy + (S.focal * s[1]) / s[2]];
    },
  };
}
