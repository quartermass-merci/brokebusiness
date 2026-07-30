import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import menuArt from './art/menu.jpg';
import agentBgArt from './art/agent-bg.jpg';
import robotArt from './art/robot.png';
import { TUNING, THEMES, ROLES, TICKET_POOL, DRAFT_POOL } from './gameData';

/* ============================================================
   WHO BROKE THE BUSINESS? — v7 roguelite cut

   The two pacings never share a screen:
   - Quarters are speed with zero reading (six-word headlines).
   - Drafts are untimed decisions between quarters.

   A run: 4 quarters × 40s → year-end audit. Losing is normal;
   losing generates the share card.
   ============================================================ */

const T = TUNING;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString();

/* deterministic RNG so ?demo=1 replays the identical run */
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const IS_DEMO = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('demo') === '1';

/* Role headshots: src/avatars/<roleKey>.png, emoji fallback */
const AVATARS = Object.fromEntries(
  Object.entries(import.meta.glob('./avatars/*.png', { eager: true, import: 'default', query: '?url' }))
    .map(([p, url]) => [p.split('/').pop().replace('.png', ''), url])
);
ROLES.forEach((r) => { r.img = AVATARS[r.key] || null; });

const AUDIT_NOISE = [
  'Refund issued twice', 'Duplicate record created', 'Escalated to engineering',
  'Lead name: steve', 'Renewal date passed', 'Status page still green',
  'CSAT sent mid-outage', 'Invoice 90 days late', 'Forecast changed again',
  'Wrong list, 40k sent', 'Macro contradicts policy', 'AI answered confidently',
  'Three tools, one job', 'Field left empty', 'Handoff dropped',
];

const QUARTER_TAGS = ['THE YEAR BEGINS', 'THE BUSINESS SCALES', 'GROWTH ARRIVES', 'EVERYTHING COMPOUNDS'];

const cardByKey = (k) => DRAFT_POOL.find((c) => c.key === k);
const flagshipOf = (roleKey) => DRAFT_POOL.find((c) => c.kind === 'flagship' && c.role === roleKey);

/* does this drafted card's lane match this ticket? */
const inLane = (card, tk) => {
  if (card.kind === 'flagship') return tk.role === card.role || tk.theme === 'signature';
  if (card.kind === 'data360') return tk.theme === 'messyData';
  if (card.kind === 'orchestrator') return tk.theme === 'disconnected';
  if (card.kind === 'flow') return tk.theme === 'techDebt';
  return false; // guardrails acts at spawn, never fires from the dock
};

/* Memoized: the board only re-renders when the ticket array identity or the
   held ticket changes, not on every 10Hz meter/day tick. At 70 spawns a
   quarter that difference is the frame budget. */
