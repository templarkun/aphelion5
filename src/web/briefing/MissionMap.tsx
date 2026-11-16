/**
 * A mission's Field, small: its sectors as pointy-top hexagons laid out as on the Field (Core Rules
 * 3.8: r+1 right, q+1 up-right). Sectors where an Omega unit starts are gold. From the Campaign
 * data only.
 */

import type { MissionDef } from "../../data/campaign.js";

const S3 = Math.sqrt(3);
const HEX = [0, 1, 2, 3, 4, 5].map((i) => `${(Math.sin((i * Math.PI) / 3) * 0.94).toFixed(3)},${(-Math.cos((i * Math.PI) / 3) * 0.94).toFixed(3)}`).join(" ");

export function MissionMap({ m, className = "", fill = "rgb(255 255 255 / 0.22)", stroke = "rgb(255 255 255 / 0.55)", anim = false }: { m: MissionDef; className?: string; fill?: string; stroke?: string; anim?: boolean }) {
  const pts = m.map.map((p) => ({ x: S3 * (p.r + p.q / 2), y: -1.5 * p.q, omega: m.omegaSectors.some((o) => o.q === p.q && o.r === p.r) }));
  if (pts.length === 0) return null;
  const minX = Math.min(...pts.map((p) => p.x)) - 1;
  const maxX = Math.max(...pts.map((p) => p.x)) + 1;
  const minY = Math.min(...pts.map((p) => p.y)) - 1.1;
  const maxY = Math.max(...pts.map((p) => p.y)) + 1.1;
  return (
    <svg className={className} viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${(maxX - minX).toFixed(2)} ${(maxY - minY).toFixed(2)}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" data-map={m.id}>
      {pts.map((p, i) => (
        // Each sector in its own group: the mission intro pops the hexagon in place (anim).
        <g key={i} transform={`translate(${p.x.toFixed(3)} ${p.y.toFixed(3)})`}>
          <polygon className={anim ? "mi-hex" : undefined} style={anim ? ({ "--i": i } as React.CSSProperties) : undefined} points={HEX} fill={p.omega ? "rgb(252 211 77 / 0.75)" : fill} stroke={p.omega ? "rgb(254 243 199)" : stroke} strokeWidth="0.08" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}
