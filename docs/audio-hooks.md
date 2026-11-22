# Audio: format, names and the first 20 sounds

Plan for the designer, 2026-11-22. This file says which sounds to make, how long each may be, and what to call the files so each one goes to its place without questions.

**Status (2026-11-22, evening):** batch 1 is in the game (58 files, 19 of the 20 names). Missing: `sfx-energy` (moved to batch 2). Upload your files to `art/` on the branch, any MP3 or WAV: `npm run build:audio` makes small copies in `art/audio/` (one channel, 96 kbps, silence cut from both ends), and only those go into the game. Volumes: Menu (in the game) and System options (Command Deck) > Sound: Sound effects, Ambient sound, Music.

## Format

- **Send MP3.** Mono, 44.1 kHz, about 96 kbps for short effects (128 kbps stereo only for music, later).
- **Not WAV.** A WAV is about 10 times bigger than the same MP3. The game is one HTML file, and every sound is packed inside it as text, which adds another third to its size. Twenty short MP3s come to about 0.3 to 0.5 MB in the file; the same as WAV would be 4 to 6 MB and slow to open on a phone.
- **Not OGG.** Older iPhones and iPads do not play it. MP3 plays everywhere (iOS Safari, Android, PC).
- Speed during play is the same for any format: each sound is unpacked once when the game starts, then plays instantly.
- **No silence at the start** of a sound that must match an animation. Trim it, so the sound begins on its first moment.
- If you only have WAV, send WAV: I can convert it here.

How it gets into the game (for the record): your uploads stay in `art/` as the masters; `npm run build:audio` writes the small copies to `art/audio/`; the build packs those into `dist-artifact/aphelion5.html` (about 0.6 MB for batch 1), and the game unpacks them with the browser's Web Audio on the first tap (phones only allow sound after a tap). Code: `src/web/sound.ts` (player, volumes), hooks in `FieldView.tsx`, `EndOverload.tsx`, `App.tsx` (taps, pop-ups) and `briefing/soundHooks.ts`.

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

### Where batch 1 plays (as built)

