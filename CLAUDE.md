# Aphelion 5 — computer game

A solo campaign board game, being built as a TypeScript web app. The designer is the user; the rules are final unless the designer changes them.

## Sources of truth (masters live outside this repo)

| What | Master | Copy in this repo |
| --- | --- | --- |
| Core Rules | Docs artifact https://claude.ai/artifact/9wWDQ9mD2CxCGiDEBEMs3C | `docs/core-rules.md` (snapshot) |
| Program spec | Docs artifact https://claude.ai/artifact/1SuXBNhYWUxJofhueKTKzY | `docs/program-spec.md` (snapshot) |
| Component data | claude.ai Project "Aphelion rules": `unit_list_structured.txt`, `Modules.txt`, `company_vessels_structured.txt`, `Campaign1.txt`, `Anomaly list.txt`, `Expansion1.txt` | `data/` |
| Test scenarios | Project: `claude/Test scenarios batch 1.txt` ... `batch 8.txt` (batches 3-8 written by Claude, all agreed; the designer copies them into the Project) | `tests/batch1.txt` ... `tests/batch8.txt` |

- Never edit snapshots by hand. Rebuild them from the master (Docs read/export for the docs, `project_read` for project files) and commit.
- Precedence when sources disagree: component data > Core Rules > Expansion1 > tests > spec (spec "Sources" section).
- A contradiction or gap found while coding: stop, write it down, ask the designer. Do not invent rules.

## Decisions already made (do not re-ask)

- Platform: TypeScript web app; PixiJS draws the Field, React the panels; plain-TS rules engine with no UI code; IndexedDB saves with file export; wrapped for PC and phones after v1.
- Engine is pure: (state, answer) -> (state, next question). All randomness from one seeded generator in state.
- The player makes every choice; the engine asks one question with the full list of legal answers; auto-answer when exactly one is legal, except the Campaign, the Company, the expansion modules and the Ally (always asked, designer 2026-11-04).
- Computer version, designer 2026-11-04: uneven deal (7.2 step 5) is not asked: extra tiles go to (0,0), then (0,1) (if dealt to), then to random sectors. Expansion modules are a select-any list at setup (only the Heat module so far).
- Interface, designer 2026-11-04: no action menu. The action menus (8.1, 9.2) carry `shortcuts` (one answer = an action and its target); the screen shows them on the things: unit / Dark sector pop-ups (click outside closes), Modules, Bay abilities and Orders clicked directly, Overhaul (confirm unless Crippled) by the Bays, Concede (confirm) by Menu, End the Overload in the top bar. Questions marked `pick` (modules, bays, units, reserve), or whose options carry `on` (a unit or sector), are answered by clicking those things; everything clickable is highlighted. M_03 / M_06 Attack: one question (click a target, or a sector / unit for the Passive first). Facing questions (`facing` on the question) show rotate buttons on the unit; the screen already shows the next question and the next click keeps the facing ("Done" instead when that would show hidden information).
- Energy placed by choice (designer 2026-11-04, Q9, Core Rules master rev 137, 4.6 and 5.3): only on ready Modules of its own colour; no such Module: it stays in the Supply. When a card leaves the colour to you, it is the Module's colour. A card naming both Module and colour places them as written.
- Q8 (2026-11-04): ending an Overload stays as 9.2 says (you choose when, once no Alerts remain).
- Geometry: axial (q, r) per Core Rules 3.8. r+1 = right, q+1 = up-right. Horizontal row = same q.
- Undo back to the last new hidden information; unlimited in Developer mode. Remember tiles the player has looked at.
- Placeholders first; designer's art added later in the spec's Art format. English first, language files later.
- Flares may be flipped and moved by effects that do not choose them. Module with X cost run free uses X = 1. An effect finishes even if its own unit is destroyed. A hit is at least 1 damage: "deal 0 damage" does nothing at all (Q1). A face-up tile put on top by V1 Bay 3 / V2_P3 / V2_P3A is uncovered, not revealed; V1 Bay 3's "Then Reveal" is skipped as the sector is no longer Dark (Q2).
- Mission Preparation step 6: the 2 Modules not kept go to the bottom of the Module deck in random order. Mission End step 4: Energy Gyros go to the bottom of the Energy deck in random order (designer 2026-11-04; Core Rules master rev 133 now says "in random order" in both places). Choosing Done with Upgrade points left warns that they are lost and asks the player to agree.

