/* ============================================================
   WHO BROKE THE BUSINESS? — game data (v7 roguelite cut)

   One loop: tickets flood in real time → you clear what one
   human can → between quarters you draft one agent → your
   stack intercepts the rest → the year-end audit pays it off.

   Zero logic in this file. All content and tuning lives here.
   ============================================================ */

/* ---------------- tuning constants ---------------- */

export const TUNING = {
  QUARTER_SECONDS: 40,          // one quarter of real time
  DAYS_PER_QUARTER: 90,         // what those seconds represent
  SPAWN_PER_QUARTER: [18, 30, 48, 70],
  SPAWN_ACCEL: 0.62,            // <1 = spawns cluster toward quarter end
  HANDLE_HOLD_MS: 1200,         // click-and-hold to clear a ticket
  GRACE_MS: 4000,               // unhandled tickets are free this long
  DAMAGE_PER_TICK: 1,           // meter points per DAMAGE_TICK_MS unhandled
  DAMAGE_TICK_MS: 2000,
  AGENT_HANDLE_MS: 2200,        // each drafted agent fires this often
  AGENT_CROSSLANE_MULT: 0.5,    // off-lane speed with the Orchestrator
  AGENT_IDLE_MULT: 0.4,         // off-lane speed when idle without it
  DATA360_RATE_MULT: 1.5,       // Data 360 speeds up every OTHER agent
  METER_START: { productivity: 80, happiness: 80, debt: 25 },
  ROLE_SPAWN_WEIGHT: 0.45,      // share of tickets drawn from your own seat
  BOSS_VOLUME: 4000,
  BOSS_AGENTS_TO_CLEAR: 3,      // never shown on screen
  LOSS_AUDIT_DAY: 340,
  WIN_DAY: 365,
  DRAFT_POOL_SIZE: 10,
  /* Manual Ops mode: same game, no drafts, tuned to kill
     between day 40 and day 90. Do not soften it. */
  MANUAL_OPS: { spawnMult: 2.4, damageMult: 3.2 },
  DEMO_SEED: 20260729,
};

/* ---------------- themes ----------------
   Every ticket carries one of the five slot themes.
   meter: which meter it hits ('debt' RISES instead of draining). */

export const THEMES = {
  signature:    { label: 'SIGNATURE',   meter: 'productivity', color: '#ff2e9a' },
  messyData:    { label: 'MESSY DATA',  meter: 'happiness',    color: '#ffe600' },
  disconnected: { label: 'DISCONNECTED', meter: 'productivity', color: '#2ee6ff' },
  techDebt:     { label: 'TECH DEBT',   meter: 'debt',         color: '#ff5555' },
  aiMishap:     { label: 'AI MISHAP',   meter: 'happiness',    color: '#b26bff' },
};

/* slot order is fixed: signature, messy data, disconnected, tech debt, AI mishap */
export const SLOT_THEMES = ['signature', 'messyData', 'disconnected', 'techDebt', 'aiMishap'];

/* ---------------- roles + the 30-headline ticket pool ----------------
   Each role: 5 headlines in slot-theme order. `death` is the loss-card
   cause-of-death line; {n} is filled with spawnCount × per. */

const t = (headline, death, per = 0) => ({ headline, death, per });

