/**
 * The Field (spec "Screen and controls"), drawn with PixiJS: pointy-top hex
 * sectors laid out by Core Rules 3.8 (r + 1 = right, q + 1 = up-right), each
 * showing its top tile, tokens as badges, stack height and arrows by facing.
 * Legal answers to the current question are highlighted and clickable.
 */

import { Application, Container, Graphics, Text } from "pixi.js";
import { useEffect, useRef } from "react";
import type { GameData } from "../data/index.js";
import { type Ctx, sectorKeys, sectorState, stack, strength, tile, topTileId, unitDef } from "../engine/field.js";
import type { GameState, TileId } from "../engine/state.js";
import { arrowSides, fromKey } from "../geometry/hex.js";

export interface FieldProps {
  data: GameData;
  state: GameState;
  /** Sector keys or tile ids that are legal answers now. */
  choosable: { sectors: string[]; units: TileId[] };
  selected: string[];
  onPick: (id: string) => void;
  onHover: (sector: string | undefined) => void;
  showHidden: boolean;
  dark: boolean;
}

const TYPE_COLOUR: Record<string, number> = {
  Bot: 0xe8e6e1,
  Mecha: 0xf0913a,
  Gyro: 0x55b36b,
  Sleeper: 0x4f86d9,
  Sentinel: 0xd9534f,
  Flare: 0xf2c94c,
  Omega: 0x9b6bd6,
};

/** Screen angle of each side (1 left, then clockwise), in radians; y grows downwards. */
const SIDE_ANGLE: Record<number, number> = { 1: Math.PI, 2: (2 * Math.PI) / 3, 3: Math.PI / 3, 4: 0, 5: -Math.PI / 3, 6: (-2 * Math.PI) / 3 };

function hexPoints(cx: number, cy: number, size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(cx + size * Math.cos(a), cy + size * Math.sin(a));
  }
  return pts;
}

function badgeText(t: GameState["tiles"][string]["tokens"]): string[] {
  const out: string[] = [];
  if (t.wreck) out.push("WRECK");
  if (t.alert) out.push("ALERT");
  if (t.damage) out.push(`D${t.damage}`);
  if (t.shield) out.push(`S${t.shield}`);
  if (t.bioShield) out.push(`BS${t.bioShield}`);
  if (t.barrier) out.push("BAR");
  if (t.tick) out.push(`TICK${t.tick > 1 ? t.tick : ""}`);
  if (t.mortar) out.push(`MOR${t.mortar > 1 ? t.mortar : ""}`);
  if (t.feedback) out.push(`FB${t.feedback > 1 ? t.feedback : ""}`);
  return out;
}

