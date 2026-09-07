import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { buildPendingPassiveIncome, getChallengeBonus, localDayKey } from '../game/petEconomy.js';
import { rewardLedgerRef } from './rewardService.js';

export function subscribeStudent(studentId, callback, onError = console.error) {
  if (!studentId) return () => {};
  return onSnapshot(doc(db, 'students', studentId), snap => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

export async function collectPassiveIncome(studentId) {
  if (!studentId) throw new Error('Missing student id');
  return runTransaction(db, async tx => {
    const ref = doc(db, 'students', studentId);
    const today = localDayKey();
    const ledgerRef = rewardLedgerRef('pet-income', studentId, today);
    const snap = await tx.get(ref);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!snap.exists()) throw new Error('Student account not found');
    const student = { id: snap.id, ...snap.data() };
    const pending = buildPendingPassiveIncome(student, today);
    if (ledgerSnap.exists() || student.dailyEconomy?.lastPassiveCollectionDate === today || pending.total <= 0) {
      return { amount: 0, alreadyCollected: true, pending };
    }
    const currentPoints = Math.max(0, Number(student.points) || 0);
    tx.update(ref, {
      points: currentPoints + pending.total,
      'dailyEconomy.lastPassiveCollectionDate': today,
      'dailyEconomy.lastPassiveCollectionAt': serverTimestamp(),
      'dailyEconomy.lastPassiveAmount': pending.total,
      'dailyEconomy.lastPassiveDays': pending.days,
    });
    tx.set(ledgerRef, {
      studentId,
      rewardType: 'pet-income',
      activityId: today,
      amount: pending.total,
      metadata: { days: pending.days },
      createdAt: serverTimestamp(),
    });
    return { amount: pending.total, alreadyCollected: false, pending };
  });
}

export async function collectChallengeBonus(studentId) {
  if (!studentId) throw new Error('Missing student id');
  return runTransaction(db, async tx => {
    const ref = doc(db, 'students', studentId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Student account not found');
    const student = { id: snap.id, ...snap.data() };
    const today = localDayKey();
    const bonus = getChallengeBonus(student, today);
    const ledgerRef = rewardLedgerRef('legacy-challenge-bonus', studentId, today);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!bonus.completed) return { amount: 0, unavailable: true };
    if (ledgerSnap.exists() || bonus.collected) return { amount: 0, alreadyCollected: true };
    const currentPoints = Math.max(0, Number(student.points) || 0);
    tx.update(ref, {
      points: currentPoints + bonus.amount,
      'dailyEconomy.challengeBonusCollectedDate': today,
      'dailyEconomy.challengeBonusCollectedAt': serverTimestamp(),
      'dailyEconomy.lastChallengeBonusAmount': bonus.amount,
    });
    tx.set(ledgerRef, {
      studentId,
      rewardType: 'legacy-challenge-bonus',
      activityId: today,
      amount: bonus.amount,
      createdAt: serverTimestamp(),
    });
    return { amount: bonus.amount, alreadyCollected: false };
  });
}
