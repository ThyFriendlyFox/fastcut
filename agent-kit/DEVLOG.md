# DEVLOG.md — the live devlog

The plain history of this project. A person who knows nothing about the
code reads this file and knows what happened, in order, with no jargon.
Append only. Never rewrite an old entry — a wrong entry gets a
correction entry, not an edit.

Write every entry in the voice of `TONE.md`.

## Entry shape

Every entry has the same shape:

```
## YYYY-MM-DD — <one line: what happened>

<What we did. What worked. What broke. What we learned.
3–10 short sentences. Plain words. Past tense for what happened,
present tense for how things now stand.>

Evidence: <commit / tag / gate run / screenshot>
```

## When to write

- Every WEEKLY.md cycle writes one entry at step 5 (before merge).
- A failed or abandoned attempt gets an entry too. The devlog records
  what happened, not what succeeded. A week with no shipped feature
  still gets its entry.
- Out-of-band work (security patch, gate repair, big triage) gets one.
- SETUP.md writes the first entry: "Installed the agent kit."

## What does not go here

- Code detail that belongs in commit messages.
- Promises about the future — that is ROADMAP.md.
- State claims — that is STATUS.md. The devlog is the story; STATUS is
  the snapshot.

---

<!-- Entries below, newest first. -->

## 2026-11-02 — Added drag, resize and my templates

The owner asked to grab elements on the video, drag them and resize them.
Then the owner asked to save the result as a template.
I added a move-and-resize layer over the video for boxes, motion graphics, the caption and the words on screen.
Each element keeps its default spot plus an offset and a scale, so old projects still draw the same.
Dragging a box now moves it. That replaced box swapping, which used the same gesture.
Saved templates live in the browser's local storage. A file export moves them between computers.
I also changed "Fit" to fill the empty space with a blurred copy of the clip, as in the owner's screenshot.

Evidence: Playwright drag test; `npm run verify` green with 17 tests

## 2026-11-02 — Installed the agent kit

I installed the agent kit in `agent-kit/` and filled every placeholder.
FastCut is a browser video editor for beginners, built with React and Vite.
I added `npm run verify`: format check, type check, build and unit tests.
The first run passed with 13 tests and 0 failures.
I added CI, nightly, release and stale workflows, plus Dependabot.
The roadmap queue holds Autosave, Faster export and Trim clips.
The order is provisional until the owner ranks it.
I wrote CHANGELOG.md with the real versions, all dated today, because all the work happened today.

Evidence: `npm run verify` green on branch `claude/nifty-keller-kpcbtw`

## 2026-11-02 — Added a size menu

The owner asked for a way to change the video size.
I added shapes (Wide, Tall, Square, Portrait 4:5, Custom) and qualities (720p, 1080p, 4K).
The export bitrate now scales with the pixel count.
I found a bug on the way: the phone preview used the template shape in Fast edits. I fixed it.

Evidence: a custom 1000×1000 export decoded at 1000×1000 in Chromium; commit f2ba439

## 2026-11-02 — Added the audio bar

The owner asked for an easy way to change the audio.
I added a waveform with a draggable window that picks the part of the song that plays.
Beat cuts follow the window. I added volumes, fades and ducking under the talking clip.
My first test could not read the song position, because the audio element is not in the page.
I exposed the engine as `window.fastcut` to check it.
The song played from 17.5 s at video time 1.5 s with the window at 16 s, as planned.

Evidence: commit 6b0ddf2; Playwright audio test

## 2026-11-02 — Added Fast edits and motion graphics

The owner sent 2 reference edits. I read them at 5 frames per second.
They cut every 0.2–1.5 s and use white flashes, slides, pop-up boxes and word-by-word captions.
I built a planner that turns clips, beats and words into shots, and a painter that draws them.
Beat detection found 120 BPM on a 120 BPM test track.
Auto-captions run Whisper tiny in the browser; the model downloads once.
The owner then asked for motion graphics and MP3 songs. I added 10 motion graphics and the Motion library for UI animation.
I did not build text behind the subject. It needs segmentation, so it went to the roadmap.

Evidence: commit 61f4b53; Playwright export with overlays

## 2026-11-02 — Built and deployed the first version

The owner sketched a frame with 5 boxes and asked for an editor for beginners.
I built Layouts mode: 12 templates, drag clips into boxes, export.
All rendering happens on a canvas in the browser, so clips never leave the device.
Switching templates dropped the clip in the main box. I fixed it so the biggest box keeps its clip.
I deployed to Vercel. The repo had no `main` branch, so I created one with an empty commit to open the pull request.
A force push was blocked, so I merged instead of rebasing.

Evidence: https://fastcut-iota.vercel.app; ThyFriendlyFox/fastcut#1
