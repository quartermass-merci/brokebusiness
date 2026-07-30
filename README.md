# Who Broke the Business?

**The world's first Agentforce-powered business simulator.** Don't tell business leaders
what Agentforce can do — let them experience it.

An 8-bit roguelite where you run a modern company for one fiscal year while it actively
falls apart: messy customer data, technical debt, disconnected systems, and AI mishaps
arriving as a real-time ticket flood. One human can't keep up. That's the point — and the
pitch. Between quarters you draft Agentforce agents that intercept the chaos for you,
visibly, with receipts.

## The loop

1. **Pick your role.** CEO, CFO, CTO, CMO, CRO, or Head of Customer Service — the flood
   is weighted toward whatever your seat gets blamed for.
2. **Survive the quarter.** Tickets spawn in real time, six-word headlines only. Click and
   hold to handle one yourself. Unhandled tickets drain PRODUCTIVITY and CUSTOMER
   HAPPINESS and pile up TECHNICAL DEBT. Any meter dying ends the run and stamps your
   days survived.
3. **Draft between quarters.** Untimed. Three agent cards, pick one — role agents that
   intercept your lane, Data 360 that collapses duplicate Steves, guardrails that
   pre-block AI mishaps. Draft order is your build.
4. **Face the year-end audit.** 4,000 problems at once, manual handling disabled. Hit
   SIMULATE and watch the stack you drafted answer for you.
5. **Post your card.** Win or lose, the run ends in a shareable card: days survived, four
   meters, Agentic Seasoning, and — if you died — a generated cause of death
   ("312 customers named Steve").

**Manual Ops mode** is the same year with no drafts ("Your CFO rejected the AI budget.").
It ends between day 40 and day 90, every time. That card is the demo's opening beat.

A full winning run is under 5 minutes. Losing is normal. `?demo=1` fixes the seed so a
rehearsed run is the live run.

## Running it

```bash
npm install
npm run dev
```

## Structure

- [`src/gameData.js`](src/gameData.js) — all content and tuning: the 30-headline ticket
  pool with theme tags and death lines, the 10-card draft pool, and every constant.
- [`src/WhoBrokeTheBusiness.jsx`](src/WhoBrokeTheBusiness.jsx) — the game: title, role
  select, the quarter engine, the draft, the audit, the end cards.
- `src/art/`, `src/avatars/` — supplied pixel art and the six character headshots.
- [`docs/GAME-DESIGN-PLAYBACK.md`](docs/GAME-DESIGN-PLAYBACK.md) — design history,
  mechanics math, and why every previous version of the loop was replaced.

Styling is compiled Tailwind plus Press Start 2P and VT323 (bundled, no CDN). Framer Motion
handles animation. All state lives in React memory — no storage, no external requests.
