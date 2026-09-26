import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';
import { normalizeMonkeyIdentity } from '../game/anonymousIdentity.js';

export async function chooseAnonymousMonkeyIdentity(studentId, identityValue) {
  if (!studentId) throw new Error('Missing student id');
  const identity = normalizeMonkeyIdentity(identityValue);
  if (!identity) throw new Error('Choose one of the monkey identities shown.');

  return runTransaction(db, async tx => {
    const ref = doc(db, 'students', studentId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Student account not found');

    const student = { id: snap.id, ...snap.data() };
    const existing = normalizeMonkeyIdentity(student.anonymousMonkeyName || student.anonymousMonkeyId);
    if (existing) {
      return { changed:false, identity:existing, student };
    }

    const chosenAt = new Date().toISOString();
    tx.update(ref, {
      anonymousMonkeyId: identity.id,
      anonymousMonkeyName: identity.name,
      anonymousMonkeyChosenAt: chosenAt,
      anonymousIdentityVersion: 1,
    });

    return {
      changed:true,
      identity,
      student:{ ...student, anonymousMonkeyId:identity.id, anonymousMonkeyName:identity.name, anonymousMonkeyChosenAt:chosenAt },
    };
  });
}
