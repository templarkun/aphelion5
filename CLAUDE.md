# Aphelion 5 — computer game

A solo campaign board game, being built as a TypeScript web app. The designer is the user; the rules are final unless the designer changes them.

## Sources of truth (masters live outside this repo)

| What | Master | Copy in this repo |
| --- | --- | --- |
| Core Rules | Docs artifact https://claude.ai/artifact/9wWDQ9mD2CxCGiDEBEMs3C | `docs/core-rules.md` (snapshot) |
| Program spec | Docs artifact https://claude.ai/artifact/1SuXBNhYWUxJofhueKTKzY | `docs/program-spec.md` (snapshot) |
| Component data | claude.ai Project "Aphelion rules": `unit_list_structured.txt`, `Modules.txt`, `company_vessels_structured.txt`, `Campaign1.txt`, `Anomaly list.txt`, `Expansion1.txt` | `data/` |
| Test scenarios | Project: `claude/Test scenarios batch 1.txt`, `batch 2.txt` | `tests/batch1.txt`, `tests/batch2.txt` |

- Never edit snapshots by hand. Rebuild them from the master (Docs read/export for the docs, `project_read` for project files) and commit.
- Precedence when sources disagree: component data > Core Rules > Expansion1 > tests > spec (spec "Sources" section).
- A contradiction or gap found while coding: stop, write it down, ask the designer. Do not invent rules.

## Decisions already made (do not re-ask)

- Platform: TypeScript web app; PixiJS draws the Field, React the panels; plain-TS rules engine with no UI code; IndexedDB saves with file export; wrapped for PC and phones after v1.
- Engine is pure: (state, answer) -> (state, next question). All randomness from one seeded generator in state.
- The player makes every choice; the engine asks one question with the full list of legal answers; auto-answer when exactly one is legal.
- Geometry: axial (q, r) per Core Rules 3.8. r+1 = right, q+1 = up-right. Horizontal row = same q.
- Undo back to the last new hidden information; unlimited in Developer mode. Remember tiles the player has looked at.
- Placeholders first; designer's art added later in the spec's Art format. English first, language files later.
- Flares may be flipped and moved by effects that do not choose them. Module with X cost run free uses X = 1. An effect finishes even if its own unit is destroyed.

## Build stages (spec "Build stages")

1. Data and geometry  2. State and tokens  3. Command phase  4. Overloads (first playable, text UI)
5. Units  6. Modules  7. Campaign, saving, Heat  8. Full interface
Each stage ends with all its tests passing and a short report to the designer. Rebuild snapshots before each stage.

## Status

- 2026-11-03: repo created.
- 2026-11-03: `docs/core-rules.md` (master rev 127) and `docs/program-spec.md` (master rev 22) rebuilt from the master docs.
  `company_vessels_structured.txt`, `Anomaly list.txt`, `Expansion1.txt` are still NOT in `data/`: the cloud session had no tool to read the claude.ai Project. The designer must add them (upload or paste); their readers are written then.
- 2026-11-03: Stage 1 done for the files present. `npm run check` = typecheck + tests (49 passing).
  Code: `src/geometry/` (Core Rules 3.8), `src/data/` (readers, data checks), `scripts/build-data.ts` (`npm run build:data` writes `src/data/generated/*.json`; a test fails if they are stale).
  Still open for stage 1: Company and Anomaly readers, and the "every id referenced exists" check for Company Mecha.

## Working with the designer

The designer is not a programmer. Explain in plain words, cite rule sections, keep reports short. Commit messages end with the session's attribution lines.
