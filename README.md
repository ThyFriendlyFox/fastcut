# FastCut

Video editing for people who have never edited a video. Live at https://fastcut-iota.vercel.app

- **Layouts:** pick a template and drag clips into its boxes.
- **Fast edits:** add clips and a song, pick a style, and FastCut cuts them on the beat with transitions and words on screen. Auto-caption reads what a talking clip says.
- **Motion graphics:** titles, name tags, stickers, confetti and more, saved into the video.
- **Audio bar:** choose the part of the song that plays, set volumes, fade in and out.
- **Size menu:** wide, tall, square, portrait or custom size, at 720p, 1080p or 4K.

Everything runs in the browser. Clips never leave your computer.

## Develop

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

`npm run verify` runs the format check, type check, build and tests. It must pass before every push.

## Project process

This repo uses the agent kit in [`agent-kit/`](agent-kit/ROUTING.md). Start with `agent-kit/ROUTING.md`.
Changes are listed in [CHANGELOG.md](CHANGELOG.md). Security reports: see [agent-kit/SECURITY.md](agent-kit/SECURITY.md).

Deploys to Vercel as a static Vite site (`vercel.json`).
