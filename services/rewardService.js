import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { localDayKey } from '../game/petEconomy.js';
import { REWARD_CONFIG, buildReadingDedupeId, calculateReadingReward, normalizeBookTitle } from '../game/rewardConfig.js';

function safeLedgerId(value) {
  return String(value).replaceAll('/', '_').slice(0, 480);
}

export function rewardLedgerRef(rewardType, studentId, activityId) {
  return doc(db, 'starTransactions', safeLedgerId(`${rewardType}:${studentId}:${activityId}`));
}

async function awardReward({ studentId, rewardType, activityId, amount, patchBuilder, metadata = {} }) {
  if (!studentId) throw new Error('Missing student id');
  const fixedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!fixedAmount) throw new Error('Reward amount must be positive');

  return runTransaction(db, async tx => {
    const studentRef = doc(db, 'students', studentId);
    const ledgerRef = rewardLedgerRef(rewardType, studentId, activityId);
    const studentSnap = await tx.get(studentRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!studentSnap.exists()) throw new Error('Student account not found');
    if (ledgerSnap.exists()) {
      const existing = ledgerSnap.data();
      return { amount: 0, duplicate: true, previousAmount: Number(existing.amount) || fixedAmount };
    }

    const student = { id: studentSnap.id, ...studentSnap.data() };
    const patch = patchBuilder ? patchBuilder(student) : {};
    const currentPoints = Math.max(0, Number(student.points) || 0);
    tx.update(studentRef, { points: currentPoints + fixedAmount, ...patch });
    tx.set(ledgerRef, {
      studentId,
      rewardType,
      activityId,
      amount: fixedAmount,
      metadata,
      createdAt: serverTimestamp(),
    });
    return { amount: fixedAmount, duplicate: false, newBalance: currentPoints + fixedAmount };
  });
}

export async function completeDailyChallenge(studentId, { dateKey = localDayKey(), correct = 0, total = 4 } = {}) {
  return awardReward({
    studentId,
    rewardType: 'daily-challenge',
    activityId: dateKey,
    amount: REWARD_CONFIG.dailyChallenge,
    metadata: { correct, total },
    patchBuilder: student => ({
      dailyChallenge: {
        ...(student.dailyChallenge || {}),
        date: dateKey,
        questionsAnswered: total,
        bestStreak: Math.max(Number(student.dailyChallenge?.bestStreak) || 0, correct),
        currentStreak: correct,
        completed: true,
        completedAt: new Date().toISOString(),
        collected: true,
        collectedAt: new Date().toISOString(),
      },
      'dailyEconomy.challengeBonusCollectedDate': dateKey,
      'dailyEconomy.lastChallengeBonusAmount': REWARD_CONFIG.dailyChallenge,
      'dailyLearning.challengeDate': dateKey,
      'dailyLearning.challengeCompletedAt': new Date().toISOString(),
      'dailyLearning.challengeCorrect': correct,
      'dailyLearning.challengeTotal': total,
    }),
  });
}

function upsertVocabulary(collection, wordData, dateKey) {
  const list = Array.isArray(collection) ? [...collection] : [];
  const index = list.findIndex(item => item?.word === wordData.word);
  const previous = index >= 0 ? list[index] : {};
  const next = {
    ...previous,
    word: wordData.word,
    partOfSpeech: wordData.partOfSpeech,
    definition: wordData.definition,
    example: wordData.example,
    memory: wordData.memory,
    synonym: wordData.synonym,
    collectedDate: previous.collectedDate || dateKey,
    mastery: Math.max(1, Number(previous.mastery) || 0),
    reviewCount: Number(previous.reviewCount) || 0,
  };
  if (index >= 0) list[index] = next;
  else list.unshift(next);
  return list.slice(0, 250);
}

export async function completeDailyVocab(studentId, wordData, { dateKey = localDayKey() } = {}) {
  if (!wordData?.word) throw new Error('Missing vocabulary word');
  return awardReward({
    studentId,
    rewardType: 'daily-vocab',
    activityId: dateKey,
    amount: REWARD_CONFIG.dailyVocab,
    metadata: { word: wordData.word },
    patchBuilder: student => ({
      vocabulary: upsertVocabulary(student.vocabulary, wordData, dateKey),
      'dailyLearning.vocabDate': dateKey,
      'dailyLearning.vocabWord': wordData.word,
      'dailyLearning.vocabCompletedAt': new Date().toISOString(),
    }),
  });
}

