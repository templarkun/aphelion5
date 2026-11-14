/**
 * A unit as its tile, drawn as on the Field: a pointy-top hexagon in the unit type's colour, the
 * designer's glyph, the Level badge at the top corner and the printed arrows on its sides. The big
 * unit illustrations come later (Program Spec, art); until then the glyph stands in the middle.
 */

import type { UnitDef } from "../../data/units.js";
import { glyphBadgeUrl, TYPE_COLOUR } from "../glyphs.js";

/** Screen angle of each side (1 left, then clockwise), as on the Field. */
const SIDE_ANGLE: Record<number, number> = { 1: Math.PI, 2: (2 * Math.PI) / 3, 3: Math.PI / 3, 4: 0, 5: -Math.PI / 3, 6: (-2 * Math.PI) / 3 };
const R = 50;
const HEX = [0, 1, 2, 3, 4, 5].map((i) => `${(Math.sin((i * Math.PI) / 3) * R).toFixed(2)},${(-Math.cos((i * Math.PI) / 3) * R).toFixed(2)}`).join(" ");

export const typeHex = (type: string) => `#${(TYPE_COLOUR[type] ?? 0xcccccc).toString(16).padStart(6, "0")}`;

export function UnitTile({ unit, level, size = 88, count, dim }: { unit: UnitDef; level?: number | undefined; size?: number; count?: number | undefined; dim?: boolean }) {
  const url = glyphBadgeUrl(unit.id);
  const col = typeHex(unit.type);
  const gid = `ut-${unit.type}`;
  return (
    <svg width={size} height={size * 1.12} viewBox="-56 -60 112 124" className={`bf-tile ${dim ? "opacity-40" : ""}`} role="img" aria-label={`${unit.type} ${unit.id}`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <polygon points={HEX} fill="rgb(0 0 0 / 0.35)" transform="translate(3 6)" />
      <polygon points={HEX} fill={col} stroke="#0b1020" strokeWidth="2.5" strokeLinejoin="round" />
      <polygon points={HEX} fill={`url(#${gid})`} />
      {url ? <image href={url} x={-27} y={-29} width={54} height={62} /> : null}
      {unit.arrows.map((s) => {
        const a = SIDE_ANGLE[s]!;
        const p = (r: number, off: number) => `${(Math.cos(a) * r - Math.sin(a) * off).toFixed(1)},${(-Math.sin(a) * r - Math.cos(a) * off).toFixed(1)}`;
        return <polygon key={s} points={`${p(47, 0)} ${p(34, 5.5)} ${p(34, -5.5)}`} fill="#14161c" stroke="#fff" strokeWidth="0.8" />;
      })}
      {level !== undefined && (
        <g transform="translate(0 -45)">
          <polygon points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5" fill="#14161c" stroke="#f5c451" strokeWidth="1.6" />
          <text y="5" textAnchor="middle" fontSize={level > 9 ? 12 : 14} fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
            {level}
          </text>
        </g>
      )}
      {count !== undefined && count > 1 && (
        <g transform="translate(34 44)">
          <rect x="-15" y="-10" width="30" height="20" rx="10" fill="#0b1020" stroke="#fff" strokeWidth="1.2" />
          <text y="5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
            ×{count}
          </text>
        </g>
      )}
    </svg>
  );
}
