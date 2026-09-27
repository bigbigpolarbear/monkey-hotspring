export const VALID_FIVE_LETTER_GUESSES = Object.freeze(`
about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert algae alien align alive allow alone along alter amino angel anger angle angry ankle apple apply arena argue arise armor aroma array arrow aside atlas audio audit avoid awake award aware awful badge baker bases basic basin basis beach beard beast began begin being below bench berry birth black blade blame bland blank blast blaze bleed blend bless blind block blood bloom blown blues blunt board boast bonus boost booth bound brain brand brave bread break breed brick bride brief bring broad broke brown brush build built buyer cabin camel candy carry carve catch cause cease chain chair chalk charm chart chase cheap check cheek chest chief child chill china chord civic claim class clean clear clerk click cliff climb clock close cloud clown coach coast coral count court cover crack craft crane crash crazy cream creek crime crisp crown crude crush curve daily dairy dance dealt death debut delay delta dense depot depth diary digit diner dirty disco ditch diver dizzy doubt dozen draft drain drama dream dress drift drill drink drive earth eight elbow elder elect elite empty enemy enjoy enter entry epoch equal error essay ethic event every exact exist extra fairy faith false fancy fault fauna feast field fiery fifth fifty fight final first flame flare flash fleet floor flora flour focus force forum frame fresh front frost fruit fungi giant given glass globe glory grace grade grain grand grant grape graph grass great green grief group grown guard guess guest guild habit happy haste heart heavy honey horse hotel house hover human ideal image index inlet ionic ivory jelly joker jolly juice kayak kneel label labor large laser later laugh layer learn least lemon light lilac limit lipid liver logic loose lunar magic major maker mango maple march marsh match maybe mayor medal media mercy metal might minor model molar money month moral motor mount mouse mouth movie music myths nerve never night noble north novel nurse ocean offer often olive opera optic orbit order other ounce outer owner oxide paint panel panic paper party patch peace pearl phase piano piece pilot pitch place plane plant plate plaza point polar power prime print prize proof prose proud queen quest quick quiet radar radio raise range ratio reach realm reign renal reply right ridge river robin rough round royal ruler salad scale scene scope score sense serfs serve seven shade shake shall shape share sharp sheet shelf shell shift shine shirt shock short shown sight sigma since skill sleep slope small smart smile smoke solid solve sorry sound south space spare speak speed spend spice split spore sport staff stage stand stare start state steam steel steep stick still stock stone store storm story strip study stuff style sugar sunny table tally taste teach terms thank theme there thick thing think theta third tiger tight title today toxin trade train treat trend tribe trick truth tulip ultra union unity urban value vault verse vivid voice water wheat whale where which while white whole winds woman world worry worth write wrong youth zebra
toast bliss eagle igloo jewel valor yield acorn daisy flock oasis ember genes magma biome quark anion moles radon argon ozone stoma polis canon lyric creed caste exile deity mural units roots
`.trim().split(/\s+/));

export const VALID_TEN_LETTER_GUESSES = Object.freeze(`
abbreviate absorbable accelerate accessible accidental accomplice accountant accurately adjustment admiration aggressive allocation altogether ambassador ammunition analytical apprentice artificial atmosphere attractive background basketball birthplace calculated capability celebrated challenged combustion comparable compatible compulsory confidence connection consistent consultant contagious continuous contribute convenient coordinate correction curriculum decoration democratic determined dictionary difficulty discipline ecological efficiency electronic employment engagement enthusiasm equivalent especially everywhere excellence experiment expression federation foundation generation government historical horizontal importance impressive industrial ingredient initiative innovative instrument journalism leadership literature management meaningful navigation occupation parliament percentage population prediction productive psychology regulation remarkable resistance scientific settlement statistics successful technology television themselves tremendous university vocabulary wavelength wilderness
`.trim().split(/\s+/));

const FIVE_SET = new Set(VALID_FIVE_LETTER_GUESSES.map(word => word.toUpperCase()));
const TEN_SET = new Set(VALID_TEN_LETTER_GUESSES.map(word => word.toUpperCase()));

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isStraightSequence(word) {
  const reversed = word.split('').reverse().join('');
  if (KEYBOARD_ROWS.some(row => row.includes(word) || row.includes(reversed))) return true;
  if (ALPHABET.includes(word) || ALPHABET.split('').reverse().join('').includes(word)) return true;
  return false;
}

function isObviousKeyboardSmash(word) {
  if (/^(.)\1+$/.test(word)) return true;
  if (isStraightSequence(word)) return true;

  const joinedRows = [
    'QWERTYUIOPASDFGHJKLZXCVBNM',
    'ZXCVBNMASDFGHJKLQWERTYUIOP',
  ];
  if (joinedRows.some(row => row.includes(word))) return true;

  // A real English word almost always contains at least one vowel sound.
  // Including Y keeps words such as MYRRH from being rejected.
  if (!/[AEIOUY]/.test(word)) return true;

  return false;
}

