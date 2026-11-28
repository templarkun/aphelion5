/**
 * Sound hooks of the command briefing, the intro and the Threat screen.
 *
 * Designer 2026-11-22: the first sounds are in (sound.ts, docs/audio-hooks.md): select / confirm
 * play "tap", back "back", an information card "popup", the win banners "mission-complete". The
 * rest are still silent.
 *
 * Each function here is a place already called at the right moment (hover, select, confirm, step
 * change, chips, Threat, launch, the intro's engines, the outros' and celebrations' acts). To give
 * one a sound, put the file in art/ (docs/audio-hooks.md), run `npm run build:audio` and write
 * `sfx("<name>")` in its body.
 *
 * Nothing else has to change: the buttons and transitions already call these.
 */

import { sfx } from "../sound.js";

/** The pointer moved onto a button or a card. */
export function playHover(): void {}
/** A card, unit, mission or tab was chosen. */
export function playSelect(): void {
  sfx("tap");
}
/** A step was confirmed (Campaign, Vessel, Modules, Threat). */
export function playConfirm(): void {
  sfx("tap");
}
/** Back one step, or a pop-up closed. */
export function playBack(): void {
  sfx("back");
}
/** The screen changes from one step to the next. */
export function playTransition(): void {}
/** A unit's information card opened. */
export function playOpenInfo(): void {
  sfx("popup");
}
/** An expansion chip was plugged in / pulled out. */
export function playChipIn(): void {}
export function playChipOut(): void {}
/** A Threat column was added: `level` is the new Threat Level, 1 to 4 (louder and darker as it rises). */
export function playThreatUp(_level: number): void {}
/** A Threat column was removed. */
export function playThreatDown(_level: number): void {}
/** LAUNCH COMMAND SEQUENCE was pressed. */
export function playLaunch(): void {}
/** The intro's ship engines: start a loop here, and stop it in stopEngineHum. */
export function playEngineHum(): void {}
export function stopEngineHum(): void {}
/** The intro's brackets lock onto the planet. */
export function playOrbitLock(): void {}
/** The short fly-by of a returning player. */
export function playFlyBy(): void {}

/**
 * The outros (designer 2026-11-16; src/web/outro/). Silent like the rest: empty places called at
 * the right moments of the film, for real audio files later.
 */
/** Terraformer outro, Act 1: the bay doors in the ship's belly start to slide open. */
export function playBayDoorsOpen(): void {}
/** Terraformer outro, Act 2: the pylons meet the air and begin to burn (2.0: they reach the upper air and open their wings a little). */
export function playReentryStreak(): void {}
/** Terraformer outro, Act 3: a pylon hits and its shock wave goes out (2.0: a pylon has anchored and fires its beam). `index` 0 = the first; `of` = how many pylons. */
export function playTerraformShockwave(_index: number, _of: number): void {}
/** Terraformer outro, Act 4: the sun comes over the edge; the Debrief follows. (Surface Terraform: the living world settles, Act 4.) */
export function playVictoryResolve(): void {}
/** Terraformer 2.0, Act 1: a pylon's braking thrusters light. `index` 0 = the first; `of` = how many pylons. (2.0 also calls the four above: doors, entering the air, each anchor lock with its beam, the sunrise.) */
export function playRetroThrust(_index: number, _of: number): void {}
/**
 * Surface Terraform (designer 2026-11-19), on the planet's surface. (It also calls playVictoryResolve
 * as the living world settles in Act 4.)
 */
/** Act 1: a spire's radiator wings have opened and it fires its beam into the storm. Called once for each of the three spires. */
export function playSpireIgnition(): void {}
/** Act 2: the clear-sky vortex starts to turn and open the storm clouds. */
export function playAtmosphereClear(): void {}
/** Act 3: water starts to run down the dry canyon beds from the spires' feet. */
export function playWaterFlow(): void {}
/**
 * Orbital Claim (designer 2026-11-19), the Company claims the sector from orbit. (It also calls
 * playVictoryResolve as the camera settles into its vigil, Act 4.)
 */
/** Act 1: the beacon beam fires from the liberated sector and climbs into space. */
export function playSkyBeamFire(): void {}
/** Act 2: the Flagship's belly clamps lock on the beam with a flash: the orbital tether. */
export function playOrbitalLock(): void {}
/** Act 3: the hexagonal territory grid sweeps out over the region. */
export function playGridSweep(): void {}
/**
 * The loss outros (designer 2026-11-24; src/web/outro/LossOutro.tsx): a lost or conceded game, one of
 * the two at random. Both end with playDefeatResolve. The names are audio batch 3 (docs/audio-hooks.md):
 * each plays nothing until its file is uploaded.
 */
