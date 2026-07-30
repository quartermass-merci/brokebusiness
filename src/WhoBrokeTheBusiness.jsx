import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import menuArt from './art/menu.jpg';
import agentBgArt from './art/agent-bg.jpg';
import robotArt from './art/robot.png';
import {
  CATS, ROUND_CFG, GHOST_DECAY, DEGRADED_FACTOR, DMG, HANDLE_TIME_COST,
  FIX_DATA, DECOYS, WITHHELD_CARD, ROLES, AMBIENT_NOISE, RECOVERY,
  MAX_DUPES_PER_ROUND, DEGRADED_MISFIRE_RATE,
} from './gameData';

/* ============================================================
   WHO BROKE THE BUSINESS?
   Slow-burn escalation (Tetris/Papers Please ramp) × judgment
   calls with consequences × earned Agentforce deployments.
   ============================================================ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const ACTIONS = ['handle', 'route', 'escalate'];
const ACT_COLOR = {
  handle: { text: 'text-[#f2e8c9]', border: 'border-[#8b8ba0]' },
  route: { text: 'text-[#2ee6ff]', border: 'border-[#2ee6ff]' },
  escalate: { text: 'text-[#ff2d2d]', border: 'border-[#ff2d2d]' },
};
const POINTS = { handle: 15, route: 15, escalate: 20 };

/* Role headshots: src/avatars/<roleKey>.png, emoji fallback */
const AVATARS = Object.fromEntries(
  Object.entries(import.meta.glob('./avatars/*.png', { eager: true, import: 'default', query: '?url' }))
    .map(([p, url]) => [p.split('/').pop().replace('.png', ''), url])
);
ROLES.forEach((r) => { r.img = AVATARS[r.key] || null; });

