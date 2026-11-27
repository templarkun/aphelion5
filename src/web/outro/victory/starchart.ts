/**
 * Star Chart (designer 2026-11-27), a victory outro: the won Campaign written into the sky. In the
 * dark, one star ignites per mission won, in the order played, its tag ("M2X") beside it; small
 * companion stars, one per Threat column conquered, circle it. Streams of particles run from star to
 * star and draw the Campaign's own constellation (its shape comes from the missions played, so no two
 * Campaigns quite match). The constellation flares, a ring of light runs out, and the camera pulls far
 * back: a whole spiral galaxy turns round it, the new constellation marked on one of its arms. Then a
 * slow turn while the Debrief slides in. The Company lends its colours; it suits any Company and any
 * Campaign. Everything is worked out from the film time alone (a skip, a still).
 */

import type { CampaignStats, CompanyTheme } from "../types.js";
import { frameOf, glow, grain, lerp, rgba, rgbOf, smooth, sprite, vignette, type FreeArea, type LossScene } from "../loss/kit.js";
import { CHART, hash01, linkTimes, pullBack, starPlaces, starTimes } from "./timeline.js";

const T = CHART;
const TAU = Math.PI * 2;

/** Where the galaxy's middle is, seen from the constellation (constellation units), and its size. */
const GALAXY = { x: -4.2, y: 2.1, r: 7.5, arms: 3 };

