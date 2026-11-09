/**
 * Row questions answered on the Field (designer 2026-11-09): a long see-through bubble with a running
 * outline lies over every row that can be chosen. The first press selects that row (its units light
 * up); a second press on the same bubble confirms it. No pop-up, no question card.
 */

import { useLayoutEffect, useState } from "react";

interface Bar {
  x: number;
  y: number;
  len: number;
  thick: number;
  angle: number;
}

export function RowBubbles(p: { rows: string[][]; selected: number | undefined; onSelect: (i: number) => void; onConfirm: (i: number) => void }) {
  const [bars, setBars] = useState<Bar[]>([]);
  useLayoutEffect(() => {
    const place = () => {
      const field = document.querySelector<HTMLElement>(".field");
      const centres: Record<string, [number, number]> = JSON.parse(field?.dataset.sectors ?? "{}");
      if (!field) return;
      const r = field.getBoundingClientRect();
      const tile = Number(field.dataset.tile ?? 80);
      const next = p.rows.map((row): Bar => {
        const pts = row.map((k) => centres[k]).filter((c): c is [number, number] => c !== undefined);
        // The two ends of the row: the pair of its sectors farthest apart.
        let a = pts[0] ?? [0, 0];
        let b = a;
        for (const u of pts) for (const w of pts) if (Math.hypot(u[0] - w[0], u[1] - w[1]) > Math.hypot(a[0] - b[0], a[1] - b[1])) [a, b] = [u, w];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return { x: r.left + (a[0] + b[0]) / 2, y: r.top + (a[1] + b[1]) / 2, len: len + tile * 0.85, thick: tile * 0.6, angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
      });
      setBars((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    place();
    const timer = window.setInterval(place, 250);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", place, true);
    };
  }, [p.rows]);
  // Labels slide along their row so no two sit on top of each other.
  const labels: { x: number; y: number }[] = [];
  const offs = bars.map((b) => {
    const rad = (b.angle * Math.PI) / 180;
    for (const t of [0, 0.28, -0.28, 0.4, -0.4]) {
      const off = t * (b.len - b.thick);
      const x = b.x + Math.cos(rad) * off;
      const y = b.y + Math.sin(rad) * off;
      if (labels.every((l) => Math.abs(l.x - x) > 110 || Math.abs(l.y - y) > 26) || t === -0.4) {
        labels.push({ x, y });
        return off;
      }
    }
    return 0;
  });
  return (
    <div className="row-bubbles">
      {bars.map((b, i) => {
        const sel = p.selected === i;
        return (
          <button
            key={i}
            className={`row-bubble ${sel ? "selected" : ""}`}
            data-row={i}
            style={{ left: b.x, top: b.y, width: b.len, height: b.thick, transform: `translate(-50%, -50%) rotate(${b.angle}deg)` }}
            aria-label={sel ? "Confirm this row" : "Choose this row"}
            onClick={(e) => {
              e.stopPropagation();
              if (sel) p.onConfirm(i);
              else p.onSelect(i);
            }}
          >
            <svg aria-hidden="true" width="100%" height="100%">
              <rect x="2" y="2" rx={b.thick / 2 - 2} pathLength={100} />
            </svg>
            <span style={{ transform: `translateX(${offs[i]}px) rotate(${-b.angle}deg)` }}>{sel ? "Tap again to confirm" : "Choose this row"}</span>
          </button>
        );
      })}
    </div>
  );
}