export async function recordVocabReview(studentId, word, correct, { dateKey = localDayKey() } = {}) {
  if (!studentId || !word) return null;
  return runTransaction(db, async tx => {
    const studentRef = doc(db, 'students', studentId);
    const snap = await tx.get(studentRef);
    if (!snap.exists()) return null;
    const student = snap.data();
    const list = Array.isArray(student.vocabulary) ? [...student.vocabulary] : [];
    const index = list.findIndex(item => item?.word === word);
    if (index < 0) return null;
    const item = list[index];
    const mastery = Math.max(0, Math.min(3, (Number(item.mastery) || 0) + (correct ? 1 : -1)));
    list[index] = {
      ...item,
      mastery,
      reviewCount: (Number(item.reviewCount) || 0) + 1,
      lastReviewedDate: dateKey,
      lastReviewCorrect: !!correct,
    };
    tx.update(studentRef, { vocabulary: list });
    return { word, mastery };
  });
}

export async function logReadingAndReward(studentId, input, { dateKey = localDayKey() } = {}) {
  const title = normalizeBookTitle(input?.bookTitle);
  const startPage = Math.floor(Number(input?.startPage));
  const endPage = Math.floor(Number(input?.endPage));
  if (!title) throw new Error('Add the book title first.');
  const activityId = buildReadingDedupeId({ studentId, dateKey, bookTitle: title, startPage, endPage });

  return runTransaction(db, async tx => {
    const studentRef = doc(db, 'students', studentId);
    const ledgerRef = doc(db, 'starTransactions', safeLedgerId(activityId));
    const studentSnap = await tx.get(studentRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!studentSnap.exists()) throw new Error('Student account not found');
    if (ledgerSnap.exists()) return { amount: 0, duplicate: true, reason: 'That reading session is already logged.' };

    const student = { id: studentSnap.id, ...studentSnap.data() };
    const readingLog = Array.isArray(student.readingLog) ? [...student.readingLog] : [];
    const normalized = title.toLowerCase();
    const overlaps = readingLog.some(entry => {
      if (entry?.date !== dateKey || String(entry.normalizedTitle || entry.bookTitle || '').toLowerCase() !== normalized) return false;
      const a = Number(entry.startPage); const b = Number(entry.endPage);
      return Number.isFinite(a) && Number.isFinite(b) && startPage < b && endPage > a;
    });
    if (overlaps) throw new Error('That page range overlaps a reading session you already logged today.');

    const alreadyEarnedToday = readingLog.filter(entry => entry?.date === dateKey).reduce((sum, entry) => sum + Math.max(0, Number(entry.stars) || 0), 0);
    const reward = calculateReadingReward({ startPage, endPage, alreadyEarnedToday });
    if (!reward.valid) throw new Error(reward.reason);

    const session = {
      id: safeLedgerId(activityId),
      date: dateKey,
      bookTitle: title,
      normalizedTitle: normalized,
      startPage,
      endPage,
      pages: reward.pages,
      stars: reward.stars,
      completed: !!input?.completed,
      createdAt: new Date().toISOString(),
    };
    const currentPoints = Math.max(0, Number(student.points) || 0);
    tx.update(studentRef, { points: currentPoints + reward.stars, readingLog: [session, ...readingLog].slice(0, 300) });
    tx.set(ledgerRef, {
      studentId,
      rewardType: 'reading',
      activityId,
      amount: reward.stars,
      metadata: { bookTitle: title, startPage, endPage, pages: reward.pages },
      createdAt: serverTimestamp(),
    });
    return { amount: reward.stars, duplicate: false, session, newBalance: currentPoints + reward.stars };
  });
}

export async function claimVerifiedPreIGCSEReading(studentId, resourceId, { dateKey = localDayKey(), verificationToken } = {}) {
  if (!verificationToken) throw new Error('PreIGCSE reading must be verified before Stars can be awarded.');
  return awardReward({
    studentId,
    rewardType: 'preigcse-reading',
    activityId: `${dateKey}:${String(resourceId || 'resource')}`,
    amount: REWARD_CONFIG.preIGCSE,
    metadata: { resourceId: String(resourceId || ''), verified: true },
  });
}
