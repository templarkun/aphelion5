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
/** Terraformer outro, Act 4: the sun comes over the edge; the Debrief follows. */
export function playVictoryResolve(): void {}
/** Terraformer 2.0, Act 1: a pylon's braking thrusters light. `index` 0 = the first; `of` = how many pylons. (2.0 also calls the four above: doors, entering the air, each anchor lock with its beam, the sunrise.) */
export function playRetroThrust(_index: number, _of: number): void {}