- `tap`: any button in the game screen, and select / confirm on the Command Deck. `back`: Back on the Command Deck. `popup`: a unit's or sector's pop-up, and information cards on the Command Deck.
- `move`: a slide (once per move or walk, also a swap; not a teleport). `mecha-land`: a Mecha landing after a move. `mecha-attack`: a Mecha's charge.
- `reveal`: every flip; `reveal-omega`: an Omega's. Your `reveal-omega` files had 6 to 8 s of silence after 1.5 s of sound: the silence is cut.
- `laser`: every shot of a Bay, Order or Module (missiles and rail slugs too, until batch 2's own sounds). Units' own shots are still silent.
- `hit` / `shield-block` (all of the hit taken by Shields, or a Barrier): each hit. Many at once (an Order on every unit): at most three, a little quieter.
- `destroyed`: each unit destroyed (a Wreck: quieter). `flagship-hit`: when the Flagship panel shakes. `shield-up`: Shield, Bio-shield, repair.
- `overload-start`, `overload-end`, `end-button` (on the press), `ally-drop`, `mission-complete` (when the banner slams, every win).

## Batch 2 (designer 2026-11-22)

Same rules as batch 1: names exactly as below, `-2`, `-3` for versions, trim silence at the start of timed ones. Add the common style to each prompt.

| # | File name | When it plays | Length | Prompt |
|---|---|---|---|---|
| 1 | `sfx-energy` | One energy token flies onto a Module (from batch 1) | Fixed, 0.4 s (lands at the end) | A small energy cell whooshing a short way and snapping into a socket: a quick airy zip that ends in a bright soft electric click. |
| 2 | `sfx-missile` | An Order fires its missile | Fixed, 0.56 s (impact at 0.35 s) | A small guided micro-missile launch: a sharp ignition hiss and a short rising rocket whoosh, ending abruptly (the impact is a separate sound). |
| 3 | `sfx-rail` | A Bay (other than V1's first) fires its rail slug | Fixed, 0.42 s (impact at 0.21 s) | A compact railgun shot: an electric capacitor snap and a hard supersonic crack, metallic and dry. |
| 4 | `sfx-unit-shot` | A unit's own attack fires (Sentinel plasma, Sleeper needle, Gyro disc...) | Fixed, 0.45 s | An alien machine firing a short energy bolt: a buzzing, slightly organic electric zap with a hostile tone, short. |
| 5 | `sfx-teleport` | A unit teleports | Fixed, 0.4 s | A quick sci-fi teleport: a shimmering upward sweep that collapses into a soft pop as the unit reappears. |
| 6 | `sfx-wreck` | A Mecha (or Omega) is destroyed but stays as a Wreck, smoke rising | Fixed, 0.5 s | A heavy machine shutting down broken: a short metallic crunch and groan, a hiss of escaping steam, a dying power-down whine. |
| 7 | `sfx-boost` | A unit gets a Boost (gold light, +1) | Fixed, 0.45 s | A bright power-up: a quick rising golden chime with a warm electric swell, positive and punchy. |
| 8 | `sfx-barrier` | A Barrier force field drops onto a unit | Fixed, 0.32 s | A force field snapping into place: a low resonant electric hum that clicks on with a glassy shimmer. |
| 9 | `sfx-fuse` | A Fuse token goes off on a unit | Fixed, 0.56 s | A small time-fuse charge going off: a fizzing spark crackle for a moment, then a sharp compact detonation. |
| 10 | `sfx-sleeper-wake` | A Sleeper wakes, or its Alert is resolved | Fixed, 0.75 s | Something dormant and alien waking: a low breathing electrical hum that swells, with a faint eerie rising tone. |
| 11 | `sfx-gyro-drain` | A Gyro is drained of its energy | Fixed, 0.95 s | A spinning gyroscope power core being drained: a whirring spin that winds down in pitch while energy is sucked away with a soft vacuum whoosh. |
| 12 | `sfx-fizzle` | An Alert goes off but does nothing (weak sparks, grey smoke) | Fixed, 0.9 s | A misfire: a few weak sputtering electric sparks, a tiny failing whine and a soft puff of smoke. Slightly comic but not silly. |
| 13 | `sfx-heat` | Heat tokens gained or paid back | Free, about 0.4 s | A short hot pulse: a soft flame-like whoomp with a metallic tick, like heat venting from a reactor. |
| 14 | `sfx-meltdown` | Meltdown: no Heat token left, the card appears | Free, about 1.5 s | A reactor meltdown warning: a deep distorted alarm blare with a groaning metal overload and a rumbling surge. |
| 15 | `sfx-overhaul` | Overhaul: repair sparks run over the Flagship panel | Fixed, 0.8 s | A quick starship repair sequence: ratcheting servo tools, a few welding sparks and a rising systems-online chime at the end. |
| 16 | `sfx-gate` | The blast doors of the logo gate (confirm Campaign / Vessel, Launch, each preparation screen) | Fixed, 2.2 s | Heavy armoured blast doors slamming shut with a deep metal boom at the very start, a humming energy lock building in the middle, then the doors grinding open with a hydraulic hiss at the end. |
| 17 | `sfx-upgrade` | An Upgrade point lands on a card of the Upgrade sheet | Free, about 0.5 s | A satisfying upgrade install: a solid mechanical click-lock with a short bright rising synth sparkle. |
| 18 | `sfx-mission-lost` | The game is lost or conceded (the Game over card) | Free, about 2.5 s | A sombre sci-fi defeat sting: a low falling synth tone with a distant failing engine and fading radio static. Dignified, not cartoonish. |
| 19 | `ambient-field` | Under the whole game, quietly, while the Field is shown (Ambient sound slider) | Loop, 30 to 60 s | A calm deep-space command bridge ambience: soft low engine hum, faint distant electronics and air vents, very subtle, no melody, seamless loop. |
| 20 | `music-menu` | The Command Deck menus (Music slider) | Loop, 1 to 2 min | Atmospheric orchestral-electronic sci-fi menu music: slow and confident, warm synth pads, soft pulse, a distant heroic brass motif, seamless loop, no vocals. |

Ambient and music must loop without a gap: ask the AI for a "seamless loop" and send one file each (versions are fine too). They play only once their files arrive; the sliders are already there.

## Already in place for later

The briefing, intro, outro films and mission celebrations already have empty sound places in `src/web/briefing/soundHooks.ts` (about 60 of them: hover, chips, Threat level, engine hum, every celebration act). They are the next batches. The Field sounds above get the same kind of place when the files arrive.

Still to make after batch 2: a unit turning, hover, the intro's engines, the outros' and celebrations' acts, more music (in the game, the Overload).
