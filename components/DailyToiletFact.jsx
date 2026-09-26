import React, { useMemo, useState } from 'react';
import { localDayKey } from '../game/petEconomy.js';
import { REWARD_CONFIG } from '../game/rewardConfig.js';
import { getDailyToiletFact } from '../game/toiletFacts.js';
import { answerDailyToiletFact } from '../services/rewardService.js';

export default function DailyToiletFact({ student, onDone, onReward, notify }) {
  const dateKey = localDayKey();
  const fact = useMemo(() => getDailyToiletFact(dateKey), [dateKey]);
  const [stage, setStage] = useState('fact');
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function answer(index) {
    if (busy || result) return;
    setSelected(index);
    setBusy(true);
    try {
      const response = await answerDailyToiletFact(student.id, index, { dateKey });
      setResult(response);
      if (response.amount > 0) {
        onReward(response.amount);
        notify(`Correct! +${response.amount} ⭐`);
      } else if (response.alreadyAnswered) {
        notify('Today’s Toilet Fact was already answered.');
      } else {
        notify('Good try — come back tomorrow for a new fact!');
      }
    } catch (error) {
      setSelected(null);
      notify(error.message || 'Could not save your answer');
    } finally {
      setBusy(false);
    }
  }

  const correct = result?.correct === true;

  return (
    <div className="mh-hub-backdrop mh-hub-backdrop-modal mh-toilet-backdrop">
      <section className="mh-hub-panel mh-hub-panel-modal mh-toilet-panel" role="dialog" aria-modal="true" aria-label="Daily Toilet Fact">
        <header className="mh-hub-panel-head mh-toilet-head">
          <div>
            <div className="mh-kicker">{stage === 'fact' ? 'Your daily bathroom brain break' : result ? 'Answer saved' : 'One quick question'}</div>
            <h2>🚽 Toilet Fact of the Day</h2>
          </div>
          <span className="mh-toilet-reward">+{REWARD_CONFIG.toiletFact} ⭐</span>
        </header>

        {stage === 'fact' && (
          <div className="mh-toilet-fact">
            <span className="mh-toilet-category">{fact.category}</span>
            <p>{fact.fact}</p>
            <div className="mh-toilet-read-note">Read it carefully — your one-question quiz comes next.</div>
            <button className="mh-primary mh-toilet-continue" onClick={() => setStage('question')}>I read it — quiz me →</button>
          </div>
        )}

        {stage === 'question' && !result && (
          <div className="mh-toilet-question">
            <div className="mh-toilet-mini">First answer counts · get it right for +{REWARD_CONFIG.toiletFact} ⭐</div>
            <h3 className="mh-question">{fact.question}</h3>
            <div className="mh-answer-grid">
              {fact.options.map((option, index) => (
                <button
                  key={option}
                  className={`mh-answer${selected === index ? ' is-selected' : ''}`}
                  disabled={busy || selected != null}
                  onClick={() => answer(index)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="mh-toilet-result">
            <div className={`mh-toilet-result-icon ${correct ? 'is-correct' : 'is-wrong'}`}>{correct ? '🎉' : '🧠'}</div>
            <h3>{correct ? `Correct! +${result.amount || REWARD_CONFIG.toiletFact} ⭐` : 'Not quite — but now you know!'}</h3>
            <p>{fact.explanation}</p>
            <div className={`mh-feedback ${correct ? 'is-correct' : 'is-wrong'}`}>
              <strong>{correct ? 'Your Star was added to your account.' : `Correct answer: ${fact.options[fact.correctIndex]}`}</strong>
              <span>{correct ? 'This reward can only be earned once today.' : 'No Star this time. A brand-new fact will appear tomorrow.'}</span>
            </div>
            <button className="mh-primary" onClick={onDone}>Done</button>
          </div>
        )}
      </section>
    </div>
  );
}
