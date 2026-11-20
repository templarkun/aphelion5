/**
 * System options > the mission celebrations, previewed on a made-up Field (designer 2026-11-20;
 * previewBoards.ts): Mission 1 with five Alphas already in the Trophy pile and the sixth on the Field,
 * or Mission 3 with two Betas in it and the third on the Field. "kill": a Mecha's shell destroys it (the
 * kill piece chosen on the button). "win": the mission is won (Mission Complete; for Alpha, once its
 * Wreck resolves). "both": all in one answer, the kill going straight on into the win. The board is a
 * picture for the preview only (no game is played or touched); the pieces are the ones a game plays.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameData } from "../../data/index.js";
import type { GameState } from "../../engine/state.js";
import { FieldView } from "../FieldView.js";
import { MissionBar } from "../Mission.js";
import { CelebrationSkip } from "./CelebrationSkip.js";
import { type WinShow, winShowOf } from "./detect.js";
import { MissionWin, type Shake } from "./MissionWin.js";
import { PREVIEW_MISSION, PREVIEW_SEED as SEED, type PreviewWhat, previewBoards } from "./previewBoards.js";

export function CelebrationPreview({ data, company, what, onClose }: { data: GameData; company: string; what: PreviewWhat; onClose: () => void }) {
  const { kind, omega, piece: killPiece } = what;
  const boards = useMemo(() => previewBoards(data, company, omega), [data, company, omega]);
  const [state, setState] = useState<GameState | undefined>(boards ? (kind === "win" ? boards.kill : boards.start) : undefined);
  const [win, setWin] = useState<WinShow | undefined>();
  const [hold, setHold] = useState(0);
  const [killOn, setKillOn] = useState(false);
  const [skipAll, setSkipAll] = useState(0);
  const shakeRef = useRef<Shake | undefined>(undefined);
  const shake = useMemo<Shake>(() => (k, now) => shakeRef.current?.(k, now), []);
  const killed = useRef(false);
  const closing = useRef(false);
  const close = (after: number) => {
    if (closing.current) return;
    closing.current = true;
    window.setTimeout(onClose, after);
  };

  useEffect(() => {
    if (!boards) return void onClose();
    const t = window.setTimeout(() => {
      if (kind === "kill") return setState(boards.kill);
      const before = kind === "win" ? boards.kill : boards.start;
      const next = kind === "win" ? boards.won : boards.wonJoined;
      const w = winShowOf(data, before, next, SEED, killPiece);
      setState(next);
      setWin(w);
      setHold(w?.fresh ?? 0);
    }, 900);
    // Whatever happens, the preview never stays for good.
    const safety = window.setTimeout(() => close(0), 30000);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(safety);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The kill alone: back to System options a moment after it.
  useEffect(() => {
    if (killOn) killed.current = true;
    else if (killed.current && kind === "kill") close(900);
  }, [killOn]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!boards || !state || typeof document === "undefined") return null;
  return createPortal(
    <div className="cb-preview" data-celebration-preview={kind} data-omega={omega} data-piece={killPiece ?? ""}>
      <div className="top-strip">
        <span className="cb-pv-label">
          Preview · {what.label} · a made-up {PREVIEW_MISSION[omega].name}
        </span>
        <span className="cb-pv-right">
          <MissionBar c={{ data, state }} phase="Preview" hold={hold} />
          <button type="button" className="bf-btn" onClick={onClose}>
            Close
          </button>
        </span>
      </div>
      <div className="cb-pv-field">
        <FieldView
          data={data}
          state={state}
          choosable={{ sectors: [], units: [] }}
          selected={[]}
          onPick={() => {}}
          onHover={() => {}}
          showHidden={false}
          dark
          seed={SEED}
          killPiece={killPiece}
          skipAll={skipAll}
          onCelebrate={setKillOn}
          shake={shake}
        />
      </div>
      {win && (
        <MissionWin
          show={win}
          onHold={setHold}
          onShake={(f) => (shakeRef.current = f)}
          onDone={() => {
            setWin(undefined);
            close(500);
          }}
          killOn={killOn}
        />
      )}
      {(win || killOn) && (
        <CelebrationSkip
          dimAround={killOn}
          onSkip={() => {
            setSkipAll((n) => n + 1);
            setKillOn(false);
            setHold(0);
            setWin(undefined);
            close(300);
          }}
        />
      )}
    </div>,
    document.body,
  );
}
