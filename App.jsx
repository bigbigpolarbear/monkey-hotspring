import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import {
  getTeachers, getStudents, updateStudent, addStudentToDB, deleteStudent, addTeacherToDB,
  setQuizzesForStudent, deleteQuizzesForStudent, getQuizzes,
  setMissionsForStudent, deleteMissionsForStudent, getMissions
} from "./firebase";

/* ─── Hover context: tells penguins to pause when any monkey is hovered ─── */
const HoverContext = createContext({ anyHovering: false, setAnyHovering: () => {} });

/* ─── palette matched to original watercolor ─── */
/* ─── THEME SYSTEM ─── light + dark mode, swap by mutating the C object */
const C_LIGHT = {
  water1: "#6cc4b8", water2: "#8fd4ca", water3: "#4db0a4", water4: "#3a9e92",
  snow1: "#f2f0f5", snow2: "#e4e0eb", snow3: "#d2cdd9",
  rock1: "#8b6352", rock2: "#6b4a3a", rock3: "#a3796a", rock4: "#553928",
  face: "#f5cdd0", cheek: "#e06060", nose: "#cc3333", noseDark: "#a82828",
  fur1: "#ede6dc", fur2: "#dbd2c4", fur3: "#c9bfae", fur4: "#b8ac98",
  accent: "#e06060", accentDark: "#c04545",
  bg: "#f5f0ea", card: "#fffdf8", text: "#3e2a1a", textLight: "#7a6050",
  gold: "#edb830", green: "#5caa5e",
};

const C_DARK = {
  // Water tones - slightly more saturated and darker for night
  water1: "#3a8a82", water2: "#4d9a92", water3: "#2e6f68", water4: "#1f534e",
  // Snow becomes deeper "moonlit ground" — cool dark blues/greys
  snow1: "#2a2837", snow2: "#21202c", snow3: "#181722",
  // Rocks stay roughly the same (they're already brown)
  rock1: "#8b6352", rock2: "#6b4a3a", rock3: "#a3796a", rock4: "#553928",
  // Monkey face colors stay the same so monkeys still look cute
  face: "#f5cdd0", cheek: "#e06060", nose: "#cc3333", noseDark: "#a82828",
  fur1: "#ede6dc", fur2: "#dbd2c4", fur3: "#c9bfae", fur4: "#b8ac98",
  // Accents brighter on dark
  accent: "#ff7878", accentDark: "#e06060",
  // BG / card / text inverted
  bg: "#0f1018", card: "#1c1d28", text: "#f0e8dc", textLight: "#a09a90",
  gold: "#fac850", green: "#7ac87c",
};

const C_RAINBOW = {
  // Magical shimmery teal water
  water1: "#7ac8d8", water2: "#a8e0e8", water3: "#5ca8c0", water4: "#3a8090",
  // Soft pastel pink/lavender ground (instead of snow)
  snow1: "#fff0fa", snow2: "#ffd8eb", snow3: "#ffc4dc",
  // Rocks lean a bit warmer/purplish
  rock1: "#9a6878", rock2: "#7a4a5a", rock3: "#b88090", rock4: "#5a283a",
  // Monkey colors stay friendly
  face: "#f5cdd0", cheek: "#e06060", nose: "#cc3333", noseDark: "#a82828",
  fur1: "#ede6dc", fur2: "#dbd2c4", fur3: "#c9bfae", fur4: "#b8ac98",
  // Vibrant rainbow accents
  accent: "#ff4090", accentDark: "#d02078",
  // BG is an animated pastel rainbow gradient (CSS background string)
  bg: "linear-gradient(135deg, #ffe0e8 0%, #ffe8d0 18%, #fff5c0 36%, #d8f5d0 54%, #c8e8ff 72%, #e0d0ff 90%, #ffe0e8 100%)",
  card: "#fffafd", text: "#4a1a5a", textLight: "#9a5ab0",
  gold: "#ffae20", green: "#4ad888",
};

// Mutable C object that points at the active theme.
// Components read C.text, C.bg, etc. — when theme changes, we mutate C in place
// then trigger re-renders via React state, so every render reads the latest values.
const C = { ...C_LIGHT };
function applyTheme(mode) {
  const src = mode === "dark" ? C_DARK : mode === "rainbow" ? C_RAINBOW : C_LIGHT;
  Object.keys(C).forEach(k => delete C[k]);
  Object.assign(C, src);
}

// Persist preference
let _themeMode = "light";
try {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("monkeyTracker_theme");
    if (stored === "dark" || stored === "light" || stored === "rainbow") _themeMode = stored;
  }
} catch {}
applyTheme(_themeMode);

function getTheme() { return _themeMode; }
function setTheme(mode) {
  _themeMode = mode === "dark" ? "dark" : mode === "rainbow" ? "rainbow" : "light";
  applyTheme(_themeMode);
  try { if (typeof localStorage !== "undefined") localStorage.setItem("monkeyTracker_theme", _themeMode); } catch {}
}

/* ─── Firebase helpers ─── */
// Firebase functions are imported from ./firebase.js
// Teachers and Students are stored in Firestore, Quizzes are in collections
const DEFAULT_TEACHERS = [];

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

