import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StudentNavigationDrawer from '../components/StudentNavigationDrawer.jsx';
import DailyPetIncome from '../components/DailyPetIncome.jsx';
import DailyReturnSummary from '../components/DailyReturnSummary.jsx';
import MonkeySitters from '../components/MonkeySitters.jsx';
import { buildPendingPassiveIncome, getChallengeBonus, localDayKey } from '../game/petEconomy.js';
import { collectChallengeBonus, collectPassiveIncome, subscribeStudent } from '../services/studentEconomy.js';
import { completeDueJobsForStudent } from '../services/sitterService.js';
import '../styles/student-experience.css';

function findStudentMarker() {
  return document.querySelector('[data-monkey-student-id]');
}

function clickLegacyAction(label) {
  const needle = String(label).toLowerCase();
  const buttons = [...document.querySelectorAll('button')].filter(btn => btn.offsetParent !== null);
  const preferred = buttons.find(btn => (btn.getAttribute('title') || '').toLowerCase().includes(needle));
  const fallback = buttons.find(btn => (btn.textContent || '').trim().toLowerCase().includes(needle));
  (preferred || fallback)?.click();
}

function ThoughtBubble({ active }) {
  const thoughts = ['Snack?', 'Warm...', 'Missed you!', 'Bath time!', 'Study first? 👀', 'Banana?'];
  const [text, setText] = useState('');
  useEffect(() => {
    if (!active) return;
    let hideTimer;
    const show = () => {
      setText(thoughts[Math.floor(Math.random() * thoughts.length)]);
      hideTimer = setTimeout(() => setText(''), 4200);
    };
    const initial = setTimeout(show, 9000);
    const interval = setInterval(show, 30000);
    return () => { clearTimeout(initial); clearTimeout(hideTimer); clearInterval(interval); };
  }, [active]);
  return text ? <div className="mh-thought" aria-hidden="true">{text}</div> : null;
}

export default function HealthyStudentExperience() {
  const [studentId, setStudentId] = useState(null);
  const [student, setStudent] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sittersOpen, setSittersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState({ key: 0, amount: 0 });
  const [toast, setToast] = useState('');
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem('monkeyTracker_theme') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    // Double safety: legacy navigation also starts collapsed after the build patch.
    try { localStorage.setItem('monkeyTracker_sidebarCollapsed', 'true'); } catch {}
    const detect = () => {
      const marker = findStudentMarker();
      const id = marker?.getAttribute('data-monkey-student-id') || null;
      setStudentId(prev => prev === id ? prev : id);
      document.documentElement.classList.toggle('mh-student-active', !!id);
    };
    detect();
    const observer = new MutationObserver(detect);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); document.documentElement.classList.remove('mh-student-active'); };
  }, []);

  useEffect(() => {
    const syncTheme = () => {
      try {
        const next = localStorage.getItem('monkeyTracker_theme') || 'light';
        setThemeMode(next === 'dark' || next === 'rainbow' ? next : 'light');
      } catch {}
    };
    const onClick = () => window.setTimeout(syncTheme, 0);
    document.addEventListener('click', onClick, true);
    window.addEventListener('storage', syncTheme);
    syncTheme();
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('storage', syncTheme); };
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    setSittersOpen(false);
    if (!studentId) { setStudent(null); return; }
    completeDueJobsForStudent(studentId).catch(err => console.warn('Sitter completion check failed:', err));
    return subscribeStudent(studentId, setStudent, err => console.warn('Student live sync failed:', err));
  }, [studentId]);

  const pending = useMemo(() => student ? buildPendingPassiveIncome(student, localDayKey()) : null, [student]);
  const challengeBonus = useMemo(() => student ? getChallengeBonus(student, localDayKey()) : null, [student]);
  const collectedToday = student?.dailyEconomy?.lastPassiveCollectionDate === localDayKey();

  const notify = useCallback(message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2300);
  }, []);

  const collect = useCallback(async () => {
    if (!studentId || busy) return;
    setBusy(true);
    try {
      const result = await collectPassiveIncome(studentId);
      if (result.amount > 0) {
        setBurst(prev => ({ key: prev.key + 1, amount: result.amount }));
        notify(`${result.amount} ★ collected! Your pets worked hard today.`);
      } else notify('Pet Stars are already collected for today.');
    } catch (error) { notify(error.message || 'Could not collect Stars'); }
    finally { setBusy(false); }
  }, [studentId, busy, notify]);

  const collectBonus = useCallback(async () => {
    if (!studentId || busy) return;
    setBusy(true);
    try {
      const result = await collectChallengeBonus(studentId);
      if (result.amount > 0) { setBurst(prev => ({ key: prev.key + 1, amount: result.amount })); notify(`Challenge bonus: +${result.amount} ★`); }
      else notify(result.alreadyCollected ? 'Challenge bonus already collected.' : 'Finish today’s challenge first.');
    } catch (error) { notify(error.message || 'Could not collect bonus'); }
    finally { setBusy(false); }
  }, [studentId, busy, notify]);

  if (!studentId || !student) return null;
  const ready = collectedToday ? 0 : (pending?.total || 0);
  const report = student.latestSittingReport || null;

  return (
    <div id="mh-student-layer" data-active="true" data-theme={themeMode}>
      <header className="mh-topbar">
        <button className="mh-menu-button" onClick={() => setDrawerOpen(true)} aria-label="Open menu">☰</button>
        <div className="mh-brand">Monkey Hotspring</div>
        <button className="mh-stat" onClick={() => { if (ready) document.querySelector('.mh-today-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>⭐ {Number(student.points || 0).toLocaleString()}{ready ? <small>+{ready} ready</small> : null}</button>
        <div className="mh-stat">🔥 {Number(student.streak || 0)}</div>
        <button className="mh-world" onClick={() => clickLegacyAction('World View')}>World View</button>
        <button className="mh-profile" onClick={() => setDrawerOpen(true)} aria-label="Open profile">🐒</button>
      </header>

      <div className="mh-today-wrap">
        <DailyPetIncome
          pending={pending}
          challengeBonus={challengeBonus}
          collectedToday={collectedToday}
          onCollect={collect}
          onCollectBonus={collectBonus}
          onPlayChallenge={() => clickLegacyAction('Daily Challenge')}
          busy={busy}
        />
      </div>

      <DailyReturnSummary studentId={studentId} amount={ready} days={pending?.days || 1} report={report} burstKey={burst.key} />
      <ThoughtBubble active={!drawerOpen && !sittersOpen} />

      {burst.key > 0 && <div key={burst.key} className="mh-star-burst" aria-hidden="true"><span>★</span><span>★</span><span>★</span><b>+{burst.amount}</b></div>}
      {toast && <div className="mh-toast" role="status">{toast}</div>}

      <StudentNavigationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} student={student} onOpenSitters={() => { setDrawerOpen(false); setSittersOpen(true); }} onLegacyAction={clickLegacyAction} />
      {sittersOpen && <MonkeySitters student={student} onClose={() => setSittersOpen(false)} />}
    </div>
  );
}
