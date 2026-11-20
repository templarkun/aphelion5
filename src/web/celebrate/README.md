# Mission celebrations

What the player sees when a mission's objective is reached (designer 2026-11-20). Screen only: no
rule lives here. Two kinds of piece, built separately:

| Kind | When | Where |
| --- | --- | --- |
| The kill | the last required Omega unit is destroyed (it becomes a Wreck, Core Rules 4.8): in Mission 1 the 6th of 8 Alphas. The number counted is the objective's own (8.2): units of its type in the Trophy pile plus those on the Field as Wrecks. | on the Field, centred on the unit (a step of the Field's animation player) |
| The win | the mission is won by 8.2 (the objective checked before a Command phase action). The engine reports it as a display event, `won` (`src/engine/events.ts`). | over the Field and the Mission bar, before the Upgrade sheet (or the next screen) |

When one answer does both, the kill plays first and the win goes on from it (the Trophy flies to the
Mission bar as the kill's camera pulls out). Two taps skip either, as the intro and the outros.

Several pieces are planned for each kind of mission: Eliminate (an Alpha; a Beta more spectacular; a
Gamma more still) and Salvage. Which one plays (I19): one at random each mission, the same one again
if the save is reloaded (`pickPiece`: the game's seed and the mission, never the game's own random
numbers).

| Piece | Kind | For | What it is |
| --- | --- | --- | --- |
| `alphaDown` | kill | Alpha | Alpha Down, about 4.5 s: the Field zooms in on the unit and the rest darkens, brackets lock on; violet light through cracks, the glyph flares and collapses into a core, then bursts (shards, shock ring, sparks, a small shake); the Wreck smokes with a label "ALPHA DOWN · 5 / 6" turning to "6 / 6"; the zoom eases back. |
| `missionComplete` | win | Alpha | Mission Complete, about 5 s: the Field dims, the Mission bar's cells flare one after another and the last bursts (the bar turns gold); a ring in the Company's colour sweeps the Field from the sector the unit left, lighting each sector's edge, the units shiver; "MISSION COMPLETE" slams in with "ALPHA ELIMINATED · 6 / 6" (I20, to try) and a badge per unit dropping in; sparks drift, it fades. |

## How to add one

1. Add it to `KILL_PIECES` or `WIN_PIECES` in `pieces.ts` with what it is `for` ("Alpha", "Beta",
   "Gamma" or "Salvage").
2. A kill is a Field step (`anim.ts` `Step` with `twoTap` and a `still`), built from a `KillEnv`
   (`killFx.ts`): it draws in screen pixels on the layer it is given and may zoom the board. Pick it
   by id where `FieldView.tsx` calls `alphaDownStep`.
3. A win is a React component taking `MissionWinProps` (`MissionWin.tsx`); pick it by id where the
   game screen (`App.tsx`) and the preview mount `MissionWin`.
4. Times in seconds in `timeline.ts`; silent sound hooks in `briefing/soundHooks.ts`; a preview
   button in System options (`Briefing.tsx`, `CelebrationPreview.tsx`); test scenarios in batch 13.

Every piece follows the speed setting; with reduced motion or the speed Instant it shows a still
picture for `STILL` seconds. Every moving thing is worked out from the time alone.

## Files

```
pieces.ts              the pieces and the pick (I19)
detect.ts              when the kill and the win play; the board as it was won
timeline.ts            when things happen (seconds)
killFx.ts              Alpha Down: a Field step (PixiJS)
MissionWin.tsx         Mission Complete: canvas over the page, the banner and badges (React)
CelebrationSkip.tsx    "Tap twice to skip", catches every tap while a piece plays
CelebrationPreview.tsx System options: the pieces on a made-up Mission 1 Field
previewBoards.ts       that Field (also used by the tests)
celebrate.css          their looks (prefix cb-)
```
