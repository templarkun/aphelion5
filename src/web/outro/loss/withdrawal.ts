/**
 * Withdrawal (designer 2026-11-24), a loss outro: from high orbit over the lost planet. Crimson
 * veins of the enemy spread over the night side and the Company's lights on the ground go out one
 * by one; evacuation craft climb to the Flagship, hostile fire takes one of them; the jump drive
 * gathers light at the prow (particles spiralling in), a flash, the ship stretches away and is gone,
 * a ring of light behind it. The aftermath: the planet glowing crimson, debris drifting by. Generic:
 * the Flagship is a plain long hull, not any Company's outline, painted in the Company's colours;
 * the planet is no Campaign's. Everything is worked out from the film time alone.
 */

import type { CompanyTheme } from "../types.js";
import { craftEnd, craftLaunch, hash01, veinReach, WITHDRAW } from "./timeline.js";
import { clamp01, EMBER, frameOf, glow, grain, HOSTILE, lerp, rgba, rgbOf, smooth, sprite, vignette, type LossScene } from "./kit.js";

const T = WITHDRAW;

/** The plain hull, nose to the right, in units of its length (-0.5 .. 0.5). */
const HULL: [number, number][] = [
  [0.5, 0], [0.3, -0.045], [0.08, -0.07], [-0.12, -0.08], [-0.2, -0.15], [-0.34, -0.16], [-0.38, -0.09], [-0.5, -0.07],
  [-0.5, 0.07], [-0.4, 0.1], [-0.3, 0.13], [-0.12, 0.09], [0.1, 0.06], [0.3, 0.04],
];