/** Signal Lost, Act 1: the hostile swarms start to pour in over the tactical display. */
export function playHostileSurge(): void {
  sfx("hostile-surge");
}
/** Signal Lost, Act 2: the command link starts to fail; the display tears and crackles with static. */
export function playSignalGlitch(): void {
  sfx("signal-glitch");
}
/** Signal Lost, Act 3: the last beacon in the middle of the display flares and goes dark. */
export function playBeaconLost(): void {
  sfx("beacon-lost");
}
/** Signal Lost, Act 3: the display collapses to a line, then a point, like an old screen switched off. */
export function playScreenCollapse(): void {
  sfx("screen-off");
}
/** Withdrawal, Act 1: the enemy's veins start to spread over the planet's night side (a low rumble). */
export function playSectorOverrun(): void {
  sfx("overrun");
}
/** Withdrawal, Act 2: the evacuation craft lift off from the surface. */
export function playEvacLaunch(): void {
  sfx("evac-launch");
}
/** Withdrawal, Act 2: hostile fire hits one evacuation craft on its way up. */
export function playCraftLost(): void {
  sfx("craft-lost");
}
/** Withdrawal, Act 3: the Flagship's jump drive starts to gather light at the prow. */
export function playJumpCharge(): void {
  sfx("jump-charge");
}
/** Withdrawal, Act 3: the jump: a white flash and the ship is gone. */
export function playJumpFlash(): void {
  sfx("jump");
}
/** Both loss outros, Act 4: the last sombre chord before the Debrief (batch 2's mission-lost). Also their still picture (reduced motion, Instant). */
export function playDefeatResolve(): void {
  sfx("mission-lost");
}

/**
 * Homecoming and Star Chart (designer 2026-11-27), two more victory outros. Both end with
 * playVictoryResolve, like the other victory outros. The names are audio batch 4 (docs/audio-hooks.md):
 * each plays as soon as its file is uploaded.
 */
export function playJumpArrival(): void {
  sfx("jump-arrival");
}
export function playEscortFlyby(): void {
  sfx("escort-flyby");
}
/** One salute burst per mission won (index of of). */
export function playSaluteBurst(_index: number, _of: number): void {
  sfx("salute-burst");
}
export function playDockingClamp(): void {
  sfx("dock-clamp");
}
/** One star per mission won ignites (index of of). */
export function playStarIgnite(_index: number, _of: number): void {
  sfx("star-ignite");
}
export function playConstellationLink(): void {
  sfx("constellation-link");
}
/** Star Chart, Act 3: the camera flies far back through the stars to the galaxy. */
export function playStarChartAscend(): void {
  sfx("chart-ascend");
}
/** Star Chart, Act 2: the star chart's rings unfold round the constellation (designer 2026-11-27, the longer Star Chart). */
export function playStarChartUnfold(): void {
  sfx("chart-unfold");
}
/** Star Chart, Act 3: the new star is born in the constellation's middle (flash, rays, shock ring). */
export function playStarChartNova(): void {
  sfx("star-nova");
}
/** Star Chart, Act 4: the wave of the Company's light crosses the galaxy; the core answers with a flare. */
export function playStarChartWave(): void {
  sfx("galaxy-wave");
}
/**
 * Mission celebrations (designer 2026-11-20, src/web/celebrate/). The kill, Alpha Down: the last
 * required Omega unit is destroyed.
 */
