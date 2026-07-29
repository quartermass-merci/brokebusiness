import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ============================================================
   WHO BROKE THE BUSINESS?
   A 5-round business-chaos roguelite.
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

  /* ---------- derived visuals ---------- */

  const isBossMode = phase === 'bossIntro' || phase === 'bossCrisis' || phase === 'simulate';
  const bgClass =
    phase === 'victory'
      ? 'bg-gradient-to-b from-sky-50 via-white to-emerald-50'
      : isBossMode
        ? 'bg-[#170606]'
        : round >= 4
          ? 'bg-sky-50'
          : round === 3
            ? 'bg-slate-100'
            : 'bg-slate-200';

  const scoreStage = phase === 'simulate' ? appliedCount : 0;
  const scoreColor =
    phase === 'victory'
      ? 'text-emerald-600'
      : scoreStage >= 4
        ? 'text-red-500'
        : scoreStage === 3
          ? 'text-amber-400'
          : isBossMode
            ? 'text-white'
            : 'text-blue-800';
  const scoreScale = phase === 'simulate' ? 1 + scoreStage * 0.16 : 1;

  const meterColor = meterPct > 66 ? 'bg-red-500' : meterPct > 33 ? 'bg-amber-400' : 'bg-emerald-500';

  const fullEngine = role ? engineOf(role.base, deck) : null;
  const finalScore = fullEngine ? fullEngine.total + manualScore : 0;
  const ghostMultiple = ghostScore > 0 ? Math.round(finalScore / Math.max(1, ghostScore)) : finalScore;

  /* ============================ RENDER ============================ */

  return (
    <div className={`min-h-screen w-full font-sans transition-colors duration-1000 ${bgClass} ${shakeCls} relative overflow-hidden ${isBossMode ? 'scanlines' : ''}`}>
      <style>{`
        @keyframes shakeSK { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-4px,2px)} 40%{transform:translate(4px,-2px)} 60%{transform:translate(-3px,-2px)} 80%{transform:translate(3px,2px)} }
        @keyframes shakeBK { 0%,100%{transform:translate(0,0)} 15%{transform:translate(-9px,5px) rotate(-.4deg)} 30%{transform:translate(9px,-5px) rotate(.4deg)} 45%{transform:translate(-7px,-4px)} 60%{transform:translate(7px,4px)} 75%{transform:translate(-4px,2px)} }
        .shake-s{animation:shakeSK .45s ease-in-out}
        .shake-b{animation:shakeBK .65s ease-in-out}
        @keyframes vibrate { 0%,100%{transform:translate(0)} 25%{transform:translate(1px,-1px)} 50%{transform:translate(-1px,1px)} 75%{transform:translate(1px,1px)} }
        .vibrate{animation:vibrate .12s linear infinite}
        .scanlines::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,60,60,.06) 0 2px,transparent 2px 4px);pointer-events:none;z-index:40;}
      `}</style>

      {/* ambient stress noise, rounds 1–2 */}
      {(phase === 'triage' || phase === 'waveIntro') && round <= 2 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
          {AMBIENT_NOISE.map((w, i) => (
            <span
              key={i}
              className="absolute text-slate-400 opacity-10 font-bold text-2xl"
              style={{ top: `${(i * 37) % 90}%`, left: `${(i * 53) % 85}%`, transform: `rotate(${(i * 23) % 40 - 20}deg)` }}
            >
              {w}
            </span>
          ))}
        </div>
      )}

      {/* ================= ROLE SELECT ================= */}
      {phase === 'roleSelect' && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs tracking-[0.3em] text-slate-500 font-semibold uppercase">A business simulator in 5 rounds</p>
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 mt-2">WHO BROKE THE BUSINESS?</h1>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl">
              The chaos doubles every round. You don't. Survive five waves, draft your Agentforce stack,
              and find out what happens when the humans stop drowning.
            </p>
            <p className="mt-2 text-sm text-slate-500 font-medium">Pick your seat at the table:</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {ROLES.map((r, i) => (
              <motion.button
                key={r.key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i }}
                whileHover={{ y: -8, scale: 1.03, rotateX: 4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => pickRole(r)}
                className="bg-white rounded-2xl border border-slate-200 shadow-md hover:shadow-xl p-6 text-left transition-shadow"
              >
                <div className="text-4xl">{r.emoji}</div>
                <div className="mt-3 font-bold text-slate-900 text-lg leading-tight">{r.name}</div>
                <div className="text-slate-500 text-sm mt-1">{r.tagline}</div>
                <div className="mt-4 text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Start the week →</div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ================= GAME HUD ================= */}
      {role && phase !== 'roleSelect' && phase !== 'victory' && (
        <div className="max-w-5xl mx-auto px-4 pt-4 relative z-10">
          <div className={`flex flex-wrap items-start justify-between gap-4 rounded-2xl px-5 py-4 ${isBossMode ? 'bg-black/40 border border-red-900' : 'bg-white/80 border border-slate-200'} backdrop-blur shadow-sm`}>
            <div>
              <div className={`text-[11px] font-semibold uppercase tracking-wider ${isBossMode ? 'text-red-400' : 'text-slate-500'}`}>
                {role.emoji} {role.name} · Round {round}/5
              </div>
              <motion.div
                animate={{ scale: scoreScale }}
                className={`font-black tabular-nums ${scoreColor} ${phase === 'simulate' && scoreStage >= 3 ? 'vibrate' : ''}`}
                style={{ fontSize: '2.6rem', lineHeight: 1.1, transformOrigin: 'left center' }}
              >
                {fmt(displayScore)}
              </motion.div>
              {/* GHOST LINE */}
              <div className="mt-1">
                <div className={`text-sm tabular-nums font-semibold ${ghostDead ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                  {fmt(displayGhost)}
                </div>
                <AnimatePresence mode="wait">
                  {ghostDead ? (
                    <motion.div
                      key="dead"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 0.3, 1, 0.3, 1] }}
                      transition={{ duration: 1.6 }}
                      className="text-[11px] text-red-400 font-semibold"
                    >
                      Manual Ops Inc. did not survive Q3.
                    </motion.div>
                  ) : (
                    <motion.div key="alive" className={`text-[11px] ${isBossMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Manual Ops Inc. (you, without agents)
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1 min-w-[240px]">
              {/* FORMULA BAR */}
              <div className={`text-[11px] font-semibold uppercase tracking-wider ${isBossMode ? 'text-slate-400' : 'text-slate-500'}`}>The formula</div>
              <div className={`mt-1 flex flex-wrap items-center gap-1 font-mono text-sm ${isBossMode ? 'text-slate-200' : 'text-slate-800'}`}>
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
                      className={firing ? 'text-amber-500 font-black' : applied ? 'font-bold' : ''}
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
                      className={firing ? 'text-red-500 font-black' : applied ? 'font-bold' : ''}
                    >
                      {' '}× {c.value.toFixed(1)}
                    </motion.span>
                  );
                })}
                <span> = </span>
                <span className={`font-black ${isBossMode ? 'text-amber-400' : 'text-blue-800'}`}>{fmt(engineOf(role.base, deck.slice(0, appliedCount)).total)}</span>
                {manualScore > 0 && <span className={`text-[11px] ${isBossMode ? 'text-slate-500' : 'text-slate-400'}`}>+ {manualScore} hustle</span>}
              </div>

              {/* CHAOS METER */}
              <div className="mt-3">
                <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider">
                  <span className={isBossMode ? 'text-red-400' : 'text-slate-500'}>Chaos</span>
                  <span className={meterPct > 66 ? 'text-red-500' : isBossMode ? 'text-slate-400' : 'text-slate-500'}>{meterPct}%</span>
                </div>
                <div className={`h-3 rounded-full overflow-hidden mt-1 ${isBossMode ? 'bg-red-950' : 'bg-slate-200'}`}>
                  <motion.div
                    animate={{ width: `${meterPct}%` }}
                    transition={{ type: 'tween', duration: meterOverride === 0 ? 1.4 : 0.4, ease: 'easeOut' }}
                    className={`h-full ${meterColor} ${meterPct > 80 ? 'animate-pulse' : ''}`}
                  />
                </div>
              </div>
            </div>

            {phase === 'triage' && (
              <div className={`text-center px-4 py-2 rounded-xl font-black text-2xl tabular-nums ${timeLeft <= 4 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-700'}`}>
                {timeLeft}s
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">triage</div>
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
              className="absolute left-1/2 -translate-x-1/2 top-0 z-30 bg-black text-red-400 text-sm font-bold px-4 py-2 rounded-xl border border-red-800 shadow-lg"
            >
              No human can triage this.
            </motion.div>
          )}
          <div className={`flex flex-wrap gap-2 content-start min-h-[280px] rounded-2xl p-4 ${isBossMode ? 'bg-black/30 border border-red-950' : 'bg-white/50 border border-slate-200'}`}>
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
                  className={`text-left rounded-lg px-2.5 py-1.5 border shadow-sm select-none cursor-pointer ${round === 5 ? 'text-[9px] max-w-[150px]' : 'text-[11px] max-w-[210px]'} leading-tight font-medium ${
                    t.escalated
                      ? 'bg-red-500 text-white border-red-600'
                      : isBossMode
                        ? 'bg-red-950/80 text-red-200 border-red-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:shadow-md'
                  }`}
                >
                  <span className="mr-1">{CATS[t.cat].emoji}</span>
                  {t.text}
                </motion.button>
              ))}
            </AnimatePresence>
            {phase === 'triage' && liveTickets.length === 0 && (
              <div className="w-full text-center text-slate-400 text-sm py-16">…it's quiet. Too quiet.</div>
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
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={runSimulate}
                    className="bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-2xl px-12 py-4 rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.5)] uppercase tracking-widest"
                  >
                    ▶ Simulate
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="mt-3 text-red-400 text-sm font-semibold">
                Target: <span className="text-amber-400 font-black text-lg tabular-nums">{fmt(bossTarget)}</span> — impossible by hand.
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
                className="absolute top-1/2 left-2 right-2 h-0.5 bg-gradient-to-r from-blue-400 via-amber-400 to-red-400 origin-left z-0"
              />
            )}
            {deck.map((c, i) => (
              <motion.div
                key={c.name + i}
                layout
                initial={{ scale: 0.6, y: 30, opacity: 0 }}
                animate={{
                  scale: simStep === i ? 1.12 : 1,
                  y: 0,
                  opacity: 1,
                  boxShadow: simStep === i ? '0 0 30px rgba(251,191,36,0.8)' : '0 1px 4px rgba(0,0,0,0.1)',
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`relative z-10 rounded-xl border px-3 py-2 min-w-[150px] ${
                  simStep === i
                    ? 'bg-amber-50 border-amber-400'
                    : isBossMode
                      ? 'bg-black/60 border-red-900 text-slate-200'
                      : 'bg-white border-slate-200'
                }`}
              >
                <motion.div key={agentPulse[i] || 0} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-xl">
                  {c.emoji}
                </motion.div>
                <div className={`text-[11px] font-bold leading-tight ${isBossMode && simStep !== i ? 'text-slate-200' : 'text-slate-800'}`}>{c.name}</div>
                <div className="text-[10px] text-slate-400 font-semibold">
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
            className="fixed inset-0 z-40 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center px-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="text-center max-w-xl"
            >
              <div className="inline-block bg-red-600 text-white text-xs font-black tracking-[0.25em] uppercase px-4 py-1.5 rounded-full">
                Round {round} · {ROUND_CFG[round].tickets} incoming
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mt-4">{role.waves[round - 1][0]}</h2>
              <p className="text-slate-300 text-lg mt-3">{role.waves[round - 1][1]}</p>
              <p className="text-slate-500 text-sm mt-5 font-semibold">
                {round === 1 ? 'Click tickets to clear them. Good luck. You will need it.' : 'Your agents are watching the board.'}
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
            className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur flex items-center justify-center px-4"
          >
            <div className="max-w-3xl w-full text-center">
              <motion.h2 initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl md:text-4xl font-black text-white">
                {round === 1 ? 'Unlock Agentforce.' : `Draft ${round}: reinforce the stack.`}
              </motion.h2>
              <p className="text-slate-400 mt-2 text-sm">
                {round === 1
                  ? `That was ${ROUND_CFG[1].tickets} tickets. You cleared ${manualClears}. It doubles from here. Draft an agent.`
                  : 'One pick. It fires every round from now on.'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                {draftOptions.map((c, i) => (
                  <motion.button
                    key={c.name}
                    initial={{ y: 60, opacity: 0, rotate: i === 0 ? -3 : i === 2 ? 3 : 0 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    transition={{ delay: 0.12 * i, type: 'spring', stiffness: 260, damping: 20 }}
                    whileHover={{ y: -12, scale: 1.05, rotateX: 6, boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => draftCard(c)}
                    className="bg-gradient-to-b from-white to-slate-100 rounded-2xl p-5 text-left border-2 border-slate-300 hover:border-amber-400 shadow-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-4xl">{c.emoji}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-blue-700 text-white px-2 py-0.5 rounded-full">
                        {c.type}
                      </span>
                    </div>
                    <div className="mt-3 font-black text-slate-900 leading-tight">{c.name}</div>
                    <div className="mt-1 text-2xl font-black text-blue-700">
                      {c.type === 'multiplier' || c.type === 'orchestrator' ? `×${c.value.toFixed(1)}` : `+${c.value}`}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 leading-snug">{c.desc}</div>
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
            className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 0.85, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8"
            >
              <div className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Round {summary.round} debrief</div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                {[
                  ['Chaos volume', summary.volume, 'text-slate-900'],
                  ['Cleared by you', summary.manual, 'text-blue-700'],
                  ['Cleared by agents', summary.auto, 'text-emerald-600'],
                  ['Escalated', summary.esc, summary.esc > 3 ? 'text-red-500' : 'text-slate-500'],
                ].map(([label, val, color]) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <div className={`text-2xl font-black tabular-nums ${color}`}>{val}</div>
                    <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-baseline gap-4">
                <div>
                  <div className="text-3xl font-black text-blue-800 tabular-nums">{fmt(summary.score)}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">Total impact</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-400 tabular-nums">{fmt(ghostScore)}</div>
                  <div className="text-[11px] text-slate-400">Manual Ops Inc.</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-700 font-medium bg-amber-50 border border-amber-200 rounded-xl p-3">
                {summaryLine(summary)}
              </p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={nextFromSummary}
                className={`mt-6 w-full py-3 rounded-xl font-black text-white ${round >= 4 ? 'bg-red-600' : 'bg-blue-700'}`}
              >
                {round >= 4 ? '⚠ Enter the Final Round' : `Brace for Round ${round + 1} →`}
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
            className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center px-6 scanlines"
          >
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="text-center max-w-xl">
              <motion.div
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 0.9 }}
                className="inline-block bg-red-600 text-white text-xs font-black tracking-[0.3em] uppercase px-4 py-1.5 rounded-full"
              >
                Final round · The Engine Break
              </motion.div>
              <h2 className="text-4xl md:text-5xl font-black text-red-500 mt-4">{role.waves[4][0]}</h2>
              <p className="text-slate-300 text-lg mt-3">{role.waves[4][1]}</p>
              <div className="mt-6 bg-red-950/60 border border-red-800 rounded-2xl p-4">
                <div className="text-[11px] text-red-400 font-black uppercase tracking-widest">Target to survive the quarter</div>
                <div className="text-5xl font-black text-amber-400 tabular-nums mt-1">{fmt(bossTarget)}</div>
                <div className="text-slate-400 text-sm mt-2">
                  100+ tickets incoming. Manual triage disabled. <span className="text-red-400 font-semibold">No human can triage this.</span>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={startBossCrisis}
                className="mt-6 bg-red-600 text-white font-black px-10 py-3 rounded-xl uppercase tracking-widest"
              >
                Face it
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= VICTORY ================= */}
      {phase === 'victory' && role && (
        <div className="max-w-3xl mx-auto px-6 py-12 relative z-10">
          {/* confetti */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: '-10vh', x: `${(i * 71) % 100}vw`, rotate: 0, opacity: 1 }}
                animate={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 720, opacity: [1, 1, 0.6] }}
                transition={{ duration: 2.6 + (i % 10) * 0.25, delay: (i % 7) * 0.12, ease: 'easeIn' }}
                className="absolute w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'][i % 5] }}
              />
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="text-6xl">{role.emoji}</div>
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-600 mt-3">Quarter survived</div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mt-2">The business runs itself now.</h2>
            <p className="text-slate-600 mt-3 text-lg">{role.victory}</p>

            <div className="mt-8 bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
              <div className="font-mono text-lg text-slate-800">
                ({role.base}
                {deck.filter((c) => c.type === 'additive' || c.type === 'trigger').map((c, i) => (
                  <span key={i}> + {c.value}</span>
                ))}
                )
                {deck.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator').map((c, i) => (
                  <span key={i}> × {c.value.toFixed(1)}</span>
                ))}
                {' = '}
                <span className="font-black text-emerald-600">{fmt(fullEngine.total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-6 mt-6">
                <div>
                  <div className="text-4xl font-black text-blue-800 tabular-nums">{fmt(finalScore)}</div>
                  <div className="text-xs text-slate-500 font-semibold mt-1">You, with the stack</div>
                </div>
                <div>
                  <div className="text-4xl font-black text-slate-300 tabular-nums line-through">{fmt(ghostScore)}</div>
                  <div className="text-xs text-slate-400 font-semibold mt-1">Manual Ops Inc. (did not survive Q3)</div>
                </div>
              </div>
              <p className="mt-6 text-slate-800 font-bold text-lg">
                You: {fmt(finalScore)}. Manual: {fmt(ghostScore)}. That's{' '}
                <span className="text-emerald-600 text-2xl font-black">{ghostMultiple}×</span> — and the chaos never slowed down.
              </p>
              <div className="mt-4 text-sm text-slate-500">
                Five rounds. {12 + 20 + 32 + 50 + ROUND_CFG[5].tickets}+ chaos tickets. Your agents handled the flood while you drafted the system that beat it.
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={replay}
              className="mt-8 bg-blue-700 text-white font-black px-10 py-4 rounded-2xl text-lg shadow-lg"
            >
              ↻ Run it back as a different exec
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
