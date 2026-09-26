import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyChallenge, getDailyVocab, masteryLabel } from '../game/dailyContent.js';
import { REWARD_CONFIG, buildReadingDedupeId, calculateReadingReward } from '../game/rewardConfig.js';
import { getDailyToiletFact, TOILET_FACTS } from '../game/toiletFacts.js';
import { getChallengeWordle, getStandardWordle, letterStates, STANDARD_WORDS, WORDLE_THEMES } from '../game/wordleContent.js';

test('daily challenge always returns four valid questions', () => {
  const questions = buildDailyChallenge('2026-09-07', { id: 'student-1', vocabulary: [] });
  assert.equal(questions.length, 4);
  for (const q of questions) {
    assert.ok(q.prompt);
    assert.equal(q.options.length, 4);
    assert.ok(q.correctIndex >= 0 && q.correctIndex < 4);
  }
});

test('daily challenge is deterministic for a date', () => {
  assert.deepEqual(buildDailyChallenge('2026-09-07', { id: 's' }), buildDailyChallenge('2026-09-07', { id: 's' }));
  assert.deepEqual(getDailyVocab('2026-09-07'), getDailyVocab('2026-09-07'));
});

test('older vocabulary can become a memory check', () => {
  const student = {
    id: 'student-1',
    vocabulary: [{ word: 'buttress', definition: 'To support or strengthen something.', collectedDate: '2026-09-01', mastery: 1 }],
  };
  const questions = buildDailyChallenge('2026-09-07', student);
  assert.ok(questions.some(q => q.kind === 'vocab-review' && q.reviewWord === 'buttress'));
});

test('32 pages earns six reading stars', () => {
  const result = calculateReadingReward({ startPage: 10, endPage: 42, alreadyEarnedToday: 0 });
  assert.equal(result.valid, true);
  assert.equal(result.pages, 32);
  assert.equal(result.stars, 6);
});

test('reading reward respects minimum and daily cap', () => {
  assert.equal(calculateReadingReward({ startPage: 1, endPage: 4 }).valid, false);
  const capped = calculateReadingReward({ startPage: 1, endPage: 51, alreadyEarnedToday: REWARD_CONFIG.reading.maxStarsPerDay - 2 });
  assert.equal(capped.stars, 2);
  assert.equal(calculateReadingReward({ startPage: 1, endPage: 51, alreadyEarnedToday: REWARD_CONFIG.reading.maxStarsPerDay }).valid, false);
});

test('reading dedupe id is stable for identical sessions', () => {
  const input = { studentId:'abc', dateKey:'2026-09-07', bookTitle:' The Hunger Games ', startPage:10, endPage:42 };
  assert.equal(buildReadingDedupeId(input), buildReadingDedupeId(input));
  assert.notEqual(buildReadingDedupeId(input), buildReadingDedupeId({ ...input, endPage:43 }));
});

test('mastery labels stay child-friendly', () => {
  assert.deepEqual([0,1,2,3].map(masteryLabel), ['New','Learning','Familiar','Mastered']);
});


test('daily toilet fact is deterministic and always quiz-ready', () => {
  const a = getDailyToiletFact('2026-09-26');
  const b = getDailyToiletFact('2026-09-26');
  assert.deepEqual(a, b);
  assert.ok(TOILET_FACTS.length >= 28);
  assert.ok(a.fact);
  assert.ok(a.question);
  assert.equal(a.options.length, 4);
  assert.ok(a.correctIndex >= 0 && a.correctIndex < a.options.length);
});

test('toilet fact reward is exactly one Star', () => {
  assert.equal(REWARD_CONFIG.toiletFact, 1);
});


test('classic Wordle is deterministic and worth one Star', () => {
  const word = getStandardWordle('2026-09-26');
  assert.equal(word, getStandardWordle('2026-09-26'));
  assert.equal(word.length, 5);
  assert.match(word, /^[A-Z]{5}$/);
  assert.equal(REWARD_CONFIG.dailyWordle, 1);
  assert.ok(STANDARD_WORDS.every(item => /^[a-z]{5}$/.test(item)));
});

test('challenge Wordle has three valid five-letter subject banks and is worth three Stars', () => {
  assert.deepEqual(Object.keys(WORDLE_THEMES), ['science','humanities','maths']);
  for (const [theme, data] of Object.entries(WORDLE_THEMES)) {
    assert.ok(data.words.length >= 25);
    assert.ok(data.words.every(item => /^[a-z]{5}$/.test(item)), theme);
    const word = getChallengeWordle('2026-09-26', theme);
    assert.equal(word.length, 5);
    assert.match(word, /^[A-Z]{5}$/);
    assert.equal(word, getChallengeWordle('2026-09-26', theme));
  }
  assert.equal(REWARD_CONFIG.challengeWordle, 3);
});

test('Wordle letter states handle duplicate letters correctly', () => {
  assert.deepEqual(letterStates('SHEEP', 'PEARL'), ['absent','absent','present','present','absent']);
  assert.deepEqual(letterStates('APPLE', 'AMPLE'), ['correct','present','absent','correct','correct']);
});
