# WHO BROKE THE BUSINESS? — Design Playback

A complete record of what was asked for, what got built and why, how the narrative works,
every mechanic with its real numbers, every line of game content, and an honest diagnosis
of why the current build still falls flat.

Written to be argued with. Sections 6 and 7 are the ones worth your red pen.

---

## 1. THE INITIAL BRIEF

The original ask was a one-shot build of a single-file React prototype with an explicit
design thesis, quoted here because the drift away from it matters:

> **The world is Papers, Please.** Chaos volume compounds every round on a fixed escalation
> curve, regardless of what the player does. The game gets harder on its own.
>
> **The player's counterforce is a roguelite draft.** Each round the player drafts one
> Agentforce agent card. Agents don't just add score — they *intercept incoming chaos*.
>
> **The finale is Balatro.** Round 5 is a boss crisis with a mathematically impossible target
> for manual play. The player hits SIMULATE and watches their drafted stack fire sequentially,
> multiplying the score like a slot machine paying out.
>
> The persuasion arc: **drown → draft → delegate → dominate.** The player must feel
> overwhelmed before they feel powerful. **Never skip the drowning.**

Specified in detail:

| Element | Brief's specification |
|---|---|
| Structure | 5 rounds, each with 4 beats: chaos wave → timed manual triage (12–15s) → draft → resolution |
| Escalation | 12 → 20 → 32 → 50 → 100+ tickets, spawn rate slow → flood |
| Round 1 | "No agents. Pure manual. Player clears ~4–5 max before timer ends. This drowning is intentional — do not soften it." |
| Scoring | Visible formula: `(Base + Σ Additive) × Π Multipliers`, e.g. `(100 + 500 + 250) × 1.5 × 2.0 = 2,550` |
| Ghost line | "Manual Ops Inc." — what you'd score without agents; growth decays each round (1 / 0.7 / 0.4 / 0.15 / 0) |
| Cards | 4 per role: additive (+500) → trigger (+250) → multiplier (×1.5) → orchestrator (×2.0) |
| Roles | 6 executives, each with a chaos pool of 8–12 funny role-specific tickets |
| Round 5 | Manual clicking disabled, "No human can triage this", async SIMULATE chain reaction with escalating typography, screen shake, colour shift blue → gold → red-hot |
| Juice | Card lift/tilt, ticket bounce/pop, curved flight paths into agent cards, animated count-ups, ambient tone shifting from cluttered to calm |
| Length | 3–5 minutes, legible to a first-time player with zero instructions |

**The brief was built as specified, and then five rounds of feedback moved it a long way from
that thesis.** Tracking that drift is the point of the next section.

---

## 2. DECISION LOG — WHAT CHANGED, WHEN, AND WHY

### v1 — built to brief
Real-time ticket queue, timed triage window, click-to-clear, roguelite draft of 4 cards,
visible formula bar, ghost line, round-5 SIMULATE payoff. Verified end-to-end.
**Outcome:** mechanically faithful to the brief. Never really evaluated on feel, because the
next four rounds of feedback each replaced a layer.

### Round 1 of feedback — the 8-bit reskin
Supplied pixel-art mockups. Adopted Press Start 2P (display) + VT323 (body), magenta / cyan /
acid-green / yellow on deep indigo, hard 4px borders, segmented block meters, CRT scanlines.
Replaced the Tailwind CDN with a compiled build so the page is self-contained.

Then: *"the text is very hard to read, can we make it less scaly."*
Removed the global scanline overlay (kept it for the boss round only), increased type sizes.
**First signal of a tension that never got resolved: the arcade aesthetic fights legibility,
and every fix in one direction cost the other.**

### Round 2 of feedback — six structural changes
1. Replace click-to-pop with per-ticket decisions (Papers, Please model)
2. Delay automation; make the first AI power-up *underperform* because the data is a mess
3. Add an explicit integration step between "buy" and "benefit"
4. Tie every power-up to a real Agentforce feature + key message
5. Role-based missions per executive
6. Swap emoji for headshots

Built: a decision inspector with HANDLE / ROUTE / ESCALATE / DELEGATE; agents that arrive
`SETUP` for a round then run `DIRTY` at 25% and spawn duplicate records until a **Fix the
Data** (Data 360) pick; cards rewritten with FEATURE / EFFECT / WHY IT MATTERS; per-role
missions and metrics; an avatar pipeline.

**The decision that caused the most damage, in hindsight:** keeping the real-time timer
*and* adding long-form decisions on top of it. Two incompatible pacings in one screen.

### Round 3 of feedback — the art drop
Six headshots plus menu and Agentforce scene art, uploaded to the repo. Cropped the
headshots to circular avatars, made the supplied menu illustration the actual title screen
with click hotspots over its drawn buttons, and used the Agentforce scene as the power-up
backdrop with its robot cropped into the header.

### Round 4 of feedback — pacing, stakes, identity
*"Too fast out of the gate; think Tetris. Stronger problems. Power-ups should be earned.
You can't lose. Rounds don't connect. Give each character a personality power-up and a
blind spot."*

Built: a Tetris ramp (5 → 8 → 12 → 18 problems, tightening spawn and grace windows); a
**business stability** meter with a real defeat screen; a **correct-call quota** gating each
deployment (miss it → "BUDGET WITHHELD" + contractor stopgap); **exec capital** limiting
escalations; **perk / blind-spot** categories per role where an agent covering your blind
category reveals redacted context; **carryover backlog** so unresolved problems became next
round's hot tickets; weekend stability recovery.

Testing here caught three genuine bugs worth recording:
- escalation counting ran *inside* a React state updater, so it could double-charge damage;
- a wrong call left the problem on the board, so it could be re-decided for unlimited damage;
- running out of exec capital made correct escalations *impossible*, creating an unwinnable
  death spiral.

**By the end of this round the game had seven interacting systems.** Individually defensible,
collectively opaque.

### Round 5 of feedback — "still button mashing, simplify"
*"The options are always the same… I played as the CMO and the three options didn't really
make sense. What if we simplified it a bit more?"* — plus the pitch text naming the real core:
**pick your role → the chaos begins → every challenge unlocks a practical Agentforce solution.**

Three decisions were taken explicitly, with the alternatives on the table:

| Decision | Chosen | Rejected |
|---|---|---|
| Core loop | **Turn-based scenario cards** — no queue, no timer, read at your own pace | Light timer; timer that pauses when a card is open |
| Simplification | **Strip to the bone** — one score only | Keep a 3-strikes fail state; keep stability + the dirty-data twist |
| Content | **Role-specific challenges**, marquee disasters assigned to their natural seat | Same five for everyone; shared spine + variants |

Built: 6 roles × 5 challenges × 3 bespoke options, each challenge unlocking its own real
Agentforce capability. Deleted the formula bar, stability meter, exec capital, quotas, blind
spots, backlog, and dirty-data mechanic. Body copy went from ~11–16px to 26–30px.

**What that trade actually cost — and this is the crux:** the drowning went away. The brief's
one hard rule was *never skip the drowning*, and a turn-based card game with no timer, no
scarcity, and no fail state cannot make anyone feel overwhelmed. The relief of delegation is
unearned because there was no pressure to relieve.

---

## 3. HOW THE NARRATIVE IS DESIGNED

### The intended persuasion arc
```
drown  →  draft  →  delegate  →  dominate
(feel the chaos) (buy a tool) (it works) (it compounds)
```
Currently only beats 2 and 4 exist, and beat 4 is asserted by a number rather than felt.

### The per-challenge story pattern
Every one of the 30 challenges is built on the same four-beat structure:

1. **Headline** — the disaster in six words or fewer, funny and specific
   (`YOUR CHATBOT REFUNDED EVERYONE`, `EVERY CUSTOMER IS CALLED STEVE`)
