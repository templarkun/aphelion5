/**
 * Mission Complete, the win (designer 2026-11-20; plan agreed that day). It plays when the mission is
 * won (8.2), once the Field's animations of the winning answer have finished and the Trophies that came
 * in with it have flown to the Mission bar; then the Upgrade sheet (or the next screen) opens.
 *
 * 1. Trophy (0-1.0 s): the Field dims a little; the Mission bar's cells flare one after another, and the
 *    last one bursts.
 * 2. Shine (1.0-2.2 s; designer 2026-11-20, I23, was a ring): a broad band of light in the Company's
 *    colour sweeps across the whole Field, away from the sector the unit left (left to right after the
 *    Developer tool), lighting each sector's edge with a glint as it passes; the units only shiver. It
 *    comes in and goes out beyond the Field's edges, so it never stands still on the Field.
 * 3. Banner (2.2-3.8 s): "MISSION COMPLETE" slams in across the middle of the Field, "ALPHA ELIMINATED
 *    · 6 / 6" under it (I20, to try), and one badge per unit of the objective drops into a row, 0.1 s apart.
 * 4. Clear (3.8-5.0 s): sparks drift, everything fades.
 *
 * Two taps skip it (the screen's CelebrationSkip). Reduced motion and Instant: the banner still for
 * STILL seconds. Every moving thing is worked out from the time alone. Screen only: no rule here.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { easeOut, easeOutBack } from "../anim.js";
import { playMissionComplete, playTrophyLand, playWinSweep } from "../briefing/soundHooks.js";
import { trophyFlights } from "../flyers.js";
import { glyphBadgeUrl } from "../glyphs.js";
import { isStill, speedFactor } from "../motion.js";
import type { CompanyTheme } from "../outro/types.js";
import type { WinShow } from "./detect.js";
import { type ShinePath, arrival, shineAt, shinePath } from "./shine.js";
import { FLY, KILL_TIMES, STILL, WIN, span } from "./timeline.js";

export type Shake = (key: string, now: number) => { dx: number; dy: number } | undefined;

export interface MissionWinProps {
  show: WinShow;
  theme: CompanyTheme;
  /** How many of the objective's Trophies the Mission bar holds back (still flying in). */
  onHold: (n: number) => void;
  /** The units' shiver as the shine passes (installed while the piece plays). */
  onShake: (f: Shake | undefined) => void;
  onDone: () => void;
  /** The kill celebration is playing on the Field (both in one answer: the Trophy flies as its camera pulls out). */
  killOn?: boolean | undefined;
}

interface Geo {
  /** The Field on the page. */
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  /** A tile's height (two hex radii). */
  tile: number;
  /** Sector centres, in the Field's own pixels. */
  sectors: [string, number, number][];
  /** The shine's way across the Field (shine.ts). */
  shine: ShinePath;
  /** The objective's cells in the Mission bar, on the page. */
  cells: DOMRect[];
}