export function isAllowedWordleGuess(value, length = 5) {
  const word = String(value || '').trim().toUpperCase();
  if (!new RegExp(`^[A-Z]{${length}}export const VALID_FIVE_LETTER_GUESSES = Object.freeze(`
about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert algae alien align alive allow alone along alter amino angel anger angle angry ankle apple apply arena argue arise armor aroma array arrow aside atlas audio audit avoid awake award aware awful badge baker bases basic basin basis beach beard beast began begin being below bench berry birth black blade blame bland blank blast blaze bleed blend bless blind block blood bloom blown blues blunt board boast bonus boost booth bound brain brand brave bread break breed brick bride brief bring broad broke brown brush build built buyer cabin camel candy carry carve catch cause cease chain chair chalk charm chart chase cheap check cheek chest chief child chill china chord civic claim class clean clear clerk click cliff climb clock close cloud clown coach coast coral count court cover crack craft crane crash crazy cream creek crime crisp crown crude crush curve daily dairy dance dealt death debut delay delta dense depot depth diary digit diner dirty disco ditch diver dizzy doubt dozen draft drain drama dream dress drift drill drink drive earth eight elbow elder elect elite empty enemy enjoy enter entry epoch equal error essay ethic event every exact exist extra fairy faith false fancy fault fauna feast field fiery fifth fifty fight final first flame flare flash fleet floor flora flour focus force forum frame fresh front frost fruit fungi giant given glass globe glory grace grade grain grand grant grape graph grass great green grief group grown guard guess guest guild habit happy haste heart heavy honey horse hotel house hover human ideal image index inlet ionic ivory jelly joker jolly juice kayak kneel label labor large laser later laugh layer learn least lemon light lilac limit lipid liver logic loose lunar magic major maker mango maple march marsh match maybe mayor medal media mercy metal might minor model molar money month moral motor mount mouse mouth movie music myths nerve never night noble north novel nurse ocean offer often olive opera optic orbit order other ounce outer owner oxide paint panel panic paper party patch peace pearl phase piano piece pilot pitch place plane plant plate plaza point polar power prime print prize proof prose proud queen quest quick quiet radar radio raise range ratio reach realm reign renal reply right ridge river robin rough round royal ruler salad scale scene scope score sense serfs serve seven shade shake shall shape share sharp sheet shelf shell shift shine shirt shock short shown sight sigma since skill sleep slope small smart smile smoke solid solve sorry sound south space spare speak speed spend spice split spore sport staff stage stand stare start state steam steel steep stick still stock stone store storm story strip study stuff style sugar sunny table tally taste teach terms thank theme there thick thing think theta third tiger tight title today toxin trade train treat trend tribe trick truth tulip ultra union unity urban value vault verse vivid voice water wheat whale where which while white whole winds woman world worry worth write wrong youth zebra
toast bliss eagle igloo jewel valor yield acorn daisy flock oasis ember genes magma biome quark anion moles radon argon ozone stoma polis canon lyric creed caste exile deity mural units roots
`.trim().split(/\s+/));

export const VALID_TEN_LETTER_GUESSES = Object.freeze(`
abbreviate absorbable accelerate accessible accidental accomplice accountant accurately adjustment admiration aggressive allocation altogether ambassador ammunition analytical apprentice artificial atmosphere attractive background basketball birthplace calculated capability celebrated challenged combustion comparable compatible compulsory confidence connection consistent consultant contagious continuous contribute convenient coordinate correction curriculum decoration democratic determined dictionary difficulty discipline ecological efficiency electronic employment engagement enthusiasm equivalent especially everywhere excellence experiment expression federation foundation generation government historical horizontal importance impressive industrial ingredient initiative innovative instrument journalism leadership literature management meaningful navigation occupation parliament percentage population prediction productive psychology regulation remarkable resistance scientific settlement statistics successful technology television themselves tremendous university vocabulary wavelength wilderness
`.trim().split(/\s+/));

const FIVE_SET = new Set(VALID_FIVE_LETTER_GUESSES.map(word => word.toUpperCase()));
const TEN_SET = new Set(VALID_TEN_LETTER_GUESSES.map(word => word.toUpperCase()));

).test(word)) return false;

  // Known words are always accepted.
  if (length === 5 && FIVE_SET.has(word)) return true;
  if (length === 10 && TEN_SET.has(word)) return true;

  // The dictionary is intentionally not treated as exhaustive. Unknown words
  // are accepted unless they are clearly keyboard-smash/gibberish. This avoids
  // rejecting legitimate words simply because our bundled list is incomplete.
  return !isObviousKeyboardSmash(word);
}