2. **Brief** — three lines carrying real numbers, ending on a clock or a stake
   ("6,000 delivered. 34,000 still queued.")
3. **Three options** — one *best*, one *defensible but costly*, one *actively bad*.
   No generic verbs. Written in the vocabulary of that specific seat.
4. **Outcome + "BUT…"** — the consequence, then the deliberate twist: **every option, including
   the best one, leaves the root cause alive.** That is what justifies the capability.

### The messaging spine
Each of the four themes from the pitch appears in every role, mapped to a real capability:

| Theme | Capability it unlocks | Message it dramatizes |
|---|---|---|
| Role signature disaster | That role's flagship agent | Autonomy on the work that defines the seat |
| Messy customer data | **Data 360 / Data Cloud** | "AI on top of bad data is a power-up that powers nothing" |
| Disconnected systems | Cross-cloud / multi-agent orchestration | "Agents that coordinate beat agents that coexist" |
| Technical debt / legacy drag | Service Agent deflection, Flow, knowledge unification | Institutional knowledge belongs in systems, not people |
| AI mishap (confidently wrong) | Guardrails + grounding + observability | "Guardrails are what make autonomy safe" |

### Tone rules applied throughout
- **Never overclaim.** Early capabilities are honest speed-ups, not miracles. The phrase
  "agentic seasoning" is treated as a *small* improvement that compounds.
- **The human is competent.** Bad outcomes come from systems and missing context, not stupidity.
  The player is never the joke; the situation is.
- **Specific numbers over adjectives.** "$340,000 and it's still running" beats "a lot of refunds".
- **The best call still isn't enough.** This is the load-bearing rhetorical move of the whole game.

---

## 4. ALL MECHANICS, WITH THE REAL NUMBERS

### Phase flow
```
title → roleSelect → ┌─ challenge → outcome → powerup ─┐ ×5 → floodIntro → flood → simulate → victory
                     └───────────── loop ──────────────┘
```
No fail state. No timer anywhere. Every path reaches victory.

### Constants (`src/gameData.js`)
```js
CHAOS_VOLUME       = [12, 40, 120, 380, 1200]   // "problems this quarter", per challenge
AGENT_SHARE        = [0.25, 0.2, 0.2, 0.2, 0.15] // share of volume each deployed agent absorbs
CHOICE_POINTS      = { best: 500, ok: 280, bad: 80 }
POINTS_PER_PROBLEM = 10
FLOOD_VOLUME       = 4000                        // the finale
TOTAL              = 5                           // challenges per run
```

### The scoring engine in full
- **Human choice:** flat points, no scaling. `best 500 / ok 280 / bad 80`.
- **Cumulative agent share** after each deployment: `0.25 → 0.45 → 0.65 → 0.85 → 1.00`.
- **On advancing to challenge n:** `absorbed = round(CHAOS_VOLUME[n] × cumShare)`, awarding
  `absorbed × 10` points. So agent points grow with volume while human points do not.
- **Pre-flood agent totals:** 10 + 54 + 247 + 1,020 = **1,331 problems → 13,310 points**
- **Finale:** all 5 agents online, `share = 1.0`, so `4,000 problems` are split evenly —
  `800 each × 10 = 8,000 per agent × 5 = 40,000 points`.
- **Perfect run:** human `2,500` + agents `53,310` = **55,810**, versus a Manual Ops Inc.
  ghost of `2,500` → the displayed **22×**.

### Known flaws in this maths (see §6)
- **Playing badly inflates the multiple.** All-bad choices give a human score of 400 against
  the same ~53,310 agent points → **134×**. The headline number rewards incompetence.
- **The agent share is a designer's constant, not a consequence of play.** It is identical in
  every run, so the "exponential payoff" is pre-determined the moment you press start.
- **The survival target cannot be missed.** It is computed as 90% of the score you are
  guaranteed to reach: `target = floor((score + handled × 10) × 0.9 / 100) × 100`.

### Screen inventory
| Screen | What it does | Interaction |
|---|---|---|
| Title | Supplied menu art, full-screen | Two hotspots over the drawn buttons |
| How to play | Five numbered rules | Back / Start |
| Role select | Six headshot cards | Pick one |
| Challenge | Headline, 3-line brief, chaos counter, 3 options | One click |
| Outcome | Quality verdict, echoed choice, consequence, "BUT…" | One click |
| Power-up | AGENTFORCE UNLOCKED, name, FEATURE / HANDLES / MESSAGE | DEPLOY AGENT |
| Flood intro | 4,000 problems, survival target | FACE IT |
| Flood | 70 problem cards scattered, SIMULATE | SIMULATE (or "try that" → "No human can triage this") |
| Simulate | Agents fire one at a time, shake + count-up | none |
| Victory | Score vs ghost, problem counts, multiple, operator grade, stack | Replay |

### Typography and art
- `Press Start 2P` headlines only; `VT323` body at `clamp(1.35rem, 2.5vw, 1.85rem)` → 30px at
  desktop width. Options 26px on 59px-tall targets. Reading column capped at 62 characters.
- Six supplied headshots as circular avatars; supplied menu art as the title screen; supplied
  Agentforce scene as the power-up backdrop with its robot cropped into the header.

---
## 5. THE COMPLETE CONTENT — ALL 30 CHALLENGES, 90 OPTIONS, 30 POWER-UPS

Generated directly from `src/gameData.js`, so this is exactly what ships.

Quality key: **[BEST]** = 500 pts · **[OK]** = 280 pts (defensible, costly) · **[BAD]** = 80 pts (made it worse)

Slot themes: 1 = role signature · 2 = messy data · 3 = disconnected systems · 4 = technical debt · 5 = AI mishap

---

### 👩‍💼  CEO — "Grow the business."

- **Score metric:** COMPANY ALIGNMENT
- **Win condition copy:** Every team reports the same number. On purpose.
- **Victory line:** One source of truth. One number. The board deck finally agrees with itself.

#### 1. TWO TEAMS, TWO REVENUE NUMBERS
*Slot theme: signature disaster · problems this quarter: 12*

> Sales says Q3 was $4.0M. Finance says $2.8M.  
> Both numbers are already in the board pre-read.  
> Both teams are certain. The meeting is Thursday.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Halt the pre-read until both teams reconcile to one source | **BEST** | You stop the deck, sit both teams down, and one number comes out the other side. It costs you two days and the board never sees the gap. |
| 2 | Present both numbers side by side with a footnote | **OK** | The board thanks you for the transparency, then spends the whole meeting on the footnote instead of the strategy. |
| 3 | Go with the higher number — momentum matters | **BAD** | It lands in the 10-Q. Finance restates it six weeks later, and now the story is about your reporting, not your growth. |

**BUT… (the root-cause beat):** You settled this quarter's number. Next quarter, both teams will pull from the same broken sources and do it again.

**POWER-UP UNLOCKED: 🧠 The Briefing Agent**

- *Real capability:* Agentforce on Data 360: answers exec questions from live, unified company data
- *What it now handles:* Ask "what was Q3 revenue?" and get one grounded answer with its sources attached — before anyone builds a slide.
- *Message:* "One number, every team, every time you ask."

#### 2. NOBODY AGREES WHO THE CUSTOMER IS
*Slot theme: messy customer data · problems this quarter: 40*

> Sales counts 8,200 accounts. Support counts 11,500.  
> Finance bills 9,100 of them.  
> You are asked on stage next week how many customers you have.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Commission a company-wide manual reconciliation | **BEST** | Six weeks and two analysts later you have a defensible number. It is already stale by the time you say it out loud. |
| 2 | Quote the biggest number and move on | **BAD** | A journalist checks it against your filings. Now the headline is about the discrepancy. |
| 3 | Say "roughly ten thousand" and change the subject | **OK** | You survive the stage. Every forecast built on that vagueness inherits it. |

