import React, { useState } from 'react';
import { MONKEY_IDENTITIES } from '../game/anonymousIdentity.js';
import { chooseAnonymousMonkeyIdentity } from '../services/anonymousIdentityService.js';

export default function AnonymousMonkeyChooser({ student, notify, onChosen }) {
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await chooseAnonymousMonkeyIdentity(student.id, selected);
      notify(`You are now ${result.identity.name}! 🐒`);
      onChosen(result.identity);
    } catch (e) {
      setError(e.message || 'Could not save your monkey identity.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mh-hub-backdrop mh-hub-backdrop-modal mh-identity-backdrop">
      <section className="mh-hub-panel mh-hub-panel-modal mh-identity-panel" role="dialog" aria-modal="true" aria-label="Choose anonymous monkey identity">
        <header className="mh-hub-panel-head">
          <div>
            <div className="mh-kicker">New anonymous student names</div>
            <h2>🐒 Choose your monkey identity</h2>
          </div>
        </header>

        <p className="mh-identity-intro">
          From now on, other students will see this monkey name instead of your real name.
          Your username and password stay exactly the same.
        </p>

        <div className="mh-identity-grid">
          {MONKEY_IDENTITIES.map(identity => (
            <button
              type="button"
              key={identity.id}
              className={`mh-identity-card${selected === identity.id ? ' is-selected' : ''}`}
              onClick={() => setSelected(identity.id)}
              disabled={busy}
            >
              <span className="mh-identity-emoji" aria-hidden="true">{identity.emoji}</span>
              <strong>{identity.name}</strong>
              <small>{identity.note}</small>
              <span className="mh-identity-check">{selected === identity.id ? '✓ Selected' : 'Choose'}</span>
            </button>
          ))}
        </div>

        <div className="mh-identity-footer">
          <div>
            <strong>{selected ? MONKEY_IDENTITIES.find(item => item.id === selected)?.name : 'Pick one to continue'}</strong>
            <span>This becomes your student-facing name.</span>
          </div>
          <button type="button" className="mh-primary" disabled={!selected || busy} onClick={save}>
            {busy ? 'Saving…' : 'Use this monkey name'}
          </button>
        </div>
        {error && <div className="mh-birthday-error" role="alert">{error}</div>}
      </section>
    </div>
  );
}
