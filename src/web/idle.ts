/**
 * Resting while nobody touches the game (designer 2026-11-22: the iPad ran hot and drained with the
 * game left open, only the ready glows breathing). Every breathing glow means the whole Field is
 * drawn again many times a second, so the graphics chip never rests. After IDLE_MS with no tap,
 * mouse move, key or wheel, and nothing playing, the game "rests": the Field stops drawing (its
 * glows hold still), the FPS counter stops, and the game screen's CSS animations pause
 * (`html.resting`). The first touch wakes everything at once. Screen only; no rule.
 */

export const IDLE_MS = 20000;

let resting = false;
let last = typeof performance !== "undefined" ? performance.now() : 0;
let timer: number | undefined;
let busy: () => boolean = () => false;
const listeners = new Set<(resting: boolean) => void>();

function set(v: boolean): void {
  if (v === resting) return;
  resting = v;
  document.documentElement.classList.toggle("resting", v);
  for (const f of listeners) f(v);
}

function schedule(): void {
  window.clearTimeout(timer);
  const left = IDLE_MS - (performance.now() - last);
  timer = window.setTimeout(check, Math.max(50, left));
}

function check(): void {
  if (performance.now() - last < IDLE_MS) return schedule();
  // Something still playing (an animation, a drag, a celebration): look again a little later.
  if (busy()) {
    timer = window.setTimeout(check, 1000);
    return;
  }
  set(true);
}

/** Something happened (a press, a new answer, an animation starting): wake up, start the count again. */
export function poke(): void {
  last = performance.now();
  if (resting) set(false);
  schedule();
}

export const isResting = (): boolean => resting;

/** Told when the game starts or stops resting. Returns the function that stops telling. */
export function onResting(f: (resting: boolean) => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

let started = 0;
/** Started by the Field while it is on screen (the setup screens never rest). Returns its stop. */
export function startResting(isBusy: () => boolean): () => void {
  busy = isBusy;
  if (started++ === 0) {
    for (const t of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) window.addEventListener(t, poke, { capture: true, passive: true });
    document.addEventListener("visibilitychange", poke);
  }
  poke();
  return () => {
    if (--started > 0) return;
    for (const t of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) window.removeEventListener(t, poke, { capture: true });
    document.removeEventListener("visibilitychange", poke);
    window.clearTimeout(timer);
    busy = () => false;
    set(false);
  };
}
