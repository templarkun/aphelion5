# Mission celebrations

What the player sees when a mission's objective is reached (designer 2026-11-20). Screen only: no
rule lives here. Two kinds of piece, built separately:

| Kind | When | Where |
| --- | --- | --- |
| The kill | the last required Omega unit is destroyed (an Alpha becomes a Wreck, Core Rules 4.8; a Beta goes straight to the Trophy pile): in Mission 1 the 6th of 8 Alphas, in Mission 3 the 3rd Beta. The number counted is the objective's own (8.2): units of its type in the Trophy pile plus those on the Field as Wrecks. | on the Field, centred on the unit (a step of the Field's animation player) |
| The win | the mission is won by 8.2 (the objective checked before a Command phase action). The engine reports it as a display event, `won` (`src/engine/events.ts`). | over the Field and the Mission bar, before the Upgrade sheet (or the next screen) |

When one answer does both, the kill plays first and the win goes on from it (the Trophy flies to the
Mission bar as the kill's camera pulls out). Two taps skip either, as the intro and the outros.

Several pieces are planned for each kind of mission: Eliminate (an Alpha; a Beta more spectacular; a
Gamma more still) and Salvage. Which one plays (I19): one at random each mission, the same one again
if the save is reloaded (`pickPiece`: the game's seed and the mission, never the game's own random
numbers). Built so far: two kills for Alpha (I21), one for Beta, three for Gamma (I26; Dimensional Shatter
2026-11-21); three wins, Mission Complete, Perimeter Sweep and Sector Flip, for every mission won
(designer 2026-11-21: Eliminate Alpha, Beta, Gamma, and Salvage), one picked at random each mission.
A lost or conceded game has none. Salvage missions have no kill.

Every piece looks the same whatever the Company's vessel, and the pick is the same for every Company
(I25): no Company colours here. Anything made of energy (walls, sweeps, sparks) is drawn with particle
effects, instead of or on top of plain shapes, in a tasteful amount (designer 2026-11-20, I24): on the
Field use `motes()` from `closeup.ts` (a pool of soft particle sprites); on a 2D canvas, soft dots
drawn with `drawImage` (`dot()` in `MissionWin.tsx`).

The numbers ("ALPHA DOWN · 5 / 6", "ALPHA ELIMINATED · 6 / 6", the badges) come from the mission's
objective in the Campaign file (`objectiveOf` in `detect.ts`): a mission needing 5 shows "4 / 5" to
"5 / 5" and five badges with nothing to build. A Salvage mission (8.2: 5 Power Nodes, 3 Cleared
sectors; `SALVAGE_NODES`, `SALVAGE_CLEARED` in the engine) shows "POWER NODES 5 / 5 · CLEARED 3 / 3",
five Power Node badges and three Cleared sector badges (`WinShow.sub`, `badges`, `kicker`).

| Piece | Kind | For | What it is |
| --- | --- | --- | --- |
| `alphaDown` | kill | Alpha | Alpha Down, about 4.5 s: the Field zooms in on the unit and the rest darkens, brackets lock on; violet light through tapered, branching fractures with motes leaking out (`cracksFx.ts` `fractureLight`), the glyph flares and collapses into a core, then bursts (shards, shock ring, sparks, a small shake); the Wreck smokes with a label "ALPHA DOWN · 5 / 6" turning to "6 / 6"; the zoom eases back. |
| `alphaPurge` | kill | Alpha | Alpha Purge (I21), about 4.5 s: six energy walls of a containment cage, each a swarm of particles streaming in from outside (I24), gather and lock round the unit with a flash of particles, close in with arcs of cold light and crush it to a point, their particles flung up the light; a pillar of light fires up out of the Field, a flat flare streaks sideways, motes rise; the Wreck forms again under a scan line; "ALPHA PURGED · 5 / 6" to "6 / 6"; the zoom eases back. |
| `betaBreach` | kill | Beta | Beta Breach, about 6.2 s (bigger than Alpha's): a wider zoom (the sectors round it in view), a turning reticle locks; three surges with arcs lashing at the sectors round it and harder shakes, molten streams of particles oozing out of a churning pool, creeping and swaying as they grow, spitting embers (`cracksFx.ts` `moltenFlow`), three small blasts, the core sucks the light in; white-out, fireball, two shock fronts off the screen, shards (some at the camera), the units round it knocked back, a heavy shake, embers; the sector left scorched; a bigger label "BETA DOWN · 2 / 3" to "3 / 3"; the zoom eases back. |
| `gammaHorizon` | kill | Gamma | Event Horizon (I26), about 8 s: the camera tilts the whole Field into 3D (`tilt.ts`), hexagonal brackets lock on; the Gamma collapses into a black sphere with a whirling disc of particles (its far side bent over the top), the board's space sags into a well; the two rings of sectors round it lift off, turn to the camera and are pulled in, light torn off them spiralling into the disc; it snaps to a point, a frozen moment, a jet of light fires up and a flat ring of light races over the board, flipping every sector like a card; the lifted sectors drop back one by one with dust; a fading crater over what lay beneath; "GAMMA DOWN · 1 / 2" to "2 / 2"; the board turns flat as the zoom eases back. |
| `gammaArray` | kill | Gamma | Field Array (I26), about 8.2 s: the whole Field is the weapon: every sector's edge lights from the Field's edge inwards, ring by ring, then beams of particles leap ring to ring and tighten on the Gamma; its dome of shield cells (particles) cracks and breaks; the camera turns to a side view (`tilt.ts`), the beams lift the Gamma out as a column with its tile on top, four blades cut it into slices that slide apart; back to the view from above as they fall into the sector, which caves in to stars, then shows what lay beneath; the lattice crumbles into sparks. |
| `gammaShatter` | kill | Gamma | Dimensional Shatter (2026-11-21), 8.0 s in four acts: (1, 0-2.2) the killing blow held still for 0.2 s, then the zoom, the board tilts (54°) under a growing tremor (`shakeOffset`); the tile darkens, crimson fractures with white-hot cores spread to its six edges with rays leaking up, motes and chips of the sectors round it are pulled into a tiny singularity, every sector's edge glows threat crimson; (2, 2.2-4.8) the tile bursts into 28-36 Voronoi shards (`breakage`: the fractures were their edges), solids tumbling in perspective with glowing broken faces, rim light and dying circuitry, hanging in bullet time (`timeDilation`, `shardTime`: the shards' clock in closed form) with sparks and the burst's ring frozen, arcs of plasma between them, a rift into dark space pulsing under them; the core implodes; (3, 4.8-6.6) time snaps back: white-gold flash, the shards blasted away and burnt up, a white-cyan ring of particles and a split-colour distortion wave cross the whole Field (lifting the sectors), each sector's edge flaring and turning crimson to cyan as the first reaches it; (4, 6.6-8.0) a smouldering crater, rising embers, telemetry "TARGET NEUTRALIZED // SECTOR CLEAR", the board flat again. Reduced motion / Instant: its own 2 s still (`stillTotal`): a flash of the core and the hexes lit ring by ring. A slow machine draws fewer particles (each has a rank) and 28 shards, never slower. |
| `missionComplete` | win | every mission | Mission Complete, about 5 s: the Field dims, the Mission bar's cells flare one after another and the last bursts (the bar turns gold); an energy sweep (I23, I24: a crackling front made of particles, filaments, an ionised wake with ripples, a spray of particles) crosses the whole Field from beyond one edge to beyond the other, away from the sector the unit left; energy traces each sector's edge, throwing off sparks; the units shiver; "MISSION COMPLETE" slams in with "ALPHA ELIMINATED · 6 / 6" (I20, to try; "BETA ELIMINATED · 3 / 3") and a badge per unit dropping in; sparks drift, it fades. |
| `perimeterSweep` | win | every mission | Perimeter Sweep (2026-11-21, `sweepFx.ts`), 5.0 s: the Field dims about 35%; the Mission bar's cells charge and ignite left to right, the last bursts in a starburst with spark trails; a crisp ring of energy (white core, cyan body, particles riding it) sweeps out from the sector the unit left right off the Field, each sector's edge flashing then staying "secured" (thin line, gold corner ticks), the units recoiling a little; MISSION COMPLETE slams in with a micro-bounce and a split-colour glint, the line types in behind a block caret, stamped-metal badges drop 0.1 s apart with a spark puff; embers rise as it fades. |
| `sectorFlip` | win | every mission | Sector Flip (2026-11-21, `flipFx.ts`), 5.2 s: the Field dims, the cells light and the last locks with a ring; column by column every sector (a heavy plate) lifts, turns a full 360° showing its bevelled edge and its underside (machined metal, circuit traces, chevrons), flashes its rim and slams down (shock ring, dust and sparks, a 1-2 px jolt of the board); the units ride on their tiles; Cleared sectors only light; a glass Debrief-style card: kicker ("OMEGA TARGETS CLEARED" / "SALVAGE SECURED"), MISSION COMPLETE, the line, the badges; motes drift as it fades. |

## How to add one

1. Add it to `KILL_PIECES` or `WIN_PIECES` in `pieces.ts` with what it is `for` ("Alpha", "Beta",
   "Gamma" or "Salvage").
2. A kill is a Field step (`anim.ts` `Step` with `twoTap` and a `still`). Build it with
   `closeupStep` (`closeup.ts`): the close-up gives the zoom, the darkness round the unit, the tile
   until it breaks and its Wreck after, the label and the still picture; the piece gives its times,
   the tile's look before it breaks, its shake and what it draws (see `killFx.ts`, `purgeFx.ts`,
   `breachFx.ts`). To see the board in 3D (tilted, sectors lifted, flipped), use `tiltBoard` from
   `tilt.ts` each frame (see `horizonFx.ts`, `arrayFx.ts`): it moves the board's own tiles through
   their looks and draws the empty slots in perspective (the flat ones are hidden meanwhile). A piece
   may also set where the unit sits on the screen (`focus`) and a still picture of its own length
   (`stillTotal`; the frame's `st` is the time in it: light may change in it, nothing may move). List it in `kills.ts` (`KILL_STEPS`) and its times in `timeline.ts` (`KILL_TIMES`:
   the win waits for its pull-out when both come in one answer).
