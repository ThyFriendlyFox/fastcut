# Architecture

FastCut is a single-page web app (React + TypeScript, built with Vite) that edits and exports video entirely in the browser. The code has 8 parts.

| Part | Folder | Task |
|---|---|---|
| UI | `src/App.tsx`, `src/styles.css` | Panels, clip bin, menus. Holds project state. |
| Engine | `src/engine.ts` | Clock, playback sync, audio graph, canvas drawing, export. |
| Layout templates | `src/templates.ts` | Box positions per template; output size. |
| Montage planner | `src/montage.ts` | Edit styles; turns clips, beats and words into a timeline of shots and phrases. Pure. |
| Montage painter | `src/montageDraw.ts` | Draws shots, transitions, animated words and the end card. |
| Motion graphics | `src/overlays.ts` | Presets and drawing for animated overlays. |
| Beat finder | `src/beats.ts` | Song waveform, tempo and beat times. |
| Auto-captions | `src/captions.ts` | Word timestamps from speech with Whisper tiny (transformers.js). |

## Data flow

One Fast edit, from drop to file:

1. The user drops clips and an MP3. `App.addFiles()` creates media elements and gives them to `Engine.addClip()`.
2. `detectBeats()` reads the song and returns beat times and a waveform.
3. `plan()` builds a `Timeline`: shots with transitions, per-clip uses, phrases, end card.
4. `App` passes the project and timeline to `Engine.setProject()`.
5. Each frame, `Engine.tick()` advances the clock, `syncMontage()` plays or pre-seeks each clip, and `MontagePainter.draw()` paints the frame. Motion graphics draw last.
6. Export resets the clock to 0 and records the canvas plus the Web Audio mix with `MediaRecorder`.

## Engine

| File | Task |
|---|---|
| `src/engine.ts` | `Engine` class: `setProject`, `play`, `pause`, `seek`, `tick`, `draw`, `export`. |
| `src/montageDraw.ts` | `MontagePainter` used by `Engine.draw()` in Fast edits mode. |
| `src/overlays.ts` | `drawOverlay()` used by `Engine.draw()` in both modes. |

## Boundaries

| Boundary | Rule |
|---|---|
| UI ↔ Engine | UI sends a whole `Project` through `setProject`. The engine never calls `setState` except through the throttled `onTick`. |
| Planner ↔ everything | `plan()` takes plain data and returns plain data. No DOM, no media elements, no randomness. |
| Engine ↔ media | Only the engine plays, pauses or seeks media elements. |
| App ↔ network | No user media crosses. Fonts and the caption model are the only downloads. |
