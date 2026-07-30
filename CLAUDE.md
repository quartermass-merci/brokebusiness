# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Who Broke the Business?" — an Agentforce-powered business simulator styled as an 8-bit game.
Marketing/demo artifact for executives, not a library. Current build is the **v7 roguelite cut**:
pick an exec role, survive four 40-second quarters of real-time ticket floods (click-and-hold
1.2s to clear one yourself), draft one Agentforce agent between quarters, then face the year-end
audit: 4,000 problems your stack either answers or doesn't. Losing is normal; either ending
produces a shareable card with days survived and four meters. `?demo=1` runs a fixed RNG seed
(`TUNING.DEMO_SEED`) for reproducible runs. See `README.md` for the pitch and
`docs/GAME-DESIGN-PLAYBACK.md` for design history through v6 — **read it before changing game
mechanics**, but note v7 deliberately reinstated mechanics v6 removed (real-time queue, meters,
fail state), returning to the original brief.

## Commands

```bash
npm install
npm run dev        # Vite dev server
npm run build      # production build to dist/
npm run preview    # serve dist/ (defaults to port 4173; game is verified against this)
```

There is no lint or test framework. Verification is done two ways:

- **Content integrity:** `src/gameData.js` is pure ESM data — import it directly in Node to assert
  content invariants (6 roles × 5 tickets = 30 in `TICKET_POOL`, each with `headline`/`death`;
  10 cards in `DRAFT_POOL`, each with `rule` and `capability`; no em dashes in player copy):
  `node --input-type=module -e "import { ROLES } from './src/gameData.js'; ..."`
- **Playthroughs:** Playwright-core driving Chromium against `npm run preview`. Screens expose
  `data-testid` hooks (`ticket` with `data-headline`, `draft-card` with `data-card`, `simulate`,
  `end-card`, `end-headline`, `end-tail`, `copy-card`, `replay`, `manual-ops`; title-screen buttons
  via `aria-label="Start game"` / `"How to play"`). Clearing a ticket needs a real pointer-down
  held ≥1.2s (`HANDLE_HOLD_MS`), not a click. Buttons with infinite pulse animations never become
  "stable" — click with `{ force: true }`. Use `?demo=1` so runs are deterministic.

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

- **`src/gameData.js` — all content and tuning, zero logic.** `TUNING` holds every balance knob
  (quarter length, spawn counts/acceleration, hold time, damage rates, meter starts, Manual Ops
  multipliers, `DEMO_SEED`). `ROLES` defines 6 roles × 5 tickets in fixed slot-theme order
  (signature, messy data, disconnected, tech debt, AI mishap); each ticket has a `headline` and a
  `death` line (loss-card cause of death, `{n}` filled from spawn count × `per`). `DRAFT_POOL` is
  the 10 draftable agent cards: 6 role flagships + Data 360, Orchestrator, Guardrails, Flow, each
  with an intercept `rule` and a real-capability line. Copy and balance changes happen here
  without touching the component.
- **`src/WhoBrokeTheBusiness.jsx` — the entire game, one default-export component.** A `phase`
  string drives the state machine: `title → roleSelect → (quarterIntro → quarter → draft|noDraft)
  ×4 → auditIntro → audit → end`. Search `phase ===` to find a screen. The quarter engine runs on
  a single interval against a mutable sim object in `simRef` (spawn schedule, meters, agent
  timers, damage log); React state gets per-tick snapshots via `setUi`. Meters kill the run at 0
  (debt at 100); the audit clears only if the stack has ≥ `BOSS_AGENTS_TO_CLEAR` agents. Lane
  rules live in `inLane`; Manual Ops mode is the same engine with `MANUAL_OPS` multipliers and no
  drafts. Game-specific CSS (`.h-pixel`, `.txt-body`, `.btn-pixel`, holdbar/shake keyframes) lives
  in an inline `<style>` block; Tailwind (compiled via PostCSS, no CDN) handles layout.

### Art pipeline

- `Game Art/` (repo root) = full-resolution source art, uploaded by the owner. `src/art/` =
  compressed derivatives used by the build (`menu.jpg` title screen, `agent-bg.jpg` draft-screen
  backdrop, `robot.png` mascot crop). `agent-bg.jpg` contains baked-in text ("AGENTFORCE
  UNLOCKED", "DEPLOY AGENT"); screens that use it must dim it hard enough that its text cannot
  compete with live UI text.
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
No em dashes anywhere in player-facing copy, and no strict parallel triplets: two items, or a
third that breaks the rhythm with something concrete (the beeping box, Dave, the fax machine).
