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
numbers). Built so far: two kills for Alpha (I21), one for Beta; Mission Complete for Alpha missions
and, until a win of their own, Beta missions (I22). Gamma and Salvage missions: nothing yet.

| Piece | Kind | For | What it is |
| --- | --- | --- | --- |
| `alphaDown` | kill | Alpha | Alpha Down, about 4.5 s: the Field zooms in on the unit and the rest darkens, brackets lock on; violet light through cracks, the glyph flares and collapses into a core, then bursts (shards, shock ring, sparks, a small shake); the Wreck smokes with a label "ALPHA DOWN · 5 / 6" turning to "6 / 6"; the zoom eases back. |
| `alphaPurge` | kill | Alpha | Alpha Purge (I21), about 4.5 s: six panels of a containment cage fly in and lock round the unit, close in with arcs of cold light and crush it to a point; a pillar of light fires up out of the Field, a flat flare streaks sideways, motes rise; the Wreck forms again under a scan line; "ALPHA PURGED · 5 / 6" to "6 / 6"; the zoom eases back. |
| `betaBreach` | kill | Beta | Beta Breach, about 6.2 s (bigger than Alpha's): a wider zoom (the sectors round it in view), a turning reticle locks; three surges with arcs lashing at the sectors round it and harder shakes, hot cracks, three small blasts, the core sucks the light in; white-out, fireball, two shock fronts off the screen, shards (some at the camera), the units round it knocked back, a heavy shake, embers; the sector left scorched; a bigger label "BETA DOWN · 2 / 3" to "3 / 3"; the zoom eases back. |
| `missionComplete` | win | Alpha, Beta | Mission Complete, about 5 s: the Field dims, the Mission bar's cells flare one after another and the last bursts (the bar turns gold); a shine (I23: a broad band of light in the Company's colour) sweeps right across the Field, away from the sector the unit left, lighting each sector's edge with a glint, the units shiver; "MISSION COMPLETE" slams in with "ALPHA ELIMINATED · 6 / 6" (I20, to try; "BETA ELIMINATED · 3 / 3") and a badge per unit dropping in; sparks drift, it fades. |

## How to add one

1. Add it to `KILL_PIECES` or `WIN_PIECES` in `pieces.ts` with what it is `for` ("Alpha", "Beta",
   "Gamma" or "Salvage").
2. A kill is a Field step (`anim.ts` `Step` with `twoTap` and a `still`). Build it with
   `closeupStep` (`closeup.ts`): the close-up gives the zoom, the darkness round the unit, the tile
   until it breaks and its Wreck after, the label and the still picture; the piece gives its times,
   the tile's look before it breaks, its shake and what it draws (see `killFx.ts`, `purgeFx.ts`,
   `breachFx.ts`). List it in `kills.ts` (`KILL_STEPS`) and its times in `timeline.ts` (`KILL_TIMES`:
   the win waits for its pull-out when both come in one answer).
3. A win is a React component taking `MissionWinProps` (`MissionWin.tsx`); pick it by id where the
   game screen (`App.tsx`) and the preview mount `MissionWin`.
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
closeup.ts             the close-up every kill shares (zoom, darkness, tile and Wreck, label, still)
kills.ts               the kill steps by id
killFx.ts              Alpha Down (PixiJS)
purgeFx.ts             Alpha Purge (PixiJS)
breachFx.ts            Beta Breach (PixiJS)
MissionWin.tsx         Mission Complete: canvas over the page, the banner and badges (React)
shine.ts               Mission Complete's shine: where its band lies at each moment
CelebrationSkip.tsx    "Tap twice to skip", catches every tap while a piece plays
CelebrationPreview.tsx System options: the pieces on a made-up Field
previewBoards.ts       that Field (Mission 1 for Alpha, Mission 3 for Beta) and the buttons (also used by the tests)
celebrate.css          their looks (prefix cb-)
```