/** Kill, Act 1: the targeting brackets close in and lock on the unit. */
export function playTargetLock(): void {}
/** Kill, Act 2: the unit bursts into shards with a shock ring. */
export function playOmegaBreak(): void {}
/** Kill, Act 3: the count beside the Wreck goes up to the objective's number ("6 / 6"). Also the still picture (reduced motion, Instant). */
export function playKillConfirmed(): void {}
/** Alpha Purge: the pillar of light fires up from the crushed unit (the cage's lock is playTargetLock). */
export function playPurgeBeam(): void {}
/** Rail Strike (Alpha): the coils along the sight line charge, one after another. */
export function playRailCharge(): void {}
/** Rail Strike: the slug is fired (bullet time). */
export function playRailFire(): void {}
/** Rail Strike: the slug strikes and blows the unit out through its far side. */
export function playRailImpact(): void {}
/** Alpha Erased: the scan bar sweeps the unit. */
export function playEraseScan(): void {}
/** Alpha Erased: the unit's particles are unravelled on the wind. */
export function playEraseUnravel(): void {}
/** Beta Breach, Act 2: one of the Beta's three surges against the lock (index 0, 1, 2). */
export function playBetaSurge(index: number): void {
  void index;
}
/** Beta Breach, Act 3: the core breaches, white-out and fireball. */
export function playBetaDetonation(): void {}
/** Barrage (Beta): one shell of the barrage lands (index of count). */
export function playBarrageShell(index: number, of: number): void {
  void index;
  void of;
}
/** Barrage: the Beta's shield breaks under the shells. */
export function playShieldBreak(): void {}
/** Barrage: the lance of light falls from orbit and strikes. */
export function playOrbitalLance(): void {}
/** Cryo Shatter (Beta): the emitters fire and frost grows over the Beta. */
export function playCryoFreeze(): void {}
/** Cryo Shatter: the frozen Beta cracks (index 0, 1). */
export function playIceCrack(index: number): void {
  void index;
}
/** Cryo Shatter: the ice shatters, the frost wave and mist roll out. */
export function playIceShatter(): void {}
/** Event Horizon (Gamma), Act 2: the Gamma collapses into a black sphere and starts to pull. */
export function playGammaCollapse(): void {}
/** Event Horizon, Act 3: the singularity snaps to a point, then a jet of light fires up and a shock wave flips the sectors. */
export function playGammaJet(): void {}
/** Event Horizon, Act 4: one lifted sector drops back onto the board (index of count). */
export function playSectorLand(index: number, of: number): void {
  void index;
  void of;
}
/** Field Array (Gamma), Act 1: the sectors of the Field light up, ring by ring towards the Gamma. */
export function playArrayArm(): void {}
/** Field Array, Act 2: the lattice of beams closes on the Gamma and its shield breaks. */
export function playLatticeLock(): void {}
/** Field Array, Act 3: the beams cut the Gamma's column into slices. */
export function playGammaCut(): void {}
/** Dimensional Shatter (Gamma), Act 1: after the frozen moment, the Gamma's core goes critical and the tremor starts. */
export function playBossCoreCritical(): void {}
/** Dimensional Shatter, Act 2: the tile bursts into shards and time slows. */
export function playSlowMoShatter(): void {}
/** Dimensional Shatter, Act 2: the rift tears open under the shards. */
export function playDimensionalRift(): void {}
/** Dimensional Shatter, Act 3: time snaps back, the core implodes and the shock wave crosses the Field. */
export function playCataclysmShockwave(): void {}
/** Dimensional Shatter, Act 4: the wave has passed; the sector is clear. */
export function playSectorPurified(): void {}
/** The win, Mission Complete: the mission is won (8.2). */
/** Win: a Trophy that came in with the winning answer lands in the Mission bar. */
export function playTrophyLand(): void {}
/** Win, Act 2: the energy sweep crosses the Field. */
export function playWinSweep(): void {}
/** Win, Act 3: MISSION COMPLETE slams in. Also the still picture (reduced motion, Instant). */
export function playMissionComplete(): void {
  sfx("mission-complete");
}

/** Perimeter Sweep (win), Act 1: one of the Mission bar's cells ignites (index of count), a harmonic chime. */
export function onTrophyCellIgnite(index: number, of: number): void {
  void index;
  void of;
}
/** Perimeter Sweep, Act 1: the last cell overcharges and bursts. */
export function onMissionBarBurst(): void {}
/** Perimeter Sweep, Act 2: the ring of energy sweeps out over the Field. */
export function onVictoryWave(): void {}
/** Perimeter Sweep, Act 3: MISSION COMPLETE slams in. Also its still picture (reduced motion, Instant). */
export function onVictoryBannerSlam(): void {
  sfx("mission-complete");
}
/** Perimeter Sweep, Act 3: a stamped badge lands (index of count). */
export function onBadgeDrop(index: number, of: number): void {
  void index;
  void of;
}
/** Perimeter Sweep and Sector Flip, Act 4: the overlay fades into the Upgrade sheet (or the next screen). */
export function onUpgradeSheetOpen(): void {}
/** Sector Flip (win), Act 1: the last Trophy cell pulses and locks in. */
export function onAltWinTrophyLock(): void {}
/** Sector Flip, Act 2: a sector lifts off the board (index of count). */
export function onSectorLift(index: number, of: number): void {
  void index;
  void of;
}
/** Sector Flip, Act 2: a sector slams back down (index of count). */
export function onSectorSlam(index: number, of: number): void {
  void index;
  void of;
}
/** Sector Flip, Act 3: the Debrief card enters. Also its still picture (reduced motion, Instant). */
export function onAltWinDebrief(): void {
  sfx("mission-complete");
}
/** Chain Surge (win), Act 1: the bolt from the Mission bar strikes the first sector. */
export function onSurgeStrike(): void {}
/** Chain Surge, Act 2: the surge leaps into a sector (index of count; several may come close together). */
export function onSurgeLeap(index: number, of: number): void {
  void index;
  void of;
}
/** Chain Surge, Act 3: the charge climbs back to the Mission bar, which turns gold. */
export function onSurgeUplink(): void {}
/** Beacon Spiral (win), Act 2: a beam strikes a sector (index of count, the edge of the Field first). */
export function onBeaconStrike(index: number, of: number): void {
  void index;
  void of;
}
/** Beacon Spiral, Act 3: the pillar of light fires up from the middle of the Field. */
export function onBeaconPillar(): void {}
/** Resonance (win), Act 1: the drop of light falls from the Mission bar. */
export function onResonanceDrop(): void {}
/** Resonance, Act 2: a drop splashes into the Field (index 0 the first, 1 the answering drop). */
export function onResonanceSplash(index: number): void {
  void index;
}
/** Resonance, Act 3: the whole Field rings, one beat (index of count, louder each time). */
export function onResonancePulse(index: number, of: number): void {
  void index;
  void of;
}
/** Resonance, Act 3: the Field locks flat and the lattice lights. */
export function onResonanceLock(): void {}
/** Murmuration (win), Act 1: the drones pour out of the Mission bar. */
export function onSwarmRelease(): void {}
/** Murmuration, Act 2: the swarm claims a sector (index of count). */
export function onSwarmClaim(index: number, of: number): void {
  void index;
  void of;
}
/** Murmuration, Act 3: the drones form the emblem and it flares. */
export function onSwarmForm(): void {}
/** Murmuration, Act 4: the emblem bursts. */
export function onSwarmBurst(): void {}

