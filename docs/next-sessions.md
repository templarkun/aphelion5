# Next sessions (plan, 2026-11-04)

All 8 build stages are built and all test batches (1-8) are agreed. What is left for
version 1 (spec "Scope", "Acceptance") and after:

1. **Play-test build and fixes.** Publish the web build so the designer can play a full
   mission without installing anything; fix what the designer finds. Acceptance needs the
   designer to play one full mission and agree it matches the rules.
2. **Art.** Load the designer's art from `art/` in the spec's Art format (tiles, back,
   plate, Modules, Anomalies, tokens), falling back to placeholders file by file.
3. **Settings and polish.** Animation speed and simple transitions, colour-blind token
   shapes, the auto-answer switch; a clearer Mission Preparation and Mission End screen
   (upgrades on the Company sheet).
4. **Developer tools.** Load scenario (test-batch notation), Edit state, Rule trace, a
   switch to show hidden tiles.
5. **Language files.** Every word the player sees from `lang/en.json`, card text generated
   from the component files.
6. **Speed and acceptance runs.** Undo and loading from checkpoints at each Mission
   Preparation; full Campaign 1 play-throughs with V1 and V2, with and without Heat.
7. **After version 1.** Wrap the same code for PC (Tauri or Electron) and phones (Capacitor).
