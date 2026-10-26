import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getCandidateToken, getSession, saveSession } from '../lib/store.js';
import { useCountdown } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import Defend from '../components/Defend.jsx';

export default function Solve() {
  useEffect(() => {
    document.title = 'ProveIt - Solve a challenge';
  }, []);
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [retry, setRetry] = useState(() => new URLSearchParams(window.location.search).get('retry') === '1');
  const [step, setStep] = useState('loading');
  const [challenge, setChallenge] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [resumeUnavailable, setResumeUnavailable] = useState(false);
  const [duplicateAttempt, setDuplicateAttempt] = useState(false);
  const [sending, setSending] = useState(false);
  const { label, ms, expired } = useCountdown(submission?.deadline);

  useEffect(() => {
    let active = true;
    async function load() {
      setStep('loading');
      setError('');
      setDuplicateAttempt(false);
      setResumeUnavailable(false);
      setChallenge(null);
      setSubmission(null);
      try {
        const item = await api.getChallenge(id);
        if (!active) return;
        setChallenge(item);
        let session = !retry && getSession(id);
        if (!session && !retry && user) {
          try {
            const account = await api.me();
            const attempt = (account.attempts || []).find((entry) => entry.challengeId === id);
            if (attempt) {
              session = { sid: attempt.submissionId, name: user.name, email: user.email };
              saveSession(id, session);
            }
          } catch { /* A new attempt can still be started if account history is unavailable. */ }
          if (!active) return;
        }
        if (!session) {
          setStep('intro');
          return;
        }
        setName(session.name || '');
        setEmail(session.email || '');
        try {
          const token = session.candidateToken || getCandidateToken(session.sid);
          const savedSubmission = await api.getSubmission(session.sid, token);
          if (!active) return;
          setSubmission(savedSubmission);
          if (savedSubmission.status === 'started') setStep('answer');
          else if (savedSubmission.status === 'answered') setStep('defend');
          else if (savedSubmission.status === 'graded') navigate(`/result/${session.sid}`, { replace: true });
          else if (savedSubmission.status === 'expired') setStep('expired');
          else setStep('intro');
        } catch (resumeError) {
          if (!active) return;
          setError('');
          setResumeUnavailable(true);
          setStep('intro');
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || 'The challenge could not be loaded.');
        setStep('error');
      }
    }
    load();
    return () => { active = false; };
  }, [id, navigate, retry, user?.id]);

  async function start(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const startBody = user ? { retry: retry || resumeUnavailable } : { name, email, retry: retry || resumeUnavailable };
      const started = await api.start(id, startBody);
      const candidateName = user?.name || name;
      const candidateEmail = user?.email || email;
      saveSession(id, { sid: started.id, name: candidateName, email: candidateEmail, candidateToken: started.candidateToken });
      setSubmission(started);
      setDuplicateAttempt(false);
      setAnswer('');
      setStep('answer');
      if (retry || resumeUnavailable) { setResumeUnavailable(false); navigate(`/c/${id}`, { replace: true }); }
    } catch (startError) {
      setError(startError.message || 'Could not start this challenge.');
      setDuplicateAttempt(startError.status === 409);
    } finally {
      setSending(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const answered = await api.submitAnswer(submission.id, answer, getCandidateToken(submission.id));
      setSubmission(answered);
      setStep('defend');
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your answer.');
      if (submitError.expired) setStep('expired');
    } finally {
      setSending(false);
    }
  }

  if (step === 'loading') return <div className="card center"><span className="spinner" /></div>;
  if (step === 'error') return <div className="card"><div className="error" role="alert"><p>{error}</p><p>This challenge is not available.</p></div></div>;
  if (step === 'defend') return <Defend submission={submission} onDone={() => navigate(`/result/${submission.id}`)} />;
  if (step === 'expired' || (step === 'answer' && expired)) return (
    <div className="card stack">
      <div className="notice">Your timed attempt has expired. Answers submitted after the server deadline cannot be accepted.</div>
      <p className="muted">You can start a new attempt. Your previous attempt will remain separate.</p>
      <div><button className="btn primary" type="button" disabled={sending} onClick={() => { saveSession(id, null); setRetry(true); setStep('intro'); setError(''); }}>Start a new attempt</button></div>
    </div>
  );

  if (step === 'intro') return (
    <div className="stack">
      <div>
        <h1>{challenge.title}</h1>
        <div className="row">
          <span className="pill info">{challenge.skill}</span>
          <span className="pill info">{challenge.level}</span>
          <span className="pill warn">{challenge.timeLimitMin} minutes</span>
        </div>
      </div>
      <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{challenge.task}</div>
      <div className="card stack">
        <h2>How you are scored</h2>
        {(challenge.rubric || []).map((item, index) => <div key={`${item.name}-${index}`}><strong>{item.name}</strong><div className="muted">{item.description}</div></div>)}
      </div>
      <div className="notice">You will answer a timed task, then defend your answer out loud. Longer answers do not earn more points.</div>
      <form className="card stack" onSubmit={start}>
        <h2>Start this challenge</h2>
        {user ? <div className="card soft small">Signed in as {user.name} ({user.email})</div> : <>
          <div><label htmlFor="candidate-name">Your name</label><input id="candidate-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
          <div><label htmlFor="candidate-email">Email</label><input id="candidate-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
        </>}
        {resumeUnavailable && <div className="notice">This browser can no longer resume the saved session. Starting again will create a separate attempt; earlier answers stay private.</div>}
        {error && <div className="error" role="alert">{error}</div>}
        {duplicateAttempt && <button className="btn ghost" type="button" disabled={sending} onClick={() => { setRetry(true); setDuplicateAttempt(false); setError(''); }}>Start a separate retry</button>}
        {!user && <div className="notice">Log in to keep all your badges on one profile and appear on the leaderboard. <Link to={`/login?next=/c/${id}`}>Log in</Link></div>}
        <div className="row">
          <button className="btn primary" type="submit" disabled={sending}>{sending ? <><span className="spinner" /> Starting...</> : resumeUnavailable ? 'Start a new attempt' : 'Start the timer'}</button>
        </div>
      </form>
    </div>
  );

  if (step === 'answer') return (
    <div className="stack">
      <div className="row between card">
        <h2>{challenge.title}</h2>
        <div className={`timer ${ms < 300000 ? 'low' : ''}`}>{label}</div>
      </div>
      <details className="card" open>
        <summary>Task</summary>
        <div style={{ whiteSpace: 'pre-wrap' }}>{challenge.task}</div>
      </details>
      <form className="card stack" onSubmit={submit}>
        <label htmlFor="candidate-answer">Your answer</label>
        <textarea id="candidate-answer" className="code" value={answer} onChange={(event) => setAnswer(event.target.value)} minLength={20} required />
        <p className="muted small">Longer answers do not earn more points.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="row">
          <button className="btn primary" type="submit" disabled={sending || answer.trim().length < 20}>{sending ? <><span className="spinner" /> AI is reading your answer and preparing your questions (5-15 seconds)...</> : 'Submit and continue to defend'}</button>
        </div>
      </form>
    </div>
  );

  return null;
}
