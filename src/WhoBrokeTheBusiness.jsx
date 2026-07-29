import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ============================================================
   WHO BROKE THE BUSINESS?
   A 5-round business-chaos roguelite in 8-bit arcade dress.

   Core loop: every ticket is a DECISION (handle / route /
   escalate / delegate), Papers-Please style. Agents arrive
   with an integration ramp and misfire on dirty data until
   the player takes the "Fix the Data" readiness step.
   ============================================================ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const ROUND_CFG = {
  1: { tickets: 8, spawnMs: 2600, triageSec: 26, escalateMs: 9500 },
  2: { tickets: 12, spawnMs: 2000, triageSec: 28, escalateMs: 9000 },
  3: { tickets: 16, spawnMs: 1500, triageSec: 28, escalateMs: 8500 },
  4: { tickets: 22, spawnMs: 1100, triageSec: 28, escalateMs: 8000 },
  5: { tickets: 110, spawnMs: 65, triageSec: 0, escalateMs: 2400 },
};
const GHOST_DECAY = { 1: 1, 2: 0.7, 3: 0.4, 4: 0.15, 5: 0 };
const ACTION_POINTS = { handle: 15, route: 10, escalate: 10 };
const DEGRADED_FACTOR = 0.25; // agents on dirty data run at 25% of advertised

const CATS = {
  ops: { emoji: '🔥', label: 'ops' },
  data: { emoji: '📊', label: 'data' },
  people: { emoji: '👥', label: 'people' },
};
const CAT_KEYS = Object.keys(CATS);

const KINDS = ['handle', 'route', 'escalate'];
const KIND_UI = {
  handle: { chip: 'ROUTINE', color: 'text-[#8b8ba0] border-[#8b8ba0]/60', btn: '✋ HANDLE' },
  route: { chip: 'TEAM', color: 'text-[#2ee6ff] border-[#2ee6ff]/70', btn: '➡ ROUTE' },
  escalate: { chip: 'CRITICAL', color: 'text-[#ff2d2d] border-[#ff2d2d]', btn: '⚠ ESCALATE' },
};

/* ---------- card factory: every card maps to a real capability ---------- */
const mk = (name, emoji, type, value, cat, cap, effect, msg) => ({
  name, emoji, type, value, cat, cap, effect, msg,
});

const FIX_DATA = mk(
  'Fix the Data', '🗄️', 'data', null, 'all',
  'Data 360 (Data Cloud): dedupe, unify, and ground every agent in one customer record',
  'Removes the dirty-data penalty. Every agent you deploy performs as advertised.',
  'AI on top of bad data is a power-up that doesn\'t power anything.'
);

/* Decoys are weaker-but-real capabilities — no generic "AI Boost" cards. */
const DECOYS = [
  [
    mk('Prompt Templates', '📝', 'additive', 300, 'data',
      'Prompt Builder: reusable prompts that help humans draft faster',
      '+300 capacity. Assists your people; doesn\'t act for them.',
      'Assist is a start. Autonomy is the goal.'),
    mk('Flow Shortcuts', '⚙️', 'additive', 250, 'ops',
      'Flow: click-path automation for one team\'s process',
      '+250 capacity. Automates one lane, ignores the highway.',
      'Local fixes help one lane. Chaos uses all of them.'),
  ],
  [
    mk('Chatbot Classic', '💬', 'trigger', 150, 'people',
      'Legacy scripted chatbot: keyword-matched FAQ responses',
      '+150 capacity. Answers questions; can\'t resolve them.',
      'Scripts answer. Agents resolve. Customers can tell.'),
  ],
  [
    mk('Dashboard Pack', '📊', 'multiplier', 1.2, 'data',
      'CRM Analytics: more dashboards on the same fragmented data',
      '×1.2 impact. You\'ll see the chaos in higher resolution.',
      'Seeing isn\'t solving.'),
    mk('Approval Matrix', '🧾', 'multiplier', 1.3, 'ops',
      'Flow approvals: routed sign-offs with an audit trail',
      '×1.3 impact. The chaos now waits politely in a queue.',
      'Process without intelligence is just slower chaos.'),
  ],
  [
    mk('Point Integrations', '🔌', 'orchestrator', 1.6, 'all',
      'Custom one-to-one integrations between each pair of tools',
      '×1.6 impact. N² wires, each with its own failure mode.',
      'Wiring tools together is not the same as agents working together.'),
    mk('RPA Scripts', '🤖', 'orchestrator', 1.7, 'all',
      'Screen-scraping macros replaying human clicks',
      '×1.7 impact. Breaks the day anyone moves a button.',
      'Automation that imitates humans inherits their bottlenecks.'),
  ],
];

/* ---------- roles: mission, metric, ticket mix, cards ---------- */