**BUT… (the root-cause beat):** Three systems, three truths. You can reconcile them by hand forever, or once.

**POWER-UP UNLOCKED: 🗄️ Data 360**

- *Real capability:* Data Cloud: unifies records across every system into one customer profile
- *What it now handles:* One customer, one record, everywhere — and every agent and dashboard reads from it.
- *Message:* "AI on top of bad data is a power-up that powers nothing."

#### 3. THREE DEPARTMENTS, ONE PROJECT, ZERO PROGRESS
*Slot theme: disconnected systems · problems this quarter: 120*

> Ops, Product, and Marketing each believe they own the launch.  
> All three have a roadmap. None of them match.  
> The launch date is in five weeks.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Name one owner and put the other two in support | **BEST** | Ownership gets clear in a day and the launch survives. You spend the next week absorbing the politics personally. |
| 2 | Run a weekly sync so all three stay aligned | **OK** | The meeting becomes the project. Alignment happens in the room and evaporates by Wednesday. |
| 3 | Let them compete — the best plan will win | **BAD** | Two teams ship two versions to the same customers. Pricing differs by 40% and the market notices first. |

**BUT… (the root-cause beat):** You untangled one launch by hand. The silos that tangled it are still exactly where they were.

**POWER-UP UNLOCKED: ☁️ Cross-Cloud Orchestrator**

- *Real capability:* Agentforce multi-agent orchestration across Sales, Service, and Marketing clouds
- *What it now handles:* One workflow spans all three departments: handoffs happen automatically and every team sees the same plan.
- *Message:* "Silos are a speed tax. This is the refund."

#### 4. OPS RUNS ON DAVE'S SPREADSHEET
*Slot theme: technical debt / legacy · problems this quarter: 380*

> Every order flows through one file with 40 hidden macros.  
> Only Dave understands it. Dave gave notice this morning.  
> He leaves in eleven days.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Pay Dave as a consultant and document it in his last week | **BEST** | You capture most of it. The parts he never wrote down leave with him, and the file still runs your business. |
| 2 | Assign two people to shadow him full time | **OK** | They learn to operate it without understanding it. The next time it breaks, nobody can fix it. |
| 3 | Counter-offer whatever it takes to keep Dave | **BAD** | Dave stays for six months. The dependency deepens, and now everyone knows the price of being irreplaceable. |

**BUT… (the root-cause beat):** You transferred the knowledge. The manual process — and the single point of failure — is untouched.

**POWER-UP UNLOCKED: ⚙️ Process Automation Agent**

- *Real capability:* Agentforce + Flow: turns the spreadsheet workflow into an automated, documented process
- *What it now handles:* Orders route, validate, and reconcile themselves — with every step logged and no hidden macros.
- *Message:* "Institutional knowledge belongs in your systems, not in one person's file."

#### 5. THE AI BOARD SUMMARY INVENTED A METRIC
*Slot theme: AI mishap · problems this quarter: 1200*

> Your new AI assistant drafted the board summary.  
> It cites "net revenue efficiency of 34%" — a metric that does not exist.  
> The deck went out to all eleven directors an hour ago.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Send a correction now, naming exactly what was wrong | **BEST** | Awkward for a day, trusted afterwards. One director replies that the correction was more useful than the summary. |
| 2 | Quietly fix the deck and hope nobody read page four | **OK** | Two of them read page four. They ask about it in the meeting, and now the AI is the topic. |
| 3 | Let it stand — it sounded plausible enough | **BAD** | A director builds a question around it for the earnings call. The number cannot survive being asked about. |

**BUT… (the root-cause beat):** Confidently wrong is worse than slow. An assistant that cannot show its sources cannot be trusted with your board.

**POWER-UP UNLOCKED: 🔍 Grounded Answers + Observability**

- *Real capability:* Agentforce grounding with citations, plus observability over every agent action
- *What it now handles:* Every figure an agent states is traced to a real record, and you can audit what it did and why.
- *Message:* "Trust is a feature. It has to be built in."

---

### 💰  CFO — "Protect the bottom line."

- **Score metric:** $ PROTECTED
- **Win condition copy:** Cost per resolution down 62%. Duplicate tools: zero.
- **Victory line:** Every dollar accounted for. The bottom line started protecting itself.

#### 1. YOUR CHATBOT REFUNDED EVERYONE
*Slot theme: signature disaster · problems this quarter: 12*

> Overnight it approved 1,400 refunds totalling $340,000.  
> The policy cap is $200 and no human approved any of them.  
> It is still running.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Freeze the bot and hold every unsettled payment | **BEST** | You stop it inside the hour and claw back $260,000 before settlement. The remaining $80,000 is gone, and you keep every customer. |
| 2 | Let the refunds stand and shut the bot off tomorrow | **OK** | Customers are delighted. Finance is not: the full $340,000 lands, and 300 more refunds process while you wait. |
| 3 | Leave it running and blame the vendor | **BAD** | By Friday it is $900,000 and a compliance finding. The vendor points at your configuration, and they are right. |

**BUT… (the root-cause beat):** You stopped this one. Nothing you did prevents an autonomous system from spending your money tomorrow.

**POWER-UP UNLOCKED: 🛡️ Guardrailed Service Agent**

- *Real capability:* Agentforce with policy guardrails and approval steps on agent actions
- *What it now handles:* Any refund past policy is held for a human before money moves — every time, without a person watching the queue.
- *Message:* "Guardrails are what make autonomy safe enough to use."

#### 2. ONE VENDOR, FOUR SPELLINGS, FOUR CONTRACTS
*Slot theme: messy customer data · problems this quarter: 40*

> "Acme Inc", "ACME", "Acme Incorporated", "acme inc."  
> Four separate contracts, four renewal dates, four rates.  
> Combined, you are their largest customer and paying list price.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Consolidate all four into one negotiated master agreement | **BEST** | You cut 22% off the combined spend. It took your team three weeks of matching records by hand to prove they were one vendor. |
| 2 | Cancel the two smallest and keep the rest | **OK** | You save a little and break a workflow that depended on one of them. The duplication returns under a new spelling. |
| 3 | Leave it — the finance team knows they are the same | **BAD** | Two renew automatically at list price. Nobody catches it until the audit, because "knowing" was never in a system. |

**BUT… (the root-cause beat):** You found these four. There are eleven more vendors like this and no system that can see them.

**POWER-UP UNLOCKED: 🗄️ Data 360**

- *Real capability:* Data Cloud: dedupes and unifies vendor and customer records across systems
- *What it now handles:* Four spellings resolve to one vendor automatically, with total spend visible in one place.
- *Message:* "You cannot negotiate leverage you cannot see."

#### 3. THREE TOOLS, ONE JOB, ALL AUTO-RENEWED
*Slot theme: disconnected systems · problems this quarter: 120*

> Three platforms doing the same thing: $180,000 a year combined.  
> All three renewed at midnight.  
> The cancellation window closes in 30 days.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Map actual usage, then cancel the two nobody uses | **BEST** | You recover $104,000 inside the window. It takes a month of chasing teams for answers about their own tools. |
| 2 | Cancel the two most expensive immediately | **OK** | You save more upfront and break a workflow in Support that quietly depended on one of them. |
| 3 | Keep all three — switching costs are real | **BAD** | You pay for three years of the same capability, and a fourth tool gets bought next quarter by someone who did not know. |

**BUT… (the root-cause beat):** Tool sprawl is a symptom. Nothing you did stops the next duplicate purchase.

**POWER-UP UNLOCKED: 🤝 Spend Orchestration Agent**

