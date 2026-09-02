import {
  collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp,
  Timestamp, where,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import {
  clampSitterPrice, ratingAverage, sitterCapacity, splitSitterPayment,
  SITTER_COMPLIMENTS, SITTER_TITLES,
} from '../game/sitterEconomy.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function safeSitterProfile(raw = {}) {
  return {
    id: raw.id || '', studentId: raw.studentId || raw.id || '',
    monkeyId: String(raw.monkeyId || ''), monkeyName: String(raw.monkeyName || 'Monkey').slice(0, 24),
    sitterTitle: SITTER_TITLES.includes(raw.sitterTitle) ? raw.sitterTitle : SITTER_TITLES[0],
    availability: raw.availability === true, price: clampSitterPrice(raw.price, raw.completedJobs),
    completedJobs: Math.max(0, Number(raw.completedJobs) || 0),
    ratingTotal: Math.max(0, Number(raw.ratingTotal) || 0), ratingCount: Math.max(0, Number(raw.ratingCount) || 0),
    activeJobId: raw.activeJobId || null,
  };
}

export function subscribeSitterProfiles(callback, onError = console.error) {
  return onSnapshot(collection(db, 'sitterProfiles'), snap => callback(snap.docs.map(d => safeSitterProfile({ id: d.id, ...d.data() }))), onError);
}

export async function saveSitterProfile(studentId, input) {
  if (!studentId) throw new Error('Missing student id');
  const ref = doc(db, 'sitterProfiles', studentId);
  return runTransaction(db, async tx => {
    const existingSnap = await tx.get(ref);
    const existing = existingSnap.exists() ? existingSnap.data() : {};
    const completedJobs = Math.max(0, Number(existing.completedJobs) || 0);
    const profile = safeSitterProfile({ ...existing, studentId, monkeyId: input.monkeyId, monkeyName: input.monkeyName, sitterTitle: input.sitterTitle, availability: input.availability === true, price: clampSitterPrice(input.price, completedJobs), completedJobs, ratingTotal: existing.ratingTotal || 0, ratingCount: existing.ratingCount || 0, activeJobId: existing.activeJobId || null });
    tx.set(ref, { studentId, monkeyId: profile.monkeyId, monkeyName: profile.monkeyName, sitterTitle: profile.sitterTitle, availability: profile.availability, price: profile.price, completedJobs: profile.completedJobs, ratingTotal: profile.ratingTotal, ratingCount: profile.ratingCount, activeJobId: profile.activeJobId, updatedAt: serverTimestamp() }, { merge: true });
    return profile;
  });
}

export async function hireSitter({ ownerId, sitterId, petIds = [] }) {
  if (!ownerId || !sitterId) throw new Error('Missing owner or sitter');
  if (ownerId === sitterId) throw new Error('You cannot hire your own monkey');
  const jobRef = doc(collection(db, 'sittingJobs'));
  return runTransaction(db, async tx => {
    const ownerRef = doc(db, 'students', ownerId); const sitterStudentRef = doc(db, 'students', sitterId); const profileRef = doc(db, 'sitterProfiles', sitterId);
    const ownerSnap = await tx.get(ownerRef); const sitterSnap = await tx.get(sitterStudentRef); const profileSnap = await tx.get(profileRef);
    if (!ownerSnap.exists() || !sitterSnap.exists() || !profileSnap.exists()) throw new Error('Sitter is unavailable');
    const owner = ownerSnap.data(); const profile = safeSitterProfile({ id: sitterId, ...profileSnap.data() });
    if (!profile.availability) throw new Error('This sitter is not available right now');
    if (profile.activeJobId) throw new Error('This sitter already has an active job');
    if (owner.activeSittingJobId) throw new Error('You already have an active sitter visit');
    if (sitterCapacity(profile.completedJobs) < 1) throw new Error('Sitter capacity reached');
    const payment = splitSitterPayment(profile.price); const ownerPoints = Math.max(0, Number(owner.points) || 0);
    if (ownerPoints < payment.charged) throw new Error(`You need ${payment.charged} ★ to hire this sitter`);
    const safePetIds = [...new Set((petIds || []).map(String))].slice(0, 12); const endAt = Timestamp.fromMillis(Date.now() + DAY_MS);
    tx.update(ownerRef, { points: ownerPoints - payment.charged, activeSittingJobId: jobRef.id });
    tx.update(profileRef, { activeJobId: jobRef.id, availability: false, updatedAt: serverTimestamp() });
    tx.set(jobRef, { ownerId, sitterId, petIds: safePetIds, startAt: serverTimestamp(), endAt, status: 'active', price: payment.charged, sitterPayout: payment.sitterEarns, currencySink: payment.sink, ownerPaid: true, sitterPaid: false, rating: null, compliment: null });
    return { jobId: jobRef.id, ...payment, endAt: endAt.toMillis() };
  });
}

function gentleCarePatch(owner = {}) {
  const care = owner.petCare || {};
  return { ...care, hunger: Math.min(100, Math.max(0, Number(care.hunger ?? 70)) + 12), happiness: Math.min(100, Math.max(0, Number(care.happiness ?? 70)) + 10), lastUpdated: Date.now(), sitterVisitAt: Date.now() };
}

