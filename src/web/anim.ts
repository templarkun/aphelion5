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
  /** Turn of the unit's arrows, in radians (clockwise positive). */
  rot: number;
  /** Turn of the whole tile, in radians (the Gamma kills' tilted board); 0 when not given. */
  turn?: number;
  /** Drawing order: higher in front (the Gamma kills' tilted board); 0 when not given. */
  z?: number;
}

export interface Step {
  /** Milliseconds at normal speed. */
  ms: number;
  /** Sectors kept hidden until this step starts (the board already shows the end result). */
  hides?: string[];
  start?: () => void;
  /**
   * Its sound (sound.ts, designer 2026-11-22): played by `start` as the step begins; also played when
   * the speed is Instant or reduced motion is on (steps then end without starting).
   */
  sound?: () => void;
  /** p from 0 to 1. `look(key)` is the look of a sector for this frame, to change. */
  frame: (p: number, look: (key: string) => NodeLook) => void;
  /** Always called once, also when skipped: remove what the step drew. */
  end: () => void;
  /**
   * A celebration (designer 2026-11-20): one tap does not finish it (a tap finishes only the steps
   * before it), two taps do, as the intro and the outros (`skip`).
   */
  twoTap?: boolean;
  /** Its length does not follow the speed setting (a still picture shown for a set time). */
  fixed?: boolean;
  /** With reduced motion or the speed Instant, this plays instead of the step (normally steps end at once then). */
  still?: Step;
}

export class Player {
  private queue: Step[] = [];
  private cur: { step: Step; t0: number } | undefined;
  /** 1 = normal. 0 = instant. */
  speed = 1;
  /** Reduced motion (spec "Timing"): each answer's steps become one short fade of the tiles they show. */
  reduced = false;

  get busy(): boolean {
    return this.cur !== undefined || this.queue.length > 0;
  }

  add(steps: Step[]): void {
    // Celebrations keep a still picture of their own (designer 2026-11-20).
    const stills = steps.flatMap((s) => (s.still ? [s.still] : []));
    if (this.speed === 0 || this.reduced) for (const s of steps) s.sound?.();
    if (this.speed === 0) {
      for (const s of steps) s.end();
      this.queue.push(...stills);
      return;
    }
    if (this.reduced) {
      for (const s of steps) s.end();
      const hides = [...new Set(steps.flatMap((s) => s.hides ?? []))];
      if (hides.length) this.queue.push(fadeIn(hides));
      this.queue.push(...stills);
      return;
    }
    this.queue.push(...steps);
  }

  /** Finish everything now (two taps on a celebration, a new drag, Undo). */
  skip(): void {
    if (this.cur) this.cur.step.end();
    this.cur = undefined;
    for (const s of this.queue) s.end();
    this.queue = [];
  }

  /**
   * One tap (spec "Timing": a tap anywhere finishes the animations): finishes the steps up to the next
   * celebration, which then plays from its start; a celebration already playing goes on (two taps skip it).
   * True when something was finished.
   */
  tap(): boolean {
    if (this.cur?.step.twoTap) return false;
    let any = false;
    if (this.cur) {
      this.cur.step.end();
      this.cur = undefined;
      any = true;
    }
    while (this.queue.length && !this.queue[0]!.twoTap) {
      this.queue.shift()!.end();
      any = true;
    }
    return any;
  }

  /** A celebration is playing now. */
  get celebrating(): boolean {
    return this.cur?.step.twoTap === true;
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
      const p = (now - this.cur.t0) / (this.cur.step.fixed ? this.cur.step.ms : this.cur.step.ms / this.speed);
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

/** Reduced motion: the tiles fade in where they now are (0.2 s). */
function fadeIn(keys: string[]): Step {
  return {
    ms: 200,
    frame: (p, look) => {
      for (const k of keys) look(k).alpha = p;
    },
    end: () => {},
  };
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
  const sounds = steps.filter((s) => s.sound);
  return {
    ms,
    hides,
    ...(sounds.length ? { sound: () => sounds.forEach((s) => s.sound!()) } : {}),
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
