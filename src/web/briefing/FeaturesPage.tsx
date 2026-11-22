/**
 * The Features page on the Command Deck (designer 2026-11-22, option A; screen only, no rule): a
 * card per Feature (features.ts `FEATURE_ROWS`) with a small moving preview of each choice, the one
 * in use pressed. Opened by the sparkles button in the briefing's top bar, beside Statistics. The
 * game's Menu keeps a short list (FeaturesMenu.tsx). Later each Feature is hidden until the player
 * earns its achievement (`unlock` on the row: the card shows a lock and the achievement's name); for
 * now every Feature is open. The previews are small sketches of each look, not the Field's drawing.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { Lock } from "lucide-react";
import { FEATURE_ROWS, features, hexOutline, onFeatures, setFeatures, type Corner, type Features } from "../features.js";
import { PageShell } from "./PageShell.js";
import { playSelect } from "./soundHooks.js";

const S = 100; // preview box
const C = 50;
const R = 34;

function hexPath(cx: number, cy: number, r: number, corners: Corner): string {
  const p = hexOutline(cx, cy, r, corners);
  let d = "";
  for (let i = 0; i < p.length; i += 2) d += `${i ? "L" : "M"}${p[i]!.toFixed(1)},${p[i + 1]!.toFixed(1)}`;
  return d + "Z";
}

/** Which moving pattern sketches each ready-to-tap look. */
type Kind = "breath" | "rise" | "orbit" | "twinkle" | "beat" | "inward" | "glow" | "core" | "arcs" | "tide" | "comet" | "scan" | "brackets" | "outward" | "rays" | "chase" | "fountain" | "gyroscope" | "pond" | "lattice" | "rain" | "vortex" | "beacon" | "aurora";
const READY_KIND: Record<string, Kind> = {
  original: "breath", embers: "rise", heartbeat: "beat", motes: "orbit", sparkle: "twinkle", gather: "inward", aura: "orbit", current: "orbit", arcs: "arcs",
  fill: "glow", inner: "glow", converge: "inward", drift: "rise", tide: "tide", core: "core", haze: "rise",
  comet: "comet", scan: "scan", brackets: "brackets", ripple: "outward", fountain: "fountain", gyroscope: "gyroscope",
  pond: "pond", lattice: "lattice", rain: "rain", vortex: "vortex", beacon: "beacon", aurora: "aurora",
};
/** The six corners of the preview hexagon (pointy top), radius r. */
const corners6 = (r: number) => [...Array(6).keys()].map((i) => ({ x: C + r * Math.cos((Math.PI / 3) * i - Math.PI / 2), y: C + r * Math.sin((Math.PI / 3) * i - Math.PI / 2) }));

