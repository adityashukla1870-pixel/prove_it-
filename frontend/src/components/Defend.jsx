import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSpeech } from '../lib/hooks.js';
import { getCandidateToken } from '../lib/store.js';
import { BadgeIcon, ChallengeIcon, MicIcon, SparkIcon } from './DomainVisuals.jsx';

const gradingMessages = [
  'Reading your answer...',
  'Checking the evidence...',
  'Running consistency checks...',
  'Writing your breakdown...',
];
const meaningful = (answer) => {
  const text = String(answer || '').trim();
  return text.length >= 20 && new Set(text.toLowerCase().match(/[a-z0-9]+/g) || []).size >= 4;
};

export default function Defend({ submission, onDone }) {
  const questions = submission.questions || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => Array(questions.length).fill(''));
  const [pendingAnswers, setPendingAnswers] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [messageIndex, setMessageIndex] = useState(0);
  const [answerError, setAnswerError] = useState('');
  const speech = useSpeech();

  useEffect(() => {
    if (!submitting) return undefined;
    setMessageIndex(0);
    const timer = setInterval(() => setMessageIndex((current) => (current + 1) % gradingMessages.length), 3000);
    return () => clearInterval(timer);
  }, [submitting]);

  async function sendAnswers(allAnswers) {
    setPendingAnswers(allAnswers);
    setSubmitError('');
    setSubmitting(true);
    try {
      await api.defend(submission.id, allAnswers, getCandidateToken(submission.id));
      onDone();
    } catch (error) {
      setSubmitError(error.message || 'Could not submit your answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    speech.stop();
    const normalized = speech.text.trim();
    if (!meaningful(normalized)) {
      setAnswerError('Please give this question a specific answer of at least 20 characters.');
      return;
    }
    setAnswerError('');
    const nextAnswers = [...answers];
    nextAnswers[index] = normalized;
    setAnswers(nextAnswers);
    speech.setText('');
    if (index === questions.length - 1) sendAnswers(nextAnswers);
    else setIndex(index + 1);
  }

  if (submitting) return (
    <div className="defend-processing card center stack">
      <div className="defend-processing__icon"><BadgeIcon size={32} /></div>
      <span className="spinner" />
      <p><strong>{gradingMessages[messageIndex]}</strong></p>
      <p className="muted">We are turning your thinking into a clear proof profile. This takes up to 40 seconds.</p>
    </div>
  );

  if (submitError) return (
    <div className="defend-processing card stack">
      <div className="error" role="alert">{submitError}</div>
      <div><button className="btn primary" type="button" onClick={() => sendAnswers(pendingAnswers)}>Try again</button></div>
    </div>
  );

  const lastQuestion = index === questions.length - 1;
  const pendingQuestions = questions.map((_, questionIndex) => questionIndex).filter((questionIndex) => {
    const value = questionIndex === index ? speech.text : answers[questionIndex];
    return !meaningful(value);
  });
  const progress = ((index + 1) / Math.max(questions.length, 1)) * 100;

  return (
    <div className="defend-page stack">
      <section className="defend-hero card">
        <div className="defend-hero__copy">
          <span className="visual-kicker">Proof protocol · 02</span>
          <h1>Defend the thinking behind your work.</h1>
          <p className="muted">Answer each question in 30-60 seconds, in your own words. We score the reasoning, never your accent or voice.</p>
          <div className="defend-hero__signal"><span><i /><i /><i /></span><strong>Human-sounding evidence</strong><small>Clear beats polished.</small></div>
        </div>
        <div className="defend-hero__visual" aria-hidden="true">
          <div className="defend-hero__orbit defend-hero__orbit--outer" />
          <div className="defend-hero__orbit defend-hero__orbit--inner" />
          <div className="defend-hero__core"><SparkIcon size={30} /><strong>Think out loud</strong><small>your proof is forming</small></div>
          <div className="defend-hero__node defend-hero__node--left"><ChallengeIcon size={17} /></div>
          <div className="defend-hero__node defend-hero__node--right"><BadgeIcon size={17} /></div>
        </div>
      </section>

      <div className="defend-progress card">
        <div className="row between"><span className="defend-progress__label"><span className="defend-progress__icon"><MicIcon size={16} /></span> Live defense</span><span className="muted small">Question {index + 1} of {questions.length}</span></div>
        <div className="defend-progress__track"><i style={{ width: `${progress}%` }} /></div>
        <div className="defend-progress__steps" aria-label={`Question ${index + 1} of ${questions.length}`}>
          {questions.map((_, questionIndex) => <span key={questionIndex} className={questionIndex < index ? 'done' : questionIndex === index ? 'current' : ''}>{questionIndex < index ? '✓' : questionIndex + 1}</span>)}
        </div>
        <p className="muted small">{pendingQuestions.length ? `Still needs an answer: ${pendingQuestions.map((questionIndex) => `Question ${questionIndex + 1}`).join(', ')}` : 'Every question has an answer.'}</p>
      </div>

      <div className="defend-question card">
        <span className="visual-kicker">The question</span>
        <h2>{questions[index]}</h2>
        <div className="defend-question__hint"><SparkIcon size={16} /> Make your assumptions, checks, and trade-offs visible.</div>
      </div>

      <div className="defend-answer card stack">
        {speech.supported ? (
          <div className="defend-voice center">
            <button className={`btn defend-mic ${speech.listening ? 'on' : ''}`} type="button" aria-label={speech.listening ? 'Stop listening' : 'Start speaking'} onClick={() => speech.listening ? speech.stop() : speech.start()}><MicIcon size={29} /></button>
            <p className="defend-voice__status">{speech.listening ? 'Listening... tap to stop' : 'Tap and speak'}</p>
            <p className="muted small">Speak naturally. You can edit the transcript below.</p>
          </div>
        ) : (
          <div className="notice">Voice is not supported in this browser. Type your answer below (Chrome works best for voice).</div>
        )}
        <label htmlFor="defend-answer">Your answer <span className="muted small">(edit what was heard)</span></label>
        <textarea id="defend-answer" value={speech.text} onChange={(event) => speech.setText(event.target.value)} />
        {answerError && <div className="error" role="alert">{answerError}</div>}
        <div className="defend-answer__footer"><p className="muted small">Each question needs a specific answer before you can continue.</p><span className={`pill ${meaningful(speech.text) ? 'good' : 'info'}`}>{meaningful(speech.text) ? 'Ready to continue' : '20+ characters'}</span></div>
        {speech.error && <p className="muted small">{speech.error}</p>}
        <div className="row">
          <button className="btn primary" type="button" onClick={next}>{lastQuestion ? 'Submit my answers' : 'Next question'} <span aria-hidden="true">→</span></button>
        </div>
      </div>
    </div>
  );
}
