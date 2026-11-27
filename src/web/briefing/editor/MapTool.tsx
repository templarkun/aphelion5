/**
 * The Campaign editor's map tool (designer 2026-11-17/18): a hex grid on axial (q, r) as Core Rules
 * 3.8 (r+1 right, q+1 up-right, pointy-top). Tap or drag to add and remove sectors; (0, 0), the
 * starting sector, always stays. In "Omega sectors" mode a tap marks a sector gold or unmarks it;
 * the Omega units chosen below stand on every gold sector, one tile of each (7.2 step 2, the
 * Campaign file's format item 7). Screen only.
 */

import { useRef, useState } from "react";
import type { Coord } from "../../../geometry/hex.js";
import { dealOf, OMEGA_IDS, OMEGA_ROLES, sameCoord, type MissionDraft } from "./model.js";

const S3 = Math.sqrt(3);
const HEX = [0, 1, 2, 3, 4, 5].map((i) => `${(Math.sin((i * Math.PI) / 3) * 0.95).toFixed(3)},${(-Math.cos((i * Math.PI) / 3) * 0.95).toFixed(3)}`).join(" ");
const dist = (p: Coord) => (Math.abs(p.q) + Math.abs(p.r) + Math.abs(p.q + p.r)) / 2;
const at = (p: Coord) => ({ x: S3 * (p.r + p.q / 2), y: -1.5 * p.q });

