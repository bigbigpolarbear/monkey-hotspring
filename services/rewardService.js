import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { localDayKey } from '../game/petEconomy.js';
import { REWARD_CONFIG, buildReadingDedupeId, calculateReadingReward, normalizeBookTitle } from '../game/rewardConfig.js';
import { getDailyToiletFact } from '../game/toiletFacts.js';
import { getChallengeWordle, getStandardWordle, WORDLE_THEMES } from '../game/wordleContent.js';

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


export async function answerDailyToiletFact(studentId, answerIndex, { dateKey = localDayKey() } = {}) {
  if (!studentId) throw new Error('Missing student id');
  const fact = getDailyToiletFact(dateKey);
  const chosen = Math.floor(Number(answerIndex));
  if (!Number.isInteger(chosen) || chosen < 0 || chosen >= fact.options.length) {
    throw new Error('Choose one answer first.');
  }
  const correct = chosen === fact.correctIndex;

  return runTransaction(db, async tx => {
    const studentRef = doc(db, 'students', studentId);
    const ledgerRef = rewardLedgerRef('daily-toilet-fact', studentId, dateKey);
    const studentSnap = await tx.get(studentRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!studentSnap.exists()) throw new Error('Student account not found');

    const student = { id: studentSnap.id, ...studentSnap.data() };
    if (student.dailyLearning?.toiletFactDate === dateKey) {
      return {
        amount: 0,
        duplicate: true,
        alreadyAnswered: true,
        correct: student.dailyLearning?.toiletFactCorrect === true,
        fact,
      };
    }

    const answeredAt = new Date().toISOString();
    const learningPatch = {
      'dailyLearning.toiletFactDate': dateKey,
      'dailyLearning.toiletFactId': fact.id,
      'dailyLearning.toiletFactCorrect': correct,
      'dailyLearning.toiletFactAnswerIndex': chosen,
      'dailyLearning.toiletFactAnsweredAt': answeredAt,
    };

    if (!correct) {
      tx.update(studentRef, learningPatch);
      return { amount: 0, duplicate: false, alreadyAnswered: false, correct: false, fact };
    }

    if (ledgerSnap.exists()) {
      tx.update(studentRef, { ...learningPatch, 'dailyLearning.toiletFactCorrect': true });
      return { amount: 0, duplicate: true, alreadyAnswered: true, correct: true, fact };
    }

    const amount = REWARD_CONFIG.toiletFact;
    const currentPoints = Math.max(0, Number(student.points) || 0);
    tx.update(studentRef, { points: currentPoints + amount, ...learningPatch });
    tx.set(ledgerRef, {
      studentId,
      rewardType: 'daily-toilet-fact',
      activityId: dateKey,
      amount,
      metadata: { factId: fact.id, answerIndex: chosen },
      createdAt: serverTimestamp(),
    });
    return { amount, duplicate: false, alreadyAnswered: false, correct: true, fact, newBalance: currentPoints + amount };
  });
}


function normalizeWordleGuess(value) {
  const guess = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(guess)) throw new Error('Enter a five-letter word.');
  return guess;
}

export async function submitWordleGuess(studentId, rawGuess, {
  dateKey = localDayKey(),
  mode = 'standard',
  theme = null,
} = {}) {
  if (!studentId) throw new Error('Missing student id');
  if (mode !== 'standard' && mode !== 'challenge') throw new Error('Unknown Wordle mode');
  const guess = normalizeWordleGuess(rawGuess);

  return runTransaction(db, async tx => {
    const studentRef = doc(db, 'students', studentId);
    const rewardType = mode === 'standard' ? 'daily-wordle' : 'challenge-wordle';
    const ledgerRef = rewardLedgerRef(rewardType, studentId, dateKey);
    const studentSnap = await tx.get(studentRef);
    const ledgerSnap = await tx.get(ledgerRef);
    if (!studentSnap.exists()) throw new Error('Student account not found');

    const student = { id: studentSnap.id, ...studentSnap.data() };
    const standard = student.dailyLearning?.wordleProgress || {};
    if (mode === 'challenge' && !(standard.date === dateKey && standard.completed === true)) {
      throw new Error('Finish today’s regular Wordle first.');
    }

    const field = mode === 'standard' ? 'wordleProgress' : 'challengeWordleProgress';
    const saved = student.dailyLearning?.[field] || {};
    const sameDay = saved.date === dateKey;
    if (sameDay && saved.completed === true) {
      const savedTheme = mode === 'challenge' ? saved.theme : null;
      const answer = mode === 'standard'
        ? getStandardWordle(dateKey)
        : getChallengeWordle(dateKey, savedTheme);
      return { amount: 0, duplicate: true, progress: saved, answer };
    }

    let effectiveTheme = null;
    if (mode === 'challenge') {
      effectiveTheme = sameDay && saved.theme ? saved.theme : theme;
      if (!WORDLE_THEMES[effectiveTheme]) throw new Error('Choose Science, Humanities or Maths first.');
      if (sameDay && saved.theme && saved.theme !== effectiveTheme) {
        throw new Error(`You already chose ${WORDLE_THEMES[saved.theme].label} for today’s Challenge Wordle.`);
      }
    }

    const answer = mode === 'standard'
      ? getStandardWordle(dateKey)
      : getChallengeWordle(dateKey, effectiveTheme);
    const guesses = sameDay && Array.isArray(saved.guesses) ? [...saved.guesses] : [];
    if (guesses.length >= 6) {
      return { amount: 0, duplicate: true, progress: { ...saved, completed: true }, answer };
    }

    guesses.push(guess);
    const won = guess === answer;
    const completed = won || guesses.length >= 6;
    const progress = {
      date: dateKey,
      ...(mode === 'challenge' ? { theme: effectiveTheme } : {}),
      guesses,
      completed,
      won,
      updatedAt: new Date().toISOString(),
      ...(completed ? { completedAt: new Date().toISOString() } : {}),
    };
    const progressPatch = { [`dailyLearning.${field}`]: progress };

    if (!won) {
      tx.update(studentRef, progressPatch);
      return { amount: 0, duplicate: false, progress, answer: completed ? answer : null };
    }

    const configuredAmount = mode === 'standard' ? REWARD_CONFIG.dailyWordle : REWARD_CONFIG.challengeWordle;
    if (ledgerSnap.exists()) {
      tx.update(studentRef, progressPatch);
      return { amount: 0, duplicate: true, progress, answer };
    }

    const currentPoints = Math.max(0, Number(student.points) || 0);
    tx.update(studentRef, { points: currentPoints + configuredAmount, ...progressPatch });
    tx.set(ledgerRef, {
      studentId,
      rewardType,
      activityId: dateKey,
      amount: configuredAmount,
      metadata: { answer, guesses: guesses.length, ...(effectiveTheme ? { theme: effectiveTheme } : {}) },
      createdAt: serverTimestamp(),
    });
    return {
      amount: configuredAmount,
      duplicate: false,
      progress,
      answer,
      newBalance: currentPoints + configuredAmount,
    };
  });
}
