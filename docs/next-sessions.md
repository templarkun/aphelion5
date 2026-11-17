# Next sessions (plan, updated 2026-11-17)

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
   2026-11-08 rounds 3-5: Modules panel rework, Mission bar, cards, M_01 walks (see CLAUDE.md).
   2026-11-08 round 6: step 3 begun: weapon and aura looks from Bays, Orders and Modules
   (`src/web/weapons.ts`, `used` events), Flare energy tokens on the tile. Still in step 3:
   drag a Module (or an Order) onto its one target, like the Bays (its plan's X / Overclock /
   extra answers go before the target); drag the energy tokens off a Flare onto a Module when
   its Alert asks; give each look a real sprite later (Art table). Then step 4 (Upgrade sheet).
   2026-11-08 round 7: I9 (Bays and Orders greyed out when no unit fits). Step 3 done: Modules
   drag onto their one target, Flare energy tokens drag onto Modules. Left in step 3: tune the
   weapon looks after the designer's play-test. Next: step 4 (Upgrade sheet).
   2026-11-09 round 8 (designer's look play-test): only V1 Bay 1 keeps the laser; other Bays a
   rail slug, Orders a missile, each unit type its own shot, Heat Wave a heat ray, Fuse tokens
   go off with their own looks; effects on "all" units one fast bombing; Fuse tokens and
   Barriers drawn as pieces; a reveal burst per unit type (Flares and Omega the biggest).
   Next: the designer tries them; then step 4 (Upgrade sheet).
   2026-11-09 round 9: stand-ins for destroyed units, faster Heat Wave, row bubbles, Flagship
   damage bubbles, Sleeper / Gyro effects, black Field, Overload plasma ring, new End button;
   Flare energy rule always on (save format 7).
   2026-11-09 round 10: units chosen on bubbles on the units (no banner), Strength pips, Shield
   and Damage tokens as pieces. Proposed, waiting for the designer's pick: how a unit's Level
   is shown (A corner badge, B Roman numeral plate, C notches on the rim, D pip outlines) and
   how a ready Alert is shown (A Alert token, B pulsing rim, C rising exclamation glyph, D a
   radar sweep; combinations). Next: the designer tries them; then step 4.
   2026-11-09 round 11: sci-fi Strength and Shield icons, Level badge + notches (A + C), Alert
   token + pulsing rim, and a trial look (setup list) beacon + radar rings; Overload edge
   flames; Flagship repair bubbles; FPS counter.
   2026-11-09 round 12: Level badge in the top corner (no notches); Alert token in the bottom
   corner with the pulsing rim (beacon look dropped); Overload edge effect now faint solar
   loops. The tile's upper right corner is kept for the unit glyph (item 3, Art). Next: step 4.
   2026-11-09 step 4: the Upgrade sheet (full screen at Mission End, one point per answer, tap or
   drag, particles, "Upgrade online"; phone tabs). Next: the designer tries it (Developer mode:
   Menu -> win this mission); then step 5 (remaining events and settings).
   2026-11-10 step 5: the remaining event looks (turn, Boost / Shield / repair, Barrier and Fuse
   tokens, uncover, Overload start and end, Overhaul, Wreck smoke) and Menu settings (animation
   speed, reduced motion). Next: the designer tries them; then step 6 (phone check of every drag).
   2026-11-15 styles: the intro and menu look is now a "style" the player switches (System
   options > Style): "intro1" (the first look, saved) and "intro2" (capital ship over the
   sunrise horizon, dark glass menu). Next: the designer compares them and says which to keep
   or what to change; more styles can be added beside them (`src/web/briefing/styles/README.md`).
   The ship in intro2 is a stand-in built from blocks (`styles/intro2/ship.ts`) until real art.
   2026-11-16 round 18: designer chose intro2 as the default. Bug fix (unit-pick bubbles), two
   rules changes (Power Node 2 Heat, M_02 arrows), Bay 3 and similar effects played on the
   Field (`StackPicker.tsx`), briefing roster / Threat layout, slower transitions.
   Round 19: the logo gate between setup screens (`Gate.tsx`), a short mission intro before the
   Field (`MissionIntro.tsx`), Module draw text sizes. Next: the game's outro (new session).
   2026-11-17 the outro: what a won game shows at Game End (10.3). First outro "Terraformer"
   (`src/web/outro/`, its README says how to add more): bay doors, pylons, re-entry, shock waves
   that turn the ground into a lit sector, sunrise, then the Campaign Debrief card. One outro is
   planned per Company; the designer says later which Company gets which (`OUTRO_OF_COMPANY`).
   To look at it without playing: System options > "Play the outro". Waiting on I13 ("Total
   Turns"), I14 (a loss), I15 (Company colours). Still to do there: more outros; the ship in
   Act 1 is a flat stand-in drawn from the Vessel screen's outlines until the ship art; sound.
   2026-11-17 round 2: Terraformer 2.0 (`TerraformerVictoryOutro2.0.tsx`, `terraformer2/`):
   slower deployment (lowered, 1.2 s zero-G drift turning upright, braking thrusters firing
   upwards), atmospheric processors instead of rockets, gentle anchoring, blue-green beams, the
   toxic storm cleared in rings over ocean and green land. It plays after a won Campaign; 1.0
   stays in System options to compare. The Debrief (`Debrief.tsx`, shared) shows "Overloads"
   (I13 answered), the expansion, Module runs, units destroyed, Flares / Sleepers triggered and
   Gyros drained, counted by the engine (`GameStats`). I14 answered (a loss outro later).
   Waiting on I15 (Company colours) and on the designer's look at 2.0.
10. **Statistics and achievements page** (designer 2026-11-17, later). The game collects and
   saves the statistics of every game: Overloads, Module runs (per Module), units destroyed (per
   type), Alerts resolved per type (Flares and Sleepers "triggered"), Gyros drained
   (`GameStats` in `src/engine/events.ts`, kept in the game state; a save is its start and its
   answers, so the numbers come back whenever a game is loaded, older saves too). Today they show
   on the Campaign Debrief. Still to build: keep each finished game's numbers (and lifetime
   totals) in the profile, a statistics / achievements menu to show them, achievements to earn.
   Other counts can be added the same way (one line in `tally`) when that page is designed.
3. **Art.** Load the designer's art from `art/` in the spec's Art format (tiles, back,
   plate, Modules, Anomalies, tokens), falling back to placeholders file by file.
   The Flagship picture on the Upgrade sheet (`FlagshipArt` in `src/web/UpgradeSheet.tsx`) is a
   placeholder: a ship seen from above with its Bays numbered on the hull.
   The unit glyph goes in each unit tile's upper right corner (designer 2026-11-09; kept free).
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
9. **Future rules update: tokens on Dark sectors** (designer 2026-11-08, to be worked on
   later). The designer plans to let tokens be placed on Dark sectors. Already prepared for it:
   V1 Bay 3 now chooses "one sector with no tokens" (`sectorsWithNoTokens` in
   `src/effects/bays.ts` checks a Dark sector's top tile for tokens too). When the rule comes,
   check every effect that chooses a Dark sector, the Reveal, Moves onto Dark sectors and the
   screen (tokens drawn on face-down tiles).
