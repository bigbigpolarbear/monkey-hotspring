import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { getTeachers, getStudents, addStudentToDB, updateStudent, deleteStudent, getQuizzes, setQuizForStudent, deleteQuizForStudent } from "./firebase";

/* ─── Hover context ─── */
const HoverContext = createContext({ anyHovering: false, setAnyHovering: () => {} });

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

/* ─── PETS ─── */
const PET_CATALOG = [
  { id: "fish", name: "Goldfish", price: 100, emoji: "🐠", rarity: "common" },
  { id: "duck", name: "Duckling", price: 200, emoji: "🦆", rarity: "common" },
  { id: "turtle", name: "Turtle", price: 350, emoji: "🐢", rarity: "uncommon" },
  { id: "bunny", name: "Snow Bunny", price: 500, emoji: "🐰", rarity: "uncommon" },
  { id: "fox", name: "Arctic Fox", price: 750, emoji: "🦊", rarity: "rare" },
  { id: "otter", name: "River Otter", price: 1000, emoji: "🦦", rarity: "rare" },
  { id: "owl", name: "Snowy Owl", price: 1500, emoji: "🦉", rarity: "epic" },
  { id: "panda", name: "Tiny Panda", price: 2500, emoji: "🐼", rarity: "legendary" },
  { id: "dragon", name: "Baby Dragon", price: 5000, emoji: "🐲", rarity: "mythic" },
];
const RARITY_COLORS = {
  common: "#9aaab8", uncommon: "#5caa5e", rare: "#5a8fc7",
  epic: "#a060c0", legendary: "#edb830", mythic: "#e06060",
};