export async function completeSittingJob(jobId) {
  if (!jobId) return null;
  return runTransaction(db, async tx => {
    const jobRef = doc(db, 'sittingJobs', jobId); const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) return null;
    const job = jobSnap.data();
    if (job.status !== 'active' || job.sitterPaid === true) return { jobId, alreadyCompleted: true };
    const dueAt = job.endAt?.toMillis?.() ?? Number(job.endAt || 0);
    if (dueAt && Date.now() < dueAt) return { jobId, notDue: true, dueAt };
    const ownerRef = doc(db, 'students', job.ownerId); const sitterRef = doc(db, 'students', job.sitterId); const profileRef = doc(db, 'sitterProfiles', job.sitterId);
    const ownerSnap = await tx.get(ownerRef); const sitterSnap = await tx.get(sitterRef); const profileSnap = await tx.get(profileRef);
    if (!ownerSnap.exists() || !sitterSnap.exists() || !profileSnap.exists()) throw new Error('Sitting job account missing');
    const owner = ownerSnap.data(); const sitter = sitterSnap.data(); const profile = safeSitterProfile({ id: job.sitterId, ...profileSnap.data() }); const payout = Math.max(0, Number(job.sitterPayout) || 0);
    tx.update(sitterRef, { points: Math.max(0, Number(sitter.points) || 0) + payout });
    tx.update(ownerRef, { activeSittingJobId: null, petCare: gentleCarePatch(owner), latestSittingReport: { jobId, sitterId: job.sitterId, sitterMonkeyName: profile.monkeyName, petIds: job.petIds || [], fedPet: (job.petIds || [])[0] || null, happinessGain: 10, hungerGain: 12, completedAt: Date.now() } });
    tx.update(profileRef, { activeJobId: null, availability: true, completedJobs: profile.completedJobs + 1, updatedAt: serverTimestamp() });
    tx.update(jobRef, { status: 'completed', completedAt: serverTimestamp(), sitterPaid: true });
    return { jobId, completed: true, payout, ownerId: job.ownerId, sitterId: job.sitterId };
  });
}

export async function completeDueJobsForStudent(studentId) {
  if (!studentId) return [];
  const owned = await getDocs(query(collection(db, 'sittingJobs'), where('ownerId', '==', studentId)));
  const sitting = await getDocs(query(collection(db, 'sittingJobs'), where('sitterId', '==', studentId)));
  const seen = new Map(); [...owned.docs, ...sitting.docs].forEach(d => seen.set(d.id, d.data()));
  const results = [];
  for (const [jobId, job] of seen.entries()) {
    const end = job.endAt?.toMillis?.() ?? Number(job.endAt || 0);
    if (job.status === 'active' && (!end || Date.now() >= end)) { try { results.push(await completeSittingJob(jobId)); } catch (error) { console.warn('Sitting completion failed', error); } }
  }
  return results;
}

export async function listJobsForStudent(studentId) {
  if (!studentId) return [];
  const owned = await getDocs(query(collection(db, 'sittingJobs'), where('ownerId', '==', studentId)));
  const sitting = await getDocs(query(collection(db, 'sittingJobs'), where('sitterId', '==', studentId)));
  const jobs = new Map(); [...owned.docs, ...sitting.docs].forEach(d => jobs.set(d.id, { id: d.id, ...d.data() }));
  return [...jobs.values()].sort((a, b) => (b.completedAt?.toMillis?.() || b.endAt?.toMillis?.() || 0) - (a.completedAt?.toMillis?.() || a.endAt?.toMillis?.() || 0));
}

export async function rateSitter({ ownerId, jobId, rating, compliment }) {
  const stars = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
  if (!SITTER_COMPLIMENTS.includes(compliment)) throw new Error('Choose a preset compliment');
  return runTransaction(db, async tx => {
    const jobRef = doc(db, 'sittingJobs', jobId); const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists()) throw new Error('Sitting job not found');
    const job = jobSnap.data();
    if (job.ownerId !== ownerId) throw new Error('Only the pet owner can rate this job');
    if (job.status !== 'completed') throw new Error('This job is not complete yet');
    if (job.rating != null) throw new Error('This sitting job was already rated');
    const profileRef = doc(db, 'sitterProfiles', job.sitterId); const profileSnap = await tx.get(profileRef);
    if (!profileSnap.exists()) throw new Error('Sitter profile not found');
    const profile = safeSitterProfile({ id: job.sitterId, ...profileSnap.data() });
    tx.update(jobRef, { rating: stars, compliment, ratedAt: serverTimestamp() });
    tx.update(profileRef, { ratingTotal: profile.ratingTotal + stars, ratingCount: profile.ratingCount + 1, updatedAt: serverTimestamp() });
    return { rating: stars, average: ratingAverage({ ratingTotal: profile.ratingTotal + stars, ratingCount: profile.ratingCount + 1 }) };
  });
}