const ROLES = [
  {
    key: 'ceo', name: 'CEO', emoji: '👩‍💼', img: null, tagline: 'Grow the business.', base: 100,
    mission: 'Get one number the whole company believes.',
    metric: 'CROSS-SILO VISIBILITY',
    team: 'DEPT HEADS',
    mix: { handle: 0.35, route: 0.4, escalate: 0.25 },
    win: 'Every team now reports the same revenue number. On purpose.',
    victory: 'One source of truth. Every team, one number. The board deck finally agrees with itself.',
    waves: [
      ['SILO STORM', 'Every team has a different number for revenue. All of them are confident.'],
      ['BOARD MEETING TOMORROW', 'The deck contradicts itself on slides 4, 9, and 31.'],
      ['REORG RUMORS', 'Three departments claim ownership of the same project. None of them are working on it.'],
      ['EARNINGS WEEK', 'Everyone wants a narrative. Nobody has the data.'],
      ['THE PERFECT STORM', 'Activist investor. Leaked memo. And the KPI dashboard just went down.'],
    ],
    tickets: {
      handle: [
        'Q3 forecast is a screenshot of a whiteboard',
        'The KPI dashboard shows 404',
        'All-hands question: "What is our strategy?" — asked by the strategy team',
        'Merger rumor started by our own newsletter',
      ],
      route: [
        'Sales says revenue is $4M. Finance says $2.8M. Both are "sure."',
        'Regional office reports in a different currency. Sometimes.',
        'Ops runs on a spreadsheet only Dave understands. Dave quit.',
        'Board deck v47_FINAL_final2.pptx contradicts v46',
      ],
      escalate: [
        'Two departments launched the same product this morning',
        'Someone approved a rebrand. Nobody knows who.',
        'Legal just heard about the product launch. From a customer.',
      ],
    },
    cards: [
      mk('The Blueprint Builder', '📐', 'additive', 500, 'ops',
        'Agentforce + Flow: automates routine approvals, reporting requests, and status chasing',
        '+500 capacity once integrated. Takes routine 🔥 ops tickets end-to-end.',
        'Routine work is the first thing agents should own.'),
      mk('The Strategic Ear', '👂', 'trigger', 250, 'data',
        'Agentforce observability: monitors KPIs across clouds, flags contradictions in real time',
        '+250 capacity. Pounces on 📊 data chaos the moment it appears.',
        'You can\'t steer what you can\'t see.'),
      mk('Cross-Cloud Orchestrator', '☁️', 'multiplier', 1.5, 'people',
        'Cross-cloud automation: one workflow spanning Sales, Service, and Finance',
        '×1.5 impact. Compounds every agent below it across silos.',
        'Silos are a speed tax. This is the refund.'),
      mk('The Company Brain', '🧠', 'orchestrator', 2.0, 'all',
        'Multi-agent orchestration (Atlas Reasoning Engine): agents coordinating on one plan',
        '×2.0 impact. Links every agent you\'ve drafted into one system.',
        'Agents that coordinate beat agents that coexist.'),
    ],
  },
  {
    key: 'cfo', name: 'CFO', emoji: '💰', img: null, tagline: 'Protect the bottom line.', base: 100,
    mission: 'Cut cost-per-resolution without cutting corners.',
    metric: '$ PROTECTED',
    team: 'AUDIT',
    mix: { handle: 0.4, route: 0.3, escalate: 0.3 },
    win: 'Cost per resolution: down 62%. Duplicate tools: 0.',
    victory: 'Every dollar accounted for. The bottom line started protecting itself.',
    waves: [
      ['COST SPIRAL', 'Three tools doing the same job. All three auto-renewed at midnight.'],
      ['REFUND MELTDOWN', 'Your chatbot has been issuing refunds. Enthusiastically.'],
      ['AUDIT SEASON', 'The auditors have questions. The spreadsheet has circular references.'],
      ['BUDGET LOCKDOWN', 'Every department wants more. The numbers want less.'],
      ['THE PERFECT STORM', 'Quarter close, a rogue chatbot, and the cloud bill just doubled itself.'],
    ],
    tickets: {
      handle: [
        'Expense report: "team morale" — $18,500',
        'Invoice #4471 is 90 days late. Customer: "what invoice?"',
        'Vendor raised prices via a footnote',
        'Budget sheet has a circular reference and an attitude',
      ],
      route: [
        'Three tools doing the same job. All auto-renewed.',
        'Cloud bill doubled. Nobody deployed anything.',
        'Duplicate payment sent twice, to be safe',
      ],
      escalate: [
        'Refund issued: $0.00 and also $40,000',
        'Chatbot offered "unlimited refunds forever"',
        'Someone bought Super Bowl ad space "as a test"',
      ],
    },
    cards: [
      mk('Invoice Chaser', '🧾', 'additive', 400, 'ops',
        'Agentforce for Finance: autonomous invoice follow-up and dunning via Flow',
        '+400 capacity once integrated. Owns routine 🔥 collections end-to-end.',
        'Collections don\'t need a human until a human is needed.'),
      mk('Anomaly Watcher', '🚨', 'trigger', 250, 'data',
        'Agentforce observability: real-time expense and refund anomaly detection',
        '+250 capacity. Pounces on 📊 spend anomalies as they post.',
        'Catch the $40,000 refund before it posts, not after.'),
      mk('Vendor Auto-Negotiator', '🤝', 'multiplier', 1.5, 'people',
        'Agentforce on contract data: renewal analysis and duplicate-tool detection',
        '×1.5 impact. Compounds savings across every contract.',
        'Three tools, one job, zero surprise renewals.'),
      mk('The Ledger Mind', '🧮', 'orchestrator', 2.0, 'all',
        'Multi-agent orchestration: finance agents reconciling against one ledger',
        '×2.0 impact. Links every agent into one auditable system.',
        'Agents that coordinate beat agents that coexist.'),
    ],
  },
  {
    key: 'cto', name: 'CTO', emoji: '💻', img: null, tagline: 'Keep the stack from collapsing.', base: 100,
    mission: 'Keep engineers building, not firefighting.',
    metric: 'UPTIME SHIPPED',
    team: 'PLATFORM',
    mix: { handle: 0.25, route: 0.4, escalate: 0.35 },
    win: 'Tier-1 deflection: 78%. Engineering interrupts: down 71%.',
    victory: 'The stack held. Engineering is building again — not firefighting.',
    waves: [
      ['TICKET AVALANCHE', 'Support tickets are being escalated straight to engineering. All of them.'],
      ['DEBT COLLECTION', 'The technical debt now has its own technical debt.'],
      ['LEGACY AWAKENS', 'The DOS terminal in the corner is beeping. Nobody will touch it.'],
      ['DEPLOY FREEZE', 'Prod is down. Staging is fine. Nobody knows why.'],
      ['THE PERFECT STORM', 'Prod is down, the on-call quit, and the DOS terminal is beeping in Morse code.'],
    ],
    tickets: {
      handle: [
        'New hire asked what the "legacy system" does. Silence.',
        "The wiki's last update: 2019",
        'Support ticket escalated straight to engineering. Again.',
      ],
      route: [
        '17 microservices. 1 works.',
        'CI red for 6 days, labeled "known issue"',
        'Technical debt now has its own technical debt',
        'The DOS terminal is beeping. Nobody will touch it.',
      ],
      escalate: [
        'Prod is down. Staging is fine. Nobody knows why.',
        'Someone force-pushed to main on a Friday',
        'Mainframe password was on a sticky note. Sticky note gone.',
      ],
    },
    cards: [
      mk('Bug Triage Protocol', '🐛', 'additive', 500, 'ops',
        'Agentforce Service Agent: Tier-1 ticket classification and deflection',
        '+500 capacity once integrated. Deflects routine 🔥 tickets before they hit engineering.',
        'Deflection keeps engineers building.'),
      mk('SLA Enforcer', '⏱️', 'trigger', 250, 'data',
        'Agentforce observability: SLA breach prediction and proactive alerting',
        '+250 capacity. Pounces on 📊 breach risk before the customer notices.',
        'Know before the customer does.'),
      mk('Knowledge Architect', '📚', 'multiplier', 1.5, 'people',
        'Knowledge unification: agents grounded in one current source of truth',
        '×1.5 impact. Every answer compounds instead of contradicting.',
        'Answers from the wiki that\'s actually current.'),
      mk('The Systems Conductor', '🎛️', 'orchestrator', 2.0, 'all',
        'Multi-agent orchestration (Atlas Reasoning Engine) across the incident lifecycle',
        '×2.0 impact. Links every agent into one incident-response system.',
        'Agents that coordinate beat agents that coexist.'),
    ],
  },
  {
    key: 'cmo', name: 'CMO', emoji: '📈', img: null, tagline: 'Generate leads Sales actually wants.', base: 100,
    mission: 'Fill the pipeline with leads Sales actually wants.',
    metric: 'QUALIFIED PIPELINE',
    team: 'SALES',
    mix: { handle: 0.3, route: 0.35, escalate: 0.35 },
    win: 'Lead quality: up 3.4×. Steves in CRM: 1 (verified human).',
    victory: 'Sales just asked for MORE leads. Every one is a real person. None of them are named Steve.',
    waves: [
      ['PIPELINE DROUGHT', 'The funnel chart looks great. The funnel is empty.'],
      ['WRONG LIST', 'The campaign just emailed the churn list a "welcome back!"'],
      ['THE STEVE PROBLEM', 'Every customer in the CRM is named Steve. Every single one.'],
      ['LAUNCH WEEK', 'Five channels, one intern, zero attribution.'],
      ['THE PERFECT STORM', 'Product launch, wrong list, and 40,000 people just got "Hi {FirstName}".'],
    ],
    tickets: {
      handle: [
        'Webinar has 3 registrants. Two are your interns.',
        'Brand guidelines: 200 pages. Nobody read page 2.',
        'Attribution model says the fax machine drove Q2',
      ],
      route: [
        'Lead name: Steve. Company: Steve. Email: steve',
        'Every customer in the CRM is named Steve',
        'Pipeline is empty but the funnel chart looks great',
      ],
      escalate: [
        'Campaign emailed the churn list a "welcome back!"',
        'Sent "Hi {FirstName}" to 40,000 people',
        'Paid ads targeting: "everyone, everywhere"',
        'Influencer posted the wrong product. It sold out.',
      ],
    },
    cards: [
      mk('Intent Scorer', '🎯', 'additive', 400, 'ops',
        'Agentforce + Data 360 segments: intent scoring on unified customer profiles',
        '+400 capacity once integrated. Qualifies routine 🔥 leads automatically.',
        'Leads Sales wants start with data Sales trusts.'),
      mk('Audience Orchestrator', '📣', 'trigger', 250, 'data',
        'Marketing Cloud engagement triggers: acts on intent signals in real time',
        '+250 capacity. Pounces on 📊 engagement the moment it spikes.',
        'React to intent in minutes, not Mondays.'),
      mk('Micro-Personalization Engine', '🔬', 'multiplier', 1.5, 'people',
        '1:1 personalization on unified profiles — the right message, not the loudest',
        '×1.5 impact. Every touch compounds instead of annoying.',
        'Personal beats loud.'),
      mk('Autonomous Campaign Manager', '🚀', 'orchestrator', 2.0, 'all',
        'Multi-agent orchestration: campaign agents planning, testing, and reallocating together',
        '×2.0 impact. Links every agent into one revenue engine.',
        'Agents that coordinate beat agents that coexist.'),
    ],
  },
  {
    key: 'cro', name: 'CRO', emoji: '🤝', img: null, tagline: 'Hit your number.', base: 100,
    mission: 'Make the forecast math, not vibes.',
    metric: 'FORECAST ACCURACY',
    team: 'DEAL DESK',
    mix: { handle: 0.35, route: 0.4, escalate: 0.25 },
    win: 'Forecast accuracy: 94%. Rep admin time: down 80%.',
    victory: 'Number: hit. Forecast: math, not vibes. Reps: actually selling.',
    waves: [
      ['ADMIN SWAMP', 'Your reps spent 6 hours updating CRM fields today. They sold nothing.'],
      ['EMPTY FIELDS', 'The CRM is a beautiful, expensive void.'],
      ['FORECAST: VIBES', 'The pipeline review is tomorrow. The methodology is a shrug.'],
      ['QUARTER CRUNCH', 'Every deal is "closing this week." Every week.'],
      ['THE PERFECT STORM', 'Last day of the quarter. The forecast is vibes and the CRM just logged out everyone.'],
    ],
    tickets: {
      handle: [
        'Top rep\'s pipeline: 40 deals named "Follow up"',
        'Prospect ghosted right after "send me pricing"',
        'CRM says the deal closed in 1970',
      ],
      route: [
        'Rep spent 6 hours updating CRM fields. Sold nothing.',
        'Forecast methodology: vibes',
        'Deal stage: "Closed Won?" — with the question mark',
        'Sales and Marketing fighting over a lead named Steve',
      ],
      escalate: [
        'Discount approved: 90%. By whom? Unclear.',
        'Renewal date passed. Nobody noticed. The customer did.',
        'Quota was set before anyone checked the market',
      ],
    },
    cards: [
      mk('Pipeline Hygienist', '🧹', 'additive', 500, 'ops',
        'Agentforce SDR: logs every touch, updates every field, chases every follow-up',
        '+500 capacity once integrated. Owns routine 🔥 CRM admin end-to-end.',
        'Reps sell. Agents do the admin.'),
      mk('Synthetic Coach', '🎓', 'trigger', 250, 'data',
        'Agentforce Sales Coach: detects objections and stalls, guides in real time',
        '+250 capacity. Pounces on 📊 deal risk as it surfaces.',
        'Every rep gets your best rep\'s instincts.'),
      mk('Dynamic Margin Pricing', '💹', 'multiplier', 1.5, 'people',
        'Agentforce pricing guidance: guardrailed discounting tied to margin',
        '×1.5 impact. Every deal compounds instead of leaking.',
        'Discounts by math, not panic.'),
      mk('The Revenue Engine', '⚙️', 'orchestrator', 2.0, 'all',
        'Multi-agent orchestration: SDR, coach, and pricing agents on one pipeline',
        '×2.0 impact. Links every agent into one number-hitting system.',
        'Agents that coordinate beat agents that coexist.'),
    ],
  },
  {
    key: 'cs', name: 'Head of Customer Service', emoji: '🎧', img: null, tagline: 'Keep customers happy.', base: 100,
    mission: 'Resolve honestly — deflect the routine, escalate the real.',
    metric: 'HONEST RESOLUTIONS',
    team: 'TIER 2',
    mix: { handle: 0.35, route: 0.3, escalate: 0.35 },
    win: 'Deflection: 64% — with zero confidently-wrong answers.',
    victory: 'Queue: empty. CSAT: up. The AI made the right call — 4,000 times in a row.',
    waves: [
      ['QUEUE OVERFLOW', 'Wait time: 4 hours. Hold music: one song, on loop.'],
      ['CONFIDENTLY WRONG', 'Your AI just made the wrong call. With total confidence. To a VIP.'],
      ['REGIONAL OUTAGE', 'Everything is down. The status page is all green.'],
      ['CSAT FREEFALL', 'The survey went out mid-outage. The results are in. They rhyme with "disaster."'],
      ['THE PERFECT STORM', 'Regional outage, 4-hour queue, and the AI is apologizing to the wrong customers.'],
    ],
    tickets: {
      handle: [
        'Customer replied "ok" — case auto-closed as resolved',
        'CSAT survey sent mid-outage',
        'Agent handbook contradicts itself on page 1',
        '"Urgent" tag applied to every ticket, so none are',
      ],
      route: [
        'Queue wait: 4 hours. Hold music: 1 song.',
        'One customer, 47 tickets. All valid.',
        'Refund macro fired on a compliment',
      ],
      escalate: [
        'Regional outage. Status page: all green.',
        'VIP stuck in a tier-1 loop for 3 days',
        'AI confidently said the product is discontinued. It is not.',
      ],
    },
    cards: [
      mk('Inbox Triage', '📥', 'additive', 400, 'ops',
        'Agentforce Service Agent: case classification and routine-case deflection',
        '+400 capacity once integrated. Resolves routine 🔥 cases end-to-end.',
        'Deflect the routine. Dignify the complex.'),
      mk('Escalation Assistant', '🆘', 'trigger', 250, 'data',
        'Agentforce escalation rules: VIP and severity detection with instant routing',
        '+250 capacity. Pounces on 📊 at-risk cases immediately.',
        'The right human, the first time.'),
      mk('Tier-1 Auto-Resolve', '✅', 'multiplier', 1.5, 'people',
        'Service Agent full resolution — with honest handoffs when it isn\'t sure',
        '×1.5 impact. Deflection that compounds trust instead of spending it.',
        'Deflection that admits what it can\'t do.'),
      mk('The Service Mesh', '🕸️', 'orchestrator', 2.0, 'all',
        'Multi-agent orchestration across triage, resolution, and follow-up',
        '×2.0 impact. Links every agent into one service system.',
        'Agents that coordinate beat agents that coexist.'),
    ],
  },
];

