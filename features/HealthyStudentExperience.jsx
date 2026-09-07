import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StudentNavigationDrawer from '../components/StudentNavigationDrawer.jsx';
import DailyReturnSummary from '../components/DailyReturnSummary.jsx';
import MonkeySitters from '../components/MonkeySitters.jsx';
import {
  DailyChallengePanel, DailyVocabularyPanel, LeaderboardPanel, ReadingPanel,
  StarRulesPanel, TodayPanel, VocabularyLogPanel,
} from '../components/StudentHubPanels.jsx';
import { buildPendingPassiveIncome, localDayKey } from '../game/petEconomy.js';
import { collectPassiveIncome, subscribeStudent } from '../services/studentEconomy.js';
import { getStudents } from '../firebase.js';
import '../styles/student-experience.css';
import '../styles/student-hub.css';

function findStudentMarker() {
  return document.querySelector('[data-monkey-student-id]');
}

function clickLegacyAction(label) {
  const needle = String(label).toLowerCase();
  const buttons = [...document.querySelectorAll('button')];
  const visible = buttons.filter(btn => btn.offsetParent !== null);
  const find = list => list.find(btn => (btn.getAttribute('title') || '').toLowerCase().includes(needle))
    || list.find(btn => (btn.textContent || '').trim().toLowerCase().includes(needle));
  (find(visible) || find(buttons))?.click();
}

