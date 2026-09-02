import React, { useState } from 'react';

export default function DailyPetIncome({ pending, challengeBonus, collectedToday, onCollect, onCollectBonus, busy, onPlayChallenge }) {
  const [details, setDetails] = useState(false);
  const care = pending?.care;
  return (
    <section className="mh-today-card" aria-label="Today">
      <div className="mh-today-title"><span>☀️ Today</span><button className="mh-text-button" onClick={() => setDetails(v => !v)}>{details ? 'Hide' : 'Earnings'}</button></div>
      {!collectedToday && pending?.total > 0 ? (
        <>
          <div className="mh-hero-line">Your pets earned <strong>{pending.total} ★</strong>{pending.days > 1 ? ` while you were away for ${pending.days} days` : ''}.</div>
          <button className="mh-primary" disabled={busy} onClick={onCollect}>Collect {pending.total} ★</button>
        </>
      ) : <div className="mh-success-line">✓ Pet Stars collected today</div>}
      <div className="mh-bonus-row">
        <span>Daily challenge</span>
        {challengeBonus?.available ? <button className="mh-bonus-button" disabled={busy} onClick={onCollectBonus}>+{challengeBonus.amount} ★ collect</button> : challengeBonus?.completed ? <span className="mh-success-line">✓ +{challengeBonus.amount} ★ collected</span> : <button className="mh-text-button" onClick={onPlayChallenge}>+{challengeBonus?.amount || 8} ★ available</button>}
      </div>
      {care && <div className="mh-care-line">{care.emoji} {care.label} · earnings {care.bonusLabel}</div>}
      {details && <div className="mh-earnings-list">
        {(pending?.breakdown || []).map(item => <div className="mh-mini-row" key={item.petId}><span><strong>{item.name}</strong>{item.count > 1 ? ` ×${item.count}` : ''} <small>{item.rarity}</small></span><span>+{item.contribution} ★</span></div>)}
        <div className="mh-total-row"><span>Tomorrow’s estimate</span><strong>{pending?.perDay || 0}–{Math.max(pending?.perDay || 0, Math.round((pending?.perDay || 0) * 1.15))} ★</strong></div>
      </div>}
    </section>
  );
}
