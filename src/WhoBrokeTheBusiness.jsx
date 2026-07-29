import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ============================================================
   WHO BROKE THE BUSINESS?
   A 5-round business-chaos roguelite in 8-bit arcade dress.
   Papers, Please escalation × roguelite draft × Balatro payoff.
   ============================================================ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const ROUND_CFG = {
  1: { tickets: 12, spawnMs: 950, triageSec: 14, escalateMs: 5200 },
  2: { tickets: 20, spawnMs: 600, triageSec: 14, escalateMs: 5000 },
  3: { tickets: 32, spawnMs: 380, triageSec: 13, escalateMs: 4800 },
  4: { tickets: 50, spawnMs: 230, triageSec: 13, escalateMs: 4500 },
  5: { tickets: 110, spawnMs: 65, triageSec: 0, escalateMs: 2400 },
};
const GHOST_DECAY = { 1: 1, 2: 0.7, 3: 0.4, 4: 0.15, 5: 0 };
const MANUAL_POINTS = 10;

const CATS = {
  ops: { emoji: '🔥', label: 'ops' },
  data: { emoji: '📊', label: 'data' },
  people: { emoji: '👥', label: 'people' },
};
const CAT_KEYS = Object.keys(CATS);

/* ---------- roles, chaos pools, waves, cards ---------- */

const card = (name, emoji, type, value, cat, desc) => ({
  name, emoji, type, value, cat, desc,
});
const typeDesc = {
  additive: (v, cat) => `Deploys instantly. +${v} base capacity. Intercepts ${CATS[cat].emoji} ${CATS[cat].label} chaos.`,
  trigger: (v, cat) => `Watches the board. Pounces the moment ${CATS[cat].emoji} ${CATS[cat].label} chaos spawns. +${v} base.`,
  multiplier: (v, cat) => `Compounds everything before it. ×${v} total impact. Intercepts ${CATS[cat].emoji} ${CATS[cat].label} chaos.`,
  orchestrator: (v) => `Links every agent you've drafted into one system. ×${v} total impact. Intercepts everything.`,
};
const mk = (name, emoji, type, value, cat) => card(name, emoji, type, value, cat, typeDesc[type](value, cat));

