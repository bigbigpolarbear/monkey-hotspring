import React, { useEffect, useState } from 'react';

export default function DailyReturnSummary({ studentId, amount, days, burstKey }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!amount) return;
    const key = `mh-return-summary:${studentId}:${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;
    setVisible(true);
    sessionStorage.setItem(key, 'shown');
  }, [studentId, amount]);
  useEffect(() => { if (burstKey) setVisible(true); }, [burstKey]);
  if (!visible) return null;
  return (
    <div className="mh-return-summary" role="status">
      <button className="mh-summary-close" onClick={() => setVisible(false)} aria-label="Dismiss welcome summary">✕</button>
      <div className="mh-kicker">Welcome back!</div>
      {amount > 0 && <div className="mh-summary-amount">{days > 1 ? `Your pets saved ${amount} ★ over ${days} days.` : `${amount} ★ is waiting from your pets.`}</div>}
    </div>
  );
}
