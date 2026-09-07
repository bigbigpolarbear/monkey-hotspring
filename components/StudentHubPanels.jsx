import React, { useMemo, useState } from 'react';
import { buildDailyChallenge, getDailyVocab, masteryLabel, VOCABULARY } from '../game/dailyContent.js';
import { localDayKey } from '../game/petEconomy.js';
import { REWARD_CONFIG, calculateReadingReward } from '../game/rewardConfig.js';
import { completeDailyChallenge, completeDailyVocab, logReadingAndReward, recordVocabReview } from '../services/rewardService.js';

function todayFlags(student = {}) {
  const today = localDayKey();
  const challengeDone = student?.dailyLearning?.challengeDate === today || (student?.dailyChallenge?.date === today && student?.dailyChallenge?.completed === true);
  const vocabDone = student?.dailyLearning?.vocabDate === today;
  const petDone = student?.dailyEconomy?.lastPassiveCollectionDate === today;
  const readingToday = (Array.isArray(student?.readingLog) ? student.readingLog : []).filter(entry => entry?.date === today);
  const readingStars = readingToday.reduce((sum, entry) => sum + Math.max(0, Number(entry.stars) || 0), 0);
  const starsEarnedToday = (petDone ? Math.max(0, Number(student?.dailyEconomy?.lastPassiveAmount) || 0) : 0)
    + (challengeDone ? REWARD_CONFIG.dailyChallenge : 0)
    + (vocabDone ? REWARD_CONFIG.dailyVocab : 0)
    + readingStars;
  return { today, challengeDone, vocabDone, petDone, readingToday, readingStars, starsEarnedToday };
}