const ROLES = [
  {
    key: 'ceo', name: 'CEO', emoji: '👩‍💼', tagline: 'Grow the business.', base: 100,
    victory: 'One source of truth. Every team, one number. The board deck finally agrees with itself.',
    waves: [
      ['SILO STORM', 'Every team has a different number for revenue. All of them are confident.'],
      ['BOARD MEETING TOMORROW', 'The deck contradicts itself on slides 4, 9, and 31.'],
      ['REORG RUMORS', 'Three departments claim ownership of the same project. None of them are working on it.'],
      ['EARNINGS WEEK', 'Everyone wants a narrative. Nobody has the data.'],
      ['THE PERFECT STORM', 'Activist investor. Leaked memo. And the KPI dashboard just went down.'],
    ],
    tickets: [
      'Board deck v47_FINAL_final2.pptx contradicts v46',
      'Sales says revenue is $4M. Finance says $2.8M. Both are "sure."',
      'Ops runs on a spreadsheet only Dave understands. Dave quit.',
      'Two departments launched the same product this morning',
      'All-hands question: "What is our strategy?" — asked by the strategy team',
      'Q3 forecast is a screenshot of a whiteboard',
      'Someone approved a rebrand. Nobody knows who.',
      'Regional office reports in a different currency. Sometimes.',
      'The KPI dashboard shows 404',
      'Merger rumor started by our own newsletter',
    ],
    cards: [
      mk('The Blueprint Builder', '📐', 'additive', 500, 'ops'),
      mk('The Strategic Ear', '👂', 'trigger', 250, 'data'),
      mk('Cross-Cloud Orchestrator', '☁️', 'multiplier', 1.5, 'people'),
      mk('The Company Brain', '🧠', 'orchestrator', 2.0, 'all'),
    ],
  },
  {
    key: 'cfo', name: 'CFO', emoji: '💰', tagline: 'Protect the bottom line.', base: 100,
    victory: 'Every dollar accounted for. The bottom line started protecting itself.',
    waves: [
      ['COST SPIRAL', 'Three tools doing the same job. All three auto-renewed at midnight.'],
      ['REFUND MELTDOWN', 'Your chatbot has been issuing refunds. Enthusiastically.'],
      ['AUDIT SEASON', 'The auditors have questions. The spreadsheet has circular references.'],
      ['BUDGET LOCKDOWN', 'Every department wants more. The numbers want less.'],
      ['THE PERFECT STORM', 'Quarter close, a rogue chatbot, and the cloud bill just doubled itself.'],
    ],
    tickets: [
      'Refund issued: $0.00 and also $40,000',
      'Chatbot offered "unlimited refunds forever"',
      'Three tools doing the same job. All auto-renewed.',
      'Expense report: "team morale" — $18,500',
      'Invoice #4471 is 90 days late. Customer: "what invoice?"',
      'Cloud bill doubled. Nobody deployed anything.',
      'Vendor raised prices via a footnote',
      'Duplicate payment sent twice, to be safe',
      'Budget sheet has a circular reference and an attitude',
      'Someone bought Super Bowl ad space "as a test"',
    ],
    cards: [
      mk('Invoice Chaser', '🧾', 'additive', 400, 'ops'),
      mk('Anomaly Watcher', '🚨', 'trigger', 250, 'data'),
      mk('Vendor Auto-Negotiator', '🤝', 'multiplier', 1.5, 'people'),
      mk('The Ledger Mind', '🧮', 'orchestrator', 2.0, 'all'),
    ],
  },
  {
    key: 'cto', name: 'CTO', emoji: '💻', tagline: 'Keep the stack from collapsing.', base: 100,
    victory: 'The stack held. Engineering is building again — not firefighting.',
    waves: [
      ['TICKET AVALANCHE', 'Support tickets are being escalated straight to engineering. All of them.'],
      ['DEBT COLLECTION', 'The technical debt now has its own technical debt.'],
      ['LEGACY AWAKENS', 'The DOS terminal in the corner is beeping. Nobody will touch it.'],
      ['DEPLOY FREEZE', 'Prod is down. Staging is fine. Nobody knows why.'],
      ['THE PERFECT STORM', 'Prod is down, the on-call quit, and the DOS terminal is beeping in Morse code.'],
    ],
    tickets: [
      'Support ticket escalated straight to engineering. Again.',
      'Technical debt now has its own technical debt',
      'The DOS terminal is beeping. Nobody will touch it.',
      'Prod is down. Staging is fine. Nobody knows why.',
      'New hire asked what the "legacy system" does. Silence.',
      '17 microservices. 1 works.',
      'Mainframe password was on a sticky note. Sticky note gone.',
      'CI red for 6 days, labeled "known issue"',
      'Someone force-pushed to main on a Friday',
      "The wiki's last update: 2019",
    ],
    cards: [
      mk('Bug Triage Protocol', '🐛', 'additive', 500, 'ops'),
      mk('SLA Enforcer', '⏱️', 'trigger', 250, 'data'),
      mk('Knowledge Architect', '📚', 'multiplier', 1.5, 'people'),
      mk('The Systems Conductor', '🎛️', 'orchestrator', 2.0, 'all'),
    ],
  },
  {
    key: 'cmo', name: 'CMO', emoji: '📈', tagline: 'Generate leads Sales actually wants.', base: 100,
    victory: 'Sales just asked for MORE leads. Every one is a real person. None of them are named Steve.',
    waves: [
      ['PIPELINE DROUGHT', 'The funnel chart looks great. The funnel is empty.'],
      ['WRONG LIST', 'The campaign just emailed the churn list a "welcome back!"'],
      ['THE STEVE PROBLEM', 'Every customer in the CRM is named Steve. Every single one.'],
      ['LAUNCH WEEK', 'Five channels, one intern, zero attribution.'],
      ['THE PERFECT STORM', 'Product launch, wrong list, and 40,000 people just got "Hi {FirstName}".'],
    ],
    tickets: [
      'Lead name: Steve. Company: Steve. Email: steve',
      'Campaign emailed the churn list a "welcome back!"',
      'Pipeline is empty but the funnel chart looks great',
      'Every customer in the CRM is named Steve',
      'Sent "Hi {FirstName}" to 40,000 people',
      'Webinar has 3 registrants. Two are your interns.',
      'Brand guidelines: 200 pages. Nobody read page 2.',
      'Paid ads targeting: "everyone, everywhere"',
      'Attribution model says the fax machine drove Q2',
      'Influencer posted the wrong product. It sold out.',
    ],
    cards: [
      mk('Intent Scorer', '🎯', 'additive', 400, 'ops'),
      mk('Audience Orchestrator', '📣', 'trigger', 250, 'data'),
      mk('Micro-Personalization Engine', '🔬', 'multiplier', 1.5, 'people'),
      mk('Autonomous Campaign Manager', '🚀', 'orchestrator', 2.0, 'all'),
    ],
  },
  {
    key: 'cro', name: 'CRO', emoji: '🤝', tagline: 'Hit your number.', base: 100,
    victory: 'Number: hit. Forecast: math, not vibes. Reps: actually selling.',
    waves: [
      ['ADMIN SWAMP', 'Your reps spent 6 hours updating CRM fields today. They sold nothing.'],
      ['EMPTY FIELDS', 'The CRM is a beautiful, expensive void.'],
      ['FORECAST: VIBES', 'The pipeline review is tomorrow. The methodology is a shrug.'],
      ['QUARTER CRUNCH', 'Every deal is "closing this week." Every week.'],
      ['THE PERFECT STORM', 'Last day of the quarter. The forecast is vibes and the CRM just logged out everyone.'],
    ],
    tickets: [
      'Rep spent 6 hours updating CRM fields. Sold nothing.',
      'Forecast methodology: vibes',
      'Deal stage: "Closed Won?" — with the question mark',
      'Discount approved: 90%. By whom? Unclear.',
      'CRM says the deal closed in 1970',
      'Top rep\'s pipeline: 40 deals named "Follow up"',
      'Prospect ghosted right after "send me pricing"',
      'Quota was set before anyone checked the market',
      'Renewal date passed. Nobody noticed. The customer did.',
      'Sales and Marketing fighting over a lead named Steve',
    ],
    cards: [
      mk('Pipeline Hygienist', '🧹', 'additive', 500, 'ops'),
      mk('Synthetic Coach', '🎓', 'trigger', 250, 'data'),
      mk('Dynamic Margin Pricing', '💹', 'multiplier', 1.5, 'people'),
      mk('The Revenue Engine', '⚙️', 'orchestrator', 2.0, 'all'),
    ],
  },
  {
    key: 'cs', name: 'Head of Customer Service', emoji: '🎧', tagline: 'Keep customers happy.', base: 100,
    victory: 'Queue: empty. CSAT: up. The AI made the right call — 4,000 times in a row.',
    waves: [
      ['QUEUE OVERFLOW', 'Wait time: 4 hours. Hold music: one song, on loop.'],
      ['CONFIDENTLY WRONG', 'Your AI just made the wrong call. With total confidence. To a VIP.'],
      ['REGIONAL OUTAGE', 'Everything is down. The status page is all green.'],
      ['CSAT FREEFALL', 'The survey went out mid-outage. The results are in. They rhyme with "disaster."'],
      ['THE PERFECT STORM', 'Regional outage, 4-hour queue, and the AI is apologizing to the wrong customers.'],
    ],
    tickets: [
      'Queue wait: 4 hours. Hold music: 1 song.',
      'AI confidently said the product is discontinued. It is not.',
      'Regional outage. Status page: all green.',
      'VIP stuck in a tier-1 loop for 3 days',
      'Refund macro fired on a compliment',
      'Customer replied "ok" — case auto-closed as resolved',
      'CSAT survey sent mid-outage',
      'Agent handbook contradicts itself on page 1',
      'One customer, 47 tickets. All valid.',
      '"Urgent" tag applied to every ticket, so none are',
    ],
    cards: [
      mk('Inbox Triage', '📥', 'additive', 400, 'ops'),
      mk('Escalation Assistant', '🆘', 'trigger', 250, 'data'),
      mk('Tier-1 Auto-Resolve', '✅', 'multiplier', 1.5, 'people'),
      mk('The Service Mesh', '🕸️', 'orchestrator', 2.0, 'all'),
    ],
  },
];

