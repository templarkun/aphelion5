# Audio: format, names and the first 20 sounds

Plan for the designer, 2026-11-22. Nothing plays yet: the game is silent. This file says which sounds to make first, how long each may be, and what to call the files so each one goes to its place without questions.

## Format

- **Send MP3.** Mono, 44.1 kHz, about 96 kbps for short effects (128 kbps stereo only for music, later).
- **Not WAV.** A WAV is about 10 times bigger than the same MP3. The game is one HTML file, and every sound is packed inside it as text, which adds another third to its size. Twenty short MP3s come to about 0.3 to 0.5 MB in the file; the same as WAV would be 4 to 6 MB and slow to open on a phone.
- **Not OGG.** Older iPhones and iPads do not play it. MP3 plays everywhere (iOS Safari, Android, PC).
- Speed during play is the same for any format: each sound is unpacked once when the game starts, then plays instantly.
- **No silence at the start** of a sound that must match an animation. Trim it, so the sound begins on its first moment.
- If you only have WAV, send WAV: I can convert it here.

How it gets into the game (for the record): the files go in `art/audio/`, the build packs them into `dist-artifact/aphelion5.html`, and the game unpacks them with the browser's Web Audio on the first tap (phones only allow sound after a tap).

## File names

`sfx-<name>.mp3`, using the names in the table below exactly, in lower case.

- Several versions of one sound, played at random so it does not get repetitive: `sfx-<name>-2.mp3`, `sfx-<name>-3.mp3`.
- A replacement: send it with the same name; the new one wins.

## The first 20

"Fixed" means the sound must fit the animation's length (in seconds, measured from the game's code). "Free" means any length the AI chooses is fine; keep it short anyway.

Common style for every prompt (add it to each): *sci-fi tactical board game, clean and punchy, no music, no voice, mono.*

| # | File name | When it plays | Length | Prompt |
|---|---|---|---|---|
| 1 | `sfx-tap` | You choose an answer, a unit, a sector or a button | Fixed, 0.1 s | A short soft digital click, like a premium touchscreen button, crisp with a tiny high blip. |
| 2 | `sfx-back` | Back, cancel, or a pop-up closes | Fixed, 0.15 s | A short soft descending digital click, slightly lower and duller than a confirm click. |
| 3 | `sfx-popup` | A card or pop-up opens (unit info, choices, Ally card) | Free, about 0.3 s | A quick airy holographic panel opening: a soft rising shimmer with a light glassy tick at the end. |
| 4 | `sfx-move` | A unit slides one sector (repeats per sector on longer moves) | Fixed, 0.35 s | A short smooth servo glide of a heavy metal piece sliding across a table-sized hex board, soft whoosh with a faint mechanical hum. |
| 5 | `sfx-mecha-land` | A Mecha stops after moving and dust puffs from under it | Fixed, 1.1 s | A heavy mech robot foot settling onto dusty ground: a short low thud at the very start, then a soft gritty hiss of dust spreading and fading out. |
| 6 | `sfx-reveal` | A Dark sector's tile flips face up | Fixed, 0.45 s | A quick card-flip of a thick metal tile, a sharp flip swish ending on a bright digital "ping" as the hidden unit appears. |
| 7 | `sfx-reveal-omega` | A big unit (Omega) is revealed: charge, then flip | Fixed, 1.4 s | An ominous power build-up: low rising electrical charge for the first 0.6 s, then a heavy metallic flip and a deep menacing boom-chime that rings out. |
| 8 | `sfx-laser` | A Bay or Order fires its laser at a unit | Fixed, 0.38 s | A thin bright sci-fi laser beam shot, very fast attack, a sizzling high tone that cuts off cleanly. |
| 9 | `sfx-hit` | A hit lands and Damage is placed on a unit | Free, about 0.3 s | A sharp armour impact: a metallic crunch with a small spark crackle, punchy and short. |
| 10 | `sfx-shield-block` | A hit is taken by a Shield, or stopped by a Barrier | Free, about 0.3 s | An energy shield absorbing a hit: a bright glassy "thwum" with a quick electric ripple, no crunch. |
| 11 | `sfx-destroyed` | A unit is destroyed and bursts into pieces | Fixed, 0.7 s | A compact sci-fi explosion of a small war machine: punchy blast at the start, metal fragments scattering, short tail. Not a big cinematic boom. |
| 12 | `sfx-mecha-attack` | A Mecha charges at a target and bursts there | Fixed, 0.76 s (impact at 0.34 s) | A heavy mech lunging forward: a short rising servo-and-thruster charge for 0.34 s, then a hard metal ramming impact that rattles out. |
| 13 | `sfx-flagship-hit` | Your Flagship takes damage and the screen shakes | Fixed, 0.55 s | A big starship hull being struck: a deep booming metallic impact with a shuddering low rumble, felt more than heard. |
| 14 | `sfx-energy` | One energy goes onto a Module | Free, about 0.25 s | A small energy cell snapping into a socket: a bright soft electric zap with a click, satisfying and light. |
| 15 | `sfx-shield-up` | A Shield or Bio-shield forms round a unit, or Damage is repaired | Fixed, 0.26 s | A quick rising energy shimmer as a hexagonal force bubble forms, soft and bright. |
| 16 | `sfx-overload-start` | Overload begins: the Field tints red and a ripple crosses it | Fixed, 0.8 s | A reactor going into overload: a deep alarm-like power surge swelling from the centre outward, red-alert energy hum, tense. |
| 17 | `sfx-end-button` | You press the Overload End button and it bursts into sparks and a shock ring | Fixed, 0.38 s | A small sun-like energy orb popping: a bright crackling spark burst with a quick airy shock-ring whoomp. |
| 18 | `sfx-overload-end` | Overload ends: the ripple runs back in and the red fades | Fixed, 0.8 s | A reactor powering down safely: a falling energy sweep that pulls inward and settles into a calm low hum, relief. |
| 19 | `sfx-ally-drop` | Allied Drop: the Ally's Mecha falls onto its sector | Fixed, 1.5 s (landing at 0.5 s) | A mech dropped from orbit: a fast descending whistle for 0.5 s, a heavy ground-shaking landing slam, then rolling dust and debris settling for one second. |
| 20 | `sfx-mission-complete` | MISSION COMPLETE slams onto the screen | Free, about 2 s | A triumphant sci-fi victory sting: a big bright impact chord with a shimmering rising tail, heroic but short. |

Fixed lengths come from the code at Round 29 (moves 0.35 s per sector in `FieldView.tsx`; landing dust 1.1 s and Allied Drop 1.5 s in `eventFx.ts`; reveal flip 0.45 s; Overload ripple 0.8 s; End button burst 0.38 s in `EndOverload.tsx`; laser 0.38 s in `weapons.ts`; destroy burst 0.7 s; Mecha attack 0.76 s; Flagship shake 0.55 s; Shield bubble 0.26 s). If an animation's timing changes later, the sound still plays from its start; a small mismatch is fine.

## Already in place for later

The briefing, intro, outro films and mission celebrations already have empty sound places in `src/web/briefing/soundHooks.ts` (about 60 of them: hover, chips, Threat level, engine hum, every celebration act). They are the next batches. The Field sounds above get the same kind of place when the files arrive.

Still to make after these 20 (next batch): mission lost, teleport, swap, Wreck, missile and the other weapon looks, Fuse going off, Sleeper waking, Gyro drained, Alert fizzle, Meltdown, Overhaul, turn, Boost.
