/**
 * Animation settings (Program Spec "Interaction and animation" > "Timing", build step 5):
 * speed (Slow ×0.5, Normal, Fast ×2, Instant) and reduced motion (follow the device, on, off).
 * Saved in this browser for this player. Reduced motion turns shakes, flashes and flying pieces
 * into short fades; the page gets the class `still` so the CSS animations stop too.
 */

export type Speed = "slow" | "normal" | "fast" | "instant";
export type Reduced = "auto" | "on" | "off";
export interface MotionSettings {
  speed: Speed;
  reduced: Reduced;
}

const KEY = "aphelion5.motion";
export const SPEEDS: { id: Speed; label: string; factor: number }[] = [
  { id: "slow", label: "Slow", factor: 0.5 },
  { id: "normal", label: "Normal", factor: 1 },
  { id: "fast", label: "Fast", factor: 2 },
  { id: "instant", label: "Instant", factor: 0 },
];
export const REDUCED: { id: Reduced; label: string }[] = [
  { id: "auto", label: "As the device" },
  { id: "on", label: "On" },
  { id: "off", label: "Off" },
];

let cur: MotionSettings = load();
const subs = new Set<() => void>();

function load(): MotionSettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<MotionSettings> | null;
    return {
      speed: SPEEDS.some((x) => x.id === v?.speed) ? v!.speed! : "normal",
      reduced: REDUCED.some((x) => x.id === v?.reduced) ? v!.reduced! : "auto",
    };
  } catch {
    return { speed: "normal", reduced: "auto" };
  }
}

export function motion(): MotionSettings {
  return cur;
}

export function setMotion(m: Partial<MotionSettings>): void {
  cur = { ...cur, ...m };
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    // Storage blocked (private window): the setting lasts until the page closes.
  }
  applyClass();
  for (const f of subs) f();
}

export function onMotion(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

const deviceAsks = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Reduced motion is on (the setting, or the device when "As the device"). */
export function isStill(): boolean {
  return cur.reduced === "on" || (cur.reduced === "auto" && deviceAsks());
}

/** Speed factor: 1 normal, 0 instant. */
export function speedFactor(): number {
  return SPEEDS.find((x) => x.id === cur.speed)?.factor ?? 1;
}

/** Pieces flying between panels (energy chips, Upgrade points): none when instant or reduced. */
export function noFlying(): boolean {
  return isStill() || cur.speed === "instant";
}

function applyClass(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("still", isStill());
  document.documentElement.style.setProperty("--anim-speed", String(speedFactor() || 1));
}
applyClass();
if (typeof window !== "undefined") window.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", () => {
  applyClass();
  for (const f of subs) f();
});
