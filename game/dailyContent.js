const VOCABULARY = [
  { word:'meticulous', partOfSpeech:'adjective', definition:'Very careful and precise.', example:'She was meticulous when checking every answer.', memory:'Tiny details matter to a meticulous person.', synonym:'thorough' },
  { word:'buttress', partOfSpeech:'verb', definition:'To support or strengthen something.', example:'The evidence helped buttress his argument.', memory:'A buttress holds something up — think “support”.', synonym:'support' },
  { word:'ambiguous', partOfSpeech:'adjective', definition:'Having more than one possible meaning.', example:'The ending was deliberately ambiguous.', memory:'If it could mean A or B, it is ambiguous.', synonym:'unclear' },
  { word:'concise', partOfSpeech:'adjective', definition:'Using few words while still being clear.', example:'Her concise summary covered every key point.', memory:'Concise cuts out the extra words.', synonym:'brief' },
  { word:'infer', partOfSpeech:'verb', definition:'To reach a conclusion using evidence and reasoning.', example:'From the wet pavement, we can infer that it rained.', memory:'Clues go in; a conclusion comes out.', synonym:'deduce' },
  { word:'substantiate', partOfSpeech:'verb', definition:'To support a claim with evidence.', example:'The scientist used data to substantiate the conclusion.', memory:'Substance = solid evidence behind a claim.', synonym:'verify' },
  { word:'pragmatic', partOfSpeech:'adjective', definition:'Focused on practical results rather than theory.', example:'They chose the most pragmatic solution to the problem.', memory:'Pragmatic asks: what will actually work?', synonym:'practical' },
  { word:'scrutinize', partOfSpeech:'verb', definition:'To examine something very carefully.', example:'The editor scrutinized every line before publication.', memory:'Scrutinize = zoom in and inspect.', synonym:'inspect' },
  { word:'coherent', partOfSpeech:'adjective', definition:'Logical, clear, and easy to follow.', example:'Her explanation was coherent from start to finish.', memory:'A coherent idea holds together.', synonym:'logical' },
  { word:'mitigate', partOfSpeech:'verb', definition:'To make something harmful or severe less serious.', example:'Trees can help mitigate extreme urban heat.', memory:'Mitigate means make the damage smaller.', synonym:'reduce' },
  { word:'nuance', partOfSpeech:'noun', definition:'A small but important difference in meaning or feeling.', example:'The actor captured every nuance of the character.', memory:'Nuance is the tiny shade between two similar ideas.', synonym:'subtlety' },
  { word:'corroborate', partOfSpeech:'verb', definition:'To confirm that a statement is true with additional evidence.', example:'A second witness helped corroborate the account.', memory:'Another clue backs it up.', synonym:'confirm' },
  { word:'inevitable', partOfSpeech:'adjective', definition:'Certain to happen and impossible to avoid.', example:'With dark clouds overhead, rain seemed inevitable.', memory:'If you cannot evade it, it is inevitable.', synonym:'unavoidable' },
  { word:'advocate', partOfSpeech:'verb', definition:'To publicly support or recommend something.', example:'Many students advocate for longer library hours.', memory:'An advocate uses their voice in support.', synonym:'support' },
  { word:'diminish', partOfSpeech:'verb', definition:'To become or make something smaller or less important.', example:'The noise began to diminish as the train moved away.', memory:'Diminish = decrease.', synonym:'decrease' },
  { word:'elaborate', partOfSpeech:'verb', definition:'To add more detail or explanation.', example:'Could you elaborate on your final point?', memory:'Elaborate expands an idea.', synonym:'explain' },
  { word:'plausible', partOfSpeech:'adjective', definition:'Seeming reasonable or likely to be true.', example:'Her explanation was plausible given the evidence.', memory:'Plausible sounds possible.', synonym:'believable' },
  { word:'resilient', partOfSpeech:'adjective', definition:'Able to recover quickly from difficulty.', example:'The resilient plant grew back after the storm.', memory:'Resilient things bounce back.', synonym:'tough' },
  { word:'synthesize', partOfSpeech:'verb', definition:'To combine ideas or information into a new whole.', example:'The essay synthesizes evidence from three sources.', memory:'Synthesize = mix ideas into one strong answer.', synonym:'combine' },
  { word:'validate', partOfSpeech:'verb', definition:'To confirm that something is accurate or acceptable.', example:'The experiment helped validate the prediction.', memory:'Validate checks that it is valid.', synonym:'confirm' },
];

