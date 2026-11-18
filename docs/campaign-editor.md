# Campaign editor (proposal 2026-11-17; first version built 2026-11-18)

A Developer page for the designer to make new Campaigns. It changes no rule: what it writes is
a Campaign file in the same format as `data/Campaign1.txt`, which the designer copies into the
Project (component data stays the master).

**Built 2026-11-18** (`src/web/briefing/editor/`: `model.ts`, `CampaignEditor.tsx`,
`EffectEditor.tsx`, `MapTool.tsx`), with the designer's answers C1-C5 (below): palette, Omega
units (Level, dev price, Destroyed and At Overload effects), Campaign Orders, missions (deck with
copy limits, Threat columns, map tool with gold Omega sectors, objective, event, mission Order),
dev prices per unit and summed per mission roster, per Threat column and for the whole Campaign
(Threat columns not counted), live checks, New / Start from C1 / Import (Campaign file or editor
file), Export (Campaign file for the Project, editor file to go on with). The draft is kept in
this browser (localStorage `aphelion5.editor`).
Changes from the proposal: no "pick an effect that already exists" (C3: blocks or text only); the
Omega units placed follow the Campaign file's format (item 7: the chosen Omega types each stand on
every gold sector), not one unit per sector.
**Not built yet:** "Play this mission" (the game loading an edited Campaign), and programming
what the game does not know: the new mission events (gain set colours, take N Modules, take
Anomaly cards, remove damage) and effects from blocks (one general program could play every block
effect). Open: C6 (G_00 price), C7 (Campaign 1's Omega prices), C8 (routes in the Campaign sum),
in `docs/open-questions.md`.

## Where it lives

System options > Developer mode on > "Campaign editor". A full page in the briefing's look (glass
panels, the chosen style). Drafts are kept in this browser and exported / imported as a file
(Copy and Download, as saves are), so work is never only in the browser.

## Layout

Wide screen (1280 px and wider), three columns:

| Left: Palette | Middle: Campaign | Right: the open mission |
| --- | --- | --- |
| The units chosen for this Campaign, as unit tiles (glyph, Level, arrows), filtered by type. "+ Add units" opens the whole unit list (131 units) to pick from. Each tile shows how many copies the missions use and how many exist (`copies` in the unit list). | Name, short note, Omega units, Campaign Orders, then the missions as a route map (1, 2x / 2y, 3, 4x / 4y, 5 ...): add a mission, add an alternative route, drag to reorder. | Tabs: Deck, Threats, Map, Objective and event, Orders, Check. |

Tablet: palette as a drawer from the left. Phone: one column with tabs (Palette, Campaign, Mission).

## 1. The palette

- Pick units from the full list (filters: type, Level, has arrows, text search on the effect).
- The palette is the Campaign's set: missions and Threats only take units from it (drag a tile in,
  or tap a tile then tap the place).
- Pressing a tile opens its information card (the same `UnitCard` as the briefing).
- Each tile shows "used / exists", e.g. S_12 "4 / 4"; over the limit it turns red (see question C1).

## 2. Missions and Threats

Deck tab: the shuffled deployment (`deployment_shuffled`): tiles with "×N" steppers; "G_00" (a
tile from the Energy deck) is its own chip. The total and how it will be dealt over the map's
sectors (7.2 step 5: how many tiles per sector, which get one extra) are shown live.

Threats tab: four columns A-D side by side, as on the game's Threat screen, each a list of tiles
(a repeated unit = several copies). The Threat Level names and colours as in the game.

## 3. The map tool

- A hex grid on axial (q, r) as Core Rules 3.8. (0,0) is the starting sector, always there,
  marked. Tap a hex to add or remove a sector; drag to paint several.
- Rows (same q) shown on hover, as the game's row bubbles.
- Omega sectors: drag an Omega unit from the palette onto a sector (`omega_placed`,
  `omega_sectors`); those sectors are marked and get no deal.
- Copy a map from another mission, mirror it, undo.
- `map_sector_count` is counted, never typed.
- The same picture the briefing's mission map shows (`MissionMap.tsx`), so it looks the same.

## Objective, events, Orders and Omega units

These four are where an editor can only go as far as the program already knows the effect.
Units' and Orders' effects are small programs (`src/effects/`); a new effect cannot run until it
is programmed. So I propose three levels:

**Objective** (8.2): a menu: "Salvage" (fixed: 5 Power Nodes, 3 Cleared sectors) or
"Eliminate N of unit X" (X from the palette, N a stepper; a check warns when the deck holds fewer
than N). A new objective type would need programming.

**Mission events**: a menu of the event types the game knows: Allied Drop (Level), Gain energy
(amount), Take the top Module, None. Choosing one shows its numbers. A new event type is
"Write a new event": free text, marked "needs programming" (see below).

**Orders** (mission and Campaign): each Order = Command tokens (stepper), Overload only (switch),
effect. The effect is either:
1. picked from the Orders already programmed (all Campaigns'), with their text; or
2. built from blocks for the common shapes: "Deal N damage to [one / all] [unit filter]",
   "Destroy one [unit filter]", "Swap [a Mecha / a unit] with another unit", "Teleport a Mecha to
   a Dark sector", "Boost ...", "Shield ..." (the filter: type, Level, Wreck or not). These are
   made from the building blocks the game already has, so they play at once; or
3. written as free text, marked "needs programming": the mission can be saved and exported but
   not played until it is programmed.

**Omega units**: a Campaign has its own Alpha, Beta and Gamma (the tiles O_01-O_03 are shared;
their Level and effects come from the Campaign board). For each: role (Alpha / Beta / Gamma),
Level (stepper), and each of its triggers (Destroyed, At an Overload, Alert ...) with an effect
made the same three ways as Orders (an existing Omega effect, blocks, or text "needs
programming"). The tile shows the Level the Campaign gives it.

"Needs programming" effects are listed on the Check tab and in the export as a list for me; the
next session programs them, and the editor then shows them as playable.

## Check and test

Check tab, live: every unit id exists; copies not over what exists (if C1 says so); the deck
fills the map (7.2 step 5); the objective can be met with what is in the deck and Threats; each
alternative route has its partner; Omega sectors are on the map and not (0,0); effects needing
programming.

"Play this mission": starts a Developer-mode game on this Campaign at this mission (the briefing,
Threat screen and Field as usual), so the designer tries it at once. Not saved into the profile.

## Export

The Campaign file text (same keys and order as `Campaign1.txt`), with Copy and Download, plus
Import to go on with a file. Loading a new Campaign into the game for real (a Campaign card in the
briefing) needs the file in `data/` (from the Project), as today.

## Questions for the designer

Answered 2026-11-18 (`docs/open-questions.md`): C1 copies are limited, the editor allows only the
copies that exist; C2 always O_01-O_03 (maybe O_04 later); C3 blocks and text; C4 events: gain
energy (colour and amount), take Modules, take an Anomaly, call for an Ally, remove damage from the
Flagship; C5 no Campaign look. New: C6, C7, C8.
