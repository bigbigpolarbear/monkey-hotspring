import React, { useEffect } from 'react';

export default function StudentNavigationDrawer({
  open, onClose, student, onOpenSitters, onOpenChallenge, onOpenRules, onOpenVocab, onLegacyAction,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const exams = Array.isArray(student?.exams) ? student.exams : [];
  const streak = Number(student?.streak) || 0;
  const action = label => { onLegacyAction(label); onClose(); };
  return (
    <div className="mh-drawer-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="mh-drawer" role="dialog" aria-modal="true" aria-label="Student menu">
        <div className="mh-drawer-head">
          <div>
            <div className="mh-kicker">Monkey Hotspring</div>
            <h2>{student?.name || 'Your Hot Spring'}</h2>
            <div className="mh-muted">⭐ {Number(student?.points || 0).toLocaleString()} · 🔥 {streak} day streak</div>
          </div>
          <button className="mh-icon-button" onClick={onClose} aria-label="Close menu">✕</button>
        </div>
        <nav className="mh-drawer-actions">
          <button onClick={onOpenChallenge}>☀️ Today’s challenge</button>
          <button onClick={onOpenRules}>⭐ How to earn Stars</button>
          <button onClick={onOpenVocab}>🧠 My Vocabulary</button>
          <button onClick={() => action('Missions')}>🎯 Missions</button>
          <button onClick={() => action('Food')}>🍙 Food & feeding</button>
          <button onClick={onOpenSitters}>🐒 Monkey Sitters — Coming Soon</button>
          <button onClick={() => action('World View')}>♨️ Hot Spring / Classroom</button>
        </nav>
        <section className="mh-drawer-section">
          <div className="mh-section-title">Upcoming exams</div>
          {exams.length ? exams.slice(0, 4).map((exam, i) => (
            <div className="mh-mini-row" key={exam.id || `${exam.name}-${i}`}>
              <span>{exam.name || exam.subject || 'Exam'}</span>
              <span className="mh-muted">{exam.date || ''}</span>
            </div>
          )) : <div className="mh-empty">No exams added.</div>}
        </section>
        <section className="mh-drawer-section">
          <div className="mh-section-title">Gentle reminder</div>
          <p className="mh-drawer-copy">Your pets keep earning even when you miss a day. Passive earnings save for up to 7 days, then everyone takes a little holiday.</p>
        </section>
      </aside>
    </div>
  );
}