const AMBIENT_NOISE = ['URGENT', 'RE: RE: RE:', 'FYI', 'per my last email', 'quick sync?', 'EOD??', 'circling back', 'as discussed', '@here', 'ping'];

/* ---------- scoring engine (status-aware) ---------- */
function effAdd(c) {
  if (c.type !== 'additive' && c.type !== 'trigger') return 0;
  if (c.status === 'online') return c.value;
  if (c.status === 'degraded') return Math.round(c.value * DEGRADED_FACTOR);
  return 0; // integrating
}
function effMult(c) {
  if (c.type !== 'multiplier' && c.type !== 'orchestrator') return 1;
  if (c.status === 'online') return c.value;
  if (c.status === 'degraded') return 1 + (c.value - 1) * DEGRADED_FACTOR;
  return 1; // integrating
}
function engineOf(base, cards) {
  const agents = cards.filter((c) => c.type !== 'data');
  const addSum = agents.reduce((s, c) => s + effAdd(c), 0);
  const multProd = agents.reduce((p, c) => p * effMult(c), 1);
  return { addSum, multProd, total: Math.round((base + addSum) * multProd) };
}

function useAnimatedNumber(target) {
  const [val, setVal] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    const from = ref.current;
    const to = target;
    if (from === to) return undefined;
    const start = performance.now();
    const dur = 650;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (to - from) * eased;
      ref.current = v;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return Math.round(val);
}

/* ============================================================ */

