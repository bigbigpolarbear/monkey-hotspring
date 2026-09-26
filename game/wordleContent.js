import { isAllowedWordleGuess } from './wordleDictionary.js';

export const STANDARD_WORDS = Object.freeze([
  'happy','smile','cloud','dream','light','music','dance','heart','beach','plant',
  'ocean','tiger','brave','candy','frost','jolly','magic','noble','peace','quiet',
  'river','sunny','toast','unity','vivid','water','youth','bliss','charm','crisp',
  'eagle','flame','grape','hover','ivory','juice','kneel','lemon','maple','novel',
  'olive','pearl','queen','robin','stone','train','ultra','voice','whale','zebra',
  'angel','bloom','crane','drift','earth','fairy','globe','honey','igloo','jewel',
  'lunar','marsh','night','orbit','piano','quest','ridge','steam','tulip','valor',
  'winds','yield','plaza','acorn','berry','coral','daisy','elbow','flock','grain',
  'haste','inlet','joker','kayak','lilac','mango','nurse','oasis','patch','radar',
  'salad','table','urban','vault','wheat','album','badge','camel','delta','ember'
]);

export const TOUGHEST_WORDS = Object.freeze([
  'analytical','atmosphere','curriculum','democratic','ecological','equivalent','foundation','historical',
  'horizontal','initiative','instrument','journalism','leadership','literature','parliament','prediction',
  'psychology','scientific','technology','vocabulary','wavelength','wilderness','compulsory','contagious',
  'continuous','contribute','coordinate','correction','discipline','generation'
]);

export const WORDLE_THEMES = Object.freeze({
  science: Object.freeze({
    label: 'Science',
    icon: '🧪',
    description: 'Biology, chemistry, physics and Earth science',
    words: Object.freeze([
      'molar','ionic','genes','oxide','orbit','magma','laser','nerve','algae','biome',
      'flora','fauna','spore','renal','optic','fungi','toxin','lipid','amino','polar',
      'quark','field','phase','solid','anion','moles','radon','argon','ozone','stoma'
    ]),
  }),
  humanities: Object.freeze({
    label: 'Humanities',
    icon: '🏛️',
    description: 'History, literature, civics and culture',
    words: Object.freeze([
      'civic','ethic','trade','reign','urban','myths','polis','guild','serfs','logic',
      'canon','prose','lyric','novel','drama','creed','realm','tribe','caste','exile',
      'ruler','royal','crown','deity','mural','verse','essay','atlas','forum','epoch'
    ]),
  }),
  maths: Object.freeze({
    label: 'Maths',
    icon: '📐',
    description: 'Number, algebra, geometry and probability',
    words: Object.freeze([
      'angle','ratio','prime','slope','graph','digit','theta','acute','equal','scale',
      'range','chord','point','curve','plane','solid','space','terms','value','units',
      'roots','power','sigma','delta','proof','order','round','count','tally','union'
    ]),
  }),
});

function hashKey(value = '') {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function getStandardWordle(dateKey) {
  return STANDARD_WORDS[hashKey(`standard:${dateKey}`) % STANDARD_WORDS.length].toUpperCase();
}

export function getChallengeWordle(dateKey, theme) {
  const bucket = WORDLE_THEMES[theme];
  if (!bucket) throw new Error('Choose Science, Humanities or Maths.');
  return bucket.words[hashKey(`challenge:${theme}:${dateKey}`) % bucket.words.length].toUpperCase();
}

export function getToughestWordle(dateKey) {
  return TOUGHEST_WORDS[hashKey(`toughest:${dateKey}`) % TOUGHEST_WORDS.length].toUpperCase();
}

export function validateWordleGuess(value, length = 5) {
  return isAllowedWordleGuess(value, length);
}

export function letterStates(guess, answer) {
  const wordLength = String(answer || '').length || String(guess || '').length || 5;
  const g = String(guess || '').toUpperCase().slice(0, wordLength).split('');
  const a = String(answer || '').toUpperCase().slice(0, wordLength).split('');
  const result = Array(wordLength).fill('absent');
  const used = Array(wordLength).fill(false);
  for (let i = 0; i < wordLength; i += 1) {
    if (g[i] && g[i] === a[i]) {
      result[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < wordLength; i += 1) {
    if (!g[i] || result[i] === 'correct') continue;
    for (let j = 0; j < wordLength; j += 1) {
      if (!used[j] && g[i] === a[j]) {
        result[i] = 'present';
        used[j] = true;
        break;
      }
    }
  }
  return result;
}
