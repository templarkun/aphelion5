/**
 * Sound hooks of the command briefing, the intro and the Threat screen.
 *
 * The screens are silent for now (designer 2026-11-14): every function here is an empty place
 * that is already called at the right moment (hover, select, confirm, step change, chips, Threat,
 * launch, the intro's engines). To add real sound later, put the audio files in the project and
 * fill the bodies in, for example:
 *
 *   import selectUrl from "../../../art/audio/select.mp3";
 *   const select = new Audio(selectUrl);
 *   export function playSelect(): void { select.currentTime = 0; void select.play(); }
 *
 * Nothing else has to change: the buttons and transitions already call these.
 */

/** The pointer moved onto a button or a card. */
export function playHover(): void {}
/** A card, unit, mission or tab was chosen. */
export function playSelect(): void {}
/** A step was confirmed (Campaign, Vessel, Modules, Threat). */
export function playConfirm(): void {}
/** Back one step, or a pop-up closed. */
export function playBack(): void {}
/** The screen changes from one step to the next. */
export function playTransition(): void {}
/** A unit's information card opened. */
export function playOpenInfo(): void {}
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
 * Mission celebrations (designer 2026-11-20, src/web/celebrate/). The kill, Alpha Down: the last
 * required Omega unit is destroyed.
 */
/** Kill, Act 1: the targeting brackets close in and lock on the unit. */
export function playTargetLock(): void {}
/** Kill, Act 2: the unit bursts into shards with a shock ring. */
export function playOmegaBreak(): void {}
/** Kill, Act 3: the count beside the Wreck goes up to the objective's number ("6 / 6"). Also the still picture (reduced motion, Instant). */
export function playKillConfirmed(): void {}
/** The win, Mission Complete: the mission is won (8.2). */
/** Win: a Trophy that came in with the winning answer lands in the Mission bar. */
export function playTrophyLand(): void {}
/** Win, Act 2: the shock wave in the Company's colour sweeps across the Field. */
export function playWinShockwave(): void {}
/** Win, Act 3: MISSION COMPLETE slams in. Also the still picture (reduced motion, Instant). */
export function playMissionComplete(): void {}
