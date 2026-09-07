import React, { useEffect } from 'react';

export default function MonkeySitters({ onClose }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="mh-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="mh-sitters-modal" role="dialog" aria-modal="true" aria-label="Monkey Sitters coming soon">
        <div className="mh-modal-head">
          <div>
            <div className="mh-kicker">Coming soon</div>
            <h2>🐒 Monkey Sitters</h2>
            <p>We are getting the babysitting feature ready for the Hot Spring.</p>
          </div>
          <button className="mh-icon-button" onClick={onClose} aria-label="Close Monkey Sitters">✕</button>
        </div>

        <div className="mh-profile-editor" style={{ marginTop: 18 }}>
          <div className="mh-monkey-profile">
            <div className="mh-big-monkey" aria-hidden="true">🐒</div>
            <div>
              <strong>Babysitters are coming soon!</strong>
              <span>For now, keep enjoying your pets, daily Stars and challenges as normal.</span>
              <small>No sitter profiles, jobs or payments are active yet.</small>
            </div>
          </div>

          <div className="mh-notice" role="status">
            Your normal student account and pet progress are unaffected. We will unlock Monkey Sitters when it is fully ready.
          </div>

          <button className="mh-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
