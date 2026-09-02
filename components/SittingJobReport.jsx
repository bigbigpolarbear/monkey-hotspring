import React from 'react';

export default function SittingJobReport({ report }) {
  if (!report) return null;
  return (
    <div className="mh-sitter-report">
      <strong>🐒 {report.sitterMonkeyName || 'A Monkey Sitter'} visited!</strong>
      <div>🍌 Fed a pet · 🫧 tidied the spring</div>
      <div>❤️ +{report.happinessGain || 10} Happiness · +{report.hungerGain || 12} Hunger</div>
      <em>“Everyone behaved... mostly.”</em>
    </div>
  );
}
