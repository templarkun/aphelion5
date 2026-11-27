/**
 * Star Chart (designer 2026-11-27), a victory outro: the won Campaign written into the sky. Made the
 * longest and biggest of the victory films (designer 2026-11-27: "put more effort in it. Add something
 * that would wow players. Make it longer").
 *
 * Act 1: in the dark, a comet of the Company's light runs the Campaign's road; one star ignites where
 * each mission was won, in the order played, its tag ("M2X") beside it; one small companion per Threat
 * column circles it. Act 2: streams of particles run from star to star and draw the Campaign's own
 * constellation (its shape comes from the missions played); then a star chart unfolds round it: rings,
 * degree ticks, the Campaign's name engraved along the rim. Act 3: the stars pour their light into the
 * middle and a new star is born there (white flash, turning rays, a long lens streak, rings in the
 * Company's colours); then the camera flies far back, stars streaking past, and tilts down onto a whole
 * spiral galaxy seen in depth, the constellation marked on one of its arms. Act 4: a wave of the
 * Company's light runs out from the new star across the galaxy; the core answers with a flare; the
 * arms keep the Company's colours as the galaxy turns under the Debrief.
 *
 * The galaxy is a real 3D point cloud seen through a moving camera (plain canvas, no WebGL). The Company
 * lends its colours; it suits any Company and any Campaign. Everything is worked out from the film time
 * alone (a skip, a still).
 */

import type { CampaignStats, CompanyTheme } from "../types.js";
import { frameOf, glow, grain, lerp, rgba, rgbOf, smooth, sprite, vignette, type FreeArea, type LossScene } from "../loss/kit.js";
import { CHART, chartOpen, cometAt, coreFlareAt, hash01, linkTimes, pullBack, starPlaces, starTimes, waveRadius } from "./timeline.js";

const T = CHART;
const TAU = Math.PI * 2;
type V3 = [number, number, number];
type C3 = [number, number, number];

/** The galaxy: radius in world units (the constellation is about 2 across), its arms. */
const RG = 60;
const ARMS = 3;
const WIND = 4.8;
/** The camera: distance from what it looks at, close (acts 1-2) and far (act 4). */
const D_NEAR = 3.3;
const D_FAR = 150;
/** The camera's heading while close; it swings round by SWING as it flies back. */
const YAW0 = 0.6;
const SWING = 1.15;
/** How steeply it looks down when far (radians above the galaxy's plane). */
const PITCH_FAR = 0.5;

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mix = (a: C3, b: C3, k: number): C3 => [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k))];

