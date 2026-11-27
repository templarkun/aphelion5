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
numbers). Built so far: four kills for Alpha (I21; Rail Strike and Alpha Erased 2026-11-27), three for Beta (Barrage and Cryo Shatter 2026-11-27), three for Gamma (I26; Dimensional Shatter
2026-11-21); seven wins, Mission Complete, Perimeter Sweep, Sector Flip, Chain Surge, Beacon Spiral, Resonance and
Murmuration (the last four 2026-11-27), for every mission won (designer 2026-11-21: Eliminate Alpha, Beta, Gamma, and Salvage),
one picked at random each mission.
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
five Power Node badges and three Cleared sector badges (`WinShow.sub`, `badges`; every win shows them on the one standard banner, designer 2026-11-21).

| Piece | Kind | For | What it is |
| --- | --- | --- | --- |
| `alphaDown` | kill | Alpha | Alpha Down, about 4.5 s: the Field zooms in on the unit and the rest darkens, brackets lock on; violet light through tapered, branching fractures with motes leaking out (`cracksFx.ts` `fractureLight`), the glyph flares and collapses into a core, then bursts (shards, shock ring, sparks, a small shake); the Wreck smokes with a label "ALPHA DOWN · 5 / 6" turning to "6 / 6"; the zoom eases back. |
| `alphaPurge` | kill | Alpha | Alpha Purge (I21), about 4.5 s: six energy walls of a containment cage, each a swarm of particles streaming in from outside (I24), gather and lock round the unit with a flash of particles, close in with arcs of cold light and crush it to a point, their particles flung up the light; a pillar of light fires up out of the Field, a flat flare streaks sideways, motes rise; the Wreck forms again under a scan line; "ALPHA PURGED · 5 / 6" to "6 / 6"; the zoom eases back. |
| `alphaRail` | kill | Alpha | Rail Strike (2026-11-27, `railFx.ts`), about 4.5 s: a red sight line of particles from beyond the Field's edge, a reticle narrows and locks; seven accelerator coils (rings of particles) light along the line, far ones first; the slug crosses in bullet time (white-hot head, a cone of shocked air, a burning channel), each coil flaring as it passes; the strike: flash, a cone of debris (sparks and dark fragments) out of the far side, a shock ring, a hard shake along the shot; the hole cools white, orange, red; smoke drifts off; "ALPHA TERMINATED · 5 / 6" to "6 / 6". |
| `alphaErase` | kill | Alpha | Alpha Erased (2026-11-27, `eraseFx.ts`), about 4.6 s: corner brackets and a grid of points projected over the tile lock; a bar of light sweeps it left to right and behind it the unit becomes a lattice of particles with a see-through ghost of its glyph (the tile fades as the bar passes); the lattice trembles, then unravels from the left, each particle pulled away on a curling wind; the Wreck shows again under a fading afterimage; "ALPHA ERASED · 5 / 6" to "6 / 6". |
| `betaBreach` | kill | Beta | Beta Breach, about 6.2 s (bigger than Alpha's): a wider zoom (the sectors round it in view), a turning reticle locks; three surges with arcs lashing at the sectors round it and harder shakes, molten streams of particles oozing out of a churning pool, creeping and swaying as they grow, spitting embers (`cracksFx.ts` `moltenFlow`), three small blasts, the core sucks the light in; white-out, fireball, two shock fronts off the screen, shards (some at the camera), the units round it knocked back, a heavy shake, embers; the sector left scorched; a bigger label "BETA DOWN · 2 / 3" to "3 / 3"; the zoom eases back. |
| `betaBarrage` | kill | Beta | Barrage (2026-11-27, `barrageFx.ts`), about 6.8 s: a kill box of particles drawn round the Beta and the six sectors round it, pins drop, lock; eight shells fall from above the page and walk in on it in a tightening spiral (`shellSpot`), each a streak, flash, particle ring, sparks and embers, the nearest unit jolted; its hex shield of particles flares at each hit, cracks and breaks into flying cells; a target ring shrinks onto it; a lance of light falls from orbit: white-out, fireball, a ring of fire over the kill box, debris thrown up at the camera, a shock front off the screen, the units knocked back, a heavy shake; a crater with radial scorch and a rim cooling white to red, smoke (no Wreck); "BETA DESTROYED · 2 / 3" to "3 / 3". |
| `betaCryo` | kill | Beta | Cryo Shatter (2026-11-27, `cryoFx.ts`), about 6.6 s: six cryo emitters gather out of particles at the corners round the Beta and lock, cold beams of particles; frost lines grow over the tile from its edges (`FROST_LINES`), it turns to ice and struggles, slower and slower (`struggle`), frost creeps along the sectors round it, mist rolls off; frozen, two cracks of light; it shatters: a cold flash, 70 ice shards tumbling (some at the camera), a spray of ice particles, a frost wave off the screen leaving frost rims on the sectors round it, the units knocked back, mist billowing out, a heavy shake; ice dust drifts down over the frosted sector (no Wreck); "BETA SHATTERED · 2 / 3" to "3 / 3". |
| `gammaHorizon` | kill | Gamma | Event Horizon (I26), about 8 s: the camera tilts the whole Field into 3D (`tilt.ts`), hexagonal brackets lock on; the Gamma collapses into a black sphere with a whirling disc of particles (its far side bent over the top), the board's space sags into a well; the two rings of sectors round it lift off, turn to the camera and are pulled in, light torn off them spiralling into the disc; it snaps to a point, a frozen moment, a jet of light fires up and a flat ring of light races over the board, flipping every sector like a card; the lifted sectors drop back one by one with dust; a fading crater over what lay beneath; "GAMMA DOWN · 1 / 2" to "2 / 2"; the board turns flat as the zoom eases back. |
| `gammaArray` | kill | Gamma | Field Array (I26), about 8.2 s: the whole Field is the weapon: every sector's edge lights from the Field's edge inwards, ring by ring, then beams of particles leap ring to ring and tighten on the Gamma; its dome of shield cells (particles) cracks and breaks; the camera turns to a side view (`tilt.ts`), the beams lift the Gamma out as a column with its tile on top, four blades cut it into slices that slide apart; back to the view from above as they fall into the sector, which caves in to stars, then shows what lay beneath; the lattice crumbles into sparks. |
| `gammaShatter` | kill | Gamma | Dimensional Shatter (2026-11-21), 8.0 s in four acts: (1, 0-2.2) the killing blow held still for 0.2 s, then the zoom, the board tilts (54°) under a growing tremor (`shakeOffset`); the tile darkens, crimson fractures with white-hot cores spread to its six edges with rays leaking up, motes and chips of the sectors round it are pulled into a tiny singularity, every sector's edge glows threat crimson; (2, 2.2-4.8) the tile bursts into 28-36 Voronoi shards (`breakage`: the fractures were their edges), solids tumbling in perspective with glowing broken faces, rim light and dying circuitry, hanging in bullet time (`timeDilation`, `shardTime`: the shards' clock in closed form) with sparks and the burst's ring frozen, arcs of plasma between them, a rift into dark space pulsing under them; the core implodes; (3, 4.8-6.6) time snaps back: white-gold flash, the shards blasted away and burnt up, a white-cyan ring of particles and a split-colour distortion wave cross the whole Field (lifting the sectors), each sector's edge flaring and turning crimson to cyan as the first reaches it; (4, 6.6-8.0) a smouldering crater, rising embers, telemetry "TARGET NEUTRALIZED // SECTOR CLEAR", the board flat again. Reduced motion / Instant: its own 2 s still (`stillTotal`): a flash of the core and the hexes lit ring by ring. A slow machine draws fewer particles (each has a rank) and 28 shards, never slower. |
| `missionComplete` | win | every mission | Mission Complete, about 5 s: the Field dims, the Mission bar's cells flare one after another and the last bursts (the bar turns gold); an energy sweep (I23, I24: a crackling front made of particles, filaments, an ionised wake with ripples, a spray of particles) crosses the whole Field from beyond one edge to beyond the other, away from the sector the unit left; energy traces each sector's edge, throwing off sparks; the units shiver; "MISSION COMPLETE" slams in with "ALPHA ELIMINATED · 6 / 6" (I20, to try; "BETA ELIMINATED · 3 / 3") and a badge per unit dropping in; sparks drift, it fades. |
| `perimeterSweep` | win | every mission | Perimeter Sweep (2026-11-21, `sweepFx.ts`), 5.0 s: the Field dims about 35%; the Mission bar's cells charge and ignite left to right, the last bursts in a starburst with spark trails; a crisp ring of energy (white core, cyan body, particles riding it) sweeps out from the sector the unit left right off the Field, each sector's edge flashing then staying "secured" (thin line, gold corner ticks), the units recoiling a little; the standard banner (as Mission Complete's, designer 2026-11-21) at 2.2 s; embers rise as it fades. |
| `sectorFlip` | win | every mission | Sector Flip (2026-11-21, `flipFx.ts`), 5.2 s: the Field dims, the cells light and the last locks with a ring; column by column every sector (a heavy plate) lifts, turns a full 360° showing its bevelled edge and its underside (machined metal, circuit traces, chevrons), flashes its rim and slams down (shock ring, dust and sparks, a 1-2 px jolt of the board); the units ride on their tiles; Cleared sectors only light; the standard banner (as Mission Complete's, designer 2026-11-21) at 3.1 s; motes drift as it fades. |
| `chainSurge` | win | every mission | Chain Surge (2026-11-27, `chainSurgeFx.ts`), 5.4 s: the Field dims; an arc of lightning runs cell to cell along the Mission bar and the last cell drops a bolt into the sector the unit left (the middle after the Developer tool); the surge leaps sector to sector along the Field's own neighbours (`surgeTree`, breadth first; a sector cut off is struck from the nearest lit one), each leap a jagged bolt (white core, cyan body, forks, particles riding it) redrawn every 50 ms from a seed; each sector struck flashes, its charge runs to its six corners as particles, it throws sparks and its tile jumps; every leap settles into a faint live link; light packets (comets of particles) run home along every link, the deepest first; a bolt climbs back to the Mission bar, which turns gold with a crown of sparks; the standard banner at 3.45 s; the network crumbles into motes that rise. |
| `beaconSpiral` | win | every mission | Beacon Spiral (2026-11-27, `beaconFx.ts`), 5.6 s: the Field dims; brackets close on the Mission bar's cells and lock them; a targeting marker opens on every sector, the edge of the Field first; beams of falling particles come down from above the page, one per sector, in a spiral from the edge to the middle (`spiralOrder`, evenly 1.0-2.8 s): each strike flashes the sector, sends a hex shock ring of particles out, presses the tile down and it bounces back, lifts motes; the beam narrows and burns out and the sector stays lit with a gold rim; then every sector's light swirls into the middle sector, a pillar of light fires up off the top of the page with a ground ring (the bar turns gold, every tile lifts a little); the standard banner at 3.5 s; the pillar thins, motes rise. |
| `resonance` | win | every mission | Resonance (2026-11-27, `resonanceFx.ts`), 5.8 s: the Field dims, the Mission bar's cells charge; a drop of light falls from the last cell into the sector the unit left, a crown splashes; the Field becomes a surface: rings of particles (white-ice crests, violet troughs) spread from it, echo off the board's edges and cross a second drop that falls from above the page into the farthest sector, every tile riding the crests and troughs (`ripplesOf`, `rippleAt`); the surface calms, then the whole Field rings as one in four louder beats (`ringAt`), a ring of particles round every sector each beat; at the lock a flash, gold corners and a lattice of particles joining every pair of neighbours with a light pulse running along it (the bar turns gold); the standard banner at 3.8 s; motes rise, everything fades. |
| `murmuration` | win | every mission | Murmuration (2026-11-27, `murmurationFx.ts`), 6.0 s: the Field dims; 460 drones leave the Mission bar's cells and gather above the sector the unit left; the swarm flies one curved way through every sector (nearest next, `flightOf`, a Catmull-Rom path, `headAt`), breathing and folding like a flock of starlings; each sector it passes is claimed: a tracer of particles runs round its edge, gold corners, a flash, its tile pushed along by the swarm's wind (`murmurLook`); then the drones form the emblem (two turning hexagons and six spokes) round the banner, which slams in at 3.8 s as it flares (the bar turns gold); at 4.6 s the emblem bursts outwards in streaks, everything fades. |

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
railFx.ts              Rail Strike (PixiJS)
eraseFx.ts             Alpha Erased (PixiJS)
breachFx.ts            Beta Breach (PixiJS)
barrageFx.ts           Barrage (PixiJS)
cryoFx.ts              Cryo Shatter (PixiJS)
tilt.ts                the board seen in 3D: tilt, perspective, lifted sectors (the Gamma kills)
horizonFx.ts           Event Horizon (PixiJS)
arrayFx.ts             Field Array (PixiJS)
shatterFx.ts           Dimensional Shatter (PixiJS): the breakage, bullet time's shards, the rift, the shock wave
MissionWin.tsx         the wins: canvas over the page, the banner and badges (React); Mission Complete's painter
winKit.ts              what the wins share: where the Field and the Mission bar are, particles, how well the machine keeps up
shine.ts               Mission Complete's energy sweep: where its front lies at each moment
sweepFx.ts             Perimeter Sweep: the cells, the ring, the secured borders, the embers
flipFx.ts              Sector Flip: the wave, each plate's lift, turn and slam, its edge and underside, the jolt
chainSurgeFx.ts        Chain Surge: the surge's way through the Field, the lightning, the struck sectors, packets, crumbling
beaconFx.ts            Beacon Spiral: the spiral order, markers, beams, shock rings, the gather and the pillar
resonanceFx.ts         Resonance: the drops, ripples with echoes, the ring, the lattice
murmurationFx.ts       Murmuration: the swarm's way, the drones, claimed sectors, the emblem and its burst
CelebrationSkip.tsx    "Tap twice to skip", catches every tap while a piece plays
CelebrationPreview.tsx System options: the pieces on a made-up Field
previewBoards.ts       that Field (Mission 1 for Alpha, 3 for Beta, 7 for Gamma, 2 for Salvage) and the buttons (also used by the tests)
celebrate.css          their looks (prefix cb-)
```

Salvage milestones (designer 2026-11-22): `salvageFx.ts` holds Grid Online (the fifth Power Node taken)
and Sector Lock (the third Cleared sector, five Power Nodes taken), close-up Field steps like the kills,
found by `salvageMarkOf` (detect.ts) from the board before and after an answer (no event needed);
`SALVAGE_PIECES` in pieces.ts, times `NODES` / `CLEARED` in timeline.ts, played by `salvageStep` in FieldView.tsx.