function tagLegacyLeaderboard(marker) {
  if (!marker) return;
  const candidates = [...marker.querySelectorAll('button,div')].filter(node => {
    const text = (node.textContent || '').trim();
    return text === '🏆 Leaderboard' || text === 'Leaderboard';
  });
  for (const candidate of candidates) {
    let node = candidate;
    while (node && node !== marker) {
      const position = window.getComputedStyle(node).position;
      if (position === 'absolute' || position === 'fixed') break;
      node = node.parentElement;
    }
    if (node && node !== marker && !node.hasAttribute('data-monkey-legacy-leaderboard')) {
      node.setAttribute('data-monkey-legacy-leaderboard', 'true');
    }
  }
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
  const [activePanel, setActivePanel] = useState(null);
  const [leaderboardStudents, setLeaderboardStudents] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState({ key: 0, amount: 0 });
  const [toast, setToast] = useState('');
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem('monkeyTracker_theme') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    try { localStorage.setItem('monkeyTracker_sidebarCollapsed', 'true'); } catch {}
    const detect = () => {
      const marker = findStudentMarker();
      const id = marker?.getAttribute('data-monkey-student-id') || null;
      setStudentId(prev => prev === id ? prev : id);
      document.documentElement.classList.toggle('mh-student-active', !!id);
      if (marker) tagLegacyLeaderboard(marker);
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
    setActivePanel(null);
    setStudent(null);
    if (!studentId) return;
    return subscribeStudent(studentId, setStudent, error => console.warn('Student live sync failed:', error));
  }, [studentId]);

  useEffect(() => {
    if (activePanel !== 'leaderboard' || !student) return;
    let cancelled = false;
    setLeaderboardLoading(true);
    getStudents().then(all => {
      if (cancelled) return;
      const teacherId = student.teacherId || null;
      const filtered = teacherId ? all.filter(item => item.teacherId === teacherId) : all.filter(item => item.id === student.id);
      setLeaderboardStudents(filtered.some(item => item.id === student.id) ? filtered : [student, ...filtered]);
    }).catch(error => {
      console.warn('Leaderboard load failed:', error);
      if (!cancelled) setLeaderboardStudents([student]);
    }).finally(() => { if (!cancelled) setLeaderboardLoading(false); });
    return () => { cancelled = true; };
  }, [activePanel, student?.id, student?.teacherId]);

  const pending = useMemo(() => student ? buildPendingPassiveIncome(student, localDayKey()) : null, [student]);
  const collectedToday = student?.dailyEconomy?.lastPassiveCollectionDate === localDayKey();

  const notify = useCallback(message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const rewardBurst = useCallback(amount => {
    const safe = Math.max(0, Number(amount) || 0);
    if (safe) setBurst(prev => ({ key: prev.key + 1, amount: safe }));
  }, []);

  const collect = useCallback(async () => {
    if (!studentId || busy) return;
    setBusy(true);
    try {
      const result = await collectPassiveIncome(studentId);
      if (result.amount > 0) {
        rewardBurst(result.amount);
        notify(`${result.amount} ★ collected! Your pets worked hard today.`);
      } else notify('Pet Stars are already collected for today.');
    } catch (error) { notify(error.message || 'Could not collect Stars'); }
    finally { setBusy(false); }
  }, [studentId, busy, notify, rewardBurst]);

  const openPanel = useCallback(name => {
    setDrawerOpen(false);
    setSittersOpen(false);
    setActivePanel(current => current === name ? null : name);
  }, []);

  if (!studentId || !student) return null;
  const ready = collectedToday ? 0 : (pending?.total || 0);
  const report = student.latestSittingReport || null;
  const panelCommon = { student, onClose: () => setActivePanel(null) };

  return (
    <div id="mh-student-layer" data-active="true" data-theme={themeMode} data-panel={activePanel || 'none'}>
      <header className="mh-topbar mh-hub-topbar">
        <button className="mh-menu-button" onClick={() => { setActivePanel(null); setDrawerOpen(true); }} aria-label="Open menu">☰</button>
        <div className="mh-brand">Monkey Hotspring</div>
        <button className="mh-stat mh-star-stat" onClick={() => openPanel('rules')} aria-label="Open ways to earn Stars">⭐ {Number(student.points || 0).toLocaleString()}<small>Earn Stars</small></button>
        <button className={`mh-stat mh-hub-nav${activePanel === 'today' ? ' is-active' : ''}`} onClick={() => openPanel('today')}>☀️ Today</button>
        <button className={`mh-stat mh-hub-nav${activePanel === 'leaderboard' ? ' is-active' : ''}`} onClick={() => openPanel('leaderboard')}>🏆 <span>Leaderboard</span></button>
        <div className="mh-stat mh-streak-stat">🔥 {Number(student.streak || 0)}</div>
        <button className="mh-world" onClick={() => { setActivePanel(null); clickLegacyAction('World View'); }}>World View</button>
        <button className="mh-profile" onClick={() => { setActivePanel(null); setDrawerOpen(true); }} aria-label="Open profile">🐒</button>
      </header>

      {activePanel === 'today' && <TodayPanel {...panelCommon} pending={pending} busy={busy} onCollectPet={collect} onOpenChallenge={() => setActivePanel('challenge')} onOpenVocab={() => setActivePanel('vocab')} onOpenReading={() => setActivePanel('reading')} onOpenRules={() => setActivePanel('rules')} />}
      {activePanel === 'rules' && <StarRulesPanel {...panelCommon} pending={pending} busy={busy} onCollectPet={collect} onOpenChallenge={() => setActivePanel('challenge')} onOpenVocab={() => setActivePanel('vocab')} onOpenReading={() => setActivePanel('reading')} onOpenVocabLog={() => setActivePanel('vocabLog')} />}
      {activePanel === 'challenge' && <DailyChallengePanel {...panelCommon} notify={notify} onReward={rewardBurst} />}
      {activePanel === 'vocab' && <DailyVocabularyPanel {...panelCommon} notify={notify} onReward={rewardBurst} onOpenLog={() => setActivePanel('vocabLog')} />}
      {activePanel === 'vocabLog' && <VocabularyLogPanel {...panelCommon} />}
      {activePanel === 'reading' && <ReadingPanel {...panelCommon} notify={notify} onReward={rewardBurst} />}
      {activePanel === 'leaderboard' && <LeaderboardPanel {...panelCommon} students={leaderboardStudents} loading={leaderboardLoading} />}

      {!activePanel && !drawerOpen && !sittersOpen && <DailyReturnSummary studentId={studentId} amount={ready} days={pending?.days || 1} report={report} burstKey={burst.key} />}
      <ThoughtBubble active={!activePanel && !drawerOpen && !sittersOpen} />

      {burst.key > 0 && <div key={burst.key} className="mh-star-burst" aria-hidden="true"><span>★</span><span>★</span><span>★</span><b>+{burst.amount}</b></div>}
      {toast && <div className="mh-toast" role="status">{toast}</div>}

      <StudentNavigationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        student={student}
        onOpenSitters={() => { setDrawerOpen(false); setActivePanel(null); setSittersOpen(true); }}
        onOpenChallenge={() => { setDrawerOpen(false); setActivePanel('challenge'); }}
        onOpenRules={() => { setDrawerOpen(false); setActivePanel('rules'); }}
        onOpenVocab={() => { setDrawerOpen(false); setActivePanel('vocabLog'); }}
        onLegacyAction={label => { setActivePanel(null); clickLegacyAction(label); }}
      />
      {sittersOpen && <MonkeySitters student={student} onClose={() => setSittersOpen(false)} />}
    </div>
  );
}