export function MapTool({ m, onChange, others }: { m: MissionDraft; onChange: (m: MissionDraft) => void; others: { tag: string; map: Coord[] }[] }) {
  const [mode, setMode] = useState<"sectors" | "omega">("sectors");
  const paint = useRef<"add" | "remove" | undefined>();
  // Designer 2026-11-27: 3 rings round (0, 0) at first (was 5); two more rings beyond the map as it grows.
  const R = Math.max(1, ...m.map.map(dist)) + 2;
  const cells: Coord[] = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) if (dist({ q, r }) <= R) cells.push({ q, r });
  const on = (p: Coord) => m.map.some((x) => sameCoord(x, p));
  const gold = (p: Coord) => m.omegaSectors.some((o) => sameCoord(o, p));
  const deal = dealOf(m);

  function setSector(p: Coord, add: boolean): MissionDraft {
    if (p.q === 0 && p.r === 0) return m;
    if (add) return on(p) ? m : { ...m, map: [...m.map, p] };
    // A sector taken off is no longer an Omega sector either.
    return { ...m, map: m.map.filter((x) => !sameCoord(x, p)), omegaSectors: m.omegaSectors.filter((o) => !sameCoord(o, p)) };
  }
  function down(p: Coord): void {
    if (mode === "sectors") {
      paint.current = on(p) ? "remove" : "add";
      onChange(setSector(p, paint.current === "add"));
      return;
    }
    if (!on(p)) return;
    onChange({ ...m, omegaSectors: gold(p) ? m.omegaSectors.filter((o) => !sameCoord(o, p)) : [...m.omegaSectors, p] });
  }
  function enter(p: Coord): void {
    if (mode === "sectors" && paint.current) onChange(setSector(p, paint.current === "add"));
  }

  const xs = cells.map((c) => at(c).x);
  const ys = cells.map((c) => at(c).y);
  const box = [Math.min(...xs) - 1, Math.min(...ys) - 1.1, Math.max(...xs) - Math.min(...xs) + 2, Math.max(...ys) - Math.min(...ys) + 2.2];
  const mirror = () => {
    const f = (p: Coord) => ({ q: p.q, r: -p.r - p.q });
    onChange({ ...m, map: m.map.map(f), omegaSectors: m.omegaSectors.map(f) });
  };

  return (
    <div className="grid gap-3" data-map-tool>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Map tool">
        {(["sectors", "omega"] as const).map((x) => (
          <button key={x} type="button" role="radio" aria-checked={mode === x} data-map-mode={x} className={`rounded-full border px-3 py-1.5 text-[14px] font-semibold ${mode === x ? "border-white bg-white text-indigo-950" : "border-white/40 text-white hover:bg-white/10"}`} onClick={() => setMode(x)}>
            {x === "sectors" ? "Sectors" : "Omega sectors"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[14px] text-sky-100" data-omega-placed>
        <span>On every gold sector, one of each:</span>
        {OMEGA_IDS.map((id) => (
          <label key={id} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={m.omegaPlaced.includes(id)}
              onChange={(e) => onChange({ ...m, omegaPlaced: e.target.checked ? OMEGA_IDS.filter((x) => x === id || m.omegaPlaced.includes(x)) : m.omegaPlaced.filter((x) => x !== id) })}
            />
            {OMEGA_ROLES[id]} ({id})
          </label>
        ))}
      </div>
      <svg
        className="w-full touch-none select-none rounded-lg bg-black/25"
        style={{ maxHeight: 460 }}
        viewBox={box.map((v) => v.toFixed(2)).join(" ")}
        onPointerUp={() => (paint.current = undefined)}
        onPointerLeave={() => (paint.current = undefined)}
        role="group"
        aria-label="Map"
      >
        {cells.map((c) => {
          const p = at(c);
          const inMap = on(c);
          const o = gold(c);
          const start = c.q === 0 && c.r === 0;
          return (
            <g
              key={`${c.q},${c.r}`}
              transform={`translate(${p.x.toFixed(3)} ${p.y.toFixed(3)})`}
              data-hex={`${c.q},${c.r}`}
              data-on={inMap ? "1" : "0"}
              onPointerDown={(e) => {
                // Touch captures the pointer on the first hexagon: let it go, so a drag paints the next ones.
                try {
                  (e.target as Element).releasePointerCapture(e.pointerId);
                } catch {
                  /* not captured */
                }
                down(c);
              }}
              onPointerEnter={() => enter(c)}
              style={{ cursor: "pointer" }}
            >
              <title>{`(${c.q}, ${c.r})${start ? " starting sector" : ""}${o ? " Omega sector" : ""}`}</title>
              <polygon points={HEX} data-gold={o ? "1" : "0"} fill={o ? "rgb(252 211 77 / 0.8)" : inMap ? "rgb(255 255 255 / 0.32)" : "rgb(255 255 255 / 0.04)"} stroke={inMap ? "rgb(255 255 255 / 0.85)" : "rgb(255 255 255 / 0.18)"} strokeWidth={inMap ? 0.07 : 0.04} strokeLinejoin="round" />
              {start && <circle r="0.42" fill="none" stroke="#fde68a" strokeWidth="0.1" />}
              {o && (
                <text textAnchor="middle" dy="0.18" fontSize="0.36" fontWeight="800" fill="#1e1b4b">
                  {m.omegaPlaced.map((id) => id.replace("O_0", "O")).join(" ") || "Ω"}
                </text>
              )}
              {inMap && !o && !start && (
                <text textAnchor="middle" dy="0.12" fontSize="0.3" fill="rgb(255 255 255 / 0.65)">
                  {c.q},{c.r}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-2 text-[14px] text-sky-100">
        <span data-sector-count={m.map.length}>
          <b className="text-white">{m.map.length}</b> sectors · deal: <b className="text-white">{deal.tiles}</b> tiles over {deal.sectors} sector{deal.sectors === 1 ? "" : "s"}
          {deal.sectors > 0 && ` (${deal.each} each${deal.extra ? `, ${deal.extra} get one more` : ""})`}
        </span>
        <span className="flex-1" />
        <button type="button" className="bf-btn !min-h-[36px] !px-3 !text-[13px]" onClick={mirror}>
          Mirror
        </button>
        <button type="button" className="bf-btn !min-h-[36px] !px-3 !text-[13px]" onClick={() => onChange({ ...m, map: [{ q: 0, r: 0 }], omegaPlaced: [] })}>
          Clear
        </button>
        {others.length > 0 && (
          <select
            className="rounded-full border border-white/40 bg-indigo-950/60 px-3 py-1.5 text-[13px] text-white"
            aria-label="Copy the map of another mission"
            value=""
            onChange={(e) => {
              const o = others.find((x) => x.tag === e.target.value);
              if (o) onChange({ ...m, map: o.map.map((p) => ({ ...p })), omegaSectors: m.omegaSectors.filter((x) => o.map.some((p) => sameCoord(p, x))) });
            }}
          >
            <option value="">Copy a map from…</option>
            {others.map((o) => (
              <option key={o.tag} value={o.tag}>
                {o.tag}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
