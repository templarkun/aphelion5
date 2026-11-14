/**
 * A tactical wireframe of a Flagship, drawn from lines (a stand-in until the designer's ship art):
 * hull, Bays as numbered nodes, a turning scanner and a sweep line. Each Company has its own hull;
 * a Company with no drawing here gets a plain hull with its Bays along the spine.
 */

import type { CompanyDef } from "../../data/company.js";

interface Hull {
  lines: string[];
  thin: string[];
  bridge: [number, number];
  bays: [number, number][];
}

const HULLS: Record<string, Hull> = {
  // A broad support ship: one deep hull, short wings, three Bays along the spine.
  V1: {
    lines: ["M40 120 L92 78 L252 70 L332 100 L362 120 L332 140 L252 170 L92 162 Z", "M122 78 L102 40 L192 46 L212 72", "M122 162 L102 200 L192 194 L212 168", "M40 104 H22 V136 H40"],
    thin: ["M70 120 H340", "M150 74 V166", "M218 71 V169", "M286 84 V156", "M102 40 L92 78", "M102 200 L92 162"],
    bridge: [318, 120],
    bays: [[116, 120], [184, 120], [252, 120]],
  },
  // A twin-hull ship: two long hulls, struts and a central pod, five Bays.
  V2: {
    lines: ["M48 72 L110 52 L300 56 L366 76 L300 94 L110 98 Z", "M48 168 L110 188 L300 184 L366 164 L300 146 L110 142 Z", "M150 98 V142", "M250 94 V146", "M176 120 L188 100 L212 100 L224 120 L212 140 L188 140 Z", "M48 64 H30 V84 H48", "M48 176 H30 V156 H48"],
    thin: ["M70 75 H350", "M70 165 H350", "M150 120 H176", "M224 120 H250", "M110 52 V98", "M110 142 V188", "M300 56 V94", "M300 146 V184"],
    bridge: [340, 76],
    bays: [[136, 75], [228, 75], [200, 120], [136, 165], [228, 165]],
  },
};

function plainHull(n: number): Hull {
  const bays: [number, number][] = Array.from({ length: n }, (_, i) => [100 + ((i + 0.5) * 200) / n, 120]);
  return { lines: ["M40 120 L100 84 L300 84 L360 120 L300 156 L100 156 Z"], thin: ["M70 120 H340"], bridge: [330, 120], bays };
}

export function VesselSchematic({ company, bay, onBay }: { company: CompanyDef; bay: number | undefined; onBay: (n: number | undefined) => void }) {
  const h = HULLS[company.id] ?? plainHull(company.bays.length);
  return (
    <svg viewBox="0 0 400 240" className="block h-auto w-full" role="img" aria-label={`Wireframe of ${company.name} with ${company.bays.length} Bays`}>
      <defs>
        <pattern id="bf-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="400" height="240" fill="url(#bf-grid)" />
      <g fill="none" stroke="rgb(var(--acc) / 0.35)" strokeWidth="0.6">
        <path d="M8 20V8h12M392 20V8h-12M8 220v12h12M392 220v12h-12" />
        <path d="M200 4v8M200 228v8M4 120h8M388 120h8" />
      </g>
      <g key={company.id} className="bf-draw" fill="none" stroke="rgb(var(--acc))" strokeLinejoin="round">
        {h.lines.map((d, i) => (
          <path key={i} d={d} strokeWidth="2" stroke="#fff" pathLength={1} style={{ "--d": i * 140 } as React.CSSProperties} fill="rgb(var(--acc) / 0.22)" />
        ))}
        {h.thin.map((d, i) => (
          <path key={`t${i}`} d={d} strokeWidth="0.8" opacity="0.8" pathLength={1} style={{ "--d": 500 + i * 80 } as React.CSSProperties} />
        ))}
      </g>
      <g transform={`translate(${h.bridge[0]} ${h.bridge[1]})`} fill="none" stroke="rgb(251 191 36)">
        <circle r="4" fill="rgb(251 191 36 / 0.5)" className="bf-pulse" />
        <circle r="11" strokeWidth="0.8" strokeDasharray="5 4" className="bf-spin" />
        <circle r="17" strokeWidth="0.5" strokeDasharray="18 6" className="bf-spin rev" opacity="0.7" />
      </g>
      <line x1="16" x2="384" y1="18" y2="18" stroke="rgb(var(--acc))" strokeWidth="0.8" className="bf-sweep" style={{ "--sweep": "204px" } as React.CSSProperties} />
      {company.bays.map((b, i) => {
        const [x, y] = h.bays[i] ?? [60 + i * 40, 120];
        const on = bay === b.number;
        return (
          <g key={b.id} transform={`translate(${x} ${y})`} className="cursor-pointer" onPointerEnter={() => onBay(b.number)} onPointerLeave={() => onBay(undefined)} onClick={() => onBay(b.number)}>
            <circle r="20" fill="transparent" />
            <polygon points="0,-13 11.3,-6.5 11.3,6.5 0,13 -11.3,6.5 -11.3,-6.5" fill={on ? "#fff" : "rgb(30 42 130 / 0.95)"} stroke="#fff" strokeWidth={on ? 2 : 1.4} />
            {on && <circle r="18" fill="none" stroke="rgb(var(--acc))" strokeWidth="0.8" strokeDasharray="4 3" className="bf-spin" />}
            <text y="4" textAnchor="middle" fontSize="11" fontWeight="700" fill={on ? "#0b1445" : "#fff"} fontFamily="system-ui, sans-serif">
              {b.number}
            </text>
          </g>
        );
      })}
      <text x="14" y="232" fontSize="8" fill="rgb(255 255 255 / 0.75)" fontFamily="system-ui, sans-serif" letterSpacing="1.2">
        {company.id} · TOP VIEW · {company.bays.length} BAYS
      </text>
    </svg>
  );
}
