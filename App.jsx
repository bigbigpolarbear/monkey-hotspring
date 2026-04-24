import { useState, useEffect, useRef, useCallback } from "react";
import { getTeachers, getStudents, addStudentToDB, updateStudent, deleteStudent } from "./firebase";

/* ─── palette matched to original watercolor ─── */
const C = {
  water1: "#6cc4b8", water2: "#8fd4ca", water3: "#4db0a4", water4: "#3a9e92",
  snow1: "#f2f0f5", snow2: "#e4e0eb", snow3: "#d2cdd9",
  rock1: "#8b6352", rock2: "#6b4a3a", rock3: "#a3796a", rock4: "#553928",
  face: "#f5cdd0", cheek: "#e06060", nose: "#cc3333", noseDark: "#a82828",
  fur1: "#ede6dc", fur2: "#dbd2c4", fur3: "#c9bfae", fur4: "#b8ac98",
  accent: "#e06060", accentDark: "#c04545",
  bg: "#f5f0ea", card: "#fffdf8", text: "#3e2a1a", textLight: "#7a6050",
  gold: "#edb830", green: "#5caa5e",
};

/* ─── daily wordle words (kid-friendly 5-letter) ─── */
const WORDS = [
  "happy","smile","cloud","dream","light","music","dance","heart","beach","plant",
  "ocean","tiger","brave","candy","frost","jolly","magic","noble","peace","quiet",
  "river","sunny","toast","unity","vivid","water","youth","bliss","charm","crisp",
  "eagle","flame","grape","hover","ivory","juice","kneel","lemon","maple","novel",
  "olive","pearl","queen","robin","stone","train","ultra","voice","whale","zebra",
  "angel","bloom","crane","drift","earth","fairy","globe","honey","igloo","jewel",
  "lunar","marsh","night","orbit","piano","quest","ridge","steam","tulip",
  "valor","winds","yield","plaza","acorn","berry","coral","daisy",
  "elbow","flock","grain","haste","inlet","joker","kayak","lilac","mango","nurse",
  "oasis","patch","radar","salad","table","urban","vault","wheat","album","badge",
  "camel","delta","ember","flute","giant","hazel","index","jelly","koala","llama",
  "melon","north","otter","panda","quilt","raven","solar","tower","uncle","viper",
];
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getTodaysWord() {
  const d = new Date(); const day = Math.floor(d.getTime() / 86400000);
  return WORDS[day % WORDS.length].toUpperCase();
}

/* ─── SVG filter definitions (shared) ─── */
function WatercolorFilters() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        <filter id="watercolor" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
        </filter>
        <filter id="watercolorSoft" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
        <filter id="furTexture" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="5" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" />
        </filter>
        <filter id="rockTexture" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" />
        </filter>
        <filter id="glow">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="cheekGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.cheek} stopOpacity="0.7" />
          <stop offset="100%" stopColor={C.cheek} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* ─── IMPROVED MONKEY SVG ─── */