export const ROLES = [
  {
    key: 'ceo', name: 'CEO', emoji: '👩‍💼', tagline: 'Grow the business.',
    tickets: [
      t('TWO TEAMS, TWO REVENUE NUMBERS', '{n} board pre-reads, no two numbers matching', 3),
      t('NOBODY AGREES WHO THE CUSTOMER IS', '{n} definitions of "customer", zero agreement', 3),
      t('THREE DEPARTMENTS, ONE PROJECT, ZERO PROGRESS', '{n} competing roadmaps for the same launch', 2),
      t("OPS RUNS ON DAVE'S SPREADSHEET", "Dave's spreadsheet ran the company. Dave ran out."),
      t('THE AI BOARD SUMMARY INVENTED A METRIC', 'the AI invented {n} metrics and the board quoted all of them', 2),
    ],
  },
  {
    key: 'cfo', name: 'CFO', emoji: '💰', tagline: 'Protect the bottom line.',
    tickets: [
      t('YOUR CHATBOT REFUNDED EVERYONE', 'your chatbot refunded ${n} and was very sorry', 85000),
      t('ONE VENDOR, FOUR SPELLINGS, FOUR CONTRACTS', '{n} vendors, each spelled four ways, all at list price', 4),
      t('THREE TOOLS, ONE JOB, ALL AUTO-RENEWED', '{n} tools doing one job, all auto-renewed', 3),
      t('MONTH-END CLOSE IS 300 MANUAL ENTRIES', '{n} manual journal entries. The books never closed.', 300),
      t('THE AI EXPENSE APPROVER APPROVED A BOAT', 'the AI approved a boat. Then {n} more boats.', 2),
    ],
  },
  {
    key: 'cto', name: 'CTO', emoji: '💻', tagline: 'Keep the tech stack from collapsing.',
    tickets: [
      t('SUPPORT TICKETS ARE BURYING ENGINEERING', '{n} password resets escalated to your best engineers', 380),
      t('THREE SYSTEMS, THREE VERSIONS OF ONE CUSTOMER', '{n} versions of every customer, all confidently wrong', 3),
      t('PROD IS DOWN AND NOBODY OWNS THE HANDOFF', 'checkout down {n} minutes. Status page: green.', 22),
      t('THE DOS TERMINAL IS BEEPING', 'the DOS terminal beeped {n} times. Then it stopped.', 214),
      t('THE AI CODE REVIEWER APPROVED A SECRET LEAK', 'the AI reviewer said "LGTM" to {n} leaked keys', 2),
    ],
  },
  {
    key: 'cmo', name: 'CMO', emoji: '📈', tagline: 'Generate leads Sales actually wants.',
    tickets: [
      t('MARKETING EMAILED THE WRONG LIST', '"Welcome back!" sent to {n} people who left angry', 6000),
      t('EVERY CUSTOMER IS CALLED STEVE', '{n} customers named Steve', 38),
      t('SALES SAYS YOUR LEADS ARE GARBAGE', '{n} MQLs delivered. Sales worked none of them.', 2400),
      t('ATTRIBUTION SAYS THE FAX MACHINE DROVE Q2', 'the budget was planned around a fax machine disconnected in 2019'),
      t("THE AI WROTE AN AD FOR A PRODUCT YOU DON'T SELL", 'the AI advertised {n} products you do not sell', 6),
    ],
  },
  {
    key: 'cro', name: 'CRO', emoji: '🤝', tagline: 'Hit your number.',
    tickets: [
      t('THE FORECAST IS VIBES', '${n}M of committed vibes', 5),
      t("40 DEALS NAMED 'FOLLOW UP'", '{n} deals named "Follow up", zero next steps', 40),
      t("MARKETING'S HOT LEAD IS ALREADY YOUR CUSTOMER", 'your hottest lead was already your angriest customer — {n} times', 3),
      t('REPS SPEND SIX HOURS A DAY IN THE CRM', '{n} rep-hours spent typing instead of selling', 800),
      t('THE AI QUOTED 90% OFF', 'the AI quoted 90% off, {n} times', 12),
    ],
  },
  {
    key: 'cs', name: 'Head of Customer Service', emoji: '🎧', tagline: 'Keep customers happy.',
    tickets: [
      t('THE QUEUE IS AT FOUR HOURS', 'the queue hit {n} hours and the hold music had one song', 4),
      t('ONE CUSTOMER, SIX RECORDS, SIX ANSWERS', '{n} records per customer, six answers per question', 6),
      t("STATUS PAGE GREEN, 4,000 SAY IT'S DOWN", '{n} customers reported the outage before monitoring did', 800),
      t('THE MACRO LIBRARY CONTRADICTS ITSELF', '{n} macros, three refund policies, zero agreement', 280),
      t('YOUR AI CONFIDENTLY MADE THE WRONG DECISION', 'the AI told {n} customers their product was discontinued. It was not.', 300),
    ],
  },
];

/* flat ticket pool: 30 entries with role + theme tags */
export const TICKET_POOL = ROLES.flatMap((r) =>
  r.tickets.map((tk, slot) => ({
    role: r.key,
    theme: SLOT_THEMES[slot],
    headline: tk.headline,
    death: tk.death,
    per: tk.per,
  }))
);