/* Sidegrade decoys per draft slot — the role card is the strong pick,
   but any pick keeps the run winnable (the boss target is computed
   from the actual deck). */
const DECOYS = [
  [mk('Form-Filler 3000', '📋', 'additive', 350, 'ops'), mk('Meeting Summarizer', '📝', 'additive', 300, 'data')],
  [mk('Alert Forwarder', '🔔', 'trigger', 150, 'data'), mk('Status Pinger', '📡', 'trigger', 200, 'ops')],
  [mk('Template Recycler', '♻️', 'multiplier', 1.2, 'people'), mk('FAQ Deflector', '🛡️', 'multiplier', 1.3, 'ops')],
  [mk('Workflow Stapler', '📎', 'orchestrator', 1.6, 'all'), mk('Dashboard Unifier', '🖥️', 'orchestrator', 1.7, 'all')],
];

const AMBIENT_NOISE = ['URGENT', 'RE: RE: RE:', 'FYI', 'per my last email', 'quick sync?', 'EOD??', 'circling back', 'as discussed', '@here', 'ping'];

/* ---------- scoring engine ---------- */
function engineOf(base, cards) {
  const adds = cards.filter((c) => c.type === 'additive' || c.type === 'trigger');
  const mults = cards.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator');
  const addSum = adds.reduce((s, c) => s + c.value, 0);
  const multProd = mults.reduce((p, c) => p * c.value, 1);
  return { adds, mults, addSum, multProd, total: Math.round((base + addSum) * multProd) };
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
  const [phase, setPhase] = useState('roleSelect');
  // roleSelect | waveIntro | triage | draft | resolution | summary
  // bossIntro | bossCrisis | simulate | victory
  const [deck, setDeck] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [manualScore, setManualScore] = useState(0);
  const [ghostScore, setGhostScore] = useState(0);
  const [appliedCount, setAppliedCount] = useState(0); // deck cards applied to the formula
  const [simStep, setSimStep] = useState(-1); // card firing right now
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
  const [escalations, setEscalations] = useState(0);

  const idRef = useRef(0);
  const ticketsRef = useRef([]);
  const deckRef = useRef([]);
  const phaseRef = useRef(phase);
  const mcRef = useRef(0); // manual clears this round
  const acRef = useRef(0); // auto clears this round
  const ecRef = useRef(0); // escalations this round
  const r1ManualRef = useRef(0);
  const manualScoreRef = useRef(0);

  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { manualScoreRef.current = manualScore; }, [manualScore]);

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
          : Math.min(100, Math.round(((liveTickets.length + escalatedCount * 1.2) / (cfg ? cfg.tickets : 12)) * 160));

  const doShake = useCallback((cls) => {
    if (!cls) return;
    setShakeCls('');
    requestAnimationFrame(() => setShakeCls(cls));
    setTimeout(() => setShakeCls(''), 700);
  }, []);

  /* ---------- ticket helpers ---------- */

  const spawnTicket = useCallback((r) => {
    const id = ++idRef.current;
    const t = {
      id,
      text: rand(r.tickets),
      cat: rand(CAT_KEYS),
      escalated: false,
      spawnedAt: performance.now(),
      fate: null,
    };
    setTickets((ts) => [...ts, t]);
  }, []);

  const removeTickets = useCallback((ids, fate) => {
    if (!ids.length) return;
    const set = new Set(ids);
    setTickets((ts) => ts.map((t) => (set.has(t.id) ? { ...t, fate } : t)));
    setTimeout(() => {
      setTickets((ts) => ts.filter((t) => !set.has(t.id)));
    }, 420);
  }, []);

  const clickTicket = (t) => {
    if (phase === 'bossCrisis' || phase === 'simulate') {
      setNoHuman(true);
      setTimeout(() => setNoHuman(false), 1400);
      doShake('shake-s');
      return;
    }
    if (phase !== 'triage' || t.fate) return;
    removeTickets([t.id], 'manual');
    mcRef.current += 1;
    if (round === 1) r1ManualRef.current += 1;
    setManualClears((m) => m + 1);
    setManualScore((s) => s + MANUAL_POINTS);
    setGhostScore((g) => g + MANUAL_POINTS * GHOST_DECAY[round]);
  };

  /* ---------- round lifecycle ---------- */

  const startRound = useCallback((r) => {
    mcRef.current = 0; acRef.current = 0; ecRef.current = 0;
    setManualClears(0); setAutoClears(0); setEscalations(0);
    setTickets([]);
    setSummary(null);
    setSimStep(-1);
    setRound(r);
    setMeterOverride(null);
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
    }, 2800);
    return () => clearTimeout(t);
  }, [phase, round]);

  // TRIAGE ENGINE: spawner + countdown + escalation + agent interception
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
      setTimeLeft((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);

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
      if (newEsc > 0) {
        ecRef.current += newEsc;
        setEscalations((e) => e + newEsc);
      }
    }, 450);

    // Agents intercept live during the triage window (rounds 2–4)
    const agentInt = setInterval(() => {
      const agents = deckRef.current;
      if (!agents.length) return;
      const toClear = [];
      const pulses = {};
      let pool = ticketsRef.current.filter((t) => !t.fate && !toClear.includes(t.id));
      agents.forEach((a, i) => {
        const grab = (n, catOnly) => {
          const candidates = pool.filter(
            (t) => !toClear.includes(t.id) && (!catOnly || a.cat === 'all' || t.cat === a.cat)
          );
          candidates.slice(0, n).forEach((t) => {
            toClear.push(t.id);
            pulses[i] = (pulses[i] || 0) + 1;
          });
        };
        if (a.type === 'trigger') grab(3, true); // pounces on its category
        else if (a.type === 'orchestrator') grab(2, false);
        else if (a.type === 'multiplier') grab(1, false);
        else { grab(1, true); if (!pulses[i] && Math.random() < 0.5) grab(1, false); }
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
    }, 520);

    return () => {
      clearInterval(spawnInt);
      clearInterval(countInt);
      clearInterval(escInt);
      clearInterval(agentInt);
    };
  }, [phase, round, role, spawnTicket, removeTickets]);

  // timer hits zero → draft
  useEffect(() => {
    if (phase !== 'triage' || timeLeft > 0) return undefined;
    const t = setTimeout(() => {
      const slot = round - 1;
      const opts = shuffle([role.cards[slot], ...DECOYS[slot]]);
      setDraftOptions(opts);
      setPhase('draft');
    }, 600);
    return () => clearTimeout(t);
  }, [phase, timeLeft, round, role]);

  /* ---------- draft + resolution ---------- */

  const draftCard = (c) => {
    const newDeck = [...deck, { ...c, draftedRound: round }];
    setDeck(newDeck);
    deckRef.current = newDeck;
    runResolution(newDeck);
  };

  const runResolution = async (theDeck) => {
    setPhase('resolution');
    setSimStep(-1);
    setAppliedCount(0);
    await sleep(500);
    for (let i = 0; i < theDeck.length; i++) {
      setSimStep(i);
      const remaining = ticketsRef.current.filter((t) => !t.fate);
      const n = Math.ceil(remaining.length / (theDeck.length - i));
      const batch = remaining.slice(0, n).map((t) => t.id);
      if (batch.length) {
        removeTickets(batch, 'agent');
        acRef.current += batch.length;
        setAutoClears((v) => v + batch.length);
      }
      await sleep(350);
      setAppliedCount(i + 1);
      const type = theDeck[i].type;
      doShake(type === 'orchestrator' ? 'shake-b' : type === 'multiplier' ? 'shake-s' : '');
      await sleep(700);
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
      score: eng.total + manualScoreRef.current,
    });
    setPhase('summary');
  };

  const summaryLine = (s) => {
    switch (s.round) {
      case 1:
        return `You cleared ${s.manual} of ${s.volume} by hand. ${s.esc} escalated. This was the SLOW week. Imagine five more Mondays like this.`;
      case 2:
        return `Chaos up 67% since Round 1. Your agent intercepted ${s.auto} tickets while you clicked. You're still in it — barely.`;
      case 3: {
        const r1 = Math.max(1, r1ManualRef.current);
        const pct = Math.max(0, Math.round((1 - s.manual / r1) * 100));
        return `Chaos up 167% since Round 1. Your manual workload: down ${pct}%. The stack is starting to carry you.`;
      }
      case 4:
        return `${s.volume} tickets. You touched ${s.manual}. The stack handled ${s.auto}. Notice what you were doing this round: watching.`;
      default:
        return '';
    }
  };

  const nextFromSummary = () => {
    if (round >= 4) {
      const eng = engineOf(role.base, deckRef.current);
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
    for (let i = 0; i < theDeck.length; i++) {
      setSimStep(i);
      await sleep(300);
      // agents pounce on boss tickets in batches
      const remaining = ticketsRef.current.filter((t) => !t.fate);
      const n = Math.ceil(remaining.length / (theDeck.length - i) * 0.9);
      const batch = remaining.slice(0, n).map((t) => t.id);
      if (batch.length) {
        removeTickets(batch, 'agent');
        acRef.current += batch.length;
        setAutoClears((v) => v + batch.length);
      }
      await sleep(300);
      setAppliedCount(i + 1);
      const type = theDeck[i].type;
      doShake(type === 'orchestrator' ? 'shake-b' : 'shake-s');
      await sleep(880);
    }
    // final lock: clear everything, drain the meter, kill the ghost
    const rest = ticketsRef.current.filter((t) => !t.fate).map((t) => t.id);
    removeTickets(rest, 'agent');
    acRef.current += rest.length;
    setSimStep(-1);
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
    setManualScore(0);
    manualScoreRef.current = 0;
    setGhostScore(0);
    setAppliedCount(0);
    setSimStep(-1);
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
  const scoreScale = phase === 'simulate' ? 1 + scoreStage * 0.16 : 1;

  const SEGS = 24;
  const filledSegs = Math.round((meterPct / 100) * SEGS);
  const segColor = meterPct > 66 ? '#ff2d2d' : meterPct > 33 ? '#ffe600' : '#3bff5e';

  const fullEngine = role ? engineOf(role.base, deck) : null;
  const finalScore = fullEngine ? fullEngine.total + manualScore : 0;
  const ghostMultiple = ghostScore > 0 ? Math.round(finalScore / Math.max(1, ghostScore)) : finalScore;

  const panelCls = isBossMode
    ? 'bg-black border-4 border-[#ff2d2d] shadow-[6px_6px_0_#000]'
    : 'bg-black border-4 border-[#2ee6ff] shadow-[6px_6px_0_rgba(255,46,154,0.55)]';

  /* ============================ RENDER ============================ */

  return (
    <div className={`min-h-screen w-full transition-colors duration-1000 ${bgClass} ${shakeCls} relative overflow-hidden crt ${isBossMode ? 'scanlines-red' : ''}`} style={{ imageRendering: 'pixelated' }}>
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
        .crt::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 2px,transparent 2px 4px);pointer-events:none;z-index:50;}
        .scanlines-red::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,45,45,.09) 0 3px,transparent 3px 6px);pointer-events:none;z-index:50;}
        .btn-pixel{font-family:'Press Start 2P',monospace;text-transform:uppercase;border-width:4px;border-style:solid;image-rendering:pixelated;box-shadow:4px 4px 0 #000;}
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

      {/* ================= ROLE SELECT ================= */}
      {phase === 'roleSelect' && (
        <div className="max-w-5xl mx-auto px-6 py-10 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <p className="font-pixel text-[10px] text-[#ff2e9a] tracking-widest">★ A BUSINESS SIMULATOR IN 5 ROUNDS ★</p>
            <h1
              className="font-pixel text-3xl md:text-5xl text-[#f2e8c9] mt-5 leading-snug"
              style={{ textShadow: '4px 4px 0 #ff2e9a, 8px 8px 0 #000' }}
            >
              WHO BROKE THE
              <br />
              BUSINESS?
            </h1>
            <p className="font-crt text-2xl text-[#2ee6ff] mt-5 max-w-2xl mx-auto leading-tight">
              The chaos doubles every round. You don't. Survive five waves, draft your Agentforce
              stack, and find out what happens when the humans stop drowning.
            </p>
            <div className="inline-block mt-5 bg-black border-4 border-[#f2e8c9] px-5 py-2">
              <p className="font-crt text-xl text-[#f2e8c9]">The business is already on fire.</p>
            </div>
            <p className="font-pixel text-xs text-[#ffe600] mt-8 blink">▼ PICK YOUR ROLE ▼</p>
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
                <div className="text-5xl text-center bg-[#101024] border-2 border-[#2ee6ff]/40 py-4">{r.emoji}</div>
                <div className="mt-3 font-pixel text-[11px] text-[#2ee6ff] leading-relaxed">{r.name}</div>
                <div className="font-crt text-xl text-[#f2e8c9] mt-1 leading-tight">{r.tagline}</div>
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
              <div className={`font-pixel text-[9px] ${isBossMode ? 'text-[#ff2d2d]' : 'text-[#ff2e9a]'}`}>
                {role.emoji} {role.name} · ROUND {round}/5
              </div>
              <motion.div
                animate={{ scale: scoreScale }}
                className={`font-pixel tabular-nums ${scoreColor} ${phase === 'simulate' && scoreStage >= 3 ? 'vibrate' : ''}`}
                style={{ fontSize: '1.9rem', lineHeight: 1.3, transformOrigin: 'left center', textShadow: '3px 3px 0 #000' }}
              >
                {fmt(displayScore)}
              </motion.div>
              {/* GHOST LINE */}
              <div className="mt-1">
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
              {/* FORMULA BAR */}
              <div className={`font-pixel text-[9px] ${isBossMode ? 'text-[#ff5555]' : 'text-[#ffe600]'}`}>THE FORMULA</div>
              <div className={`mt-1 flex flex-wrap items-center gap-1 font-crt text-xl ${isBossMode ? 'text-[#f2e8c9]' : 'text-[#2ee6ff]'}`}>
                <span>(</span>
                <span className="font-bold">{role.base}</span>
                {deck.filter((c) => c.type === 'additive' || c.type === 'trigger').map((c, i) => {
                  const deckIdx = deck.indexOf(c);
                  const applied = deckIdx < appliedCount;
                  const firing = deckIdx === simStep;
                  return (
                    <motion.span
                      key={c.name + i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: applied ? 1 : 0.35, x: 0, scale: firing ? 1.25 : 1 }}
                      className={firing ? 'text-[#ffe600] font-bold' : applied ? 'font-bold' : ''}
                    >
                      {' '}+ {c.value}
                    </motion.span>
                  );
                })}
                <span>)</span>
                {deck.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator').map((c, i) => {
                  const deckIdx = deck.indexOf(c);
                  const applied = deckIdx < appliedCount;
                  const firing = deckIdx === simStep;
                  return (
                    <motion.span
                      key={c.name + i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: applied ? 1 : 0.35, x: 0, scale: firing ? 1.35 : 1 }}
                      className={firing ? 'text-[#ff2e9a] font-bold' : applied ? 'font-bold' : ''}
                    >
                      {' '}× {c.value.toFixed(1)}
                    </motion.span>
                  );
                })}
                <span> = </span>
                <span className="font-bold text-[#3bff5e]">{fmt(engineOf(role.base, deck.slice(0, appliedCount)).total)}</span>
                {manualScore > 0 && <span className="font-crt text-base text-[#6b6b7a]">+ {manualScore} hustle</span>}
              </div>

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
              <div className={`text-center px-4 py-2 border-4 ${timeLeft <= 4 ? 'border-[#ff2d2d] bg-[#2b0505]' : 'border-[#ffe600] bg-[#151505]'}`}>
                <span className={`font-pixel text-2xl tabular-nums ${timeLeft <= 4 ? 'text-[#ff2d2d] blink' : 'text-[#ffe600]'}`}>{timeLeft}</span>
                <div className="font-pixel text-[8px] text-[#8b8ba0] mt-1">TRIAGE</div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div className={`flex flex-wrap gap-2 content-start min-h-[280px] p-4 ${isBossMode ? 'bg-black/60 border-4 border-[#7a0000]' : 'bg-[#0a0514]/80 border-4 border-[#2ee6ff]/40'}`}>
            <AnimatePresence>
              {tickets.map((t) => (
                <motion.button
                  key={t.id}
                  layout
                  initial={{ scale: 0, opacity: 0, y: -14 }}
                  animate={
                    t.fate === 'manual'
                      ? { scale: [1, 1.4, 0], opacity: [1, 1, 0] }
                      : t.fate === 'agent'
                        ? { y: 180, x: (t.id % 7 - 3) * 30, scale: 0.2, opacity: 0, rotate: (t.id % 5 - 2) * 30 }
                        : { scale: 1, opacity: 1, y: 0, x: t.escalated ? [0, -2, 2, -2, 0] : 0 }
                  }
                  transition={t.fate === 'agent' ? { duration: 0.42, ease: 'easeIn' } : t.fate === 'manual' ? { duration: 0.22 } : { type: 'spring', stiffness: 400, damping: 22, x: { repeat: t.escalated ? Infinity : 0, duration: 0.35 } }}
                  exit={{ opacity: 0, transition: { duration: 0.01 } }}
                  onClick={() => clickTicket(t)}
                  className={`text-left font-crt px-2 py-1 border-2 shadow-[3px_3px_0_#000] select-none cursor-pointer ${round === 5 ? 'text-sm max-w-[150px]' : 'text-lg max-w-[220px]'} leading-none ${
                    t.escalated
                      ? 'bg-[#ff2d2d] text-black border-[#7a0000] blink'
                      : isBossMode
                        ? 'bg-[#2b0505] text-[#ff9d9d] border-[#7a0000]'
                        : 'bg-[#0d0d1f] text-[#f2e8c9] border-[#2ee6ff] hover:bg-[#141433] hover:border-[#ffe600]'
                  }`}
                >
                  <span className="mr-1">{CATS[t.cat].emoji}</span>
                  {t.text}
                </motion.button>
              ))}
            </AnimatePresence>
            {phase === 'triage' && liveTickets.length === 0 && (
              <div className="w-full text-center font-crt text-xl text-[#6b6b7a] py-16">…it's quiet. Too quiet.</div>
            )}
          </div>

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
            {/* orchestrator connection line */}
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
                className={`relative z-10 border-4 px-3 py-2 min-w-[150px] bg-black shadow-[4px_4px_0_#000] ${
                  simStep === i
                    ? 'border-[#ffe600]'
                    : isBossMode
                      ? 'border-[#7a0000]'
                      : 'border-[#ff2e9a]'
                }`}
                style={simStep === i ? { boxShadow: '0 0 30px rgba(255,230,0,0.7), 4px 4px 0 #000' } : undefined}
              >
                <motion.div key={agentPulse[i] || 0} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-xl">
                  {c.emoji}
                </motion.div>
                <div className={`font-pixel text-[8px] leading-relaxed mt-1 ${simStep === i ? 'text-[#ffe600]' : 'text-[#2ee6ff]'}`}>{c.name}</div>
                <div className="font-crt text-base text-[#8b8ba0]">
                  {c.type === 'multiplier' || c.type === 'orchestrator' ? `×${c.value.toFixed(1)}` : `+${c.value}`}
                  {' · '}{c.cat === 'all' ? '⚡ all chaos' : `${CATS[c.cat].emoji} ${CATS[c.cat].label}`}
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
            className="fixed inset-0 z-40 bg-black/85 flex items-center justify-center px-6 crt"
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
              <p className="font-crt text-xl text-[#8b8ba0] mt-6">
                {round === 1 ? '► Click tickets to clear them. Good luck. You will need it.' : '► Your agents are watching the board.'}
              </p>
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
            className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center px-4 crt"
          >
            <div className="max-w-3xl w-full text-center">
              <motion.h2
                initial={{ y: -16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="font-pixel text-xl md:text-3xl text-[#f2e8c9] leading-snug"
                style={{ textShadow: '3px 3px 0 #ff2e9a, 6px 6px 0 #000' }}
              >
                {round === 1 ? 'UNLOCK AGENTFORCE.' : `DRAFT ${round}: REINFORCE THE STACK`}
              </motion.h2>
              <p className="font-crt text-xl text-[#8b8ba0] mt-3">
                {round === 1
                  ? `That was ${ROUND_CFG[1].tickets} tickets. You cleared ${manualClears}. It doubles from here. Draft an agent.`
                  : 'One pick. It fires every round from now on.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
                {draftOptions.map((c, i) => (
                  <motion.button
                    key={c.name}
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.12 * i, type: 'spring', stiffness: 260, damping: 20 }}
                    whileHover={{ y: -8 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => draftCard(c)}
                    className="group bg-black p-5 text-left border-4 border-[#2ee6ff] hover:border-[#ffe600] shadow-[6px_6px_0_#000] hover:shadow-[8px_8px_0_rgba(255,230,0,0.5)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-4xl bg-[#101024] border-2 border-[#2ee6ff]/40 px-3 py-2">{c.emoji}</span>
                      <span className="font-pixel text-[8px] bg-[#ff2e9a] text-black px-2 py-1 border-2 border-black">
                        {c.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-4 font-pixel text-[10px] text-[#2ee6ff] leading-relaxed">{c.name}</div>
                    <div className="mt-2 font-pixel text-xl text-[#3bff5e]" style={{ textShadow: '2px 2px 0 #000' }}>
                      {c.type === 'multiplier' || c.type === 'orchestrator' ? `×${c.value.toFixed(1)}` : `+${c.value}`}
                    </div>
                    <div className="mt-2 font-crt text-lg text-[#f2e8c9] leading-tight">{c.desc}</div>
                    <div className="mt-3 font-pixel text-[9px] text-[#3bff5e] opacity-0 group-hover:opacity-100">► DRAFT</div>
                  </motion.button>
                ))}
              </div>
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
            className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center px-4 crt"
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="bg-black border-4 border-[#2ee6ff] shadow-[8px_8px_0_rgba(255,46,154,0.55)] max-w-lg w-full p-7"
            >
              <div className="font-pixel text-[10px] text-[#ffe600]">■ ROUND {summary.round} DEBRIEF ■</div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                {[
                  ['CHAOS VOLUME', summary.volume, 'text-[#f2e8c9]'],
                  ['CLEARED BY YOU', summary.manual, 'text-[#2ee6ff]'],
                  ['CLEARED BY AGENTS', summary.auto, 'text-[#3bff5e]'],
                  ['ESCALATED', summary.esc, summary.esc > 3 ? 'text-[#ff2d2d]' : 'text-[#8b8ba0]'],
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
                  <div className="font-crt text-base text-[#8b8ba0]">Total impact</div>
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
            className="fixed inset-0 z-40 bg-black/95 flex items-center justify-center px-6 scanlines-red crt"
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
          {/* pixel confetti */}
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
            <div className="text-6xl">{role.emoji}</div>
            <div className="font-pixel text-[10px] text-[#3bff5e] mt-4 blink">★ QUARTER SURVIVED ★</div>
            <h2
              className="font-pixel text-xl md:text-3xl text-[#f2e8c9] mt-4 leading-snug"
              style={{ textShadow: '4px 4px 0 #3bff5e, 7px 7px 0 #000' }}
            >
              THE BUSINESS RUNS ITSELF NOW.
            </h2>
            <p className="font-crt text-2xl text-[#2ee6ff] mt-4 leading-tight">{role.victory}</p>

            <div className="mt-8 bg-black border-4 border-[#3bff5e] shadow-[8px_8px_0_#000] p-7">
              <div className="font-crt text-2xl text-[#2ee6ff]">
                ({role.base}
                {deck.filter((c) => c.type === 'additive' || c.type === 'trigger').map((c, i) => (
                  <span key={i}> + {c.value}</span>
                ))}
                )
                {deck.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator').map((c, i) => (
                  <span key={i}> × {c.value.toFixed(1)}</span>
                ))}
                {' = '}
                <span className="text-[#3bff5e] font-bold">{fmt(fullEngine.total)}</span>
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
                Five rounds. {12 + 20 + 32 + 50 + ROUND_CFG[5].tickets}+ chaos tickets. Your agents handled the flood while you drafted the system that beat it.
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
