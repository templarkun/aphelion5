/**
 * The End the Overload button's looks (designer 2026-11-22, round 29: "a new category in Features for
 * the Overload end button: several variations; change shape, colour, inner and outer effects; be
 * ambitious"). "Sun" is the button as it was (CSS + coronal waves, coronalFx.ts); every other look is drawn
 * here, whole, on the button's own 2D canvas (its body, what moves inside it, and what moves round it),
 * the button element itself see-through. Everything is worked out from the time alone; a few hundred
 * soft dots a frame at most, additive light. The canvas stops while the game rests (idle.ts).
 */

import type { EndButton } from "./features.js";
import type { Walls } from "./coronalFx.js";
import { noise3 } from "./noise.js";

type Look = Exclude<EndButton, "sun">;
type RGB = [number, number, number];

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Soft round glow sprites, one per colour (drawn once, then stamped). */
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(c: RGB): HTMLCanvasElement {
  const key = c.join(",");
  let s = sprites.get(key);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${key},1)`);
  gr.addColorStop(0.35, `rgba(${key},0.55)`);
  gr.addColorStop(1, `rgba(${key},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  sprites.set(key, s);
  return s;
}

const COL = {
  white: [255, 255, 255] as RGB,
  cyan: [90, 220, 255] as RGB,
  ice: [200, 245, 255] as RGB,
  teal: [40, 170, 210] as RGB,
  orange: [255, 140, 40] as RGB,
  amber: [255, 196, 60] as RGB,
  gold: [255, 230, 150] as RGB,
  red: [255, 60, 30] as RGB,
  violet: [170, 110, 255] as RGB,
  lilac: [230, 210, 255] as RGB,
  magenta: [255, 90, 220] as RGB,
};

/**
 * One frame of a look round a button of radius R centred at (c, c) on the canvas (canvas pixels), `t` in
 * seconds, `fade` 0..1 as it appears. Nothing is drawn past the walls (the Field's edge).
 */
