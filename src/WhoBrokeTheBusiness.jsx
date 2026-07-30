import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import menuArt from './art/menu.jpg';
import agentBgArt from './art/agent-bg.jpg';
import robotArt from './art/robot.png';
import { ROLES, CHAOS_VOLUME, AGENT_SHARE, CHOICE_POINTS, POINTS_PER_PROBLEM } from './gameData';

/* ============================================================
   WHO BROKE THE BUSINESS?
   Pick your role → the chaos begins → every challenge unlocks
   a practical Agentforce solution ("agentic seasoning").
   ============================================================ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString();
const TOTAL = 5;
const FLOOD_VOLUME = 4000;

/* Role headshots: src/avatars/<roleKey>.png, emoji fallback */
const AVATARS = Object.fromEntries(
  Object.entries(import.meta.glob('./avatars/*.png', { eager: true, import: 'default', query: '?url' }))
    .map(([p, url]) => [p.split('/').pop().replace('.png', ''), url])
);
ROLES.forEach((r) => { r.img = AVATARS[r.key] || null; });

const FLOOD_NOISE = [
  'Refund issued twice', 'Duplicate record created', 'Ticket escalated to engineering',
  'Lead name: steve', 'Renewal date passed', 'Status page still green',
  'CSAT survey sent mid-outage', 'Invoice 90 days late', 'Forecast changed again',
  'Wrong list, 40k recipients', 'Macro contradicts policy', 'AI answered confidently',
  'Three tools, one job', 'Field left empty', 'Handoff dropped',
];

function useAnimatedNumber(target) {
  const [val, setVal] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    const from = ref.current;
    if (from === target) return undefined;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / 900);
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