function MonkeySVG({ size = 120, mood = "happy", label, points, onClick, delay = 0, style = {}, selected, variant = 0 }) {
  const [bob, setBob] = useState(0);
  const [sway, setSway] = useState(0);
  const [blink, setBlink] = useState(false);
  const frameRef = useRef(0);
  const blinkTimer = useRef(null);

  useEffect(() => {
    let running = true;
    const t0 = performance.now() + delay * 1000;
    const speed1 = 0.8 + (variant % 5) * 0.15;
    const speed2 = 0.5 + (variant % 3) * 0.12;
    const animate = (now) => {
      if (!running) return;
      const t = (now - t0) / 1000;
      setBob(Math.sin(t * speed1) * 5 + Math.sin(t * 0.4) * 2);
      setSway(Math.sin(t * speed2 + 0.8) * 3.5);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    const doBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 120 + Math.random() * 80);
      blinkTimer.current = setTimeout(doBlink, 2500 + Math.random() * 4000);
    };
    blinkTimer.current = setTimeout(doBlink, 800 + Math.random() * 3000);
    return () => { running = false; cancelAnimationFrame(frameRef.current); clearTimeout(blinkTimer.current); };
  }, [delay, variant]);

  const seed = variant * 137.5;
  const headTufts = Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2;
    const baseR = 30;
    const r = baseR + Math.sin(seed + i * 2.3) * 5;
    return { x: Math.cos(angle) * r, y: -18 + Math.sin(angle) * (r * 0.88), r: 5.5 + Math.sin(seed + i * 1.7) * 2.5, shade: i % 3 };
  });
  const bodyTufts = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2;
    const baseR = 36;
    const r = baseR + Math.sin(seed + i * 3.1) * 4;
    return { x: Math.cos(angle) * r, y: 16 + Math.sin(angle) * (r * 0.78), r: 6 + Math.sin(seed + i * 2.1) * 3, shade: i % 3 };
  });
  const furColors = [C.fur1, C.fur2, C.fur3];

  return (
    <div onClick={onClick} style={{
      cursor: onClick ? "pointer" : "default",
      transform: `translateY(${bob}px) rotate(${sway * 0.25}deg)`,
      filter: selected ? `drop-shadow(0 0 14px ${C.gold})` : "none",
      transition: "filter 0.3s", position: "relative", ...style,
    }}>
      <svg width={size} height={size * 1.15} viewBox="-60 -62 120 135" style={{ overflow: "visible" }}>
        <g filter="url(#furTexture)">
          {bodyTufts.map((t, i) => (
            <ellipse key={`bt${i}`} cx={t.x} cy={t.y} rx={t.r} ry={t.r * 0.85} fill={furColors[t.shade]} opacity={0.7 + (i % 2) * 0.15} />
          ))}
          <ellipse cx="0" cy="18" rx="32" ry="26" fill={C.fur1} />
          <ellipse cx="-6" cy="14" rx="18" ry="16" fill={C.fur2} opacity="0.3" />
          <ellipse cx="8" cy="20" rx="14" ry="12" fill="white" opacity="0.1" />
        </g>
        <g filter="url(#furTexture)">
          {headTufts.map((t, i) => (
            <ellipse key={`ht${i}`} cx={t.x} cy={t.y} rx={t.r} ry={t.r * 0.9} fill={furColors[t.shade]} opacity={0.65 + (i % 2) * 0.2} />
          ))}
          {Array.from({ length: 8 }, (_, i) => {
            const a = ((i / 8) * Math.PI) - Math.PI;
            const r = 28 + Math.sin(seed + i * 4) * 4;
            return <ellipse key={`cr${i}`} cx={Math.cos(a) * r * 0.7} cy={-42 + Math.sin(a) * 6} rx={7 + Math.sin(seed + i) * 2} ry={6} fill={i % 2 ? C.fur3 : C.fur2} opacity="0.6" />;
          })}
          <ellipse cx="0" cy="-18" rx="27" ry="25" fill={C.fur1} />
          <ellipse cx="-4" cy="-22" rx="14" ry="12" fill="white" opacity="0.08" />
        </g>
        <ellipse cx="-26" cy="-25" rx="8" ry="7" fill={C.fur2} filter="url(#watercolorSoft)" />
        <ellipse cx="-26" cy="-25" rx="5" ry="4.5" fill={C.face} opacity="0.6" />
        <ellipse cx="26" cy="-25" rx="8" ry="7" fill={C.fur2} filter="url(#watercolorSoft)" />
        <ellipse cx="26" cy="-25" rx="5" ry="4.5" fill={C.face} opacity="0.6" />
        <ellipse cx="0" cy="-14" rx="20" ry="18.5" fill={C.face} filter="url(#watercolorSoft)" />
        <ellipse cx="0" cy="-8" rx="16" ry="10" fill={C.cheek} opacity="0.06" />
        <circle cx="-12" cy="-5" r="7" fill="url(#cheekGrad)" />
        <circle cx="12" cy="-5" r="7" fill="url(#cheekGrad)" />
        {blink ? (
          <>
            <path d="M -11 -16 Q -8 -14 -5 -16" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 -16 Q 8 -14 11 -16" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="-8" cy="-16" rx="4.5" ry="4" fill="white" opacity="0.9" />
            <ellipse cx="8" cy="-16" rx="4.5" ry="4" fill="white" opacity="0.9" />
            <circle cx="-7.5" cy="-15.5" r="2.8" fill={C.text} />
            <circle cx="8.5" cy="-15.5" r="2.8" fill={C.text} />
            <circle cx="-6.5" cy="-16.8" r="1.1" fill="white" />
            <circle cx="9.5" cy="-16.8" r="1.1" fill="white" />
            <circle cx="-8" cy="-14.5" r="0.6" fill="white" opacity="0.6" />
            <circle cx="8" cy="-14.5" r="0.6" fill="white" opacity="0.6" />
          </>
        )}
        <ellipse cx="0" cy="-8" rx="4" ry="3" fill={C.nose} />
        <ellipse cx="0" cy="-8.5" rx="3" ry="2" fill={C.noseDark} opacity="0.3" />
        <ellipse cx="-1.5" cy="-7.5" rx="1" ry="0.7" fill={C.noseDark} opacity="0.5" />
        <ellipse cx="1.5" cy="-7.5" rx="1" ry="0.7" fill={C.noseDark} opacity="0.5" />
        <ellipse cx="-0.5" cy="-9.5" rx="1.5" ry="0.8" fill="white" opacity="0.3" />
        {mood === "excited" ? (
          <path d="M -6 -2 Q 0 6 6 -2" fill={C.noseDark} opacity="0.3" stroke={C.text} strokeWidth="1.2" strokeLinecap="round" />
        ) : mood === "happy" ? (
          <path d="M -5 -2 Q 0 4 5 -2" fill="none" stroke={C.text} strokeWidth="1.3" strokeLinecap="round" />
        ) : (
          <path d="M -3.5 0 Q 0 1 3.5 0" fill="none" stroke={C.text} strokeWidth="1.2" strokeLinecap="round" />
        )}
        <ellipse cx="-28" cy="22" rx="10" ry="5" fill={C.fur2} opacity="0.7" filter="url(#watercolorSoft)" />
        <ellipse cx="28" cy="22" rx="10" ry="5" fill={C.fur2} opacity="0.7" filter="url(#watercolorSoft)" />
        <ellipse cx="-32" cy="22" rx="4" ry="3.5" fill={C.face} opacity="0.5" />
        <ellipse cx="32" cy="22" rx="4" ry="3.5" fill={C.face} opacity="0.5" />
        <ellipse cx="0" cy="30" rx="46" ry="10" fill={C.water1} opacity="0.55" />
        <ellipse cx="-8" cy="28" rx="20" ry="4" fill="white" opacity="0.12" />
        <ellipse cx="0" cy="35" rx="50" ry="14" fill={C.water2} opacity="0.35" />
        <ellipse cx="-20" cy="26" rx="8" ry="2" fill="white" opacity="0.15" />
        <ellipse cx="18" cy="27" rx="6" ry="1.5" fill="white" opacity="0.12" />
      </svg>
      {label && (
        <div style={{
          textAlign: "center", marginTop: -10, fontFamily: "'Patrick Hand', cursive",
          fontSize: 14, color: C.text, fontWeight: 700,
          textShadow: "0 1px 3px rgba(255,255,255,0.9), 0 0 8px rgba(255,255,255,0.6)",
          maxWidth: size + 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "0 auto",
        }}>{label}</div>
      )}
      {points !== undefined && (
        <div style={{
          textAlign: "center", marginTop: 2, fontFamily: "'Patrick Hand', cursive",
          fontSize: 18, color: C.gold, fontWeight: 700,
          textShadow: "0 1px 4px rgba(0,0,0,0.2), 0 0 8px rgba(237,184,48,0.3)",
        }}>★ {points}</div>
      )}
    </div>
  );
}