export function FieldView(p: FieldProps) {
  const host = useRef<HTMLDivElement>(null);
  const app = useRef<Application | null>(null);
  const ready = useRef(false);
  const props = useRef(p);
  props.current = p;

  useEffect(() => {
    const a = new Application();
    app.current = a;
    let gone = false;
    void a.init({ antialias: true, backgroundAlpha: 0, resizeTo: host.current!, autoDensity: true, resolution: window.devicePixelRatio || 1 }).then(() => {
      if (gone) return a.destroy(true);
      host.current!.appendChild(a.canvas);
      ready.current = true;
      draw();
      new ResizeObserver(() => draw()).observe(host.current!);
    });
    return () => {
      gone = true;
      if (ready.current) a.destroy(true);
      ready.current = false;
    };
  }, []);

  useEffect(() => draw());

  function draw(): void {
    const a = app.current;
    if (!a || !ready.current || !host.current) return;
    const { data, state, choosable, selected, onPick, onHover, showHidden, dark } = props.current;
    const c: Ctx = { data, state };
    a.stage.removeChildren().forEach((x) => x.destroy({ children: true }));
    const keys = sectorKeys(state);
    if (keys.length === 0) return;
    const w = host.current.clientWidth;
    const h = host.current.clientHeight;
    const pos = keys.map((k) => {
      const { q, r } = fromKey(k);
      return { k, x: Math.sqrt(3) * (r + q / 2), y: -1.5 * q };
    });
    const minX = Math.min(...pos.map((p) => p.x)) - 1;
    const maxX = Math.max(...pos.map((p) => p.x)) + 1;
    const minY = Math.min(...pos.map((p) => p.y)) - 1.1;
    const maxY = Math.max(...pos.map((p) => p.y)) + 1.1;
    const size = Math.max(20, Math.min(w / (maxX - minX), h / (maxY - minY)) * 0.98);
    const ox = (w - (maxX - minX) * size) / 2 - minX * size;
    const oy = (h - (maxY - minY) * size) / 2 - minY * size;
    const ink = dark ? 0xe6e6e6 : 0x1d1d1f;
    const plate = dark ? 0x2b2d31 : 0xd6d3cc;
    const back = dark ? 0x3c4f66 : 0x5b7391;
    const root = new Container();
    a.stage.addChild(root);

    for (const p of pos) {
      const cx = ox + p.x * size;
      const cy = oy + p.y * size;
      const st = sectorState(state, p.k);
      const top = topTileId(state, p.k);
      const g = new Graphics();
      const unit = st === "occupied" ? top : undefined;
      const fill = st === "cleared" ? plate : st === "dark" ? back : TYPE_COLOUR[unitDef(c, top!).type] ?? 0xcccccc;
      const isChoice = choosable.sectors.includes(p.k) || (unit !== undefined && choosable.units.includes(unit));
      const isSel = selected.includes(p.k) || (unit !== undefined && selected.includes(unit));
      g.poly(hexPoints(cx, cy, size * 0.94)).fill({ color: fill }).stroke({ width: isSel ? 5 : isChoice ? 3 : 1.5, color: isSel ? 0x00a37a : isChoice ? 0xffb000 : dark ? 0x111111 : 0x77736b });
      g.eventMode = "static";
      g.cursor = isChoice ? "pointer" : "default";
      g.on("pointerover", () => onHover(p.k));
      g.on("pointerout", () => onHover(undefined));
      g.on("pointertap", () => {
        if (choosable.sectors.includes(p.k)) onPick(p.k);
        else if (unit !== undefined && choosable.units.includes(unit)) onPick(unit);
      });
      root.addChild(g);

      const label = (text: string, y: number, sz: number, color = 0x1d1d1f, bold = false) => {
        const t = new Text({ text, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(9, sz), fill: color, fontWeight: bold ? "700" : "400", align: "center" } });
        t.anchor.set(0.5);
        t.x = cx;
        t.y = cy + y;
        t.eventMode = "none";
        root.addChild(t);
      };
      const height = stack(state, p.k).length;
      if (st === "cleared") label("Cleared", 0, size * 0.2, ink);
      else if (st === "dark") {
        const known = showHidden || state.seen.includes(top!);
        label(known ? `? ${tile(state, top!).unitId ?? "?"}` : "?", -size * 0.1, size * 0.3, 0xffffff, true);
        label(`${height} tile${height === 1 ? "" : "s"}`, size * 0.3, size * 0.18, 0xdfe7f1);
      } else {
        const t = tile(state, unit!);
        const str = strength(c, unit!);
        label(t.unitId ?? "?", -size * 0.28, size * 0.28, 0x1d1d1f, true);
        label(str !== undefined ? `Strength ${str}` : "", size * 0.02, size * 0.17);
        const b = badgeText(t.tokens);
        if (b.length) label(b.join(" "), size * 0.26, size * 0.16, t.tokens.alert || t.tokens.wreck ? 0x9b1c1c : 0x1d1d1f, true);
        label(height > 1 ? `+${height - 1} beneath` : "alone", size * 0.5, size * 0.14);
        // Arrows on their sides, turned by the tile's facing (3.8).
        const sides = arrowSides(unitDef(c, unit!).arrows, t.facing);
        for (const s of sides) {
          const ang = SIDE_ANGLE[s]!;
          const ex = cx + Math.cos(ang) * size * 0.82;
          const ey = cy - Math.sin(ang) * size * 0.82;
          const bx = cx + Math.cos(ang) * size * 0.6;
          const by = cy - Math.sin(ang) * size * 0.6;
          const px = -Math.sin(ang) * size * 0.08;
          const py = -Math.cos(ang) * size * 0.08;
          const arr = new Graphics();
          arr.poly([ex, ey, bx + px, by + py, bx - px, by - py]).fill({ color: 0x1d1d1f });
          arr.eventMode = "none";
          root.addChild(arr);
        }
      }
    }
  }

  return <div ref={host} className="field" aria-label="The Field" />;
}