/* ---------- scoring engine (status-aware) ---------- */
function effAdd(c) {
  if (c.type !== 'additive' && c.type !== 'trigger') return 0;
  if (c.status === 'online') return c.value;
  if (c.status === 'degraded') return Math.round(c.value * DEGRADED_FACTOR);
  return 0;
}
function effMult(c) {
  if (c.type !== 'multiplier' && c.type !== 'orchestrator') return 1;
  if (c.status === 'online') return c.value;
  if (c.status === 'degraded') return 1 + (c.value - 1) * DEGRADED_FACTOR;
  return 1;
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
    if (from === target) return undefined;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / 650);
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3));
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
  // title | roleSelect | brief | waveIntro | triage | draft | resolution
  // summary | bossIntro | bossCrisis | simulate | victory | defeat
  const [howTo, setHowTo] = useState(false);

  const [deck, setDeck] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [manualScore, setManualScore] = useState(0);
  const [ghostScore, setGhostScore] = useState(0);
  const [dataClean, setDataClean] = useState(false);

  const [stability, setStability] = useState(100);
  const [correctCalls, setCorrectCalls] = useState(0);
  const [escLeft, setEscLeft] = useState(2);
  const [carried, setCarried] = useState(0);

  const [appliedCount, setAppliedCount] = useState(0);
  const [simStep, setSimStep] = useState(-1);
  const [simNote, setSimNote] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [draftOptions, setDraftOptions] = useState([]);
  const [earned, setEarned] = useState(true);
  const [summary, setSummary] = useState(null);
  const [shakeCls, setShakeCls] = useState('');
  const [meterOverride, setMeterOverride] = useState(null);
  const [ghostDead, setGhostDead] = useState(false);
  const [bossReady, setBossReady] = useState(false);
  const [bossTarget, setBossTarget] = useState(0);
  const [noHuman, setNoHuman] = useState(false);
  const [agentPulse, setAgentPulse] = useState({});
  const [autoClears, setAutoClears] = useState(0);
  const [verdict, setVerdict] = useState(null); // {ok, action, text}
  const [defeatReason, setDefeatReason] = useState('');

  const idRef = useRef(0);
  const ticketsRef = useRef([]);
  const deckRef = useRef([]);
  const selectedRef = useRef(null);
  const stabilityRef = useRef(100);
  const manualScoreRef = useRef(0);
  const dataCleanRef = useRef(false);
  const decidedRef = useRef(0);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const ignoredRef = useRef(0);
  const dupRef = useRef(0);
  const acRef = useRef(0);
  const r1DecidedRef = useRef(0);
  const phaseRef = useRef('title');
  const bagRef = useRef([]);

  useEffect(() => { ticketsRef.current = tickets; }, [tickets]);
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { stabilityRef.current = stability; }, [stability]);
  useEffect(() => { manualScoreRef.current = manualScore; }, [manualScore]);
  useEffect(() => { dataCleanRef.current = dataClean; }, [dataClean]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const cfg = ROUND_CFG[round];
  const engine = useMemo(
    () => engineOf(role ? role.base : 100, deck.slice(0, appliedCount)),
    [role, deck, appliedCount]
  );
  const displayScore = useAnimatedNumber(engine.total + manualScore);
  const displayGhost = useAnimatedNumber(Math.round(ghostScore));
  const displayStability = useAnimatedNumber(stability);

  const liveTickets = tickets.filter((t) => !t.fate);
  const escalatedCount = liveTickets.filter((t) => t.escalated).length;
  const isBossMode = phase === 'bossIntro' || phase === 'bossCrisis' || phase === 'simulate';

  const chaosPct =
    meterOverride !== null
      ? meterOverride
      : isBossMode
        ? 100
        : phase === 'victory'
          ? 0
          : Math.min(100, Math.round(((liveTickets.length + escalatedCount) / Math.max(4, cfg ? cfg.tickets * 0.6 : 5)) * 100));

  const doShake = useCallback((cls) => {
    if (!cls) return;
    setShakeCls('');
    requestAnimationFrame(() => setShakeCls(cls));
    setTimeout(() => setShakeCls(''), 700);
  }, []);

  /* ---------- blind spot / perk helpers ---------- */

  // an online agent covering a category gives you context your seat lacks
  const coveredCats = useCallback(() => {
    const cats = new Set();
    deckRef.current.forEach((c) => {
      if (c.type === 'data' || c.status === 'integrating') return;
      if (c.cat === 'all') { Object.keys(CATS).forEach((k) => cats.add(k)); }
      else cats.add(c.cat);
    });
    return cats;
  }, []);

  const blindResolved = useMemo(() => {
    if (!role) return false;
    const cats = new Set();
    deck.forEach((c) => {
      if (c.type === 'data' || c.status === 'integrating') return;
      if (c.cat === 'all') Object.keys(CATS).forEach((k) => cats.add(k));
      else cats.add(c.cat);
    });
    return cats.has(role.blind.cat);
  }, [role, deck]);

  const isBlind = (t) => role && t.cat === role.blind.cat && !blindResolved;
  const hasPerk = (t) => role && t.cat === role.perk.cat;

  /* ---------- stability ---------- */

  const damage = useCallback((amount, reason) => {
    setStability((s) => {
      const next = Math.max(0, s - amount);
      stabilityRef.current = next;
      if (next === 0 && phaseRef.current !== 'defeat') {
        setDefeatReason(reason);
        setPhase('defeat');
      }
      return next;
    });
  }, []);

  /* ---------- tickets ---------- */

  const spawnTicket = useCallback((r, opts = {}) => {
    const id = ++idRef.current;
    let base = opts.template;
    if (!base) {
      // shuffle-bag draw so the same problem doesn't repeat back-to-back
      if (!bagRef.current.length) bagRef.current = shuffle(r.tickets);
      base = bagRef.current.shift();
    }
    setTickets((ts) => [...ts, {
      id,
      ...base,
      escalated: !!opts.escalated,
      backlog: !!opts.backlog,
      bounced: false,
      spawnedAt: performance.now() - (opts.aged || 0),
      fate: null,
      counted: false,
    }]);
  }, []);

  const spawnDuplicate = useCallback((r) => {
    if (dupRef.current >= MAX_DUPES_PER_ROUND) return;
    dupRef.current += 1;
    spawnTicket(r, {
      escalated: true,
      template: {
        text: 'Duplicate record created by an agent running on dirty data',
        cat: 'data',
        right: 'route',
        ctx: 'Your degraded agent wrote a conflicting record. This is the cost of AI on bad data.',
        out: {
          handle: 'You merge it by hand. The agent makes another one tomorrow.',
          route: 'Data ops merges it and logs the pattern. Correct — but the real fix is Data 360.',
          escalate: 'You escalate a duplicate record. Capital spent on a symptom.',
        },
      },
    });
    damage(DMG.duplicate, 'Your agents kept writing bad records into a broken data layer.');
  }, [spawnTicket, damage]);

  const removeTickets = useCallback((ids, fate) => {
    if (!ids.length) return;
    const set = new Set(ids);
    setTickets((ts) => ts.map((t) => (set.has(t.id) ? { ...t, fate } : t)));
    setTimeout(() => setTickets((ts) => ts.filter((t) => !set.has(t.id))), 420);
  }, []);

  const clickTicket = (t) => {
    if (isBossMode) {
      setNoHuman(true);
      setTimeout(() => setNoHuman(false), 1500);
      doShake('shake-s');
      return;
    }
    if (phase !== 'triage' || t.fate) return;
    setSelected(selected === t.id ? null : t.id);
  };

  /* ---------- THE DECISION ---------- */

  const decide = (t, action) => {
    if (phase !== 'triage' || t.fate) return;
    setSelected(null);
    const ok = action === t.right;
    const outcome = t.out[action];
    // escalating past your capital is allowed — it just costs you
    const overspend = action === 'escalate' && escLeft <= 0 ? DMG.overspend : 0;

    if (action === 'escalate') setEscLeft((n) => Math.max(0, n - 1));
    if (overspend) damage(overspend, 'You kept escalating past the political capital you had.');
    if (action === 'handle') setTimeLeft((s) => Math.max(1, s - HANDLE_TIME_COST));

    decidedRef.current += 1;
    if (round === 1) r1DecidedRef.current += 1;

    if (ok) {
      correctRef.current += 1;
      setCorrectCalls((c) => c + 1);
      const pts = POINTS[action];
      setManualScore((s) => s + pts);
      setGhostScore((g) => g + pts * GHOST_DECAY[round]);
      removeTickets([t.id], 'manual');
      if (!overspend) setStability((s) => Math.min(100, s + 2)); // good calls buy a little back
    } else {
      wrongRef.current += 1;
      // the call is made and the consequence lands — it does not come back for another swing
      setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, escalated: true, bounced: true } : x)));
      setTimeout(() => removeTickets([t.id], 'wrong'), 900);
      damage(DMG.wrong + overspend, `You misjudged: "${t.text}"`);
      doShake('shake-s');
    }
    setVerdict({ ok, action, text: outcome, overspend });
    setTimeout(() => setVerdict(null), 3000);
  };

  const delegate = (t) => {
    const agent = deckRef.current.find(
      (c) => c.type !== 'data' && c.status !== 'integrating' && (c.cat === 'all' || c.cat === t.cat)
    );
    if (!agent || phase !== 'triage' || t.fate) return;
    setSelected(null);
    if (agent.status === 'online' || Math.random() < 0.55) {
      removeTickets([t.id], 'agent');
      acRef.current += 1;
      setAutoClears((n) => n + 1);
      correctRef.current += 1;
      setCorrectCalls((c) => c + 1);
      setManualScore((s) => s + 10);
      if (agent.status === 'degraded') spawnDuplicate(role);
      setVerdict({
        ok: agent.status === 'online',
        action: 'delegate',
        text: agent.status === 'online'
          ? `${agent.name} resolved it end-to-end and logged the reason. This is what deflection looks like.`
          : `${agent.name} closed it — but on dirty data it also wrote a duplicate record.`,
      });
    } else {
      spawnDuplicate(role);
      setTickets((ts) => ts.map((x) => (x.id === t.id ? { ...x, escalated: true, bounced: true } : x)));
      setVerdict({ ok: false, action: 'delegate', text: `${agent.name} MISFIRED. It cannot resolve what the data cannot tell it.` });
      doShake('shake-s');
    }
    setTimeout(() => setVerdict(null), 3000);
  };

  useEffect(() => {
    if (selected !== null && !tickets.some((t) => t.id === selected && !t.fate)) setSelected(null);
  }, [tickets, selected]);

  /* ---------- round lifecycle ---------- */

  const startRound = useCallback((r, carryTickets = []) => {
    bagRef.current = [];
    decidedRef.current = 0; correctRef.current = 0; wrongRef.current = 0;
    ignoredRef.current = 0; dupRef.current = 0; acRef.current = 0;
    setCorrectCalls(0); setAutoClears(0);
    setSelected(null); setSummary(null); setSimStep(-1); setSimNote('');
    setVerdict(null); setMeterOverride(null);
    setEscLeft(ROUND_CFG[r].escBud);
    setRound(r);
    if (r > 1) {
      setStability((s) => {
        const next = Math.min(100, s + RECOVERY);
        stabilityRef.current = next;
        return next;
      });
    }
    setCarried(carryTickets.length);

    // backlog from last round arrives already hot — your mess compounds
    idRef.current += 1;
    setTickets(carryTickets.map((t, i) => ({
      ...t,
      id: idRef.current + i + 1,
      escalated: true,
      backlog: true,
      bounced: false,
      fate: null,
      counted: false,
      spawnedAt: performance.now(),
    })));
    idRef.current += carryTickets.length + 1;

    const fixed = deckRef.current.some((c) => c.type === 'data' && c.draftedRound < r);
    setDataClean(fixed);
    dataCleanRef.current = fixed;
    setDeck((d) => {
      const next = d.map((c) => (c.draftedRound < r
        ? { ...c, status: c.type === 'data' ? 'online' : fixed ? 'online' : 'degraded' }
        : c));
      deckRef.current = next;
      return next;
    });
    setPhase(r === 5 ? 'bossIntro' : 'waveIntro');
  }, []);

  const pickRole = (r) => { setRole(r); setPhase('brief'); };

  useEffect(() => {
    if (phase !== 'waveIntro') return undefined;
    const t = setTimeout(() => {
      setTimeLeft(ROUND_CFG[round].triageSec);
      setPhase('triage');
    }, 3400);
    return () => clearTimeout(t);
  }, [phase, round]);

  // TRIAGE: spawner, clock, escalation, agent work
  useEffect(() => {
    if (phase !== 'triage' || !role) return undefined;
    const c = ROUND_CFG[round];
    let spawned = 0;

    // gentle opening: first ticket lands immediately, then paced
    const firstDelay = 600;
    const spawnFirst = setTimeout(() => { spawned += 1; spawnTicket(role); }, firstDelay);
    const spawnInt = setInterval(() => {
      if (spawned >= c.tickets) { clearInterval(spawnInt); return; }
      spawned += 1;
      spawnTicket(role);
    }, c.spawnMs);

    const countInt = setInterval(() => setTimeLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);

    const escInt = setInterval(() => {
      const now = performance.now();
      // decide OUTSIDE the state updater: updaters can run more than once
      const due = ticketsRef.current
        .filter((t) => !t.escalated && !t.fate && now - t.spawnedAt > c.escalateMs)
        .map((t) => t.id);
      if (!due.length) return;
      const dueSet = new Set(due);
      setTickets((ts) => ts.map((t) => (dueSet.has(t.id) ? { ...t, escalated: true } : t)));
      ignoredRef.current += due.length;
      damage(DMG.ignored * due.length, 'Too many problems sat unattended while you worked one at a time.');
    }, 500);

    // agents work their category — slower than a human but tireless
    const agentInt = setInterval(() => {
      const agents = deckRef.current.filter((a) => a.type !== 'data' && a.status !== 'integrating');
      if (!agents.length) return;
      const toClear = [];
      const pulses = {};
      const now = performance.now();
      const pool = () => ticketsRef.current.filter(
        (t) => !t.fate && !toClear.includes(t.id) && t.id !== selectedRef.current && now - t.spawnedAt > 2500
      );
      agents.forEach((a, i) => {
        const match = pool().filter((t) => a.cat === 'all' || t.cat === a.cat);
        if (a.status === 'online') {
          const n = a.type === 'orchestrator' ? 3 : 2;
          match.slice(0, n).forEach((t) => { toClear.push(t.id); pulses[i] = (pulses[i] || 0) + 1; });
        } else if (Math.random() < DEGRADED_MISFIRE_RATE) {
          spawnDuplicate(role);
        } else if (Math.random() < 0.5 && match.length) {
          toClear.push(match[0].id);
          pulses[i] = (pulses[i] || 0) + 1;
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
    }, 1300);

    // deterministic round end
    const endTimeout = setTimeout(() => {
      setSelected(null);
      const met = correctRef.current >= c.quota;
      setEarned(met);
      const slot = round - 1;
      const fixTaken = deckRef.current.some((x) => x.type === 'data');
      let opts;
      if (!met) opts = [WITHHELD_CARD];
      else if (slot === 0) opts = shuffle([role.cards[0], ...DECOYS[0]]);
      else if (slot === 1) opts = [FIX_DATA, role.cards[1], DECOYS[1][0]];
      else if (slot === 2) opts = fixTaken ? [role.cards[2], ...DECOYS[2]] : [FIX_DATA, role.cards[2], DECOYS[2][0]];
      else opts = [role.cards[3], ...DECOYS[3]];
      setDraftOptions(opts);
      setPhase('draft');
    }, c.triageSec * 1000 + 900);

    return () => {
      clearTimeout(spawnFirst); clearInterval(spawnInt); clearInterval(countInt);
      clearInterval(escInt); clearInterval(agentInt); clearTimeout(endTimeout);
    };
  }, [phase, round, role, spawnTicket, removeTickets, spawnDuplicate, damage]);

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
    await sleep(450);
    const active = theDeck.filter((c) => c.status !== 'integrating' && c.type !== 'data');
    for (let i = 0; i < theDeck.length; i++) {
      const c = theDeck[i];
      setSimStep(i);
      if (c.status === 'integrating') {
        setSimNote(c.type === 'data'
          ? '🗄️ PROVISIONING DATA 360 — unifying records overnight…'
          : `${c.emoji} INTEGRATING — online next round. No miracles on day one.`);
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
      const remaining = ticketsRef.current.filter((t) => !t.fate);
      const share = Math.ceil(remaining.length / Math.max(1, active.length));
      const batch = remaining.slice(0, share).map((t) => t.id);
      if (batch.length) {
        removeTickets(batch, 'agent');
        acRef.current += batch.length;
        setAutoClears((v) => v + batch.length);
      }
      if (c.status === 'degraded') setSimNote(`${c.emoji} running at ${Math.round(DEGRADED_FACTOR * 100)}% — dirty data`);
      await sleep(320);
      setAppliedCount(i + 1);
      doShake(c.type === 'orchestrator' ? 'shake-b' : c.type === 'multiplier' ? 'shake-s' : '');
      await sleep(650);
      setSimNote('');
    }
    setSimStep(-1);
    await sleep(400);

    // whatever is still open becomes next round's backlog
    const leftovers = ticketsRef.current
      .filter((t) => !t.fate)
      .map(({ text, cat, right, ctx, out }) => ({ text, cat, right, ctx, out }));

    const eng = engineOf(role.base, theDeck);
    setSummary({
      round,
      volume: ROUND_CFG[round].tickets + carried,
      decided: decidedRef.current,
      correct: correctRef.current,
      wrong: wrongRef.current,
      ignored: ignoredRef.current,
      auto: acRef.current,
      dups: dupRef.current,
      quota: ROUND_CFG[round].quota,
      earned: correctRef.current >= ROUND_CFG[round].quota,
      clean: dataCleanRef.current,
      stability: stabilityRef.current,
      leftovers,
      score: eng.total + manualScoreRef.current,
    });
    setPhase('summary');
  };

  const summaryLine = (s) => {
    if (s.round === 1) {
      return s.earned
        ? `${s.correct} correct calls out of ${s.decided}. You earned your first Agentforce deployment — and this was the quiet week. Next week has ${ROUND_CFG[2].tickets} problems and less time.`
        : `Only ${s.correct} of the ${s.quota} correct calls needed. No budget for agents yet, and next week brings ${ROUND_CFG[2].tickets} problems.`;
    }
    if (s.round === 2) {
      return s.dups > 0
        ? `Your agent came online into a data swamp: ${Math.round(DEGRADED_FACTOR * 100)}% of advertised performance and ${s.dups} duplicate record${s.dups === 1 ? '' : 's'} created. AI on bad data is a power-up that doesn't power anything.`
        : `Chaos up ${Math.round((ROUND_CFG[2].tickets / ROUND_CFG[1].tickets - 1) * 100)}% since Round 1. Your agent absorbed ${s.auto}. Fix your data and it stops running at a quarter speed.`;
    }
    if (s.round === 3) {
      const r1 = Math.max(1, r1DecidedRef.current);
      const pct = Math.max(0, Math.round((1 - s.decided / r1) * 100));
      return s.clean
        ? `Data unified — your agents now perform as advertised. Chaos is ${Math.round(ROUND_CFG[3].tickets / ROUND_CFG[1].tickets * 100 - 100)}% higher than Round 1, and your personal decision load dropped ${pct}%.`
        : `Still running on swamp data: ${s.dups} more duplicates this round. The stack can't carry you until the data can.`;
    }
    return `${s.volume} problems. You judged ${s.decided}. The stack absorbed ${s.auto}. You spent this round managing a system instead of drowning in a queue.`;
  };

  const nextFromSummary = () => {
    const leftovers = summary ? summary.leftovers : [];
    if (round >= 4) {
      const fixed = deckRef.current.some((c) => c.type === 'data');
      const preview = deckRef.current.map((c) => ({
        ...c,
        status: c.type === 'data' ? 'online' : fixed ? 'online' : 'degraded',
      }));
      const eng = engineOf(role.base, preview);
      setBossTarget(Math.floor(((eng.total + manualScoreRef.current) * 0.93) / 10) * 10);
      startRound(5, []);
    } else {
      startRound(round + 1, leftovers);
    }
  };

  /* ---------- boss ---------- */

  const startBossCrisis = () => { setPhase('bossCrisis'); setBossReady(false); };

  useEffect(() => {
    if (phase !== 'bossCrisis' || !role) return undefined;
    const c = ROUND_CFG[5];
    let spawned = 0;
    const spawnInt = setInterval(() => {
      if (spawned >= c.tickets) { clearInterval(spawnInt); return; }
      spawned += 1;
      spawnTicket(role, { escalated: spawned % 3 === 0 });
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
      await sleep(280);
      if (c.type === 'data') {
        setSimNote('🗄️ DATA 360: RECORDS UNIFIED — FULL POWER UNLOCKED');
        setAppliedCount(i + 1);
        doShake('shake-s');
        await sleep(900);
        setSimNote('');
        continue;
      }
      const remaining = ticketsRef.current.filter((t) => !t.fate);
      const n = Math.ceil((remaining.length / Math.max(1, agents.length)) * 0.9);
      const batch = remaining.slice(0, n).map((t) => t.id);
      if (batch.length) {
        removeTickets(batch, 'agent');
        acRef.current += batch.length;
        setAutoClears((v) => v + batch.length);
      }
      await sleep(280);
      setAppliedCount(i + 1);
      doShake(c.type === 'orchestrator' ? 'shake-b' : 'shake-s');
      await sleep(860);
    }
    const rest = ticketsRef.current.filter((t) => !t.fate).map((t) => t.id);
    removeTickets(rest, 'agent');
    acRef.current += rest.length;
    setSimStep(-1);
    setSimNote('');
    await sleep(450);
    setGhostDead(true);
    setMeterOverride(0);
    await sleep(1600);
    setPhase('victory');
  };

  /* ---------- reset ---------- */

  const resetRun = (keepRole) => {
    setDeck([]); deckRef.current = [];
    setTickets([]); setSelected(null);
    setManualScore(0); manualScoreRef.current = 0;
    setGhostScore(0); setDataClean(false); dataCleanRef.current = false;
    setStability(100); stabilityRef.current = 100;
    setAppliedCount(0); setSimStep(-1); setSimNote('');
    setSummary(null); setMeterOverride(null); setGhostDead(false);
    setBossReady(false); setBossTarget(0); setAgentPulse({});
    setCarried(0); setEarned(true); setVerdict(null); setDefeatReason('');
    r1DecidedRef.current = 0;
    if (keepRole && role) { setRound(1); startRound(1, []); }
    else { setRole(null); setRound(1); setPhase('roleSelect'); }
  };

  /* ---------- visuals ---------- */

  const bgClass = phase === 'victory' ? 'bg-[#04301f]'
    : phase === 'defeat' ? 'bg-[#1a0303]'
      : isBossMode ? 'bg-[#1a0303]'
        : round >= 4 ? 'bg-[#0d1436]'
          : round === 3 ? 'bg-[#120d33]' : 'bg-[#160b2e]';

  const scoreStage = phase === 'simulate' ? appliedCount : 0;
  const scoreColor = phase === 'victory' ? 'text-[#3bff5e]'
    : scoreStage >= 4 ? 'text-[#ff2e9a]'
      : scoreStage === 3 ? 'text-[#ffe600]'
        : isBossMode ? 'text-[#ff5555]' : 'text-[#3bff5e]';

  const SEGS = 20;
  const chaosSegs = Math.round((chaosPct / 100) * SEGS);
  const chaosColor = chaosPct > 66 ? '#ff2d2d' : chaosPct > 33 ? '#ffe600' : '#3bff5e';
  const stabSegs = Math.round((stability / 100) * SEGS);
  const stabColor = stability > 60 ? '#3bff5e' : stability > 30 ? '#ffe600' : '#ff2d2d';

  const fullEngine = role ? engineOf(role.base, deck) : null;
  const finalScore = fullEngine ? fullEngine.total + manualScore : 0;
  const ghostMultiple = ghostScore > 0 ? Math.round(finalScore / Math.max(1, ghostScore)) : finalScore;

  const panelCls = isBossMode
    ? 'bg-black border-4 border-[#ff2d2d] shadow-[6px_6px_0_#000]'
    : 'bg-black border-4 border-[#2ee6ff] shadow-[6px_6px_0_rgba(255,46,154,0.55)]';

  const selectedTicket = tickets.find((t) => t.id === selected && !t.fate) || null;
  const delegateAgent = selectedTicket
    ? deck.find((c) => c.type !== 'data' && c.status !== 'integrating' && (c.cat === 'all' || c.cat === selectedTicket.cat))
    : null;

  const Avatar = ({ r, size }) => (r.img
    ? <img src={r.img} alt="" className="rounded-full object-cover" style={{ width: size, height: size, imageRendering: 'pixelated' }} draggable={false} />
    : <span style={{ fontSize: size * 0.72, lineHeight: 1 }}>{r.emoji}</span>);

  const Segs = ({ n, color, warn }) => (
    <div className={`flex gap-[3px] p-[3px] bg-[#0a0514] border-2 ${warn ? 'border-[#ff2d2d] blink' : 'border-[#2ee6ff]/40'}`}>
      {Array.from({ length: SEGS }).map((_, i) => (
        <motion.div key={i} animate={{ backgroundColor: i < n ? color : '#1a1130' }} transition={{ duration: 0.25 }} className="h-3 flex-1" />
      ))}
    </div>
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
        .scanlines-red::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,45,45,.05) 0 3px,transparent 3px 7px);pointer-events:none;z-index:60;}
        .btn-pixel{font-family:'Press Start 2P',monospace;text-transform:uppercase;border-width:4px;border-style:solid;box-shadow:4px 4px 0 #000;}
        .btn-pixel:hover{transform:translate(-1px,-1px);box-shadow:6px 6px 0 #000;}
        .btn-pixel:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000;}
        @media (prefers-reduced-motion: reduce){ .shake-s,.shake-b,.vibrate,.blink{animation:none} }
      `}</style>

      {/* ambient noise, early rounds only */}
      {(phase === 'triage' || phase === 'waveIntro') && round <= 2 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
          {AMBIENT_NOISE.map((w, i) => (
            <span key={i} className="absolute font-pixel text-[#ff2d2d] opacity-[0.07] text-sm"
              style={{ top: `${(i * 37) % 90}%`, left: `${(i * 53) % 85}%`, transform: `rotate(${(i * 23) % 40 - 20}deg)` }}>
              {w}
            </span>
          ))}
        </div>
      )}

      {/* ================= TITLE (full screen art) ================= */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-20 bg-black flex items-center justify-center overflow-hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="relative"
            style={{
              width: 'min(100vw, calc(100vh * 2752 / 1536))',
              height: 'min(100vh, calc(100vw * 1536 / 2752))',
            }}
          >
            <img src={menuArt} alt="Who Broke the Business?" className="absolute inset-0 w-full h-full object-fill select-none" draggable={false} />
            <motion.button
              aria-label="Start game"
              onClick={() => setPhase('roleSelect')}
              animate={{ boxShadow: ['0 0 0px rgba(59,255,94,0)', '0 0 26px rgba(59,255,94,0.8)', '0 0 0px rgba(59,255,94,0)'] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="absolute cursor-pointer border-2 border-transparent hover:border-[#3bff5e] bg-transparent"
              style={{ left: '36.5%', top: '54.5%', width: '27%', height: '12%' }}
            />
            <motion.button
              aria-label="How to play"
              onClick={() => setHowTo(true)}
              whileHover={{ scale: 1.04, boxShadow: '0 0 22px rgba(46,230,255,0.7)' }}
              whileTap={{ scale: 0.96 }}
              className="absolute cursor-pointer border-2 border-transparent hover:border-[#2ee6ff] bg-transparent"
              style={{ left: '36.5%', top: '68%', width: '27%', height: '10.5%' }}
            />
          </motion.div>

          <AnimatePresence>
            {howTo && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/93 flex items-center justify-center px-4 py-6 overflow-y-auto">
                <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }}
                  className="bg-black border-4 border-[#2ee6ff] shadow-[8px_8px_0_rgba(255,46,154,0.55)] max-w-xl w-full p-7">
                  <div className="font-pixel text-sm text-[#ffe600]">HOW TO PLAY</div>
                  <div className="mt-4 space-y-4 text-left">
                    {[
                      ['1. JUDGE EVERY PROBLEM', 'Click a problem to open the file. Read the evidence, then choose: do it yourself, route it to the team that owns it, or escalate. Each option costs something different. Wrong calls damage business stability.', '#f2e8c9'],
                      ['2. EARN YOUR AGENTS', 'Each round sets a target of correct calls. Hit it and the board funds an Agentforce deployment. Miss it and the budget is withheld — you fall further behind.', '#3bff5e'],
                      ['3. MIND YOUR BLIND SPOT', 'Every exec sees some things instantly and is blind to others. Problems in your blind spot arrive with the detail stripped out — until an agent covering that area comes online.', '#ff2e9a'],
                      ['4. FIX THE DATA', 'Agents deployed on messy data run at 25% and create new messes. Take the readiness step to unlock advertised performance.', '#ffb14a'],
                      ['5. SURVIVE THE ENGINE BREAK', 'Round 5 floods past human limits. Press SIMULATE and let the system you built prove itself.', '#2ee6ff'],
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
              <h1 className="font-pixel text-xl md:text-3xl text-[#2ee6ff]" style={{ textShadow: '3px 3px 0 #000' }}>PICK YOUR ROLE</h1>
            </div>
            <p className="font-crt text-2xl text-[#2ee6ff] mt-5 max-w-2xl mx-auto leading-tight">
              Every problem is a judgment call. Each seat has an instinct nobody else has — and a blind spot it can't see past.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {ROLES.map((r, i) => (
              <motion.button key={r.key}
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 * i }}
                whileHover={{ y: -6 }} whileTap={{ scale: 0.97 }} onClick={() => pickRole(r)}
                className="group bg-black border-4 border-[#2ee6ff] hover:border-[#ff2e9a] shadow-[6px_6px_0_#000] hover:shadow-[8px_8px_0_rgba(255,46,154,0.6)] p-5 text-left">
                <div className="flex justify-center bg-[#101024] border-2 border-[#2ee6ff]/40 py-3">
                  <Avatar r={r} size={88} />
                </div>
                <div className="mt-3 font-pixel text-[11px] text-[#2ee6ff] leading-relaxed">{r.name}</div>
                <div className="font-crt text-xl text-[#f2e8c9] mt-1 leading-tight">{r.tagline}</div>
                <div className="font-crt text-lg text-[#3bff5e] mt-2 leading-tight">✚ {r.perk.name}</div>
                <div className="font-crt text-lg text-[#ff5555] leading-tight">✖ {r.blind.name}</div>
                <div className="mt-3 font-pixel text-[9px] text-[#3bff5e] opacity-0 group-hover:opacity-100">► SELECT</div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ================= ROLE BRIEF (perk + blind spot) ================= */}
      {phase === 'brief' && role && (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-black border-4 border-[#2ee6ff] shadow-[8px_8px_0_rgba(255,46,154,0.55)] max-w-2xl w-full p-7">
            <div className="flex items-center gap-4">
              <div className="bg-[#101024] border-2 border-[#2ee6ff]/40 p-2"><Avatar r={role} size={80} /></div>
              <div>
                <div className="font-pixel text-sm text-[#2ee6ff] leading-relaxed">{role.name}</div>
                <div className="font-crt text-xl text-[#f2e8c9] mt-1">{role.tagline}</div>
                <div className="font-crt text-xl text-[#ffe600] mt-1">MISSION: {role.mission}</div>
              </div>
            </div>
            <div className="mt-5 border-2 border-[#3bff5e] bg-[#031a12] p-4">
              <div className="font-pixel text-[10px] text-[#3bff5e]">✚ YOUR EDGE: {role.perk.name}</div>
              <div className="font-crt text-xl text-[#f2e8c9] mt-2 leading-tight">{role.perk.desc}</div>
            </div>
            <div className="mt-3 border-2 border-[#ff2d2d] bg-[#1a0303] p-4">
              <div className="font-pixel text-[10px] text-[#ff5555]">✖ YOUR BLIND SPOT: {role.blind.name}</div>
              <div className="font-crt text-xl text-[#f2e8c9] mt-2 leading-tight">{role.blind.desc}</div>
              <div className="font-crt text-lg text-[#8b8ba0] mt-2 leading-tight">
                An agent covering that area will hand you the context you can't see. That's the point of the stack.
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => startRound(1, [])}
              className="btn-pixel mt-6 w-full py-4 text-xs bg-black text-[#3bff5e] border-[#3bff5e]">
              ► TAKE THE SEAT
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* ================= HUD ================= */}
      {role && !['title', 'roleSelect', 'brief', 'victory', 'defeat'].includes(phase) && (
        <div className="max-w-5xl mx-auto px-4 pt-4 relative z-10">
          <div className={`flex flex-wrap items-start justify-between gap-4 px-5 py-4 ${panelCls}`}>
            <div className="min-w-[190px]">
              <div className={`flex items-center gap-2 font-pixel text-[9px] ${isBossMode ? 'text-[#ff2d2d]' : 'text-[#ff2e9a]'}`}>
                <Avatar r={role} size={18} /> {role.name} · ROUND {round}/5
              </div>
              <motion.div animate={{ scale: phase === 'simulate' ? 1 + scoreStage * 0.14 : 1 }}
                className={`font-pixel tabular-nums ${scoreColor} ${phase === 'simulate' && scoreStage >= 3 ? 'vibrate' : ''}`}
                style={{ fontSize: '1.8rem', lineHeight: 1.3, transformOrigin: 'left center', textShadow: '3px 3px 0 #000' }}>
                {fmt(displayScore)}
              </motion.div>
              <div className="font-pixel text-[8px] text-[#8b8ba0]">{role.metric}</div>
              <div className="mt-2">
                <div className={`font-crt text-xl tabular-nums ${ghostDead ? 'text-[#6b6b7a] line-through' : 'text-[#8b8ba0]'}`}>{fmt(displayGhost)}</div>
                <AnimatePresence mode="wait">
                  {ghostDead ? (
                    <motion.div key="dead" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.3, 1, 0.3, 1] }} transition={{ duration: 1.6 }}
                      className="font-pixel text-[8px] text-[#ff2d2d]">MANUAL OPS INC. DID NOT SURVIVE Q3.</motion.div>
                  ) : (
                    <motion.div key="alive" className="font-crt text-base text-[#6b6b7a]">Manual Ops Inc. (you, without agents)</motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex-1 min-w-[260px]">
              {/* STABILITY — the thing you can lose */}
              <div className="flex justify-between font-pixel text-[9px]">
                <span className={stability <= 30 ? 'text-[#ff2d2d]' : 'text-[#3bff5e]'}>❤ BUSINESS STABILITY</span>
                <span className="text-[#8b8ba0] tabular-nums">{displayStability}%</span>
              </div>
              <div className="mt-1"><Segs n={stabSegs} color={stabColor} warn={stability <= 30} /></div>

              {/* CHAOS */}
              <div className="flex justify-between font-pixel text-[9px] mt-3">
                <span className={isBossMode ? 'text-[#ff2d2d]' : 'text-[#ff2e9a]'}>⚠ OPERATIONAL CHAOS</span>
                <span className={chaosPct > 66 ? 'text-[#ff2d2d]' : 'text-[#8b8ba0]'}>{chaosPct}%</span>
              </div>
              <div className="mt-1"><Segs n={chaosSegs} color={chaosColor} warn={chaosPct > 85} /></div>

              {/* FORMULA */}
              <div className={`mt-3 flex flex-wrap items-center gap-1 font-crt text-lg ${isBossMode ? 'text-[#f2e8c9]' : 'text-[#2ee6ff]'}`}>
                <span className="font-pixel text-[8px] text-[#ffe600] mr-1">FORMULA</span>
                <span>({role.base}</span>
                {deck.filter((c) => c.type === 'additive' || c.type === 'trigger').map((c, i) => {
                  const idx = deck.indexOf(c);
                  const applied = idx < appliedCount;
                  const firing = idx === simStep;
                  const label = c.status === 'integrating' ? `+${c.value}·SETUP`
                    : c.status === 'degraded' ? `+${Math.round(c.value * DEGRADED_FACTOR)}*` : `+${c.value}`;
                  return (
                    <motion.span key={c.name + i} initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: applied ? (c.status === 'integrating' ? 0.45 : 1) : 0.35, x: 0, scale: firing ? 1.25 : 1 }}
                      className={firing ? 'text-[#ffe600] font-bold' : c.status === 'degraded' ? 'text-[#ffb14a] font-bold' : applied ? 'font-bold' : ''}>
                      {' '}{label}
                    </motion.span>
                  );
                })}
                <span>)</span>
                {deck.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator').map((c, i) => {
                  const idx = deck.indexOf(c);
                  const applied = idx < appliedCount;
                  const firing = idx === simStep;
                  const label = c.status === 'integrating' ? `×${c.value.toFixed(1)}·SETUP`
                    : c.status === 'degraded' ? `×${effMult(c).toFixed(2)}*` : `×${c.value.toFixed(1)}`;
                  return (
                    <motion.span key={c.name + i} initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: applied ? (c.status === 'integrating' ? 0.45 : 1) : 0.35, x: 0, scale: firing ? 1.35 : 1 }}
                      className={firing ? 'text-[#ff2e9a] font-bold' : c.status === 'degraded' ? 'text-[#ffb14a] font-bold' : applied ? 'font-bold' : ''}>
                      {' '}{label}
                    </motion.span>
                  );
                })}
                <span> = </span>
                <span className="font-bold text-[#3bff5e]">{fmt(engineOf(role.base, deck.slice(0, appliedCount)).total)}</span>
                {manualScore > 0 && <span className="text-[#6b6b7a]">+ {manualScore} judgment</span>}
              </div>
              {!dataClean && deck.some((c) => c.type !== 'data' && c.status === 'degraded') && (
                <div className="font-crt text-base text-[#ffb14a]">* degraded by dirty data — Fix the Data to unlock advertised performance</div>
              )}
            </div>

            {/* round state column */}
            {phase === 'triage' && (
              <div className="flex flex-col gap-2 items-stretch min-w-[150px]">
                <div className={`text-center px-3 py-2 border-4 ${timeLeft <= 6 ? 'border-[#ff2d2d] bg-[#2b0505]' : 'border-[#ffe600] bg-[#151505]'}`}>
                  <span className={`font-pixel text-2xl tabular-nums ${timeLeft <= 6 ? 'text-[#ff2d2d] blink' : 'text-[#ffe600]'}`}>{timeLeft}</span>
                  <div className="font-pixel text-[8px] text-[#8b8ba0] mt-1">SECONDS LEFT</div>
                </div>
                <div className={`px-3 py-2 border-2 ${correctCalls >= cfg.quota ? 'border-[#3bff5e] bg-[#031a12]' : 'border-[#2ee6ff]/60 bg-[#0d0d1f]'}`}>
                  <div className="font-pixel text-[8px] text-[#8b8ba0]">DEPLOYMENT METER</div>
                  <div className={`font-pixel text-sm tabular-nums mt-1 ${correctCalls >= cfg.quota ? 'text-[#3bff5e]' : 'text-[#2ee6ff]'}`}>
                    {correctCalls}/{cfg.quota}
                  </div>
                  <div className="font-crt text-base text-[#8b8ba0] leading-none">
                    {correctCalls >= cfg.quota ? 'AGENT EARNED' : 'correct calls'}
                  </div>
                </div>
                <div className="px-3 py-2 border-2 border-[#ff2d2d]/60 bg-[#150505]">
                  <div className="font-pixel text-[8px] text-[#8b8ba0]">EXEC CAPITAL</div>
                  <div className="font-crt text-xl text-[#ff5555] leading-none mt-1">
                    {escLeft > 0 ? '★'.repeat(escLeft) : 'SPENT'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* verdict / feedback banner */}
      <AnimatePresence>
        {verdict && (
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed top-2 left-1/2 -translate-x-1/2 z-[60] max-w-lg w-[92%] px-4 py-3 border-4 shadow-[4px_4px_0_#000] ${
              verdict.ok ? 'bg-[#031a12] border-[#3bff5e]' : 'bg-[#1a0303] border-[#ff2d2d]'}`}>
            <div className={`font-pixel text-[10px] ${verdict.ok ? 'text-[#3bff5e]' : 'text-[#ff2d2d]'}`}>
              {verdict.ok ? '✓ GOOD CALL' : `✗ WRONG CALL  −${DMG.wrong} STABILITY`}
              {verdict.overspend ? `  ·  −${verdict.overspend} OVERDRAWN CAPITAL` : ''}
            </div>
            <div className="font-crt text-xl text-[#f2e8c9] leading-tight mt-1">{verdict.text}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= BOARD ================= */}
      {role && ['waveIntro', 'triage', 'draft', 'resolution', 'summary', 'bossCrisis', 'simulate'].includes(phase) && (
        <div className="max-w-5xl mx-auto px-4 py-4 relative z-10">
          {noHuman && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="absolute left-1/2 -translate-x-1/2 top-0 z-30 bg-black text-[#ff2d2d] font-pixel text-[10px] px-4 py-3 border-4 border-[#ff2d2d] shadow-[4px_4px_0_#000]">
              NO HUMAN CAN TRIAGE THIS.
            </motion.div>
          )}
          {simNote && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="absolute left-1/2 -translate-x-1/2 top-0 z-30 bg-black text-[#ffe600] font-crt text-xl px-4 py-2 border-4 border-[#ffe600] shadow-[4px_4px_0_#000] whitespace-nowrap">
              {simNote}
            </motion.div>
          )}

          <div className={`flex flex-wrap gap-2 content-start min-h-[210px] p-4 ${isBossMode ? 'bg-black/60 border-4 border-[#7a0000]' : 'bg-[#0a0514]/80 border-4 border-[#2ee6ff]/40'}`}>
            <AnimatePresence>
              {tickets.map((t) => {
                const blind = isBlind(t);
                const perk = hasPerk(t) && !isBossMode;
                return (
                  <motion.button key={t.id} layout data-kind={t.right} data-cat={t.cat}
                    initial={{ scale: 0, opacity: 0, y: -14 }}
                    animate={
                      t.fate === 'manual' ? { scale: [1, 1.35, 0], opacity: [1, 1, 0] }
                        : t.fate === 'wrong' ? { x: -40, opacity: 0, scale: 0.85 }
                        : t.fate === 'agent' ? { y: 170, x: (t.id % 7 - 3) * 26, scale: 0.2, opacity: 0, rotate: (t.id % 5 - 2) * 24 }
                          : { scale: selected === t.id ? 1.04 : 1, opacity: 1, y: 0, x: t.escalated ? [0, -2, 2, -2, 0] : 0 }
                    }
                    transition={t.fate ? { duration: 0.4 } : { type: 'spring', stiffness: 380, damping: 24, x: { repeat: t.escalated ? Infinity : 0, duration: 0.35 } }}
                    exit={{ opacity: 0, transition: { duration: 0.01 } }}
                    onClick={() => clickTicket(t)}
                    className={`text-left font-crt px-2 py-1.5 border-2 shadow-[3px_3px_0_#000] select-none cursor-pointer ${round === 5 ? 'text-base max-w-[150px]' : 'text-xl max-w-[250px]'} leading-none ${
                      t.escalated ? 'bg-[#ff2d2d] text-black border-[#7a0000]'
                        : isBossMode ? 'bg-[#2b0505] text-[#ff9d9d] border-[#7a0000]'
                          : selected === t.id ? 'bg-[#141433] text-[#f2e8c9] border-[#ffe600]'
                            : 'bg-[#0d0d1f] text-[#f2e8c9] border-[#2ee6ff] hover:bg-[#141433] hover:border-[#ffe600]'}`}>
                    {round !== 5 && (
                      <span className="block mb-1">
                        <span className={`font-pixel text-[7px] px-1 py-0.5 border ${t.escalated ? 'text-black border-black' : blind ? 'text-[#8b8ba0] border-[#8b8ba0]' : 'text-[#2ee6ff] border-[#2ee6ff]/70'}`}>
                          {blind ? '??? NO DETAIL' : `${CATS[t.cat].emoji} ${CATS[t.cat].label}`}
                        </span>
                        {t.backlog && <span className="font-pixel text-[7px] ml-1 px-1 py-0.5 border border-black text-black bg-[#ffb14a]">BACKLOG</span>}
                        {t.bounced && <span className="font-pixel text-[7px] ml-1 px-1 py-0.5 border border-black text-black">WORSE NOW</span>}
                        {perk && !t.escalated && <span className="font-pixel text-[7px] ml-1 px-1 py-0.5 border border-[#3bff5e] text-[#3bff5e]">✚ READ</span>}
                      </span>
                    )}
                    {t.text}
                  </motion.button>
                );
              })}
            </AnimatePresence>
            {phase === 'triage' && liveTickets.length === 0 && (
              <div className="w-full text-center font-crt text-xl text-[#6b6b7a] py-14">…quiet for now. It won't last.</div>
            )}
          </div>

          {/* ======= DECISION FILE ======= */}
          <AnimatePresence>
            {selectedTicket && phase === 'triage' && (
              <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 22 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                className="mt-3 bg-black border-4 border-[#ffe600] shadow-[6px_6px_0_#000] p-4" data-testid="inspector">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-pixel text-[8px] px-2 py-1 border-2 border-[#2ee6ff]/70 text-[#2ee6ff]">
                        {CATS[selectedTicket.cat].emoji} {CATS[selectedTicket.cat].label}
                      </span>
                      {hasPerk(selectedTicket) && (
                        <span className="font-pixel text-[8px] px-2 py-1 border-2 border-[#3bff5e] text-[#3bff5e]">✚ {role.perk.name}</span>
                      )}
                      {isBlind(selectedTicket) && (
                        <span className="font-pixel text-[8px] px-2 py-1 border-2 border-[#ff2d2d] text-[#ff5555]">✖ {role.blind.name}</span>
                      )}
                      {!isBlind(selectedTicket) && role.blind.cat === selectedTicket.cat && (
                        <span className="font-pixel text-[8px] px-2 py-1 border-2 border-[#3bff5e] text-[#3bff5e]">🤖 AGENT CONTEXT</span>
                      )}
                    </div>
                    <div className="font-crt text-2xl text-[#f2e8c9] mt-2 leading-tight">{selectedTicket.text}</div>
                    <div className="font-pixel text-[7px] text-[#8b8ba0] mt-3">WHAT YOU KNOW</div>
                    {isBlind(selectedTicket) ? (
                      <div className="font-crt text-xl text-[#ff9d9d] leading-tight">
                        ▓▓▓▓ detail unavailable from your seat ▓▓▓▓
                        <div className="text-[#8b8ba0] text-lg">Deploy an agent covering {CATS[role.blind.cat].emoji} {CATS[role.blind.cat].label} and it will hand you this context.</div>
                      </div>
                    ) : (
                      <div className="font-crt text-xl text-[#2ee6ff] leading-tight">{selectedTicket.ctx}</div>
                    )}
                    {hasPerk(selectedTicket) && (
                      <div className="font-crt text-lg text-[#3bff5e] mt-1 leading-tight">
                        ✚ Your instinct says this is a <span className="font-bold">{role.actions[selectedTicket.right].label}</span> call.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-[290px] flex-1">
                    {ACTIONS.map((a) => {
                      const overdrawn = a === 'escalate' && escLeft <= 0;
                      return (
                        <button key={a} onClick={() => decide(selectedTicket, a)}
                          className={`text-left border-2 px-3 py-2 ${overdrawn ? 'border-[#ffb14a] hover:bg-[#141433]' : `${ACT_COLOR[a].border} hover:bg-[#141433]`}`}>
                          <div className={`font-pixel text-[9px] ${overdrawn ? 'text-[#ffb14a]' : ACT_COLOR[a].text}`}>
                            {role.actions[a].label}{a === 'escalate' ? (overdrawn ? ' (OVERDRAWN)' : ` (${escLeft} left)`) : ''}
                          </div>
                          <div className="font-crt text-lg text-[#8b8ba0] leading-tight mt-0.5">
                            {overdrawn
                              ? `Out of capital — still the right move sometimes, but it costs ${DMG.overspend} stability.`
                              : role.actions[a].meaning}
                          </div>
                        </button>
                      );
                    })}
                    <button onClick={() => delegate(selectedTicket)} disabled={!delegateAgent}
                      className={`text-left border-2 px-3 py-2 ${delegateAgent ? (delegateAgent.status === 'degraded' ? 'border-[#ffb14a] hover:bg-[#141433]' : 'border-[#3bff5e] hover:bg-[#141433]') : 'border-[#3a3a4a] opacity-50 cursor-not-allowed'}`}>
                      <div className={`font-pixel text-[9px] ${delegateAgent ? (delegateAgent.status === 'degraded' ? 'text-[#ffb14a]' : 'text-[#3bff5e]') : 'text-[#3a3a4a]'}`}>
                        🤖 DELEGATE TO AGENT
                      </div>
                      <div className="font-crt text-lg text-[#8b8ba0] leading-tight mt-0.5">
                        {delegateAgent
                          ? `${delegateAgent.name}${delegateAgent.status === 'degraded' ? ' — degraded by dirty data, may misfire' : ' — resolves it end-to-end, costs you nothing'}`
                          : 'No agent covers this area yet. Earn one.'}
                      </div>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'bossCrisis' && (
            <div className="text-center mt-6">
              <AnimatePresence>
                {bossReady && (
                  <motion.button initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [1, 1.06, 1], opacity: 1 }}
                    transition={{ scale: { repeat: Infinity, duration: 1.2 } }} whileTap={{ scale: 0.95 }} onClick={runSimulate}
                    className="btn-pixel bg-black text-[#3bff5e] text-xl px-12 py-5 border-[#3bff5e]"
                    style={{ boxShadow: '0 0 30px rgba(59,255,94,0.5), 4px 4px 0 #000' }}>
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
      {role && deck.length > 0 && !['title', 'roleSelect', 'brief', 'victory', 'defeat'].includes(phase) && (
        <div className="max-w-5xl mx-auto px-4 pb-6 relative z-10">
          <div className="relative flex gap-3 flex-wrap items-stretch">
            {deck.some((c) => c.type === 'orchestrator') && appliedCount >= deck.length && (
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8 }}
                className="absolute top-1/2 left-2 right-2 h-1 origin-left z-0"
                style={{ background: 'repeating-linear-gradient(90deg,#2ee6ff 0 8px,#ff2e9a 8px 16px,#ffe600 16px 24px)' }} />
            )}
            {deck.map((c, i) => (
              <motion.div key={c.name + i} layout initial={{ scale: 0.6, y: 30, opacity: 0 }}
                animate={{ scale: simStep === i ? 1.12 : 1, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={`relative z-10 border-4 px-3 py-2 min-w-[160px] bg-black shadow-[4px_4px_0_#000] ${
                  simStep === i ? 'border-[#ffe600]' : isBossMode ? 'border-[#7a0000]' : c.type === 'data' ? 'border-[#3bff5e]' : 'border-[#ff2e9a]'}`}
                style={simStep === i ? { boxShadow: '0 0 30px rgba(255,230,0,0.7), 4px 4px 0 #000' } : undefined}>
                <div className="flex items-center justify-between">
                  <motion.span key={agentPulse[i] || 0} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-xl">{c.emoji}</motion.span>
                  <span className={`font-pixel text-[7px] px-1 py-0.5 border ${
                    c.status === 'online' ? 'text-[#3bff5e] border-[#3bff5e]'
                      : c.status === 'degraded' ? 'text-[#ffb14a] border-[#ffb14a]' : 'text-[#8b8ba0] border-[#8b8ba0] blink'}`}>
                    {c.status === 'integrating' ? 'SETUP' : c.status === 'degraded' ? 'DIRTY' : 'ONLINE'}
                  </span>
                </div>
                <div className={`font-pixel text-[8px] leading-relaxed mt-1 ${simStep === i ? 'text-[#ffe600]' : 'text-[#2ee6ff]'}`}>{c.name}</div>
                <div className="font-crt text-base text-[#8b8ba0]">
                  {c.type === 'data' ? '🗄️ readiness' : (c.type === 'multiplier' || c.type === 'orchestrator' ? `×${c.value.toFixed(1)}` : `+${c.value}`)}
                  {c.type !== 'data' && <>{' · '}{c.cat === 'all' ? '⚡ all' : `${CATS[c.cat].emoji} ${CATS[c.cat].label}`}</>}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ================= WAVE INTRO ================= */}
      <AnimatePresence>
        {phase === 'waveIntro' && role && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/88 flex items-center justify-center px-6">
            <motion.div initial={{ scale: 0.85, y: 24 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="text-center max-w-2xl">
              <div className="inline-block bg-[#ff2d2d] text-black font-pixel text-[10px] px-4 py-2 border-4 border-black shadow-[4px_4px_0_#7a0000]">
                ROUND {round} · {ROUND_CFG[round].tickets} PROBLEMS INCOMING{carried > 0 ? ` + ${carried} CARRIED OVER` : ''}
              </div>
              <h2 className="font-pixel text-2xl md:text-4xl text-[#ffe600] mt-6 leading-snug" style={{ textShadow: '4px 4px 0 #ff2e9a, 7px 7px 0 #000' }}>
                {role.waves[round - 1][0]}
              </h2>
              <p className="font-crt text-2xl text-[#2ee6ff] mt-4 leading-tight">{role.waves[round - 1][1]}</p>
              <div className="mt-5 inline-block border-2 border-[#3bff5e] bg-[#031a12] px-5 py-3">
                <div className="font-pixel text-[9px] text-[#3bff5e]">TO EARN THIS ROUND'S DEPLOYMENT</div>
                <div className="font-crt text-2xl text-[#f2e8c9] mt-1">
                  {ROUND_CFG[round].quota} correct calls · {ROUND_CFG[round].escBud} escalations of exec capital
                </div>
              </div>
              {round === 1 && (
                <p className="font-crt text-xl text-[#8b8ba0] mt-4 leading-tight">
                  Click a problem to open its file. Read the evidence, weigh the three costs, then decide.
                </p>
              )}
              {round > 1 && (
                <p className="font-crt text-xl text-[#3bff5e] mt-3">
                  Weekend recovery: +{RECOVERY} stability. Stability now {stability}%.
                </p>
              )}
              {carried > 0 && (
                <p className="font-crt text-xl text-[#ffb14a] mt-3">
                  {carried} unresolved problem{carried === 1 ? '' : 's'} carried over from last round — already hot.
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= DRAFT ================= */}
      <AnimatePresence>
        {phase === 'draft' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center px-4 overflow-y-auto py-6">
            <div className="absolute inset-0" style={{ backgroundImage: `url(${agentBgArt})`, backgroundSize: 'cover', backgroundPosition: 'center' }} aria-hidden />
            <div className="absolute inset-0 bg-black/88" aria-hidden />
            <div className="max-w-4xl w-full text-center relative">
              {earned ? (
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                  className="inline-block bg-[#031a12] border-4 border-[#2ee6ff] px-8 py-4"
                  style={{ boxShadow: '0 0 34px rgba(46,230,255,0.55), 0 0 70px rgba(59,255,94,0.25), 4px 4px 0 #000' }}>
                  <div className="flex items-center gap-4">
                    <img src={robotArt} alt="" className="h-16 border-2 border-[#2ee6ff]/40 select-none" draggable={false} />
                    <div className="text-left">
                      <motion.h2 animate={{ textShadow: ['0 0 8px #2ee6ff', '0 0 18px #3bff5e', '0 0 8px #2ee6ff'] }}
                        transition={{ repeat: Infinity, duration: 1.6 }} className="font-pixel text-xl md:text-3xl leading-snug" style={{ color: '#7dfcd0' }}>
                        AGENTFORCE{' '}<br />UNLOCKED
                      </motion.h2>
                      <div className="font-crt text-xl text-[#3bff5e] mt-1">
                        ✓ {correctCalls}/{cfg.quota} correct calls — the board funded your deployment.
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="inline-block bg-[#1a0303] border-4 border-[#ff2d2d] px-8 py-4 shadow-[4px_4px_0_#000]">
                  <h2 className="font-pixel text-lg md:text-2xl text-[#ff5555] leading-snug">BUDGET WITHHELD</h2>
                  <div className="font-crt text-xl text-[#f2e8c9] mt-2">
                    {correctCalls}/{cfg.quota} correct calls. The board won't fund an agent on this quarter's judgment.
                  </div>
                </motion.div>
              )}
              <p className="font-crt text-xl text-[#8b8ba0] mt-4">
                {earned
                  ? 'One deployment. It spends the next round integrating before it does anything — read the fine print.'
                  : 'You get a stopgap instead. Hit the target next round to unlock real capability.'}
              </p>
              <div className={`grid grid-cols-1 gap-5 mt-6 ${draftOptions.length > 1 ? 'md:grid-cols-3' : 'max-w-sm mx-auto'}`}>
                {draftOptions.map((c, i) => (
                  <motion.button key={c.name} initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.12 * i, type: 'spring', stiffness: 260, damping: 20 }}
                    whileHover={{ y: -8 }} whileTap={{ scale: 0.96 }} onClick={() => draftCard(c)}
                    className={`group bg-[#02100a] p-5 text-left border-4 flex flex-col ${c.type === 'data' ? 'border-[#3bff5e]' : 'border-[#2ee6ff]'}`}
                    style={{ boxShadow: c.type === 'data' ? '0 0 22px rgba(59,255,94,0.35), 4px 4px 0 #000' : '0 0 18px rgba(46,230,255,0.3), 4px 4px 0 #000' }}>
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
                      c.type === 'data' ? 'bg-[#3bff5e] text-black border-black group-hover:bg-[#7dfcd0]'
                        : 'bg-black text-[#3bff5e] border-[#3bff5e] group-hover:bg-[#3bff5e] group-hover:text-black'}`}>
                      ► {c.type === 'data' ? 'FIX THE DATA' : 'DEPLOY AGENT'}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= SUMMARY ================= */}
      <AnimatePresence>
        {phase === 'summary' && summary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/92 flex items-center justify-center px-4 py-6 overflow-y-auto">
            <motion.div initial={{ scale: 0.86, y: 26 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="bg-black border-4 border-[#2ee6ff] shadow-[8px_8px_0_rgba(255,46,154,0.55)] max-w-lg w-full p-7">
              <div className="font-pixel text-[10px] text-[#ffe600]">■ ROUND {summary.round} DEBRIEF ■</div>
              <div className="grid grid-cols-3 gap-3 mt-5">
                {[
                  ['PROBLEMS', summary.volume, 'text-[#f2e8c9]'],
                  ['GOOD CALLS', summary.correct, 'text-[#3bff5e]'],
                  ['MISJUDGED', summary.wrong, summary.wrong > 0 ? 'text-[#ff2d2d]' : 'text-[#8b8ba0]'],
                  ['BY AGENTS', summary.auto, 'text-[#2ee6ff]'],
                  ['LEFT TO ROT', summary.ignored, summary.ignored > 0 ? 'text-[#ffb14a]' : 'text-[#8b8ba0]'],
                  ['STABILITY', `${summary.stability}%`, summary.stability > 50 ? 'text-[#3bff5e]' : 'text-[#ff2d2d]'],
                ].map(([label, val, color]) => (
                  <div key={label} className="bg-[#0d0d1f] border-2 border-[#2ee6ff]/40 p-3">
                    <div className={`font-pixel text-base tabular-nums ${color}`}>{val}</div>
                    <div className="font-pixel text-[7px] text-[#8b8ba0] mt-2">{label}</div>
                  </div>
                ))}
              </div>

              <div className={`mt-4 border-2 p-3 ${summary.earned ? 'border-[#3bff5e] bg-[#031a12]' : 'border-[#ff2d2d] bg-[#1a0303]'}`}>
                <div className={`font-pixel text-[9px] ${summary.earned ? 'text-[#3bff5e]' : 'text-[#ff5555]'}`}>
                  {summary.earned ? `✓ DEPLOYMENT EARNED (${summary.correct}/${summary.quota})` : `✗ DEPLOYMENT WITHHELD (${summary.correct}/${summary.quota})`}
                </div>
              </div>

              <p className="mt-3 font-crt text-xl text-[#ffe600] leading-tight border-2 border-[#ffe600]/50 bg-[#151505] p-3">
                {summaryLine(summary)}
              </p>

              {round < 4 && (
                <div className="mt-3 font-crt text-lg text-[#8b8ba0] leading-tight">
                  <span className="text-[#ffb14a]">CARRYING INTO ROUND {round + 1}:</span> {summary.leftovers.length} unresolved problem{summary.leftovers.length === 1 ? '' : 's'}
                  {' · '}next round brings {ROUND_CFG[round + 1].tickets} more, faster.
                </div>
              )}

              <motion.button whileTap={{ scale: 0.97 }} onClick={nextFromSummary}
                className={`btn-pixel mt-6 w-full py-4 text-xs bg-black ${round >= 4 ? 'text-[#ff2d2d] border-[#ff2d2d]' : 'text-[#3bff5e] border-[#3bff5e]'}`}>
                {round >= 4 ? '⚠ ENTER THE FINAL ROUND' : `► BRACE FOR ROUND ${round + 1}`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= BOSS INTRO ================= */}
      <AnimatePresence>
        {phase === 'bossIntro' && role && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/95 flex items-center justify-center px-6 scanlines-red">
            <motion.div initial={{ scale: 0.85 }} animate={{ scale: 1 }} className="text-center max-w-2xl">
              <div className="inline-block bg-[#ff2d2d] text-black font-pixel text-[10px] px-4 py-2 border-4 border-black blink">
                FINAL ROUND · THE ENGINE BREAK
              </div>
              <h2 className="font-pixel text-2xl md:text-4xl text-[#ff2d2d] mt-6 leading-snug" style={{ textShadow: '4px 4px 0 #7a0000, 7px 7px 0 #000' }}>
                {role.waves[4][0]}
              </h2>
              <p className="font-crt text-2xl text-[#f2e8c9] mt-4 leading-tight">{role.waves[4][1]}</p>
              <div className="mt-6 bg-[#2b0505] border-4 border-[#ff2d2d] shadow-[6px_6px_0_#000] p-5">
                <div className="font-pixel text-[9px] text-[#ff5555]">TARGET TO SURVIVE THE QUARTER</div>
                <div className="font-pixel text-3xl text-[#ffe600] tabular-nums mt-3" style={{ textShadow: '3px 3px 0 #7a0000' }}>{fmt(bossTarget)}</div>
                <div className="font-crt text-xl text-[#8b8ba0] mt-3 leading-tight">
                  Every problem at once. Manual triage disabled. <span className="text-[#ff5555]">No human can triage this.</span>
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startBossCrisis}
                className="btn-pixel mt-6 bg-black text-[#ff2d2d] border-[#ff2d2d] text-sm px-10 py-4">► FACE IT</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= DEFEAT ================= */}
      {phase === 'defeat' && role && (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 relative z-10 scanlines-red">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-black border-4 border-[#ff2d2d] shadow-[8px_8px_0_#000] max-w-xl w-full p-7 text-center">
            <div className="text-5xl">💀</div>
            <h2 className="font-pixel text-xl md:text-3xl text-[#ff2d2d] mt-4 leading-snug" style={{ textShadow: '3px 3px 0 #7a0000' }}>
              THE BUSINESS BROKE
            </h2>
            <div className="font-crt text-2xl text-[#f2e8c9] mt-4 leading-tight">Stability hit zero in Round {round}.</div>
            <div className="mt-4 border-2 border-[#ff2d2d]/60 bg-[#150505] p-3">
              <div className="font-pixel text-[9px] text-[#ff5555]">WHAT BROKE IT</div>
              <div className="font-crt text-xl text-[#f2e8c9] mt-1 leading-tight">{defeatReason}</div>
            </div>
            <div className="font-crt text-xl text-[#8b8ba0] mt-4 leading-tight">
              You made {correctCalls} good calls this round and left {ROUND_CFG[round].quota} on the table.
              The chaos never slowed down — and one pair of hands was never going to be enough.
            </div>
            <div className="flex flex-col gap-3 mt-6">
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => resetRun(true)}
                className="btn-pixel py-4 text-xs bg-black text-[#3bff5e] border-[#3bff5e]">↻ RUN THE QUARTER AGAIN</motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => resetRun(false)}
                className="btn-pixel py-3 text-[10px] bg-black text-[#2ee6ff] border-[#2ee6ff]">PICK A DIFFERENT EXEC</motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ================= VICTORY ================= */}
      {phase === 'victory' && role && (
        <div className="max-w-3xl mx-auto px-6 py-10 relative z-10">
          <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
            {Array.from({ length: 50 }).map((_, i) => (
              <motion.div key={i} initial={{ y: '-10vh', x: `${(i * 71) % 100}vw`, rotate: 0, opacity: 1 }}
                animate={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 720, opacity: [1, 1, 0.6] }}
                transition={{ duration: 2.6 + (i % 10) * 0.25, delay: (i % 7) * 0.12, ease: 'easeIn' }}
                className="absolute w-2.5 h-2.5"
                style={{ backgroundColor: ['#2ee6ff', '#ffe600', '#3bff5e', '#ff2e9a', '#f2e8c9'][i % 5] }} />
            ))}
          </div>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="flex justify-center"><Avatar r={role} size={76} /></div>
            <div className="font-pixel text-[10px] text-[#3bff5e] mt-4 blink">★ QUARTER SURVIVED ★</div>
            <h2 className="font-pixel text-xl md:text-3xl text-[#f2e8c9] mt-4 leading-snug" style={{ textShadow: '4px 4px 0 #3bff5e, 7px 7px 0 #000' }}>
              THE BUSINESS RUNS ITSELF NOW.
            </h2>
            <p className="font-crt text-2xl text-[#2ee6ff] mt-4 leading-tight">{role.victory}</p>
            <p className="font-crt text-xl text-[#ffe600] mt-2 leading-tight">MISSION RESULT: {role.win}</p>

            <div className="mt-8 bg-black border-4 border-[#3bff5e] shadow-[8px_8px_0_#000] p-7">
              <div className="font-crt text-2xl text-[#2ee6ff]">
                ({role.base}
                {deck.filter((c) => c.type === 'additive' || c.type === 'trigger').map((c, i) => <span key={i}> + {effAdd(c)}</span>)}
                )
                {deck.filter((c) => c.type === 'multiplier' || c.type === 'orchestrator').map((c, i) => (
                  <span key={i}> × {effMult(c).toFixed(effMult(c) === c.value ? 1 : 2)}</span>
                ))}
                {' = '}<span className="text-[#3bff5e] font-bold">{fmt(fullEngine.total)}</span>
              </div>
              <div className={`font-pixel text-[8px] mt-2 ${dataClean ? 'text-[#3bff5e]' : 'text-[#ffb14a]'}`}>
                {dataClean ? 'DATA: UNIFIED — AGENTS AT ADVERTISED PERFORMANCE' : 'DATA: STILL A SWAMP — IMAGINE THIS RUN WITH CLEAN DATA'}
              </div>
              <div className="font-pixel text-[8px] text-[#2ee6ff] mt-2">
                BLIND SPOT ({role.blind.name}): {blindResolved ? 'COVERED BY YOUR AGENTS' : 'NEVER COVERED — YOU FLEW BLIND ALL QUARTER'}
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
                <span className="font-pixel text-xl text-[#ffe600]" style={{ textShadow: '2px 2px 0 #000' }}>{ghostMultiple}×</span> — and the chaos never slowed down.
              </p>
              <div className="mt-4 font-crt text-lg text-[#8b8ba0] leading-tight">
                Stability held at {stability}%. You judged the hard calls, earned every deployment, and built the system that beat the flood.
              </div>
            </div>

            <motion.button whileTap={{ scale: 0.96 }} onClick={() => resetRun(false)}
              className="btn-pixel mt-8 bg-black text-[#2ee6ff] border-[#2ee6ff] text-xs px-10 py-5">
              ↻ RUN IT BACK AS A DIFFERENT EXEC
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
