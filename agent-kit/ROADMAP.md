# ROADMAP.md — the source of all work

**This file is not optional.** Every feature the agent builds flows down
from here. If it isn't on this roadmap, it doesn't get built; if it needs
building, it gets added here first. One item ships per weekly cycle
(see `WEEKLY.md`).

## North star

FastCut is the video editor for people who have never edited a video.
A person picks a template or a style, adds clips and a song, and exports
a video that looks hand-edited. Everything runs in the browser, so clips
never leave the device and the site costs nothing to run.

## Feature Queue — ordered; top unblocked item ships next

provisional: true — the agent seeded this order at install time. The human re-orders it.

### 1. Autosave the project
- **Promise:** Reloading the page restores the last project: clips, song, mode, settings and motion graphics.
- **Evidence:** A Playwright test adds 3 clips, a song and 1 motion graphic, reloads, and finds all of them in place.
- **Use case:** All cases — a lost tab today loses all work.
- **Scope guard:** One project per browser. No accounts, no sync, no project list.
- **Status:** ready

### 2. Faster export
- **Promise:** A 30 s 1080p Fast edit exports in under 15 s in Chrome, and its frames match the preview.
- **Evidence:** A Playwright timing run plus a frame comparison at 5 timestamps.
- **Use case:** Pet highlight reel; Hype clip on the beat.
- **Scope guard:** Chrome and Edge only (WebCodecs). Other browsers keep real-time export.
- **Status:** ready

### 3. Trim clips in Fast edits
- **Promise:** Each clip in Fast edits has start and end handles, and the plan uses only frames inside them.
- **Evidence:** A unit test on `plan()` and a screenshot of the handles.
- **Use case:** Motivation edit with a voice-over.
- **Scope guard:** No frame-accurate timeline. Handles live on the clip card.
- **Status:** ready

## Later — candidates, not yet specced

- Text behind the subject — the big-title-behind-the-cat look from the reference edit; needs person/pet segmentation.
- Undo and redo — beginners click the wrong thing often.
- Caption colors per word — highlight the word being spoken.
- More motion graphics — arrows, speech bubbles, subscribe button.

## Shipped

| Week | Feature | Release | Evidence |
|---|---|---|---|
| 2026-11-02 | Video size menu (shape, quality, custom) | 0.4.0 | Custom 1000×1000 export decodes at 1000×1000; `outputSize` unit tests |
| 2026-11-02 | Audio bar (song section, volumes, fades, ducking) | 0.3.0 | Song plays from 17.5 s at video 1.5 s with the window at 16 s (Playwright) |
| 2026-11-02 | Fast edits, motion graphics, MP3 songs | 0.2.0 | 120 BPM detected on a 120 BPM track; MP4 export with overlays (Playwright) |
| 2026-11-02 | Layout templates and MP4 export | 0.1.0 | MP4 export from 5 clips in Chromium (Playwright) |

## Explicitly not doing

- Server-side rendering or uploads — it breaks the privacy promise and adds hosting cost.
- Copying a specific app's templates or branding — FastCut ships its own styles.

## Queue changes

- 2026-11-02 — Seeded the queue at kit install. Order is provisional until the human ranks it.
