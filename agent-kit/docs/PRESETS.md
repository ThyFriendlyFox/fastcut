# Presets

A preset is a ready-made look the user picks with one click. FastCut has 3 kinds of preset. Each kind is a plain array, and the UI lists every entry automatically.

## Layout templates

`TEMPLATES` in `src/templates.ts`. 12 templates. Each has an `id`, a `name`, a native `aspect` and `regions` (boxes as 0..1 fractions of the frame). Center Stage is first and is the default.

```ts
{ id: 'side-by-side', name: 'Side by Side', aspect: '16:9', regions: [{ x: 0.02, y: 0.12, w: 0.47, h: 0.76 }, /* … */] }
```

## Edit styles

`EDIT_STYLES` in `src/montage.ts`. 6 styles. Each sets the frame (`full`, `card`, `letterbox`), the cut rate (`cutEvery`, `beatsPerCut`), the transition cycle, the color filter, the word style (`pop` or `kinetic`) and whether the talking clip gets jump zooms.

```ts
{ id: 'hype', name: 'Hype', aspect: '9:16', frame: 'full', cutEvery: 0.45, beatsPerCut: 1,
  transitions: ['zoom', 'flash', 'cut', 'zoom', 'slices'], filter: 'vivid', text: 'pop', textColor: '#ffd23f', punch: true }
```

## Motion graphics

`PRESETS` in `src/overlays.ts`. 10 graphics. Each has a `kind`, a default text, duration and color. `full: true` makes it span the whole video.

## Writing a new preset

- **Template:** add an entry to `TEMPLATES`. Keep every box inside 0..1 — `src/templates.test.ts` checks it.
- **Edit style:** add an entry to `EDIT_STYLES` and a preview gradient class `.style-prev.<id>` in `src/styles.css`. Use only existing transition and filter kinds, or add the new kind to `TRANSITION_TIME` / `FILTERS` and draw it in `MontagePainter.draw()`.
- **Motion graphic:** add the kind to `OverlayKind`, an entry to `PRESETS`, and a `case` in `drawOverlay()`. Fade out in the last 0.3 s with `outP`. Use `rnd(seed + i)` for randomness, never `Math.random`.
- Every new preset gets a line in CHANGELOG.md and, if user-facing behavior changed, a case in `docs/USE-CASES.md`.