function PanelFrame({ title, kicker, onClose, children, wide = false, modal = false }) {
  return (
    <div className={`mh-hub-backdrop${modal ? ' mh-hub-backdrop-modal' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`mh-hub-panel${wide ? ' mh-hub-panel-wide' : ''}${modal ? ' mh-hub-panel-modal' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="mh-hub-panel-head">
          <div>{kicker && <div className="mh-kicker">{kicker}</div>}<h2>{title}</h2></div>
          <button className="mh-icon-button" onClick={onClose} aria-label={`Close ${title}`}>✕</button>
        </header>
        {children}
      </section>
    </div>
  );
}

function ActionRow({ icon, title, subtitle, reward, done, actionLabel, onAction, disabled = false, note }) {
  return (
    <div className={`mh-action-row${done ? ' is-done' : ''}`}>
      <div className="mh-action-icon" aria-hidden="true">{icon}</div>
      <div className="mh-action-copy"><strong>{done ? `✓ ${title}` : title}</strong><span>{done ? `${reward || ''}${reward ? ' earned' : 'Completed'}` : subtitle}</span>{note && <small>{note}</small>}</div>
      {!done && reward && <b className="mh-action-reward">{reward}</b>}
      {!done && actionLabel && <button className="mh-secondary" disabled={disabled} onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

export function TodayPanel({ student, pending, busy, onCollectPet, onOpenChallenge, onOpenVocab, onOpenReading, onOpenRules, onClose }) {
  const flags = todayFlags(student);
  const petAmount = Math.max(0, Number(pending?.total) || 0);
  return (
    <PanelFrame title="☀️ Today" kicker="Earnings" onClose={onClose}>
      <div className="mh-compact-list">
        {flags.petDone ? <div className="mh-compact-done">✓ Pet earnings collected <b>+{Number(student?.dailyEconomy?.lastPassiveAmount || 0)} ⭐</b></div> : (
          <ActionRow icon="🐵" title="Pet earnings" subtitle={petAmount ? `${petAmount} Stars ready` : 'Nothing ready yet'} reward={petAmount ? `+${petAmount} ⭐` : ''} actionLabel={petAmount ? 'Collect' : ''} onAction={onCollectPet} disabled={busy || !petAmount} />
        )}
        {flags.challengeDone ? <div className="mh-compact-done">✓ Daily Challenge <b>+{REWARD_CONFIG.dailyChallenge} ⭐</b></div> : <ActionRow icon="🎯" title="Daily Challenge" subtitle="Four quick questions" reward={`+${REWARD_CONFIG.dailyChallenge} ⭐`} actionLabel="Start Challenge" onAction={onOpenChallenge} />}
        {flags.vocabDone ? <div className="mh-compact-done">✓ Daily Vocab <b>+{REWARD_CONFIG.dailyVocab} ⭐</b></div> : <ActionRow icon="🧠" title="Daily Vocabulary" subtitle="Learn today’s word" reward={`+${REWARD_CONFIG.dailyVocab} ⭐`} actionLabel="Learn Word" onAction={onOpenVocab} />}
        <ActionRow icon="📖" title="Reading" subtitle={flags.readingStars ? `${flags.readingStars} Stars from reading today` : 'Earn Stars from your own book'} actionLabel="View options" onAction={onOpenReading} />
      </div>
      <div className="mh-today-total"><span>Stars earned today</span><strong>{flags.starsEarnedToday} ⭐</strong></div>
      <button className="mh-text-button mh-rules-link" onClick={onOpenRules}>See every way to earn Stars →</button>
    </PanelFrame>
  );
}

export function DailyChallengePanel({ student, onClose, onReward, notify }) {
  const dateKey = localDayKey();
  const alreadyDone = todayFlags(student).challengeDone;
  const questions = useMemo(() => buildDailyChallenge(dateKey, student), [dateKey, student?.id, student?.vocabulary]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(alreadyDone);
  const [award, setAward] = useState(alreadyDone ? REWARD_CONFIG.dailyChallenge : 0);
  const question = questions[index];
  const isCorrect = selected === question?.correctIndex;

  async function choose(answerIndex) {
    if (selected != null || busy || finished) return;
    setSelected(answerIndex);
    if (question?.kind === 'vocab-review' && question.reviewWord) {
      recordVocabReview(student.id, question.reviewWord, answerIndex === question.correctIndex, { dateKey }).catch(() => {});
    }
    if (answerIndex === question.correctIndex) setCorrectCount(value => value + 1);
  }

  async function next() {
    if (selected == null || busy) return;
    if (index < questions.length - 1) {
      setIndex(value => value + 1); setSelected(null); return;
    }
    setBusy(true);
    try {
      const finalCorrect = correctCount + (isCorrect ? 0 : 0);
      const result = await completeDailyChallenge(student.id, { dateKey, correct: finalCorrect, total: questions.length });
      const amount = result.amount || 0;
      setAward(amount || result.previousAmount || REWARD_CONFIG.dailyChallenge);
      setFinished(true);
      if (amount) onReward(amount);
      notify(result.duplicate ? 'Daily Challenge was already completed today.' : `Daily Challenge complete! +${amount} ⭐`);
    } catch (error) { notify(error.message || 'Could not finish the Daily Challenge'); }
    finally { setBusy(false); }
  }

  if (finished) return (
    <PanelFrame title="🎉 Daily Challenge Complete!" kicker="Come back tomorrow" onClose={onClose} modal>
      <div className="mh-complete-state"><div className="mh-complete-stars">+{award || REWARD_CONFIG.dailyChallenge} ⭐</div><p>You finished today’s challenge. Your reward is saved to your account and cannot be collected twice.</p><button className="mh-primary" onClick={onClose}>Done</button></div>
    </PanelFrame>
  );

  return (
    <PanelFrame title="🎯 Daily Challenge" kicker={`Question ${index + 1} of ${questions.length}`} onClose={onClose} modal>
      <div className="mh-challenge-progress"><span style={{ width:`${((index + (selected != null ? 1 : 0)) / questions.length) * 100}%` }} /></div>
      <h3 className="mh-question">{question.prompt}</h3>
      <div className="mh-answer-grid">
        {question.options.map((option, answerIndex) => {
          const chosen = selected === answerIndex;
          const correct = selected != null && answerIndex === question.correctIndex;
          const wrong = chosen && !correct;
          return <button key={option} className={`mh-answer${correct ? ' is-correct' : ''}${wrong ? ' is-wrong' : ''}`} disabled={selected != null} onClick={() => choose(answerIndex)}>{option}</button>;
        })}
      </div>
      {selected != null && <div className={`mh-feedback ${isCorrect ? 'is-correct' : 'is-wrong'}`}><strong>{isCorrect ? '✓ Correct!' : 'Not quite — keep going.'}</strong><span>{question.explanation}</span></div>}
      <div className="mh-panel-footer"><span>{correctCount + (isCorrect ? 1 : 0)} correct so far</span><button className="mh-primary" disabled={selected == null || busy} onClick={next}>{index === questions.length - 1 ? 'Finish Challenge' : 'Next'}</button></div>
    </PanelFrame>
  );
}

export function DailyVocabularyPanel({ student, onClose, onReward, onOpenLog, notify }) {
  const dateKey = localDayKey();
  const word = getDailyVocab(dateKey);
  const done = todayFlags(student).vocabDone;
  const distractors = VOCABULARY.filter(item => item.word !== word.word).slice(0, 3).map(item => item.definition);
  const options = useMemo(() => [word.definition, ...distractors].sort((a, b) => `${dateKey}:${a}`.localeCompare(`${dateKey}:${b}`)), [dateKey, word.word]);
  const correctIndex = options.indexOf(word.definition);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [collected, setCollected] = useState(done);

  async function answer(index) {
    if (busy || collected) return;
    setSelected(index);
    if (index !== correctIndex) return;
    setBusy(true);
    try {
      const result = await completeDailyVocab(student.id, word, { dateKey });
      setCollected(true);
      if (result.amount) onReward(result.amount);
      notify(result.duplicate ? `${word.word} was already collected today.` : `Word collected! +${result.amount} ⭐`);
    } catch (error) { notify(error.message || 'Could not save today’s word'); }
    finally { setBusy(false); }
  }

  return (
    <PanelFrame title="🧠 Word of the Day" kicker={collected ? 'Collected' : `+${REWARD_CONFIG.dailyVocab} Stars`} onClose={onClose} modal>
      <div className="mh-word-card"><h3>{word.word.toUpperCase()}</h3><em>{word.partOfSpeech}</em><p>{word.definition}</p><blockquote>“{word.example}”</blockquote><div className="mh-memory-tip">💡 {word.memory}</div><small>Related word: <b>{word.synonym}</b></small></div>
      {collected ? <div className="mh-complete-state mh-complete-compact"><strong>✓ Word collected!</strong><p>{word.word.toUpperCase()} is in your Vocabulary Log.</p><div className="mh-inline-actions"><button className="mh-secondary" onClick={onOpenLog}>Open Vocab Log</button><button className="mh-primary" onClick={onClose}>Done</button></div></div> : (
        <><h4 className="mh-mini-question">Which meaning matches “{word.word}”?</h4><div className="mh-answer-grid mh-answer-grid-small">{options.map((option, index) => <button key={option} className={`mh-answer${selected === index ? (index === correctIndex ? ' is-correct' : ' is-wrong') : ''}`} onClick={() => answer(index)} disabled={busy || (selected === correctIndex)}>{option}</button>)}</div>{selected != null && selected !== correctIndex && <div className="mh-feedback is-wrong"><strong>Try again.</strong><span>Use the definition and memory trick above.</span></div>}</>
      )}
    </PanelFrame>
  );
}

export function VocabularyLogPanel({ student, onClose }) {
  const words = Array.isArray(student?.vocabulary) ? student.vocabulary : [];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('recent');
  const shown = useMemo(() => {
    let list = words.filter(item => `${item.word} ${item.definition}`.toLowerCase().includes(search.toLowerCase()));
    if (filter === 'alphabetical') list = [...list].sort((a, b) => String(a.word).localeCompare(String(b.word)));
    else if (filter === 'practice') list = list.filter(item => (Number(item.mastery) || 0) < 2);
    else if (filter === 'mastered') list = list.filter(item => (Number(item.mastery) || 0) >= 3);
    else list = [...list].sort((a, b) => String(b.collectedDate || '').localeCompare(String(a.collectedDate || '')));
    return list;
  }, [words, search, filter]);
  return (
    <PanelFrame title="📖 My Vocabulary" kicker={`${words.length} words collected`} onClose={onClose} wide>
      <div className="mh-filter-bar"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search words or meanings…" aria-label="Search vocabulary"/><select value={filter} onChange={event => setFilter(event.target.value)}><option value="recent">Recently learned</option><option value="alphabetical">Alphabetical</option><option value="practice">Needs practice</option><option value="mastered">Mastered</option></select></div>
      <div className="mh-vocab-grid">{shown.length ? shown.map(item => { const mastery = Math.max(0, Math.min(3, Number(item.mastery) || 0)); return <article className="mh-vocab-card" key={item.word}><div className="mh-vocab-card-head"><div><h3>{item.word}</h3><em>{item.partOfSpeech}</em></div><span>{'●'.repeat(mastery)}{'○'.repeat(3 - mastery)} {masteryLabel(mastery)}</span></div><p>{item.definition}</p>{item.example && <small>“{item.example}”</small>}<div className="mh-memory-tip">💡 {item.memory}</div><footer>Collected {item.collectedDate || 'recently'}</footer></article>; }) : <div className="mh-empty">No words match this view yet.</div>}</div>
    </PanelFrame>
  );
}

function groupedReading(log = []) {
  const groups = new Map();
  for (const entry of log) {
    const key = String(entry.normalizedTitle || entry.bookTitle || '').toLowerCase();
    if (!key) continue;
    const current = groups.get(key) || { title:entry.bookTitle, pages:0, stars:0, sessions:[] };
    current.pages += Math.max(0, Number(entry.pages) || 0); current.stars += Math.max(0, Number(entry.stars) || 0); current.sessions.push(entry); groups.set(key, current);
  }
  return [...groups.values()].slice(0, 8);
}

export function ReadingPanel({ student, onClose, onReward, notify }) {
  const dateKey = localDayKey();
  const log = Array.isArray(student?.readingLog) ? student.readingLog : [];
  const alreadyEarnedToday = log.filter(entry => entry?.date === dateKey).reduce((sum, entry) => sum + Math.max(0, Number(entry.stars) || 0), 0);
  const [bookTitle, setBookTitle] = useState(''); const [startPage, setStartPage] = useState(''); const [endPage, setEndPage] = useState(''); const [completed, setCompleted] = useState(false); const [busy, setBusy] = useState(false);
  const preview = calculateReadingReward({ startPage, endPage, alreadyEarnedToday });
  const groups = useMemo(() => groupedReading(log), [log]);
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true);
    try {
      const result = await logReadingAndReward(student.id, { bookTitle, startPage, endPage, completed }, { dateKey });
      if (result.amount) onReward(result.amount);
      notify(result.duplicate ? 'That reading session was already logged.' : `Nice reading! ${result.session.pages} pages · +${result.amount} ⭐`);
      if (!result.duplicate) { setStartPage(endPage); setEndPage(''); setCompleted(false); }
    } catch (error) { notify(error.message || 'Could not log reading'); }
    finally { setBusy(false); }
  }
  return (
    <PanelFrame title="📚 Log Your Reading" kicker={`Up to ${REWARD_CONFIG.reading.maxStarsPerDay} Stars / day`} onClose={onClose} wide>
      <div className="mh-reading-layout"><form className="mh-reading-form" onSubmit={submit}><label>Book<input value={bookTitle} onChange={event => setBookTitle(event.target.value)} placeholder="Book title" maxLength={80}/></label><div className="mh-reading-pages"><label>Started at page<input type="number" min="0" value={startPage} onChange={event => setStartPage(event.target.value)}/></label><label>Finished at page<input type="number" min="1" value={endPage} onChange={event => setEndPage(event.target.value)}/></label></div><div className="mh-reading-preview"><span>Pages read <b>{preview.pages || 0}</b></span><span>Stars <b>+{preview.stars || 0} ⭐</b></span></div>{!preview.valid && startPage !== '' && endPage !== '' && <small className="mh-form-note">{preview.reason}</small>}<label className="mh-check"><input type="checkbox" checked={completed} onChange={event => setCompleted(event.target.checked)}/> I finished this book</label><button className="mh-primary" type="submit" disabled={busy || !bookTitle.trim() || !preview.valid}>Submit Reading</button><small className="mh-form-note">Stars are calculated automatically: about 1 Star per {REWARD_CONFIG.reading.pagesPerStar} pages, with anti-spam and daily limits.</small></form><section className="mh-reading-history"><h3>Reading Log</h3>{groups.length ? groups.map(group => <article className="mh-book-group" key={group.title}><div><strong>{group.title}</strong><span>{group.pages} pages logged · {group.stars} ⭐</span></div>{group.sessions.slice(0, 3).map(session => <small key={session.id}>{session.date} — {session.pages} pages — +{session.stars} ⭐</small>)}</article>) : <div className="mh-empty">Your reading sessions will appear here.</div>}</section></div>
    </PanelFrame>
  );
}

export function StarRulesPanel({ student, pending, busy, onCollectPet, onOpenChallenge, onOpenVocab, onOpenReading, onOpenVocabLog, onClose }) {
  const flags = todayFlags(student); const petAmount = Math.max(0, Number(pending?.total) || 0); const completedCount = [flags.challengeDone, flags.vocabDone, flags.petDone, flags.readingStars > 0].filter(Boolean).length;
  return (
    <PanelFrame title="⭐ How to Earn Stars" kicker="What can I do today?" onClose={onClose} wide>
      <div className="mh-rules-progress"><div><strong>{completedCount} / 4 activities completed</strong><span>Stars earned today: {flags.starsEarnedToday} ⭐</span></div><div className="mh-progress-dots">{[0,1,2,3].map(i => <span key={i} className={i < completedCount ? 'done' : ''}>★</span>)}</div></div>
      <div className="mh-rules-list"><ActionRow icon="☀️" title="Daily Challenge" subtitle="Complete today’s four-question challenge" reward={`+${REWARD_CONFIG.dailyChallenge} ⭐`} done={flags.challengeDone} actionLabel="Start" onAction={onOpenChallenge}/><ActionRow icon="🧠" title="Daily Vocabulary" subtitle="Learn and collect today’s word" reward={`+${REWARD_CONFIG.dailyVocab} ⭐`} done={flags.vocabDone} actionLabel="Learn" onAction={onOpenVocab}/><ActionRow icon="📚" title="Read on PreIGCSE" subtitle="Complete meaningful verified reading" reward={`+${REWARD_CONFIG.preIGCSE} ⭐`} actionLabel="Go Read" onAction={() => window.open('https://www.preigcse.com', '_blank', 'noopener,noreferrer')} note="Stars are awarded only after verified completion; opening the site alone never earns Stars."/><ActionRow icon="📖" title="Read Your Own Book" subtitle="Log genuine page progress" reward={flags.readingStars ? `+${flags.readingStars} ⭐ today` : 'Earn by pages'} done={false} actionLabel="Log Reading" onAction={onOpenReading}/><ActionRow icon="🐵" title="Pet earnings" subtitle={petAmount ? `${petAmount} Stars ready to collect` : 'Your pets earn every day'} reward={petAmount ? `+${petAmount} ⭐` : ''} done={flags.petDone} actionLabel={petAmount ? 'Collect' : ''} onAction={onCollectPet} disabled={busy || !petAmount}/></div>
      <div className="mh-rules-tools"><button className="mh-secondary" onClick={onOpenVocabLog}>📖 Open Vocabulary Log</button><span>Rewards update everywhere immediately after Firestore confirms them.</span></div>
    </PanelFrame>
  );
}

export function LeaderboardPanel({ students, student, loading, onClose }) {
  const sorted = useMemo(() => [...(students || [])].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0)).slice(0, 20), [students]);
  return (
    <PanelFrame title="🏆 Leaderboard" kicker="Your troop" onClose={onClose}>
      {loading ? <div className="mh-empty">Loading the troop…</div> : <div className="mh-leaderboard-list">{sorted.length ? sorted.map((entry, index) => <div className={`mh-leader-row${entry.id === student.id ? ' is-me' : ''}`} key={entry.id}><span>{index < 3 ? ['🥇','🥈','🥉'][index] : `#${index + 1}`}</span><strong>{entry.name || entry.username || 'Student'}</strong><b>⭐ {Number(entry.points || 0).toLocaleString()}</b></div>) : <div className="mh-empty">No classmates to show yet.</div>}</div>}
    </PanelFrame>
  );
}

export { todayFlags };
