/**
 * Sound volumes (designer 2026-11-22): three sliders, sound effects, ambient sound and music,
 * 0 to 100, kept in this browser (sound.ts). In the game's Menu and in System options.
 * Letting go of the effects slider plays a short tap at the new volume.
 */

import { useEffect, useState } from "react";
import { BUSES, onVolumes, setVolume, sfx, volumes } from "./sound.js";

export function SoundSettings(p: { className?: string }) {
  const [v, setV] = useState(volumes());
  useEffect(() => onVolumes(() => setV(volumes())), []);
  return (
    <div className={`sound-set ${p.className ?? ""}`} onClick={(e) => e.stopPropagation()} role="group" aria-label="Sound">
      <span className="ss-title">Sound</span>
      {BUSES.map((b) => (
        <label key={b.id} className="ss-row">
          <span className="ss-name">{b.label}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(v[b.id] * 100)}
            data-volume={b.id}
            aria-label={b.label}
            onChange={(e) => setVolume(b.id, Number(e.target.value) / 100)}
            onPointerUp={() => b.id === "sfx" && sfx("tap")}
          />
          <span className="ss-val">{Math.round(v[b.id] * 100)}</span>
        </label>
      ))}
    </div>
  );
}