export function createWithdrawalScene({ theme }: { theme: CompanyTheme }): LossScene {
  const own = rgbOf(theme.primary);
  const own2 = rgbOf(theme.secondary);
  const hull = rgbOf(theme.hull);
  const livery = rgbOf(theme.livery);

  // Points on the planet's face (unit disc, upper part: the lower is off the picture). Veins of the enemy and the Company's lights.
  const seeds = [
    { u: -0.42, v: -0.5 },
    { u: 0.35, v: -0.62 },
    { u: 0.05, v: -0.25 },
  ];
  const pts = Array.from({ length: 170 }, (_, i) => {
    let u = 0;
    let v = 0;
    for (let k = 0; k < 12; k++) {
      u = hash01(i * 7 + k * 101) * 2 - 1;
      v = -hash01(i * 13 + k * 89) * 0.95;
      if (u * u + v * v < 0.93) break;
    }
    const d = Math.min(...seeds.map((s) => Math.hypot(s.u - u, s.v - v)));
    return { u, v, d, city: i % 3 === 0, size: 0.5 + hash01(i * 3 + 1) };
  });
  const maxD = Math.max(...pts.map((p) => p.d));
  const ignite = pts.map((p, i) => T.OVERRUN_AT + (p.d / maxD) * (T.VEINS_FULL - T.OVERRUN_AT - 0.6) + hash01(i * 17) * 0.6);
  // Each vein point joins its two nearest vein points.
  const veins = pts.map((p, i) => ({ i, p })).filter((x) => !x.p.city);
  const links: [number, number][] = [];
  for (const a of veins) {
    const near = veins.filter((b) => b.i !== a.i).sort((x, y) => Math.hypot(x.p.u - a.p.u, x.p.v - a.p.v) - Math.hypot(y.p.u - a.p.u, y.p.v - a.p.v)).slice(0, 2);
    for (const b of near) if (a.i < b.i) links.push([a.i, b.i]);
  }
  const craftFrom = Array.from({ length: T.CRAFTS }, (_, k) => ({ u: -0.55 + (k / (T.CRAFTS - 1)) * 1.0 + (hash01(k * 5) - 0.5) * 0.08, v: -0.55 - hash01(k * 9) * 0.3 }));

  return {
    draw(g, w, h, t, free, quality) {
      const k = smooth(T.DEBRIEF_AT - 0.2, T.DEBRIEF_AT + 0.7, t);
      const { cx, cy, s } = frameOf(w, h, free, k);
      const drift = -t * s * 0.006;
      // Space.
      g.fillStyle = "#010207";
      g.fillRect(0, 0, w, h);
      g.save();
      g.globalCompositeOperation = "lighter";
      const star = sprite([210, 225, 255]);
      for (let i = 0; i < 240; i++) {
        const x = ((hash01(i * 3) * 1.2 - 0.1) * w + drift * 0.3 + w * 2) % (w * 1.2);
        const y = hash01(i * 5 + 1) * h;
        const tw = 0.55 + 0.45 * Math.sin(t * (1 + hash01(i) * 2) + i);
        glow(g, star, x, y, 1 + hash01(i * 7) * 1.6, 0.35 * tw);
      }
      g.restore();

      // The planet: a big dark night side low in the picture, a burning rim.
      const R = s * 0.66;
      const pcx = cx - s * 0.12 + drift;
      const pcy = cy + s * 0.62;
      const face = g.createRadialGradient(pcx - R * 0.3, pcy - R * 0.5, R * 0.1, pcx, pcy, R);
      face.addColorStop(0, "#0d1018");
      face.addColorStop(1, "#030407");
      g.fillStyle = face;
      g.beginPath();
      g.arc(pcx, pcy, R, 0, Math.PI * 2);
      g.fill();
      const burn = veinReach(t);
      g.save();
      g.globalCompositeOperation = "lighter";
      // The air at the rim, sickly and burning as the veins spread.
      const rim = g.createRadialGradient(pcx, pcy, R * 0.97, pcx, pcy, R * 1.07);
      rim.addColorStop(0, rgba(HOSTILE, 0));
      rim.addColorStop(0.35, rgba(EMBER, 0.22 + burn * 0.25));
      rim.addColorStop(1, rgba(HOSTILE, 0));
      g.fillStyle = rim;
      g.beginPath();
      g.arc(pcx, pcy, R * 1.08, 0, Math.PI * 2);
      g.fill();
      const at = (u: number, v: number): [number, number, number] => [pcx + u * R, pcy + v * R, Math.sqrt(Math.max(0, 1 - u * u - v * v))];
      // Veins.
      // Veins: streams of crimson particles creeping along bent ways between the points, a faint glow under them.
      g.lineCap = "round";
      const spV = sprite(HOSTILE);
      const spV2 = sprite(EMBER);
      links.forEach(([a, b], li) => {
        const ta = ignite[a]!;
        const tb = ignite[b]!;
        const from = ta <= tb ? a : b;
        const to = from === a ? b : a;
        const on = smooth(Math.min(ta, tb), Math.max(ta, tb) + 0.4, t);
        if (on <= 0) return;
        const [x1, y1, z1] = at(pts[from]!.u, pts[from]!.v);
        const [x2, y2, z2] = at(pts[to]!.u, pts[to]!.v);
        const bend = (hash01(li * 7 + 1) - 0.5) * 0.5;
        const mx = (x1 + x2) / 2 - (y2 - y1) * bend;
        const my = (y1 + y2) / 2 + (x2 - x1) * bend;
        const pt = (u: number): [number, number] => {
          const v = 1 - u;
          return [v * v * x1 + 2 * v * u * mx + u * u * x2, v * v * y1 + 2 * v * u * my + u * u * y2];
        };
        const depth = Math.min(z1, z2) * 0.7 + 0.3;
        g.strokeStyle = rgba(HOSTILE, 0.09 * on * depth);
        g.lineWidth = Math.max(1.5, s * 0.005);
        g.beginPath();
        g.moveTo(x1, y1);
        for (let q = 1; q <= 8; q++) {
          const [x, y] = pt((q / 8) * on);
          g.lineTo(x, y);
        }
        g.stroke();
        const n = Math.round(6 * (0.4 + quality * 0.6));
        for (let q = 0; q < n; q++) {
          const u = ((q + hash01(li * 13 + q) * 0.6) / n + t * 0.12) % 1;
          if (u > on) continue;
          const [x, y] = pt(u);
          const fl = 0.55 + 0.45 * Math.sin(t * 8 + li + q * 2.1);
          glow(g, q % 3 ? spV : spV2, x, y, s * 0.0045 * depth * (0.7 + fl * 0.5), 0.6 * fl * depth);
        }
      });
      const spH = sprite(HOSTILE);
      const spE = sprite(EMBER);
      const spCity = sprite(own2);
      pts.forEach((p, i) => {
        const [x, y, z] = at(p.u, p.v);
        const tI = ignite[i]!;
        if (p.city) {
          // A Company light on the ground: it flickers and goes out as the enemy reaches it.
          const out = smooth(tI - 0.2, tI + 0.25, t);
          const stutter = out > 0 && out < 1 && hash01(Math.floor(t * 20) + i) < 0.4 ? 0.3 : 1;
          glow(g, spCity, x, y, s * 0.006 * p.size * (0.4 + z * 0.6), (1 - out) * 0.75 * stutter);
        } else if (t >= tI) {
          const age = t - tI;
          const fl = 0.65 + 0.35 * Math.sin(t * 7 + i * 2.3);
          glow(g, i % 4 ? spH : spE, x, y, s * 0.008 * p.size * (0.4 + z * 0.6) * (1 + Math.max(0, 1 - age * 2) * 1.5), (0.5 + 0.3 * fl) * Math.min(1, age * 3));
        }
      });
      // Fires where the enemy came in.
      for (const sd of seeds) {
        const [x, y] = at(sd.u, sd.v);
        const p = 0.8 + 0.2 * Math.sin(t * 2.2 + sd.u * 9);
        glow(g, spE, x, y, s * 0.05 * (0.5 + burn) * p, 0.4 * smooth(T.OVERRUN_AT, T.OVERRUN_AT + 1, t));
      }
      g.restore();

      // The Flagship (until the jump).
      const L = s * 0.36;
      const fx0 = cx + s * 0.16 + drift * 0.5;
      const fy0 = cy - s * 0.2 + Math.sin(t * 0.7) * s * 0.004;
      const prow: [number, number] = [fx0 + L * 0.55, fy0];
      const jumpU = clamp01((t - T.JUMP_AT) / 0.28);
      const charge = smooth(T.CHARGE_AT, T.JUMP_AT, t);
      if (jumpU < 1) {
        const stretch = 1 + jumpU * jumpU * 9;
        const fx = fx0 + jumpU * jumpU * w * 0.9;
        g.save();
        g.globalAlpha = 1 - jumpU * 0.7;
        g.translate(fx, fy0);
        g.scale(stretch, 1);
        // Engine plumes behind.
        g.globalCompositeOperation = "lighter";
        const spOwn = sprite(own);
        for (const ey of [-0.045, 0, 0.045]) {
          const fl = 0.8 + 0.2 * Math.sin(t * 31 + ey * 50);
          for (let j = 0; j < 16; j++) glow(g, spOwn, -L * (0.5 + j * 0.016 * (1 + charge)), L * ey, (L * 0.042 * (1 - j / 18) * fl * (1 + charge * 0.6)) / Math.sqrt(stretch), 0.32 * (1 - j / 16));
        }
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1 - jumpU * 0.7;
        // The hull, lit from above and by the planet's red glow below.
        const body = g.createLinearGradient(0, -L * 0.16, 0, L * 0.13);
        body.addColorStop(0, rgba([Math.min(255, hull[0] + 120), Math.min(255, hull[1] + 120), Math.min(255, hull[2] + 120)], 1));
        body.addColorStop(0.3, rgba([Math.min(255, hull[0] * 1.35), Math.min(255, hull[1] * 1.35), Math.min(255, hull[2] * 1.35)], 1));
        body.addColorStop(0.7, rgba([hull[0] * 0.6, hull[1] * 0.58, hull[2] * 0.6], 1));
        body.addColorStop(1, rgba([150 + burn * 70, 60, 40], 1));
        g.fillStyle = body;
        g.beginPath();
        HULL.forEach(([x, y], i) => (i ? g.lineTo(x * L, y * L) : g.moveTo(x * L, y * L)));
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.35)";
        g.lineWidth = 1 / stretch;
        g.stroke();
        // Plating seams.
        g.strokeStyle = "rgba(0,0,0,0.35)";
        for (const x of [0.22, 0.05, -0.12, -0.28, -0.42]) {
          g.beginPath();
          g.moveTo(L * x, -L * 0.07);
          g.lineTo(L * (x - 0.02), L * 0.08);
          g.stroke();
        }
        // Livery stripe and a row of windows.
        g.fillStyle = rgba(livery, 0.9);
        g.beginPath();
        g.moveTo(L * 0.34, -L * 0.012);
        g.lineTo(-L * 0.36, -L * 0.03);
        g.lineTo(-L * 0.36, -L * 0.012);
        g.lineTo(L * 0.34, L * 0.002);
        g.closePath();
        g.fill();
        g.globalCompositeOperation = "lighter";
        const spWin = sprite(own2);
        for (let j = 0; j < 16; j++) {
          const lit = hash01(j * 7 + Math.floor(t * 0.8)) > 0.25;
          if (lit) glow(g, spWin, L * (0.2 - j * 0.036), L * 0.03, L * 0.008, 0.65);
        }
        // Battle damage: small fires on the hull.
        for (let j = 0; j < 4; j++) {
          const fl = 0.6 + 0.4 * Math.sin(t * (9 + j) + j * 4);
          glow(g, j % 2 ? spE : spH, L * (-0.3 + j * 0.17), L * (j % 2 ? -0.06 : 0.05), L * 0.025 * fl, 0.55 * fl);
        }
        g.restore();
      }
      g.save();
      g.globalCompositeOperation = "lighter";

      // Evacuation craft, and the hostile fire that takes one.
      const spOwn = sprite(own);
      const spWhite = sprite([255, 255, 255]);
      for (let c = 0; c < T.CRAFTS; c++) {
        const t0 = craftLaunch(c);
        const t1 = craftEnd(c);
        if (t < t0) continue;
        const from = at(craftFrom[c]!.u, craftFrom[c]!.v);
        const to: [number, number] = [fx0 + L * (-0.25 + (c % 6) * 0.06), fy0 + L * 0.09];
        const ctl: [number, number] = [lerp(from[0], to[0], 0.2), Math.min(from[1], to[1]) - s * 0.12];
        const lost = c === T.CRAFT_LOST;
        const pathAt = (u: number): [number, number] => {
          const e = u * u * (3 - 2 * u);
          const a = 1 - e;
          return [a * a * from[0] + 2 * a * e * ctl[0] + e * e * to[0], a * a * from[1] + 2 * a * e * ctl[1] + e * e * to[1]];
        };
        const full = T.CRAFT_FLY;
        const u = (t - t0) / full;
        const uEnd = (t1 - t0) / full;
        if (t < t1) {
          for (let j = 0; j < 7; j++) {
            const uu = u - j * 0.018;
            if (uu < 0) break;
            const [x, y] = pathAt(uu);
            glow(g, j ? spOwn : spWhite, x, y, s * (j ? 0.004 : 0.006) * (1 - j / 8), j ? 0.5 * (1 - j / 7) : 0.95);
          }
          if (lost && t > t1 - 0.3) {
            // The bolt that reaches it.
            const [x, y] = pathAt(u);
            const src = at(-0.1, -0.35);
            const b = clamp01((t - (t1 - 0.3)) / 0.3);
            for (let j = 0; j < 8; j++) {
              const bb = b - j * 0.04;
              if (bb < 0) break;
              glow(g, spH, lerp(src[0], x, bb), lerp(src[1], y, bb), s * 0.006 * (1 - j / 9), 0.8 * (1 - j / 8));
            }
          }
        } else if (lost) {
          const [x, y] = pathAt(uEnd);
          const b = (t - t1) / 0.9;
          if (b < 1) {
            glow(g, spWhite, x, y, s * 0.03 * (1 - b), 1 - b);
            for (let j = 0; j < 14; j++) {
              const an = hash01(j * 13 + 3) * Math.PI * 2;
              const r = s * 0.05 * (1 - Math.pow(1 - b, 2)) * (0.4 + hash01(j));
              glow(g, j % 2 ? spH : spE, x + Math.cos(an) * r, y + Math.sin(an) * r + b * b * s * 0.01, s * 0.004 * (1 - b), (1 - b) * 0.9);
            }
          }
        } else if (t < t1 + 0.25 && jumpU < 1) {
          // Docked: a small flash on the hull.
          glow(g, spOwn, to[0], to[1], s * 0.012, (1 - (t - t1) / 0.25) * 0.8);
        }
      }
      // Hostile flak climbing at the ship and missing.
      if (t > T.CRAFT_AT - 0.4 && t < T.JUMP_AT + 0.2) {
        for (let j = 0; j < 10; j++) {
          const per = 1.1 + hash01(j * 7) * 0.6;
          const ph = (t - T.CRAFT_AT + 0.4 + hash01(j * 3) * per) / per;
          const cyc = Math.floor(ph);
          const f = ph - cyc;
          const src = at(hash01(j * 11 + cyc) * 1.2 - 0.6, -0.4 - hash01(j * 5 + cyc) * 0.3);
          const aim: [number, number] = [fx0 + (hash01(j * 17 + cyc) - 0.3) * L * 1.6, fy0 - L * (0.25 + hash01(j * 19 + cyc) * 0.4)];
          for (let q = 0; q < 5; q++) {
            const ff = f - q * 0.03;
            if (ff < 0) break;
            glow(g, spH, lerp(src[0], aim[0], ff), lerp(src[1], aim[1], ff), s * 0.0035 * (1 - q / 6), (1 - f) * 0.6 * (1 - q / 5));
          }
        }
      }

      // The jump drive: light gathering at the prow, then the flash, the streak and the ring.
      if (charge > 0 && jumpU < 1) {
        for (let j = 0; j < 90; j++) {
          if (hash01(j * 29 + 1) > 0.35 + quality * 0.65) continue;
          const rate = 0.9 + hash01(j * 3) * 0.8;
          const age = ((t - T.CHARGE_AT) * rate + hash01(j * 5)) % 1;
          const an = hash01(j * 7) * Math.PI * 2 + age * 2.2;
          const r = L * (0.18 + hash01(j * 11) * 0.5) * (1 - age);
          glow(g, j % 3 ? spOwn : sprite(own2), prow[0] + Math.cos(an) * r, prow[1] + Math.sin(an) * r * 0.7, s * 0.004, charge * Math.sin(age * Math.PI) * 0.9);
        }
        glow(g, spWhite, prow[0], prow[1], L * 0.06 * (0.5 + charge * 1.5), 0.5 + charge * 0.5);
        glow(g, spOwn, prow[0], prow[1], L * 0.18 * charge, 0.6 * charge);
        g.strokeStyle = rgba(own, 0.5 * charge);
        g.lineWidth = 1.5;
        g.beginPath();
        g.ellipse(prow[0] + L * 0.05, prow[1], L * 0.04 * (1 + charge), L * 0.12 * (0.4 + charge), 0, 0, Math.PI * 2);
        g.stroke();
      }
      if (t >= T.JUMP_AT) {
        const b = (t - T.JUMP_AT) / 1.6;
        if (b < 1) {
          // The streak to beyond the edge.
          const sk = g.createLinearGradient(prow[0], 0, w, 0);
          sk.addColorStop(0, rgba(own, 0));
          sk.addColorStop(0.15, rgba([255, 255, 255], 0.9 * (1 - b)));
          sk.addColorStop(1, rgba(own, 0.4 * (1 - b)));
          g.fillStyle = sk;
          const th = L * 0.03 * (1 - b);
          g.fillRect(prow[0], prow[1] - th / 2, w - prow[0], th);
          // The ring of light behind it, made of particles.
          const rr = L * (0.2 + b * 1.9);
          for (let j = 0; j < 180; j++) {
            if (hash01(j * 31) > 0.4 + quality * 0.6) continue;
            const an = (j / 180) * Math.PI * 2 + hash01(j) * 0.05;
            const jr = rr * (0.94 + hash01(j * 3 + 1) * 0.12);
            glow(g, j % 5 ? spOwn : spWhite, prow[0] + Math.cos(an) * jr * 0.35, prow[1] + Math.sin(an) * jr, s * 0.006 * (1 - b * 0.5), (1 - b) * 0.55);
          }
          glow(g, spOwn, prow[0], prow[1], rr * 0.5, (1 - b) * 0.25);
        }
      }
      // Debris drifting through: torn plates, lit red from below.
      g.restore();
      for (let j = 0; j < 26; j++) {
        if (hash01(j * 37) > 0.4 + quality * 0.6) continue;
        const sp = 0.012 + hash01(j * 3) * 0.03;
        const x = ((hash01(j * 5) + t * sp) % 1.2) * w * 1.1 - w * 0.1;
        const y = (0.1 + hash01(j * 7) * 0.65) * h + Math.sin(t * 0.3 + j) * 6;
        const size = s * (0.003 + hash01(j * 11) * 0.008);
        const a = t * (0.4 + hash01(j * 13)) * (j % 2 ? 1 : -1) + j;
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = `rgba(${30 + burn * 30},${28},${32},0.95)`;
        g.beginPath();
        g.moveTo(-size, -size * 0.4);
        g.lineTo(size * 0.8, -size * 0.6);
        g.lineTo(size, size * 0.5);
        g.lineTo(-size * 0.6, size * 0.6);
        g.closePath();
        g.fill();
        g.strokeStyle = rgba(EMBER, 0.35);
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }
      // The jump's white flash over everything.
      if (t >= T.JUMP_AT && t < T.JUMP_AT + 0.4) {
        g.fillStyle = `rgba(255,255,255,${0.55 * (1 - (t - T.JUMP_AT) / 0.4)})`;
        g.fillRect(0, 0, w, h);
      }
      vignette(g, w, h, 0.65);
      grain(g, w, h, t, 0.1);
    },
  };
}