## Build stages (spec "Build stages")

1. Data and geometry  2. State and tokens  3. Command phase  4. Overloads (first playable, text UI)
5. Units  6. Modules  7. Campaign, saving, Heat  8. Full interface
Each stage ends with all its tests passing and a short report to the designer. Rebuild snapshots before each stage.

## Status

- 2026-11-03: repo created.
- 2026-11-03: `docs/program-spec.md` (master rev 22) rebuilt. `docs/core-rules.md` rebuilt at master rev 128 (footnote C2 corrected at the designer's request: a Wreck carries a Wreck marker, not a Damage token).
- 2026-11-03: `company_vessels_structured.txt`, `Anomaly list.txt`, `Expansion1.txt` added to `data/` from files the designer uploaded (the cloud session cannot read the claude.ai Project; ask for uploads next time too).
- 2026-11-03: Stage 1 done. `npm run check` = typecheck + tests (56 passing).
  Code: `src/geometry/` (Core Rules 3.8), `src/data/` (readers for all six data files, data checks, test-batch reader), `scripts/build-data.ts` (`npm run build:data` writes `src/data/generated/*.json`; a test fails if they are stale).
- 2026-11-03: Anomalies 18 and 19 were removed on purpose (designer); footnote C5 reference dropped, Core Rules master rev 129.

- 2026-11-03: Stage 2 (state and tokens) done: `src/engine/` (state, effects as generators + pure replay step, questions, token building blocks, invariants, scenario notation). 109 tests passing. Open rules questions live in `docs/open-questions.md`.
- 2026-11-03: Stage 3 (Command phase) done: `src/engine/command.ts` (action menu, checks, Overhaul, Orders, Bays, Drains, Overload start), `mecha.ts`, `alerts.ts`, `modules.ts` (8.6 payment), `moves.ts`; card effects in `src/effects/` (Bays, Orders, Energy Gyros, M_01; others raise NotBuiltYet). `tests/batch3.txt` is Claude's DRAFT from Core Rules, awaiting the designer's agreement (then it goes into the Project). 154 tests incl. random play-throughs. Q1 and Q2 answered (`docs/open-questions.md`).
- 2026-11-03: Stage 4 (Overloads) built. Master docs checked at stage start: Core Rules still rev 129, spec still rev 22 (no snapshot rebuild). `src/engine/overload.ts` (roots `overloadStep`, `overloadEnd`; Anomalies), `session.ts` (driver: right root per phase), `fixedBoard.ts`; text UI `src/cli/`, `npm run play [seed]`. Cards built early for the tests and the fixed board: S_01, S_12, F_04, F_13, P_05, O_01, O_03, V1_M02_U2, Modules 1 and 26. `tests/batch4.txt` is Claude's DRAFT, awaiting the designer (as is batch 3 and its no-arrows facing assumption). 200 tests passing.
- 2026-11-03: Designer agreed batch 3 (incl. no facing question for tiles without arrows) and batch 4, with one change: using a met Anomaly at Overload End is optional ("none" offered). Core Rules master edited at the designer's request (9.3 step 3, now rev 131) and snapshot rebuilt. Q3 answered: Flares uncovered during step 4 are removed too. Batches 3 and 4 still need copying into the Project by the designer.
- 2026-11-03: Stage 5 (Units) built: every Sentinel, Flare, Sleeper, Gyro and Omega effect, Mecha abilities and Passives (M_03, M_04, M_06 in `src/engine/mecha.ts`, part of the Attack) and V1/V2 Mecha upgrades, in `src/effects/` (one file per type; shared steps in `kit.ts`). Master docs unchanged at stage start (Core Rules rev 131, spec rev 22). `tests/batch5.txt` is Claude's DRAFT, awaiting the designer. Q4 and Q5 answered by the designer (O_02 with no Alpha: nothing; P_24 with no damaged Sentinel: choose any). Batch 5 AGREED. Fixed board now uses the real Mission 1 deck (Threat column A). 329 tests passing. Modules are stage 6 (only 1 and 26 built).
- 2026-11-03: Stage 6 (Modules) built: all 78 in `src/effects/modules.ts` (Yellow, Red) and `blueModules.ts`; X costs (Pathfinder Array, Debris Sifter) and cost reductions in `src/engine/modules.ts`. Master docs unchanged at stage start. `tests/batch6.txt` AGREED by the designer 2026-11-04. Q6 and Q7 answered 2026-11-04 (Salvage Siphon: the chosen Module keeps its energy; Gravity Well card text now "one Dark sector or Cleared sector" in data/Modules.txt — the designer must update the Project master). Fixed board now takes real starting Modules (two per colour, 7.1 step 8). 426 tests passing. Next: stage 7 (Campaign).

- 2026-11-04: Stage 7 (Campaign, saving, Heat) built. `src/engine/campaign.ts` (roots `gameSetup`, `missionPreparation`, `missionEnd`, `gameEnd`; Allied Drop, upgrades, scoring, high scores), `heat.ts` (H1-H8), `save.ts` (a game = start + answers; replay, undo to the last hidden information), `src/storage/` (memory and file stores; IndexedDB comes with the web app in stage 8). Profile (every Company sheet's marks, high scores) lives in the state and the save file. New question kind "several" (Threat columns). `npm run play` plays the full Campaign with autosave to `saves/aphelion5.json` (`--new`, `--seed N`, `--fixed`). `tests/batch7.txt` AGREED 2026-11-04 with the three changes above. 447 tests passing, incl. random full-campaign play-throughs (`tests/unit/campaignFuzz.ts`).

- 2026-11-04: Core Rules master rev 133 (7.2 step 6, 10.1 step 4: "in random order"), snapshot rebuilt. Stage 8 (full interface) built: web app in `src/web/` (Vite + React panels + PixiJS Field; `npm run dev`, `npm run build`), IndexedDB saves with export/import, undo, log export, start screen (auto-answer, Developer mode, seed), Game End score. Browser check: `npm run test:ui` (Playwright, screenshots in `dist/ui-check/`). `tests/batch8.txt` AGREED 2026-11-04. Not built yet: designer art loading (`art/`), language files, animation speed, colour-blind token shapes, Developer tools "Load scenario", "Edit state", "Rule trace".
- 2026-11-04: Session 1 of `docs/next-sessions.md`. Master docs unchanged (Core Rules rev 133, spec rev 22). Play-test build published as a claude.ai Artifact: https://claude.ai/artifact/Djc1u5gc9DZRsrP2K9kLT2 (`npm run build:artifact` writes `dist-artifact/aphelion5.html`; republish that file to the same link). Saves stay in the designer's browser. Export save / Export log now open a box with Copy and Download file (the page cannot start plain downloads; it uses the viewer's downloads capability); "Paste a save" on the start screen loads one. Bug reports: ask for the exported save text, it replays the whole game. PixiJS loads `pixi.js/unsafe-eval` (no eval() on the published page). 448 tests passing, `npm run test:ui` passing. Waiting for the designer's play-test of one full mission.
- 2026-11-04: Interface rework (designer's 17 points), see "Decisions". Engine: `shortcuts`, `pick`, `always` on questions (`src/engine/questions.ts`); `commandShortcuts` (command.ts), `overloadShortcuts` (overload.ts); setup asks Campaign, expansion list, Ally always; `extraTileSectors` (campaign.ts). Screen: `src/web/App.tsx` (pop-ups, confirms, clickable panels), Field highlight halo; `scripts/ui-smoke.mjs` checks no menu, pop-up open/close, Reveal. Tests: batch 1 T_SET_01 and batch 7 T7_SET_01, T7_PRP_01, T7_PRP_02 changed (notes in the files; the Project copies need the same change); batch 8 records replaced by `tests/batch9.txt` (DRAFT). Q8 and Q9 answered the same day (see Decisions). Program Spec master rev 23 (three decisions added), Core Rules master rev 137; snapshots rebuilt.

## Working with the designer

The designer is not a programmer. Explain in plain words, cite rule sections, keep reports short. Commit messages end with the session's attribution lines.
