import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBookPoints } from '../game/bookPoints.js';

test('book points award one point per complete 750 words without a daily cap', () => {
  for (const [words, points] of [[0,0],[749,0],[750,1],[1499,1],[1500,2],[45000,60]]) {
    assert.equal(calculateBookPoints(words), points);
  }
  assert.equal(calculateBookPoints('2250'), 3);
});

test('book calculator rejects empty, fractional, negative and unsafe word counts', () => {
  for (const value of ['', ' ', null, undefined, -1, 750.5, 'abc', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(calculateBookPoints(value), null);
  }
});
