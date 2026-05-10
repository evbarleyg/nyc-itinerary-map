# Claude Code Setup

## Project Snapshot

- Vite vanilla-JS itinerary map for an NYC trip (`nyc-itinerary-map`).
- Entry: `index.html` + `src/main.js`; shared trip data in `shared/`.
- Static export under `dist/` (deploy target appears to be a static host).
- Nested directory `parents-trip-companion/` is a separate git repository (gitignored here) — do not edit through this path; open that folder directly.

## Claude Workflow

- Optimize for progress on a hobby app; keep code clean and explicit.
- Start non-trivial work by naming assumptions and a short plan.
- Make small, reviewable changes without asking first unless the change is architectural, destructive, security-sensitive, or > ~100 LOC across multiple files.
- Do not overwrite user or Codex changes in the worktree. Read dirty files before touching them.
- Prefer `rg` / `rg --files` for search.
- Use existing project patterns before adding abstractions or dependencies.

## Commands

- Dev: `npm run dev`
- Preview: `npm run preview`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm run test`
- Build: `npm run build`

## Sensitive / Generated

- `dist/`, `node_modules/`, `.vite/`, `coverage/`.
- `parents-trip-companion/` is a separate repo and is gitignored — never modify from this project.

## Final Response Shape

After code changes, include: short changelog, validation commands run (or clearly state what was not run), risks/edge cases, suggested hardening follow-ups, manual verification steps, and a clickable preview/live URL when applicable.
