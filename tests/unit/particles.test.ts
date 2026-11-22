/**
 * Bug fix 2026-11-22 (round 27, batch 14 T14_R27_01): a frame whose time is a little before the
 * last one (the first frame of the menu's particle loop) made particles' age negative, and a plasma
 * particle (intro2's motes) asked the canvas for a gradient with a negative radius, which throws.
 */
import { expect, test } from "vitest";
import { burst, drawParticles, particles, stepParticles } from "../../src/web/briefing/particles.js";

test("particles never draw a negative radius, even after a step back in time", () => {
  particles.length = 0;
  burst(100, 100, { count: 20, shape: "mote", life: 0.6, size: 2.4 });
  burst(100, 100, { count: 20, shape: "plasma", life: 0.6, size: 2.4 });
  stepParticles(-0.3);
  const radii: number[] = [];
  const grad = { addColorStop: () => {} };
  const g = new Proxy(
    {},
    {
      get: (_t, k) => {
        if (k === "createRadialGradient") return (...a: number[]) => (radii.push(a[2]!, a[5]!), grad);
        if (k === "arc") return (...a: number[]) => radii.push(a[2]!);
        return () => {};
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  drawParticles(g);
  expect(radii.length).toBeGreaterThan(0);
  expect(Math.min(...radii)).toBeGreaterThanOrEqual(0);
  particles.length = 0;
});