export default function WhoBrokeTheBusiness() {
  const [phase, setPhase] = useState('title');
  // title | roleSelect | challenge | outcome | powerup | floodIntro | flood | simulate | victory
  const [howTo, setHowTo] = useState(false);
  const [role, setRole] = useState(null);
  const [idx, setIdx] = useState(0);
  const [stack, setStack] = useState([]);
  const [score, setScore] = useState(0);
  const [humanScore, setHumanScore] = useState(0);
  const [agentsHandled, setAgentsHandled] = useState(0);
  const [absorbedNow, setAbsorbedNow] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [bestCalls, setBestCalls] = useState(0);
  const [floodCards, setFloodCards] = useState([]);
  const [simStep, setSimStep] = useState(-1);
  const [simNote, setSimNote] = useState('');
  const [shakeCls, setShakeCls] = useState('');
  const [noHuman, setNoHuman] = useState(false);
  const [ghostDead, setGhostDead] = useState(false);
  const [target, setTarget] = useState(0);

  const stackRef = useRef([]);
  useEffect(() => { stackRef.current = stack; }, [stack]);

  const displayScore = useAnimatedNumber(score);
  const displayGhost = useAnimatedNumber(humanScore);

  const challenge = role ? role.challenges[idx] : null;
  const volume = CHAOS_VOLUME[Math.min(idx, CHAOS_VOLUME.length - 1)];
  const cumShare = useMemo(() => stack.reduce((s, _, i) => s + AGENT_SHARE[i], 0), [stack]);
  const youSee = Math.max(1, volume - Math.round(volume * cumShare));

  const doShake = useCallback((cls) => {
    setShakeCls('');
    requestAnimationFrame(() => setShakeCls(cls));
    setTimeout(() => setShakeCls(''), 700);
  }, []);

  /* ---------- flow ---------- */

  const pickRole = (r) => {
    setRole(r);
    setIdx(0);
    setPhase('challenge');
  };

  const choose = (choice) => {
    const pts = CHOICE_POINTS[choice.quality];
    setChosen(choice);
    setScore((s) => s + pts);
    setHumanScore((s) => s + pts);
    if (choice.quality === 'best') setBestCalls((n) => n + 1);
    setPhase('outcome');
  };

  const deployAgent = () => {
    const next = [...stack, challenge.powerup];
    setStack(next);
    stackRef.current = next;
    const share = next.reduce((s, _, i) => s + AGENT_SHARE[i], 0);

    if (idx === TOTAL - 1) {
      // the stack's reach against the coming flood sets the survival target
      const handled = Math.round(FLOOD_VOLUME * share);
      setTarget(Math.floor(((score + handled * POINTS_PER_PROBLEM) * 0.9) / 100) * 100);
      setPhase('floodIntro');
      return;
    }

    // next quarter: more problems arrive, and the stack absorbs its share
    const nextIdx = idx + 1;
    const absorbed = Math.round(CHAOS_VOLUME[nextIdx] * share);
    setAbsorbedNow(absorbed);
    setAgentsHandled((n) => n + absorbed);
    setScore((s) => s + absorbed * POINTS_PER_PROBLEM);
    setIdx(nextIdx);
    setChosen(null);
    setPhase('challenge');
  };

  /* ---------- the flood ---------- */

  useEffect(() => {
    if (phase !== 'flood') return undefined;
    let n = 0;
    const int = setInterval(() => {
      if (n >= 70) { clearInterval(int); return; }
      n += 1;
      setFloodCards((cards) => [...cards, {
        id: n,
        text: FLOOD_NOISE[n % FLOOD_NOISE.length],
        x: (n * 37) % 92,
        y: (n * 53) % 78,
      }]);
    }, 90);
    return () => clearInterval(int);
  }, [phase]);

  const runSimulate = async () => {
    setPhase('simulate');
    await sleep(700);
    const agents = stackRef.current;
    const share = agents.reduce((s, _, i) => s + AGENT_SHARE[i], 0);
    const perAgent = Math.round((FLOOD_VOLUME * share) / Math.max(1, agents.length));
    for (let i = 0; i < agents.length; i++) {
      setSimStep(i);
      setSimNote(`${agents[i].emoji} ${agents[i].name} — handling ${fmt(perAgent)} problems`);
      setFloodCards((cards) => cards.filter((_, ci) => ci % agents.length !== i));
      await sleep(360);
      setScore((s) => s + perAgent * POINTS_PER_PROBLEM);
      setAgentsHandled((n) => n + perAgent);
      doShake(i === agents.length - 1 ? 'shake-b' : 'shake-s');
      await sleep(760);
    }
    setSimStep(-1);
    setSimNote('');
    setFloodCards([]);
    await sleep(500);
    setGhostDead(true);
    await sleep(1400);
    setPhase('victory');
  };

  const replay = () => {
    setPhase('roleSelect');
    setRole(null); setIdx(0); setStack([]); stackRef.current = [];
    setScore(0); setHumanScore(0); setAgentsHandled(0); setAbsorbedNow(0);
    setChosen(null); setBestCalls(0); setFloodCards([]);
    setSimStep(-1); setSimNote(''); setGhostDead(false); setTarget(0);
  };

  /* ---------- shared bits ---------- */

  const isDark = phase === 'floodIntro' || phase === 'flood' || phase === 'simulate';
  const bg = phase === 'victory' ? 'bg-[#04301f]' : isDark ? 'bg-[#1a0303]' : 'bg-[#160b2e]';

  const Avatar = ({ r, size }) => (r.img
    ? <img src={r.img} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size, imageRendering: 'pixelated' }} draggable={false} />
    : <span style={{ fontSize: size * 0.72, lineHeight: 1 }}>{r.emoji}</span>);

  const ScoreBar = () => (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-black border-4 border-[#2ee6ff] shadow-[6px_6px_0_rgba(255,46,154,0.5)] px-5 py-3">
      <div className="flex items-center gap-3">
        <Avatar r={role} size={44} />
        <div>
          <div className="h-pixel text-[10px] text-[#ff2e9a]">{role.name}</div>
          <div className="txt-small text-[#8b8ba0]">{role.tagline}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="h-pixel text-2xl text-[#3bff5e] tabular-nums" style={{ textShadow: '3px 3px 0 #000' }} data-testid="score">
          {fmt(displayScore)}
        </div>
        <div className="h-pixel text-[9px] text-[#8b8ba0] mt-1">{role.metric}</div>
      </div>
    </div>
  );

  const StackBar = () => (stack.length > 0 ? (
    <div className="mt-4">
      <div className="h-pixel text-[10px] text-[#3bff5e] mb-2">YOUR AGENTFORCE STACK ({stack.length})</div>
      <div className="flex flex-wrap gap-2">
        {stack.map((a, i) => (
          <motion.div key={a.name + i} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 bg-black border-2 border-[#3bff5e] px-3 py-2">
            <span className="text-xl">{a.emoji}</span>
            <span className="txt-small text-[#7dfcd0]">{a.name}</span>
          </motion.div>
        ))}
      </div>
    </div>
  ) : null);

  /* ============================ RENDER ============================ */

  return (
    <div className={`min-h-screen w-full transition-colors duration-700 ${bg} ${shakeCls} relative overflow-hidden ${isDark ? 'scanlines-red' : ''}`}>
      <style>{`
        .h-pixel{font-family:'Press Start 2P',monospace;}
        .txt-body{font-family:'VT323',monospace;font-size:clamp(1.35rem,2.5vw,1.85rem);line-height:1.2;}
        .txt-choice{font-family:'VT323',monospace;font-size:clamp(1.3rem,2.2vw,1.6rem);line-height:1.2;}
        .txt-small{font-family:'VT323',monospace;font-size:1.3rem;line-height:1.2;}
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
        @media (prefers-reduced-motion: reduce){ .shake-s,.shake-b,.blink{animation:none} }
      `}</style>

      {/* ================= TITLE ================= */}
      {phase === 'title' && (
        <div className="fixed inset-0 z-20 bg-black flex items-center justify-center overflow-hidden">
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
            className="relative"
            style={{ width: 'min(100vw, calc(100vh * 2752 / 1536))', height: 'min(100vh, calc(100vw * 1536 / 2752))' }}>
            <img src={menuArt} alt="Who Broke the Business?" className="absolute inset-0 w-full h-full object-fill select-none" draggable={false} />
            <motion.button aria-label="Start game" onClick={() => setPhase('roleSelect')}
              animate={{ boxShadow: ['0 0 0px rgba(59,255,94,0)', '0 0 26px rgba(59,255,94,0.8)', '0 0 0px rgba(59,255,94,0)'] }}
              transition={{ repeat: Infinity, duration: 1.5 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              className="absolute cursor-pointer border-2 border-transparent hover:border-[#3bff5e] bg-transparent"
              style={{ left: '36.5%', top: '54.5%', width: '27%', height: '12%' }} />
            <motion.button aria-label="How to play" onClick={() => setHowTo(true)}
              whileHover={{ scale: 1.04, boxShadow: '0 0 22px rgba(46,230,255,0.7)' }} whileTap={{ scale: 0.96 }}
              className="absolute cursor-pointer border-2 border-transparent hover:border-[#2ee6ff] bg-transparent"
              style={{ left: '36.5%', top: '68%', width: '27%', height: '10.5%' }} />
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
                      ['1. PICK YOUR ROLE', 'Six seats, each with its own disasters. What breaks for a CMO is nothing like what breaks for a CFO.', '#2ee6ff'],
                      ['2. THE CHAOS BEGINS', 'Five real problems, one at a time. No timer — read it properly, then choose how you would actually handle it.', '#ff2e9a'],
                      ['3. LIVE WITH THE CONSEQUENCE', 'Every choice does something. Even the right call only buys time — the root cause is still there.', '#ffe600'],
                      ['4. UNLOCK AGENTFORCE', 'Each challenge unlocks the real Agentforce capability that fixes that problem for good. It joins your stack and keeps working.', '#3bff5e'],
                      ['5. SURVIVE THE FLOOD', 'The business scales and the problems multiply. Your stack scales with it. You do not.', '#ff5555'],
                    ].map(([h, body, color]) => (
                      <div key={h}>
                        <div className="h-pixel text-[11px]" style={{ color }}>{h}</div>
                        <div className="txt-body text-[#c9c9dd] mt-2">{body}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-7">
                    <button onClick={() => setHowTo(false)} className="btn-pixel flex-1 py-4 text-[10px] bg-black text-[#8b8ba0] border-[#8b8ba0]">BACK</button>
                    <button onClick={() => { setHowTo(false); setPhase('roleSelect'); }} className="btn-pixel flex-1 py-4 text-[10px] bg-black text-[#3bff5e] border-[#3bff5e]">► START GAME</button>
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
              Five disasters are waiting in every seat. Each one you survive unlocks a real Agentforce capability.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {ROLES.map((r, i) => (
              <motion.button key={r.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i }}
                whileHover={{ y: -6 }} whileTap={{ scale: 0.97 }} onClick={() => pickRole(r)}
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

      {/* ================= CHALLENGE ================= */}
      {phase === 'challenge' && challenge && (
        <div className="max-w-3xl mx-auto px-5 py-6 relative z-10">
          <ScoreBar />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-2 border-[#ff2e9a]/60 bg-[#1c0a30] px-4 py-3">
            <div className="h-pixel text-[10px] text-[#ff2e9a]">CHALLENGE {idx + 1} OF {TOTAL}</div>
            <div className="txt-small text-[#c9c9dd]">
              PROBLEMS THIS QUARTER: <span className="text-[#ff5555]">{fmt(volume)}</span>
              {stack.length > 0 && (
                <> · AGENTS HANDLED <span className="text-[#3bff5e]">{fmt(absorbedNow)}</span> · YOU SEE <span className="text-[#ffe600]">{fmt(youSee)}</span></>
              )}
            </div>
          </div>

          <motion.div key={idx} initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="mt-4 bg-black border-4 border-[#ffe600] shadow-[8px_8px_0_#000] p-6">
            <h2 className="h-pixel text-base md:text-2xl text-[#ffe600] leading-relaxed" style={{ textShadow: '3px 3px 0 #000' }} data-testid="headline">
              {challenge.headline}
            </h2>
            <div className="mt-5 space-y-2 read">
              {challenge.brief.map((line, i) => (
                <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }}
                  className="txt-body text-[#f2e8c9]">
                  {line}
                </motion.p>
              ))}
            </div>

            <div className="h-pixel text-[10px] text-[#8b8ba0] mt-6">WHAT DO YOU DO?</div>
            <div className="mt-3 flex flex-col gap-3">
              {challenge.choices.map((c, i) => (
                <motion.button key={c.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }} whileHover={{ x: 4 }} whileTap={{ scale: 0.99 }}
                  onClick={() => choose(c)} data-testid="choice"
                  className="text-left min-h-[56px] border-2 border-[#2ee6ff] hover:border-[#3bff5e] hover:bg-[#0e2a2a] bg-[#0d0d1f] px-4 py-3 flex items-center gap-3">
                  <span className="h-pixel text-[10px] text-[#3bff5e] shrink-0">▸</span>
                  <span className="txt-choice text-[#f2e8c9]">{c.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>

          <StackBar />
        </div>
      )}

      {/* ================= OUTCOME ================= */}
      {phase === 'outcome' && challenge && chosen && (
        <div className="max-w-3xl mx-auto px-5 py-6 relative z-10">
          <ScoreBar />
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className={`mt-4 bg-black border-4 shadow-[8px_8px_0_#000] p-6 ${
              chosen.quality === 'best' ? 'border-[#3bff5e]' : chosen.quality === 'ok' ? 'border-[#ffe600]' : 'border-[#ff2d2d]'}`}>
            <div className={`h-pixel text-[11px] leading-relaxed ${
              chosen.quality === 'best' ? 'text-[#3bff5e]' : chosen.quality === 'ok' ? 'text-[#ffe600]' : 'text-[#ff5555]'}`}>
              {chosen.quality === 'best' ? '✓ BEST AVAILABLE CALL' : chosen.quality === 'ok' ? '~ DEFENSIBLE, COSTLY' : '✗ THAT MADE IT WORSE'}
              {'  ·  +'}{CHOICE_POINTS[chosen.quality]}
            </div>
            <div className="txt-small text-[#8b8ba0] mt-4">YOU CHOSE</div>
            <div className="txt-body text-[#2ee6ff] read">{chosen.label}</div>
            <div className="txt-small text-[#8b8ba0] mt-5">WHAT HAPPENED</div>
            <div className="txt-body text-[#f2e8c9] read" data-testid="outcome">{chosen.outcome}</div>

            <div className="mt-6 border-2 border-[#ff2e9a] bg-[#25082f] p-4">
              <div className="h-pixel text-[10px] text-[#ff2e9a]">BUT…</div>
              <div className="txt-body text-[#f2e8c9] mt-2 read">{challenge.lesson}</div>
            </div>

            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setPhase('powerup')} data-testid="to-powerup"
              className="btn-pixel mt-6 w-full py-4 text-[11px] bg-black text-[#3bff5e] border-[#3bff5e]">
              ► SEE WHAT ACTUALLY FIXES THIS
            </motion.button>
          </motion.div>
          <StackBar />
        </div>
      )}

      {/* ================= POWER-UP ================= */}
      {phase === 'powerup' && challenge && (
        <div className="min-h-screen flex items-center justify-center px-4 py-8 relative z-10">
          {/* the art's own headline sits high in the frame — bias to its lower half so it reads as a scene, not a duplicate title */}
          <div className="absolute inset-0" style={{ backgroundImage: `url(${agentBgArt})`, backgroundSize: 'cover', backgroundPosition: 'center 78%' }} aria-hidden />
          <div className="absolute inset-0 bg-black/90" aria-hidden />
          <div className="relative max-w-2xl w-full text-center">
            <motion.div initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              className="inline-block bg-[#031a12] border-4 border-[#2ee6ff] px-7 py-4"
              style={{ boxShadow: '0 0 34px rgba(46,230,255,0.55), 0 0 70px rgba(59,255,94,0.25), 4px 4px 0 #000' }}>
              <div className="flex items-center gap-4">
                <img src={robotArt} alt="" className="h-16 border-2 border-[#2ee6ff]/40 select-none" draggable={false} />
                <motion.h2 animate={{ textShadow: ['0 0 8px #2ee6ff', '0 0 18px #3bff5e', '0 0 8px #2ee6ff'] }}
                  transition={{ repeat: Infinity, duration: 1.6 }}
                  className="h-pixel text-lg md:text-2xl leading-snug text-left" style={{ color: '#7dfcd0' }}>
                  AGENTFORCE{' '}<br />UNLOCKED
                </motion.h2>
              </div>
            </motion.div>

            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
              className="mt-6 bg-[#02100a] border-4 border-[#3bff5e] shadow-[6px_6px_0_#000] p-6 text-left">
              <div className="flex items-center gap-4">
                <span className="text-4xl bg-[#101024] border-2 border-[#3bff5e]/40 px-3 py-2">{challenge.powerup.emoji}</span>
                <h3 className="h-pixel text-sm md:text-base text-[#7dfcd0] leading-relaxed" data-testid="powerup-name">{challenge.powerup.name}</h3>
              </div>
              <div className="mt-5">
                <div className="h-pixel text-[10px] text-[#8b8ba0]">THE REAL CAPABILITY</div>
                <div className="txt-body text-[#f2e8c9] mt-1 read">{challenge.powerup.feature}</div>
              </div>
              <div className="mt-4">
                <div className="h-pixel text-[10px] text-[#8b8ba0]">WHAT IT NOW HANDLES FOR YOU</div>
                <div className="txt-body text-[#3bff5e] mt-1 read">{challenge.powerup.does}</div>
              </div>
              <div className="mt-4 border-l-4 border-[#ffe600] pl-3">
                <div className="txt-body text-[#ffe600] read">"{challenge.powerup.message}"</div>
              </div>
              <motion.button whileTap={{ scale: 0.98 }} onClick={deployAgent} data-testid="deploy"
                className="btn-pixel mt-6 w-full py-4 text-[11px] bg-[#3bff5e] text-black border-black">
                ► DEPLOY AGENT
              </motion.button>
              <div className="txt-small text-[#8b8ba0] mt-3 text-center">
                {idx === TOTAL - 1 ? 'Your stack is complete. The quarter is not over.' : 'It keeps working from now on — including while you sleep.'}
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* ================= FLOOD INTRO ================= */}
      {phase === 'floodIntro' && role && (
        <div className="min-h-screen flex items-center justify-center px-5 py-8 relative z-10">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl text-center">
            <div className="inline-block bg-[#ff2d2d] text-black h-pixel text-[10px] px-4 py-2 border-4 border-black blink">
              FINAL QUARTER · THE BUSINESS SCALES
            </div>
            <h2 className="h-pixel text-xl md:text-3xl text-[#ff2d2d] mt-6 leading-relaxed" style={{ textShadow: '4px 4px 0 #7a0000, 7px 7px 0 #000' }}>
              {fmt(FLOOD_VOLUME)} PROBLEMS AT ONCE
            </h2>
            <p className="txt-body text-[#f2e8c9] mt-5 read mx-auto">
              Growth arrived. Every problem you met this year is now arriving in parallel, all quarter, forever.
              There is no version of this you can click through.
            </p>
            <div className="mt-6 bg-[#2b0505] border-4 border-[#ff2d2d] shadow-[6px_6px_0_#000] p-5">
              <div className="h-pixel text-[10px] text-[#ff5555]">TARGET TO SURVIVE THE QUARTER</div>
              <div className="h-pixel text-2xl md:text-3xl text-[#ffe600] tabular-nums mt-3" style={{ textShadow: '3px 3px 0 #7a0000' }}>{fmt(target)}</div>
              <div className="txt-body text-[#c9c9dd] mt-3">Impossible by hand. You have five agents who never sleep.</div>
            </div>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setFloodCards([]); setPhase('flood'); }} data-testid="face-it"
              className="btn-pixel mt-6 bg-black text-[#ff2d2d] border-[#ff2d2d] text-sm px-10 py-4">► FACE IT</motion.button>
          </motion.div>
        </div>
      )}

      {/* ================= FLOOD + SIMULATE ================= */}
      {(phase === 'flood' || phase === 'simulate') && role && (
        <div className="min-h-screen relative z-10 px-5 py-6">
          <div className="max-w-3xl mx-auto"><ScoreBar /></div>

          {noHuman && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-[#ff2d2d] h-pixel text-[11px] px-5 py-3 border-4 border-[#ff2d2d]">
              NO HUMAN CAN TRIAGE THIS.
            </motion.div>
          )}
          {simNote && (
            <motion.div key={simNote} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-[#ffe600] txt-body px-5 py-3 border-4 border-[#ffe600] whitespace-nowrap">
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

          <div className="max-w-3xl mx-auto mt-6 text-center relative">
            {phase === 'flood' && (
              <>
                <div className="txt-body text-[#ff9d9d]">The queue is now {fmt(FLOOD_VOLUME)} deep and growing.</div>
                <motion.button animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
                  whileTap={{ scale: 0.95 }} onClick={runSimulate} data-testid="simulate"
                  className="btn-pixel mt-6 bg-black text-[#3bff5e] text-xl px-12 py-5 border-[#3bff5e]"
                  style={{ boxShadow: '0 0 30px rgba(59,255,94,0.5), 4px 4px 0 #000' }}>
                  ► SIMULATE
                </motion.button>
                <div className="txt-small text-[#8b8ba0] mt-4">
                  Or handle them yourself.{' '}
                  <button className="underline text-[#ff5555]" onClick={() => { setNoHuman(true); setTimeout(() => setNoHuman(false), 1500); doShake('shake-s'); }}>
                    Try that.
                  </button>
                </div>
              </>
            )}
            <div className="mt-8 flex flex-wrap gap-3 justify-center">
              {stack.map((a, i) => (
                <motion.div key={a.name + i} animate={{ scale: simStep === i ? 1.15 : 1 }}
                  className={`border-4 bg-black px-4 py-3 ${simStep === i ? 'border-[#ffe600]' : 'border-[#3bff5e]'}`}
                  style={simStep === i ? { boxShadow: '0 0 30px rgba(255,230,0,0.8)' } : undefined}>
                  <div className="text-2xl">{a.emoji}</div>
                  <div className="h-pixel text-[8px] text-[#7dfcd0] mt-2 leading-relaxed">{a.name}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= VICTORY ================= */}
      {phase === 'victory' && role && (
        <div className="max-w-3xl mx-auto px-5 py-10 relative z-10">
          <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
            {Array.from({ length: 48 }).map((_, i) => (
              <motion.div key={i} initial={{ y: '-10vh', x: `${(i * 71) % 100}vw`, rotate: 0, opacity: 1 }}
                animate={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 720, opacity: [1, 1, 0.6] }}
                transition={{ duration: 2.6 + (i % 10) * 0.25, delay: (i % 7) * 0.12, ease: 'easeIn' }}
                className="absolute w-2.5 h-2.5"
                style={{ backgroundColor: ['#2ee6ff', '#ffe600', '#3bff5e', '#ff2e9a', '#f2e8c9'][i % 5] }} />
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="flex justify-center"><Avatar r={role} size={80} /></div>
            <div className="h-pixel text-[11px] text-[#3bff5e] mt-4 blink">★ QUARTER SURVIVED ★</div>
            <h2 className="h-pixel text-lg md:text-2xl text-[#f2e8c9] mt-4 leading-relaxed" style={{ textShadow: '4px 4px 0 #3bff5e, 7px 7px 0 #000' }}>
              THE BUSINESS RUNS ITSELF NOW.
            </h2>
            <p className="txt-body text-[#2ee6ff] mt-4 read mx-auto">{role.victory}</p>

            <div className="mt-7 bg-black border-4 border-[#3bff5e] shadow-[8px_8px_0_#000] p-6 text-left">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <div className="h-pixel text-xl md:text-2xl text-[#3bff5e] tabular-nums" style={{ textShadow: '2px 2px 0 #000' }} data-testid="final-score">{fmt(score)}</div>
                  <div className="txt-small text-[#8b8ba0] mt-2">You, with the stack</div>
                </div>
                <div>
                  <div className={`h-pixel text-xl md:text-2xl tabular-nums ${ghostDead ? 'text-[#6b6b7a] line-through' : 'text-[#8b8ba0]'}`}>{fmt(displayGhost)}</div>
                  <div className="txt-small text-[#6b6b7a] mt-2">Manual Ops Inc. — you, without agents</div>
                </div>
              </div>

              <div className="mt-6 border-t-2 border-[#3bff5e]/30 pt-5 space-y-2">
                <div className="txt-body text-[#f2e8c9]">Problems you handled personally: <span className="text-[#ffe600]">{TOTAL}</span></div>
                <div className="txt-body text-[#f2e8c9]">Problems your agents handled: <span className="text-[#3bff5e]">{fmt(agentsHandled)}</span></div>
                <div className="txt-body text-[#c9c9dd]">
                  That is <span className="h-pixel text-base text-[#ffe600]">{Math.max(1, Math.round(score / Math.max(1, humanScore)))}×</span> the
                  business impact — and you never worked a weekend for it.
                </div>
              </div>

              <div className="mt-5 border-2 border-[#ffe600]/60 bg-[#151505] p-4">
                <div className="h-pixel text-[10px] text-[#ffe600]">OPERATOR GRADE</div>
                <div className="txt-body text-[#f2e8c9] mt-2">
                  You made <span className="text-[#3bff5e]">{bestCalls} of {TOTAL}</span> calls the way a good operator would.
                  {bestCalls === TOTAL ? ' Flawless quarter — and you still needed the agents.' : ' The agents covered the rest, every time, without being asked.'}
                </div>
              </div>

              <div className="mt-5">
                <div className="h-pixel text-[10px] text-[#3bff5e]">YOUR STACK</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {stack.map((a, i) => (
                    <div key={a.name + i} className="flex items-center gap-2 border-2 border-[#3bff5e] px-3 py-2">
                      <span className="text-lg">{a.emoji}</span>
                      <span className="txt-small text-[#7dfcd0]">{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="txt-body text-[#ffe600] mt-5">MISSION RESULT: {role.win}</div>
            </div>

            <motion.button whileTap={{ scale: 0.96 }} onClick={replay} data-testid="replay"
              className="btn-pixel mt-7 bg-black text-[#2ee6ff] border-[#2ee6ff] text-[11px] px-8 py-5">
              ↻ RUN IT BACK AS A DIFFERENT EXEC
            </motion.button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
