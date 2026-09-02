import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPendingPassiveIncome, estimateOneDay, getCareSummary, getChallengeBonus } from '../game/petEconomy.js';
import { splitSitterPayment, clampSitterPrice, sitterCapacity } from '../game/sitterEconomy.js';

const student = {
  petCounts: { fish: 2, otter: 1, panda: 1 },
  petCare: { hunger: 80, happiness: 80 },
  dailyEconomy: { lastPassiveCollectionDate: '2026-09-01' },
};

test('passive income is pet-by-pet and non-zero', () => {
  const result = estimateOneDay(student);
  assert.equal(result.breakdown.length, 3);
  assert.ok(result.total > 0);
  assert.ok(result.care.multiplier >= 0.8);
});

test('multi-day passive income caps at seven days', () => {
  const result = buildPendingPassiveIncome({ ...student, dailyEconomy: { lastPassiveCollectionDate: '2026-08-01' } }, '2026-09-02');
  assert.equal(result.days, 7);
  assert.equal(result.capped, true);
  assert.equal(result.total, result.perDay * 7);
});

test('neglected pets still earn', () => {
  const care = getCareSummary({ petCare: { hunger: 0, happiness: 0 } });
  assert.equal(care.multiplier, 0.8);
  const result = estimateOneDay({ petCounts: { fish: 1 }, petCare: { hunger: 0, happiness: 0 } });
  assert.ok(result.total >= 1);
});

test('challenge bonus is separate from passive income', () => {
  const result = getChallengeBonus({ ...student, dailyChallenge: { date: '2026-09-02', completed: true } }, '2026-09-02');
  assert.equal(result.available, true);
  assert.ok(result.amount >= 8);
});

test('sitter payment burns currency rather than minting it', () => {
  const payment = splitSitterPayment(8);
  assert.equal(payment.charged, 8);
  assert.equal(payment.sitterEarns + payment.sink, 8);
  assert.ok(payment.sitterEarns < payment.charged);
});

test('sitter price and capacity are controlled', () => {
  assert.equal(clampSitterPrice(999, 0), 6);
  assert.equal(sitterCapacity(0), 1);
  assert.equal(sitterCapacity(20), 2);
  assert.equal(sitterCapacity(45), 3);
});
