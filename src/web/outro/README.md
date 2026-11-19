# Outros

What the player sees at Game End (Core Rules 10.3) after the last mission is won: a short film,
then the Campaign Debrief card with the final score. Screen only: no rule lives here. A lost or
conceded game still gets the plain "Game over" card.

There will be several outros, one planned per Company. Which Company gets which is the designer's
choice: `OUTRO_OF_COMPANY` in `index.ts` (empty for now, so every Company gets `DEFAULT_OUTRO`).

| Outro | What it is |
| --- | --- |
| `terraformer2` | Terraformer 2.0 (designer 2026-11-17), plays after a won Campaign. Industrial terraforming: the bay doors open, the pylons (atmospheric processors: reactor core, four folding wings, anchor spike, braking thrusters on top, firing down) are lowered out, drift free for 1.2 s while they turn upright, then come down slowly on their thrusters; one by one they anchor and fire blue-green beams up through the toxic storm, which clears in emerald and cyan rings over ocean and green land; the sun rises. About 15 seconds. |
| `surface` | Surface Terraform (designer 2026-11-19), System options only for now. Goes on from 2.0 on the planet's surface: a barren volcanic valley under a toxic amber-grey sky; three spires (2.0's pylons, drawn by the same `rig.ts`) open their radiator wings and fire cyan-emerald beams; a clear-sky vortex spirals open over the great spire, rain and bright mist fall, sunlight breaks onto the ridges; water fills the dry canyon beds and pools, green and glowing life spreads from the spires like a tide, flocks glide in; a slow panoramic drift while the Debrief slides in. About 12.5 seconds. |
| `orbital` | Orbital Claim (designer 2026-11-19), System options only for now. No terraforming: a corporate-military claim. From low orbit over the night side of the intro's planet a beacon beam in the Company's colour climbs from the liberated sector into space; the camera rises along it as the Company's Flagship (a lit solid in the Company's outline from the Vessel screen) glides in and locks its belly clamps on the beam with a flash; twelve relay satellites snap into a lattice and a hexagonal territory grid sweeps over the curve of the ground, "ASSET SECURED"; a slow orbital drift while the Debrief slides in. About 11.5 seconds. |
| `terraformer` | Terraformer 1.0, kept as it was to compare (System options only). Bay doors, one pylon per mission won falls through the air, each hit sends a shock wave over the ground and turns it into a lit sector in the Company's colours; the sun rises. About 11.5 seconds. |

## What every outro is given (`types.ts`)

```
companyTheme    the Company's colours (themes.ts: placeholders the designer can change)
vesselId        the Company's id: picks the ship's outline
campaignStats   everything the Debrief shows, read from the finished game (stats.ts)
onComplete      called when "RETURN TO COMMAND DECK" is pressed
```

## Files

```
index.ts                     the list of outros, and which Company gets which
types.ts                     OutroProps, CompanyTheme, CampaignStats
themes.ts                    each Company's colours (placeholders)
stats.ts                     the Debrief's numbers from the game state; made-up numbers for the preview
VictoryOutro.tsx             picks the Company's outro for a finished game; the preview
Debrief.tsx                  the Campaign Debrief card, shared by every outro
TerraformerVictoryOutro.tsx  Terraformer 1.0: canvas, captions, SKIP (kept as it was)
TerraformerVictoryOutro2.0.tsx  Terraformer 2.0: the same page with the 2.0 film
SurfaceTerraformOutro.tsx    Surface Terraform: the same page with the surface film
outro.css                    their looks (colours and shapes follow the chosen menu style, --bf-*)
terraformer/timeline.ts      when things happen (seconds); pylon places
terraformer/scene.ts         the film: camera, pylons, trails, plasma, hits
terraformer/globe.ts         space, the planet, its air, the sun
terraformer/sector.ts        the target sector: rifts, shock waves, grids, domes, lights
terraformer/hull.ts          the ship's belly per Company, bay doors, the lit hold
terraformer/pylon.ts         one pylon; soft light sprites
terraformer/view.ts          the camera and smooth tracks (2.0 uses it too, with hull.ts and pylon.ts's lights)
terraformer2/timeline.ts     2.0: when things happen (seconds)
terraformer2/scene.ts        2.0: the film: camera, the pylons' way out of the bay and down, beams, tags
terraformer2/rig.ts          2.0: one pylon, an atmospheric processor drawn as a lit solid
terraformer2/world.ts        2.0: the storm and the ground, cleared and changed point by point over time
terraformer2/globe.ts        2.0: space, the globe's edge, its air, the sun (1.0's globe without its ground)
surface/timeline.ts          Surface: when things happen (seconds)
surface/world.ts             Surface: the valley in km (spires, streams, pools, sun, moons), when water and the green tide reach each place, the projection
surface/layers.ts            Surface: the painted parallax layers (far mountains, valley floor, ridges, near rocks), barren and living, and the tide passing over them
surface/sky.ts               Surface: the sky, sun and moons, the storm deck and its clear-sky vortex
surface/scene.ts             Surface: the film: camera drift, layers far to near, spires, beams, water, glowing flowers, flocks, rain, mist, sunlight
OrbitalClaimOutro.tsx        Orbital Claim: the same page with the orbital film
orbital/timeline.ts          Orbital: when things happen (seconds)
orbital/globe.ts             Orbital: the intro's planet for a moving camera; the sector's place on it; points of the grid on the ground
orbital/flagship.ts          Orbital: the Company's Flagship as a lit solid, in its outline from the Vessel screen; the clamps, the thrusters
orbital/scene.ts             Orbital: the film: camera, stars, sun, smoke and lightning, the beacon and its rings, the ship, the lock, satellites, lattice, the hexagonal grid, telemetry
```

Surface Terraform is drawn on one canvas in layers, each painted once (barren and living) and moved
by the camera's slow sideways drift as much as its distance asks; the valley floor is drawn sheared,
so its near part moves more than its far part. Every point of a layer knows the moment the green
tide reaches it, so any moment of the film can be drawn by itself.

## To add an outro

1. Write its component beside `TerraformerVictoryOutro.tsx`. It takes `OutroProps` and calls
   `onComplete` when the player is done. Give it "Tap twice to skip" (`SkipHint.tsx`) and the
   Debrief (`Debrief.tsx`). System options gets its preview button from `OUTROS` by itself.
2. List it in `OUTROS` (`index.ts`).
3. When the designer says which Company it belongs to, add the line to `OUTRO_OF_COMPANY`.

The Debrief's numbers (`stats.ts`): the engine's own score and lines, the missions won, the
Modules held, and the game's statistics, counted by the engine as the game is played
(`GameStats` in `src/engine/events.ts`): Overloads, Module runs, units destroyed, Flares and
Sleepers triggered, Gyros drained. A statistics and achievements page will use them later.

Sound: the films are silent. `../briefing/soundHooks.ts` holds empty functions already called
at the right moments (`playBayDoorsOpen`, `playReentryStreak`, `playTerraformShockwave`,
`playVictoryResolve`, for 2.0 `playRetroThrust`, for Surface Terraform `playSpireIgnition` (once
per spire; the far beams are silent), `playAtmosphereClear`, `playWaterFlow` and `playVictoryResolve`,
for Orbital Claim `playSkyBeamFire`, `playOrbitalLock`, `playGridSweep` and `playVictoryResolve`);
fill them in when there are audio files.

To look at an outro without playing a Campaign: System options (the gear) > "Play Terraformer 2.0",
"Play Surface Terraform", "Play Orbital Claim" or "Play Terraformer 1.0".
