/**
 * Energy moving between the Reserve, the Modules and the Supply (designer
 * 2026-11-08): small glowing chips that fly across the screen. The screen
 * compares the board before and after an answer and sends one chip per
 * energy (a few at most per colour); nothing here changes the game.
 */

import type { GameState } from "../engine/state.js";
import { noFlying } from "./motion.js";

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
export function flyChip(colour: Colour, a: Pt, b: Pt, delay: number, opts: { fade?: boolean; fadeIn?: boolean; onArrive?: () => void; cls?: string; text?: string } = {}): void {
  if (noFlying()) return opts.onArrive?.();
  const dot = document.createElement("div");
  dot.className = opts.cls ?? "energy-fly";
  if (opts.text) dot.textContent = opts.text;
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
  const anim = dot.animate(frames, { duration: opts.cls ? 900 : 650, delay, easing: "linear", fill: "both" });
  anim.onfinish = () => {
    dot.remove();
    opts.onArrive?.();
  };
  anim.oncancel = () => dot.remove();
}

/** A Module whose payment the screen already showed (its selection filled it from the Reserve). */
let shown: number | undefined;
/** Set while a selected Module runs (its Overclock and extra payment come later in the run); cleared after. */
export function paidShown(id: number | undefined): void {
  shown = id;
}

/**
 * A selected Module's bar filling from the Reserve, or letting it go (designer 2026-11-08):
 * one chip per slot that changed, Reserve to Module, or back.
 */
export function reserveFlights(id: number, before: { colour: Colour; fill: string }[], after: { colour: Colour; fill: string }[]): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector(`[data-module="${id}"]`);
  const m = centre(el);
  if (!m) return;
  let delay = 0;
  for (const col of COLOURS) {
    const n = (xs: typeof before) => xs.filter((x) => x.colour === col && x.fill === "reserve").length;
    const d = n(after) - n(before);
    const res = document.querySelector(`[data-reserve="${col}"]`);
    const r = centre(res);
    if (!r) continue;
    for (let i = 0; i < Math.min(6, Math.abs(d)); i++) {
      if (d > 0) flyChip(col, r, m, delay, { onArrive: () => pulse(el, col) });
      else flyChip(col, m, r, delay, { onArrive: () => pulse(res, col) });
      delay += 70;
    }
  }
}

/** Chips for what changed between two boards: the Reserve, and energy taken off Modules. */
export function energyFlights(before: GameState, after: GameState): void {
  if (typeof document === "undefined") return;
  const already = shown;
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
    // Its selection already showed the Reserve paying it.
    if (d < 0 && already !== undefined) continue;
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

/**
 * A tile that went to the Trophy pile (a Power Node at Overload End, a
 * destroyed Omega unit): a small hexagon flies from its sector into the
 * Mission bar (designer 2026-11-08).
 */
export function trophyFlights(before: GameState, after: GameState): void {
  if (typeof document === "undefined") return;
  const seq = (s: GameState) => s.events?.[s.events.length - 1]?.seq ?? 0;
  if (seq(after) < seq(before) || after.mission !== before.mission) return;
  const had = new Set(before.piles.trophy);
  const fresh = after.piles.trophy.filter((t) => !had.has(t));
  if (fresh.length === 0) return;
  const bar = document.querySelector("[data-mission-bar]");
  const to = centre(bar);
  const field = document.querySelector<HTMLElement>(".field");
  if (!to || !field) return;
  const r = field.getBoundingClientRect();
  const centres: Record<string, [number, number]> = JSON.parse(field.dataset.sectors ?? "{}");
  let delay = 250;
  for (const t of fresh.slice(0, 8)) {
    const k = Object.keys(before.field).find((key) => before.field[key]!.includes(t));
    const c0 = k ? centres[k] : undefined;
    if (!c0) continue;
    const unit = after.tiles[t]?.unitId;
    flyChip("Yellow", { x: r.left + c0[0], y: r.top + c0[1] }, to, delay, { cls: `trophy-fly ${unit === "F_01" ? "node" : "omega"}`, text: unit === "F_01" ? "N" : "Ω" });
    delay += 160;
  }
}
