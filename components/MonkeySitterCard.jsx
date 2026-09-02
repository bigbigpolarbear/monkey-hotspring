import React from 'react';
import { ratingAverage } from '../game/sitterEconomy.js';

export default function MonkeySitterCard({ profile, disabled, onHire }) {
  const rating = ratingAverage(profile);
  return (
    <article className="mh-sitter-card">
      <div className="mh-sitter-avatar">🐒</div>
      <div className="mh-sitter-main">
        <strong>{profile.monkeyName || 'Monkey Sitter'}</strong>
        <span>{profile.sitterTitle}</span>
        <small>{rating ? `⭐ ${rating} · ` : ''}{profile.completedJobs || 0} sits</small>
      </div>
      <div className="mh-sitter-price"><strong>{profile.price} ★</strong><span>/ day</span></div>
      <button className="mh-secondary" disabled={disabled || !profile.availability} onClick={() => onHire(profile)}>{profile.availability ? 'Hire' : 'Busy'}</button>
    </article>
  );
}
