import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import {
  getTeachers, getStudents, updateStudent, addStudentToDB, deleteStudent,
  setQuizzesForStudent, deleteQuizzesForStudent, getQuizzes,
  setMissionsForStudent, deleteMissionsForStudent, getMissions
} from "./firebase";

/* ─── Hover context: tells penguins to pause when any monkey is hovered ─── */
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

/* ─── Firebase helpers ─── */
// Firebase functions are imported from ./firebase.js
// Teachers and Students are stored in Firestore, Quizzes are in collections
const DEFAULT_TEACHERS = [{ id: "t1", username: "teacher", password: "1234", name: "Sensei" }];

/* ─── daily wordle words (kid-friendly 5-letter) ─── */
const WORDS = [
  "happy","smile","cloud","dream","light","music","dance","heart","beach","plant",
  "ocean","tiger","brave","candy","frost","jolly","magic","noble","peace","quiet",
  "river","sunny","toast","unity","vivid","water","youth","bliss","charm","crisp",
  "eagle","flame","grape","hover","ivory","juice","kneel","lemon","maple","novel",
  "olive","pearl","queen","robin","stone","train","ultra","voice","whale","zebra",
  "angel","bloom","crane","drift","earth","fairy","globe","honey","igloo","jewel",
  "kite","lunar","marsh","night","orbit","piano","quest","ridge","steam","tulip",
  "umbra","valor","winds","xenon","yield","plaza","acorn","berry","coral","daisy",
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

/* ─── PETS ─── catalog of pets students get from mystery packs
   weeklyIncome = stars earned per week if equipped (capped, no compounding)
*/
const PET_CATALOG = [
  // Common (low income)
  { id: "fish",   name: "Crystal Goldie",   emoji: "🐠", rarity: "common",    weeklyIncome: 5  },
  { id: "duck",   name: "Splash Sprout",    emoji: "🦆", rarity: "common",    weeklyIncome: 5  },
  // Uncommon
  { id: "turtle", name: "Mossback Sage",    emoji: "🐢", rarity: "uncommon",  weeklyIncome: 10 },
  { id: "bunny",  name: "Frostpaw",         emoji: "🐰", rarity: "uncommon",  weeklyIncome: 10 },
  // Rare
  { id: "fox",    name: "Aurora Fox",       emoji: "🦊", rarity: "rare",      weeklyIncome: 18 },
  { id: "otter",  name: "River Spirit",     emoji: "🦦", rarity: "rare",      weeklyIncome: 18 },
  // Epic
  { id: "owl",    name: "Moonlit Sentinel", emoji: "🦉", rarity: "epic",      weeklyIncome: 28 },
  // Legendary
  { id: "panda",  name: "Bamboo Guardian",  emoji: "🐼", rarity: "legendary", weeklyIncome: 40 },
  // Mythic
  { id: "dragon", name: "Ember Wyrmling",   emoji: "🐲", rarity: "mythic",    weeklyIncome: 60 },
];
function getPet(id) { return PET_CATALOG.find(p => p.id === id); }

const RARITY_COLORS = {
  common: "#9aaab8", uncommon: "#5caa5e", rare: "#5a8fc7",
  epic: "#a060c0", legendary: "#edb830", mythic: "#e06060",
};

/* ─── MYSTERY PACKS ─── students buy packs, get random pet based on rarity weights */
const MYSTERY_PACKS = [
  {
    id: "starter",
    name: "Starter Bubble Pack",
    flavor: "🫧",
    description: "A simple pack with friendly common pets. Everyone gets something!",
    price: 150,
    color: "#8eb6cf",
    odds: { common: 80, uncommon: 20, rare: 0, epic: 0, legendary: 0, mythic: 0 },
  },
  {
    id: "jelly",
    name: "Jelly Drop Pack",
    flavor: "🍮",
    description: "Squishy and sweet — chance for an uncommon or rare pet!",
    price: 400,
    color: "#c980c0",
    odds: { common: 50, uncommon: 35, rare: 14, epic: 1, legendary: 0, mythic: 0 },
  },
  {
    id: "frost",
    name: "Frost Glimmer Pack",
    flavor: "❄️",
    description: "Icy mystery — solid chance for a rare companion. Could be epic!",
    price: 900,
    color: "#7adcdc",
    odds: { common: 25, uncommon: 35, rare: 30, epic: 8, legendary: 2, mythic: 0 },
  },
  {
    id: "sparkle",
    name: "Sparkle Surge Pack",
    flavor: "✨",
    description: "Glittering with magic. Big shot at epic and even legendary pets!",
    price: 1800,
    color: "#edb830",
    odds: { common: 10, uncommon: 25, rare: 30, epic: 25, legendary: 9, mythic: 1 },
  },
  {
    id: "mythic",
    name: "Cosmic Mythstone Pack",
    flavor: "🌌",
    description: "Forged from stars themselves. Best odds for legendary AND mythic!",
    price: 4000,
    color: "#a060c0",
    odds: { common: 0, uncommon: 10, rare: 25, epic: 35, legendary: 23, mythic: 7 },
  },
];

function rollPack(packId, ownedIds = []) {
  const pack = MYSTERY_PACKS.find(p => p.id === packId);
  if (!pack) return null;
  const total = Object.values(pack.odds).reduce((s, v) => s + v, 0);
  let roll = Math.random() * total;
  let chosenRarity = "common";
  for (const [rarity, weight] of Object.entries(pack.odds)) {
    if (roll < weight) { chosenRarity = rarity; break; }
    roll -= weight;
  }
  const candidates = PET_CATALOG.filter(p => p.rarity === chosenRarity);
  if (candidates.length === 0) {
    return PET_CATALOG.find(p => p.rarity === "common");
  }
  const unowned = candidates.filter(p => !ownedIds.includes(p.id));
  // Prefer unowned, but allow duplicates (will yield consolation stars)
  const pool = unowned.length > 0 ? unowned : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Weekly income calculator: 1 payout per 7 days, no compounding
function calculatePendingIncome(student, now = Date.now()) {
  if (!student?.pet) return 0;
  const pet = getPet(student.pet);
  if (!pet) return 0;
  const lastCollected = student.lastIncomeCollected || student.petAcquiredAt || now;
  const daysSince = (now - lastCollected) / (1000 * 60 * 60 * 24);
  if (daysSince < 7) return 0;
  return pet.weeklyIncome;
}
function getNextIncomeDate(student) {
  if (!student?.pet) return null;
  const last = student.lastIncomeCollected || student.petAcquiredAt;
  if (!last) return null;
  return new Date(last + 7 * 24 * 60 * 60 * 1000);
}


/* ─── ACCESSORIES ─── catalog of items students can equip
   slot: "head" (only one) | "face" | "neck" | "hold" (held in hand) | "back" | "body"
   Free items have price 0. Paid items cost stars.
*/
const ACCESSORY_CATALOG = [
  // ─── FREE BASICS ───
  { id: "hat",         name: "Top Hat",         emoji: "🎩", slot: "head", price: 0,    rarity: "common" },
  { id: "beanie",      name: "Cozy Beanie",     emoji: "🧢", slot: "head", price: 0,    rarity: "common" },
  { id: "flower",      name: "Flower",          emoji: "🌸", slot: "head", price: 0,    rarity: "common" },
  { id: "sunglasses",  name: "Sunglasses",      emoji: "🕶️", slot: "face", price: 0,    rarity: "common" },
  { id: "scarf",       name: "Cozy Scarf",      emoji: "🧣", slot: "neck", price: 0,    rarity: "common" },
  { id: "bowtie",      name: "Bow Tie",         emoji: "🎀", slot: "neck", price: 0,    rarity: "common" },

  // ─── PAID COOL ITEMS ───
  // Royalty / fashion
  { id: "crown",       name: "Royal Crown",     emoji: "👑", slot: "head", price: 800,  rarity: "rare" },
  { id: "earphones",   name: "Wired Earphones", emoji: "🎧", slot: "head", price: 250,  rarity: "uncommon" },
  { id: "vrheadset",   name: "VR Headset",      emoji: "🥽", slot: "head", price: 1200, rarity: "epic" },
  { id: "halo",        name: "Glowing Halo",    emoji: "😇", slot: "head", price: 3000, rarity: "legendary" },

  // Held items (sports / cool)
  { id: "tennis",      name: "Tennis Racket",   emoji: "🎾", slot: "hold", price: 400,  rarity: "uncommon" },
  { id: "basketball",  name: "Basketball",      emoji: "🏀", slot: "hold", price: 400,  rarity: "uncommon" },
  { id: "controller",  name: "Game Controller", emoji: "🎮", slot: "hold", price: 600,  rarity: "rare" },
  { id: "guitar",      name: "Mini Guitar",     emoji: "🎸", slot: "hold", price: 700,  rarity: "rare" },
  { id: "microphone",  name: "Microphone",      emoji: "🎤", slot: "hold", price: 500,  rarity: "uncommon" },
  { id: "umbrella",    name: "Cute Umbrella",   emoji: "☂️", slot: "hold", price: 350,  rarity: "uncommon" },
  { id: "lightsaber",  name: "Glow Saber",      emoji: "⚔️", slot: "hold", price: 1500, rarity: "epic" },
  { id: "magicwand",   name: "Magic Wand",      emoji: "🪄", slot: "hold", price: 2000, rarity: "legendary" },
  { id: "icecream",    name: "Ice Cream",       emoji: "🍦", slot: "hold", price: 200,  rarity: "common" },

  // Back items
  { id: "backpack",    name: "School Backpack", emoji: "🎒", slot: "back", price: 350,  rarity: "uncommon" },
  { id: "wings",       name: "Butterfly Wings", emoji: "🦋", slot: "back", price: 1800, rarity: "epic" },
  { id: "cape",        name: "Hero Cape",       emoji: "🦸", slot: "back", price: 1000, rarity: "rare" },
];

const ACCESSORY_SLOTS = ["head", "face", "neck", "hold", "back"];
function getAccessory(id) { return ACCESSORY_CATALOG.find(a => a.id === id); }
function isFreeAccessory(id) { const a = getAccessory(id); return a && a.price === 0; }
function getAccessoryBySlot(equippedIds, slot) {
  return equippedIds.map(getAccessory).find(a => a && a.slot === slot);
}

/* ─── STREAK LEVELS ─── each level gives the monkey visual upgrades */
const STREAK_LEVELS = [
  { days: 0,   id: "sprout",    name: "Sprout",    icon: "🌱", color: "#7cc080", desc: "Just getting started!" },
  { days: 3,   id: "bronze",    name: "Bronze",    icon: "🥉", color: "#cd7f32", desc: "Three days strong!" },
  { days: 7,   id: "silver",    name: "Silver",    icon: "🥈", color: "#c0c0c0", desc: "A whole week!" },
  { days: 14,  id: "gold",      name: "Gold",      icon: "🥇", color: "#edb830", desc: "Two weeks of glory!" },
  { days: 30,  id: "crystal",   name: "Crystal",   icon: "💎", color: "#7adcdc", desc: "A full month!" },
  { days: 60,  id: "rainbow",   name: "Rainbow",   icon: "🌈", color: "#ff80c0", desc: "Two months — incredible!" },
  { days: 100, id: "legendary", name: "Legendary", icon: "⭐", color: "#ff6020", desc: "100 days! A legend!" },
];

function getStreakLevel(streak) {
  let level = STREAK_LEVELS[0];
  for (const lvl of STREAK_LEVELS) {
    if (streak >= lvl.days) level = lvl;
  }
  return level;
}

function getNextStreakLevel(streak) {
  for (const lvl of STREAK_LEVELS) {
    if (streak < lvl.days) return lvl;
  }
  return null; // Max level
}

/* ─── SOUND SYSTEM ─── lazy Web Audio, works on iPad/iPhone/desktop */
let _audioCtx = null;
let _soundsEnabled = true;
const SFX_KEY = "monkeyTracker_soundsEnabled";

// Try to load preference (this runs on module load)
try {
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem(SFX_KEY);
    if (v !== null) _soundsEnabled = v === "true";
  }
} catch {}

function setSoundsEnabled(on) {
  _soundsEnabled = on;
  try { if (typeof localStorage !== "undefined") localStorage.setItem(SFX_KEY, String(on)); } catch {}
}
function getSoundsEnabled() { return _soundsEnabled; }

function getAudioCtx() {
  if (!_soundsEnabled) return null;
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      _audioCtx = new Ctx();
    } catch { return null; }
  }
  // iOS unlock - resume if suspended
  if (_audioCtx.state === "suspended") {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

// Schedule a tone with envelope
function _tone({ freq = 440, duration = 0.15, type = "sine", attack = 0.01, decay = null, peak = 0.18, when = 0, slideTo = null, slideTime = null }) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) {
    osc.frequency.linearRampToValueAtTime(slideTo, t0 + (slideTime || duration));
  }
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  if (decay !== null) {
    gain.gain.linearRampToValueAtTime(peak * 0.6, t0 + attack + decay);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// Brief noise burst for percussive sounds
function _noise({ duration = 0.08, peak = 0.12, when = 0, filterFreq = 2000 }) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

const SFX = {
  click: () => _tone({ freq: 800, duration: 0.06, type: "triangle", peak: 0.08 }),
  correct: () => {
    // Cheery 3-note ascending arpeggio: C-E-G
    _tone({ freq: 523, duration: 0.12, type: "triangle", peak: 0.18, when: 0 });
    _tone({ freq: 659, duration: 0.12, type: "triangle", peak: 0.18, when: 0.08 });
    _tone({ freq: 784, duration: 0.22, type: "triangle", peak: 0.20, when: 0.16 });
  },
  wrong: () => {
    // Descending sad buzzer
    _tone({ freq: 220, duration: 0.18, type: "sawtooth", peak: 0.14, when: 0, slideTo: 110, slideTime: 0.18 });
    _tone({ freq: 165, duration: 0.18, type: "sawtooth", peak: 0.10, when: 0.18, slideTo: 80, slideTime: 0.18 });
  },
  jump: () => {
    // Quick boing - rises in pitch
    _tone({ freq: 300, duration: 0.18, type: "sine", peak: 0.22, slideTo: 600, slideTime: 0.12 });
  },
  land: () => {
    _noise({ duration: 0.06, peak: 0.10, filterFreq: 800 });
  },
  reward: () => {
    // Magical sparkle - 4 ascending notes
    [523, 659, 784, 1047].forEach((f, i) => {
      _tone({ freq: f, duration: 0.18, type: "triangle", peak: 0.16, when: i * 0.06 });
    });
  },
  levelUp: () => {
    // Triumphant fanfare
    _tone({ freq: 392, duration: 0.14, type: "triangle", peak: 0.20, when: 0 });
    _tone({ freq: 523, duration: 0.14, type: "triangle", peak: 0.20, when: 0.10 });
    _tone({ freq: 659, duration: 0.14, type: "triangle", peak: 0.20, when: 0.20 });
    _tone({ freq: 784, duration: 0.30, type: "triangle", peak: 0.22, when: 0.30 });
  },
  packOpen: () => {
    // Mystical whoosh + chime
    _tone({ freq: 200, duration: 0.4, type: "sine", peak: 0.14, when: 0, slideTo: 800, slideTime: 0.4 });
    _noise({ duration: 0.3, peak: 0.08, when: 0.1, filterFreq: 3000 });
    _tone({ freq: 1047, duration: 0.3, type: "triangle", peak: 0.16, when: 0.4 });
  },
  hop: () => {
    // Subtle pop for monkey hops
    _tone({ freq: 600, duration: 0.08, type: "sine", peak: 0.10, slideTo: 900, slideTime: 0.05 });
  },
  collect: () => {
    // Coin pickup
    _tone({ freq: 988, duration: 0.08, type: "square", peak: 0.10, when: 0 });
    _tone({ freq: 1318, duration: 0.12, type: "square", peak: 0.10, when: 0.05 });
  },
  gameOver: () => {
    // Sad descending fanfare
    _tone({ freq: 392, duration: 0.18, type: "triangle", peak: 0.18, when: 0 });
    _tone({ freq: 330, duration: 0.18, type: "triangle", peak: 0.18, when: 0.14 });
    _tone({ freq: 262, duration: 0.36, type: "triangle", peak: 0.20, when: 0.28 });
  },
};

/* ─── PET SVG ─── small companion that floats next to the monkey */
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
function MonkeySVG({ size = 120, mood = "happy", label, points, onClick, delay = 0, style = {}, selected, variant = 0, accessories = [], pet = null, streakLevel = "sprout" }) {
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
      // Bobbing intensifies when hovering (splash effect)
      const bobAmp = hoveringRef.current ? 9 : 5;
      const swayAmp = hoveringRef.current ? 7 : 3.5;
      setBob(Math.sin(t * (hoveringRef.current ? speed1 * 2.2 : speed1)) * bobAmp + Math.sin(t * 0.4) * 2);
      setSway(Math.sin(t * (hoveringRef.current ? speed2 * 2 : speed2) + 0.8) * swayAmp);
      // Slow drift around the pool
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

  // Spawn splash droplets while hovering
  useEffect(() => {
    if (!hovering) return;
    const interval = setInterval(() => {
      const id = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 20;
      const newSplash = {
        id,
        startX: 0, startY: 28,
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
      {/* Splash droplets */}
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
        {/* ─── STREAK AURA ─── visual upgrades for daily streaks */}
        {streakLevel !== "sprout" && (() => {
          const lvl = STREAK_LEVELS.find(l => l.id === streakLevel);
          if (!lvl) return null;
          return (
            <g style={{ pointerEvents: "none" }}>
              <style>{`
                @keyframes streakPulse-${streakLevel} {
                  0%, 100% { opacity: 0.35; transform: scale(1); }
                  50% { opacity: 0.55; transform: scale(1.08); }
                }
                @keyframes streakRotate-${streakLevel} {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                @keyframes streakSparkle-${streakLevel} {
                  0%, 100% { opacity: 0; transform: scale(0.5); }
                  50% { opacity: 1; transform: scale(1.2); }
                }
              `}</style>
              {/* Outer aura glow */}
              <ellipse cx="0" cy="-10" rx="48" ry="55" fill={lvl.color} opacity="0.18"
                style={{ animation: `streakPulse-${streakLevel} 2.5s ease-in-out infinite`, transformOrigin: "0px -10px" }} />
              {/* Inner aura */}
              <ellipse cx="0" cy="-10" rx="38" ry="44" fill={lvl.color} opacity="0.12" />

              {/* Bronze: subtle warm shimmer */}
              {streakLevel === "bronze" && (
                <>
                  <circle cx="-30" cy="-25" r="1.5" fill="#d4a060" opacity="0.8"
                    style={{ animation: `streakSparkle-bronze 2s ease-in-out infinite` }} />
                  <circle cx="32" cy="-15" r="1.5" fill="#d4a060" opacity="0.8"
                    style={{ animation: `streakSparkle-bronze 2s ease-in-out 0.7s infinite` }} />
                </>
              )}

              {/* Silver: floating sparkles */}
              {streakLevel === "silver" && [
                {x: -34, y: -20, d: 0}, {x: 32, y: -28, d: 0.5}, {x: -28, y: 8, d: 1}, {x: 30, y: 5, d: 1.5}
              ].map((s, i) => (
                <g key={i} style={{ animation: `streakSparkle-silver 1.8s ease-in-out ${s.d}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>
                  <path d={`M ${s.x} ${s.y - 3} L ${s.x + 1} ${s.y} L ${s.x + 3} ${s.y + 1} L ${s.x + 1} ${s.y + 2} L ${s.x} ${s.y + 5} L ${s.x - 1} ${s.y + 2} L ${s.x - 3} ${s.y + 1} L ${s.x - 1} ${s.y} Z`} fill="#e8e8e8" />
                </g>
              ))}

              {/* Gold: golden sparkles + crown circle */}
              {streakLevel === "gold" && (
                <>
                  <circle cx="0" cy="-50" r="32" fill="none" stroke="#edb830" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.6"
                    style={{ animation: `streakRotate-gold 12s linear infinite`, transformOrigin: "0 -10px" }} />
                  {[{x: -38, y: -28}, {x: 38, y: -28}, {x: -42, y: 5}, {x: 42, y: 5}, {x: 0, y: -55}].map((s, i) => (
                    <text key={i} x={s.x} y={s.y} fontSize="11" fill="#edb830" textAnchor="middle"
                      style={{ animation: `streakSparkle-gold 2s ease-in-out ${i * 0.3}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>✦</text>
                  ))}
                </>
              )}

              {/* Crystal: ethereal blue glow + ice crystals */}
              {streakLevel === "crystal" && (
                <>
                  <ellipse cx="0" cy="-10" rx="55" ry="62" fill="none" stroke="#7adcdc" strokeWidth="1" opacity="0.5"
                    style={{ animation: `streakPulse-crystal 2s ease-in-out infinite`, transformOrigin: "0px -10px" }} />
                  {[{x: -40, y: -30, r: 0}, {x: 42, y: -32, r: 30}, {x: -45, y: 10, r: 60}, {x: 45, y: 8, r: 90}, {x: 0, y: -58, r: 45}].map((s, i) => (
                    <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r})`}
                      style={{ animation: `streakSparkle-crystal 2.5s ease-in-out ${i * 0.4}s infinite` }}>
                      <path d="M 0 -5 L 1 0 L 0 5 L -1 0 Z M -5 0 L 0 1 L 5 0 L 0 -1 Z" fill="#7adcdc" stroke="#a0e8e8" strokeWidth="0.4" />
                    </g>
                  ))}
                </>
              )}

              {/* Rainbow: colorful aura + rainbow sparkles */}
              {streakLevel === "rainbow" && (
                <>
                  {["#ff6080", "#ffa040", "#edb830", "#5caa5e", "#5a8fc7", "#a060c0"].map((color, i) => (
                    <ellipse key={i} cx="0" cy="-10" rx={50 - i * 4} ry={56 - i * 4} fill="none" stroke={color} strokeWidth="0.8" opacity="0.4"
                      style={{ animation: `streakRotate-rainbow ${15 + i * 2}s linear ${i % 2 ? "reverse" : "normal"} infinite`, transformOrigin: "0 -10px" }} />
                  ))}
                  {[{x: -38, y: -25, c: "#ff6080"}, {x: 40, y: -30, c: "#5caa5e"}, {x: -42, y: 8, c: "#5a8fc7"}, {x: 42, y: 5, c: "#a060c0"}, {x: 0, y: -58, c: "#edb830"}].map((s, i) => (
                    <text key={i} x={s.x} y={s.y} fontSize="12" fill={s.c} textAnchor="middle"
                      style={{ animation: `streakSparkle-rainbow 1.6s ease-in-out ${i * 0.25}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>✦</text>
                  ))}
                </>
              )}

              {/* Legendary: cosmic halo + stars */}
              {streakLevel === "legendary" && (
                <>
                  <ellipse cx="0" cy="-10" rx="60" ry="68" fill="none" stroke="#ff6020" strokeWidth="1.5" opacity="0.5"
                    style={{ animation: `streakPulse-legendary 1.5s ease-in-out infinite`, transformOrigin: "0px -10px" }} />
                  <ellipse cx="0" cy="-10" rx="52" ry="58" fill="none" stroke="#edb830" strokeWidth="1" opacity="0.6"
                    style={{ animation: `streakRotate-legendary 8s linear infinite`, transformOrigin: "0 -10px" }} strokeDasharray="6 8" />
                  <ellipse cx="0" cy="-10" rx="44" ry="50" fill="none" stroke="#fff" strokeWidth="0.6" opacity="0.5"
                    style={{ animation: `streakRotate-legendary 6s linear reverse infinite`, transformOrigin: "0 -10px" }} strokeDasharray="2 6" />
                  {[{x: -45, y: -28}, {x: 47, y: -32}, {x: -48, y: 8}, {x: 48, y: 6}, {x: 0, y: -62}, {x: -25, y: -55}, {x: 25, y: -55}].map((s, i) => (
                    <text key={i} x={s.x} y={s.y} fontSize="14" fill={i % 2 ? "#ff6020" : "#edb830"} textAnchor="middle" fontWeight="bold"
                      style={{ animation: `streakSparkle-legendary 1.8s ease-in-out ${i * 0.2}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>⭐</text>
                  ))}
                </>
              )}
            </g>
          );
        })()}

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
        {/* Ears */}
        <ellipse cx="-26" cy="-25" rx="8" ry="7" fill={C.fur2} filter="url(#watercolorSoft)" />
        <ellipse cx="-26" cy="-25" rx="5" ry="4.5" fill={C.face} opacity="0.6" />
        <ellipse cx="26" cy="-25" rx="8" ry="7" fill={C.fur2} filter="url(#watercolorSoft)" />
        <ellipse cx="26" cy="-25" rx="5" ry="4.5" fill={C.face} opacity="0.6" />
        {/* Face */}
        <ellipse cx="0" cy="-14" rx="20" ry="18.5" fill={C.face} filter="url(#watercolorSoft)" />
        <ellipse cx="0" cy="-8" rx="16" ry="10" fill={C.cheek} opacity="0.06" />
        {/* Cheeks */}
        <circle cx="-12" cy="-5" r="7" fill="url(#cheekGrad)" />
        <circle cx="12" cy="-5" r="7" fill="url(#cheekGrad)" />
        {/* Eyes */}
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
        {/* Nose */}
        <ellipse cx="0" cy="-8" rx="4" ry="3" fill={C.nose} />
        <ellipse cx="0" cy="-8.5" rx="3" ry="2" fill={C.noseDark} opacity="0.3" />
        <ellipse cx="-1.5" cy="-7.5" rx="1" ry="0.7" fill={C.noseDark} opacity="0.5" />
        <ellipse cx="1.5" cy="-7.5" rx="1" ry="0.7" fill={C.noseDark} opacity="0.5" />
        <ellipse cx="-0.5" cy="-9.5" rx="1.5" ry="0.8" fill="white" opacity="0.3" />
        {/* Mouth */}
        {mood === "eating" ? (
          <>
            <ellipse cx="0" cy="0" rx="5" ry="6" fill="#3a1a18" />
            <ellipse cx="0" cy="-1" rx="3.5" ry="4" fill="#a82828" />
            <path d="M -3 -3 Q 0 -2 3 -3" stroke="white" strokeWidth="0.8" fill="none" />
          </>
        ) : mood === "excited" ? (
          <path d="M -6 -2 Q 0 6 6 -2" fill={C.noseDark} opacity="0.3" stroke={C.text} strokeWidth="1.2" strokeLinecap="round" />
        ) : mood === "happy" ? (
          <path d="M -5 -2 Q 0 4 5 -2" fill="none" stroke={C.text} strokeWidth="1.3" strokeLinecap="round" />
        ) : (
          <path d="M -3.5 0 Q 0 1 3.5 0" fill="none" stroke={C.text} strokeWidth="1.2" strokeLinecap="round" />
        )}

        {/* ─── ACCESSORIES ─── rendered on top of face */}
        {accessories.includes("scarf") && (
          <g filter="url(#watercolorSoft)">
            <path d="M -22 14 Q 0 22 22 14 Q 24 22 22 28 Q 0 36 -22 28 Q -24 22 -22 14 Z"
              fill="#c94c4c" stroke="#a02828" strokeWidth="0.5" />
            <path d="M -22 17 L -16 32 L -10 28 L -14 17"
              fill="#a02828" opacity="0.8" />
            {/* stripes */}
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
            {/* lens shine */}
            <ellipse cx="-11" cy="-18" rx="2" ry="1.5" fill="white" opacity="0.4" />
            <ellipse cx="7" cy="-18" rx="2" ry="1.5" fill="white" opacity="0.4" />
          </g>
        )}
        {accessories.includes("hat") && (
          <g filter="url(#watercolorSoft)">
            {/* hat brim */}
            <ellipse cx="0" cy="-38" rx="28" ry="5" fill="#3a4f6a" />
            {/* hat top */}
            <path d="M -18 -38 Q -16 -55 0 -57 Q 16 -55 18 -38 Z"
              fill="#4a6080" stroke="#2a3a50" strokeWidth="0.8" />
            {/* band */}
            <ellipse cx="0" cy="-40" rx="19" ry="2.5" fill="#2a3a50" />
            {/* small accent */}
            <circle cx="-10" cy="-40" r="1.5" fill="#edb830" />
          </g>
        )}
        {accessories.includes("beanie") && (
          <g filter="url(#watercolorSoft)">
            {/* beanie body */}
            <path d="M -26 -32 Q -28 -52 0 -56 Q 28 -52 26 -32 Q 13 -30 0 -30 Q -13 -30 -26 -32 Z"
              fill="#d96666" stroke="#a04040" strokeWidth="0.5" />
            {/* fold */}
            <path d="M -26 -32 Q 0 -28 26 -32 L 26 -28 Q 0 -24 -26 -28 Z"
              fill="#a04040" />
            {/* pom pom */}
            <circle cx="0" cy="-58" r="6" fill="#f5f0ea" filter="url(#furTexture)" />
            <circle cx="-2" cy="-60" r="2" fill="white" opacity="0.5" />
          </g>
        )}
        {accessories.includes("crown") && (
          <g filter="url(#watercolorSoft)">
            {/* crown base */}
            <path d="M -22 -38 L -22 -45 L -14 -52 L -7 -45 L 0 -55 L 7 -45 L 14 -52 L 22 -45 L 22 -38 Z"
              fill="#edb830" stroke="#b88810" strokeWidth="0.8" />
            <rect x="-22" y="-40" width="44" height="3" fill="#b88810" />
            {/* gems */}
            <circle cx="-14" cy="-45" r="2" fill="#e06060" />
            <circle cx="0" cy="-48" r="2.5" fill="#5a8fc7" />
            <circle cx="14" cy="-45" r="2" fill="#5caa5e" />
            {/* shine */}
            <path d="M -20 -42 L -20 -39" stroke="white" strokeWidth="1" opacity="0.5" />
            <path d="M 20 -42 L 20 -39" stroke="white" strokeWidth="1" opacity="0.5" />
          </g>
        )}
        {accessories.includes("flower") && (
          <g filter="url(#watercolorSoft)">
            {/* flower petals */}
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
            {/* band */}
            <path d="M -28 -28 Q 0 -52 28 -28" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
            <path d="M -28 -28 Q 0 -52 28 -28" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round" />
            {/* ear cups */}
            <circle cx="-28" cy="-22" r="7" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
            <circle cx="28" cy="-22" r="7" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
            <circle cx="-28" cy="-22" r="3" fill="#e06060" />
            <circle cx="28" cy="-22" r="3" fill="#e06060" />
          </g>
        )}
        {accessories.includes("earphones") && (
          <g>
            {/* Wired earphones - small earbuds with cable hanging down */}
            <ellipse cx="-28" cy="-15" rx="4" ry="5" fill="#fafafa" stroke="#888" strokeWidth="0.7" />
            <ellipse cx="28" cy="-15" rx="4" ry="5" fill="#fafafa" stroke="#888" strokeWidth="0.7" />
            <ellipse cx="-28" cy="-15" rx="2" ry="2.5" fill="#444" />
            <ellipse cx="28" cy="-15" rx="2" ry="2.5" fill="#444" />
            {/* Wires hanging down */}
            <path d="M -28 -10 Q -30 0 -22 12 Q -12 18 -2 16" fill="none" stroke="#fafafa" strokeWidth="1.5" />
            <path d="M 28 -10 Q 30 0 22 12 Q 12 18 2 16" fill="none" stroke="#fafafa" strokeWidth="1.5" />
            <path d="M -2 16 L 2 16 L 0 22" fill="none" stroke="#fafafa" strokeWidth="1.5" />
            <rect x="-2" y="20" width="4" height="6" rx="1" fill="#444" />
          </g>
        )}
        {accessories.includes("vrheadset") && (
          <g>
            {/* Strap */}
            <path d="M -28 -22 Q 0 -45 28 -22" fill="none" stroke="#2a2a2a" strokeWidth="4" strokeLinecap="round" />
            {/* Main headset block */}
            <rect x="-22" y="-22" width="44" height="16" rx="3" fill="#1a1a1a" stroke="#444" strokeWidth="1" />
            {/* Lens area */}
            <rect x="-19" y="-19" width="38" height="10" rx="2" fill="#0a0a0a" />
            {/* Glow eyes through lens */}
            <ellipse cx="-10" cy="-14" rx="5" ry="3" fill="#5a8fc7" opacity="0.7" />
            <ellipse cx="10" cy="-14" rx="5" ry="3" fill="#5a8fc7" opacity="0.7" />
            <ellipse cx="-10" cy="-14" rx="2" ry="1.5" fill="#a0d4ff" />
            <ellipse cx="10" cy="-14" rx="2" ry="1.5" fill="#a0d4ff" />
            {/* Brand strip */}
            <rect x="-8" y="-21" width="16" height="2" fill="#5a8fc7" />
          </g>
        )}
        {accessories.includes("halo") && (
          <g>
            {/* Glowing halo */}
            <ellipse cx="0" cy="-50" rx="22" ry="6" fill="none" stroke="#fff8b0" strokeWidth="3" opacity="0.9" />
            <ellipse cx="0" cy="-50" rx="22" ry="6" fill="none" stroke="#edb830" strokeWidth="1.5" />
            <ellipse cx="0" cy="-50" rx="20" ry="4" fill="none" stroke="white" strokeWidth="1" opacity="0.8" />
            {/* Twinkles */}
            <text x="-22" y="-46" fontSize="10" fill="#fff8b0">✦</text>
            <text x="18" y="-46" fontSize="10" fill="#fff8b0">✦</text>
            <text x="-2" y="-58" fontSize="8" fill="#fff8b0">✧</text>
          </g>
        )}

        {/* HELD ITEMS - rendered after arms but visible from front */}
        {accessories.includes("tennis") && (
          <g transform="translate(28, 18) rotate(-20)">
            {/* Handle */}
            <rect x="-1.5" y="-5" width="3" height="14" rx="1" fill="#3a2810" />
            <rect x="-1.5" y="-5" width="3" height="3" fill="#7a5818" />
            {/* Head */}
            <ellipse cx="0" cy="-15" rx="9" ry="11" fill="none" stroke="#1a1a1a" strokeWidth="1.8" />
            <ellipse cx="0" cy="-15" rx="9" ry="11" fill="#fffabf" opacity="0.9" stroke="#1a1a1a" strokeWidth="0.5" />
            {/* String pattern */}
            {[-6, -3, 0, 3, 6].map((x, i) => <line key={`v${i}`} x1={x} y1="-25" x2={x} y2="-5" stroke="#bbb" strokeWidth="0.5" />)}
            {[-22, -18, -14, -10].map((y, i) => <line key={`h${i}`} x1="-9" y1={y} x2="9" y2={y} stroke="#bbb" strokeWidth="0.5" />)}
          </g>
        )}
        {accessories.includes("basketball") && (
          <g transform="translate(30, 20)">
            <circle cx="0" cy="0" r="9" fill="#e07020" stroke="#a04010" strokeWidth="1" />
            <circle cx="-2" cy="-2" r="4" fill="#ff9050" opacity="0.6" />
            {/* Ball lines */}
            <path d="M -9 0 Q 0 3 9 0" stroke="#1a1a1a" strokeWidth="1" fill="none" />
            <path d="M 0 -9 Q 3 0 0 9" stroke="#1a1a1a" strokeWidth="1" fill="none" />
            <path d="M -7 -6 Q 0 0 7 -6" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
            <path d="M -7 6 Q 0 0 7 6" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
          </g>
        )}
        {accessories.includes("controller") && (
          <g transform="translate(28, 22) rotate(-15)">
            {/* Body */}
            <rect x="-12" y="-5" width="24" height="11" rx="6" fill="#1a1a1a" stroke="#444" strokeWidth="0.5" />
            {/* D-pad */}
            <rect x="-9" y="-3" width="2" height="6" fill="#fafafa" />
            <rect x="-11" y="-1" width="6" height="2" fill="#fafafa" />
            {/* Buttons */}
            <circle cx="6" cy="-2" r="1.5" fill="#e06060" />
            <circle cx="9" cy="1" r="1.5" fill="#5a8fc7" />
            <circle cx="3" cy="1" r="1.5" fill="#edb830" />
            <circle cx="6" cy="4" r="1.5" fill="#5caa5e" />
          </g>
        )}
        {accessories.includes("guitar") && (
          <g transform="translate(26, 12) rotate(20)">
            {/* Body - figure 8 */}
            <ellipse cx="0" cy="6" rx="9" ry="11" fill="#a04010" stroke="#5a2008" strokeWidth="0.8" />
            <ellipse cx="-2" cy="4" rx="6" ry="7" fill="#c05028" opacity="0.6" />
            {/* Sound hole */}
            <circle cx="0" cy="6" r="2.5" fill="#1a1a1a" />
            <circle cx="0" cy="6" r="3.2" fill="none" stroke="#3a1810" strokeWidth="0.6" />
            {/* Neck */}
            <rect x="-1.5" y="-15" width="3" height="13" fill="#5a3818" />
            {/* Frets */}
            {[-13, -10, -7, -4].map((y, i) => <line key={i} x1="-1.5" y1={y} x2="1.5" y2={y} stroke="#fafafa" strokeWidth="0.4" />)}
            {/* Headstock */}
            <rect x="-2" y="-19" width="4" height="4" fill="#5a3818" />
            {/* Strings */}
            {[-1, 0, 1].map((x, i) => <line key={i} x1={x * 0.5} y1="-15" x2={x * 0.5} y2="15" stroke="#fff8b0" strokeWidth="0.3" />)}
          </g>
        )}
        {accessories.includes("microphone") && (
          <g transform="translate(28, 14) rotate(-15)">
            {/* Head */}
            <ellipse cx="0" cy="-10" rx="5" ry="6" fill="#5a5a5a" stroke="#2a2a2a" strokeWidth="0.8" />
            {/* Grill texture */}
            {[-8, -6, -4].map((y, i) => <line key={i} x1="-4" y1={y} x2="4" y2={y} stroke="#2a2a2a" strokeWidth="0.4" />)}
            <ellipse cx="-1" cy="-13" rx="2" ry="2" fill="#9a9a9a" opacity="0.6" />
            {/* Body/handle */}
            <rect x="-1.5" y="-4" width="3" height="14" fill="#2a2a2a" />
            <rect x="-1.5" y="-4" width="3" height="2" fill="#5a5a5a" />
          </g>
        )}
        {accessories.includes("umbrella") && (
          <g transform="translate(28, 16)">
            {/* Canopy */}
            <path d="M -14 -8 Q 0 -22 14 -8 Q 12 -10 8 -10 Q 4 -12 0 -10 Q -4 -12 -8 -10 Q -12 -10 -14 -8 Z"
              fill="#e06060" stroke="#a02828" strokeWidth="0.8" />
            <path d="M 0 -22 L 0 -8" stroke="#a02828" strokeWidth="0.5" />
            <path d="M -7 -14 L -4 -10 M 7 -14 L 4 -10" stroke="#a02828" strokeWidth="0.5" />
            {/* Handle */}
            <path d="M 0 -8 L 0 12 Q 0 16 4 16 Q 8 16 8 12" stroke="#5a3818" strokeWidth="2" fill="none" strokeLinecap="round" />
            <circle cx="0" cy="-22" r="1.5" fill="#5a3818" />
          </g>
        )}
        {accessories.includes("lightsaber") && (
          <g transform="translate(28, 18) rotate(-25)">
            {/* Hilt */}
            <rect x="-2" y="0" width="4" height="14" rx="0.5" fill="#5a5a5a" stroke="#1a1a1a" strokeWidth="0.5" />
            <rect x="-2" y="2" width="4" height="2" fill="#1a1a1a" />
            <rect x="-2" y="6" width="4" height="2" fill="#1a1a1a" />
            <circle cx="0" cy="13" r="1.5" fill="#e06060" />
            {/* Glow blade */}
            <rect x="-2" y="-26" width="4" height="26" fill="#a0d4ff" opacity="0.5" />
            <rect x="-1" y="-26" width="2" height="26" fill="#ffffff" opacity="0.9" />
            <rect x="-3" y="-26" width="6" height="3" fill="#5a8fc7" opacity="0.4" />
            {/* Tip glow */}
            <circle cx="0" cy="-26" r="3" fill="#a0d4ff" opacity="0.5" />
          </g>
        )}
        {accessories.includes("magicwand") && (
          <g transform="translate(28, 16) rotate(-20)">
            {/* Wand */}
            <rect x="-1" y="-2" width="2" height="18" rx="1" fill="#5a3818" />
            <rect x="-1.5" y="14" width="3" height="3" fill="#3a2010" />
            {/* Star tip */}
            <path d="M 0 -10 L 2 -4 L 8 -4 L 3 0 L 5 6 L 0 2 L -5 6 L -3 0 L -8 -4 L -2 -4 Z"
              fill="#fff8b0" stroke="#edb830" strokeWidth="0.6" />
            <path d="M 0 -8 L 1 -4 L 5 -4 L 2 -1 L 3 3 L 0 1 L -3 3 L -2 -1 L -5 -4 L -1 -4 Z"
              fill="#edb830" />
            {/* Sparkles */}
            <text x="-14" y="-8" fontSize="6" fill="#fff8b0">✦</text>
            <text x="10" y="-12" fontSize="5" fill="#fff8b0">✧</text>
            <text x="6" y="6" fontSize="4" fill="#fff8b0">✦</text>
          </g>
        )}
        {accessories.includes("icecream") && (
          <g transform="translate(28, 18)">
            {/* Cone */}
            <path d="M -4 -3 L 4 -3 L 0 12 Z" fill="#d4a060" stroke="#7a5818" strokeWidth="0.5" />
            <path d="M -4 -3 L 4 -3 M -3 0 L 3 0 M -2 3 L 2 3" stroke="#7a5818" strokeWidth="0.4" />
            {/* Scoops */}
            <circle cx="0" cy="-5" r="5" fill="#ff9080" />
            <circle cx="-1" cy="-7" r="2.5" fill="#ffb0a0" opacity="0.7" />
            <circle cx="-2" cy="-12" r="4" fill="#fff5d0" />
            <circle cx="-3" cy="-13" r="2" fill="#ffeebb" opacity="0.7" />
            {/* Cherry on top */}
            <circle cx="-2" cy="-16" r="1.5" fill="#e84050" />
            <path d="M -2 -17 L -1 -19" stroke="#3a7a3c" strokeWidth="0.5" />
          </g>
        )}

        {/* BACK ITEMS - rendered behind body, but we put them here for simplicity */}
        {accessories.includes("backpack") && (
          <g>
            {/* Straps */}
            <path d="M -18 -2 Q -22 8 -20 22" stroke="#3a4f6a" strokeWidth="3" fill="none" />
            <path d="M 18 -2 Q 22 8 20 22" stroke="#3a4f6a" strokeWidth="3" fill="none" />
            {/* Body of pack peeking from sides */}
            <ellipse cx="-30" cy="14" rx="6" ry="10" fill="#5a8fc7" stroke="#3a4f6a" strokeWidth="0.8" />
            <ellipse cx="30" cy="14" rx="6" ry="10" fill="#5a8fc7" stroke="#3a4f6a" strokeWidth="0.8" />
            <rect x="-32" y="10" width="3" height="6" fill="#fafafa" opacity="0.6" />
            <rect x="29" y="10" width="3" height="6" fill="#fafafa" opacity="0.6" />
          </g>
        )}
        {accessories.includes("wings") && (
          <g filter="url(#watercolorSoft)">
            {/* Left wing */}
            <path d="M -28 4 Q -52 -8 -56 14 Q -50 14 -42 14 Q -36 18 -28 12 Z"
              fill="#a060c0" opacity="0.85" />
            <path d="M -28 8 Q -50 4 -54 22 Q -46 22 -38 20 Q -32 22 -28 18 Z"
              fill="#c080d8" opacity="0.7" />
            <ellipse cx="-46" cy="10" rx="3" ry="3" fill="#fff8b0" opacity="0.7" />
            <ellipse cx="-42" cy="18" rx="2" ry="2" fill="#fff8b0" opacity="0.7" />
            {/* Right wing */}
            <path d="M 28 4 Q 52 -8 56 14 Q 50 14 42 14 Q 36 18 28 12 Z"
              fill="#a060c0" opacity="0.85" />
            <path d="M 28 8 Q 50 4 54 22 Q 46 22 38 20 Q 32 22 28 18 Z"
              fill="#c080d8" opacity="0.7" />
            <ellipse cx="46" cy="10" rx="3" ry="3" fill="#fff8b0" opacity="0.7" />
            <ellipse cx="42" cy="18" rx="2" ry="2" fill="#fff8b0" opacity="0.7" />
          </g>
        )}
        {accessories.includes("cape") && (
          <g filter="url(#watercolorSoft)">
            {/* Left cape edge */}
            <path d="M -18 0 Q -32 8 -34 28 Q -28 24 -22 20 Q -18 12 -18 0 Z"
              fill="#c94c4c" stroke="#a02828" strokeWidth="0.6" />
            {/* Right cape edge */}
            <path d="M 18 0 Q 32 8 34 28 Q 28 24 22 20 Q 18 12 18 0 Z"
              fill="#c94c4c" stroke="#a02828" strokeWidth="0.6" />
            {/* Inside lining */}
            <path d="M -16 2 Q -22 14 -22 20" stroke="#fff5d0" strokeWidth="0.5" fill="none" opacity="0.5" />
            <path d="M 16 2 Q 22 14 22 20" stroke="#fff5d0" strokeWidth="0.5" fill="none" opacity="0.5" />
          </g>
        )}

        {/* Arms */}
        <ellipse cx="-28" cy="22" rx="10" ry="5" fill={C.fur2} opacity="0.7" filter="url(#watercolorSoft)" />
        <ellipse cx="28" cy="22" rx="10" ry="5" fill={C.fur2} opacity="0.7" filter="url(#watercolorSoft)" />
        <ellipse cx="-32" cy="22" rx="4" ry="3.5" fill={C.face} opacity="0.5" />
        <ellipse cx="32" cy="22" rx="4" ry="3.5" fill={C.face} opacity="0.5" />

        {/* Water around monkey */}
        <ellipse cx="0" cy="30" rx="46" ry="10" fill={C.water1} opacity="0.55" />
        <ellipse cx="-8" cy="28" rx="20" ry="4" fill="white" opacity="0.12" />
        <ellipse cx="0" cy="35" rx="50" ry="14" fill={C.water2} opacity="0.35" />
        <ellipse cx="-20" cy="26" rx="8" ry="2" fill="white" opacity="0.15" />
        <ellipse cx="18" cy="27" rx="6" ry="1.5" fill="white" opacity="0.12" />

        {/* Pet companion - rendered ON TOP of water */}
        {pet && <PetSVG petId={pet} side="right" />}

        {/* Hover splash ring - expanding ripple */}
        {hovering && (
          <>
            <ellipse cx="0" cy="32" rx="50" ry="12" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5"
              style={{ animation: "ripplePulse 1.2s ease-out infinite", transformOrigin: "center 32px" }} />
            <ellipse cx="0" cy="32" rx="50" ry="12" fill="none" stroke="white" strokeWidth="1.2" opacity="0.4"
              style={{ animation: "ripplePulse 1.2s ease-out 0.4s infinite", transformOrigin: "center 32px" }} />
          </>
        )}

        {/* Splash droplets */}
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
          {/* Sparkles around the star */}
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
      {/* Far mountains */}
      <path d={`M0 ${h*0.35} Q${w*0.1} ${h*0.15} ${w*0.2} ${h*0.25} Q${w*0.3} ${h*0.12} ${w*0.42} ${h*0.28} Q${w*0.5} ${h*0.08} ${w*0.62} ${h*0.22} Q${w*0.75} ${h*0.1} ${w*0.85} ${h*0.2} Q${w*0.95} ${h*0.15} ${w} ${h*0.3} L${w} ${h*0.45} L0 ${h*0.45} Z`}
        fill="url(#mtnGrad2)" opacity="0.6" filter="url(#watercolor)" />
      {/* Near snowbanks */}
      <path d={`M0 ${h*0.28} Q${w*0.08} ${h*0.18} ${w*0.15} ${h*0.22} L${w*0.2} ${h*0.45} L0 ${h*0.45} Z`} fill="url(#mtnGrad1)" filter="url(#rockTexture)" />
      <path d={`M0 ${h*0.2} Q${w*0.05} ${h*0.14} ${w*0.12} ${h*0.18} L${w*0.15} ${h*0.22} L0 ${h*0.28} Z`} fill={C.snow1} opacity="0.9" filter="url(#watercolorSoft)" />
      <path d={`M${w*0.8} ${h*0.2} Q${w*0.88} ${h*0.12} ${w} ${h*0.18} L${w} ${h*0.48} L${w*0.75} ${h*0.48} Z`} fill="url(#mtnGrad1)" filter="url(#rockTexture)" />
      <path d={`M${w*0.82} ${h*0.15} Q${w*0.9} ${h*0.08} ${w} ${h*0.12} L${w} ${h*0.2} L${w*0.8} ${h*0.22} Z`} fill={C.snow1} opacity="0.9" filter="url(#watercolorSoft)" />
      {/* Rocks */}
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

      {/* Perch rocks at pool edge - where monkeys can hang on */}
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

      {/* DENSE BARE TREES - left side cluster */}
      {[
        { x: w*0.01, y: h*0.7, s: 1.4, sway: 0 },
        { x: w*0.04, y: h*0.78, s: 1.1, sway: 0.05 },
        { x: w*0.08, y: h*0.85, s: 1.6, sway: -0.03 },
        { x: w*0.12, y: h*0.92, s: 0.9, sway: 0.02 },
        { x: w*0.02, y: h*0.92, s: 0.7, sway: 0 },
      ].map((tree, i) => (
        <g key={`treeL${i}`} transform={`translate(${tree.x},${tree.y}) scale(${tree.s}) rotate(${tree.sway * 30})`}
           opacity="0.75" filter="url(#watercolorSoft)">
          {/* Main trunk - tall and bare */}
          <line x1="0" y1="0" x2="-2" y2="-100" stroke={C.rock2} strokeWidth="3" strokeLinecap="round" />
          {/* Major branches splaying out */}
          <line x1="-1" y1="-30" x2="-25" y2="-65" stroke={C.rock2} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="-1" y1="-45" x2="22" y2="-72" stroke={C.rock2} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="-1" y1="-55" x2="-30" y2="-85" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="-1" y1="-65" x2="18" y2="-95" stroke={C.rock2} strokeWidth="2" strokeLinecap="round" />
          <line x1="-2" y1="-78" x2="-18" y2="-105" stroke={C.rock2} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-2" y1="-88" x2="14" y2="-112" stroke={C.rock2} strokeWidth="1.8" strokeLinecap="round" />
          {/* Small twigs at branch tips */}
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

      {/* DENSE BARE TREES - right side cluster */}
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

      {/* Background trees - softer, behind rocks */}
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

/* ─── PENGUIN ─── individual cute penguin that waddles across the snow */
function Penguin({ startX, startY, baseSize = 22, speed = 1, variant = 0, paused }) {
  const [pos, setPos] = useState({ x: startX, y: startY });
  const [waddle, setWaddle] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = right, -1 = left
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
        // Move horizontally
        s.x += s.dir * speed * 12 * dt;
        // Bounce off horizontal edges (in % units)
        if (s.x > 95) { s.dir = -1; setDirection(-1); }
        else if (s.x < 2) { s.dir = 1; setDirection(1); }
        // Slight random direction change occasionally
        if (Math.random() < 0.002) { s.dir = -s.dir; setDirection(s.dir); }
        // Slight vertical drift
        const newY = startY + Math.sin(s.t * 0.4 + variant) * 1.5;
        setPos({ x: s.x, y: newY });
        // Waddle (side-to-side wobble)
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
        {/* Feet */}
        <ellipse cx={-6 + waddle * 0.3} cy="26" rx="4" ry="2.5" fill="#e89020" filter="url(#watercolorSoft)" />
        <ellipse cx={6 - waddle * 0.3} cy="26" rx="4" ry="2.5" fill="#e89020" filter="url(#watercolorSoft)" />
        {/* Body - black back */}
        <ellipse cx="0" cy="6" rx="14" ry="20" fill="#2a2a2a" filter="url(#watercolorSoft)" />
        {/* White belly */}
        <ellipse cx="0" cy="8" rx="10" ry="16" fill="#f5f0ea" filter="url(#watercolorSoft)" />
        {/* Wings */}
        <ellipse cx={-13 + waddle * 0.4} cy="6" rx="4" ry="12" fill="#1a1a1a" filter="url(#watercolorSoft)"
          transform={`rotate(${waddle * 0.5} -13 6)`} />
        <ellipse cx={13 - waddle * 0.4} cy="6" rx="4" ry="12" fill="#1a1a1a" filter="url(#watercolorSoft)"
          transform={`rotate(${-waddle * 0.5} 13 6)`} />
        {/* Head */}
        <ellipse cx="0" cy="-12" rx="11" ry="11" fill="#2a2a2a" filter="url(#watercolorSoft)" />
        {/* Face - white area */}
        <ellipse cx="0" cy="-10" rx="7" ry="6" fill="#f5f0ea" />
        {/* Eyes */}
        <circle cx="-3" cy="-13" r="1.2" fill="#1a1a1a" />
        <circle cx="3" cy="-13" r="1.2" fill="#1a1a1a" />
        <circle cx="-2.5" cy="-13.5" r="0.4" fill="white" />
        <circle cx="3.5" cy="-13.5" r="0.4" fill="white" />
        {/* Beak */}
        <path d="M -2 -8 L 0 -5 L 2 -8 Z" fill="#e89020" />
        {/* Cheek blush */}
        <circle cx="-5" cy="-9" r="1.5" fill="#ffb0b0" opacity="0.5" />
        <circle cx="5" cy="-9" r="1.5" fill="#ffb0b0" opacity="0.5" />
      </svg>
    </div>
  );
}

/* ─── PENGUIN FLOCK ─── handles a group of penguins, pauses when monkeys hovered */
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
        <Penguin key={i}
          startX={p.x} startY={p.y}
          baseSize={p.size} speed={p.speed} variant={p.variant}
          paused={anyHovering}
        />
      ))}
      {/* Pause indicator - subtle "shh!" effect */}
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

/* ─── WORDLE GAME COMPONENT ─── */
function WordleGame({ onWin, onLose, onClose }) {
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
    // Green pass
    for (let i = 0; i < 5; i++) {
      if (guess[i] === ansArr[i]) { result[i] = "correct"; used[i] = true; }
    }
    // Yellow pass
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
    if (current.length !== 5) { SFX.wrong(); setShake(true); setTimeout(() => setShake(false), 500); return; }
    const g = current.toUpperCase();
    const newGuesses = [...guesses, g];
    setGuesses(newGuesses);
    setCurrent("");
    if (g === answer) {
      SFX.levelUp();
      setWon(true); setGameOver(true); setMessage("You got it! +1 point!");
      setTimeout(() => onWin(), 1500);
    } else if (newGuesses.length >= maxGuesses) {
      SFX.gameOver();
      setGameOver(true); setMessage(`The word was ${answer}`);
      // Lock out further attempts today
      if (onLose) setTimeout(() => onLose(), 1800);
    } else {
      SFX.click();
    }
  };

  const handleKey = (key) => {
    if (gameOver) return;
    if (key === "ENTER") return submit();
    if (key === "DEL") { SFX.click(); return setCurrent(c => c.slice(0, -1)); }
    if (current.length < 5 && /^[A-Z]$/.test(key)) { SFX.click(); setCurrent(c => c + key); }
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

  // If user closes early after starting, count it as a loss (one attempt only)
  const handleEarlyClose = () => {
    if (gameOver) { onClose(); return; }
    if (guesses.length === 0) {
      // No guesses yet - allow free close (they haven't used their attempt)
      onClose();
      return;
    }
    // They've guessed at least once - confirm they want to forfeit
    if (typeof window !== "undefined" && window.confirm("Are you sure you want to leave? This will count as your daily attempt and you won't be able to retry today!")) {
      if (onLose) onLose();
      else onClose();
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleEarlyClose(); }}>
      <div style={{
        background: C.card, borderRadius: 24, padding: "28px 32px", width: 420, maxWidth: "95vw",
        boxShadow: "0 24px 64px rgba(0,0,0,0.25)", border: `2px solid ${C.gold}30`,
        fontFamily: "'Patrick Hand', cursive",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: C.text, fontSize: 24 }}>🐵 Daily Challenge</h2>
          <button onClick={handleEarlyClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>
        <p style={{ color: C.textLight, fontSize: 14, margin: "0 0 8px", textAlign: "center" }}>Guess the 5-letter word! Solve it for +1 point</p>
        <p style={{ color: C.accent, fontSize: 12, margin: "0 0 16px", textAlign: "center", fontWeight: 700 }}>⚠️ One attempt per day — choose carefully!</p>

        {/* Grid */}
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

        {/* Message */}
        {message && (
          <div style={{
            textAlign: "center", padding: "10px 16px", borderRadius: 12, marginBottom: 12,
            background: won ? `${C.green}15` : `${C.accent}15`,
            color: won ? C.green : C.accent, fontSize: 18, fontWeight: 700,
          }}>
            {won && "🎉 "}{message}
          </div>
        )}

        {/* Keyboard */}
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

/* ─── CSV Parser ─── tolerant of quotes, commas inside quoted strings */
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
  // Try to find columns: question, a/b/c/d (or option1-4), correct/answer
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
    // Accept A/B/C/D or 1/2/3/4 or actual answer text
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

/* ─── HAWK SVG ─── swoops in when student gets answer wrong */
function HawkAttack({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 4500);
    return () => clearTimeout(t);
  }, [onComplete]);
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100, overflow: "hidden",
    }}>
      <style>{`
        @keyframes hawkSwoopLong {
          0% { transform: translate(-220px, -120px) rotate(20deg) scale(0.7); opacity: 0; }
          12% { opacity: 1; }
          25% { transform: translate(20%, -10%) rotate(-5deg) scale(1.0); }
          40% { transform: translate(35%, 10%) rotate(-10deg) scale(1.3); }
          55% { transform: translate(40%, 25%) rotate(-12deg) scale(1.6); }
          65% { transform: translate(42%, 28%) rotate(-8deg) scale(1.7); }
          75% { transform: translate(45%, 25%) rotate(0deg) scale(1.6); }
          85% { transform: translate(55%, 15%) rotate(15deg) scale(1.3); }
          95% { opacity: 1; transform: translate(80%, -10%) rotate(25deg) scale(1.0); }
          100% { transform: translate(120%, -80px) rotate(30deg) scale(0.7); opacity: 0; }
        }
        @keyframes hawkShadow {
          0% { transform: translate(-220px, 100px) scale(0.4); opacity: 0; }
          25% { opacity: 0.4; }
          55% { transform: translate(45%, 70%) scale(1.2); opacity: 0.5; }
          75% { transform: translate(55%, 65%) scale(1.0); opacity: 0.4; }
          100% { transform: translate(120%, 50px) scale(0.5); opacity: 0; }
        }
        @keyframes screenShakeLong {
          0%, 100% { transform: translate(0, 0); }
          10%, 30%, 50%, 70%, 90% { transform: translate(-3px, 1px); }
          20%, 40%, 60%, 80% { transform: translate(3px, -1px); }
        }
        @keyframes redFlash {
          0%, 100% { background: rgba(180,30,30,0.0); }
          40%, 60% { background: rgba(180,30,30,0.18); }
        }
        @keyframes featherFall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          20% { opacity: 0.8; }
          100% { transform: translate(var(--fx), 200px) rotate(var(--fr)); opacity: 0; }
        }
      `}</style>
      {/* Red ominous flash */}
      <div style={{
        position: "absolute", inset: 0,
        animation: "redFlash 4.5s ease-in-out forwards",
      }} />
      {/* Screen shake during dive */}
      <div style={{
        position: "absolute", inset: 0,
        animation: "screenShakeLong 0.4s ease 1.8s 6",
      }} />
      {/* Shadow on the ground/water */}
      <div style={{
        position: "absolute", left: 0, top: 0,
        animation: "hawkShadow 4.5s ease-in-out forwards",
      }}>
        <svg width="120" height="50" viewBox="-60 -25 120 50" style={{ overflow: "visible" }}>
          <ellipse cx="0" cy="0" rx="50" ry="14" fill="#000" opacity="0.5" filter="url(#watercolorSoft)" />
        </svg>
      </div>
      {/* The hawk itself - bigger and slower */}
      <div style={{
        position: "absolute", left: 0, top: 0,
        animation: "hawkSwoopLong 4.5s ease-in-out forwards",
      }}>
        <svg width="200" height="160" viewBox="-100 -80 200 160" style={{ overflow: "visible" }}>
          {/* Wings spread wide */}
          <path d="M -10 0 Q -60 -25 -95 -15 Q -65 0 -45 8 Q -28 12 -10 6 Z"
            fill="#5a3a28" stroke="#3a2418" strokeWidth="1" filter="url(#watercolorSoft)" />
          <path d="M 10 0 Q 60 -25 95 -15 Q 65 0 45 8 Q 28 12 10 6 Z"
            fill="#5a3a28" stroke="#3a2418" strokeWidth="1" filter="url(#watercolorSoft)" />
          {/* Wing feather details */}
          <path d="M -25 4 L -70 -10 M -30 8 L -75 -2 M -20 -2 L -55 -16 M -35 12 L -65 4"
            stroke="#3a2418" strokeWidth="1" fill="none" opacity="0.6" />
          <path d="M 25 4 L 70 -10 M 30 8 L 75 -2 M 20 -2 L 55 -16 M 35 12 L 65 4"
            stroke="#3a2418" strokeWidth="1" fill="none" opacity="0.6" />
          {/* Wing tips - lighter */}
          <path d="M -75 -10 Q -85 -8 -90 0 Q -82 -2 -75 -8" fill="#3a2418" opacity="0.7" />
          <path d="M 75 -10 Q 85 -8 90 0 Q 82 -2 75 -8" fill="#3a2418" opacity="0.7" />
          {/* Body */}
          <ellipse cx="0" cy="2" rx="14" ry="22" fill="#7a4e34" filter="url(#watercolorSoft)" />
          <ellipse cx="0" cy="6" rx="10" ry="14" fill="#a06a48" opacity="0.5" />
          {/* Chest feather pattern */}
          <path d="M -8 -2 Q 0 0 8 -2 M -7 4 Q 0 6 7 4 M -6 10 Q 0 12 6 10" stroke="#3a2418" strokeWidth="0.6" fill="none" opacity="0.5" />
          {/* Head */}
          <ellipse cx="0" cy="-18" rx="13" ry="11" fill="#6a4028" filter="url(#watercolorSoft)" />
          {/* Sharp menacing yellow eyes */}
          <ellipse cx="-4" cy="-19" rx="3" ry="2.5" fill="#ffd000" />
          <ellipse cx="4" cy="-19" rx="3" ry="2.5" fill="#ffd000" />
          <circle cx="-4" cy="-19" r="1.5" fill="#1a1a1a" />
          <circle cx="4" cy="-19" r="1.5" fill="#1a1a1a" />
          <circle cx="-3.5" cy="-19.5" r="0.5" fill="white" />
          <circle cx="4.5" cy="-19.5" r="0.5" fill="white" />
          {/* Sharp hooked beak */}
          <path d="M -3 -13 L 0 -4 L 3 -13 L 0 -10 Z" fill="#ffb030" stroke="#a06020" strokeWidth="0.5" />
          <path d="M 0 -4 L -1 -2 L 0 -3" fill="#a06020" />
          {/* Talons - sharp and visible */}
          <path d="M -6 22 L -8 30 M -4 22 L -4 32 M -2 22 L 0 31" stroke="#222" strokeWidth="2" strokeLinecap="round" />
          <path d="M 6 22 L 8 30 M 4 22 L 4 32 M 2 22 L 0 31" stroke="#222" strokeWidth="2" strokeLinecap="round" />
          {/* Talon tips */}
          <circle cx="-8" cy="30" r="1" fill="#222" />
          <circle cx="-4" cy="32" r="1" fill="#222" />
          <circle cx="0" cy="31" r="1" fill="#222" />
          <circle cx="8" cy="30" r="1" fill="#222" />
          <circle cx="4" cy="32" r="1" fill="#222" />
          {/* Tail feathers */}
          <path d="M -5 22 L -10 36 L -3 30 L 0 36 L 3 30 L 10 36 L 5 22 Z" fill="#5a3a28" filter="url(#watercolorSoft)" />
          {/* Angry brow - pronounced */}
          <path d="M -10 -25 L -2 -22 M 10 -25 L 2 -22" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          {/* Open mouth - menacing */}
          <path d="M -2 -8 Q 0 -6 2 -8 Q 0 -7 -2 -8 Z" fill="#3a1a18" />
        </svg>
      </div>
      {/* Falling feathers */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", left: `${45 + i * 5}%`, top: "30%",
          fontSize: 18, color: "#5a3a28",
          "--fx": `${(i - 1) * 30}px`,
          "--fr": `${(i - 1) * 90}deg`,
          animation: `featherFall 3s ease-in ${2 + i * 0.3}s forwards`,
          opacity: 0,
        }}>🪶</div>
      ))}
    </div>
  );
}

/* ─── WATERCOLOR FOOD SVGs ─── matching the monkey style */
function WatercolorFood({ type = "strawberry", size = 80 }) {
  const renderFood = () => {
    switch (type) {
      case "strawberry":
        return (
          <g filter="url(#watercolorSoft)">
            {/* Body */}
            <path d="M 0 -18 Q -22 -12 -20 8 Q -12 25 0 30 Q 12 25 20 8 Q 22 -12 0 -18 Z" fill="#e84050" />
            <path d="M 0 -14 Q -18 -10 -16 8 Q -10 22 0 26 Q 10 22 16 8 Q 18 -10 0 -14 Z" fill="#ff7080" opacity="0.5" />
            {/* Seeds */}
            <ellipse cx="-7" cy="0" rx="1.2" ry="2.5" fill="#fff5d0" transform="rotate(-30 -7 0)" />
            <ellipse cx="7" cy="0" rx="1.2" ry="2.5" fill="#fff5d0" transform="rotate(30 7 0)" />
            <ellipse cx="-2" cy="8" rx="1.2" ry="2.5" fill="#fff5d0" />
            <ellipse cx="5" cy="10" rx="1.2" ry="2.5" fill="#fff5d0" transform="rotate(20 5 10)" />
            <ellipse cx="-9" cy="12" rx="1.2" ry="2.5" fill="#fff5d0" transform="rotate(-20 -9 12)" />
            <ellipse cx="0" cy="-3" rx="1.2" ry="2.5" fill="#fff5d0" />
            <ellipse cx="9" cy="14" rx="1.2" ry="2.5" fill="#fff5d0" transform="rotate(25 9 14)" />
            <ellipse cx="-5" cy="18" rx="1.2" ry="2.5" fill="#fff5d0" />
            {/* Leaves on top - star shape */}
            <path d="M -10 -16 L -16 -26 L -4 -18 Z" fill="#5caa5e" />
            <path d="M 0 -18 L -3 -28 L 6 -20 Z" fill="#5caa5e" />
            <path d="M 10 -16 L 16 -26 L 4 -18 Z" fill="#5caa5e" />
            <path d="M -2 -19 L 2 -28 L 6 -22 Z" fill="#7cc080" />
            {/* Highlight */}
            <ellipse cx="-7" cy="-5" rx="3" ry="6" fill="white" opacity="0.45" />
            {/* Sparkle */}
            <text x="14" y="-12" fontSize="10" fill="#fff4c2">✦</text>
          </g>
        );
      case "nut": // acorn
        return (
          <g filter="url(#watercolorSoft)">
            {/* Body */}
            <ellipse cx="0" cy="6" rx="15" ry="16" fill="#a87858" />
            <ellipse cx="-3" cy="2" rx="10" ry="11" fill="#c89878" opacity="0.6" />
            {/* Cap */}
            <ellipse cx="0" cy="-7" rx="17" ry="7" fill="#5a3818" />
            <ellipse cx="0" cy="-9" rx="15" ry="5" fill="#7a4828" />
            {/* Cap texture dots */}
            <circle cx="-10" cy="-7" r="1.2" fill="#3a2810" />
            <circle cx="-3" cy="-9" r="1.2" fill="#3a2810" />
            <circle cx="3" cy="-9" r="1.2" fill="#3a2810" />
            <circle cx="10" cy="-7" r="1.2" fill="#3a2810" />
            <circle cx="-6" cy="-11" r="1" fill="#3a2810" />
            <circle cx="6" cy="-11" r="1" fill="#3a2810" />
            <circle cx="0" cy="-12" r="1" fill="#3a2810" />
            {/* Stem */}
            <path d="M 0 -14 Q 1 -18 3 -20" stroke="#5a3818" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Highlight */}
            <ellipse cx="-5" cy="3" rx="3.5" ry="6" fill="white" opacity="0.35" />
            {/* Sparkle */}
            <text x="12" y="-3" fontSize="10" fill="#fff4c2">✦</text>
          </g>
        );
      case "banana":
        return (
          <g filter="url(#watercolorSoft)">
            {/* Body curved */}
            <path d="M -18 -10 Q -10 -20 2 -16 Q 14 -10 20 6 Q 16 12 8 8 Q -2 0 -12 -2 Q -18 -2 -18 -10 Z"
              fill="#f5d040" />
            <path d="M -16 -10 Q -8 -16 0 -14 Q 12 -10 17 6 Q 14 8 8 6 Q -2 -2 -12 -4 Q -16 -4 -16 -10 Z"
              fill="#fff088" opacity="0.5" />
            {/* Stem dark tip */}
            <path d="M -18 -10 L -22 -16 L -19 -14" fill="#7a5818" />
            {/* Bottom tip */}
            <ellipse cx="20" cy="6" rx="2" ry="2" fill="#5a3818" />
            {/* Highlight curve */}
            <path d="M -10 -12 Q -2 -14 8 -10" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />
            {/* Brown spots */}
            <circle cx="-4" cy="-8" r="1" fill="#a06820" opacity="0.5" />
            <circle cx="6" cy="-4" r="0.8" fill="#a06820" opacity="0.5" />
            {/* Sparkle */}
            <text x="-22" y="0" fontSize="10" fill="#fff4c2">✦</text>
          </g>
        );
      case "apple":
        return (
          <g filter="url(#watercolorSoft)">
            {/* Body */}
            <ellipse cx="0" cy="3" rx="16" ry="15" fill="#e84030" />
            <ellipse cx="-4" cy="-1" rx="10" ry="9" fill="#ff7060" opacity="0.5" />
            {/* Stem */}
            <path d="M 2 -13 L 0 -18" stroke="#5a3818" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Leaf */}
            <path d="M 0 -16 Q 10 -18 10 -10 Q 4 -10 0 -16 Z" fill="#5caa5e" />
            <path d="M 2 -14 Q 7 -14 9 -11" stroke="#3a7a3c" strokeWidth="0.5" fill="none" />
            {/* Highlight */}
            <ellipse cx="-6" cy="-3" rx="3.5" ry="7" fill="white" opacity="0.5" />
            {/* Sparkle */}
            <text x="12" y="-8" fontSize="10" fill="#fff4c2">✦</text>
          </g>
        );
      case "carrot":
        return (
          <g filter="url(#watercolorSoft)">
            {/* Body triangle */}
            <path d="M -11 -8 L 11 -8 L 5 16 L -5 16 Z" fill="#ff8030" />
            <path d="M -9 -8 L 9 -8 L 4 14 L -4 14 Z" fill="#ffb060" opacity="0.5" />
            {/* Carrot lines */}
            <path d="M -8 -3 L 8 -3 M -7 3 L 7 3 M -6 9 L 6 9" stroke="#cc5010" strokeWidth="0.7" opacity="0.6" />
            {/* Greens on top */}
            <path d="M -9 -10 L -12 -22 L -6 -14 Z" fill="#5caa5e" />
            <path d="M -3 -10 L -3 -24 L 2 -16 Z" fill="#5caa5e" />
            <path d="M 7 -10 L 12 -22 L 4 -14 Z" fill="#5caa5e" />
            <path d="M 2 -12 L 5 -26 L 0 -18 Z" fill="#7cc080" />
            <path d="M -1 -10 L 1 -22 L -3 -16 Z" fill="#3a7a3c" />
            {/* Highlight */}
            <ellipse cx="-3" cy="2" rx="2.5" ry="7" fill="white" opacity="0.35" />
            {/* Sparkle */}
            <text x="-14" y="0" fontSize="10" fill="#fff4c2">✦</text>
          </g>
        );
      default: return null;
    }
  };
  return (
    <svg width={size} height={size * 1.1} viewBox="-30 -32 60 66" style={{ overflow: "visible" }}>
      {renderFood()}
    </svg>
  );
}

/* ─── FOOD REWARD ─── falls from top into monkey's mouth */
function FoodReward({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2200);
    return () => clearTimeout(t);
  }, [onComplete]);
  const foods = ["strawberry", "nut", "banana", "apple", "carrot"];
  const food = foods[Math.floor(Math.random() * foods.length)];
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none", zIndex: 100, overflow: "hidden",
    }}>
      <style>{`
        @keyframes foodFlyIntoMouth {
          0% { transform: translate(-50%, -180%) scale(0.4) rotate(0deg); opacity: 0; }
          15% { opacity: 1; transform: translate(-50%, -120%) scale(1) rotate(-15deg); }
          35% { transform: translate(-50%, -50%) scale(1.2) rotate(15deg); }
          55% { transform: translate(-50%, 20%) scale(1.1) rotate(-10deg); }
          72% { transform: translate(-50%, 60%) scale(0.9) rotate(5deg); opacity: 1; }
          85% { transform: translate(-50%, 80%) scale(0.4) rotate(0deg); opacity: 1; }
          100% { transform: translate(-50%, 80%) scale(0) rotate(0deg); opacity: 0; }
        }
        @keyframes sparkleFloatBig {
          0% { transform: translate(var(--sx), 50%) scale(0); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translate(var(--sx), -100%) scale(1.5); opacity: 0; }
        }
        @keyframes chompPuff {
          0% { transform: translate(-50%, 80%) scale(0); opacity: 0; }
          40% { opacity: 1; transform: translate(-50%, 70%) scale(1.5); }
          100% { transform: translate(-50%, 50%) scale(2.5); opacity: 0; }
        }
      `}</style>
      {/* Food falling into monkey's mouth (monkey is at center) */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        animation: "foodFlyIntoMouth 2.2s ease-in forwards",
      }}>
        <WatercolorFood type={food} size={90} />
      </div>
      {/* Chomp puff at the moment of eating */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        fontSize: 50,
        animation: "chompPuff 0.6s ease-out 1.7s forwards",
        opacity: 0,
      }}>💨</div>
      {/* Yellow sparkles flying up after eating */}
      {[0,1,2,3,4,5,6].map(i => (
        <div key={i} style={{
          position: "absolute", left: "50%", top: "50%", fontSize: 22, color: C.gold,
          "--sx": `${(i - 3) * 50}px`,
          animation: `sparkleFloatBig ${1.2 + i * 0.08}s ease-out ${1.6 + i * 0.05}s forwards`,
          opacity: 0,
        }}>✨</div>
      ))}
    </div>
  );
}

/* ─── QUIZ GAME ─── multi-choice game with food/hawk feedback */
function QuizGame({ studentId, studentName, quiz, onClose, onComplete }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showHawk, setShowHawk] = useState(false);
  const [showFood, setShowFood] = useState(false);
  const [score, setScore] = useState(0);
  const [monkeyShake, setMonkeyShake] = useState(false);
  const [monkeyHappy, setMonkeyHappy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  const questions = quiz?.questions || [];
  const totalReward = quiz?.points || 1;

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
      SFX.correct();
      setScore(s => s + 1);
      setMonkeyHappy(true);
      setShowFood(true);
      setTimeout(() => setMonkeyHappy(false), 2200);
    } else {
      SFX.wrong();
      setMonkeyShake(true);
      setShowHawk(true);
      setTimeout(() => setMonkeyShake(false), 4200);
    }
  };

  const nextQuestion = () => {
    if (isLast) {
      // Calculate proportional reward
      const pct = score / questions.length;
      const earned = Math.round(totalReward * pct);
      setFinished(true);
      if (!rewarded && earned > 0) {
        setRewarded(true);
        SFX.reward();
        onComplete(earned);
      }
    } else {
      SFX.click();
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setShowResult(false);
    }
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const earned = Math.round(totalReward * (score / questions.length));
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center", width: 460 }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 8px", fontSize: 28 }}>🎉 Quiz Complete!</h2>
          <p style={{ color: C.textLight, fontSize: 18, margin: "0 0 20px" }}>{studentName}, you finished {quiz?.name}!</p>
          <div style={{ fontSize: 64, color: C.gold, fontWeight: 700, marginBottom: 8 }}>{score} / {questions.length}</div>
          <div style={{ fontSize: 22, color: pct >= 80 ? C.green : pct >= 50 ? C.gold : C.accent, fontWeight: 700, marginBottom: 16 }}>
            {pct >= 80 ? "Amazing!" : pct >= 50 ? "Good job!" : "Keep practicing!"}
          </div>
          <div style={{ background: `${C.gold}20`, borderRadius: 14, padding: "12px 16px", marginBottom: 16, display: "inline-block" }}>
            <div style={{ fontSize: 16, color: C.text }}>You earned <strong style={{ color: C.gold, fontSize: 22 }}>+{earned} ★</strong></div>
            <div style={{ fontSize: 12, color: C.textLight }}>(out of {totalReward} possible)</div>
          </div>
          <button onClick={onClose} style={{ ...primaryBtnStyle, marginTop: 4 }}>Back to the Hot Spring</button>
        </div>
      </div>
    );
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalCardStyle, width: 580, maxWidth: "95vw", position: "relative", overflow: "hidden" }}>
        {/* Hawk overlay */}
        {showHawk && <HawkAttack onComplete={() => setShowHawk(false)} />}
        {/* Food overlay */}
        {showFood && <FoodReward onComplete={() => setShowFood(false)} />}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>📚 Quiz Time!</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 13 }}>
              Question {currentIdx + 1} of {questions.length} · Score: {score}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, background: `${C.fur2}30`, borderRadius: 4, marginBottom: 16, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${((currentIdx + (showResult ? 1 : 0)) / questions.length) * 100}%`,
            background: `linear-gradient(90deg, ${C.gold}, ${C.green})`,
            transition: "width 0.4s",
          }} />
        </div>

        {/* Mini monkey reacting */}
        <div style={{ textAlign: "center", marginBottom: 16, height: 100 }}>
          <div style={{
            display: "inline-block",
            animation: monkeyShake ? "monkeyShake 0.4s ease infinite" : showFood ? "monkeyLeapEat 2.2s ease-in-out forwards" : monkeyHappy ? "monkeyJoy 0.6s ease infinite" : "none",
          }}>
            <style>{`
              @keyframes monkeyShake { 0%,100% { transform: translateX(0) rotate(0); } 25% { transform: translateX(-6px) rotate(-5deg); } 75% { transform: translateX(6px) rotate(5deg); } }
              @keyframes monkeyJoy { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-8px) scale(1.05); } }
              @keyframes monkeyLeapEat {
                0% { transform: translateY(0) scale(1); }
                30% { transform: translateY(-25px) scale(1.1); }
                55% { transform: translateY(-35px) scale(1.2); }
                75% { transform: translateY(-25px) scale(1.15); }
                90% { transform: translateY(-5px) scale(1.05); }
                100% { transform: translateY(0) scale(1); }
              }
            `}</style>
            <MonkeySVG
              size={90}
              mood={showFood ? "eating" : monkeyHappy ? "excited" : monkeyShake ? "neutral" : "happy"}
              variant={5}
            />
          </div>
        </div>

        {/* Question */}
        <div style={{
          background: `${C.snow1}80`, borderRadius: 16, padding: "18px 22px", marginBottom: 16,
          fontSize: 20, color: C.text, fontWeight: 600, textAlign: "center",
          minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {currentQ.q}
        </div>

        {/* Options */}
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
                style={{
                  padding: "16px 14px", borderRadius: 14, border: "none",
                  background: bg, color: textColor,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                  cursor: showResult ? "default" : "pointer",
                  transition: "all 0.3s, transform 0.15s",
                  boxShadow: isSelected ? `0 0 0 3px ${C.text}` : "0 3px 8px rgba(0,0,0,0.1)",
                  textAlign: "left", display: "flex", alignItems: "center", gap: 10,
                  minHeight: 60,
                }}
                onMouseEnter={e => !showResult && (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => !showResult && (e.currentTarget.style.transform = "translateY(0)")}>
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  fontSize: 16, fontWeight: 700,
                }}>{"ABCD"[idx]}</span>
                <span style={{ flex: 1 }}>{opt}</span>
                {showResult && isCorrect && <span style={{ fontSize: 22 }}>✓</span>}
                {showResult && isSelected && !isCorrect && <span style={{ fontSize: 22 }}>✗</span>}
              </button>
            );
          })}
        </div>

        {/* Next/result message */}
        {showResult && (
          <div style={{ textAlign: "center" }}>
            <p style={{
              color: selected === currentQ.correct ? C.green : C.accent,
              fontSize: 18, fontWeight: 700, margin: "0 0 12px",
            }}>
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

/* ─── RUNNER MISSION ─── Chrome dino-style game with monkey jumping over fruits */
const RUNNER_OBSTACLES = [
  { type: "banana",     w: 28, h: 30, color: "#f5d040", emoji: "🍌" },
  { type: "apple",      w: 32, h: 32, color: "#e84030", emoji: "🍎" },
  { type: "pineapple",  w: 34, h: 44, color: "#edb830", emoji: "🍍" },
  { type: "watermelon", w: 44, h: 36, color: "#5caa5e", emoji: "🍉" },
  { type: "strawberry", w: 28, h: 32, color: "#ff5060", emoji: "🍓" },
  { type: "coconut",    w: 32, h: 32, color: "#5a3818", emoji: "🥥" },
];

// Draw a simplified watercolor monkey on canvas
function drawMonkeyOnCanvas(ctx, x, y, size, frame, ducking, hurt) {
  const s = size / 100; // scale factor
  ctx.save();
  ctx.translate(x, y);

  if (ducking) {
    ctx.translate(0, size * 0.15);
    ctx.scale(1, 0.7);
  }

  // Slight body bob
  const bob = Math.sin(frame * 0.3) * 1.5;

  // Tail (behind, wagging)
  ctx.save();
  ctx.translate(-30 * s, 5 * s);
  const tailWag = Math.sin(frame * 0.5) * 8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-15 * s, -10 * s + tailWag * s, -25 * s, -5 * s + tailWag * 1.5 * s);
  ctx.lineWidth = 6 * s;
  ctx.strokeStyle = "#8b6352";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // Body
  ctx.fillStyle = hurt ? "#ff8080" : "#dbd2c4";
  ctx.beginPath();
  ctx.ellipse(0, 25 * s + bob, 30 * s, 26 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly highlight
  ctx.fillStyle = "#ede6dc";
  ctx.beginPath();
  ctx.ellipse(0, 30 * s + bob, 22 * s, 18 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs - simple animation
  const legPhase = Math.sin(frame * 0.8);
  ctx.fillStyle = "#a3796a";
  // Back leg
  ctx.beginPath();
  ctx.ellipse(-12 * s, 50 * s + legPhase * 2 * s, 7 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Front leg
  ctx.beginPath();
  ctx.ellipse(12 * s, 50 * s - legPhase * 2 * s, 7 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Arms (raised slightly during jump animation)
  ctx.fillStyle = "#a3796a";
  ctx.beginPath();
  ctx.ellipse(-22 * s, 22 * s + bob, 6 * s, 12 * s, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(22 * s, 22 * s + bob, 6 * s, 12 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = hurt ? "#ff9090" : "#dbd2c4";
  ctx.beginPath();
  ctx.ellipse(0, -8 * s + bob, 26 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face (lighter)
  ctx.fillStyle = "#f5cdd0";
  ctx.beginPath();
  ctx.ellipse(0, -3 * s + bob, 18 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = "#a3796a";
  ctx.beginPath(); ctx.arc(-22 * s, -10 * s + bob, 6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(22 * s, -10 * s + bob, 6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f5cdd0";
  ctx.beginPath(); ctx.arc(-22 * s, -10 * s + bob, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(22 * s, -10 * s + bob, 3 * s, 0, Math.PI * 2); ctx.fill();

  // Eyes (with blink based on frame)
  const eyeBlink = (frame % 120 < 6) ? 0.1 : 1;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.ellipse(-7 * s, -7 * s + bob, 4 * s, 4 * s * eyeBlink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(7 * s, -7 * s + bob, 4 * s, 4 * s * eyeBlink, 0, 0, Math.PI * 2);
  ctx.fill();
  if (eyeBlink > 0.5) {
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath(); ctx.arc(-6.5 * s, -6.5 * s + bob, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(7.5 * s, -6.5 * s + bob, 2.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "white";
    ctx.beginPath(); ctx.arc(-6 * s, -7.5 * s + bob, 0.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8 * s, -7.5 * s + bob, 0.8 * s, 0, Math.PI * 2); ctx.fill();
  }

  // Nose
  ctx.fillStyle = "#cc3333";
  ctx.beginPath();
  ctx.ellipse(0, 1 * s + bob, 2.5 * s, 1.8 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth - happy/hurt
  ctx.strokeStyle = "#3e2a1a";
  ctx.lineWidth = 1.5 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (hurt) {
    ctx.moveTo(-5 * s, 8 * s + bob);
    ctx.quadraticCurveTo(0, 5 * s + bob, 5 * s, 8 * s + bob);
  } else {
    ctx.moveTo(-5 * s, 7 * s + bob);
    ctx.quadraticCurveTo(0, 11 * s + bob, 5 * s, 7 * s + bob);
  }
  ctx.stroke();

  // Cheek blush
  ctx.fillStyle = "rgba(255,144,144,0.5)";
  ctx.beginPath(); ctx.arc(-12 * s, 3 * s + bob, 3 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(12 * s, 3 * s + bob, 3 * s, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// Draw obstacle (fruit) on canvas
function drawObstacle(ctx, x, y, obs, frame) {
  const s = obs.h / 30;
  ctx.save();
  ctx.translate(x + obs.w / 2, y + obs.h / 2);
  // Slight wobble
  const wobble = Math.sin(frame * 0.1 + x * 0.01) * 1.5;
  ctx.translate(0, wobble);

  switch (obs.type) {
    case "banana":
      // Yellow curved banana
      ctx.fillStyle = "#f5d040";
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.quadraticCurveTo(-8, -14, 4, -12);
      ctx.quadraticCurveTo(14, -8, 16, 6);
      ctx.quadraticCurveTo(8, 4, 0, 0);
      ctx.quadraticCurveTo(-8, 0, -14, -2);
      ctx.fill();
      ctx.fillStyle = "#fff088";
      ctx.beginPath();
      ctx.moveTo(-12, -3);
      ctx.quadraticCurveTo(-6, -12, 2, -10);
      ctx.quadraticCurveTo(10, -6, 13, 3);
      ctx.quadraticCurveTo(6, 1, -2, -2);
      ctx.fill();
      // Dark tip
      ctx.fillStyle = "#7a5818";
      ctx.beginPath(); ctx.arc(-14, -2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16, 6, 2, 0, Math.PI * 2); ctx.fill();
      break;

    case "apple":
      ctx.fillStyle = "#e84030";
      ctx.beginPath(); ctx.ellipse(0, 2, 14, 13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff7060";
      ctx.beginPath(); ctx.ellipse(-3, -1, 8, 7, 0, 0, Math.PI * 2); ctx.fill();
      // Stem
      ctx.strokeStyle = "#5a3818";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(0, -15); ctx.stroke();
      // Leaf
      ctx.fillStyle = "#5caa5e";
      ctx.beginPath();
      ctx.ellipse(5, -12, 4, 2.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.ellipse(-5, -2, 3, 5, 0, 0, Math.PI * 2); ctx.fill();
      break;

    case "pineapple":
      // Body
      ctx.fillStyle = "#e0a020";
      ctx.beginPath(); ctx.ellipse(0, 6, 13, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f5c050";
      ctx.beginPath(); ctx.ellipse(-2, 3, 8, 11, 0, 0, Math.PI * 2); ctx.fill();
      // Diamond pattern
      ctx.strokeStyle = "#a06820";
      ctx.lineWidth = 0.8;
      for (let i = -10; i <= 10; i += 5) {
        ctx.beginPath(); ctx.moveTo(i - 3, 0); ctx.lineTo(i + 3, 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i - 3, 12); ctx.lineTo(i + 3, 0); ctx.stroke();
      }
      // Leaves
      ctx.fillStyle = "#5caa5e";
      [-6, -2, 2, 6].forEach((dx, i) => {
        ctx.beginPath();
        ctx.moveTo(dx, -8);
        ctx.lineTo(dx - 2 + i, -22);
        ctx.lineTo(dx + 2, -8);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = "#3a7a3c";
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(-1, -25); ctx.lineTo(2, -8);
      ctx.closePath();
      ctx.fill();
      break;

    case "watermelon":
      // Half-watermelon shape
      ctx.fillStyle = "#5caa5e";
      ctx.beginPath();
      ctx.arc(0, 4, 20, Math.PI, 0);
      ctx.lineTo(-20, 4);
      ctx.fill();
      ctx.fillStyle = "#3a7a3c";
      ctx.beginPath();
      ctx.arc(0, 4, 20, Math.PI, 0);
      ctx.closePath();
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pink flesh
      ctx.fillStyle = "#ff7080";
      ctx.beginPath();
      ctx.arc(0, 4, 16, Math.PI, 0);
      ctx.fill();
      // Seeds
      ctx.fillStyle = "#1a1a1a";
      [[-8, -2], [-2, -5], [4, -1], [-10, 2], [8, -3], [10, 1], [-4, -8]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, 1.2, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();
      });
      break;

    case "strawberry":
      // Body
      ctx.fillStyle = "#e84050";
      ctx.beginPath();
      ctx.moveTo(-12, -2);
      ctx.quadraticCurveTo(-13, 14, 0, 16);
      ctx.quadraticCurveTo(13, 14, 12, -2);
      ctx.quadraticCurveTo(8, -8, 0, -8);
      ctx.quadraticCurveTo(-8, -8, -12, -2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = "#ff7080";
      ctx.beginPath();
      ctx.ellipse(-3, 0, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Seeds
      ctx.fillStyle = "#fff5d0";
      [[-5, 0], [3, 1], [-1, 5], [5, 6], [-6, 8], [0, -3], [6, -2]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.ellipse(x, y, 0.8, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      // Leaves
      ctx.fillStyle = "#5caa5e";
      ctx.beginPath();
      ctx.moveTo(-7, -8); ctx.lineTo(-9, -14); ctx.lineTo(-3, -10);
      ctx.lineTo(0, -16); ctx.lineTo(3, -10); ctx.lineTo(9, -14); ctx.lineTo(7, -8);
      ctx.closePath();
      ctx.fill();
      break;

    case "coconut":
      // Brown coconut
      ctx.fillStyle = "#5a3818";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a4828";
      ctx.beginPath();
      ctx.ellipse(-3, -2, 10, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Texture lines
      ctx.strokeStyle = "#3a2010";
      ctx.lineWidth = 0.7;
      for (let a = 0; a < Math.PI * 2; a += 0.4) {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
        ctx.stroke();
      }
      // Three holes
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath(); ctx.arc(-3, -3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3, -3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 1, 1.5, 0, Math.PI * 2); ctx.fill();
      break;
  }
  ctx.restore();
}

function RunnerGame({ studentName, mission, onClose, onComplete }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({
    monkeyY: 0, // 0 = on ground, negative = up in air
    velY: 0,
    onGround: true,
    obstacles: [], // {x, type, w, h, ...}
    speed: 4,
    distance: 0,
    obstaclesPassed: 0,
    cloudOffset: 0,
    mountainOffset: 0,
    groundOffset: 0,
    nextSpawnIn: 80,
    frame: 0,
    paused: false,
    hurt: 0,
  });

  const [showQuestion, setShowQuestion] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [selectedAns, setSelectedAns] = useState(null);
  const [questionResult, setQuestionResult] = useState(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const [size, setSize] = useState({ w: 600, h: 240 });

  const questions = mission?.questions || [];
  const totalReward = mission?.points || 5;
  const targetQuestions = questions.length;
  // Spawn checkpoint every N obstacles (so questions are spread out)
  const obstaclesPerCheckpoint = 5;

  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      const containerW = Math.min(window.innerWidth - 40, 720);
      const w = Math.max(320, containerW);
      const h = Math.round(w * 0.4);
      setSize({ w, h });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Game loop
  useEffect(() => {
    if (!started || gameOver || showQuestion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let lastTime = performance.now();

    const groundY = size.h - 40;
    const monkeySize = Math.min(70, size.h * 0.3);
    const monkeyX = 60;
    const gravity = 0.7;
    const jumpV = -13;

    const loop = (now) => {
      const dt = Math.min(50, now - lastTime);
      lastTime = now;
      const s = stateRef.current;
      s.frame++;

      // Physics
      if (!s.onGround) {
        s.velY += gravity;
        s.monkeyY += s.velY;
        if (s.monkeyY >= 0) {
          s.monkeyY = 0;
          s.velY = 0;
          s.onGround = true;
          SFX.land();
        }
      }

      // Move world
      s.distance += s.speed;
      s.cloudOffset = (s.cloudOffset + s.speed * 0.1) % size.w;
      s.mountainOffset = (s.mountainOffset + s.speed * 0.3) % size.w;
      s.groundOffset = (s.groundOffset + s.speed) % 30;

      // Move obstacles
      s.obstacles = s.obstacles.map(o => ({ ...o, x: o.x - s.speed }));

      // Check passed obstacles
      s.obstacles.forEach(o => {
        if (!o.passed && o.x + o.w < monkeyX - monkeySize / 2) {
          o.passed = true;
          s.obstaclesPassed++;
          SFX.collect();
          setScore(sc => sc + 1);
          // Checkpoint?
          if (s.obstaclesPassed % obstaclesPerCheckpoint === 0) {
            // Trigger question (handled below via state)
            s.paused = true;
          }
        }
      });

      // Remove off-screen
      s.obstacles = s.obstacles.filter(o => o.x + o.w > -10);

      // Spawn obstacles
      s.nextSpawnIn--;
      if (s.nextSpawnIn <= 0) {
        const obs = RUNNER_OBSTACLES[Math.floor(Math.random() * RUNNER_OBSTACLES.length)];
        s.obstacles.push({
          x: size.w + 20,
          ...obs,
          passed: false,
          id: Math.random(),
        });
        // Spawn distance scales with speed
        s.nextSpawnIn = 60 + Math.floor(Math.random() * 60) - Math.min(20, s.speed * 2);
      }

      // Speed up gradually
      s.speed = Math.min(11, 4 + s.distance * 0.0006);

      // Decrease hurt
      if (s.hurt > 0) s.hurt--;

      // Collisions
      const monkeyBox = {
        x: monkeyX - monkeySize * 0.35,
        y: groundY - monkeySize + s.monkeyY,
        w: monkeySize * 0.7,
        h: monkeySize * 0.85,
      };
      s.obstacles.forEach(o => {
        if (o.hit) return;
        const ox = o.x;
        const oy = groundY - o.h;
        if (
          monkeyBox.x < ox + o.w - 4 &&
          monkeyBox.x + monkeyBox.w > ox + 4 &&
          monkeyBox.y < oy + o.h - 4 &&
          monkeyBox.y + monkeyBox.h > oy + 4
        ) {
          o.hit = true;
          s.hurt = 30;
          SFX.wrong();
          setLives(l => {
            const next = l - 1;
            if (next <= 0) {
              setGameOver(true);
              SFX.gameOver();
            }
            return next;
          });
        }
      });

      // === RENDER ===
      // Sky gradient
      const grd = ctx.createLinearGradient(0, 0, 0, size.h);
      grd.addColorStop(0, "#bce0ee");
      grd.addColorStop(0.7, "#e8f4f8");
      grd.addColorStop(1, "#fffaf0");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size.w, size.h);

      // Distant mountains (parallax)
      ctx.fillStyle = "#a3b5c0";
      for (let i = 0; i < 2; i++) {
        const off = -s.mountainOffset + i * size.w;
        ctx.beginPath();
        ctx.moveTo(off, groundY);
        for (let x = 0; x < size.w; x += 40) {
          const yJitter = Math.sin(x * 0.05) * 30 + Math.sin(x * 0.02) * 15;
          ctx.lineTo(off + x, groundY - 50 + yJitter);
        }
        ctx.lineTo(off + size.w, groundY);
        ctx.fill();
      }
      // Snow caps on mountains
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 2; i++) {
        const off = -s.mountainOffset + i * size.w;
        for (let x = 60; x < size.w; x += 80) {
          const yPeak = groundY - 50 + Math.sin(x * 0.05) * 30 + Math.sin(x * 0.02) * 15;
          if (yPeak < groundY - 60) {
            ctx.beginPath();
            ctx.ellipse(off + x, yPeak + 6, 16, 8, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Clouds
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 3; i++) {
        const cx = (i * 220 - s.cloudOffset) % (size.w + 200) - 80;
        const cy = 30 + i * 18;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.arc(cx + 14, cy - 4, 16, 0, Math.PI * 2);
        ctx.arc(cx + 28, cy, 13, 0, Math.PI * 2);
        ctx.arc(cx + 14, cy + 4, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ground
      ctx.fillStyle = "#f5f0ea";
      ctx.fillRect(0, groundY, size.w, size.h - groundY);
      // Snow line
      ctx.strokeStyle = "#d8d0c0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(size.w, groundY);
      ctx.stroke();

      // Ground texture (snow tufts moving)
      ctx.fillStyle = "rgba(220,212,200,0.6)";
      for (let x = -s.groundOffset; x < size.w; x += 30) {
        ctx.beginPath();
        ctx.arc(x, groundY + 3, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Obstacles
      s.obstacles.forEach(o => {
        drawObstacle(ctx, o.x, groundY - o.h, o, s.frame);
      });

      // Monkey
      drawMonkeyOnCanvas(ctx, monkeyX, groundY - monkeySize + s.monkeyY, monkeySize, s.frame, false, s.hurt > 0);

      // Trigger question if paused
      if (s.paused && !showQuestion) {
        s.paused = false;
        const qIdx = (questionsAnswered) % questions.length;
        setQuestionIdx(qIdx);
        setSelectedAns(null);
        setQuestionResult(null);
        setShowQuestion(true);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, gameOver, showQuestion, size, questionsAnswered, questions.length]);

  // Jump handler
  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.onGround && started && !gameOver && !showQuestion) {
      s.velY = -13;
      s.onGround = false;
      SFX.jump();
    }
  }, [started, gameOver, showQuestion]);

  // Input handlers
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!started) setStarted(true);
        else jump();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [jump, started]);

  const answerQuestion = (idx) => {
    if (selectedAns !== null) return;
    setSelectedAns(idx);
    const isCorrect = idx === questions[questionIdx].correct;
    if (isCorrect) SFX.correct();
    else SFX.wrong();
    setQuestionResult(isCorrect ? "correct" : "wrong");
    setTimeout(() => {
      if (isCorrect) {
        setQuestionsAnswered(q => {
          const newCount = q + 1;
          if (newCount >= targetQuestions && !rewarded) {
            setWon(true);
            setGameOver(true);
            setRewarded(true);
            SFX.levelUp();
            onComplete(totalReward);
          }
          return newCount;
        });
      } else {
        // Wrong answer = lose a life
        setLives(l => {
          const next = l - 1;
          if (next <= 0) {
            setGameOver(true);
            SFX.gameOver();
          }
          return next;
        });
      }
      setShowQuestion(false);
      setSelectedAns(null);
      setQuestionResult(null);
    }, isCorrect ? 800 : 1500);
  };

  const restart = () => {
    stateRef.current = {
      monkeyY: 0, velY: 0, onGround: true,
      obstacles: [], speed: 4, distance: 0, obstaclesPassed: 0,
      cloudOffset: 0, mountainOffset: 0, groundOffset: 0,
      nextSpawnIn: 80, frame: 0, paused: false, hurt: 0,
    };
    setLives(3);
    setScore(0);
    setQuestionsAnswered(0);
    setGameOver(false);
    setWon(false);
    setRewarded(false);
    setStarted(true);
  };

  if (!questions || questions.length === 0) {
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 12px" }}>🏃 No Mission Yet</h2>
          <p style={{ color: C.textLight, fontSize: 16 }}>Your teacher hasn't assigned a mission yet!</p>
          <button onClick={onClose} style={primaryBtnStyle}>Okay</button>
        </div>
      </div>
    );
  }

  const currentQ = questions[questionIdx];

  return (
    <div style={modalBackdropStyle}>
      <div style={{
        ...modalCardStyle, width: Math.min(size.w + 80, window.innerWidth - 20),
        maxWidth: "98vw", padding: "20px 24px", position: "relative",
      }} ref={containerRef}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>🏃 {mission.name}</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 13 }}>
              Checkpoints: {questionsAnswered} / {targetQuestions} · Lives: {"❤️".repeat(Math.max(0, lives))}{"🤍".repeat(Math.max(0, 3 - lives))} · Score: {score}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Game canvas */}
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#bce0ee", boxShadow: "inset 0 0 0 2px " + C.fur2 + "30", touchAction: "none" }}
          onMouseDown={(e) => { e.preventDefault(); if (!started) setStarted(true); else jump(); }}
          onTouchStart={(e) => { e.preventDefault(); if (!started) setStarted(true); else jump(); }}
        >
          <canvas
            ref={canvasRef}
            width={size.w}
            height={size.h}
            style={{ display: "block", width: "100%", height: "auto", cursor: "pointer" }}
          />

          {/* Start overlay */}
          {!started && !gameOver && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(2px)",
            }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>🏃</div>
              <div style={{ fontSize: 22, color: C.text, fontWeight: 700, marginBottom: 6 }}>Tap or Press Space to Start!</div>
              <div style={{ fontSize: 14, color: C.textLight, marginBottom: 12, textAlign: "center", maxWidth: 360, padding: "0 16px" }}>
                Help the monkey jump over fruits! Every {obstaclesPerCheckpoint} fruits passed = a question. Answer all {targetQuestions} questions correctly to win!
              </div>
              <div style={{ fontSize: 13, color: C.textLight }}>
                Tap, click, or press <strong>Space</strong> to jump
              </div>
            </div>
          )}

          {/* Game over overlay */}
          {gameOver && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: won ? "rgba(255,250,200,0.92)" : "rgba(255,200,200,0.85)",
              backdropFilter: "blur(2px)",
            }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>{won ? "🎉" : "💔"}</div>
              <div style={{ fontSize: 24, color: C.text, fontWeight: 700, marginBottom: 6 }}>
                {won ? "Mission Complete!" : "Game Over"}
              </div>
              {won ? (
                <div style={{ background: `${C.gold}30`, padding: "8px 16px", borderRadius: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 16, color: C.text }}>You earned <strong style={{ color: C.gold, fontSize: 22 }}>+{totalReward} ★</strong></span>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: C.textLight, marginBottom: 12 }}>
                  You answered {questionsAnswered} of {targetQuestions} checkpoints!
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                {!won && <button onClick={restart} style={primaryBtnStyle}>🔄 Try Again</button>}
                <button onClick={onClose} style={{ ...primaryBtnStyle, background: `linear-gradient(135deg, ${C.green}, #4a8a4c)` }}>
                  Back to Hot Spring
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: C.textLight }}>
          🦘 Tap the game / click / press Space to jump. Don't hit the fruits!
        </div>

        {/* Question modal */}
        {showQuestion && currentQ && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 24, padding: 16, zIndex: 50,
          }}>
            <div style={{
              background: C.card, borderRadius: 18, padding: "20px 24px", width: "100%", maxWidth: 440,
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 14, color: C.textLight }}>🚩 Checkpoint #{questionsAnswered + 1}</div>
                <div style={{ fontSize: 13, color: C.textLight }}>{questionsAnswered + 1} / {targetQuestions}</div>
              </div>
              <div style={{
                background: `${C.snow1}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14,
                fontSize: 18, color: C.text, fontWeight: 600, textAlign: "center", minHeight: 50,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {currentQ.q}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {currentQ.options.map((opt, idx) => {
                  const isCorrect = idx === currentQ.correct;
                  const isSelected = idx === selectedAns;
                  const colors = [C.accent, C.gold, "#5a8fc7", C.green];
                  let bg = colors[idx], textColor = "white";
                  if (selectedAns !== null) {
                    if (isCorrect) bg = C.green;
                    else if (isSelected) bg = "#a85050";
                    else { bg = `${colors[idx]}50`; textColor = `${C.text}80`; }
                  }
                  return (
                    <button key={idx} onClick={() => answerQuestion(idx)} disabled={selectedAns !== null}
                      style={{
                        padding: "12px 10px", borderRadius: 10, border: "none",
                        background: bg, color: textColor,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 15, fontWeight: 700,
                        cursor: selectedAns !== null ? "default" : "pointer", textAlign: "left",
                        minHeight: 50,
                      }}>
                      <strong>{["A","B","C","D"][idx]}.</strong> {opt}
                    </button>
                  );
                })}
              </div>
              {questionResult === "wrong" && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: `${C.accent}20`, borderRadius: 8, color: C.accentDark, fontSize: 14, textAlign: "center" }}>
                  ❌ Wrong! You lost a life. Keep going!
                </div>
              )}
              {questionResult === "correct" && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: `${C.green}20`, borderRadius: 8, color: C.green, fontSize: 14, textAlign: "center" }}>
                  ✅ Correct! Keep running!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── BLOCK BLAST MISSION ─── 8x8 grid where each block placement requires a quiz answer */
const BB_SIZE = 8;
const BB_SHAPES = [
  // Each shape is a list of [r, c] cells relative to origin
  [[0,0]],                        // single
  [[0,0],[0,1]],                  // 2-horiz
  [[0,0],[1,0]],                  // 2-vert
  [[0,0],[0,1],[0,2]],            // 3-horiz
  [[0,0],[1,0],[2,0]],            // 3-vert
  [[0,0],[0,1],[1,0],[1,1]],      // 2x2
  [[0,0],[0,1],[1,0]],            // L small
  [[0,0],[0,1],[1,1]],            // L mirror
];
const BB_COLORS = ["#e84050", "#edb830", "#5caa5e", "#5a8fc7", "#a060c0", "#ff8030"];

function generateShape() {
  const shape = BB_SHAPES[Math.floor(Math.random() * BB_SHAPES.length)];
  const color = BB_COLORS[Math.floor(Math.random() * BB_COLORS.length)];
  return { cells: shape, color, id: Math.random() };
}

function MissionGame({ studentName, mission, onClose, onComplete }) {
  const [grid, setGrid] = useState(() => Array(BB_SIZE).fill(null).map(() => Array(BB_SIZE).fill(null)));
  const [tray, setTray] = useState(() => [generateShape(), generateShape(), generateShape()]);
  const [selectedShapeIdx, setSelectedShapeIdx] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [score, setScore] = useState(0);
  const [showQuestion, setShowQuestion] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState(null); // { shapeIdx, r, c }
  const [questionIdx, setQuestionIdx] = useState(0);
  const [questionResult, setQuestionResult] = useState(null); // null | 'correct' | 'wrong'
  const [selected, setSelected] = useState(null);
  const [questionsCompleted, setQuestionsCompleted] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [rewarded, setRewarded] = useState(false);

  const questions = mission?.questions || [];
  const totalReward = mission?.points || 5;
  // Mission complete when all questions answered correctly
  const targetQuestions = questions.length;

  if (!questions || questions.length === 0) {
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 12px" }}>🚀 No Mission Yet</h2>
          <p style={{ color: C.textLight, fontSize: 16 }}>Your teacher hasn't assigned a mission yet!</p>
          <button onClick={onClose} style={primaryBtnStyle}>Okay</button>
        </div>
      </div>
    );
  }

  const canPlace = (shape, r, c) => {
    for (const [dr, dc] of shape.cells) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= BB_SIZE || nc < 0 || nc >= BB_SIZE) return false;
      if (grid[nr][nc]) return false;
    }
    return true;
  };

  const handleCellClick = (r, c) => {
    if (selectedShapeIdx === null) return;
    const shape = tray[selectedShapeIdx];
    if (!shape || !canPlace(shape, r, c)) return;
    // Show question first
    setPendingPlacement({ shapeIdx: selectedShapeIdx, r, c });
    setQuestionIdx(questionsCompleted % questions.length);
    setSelected(null);
    setQuestionResult(null);
    setShowQuestion(true);
  };

  const checkClearLines = (g) => {
    const newGrid = g.map(row => [...row]);
    let cleared = 0;
    // Check rows
    for (let r = 0; r < BB_SIZE; r++) {
      if (newGrid[r].every(c => c)) {
        for (let c = 0; c < BB_SIZE; c++) newGrid[r][c] = null;
        cleared++;
      }
    }
    // Check columns
    for (let c = 0; c < BB_SIZE; c++) {
      if (newGrid.every(row => row[c])) {
        for (let r = 0; r < BB_SIZE; r++) newGrid[r][c] = null;
        cleared++;
      }
    }
    return { grid: newGrid, cleared };
  };

  const placeShape = () => {
    if (!pendingPlacement) return;
    const { shapeIdx, r, c } = pendingPlacement;
    const shape = tray[shapeIdx];
    const newGrid = grid.map(row => [...row]);
    for (const [dr, dc] of shape.cells) {
      newGrid[r + dr][c + dc] = shape.color;
    }
    const { grid: clearedGrid, cleared } = checkClearLines(newGrid);
    setGrid(clearedGrid);
    setScore(s => s + shape.cells.length + cleared * 10);
    // Remove placed shape, regenerate if all empty
    const newTray = [...tray];
    newTray[shapeIdx] = null;
    if (newTray.every(s => s === null)) {
      setTray([generateShape(), generateShape(), generateShape()]);
    } else {
      setTray(newTray);
    }
    setSelectedShapeIdx(null);
    setPendingPlacement(null);
  };

  const answerQuestion = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    const isCorrect = idx === questions[questionIdx].correct;
    if (isCorrect) SFX.correct();
    else SFX.wrong();
    setQuestionResult(isCorrect ? "correct" : "wrong");
    setTimeout(() => {
      setShowQuestion(false);
      if (isCorrect) {
        placeShape();
        setQuestionsCompleted(q => {
          const newCount = q + 1;
          // Win condition: answered correctly N times where N = number of questions
          if (newCount >= targetQuestions && !rewarded) {
            setRewarded(true);
            setGameOver(true);
            SFX.levelUp();
            onComplete(totalReward);
          }
          return newCount;
        });
      }
      // If wrong: don't place, lose turn
      setPendingPlacement(null);
      setSelected(null);
      setQuestionResult(null);
    }, isCorrect ? 800 : 1500);
  };

  const cellSize = 36;
  const currentQ = questions[questionIdx];
  const progress = (questionsCompleted / targetQuestions) * 100;

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalCardStyle, width: 560, maxWidth: "95vw", maxHeight: "94vh", overflowY: "auto", position: "relative" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>🚀 {mission.name}</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 13 }}>
              {questionsCompleted} / {targetQuestions} answered · {totalReward} ★ reward
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, background: `${C.fur2}30`, borderRadius: 4, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.green})`, transition: "width 0.4s" }} />
        </div>

        {gameOver ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
            <h2 style={{ color: C.text, margin: "0 0 8px", fontSize: 26 }}>Mission Complete!</h2>
            <p style={{ color: C.textLight, fontSize: 16 }}>{studentName}, you answered all {targetQuestions} questions!</p>
            <div style={{ background: `${C.gold}20`, borderRadius: 14, padding: "12px 16px", margin: "16px auto", display: "inline-block" }}>
              <div style={{ fontSize: 16, color: C.text }}>You earned <strong style={{ color: C.gold, fontSize: 22 }}>+{totalReward} ★</strong></div>
            </div>
            <div><button onClick={onClose} style={primaryBtnStyle}>Back to the Hot Spring</button></div>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${BB_SIZE}, ${cellSize}px)`, gap: 2, background: `${C.fur2}30`, padding: 4, borderRadius: 10 }}>
                {grid.map((row, r) => row.map((cell, c) => {
                  // Hover preview
                  let preview = false;
                  if (selectedShapeIdx !== null && hoverCell && tray[selectedShapeIdx]) {
                    const shape = tray[selectedShapeIdx];
                    for (const [dr, dc] of shape.cells) {
                      if (hoverCell.r + dr === r && hoverCell.c + dc === c) preview = true;
                    }
                  }
                  const previewColor = (selectedShapeIdx !== null && tray[selectedShapeIdx]) ? tray[selectedShapeIdx].color : null;
                  const previewValid = preview && selectedShapeIdx !== null && hoverCell && canPlace(tray[selectedShapeIdx], hoverCell.r, hoverCell.c);
                  return (
                    <div
                      key={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      onMouseEnter={() => setHoverCell({ r, c })}
                      onMouseLeave={() => setHoverCell(null)}
                      style={{
                        width: cellSize, height: cellSize,
                        background: cell || (preview ? (previewValid ? `${previewColor}80` : "#ff404060") : `${C.snow1}`),
                        borderRadius: 6,
                        cursor: selectedShapeIdx !== null ? "pointer" : "default",
                        border: cell ? `1px solid ${cell}` : "1px solid #d0d0d0",
                        transition: "background 0.1s",
                      }}
                    />
                  );
                }))}
              </div>
            </div>

            {/* Score */}
            <div style={{ textAlign: "center", fontSize: 16, color: C.textLight, marginBottom: 10 }}>
              Block score: <strong style={{ color: C.gold, fontSize: 20 }}>{score}</strong>
            </div>

            {/* Tray */}
            <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 6 }}>
              {tray.map((shape, idx) => {
                if (!shape) return <div key={idx} style={{ width: 80, height: 80, opacity: 0.3, display: "flex", alignItems: "center", justifyContent: "center", color: C.textLight, fontSize: 12 }}>—</div>;
                const maxR = Math.max(...shape.cells.map(c => c[0]));
                const maxC = Math.max(...shape.cells.map(c => c[1]));
                const traySize = 18;
                const isSelected = selectedShapeIdx === idx;
                return (
                  <div key={idx} onClick={() => setSelectedShapeIdx(idx)}
                    style={{
                      cursor: "pointer", padding: 8, borderRadius: 10,
                      background: isSelected ? `${C.gold}30` : "transparent",
                      border: isSelected ? `2px solid ${C.gold}` : `2px solid transparent`,
                      transition: "all 0.2s",
                    }}>
                    <div style={{ display: "grid", gridTemplateColumns: `repeat(${maxC + 1}, ${traySize}px)`, gap: 2 }}>
                      {Array(maxR + 1).fill(null).map((_, r) => Array(maxC + 1).fill(null).map((__, c) => {
                        const filled = shape.cells.some(([cr, cc]) => cr === r && cc === c);
                        return <div key={`${r}-${c}`} style={{ width: traySize, height: traySize, background: filled ? shape.color : "transparent", borderRadius: 3 }} />;
                      }))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: C.textLight }}>
              {selectedShapeIdx === null ? "👆 Pick a shape, then click on the grid" : "Click a cell to place — you'll need to answer a question!"}
            </div>
          </>
        )}

        {/* Question modal overlay */}
        {showQuestion && currentQ && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 24, padding: 16, zIndex: 50,
          }}>
            <div style={{
              background: C.card, borderRadius: 18, padding: "20px 24px", width: "100%", maxWidth: 440,
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            }}>
              <div style={{ fontSize: 14, color: C.textLight, marginBottom: 6 }}>Answer to place block</div>
              <div style={{
                background: `${C.snow1}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14,
                fontSize: 18, color: C.text, fontWeight: 600, textAlign: "center", minHeight: 50,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {currentQ.q}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {currentQ.options.map((opt, idx) => {
                  const isCorrect = idx === currentQ.correct;
                  const isSelected = idx === selected;
                  const colors = [C.accent, C.gold, "#5a8fc7", C.green];
                  let bg = colors[idx], textColor = "white";
                  if (selected !== null) {
                    if (isCorrect) bg = C.green;
                    else if (isSelected) bg = "#a85050";
                    else { bg = `${colors[idx]}50`; textColor = `${C.text}80`; }
                  }
                  return (
                    <button key={idx} onClick={() => answerQuestion(idx)} disabled={selected !== null}
                      style={{
                        padding: "12px 10px", borderRadius: 10, border: "none",
                        background: bg, color: textColor,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 15, fontWeight: 700,
                        cursor: selected !== null ? "default" : "pointer", textAlign: "left",
                        minHeight: 50,
                      }}>
                      <strong>{["A","B","C","D"][idx]}.</strong> {opt}
                    </button>
                  );
                })}
              </div>
              {questionResult === "wrong" && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: `${C.accent}20`, borderRadius: 8, color: C.accentDark, fontSize: 14, textAlign: "center" }}>
                  ❌ Wrong! You can't place that block. Try another shape.
                </div>
              )}
              {questionResult === "correct" && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: `${C.green}20`, borderRadius: 8, color: C.green, fontSize: 14, textAlign: "center" }}>
                  ✅ Correct! Placing block...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function SnowMonkeyTracker() {
  const [anyHovering, setAnyHovering] = useState(false);
  return (
    <HoverContext.Provider value={{ anyHovering, setAnyHovering }}>
      <SnowMonkeyTrackerInner />
    </HoverContext.Provider>
  );
}

function SnowMonkeyTrackerInner() {
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("login");
  const [loginTab, setLoginTab] = useState("teacher");
  const [user, setUser] = useState(null);
  const [teachers, setTeachers] = useState(DEFAULT_TEACHERS);
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
  const [showMission, setShowMission] = useState(false);
  const [showQuizPicker, setShowQuizPicker] = useState(false);
  const [showMissionPicker, setShowMissionPicker] = useState(false);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [activeMissionId, setActiveMissionId] = useState(null);
  const [showPetMart, setShowPetMart] = useState(false);
  const [petMartTab, setPetMartTab] = useState("packs"); // "packs" | "collection"
  const [packResult, setPackResult] = useState(null); // { pet, isDuplicate, consolationStars }
  const [showCustomize, setShowCustomize] = useState(false);
  const [customizeTab, setCustomizeTab] = useState("all"); // "all" | "owned" | "shop"
  const [quizzes, setQuizzes] = useState({}); // { studentId: [{id, subject, name, points, questions[]}] }
  const [missions, setMissions] = useState({}); // { studentId: [{id, name, points, questions[]}] }
  const [showQuizUpload, setShowQuizUpload] = useState(false);
  const [showMissionUpload, setShowMissionUpload] = useState(false);
  const [showAccessories, setShowAccessories] = useState(false);
  const [quizUploadStudentId, setQuizUploadStudentId] = useState(null);
  const [missionUploadStudentId, setMissionUploadStudentId] = useState(null);
  const [csvText, setCsvText] = useState("");
  const [csvError, setCsvError] = useState("");
  const [csvSubject, setCsvSubject] = useState("");
  const [csvName, setCsvName] = useState("");
  const [csvPoints, setCsvPoints] = useState(1);
  const [csvMissionType, setCsvMissionType] = useState("blockblast");
  const [leaderboardOpen, setLeaderboardOpen] = useState(true);
  const [streakOpen, setStreakOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(getSoundsEnabled());
  const toggleSound = () => {
    const next = !soundOn;
    setSoundsEnabled(next);
    setSoundOn(next);
    if (next) setTimeout(() => SFX.click(), 50); // Confirm sound is back
  };

  useEffect(() => {
    (async () => {
      try {
        const t = await getTeachers();
        const s = await getStudents();
        const q = await getQuizzes();
        const m = await getMissions();
        setTeachers(t);
        setStudents(s);
        setQuizzes(q || {});
        setMissions(m || {});
      } catch (error) {
        console.error("Failed to load data:", error);
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (newT, newS, newQ, newM) => {
    if (newT) { setTeachers(newT); }
    if (newS) {
      const prevStudents = students;
      setStudents(newS);
      for (const student of newS) {
        const prev = prevStudents.find(p => p.id === student.id);
        if (prev && JSON.stringify(prev) !== JSON.stringify(student)) {
          try {
            const { id, ...data } = student;
            await updateStudent(id, data);
          } catch (error) {
            console.error("Failed to update student:", student.name, error);
          }
        }
      }
    }
    if (newQ) {
      setQuizzes(newQ);
      const prevQuizzes = quizzes;
      for (const studentId in newQ) {
        if (JSON.stringify(prevQuizzes[studentId]) !== JSON.stringify(newQ[studentId])) {
          try {
            if (newQ[studentId] && newQ[studentId].length > 0) {
              await setQuizzesForStudent(studentId, newQ[studentId]);
            } else {
              await deleteQuizzesForStudent(studentId);
            }
          } catch (error) {
            console.error("Failed to update quiz:", error);
          }
        }
      }
      for (const studentId in prevQuizzes) {
        if (!(studentId in newQ)) {
          try { await deleteQuizzesForStudent(studentId); } catch (e) { console.error(e); }
        }
      }
    }
    if (newM) {
      setMissions(newM);
      const prevMissions = missions;
      for (const studentId in newM) {
        if (JSON.stringify(prevMissions[studentId]) !== JSON.stringify(newM[studentId])) {
          try {
            if (newM[studentId] && newM[studentId].length > 0) {
              await setMissionsForStudent(studentId, newM[studentId]);
            } else {
              await deleteMissionsForStudent(studentId);
            }
          } catch (error) {
            console.error("Failed to update mission:", error);
          }
        }
      }
      for (const studentId in prevMissions) {
        if (!(studentId in newM)) {
          try { await deleteMissionsForStudent(studentId); } catch (e) { console.error(e); }
        }
      }
    }
  }, [students, quizzes, missions]);

  const addQuizForStudent = (studentId, csvData, subject, name, points) => {
    const parsed = parseCSV(csvData);
    if (!parsed) return { error: "Couldn't parse CSV. Make sure your file has columns: question, A, B, C, D, correct" };
    if (parsed.length === 0) return { error: "No questions found in CSV" };
    const newQuiz = {
      id: "q" + Date.now(),
      subject: subject?.trim() || "General",
      name: name?.trim() || "Quiz",
      points: Math.max(1, parseInt(points) || 1),
      questions: parsed,
    };
    const existing = quizzes[studentId] || [];
    const newQuizzes = { ...quizzes, [studentId]: [...existing, newQuiz] };
    persist(null, null, newQuizzes);
    return { success: parsed.length };
  };

  const removeQuizFromStudent = (studentId, quizId) => {
    const existing = quizzes[studentId] || [];
    const filtered = existing.filter(q => q.id !== quizId);
    const newQuizzes = { ...quizzes };
    if (filtered.length > 0) newQuizzes[studentId] = filtered;
    else delete newQuizzes[studentId];
    persist(null, null, newQuizzes);
  };

  const addMissionForStudent = (studentId, csvData, name, points, type = "blockblast") => {
    const parsed = parseCSV(csvData);
    if (!parsed) return { error: "Couldn't parse CSV. Make sure your file has columns: question, A, B, C, D, correct" };
    if (parsed.length === 0) return { error: "No questions found in CSV" };
    const newMission = {
      id: "m" + Date.now(),
      name: name?.trim() || "Mission",
      points: Math.max(1, parseInt(points) || 5),
      type, // "blockblast" or "runner"
      questions: parsed,
    };
    const existing = missions[studentId] || [];
    const newMissions = { ...missions, [studentId]: [...existing, newMission] };
    persist(null, null, null, newMissions);
    return { success: parsed.length };
  };

  const removeMissionFromStudent = (studentId, missionId) => {
    const existing = missions[studentId] || [];
    const filtered = existing.filter(m => m.id !== missionId);
    const newMissions = { ...missions };
    if (filtered.length > 0) newMissions[studentId] = filtered;
    else delete newMissions[studentId];
    persist(null, null, null, newMissions);
  };

  const handleQuizCorrect = async () => {
    if (!user) return;
    // Reward is given on quiz completion, not per-question now
  };

  const handleQuizComplete = async (pointsEarned) => {
    if (!user) return;
    const newS = students.map(s => s.id === user.id ? { ...s, points: s.points + pointsEarned } : s);
    persist(null, newS);
    SFX.reward();
    notify(`🎉 Quiz complete! +${pointsEarned} ★`);
  };

  const handleMissionComplete = async (pointsEarned) => {
    if (!user) return;
    const newS = students.map(s => s.id === user.id ? { ...s, points: s.points + pointsEarned } : s);
    persist(null, newS);
    SFX.levelUp();
    notify(`🚀 Mission complete! +${pointsEarned} ★`);
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

  const addStudent = async () => {
    if (!newStudentName.trim() || !newStudentUser.trim() || !newStudentPass.trim()) { notify("Please fill in all fields", "error"); return; }
    if (students.find(s => s.username === newStudentUser) || teachers.find(t => t.username === newStudentUser)) { notify("Username already taken", "error"); return; }
    try {
      const studentData = {
        username: newStudentUser.trim(),
        password: newStudentPass.trim(),
        name: newStudentName.trim(),
        points: 0,
        accessories: [],
        ownedPets: [],
        pet: null,
      };
      const newStudent = await addStudentToDB(studentData);
      setStudents([...students, newStudent]);
      setNewStudentName(""); setNewStudentUser(""); setNewStudentPass(""); setShowAddStudent(false);
      notify(`${newStudentName.trim()} joined the hot spring!`);
    } catch (error) {
      console.error("Failed to add student:", error);
      notify("Failed to add student. Try again.", "error");
    }
  };

  const removeStudent = async (id) => {
    try {
      await deleteStudent(id);
      setStudents(students.filter(s => s.id !== id));
      if (selectedStudent === id) setSelectedStudent(null);
      notify("Student removed");
    } catch (error) {
      console.error("Failed to remove student:", error);
      notify("Failed to remove student", "error");
    }
  };

  const addPoints = (id, amount) => {
    const newS = students.map(s => s.id === id ? { ...s, points: Math.max(0, s.points + amount) } : s);
    persist(null, newS);
    const st = students.find(s => s.id === id);
    notify(`${amount > 0 ? "+" : ""}${amount} point${Math.abs(amount) !== 1 ? "s" : ""} for ${st?.name}!`);
  };

  const toggleAccessory = (studentId, accessoryId) => {
    const acc = getAccessory(accessoryId);
    if (!acc) return;
    const st = students.find(s => s.id === studentId);
    if (!st) return;
    const ownedAccessories = st.ownedAccessories || [];
    // Free items are always available; paid items must be owned
    if (acc.price > 0 && !ownedAccessories.includes(accessoryId)) {
      SFX.wrong();
      notify(`You haven't unlocked the ${acc.name} yet!`, "error");
      return;
    }
    const current = st.accessories || [];
    const has = current.includes(accessoryId);
    let next;
    if (has) {
      next = current.filter(a => a !== accessoryId);
      SFX.click();
    } else {
      // Remove anything else in the same slot
      const filtered = current.filter(id => {
        const other = getAccessory(id);
        return !other || other.slot !== acc.slot;
      });
      next = [...filtered, accessoryId];
      SFX.collect();
    }
    const newS = students.map(s => s.id === studentId ? { ...s, accessories: next } : s);
    persist(null, newS);
  };

  const buyAccessory = (studentId, accessoryId) => {
    const acc = getAccessory(accessoryId);
    const st = students.find(s => s.id === studentId);
    if (!acc || !st) return;
    if (acc.price === 0) return; // shouldn't happen
    const ownedAccessories = st.ownedAccessories || [];
    if (ownedAccessories.includes(accessoryId)) return; // already owned
    if (st.points < acc.price) {
      SFX.wrong();
      notify(`Not enough stars! Need ${acc.price - st.points} more ★`, "error");
      return;
    }
    // Equip immediately, replacing any existing item in same slot
    const current = st.accessories || [];
    const equipped = [...current.filter(id => {
      const o = getAccessory(id);
      return !o || o.slot !== acc.slot;
    }), accessoryId];

    const newS = students.map(s => s.id === studentId ? {
      ...s,
      points: s.points - acc.price,
      accessories: equipped,
      ownedAccessories: [...ownedAccessories, accessoryId],
    } : s);
    persist(null, newS);
    SFX.packOpen();
    notify(`🎉 You unlocked ${acc.emoji} ${acc.name}!`);
  };

  const clearAccessories = (studentId) => {
    const newS = students.map(s => s.id === studentId ? { ...s, accessories: [] } : s);
    persist(null, newS);
    SFX.click();
    notify("Accessories cleared!");
  };

  // Equip / unequip an already-owned pet
  const equipPet = (studentId, petId) => {
    const pet = getPet(petId);
    const st = students.find(s => s.id === studentId);
    if (!pet || !st) return;
    const ownedPets = st.ownedPets || [];
    if (!ownedPets.includes(petId)) return; // can't equip something you don't own
    if (st.pet === petId) {
      // Unequip - keep timer paused
      const newS = students.map(s => s.id === studentId ? { ...s, pet: null } : s);
      persist(null, newS);
      SFX.click();
      notify(`${pet.name} sent home for now`);
      return;
    }
    // Equip - reset the income timer so they wait a fresh week
    const newS = students.map(s => s.id === studentId ? {
      ...s,
      pet: petId,
      petAcquiredAt: Date.now(),
      lastIncomeCollected: Date.now(),
    } : s);
    persist(null, newS);
    SFX.collect();
    notify(`${pet.emoji} ${pet.name} is by your side!`);
  };

  // Open a mystery pack
  const openPack = (studentId, packId) => {
    const pack = MYSTERY_PACKS.find(p => p.id === packId);
    const st = students.find(s => s.id === studentId);
    if (!pack || !st) return null;
    if (st.points < pack.price) {
      SFX.wrong();
      notify(`Not enough stars! Need ${pack.price - st.points} more ★`, "error");
      return null;
    }
    const ownedPets = st.ownedPets || [];
    const rolled = rollPack(packId, ownedPets);
    if (!rolled) return null;
    const isDuplicate = ownedPets.includes(rolled.id);
    // Duplicates → consolation stars (refund roughly 30% of pack price)
    const consolationStars = isDuplicate ? Math.round(pack.price * 0.3) : 0;
    const newOwned = isDuplicate ? ownedPets : [...ownedPets, rolled.id];
    // If this is their FIRST pet, auto-equip it
    const shouldAutoEquip = !st.pet && !isDuplicate;
    const newS = students.map(s => s.id === studentId ? {
      ...s,
      points: s.points - pack.price + consolationStars,
      ownedPets: newOwned,
      ...(shouldAutoEquip ? { pet: rolled.id, petAcquiredAt: Date.now(), lastIncomeCollected: Date.now() } : {}),
    } : s);
    persist(null, newS);
    SFX.packOpen();
    return { pet: rolled, isDuplicate, consolationStars };
  };

  // Collect weekly income from currently-equipped pet
  const collectIncome = (studentId) => {
    const st = students.find(s => s.id === studentId);
    if (!st) return 0;
    const pending = calculatePendingIncome(st);
    if (pending <= 0) return 0;
    const newS = students.map(s => s.id === studentId ? {
      ...s,
      points: s.points + pending,
      lastIncomeCollected: Date.now(),
    } : s);
    persist(null, newS);
    SFX.reward();
    notify(`🎁 Your ${getPet(st.pet)?.name || "pet"} brought you +${pending} ★!`);
    return pending;
  };

  const logout = () => { setUser(null); setScreen("login"); setSelectedStudent(null); setShowManage(false); setShowAddStudent(false); setShowWordle(false); setShowQuiz(false); setShowMission(false); setShowQuizPicker(false); setShowMissionPicker(false); setShowQuizUpload(false); setShowMissionUpload(false); setShowAccessories(false); setShowPetMart(false); setShowCustomize(false); };

  const todayKey = getTodayKey();
  const hasCompletedChallenge = (studentId) => {
    const s = students.find(st => st.id === studentId);
    return s?.lastChallengeDate === todayKey;
  };

  // Effective streak: returns 0 if student missed a day (broken streak)
  const getEffectiveStreak = (student) => {
    if (!student?.streak) return 0;
    if (!student.lastChallengeDate) return 0;
    const last = new Date(student.lastChallengeDate);
    const today = new Date(todayKey);
    const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
    if (diffDays > 1) return 0; // Missed a day - streak broken
    return student.streak;
  };

  const handleWordleWin = () => {
    if (!user || hasCompletedChallenge(user.id)) return;
    const me = students.find(s => s.id === user.id);
    if (!me) return;

    // Calculate new streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const oldStreak = me.streak || 0;
    const oldLevel = getStreakLevel(oldStreak).id;
    let newStreak;
    if (me.lastChallengeDate === yesterdayKey) {
      newStreak = oldStreak + 1; // Continued streak
    } else if (me.lastChallengeDate === todayKey) {
      newStreak = oldStreak; // Same day - shouldn't happen due to guard above
    } else {
      newStreak = 1; // Reset streak (broken or first time)
    }
    const newLevel = getStreakLevel(newStreak).id;
    const leveledUp = newLevel !== oldLevel;

    const newS = students.map(s => s.id === user.id ? {
      ...s,
      points: s.points + 1,
      lastChallengeDate: todayKey,
      streak: newStreak,
      bestStreak: Math.max(s.bestStreak || 0, newStreak),
    } : s);
    persist(null, newS);
    setShowWordle(false);
    if (leveledUp) {
      const lvl = getStreakLevel(newStreak);
      SFX.levelUp();
      notify(`🎉 ${lvl.icon} Streak ${newStreak}! You leveled up to ${lvl.name}!`);
    } else {
      SFX.reward();
      notify(`🎉 +1 point! Streak: ${newStreak} 🔥`);
    }
  };

  const handleWordleLose = () => {
    if (!user || hasCompletedChallenge(user.id)) return;
    // Mark day as attempted (no points), and reset streak since they didn't win
    const newS = students.map(s => s.id === user.id ? {
      ...s,
      lastChallengeDate: todayKey,
      streak: 0, // Streak broken — they didn't get it right
    } : s);
    persist(null, newS);
    setShowWordle(false);
    notify("😔 Better luck tomorrow! Streak reset.", "error");
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
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", position: "relative", zIndex: 20, background: `${C.card}cc`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.fur2}20` }}>
          <div>
            <h1 style={{ fontSize: 26, color: C.text, margin: 0 }}>♨️ Monkey Hot Spring</h1>
            <p style={{ color: C.textLight, margin: 0, fontSize: 14 }}>Welcome, {user?.name}! · {students.length} student{students.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={toggleSound}
              title={soundOn ? "Mute sounds" : "Unmute sounds"}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {soundOn ? "🔊" : "🔇"}
            </button>
            {[
              { label: "📋 Manage", active: showManage, fn: () => { SFX.click(); setShowManage(!showManage); setShowAddStudent(false); }, c: C.accent },
              { label: "➕ Add", active: showAddStudent, fn: () => { SFX.click(); setShowAddStudent(!showAddStudent); setShowManage(false); }, c: C.green },
              { label: "🚪 Logout", active: false, fn: logout, c: C.textLight },
            ].map((b, i) => (
              <button key={i} onClick={b.fn} style={{ padding: "9px 18px", borderRadius: 12, border: `2px solid ${b.c}30`, background: b.active ? b.c : `${C.card}dd`, color: b.active ? "white" : C.text, fontFamily: "'Patrick Hand', cursive", fontSize: 15, cursor: "pointer", transition: "all 0.3s", fontWeight: 600 }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Panels */}
        {showAddStudent && (
          <div style={{ position: "absolute", top: 72, right: 28, zIndex: 30, background: C.card, borderRadius: 22, padding: 28, width: 310, boxShadow: "0 16px 48px rgba(0,0,0,0.15)", border: `2px solid ${C.green}30` }}>
            <h3 style={{ margin: "0 0 16px", color: C.text, fontSize: 22 }}>New Student</h3>
            {[{ val: newStudentName, set: setNewStudentName, ph: "Display Name" }, { val: newStudentUser, set: setNewStudentUser, ph: "Username" }, { val: newStudentPass, set: setNewStudentPass, ph: "Password", type: "password" }].map((f, i) => (
              <input key={i} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} type={f.type || "text"} style={{ ...inputStyle, marginBottom: 10 }} />
            ))}
            <button onClick={addStudent} style={{ width: "100%", padding: 13, borderRadius: 14, border: "none", background: C.green, color: "white", fontFamily: "'Patrick Hand', cursive", fontSize: 18, cursor: "pointer", fontWeight: 700, marginTop: 4 }}>Add to Hot Spring!</button>
          </div>
        )}
        {showManage && (
          <div style={{ position: "absolute", top: 72, right: 28, zIndex: 30, background: C.card, borderRadius: 22, padding: 24, width: 420, boxShadow: "0 16px 48px rgba(0,0,0,0.15)", border: `2px solid ${C.accent}30`, maxHeight: "82vh", overflowY: "auto" }}>
            <h3 style={{ margin: "0 0 14px", color: C.text, fontSize: 22 }}>Student List</h3>
            {students.length === 0 && <p style={{ color: C.textLight }}>No students yet!</p>}
            {students.map(s => {
              const studentQuizzes = quizzes[s.id] || [];
              const studentMissions = missions[s.id] || [];
              return (
                <div key={s.id} style={{ padding: "12px 14px", borderRadius: 14, background: `${C.snow1}80`, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, color: C.text, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: C.textLight }}>@{s.username} · ★ {s.points} pts</div>
                    </div>
                    <button onClick={() => { if (confirm(`Remove ${s.name}?`)) removeStudent(s.id); }} style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: `${C.accent}15`, color: C.accentDark, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 14 }}>✕</button>
                  </div>

                  {/* Quizzes section */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>📚 Quizzes ({studentQuizzes.length})</div>
                      <button onClick={() => { setQuizUploadStudentId(s.id); setShowQuizUpload(true); setCsvText(""); setCsvSubject(""); setCsvName(""); setCsvPoints(1); setCsvError(""); }}
                        style={{ padding: "3px 10px", borderRadius: 8, border: "none", background: `${C.accent}25`, color: C.accent, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 12, fontWeight: 700 }}>
                        + Add
                      </button>
                    </div>
                    {studentQuizzes.length === 0 && <div style={{ fontSize: 11, color: C.textLight, fontStyle: "italic", paddingLeft: 4 }}>No quizzes yet</div>}
                    {(() => {
                      // Group by subject
                      const bySubject = {};
                      studentQuizzes.forEach(q => {
                        const sub = q.subject || "General";
                        if (!bySubject[sub]) bySubject[sub] = [];
                        bySubject[sub].push(q);
                      });
                      return Object.entries(bySubject).map(([sub, qs]) => (
                        <div key={sub} style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: 11, color: C.textLight, fontWeight: 700, marginBottom: 2 }}>{sub}</div>
                          {qs.map(q => (
                            <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: `${C.accent}10`, borderRadius: 6, marginBottom: 2 }}>
                              <div style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {q.name} · {q.questions.length}Q · {q.points}★
                              </div>
                              <button onClick={() => { if (confirm(`Remove "${q.name}"?`)) removeQuizFromStudent(s.id, q.id); }}
                                style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: C.accentDark, cursor: "pointer", fontSize: 11 }}>
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Missions section */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>🚀 Missions ({studentMissions.length})</div>
                      <button onClick={() => { setMissionUploadStudentId(s.id); setShowMissionUpload(true); setCsvText(""); setCsvName(""); setCsvPoints(5); setCsvError(""); }}
                        style={{ padding: "3px 10px", borderRadius: 8, border: "none", background: `${C.green}25`, color: C.green, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 12, fontWeight: 700 }}>
                        + Add
                      </button>
                    </div>
                    {studentMissions.length === 0 && <div style={{ fontSize: 11, color: C.textLight, fontStyle: "italic", paddingLeft: 4 }}>No missions yet</div>}
                    {studentMissions.map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: `${C.green}15`, borderRadius: 6, marginBottom: 2 }}>
                        <div style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.type === "runner" ? "🏃" : "🧩"} {m.name} · {m.questions.length}Q · {m.points}★
                        </div>
                        <button onClick={() => { if (confirm(`Remove "${m.name}"?`)) removeMissionFromStudent(s.id, m.id); }}
                          style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: C.accentDark, cursor: "pointer", fontSize: 11 }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quiz CSV Upload Modal */}
        {showQuizUpload && (() => {
          const targetStudent = students.find(s => s.id === quizUploadStudentId);
          const handleFileUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => setCsvText(ev.target.result);
            reader.readAsText(file);
          };
          const submitQuiz = () => {
            if (!csvText.trim()) { setCsvError("Please paste CSV or upload a file"); return; }
            const result = addQuizForStudent(quizUploadStudentId, csvText, csvSubject, csvName, csvPoints);
            if (result.error) { setCsvError(result.error); return; }
            notify(`Quiz "${csvName || "Quiz"}" added for ${targetStudent?.name}: ${result.success} questions!`);
            setShowQuizUpload(false);
            setCsvText(""); setCsvSubject(""); setCsvName(""); setCsvPoints(1); setCsvError("");
          };
          return (
            <div style={modalBackdropStyle} onClick={() => setShowQuizUpload(false)}>
              <div style={{ ...modalCardStyle, width: 580, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>📚 Add Quiz for {targetStudent?.name}</h2>
                  <button onClick={() => setShowQuizUpload(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4 }}>Subject</label>
                    <input type="text" value={csvSubject} onChange={e => setCsvSubject(e.target.value)}
                      placeholder="e.g. Math, Science"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 15, color: C.text, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4 }}>Quiz name</label>
                    <input type="text" value={csvName} onChange={e => setCsvName(e.target.value)}
                      placeholder="e.g. Chapter 3 Test"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 15, color: C.text, boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4 }}>★ Points to award (max, scaled by % correct)</label>
                  <input type="number" min="1" max="100" value={csvPoints} onChange={e => setCsvPoints(e.target.value)}
                    style={{ width: 100, padding: "8px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 15, color: C.text, boxSizing: "border-box" }} />
                </div>
                <div style={{ background: `${C.snow1}80`, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 12, color: C.textLight }}>
                  <strong style={{ color: C.text }}>CSV Format:</strong> <code>question, A, B, C, D, correct</code> (correct = A/B/C/D)
                </div>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
                  style={{ marginBottom: 10, fontFamily: "'Patrick Hand', cursive", fontSize: 14, color: C.text }} />
                <textarea value={csvText} onChange={e => { setCsvText(e.target.value); setCsvError(""); }}
                  placeholder={"question,A,B,C,D,correct\nWhat is the capital of France?,Berlin,Madrid,Paris,Rome,C"}
                  style={{
                    width: "100%", height: 140, padding: 12, borderRadius: 10,
                    border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`,
                    fontFamily: "monospace", fontSize: 13, color: C.text,
                    resize: "vertical", outline: "none", boxSizing: "border-box",
                  }} />
                {csvError && <p style={{ color: C.accentDark, fontSize: 14, margin: "8px 0 0" }}>{csvError}</p>}
                <button onClick={submitQuiz} style={{ ...primaryBtnStyle, width: "100%", marginTop: 14 }}>
                  Add Quiz
                </button>
              </div>
            </div>
          );
        })()}

        {/* Mission CSV Upload Modal */}
        {showMissionUpload && (() => {
          const targetStudent = students.find(s => s.id === missionUploadStudentId);
          const handleFileUpload = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => setCsvText(ev.target.result);
            reader.readAsText(file);
          };
          const submitMission = () => {
            if (!csvText.trim()) { setCsvError("Please paste CSV or upload a file"); return; }
            const result = addMissionForStudent(missionUploadStudentId, csvText, csvName, csvPoints, csvMissionType);
            if (result.error) { setCsvError(result.error); return; }
            notify(`Mission "${csvName || "Mission"}" added for ${targetStudent?.name}: ${result.success} questions!`);
            setShowMissionUpload(false);
            setCsvText(""); setCsvName(""); setCsvPoints(5); setCsvMissionType("blockblast"); setCsvError("");
          };
          return (
            <div style={modalBackdropStyle} onClick={() => setShowMissionUpload(false)}>
              <div style={{ ...modalCardStyle, width: 580, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>🚀 Add Mission for {targetStudent?.name}</h2>
                  <button onClick={() => setShowMissionUpload(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>

                {/* Mission type selector */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 6, fontWeight: 700 }}>Mission Type</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { id: "blockblast", emoji: "🧩", title: "Block Blast", desc: "Tetris-style puzzle. Place each block by answering a question." },
                      { id: "runner", emoji: "🏃", title: "Fruit Runner", desc: "Dino-style runner! Jump fruits, answer questions at checkpoints." },
                    ].map(m => {
                      const active = csvMissionType === m.id;
                      return (
                        <button key={m.id} onClick={() => setCsvMissionType(m.id)}
                          style={{
                            padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                            border: active ? `2px solid ${C.green}` : `2px solid ${C.fur2}40`,
                            background: active ? `${C.green}15` : `${C.snow1}80`,
                            fontFamily: "'Patrick Hand', cursive", textAlign: "left",
                            transition: "all 0.2s",
                          }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 2 }}>{m.emoji} {m.title}</div>
                          <div style={{ fontSize: 11, color: C.textLight, lineHeight: 1.3 }}>{m.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: `${C.green}15`, borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13, color: C.text, border: `1px solid ${C.green}30` }}>
                  {csvMissionType === "runner" ? (
                    <><strong>🏃 Fruit Runner:</strong> The monkey runs and jumps over fruits like 🍌🍎🍍🍉. Every 5 fruits passed, a question pops up. Wrong answer = lose a life (3 lives). Mission complete when all questions are answered correctly!</>
                  ) : (
                    <><strong>🧩 Block Blast:</strong> The student plays a Tetris-like puzzle. Every time they place a block, they must answer one of these questions correctly. Mission completes when they answer all questions correctly.</>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4 }}>Mission name</label>
                    <input type="text" value={csvName} onChange={e => setCsvName(e.target.value)}
                      placeholder={csvMissionType === "runner" ? "e.g. Math Sprint" : "e.g. Math Mission Week 1"}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 15, color: C.text, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4 }}>★ Reward</label>
                    <input type="number" min="1" max="100" value={csvPoints} onChange={e => setCsvPoints(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 15, color: C.text, boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ background: `${C.snow1}80`, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 12, color: C.textLight }}>
                  <strong style={{ color: C.text }}>CSV Format:</strong> <code>question, A, B, C, D, correct</code>
                </div>
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload}
                  style={{ marginBottom: 10, fontFamily: "'Patrick Hand', cursive", fontSize: 14, color: C.text }} />
                <textarea value={csvText} onChange={e => { setCsvText(e.target.value); setCsvError(""); }}
                  placeholder={"question,A,B,C,D,correct\nWhat is 12 x 8?,84,96,108,112,B"}
                  style={{
                    width: "100%", height: 140, padding: 12, borderRadius: 10,
                    border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`,
                    fontFamily: "monospace", fontSize: 13, color: C.text,
                    resize: "vertical", outline: "none", boxSizing: "border-box",
                  }} />
                {csvError && <p style={{ color: C.accentDark, fontSize: 14, margin: "8px 0 0" }}>{csvError}</p>}
                <button onClick={submitMission} style={{ ...primaryBtnStyle, width: "100%", marginTop: 14, background: `linear-gradient(135deg, ${C.green}, #4a8a4c)` }}>
                  Add Mission
                </button>
              </div>
            </div>
          );
        })()}

        {/* Scene */}
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
                  <MonkeySVG size={students.length > 10 ? 80 : students.length > 6 ? 95 : 110} mood={s.points > 20 ? "excited" : s.points > 5 ? "happy" : "neutral"} label={s.name} points={s.points} delay={i * 0.4} variant={i} accessories={s.accessories || []} pet={s.pet} streakLevel={getStreakLevel(getEffectiveStreak(s)).id} selected={selectedStudent === s.id} onClick={() => setSelectedStudent(selectedStudent === s.id ? null : s.id)} />
                </div>
              );
            })}
          </div>

          {/* Teacher leaderboard - top-right, collapsible */}
          {(() => {
            const teacherSorted = [...students].sort((a, b) => b.points - a.points);
            return !leaderboardOpen ? (
              <button
                onClick={() => setLeaderboardOpen(true)}
                style={{
                  position: "absolute", top: 16, right: 16, zIndex: 30,
                  background: `${C.card}e8`, borderRadius: 999, padding: "10px 16px",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
                  border: `2px solid ${C.gold}40`, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 16, fontWeight: 700, color: C.text,
                }}
                title="Show leaderboard"
              >
                🏆 <span>Leaderboard</span>
              </button>
            ) : (
              <div style={{
                position: "absolute", top: 16, right: 16, zIndex: 30,
                background: `${C.card}e8`, borderRadius: 18, padding: "12px 14px",
                boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
                border: `2px solid ${C.gold}25`, width: 230,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🏆 Leaderboard</div>
                  <button
                    onClick={() => setLeaderboardOpen(false)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: C.textLight, padding: "0 4px", lineHeight: 1, fontWeight: 700 }}
                    title="Hide"
                  >×</button>
                </div>
                <div style={{ marginBottom: teacherSorted.length > 3 ? 8 : 0 }}>
                  {teacherSorted.slice(0, 3).map((s, i) => {
                    const podiumBg = i === 0 ? `${C.gold}25` : i === 1 ? "#b0b0b020" : "#cd7f3220";
                    return (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 9px", borderRadius: 10,
                        background: podiumBg,
                        marginBottom: 4,
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 700, width: 22, textAlign: "center" }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.name}
                        </span>
                        <span style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>★{s.points}</span>
                      </div>
                    );
                  })}
                </div>
                {teacherSorted.length > 3 && (
                  <>
                    <div style={{ fontSize: 11, color: C.textLight, textAlign: "center", marginBottom: 4, opacity: 0.7 }}>— rest of the troop —</div>
                    <div style={{ maxHeight: 140, overflowY: "auto", paddingRight: 4 }}>
                      <style>{`
                        .lb-teacher::-webkit-scrollbar { width: 5px; }
                        .lb-teacher::-webkit-scrollbar-thumb { background: ${C.fur2}80; border-radius: 4px; }
                      `}</style>
                      <div className="lb-teacher" style={{ maxHeight: 140, overflowY: "auto" }}>
                        {teacherSorted.slice(3).map((s, i) => (
                          <div key={s.id} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "5px 8px", borderRadius: 8, marginBottom: 2,
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 700, width: 26, textAlign: "center", color: C.textLight }}>#{i + 4}</span>
                            <span style={{ flex: 1, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                            <span style={{ fontSize: 13, color: C.gold, fontWeight: 700 }}>★{s.points}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Points bar */}
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

        {/* Accessories Picker Modal - Teacher view (can gift any accessory) */}
        {showAccessories && sel && (() => {
          const current = sel.accessories || [];
          const owned = sel.ownedAccessories || [];
          // Group catalog by slot
          const bySlot = {};
          ACCESSORY_CATALOG.forEach(a => {
            if (!bySlot[a.slot]) bySlot[a.slot] = [];
            bySlot[a.slot].push(a);
          });
          const slotLabels = { head: "🎩 Head", face: "🕶️ Face", neck: "🧣 Neck", hold: "🎾 Hold", back: "🦋 Back" };
          // Teacher can grant any accessory (bypass ownership check)
          const teacherToggle = (id) => {
            const acc = getAccessory(id);
            if (!acc) return;
            // Auto-grant ownership for paid items when teacher equips
            const newOwned = (acc.price > 0 && !owned.includes(id)) ? [...owned, id] : owned;
            const has = current.includes(id);
            let next;
            if (has) {
              next = current.filter(a => a !== id);
              SFX.click();
            } else {
              next = [...current.filter(otherId => {
                const o = getAccessory(otherId);
                return !o || o.slot !== acc.slot;
              }), id];
              SFX.collect();
            }
            const newS = students.map(s => s.id === sel.id ? { ...s, accessories: next, ownedAccessories: newOwned } : s);
            persist(null, newS);
          };
          return (
            <div style={modalBackdropStyle} onClick={() => setShowAccessories(false)}>
              <div style={{ ...modalCardStyle, width: 720, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>✨ Dress up {sel.name}</h2>
                  <button onClick={() => setShowAccessories(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>

                {/* Preview of monkey with current accessories */}
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center",
                  background: `${C.snow1}80`, borderRadius: 18, padding: 16, marginBottom: 14,
                  height: 180,
                }}>
                  <MonkeySVG size={150} mood="happy" delay={0}
                    variant={students.findIndex(st => st.id === sel.id)}
                    accessories={current} pet={sel.pet} />
                </div>

                <p style={{ color: C.textLight, fontSize: 13, margin: "0 0 14px", textAlign: "center" }}>
                  As teacher, you can gift any accessory for free! 🎁
                </p>

                {/* Accessories grouped by slot */}
                {ACCESSORY_SLOTS.map(slot => {
                  const items = bySlot[slot];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={slot} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.textLight, marginBottom: 6, letterSpacing: 0.5 }}>
                        {slotLabels[slot] || slot.toUpperCase()}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6 }}>
                        {items.map(acc => {
                          const active = current.includes(acc.id);
                          const rarityColor = RARITY_COLORS[acc.rarity] || C.fur2;
                          return (
                            <button key={acc.id} onClick={() => teacherToggle(acc.id)}
                              style={{
                                padding: "10px 6px", borderRadius: 12,
                                border: active ? `2.5px solid ${C.gold}` : `2px solid ${rarityColor}40`,
                                background: active ? `${C.gold}20` : `${C.snow1}80`,
                                cursor: "pointer", transition: "all 0.2s",
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                                fontFamily: "'Patrick Hand', cursive", position: "relative",
                              }}>
                              {acc.price > 0 && (
                                <div style={{
                                  position: "absolute", top: 3, right: 3,
                                  fontSize: 8, padding: "1px 5px", borderRadius: 6,
                                  background: rarityColor, color: "white", fontWeight: 700, textTransform: "uppercase",
                                }}>{acc.rarity}</div>
                              )}
                              <span style={{ fontSize: 28, marginTop: acc.price > 0 ? 6 : 0 }}>{acc.emoji}</span>
                              <span style={{ fontSize: 11, color: C.text, fontWeight: 600, textAlign: "center", lineHeight: 1.1 }}>{acc.name}</span>
                              {active && <span style={{ fontSize: 9, color: C.gold, fontWeight: 700 }}>EQUIPPED</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
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

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", position: "relative", zIndex: 20, background: `${C.card}cc`, backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.fur2}20` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1 style={{ fontSize: 26, color: C.text, margin: 0 }}>♨️ Monkey Hot Spring</h1>
            <div style={{ background: `${C.gold}18`, borderRadius: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, color: C.text, fontWeight: 600 }}>{me?.name}</span>
              <span style={{ fontSize: 18, color: C.gold, fontWeight: 700 }}>★ {me?.points || 0}</span>
              <span style={{ fontSize: 14, color: C.accent, fontWeight: 600 }}>#{rank}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={toggleSound}
              title={soundOn ? "Mute sounds" : "Unmute sounds"}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {soundOn ? "🔊" : "🔇"}
            </button>
            <button onClick={logout} style={{ padding: "9px 18px", borderRadius: 12, border: `2px solid ${C.fur2}40`, background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive", fontSize: 15, cursor: "pointer" }}>🚪 Logout</button>
          </div>
        </div>

        {/* Wordle modal */}
        {showWordle && <WordleGame onWin={handleWordleWin} onLose={handleWordleLose} onClose={() => setShowWordle(false)} />}

        {/* Quiz Picker modal - choose which quiz to play */}
        {showQuizPicker && me && (() => {
          const myQuizzes = quizzes[me.id] || [];
          const bySubject = {};
          myQuizzes.forEach(q => {
            const sub = q.subject || "General";
            if (!bySubject[sub]) bySubject[sub] = [];
            bySubject[sub].push(q);
          });
          return (
            <div style={modalBackdropStyle} onClick={() => setShowQuizPicker(false)}>
              <div style={{ ...modalCardStyle, width: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>📚 Pick a Quiz</h2>
                  <button onClick={() => setShowQuizPicker(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>
                {myQuizzes.length === 0 ? (
                  <p style={{ color: C.textLight, textAlign: "center", padding: 20 }}>No quizzes assigned yet!</p>
                ) : (
                  Object.entries(bySubject).map(([sub, qs]) => (
                    <div key={sub} style={{ marginBottom: 14 }}>
                      <h3 style={{ fontSize: 14, color: C.textLight, fontWeight: 700, margin: "0 0 6px", letterSpacing: 0.5 }}>{sub.toUpperCase()}</h3>
                      {qs.map(q => (
                        <button key={q.id}
                          onClick={() => { setActiveQuizId(q.id); setShowQuizPicker(false); setShowQuiz(true); }}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            width: "100%", padding: "12px 14px", borderRadius: 12,
                            background: `${C.accent}15`, border: `2px solid ${C.accent}30`,
                            cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
                            color: C.text, fontSize: 16, marginBottom: 6, textAlign: "left",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = `${C.accent}25`}
                          onMouseLeave={e => e.currentTarget.style.background = `${C.accent}15`}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{q.name}</div>
                            <div style={{ fontSize: 12, color: C.textLight }}>{q.questions.length} questions</div>
                          </div>
                          <div style={{ background: C.gold, color: "white", padding: "4px 10px", borderRadius: 999, fontSize: 14, fontWeight: 700 }}>
                            ★ {q.points}
                          </div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* Mission Picker modal */}
        {showMissionPicker && me && (() => {
          const myMissions = missions[me.id] || [];
          return (
            <div style={modalBackdropStyle} onClick={() => setShowMissionPicker(false)}>
              <div style={{ ...modalCardStyle, width: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>🚀 Pick a Mission</h2>
                  <button onClick={() => setShowMissionPicker(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>
                {myMissions.length === 0 ? (
                  <p style={{ color: C.textLight, textAlign: "center", padding: 20 }}>No missions assigned yet!</p>
                ) : (
                  myMissions.map(m => (
                    <button key={m.id}
                      onClick={() => { setActiveMissionId(m.id); setShowMissionPicker(false); setShowMission(true); }}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        width: "100%", padding: "14px 16px", borderRadius: 12,
                        background: `${C.green}15`, border: `2px solid ${C.green}40`,
                        cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
                        color: C.text, fontSize: 16, marginBottom: 8, textAlign: "left",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${C.green}25`}
                      onMouseLeave={e => e.currentTarget.style.background = `${C.green}15`}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 17 }}>{m.type === "runner" ? "🏃" : "🧩"} {m.name}</div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{m.type === "runner" ? "Fruit Runner" : "Block Blast"} · {m.questions.length} questions</div>
                      </div>
                      <div style={{ background: C.gold, color: "white", padding: "4px 12px", borderRadius: 999, fontSize: 15, fontWeight: 700 }}>
                        ★ {m.points}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {/* Quiz modal */}
        {showQuiz && me && (() => {
          const activeQuiz = (quizzes[me.id] || []).find(q => q.id === activeQuizId);
          if (!activeQuiz) { setShowQuiz(false); return null; }
          return (
            <QuizGame
              studentId={me.id}
              studentName={me.name}
              quiz={activeQuiz}
              onClose={() => { setShowQuiz(false); setActiveQuizId(null); }}
              onComplete={handleQuizComplete}
            />
          );
        })()}

        {/* Mission modal - dispatches to the right game type */}
        {showMission && me && (() => {
          const activeMission = (missions[me.id] || []).find(m => m.id === activeMissionId);
          if (!activeMission) { setShowMission(false); return null; }
          const closeFn = () => { setShowMission(false); setActiveMissionId(null); };
          if (activeMission.type === "runner") {
            return (
              <RunnerGame
                studentName={me.name}
                mission={activeMission}
                onClose={closeFn}
                onComplete={handleMissionComplete}
              />
            );
          }
          return (
            <MissionGame
              studentName={me.name}
              mission={activeMission}
              onClose={closeFn}
              onComplete={handleMissionComplete}
            />
          );
        })()}

        {/* Action buttons - top center */}
        {(() => {
          const done = hasCompletedChallenge(me?.id);
          const myQuizzes = quizzes[me?.id] || [];
          const myMissions = missions[me?.id] || [];
          const hasQuiz = myQuizzes.length > 0;
          const hasMission = myMissions.length > 0;
          return (
            <div style={{ position: "absolute", top: 74, left: "50%", transform: "translateX(-50%)", zIndex: 25, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", maxWidth: "90%" }}>
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
                {done ? "✅ Daily Done!" : "🧩 Daily Challenge"}
              </button>
              <button onClick={() => hasQuiz && setShowQuizPicker(true)}
                style={{
                  padding: "10px 22px", borderRadius: 16,
                  border: `2px solid ${hasQuiz ? C.accent + "60" : C.fur2 + "50"}`,
                  background: hasQuiz ? `${C.card}ee` : `${C.card}cc`,
                  color: hasQuiz ? C.text : C.textLight,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                  cursor: hasQuiz ? "pointer" : "default",
                  boxShadow: hasQuiz ? `0 4px 14px ${C.accent}30` : "none",
                  transition: "all 0.3s", display: "flex", alignItems: "center", gap: 8,
                  backdropFilter: "blur(8px)",
                }}>
                {hasQuiz ? `📚 Quizzes (${myQuizzes.length})` : "📚 No Quizzes"}
              </button>
              <button onClick={() => hasMission && setShowMissionPicker(true)}
                style={{
                  padding: "10px 22px", borderRadius: 16,
                  border: `2px solid ${hasMission ? C.green + "70" : C.fur2 + "50"}`,
                  background: hasMission ? `${C.card}ee` : `${C.card}cc`,
                  color: hasMission ? C.text : C.textLight,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                  cursor: hasMission ? "pointer" : "default",
                  boxShadow: hasMission ? `0 4px 14px ${C.green}30` : "none",
                  transition: "all 0.3s", display: "flex", alignItems: "center", gap: 8,
                  backdropFilter: "blur(8px)",
                }}>
                {hasMission ? `🚀 Missions (${myMissions.length})` : "🚀 No Missions"}
              </button>
              <button onClick={() => { setPetMartTab("packs"); setShowPetMart(true); }}
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
                  position: "relative",
                }}>
                🎁 Pet Packs
                {calculatePendingIncome(me) > 0 && (
                  <span style={{
                    position: "absolute", top: -6, right: -6,
                    background: `linear-gradient(135deg, ${C.gold}, #ff8030)`,
                    color: "white", fontSize: 11, fontWeight: 700,
                    padding: "2px 7px", borderRadius: 999,
                    boxShadow: `0 2px 8px ${C.gold}80`,
                    animation: "incomeBadgePulse 1.4s ease-in-out infinite",
                  }}>
                    <style>{`@keyframes incomeBadgePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>
                    +{calculatePendingIncome(me)} ★
                  </span>
                )}
              </button>
            </div>
          );
        })()}

        {/* Customize Monkey modal - student dresses up own monkey */}
        {showCustomize && me && (() => {
          const owned = me.ownedAccessories || [];
          const equipped = me.accessories || [];
          // Filter accessories: free OR owned
          const visibleAccessories = ACCESSORY_CATALOG.filter(a => {
            if (customizeTab === "owned") return a.price === 0 || owned.includes(a.id);
            if (customizeTab === "shop") return a.price > 0;
            return true;
          });
          // Group by slot
          const bySlot = {};
          visibleAccessories.forEach(a => {
            if (!bySlot[a.slot]) bySlot[a.slot] = [];
            bySlot[a.slot].push(a);
          });
          const slotLabels = { head: "🎩 Head", face: "🕶️ Face", neck: "🧣 Neck", hold: "🎾 Hold", back: "🦋 Back" };

          return (
            <div style={modalBackdropStyle} onClick={() => setShowCustomize(false)}>
              <div style={{ ...modalCardStyle, width: 720, maxWidth: "95vw", maxHeight: "92vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 24 }}>🎨 Customize {me.name}</h2>
                  <button onClick={() => setShowCustomize(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>

                {/* Live preview */}
                <div style={{
                  display: "flex", justifyContent: "center", alignItems: "center", gap: 16, flexWrap: "wrap",
                  background: `linear-gradient(135deg, ${C.snow1}, ${C.water1}30)`, borderRadius: 18, padding: "16px 12px", marginBottom: 14,
                }}>
                  <MonkeySVG size={160} mood="excited" delay={0}
                    variant={students.findIndex(st => st.id === me.id)}
                    accessories={equipped} pet={me.pet}
                    streakLevel={getStreakLevel(getEffectiveStreak(me)).id} />
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 14, color: C.textLight, marginBottom: 2 }}>Stars</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 8 }}>★ {me.points}</div>
                    <div style={{ fontSize: 13, color: C.textLight }}>
                      {equipped.length} equipped · {owned.length} owned
                    </div>
                    <button onClick={() => clearAccessories(me.id)}
                      style={{ marginTop: 10, padding: "6px 12px", borderRadius: 10, border: `2px solid ${C.accent}40`, background: "transparent", color: C.accentDark, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 13, fontWeight: 600 }}>
                      Remove All
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, justifyContent: "center" }}>
                  {[
                    { id: "all", label: "All" },
                    { id: "owned", label: `My Items (${owned.length + ACCESSORY_CATALOG.filter(a => a.price === 0).length})` },
                    { id: "shop", label: "🛍️ Shop" },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setCustomizeTab(tab.id)}
                      style={{
                        padding: "7px 16px", borderRadius: 999,
                        border: customizeTab === tab.id ? `2px solid ${C.accent}` : `2px solid ${C.fur2}30`,
                        background: customizeTab === tab.id ? `${C.accent}20` : "transparent",
                        color: customizeTab === tab.id ? C.accentDark : C.textLight,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Accessories grouped by slot */}
                {ACCESSORY_SLOTS.map(slot => {
                  const items = bySlot[slot];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={slot} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.textLight, marginBottom: 8, letterSpacing: 0.5 }}>
                        {slotLabels[slot] || slot.toUpperCase()}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
                        {items.map(acc => {
                          const isOwned = acc.price === 0 || owned.includes(acc.id);
                          const isEquipped = equipped.includes(acc.id);
                          const canAfford = me.points >= acc.price;
                          const rarityColor = RARITY_COLORS[acc.rarity] || C.fur2;
                          return (
                            <div key={acc.id} style={{
                              background: isEquipped ? `${C.gold}20` : `${C.snow1}80`,
                              border: isEquipped ? `2.5px solid ${C.gold}` : `2px solid ${rarityColor}40`,
                              borderRadius: 12, padding: "10px 8px",
                              cursor: "pointer", transition: "all 0.2s",
                              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                              fontFamily: "'Patrick Hand', cursive",
                              position: "relative", overflow: "hidden",
                            }}
                              onClick={() => {
                                if (isOwned) toggleAccessory(me.id, acc.id);
                                else if (canAfford && window.confirm(`Buy ${acc.name} for ${acc.price} ★?`)) buyAccessory(me.id, acc.id);
                                else if (!canAfford) {
                                  SFX.wrong();
                                  notify(`Need ${acc.price - me.points} more ★`, "error");
                                }
                              }}>
                              {/* Rarity badge */}
                              {acc.price > 0 && (
                                <div style={{
                                  position: "absolute", top: 4, right: 4,
                                  fontSize: 9, padding: "1px 6px", borderRadius: 8,
                                  background: rarityColor, color: "white", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
                                }}>{acc.rarity}</div>
                              )}
                              <div style={{ fontSize: 32, marginTop: acc.price > 0 ? 8 : 0 }}>{acc.emoji}</div>
                              <div style={{ fontSize: 11, color: C.text, fontWeight: 600, textAlign: "center", lineHeight: 1.1 }}>{acc.name}</div>
                              {isEquipped ? (
                                <div style={{ fontSize: 9, color: C.gold, fontWeight: 700, letterSpacing: 0.5 }}>EQUIPPED</div>
                              ) : isOwned ? (
                                <div style={{ fontSize: 9, color: C.green, fontWeight: 700, letterSpacing: 0.5 }}>{acc.price === 0 ? "FREE" : "OWNED"}</div>
                              ) : (
                                <div style={{
                                  fontSize: 11, fontWeight: 700,
                                  color: canAfford ? C.gold : C.textLight,
                                  background: canAfford ? `${C.gold}15` : "transparent",
                                  padding: "1px 8px", borderRadius: 8,
                                }}>★ {acc.price}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Pet Mart modal - Mystery Packs + Pet Collection */}
        {showPetMart && me && (() => {
          const owned = me.ownedPets || [];
          const equipped = me.pet;
          const pendingIncome = calculatePendingIncome(me);
          const nextIncome = getNextIncomeDate(me);
          const equippedPet = equipped ? getPet(equipped) : null;
          // Compute days until next payout
          let nextDays = null;
          if (nextIncome && pendingIncome === 0) {
            nextDays = Math.max(0, Math.ceil((nextIncome - Date.now()) / (1000 * 60 * 60 * 24)));
          }

          return (
            <div style={modalBackdropStyle} onClick={() => { if (!packResult) setShowPetMart(false); }}>
              <div style={{ ...modalCardStyle, width: 800, maxWidth: "96vw", maxHeight: "92vh", overflowY: "auto", position: "relative" }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <h2 style={{ margin: 0, color: C.text, fontSize: 26 }}>🎁 Mystery Pet Packs</h2>
                    <p style={{ margin: "2px 0 0", color: C.textLight, fontSize: 14 }}>Open packs to discover rare companions!</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ background: `${C.gold}20`, borderRadius: 12, padding: "8px 16px", border: `2px solid ${C.gold}50` }}>
                      <span style={{ fontSize: 22, color: C.gold, fontWeight: 700 }}>★ {me.points}</span>
                    </div>
                    <button onClick={() => setShowPetMart(false)} style={{ background: "none", border: "none", fontSize: 24, color: C.textLight, cursor: "pointer" }}>✕</button>
                  </div>
                </div>

                {/* Equipped Pet + Income Section */}
                {equippedPet && (
                  <div style={{
                    background: `linear-gradient(135deg, ${RARITY_COLORS[equippedPet.rarity]}20, ${RARITY_COLORS[equippedPet.rarity]}10)`,
                    border: `2px solid ${RARITY_COLORS[equippedPet.rarity]}50`,
                    borderRadius: 14, padding: "12px 14px", marginBottom: 14,
                    display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                  }}>
                    <div style={{ fontSize: 44 }}>{equippedPet.emoji}</div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 16, color: C.text, fontWeight: 700 }}>{equippedPet.name}</div>
                      <div style={{ fontSize: 12, color: C.textLight }}>
                        {equippedPet.rarity.toUpperCase()} · {equippedPet.weeklyIncome} ★/week
                      </div>
                    </div>
                    {pendingIncome > 0 ? (
                      <button onClick={() => collectIncome(me.id)}
                        style={{
                          padding: "10px 20px", borderRadius: 12, border: "none",
                          background: `linear-gradient(135deg, ${C.gold}, #ff8030)`,
                          color: "white", fontFamily: "'Patrick Hand', cursive",
                          fontSize: 16, fontWeight: 700, cursor: "pointer",
                          boxShadow: `0 4px 14px ${C.gold}60`,
                          animation: "incomePulse 1.4s ease-in-out infinite",
                        }}>
                        <style>{`@keyframes incomePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>
                        🎁 Collect +{pendingIncome} ★
                      </button>
                    ) : (
                      <div style={{ fontSize: 12, color: C.textLight, textAlign: "right" }}>
                        Next payout in <strong>{nextDays} day{nextDays !== 1 ? "s" : ""}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, justifyContent: "center" }}>
                  {[
                    { id: "packs", label: "🎁 Packs" },
                    { id: "collection", label: `📚 My Pets (${owned.length}/${PET_CATALOG.length})` },
                  ].map(tab => (
                    <button key={tab.id} onClick={() => setPetMartTab(tab.id)}
                      style={{
                        padding: "8px 18px", borderRadius: 999,
                        border: petMartTab === tab.id ? `2px solid ${C.accent}` : `2px solid ${C.fur2}30`,
                        background: petMartTab === tab.id ? `${C.accent}20` : "transparent",
                        color: petMartTab === tab.id ? C.accentDark : C.textLight,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 14, fontWeight: 700, cursor: "pointer",
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* PACKS TAB */}
                {petMartTab === "packs" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                    {MYSTERY_PACKS.map(pack => {
                      const canAfford = me.points >= pack.price;
                      // Find the highest non-zero rarity in odds for badge
                      const rarityOrder = ["mythic", "legendary", "epic", "rare", "uncommon", "common"];
                      const bestRarity = rarityOrder.find(r => pack.odds[r] > 0);
                      return (
                        <div key={pack.id} style={{
                          background: `linear-gradient(135deg, ${pack.color}20, ${pack.color}05)`,
                          border: `2px solid ${pack.color}60`,
                          borderRadius: 16, padding: 14,
                          opacity: canAfford ? 1 : 0.7,
                          position: "relative",
                          transition: "transform 0.2s",
                        }}
                          onMouseEnter={e => canAfford && (e.currentTarget.style.transform = "translateY(-3px)")}
                          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                        >
                          <div style={{ fontSize: 56, textAlign: "center", marginBottom: 4 }}>
                            <span style={{ filter: `drop-shadow(0 4px 12px ${pack.color}90)` }}>{pack.flavor}</span>
                          </div>
                          <div style={{ fontSize: 16, color: C.text, fontWeight: 700, textAlign: "center" }}>{pack.name}</div>
                          <div style={{ fontSize: 11, color: C.textLight, textAlign: "center", margin: "4px 0 8px", minHeight: 30, lineHeight: 1.3 }}>
                            {pack.description}
                          </div>

                          {/* Odds breakdown */}
                          <div style={{
                            background: `${C.snow1}80`, borderRadius: 8, padding: "6px 8px", marginBottom: 10,
                            fontSize: 10, color: C.textLight,
                          }}>
                            {Object.entries(pack.odds).filter(([_, w]) => w > 0).map(([rarity, weight]) => (
                              <div key={rarity} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}>
                                <span style={{ color: RARITY_COLORS[rarity], fontWeight: 700 }}>{rarity}</span>
                                <span>{weight}%</span>
                              </div>
                            ))}
                          </div>

                          <button onClick={() => {
                            if (!canAfford) {
                              SFX.wrong();
                              notify(`Need ${pack.price - me.points} more ★`, "error");
                              return;
                            }
                            const result = openPack(me.id, pack.id);
                            if (result) setPackResult(result);
                          }}
                            disabled={!canAfford}
                            style={{
                              width: "100%", padding: "10px 14px", borderRadius: 10, border: "none",
                              background: canAfford ? `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)` : `${C.fur2}80`,
                              color: "white",
                              fontFamily: "'Patrick Hand', cursive", fontSize: 15, fontWeight: 700,
                              cursor: canAfford ? "pointer" : "not-allowed",
                              boxShadow: canAfford ? `0 4px 14px ${pack.color}40` : "none",
                            }}>
                            {canAfford ? `Open · ★ ${pack.price.toLocaleString()}` : `Need ${pack.price - me.points} more ★`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* COLLECTION TAB */}
                {petMartTab === "collection" && (
                  <>
                    <p style={{ fontSize: 12, color: C.textLight, textAlign: "center", margin: "0 0 12px" }}>
                      💡 Tap a pet you own to make them follow your monkey. They earn weekly stars while equipped!
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                      {PET_CATALOG.map(pet => {
                        const isOwned = owned.includes(pet.id);
                        const isEquipped = equipped === pet.id;
                        const rarityColor = RARITY_COLORS[pet.rarity];
                        return (
                          <div key={pet.id} style={{
                            background: isEquipped ? `${C.gold}15` : isOwned ? `${C.snow1}90` : `${C.snow1}40`,
                            borderRadius: 14, padding: "12px 8px",
                            border: isEquipped ? `2.5px solid ${C.gold}` : `2px solid ${rarityColor}40`,
                            cursor: isOwned ? "pointer" : "default",
                            opacity: isOwned ? 1 : 0.55,
                            position: "relative", textAlign: "center",
                            transition: "all 0.2s",
                          }}
                            onClick={() => isOwned && equipPet(me.id, pet.id)}>
                            <div style={{
                              position: "absolute", top: 5, right: 5,
                              background: rarityColor, color: "white",
                              fontSize: 9, fontWeight: 700, padding: "1px 6px",
                              borderRadius: 6, letterSpacing: 0.5, textTransform: "uppercase",
                            }}>{pet.rarity}</div>
                            <div style={{ fontSize: 44, marginTop: 14, marginBottom: 4, filter: isOwned ? "none" : "grayscale(100%)" }}>
                              {isOwned ? pet.emoji : "❓"}
                            </div>
                            <div style={{ fontSize: 13, color: C.text, fontWeight: 700, lineHeight: 1.1 }}>
                              {isOwned ? pet.name : "Unknown"}
                            </div>
                            <div style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>
                              {pet.weeklyIncome} ★/week
                            </div>
                            {isEquipped && (
                              <div style={{ fontSize: 9, color: C.gold, fontWeight: 700, marginTop: 4, letterSpacing: 0.5 }}>
                                ✓ EQUIPPED
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* PACK REVEAL OVERLAY - shown when student opens a pack */}
        {packResult && me && (() => {
          const pet = packResult.pet;
          const rarityColor = RARITY_COLORS[pet.rarity];
          return (
            <div style={{
              position: "fixed", inset: 0, zIndex: 3000, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            }}
              onClick={() => setPackResult(null)}>
              <div style={{
                position: "relative",
                background: `radial-gradient(circle at center, ${rarityColor}40, ${C.card})`,
                border: `3px solid ${rarityColor}`,
                borderRadius: 24, padding: "30px 36px",
                width: 380, maxWidth: "90vw", textAlign: "center",
                boxShadow: `0 0 60px ${rarityColor}80, 0 24px 64px rgba(0,0,0,0.6)`,
                animation: "packBurst 0.6s ease-out",
                fontFamily: "'Patrick Hand', cursive",
              }}
                onClick={e => e.stopPropagation()}>
                <style>{`
                  @keyframes packBurst {
                    0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
                    60% { transform: scale(1.08) rotate(2deg); opacity: 1; }
                    100% { transform: scale(1) rotate(0); opacity: 1; }
                  }
                  @keyframes packPetBob {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-8px) scale(1.03); }
                  }
                  @keyframes packTwinkle {
                    0%, 100% { opacity: 0.4; transform: scale(0.9); }
                    50% { opacity: 1; transform: scale(1.2); }
                  }
                `}</style>
                {/* Background sparkles */}
                {[...Array(8)].map((_, i) => {
                  const angle = (i / 8) * Math.PI * 2;
                  const radius = 130;
                  return (
                    <div key={i} style={{
                      position: "absolute",
                      left: `calc(50% + ${Math.cos(angle) * radius}px)`,
                      top: `calc(50% + ${Math.sin(angle) * radius}px)`,
                      fontSize: 22,
                      animation: `packTwinkle 1.4s ease-in-out ${i * 0.15}s infinite`,
                      pointerEvents: "none",
                      color: rarityColor,
                    }}>✦</div>
                  );
                })}

                <div style={{
                  fontSize: 13, color: rarityColor, fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", marginBottom: 6,
                }}>
                  {pet.rarity}
                </div>
                <div style={{
                  fontSize: 96, marginBottom: 8,
                  animation: "packPetBob 1.6s ease-in-out infinite",
                  filter: `drop-shadow(0 6px 20px ${rarityColor}80)`,
                }}>
                  {pet.emoji}
                </div>
                <div style={{ fontSize: 24, color: C.text, fontWeight: 700, marginBottom: 4 }}>
                  {pet.name}
                </div>
                <div style={{ fontSize: 13, color: C.textLight, marginBottom: 14 }}>
                  Earns {pet.weeklyIncome} ★ per week!
                </div>

                {packResult.isDuplicate ? (
                  <div style={{
                    background: `${C.gold}20`, borderRadius: 12, padding: "10px 14px",
                    marginBottom: 14, fontSize: 14, color: C.text,
                  }}>
                    You already have this one! 💰<br/>
                    <strong style={{ color: C.gold, fontSize: 18 }}>+{packResult.consolationStars} ★</strong> consolation stars!
                  </div>
                ) : (
                  <div style={{
                    background: `${C.green}20`, borderRadius: 12, padding: "10px 14px",
                    marginBottom: 14, fontSize: 14, color: C.green, fontWeight: 700,
                  }}>
                    🎉 New companion unlocked!
                  </div>
                )}

                <button onClick={() => setPackResult(null)}
                  style={{
                    padding: "12px 28px", borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg, ${rarityColor}, ${rarityColor}cc)`,
                    color: "white", fontFamily: "'Patrick Hand', cursive",
                    fontSize: 17, fontWeight: 700, cursor: "pointer",
                    boxShadow: `0 4px 14px ${rarityColor}60`,
                  }}>
                  Awesome!
                </button>
              </div>
            </div>
          );
        })()}

        {/* Full scene (same as teacher but no click actions) */}
        <div style={{ position: "relative", margin: "8px auto 0", width: "96%", maxWidth: 1300, height: "calc(100vh - 90px)", borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
          <BackgroundScene w={1300} h={800} />
          <div style={{ position: "absolute", top: "30%", left: "6%", right: "6%", bottom: "6%", borderRadius: 20, overflow: "hidden" }}>
            <WaterCanvas width={1150} height={550} />
          </div>
          <SteamParticles count={18} />
          <PenguinFlock />

          {/* All monkeys in the scene (view only, student's own monkey glows) */}
          <div style={{ position: "absolute", top: "28%", left: "5%", right: "5%", bottom: "5%", zIndex: 10 }}>
            {students.map((s, i) => {
              const pos = monkeyPositions[i % monkeyPositions.length];
              const isMe = s.id === me?.id;
              return (
                <div key={s.id} style={{ position: "absolute", left: pos.left, top: pos.top, zIndex: isMe ? 18 : 15 }}>
                  {isMe && (
                    <div style={{
                      position: "absolute",
                      top: -28,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: `${C.card}f0`,
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontFamily: "'Patrick Hand', cursive",
                      color: C.text,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      border: `2px solid ${C.gold}50`,
                      pointerEvents: "none",
                      animation: "tapHintPulse 2.5s ease-in-out infinite",
                    }}>
                      <style>{`
                        @keyframes tapHintPulse {
                          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.8; }
                          50% { transform: translateX(-50%) translateY(-3px); opacity: 1; }
                        }
                      `}</style>
                      ✨ tap to customize
                    </div>
                  )}
                  <MonkeySVG
                    size={students.length > 10 ? 80 : students.length > 6 ? 95 : 110}
                    mood={s.points > 20 ? "excited" : s.points > 5 ? "happy" : "neutral"}
                    label={s.name} points={s.points}
                    delay={i * 0.4} variant={i}
                    accessories={s.accessories || []}
                    pet={s.pet}
                    streakLevel={getStreakLevel(getEffectiveStreak(s)).id}
                    selected={isMe}
                    onClick={isMe ? () => setShowCustomize(true) : undefined}
                  />
                </div>
              );
            })}
          </div>

          {/* Streak Tracker - top-left, collapsible */}
          {(() => {
            const myStreak = getEffectiveStreak(me);
            const myLevel = getStreakLevel(myStreak);
            const nextLevel = getNextStreakLevel(myStreak);
            const daysToNext = nextLevel ? nextLevel.days - myStreak : 0;
            const progress = nextLevel ? Math.min(100, ((myStreak - myLevel.days) / (nextLevel.days - myLevel.days)) * 100) : 100;

            return !streakOpen ? (
              <button
                onClick={() => setStreakOpen(true)}
                style={{
                  position: "absolute", top: 16, left: 16, zIndex: 30,
                  background: `${C.card}e8`, borderRadius: 999, padding: "8px 16px",
                  boxShadow: `0 6px 20px ${myLevel.color}40`, backdropFilter: "blur(10px)",
                  border: `2px solid ${myLevel.color}80`, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 16, fontWeight: 700, color: C.text,
                }}
                title="Show streak progress"
              >
                <span style={{ fontSize: 18 }}>🔥</span>
                <span>{myStreak} day{myStreak !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 14 }}>{myLevel.icon}</span>
              </button>
            ) : (
              <div style={{
                position: "absolute", top: 16, left: 16, zIndex: 30,
                background: `${C.card}f0`, borderRadius: 18, padding: "14px 18px",
                boxShadow: `0 8px 28px ${myLevel.color}30`, backdropFilter: "blur(10px)",
                border: `2px solid ${myLevel.color}60`, width: 260,
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>🔥 Streak Roadmap</div>
                  <button
                    onClick={() => setStreakOpen(false)}
                    style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      fontSize: 20, color: C.textLight, padding: "0 4px",
                      lineHeight: 1, fontWeight: 700,
                    }}
                    title="Hide"
                  >×</button>
                </div>

                {/* Current status */}
                <div style={{
                  background: `${myLevel.color}20`,
                  borderRadius: 14,
                  padding: "10px 12px",
                  marginBottom: 12,
                  border: `1.5px solid ${myLevel.color}50`,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 28, marginBottom: 2 }}>{myLevel.icon}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                    {myStreak} day{myStreak !== 1 ? "s" : ""} · {myLevel.name}
                  </div>
                  <div style={{ fontSize: 12, color: C.textLight }}>{myLevel.desc}</div>
                  {(me?.bestStreak || 0) > myStreak && (
                    <div style={{ fontSize: 11, color: C.textLight, marginTop: 4, opacity: 0.8 }}>
                      Best: {me.bestStreak} day{me.bestStreak !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>

                {/* Progress to next */}
                {nextLevel && (
                  <>
                    <div style={{ fontSize: 12, color: C.textLight, marginBottom: 5, textAlign: "center" }}>
                      {daysToNext} day{daysToNext !== 1 ? "s" : ""} to <strong style={{ color: nextLevel.color }}>{nextLevel.icon} {nextLevel.name}</strong>
                    </div>
                    <div style={{
                      height: 8,
                      background: `${C.fur2}30`,
                      borderRadius: 4,
                      overflow: "hidden",
                      marginBottom: 14,
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: `linear-gradient(90deg, ${myLevel.color}, ${nextLevel.color})`,
                        transition: "width 0.6s ease",
                        borderRadius: 4,
                      }} />
                    </div>
                  </>
                )}

                {/* Roadmap of all levels */}
                <div style={{
                  maxHeight: 180,
                  overflowY: "auto",
                  paddingRight: 4,
                }}>
                  <style>{`
                    .streak-scroll::-webkit-scrollbar { width: 5px; }
                    .streak-scroll::-webkit-scrollbar-track { background: transparent; }
                    .streak-scroll::-webkit-scrollbar-thumb { background: ${C.fur2}80; border-radius: 4px; }
                  `}</style>
                  <div className="streak-scroll" style={{ maxHeight: 180, overflowY: "auto" }}>
                    {STREAK_LEVELS.map((lvl, i) => {
                      const reached = myStreak >= lvl.days;
                      const isCurrent = lvl.id === myLevel.id;
                      return (
                        <div key={lvl.id} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "7px 9px",
                          borderRadius: 10,
                          background: isCurrent ? `${lvl.color}25` : reached ? `${lvl.color}10` : "transparent",
                          border: isCurrent ? `1.5px solid ${lvl.color}` : "1.5px solid transparent",
                          marginBottom: 3,
                          opacity: reached ? 1 : 0.55,
                        }}>
                          <span style={{ fontSize: 18, width: 22, textAlign: "center" }}>
                            {reached ? lvl.icon : "🔒"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: reached ? C.text : C.textLight,
                              lineHeight: 1.2,
                            }}>
                              {lvl.name}
                            </div>
                            <div style={{ fontSize: 11, color: C.textLight, lineHeight: 1.2 }}>
                              {lvl.days === 0 ? "Start" : `${lvl.days} day${lvl.days !== 1 ? "s" : ""}`}
                            </div>
                          </div>
                          {reached && !isCurrent && (
                            <span style={{ fontSize: 11, color: lvl.color, fontWeight: 700 }}>✓</span>
                          )}
                          {isCurrent && (
                            <span style={{ fontSize: 10, color: lvl.color, fontWeight: 700, background: `${lvl.color}20`, padding: "2px 6px", borderRadius: 8 }}>
                              YOU
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Leaderboard - top-right, collapsible */}
          {!leaderboardOpen ? (
            <button
              onClick={() => setLeaderboardOpen(true)}
              style={{
                position: "absolute", top: 16, right: 16, zIndex: 30,
                background: `${C.card}e8`, borderRadius: 999, padding: "10px 16px",
                boxShadow: "0 6px 20px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
                border: `2px solid ${C.gold}40`, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontFamily: "'Patrick Hand', cursive", fontSize: 16, fontWeight: 700, color: C.text,
              }}
              title="Show leaderboard"
            >
              🏆 <span>Rank #{rank}</span>
            </button>
          ) : (
            <div style={{
              position: "absolute", top: 16, right: 16, zIndex: 30,
              background: `${C.card}e8`, borderRadius: 18, padding: "12px 14px",
              boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
              border: `2px solid ${C.gold}25`, width: 220,
            }}>
              {/* Header with collapse button */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 10,
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🏆 Leaderboard</div>
                <button
                  onClick={() => setLeaderboardOpen(false)}
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    fontSize: 18, color: C.textLight, padding: "0 4px",
                    lineHeight: 1, fontWeight: 700,
                  }}
                  title="Hide leaderboard"
                >×</button>
              </div>

              {/* Top 3 - always visible */}
              <div style={{ marginBottom: sorted.length > 3 ? 8 : 0 }}>
                {sorted.slice(0, 3).map((s, i) => {
                  const isMe = s.id === me?.id;
                  const podiumBg = i === 0 ? `${C.gold}25` : i === 1 ? "#b0b0b020" : "#cd7f3220";
                  return (
                    <div key={s.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 9px", borderRadius: 10,
                      background: isMe ? `${C.gold}30` : podiumBg,
                      marginBottom: 4,
                      border: isMe ? `1.5px solid ${C.gold}80` : "1.5px solid transparent",
                    }}>
                      <span style={{
                        fontSize: 16, fontWeight: 700, width: 22, textAlign: "center", flexShrink: 0,
                      }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                      </span>
                      <span style={{
                        flex: 1, fontSize: 13, color: C.text,
                        fontWeight: 700,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {s.name}{isMe ? " ✦" : ""}
                      </span>
                      <span style={{ fontSize: 13, color: C.gold, fontWeight: 700, flexShrink: 0 }}>★{s.points}</span>
                    </div>
                  );
                })}
              </div>

              {/* Rest of the list - scrollable */}
              {sorted.length > 3 && (
                <>
                  <div style={{
                    fontSize: 11, color: C.textLight, textAlign: "center",
                    marginBottom: 4, opacity: 0.7, letterSpacing: 0.5,
                  }}>— rest of the troop —</div>
                  <div style={{
                    maxHeight: 120, overflowY: "auto",
                    paddingRight: 4,
                    scrollbarWidth: "thin",
                    scrollbarColor: `${C.fur2} transparent`,
                  }}>
                    <style>{`
                      .leaderboard-scroll::-webkit-scrollbar { width: 5px; }
                      .leaderboard-scroll::-webkit-scrollbar-track { background: transparent; }
                      .leaderboard-scroll::-webkit-scrollbar-thumb { background: ${C.fur2}80; border-radius: 4px; }
                      .leaderboard-scroll::-webkit-scrollbar-thumb:hover { background: ${C.fur3}; }
                    `}</style>
                    <div className="leaderboard-scroll" style={{ maxHeight: 120, overflowY: "auto" }}>
                      {sorted.slice(3).map((s, i) => {
                        const isMe = s.id === me?.id;
                        const rnk = i + 4;
                        return (
                          <div key={s.id} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "5px 8px", borderRadius: 8,
                            background: isMe ? `${C.gold}18` : "transparent",
                            marginBottom: 2,
                          }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, width: 26, textAlign: "center", flexShrink: 0,
                              color: C.textLight,
                            }}>#{rnk}</span>
                            <span style={{
                              flex: 1, fontSize: 13, color: C.text,
                              fontWeight: isMe ? 700 : 400,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {s.name}{isMe ? " ✦" : ""}
                            </span>
                            <span style={{ fontSize: 13, color: C.gold, fontWeight: 700, flexShrink: 0 }}>★{s.points}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}


          {/* My stats badge - bottom left */}
          <div style={{
            position: "absolute", bottom: 16, left: 16, zIndex: 30,
            background: `${C.card}e8`, borderRadius: 18, padding: "14px 20px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
            border: `2px solid ${C.gold}25`, display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ width: 50, height: 50, position: "relative" }}>
              <MonkeySVG size={50} mood={me?.points > 20 ? "excited" : me?.points > 5 ? "happy" : "neutral"} delay={0} variant={myIndex >= 0 ? myIndex : 0} accessories={me?.accessories || []} pet={me?.pet} streakLevel={getStreakLevel(getEffectiveStreak(me)).id} />
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