export function drawEndButton(ctx: CanvasRenderingContext2D, look: Look, c: number, R: number, t: number, fade: number, walls: Walls): void {
  const glow = (x: number, y: number, r: number, col: RGB, a: number) => {
    const d = Math.min(x - walls.left, walls.right - x, y - walls.top, walls.bottom - y);
    if (d <= 1 || a <= 0.004 || r <= 0) return;
    const k = Math.min(1, d / r);
    const rr = Math.min(r, d);
    ctx.globalAlpha = Math.min(1, a * fade * k * k);
    ctx.drawImage(sprite(col), x - rr, y - rr, rr * 2, rr * 2);
  };
  const path = (pts: [number, number][], close = true) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (close) ctx.closePath();
  };
  const poly = (n: number, r: number, rot: number) => Array.from({ length: n }, (_, i) => [c + r * Math.cos(rot + (i / n) * Math.PI * 2), c + r * Math.sin(rot + (i / n) * Math.PI * 2)] as [number, number]);
  const roundRect = (r: number, k: number) => {
    ctx.beginPath();
    ctx.roundRect(c - r, c - r, 2 * r, 2 * r, r * k);
  };
  /** The body: a filled shape with an inner gradient and a bright rim. */
  const body = (shape: () => void, inner: string, outer: string, rim: string, rimW: number) => {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = fade;
    const gr = ctx.createRadialGradient(c, c - R * 0.15, R * 0.05, c, c, R * 1.05);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    shape();
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.lineWidth = rimW;
    ctx.strokeStyle = rim;
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(walls.left, walls.top, walls.right - walls.left, walls.bottom - walls.top);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";

  if (look === "reactor") {
    // Outer: a soft cyan halo; sparks now and then jump from a corner and crackle out.
    const beat = 0.5 + 0.5 * Math.sin(t * 4.2) ** 3;
    glow(c, c, R * 1.9, COL.teal, 0.28 + 0.12 * beat);
    body(() => path(poly(6, R, -Math.PI / 2)), "rgba(20,90,120,0.55)", "rgba(4,22,40,0.72)", `rgba(140,235,255,${0.85 * fade})`, Math.max(1.5, R * 0.035));
    // Inner: three tilted rings of particles spinning round a beating core.
    for (let ring = 0; ring < 3; ring++) {
      const tilt = 0.35;
      const turn = ring * (Math.PI / 3) + t * 0.15;
      const ca = Math.cos(turn);
      const sa = Math.sin(turn);
      const rr = R * (0.52 + 0.1 * ring);
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + t * (1.6 - 0.4 * ring) * (ring % 2 ? -1 : 1);
        const ex = Math.cos(a) * rr;
        const ey = Math.sin(a) * rr * tilt;
        const x = c + ex * ca - ey * sa;
        const y = c + ex * sa + ey * ca;
        const front = Math.sin(a) > 0 ? 1 : 0.4;
        glow(x, y, R * 0.06, i % 6 === 0 ? COL.white : COL.cyan, 0.7 * front);
      }
    }
    glow(c, c, R * (0.45 + 0.12 * beat), COL.cyan, 0.65);
    glow(c, c, R * (0.22 + 0.06 * beat), COL.white, 0.9);
    // Corner sparks: a short jagged arc leaps from a corner out and fades.
    const corners = poly(6, R, -Math.PI / 2);
    for (let k = 0; k < 2; k++) {
      const P = 0.9 + 0.5 * k;
      const cyc = t / P + rnd(k + 10);
      const n = Math.floor(cyc);
      const q = cyc - n;
      if (q > 0.35) continue;
      const life = 1 - q / 0.35;
      const [x0, y0] = corners[Math.floor(rnd(n * 3 + k) * 6)]!;
      const ang = Math.atan2(y0 - c, x0 - c) + (rnd(n + k + 5) - 0.5) * 0.9;
      let px = x0;
      let py = y0;
      ctx.globalAlpha = fade * life;
      ctx.strokeStyle = "rgba(200,245,255,0.95)";
      ctx.lineWidth = Math.max(1, R * 0.025);
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let j = 1; j <= 7; j++) {
        const d = R * 0.09 * j;
        const jit = (rnd(n * 17 + j * 7 + Math.floor(t * 25)) - 0.5) * R * 0.18;
        px = x0 + Math.cos(ang) * d - Math.sin(ang) * jit;
        py = y0 + Math.sin(ang) * d + Math.cos(ang) * jit;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      glow(px, py, R * 0.12, COL.cyan, 0.8 * life);
    }
    // Motes drifting outwards.
    for (let i = 0; i < 26; i++) {
      const q = (t / (2.4 + rnd(i) * 1.6) + rnd(i + 40)) % 1;
      const a = rnd(i + 80) * Math.PI * 2 + q * 0.6;
      const d = R * (1.05 + 1.3 * q);
      glow(c + Math.cos(a) * d, c + Math.sin(a) * d, R * 0.045, COL.ice, 0.7 * (1 - q));
    }
  } else if (look === "singularity") {
    // Motes spiral in from far away.
    for (let i = 0; i < 46; i++) {
      const q = (t / (3 + rnd(i) * 2) + rnd(i + 30)) % 1;
      const a = rnd(i + 60) * Math.PI * 2 + q * 3.4;
      const d = R * (2.6 - 1.5 * q * q);
      glow(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.75, R * 0.045, i % 4 ? COL.orange : COL.gold, 0.75 * Math.sin(Math.PI * q));
    }
    // The accretion disc: a flattened whirl of matter, hotter and faster nearer the hole; the part behind it
    // drawn first, the hole, then the part in front.
    const disc = (front: boolean) => {
      for (let i = 0; i < 130; i++) {
        const lane = rnd(i + 200);
        const rr = R * (0.62 + 0.75 * lane);
        const a = rnd(i + 300) * Math.PI * 2 + t * (2.4 - 1.4 * lane);
        const inFront = Math.sin(a) > 0;
        if (inFront !== front) continue;
        const x = c + Math.cos(a) * rr;
        const y = c + Math.sin(a) * rr * 0.3 - R * 0.04;
        const hot = 1 - lane;
        glow(x, y, R * (0.05 + 0.05 * hot), hot > 0.7 ? COL.gold : hot > 0.35 ? COL.amber : COL.orange, (front ? 0.85 : 0.45) * (0.4 + 0.6 * hot));
      }
    };
    disc(false);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = fade;
    const gr = ctx.createRadialGradient(c, c, R * 0.2, c, c, R * 0.62);
    gr.addColorStop(0, "rgba(0,0,0,1)");
    gr.addColorStop(0.8, "rgba(0,0,0,0.95)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(c, c, R * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "lighter";
    // The photon ring: a thin bright ring hugging the dark, flickering.
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2 + t * 0.8;
      const fl = 0.6 + 0.4 * Math.sin(t * 7 + i * 1.3);
      glow(c + Math.cos(a) * R * 0.5, c + Math.sin(a) * R * 0.5, R * 0.06, i % 3 ? COL.gold : COL.white, 0.55 * fl);
    }
    disc(true);
    glow(c, c, R * 1.6, COL.orange, 0.1);
  } else if (look === "orb") {
    glow(c, c, R * 1.7, COL.violet, 0.3);
    body(() => (ctx.beginPath(), ctx.arc(c, c, R, 0, Math.PI * 2)), "rgba(120,60,200,0.45)", "rgba(30,6,60,0.7)", `rgba(220,190,255,${0.8 * fade})`, Math.max(1.2, R * 0.03));
    // Plasma threads wandering from the core to the glass.
    for (let k = 0; k < 7; k++) {
      const base = (k / 7) * Math.PI * 2 + t * 0.3;
      let a = base;
      for (let j = 0; j <= 14; j++) {
        const q = j / 14;
        a = base + noise3(k * 3.1, q * 2.5, t * 0.7) * 1.4;
        const d = R * 0.15 + R * 0.8 * q;
        const fl = 0.5 + 0.5 * noise3(k, q * 5, t * 2);
        glow(c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.07 - 0.03 * q), q > 0.85 ? COL.lilac : COL.magenta, 0.45 * fl);
      }
      // Where it touches the glass, a bright spot.
      glow(c + Math.cos(a) * R * 0.95, c + Math.sin(a) * R * 0.95, R * 0.12, COL.lilac, 0.6);
    }
    glow(c, c, R * 0.35, COL.lilac, 0.75);
    glow(c, c, R * 0.15, COL.white, 0.9);
    // Glass shine.
    glow(c - R * 0.35, c - R * 0.42, R * 0.22, COL.white, 0.25);
    // Tendrils crackling out from the glass now and then.
    for (let k = 0; k < 3; k++) {
      const P = 0.8 + 0.4 * k;
      const cyc = t / P + rnd(k + 90);
      const n = Math.floor(cyc);
      const q = cyc - n;
      if (q > 0.4) continue;
      const life = 1 - q / 0.4;
      const a0 = rnd(n * 7 + k) * Math.PI * 2;
      for (let j = 0; j < 12; j++) {
        const d = R * (1 + 0.08 * j);
        const a = a0 + (rnd(n * 13 + j + Math.floor(t * 20)) - 0.5) * 0.25;
        glow(c + Math.cos(a) * d, c + Math.sin(a) * d, R * 0.05, j > 9 ? COL.white : COL.violet, 0.9 * life * (1 - j / 14));
      }
    }
  } else if (look === "hazard") {
    // Outer: a warning beacon sweeping round, a blinking ring.
    const blink = Math.sin(t * Math.PI * 1.6) > 0.3 ? 1 : 0.35;
    const sweep = t * 2.2;
    for (let i = 0; i < 40; i++) {
      const lag = i / 40;
      const a = sweep - lag * 1.1;
      const d = R * (1.15 + 1.1 * rnd(i + 120));
      glow(c + Math.cos(a) * d, c + Math.sin(a) * d, R * 0.07 * (1 - lag * 0.6), i % 5 ? COL.amber : COL.red, 0.75 * (1 - lag));
    }
    const d4 = (r: number) => poly(4, r, -Math.PI / 2);
    ctx.globalAlpha = fade * 0.6 * blink;
    ctx.strokeStyle = "rgba(255,70,40,0.9)";
    ctx.lineWidth = Math.max(1.5, R * 0.04);
    path(d4(R * 1.18));
    ctx.stroke();
    body(() => path(d4(R * 1.05)), "rgba(255,180,40,0.55)", "rgba(60,30,0,0.78)", `rgba(255,214,120,${0.9 * fade})`, Math.max(1.5, R * 0.04));
    // Inner: chevrons of light rising, one after another.
    for (let k = 0; k < 3; k++) {
      const q = (t * 0.7 + k / 3) % 1;
      const y = c + R * 0.55 - q * R * 1.1;
      const half = R * 0.42 * (1 - Math.abs(y - c) / (R * 1.05));
      const a = Math.sin(Math.PI * q);
      for (let j = -6; j <= 6; j++) {
        const f = j / 6;
        glow(c + f * half, y + Math.abs(f) * R * 0.16, R * 0.05, j === 0 ? COL.white : COL.amber, 0.8 * a);
      }
    }
    glow(c, c, R * 0.6, COL.amber, 0.25 * blink);
  } else if (look === "forge") {
    glow(c, c, R * 1.7, COL.red, 0.28);
    body(() => roundRect(R * 0.92, 0.28), "rgba(255,120,30,0.55)", "rgba(60,8,0,0.8)", `rgba(255,190,110,${0.85 * fade})`, Math.max(1.5, R * 0.035));
    // Inner: churning heat, a field of glowing cells moved by noise.
    const n = 9;
    for (let iy = 0; iy < n; iy++)
      for (let ix = 0; ix < n; ix++) {
        const x = c - R * 0.78 + (ix / (n - 1)) * R * 1.56;
        const y = c - R * 0.78 + (iy / (n - 1)) * R * 1.56;
        const h = 0.5 + 0.5 * noise3(ix * 0.45, iy * 0.45 - t * 0.6, t * 0.5);
        if (h < 0.35) continue;
        glow(x, y, R * (0.08 + 0.08 * h), h > 0.75 ? COL.gold : h > 0.55 ? COL.amber : COL.orange, 0.5 * (h - 0.3));
      }
    // Embers rising out of the top and drifting away.
    for (let i = 0; i < 40; i++) {
      const q = (t / (2 + rnd(i) * 1.6) + rnd(i + 150)) % 1;
      const x0 = c + (rnd(i + 170) - 0.5) * R * 1.5;
      const x = x0 + noise3(i * 0.7, q * 2, t * 0.4) * R * 0.5;
      const y = c - R * 0.7 - q * R * 1.9;
      glow(x, y, R * 0.045 * (1 - q * 0.5), q < 0.3 ? COL.gold : COL.orange, 0.85 * Math.sin(Math.PI * Math.min(1, q * 1.2)));
    }
    // Heat shimmer at the sides.
    for (let i = 0; i < 18; i++) {
      const q = (t / 3 + rnd(i + 190)) % 1;
      const side = i % 2 ? 1 : -1;
      glow(c + side * R * (1.05 + 0.25 * rnd(i)), c + R * 0.8 - q * R * 1.8, R * 0.04, COL.orange, 0.5 * Math.sin(Math.PI * q));
    }
  } else {
    // Star gate: a ring with a swirling portal; marks round its rim light one after another.
    glow(c, c, R * 1.6, COL.teal, 0.16);
    // The portal: particles spiralling in to the middle.
    for (let i = 0; i < 90; i++) {
      const q = (t / (1.8 + rnd(i) * 1.2) + rnd(i + 210)) % 1;
      const a = rnd(i + 230) * Math.PI * 2 + q * 5;
      const d = R * 0.72 * (1 - q) ** 0.8;
      glow(c + Math.cos(a) * d, c + Math.sin(a) * d, R * (0.03 + 0.04 * (1 - q)), q > 0.85 ? COL.white : i % 3 ? COL.cyan : COL.violet, 0.75 * Math.sin(Math.PI * q));
    }
    glow(c, c, R * (0.3 + 0.05 * Math.sin(t * 3)), COL.ice, 0.55);
    // The ring itself: a band drawn solid, then its glow.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = fade;
    ctx.lineWidth = R * 0.2;
    ctx.strokeStyle = "rgba(20,40,70,0.9)";
    ctx.beginPath();
    ctx.arc(c, c, R * 0.88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, R * 0.03);
    ctx.strokeStyle = "rgba(150,220,255,0.8)";
    ctx.beginPath();
    ctx.arc(c, c, R * 0.98, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, R * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    // Nine marks round the rim, lit one after another, and a turning ring of motes outside.
    const head = (t * 3) % 9;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 - Math.PI / 2;
      const d = (head - k + 9) % 9;
      const lit = d < 1 ? 1 : Math.max(0.15, 1 - d / 3);
      glow(c + Math.cos(a) * R * 0.88, c + Math.sin(a) * R * 0.88, R * 0.12, d < 1 ? COL.amber : COL.cyan, 0.85 * lit);
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 - t * 0.35;
      glow(c + Math.cos(a) * R * 1.22, c + Math.sin(a) * R * 1.22, R * 0.035, COL.ice, 0.35 + 0.35 * Math.sin(t * 2 + i));
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}
