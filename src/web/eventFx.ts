/**
 * Build step 5 (Program Spec "How things look when they happen"): the remaining event looks.
 * Turn, Boost, Shield and Bio-shield gained, Damage removed, Barriers and Fuse tokens placed or
 * removed, an Alert cancelled, a tile uncovered, Overload start and end, Overhaul.
 * Screen only; placeholders until the designer's art.
 */

import { Graphics, Text } from "pixi.js";
import type { GameEvent } from "../engine/events.js";
import { type Step, easeOut, easeOutBack } from "./anim.js";
import { type FxEnv, drawOverloadRing } from "./revealFx.js";

type TokensEv = GameEvent & { kind: "tokens" };

const SHIELD = 0x5fd8ff;
const BIO = 0x4fe08a;
const REPAIR = 0x7cf2a0;
const BOOST = 0xffc94a;
const BARRIER = 0x9fe3ff;
const FUSE: Record<string, number> = { tick: 0xffd23f, mortar: 0xff8a3d, feedback: 0xff3b3b };

function hex(x: number, y: number, r: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  return pts;
}

function label(text: string, size: number, fill: number, stroke: number): Text {
  const t = new Text({ text, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(13, size * 0.38), fill, fontWeight: "800", stroke: { color: stroke, width: 4 } } });
  t.anchor.set(0.5);
  t.eventMode = "none";
  return t;
}

/** A turn (E10, 3.7): the tile's arrows sweep round, 0.15 s per side. `rot` is applied to the arrows. */
export function turnStep(e: GameEvent & { kind: "turned" }, real: boolean): Step {
  const by = e.by;
  return {
    ms: 150 * Math.max(1, Math.abs(by)) + 60,
    frame: (p, look) => {
      if (!real) return;
      look(e.sector).rot = (-by * Math.PI) / 3 * (1 - easeOut(p));
    },
    end: () => {},
  };
}

/**
 * Tokens changed on a unit. Boost: rising light, chevrons and "+1" (0.4 s). A Shield or Bio-shield:
 * a hex bubble forms round the unit. Damage removed: green sparks rise. Barrier placed: its field
 * drops on; removed: it fades up and away. A Fuse token drops on with a bounce; removed: fades up.
 */