function PetSVG({ petId, side = "right" }) {
  const [bob, setBob] = useState(0);
  const [blink, setBlink] = useState(false);
  const frameRef = useRef(0);
  const blinkTimer = useRef(null);
  useEffect(() => {
    let running = true;
    const t0 = performance.now() + Math.random() * 1000;
    const animate = (now) => {
      if (!running) return;
      const t = (now - t0) / 1000;
      setBob(Math.sin(t * 1.6) * 5);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    const doBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
      blinkTimer.current = setTimeout(doBlink, 2000 + Math.random() * 3500);
    };
    blinkTimer.current = setTimeout(doBlink, 1200 + Math.random() * 2000);
    return () => { running = false; cancelAnimationFrame(frameRef.current); clearTimeout(blinkTimer.current); };
  }, []);

  const cx = side === "right" ? 60 : -60;
  const cy = 5;
  const groupTransform = `translate(${cx}, ${cy + bob}) ${side === "left" ? "scale(-1,1)" : ""}`;

  const eyes = (lx, rx, ey, size = 2.5) => blink ? (
    <>
      <path d={`M ${lx-2.5} ${ey} Q ${lx} ${ey+1.5} ${lx+2.5} ${ey}`} fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      <path d={`M ${rx-2.5} ${ey} Q ${rx} ${ey+1.5} ${rx+2.5} ${ey}`} fill="none" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ) : (
    <>
      <ellipse cx={lx} cy={ey} rx={size+0.6} ry={size+0.4} fill="white" />
      <ellipse cx={rx} cy={ey} rx={size+0.6} ry={size+0.4} fill="white" />
      <circle cx={lx+0.3} cy={ey+0.3} r={size} fill="#1a1a1a" />
      <circle cx={rx+0.3} cy={ey+0.3} r={size} fill="#1a1a1a" />
      <circle cx={lx+1} cy={ey-1} r={size*0.45} fill="white" />
      <circle cx={rx+1} cy={ey-1} r={size*0.45} fill="white" />
      <circle cx={lx-0.5} cy={ey+1} r={size*0.25} fill="white" opacity="0.7" />
      <circle cx={rx-0.5} cy={ey+1} r={size*0.25} fill="white" opacity="0.7" />
    </>
  );

  const blush = (lx, rx, by) => (
    <>
      <circle cx={lx} cy={by} r="3" fill="#ff9090" opacity="0.55" />
      <circle cx={rx} cy={by} r="3" fill="#ff9090" opacity="0.55" />
    </>
  );

  const renderPet = () => {
    switch (petId) {
      case "fish":
        return (
          <g transform={groupTransform}>
            <g filter="url(#watercolorSoft)">
              <path d="M 8 0 Q 22 -10 24 -2 Q 22 0 24 4 Q 22 10 8 2 Z" fill="#ff8030" />
              <path d="M 8 0 Q 18 -6 20 0 Q 18 6 8 0 Z" fill="#ffa050" opacity="0.7" />
              <ellipse cx="-2" cy="0" rx="14" ry="11" fill="#ffa030" />
              <ellipse cx="-4" cy="-2" rx="9" ry="7" fill="#ffc060" opacity="0.7" />
              <path d="M -6 -10 Q -2 -16 4 -11 Q 0 -8 -6 -10 Z" fill="#ff8030" />
              <path d="M -4 9 Q 0 14 4 10" fill="#ff8030" stroke="none" />
            </g>
            {eyes(-8, -2, -2, 2.3)}
            {blush(-9, -1, 3)}
            <path d="M -7 5 Q -5 7 -3 5" stroke="#1a1a1a" strokeWidth="0.8" fill="none" strokeLinecap="round" />
            <text x="6" y="-8" fontSize="6" fill="#fff4c2">✦</text>
          </g>
        );
      case "duck":
        return (
          <g transform={groupTransform}>
            <g filter="url(#furTexture)">
              {[-12, -6, 0, 6, 12].map((dx, i) => (
                <ellipse key={i} cx={dx} cy={i % 2 ? 4 : 8} rx="6" ry="5" fill="#fff5d0" opacity="0.7" />
              ))}
              <ellipse cx="0" cy="6" rx="14" ry="11" fill="#fff5d0" />
              <ellipse cx="4" cy="6" rx="6" ry="5" fill="#ffe890" opacity="0.6" transform="rotate(-15 4 6)" />
              {[-8, -4, 0, 4].map((dx, i) => (
                <ellipse key={`h${i}`} cx={dx} cy="-7" rx="5" ry="4.5" fill="#fff5d0" opacity="0.8" />
              ))}
              <ellipse cx="-3" cy="-6" rx="9" ry="8" fill="#fff5d0" />
            </g>
            <path d="M -12 -5 Q -16 -3 -12 -1 Z" fill="#ff9020" />
            {eyes(-7, -2, -7, 2)}
            {blush(-8, -1, -3)}
            <text x="10" y="-10" fontSize="7" fill="#fff4c2">✦</text>
          </g>
        );
      case "turtle":
        return (
          <g transform={groupTransform}>
            <g filter="url(#watercolorSoft)">
              <ellipse cx="0" cy="2" rx="16" ry="12" fill="#5caa5e" />
              <ellipse cx="0" cy="0" rx="13" ry="9" fill="#7cc080" />
              <path d="M -5 -2 L 0 -4 L 5 -2 L 5 3 L 0 5 L -5 3 Z" fill="#9adb80" opacity="0.6" />
              <path d="M -8 4 Q -5 6 -3 4 M 3 4 Q 5 6 8 4" stroke="#3a7a3c" strokeWidth="0.5" fill="none" />
              <ellipse cx="-13" cy="0" rx="6" ry="5" fill="#9adb80" />
              <ellipse cx="-10" cy="11" rx="3" ry="2" fill="#9adb80" />
              <ellipse cx="10" cy="11" rx="3" ry="2" fill="#9adb80" />
              <ellipse cx="14" cy="4" rx="3" ry="1.5" fill="#9adb80" />
            </g>
            {eyes(-15, -11, -1, 1.6)}
            {blush(-16, -10, 2)}
            <path d="M -14 3 Q -13 4.5 -12 3" stroke="#1a1a1a" strokeWidth="0.7" fill="none" strokeLinecap="round" />
            <text x="6" y="-7" fontSize="6" fill="#fff4c2">✦</text>
          </g>
        );
      case "bunny":
        return (
          <g transform={groupTransform}>
            <g filter="url(#furTexture)">
              {[-12, -6, 0, 6, 12, -8, 8].map((dx, i) => (
                <ellipse key={i} cx={dx} cy={i % 2 ? 4 : 9} rx="5.5" ry="5" fill="#f5f0ea" opacity="0.7" />
              ))}
              <ellipse cx="0" cy="6" rx="13" ry="10" fill="#f5f0ea" />
              {[-7, -3, 0, 3, 7].map((dx, i) => (
                <ellipse key={`h${i}`} cx={dx} cy="-8" rx="5" ry="4.5" fill="#f5f0ea" opacity="0.8" />
              ))}
              <ellipse cx="0" cy="-7" rx="9" ry="8" fill="#f5f0ea" />
              <ellipse cx="-4" cy="-18" rx="2.5" ry="8" fill="#f5f0ea" />
              <ellipse cx="4" cy="-18" rx="2.5" ry="8" fill="#f5f0ea" />
              <ellipse cx="-4" cy="-18" rx="1.2" ry="5" fill="#ffb0c0" opacity="0.7" />
              <ellipse cx="4" cy="-18" rx="1.2" ry="5" fill="#ffb0c0" opacity="0.7" />
            </g>
            {eyes(-3, 3, -7, 2.2)}
            {blush(-6, 6, -3)}
            <path d="M -1.5 -4 L 1.5 -4 L 0 -2.5 Z" fill="#ff8090" />
            <path d="M 0 -2.5 Q -2 -1 -3 -2 M 0 -2.5 Q 2 -1 3 -2" stroke="#1a1a1a" strokeWidth="0.6" fill="none" strokeLinecap="round" />
            <circle cx="14" cy="6" r="4" fill="#fff" filter="url(#furTexture)" />
            <text x="10" y="-15" fontSize="7" fill="#fff4c2">✦</text>
          </g>
        );
      case "fox":
        return (
          <g transform={groupTransform}>
            <g filter="url(#furTexture)">
              {[14, 17, 20].map((dx, i) => (
                <ellipse key={i} cx={dx} cy={4 - i * 2} rx="5" ry="6" fill="#f5f0ea" opacity="0.8" transform={`rotate(${20 + i * 10} ${dx} ${4 - i * 2})`} />
              ))}
              <ellipse cx="16" cy="0" rx="7" ry="8" fill="#f5f0ea" transform="rotate(30 16 0)" />
              <ellipse cx="20" cy="-6" rx="4" ry="3" fill="#fff" />
              {[-8, 0, 8].map((dx, i) => (
                <ellipse key={`b${i}`} cx={dx} cy="6" rx="6" ry="5" fill="#f5f0ea" opacity="0.7" />
              ))}
              <ellipse cx="0" cy="5" rx="12" ry="9" fill="#f5f0ea" />
              {[-7, 0, 7].map((dx, i) => (
                <ellipse key={`h${i}`} cx={dx} cy="-6" rx="5.5" ry="5" fill="#f5f0ea" opacity="0.8" />
              ))}
              <ellipse cx="0" cy="-6" rx="10" ry="8" fill="#f5f0ea" />
              <path d="M -8 -13 L -10 -19 L -4 -14 Z" fill="#f5f0ea" />
              <path d="M 8 -13 L 10 -19 L 4 -14 Z" fill="#f5f0ea" />
              <path d="M -7 -14 L -8 -17 L -5 -14 Z" fill="#ffb0b0" opacity="0.6" />
              <path d="M 7 -14 L 8 -17 L 5 -14 Z" fill="#ffb0b0" opacity="0.6" />
            </g>
            <ellipse cx="0" cy="-3" rx="4" ry="3.5" fill="#fff" filter="url(#watercolorSoft)" />
            {eyes(-4, 4, -7, 2.2)}
            {blush(-7, 7, -3)}
            <ellipse cx="0" cy="-4" rx="1.5" ry="1.2" fill="#1a1a1a" />
            <path d="M 0 -3 Q -2 -1 -4 -2 M 0 -3 Q 2 -1 4 -2" stroke="#1a1a1a" strokeWidth="0.6" fill="none" strokeLinecap="round" />
            <text x="-18" y="-10" fontSize="7" fill="#fff4c2">✦</text>
          </g>
        );
      case "otter":
        return (
          <g transform={groupTransform}>
            <g filter="url(#furTexture)">
              {[-10, -4, 2, 8].map((dx, i) => (
                <ellipse key={i} cx={dx} cy={i % 2 ? 4 : 8} rx="6" ry="5.5" fill="#9a6a4a" opacity="0.7" />
              ))}
              <ellipse cx="0" cy="6" rx="13" ry="10" fill="#a87858" />
              <ellipse cx="0" cy="9" rx="8" ry="5" fill="#d4b090" opacity="0.7" />
              {[-7, 0, 7].map((dx, i) => (
                <ellipse key={`h${i}`} cx={dx} cy="-7" rx="5.5" ry="5" fill="#9a6a4a" opacity="0.7" />
              ))}
              <ellipse cx="0" cy="-6" rx="9" ry="8.5" fill="#a87858" />
              <ellipse cx="0" cy="-5" rx="6" ry="5" fill="#d4b090" />
              <circle cx="-7" cy="-12" r="2.5" fill="#9a6a4a" />
              <circle cx="7" cy="-12" r="2.5" fill="#9a6a4a" />
              <circle cx="-7" cy="-12" r="1.2" fill="#ffb0b0" opacity="0.5" />
              <circle cx="7" cy="-12" r="1.2" fill="#ffb0b0" opacity="0.5" />
              <ellipse cx="14" cy="10" rx="6" ry="2.5" fill="#a87858" transform="rotate(15 14 10)" />
              <ellipse cx="-2" cy="2" rx="3" ry="2.5" fill="#9a6a4a" />
              <ellipse cx="2" cy="2" rx="3" ry="2.5" fill="#9a6a4a" />
            </g>
            <g filter="url(#watercolorSoft)">
              <ellipse cx="0" cy="2" rx="4.5" ry="3" fill="#a0d4d0" />
              <ellipse cx="0" cy="2" rx="4.5" ry="1.5" fill="#80c4c0" />
              <path d="M -4 2 L 4 2" stroke="#5aa098" strokeWidth="0.5" />
              <circle cx="-1" cy="1.5" r="0.8" fill="white" opacity="0.7" />
            </g>
            {eyes(-4, 4, -7, 2.3)}
            {blush(-7, 7, -3)}
            <ellipse cx="0" cy="-3" rx="1.8" ry="1.2" fill="#1a1a1a" />
            <path d="M -2 -1 Q 0 1 2 -1" stroke="#1a1a1a" strokeWidth="0.7" fill="none" strokeLinecap="round" />
            <path d="M -5 -2 L -10 -3 M -5 -1 L -10 0 M 5 -2 L 10 -3 M 5 -1 L 10 0" stroke="#666" strokeWidth="0.3" />
            <text x="-16" y="-12" fontSize="7" fill="#fff4c2">✦</text>
            <text x="14" y="-8" fontSize="5" fill="#fff4c2">✧</text>
          </g>
        );
      case "owl":
        return (
          <g transform={groupTransform}>
            <g filter="url(#furTexture)">
              {[-8, -2, 4, 10, -10].map((dx, i) => (
                <ellipse key={i} cx={dx} cy={i % 2 ? 4 : 9} rx="6" ry="5.5" fill="#f5f0ea" opacity="0.7" />
              ))}
              <ellipse cx="0" cy="6" rx="13" ry="11" fill="#f5f0ea" />
              <circle cx="-4" cy="3" r="0.8" fill="#d8d0c0" />
              <circle cx="3" cy="6" r="0.8" fill="#d8d0c0" />
              <circle cx="-2" cy="9" r="0.8" fill="#d8d0c0" />
              <circle cx="6" cy="2" r="0.8" fill="#d8d0c0" />
              {[-9, -3, 3, 9].map((dx, i) => (
                <ellipse key={`h${i}`} cx={dx} cy="-7" rx="6" ry="5.5" fill="#f5f0ea" opacity="0.8" />
              ))}
              <ellipse cx="0" cy="-6" rx="11" ry="10" fill="#f5f0ea" />
              <path d="M -9 -14 L -7 -19 L -5 -14 Z" fill="#f5f0ea" />
              <path d="M 9 -14 L 7 -19 L 5 -14 Z" fill="#f5f0ea" />
            </g>
            <circle cx="-4" cy="-6" r="4" fill="#fff5d0" />
            <circle cx="4" cy="-6" r="4" fill="#fff5d0" />
            {blink ? (
              <>
                <path d="M -7 -6 Q -4 -4 -1 -6" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
                <path d="M 1 -6 Q 4 -4 7 -6" stroke="#1a1a1a" strokeWidth="1.5" fill="none" />
              </>
            ) : (
              <>
                <circle cx="-4" cy="-6" r="2.5" fill="#edb830" />
                <circle cx="4" cy="-6" r="2.5" fill="#edb830" />
                <circle cx="-4" cy="-6" r="1.5" fill="#1a1a1a" />
                <circle cx="4" cy="-6" r="1.5" fill="#1a1a1a" />
                <circle cx="-3" cy="-7" r="0.6" fill="white" />
                <circle cx="5" cy="-7" r="0.6" fill="white" />
              </>
            )}
            {blush(-8, 8, -2)}
            <path d="M -1.5 -3 L 0 0 L 1.5 -3 Z" fill="#ffa030" stroke="#cc7010" strokeWidth="0.4" />
            <text x="10" y="-13" fontSize="7" fill="#fff4c2">✦</text>
          </g>
        );
      case "panda":
        return (
          <g transform={groupTransform}>
            <g filter="url(#furTexture)">
              {[-8, -2, 4, 10].map((dx, i) => (
                <ellipse key={i} cx={dx} cy={i % 2 ? 4 : 9} rx="6" ry="5.5" fill="white" opacity="0.7" />
              ))}
              <ellipse cx="0" cy="6" rx="13" ry="11" fill="white" />
              {[-7, 0, 7].map((dx, i) => (
                <ellipse key={`h${i}`} cx={dx} cy="-7" rx="5.5" ry="5" fill="white" opacity="0.8" />
              ))}
              <ellipse cx="0" cy="-6" rx="10" ry="9" fill="white" />
              <circle cx="-8" cy="-13" r="3.5" fill="#1a1a1a" />
              <circle cx="8" cy="-13" r="3.5" fill="#1a1a1a" />
              <ellipse cx="-12" cy="6" rx="3" ry="6" fill="#1a1a1a" transform="rotate(15 -12 6)" />
              <ellipse cx="12" cy="6" rx="3" ry="6" fill="#1a1a1a" transform="rotate(-15 12 6)" />
              <ellipse cx="-7" cy="14" rx="4" ry="3" fill="#1a1a1a" />
              <ellipse cx="7" cy="14" rx="4" ry="3" fill="#1a1a1a" />
            </g>
            <ellipse cx="-4" cy="-6" rx="3" ry="3.8" fill="#1a1a1a" transform="rotate(-15 -4 -6)" filter="url(#watercolorSoft)" />
            <ellipse cx="4" cy="-6" rx="3" ry="3.8" fill="#1a1a1a" transform="rotate(15 4 -6)" filter="url(#watercolorSoft)" />
            {blink ? (
              <>
                <path d="M -6 -5 Q -4 -4 -2 -5" stroke="white" strokeWidth="1" fill="none" />
                <path d="M 2 -5 Q 4 -4 6 -5" stroke="white" strokeWidth="1" fill="none" />
              </>
            ) : (
              <>
                <circle cx="-4" cy="-5.5" r="1.4" fill="white" />
                <circle cx="4" cy="-5.5" r="1.4" fill="white" />
                <circle cx="-3.7" cy="-5.2" r="0.7" fill="#1a1a1a" />
                <circle cx="4.3" cy="-5.2" r="0.7" fill="#1a1a1a" />
              </>
            )}
            {blush(-8, 8, -2)}
            <ellipse cx="0" cy="-2" rx="1.5" ry="1.2" fill="#1a1a1a" />
            <path d="M -2 0 Q 0 2 2 0" stroke="#1a1a1a" strokeWidth="0.7" fill="none" strokeLinecap="round" />
            <text x="-16" y="-12" fontSize="7" fill="#fff4c2">✦</text>
            <text x="14" y="-8" fontSize="5" fill="#fff4c2">✧</text>
          </g>
        );
      case "dragon":
        return (
          <g transform={groupTransform}>
            <g filter="url(#watercolorSoft)">
              <path d="M 4 0 Q 18 -8 22 4 Q 14 -2 6 4 Z" fill="#5a9080" opacity="0.8" />
              <path d="M 4 -2 Q 16 -10 20 0 Q 12 -4 6 2 Z" fill="#7ac0a0" />
              <path d="M 14 -8 L 14 -3 M 18 -7 L 18 -2 M 21 -3 L 21 1" stroke="#3a6850" strokeWidth="0.6" />
              <path d="M -8 8 Q -16 12 -18 6 Q -20 2 -16 -2" fill="none" stroke="#7ac0a0" strokeWidth="6" strokeLinecap="round" />
              <path d="M -16 -2 L -19 -4 L -16 -1 Z" fill="#5a9080" />
              <ellipse cx="0" cy="5" rx="14" ry="11" fill="#7ac0a0" />
              <ellipse cx="-2" cy="3" rx="9" ry="7" fill="#9adcb8" opacity="0.6" />
              <ellipse cx="-4" cy="-6" rx="9" ry="8" fill="#7ac0a0" />
              <ellipse cx="-10" cy="-3" rx="5" ry="4" fill="#7ac0a0" />
              <path d="M -8 -13 L -6 -18 L -4 -13 Z" fill="#fff5d0" stroke="#c0a060" strokeWidth="0.5" />
              <path d="M 0 -13 L 2 -18 L 4 -13 Z" fill="#fff5d0" stroke="#c0a060" strokeWidth="0.5" />
              <path d="M -2 -4 L 0 -7 L 2 -4 M 4 -2 L 6 -5 L 8 -2 M 10 0 L 12 -3 L 14 0" fill="#5a9080" />
            </g>
            {eyes(-7, -2, -7, 2.3)}
            {blush(-9, 0, -3)}
            <circle cx="-12" cy="-3" r="0.5" fill="#1a1a1a" />
            <circle cx="-13" cy="-1" r="0.5" fill="#1a1a1a" />
            <path d="M -13 0 Q -10 2 -7 0" stroke="#1a1a1a" strokeWidth="0.7" fill="none" strokeLinecap="round" />
            <g opacity="0.85">
              <ellipse cx="-17" cy="-1" rx="2.5" ry="1.5" fill="#ff8030" />
              <ellipse cx="-19" cy="-1" rx="1.8" ry="1" fill="#ffd040" />
            </g>
            <text x="6" y="-14" fontSize="9" fill="#edb830">✦</text>
            <text x="-12" y="-15" fontSize="6" fill="#fff4c2">✧</text>
            <text x="16" y="6" fontSize="7" fill="#a060c0">✦</text>
          </g>
        );
      default: return null;
    }
  };

  if (!petId) return null;
  return <>{renderPet()}</>;
}

