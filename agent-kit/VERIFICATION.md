# VERIFICATION.md — one command answers "is this repo healthy"

`npm run verify` runs, in order:

1. Lint / format check — `npm run lint`
2. Build — `npm run build`
3. Tests — `npm test`
4. <repo-specific gates — one script per gate, each independently runnable>

## Rules

- CI runs **the same command** as local. No CI-only logic.
- A gate that can't run in some environment **skips loudly**, never
  passes silently.
- New behavior lands with its gate in the same PR whenever feasible.
- A feature's completion promise (ROADMAP.md) should be backed by a gate
  here whenever it can be — evidence that keeps proving itself beats
  evidence produced once.
- Fixing a flaky or broken gate is always in scope, for any task.