/** Normal random-ish number from two hashes (for the galaxy's thickness and the bulge). */
function gauss(k: number): number {
  const u = Math.max(1e-6, hash01(k));
  const v = hash01(k + 7919);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

interface Cam {
  pos: V3;
  right: V3;
  up: V3;
  fwd: V3;
}

export function createStarChartScene({ theme, stats }: { theme: CompanyTheme; stats: CampaignStats }): LossScene {
  const own = rgbOf(theme.primary);
  const own2 = rgbOf(theme.secondary);
  const glowC = rgbOf(theme.glow);
  const white: C3 = [255, 255, 255];
  const missions = stats.missions.length ? stats.missions : [{ id: "", label: "", tag: "", threat: ["A"] }];
  const n = missions.length;
  const places = starPlaces(n);
  const ignite = starTimes(n);
  const links = linkTimes(n);
  const centre = places.reduce((c, p) => ({ x: c.x + p.x / n, y: c.y + p.y / n }), { x: 0, y: 0 });
  const coreAt = coreFlareAt();
  const name = stats.campaignName.toUpperCase();

  // Where the constellation sits: on the first arm, CHART_RADIUS out from the middle.
  const aC = T.CHART_RADIUS * WIND;
  const C: V3 = [Math.cos(aC) * T.CHART_RADIUS * RG, 0, Math.sin(aC) * T.CHART_RADIUS * RG];
  const O: V3 = [0, 0, 0];
  // The constellation lies flat in the galaxy's plane, square to the camera's first (top-down) view.
  const right0: V3 = [Math.cos(YAW0), 0, -Math.sin(YAW0)];
  const down0: V3 = [Math.sin(YAW0), 0, Math.cos(YAW0)];
  const W = (x: number, y: number): V3 => add(add(C, right0, x - centre.x), down0, y - centre.y);
  const starW = places.map((p) => W(p.x, p.y));

  // Far dust on the screen (acts 1-2) and a faint deep field (act 4).
  const dust = Array.from({ length: 240 }, (_, k) => ({ x: hash01(k * 3 + 1), y: hash01(k * 5 + 2), b: 0.2 + hash01(k * 7 + 3) * 0.8 }));
  // The galaxy: points along log spirals, thicker near the middle, plus a round bulge.
  const GAL = 6000;
  const BULGE = 700;
  const galaxy = Array.from({ length: GAL + BULGE }, (_, k) => {
    let p: V3;
    let d: number;
    if (k < GAL) {
      const arm = k % ARMS;
      d = Math.pow(hash01(k * 11 + 4), 0.75);
      const spreadA = gauss(k * 13 + 5) * (0.12 + (1 - d) * 0.22);
      const a = (arm * TAU) / ARMS + d * WIND + spreadA;
      const r = (0.05 + d * 0.95 + gauss(k * 17 + 6) * 0.025) * RG;
      p = [Math.cos(a) * r, gauss(k * 3 + 1) * (0.4 + (1 - d) * 1.6), Math.sin(a) * r];
    } else {
      d = Math.abs(gauss(k * 5 + 2)) * 0.09;
      const a = hash01(k * 7 + 3) * TAU;
      const e = (hash01(k * 9 + 4) - 0.5) * 1.6;
      p = [Math.cos(a) * d * RG * Math.cos(e), Math.sin(e) * d * RG * 0.55, Math.sin(a) * d * RG * Math.cos(e)];
    }
    const warm = k >= GAL ? hash01(k * 23 + 8) * 0.3 : hash01(k * 23 + 8);
    // Colour class: 0 warm white, 1 blue white, 2 the glow colour (young knots), 3 pale.
    const cls = warm < 0.22 ? 0 : warm < 0.72 ? 1 : warm < 0.82 ? 2 : 3;
    const dc = Math.hypot(p[0] - C[0], p[2] - C[2]) / RG;
    return { p, d, b: 0.3 + hash01(k * 19 + 7) * 0.7, cls, rank: hash01(k * 29 + 9), dc, own: hash01(k * 31 + 10) < 0.55 };
  });
  // Near stars above the plane that the camera flies through on its way back (they streak).
  const NEAR = 520;
  const near = Array.from({ length: NEAR }, (_, k) => {
    const y = 4 + Math.pow(hash01(k * 41 + 1), 1.6) * 130;
    const sp = 3 + y * 0.75;
    return { p: [C[0] + (hash01(k * 43 + 2) - 0.5) * sp * 2, y, C[2] + (hash01(k * 47 + 3) - 0.5) * sp * 2] as V3, b: 0.4 + hash01(k * 53 + 4) * 0.6, rank: hash01(k * 59 + 5) };
  });
  const baseCols: C3[] = [
    [255, 226, 190],
    [200, 216, 255],
    glowC,
    [235, 240, 255],
  ];
  const ownCols: C3[] = [mix(own, white, 0.25), mix(own2, white, 0.25)];

  // Nebula clouds, painted once into their own picture.
  let nebula: HTMLCanvasElement | undefined;
  function nebulaOf(): HTMLCanvasElement {
    if (nebula) return nebula;
    nebula = document.createElement("canvas");
    nebula.width = nebula.height = 256;
    const q = nebula.getContext("2d")!;
    q.globalCompositeOperation = "lighter";
    for (let k = 0; k < 30; k++) {
      const x = hash01(k * 31) * 256;
      const y = hash01(k * 37) * 256;
      const r = 30 + hash01(k * 41) * 90;
      const c = k % 3 === 0 ? own : k % 3 === 1 ? glowC : own2;
      const gr = q.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(c, 0.07 + hash01(k * 43) * 0.07));
      gr.addColorStop(1, rgba(c, 0));
      q.fillStyle = gr;
      q.fillRect(0, 0, 256, 256);
    }
    return nebula;
  }

  /** The camera at film time t. */
  function camAt(t: number): Cam {
    const u = pullBack(t);
    const late = Math.max(0, t - T.PULL_END);
    // Close: a slow push-in. Far: an exponential flight back, then a very slow drift.
    const d0 = D_NEAR * (1 - 0.07 * smooth(0, T.PULL_AT, t)) * (1 + 0.3 * smooth(T.LINK_END, T.CHART_FULL + 0.3, t));
    const dist = d0 * Math.pow(D_FAR / d0, u) * (1 + late * 0.006);
    const pitch = lerp(Math.PI / 2 - 1e-4, PITCH_FAR, smooth(0.12, 1, u));
    const yaw = YAW0 + SWING * smooth(0.08, 1, u) + late * 0.035;
    const k = smooth(0.15, 1, u);
    const L: V3 = [lerp(C[0], lerp(C[0], O[0], 0.78), k), 0, lerp(C[2], lerp(C[2], O[2], 0.78), k)];
    const cp = Math.cos(pitch);
    const pos: V3 = [L[0] + dist * cp * Math.sin(yaw), L[1] + dist * Math.sin(pitch), L[2] + dist * cp * Math.cos(yaw)];
    const f: V3 = [L[0] - pos[0], L[1] - pos[1], L[2] - pos[2]];
    const fl = Math.hypot(f[0], f[1], f[2]);
    const fwd: V3 = [f[0] / fl, f[1] / fl, f[2] / fl];
    const right: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up: V3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    return { pos, right, up, fwd };
  }

  return {
    draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free: FreeArea | undefined, quality: number): void {
      const fr = frameOf(w, h, free, smooth(T.DEBRIEF_AT - 0.2, T.DEBRIEF_AT + 1.0, t));
      const pb = pullBack(t);
      const cam = camAt(t);
      const F = fr.s * 0.38 * D_NEAR;
      /** World -> picture: [x, y, how many points one world unit spans there], or undefined behind the camera. */
      const P = (q: V3, c: Cam = cam): [number, number, number] | undefined => {
        const vx = q[0] - c.pos[0];
        const vy = q[1] - c.pos[1];
        const vz = q[2] - c.pos[2];
        const z = vx * c.fwd[0] + vy * c.fwd[1] + vz * c.fwd[2];
        if (z < 0.05) return undefined;
        const k = F / z;
        return [fr.cx + (vx * c.right[0] + vy * c.right[1] + vz * c.right[2]) * k, fr.cy - (vx * c.up[0] + vy * c.up[1] + vz * c.up[2]) * k, k];
      };
      const spOwn = sprite(own);
      const spOwn2 = sprite(own2);
      const spGlow = sprite(glowC);
      const spWhite = sprite(white);
      const spArm = sprite([150, 180, 255]);
      const fadeIn = smooth(0, 0.9, t);
      const asc = t - T.NOVA_AT;
      const gather = smooth(T.GATHER_AT, T.NOVA_AT, t);
      const cc = P(W(centre.x, centre.y));
      const S = cc ? cc[2] : 0; // points per constellation unit, at the constellation
      // Acts 1-3 belong to the constellation; it shrinks to a point as the camera flies back.
      const closeA = 1 - smooth(0.05, 0.4, pb);

      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      g.fillStyle = "#010208";
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";

      // Nebula and far dust, drifting a little, fading as the camera leaves.
      g.globalAlpha = (0.95 - pb * 0.65) * fadeIn;
      const nb = nebulaOf();
      const big = Math.max(w, h) * 1.5;
      const drift = t * 0.012 * fr.s + pb * fr.s * 0.25;
      g.drawImage(nb, (w - big) / 2 - drift, (h - big) / 2 - drift * 0.4, big, big);
      g.globalAlpha = 1;
      g.fillStyle = "rgb(200,215,255)";
      for (const d of dust) {
        const a = d.b * (0.5 + 0.5 * Math.sin(t * 1.3 + d.x * 50)) * lerp(1, 0.3, pb) * fadeIn;
        g.globalAlpha = a * 0.6;
        g.fillRect(d.x * w, d.y * h, 1.2, 1.2);
      }
      g.globalAlpha = 1;

      // ---- The flight back: near stars streak past the camera. ----
      if (pb > 0.005 && pb < 0.995) {
        const before = camAt(t - 0.07);
        const fast = Math.sin(Math.PI * pb);
        g.lineCap = "round";
        for (const s of near) {
          if (s.rank > quality) continue;
          const a = P(s.p);
          const b = P(s.p, before);
          if (!a || !b) continue;
          let dx = b[0] - a[0];
          let dy = b[1] - a[1];
          const len = Math.hypot(dx, dy);
          const cap = fr.s * 0.35;
          if (len > cap) {
            dx *= cap / len;
            dy *= cap / len;
          }
          if (a[0] < -50 || a[1] < -50 || a[0] > w + 50 || a[1] > h + 50) continue;
          g.strokeStyle = `rgba(215,228,255,${(s.b * 0.75 * fast).toFixed(3)})`;
          g.lineWidth = Math.min(3, 0.6 + a[2] * 0.02);
          g.beginPath();
          g.moveTo(a[0], a[1]);
          g.lineTo(a[0] + dx, a[1] + dy);
          g.stroke();
        }
      }

      // ---- The galaxy, coming into view as the camera flies back. ----
      const gv = smooth(0.04, 0.55, pb);
      const wr = waveRadius(t);
      const coreK = t >= coreAt ? Math.exp(-(t - coreAt) * 1.6) : 0;
      if (gv > 0) {
        const o = P(O);
        // The disc's soft light and the core's glow, as ellipses in the galaxy's plane.
        const ex = P([RG, 0, 0]);
        const ez = P([0, 0, RG]);
        if (o && ex && ez) {
          g.save();
          g.transform(ex[0] - o[0], ex[1] - o[1], ez[0] - o[0], ez[1] - o[1], o[0], o[1]);
          const disc = g.createRadialGradient(0, 0, 0, 0, 0, 1.05);
          disc.addColorStop(0, `rgba(255,232,205,${0.32 * gv})`);
          disc.addColorStop(0.12, rgba(glowC, 0.16 * gv));
          disc.addColorStop(0.5, rgba(glowC, 0.05 * gv));
          disc.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = disc;
          g.fillRect(-1.1, -1.1, 2.2, 2.2);
          // Once the wave has passed, the Company's light lies over the arms.
          const tint = smooth(0.2, 1.2, wr) * 0.12;
          if (tint > 0) {
            const tg = g.createRadialGradient(0, 0, 0.1, 0, 0, 1.05);
            tg.addColorStop(0, rgba(own, 0));
            tg.addColorStop(0.35, rgba(own, tint));
            tg.addColorStop(0.75, rgba(own2, tint * 0.7));
            tg.addColorStop(1, rgba(own2, 0));
            g.fillStyle = tg;
            g.fillRect(-1.1, -1.1, 2.2, 2.2);
          }
          g.restore();
          const cr = o[2] * RG * 0.12;
          glow(g, spWhite, o[0], o[1], cr * (1 + coreK * 1.5), 0.55 * gv);
          glow(g, spGlow, o[0], o[1], cr * 2.4, 0.35 * gv);
          if (coreK > 0.01) {
            // The core answers: a flare in the Company's colour, with a long streak.
            glow(g, spOwn, o[0], o[1], cr * 3.2 * (1.5 - coreK * 0.5), coreK * 0.85);
            g.drawImage(spOwn2, o[0] - cr * 9, o[1] - cr * 0.35, cr * 18, cr * 0.7);
          }
        }
        // The stars, by colour, so the colour is set once per group.
        const band = 0.07;
        for (let cls = 0; cls < 6; cls++) {
          const col = cls < 4 ? baseCols[cls]! : ownCols[cls - 4]!;
          g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
          for (const s of galaxy) {
            if (s.rank > quality) continue;
            const reached = wr > s.dc;
            const mine = reached && s.own;
            if (cls < 4 ? s.cls !== cls || mine : !mine || (cls === 4) !== s.cls < 2) continue;
            const q = P(s.p);
            if (!q) continue;
            const [x, y] = q;
            if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
            let a = s.b * gv * (1 - s.d * 0.4);
            // The wave's crest: a bright flash as it passes.
            const crest = wr > 0 && wr < T.WAVE_REACH ? Math.max(0, 1 - Math.abs(wr - s.dc) / band) : 0;
            a = Math.min(1, a * (1 + crest * 2.5));
            const sz = (s.d < 0.2 ? 2 : 1.5) + crest * 1.5 + Math.min(2, q[2] * 0.04);
            g.globalAlpha = a;
            g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
          }
        }
        g.globalAlpha = 1;
        // Soft clouds of light along the arms (young stars and gas), so the arms read as arms.
        for (let k = 0; k < GAL; k += 11) {
          const s = galaxy[k]!;
          if (s.d < 0.12 || s.rank > quality * 1.2) continue;
          const q = P(s.p);
          if (!q) continue;
          const sz = Math.min(fr.s * 0.12, q[2] * RG * 0.045);
          const tinted = s.own && wr > s.dc;
          glow(g, tinted ? spOwn : s.cls === 2 ? spGlow : spArm, q[0], q[1], sz, 0.09 * gv * (1 - s.d * 0.5));
        }
        // A few bright stars along the arms, drawn as soft lights.
        for (let k = 0; k < galaxy.length; k += 37) {
          const s = galaxy[k]!;
          const q = P(s.p);
          if (!q) continue;
          glow(g, s.own && wr > s.dc ? spOwn : s.cls === 2 ? spGlow : spWhite, q[0], q[1], 2.5 + s.b * 3, s.b * gv * 0.6);
        }
      }

      // ---- The wave of the Company's light, a ring in the galaxy's plane. ----
      if (wr > 0 && wr < T.WAVE_REACH) {
        const fade = 1 - smooth(0.7, 1, wr / T.WAVE_REACH);
        const R = wr * RG;
        const M = Math.round(120 * Math.max(0.6, quality));
        g.strokeStyle = rgba(own, 0.55 * fade);
        g.lineWidth = Math.max(1.2, fr.s * 0.004);
        g.beginPath();
        let started = false;
        const pts: [number, number][] = [];
        for (let j = 0; j <= M; j++) {
          const a = (j / M) * TAU;
          const q = P([C[0] + Math.cos(a) * R, 0, C[2] + Math.sin(a) * R]);
          if (!q) {
            started = false;
            continue;
          }
          if (started) g.lineTo(q[0], q[1]);
          else g.moveTo(q[0], q[1]);
          started = true;
          // Only the part of the ring over the galaxy carries the sparks.
          if (j % 3 === 0 && Math.hypot(C[0] + Math.cos(a) * R, C[2] + Math.sin(a) * R) < RG * 1.05) pts.push([q[0], q[1]]);
        }
        g.stroke();
        for (const [x, y] of pts) glow(g, spOwn2, x, y, fr.s * 0.008, 0.8 * fade);
      }

      // ---- The constellation (acts 1-3), drawn on the plane where it lies. ----
      if (closeA > 0 && cc) {
        const starsS = places.map((_, i) => P(starW[i]!));
        const base = Math.max(2.5, S * 0.05);
        const flareK = asc >= 0 ? Math.exp(-asc * 2.2) : 0;

        // The comet: a white head, a trail in the Company's colours, sparks shed behind.
        const head = cometAt(t, n);
        if (head) {
          for (let j = 24; j >= 1; j--) {
            const pt = cometAt(t - j * 0.018, n);
            if (!pt) continue;
            const q = P(W(pt.x, pt.y));
            if (!q) continue;
            const k = 1 - j / 25;
            glow(g, j % 2 ? spOwn : spOwn2, q[0], q[1], base * (0.25 + 0.75 * k), 0.75 * k * closeA);
          }
          for (let j = 0; j < 14; j++) {
            const age = (j / 14) * 0.6;
            const pt = cometAt(t - age, n);
            if (!pt) continue;
            const ox = (hash01(j * 17 + Math.floor(t * 9)) - 0.5) * 0.12 * (age / 0.6);
            const oy = (hash01(j * 19 + Math.floor(t * 9)) - 0.5) * 0.12 * (age / 0.6);
            const q = P(W(pt.x + ox, pt.y + oy));
            if (q) glow(g, spGlow, q[0], q[1], base * 0.22, (1 - age / 0.6) * 0.8 * closeA);
          }
          const q = P(W(head.x, head.y));
          if (q) {
            glow(g, spOwn, q[0], q[1], base * 2.6, 0.7 * closeA);
            glow(g, spWhite, q[0], q[1], base * 0.9, closeA);
          }
        }

        // The links: streams of particles from star to star, then a filament with light running along it.
        links.forEach((l, i) => {
          if (t < l) return;
          const u = smooth(l, l + T.LINK_FLY, t);
          const pa = places[i]!;
          const pbp = places[i + 1]!;
          const len = Math.hypot(pbp.x - pa.x, pbp.y - pa.y);
          const M = Math.max(8, Math.round(len * 50 * quality));
          const fl = (1 + 1.8 * flareK) * (1 - gather * 0.5 * (asc < 0 ? 1 : 0));
          const at = (v: number, off = 0): V3 => {
            // A gentle bow in each stream, settling straight once it has arrived.
            const bow = Math.sin(v * Math.PI) * 0.06 * (1 - smooth(l + T.LINK_FLY, l + T.LINK_FLY + 0.6, t));
            const nx = -(pbp.y - pa.y) / (len || 1);
            const ny = (pbp.x - pa.x) / (len || 1);
            return W(lerp(pa.x, pbp.x, v) + nx * (bow + off), lerp(pa.y, pbp.y, v) + ny * (bow + off));
          };
          // The filament itself.
          const q0 = P(at(0));
          if (q0) {
            g.strokeStyle = rgba(own, 0.35 * fl * closeA);
            g.lineWidth = Math.max(0.8, S * 0.006);
            g.beginPath();
            g.moveTo(q0[0], q0[1]);
            for (let j = 1; j <= 12; j++) {
              const v = (j / 12) * u;
              const q = P(at(v));
              if (q) g.lineTo(q[0], q[1]);
            }
            g.stroke();
          }
          for (let j = 0; j < M; j++) {
            const v = j / M;
            if (v > u) break;
            const wob = Math.sin(v * 18 + t * 3 + i) * 0.008 * (1 - u);
            const q = P(at(v, wob));
            if (q) glow(g, spOwn, q[0], q[1], Math.max(1.2, S * 0.012) * fl, 0.24 * fl * closeA);
          }
          if (u < 1) {
            const q = P(at(u));
            if (q) {
              glow(g, spWhite, q[0], q[1], Math.max(2, S * 0.035), closeA);
              glow(g, spOwn, q[0], q[1], Math.max(3, S * 0.07), 0.6 * closeA);
            }
            for (let j = 1; j < 12; j++) {
              const v = Math.max(0, u - j * 0.028);
              const off = (hash01(j * 7 + i) - 0.5) * 0.04;
              const qq = P(at(v, off));
              if (qq) glow(g, spOwn2, qq[0], qq[1], Math.max(1.5, S * 0.02) * (1 - j / 12), 0.7 * (1 - j / 12) * closeA);
            }
          } else {
            for (let j = 0; j < 3; j++) {
              const v = (t * 0.45 + j / 3 + hash01(i * 13)) % 1;
              const q = P(at(v));
              if (q) glow(g, spOwn2, q[0], q[1], Math.max(1.5, S * 0.022), 0.65 * closeA);
            }
          }
        });

        // The star chart: rings, ticks, degrees and the Campaign's name round the constellation.
        const ch = chartOpen(t) * (1 - smooth(T.GATHER_AT, T.NOVA_AT, t));
        if (ch > 0) drawChart(g, cc[0], cc[1], S, ch, t);

        // The stars, one per mission won, with their Threat companions.
        missions.forEach((m, i) => {
          const at = ignite[i]!;
          const q = starsS[i];
          if (t < at - 0.3 || !q) return;
          const [x, y] = q;
          if (t < at) {
            // Light gathering into the point as the comet nears.
            const k = smooth(at - 0.3, at, t);
            for (let j = 0; j < 12; j++) {
              const a = (j / 12) * TAU + hash01(j + i * 10);
              const r = base * 3.2 * (1 - k);
              glow(g, spOwn, x + Math.cos(a) * r, y + Math.sin(a) * r, base * 0.18, k * closeA);
            }
            return;
          }
          const d = t - at;
          // During the gathering the stars give their light to the middle, then shine again, smaller.
          const give = asc < 0 ? 1 - gather * 0.35 : 0.45 + 0.55 * smooth(0, 1.2, asc);
          const fl = (1 + 2.4 * flareK) * give;
          const tw = 0.85 + 0.15 * Math.sin(t * 4 + i * 2.1);
          glow(g, spOwn, x, y, base * (1.4 + 3.4 * Math.exp(-d * 3)) * fl, 0.75 * tw * closeA);
          glow(g, spWhite, x, y, base * (0.4 + 0.9 * Math.exp(-d * 4)) * fl, closeA);
          // Diffraction spikes.
          g.strokeStyle = rgba(white, 0.5 * tw * Math.min(1, fl) * closeA);
          g.lineWidth = Math.max(0.8, base * 0.05);
          const sl = base * (2 + 3 * Math.exp(-d * 2.5)) * fl;
          g.beginPath();
          g.moveTo(x - sl, y);
          g.lineTo(x + sl, y);
          g.moveTo(x, y - sl * 0.8);
          g.lineTo(x, y + sl * 0.8);
          g.stroke();
          // The ignition: a ring and a burst of sparks.
          if (d < 1.1) {
            g.strokeStyle = rgba(own, 0.75 * (1 - d / 1.1) * closeA);
            g.lineWidth = Math.max(1, base * 0.08);
            g.beginPath();
            g.arc(x, y, base * (1 + 7 * (1 - Math.exp(-d * 4))), 0, TAU);
            g.stroke();
            const M = Math.round(30 * quality);
            for (let j = 0; j < M; j++) {
              const a = (j / M) * TAU + hash01(j * 5 + i);
              const r = base * (1 + 8 * (1 - Math.exp(-d * 3.5)) * (0.6 + hash01(j * 3 + i) * 0.6));
              glow(g, j % 3 ? spOwn2 : spWhite, x + Math.cos(a) * r, y + Math.sin(a) * r, base * 0.13, 0.85 * (1 - d / 1.1) * closeA);
            }
          }
          // One small companion per Threat column conquered, circling the star.
          m.threat.forEach((_, c) => {
            const ca = at + T.COMPANION_STEP * (c + 1);
            if (t < ca) return;
            const a = (c / Math.max(1, m.threat.length)) * TAU + t * 0.6 + i;
            const r = Math.max(4, S * 0.11);
            glow(g, spGlow, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, base * 0.45, 0.85 * smooth(ca, ca + 0.2, t) * closeA);
          });
          // During the gathering, a stream of light from the star into the middle.
          if (gather > 0 && asc < 0.2) {
            const M = Math.round(14 * quality) + 4;
            for (let j = 0; j < M; j++) {
              const v = (j / M + t * 1.6 + hash01(i * 3)) % 1;
              const k = v * v;
              const px = lerp(x, cc[0], k);
              const py = lerp(y, cc[1], k);
              glow(g, j % 2 ? spOwn : spWhite, px, py, base * (0.35 - 0.2 * k), 0.8 * gather * (asc < 0 ? 1 : 1 - asc / 0.2));
            }
          }
          // Its tag, until the light gathers.
          const ta = smooth(at + 0.1, at + 0.5, t) * (1 - smooth(T.GATHER_AT - 0.3, T.GATHER_AT + 0.3, t));
          if (ta > 0 && m.tag) {
            const p = places[i]!;
            const above = p.y < centre.y;
            g.globalCompositeOperation = "source-over";
            g.globalAlpha = ta * 0.92;
            g.fillStyle = rgba(own2, 1);
            g.font = `600 ${Math.max(10, S * 0.075)}px system-ui, sans-serif`;
            g.textAlign = "center";
            const ty = y + (above ? -1 : 1) * Math.max(16, S * 0.2) + (above ? 0 : S * 0.05);
            g.fillText(m.tag, x, ty);
            g.globalAlpha = 1;
            g.globalCompositeOperation = "lighter";
          }
        });
      }

      // ---- The new star at the constellation's middle (from the nova on), and its birth. ----
      const ccNow = P(W(centre.x, centre.y));
      if (ccNow && asc > -1.0) {
        const [x, y] = ccNow;
        if (asc < 0) {
          // The middle swells as the light pours in.
          glow(g, spOwn, x, y, fr.s * 0.05 * gather * (1 + gather), gather * 0.9);
          glow(g, spGlow, x, y, fr.s * 0.12 * gather * gather, gather * 0.5);
          glow(g, spWhite, x, y, fr.s * 0.012 * gather, gather);
        } else {
          const boom = Math.exp(-asc * 1.4);
          // The star itself: stays bright, settles to a steady size on screen as the camera leaves.
          const sz = fr.s * (0.012 + 0.05 * boom) * lerp(1, 0.55, pb);
          glow(g, spOwn, x, y, sz * 2.6, 0.85);
          glow(g, spWhite, x, y, sz, 1);
          // Turning rays.
          if (asc < 4) {
            const ray = Math.exp(-asc * 0.9);
            const RL = fr.s * (0.35 + 0.35 * (1 - Math.exp(-asc * 2)));
            g.save();
            g.translate(x, y);
            g.rotate(asc * 0.25);
            for (let k = 0; k < 14; k++) {
              const a = (k / 14) * TAU + hash01(k * 3) * 0.2;
              const len = RL * (0.5 + hash01(k * 7) * 0.7);
              const wd = 0.035 + hash01(k * 11) * 0.04;
              const lg = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
              lg.addColorStop(0, rgba(k % 2 ? own : white, 0.5 * ray));
              lg.addColorStop(1, rgba(own2, 0));
              g.fillStyle = lg;
              g.beginPath();
              g.moveTo(0, 0);
              g.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len);
              g.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len);
              g.closePath();
              g.fill();
            }
            g.restore();
          }
          // The long lens streak, and its thinner twin in the second colour.
          const streak = Math.exp(-asc * 0.7) * 0.9 + 0.12;
          g.globalAlpha = Math.min(1, streak);
          g.drawImage(spWhite, x - fr.s * 0.9 * streak, y - fr.s * 0.012, fr.s * 1.8 * streak, fr.s * 0.024);
          g.drawImage(spOwn2, x - fr.s * 0.6 * streak, y - fr.s * 0.03, fr.s * 1.2 * streak, fr.s * 0.06);
          g.globalAlpha = 1;
          // Rings in the Company's colours, running out one after another.
          if (asc < 2.6) {
            const cols = [own, own2, glowC];
            cols.forEach((c, k) => {
              const a2 = asc - k * 0.12;
              if (a2 < 0) return;
              const R = fr.s * (0.04 + 0.95 * (1 - Math.exp(-a2 * 1.7)));
              const fade = Math.max(0, 1 - a2 / 2.4);
              g.strokeStyle = rgba(c, 0.6 * fade);
              g.lineWidth = Math.max(1.5, fr.s * 0.007 * fade);
              g.beginPath();
              g.arc(x, y, R, 0, TAU);
              g.stroke();
            });
            // The shock spray.
            const M = Math.round(170 * quality);
            const fade = Math.max(0, 1 - asc / 2.2);
            for (let j = 0; j < M; j++) {
              const a = (j / M) * TAU + hash01(j * 7) * 0.08;
              const R = fr.s * (0.04 + 0.95 * (1 - Math.exp(-asc * 1.7))) * (0.75 + hash01(j * 13) * 0.45);
              glow(g, j % 4 ? spOwn : spWhite, x + Math.cos(a) * R, y + Math.sin(a) * R, fr.s * 0.005, fade);
            }
          }
          // The white flash.
          const flash = Math.exp(-asc * 4.5);
          if (flash > 0.01) {
            g.globalAlpha = flash * 0.85;
            g.fillStyle = "#fff";
            g.fillRect(0, 0, w, h);
            g.globalAlpha = 1;
          }
        }
      }

      // ---- Once far back: the constellation marked on the galaxy's arm. ----
      const mk = smooth(0.7, 1, pb);
      if (mk > 0 && ccNow) {
        const [x, y] = ccNow;
        const r = Math.max(18, fr.s * 0.045);
        g.globalCompositeOperation = "source-over";
        g.strokeStyle = rgba(own, 0.9 * mk);
        g.lineWidth = 1.5;
        const spinB = t * 0.4;
        for (let k = 0; k < 6; k++) {
          const a0 = spinB + (k * TAU) / 6;
          g.beginPath();
          g.arc(x, y, r, a0, a0 + 0.42);
          g.stroke();
        }
        g.strokeStyle = rgba(own2, 0.5 * mk);
        g.beginPath();
        g.arc(x, y, r * 1.35, -spinB * 0.7, -spinB * 0.7 + TAU * 0.7);
        g.stroke();
        // A leader line up to the name.
        const lx = x + r * 1.8;
        const ly = y - r * 2.2;
        g.strokeStyle = rgba(own2, 0.7 * mk);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + r * 0.75, y - r * 0.75);
        g.lineTo(lx, ly);
        g.lineTo(lx + Math.max(60, fr.s * 0.16) * mk, ly);
        g.stroke();
        g.globalAlpha = mk * 0.95;
        g.fillStyle = rgba(own2, 1);
        g.textAlign = "left";
        g.font = `600 ${Math.max(11, fr.s * 0.024)}px system-ui, sans-serif`;
        g.fillText(name, lx + 4, ly - 6);
        g.globalAlpha = mk * 0.7;
        g.font = `500 ${Math.max(9, fr.s * 0.015)}px system-ui, sans-serif`;
        g.fillText(missions.map((m) => m.tag).filter(Boolean).join(" · "), lx + 4, ly + Math.max(12, fr.s * 0.026));
        g.globalAlpha = 1;
      }

      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      vignette(g, w, h, 0.6);
      grain(g, w, h, t, 0.045);
      // The film opens out of black.
      if (fadeIn < 1) {
        g.globalAlpha = 1 - fadeIn;
        g.fillStyle = "#000";
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
      }
    },
  };

  /** The star chart round the constellation: k 0..1 how far it has unfolded. */
  function drawChart(g: CanvasRenderingContext2D, x: number, y: number, S: number, k: number, t: number): void {
    const R1 = S * 1.05;
    const R2 = S * 1.18;
    const R3 = S * 1.4;
    g.save();
    g.translate(x, y);
    g.lineCap = "butt";
    // The inner ring drawn round, with its ticks: every 5 degrees, long every 30.
    g.strokeStyle = rgba(own, 0.55 * k);
    g.lineWidth = Math.max(1, S * 0.006);
    g.beginPath();
    g.arc(0, 0, R1, -Math.PI / 2, -Math.PI / 2 + TAU * k);
    g.stroke();
    const rot1 = t * 0.05;
    g.beginPath();
    for (let d = 0; d < 360; d += 5) {
      if (d / 360 > k) break;
      const a = rot1 + (d * Math.PI) / 180;
      const l = d % 30 === 0 ? S * 0.07 : S * 0.03;
      g.moveTo(Math.cos(a) * R1, Math.sin(a) * R1);
      g.lineTo(Math.cos(a) * (R1 + l), Math.sin(a) * (R1 + l));
    }
    g.stroke();
    // The middle ring, dashed, turning the other way, with its degrees.
    const rot2 = -t * 0.08;
    g.strokeStyle = rgba(own2, 0.45 * k);
    g.setLineDash([S * 0.04, S * 0.03]);
    g.beginPath();
    g.arc(0, 0, R2, rot2, rot2 + TAU * k);
    g.stroke();
    g.setLineDash([]);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = rgba(own2, 0.75 * k);
    g.font = `500 ${Math.max(8, S * 0.045)}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let d = 0; d < 360; d += 30) {
      if (d / 360 > k) break;
      const a = rot1 + (d * Math.PI) / 180;
      g.fillText(`${d}°`, Math.cos(a) * (R1 + S * 0.13), Math.sin(a) * (R1 + S * 0.13));
    }
    // The Campaign's name engraved along the top of the outer ring, letter by letter.
    const shown = Math.floor(name.length * smooth(0.35, 1, k));
    if (shown > 0) {
      g.font = `600 ${Math.max(10, S * 0.075)}px system-ui, sans-serif`;
      g.fillStyle = rgba(own2, 0.95 * k);
      // Letters set by their own widths along the arc, a little spaced out.
      const rr = R3 - S * 0.09;
      const ws = [...name].map((c) => g.measureText(c).width * 1.3);
      const total = ws.reduce((x, y) => x + y, 0);
      let at = -Math.PI / 2 - total / rr / 2;
      for (let i = 0; i < shown; i++) {
        const a = at + ws[i]! / rr / 2;
        at += ws[i]! / rr;
        g.save();
        g.rotate(a + Math.PI / 2);
        g.fillText(name[i]!, 0, -rr);
        g.restore();
      }
    }
    g.globalCompositeOperation = "lighter";
    // The outer ring with four turning brackets, and faint spokes.
    g.strokeStyle = rgba(own, 0.35 * k);
    g.lineWidth = Math.max(1, S * 0.005);
    g.beginPath();
    g.arc(0, 0, R3, 0, TAU * k);
    g.stroke();
    g.strokeStyle = rgba(own, 0.8 * k);
    g.lineWidth = Math.max(1.5, S * 0.012);
    const rot3 = t * 0.15;
    for (let q = 0; q < 4; q++) {
      g.beginPath();
      g.arc(0, 0, R3 + S * 0.03, rot3 + (q * TAU) / 4, rot3 + (q * TAU) / 4 + 0.35 * k);
      g.stroke();
    }
    g.strokeStyle = rgba(own, 0.12 * k);
    g.lineWidth = 1;
    g.beginPath();
    for (let q = 0; q < 8; q++) {
      const a = (q * TAU) / 8 + rot1;
      g.moveTo(Math.cos(a) * S * 0.15, Math.sin(a) * S * 0.15);
      g.lineTo(Math.cos(a) * R1 * k, Math.sin(a) * R1 * k);
    }
    g.stroke();
    g.restore();
  }
}
