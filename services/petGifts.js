import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase.js';

export async function giftStudentPet(teacherId, studentId, petId) {
  return runTransaction(db, async transaction => {
    const teacherRef = doc(db, 'teachers', teacherId);
    const studentRef = doc(db, 'students', studentId);
    const teacher = await transaction.get(teacherRef);
    const student = await transaction.get(studentRef);
    if (!teacher.exists() || !student.exists()) throw new Error('Teacher or student not found.');
    const data = student.data();
    if (!teacher.data().isAdmin && data.teacherId !== teacherId) throw new Error('Choose a student in your classroom.');
    const ownedPets = Array.isArray(data.ownedPets) ? data.ownedPets : [];
    if (ownedPets.includes(petId)) return { duplicate: true, patch: {} };
    const now = Date.now();
    const patch = {
      ownedPets: [...ownedPets, petId],
      ...(!data.pet ? { pet: petId, petAcquiredAt: now, lastIncomeCollected: now } : {}),
    };
    transaction.update(studentRef, patch);
    return { duplicate: false, patch };
  });
}
