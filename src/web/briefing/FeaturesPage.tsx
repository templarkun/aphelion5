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
const READY_KIND: Record<string, "breath" | "rise" | "orbit" | "twinkle" | "beat" | "inward" | "glow" | "core" | "arcs" | "tide"> = {
  original: "breath", embers: "rise", heartbeat: "beat", motes: "orbit", sparkle: "twinkle", gather: "inward", aura: "orbit", current: "orbit", arcs: "arcs",
  fill: "glow", inner: "glow", converge: "inward", drift: "rise", tide: "tide", core: "core", haze: "rise",
};

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
  return null;
}

function Preview({ k, id, corners }: { k: keyof Features; id: string; corners: Corner }) {
  const hex = hexPath(C, C, R, k === "corners" ? (id as Corner) : corners);
  const tile = <path d={hex} className="fp-tile" />;
  let body = tile;
  if (k === "corners") body = <path d={hexPath(C, C, R + 10, id as Corner)} className="fp-tile fp-edge" />;
  else if (k === "depth") {
    const n = id === "original" ? 0 : 4;
    const gap = id === "stack" ? 4 : 2.6;
    body = (
      <g>
        {[...Array(n).keys()].reverse().map((i) => (
          <path key={i} d={hexPath(C, C + gap * (i + 1), R, corners)} className={id === "stackHint" ? "fp-layer fp-faint" : "fp-layer"} />
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
