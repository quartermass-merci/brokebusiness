# Who Broke the Business?

A playable 5-round business simulator: Papers, Please-style chaos escalation × a roguelite
agent draft × a Balatro-style jackpot finale. Built to make skeptical executives *feel* two
things in sequence — the compounding chaos of running a business manually, and the exponential
relief of stacking Agentforce agents.

**The arc: drown → draft → delegate → dominate.**

- **Round 1** — 12 chaos tickets, no agents, pure manual triage. You will not keep up. That's the point.
- **Rounds 2–4** — chaos roughly triples while your drafted agents intercept more and more of it live.
  By round 4 you're mostly watching your system work.
- **Round 5** — 100+ tickets flood the board. Manual triage is disabled ("No human can triage this").
  Press **SIMULATE** and watch your stack fire card by card, slot-machine style, past an
  otherwise-impossible target.

A grey "Manual Ops Inc." ghost score tracks what you'd have earned without agents. It flatlines
in round 5. It does not survive Q3.

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL. A session takes 3–5 minutes.

## Structure

The whole game is one self-contained React component:
[`src/WhoBrokeTheBusiness.jsx`](src/WhoBrokeTheBusiness.jsx) — six executive roles, role-specific
chaos pools and agent cards, the round engine, the scoring formula
`(base + Σ additive) × Π multipliers`, and the round-5 chain-reaction sequence.
Styling is Tailwind utility classes (CDN, no build step for CSS) plus Framer Motion for animation.
All state lives in React memory — no storage, no external assets, emoji only.