export function tokenStep(e: TokensEv, env: FxEnv): Step {
  const g = new Graphics();
  g.eventMode = "none";
  const boost = e.boost === true;
  const gain = e.change === "shield" || e.change === "bioShield" || e.change === "repair";
  const colour = boost ? BOOST : e.change === "shield" ? SHIELD : e.change === "bioShield" ? BIO : e.change === "repair" ? REPAIR : e.change === "barrier" || e.change === "barrierGone" ? BARRIER : (FUSE[e.change] ?? 0xff5a3a);
  const text = gain ? `+${e.n}` : undefined;
  const num = text ? label(text, env.size(), colour, boost ? 0x6b4a00 : 0x0f4d2c) : undefined;
  const ms = boost || gain ? 450 : e.change === "barrier" ? 320 : 260;
  return {
    ms,
    start: () => {
      env.fx.addChild(g);
      if (num) env.fx.addChild(num);
    },
    frame: (p) => {
      const c = env.centre(e.sector);
      const s = env.size();
      g.clear();
      if (gain) {
        // Rising light column.
        const h = s * 1.2 * easeOut(p);
        g.rect(c.x - s * 0.45, c.y + s * 0.5 - h, s * 0.9, h).fill({ color: colour, alpha: 0.18 * (1 - p) });
        if (boost) {
          // Three chevrons rising through the unit.
          for (let i = 0; i < 3; i++) {
            const q = (p * 1.4 - i * 0.18) % 1;
            if (q < 0 || p * 1.4 - i * 0.18 < 0) continue;
            const y = c.y + s * 0.45 - q * s * 1.1;
            const w = s * 0.3;
            g.moveTo(c.x - w, y + w * 0.5).lineTo(c.x, y).lineTo(c.x + w, y + w * 0.5).stroke({ width: 3, color: colour, alpha: Math.sin(Math.PI * q) });
          }
        }
        if (e.change === "shield" || e.change === "bioShield") {
          const r = s * (0.7 + 0.3 * easeOutBack(Math.min(1, p * 1.6)));
          g.poly(hex(c.x, c.y, r)).stroke({ width: 3, color: e.change === "shield" ? SHIELD : BIO, alpha: 1 - p * 0.7 }).fill({ color: e.change === "shield" ? SHIELD : BIO, alpha: 0.12 * (1 - p) });
        } else if (!boost) {
          // Repair sparks: small crosses rising.
          for (let i = 0; i < 6; i++) {
            const x = c.x + Math.sin(i * 2.1) * s * 0.45;
            const y = c.y + s * 0.4 - easeOut(p) * s * (0.6 + 0.08 * i);
            const w = s * 0.06;
            g.rect(x - w, y - w * 0.3, 2 * w, w * 0.6).fill({ color: REPAIR, alpha: 1 - p });
            g.rect(x - w * 0.3, y - w, w * 0.6, 2 * w).fill({ color: REPAIR, alpha: 1 - p });
          }
        }
        if (num) {
          num.position.set(c.x, c.y - s * (0.1 + 0.6 * easeOut(p)));
          num.alpha = 1 - p ** 3;
        }
        return;
      }
      if (e.change === "barrier") {
        // The force field drops on: shrinks onto the unit and lights up.
        const r = s * (1.5 - 0.5 * easeOutBack(p));
        g.circle(c.x, c.y, r).stroke({ width: 3, color: BARRIER, alpha: Math.min(1, p * 2) * (1 - 0.5 * p) });
        return;
      }
      if (e.change === "barrierGone" || e.change === "fuseGone" || e.change === "alertGone") {
        // Removed tokens fade up and away.
        const y = c.y - s * 0.6 * easeOut(p);
        if (e.change === "barrierGone") g.circle(c.x, y, s * (0.98 + 0.2 * p)).stroke({ width: 3, color: BARRIER, alpha: 1 - p });
        else if (e.change === "alertGone") g.poly([c.x, y - s * 0.22, c.x + s * 0.22, y + s * 0.16, c.x - s * 0.22, y + s * 0.16]).fill({ color: 0xff4d3a, alpha: 1 - p });
        else for (let i = 0; i < Math.min(4, e.n); i++) g.circle(c.x + (i - (Math.min(4, e.n) - 1) / 2) * s * 0.28, y, s * 0.11).fill({ color: 0xff8a3d, alpha: 1 - p });
        return;
      }
      // A Fuse token drops on with a small bounce.
      const y = c.y - s * 0.75 * (1 - easeOutBack(p)) - s * 0.1;
      g.circle(c.x, y, s * 0.14).fill({ color: colour, alpha: Math.min(1, p * 3) }).stroke({ width: 2, color: 0xffffff, alpha: Math.min(1, p * 3) });
      if (p > 0.6) g.circle(c.x, c.y - s * 0.1, s * (0.14 + 0.5 * (p - 0.6))).stroke({ width: 2, color: colour, alpha: (1 - p) * 2.5 });
    },
    end: () => {
      g.destroy();
      num?.destroy();
    },
  };
}

/** A face-up tile is uncovered (3.4): the tile above slides away, the one below is simply there. */
export function uncoverStep(e: GameEvent & { kind: "uncovered" }, env: FxEnv): Step {
  const g = new Graphics();
  g.eventMode = "none";
  return {
    ms: 300,
    hides: [e.sector],
    start: () => env.fx.addChild(g),
    frame: (p, look) => {
      const c = env.centre(e.sector);
      const s = env.size();
      g.clear();
      const q = easeOut(p);
      g.poly(hex(c.x + q * s * 0.6, c.y - q * s * 0.5, s * 0.9)).fill({ color: 0x4a6280, alpha: 0.85 * (1 - q) });
      look(e.sector).alpha = Math.min(1, 0.4 + p);
    },
    end: () => g.destroy(),
  };
}

/**
 * Overload starts (9.1): the Field tints red, a slow ripple crosses it from the centre (0.8 s).
 * Overload End: the ripple runs back in, the tint and the plasma ring fade (0.8 s).
 */
export function overloadStep(how: "start" | "end", env: FxEnv): Step {
  const g = new Graphics();
  g.eventMode = "none";
  const ring = new Graphics();
  ring.eventMode = "none";
  return {
    ms: 800,
    start: () => env.fx.addChild(g, ring),
    frame: (p) => {
      const el = env.host();
      const w = el?.clientWidth ?? 0;
      const h = el?.clientHeight ?? 0;
      g.clear();
      if (!w || !h) return;
      const R = Math.hypot(w, h) / 2;
      const q = how === "start" ? easeOut(p) : 1 - easeOut(p);
      const tint = how === "start" ? Math.sin(Math.PI * p) * 0.28 : (1 - p) * 0.22;
      g.rect(0, 0, w, h).fill({ color: 0xff2a10, alpha: tint });
      for (let i = 0; i < 3; i++) {
        const r = Math.max(1, R * q - i * env.size() * 0.6);
        g.circle(w / 2, h / 2, r).stroke({ width: 6 - i * 1.5, color: i === 0 ? 0xffb070 : 0xff4a20, alpha: (1 - Math.abs(2 * p - 1)) * (0.8 - i * 0.2) });
      }
      ring.clear();
      if (how === "end") {
        // The plasma ring fades away.
        drawOverloadRing(ring, w, h, performance.now());
        ring.alpha = 1 - p;
      }
    },
    end: () => {
      g.destroy();
      ring.destroy();
    },
  };
}

