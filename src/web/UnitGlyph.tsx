/**
 * A unit shown small (designer 2026-11-10): its three-layer glyph badge (glyphs.ts) in place of
 * its name (B_03); the name stays in the tooltip and for screen readers.
 */

import { Fragment } from "react";
import { glyphBadgeUrl, UNIT_ID } from "./glyphs.js";

export function UnitGlyph({ id, size }: { id: string; size?: number }) {
  const url = glyphBadgeUrl(id);
  if (!url) return <span className="unit-id">{id}</span>;
  return <img className="unit-glyph" src={url} alt={id} title={id} draggable={false} style={size ? { height: size } : undefined} />;
}

/** A text with every unit id in it shown as its glyph badge. */
export function UnitText({ text }: { text: string }) {
  const parts = text.split(UNIT_ID);
  if (parts.length === 1) return <>{text}</>;
  // split() with a capture group: odd entries are the ids.
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <UnitGlyph key={i} id={p} /> : p ? <Fragment key={i}>{tidy(p)}</Fragment> : null))}
    </>
  );
}

/** Commas between glyphs read as clutter: a thin space instead. */
function tidy(p: string): string {
  return /^,\s*$/.test(p) ? " " : p;
}
