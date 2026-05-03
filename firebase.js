import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getDatabase, ref, set, get, update, onValue, onDisconnect, remove, push, serverTimestamp } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA0u7DdeGQFfMne09EWAS0gtOfpVPRA8tg",
  authDomain: "monkeybear-34a13.firebaseapp.com",
  databaseURL: "https://monkeybear-34a13-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monkeybear-34a13",
  storageBucket: "monkeybear-34a13.firebasestorage.app",
  messagingSenderId: "504952993498",
  appId: "1:504952993498:web:3ccd89d1c873e317f257e3",
  measurementId: "G-FRYZHLHCTP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Realtime Database is initialized lazily and wrapped in try/catch so the
// app keeps working even if RTDB hasn't been enabled in Firebase Console yet.
// Live game features will simply throw a friendly error if RTDB is unavailable.
let rtdb = null;
try {
  rtdb = getDatabase(app);
} catch (e) {
  console.warn("Realtime Database not available — live games disabled:", e?.message);
}
function requireRtdb() {
  if (!rtdb) throw new Error("Live games require Firebase Realtime Database to be enabled. See LIVE_GAMES_GUIDE.md");
  return rtdb;
}

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

/* ─── Add a new teacher record. Used by manual signup and Google signup. ───
   `teacher` should be an object like { username, password, name } or
   { username, name, googleUid, email, photoURL, authMethod: "google" }. */
export async function addTeacherToDB(teacher) {
  const { id, ...data } = teacher;
  const ref = await addDoc(collection(db, "teachers"), data);
  return { id: ref.id, ...data };
}

/* ─── Google sign-in (role-aware) ───
   Opens a Google OAuth popup, then either logs the existing user in OR creates
   a new account in the right collection (teachers or students).
   Pass role: "teacher" (default) or "student".
   Returns { user, role } on success.

   To enable: in Firebase Console → Authentication → Sign-in method →
   enable "Google" provider, and add your Vercel domain to authorized domains. */
