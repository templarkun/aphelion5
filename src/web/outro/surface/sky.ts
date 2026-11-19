/**
 * Surface Terraform: the sky (designer 2026-11-19). A deep cerulean sky with the alien sun low over
 * the valley and two pale moons, hidden at first behind a thick deck of toxic storm cloud (rust,
 * ash grey, sickly amber; red lightning inside it). Where the spires' beams pierce the deck it
 * glows cyan-emerald; then over the great spire a clear-sky vortex turns and opens, spiralling
 * outwards, pushing the storm back to the horizon, where what is left of it turns to white cloud.
 *
 * The deck is a ceiling HREL over the camera seen in perspective: each point of the picture above
 * the horizon is a point of the ceiling, and its cloud is worked out from the time alone (noise
 * turned by the vortex, the holes, the light), on a coarse grid that is drawn smoothly enlarged.
 * Looks only.
 */

import { clamp, ease, easeOut, lerp, rng, seg, smooth } from "../../briefing/styles/intro2/math3.js";
import { CLIMB, VORTEX_AT, VORTEX_WIDE, fireTimes } from "./timeline.js";
import { HREL, MOONS, nf, SPIRE_PLACES, SUN_DIR, type View } from "./world.js";

/** Red lightning in the storm: when, and where on the deck (X, Z km). */
const FLASHES = [
  { t: 0.55, X: -6, Z: 24, bolt: true },
  { t: 1.5, X: 5.5, Z: 15, bolt: false },
  { t: 2.35, X: -2.5, Z: 32, bolt: true },
  { t: 3.45, X: 8, Z: 19, bolt: false },
  { t: 4.3, X: 9, Z: 30, bolt: false },
];
function flashK(t: number, at: number): number {
  const a = (t - at) / 0.05;
  const b = (t - at - 0.14) / 0.045;
  return Math.exp(-a * a) + 0.7 * Math.exp(-b * b);
}

/** Where the vortex turns: over the great spire, where its beam pierces the deck. */
const VX = SPIRE_PLACES[0]!.X;
const VZ = SPIRE_PLACES[0]!.Z;

/** The vortex's open radius (km of deck) at time t. */
export function vortexRadius(t: number): number {
  return 1 + 27 * ease(seg(t, VORTEX_AT - 0.35, VORTEX_WIDE));
}
/** How far the vortex has turned (radians, at its middle). */
function swirl(t: number): number {
  return 2.7 * ease(seg(t, VORTEX_AT - 0.4, VORTEX_WIDE + 1.6)) + 0.035 * Math.max(0, t - 2);
}
/** When each beam reaches the deck. */
export function reachTimes(): number[] {
  return fireTimes().map((f) => f + CLIMB);
}
const REACH = reachTimes();
/** The small hole each beam punches (km), before and besides the vortex. */
function pierce(i: number, t: number): number {
  const r = REACH[i]!;
  // The far spire's beam only lights the deck (a hole that far off would read as a flat eye).
  if (i === 2) return 0;
  return 1.3 * easeOut(seg(t, r, r + 1.4)) + (i ? 2.6 * ease(seg(t, r + 0.9, 8.5)) : 0);
}
/** A beam's light on the deck, 0..1. */
function beamOn(i: number, t: number): number {
  return smooth(REACH[i]! - 0.1, REACH[i]! + 0.25, t);
}

/** Three spiral arms round the vortex, turning with it: -1..1. */
function arms(dx: number, dz: number, d: number, t: number): number {
  return Math.sin(3 * Math.atan2(dz, dx) + 2.4 * Math.log(1 + d) - 1.7 * swirl(t));
}

/** How clear the deck is at (X, Z) at time t, and the light of the hole's edge: [cover 0..1, rim 0..1]. */
function holes(X: number, Z: number, t: number, sx: number, sz: number, out: [number, number]): [number, number] {
  let cover = 1;
  let rim = 0;
  const R = vortexRadius(t);
  for (let i = 0; i < SPIRE_PLACES.length; i++) {
    const s = SPIRE_PLACES[i]!;
    let r = pierce(i, t);
    if (i === 0) r = t < REACH[0]! ? 0 : Math.max(r, R * smooth(REACH[0]!, VORTEX_AT, t));
    if (r <= 0.01) continue;
    const dx = X - s.X;
    const dz = Z - s.Z;
    const d = Math.hypot(dx, dz);
    if (d > r * 1.7 + 3) continue;
    // The edge is ragged; round the vortex the rags follow its turning arms.
    let warp = (nf(sx * 6 + 9, sz * 6 + 40) - 0.5) * (0.6 + 0.45 * r) + (nf(sx * 17 + 3, sz * 17 + 8) - 0.5) * 0.5;
    if (i === 0) warp += arms(dx, dz, d, t) * 0.28 * r;
    const edge = 0.45 + 0.11 * r;
    const k = clamp((d + warp - (r - edge)) / (2 * edge));
    const open = 1 - k * k * (3 - 2 * k);
    cover *= 1 - open;
    rim = Math.max(rim, 4 * open * (1 - open) * clamp(r / 4));
  }
  out[0] = cover;
  out[1] = rim;
  return out;
}
const tmp2: [number, number] = [0, 0];

