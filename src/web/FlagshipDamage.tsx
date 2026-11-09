/**
 * Damage to your Flagship (5.2), assigned on the screen (designer 2026-11-09): no question card.
 * A big see-through bubble with a running outline sits in the middle of the Field and says how
 * much damage comes; beside each Bay that can take it, a bubble points at that Bay. Each press on
 * a Bay's bubble puts 1 damage there; the last one answers (Undo takes it back).
 */

import { useLayoutEffect, useState } from "react";

interface Spot {
  n: number;
  x: number;
  y: number;
  side: "right" | "above";
}

export function FlagshipDamage(p: {
  total: number;
  from: string;
  buckets: { id: string; max: number }[];
  split: Record<string, number>;
  onAdd: (bucket: string) => void;
  onReset: () => void;
  /** Removing damage (5.2 repair, designer 2026-11-09): the same bubbles in green, "+1". */
  repair?: boolean;
}) {
  const [spots, setSpots] = useState<Spot[]>([]);
  useLayoutEffect(() => {
    const place = () => {
      const next: Spot[] = [];
      for (const b of p.buckets) {
        const n = Number(b.id.slice(3));
        const el = [...document.querySelectorAll<HTMLElement>(`[data-bay="${n}"]`)].find((e) => e.getBoundingClientRect().width > 0);
        const r = el?.getBoundingClientRect();
        if (!r) continue;
        // Bays on the left (wide screens): the bubble sits to their right. Along the bottom (phones): above.
        const side = r.right < window.innerWidth / 3 ? "right" : "above";
        next.push(side === "right" ? { n, x: r.right + 10, y: r.top + r.height / 2, side } : { n, x: r.left + r.width / 2, y: r.top - 10, side });
      }
      setSpots((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    place();
    const timer = window.setInterval(place, 250);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", place, true);
    };
  }, [p.buckets]);
  const placed = Object.values(p.split).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className={`damage-bubble ${p.repair ? "repair" : ""}`} role="status">
        <svg aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none">
          <rect x="3" y="3" rx="28" pathLength={100} />
        </svg>
        <b>{p.repair ? `Repair ${p.total} damage on your Flagship` : `Your Flagship takes ${p.total} damage`}</b>
        <span className="small">{p.from}</span>
        <span>
          Tap the bubbles by your Bays: {placed} of {p.total} {p.repair ? "repaired" : "placed"}
        </span>
        {placed > 0 && (
          <button className="mini" onClick={p.onReset}>
            Start again
          </button>
        )}
      </div>
      {spots.map((s) => {
        const b = p.buckets.find((x) => x.id === `bay${s.n}`)!;
        const n = p.split[b.id] ?? 0;
        const full = n >= b.max || placed >= p.total;
        return (
          <button
            key={s.n}
            className={`bay-hit-bubble ${s.side} ${n > 0 ? "has" : ""} ${p.repair ? "repair" : ""}`}
            data-hit-bay={s.n}
            style={{ left: s.x, top: s.y }}
            disabled={full}
            onClick={() => p.onAdd(b.id)}
            aria-label={p.repair ? `Remove 1 damage from Bay ${s.n}` : `Put 1 damage on Bay ${s.n}`}
          >
            <span className="hit">{p.repair ? "+1" : "−1"}</span>
            <span className="small">Bay {s.n}</span>
            {n > 0 && <span className="taken">{n}</span>}
          </button>
        );
      })}
    </>
  );
}
