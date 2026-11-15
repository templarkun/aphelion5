/**
 * A style of the opening and the menu screens (designer 2026-11-14): its intro film, its colours,
 * its background, its confirm animation and the feel of its sparks. "intro1" is the first one
 * made; others sit beside it and the player switches between them (System options > Style).
 * A style is looks only: no rule and no game data.
 */

import type { ReactElement } from "react";

/** The intro film, drawn on one 2D canvas. t in seconds from its start. */
export interface IntroScene {
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, mode: "full" | "short"): void;
}

export interface IntroFilm {
  /** Length of the long intro (first visit) and of the short one (later visits), seconds. */
  fullSeconds: number;
  shortSeconds: number;
  /** When the lock closes (sound hook) and when the name comes up, in the long intro. */
  lockAt: number;
  titleAt: number;
  /** The moment shown as one still picture with reduced motion. */
  stillAt: number;
  create(): IntroScene;
  /** The two lines under the name: long intro, short intro. */
  lines: { full: string; short: string };
}

/** What the menu's background painter is told each frame. */
export interface AmbientEnv {
  /** The accent colour now, "r g b". */
  acc: string;
  /** Pointer position, -0.5 .. 0.5 across the window, eased. */
  mx: number;
  my: number;
  /** A step change just happened: 1 forwards, -1 back, fading to 0. */
  rush: number;
  /** Reduced motion: draw one still picture. */
  still: boolean;
}
export type AmbientPainter = (g: CanvasRenderingContext2D, w: number, h: number, dt: number, t: number, env: AmbientEnv) => void;

/** How this style's sparks look: the shape drawn for each kind of particle the screens ask for. */
export type ParticleShape = "spark" | "mote" | "ember" | "ring" | "streak" | "shard" | "plasma";

export interface BriefStyle {
  id: string;
  /** Shown on its button. */
  name: string;
  /** One line under the button. */
  note: string;
  /** The accent colour of the menu screens, "r g b". */
  acc: string;
  intro: IntroFilm;
  /** A new background painter for one menu screen (it keeps its own stars, dust ...). */
  ambient(): AmbientPainter;
  /** The animation over the screen when a choice is confirmed (under half a second). */
  Lock(p: { title: string; sub: string }): ReactElement;
  /** The shape this style draws when a screen asks for a given one (e.g. squares become shards). */
  shape(asked: ParticleShape): ParticleShape;
  /** White sparks under a finger on a button: count, speed, colour. */
  tap: { count: number; speed: number; life: number; rgb: string; size: number; shape: ParticleShape };
}