const rgba = (rgb: string, a: number) => `rgba(${rgb.trim().split(/\s+/).join(",")},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** A small fixed random sequence (the same every time). */
function seq(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}
const DRIFT = (() => {
  const r = seq(5150);
  return Array.from({ length: 48 }, () => ({ x: r(), born: 2.45 + r() * 2.2, life: 1.1 + r() * 0.9, rise: 0.18 + r() * 0.3, size: 1.2 + r() * 2.2, gold: r() < 0.55, wob: r() * 6 }));
})();
const BURST = (() => {
  const r = seq(808);
  return Array.from({ length: 16 }, () => ({ a: r() * Math.PI * 2, far: 1.6 + r() * 2.2, gold: r() < 0.6 }));
})();

function measure(show: WinShow): Geo | undefined {
  const el = document.querySelector<HTMLElement>(".field");
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return undefined;
  const raw: Record<string, [number, number]> = JSON.parse(el.dataset.sectors ?? "{}");
  const sectors = Object.entries(raw).map(([k, [x, y]]) => [k, x, y] as [string, number, number]);
  const tile = Number(el.dataset.tile) || Math.min(r.width, r.height) / 6;
  // The shine sweeps away from the sector the unit left, through the Field's middle.
  const shine = shinePath(r.width, r.height, tile, show.from ? raw[show.from] : undefined);
  const cells = [...document.querySelectorAll<HTMLElement>("[data-mission-bar] [data-mission-group] .m-cell")].map((c) => c.getBoundingClientRect());
  return { fx: r.left, fy: r.top, fw: r.width, fh: r.height, tile, sectors, shine, cells };
}

function hexPath(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** One frame of the canvas at time t (s); `still`: the held picture. */
function paint(g: CanvasRenderingContext2D, geo: Geo, t: number, theme: CompanyTheme, still: boolean, fade: number, badges: DOMRect[], bandBox: DOMRect | undefined): void {
  const { fx, fy, fw, fh, tile } = geo;
  const P = theme.primary;
  const out = still ? 1 - fade : span(t, WIN.out);
  const all = 1 - out;
  // The Field dims a little.
  g.fillStyle = `rgba(3,5,12,${(0.34 * (still ? 1 : span(t, WIN.dim)) * all).toFixed(3)})`;
  g.fillRect(fx, fy, fw, fh);
  if (still) return;

  // Act 1: the cells flare one after another; the last one bursts.
  g.save();
  g.globalCompositeOperation = "lighter";
  geo.cells.forEach((c, i) => {
    const at = WIN.cellsAt + i * WIN.cellStep;
    const age = t - at;
    if (age < 0 || age > 0.5) return;
    const k = age < 0.06 ? age / 0.06 : Math.exp(-(age - 0.06) / 0.14);
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const R = Math.max(c.height, c.width) * 2.4;
    const grd = g.createRadialGradient(x, y, 0, x, y, R);
    grd.addColorStop(0, `rgba(255,246,214,${(0.95 * k).toFixed(3)})`);
    grd.addColorStop(0.35, `rgba(255,200,90,${(0.5 * k).toFixed(3)})`);
    grd.addColorStop(1, "rgba(255,170,60,0)");
    g.fillStyle = grd;
    g.fillRect(x - R, y - R, 2 * R, 2 * R);
  });
  const last = geo.cells[geo.cells.length - 1];
  if (last) {
    const at = WIN.cellsAt + (geo.cells.length - 1) * WIN.cellStep + WIN.burstAfter;
    const u = span(t, [at, at + 0.6]);
    if (u > 0 && u < 1) {
      const x = last.left + last.width / 2;
      const y = last.top + last.height / 2;
      const s = Math.max(10, last.height);
      g.strokeStyle = `rgba(255,236,170,${(0.9 * (1 - u)).toFixed(3)})`;
      g.lineWidth = 1 + 3 * (1 - u);
      g.beginPath();
      g.arc(x, y, s * (0.6 + 2.6 * easeOut(u)), 0, Math.PI * 2);
      g.stroke();
      for (const b of BURST) {
        const r0 = s * (0.5 + b.far * easeOut(u));
        g.fillStyle = b.gold ? `rgba(255,214,120,${(1 - u).toFixed(3)})` : rgba(P, 1 - u);
        g.beginPath();
        g.arc(x + Math.cos(b.a) * r0, y + Math.sin(b.a) * r0, 1.6 + 1.2 * (1 - u), 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.restore();

  // Act 2: the shine, clipped to the Field: a broad band of light sweeping across it, a fainter one behind.
  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";
  if (t >= WIN.wave[0] && t <= WIN.wave[1]) {
    const sh = geo.shine;
    const mid = shineAt(sh, t);
    const band = (at: number, half: number, a: number) => {
      const x0 = fx + sh.ux * (at - half);
      const y0 = fy + sh.uy * (at - half);
      const grd = g.createLinearGradient(x0, y0, fx + sh.ux * (at + half), fy + sh.uy * (at + half));
      grd.addColorStop(0, rgba(P, 0));
      grd.addColorStop(0.3, rgba(P, 0.1 * a));
      grd.addColorStop(0.44, rgba(P, 0.3 * a));
      grd.addColorStop(0.485, `rgba(255,255,255,${(0.5 * a).toFixed(3)})`);
      grd.addColorStop(0.5, `rgba(255,255,255,${(0.72 * a).toFixed(3)})`);
      grd.addColorStop(0.515, `rgba(255,255,255,${(0.5 * a).toFixed(3)})`);
      grd.addColorStop(0.56, rgba(P, 0.3 * a));
      grd.addColorStop(0.7, rgba(P, 0.1 * a));
      grd.addColorStop(1, rgba(P, 0));
      g.fillStyle = grd;
      g.fillRect(fx, fy, fw, fh);
    };
    band(mid, sh.band, all);
    band(mid - sh.band * 0.95, sh.band * 0.32, 0.55 * all);
  }
  // Each sector's edge lights as the band comes over it, with a glint on its top corner as its middle passes.
  for (const [, x, y] of geo.sectors) {
    const age = t - arrival(geo.shine, x, y);
    if (age < -0.14) continue;
    const k = (age < 0 ? 1 + age / 0.14 : Math.exp(-age / 0.6)) * all;
    if (k < 0.02) continue;
    hexPath(g, fx + x, fy + y, tile * 0.45);
    g.fillStyle = rgba(P, 0.16 * k);
    g.fill();
    g.strokeStyle = rgba(P, 0.45 * k);
    g.lineWidth = 6 + 6 * k;
    g.stroke();
    g.strokeStyle = `rgba(255,255,255,${(0.9 * k).toFixed(3)})`;
    g.lineWidth = 1.5 + 1.5 * k;
    g.stroke();
    if (age >= 0 && age < 0.42) {
      const gl = Math.sin((Math.PI * age) / 0.42) * all;
      const gx = fx + x + tile * 0.2;
      const gy = fy + y - tile * 0.36;
      const L = tile * 0.34 * gl;
      const glow = g.createRadialGradient(gx, gy, 0, gx, gy, L * 0.7);
      glow.addColorStop(0, `rgba(255,255,255,${(0.85 * gl).toFixed(3)})`);
      glow.addColorStop(1, rgba(P, 0));
      g.fillStyle = glow;
      g.fillRect(gx - L, gy - L, 2 * L, 2 * L);
      g.strokeStyle = `rgba(255,255,255,${(0.9 * gl).toFixed(3)})`;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(gx - L, gy);
      g.lineTo(gx + L, gy);
      g.moveTo(gx, gy - L * 0.7);
      g.lineTo(gx, gy + L * 0.7);
      g.stroke();
    }
  }
  g.restore();

  // Act 3: light streaks out from the banner as it lands; a spark burst as each badge drops in.
  g.save();
  g.globalCompositeOperation = "lighter";
  const ls = span(t, [WIN.slam[1], WIN.slam[1] + 0.4]);
  if (ls > 0 && ls < 1 && bandBox && bandBox.height > 0) {
    const reachX = (fw / 2) * easeOut(ls);
    for (const dir of [-1, 1]) {
      const x0 = fx + fw / 2;
      const grd = g.createLinearGradient(x0, 0, x0 + dir * reachX, 0);
      grd.addColorStop(0, `rgba(255,255,255,${(0.9 * (1 - ls)).toFixed(3)})`);
      grd.addColorStop(1, rgba(P, 0));
      g.strokeStyle = grd;
      g.lineWidth = 3;
      for (const y of [bandBox.top, bandBox.bottom]) {
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x0 + dir * reachX, y);
        g.stroke();
      }
    }
  }
  badges.forEach((b, i) => {
    const at = WIN.badgesAt + i * WIN.badgeStep + WIN.badgeFall;
    const u = span(t, [at, at + 0.45]);
    if (u <= 0 || u >= 1 || b.width < 1) return;
    const x = b.left + b.width / 2;
    const y = b.top + b.height * 0.8;
    for (let j = 0; j < 8; j++) {
      const a = Math.PI + (j / 7) * Math.PI;
      const r0 = b.width * (0.3 + 0.9 * easeOut(u));
      g.fillStyle = j % 2 ? `rgba(255,214,120,${(1 - u).toFixed(3)})` : `rgba(201,166,255,${(1 - u).toFixed(3)})`;
      g.beginPath();
      g.arc(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.6, 1.8 * (1 - u) + 0.6, 0, Math.PI * 2);
      g.fill();
    }
  });
  // Act 4: sparks drift up over the Field.
  for (const s of DRIFT) {
    const age = t - s.born;
    if (age < 0 || age > s.life) continue;
    const u = age / s.life;
    const x = fx + fw * s.x + Math.sin(s.wob + age * 2.2) * tile * 0.12;
    const y = fy + fh * (0.82 - s.rise * u * 2);
    g.fillStyle = s.gold ? `rgba(255,210,120,${(Math.sin(Math.PI * u) * all).toFixed(3)})` : rgba(P, Math.sin(Math.PI * u) * all);
    g.beginPath();
    g.arc(x, y, s.size, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function MissionWin({ show, theme, onHold, onShake, onDone, killOn }: MissionWinProps) {
  // The speed and motion settings as they were when it began.
  const still = useRef(isStill() || speedFactor() === 0).current;
  const speed = useRef(speedFactor() || 1).current;
  const [phase, setPhase] = useState<"wait" | "fly" | "play">("wait");
  const [act, setAct] = useState(0);
  const [acts, setActs] = useState("");
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | undefined>();
  const cv = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLDivElement>(null);
  const flash = useRef<HTMLDivElement>(null);
  const sub = useRef<HTMLDivElement>(null);
  const badgeRow = useRef<HTMLDivElement>(null);
  const cbs = useRef({ onHold, onShake, onDone });
  cbs.current = { onHold, onShake, onDone };
  // When the kill began (both in one answer).
  const killAt = useRef<number | undefined>(undefined);
  if (killOn && killAt.current === undefined) killAt.current = performance.now();
  const badge = glyphBadgeUrl(show.target);

  useEffect(() => {
    let raf = 0;
    let stage: "wait" | "fly" | "play" | "done" = "wait";
    const born = performance.now();
    let flyEnd = 0;
    let holdOff = 0;
    let released = false;
    let landed = false;
    let t0 = 0;
    let geo: Geo | undefined;
    let frames = 0;
    let shownAct = 0;
    let lastT = -1;
    cbs.current.onHold(still ? 0 : show.fresh);
    // The Mission bar glows gold once the win has gone through it (on <html>: React rewrites the bar's own classes).
    const won = (on: boolean) => {
      if (on) document.documentElement.dataset.cbWon = "1";
      else delete document.documentElement.dataset.cbWon;
    };

    const startPlay = (now: number) => {
      stage = "play";
      t0 = now;
      setPhase("play");
      geo = measure(show);
      if (geo) {
        const r = geo;
        setBox({ x: r.fx, y: r.fy, w: r.fw, h: r.fh });
        const tau = new Map(r.sectors.map(([k, x, y]) => [k, arrival(r.shine, x, y)]));
        // The units shiver as the shine passes (no shiver in the still picture).
        if (!still)
          cbs.current.onShake((key, at) => {
            const age = ((at - t0) / 1000) * speed - (tau.get(key) ?? Infinity);
            if (!(age >= 0 && age < 0.6)) return undefined;
            const A = r.tile * 0.06 * Math.exp(-age / 0.2);
            return { dx: A * Math.sin(age * 70), dy: A * 0.35 * Math.sin(age * 53 + 1) };
          });
      }
      if (still) {
        playMissionComplete();
        won(true);
      }
    };

    const style = (t: number, fade: number) => {
      const out = still ? 1 - fade : span(t, WIN.out);
      if (root.current) root.current.style.opacity = String(1 - out);
      const s = still ? 1 : span(t, WIN.slam);
      if (band.current) {
        const jolt = !still && t > WIN.slam[1] && t < WIN.slam[1] + 0.3 ? Math.sin((t - WIN.slam[1]) * 60) * 4 * (1 - (t - WIN.slam[1]) / 0.3) : 0;
        band.current.style.opacity = String(s);
        band.current.style.transform = `translateY(${jolt.toFixed(2)}px)`;
      }
      if (title.current) title.current.style.transform = `scale(${(2.3 - 1.3 * (1 - (1 - s) ** 4)).toFixed(4)})`;
      if (flash.current) flash.current.style.opacity = still ? "0" : String(t >= WIN.slam[1] ? Math.max(0, 1 - (t - WIN.slam[1]) / 0.32) : 0);
      const sb = still ? 1 : easeOut(span(t, WIN.sub));
      if (sub.current) {
        sub.current.style.opacity = String(sb);
        sub.current.style.transform = `translateY(${((1 - sb) * 10).toFixed(2)}px)`;
      }
      const imgs = badgeRow.current ? [...badgeRow.current.children] : [];
      imgs.forEach((el, i) => {
        const at = WIN.badgesAt + i * WIN.badgeStep;
        const u = still ? 1 : span(t, [at, at + WIN.badgeFall]);
        const e = el as HTMLElement;
        e.style.opacity = String(still ? 1 : Math.min(1, u * 4));
        e.style.transform = `translateY(${(-38 * (1 - easeOutBack(u))).toFixed(2)}px)`;
      });
    };

    const loop = (now: number) => {
      const busy = document.querySelector(".field")?.getAttribute("data-anim") === "1";
      if (stage === "wait") {
        // The Field's own animations of this answer first. Both in one answer: the Trophy flies as the kill's
        // camera pulls out (most of the way back first: the chip leaves from the sector's place on the whole Field).
        const back = (KILL_TIMES[show.kill ?? ""] ?? KILL_TIMES.alphaDown!).back[0];
        const pullOut = killAt.current !== undefined && now >= killAt.current + ((back + 0.5) * 1000) / speed;
        if (now - born > 120 && (!busy || (pullOut && !still))) {
          if (!still && show.flights) {
            stage = "fly";
            setPhase("fly");
            trophyFlights(show.before, show.state);
            const n = Math.max(1, Math.min(8, show.fresh || 1));
            flyEnd = now + (FLY.wait + FLY.flight + FLY.apart * (n - 1)) * 1000 + 60;
            // The cell pops in as the chip lands (the Mission bar's own pop waits 0.35 s).
            holdOff = flyEnd - 410;
          } else {
            cbs.current.onHold(0);
            startPlay(now);
          }
        }
      } else if (stage === "fly") {
        if (!released && now >= holdOff) {
          released = true;
          cbs.current.onHold(0);
        }
        if (!landed && now >= flyEnd - 60) {
          landed = true;
          playTrophyLand();
        }
        if (now >= flyEnd && !busy) startPlay(now);
      }
      if (stage === "play") {
        const t = ((now - t0) / 1000) * (still ? 1 : speed);
        const total = still ? STILL : WIN.total;
        const fade = still ? Math.min(1, t / 0.15, (total - t) / 0.15) : 1;
        if (frames++ % 30 === 0) geo = measure(show) ?? geo;
        const c = cv.current;
        const g = c?.getContext("2d");
        if (c && g && geo) {
          const k = Math.min(2, window.devicePixelRatio || 1);
          const w = Math.round(window.innerWidth * k);
          const h = Math.round(window.innerHeight * k);
          if (c.width !== w || c.height !== h) {
            c.width = w;
            c.height = h;
          }
          g.setTransform(k, 0, 0, k, 0, 0);
          g.clearRect(0, 0, window.innerWidth, window.innerHeight);
          const badges = badgeRow.current ? [...badgeRow.current.children].map((e) => e.getBoundingClientRect()) : [];
          paint(g, geo, t, theme, still, fade, badges, band.current?.getBoundingClientRect());
        }
        style(t, fade);
        if (!still) {
          const crossed = (at: number) => lastT < at && t >= at;
          if (crossed(WIN.wave[0])) playWinSweep();
          if (crossed(WIN.slam[1])) playMissionComplete();
          const lastCell = WIN.cellsAt + Math.max(0, (geo?.cells.length ?? 1) - 1) * WIN.cellStep + WIN.burstAfter;
          if (crossed(lastCell)) won(true);
        }
        lastT = t;
        const a = still ? 3 : t < WIN.wave[0] ? 1 : t < WIN.slam[0] ? 2 : t < 3.8 ? 3 : 4;
        if (a !== shownAct) {
          shownAct = a;
          setAct(a);
          setActs((x) => (x.endsWith(String(a)) ? x : x + a));
        }
        if (t >= total) {
          stage = "done";
          cbs.current.onShake(undefined);
          cbs.current.onDone();
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cbs.current.onShake(undefined);
      cbs.current.onHold(0);
      won(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (typeof document === "undefined") return null;
  const fs = box ? Math.round(Math.max(20, Math.min(60, box.w / 14))) : 32;
  const bs = Math.round(Math.max(24, Math.min(46, fs * 0.9)));
  return createPortal(
    <div ref={root} className="cb-win" data-win={show.piece.id} data-phase={phase} data-act={act} data-acts={acts} data-still={still ? "1" : "0"} data-from={show.from ?? ""} aria-live="polite" style={{ "--cb-acc": theme.primary } as React.CSSProperties}>
      <canvas ref={cv} className="cb-win-cv" />
      {box && phase === "play" && (
        <div className="cb-over" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
          <div ref={band} className="cb-band" style={{ opacity: 0 }}>
            <div ref={flash} className="cb-flash" />
            <div ref={title} className="cb-title" style={{ fontSize: fs }}>
              Mission complete
            </div>
            <div ref={sub} className="cb-sub" style={{ fontSize: Math.round(fs * 0.36) }}>
              {show.name} eliminated · {show.have} / {show.count}
            </div>
            <div ref={badgeRow} className="cb-badges">
              {/* One badge per unit of the objective; after the Developer tool, an empty place for each not destroyed. */}
              {Array.from({ length: show.count }, (_, i) =>
                i >= show.have ? (
                  <i key={i} className="cb-badge-empty" style={{ width: bs, height: Math.round(bs / (136 / 157)), opacity: 0 }} />
                ) : badge ? (
                  <img key={i} src={badge} alt="" width={bs} height={Math.round(bs / (136 / 157))} style={{ opacity: 0 }} />
                ) : (
                  <i key={i} className="cb-badge-dot" style={{ width: bs, height: bs, opacity: 0 }} />
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
