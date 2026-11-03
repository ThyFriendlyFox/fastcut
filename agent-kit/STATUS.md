# STATUS.md — where the project actually stands

The single source of truth for project state. Claims require evidence: a
passing gate, a linked run, a tag. Updated in the same commit as the
behavior change. The weekly cycle (WEEKLY.md step 5) refreshes it.

| Area | State | Evidence |
|---|---|---|
| Layouts mode (12 templates) | ✅ | Playwright export from 5 clips; template bounds unit test |
| Fast edits (6 styles, beat cuts) | ✅ | `src/montage.test.ts` 9 tests; Playwright MP4 export |
| Auto-captions (in-browser Whisper) | ✅ | Model downloads and runs in Chromium (Playwright); no unit test |
| Motion graphics (10) | ✅ | Frames show overlays in preview and export (Playwright screenshots) |
| Audio bar | ✅ | Song position follows the chosen window (Playwright) |
| Video size menu | ✅ | `src/templates.test.ts`; custom 1000×1000 export |
| Drag and resize on the video | ✅ | `src/elements.test.ts`; Playwright drag of box, sticker and caption |
| My templates (save, apply, file) | ✅ | Playwright: saved template survives reload and restores positions |
| Verify gate | ✅ | `npm run verify` green: 17 tests, 0 failures |
| CI workflows | 🚧 | Added in `.github/workflows/`; first run pending on the PR |
| Release tags | ❌ | Versions 0.1.0–0.4.0 are in CHANGELOG.md; no git tags cut yet |
| Browser support | 🚧 | Tested in Chromium only. Safari and Firefox are untested. |

States: ✅ done (gated) · 🚧 in progress · ❌ not started · 🧊 frozen/won't do.

## Current week

- **Shipping:** between cycles — next is "Autosave the project".
- **Last release:** 0.5.0 — 2026-11-02 (deployed to https://fastcut-iota.vercel.app; not tagged)
- **Known red:** none
