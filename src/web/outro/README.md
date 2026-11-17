# Outros

What the player sees at Game End (Core Rules 10.3) after the last mission is won: a short film,
then the Campaign Debrief card with the final score. Screen only: no rule lives here. A lost or
conceded game still gets the plain "Game over" card.

There will be several outros, one planned per Company. Which Company gets which is the designer's
choice: `OUTRO_OF_COMPANY` in `index.ts` (empty for now, so every Company gets `DEFAULT_OUTRO`).

| Outro | What it is |
| --- | --- |
| `terraformer` | The Company claims the planet for good. Bay doors open in the ship's belly, one pylon per mission won falls through the air, each hit sends a shock wave over the ground and turns it into a lit sector in the Company's colours; the sun rises. About 11.5 seconds. |

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
TerraformerVictoryOutro.tsx  the Terraformer outro: canvas, captions, SKIP, the Debrief card
outro.css                    its looks (colours and shapes follow the chosen menu style, --bf-*)
terraformer/timeline.ts      when things happen (seconds); pylon places
terraformer/scene.ts         the film: camera, pylons, trails, plasma, hits
terraformer/globe.ts         space, the planet, its air, the sun
terraformer/sector.ts        the target sector: rifts, shock waves, grids, domes, lights
terraformer/hull.ts          the ship's belly per Company, bay doors, the lit hold
terraformer/pylon.ts         one pylon; soft light sprites
terraformer/view.ts          the camera and smooth tracks
```

## To add an outro

1. Write its component beside `TerraformerVictoryOutro.tsx`. It takes `OutroProps` and calls
   `onComplete` when the player is done. Give it a `[SKIP]` button and the Debrief.
2. List it in `OUTROS` (`index.ts`).
3. When the designer says which Company it belongs to, add the line to `OUTRO_OF_COMPANY`.

Sound: the films are silent. `../briefing/soundHooks.ts` holds empty functions already called
at the right moments (`playBayDoorsOpen`, `playReentryStreak`, `playTerraformShockwave`,
`playVictoryResolve`); fill them in when there are audio files.

To look at an outro without playing a Campaign: System options (the gear) > "Play the outro".
