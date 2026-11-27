# Outros

What the player sees at Game End (Core Rules 10.3) after the last mission is won: a short film,
then the Campaign Debrief card with the final score. Screen only: no rule lives here. A lost or
conceded game plays one of the two loss outros at random (designer 2026-11-24, below), then the
same Debrief card ("Campaign lost" / "Campaign conceded").

There will be several outros, one planned per Company. Which Company gets which is the designer's
choice, made at the very end of development (designer 2026-11-27): `OUTRO_OF_COMPANY` in `index.ts`
is empty, so until then a won Campaign plays one of `VICTORY_POOL` at random for any Company
(`pickVictoryOutro`: Terraformer 2.0, Surface Terraform, Orbital Claim, Homecoming, Star Chart;
Terraformer 1.0 is kept only to compare). `DEFAULT_OUTRO` is used only when nothing else fits.

| Outro | What it is |
| --- | --- |
| `terraformer2` | Terraformer 2.0 (designer 2026-11-17), in the random pool. Industrial terraforming: the bay doors open, the pylons (atmospheric processors: reactor core, four folding wings, anchor spike, braking thrusters on top, firing down) are lowered out, drift free for 1.2 s while they turn upright, then come down slowly on their thrusters; one by one they anchor and fire blue-green beams up through the toxic storm, which clears in emerald and cyan rings over ocean and green land; the sun rises. About 15 seconds. |
| `surface` | Surface Terraform (designer 2026-11-19; new look 2026-11-21: hard, gritty science fiction after Dune, Mass Effect and Homeworld, geological, not botanical), in the random pool. Goes on from 2.0 on the planet's surface: an ochre dust storm over a dark basalt valley; three brutalist spires (gunmetal tiers, radiator fins, amber strobes, heat shimmer) fire wide ion plumes, four more far off; the plumes carve a turbulent eye in the storm, cold sunlight breaks through in shafts; water fills the dark canyon beds and pools, the basalt turns wet and mineral-rich, mist on the valley floor; a slow, heavy pan, the spires venting vapour, while the Debrief slides in. Seen as a recon feed (thin visor lines, live telemetry); film grain, vignette, colour fringes. No plants or creatures. About 12.5 seconds. |
| `orbital` | Orbital Claim (designer 2026-11-19), in the random pool. No terraforming: a corporate-military claim. From low orbit over the night side of the intro's planet a beacon beam in the Company's colour climbs from the liberated sector into space; the camera rises along it as the Company's Flagship (a lit solid in the Company's outline from the Vessel screen) glides in and locks its belly clamps on the beam with a flash; twelve relay satellites snap into a lattice and a hexagonal territory grid sweeps over the curve of the ground, "ASSET SECURED"; a slow orbital drift while the Debrief slides in. About 11.5 seconds. |
| `homecoming` | Homecoming (designer 2026-11-27), in the random pool. Generic (any Company: the Company's colours, a plain hull): by the Company's home world the Flagship drops out of its jump (flash, streak, ring of particles); 14 escorts peel in on particle trails and form an honour guard; one salute burst per mission won on a tracer from the Flagship; the station's 24 ring lights come on; the Flagship comes to rest at the docking arm, the clamps lock (8.9 s); the escorts peel away. About 11.6 seconds. |
| `starchart` | Star Chart (designer 2026-11-27), in the random pool. Generic: one star per mission won ignites with its tag, one companion per Threat column; streams of particles draw the Campaign's constellation (its shape from the missions played); it flares and the camera pulls far back to a spiral galaxy, the constellation marked with the Campaign's name. About 11.2 seconds. |
| `terraformer` | Terraformer 1.0, kept as it was to compare (System options only). Bay doors, one pylon per mission won falls through the air, each hit sends a shock wave over the ground and turns it into a lit sector in the Company's colours; the sun rises. About 11.5 seconds. |

## The loss outros (designer 2026-11-24)

`LOSS_OUTROS` in `index.ts`; one is picked at random each time (`lossOutroFor`, `pickLossOutro` in
`loss/timeline.ts`). Generic: the same for every Company and Campaign (the Company lends only its
name and colours; a plain hull, no Company outline, no Campaign map), the same for a loss and a
concede (a few caption words differ, `stats.result`). One page for both, `LossOutro.tsx` (captions,
cues, "Tap twice to skip", the Debrief); captions and the card's accent a muted crimson
(`LOSS_ACCENT`, `.ou-loss` in outro.css).

| Outro | What it is |
| --- | --- |
| `signal` | Signal Lost, about 10.4 s (`loss/signal.ts`): the Flagship's tactical display, a tilted sector of 61 hexes in the Company's colour; crimson swarms pour in and the hexes fall, outer ring first; the link fails and the display tears (slices, ghost, static, blackouts); the last beacon dies and the display collapses to a line, then a point; "NO SIGNAL", embers. |
| `withdrawal` | Withdrawal, about 11 s (`loss/withdrawal.ts`): high orbit over the planet's night side; crimson veins (particle streams) spread and the Company's lights go out; twelve craft climb to the Flagship under fire, one is lost; the jump drive gathers light, a flash, the ship is gone; debris over the burning world. |

## What every outro is given (`types.ts`)

```
companyTheme    the Company's colours (themes.ts: placeholders the designer can change)
vesselId        the Company's id: picks the ship's outline
campaignStats   everything the Debrief shows, read from the finished game (stats.ts); `result` won / lost / conceded
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
surface/world.ts             Surface: the valley in km (spires, streams, pools, sun, moons), when water and the wet front reach each place, the projection
surface/layers.ts            Surface: the painted parallax layers (far ranges, valley floor, ridges, near rocks), barren and wet, the wet front passing over them; baked rock textures (fBm relief, strata)
surface/sky.ts               Surface: the cold sky, sun and moons, the dust-storm deck and its turbulent eye
surface/scene.ts             Surface: the film: camera pan, layers far to near dissolved in the air, brutalist spires, ion plumes, vapour, water, dust, mist, rain, light shafts, lens flare, grain
surface/telemetry.ts         Surface: the recon feed's readouts, worked out from the time alone
OrbitalClaimOutro.tsx        Orbital Claim: the same page with the orbital film
VictoryFilmOutro.tsx         Homecoming and Star Chart's page (the loss outros' page in the Company's colours)
victory/timeline.ts          both films' seconds, the escorts, salutes, ring, stars, links, the constellation's shape
victory/homecoming.ts        Homecoming: home world, station, the plain hull, jump, escorts, salute bursts, dock
victory/starchart.ts         Star Chart: nebula, stars and companions, links, ascension, galaxy, the marker
LossOutro.tsx                the two loss outros' page (Signal Lost, Withdrawal)
loss/timeline.ts             both loss films' seconds, the random pick, the display's sectors, the craft
loss/kit.ts                  light sprites, grain, vignette, where the picture's middle goes once the card is in
loss/signal.ts               Signal Lost: the display, swarms, falls, the tear, the collapse
loss/withdrawal.ts           Withdrawal: planet, veins, lights, the plain hull, craft, flak, jump, debris
orbital/timeline.ts          Orbital: when things happen (seconds)
orbital/globe.ts             Orbital: the intro's planet for a moving camera; the sector's place on it; points of the grid on the ground
orbital/flagship.ts          Orbital: the Company's Flagship as a lit solid, in its outline from the Vessel screen; the clamps, the thrusters
orbital/scene.ts             Orbital: the film: camera, stars, sun, smoke and lightning, the beacon and its rings, the ship, the lock, satellites, lattice, the hexagonal grid, telemetry
```

Surface Terraform is drawn on one canvas in layers, each painted once (barren and wet) and moved
by the camera's slow sideways drift as much as its distance asks; the valley floor is drawn sheared,
so its near part moves more than its far part. Each layer is then dissolved into the air (dust, then
cold haze) as much as its distance asks. Every point of a layer knows the moment the wet front
reaches it, so any moment of the film can be drawn by itself. Its textures (rock relief and strata,
dust and mist bands, puffs of gas, film grain) are baked once from seeded noise. The recon feed is
plain page elements over the canvas, written each frame from `surface/telemetry.ts`.

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
fill them in when there are audio files. Homecoming's and Star Chart's hooks are wired to audio batch 4 names (`playJumpArrival`, `playEscortFlyby`,
`playSaluteBurst`, `playDockingClamp`, `playStarIgnite`, `playConstellationLink`, `playStarChartAscend`).
The loss outros' hooks are already wired to audio batch 3
names (`docs/audio-hooks.md`) and end with `playDefeatResolve` (`sfx-mission-lost`).

To look at an outro without playing a Campaign: System options (the gear) > "Play Terraformer 2.0",
"Play Surface Terraform", "Play Orbital Claim", "Play Homecoming", "Play Star Chart" or "Play Terraformer 1.0"; the loss outros "Play
Signal Lost" and "Play Withdrawal" (sample numbers of a lost game).
