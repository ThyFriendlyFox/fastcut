# AGENTS.md — the binding contract

In effect whenever code in this repo is touched, by agent or human.
When this conflicts with intuition, this wins.

## Commands

```sh
npm run build      # build
npm test       # tests
npm run lint       # lint / format check
npm run verify     # full health gate — must pass before any push
```

Requires Node.js 20 or newer.

## Invariants — never regress these

1. **Preview = export.** The preview and the export draw through the same
   canvas code in `src/engine.ts`. Never add an export-only render path.
2. **Nothing leaves the device.** Clips and songs stay in the browser as
   blob URLs. No upload endpoint, no server rendering. The only network
   fetches are Google Fonts and the pinned caption model.
3. **The montage plan is pure.** `plan()` in `src/montage.ts` has no DOM
   access and no `Math.random`. It uses the seeded `rand()`, so the same
   input gives the same cuts in preview and export.
4. **One audio graph per media element.** `createMediaElementSource` runs
   once per element, in `Engine.route()`. Set volume with the element's
   `GainNode`, never with `element.volume` or `element.muted` after routing.
5. **Boxes are fractions.** Template boxes, pop-in boxes and frames use
   0..1 of the frame. Pixel size comes only from `outputSize()`.
6. **React never renders per frame.** The engine owns the clock and draws
   in its own `requestAnimationFrame` loop. `onTick` updates React at most
   every 100 ms.
7. **Moves are offsets, not positions.** A moved element stores `xform`
   (`dx`, `dy`, `scale`) on top of its default spot. Missing `xform` means
   the default spot, so saved projects and templates keep working when a
   default changes.

## Landmine map

<!-- Places where the obvious change is the wrong change. -->

| Area | Why it bites |
|---|---|
| `Engine.route()` | A second `createMediaElementSource` on the same element throws. Before the audio graph exists, elements must stay `muted` or they play straight to the speakers. |
| `Engine.syncMontage()` | Seeking the element that is on screen stalls the frame. The planner rotates clips and the engine pre-seeks idle clips to their next use. Keep both. |
| `Engine.export()` | `MediaRecorder` records in real time. A hidden tab throttles `requestAnimationFrame` and drops frames. |
| `src/montageDraw.ts` | Canvas text uses Google Fonts. Draw only after `document.fonts.load` resolves, or the first frames use fallback fonts. `ctx.filter` is missing in older Safari; filters must degrade to no filter. |
| `src/captions.ts` | transformers.js loads from a CDN at a pinned version. Bump the version and the model id together and test word timestamps. |
| `src/beats.ts` | Beat times are in song time. Shift them by `musicStart` before `plan()` uses them. |

## House style

- Match the surrounding code's idiom, naming, and comment density.
- No demo scaffolding, no leftover diagnostics, no dead flags.
- Comments state constraints the code can't show — never narration.
- User-facing copy states the thing plainly; no reassurance microcopy.

## Process rules

- Branch from `main`; never commit to it directly.
- `npm run verify` green before every push. Flaky gate → fix or
  quarantine in the same PR; never route around it.
- After adding/removing/renaming source files, run the stack's
  regeneration step (project gen, lockfile, tidy) and commit the result.
- Commit at boundaries; message says what changed and cites evidence.
- Docs move with behavior — same commit or PR.
- Report outcomes faithfully; failing is failing, with output.
