/**
 * System options > the mission celebrations, previewed on a made-up Mission 1 Field (designer
 * 2026-11-20): five Alphas already in the Trophy pile, the sixth on the Field. "kill": a Mecha's shell
 * destroys it (Alpha Down). "win": its Wreck resolves and the mission is won (Mission Complete). "both":
 * all in one answer, the kill going straight on into the win. The board is a picture for the preview
 * only (no game is played or touched); the pieces are the ones a game plays.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GameData } from "../../data/index.js";
import type { GameState } from "../../engine/state.js";
import { FieldView } from "../FieldView.js";
import { MissionBar } from "../Mission.js";
import { companyTheme } from "../outro/themes.js";
import { CelebrationSkip } from "./CelebrationSkip.js";
import { type WinShow, winShowOf } from "./detect.js";
import { MissionWin, type Shake } from "./MissionWin.js";
import { PREVIEW_SEED as SEED, previewBoards } from "./previewBoards.js";

export type PreviewKind = "kill" | "win" | "both";

export function CelebrationPreview({ data, company, kind, onClose }: { data: GameData; company: string; kind: PreviewKind; onClose: () => void }) {
  const boards = useMemo(() => previewBoards(data, company), [data, company]);
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
      const w = winShowOf(data, before, next, SEED);
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
  const piece = kind === "kill" ? "Alpha Down" : kind === "win" ? "Mission Complete" : "Alpha Down, then Mission Complete";
  return createPortal(
    <div className="cb-preview" data-celebration-preview={kind}>
      <div className="top-strip">
        <span className="cb-pv-label">Preview · {piece} · a made-up Mission 1</span>
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
          skipAll={skipAll}
          onCelebrate={setKillOn}
          shake={shake}
        />
      </div>
      {win && (
        <MissionWin
          show={win}
          theme={companyTheme(company)}
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
