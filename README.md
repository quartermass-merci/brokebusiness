# Who Broke the Business?

**The world's first Agentforce-powered business simulator.** Don't tell business leaders
what Agentforce can do — let them experience it.

An 8-bit business sim where leaders live the everyday chaos of running a modern company:
messy customer data, technical debt, disconnected systems, and AI mishaps. Every challenge
you survive unlocks a practical Agentforce solution — the "agentic seasoning" that turns
broken processes into measurable outcomes.

## The loop

1. **Pick your role.** CEO, CFO, CTO, CMO, CRO, or Head of Customer Service — six seats,
   each with its own disasters, its own language, and its own agents.
2. **The chaos begins.** Five specific problems, one at a time, no timer. Your chatbot
   refunded everyone. Every customer is called Steve. Marketing emailed the wrong list.
   Read the situation and choose how you'd actually handle it.
3. **Live with the consequence.** Every choice does something real — and even the best call
   only buys time. The root cause is still there.
4. **Unlock Agentforce.** Each challenge unlocks the real capability that fixes that problem
   for good: Service Agent deflection, Data 360 unification, cross-cloud orchestration,
   guardrails and observability. It joins your stack and keeps working.
5. **Survive the flood.** The business scales to 4,000 problems a quarter. Your stack scales
   with it. You don't — and the final screen shows exactly what that's worth.

A run takes 4–5 minutes. Replaying as another exec is a genuinely different game: all 30
challenges and all 90 response options are unique.

## Running it

```bash
npm install
npm run dev
```

## Structure

- [`src/gameData.js`](src/gameData.js) — six roles × five challenges, each with three bespoke
  choices, outcomes, and the Agentforce capability it unlocks.
- [`src/WhoBrokeTheBusiness.jsx`](src/WhoBrokeTheBusiness.jsx) — the game: title, role select,
  challenge/outcome/power-up loop, the finale, and the victory screen.
- `src/art/`, `src/avatars/` — supplied pixel art and the six character headshots.

Styling is compiled Tailwind plus Press Start 2P and VT323 (bundled, no CDN). Framer Motion
handles animation. All state lives in React memory — no storage, no external requests.