const TicketBoard = React.memo(function TicketBoard({ tickets, holdId, holdStart, holdEnd }) {
  return (
    <div className="flex flex-wrap gap-3 items-start content-start">
      <AnimatePresence>
        {tickets.map((tk) => (
          <motion.button
            key={tk.id}
            initial={{ scale: 0, opacity: 0, rotate: tk.jx }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={tk.fate === 'agent'
              ? { y: 190, scale: 0.25, opacity: 0, transition: { duration: 0.38 } }
              : tk.fate === 'you'
                ? { scale: 0, opacity: 0, transition: { duration: 0.22 } }
                : { opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
            data-testid="ticket"
            data-headline={tk.headline}
            data-live={!tk.fate && !tk.blocked ? '1' : undefined}
            onPointerDown={(e) => { e.preventDefault(); if (!tk.blocked) holdStart(tk.id); }}
            onPointerUp={holdEnd}
            onPointerLeave={() => { if (holdId === tk.id) holdEnd(); }}
            onContextMenu={(e) => e.preventDefault()}
            className={`relative text-left px-3 py-2 border-2 bg-[#0d0d1f] overflow-hidden ${holdId === tk.id ? 'holding' : ''} ${
              tk.blocked ? 'opacity-70 border-[#8b8ba0]' : 'cursor-pointer'}`}
            style={{
              borderColor: tk.blocked ? '#8b8ba0' : THEMES[tk.theme].color,
              boxShadow: '3px 3px 0 #000',
              maxWidth: '240px',
            }}>
            <span className="txt-ticket text-[#f2e8c9] block pr-1">
              {tk.headline}
              {tk.n > 1 && <span className="text-[#ff5555] h-pixel text-[9px]"> ×{tk.n}</span>}
            </span>
            {tk.blocked && (
              <span className="h-pixel text-[7px] text-[#3bff5e] block mt-1">🚧 BLOCKED · GUARDRAILS</span>
            )}
            {!tk.blocked && <span className="holdbar" />}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
});

const deathLine = (def, spawnCount) => {
  if (!def) return 'the year-end audit';
  if (!def.death.includes('{n}')) return def.death;
  const n = Math.max(1, spawnCount) * (def.per || 1);
  return def.death.replace('{n}', n.toLocaleString());
};

export default function WhoBrokeTheBusiness() {
  const [phase, setPhase] = useState('title');
  // title | roleSelect | quarterIntro | quarter | draft | noDraft | auditIntro | audit | end
  const [howTo, setHowTo] = useState(false);
  const [mode, setMode] = useState('normal'); // normal | manual
  const [role, setRole] = useState(null);
  const [quarterIdx, setQuarterIdx] = useState(0);
  const [drafted, setDrafted] = useState([]); // card objects, draft order
  const [offers, setOffers] = useState([]);
  const [ui, setUi] = useState(null); // per-tick snapshot for the board
  const [receipts, setReceipts] = useState([]);
  const [holdId, setHoldId] = useState(null);
  const [floodCards, setFloodCards] = useState([]);
  const [simNote, setSimNote] = useState('');
  const [auditStage, setAuditStage] = useState(0); // 0 idle, 1 cascading, 2 gold, 3 resolved
  const [shakeCls, setShakeCls] = useState('');
  const [endInfo, setEndInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  const simRef = useRef(null);
  const draftedRef = useRef([]);
  useEffect(() => { draftedRef.current = drafted; }, [drafted]);

  const doShake = useCallback((cls) => {
    setShakeCls('');
    requestAnimationFrame(() => setShakeCls(cls));
    setTimeout(() => setShakeCls(''), 700);
  }, []);

  /* ---------------- sim setup ---------------- */

  const newSim = (r, m) => {
    const seed = IS_DEMO ? T.DEMO_SEED : Math.floor(Math.random() * 2 ** 31);
    return {
      rng: mulberry32(seed),
      mode: m, roleKey: r.key,
      quarter: 0, elapsed: 0, simTime: 0, lastNow: 0,
      schedule: [], spawnIdx: 0, nextId: 1,
      tickets: [],
      meters: { ...T.METER_START },
      agentTimers: {},
      handledYou: 0, handledAgents: 0,
      spawnCounts: {},
      dmgLog: { productivity: {}, happiness: {}, debt: {} },
      holding: null,
      dead: false,
    };
  };

  const buildSchedule = (s, q) => {
    const mult = s.mode === 'manual' ? T.MANUAL_OPS.spawnMult : 1;
    const n = Math.round(T.SPAWN_PER_QUARTER[q] * mult);
    const total = T.QUARTER_SECONDS * 1000;
    const sched = [];
    for (let i = 0; i < n; i++) {
      const at = total * Math.pow((i + 1) / n, T.SPAWN_ACCEL);
      // weighted toward the player's seat
      let rk;
      if (s.rng() < T.ROLE_SPAWN_WEIGHT) rk = s.roleKey;
      else {
        const others = ROLES.filter((r) => r.key !== s.roleKey);
        rk = others[Math.floor(s.rng() * others.length)].key;
      }
      const slot = Math.floor(s.rng() * 5);
      const def = TICKET_POOL.find((tk, idx) => tk.role === rk && idx % 5 === slot);
      sched.push({ at: Math.min(at, total - 400), def });
    }
    sched.sort((a, b) => a.at - b.at);
    s.schedule = sched;
    s.spawnIdx = 0;
    s.elapsed = 0;
  };

  /* ---------------- flow ---------------- */

  const startRun = (r, m) => {
    setRole(r); setMode(m);
    setDrafted([]); draftedRef.current = [];
    setReceipts([]); setEndInfo(null); setUi(null); setCopied(false);
    simRef.current = newSim(r, m);
    // rehearsal aid: with the demo seed active, expose sim state read-only
    // so a scripted run can assert meters and handled counts
    if (IS_DEMO) window.__wbtbSim = simRef;
    setQuarterIdx(0);
    beginQuarter(0);
  };

  const beginQuarter = (q) => {
    const s = simRef.current;
    s.quarter = q;
    buildSchedule(s, q);
    // Data 360 drafted between quarters: collapse duplicates on the carried board
    if (draftedRef.current.some((c) => c.kind === 'data360')) {
      const seen = {};
      s.tickets = s.tickets.filter((tk) => {
        if (tk.fate || tk.blocked) return true;
        if (seen[tk.headline]) { seen[tk.headline].n = s.spawnCounts[tk.headline] || seen[tk.headline].n; return false; }
        seen[tk.headline] = tk;
        return true;
      });
    }
    setQuarterIdx(q);
    setPhase('quarterIntro');
  };

  useEffect(() => {
    if (phase !== 'quarterIntro') return undefined;
    const t = setTimeout(() => setPhase('quarter'), 1700);
    return () => clearTimeout(t);
  }, [phase]);

  /* ---------------- the quarter engine ---------------- */

  useEffect(() => {
    if (phase !== 'quarter') return undefined;
    const s = simRef.current;
    s.lastNow = performance.now();
    const dmgMult = s.mode === 'manual' ? T.MANUAL_OPS.damageMult : 1;
    const cards = draftedRef.current;
    const hasD360 = cards.some((c) => c.kind === 'data360');
    const hasOrch = cards.some((c) => c.kind === 'orchestrator');
    const hasGuard = cards.some((c) => c.kind === 'guardrails');
    const hasFlow = cards.some((c) => c.kind === 'flow');
    cards.forEach((c) => { if (s.agentTimers[c.key] == null) s.agentTimers[c.key] = s.simTime + 600; });

    const int = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(250, now - s.lastNow);
      s.lastNow = now;
      s.elapsed += dt;
      s.simTime += dt;

      /* spawn */
      while (s.spawnIdx < s.schedule.length && s.schedule[s.spawnIdx].at <= s.elapsed) {
        const { def } = s.schedule[s.spawnIdx]; s.spawnIdx += 1;
        s.spawnCounts[def.headline] = (s.spawnCounts[def.headline] || 0) + 1;
        const count = s.spawnCounts[def.headline];
        const blocked = hasGuard && def.theme === 'aiMishap';
        const dupe = hasD360 && !blocked &&
          s.tickets.find((tk) => !tk.fate && !tk.blocked && tk.headline === def.headline);
        s.boardDirty = true;
        if (dupe) { dupe.n = count; dupe.mergedAt = s.simTime; dupe.absorbs += 1; }
        else {
          s.tickets.push({
            id: s.nextId++, ...def, n: count, absorbs: 1,
            spawnAt: s.simTime, blocked, fate: null, fadeAt: 0,
            jx: ((s.nextId * 53) % 9) - 4, // scatter jitter off the rng stream
          });
          if (blocked) {
            s.tickets[s.tickets.length - 1].fadeAt = s.simTime + 1500;
          }
        }
      }

      /* guardrail blocks resolve */
      s.tickets.forEach((tk) => {
        if (tk.blocked && !tk.fate && s.simTime >= tk.fadeAt) {
          tk.fate = 'blocked'; tk.fadeAt = s.simTime + 120;
          s.handledAgents += 1;
          s.boardDirty = true;
        }
      });

      /* the player's hold — judged on wall clock, not sim time: the hold bar
         the player watches runs on wall clock, and sim time falls behind it
         whenever the main thread is busy. The two must agree or holds
         released at a full bar silently fail. */
      if (s.holding) {
        const tk = s.tickets.find((x) => x.id === s.holding.id && !x.fate && !x.blocked);
        if (!tk) s.holding = null;
        else if (now - s.holding.atWall >= T.HANDLE_HOLD_MS) {
          tk.fate = 'you'; tk.fadeAt = s.simTime + 120;
          s.handledYou += tk.absorbs;
          s.holding = null;
          s.boardDirty = true;
          setHoldId(null);
        }
      }

      /* agents intercept */
      cards.forEach((c) => {
        if (c.kind === 'guardrails') return;
        const rate = hasD360 && c.kind !== 'data360' ? T.DATA360_RATE_MULT : 1;
        const interval = T.AGENT_HANDLE_MS / rate;
        if (s.simTime < s.agentTimers[c.key]) return;
        const live = s.tickets.filter((tk) => !tk.fate && !tk.blocked && (!s.holding || s.holding.id !== tk.id));
        let target = live.filter((tk) => inLane(c, tk)).sort((a, b) => a.spawnAt - b.spawnAt)[0];
        let offLane = false;
        if (!target) {
          // idle agents help off-lane: half speed with the Orchestrator, quarter speed without
          const offMult = hasOrch ? T.AGENT_CROSSLANE_MULT : T.AGENT_IDLE_MULT;
          if (s.simTime >= s.agentTimers[c.key] + interval * (1 / offMult - 1)) {
            target = live.sort((a, b) => a.spawnAt - b.spawnAt)[0];
            offLane = true;
          }
        }
        if (!target) return;
        target.fate = 'agent'; target.fadeAt = s.simTime + 120;
        s.handledAgents += target.absorbs;
        s.boardDirty = true;
        s.agentTimers[c.key] = s.simTime + interval;
        s.lastFired = { key: c.key, at: s.simTime };
        // derived from the ticket id, not the rng stream: play input must
        // never shift the demo seed's spawn schedule (?demo=1 replays exactly)
        const secs = (0.3 + ((target.id * 37) % 14) / 10).toFixed(1);
        setReceipts((rs) => [...rs.slice(-1), {
          id: target.id, at: s.simTime,
          text: `HANDLED BY ${c.short} · ${secs}s`,
        }]);
      });

      /* damage from unhandled tickets */
      s.tickets.forEach((tk) => {
        if (tk.fate || tk.blocked) return;
        if (s.simTime - tk.spawnAt < T.GRACE_MS) return;
        let dmg = (dt / T.DAMAGE_TICK_MS) * T.DAMAGE_PER_TICK * dmgMult;
        const meter = THEMES[tk.theme].meter;
        if (meter === 'debt') {
          if (hasFlow) dmg *= 0.5;
          s.meters.debt = Math.min(100, s.meters.debt + dmg);
        } else {
          s.meters[meter] = Math.max(0, s.meters[meter] - dmg);
        }
        s.dmgLog[meter][tk.headline] = (s.dmgLog[meter][tk.headline] || 0) + dmg;
      });

      /* sweep resolved tickets (AnimatePresence needs one render with fate set) */
      const preSweep = s.tickets.length;
      s.tickets = s.tickets.filter((tk) => !tk.fate || s.simTime < tk.fadeAt + 40);
      if (s.tickets.length !== preSweep) s.boardDirty = true;

      /* death */
      const m = s.meters;
      const killer = m.productivity <= 0 ? 'productivity' : m.happiness <= 0 ? 'happiness' : m.debt >= 100 ? 'debt' : null;
      if (killer && !s.dead) {
        s.dead = true;
        clearInterval(int);
        finishRun('loss', killer);
        return;
      }

      /* quarter over */
      if (s.elapsed >= T.QUARTER_SECONDS * 1000) {
        clearInterval(int);
        s.holding = null; setHoldId(null);
        if (s.mode === 'manual') { setPhase(s.quarter >= 3 ? 'auditIntro' : 'noDraft'); return; }
        // a draft follows every quarter, including Q4: that final pick is
        // what lets a draft-every-round run reach the audit with 4 agents

        openDraft();
        return;
      }

      if (s.boardDirty || !s.uiTickets) { s.uiTickets = s.tickets.slice(); s.boardDirty = false; }
      setUi({
        day: dayNow(s),
        meters: { ...s.meters },
        tickets: s.uiTickets,
        lastFired: s.lastFired || null,
        left: Math.max(0, T.QUARTER_SECONDS - s.elapsed / 1000),
      });
      setReceipts((rs) => {
        const live = rs.filter((rc) => s.simTime - rc.at < 1900);
        return live.length === rs.length ? rs : live;
      });
    }, 100);

    return () => clearInterval(int);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const dayNow = (s) => Math.min(360, Math.floor((s.simTime / 1000) * (T.DAYS_PER_QUARTER / T.QUARTER_SECONDS)));

  /* ---------------- hold to handle ---------------- */

  const holdStart = useCallback((id) => {
    const s = simRef.current;
    if (!s || s.dead) return;
    const tk = s.tickets.find((x) => x.id === id && !x.fate && !x.blocked);
    if (!tk) return;
    s.holding = { id, at: s.simTime, atWall: performance.now() };
    setHoldId(id);
  }, []);
  const holdEnd = useCallback(() => {
    const s = simRef.current;
    // releasing at a full bar always counts, even if no tick landed in the
    // window between the bar filling and the release
    if (s && s.holding && performance.now() - s.holding.atWall >= T.HANDLE_HOLD_MS) {
      const tk = s.tickets.find((x) => x.id === s.holding.id && !x.fate && !x.blocked);
      if (tk) {
        tk.fate = 'you'; tk.fadeAt = s.simTime + 120;
        s.handledYou += tk.absorbs;
        s.boardDirty = true;
      }
    }
    if (s) s.holding = null;
    setHoldId(null);
  }, []);

  /* ---------------- the draft ---------------- */

  const openDraft = () => {
    const s = simRef.current;
    const taken = new Set(draftedRef.current.map((c) => c.key));
    const remaining = DRAFT_POOL.filter((c) => !taken.has(c.key));
    const draftIndex = draftedRef.current.length;
    let offer;
    if (IS_DEMO) {
      // fixed offers: DATA 360 always in the first draft
      const script = [
        ['data360', flagshipOf(s.roleKey).key, 'guardrails'],
        ['flow', 'orchestrator', 'guardrails'],
        ['guardrails', 'orchestrator', 'flow'],
        ['orchestrator', 'tier1', 'resolve'],
      ][Math.min(draftIndex, 3)];
      offer = script.map(cardByKey).filter((c) => !taken.has(c.key));
      remaining.forEach((c) => { if (offer.length < 3 && !offer.includes(c)) offer.push(c); });
      offer = offer.slice(0, 3);
    } else {
      const broad = (c) => c.kind !== 'flagship' || c.role === s.roleKey;
      const offSeatDrafted = draftedRef.current.filter((c) => !broad(c)).length;
      // a stack of narrow off-seat agents is a death spiral, not a build:
      // offer at most one off-seat flagship, and none once you hold two
      let pool = remaining.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(s.rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      if (offSeatDrafted >= 2) pool = pool.filter(broad);
      offer = [];
      let narrowUsed = 0;
      for (const c of pool) {
        if (offer.length === 3) break;
        if (!broad(c)) { if (narrowUsed) continue; narrowUsed += 1; }
        offer.push(c);
      }
      // the first draft always includes your own seat's agent
      const own = flagshipOf(s.roleKey);
      if (draftIndex === 0 && !taken.has(own.key) && !offer.includes(own)) offer[0] = own;
    }
    setOffers(offer);
    setPhase('draft');
  };

  const pickCard = (card) => {
    const next = [...draftedRef.current, card];
    setDrafted(next); draftedRef.current = next;
    simRef.current.agentTimers[card.key] = 0;
    if (simRef.current.quarter >= 3) setPhase('auditIntro');
    else beginQuarter(simRef.current.quarter + 1);
  };

  /* ---------------- the year-end audit (boss) ---------------- */

  useEffect(() => {
    if (phase !== 'auditIntro') return undefined;
    setFloodCards([]);
    let n = 0;
    const int = setInterval(() => {
      if (n >= 60) { clearInterval(int); return; }
      n += 1;
      setFloodCards((cs) => [...cs, {
        id: n, text: AUDIT_NOISE[n % AUDIT_NOISE.length],
        x: (n * 37) % 92, y: 8 + ((n * 53) % 70),
      }]);
    }, 70);
    return () => clearInterval(int);
  }, [phase]);

  const runAudit = async () => {
    const s = simRef.current;
    const stack = draftedRef.current;
    setPhase('audit');
    setAuditStage(1);
    await sleep(700);

    const actors = stack.filter((c) => c.kind !== 'data360' && c.kind !== 'orchestrator');
    const mults = stack.filter((c) => c.kind === 'data360' || c.kind === 'orchestrator');
    const clears = stack.length >= T.BOSS_AGENTS_TO_CLEAR;
    const perActor = actors.length ? Math.round(T.BOSS_VOLUME * (clears ? 1 : 0.55) / actors.length) : 0;

    for (let i = 0; i < actors.length; i++) {
      const c = actors[i];
      setSimNote(`${c.icon} ${c.short} · CLEARING ${fmt(perActor)} PROBLEMS`);
      setFloodCards((cs) => cs.filter((_, ci) => ci % Math.max(2, actors.length + 1) !== i % Math.max(2, actors.length + 1)));
      await sleep(360);
      s.handledAgents += perActor;
      doShake('shake-s');
      await sleep(720);
    }
    for (const c of mults) {
      setAuditStage(2);
      setSimNote(c.kind === 'data360'
        ? `${c.icon} DATA 360 · DUPLICATES COLLAPSE. EVERY AGENT RUNS 1.5× FASTER.`
        : `${c.icon} ORCHESTRATOR · EVERY AGENT, EVERY LANE, AT ONCE.`);
      setFloodCards((cs) => cs.filter((_, ci) => ci % 2 === 0));
      doShake('shake-b');
      await sleep(1050);
    }

    if (clears) {
      setSimNote('AUDIT CLEAR. EVERY PROBLEM ANSWERED FOR.');
      setFloodCards([]);
      setAuditStage(3);
      doShake('shake-b');
      await sleep(1500);
      setSimNote('');
      finishRun('win', null);
    } else {
      setSimNote(`${fmt(T.BOSS_VOLUME - perActor * actors.length)} PROBLEMS HAVE NO ANSWER.`);
      // the backlog swallows the meters
      let more = 60;
      const int = setInterval(() => {
        more += 1;
        setFloodCards((cs) => [...cs, {
          id: 1000 + more, text: AUDIT_NOISE[more % AUDIT_NOISE.length],
          x: (more * 41) % 92, y: 8 + ((more * 59) % 70),
        }]);
      }, 45);
      doShake('shake-b');
      await sleep(2100);
      clearInterval(int);
      s.meters.productivity = Math.min(s.meters.productivity, 8);
      s.meters.happiness = Math.min(s.meters.happiness, 11);
      s.meters.debt = Math.max(s.meters.debt, 96);
      setSimNote('');
      finishRun('loss', 'audit');
    }
  };

  /* ---------------- endings ---------------- */

  const finishRun = (outcome, killer) => {
    const s = simRef.current;
    const seasoning = draftedRef.current.length;
    let day, cause = null;
    if (outcome === 'win') {
      day = T.WIN_DAY;
    } else if (killer === 'audit') {
      day = T.LOSS_AUDIT_DAY + seasoning;
      const km = ['happiness', 'productivity', 'debt'].sort((a, b) => {
        const v = (k) => (k === 'debt' ? 100 - s.meters[k] : s.meters[k]);
        return v(a) - v(b);
      })[0];
      cause = topCause(s, km) || `${fmt(T.BOSS_VOLUME)} problems and ${seasoning} agent${seasoning === 1 ? '' : 's'}`;
      day = Math.min(day, 359);
    } else {
      day = dayNow(s);
      cause = topCause(s, killer) || 'the queue itself';
    }
    setEndInfo({
      outcome, day, cause,
      meters: {
        productivity: Math.round(s.meters.productivity),
        happiness: Math.round(s.meters.happiness),
        debt: Math.round(s.meters.debt),
      },
      seasoning,
      you: s.handledYou,
      agents: s.handledAgents,
    });
    setPhase('end');
  };

  const topCause = (s, meter) => {
    const log = s.dmgLog[meter] || {};
    const top = Object.entries(log).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    const def = TICKET_POOL.find((tk) => tk.headline === top[0]);
    return deathLine(def, s.spawnCounts[top[0]] || 1);
  };

  const cardText = () => {
    const e = endInfo;
    if (!e) return '';
    const head = e.outcome === 'win'
      ? 'YOUR BUSINESS SURVIVED THE YEAR'
      : `YOUR BUSINESS SURVIVED ${e.day} DAYS`;
    const lines = [
      head,
      `📈 Productivity: ${e.meters.productivity}`,
      `😊 Customer Happiness: ${e.meters.happiness}`,
      `💸 Technical Debt: ${e.meters.debt}${e.outcome === 'loss' ? ' 😬' : ''}`,
      `✨ Agentic Seasoning: ${e.seasoning}/10`,
      e.outcome === 'win'
        ? `Handled by you: ${fmt(e.you)} · Handled by your agents: ${fmt(e.agents)}`
        : `Cause of death: ${e.cause}`,
    ];
    return lines.join('\n');
  };

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(cardText() + '\n\nWHO BROKE THE BUSINESS?');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const replay = () => {
    simRef.current = null;
    setPhase('title');
    setRole(null); setMode('normal'); setDrafted([]); draftedRef.current = [];
    setOffers([]); setUi(null); setReceipts([]); setHoldId(null);
    setFloodCards([]); setSimNote(''); setAuditStage(0); setEndInfo(null);
    setQuarterIdx(0); setCopied(false);
  };

  /* ---------------- shared bits ---------------- */

  const isAudit = phase === 'auditIntro' || phase === 'audit';
  const bg =
    phase === 'end' && endInfo?.outcome === 'win' ? 'bg-[#04301f]'
      : auditStage === 2 ? 'bg-[#3a2a00]'
        : auditStage === 3 ? 'bg-[#04301f]'
          : isAudit || (phase === 'end' && endInfo?.outcome === 'loss') ? 'bg-[#1a0303]'
            : 'bg-[#160b2e]';

  const Avatar = ({ r, size }) => (r.img
    ? <img src={r.img} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size, imageRendering: 'pixelated' }} draggable={false} />
    : <span style={{ fontSize: size * 0.72, lineHeight: 1 }}>{r.emoji}</span>);

  const Meter = ({ label, value, color, inverted, testid }) => {
    const segs = 20;
    const filled = Math.max(0, Math.min(segs, Math.round((value / 100) * segs)));
    const danger = inverted ? value >= 75 : value <= 25;
    return (
      <div data-testid={testid} data-value={Math.round(value)}>
        <div className={`h-pixel text-[8px] mb-1 ${danger ? 'text-[#ff5555] blink' : 'text-[#8b8ba0]'}`}>{label} · {Math.round(value)}</div>
        <div className="flex gap-[2px] bg-black border-2 border-black p-[2px]">
          {Array.from({ length: segs }).map((_, i) => (
            <div key={i} className="h-3 flex-1"
              style={{ backgroundColor: i < filled ? color : '#241539', opacity: i < filled ? 1 : 0.8 }} />
          ))}
        </div>
      </div>
    );
  };

  const Hud = ({ day, meters }) => (
    <div className="bg-black border-4 border-[#2ee6ff] shadow-[6px_6px_0_rgba(255,46,154,0.5)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {role && <Avatar r={role} size={40} />}
          <div>
            <div className="h-pixel text-[10px] text-[#ff2e9a]">Q{quarterIdx + 1} · {QUARTER_TAGS[quarterIdx]}</div>
            <div className="txt-small text-[#8b8ba0]">{mode === 'manual' ? 'MANUAL OPS MODE' : role?.tagline}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="h-pixel text-2xl text-[#ffe600] tabular-nums" style={{ textShadow: '3px 3px 0 #000' }} data-testid="day">
            DAY {day}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2 mt-3">
        <Meter label="PRODUCTIVITY" value={meters.productivity} color="#2ee6ff" testid="meter-productivity" />
        <Meter label="CUSTOMER HAPPINESS" value={meters.happiness} color="#3bff5e" testid="meter-happiness" />
        <Meter label="TECHNICAL DEBT" value={meters.debt} color="#ff5555" inverted testid="meter-debt" />
        <div data-testid="seasoning" data-value={drafted.length}>
          <div className="h-pixel text-[8px] mb-1 text-[#8b8ba0]">AGENTIC SEASONING · {drafted.length}/10</div>
          <div className="flex gap-[3px] bg-black border-2 border-black p-[2px]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-3 flex-1" style={{ backgroundColor: i < drafted.length ? '#ffe600' : '#241539' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ============================ RENDER ============================ */

  return (
    <div className={`min-h-screen w-full transition-colors duration-700 ${bg} ${shakeCls} relative overflow-hidden ${isAudit ? 'scanlines-red' : ''}`}>
      <style>{`
        .h-pixel{font-family:'Press Start 2P',monospace;}
        .txt-body{font-family:'VT323',monospace;font-size:clamp(1.35rem,2.5vw,1.85rem);line-height:1.2;}
        .txt-small{font-family:'VT323',monospace;font-size:1.3rem;line-height:1.2;}
        .txt-ticket{font-family:'VT323',monospace;font-size:1.25rem;line-height:1.1;}
        .read{max-width:62ch;}
        @keyframes shakeSK { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-4px,2px)} 40%{transform:translate(4px,-2px)} 60%{transform:translate(-3px,-2px)} 80%{transform:translate(3px,2px)} }
        @keyframes shakeBK { 0%,100%{transform:translate(0,0)} 15%{transform:translate(-9px,5px) rotate(-.4deg)} 30%{transform:translate(9px,-5px) rotate(.4deg)} 45%{transform:translate(-7px,-4px)} 60%{transform:translate(7px,4px)} }
        .shake-s{animation:shakeSK .45s steps(5)}
        .shake-b{animation:shakeBK .65s steps(6)}
        @keyframes blinkK { 0%,49%{opacity:1} 50%,100%{opacity:.25} }
        .blink{animation:blinkK .6s steps(1) infinite}
        .scanlines-red::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,45,45,.05) 0 3px,transparent 3px 7px);pointer-events:none;z-index:60;}
        .btn-pixel{font-family:'Press Start 2P',monospace;text-transform:uppercase;border-width:4px;border-style:solid;box-shadow:4px 4px 0 #000;}
        .btn-pixel:hover{transform:translate(-1px,-1px);box-shadow:6px 6px 0 #000;}
        .btn-pixel:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #000;}
        .holdbar{position:absolute;left:0;bottom:0;height:5px;background:#3bff5e;width:0%;}
        .holding .holdbar{width:100%;transition:width ${T.HANDLE_HOLD_MS}ms linear;}
        @media (prefers-reduced-motion: reduce){ .shake-s,.shake-b,.blink{animation:none} }
      `}</style>

      {/* ================= TITLE ================= */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-20 bg-black flex items-center justify-center overflow-hidden">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
            className="relative"
            style={{ width: 'min(100vw, calc(100vh * 2752 / 1536))', height: 'min(100vh, calc(100vw * 1536 / 2752))' }}>
            <img src={menuArt} alt="Who Broke the Business?" className="absolute inset-0 w-full h-full object-fill select-none" draggable={false} />
            <motion.button aria-label="Start game" onClick={() => { setMode('normal'); setPhase('roleSelect'); }}
              animate={{ boxShadow: ['0 0 0px rgba(59,255,94,0)', '0 0 26px rgba(59,255,94,0.8)', '0 0 0px rgba(59,255,94,0)'] }}
              transition={{ repeat: Infinity, duration: 1.5 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="absolute cursor-pointer border-2 border-transparent hover:border-[#3bff5e] bg-transparent"
              style={{ left: '36.5%', top: '54.5%', width: '27%', height: '12%' }} />
            <motion.button aria-label="How to play" onClick={() => setHowTo(true)}
              whileHover={{ scale: 1.04, boxShadow: '0 0 22px rgba(46,230,255,0.7)' }} whileTap={{ scale: 0.96 }}
              className="absolute cursor-pointer border-2 border-transparent hover:border-[#2ee6ff] bg-transparent"
              style={{ left: '36.5%', top: '68%', width: '27%', height: '10.5%' }} />
            {/* third menu entry, below the drawn HOW TO PLAY button and above the
                art's bottom caption band. Centered by the wrapper, not a transform:
                .btn-pixel's hover/active transforms replace the transform property,
                so a translate-centered button jumps sideways under the cursor */}
            <div className="absolute inset-x-0 flex justify-center pointer-events-none" style={{ top: '80.5%' }}>
              <button data-testid="manual-ops" onClick={() => { setMode('manual'); setPhase('roleSelect'); }}
                className="btn-pixel pointer-events-auto text-[9px] px-5 py-3 bg-black/85 text-[#ff5555] border-[#ff5555]">
                MANUAL OPS MODE
              </button>
            </div>
            {IS_DEMO && (
              <div className="absolute top-2 right-2 h-pixel text-[8px] text-[#ffe600] bg-black/80 border-2 border-[#ffe600] px-2 py-1">DEMO SEED</div>
            )}
          </motion.div>

          <AnimatePresence>
            {howTo && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/93 flex items-center justify-center px-4 py-6 overflow-y-auto">
                <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className="bg-black border-4 border-[#2ee6ff] shadow-[8px_8px_0_rgba(255,46,154,0.5)] max-w-2xl w-full p-7">
                  <div className="h-pixel text-sm text-[#ffe600]">HOW TO PLAY</div>
                  <div className="mt-5 space-y-5 read">
                    {[
                      ['1. TICKETS FLOOD IN', 'Every disaster is a ticket. Click and hold one for 1.2 seconds to handle it yourself. You have two hands. That is the problem.', '#2ee6ff'],
                      ['2. WATCH THE METERS', 'Unhandled tickets drain PRODUCTIVITY and CUSTOMER HAPPINESS, and pile up TECHNICAL DEBT. Any meter dying ends the run.', '#ff2e9a'],
                      ['3. DRAFT BETWEEN QUARTERS', 'After each quarter, pick one Agentforce agent. No timer. It intercepts its lane of tickets automatically, forever.', '#3bff5e'],
                      ['4. SURVIVE THE YEAR', 'Four quarters, then the year-end audit: 4,000 problems at once. Your stack answers, or nobody does.', '#ffe600'],
                      ['5. LOSING IS NORMAL', 'Most businesses do not make it. Your run ends with a card either way. Post your days survived.', '#ff5555'],
                    ].map(([h, body, color]) => (
                      <div key={h}>
                        <div className="h-pixel text-[11px]" style={{ color }}>{h}</div>
                        <div className="txt-body text-[#c9c9dd] mt-2">{body}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-7">
                    <button onClick={() => setHowTo(false)} className="btn-pixel flex-1 py-4 text-[10px] bg-black text-[#8b8ba0] border-[#8b8ba0]">BACK</button>
                    <button onClick={() => { setHowTo(false); setMode('normal'); setPhase('roleSelect'); }} className="btn-pixel flex-1 py-4 text-[10px] bg-black text-[#3bff5e] border-[#3bff5e]">► START GAME</button>
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
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="inline-block bg-black border-4 border-[#2ee6ff] shadow-[6px_6px_0_rgba(255,46,154,0.5)] px-8 py-4">
              <h1 className="h-pixel text-xl md:text-3xl text-[#2ee6ff]" style={{ textShadow: '3px 3px 0 #000' }}>PICK YOUR ROLE</h1>
            </div>
            <p className="txt-body text-[#c9c9dd] mt-5 read mx-auto">
              {mode === 'manual'
                ? 'Manual Ops: same chaos, no agents. Your CFO already rejected the AI budget.'
                : 'Tickets are coming for every seat. Yours gets it worst.'}
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {ROLES.map((r, i) => (
              <motion.button key={r.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }}
                whileHover={{ y: -6 }} whileTap={{ scale: 0.97 }} onClick={() => startRun(r, mode)}
                className="group bg-black border-4 border-[#2ee6ff] hover:border-[#ff2e9a] shadow-[6px_6px_0_#000] hover:shadow-[8px_8px_0_rgba(255,46,154,0.6)] p-5 text-left">
                <div className="flex justify-center bg-[#101024] border-2 border-[#2ee6ff]/40 py-3">
                  <Avatar r={r} size={92} />
                </div>
                <div className="mt-4 h-pixel text-[11px] text-[#2ee6ff] leading-relaxed">{r.name}</div>
                <div className="txt-body text-[#f2e8c9] mt-2">{r.tagline}</div>
                <div className="mt-3 h-pixel text-[9px] text-[#3bff5e] opacity-0 group-hover:opacity-100">► SELECT</div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* ================= QUARTER INTRO ================= */}
      {phase === 'quarterIntro' && (
        <div className="min-h-screen flex items-center justify-center relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="h-pixel text-4xl md:text-6xl text-[#ffe600]" style={{ textShadow: '5px 5px 0 #7a0000, 8px 8px 0 #000' }}>
              Q{quarterIdx + 1}
            </div>
            <div className="h-pixel text-[11px] text-[#ff2e9a] mt-5">{QUARTER_TAGS[quarterIdx]}</div>
            <div className="txt-body text-[#c9c9dd] mt-4">
              DAY {quarterIdx * 90} · {T.SPAWN_PER_QUARTER[quarterIdx] * (mode === 'manual' ? T.MANUAL_OPS.spawnMult : 1) | 0} tickets incoming
            </div>
            {quarterIdx === 0 && (
              <div className="txt-small text-[#8b8ba0] mt-3">Hold a ticket to handle it. Good luck.</div>
            )}
          </motion.div>
        </div>
      )}

      {/* ================= QUARTER (the chaos) ================= */}
      {phase === 'quarter' && ui && (
        <div className="max-w-5xl mx-auto px-4 py-4 relative z-10 select-none" style={{ touchAction: 'manipulation' }}>
          <Hud day={ui.day} meters={ui.meters} />

          {/* ticket board */}
          <div className="mt-4 min-h-[46vh] pb-28">
            <TicketBoard tickets={ui.tickets} holdId={holdId} holdStart={holdStart} holdEnd={holdEnd} />
          </div>

          {/* receipts */}
          <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-2 items-end pointer-events-none">
            <AnimatePresence>
              {receipts.map((rc) => (
                <motion.div key={rc.id + rc.text} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="bg-black border-2 border-[#3bff5e] px-3 py-1.5 h-pixel text-[8px] text-[#3bff5e]">
                  ✓ {rc.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* agent dock */}
          {drafted.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/90 border-t-4 border-[#3bff5e]/60 px-4 py-2">
              <div className="max-w-5xl mx-auto flex flex-wrap gap-2 items-center">
                <span className="h-pixel text-[8px] text-[#3bff5e] mr-1">YOUR STACK</span>
                {drafted.map((c) => (
                  <motion.div key={c.key}
                    animate={ui.lastFired?.key === c.key && (simRef.current?.simTime || 0) - ui.lastFired.at < 320
                      ? { scale: 1.12 } : { scale: 1 }}
                    className="flex items-center gap-2 border-2 border-[#3bff5e] bg-[#02100a] px-2.5 py-1.5">
                    <span className="text-lg leading-none">{c.icon}</span>
                    <span className="h-pixel text-[7px] text-[#7dfcd0]">{c.short}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= DRAFT (the decision) ================= */}
      {phase === 'draft' && (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 relative z-10">
          <div className="absolute inset-0" style={{ backgroundImage: `url(${agentBgArt})`, backgroundSize: 'cover', backgroundPosition: 'center 78%' }} aria-hidden />
          <div className="absolute inset-0 bg-black/90" aria-hidden />
          <div className="relative max-w-4xl w-full">
            <div className="text-center">
              <motion.div initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                className="inline-block bg-[#031a12] border-4 border-[#2ee6ff] px-7 py-4"
                style={{ boxShadow: '0 0 34px rgba(46,230,255,0.55), 0 0 70px rgba(59,255,94,0.25), 4px 4px 0 #000' }}>
                <div className="flex items-center gap-4">
                  <img src={robotArt} alt="" className="h-14 border-2 border-[#2ee6ff]/40 select-none" draggable={false} />
                  <h2 className="h-pixel text-lg md:text-2xl leading-snug text-left" style={{ color: '#7dfcd0' }}>
                    Q{quarterIdx + 1} SURVIVED.<br />DRAFT ONE AGENT.
                  </h2>
                </div>
              </motion.div>
              <p className="txt-body text-[#c9c9dd] mt-4">No timer. Pick the lane that is killing you.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {offers.map((c, i) => (
                <motion.button key={c.key} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.1 }} whileHover={{ y: -6 }} whileTap={{ scale: 0.97 }}
                  onClick={() => pickCard(c)} data-testid="draft-card" data-card={c.key}
                  className="bg-[#02100a] border-4 border-[#3bff5e] shadow-[6px_6px_0_#000] hover:border-[#ffe600] p-5 text-left flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl bg-[#101024] border-2 border-[#3bff5e]/40 px-2 py-1">{c.icon}</span>
                    <div>
                      <div className="h-pixel text-[10px] text-[#7dfcd0] leading-relaxed">{c.name}</div>
                      {c.custom && (
                        <div className="h-pixel text-[6px] text-[#ffe600] mt-1">CUSTOM AGENT · BUILT ON AGENTFORCE</div>
                      )}
                    </div>
                  </div>
                  <div className="txt-small text-[#f2e8c9]">{c.rule}</div>
                  <div className="txt-small text-[#8b8ba0] mt-auto border-t-2 border-[#3bff5e]/30 pt-2">{c.capability}</div>
                  <div className="h-pixel text-[9px] text-[#3bff5e]">► DRAFT</div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= NO DRAFT (Manual Ops) ================= */}
      {phase === 'noDraft' && (
        <div className="min-h-screen flex items-center justify-center px-5 relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            className="max-w-xl text-center bg-black border-4 border-[#ff5555] shadow-[8px_8px_0_#000] p-8">
            <div className="h-pixel text-[11px] text-[#ff5555]">BUDGET REVIEW</div>
            <h2 className="h-pixel text-lg md:text-2xl text-[#f2e8c9] mt-5 leading-relaxed">
              YOUR CFO REJECTED THE AI BUDGET.
            </h2>
            <p className="txt-body text-[#c9c9dd] mt-4">
              "We'll revisit it next fiscal year." The tickets will not wait that long.
            </p>
            <button onClick={() => beginQuarter(simRef.current.quarter + 1)}
              className="btn-pixel mt-7 px-8 py-4 text-[10px] bg-black text-[#ff5555] border-[#ff5555]">
              ► BACK TO THE QUEUE
            </button>
          </motion.div>
        </div>
      )}

      {/* ================= AUDIT INTRO + AUDIT (boss) ================= */}
      {isAudit && (
        <div className="min-h-screen relative z-10 px-5 py-6">
          {simNote && (
            <motion.div key={simNote} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-[#ffe600] txt-body px-5 py-3 border-4 border-[#ffe600] whitespace-nowrap max-w-[94vw] overflow-hidden text-ellipsis">
              {simNote}
            </motion.div>
          )}

          <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
            <AnimatePresence>
              {floodCards.map((c) => (
                <motion.div key={c.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.85 }} exit={{ scale: 0, opacity: 0, y: 60 }}
                  transition={{ duration: 0.3 }} className="absolute bg-[#2b0505] text-[#ff9d9d] border-2 border-[#7a0000] px-2 py-1"
                  style={{ left: `${c.x}%`, top: `${c.y}%`, fontFamily: "'VT323',monospace", fontSize: '1rem' }}>
                  {c.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="max-w-3xl mx-auto mt-10 text-center relative">
            {phase === 'auditIntro' && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                <div className="inline-block bg-[#ff2d2d] text-black h-pixel text-[10px] px-4 py-2 border-4 border-black blink">
                  DAY 360 · YEAR-END AUDIT
                </div>
                <h2 className="h-pixel text-xl md:text-3xl text-[#ff2d2d] mt-6 leading-relaxed" style={{ textShadow: '4px 4px 0 #7a0000, 7px 7px 0 #000' }}>
                  {fmt(T.BOSS_VOLUME)} PROBLEMS.
                </h2>
                <p className="txt-body text-[#f2e8c9] mt-4 read mx-auto">
                  Every unfixed root cause from the whole year, at once. No human can triage this.
                  Manual handling is disabled. It was always going to come down to the stack.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 justify-center">
                  {drafted.length === 0 && <span className="txt-body text-[#ff9d9d]">Your stack: nobody.</span>}
                  {drafted.map((c) => (
                    <div key={c.key} className="flex items-center gap-2 border-2 border-[#3bff5e] bg-black px-3 py-2">
                      <span className="text-lg">{c.icon}</span>
                      <span className="txt-small text-[#7dfcd0]">{c.short}</span>
                    </div>
                  ))}
                </div>
                <motion.button animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                  whileTap={{ scale: 0.95 }} onClick={runAudit} data-testid="simulate"
                  className="btn-pixel mt-7 bg-black text-[#3bff5e] text-xl px-12 py-5 border-[#3bff5e]"
                  style={{ boxShadow: '0 0 30px rgba(59,255,94,0.5), 4px 4px 0 #000' }}>
                  ► SIMULATE
                </motion.button>
              </motion.div>
            )}

            {phase === 'audit' && (
              <div className="mt-16 flex flex-wrap gap-3 justify-center">
                {drafted.map((c) => (
                  <motion.div key={c.key}
                    animate={{ scale: simNote.includes(c.short) ? 1.15 : 1 }}
                    className={`border-4 bg-black px-4 py-3 ${simNote.includes(c.short) ? 'border-[#ffe600]' : 'border-[#3bff5e]'}`}
                    style={simNote.includes(c.short) ? { boxShadow: '0 0 30px rgba(255,230,0,0.8)' } : undefined}>
                    <div className="text-2xl">{c.icon}</div>
                    <div className="h-pixel text-[8px] text-[#7dfcd0] mt-2 leading-relaxed">{c.short}</div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= END CARD (the shareable artifact) ================= */}
      {phase === 'end' && endInfo && (
        <div className="min-h-screen flex items-center justify-center px-5 py-10 relative z-10">
          {endInfo.outcome === 'win' && (
            <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
              {Array.from({ length: 48 }).map((_, i) => (
                <motion.div key={i} initial={{ y: '-10vh', x: `${(i * 71) % 100}vw`, rotate: 0, opacity: 1 }}
                  animate={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 720, opacity: [1, 1, 0.6] }}
                  transition={{ duration: 2.6 + (i % 10) * 0.25, delay: (i % 7) * 0.12, ease: 'easeIn' }}
                  className="absolute w-2.5 h-2.5"
                  style={{ backgroundColor: ['#2ee6ff', '#ffe600', '#3bff5e', '#ff2e9a', '#f2e8c9'][i % 5] }} />
              ))}
            </div>
          )}

          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl w-full">
            <div className={`bg-black border-4 shadow-[8px_8px_0_#000] p-7 ${endInfo.outcome === 'win' ? 'border-[#3bff5e]' : 'border-[#ff5555]'}`}
              data-testid="end-card">
              {role && <div className="flex justify-center mb-4"><Avatar r={role} size={72} /></div>}
              <h2 className={`h-pixel text-base md:text-xl leading-relaxed text-center ${endInfo.outcome === 'win' ? 'text-[#3bff5e]' : 'text-[#ff5555]'}`}
                style={{ textShadow: '3px 3px 0 #000' }} data-testid="end-headline">
                {endInfo.outcome === 'win' ? 'YOUR BUSINESS SURVIVED THE YEAR' : `YOUR BUSINESS SURVIVED ${endInfo.day} DAYS`}
              </h2>

              <div className="mt-6 space-y-3 txt-body text-[#f2e8c9]">
                <div className="flex justify-between gap-3"><span>📈 Productivity:</span><span className="tabular-nums text-[#2ee6ff]">{endInfo.meters.productivity}</span></div>
                <div className="flex justify-between gap-3"><span>😊 Customer Happiness:</span><span className="tabular-nums text-[#3bff5e]">{endInfo.meters.happiness}</span></div>
                <div className="flex justify-between gap-3"><span>💸 Technical Debt:</span><span className="tabular-nums text-[#ff5555]">{endInfo.meters.debt}{endInfo.outcome === 'loss' ? ' 😬' : ''}</span></div>
                <div className="flex justify-between gap-3"><span>✨ Agentic Seasoning:</span><span className="tabular-nums text-[#ffe600]">{endInfo.seasoning}/10</span></div>
              </div>

              <div className="mt-5 border-t-2 border-[#8b8ba0]/40 pt-4 txt-body text-[#c9c9dd]" data-testid="end-tail">
                {endInfo.outcome === 'win'
                  ? <>Handled by you: <span className="text-[#ffe600]">{fmt(endInfo.you)}</span> · Handled by your agents: <span className="text-[#3bff5e]">{fmt(endInfo.agents)}</span></>
                  : <>Cause of death: <span className="text-[#ff9d9d]">{endInfo.cause}</span></>}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={replay} data-testid="replay"
                className="btn-pixel flex-1 py-4 text-[10px] bg-black text-[#2ee6ff] border-[#2ee6ff]">↻ REPLAY</button>
              <button onClick={copyCard} data-testid="copy-card"
                className="btn-pixel flex-1 py-4 text-[10px] bg-black text-[#ffe600] border-[#ffe600]">
                {copied ? '✓ COPIED' : '⧉ COPY CARD'}
              </button>
            </div>
            {endInfo.outcome === 'loss' && mode === 'manual' && (
              <p className="txt-small text-[#8b8ba0] text-center mt-4">Imagine having a stack. Replay and draft one.</p>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
