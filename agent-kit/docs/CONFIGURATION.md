# Configuration

FastCut has no config file. Every setting is part of the in-memory project, which the user changes in the editor. A reload resets every setting to its default (see ROADMAP item "Autosave the project").

Deployment settings live in `vercel.json` (Vite build, output `dist/`).

## Fields

| Field | Type | Default | Use |
|---|---|---|---|
| `mode` | `'layout' \| 'montage'` | `'layout'` | Layouts or Fast edits. |
| `format.shape` | `'auto' \| '16:9' \| '9:16' \| '1:1' \| '4:5' \| 'custom'` | `'auto'` | Video shape. Auto follows the template or style. |
| `format.quality` | `720 \| 1080 \| 2160` | `1080` | Short side in pixels. |
| `format.customW` / `customH` | number | `1280` / `720` | Custom size, clamped to 240–3840, rounded to even. |
| `template` | Template | Center Stage | Layout in Layouts mode. |
| `background` | color | `#0f0f14` | Layouts background. |
| `radius` | 0–1 | `0.5` | Box corner rounding. |
| `caption.text` / `style` / `pos` | string / enum / enum | `''` / `classic` / `bottom` | Layouts caption. |
| `loopShort` | boolean | `true` | Loop shorter clips in Layouts. |
| `imageSeconds` | 2–30 | `5` | Length when only photos are placed. |
| `musicId` | clip id | `null` | The song. |
| `musicVolume` | 0–1 | `0.6` | Song volume. |
| `musicStart` | seconds | `0` | Where in the song the video starts. |
| `musicFadeIn` / `musicFadeOut` | boolean | `true` / `true` | 1.5 s fade in, 2 s fade out. |
| `duck` | boolean | `true` | Song at 30 % while the talking clip plays. |
| `clipVolume` | 0–1.5 | `1` | Clip sound (Layouts) or voice (Fast edits). |
| `overlays[]` | Overlay | `[]` | Motion graphics: kind, text, start, duration, color. |
| edit `styleId` | style id | `highlight` | Fast edits style. |
| edit `voiceId` / `voiceMode` | clip id / enum | `null` / `intro` | Talking clip; shown first or as voice-over. |
| edit `script` | string | `''` | Words on screen. Lines become phrases. |
| edit `speed` | 0.4–1.8 | `1` | Pace multiplier (Insane–Chill). |
| edit `length` | 4–60 s | `12` | Montage length without a voice-over. |
| edit `filter` | filter id or `null` | `null` (style default) | Color look. |
| edit `handle` | string | `''` | End card text; empty means no end card. |
| edit `onBeat` | boolean | `true` | Cut on the song's beat. |