/* ---------------- the 10-card draft pool ----------------
   Six role flagships (slot-1 power-ups, condensed) + four
   cross-cutting cards. `rule` is the intercept rule in plain
   language; `capability` is the real-capability line.
   `custom: true` renders the CUSTOM AGENT · BUILT ON AGENTFORCE
   subtitle (the v6 naming rule).

   Intercept lanes (implemented in the component):
   - flagship: tickets from its role, plus any signature ticket
   - data360:  messy-data tickets; merges duplicates; every OTHER
               agent fires DATA360_RATE_MULT faster
   - orchestrator: disconnected tickets; every drafted agent may
               take off-lane tickets at half speed
   - guardrails: AI-mishap tickets spawn pre-blocked, zero damage
   - flow:     tech-debt tickets; TECHNICAL DEBT rises half as fast */

export const DRAFT_POOL = [
  {
    key: 'brief', kind: 'flagship', role: 'ceo', icon: '🧠',
    name: 'THE BRIEFING AGENT', short: 'BRIEFING AGENT', custom: true,
    rule: 'Intercepts CEO fires — board numbers, alignment, launches.',
    capability: 'Agentforce on Data 360: grounded answers from live company data.',
  },
  {
    key: 'sentinel', kind: 'flagship', role: 'cfo', icon: '🛡️',
    name: 'REFUND SENTINEL', short: 'REFUND SENTINEL', custom: true,
    rule: 'Intercepts finance fires — rogue refunds, renewals, runaway spend.',
    capability: 'Agentforce Service Agent with policy guardrails on payments.',
  },
  {
    key: 'tier1', kind: 'flagship', role: 'cto', icon: '🐛',
    name: 'SERVICE AGENT · TIER 1', short: 'SERVICE AGENT', custom: false,
    rule: 'Intercepts tech fires — escalations, outages, the beeping box.',
    capability: 'Agentforce Service Agent: resolves routine cases end-to-end.',
  },
  {
    key: 'campaign', kind: 'flagship', role: 'cmo', icon: '📣',
    name: 'CAMPAIGN GUARDRAIL AGENT', short: 'CAMPAIGN AGENT', custom: true,
    rule: 'Intercepts marketing fires — wrong lists, junk leads, phantom channels.',
    capability: 'Agentforce + Marketing Cloud: audience checks before every send.',
  },
  {
    key: 'forecast', kind: 'flagship', role: 'cro', icon: '📈',
    name: 'FORECAST INTELLIGENCE AGENT', short: 'FORECAST AGENT', custom: true,
    rule: 'Intercepts sales fires — vibe forecasts, stale pipeline, CRM drag.',
    capability: 'Agentforce on pipeline data: deal scoring from real close patterns.',
  },
  {
    key: 'resolve', kind: 'flagship', role: 'cs', icon: '📥',
    name: 'SERVICE AGENT · AUTO-RESOLVE', short: 'SERVICE AGENT', custom: false,
    rule: 'Intercepts service fires — queues, duplicate cases, angry reviews.',
    capability: 'Agentforce Service Agent: full resolution with honest handoff.',
  },
  {
    key: 'data360', kind: 'data360', icon: '🗄️',
    name: 'DATA 360', short: 'DATA 360', custom: false,
    rule: 'Merges duplicate tickets into one. Every other agent works 1.5× faster.',
    capability: 'Data Cloud: one live record per real customer, everywhere.',
  },
  {
    key: 'orchestrator', kind: 'orchestrator', icon: '☁️',
    name: 'CROSS-CLOUD ORCHESTRATOR', short: 'ORCHESTRATOR', custom: false,
    rule: 'Every drafted agent can now grab tickets outside its lane at half speed.',
    capability: 'Agentforce multi-agent orchestration across every cloud.',
  },
  {
    key: 'guardrails', kind: 'guardrails', icon: '🚧',
    name: 'GUARDRAILS + OBSERVABILITY', short: 'GUARDRAILS', custom: false,
    rule: 'AI-mishap tickets arrive pre-blocked, stamped with a receipt. Zero damage.',
    capability: 'Agentforce guardrails, grounding, and full action logs.',
  },
  {
    key: 'flow', kind: 'flow', icon: '⚙️',
    name: 'PROCESS AUTOMATION (FLOW)', short: 'FLOW', custom: false,
    rule: 'Intercepts tech-debt tickets and halves TECHNICAL DEBT rise.',
    capability: 'Agentforce + Flow: manual processes become logged automations.',
  },
];