- *Real capability:* Agentforce across procurement and contract data: renewal analysis and duplicate detection
- *What it now handles:* Overlapping tools and upcoming renewals surface before they auto-renew, with a recommendation attached.
- *Message:* "Savings you find once are luck. Savings you find every time are a system."

#### 4. MONTH-END CLOSE IS 300 MANUAL ENTRIES
*Slot theme: technical debt / legacy · problems this quarter: 380*

> Your team works two weekends every month to close the books.  
> 300 journal entries, keyed by hand, reconciled by hand.  
> Two senior accountants just resigned citing burnout.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Automate the 40 highest-volume entry types first | **BEST** | Close drops from nine days to five and the weekends stop. The other 260 entry types still need hands. |
| 2 | Hire two contractors to absorb the volume | **OK** | The weekends stop while the contracts last. Cost per close goes up and nothing is documented. |
| 3 | Push the close deadline out by three days | **BAD** | The work is identical, just later. Your board reporting slips with it and investors notice the lag. |

**BUT… (the root-cause beat):** You automated the easy 40. The other 260 are still a person copying numbers between systems.

**POWER-UP UNLOCKED: 🧾 Close Automation Agent**

- *Real capability:* Agentforce + Flow across finance systems: automated entries, matching, and reconciliation
- *What it now handles:* Routine entries post and reconcile themselves; your team reviews exceptions instead of typing.
- *Message:* "Your accountants should be analysing, not transcribing."

#### 5. THE AI EXPENSE APPROVER APPROVED A BOAT
*Slot theme: AI mishap · problems this quarter: 1200*

> Line item: "client entertainment vessel — $84,000."  
> Your AI approver passed it. Twice.  
> It has approved 2,300 expenses this quarter and you cannot tell which ones it got wrong.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Suspend auto-approval and audit all 2,300 by hand | **BEST** | You find the boat and four other bad calls. It costs three weeks and every routine expense backs up behind the audit. |
| 2 | Add a hard dollar ceiling and keep it running | **OK** | The boat cannot happen again. The subtler mistakes under the ceiling keep going through unnoticed. |
| 3 | Reverse the boat and say nothing | **BAD** | Auditors find it before you mention it. The finding is not the boat — it is that nobody could explain the approval. |

**BUT… (the root-cause beat):** You cannot fix what you cannot see. An agent whose decisions are not auditable is a liability with good intentions.

**POWER-UP UNLOCKED: 🚨 Anomaly Watcher + Observability**

- *Real capability:* Agentforce observability with anomaly detection over every agent decision
- *What it now handles:* Unusual approvals are flagged in real time and every decision is traceable to its reasoning and policy.
- *Message:* "Autonomy without auditability is just risk with better latency."

---

### 💻  CTO — "Keep the tech stack from collapsing."

- **Score metric:** ENGINEERING CAPACITY
- **Win condition copy:** Tier-1 deflection 78%. Engineering interrupts down 71%.
- **Victory line:** The stack held. Engineering is building again — not firefighting.

#### 1. SUPPORT TICKETS ARE BURYING ENGINEERING
*Slot theme: signature disaster · problems this quarter: 12*

> 412 tickets escalated to engineering this month.  
> You audit a sample: 380 were password resets, how-to questions, and known issues.  
> Your senior engineers shipped nothing for three weeks.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Put a triage engineer in front of the queue on rotation | **BEST** | Interrupts drop 60% immediately. You have now permanently assigned one engineer to not building anything. |
| 2 | Tell Support to stop escalating without a repro | **OK** | Volume halves. So does the signal — two real outages sit in the queue for a day because they lacked a repro. |
| 3 | Let the team self-manage the interruptions | **BAD** | Your two best engineers spend the quarter on password resets and start interviewing elsewhere. |

**BUT… (the root-cause beat):** You moved the burden onto an engineer. The 380 routine tickets still need answering, forever.

**POWER-UP UNLOCKED: 🐛 Service Agent (Tier-1 Deflection)**

- *Real capability:* Agentforce Service Agent: classifies and fully resolves routine cases
- *What it now handles:* Password resets, how-tos, and known issues are resolved end-to-end before a human sees them.
- *Message:* "Deflection is what keeps engineers building."

#### 2. THREE SYSTEMS, THREE VERSIONS OF ONE CUSTOMER
*Slot theme: messy customer data · problems this quarter: 40*

> Billing, the app, and Support each hold a different record for the same account.  
> Different plan, different email, different renewal date.  
> Support just told a customer their plan does not include a feature they pay for.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Pick billing as the source of truth and sync the others nightly | **BEST** | Answers get consistent within a day of reality. Anything that happens between syncs is still a coin flip. |
| 2 | Build a lookup tool that queries all three at once | **OK** | Support can see all three versions. Now a human decides which one is true, on every single call. |
| 3 | Tell Support to always check billing first | **BAD** | They do, sometimes. The inconsistency becomes a training issue that never fully resolves. |

**BUT… (the root-cause beat):** Nightly syncs and lookup tools are scaffolding around the actual problem: there is no single record.

**POWER-UP UNLOCKED: 🗄️ Data 360**

- *Real capability:* Data Cloud: one unified customer profile across billing, product, and support
- *What it now handles:* Every system and every agent reads the same live record — no syncs, no reconciliation, no coin flips.
- *Message:* "One customer should mean one record."

#### 3. PROD IS DOWN AND NOBODY OWNS THE HANDOFF
*Slot theme: disconnected systems · problems this quarter: 120*

> Checkout has been failing for 22 minutes.  
> Support has 400 tickets, engineering has an alert, and neither knows about the other.  
> The status page still says all systems operational.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Declare an incident and force everyone into one channel | **BEST** | Resolved in eleven minutes once the room exists. Creating that room manually cost you the first 22. |
| 2 | Have engineering fix it and Support handle customers separately | **OK** | Both halves work. Customers get told it is fine while it is being rolled back, and the status page stays wrong. |
| 3 | Wait for the on-call rotation to pick it up | **BAD** | Another 40 minutes of failed checkouts. The post-mortem is about the delay, not the bug. |

**BUT… (the root-cause beat):** You built the bridge by hand, mid-incident. Next outage, you build it again from scratch.

**POWER-UP UNLOCKED: 🎛️ Incident Orchestration**

- *Real capability:* Agentforce multi-agent orchestration across monitoring, Service, and status comms
- *What it now handles:* A ticket spike correlates to the system alert automatically: incident opened, owners paged, status page updated, customers informed.
- *Message:* "Agents that coordinate beat agents that coexist."

#### 4. THE DOS TERMINAL IS BEEPING
*Slot theme: technical debt / legacy · problems this quarter: 380*

> A beige box in the corner runs payroll and billing.  
> Undocumented since 2003. It has started beeping.  
> Nobody will touch it. Payroll runs Friday.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Wrap it in an API and stop anyone touching it directly | **BEST** | Payroll runs and the risk is contained behind an interface. The box is still the box, and it is still beeping. |
| 2 | Find someone who remembers the system and pay them | **OK** | A retired contractor silences it over the phone. You have bought time and learned nothing. |
| 3 | Schedule a full rewrite next quarter | **BAD** | Next quarter never arrives. The box keeps beeping and now it is in the risk register, which changes nothing. |

**BUT… (the root-cause beat):** Technical debt is not the old box. It is that all the knowledge about it lives in people who are leaving.

**POWER-UP UNLOCKED: 📚 Knowledge Architect**

- *Real capability:* Knowledge unification: agents grounded in one current, searchable source of truth
- *What it now handles:* Every system, runbook, and fix is captured and answerable — so the next person does not need the person before them.
- *Message:* "Debt compounds fastest in the things nobody wrote down."

#### 5. THE AI CODE REVIEWER APPROVED A SECRET LEAK
*Slot theme: AI mishap · problems this quarter: 1200*

