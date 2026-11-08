/**
 * Energy moving between the Reserve, the Modules and the Supply (designer
 * 2026-11-08): small glowing chips that fly across the screen. The screen
 * compares the board before and after an answer and sends one chip per
 * energy (a few at most per colour); nothing here changes the game.
 */

import type { GameState } from "../engine/state.js";

type Colour = "Yellow" | "Red" | "Blue";
type Pt = { x: number; y: number };
const COLOURS: Colour[] = ["Yellow", "Red", "Blue"];

const css = (c: Colour) => getComputedStyle(document.documentElement).getPropertyValue(`--${c.toLowerCase()}`).trim() || "#888";

function centre(el: Element | null | undefined): Pt | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return undefined;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Where the Supply is on screen: above the middle of the Field (energy leaves the game there). */
function supplyPoint(): Pt {
  const c = document.querySelector(".center")?.getBoundingClientRect();
  return c ? { x: c.left + c.width / 2, y: c.top + 24 } : { x: window.innerWidth / 2, y: 40 };
}

function pulse(el: Element | null | undefined, colour: Colour): void {
  if (!(el instanceof HTMLElement)) return;
  el.classList.remove("energy-arrive");
  void el.offsetWidth;
  el.style.setProperty("--arrive", css(colour));
  el.classList.add("energy-arrive");
  window.setTimeout(() => el.classList.remove("energy-arrive"), 650);
}

/** One chip from a to b along an arc; `fade`: it fades out on the way (into the Supply). */
export function flyChip(colour: Colour, a: Pt, b: Pt, delay: number, opts: { fade?: boolean; fadeIn?: boolean; onArrive?: () => void } = {}): void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return opts.onArrive?.();
  const dot = document.createElement("div");
  dot.className = "energy-fly";
  dot.style.setProperty("--pop", css(colour));
  dot.style.opacity = "0";
  document.body.appendChild(dot);
  const lift = Math.min(120, Math.hypot(b.x - a.x, b.y - a.y) * 0.3);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 10; i++) {
    const p = i / 10;
    const q = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
    const x = a.x + (b.x - a.x) * q;
    const y = a.y + (b.y - a.y) * q - Math.sin(Math.PI * q) * lift;
    const o = opts.fade ? (p < 0.1 ? p * 10 : 1 - Math.max(0, (p - 0.5) / 0.5)) : opts.fadeIn ? Math.min(1, p * 3) : p < 0.1 ? p * 10 : 1;
    frames.push({ transform: `translate(${x - 9}px, ${y - 9}px) scale(${1 + 0.3 * Math.sin(Math.PI * p)})`, opacity: o });
  }
  const anim = dot.animate(frames, { duration: 650, delay, easing: "linear", fill: "both" });
  anim.onfinish = () => {
    dot.remove();
    opts.onArrive?.();
  };
  anim.oncancel = () => dot.remove();
}

/** Chips for what changed between two boards: the Reserve, and energy taken off Modules. */
export function energyFlights(before: GameState, after: GameState): void {
  if (typeof document === "undefined") return;
  // Undo plays nothing backwards.
  const seq = (s: GameState) => s.events?.[s.events.length - 1]?.seq ?? 0;
  if (seq(after) < seq(before) || before.player.modules.length === 0) return;
  // A Module that was just run (it went from ready to exhausted): what the Reserve pays goes there.
  const ran = after.player.modules.find((m) => !m.ready && before.player.modules.find((b) => b.id === m.id)?.ready);
  const ranEl = ran ? document.querySelector(`[data-module="${ran.id}"]`) : undefined;
  let delay = 0;
  for (const col of COLOURS) {
    const d = after.player.reserve[col] - before.player.reserve[col];
    const res = document.querySelector(`[data-reserve="${col}"]`);
    const r = centre(res);
    if (!r || d === 0) continue;
    for (let i = 0; i < Math.min(6, Math.abs(d)); i++) {
      if (d < 0) {
        const to = centre(ranEl) ?? supplyPoint();
        flyChip(col, r, to, delay, { fade: !ranEl, onArrive: () => pulse(ranEl, col) });
      } else flyChip(col, supplyPoint(), r, delay, { fadeIn: true, onArrive: () => pulse(res, col) });
      delay += 90;
    }
  }
  // Energy taken off a Module that was not run (S_08, S_13...): out to the Supply.
  for (const m of after.player.modules) {
    const b = before.player.modules.find((x) => x.id === m.id);
    if (!b || m === ran) continue;
    const el = document.querySelector(`[data-module="${m.id}"]`);
    const from = centre(el);
    if (!from) continue;
    for (const col of COLOURS) {
      const d = b.energy[col] - m.energy[col];
      for (let i = 0; i < Math.min(6, d); i++) {
        flyChip(col, from, supplyPoint(), delay, { fade: true });
        delay += 90;
      }
    }
  }
}