// Global keyframes for rainbow mode animation - lives once in the document
function GlobalKeyframes() {
  return (
    <style>{`
      @keyframes rainbowShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `}</style>
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

/* ─── FOOD CATALOG ─── creative treats students buy with stars to feed their pet
   - hunger: how much it fills the pet's hunger meter (0-100)
   - happiness: how much it boosts happiness (0-100)
   - price: cost in stars
*/
const FOOD_CATALOG = [
  // Cheap snacks (under 30★) — small refills
  { id: "yakult",      name: "Yakult",         emoji: "🍶", price: 12,  hunger: 12, happiness: 8,  flavor: "Probiotic shot of joy" },
  { id: "gummybears",  name: "Gummy Bears",    emoji: "🐻", price: 15,  hunger: 8,  happiness: 18, flavor: "Sugar power-up!" },
  { id: "crackers",    name: "Rice Crackers",  emoji: "🍘", price: 10,  hunger: 14, happiness: 4,  flavor: "Crunchy & filling" },
  { id: "milk",        name: "Strawberry Milk",emoji: "🥛", price: 18,  hunger: 14, happiness: 12, flavor: "Pink & dreamy" },
  { id: "onigiri",     name: "Onigiri",        emoji: "🍙", price: 22,  hunger: 22, happiness: 6,  flavor: "Wrapped in seaweed" },
  { id: "pocky",       name: "Pocky Sticks",   emoji: "🥢", price: 20,  hunger: 8,  happiness: 22, flavor: "Snap, chocolate, smile" },
  { id: "boba",        name: "Bubble Tea",     emoji: "🧋", price: 28,  hunger: 16, happiness: 24, flavor: "Chewy pearls of bliss" },
  // Mid (30-80★) — solid meals
  { id: "mamacup",     name: "Mama Cup Noodle",emoji: "🍜", price: 35,  hunger: 30, happiness: 18, flavor: "Slurp-tastic & warm" },
  { id: "takoyaki",    name: "Takoyaki",       emoji: "🐙", price: 45,  hunger: 32, happiness: 22, flavor: "Octopus surprise!" },
  { id: "donburi",     name: "Donburi Bowl",   emoji: "🍚", price: 55,  hunger: 42, happiness: 18, flavor: "Rice topped with love" },
  { id: "icecreambowl",name: "Sundae",         emoji: "🍨", price: 50,  hunger: 18, happiness: 38, flavor: "Three scoops of glee" },
  { id: "ramen",       name: "Tonkotsu Ramen", emoji: "🍲", price: 70,  hunger: 50, happiness: 28, flavor: "Rich, slow-cooked broth" },
  { id: "sushiroll",   name: "Sushi Roll",     emoji: "🍣", price: 75,  hunger: 38, happiness: 32, flavor: "Fresh chef's choice" },
  // Premium (80-200★) — feasts that boost both stats high
  { id: "matchaset",   name: "Matcha Set",     emoji: "🍵", price: 90,  hunger: 30, happiness: 50, flavor: "Zen & ceremonial" },
  { id: "mochi",       name: "Mochi Trio",     emoji: "🍡", price: 95,  hunger: 32, happiness: 48, flavor: "Sweet, soft, springy" },
  { id: "katsu",       name: "Katsu Curry",    emoji: "🍛", price: 110, hunger: 60, happiness: 35, flavor: "Crispy & comforting" },
  { id: "strawberry",  name: "Strawberry Tart",emoji: "🍓", price: 130, hunger: 30, happiness: 65, flavor: "Patisserie perfection" },
  { id: "wagyu",       name: "Wagyu Steak",    emoji: "🥩", price: 180, hunger: 65, happiness: 60, flavor: "Marbled & mouthwatering" },
  // Mythic feasts (200+) — fully restore both
  { id: "omakase",     name: "Omakase Dinner", emoji: "🍱", price: 250, hunger: 90, happiness: 85, flavor: "Chef's choice tasting menu" },
  { id: "rainbowcake", name: "Rainbow Cake",   emoji: "🌈", price: 300, hunger: 70, happiness: 100, flavor: "A miracle of color & sugar" },
];
function getFood(id) { return FOOD_CATALOG.find(f => f.id === id); }

/* ─── PET CARE HELPERS ─── hunger & happiness decay over time
   - Pets start at 80/80 when first equipped
   - Decay 1 hunger point per 2 hours, 1 happiness point per 3 hours
   - Care quality affects income multiplier:
     - 0-30 avg: 50% income
     - 30-60: 100% income
     - 60-90: 130% income
     - 90+: 160% income
*/
const HUNGER_DECAY_PER_HOUR = 0.5;     // -1 every 2 hours
const HAPPINESS_DECAY_PER_HOUR = 0.33; // -1 every ~3 hours

function getPetCare(student) {
  // Returns the live (decayed) hunger and happiness for the student's currently-equipped pet
  if (!student?.pet) return null;
  const data = student.petCare || {};
  const lastFed = data.lastFedAt || data.lastUpdated || data.equippedAt || Date.now();
  const lastUpdated = data.lastUpdated || lastFed;
  const baseHunger = data.hunger ?? 80;
  const baseHappiness = data.happiness ?? 80;
  const hoursSince = (Date.now() - lastUpdated) / (1000 * 60 * 60);
  const hunger = Math.max(0, baseHunger - hoursSince * HUNGER_DECAY_PER_HOUR);
  const happiness = Math.max(0, baseHappiness - hoursSince * HAPPINESS_DECAY_PER_HOUR);
  return {
    hunger: Math.round(hunger),
    happiness: Math.round(happiness),
    avgCare: Math.round((hunger + happiness) / 2),
  };
}

function getCareLabel(avgCare) {
  if (avgCare >= 90) return { label: "Thriving!", color: "#5caa5e", emoji: "🌟" };
  if (avgCare >= 60) return { label: "Happy",    color: "#7ac87c", emoji: "😊" };
  if (avgCare >= 30) return { label: "Okay",     color: "#edb830", emoji: "😐" };
  if (avgCare >= 10) return { label: "Hungry",   color: "#e08030", emoji: "😟" };
  return                     { label: "Sad",     color: "#c94c4c", emoji: "😢" };
}

function getCareIncomeMultiplier(avgCare) {
  if (avgCare >= 90) return 1.6;
  if (avgCare >= 60) return 1.3;
  if (avgCare >= 30) return 1.0;
  return 0.5;
}

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
    price: 50,
    color: "#8eb6cf",
    odds: { common: 80, uncommon: 20, rare: 0, epic: 0, legendary: 0, mythic: 0 },
  },
  {
    id: "jelly",
    name: "Jelly Drop Pack",
    flavor: "🍮",
    description: "Squishy and sweet — chance for an uncommon or rare pet!",
    price: 125,
    color: "#c980c0",
    odds: { common: 50, uncommon: 35, rare: 14, epic: 1, legendary: 0, mythic: 0 },
  },
  {
    id: "frost",
    name: "Frost Glimmer Pack",
    flavor: "❄️",
    description: "Icy mystery — solid chance for a rare companion. Could be epic!",
    price: 300,
    color: "#7adcdc",
    odds: { common: 25, uncommon: 35, rare: 30, epic: 8, legendary: 2, mythic: 0 },
  },
  {
    id: "sparkle",
    name: "Sparkle Surge Pack",
    flavor: "✨",
    description: "Glittering with magic. Big shot at epic and even legendary pets!",
    price: 600,
    color: "#edb830",
    odds: { common: 10, uncommon: 25, rare: 30, epic: 25, legendary: 9, mythic: 1 },
  },
  {
    id: "mythic",
    name: "Cosmic Mythstone Pack",
    flavor: "🌌",
    description: "Forged from stars themselves. Best odds for legendary AND mythic!",
    price: 1200,
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

// Weekly income calculator: 1 payout per 7 days, no compounding.
// Income is multiplied by care quality (50%-160% based on hunger+happiness).
function calculatePendingIncome(student, now = Date.now()) {
  if (!student?.pet) return 0;
  const pet = getPet(student.pet);
  if (!pet) return 0;
  const lastCollected = student.lastIncomeCollected || student.petAcquiredAt || now;
  const daysSince = (now - lastCollected) / (1000 * 60 * 60 * 24);
  if (daysSince < 7) return 0;
  const care = getPetCare(student);
  const multiplier = care ? getCareIncomeMultiplier(care.avgCare) : 1.0;
  return Math.round(pet.weeklyIncome * multiplier);
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

  // ─── 50 MORE ACCESSORIES ─── mix of free + paid, all slots
  // Free hats (head)
  { id: "partyhat",    name: "Party Hat",       emoji: "🥳", slot: "head", price: 0,    rarity: "common" },
  { id: "graduationcap", name: "Grad Cap",      emoji: "🎓", slot: "head", price: 0,    rarity: "common" },
  { id: "leaf",        name: "Leaf Crown",      emoji: "🍃", slot: "head", price: 0,    rarity: "common" },
  { id: "rainbow",     name: "Rainbow Headband",emoji: "🌈", slot: "head", price: 0,    rarity: "common" },
  // Paid hats (head)
  { id: "cowboyhat",   name: "Cowboy Hat",      emoji: "🤠", slot: "head", price: 300,  rarity: "uncommon" },
  { id: "tophat",      name: "Wizard Hat",      emoji: "🧙", slot: "head", price: 450,  rarity: "uncommon" },
  { id: "vikinghelm",  name: "Viking Helmet",   emoji: "⛑️", slot: "head", price: 550,  rarity: "rare" },
  { id: "policehat",   name: "Police Cap",      emoji: "👮", slot: "head", price: 350,  rarity: "uncommon" },
  { id: "chefhat",     name: "Chef's Hat",      emoji: "👨‍🍳", slot: "head", price: 350, rarity: "uncommon" },
  { id: "santahat",    name: "Santa Hat",       emoji: "🎅", slot: "head", price: 400,  rarity: "uncommon" },
  { id: "witchhat",    name: "Witch Hat",       emoji: "🧹", slot: "head", price: 600,  rarity: "rare" },
  { id: "antlers",     name: "Reindeer Antlers",emoji: "🦌", slot: "head", price: 750,  rarity: "rare" },
  { id: "starcrown",   name: "Star Crown",      emoji: "⭐", slot: "head", price: 1100, rarity: "epic" },
  { id: "fireheadband",name: "Fire Headband",   emoji: "🔥", slot: "head", price: 900,  rarity: "rare" },
  { id: "alien",       name: "Alien Antennae",  emoji: "👽", slot: "head", price: 1300, rarity: "epic" },

  // Free face items
  { id: "smile",       name: "Big Smile",       emoji: "😄", slot: "face", price: 0,    rarity: "common" },
  // Paid face
  { id: "monocle",     name: "Monocle",         emoji: "🧐", slot: "face", price: 300,  rarity: "uncommon" },
  { id: "mustache",    name: "Mustache",        emoji: "👨", slot: "face", price: 250,  rarity: "uncommon" },
  { id: "eyepatch",    name: "Eye Patch",       emoji: "🏴‍☠️", slot: "face", price: 400,  rarity: "uncommon" },
  { id: "facepaint",   name: "Face Paint",      emoji: "🎨", slot: "face", price: 250,  rarity: "uncommon" },
  { id: "ninjamask",   name: "Ninja Mask",      emoji: "🥷", slot: "face", price: 500,  rarity: "rare" },
  { id: "starshades",  name: "Star Shades",     emoji: "🌟", slot: "face", price: 600,  rarity: "rare" },
  { id: "diamondeyes", name: "Diamond Eyes",    emoji: "💎", slot: "face", price: 1500, rarity: "epic" },

  // Free neck items
  { id: "leafnecklace",name: "Leaf Necklace",   emoji: "🌿", slot: "neck", price: 0,    rarity: "common" },
  // Paid neck
  { id: "tie",         name: "Necktie",         emoji: "👔", slot: "neck", price: 200,  rarity: "common" },
  { id: "pearls",      name: "Pearl Necklace",  emoji: "📿", slot: "neck", price: 600,  rarity: "rare" },
  { id: "medal",       name: "Gold Medal",      emoji: "🏅", slot: "neck", price: 800,  rarity: "rare" },
  { id: "diamond",     name: "Diamond Pendant", emoji: "💍", slot: "neck", price: 1400, rarity: "epic" },
  { id: "amulet",      name: "Magic Amulet",    emoji: "🔮", slot: "neck", price: 1700, rarity: "epic" },

  // Free held items
  { id: "book",        name: "Book",            emoji: "📖", slot: "hold", price: 0,    rarity: "common" },
  { id: "pencil",      name: "Pencil",          emoji: "✏️", slot: "hold", price: 0,    rarity: "common" },
  { id: "leafhold",    name: "Maple Leaf",      emoji: "🍁", slot: "hold", price: 0,    rarity: "common" },
  // Paid held items
  { id: "balloon",     name: "Balloon",         emoji: "🎈", slot: "hold", price: 200,  rarity: "common" },
  { id: "trophy",      name: "Trophy",          emoji: "🏆", slot: "hold", price: 800,  rarity: "rare" },
  { id: "lollipop",    name: "Giant Lollipop",  emoji: "🍭", slot: "hold", price: 250,  rarity: "common" },
  { id: "cupcake",     name: "Cupcake",         emoji: "🧁", slot: "hold", price: 220,  rarity: "common" },
  { id: "donut",       name: "Donut",           emoji: "🍩", slot: "hold", price: 220,  rarity: "common" },
  { id: "fishingrod",  name: "Fishing Rod",     emoji: "🎣", slot: "hold", price: 500,  rarity: "uncommon" },
  { id: "paintbrush",  name: "Paint Brush",     emoji: "🖌️", slot: "hold", price: 350,  rarity: "uncommon" },
  { id: "flute",       name: "Flute",           emoji: "🎶", slot: "hold", price: 550,  rarity: "rare" },
  { id: "violin",      name: "Violin",          emoji: "🎻", slot: "hold", price: 750,  rarity: "rare" },
  { id: "telescope",   name: "Telescope",       emoji: "🔭", slot: "hold", price: 700,  rarity: "rare" },
  { id: "potion",      name: "Magic Potion",    emoji: "🧪", slot: "hold", price: 900,  rarity: "rare" },
  { id: "sword",       name: "Sword",           emoji: "🗡️", slot: "hold", price: 1100, rarity: "epic" },
  { id: "shield",      name: "Hero's Shield",   emoji: "🛡️", slot: "hold", price: 1100, rarity: "epic" },
  { id: "phone",       name: "Smartphone",      emoji: "📱", slot: "hold", price: 850,  rarity: "rare" },
  { id: "camera",      name: "Camera",          emoji: "📷", slot: "hold", price: 650,  rarity: "rare" },

  // Free back
  { id: "leafback",    name: "Leaf Pack",       emoji: "🌱", slot: "back", price: 0,    rarity: "common" },
  // Paid back
  { id: "jetpack",     name: "Jet Pack",        emoji: "🚀", slot: "back", price: 1600, rarity: "epic" },
  { id: "angelwings",  name: "Angel Wings",     emoji: "🕊️", slot: "back", price: 2500, rarity: "legendary" },
  { id: "demonwings",  name: "Demon Wings",     emoji: "🦇", slot: "back", price: 2500, rarity: "legendary" },
  { id: "rainbowcape", name: "Rainbow Cape",    emoji: "🌈", slot: "back", price: 2200, rarity: "legendary" },
  { id: "dragoncape",  name: "Dragon Wings",    emoji: "🐉", slot: "back", price: 3500, rarity: "mythic" },
  { id: "bowarrow",    name: "Bow & Arrow",     emoji: "🏹", slot: "back", price: 1200, rarity: "epic" },
];

const ACCESSORY_SLOTS = ["head", "face", "neck", "hold", "back"];
function getAccessory(id) { return ACCESSORY_CATALOG.find(a => a.id === id); }
function isFreeAccessory(id) { const a = getAccessory(id); return a && a.price === 0; }
function getAccessoryBySlot(equippedIds, slot) {
  return equippedIds.map(getAccessory).find(a => a && a.slot === slot);
}

/* ─── PET ACCESSORY CATALOG ─── small cute items that fit any pet
   Slots:
   - "head"  → on top of pet's head
   - "neck"  → around neck/throat
   - "back"  → trailing/floating behind
*/
const PET_ACCESSORY_CATALOG = [
  // ─── FREE BASICS ───
  { id: "petbow",        name: "Pink Bow",         emoji: "🎀", slot: "head", price: 0,    rarity: "common"    },
  { id: "petflower",     name: "Tiny Flower",      emoji: "🌸", slot: "head", price: 0,    rarity: "common"    },
  { id: "petcollar",     name: "Soft Collar",      emoji: "📿", slot: "neck", price: 0,    rarity: "common"    },
  { id: "petbandana",    name: "Bandana",          emoji: "🧣", slot: "neck", price: 0,    rarity: "common"    },

  // ─── HEAD ITEMS ───
  { id: "petbeanie",     name: "Mini Beanie",      emoji: "🧢", slot: "head", price: 80,   rarity: "common"    },
  { id: "petparty",      name: "Party Hat",        emoji: "🎉", slot: "head", price: 120,  rarity: "uncommon"  },
  { id: "petsanta",      name: "Santa Hat",        emoji: "🎅", slot: "head", price: 200,  rarity: "uncommon"  },
  { id: "petwizardhat",  name: "Wizard Hat",       emoji: "🧙", slot: "head", price: 350,  rarity: "rare"      },
  { id: "petcrown",      name: "Tiny Crown",       emoji: "👑", slot: "head", price: 500,  rarity: "rare"      },
  { id: "petantenna",    name: "Bug Antennae",     emoji: "🐛", slot: "head", price: 150,  rarity: "uncommon"  },
  { id: "pethalo",       name: "Glowing Halo",     emoji: "😇", slot: "head", price: 800,  rarity: "epic"      },
  { id: "petleaf",       name: "Leaf Crown",       emoji: "🍃", slot: "head", price: 100,  rarity: "common"    },
  { id: "petheart",      name: "Heart Sticker",    emoji: "💗", slot: "head", price: 90,   rarity: "common"    },

  // ─── NECK ITEMS ───
  { id: "petbowtie",     name: "Polka Bowtie",     emoji: "🎀", slot: "neck", price: 100,  rarity: "common"    },
  { id: "petbell",       name: "Jingle Bell",      emoji: "🔔", slot: "neck", price: 130,  rarity: "uncommon"  },
  { id: "petpearls",     name: "Pearl Necklace",   emoji: "🦪", slot: "neck", price: 280,  rarity: "rare"      },
  { id: "petmedal",      name: "Gold Medal",       emoji: "🥇", slot: "neck", price: 220,  rarity: "uncommon"  },
  { id: "petgem",        name: "Star Pendant",     emoji: "⭐", slot: "neck", price: 400,  rarity: "rare"      },

  // ─── BACK ITEMS ───
  { id: "petwings",      name: "Fairy Wings",      emoji: "🧚", slot: "back", price: 600,  rarity: "epic"      },
  { id: "petbutterfly",  name: "Butterfly Wings",  emoji: "🦋", slot: "back", price: 450,  rarity: "rare"      },
  { id: "petcape",       name: "Hero Cape",        emoji: "🦸", slot: "back", price: 350,  rarity: "rare"      },
  { id: "petsparkle",    name: "Sparkle Trail",    emoji: "✨", slot: "back", price: 250,  rarity: "uncommon"  },
  { id: "petrainbow",    name: "Rainbow Aura",     emoji: "🌈", slot: "back", price: 1000, rarity: "legendary" },
];

const PET_ACCESSORY_SLOTS = ["head", "neck", "back"];
function getPetAccessory(id) { return PET_ACCESSORY_CATALOG.find(a => a.id === id); }
function isFreePetAccessory(id) { const a = getPetAccessory(id); return a && a.price === 0; }
function getPetAccessoryBySlot(equippedIds, slot) {
  return equippedIds.map(getPetAccessory).find(a => a && a.slot === slot);
}

/* ─── STREAK LEVELS ─── each level gives the monkey visual upgrades */
const STREAK_LEVELS = [
  { days: 0,   id: "sprout",    name: "Sprout",    icon: "🌱", color: "#7cc080", glow: "#a8e8b8", desc: "Just getting started!" },
  { days: 3,   id: "bronze",    name: "Bronze",    icon: "🥉", color: "#ff9050", glow: "#ffc890", desc: "Three days strong!" },
  { days: 7,   id: "silver",    name: "Silver",    icon: "🥈", color: "#b8d4e8", glow: "#e0eef8", desc: "A whole week!" },
  { days: 14,  id: "gold",      name: "Gold",      icon: "🥇", color: "#ffc430", glow: "#fff080", desc: "Two weeks of glory!" },
  { days: 30,  id: "crystal",   name: "Crystal",   icon: "💎", color: "#5ac8e8", glow: "#a0e8f0", desc: "A full month!" },
  { days: 60,  id: "rainbow",   name: "Rainbow",   icon: "🌈", color: "#ff80c0", glow: "#ffb0d8", desc: "Two months — incredible!" },
  { days: 100, id: "legendary", name: "Legendary", icon: "⭐", color: "#ff6020", glow: "#ffd080", desc: "100 days! A legend!" },
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

/* ─── COMPLETIONS / MESSAGE GENERATION ───
   student.completions = {
     "quiz:abc": { type, name, attempts, lastScore, total, bestScore, lastAttempt, totalEarned, completed }
     "mission:xyz": { type, name, attempts, lastAttempt, totalEarned, completed, missionType }
   }
*/

// Build a friendly reminder message for a student about pending or improvable tasks.
function getStudentReminder(student, quizzes, missions) {
  if (!student) return null;
  const completions = student.completions || {};
  const myQuizzes = quizzes[student.id] || [];
  const myMissions = missions[student.id] || [];
  const reminders = [];

  myQuizzes.forEach(q => {
    const c = completions[`quiz:${q.id}`];
    if (!c) {
      reminders.push(`📚 Try the ${q.name} quiz!`);
    } else if ((c.bestScore ?? 0) < (c.total ?? q.questions.length)) {
      reminders.push(`📚 You can ace ${q.name}! Try again`);
    }
  });

  myMissions.forEach(m => {
    const c = completions[`mission:${m.id}`];
    if (!c || !c.completed) {
      const emoji = m.type === "any" ? "🚀" : (m.type === "runner" ? "🏃" : m.type === "flappy" ? "❄️" : "🧩");
      reminders.push(`${emoji} ${m.name} mission awaits!`);
    }
  });

  if (reminders.length === 0) {
    // All caught up - friendly encouragement
    const friendly = [
      `Great work, ${student.name}! ✨`,
      `You're crushing it! 🌟`,
      `All caught up — keep it up! 🎉`,
      `Streak strong! 🔥`,
    ];
    return friendly[Math.floor(Math.random() * friendly.length)];
  }

  return reminders[Math.floor(Math.random() * reminders.length)];
}

// Build a teacher update from recent student activity.
function getTeacherUpdate(students) {
  const items = [];
  students.forEach(s => {
    const completions = s.completions || {};
    Object.values(completions).forEach(c => {
      if (c.lastAttempt) items.push({ ...c, studentName: s.name });
    });
  });

  if (items.length === 0) return null;

  // Sort by recency, pick from top 8 to keep variety
  items.sort((a, b) => (b.lastAttempt || 0) - (a.lastAttempt || 0));
  const pool = items.slice(0, 8);
  const c = pool[Math.floor(Math.random() * pool.length)];

  if (c.type === "quiz") {
    return `${c.studentName}: ${c.name} — ${c.lastScore ?? 0}/${c.total ?? "?"} (${c.attempts} attempt${c.attempts !== 1 ? "s" : ""}) 📚`;
  } else {
    const verb = c.completed ? "completed" : "tried";
    const emoji = c.missionType === "runner" ? "🏃" : c.missionType === "flappy" ? "❄️" : "🧩";
    return `${emoji} ${c.studentName} ${verb} ${c.name} (${c.attempts} attempt${c.attempts !== 1 ? "s" : ""})`;
  }
}

/* ─── EXAM COUNTDOWN HELPERS ─── */
// Compute time remaining until an exam date.
// Returns { passed, days, hours, minutes, seconds, totalMs }
function getCountdown(targetTime, now = Date.now()) {
  const diff = targetTime - now;
  if (diff <= 0) {
    return { passed: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  }
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { passed: false, days, hours, minutes, seconds, totalMs: diff };
}

// Sort exams by ascending date, returns the nearest one first.
function sortExams(exams) {
  return [...(exams || [])].sort((a, b) => a.dateMs - b.dateMs);
}

// Get the currently-relevant exam (nearest in future, or one happening today)
function getActiveExams(exams, now = Date.now()) {
  const sorted = sortExams(exams);
  // Keep ones that haven't fully passed (still within 6h after start = "today!")
  return sorted.filter(e => e.dateMs + 6 * 3600 * 1000 >= now);
}

/* ─── QUOTE HELPERS ─── built-in fallback quotes used when no user/teacher quote is set */
const DEFAULT_QUOTES = [
  "🌱 Small steps every day add up.",
  "✨ You're capable of more than you think.",
  "💪 Effort over perfection.",
  "🌟 Be the kind of student you'd be proud of.",
  "📚 Learning is its own reward.",
  "🌈 Mistakes are how we grow.",
  "🦋 Slow progress is still progress.",
  "🎯 Focus on what's in your control.",
  "🌞 Today's struggle is tomorrow's strength.",
  "🍀 Trust the process.",
];

// Get a quote pool for a student: combines teacher-set + student's own + defaults
function getQuotePool(student) {
  const tq = student?.teacherQuotes || [];
  const pq = student?.personalQuotes || [];
  if (tq.length === 0 && pq.length === 0) return DEFAULT_QUOTES;
  return [...tq, ...pq];
}


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
function PetSVG({ petId, side = "right", centered = false, mood = "neutral", petAccessories = [] }) {
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

  const cx = centered ? 0 : (side === "right" ? 60 : -60);
  const cy = centered ? 0 : 5;
  const groupTransform = `translate(${cx}, ${cy + bob}) ${(!centered && side === "left") ? "scale(-1,1)" : ""}`;

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
  return <>{renderPet()}{petAccessories.length > 0 && (
    <g transform={groupTransform}>
      <PetAccessoryLayer petId={petId} accessories={petAccessories} />
    </g>
  )}</>;
}

/* ─── PET ACCESSORY ANCHOR POINTS ─── per-pet positions for each slot
   These are coordinates inside the pet's local <g transform={groupTransform}> space.
   Each pet's body is roughly centered at (0, 0) with bobbing motion handled by the parent transform. */
const PET_ANCHORS = {
  // [slot]: { x, y, scale } — scale lets us shrink accessories on smaller pets
  fish:   { head: { x: -4, y: -11, scale: 0.85 }, neck: { x: -2, y: 4,  scale: 0.85 }, back: { x: 8,  y: 0,  scale: 0.9 } },
  duck:   { head: { x: -3, y: -14, scale: 1.0  }, neck: { x: -3, y: 1,  scale: 0.9  }, back: { x: 8,  y: 0,  scale: 1.0 } },
  turtle: { head: { x: -13,y: -7,  scale: 0.7  }, neck: { x: -10,y: 2,  scale: 0.75 }, back: { x: 4,  y: -4, scale: 1.1 } },
  bunny:  { head: { x: 0,  y: -16, scale: 0.95 }, neck: { x: 0,  y: 0,  scale: 0.95 }, back: { x: 10, y: 2,  scale: 1.0 } },
  fox:    { head: { x: 0,  y: -16, scale: 1.0  }, neck: { x: 0,  y: 0,  scale: 0.95 }, back: { x: -2, y: 4,  scale: 1.0 } },
  otter:  { head: { x: 0,  y: -15, scale: 1.0  }, neck: { x: 0,  y: 0,  scale: 0.95 }, back: { x: 2,  y: 4,  scale: 1.0 } },
  owl:    { head: { x: 0,  y: -19, scale: 1.05 }, neck: { x: 0,  y: 0,  scale: 1.0  }, back: { x: 4,  y: 2,  scale: 1.0 } },
  panda:  { head: { x: 0,  y: -16, scale: 1.05 }, neck: { x: 0,  y: 0,  scale: 1.0  }, back: { x: 6,  y: 4,  scale: 1.05 } },
  dragon: { head: { x: 14, y: -10, scale: 0.8  }, neck: { x: 8,  y: 2,  scale: 0.85 }, back: { x: -8, y: -2, scale: 1.0 } },
};

/* ─── PET ACCESSORY LAYER ─── renders watercolor SVG accessories on the pet
   Each accessory has its own render function at given (x, y, scale). */
function PetAccessoryLayer({ petId, accessories }) {
  const anchors = PET_ANCHORS[petId];
  if (!anchors) return null;
  // Group by slot — only render the LAST equipped item per slot
  const equipped = { head: null, neck: null, back: null };
  for (const id of accessories) {
    const a = getPetAccessory(id);
    if (a && equipped[a.slot] !== undefined) equipped[a.slot] = a.id;
  }
  return (
    <>
      {/* Render in z-order: back (behind), then neck, then head */}
      {equipped.back && renderPetAccessory(equipped.back, anchors.back)}
      {equipped.neck && renderPetAccessory(equipped.neck, anchors.neck)}
      {equipped.head && renderPetAccessory(equipped.head, anchors.head)}
    </>
  );
}

function renderPetAccessory(id, anchor) {
  const { x, y, scale } = anchor;
  const t = `translate(${x}, ${y}) scale(${scale})`;
  switch (id) {
    // ─── HEAD ITEMS ───
    case "petbow":
      return (
        <g key={id} transform={t}>
          <path d="M -5 -1 Q -7 -4 -3 -3 Q -1 -2 0 0 Q -1 2 -3 3 Q -7 4 -5 1 Z" fill="#ff7090" />
          <path d="M 5 -1 Q 7 -4 3 -3 Q 1 -2 0 0 Q 1 2 3 3 Q 7 4 5 1 Z" fill="#ff7090" />
          <ellipse cx="0" cy="0" rx="1.6" ry="2.2" fill="#d04060" />
          <path d="M -4 -2 Q -3 -1 -2 -1 M 3 -2 Q 2 -1 1 -1" stroke="#ff90b0" strokeWidth="0.3" fill="none" />
        </g>
      );
    case "petflower":
      return (
        <g key={id} transform={t}>
          {[0, 72, 144, 216, 288].map((deg, i) => (
            <ellipse key={i} cx="0" cy="-3" rx="2" ry="3" fill="#ffb0d0" transform={`rotate(${deg})`} />
          ))}
          <circle cx="0" cy="0" r="1.6" fill="#fff080" />
          <circle cx="-0.5" cy="-0.5" r="0.6" fill="#ffd060" />
        </g>
      );
    case "petbeanie":
      return (
        <g key={id} transform={t}>
          <path d="M -7 1 Q -7 -7 0 -7 Q 7 -7 7 1 Z" fill="#5a8fc7" filter="url(#furTexture)" />
          <path d="M -7 1 L 7 1 L 7 3 L -7 3 Z" fill="#3a6fa7" />
          <circle cx="0" cy="-7" r="1.8" fill="#ff8030" />
        </g>
      );
    case "petparty":
      return (
        <g key={id} transform={t}>
          <path d="M -4 1 L 0 -10 L 4 1 Z" fill="#ff5080" />
          <path d="M -4 1 L 0 -10 L 4 1 Z" fill="url(#partyStripes)" opacity="0.4" />
          <circle cx="0" cy="-10" r="1.5" fill="#fff080" />
          <defs>
            <pattern id="partyStripes" width="3" height="3" patternUnits="userSpaceOnUse">
              <path d="M 0 0 L 3 3" stroke="#fff" strokeWidth="0.5" />
            </pattern>
          </defs>
        </g>
      );
    case "petsanta":
      return (
        <g key={id} transform={t}>
          <path d="M -6 1 Q -5 -8 4 -8 Q 6 -3 7 1 Z" fill="#cc3030" filter="url(#watercolorSoft)" />
          <ellipse cx="-6" cy="1" rx="7" ry="1.5" fill="white" />
          <circle cx="5" cy="-8" r="1.8" fill="white" />
        </g>
      );
    case "petwizardhat":
      return (
        <g key={id} transform={t}>
          <path d="M -5 1 L 1 -12 L 6 1 Z" fill="#5a3aa0" filter="url(#watercolorSoft)" />
          <path d="M -6 1 L 7 1 L 7 2 L -6 2 Z" fill="#3a2a70" />
          <text x="0" y="-3" fontSize="3" fill="#fff080" textAnchor="middle">★</text>
        </g>
      );
    case "petcrown":
      return (
        <g key={id} transform={t}>
          <path d="M -6 1 L -6 -3 L -3 -6 L 0 -2 L 3 -6 L 6 -3 L 6 1 Z" fill="#edb830" stroke="#a07810" strokeWidth="0.3" />
          <circle cx="-3" cy="-5" r="0.8" fill="#ff5080" />
          <circle cx="0" cy="-3" r="0.8" fill="#5a8fc7" />
          <circle cx="3" cy="-5" r="0.8" fill="#5caa5e" />
        </g>
      );
    case "petantenna":
      return (
        <g key={id} transform={t}>
          <path d="M -3 1 Q -4 -5 -2 -8" stroke="#3a2a40" strokeWidth="0.6" fill="none" />
          <path d="M 3 1 Q 4 -5 2 -8" stroke="#3a2a40" strokeWidth="0.6" fill="none" />
          <circle cx="-2" cy="-8" r="1.4" fill="#a060c0" />
          <circle cx="2" cy="-8" r="1.4" fill="#a060c0" />
          <circle cx="-2.4" cy="-8.4" r="0.5" fill="#fff" opacity="0.8" />
          <circle cx="1.6" cy="-8.4" r="0.5" fill="#fff" opacity="0.8" />
        </g>
      );
    case "pethalo":
      return (
        <g key={id} transform={t}>
          <ellipse cx="0" cy="-4" rx="6" ry="1.6" fill="none" stroke="#fff080" strokeWidth="1.2" />
          <ellipse cx="0" cy="-4" rx="6" ry="1.6" fill="none" stroke="#ffe040" strokeWidth="0.5" opacity="0.7" />
          <circle cx="0" cy="-4" r="0.7" fill="#fff080" opacity="0.6">
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>
      );
    case "petleaf":
      return (
        <g key={id} transform={t}>
          <path d="M -5 0 Q -4 -5 0 -4 Q -3 -2 -5 0 Z" fill="#5caa5e" />
          <path d="M 5 0 Q 4 -5 0 -4 Q 3 -2 5 0 Z" fill="#5caa5e" />
          <path d="M 0 -5 Q 1 -8 -1 -8 Q -1 -6 0 -5 Z" fill="#7cc080" />
          <path d="M 0 -4 L 0 -1" stroke="#3a7a3c" strokeWidth="0.3" />
        </g>
      );
    case "petheart":
      return (
        <g key={id} transform={t}>
          <path d="M 0 1 Q -3 -2 -3 -4 Q -3 -6 -1 -6 Q 0 -5 0 -4 Q 0 -5 1 -6 Q 3 -6 3 -4 Q 3 -2 0 1 Z" fill="#ff5080" />
          <path d="M -2 -5 Q -1 -5 -1 -4" stroke="#fff" strokeWidth="0.4" fill="none" opacity="0.7" />
        </g>
      );

    // ─── NECK ITEMS ───
    case "petcollar":
      return (
        <g key={id} transform={t}>
          <ellipse cx="0" cy="0" rx="6" ry="2" fill="#a060c0" />
          <ellipse cx="0" cy="0" rx="6" ry="0.8" fill="#7a40a0" />
          <circle cx="0" cy="1.5" r="1.2" fill="#edb830" />
          <circle cx="-0.3" cy="1.2" r="0.4" fill="#fff080" />
        </g>
      );
    case "petbandana":
      return (
        <g key={id} transform={t}>
          <path d="M -7 -1 L 7 -1 L 5 4 L -5 4 Z" fill="#cc3030" />
          <path d="M -7 -1 L 7 -1 L 7 0.5 L -7 0.5 Z" fill="#fff" opacity="0.5" />
          <circle cx="-4" cy="2" r="0.5" fill="#fff" />
          <circle cx="0" cy="3" r="0.5" fill="#fff" />
          <circle cx="4" cy="2" r="0.5" fill="#fff" />
        </g>
      );
    case "petbowtie":
      return (
        <g key={id} transform={t}>
          <path d="M -5 -1 Q -7 -3 -7 0 Q -7 3 -5 1 Q -3 0 -1 0 Z" fill="#5a8fc7" />
          <path d="M 5 -1 Q 7 -3 7 0 Q 7 3 5 1 Q 3 0 1 0 Z" fill="#5a8fc7" />
          <rect x="-1.5" y="-1.5" width="3" height="3" fill="#3a6fa7" rx="0.4" />
          <circle cx="-3" cy="0" r="0.4" fill="#fff" opacity="0.8" />
          <circle cx="3" cy="0" r="0.4" fill="#fff" opacity="0.8" />
        </g>
      );
    case "petbell":
      return (
        <g key={id} transform={t}>
          <ellipse cx="0" cy="0" rx="6" ry="1.5" fill="#5a4a2a" />
          <path d="M -2 1 Q -2 4 -1 5 L 1 5 Q 2 4 2 1 Z" fill="#edb830" />
          <ellipse cx="0" cy="1" rx="2" ry="0.5" fill="#a07810" />
          <circle cx="0" cy="5.3" r="0.6" fill="#a07810" />
        </g>
      );
    case "petpearls":
      return (
        <g key={id} transform={t}>
          {[-5, -3, -1, 1, 3, 5].map((x, i) => (
            <circle key={i} cx={x} cy={i % 2 ? 0.5 : -0.5} r="1" fill="#fff5e8" stroke="#d8c8a8" strokeWidth="0.2" />
          ))}
          {[-5, -3, -1, 1, 3, 5].map((x, i) => (
            <circle key={`g${i}`} cx={x - 0.3} cy={(i % 2 ? 0.5 : -0.5) - 0.3} r="0.3" fill="#fff" opacity="0.8" />
          ))}
        </g>
      );
    case "petmedal":
      return (
        <g key={id} transform={t}>
          <path d="M -2 -1 L -1 4 M 2 -1 L 1 4" stroke="#cc3030" strokeWidth="1.2" />
          <circle cx="0" cy="5" r="3" fill="#edb830" />
          <circle cx="0" cy="5" r="2" fill="#fff080" />
          <text x="0" y="6.5" fontSize="3" fill="#a07810" textAnchor="middle" fontWeight="bold">1</text>
        </g>
      );
    case "petgem":
      return (
        <g key={id} transform={t}>
          <path d="M -4 0 L 4 0" stroke="#a060c0" strokeWidth="0.5" />
          <path d="M 0 0 L 0 3 L -2 5 L 0 7 L 2 5 L 0 3 Z" fill="#a060c0" />
          <path d="M 0 3 L -2 5 L 0 5 Z" fill="#c080e0" />
          <circle cx="-0.5" cy="4.5" r="0.4" fill="#fff" opacity="0.8" />
        </g>
      );

    // ─── BACK ITEMS ───
    case "petwings":
      return (
        <g key={id} transform={t}>
          <path d="M 0 0 Q -8 -8 -12 -2 Q -10 4 -2 2 Z" fill="#ffe0f0" stroke="#ff90c0" strokeWidth="0.4" filter="url(#watercolorSoft)" />
          <path d="M 0 0 Q 8 -8 12 -2 Q 10 4 2 2 Z" fill="#ffe0f0" stroke="#ff90c0" strokeWidth="0.4" filter="url(#watercolorSoft)" />
          <path d="M -2 0 Q -8 -4 -10 0" stroke="#ffb0d0" strokeWidth="0.3" fill="none" />
          <path d="M 2 0 Q 8 -4 10 0" stroke="#ffb0d0" strokeWidth="0.3" fill="none" />
          <circle cx="-9" cy="-2" r="0.5" fill="#fff" opacity="0.9" />
          <circle cx="9" cy="-2" r="0.5" fill="#fff" opacity="0.9" />
        </g>
      );
    case "petbutterfly":
      return (
        <g key={id} transform={t}>
          <path d="M 0 0 Q -7 -5 -10 0 Q -7 4 0 2 Z" fill="#a060c0" />
          <path d="M 0 0 Q 7 -5 10 0 Q 7 4 0 2 Z" fill="#a060c0" />
          <circle cx="-7" cy="-1" r="1.2" fill="#fff080" />
          <circle cx="7" cy="-1" r="1.2" fill="#fff080" />
          <path d="M 0 -1 L 0 3" stroke="#3a2040" strokeWidth="0.8" />
        </g>
      );
    case "petcape":
      return (
        <g key={id} transform={t}>
          <path d="M -8 -2 L 8 -2 L 10 8 L 0 12 L -10 8 Z" fill="#cc3030" filter="url(#watercolorSoft)" />
          <path d="M -8 -2 L 8 -2" stroke="#edb830" strokeWidth="0.6" />
          <path d="M -6 0 L -8 8 M 0 1 L 0 11 M 6 0 L 8 8" stroke="#a02020" strokeWidth="0.4" fill="none" />
        </g>
      );
    case "petsparkle":
      return (
        <g key={id} transform={t}>
          {[
            { x: -8, y: -3, s: 1.4 },
            { x: -10, y: 2, s: 1.0 },
            { x: -6, y: 5, s: 0.8 },
            { x: -12, y: -1, s: 0.6 },
            { x: -4, y: -2, s: 0.7 },
          ].map((p, i) => (
            <text key={i} x={p.x} y={p.y} fontSize={6 * p.s} fill="#fff080" opacity="0.9">
              ✦
              <animate attributeName="opacity" values="0.4;1;0.4" dur={`${1.5 + i * 0.3}s`} repeatCount="indefinite" />
            </text>
          ))}
        </g>
      );
    case "petrainbow":
      return (
        <g key={id} transform={t}>
          {[
            { c: "#ff6080", r: 14 },
            { c: "#ffa030", r: 12 },
            { c: "#fff080", r: 10 },
            { c: "#5caa5e", r: 8 },
            { c: "#5a8fc7", r: 6 },
            { c: "#a060c0", r: 4 },
          ].map((arc, i) => (
            <path key={i} d={`M -${arc.r} 4 Q 0 -${arc.r * 0.8} ${arc.r} 4`} fill="none" stroke={arc.c} strokeWidth="1.2" opacity="0.85" filter="url(#watercolorSoft)" />
          ))}
        </g>
      );

    default: return null;
  }
}

/* ─── QUOTE INPUT ─── tiny inline input + add button used in manage panel */
function QuoteInput({ onAdd, placeholder = "Add an inspirational quote...", color }) {
  const [text, setText] = useState("");
  const c = color || C.gold;
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText("");
  };
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
      <input type="text" value={text} onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        style={{
          flex: 1, padding: "5px 8px", borderRadius: 6,
          border: `1px solid ${c}40`, background: `${C.snow1}80`,
          fontFamily: "'Patrick Hand', cursive", fontSize: 12, color: C.text,
          outline: "none", boxSizing: "border-box",
        }} />
      <button onClick={submit}
        style={{
          padding: "4px 10px", borderRadius: 6, border: "none",
          background: c, color: "white", cursor: "pointer",
          fontFamily: "'Patrick Hand', cursive", fontSize: 12, fontWeight: 700,
        }}>
        +
      </button>
    </div>
  );
}

/* ─── EXAM COUNTDOWN PANEL ─── collapsible left-side widget showing nearest exam
   with live HH:MM:SS countdown and rotating motivational quotes.
*/
function ExamCountdown({
  exams,
  quotes,
  isOpen,
  onToggleOpen,
  isExpanded,
  onToggleExpanded,
  onAddClick,
  onDelete,
  canEdit, // student can edit their own; teacher can edit when viewing single student in manage panel
  // Student-only: manage personal quotes from this panel
  personalQuotes,
  onAddPersonalQuote,
  onDeletePersonalQuote,
}) {
  const active = getActiveExams(exams || []);
  const nearest = active[0];
  const others = active.slice(1);

  // Cycle through quotes every 8s
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    if (!quotes || quotes.length === 0) return;
    const id = setInterval(() => {
      setQuoteIdx(i => (i + 1) % quotes.length);
    }, 8000);
    return () => clearInterval(id);
  }, [quotes?.length]);

  const currentQuote = quotes && quotes.length > 0 ? quotes[quoteIdx % quotes.length] : null;

  // Collapsed pill state
  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 30,
          background: `${C.card}e8`, borderRadius: 999, padding: "10px 16px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
          border: `2px solid ${C.accent}40`, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          fontFamily: "'Patrick Hand', cursive", fontSize: 16, fontWeight: 700, color: C.text,
        }}
        title="Show exam countdown"
      >
        <span style={{ fontSize: 18 }}>{nearest ? nearest.emoji : "📅"}</span>
        <span>
          {nearest
            ? (() => {
                const cd = getCountdown(nearest.dateMs);
                if (cd.passed) return "Exam day!";
                if (cd.days > 0) return `${cd.days}d left`;
                return `${cd.hours}h ${cd.minutes}m`;
              })()
            : "Exams"
          }
        </span>
      </button>
    );
  }

  return (
    <div style={{
      position: "absolute", top: 16, left: 16, zIndex: 30,
      background: `${C.card}f0`, borderRadius: 18, padding: "12px 14px",
      boxShadow: "0 8px 28px rgba(0,0,0,0.15)", backdropFilter: "blur(10px)",
      border: `2px solid ${C.accent}25`, width: 260, maxWidth: "calc(100vw - 32px)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>📅 Exam Countdown</div>
        <button
          onClick={onToggleOpen}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, color: C.textLight, padding: "0 4px", lineHeight: 1, fontWeight: 700 }}
          title="Hide"
        >×</button>
      </div>

      {/* Nearest exam display */}
      {!nearest ? (
        <div style={{ textAlign: "center", padding: "12px 8px", color: C.textLight, fontSize: 13 }}>
          {canEdit ? "No exams yet — add one!" : "No exams scheduled"}
        </div>
      ) : (
        <NearestExamCard exam={nearest} canEdit={canEdit} onDelete={onDelete} />
      )}

      {/* Inspirational quote */}
      {currentQuote && (
        <div style={{
          marginTop: 10,
          padding: "8px 10px",
          background: `linear-gradient(135deg, ${C.gold}15, ${C.accent}10)`,
          border: `1px dashed ${C.gold}50`,
          borderRadius: 10,
          fontSize: 12,
          color: C.text,
          textAlign: "center",
          fontStyle: "italic",
          minHeight: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Patrick Hand', cursive",
        }}>
          {currentQuote}
        </div>
      )}

      {/* Other exams (collapsible) */}
      {others.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={onToggleExpanded}
            style={{
              width: "100%", background: "transparent", border: "none",
              cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
              fontSize: 12, color: C.textLight, padding: "4px 0",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            }}
          >
            <span>{isExpanded ? "▼" : "▶"}</span>
            <span>{others.length} more exam{others.length !== 1 ? "s" : ""}</span>
          </button>
          {isExpanded && (
            <div style={{ marginTop: 4 }}>
              {others.map(e => {
                const cd = getCountdown(e.dateMs);
                return (
                  <div key={e.id} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 8px", marginBottom: 3,
                    background: `${C.snow1}80`, borderRadius: 8,
                    fontSize: 12,
                  }}>
                    <span style={{ fontSize: 14 }}>{e.emoji}</span>
                    <div style={{ flex: 1, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                    <div style={{ color: C.textLight, fontWeight: 700 }}>
                      {cd.passed ? "Today" : cd.days > 0 ? `${cd.days}d` : `${cd.hours}h`}
                    </div>
                    {canEdit && (
                      <button onClick={() => onDelete(e.id)}
                        style={{ background: "transparent", border: "none", color: C.accentDark, cursor: "pointer", fontSize: 12, padding: 2 }}
                        title="Remove">✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add button */}
      {canEdit && (
        <button onClick={onAddClick}
          style={{
            width: "100%", marginTop: 10, padding: "7px 10px", borderRadius: 10,
            border: `2px dashed ${C.accent}40`, background: "transparent",
            color: C.accent, cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
            fontSize: 13, fontWeight: 700,
          }}>
          + Add Exam
        </button>
      )}

      {/* Personal quotes management (student only) */}
      {onAddPersonalQuote && <PersonalQuotesSection
        quotes={personalQuotes || []}
        onAdd={onAddPersonalQuote}
        onDelete={onDeletePersonalQuote}
      />}
    </div>
  );
}

function PersonalQuotesSection({ quotes, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.fur2}30` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
          fontSize: 12, color: C.textLight, padding: "2px 0",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}
      >
        <span>{open ? "▼" : "▶"}</span>
        <span>💬 My Quotes ({quotes.length})</span>
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          {quotes.map((q, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 8px", background: `${C.green}15`, borderRadius: 6,
              marginBottom: 2, fontSize: 11,
            }}>
              <div style={{ flex: 1, color: C.text, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{q}"</div>
              <button onClick={() => onDelete(idx)}
                style={{ background: "transparent", border: "none", color: C.accentDark, cursor: "pointer", fontSize: 10, padding: 1 }}
                title="Remove">✕</button>
            </div>
          ))}
          <QuoteInput
            onAdd={onAdd}
            placeholder="My favorite quote..."
            color={C.green}
          />
        </div>
      )}
    </div>
  );
}

function NearestExamCard({ exam, canEdit, onDelete }) {
  const cd = getCountdown(exam.dateMs);
  const examDate = new Date(exam.dateMs);
  const dateLabel = examDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  if (cd.passed) {
    return (
      <div style={{
        padding: "12px 10px",
        background: `linear-gradient(135deg, ${C.gold}30, ${C.accent}20)`,
        borderRadius: 12, textAlign: "center",
        border: `2px solid ${C.gold}80`,
      }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>{exam.emoji}</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{exam.name}</div>
        <div style={{
          marginTop: 6, padding: "4px 10px", borderRadius: 999,
          background: C.gold, color: "white", fontSize: 12, fontWeight: 700,
          display: "inline-block",
          animation: "examPulse 1.4s ease-in-out infinite",
        }}>
          <style>{`@keyframes examPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>
          🎉 Exam day has arrived!
        </div>
        {canEdit && (
          <div>
            <button onClick={() => onDelete(exam.id)}
              style={{ marginTop: 6, background: "transparent", border: "none", color: C.textLight, cursor: "pointer", fontSize: 11 }}>
              Remove
            </button>
          </div>
        )}
      </div>
    );
  }

  // Color cue based on urgency
  const urgent = cd.days < 3;
  const soon = cd.days < 7;
  const accent = urgent ? C.accent : soon ? C.gold : C.green;

  return (
    <div style={{
      padding: "10px 10px",
      background: `linear-gradient(135deg, ${accent}15, ${accent}05)`,
      borderRadius: 12,
      border: `2px solid ${accent}40`,
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 26 }}>{exam.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exam.name}</div>
          <div style={{ fontSize: 11, color: C.textLight }}>{dateLabel}</div>
        </div>
        {canEdit && (
          <button onClick={() => onDelete(exam.id)}
            style={{ background: "transparent", border: "none", color: C.textLight, cursor: "pointer", padding: 2, fontSize: 12 }}
            title="Remove">✕</button>
        )}
      </div>
      {/* Big day number */}
      <div style={{
        textAlign: "center",
        background: `${accent}25`,
        borderRadius: 10,
        padding: "8px 6px",
      }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1, fontFamily: "'Patrick Hand', cursive" }}>
          {cd.days}
        </div>
        <div style={{ fontSize: 11, color: C.textLight, marginTop: 2, letterSpacing: 0.5, textTransform: "uppercase" }}>
          {cd.days === 1 ? "day left" : "days left"}
        </div>
        {/* HH:MM:SS counter */}
        <div style={{
          marginTop: 6,
          fontSize: 13,
          fontFamily: "monospace",
          color: C.text,
          fontWeight: 700,
          letterSpacing: 1,
        }}>
          {String(cd.hours).padStart(2, "0")}:{String(cd.minutes).padStart(2, "0")}:{String(cd.seconds).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

/* ─── PET EATING ANIMATION ─── universal feeding overlay that works for any pet
   Layered on top of a centered <PetSVG>. Animation timeline:
   - 0.0–0.4s: food emoji descends from above into the pet's mouth area
   - 0.3–0.9s: pet wiggles + a "mouth open" dark patch pulses to show eating
   - 0.9s+:    hearts float upward, fading
*/
function PetEatingAnimation({ petId, feedingFood, showHearts, size = 180, petAccessories = [] }) {
  // Render the pet plus any active feeding/heart layers, sized to fit `size`
  // We draw inside a centered SVG with viewBox -32..32. Pet renders at scale 1.4 (matches pool default).
  const eating = !!feedingFood;
  // Hearts: 5 hearts at random angles, animated upward. They appear when showHearts is true.
  const heartAngles = [-30, -12, 0, 14, 32]; // spread above pet
  return (
    <div style={{
      position: "relative",
      width: size, height: size,
      // Wiggle the whole pet during the eating phase for a chomping feel
      animation: eating ? "petChomp 0.4s ease-in-out 3" : "none",
    }}>
      <style>{`
        @keyframes petChomp {
          0%,100% { transform: translateY(0) rotate(0deg); }
          25%     { transform: translateY(-2px) rotate(-1.5deg); }
          50%     { transform: translateY(0) rotate(0deg); }
          75%     { transform: translateY(-2px) rotate(1.5deg); }
        }
        @keyframes foodFly {
          0%   { transform: translate(-50%, -120%) scale(1) rotate(-15deg); opacity: 0; }
          15%  { transform: translate(-50%, -90%) scale(1.05) rotate(-8deg); opacity: 1; }
          55%  { transform: translate(-50%, -10%) scale(0.85) rotate(8deg); opacity: 1; }
          75%  { transform: translate(-50%, 5%) scale(0.45) rotate(0deg); opacity: 0.85; }
          100% { transform: translate(-50%, 12%) scale(0.05) rotate(0deg); opacity: 0; }
        }
        @keyframes mouthOpen {
          0%,100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
          30%     { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
          60%     { transform: translate(-50%, -50%) scale(1.0); opacity: 0.95; }
          90%     { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
        }
        @keyframes crumbBurst {
          0%   { transform: translate(0,0) scale(0); opacity: 0; }
          25%  { transform: translate(var(--cx,4px), var(--cy,-2px)) scale(1); opacity: 1; }
          100% { transform: translate(calc(var(--cx,4px) * 3), calc(var(--cy,-2px) * 3)) scale(0.4); opacity: 0; }
        }
        @keyframes heartFloat {
          0%   { transform: translate(var(--hx, 0), 0) scale(0.4); opacity: 0; }
          15%  { transform: translate(var(--hx, 0), -8px) scale(1); opacity: 1; }
          70%  { transform: translate(var(--hx, 0), -56px) scale(1); opacity: 0.95; }
          100% { transform: translate(var(--hx, 0), -88px) scale(0.7); opacity: 0; }
        }
      `}</style>

      {/* Pet itself - SVG with watercolor */}
      <svg width={size} height={size} viewBox="-32 -32 64 64" style={{ overflow: "visible", position: "absolute", inset: 0 }}>
        {/* Soft reflection underneath */}
        <ellipse cx="0" cy="22" rx="20" ry="4" fill={C.water1} opacity="0.35" filter="url(#watercolorSoft)" />
        <g transform="scale(1.4)">
          <PetSVG petId={petId} centered={true} mood={eating ? "happy" : "neutral"} petAccessories={petAccessories} />
        </g>

        {/* Mouth-open dark patch — pulses during eating to show chomping.
            Position is a generic "face center" that works across pets. */}
        {eating && (
          <g style={{ animation: "mouthOpen 0.6s ease-in-out 0.3s 1 forwards", transformOrigin: "0 -2px" }}>
            <ellipse cx="0" cy="-2" rx="3" ry="2.4" fill="#3a1a1a" opacity="0.85" />
            <ellipse cx="0" cy="-2.5" rx="2.2" ry="1.4" fill="#7a2a2a" opacity="0.7" />
            {/* tiny tongue */}
            <ellipse cx="0" cy="-1" rx="1.5" ry="0.7" fill="#ff6080" />
          </g>
        )}
      </svg>

      {/* Food emoji flying into the pet's mouth */}
      {eating && (
        <div style={{
          position: "absolute",
          left: "50%", top: "50%",
          fontSize: Math.round(size * 0.32),
          pointerEvents: "none",
          animation: "foodFly 0.85s ease-in 0s 1 forwards",
          textAlign: "center",
          width: 1, height: 1,
          lineHeight: 1,
        }}>
          {feedingFood.emoji}
        </div>
      )}

      {/* Crumb burst — small particles when food disappears into mouth */}
      {eating && (
        <div style={{ position: "absolute", left: "50%", top: "50%", pointerEvents: "none" }}>
          {[
            { cx: -10, cy: -6, delay: 0.7 },
            { cx:  10, cy: -6, delay: 0.72 },
            { cx:  -4, cy: -12, delay: 0.7 },
            { cx:   6, cy: -10, delay: 0.74 },
            { cx: -14, cy:  2, delay: 0.78 },
          ].map((p, i) => (
            <span key={i} style={{
              position: "absolute",
              left: 0, top: 0,
              width: 5, height: 5, borderRadius: "50%",
              background: i % 2 ? "#ffd140" : "#ff8030",
              "--cx": `${p.cx}px`, "--cy": `${p.cy}px`,
              animation: `crumbBurst 0.6s ease-out ${p.delay}s 1 forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      )}

      {/* Hearts floating up after eating */}
      {showHearts && (
        <div style={{ position: "absolute", left: "50%", top: "30%", pointerEvents: "none" }}>
          {heartAngles.map((angle, i) => (
            <span key={i} style={{
              position: "absolute",
              left: 0, top: 0,
              fontSize: 18 + (i === 2 ? 4 : 0),
              "--hx": `${angle}px`,
              animation: `heartFloat 1.4s ease-out ${i * 0.08}s 1 forwards`,
              opacity: 0,
              filter: "drop-shadow(0 1px 2px rgba(200,50,80,0.4))",
            }}>💖</span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── FOOD SHOP ─── modal where students buy pet food with stars */
function FoodShop({ student, onClose, onBuy }) {
  const care = getPetCare(student);
  const pet = student?.pet ? getPet(student.pet) : null;
  const canAfford = (price) => student.points >= price;
  // Eating animation state — set to a food emoji during the ~1.6s eating sequence
  const [feedingFood, setFeedingFood] = useState(null);
  const [showHearts, setShowHearts] = useState(false);

  // Wrapper: try to buy the food; on success, play the eating animation
  const handleBuy = (foodId) => {
    const food = getFood(foodId);
    if (!food) return;
    const success = onBuy(foodId);
    // onBuy may return true/false (sync) or undefined — assume undefined = success unless we can tell
    // Our feedPet returns true on success. We trigger animation regardless of return as long as caller doesn't error.
    if (success !== false) {
      setFeedingFood(food);
      setShowHearts(false);
      // After mouth-eating phase, show hearts
      setTimeout(() => setShowHearts(true), 900);
      setTimeout(() => { setFeedingFood(null); setShowHearts(false); }, 2200);
    }
  };

  if (!pet) {
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center", width: 420 }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 12px" }}>🍱 Pet Pantry</h2>
          <p style={{ color: C.textLight, fontSize: 16, marginBottom: 14 }}>You need a pet first! Open a mystery pack from the Pet Mart.</p>
          <button onClick={onClose} style={primaryBtnStyle}>Okay</button>
        </div>
      </div>
    );
  }

  // Group foods by tier
  const tiers = [
    { name: "Snacks", maxPrice: 30,  color: C.green, foods: FOOD_CATALOG.filter(f => f.price < 30) },
    { name: "Meals",  maxPrice: 80,  color: C.gold,  foods: FOOD_CATALOG.filter(f => f.price >= 30 && f.price < 80) },
    { name: "Premium",maxPrice: 200, color: "#a060c0",foods: FOOD_CATALOG.filter(f => f.price >= 80 && f.price < 200) },
    { name: "Feasts", maxPrice: 999, color: "#e06060",foods: FOOD_CATALOG.filter(f => f.price >= 200) },
  ];

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={{ ...modalCardStyle, width: 580, maxWidth: "95vw", maxHeight: "92vh", overflow: "auto", padding: "20px 24px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 24 }}>🍱 Pet Pantry</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 13 }}>Feed {pet.name} {pet.emoji} · You have <strong style={{ color: C.gold }}>{student.points} ★</strong></p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Mini pet preview - plays eating animation when food is bought */}
        <div style={{
          height: 100,
          background: `linear-gradient(180deg, ${C.snow1}80 0%, ${C.water1}60 100%)`,
          borderRadius: 12,
          marginBottom: 12,
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${C.water1}40`,
        }}>
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <PetEatingAnimation petId={pet.id} feedingFood={feedingFood} showHearts={showHearts} size={88} petAccessories={student.petAccessories || []} />
          </div>
        </div>

        {/* Pet stats summary */}
        {care && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140, background: `${C.gold}15`, padding: "8px 12px", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: C.textLight }}>🍽️ Hunger</div>
              <div style={{ height: 6, background: `${C.fur2}30`, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                <div style={{ height: "100%", width: `${care.hunger}%`, background: care.hunger > 50 ? C.green : care.hunger > 25 ? C.gold : C.accent, transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 700, marginTop: 2 }}>{care.hunger}/100</div>
            </div>
            <div style={{ flex: 1, minWidth: 140, background: `${C.green}15`, padding: "8px 12px", borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: C.textLight }}>💖 Happiness</div>
              <div style={{ height: 6, background: `${C.fur2}30`, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                <div style={{ height: "100%", width: `${care.happiness}%`, background: care.happiness > 50 ? C.green : care.happiness > 25 ? C.gold : C.accent, transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 700, marginTop: 2 }}>{care.happiness}/100</div>
            </div>
          </div>
        )}

        {/* Food tiers */}
        {tiers.map(tier => (
          <div key={tier.name} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: tier.color }}>{tier.name}</div>
              <div style={{ flex: 1, height: 1, background: `${tier.color}30` }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {tier.foods.map(food => {
                const affordable = canAfford(food.price);
                return (
                  <button
                    key={food.id}
                    onClick={() => affordable && handleBuy(food.id)}
                    disabled={!affordable}
                    style={{
                      padding: "10px",
                      borderRadius: 12,
                      border: `2px solid ${tier.color}40`,
                      background: affordable ? `${tier.color}10` : `${C.fur2}10`,
                      cursor: affordable ? "pointer" : "not-allowed",
                      opacity: affordable ? 1 : 0.5,
                      textAlign: "center",
                      transition: "transform 0.15s",
                      fontFamily: "'Patrick Hand', cursive",
                    }}
                    onMouseEnter={e => affordable && (e.currentTarget.style.transform = "scale(1.04)")}
                    onMouseLeave={e => affordable && (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <div style={{ fontSize: 30, marginBottom: 2 }}>{food.emoji}</div>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{food.name}</div>
                    <div style={{ fontSize: 10, color: C.textLight, fontStyle: "italic", marginBottom: 4 }}>{food.flavor}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 4, fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: C.gold }}>+{food.hunger}🍽️</span>
                      <span style={{ color: C.green }}>+{food.happiness}💖</span>
                    </div>
                    <div style={{
                      background: affordable ? C.gold : C.textLight,
                      color: "white", borderRadius: 999,
                      padding: "3px 10px", fontSize: 12, fontWeight: 700,
                      display: "inline-block",
                    }}>
                      {food.price} ★
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── MY POOL ─── personal Tamagotchi-style scene where the student cares for their pet */
function MyPool({ student, onClose, onFeed, onWalk, onShop, onPetMart }) {
  // Live tick for stat updates
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const care = getPetCare(student);
  const pet = student?.pet ? getPet(student.pet) : null;
  const careLabel = care ? getCareLabel(care.avgCare) : null;
  const incomeMul = care ? getCareIncomeMultiplier(care.avgCare) : 1.0;
  const ownedPets = student?.ownedPets || [];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1500,
      background: C.bg,
      overflow: "auto",
    }}>
      {/* Close button - top right */}
      <button onClick={onClose}
        style={{
          position: "fixed", top: 16, right: 20, zIndex: 30,
          background: `${C.card}ee`, border: `2px solid ${C.fur2}40`,
          padding: "8px 18px", borderRadius: 999,
          fontSize: 16, fontWeight: 700, color: C.text,
          fontFamily: "'Patrick Hand', cursive",
          cursor: "pointer", backdropFilter: "blur(8px)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
        }}>
        ← Back
      </button>

      {/* Header banner */}
      <div style={{
        position: "fixed", top: 16, left: 20, zIndex: 30,
        background: `${C.card}ee`, padding: "10px 20px", borderRadius: 16,
        backdropFilter: "blur(8px)", boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
        border: `2px solid ${C.gold}40`,
      }}>
        <h2 style={{ margin: 0, color: C.text, fontSize: 22, fontFamily: "'Patrick Hand', cursive" }}>
          🌸 {student.name}'s Hot Spring
        </h2>
        <p style={{ margin: "2px 0 0", color: C.textLight, fontSize: 13, fontFamily: "'Patrick Hand', cursive" }}>
          {pet ? `Caring for ${pet.name} ${pet.emoji}` : "No pet yet — visit the Pet Mart!"}
          {ownedPets.length > 1 && ` · ${ownedPets.length} pets total`}
        </p>
      </div>

      {/* Main scene — same components as homepage */}
      <div style={{
        position: "relative", margin: "8px auto 0",
        width: "96%", maxWidth: 1300, height: "calc(100vh - 240px)",
        minHeight: 400,
        borderRadius: 20, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        marginTop: 80,
      }}>
        <BackgroundScene w={1300} h={800} />
        <div style={{ position: "absolute", top: "30%", left: "6%", right: "6%", bottom: "6%", borderRadius: 20, overflow: "hidden" }}>
          <WaterCanvas width={1150} height={550} />
        </div>
        <SteamParticles count={18} />

        {/* The student's monkey, big and centered, surrounded by all their pets */}
        <div style={{
          position: "absolute", left: "50%", top: "55%",
          transform: "translate(-50%, -50%)",
          zIndex: 5,
        }}>
          <MonkeySVG
            size={220}
            mood={(care && care.happiness > 60) ? "excited" : (care && care.happiness < 30) ? "neutral" : "happy"}
            label={student.name}
            points={student.points}
            variant={0}
            accessories={student.accessories || []}
            pet={student.pet}
            petAccessories={student.petAccessories || []}
            ownedPets={ownedPets}
            streakLevel="sprout"
          />
        </div>
      </div>

      {/* Bottom dock — pet care stats + actions (only if a pet is equipped) */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: `linear-gradient(180deg, transparent 0%, ${C.bg}f0 30%, ${C.bg} 100%)`,
        padding: "30px 24px 18px",
        zIndex: 20,
      }}>
        <div style={{
          maxWidth: 720, margin: "0 auto",
          background: `${C.card}f8`, borderRadius: 18,
          padding: "14px 20px",
          boxShadow: "0 6px 24px rgba(0,0,0,0.15)",
          border: `2px solid ${C.gold}30`,
        }}>
          {!pet ? (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>🐣</div>
              <p style={{ color: C.text, fontSize: 16, marginBottom: 10, fontFamily: "'Patrick Hand', cursive" }}>
                You don't have a pet yet — open a mystery pack!
              </p>
              <button onClick={() => { onClose(); onPetMart && onPetMart(); }} style={primaryBtnStyle}>
                🎁 Open Pet Mart
              </button>
            </div>
          ) : (
            <>
              {/* Stats + badges row */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                {careLabel && (
                  <div style={{
                    background: `${careLabel.color}e0`, color: "white",
                    padding: "5px 12px", borderRadius: 999,
                    fontSize: 13, fontWeight: 700, fontFamily: "'Patrick Hand', cursive",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span>{careLabel.emoji}</span><span>{careLabel.label}</span>
                  </div>
                )}
                <div style={{
                  background: `${C.snow1}`, color: incomeMul >= 1.3 ? C.green : incomeMul >= 1.0 ? C.text : C.accent,
                  padding: "5px 12px", borderRadius: 999,
                  fontSize: 12, fontWeight: 700, fontFamily: "'Patrick Hand', cursive",
                }}>
                  💰 {Math.round(incomeMul * 100)}% income
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, fontSize: 12, color: C.text, fontFamily: "'Patrick Hand', cursive" }}>
                    <span style={{ fontWeight: 700 }}>🍽️ Hunger {care?.hunger ?? 0}</span>
                    <span style={{ fontWeight: 700 }}>💖 Happy {care?.happiness ?? 0}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ flex: 1, height: 10, background: `${C.fur2}30`, borderRadius: 5, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${care?.hunger ?? 0}%`,
                        background: care && care.hunger > 50 ? `linear-gradient(90deg, ${C.green}, #4a8a4c)` : care && care.hunger > 25 ? `linear-gradient(90deg, ${C.gold}, #b88810)` : `linear-gradient(90deg, ${C.accent}, ${C.accentDark})`,
                        transition: "width 0.6s",
                      }} />
                    </div>
                    <div style={{ flex: 1, height: 10, background: `${C.fur2}30`, borderRadius: 5, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${care?.happiness ?? 0}%`,
                        background: care && care.happiness > 50 ? `linear-gradient(90deg, ${C.green}, #4a8a4c)` : care && care.happiness > 25 ? `linear-gradient(90deg, ${C.gold}, #b88810)` : `linear-gradient(90deg, ${C.accent}, ${C.accentDark})`,
                        transition: "width 0.6s",
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button onClick={onShop}
                  style={{
                    padding: "12px", borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg, ${C.gold}, #b88810)`,
                    color: "white", cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
                    fontSize: 16, fontWeight: 700, boxShadow: `0 4px 12px ${C.gold}40`,
                  }}>
                  🍱 Feed
                </button>
                <button onClick={onWalk}
                  style={{
                    padding: "12px", borderRadius: 14, border: "none",
                    background: `linear-gradient(135deg, ${C.green}, #4a8a4c)`,
                    color: "white", cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
                    fontSize: 16, fontWeight: 700, boxShadow: `0 4px 12px ${C.green}40`,
                  }}>
                  🚶 Walk
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── WALK MINI-GAME ─── student guides the pet through obstacles to boost happiness */
function WalkGame({ student, onClose, onComplete }) {
  const canvasRef = useRef(null);
  const petOverlayRef = useRef(null);
  const [size, setSize] = useState({ w: 600, h: 320 });
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [collected, setCollected] = useState(0);
  const [hits, setHits] = useState(0);

  const stateRef = useRef({
    petY: 0,
    petTargetY: 0,
    obstacles: [], // { x, y, type: 'rock' | 'flower' | 'butterfly' | 'star' }
    distance: 0,
    speed: 4,
    nextSpawnIn: 60,
    frame: 0,
  });

  const pet = student?.pet ? getPet(student.pet) : null;
  const finishedRef = useRef(false);

  useEffect(() => {
    const updateSize = () => {
      const containerW = Math.min(window.innerWidth - 40, 720);
      const w = Math.max(320, containerW);
      const h = Math.round(w * 0.45);
      setSize({ w, h });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Initialize pet position once size known
  useEffect(() => {
    stateRef.current.petY = size.h / 2;
    stateRef.current.petTargetY = size.h / 2;
  }, [size.h]);

  // Walk lasts 30 seconds
  useEffect(() => {
    if (!started || finished) return;
    const id = setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true;
        setFinished(true);
      }
    }, 30000);
    return () => clearTimeout(id);
  }, [started, finished]);

  // Game loop
  useEffect(() => {
    if (!started || finished) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;

    const ITEM_TYPES = [
      { type: "flower",    emoji: "🌸", points: 5,  good: true,  size: 32 },
      { type: "butterfly", emoji: "🦋", points: 8,  good: true,  size: 28 },
      { type: "star",      emoji: "⭐", points: 10, good: true,  size: 30 },
      { type: "treat",     emoji: "🍪", points: 12, good: true,  size: 32 },
      { type: "rock",      emoji: "🪨", points: 0,  good: false, size: 36 },
      { type: "puddle",    emoji: "💧", points: 0,  good: false, size: 32 },
    ];

    const loop = () => {
      const s = stateRef.current;
      s.frame++;

      // Pet smoothly follows target
      s.petY += (s.petTargetY - s.petY) * 0.18;

      // Move world
      s.distance += s.speed;

      // Move obstacles
      s.obstacles = s.obstacles.map(o => ({ ...o, x: o.x - s.speed }));
      s.obstacles = s.obstacles.filter(o => o.x > -50);

      // Spawn new
      s.nextSpawnIn--;
      if (s.nextSpawnIn <= 0) {
        const item = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
        const yMin = 40, yMax = size.h - 40;
        s.obstacles.push({
          x: size.w + 30,
          y: yMin + Math.random() * (yMax - yMin),
          ...item,
        });
        s.nextSpawnIn = 30 + Math.floor(Math.random() * 40);
      }

      // Collision detection (around the pet)
      const petX = 70;
      const petRadius = 28;
      s.obstacles.forEach(o => {
        if (o.collected) return;
        const dx = o.x - petX;
        const dy = o.y - s.petY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < petRadius + o.size / 2 - 4) {
          o.collected = true;
          if (o.good) {
            SFX.collect();
            setScore(sc => sc + o.points);
            setCollected(c => c + 1);
          } else {
            SFX.wrong();
            setHits(h => h + 1);
          }
        }
      });
      // Drop collected after a short delay
      s.obstacles = s.obstacles.filter(o => !o.collected || o.collectedAt > s.frame - 8);
      s.obstacles.forEach(o => { if (o.collected && !o.collectedAt) o.collectedAt = s.frame; });

      // Speed up gradually
      s.speed = Math.min(7, 4 + s.distance * 0.0008);

      // === RENDER ===
      // Sky gradient (sunset path)
      const grd = ctx.createLinearGradient(0, 0, 0, size.h);
      grd.addColorStop(0, "#ffd8a8");
      grd.addColorStop(0.5, "#ffb890");
      grd.addColorStop(1, "#a8e0a0");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size.w, size.h);

      // Ground path stripes
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 8; i++) {
        const x = (i * 100 - (s.distance % 100));
        ctx.fillRect(x, size.h - 30, 60, 6);
      }

      // Distant trees
      ctx.fillStyle = "rgba(74, 138, 76, 0.5)";
      for (let i = 0; i < 5; i++) {
        const x = (i * 200 - (s.distance * 0.3) % (size.w + 200));
        const treeY = size.h * 0.6;
        ctx.beginPath();
        ctx.arc(x + 30, treeY, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x + 27, treeY, 6, 18);
      }

      // Obstacles / collectibles
      s.obstacles.forEach(o => {
        if (o.collected) {
          ctx.globalAlpha = Math.max(0, 1 - (s.frame - o.collectedAt) / 8);
        }
        ctx.font = `${o.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(o.emoji, o.x, o.y);
        ctx.globalAlpha = 1;
      });

      // (Pet rendered as SVG overlay outside the canvas — see below)
      // Update pet overlay's CSS top to follow petY in canvas coords
      const bobY = s.petY + Math.sin(s.frame * 0.15) * 2;
      s.renderedPetY = bobY;
      if (petOverlayRef.current) {
        // map canvas-Y to overlay percentage of canvas height
        petOverlayRef.current.style.top = `${(bobY / size.h) * 100}%`;
      }

      // Sparkle trail
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 5; i++) {
        const tx = petX - 20 - i * 12;
        const ty = bobY + Math.sin(s.frame * 0.2 + i) * 4;
        ctx.beginPath();
        ctx.arc(tx, ty, 2 - i * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, finished, size, pet]);

  // Mouse / touch input — pet follows pointer Y
  const movePet = (clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = clientY - rect.top;
    const scaledY = (y / rect.height) * size.h;
    stateRef.current.petTargetY = Math.max(40, Math.min(size.h - 40, scaledY));
  };

  // Keyboard fallback (arrow keys)
  useEffect(() => {
    if (!started) return;
    const handleKey = (e) => {
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        stateRef.current.petTargetY = Math.max(40, stateRef.current.petTargetY - 30);
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        stateRef.current.petTargetY = Math.min(size.h - 40, stateRef.current.petTargetY + 30);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [started, size.h]);

  // When finished, calculate happiness boost and report
  const finishHandler = () => {
    // Boost based on score: 5 points = 1 happiness, capped at 35
    const happinessBoost = Math.min(35, 10 + Math.floor(score / 4));
    const starBonus = Math.min(10, Math.floor(collected / 3));
    onComplete(happinessBoost, starBonus);
    onClose();
  };

  if (!pet) {
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center", width: 400 }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 12px" }}>🚶 No Pet to Walk</h2>
          <p style={{ color: C.textLight, fontSize: 16 }}>You need a pet to take on a walk!</p>
          <button onClick={onClose} style={primaryBtnStyle}>Okay</button>
        </div>
      </div>
    );
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalCardStyle, width: Math.min(size.w + 80, window.innerWidth - 20), maxWidth: "98vw", padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>🚶 Walk with {pet.name}</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 13 }}>
              Score: {score} ★ · Collected: {collected} · Hits: {hits}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        <div
          style={{ position: "relative", borderRadius: 12, overflow: "hidden", touchAction: "none", cursor: "ns-resize" }}
          onMouseMove={e => started && !finished && movePet(e.clientY)}
          onTouchStart={e => { e.preventDefault(); if (!started) setStarted(true); else if (!finished) movePet(e.touches[0].clientY); }}
          onTouchMove={e => { e.preventDefault(); if (started && !finished) movePet(e.touches[0].clientY); }}
          onClick={() => !started && setStarted(true)}
        >
          <canvas
            ref={canvasRef}
            width={size.w}
            height={size.h}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          {/* Pet overlay - watercolor SVG positioned over the canvas, follows pet's tracked Y */}
          {started && !finished && (
            <div ref={petOverlayRef}
              style={{
                position: "absolute",
                left: `${(70 / size.w) * 100}%`,
                top: 0,
                transform: "translate(-50%, 0)",
                pointerEvents: "none",
                width: 80, height: 80,
                marginTop: -40,
              }}>
              <svg width="80" height="80" viewBox="-32 -32 64 64" style={{ overflow: "visible" }}>
                <g transform="scale(1.15)">
                  <PetSVG petId={pet.id} centered={true} mood="happy" petAccessories={student.petAccessories || []} />
                </g>
              </svg>
            </div>
          )}
          {!started && !finished && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(2px)",
            }}>
              <div style={{ fontSize: 56, marginBottom: 8 }}>🚶</div>
              <div style={{ fontSize: 22, color: C.text, fontWeight: 700, marginBottom: 8 }}>Tap to start the walk!</div>
              <div style={{ fontSize: 13, color: C.textLight, textAlign: "center", maxWidth: 380, padding: "0 12px" }}>
                Move mouse / drag finger up & down to guide your pet.
                Collect 🌸🦋⭐🍪 — avoid 🪨💧!
                <br />30 seconds · The more you collect, the happier your pet!
              </div>
            </div>
          )}
          {finished && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", background: `${C.green}c0`,
              backdropFilter: "blur(2px)",
            }}>
              <div style={{ fontSize: 56, marginBottom: 6 }}>🎉</div>
              <div style={{ fontSize: 22, color: "white", fontWeight: 700, marginBottom: 8 }}>Walk complete!</div>
              <div style={{ background: "white", borderRadius: 12, padding: "10px 18px", marginBottom: 12, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: C.textLight }}>Collected: {collected} · Score: {score} ★</div>
                <div style={{ fontSize: 14, color: C.green, fontWeight: 700, marginTop: 4 }}>
                  +{Math.min(35, 10 + Math.floor(score / 4))} 💖 happiness for {pet.name}!
                </div>
                {Math.min(10, Math.floor(collected / 3)) > 0 && (
                  <div style={{ fontSize: 13, color: C.gold, fontWeight: 700, marginTop: 2 }}>
                    +{Math.min(10, Math.floor(collected / 3))} ★ bonus stars!
                  </div>
                )}
              </div>
              <button onClick={finishHandler} style={primaryBtnStyle}>Back to Hot Spring</button>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: C.textLight }}>
          Move pointer up & down to guide. Arrow keys also work.
        </div>
      </div>
    </div>
  );
}

/* ─── IMPROVED MONKEY SVG ─── */
function MonkeySVG({ size = 120, mood = "happy", label, points, onClick, delay = 0, style = {}, selected, variant = 0, accessories = [], pet = null, petAccessories = [], ownedPets = [], streakLevel = "sprout" }) {
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
          const gradId = `streakGrad-${streakLevel}-${variant}`;
          const haloId = `streakHalo-${streakLevel}-${variant}`;
          return (
            <g style={{ pointerEvents: "none" }}>
              <style>{`
                @keyframes streakPulse-${streakLevel} {
                  0%, 100% { opacity: 0.45; transform: scale(1); }
                  50% { opacity: 0.75; transform: scale(1.06); }
                }
                @keyframes streakBreathe-${streakLevel} {
                  0%, 100% { opacity: 0.25; }
                  50% { opacity: 0.55; }
                }
                @keyframes streakRotate-${streakLevel} {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                @keyframes streakSparkle-${streakLevel} {
                  0%, 100% { opacity: 0; transform: scale(0.5); }
                  50% { opacity: 1; transform: scale(1.2); }
                }
                @keyframes streakDrift-${streakLevel} {
                  0% { transform: translateY(0px); opacity: 0; }
                  20% { opacity: 1; }
                  80% { opacity: 1; }
                  100% { transform: translateY(-14px); opacity: 0; }
                }
              `}</style>

              {/* Radial gradient definitions — bright glow at center, fades outward */}
              <defs>
                <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={lvl.glow} stopOpacity="0.85" />
                  <stop offset="40%" stopColor={lvl.color} stopOpacity="0.55" />
                  <stop offset="75%" stopColor={lvl.color} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={lvl.color} stopOpacity="0" />
                </radialGradient>
                <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="60%" stopColor={lvl.glow} stopOpacity="0.0" />
                  <stop offset="80%" stopColor={lvl.color} stopOpacity="0.5" />
                  <stop offset="92%" stopColor={lvl.glow} stopOpacity="0.85" />
                  <stop offset="100%" stopColor={lvl.color} stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Outer soft cloud — gentle breathing glow */}
              <ellipse cx="0" cy="-8" rx="58" ry="68" fill={`url(#${gradId})`}
                style={{ animation: `streakBreathe-${streakLevel} 3s ease-in-out infinite`, transformOrigin: "0px -8px" }} />

              {/* Halo ring — bright edge glow */}
              <ellipse cx="0" cy="-8" rx="48" ry="56" fill={`url(#${haloId})`}
                style={{ animation: `streakPulse-${streakLevel} 2.5s ease-in-out infinite`, transformOrigin: "0px -8px" }} />

              {/* Bronze: warm copper sparkles + drifting embers */}
              {streakLevel === "bronze" && (
                <>
                  {[{x: -34, y: -22, d: 0}, {x: 36, y: -18, d: 0.5}, {x: -30, y: 8, d: 1.0}, {x: 32, y: 12, d: 1.4}].map((s, i) => (
                    <g key={i} style={{ animation: `streakSparkle-bronze 2s ease-in-out ${s.d}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>
                      <circle cx={s.x} cy={s.y} r="2" fill={lvl.glow} />
                      <circle cx={s.x} cy={s.y} r="1" fill="#ffe4c0" />
                    </g>
                  ))}
                  {/* Drifting embers */}
                  {[{x: -24, d: 0}, {x: 26, d: 1.2}].map((e, i) => (
                    <circle key={`e${i}`} cx={e.x} cy="20" r="1.2" fill="#ffb070"
                      style={{ animation: `streakDrift-bronze 2.4s ease-out ${e.d}s infinite`, transformOrigin: `${e.x}px 20px` }} />
                  ))}
                </>
              )}

              {/* Silver: shimmering moonlit sparkles */}
              {streakLevel === "silver" && (
                <>
                  {[{x: -34, y: -20, d: 0}, {x: 32, y: -28, d: 0.5}, {x: -28, y: 8, d: 1}, {x: 30, y: 5, d: 1.5}, {x: 0, y: -52, d: 0.8}].map((s, i) => (
                    <g key={i} style={{ animation: `streakSparkle-silver 1.8s ease-in-out ${s.d}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>
                      <path d={`M ${s.x} ${s.y - 4} L ${s.x + 1.2} ${s.y - 0.5} L ${s.x + 4} ${s.y} L ${s.x + 1.2} ${s.y + 0.5} L ${s.x} ${s.y + 4} L ${s.x - 1.2} ${s.y + 0.5} L ${s.x - 4} ${s.y} L ${s.x - 1.2} ${s.y - 0.5} Z`} fill="#fcfcff" stroke="#d8e8f5" strokeWidth="0.3" />
                    </g>
                  ))}
                </>
              )}

              {/* Gold: warm golden sparkles + orbiting ring */}
              {streakLevel === "gold" && (
                <>
                  <ellipse cx="0" cy="-10" rx="42" ry="48" fill="none" stroke="#ffd860" strokeWidth="1" strokeDasharray="3 5" opacity="0.7"
                    style={{ animation: `streakRotate-gold 14s linear infinite`, transformOrigin: "0 -10px" }} />
                  {[{x: -38, y: -28}, {x: 38, y: -28}, {x: -42, y: 5}, {x: 42, y: 5}, {x: 0, y: -55}].map((s, i) => (
                    <g key={i} style={{ animation: `streakSparkle-gold 2s ease-in-out ${i * 0.3}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>
                      <text x={s.x} y={s.y} fontSize="13" fill="#ffd040" textAnchor="middle" stroke="#a07810" strokeWidth="0.2">✦</text>
                    </g>
                  ))}
                </>
              )}

              {/* Crystal: ice-blue ethereal halo + crystal shards */}
              {streakLevel === "crystal" && (
                <>
                  <ellipse cx="0" cy="-10" rx="55" ry="62" fill="none" stroke="#a8e8f0" strokeWidth="1" opacity="0.6"
                    style={{ animation: `streakPulse-crystal 2.4s ease-in-out infinite`, transformOrigin: "0px -10px" }} />
                  <ellipse cx="0" cy="-10" rx="48" ry="55" fill="none" stroke="#5ac8e8" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.6"
                    style={{ animation: `streakRotate-crystal 18s linear infinite`, transformOrigin: "0 -10px" }} />
                  {[{x: -40, y: -30, r: 0}, {x: 42, y: -32, r: 30}, {x: -45, y: 10, r: 60}, {x: 45, y: 8, r: 90}, {x: 0, y: -58, r: 45}].map((s, i) => (
                    <g key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r})`}
                      style={{ animation: `streakSparkle-crystal 2.5s ease-in-out ${i * 0.4}s infinite` }}>
                      <path d="M 0 -5 L 1 0 L 0 5 L -1 0 Z M -5 0 L 0 1 L 5 0 L 0 -1 Z" fill="#bfeff5" stroke="#5ac8e8" strokeWidth="0.4" />
                    </g>
                  ))}
                </>
              )}

              {/* Rainbow: gentle color rings + rainbow sparkles */}
              {streakLevel === "rainbow" && (
                <>
                  {["#ff6080", "#ffa040", "#ffd040", "#5caa5e", "#5a8fc7", "#a060c0"].map((color, i) => (
                    <ellipse key={i} cx="0" cy="-10" rx={50 - i * 4} ry={56 - i * 4} fill="none" stroke={color} strokeWidth="0.9" opacity="0.45"
                      style={{ animation: `streakRotate-rainbow ${15 + i * 2}s linear ${i % 2 ? "reverse" : "normal"} infinite`, transformOrigin: "0 -10px" }} />
                  ))}
                  {[{x: -38, y: -25, c: "#ff6080"}, {x: 40, y: -30, c: "#5caa5e"}, {x: -42, y: 8, c: "#5a8fc7"}, {x: 42, y: 5, c: "#a060c0"}, {x: 0, y: -58, c: "#ffd040"}].map((s, i) => (
                    <g key={i} style={{ animation: `streakSparkle-rainbow 1.6s ease-in-out ${i * 0.25}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>
                      <text x={s.x} y={s.y} fontSize="13" fill={s.c} textAnchor="middle">✦</text>
                    </g>
                  ))}
                </>
              )}

              {/* Legendary: cosmic stars + dual-color halo */}
              {streakLevel === "legendary" && (
                <>
                  <ellipse cx="0" cy="-10" rx="62" ry="70" fill="none" stroke="#ff8030" strokeWidth="1.5" opacity="0.55"
                    style={{ animation: `streakPulse-legendary 1.8s ease-in-out infinite`, transformOrigin: "0px -10px" }} />
                  <ellipse cx="0" cy="-10" rx="52" ry="58" fill="none" stroke="#ffd060" strokeWidth="1" opacity="0.7" strokeDasharray="6 8"
                    style={{ animation: `streakRotate-legendary 8s linear infinite`, transformOrigin: "0 -10px" }} />
                  <ellipse cx="0" cy="-10" rx="44" ry="50" fill="none" stroke="#ffffff" strokeWidth="0.6" opacity="0.55" strokeDasharray="2 6"
                    style={{ animation: `streakRotate-legendary 6s linear reverse infinite`, transformOrigin: "0 -10px" }} />
                  {[{x: -45, y: -28}, {x: 47, y: -32}, {x: -48, y: 8}, {x: 48, y: 6}, {x: 0, y: -62}, {x: -25, y: -55}, {x: 25, y: -55}].map((s, i) => (
                    <g key={i} style={{ animation: `streakSparkle-legendary 1.8s ease-in-out ${i * 0.2}s infinite`, transformOrigin: `${s.x}px ${s.y}px` }}>
                      <text x={s.x} y={s.y} fontSize="14" fill={i % 2 ? "#ff8030" : "#ffd060"} textAnchor="middle" fontWeight="bold">⭐</text>
                    </g>
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
            <path d="M -11 -16 Q -8 -14 -5 -16" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
            <path d="M 5 -16 Q 8 -14 11 -16" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="-8" cy="-16" rx="4.5" ry="4" fill="white" opacity="0.95" />
            <ellipse cx="8" cy="-16" rx="4.5" ry="4" fill="white" opacity="0.95" />
            <circle cx="-7.5" cy="-15.5" r="2.8" fill="#1a1a1a" />
            <circle cx="8.5" cy="-15.5" r="2.8" fill="#1a1a1a" />
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
          <path d="M -6 -2 Q 0 6 6 -2" fill={C.noseDark} opacity="0.3" stroke="#3a2a1a" strokeWidth="1.2" strokeLinecap="round" />
        ) : mood === "happy" ? (
          <path d="M -5 -2 Q 0 4 5 -2" fill="none" stroke="#3a2a1a" strokeWidth="1.3" strokeLinecap="round" />
        ) : (
          <path d="M -3.5 0 Q 0 1 3.5 0" fill="none" stroke="#3a2a1a" strokeWidth="1.2" strokeLinecap="round" />
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

        {/* ─── 50+ NEW ACCESSORY RENDERS ─── hand-drawn watercolor style */}

        {/* === FREE HEAD ITEMS === */}
        {accessories.includes("partyhat") && (
          <g filter="url(#watercolorSoft)">
            {/* cone */}
            <path d="M -13 -32 L 0 -58 L 13 -32 Z" fill="#ff5c87" stroke="#c83870" strokeWidth="0.8" />
            {/* stripes */}
            <path d="M -7 -44 L 7 -44" stroke="#ffd140" strokeWidth="2" />
            <path d="M -10 -38 L 10 -38" stroke="#5caa5e" strokeWidth="2" />
            {/* pom-pom */}
            <circle cx="0" cy="-58" r="3.5" fill="#ffd140" />
            <circle cx="-1" cy="-59" r="1" fill="white" opacity="0.6" />
          </g>
        )}
        {accessories.includes("graduationcap") && (
          <g filter="url(#watercolorSoft)">
            {/* base cap */}
            <ellipse cx="0" cy="-34" rx="14" ry="4" fill="#1a1a1a" />
            {/* mortarboard square */}
            <path d="M -22 -38 L 0 -42 L 22 -38 L 0 -34 Z" fill="#2a2a2a" stroke="#000" strokeWidth="0.6" />
            {/* button */}
            <circle cx="0" cy="-39" r="1.5" fill="#edb830" />
            {/* tassel */}
            <path d="M 0 -39 Q 18 -36 20 -28" stroke="#edb830" strokeWidth="1.2" fill="none" />
            <ellipse cx="20" cy="-26" rx="1.5" ry="3" fill="#edb830" />
          </g>
        )}
        {accessories.includes("leaf") && (
          <g filter="url(#watercolorSoft)">
            {/* leaf crown */}
            <path d="M -18 -34 Q -22 -42 -14 -42 Q -10 -38 -10 -34" fill="#5caa5e" />
            <path d="M -8 -36 Q -10 -46 -2 -46 Q 0 -40 0 -36" fill="#7ac87c" />
            <path d="M 8 -36 Q 6 -46 14 -46 Q 16 -42 14 -36" fill="#5caa5e" />
            <path d="M 18 -34 Q 22 -42 14 -42 Q 10 -38 10 -34" fill="#7ac87c" />
            {/* stem */}
            <path d="M -18 -34 Q 0 -36 18 -34" stroke="#3a7a3c" strokeWidth="1" fill="none" />
            {/* dewdrop */}
            <ellipse cx="-2" cy="-44" rx="1" ry="1.5" fill="white" opacity="0.7" />
          </g>
        )}
        {accessories.includes("rainbow") && (
          <g filter="url(#watercolorSoft)">
            {/* headband base */}
            <path d="M -20 -34 Q 0 -44 20 -34" stroke="#a8c8d4" strokeWidth="2.5" fill="none" />
            {/* rainbow arches */}
            <path d="M -14 -34 Q 0 -44 14 -34" stroke="#e06060" strokeWidth="2" fill="none" />
            <path d="M -12 -34 Q 0 -42 12 -34" stroke="#edb830" strokeWidth="1.5" fill="none" />
            <path d="M -10 -34 Q 0 -40 10 -34" stroke="#5caa5e" strokeWidth="1.5" fill="none" />
            <path d="M -8 -34 Q 0 -38 8 -34" stroke="#5a8fc7" strokeWidth="1.5" fill="none" />
            <path d="M -6 -34 Q 0 -36 6 -34" stroke="#a060c0" strokeWidth="1.5" fill="none" />
          </g>
        )}

        {/* === PAID HEAD ITEMS === */}
        {accessories.includes("cowboyhat") && (
          <g filter="url(#watercolorSoft)">
            {/* brim - wide curved */}
            <path d="M -28 -34 Q -14 -38 0 -38 Q 14 -38 28 -34 Q 24 -32 0 -32 Q -24 -32 -28 -34 Z"
              fill="#8b6342" stroke="#553928" strokeWidth="0.7" />
            {/* crown of hat */}
            <path d="M -12 -38 Q -14 -50 0 -52 Q 14 -50 12 -38 Z" fill="#a3796a" stroke="#553928" strokeWidth="0.7" />
            {/* dent in top */}
            <path d="M -6 -50 Q 0 -47 6 -50" stroke="#553928" strokeWidth="0.6" fill="none" />
            {/* band */}
            <ellipse cx="0" cy="-40" rx="13" ry="2" fill="#3a2a1a" />
            {/* star */}
            <text x="0" y="-39" fontSize="4" textAnchor="middle" fill="#edb830">★</text>
          </g>
        )}
        {accessories.includes("tophat") && (
          <g filter="url(#watercolorSoft)">
            {/* wizard hat - tall pointed */}
            <path d="M -14 -32 Q 0 -34 14 -32 L 4 -54 Q 0 -60 -4 -54 Z"
              fill="#5a3a8a" stroke="#3a1a5a" strokeWidth="0.8" />
            {/* tip droops a bit */}
            <path d="M 0 -60 Q 5 -56 4 -54" fill="none" stroke="#3a1a5a" strokeWidth="0.5" />
            {/* stars */}
            <text x="-5" y="-40" fontSize="3" fill="#ffd140">✦</text>
            <text x="6" y="-46" fontSize="2.5" fill="#ffd140">✦</text>
            <text x="0" y="-52" fontSize="2" fill="white">✦</text>
            {/* moon */}
            <path d="M -2 -38 Q -6 -36 -2 -34 Q 0 -36 -2 -38" fill="#edb830" />
          </g>
        )}
        {accessories.includes("vikinghelm") && (
          <g filter="url(#watercolorSoft)">
            {/* helmet body - rounded dome */}
            <path d="M -16 -32 Q -16 -50 0 -52 Q 16 -50 16 -32 Z" fill="#888a90" stroke="#404248" strokeWidth="0.8" />
            {/* highlight */}
            <path d="M -10 -46 Q -8 -50 -4 -50" stroke="#c0c2c8" strokeWidth="2" fill="none" />
            {/* nose guard */}
            <rect x="-1.5" y="-32" width="3" height="6" fill="#666870" />
            {/* horns */}
            <path d="M -16 -36 Q -28 -40 -28 -32 Q -22 -34 -16 -32" fill="#f4ebd0" stroke="#a8956a" strokeWidth="0.8" />
            <path d="M 16 -36 Q 28 -40 28 -32 Q 22 -34 16 -32" fill="#f4ebd0" stroke="#a8956a" strokeWidth="0.8" />
          </g>
        )}
        {accessories.includes("policehat") && (
          <g filter="url(#watercolorSoft)">
            {/* base brim */}
            <ellipse cx="0" cy="-32" rx="20" ry="3" fill="#1a2a4a" />
            {/* main body */}
            <path d="M -16 -34 Q -16 -48 0 -48 Q 16 -48 16 -34 Z" fill="#2a3a6a" stroke="#0a1a3a" strokeWidth="0.7" />
            {/* center band */}
            <rect x="-16" y="-38" width="32" height="3" fill="#1a2a4a" />
            {/* badge */}
            <text x="0" y="-41" fontSize="6" textAnchor="middle" fill="#edb830">★</text>
            {/* visor strap */}
            <ellipse cx="0" cy="-31" rx="14" ry="1.5" fill="#0a1a3a" />
          </g>
        )}
        {accessories.includes("chefhat") && (
          <g filter="url(#watercolorSoft)">
            {/* band */}
            <rect x="-14" y="-36" width="28" height="4" fill="#f5f0ea" stroke="#c0b8a8" strokeWidth="0.6" />
            {/* puff body */}
            <path d="M -16 -36 Q -22 -56 -8 -54 Q -4 -60 4 -56 Q 8 -62 14 -54 Q 22 -54 16 -36 Z"
              fill="#fffefa" stroke="#c0b8a8" strokeWidth="0.6" />
            {/* puff bumps */}
            <circle cx="-8" cy="-50" r="3" fill="#fffefa" stroke="#d8d0c0" strokeWidth="0.4" />
            <circle cx="0" cy="-54" r="3" fill="#fffefa" stroke="#d8d0c0" strokeWidth="0.4" />
            <circle cx="8" cy="-50" r="3" fill="#fffefa" stroke="#d8d0c0" strokeWidth="0.4" />
          </g>
        )}
        {accessories.includes("santahat") && (
          <g filter="url(#watercolorSoft)">
            {/* white fur band */}
            <ellipse cx="0" cy="-34" rx="18" ry="3.5" fill="#fffefa" stroke="#c0b8a8" strokeWidth="0.4" />
            {/* red cone */}
            <path d="M -16 -36 Q -10 -54 14 -52 Q 18 -42 16 -36 Z" fill="#c94c4c" stroke="#7a2828" strokeWidth="0.6" />
            {/* fluffy fur dots */}
            <circle cx="-10" cy="-34" r="2" fill="#fffefa" />
            <circle cx="0" cy="-32" r="2.5" fill="#fffefa" />
            <circle cx="10" cy="-34" r="2" fill="#fffefa" />
            {/* white ball at tip */}
            <circle cx="14" cy="-52" r="3" fill="#fffefa" stroke="#c0b8a8" strokeWidth="0.4" />
          </g>
        )}
        {accessories.includes("witchhat") && (
          <g filter="url(#watercolorSoft)">
            {/* wide brim */}
            <ellipse cx="0" cy="-32" rx="24" ry="4" fill="#2a1a3a" stroke="#0a0a1a" strokeWidth="0.6" />
            {/* tall pointed cone, slightly tilted */}
            <path d="M -12 -34 Q 0 -36 12 -34 L 18 -56 Q 14 -60 8 -54 Z"
              fill="#3a1a5a" stroke="#1a0a2a" strokeWidth="0.7" />
            {/* purple band */}
            <ellipse cx="0" cy="-36" rx="13" ry="2" fill="#5a3a8a" />
            {/* gold buckle */}
            <rect x="-3" y="-37.5" width="6" height="3" fill="#edb830" stroke="#a87810" strokeWidth="0.3" />
            {/* tip curl + star */}
            <text x="20" y="-54" fontSize="3" fill="#edb830">✦</text>
          </g>
        )}
        {accessories.includes("antlers") && (
          <g filter="url(#watercolorSoft)">
            {/* left antler */}
            <path d="M -10 -32 Q -14 -42 -18 -50 M -16 -46 Q -22 -48 -24 -42 M -16 -50 Q -22 -52 -22 -46"
              stroke="#8b6342" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            {/* right antler */}
            <path d="M 10 -32 Q 14 -42 18 -50 M 16 -46 Q 22 -48 24 -42 M 16 -50 Q 22 -52 22 -46"
              stroke="#8b6342" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            {/* bows on antlers (festive) */}
            <path d="M -12 -36 Q -14 -38 -16 -36 Q -14 -34 -12 -36" fill="#c94c4c" />
            <path d="M 12 -36 Q 14 -38 16 -36 Q 14 -34 12 -36" fill="#c94c4c" />
          </g>
        )}
        {accessories.includes("starcrown") && (
          <g filter="url(#watercolorSoft)">
            {/* base */}
            <rect x="-22" y="-38" width="44" height="4" fill="#edb830" stroke="#b88810" strokeWidth="0.7" />
            {/* star points */}
            <path d="M -20 -40 L -18 -50 L -16 -40 Z" fill="#edb830" stroke="#b88810" strokeWidth="0.6" />
            <path d="M -8 -40 L -6 -54 L -4 -40 Z" fill="#edb830" stroke="#b88810" strokeWidth="0.6" />
            <path d="M -2 -40 L 0 -58 L 2 -40 Z" fill="#edb830" stroke="#b88810" strokeWidth="0.6" />
            <path d="M 4 -40 L 6 -54 L 8 -40 Z" fill="#edb830" stroke="#b88810" strokeWidth="0.6" />
            <path d="M 16 -40 L 18 -50 L 20 -40 Z" fill="#edb830" stroke="#b88810" strokeWidth="0.6" />
            {/* star tips with sparkles */}
            <circle cx="-6" cy="-54" r="1.2" fill="white" />
            <circle cx="0" cy="-58" r="1.5" fill="white" />
            <circle cx="6" cy="-54" r="1.2" fill="white" />
          </g>
        )}
        {accessories.includes("fireheadband") && (
          <g filter="url(#watercolorSoft)">
            {/* headband */}
            <path d="M -22 -32 Q 0 -38 22 -32 L 22 -28 Q 0 -34 -22 -28 Z"
              fill="#1a1a1a" stroke="#000" strokeWidth="0.5" />
            {/* flames */}
            <path d="M -16 -34 Q -14 -42 -10 -38 Q -8 -44 -4 -38 Q -2 -46 2 -40 Q 4 -46 8 -40 Q 10 -44 14 -38 Q 16 -42 18 -36"
              fill="#ff5500" stroke="#aa3300" strokeWidth="0.5" />
            {/* yellow flame core */}
            <path d="M -10 -40 Q -8 -42 -6 -40 M 0 -42 Q 2 -44 4 -42 M 8 -40 Q 10 -42 12 -40"
              stroke="#ffd140" strokeWidth="1.5" fill="none" />
          </g>
        )}
        {accessories.includes("alien") && (
          <g filter="url(#watercolorSoft)">
            {/* base band */}
            <ellipse cx="0" cy="-32" rx="13" ry="2.5" fill="#3a3a5a" />
            {/* left antenna */}
            <path d="M -10 -34 Q -16 -44 -14 -52" stroke="#3a3a5a" strokeWidth="1.5" fill="none" />
            <circle cx="-14" cy="-54" r="3.5" fill="#7c4ee0" stroke="#3a1a8a" strokeWidth="0.6" />
            {/* right antenna */}
            <path d="M 10 -34 Q 16 -44 14 -52" stroke="#3a3a5a" strokeWidth="1.5" fill="none" />
            <circle cx="14" cy="-54" r="3.5" fill="#7c4ee0" stroke="#3a1a8a" strokeWidth="0.6" />
            {/* glow on balls */}
            <circle cx="-15" cy="-55" r="1" fill="white" opacity="0.7" />
            <circle cx="13" cy="-55" r="1" fill="white" opacity="0.7" />
          </g>
        )}

        {/* === FACE ITEMS === */}
        {accessories.includes("smile") && (
          <g>
            {/* extra-big curved smile drawn over normal mouth */}
            <path d="M -10 -2 Q 0 8 10 -2" fill="none" stroke="#3a2a1a" strokeWidth="2" strokeLinecap="round" />
            {/* tooth highlight */}
            <path d="M -3 2 L -3 5 M 0 2 L 0 5 M 3 2 L 3 5" stroke="white" strokeWidth="1.5" />
          </g>
        )}
        {accessories.includes("monocle") && (
          <g filter="url(#watercolorSoft)">
            {/* monocle ring (right eye) */}
            <circle cx="8" cy="-15" r="6" fill="rgba(180,210,230,0.3)" stroke="#444" strokeWidth="1.2" />
            <circle cx="8" cy="-15" r="6" fill="none" stroke="#edb830" strokeWidth="0.6" />
            {/* chain */}
            <path d="M 14 -13 Q 18 -8 18 -2" stroke="#edb830" strokeWidth="0.7" fill="none" strokeDasharray="1,1" />
            {/* shine */}
            <path d="M 5 -18 Q 7 -19 9 -18" stroke="white" strokeWidth="0.8" fill="none" opacity="0.7" />
          </g>
        )}
        {accessories.includes("mustache") && (
          <g filter="url(#watercolorSoft)">
            {/* curly mustache below nose */}
            <path d="M -10 -4 Q -14 -2 -12 2 Q -8 0 -4 -2 Q 0 -4 4 -2 Q 8 0 12 2 Q 14 -2 10 -4 Q 6 -2 0 -3 Q -6 -2 -10 -4 Z"
              fill="#3a1a0a" stroke="#1a0a00" strokeWidth="0.5" />
            {/* curly tips */}
            <path d="M -12 -2 Q -16 -4 -14 -6" stroke="#3a1a0a" strokeWidth="1.2" fill="none" />
            <path d="M 12 -2 Q 16 -4 14 -6" stroke="#3a1a0a" strokeWidth="1.2" fill="none" />
          </g>
        )}
        {accessories.includes("eyepatch") && (
          <g filter="url(#watercolorSoft)">
            {/* patch over right eye */}
            <ellipse cx="8" cy="-16" rx="6" ry="5" fill="#1a1a1a" stroke="#000" strokeWidth="0.5" />
            {/* strap going around head */}
            <path d="M 14 -14 Q 24 -12 22 -22 Q 12 -22 4 -20" stroke="#1a1a1a" strokeWidth="1.2" fill="none" />
            {/* skull */}
            <text x="8" y="-14" fontSize="4" textAnchor="middle" fill="white">☠</text>
          </g>
        )}
        {accessories.includes("facepaint") && (
          <g filter="url(#watercolorSoft)">
            {/* warrior stripes under each eye */}
            <path d="M -12 -10 L -4 -8" stroke="#c94c4c" strokeWidth="2" strokeLinecap="round" />
            <path d="M 4 -8 L 12 -10" stroke="#c94c4c" strokeWidth="2" strokeLinecap="round" />
            {/* zigzag on cheeks */}
            <path d="M -10 -6 L -8 -4 L -6 -6" stroke="#5caa5e" strokeWidth="1.2" fill="none" />
            <path d="M 6 -6 L 8 -4 L 10 -6" stroke="#5caa5e" strokeWidth="1.2" fill="none" />
            {/* dot on forehead */}
            <circle cx="0" cy="-22" r="2" fill="#edb830" />
          </g>
        )}
        {accessories.includes("ninjamask") && (
          <g filter="url(#watercolorSoft)">
            {/* wide black band across eyes */}
            <path d="M -22 -18 Q 0 -16 22 -18 L 22 -12 Q 0 -10 -22 -12 Z"
              fill="#1a1a1a" stroke="#000" strokeWidth="0.5" />
            {/* tied tails on the side */}
            <path d="M -22 -16 Q -28 -14 -30 -8 Q -28 -10 -22 -12" fill="#1a1a1a" />
            <path d="M -28 -10 L -32 -2" stroke="#1a1a1a" strokeWidth="1.5" />
            {/* eye holes */}
            <ellipse cx="-8" cy="-15" rx="3" ry="2.5" fill="white" opacity="0.95" />
            <ellipse cx="8" cy="-15" rx="3" ry="2.5" fill="white" opacity="0.95" />
            <circle cx="-7.5" cy="-15" r="1.8" fill="#1a1a1a" />
            <circle cx="8.5" cy="-15" r="1.8" fill="#1a1a1a" />
          </g>
        )}
        {accessories.includes("starshades") && (
          <g filter="url(#watercolorSoft)">
            {/* star-shaped sunglasses (5-pointed star outline x2) */}
            <path d="M -8 -19 L -6 -14 L -1 -14 L -5 -11 L -3 -16 L -8 -13 L -8 -19 Z"
              fill="#edb830" stroke="#b88810" strokeWidth="0.5" />
            <path d="M -14 -16 L -8 -16 L -3 -13 L -8 -10 L -14 -13 Z"
              fill="rgba(50,50,80,0.85)" stroke="#1a1a3a" strokeWidth="0.6" />
            <path d="M 3 -13 L 8 -16 L 14 -16 L 14 -13 L 8 -10 Z"
              fill="rgba(50,50,80,0.85)" stroke="#1a1a3a" strokeWidth="0.6" />
            {/* star sparkles */}
            <text x="-9" y="-15" fontSize="6" fill="#edb830" textAnchor="middle">★</text>
            <text x="9" y="-15" fontSize="6" fill="#edb830" textAnchor="middle">★</text>
            {/* bridge */}
            <path d="M -3 -13 L 3 -13" stroke="#1a1a3a" strokeWidth="1" />
          </g>
        )}
        {accessories.includes("diamondeyes") && (
          <g filter="url(#watercolorSoft)">
            {/* sparkly diamond eyes */}
            <path d="M -8 -19 L -5 -16 L -8 -12 L -11 -16 Z" fill="#a0e0ff" stroke="#4080a0" strokeWidth="0.6" />
            <path d="M 8 -19 L 11 -16 L 8 -12 L 5 -16 Z" fill="#a0e0ff" stroke="#4080a0" strokeWidth="0.6" />
            {/* shines */}
            <path d="M -9 -17 L -7 -15" stroke="white" strokeWidth="0.8" />
            <path d="M 7 -17 L 9 -15" stroke="white" strokeWidth="0.8" />
            {/* sparkle around */}
            <text x="-14" y="-20" fontSize="3" fill="#a0e0ff">✦</text>
            <text x="13" y="-20" fontSize="3" fill="#a0e0ff">✦</text>
          </g>
        )}

        {/* === NECK ITEMS === */}
        {accessories.includes("leafnecklace") && (
          <g filter="url(#watercolorSoft)">
            {/* string */}
            <path d="M -16 4 Q 0 12 16 4" stroke="#7a5a3a" strokeWidth="0.8" fill="none" />
            {/* leaves */}
            <ellipse cx="-12" cy="6" rx="2.5" ry="3.5" fill="#5caa5e" transform="rotate(-30 -12 6)" />
            <ellipse cx="-4" cy="9" rx="2.5" ry="3.5" fill="#7ac87c" />
            <ellipse cx="4" cy="9" rx="2.5" ry="3.5" fill="#5caa5e" />
            <ellipse cx="12" cy="6" rx="2.5" ry="3.5" fill="#7ac87c" transform="rotate(30 12 6)" />
            {/* center leaf - bigger */}
            <ellipse cx="0" cy="11" rx="3" ry="4" fill="#3a7a3c" />
            <path d="M 0 8 L 0 14" stroke="#1a4a1c" strokeWidth="0.4" />
          </g>
        )}
        {accessories.includes("tie") && (
          <g filter="url(#watercolorSoft)">
            {/* knot */}
            <path d="M -3 4 L 3 4 L 4 8 L -4 8 Z" fill="#c94c4c" stroke="#7a2828" strokeWidth="0.5" />
            {/* tie body */}
            <path d="M -4 8 L 4 8 L 6 22 L 0 28 L -6 22 Z" fill="#c94c4c" stroke="#7a2828" strokeWidth="0.5" />
            {/* stripes */}
            <path d="M -4 12 L 4 12 M -5 18 L 5 18" stroke="#7a2828" strokeWidth="0.6" />
          </g>
        )}
        {accessories.includes("pearls") && (
          <g filter="url(#watercolorSoft)">
            {/* string */}
            <path d="M -16 4 Q 0 14 16 4" stroke="#c0b8a8" strokeWidth="0.4" fill="none" />
            {/* pearls */}
            {[-14,-10,-6,-2,2,6,10,14].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy={4 + Math.abs(x) * 0.3} r="2" fill="#fffefa" stroke="#c0b8a8" strokeWidth="0.3" />
                <circle cx={x - 0.5} cy={3.5 + Math.abs(x) * 0.3} r="0.6" fill="white" opacity="0.8" />
              </g>
            ))}
            {/* center pearl - bigger */}
            <circle cx="0" cy="12" r="2.8" fill="#fffefa" stroke="#c0b8a8" strokeWidth="0.4" />
            <circle cx="-0.8" cy="11" r="0.9" fill="white" opacity="0.9" />
          </g>
        )}
        {accessories.includes("medal") && (
          <g filter="url(#watercolorSoft)">
            {/* ribbon */}
            <path d="M -8 -2 L -4 8 L 0 8 L -4 -2 Z" fill="#c94c4c" stroke="#7a2828" strokeWidth="0.4" />
            <path d="M 8 -2 L 4 8 L 0 8 L 4 -2 Z" fill="#5a8fc7" stroke="#2a4a7a" strokeWidth="0.4" />
            {/* medal disc */}
            <circle cx="0" cy="14" r="6" fill="#edb830" stroke="#a87810" strokeWidth="0.8" />
            {/* engraved star */}
            <text x="0" y="16" fontSize="6" textAnchor="middle" fill="#a87810">★</text>
            {/* shine */}
            <path d="M -3 11 Q -2 9 0 9" stroke="white" strokeWidth="0.7" fill="none" opacity="0.7" />
          </g>
        )}
        {accessories.includes("diamond") && (
          <g filter="url(#watercolorSoft)">
            {/* chain */}
            <path d="M -14 4 Q 0 10 14 4" stroke="#c0c0c0" strokeWidth="0.5" fill="none" />
            {/* pendant diamond */}
            <path d="M 0 8 L 5 12 L 0 22 L -5 12 Z" fill="#a0e0ff" stroke="#4080a0" strokeWidth="0.7" />
            {/* facet lines */}
            <path d="M -5 12 L 5 12 M 0 8 L 0 22" stroke="#4080a0" strokeWidth="0.4" opacity="0.6" />
            {/* shine */}
            <path d="M -3 11 L -1 13" stroke="white" strokeWidth="1.2" />
            {/* sparkles */}
            <text x="-8" y="14" fontSize="2.5" fill="#a0e0ff">✦</text>
            <text x="6" y="14" fontSize="2.5" fill="#a0e0ff">✦</text>
          </g>
        )}
        {accessories.includes("amulet") && (
          <g filter="url(#watercolorSoft)">
            {/* chain */}
            <path d="M -14 4 Q 0 10 14 4" stroke="#a85ac0" strokeWidth="0.6" fill="none" />
            {/* gem holder - circle frame */}
            <circle cx="0" cy="14" r="6" fill="#5a3a8a" stroke="#3a1a5a" strokeWidth="0.8" />
            {/* purple gem center */}
            <circle cx="0" cy="14" r="3.5" fill="#a060c0" stroke="#5a30b8" strokeWidth="0.4" />
            {/* magical glow */}
            <circle cx="0" cy="14" r="1.5" fill="#e0a8ff" />
            <circle cx="-1" cy="13" r="0.6" fill="white" opacity="0.9" />
            {/* runes around frame */}
            <text x="-5" y="9" fontSize="2.5" fill="#edb830">✦</text>
            <text x="3" y="9" fontSize="2.5" fill="#edb830">✦</text>
          </g>
        )}

        {/* === HOLD ITEMS === (right hand at ~28, 22) */}
        {accessories.includes("book") && (
          <g filter="url(#watercolorSoft)">
            {/* book back cover */}
            <rect x="22" y="14" width="14" height="16" fill="#5a3a2a" stroke="#3a1a1a" strokeWidth="0.6" />
            {/* pages */}
            <rect x="23" y="15" width="13" height="14" fill="#fffafa" stroke="#c0b8a8" strokeWidth="0.4" />
            {/* page lines */}
            <path d="M 25 18 L 34 18 M 25 21 L 34 21 M 25 24 L 34 24 M 25 27 L 32 27" stroke="#c0b8a8" strokeWidth="0.3" />
            {/* spine details */}
            <rect x="22" y="14" width="2" height="16" fill="#3a1a1a" />
            <text x="23" y="22" fontSize="3" fill="#edb830">★</text>
          </g>
        )}
        {accessories.includes("pencil") && (
          <g filter="url(#watercolorSoft)">
            {/* pencil body */}
            <path d="M 22 26 L 36 12 L 38 14 L 24 28 Z" fill="#edb830" stroke="#a87810" strokeWidth="0.5" />
            {/* tip */}
            <path d="M 36 12 L 38 14 L 40 12 L 38 10 Z" fill="#3a2a1a" />
            <path d="M 38 12 L 39 12.5" stroke="#1a1a1a" strokeWidth="1.2" />
            {/* eraser */}
            <path d="M 22 26 L 24 28 L 22 30 L 20 28 Z" fill="#ff8090" stroke="#aa4050" strokeWidth="0.4" />
            {/* metal band */}
            <path d="M 23 27 L 25 29" stroke="#888" strokeWidth="1.5" />
            {/* shading */}
            <path d="M 25 25 L 35 15" stroke="#a87810" strokeWidth="0.4" />
          </g>
        )}
        {accessories.includes("leafhold") && (
          <g filter="url(#watercolorSoft)">
            {/* maple leaf */}
            <path d="M 30 12 L 32 16 L 36 14 L 34 18 L 38 20 L 33 22 L 36 26 L 30 24 L 28 30 L 26 24 L 20 26 L 23 22 L 18 20 L 22 18 L 20 14 L 24 16 L 26 12 L 28 14 Z"
              fill="#e06060" stroke="#a82828" strokeWidth="0.6" />
            {/* veins */}
            <path d="M 28 16 L 28 26" stroke="#a82828" strokeWidth="0.4" />
            <path d="M 28 18 L 32 16 M 28 20 L 34 22 M 28 18 L 24 16 M 28 20 L 22 22"
              stroke="#a82828" strokeWidth="0.3" />
            {/* stem */}
            <path d="M 28 26 L 28 32" stroke="#5a3a1a" strokeWidth="1.5" />
          </g>
        )}
        {accessories.includes("balloon") && (
          <g filter="url(#watercolorSoft)">
            {/* balloon */}
            <ellipse cx="32" cy="6" rx="6" ry="7" fill="#e06060" stroke="#a82828" strokeWidth="0.6" />
            {/* knot */}
            <path d="M 30 12 L 32 14 L 34 12 Z" fill="#a82828" />
            {/* string going to hand */}
            <path d="M 32 14 Q 30 18 28 22" stroke="#1a1a1a" strokeWidth="0.5" fill="none" />
            {/* shine */}
            <ellipse cx="29" cy="3" rx="1.5" ry="2.5" fill="white" opacity="0.6" />
          </g>
        )}
        {accessories.includes("trophy") && (
          <g filter="url(#watercolorSoft)">
            {/* base */}
            <rect x="22" y="26" width="12" height="3" fill="#a87810" />
            <rect x="24" y="22" width="8" height="4" fill="#c89018" />
            {/* cup */}
            <path d="M 22 22 Q 22 12 28 12 Q 34 12 34 22 Z" fill="#edb830" stroke="#a87810" strokeWidth="0.6" />
            {/* handles */}
            <path d="M 22 16 Q 18 14 20 18 Q 22 18 22 16" fill="#edb830" stroke="#a87810" strokeWidth="0.5" />
            <path d="M 34 16 Q 38 14 36 18 Q 34 18 34 16" fill="#edb830" stroke="#a87810" strokeWidth="0.5" />
            {/* shine */}
            <path d="M 24 14 Q 26 12 28 14" stroke="white" strokeWidth="1" opacity="0.7" />
            {/* star */}
            <text x="28" y="20" fontSize="5" textAnchor="middle" fill="#a87810">★</text>
          </g>
        )}
        {accessories.includes("lollipop") && (
          <g filter="url(#watercolorSoft)">
            {/* stick */}
            <rect x="27" y="14" width="2" height="14" fill="#fffefa" stroke="#c0b8a8" strokeWidth="0.4" />
            {/* candy circle */}
            <circle cx="28" cy="10" r="6" fill="#ff5c87" stroke="#c83870" strokeWidth="0.6" />
            {/* swirl */}
            <path d="M 28 10 Q 30 8 32 10 Q 30 12 28 12 Q 26 10 28 8 Q 30 8 32 10"
              fill="none" stroke="white" strokeWidth="0.8" />
            <path d="M 24 10 Q 26 6 30 6" stroke="white" strokeWidth="0.6" fill="none" />
            {/* shine */}
            <ellipse cx="26" cy="7" rx="1.5" ry="2" fill="white" opacity="0.6" />
          </g>
        )}
        {accessories.includes("cupcake") && (
          <g filter="url(#watercolorSoft)">
            {/* base wrapper */}
            <path d="M 22 18 L 26 28 L 32 28 L 36 18 Z" fill="#c83870" stroke="#7a2050" strokeWidth="0.5" />
            <path d="M 24 22 L 24 28 M 28 22 L 28 28 M 32 22 L 32 28" stroke="#7a2050" strokeWidth="0.4" />
            {/* frosting swirl */}
            <path d="M 22 18 Q 22 10 28 10 Q 34 10 34 18 Q 30 14 28 16 Q 26 14 22 18 Z"
              fill="#fffafa" stroke="#c0a8b8" strokeWidth="0.5" />
            {/* sprinkles */}
            <rect x="25" y="13" width="0.8" height="2" fill="#ff5c87" transform="rotate(20 25 13)" />
            <rect x="29" y="11" width="0.8" height="2" fill="#7ac87c" />
            <rect x="32" y="14" width="0.8" height="2" fill="#5a8fc7" transform="rotate(-20 32 14)" />
            {/* cherry */}
            <circle cx="28" cy="9" r="1.5" fill="#c94c4c" />
          </g>
        )}
        {accessories.includes("donut") && (
          <g filter="url(#watercolorSoft)">
            {/* donut */}
            <circle cx="28" cy="18" r="7" fill="#d8a060" stroke="#8a5028" strokeWidth="0.6" />
            <circle cx="28" cy="18" r="2.5" fill={C.face} />
            {/* pink frosting on top */}
            <path d="M 21 18 Q 21 12 28 11 Q 35 12 35 18 Q 32 14 28 16 Q 24 14 21 18 Z"
              fill="#ff9bb8" stroke="#c83870" strokeWidth="0.4" />
            {/* sprinkles */}
            <rect x="24" y="14" width="0.8" height="2" fill="#5caa5e" transform="rotate(15 24 14)" />
            <rect x="28" y="12" width="0.8" height="2" fill="#edb830" />
            <rect x="32" y="14" width="0.8" height="2" fill="#5a8fc7" transform="rotate(-15 32 14)" />
            <rect x="26" y="16" width="0.8" height="2" fill="#a060c0" transform="rotate(30 26 16)" />
          </g>
        )}
        {accessories.includes("fishingrod") && (
          <g filter="url(#watercolorSoft)">
            {/* rod */}
            <path d="M 22 26 L 40 -8" stroke="#5a3a1a" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M 22 26 L 40 -8" stroke="#8b6342" strokeWidth="0.8" strokeLinecap="round" />
            {/* reel */}
            <circle cx="24" cy="22" r="2" fill="#888" stroke="#444" strokeWidth="0.4" />
            {/* line */}
            <path d="M 40 -8 Q 42 4 38 16" stroke="#fff" strokeWidth="0.4" fill="none" opacity="0.8" />
            {/* hook + fish */}
            <path d="M 38 16 Q 40 18 38 19" stroke="#666" strokeWidth="0.5" fill="none" />
            <ellipse cx="40" cy="22" rx="3" ry="1.8" fill="#5a8fc7" stroke="#2a4a7a" strokeWidth="0.4" />
            <path d="M 43 22 L 45 20 L 45 24 Z" fill="#5a8fc7" />
          </g>
        )}
        {accessories.includes("paintbrush") && (
          <g filter="url(#watercolorSoft)">
            {/* handle */}
            <path d="M 22 26 L 36 12" stroke="#5a3a1a" strokeWidth="2" strokeLinecap="round" />
            {/* metal ferrule */}
            <path d="M 35 11 L 39 15" stroke="#888" strokeWidth="2.5" />
            {/* bristles */}
            <path d="M 38 8 L 42 12 L 39 16 L 35 12 Z" fill="#c0a080" stroke="#7a5a3a" strokeWidth="0.4" />
            <path d="M 38 8 L 42 12" stroke="#5a3a1a" strokeWidth="0.4" />
            {/* paint drip */}
            <ellipse cx="42" cy="14" rx="2" ry="3" fill="#c94c4c" opacity="0.85" />
            <ellipse cx="42" cy="18" rx="0.8" ry="1.5" fill="#c94c4c" opacity="0.7" />
          </g>
        )}
        {accessories.includes("flute") && (
          <g filter="url(#watercolorSoft)">
            {/* flute */}
            <rect x="22" y="22" width="22" height="3" fill="#c0b090" stroke="#5a4a2a" strokeWidth="0.4" rx="1.5" />
            {/* metal bands */}
            <rect x="26" y="22" width="0.6" height="3" fill="#5a4a2a" />
            <rect x="32" y="22" width="0.6" height="3" fill="#5a4a2a" />
            <rect x="38" y="22" width="0.6" height="3" fill="#5a4a2a" />
            {/* finger holes */}
            <circle cx="29" cy="23.5" r="0.5" fill="#3a2a0a" />
            <circle cx="35" cy="23.5" r="0.5" fill="#3a2a0a" />
            {/* music notes floating */}
            <text x="40" y="14" fontSize="6" fill={C.text}>♪</text>
            <text x="34" y="10" fontSize="5" fill={C.textLight}>♫</text>
          </g>
        )}
        {accessories.includes("violin") && (
          <g filter="url(#watercolorSoft)">
            {/* body */}
            <path d="M 22 26 Q 18 22 22 18 Q 26 14 30 18 Q 34 14 38 18 Q 42 22 38 26 Q 34 30 30 26 Q 26 30 22 26 Z"
              fill="#a85a2a" stroke="#5a2a0a" strokeWidth="0.7" />
            {/* center waist */}
            <path d="M 26 22 L 34 22" stroke="#5a2a0a" strokeWidth="0.5" />
            {/* neck */}
            <rect x="23" y="8" width="2" height="12" fill="#3a1a0a" stroke="#1a0a00" strokeWidth="0.3" transform="rotate(20 24 14)" />
            {/* strings */}
            <path d="M 22 26 L 27 8" stroke="#fff" strokeWidth="0.3" />
            <path d="M 24 26 L 29 8" stroke="#fff" strokeWidth="0.3" />
            <path d="M 26 26 L 31 8" stroke="#fff" strokeWidth="0.3" />
            {/* f-holes */}
            <path d="M 27 20 Q 28 22 27 24 M 33 20 Q 32 22 33 24" stroke="#3a1a0a" strokeWidth="0.5" fill="none" />
          </g>
        )}
        {accessories.includes("telescope") && (
          <g filter="url(#watercolorSoft)">
            {/* tube */}
            <rect x="20" y="14" width="20" height="5" fill="#5a3a8a" stroke="#3a1a5a" strokeWidth="0.5" rx="1" transform="rotate(-20 30 16.5)" />
            {/* far end (bigger) */}
            <ellipse cx="42" cy="9" rx="3" ry="4" fill="#3a1a5a" stroke="#1a0a3a" strokeWidth="0.5" />
            {/* near end (smaller) */}
            <ellipse cx="20" cy="22" rx="2.5" ry="3" fill="#1a0a3a" stroke="#000" strokeWidth="0.4" />
            {/* gold rings */}
            <rect x="26" y="14" width="0.8" height="5" fill="#edb830" transform="rotate(-20 26 16.5)" />
            <rect x="34" y="11" width="0.8" height="5" fill="#edb830" transform="rotate(-20 34 13.5)" />
            {/* star at end */}
            <text x="48" y="6" fontSize="3" fill="#edb830">✦</text>
          </g>
        )}
        {accessories.includes("potion") && (
          <g filter="url(#watercolorSoft)">
            {/* bottle body */}
            <path d="M 24 14 L 24 18 Q 22 22 24 26 L 32 26 Q 34 22 32 18 L 32 14 Z"
              fill="#7c4ee0" stroke="#3a1a8a" strokeWidth="0.6" opacity="0.85" />
            {/* neck */}
            <rect x="26" y="10" width="4" height="5" fill="#5a3a8a" stroke="#3a1a5a" strokeWidth="0.5" />
            {/* cork */}
            <rect x="25" y="8" width="6" height="3" fill="#a87810" stroke="#5a4810" strokeWidth="0.4" />
            {/* bubble inside */}
            <circle cx="27" cy="20" r="1" fill="white" opacity="0.6" />
            <circle cx="29" cy="22" r="1.3" fill="white" opacity="0.5" />
            {/* shine */}
            <path d="M 25 17 Q 25 21 26 23" stroke="white" strokeWidth="0.5" fill="none" opacity="0.7" />
            {/* sparkles */}
            <text x="34" y="14" fontSize="3" fill="#a060c0">✦</text>
          </g>
        )}
        {accessories.includes("sword") && (
          <g filter="url(#watercolorSoft)">
            {/* blade */}
            <path d="M 24 26 L 42 4 L 40 2 L 22 24 Z" fill="#d0d8e0" stroke="#5a6878" strokeWidth="0.5" />
            {/* center groove */}
            <path d="M 23 25 L 41 3" stroke="#888" strokeWidth="0.4" />
            {/* shine */}
            <path d="M 35 9 L 39 5" stroke="white" strokeWidth="1.2" opacity="0.7" />
            {/* crossguard */}
            <rect x="20" y="22" width="8" height="3" fill="#a87810" stroke="#5a4810" strokeWidth="0.4" transform="rotate(45 24 23.5)" />
            {/* handle */}
            <rect x="20" y="26" width="3" height="6" fill="#5a3a1a" stroke="#3a1a0a" strokeWidth="0.4" />
            {/* pommel */}
            <circle cx="21.5" cy="33" r="1.5" fill="#edb830" stroke="#a87810" strokeWidth="0.4" />
          </g>
        )}
        {accessories.includes("shield") && (
          <g filter="url(#watercolorSoft)">
            {/* shield shape */}
            <path d="M 22 12 L 38 12 L 38 22 Q 38 30 30 32 Q 22 30 22 22 Z"
              fill="#5a8fc7" stroke="#2a4a7a" strokeWidth="0.8" />
            {/* metal rim */}
            <path d="M 22 12 L 38 12 L 38 22 Q 38 30 30 32 Q 22 30 22 22 Z"
              fill="none" stroke="#888" strokeWidth="0.6" />
            {/* cross emblem */}
            <rect x="29" y="15" width="2.5" height="14" fill="#edb830" stroke="#a87810" strokeWidth="0.3" />
            <rect x="24" y="20" width="13" height="2.5" fill="#edb830" stroke="#a87810" strokeWidth="0.3" />
            {/* shine */}
            <path d="M 26 14 Q 24 18 24 22" stroke="white" strokeWidth="0.8" fill="none" opacity="0.6" />
          </g>
        )}
        {accessories.includes("phone") && (
          <g filter="url(#watercolorSoft)">
            {/* phone body */}
            <rect x="23" y="10" width="10" height="18" rx="2" fill="#1a1a2a" stroke="#000" strokeWidth="0.5" />
            {/* screen */}
            <rect x="24.5" y="12" width="7" height="13" fill="#5a8fc7" />
            {/* gradient app blocks */}
            <rect x="25" y="13" width="2" height="2" fill="#edb830" rx="0.4" />
            <rect x="28" y="13" width="2" height="2" fill="#5caa5e" rx="0.4" />
            <rect x="25" y="16" width="2" height="2" fill="#c94c4c" rx="0.4" />
            <rect x="28" y="16" width="2" height="2" fill="#a060c0" rx="0.4" />
            {/* home button */}
            <circle cx="28" cy="26.5" r="0.8" fill="#3a3a4a" stroke="#888" strokeWidth="0.3" />
            {/* shine */}
            <path d="M 24.5 12 L 26 14" stroke="white" strokeWidth="0.5" opacity="0.4" />
          </g>
        )}
        {accessories.includes("camera") && (
          <g filter="url(#watercolorSoft)">
            {/* body */}
            <rect x="20" y="14" width="18" height="12" rx="2" fill="#2a2a3a" stroke="#000" strokeWidth="0.5" />
            {/* top viewfinder bump */}
            <rect x="26" y="11" width="6" height="3" fill="#1a1a2a" />
            {/* lens */}
            <circle cx="29" cy="20" r="4.5" fill="#1a1a2a" stroke="#444" strokeWidth="0.6" />
            <circle cx="29" cy="20" r="3" fill="#5a8fc7" stroke="#222" strokeWidth="0.4" />
            <circle cx="29" cy="20" r="1.5" fill="#1a1a2a" />
            {/* shine on lens */}
            <circle cx="27.5" cy="18.5" r="0.8" fill="white" opacity="0.7" />
            {/* flash */}
            <rect x="22" y="15" width="2" height="2" fill="#edb830" />
            {/* shutter button */}
            <circle cx="36" cy="13" r="0.8" fill="#c94c4c" />
          </g>
        )}

        {/* === BACK ITEMS === (anchored on back, behind monkey approximately) */}
        {accessories.includes("leafback") && (
          <g filter="url(#watercolorSoft)">
            {/* leaves bundled */}
            <ellipse cx="-22" cy="6" rx="5" ry="8" fill="#5caa5e" stroke="#3a7a3c" strokeWidth="0.5" transform="rotate(-30 -22 6)" />
            <ellipse cx="-26" cy="10" rx="5" ry="8" fill="#7ac87c" stroke="#3a7a3c" strokeWidth="0.5" transform="rotate(-50 -26 10)" />
            <ellipse cx="-20" cy="14" rx="5" ry="8" fill="#3a7a3c" stroke="#1a4a1c" strokeWidth="0.5" transform="rotate(-10 -20 14)" />
            {/* veins */}
            <path d="M -22 0 L -22 12" stroke="#1a4a1c" strokeWidth="0.4" transform="rotate(-30 -22 6)" />
          </g>
        )}
        {accessories.includes("jetpack") && (
          <g filter="url(#watercolorSoft)">
            {/* tank */}
            <rect x="-30" y="-2" width="6" height="20" rx="2" fill="#5a8fc7" stroke="#2a4a7a" strokeWidth="0.6" />
            {/* second tank */}
            <rect x="-20" y="-2" width="6" height="20" rx="2" fill="#5a8fc7" stroke="#2a4a7a" strokeWidth="0.6" />
            {/* connector */}
            <rect x="-24" y="6" width="4" height="3" fill="#444" />
            {/* nozzles */}
            <rect x="-29" y="18" width="4" height="2" fill="#444" />
            <rect x="-19" y="18" width="4" height="2" fill="#444" />
            {/* flames */}
            <path d="M -27 20 Q -28 26 -25 24 Q -23 28 -22 22" fill="#ff5500" stroke="#aa2200" strokeWidth="0.4" />
            <path d="M -17 20 Q -18 26 -15 24 Q -13 28 -12 22" fill="#ff5500" stroke="#aa2200" strokeWidth="0.4" />
            <path d="M -25 22 Q -23 26 -22 22" stroke="#ffd140" strokeWidth="1.5" fill="none" />
            <path d="M -15 22 Q -13 26 -12 22" stroke="#ffd140" strokeWidth="1.5" fill="none" />
          </g>
        )}
        {accessories.includes("angelwings") && (
          <g filter="url(#watercolorSoft)">
            {/* left wing */}
            <path d="M -16 0 Q -32 -10 -36 6 Q -32 18 -22 14 Q -18 8 -16 0 Z"
              fill="#fffefa" stroke="#c0c8d8" strokeWidth="0.6" />
            {/* feather lines */}
            <path d="M -32 -4 Q -28 4 -22 6" stroke="#c0c8d8" strokeWidth="0.4" fill="none" />
            <path d="M -32 4 Q -28 8 -22 8" stroke="#c0c8d8" strokeWidth="0.4" fill="none" />
            <path d="M -30 10 Q -26 12 -22 12" stroke="#c0c8d8" strokeWidth="0.4" fill="none" />
            {/* right wing */}
            <path d="M 16 0 Q 32 -10 36 6 Q 32 18 22 14 Q 18 8 16 0 Z"
              fill="#fffefa" stroke="#c0c8d8" strokeWidth="0.6" />
            <path d="M 32 -4 Q 28 4 22 6" stroke="#c0c8d8" strokeWidth="0.4" fill="none" />
            <path d="M 32 4 Q 28 8 22 8" stroke="#c0c8d8" strokeWidth="0.4" fill="none" />
            <path d="M 30 10 Q 26 12 22 12" stroke="#c0c8d8" strokeWidth="0.4" fill="none" />
            {/* glow shimmer */}
            <ellipse cx="-26" cy="6" rx="3" ry="6" fill="#fff" opacity="0.3" />
            <ellipse cx="26" cy="6" rx="3" ry="6" fill="#fff" opacity="0.3" />
          </g>
        )}
        {accessories.includes("demonwings") && (
          <g filter="url(#watercolorSoft)">
            {/* left bat wing */}
            <path d="M -16 0 Q -34 -8 -38 6 L -34 6 L -36 12 L -30 10 L -32 16 L -26 12 L -22 14 Q -18 8 -16 0 Z"
              fill="#3a1a3a" stroke="#1a0a1a" strokeWidth="0.6" />
            {/* membrane lines */}
            <path d="M -16 0 Q -22 4 -26 12 M -16 0 Q -28 4 -32 16" stroke="#5a2a5a" strokeWidth="0.4" fill="none" />
            {/* right bat wing */}
            <path d="M 16 0 Q 34 -8 38 6 L 34 6 L 36 12 L 30 10 L 32 16 L 26 12 L 22 14 Q 18 8 16 0 Z"
              fill="#3a1a3a" stroke="#1a0a1a" strokeWidth="0.6" />
            <path d="M 16 0 Q 22 4 26 12 M 16 0 Q 28 4 32 16" stroke="#5a2a5a" strokeWidth="0.4" fill="none" />
          </g>
        )}
        {accessories.includes("rainbowcape") && (
          <g filter="url(#watercolorSoft)">
            {/* rainbow stripes */}
            <path d="M -20 0 Q -34 12 -34 30 L -28 28 Q -28 14 -16 4 Z" fill="#e06060" stroke="#a82828" strokeWidth="0.4" />
            <path d="M -16 4 Q -28 14 -28 28 L -22 26 Q -22 16 -12 8 Z" fill="#ff8030" />
            <path d="M -12 8 Q -22 16 -22 26 L -16 24 Q -16 18 -8 12 Z" fill="#edb830" />
            <path d="M -8 12 Q -16 18 -16 24 L -10 22 Q -10 18 -4 14 Z" fill="#5caa5e" />
            <path d="M -4 14 Q -10 18 -10 22 L -2 18 Z" fill="#5a8fc7" />
            {/* right side mirror */}
            <path d="M 20 0 Q 34 12 34 30 L 28 28 Q 28 14 16 4 Z" fill="#e06060" stroke="#a82828" strokeWidth="0.4" />
            <path d="M 16 4 Q 28 14 28 28 L 22 26 Q 22 16 12 8 Z" fill="#ff8030" />
            <path d="M 12 8 Q 22 16 22 26 L 16 24 Q 16 18 8 12 Z" fill="#edb830" />
            <path d="M 8 12 Q 16 18 16 24 L 10 22 Q 10 18 4 14 Z" fill="#5caa5e" />
            <path d="M 4 14 Q 10 18 10 22 L 2 18 Z" fill="#5a8fc7" />
          </g>
        )}
        {accessories.includes("dragoncape") && (
          <g filter="url(#watercolorSoft)">
            {/* left dragon wing - membranous */}
            <path d="M -14 -2 Q -36 -4 -40 12 L -36 14 L -38 20 L -32 18 L -34 24 L -28 22 Q -22 16 -14 -2 Z"
              fill="#5a3a8a" stroke="#3a1a5a" strokeWidth="0.7" />
            {/* wing bones */}
            <path d="M -14 -2 Q -28 4 -38 14 M -14 -2 Q -24 6 -34 22" stroke="#a060c0" strokeWidth="0.5" fill="none" />
            {/* spikes on top edge */}
            <path d="M -28 0 L -26 -4 L -24 0 Z M -34 4 L -32 0 L -30 4 Z" fill="#3a1a5a" />
            {/* right wing */}
            <path d="M 14 -2 Q 36 -4 40 12 L 36 14 L 38 20 L 32 18 L 34 24 L 28 22 Q 22 16 14 -2 Z"
              fill="#5a3a8a" stroke="#3a1a5a" strokeWidth="0.7" />
            <path d="M 14 -2 Q 28 4 38 14 M 14 -2 Q 24 6 34 22" stroke="#a060c0" strokeWidth="0.5" fill="none" />
            <path d="M 28 0 L 26 -4 L 24 0 Z M 34 4 L 32 0 L 30 4 Z" fill="#3a1a5a" />
            {/* glow */}
            <ellipse cx="-30" cy="10" rx="3" ry="6" fill="#a060c0" opacity="0.4" />
            <ellipse cx="30" cy="10" rx="3" ry="6" fill="#a060c0" opacity="0.4" />
          </g>
        )}
        {accessories.includes("bowarrow") && (
          <g filter="url(#watercolorSoft)">
            {/* bow arc on the back */}
            <path d="M -32 -4 Q -38 12 -32 28" stroke="#8b6342" strokeWidth="2.5" fill="none" />
            {/* string */}
            <path d="M -32 -4 L -32 28" stroke="#fff" strokeWidth="0.4" />
            {/* arrow */}
            <path d="M -34 12 L -22 12" stroke="#5a3a1a" strokeWidth="1.2" />
            {/* arrowhead */}
            <path d="M -22 12 L -18 9 L -18 15 Z" fill="#888" stroke="#444" strokeWidth="0.4" />
            {/* fletching */}
            <path d="M -34 12 L -36 9 L -36 15 Z" fill="#c94c4c" />
            {/* bow tips */}
            <circle cx="-32" cy="-4" r="1" fill="#5a3a1a" />
            <circle cx="-32" cy="28" r="1" fill="#5a3a1a" />
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

        {/* Pet companions - rendered ON TOP of water. Multi-pet: equipped pet on right, others orbit at varied positions. */}
        {(() => {
          // Build the pet list. Equipped pet always shown first/right. Other owned pets fan out.
          const allPets = [];
          if (pet) allPets.push(pet);
          if (ownedPets && ownedPets.length > 1) {
            for (const id of ownedPets) {
              if (id !== pet && !allPets.includes(id)) allPets.push(id);
            }
          }
          // Position table: index → { side, scale, dx, dy }
          // index 0 = main pet at right; 1 = left; 2 = back-right (smaller); 3 = back-left; 4+ = behind
          const positions = [
            { side: "right", scale: 1.0, dx: 0,   dy: 0 },
            { side: "left",  scale: 1.0, dx: 0,   dy: 2 },
            { side: "right", scale: 0.75, dx: 18, dy: -20 },
            { side: "left",  scale: 0.75, dx: -18,dy: -20 },
            { side: "right", scale: 0.65, dx: -8, dy: 18 },
            { side: "left",  scale: 0.65, dx: 8,  dy: 18 },
            { side: "right", scale: 0.6,  dx: 32, dy: 4  },
            { side: "left",  scale: 0.6,  dx: -32,dy: 4  },
            { side: "right", scale: 0.5,  dx: 26, dy: -32 },
          ];
          return allPets.map((petId, i) => {
            const p = positions[Math.min(i, positions.length - 1)];
            const accs = (petId === pet) ? petAccessories : []; // only main pet shows accessories for now
            return (
              <g key={petId} transform={`translate(${p.dx}, ${p.dy}) scale(${p.scale})`}>
                <PetSVG petId={petId} side={p.side} petAccessories={accs} />
              </g>
            );
          });
        })()}

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
/* ─── SPEECH BUBBLE ─── floats above a creature delivering a message */
function SpeechBubble({ text }) {
  return (
    <div style={{
      background: C.card,
      color: C.text,
      padding: "8px 12px",
      borderRadius: 14,
      boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
      border: `2px solid ${C.gold}50`,
      fontSize: 12,
      fontFamily: "'Patrick Hand', cursive",
      fontWeight: 600,
      maxWidth: 220,
      minWidth: 80,
      textAlign: "center",
      animation: "speechBubblePop 0.5s ease",
      position: "relative",
      whiteSpace: "normal",
      lineHeight: 1.3,
    }}>
      <style>{`
        @keyframes speechBubblePop {
          0% { opacity: 0; transform: translateY(8px) scale(0.85); }
          60% { transform: translateY(-2px) scale(1.05); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {text}
      {/* Triangle pointing down */}
      <div style={{
        position: "absolute",
        bottom: -6,
        left: "50%",
        transform: "translateX(-50%)",
        width: 0,
        height: 0,
        borderLeft: "7px solid transparent",
        borderRight: "7px solid transparent",
        borderTop: `7px solid ${C.card}`,
        filter: `drop-shadow(0 1px 0 ${C.gold}50)`,
      }} />
    </div>
  );
}

function Penguin({ startX, startY, baseSize = 22, speed = 1, variant = 0, paused, message }) {
  const [pos, setPos] = useState({ x: startX, y: startY });
  const [waddle, setWaddle] = useState(0);
  const [direction, setDirection] = useState(variant % 2 === 0 ? 1 : -1); // 1 = right, -1 = left
  const frameRef = useRef(0);
  const pausedRef = useRef(false);
  const lastTimeRef = useRef(performance.now());
  // baseY is the current "lane" — changes when the penguin wraps off-screen so they
  // don't always traverse on the same horizontal line (more natural variation)
  const stateRef = useRef({ x: startX, y: startY, baseY: startY, dir: variant % 2 === 0 ? 1 : -1, t: variant * 100 });

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
        // Wrap around the screen — fly fully off-screen, then re-enter from the opposite side.
        // Pick a fresh vertical "lane" each time they wrap so flights look varied, not on rails.
        if (s.x > 112) {
          s.x = -12;
          s.baseY = 8 + Math.random() * 18; // 8-26% from top (sky/upper area)
        } else if (s.x < -12) {
          s.x = 112;
          s.baseY = 8 + Math.random() * 18;
        }
        // Occasional random direction reversal (mid-flight) so they're not too predictable
        if (Math.random() < 0.001) { s.dir = -s.dir; setDirection(s.dir); }
        // Slight vertical drift around the current lane
        const newY = s.baseY + Math.sin(s.t * 0.4 + variant) * 1.5;
        setPos({ x: s.x, y: newY });
        // Waddle (side-to-side wobble)
        setWaddle(Math.sin(s.t * 6) * 6);
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [startY, speed, variant]);

  // Hide bubble while off-screen (would float in the void otherwise)
  const onScreen = pos.x > -2 && pos.x < 102;

  return (
    <>
      {message && onScreen && (
        <div style={{
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: "translate(-50%, calc(-100% - 22px))",
          zIndex: 30,
          pointerEvents: "none",
        }}>
          <SpeechBubble text={message} />
        </div>
      )}
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
    </>
  );
}

/* ─── DRAGON ─── rainbow-mode counterpart to the penguin, watercolor style */
const DRAGON_PALETTES = [
  { body: "#ff8aa6", belly: "#ffd5e0", wing: "#ff5c87", spike: "#d83870", flame: "#ff8060" }, // pink
  { body: "#a988ee", belly: "#dccaff", wing: "#7a4ee0", spike: "#5a30b8", flame: "#c080ff" }, // purple
  { body: "#6cc0ee", belly: "#c0e2f5", wing: "#3a8fcc", spike: "#1f6ca8", flame: "#80d0ff" }, // blue
  { body: "#5acaa0", belly: "#bce8d4", wing: "#2ea878", spike: "#1a8456", flame: "#a8e0c4" }, // green
  { body: "#ffc850", belly: "#fff0c0", wing: "#e0a020", spike: "#a87010", flame: "#ff8030" }, // gold/orange
];

function Dragon({ startX, startY, baseSize = 26, speed = 1, variant = 0, paused, message }) {
  const [pos, setPos] = useState({ x: startX, y: startY });
  const [flap, setFlap] = useState(0);
  const [direction, setDirection] = useState(variant % 2 === 0 ? 1 : -1);
  const frameRef = useRef(0);
  const pausedRef = useRef(false);
  const lastTimeRef = useRef(performance.now());
  // baseY changes when the dragon wraps off-screen (fresh "altitude" each pass)
  const stateRef = useRef({ x: startX, y: startY, baseY: startY, dir: variant % 2 === 0 ? 1 : -1, t: variant * 100 });

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
        s.x += s.dir * speed * 14 * dt; // slightly faster than penguins
        // Wrap around the screen — fly fully off-screen, then re-enter from the other side
        // with a new vertical lane so each pass looks different
        if (s.x > 112) {
          s.x = -12;
          s.baseY = 6 + Math.random() * 22; // 6-28% from top
        } else if (s.x < -12) {
          s.x = 112;
          s.baseY = 6 + Math.random() * 22;
        }
        // Occasional mid-flight reversal for variety
        if (Math.random() < 0.001) { s.dir = -s.dir; setDirection(s.dir); }
        // Float-like vertical drift around the current lane
        const newY = s.baseY + Math.sin(s.t * 0.6 + variant) * 2.5;
        setPos({ x: s.x, y: newY });
        // Wing flap
        setFlap(Math.sin(s.t * 7) * 1);
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [startY, speed, variant]);

  const palette = DRAGON_PALETTES[variant % DRAGON_PALETTES.length];
  // Wing rotation based on flap
  const wingRot = flap * 25;
  const onScreen = pos.x > -2 && pos.x < 102;

  return (
    <>
      {message && onScreen && (
        <div style={{
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: "translate(-50%, calc(-100% - 26px))",
          zIndex: 30,
          pointerEvents: "none",
        }}>
          <SpeechBubble text={message} />
        </div>
      )}
      <div style={{
        position: "absolute", left: `${pos.x}%`, top: `${pos.y}%`,
        transform: `translate(-50%, -50%) scaleX(${direction}) rotate(${flap * 2}deg)`,
        transition: "filter 0.3s",
        filter: paused ? "saturate(0.6) brightness(0.95)" : "drop-shadow(0 2px 4px rgba(120,40,160,0.25))",
        pointerEvents: "none", zIndex: 6,
      }}>
      <svg width={baseSize * 1.6} height={baseSize * 1.3} viewBox="-30 -28 60 56" style={{ overflow: "visible" }}>
        {/* Tail - curls behind */}
        <path d={`M -16 8 Q -26 6 -28 -2 Q -26 -8 -22 -6 Q -20 -2 -18 4`}
          fill={palette.body} filter="url(#watercolorSoft)" />
        {/* Tail tip - little spade */}
        <path d="M -28 -2 L -32 -6 L -30 0 L -32 2 Z" fill={palette.flame} filter="url(#watercolorSoft)" />
        {/* Back wing (behind body, dark) */}
        <g transform={`translate(-2, -2) rotate(${-wingRot} -2 -2)`}>
          <path d="M 0 0 Q -8 -16 -2 -22 Q 4 -18 6 -10 Q 4 -4 0 0 Z"
            fill={palette.spike} opacity="0.7" filter="url(#watercolorSoft)" />
          <path d="M 0 0 Q -2 -10 2 -16" stroke={palette.flame} strokeWidth="0.8" fill="none" opacity="0.5" />
        </g>
        {/* Body */}
        <ellipse cx="0" cy="4" rx="13" ry="14" fill={palette.body} filter="url(#watercolorSoft)" />
        {/* Belly highlight */}
        <ellipse cx="0" cy="8" rx="8" ry="10" fill={palette.belly} filter="url(#watercolorSoft)" opacity="0.85" />
        {/* Belly scales (subtle stripes) */}
        <path d="M -5 4 Q 0 5 5 4" stroke={palette.belly} strokeWidth="0.5" fill="none" opacity="0.4" />
        <path d="M -5 8 Q 0 9 5 8" stroke={palette.belly} strokeWidth="0.5" fill="none" opacity="0.4" />
        <path d="M -5 12 Q 0 13 5 12" stroke={palette.belly} strokeWidth="0.5" fill="none" opacity="0.4" />
        {/* Front wing (bigger, in front of body) */}
        <g transform={`translate(2, -2) rotate(${wingRot} 2 -2)`}>
          <path d="M 0 0 Q 14 -18 6 -24 Q 0 -22 -2 -14 Q 0 -6 0 0 Z"
            fill={palette.wing} filter="url(#watercolorSoft)" />
          {/* Wing membrane shadow */}
          <path d="M 0 0 Q 8 -10 6 -20" stroke={palette.spike} strokeWidth="0.6" fill="none" opacity="0.4" />
          <path d="M 0 0 Q 4 -6 -1 -12" stroke={palette.spike} strokeWidth="0.5" fill="none" opacity="0.3" />
          {/* Wing highlight */}
          <ellipse cx="4" cy="-12" rx="3" ry="5" fill={palette.belly} opacity="0.4" />
        </g>
        {/* Back spikes (small triangles down the spine) */}
        <path d="M -8 -8 L -6 -12 L -4 -8 Z" fill={palette.spike} filter="url(#watercolorSoft)" />
        <path d="M -2 -10 L 0 -14 L 2 -10 Z" fill={palette.spike} filter="url(#watercolorSoft)" />
        <path d="M 4 -8 L 6 -12 L 8 -8 Z" fill={palette.spike} filter="url(#watercolorSoft)" />
        {/* Head */}
        <ellipse cx="6" cy="-6" rx="9" ry="8" fill={palette.body} filter="url(#watercolorSoft)" />
        {/* Snout */}
        <ellipse cx="13" cy="-4" rx="5" ry="4" fill={palette.body} filter="url(#watercolorSoft)" />
        {/* Snout highlight */}
        <ellipse cx="13" cy="-3" rx="3" ry="2" fill={palette.belly} opacity="0.6" />
        {/* Nostril */}
        <ellipse cx="15" cy="-5" rx="0.6" ry="0.8" fill="#3a1a2a" />
        {/* Tiny flame puff */}
        <ellipse cx="20" cy="-4" rx="2.5" ry="1.5" fill={palette.flame} opacity="0.8" filter="url(#watercolorSoft)" />
        <ellipse cx="22" cy="-4" rx="1.5" ry="1" fill="#ffe080" opacity="0.7" />
        {/* Horns */}
        <path d="M 2 -12 Q 0 -18 4 -16 Z" fill={palette.spike} />
        <path d="M 8 -13 Q 8 -19 11 -16 Z" fill={palette.spike} />
        {/* Eye */}
        <ellipse cx="6" cy="-7" rx="2.2" ry="2.2" fill="white" />
        <ellipse cx="6.5" cy="-7" rx="1.4" ry="1.6" fill="#1a1a1a" />
        <circle cx="7" cy="-7.5" r="0.4" fill="white" />
        {/* Cheek blush */}
        <circle cx="3" cy="-4" r="1.5" fill={palette.flame} opacity="0.4" />
        {/* Sparkle dots around dragon */}
        <text x="-22" y="-14" fontSize="4" fill={palette.flame}>✦</text>
        <text x="18" y="-18" fontSize="3" fill={palette.flame}>✧</text>
      </svg>
    </div>
    </>
  );
}

/* ─── PENGUIN FLOCK ─── handles a group of penguins, pauses when monkeys hovered */
function PenguinFlock({ activeMsg }) {
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
          message={activeMsg && activeMsg.idx === i ? activeMsg.text : null}
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

/* ─── DRAGON FLOCK ─── rainbow-mode counterpart to the penguin flock */
function DragonFlock({ activeMsg }) {
  const { anyHovering } = useContext(HoverContext);
  const dragons = [
    { x: 12, y: 18, size: 28, speed: 0.9, variant: 0 },
    { x: 30, y: 14, size: 24, speed: 1.1, variant: 1 },
    { x: 75, y: 16, size: 30, speed: 0.8, variant: 2 },
    { x: 88, y: 22, size: 26, speed: 1.0, variant: 3 },
    { x: 45, y: 12, size: 25, speed: 1.2, variant: 4 },
  ];
  return (
    <>
      {dragons.map((d, i) => (
        <Dragon key={i}
          startX={d.x} startY={d.y}
          baseSize={d.size} speed={d.speed} variant={d.variant}
          paused={anyHovering}
          message={activeMsg && activeMsg.idx === i ? activeMsg.text : null}
        />
      ))}
      {anyHovering && (
        <div style={{
          position: "absolute", top: "8%", left: "50%", transform: "translateX(-50%)",
          fontSize: 12, color: C.textLight, opacity: 0.5, pointerEvents: "none",
          fontFamily: "'Patrick Hand', cursive", zIndex: 7,
          animation: "shhFade 0.4s ease",
        }}>
          <style>{`@keyframes shhFade { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 0.5; transform: translateX(-50%) translateY(0); } }`}</style>
          🐲 ...the dragons are watching
        </div>
      )}
    </>
  );
}

/* ─── BIRD FLOCK ─── auto-switches between penguins and dragons based on theme.
   Orchestrates the speech-bubble messages — picks a random creature every 14-22s
   to deliver a message from getMessage(), if one is available.
*/
function BirdFlock({ getMessage }) {
  const isRainbow = _themeMode === "rainbow";
  const [activeMsg, setActiveMsg] = useState(null);
  const getMessageRef = useRef(getMessage);
  getMessageRef.current = getMessage;

  useEffect(() => {
    let nextTimeout, hideTimeout;
    const cycle = () => {
      const fn = getMessageRef.current;
      const text = fn ? fn() : null;
      if (text) {
        // 5 creatures - pick one at random to deliver
        setActiveMsg({ idx: Math.floor(Math.random() * 5), text });
        hideTimeout = setTimeout(() => setActiveMsg(null), 6500);
      }
      // Next message in 14-22 seconds
      nextTimeout = setTimeout(cycle, 14000 + Math.random() * 8000);
    };
    // First message after 5 seconds
    nextTimeout = setTimeout(cycle, 5000);
    return () => {
      if (nextTimeout) clearTimeout(nextTimeout);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, []);

  return isRainbow
    ? <DragonFlock activeMsg={activeMsg} />
    : <PenguinFlock activeMsg={activeMsg} />;
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
function QuizGame({ studentId, studentName, quiz, onClose, onComplete, onShop }) {
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
  // Track which questions were answered wrong, with the chosen answer
  const [wrongAnswers, setWrongAnswers] = useState([]);

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
      // Record this wrong answer for the summary
      setWrongAnswers(w => [...w, {
        questionIdx: currentIdx,
        question: currentQ.q,
        chosen: idx,
        chosenText: currentQ.options[idx],
        correct: currentQ.correct,
        correctText: currentQ.options[currentQ.correct],
      }]);
    }
  };

  const nextQuestion = () => {
    if (isLast) {
      // Calculate proportional reward
      const pct = score / questions.length;
      const earned = Math.round(totalReward * pct);
      setFinished(true);
      if (!rewarded) {
        setRewarded(true);
        if (earned > 0) SFX.reward();
        onComplete({ pointsEarned: earned, scoreCorrect: score, scoreTotal: questions.length });
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
        <div style={{ ...modalCardStyle, textAlign: "center", width: 540, maxHeight: "92vh", overflow: "auto", padding: "24px 28px" }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 4px", fontSize: 28 }}>🎉 Quiz Complete!</h2>
          <p style={{ color: C.textLight, fontSize: 16, margin: "0 0 14px" }}>{studentName} · {quiz?.name}</p>

          {/* Score row */}
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ background: `${C.gold}15`, borderRadius: 12, padding: "10px 16px", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.5 }}>Score</div>
              <div style={{ fontSize: 22, color: C.gold, fontWeight: 700 }}>{score} / {questions.length}</div>
            </div>
            <div style={{ background: `${pct >= 80 ? C.green : pct >= 50 ? C.gold : C.accent}15`, borderRadius: 12, padding: "10px 16px", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.5 }}>Accuracy</div>
              <div style={{ fontSize: 22, color: pct >= 80 ? C.green : pct >= 50 ? C.gold : C.accent, fontWeight: 700 }}>{pct}%</div>
            </div>
            <div style={{ background: `${C.accent}15`, borderRadius: 12, padding: "10px 16px", minWidth: 100 }}>
              <div style={{ fontSize: 11, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.5 }}>Earned</div>
              <div style={{ fontSize: 22, color: C.accent, fontWeight: 700 }}>+{earned} ★</div>
            </div>
          </div>

          <div style={{ fontSize: 18, color: pct >= 80 ? C.green : pct >= 50 ? C.gold : C.accent, fontWeight: 700, marginBottom: 14 }}>
            {pct === 100 ? "Perfect score! 🌟" : pct >= 80 ? "Amazing!" : pct >= 50 ? "Good job!" : "Keep practicing!"}
          </div>

          {/* Wrong answers review */}
          {wrongAnswers.length > 0 && (
            <div style={{ textAlign: "left", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, color: C.text, margin: "0 0 8px" }}>📝 Review ({wrongAnswers.length} wrong)</h3>
              <div style={{ maxHeight: 220, overflow: "auto", padding: "0 4px" }}>
                {wrongAnswers.map((w, i) => (
                  <div key={i} style={{
                    background: `${C.accent}10`, border: `1px solid ${C.accent}30`,
                    borderRadius: 10, padding: "10px 12px", marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 13, color: C.textLight, marginBottom: 4 }}>Q{w.questionIdx + 1}</div>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>{w.question}</div>
                    <div style={{ fontSize: 13, color: C.accentDark, marginBottom: 2 }}>
                      ❌ You chose: <strong>{w.chosenText}</strong>
                    </div>
                    <div style={{ fontSize: 13, color: C.green }}>
                      ✅ Correct: <strong>{w.correctText}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {wrongAnswers.length === 0 && pct === 100 && (
            <div style={{ background: `${C.green}15`, padding: "12px", borderRadius: 12, marginBottom: 16, color: C.green, fontWeight: 700 }}>
              🌟 You aced every question!
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            {earned > 0 && onShop && (
              <button onClick={() => { onShop(); onClose(); }}
                style={{ ...primaryBtnStyle, background: `linear-gradient(135deg, ${C.green}, #4a8a4c)` }}>
                🍱 Buy Pet Food
              </button>
            )}
            <button onClick={onClose} style={primaryBtnStyle}>Back to Hot Spring</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={modalBackdropStyle}>
      <div style={{
        ...modalCardStyle,
        width: "min(960px, 96vw)",
        maxWidth: "96vw",
        height: "min(720px, 94vh)",
        maxHeight: "94vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "28px 36px",
      }}>
        {/* Hawk overlay */}
        {showHawk && <HawkAttack onComplete={() => setShowHawk(false)} />}
        {/* Food overlay */}
        {showFood && <FoodReward onComplete={() => setShowFood(false)} />}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 28 }}>📚 Quiz Time!</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 16 }}>
              Question {currentIdx + 1} of {questions.length} · Score: {score}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 26, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
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
        <div style={{ textAlign: "center", marginBottom: 18, height: 120, flexShrink: 0 }}>
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
              size={110}
              mood={showFood ? "eating" : monkeyHappy ? "excited" : monkeyShake ? "neutral" : "happy"}
              variant={5}
            />
          </div>
        </div>

        {/* Quiz body — centered question + options + result message */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", justifyContent: "center",
          gap: 18, minHeight: 0,
        }}>
          {/* Question */}
          <div style={{
            background: `${C.snow1}80`, borderRadius: 18, padding: "26px 30px",
            fontSize: 28, color: C.text, fontWeight: 600, textAlign: "center",
            minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1.4, wordBreak: "break-word",
          }}>
            {currentQ.q}
          </div>

          {/* Options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                    padding: "20px 22px", borderRadius: 16, border: "none",
                    background: bg, color: textColor,
                    fontFamily: "'Patrick Hand', cursive", fontSize: 22, fontWeight: 700,
                    cursor: showResult ? "default" : "pointer",
                    transition: "all 0.3s, transform 0.15s",
                    boxShadow: isSelected ? `0 0 0 3px ${C.text}` : "0 3px 8px rgba(0,0,0,0.1)",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                    minHeight: 72,
                    lineHeight: 1.3,
                    wordBreak: "break-word",
                  }}
                  onMouseEnter={e => !showResult && (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseLeave={e => !showResult && (e.currentTarget.style.transform = "translateY(0)")}>
                  <span style={{
                    width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    fontSize: 20, fontWeight: 700,
                  }}>{"ABCD"[idx]}</span>
                  <span style={{ flex: 1 }}>{opt}</span>
                  {showResult && isCorrect && <span style={{ fontSize: 28, flexShrink: 0 }}>✓</span>}
                  {showResult && isSelected && !isCorrect && <span style={{ fontSize: 28, flexShrink: 0 }}>✗</span>}
                </button>
              );
            })}
          </div>

          {/* Next/result message */}
          {showResult && (
            <div style={{ textAlign: "center" }}>
              <p style={{
                color: selected === currentQ.correct ? C.green : C.accent,
                fontSize: 22, fontWeight: 700, margin: "0 0 14px",
              }}>
                {selected === currentQ.correct
                  ? "🎉 Correct! Your monkey gets a treat!"
                  : "🦅 Yikes! A hawk attacked your monkey!"}
              </p>
              <button onClick={nextQuestion} disabled={showHawk || showFood}
                style={{ ...primaryBtnStyle, opacity: (showHawk || showFood) ? 0.5 : 1, fontSize: 18, padding: "12px 28px" }}>
                {isLast ? "Finish Quiz" : "Next Question →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// modalBackdropStyle is theme-independent (just a dark overlay)
const modalBackdropStyle = {
  position: "fixed", inset: 0, zIndex: 2000, display: "flex",
  alignItems: "center", justifyContent: "center",
  background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
};
// These styles use getters that read live C values, so they update when theme changes.
// Using Object.defineProperty so spread/destructure works properly.
const modalCardStyle = {};
Object.defineProperties(modalCardStyle, {
  background: { get: () => C.card, enumerable: true, configurable: true },
  borderRadius: { value: 24, enumerable: true, configurable: true },
  padding: { value: "28px 32px", enumerable: true, configurable: true },
  width: { value: 420, enumerable: true, configurable: true },
  maxWidth: { value: "95vw", enumerable: true, configurable: true },
  boxShadow: { value: "0 24px 64px rgba(0,0,0,0.25)", enumerable: true, configurable: true },
  border: { get: () => `2px solid ${C.gold}30`, enumerable: true, configurable: true },
  fontFamily: { value: "'Patrick Hand', cursive", enumerable: true, configurable: true },
});

const primaryBtnStyle = {};
Object.defineProperties(primaryBtnStyle, {
  padding: { value: "12px 28px", enumerable: true, configurable: true },
  borderRadius: { value: 14, enumerable: true, configurable: true },
  border: { value: "none", enumerable: true, configurable: true },
  cursor: { value: "pointer", enumerable: true, configurable: true },
  background: { get: () => `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, enumerable: true, configurable: true },
  color: { value: "white", enumerable: true, configurable: true },
  fontFamily: { value: "'Patrick Hand', cursive", enumerable: true, configurable: true },
  fontSize: { value: 18, enumerable: true, configurable: true },
  fontWeight: { value: 700, enumerable: true, configurable: true },
});

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

function RunnerGame({ studentName, mission, savedProgress, onClose, onComplete, onShop }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const stateRef = useRef({
    monkeyY: 0, // 0 = on ground, negative = up in air
    velY: 0,
    onGround: true,
    obstacles: [], // {x, type, w, h, ...}
    speed: 9,
    distance: 0,
    obstaclesPassed: (savedProgress?.questionsAnswered || 0) * 5, // resume checkpoint counting
    cloudOffset: 0,
    mountainOffset: 0,
    groundOffset: 0,
    nextSpawnIn: 60,
    frame: 0,
    paused: false,
    hurt: 0,
  });

  // Seed from saved progress if the student lost previously and is resuming
  const initial = savedProgress || {};
  const [showQuestion, setShowQuestion] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(initial.questionsAnswered || 0);
  const [selectedAns, setSelectedAns] = useState(null);
  const [questionResult, setQuestionResult] = useState(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(initial.score || 0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const rewardedRef = useRef(false); // synchronous guard for game loop / collision callbacks
  const [size, setSize] = useState({ w: 600, h: 240 });
  const isResuming = !!savedProgress && (savedProgress.questionsAnswered > 0 || savedProgress.score > 0);
  // Refs that always have the latest values for use inside game-loop callbacks
  const questionsAnsweredRef = useRef(initial.questionsAnswered || 0);
  const scoreRef = useRef(initial.score || 0);
  // Track wrong checkpoint answers for the post-mission summary
  const [wrongAnswers, setWrongAnswers] = useState([]);

  const questions = mission?.questions || [];
  const totalReward = mission?.points || 5;
  const targetQuestions = questions.length;
  // Spawn checkpoint every N obstacles (so questions are spread out)
  const obstaclesPerCheckpoint = 5;

  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      const containerW = Math.min(window.innerWidth - 40, 1100);
      const w = Math.max(320, containerW);
      const h = Math.round(w * 0.42);
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
    const gravity = 0.85;
    const jumpV = -15;

    const loop = (now) => {
      const dt = Math.min(50, now - lastTime);
      lastTime = now;
      // Frame-rate independent: scale all per-frame motion by dt relative to a 60fps baseline (~16.67ms).
      // Capped at 3x to prevent giant leaps after tab-switching or stalls.
      const dtMul = Math.min(3, dt / 16.67);
      const s = stateRef.current;
      s.frame++;

      // Physics
      if (!s.onGround) {
        s.velY += gravity * dtMul;
        s.monkeyY += s.velY * dtMul;
        if (s.monkeyY >= 0) {
          s.monkeyY = 0;
          s.velY = 0;
          s.onGround = true;
          SFX.land();
        }
      }

      // Move world
      s.distance += s.speed * dtMul;
      s.cloudOffset = (s.cloudOffset + s.speed * 0.1 * dtMul) % size.w;
      s.mountainOffset = (s.mountainOffset + s.speed * 0.3 * dtMul) % size.w;
      s.groundOffset = (s.groundOffset + s.speed * dtMul) % 30;

      // Move obstacles
      s.obstacles = s.obstacles.map(o => ({ ...o, x: o.x - s.speed * dtMul }));

      // Check passed obstacles
      s.obstacles.forEach(o => {
        if (!o.passed && o.x + o.w < monkeyX - monkeySize / 2) {
          o.passed = true;
          s.obstaclesPassed++;
          SFX.collect();
          scoreRef.current += 1;
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
      s.nextSpawnIn -= dtMul;
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

      // Speed up gradually — starts brisk (9), caps at 18
      s.speed = Math.min(18, 9 + s.distance * 0.0012);

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
            if (next <= 0 && !rewardedRef.current) {
              rewardedRef.current = true;
              setGameOver(true);
              SFX.gameOver();
              onComplete({
                pointsEarned: 0,
                won: false,
                questionsAnswered: questionsAnsweredRef.current,
                progress: { questionsAnswered: questionsAnsweredRef.current, score: scoreRef.current },
              });
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
      s.velY = -15;
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
    if (!isCorrect) {
      const q = questions[questionIdx];
      setWrongAnswers(w => [...w, {
        questionIdx,
        question: q.q,
        chosen: idx,
        chosenText: q.options[idx],
        correct: q.correct,
        correctText: q.options[q.correct],
      }]);
    }
    setTimeout(() => {
      if (isCorrect) {
        setQuestionsAnswered(q => {
          const newCount = q + 1;
          questionsAnsweredRef.current = newCount;
          if (newCount >= targetQuestions && !rewardedRef.current) {
            rewardedRef.current = true;
            setWon(true);
            setGameOver(true);
            setRewarded(true);
            SFX.levelUp();
            onComplete({ pointsEarned: totalReward, won: true, questionsAnswered: newCount });
          }
          return newCount;
        });
      } else {
        // Wrong answer = lose a life
        setLives(l => {
          const next = l - 1;
          if (next <= 0 && !rewardedRef.current) {
            rewardedRef.current = true;
            setGameOver(true);
            SFX.gameOver();
            onComplete({
              pointsEarned: 0,
              won: false,
              questionsAnswered: questionsAnsweredRef.current,
              progress: { questionsAnswered: questionsAnsweredRef.current, score: scoreRef.current },
            });
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
    // Resume from current progress (which may have just been saved on the previous loss)
    const resumedQs = questionsAnsweredRef.current;
    const resumedScore = scoreRef.current;
    stateRef.current = {
      monkeyY: 0, velY: 0, onGround: true,
      obstacles: [], speed: 9, distance: 0,
      obstaclesPassed: resumedQs * 5, // resume checkpoint counting
      cloudOffset: 0, mountainOffset: 0, groundOffset: 0,
      nextSpawnIn: 60, frame: 0, paused: false, hurt: 0,
    };
    setLives(3);
    setScore(resumedScore);
    setQuestionsAnswered(resumedQs);
    setGameOver(false);
    setWon(false);
    setRewarded(false);
    rewardedRef.current = false;
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
        maxWidth: "98vw", padding: "24px 30px", position: "relative",
      }} ref={containerRef}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 28 }}>🏃 {mission.name}</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 15 }}>
              Checkpoints: {questionsAnswered} / {targetQuestions} · Lives: {"❤️".repeat(Math.max(0, lives))}{"🤍".repeat(Math.max(0, 3 - lives))} · Score: {score}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 26, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
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
              <div style={{ fontSize: 56, marginBottom: 8 }}>{isResuming ? "🚀" : "🏃"}</div>
              <div style={{ fontSize: 22, color: C.text, fontWeight: 700, marginBottom: 6 }}>
                {isResuming ? "Resume Run!" : "Tap or Press Space to Start!"}
              </div>
              {isResuming ? (
                <>
                  <div style={{
                    background: `${C.green}20`, border: `2px solid ${C.green}50`,
                    borderRadius: 12, padding: "8px 14px", marginBottom: 10, textAlign: "center", maxWidth: 340,
                  }}>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>
                      💾 Picking up where you left off!
                    </div>
                    <div style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>
                      Checkpoint {questionsAnswered} of {targetQuestions} · Score: {score}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: C.textLight, textAlign: "center", padding: "0 16px" }}>
                    Tap, click, or press <strong>Space</strong> to jump
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: C.textLight, marginBottom: 12, textAlign: "center", maxWidth: 360, padding: "0 16px" }}>
                    Help the monkey jump over fruits! Every {obstaclesPerCheckpoint} fruits passed = a question. Answer all {targetQuestions} questions correctly to win!
                  </div>
                  <div style={{ fontSize: 13, color: C.textLight }}>
                    Tap, click, or press <strong>Space</strong> to jump
                  </div>
                </>
              )}
            </div>
          )}

          {/* Game over overlay */}
          {gameOver && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: won ? "rgba(255,250,200,0.96)" : "rgba(255,200,200,0.92)",
              backdropFilter: "blur(2px)", padding: "12px 16px", overflow: "auto",
            }}>
              <div style={{ fontSize: 48, marginBottom: 4 }}>{won ? "🎉" : "💔"}</div>
              <div style={{ fontSize: 22, color: C.text, fontWeight: 700, marginBottom: 8 }}>
                {won ? "Mission Complete!" : "Game Over"}
              </div>
              {won ? (
                <>
                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <div style={{ background: `${C.gold}25`, padding: "6px 12px", borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.textLight }}>EARNED</div>
                      <div style={{ fontSize: 18, color: C.gold, fontWeight: 700 }}>+{totalReward} ★</div>
                    </div>
                    <div style={{ background: `${C.green}25`, padding: "6px 12px", borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.textLight }}>ACCURACY</div>
                      <div style={{ fontSize: 18, color: C.green, fontWeight: 700 }}>
                        {targetQuestions > 0 ? Math.round(((targetQuestions - wrongAnswers.length) / targetQuestions) * 100) : 100}%
                      </div>
                    </div>
                    <div style={{ background: `${C.accent}25`, padding: "6px 12px", borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.textLight }}>FRUITS</div>
                      <div style={{ fontSize: 18, color: C.accent, fontWeight: 700 }}>{score}</div>
                    </div>
                  </div>
                  {/* Wrong answers review */}
                  {wrongAnswers.length > 0 && (
                    <div style={{ width: "100%", maxWidth: 460, textAlign: "left", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>📝 Review ({wrongAnswers.length} missed)</div>
                      <div style={{ maxHeight: 120, overflow: "auto" }}>
                        {wrongAnswers.map((w, i) => (
                          <div key={i} style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "6px 10px", marginBottom: 4, fontSize: 12 }}>
                            <div style={{ color: C.text, fontWeight: 600 }}>{w.question}</div>
                            <div style={{ color: C.accentDark }}>❌ {w.chosenText}</div>
                            <div style={{ color: C.green }}>✅ {w.correctText}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {wrongAnswers.length === 0 && (
                    <div style={{ background: `${C.green}20`, padding: "6px 14px", borderRadius: 10, marginBottom: 8, fontSize: 13, color: C.green, fontWeight: 700 }}>
                      🌟 Perfect! No wrong answers!
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, color: C.textLight, marginBottom: 8, textAlign: "center" }}>
                  You answered {questionsAnsweredRef.current} of {targetQuestions} checkpoints.
                  <div style={{ fontSize: 13, color: C.green, marginTop: 4 }}>
                    💾 Your progress is saved! Come back anytime to continue.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                {!won && <button onClick={restart} style={{ ...primaryBtnStyle, padding: "8px 16px", fontSize: 14 }}>🔄 Try Again</button>}
                {won && onShop && (
                  <button onClick={() => { onShop(); onClose(); }} style={{ ...primaryBtnStyle, background: `linear-gradient(135deg, ${C.green}, #4a8a4c)`, padding: "8px 16px", fontSize: 14 }}>
                    🍱 Buy Pet Food
                  </button>
                )}
                <button onClick={onClose} style={{ ...primaryBtnStyle, padding: "8px 16px", fontSize: 14 }}>
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
            borderRadius: 24, padding: 24, zIndex: 50,
          }}>
            <div style={{
              background: C.card, borderRadius: 22, padding: "28px 32px", width: "100%", maxWidth: 700,
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 17, color: C.textLight }}>🚩 Checkpoint #{questionsAnswered + 1}</div>
                <div style={{ fontSize: 16, color: C.textLight }}>{questionsAnswered + 1} / {targetQuestions}</div>
              </div>
              <div style={{
                background: `${C.snow1}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18,
                fontSize: 26, color: C.text, fontWeight: 600, textAlign: "center", minHeight: 70,
                display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1.4,
              }}>
                {currentQ.q}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                        padding: "16px 16px", borderRadius: 12, border: "none",
                        background: bg, color: textColor,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 19, fontWeight: 700,
                        cursor: selectedAns !== null ? "default" : "pointer", textAlign: "left",
                        minHeight: 64, lineHeight: 1.3,
                      }}>
                      <strong>{["A","B","C","D"][idx]}.</strong> {opt}
                    </button>
                  );
                })}
              </div>
              {questionResult === "wrong" && (
                <div style={{ marginTop: 14, padding: "10px 16px", background: `${C.accent}20`, borderRadius: 10, color: C.accentDark, fontSize: 16, textAlign: "center" }}>
                  ❌ Wrong! You lost a life. Keep going!
                </div>
              )}
              {questionResult === "correct" && (
                <div style={{ marginTop: 14, padding: "10px 16px", background: `${C.green}20`, borderRadius: 10, color: C.green, fontSize: 16, textAlign: "center" }}>
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


function FlappyGame({ studentName, mission, savedProgress, onClose, onComplete, onShop }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const initial = savedProgress || {};

  const stateRef = useRef({
    monkeyY: 0, // px from canvas top
    velY: 0,
    pipes: [], // {x, gapY, gapH, scored}
    speed: 4.5,
    distance: 0,
    pipesPassed: (savedProgress?.questionsAnswered || 0) * 4,
    cloudOffset: 0,
    iceShelfOffset: 0,
    nextSpawnIn: 80,
    frame: 0,
    paused: false,
    hurt: 0,
    flapAnim: 0,
  });

  const [showQuestion, setShowQuestion] = useState(false);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(initial.questionsAnswered || 0);
  const [selectedAns, setSelectedAns] = useState(null);
  const [questionResult, setQuestionResult] = useState(null);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(initial.score || 0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const [rewarded, setRewarded] = useState(false);
  const rewardedRef = useRef(false);
  const [size, setSize] = useState({ w: 600, h: 360 });
  const isResuming = !!savedProgress && (savedProgress.questionsAnswered > 0 || savedProgress.score > 0);
  const questionsAnsweredRef = useRef(initial.questionsAnswered || 0);
  const scoreRef = useRef(initial.score || 0);
  const [wrongAnswers, setWrongAnswers] = useState([]);

  const questions = mission?.questions || [];
  const totalReward = mission?.points || 5;
  const targetQuestions = questions.length;
  const pipesPerCheckpoint = 4;

  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      const containerW = Math.min(window.innerWidth - 40, 720);
      const w = Math.max(320, containerW);
      const h = Math.round(w * 0.6); // taller than runner for vertical play
      setSize({ w, h });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Initialize monkey Y position once size is known
  useEffect(() => {
    stateRef.current.monkeyY = size.h * 0.4;
  }, [size.h]);

  // Game loop
  useEffect(() => {
    if (!started || gameOver || showQuestion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let lastTime = performance.now();

    const monkeySize = Math.min(56, size.h * 0.22);
    const monkeyX = size.w * 0.22;
    const gravity = 0.45;
    const flapV = -7.5;
    const maxVy = 9;

    const loop = (now) => {
      const dt = Math.min(50, now - lastTime);
      lastTime = now;
      // Frame-rate independent: scale all per-frame motion by dt relative to a 60fps baseline (~16.67ms).
      // Capped at 3x to prevent giant leaps after tab-switching or stalls.
      const dtMul = Math.min(3, dt / 16.67);
      const s = stateRef.current;
      s.frame++;

      // Physics
      s.velY = Math.min(maxVy, s.velY + gravity * dtMul);
      s.monkeyY += s.velY * dtMul;
      if (s.flapAnim > 0) s.flapAnim -= dtMul;

      // Boundaries
      const groundY = size.h - 24;
      const ceilingY = 12;
      let outOfBounds = false;
      if (s.monkeyY > groundY - monkeySize / 2) {
        s.monkeyY = groundY - monkeySize / 2;
        outOfBounds = true;
      }
      if (s.monkeyY < ceilingY + monkeySize / 2) {
        s.monkeyY = ceilingY + monkeySize / 2;
        s.velY = Math.max(s.velY, 0);
      }

      // Move world
      s.distance += s.speed * dtMul;
      s.cloudOffset = (s.cloudOffset + s.speed * 0.15 * dtMul) % size.w;
      s.iceShelfOffset = (s.iceShelfOffset + s.speed * dtMul) % 40;

      // Move pipes
      s.pipes = s.pipes.map(p => ({ ...p, x: p.x - s.speed * dtMul }));

      // Check passed pipes
      s.pipes.forEach(p => {
        if (!p.scored && p.x + p.w < monkeyX - monkeySize / 2) {
          p.scored = true;
          s.pipesPassed++;
          SFX.collect();
          scoreRef.current += 1;
          setScore(sc => sc + 1);
          if (s.pipesPassed % pipesPerCheckpoint === 0) {
            s.paused = true;
          }
        }
      });

      // Remove off-screen pipes
      s.pipes = s.pipes.filter(p => p.x + p.w > -10);

      // Spawn new pipes
      s.nextSpawnIn -= dtMul;
      if (s.nextSpawnIn <= 0) {
        const gapH = Math.max(110, size.h * 0.34);
        const minGapY = 30;
        const maxGapY = size.h - gapH - 50;
        const gapY = minGapY + Math.random() * (maxGapY - minGapY);
        s.pipes.push({
          x: size.w + 20,
          w: 50,
          gapY,
          gapH,
          scored: false,
          id: Math.random(),
        });
        // Spawn distance scales with speed
        s.nextSpawnIn = Math.max(70, 130 - Math.floor(s.speed * 6));
      }

      // Speed up gradually — starts brisker (4.5), caps at 8.5
      s.speed = Math.min(8.5, 4.5 + s.distance * 0.0006);

      if (s.hurt > 0) s.hurt -= dtMul;

      // Collision detection
      const monkeyBox = {
        x: monkeyX - monkeySize * 0.4,
        y: s.monkeyY - monkeySize * 0.4,
        w: monkeySize * 0.8,
        h: monkeySize * 0.8,
      };
      let collided = outOfBounds && s.monkeyY >= groundY - monkeySize / 2;
      s.pipes.forEach(p => {
        if (p.hit) return;
        // Top icicle: from 0 to gapY
        // Bottom icicle: from gapY+gapH to groundY
        const inXRange = monkeyBox.x < p.x + p.w - 4 && monkeyBox.x + monkeyBox.w > p.x + 4;
        if (inXRange) {
          const hitTop = monkeyBox.y < p.gapY - 2;
          const hitBottom = monkeyBox.y + monkeyBox.h > p.gapY + p.gapH + 2;
          if (hitTop || hitBottom) {
            p.hit = true;
            collided = true;
          }
        }
      });

      if (collided && s.hurt <= 0) {
        s.hurt = 30;
        SFX.wrong();
        setLives(l => {
          const next = l - 1;
          if (next <= 0 && !rewardedRef.current) {
            rewardedRef.current = true;
            setGameOver(true);
            SFX.gameOver();
            onComplete({
              pointsEarned: 0,
              won: false,
              questionsAnswered: questionsAnsweredRef.current,
              progress: { questionsAnswered: questionsAnsweredRef.current, score: scoreRef.current },
            });
          }
          return next;
        });
        // Bounce monkey down a bit on hit (gives a moment of recovery)
        s.velY = Math.max(s.velY, -3);
      }

      // === RENDER ===
      // Sky gradient (icy)
      const grd = ctx.createLinearGradient(0, 0, 0, size.h);
      grd.addColorStop(0, "#a8d4e0");
      grd.addColorStop(0.5, "#c8e4ee");
      grd.addColorStop(1, "#e0f0f4");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size.w, size.h);

      // Distant clouds
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let i = 0; i < 4; i++) {
        const cx = (i * 200 - s.cloudOffset) % (size.w + 200) - 80;
        const cy = 20 + i * 24;
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.arc(cx + 14, cy - 4, 16, 0, Math.PI * 2);
        ctx.arc(cx + 28, cy, 13, 0, Math.PI * 2);
        ctx.arc(cx + 14, cy + 4, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Top ice shelf line
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size.w, 12);
      ctx.strokeStyle = "#a8c8d4";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(size.w, 12);
      ctx.stroke();

      // Pipes (icicles)
      s.pipes.forEach(p => {
        // TOP icicle - hangs down from ceiling
        const topGrd = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
        topGrd.addColorStop(0, "#e0f0f8");
        topGrd.addColorStop(0.4, "#b8d8e8");
        topGrd.addColorStop(0.7, "#88b8d0");
        topGrd.addColorStop(1, "#6090b0");
        ctx.fillStyle = topGrd;
        // Main body trapezoid that tapers to point
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x + p.w, 0);
        ctx.lineTo(p.x + p.w * 0.85, p.gapY - 12);
        ctx.lineTo(p.x + p.w / 2, p.gapY); // pointy tip
        ctx.lineTo(p.x + p.w * 0.15, p.gapY - 12);
        ctx.closePath();
        ctx.fill();
        // Highlight strip
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.moveTo(p.x + 4, 0);
        ctx.lineTo(p.x + 11, 0);
        ctx.lineTo(p.x + p.w * 0.42, p.gapY - 12);
        ctx.lineTo(p.x + p.w * 0.45, p.gapY - 4);
        ctx.closePath();
        ctx.fill();
        // Subtle cracks
        ctx.strokeStyle = "rgba(96,144,176,0.5)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.7, 8);
        ctx.lineTo(p.x + p.w * 0.55, p.gapY - 16);
        ctx.stroke();

        // BOTTOM icicle - rises from ground
        const bottomY = p.gapY + p.gapH;
        const groundFloor = size.h - 24;
        const bottomGrd = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
        bottomGrd.addColorStop(0, "#e0f0f8");
        bottomGrd.addColorStop(0.4, "#b8d8e8");
        bottomGrd.addColorStop(0.7, "#88b8d0");
        bottomGrd.addColorStop(1, "#6090b0");
        ctx.fillStyle = bottomGrd;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w / 2, bottomY); // pointy tip
        ctx.lineTo(p.x + p.w * 0.85, bottomY + 12);
        ctx.lineTo(p.x + p.w, groundFloor);
        ctx.lineTo(p.x, groundFloor);
        ctx.lineTo(p.x + p.w * 0.15, bottomY + 12);
        ctx.closePath();
        ctx.fill();
        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.42, bottomY + 4);
        ctx.lineTo(p.x + p.w * 0.45, bottomY + 12);
        ctx.lineTo(p.x + 11, groundFloor);
        ctx.lineTo(p.x + 4, groundFloor);
        ctx.closePath();
        ctx.fill();
        // Subtle cracks
        ctx.strokeStyle = "rgba(96,144,176,0.5)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w * 0.55, bottomY + 16);
        ctx.lineTo(p.x + p.w * 0.7, groundFloor - 8);
        ctx.stroke();
      });

      // Snow ground
      ctx.fillStyle = "#f5f8fc";
      ctx.fillRect(0, size.h - 24, size.w, 24);
      ctx.strokeStyle = "#c8d8e0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, size.h - 24);
      ctx.lineTo(size.w, size.h - 24);
      ctx.stroke();
      ctx.fillStyle = "rgba(180,200,212,0.5)";
      for (let x = -s.iceShelfOffset; x < size.w; x += 40) {
        ctx.beginPath();
        ctx.arc(x, size.h - 22, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Monkey - reuse canvas drawer with rotation based on velocity
      const tilt = Math.max(-0.4, Math.min(0.7, s.velY * 0.06));
      ctx.save();
      ctx.translate(monkeyX, s.monkeyY);
      ctx.rotate(tilt);
      // Draw "wings" — flap arms at sides for flappy feel
      const wingPhase = s.flapAnim > 0 ? Math.sin((30 - s.flapAnim) * 0.3) * 0.6 : Math.sin(s.frame * 0.2) * 0.15;
      // Use draw helper centered at 0,0 — shift so it sits at 0,0 anchor
      drawMonkeyOnCanvas(ctx, 0, -monkeySize / 2, monkeySize, s.frame, false, s.hurt > 0);
      // Add little wing strokes either side to communicate "flapping"
      ctx.strokeStyle = s.hurt > 0 ? "#ff8080" : "#a3796a";
      ctx.lineWidth = monkeySize * 0.07;
      ctx.lineCap = "round";
      const wingY = monkeySize * 0.05;
      const wingLen = monkeySize * 0.5;
      ctx.beginPath();
      ctx.moveTo(-monkeySize * 0.28, wingY);
      ctx.lineTo(-monkeySize * 0.28 - wingLen * Math.cos(wingPhase), wingY - wingLen * Math.sin(wingPhase));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(monkeySize * 0.28, wingY);
      ctx.lineTo(monkeySize * 0.28 + wingLen * Math.cos(wingPhase), wingY - wingLen * Math.sin(wingPhase));
      ctx.stroke();
      ctx.restore();

      if (s.paused && !showQuestion) {
        s.paused = false;
        const qIdx = (questionsAnsweredRef.current) % questions.length;
        setQuestionIdx(qIdx);
        setSelectedAns(null);
        setQuestionResult(null);
        setShowQuestion(true);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, gameOver, showQuestion, size, questions.length]);

  // Flap handler
  const flap = useCallback(() => {
    const s = stateRef.current;
    if (started && !gameOver && !showQuestion) {
      s.velY = -7.5;
      s.flapAnim = 30;
      SFX.jump();
    }
  }, [started, gameOver, showQuestion]);

  // Input handlers
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!started) setStarted(true);
        else flap();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flap, started]);

  const answerQuestion = (idx) => {
    if (selectedAns !== null) return;
    setSelectedAns(idx);
    const isCorrect = idx === questions[questionIdx].correct;
    if (isCorrect) SFX.correct();
    else SFX.wrong();
    setQuestionResult(isCorrect ? "correct" : "wrong");
    if (!isCorrect) {
      const q = questions[questionIdx];
      setWrongAnswers(w => [...w, {
        questionIdx,
        question: q.q,
        chosen: idx,
        chosenText: q.options[idx],
        correct: q.correct,
        correctText: q.options[q.correct],
      }]);
    }
    setTimeout(() => {
      if (isCorrect) {
        setQuestionsAnswered(q => {
          const newCount = q + 1;
          questionsAnsweredRef.current = newCount;
          if (newCount >= targetQuestions && !rewardedRef.current) {
            rewardedRef.current = true;
            setWon(true);
            setGameOver(true);
            setRewarded(true);
            SFX.levelUp();
            onComplete({ pointsEarned: totalReward, won: true, questionsAnswered: newCount });
          }
          return newCount;
        });
      } else {
        setLives(l => {
          const next = l - 1;
          if (next <= 0 && !rewardedRef.current) {
            rewardedRef.current = true;
            setGameOver(true);
            SFX.gameOver();
            onComplete({
              pointsEarned: 0,
              won: false,
              questionsAnswered: questionsAnsweredRef.current,
              progress: { questionsAnswered: questionsAnsweredRef.current, score: scoreRef.current },
            });
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
    const resumedQs = questionsAnsweredRef.current;
    const resumedScore = scoreRef.current;
    stateRef.current = {
      monkeyY: size.h * 0.4, velY: 0,
      pipes: [], speed: 4.5, distance: 0,
      pipesPassed: resumedQs * pipesPerCheckpoint,
      cloudOffset: 0, iceShelfOffset: 0,
      nextSpawnIn: 80, frame: 0, paused: false, hurt: 0, flapAnim: 0,
    };
    setLives(3);
    setScore(resumedScore);
    setQuestionsAnswered(resumedQs);
    setGameOver(false);
    setWon(false);
    setRewarded(false);
    rewardedRef.current = false;
    setStarted(true);
  };

  if (!questions || questions.length === 0) {
    return (
      <div style={modalBackdropStyle} onClick={onClose}>
        <div style={{ ...modalCardStyle, textAlign: "center" }} onClick={e => e.stopPropagation()}>
          <h2 style={{ color: C.text, margin: "0 0 12px" }}>❄️ No Mission Yet</h2>
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
        maxWidth: "98vw", padding: "24px 30px", position: "relative",
      }} ref={containerRef}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 28 }}>❄️ {mission.name}</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 15 }}>
              Checkpoints: {questionsAnswered} / {targetQuestions} · Lives: {"❤️".repeat(Math.max(0, lives))}{"🤍".repeat(Math.max(0, 3 - lives))} · Score: {score}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 26, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Game canvas */}
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#a8d4e0", boxShadow: "inset 0 0 0 2px " + C.fur2 + "30", touchAction: "none" }}
          onMouseDown={(e) => { e.preventDefault(); if (!started) setStarted(true); else flap(); }}
          onTouchStart={(e) => { e.preventDefault(); if (!started) setStarted(true); else flap(); }}
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
              <div style={{ fontSize: 56, marginBottom: 8 }}>{isResuming ? "🚀" : "❄️"}</div>
              <div style={{ fontSize: 22, color: C.text, fontWeight: 700, marginBottom: 6 }}>
                {isResuming ? "Resume Flight!" : "Tap or Press Space to Start!"}
              </div>
              {isResuming ? (
                <>
                  <div style={{
                    background: `${C.green}20`, border: `2px solid ${C.green}50`,
                    borderRadius: 12, padding: "8px 14px", marginBottom: 10, textAlign: "center", maxWidth: 340,
                  }}>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>
                      💾 Picking up where you left off!
                    </div>
                    <div style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>
                      Checkpoint {questionsAnswered} of {targetQuestions} · Score: {score}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: C.textLight, textAlign: "center", padding: "0 16px" }}>
                    Tap, click, or press <strong>Space</strong> to flap
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: C.textLight, marginBottom: 12, textAlign: "center", maxWidth: 360, padding: "0 16px" }}>
                    Help the monkey fly between the icicles! Every {pipesPerCheckpoint} icicles passed = a question. Answer all {targetQuestions} questions correctly to win!
                  </div>
                  <div style={{ fontSize: 13, color: C.textLight }}>
                    Tap, click, or press <strong>Space</strong> to flap
                  </div>
                </>
              )}
            </div>
          )}

          {/* Game over overlay */}
          {gameOver && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: won ? "rgba(255,250,200,0.96)" : "rgba(255,200,200,0.92)",
              backdropFilter: "blur(2px)", padding: "12px 16px", overflow: "auto",
            }}>
              <div style={{ fontSize: 48, marginBottom: 4 }}>{won ? "🎉" : "❄️"}</div>
              <div style={{ fontSize: 22, color: C.text, fontWeight: 700, marginBottom: 8 }}>
                {won ? "Mission Complete!" : "Crashed!"}
              </div>
              {won ? (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <div style={{ background: `${C.gold}25`, padding: "6px 12px", borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.textLight }}>EARNED</div>
                      <div style={{ fontSize: 18, color: C.gold, fontWeight: 700 }}>+{totalReward} ★</div>
                    </div>
                    <div style={{ background: `${C.green}25`, padding: "6px 12px", borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.textLight }}>ACCURACY</div>
                      <div style={{ fontSize: 18, color: C.green, fontWeight: 700 }}>
                        {targetQuestions > 0 ? Math.round(((targetQuestions - wrongAnswers.length) / targetQuestions) * 100) : 100}%
                      </div>
                    </div>
                    <div style={{ background: `${C.accent}25`, padding: "6px 12px", borderRadius: 10 }}>
                      <div style={{ fontSize: 10, color: C.textLight }}>ICICLES</div>
                      <div style={{ fontSize: 18, color: C.accent, fontWeight: 700 }}>{score}</div>
                    </div>
                  </div>
                  {wrongAnswers.length > 0 && (
                    <div style={{ width: "100%", maxWidth: 460, textAlign: "left", marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>📝 Review ({wrongAnswers.length} missed)</div>
                      <div style={{ maxHeight: 120, overflow: "auto" }}>
                        {wrongAnswers.map((w, i) => (
                          <div key={i} style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "6px 10px", marginBottom: 4, fontSize: 12 }}>
                            <div style={{ color: C.text, fontWeight: 600 }}>{w.question}</div>
                            <div style={{ color: C.accentDark }}>❌ {w.chosenText}</div>
                            <div style={{ color: C.green }}>✅ {w.correctText}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {wrongAnswers.length === 0 && (
                    <div style={{ background: `${C.green}20`, padding: "6px 14px", borderRadius: 10, marginBottom: 8, fontSize: 13, color: C.green, fontWeight: 700 }}>
                      🌟 Perfect! No wrong answers!
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, color: C.textLight, marginBottom: 8, textAlign: "center" }}>
                  You answered {questionsAnsweredRef.current} of {targetQuestions} checkpoints.
                  <div style={{ fontSize: 13, color: C.green, marginTop: 4 }}>
                    💾 Your progress is saved! Come back anytime to continue.
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                {!won && <button onClick={restart} style={{ ...primaryBtnStyle, padding: "8px 16px", fontSize: 14 }}>🔄 Try Again</button>}
                {won && onShop && (
                  <button onClick={() => { onShop(); onClose(); }} style={{ ...primaryBtnStyle, background: `linear-gradient(135deg, ${C.green}, #4a8a4c)`, padding: "8px 16px", fontSize: 14 }}>
                    🍱 Buy Pet Food
                  </button>
                )}
                <button onClick={onClose} style={{ ...primaryBtnStyle, padding: "8px 16px", fontSize: 14 }}>
                  Back to Hot Spring
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 10, fontSize: 13, color: C.textLight }}>
          🦋 Tap the game / click / press Space to flap. Don't hit the icicles!
        </div>

        {/* Question modal */}
        {showQuestion && currentQ && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 24, padding: 24, zIndex: 50,
          }}>
            <div style={{
              background: C.card, borderRadius: 22, padding: "28px 32px", width: "100%", maxWidth: 700,
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 17, color: C.textLight }}>🚩 Checkpoint #{questionsAnswered + 1}</div>
                <div style={{ fontSize: 16, color: C.textLight }}>{questionsAnswered + 1} / {targetQuestions}</div>
              </div>
              <div style={{
                background: `${C.snow1}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18,
                fontSize: 26, color: C.text, fontWeight: 600, textAlign: "center", minHeight: 70,
                display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1.4,
              }}>
                {currentQ.q}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                        padding: "16px 16px", borderRadius: 12, border: "none",
                        background: bg, color: textColor,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 19, fontWeight: 700,
                        cursor: selectedAns !== null ? "default" : "pointer", textAlign: "left",
                        minHeight: 64, lineHeight: 1.3,
                      }}>
                      <strong>{["A","B","C","D"][idx]}.</strong> {opt}
                    </button>
                  );
                })}
              </div>
              {questionResult === "wrong" && (
                <div style={{ marginTop: 14, padding: "10px 16px", background: `${C.accent}20`, borderRadius: 10, color: C.accentDark, fontSize: 16, textAlign: "center" }}>
                  ❌ Wrong! You lost a life.
                </div>
              )}
              {questionResult === "correct" && (
                <div style={{ marginTop: 14, padding: "10px 16px", background: `${C.green}20`, borderRadius: 10, color: C.green, fontSize: 16, textAlign: "center" }}>
                  ✅ Correct! Keep flying!
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

function MissionGame({ studentName, mission, onClose, onComplete, onShop }) {
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
  const [wrongAnswers, setWrongAnswers] = useState([]);

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
    if (!isCorrect) {
      const q = questions[questionIdx];
      setWrongAnswers(w => [...w, {
        questionIdx,
        question: q.q,
        chosen: idx,
        chosenText: q.options[idx],
        correct: q.correct,
        correctText: q.options[q.correct],
      }]);
    }
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
            onComplete({ pointsEarned: totalReward, won: true });
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

  const cellSize = 48;
  const currentQ = questions[questionIdx];
  const progress = (questionsCompleted / targetQuestions) * 100;

  return (
    <div style={modalBackdropStyle}>
      <div style={{ ...modalCardStyle, width: "min(960px, 96vw)", maxWidth: "96vw", height: "min(820px, 95vh)", maxHeight: "95vh", overflowY: "auto", position: "relative", padding: "24px 30px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, color: C.text, fontSize: 28 }}>🚀 {mission.name}</h2>
            <p style={{ margin: 0, color: C.textLight, fontSize: 15 }}>
              {questionsCompleted} / {targetQuestions} answered · {totalReward} ★ reward
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 26, color: C.textLight, cursor: "pointer", padding: 4 }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, background: `${C.fur2}30`, borderRadius: 4, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.green})`, transition: "width 0.4s" }} />
        </div>

        {gameOver ? (
          <div style={{ textAlign: "center", padding: "12px 0", maxHeight: "70vh", overflow: "auto" }}>
            <div style={{ fontSize: 56, marginBottom: 4 }}>🎉</div>
            <h2 style={{ color: C.text, margin: "0 0 8px", fontSize: 26 }}>Mission Complete!</h2>
            <p style={{ color: C.textLight, fontSize: 14, margin: "0 0 12px" }}>{studentName} · {mission?.name}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ background: `${C.gold}25`, padding: "8px 14px", borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: C.textLight, textTransform: "uppercase" }}>Earned</div>
                <div style={{ fontSize: 20, color: C.gold, fontWeight: 700 }}>+{totalReward} ★</div>
              </div>
              <div style={{ background: `${C.green}25`, padding: "8px 14px", borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: C.textLight, textTransform: "uppercase" }}>Accuracy</div>
                <div style={{ fontSize: 20, color: C.green, fontWeight: 700 }}>
                  {targetQuestions > 0 ? Math.round((targetQuestions / (targetQuestions + wrongAnswers.length)) * 100) : 100}%
                </div>
              </div>
              <div style={{ background: `${C.accent}25`, padding: "8px 14px", borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: C.textLight, textTransform: "uppercase" }}>Blocks</div>
                <div style={{ fontSize: 20, color: C.accent, fontWeight: 700 }}>{score}</div>
              </div>
            </div>
            {wrongAnswers.length > 0 && (
              <div style={{ textAlign: "left", marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>📝 Review ({wrongAnswers.length} missed)</div>
                <div style={{ maxHeight: 200, overflow: "auto" }}>
                  {wrongAnswers.map((w, i) => (
                    <div key={i} style={{ background: `${C.accent}10`, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: "8px 12px", marginBottom: 6 }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 4 }}>{w.question}</div>
                      <div style={{ fontSize: 12, color: C.accentDark }}>❌ {w.chosenText}</div>
                      <div style={{ fontSize: 12, color: C.green }}>✅ {w.correctText}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {wrongAnswers.length === 0 && (
              <div style={{ background: `${C.green}20`, padding: "8px 14px", borderRadius: 10, marginBottom: 12, fontSize: 14, color: C.green, fontWeight: 700 }}>
                🌟 Perfect mission! No wrong answers!
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {onShop && (
                <button onClick={() => { onShop(); onClose(); }} style={{ ...primaryBtnStyle, background: `linear-gradient(135deg, ${C.green}, #4a8a4c)` }}>
                  🍱 Buy Pet Food
                </button>
              )}
              <button onClick={onClose} style={primaryBtnStyle}>Back to Hot Spring</button>
            </div>
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
            <div style={{ textAlign: "center", fontSize: 18, color: C.textLight, marginBottom: 12 }}>
              Block score: <strong style={{ color: C.gold, fontSize: 24 }}>{score}</strong>
            </div>

            {/* Tray */}
            <div style={{ display: "flex", justifyContent: "center", gap: 18, marginBottom: 10 }}>
              {tray.map((shape, idx) => {
                if (!shape) return <div key={idx} style={{ width: 100, height: 100, opacity: 0.3, display: "flex", alignItems: "center", justifyContent: "center", color: C.textLight, fontSize: 13 }}>—</div>;
                const maxR = Math.max(...shape.cells.map(c => c[0]));
                const maxC = Math.max(...shape.cells.map(c => c[1]));
                const traySize = 22;
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
            <div style={{ textAlign: "center", fontSize: 14, color: C.textLight }}>
              {selectedShapeIdx === null ? "👆 Pick a shape, then click on the grid" : "Click a cell to place — you'll need to answer a question!"}
            </div>
          </>
        )}

        {/* Question modal overlay */}
        {showQuestion && currentQ && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 24, padding: 24, zIndex: 50,
          }}>
            <div style={{
              background: C.card, borderRadius: 22, padding: "28px 32px", width: "100%", maxWidth: 700,
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            }}>
              <div style={{ fontSize: 17, color: C.textLight, marginBottom: 8 }}>Answer to place block</div>
              <div style={{
                background: `${C.snow1}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18,
                fontSize: 26, color: C.text, fontWeight: 600, textAlign: "center", minHeight: 70,
                display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1.4,
              }}>
                {currentQ.q}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                        padding: "16px 16px", borderRadius: 12, border: "none",
                        background: bg, color: textColor,
                        fontFamily: "'Patrick Hand', cursive", fontSize: 19, fontWeight: 700,
                        cursor: selected !== null ? "default" : "pointer", textAlign: "left",
                        minHeight: 64, lineHeight: 1.3,
                      }}>
                      <strong>{["A","B","C","D"][idx]}.</strong> {opt}
                    </button>
                  );
                })}
              </div>
              {questionResult === "wrong" && (
                <div style={{ marginTop: 14, padding: "10px 16px", background: `${C.accent}20`, borderRadius: 10, color: C.accentDark, fontSize: 16, textAlign: "center" }}>
                  ❌ Wrong! You can't place that block. Try another shape.
                </div>
              )}
              {questionResult === "correct" && (
                <div style={{ marginTop: 14, padding: "10px 16px", background: `${C.green}20`, borderRadius: 10, color: C.green, fontSize: 16, textAlign: "center" }}>
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
  const [loginTab, setLoginTab] = useState("student");
  const [showPassword, setShowPassword] = useState(false);
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
  // When a student picks a mission, this holds the mission while they choose a game type
  const [gameTypeChoiceMission, setGameTypeChoiceMission] = useState(null);
  const [activeQuizId, setActiveQuizId] = useState(null);
  const [activeMissionId, setActiveMissionId] = useState(null);
  // When a student plays a mission, this holds the chosen game type ("blockblast" | "runner" | "flappy")
  const [activeGameType, setActiveGameType] = useState(null);
  const [showPetMart, setShowPetMart] = useState(false);
  const [showFoodShop, setShowFoodShop] = useState(false);
  const [showMyPool, setShowMyPool] = useState(false);
  const [showWalk, setShowWalk] = useState(false);
  const [petMartTab, setPetMartTab] = useState("packs"); // "packs" | "collection"
  const [packResult, setPackResult] = useState(null); // { pet, isDuplicate, consolationStars }
  const [showCustomize, setShowCustomize] = useState(false);
  const [customizeTab, setCustomizeTab] = useState("all"); // "all" | "owned" | "shop"
  const [customizeTarget, setCustomizeTarget] = useState("monkey"); // "monkey" | "pet"
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
  const [examsOpen, setExamsOpen] = useState(true);
  const [examsListExpanded, setExamsListExpanded] = useState(false);
  const [showAddExam, setShowAddExam] = useState(false);
  const [examTargetStudentId, setExamTargetStudentId] = useState(null);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("09:00");
  const [examEmoji, setExamEmoji] = useState("📝");
  // Real-time tick for countdown — updates every second
  const [, setNowTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [soundOn, setSoundOn] = useState(getSoundsEnabled());
  const toggleSound = () => {
    const next = !soundOn;
    setSoundsEnabled(next);
    setSoundOn(next);
    if (next) setTimeout(() => SFX.click(), 50); // Confirm sound is back
  };
  // Theme (light/dark/rainbow)
  const [themeMode, setThemeModeState] = useState(getTheme());
  const toggleTheme = () => {
    // Cycle: light → dark → rainbow → light
    const next = themeMode === "light" ? "dark" : themeMode === "dark" ? "rainbow" : "light";
    setTheme(next); // mutates global C
    setThemeModeState(next); // triggers re-render
    SFX.click();
  };
  const themeIcon = themeMode === "dark" ? "🌈" : themeMode === "rainbow" ? "☀️" : "🌙";
  const themeTitle = themeMode === "dark" ? "Switch to rainbow mode" : themeMode === "rainbow" ? "Switch to light mode" : "Switch to dark mode";
  // Show/hide student names on the main scene — persisted across sessions
  const [showNames, setShowNamesState] = useState(() => {
    try {
      const stored = localStorage.getItem("monkeyTracker_showNames");
      return stored === null ? true : stored === "true";
    } catch { return true; }
  });
  const toggleShowNames = () => {
    const next = !showNames;
    setShowNamesState(next);
    try { localStorage.setItem("monkeyTracker_showNames", String(next)); } catch {}
    SFX.click();
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

  // Exams
  const addExam = (studentId, exam) => {
    const newS = students.map(s => {
      if (s.id !== studentId) return s;
      const exams = [...(s.exams || []), exam];
      return { ...s, exams };
    });
    persist(null, newS);
  };
  const deleteExam = (studentId, examId) => {
    const newS = students.map(s => {
      if (s.id !== studentId) return s;
      const exams = (s.exams || []).filter(e => e.id !== examId);
      return { ...s, exams };
    });
    persist(null, newS);
  };

  // Quotes (teacher-set per student, and student's own personal quotes)
  const addTeacherQuote = (studentId, text) => {
    const t = text?.trim(); if (!t) return;
    const newS = students.map(s => s.id === studentId
      ? { ...s, teacherQuotes: [...(s.teacherQuotes || []), t] }
      : s);
    persist(null, newS);
  };
  const deleteTeacherQuote = (studentId, idx) => {
    const newS = students.map(s => s.id === studentId
      ? { ...s, teacherQuotes: (s.teacherQuotes || []).filter((_, i) => i !== idx) }
      : s);
    persist(null, newS);
  };
  const addPersonalQuote = (studentId, text) => {
    const t = text?.trim(); if (!t) return;
    const newS = students.map(s => s.id === studentId
      ? { ...s, personalQuotes: [...(s.personalQuotes || []), t] }
      : s);
    persist(null, newS);
  };
  const deletePersonalQuote = (studentId, idx) => {
    const newS = students.map(s => s.id === studentId
      ? { ...s, personalQuotes: (s.personalQuotes || []).filter((_, i) => i !== idx) }
      : s);
    persist(null, newS);
  };

  const submitExam = (studentId) => {
    if (!examName.trim() || !examDate) return;
    const dateMs = new Date(examDate + "T" + (examTime || "09:00")).getTime();
    if (isNaN(dateMs)) return;
    addExam(studentId, {
      id: "exam_" + Date.now(),
      name: examName.trim(),
      emoji: examEmoji || "📝",
      dateMs,
    });
    setExamName(""); setExamDate(""); setExamTime("09:00"); setExamEmoji("📝");
    setShowAddExam(false);
    SFX.click();
  };

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

  const handleQuizComplete = async (result) => {
    if (!user) return;
    // Backwards-compat: also accept old signature where result was just a number
    const r = (typeof result === "number") ? { pointsEarned: result } : (result || {});
    const pointsEarned = r.pointsEarned || 0;
    const activeQuiz = (quizzes[user.id] || []).find(q => q.id === activeQuizId);
    const newS = students.map(s => {
      if (s.id !== user.id) return s;
      const completions = { ...(s.completions || {}) };
      if (activeQuiz) {
        const key = `quiz:${activeQuiz.id}`;
        const prev = completions[key] || { attempts: 0, totalEarned: 0, bestScore: 0 };
        const total = r.scoreTotal ?? activeQuiz.questions.length;
        const score = r.scoreCorrect ?? 0;
        completions[key] = {
          ...prev,
          type: "quiz",
          name: activeQuiz.name,
          subject: activeQuiz.subject,
          attempts: (prev.attempts || 0) + 1,
          lastScore: score,
          total,
          bestScore: Math.max(prev.bestScore || 0, score),
          lastAttempt: Date.now(),
          totalEarned: (prev.totalEarned || 0) + pointsEarned,
          completed: score === total,
        };
      }
      return { ...s, points: s.points + pointsEarned, completions };
    });
    persist(null, newS);
    if (pointsEarned > 0) SFX.reward();
    notify(`🎉 Quiz complete! +${pointsEarned} ★`);
  };

  const handleMissionComplete = async (result) => {
    if (!user) return;
    const r = (typeof result === "number") ? { pointsEarned: result, won: true } : (result || {});
    const pointsEarned = r.pointsEarned || 0;
    const won = r.won !== false;
    const gameType = r.gameType || "blockblast"; // type the student played in this attempt
    const activeMission = (missions[user.id] || []).find(m => m.id === activeMissionId);
    const newS = students.map(s => {
      if (s.id !== user.id) return s;
      const completions = { ...(s.completions || {}) };
      if (activeMission) {
        // Per-game-type progress key, plus an aggregate "completed" entry on the bare mission key
        const perGameKey = `mission:${activeMission.id}:${gameType}`;
        const aggregateKey = `mission:${activeMission.id}`;
        const prevPerGame = completions[perGameKey] || { attempts: 0, totalEarned: 0, completed: false };
        completions[perGameKey] = {
          ...prevPerGame,
          type: "mission",
          name: activeMission.name,
          missionType: gameType,
          attempts: (prevPerGame.attempts || 0) + 1,
          lastAttempt: Date.now(),
          totalEarned: (prevPerGame.totalEarned || 0) + pointsEarned,
          completed: prevPerGame.completed || won,
          // Save progress so the student can resume next time
          // Clear progress when they win — fresh start next time
          progress: won ? null : (r.progress || prevPerGame.progress || null),
        };
        // Aggregate "this mission was completed at least once" for reminders
        const prevAgg = completions[aggregateKey] || { attempts: 0, totalEarned: 0, completed: false };
        completions[aggregateKey] = {
          ...prevAgg,
          type: "mission",
          name: activeMission.name,
          missionType: gameType,
          attempts: (prevAgg.attempts || 0) + 1,
          lastAttempt: Date.now(),
          totalEarned: (prevAgg.totalEarned || 0) + pointsEarned,
          completed: prevAgg.completed || won,
        };
      }
      return { ...s, points: s.points + pointsEarned, completions };
    });
    persist(null, newS);
    if (won && pointsEarned > 0) {
      SFX.levelUp();
      notify(`🚀 Mission complete! +${pointsEarned} ★`);
    } else if (!won) {
      notify(`💪 Good try! Resume next time.`, "info");
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

  // ─── PET ACCESSORY HELPERS ───
  const togglePetAccessory = (studentId, accessoryId) => {
    const acc = getPetAccessory(accessoryId);
    if (!acc) return;
    const st = students.find(s => s.id === studentId);
    if (!st) return;
    if (!st.pet) {
      notify("You need a pet first!", "error");
      return;
    }
    const ownedPetAccessories = st.ownedPetAccessories || [];
    if (acc.price > 0 && !ownedPetAccessories.includes(accessoryId)) {
      SFX.wrong();
      notify(`You haven't unlocked the ${acc.name} yet!`, "error");
      return;
    }
    const current = st.petAccessories || [];
    const has = current.includes(accessoryId);
    let next;
    if (has) {
      next = current.filter(a => a !== accessoryId);
      SFX.click();
    } else {
      // Remove anything else in the same slot
      const filtered = current.filter(id => {
        const other = getPetAccessory(id);
        return !other || other.slot !== acc.slot;
      });
      next = [...filtered, accessoryId];
      SFX.collect();
    }
    const newS = students.map(s => s.id === studentId ? { ...s, petAccessories: next } : s);
    persist(null, newS);
  };

  const buyPetAccessory = (studentId, accessoryId) => {
    const acc = getPetAccessory(accessoryId);
    const st = students.find(s => s.id === studentId);
    if (!acc || !st) return;
    if (!st.pet) {
      notify("You need a pet first!", "error");
      return;
    }
    if (acc.price === 0) return;
    const ownedPetAccessories = st.ownedPetAccessories || [];
    if (ownedPetAccessories.includes(accessoryId)) return;
    if (st.points < acc.price) {
      SFX.wrong();
      notify(`Not enough stars! Need ${acc.price - st.points} more ★`, "error");
      return;
    }
    const current = st.petAccessories || [];
    const equipped = [...current.filter(id => {
      const o = getPetAccessory(id);
      return !o || o.slot !== acc.slot;
    }), accessoryId];
    const newS = students.map(s => s.id === studentId ? {
      ...s,
      points: s.points - acc.price,
      petAccessories: equipped,
      ownedPetAccessories: [...ownedPetAccessories, accessoryId],
    } : s);
    persist(null, newS);
    SFX.packOpen();
    notify(`🎉 Your pet got ${acc.emoji} ${acc.name}!`);
  };

  const clearPetAccessories = (studentId) => {
    const newS = students.map(s => s.id === studentId ? { ...s, petAccessories: [] } : s);
    persist(null, newS);
    SFX.click();
    notify("Pet accessories cleared!");
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
    // Equip - reset the income timer so they wait a fresh week, init care stats
    const newS = students.map(s => s.id === studentId ? {
      ...s,
      pet: petId,
      petAcquiredAt: Date.now(),
      lastIncomeCollected: Date.now(),
      petCare: { hunger: 80, happiness: 80, lastFedAt: Date.now(), lastUpdated: Date.now() },
    } : s);
    persist(null, newS);
    SFX.collect();
    notify(`${pet.emoji} ${pet.name} is by your side!`);
  };

  // Feed the student's pet — buys food and applies hunger/happiness boost
  const feedPet = (studentId, foodId) => {
    const food = getFood(foodId);
    const st = students.find(s => s.id === studentId);
    if (!food || !st || !st.pet) return false;
    if (st.points < food.price) {
      SFX.wrong();
      notify(`Not enough stars! Need ${food.price - st.points} more ★`, "error");
      return false;
    }
    // Get current decayed values, then apply boost
    const cur = getPetCare(st) || { hunger: 80, happiness: 80 };
    const newHunger = Math.min(100, cur.hunger + food.hunger);
    const newHappiness = Math.min(100, cur.happiness + food.happiness);
    const newS = students.map(s => s.id === studentId ? {
      ...s,
      points: s.points - food.price,
      petCare: {
        ...(s.petCare || {}),
        hunger: newHunger,
        happiness: newHappiness,
        lastFedAt: Date.now(),
        lastUpdated: Date.now(),
      },
    } : s);
    persist(null, newS);
    SFX.collect();
    notify(`${food.emoji} ${food.name} fed! +${food.hunger} hunger, +${food.happiness} happiness`);
    return true;
  };

  // Walk completion — boosts happiness, awards a tiny star bonus
  const walkPet = (studentId, happinessBoost = 25, starBonus = 0) => {
    const st = students.find(s => s.id === studentId);
    if (!st || !st.pet) return;
    const cur = getPetCare(st) || { hunger: 80, happiness: 80 };
    const newHappiness = Math.min(100, cur.happiness + happinessBoost);
    const newS = students.map(s => s.id === studentId ? {
      ...s,
      points: s.points + starBonus,
      petCare: {
        ...(s.petCare || {}),
        hunger: cur.hunger, // hunger doesn't change on walk
        happiness: newHappiness,
        lastUpdated: Date.now(),
      },
    } : s);
    persist(null, newS);
    SFX.levelUp();
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

  const logout = () => { setUser(null); setScreen("login"); setSelectedStudent(null); setShowManage(false); setShowAddStudent(false); setShowWordle(false); setShowQuiz(false); setShowMission(false); setShowQuizPicker(false); setShowMissionPicker(false); setShowQuizUpload(false); setShowMissionUpload(false); setShowAccessories(false); setShowPetMart(false); setShowCustomize(false); setShowAddExam(false); setExamTargetStudentId(null); setExamName(""); setExamDate(""); setExamTime("09:00"); setExamEmoji("📝"); setShowFoodShop(false); setShowMyPool(false); setShowWalk(false); setActiveGameType(null); setGameTypeChoiceMission(null); setCustomizeTarget("monkey"); };

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

  // Compute monkey positions on a NATURAL SCATTER layout based on count.
  // Uses Poisson-disk-style placement: deterministic seed + minimum distance constraint
  // so monkeys never overlap but don't look like a rigid grid.
  const monkeyPositions = useMemo(() => {
    const count = students.length;
    if (count === 0) return [];

    // Bounds (within monkey container, percentages)
    const xMin = 6, xMax = 82, yMin = 6, yMax = 60;
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    // Minimum allowed distance between monkey anchors (% units in container space).
    // Smaller for larger groups so they fit, but always enough to prevent visual overlap.
    const minDist =
      count <= 4  ? 30 :
      count <= 8  ? 22 :
      count <= 12 ? 16 :
      count <= 16 ? 13 :
                    11;

    // Deterministic pseudo-random based on seed (so positions are stable across renders).
    const rand = (n) => {
      const x = Math.sin(n * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };

    const positions = []; // { x, y }
    for (let i = 0; i < count; i++) {
      let best = null;
      let bestMinD = -1;
      // Try up to 80 candidate positions, keep the one farthest from already-placed monkeys.
      for (let attempt = 0; attempt < 80; attempt++) {
        const x = xMin + rand(i * 31 + attempt * 71 + 17) * xRange;
        const y = yMin + rand(i * 53 + attempt * 19 + 41) * yRange;
        // Find distance to nearest placed monkey
        let nearest = Infinity;
        for (const p of positions) {
          const dx = x - p.x, dy = y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < nearest) nearest = d;
        }
        // Accept early if we have enough space
        if (nearest >= minDist) {
          best = { x, y };
          break;
        }
        // Otherwise track the candidate with the most space
        if (nearest > bestMinD) {
          bestMinD = nearest;
          best = { x, y };
        }
      }
      positions.push(best);
    }

    return positions.map(p => ({ left: `${p.x}%`, top: `${p.y}%` }));
  }, [students.length]);

  const inputStyle = {
    padding: "14px 18px", borderRadius: 14, border: `2px solid ${C.fur2}50`,
    background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive",
    fontSize: 18, color: C.text, outline: "none", width: "100%", boxSizing: "border-box",
  };

  // Speech-bubble message generator for the BirdFlock — must be declared before any
  // conditional return so the hook order stays stable across renders.
  const getFlockMessage = useCallback(() => {
    if (screen === "teacher") {
      return getTeacherUpdate(students);
    } else if (screen === "student") {
      const meStudent = students.find(s => s.id === user?.id);
      return getStudentReminder(meStudent, quizzes, missions);
    }
    return null;
  }, [screen, students, user?.id, quizzes, missions]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg, fontFamily: "'Patrick Hand', cursive" }}>
      <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
      <WatercolorFilters /><GlobalKeyframes />
      <div style={{ textAlign: "center" }}><MonkeySVG size={100} mood="happy" delay={0} /><p style={{ fontSize: 22, color: C.text, marginTop: 12 }}>Warming up the hot spring...</p></div>
    </div>
  );

  /* ── LOGIN ── */
  if (screen === "login") {
    const loginBg = themeMode === "rainbow"
      ? C.bg // direct rainbow gradient
      : `linear-gradient(160deg, ${C.snow1} 0%, ${C.bg} 40%, ${themeMode === "dark" ? "#0a0c14" : "#e2d0c0"} 100%)`;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: loginBg, backgroundSize: themeMode === "rainbow" ? "400% 400%" : undefined, animation: themeMode === "rainbow" ? "rainbowShift 18s ease infinite" : undefined, fontFamily: "'Patrick Hand', cursive", position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
        <WatercolorFilters /><GlobalKeyframes /><SnowParticles />
        {/* Theme toggle in top-right corner */}
        <button onClick={toggleTheme}
          title={themeTitle}
          style={{
            position: "absolute", top: 18, right: 18, zIndex: 50,
            padding: "10px 14px", borderRadius: 999, border: `2px solid ${C.fur2}40`,
            background: `${C.card}ee`, color: C.text, fontFamily: "'Patrick Hand', cursive",
            fontSize: 20, cursor: "pointer", lineHeight: 1, minWidth: 48,
            boxShadow: "0 4px 14px rgba(0,0,0,0.1)",
          }}>
          {themeIcon}
        </button>
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
            <div style={{ position: "relative" }}>
              <input value={password} onChange={e => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                style={{ ...inputStyle, paddingRight: 48, width: "100%", boxSizing: "border-box" }} />
              <button type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer",
                  fontSize: 20, color: C.textLight, padding: "6px 10px",
                  lineHeight: 1,
                }}>
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            {loginError && <p style={{ color: C.accentDark, fontSize: 15, margin: 0, textAlign: "center" }}>{loginError}</p>}
            <button onClick={handleLogin}
              style={{ padding: "15px", borderRadius: 14, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, color: "white", fontFamily: "'Patrick Hand', cursive", fontSize: 21, fontWeight: 700, boxShadow: `0 6px 16px ${C.accent}50`, transition: "transform 0.2s", marginTop: 4 }}
              onMouseEnter={e => e.target.style.transform = "translateY(-2px)"} onMouseLeave={e => e.target.style.transform = "translateY(0)"}>
              Enter the Hot Spring →
            </button>
          </div>
          <p style={{ textAlign: "center", color: C.textLight, fontSize: 13, marginTop: 18, marginBottom: 0 }}>
            {loginTab === "teacher" ? "Use your teacher credentials to log in" : "Ask your teacher for login details"}
          </p>
        </div>
      </div>
    );
  }

  // Speech-bubble message generator for the BirdFlock — provides reminders for students
  // and update notifications for teachers. Memoized so the flock effect doesn't churn.
  /* ── TEACHER ── */
  if (screen === "teacher") {
    const sel = students.find(s => s.id === selectedStudent);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, backgroundSize: themeMode === "rainbow" ? "400% 400%" : undefined, animation: themeMode === "rainbow" ? "rainbowShift 18s ease infinite" : undefined, fontFamily: "'Patrick Hand', cursive", position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
        <WatercolorFilters /><GlobalKeyframes /><SnowParticles />
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
            <button onClick={toggleTheme}
              title={themeTitle}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {themeIcon}
            </button>
            <button onClick={toggleSound}
              title={soundOn ? "Mute sounds" : "Unmute sounds"}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {soundOn ? "🔊" : "🔇"}
            </button>
            <button onClick={toggleShowNames}
              title={showNames ? "Hide names" : "Show names"}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {showNames ? "🏷️" : "🚫"}
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
                          {(m.type === "any" ? "🚀" : m.type === "runner" ? "🏃" : m.type === "flappy" ? "❄️" : "🧩")} {m.name} · {m.questions.length}Q · {m.points}★
                        </div>
                        <button onClick={() => { if (confirm(`Remove "${m.name}"?`)) removeMissionFromStudent(s.id, m.id); }}
                          style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: C.accentDark, cursor: "pointer", fontSize: 11 }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Inspirational quotes section */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>💬 Quotes for {s.name} ({(s.teacherQuotes || []).length})</div>
                    {(s.teacherQuotes || []).map((q, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: `${C.gold}15`, borderRadius: 6, marginBottom: 2 }}>
                        <div style={{ flex: 1, fontSize: 12, color: C.text, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{q}"</div>
                        <button onClick={() => deleteTeacherQuote(s.id, idx)}
                          style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: C.accentDark, cursor: "pointer", fontSize: 11 }}>
                          ✕
                        </button>
                      </div>
                    ))}
                    <QuoteInput onAdd={(text) => addTeacherQuote(s.id, text)} />
                  </div>

                  {/* Exams section */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>📅 Exams ({(s.exams || []).length})</div>
                      <button onClick={() => { setExamTargetStudentId(s.id); setShowAddExam(true); }}
                        style={{ padding: "3px 10px", borderRadius: 8, border: "none", background: `${C.accent}25`, color: C.accent, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 12, fontWeight: 700 }}>
                        + Add
                      </button>
                    </div>
                    {(s.exams || []).length === 0 && <div style={{ fontSize: 11, color: C.textLight, fontStyle: "italic", paddingLeft: 4 }}>No exams scheduled</div>}
                    {sortExams(s.exams || []).map(e => {
                      const cd = getCountdown(e.dateMs);
                      return (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: `${C.accent}10`, borderRadius: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 14 }}>{e.emoji}</span>
                          <div style={{ flex: 1, fontSize: 12, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {e.name} · {cd.passed ? "today!" : cd.days > 0 ? `${cd.days}d` : `${cd.hours}h`}
                          </div>
                          <button onClick={() => deleteExam(s.id, e.id)}
                            style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: C.accentDark, cursor: "pointer", fontSize: 11 }}>
                            ✕
                          </button>
                        </div>
                      );
                    })}
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
            // Mission type is now "any" — student picks the game when they play
            const result = addMissionForStudent(missionUploadStudentId, csvText, csvName, csvPoints, "any");
            if (result.error) { setCsvError(result.error); return; }
            notify(`Mission "${csvName || "Mission"}" added for ${targetStudent?.name}: ${result.success} questions!`);
            setShowMissionUpload(false);
            setCsvText(""); setCsvName(""); setCsvPoints(5); setCsvError("");
          };
          return (
            <div style={modalBackdropStyle} onClick={() => setShowMissionUpload(false)}>
              <div style={{ ...modalCardStyle, width: 580, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>🚀 Add Mission for {targetStudent?.name}</h2>
                  <button onClick={() => setShowMissionUpload(false)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
                </div>

                <div style={{ background: `${C.green}15`, borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13, color: C.text, border: `1px solid ${C.green}30` }}>
                  <strong>📋 How missions work:</strong> Upload a single CSV of questions. When the student plays, they'll choose how they want to answer them — 🧩 Block Blast (Tetris-style puzzle), 🏃 Fruit Runner (jump over fruits), or ❄️ Icicle Flap (flap between icicles). Same questions, three ways to play!
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4 }}>Mission name</label>
                    <input type="text" value={csvName} onChange={e => setCsvName(e.target.value)}
                      placeholder="e.g. Math Mission Week 1"
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
          <BirdFlock getMessage={getFlockMessage} />
          {/* Exam countdown: shows selected student's exams; hidden otherwise so it doesn't clutter */}
          {sel && (
            <ExamCountdown
              exams={sel.exams || []}
              quotes={getQuotePool(sel)}
              isOpen={examsOpen}
              onToggleOpen={() => setExamsOpen(o => !o)}
              isExpanded={examsListExpanded}
              onToggleExpanded={() => setExamsListExpanded(e => !e)}
              onAddClick={() => { setExamTargetStudentId(sel.id); setShowAddExam(true); }}
              onDelete={(eid) => deleteExam(sel.id, eid)}
              canEdit={true}
            />
          )}
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
                  <MonkeySVG size={students.length > 10 ? 80 : students.length > 6 ? 95 : 110} mood={s.points > 20 ? "excited" : s.points > 5 ? "happy" : "neutral"} label={showNames ? s.name : null} points={s.points} delay={i * 0.4} variant={i} accessories={s.accessories || []} pet={s.pet} petAccessories={s.petAccessories || []} ownedPets={s.ownedPets || []} streakLevel={getStreakLevel(getEffectiveStreak(s)).id} selected={selectedStudent === s.id} onClick={() => setSelectedStudent(selectedStudent === s.id ? null : s.id)} />
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

        {/* Add Exam modal (also rendered in teacher scene so 'Add Exam' button works) */}
        {showAddExam && examTargetStudentId && (
          <div style={modalBackdropStyle} onClick={() => setShowAddExam(false)}>
            <div style={{ ...modalCardStyle, width: 460, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
              <h2 style={{ margin: "0 0 14px", color: C.text, fontSize: 24 }}>📅 Add Exam</h2>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Exam name</label>
                <input type="text" value={examName} onChange={e => setExamName(e.target.value)}
                  placeholder="e.g. Math Final, Spelling Test"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: C.text, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Date</label>
                  <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: C.text, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Time</label>
                  <input type="time" value={examTime} onChange={e => setExamTime(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: C.text, boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Choose an emoji</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {["📝","📚","🧪","🔬","📖","🎓","✏️","📐","🌍","🎨","🎵","⚽","🏀","🇫🇷","🇪🇸","🇨🇳","🇯🇵","💻","⚛️","🧬"].map(emo => (
                    <button key={emo} onClick={() => setExamEmoji(emo)}
                      style={{
                        padding: "6px 8px", fontSize: 22, lineHeight: 1, cursor: "pointer",
                        border: examEmoji === emo ? `2px solid ${C.accent}` : `2px solid transparent`,
                        background: examEmoji === emo ? `${C.accent}15` : "transparent",
                        borderRadius: 10,
                      }}>{emo}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddExam(false); setExamName(""); setExamDate(""); }}
                  style={{ padding: "10px 18px", borderRadius: 12, border: `2px solid ${C.fur2}40`, background: "transparent", color: C.textLight, fontFamily: "'Patrick Hand', cursive", fontSize: 16, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => submitExam(examTargetStudentId)}
                  disabled={!examName.trim() || !examDate}
                  style={{
                    ...primaryBtnStyle,
                    opacity: !examName.trim() || !examDate ? 0.5 : 1,
                    cursor: !examName.trim() || !examDate ? "not-allowed" : "pointer",
                  }}>
                  ✓ Add Exam
                </button>
              </div>
            </div>
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
      <div style={{ minHeight: "100vh", background: C.bg, backgroundSize: themeMode === "rainbow" ? "400% 400%" : undefined, animation: themeMode === "rainbow" ? "rainbowShift 18s ease infinite" : undefined, fontFamily: "'Patrick Hand', cursive", position: "relative", overflow: "hidden" }}>
        <link href="https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap" rel="stylesheet" />
        <WatercolorFilters /><GlobalKeyframes /><SnowParticles />

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
            <button onClick={toggleTheme}
              title={themeTitle}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {themeIcon}
            </button>
            <button onClick={toggleSound}
              title={soundOn ? "Mute sounds" : "Unmute sounds"}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {soundOn ? "🔊" : "🔇"}
            </button>
            <button onClick={toggleShowNames}
              title={showNames ? "Hide names" : "Show names"}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `2px solid ${C.fur2}30`,
                background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive",
                fontSize: 18, cursor: "pointer", lineHeight: 1, minWidth: 42,
              }}>
              {showNames ? "🏷️" : "🚫"}
            </button>
            <button onClick={logout} style={{ padding: "9px 18px", borderRadius: 12, border: `2px solid ${C.fur2}40`, background: `${C.card}dd`, color: C.text, fontFamily: "'Patrick Hand', cursive", fontSize: 15, cursor: "pointer" }}>🚪 Logout</button>
          </div>
        </div>

        {/* Wordle modal */}
        {showWordle && <WordleGame onWin={handleWordleWin} onLose={handleWordleLose} onClose={() => setShowWordle(false)} />}

        {/* Add Exam modal */}
        {showAddExam && examTargetStudentId && (
          <div style={modalBackdropStyle} onClick={() => setShowAddExam(false)}>
            <div style={{ ...modalCardStyle, width: 460, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
              <h2 style={{ margin: "0 0 14px", color: C.text, fontSize: 24 }}>📅 Add Exam</h2>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Exam name</label>
                <input type="text" value={examName} onChange={e => setExamName(e.target.value)}
                  placeholder="e.g. Math Final, Spelling Test"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: C.text, boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Date</label>
                  <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: C.text, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Time</label>
                  <input type="time" value={examTime} onChange={e => setExamTime(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `2px solid ${C.fur2}40`, background: `${C.snow1}90`, fontFamily: "'Patrick Hand', cursive", fontSize: 16, color: C.text, boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, color: C.textLight, display: "block", marginBottom: 4, fontWeight: 700 }}>Choose an emoji</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {["📝","📚","🧪","🔬","📖","🎓","✏️","📐","🌍","🎨","🎵","⚽","🏀","🇫🇷","🇪🇸","🇨🇳","🇯🇵","💻","⚛️","🧬"].map(emo => (
                    <button key={emo} onClick={() => setExamEmoji(emo)}
                      style={{
                        padding: "6px 8px", fontSize: 22, lineHeight: 1, cursor: "pointer",
                        border: examEmoji === emo ? `2px solid ${C.accent}` : `2px solid transparent`,
                        background: examEmoji === emo ? `${C.accent}15` : "transparent",
                        borderRadius: 10,
                      }}>{emo}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => { setShowAddExam(false); setExamName(""); setExamDate(""); }}
                  style={{ padding: "10px 18px", borderRadius: 12, border: `2px solid ${C.fur2}40`, background: "transparent", color: C.textLight, fontFamily: "'Patrick Hand', cursive", fontSize: 16, cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={() => submitExam(examTargetStudentId)}
                  disabled={!examName.trim() || !examDate}
                  style={{
                    ...primaryBtnStyle,
                    opacity: !examName.trim() || !examDate ? 0.5 : 1,
                    cursor: !examName.trim() || !examDate ? "not-allowed" : "pointer",
                  }}>
                  ✓ Add Exam
                </button>
              </div>
            </div>
          </div>
        )}

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
                      onClick={() => {
                        // Backward-compat: if mission has a hardcoded old type, run it directly.
                        // New "any" missions open the game-type chooser.
                        if (m.type && m.type !== "any") {
                          setActiveMissionId(m.id);
                          setActiveGameType(m.type);
                          setShowMissionPicker(false);
                          setShowMission(true);
                        } else {
                          setGameTypeChoiceMission(m);
                          setShowMissionPicker(false);
                        }
                      }}
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
                        <div style={{ fontWeight: 700, fontSize: 17 }}>{(m.type === "any" ? "🚀" : m.type === "runner" ? "🏃" : m.type === "flappy" ? "❄️" : "🧩")} {m.name}</div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{m.type === "any" ? "Choose how to play" : m.type === "runner" ? "Fruit Runner" : m.type === "flappy" ? "Icicle Flap" : "Block Blast"} · {m.questions.length} questions</div>
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

        {/* Game type chooser - shown after a student picks an "any"-type mission */}
        {gameTypeChoiceMission && me && (
          <div style={modalBackdropStyle} onClick={() => setGameTypeChoiceMission(null)}>
            <div style={{ ...modalCardStyle, width: 540, maxWidth: "95vw" }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <h2 style={{ margin: 0, color: C.text, fontSize: 22 }}>🎮 Choose your game</h2>
                <button onClick={() => setGameTypeChoiceMission(null)} style={{ background: "none", border: "none", fontSize: 22, color: C.textLight, cursor: "pointer" }}>✕</button>
              </div>
              <p style={{ margin: "0 0 14px", color: C.textLight, fontSize: 14 }}>
                <strong style={{ color: C.text }}>{gameTypeChoiceMission.name}</strong> · {gameTypeChoiceMission.questions.length} questions · ★ {gameTypeChoiceMission.points}
              </p>
              <p style={{ margin: "0 0 12px", color: C.textLight, fontSize: 13 }}>
                Same questions, three different ways to play. Pick whichever you feel like!
              </p>
              {(() => {
                // Show progress badges for save/resume game types
                const completions = me.completions || {};
                const choices = [
                  {
                    id: "blockblast",
                    emoji: "🧩",
                    title: "Block Blast",
                    desc: "Tetris-style puzzle. Place blocks, then answer questions.",
                    color: "#a060c0",
                    progress: null, // Block Blast has no save/resume
                  },
                  {
                    id: "runner",
                    emoji: "🏃",
                    title: "Fruit Runner",
                    desc: "Run & jump over fruits. Every 5 fruits = a checkpoint.",
                    color: "#5caa5e",
                    progress: completions[`mission:${gameTypeChoiceMission.id}:runner`]?.progress || null,
                  },
                  {
                    id: "flappy",
                    emoji: "❄️",
                    title: "Icicle Flap",
                    desc: "Flap between icicles. Every 4 icicles = a checkpoint.",
                    color: "#5a8fc7",
                    progress: completions[`mission:${gameTypeChoiceMission.id}:flappy`]?.progress || null,
                  },
                ];
                return (
                  <div style={{ display: "grid", gap: 10 }}>
                    {choices.map(c => {
                      const hasProgress = c.progress && (c.progress.questionsAnswered > 0 || c.progress.score > 0);
                      return (
                        <button key={c.id}
                          onClick={() => {
                            const m = gameTypeChoiceMission;
                            setGameTypeChoiceMission(null);
                            setActiveMissionId(m.id);
                            setActiveGameType(c.id);
                            setShowMission(true);
                          }}
                          style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 16px", borderRadius: 14,
                            background: `${c.color}10`,
                            border: `2px solid ${c.color}40`,
                            cursor: "pointer", fontFamily: "'Patrick Hand', cursive",
                            color: C.text, textAlign: "left",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = `${c.color}25`}
                          onMouseLeave={e => e.currentTarget.style.background = `${c.color}10`}
                        >
                          <div style={{ fontSize: 38, lineHeight: 1 }}>{c.emoji}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 18, color: c.color, marginBottom: 2 }}>
                              {c.title}
                              {hasProgress && (
                                <span style={{
                                  marginLeft: 8, fontSize: 11, background: C.gold, color: "white",
                                  padding: "2px 8px", borderRadius: 999, fontWeight: 700, verticalAlign: "middle",
                                }}>
                                  💾 {c.progress.questionsAnswered}/{gameTypeChoiceMission.questions.length}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: C.textLight, lineHeight: 1.3 }}>{c.desc}</div>
                          </div>
                          <div style={{ fontSize: 22, color: c.color, opacity: 0.7 }}>→</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

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
              onShop={() => setShowFoodShop(true)}
            />
          );
        })()}

        {/* Mission modal - dispatches to the right game type */}
        {showMission && me && (() => {
          const activeMission = (missions[me.id] || []).find(m => m.id === activeMissionId);
          if (!activeMission) { setShowMission(false); return null; }
          const closeFn = () => { setShowMission(false); setActiveMissionId(null); setActiveGameType(null); };
          // Use activeGameType (chosen by student) — fall back to mission.type for legacy missions
          const gameType = activeGameType || (activeMission.type !== "any" ? activeMission.type : "blockblast");
          // Progress is keyed per game type so each mode keeps its own checkpoint
          const progressKey = `mission:${activeMission.id}:${gameType}`;
          if (gameType === "runner") {
            const savedProgress = me.completions?.[progressKey]?.progress || null;
            return (
              <RunnerGame
                studentName={me.name}
                mission={activeMission}
                savedProgress={savedProgress}
                onClose={closeFn}
                onComplete={(data) => handleMissionComplete({ ...data, gameType })}
                onShop={() => setShowFoodShop(true)}
              />
            );
          }
          if (gameType === "flappy") {
            const savedProgress = me.completions?.[progressKey]?.progress || null;
            return (
              <FlappyGame
                studentName={me.name}
                mission={activeMission}
                savedProgress={savedProgress}
                onClose={closeFn}
                onComplete={(data) => handleMissionComplete({ ...data, gameType })}
                onShop={() => setShowFoodShop(true)}
              />
            );
          }
          return (
            <MissionGame
              studentName={me.name}
              mission={activeMission}
              onClose={closeFn}
              onComplete={(data) => handleMissionComplete({ ...data, gameType })}
              onShop={() => setShowFoodShop(true)}
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
              {/* My Hot Spring button - opens personal scene with monkey & all pets */}
              {(() => {
                const myCare = getPetCare(me);
                const careLbl = myCare ? getCareLabel(myCare.avgCare) : null;
                const accent = careLbl ? careLbl.color : C.water1;
                const needsAttention = me.pet && myCare && myCare.avgCare < 30;
                return (
                  <button onClick={() => { SFX.click(); setShowMyPool(true); }}
                    style={{
                      padding: "10px 22px", borderRadius: 16,
                      border: `2px solid ${accent}80`,
                      background: `${C.card}ee`,
                      color: C.text,
                      fontFamily: "'Patrick Hand', cursive", fontSize: 17, fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: `0 4px 14px ${accent}40`,
                      transition: "all 0.3s", display: "flex", alignItems: "center", gap: 8,
                      backdropFilter: "blur(8px)",
                      position: "relative",
                    }}>
                    🌸 My Hot Spring
                    {careLbl && me.pet && <span style={{ fontSize: 14 }}>{careLbl.emoji}</span>}
                    {needsAttention && (
                      <span style={{
                        position: "absolute", top: -6, right: -6,
                        background: C.accent, color: "white", fontSize: 11, fontWeight: 700,
                        padding: "2px 7px", borderRadius: 999,
                        boxShadow: `0 2px 8px ${C.accent}80`,
                        animation: "incomeBadgePulse 1.4s ease-in-out infinite",
                      }}>!</span>
                    )}
                  </button>
                );
              })()}
            </div>
          );
        })()}

        {/* Customize Monkey modal - student dresses up own monkey */}
        {showCustomize && me && (() => {
          const isPetMode = customizeTarget === "pet" && me.pet;
          // Choose the catalog and equipped lists based on target
          const owned = isPetMode ? (me.ownedPetAccessories || []) : (me.ownedAccessories || []);
          const equipped = isPetMode ? (me.petAccessories || []) : (me.accessories || []);
          const catalog = isPetMode ? PET_ACCESSORY_CATALOG : ACCESSORY_CATALOG;
          const slots = isPetMode ? PET_ACCESSORY_SLOTS : ACCESSORY_SLOTS;
          const visibleAccessories = catalog.filter(a => {
            if (customizeTab === "owned") return a.price === 0 || owned.includes(a.id);
            if (customizeTab === "shop") return a.price > 0;
            return true;
          });
          const bySlot = {};
          visibleAccessories.forEach(a => {
            if (!bySlot[a.slot]) bySlot[a.slot] = [];
            bySlot[a.slot].push(a);
          });
          const slotLabels = isPetMode
            ? { head: "🎀 Head", neck: "📿 Neck", back: "🦋 Back" }
            : { head: "🎩 Head", face: "🕶️ Face", neck: "🧣 Neck", hold: "🎾 Hold", back: "🦋 Back" };
          const onItemClick = (acc, isOwned, canAfford) => {
            if (isOwned) {
              if (isPetMode) togglePetAccessory(me.id, acc.id);
              else toggleAccessory(me.id, acc.id);
            } else if (canAfford && window.confirm(`Buy ${acc.name} for ${acc.price} ★?`)) {
              if (isPetMode) buyPetAccessory(me.id, acc.id);
              else buyAccessory(me.id, acc.id);
            } else if (!canAfford) {
              SFX.wrong();
              notify(`Need ${acc.price - me.points} more ★`, "error");
            }
          };
          const onClearAll = () => {
            if (isPetMode) clearPetAccessories(me.id);
            else clearAccessories(me.id);
          };

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
                    accessories={me.accessories || []} pet={me.pet}
                    petAccessories={me.petAccessories || []}
                    ownedPets={me.ownedPets || []}
                    streakLevel={getStreakLevel(getEffectiveStreak(me)).id} />
                  <div style={{ minWidth: 140 }}>
                    <div style={{ fontSize: 14, color: C.textLight, marginBottom: 2 }}>Stars</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: C.gold, marginBottom: 8 }}>★ {me.points}</div>
                    <div style={{ fontSize: 13, color: C.textLight }}>
                      {equipped.length} equipped · {owned.length} owned
                    </div>
                    <button onClick={onClearAll}
                      style={{ marginTop: 10, padding: "6px 12px", borderRadius: 10, border: `2px solid ${C.accent}40`, background: "transparent", color: C.accentDark, cursor: "pointer", fontFamily: "'Patrick Hand', cursive", fontSize: 13, fontWeight: 600 }}>
                      Remove All
                    </button>
                  </div>
                </div>

                {/* Target toggle: Monkey / Pet (only show Pet if student has a pet) */}
                {me.pet && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "center" }}>
                    {[
                      { id: "monkey", label: "🐵 Monkey" },
                      { id: "pet", label: `🐾 Pet (${getPet(me.pet)?.emoji || ""})` },
                    ].map(t => (
                      <button key={t.id} onClick={() => setCustomizeTarget(t.id)}
                        style={{
                          padding: "9px 22px", borderRadius: 14,
                          border: customizeTarget === t.id ? `2.5px solid ${C.gold}` : `2px solid ${C.fur2}30`,
                          background: customizeTarget === t.id ? `${C.gold}25` : `${C.snow1}80`,
                          color: customizeTarget === t.id ? C.text : C.textLight,
                          fontFamily: "'Patrick Hand', cursive", fontSize: 16, fontWeight: 700, cursor: "pointer",
                          transition: "all 0.2s",
                        }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, justifyContent: "center" }}>
                  {[
                    { id: "all", label: "All" },
                    { id: "owned", label: `My Items (${owned.length + catalog.filter(a => a.price === 0).length})` },
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
                {slots.map(slot => {
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
                              onClick={() => onItemClick(acc, isOwned, canAfford)}>
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

        {/* Food Shop modal - feed your pet */}
        {showFoodShop && me && (
          <FoodShop
            student={me}
            onClose={() => setShowFoodShop(false)}
            onBuy={(foodId) => feedPet(me.id, foodId)}
          />
        )}

        {/* My Hot Spring modal - personal scene with monkey & pets */}
        {showMyPool && me && (
          <MyPool
            student={me}
            onClose={() => setShowMyPool(false)}
            onShop={() => { setShowMyPool(false); setShowFoodShop(true); }}
            onWalk={() => { setShowMyPool(false); setShowWalk(true); }}
            onPetMart={() => { setPetMartTab("packs"); setShowPetMart(true); }}
          />
        )}

        {/* Walk mini-game */}
        {showWalk && me && (
          <WalkGame
            student={me}
            onClose={() => setShowWalk(false)}
            onComplete={(happinessBoost, starBonus) => {
              walkPet(me.id, happinessBoost, starBonus);
              if (starBonus > 0) notify(`🚶 Walk complete! +${happinessBoost}💖 +${starBonus}★`);
              else notify(`🚶 Walk complete! +${happinessBoost} happiness for your pet!`);
            }}
          />
        )}

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
          <BirdFlock getMessage={getFlockMessage} />
          <ExamCountdown
            exams={me?.exams || []}
            quotes={getQuotePool(me)}
            isOpen={examsOpen}
            onToggleOpen={() => setExamsOpen(o => !o)}
            isExpanded={examsListExpanded}
            onToggleExpanded={() => setExamsListExpanded(e => !e)}
            onAddClick={() => { setExamTargetStudentId(me?.id); setShowAddExam(true); }}
            onDelete={(eid) => deleteExam(me?.id, eid)}
            canEdit={true}
            personalQuotes={me?.personalQuotes || []}
            onAddPersonalQuote={(text) => addPersonalQuote(me?.id, text)}
            onDeletePersonalQuote={(idx) => deletePersonalQuote(me?.id, idx)}
          />

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
                    label={showNames ? s.name : null} points={s.points}
                    delay={i * 0.4} variant={i}
                    accessories={s.accessories || []}
                    pet={s.pet}
                    petAccessories={s.petAccessories || []}
                    ownedPets={s.ownedPets || []}
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
                  position: "absolute", top: examsOpen ? 280 : 70, left: 16, zIndex: 30,
                  background: `${C.card}e8`, borderRadius: 999, padding: "8px 16px",
                  boxShadow: `0 6px 20px ${myLevel.color}40`, backdropFilter: "blur(10px)",
                  border: `2px solid ${myLevel.color}80`, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  fontFamily: "'Patrick Hand', cursive", fontSize: 16, fontWeight: 700, color: C.text,
                  transition: "top 0.3s ease",
                }}
                title="Show streak progress"
              >
                <span style={{ fontSize: 18 }}>🔥</span>
                <span>{myStreak} day{myStreak !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 14 }}>{myLevel.icon}</span>
              </button>
            ) : (
              <div style={{
                position: "absolute", top: examsOpen ? 280 : 70, left: 16, zIndex: 30,
                background: `${C.card}f0`, borderRadius: 18, padding: "14px 18px",
                boxShadow: `0 8px 28px ${myLevel.color}30`, backdropFilter: "blur(10px)",
                border: `2px solid ${myLevel.color}60`, width: 260,
                transition: "top 0.3s ease",
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