export default function WhoBrokeTheBusiness() {
  const [role, setRole] = useState(null);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState('title');
  // title | roleSelect | waveIntro | triage | draft | resolution | summary
  // bossIntro | bossCrisis | simulate | victory
  const [howTo, setHowTo] = useState(false);
  const [deck, setDeck] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null); // ticket id under inspection
  const [manualScore, setManualScore] = useState(0);
  const [ghostScore, setGhostScore] = useState(0);
  const [dataClean, setDataClean] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [simStep, setSimStep] = useState(-1);
  const [simNote, setSimNote] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [draftOptions, setDraftOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [shakeCls, setShakeCls] = useState('');
  const [meterOverride, setMeterOverride] = useState(null);
  const [ghostDead, setGhostDead] = useState(false);
  const [bossReady, setBossReady] = useState(false);
  const [bossTarget, setBossTarget] = useState(0);
  const [noHuman, setNoHuman] = useState(false);
  const [agentPulse, setAgentPulse] = useState({});
  const [manualClears, setManualClears] = useState(0);
  const [autoClears, setAutoClears] = useState(0);
  const [flash, setFlash] = useState(null); // {text, tone} transient banner

  const idRef = useRef(0);
  const ticketsRef = useRef([]);
  const deckRef = useRef([]);
  const mcRef = useRef(0); // decisions made this round
  const acRef = useRef(0); // agent clears this round
  const ecRef = useRef(0); // escalated-unattended this round
  const wrongRef = useRef(0); // misroutes this round
  const dupRef = useRef(0); // duplicates created this round
  const r1ManualRef = useRef(0);
  const manualScoreRef = useRef(0);
  const dataCleanRef = useRef(false);
  const selectedRef = useRef(null);

  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { manualScoreRef.current = manualScore; }, [manualScore]);
  useEffect(() => { dataCleanRef.current = dataClean; }, [dataClean]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const cfg = ROUND_CFG[round];
  const engine = useMemo(
    () => engineOf(role ? role.base : 100, deck.slice(0, appliedCount)),
    [role, deck, appliedCount]
  );
  const displayScore = useAnimatedNumber(engine.total + manualScore);
  const displayGhost = useAnimatedNumber(Math.round(ghostScore));

  const liveTickets = tickets.filter((t) => !t.fate);
  const escalatedCount = liveTickets.filter((t) => t.escalated).length;
  const meterPct =
    meterOverride !== null
      ? meterOverride
      : phase === 'bossCrisis' || phase === 'simulate'
        ? 100
        : phase === 'victory'
          ? 0
          : Math.min(100, Math.round(((liveTickets.length + escalatedCount * 1.2) / (cfg ? cfg.tickets : 8)) * 160));

  const doShake = useCallback((cls) => {
    if (!cls) return;
    setShakeCls('');
    requestAnimationFrame(() => setShakeCls(cls));
    setTimeout(() => setShakeCls(''), 700);
  }, []);

  const showFlash = useCallback((text, tone) => {
    setFlash({ text, tone });
    setTimeout(() => setFlash(null), 1500);
  }, []);

  /* ---------- ticket helpers ---------- */

  const spawnTicket = useCallback((r, override) => {
    const id = ++idRef.current;
    let kind;
    if (override) kind = override.kind;
    else {
      const roll = Math.random();
      kind = roll < r.mix.handle ? 'handle' : roll < r.mix.handle + r.mix.route ? 'route' : 'escalate';
    }
    const t = {
      id,
      text: override ? override.text : rand(r.tickets[kind]),
      cat: rand(CAT_KEYS),
      kind,
      escalated: override ? !!override.escalated : false,
      bounced: false,
      spawnedAt: performance.now(),
      fate: null,
    };
    setTickets((ts) => [...ts, t]);
    return t;
  }, []);

  const removeTickets = useCallback((ids, fate) => {
    if (!ids.length) return;
    const set = new Set(ids);
    setTickets((ts) => ts.map((t) => (set.has(t.id) ? { ...t, fate } : t)));
    setTimeout(() => {
      setTickets((ts) => ts.filter((t) => !set.has(t.id)));
    }, 420);
  }, []);

  const spawnDuplicate = useCallback((r) => {
    dupRef.current += 1;
    spawnTicket(r, { text: '⚠ Duplicate record created by agent', kind: 'handle', escalated: true });
  }, [spawnTicket]);

  /* ---------- the decision moment (Papers, Please core) ---------- */

  const clickTicket = (t) => {
    if (phase === 'bossCrisis' || phase === 'simulate') {
      setNoHuman(true);
      setTimeout(() => setNoHuman(false), 1400);
      doShake('shake-s');
      return;
    }
    if (phase !== 'triage' || t.fate) return;
    setSelected(selected === t.id ? null : t.id);
  };

  const availableAgentFor = (t) =>
    deckRef.current.find(
      (c) => c.type !== 'data' && c.status !== 'integrating' && (c.cat === 'all' || c.cat === t.cat)
    );

  const decide = (t, action) => {
    if (phase !== 'triage' || t.fate) return;
    setSelected(null);
    if (action === 'delegate') {
      const agent = availableAgentFor(t);
      if (!agent) return;
      if (agent.status === 'online' || Math.random() < 0.5) {
        removeTickets([t.id], 'agent');
        acRef.current += 1;
        setAutoClears((n) => n + 1);
        setManualScore((s) => s + 5);
        if (agent.status === 'degraded') spawnDuplicate(role);
        showFlash(`${agent.emoji} ${agent.name} took it${agent.status === 'degraded' ? ' — messily' : ''}`, agent.status === 'degraded' ? 'warn' : 'good');
      } else {
        spawnDuplicate(role);
        setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, escalated: true, bounced: true } : x)));
        showFlash(`${agent.emoji} ${agent.name} MISFIRED — dirty data`, 'bad');
        doShake('shake-s');
      }
      return;
    }
    if (action === t.kind) {
      removeTickets([t.id], 'manual');
      mcRef.current += 1;
      if (round === 1) r1ManualRef.current += 1;
      setManualClears((m) => m + 1);
      const pts = ACTION_POINTS[action];
      setManualScore((s) => s + pts);
      setGhostScore((g) => g + pts * GHOST_DECAY[round]);
      showFlash(action === 'handle' ? '✓ Handled' : action === 'route' ? `✓ Routed to ${role.team}` : '✓ Escalated correctly', 'good');
    } else {
      wrongRef.current += 1;
      setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, escalated: true, bounced: true } : x)));
      showFlash('✗ MISROUTED — it\'s worse now', 'bad');
      doShake('shake-s');
    }
  };

  // close the inspector if its ticket got cleared meanwhile
  useEffect(() => {
    if (selected !== null && !tickets.some((t) => t.id === selected && !t.fate)) setSelected(null);
  }, [tickets, selected]);

  /* ---------- round lifecycle ---------- */

  const startRound = useCallback((r) => {
    mcRef.current = 0; acRef.current = 0; ecRef.current = 0; wrongRef.current = 0; dupRef.current = 0;
    setManualClears(0); setAutoClears(0);
    setTickets([]);
    setSelected(null);
    setSummary(null);
    setSimStep(-1);
    setSimNote('');
    setRound(r);
    setMeterOverride(null);
    // integration ramp: everything drafted before this round comes online —
    // at full power only if the data has been fixed
    const fixed = deckRef.current.some((c) => c.type === 'data' && c.draftedRound < r);
    setDataClean(fixed);
    dataCleanRef.current = fixed;
    setDeck((d) => {
      const next = d.map((c) =>
        c.draftedRound < r
          ? { ...c, status: c.type === 'data' ? 'online' : fixed ? 'online' : 'degraded' }
          : c
      );
      deckRef.current = next;
      return next;
    });
    setPhase(r === 5 ? 'bossIntro' : 'waveIntro');
  }, []);

  const pickRole = (r) => {
    setRole(r);
    startRound(1);
  };

  // wave intro auto-advances into the triage window
  useEffect(() => {
    if (phase !== 'waveIntro') return undefined;
    const t = setTimeout(() => {
      setTimeLeft(ROUND_CFG[round].triageSec); // set before phase flips so the zero-check effect can't fire early
      setPhase('triage');
    }, 3200);
    return () => clearTimeout(t);
  }, [phase, round]);

  // TRIAGE ENGINE: spawner + countdown + escalation + agent behavior
  useEffect(() => {
    if (phase !== 'triage' || !role) return undefined;
    const c = ROUND_CFG[round];
    setTimeLeft(c.triageSec);
    let spawned = 0;
    const spawnInt = setInterval(() => {
      if (spawned >= c.tickets) { clearInterval(spawnInt); return; }
      spawned += 1;
      spawnTicket(role);
    }, c.spawnMs);

    const countInt = setInterval(() => {
      setTimeLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    // deterministic round end — one wall-clock timeout owns the transition
    const endTimeout = setTimeout(() => {
      setSelected(null);
      const slot = round - 1;
      const fixTaken = deckRef.current.some((x) => x.type === 'data');
      let opts;
      if (slot === 0) opts = shuffle([role.cards[0], ...DECOYS[0]]);
      else if (slot === 1) opts = [FIX_DATA, role.cards[1], DECOYS[1][0]];
      else if (slot === 2) opts = fixTaken ? [role.cards[2], ...DECOYS[2]] : [FIX_DATA, role.cards[2], DECOYS[2][0]];
      else opts = [role.cards[3], ...DECOYS[3]];
      setDraftOptions(opts);
      setPhase('draft');
    }, c.triageSec * 1000 + 700);

    const escInt = setInterval(() => {
      const now = performance.now();
      let newEsc = 0;
      setTickets((ts) =>
        ts.map((t) => {
          if (!t.escalated && !t.fate && now - t.spawnedAt > c.escalateMs) {
            newEsc += 1;
            return { ...t, escalated: true };
          }
          return t;
        })
      );
      if (newEsc > 0) ecRef.current += newEsc;
    }, 450);

    // Agents work the board: online agents quietly take matching tickets;
    // degraded agents are slower and sometimes make things worse.
    const agentInt = setInterval(() => {
      const agents = deckRef.current.filter((a) => a.type !== 'data' && a.status !== 'integrating');
      if (!agents.length) return;
      const toClear = [];
      const pulses = {};
      const now = performance.now();
      const pool = () => ticketsRef.current.filter((t) => !t.fate && !toClear.includes(t.id) && now - t.spawnedAt > 3500 && t.id !== selectedRef.current);
      agents.forEach((a, i) => {
        const match = pool().filter((t) => a.cat === 'all' || t.cat === a.cat);
        if (a.status === 'online') {
          const n = a.type === 'orchestrator' ? 2 : a.type === 'trigger' ? 2 : 1;
          match.slice(0, n).forEach((t) => { toClear.push(t.id); pulses[i] = (pulses[i] || 0) + 1; });
        } else {
          // degraded: dirty data — sluggish, occasionally destructive
          const roll = Math.random();
          if (roll < 0.25) spawnDuplicate(role);
          else if (roll < 0.6 && match.length) { toClear.push(match[0].id); pulses[i] = (pulses[i] || 0) + 1; }
        }
      });
      if (toClear.length) {
        removeTickets(toClear, 'agent');
        acRef.current += toClear.length;
        setAutoClears((n) => n + toClear.length);
        setAgentPulse((p) => {
          const next = { ...p };
          Object.entries(pulses).forEach(([k, v]) => { next[k] = (next[k] || 0) + v; });
          return next;
        });
      }
    }, 1500);

    return () => {
      clearInterval(spawnInt);
      clearInterval(countInt);
      clearInterval(escInt);
      clearInterval(agentInt);
      clearTimeout(endTimeout);
    };
  }, [phase, round, role, spawnTicket, removeTickets, spawnDuplicate]);

  /* ---------- draft + resolution ---------- */

  const draftCard = (c) => {
    const newDeck = [...deck, { ...c, draftedRound: round, status: 'integrating' }];
    setDeck(newDeck);
    deckRef.current = newDeck;
    runResolution(newDeck);
  };

  const runResolution = async (theDeck) => {
    setPhase('resolution');
    setSimStep(-1);
    setAppliedCount(0);
    await sleep(500);
    const active = theDeck.filter((c) => c.status !== 'integrating' && c.type !== 'data');
    for (let i = 0; i < theDeck.length; i++) {
      const c = theDeck[i];
      setSimStep(i);
      if (c.status === 'integrating') {
        setSimNote(c.type === 'data' ? '🗄️ PROVISIONING DATA 360 — unifying records overnight…' : `${c.emoji} INTEGRATING — online next round. No miracles on day one.`);
        setAppliedCount(i + 1);
        await sleep(1100);
        setSimNote('');
        continue;
      }
      if (c.type === 'data') {
        setSimNote('🗄️ DATA UNIFIED — agents grounded in one customer record.');
        setAppliedCount(i + 1);
        await sleep(900);
        setSimNote('');
        continue;
      }
      // working agent: intercept a share of what's left, then stamp the formula
      const remaining = ticketsRef.current.filter((t) => !t.fate);
      const share = Math.ceil(remaining.length / Math.max(1, active.length));
      const batch = remaining.slice(0, share).map((t) => t.id);
      if (batch.length) {
        removeTickets(batch, 'agent');
        acRef.current += batch.length;
        setAutoClears((v) => v + batch.length);
      }
      if (c.status === 'degraded') {
        setSimNote(`${c.emoji} running at ${Math.round(DEGRADED_FACTOR * 100)}% — dirty data`);
      }
      await sleep(350);
      setAppliedCount(i + 1);
      doShake(c.type === 'orchestrator' ? 'shake-b' : c.type === 'multiplier' ? 'shake-s' : '');
      await sleep(700);
      setSimNote('');
    }
    setSimStep(-1);
    await sleep(500);
    const eng = engineOf(role.base, theDeck);
    setSummary({
      round,
      volume: ROUND_CFG[round].tickets,
      manual: mcRef.current,
      auto: acRef.current,
      esc: ecRef.current,
      wrong: wrongRef.current,
      dups: dupRef.current,
      clean: dataCleanRef.current,
      score: eng.total + manualScoreRef.current,
    });
    setPhase('summary');
  };

  const summaryLine = (s) => {
    switch (s.round) {
      case 1:
        return `${s.manual} decisions made, ${s.wrong} misrouted, ${s.esc} escalated unattended. No agents, no backup — and this was the slow week.`;
      case 2:
        return `Your first agent came online — into the data swamp. It ran at ${Math.round(DEGRADED_FACTOR * 100)}% of advertised and created ${s.dups} duplicate record${s.dups === 1 ? '' : 's'}. AI on bad data is a power-up that doesn't power anything.`;
      case 3: {
        const r1 = Math.max(1, r1ManualRef.current);
        const pct = Math.max(0, Math.round((1 - s.manual / r1) * 100));
        return s.clean
          ? `Data unified. Your agents now perform as advertised. Chaos is up 100% since Round 1 — your decision load is down ${pct}%.`
          : `Still running agents on swamp data: ${s.dups} more duplicates this round. The stack can't save you until the data can.`;
      }
      case 4:
        return `${s.volume} tickets. You touched ${s.manual}. The stack handled ${s.auto}. Notice the shift: you were managing a system, not drowning in a queue.`;
      default:
        return '';
    }
  };

  const nextFromSummary = () => {
    if (round >= 4) {
      // preview the boss-round statuses (everything comes online; power depends on data readiness)
      const fixed = deckRef.current.some((c) => c.type === 'data');
      const preview = deckRef.current.map((c) => ({ ...c, status: c.type === 'data' ? 'online' : fixed ? 'online' : 'degraded' }));
      const eng = engineOf(role.base, preview);
      const target = Math.floor(((eng.total + manualScoreRef.current) * 0.93) / 10) * 10;
      setBossTarget(target);
      startRound(5);
    } else {
      startRound(round + 1);
    }
  };

  /* ---------- boss crisis + simulate ---------- */

  const startBossCrisis = () => {
    setPhase('bossCrisis');
    setBossReady(false);
  };

  useEffect(() => {
    if (phase !== 'bossCrisis' || !role) return undefined;
    const c = ROUND_CFG[5];
    let spawned = 0;
    const spawnInt = setInterval(() => {
      if (spawned >= c.tickets) { clearInterval(spawnInt); return; }
      spawned += 1;
      spawnTicket(role);
    }, c.spawnMs);
    const escInt = setInterval(() => {
      const now = performance.now();
      setTickets((ts) => ts.map((t) => (!t.escalated && !t.fate && now - t.spawnedAt > c.escalateMs ? { ...t, escalated: true } : t)));
    }, 400);
    const ready = setTimeout(() => setBossReady(true), 4200);
    return () => { clearInterval(spawnInt); clearInterval(escInt); clearTimeout(ready); };
  }, [phase, role, spawnTicket]);

  const runSimulate = async () => {
    setPhase('simulate');
    setSimStep(-1);
    setAppliedCount(0);
    const theDeck = deckRef.current;
    await sleep(800);
    const agents = theDeck.filter((c) => c.type !== 'data');
    for (let i = 0; i < theDeck.length; i++) {
      const c = theDeck[i];
      setSimStep(i);
      await sleep(300);
      if (c.type === 'data') {
        setSimNote('🗄️ DATA 360: RECORDS UNIFIED — full power unlocked');
        setAppliedCount(i + 1);
        doShake('shake-s');
        await sleep(900);
        setSimNote('');
        continue;
      }
      // agents pounce on boss tickets in batches
      const remaining = ticketsRef.current.filter((t) => !t.fate);
      const n = Math.ceil((remaining.length / Math.max(1, agents.length)) * 0.9);
      const batch = remaining.slice(0, n).map((t) => t.id);
      if (batch.length) {
        removeTickets(batch, 'agent');
        acRef.current += batch.length;
        setAutoClears((v) => v + batch.length);
      }
      await sleep(300);
      setAppliedCount(i + 1);
      doShake(c.type === 'orchestrator' ? 'shake-b' : 'shake-s');
      await sleep(880);
    }
    const rest = ticketsRef.current.filter((t) => !t.fate).map((t) => t.id);
    removeTickets(rest, 'agent');
    acRef.current += rest.length;
    setSimStep(-1);
    setSimNote('');
    await sleep(500);
    setGhostDead(true);
    setMeterOverride(0);
    await sleep(1600);
    setPhase('victory');
  };

  const replay = () => {
    setRole(null);
    setRound(1);
    setPhase('roleSelect');
    setDeck([]);
    deckRef.current = [];
    setTickets([]);
    setSelected(null);
    setManualScore(0);
    manualScoreRef.current = 0;
    setGhostScore(0);
    setDataClean(false);
    dataCleanRef.current = false;
    setAppliedCount(0);
    setSimStep(-1);
    setSimNote('');
    setSummary(null);
    setMeterOverride(null);
    setGhostDead(false);
    setBossReady(false);
    setBossTarget(0);
    setAgentPulse({});
    r1ManualRef.current = 0;
  };

  /* ---------- derived visuals (8-bit skin) ---------- */

  const isBossMode = phase === 'bossIntro' || phase === 'bossCrisis' || phase === 'simulate';
  const bgClass =
    phase === 'victory'
      ? 'bg-[#04301f]'
      : isBossMode
        ? 'bg-[#1a0303]'
        : round >= 4
          ? 'bg-[#0d1436]'
          : round === 3
            ? 'bg-[#120d33]'
            : 'bg-[#160b2e]';

  const scoreStage = phase === 'simulate' ? appliedCount : 0;
  const scoreColor =
    phase === 'victory'
      ? 'text-[#3bff5e]'
      : scoreStage >= 4
        ? 'text-[#ff2e9a]'
        : scoreStage === 3
          ? 'text-[#ffe600]'
          : isBossMode
            ? 'text-[#ff5555]'
            : 'text-[#3bff5e]';
  const scoreScale = phase === 'simulate' ? 1 + scoreStage * 0.14 : 1;

  const SEGS = 24;
  const filledSegs = Math.round((meterPct / 100) * SEGS);
  const segColor = meterPct > 66 ? '#ff2d2d' : meterPct > 33 ? '#ffe600' : '#3bff5e';

  const fullEngine = role ? engineOf(role.base, deck) : null;
  const finalScore = fullEngine ? fullEngine.total + manualScore : 0;
  const ghostMultiple = ghostScore > 0 ? Math.round(finalScore / Math.max(1, ghostScore)) : finalScore;

  const panelCls = isBossMode
    ? 'bg-black border-4 border-[#ff2d2d] shadow-[6px_6px_0_#000]'
    : 'bg-black border-4 border-[#2ee6ff] shadow-[6px_6px_0_rgba(255,46,154,0.55)]';

  const selectedTicket = tickets.find((t) => t.id === selected && !t.fate) || null;
  const delegateAgent = selectedTicket ? availableAgentFor(selectedTicket) : null;

  const Avatar = ({ r, size }) =>
    r.img ? (
      <img src={r.img} alt={r.name} className="rounded-full object-cover" style={{ width: size, height: size, imageRendering: 'pixelated' }} />
    ) : (
      <span style={{ fontSize: size * 0.72, lineHeight: 1 }}>{r.emoji}</span>
    );

  /* ============================ RENDER ============================ */

  return (
    <div className={`min-h-screen w-full transition-colors duration-1000 ${bgClass} ${shakeCls} relative overflow-hidden ${isBossMode ? 'scanlines-red' : ''}`}>
      <style>{`
        .font-pixel{font-family:'Press Start 2P',monospace;}
        .font-crt{font-family:'VT323',monospace;}
        @keyframes shakeSK { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-4px,2px)} 40%{transform:translate(4px,-2px)} 60%{transform:translate(-3px,-2px)} 80%{transform:translate(3px,2px)} }
        @keyframes shakeBK { 0%,100%{transform:translate(0,0)} 15%{transform:translate(-9px,5px) rotate(-.4deg)} 30%{transform:translate(9px,-5px) rotate(.4deg)} 45%{transform:translate(-7px,-4px)} 60%{transform:translate(7px,4px)} 75%{transform:translate(-4px,2px)} }
        .shake-s{animation:shakeSK .45s steps(5)}
        .shake-b{animation:shakeBK .65s steps(6)}
        @keyframes vibrate { 0%,100%{transform:translate(0)} 25%{transform:translate(1px,-1px)} 50%{transform:translate(-1px,1px)} 75%{transform:translate(1px,1px)} }
        .vibrate{animation:vibrate .12s steps(2) infinite}
        @keyframes blinkK { 0%,49%{opacity:1} 50%,100%{opacity:.25} }
        .blink{animation:blinkK .5s steps(1) infinite}
        .scanlines-red::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,45,45,.05) 0 3px,transparent 3px 7px);pointer-events:none;z-index:50;}
        .btn-pixel{font-family:'Press Start 2P',monospace;text-transform:uppercase;border-width:4px;border-style:solid;box-shadow:4px 4px 0 #000;}
        .btn-pixel:hover{transform:translate(-1px,-1px);box-shadow:6px 6px 0 #000;}
        .btn-pixel:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000;}
        @media (prefers-reduced-motion: reduce){ .shake-s,.shake-b,.vibrate,.blink{animation:none} }
      `}</style>

      {/* ambient stress noise, rounds 1–2 */}
      {(phase === 'triage' || phase === 'waveIntro') && round <= 2 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
          {AMBIENT_NOISE.map((w, i) => (
            <span
              key={i}
              className="absolute font-pixel text-[#ff2d2d] opacity-10 text-sm"
              style={{ top: `${(i * 37) % 90}%`, left: `${(i * 53) % 85}%`, transform: `rotate(${(i * 23) % 40 - 20}deg)` }}
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {/* ================= TITLE / COVER ================= */}
      {phase === 'title' && (
        <div className="min-h-screen flex flex-col items-center justify-center relative z-10 px-6">
          {/* office-chaos dressing: scattered error signs + flying paper */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
            {['ERROR', 'BUG', 'ERROR', 'WARNING', 'ERROR', 'BUG'].map((w, i) => (
              <motion.span
                key={'e' + i}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 + (i % 3) * 0.4, delay: i * 0.3 }}
                className={`absolute font-pixel text-[9px] px-2 py-1 border-2 ${i % 2 ? 'bg-black text-[#ff2d2d] border-[#ff2d2d]' : 'bg-[#ff2d2d] text-black border-black'}`}
                style={{ top: `${8 + ((i * 31) % 70)}%`, left: i % 2 ? `${4 + ((i * 13) % 18)}%` : `${74 + ((i * 7) % 20)}%`, transform: `rotate(${((i * 17) % 24) - 12}deg)` }}
              >
                {i % 2 ? '⚠ ' : ''}{w}
              </motion.span>
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <motion.span
                key={'p' + i}
                initial={{ y: '-8vh' }}
                animate={{ y: '108vh', rotate: (i % 2 ? 1 : -1) * 360 }}
                transition={{ repeat: Infinity, duration: 7 + (i % 5) * 2, delay: i * 1.1, ease: 'linear' }}
                className="absolute text-xl opacity-40"
                style={{ left: `${(i * 97) % 100}%` }}
              >
                📄
              </motion.span>
            ))}
            {/* checkered floor strip */}
            <div
              className="absolute bottom-0 left-0 right-0 h-16 opacity-60"
              style={{ background: 'repeating-conic-gradient(#1e1246 0% 25%, #2b1a5e 0% 50%) 0 0 / 32px 32px' }}
            />
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <p className="font-pixel text-[10px] text-[#ff2e9a] tracking-widest">★ A BUSINESS SIMULATOR IN 5 ROUNDS ★</p>
            <h1
              className="font-pixel text-4xl md:text-6xl text-[#f2e8c9] mt-6 leading-snug"
              style={{ textShadow: '5px 5px 0 #ff2e9a, 10px 10px 0 #000' }}
            >
              WHO BROKE THE{' '}
              <br />
              BUSINESS?
            </h1>
            <div className="mt-10 flex flex-col items-center gap-4">
              <motion.button
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 1.4 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPhase('roleSelect')}
                className="btn-pixel bg-black text-[#3bff5e] border-[#2ee6ff] text-base px-10 py-4"
              >
                ► START GAME
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setHowTo(true)}
                className="btn-pixel bg-black text-[#f2e8c9] border-[#2ee6ff] text-[11px] px-8 py-3"
              >
                HOW TO PLAY
              </motion.button>
            </div>
          </motion.div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black border-2 border-[#f2e8c9] px-5 py-1.5">
            <p className="font-crt text-xl text-[#f2e8c9] whitespace-nowrap">The business is already on fire.</p>
          </div>

          {/* HOW TO PLAY overlay */}
          <AnimatePresence>
            {howTo && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center px-4 py-6 overflow-y-auto"
              >
                <motion.div
                  initial={{ scale: 0.85, y: 30 }}
                  animate={{ scale: 1, y: 0 }}
                  className="bg-black border-4 border-[#2ee6ff] shadow-[8px_8px_0_rgba(255,46,154,0.55)] max-w-xl w-full p-7"
                >
                  <div className="font-pixel text-sm text-[#ffe600]">HOW TO PLAY</div>
                  <div className="mt-4 space-y-4 text-left">
                    {[
                      ['1. JUDGE EVERY TICKET', 'Chaos hits the board. Click a ticket to inspect it, then decide: ROUTINE → handle it, TEAM-TAGGED → route it, CRITICAL → escalate it. Wrong call = it gets worse.', '#f2e8c9'],
                      ['2. DRAFT AGENTFORCE', 'After each round, add one real capability to your stack. Integration takes a round — nothing works miracles on day one.', '#2ee6ff'],
                      ['3. FIX THE DATA', 'Agents deployed on swamp data run at 25% and make new messes. Take the readiness step to unlock advertised performance.', '#ffb14a'],
                      ['4. SURVIVE THE ENGINE BREAK', 'Round 5 floods the board past human limits. Press SIMULATE and let the stack you built do its job.', '#3bff5e'],
                    ].map(([h, body, color]) => (
                      <div key={h}>
                        <div className="font-pixel text-[10px]" style={{ color }}>{h}</div>
                        <div className="font-crt text-xl text-[#8b8ba0] leading-tight mt-1">{body}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button onClick={() => setHowTo(false)} className="btn-pixel flex-1 py-3 text-[10px] bg-black text-[#8b8ba0] border-[#8b8ba0]">BACK</button>
                    <button onClick={() => { setHowTo(false); setPhase('roleSelect'); }} className="btn-pixel flex-1 py-3 text-[10px] bg-black text-[#3bff5e] border-[#3bff5e]">► START GAME</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ================= ROLE SELECT ================= */}
      {phase === 'roleSelect' && (
        <div className="max-w-5xl mx-auto px-6 py-10 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="inline-block bg-black border-4 border-[#2ee6ff] shadow-[6px_6px_0_rgba(255,46,154,0.55)] px-8 py-4">
              <h1 className="font-pixel text-xl md:text-3xl text-[#2ee6ff]" style={{ textShadow: '3px 3px 0 #000' }}>
                PICK YOUR ROLE
              </h1>
            </div>
            <p className="font-crt text-2xl text-[#2ee6ff] mt-5 max-w-2xl mx-auto leading-tight">
              Every ticket is a judgment call. The chaos doubles every round — your judgment doesn't.
              Each seat gets its own mission, its own chaos, and its own agents.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {ROLES.map((r, i) => (
              <motion.button
                key={r.key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i }}
                whileHover={{ y: -6 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => pickRole(r)}
                className="group bg-black border-4 border-[#2ee6ff] hover:border-[#ff2e9a] shadow-[6px_6px_0_#000] hover:shadow-[8px_8px_0_rgba(255,46,154,0.6)] p-5 text-left"
              >
                <div className="flex justify-center bg-[#101024] border-2 border-[#2ee6ff]/40 py-4">
                  <Avatar r={r} size={56} />
                </div>
                <div className="mt-3 font-pixel text-[11px] text-[#2ee6ff] leading-relaxed">{r.name}</div>
                <div className="font-crt text-xl text-[#f2e8c9] mt-1 leading-tight">{r.tagline}</div>
                <div className="font-crt text-lg text-[#ffe600] mt-2 leading-tight">MISSION: {r.mission}</div>
                <div className="mt-3 font-pixel text-[9px] text-[#3bff5e] opacity-0 group-hover:opacity-100">► SELECT</div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ================= GAME HUD ================= */}
      {role && phase !== 'roleSelect' && phase !== 'victory' && (
        <div className="max-w-5xl mx-auto px-4 pt-4 relative z-10">
          <div className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${panelCls}`}>
            <div>
              <div className={`flex items-center gap-2 font-pixel text-[9px] ${isBossMode ? 'text-[#ff2d2d]' : 'text-[#ff2e9a]'}`}>
                <Avatar r={role} size={18} /> {role.name} · ROUND {round}/5
              </div>
              <motion.div
                animate={{ scale: scoreScale }}
                className={`font-pixel tabular-nums ${scoreColor} ${phase === 'simulate' && scoreStage >= 3 ? 'vibrate' : ''}`}
                style={{ fontSize: '1.9rem', lineHeight: 1.3, transformOrigin: 'left center', textShadow: '3px 3px 0 #000' }}
              >
                {fmt(displayScore)}
              </motion.div>
              <div className="font-pixel text-[8px] text-[#8b8ba0]">{role.metric}</div>
              {/* GHOST LINE */}
              <div className="mt-2">
                <div className={`font-crt text-xl tabular-nums ${ghostDead ? 'text-[#6b6b7a] line-through' : 'text-[#8b8ba0]'}`}>
                  {fmt(displayGhost)}
                </div>
                <AnimatePresence mode="wait">
                  {ghostDead ? (
                    <motion.div
                      key="dead"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0.3, 1, 0.3, 1] }}
                      transition={{ duration: 1.6 }}
                      className="font-pixel text-[8px] text-[#ff2d2d]"
                    >
                      MANUAL OPS INC. DID NOT SURVIVE Q3.
                    </motion.div>
                  ) : (
                    <motion.div key="alive" className="font-crt text-base text-[#6b6b7a]">
                      Manual Ops Inc. (you, without agents)
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center justify-between">
                <div className={`font-pixel text-[9px] ${isBossMode ? 'text-[#ff5555]' : 'text-[#ffe600]'}`}>THE FORMULA</div>
                {/* DATA READINESS */}
                <div className={`font-pixel text-[8px] px-2 py-1 border-2 ${dataClean ? 'text-[#3bff5e] border-[#3bff5e]' : 'text-[#ff2d2d] border-[#ff2d2d]'}`}>
                  DATA: {dataClean ? 'UNIFIED' : 'SWAMP'}
                </div>
              </div>
              <div className={`mt-1 flex flex-wrap items-center gap-1 font-crt text-xl ${isBossMode ? 'text-[#f2e8c9]' : 'text-[#2ee6ff]'}`}>
                <span>(</span>
                <span className="font-bold">{role.base}</span>
                {deck.filter((c) => c.type === 'additive' || c.type === 'trigger').map((c, i) => {
                  const deckIdx = deck.indexOf(c);
                  const applied = deckIdx < appliedCount;
                  const firing = deckIdx === simStep;
                  const label = c.status === 'integrating' ? `+${c.value}·SETUP` : c.status === 'degraded' ? `+${Math.round(c.value * DEGRADED_FACTOR)}*` : `+${c.value}`;
                  return (
                    <motion.span
                      key={c.name + i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: applied ? (c.status === 'integrating' ? 0.4 : 1) : 0.35, x: 0, scale: firing ? 1.25 : 1 }}
                      className={firing ? 'text-[#ffe600] font-bold' : c.status === 'degraded' ? 'text-[#ffb14a] font-bold' : applied ? 'font-bold' : ''}
                    >
                      {' '}{label}
                    </motion.span>
                  );
                })}
                <span>)</span>
                {deck.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator').map((c, i) => {
                  const deckIdx = deck.indexOf(c);
                  const applied = deckIdx < appliedCount;
                  const firing = deckIdx === simStep;
                  const label = c.status === 'integrating' ? `×${c.value.toFixed(1)}·SETUP` : c.status === 'degraded' ? `×${effMult(c).toFixed(2)}*` : `×${c.value.toFixed(1)}`;
                  return (
                    <motion.span
                      key={c.name + i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: applied ? (c.status === 'integrating' ? 0.4 : 1) : 0.35, x: 0, scale: firing ? 1.35 : 1 }}
                      className={firing ? 'text-[#ff2e9a] font-bold' : c.status === 'degraded' ? 'text-[#ffb14a] font-bold' : applied ? 'font-bold' : ''}
                    >
                      {' '}{label}
                    </motion.span>
                  );
                })}
                <span> = </span>
                <span className="font-bold text-[#3bff5e]">{fmt(engineOf(role.base, deck.slice(0, appliedCount)).total)}</span>
                {manualScore > 0 && <span className="font-crt text-base text-[#6b6b7a]">+ {manualScore} judgment</span>}
              </div>
              {!dataClean && deck.some((c) => c.type !== 'data' && c.status === 'degraded') && (
                <div className="font-crt text-base text-[#ffb14a] mt-1">* running on dirty data — fix the data to unlock advertised performance</div>
              )}

              {/* CHAOS METER — segmented blocks */}
              <div className="mt-3">
                <div className="flex justify-between font-pixel text-[9px]">
                  <span className={isBossMode ? 'text-[#ff2d2d]' : 'text-[#ff2e9a]'}>⚠ OPERATIONAL CHAOS</span>
                  <span className={meterPct > 66 ? 'text-[#ff2d2d]' : 'text-[#8b8ba0]'}>{meterPct}%</span>
                </div>
                <div className={`flex gap-[3px] mt-1 p-[3px] bg-[#0a0514] border-2 ${meterPct > 80 ? 'border-[#ff2d2d] blink' : 'border-[#2ee6ff]/50'}`}>
                  {Array.from({ length: SEGS }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ backgroundColor: i < filledSegs ? segColor : '#1a1130' }}
                      transition={{ duration: 0.25 }}
                      className="h-3 flex-1"
                    />
                  ))}
                </div>
              </div>
            </div>

            {phase === 'triage' && (
              <div className={`text-center px-4 py-2 border-4 ${timeLeft <= 5 ? 'border-[#ff2d2d] bg-[#2b0505]' : 'border-[#ffe600] bg-[#151505]'}`}>
                <span className={`font-pixel text-2xl tabular-nums ${timeLeft <= 5 ? 'text-[#ff2d2d] blink' : 'text-[#ffe600]'}`}>{timeLeft}</span>
                <div className="font-pixel text-[8px] text-[#8b8ba0] mt-1">TRIAGE</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* decision feedback banner */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 font-pixel text-[10px] px-4 py-2 border-4 shadow-[4px_4px_0_#000] ${
              flash.tone === 'good' ? 'bg-black text-[#3bff5e] border-[#3bff5e]' : flash.tone === 'warn' ? 'bg-black text-[#ffe600] border-[#ffe600]' : 'bg-[#2b0505] text-[#ff2d2d] border-[#ff2d2d]'
            }`}
          >
            {flash.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= TICKET BOARD ================= */}
      {role && ['waveIntro', 'triage', 'draft', 'resolution', 'summary', 'bossCrisis', 'simulate'].includes(phase) && (
        <div className="max-w-5xl mx-auto px-4 py-4 relative z-10">
          {noHuman && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-1/2 -translate-x-1/2 top-0 z-30 bg-black text-[#ff2d2d] font-pixel text-[10px] px-4 py-3 border-4 border-[#ff2d2d] shadow-[4px_4px_0_#000]"
            >
              NO HUMAN CAN TRIAGE THIS.
            </motion.div>
          )}
          {simNote && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-1/2 -translate-x-1/2 top-0 z-30 bg-black text-[#ffe600] font-crt text-xl px-4 py-2 border-4 border-[#ffe600] shadow-[4px_4px_0_#000] whitespace-nowrap"
            >
              {simNote}
            </motion.div>
          )}
          <div className={`flex flex-wrap gap-2 content-start min-h-[260px] p-4 ${isBossMode ? 'bg-black/60 border-4 border-[#7a0000]' : 'bg-[#0a0514]/80 border-4 border-[#2ee6ff]/40'}`}>
            <AnimatePresence>
              {tickets.map((t) => (
                <motion.button
                  key={t.id}
                  layout
                  data-kind={t.kind}
                  initial={{ scale: 0, opacity: 0, y: -14 }}
                  animate={
                    t.fate === 'manual'
                      ? { scale: [1, 1.4, 0], opacity: [1, 1, 0] }
                      : t.fate === 'agent'
                        ? { y: 180, x: (t.id % 7 - 3) * 30, scale: 0.2, opacity: 0, rotate: (t.id % 5 - 2) * 30 }
                        : { scale: selected === t.id ? 1.06 : 1, opacity: 1, y: 0, x: t.escalated ? [0, -2, 2, -2, 0] : 0 }
                  }
                  transition={t.fate === 'agent' ? { duration: 0.42, ease: 'easeIn' } : t.fate === 'manual' ? { duration: 0.22 } : { type: 'spring', stiffness: 400, damping: 22, x: { repeat: t.escalated ? Infinity : 0, duration: 0.35 } }}
                  exit={{ opacity: 0, transition: { duration: 0.01 } }}
                  onClick={() => clickTicket(t)}
                  className={`text-left font-crt px-2 py-1 border-2 shadow-[3px_3px_0_#000] select-none cursor-pointer ${round === 5 ? 'text-base max-w-[150px]' : 'text-xl max-w-[240px]'} leading-none ${
                    t.escalated
                      ? 'bg-[#ff2d2d] text-black border-[#7a0000] blink'
                      : isBossMode
                        ? 'bg-[#2b0505] text-[#ff9d9d] border-[#7a0000]'
                        : selected === t.id
                          ? 'bg-[#141433] text-[#f2e8c9] border-[#ffe600]'
                          : 'bg-[#0d0d1f] text-[#f2e8c9] border-[#2ee6ff] hover:bg-[#141433] hover:border-[#ffe600]'
                  }`}
                >
                  {round !== 5 && (
                    <span className={`font-pixel text-[7px] mr-1 px-1 border ${t.escalated ? 'text-black border-black' : KIND_UI[t.kind].color}`}>
                      {t.bounced ? 'MISROUTED' : t.kind === 'route' ? `TEAM:${role.team}` : KIND_UI[t.kind].chip}
                    </span>
                  )}
                  <span className="mr-1">{CATS[t.cat].emoji}</span>
                  {t.text}
                </motion.button>
              ))}
            </AnimatePresence>
            {phase === 'triage' && liveTickets.length === 0 && (
              <div className="w-full text-center font-crt text-xl text-[#6b6b7a] py-16">…it's quiet. Too quiet.</div>
            )}
          </div>

          {/* ======= DECISION INSPECTOR (Papers, Please moment) ======= */}
          <AnimatePresence>
            {selectedTicket && phase === 'triage' && (
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="mt-3 bg-black border-4 border-[#ffe600] shadow-[6px_6px_0_#000] p-4"
                data-testid="inspector"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[200px] flex-1">
                    <span className={`font-pixel text-[8px] px-2 py-1 border-2 ${KIND_UI[selectedTicket.kind].color}`}>
                      {selectedTicket.kind === 'route' ? `TEAM:${role.team}` : KIND_UI[selectedTicket.kind].chip}
                    </span>
                    <div className="font-crt text-2xl text-[#f2e8c9] mt-2 leading-tight">
                      {CATS[selectedTicket.cat].emoji} {selectedTicket.text}
                    </div>
                    <div className="font-crt text-base text-[#6b6b7a] mt-1">
                      ROUTINE → handle it yourself · TEAM-TAGGED → route it · CRITICAL → escalate. Wrong call = it gets worse.
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => decide(selectedTicket, 'handle')} className="btn-pixel text-[9px] px-3 py-3 bg-black text-[#f2e8c9] border-[#8b8ba0]">✋ HANDLE</button>
                    <button onClick={() => decide(selectedTicket, 'route')} className="btn-pixel text-[9px] px-3 py-3 bg-black text-[#2ee6ff] border-[#2ee6ff]">➡ ROUTE</button>
                    <button onClick={() => decide(selectedTicket, 'escalate')} className="btn-pixel text-[9px] px-3 py-3 bg-black text-[#ff2d2d] border-[#ff2d2d]">⚠ ESCALATE</button>
                    <button
                      onClick={() => decide(selectedTicket, 'delegate')}
                      disabled={!delegateAgent}
                      className={`btn-pixel text-[9px] px-3 py-3 bg-black ${delegateAgent ? (delegateAgent.status === 'degraded' ? 'text-[#ffb14a] border-[#ffb14a]' : 'text-[#3bff5e] border-[#3bff5e]') : 'text-[#3a3a4a] border-[#3a3a4a] cursor-not-allowed'}`}
                      title={delegateAgent ? `${delegateAgent.name}${delegateAgent.status === 'degraded' ? ' (dirty data — may misfire)' : ''}` : 'No agent covers this yet'}
                    >
                      🤖 DELEGATE{delegateAgent && delegateAgent.status === 'degraded' ? '?' : ''}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* boss SIMULATE button */}
          {phase === 'bossCrisis' && (
            <div className="text-center mt-6">
              <AnimatePresence>
                {bossReady && (
                  <motion.button
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: [1, 1.06, 1], opacity: 1 }}
                    transition={{ scale: { repeat: Infinity, duration: 1.2 } }}
                    whileTap={{ scale: 0.95 }}
                    onClick={runSimulate}
                    className="btn-pixel bg-black text-[#3bff5e] text-xl px-12 py-5 border-[#3bff5e]"
                    style={{ boxShadow: '0 0 30px rgba(59,255,94,0.5), 4px 4px 0 #000' }}
                  >
                    ► SIMULATE
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="mt-4 font-pixel text-[10px] text-[#ff5555]">
                TARGET: <span className="text-[#ffe600] text-sm tabular-nums">{fmt(bossTarget)}</span> — IMPOSSIBLE BY HAND
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= DECK BAR ================= */}
      {role && deck.length > 0 && phase !== 'roleSelect' && phase !== 'victory' && (
        <div className="max-w-5xl mx-auto px-4 pb-6 relative z-10">
          <div className="relative flex gap-3 flex-wrap items-stretch">
            {deck.some((c) => c.type === 'orchestrator') && appliedCount >= deck.length && (
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8 }}
                className="absolute top-1/2 left-2 right-2 h-1 origin-left z-0"
                style={{ background: 'repeating-linear-gradient(90deg,#2ee6ff 0 8px,#ff2e9a 8px 16px,#ffe600 16px 24px)' }}
              />
            )}
            {deck.map((c, i) => (
              <motion.div
                key={c.name + i}
                layout
                initial={{ scale: 0.6, y: 30, opacity: 0 }}
                animate={{ scale: simStep === i ? 1.12 : 1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`relative z-10 border-4 px-3 py-2 min-w-[160px] bg-black shadow-[4px_4px_0_#000] ${
                  simStep === i ? 'border-[#ffe600]' : isBossMode ? 'border-[#7a0000]' : c.type === 'data' ? 'border-[#3bff5e]' : 'border-[#ff2e9a]'
                }`}
                style={simStep === i ? { boxShadow: '0 0 30px rgba(255,230,0,0.7), 4px 4px 0 #000' } : undefined}
              >
                <div className="flex items-center justify-between">
                  <motion.span key={agentPulse[i] || 0} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-xl">
                    {c.emoji}
                  </motion.span>
                  <span className={`font-pixel text-[7px] px-1 py-0.5 border ${
                    c.status === 'online' ? 'text-[#3bff5e] border-[#3bff5e]' : c.status === 'degraded' ? 'text-[#ffb14a] border-[#ffb14a]' : 'text-[#8b8ba0] border-[#8b8ba0] blink'
                  }`}>
                    {c.status === 'integrating' ? 'SETUP' : c.status === 'degraded' ? 'DIRTY' : 'ONLINE'}
                  </span>
                </div>
                <div className={`font-pixel text-[8px] leading-relaxed mt-1 ${simStep === i ? 'text-[#ffe600]' : 'text-[#2ee6ff]'}`}>{c.name}</div>
                <div className="font-crt text-base text-[#8b8ba0]">
                  {c.type === 'data' ? '🗄️ readiness' : (c.type === 'multiplier' || c.type === 'orchestrator' ? `×${c.value.toFixed(1)}` : `+${c.value}`)}
                  {c.type !== 'data' && <>{' · '}{c.cat === 'all' ? '⚡ all chaos' : `${CATS[c.cat].emoji} ${CATS[c.cat].label}`}</>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ================= WAVE INTRO OVERLAY ================= */}
      <AnimatePresence>
        {phase === 'waveIntro' && role && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/85 flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="text-center max-w-2xl"
            >
              <div className="inline-block bg-[#ff2d2d] text-black font-pixel text-[10px] px-4 py-2 border-4 border-black shadow-[4px_4px_0_#7a0000]">
                ROUND {round} · {ROUND_CFG[round].tickets} INCOMING
              </div>
              <h2
                className="font-pixel text-2xl md:text-4xl text-[#ffe600] mt-6 leading-snug"
                style={{ textShadow: '4px 4px 0 #ff2e9a, 7px 7px 0 #000' }}
              >
                {role.waves[round - 1][0]}
              </h2>
              <p className="font-crt text-2xl text-[#2ee6ff] mt-4 leading-tight">{role.waves[round - 1][1]}</p>
              {round === 1 && <p className="font-crt text-xl text-[#ffe600] mt-4">MISSION: {role.mission}</p>}
              <div className="font-crt text-xl text-[#8b8ba0] mt-5 leading-tight">
                Click a ticket to inspect it, then decide:<br />
                <span className="text-[#f2e8c9]">ROUTINE → HANDLE</span> · <span className="text-[#2ee6ff]">TEAM → ROUTE</span> · <span className="text-[#ff5555]">CRITICAL → ESCALATE</span>
                {deck.some((c) => c.type !== 'data' && c.status !== 'integrating') && <> · <span className="text-[#3bff5e]">or DELEGATE to an agent</span></>}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= DRAFT OVERLAY ================= */}
      <AnimatePresence>
        {phase === 'draft' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center px-4 overflow-y-auto py-6"
          >
            <div className="max-w-4xl w-full text-center">
              {/* AGENTFORCE UNLOCKED neon header */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                className="inline-block bg-[#031a12] border-4 border-[#2ee6ff] px-8 py-4"
                style={{ boxShadow: '0 0 34px rgba(46,230,255,0.55), 0 0 70px rgba(59,255,94,0.25), 4px 4px 0 #000' }}
              >
                <motion.h2
                  animate={{ textShadow: ['0 0 8px #2ee6ff', '0 0 18px #3bff5e', '0 0 8px #2ee6ff'] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="font-pixel text-xl md:text-3xl leading-snug"
                  style={{ color: '#7dfcd0' }}
                >
                  AGENTFORCE{' '}
                  <br />
                  UNLOCKED
                </motion.h2>
                <div className="font-crt text-xl text-[#2ee6ff] mt-2">🤖 {round === 1 ? 'Your first agent is available.' : `Deployment slot ${round} open.`}</div>
              </motion.div>
              <p className="font-crt text-xl text-[#8b8ba0] mt-4">
                {round === 1
                  ? `That was ${ROUND_CFG[1].tickets} tickets of pure judgment. It doubles from here. Deploy one capability — it spends next round integrating before it works.`
                  : 'One deployment per round. Integration takes a round. Nothing here is a miracle — read the fine print.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                {draftOptions.map((c, i) => (
                  <motion.button
                    key={c.name}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.12 * i, type: 'spring', stiffness: 260, damping: 20 }}
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => draftCard(c)}
                    className={`group bg-[#02100a] p-5 text-left border-4 flex flex-col ${
                      c.type === 'data' ? 'border-[#3bff5e]' : 'border-[#2ee6ff]'
                    }`}
                    style={{ boxShadow: c.type === 'data' ? '0 0 22px rgba(59,255,94,0.35), 4px 4px 0 #000' : '0 0 18px rgba(46,230,255,0.3), 4px 4px 0 #000' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-4xl bg-[#101024] border-2 border-[#2ee6ff]/40 px-3 py-2">{c.emoji}</span>
                      <span className={`font-pixel text-[8px] px-2 py-1 border-2 border-black ${c.type === 'data' ? 'bg-[#3bff5e] text-black' : 'bg-[#ff2e9a] text-black'}`}>
                        {c.type === 'data' ? 'READINESS' : c.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-4 font-pixel text-[10px] text-[#7dfcd0] leading-relaxed">{c.name}</div>
                    <div className="mt-3 font-pixel text-[7px] text-[#8b8ba0]">FEATURE</div>
                    <div className="font-crt text-lg text-[#f2e8c9] leading-tight">{c.cap}</div>
                    <div className="mt-2 font-pixel text-[7px] text-[#8b8ba0]">EFFECT</div>
                    <div className="font-crt text-lg text-[#3bff5e] leading-tight">{c.effect}</div>
                    <div className="mt-2 font-pixel text-[7px] text-[#8b8ba0]">WHY IT MATTERS</div>
                    <div className="font-crt text-lg text-[#ffe600] leading-tight">"{c.msg}"</div>
                    <div className={`mt-4 font-pixel text-[9px] text-center py-2 border-2 ${
                      c.type === 'data'
                        ? 'bg-[#3bff5e] text-black border-black group-hover:bg-[#7dfcd0]'
                        : 'bg-black text-[#3bff5e] border-[#3bff5e] group-hover:bg-[#3bff5e] group-hover:text-black'
                    }`}>
                      ► {c.type === 'data' ? 'FIX THE DATA' : 'DEPLOY AGENT'}
                    </div>
                  </motion.button>
                ))}
              </div>
              {!dataClean && round >= 2 && !deck.some((c) => c.type === 'data') && (
                <p className="font-crt text-xl text-[#ffb14a] mt-5">Your agents are running on swamp data. Shiny new agents won't fix that.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= ROUND SUMMARY OVERLAY ================= */}
      <AnimatePresence>
        {phase === 'summary' && summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="bg-black border-4 border-[#2ee6ff] shadow-[8px_8px_0_rgba(255,46,154,0.55)] max-w-lg w-full p-7"
            >
              <div className="font-pixel text-[10px] text-[#ffe600]">■ ROUND {summary.round} DEBRIEF ■</div>
              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  ['CHAOS', summary.volume, 'text-[#f2e8c9]'],
                  ['DECIDED', summary.manual, 'text-[#2ee6ff]'],
                  ['BY AGENTS', summary.auto, 'text-[#3bff5e]'],
                  ['MISROUTED', summary.wrong, summary.wrong > 0 ? 'text-[#ff2d2d]' : 'text-[#8b8ba0]'],
                  ['ESCALATED', summary.esc, summary.esc > 3 ? 'text-[#ff2d2d]' : 'text-[#8b8ba0]'],
                  ['DUPLICATES', summary.dups, summary.dups > 0 ? 'text-[#ffb14a]' : 'text-[#8b8ba0]'],
                ].map(([label, val, color]) => (
                  <div key={label} className="bg-[#0d0d1f] border-2 border-[#2ee6ff]/40 p-3">
                    <div className={`font-pixel text-lg tabular-nums ${color}`}>{val}</div>
                    <div className="font-pixel text-[7px] text-[#8b8ba0] mt-2">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-baseline gap-5">
                <div>
                  <div className="font-pixel text-xl text-[#3bff5e] tabular-nums" style={{ textShadow: '2px 2px 0 #000' }}>{fmt(summary.score)}</div>
                  <div className="font-crt text-base text-[#8b8ba0]">{role.metric}</div>
                </div>
                <div>
                  <div className="font-crt text-xl text-[#6b6b7a] tabular-nums">{fmt(ghostScore)}</div>
                  <div className="font-crt text-base text-[#6b6b7a]">Manual Ops Inc.</div>
                </div>
              </div>
              <p className="mt-4 font-crt text-xl text-[#ffe600] leading-tight border-2 border-[#ffe600]/50 bg-[#151505] p-3">
                {summaryLine(summary)}
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={nextFromSummary}
                className={`btn-pixel mt-6 w-full py-4 text-xs bg-black ${round >= 4 ? 'text-[#ff2d2d] border-[#ff2d2d]' : 'text-[#3bff5e] border-[#3bff5e]'}`}
              >
                {round >= 4 ? '⚠ ENTER THE FINAL ROUND' : `► BRACE FOR ROUND ${round + 1}`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= BOSS INTRO OVERLAY ================= */}
      <AnimatePresence>
        {phase === 'bossIntro' && role && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/95 flex items-center justify-center px-6 scanlines-red"
          >
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="text-center max-w-2xl">
              <div className="inline-block bg-[#ff2d2d] text-black font-pixel text-[10px] px-4 py-2 border-4 border-black blink">
                FINAL ROUND · THE ENGINE BREAK
              </div>
              <h2
                className="font-pixel text-2xl md:text-4xl text-[#ff2d2d] mt-6 leading-snug"
                style={{ textShadow: '4px 4px 0 #7a0000, 7px 7px 0 #000' }}
              >
                {role.waves[4][0]}
              </h2>
              <p className="font-crt text-2xl text-[#f2e8c9] mt-4 leading-tight">{role.waves[4][1]}</p>
              <div className="mt-6 bg-[#2b0505] border-4 border-[#ff2d2d] shadow-[6px_6px_0_#000] p-5">
                <div className="font-pixel text-[9px] text-[#ff5555]">TARGET TO SURVIVE THE QUARTER</div>
                <div className="font-pixel text-3xl text-[#ffe600] tabular-nums mt-3" style={{ textShadow: '3px 3px 0 #7a0000' }}>{fmt(bossTarget)}</div>
                <div className="font-crt text-xl text-[#8b8ba0] mt-3 leading-tight">
                  100+ tickets incoming. Manual triage disabled. <span className="text-[#ff5555]">No human can triage this.</span>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={startBossCrisis}
                className="btn-pixel mt-6 bg-black text-[#ff2d2d] border-[#ff2d2d] text-sm px-10 py-4"
              >
                ► FACE IT
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= VICTORY ================= */}
      {phase === 'victory' && role && (
        <div className="max-w-3xl mx-auto px-6 py-10 relative z-10">
          <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: '-10vh', x: `${(i * 71) % 100}vw`, rotate: 0, opacity: 1 }}
                animate={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 720, opacity: [1, 1, 0.6] }}
                transition={{ duration: 2.6 + (i % 10) * 0.25, delay: (i % 7) * 0.12, ease: 'easeIn' }}
                className="absolute w-2.5 h-2.5"
                style={{ backgroundColor: ['#2ee6ff', '#ffe600', '#3bff5e', '#ff2e9a', '#f2e8c9'][i % 5] }}
              />
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="flex justify-center"><Avatar r={role} size={72} /></div>
            <div className="font-pixel text-[10px] text-[#3bff5e] mt-4 blink">★ QUARTER SURVIVED ★</div>
            <h2
              className="font-pixel text-xl md:text-3xl text-[#f2e8c9] mt-4 leading-snug"
              style={{ textShadow: '4px 4px 0 #3bff5e, 7px 7px 0 #000' }}
            >
              THE BUSINESS RUNS ITSELF NOW.
            </h2>
            <p className="font-crt text-2xl text-[#2ee6ff] mt-4 leading-tight">{role.victory}</p>
            <p className="font-crt text-xl text-[#ffe600] mt-2 leading-tight">MISSION RESULT: {role.win}</p>

            <div className="mt-8 bg-black border-4 border-[#3bff5e] shadow-[8px_8px_0_#000] p-7">
              <div className="font-crt text-2xl text-[#2ee6ff]">
                ({role.base}
                {deck.filter((c) => c.type === 'additive' || c.type === 'trigger').map((c, i) => (
                  <span key={i}> + {effAdd(c)}</span>
                ))}
                )
                {deck.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator').map((c, i) => (
                  <span key={i}> × {effMult(c).toFixed(effMult(c) === c.value ? 1 : 2)}</span>
                ))}
                {' = '}
                <span className="text-[#3bff5e] font-bold">{fmt(fullEngine.total)}</span>
              </div>
              <div className={`font-pixel text-[8px] mt-2 ${dataClean ? 'text-[#3bff5e]' : 'text-[#ffb14a]'}`}>
                {dataClean ? 'DATA: UNIFIED — AGENTS AT ADVERTISED PERFORMANCE' : 'DATA: STILL A SWAMP — IMAGINE THIS RUN WITH CLEAN DATA'}
              </div>
              <div className="grid grid-cols-2 gap-6 mt-6">
                <div>
                  <div className="font-pixel text-2xl text-[#3bff5e] tabular-nums" style={{ textShadow: '2px 2px 0 #000' }}>{fmt(finalScore)}</div>
                  <div className="font-crt text-lg text-[#8b8ba0] mt-2">You, with the stack</div>
                </div>
                <div>
                  <div className="font-pixel text-2xl text-[#6b6b7a] tabular-nums line-through">{fmt(ghostScore)}</div>
                  <div className="font-crt text-lg text-[#6b6b7a] mt-2">Manual Ops Inc. (did not survive Q3)</div>
                </div>
              </div>
              <p className="mt-6 font-crt text-2xl text-[#f2e8c9] leading-tight">
                You: {fmt(finalScore)}. Manual: {fmt(ghostScore)}. That's{' '}
                <span className="font-pixel text-xl text-[#ffe600]" style={{ textShadow: '2px 2px 0 #000' }}>{ghostMultiple}×</span> — and the chaos
                never slowed down.
              </p>
              <div className="mt-4 font-crt text-lg text-[#8b8ba0] leading-tight">
                Five rounds. {ROUND_CFG[1].tickets + ROUND_CFG[2].tickets + ROUND_CFG[3].tickets + ROUND_CFG[4].tickets + ROUND_CFG[5].tickets}+ chaos tickets.
                You made the judgment calls, fixed the data, and drafted the system that beat the flood.
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={replay}
              className="btn-pixel mt-8 bg-black text-[#2ee6ff] border-[#2ee6ff] text-xs px-10 py-5"
            >
              ↻ RUN IT BACK AS A DIFFERENT EXEC
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
