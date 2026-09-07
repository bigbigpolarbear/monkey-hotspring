import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyChallenge, getDailyVocab, masteryLabel } from '../game/dailyContent.js';
import { REWARD_CONFIG, buildReadingDedupeId, calculateReadingReward } from '../game/rewardConfig.js';

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
