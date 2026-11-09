/**
 * The animation player (Program Spec "Interaction and animation" > "Timing"):
 * plays the engine events of each answer one at a time, in engine order.
 * A tap anywhere finishes them at once; Undo plays nothing backwards.
 *
 * A step changes how sectors are shown for its duration (offset, scale,
 * alpha) and may draw its own pieces; the Field applies the steps every
 * frame on top of the board as it now is, so re-drawing the board while an
 * animation runs is harmless.
 */

export interface NodeLook {
  dx: number;
  dy: number;
  scale: number;
  scaleX: number;
  alpha: number;
}

export interface Step {
  /** Milliseconds at normal speed. */
  ms: number;
  /** Sectors kept hidden until this step starts (the board already shows the end result). */
  hides?: string[];
  start?: () => void;
  /** p from 0 to 1. `look(key)` is the look of a sector for this frame, to change. */
  frame: (p: number, look: (key: string) => NodeLook) => void;
  /** Always called once, also when skipped: remove what the step drew. */
  end: () => void;
}

export class Player {
  private queue: Step[] = [];
  private cur: { step: Step; t0: number } | undefined;
  /** 1 = normal. 0 = instant. */
  speed = 1;

  get busy(): boolean {
    return this.cur !== undefined || this.queue.length > 0;
  }

  add(steps: Step[]): void {
    if (this.speed === 0) {
      for (const s of steps) s.end();
      return;
    }
    this.queue.push(...steps);
  }

  /** Finish everything now (a tap, a new drag, Undo). */
  skip(): void {
    if (this.cur) this.cur.step.end();
    this.cur = undefined;
    for (const s of this.queue) s.end();
    this.queue = [];
  }

  /** Sectors hidden by steps not started yet. */
  hidden(): Set<string> {
    const h = new Set<string>();
    for (const s of this.queue) for (const k of s.hides ?? []) h.add(k);
    return h;
  }

  tick(now: number, look: (key: string) => NodeLook): void {
    for (;;) {
      if (!this.cur) {
        const next = this.queue.shift();
        if (!next) return;
        next.start?.();
        this.cur = { step: next, t0: now };
      }
      const p = (now - this.cur.t0) / (this.cur.step.ms / this.speed);
      if (p < 1) {
        this.cur.step.frame(Math.max(0, p), look);
        return;
      }
      this.cur.step.frame(1, look);
      this.cur.step.end();
      this.cur = undefined;
    }
  }
}

export const easeOut = (p: number) => 1 - (1 - p) ** 3;
export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
/** A small settle at the end (overshoot then back). */
export const easeOutBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

/**
 * Several steps at once, as one step (designer 2026-11-09: effects on "all" units play together,
 * fast). `stagger`: ms between the starts. Sectors a step hides stay hidden until that step starts.
 */
export function parallel(steps: Step[], stagger = 0): Step {
  const started = steps.map(() => false);
  const done = steps.map(() => false);
  const ms = Math.max(1, ...steps.map((s, i) => s.ms + i * stagger));
  const hides = [...new Set(steps.flatMap((s) => s.hides ?? []))];
  return {
    ms,
    hides,
    frame: (p, look) => {
      const t = p * ms;
      steps.forEach((s, i) => {
        if (done[i]) return;
        const t0 = i * stagger;
        if (t < t0) {
          for (const k of s.hides ?? []) look(k).alpha = 0;
          return;
        }
        if (!started[i]) {
          started[i] = true;
          s.start?.();
        }
        const q = Math.min(1, (t - t0) / s.ms);
        s.frame(q, look);
        if (q >= 1) {
          done[i] = true;
          s.end();
        }
      });
    },
    end: () =>
      steps.forEach((s, i) => {
        if (done[i]) return;
        done[i] = true;
        s.end();
      }),
  };
}