export async function signInWithGoogle(role = "teacher") {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const u = result.user;
  if (!u || !u.uid) throw new Error("Google sign-in failed");

  if (role === "student") {
    // Check existing students for matching googleUid or email
    const snap = await getDocs(collection(db, "students"));
    const existing = snap.docs.find(d => {
      const x = d.data();
      return x.googleUid === u.uid || x.email === u.email;
    });
    if (existing) {
      return { user: { id: existing.id, ...existing.data() }, role: "student" };
    }
    // Create new student record
    const newStudent = {
      username: u.email,
      email: u.email,
      name: u.displayName || (u.email ? u.email.split("@")[0] : "Student"),
      googleUid: u.uid,
      photoURL: u.photoURL || "",
      authMethod: "google",
      createdAt: new Date().toISOString(),
      points: 0,
      accessories: [],
      ownedPets: [],
      pet: null,
    };
    const created = await addStudentToDB(newStudent);
    return { user: created, role: "student" };
  }

  // Teacher path (default) — look in teachers collection
  const teachers = await getTeachers();
  const existing = teachers.find(t => t.googleUid === u.uid || t.email === u.email);
  if (existing) return { user: existing, role: "teacher" };

  const newTeacher = {
    username: u.email,
    email: u.email,
    name: u.displayName || (u.email ? u.email.split("@")[0] : "Teacher"),
    googleUid: u.uid,
    photoURL: u.photoURL || "",
    authMethod: "google",
    createdAt: new Date().toISOString(),
  };
  const created = await addTeacherToDB(newTeacher);
  return { user: created, role: "teacher" };
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

/* ─── STUDY PACKS ───
   Premade question packs that teachers can browse and assign to students.
   Each pack lives as a document in the `studyPacks` collection with shape:
   {
     id: <docId>,
     title: "Grade 3 Math",
     subject: "Math",
     gradeLevel: "Grade 3",
     description: "...",
     icon: "🔢",
     isFree: false,           // true = available to all users; false = Star only
     questions: [             // same shape as mission.questions
       { q: "What is 2+3?", options: ["4","5","6","7"], correct: 1 },
       ...
     ],
     createdAt: <ISO>,
   }
*/
export async function getStudyPacks() {
  const snap = await getDocs(collection(db, "studyPacks"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addStudyPack(pack) {
  const { id, ...data } = pack;
  const ref = await addDoc(collection(db, "studyPacks"), {
    ...data,
    createdAt: data.createdAt || new Date().toISOString(),
  });
  return { id: ref.id, ...data };
}

export async function deleteStudyPack(packId) {
  await deleteDoc(doc(db, "studyPacks", packId));
}

/* ─── STAR USER UPGRADE ───
   Toggles a teacher's Star (paid) status. Called by:
   - The Stripe webhook (production: via the "Run Payments with Stripe" Firebase
     extension — it sets `stripeRole` on the teacher's Firebase Auth claims and
     mirrors the subscription doc to Firestore).
   - A manual admin tool / dev-mode button (sets `isStarUser` directly).
   We keep BOTH fields readable so the app works regardless of which path was used.
*/
export async function setTeacherStarStatus(teacherId, isStar, expiresAt = null) {
  await updateDoc(doc(db, "teachers", teacherId), {
    isStarUser: !!isStar,
    starExpiresAt: expiresAt,
    starUpdatedAt: new Date().toISOString(),
  });
}

/* ─── LIVE GAMES (multiplayer) ───
   Uses Firebase Realtime Database (separate from Firestore) for low-latency
   game state sync. Lobby + active game lives at `/liveGames/{gameCode}`.

   Schema:
     /liveGames/{gameCode} = {
       hostId, hostName,
       status: "lobby" | "playing" | "ended",
       mode: "restaurant" | "classic",
       pack: { title, questions[] },
       currentQuestionIdx: 0,
       questionStartedAt: serverTimestamp,
       createdAt: serverTimestamp,
       players: {
         [playerId]: {
           name, joinedAt, score, tips, served, lost,
           lastAnswerCorrect, lastAnswerTime, kitchenLevel,
           streak, status: "playing" | "left"
         }
       }
     }
*/

// Generate a 6-char uppercase alphanumeric game code (no confusing chars: O, 0, I, 1)
function generateGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Create a new live game lobby, returns the game code
export async function createLiveGame({ hostId, hostName, pack, mode = "restaurant" }) {
  // Try a few times in case of collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGameCode();
    const gameRef = ref(requireRtdb(), `liveGames/${code}`);
    const snap = await get(gameRef);
    if (snap.exists()) continue; // Collision, retry
    await set(gameRef, {
      hostId, hostName,
      status: "lobby",
      mode,
      pack: { title: pack.title, questions: pack.questions || [] },
      currentQuestionIdx: 0,
      questionStartedAt: null,
      createdAt: serverTimestamp(),
      players: {},
    });
    // Auto-cleanup if host disconnects (10 min after disconnect)
    onDisconnect(gameRef).remove();
    return code;
  }
  throw new Error("Could not create game — try again");
}

// Subscribe to live game state. Returns an unsubscribe function.
export function watchLiveGame(code, callback) {
  const gameRef = ref(requireRtdb(), `liveGames/${code}`);
  const unsub = onValue(gameRef, (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });
  return unsub;
}

// Player joins a live game. Returns the playerId on success.
export async function joinLiveGame(code, { name, monkeyVariant }) {
  const gameRef = ref(requireRtdb(), `liveGames/${code}`);
  const snap = await get(gameRef);
  if (!snap.exists()) throw new Error("Game not found");
  const game = snap.val();
  if (game.status !== "lobby") throw new Error("Game already started");
  // Push a new player record
  const playersRef = ref(requireRtdb(), `liveGames/${code}/players`);
  const playerRef = push(playersRef);
  const playerId = playerRef.key;
  await set(playerRef, {
    name,
    monkeyVariant: monkeyVariant || (Math.floor(Math.random() * 4) + 1),
    joinedAt: serverTimestamp(),
    score: 0,         // raw correct answers
    tips: 0,          // restaurant tips earned
    served: 0,        // customers served (correct)
    lost: 0,          // customers walked out (wrong)
    streak: 0,        // current correct-answer streak
    kitchenLevel: 1,  // upgrades every 3 served
    status: "playing",
  });
  // Auto-leave if player disconnects
  onDisconnect(playerRef).update({ status: "left" });
  return playerId;
}

// Host starts the game (status → "playing")
export async function startLiveGame(code) {
  await update(ref(requireRtdb(), `liveGames/${code}`), {
    status: "playing",
    currentQuestionIdx: 0,
    questionStartedAt: serverTimestamp(),
  });
}

// Advance to next question (host only)
export async function advanceLiveGameQuestion(code, nextIdx) {
  await update(ref(requireRtdb(), `liveGames/${code}`), {
    currentQuestionIdx: nextIdx,
    questionStartedAt: serverTimestamp(),
  });
}

// End the game (host only)
export async function endLiveGame(code) {
  await update(ref(requireRtdb(), `liveGames/${code}`), { status: "ended" });
}

// Player submits an answer. Updates score/tips/served/lost.
export async function submitLiveAnswer(code, playerId, { correct, tipEarned, questionIdx }) {
  const playerRef = ref(requireRtdb(), `liveGames/${code}/players/${playerId}`);
  const snap = await get(playerRef);
  if (!snap.exists()) return;
  const p = snap.val();
  const newServed = (p.served || 0) + (correct ? 1 : 0);
  const newLost = (p.lost || 0) + (correct ? 0 : 1);
  const newStreak = correct ? (p.streak || 0) + 1 : 0;
  const newTips = (p.tips || 0) + (correct ? (tipEarned || 0) : 0);
  const newScore = (p.score || 0) + (correct ? 1 : 0);
  // Kitchen levels up every 3 served customers (cap at 5)
  const newLevel = Math.min(5, Math.floor(newServed / 3) + 1);
  await update(playerRef, {
    score: newScore, tips: newTips, served: newServed, lost: newLost,
    streak: newStreak, kitchenLevel: newLevel,
    lastAnswerCorrect: correct,
    lastAnsweredAt: serverTimestamp(),
    lastQuestionIdx: questionIdx,
  });
}

// Cleanup helper — host can manually end + delete the game
export async function deleteLiveGame(code) {
  await remove(ref(requireRtdb(), `liveGames/${code}`));
}

export { db, rtdb };
