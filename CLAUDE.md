# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Who Broke the Business?" — an Agentforce-powered business simulator styled as an 8-bit game.
Marketing/demo artifact for executives, not a library: pick an exec role, face five role-specific
disasters, each choice unlocks a real Agentforce capability, finale shows the agent stack absorbing
4,000 problems. See `README.md` for the pitch and `docs/GAME-DESIGN-PLAYBACK.md` for the full design
history, mechanics math, and known design problems — **read the playback doc before changing game
mechanics**; it records why previous mechanic iterations (real-time queue, stability meters, quotas)
were removed.

**Branch layout:** all code lives on `claude/who-broke-business-game-1l3hpu`; `main` contains only
the `Game Art/` source assets. Do not diff or merge against `main` expecting code history there.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build to dist/
npm run preview    # serve dist/ (defaults to port 4173; game is verified against this)
```

There is no lint or test framework. Verification is done two ways:

- **Content integrity:** `src/gameData.js` is pure ESM data — import it directly in Node to assert
  content invariants (every role has 5 challenges, every challenge has 3 choices with exactly one
  `best`, all 90 choice labels unique, power-up fields present):
  `node --input-type=module -e "import { ROLES } from './src/gameData.js'; ..."`
- **Playthroughs:** Playwright-core driving Chromium against `npm run preview`. Screens expose
  `data-testid` hooks for this (`headline`, `choice`, `outcome`, `to-powerup`, `deploy`, `face-it`,
  `simulate`, `final-score`, `replay`; title-screen buttons via `aria-label="Start game"` /
  `"How to play"`). Buttons with infinite pulse animations never become "stable" — click with
  `{ force: true }`.

## Hard constraints

- **Fully self-contained at runtime.** No CDN scripts, no runtime network requests, no
  localStorage/sessionStorage — all state in React memory. `vite.config.js` sets
  `assetsInlineLimit: 1500000` so fonts, art, and avatars inline as data URIs; the entire `dist/`
  can be flattened into one HTML file (that is how the shareable demo artifact is produced:
  inline the built CSS + JS into a single page). Do not add dependencies that fetch at runtime.
- **Legibility floors.** VT323 is unreadable small: body copy ≥ ~20px (`.txt-body` uses
  `clamp(1.35rem, 2.5vw, 1.85rem)`), choice buttons ≥ 56px tall. Press Start 2P is for headlines
  and short labels only. No scanline overlays behind body text (finale only).

## Architecture

Two source files carry everything:

- **`src/gameData.js` — all content and tuning, zero logic.** 6 roles × 5 challenges
  (headline / 3-line brief / 3 bespoke choices with quality + outcome / `lesson` ("BUT…" beat) /
  power-up mapped to a real Agentforce capability). Challenge slots follow a fixed theme order:
  signature disaster, messy data (→ Data 360), disconnected systems, technical debt, AI mishap.
  Tuning knobs at the top: `CHAOS_VOLUME` (per-challenge problem counts), `AGENT_SHARE` (fraction
  of volume each deployed agent absorbs), `CHOICE_POINTS`, `POINTS_PER_PROBLEM`. Copy and balance
  changes happen here without touching the component.
- **`src/WhoBrokeTheBusiness.jsx` — the entire game, one default-export component.** A `phase`
  string drives a state machine: `title → roleSelect → (challenge → outcome → powerup) ×5 →
  floodIntro → flood → simulate → victory`. Search `phase ===` to find a screen. Scoring: human
  choices earn flat points; on each advance the stack absorbs `volume × cumulative AGENT_SHARE`
  problems at `POINTS_PER_PROBLEM` each — that asymmetry produces the final "you vs Manual Ops
  Inc." multiple. Game-specific CSS (`.h-pixel`, `.txt-body`, `.btn-pixel`, shake/blink keyframes)
  lives in an inline `<style>` block inside the component; Tailwind (compiled via PostCSS, no CDN)
  handles layout.

### Art pipeline

- `Game Art/` (repo root) = full-resolution source art, uploaded by the owner. `src/art/` =
  compressed derivatives used by the build (`menu.jpg` title screen, `agent-bg.jpg` power-up
  backdrop, `robot.png` mascot crop).
- The title screen renders `menu.jpg` full-screen with invisible click hotspots positioned by
  percentage over the buttons *drawn in the artwork* — if the menu art changes, those hotspot
  coordinates in the `title` phase must be re-measured.
- `src/avatars/<roleKey>.png` (ceo, cfo, cto, cmo, cro, cs) are auto-wired to roles via
  `import.meta.glob` with emoji fallback; drop in a new PNG and it appears everywhere with no
  code change.

## Styling identity

Committed single-theme arcade look: Press Start 2P + VT323, palette of magenta `#ff2e9a`,
cyan `#2ee6ff`, acid green `#3bff5e`, yellow `#ffe600`, cream `#f2e8c9` on deep indigo `#160b2e`;
hard 4px borders, hard offset shadows (`shadow-[6px_6px_0_#000]`), no rounded corners. Copy voice:
specific numbers over adjectives, the player is never the joke, capabilities never overclaim.