> An API key was committed to a public repo.  
> Your AI reviewer approved the PR with the comment "LGTM, no issues found."  
> That was six days ago.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Rotate the key, audit six days of access, then fix the reviewer | **BEST** | No breach — you caught it in time. Three days of senior engineering time went into being sure. |
| 2 | Rotate the key and add a secret scanner to CI | **OK** | Secrets are covered now. Everything else the reviewer waves through is still waved through. |
| 3 | Delete the commit and move on | **BAD** | Git history keeps it and so does every fork. The key stays live because deleting is not rotating. |

**BUT… (the root-cause beat):** An AI that reports "no issues found" without being accountable for what it checked is worse than no reviewer at all.

**POWER-UP UNLOCKED: 🔍 Agent Observability + Guardrails**

- *Real capability:* Agentforce observability with policy guardrails over agent actions
- *What it now handles:* Every agent decision is logged, testable, and bounded by policy — and you can see what it actually checked.
- *Message:* "If you cannot audit it, you cannot trust it with production."

---

### 📈  CMO — "Generate leads Sales actually wants."

- **Score metric:** QUALIFIED PIPELINE
- **Win condition copy:** Lead quality up 3.4×. Steves in the CRM: one, and he is real.
- **Victory line:** Sales just asked for MORE leads. Every one is a real person.

#### 1. MARKETING EMAILED THE WRONG LIST
*Slot theme: signature disaster · problems this quarter: 12*

> The win-back campaign is going to the churn list.  
> Subject line: "Welcome back!" To people who left angry.  
> 6,000 delivered. 34,000 still queued.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Kill the send now and apologise only to the 6,000 | **BEST** | You stop it at 6,000 and the apology lands well — two of them actually reply asking to talk. The other 34,000 never knew. |
| 2 | Let it finish, then send a correction to all 40,000 | **OK** | Forty thousand people get two emails they did not want. Unsubscribes triple and Sales hears about it from a prospect. |
| 3 | Let it ride — some of them might come back | **BAD** | Eleven come back. Four hundred report you as spam, and your sending domain reputation takes the quarter to recover. |

**BUT… (the root-cause beat):** You caught this send with minutes to spare. The next campaign will be built from the same lists by the same process.

**POWER-UP UNLOCKED: 🛡️ Campaign Guardrail Agent**

- *Real capability:* Agentforce + Marketing Cloud: audience validation and send guardrails before launch
- *What it now handles:* Every send is checked against live segment logic and suppression rules — a churn list can never receive a win-back.
- *Message:* "The best campaign fix is the one that happens before send."

#### 2. EVERY CUSTOMER IS CALLED STEVE
*Slot theme: messy customer data · problems this quarter: 40*

> 11,400 records where name, company, and email are all "steve".  
> Your form has no validation and never has.  
> Friday's personalised campaign draws from this list.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Fix the form validation first, then dedupe the 11,400 | **BEST** | The bleeding stops and the list gets usable. It costs you Friday's send and a hard conversation about the delay. |
| 2 | Have two interns clean the list before Friday | **OK** | They clean 3,000. The form keeps producing more, so by next month you are back where you started. |
| 3 | Ship Friday's send with personalisation switched off | **BAD** | "Hi there" to 40,000 people, half of whom are the same person. Sales rejects the entire lead batch as junk. |

**BUT… (the root-cause beat):** You cleaned the records you could see. Without one profile per real human, personalisation is guesswork.

**POWER-UP UNLOCKED: 🗄️ Data 360**

- *Real capability:* Data Cloud: identity resolution and unified customer profiles
- *What it now handles:* 11,400 Steves resolve into the real people they represent, and every campaign builds on one live profile.
- *Message:* "Personalisation is a data problem wearing a marketing costume."

#### 3. SALES SAYS YOUR LEADS ARE GARBAGE
*Slot theme: disconnected systems · problems this quarter: 120*

> You delivered 2,400 MQLs. Sales worked 300 of them.  
> Your scoring model and their qualification criteria have never been compared.  
> The pipeline review is Monday and both of you have slides.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Rebuild scoring against deals Sales actually closed | **BEST** | Volume drops to 700 and Sales works nearly all of them. You spend Monday explaining why the MQL number fell 70%. |
| 2 | Ask Sales to work more of the leads you send | **OK** | They work a few hundred more out of goodwill. Conversion stays flat and the argument resumes next quarter. |
| 3 | Report the 2,400 and let Sales explain their conversion | **BAD** | Your number looks great in the deck. Sales stops trusting marketing leads entirely and builds their own pipeline. |

**BUT… (the root-cause beat):** You aligned one model, manually, once. The two teams are still working from two different systems.

**POWER-UP UNLOCKED: 🎯 Shared Intent Scoring**

- *Real capability:* Agentforce + Data 360 segments: one intent model shared across Marketing and Sales
- *What it now handles:* Scoring is grounded in what actually closes, and both teams see the same signal on the same profile.
- *Message:* "A lead Sales does not want was never qualified."

#### 4. ATTRIBUTION SAYS THE FAX MACHINE DROVE Q2
*Slot theme: technical debt / legacy · problems this quarter: 380*

> Your attribution model credits an unmapped legacy channel with 60% of pipeline.  
> That channel ID belongs to a fax line disconnected in 2019.  
> Budget planning starts in two weeks.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Rebuild channel mapping before budget planning | **BEST** | You get real numbers in time. It takes both of your analysts for two weeks and delays everything else. |
| 2 | Exclude the phantom channel and redistribute proportionally | **OK** | The chart looks sane. The redistribution is a guess, and you will plan real money against it. |
| 3 | Present it as-is and caveat the anomaly | **BAD** | Finance builds the budget on the numbers, not the caveat. You defend a fax machine in front of the CFO. |

**BUT… (the root-cause beat):** Legacy tracking held together by manual mapping will drift again the moment you look away.

**POWER-UP UNLOCKED: 📊 Unified Analytics Agent**

- *Real capability:* Agentforce analytics on Data 360: attribution grounded in unified, live channel data
- *What it now handles:* Channels resolve automatically against real activity, and anomalies get flagged instead of reported.
- *Message:* "Seeing is not solving — unless what you see is true."

#### 5. THE AI WROTE AN AD FOR A PRODUCT YOU DON'T SELL
*Slot theme: AI mishap · problems this quarter: 1200*

> Your AI content agent generated 40 ad variants overnight.  
> Six of them describe a feature that was cancelled last year.  
> Two are already live and converting.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Pull the six, honour every signup, and ground the agent in the real catalogue | **BEST** | You keep the customers and fix the cause. Honouring the signups costs you a support scramble and a small credit. |
| 2 | Pull the ads and let the signups lapse | **OK** | Cheaper today. Those customers signed up for something you advertised, and they post about it. |
| 3 | Leave them running — the demand proves we should build it | **BAD** | You sell something that does not exist for three more weeks. Legal calls it what it is. |

**BUT… (the root-cause beat):** Your AI was fluent and wrong. Fluency without grounding in your real catalogue is a liability at campaign scale.

**POWER-UP UNLOCKED: 🔍 Grounded Content + Brand Guardrails**

- *Real capability:* Agentforce grounding on product data with brand and claim guardrails
- *What it now handles:* Every generated asset is checked against the live catalogue and brand rules before it can go live.
- *Message:* "Generative scale multiplies whatever it is grounded in — including nothing."

---

### 🤝  CRO — "Hit your number."

- **Score metric:** FORECAST ACCURACY
- **Win condition copy:** Forecast accuracy 94%. Rep admin time down 80%.
- **Victory line:** Number: hit. Forecast: math, not vibes. Reps: actually selling.

#### 1. THE FORECAST IS VIBES
*Slot theme: signature disaster · problems this quarter: 12*