function Dots({ kind, hex }: { kind: string; hex: string }) {
  const n = 7;
  const dots = [...Array(n).keys()];
  if (kind === "rise")
    return (
      <g>
        {dots.map((i) => (
          <circle key={i} className="fp-rise" cx={C - R * 0.8 + (i * R * 1.6) / (n - 1)} cy={C + R * 0.5} r={1.8} style={{ animationDelay: `${(i * 0.37) % 1.6}s` }} />
        ))}
      </g>
    );
  if (kind === "orbit" || kind === "tide")
    return (
      <g className={kind === "tide" ? "fp-spin fp-slow" : "fp-spin"} style={{ transformOrigin: `${C}px ${C}px` }}>
        {(kind === "tide" ? [0, 1, 2, 3, 4] : [0, 2, 4]).map((i) => (
          <circle key={i} cx={C + Math.cos(i * 0.4 + (kind === "tide" ? 0 : i)) * (R + 3)} cy={C + Math.sin(i * 0.4 + (kind === "tide" ? 0 : i)) * (R + 3)} r={kind === "tide" ? 2.6 - i * 0.35 : 2} />
        ))}
      </g>
    );
  if (kind === "twinkle") {
    const pts = hexOutline(C, C, R, "pebble");
    return (
      <g>
        {[...Array(12).keys()].map((i) => {
          const k = Math.floor((i * pts.length) / 24) * 2;
          return <circle key={i} className="fp-twinkle" cx={pts[k]} cy={pts[k + 1]} r={1.7} style={{ animationDelay: `${(i * 0.29) % 1.4}s` }} />;
        })}
      </g>
    );
  }
  if (kind === "inward")
    return (
      <g>
        {[0, 1, 2].map((i) => (
          <path key={i} d={hex} className="fp-inward" style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${C}px ${C}px` }} />
        ))}
      </g>
    );
  if (kind === "arcs") return <path d={hex} className="fp-arcs" />;
  if (kind === "comet")
    // Round 29: a comet streaking across the tile, its tail breaking up into sparks.
    return (
      <g className="fp-comet">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <circle key={i} cx={C - 30 + 10 - i * 4.2} cy={C - 16 - i * 1.8 + (i % 2 ? 1.5 : -1.5) * (i / 3)} r={Math.max(0.6, 3 - i * 0.38)} style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </g>
    );
  if (kind === "fountain")
    return (
      <g>
        {[...Array(10).keys()].map((i) => (
          <circle key={i} cx={C} cy={C - R} r={1.6} className="fp-fount" style={{ "--fx": `${(i % 2 ? 1 : -1) * (10 + (i * 7) % 22)}px`, animationDelay: `${((i * 0.17) % 1.4).toFixed(2)}s` } as CSSProperties} />
        ))}
      </g>
    );
  if (kind === "gyroscope")
    return (
      <g>
        {[0, 1].map((k) => (
          <g key={k} transform={`rotate(${k ? -28 : 28} ${C} ${C})`}>
            <ellipse cx={C} cy={C} rx={R + 4} ry={(R + 4) * 0.32} className="fp-gyroring" style={{ animationDelay: `${k * 0.6}s` }} />
          </g>
        ))}
      </g>
    );
  if (kind === "scan") return <line x1={C - R * 0.85} x2={C + R * 0.85} y1={C - R * 0.7} y2={C - R * 0.7} className="fp-scanline" />;
  if (kind === "brackets")
    return (
      <g className="fp-ready fp-breath">
        {corners6(R + 3).map((p, i) => {
          const q = corners6(R + 3);
          const a = q[(i + 5) % 6]!;
          const b = q[(i + 1) % 6]!;
          const m = (o: { x: number; y: number }) => `${p.x + (o.x - p.x) * 0.22},${p.y + (o.y - p.y) * 0.22}`;
          return <polyline key={i} points={`${m(a)} ${p.x},${p.y} ${m(b)}`} fill="none" strokeWidth={2} />;
        })}
      </g>
    );
  if (kind === "outward" || kind === "pond")
    return (
      <g>
        {[0, 1].map((i) => (
          <path key={i} d={hex} className={kind === "pond" ? "fp-pond" : "fp-outward"} style={{ animationDelay: `${i * 1.1}s`, transformOrigin: `${C}px ${C}px` }} />
        ))}
      </g>
    );
  if (kind === "rays")
    return (
      <g>
        {[...Array(18).keys()].map((i) => {
          const a = (i / 18) * Math.PI * 2;
          return <line key={i} x1={C + Math.cos(a) * (R - 1)} y1={C + Math.sin(a) * (R - 1)} x2={C + Math.cos(a) * (R + 6)} y2={C + Math.sin(a) * (R + 6)} className="fp-ray" style={{ animationDelay: `${((i * 0.37) % 1.1).toFixed(2)}s` }} />;
        })}
      </g>
    );
  if (kind === "chase" || kind === "beacon")
    return (
      <g>
        {corners6(kind === "beacon" ? R * 0.72 : R).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={kind === "beacon" ? 6 : 3} className={kind === "beacon" ? "fp-beacon" : "fp-chase"} style={{ animationDelay: `${(i * (kind === "beacon" ? 0.7 : 0.26)).toFixed(2)}s` }} />
        ))}
      </g>
    );
  if (kind === "lattice")
    return (
      <g>
        {[-2, -1, 0, 1, 2].flatMap((iy) =>
          [-2, -1, 0, 1, 2].map((ix) => {
            const x = C + (ix + (iy % 2 ? 0.5 : 0)) * 10;
            const y = C + iy * 8.7;
            if (Math.abs(x - C) * 0.866 + Math.abs(y - C) * 0.5 > R * 0.76) return null;
            return <circle key={`${ix},${iy}`} cx={x} cy={y} r={1.5} className="fp-twinkle" style={{ animationDelay: `${((ix + 2) * 0.22).toFixed(2)}s` }} />;
          }),
        )}
      </g>
    );
  if (kind === "rain")
    return (
      <g>
        {dots.map((i) => (
          <line key={i} x1={C - R * 0.6 + (i * R * 1.2) / (n - 1)} x2={C - R * 0.6 + (i * R * 1.2) / (n - 1)} y1={C - R * 0.6} y2={C - R * 0.6 + 4} className="fp-rain" style={{ animationDelay: `${((i * 0.41) % 1.8).toFixed(2)}s` }} />
        ))}
      </g>
    );
  if (kind === "vortex")
    return (
      <g className="fp-spin" style={{ transformOrigin: `${C}px ${C}px`, animationDuration: "5s" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={C + Math.cos(i * 1.05) * (R * (0.25 + 0.1 * i))} cy={C + Math.sin(i * 1.05) * (R * (0.25 + 0.1 * i))} r={2.2 - i * 0.2} className="fp-twinkle" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </g>
    );
  if (kind === "aurora")
    return <path d={`M${C - R * 0.75},${C} q${R * 0.37},-12 ${R * 0.75},0 t${R * 0.75},0`} className="fp-aurora" />;
  return null;
}

/** Energy Gyro reward looks (round 28; round 29 set): a green Gyro tile with "4 Yellow" shown each way. */
function GyroPreview({ id, hex, corners }: { id: string; hex: string; corners: Corner }) {
  const tok = (x: number, y: number, r = 4.2) => <circle cx={x} cy={y} r={r} className="fp-energy" />;
  const bx = C + 18;
  const by = C - 12;
  // Four places curving round the left edges (as the Field: centred on the left side).
  const left = (inset: number, gap: number, n = 4) =>
    [...Array(n).keys()].map((i) => {
      const a = Math.PI + ((i - (n - 1) / 2) * gap) / (R - inset);
      const r = (R - inset) / Math.max(Math.abs(Math.cos(a - Math.PI)), 0.87);
      return { x: C + Math.cos(a) * r * 0.87, y: C + Math.sin(a) * r * 0.9 };
    });
  const hexAt = (x: number, y: number, r: number) => [...Array(6).keys()].map((k) => `${(x + r * Math.cos((Math.PI / 3) * k - Math.PI / 2)).toFixed(1)},${(y + r * Math.sin((Math.PI / 3) * k - Math.PI / 2)).toFixed(1)}`).join(" ");
  return (
    <g>
      <path d={hex} className="fp-tile fp-gyro" />
      <path d={hexPath(bx, by, 8, corners)} className="fp-badge fp-gyrobadge" />
      {id === "tokens" && left(6, 9.2).map((q, i) => <g key={i}>{tok(q.x, q.y)}</g>)}
      {id === "corner" && (
        <g>
          <text x={C - 23} y={C - 6} className="fp-gyrotext">
            4
          </text>
          {tok(C - 10, C - 10, 5)}
        </g>
      )}
      {id === "ring" &&
        [0, 1, 2, 3].map((i) => {
          const a0 = -Math.PI / 2 + (i / 4) * Math.PI * 2 + 0.2;
          const a1 = a0 + Math.PI / 2 - 0.4;
          const r = 11.5;
          return <path key={i} d={`M${bx + Math.cos(a0) * r},${by + Math.sin(a0) * r} A${r},${r} 0 0 1 ${bx + Math.cos(a1) * r},${by + Math.sin(a1) * r}`} className="fp-energyarc" />;
        })}
      {id === "orbit" &&
        [0, 1, 2, 3].map((i) => {
          const a = -Math.PI * 0.62 + (i - 1.5) * 0.62;
          return <g key={i}>{tok(bx + Math.cos(a) * 13, by + Math.sin(a) * 13, 3.2)}</g>;
        })}
      {id === "pips" &&
        [0, 1, 2, 3, 4, 5].map((i) => {
          const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
          return <circle key={i} cx={bx + Math.cos(a) * 12} cy={by + Math.sin(a) * 12} r={i < 4 ? 2.4 : 1.6} className={i < 4 ? "fp-energy" : "fp-pipoff"} />;
        })}
      {id === "honeycomb" &&
        [
          [0, 0],
          [6.6, 0],
          [3.3, -5.7],
          [3.3, 5.7],
        ].map(([dx, dy], i) => <polygon key={i} points={hexAt(C - 21 + dx!, C + 1 + dy!, 3.7)} className="fp-energyhex" />)}
      {id === "chain" && (
        <g>
          <polyline points={left(7, 9.2).map((q) => `${q.x},${q.y}`).join(" ")} className="fp-chainlink" />
          {left(7, 9.2).map((q, i) => (
            <polygon key={i} points={hexAt(q.x, q.y, 3.8)} className="fp-energyhex" />
          ))}
        </g>
      )}
      {id === "string" && (
        <g>
          <polyline points={left(5, 8, 6).map((q) => `${q.x},${q.y}`).join(" ")} className="fp-chainlink" />
          {left(5, 8, 6)
            .slice(1, -1)
            .map((q, i) => (
              <circle key={i} cx={q.x} cy={q.y} r={2.6} className="fp-energy fp-bead" />
            ))}
        </g>
      )}
    </g>
  );
}

/** End the Overload button looks (round 29): a sketch of each shape, its colours and its effects. */
function EndButtonPreview({ id }: { id: string }) {
  const c = 50;
  const shape = (cls: string) => {
    if (id === "reactor") return <polygon points={[...Array(6).keys()].map((k) => `${c + 22 * Math.cos((Math.PI / 3) * k - Math.PI / 2)},${c + 22 * Math.sin((Math.PI / 3) * k - Math.PI / 2)}`).join(" ")} className={cls} />;
    if (id === "hazard") return <polygon points={`${c},${c - 25} ${c + 25},${c} ${c},${c + 25} ${c - 25},${c}`} className={cls} />;
    if (id === "forge") return <rect x={c - 20} y={c - 20} width={40} height={40} rx={10} className={cls} />;
    if (id === "gate") return <circle cx={c} cy={c} r={20} className={cls} />;
    return <circle cx={c} cy={c} r={id === "singularity" ? 12 : 21} className={cls} />;
  };
  const dots = (n: number, r: number, cls: string, delay = 0.13) =>
    [...Array(n).keys()].map((i) => {
      const a = (i / n) * Math.PI * 2;
      return <circle key={i} cx={c + Math.cos(a) * r} cy={c + Math.sin(a) * r} r={1.7} className={cls} style={{ animationDelay: `${(i * delay).toFixed(2)}s` }} />;
    });
  return (
    <g className={`fp-eob fp-eob-${id}`}>
      <rect x={4} y={4} width={92} height={92} rx={6} className="fp-field" />
      {id === "singularity" && (
        <g className="fp-spin" style={{ transformOrigin: `${c}px ${c}px`, animationDuration: "2.6s" }}>
          <ellipse cx={c} cy={c} rx={30} ry={9} className="fp-disc" />
          {dots(10, 22, "fp-twinkle")}
        </g>
      )}
      {shape("fp-eob-body")}
      {id === "sun" && <circle cx={c} cy={c} r={30} className="fp-eob-corona" />}
      {id === "reactor" && (
        <g>
          <g className="fp-spin" style={{ transformOrigin: `${c}px ${c}px`, animationDuration: "2s" }}>
            <ellipse cx={c} cy={c} rx={13} ry={5} className="fp-eob-ring" />
          </g>
          <g className="fp-spin" style={{ transformOrigin: `${c}px ${c}px`, animationDuration: "3s", animationDirection: "reverse" }}>
            <ellipse cx={c} cy={c} rx={5} ry={13} className="fp-eob-ring" />
          </g>
          <circle cx={c} cy={c} r={4.5} className="fp-eob-core" />
        </g>
      )}
      {id === "orb" && (
        <g>
          <polyline points={`${c},${c} ${c + 7},${c - 6} ${c + 12},${c - 3} ${c + 17},${c - 10}`} className="fp-chain" />
          <polyline points={`${c},${c} ${c - 8},${c + 4} ${c - 11},${c + 12}`} className="fp-chain" />
          <circle cx={c} cy={c} r={4} className="fp-eob-core" />
        </g>
      )}
      {id === "hazard" &&
        [0, 1, 2].map((k) => <polyline key={k} points={`${c - 9},${c + 8} ${c},${c + 2} ${c + 9},${c + 8}`} className="fp-chevron" style={{ animationDelay: `${k * 0.45}s` }} />)}
      {id === "hazard" && (
        <g className="fp-spin" style={{ transformOrigin: `${c}px ${c}px`, animationDuration: "2.8s" }}>
          <path d={`M${c},${c} L${c + 40},${c - 10} A41,41 0 0 1 ${c + 40},${c + 10} Z`} className="fp-sweep" />
        </g>
      )}
      {id === "forge" && [0, 1, 2, 3, 4].map((i) => <circle key={i} className="fp-rise" cx={c - 14 + i * 7} cy={c - 18} r={1.6} style={{ animationDelay: `${((i * 0.37) % 1.6).toFixed(2)}s` }} />)}
      {id === "gate" && (
        <g>
          <g className="fp-spin" style={{ transformOrigin: `${c}px ${c}px`, animationDuration: "1.6s", animationDirection: "reverse" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx={c + Math.cos(i * 1.26) * (4 + i * 2.6)} cy={c + Math.sin(i * 1.26) * (4 + i * 2.6)} r={1.6} />
            ))}
          </g>
          {dots(9, 20, "fp-chase", 0.17)}
        </g>
      )}
      {id === "sun" && <circle cx={c} cy={c} r={10} className="fp-eob-core" />}
    </g>
  );
}

/** Exposure looks (round 28): End the Overload (bottom right) and three units alone on their plates. */
function ExposurePreview({ id, corners }: { id: string; corners: Corner }) {
  const btn = { x: 84, y: 84 };
  const units = [
    { x: 26, y: 30 },
    { x: 58, y: 22 },
    { x: 30, y: 66 },
  ];
  return (
    <g>
      <rect x={4} y={4} width={92} height={92} rx={6} className="fp-field" />
      {units.map((u, i) => (
        <path key={i} d={hexPath(u.x, u.y, 11, corners)} className={`fp-tile ${id === "surge" ? "fp-surge" : ""}`} style={{ animationDelay: `${0.6 + i * 0.1}s` }} />
      ))}
      <circle cx={btn.x} cy={btn.y} r={8} className="fp-eo" />
      {(id === "strike" || id === "drain") &&
        units.flatMap((u, i) =>
          // Round 29: a steady stream (many motes, evenly spaced), not one quick burst.
          [0, 1, 2, 3, 4, 5].map((j) => {
            const a = id === "strike" ? btn : u;
            const b = id === "strike" ? u : btn;
            return <circle key={`${i}-${j}`} cx={a.x} cy={a.y} r={1.8} className="fp-fly fp-stream" style={{ "--dx": `${b.x - a.x}px`, "--dy": `${b.y - a.y}px`, animationDelay: `${(j * 0.3 + i * 0.07).toFixed(2)}s` } as CSSProperties} />;
          }),
        )}
      {id === "chain" && <polyline points={`${btn.x},${btn.y} 66,52 ${units[1]!.x},${units[1]!.y} 44,26 ${units[0]!.x},${units[0]!.y} 22,48 ${units[2]!.x},${units[2]!.y}`} className="fp-chain" />}
      {id === "nova" && <circle cx={btn.x} cy={btn.y} r={10} className="fp-nova" style={{ transformOrigin: `${btn.x}px ${btn.y}px` }} />}
      {id === "surge" && units.map((u, i) => <line key={i} x1={btn.x} y1={btn.y} x2={u.x} y2={u.y} className="fp-thread" />)}
    </g>
  );
}

function Preview({ k, id, corners }: { k: keyof Features; id: string; corners: Corner }) {
  const hex = hexPath(C, C, R, k === "corners" ? (id as Corner) : corners);
  const tile = <path d={hex} className="fp-tile" />;
  let body = tile;
  if (k === "corners") body = <path d={hexPath(C, C, R + 10, id as Corner)} className="fp-tile fp-edge" />;
  else if (k === "gyroEnergy") body = <GyroPreview id={id} hex={hex} corners={corners} />;
  else if (k === "exposure") body = <ExposurePreview id={id} corners={corners} />;
  else if (k === "endButton") body = <EndButtonPreview id={id} />;
  else if (k === "depth") {
    const n = id === "original" ? 0 : 4;
    const gap = id === "stack" ? 4 : 2.6;
    body = (
      <g>
        {[...Array(n).keys()].reverse().map((i) => (
          <path key={i} d={hexPath(C, C + gap * (i + 1), R, corners)} className={id === "stackHint" ? "fp-layer fp-faint" : id === "glass" ? "fp-layer fp-glass" : "fp-layer"} />
        ))}
        {tile}
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={C - R * 0.75 + i * 6} y1={C + R * 0.62 + i * 1.2} x2={C - R * 0.75 + i * 6} y2={C + R * 0.62 + i * 1.2 - 4} className="fp-notch" />
        ))}
      </g>
    );
  } else if (k === "readyUnit" || k === "readySector") {
    const kind = READY_KIND[id] ?? "breath";
    body = (
      <g>
        <path d={hex} className={`fp-tile ${k === "readySector" ? "fp-dark" : ""}`} />
        {(kind === "glow" || kind === "core") && <path d={kind === "core" ? hexPath(C, C, R * 0.45, corners) : hex} className="fp-glow" />}
        <path d={hex} className={kind === "breath" || kind === "glow" ? "fp-ready fp-breath" : kind === "beat" ? "fp-ready fp-beat" : "fp-ready fp-still"} />
        <Dots kind={kind} hex={hex} />
      </g>
    );
  } else if (k === "names") {
    body = (
      <g>
        {tile}
        {id === "shown" && (
          <text x={C - 15} y={C + 16} className="fp-name">
            S_12
          </text>
        )}
        <path d={hexPath(C + 18, C - 18, 8, corners)} className="fp-badge" />
      </g>
    );
  } else if (k === "overload") {
    body = (
      <g>
        <rect x={8} y={14} width={84} height={72} rx={6} className="fp-field" />
        <rect x={8} y={14} width={84} height={72} rx={6} className="fp-plasma" />
        {id === "original" ? (
          <rect x={8} y={14} width={84} height={72} rx={6} className="fp-beam" />
        ) : id === "loops" ? (
          [20, 58].map((x, i) => <path key={i} d={`M${x},86 Q${x + 11},${60 - i * 6} ${x + 22},86`} className="fp-loop" style={{ animationDelay: `${i * 0.8}s` }} />)
        ) : id === "tempest" ? (
          <g>
            {[18, 50, 82].map((x, i) => <circle key={i} cx={x} cy={14} r={6} className="fp-cloud" style={{ animationDelay: `${i * 0.4}s` }} />)}
            <polyline points="18,14 26,20 32,12 40,19 50,14" className="fp-chain" />
          </g>
        ) : id === "torrent" ? (
          <rect x={8} y={14} width={84} height={72} rx={6} className="fp-torrent" />
        ) : id === "breath" ? (
          <rect x={8} y={14} width={84} height={72} rx={6} className="fp-breathwall" style={{ transformOrigin: "50px 50px" }} />
        ) : id === "embers" ? (
          [...Array(10).keys()].map((i) => <circle key={i} className="fp-rise" cx={i < 5 ? 12 + i * 2 : 88 - (i - 5) * 2} cy={84} r={1.6} style={{ animationDelay: `${((i * 0.33) % 1.6).toFixed(2)}s` }} />)
        ) : id === "rift" ? (
          <g>
            <path d="M30,86 Q40,80 50,86 Q40,90 30,86 Z" className="fp-rift" />
            <path d="M92,30 Q86,40 92,50 Q96,40 92,30 Z" className="fp-rift" style={{ animationDelay: "1.1s" }} />
          </g>
        ) : (
          [0, 1, 2, 3, 4, 5].map((i) => <circle key={i} className="fp-inflow" cx={8 + (i % 3) * 42} cy={i > 2 ? 86 : 14} r={2} style={{ animationDelay: `${i * 0.3}s` }} />)
        )}
      </g>
    );
  } else if (k === "next") {
    body = (
      <g>
        {tile}
        {id === "corner" && <path d={hexPath(C - 20, C + 14, 8, corners)} className="fp-badge fp-next" />}
        {id === "ghost" && <path d={hexPath(C, C, 20, corners)} className="fp-ghost" />}
        {id === "behind" && (
          <g>
            <path d={hexPath(C + 13, C - 12, 8, corners)} className="fp-badge fp-next" />
            <path d={hexPath(C + 19, C - 18, 8, corners)} className="fp-badge" />
          </g>
        )}
        {id === "chip" && (
          <g>
            <rect x={C - 15} y={C + 14} width={30} height={10} rx={5} className="fp-chip" />
            <text x={C - 11} y={C + 22} className="fp-chiptext">
              next
            </text>
          </g>
        )}
      </g>
    );
  }
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="fp-svg" aria-hidden="true">
      {body}
    </svg>
  );
}

export function FeaturesPage({ onBack }: { onBack: () => void }) {
  const [t, setT] = useState(features());
  useEffect(() => onFeatures(() => setT(features())), []);
  return (
    <PageShell id="features" title="Features" sub="Looks of the Field · choose one of each" onBack={onBack}>
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
        {FEATURE_ROWS.map((r) => {
          const locked = !!r.unlock;
          const now = r.list.find((x) => x.id === t[r.key]);
          return (
            <section key={r.key} className={`bf-panel !p-4 ${locked ? "opacity-60" : ""}`} data-feature-card={r.key} data-locked={locked || undefined}>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="bf-label !text-[14px]">{r.title}</h2>
                {locked ? (
                  <span className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-[0.1em] text-amber-200">
                    <Lock size={14} /> {r.unlock}
                  </span>
                ) : (
                  <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-sky-200">{now?.label}</span>
                )}
              </div>
              <p className="mt-1 text-[14px] text-sky-50/90">{r.about}</p>
              <div className="fp-grid mt-3" role="group" aria-label={r.title}>
                {r.list.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    disabled={locked}
                    aria-pressed={t[r.key] === x.id}
                    data-feature-pick={`${r.key}:${x.id}`}
                    title={x.note}
                    className="fp-choice"
                    style={{ "--fp": t[r.key] === x.id ? "1" : "0" } as CSSProperties}
                    onClick={() => (playSelect(), setFeatures({ [r.key]: x.id } as Partial<Features>))}
                  >
                    <Preview k={r.key} id={x.id} corners={t.corners} />
                    <span className="fp-label">{x.label}</span>
                  </button>
                ))}
              </div>
              {now && !locked && <p className="mt-2 text-[13px] text-sky-100/80">{now.note}</p>}
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