/* ─── STEAM ─── */
function SteamParticles({ count = 15 }) {
  const [particles] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i, left: 10 + Math.random() * 80, delay: Math.random() * 6,
      dur: 4 + Math.random() * 5, size: 20 + Math.random() * 40,
      opacity: 0.08 + Math.random() * 0.12, drift: -20 + Math.random() * 40,
    }))
  );
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 8, overflow: "hidden" }}>
      <style>{`@keyframes steamRise { 0% { transform: translateY(0) translateX(0) scale(0.5); opacity: 0; } 20% { opacity: var(--steam-op); } 80% { opacity: var(--steam-op); } 100% { transform: translateY(-200px) translateX(var(--drift)) scale(1.8); opacity: 0; } }`}</style>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: `${p.left}%`, bottom: "20%",
          width: p.size, height: p.size, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(255,255,255,${p.opacity}) 0%, transparent 70%)`,
          "--steam-op": p.opacity, "--drift": `${p.drift}px`,
          animation: `steamRise ${p.dur}s ${p.delay}s ease-out infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── SNOW ─── */
function SnowParticles() {
  const [flakes] = useState(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i, left: Math.random() * 100, delay: Math.random() * 10,
      dur: 7 + Math.random() * 8, size: 2 + Math.random() * 5,
      opacity: 0.25 + Math.random() * 0.45, wobble: Math.random() * 30,
    }))
  );
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 999, overflow: "hidden" }}>
      <style>{`@keyframes snowfall { 0% { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 0; } 10% { opacity: var(--flake-op); } 50% { transform: translateY(50vh) translateX(var(--wobble)) rotate(180deg); } 90% { opacity: var(--flake-op); } 100% { transform: translateY(105vh) translateX(calc(var(--wobble) * -1)) rotate(360deg); opacity: 0; } }`}</style>
      {flakes.map(f => (
        <div key={f.id} style={{
          position: "absolute", left: `${f.left}%`, top: -20,
          width: f.size, height: f.size, borderRadius: "50%",
          background: `radial-gradient(circle, white 30%, rgba(255,255,255,0.3))`,
          "--flake-op": f.opacity, "--wobble": `${f.wobble}px`,
          animation: `snowfall ${f.dur}s ${f.delay}s linear infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── WATER CANVAS ─── */
function WaterCanvas({ width, height }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let frame;
    const ripples = Array.from({ length: 12 }, () => ({
      x: Math.random() * width, y: Math.random() * height,
      r: 15 + Math.random() * 50, speed: 0.2 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2, thickness: 1 + Math.random() * 1.5,
    }));
    const draw = (now) => {
      const t = now / 1000;
      ctx.clearRect(0, 0, width, height);
      const g = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width * 0.6);
      g.addColorStop(0, C.water2); g.addColorStop(0.5, C.water1); g.addColorStop(1, C.water4);
      ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 6; i++) {
        const px = width * (0.15 + (i * 0.14)), py = height * (0.3 + Math.sin(i * 1.5) * 0.2), pr = 40 + i * 15;
        const pg = ctx.createRadialGradient(px, py, 0, px, py, pr);
        pg.addColorStop(0, `rgba(${i % 2 ? '140,210,200' : '100,195,185'},0.15)`); pg.addColorStop(1, 'transparent');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(px, py, pr, pr * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      }
      ripples.forEach(rip => {
        const r = rip.r + Math.sin(t * rip.speed + rip.phase) * 12;
        const alpha = 0.06 + Math.sin(t * rip.speed * 0.5 + rip.phase) * 0.04;
        ctx.beginPath(); ctx.ellipse(rip.x + Math.sin(t * 0.3 + rip.phase) * 5, rip.y, r, r * 0.35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = rip.thickness; ctx.stroke();
      });
      for (let i = 0; i < 7; i++) {
        const y = height * 0.1 + (height * 0.8) * (i / 7) + Math.sin(t * 0.6 + i * 0.8) * 6;
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x <= width; x += 8) ctx.lineTo(x, y + Math.sin(t * 0.9 + x * 0.015 + i * 1.2) * 3);
        ctx.strokeStyle = `rgba(255,255,255,${0.04 + Math.sin(t * 0.5 + i) * 0.025})`; ctx.lineWidth = 1 + Math.sin(i) * 0.5; ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const sx = (width * 0.2) + Math.sin(t * 0.4 + i * 2.5) * width * 0.3;
        const sy = (height * 0.3) + Math.cos(t * 0.3 + i * 1.8) * height * 0.2;
        const sa = Math.max(0, Math.sin(t * 2 + i * 3) * 0.3);
        if (sa > 0.05) { ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${sa})`; ctx.fill(); }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, borderRadius: 20 }} />;
}

/* ─── BACKGROUND SCENE ─── */
function BackgroundScene({ w, h }) {
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8e4ef" /><stop offset="60%" stopColor="#ddd8e4" /><stop offset="100%" stopColor={C.snow3} />
        </linearGradient>
        <linearGradient id="mtnGrad1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.snow1} /><stop offset="70%" stopColor={C.rock3} /><stop offset="100%" stopColor={C.rock1} />
        </linearGradient>
        <linearGradient id="mtnGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.snow2} /><stop offset="50%" stopColor={C.snow3} /><stop offset="100%" stopColor={C.rock3} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#skyGrad)" />
      <path d={`M0 ${h*0.35} Q${w*0.1} ${h*0.15} ${w*0.2} ${h*0.25} Q${w*0.3} ${h*0.12} ${w*0.42} ${h*0.28} Q${w*0.5} ${h*0.08} ${w*0.62} ${h*0.22} Q${w*0.75} ${h*0.1} ${w*0.85} ${h*0.2} Q${w*0.95} ${h*0.15} ${w} ${h*0.3} L${w} ${h*0.45} L0 ${h*0.45} Z`}
        fill="url(#mtnGrad2)" opacity="0.6" filter="url(#watercolor)" />
      <path d={`M0 ${h*0.28} Q${w*0.08} ${h*0.18} ${w*0.15} ${h*0.22} L${w*0.2} ${h*0.45} L0 ${h*0.45} Z`} fill="url(#mtnGrad1)" filter="url(#rockTexture)" />
      <path d={`M0 ${h*0.2} Q${w*0.05} ${h*0.14} ${w*0.12} ${h*0.18} L${w*0.15} ${h*0.22} L0 ${h*0.28} Z`} fill={C.snow1} opacity="0.9" filter="url(#watercolorSoft)" />
      <path d={`M${w*0.8} ${h*0.2} Q${w*0.88} ${h*0.12} ${w} ${h*0.18} L${w} ${h*0.48} L${w*0.75} ${h*0.48} Z`} fill="url(#mtnGrad1)" filter="url(#rockTexture)" />
      <path d={`M${w*0.82} ${h*0.15} Q${w*0.9} ${h*0.08} ${w} ${h*0.12} L${w} ${h*0.2} L${w*0.8} ${h*0.22} Z`} fill={C.snow1} opacity="0.9" filter="url(#watercolorSoft)" />
      {[
        { x: w*0.02, y: h*0.38, rw: 140, rh: 90, c: C.rock1 },
        { x: w*0.85, y: h*0.35, rw: 160, rh: 100, c: C.rock2 },
        { x: w*0.4, y: h*0.3, rw: 100, rh: 60, c: C.rock3 },
        { x: w*0.6, y: h*0.28, rw: 80, rh: 50, c: C.rock1 },
        { x: -20, y: h*0.55, rw: 110, rh: 100, c: C.rock2 },
        { x: w*0.88, y: h*0.58, rw: 130, rh: 110, c: C.rock4 },
        { x: w*0.3, y: h*0.82, rw: 90, rh: 65, c: C.rock3 },
        { x: w*0.65, y: h*0.85, rw: 100, rh: 55, c: C.rock1 },
      ].map((r, i) => (
        <g key={i} filter="url(#rockTexture)">
          <ellipse cx={r.x + r.rw/2} cy={r.y + r.rh/2} rx={r.rw/2} ry={r.rh/2} fill={r.c} />
          {r.y < h * 0.5 && <ellipse cx={r.x + r.rw/2} cy={r.y + r.rh*0.15} rx={r.rw*0.45} ry={r.rh*0.22} fill={C.snow1} opacity="0.85" filter="url(#watercolorSoft)" />}
          <ellipse cx={r.x + r.rw*0.35} cy={r.y + r.rh*0.35} rx={r.rw*0.2} ry={r.rh*0.15} fill="white" opacity="0.06" />
        </g>
      ))}
      {[{ x: w*0.03, y: h*0.52, s: 1 }, { x: w*0.93, y: h*0.55, s: 0.9 }, { x: w*0.88, y: h*0.78, s: 0.7 }, { x: w*0.08, y: h*0.8, s: 0.6 }].map((tree, i) => (
        <g key={i} transform={`translate(${tree.x},${tree.y}) scale(${tree.s})`} opacity="0.6" filter="url(#watercolorSoft)">
          <line x1="0" y1="0" x2="0" y2="-50" stroke={C.rock2} strokeWidth="3" strokeLinecap="round" />
          <line x1="0" y1="-20" x2="-18" y2="-38" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="-28" x2="15" y2="-45" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="0" y1="-35" x2="-10" y2="-48" stroke={C.rock2} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="-18" y1="-38" x2="-25" y2="-44" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="15" y1="-45" x2="22" y2="-52" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/* ─── WORDLE GAME ─── */
function WordleGame({ onWin, onClose }) {
  const answer = getTodaysWord();
  const [guesses, setGuesses] = useState([]);
  const [current, setCurrent] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState("");
  const maxGuesses = 6;

  const getLetterStates = (guess) => {
    const result = Array(5).fill("absent");
    const ansArr = answer.split("");
    const used = Array(5).fill(false);
    for (let i = 0; i < 5; i++) {
      if (guess[i] === ansArr[i]) { result[i] = "correct"; used[i] = true; }
    }
    for (let i = 0; i < 5; i++) {
      if (result[i] === "correct") continue;
      for (let j = 0; j < 5; j++) {
        if (!used[j] && guess[i] === ansArr[j]) { result[i] = "present"; used[j] = true; break; }
      }
    }
    return result;
  };

  const keyboardColors = {};
  guesses.forEach(g => {
    const states = getLetterStates(g);
    g.split("").forEach((l, i) => {
      const s = states[i];
      const cur = keyboardColors[l];
      if (s === "correct") keyboardColors[l] = "correct";
      else if (s === "present" && cur !== "correct") keyboardColors[l] = "present";
      else if (!cur) keyboardColors[l] = "absent";
    });
  });

  const submit = () => {
    if (current.length !== 5) { setShake(true); setTimeout(() => setShake(false), 500); return; }
    const g = current.toUpperCase();
    const newGuesses = [...guesses, g];
    setGuesses(newGuesses);
    setCurrent("");
    if (g === answer) {
      setWon(true); setGameOver(true); setMessage("You got it! +1 point!");
      setTimeout(() => onWin(), 1500);
    } else if (newGuesses.length >= maxGuesses) {
      setGameOver(true); setMessage(`The word was ${answer}`);
    }
  };

  const handleKey = (key) => {
    if (gameOver) return;
    if (key === "ENTER") return submit();
    if (key === "DEL") return setCurrent(c => c.slice(0, -1));
    if (current.length < 5 && /^[A-Z]$/.test(key)) setCurrent(c => c + key);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("DEL");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const tileColor = { correct: C.green, present: C.gold, absent: "#8a8a8a" };
  const kbRows = [["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L"],["ENTER","Z","X","C","V","B","N","M","DEL"]];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !gameOver) onClose(); }}>
      <div style={{
        background: C.card, borderRadius: 24, padding: "28px 32px", width: 420, maxWidth: "95vw",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)", border: `2px solid ${C.gold}30`,
        fontFamily: "'Patrick Hand', cursive",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: C.text, fontSize: 24 }}>🐵 Daily Challenge</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>
        <p style={{ color: C.textLight, fontSize: 14, margin: "0 0 16px", textAlign: "center" }}>Guess the 5-letter word! Solve it for +1 point</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center", marginBottom: 16 }}>
          {Array.from({ length: maxGuesses }, (_, row) => {
            const guess = guesses[row];
            const isCurrentRow = row === guesses.length && !gameOver;
            const states = guess ? getLetterStates(guess) : null;
            return (
              <div key={row} style={{ display: "flex", gap: 6, animation: isCurrentRow && shake ? "shakeRow 0.4s ease" : "none" }}>
                <style>{`@keyframes shakeRow { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
                {Array.from({ length: 5 }, (_, col) => {
                  const letter = guess ? guess[col] : (isCurrentRow ? (current[col] || "") : "");
                  const bg = states ? tileColor[states[col]] : (letter ? `${C.fur2}40` : `${C.snow1}`);
                  const textCol = states ? "white" : C.text;
                  const filled = !!letter;
                  return (
                    <div key={col} style={{
                      width: 52, height: 52, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 10, background: bg, border: `2px solid ${states ? bg : (filled ? C.fur3 : `${C.fur2}30`)}`,
                      fontSize: 24, fontWeight: 700, color: textCol, fontFamily: "'Patrick Hand', cursive",
                      transition: "background 0.3s, border 0.3s",
                      transform: filled && !states ? "scale(1.05)" : "scale(1)",
                    }}>
                      {letter}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {message && (
          <div style={{
            textAlign: "center", padding: "10px 16px", borderRadius: 12, marginBottom: 12,
            background: won ? `${C.green}15` : `${C.accent}15`,
            color: won ? C.green : C.accent, fontSize: 18, fontWeight: 700,
          }}>
            {won && "🎉 "}{message}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
          {kbRows.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: 4 }}>
              {row.map(key => {
                const kc = keyboardColors[key];
                const bg = kc ? tileColor[kc] : `${C.snow2}`;
                const tc = kc ? "white" : C.text;
                const isWide = key === "ENTER" || key === "DEL";
                return (
                  <button key={key} onClick={() => handleKey(key)}
                    style={{
                      width: isWide ? 58 : 34, height: 42, borderRadius: 8, border: "none",
                      background: bg, color: tc, fontSize: isWide ? 11 : 16, fontWeight: 700,
                      fontFamily: "'Patrick Hand', cursive", cursor: gameOver ? "default" : "pointer",
                      transition: "background 0.2s", opacity: gameOver ? 0.6 : 1,
                    }}>
                    {key}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP — uses Firebase Firestore for all data persistence
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("login");
  const [loginTab, setLoginTab] = useState("teacher");
  const [user, setUser] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentUser, setNewStudentUser] = useState("");
  const [newStudentPass, setNewStudentPass] = useState("");
  const [pointAmount, setPointAmount] = useState(1);
  const [notification, setNotification] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [showWordle, setShowWordle] = useState(false);

  // Load from Firebase on mount
  useEffect(() => {
    (async () => {
      try {
        const t = await getTeachers();
        const s = await getStudents();
        setTeachers(t);
        setStudents(s);
      } catch (err) {
        console.error("Firebase load error:", err);
      }
      setLoading(false);
    })();
  }, []);

  // Refresh students from Firebase
  const refreshStudents = async () => {
    const s = await getStudents();
    setStudents(s);
  };

  const notify = (msg, type = "success") => {
    setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500);
  };

  const handleLogin = () => {
    setLoginError("");
    if (loginTab === "teacher") {
      const t = teachers.find(t => t.username === username && t.password === password);
      if (t) { setUser(t); setScreen("teacher"); setUsername(""); setPassword(""); }
      else setLoginError("Invalid teacher credentials");
    } else {
      const s = students.find(s => s.username === username && s.password === password);
      if (s) { setUser(s); setScreen("student"); setUsername(""); setPassword(""); }
      else setLoginError("Invalid student credentials");
    }
  };

  const addStudentHandler = async () => {
    if (!newStudentName.trim() || !newStudentUser.trim() || !newStudentPass.trim()) { notify("Please fill in all fields", "error"); return; }
    if (students.find(s => s.username === newStudentUser) || teachers.find(t => t.username === newStudentUser)) { notify("Username already taken", "error"); return; }
    try {
      await addStudentToDB({
        username: newStudentUser.trim(),
        password: newStudentPass.trim(),
        name: newStudentName.trim(),
        points: 0,
        lastChallengeDate: "",
      });
      await refreshStudents();
      setNewStudentName(""); setNewStudentUser(""); setNewStudentPass(""); setShowAddStudent(false);
      notify(`${newStudentName.trim()} joined the hot spring!`);
    } catch (err) {
      notify("Error adding student", "error");
      console.error(err);
    }
  };

  const removeStudentHandler = async (id) => {
    try {
      await deleteStudent(id);
      await refreshStudents();
      if (selectedStudent === id) setSelectedStudent(null);
      notify("Student removed");
    } catch (err) {
      notify("Error removing student", "error");
    }
  };

  const addPoints = async (id, amount) => {
    const st = students.find(s => s.id === id);
    if (!st) return;
    const newPts = Math.max(0, st.points + amount);
    try {
      await updateStudent(id, { points: newPts });
      await refreshStudents();
      notify(`${amount > 0 ? "+" : ""}${amount} point${Math.abs(amount) !== 1 ? "s" : ""} for ${st.name}!`);
    } catch (err) {
      notify("Error updating points", "error");
    }
  };

  const logout = () => { setUser(null); setScreen("login"); setSelectedStudent(null); setShowManage(false); setShowAddStudent(false); setShowWordle(false); };

  const todayKey = getTodayKey();
  const hasCompletedChallenge = (studentId) => {
    const s = students.find(st => st.id === studentId);
    return s?.lastChallengeDate === todayKey;
  };

  const handleWordleWin = async () => {
    if (!user || hasCompletedChallenge(user.id)) return;
    const st = students.find(s => s.id === user.id);
    if (!st) return;
    try {
      await updateStudent(user.id, { points: st.points + 1, lastChallengeDate: todayKey });
      await refreshStudents();
      setShowWordle(false);
      notify("🎉 Challenge complete! +1 point!");
    } catch (err) {
      notify("Error awarding point", "error");
    }
  };

  const monkeyPositions = [
    { left: "6%", top: "12%" }, { left: "24%", top: "5%" }, { left: "44%", top: "16%" },
    { left: "64%", top: "6%" }, { left: "80%", top: "14%" }, { left: "12%", top: "40%" },
    { left: "35%", top: "48%" }, { left: "55%", top: "42%" }, { left: "74%", top: "50%" },
    { left: "48%", top: "30%" }, { left: "28%", top: "28%" }, { left: "66%", top: "30%" },
    { left: "8%", top: "58%" }, { left: "84%", top: "40%" }, { left: "46%", top: "58%" },
  ];

  const inputStyle = {
    padding: "14px 18px", borderRadius: 14, border: `2px solid ${C.fur2}50`,
    background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive",
    fontSize: 18, color: C.text, outline: "none", width: "100%", boxSizing: "border-box",
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: "'Patrick Hand', cursive" }}>
      <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
      <WatercolorFilters />
      <div style={{ textAlign: "center" }}><MonkeySVG size={100} mood="happy" delay={0} /><p style={{ fontSize: 22, color: C.text, marginTop: 12 }}>Warming up the hot spring...</p></div>
    </div>
  );

  /* ── LOGIN ── */
  if (screen === "login") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${C.snow1} 0%, ${C.bg} 40%, #e2d0c0 100%)`, fontFamily: "'Patrick Hand', cursive", position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
        <WatercolorFilters /><SnowParticles />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: `linear-gradient(to top, ${C.water1}30, transparent)`, borderRadius: "50% 50% 0 0" }} />
        <div style={{ position: "absolute", left: "4%", bottom: "8%", opacity: 0.5 }}><MonkeySVG size={90} mood="happy" delay={0} variant={1} /></div>
        <div style={{ position: "absolute", right: "6%", bottom: "12%", opacity: 0.5 }}><MonkeySVG size={75} mood="excited" delay={1.2} variant={2} /></div>
        <div style={{ position: "absolute", left: "20%", top: "8%", opacity: 0.3 }}><MonkeySVG size={55} mood="neutral" delay={2.5} variant={3} /></div>

        <div style={{ background: `${C.card}ee`, borderRadius: 28, padding: "44px 52px", boxShadow: "0 24px 64px rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.05)", maxWidth: 430, width: "90%", position: "relative", zIndex: 10, border: `2px solid ${C.fur2}30` }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 52, marginBottom: 4 }}>♨️</div>
            <h1 style={{ fontSize: 34, color: C.text, margin: "0 0 4px", fontWeight: 700 }}>Monkey Hot Spring</h1>
            <p style={{ color: C.textLight, fontSize: 17, margin: 0 }}>Student Point Tracker</p>
          </div>
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderRadius: 14, overflow: "hidden", border: `2px solid ${C.accent}30` }}>
            {["teacher", "student"].map(tab => (
              <button key={tab} onClick={() => { setLoginTab(tab); setLoginError(""); }}
                style={{ flex: 1, padding: "13px 0", border: "none", cursor: "pointer", background: loginTab === tab ? `linear-gradient(135deg, ${C.accent}, ${C.accentDark})` : "transparent", color: loginTab === tab ? "white" : C.text, fontFamily: "'Patrick Hand', cursive", fontSize: 18, fontWeight: 600, transition: "all 0.3s" }}>
                {tab === "teacher" ? "🍎 Teacher" : "🐵 Student"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" onKeyDown={e => e.key === "Enter" && handleLogin()} style={inputStyle} />
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" onKeyDown={e => e.key === "Enter" && handleLogin()} style={inputStyle} />
            {loginError && <p style={{ color: C.accentDark, fontSize: 15, margin: 0, textAlign: "center" }}>{loginError}</p>}
            <button onClick={handleLogin}
              style={{ padding: "15px", borderRadius: 14, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, color: "white", fontFamily: "'Patrick Hand', cursive", fontSize: 21, fontWeight: 700, boxShadow: `0 6px 16px ${C.accent}50`, transition: "transform 0.2s", marginTop: 4 }}
              onMouseEnter={e => e.target.style.transform = "translateY(-2px)"} onMouseLeave={e => e.target.style.transform = "translateY(0)"}>
              Enter the Hot Spring →
            </button>
          </div>
          <p style={{ textAlign: "center", color: C.textLight, fontSize: 13, marginTop: 18, marginBottom: 0 }}>
            {loginTab === "teacher" ? "Default: teacher / 1234" : "Ask your teacher for login details"}
          </p>
        </div>
      </div>
    );
  }

  /* ── TEACHER ── */
  if (screen === "teacher") {
    const sel = students.find(s => s.id === selectedStudent);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Patrick Hand', cursive", position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
        <WatercolorFilters /><SnowParticles />
        {notification && (
          <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: notification.type === "error" ? C.accentDark : C.green, color: "white", padding: "14px 32px", borderRadius: 18, fontSize: 19, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", animation: "notifIn 0.35s ease" }}>
            <style>{`@keyframes notifIn { from { opacity:0; transform:translateX(-50%) translateY(-16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
            {notification.msg}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", position: "relative", zIndex: 20, background: `${C.card}cc`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.fur2}20` }}>
          <div>
            <h1 style={{ fontSize: 26, color: C.text, margin: 0 }}>♨️ Monkey Hot Spring</h1>
            <p style={{ color: C.textLight, margin: 0, fontSize: 14 }}>Welcome, {user?.name}! · {students.length} student{students.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "📋 Manage", active: showManage, fn: () => { setShowManage(!showManage); setShowAddStudent(false); }, c: C.accent },
              { label: "➕ Add", active: showAddStudent, fn: () => { setShowAddStudent(!showAddStudent); setShowManage(false); }, c: C.green },
              { label: "🚪 Logout", active: false, fn: logout, c: C.textLight },
            ].map((b, i) => (
              <button key={i} onClick={b.fn} style={{ padding: "9px 18px", borderRadius: 12, border: `2px solid ${b.c}30`, background: b.active ? b.c : `${C.card}dd`, color: b.active ? "white" : C.text, fontFamily: "'Patrick Hand', cursive", fontSize: 15, cursor: "pointer", transition: "all 0.3s", fontWeight: 600 }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {showAddStudent && (
          <div style={{ position: "absolute", top: 72, right: 28, zIndex: 30, background: C.card, borderRadius: 22, padding: 28, width: 310, boxShadow: "0 16px 48px rgba(0,0,0,0.15)", border: `2px solid ${C.green}30` }}>
            <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 22 }}>New Student</h3>
            {[{ val: newStudentName, set: setNewStudentName, ph: "Display Name" }, { val: newStudentUser, set: setNewStudentUser, ph: "Username" }, { val: newStudentPass, set: setNewStudentPass, ph: "Password", type: "password" }].map((f, i) => (
              <input key={i} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} type={f.type || "text"} style={{ ...inputStyle, marginBottom: 10 }} />
            ))}
            <button onClick={addStudentHandler} style={{ width: "100%", padding: 13, borderRadius: 14, border: "none", background: C.green, color: "white", fontFamily: "'Patrick Hand', cursive", fontSize: 18, cursor: "pointer", fontWeight: 700, marginTop: 4 }}>Add to Hot Spring!</button>
          </div>
        )}
        {showManage && (
          <div style={{ position: "absolute", top: 72, right: 28, zIndex: 30, background: C.card, borderRadius: 22, padding: 24, width: 350, boxShadow: "0 16px 48px rgba(0,0,0,0.15)", border: `2px solid ${C.accent}30`, maxHeight: "70vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: C.text, fontSize: 22 }}>Student List</h3>
            {students.length === 0 && <p style={{ color: C.textLight }}>No students yet!</p>}
            {students.map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 14, background: `${C.snow1}80`, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 16, color: C.text, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: C.textLight }}>@{s.username} · ★ {s.points} pts</div>
                </div>
                <button onClick={() => { if (confirm(`Remove ${s.name}?`)) removeStudentHandler(s.id); }} style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: `${C.accent}15`, color: C.accentDark, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ position: "relative", margin: "8px auto 0", width: "96%", maxWidth: 1300, height: "calc(100vh - 90px)", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
          <BackgroundScene w={1300} h={800} />
          <div style={{ position: "absolute", top: "30%", left: "6%", right: "6%", bottom: "6%", borderRadius: 20, overflow: "hidden" }}>
            <WaterCanvas width={1150} height={550} />
          </div>
          <SteamParticles count={18} />
          <div style={{ position: "absolute", top: "28%", left: "5%", right: "5%", bottom: "5%", zIndex: 10 }}>
            {students.length === 0 && (
              <div style={{ position: "absolute", top: "38%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center", color: C.text, opacity: 0.7 }}>
                <MonkeySVG size={110} mood="neutral" delay={0} variant={0} /><p style={{ fontSize: 20, marginTop: 8 }}>The hot spring is empty...<br />Add some students!</p>
              </div>
            )}
            {students.map((s, i) => {
              const pos = monkeyPositions[i % monkeyPositions.length];
              return (
                <div key={s.id} style={{ position: "absolute", left: pos.left, top: pos.top, zIndex: 15 }}>
                  <MonkeySVG size={students.length > 10 ? 80 : students.length > 6 ? 95 : 110} mood={s.points > 20 ? "excited" : s.points > 5 ? "happy" : "neutral"} label={s.name} points={s.points} delay={i * 0.4} variant={i} selected={selectedStudent === s.id} onClick={() => setSelectedStudent(selectedStudent === s.id ? null : s.id)} />
                </div>
              );
            })}
          </div>
        </div>

        {sel && (
          <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: `${C.card}f0`, borderRadius: 22, padding: "14px 24px", boxShadow: `0 10px 36px rgba(0,0,0,0.18), 0 0 0 2px ${C.gold}30`, display: "flex", alignItems: "center", gap: 14, zIndex: 50, backdropFilter: "blur(12px)" }}>
            <div style={{ fontSize: 18, color: C.text, fontWeight: 700 }}>
              {sel.name} <span style={{ color: C.gold, marginLeft: 4 }}>★ {sel.points}</span>
            </div>
            <div style={{ width: 1, height: 28, background: C.fur2 + "30" }} />
            <select value={pointAmount} onChange={e => setPointAmount(Number(e.target.value))} style={{ padding: "7px 10px", borderRadius: 10, border: `2px solid ${C.fur2}30`, background: C.snow1, fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: C.text }}>
              {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={() => addPoints(sel.id, pointAmount)} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: C.green, color: "white", fontFamily: "'Patrick Hand', cursive", fontSize: 18, cursor: "pointer", fontWeight: 700, boxShadow: `0 3px 10px ${C.green}40` }}>+ Give</button>
            <button onClick={() => addPoints(sel.id, -pointAmount)} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: C.accent, color: "white", fontFamily: "'Patrick Hand', cursive", fontSize: 18, cursor: "pointer", fontWeight: 700, boxShadow: `0 3px 10px ${C.accent}40` }}>− Take</button>
            <button onClick={() => setSelectedStudent(null)} style={{ padding: "7px 12px", borderRadius: 10, border: `2px solid ${C.fur2}25`, background: "transparent", color: C.textLight, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 14 }}>✕</button>
          </div>
        )}
      </div>
    );
  }

  /* ── STUDENT ── */
  if (screen === "student") {
    const me = students.find(s => s.id === user?.id);
    const sorted = [...students].sort((a, b) => b.points - a.points);
    const rank = sorted.findIndex(s => s.id === user?.id) + 1;
    const myIndex = students.indexOf(me);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Patrick Hand', cursive", position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
        <WatercolorFilters /><SnowParticles />

        {notification && (
          <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: notification.type === "error" ? C.accentDark : C.green, color: "white", padding: "14px 32px", borderRadius: 18, fontSize: 19, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", animation: "notifIn 0.35s ease" }}>
            <style>{`@keyframes notifIn { from { opacity:0; transform:translateX(-50%) translateY(-16px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }`}</style>
            {notification.msg}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", position: "relative", zIndex: 20, background: `${C.card}cc`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.fur2}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1 style={{ fontSize: 26, color: C.text, margin: 0 }}>♨️ Monkey Hot Spring</h1>
            <div style={{ background: `${C.gold}18`, borderRadius: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, color: C.text, fontWeight: 600 }}>{me?.name}</span>
              <span style={{ fontSize: 18, color: C.gold, fontWeight: 700 }}>★ {me?.points || 0}</span>
              <span style={{ fontSize: 14, color: C.accent, fontWeight: 600 }}>#{rank}</span>
            </div>
          </div>
          <button onClick={logout} style={{ padding: "9px 18px", borderRadius: 12, border: `2px solid ${C.fur2}40`, background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive", fontSize: 15, cursor: "pointer" }}>🚪 Logout</button>
        </div>

        {showWordle && <WordleGame onWin={handleWordleWin} onClose={() => setShowWordle(false)} />}

        {(() => {
          const done = hasCompletedChallenge(me?.id);
          return (
            <div style={{ position: "absolute", top: 74, left: "50%", transform: "translateX(-50%)", zIndex: 25 }}>
              <button onClick={() => !done && setShowWordle(true)}
                style={{
                  padding: "10px 22px", borderRadius: 16, border: `2px solid ${done ? C.green + "40" : C.gold + "50"}`,
                  background: done ? `${C.green}15` : `${C.card}ee`,
                  color: done ? C.green : C.text,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                  cursor: done ? "default" : "pointer",
                  boxShadow: done ? "none" : `0 4px 14px ${C.gold}30`,
                  transition: "all 0.3s", display: "flex", alignItems: "center", gap: 8,
                  backdropFilter: "blur(8px)",
                }}>
                {done ? "✅ Challenge Complete!" : "🧩 Daily Challenge — Earn +1 ★"}
              </button>
            </div>
          );
        })()}

        <div style={{ position: "relative", margin: "8px auto 0", width: "96%", maxWidth: 1300, height: "calc(100vh - 90px)", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
          <BackgroundScene w={1300} h={800} />
          <div style={{ position: "absolute", top: "30%", left: "6%", right: "6%", bottom: "6%", borderRadius: 20, overflow: "hidden" }}>
            <WaterCanvas width={1150} height={550} />
          </div>
          <SteamParticles count={18} />

          <div style={{ position: "absolute", top: "28%", left: "5%", right: "5%", bottom: "5%", zIndex: 10 }}>
            {students.map((s, i) => {
              const pos = monkeyPositions[i % monkeyPositions.length];
              const isMe = s.id === me?.id;
              return (
                <div key={s.id} style={{ position: "absolute", left: pos.left, top: pos.top, zIndex: isMe ? 18 : 15 }}>
                  <MonkeySVG size={students.length > 10 ? 80 : students.length > 6 ? 95 : 110} mood={s.points > 20 ? "excited" : s.points > 5 ? "happy" : "neutral"} label={s.name} points={s.points} delay={i * 0.4} variant={i} selected={isMe} />
                </div>
              );
            })}
          </div>

          <div style={{
            position: "absolute", bottom: 16, right: 16, zIndex: 30,
            background: `${C.card}e8`, borderRadius: 18, padding: "14px 16px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
            border: `2px solid ${C.gold}25`, width: 220, maxHeight: "55%", overflowY: "auto",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8, textAlign: "center" }}>🏆 Leaderboard</div>
            {sorted.map((s, i) => {
              const isMe = s.id === me?.id;
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 10, background: isMe ? `${C.gold}18` : "transparent", marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, width: 26, textAlign: "center", flexShrink: 0, color: i === 0 ? C.gold : i === 1 ? "#b0b0b0" : i === 2 ? "#cd7f32" : C.textLight }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </span>
                  <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: isMe ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.name}{isMe ? " ✦" : ""}
                  </span>
                  <span style={{ fontSize: 14, color: C.gold, fontWeight: 700, flexShrink: 0 }}>★{s.points}</span>
                </div>
              );
            })}
          </div>

          <div style={{
            position: "absolute", bottom: 16, left: 16, zIndex: 30,
            background: `${C.card}e8`, borderRadius: 18, padding: "14px 20px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
            border: `2px solid ${C.gold}25`, display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ width: 50, height: 50, position: "relative" }}>
              <MonkeySVG size={50} mood={me?.points > 20 ? "excited" : me?.points > 5 ? "happy" : "neutral"} delay={0} variant={myIndex >= 0 ? myIndex : 0} />
            </div>
            <div>
              <div style={{ fontSize: 16, color: C.text, fontWeight: 700 }}>{me?.name}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 22, color: C.gold, fontWeight: 700 }}>★ {me?.points || 0}</span>
                <span style={{ fontSize: 16, color: C.accent, fontWeight: 600 }}>Rank #{rank}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
