import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA0u7DdeGQFfMne09EWAS0gtOfpVPRA8tg",
  authDomain: "monkeybear-34a13.firebaseapp.com",
  projectId: "monkeybear-34a13",
  storageBucket: "monkeybear-34a13.firebasestorage.app",
  messagingSenderId: "504952993498",
  appId: "1:504952993498:web:3ccd89d1c873e317f257e3",
  measurementId: "G-FRYZHLHCTP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ─── Database helpers ─── */

export async function getTeachers() {
  const snap = await getDocs(collection(db, "teachers"));
  if (snap.empty) {
    const defaultTeacher = { username: "teacher", password: "1234", name: "Sensei" };
    const ref = await addDoc(collection(db, "teachers"), defaultTeacher);
    return [{ id: ref.id, ...defaultTeacher }];
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getStudents() {
  const snap = await getDocs(collection(db, "students"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addStudentToDB(student) {
  const { id, ...data } = student;
  const ref = await addDoc(collection(db, "students"), data);
  return { id: ref.id, ...data };
}

export async function updateStudent(id, data) {
  await updateDoc(doc(db, "students", id), data);
}

export async function deleteStudent(id) {
  await deleteDoc(doc(db, "students", id));
}

/* ─── Quiz helpers ─── 
   Stored as documents keyed by studentId, with structure:
   { quizzes: [{id, subject, name, points, questions[]}] }
   (Backward compat: old format had { questions: [...] } directly)
*/
export async function getQuizzes() {
  const snap = await getDocs(collection(db, "quizzes"));
  const quizzes = {};
  snap.docs.forEach(d => {
    const data = d.data();
    if (Array.isArray(data.quizzes)) {
      quizzes[d.id] = data.quizzes;
    } else if (Array.isArray(data.questions)) {
      // Migrate old format on read
      quizzes[d.id] = [{
        id: "default",
        subject: "General",
        name: "Quiz",
        points: 1,
        questions: data.questions,
      }];
    } else {
      quizzes[d.id] = [];
    }
  });
  return quizzes;
}

export async function setQuizzesForStudent(studentId, quizzes) {
  await setDoc(doc(db, "quizzes", studentId), { quizzes });
}

export async function deleteQuizzesForStudent(studentId) {
  await deleteDoc(doc(db, "quizzes", studentId));
}

/* ─── Mission helpers ─── 
   Stored as documents keyed by studentId, with structure:
   { missions: [{id, name, points, questions[]}] }
*/
export async function getMissions() {
  const snap = await getDocs(collection(db, "missions"));
  const missions = {};
  snap.docs.forEach(d => {
    const data = d.data();
    missions[d.id] = Array.isArray(data.missions) ? data.missions : [];
  });
  return missions;
}

export async function setMissionsForStudent(studentId, missions) {
  await setDoc(doc(db, "missions", studentId), { missions });
}

export async function deleteMissionsForStudent(studentId) {
  await deleteDoc(doc(db, "missions", studentId));
}

export { db };
