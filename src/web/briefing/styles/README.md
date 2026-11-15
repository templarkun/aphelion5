# Styles of the intro and the menu screens

A style is a look: an intro film, a background, colours, shapes, a confirm animation, sparks.
It never changes the layout, the words or a rule. The player switches in System options (the
gear) > Style; the choice is kept in the browser (`aphelion5.style`).

| Style | What it is |
| --- | --- |
| `intro1` | The first look (designer 2026-11-14), saved under this name: the approach to a ringed planet; bright blue glass, round buttons, holographic rings. |
| `intro2` | The capital ship (designer 2026-11-14): the Company's ship over the sunrise horizon; dark glass plates, cut corners, armour doors. The default. |

## What a style is made of

```
styles/<id>/index.ts    the style: name, accent colour, intro film, background, lock, sparks
styles/<id>/style.css   its colours (the --bf-* variables) and any .bf-* rule it wants different
styles/<id>/scene.ts    the intro film, drawn on one canvas (full ~10 s, short 1.5 s)
styles/<id>/ambient.ts  the background behind the menu panels
styles/<id>/Lock.tsx    the animation over the screen when a choice is confirmed
```

`intro2` also has `planet.ts` (the planet), `mesh.ts` (how a ship of blocks is built and drawn),
`ship.ts` (the ship itself) and `math3.ts`.

## To add a style ("intro3")

1. Copy the folder of the style nearest to what you want and rename it.
2. In its `index.ts` give it its `id`, `name` and one-line `note`.
3. In its `style.css` change `:root[data-bf-style="..."]` to the new id, then the colours.
4. List it in `STYLES` in `styles/index.ts` and import its `style.css` in `src/web/main.tsx`.

The shared sheet `../briefing.css` holds the layout and the shapes a style gets when it changes
nothing (they are the shapes first made for `intro1`). `npm run test:ui` plays every style's
intro and walks the menu in each.
