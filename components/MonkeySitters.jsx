import React, { useEffect, useMemo, useState } from 'react';
import MonkeySitterCard from './MonkeySitterCard.jsx';
import {
  SITTER_COMPLIMENTS, SITTER_PRICE_BANDS, SITTER_TITLES, sitterLevel,
} from '../game/sitterEconomy.js';
import {
  hireSitter, listJobsForStudent, rateSitter, saveSitterProfile, subscribeSitterProfiles,
} from '../services/sitterService.js';
import { getPetCounts } from '../game/petEconomy.js';

const MONKEY_NAMES = ['Poppy', 'Bobo', 'Bean', 'Miso', 'Mochi', 'Peanut'];

export default function MonkeySitters({ student, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [mode, setMode] = useState('market');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [ratingDrafts, setRatingDrafts] = useState({});
  const mine = profiles.find(p => p.id === student.id);
  const [title, setTitle] = useState(mine?.sitterTitle || SITTER_TITLES[0]);
  const [price, setPrice] = useState(mine?.price || 5);
  const [available, setAvailable] = useState(mine?.availability ?? true);
  const monkeyName = mine?.monkeyName || student.monkeyName || MONKEY_NAMES[(Number(student.monkeyVariant || 1) - 1) % MONKEY_NAMES.length];

  useEffect(() => subscribeSitterProfiles(setProfiles), []);
  useEffect(() => { listJobsForStudent(student.id).then(setJobs).catch(() => {}); }, [student.id]);
  useEffect(() => {
    if (!mine) return;
    setTitle(mine.sitterTitle);
    setPrice(mine.price);
    setAvailable(mine.availability);
  }, [mine?.sitterTitle, mine?.price, mine?.availability]);
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const availableProfiles = useMemo(
    () => profiles
      .filter(profile => profile.id !== student.id)
      .sort((a, b) => Number(b.availability) - Number(a.availability) || b.completedJobs - a.completedJobs),
    [profiles, student.id],
  );
  const petIds = Object.keys(getPetCounts(student));

  async function refreshJobs() {
    setJobs(await listJobsForStudent(student.id));
  }

  async function saveMine() {
    setBusy(true); setMessage('');
    try {
      await saveSitterProfile(student.id, {
        monkeyId: String(student.monkeyVariant || 1), monkeyName,
        sitterTitle: title, availability: available, price,
      });
      setMessage('Sitter profile saved!');
    } catch (error) { setMessage(error.message || 'Could not save profile'); }
    finally { setBusy(false); }
  }

  async function hire(profile) {
    setBusy(true); setMessage('');
    try {
      const result = await hireSitter({ ownerId: student.id, sitterId: profile.id, petIds });
      setMessage(`${profile.monkeyName} is visiting your Hot Spring. ${result.charged} ★ paid.`);
      await refreshJobs();
    } catch (error) { setMessage(error.message || 'Could not hire sitter'); }
    finally { setBusy(false); }
  }

  function draftFor(jobId) {
    return ratingDrafts[jobId] || { rating: 5, compliment: SITTER_COMPLIMENTS[0] };
  }

  function patchDraft(jobId, patch) {
    setRatingDrafts(prev => ({ ...prev, [jobId]: { ...draftFor(jobId), ...patch } }));
  }

  async function submitRating(job) {
    const draft = draftFor(job.id);
    setBusy(true); setMessage('');
    try {
      const result = await rateSitter({ ownerId: student.id, jobId: job.id, ...draft });
      setMessage(`Thanks! Sitter rating is now ${result.average} ★.`);
      await refreshJobs();
    } catch (error) { setMessage(error.message || 'Could not save rating'); }
    finally { setBusy(false); }
  }

  return (
    <div className="mh-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="mh-sitters-modal" role="dialog" aria-modal="true" aria-label="Monkey Sitters">
        <div className="mh-modal-head">
          <div>
            <div className="mh-kicker">Virtual care only</div>
            <h2>🐒 Monkey Sitters</h2>
            <p>Monkeys visit other Hot Springs inside the game. No real-world contact or personal details.</p>
          </div>
          <button className="mh-icon-button" onClick={onClose} aria-label="Close Monkey Sitters">✕</button>
        </div>
        <div className="mh-tabs">
          <button className={mode === 'market' ? 'active' : ''} onClick={() => setMode('market')}>Hire a Sitter</button>
          <button className={mode === 'mine' ? 'active' : ''} onClick={() => setMode('mine')}>Become a Sitter</button>
          <button className={mode === 'jobs' ? 'active' : ''} onClick={() => setMode('jobs')}>My Sitting Jobs</button>
        </div>
        {message && <div className="mh-notice">{message}</div>}

        {mode === 'market' && (
          <div className="mh-sitter-grid">
            {availableProfiles.length
              ? availableProfiles.map(profile => (
                  <MonkeySitterCard
                    key={profile.id}
                    profile={profile}
                    disabled={busy || !!student.activeSittingJobId}
                    onHire={hire}
                  />
                ))
              : <div className="mh-empty">No Monkey Sitters are available yet. Be the first!</div>}
          </div>
        )}

        {mode === 'mine' && (
          <div className="mh-profile-editor">
            <div className="mh-monkey-profile">
              <div className="mh-big-monkey" aria-hidden="true">🐒</div>
              <div>
                <strong>{monkeyName}</strong>
                <span>Sitter Level {sitterLevel(mine?.completedJobs || 0)}</span>
                <small>{mine?.completedJobs || 0} jobs completed</small>
              </div>
            </div>
            <p className="mh-safe-copy">Your current in-game monkey represents you. Your student name, photo, school, email and location are never shown here.</p>
            <label>Title
              <select value={title} onChange={event => setTitle(event.target.value)}>
                {SITTER_TITLES.map(value => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>Price
              <select value={price} onChange={event => setPrice(Number(event.target.value))}>
                {SITTER_PRICE_BANDS.map(value => <option value={value} key={value}>{value} ★ / day</option>)}
              </select>
            </label>
            <label className="mh-switch-row"><span>Available</span><input type="checkbox" checked={available} onChange={event => setAvailable(event.target.checked)} /></label>
            <button className="mh-primary" disabled={busy} onClick={saveMine}>Save sitter profile</button>
          </div>
        )}

        {mode === 'jobs' && (
          <div className="mh-jobs-list">
            {jobs.length ? jobs.slice(0, 12).map(job => {
              const isOwner = job.ownerId === student.id;
              const canRate = isOwner && job.status === 'completed' && job.rating == null;
              const draft = draftFor(job.id);
              return (
                <div className="mh-job-card" key={job.id}>
                  <div className="mh-job-row">
                    <div>
                      <strong>{isOwner ? 'Your sitter visit' : 'Sitting job'}</strong>
                      <span>{job.status === 'completed' ? '✓ Complete' : '🫧 In progress'}</span>
                    </div>
                    <strong>{isOwner ? `-${job.price || 0} ★` : `+${job.sitterPayout || 0} ★`}</strong>
                  </div>
                  {canRate && (
                    <div className="mh-rating-row">
                      <label>Rating
                        <select value={draft.rating} onChange={event => patchDraft(job.id, { rating: Number(event.target.value) })}>
                          {[5, 4, 3, 2, 1].map(value => <option value={value} key={value}>{value} ★</option>)}
                        </select>
                      </label>
                      <label>Compliment
                        <select value={draft.compliment} onChange={event => patchDraft(job.id, { compliment: event.target.value })}>
                          {SITTER_COMPLIMENTS.map(value => <option value={value} key={value}>{value}</option>)}
                        </select>
                      </label>
                      <button className="mh-secondary" disabled={busy} onClick={() => submitRating(job)}>Rate sitter</button>
                    </div>
                  )}
                  {isOwner && job.rating != null && <div className="mh-rated-line">⭐ {job.rating}/5 · {job.compliment}</div>}
                </div>
              );
            }) : <div className="mh-empty">No sitting jobs yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
