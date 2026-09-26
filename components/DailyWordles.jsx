import React, { useEffect, useMemo, useState } from 'react';
import { localDayKey } from '../game/petEconomy.js';
import { REWARD_CONFIG } from '../game/rewardConfig.js';
import { getChallengeWordle, getStandardWordle, letterStates, WORDLE_THEMES } from '../game/wordleContent.js';
import { submitWordleGuess } from '../services/rewardService.js';

const KEY_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['ENTER','Z','X','C','V','B','N','M','DEL'],
];

function sameDayProgress(student, field, dateKey) {
  const progress = student?.dailyLearning?.[field] || {};
  return progress.date === dateKey ? progress : {};
}

function keyboardState(guesses, answer) {
  const priority = { absent: 1, present: 2, correct: 3 };
  const state = {};
  for (const guess of guesses) {
    const states = letterStates(guess, answer);
    guess.split('').forEach((letter, index) => {
      const next = states[index];
      if (!state[letter] || priority[next] > priority[state[letter]]) state[letter] = next;
    });
  }
  return state;
}

function WordleBoard({
  title, kicker, reward, answer, initialProgress, themeMeta, onClose, onSubmitGuess,
  onReward, notify, afterCompletion,
}) {
  const [guesses, setGuesses] = useState(() => Array.isArray(initialProgress?.guesses) ? initialProgress.guesses : []);
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(initialProgress?.completed === true);
  const [won, setWon] = useState(initialProgress?.won === true);
  const [error, setError] = useState('');
  const keys = useMemo(() => keyboardState(guesses, answer), [guesses, answer]);

  useEffect(() => {
    if (initialProgress?.date && Array.isArray(initialProgress.guesses)) {
      setGuesses(initialProgress.guesses);
      setCompleted(initialProgress.completed === true);
      setWon(initialProgress.won === true);
    }
  }, [initialProgress?.updatedAt, initialProgress?.completed, initialProgress?.won]);

  async function submit() {
    if (busy || completed) return;
    if (!/^[A-Z]{5}$/.test(current)) {
      setError('Enter five letters first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await onSubmitGuess(current);
      const next = result.progress || {};
      setGuesses(Array.isArray(next.guesses) ? next.guesses : [...guesses, current]);
      setCurrent('');
      setCompleted(next.completed === true);
      setWon(next.won === true);
      if (result.amount > 0) {
        onReward(result.amount);
        notify(`Word solved! +${result.amount} ⭐`);
      } else if (next.completed && !next.won) {
        notify('Good try — today’s Wordle is complete.');
      }
    } catch (e) {
      setError(e.message || 'Could not submit that guess.');
    } finally {
      setBusy(false);
    }
  }

  function press(key) {
    if (busy || completed) return;
    if (key === 'ENTER') { submit(); return; }
    if (key === 'DEL') { setCurrent(value => value.slice(0, -1)); setError(''); return; }
    if (/^[A-Z]$/.test(key) && current.length < 5) {
      setCurrent(value => value + key);
      setError('');
    }
  }

  useEffect(() => {
    const handler = event => {
      if (event.key === 'Enter') press('ENTER');
      else if (event.key === 'Backspace') press('DEL');
      else if (/^[a-zA-Z]$/.test(event.key)) press(event.key.toUpperCase());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div className="mh-hub-backdrop mh-hub-backdrop-modal mh-wordle-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="mh-hub-panel mh-hub-panel-modal mh-wordle-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="mh-hub-panel-head">
          <div>
            <div className="mh-kicker">{kicker}</div>
            <h2>{title}</h2>
          </div>
          <div className="mh-wordle-head-actions">
            <span className="mh-toilet-reward">+{reward} ⭐</span>
            <button className="mh-icon-button" onClick={onClose} aria-label={`Close ${title}`}>✕</button>
          </div>
        </header>

        {themeMeta && <div className="mh-wordle-theme-chip">{themeMeta.icon} {themeMeta.label} · {themeMeta.description}</div>}

        <div className="mh-wordle-grid" aria-label="Wordle guesses">
          {Array.from({ length: 6 }, (_, row) => {
            const guess = guesses[row];
            const active = row === guesses.length && !completed;
            const states = guess ? letterStates(guess, answer) : null;
            return (
              <div className="mh-wordle-row" key={row}>
                {Array.from({ length: 5 }, (_, col) => {
                  const letter = guess?.[col] || (active ? current[col] || '' : '');
                  const state = states?.[col] || '';
                  return <div className={`mh-wordle-tile ${state ? `is-${state}` : ''} ${letter && !state ? 'is-filled' : ''}`} key={col}>{letter}</div>;
                })}
              </div>
            );
          })}
        </div>

        {!completed && (
          <>
            {error && <div className="mh-wordle-error" role="status">{error}</div>}
            <div className="mh-wordle-keyboard" aria-label="Wordle keyboard">
              {KEY_ROWS.map((row, rowIndex) => (
                <div className="mh-wordle-key-row" key={rowIndex}>
                  {row.map(key => <button key={key} className={`mh-wordle-key ${keys[key] ? `is-${keys[key]}` : ''} ${key.length > 1 ? 'is-wide' : ''}`} onClick={() => press(key)} disabled={busy}>{key === 'DEL' ? '⌫' : key}</button>)}
                </div>
              ))}
            </div>
            <div className="mh-wordle-footnote">{guesses.length}/6 guesses used · progress is saved after every submitted guess</div>
          </>
        )}

        {completed && (
          <div className="mh-wordle-finish">
            <div className="mh-wordle-finish-icon">{won ? '🎉' : '🧠'}</div>
            <h3>{won ? `Solved! +${reward} ⭐` : `The word was ${answer}`}</h3>
            <p>{won ? 'Your Stars were added once and saved to your account.' : 'No Stars this time — tomorrow brings a new word.'}</p>
            {afterCompletion}
          </div>
        )}
      </section>
    </div>
  );
}

export function DailyWordlePanel({ student, onClose, onReward, notify, onOpenChallenge }) {
  const dateKey = localDayKey();
  const progress = sameDayProgress(student, 'wordleProgress', dateKey);
  const answer = getStandardWordle(dateKey);
  return (
    <WordleBoard
      title="🐵 Daily Wordle"
      kicker="The classic is back"
      reward={REWARD_CONFIG.dailyWordle}
      answer={answer}
      initialProgress={progress}
      onClose={onClose}
      onReward={onReward}
      notify={notify}
      onSubmitGuess={guess => submitWordleGuess(student.id, guess, { dateKey, mode:'standard' })}
      afterCompletion={
        <div className="mh-wordle-unlock">
          <strong>🔥 Challenge Wordle unlocked</strong>
          <span>Choose Science, Humanities or Maths for a harder five-letter word worth +{REWARD_CONFIG.challengeWordle} ⭐.</span>
          <button className="mh-primary" onClick={onOpenChallenge}>Choose a theme →</button>
        </div>
      }
    />
  );
}

export function ChallengeWordlePanel({ student, onClose, onReward, notify, onOpenStandard }) {
  const dateKey = localDayKey();
  const standard = sameDayProgress(student, 'wordleProgress', dateKey);
  const saved = sameDayProgress(student, 'challengeWordleProgress', dateKey);
  const [theme, setTheme] = useState(saved.theme || null);

  if (!standard.completed) {
    return (
      <div className="mh-hub-backdrop mh-hub-backdrop-modal mh-wordle-backdrop">
        <section className="mh-hub-panel mh-hub-panel-modal mh-wordle-panel">
          <header className="mh-hub-panel-head"><div><div className="mh-kicker">Locked</div><h2>🔥 Challenge Wordle</h2></div><button className="mh-icon-button" onClick={onClose}>✕</button></header>
          <div className="mh-wordle-locked"><span>🔒</span><h3>Finish today’s Daily Wordle first.</h3><p>The themed challenge unlocks immediately after your regular Wordle attempt is complete.</p><button className="mh-primary" onClick={onOpenStandard}>Play Daily Wordle</button></div>
        </section>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="mh-hub-backdrop mh-hub-backdrop-modal mh-wordle-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="mh-hub-panel mh-hub-panel-modal mh-wordle-panel" role="dialog" aria-modal="true" aria-label="Choose Challenge Wordle theme">
          <header className="mh-hub-panel-head"><div><div className="mh-kicker">Worth +{REWARD_CONFIG.challengeWordle} Stars</div><h2>🔥 Choose Your Challenge</h2></div><button className="mh-icon-button" onClick={onClose}>✕</button></header>
          <p className="mh-wordle-theme-intro">Pick your strongest subject — or challenge yourself with your weakest. Your theme locks after your first submitted guess.</p>
          <div className="mh-wordle-themes">
            {Object.entries(WORDLE_THEMES).map(([key, meta]) => (
              <button key={key} className="mh-wordle-theme-card" onClick={() => setTheme(key)}>
                <span>{meta.icon}</span><strong>{meta.label}</strong><small>{meta.description}</small><b>+{REWARD_CONFIG.challengeWordle} ⭐</b>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const meta = WORDLE_THEMES[theme];
  const answer = getChallengeWordle(dateKey, theme);
  return (
    <WordleBoard
      title="🔥 Challenge Wordle"
      kicker="Hard mode · five letters"
      reward={REWARD_CONFIG.challengeWordle}
      answer={answer}
      themeMeta={meta}
      initialProgress={saved}
      onClose={onClose}
      onReward={onReward}
      notify={notify}
      onSubmitGuess={guess => submitWordleGuess(student.id, guess, { dateKey, mode:'challenge', theme })}
      afterCompletion={<button className="mh-primary" onClick={onClose}>Done</button>}
    />
  );
}
