# Who Broke the Business?

A playable 5-round business simulator: Papers, Please-style chaos escalation × a roguelite
agent draft × a Balatro-style jackpot finale. Built to make skeptical executives *feel* two
things in sequence — the compounding chaos of running a business manually, and the exponential
relief of stacking Agentforce agents.

**The arc: drown → deploy → fix the data → dominate.**

- **Every ticket is a decision.** Inspect it, then choose: ROUTINE → handle, TEAM-TAGGED → route,
  CRITICAL → escalate (or delegate to an agent). Wrong calls make things worse.
- **Round 1** — pure judgment, no agents. You will not keep up. That's the point.
- **Round 2** — your first agent comes online *into your data swamp*: it runs at 25% of advertised
  and creates duplicate records. The draft then offers **Fix the Data** (Data 360 unification) —
  the readiness step that unlocks advertised performance for every agent.
- **Rounds 3–4** — every capability integrates for a round before it works (no day-one miracles),
  then the stack compounds. Each card maps to a real Agentforce feature with an honest effect line.
- **Round 5** — 100+ tickets flood the board. Manual triage is disabled ("No human can triage this").
  Press **SIMULATE** and watch your stack fire card by card past an otherwise-impossible target.

Each of the six executive roles has its own mission, metric, ticket mix, and agents. A grey
"Manual Ops Inc." ghost score tracks what you'd have earned without agents. It flatlines in
round 5. It does not survive Q3.

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
