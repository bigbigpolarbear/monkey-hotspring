import React, { useState } from 'react';
import { MONA_BIRTHDAY } from '../game/birthdaySurprise.js';
import { REWARD_CONFIG } from '../game/rewardConfig.js';
import { claimMonaBirthdayGift } from '../services/rewardService.js';

const CONFETTI = ['🎉','✨','⭐','🎊','💖','⭐','✨','🎉','🎊','💛','⭐','✨'];

export default function MonaBirthdayGift({ student, onReward, notify, onDone }) {
  const [taps, setTaps] = useState(0);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awarded, setAwarded] = useState(0);
  const [error, setError] = useState('');
  const remaining = Math.max(0, MONA_BIRTHDAY.tapsToOpen - taps);

  async function tapGift() {
    if (busy || opened) return;
    const next = taps + 1;
    setTaps(next);
    setError('');
    if (next < MONA_BIRTHDAY.tapsToOpen) return;

    setBusy(true);
    try {
      const result = await claimMonaBirthdayGift(student.id);
      const amount = Math.max(0, Number(result.amount) || 0);
      setAwarded(amount);
      setOpened(true);
      if (amount > 0) {
        onReward(amount);
        notify(`Birthday surprise! +${amount} ⭐`);
      } else {
        notify('Mona’s birthday gift was already collected.');
      }
    } catch (e) {
      setTaps(MONA_BIRTHDAY.tapsToOpen - 1);
      setError(e.message || 'Could not open the birthday present. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const scale = 1 + Math.min(taps, MONA_BIRTHDAY.tapsToOpen - 1) * 0.075;

  return (
    <div className="mh-hub-backdrop mh-hub-backdrop-modal mh-birthday-backdrop">
      <section className="mh-hub-panel mh-hub-panel-modal mh-birthday-panel" role="dialog" aria-modal="true" aria-label="Mona birthday surprise">
        {!opened ? (
          <div className="mh-birthday-before">
            <div className="mh-kicker">A special delivery just for you</div>
            <h2>Mona, you have a present! 🎀</h2>
            <p>Keep tapping it. Something is inside…</p>

            <button
              type="button"
              className={`mh-birthday-gift${busy ? ' is-busy' : ''}`}
              onClick={tapGift}
              disabled={busy}
              style={{ '--gift-scale': scale }}
              aria-label={`Tap birthday present. ${remaining} taps remaining.`}
            >
              <span className="mh-gift-lid" aria-hidden="true"><i /></span>
              <span className="mh-gift-box" aria-hidden="true"><i /></span>
              <span className="mh-gift-bow" aria-hidden="true">🎀</span>
            </button>

            <div className="mh-birthday-tap-status" aria-live="polite">
              {busy ? 'Opening your present…' : remaining > 1 ? `${remaining} taps to go!` : remaining === 1 ? 'One more tap!!' : 'Opening…'}
            </div>
            <div className="mh-birthday-meter" aria-hidden="true">
              {Array.from({ length: MONA_BIRTHDAY.tapsToOpen }, (_, index) => (
                <span className={index < taps ? 'done' : ''} key={index}>★</span>
              ))}
            </div>
            {error && <div className="mh-birthday-error" role="alert">{error}</div>}
          </div>
        ) : (
          <div className="mh-birthday-opened">
            <div className="mh-birthday-confetti" aria-hidden="true">
              {CONFETTI.map((piece, index) => <span key={index} style={{ '--i': index }}>{piece}</span>)}
            </div>
            <div className="mh-open-present" aria-hidden="true">
              <div className="mh-open-lid">🎀</div>
              <div className="mh-open-box">🎁</div>
            </div>
            <div className="mh-birthday-100">+{awarded || REWARD_CONFIG.monaBirthday} ⭐</div>
            <h2>Happy Birthday Mona!! 🎉🎂</h2>
            <p>
              {awarded > 0
                ? `You got ${awarded} birthday points! They’ve been added to your total.`
                : 'Your birthday points were already safely added to your account.'}
            </p>
            <button type="button" className="mh-primary mh-birthday-done" onClick={onDone}>Yay!! 💖</button>
          </div>
        )}
      </section>
    </div>
  );
}