export interface Sky {
  /** The sky, the sun and moons behind the deck, then the deck. `cell`: css px per point of the deck's grid. */
  draw(g: CanvasRenderingContext2D, v: View, t: number, cell: number): void;
  /** How much of the sun shows through the deck, 0..1. */
  sunShows(t: number): number;
  /** The sun in the picture. */
  sunAt(v: View): [number, number];
  /** The deck's cover over the point where spire i's beam meets it. */
  coverOver(i: number, t: number): number;
}

export function createSky(): Sky {
  let buf: HTMLCanvasElement | undefined;
  let img: ImageData | undefined;
  let sunSprite: HTMLCanvasElement | undefined;
  const moonSprites: HTMLCanvasElement[] = [];
  const R = rng(5150);
  const bolts = FLASHES.map((f) => {
    const pts: [number, number][] = [[0, 0]];
    let x = 0;
    for (let k = 1; k <= 9; k++) {
      x += (R() - 0.5) * 0.16;
      pts.push([x, k / 9]);
    }
    return f.bolt ? pts : undefined;
  });

  function sprites(): void {
    if (sunSprite) return;
    sunSprite = document.createElement("canvas");
    sunSprite.width = sunSprite.height = 128;
    const s = sunSprite.getContext("2d")!;
    const grd = s.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgb(255 255 250 / 1)");
    grd.addColorStop(0.32, "rgb(255 250 226 / 1)");
    grd.addColorStop(0.42, "rgb(255 226 160 / 0.6)");
    grd.addColorStop(0.7, "rgb(255 200 120 / 0.14)");
    grd.addColorStop(1, "rgb(255 190 110 / 0)");
    s.fillStyle = grd;
    s.fillRect(0, 0, 128, 128);
    for (const m of MOONS) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const q = c.getContext("2d")!;
      q.beginPath();
      q.arc(64, 64, 60, 0, Math.PI * 2);
      q.clip();
      const lit = q.createRadialGradient(40, 50, 4, 64, 64, 64);
      lit.addColorStop(0, `rgb(${m.rgb} / 1)`);
      lit.addColorStop(1, `rgb(${m.rgb} / 0.8)`);
      q.fillStyle = lit;
      q.fillRect(0, 0, 128, 128);
      // Maria.
      const RR = rng(m.r * 1000);
      for (let k = 0; k < 7; k++) {
        q.fillStyle = "rgb(150 150 190 / 0.25)";
        q.beginPath();
        q.arc(20 + RR() * 88, 20 + RR() * 88, 6 + RR() * 16, 0, Math.PI * 2);
        q.fill();
      }
      // The night side, away from the sun (lower right): see-through, so the sky shows.
      q.globalCompositeOperation = "destination-out";
      const sh = q.createRadialGradient(64 + 128 * m.phase, 64 + 40 * m.phase, 50, 64 + 128 * m.phase, 64 + 40 * m.phase, 100);
      sh.addColorStop(0, "rgb(0 0 0 / 0.92)");
      sh.addColorStop(1, "rgb(0 0 0 / 0)");
      q.fillStyle = sh;
      q.fillRect(0, 0, 128, 128);
      moonSprites.push(c);
    }
  }

  const sunAt = (v: View): [number, number] => [v.cx + v.f * (SUN_DIR.u - v.pan), v.hy - v.f * SUN_DIR.e];
  /** The deck point under a direction of the sky (u across, e up). */
  const sunDeck = { Z: HREL / SUN_DIR.e, X: (SUN_DIR.u * HREL) / SUN_DIR.e };

  return {
    sunAt,
    sunShows(t) {
      const [c] = holes(sunDeck.X, sunDeck.Z, t, sunDeck.X, sunDeck.Z, tmp2);
      return 1 - c;
    },
    coverOver(i, t) {
      const s = SPIRE_PLACES[i]!;
      return holes(s.X, s.Z, t, s.X, s.Z, tmp2)[0];
    },
    draw(g, v, t, cell) {
      sprites();
      const { w, f, hy } = v;
      // ---- The clear sky behind everything.
      const top = Math.min(0, hy - f * 1.4);
      const sky = g.createLinearGradient(0, hy, 0, top);
      sky.addColorStop(0, "rgb(190 226 242)");
      sky.addColorStop(Math.min(0.99, (0.06 * f) / (hy - top)), "rgb(128 192 236)");
      sky.addColorStop(Math.min(0.995, (0.3 * f) / (hy - top)), "rgb(54 132 218)");
      sky.addColorStop(1, "rgb(16 64 168)");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, Math.max(0, hy + 4));
      const [sx, sy] = sunAt(v);
      const warm = g.createRadialGradient(sx, sy, 0, sx, sy, f * 0.6);
      warm.addColorStop(0, "rgb(255 226 176 / 0.7)");
      warm.addColorStop(0.4, "rgb(255 214 160 / 0.22)");
      warm.addColorStop(1, "rgb(255 214 160 / 0)");
      g.fillStyle = warm;
      g.fillRect(0, 0, w, Math.max(0, hy + 4));
      for (const [k, m] of MOONS.entries()) {
        const r = m.r * f;
        g.globalAlpha = 0.9;
        g.drawImage(moonSprites[k]!, v.cx + f * (m.u - v.pan) - r, hy - f * m.e - r, r * 2, r * 2);
      }
      g.globalAlpha = 1;
      const sr = f * 0.085;
      g.drawImage(sunSprite!, sx - sr, sy - sr, sr * 2, sr * 2);

      // ---- The deck, point by point on a coarse grid.
      const cw = Math.max(8, Math.ceil(w / cell));
      const ch = Math.max(4, Math.ceil((hy + cell * 2) / cell));
      if (!buf || buf.width !== cw || buf.height !== ch) {
        buf = document.createElement("canvas");
        buf.width = cw;
        buf.height = ch;
        img = buf.getContext("2d")!.createImageData(cw, ch);
      }
      const d = img!.data;
      const S = swirl(t);
      const Rv = vortexRadius(t);
      const day = smooth(5.8, 10.6, t);
      const sunlit = smooth(4.2, 6.6, t);
      const beams = SPIRE_PLACES.map((_, i) => beamOn(i, t));
      const fl = FLASHES.map((x) => flashK(t, x.t));
      const flashing = fl.some((k) => k > 0.01);
      const drift = t * 0.32;
      // Toxic and clean colours of the deck: dark undersides, ash, amber; then soft white cloud.
      const DK = [lerp(44, 150, day), lerp(30, 158, day), lerp(28, 178, day)];
      const MD = [lerp(106, 236, day), lerp(88, 238, day), lerp(76, 246, day)];
      const AM = [lerp(156, 255, day), lerp(104, 222, day), lerp(52, 196, day)];
      const sunU = SUN_DIR.u;
      const sunE = SUN_DIR.e;
      for (let j = 0; j < ch; j++) {
        const y = (j + 0.5) * cell;
        const e = Math.max(0.0045, (hy - y) / f);
        const Zc = HREL / e;
        const detail = clamp(16 / Zc);
        const far = smooth(30, 160, Zc);
        for (let i = 0; i < cw; i++) {
          const x = (i + 0.5) * cell;
          const u = (x - v.cx) / f + v.pan;
          const X = v.camX + u * Zc;
          // Turned and pushed outwards by the vortex.
          let dx = X - VX;
          let dz = Zc - VZ;
          const r = Math.hypot(dx, dz) + 1e-6;
          const a = S * (Math.exp(-r / 7) + 0.35 * Math.exp(-r / 24));
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const push = 1 - (0.45 * Math.min(Rv, r) * Math.min(Rv, r)) / (r * r + 1);
          const rx = (dx * ca - dz * sa) * push;
          const rz = (dx * sa + dz * ca) * push;
          const px = VX + rx;
          const pz = VZ + rz;
          const [cover, rim] = holes(X, Zc, t, px, pz, tmp2);
          const o = (j * cw + i) * 4;
          if (cover < 0.004) {
            d[o + 3] = 0;
            continue;
          }
          // Far off, the deck is sampled squashed, so it reads as distant banks of cloud rather than noise.
          const sq = pz > 25 ? (25 + 9 * Math.log(1 + (pz - 25) / 9)) / pz : 1;
          dx = px * sq * 0.3 + drift;
          dz = pz * sq * 0.3;
          const base = nf(dx * 10 + 17, dz * 11 + 5);
          const base2 = nf((dx + 0.11) * 10 + 17, (dz - 0.11) * 11 + 5);
          const det = detail > 0.02 ? nf(dx * 30 - t * 1.2 + 70, dz * 30 + 33) : 0.5;
          const det2 = detail > 0.02 ? nf((dx + 0.05) * 30 - t * 1.2 + 70, (dz - 0.05) * 30 + 33) : 0.5;
          const dr = r - Rv;
          const band = Rv > 1.2 && dr > -Rv * 0.3 ? arms(X - VX, Zc - VZ, r, t) * Math.exp(-(dr * dr) / (0.4 * Rv * Rv + 4)) : 0;
          const dens = clamp((base - 0.5) * 1.5 + 0.6 + (det - 0.5) * 0.7 * detail + 0.22 * band);
          const shade = clamp(0.42 + (base - base2) * 9 + (det - det2) * 6 * detail + 0.18 * band);
          const lit = shade * (0.6 + 0.6 * dens);
          let cr = DK[0]! + (MD[0]! - DK[0]!) * lit;
          let cg = DK[1]! + (MD[1]! - DK[1]!) * lit;
          let cb = DK[2]! + (MD[2]! - DK[2]!) * lit;
          // Sickly amber in the storm's billows, warmest near the sun.
          const du = u - sunU;
          const de = e - sunE;
          const nearSun = Math.exp(-(du * du + de * de) / 0.09);
          const amber = clamp((dens - 0.42) * 1.6) * (0.5 + 0.5 * far) * (1 - day * 0.6) + nearSun * (0.35 + 0.65 * sunlit) * 0.6;
          cr += (AM[0]! - cr) * amber * 0.55;
          cg += (AM[1]! - cg) * amber * 0.55;
          cb += (AM[2]! - cb) * amber * 0.55;
          // The ragged edge of the opening catches the sun.
          if (rim > 0.01) {
            const k = rim * (0.35 + 0.65 * sunlit);
            cr += (255 - cr) * k * 0.7;
            cg += (226 - cg) * k * 0.62;
            cb += (176 - cb) * k * 0.5;
          }
          // The beams light the deck where they pierce it.
          for (let b = 0; b < 3; b++) {
            const on = beams[b]!;
            if (on < 0.01) continue;
            const s = SPIRE_PLACES[b]!;
            const db = Math.hypot(X - s.X, Zc - s.Z);
            const gl = on * (Math.exp(-(db * db) / 1.6) + 0.3 * Math.exp(-db / 3.5)) * (1 - day * 0.5) * (b === 2 ? 0.45 : 1);
            cr += 70 * gl;
            cg += 230 * gl;
            cb += 190 * gl;
          }
          if (flashing) {
            for (let q = 0; q < FLASHES.length; q++) {
              const k = fl[q]!;
              if (k < 0.01) continue;
              const fx = FLASHES[q]!;
              const gl = k * Math.exp(-Math.hypot(X - fx.X, Zc - fx.Z) / 5);
              cr += 255 * gl;
              cg += 130 * gl;
              cb += 100 * gl;
            }
          }
          const al = cover * clamp(0.62 + 0.9 * (dens - 0.3)) * (1 - 0.3 * day * (0.4 + 0.6 * (1 - far)));
          d[o] = cr > 255 ? 255 : cr;
          d[o + 1] = cg > 255 ? 255 : cg;
          d[o + 2] = cb > 255 ? 255 : cb;
          d[o + 3] = al * 255;
        }
      }
      buf.getContext("2d")!.putImageData(img!, 0, 0);
      g.save();
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(buf, 0, 0, cw, ch, 0, 0, cw * cell, ch * cell);
      g.restore();

      // ---- Lightning bolts down to the far mountains (they hide the foot of it).
      for (const [q, fx] of FLASHES.entries()) {
        const pts = bolts[q];
        const k = fl[q]!;
        if (!pts || k < 0.02) continue;
        const bx = v.cx + f * ((fx.X - v.camX) / fx.Z - v.pan);
        const by0 = hy - (f * HREL) / fx.Z;
        const len = hy - by0 + 4;
        g.save();
        g.globalCompositeOperation = "lighter";
        g.lineJoin = "round";
        for (const [wide, a] of [
          [5, 0.18],
          [1.4, 0.9],
        ] as const) {
          g.strokeStyle = `rgb(255 190 170 / ${(a * Math.min(1, k)).toFixed(3)})`;
          g.lineWidth = wide;
          g.beginPath();
          for (const [n, p] of pts.entries()) {
            const X = bx + p[0] * len;
            const Y = by0 + p[1] * len;
            if (n) g.lineTo(X, Y);
            else g.moveTo(X, Y);
          }
          g.stroke();
        }
        g.restore();
      }
    },
  };
}
