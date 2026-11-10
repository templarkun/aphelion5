/**
 * Unit glyphs and energy glyphs: the designer's art (2026-11-10), in `art/glyphs/` and `art/energy/`.
 *
 * A unit's glyph badge is three layers (designer 2026-11-10):
 *   1. a solid hexagon in the unit type's colour, the size of Unit.png,
 *   2. Unit.png (the empty hexagon that stands for any unit),
 *   3. the unit's own glyph (B_03.png ...), centred, at the same scale as Unit.png (the designer's
 *      pictures are cropped; their sizes against Unit.png are kept, so a one-dot Bot stays small).
 * Energy Gyros share a glyph: G_01 for G_01-G_04, G_05 for G_05-G_06, G_07 for G_07-G_09.
 * A unit with no glyph yet shows layers 1 and 2 only.
 *
 * The badge is drawn once per unit onto a canvas; the Field uses it as a texture and the panels as
 * a picture. Screen only; nothing here touches the rules.
 */

type Colour = "Yellow" | "Red" | "Blue";

const unitFiles = import.meta.glob("../../art/glyphs/*.png", { eager: true, query: "?inline", import: "default" }) as Record<string, string>;
const energyFiles = import.meta.glob("../../art/energy/*.png", { eager: true, query: "?inline", import: "default" }) as Record<string, string>;

const byName = (files: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(files)) out[path.replace(/^.*\//, "").replace(/\.png$/, "")] = url;
  return out;
};
const UNIT_URL = byName(unitFiles);
const ENERGY_URL = byName(energyFiles);

/** The energy glyph picture for a colour (yellow.png, red.png, blue.png). */
export function energyGlyphUrl(colour: Colour): string | undefined {
  return ENERGY_URL[colour.toLowerCase()];
}

/** The energy glyph picture, loaded (for the Field). */
export function energyGlyphImage(colour: Colour): HTMLImageElement | undefined {
  const img = images.get(`energy:${colour.toLowerCase()}`);
  return img?.complete && img.naturalWidth ? img : undefined;
}

/** Colours of the unit types (the tiles on the Field and the glyph badges). */
export const TYPE_COLOUR: Record<string, number> = {
  Bot: 0xe8e6e1,
  Mecha: 0xf0913a,
  Gyro: 0x55b36b,
  Sleeper: 0x4f86d9,
  Sentinel: 0xd9534f,
  Flare: 0xf2c94c,
  Omega: 0x9b6bd6,
};
const TYPE_OF_LETTER: Record<string, string> = { B: "Bot", M: "Mecha", G: "Gyro", P: "Sleeper", S: "Sentinel", F: "Flare", O: "Omega" };

/** The glyph file a unit uses (Energy Gyros share three), if the designer has drawn it yet. */
export function glyphName(unitId: string): string | undefined {
  const m = /^G_0([1-9])$/.exec(unitId);
  const name = m ? (Number(m[1]) <= 4 ? "G_01" : Number(m[1]) <= 6 ? "G_05" : "G_07") : unitId;
  return UNIT_URL[name] ? name : undefined;
}

/** Width and height of a PNG from its data URL (the header holds them). */
function pngSize(url: string): [number, number] {
  const b64 = url.slice(url.indexOf(",") + 1, url.indexOf(",") + 1 + 32);
  const s = atob(b64);
  const n = (o: number) => ((s.charCodeAt(o) << 24) | (s.charCodeAt(o + 1) << 16) | (s.charCodeAt(o + 2) << 8) | s.charCodeAt(o + 3)) >>> 0;
  return [n(16), n(20)];
}

const images = new Map<string, HTMLImageElement>();
let ready: Promise<void> | undefined;
/** Loads every picture once (they are inside the page, so this is quick). */
export function loadGlyphs(): Promise<void> {
  return (ready ??= Promise.all(
    [...Object.entries(UNIT_URL), ...Object.entries(ENERGY_URL).map(([k, v]) => [`energy:${k}`, v] as const)].map(
      ([name, url]) =>
        new Promise<void>((done) => {
          const img = new Image();
          img.onload = img.onerror = () => done();
          img.src = url;
          images.set(name, img);
        }),
    ),
  ).then(() => undefined));
}

/** The badge's canvas size: Unit.png's own size, twice over for sharp edges. */
const K = 2;
const badges = new Map<string, HTMLCanvasElement>();
const badgeUrls = new Map<string, string>();

/** The three-layer badge of a unit as a canvas (undefined until the pictures are loaded). */
export function glyphBadge(unitId: string): HTMLCanvasElement | undefined {
  const have = badges.get(unitId);
  if (have) return have;
  const frame = images.get("Unit");
  if (!frame?.complete || !frame.naturalWidth) return undefined;
  const [fw, fh] = pngSize(UNIT_URL.Unit!);
  const c = document.createElement("canvas");
  c.width = fw * K;
  c.height = fh * K;
  const x = c.getContext("2d")!;
  x.scale(K, K);
  // 1. A solid hexagon (pointy top, like Unit.png) in the type's colour.
  const col = TYPE_COLOUR[TYPE_OF_LETTER[unitId[0] ?? ""] ?? ""] ?? 0xcccccc;
  x.fillStyle = `#${col.toString(16).padStart(6, "0")}`;
  x.beginPath();
  x.moveTo(fw / 2, 0);
  x.lineTo(fw, fh / 4);
  x.lineTo(fw, (fh * 3) / 4);
  x.lineTo(fw / 2, fh);
  x.lineTo(0, (fh * 3) / 4);
  x.lineTo(0, fh / 4);
  x.closePath();
  x.fill();
  // 2. Unit.png.
  x.drawImage(frame, 0, 0, fw, fh);
  // 3. The unit's glyph, centred, at Unit.png's scale.
  const name = glyphName(unitId);
  const img = name ? images.get(name) : undefined;
  if (name && img?.complete && img.naturalWidth) {
    const [gw, gh] = pngSize(UNIT_URL[name]!);
    x.drawImage(img, (fw - gw) / 2, (fh - gh) / 2, gw, gh);
  }
  badges.set(unitId, c);
  return c;
}

/** The badge as a picture for the panels. */
export function glyphBadgeUrl(unitId: string): string | undefined {
  const have = badgeUrls.get(unitId);
  if (have) return have;
  const c = glyphBadge(unitId);
  if (!c) return undefined;
  const url = c.toDataURL("image/png");
  badgeUrls.set(unitId, url);
  return url;
}

/** Unit.png's width / height. */
export const BADGE_ASPECT = 136 / 157;

/** Unit ids in a text (B_03, S_12 ...). */
export const UNIT_ID = /\b([BSFPGOM]_\d\d)\b/g;