> Your reps committed $14M for the quarter.  
> The methodology is each rep's gut, entered as a percentage.  
> The board review is tomorrow morning.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Re-score every deal against how similar deals actually closed | **BEST** | You walk in with $9.2M and defend it with evidence. It takes an all-nighter and $4.8M of uncomfortable conversations. |
| 2 | Apply a flat 30% haircut to every rep's commit | **OK** | Close enough at the top line, wrong on every individual deal. You cannot tell the board which ones will land. |
| 3 | Present the $14M — the team believes it | **BAD** | You miss by $5M. The credibility cost outlasts the quarter, and next quarter nobody believes the good news either. |

**BUT… (the root-cause beat):** You rebuilt this forecast by hand overnight. Next month it will be vibes again.

**POWER-UP UNLOCKED: 📈 Forecast Intelligence Agent**

- *Real capability:* Agentforce on pipeline data: deal scoring grounded in historical close patterns
- *What it now handles:* Every deal is scored continuously against what actually closes — the forecast is math you can interrogate.
- *Message:* "A forecast you cannot question is a guess with a spreadsheet."

#### 2. 40 DEALS NAMED 'FOLLOW UP'
*Slot theme: messy customer data · problems this quarter: 40*

> Your top rep's pipeline: 40 opportunities, all named "Follow up".  
> No close dates, no next steps, no amounts on 31 of them.  
> She is your best closer and she hates the CRM.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Walk her pipeline with her and fix it together in one sitting | **BEST** | Ninety minutes and her pipeline is clean and real. Thirty other reps have the same problem and you have one of you. |
| 2 | Have ops fill in the missing fields from email history | **OK** | The fields get populated with inference. The forecast now looks precise and is partly fiction. |
| 3 | Leave it — she closes regardless | **BAD** | She does. Then she leaves in month two of the next quarter and $3M of context leaves with her. |

**BUT… (the root-cause beat):** Your best closer should not be your worst data entry clerk — and cleaning up after her does not scale.

**POWER-UP UNLOCKED: 🗄️ Data 360 + SDR Agent**

- *Real capability:* Data Cloud unification with Agentforce SDR: automatic activity capture and enrichment
- *What it now handles:* Every call, email, and next step is logged and enriched on one record — without a rep typing it.
- *Message:* "Reps sell. Agents do the admin."

#### 3. MARKETING'S HOT LEAD IS ALREADY YOUR CUSTOMER
*Slot theme: disconnected systems · problems this quarter: 120*

> A rep just cold-pitched an account on a $400K renewal.  
> Marketing scored them as a net-new lead. Support has three open cases with them.  
> The customer used the word "unbelievable" and did not mean it kindly.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Call the customer personally, then connect the three systems on this account | **BEST** | The renewal survives and the account exec looks competent again. You fixed one account out of eleven thousand. |
| 2 | Apologise and tell reps to check Support before outreach | **OK** | Most will, most of the time. The one who does not gets the next embarrassing call. |
| 3 | Move on — no harm done, they stayed | **BAD** | They renew for one year instead of three and mention it in their reference call. |

**BUT… (the root-cause beat):** Sales, Marketing, and Support each knew a third of this customer. Nobody knew the customer.

**POWER-UP UNLOCKED: ☁️ Cross-Cloud Account Orchestration**

- *Real capability:* Agentforce orchestration across Sales, Marketing, and Service on one profile
- *What it now handles:* Open cases, renewal status, and campaign history are visible on the account before anyone reaches out.
- *Message:* "Your customer experiences one company. They should meet one."

#### 4. REPS SPEND SIX HOURS A DAY IN THE CRM
*Slot theme: technical debt / legacy · problems this quarter: 380*

> Required fields per opportunity went from 8 to 23 last quarter.  
> Your team logs activity until 7pm and sells between meetings.  
> Two reps quit citing "administrative work".

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Cut required fields to the 8 that drive the forecast | **BEST** | Selling time comes back immediately. You lose reporting granularity that three other teams had built dashboards on. |
| 2 | Hire two sales ops coordinators to do the logging | **OK** | Reps sell again at the cost of two headcount, and the data quality depends on people who were not on the call. |
| 3 | Make CRM hygiene part of the comp plan | **BAD** | Fields get filled. They get filled with whatever satisfies the rule, and the forecast gets worse while looking better. |

**BUT… (the root-cause beat):** You cut fields or you paid people to fill them. Either way a human is still transcribing conversations.

**POWER-UP UNLOCKED: 🧹 Agentforce SDR**

- *Real capability:* Agentforce SDR: autonomous activity capture, field updates, and follow-up
- *What it now handles:* Notes, next steps, and every required field are written from the actual conversation — automatically.
- *Message:* "Every hour a rep spends typing is an hour nobody spent selling."

#### 5. THE AI QUOTED 90% OFF
*Slot theme: AI mishap · problems this quarter: 1200*

> Your AI quoting assistant generated a proposal at 90% discount.  
> It is below cost, unsigned, and already in the prospect's inbox.  
> It has generated 600 quotes this quarter.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Retract the quote today and put margin floors on the agent | **BEST** | Awkward call, honest reason, deal survives at 22%. You also find two other quotes below floor before they are signed. |
| 2 | Honour it as a strategic logo win | **OK** | You win the logo at a loss and set a reference price. Their procurement team shares it with two peers. |
| 3 | Let the rep negotiate their way out of it | **BAD** | The prospect anchors on 90% and walks when it moves. You lose the deal and the relationship. |

**BUT… (the root-cause beat):** An agent that can price without a floor will eventually price below it. Once is a mistake; 600 times is exposure.

**POWER-UP UNLOCKED: 💹 Pricing Guardrails + Observability**

- *Real capability:* Agentforce pricing guidance with margin guardrails and full decision observability
- *What it now handles:* Quotes are bounded by margin policy, and every AI-generated price is auditable before it reaches a customer.
- *Message:* "Discounts by math, not by whatever the model felt."

---

### 🎧  HEAD OF CUSTOMER SERVICE — "Keep customers happy."

- **Score metric:** HONEST RESOLUTIONS
- **Win condition copy:** Deflection 64% — with zero confidently-wrong answers.
- **Victory line:** Queue: empty. CSAT: up. The AI made the right call — 4,000 times in a row.

#### 1. THE QUEUE IS AT FOUR HOURS
*Slot theme: signature disaster · problems this quarter: 12*

> 1,200 cases waiting. Average wait: four hours and eleven minutes.  
> You audit 100 of them: 71 are the same five questions.  
> Your hold music has one song.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Publish answers to the five questions and route them to self-serve | **BEST** | Wait times halve within two days. The 29% that need a human still wait two hours, and the five questions still get asked forever. |
| 2 | Authorise overtime and pull three people from Tier 2 | **OK** | The queue clears by Friday and rebuilds by Tuesday. Tier 2 escalations back up behind it. |
| 3 | Raise the target wait time to four hours | **BAD** | The number turns green. CSAT does not, and your team learns that the metric is the target, not the customer. |

**BUT… (the root-cause beat):** You answered the five questions once. They will be asked ten thousand more times this year.

**POWER-UP UNLOCKED: 📥 Service Agent (Auto-Resolve)**

- *Real capability:* Agentforce Service Agent: full resolution of routine cases, with honest handoff when unsure
- *What it now handles:* The five questions are resolved end-to-end in seconds — and anything ambiguous reaches a human with full context.
- *Message:* "Deflect the routine. Dignify the complex."

#### 2. ONE CUSTOMER, SIX RECORDS, SIX ANSWERS
*Slot theme: messy customer data · problems this quarter: 40*

