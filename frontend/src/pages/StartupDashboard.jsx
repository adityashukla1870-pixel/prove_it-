import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/hooks.js';
import { StartupTalentVisual } from '../components/DomainVisuals.jsx';

function statusLabel(status) {
  return status === 'live' ? 'Published' : 'Draft';
}

export default function StartupDashboard() {
  const { user } = useAuth();
  const { data: challenges, loading, error, reload } = useAsync(() => api.myChallenges(), [user?.id]);

  useEffect(() => {
    document.title = 'ProveIt - Startup dashboard';
  }, []);

  const totalChallenges = challenges?.length || 0;
  const liveChallenges = challenges?.filter((c) => c.status === 'live').length || 0;
  const totalSubmissions = challenges?.reduce((sum, c) => sum + (Number(c.submissionCount) || 0), 0) || 0;

  return (
    <div className="startup-dash overflow-x-hidden" style={{ overflowX: 'hidden' }}>
      <style>{`
        .startup-dash {
          display: flex;
          flex-direction: column;
          gap: clamp(32px, 4.5vw, 56px);
          font-family: Satoshi, "Avenir Next", system-ui, -apple-system, sans-serif;
        }
        .startup-dash__hero {
          position: relative;
          overflow: hidden;
          padding: clamp(28px, 4.5vw, 52px);
          border: 1px solid rgba(242, 184, 75, 0.28);
          border-radius: var(--radius);
          background: radial-gradient(ellipse at 85% 15%, rgba(242, 184, 75, 0.16), transparent 52%),
                      radial-gradient(ellipse at 15% 85%, rgba(105, 210, 192, 0.12), transparent 48%),
                      linear-gradient(155deg, rgba(255, 255, 255, 0.035), transparent 56%),
                      var(--panel);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .startup-dash__hero:hover {
          transform: translateY(-2px);
          box-shadow: 0 28px 74px rgba(0, 0, 0, 0.3);
        }
        .startup-dash__hero-copy {
          max-width: 54rem;
        }
        .startup-dash__title {
          font-size: clamp(2.3rem, 4.5vw, 3.8rem);
          line-height: 1.08;
          letter-spacing: -0.04em;
          margin-top: 14px;
          margin-bottom: 12px;
          color: var(--text);
          text-wrap: balance;
        }
        .startup-dash__desc {
          color: #c9d6d8;
          font-size: clamp(1rem, 1.35vw, 1.18rem);
          line-height: 1.6;
          max-width: 48ch;
          margin-bottom: 24px;
        }
        .startup-dash__stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
          gap: 18px;
          grid-auto-flow: dense;
        }
        .startup-dash__stat-card {
          padding: 22px 24px;
          border-radius: var(--radius);
          background: var(--panel);
          border: 1px solid rgba(168, 182, 186, 0.18);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .startup-dash__stat-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent-2);
          box-shadow: 0 14px 36px rgba(0, 0, 0, 0.25);
        }
        .startup-dash__stat-val {
          font-size: clamp(1.9rem, 3.2vw, 2.6rem);
          font-weight: 850;
          letter-spacing: -0.04em;
          line-height: 1;
          color: var(--text);
          font-variant-numeric: tabular-nums;
        }
        .startup-dash__stat-label {
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--text);
          margin-top: 6px;
        }
        .startup-dash__stat-icon {
          width: 48px;
          height: 48px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(242, 184, 75, 0.25);
          background: rgba(242, 184, 75, 0.1);
          color: var(--accent);
        }
        .startup-dash__challenges {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .startup-dash__challenge-card {
          padding: clamp(20px, 2.5vw, 28px);
          border-radius: var(--radius);
          background: var(--panel-2);
          border: 1px solid rgba(168, 182, 186, 0.18);
          border-left: 5px solid var(--line);
          transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
        }
        .startup-dash__challenge-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 38px rgba(0, 0, 0, 0.26);
        }
        .startup-dash__challenge-card--live {
          border-left: 5px solid var(--accent);
          background: radial-gradient(circle at 100% 50%, rgba(242, 184, 75, 0.05), transparent 45%), var(--panel-2);
        }
        .startup-dash__challenge-card--live:hover {
          border-color: rgba(242, 184, 75, 0.45);
          border-left-color: var(--accent);
        }
        .startup-dash__challenge-card--draft {
          border-left: 5px solid var(--line);
        }
        .startup-dash__challenge-card--draft:hover {
          border-color: var(--accent-2);
          border-left-color: var(--muted);
        }
        .startup-dash__empty {
          padding: clamp(48px, 7vw, 84px) 24px;
          text-align: center;
          border: 1px dashed rgba(168, 182, 186, 0.3);
          border-radius: var(--radius);
          background: rgba(18, 28, 37, 0.4);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          transition: transform 0.25s ease, border-color 0.25s ease;
        }
        .startup-dash__empty:hover {
          transform: translateY(-2px);
          border-color: var(--accent-2);
        }
        .startup-dash__empty-icon {
          width: 72px;
          height: 72px;
          display: grid;
          place-items: center;
          border-radius: 20px;
          border: 1px solid rgba(105, 210, 192, 0.35);
          background: rgba(105, 210, 192, 0.1);
          color: var(--accent-2);
          margin-bottom: 8px;
        }
        @media (prefers-reduced-motion: reduce) {
          .startup-dash__hero, .startup-dash__stat-card,
          .startup-dash__challenge-card, .startup-dash__empty {
            transition: none !important;
            transform: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <section className="card startup-hero startup-dash__hero">
        <div className="startup-hero__copy startup-dash__hero-copy">
          <span className="pill warn">Startup workspace</span>
          <h1 className="startup-dash__title">Welcome, {user?.name || 'startup'}.</h1>
          <p className="startup-dash__desc muted">
            Turn real work into a fair signal. Create a challenge, publish it, and review the candidates who complete it.
          </p>
          <div className="row">
            <Link className="btn primary" to="/post">Post a challenge</Link>
          </div>
        </div>
        <StartupTalentVisual />
      </section>

      {!loading && !error && Boolean(challenges) && (
        <section className="startup-dash__stats" aria-label="Startup metrics">
          <div className="card startup-dash__stat-card">
            <div>
              <div className="startup-dash__stat-val">{totalChallenges}</div>
              <div className="startup-dash__stat-label">Total challenges</div>
            </div>
            <div className="startup-dash__stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
          </div>

          <div className="card startup-dash__stat-card">
            <div>
              <div className="startup-dash__stat-val" style={{ color: 'var(--accent)' }}>{liveChallenges}</div>
              <div className="startup-dash__stat-label">Active published</div>
            </div>
            <div
              className="startup-dash__stat-icon"
              style={{
                borderColor: 'rgba(242, 184, 75, 0.4)',
                background: 'rgba(242, 184, 75, 0.15)',
                color: 'var(--accent)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 14 14"/>
              </svg>
            </div>
          </div>

          <div className="card startup-dash__stat-card">
            <div>
              <div className="startup-dash__stat-val" style={{ color: 'var(--accent-2)' }}>{totalSubmissions}</div>
              <div className="startup-dash__stat-label">Total submissions</div>
            </div>
            <div
              className="startup-dash__stat-icon"
              style={{
                borderColor: 'rgba(105, 210, 192, 0.4)',
                background: 'rgba(105, 210, 192, 0.15)',
                color: 'var(--accent-2)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
          </div>
        </section>
      )}

      <section className="card stack">
        <div className="row between">
          <div>
            <h2>Your challenges</h2>
            <p className="muted small">Only challenges created by this startup account appear here.</p>
          </div>
          <Link className="btn ghost" to="/post">New challenge</Link>
        </div>

        {loading && (
          <div className="center" style={{ padding: '36px 0' }}>
            <span className="spinner" /> Loading your challenges…
          </div>
        )}

        {error && (
          <div className="error" role="alert">
            {error}
            <button className="btn small ghost" type="button" onClick={reload} style={{ marginLeft: 10 }}>Try again</button>
          </div>
        )}

        {!loading && !error && !challenges?.length && (
          <div className="card soft startup-dash__empty">
            <div className="startup-dash__empty-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <h3 style={{ margin: 0 }}>No challenges created yet</h3>
            <p className="muted" style={{ maxWidth: 420 }}>Your first challenge will appear here after the generation step.</p>
            <Link className="btn primary" to="/post" style={{ marginTop: 8 }}>Create your first challenge</Link>
          </div>
        )}

        {!loading && !error && challenges?.length > 0 && (
          <div className="stack startup-dash__challenges">
            {challenges.map((challenge) => (
              <article
                className={`card soft row between startup-dash__challenge-card ${
                  challenge.status === 'live' ? 'startup-dash__challenge-card--live' : 'startup-dash__challenge-card--draft'
                }`}
                key={challenge.id}
              >
                <div>
                  <div className="row">
                    <span className={`pill ${challenge.status === 'live' ? 'good' : 'warn'}`}>
                      {statusLabel(challenge.status)}
                    </span>
                    <span className="muted small">{challenge.submissionCount || 0} submissions</span>
                  </div>
                  <h3 style={{ marginTop: 8 }}>{challenge.title || 'Untitled challenge'}</h3>
                  <p className="muted small">
                    {challenge.skill || 'Skill challenge'} · {challenge.timeLimitMin || 30} minutes
                  </p>
                </div>
                {challenge.status === 'live' ? (
                  <Link className="btn ghost" to={`/dashboard/${challenge.id}`}>Review submissions</Link>
                ) : (
                  <Link className="btn ghost" to={`/review/${challenge.id}`}>Finish draft</Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
