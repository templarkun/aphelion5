# Next sessions (plan, updated 2026-11-07, evening)

All 8 build stages are built and all test batches (1-9) are agreed and in the Project. What
is left for version 1 (spec "Scope", "Acceptance") and after:

1. **Play-test build and fixes.** IN PROGRESS. The web build is published at
   https://claude.ai/artifact/Djc1u5gc9DZRsrP2K9kLT2 (rebuild with `npm run build:artifact`,
   republish `dist-artifact/aphelion5.html` to that link). The interface was reworked
   2026-11-04..07 at the designer's request (CLAUDE.md "Decisions"). Still needed: the
   designer plays one full mission and agrees it matches the rules; fix what they report
   (they send the text from Export save -> Copy; "Paste a save" replays it).
2. **Interaction and animation** (designer 2026-11-07; Program Spec section
   "Interaction and animation", DRAFT waiting for review and answers I1-I5). Drag and drop with
   tap twins, an animation for every basic event, weapon and aura looks. Build order is in that
   section: engine events + animation player; Mecha drag (sample of the feel, agreed before going
   on); Flare energy, Bays, Modules and Orders; the Upgrade sheet; remaining events and settings;
   phone check. PixiJS stays.
   Done so far (2026-11-07): energy pop-ups beside Modules (one energy per tap, any order),
   the Flare energy trial rule (setup option), Modules panel order and colour rims, bubble
   pop-ups for units and sectors. 2026-11-08: engine events and the animation player (move,
   swap, reveal, hit, destroy, energy) and dragging Mecha (step 2) built. Next: the designer
   tries the feel; then step 3 (energy tokens on Flares, Bay weapons, Modules and Orders).
   Designer's wishes for later (2026-11-08): particle effects like a computer game (not a card
   game) for most interactions, e.g. Attacks and destruction; dust when a Mecha lands on a Dark
   sector instead of the small bounce; an energy/fire particle effect around the Field during an
   Overload. Keep the frame rate up (measure on a phone).
   2026-11-08 round 2: Bays and Orders are buttons (layouts A/B/C, drag onto targets), Reserve in
   the top bar with flying energy, Anomaly bubbles on the Field, Bay 3 look card, energy-removal
   pop-ups. Waiting on I6 (M_01) and I7 (Mecha damage abilities).
3. **Art.** Load the designer's art from `art/` in the spec's Art format (tiles, back,
   plate, Modules, Anomalies, tokens), falling back to placeholders file by file.
   Placeholders to replace with real images (designer 2026-11-08): the unit glyphs in Anomaly
   bubbles and the look card (B, S, F, P, G, M, empty hexagon = Cleared sector; `UnitGlyph`,
   `typeGlyph`), the Bay pictures (`Icon` in `src/web/Flagship.tsx`), the energy glyphs.
4. **Settings and polish.** Animation speed and simple transitions, colour-blind token
   shapes, the auto-answer switch; a clearer Mission Preparation and Mission End screen
   (upgrades on the Company sheet).
5. **Developer tools.** Load scenario (test-batch notation), Edit state, Rule trace, a
   switch to show hidden tiles.
6. **Language files.** Every word the player sees from `lang/en.json`, card text generated
   from the component files.
7. **Speed and acceptance runs.** Undo and loading from checkpoints at each Mission
   Preparation; full Campaign 1 play-throughs with V1 and V2, with and without Heat.
8. **After version 1.** Wrap the same code for PC (Tauri or Electron) and phones (Capacitor).
