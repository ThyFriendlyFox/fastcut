# Changelog

All notable changes to FastCut are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [0.5.0] - 2026-11-02
### Added
- Drag motion graphics, the caption and the words on screen to move them. Drag a corner to resize them.
- Drag a box in Layouts to move it. Drag a corner to resize it. "Reset boxes" puts the template back.
- Yellow center lines show when an element snaps to the middle.
- "Save as my template" keeps the boxes, motion graphics, caption, background and size. In Fast edits it keeps the style setup.
- My templates are saved in this browser. "Export file" and "Import file" move them to another computer.
### Changed
- "Fit (no crop)" fills the empty space with a blurred copy of the clip instead of black.
### Removed
- Dragging one filled box onto another no longer swaps them. Dragging a box now moves it.

## [0.4.0] - 2026-11-02
### Added
- Size menu next to Export: Auto, Wide 16:9, Tall 9:16, Square 1:1, Portrait 4:5 and Custom size.
- Quality choice: 720p, 1080p or 4K. Export quality scales with the size.
- Developer gate `npm run verify`: format check, type check, build and 13 unit tests.
- Agent kit in `agent-kit/`, CI workflows and a pull request template.
### Fixed
- On phones, the preview in Fast edits now uses the style's shape instead of the template's.

## [0.3.0] - 2026-11-02
### Added
- Audio bar under the player with the song's waveform.
- Drag the pink window on the waveform to choose which part of the song plays. Cuts on the beat follow it.
- Song volume and voice / clip sound volume sliders.
- Fade in and fade out switches for the song.
- "Quieter when I talk" lowers the song while the talking clip plays.
### Changed
- Song controls moved from the side panel to the audio bar.

## [0.2.0] - 2026-11-02
### Added
- Fast edits mode with 6 styles: Highlight Reel, Motivation, Hype, Talk + Captions, Cinematic and Memories.
- Transitions: white flash, slide, slices, diagonal wipe, zoom punch, fade and pop-up boxes.
- Cuts land on the song's beat.
- Talking clip: show it first, or play its voice over the other clips.
- Auto-caption: FastCut writes out what the talking clip says, in the browser.
- Words on screen, one at a time or as phrases that build up in mixed fonts.
- Pace, color look, length and a follow end card.
- Motion tab with 10 motion graphics: Big Title, Name Tag, Follow Sticker, Glitch Text, 3-2-1, Sparkles, Confetti, Emoji Rain, Circle It and Progress Bar.
- Add an MP3 from any picker, or drop it on the page.
### Changed
- Tabs, menus and the export window animate.

## [0.1.0] - 2026-11-02
### Added
- Layouts mode with 12 templates in wide, tall and square shapes.
- Drag clips into boxes, tap a clip then a box on phones, and drag one box onto another to swap.
- Per box: sound on or off, fill or fit, and start time.
- Background color, rounded corners, a caption and a song.
- Export to MP4 in Chrome, Edge and Safari, or WebM in Firefox.