const CHALLENGE_BANK = [
  { prompt:'Which of these is a renewable energy source?', options:['Coal','Natural gas','Wind','Oil'], correctIndex:2, explanation:'Wind is continually replenished by natural processes.' },
  { prompt:'What is 25% of 80?', options:['10','20','25','40'], correctIndex:1, explanation:'25% is one quarter, and one quarter of 80 is 20.' },
  { prompt:'Which sentence uses “their” correctly?', options:['Their going home.','The students packed their books.','Put it over their.','Their is a storm coming.'], correctIndex:1, explanation:'“Their” shows possession: the books belong to the students.' },
  { prompt:'Which organ pumps blood around the human body?', options:['Lung','Heart','Kidney','Stomach'], correctIndex:1, explanation:'The heart contracts to move blood through the circulatory system.' },
  { prompt:'A price rises from 50 to 60. What is the percentage increase?', options:['10%','20%','25%','50%'], correctIndex:1, explanation:'The increase is 10, and 10 ÷ 50 = 0.20 = 20%.' },
  { prompt:'Which word is closest in meaning to “rapid”?', options:['slow','quick','quiet','heavy'], correctIndex:1, explanation:'Rapid means happening very quickly.' },
  { prompt:'Which gas do plants take in during photosynthesis?', options:['Oxygen','Hydrogen','Carbon dioxide','Nitrogen'], correctIndex:2, explanation:'Plants use carbon dioxide and water to make glucose.' },
  { prompt:'What is the gradient of a horizontal line?', options:['0','1','Undefined','It changes'], correctIndex:0, explanation:'A horizontal line has no vertical change, so its gradient is 0.' },
  { prompt:'Which is an example of opportunity cost?', options:['The money already spent','The next best alternative you give up','Every possible choice','A discount'], correctIndex:1, explanation:'Opportunity cost is the value of the next best alternative forgone.' },
  { prompt:'Which punctuation best joins two closely related independent clauses?', options:['Comma only','Semicolon','Apostrophe','Hyphen'], correctIndex:1, explanation:'A semicolon can join two closely related independent clauses.' },
  { prompt:'Which particle has a negative charge?', options:['Proton','Neutron','Electron','Nucleus'], correctIndex:2, explanation:'Electrons carry a negative electric charge.' },
  { prompt:'If y = 3x + 2, what is y when x = 4?', options:['9','12','14','18'], correctIndex:2, explanation:'3(4) + 2 = 14.' },
  { prompt:'Which source is primary evidence about a historical event?', options:['A modern textbook','A diary written during the event','A recent documentary','A revision guide'], correctIndex:1, explanation:'A diary created at the time is a primary source.' },
  { prompt:'Which process changes liquid water into water vapour?', options:['Condensation','Evaporation','Freezing','Precipitation'], correctIndex:1, explanation:'Evaporation changes a liquid into a gas.' },
  { prompt:'Which statement is a testable hypothesis?', options:['Plants are beautiful.','Light might be nice.','Plants given more light will grow taller over seven days.','Green is the best colour.'], correctIndex:2, explanation:'It predicts a measurable relationship that can be tested.' },
  { prompt:'What is 3/4 written as a decimal?', options:['0.25','0.34','0.75','1.25'], correctIndex:2, explanation:'3 ÷ 4 = 0.75.' },
  { prompt:'Which is a producer in a food chain?', options:['Grass','Rabbit','Fox','Hawk'], correctIndex:0, explanation:'Grass makes its own food by photosynthesis.' },
  { prompt:'Which sentence is the most concise?', options:['Due to the fact that it rained, we stayed inside.','Because it rained, we stayed inside.','It rained and because of this fact we stayed inside.','We stayed inside owing to the fact of rain.'], correctIndex:1, explanation:'It communicates the same meaning with fewer unnecessary words.' },
  { prompt:'What happens to demand, all else equal, when the price of a normal good falls?', options:['Quantity demanded usually rises','Quantity demanded usually falls','Supply disappears','The good becomes free'], correctIndex:0, explanation:'A lower price generally leads to a higher quantity demanded along the demand curve.' },
  { prompt:'Which number is prime?', options:['21','29','35','39'], correctIndex:1, explanation:'29 has exactly two positive factors: 1 and 29.' },
];

function hashString(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function getDailyVocab(dateKey) {
  return VOCABULARY[hashString(`vocab:${dateKey}`) % VOCABULARY.length];
}

function buildMemoryCheck(student, dateKey) {
  const todayWord = getDailyVocab(dateKey).word;
  const collection = Array.isArray(student?.vocabulary) ? student.vocabulary : [];
  const candidates = collection
    .filter(item => item?.word && item.word !== todayWord && item.collectedDate && item.collectedDate < dateKey)
    .sort((a, b) => (Number(a.mastery) || 0) - (Number(b.mastery) || 0) || String(a.lastReviewedDate || '').localeCompare(String(b.lastReviewedDate || '')));
  if (!candidates.length) return null;
  const chosen = candidates[hashString(`review:${dateKey}:${student?.id || ''}`) % Math.min(candidates.length, 6)];
  const source = VOCABULARY.find(v => v.word === chosen.word) || chosen;
  if (!source?.definition) return null;
  const distractors = VOCABULARY.filter(v => v.word !== source.word).slice(0).sort((a, b) => hashString(`${dateKey}:${a.word}`) - hashString(`${dateKey}:${b.word}`)).slice(0, 3).map(v => v.definition);
  const options = [source.definition, ...distractors].sort((a, b) => hashString(`${dateKey}:${source.word}:${a}`) - hashString(`${dateKey}:${source.word}:${b}`));
  return {
    id:`memory-${source.word}`,
    kind:'vocab-review',
    reviewWord:source.word,
    prompt:`Memory check: what does “${source.word}” mean?`,
    options,
    correctIndex:options.indexOf(source.definition),
    explanation:`${source.word}: ${source.definition}`,
  };
}

export function buildDailyChallenge(dateKey, student = {}) {
  const start = hashString(`challenge:${dateKey}`) % CHALLENGE_BANK.length;
  const questions = [];
  let cursor = start;
  while (questions.length < 4) {
    const candidate = CHALLENGE_BANK[cursor % CHALLENGE_BANK.length];
    if (!questions.includes(candidate)) questions.push({ ...candidate, id:`q-${cursor % CHALLENGE_BANK.length}`, kind:'general' });
    cursor += 7;
  }
  const memory = buildMemoryCheck(student, dateKey);
  if (memory) questions[1] = memory;
  return questions;
}

export function masteryLabel(level = 0) {
  const value = Math.max(0, Math.min(3, Number(level) || 0));
  return ['New','Learning','Familiar','Mastered'][value];
}

export { VOCABULARY };