/** Overhaul (8.8): repair sparks run over the Flagship panel (0.8 s). */
export function overhaulStep(): Step {
  return {
    ms: 800,
    start: () => {
      const el = document.querySelector<HTMLElement>(".flagship");
      if (!el) return;
      el.classList.remove("fx-repair");
      void el.offsetWidth;
      el.classList.add("fx-repair");
      window.setTimeout(() => el.classList.remove("fx-repair"), 1000);
    },
    frame: () => {},
    end: () => {},
  };
}

/**
 * An Alert resolved with no effect (designer 2026-11-10): a fizzle. A few weak sparks sputter up
 * from the unit, flicker and drop back, a grey puff of smoke curls away and "no effect" fades (0.9 s).
 */
export function fizzleStep(e: GameEvent & { kind: "fizzled" }, env: FxEnv): Step {
  const g = new Graphics();
  g.eventMode = "none";
  const t = label("no effect", env.size() * 0.75, 0xe8eef6, 0x1b2230);
  t.alpha = 0;
  const N = 16;
  const seed = (i: number) => {
    const x = Math.sin(i * 12.9898 + e.seq * 3.1) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    ms: 1000,
    start: () => env.fx.addChild(g, t),
    frame: (p) => {
      const c = env.centre(e.sector);
      const s = env.size();
      g.clear();
      // A spark at the heart tries to catch: it sputters twice, then gutters out.
      const core = p < 0.12 ? p / 0.12 : p < 0.2 ? 0.35 : p < 0.32 ? 1 : Math.max(0, 1 - (p - 0.32) / 0.3);
      const flick = 0.6 + 0.4 * Math.sin(p * 90) * Math.sin(p * 31);
      g.circle(c.x, c.y, s * 0.42 * core).fill({ color: 0x20160c, alpha: 0.35 * core });
      g.circle(c.x, c.y, s * 0.3 * core).fill({ color: 0xff9a3a, alpha: 0.35 * core * flick });
      g.circle(c.x, c.y, s * (0.08 + 0.07 * core)).fill({ color: 0xfff1c8, alpha: 0.95 * core * flick });
      // Sparks: short hops up and out that fall back under a little gravity, dimming and blinking.
      for (let i = 0; i < N; i++) {
        const born = 0.05 + seed(i) * 0.3;
        const q = (p - born) / 0.5;
        if (q <= 0 || q >= 1) continue;
        const a = -Math.PI / 2 + (seed(i + 20) - 0.5) * 2.6;
        const v = s * (0.45 + 0.45 * seed(i + 40));
        const x = c.x + Math.cos(a) * v * q;
        const y = c.y + Math.sin(a) * v * q + s * 1.1 * q * q;
        const on = Math.sin(q * 38 + i) > -0.4 ? 1 : 0.2;
        const r = s * 0.035 * (1.4 - q);
        g.circle(x, y, r * 2.4).fill({ color: 0x1b1208, alpha: 0.35 * (1 - q) * on });
        g.circle(x, y, r).fill({ color: i % 3 ? 0xffd27a : 0xffffff, alpha: (1 - q) * on });
      }
      // A grey puff of smoke curling up and away.
      for (let i = 0; i < 5; i++) {
        const q = Math.max(0, Math.min(1, (p - 0.28 - i * 0.06) / 0.62));
        if (q <= 0) continue;
        const x = c.x + Math.sin(q * 3 + i * 1.7) * s * 0.14 + (i - 2) * s * 0.06;
        const y = c.y - s * 0.05 - q * s * 0.6;
        g.circle(x, y, s * (0.08 + 0.14 * q)).fill({ color: 0x5c6573, alpha: 0.45 * (1 - q) });
      }
      t.position.set(c.x, c.y - s * (0.62 + 0.15 * easeOut(p)));
      t.alpha = p < 0.2 ? p / 0.2 : p > 0.75 ? (1 - p) / 0.25 : 1;
    },
    end: () => {
      g.destroy();
      t.destroy();
    },
  };
}
