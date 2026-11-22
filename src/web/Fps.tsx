/**
 * Frames per second (designer 2026-11-09): a small counter in the Field's lower left corner,
 * updated twice a second, green at 50 or more, amber from 30, red below.
 */

import { useEffect, useState } from "react";
import { isResting, onResting } from "./idle.js";

export function Fps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let n = 0;
    let since = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      n += 1;
      if (now - since >= 500) {
        setFps(Math.round((n * 1000) / (now - since)));
        n = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    };
    // Resting (idle.ts): the counter stops too, so nothing at all runs while nobody plays.
    const go = () => {
      cancelAnimationFrame(raf);
      n = 0;
      since = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const off = onResting((r) => {
      if (r) {
        cancelAnimationFrame(raf);
        setFps(-1);
      } else go();
    });
    if (!isResting()) go();
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }, []);
  if (fps < 0)
    return (
      <div className="fps good" aria-label="Frames per second" data-fps="rest">
        resting
      </div>
    );
  return (
    <div className={`fps ${fps >= 50 ? "good" : fps >= 30 ? "ok" : "bad"}`} aria-label="Frames per second" data-fps={fps}>
      {fps} FPS
    </div>
  );
}