> A customer has contacted you six times about the same issue.  
> Each contact created a new case against a different record.  
> They have been told three different things, all of them confidently.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Merge the records, assign one owner, and call them yourself | **BEST** | They stay, and they tell you it was the first time anyone knew who they were. You did this for one of eleven thousand accounts. |
| 2 | Assign the newest case to a senior agent to sort out | **OK** | This case gets resolved well. The five duplicate records remain and will fragment the next conversation. |
| 3 | Close five as duplicates and answer the newest | **BAD** | The customer sees five cases closed without explanation and escalates publicly. |

**BUT… (the root-cause beat):** Six records for one person means six versions of the truth. No amount of good agents fixes that.

**POWER-UP UNLOCKED: 🗄️ Data 360**

- *Real capability:* Data Cloud: identity resolution into one live customer profile
- *What it now handles:* Every contact — any channel, any time — lands on one record with the full history attached.
- *Message:* "You cannot give one answer to a customer you see six ways."

#### 3. STATUS PAGE GREEN, 4,000 SAY IT'S DOWN
*Slot theme: disconnected systems · problems this quarter: 120*

> Reports are arriving at 200 a minute from one region.  
> Monitoring shows all systems normal. The status page is green.  
> Engineering says they see nothing.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Trust the customers, declare an incident, and update the status page | **BEST** | A regional CDN failure is found in eighteen minutes. You spent the first ten arguing with a dashboard. |
| 2 | Ask agents to keep logging tickets while engineering investigates | **OK** | The pattern eventually becomes undeniable. Two thousand more customers hit it in the meantime. |
| 3 | Reply with the standard "we are not seeing an issue" macro | **BAD** | Four thousand people are told they are wrong about their own experience. That is the screenshot that travels. |

**BUT… (the root-cause beat):** Your customers detected the outage before your monitoring did — and nothing connected the two.

**POWER-UP UNLOCKED: 🕸️ Service Mesh Orchestration**

- *Real capability:* Agentforce orchestration correlating case spikes with system telemetry
- *What it now handles:* A ticket spike in one region automatically correlates to infrastructure signals, opens the incident, and corrects the status page.
- *Message:* "Your customers should never be your monitoring."

#### 4. THE MACRO LIBRARY CONTRADICTS ITSELF
*Slot theme: technical debt / legacy · problems this quarter: 380*

> 840 saved replies, written over nine years.  
> Three of them give different refund windows: 14, 30, and 90 days.  
> All three are in active use today.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Audit the top 100 macros and retire the contradictions | **BEST** | The refund answer is consistent within a week. The other 740 macros are still nine years of accumulated drift. |
| 2 | Add a note telling agents to verify policy before sending | **OK** | Careful agents verify. Busy agents send the macro, and the contradiction survives in the fast lane. |
| 3 | Delete the two older ones and hope they were unused | **BAD** | One was in a training doc. New hires learn a policy that no longer exists. |

**BUT… (the root-cause beat):** Nine years of copied answers is technical debt written in customer-facing language.

**POWER-UP UNLOCKED: 📚 Knowledge Unification**

- *Real capability:* Knowledge grounding: one current source of truth for every policy answer
- *What it now handles:* Agents and humans answer from the same live policy — contradictions cannot survive because there is one version.
- *Message:* "Every stale answer is a promise you did not mean to make."

#### 5. YOUR AI CONFIDENTLY MADE THE WRONG DECISION
*Slot theme: AI mishap · problems this quarter: 1200*

> Your AI told 300 customers the product they use is discontinued.  
> It is not. The AI was confident, fluent, and wrong.  
> Two customers have already quoted it in public reviews.

| # | Option | Quality | What happens |
|---|---|---|---|
| 1 | Correct all 300 personally and make the agent say "I am not sure" | **BEST** | You keep 287 of them. The fix that matters is the second half: the agent now escalates instead of inventing. |
| 2 | Post a public clarification and update the knowledge base | **OK** | The record is corrected for people who read clarifications. The 300 who were told directly mostly do not. |
| 3 | Let support handle the ones who complain | **BAD** | Eighty churn without complaining first. The reviews stay up and rank for your product name. |

**BUT… (the root-cause beat):** The failure was not that the AI did not know. It was that it did not know that it did not know.

**POWER-UP UNLOCKED: 🛡️ Guardrails + Honest Handoff**

- *Real capability:* Agentforce guardrails with grounded answers, confidence thresholds, and observability
- *What it now handles:* Answers are grounded in real product data, and low-confidence cases hand off to a human with context instead of guessing.
- *Message:* "The best thing an agent can say is: I don't know — let me get someone who does."
---

## 6. HONEST DIAGNOSIS — WHY IT STILL FALLS FLAT

You're right, and the reasons are structural rather than cosmetic. Eight named problems,
roughly in order of how much damage each does.

### 6.1 There is no decision, only a quiz
Each challenge has one pre-graded correct answer, and the game *tells you your grade
immediately* (`✓ BEST AVAILABLE CALL`). That converts judgment into multiple choice with an
answer key. A real decision needs at least one of: hidden information, a genuine tradeoff
between two goods, or uncertainty about the outcome. Currently there are none — the "best"
option is usually the one that sounds most responsible, which any executive will spot in
under a minute.

### 6.2 The reward is unconditional, so the choice doesn't matter
You get the power-up whether you chose brilliantly or catastrophically. Progression is on
rails. The only consequence of a bad choice is a smaller number in a corner. Nothing the
player does changes what happens next, which is the definition of a non-interactive story.

### 6.3 The power-up screen is product collateral, not a reward
Three labelled paragraphs — FEATURE / WHAT IT HANDLES / WHY IT MATTERS — is a slide. After the
second one, the player has learned the rhythm: *make a choice, receive a marketing panel.*
Rewards in games are things you **use**. This is a thing you **read**, and then it disappears
into a sidebar list where it never visibly does anything.

### 6.4 The score is decorative and the maths is a designer's constant
`AGENT_SHARE` is identical in every run, so the "exponential payoff" is determined before you
click anything. Worse, the headline multiple is **backwards**: perfect play shows 22×, all-bad
play shows 134×, because the human score is the denominator. The number rewards incompetence,
and it cannot survive a CFO asking how it was calculated. The survival target likewise cannot
be missed — it's computed as 90% of a score you're guaranteed to hit.

### 6.5 The drowning is gone, so the relief is unearned
The brief's one non-negotiable was *never skip the drowning*. Feedback pushed (correctly) away
from a frantic clicking queue, but the replacement has **no pressure of any kind**: no timer,
no scarcity, no fail state, no accumulating mess. "PROBLEMS THIS QUARTER: 380" is a label, not
an experience. If the player never feels overwhelmed, delegation isn't relief — it's arithmetic.

### 6.6 Nothing compounds, so there is no "run"
Challenge 4 is unaffected by challenges 1–3. The stack is a list, not a system: no agent
interacts with another, no early choice opens or closes a later option. Balatro is compelling
because your build makes later hands play differently. Here, five independent vignettes are
followed by a scripted finale. There's no strategy to discover and no story you authored.

### 6.7 The insight is asserted, not discovered
The `BUT…` box *tells* the player "you only bought time." The power-up copy *tells* them why it
matters. The victory screen *tells* them the multiple. Insight only lands when the player makes
the inference themselves — and right now every inference is pre-chewed. This is the direct
cause of "not insightful": the game explains instead of demonstrating.

### 6.8 The agents are invisible
This is a game about agents in which the agents never do anything you can watch, except in the
finale. They don't surprise you, don't make a judgment call you disagree with, don't show their
work, don't ask for permission. The single most interesting thing an AI product can do in a
game — act on your behalf and be *inspectable* — is absent.

### Content-level problems I can see in my own writing
- **`CEO #2` is anti-message.** Its "best" option is *"Commission a company-wide manual
  reconciliation"* — six weeks of human toil, marked correct, in a game arguing against exactly
  that. It should be the costly-but-defensible option, with something else as best.
