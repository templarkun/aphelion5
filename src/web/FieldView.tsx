/**
 * The Field (spec "Screen and controls"), drawn with PixiJS: pointy-top hex
 * sectors laid out by Core Rules 3.8 (r + 1 = right, q + 1 = up-right), each
 * showing its top tile, tokens as badges, stack height and arrows by facing.
 * Legal answers to the current question are lit and clickable.
 *
 * Interaction and animation (Program Spec section of that name):
 * - the engine's events of each answer play one at a time (anim.ts); a tap
 *   anywhere finishes them; Undo plays nothing backwards;
 * - a Mecha that can act is dragged onto a blue sector or unit (move) or a
 *   red unit (Attack); a tether ties it to where it came from; it snaps onto
 *   a target and floats back when dropped anywhere else. M_03 / M_06: drop
 *   on blue first (the Passive), then on red, in one gesture.
 *
 * Each sector is drawn into its own container, rebuilt on every draw; the
 * animations and the drag change those containers frame by frame on top of
 * the board as it now is, so a re-draw in the middle of either is harmless.
 */

// PixiJS without eval(): the published page (and app wrappers) may forbid it.
import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Text } from "pixi.js";
import { useEffect, useRef } from "react";
import type { GameData } from "../data/index.js";
import { type GameEvent, newEvents } from "../engine/events.js";
import { type Ctx, sectorKeys, sectorOf, sectorState, stack, strength, tile, topTileId, unitDef } from "../engine/field.js";
import type { Answer } from "../engine/questions.js";
import type { GameState, TileId } from "../engine/state.js";
import { arrowSides, fromKey } from "../geometry/hex.js";
import { type NodeLook, Player, type Step, easeInOut, easeOut } from "./anim.js";
import { type Source, fireGlow, weaponStep } from "./weapons.js";
import type { DragKind, DragPlan, DragTarget } from "./drag.js";