3. A win is played by `MissionWin` (`MissionWin.tsx`, the same props for every win: it waits for the
   Field and the Trophies' flight, then plays `show.piece`): add its times (`PIECE_TIMES`), its
   painter on the canvas (see `sweepFx.ts`, `flipFx.ts`), how it moves the Field's tiles (`onShake`:
   shake, lift, squash top to bottom, hide, bring to front) and its banner styling. The Field's dim
   is drawn by the Field itself (its tiles darken a little): a layer laid over the page did not show
   over the Field in the browser check.
4. Times in seconds in `timeline.ts`; silent sound hooks in `briefing/soundHooks.ts`; a preview
   button in System options (`CELEBRATION_PREVIEWS` in `previewBoards.ts`; a new Omega type needs its
   made-up board there too); test scenarios in batch 13.

Every piece follows the speed setting; with reduced motion or the speed Instant it shows a still
picture for `STILL` seconds. Every moving thing is worked out from the time alone.

## Files

```
pieces.ts              the pieces and the pick (I19)
detect.ts              when the kill and the win play; the board as it was won
timeline.ts            when things happen (seconds)
closeup.ts             the close-up every kill shares (zoom, darkness, tile and Wreck, label, still; particle pool)
cracksFx.ts            the kills' cracks: Alpha's fractures of light, Beta's molten streams
kills.ts               the kill steps by id
killFx.ts              Alpha Down (PixiJS)
purgeFx.ts             Alpha Purge (PixiJS)
breachFx.ts            Beta Breach (PixiJS)
tilt.ts                the board seen in 3D: tilt, perspective, lifted sectors (the Gamma kills)
horizonFx.ts           Event Horizon (PixiJS)
arrayFx.ts             Field Array (PixiJS)
shatterFx.ts           Dimensional Shatter (PixiJS): the breakage, bullet time's shards, the rift, the shock wave
MissionWin.tsx         the wins: canvas over the page, the banner and badges (React); Mission Complete's painter
winKit.ts              what the wins share: where the Field and the Mission bar are, particles, how well the machine keeps up
shine.ts               Mission Complete's energy sweep: where its front lies at each moment
sweepFx.ts             Perimeter Sweep: the cells, the ring, the secured borders, the stamps, the embers
flipFx.ts              Sector Flip: the wave, each plate's lift, turn and slam, its edge and underside, the jolt
CelebrationSkip.tsx    "Tap twice to skip", catches every tap while a piece plays
CelebrationPreview.tsx System options: the pieces on a made-up Field
previewBoards.ts       that Field (Mission 1 for Alpha, 3 for Beta, 7 for Gamma, 2 for Salvage) and the buttons (also used by the tests)
celebrate.css          their looks (prefix cb-)
```