- **The AI-mishap slot always lands fifth**, so every run's last human challenge is "the AI
  screwed up," immediately before the finale asks you to trust the AI completely. That rhythm
  works against the pitch.
- **Power-up naming mixes real and invented.** `Data 360` and `Agentforce SDR` are real; `The
  Briefing Agent`, `Spend Orchestration Agent` and `Close Automation Agent` are inventions
  dressed in the same typography. That undermines the credibility the brief was buying.
- **Options are too long to scan.** Some run 11–12 words; three of them stacked is a paragraph
  of reading per decision, which is where "button mashing" comes back — people skim and click.

---

## 7. DIRECTIONS THAT WOULD MAKE IT INTERESTING AND INSIGHTFUL

Ordered by leverage. Each names what it fixes and what it costs.

### 7.1 ⭐ Give power-ups a price and the player a budget
**Fixes 6.2, 6.3, 6.6.** One budget for the year (say 6 credits) across 8 challenges, with
capabilities priced differently: a point agent costs 1, cross-cloud orchestration costs 2,
Data 360 costs 3. Now you cannot have everything, the power-up screen becomes a **decision**,
and the stack becomes a build with opportunity cost. Replay diverges immediately.
*Bonus:* Data 360 being expensive-but-multiplying everything else is the readiness argument
made mechanical rather than stated.
**Cost:** you must accept that some runs end weaker than others.

### 7.2 ⭐ Make band-aided problems come back
**Fixes 6.6, 6.7, and most of "not insightful".** If you hand-fix a problem, it returns two
challenges later, bigger, with a worse option set ("the same refund bug, now across three
regions"). If you fixed the *cause* with a capability, it never returns — and the victory
screen lists **what didn't happen**. The player derives the root-cause lesson from their own
history instead of being told it in a pink box. Delete the `BUT…` box entirely once this exists.
**Cost:** authoring second-wave variants (~1 extra scenario per challenge).

### 7.3 ⭐ Investigation before decision — the actual Papers, Please mechanic
**Fixes 6.1, 6.5.** Papers, Please isn't about the verdict, it's about *the looking*. Before
choosing, let the player spend limited attention (3 "looks" per challenge) on things like
`OPEN THE EMAIL` · `CHECK THE RECORD` · `CALL THE REP` · `READ THE LOG`. Each reveals a fact
that can flip which option is right — so the same three options become a real decision, and
skipping investigation is a legitimate gamble under pressure. This also finally makes the
**blind spot** idea work: some looks are unavailable to your seat *until an agent provides that
context*, which is the "agents see what you can't" message as a mechanic instead of a caption.
**Cost:** 3–4 extra lines of content per challenge; the highest authoring cost on this list.

### 7.4 Let the agents act, visibly and imperfectly
**Fixes 6.8, and dramatizes guardrails/observability properly.** Once you own an agent, some
problems arrive **already handled**, with a receipt: *"Anomaly Watcher held 3 refunds over
policy — approve, or override?"* Occasionally it gets one wrong in a way you can catch by
looking. The player experiences delegation *and* the need for oversight, instead of reading
about both. This is the single best way to make the product story feel earned.
**Cost:** a new interaction pattern; needs care not to feel like extra busywork.

### 7.5 Stop grading the player
**Fixes 6.1.** Remove `✓ BEST AVAILABLE CALL`. Show only what happened, in-fiction. Let quality
surface later through recurrence (7.2) and the endgame tally. Uncertainty about whether you did
well is what makes people replay and discuss.
**Cost:** near zero. Do this regardless.

### 7.6 Replace the invented multiple with an unarguable comparison
**Fixes 6.4.** Delete `22×`. End on facts the player generated: *problems you touched: 8 ·
problems handled without you: 5,331 · disasters that never came back: 3 of 5 · capabilities you
couldn't afford: 2*. Then one honest line about what the unfixed causes will cost next year.
That's a board slide an executive would actually repeat.
**Cost:** none, and it removes the credibility risk in the current maths.

### 7.7 A loss condition made of fiction, not a health bar
**Fixes 6.5.** No stability meter. Instead: if three problems recur unfixed, the board replaces
you — on a screen naming exactly which recurring problems did it. Losable, thematic, and it
teaches the root-cause lesson in the most memorable way available.
**Cost:** demo risk. A losable game can embarrass an executive in a live demo, so it may want a
"demo mode" toggle.

### 7.8 Fewer, deeper challenges
**Fixes 6.1, 6.6.** Three challenges with two stages each beats five one-shot cards, where
stage 2 is authored *against your stage 1 choice*. Same runtime, far more feeling of causality.

### 7.9 Compress the power-up to one line, move detail to the end
**Fixes 6.3.** `🛡️ Campaign Guardrail Agent — every send checked against live segments before it
can go out.` That's it. Full feature detail belongs on the victory screen for whoever wants it.

### 7.10 Make the accumulating mess visible
**Fixes 6.5 without a timer.** Keep a persistent, growing **STILL OPEN** list of the problems
you band-aided, visible on every screen. It grows as you make expedient choices and shrinks
when a capability retires a whole class of problem. Pressure without twitch.

### The strategic fork worth deciding first
There are two different products here and they want different things:

- **A demo instrument** — the job is to be memorable, honest, and safe in front of a customer in
  five minutes. Then prioritise 7.6, 7.9, 7.2 and skip anything losable.
- **An actual game people share** — the job is tension and replay. Then 7.1, 7.2, 7.3 and 7.7
  are the build, and it needs to be genuinely losable.

Trying to be both is a large part of why the current version satisfies neither.

### Fastest path to something meaningfully better
If you only change three things: **7.1 (a budget), 7.2 (problems recur), 7.5 (stop grading)**.
Together they turn five independent quizzes into one causal run with real stakes, and they can
reuse every word of existing content.

---

## 8. WHAT IS WORTH KEEPING

Not everything needs rebuilding:

- **The art and the arcade identity.** The supplied illustrations, the headshots, the
  magenta/cyan/green palette, the full-screen title, the AGENTFORCE UNLOCKED creative.
- **The writing voice.** The specificity ("$0.00 and also $40,000", "Lead name: Steve. Company:
  Steve"), the competent-human-in-a-broken-system stance, the refusal to overclaim.
- **The four-theme spine** (messy data / disconnected systems / technical debt / AI mishap) with
  each theme tied to a real capability — that structure is sound and reusable under any mechanic.
- **The Manual Ops Inc. comparison** as a *concept*, once its maths is replaced with facts (7.6).
- **The "even the best call only buys time" premise.** It's the strongest idea in the whole
  design. It just needs to be *demonstrated through recurrence* rather than announced in a box.
- **Role-specific content.** 30 unique challenges and 90 unique options is real, reusable asset
  value regardless of what happens to the loop around them.

---

## 9. FILE MAP FOR TROUBLESHOOTING

| Path | Contents |
|---|---|
| `src/gameData.js` | All content: constants at the top, then 6 roles × 5 challenges. Edit copy and numbers here. |
| `src/WhoBrokeTheBusiness.jsx` | The whole game: phase machine, scoring, all screens. Search for `phase ===` to find a screen. |
| `src/art/`, `src/avatars/` | Supplied art and the six headshots (`<roleKey>.png`, auto-wired). |
| `docs/GAME-DESIGN-PLAYBACK.md` | This document. |

Tuning knobs, all in `src/gameData.js`: `CHAOS_VOLUME` (perceived scale), `AGENT_SHARE` (how
fast agents take over), `CHOICE_POINTS` (how much human judgment is worth), `POINTS_PER_PROBLEM`
(the exchange rate that produces the headline multiple).