/** Salvage: the fifth Power Node ignites (Grid Online). */
export function playGridOnline(): void {}
/** Salvage: the beams reach the other Cleared sectors (Sector Lock). */
export function playClearedLink(): void {}
/** Salvage: the three Cleared sectors lock (Sector Lock). */
export function playSectorLock(): void {}
/** Fusion Ignition: a confinement ring gathers round the Power Node (index 0-2). */
export function playFusionRing(index: number): void {
  void index;
}
/** Fusion Ignition: the node ignites into a small sun. */
export function playFusionIgnite(): void {}
/** Fusion Ignition: the fifth star closes the ring. */
export function playFusionStar(): void {}
/** Charge Cascade: a charge cell lights (index 0-3: the Power Nodes already taken). */
export function playCascadeCell(index: number): void {
  void index;
}
/** Charge Cascade: the fifth cell locks and the cells flare one by one. */
export function playCascadeLock(): void {}
/** Charge Cascade: the cells discharge into the sector. */
export function playCascadeDischarge(): void {}
/** Claim Markers: the claim stake strikes the sector. */
export function playClaimStake(): void {}
/** Claim Markers: an arch reaches another Cleared sector and its marker wakes (index 0, 1). */
export function playClaimLink(index: number): void {
  void index;
}
/** Claim Markers: the three claims lock together. */
export function playClaimLock(): void {}
/** Terrain Survey: the ping. */
export function playSurveyPing(): void {}
/** Terrain Survey: the sweep passes a Cleared sector and it answers (index: which pass, 0 or 1). */
export function playSurveyBlip(index: number): void {
  void index;
}
/** Terrain Survey: brackets snap round the three Cleared sectors. */
export function playSurveyLock(): void {}

/** Singularity (win), Act 1: a cell of the Mission bar sends its thread of light into the Field (index of count). */
export function onSingularityFeed(index: number, of: number): void {
  void index;
  void of;
}
/** Singularity, Act 2: the board starts to fall into the well. */
export function onSingularityPull(): void {}
/** Singularity, Act 3: the nova; the tiles are flung back and the bar turns gold. */
export function onSingularityNova(): void {}
/** Armillary (win), Act 1: an orb leaves the Mission bar to draw its ring (index of count). */
export function onArmillaryLaunch(index: number, of: number): void {
  void index;
  void of;
}
/** Armillary, Act 2: the three rings start to tumble through the Field. */
export function onArmillarySpin(): void {}
/** Armillary, Act 3: the rings lock as one halo and the bar turns gold. */
export function onArmillaryLock(): void {}
/** Aurora (win), Act 1: night falls and the first curtain unfurls. */
export function onAuroraRise(): void {}
/** Aurora, Act 2: a curtain of light begins to fold down across the Field (index of count). */
export function onAuroraCurtain(index: number, of: number): void {
  void index;
  void of;
}
/** Aurora, Act 3: the rays meet in the crown and the bar turns gold. */
export function onAuroraCrown(): void {}
/** Circuit Trace (win), Act 1: the pulse from the Mission bar strikes the board's corner. */
export function onCircuitEntry(): void {}
/** Circuit Trace, Act 2: a sector's last edge closes and it powers up (index of count, in order). */
export function onCircuitPower(index: number, of: number): void {
  void index;
  void of;
}
/** Circuit Trace, Act 3: the whole circuit locks gold. */
export function onCircuitLock(): void {}