export function createStarChartScene({ theme, stats }: { theme: CompanyTheme; stats: CampaignStats }): LossScene {
  const own = rgbOf(theme.primary);
  const own2 = rgbOf(theme.secondary);
  const glowC = rgbOf(theme.glow);
  const white: [number, number, number] = [255, 255, 255];
  const missions = stats.missions.length ? stats.missions : [{ id: "", label: "", tag: "", threat: ["A"] }];
  const n = missions.length;
  const places = starPlaces(n);
  const ignite = starTimes(n);
  const links = linkTimes(n);
  const centre = places.reduce((c, p) => ({ x: c.x + p.x / n, y: c.y + p.y / n }), { x: 0, y: 0 });
  const dust = Array.from({ length: 220 }, (_, k) => ({ x: hash01(k * 3 + 1), y: hash01(k * 5 + 2), b: 0.2 + hash01(k * 7 + 3) * 0.8 }));
  // The galaxy: points along log spirals, thicker near the middle; each knows its arm, distance and scatter.
  const GAL = 2200;
  const galaxy = Array.from({ length: GAL }, (_, k) => {
    const arm = k % GALAXY.arms;
    const d = Math.pow(hash01(k * 11 + 4), 0.7);
    const a = (arm * TAU) / GALAXY.arms + d * 4.2 + (hash01(k * 13 + 5) - 0.5) * (0.5 + (1 - d) * 0.9);
    const sc = (hash01(k * 17 + 6) - 0.5) * 0.12;
    return { a, d: d + sc, b: 0.25 + hash01(k * 19 + 7) * 0.75, warm: hash01(k * 23 + 8), rank: hash01(k * 29 + 9) };
  });
  // Nebula clouds, painted once into their own picture (soft and slow; nothing in them moves).
  let nebula: HTMLCanvasElement | undefined;
  function nebulaOf(): HTMLCanvasElement {
    if (nebula) return nebula;
    nebula = document.createElement("canvas");
    nebula.width = nebula.height = 256;
    const q = nebula.getContext("2d")!;
    q.globalCompositeOperation = "lighter";
    for (let k = 0; k < 26; k++) {
      const x = hash01(k * 31) * 256;
      const y = hash01(k * 37) * 256;
      const r = 30 + hash01(k * 41) * 90;
      const c = k % 3 === 0 ? own : k % 3 === 1 ? glowC : own2;
      const gr = q.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(c, 0.06 + hash01(k * 43) * 0.06));
      gr.addColorStop(1, rgba(c, 0));
      q.fillStyle = gr;
      q.fillRect(0, 0, 256, 256);
    }
    return nebula;
  }

  return {
    draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free: FreeArea | undefined, quality: number): void {
      const fr = frameOf(w, h, free, smooth(T.DEBRIEF_AT - 0.2, T.DEBRIEF_AT + 1.0, t));
      const pb = pullBack(t);
      // Close on the constellation (with a slow push-in), then far back to the galaxy.
      const zoom = lerp(1 + smooth(0, T.ASCEND_AT, t) * 0.08, 0.135, pb) * (1 - Math.max(0, t - T.PULL_END) * 0.004);
      const S = fr.s * 0.38 * zoom;
      // The camera's aim: the constellation's middle, then a point between it and the galaxy's middle.
      const aim = { x: lerp(centre.x, lerp(centre.x, GALAXY.x, 0.55), pb), y: lerp(centre.y, lerp(centre.y, GALAXY.y, 0.55), pb) };
      const turn = (t - T.ASCEND_AT) * 0.02 * pb;
      const ct = Math.cos(turn);
      const st = Math.sin(turn);
      /** Constellation units -> picture points, the whole sky turning slowly round the galaxy's middle once it shows. */
      const P = (x: number, y: number): [number, number] => {
        const dx = x - GALAXY.x;
        const dy = y - GALAXY.y;
        const rx = GALAXY.x + dx * ct - dy * st;
        const ry = GALAXY.y + dx * st + dy * ct;
        return [fr.cx + (rx - aim.x) * S, fr.cy + (ry - aim.y) * S];
      };
      const spOwn = sprite(own);
      const spOwn2 = sprite(own2);
      const spGlow = sprite(glowC);
      const spWhite = sprite(white);

      g.fillStyle = "#010208";
      g.fillRect(0, 0, w, h);
      // Nebula and far dust, drifting a little with the camera.
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.9 - pb * 0.5;
      const nb = nebulaOf();
      const big = Math.max(w, h) * 1.4;
      g.drawImage(nb, (w - big) / 2 - aim.x * fr.s * 0.03, (h - big) / 2 - aim.y * fr.s * 0.03, big, big);
      g.globalAlpha = 1;
      for (const d of dust) {
        const a = d.b * (0.5 + 0.5 * Math.sin(t * 1.3 + d.x * 50)) * (1 - pb * 0.6);
        g.fillStyle = `rgba(200,215,255,${a * 0.6})`;
        g.fillRect(d.x * w, d.y * h, 1.2, 1.2);
      }

      // The galaxy, coming into view as the camera pulls back.
      const gv = smooth(0.15, 0.85, pb);
      if (gv > 0) {
        const [gx, gy] = P(GALAXY.x, GALAXY.y);
        const gr = GALAXY.r * S;
        const core = g.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.35);
        core.addColorStop(0, `rgba(255,236,210,${0.55 * gv})`);
        core.addColorStop(0.3, rgba(glowC, 0.18 * gv));
        core.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = core;
        g.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
        const spin = t * 0.015;
        for (const p of galaxy) {
          if (p.rank > quality * 1.1) continue;
          const a = p.a + spin + turn;
          const r = p.d * gr;
          const x = gx + Math.cos(a) * r;
          const y = gy + Math.sin(a) * r * 0.62;
          if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
          const c = p.warm < 0.25 ? "255,220,180" : p.warm < 0.7 ? "200,215,255" : `${glowC[0]},${glowC[1]},${glowC[2]}`;
          const a2 = p.b * gv * (1 - p.d * 0.45);
          if (p.rank < 0.07) {
            // A few bright stars along the arms, drawn as soft lights.
            glow(g, p.warm < 0.5 ? spWhite : spGlow, x, y, 2.2 + p.b * 2.5, a2 * 0.7);
            continue;
          }
          g.fillStyle = `rgba(${c},${a2})`;
          const sz = p.d < 0.25 ? 2.2 : 1.6;
          g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
      }

      // The links: streams of particles from star to star, then a faint filament with light running along it.
      links.forEach((l, i) => {
        if (t < l) return;
        const a = places[i]!;
        const b = places[i + 1]!;
        const u = smooth(l, l + T.LINK_FLY, t);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const M = Math.max(6, Math.round(len * 46 * quality));
        const flare = t >= T.ASCEND_AT ? 1 + 1.4 * Math.exp(-(t - T.ASCEND_AT) * 2.2) : 1;
        for (let j = 0; j < M; j++) {
          const v = j / M;
          if (v > u) break;
          const wob = Math.sin(v * 18 + t * 3 + i) * 0.006 * (1 - u);
          const [x, y] = P(lerp(a.x, b.x, v) - (b.y - a.y) * wob, lerp(a.y, b.y, v) + (b.x - a.x) * wob);
          glow(g, spOwn, x, y, Math.max(1.2, S * 0.012) * flare, (0.22 + 0.2 * (1 - pb)) * flare);
        }
        // The stream's bright head while it runs; afterwards motes travel along the line.
        if (u < 1) {
          const [x, y] = P(lerp(a.x, b.x, u), lerp(a.y, b.y, u));
          glow(g, spWhite, x, y, Math.max(2, S * 0.03), 1);
          for (let j = 1; j < 10; j++) {
            const v = Math.max(0, u - j * 0.03);
            const [tx, ty] = P(lerp(a.x, b.x, v) + (hash01(j * 7 + i) - 0.5) * 0.03, lerp(a.y, b.y, v) + (hash01(j * 11 + i) - 0.5) * 0.03);
            glow(g, spOwn2, tx, ty, Math.max(1.5, S * 0.018) * (1 - j / 10), 0.7 * (1 - j / 10));
          }
        } else {
          for (let j = 0; j < 3; j++) {
            const v = (t * 0.45 + j / 3 + hash01(i * 13)) % 1;
            const [x, y] = P(lerp(a.x, b.x, v), lerp(a.y, b.y, v));
            glow(g, spOwn2, x, y, Math.max(1.5, S * 0.02), 0.6 * (1 - pb * 0.5));
          }
        }
      });

      // The stars, one per mission won, with their Threat companions.
      const asc = t >= T.ASCEND_AT ? t - T.ASCEND_AT : -1;
      missions.forEach((m, i) => {
        const at = ignite[i]!;
        if (t < at - 0.25) return;
        const p = places[i]!;
        const [x, y] = P(p.x, p.y);
        const base = Math.max(2.5, S * 0.05);
        if (t < at) {
          // Light gathering into the point.
          const k = smooth(at - 0.25, at, t);
          for (let j = 0; j < 10; j++) {
            const a = (j / 10) * TAU + hash01(j + i * 10);
            const r = base * 3 * (1 - k);
            glow(g, spOwn, x + Math.cos(a) * r, y + Math.sin(a) * r, base * 0.18, k);
          }
          return;
        }
        const d = t - at;
        const fl = asc >= 0 ? 1 + 2.2 * Math.exp(-asc * 2) : 1;
        const tw = 0.85 + 0.15 * Math.sin(t * 4 + i * 2.1);
        glow(g, spOwn, x, y, base * (1.4 + 3 * Math.exp(-d * 3)) * fl, 0.75 * tw);
        glow(g, spWhite, x, y, base * (0.4 + 0.8 * Math.exp(-d * 4)) * fl, 1);
        // Diffraction spikes.
        g.strokeStyle = rgba(white, 0.5 * tw * Math.min(1, fl));
        g.lineWidth = Math.max(0.8, base * 0.05);
        const sl = base * (2 + 2.5 * Math.exp(-d * 2.5)) * fl;
        g.beginPath();
        g.moveTo(x - sl, y);
        g.lineTo(x + sl, y);
        g.moveTo(x, y - sl * 0.8);
        g.lineTo(x, y + sl * 0.8);
        g.stroke();
        // The ignition ring.
        if (d < 1.0) {
          g.strokeStyle = rgba(own, 0.7 * (1 - d));
          g.lineWidth = Math.max(1, base * 0.08);
          g.beginPath();
          g.arc(x, y, base * (1 + 6 * (1 - Math.exp(-d * 4))), 0, TAU);
          g.stroke();
          const M = Math.round(24 * quality);
          for (let j = 0; j < M; j++) {
            const a = (j / M) * TAU + hash01(j * 5 + i);
            const r = base * (1 + 7 * (1 - Math.exp(-d * 3.5)) * (0.6 + hash01(j * 3 + i) * 0.6));
            glow(g, spOwn2, x + Math.cos(a) * r, y + Math.sin(a) * r, base * 0.12, 0.8 * (1 - d));
          }
        }
        // One small companion per Threat column conquered, circling the star.
        m.threat.forEach((_, c) => {
          const ca = at + T.COMPANION_STEP * (c + 1);
          if (t < ca) return;
          const a = (c / Math.max(1, m.threat.length)) * TAU + t * 0.6 + i;
          const r = Math.max(4, S * 0.11);
          glow(g, spGlow, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, base * 0.45, 0.85 * smooth(ca, ca + 0.2, t));
        });
        // Its tag, until the camera pulls back.
        const ta = smooth(at + 0.1, at + 0.5, t) * (1 - smooth(0.05, 0.35, pb));
        if (ta > 0 && m.tag) {
          g.globalCompositeOperation = "source-over";
          g.globalAlpha = ta * 0.9;
          g.fillStyle = rgba(own2, 1);
          g.font = `600 ${Math.max(10, S * 0.075)}px system-ui, sans-serif`;
          g.textAlign = "center";
          g.fillText(m.tag, x, y + (p.y < centre.y ? -1 : 1) * Math.max(16, S * 0.2) + (p.y < centre.y ? 0 : S * 0.05));
          g.globalAlpha = 1;
          g.globalCompositeOperation = "lighter";
        }
      });

      // Ascension: a ring of light runs out from the constellation and a spray of particles with it.
      if (asc >= 0 && asc < 2.2) {
        const [x, y] = P(centre.x, centre.y);
        const R = fr.s * 0.9 * (1 - Math.exp(-asc * 1.8));
        const fade = 1 - asc / 2.2;
        g.strokeStyle = rgba(own, 0.6 * fade);
        g.lineWidth = Math.max(1.5, fr.s * 0.006 * fade);
        g.beginPath();
        g.arc(x, y, R, 0, TAU);
        g.stroke();
        const M = Math.round(140 * quality);
        for (let j = 0; j < M; j++) {
          const a = (j / M) * TAU + hash01(j * 7) * 0.05;
          const r = R * (0.85 + hash01(j * 13) * 0.3);
          glow(g, j % 4 ? spOwn : spWhite, x + Math.cos(a) * r, y + Math.sin(a) * r, fr.s * 0.005, fade);
        }
        glow(g, spWhite, x, y, fr.s * 0.2 * Math.exp(-asc * 3), Math.exp(-asc * 2.5));
      }

      // Once far back: the constellation marked on the galaxy's arm with turning brackets and its name.
      const mk = smooth(0.7, 1, pb);
      if (mk > 0) {
        const [x, y] = P(centre.x, centre.y);
        const r = Math.max(18, S * 1.25);
        g.globalCompositeOperation = "source-over";
        g.strokeStyle = rgba(own, 0.85 * mk);
        g.lineWidth = 1.5;
        const spinB = t * 0.4;
        for (let k = 0; k < 6; k++) {
          const a0 = spinB + (k * TAU) / 6;
          g.beginPath();
          g.arc(x, y, r, a0, a0 + 0.42);
          g.stroke();
        }
        g.globalAlpha = mk * 0.9;
        g.fillStyle = rgba(own2, 1);
        g.font = `600 ${Math.max(10, fr.s * 0.022)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.fillText(stats.campaignName.toUpperCase(), x, y + r + Math.max(14, fr.s * 0.035));
        g.globalAlpha = 1;
      }

      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      vignette(g, w, h, 0.6);
      grain(g, w, h, t, 0.045);
    },
  };
}