export interface FieldProps {
  data: GameData;
  state: GameState;
  /** Sector keys or tile ids that are legal answers now. */
  choosable: { sectors: string[]; units: TileId[] };
  /** How a lit sector glows when tapping: blue-green for a move, red for an Attack (else amber). */
  tones?: Record<string, DragKind> | undefined;
  selected: string[];
  onPick: (id: string) => void;
  onHover: (sector: string | undefined) => void;
  showHidden: boolean;
  dark: boolean;
  /** A facing being chosen (3.7): rotate buttons on that unit, drawn at `facing`. */
  rotate?: { tile: TileId; facing: number; onTurn: (dir: 1 | -1) => void } | undefined;
  /** The drag plan of a unit that can be dragged now (a Mecha on the action menu). */
  dragFor?: ((tile: TileId) => DragPlan | undefined) | undefined;
  /** A piece dropped on a lit target: send these answers. */
  onDrop?: ((answers: Answer[]) => void) | undefined;
  /** A short message for the information strip (a drop that was not allowed). */
  onNote?: ((text: string, warn: boolean) => void) | undefined;
  /** Sectors a selected Module would affect (designer 2026-11-08): a violet overline. */
  affected?: string[] | undefined;
  /** A tap on nothing that can be chosen. */
  onMiss?: (() => void) | undefined;
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
const ENERGY_HEX: Record<string, number> = { Yellow: 0xf2c230, Red: 0xe8402f, Blue: 0x2f74e8 };
const ENERGY_CSS: Record<string, string> = { Yellow: "var(--yellow)", Red: "var(--red)", Blue: "var(--blue)" };
const MOVE = 0x23c4a8;
const ATTACK = 0xff5a36;
const READY = 0xf2b84b;
/** What a selected Module would affect (designer 2026-11-08). */
const AFFECT = 0x9b6bff;

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

const breath = (now: number, period: number) => 0.5 - 0.5 * Math.cos(((now % period) / period) * 2 * Math.PI);

interface DragState {
  plan: DragPlan;
  /** The Mecha's own sector (where a cancelled drag returns). */
  home: string;
  /** Where the tether is tied now (home, or the Passive's sector for M_03 / M_06). */
  anchor: string;
  stage: "drag" | "carry" | "settle" | "return";
  /** Piece position (canvas pixels), and where the pointer wants it. */
  x: number;
  y: number;
  wantX: number;
  wantY: number;
  tilt: number;
  touch: boolean;
  snap?: DragTarget | undefined;
  t0: number;
  /** Return: where it started floating back from. */
  fromX?: number;
  fromY?: number;
  /** Settle: the answers sent when it lands. */
  send?: Answer[];
}

export function FieldView(p: FieldProps) {
  const host = useRef<HTMLDivElement>(null);
  const app = useRef<Application | null>(null);
  const ready = useRef(false);
  const props = useRef(p);
  props.current = p;
  const player = useRef(new Player());
  const layers = useRef<{ root: Container; glow: Graphics; fx: Container; drag: Container; tether: Graphics; piece: Container | undefined; hitText: Text | undefined } | undefined>(undefined);
  /** Each sector's container and centre, from the last draw. */
  const nodes = useRef(new Map<string, { node: Container; cx: number; cy: number }>());
  const geo = useRef({ size: 40 });
  const lastState = useRef<GameState | undefined>(undefined);
  const drag = useRef<DragState | undefined>(undefined);
  const press = useRef<{ k: string | undefined; unit: TileId | undefined; x: number; y: number; touch: boolean; held: boolean } | undefined>(undefined);
  const holdTimer = useRef<number | undefined>(undefined);
  const hovered = useRef<string | undefined>(undefined);
  const drawn = useRef<{ state: GameState | undefined; sig: string }>({ state: undefined, sig: "" });
  /** A Mecha dropped on a move target already sits there: its move plays no glide. */
  const dropped = useRef<{ tile: TileId; to: string } | undefined>(undefined);

  useEffect(() => {
    const a = new Application();
    app.current = a;
    let gone = false;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (still) player.current.speed = 0;
    void a.init({ antialias: true, backgroundAlpha: 0, resizeTo: host.current!, autoDensity: true, resolution: window.devicePixelRatio || 1 }).then(() => {
      if (gone) return a.destroy(true);
      host.current!.appendChild(a.canvas);
      const root = new Container();
      const glow = new Graphics();
      glow.eventMode = "none";
      const fx = new Container();
      fx.eventMode = "none";
      const dl = new Container();
      dl.eventMode = "none";
      const tether = new Graphics();
      dl.addChild(tether);
      a.stage.addChild(root, glow, fx, dl);
      layers.current = { root, glow, fx, drag: dl, tether, piece: undefined, hitText: undefined };
      ready.current = true;
      draw();
      a.ticker.add(frame);
      new ResizeObserver(() => draw()).observe(host.current!);
    });
    // A tap anywhere finishes the animations at once (spec "Timing": Skip).
    const skip = () => {
      if (!player.current.busy) return;
      player.current.skip();
      // Put every tile back in place now, and render, before this same tap is matched to a tile.
      frame();
      if (ready.current) app.current?.render();
    };
    document.addEventListener("pointerdown", skip, true);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.current && (drag.current.stage === "drag" || drag.current.stage === "carry")) startReturn(false);
    };
    window.addEventListener("keydown", key);
    const move = (e: PointerEvent) => onMove(e);
    const up = (e: PointerEvent) => onUp(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      gone = true;
      document.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      player.current.skip();
      if (ready.current) a.destroy(true, { children: true });
      ready.current = false;
    };
  }, []);

  // Re-draw only when what is shown changes: re-drawing in the middle of a tap lost the tap
  // (play-test 2026-11-08: the first tap on a touch screen only showed the hover text).
  useEffect(() => {
    const P = props.current;
    const sig = JSON.stringify([P.choosable, P.selected, P.tones, P.rotate && [P.rotate.tile, P.rotate.facing], P.dark, P.showHidden]);
    if (P.state === drawn.current.state && sig === drawn.current.sig) return;
    drawn.current = { state: P.state, sig };
    draw();
  });

  // ---------------------------------------------------------------------------
  // Pointer (plain browser events, so nothing is lost when the board re-draws).
  // A press on a draggable unit becomes a drag after 8 px (spec "Touch details"); a short
  // press is a tap; on a touch screen, holding 0.5 s shows the card text instead.

  const local = (e: { clientX: number; clientY: number }) => {
    const r = host.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /** The sector under a point of the Field, if any. */
  const sectorAt = (x: number, y: number): string | undefined => {
    let best: { k: string; d: number } | undefined;
    for (const [k, n] of nodes.current) {
      const d = Math.hypot(n.cx - x, n.cy - y);
      if (d < geo.current.size * 0.92 && (!best || d < best.d)) best = { k, d };
    }
    return best?.k;
  };
  /** The drag target under the pointer: the target sector it is over, else the nearest within one sector. */
  const targetAt = (d: DragState, x: number, y: number): DragTarget | undefined => {
    let best: { t: DragTarget; dist: number } | undefined;
    for (const t of d.plan.targets) {
      const c = centre(t.sector);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist < geo.current.size * 1.05 && (!best || dist < best.dist)) best = { t, dist };
    }
    return best?.t;
  };

  function onDown(e: PointerEvent): void {
    if (e.pointerType === "mouse") e.preventDefault(); // no text selection from presses on the Field
    const { x, y } = local(e);
    const d = drag.current;
    if (d && d.stage === "carry") {
      // Lifted after the Passive (M_06) or waiting for the sector to move through (M_03):
      // a tap on a lit target does it, anywhere else puts the Mecha back.
      const t = targetAt(d, x, y);
      if (t && sectorAt(x, y) === t.sector) {
        const n = nodes.current.get(t.sector)!;
        d.wantX = d.x = n.cx;
        d.wantY = d.y = n.cy;
        land(t);
      } else startReturn(true);
      press.current = undefined;
      return;
    }
    if (d) endDrag(); // a piece still floating back: finish it now (no piece is ever left behind)
    const k = sectorAt(x, y);
    const st = props.current.state;
    const unit = k !== undefined && sectorState(st, k) === "occupied" ? topTileId(st, k) : undefined;
    const touch = e.pointerType !== "mouse";
    press.current = { k, unit, x, y, touch, held: false };
    window.clearTimeout(holdTimer.current);
    if (touch && k !== undefined)
      holdTimer.current = window.setTimeout(() => {
        const pr = press.current;
        if (!pr || drag.current) return;
        pr.held = true;
        props.current.onHover(pr.k);
      }, 500);
  }

  function onMove(e: PointerEvent): void {
    if (!host.current) return;
    const { x, y } = local(e);
    const d = drag.current;
    if (d && (d.stage === "drag" || d.stage === "carry")) {
      d.wantX = x;
      d.wantY = y - (d.touch ? 40 : 0);
      if (d.stage === "drag") d.snap = targetAt(d, x, y);
      return;
    }
    const pr = press.current;
    if (!pr) {
      // Mouse hover: the card text of the sector under the pointer.
      if (e.pointerType === "mouse" && e.target instanceof Node && host.current.contains(e.target)) {
        const k = sectorAt(x, y);
        if (k !== hovered.current) {
          hovered.current = k;
          props.current.onHover(k);
        }
      } else if (hovered.current !== undefined) {
        hovered.current = undefined;
        props.current.onHover(undefined);
      }
      return;
    }
    if (pr.held || Math.hypot(x - pr.x, y - pr.y) < 8) return;
    window.clearTimeout(holdTimer.current);
    press.current = undefined;
    const P = props.current;
    if (pr.unit === undefined || !P.dragFor || !P.choosable.units.includes(pr.unit)) return;
    const plan = P.dragFor(pr.unit);
    if (!plan) return;
    player.current.skip();
    endDrag();
    const n = nodes.current.get(plan.from)!;
    drag.current = { plan, home: plan.from, anchor: plan.from, stage: "drag", x: n.cx, y: n.cy, wantX: x, wantY: y - (pr.touch ? 40 : 0), tilt: 0, touch: pr.touch, t0: performance.now() };
    makePiece(plan);
    hovered.current = undefined;
    P.onHover(undefined);
  }

  function onUp(e: PointerEvent): void {
    window.clearTimeout(holdTimer.current);
    const pr = press.current;
    press.current = undefined;
    const d = drag.current;
    if (d && d.stage === "drag") {
      // The drop counts where the pointer is now, however fast it moved.
      const { x, y } = local(e);
      const t = targetAt(d, x, y);
      if (!t) return startReturn(true);
      if (t.next) {
        const next = t.next();
        if (next && next.targets.length > 0) return carry(d, t.sector, next, t.kind === "attack");
      }
      d.snap = t;
      return land(t);
    }
    if (!pr || e.type === "pointercancel") return;
    if (pr.held) return props.current.onHover(undefined);
    // A tap.
    const { x, y } = local(e);
    if (Math.hypot(x - pr.x, y - pr.y) >= 8 || !(e.target instanceof Node) || !host.current?.contains(e.target)) return;
    const P = props.current;
    if (P.rotate) {
      const size = geo.current.size;
      const rot: { dir: number; x: number; y: number }[] = JSON.parse(host.current.dataset.rotate ?? "[]");
      const b = rot.find((r) => Math.hypot(r.x - x, r.y - y) < Math.max(22, size * 0.2));
      if (b) return P.rotate.onTurn(b.dir as 1 | -1);
    }
    const k = sectorAt(x, y);
    if (k === undefined) return P.onMiss?.();
    if (P.choosable.sectors.includes(k)) return P.onPick(k);
    const unit = sectorState(P.state, k) === "occupied" ? topTileId(P.state, k) : undefined;
    if (unit !== undefined && P.choosable.units.includes(unit)) return P.onPick(unit);
    P.onMiss?.();
  }

  /** Stay lifted over `at` with new targets (M_06 after its Swap; M_03 choosing where to move through). */
  function carry(d: DragState, at: string, next: DragPlan, choosingPath: boolean): void {
    const n = nodes.current.get(at)!;
    d.plan = { ...next, unitId: d.plan.unitId, hit: d.plan.hit, tile: d.plan.tile };
    d.anchor = choosingPath ? d.home : at;
    d.stage = "carry";
    d.snap = undefined;
    d.x = d.wantX = n.cx;
    d.y = d.wantY = n.cy - geo.current.size * 0.25;
    props.current.onNote?.(
      choosingPath
        ? `${d.plan.unitId}: tap the sector it moves to before this Attack (rule 4.2), or anywhere else to put it back.`
        : `${d.plan.unitId}: now tap a red unit to Attack it, or anywhere else to put it back (rule 4.2).`,
      false,
    );
  }

  function land(t: DragTarget): void {
    const d = drag.current!;
    d.stage = "settle";
    d.snap = t;
    d.send = t.answers;
    d.t0 = performance.now();
    if (t.kind === "move" && !t.next && !t.via) dropped.current = { tile: d.plan.tile, to: t.sector };
    else if (t.kind === "attack" && !t.via) dropped.current = { tile: d.plan.tile, to: t.sector };
  }

  function startReturn(explain: boolean): void {
    const d = drag.current;
    if (!d) return;
    d.stage = "return";
    d.fromX = d.x;
    d.fromY = d.y;
    d.snap = undefined;
    d.t0 = performance.now();
    if (explain)
      props.current.onNote?.(`${d.plan.unitId} cannot go there. Drop it on a blue-green sector to move it, or on a red unit to Attack it (rule 4.2).`, true);
  }

  function endDrag(): void {
    drag.current = undefined;
    const L = layers.current;
    if (!L) return;
    L.tether.clear();
    L.piece?.destroy({ children: true });
    L.piece = undefined;
    L.hitText?.destroy();
    L.hitText = undefined;
  }

  function makePiece(plan: DragPlan): void {
    const L = layers.current!;
    const size = geo.current.size;
    const c = new Container();
    const shadow = new Graphics().poly(hexPoints(6, 14, size * 0.9)).fill({ color: 0x000000, alpha: 0.22 });
    shadow.label = "shadow";
    const body = new Graphics().poly(hexPoints(0, 0, size * 0.9)).fill({ color: TYPE_COLOUR.Mecha! }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.85 });
    const crack = new Graphics()
      .moveTo(-size * 0.35, -size * 0.5)
      .lineTo(-size * 0.05, -size * 0.1)
      .lineTo(-size * 0.2, size * 0.1)
      .lineTo(size * 0.25, size * 0.5)
      .stroke({ width: 2, color: 0x3a1a00, alpha: 0.8 });
    crack.label = "crack";
    crack.visible = false;
    const t = new Text({ text: plan.unitId, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(10, size * 0.28), fill: 0x1d1d1f, fontWeight: "700" } });
    t.anchor.set(0.5);
    t.y = -size * 0.1;
    c.addChild(shadow, body, crack, t);
    L.drag.addChild(c);
    L.piece = c;
  }

  // ---------------------------------------------------------------------------
  // Animation steps from engine events (spec "How things look when they happen").

  function ghost(type: string, unitId: string): Container {
    const size = geo.current.size;
    const c = new Container();
    c.addChild(new Graphics().poly(hexPoints(0, 0, size * 0.9)).fill({ color: TYPE_COLOUR[type] ?? 0xcccccc }).stroke({ width: 1.5, color: 0x77736b }));
    const t = new Text({ text: unitId, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(10, size * 0.28), fill: 0x1d1d1f, fontWeight: "700" } });
    t.anchor.set(0.5);
    t.y = -size * 0.1;
    c.addChild(t);
    return c;
  }
  const centre = (k: string) => {
    const n = nodes.current.get(k);
    return n ? { x: n.cx, y: n.cy } : { x: 0, y: 0 };
  };
  const typeOf = (unitId: string) => props.current.data.units.byId.get(unitId)?.type ?? "Bot";

  /** Fragments flying out from a point, in a unit's colour (shared by Attack and destroyed). */
  function fragments(colour: number): { b: Graphics; a: number; r: number; spin: number }[] {
    const size = geo.current.size;
    return Array.from({ length: 12 }, (_, i) => {
      const b = new Graphics().poly([0, -size * 0.16, size * 0.12, size * 0.1, -size * 0.12, size * 0.1]).fill({ color: i % 3 === 0 ? 0xfff1c4 : colour });
      return { b, a: (i / 12) * Math.PI * 2 + (i % 2) * 0.3, r: 0.7 + ((i * 37) % 10) / 20, spin: (i % 2 ? 1 : -1) * (2 + (i % 3)) };
    });
  }

  /** A Mecha Attack: it charges at the target and bursts there (dropped by hand: it bursts where it was dropped). */
  function burstStep(from: string, to: string, unitId: string, type: string, fromDrop: boolean, stays: boolean): Step {
    const fx = layers.current!.fx;
    const g = ghost(type, unitId);
    const bits = stays ? [] : fragments(TYPE_COLOUR[type] ?? 0xcccccc);
    return {
      ms: fromDrop ? 520 : 760,
      hides: stays ? [] : [from],
      start: () => {
        fx.addChild(g);
        for (const x of bits) fx.addChild(x.b);
      },
      frame: (p, look) => {
        const a = centre(from);
        const b = centre(to);
        const charge = fromDrop ? 1 : easeInOut(Math.min(1, p / 0.45));
        const burst = fromDrop ? Math.min(1, p / 0.9) : Math.max(0, (p - 0.45) / 0.55);
        const reach = fromDrop ? 1 : 0.62;
        const x = a.x + (b.x - a.x) * charge * reach;
        const y = a.y + (b.y - a.y) * charge * reach;
        g.position.set(x, y);
        g.scale.set(1 + 0.08 * Math.sin(Math.PI * Math.min(1, p / 0.45)) - (stays ? 0 : 0.45 * burst));
        g.alpha = stays ? 1 - burst * 0.6 : 1 - burst;
        for (const f of bits) {
          const d = geo.current.size * f.r * easeOut(burst);
          f.b.position.set(x + Math.cos(f.a) * d, y + Math.sin(f.a) * d);
          f.b.rotation = f.spin * burst;
          f.b.alpha = burst === 0 ? 0 : 1 - burst;
        }
        if (!stays) look(from).alpha = easeOut(burst);
        else look(from).alpha = 0;
      },
      end: () => {
        g.destroy({ children: true });
        for (const f of bits) f.b.destroy();
      },
    };
  }

  /** Heat paid back to the Supply: a Heat chip floats up from the Heat counter (H7: slowly, with a word why). */
  function heatStep(amount: number, rule: string): Step {
    let chip: HTMLDivElement | undefined;
    let a = { x: 0, y: 0 };
    return {
      ms: rule === "H7" ? 1600 : 700,
      start: () => {
        const el = document.querySelector<HTMLElement>("[data-heat]")?.getBoundingClientRect();
        const r = host.current?.getBoundingClientRect();
        a = el ? { x: el.left + el.width / 2, y: el.top + el.height / 2 } : { x: (r?.left ?? 0) + (r?.width ?? 0) / 2, y: (r?.top ?? 0) + 40 };
        chip = document.createElement("div");
        chip.className = "heat-fly";
        chip.textContent = rule === "H7" ? `−${amount} Heat: Meltdown avoided (H7)` : `−${amount} Heat (${rule})`;
        document.body.appendChild(chip);
      },
      frame: (p) => {
        if (!chip) return;
        chip.style.transform = `translate(calc(${a.x}px - 50%), ${a.y - 14 - 70 * easeOut(p)}px) scale(${1 + 0.1 * Math.sin(Math.PI * Math.min(1, p * 3))})`;
        chip.style.opacity = String(p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1);
      },
      end: () => chip?.remove(),
    };
  }

  /** H7 Meltdown happens: a card over the Field says why and what follows. */
  function meltdownStep(bots: number): Step {
    let card: HTMLDivElement | undefined;
    return {
      ms: 3200,
      start: () => {
        card = document.createElement("div");
        card.className = "meltdown-card";
        card.innerHTML = `<b>Meltdown</b><span>No Heat token left to prevent it (H7).</span><span>1 damage to every Bot (${bots}), then you gain ${bots} Heat and your Flagship takes ${bots + 1} damage.</span>`;
        host.current?.appendChild(card);
      },
      frame: (p) => {
        if (!card) return;
        card.style.opacity = String(p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1);
        card.style.transform = `translate(-50%, -50%) scale(${0.92 + 0.08 * easeOut(Math.min(1, p * 5))})`;
      },
      end: () => card?.remove(),
    };
  }

  function stepsFor(events: GameEvent[], s: GameState): Step[] {
    const fx = layers.current!.fx;
    const size = () => geo.current.size;
    const isTop = (k: string, id: TileId) => topTileId(s, k) === id && sectorState(s, k) === "occupied";
    const out: Step[] = [];
    /** Mecha whose destruction was already shown with their Attack (designer 2026-11-08: Mecha first, then the hit). */
    const attacked = new Set<TileId>();
    /** The Bay, Order or Module whose effect is playing (its hits, moves and looks start from it). */
    let src: Source | undefined;
    // Used in an earlier answer (a Bay asks for its target after it is used): the last "used" before these events.
    {
      const first = events[0]?.seq ?? Infinity;
      const prev = [...(s.events ?? [])].reverse().find((x) => x.seq < first && x.kind === "used");
      if (prev && prev.kind === "used") src = { what: prev.what, rule: prev.rule, bay: prev.bay, module: prev.module, colour: prev.colour };
    }
    const onPage = (k: string) => () => {
      const r = host.current?.getBoundingClientRect();
      if (!r || !nodes.current.has(k)) return undefined;
      const c0 = centre(k);
      return { x: r.left + c0.x, y: r.top + c0.y, size: size() };
    };
    const from = (rule: string | undefined) => (src && rule === src.rule ? src : undefined);
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (e.kind === "used") {
        const used: Source = { what: e.what, rule: e.rule, bay: e.bay, module: e.module, colour: e.colour };
        src = used;
        // The Bay, Order or Module glows as it fires.
        out.push({ ms: 160, start: () => fireGlow(used), frame: () => {}, end: () => {} });
        continue;
      }
      // Weapon and aura looks (build step 3): the shot, the tractor beam or the scan comes first.
      if (e.kind === "hit" && from(e.rule)) out.push(weaponStep(src!, "hit", onPage(e.sector)));
      if ((e.kind === "moved" || e.kind === "swapped") && from(e.rule)) out.push(weaponStep(src!, "move", onPage(e.from)));
      if (e.kind === "looked" && from(e.rule)) {
        const k = e.tiles.find((t) => t.sector)?.sector;
        if (k) out.push(weaponStep(src!, "look", onPage(k)));
      }
      if (e.kind === "destroyed" && attacked.has(e.tile) && !e.wreck) continue;
      // A walk (M_01 moving several times in a row, designer 2026-11-08): one step along its path.
      if (e.kind === "moved" && e.how === "move") {
        const path = [e.from, e.to];
        let j = i + 1;
        for (; j < events.length; j++) {
          const n = events[j]!;
          if (n.kind !== "moved" || n.tile !== e.tile || n.how !== "move" || n.from !== path[path.length - 1]) break;
          path.push(n.to);
        }
        if (path.length > 2) {
          i = j - 1;
          const last = path[path.length - 1]!;
          const real = isTop(last, e.tile);
          const g = real ? undefined : ghost(typeOf(e.unitId), e.unitId);
          const legs = path.length - 1;
          out.push({
            ms: 330 * legs,
            hides: real ? [last] : [],
            start: () => g && fx.addChild(g),
            frame: (p, look) => {
              const at = Math.min(legs - 1e-6, p * legs);
              const leg = Math.floor(at);
              const q = easeInOut(at - leg);
              const a2 = centre(path[leg]!);
              const b2 = centre(path[leg + 1]!);
              const end = centre(last);
              const x = a2.x + (b2.x - a2.x) * q;
              const y = a2.y + (b2.y - a2.y) * q;
              const lift = 1 + 0.08 * Math.sin(Math.PI * q);
              if (g) {
                g.position.set(x, y);
                g.scale.set(lift);
              } else {
                const L = look(last);
                L.dx = x - end.x;
                L.dy = y - end.y;
                L.scale = lift;
              }
            },
            end: () => g?.destroy({ children: true }),
          });
          continue;
        }
      }
      if (e.kind === "attack") {
        const now = sectorOf(s, e.tile);
        const stays = now !== undefined && isTop(now, e.tile); // a Mecha that becomes a Wreck stays
        if (!stays) attacked.add(e.tile);
        const dr = dropped.current;
        const fromDrop = dr !== undefined && dr.tile === e.tile && dr.to === e.to;
        if (fromDrop) dropped.current = undefined;
        out.push(burstStep(e.from, e.to, e.unitId, "Mecha", fromDrop, stays));
        continue;
      }
      if (e.kind === "heat") {
        out.push(heatStep(e.amount, e.rule));
        continue;
      }
      if (e.kind === "meltdown") {
        out.push(meltdownStep(e.bots));
        continue;
      }
      if (e.kind === "moved") {
        const real = isTop(e.to, e.tile);
        const dr = dropped.current;
        if (dr && dr.tile === e.tile && dr.to === e.to) {
          // Dropped there by hand: just a small settle.
          dropped.current = undefined;
          out.push({ ms: 180, frame: (p, look) => real && (look(e.to).scale = 1 + 0.06 * Math.sin(Math.PI * p)), end: () => {} });
          continue;
        }
        const g = real ? undefined : ghost(typeOf(e.unitId), e.unitId);
        const a = centre(e.from);
        const b = centre(e.to);
        const sectors = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (Math.sqrt(3) * size())));
        const tele = e.how === "teleport";
        out.push({
          ms: tele ? 400 : 350 * sectors,
          hides: real ? [e.to] : [],
          start: () => g && fx.addChild(g),
          frame: (p, look) => {
            const q = easeInOut(p);
            const a2 = centre(e.from);
            const b2 = centre(e.to);
            const x = tele ? b2.x : a2.x + (b2.x - a2.x) * q;
            const y = tele ? b2.y : a2.y + (b2.y - a2.y) * q;
            const lift = tele ? 0.85 + 0.15 * q : 1 + 0.08 * Math.sin(Math.PI * p);
            if (g) {
              g.position.set(x, y);
              g.scale.set(lift);
              g.alpha = tele ? q : 1;
            } else {
              const L = look(e.to);
              L.dx = x - b2.x;
              L.dy = y - b2.y;
              L.scale = lift;
              L.alpha = tele ? q : 1;
            }
          },
          end: () => g?.destroy({ children: true }),
        });
      } else if (e.kind === "swapped") {
        out.push({
          ms: 500,
          hides: [e.from, e.to],
          frame: (p, look) => {
            const q = easeInOut(p);
            const a = centre(e.from);
            const b = centre(e.to);
            const arc = Math.sin(Math.PI * p) * size() * 0.35;
            // a is now in `to`: it travels from `from`, over; b travels back, under.
            const La = look(e.to);
            La.dx = (a.x - b.x) * (1 - q);
            La.dy = (a.y - b.y) * (1 - q) - arc;
            La.scale = 1 + 0.08 * Math.sin(Math.PI * p);
            const Lb = look(e.from);
            Lb.dx = (b.x - a.x) * (1 - q);
            Lb.dy = (b.y - a.y) * (1 - q) + arc;
            Lb.scale = 1 - 0.06 * Math.sin(Math.PI * p);
          },
          end: () => {},
        });
      } else if (e.kind === "revealed") {
        const real = isTop(e.sector, e.tile);
        const back = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: props.current.dark ? 0x3c4f66 : 0x5b7391 });
        const g = real ? undefined : ghost(e.type, e.unitId);
        const flash = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: 0xffffff });
        out.push({
          ms: 450,
          hides: [e.sector],
          start: () => {
            fx.addChild(back);
            if (g) fx.addChild(g);
            fx.addChild(flash);
          },
          frame: (p, look) => {
            const c = centre(e.sector);
            const lift = 1 + 0.07 * Math.sin(Math.PI * p);
            for (const x of [back, flash, g]) x?.position.set(c.x, c.y);
            back.visible = p < 0.5;
            back.scale.set(Math.max(0.001, 1 - 2 * p) * lift, lift);
            const sx = p < 0.5 ? 0 : 2 * p - 1;
            if (g) {
              g.visible = p >= 0.5;
              g.scale.set(Math.max(0.001, sx) * lift, lift);
            } else {
              const L = look(e.sector);
              L.alpha = p < 0.5 ? 0 : 1;
              L.scaleX = Math.max(0.001, sx);
              L.scale = lift;
            }
            flash.alpha = p > 0.8 ? (1 - p) * 2.5 : 0;
          },
          end: () => {
            back.destroy();
            flash.destroy();
            g?.destroy({ children: true });
          },
        });
      } else if (e.kind === "hit") {
        const real = isTop(e.sector, e.tile);
        const g = real ? undefined : ghost(e.type, e.unitId);
        const flash = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: 0xffffff });
        const label = e.stopped ? "Barrier" : `−${e.amount}`;
        const num = new Text({ text: label, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(14, size() * 0.42), fill: e.stopped ? 0x9fd3ff : 0xffffff, fontWeight: "800", stroke: { color: 0x9b1c1c, width: 4 } } });
        num.anchor.set(0.5);
        out.push({
          ms: 480,
          start: () => {
            if (g) fx.addChild(g);
            fx.addChild(flash, num);
          },
          frame: (p, look) => {
            const c = centre(e.sector);
            const shake = Math.sin(p * 46) * (1 - p) * size() * 0.07;
            if (g) g.position.set(c.x + shake, c.y);
            else look(e.sector).dx = shake;
            flash.position.set(c.x + shake, c.y);
            flash.alpha = (1 - p) ** 2 * 0.75;
            num.position.set(c.x, c.y - size() * (0.15 + 0.55 * easeOut(p)));
            num.alpha = 1 - p ** 3;
          },
          end: () => {
            flash.destroy();
            num.destroy();
            g?.destroy({ children: true });
          },
        });
      } else if (e.kind === "destroyed") {
        if (e.wreck) {
          const dim = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: 0x1d1d1f });
          const stamp = new Text({ text: "WRECK", style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(12, size() * 0.3), fill: 0xffffff, fontWeight: "900", stroke: { color: 0x9b1c1c, width: 4 } } });
          stamp.anchor.set(0.5);
          out.push({
            ms: 500,
            start: () => fx.addChild(dim, stamp),
            frame: (p) => {
              const c = centre(e.sector);
              dim.position.set(c.x, c.y);
              dim.alpha = Math.sin(Math.PI * p) * 0.55;
              stamp.position.set(c.x, c.y);
              stamp.scale.set(1.8 - 0.8 * easeOut(Math.min(1, p * 1.6)));
              stamp.alpha = Math.min(1, p * 2) * (1 - Math.max(0, p - 0.7) / 0.3);
            },
            end: () => {
              dim.destroy();
              stamp.destroy();
            },
          });
          continue;
        }
        const g = ghost(e.type, e.unitId);
        const colour = TYPE_COLOUR[e.type] ?? 0xcccccc;
        const bits = Array.from({ length: 10 }, (_, i) => {
          const b = new Graphics().poly([0, -size() * 0.16, size() * 0.12, size() * 0.1, -size() * 0.12, size() * 0.1]).fill({ color: i % 3 === 0 ? 0xfff1c4 : colour });
          return { b, a: (i / 10) * Math.PI * 2 + (i % 2) * 0.3, r: 0.7 + ((i * 37) % 10) / 20, spin: (i % 2 ? 1 : -1) * (2 + (i % 3)) };
        });
        out.push({
          ms: 700,
          hides: [e.sector],
          start: () => {
            fx.addChild(g);
            for (const x of bits) fx.addChild(x.b);
          },
          frame: (p, look) => {
            const c = centre(e.sector);
            const crack = Math.min(1, p / 0.25);
            const burst = Math.max(0, (p - 0.2) / 0.8);
            g.position.set(c.x + Math.sin(p * 60) * (1 - crack) * size() * 0.03, c.y);
            g.scale.set(1 + 0.05 * crack - 0.4 * burst);
            g.alpha = 1 - burst;
            for (const x of bits) {
              const d = size() * x.r * easeOut(burst);
              x.b.position.set(c.x + Math.cos(x.a) * d, c.y + Math.sin(x.a) * d);
              x.b.rotation = x.spin * burst;
              x.b.alpha = burst === 0 ? 0 : 1 - burst;
            }
            look(e.sector).alpha = easeOut(burst);
          },
          end: () => {
            g.destroy({ children: true });
            for (const x of bits) x.b.destroy();
          },
        });
      } else if (e.kind === "energy") {
        // An energy token flies in an arc to its Module (0.4 s); by itself (one Module only): half speed (I1).
        let dot: HTMLDivElement | undefined;
        let a = { x: 0, y: 0 };
        let b = { x: 0, y: 0 };
        out.push({
          ms: e.auto ? 800 : 400,
          start: () => {
            const r = host.current?.getBoundingClientRect();
            const k = e.from !== undefined ? sectorOf(s, e.from) : undefined;
            const c = k ? centre(k) : { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) };
            a = { x: (r?.left ?? 0) + c.x, y: (r?.top ?? 0) + c.y };
            const m = document.querySelector<HTMLElement>(`[data-module="${e.module}"]`)?.getBoundingClientRect();
            b = m ? { x: m.left + 18, y: m.top + m.height / 2 } : a;
            dot = document.createElement("div");
            dot.className = "energy-fly";
            dot.style.setProperty("--pop", ENERGY_CSS[e.colour] ?? "#888");
            document.body.appendChild(dot);
          },
          frame: (p) => {
            if (!dot) return;
            const q = easeInOut(p);
            const lift = Math.min(160, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
            const x = a.x + (b.x - a.x) * q;
            const y = a.y + (b.y - a.y) * q - Math.sin(Math.PI * q) * lift;
            dot.style.transform = `translate(${x - 9}px, ${y - 9}px) scale(${1 + 0.35 * Math.sin(Math.PI * p)})`;
          },
          end: () => {
            dot?.remove();
            const m = document.querySelector<HTMLElement>(`[data-module="${e.module}"]`);
            if (m) {
              m.classList.remove("energy-arrive");
              void m.offsetWidth;
              m.classList.add("energy-arrive");
              m.style.setProperty("--arrive", ENERGY_CSS[e.colour] ?? "#888");
              window.setTimeout(() => m.classList.remove("energy-arrive"), 650);
            }
          },
        });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Every frame: animations, drag and glows on top of the board as it now is.

  function drawGlow(g: Graphics, cx: number, cy: number, kind: DragKind | "ready", now: number, strong: boolean): void {
    const size = geo.current.size;
    if (kind === "ready") {
      const k = breath(now, 2600);
      g.poly(hexPoints(cx, cy, size * 0.86)).stroke({ width: 1.5, color: props.current.dark ? 0xffe2a0 : 0xffffff, alpha: (0.35 + 0.6 * k) * 0.9 });
      g.poly(hexPoints(cx, cy, size * 0.9)).stroke({ width: 1.5, color: READY, alpha: 0.35 + 0.6 * k });
      return;
    }
    if (kind === "move") {
      // Calm: a slow breath (1.2 s in, 1.2 s out), chevrons pointing in.
      const k = strong ? 1 : breath(now, 2400);
      g.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: MOVE, alpha: strong ? 0.38 : 0.08 + 0.14 * k });
      g.poly(hexPoints(cx, cy, size * 0.9)).stroke({ width: strong ? 2.5 : 1.5, color: MOVE, alpha: 0.55 + 0.45 * k });
      for (const ang of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6]) {
        const r = size * (0.62 - 0.05 * k);
        const x = cx + Math.cos(ang) * r;
        const y = cy - Math.sin(ang) * r;
        const ix = -Math.cos(ang);
        const iy = Math.sin(ang);
        const w = size * 0.09;
        g.moveTo(x - iy * w - ix * w * 0.6, y + ix * w - iy * w * 0.6)
          .lineTo(x, y)
          .lineTo(x + iy * w - ix * w * 0.6, y - ix * w - iy * w * 0.6)
          .stroke({ width: 2, color: MOVE, alpha: 0.5 + 0.5 * k });
      }
      return;
    }
    // Attack: faster pulse (0.6 s), four corner brackets of a target sight.
    const k = strong ? 1 : breath(now, 600);
    if (strong) g.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: ATTACK, alpha: 0.22 });
    g.poly(hexPoints(cx, cy, size * 0.9)).stroke({ width: strong ? 2.5 : 1.5, color: ATTACK, alpha: 0.5 + 0.5 * k });
    const h = size * 0.5 * (1 + 0.06 * k);
    const arm = size * 0.17;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const x = cx + sx * h;
      const y = cy + sy * h;
      g.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm).stroke({ width: 2.5, color: ATTACK, alpha: 0.6 + 0.4 * k });
    }
  }

  function frame(): void {
    const L = layers.current;
    if (!L || !ready.current) return;
    const now = performance.now();
    const looks = new Map<string, NodeLook>();
    const look = (k: string): NodeLook => {
      let v = looks.get(k);
      if (!v) looks.set(k, (v = { dx: 0, dy: 0, scale: 1, scaleX: 1, alpha: 1 }));
      return v;
    };
    for (const k of player.current.hidden()) look(k).alpha = 0;
    player.current.tick(now, look);
    const d = drag.current;
    const size = geo.current.size;
    if (d) {
      const targets = new Set(d.plan.targets.map((t) => t.sector));
      for (const k of nodes.current.keys()) {
        if (k === d.home) look(k).alpha *= 0.28;
        else if (!targets.has(k)) look(k).alpha *= 0.7;
      }
    }
    for (const [k, n] of nodes.current) {
      const v = looks.get(k);
      n.node.position.set(n.cx + (v?.dx ?? 0), n.cy + (v?.dy ?? 0));
      n.node.scale.set((v?.scale ?? 1) * (v?.scaleX ?? 1), v?.scale ?? 1);
      n.node.alpha = v?.alpha ?? 1;
    }
    host.current?.setAttribute("data-anim", player.current.busy ? "1" : "0");

    // Glows: the targets only show once the animations before them are done (spec "Timing").
    const g = L.glow;
    g.clear();
    const P = props.current;
    if (d) {
      for (const t of d.plan.targets) {
        const n = nodes.current.get(t.sector);
        if (n) drawGlow(g, n.cx, n.cy, t.kind, now, d.snap?.sector === t.sector);
      }
    } else if (!player.current.busy) {
      for (const [k, n] of nodes.current) {
        if (!n.node.label.startsWith("choice")) continue;
        drawGlow(g, n.cx, n.cy, P.tones?.[k] ?? "ready", now, false);
      }
    }
    // A selected Module's targets: a violet rim just outside the hex with marks running round it.
    if (!d && !player.current.busy)
      for (const k of P.affected ?? []) {
        const n = nodes.current.get(k);
        if (!n) continue;
        const r = size * 0.97;
        const pts = hexPoints(n.cx, n.cy, r);
        g.poly(pts).stroke({ width: 2, color: AFFECT, alpha: 0.85 });
        const t = (now / 1800) % 1;
        for (let i = 0; i < 6; i++) {
          // A short bright mark sliding along each side.
          const ax = pts[i * 2]!;
          const ay = pts[i * 2 + 1]!;
          const bx = pts[((i + 1) % 6) * 2]!;
          const by = pts[((i + 1) % 6) * 2 + 1]!;
          const p0 = t;
          const p1 = Math.min(1, t + 0.28);
          g.moveTo(ax + (bx - ax) * p0, ay + (by - ay) * p0)
            .lineTo(ax + (bx - ax) * p1, ay + (by - ay) * p1)
            .stroke({ width: 4, color: 0xffffff, alpha: 0.75 });
        }
        g.poly(hexPoints(n.cx, n.cy, size * 0.9)).fill({ color: AFFECT, alpha: 0.1 + 0.08 * breath(now, 1800) });
      }
    if (d) dragFrame(d, now, size);
  }

  function dragFrame(d: DragState, now: number, size: number): void {
    const L = layers.current!;
    const piece = L.piece;
    if (!piece) return;
    const anchor = centre(d.anchor);
    if (d.stage === "drag" || d.stage === "carry") {
      // The piece follows the pointer exactly; over a target (anywhere on its sector) it sits on its centre.
      const snap = d.stage === "drag" ? d.snap : undefined;
      const tx = snap ? centre(snap.sector).x : d.wantX;
      const ty = snap ? centre(snap.sector).y : d.wantY;
      const vx = tx - d.x;
      d.x += (tx - d.x) * (snap ? 0.6 : 1);
      d.y += (ty - d.y) * (snap ? 0.6 : 1);
      d.tilt += (Math.max(-0.1, Math.min(0.1, vx * 0.004)) - d.tilt) * 0.3;
    } else if (d.stage === "settle") {
      const p = Math.min(1, (now - d.t0) / 150);
      const c = centre(d.snap!.sector);
      d.x += (c.x - d.x) * 0.5;
      d.y += (c.y - d.y) * 0.5;
      d.tilt *= 0.5;
      if (p >= 1) {
        const send = d.send!;
        endDrag();
        props.current.onDrop?.(send);
        return;
      }
    } else {
      // Return: float back along the tether in 0.5 s, slowing as it arrives, then a small shake.
      const t = (now - d.t0) / 500;
      const home = centre(d.home);
      const q = easeOut(Math.min(1, t));
      d.x = d.fromX! + (home.x - d.fromX!) * q;
      d.y = d.fromY! + (home.y - d.fromY!) * q;
      d.tilt = t > 1 ? Math.sin((t - 1) * 40) * 0.08 * Math.max(0, 1 - (t - 1) / 0.3) : 0;
      if (t >= 1.3) return endDrag();
    }
    const lifting = Math.min(1, (now - d.t0) / 120);
    const scale = d.stage === "settle" ? 1.1 - 0.1 * Math.min(1, (now - d.t0) / 150) : d.stage === "return" ? 1.1 - 0.1 * easeOut(Math.min(1, (now - d.t0) / 500)) : 1 + 0.1 * (d.stage === "drag" ? lifting : 1);
    piece.position.set(d.x, d.y);
    piece.scale.set(scale);
    piece.rotation = d.tilt;
    const shadow = piece.getChildByLabel("shadow");
    if (shadow) shadow.alpha = d.stage === "settle" ? 0.4 : 1;
    const attack = d.snap?.kind === "attack" && d.stage !== "return";
    const crack = piece.getChildByLabel("crack");
    if (crack) crack.visible = attack;

    // The "−3" the target will take.
    if (attack && d.plan.hit !== undefined) {
      if (!L.hitText) {
        L.hitText = new Text({ text: `−${d.plan.hit}`, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(14, size * 0.4), fill: 0xffffff, fontWeight: "800", stroke: { color: 0x9b1c1c, width: 4 } } });
        L.hitText.anchor.set(0.5);
        L.drag.addChild(L.hitText);
      }
      const c = centre(d.snap!.sector);
      L.hitText.position.set(c.x + size * 0.55, c.y - size * 0.95);
      L.hitText.visible = true;
    } else if (L.hitText) L.hitText.visible = false;

    // The tether: a soft curved line from where it came from, sparks flowing along it.
    const t = L.tether;
    t.clear();
    if (d.stage === "settle" && d.snap?.kind === "move") return;
    const fade = d.stage === "return" ? 1 - Math.min(1, (now - d.t0) / 500) : d.stage === "settle" ? 0.5 : 1;
    const dx = d.x - anchor.x;
    const dy = d.y - anchor.y;
    const len = Math.hypot(dx, dy);
    t.poly(hexPoints(anchor.x, anchor.y, size * 0.9)).stroke({ width: 1.5, color: 0xffffff, alpha: 0.55 * fade });
    if (len < size * 0.3) return;
    const cx = anchor.x + dx / 2 + (-dy / len) * len * 0.12;
    const cy = anchor.y + dy / 2 + (dx / len) * len * 0.12 + len * 0.08;
    const colour = TYPE_COLOUR.Mecha!;
    t.moveTo(anchor.x, anchor.y).quadraticCurveTo(cx, cy, d.x, d.y).stroke({ width: 9, color: colour, alpha: 0.12 * fade });
    t.moveTo(anchor.x, anchor.y).quadraticCurveTo(cx, cy, d.x, d.y).stroke({ width: 2.5, color: colour, alpha: 0.75 * fade });
    t.moveTo(anchor.x, anchor.y).quadraticCurveTo(cx, cy, d.x, d.y).stroke({ width: 1, color: 0xffffff, alpha: 0.7 * fade });
    for (let i = 0; i < 6; i++) {
      const u = (now / 900 + i / 6) % 1;
      const x = (1 - u) ** 2 * anchor.x + 2 * (1 - u) * u * cx + u * u * d.x;
      const y = (1 - u) ** 2 * anchor.y + 2 * (1 - u) * u * cy + u * u * d.y;
      t.circle(x, y, 2.2).fill({ color: 0xfff4d6, alpha: 0.9 * fade * Math.sin(Math.PI * u) });
    }
  }

  // ---------------------------------------------------------------------------
  // The board as it now is.

  function draw(): void {
    const a = app.current;
    const L = layers.current;
    if (!a || !ready.current || !host.current || !L) return;
    const { data, state, choosable, selected, onPick, onHover, showHidden, dark, rotate } = props.current;
    const c: Ctx = { data, state };
    L.root.removeChildren().forEach((x) => x.destroy({ children: true }));
    nodes.current = new Map();
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
    geo.current.size = size;
    const ox = (w - (maxX - minX) * size) / 2 - minX * size;
    const oy = (h - (maxY - minY) * size) / 2 - minY * size;
    const ink = dark ? 0xe6e6e6 : 0x1d1d1f;
    const plate = dark ? 0x2b2d31 : 0xd6d3cc;
    const back = dark ? 0x3c4f66 : 0x5b7391;
    const slots = new Graphics();
    slots.eventMode = "none";
    L.root.addChild(slots);

    // Where the clickable sectors are, in CSS pixels of the Field (for the browser check and pop-ups).
    const hits: { k: string; id: string; x: number; y: number }[] = [];
    const rotHits: { dir: number; x: number; y: number }[] = [];
    for (const p of pos) {
      const cx = ox + p.x * size;
      const cy = oy + p.y * size;
      // An empty slot under every sector, seen while its tile is hidden by an animation.
      slots.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: dark ? 0x1f2125 : 0xe4e1da }).stroke({ width: 1, color: dark ? 0x111111 : 0xc9c4ba });
      const node = new Container();
      node.pivot.set(cx, cy);
      node.position.set(cx, cy);
      L.root.addChild(node);
      nodes.current.set(p.k, { node, cx, cy });
      const st = sectorState(state, p.k);
      const top = topTileId(state, p.k);
      const g = new Graphics();
      const unit = st === "occupied" ? top : undefined;
      const fill = st === "cleared" ? plate : st === "dark" ? back : TYPE_COLOUR[unitDef(c, top!).type] ?? 0xcccccc;
      const isChoice = choosable.sectors.includes(p.k) || (unit !== undefined && choosable.units.includes(unit));
      if (isChoice) hits.push({ k: p.k, id: choosable.sectors.includes(p.k) ? p.k : unit!, x: Math.round(cx), y: Math.round(cy) });
      const isSel = selected.includes(p.k) || (unit !== undefined && selected.includes(unit));
      node.label = isChoice && !isSel ? `choice:${p.k}` : `sector:${p.k}`;
      // Selected: a steady thin green rim.
      g.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: fill }).stroke({ width: isSel ? 2.5 : 1.5, color: isSel ? 0x00a37a : dark ? 0x111111 : 0x77736b });
      g.eventMode = "none";
      node.addChild(g);

      const label = (text: string, y: number, sz: number, color = 0x1d1d1f, bold = false) => {
        const t = new Text({ text, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(9, sz), fill: color, fontWeight: bold ? "700" : "400", align: "center" } });
        t.anchor.set(0.5);
        t.x = cx;
        t.y = cy + y;
        t.eventMode = "none";
        node.addChild(t);
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
        // Trial rule (I2): the energy waiting on a Flare, as tokens on its tile (build step 3).
        const waiting = t.energy ? (["Yellow", "Red", "Blue"] as const).flatMap((col) => Array.from({ length: t.energy![col] ?? 0 }, () => col)) : [];
        if (waiting.length) {
          const r = size * 0.1;
          const gap = r * 2.4;
          const y0 = cy + size * (b.length ? 0.37 : 0.27);
          const tok = new Graphics();
          waiting.forEach((col, i) => {
            const x0 = cx + (i - (waiting.length - 1) / 2) * gap;
            tok.circle(x0, y0, r).fill({ color: ENERGY_HEX[col] ?? 0x888888 }).stroke({ width: 1.5, color: 0xffffff });
          });
          tok.eventMode = "none";
          tok.label = "flare-energy";
          node.addChild(tok);
        }
        // Arrows on their sides, turned by the tile's facing (3.8).
        const turning = rotate?.tile === unit;
        const sides = arrowSides(unitDef(c, unit!).arrows, turning ? (rotate!.facing as typeof t.facing) : t.facing);
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
          node.addChild(arr);
        }
        if (turning) {
          // Two round buttons inside the hex: anticlockwise (left), clockwise (right).
          for (const [dir, dx, glyph] of [[-1, -0.47, "⟲"], [1, 0.47, "⟳"]] as const) {
            const bx = cx + dx * size;
            const by = cy + size * 0.29; // lower corners: arrows sit on the sides, never on corners
            const btn = new Graphics();
            btn.circle(bx, by, size * 0.15).fill({ color: 0xffffff }).stroke({ width: 2, color: READY });
            btn.eventMode = "none";
            node.addChild(btn);
            const tx = new Text({ text: glyph, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(12, size * 0.26), fill: 0x1d1d1f, fontWeight: "700" } });
            tx.anchor.set(0.5);
            tx.x = bx;
            tx.y = by;
            tx.eventMode = "none";
            node.addChild(tx);
            rotHits.push({ dir, x: Math.round(bx), y: Math.round(by) });
          }
        }
      }
    }
    host.current.dataset.choosable = JSON.stringify(hits);
    host.current.dataset.sectors = JSON.stringify(Object.fromEntries([...nodes.current].map(([k, n]) => [k, [Math.round(n.cx), Math.round(n.cy)]])));
    host.current.dataset.rotate = JSON.stringify(rotHits);
    // The height of a whole tile on screen (pointy-top hex: two radii), for placing pop-ups.
    host.current.dataset.tile = String(Math.round(2 * size));

    // New engine events since the board last shown play now, in order (none after Undo).
    const before = lastState.current;
    lastState.current = state;
    if (before && before !== state) {
      const ev = newEvents(before.events, state.events);
      if (ev.length) player.current.add(stepsFor(ev, state));
    }
    // Apply this frame's looks at once, so a hidden tile never flashes up before its animation.
    frame();
  }

  return <div ref={host} className="field" aria-label="The Field" onPointerDown={(e) => host.current && onDown(e.nativeEvent)} />;
}
