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

// Teachers
export async function getTeachers() {
  const snap = await getDocs(collection(db, "teachers"));
  if (snap.empty) {
    // Seed default teacher on first run
    const defaultTeacher = { username: "teacher", password: "1234", name: "Sensei" };
    const ref = await addDoc(collection(db, "teachers"), defaultTeacher);
    return [{ id: ref.id, ...defaultTeacher }];
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Students
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

export { db };