/* ─── IMPROVED MONKEY SVG ─── */
function MonkeySVG({ size = 120, mood = "happy", label, points, onClick, delay = 0, style = {}, selected, variant = 0, accessories = [], pet = null }) {
  const { setAnyHovering } = useContext(HoverContext);
  const [bob, setBob] = useState(0);
  const [sway, setSway] = useState(0);
  const [drift, setDrift] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [splashes, setSplashes] = useState([]);
  const frameRef = useRef(0);
  const blinkTimer = useRef(null);
  const hoveringRef = useRef(false);

  useEffect(() => {
    let running = true;
    const t0 = performance.now() + delay * 1000;
    const speed1 = 0.8 + (variant % 5) * 0.15;
    const speed2 = 0.5 + (variant % 3) * 0.12;
    const driftSpeedX = 0.18 + (variant % 7) * 0.04;
    const driftSpeedY = 0.13 + (variant % 5) * 0.03;
    const phaseX = variant * 1.7;
    const phaseY = variant * 2.3;
    const animate = (now) => {
      if (!running) return;
      const t = (now - t0) / 1000;
      const bobAmp = hoveringRef.current ? 9 : 5;
      const swayAmp = hoveringRef.current ? 7 : 3.5;
      setBob(Math.sin(t * (hoveringRef.current ? speed1 * 2.2 : speed1)) * bobAmp + Math.sin(t * 0.4) * 2);
      setSway(Math.sin(t * (hoveringRef.current ? speed2 * 2 : speed2) + 0.8) * swayAmp);
      setDrift({
        x: Math.sin(t * driftSpeedX + phaseX) * 18 + Math.cos(t * driftSpeedX * 0.6) * 6,
        y: Math.cos(t * driftSpeedY + phaseY) * 10 + Math.sin(t * driftSpeedY * 0.7) * 4,
      });
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

  useEffect(() => {
    if (!hovering) return;
    const interval = setInterval(() => {
      const id = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 20;
      const newSplash = {
        id, startX: 0, startY: 28,
        endX: Math.cos(angle) * dist,
        endY: 28 + Math.abs(Math.sin(angle)) * 12 + 8,
        size: 3 + Math.random() * 4,
      };
      setSplashes(s => [...s, newSplash]);
      setTimeout(() => setSplashes(s => s.filter(sp => sp.id !== id)), 700);
    }, 130);
    return () => clearInterval(interval);
  }, [hovering]);

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
    <div
      onClick={onClick}
      onMouseEnter={() => { setHovering(true); hoveringRef.current = true; setAnyHovering(true); }}
      onMouseLeave={() => { setHovering(false); hoveringRef.current = false; setAnyHovering(false); }}
      style={{
        cursor: onClick ? "pointer" : "default",
        transform: `translate(${drift.x}px, ${drift.y + bob}px) rotate(${sway * 0.25}deg) scale(${hovering ? 1.05 : 1})`,
        filter: selected ? `drop-shadow(0 0 14px ${C.gold})` : (hovering ? `drop-shadow(0 0 8px ${C.water1}80)` : "none"),
        transition: "filter 0.3s, scale 0.25s",
        position: "relative",
        ...style,
      }}>
      <style>{`
        @keyframes splashDrop {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
          15% { opacity: 0.9; transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3 - 12px)) scale(1); }
          60% { opacity: 0.7; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.6); opacity: 0; }
        }
        @keyframes ripplePulse {
          0% { transform: scale(0.6); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
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

        {/* ─── ACCESSORIES ─── */}
        {accessories.includes("scarf") && (
          <g filter="url(#watercolorSoft)">
            <path d="M -22 14 Q 0 22 22 14 Q 24 22 22 28 Q 0 36 -22 28 Q -24 22 -22 14 Z"
              fill="#c94c4c" stroke="#a02828" strokeWidth="0.5" />
            <path d="M -22 17 L -16 32 L -10 28 L -14 17" fill="#a02828" opacity="0.8" />
            <line x1="-18" y1="20" x2="18" y2="18" stroke="white" strokeWidth="1" opacity="0.4" />
            <line x1="-18" y1="24" x2="18" y2="22" stroke="white" strokeWidth="1" opacity="0.3" />
          </g>
        )}
        {accessories.includes("sunglasses") && (
          <g>
            <ellipse cx="-9" cy="-16" rx="7" ry="5" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
            <ellipse cx="9" cy="-16" rx="7" ry="5" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
            <line x1="-2" y1="-16" x2="2" y2="-16" stroke="#444" strokeWidth="1.5" />
            <line x1="-16" y1="-15" x2="-19" y2="-13" stroke="#444" strokeWidth="1" />
            <line x1="16" y1="-15" x2="19" y2="-13" stroke="#444" strokeWidth="1" />
            <ellipse cx="-11" cy="-18" rx="2" ry="1.5" fill="white" opacity="0.4" />
            <ellipse cx="7" cy="-18" rx="2" ry="1.5" fill="white" opacity="0.4" />
          </g>
        )}
        {accessories.includes("hat") && (
          <g filter="url(#watercolorSoft)">
            <ellipse cx="0" cy="-38" rx="28" ry="5" fill="#3a4f6a" />
            <path d="M -18 -38 Q -16 -55 0 -57 Q 16 -55 18 -38 Z"
              fill="#4a6080" stroke="#2a3a50" strokeWidth="0.8" />
            <ellipse cx="0" cy="-40" rx="19" ry="2.5" fill="#2a3a50" />
            <circle cx="-10" cy="-40" r="1.5" fill="#edb830" />
          </g>
        )}
        {accessories.includes("beanie") && (
          <g filter="url(#watercolorSoft)">
            <path d="M -26 -32 Q -28 -52 0 -56 Q 28 -52 26 -32 Q 13 -30 0 -30 Q -13 -30 -26 -32 Z"
              fill="#d96666" stroke="#a04040" strokeWidth="0.5" />
            <path d="M -26 -32 Q 0 -28 26 -32 L 26 -28 Q 0 -24 -26 -28 Z" fill="#a04040" />
            <circle cx="0" cy="-58" r="6" fill="#f5f0ea" filter="url(#furTexture)" />
            <circle cx="-2" cy="-60" r="2" fill="white" opacity="0.5" />
          </g>
        )}
        {accessories.includes("crown") && (
          <g filter="url(#watercolorSoft)">
            <path d="M -22 -38 L -22 -45 L -14 -52 L -7 -45 L 0 -55 L 7 -45 L 14 -52 L 22 -45 L 22 -38 Z"
              fill="#edb830" stroke="#b88810" strokeWidth="0.8" />
            <rect x="-22" y="-40" width="44" height="3" fill="#b88810" />
            <circle cx="-14" cy="-45" r="2" fill="#e06060" />
            <circle cx="0" cy="-48" r="2.5" fill="#5a8fc7" />
            <circle cx="14" cy="-45" r="2" fill="#5caa5e" />
            <path d="M -20 -42 L -20 -39" stroke="white" strokeWidth="1" opacity="0.5" />
            <path d="M 20 -42 L 20 -39" stroke="white" strokeWidth="1" opacity="0.5" />
          </g>
        )}
        {accessories.includes("flower") && (
          <g filter="url(#watercolorSoft)">
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = angle * Math.PI / 180;
              const x = -22 + Math.cos(rad) * 5;
              const y = -32 + Math.sin(rad) * 5;
              return <ellipse key={i} cx={x} cy={y} rx="4" ry="3" fill="#ffb6d9"
                transform={`rotate(${angle} ${x} ${y})`} />;
            })}
            <circle cx="-22" cy="-32" r="3" fill="#edb830" />
            <ellipse cx="-23" cy="-33" rx="1" ry="0.8" fill="white" opacity="0.6" />
          </g>
        )}
        {accessories.includes("bowtie") && (
          <g filter="url(#watercolorSoft)">
            <path d="M -10 8 L -16 4 L -16 14 Z" fill="#c94c4c" />
            <path d="M 10 8 L 16 4 L 16 14 Z" fill="#c94c4c" />
            <rect x="-3" y="6" width="6" height="6" rx="1" fill="#a02828" />
            <circle cx="0" cy="9" r="1" fill="#edb830" />
          </g>
        )}
        {accessories.includes("headphones") && (
          <g>
            <path d="M -28 -28 Q 0 -52 28 -28" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
            <path d="M -28 -28 Q 0 -52 28 -28" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="-28" cy="-22" r="7" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
            <circle cx="28" cy="-22" r="7" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
            <circle cx="-28" cy="-22" r="3" fill="#e06060" />
            <circle cx="28" cy="-22" r="3" fill="#e06060" />
          </g>
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
        {pet && <PetSVG petId={pet} side="right" />}
        {hovering && (
          <>
            <ellipse cx="0" cy="32" rx="50" ry="12" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5"
              style={{ animation: "ripplePulse 1.2s ease-out infinite", transformOrigin: "center 32px" }} />
            <ellipse cx="0" cy="32" rx="50" ry="12" fill="none" stroke="white" strokeWidth="1.2" opacity="0.4"
              style={{ animation: "ripplePulse 1.2s ease-out 0.4s infinite", transformOrigin: "center 32px" }} />
          </>
        )}

        {splashes.map(s => (
          <circle
            key={s.id}
            cx={s.startX} cy={s.startY} r={s.size}
            fill="white" opacity="0.8"
            style={{
              "--dx": `${s.endX}px`,
              "--dy": `${s.endY - s.startY}px`,
              animation: "splashDrop 0.7s ease-out forwards",
            }}
          />
        ))}
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
          fontSize: hovering ? 22 : 18, fontWeight: 700,
          color: hovering ? "#fff4c2" : C.gold,
          textShadow: hovering
            ? `0 0 8px ${C.gold}, 0 0 16px ${C.gold}, 0 0 24px #fff4c2, 0 0 32px ${C.gold}, 0 1px 4px rgba(0,0,0,0.3)`
            : "0 1px 4px rgba(0,0,0,0.2), 0 0 8px rgba(237,184,48,0.3)",
          transition: "color 0.25s, font-size 0.25s, text-shadow 0.25s",
          animation: hovering ? "starPulse 0.9s ease-in-out infinite" : "none",
          position: "relative", zIndex: 5,
        }}>
          <style>{`
            @keyframes starPulse {
              0%, 100% { transform: scale(1) rotate(0deg); }
              50% { transform: scale(1.15) rotate(-3deg); }
            }
            @keyframes starSparkle {
              0% { transform: translate(-50%, -50%) scale(0) rotate(0deg); opacity: 0; }
              30% { opacity: 1; }
              100% { transform: translate(calc(-50% + var(--sx)), calc(-50% + var(--sy))) scale(1.2) rotate(180deg); opacity: 0; }
            }
          `}</style>
          ★ {points}
          {hovering && [0, 1, 2, 3, 4].map(i => {
            const angle = (i / 5) * Math.PI * 2 + Math.random();
            const dist = 22 + Math.random() * 8;
            return (
              <span key={i} style={{
                position: "absolute", left: "50%", top: "50%",
                fontSize: 10, color: "#fff4c2", pointerEvents: "none",
                "--sx": `${Math.cos(angle) * dist}px`,
                "--sy": `${Math.sin(angle) * dist}px`,
                animation: `starSparkle ${0.8 + i * 0.1}s ease-out ${i * 0.15}s infinite`,
                textShadow: `0 0 6px ${C.gold}`,
              }}>✦</span>
            );
          })}
        </div>
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

      {/* Perch rocks at pool edge */}
      {[
        { x: w*0.18, y: h*0.62, rw: 90, rh: 50, c: C.rock1 },
        { x: w*0.5, y: h*0.65, rw: 110, rh: 55, c: C.rock3 },
        { x: w*0.78, y: h*0.63, rw: 100, rh: 50, c: C.rock2 },
      ].map((r, i) => (
        <g key={`perch${i}`} filter="url(#rockTexture)">
          <ellipse cx={r.x + r.rw/2} cy={r.y + r.rh/2} rx={r.rw/2} ry={r.rh/2} fill={r.c} />
          <ellipse cx={r.x + r.rw*0.4} cy={r.y + r.rh*0.3} rx={r.rw*0.3} ry={r.rh*0.2} fill="white" opacity="0.1" />
          <ellipse cx={r.x + r.rw*0.6} cy={r.y + r.rh*0.7} rx={r.rw*0.25} ry={r.rh*0.15} fill="black" opacity="0.08" />
        </g>
      ))}

      {/* Dense bare trees - left */}
      {[
        { x: w*0.01, y: h*0.7, s: 1.4, sway: 0 },
        { x: w*0.04, y: h*0.78, s: 1.1, sway: 0.05 },
        { x: w*0.08, y: h*0.85, s: 1.6, sway: -0.03 },
        { x: w*0.12, y: h*0.92, s: 0.9, sway: 0.02 },
        { x: w*0.02, y: h*0.92, s: 0.7, sway: 0 },
      ].map((tree, i) => (
        <g key={`treeL${i}`} transform={`translate(${tree.x},${tree.y}) scale(${tree.s}) rotate(${tree.sway * 30})`}
           opacity="0.75" filter="url(#watercolorSoft)">
          <line x1="0" y1="0" x2="-2" y2="-100" stroke={C.rock2} strokeWidth="3" strokeLinecap="round" />
          <line x1="-1" y1="-30" x2="-25" y2="-65" stroke={C.rock2} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="-1" y1="-45" x2="22" y2="-72" stroke={C.rock2} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="-1" y1="-55" x2="-30" y2="-85" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="-1" y1="-65" x2="18" y2="-95" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="-2" y1="-78" x2="-18" y2="-105" stroke={C.rock2} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-2" y1="-88" x2="14" y2="-112" stroke={C.rock2} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-25" y1="-65" x2="-32" y2="-72" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="-25" y1="-65" x2="-30" y2="-58" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="22" y1="-72" x2="30" y2="-78" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="22" y1="-72" x2="28" y2="-65" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="-30" y1="-85" x2="-38" y2="-90" stroke={C.rock2} strokeWidth="0.8" strokeLinecap="round" />
          <line x1="18" y1="-95" x2="26" y2="-100" stroke={C.rock2} strokeWidth="0.8" strokeLinecap="round" />
          <line x1="-18" y1="-105" x2="-24" y2="-112" stroke={C.rock2} strokeWidth="0.8" strokeLinecap="round" />
          <line x1="14" y1="-112" x2="20" y2="-118" stroke={C.rock2} strokeWidth="0.7" strokeLinecap="round" />
          <line x1="-2" y1="-100" x2="6" y2="-115" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="-2" y1="-100" x2="-10" y2="-115" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}

      {/* Dense bare trees - right */}
      {[
        { x: w*0.97, y: h*0.7, s: 1.3, sway: 0 },
        { x: w*0.94, y: h*0.78, s: 1.5, sway: -0.04 },
        { x: w*0.91, y: h*0.86, s: 1.0, sway: 0.03 },
        { x: w*0.88, y: h*0.92, s: 0.8, sway: 0 },
        { x: w*0.98, y: h*0.92, s: 0.7, sway: 0.02 },
      ].map((tree, i) => (
        <g key={`treeR${i}`} transform={`translate(${tree.x},${tree.y}) scale(${tree.s}) rotate(${tree.sway * 30})`}
           opacity="0.75" filter="url(#watercolorSoft)">
          <line x1="0" y1="0" x2="2" y2="-100" stroke={C.rock2} strokeWidth="3" strokeLinecap="round" />
          <line x1="1" y1="-30" x2="25" y2="-65" stroke={C.rock2} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="1" y1="-45" x2="-22" y2="-72" stroke={C.rock2} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="1" y1="-55" x2="30" y2="-85" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="1" y1="-65" x2="-18" y2="-95" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="2" y1="-78" x2="18" y2="-105" stroke={C.rock2} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="2" y1="-88" x2="-14" y2="-112" stroke={C.rock2} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="25" y1="-65" x2="32" y2="-72" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="25" y1="-65" x2="30" y2="-58" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="-22" y1="-72" x2="-30" y2="-78" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="-22" y1="-72" x2="-28" y2="-65" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="30" y1="-85" x2="38" y2="-90" stroke={C.rock2} strokeWidth="0.8" strokeLinecap="round" />
          <line x1="-18" y1="-95" x2="-26" y2="-100" stroke={C.rock2} strokeWidth="0.8" strokeLinecap="round" />
          <line x1="18" y1="-105" x2="24" y2="-112" stroke={C.rock2} strokeWidth="0.8" strokeLinecap="round" />
          <line x1="-14" y1="-112" x2="-20" y2="-118" stroke={C.rock2} strokeWidth="0.7" strokeLinecap="round" />
          <line x1="2" y1="-100" x2="-6" y2="-115" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="2" y1="-100" x2="10" y2="-115" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}

      {/* Background trees */}
      {[
        { x: w*0.22, y: h*0.43, s: 0.5 },
        { x: w*0.78, y: h*0.43, s: 0.55 },
        { x: w*0.5, y: h*0.4, s: 0.45 },
      ].map((tree, i) => (
        <g key={`treeBG${i}`} transform={`translate(${tree.x},${tree.y}) scale(${tree.s})`} opacity="0.4" filter="url(#watercolorSoft)">
          <line x1="0" y1="0" x2="0" y2="-60" stroke={C.rock2} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="0" y1="-25" x2="-15" y2="-45" stroke={C.rock2} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0" y1="-35" x2="14" y2="-55" stroke={C.rock2} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0" y1="-45" x2="-10" y2="-58" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
          <line x1="0" y1="-50" x2="8" y2="-65" stroke={C.rock2} strokeWidth="1" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/* ─── PENGUIN ─── */
function Penguin({ startX, startY, baseSize = 22, speed = 1, variant = 0, paused }) {
  const [pos, setPos] = useState({ x: startX, y: startY });
  const [waddle, setWaddle] = useState(0);
  const [direction, setDirection] = useState(1);
  const frameRef = useRef(0);
  const pausedRef = useRef(false);
  const lastTimeRef = useRef(performance.now());
  const stateRef = useRef({ x: startX, y: startY, dir: 1, t: variant * 100 });

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    let running = true;
    const animate = (now) => {
      if (!running) return;
      const dt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      if (!pausedRef.current) {
        const s = stateRef.current;
        s.t += dt;
        s.x += s.dir * speed * 12 * dt;
        if (s.x > 95) { s.dir = -1; setDirection(-1); }
        else if (s.x < 2) { s.dir = 1; setDirection(1); }
        if (Math.random() < 0.002) { s.dir = -s.dir; setDirection(s.dir); }
        const newY = startY + Math.sin(s.t * 0.4 + variant) * 1.5;
        setPos({ x: s.x, y: newY });
        setWaddle(Math.sin(s.t * 6) * 6);
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [startY, speed, variant]);

  return (
    <div style={{
      position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`,
      transform: `translate(-50%, -50%) scaleX(${direction}) rotate(${waddle * 0.5}deg)`,
      transition: "filter 0.3s",
      filter: paused ? "saturate(0.7) brightness(0.95)" : "none",
      pointerEvents: "none", zIndex: 6,
    }}>
      <svg width={baseSize} height={baseSize * 1.3} viewBox="-25 -30 50 65" style={{ overflow: "visible" }}>
        <ellipse cx={-6 + waddle * 0.3} cy="26" rx="4" ry="2.5" fill="#e89020" filter="url(#watercolorSoft)" />
        <ellipse cx={6 - waddle * 0.3} cy="26" rx="4" ry="2.5" fill="#e89020" filter="url(#watercolorSoft)" />
        <ellipse cx="0" cy="6" rx="14" ry="20" fill="#2a2a2a" filter="url(#watercolorSoft)" />
        <ellipse cx="0" cy="8" rx="10" ry="16" fill="#f5f0ea" filter="url(#watercolorSoft)" />
        <ellipse cx={-13 + waddle * 0.4} cy="6" rx="4" ry="12" fill="#1a1a1a" filter="url(#watercolorSoft)"
          transform={`rotate(${waddle * 0.5} -13 6)`} />
        <ellipse cx={13 - waddle * 0.4} cy="6" rx="4" ry="12" fill="#1a1a1a" filter="url(#watercolorSoft)"
          transform={`rotate(${-waddle * 0.5} 13 6)`} />
        <ellipse cx="0" cy="-12" rx="11" ry="11" fill="#2a2a2a" filter="url(#watercolorSoft)" />
        <ellipse cx="0" cy="-10" rx="7" ry="6" fill="#f5f0ea" />
        <circle cx="-3" cy="-13" r="1.2" fill="#1a1a1a" />
        <circle cx="3" cy="-13" r="1.2" fill="#1a1a1a" />
        <circle cx="-2.5" cy="-13.5" r="0.4" fill="white" />
        <circle cx="3.5" cy="-13.5" r="0.4" fill="white" />
        <path d="M -2 -8 L 0 -5 L 2 -8 Z" fill="#e89020" />
        <circle cx="-5" cy="-9" r="1.5" fill="#ffb0b0" opacity="0.5" />
        <circle cx="5" cy="-9" r="1.5" fill="#ffb0b0" opacity="0.5" />
      </svg>
    </div>
  );
}

function PenguinFlock() {
  const { anyHovering } = useContext(HoverContext);
  const penguins = [
    { x: 12, y: 18, size: 22, speed: 0.8, variant: 0 },
    { x: 28, y: 14, size: 18, speed: 1.0, variant: 1 },
    { x: 75, y: 16, size: 24, speed: 0.7, variant: 2 },
    { x: 88, y: 22, size: 20, speed: 0.9, variant: 3 },
    { x: 45, y: 12, size: 19, speed: 1.1, variant: 4 },
  ];
  return (
    <>
      {penguins.map((p, i) => (
        <Penguin key={i} startX={p.x} startY={p.y}
          baseSize={p.size} speed={p.speed} variant={p.variant}
          paused={anyHovering} />
      ))}
      {anyHovering && (
        <div style={{
          position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)",
          fontSize: 12, color: C.textLight, opacity: 0.5, pointerEvents: "none",
          fontFamily: "'Patrick Hand', cursive", zIndex: 7,
          animation: "shhFade 0.4s ease",
        }}>
          <style>{`@keyframes shhFade { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 0.5; transform: translateX(-50%) translateY(0); } }`}</style>
          🐧 ...the penguins are watching
        </div>
      )}
    </>
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

/* ─── CSV Parser ─── */
function parseCSV(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (lines.length === 0) return [];
  const parseLine = (line) => {
    const out = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i+1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) {
        out.push(cur); cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = parseLine(lines[0]).map(h => h.toLowerCase());
  const qIdx = headers.findIndex(h => h.includes("question") || h === "q");
  const aIdx = headers.findIndex(h => h === "a" || h === "option1" || h === "choice1");
  const bIdx = headers.findIndex(h => h === "b" || h === "option2" || h === "choice2");
  const cIdx = headers.findIndex(h => h === "c" || h === "option3" || h === "choice3");
  const dIdx = headers.findIndex(h => h === "d" || h === "option4" || h === "choice4");
  const ansIdx = headers.findIndex(h => h.includes("correct") || h.includes("answer"));
  if (qIdx < 0 || aIdx < 0 || bIdx < 0 || cIdx < 0 || dIdx < 0 || ansIdx < 0) return null;
  const questions = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!cols[qIdx]) continue;
    let correct = (cols[ansIdx] || "").toUpperCase().trim();
    let correctIdx = -1;
    if (["A","B","C","D"].includes(correct)) correctIdx = "ABCD".indexOf(correct);
    else if (["1","2","3","4"].includes(correct)) correctIdx = parseInt(correct) - 1;
    else {
      const ans = correct.toLowerCase();
      [cols[aIdx], cols[bIdx], cols[cIdx], cols[dIdx]].forEach((opt, idx) => {
        if (opt && opt.toLowerCase().trim() === ans) correctIdx = idx;
      });
    }
    if (correctIdx < 0) correctIdx = 0;
    questions.push({
      q: cols[qIdx],
      options: [cols[aIdx], cols[bIdx], cols[cIdx], cols[dIdx]],
      correct: correctIdx,
    });
  }
  return questions;
}

/* ─── HAWK ATTACK ─── */
function HawkAttack({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2400);
    return () => clearTimeout(t);
  }, [onComplete]);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100, overflow: "hidden" }}>
      <style>{`
        @keyframes hawkSwoop {
          0% { transform: translate(-200px, -100px) rotate(15deg) scale(0.8); }
          40% { transform: translate(40%, 30%) rotate(-10deg) scale(1.4); }
          55% { transform: translate(45%, 35%) rotate(-5deg) scale(1.5); }
          70% { transform: translate(50%, 30%) rotate(10deg) scale(1.4); }
          100% { transform: translate(120%, -50px) rotate(20deg) scale(0.8); opacity: 0; }
        }
        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0); }
          10%, 30%, 50%, 70%, 90% { transform: translate(-3px, 1px); }
          20%, 40%, 60%, 80% { transform: translate(3px, -1px); }
        }
      `}</style>
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
        background: "rgba(180,30,30,0.08)", animation: "screenShake 0.4s ease 0.5s 4" }} />
      <div style={{ position: "absolute", left: 0, top: 0, animation: "hawkSwoop 2.2s ease-in-out forwards" }}>
        <svg width="160" height="120" viewBox="-80 -60 160 120" style={{ overflow: "visible" }}>
          <path d="M -10 0 Q -50 -20 -75 -10 Q -55 0 -40 5 Q -25 8 -10 5 Z"
            fill="#5a3a28" stroke="#3a2418" strokeWidth="1" filter="url(#watercolorSoft)" />
          <path d="M 10 0 Q 50 -20 75 -10 Q 55 0 40 5 Q 25 8 10 5 Z"
            fill="#5a3a28" stroke="#3a2418" strokeWidth="1" filter="url(#watercolorSoft)" />
          <path d="M -20 2 L -55 -8 M -25 6 L -60 0 M -15 -2 L -45 -14"
            stroke="#3a2418" strokeWidth="1" fill="none" opacity="0.6" />
          <path d="M 20 2 L 55 -8 M 25 6 L 60 0 M 15 -2 L 45 -14"
            stroke="#3a2418" strokeWidth="1" fill="none" opacity="0.6" />
          <ellipse cx="0" cy="2" rx="12" ry="18" fill="#7a4e34" filter="url(#watercolorSoft)" />
          <ellipse cx="0" cy="6" rx="8" ry="12" fill="#a06a48" opacity="0.5" />
          <ellipse cx="0" cy="-14" rx="10" ry="9" fill="#6a4028" filter="url(#watercolorSoft)" />
          <ellipse cx="-3" cy="-15" rx="2" ry="1.5" fill="#ffd000" />
          <ellipse cx="3" cy="-15" rx="2" ry="1.5" fill="#ffd000" />
          <circle cx="-3" cy="-15" r="0.8" fill="#1a1a1a" />
          <circle cx="3" cy="-15" r="0.8" fill="#1a1a1a" />
          <path d="M -2 -10 L 0 -4 L 2 -10 L 0 -8 Z" fill="#ffb030" stroke="#a06020" strokeWidth="0.5" />
          <path d="M -5 18 L -7 24 M -3 18 L -3 26 M -1 18 L 1 25" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 5 18 L 7 24 M 3 18 L 3 26 M 1 18 L -1 25" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M -4 18 L -8 28 L 0 24 L 8 28 L 4 18 Z" fill="#5a3a28" filter="url(#watercolorSoft)" />
          <path d="M -8 -19 L -2 -17 M 8 -19 L 2 -17" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

/* ─── FOOD REWARD ─── */
function FoodReward({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 1800);
    return () => clearTimeout(t);
  }, [onComplete]);
  const foods = ["🍌", "🍎", "🥕", "🍓", "🥜"];
  const food = foods[Math.floor(Math.random() * foods.length)];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100, overflow: "hidden" }}>
      <style>{`
        @keyframes foodFloat {
          0% { transform: translate(-50%, 100%) scale(0.5); opacity: 0; }
          15% { opacity: 1; transform: translate(-50%, 50%) scale(1.3); }
          30% { transform: translate(-50%, 30%) scale(1) rotate(-10deg); }
          50% { transform: translate(-50%, 10%) scale(1.1) rotate(8deg); }
          80% { opacity: 1; transform: translate(-50%, -20%) scale(0.95) rotate(-5deg); }
          100% { transform: translate(-50%, -60%) scale(0.7); opacity: 0; }
        }
        @keyframes sparkleFloat {
          0% { transform: translate(var(--sx), 100%) scale(0); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translate(var(--sx), -50%) scale(1.3); opacity: 0; }
        }
      `}</style>
      <div style={{ position: "absolute", left: "50%", top: "50%", fontSize: 80,
        animation: "foodFloat 1.8s ease-out forwards",
        textShadow: "0 4px 16px rgba(237,184,48,0.5)" }}>{food}</div>
      {[0,1,2,3,4,5].map(i => (
        <div key={i} style={{
          position: "absolute", left: "50%", top: "50%", fontSize: 24, color: C.gold,
          "--sx": `${(i - 2.5) * 60}px`,
          animation: `sparkleFloat ${1.5 + i * 0.1}s ease-out ${i * 0.1}s forwards`,
        }}>✨</div>
      ))}
    </div>
  );
}

/* ─── QUIZ GAME ─── */
function QuizGame({ studentId, studentName, questions, onClose, onCorrect, onWrong }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showHawk, setShowHawk] = useState(false);
  const [showFood, setShowFood] = useState(false);
  const [score, setScore] = useState(0);
  const [monkeyShake, setMonkeyShake] = useState(false);
  const [monkeyHappy, setMonkeyHappy] = useState(false);
  const [finished, setFinished] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 12px" }}>📚 No Quiz Yet</h2>
          <p style={{ color: C.textLight, fontSize: 16 }}>Your teacher hasn't assigned a quiz to you yet!</p>
          <button onClick={onClose} style={primaryBtnStyle}>Okay</button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const isLast = currentIdx >= questions.length - 1;

  const pickAnswer = (idx) => {
    if (showResult) return;
    setSelected(idx);
    setShowResult(true);
    if (idx === currentQ.correct) {
      setScore(s => s + 1);
      setMonkeyHappy(true);
      setShowFood(true);
      onCorrect();
      setTimeout(() => setMonkeyHappy(false), 1500);
    } else {
      setMonkeyShake(true);
      setShowHawk(true);
      onWrong();
      setTimeout(() => setMonkeyShake(false), 2200);
    }
  };

  const nextQuestion = () => {
    if (isLast) setFinished(true);
    else { setCurrentIdx(i => i + 1); setSelected(null); setShowResult(false); }
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center", width: 460 }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 8px", fontSize: 28 }}>🎉 Quiz Complete!</h2>
          <p style={{ color: C.textLight, fontSize: 18, margin: "0 0 20px" }}>{studentName}, you finished!</p>
          <div style={{ fontSize: 64, color: C.gold, fontWeight: 700, marginBottom: 8 }}>{score} / {questions.length}</div>
          <div style={{ fontSize: 22, color: pct >= 80 ? C.green : pct >= 50 ? C.gold : C.accent, fontWeight: 700, marginBottom: 16 }}>
            {pct >= 80 ? "Amazing!" : pct >= 50 ? "Good job!" : "Keep practicing!"}
          </div>
          <p style={{ color: C.textLight, fontSize: 16 }}>You earned {score} point{score !== 1 ? "s" : ""}!</p>
          <button onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 16 }}>Back to the Hot Spring</button>
        </div>
      </div>
    );
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalCardStyle, width: 580, maxWidth: "95vw", position: "relative", overflow: "hidden" }}>
        {showHawk && <HawkAttack onComplete={() => setShowHawk(false)} />}
        {showFood && <FoodReward onComplete={() => setShowFood(false)} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>📚 Quiz Time!</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 13 }}>
              Question {currentIdx + 1} of {questions.length} · Score: {score}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>
        <div style={{ height: 8, background: `${C.fur2}30`, borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${((currentIdx + (showResult ? 1 : 0)) / questions.length) * 100}%`,
            background: `linear-gradient(90deg, ${C.gold}, ${C.green})`, transition: "width 0.4s" }} />
        </div>
        <div style={{ textAlign: "center", marginBottom: 16, height: 100 }}>
          <div style={{ display: "inline-block",
            animation: monkeyShake ? "monkeyShake 0.4s ease infinite" : monkeyHappy ? "monkeyJoy 0.6s ease infinite" : "none" }}>
            <style>{`
              @keyframes monkeyShake { 0%,100% { transform: translateX(0) rotate(0); } 25% { transform: translateX(-6px) rotate(-5deg); } 75% { transform: translateX(6px) rotate(5deg); } }
              @keyframes monkeyJoy { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.05); } }
            `}</style>
            <MonkeySVG size={90} mood={monkeyHappy ? "excited" : monkeyShake ? "neutral" : "happy"} variant={5} />
          </div>
        </div>
        <div style={{ background: `${C.snow1}80`, borderRadius: 16, padding: "18px 22px", marginBottom: 16,
          fontSize: 20, color: C.text, fontWeight: 600, textAlign: "center",
          minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {currentQ.q}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {currentQ.options.map((opt, idx) => {
            const isCorrect = idx === currentQ.correct;
            const isSelected = idx === selected;
            const colors = [C.accent, C.gold, "#5a8fc7", C.green];
            let bg = colors[idx];
            let textColor = "white";
            if (showResult) {
              if (isCorrect) bg = C.green;
              else if (isSelected) bg = "#a85050";
              else { bg = `${colors[idx]}50`; textColor = `${C.text}80`; }
            }
            return (
              <button key={idx} onClick={() => pickAnswer(idx)} disabled={showResult}
                style={{ padding: "16px 14px", borderRadius: 14, border: "none",
                  background: bg, color: textColor,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                  cursor: showResult ? "default" : "pointer",
                  transition: "all 0.3s, transform 0.15s",
                  boxShadow: isSelected ? `0 0 0 3px ${C.text}` : "0 3px 8px rgba(0,0,0,0.1)",
                  textAlign: "left", display: "flex", alignItems: "center", gap: 10, minHeight: 60 }}
                onMouseEnter={e => !showResult && (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => !showResult && (e.currentTarget.style.transform = "translateY(0)")}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  fontSize: 16, fontWeight: 700 }}>{"ABCD"[idx]}</span>
                <span style={{ flex: 1 }}>{opt}</span>
                {showResult && isCorrect && <span style={{ fontSize: 22 }}>✓</span>}
                {showResult && isSelected && !isCorrect && <span style={{ fontSize: 22 }}>✗</span>}
              </button>
            );
          })}
        </div>
        {showResult && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: selected === currentQ.correct ? C.green : C.accent,
              fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>
              {selected === currentQ.correct
                ? "🎉 Correct! Your monkey gets a treat!"
                : "🦅 Yikes! A hawk attacked your monkey!"}
            </p>
            <button onClick={nextQuestion} disabled={showHawk || showFood}
              style={{ ...primaryBtnStyle, opacity: (showHawk || showFood) ? 0.5 : 1 }}>
              {isLast ? "Finish Quiz" : "Next Question →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const modalBackdropStyle = {
  position: "fixed", inset: 0, zIndex: 2000, display: "flex",
  alignItems: "center", justifyContent: "center",
  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
};
const modalCardStyle = {
  background: C.card, borderRadius: 24, padding: "28px 32px", width: 420, maxWidth: "95vw",
  boxShadow: "0 24px 64px rgba(0,0,0,0.25)", border: `2px solid ${C.gold}30`,
  fontFamily: "'Patrick Hand', cursive",
};
const primaryBtnStyle = {
  padding: "12px 28px", borderRadius: 14, border: "none", cursor: "pointer",
  background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`,
  color: "white", fontFamily: "'Patrick Hand', cursive", fontSize: 18, fontWeight: 700,
};

/* ═══════════════════════════════════════════════════════════════
   MAIN APP — uses Firebase Firestore for all data persistence
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [anyHovering, setAnyHovering] = useState(false);
  return (
    <HoverContext.Provider value={{ anyHovering, setAnyHovering }}>
      <AppInner />
    </HoverContext.Provider>
  );
}

function AppInner() {
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
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizzes, setQuizzes] = useState({});
  const [showQuizUpload, setShowQuizUpload] = useState(false);
  const [showAccessories, setShowAccessories] = useState(false);
  const [showPetMart, setShowPetMart] = useState(false);
  const [quizUploadStudentId, setQuizUploadStudentId] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [csvError, setCsvError] = useState("");

  // Load from Firebase on mount
  useEffect(() => {
    (async () => {
      try {
        const t = await getTeachers();
        const s = await getStudents();
        const q = await getQuizzes();
        setTeachers(t);
        setStudents(s);
        setQuizzes(q);
      } catch (err) {
        console.error("Firebase load error:", err);
      }
      setLoading(false);
    })();
  }, []);

  const refreshStudents = async () => {
    const s = await getStudents();
    setStudents(s);
  };

  const refreshQuizzes = async () => {
    const q = await getQuizzes();
    setQuizzes(q);
  };

  const uploadQuizForStudent = async (studentId, csvData) => {
    const parsed = parseCSV(csvData);
    if (!parsed) return { error: "Couldn't parse CSV. Make sure your file has columns: question, A, B, C, D, correct" };
    if (parsed.length === 0) return { error: "No questions found in CSV" };
    try {
      await setQuizForStudent(studentId, parsed);
      await refreshQuizzes();
      return { success: parsed.length };
    } catch (err) {
      return { error: "Error saving quiz: " + err.message };
    }
  };

  const removeQuizForStudent = async (studentId) => {
    try {
      await deleteQuizForStudent(studentId);
      await refreshQuizzes();
    } catch (err) {
      notify("Error removing quiz", "error");
    }
  };

  const handleQuizCorrect = async () => {
    if (!user) return;
    const st = students.find(s => s.id === user.id);
    if (!st) return;
    try {
      await updateStudent(user.id, { points: st.points + 1 });
      await refreshStudents();
    } catch (err) {
      console.error("Quiz point update error:", err);
    }
  };

  const handleQuizWrong = () => {};

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

  const toggleAccessory = async (studentId, accessory) => {
    const st = students.find(s => s.id === studentId);
    if (!st) return;
    const current = st.accessories || [];
    const has = current.includes(accessory);
    const headwear = ["hat", "beanie", "crown", "flower", "headphones"];
    let next;
    if (has) {
      next = current.filter(a => a !== accessory);
    } else if (headwear.includes(accessory)) {
      next = [...current.filter(a => !headwear.includes(a)), accessory];
    } else {
      next = [...current, accessory];
    }
    try {
      await updateStudent(studentId, { accessories: next });
      await refreshStudents();
    } catch (err) {
      notify("Error updating accessories", "error");
    }
  };

  const clearAccessories = async (studentId) => {
    try {
      await updateStudent(studentId, { accessories: [] });
      await refreshStudents();
      notify("Accessories cleared!");
    } catch (err) {
      notify("Error clearing accessories", "error");
    }
  };

  const buyPet = async (studentId, petId) => {
    const pet = PET_CATALOG.find(p => p.id === petId);
    const st = students.find(s => s.id === studentId);
    if (!pet || !st) return;
    if (st.pet === petId) {
      // unequip
      try {
        await updateStudent(studentId, { pet: null });
        await refreshStudents();
        notify(`${pet.name} sent home for now`);
      } catch (err) { notify("Error", "error"); }
      return;
    }
    const ownedPets = st.ownedPets || [];
    if (ownedPets.includes(petId)) {
      try {
        await updateStudent(studentId, { pet: petId });
        await refreshStudents();
        notify(`${pet.emoji} ${pet.name} is by your side!`);
      } catch (err) { notify("Error", "error"); }
      return;
    }
    if (st.points < pet.price) {
      notify(`Not enough stars! Need ${pet.price - st.points} more ★`, "error");
      return;
    }
    try {
      await updateStudent(studentId, {
        points: st.points - pet.price,
        pet: petId,
        ownedPets: [...ownedPets, petId],
      });
      await refreshStudents();
      notify(`🎉 You adopted a ${pet.name}! ${pet.emoji}`);
    } catch (err) { notify("Error buying pet", "error"); }
  };

  const logout = () => { setUser(null); setScreen("login"); setSelectedStudent(null); setShowManage(false); setShowAddStudent(false); setShowWordle(false); setShowQuiz(false); setShowQuizUpload(false); setShowAccessories(false); setShowPetMart(false); };

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
          <div style={{ position: "absolute", top: 72, right: 28, zIndex: 30, background: C.card, borderRadius: 22, padding: 24, width: 380, boxShadow: "0 16px 48px rgba(0,0,0,0.15)", border: `2px solid ${C.accent}30`, maxHeight: "75vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: C.text, fontSize: 22 }}>Student List</h3>
            {students.length === 0 && <p style={{ color: C.textLight }}>No students yet!</p>}
            {students.map(s => {
              const hasQuiz = quizzes[s.id] && quizzes[s.id].length > 0;
              return (
                <div key={s.id} style={{ padding: "10px 14px", borderRadius: 14, background: `${C.snow1}80`, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 16, color: C.text, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: C.textLight }}>@{s.username} · ★ {s.points} pts</div>
                    </div>
                    <button onClick={() => { if (confirm(`Remove ${s.name}?`)) removeStudentHandler(s.id); }} style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: `${C.accent}15`, color: C.accentDark, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 14 }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button onClick={() => { setQuizUploadStudentId(s.id); setShowQuizUpload(true); setCsvText(""); setCsvError(""); }}
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "none",
                        background: hasQuiz ? `${C.green}25` : `${C.accent}15`,
                        color: hasQuiz ? C.green : C.accent,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      📚 {hasQuiz ? `Quiz set (${quizzes[s.id].length} Qs)` : "Set Quiz"}
                    </button>
                    {hasQuiz && (
                      <button onClick={() => { if (confirm(`Remove quiz for ${s.name}?`)) removeQuizForStudent(s.id); }}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: `${C.accent}15`, color: C.accentDark, cursor: "pointer", fontSize: 12, fontFamily: "'Patrick Hand', cursive" }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showQuizUpload && (() => {
          const targetStudent = students.find(s => s.id === quizUploadStudentId);
          const handleFileUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => setCsvText(ev.target.result);
            reader.readAsText(file);
          };
          const submitQuiz = async () => {
            if (!csvText.trim()) { setCsvError("Please paste CSV or upload a file"); return; }
            const result = await uploadQuizForStudent(quizUploadStudentId, csvText);
            if (result.error) { setCsvError(result.error); return; }
            notify(`Quiz set for ${targetStudent?.name}: ${result.success} questions!`);
            setShowQuizUpload(false);
          };
          return (
            <div style={modalBackdropStyle} onClick={() => setShowQuizUpload(false)}>
              <div style={{ ...modalCardStyle, width: 580 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>📚 Set Quiz for {targetStudent?.name}</h2>
                  <button onClick={() => setShowQuizUpload(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ background: `${C.snow1}80`, borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 13, color: C.textLight }}>
                  <strong style={{ color: C.text }}>CSV Format:</strong> Headers must be <code>question, A, B, C, D, correct</code><br/>
                  The "correct" column should be A, B, C, or D (matching the right answer).<br/>
                  <span style={{ color: C.green }}>Example row:</span> <code>What is 2+2?,3,4,5,6,B</code>
                </div>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
                  style={{ marginBottom: 10, fontFamily: "'Patrick Hand', cursive", fontSize: 14, color: C.text }} />
                <textarea value={csvText} onChange={e => { setCsvText(e.target.value); setCsvError(""); }}
                  placeholder={"question,A,B,C,D,correct\nWhat is the capital of France?,Berlin,Madrid,Paris,Rome,C\nWhat is 5+3?,7,8,9,10,B"}
                  style={{
                    width: "100%", height: 180, padding: 12, borderRadius: 10,
                    border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`,
                    fontFamily: "monospace", fontSize: 13, color: C.text,
                    resize: "vertical", outline: "none", boxSizing: "border-box",
                  }} />
                {csvError && <p style={{ color: C.accentDark, fontSize: 14, margin: "8px 0 0" }}>{csvError}</p>}
                <button onClick={submitQuiz} style={{ ...primaryBtnStyle, width: "100%", marginTop: 14 }}>
                  Save Quiz
                </button>
              </div>
            </div>
          );
        })()}

        <div style={{ position: "relative", margin: "8px auto 0", width: "96%", maxWidth: 1300, height: "calc(100vh - 90px)", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
          <BackgroundScene w={1300} h={800} />
          <div style={{ position: "absolute", top: "30%", left: "6%", right: "6%", bottom: "6%", borderRadius: 20, overflow: "hidden" }}>
            <WaterCanvas width={1150} height={550} />
          </div>
          <SteamParticles count={18} />
          <PenguinFlock />
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
                  <MonkeySVG size={students.length > 10 ? 80 : students.length > 6 ? 95 : 110} mood={s.points > 20 ? "excited" : s.points > 5 ? "happy" : "neutral"} label={s.name} points={s.points} delay={i * 0.4} variant={i} accessories={s.accessories || []} pet={s.pet} selected={selectedStudent === s.id} onClick={() => setSelectedStudent(selectedStudent === s.id ? null : s.id)} />
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
            <div style={{ width: 1, height: 28, background: C.fur2 + "30" }} />
            <button onClick={() => setShowAccessories(true)}
              style={{ padding: "10px 18px", borderRadius: 12, border: `2px solid ${C.gold}50`, background: `${C.gold}20`, color: C.text, fontFamily: "'Patrick Hand', cursive", fontSize: 16, cursor: "pointer", fontWeight: 700 }}>
              ✨ Accessories
            </button>
            <button onClick={() => setSelectedStudent(null)} style={{ padding: "7px 12px", borderRadius: 10, border: `2px solid ${C.fur2}25`, background: "transparent", color: C.textLight, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 14 }}>✕</button>
          </div>
        )}

        {showAccessories && sel && (() => {
          const accessoryOptions = [
            { id: "hat", emoji: "🎩", label: "Top Hat" },
            { id: "beanie", emoji: "🧢", label: "Beanie" },
            { id: "crown", emoji: "👑", label: "Crown" },
            { id: "flower", emoji: "🌸", label: "Flower" },
            { id: "headphones", emoji: "🎧", label: "Headphones" },
            { id: "sunglasses", emoji: "🕶️", label: "Sunglasses" },
            { id: "scarf", emoji: "🧣", label: "Scarf" },
            { id: "bowtie", emoji: "🎀", label: "Bow Tie" },
          ];
          const current = sel.accessories || [];
          return (
            <div style={modalBackdropStyle} onClick={() => setShowAccessories(false)}>
              <div style={{ ...modalCardStyle, width: 540 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>✨ Dress up {sel.name}</h2>
                  <button onClick={() => setShowAccessories(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  background: `${C.snow1}80`, borderRadius: 18, padding: 16, marginBottom: 18,
                  height: 160,
                }}>
                  <MonkeySVG size={140} mood="happy" delay={0}
                    variant={students.findIndex(st => st.id === sel.id)}
                    accessories={current} />
                </div>
                <p style={{ color: C.textLight, fontSize: 13, margin: "0 0 10px", textAlign: "center" }}>
                  Tap to toggle on/off. Only one head accessory at a time.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                  {accessoryOptions.map(opt => {
                    const active = current.includes(opt.id);
                    return (
                      <button key={opt.id} onClick={() => toggleAccessory(sel.id, opt.id)}
                        style={{
                          padding: "12px 8px", borderRadius: 14,
                          border: active ? `2.5px solid ${C.gold}` : `2px solid ${C.fur2}40`,
                          background: active ? `${C.gold}20` : `${C.snow1}80`,
                          cursor: "pointer", transition: "all 0.2s",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          fontFamily: "'Patrick Hand', cursive",
                        }}
                        onMouseEnter={e => !active && (e.currentTarget.style.transform = "translateY(-2px)")}
                        onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
                        <span style={{ fontSize: 32 }}>{opt.emoji}</span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{opt.label}</span>
                        {active && <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>EQUIPPED</span>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => clearAccessories(sel.id)}
                    style={{ padding: "9px 16px", borderRadius: 10, border: `2px solid ${C.accent}40`, background: "transparent", color: C.accentDark, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 14, fontWeight: 600 }}>
                    Remove All
                  </button>
                  <span style={{ fontSize: 13, color: C.textLight }}>
                    {current.length} accessor{current.length === 1 ? "y" : "ies"} equipped
                  </span>
                  <button onClick={() => setShowAccessories(false)} style={primaryBtnStyle}>Done</button>
                </div>
              </div>
            </div>
          );
        })()}
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

        {showQuiz && (
          <QuizGame
            studentId={me?.id}
            studentName={me?.name}
            questions={quizzes[me?.id]}
            onClose={() => setShowQuiz(false)}
            onCorrect={handleQuizCorrect}
            onWrong={handleQuizWrong}
          />
        )}

        {(() => {
          const done = hasCompletedChallenge(me?.id);
          const hasQuiz = quizzes[me?.id] && quizzes[me?.id].length > 0;
          return (
            <div style={{ position: "absolute", top: 74, left: "50%", transform: "translateX(-50%)", zIndex: 25, display: "flex", gap: 10 }}>
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
              <button onClick={() => setShowQuiz(true)}
                style={{
                  padding: "10px 22px", borderRadius: 16,
                  border: `2px solid ${hasQuiz ? C.accent + "60" : C.fur2 + "50"}`,
                  background: hasQuiz ? `${C.card}ee` : `${C.card}cc`,
                  color: hasQuiz ? C.text : C.textLight,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: hasQuiz ? `0 4px 14px ${C.accent}30` : "none",
                  transition: "all 0.3s", display: "flex", alignItems: "center", gap: 8,
                  backdropFilter: "blur(8px)",
                }}>
                {hasQuiz ? `📚 Quiz Time! (${quizzes[me?.id].length} Qs)` : "📚 No Quiz Yet"}
              </button>
              <button onClick={() => setShowPetMart(true)}
                style={{
                  padding: "10px 22px", borderRadius: 16,
                  border: `2px solid ${C.green}60`,
                  background: `${C.card}ee`,
                  color: C.text,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: `0 4px 14px ${C.green}30`,
                  transition: "all 0.3s", display: "flex", alignItems: "center", gap: 8,
                  backdropFilter: "blur(8px)",
                }}>
                🏪 Pet Mart
              </button>
            </div>
          );
        })()}

        {showPetMart && me && (() => {
          const owned = me.ownedPets || [];
          const equipped = me.pet;
          return (
            <div style={modalBackdropStyle} onClick={() => setShowPetMart(false)}>
              <div style={{ ...modalCardStyle, width: 720, maxWidth: "95vw", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <h2 style={{ margin: 0, color: C.text, fontSize: 26 }}>🏪 Pet Mart</h2>
                    <p style={{ margin: "2px 0 0", color: C.textLight, fontSize: 14 }}>Adopt a companion for your monkey!</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ background: `${C.gold}20`, borderRadius: 12, padding: "8px 16px", border: `2px solid ${C.gold}50` }}>
                      <span style={{ fontSize: 22, color: C.gold, fontWeight: 700 }}>★ {me.points}</span>
                    </div>
                    <button onClick={() => setShowPetMart(false)} style={{ background: "none", border: "none", fontSize: 24, color: C.textLight, cursor: "pointer" }}>✕</button>
                  </div>
                </div>

                <div style={{ background: `${C.snow1}80`, borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 13, color: C.textLight, textAlign: "center" }}>
                  💡 Tap a pet you own to make them follow your monkey. Tap again to send them home.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {PET_CATALOG.map(pet => {
                    const isOwned = owned.includes(pet.id);
                    const isEquipped = equipped === pet.id;
                    const canAfford = me.points >= pet.price;
                    const rarityColor = RARITY_COLORS[pet.rarity];
                    return (
                      <div key={pet.id} style={{
                        background: isEquipped ? `${C.gold}15` : `${C.snow1}90`,
                        borderRadius: 16,
                        padding: 14,
                        border: isEquipped ? `2.5px solid ${C.gold}` : `2px solid ${rarityColor}40`,
                        position: "relative",
                        opacity: !isOwned && !canAfford ? 0.6 : 1,
                      }}>
                        <div style={{
                          position: "absolute", top: 8, right: 8,
                          background: rarityColor, color: "white",
                          fontSize: 10, fontWeight: 700, padding: "2px 8px",
                          borderRadius: 8, letterSpacing: 0.5, textTransform: "uppercase",
                        }}>{pet.rarity}</div>
                        {isEquipped && (
                          <div style={{
                            position: "absolute", top: 8, left: 8,
                            background: C.gold, color: "white",
                            fontSize: 10, fontWeight: 700, padding: "2px 8px",
                            borderRadius: 8,
                          }}>EQUIPPED</div>
                        )}
                        <div style={{ fontSize: 56, textAlign: "center", marginTop: 16, marginBottom: 6 }}>
                          {pet.emoji}
                        </div>
                        <div style={{ fontSize: 17, color: C.text, fontWeight: 700, textAlign: "center" }}>
                          {pet.name}
                        </div>
                        <div style={{ fontSize: 14, color: C.gold, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>
                          ★ {pet.price.toLocaleString()}
                        </div>
                        <button onClick={() => buyPet(me.id, pet.id)}
                          disabled={!isOwned && !canAfford}
                          style={{
                            width: "100%", padding: "8px 12px", borderRadius: 10, border: "none",
                            background: isEquipped ? C.accent : isOwned ? C.green : canAfford ? rarityColor : `${C.fur2}80`,
                            color: "white",
                            fontFamily: "'Patrick Hand', cursive", fontSize: 14, fontWeight: 700,
                            cursor: (!isOwned && !canAfford) ? "not-allowed" : "pointer",
                            transition: "transform 0.15s",
                          }}
                          onMouseEnter={e => (isOwned || canAfford) && (e.currentTarget.style.transform = "translateY(-2px)")}
                          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
                          {isEquipped ? "Send Home" : isOwned ? "Adopt!" : canAfford ? "Buy" : `Need ${pet.price - me.points} more ★`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        <div style={{ position: "relative", margin: "8px auto 0", width: "96%", maxWidth: 1300, height: "calc(100vh - 90px)", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
          <BackgroundScene w={1300} h={800} />
          <div style={{ position: "absolute", top: "30%", left: "6%", right: "6%", bottom: "6%", borderRadius: 20, overflow: "hidden" }}>
            <WaterCanvas width={1150} height={550} />
          </div>
          <SteamParticles count={18} />
          <PenguinFlock />

          <div style={{ position: "absolute", top: "28%", left: "5%", right: "5%", bottom: "5%", zIndex: 10 }}>
            {students.map((s, i) => {
              const pos = monkeyPositions[i % monkeyPositions.length];
              const isMe = s.id === me?.id;
              return (
                <div key={s.id} style={{ position: "absolute", left: pos.left, top: pos.top, zIndex: isMe ? 18 : 15 }}>
                  <MonkeySVG size={students.length > 10 ? 80 : students.length > 6 ? 95 : 110} mood={s.points > 20 ? "excited" : s.points > 5 ? "happy" : "neutral"} label={s.name} points={s.points} delay={i * 0.4} variant={i} accessories={s.accessories || []} pet={s.pet} selected={isMe} />
                </div>
              );
            })}
          </div>

          <div style={{
            position: "absolute", bottom: 16, right: 16, zIndex: 30,
            background: `${C.card}e8`, borderRadius: 18, padding: "14px 16px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
            border: `2px solid ${C.gold}25`, width: 240,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 10, textAlign: "center" }}>🏆 Leaderboard</div>

            {/* Top 3 - always visible */}
            <div style={{ marginBottom: sorted.length > 3 ? 8 : 0 }}>
              {sorted.slice(0, 3).map((s, i) => {
                const isMe = s.id === me?.id;
                const podiumBg = i === 0 ? `${C.gold}25` : i === 1 ? "#b0b0b020" : "#cd7f3220";
                return (
                  <div key={s.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 10px", borderRadius: 10,
                    background: isMe ? `${C.gold}30` : podiumBg,
                    marginBottom: 4,
                    border: isMe ? `1.5px solid ${C.gold}80` : "1.5px solid transparent",
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 700, width: 26, textAlign: "center", flexShrink: 0 }}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </span>
                    <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 700,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}{isMe ? " ✦" : ""}
                    </span>
                    <span style={{ fontSize: 14, color: C.gold, fontWeight: 700, flexShrink: 0 }}>★{s.points}</span>
                  </div>
                );
              })}
            </div>

            {/* Rest scrollable */}
            {sorted.length > 3 && (
              <>
                <div style={{
                  fontSize: 11, color: C.textLight, textAlign: "center",
                  marginBottom: 4, opacity: 0.7, letterSpacing: 0.5,
                }}>— rest of the troop —</div>
                <style>{`
                  .leaderboard-scroll::-webkit-scrollbar { width: 5px; }
                  .leaderboard-scroll::-webkit-scrollbar-track { background: transparent; }
                  .leaderboard-scroll::-webkit-scrollbar-thumb { background: ${C.fur2}80; border-radius: 4px; }
                  .leaderboard-scroll::-webkit-scrollbar-thumb:hover { background: ${C.fur3}; }
                `}</style>
                <div className="leaderboard-scroll" style={{
                  maxHeight: 140, overflowY: "auto", paddingRight: 4,
                  scrollbarWidth: "thin", scrollbarColor: `${C.fur2} transparent`,
                }}>
                  {sorted.slice(3).map((s, i) => {
                    const isMe = s.id === me?.id;
                    const rank = i + 4;
                    return (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "5px 8px", borderRadius: 8,
                        background: isMe ? `${C.gold}18` : "transparent",
                        marginBottom: 2,
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, width: 26, textAlign: "center", flexShrink: 0, color: C.textLight }}>
                          #{rank}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: isMe ? 700 : 400,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.name}{isMe ? " ✦" : ""}
                        </span>
                        <span style={{ fontSize: 13, color: C.gold, fontWeight: 700, flexShrink: 0 }}>★{s.points}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{
            position: "absolute", bottom: 16, left: 16, zIndex: 30,
            background: `${C.card}e8`, borderRadius: 18, padding: "14px 20px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
            border: `2px solid ${C.gold}25`, display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ width: 50, height: 50, position: "relative" }}>
              <MonkeySVG size={50} mood={me?.points > 20 ? "excited" : me?.points > 5 ? "happy" : "neutral"} delay={0} variant={myIndex >= 0 ? myIndex : 0} accessories={me?.accessories || []} pet={me?.pet} />
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
