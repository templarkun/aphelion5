/**
 * The short mission intro (designer 2026-11-16): after the last Mission Preparation screen and
 * before the Field appears. Stars rush past, the mission's name lands with a shock wave, its Field
 * draws itself sector by sector, the objective and the Threat come up, a bar fills ("deploying"),
 * then a ring of light opens on the Field. About 5 seconds at Normal speed; a tap skips to the end.
 * Words come from the Campaign data and the game; nothing here is a rule.
 */

import { useEffect, useRef, useState } from "react";
import type { GameData } from "../../data/index.js";
import type { GameState } from "../../engine/state.js";
import { loreOf } from "./CampaignSelect.js";
import { gateLeft } from "./Gate.js";
import { ms } from "./hud.js";
import { MissionMap } from "./MissionMap.js";
import { eventText, missionLabel, objectiveText } from "./missionText.js";
import { playLaunch, playTransition } from "./soundHooks.js";
import { briefStyle } from "./styles/index.js";
import { THREAT_NAMES } from "./types.js";

/** The intro at Normal speed, ms; the last OUT_MS of it is the ring opening on the Field. */
export const MISSION_INTRO_MS = 5200;
const OUT_MS = 800;

export function MissionIntro({ data, state, onDone }: { data: GameData; state: GameState; onDone: () => void }) {
  const total = ms(MISSION_INTRO_MS);
  const out = ms(OUT_MS);
  const [leaving, setLeaving] = useState(false);
  // It starts when the logo gate over it has opened (the last preparation screen closes with one).
  const [go, setGo] = useState(() => gateLeft() <= 0);
  const cv = useRef<HTMLCanvasElement>(null);
  const done = useRef(false);
  const camp = data.campaigns.find((c) => c.prefix === state.campaign);
  const m = camp?.missionById.get(state.mission);
  const acc = briefStyle().acc;

  function leave(): void {
    if (done.current || !go) return;
    done.current = true;
    playLaunch();
    setLeaving(true);
    setTimeout(onDone, out);
  }

  useEffect(() => {
    if (total <= 0 || !m) return void onDone();
    if (!go) {
      const t = setTimeout(() => setGo(true), gateLeft() + 30);
      return () => clearTimeout(t);
    }
    playTransition();
    const t = setTimeout(leave, total - out);
    return () => clearTimeout(t);
  }, [go]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stars rushing out from the middle: fast at first, slowing, then rushing again as the ring opens.
  useEffect(() => {
    const canvas = cv.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g || total <= 0) return;
    const stars = Array.from({ length: 260 }, () => ({
      a: Math.random() * Math.PI * 2,
      z: Math.random(),
      s: 0.4 + Math.random() * 1.4,
    }));
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      const t = (now - start) / total;
      const r = canvas.getBoundingClientRect();
      const k = Math.min(2, devicePixelRatio || 1);
      const w = Math.round(r.width * k);
      const h = Math.round(r.height * k);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const speed = done.current ? 2.6 : t < 0.12 ? 2.2 - t * 12 : 0.5;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "rgb(2 4 12 / 0.38)";
      g.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(cx, cy);
      g.lineCap = "round";
      for (const s of stars) {
        const z0 = s.z;
        s.z += dt * speed * (0.25 + s.z);
        if (s.z > 1.1) {
          s.z = 0.02 + Math.random() * 0.1;
          s.a = Math.random() * Math.PI * 2;
          continue;
        }
        const r0 = z0 * z0 * R;
        const r1 = s.z * s.z * R;
        const ca = Math.cos(s.a);
        const sa = Math.sin(s.a);
        g.strokeStyle = s.z > 0.6 ? `rgb(255 255 255 / ${Math.min(1, s.z)})` : `rgb(${acc} / ${0.3 + s.z})`;
        g.lineWidth = s.s * k * (0.4 + s.z);
        g.beginPath();
        g.moveTo(cx + ca * r0, cy + sa * r0);
        g.lineTo(cx + ca * r1 + ca, cy + sa * r1 + sa);
        g.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!m || total <= 0) return null;
  const lore = loreOf(state.campaign);
  const company = data.companies.byId.get(state.player.company)?.name ?? state.player.company;
  const cols = [...state.run.threat].sort();
  const ev = eventText(m);
  return (
    <div
      className={`mi ${leaving ? "mi-out" : ""}`}
      data-mission-intro={m.id}
      style={
        {
          "--mt": `${total}ms`,
          "--mo": `${out}ms`,
          "--acc": acc,
        } as React.CSSProperties
      }
      onPointerDown={leave}
      role="status"
      aria-live="polite"
      aria-label={`${missionLabel(m)}. Tap to skip.`}
    >
      <canvas ref={cv} className="mi-stars" aria-hidden="true" />
      <div className="mi-scan" aria-hidden="true" />
      {go && (
        <div className="mi-body">
          <div className="mi-top">
            {lore.title} · {lore.sector}
          </div>
          <div className="mi-name">
            <span className="mi-wave" aria-hidden="true" />
            {missionLabel(m).toUpperCase()}
          </div>
          <div className="mi-co">{company}</div>
          <MissionMap m={m} className="mi-map" fill={`rgb(${acc} / 0.2)`} stroke={`rgb(${acc} / 0.9)`} anim />
          <ul className="mi-lines">
            <li style={{ "--i": 0 } as React.CSSProperties}>
              <b>Objective</b> {camp ? objectiveText(camp, m) : ""}
            </li>
            {cols.length > 0 && (
              <li style={{ "--i": 1 } as React.CSSProperties}>
                <b>Threat</b> {THREAT_NAMES[cols.length]} · {cols.join(" + ")}
              </li>
            )}
            {ev !== "None" && (
              <li style={{ "--i": 2 } as React.CSSProperties}>
                <b>Event</b> {ev}
              </li>
            )}
          </ul>
          <div className="mi-deploy">
            <div className="mi-label">Deploying to the Field</div>
            <div className="mi-bar">
              <i />
            </div>
          </div>
        </div>
      )}
      {go && <div className="mi-skip">Tap to skip</div>}
      <div className="mi-ring" aria-hidden="true" />
    </div>
  );
}
