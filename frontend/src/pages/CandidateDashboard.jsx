import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Feed from './Feed.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/hooks.js';
import { CandidateProofVisual } from '../components/DomainVisuals.jsx';

export default function CandidateDashboard() {
  const { user } = useAuth();
  const { data, loading } = useAsync(() => api.me(), [user?.id]);

  useEffect(() => {
    document.title = 'ProveIt - Candidate opportunities';
  }, []);

  const stats = data?.stats || {};

  return (
    <div className="candidate-dash overflow-x-hidden" style={{ overflowX: 'hidden' }}>
      <style>{`
        .candidate-dash {
          display: flex;
          flex-direction: column;
          gap: clamp(40px, 6vw, 76px);
          font-family: Satoshi, "Avenir Next", system-ui, -apple-system, sans-serif;
        }
        .candidate-dash__hero {
          position: relative;
          overflow: hidden;
          padding: clamp(28px, 4.5vw, 52px);
          border: 1px solid rgba(105, 210, 192, 0.28);
          border-radius: var(--radius);
          background: radial-gradient(ellipse at 85% 15%, rgba(105, 210, 192, 0.16), transparent 52%),
                      radial-gradient(ellipse at 15% 85%, rgba(242, 184, 75, 0.12), transparent 48%),
                      linear-gradient(155deg, rgba(255, 255, 255, 0.035), transparent 56%),
                      var(--panel);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .candidate-dash__hero:hover {
          transform: translateY(-2px);
          box-shadow: 0 28px 74px rgba(0, 0, 0, 0.3);
        }
        .candidate-dash__hero-copy {
          max-width: 54rem;
        }
        .candidate-dash__title {
          font-size: clamp(2.3rem, 4.5vw, 3.8rem);
          line-height: 1.08;
          letter-spacing: -0.04em;
          margin-top: 14px;
          margin-bottom: 12px;
          color: var(--text);
          text-wrap: balance;
        }
        .candidate-dash__desc {
          color: #c9d6d8;
          font-size: clamp(1rem, 1.35vw, 1.18rem);
          line-height: 1.6;
          max-width: 48ch;
          margin-bottom: 24px;
        }
        .candidate-dash__stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
          gap: 16px;
          grid-auto-flow: dense;
          margin: 20px 0 24px;
        }
        .candidate-dash__stat-card {
          padding: 20px 22px;
          border-radius: 16px;
          background: var(--panel-2);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .candidate-dash__stat-card:hover {
          transform: translateY(-2px);
        }
        .candidate-dash__stat-card--teal {
          border: 1px solid rgba(105, 210, 192, 0.35);
          box-shadow: 0 0 24px rgba(105, 210, 192, 0.08);
          background: radial-gradient(circle at 100% 0%, rgba(105, 210, 192, 0.12), transparent 50%), var(--panel-2);
        }
        .candidate-dash__stat-card--teal:hover {
          border-color: var(--accent-2);
          box-shadow: 0 12px 34px rgba(105, 210, 192, 0.18);
        }
        .candidate-dash__stat-card--gold {
          border: 1px solid rgba(242, 184, 75, 0.35);
          box-shadow: 0 0 24px rgba(242, 184, 75, 0.08);
          background: radial-gradient(circle at 100% 0%, rgba(242, 184, 75, 0.12), transparent 50%), var(--panel-2);
        }
        .candidate-dash__stat-card--gold:hover {
          border-color: var(--accent);
          box-shadow: 0 12px 34px rgba(242, 184, 75, 0.18);
        }
        .candidate-dash__stat-card--green {
          border: 1px solid rgba(96, 212, 155, 0.35);
          box-shadow: 0 0 24px rgba(96, 212, 155, 0.08);
          background: radial-gradient(circle at 100% 0%, rgba(96, 212, 155, 0.12), transparent 50%), var(--panel-2);
        }
        .candidate-dash__stat-card--green:hover {
          border-color: var(--good);
          box-shadow: 0 12px 34px rgba(96, 212, 155, 0.18);
        }
        .candidate-dash__stat-val {
          font-size: clamp(1.8rem, 3.2vw, 2.5rem);
          font-weight: 850;
          letter-spacing: -0.04em;
          line-height: 1;
          color: var(--text);
          font-variant-numeric: tabular-nums;
        }
        .candidate-dash__stat-label {
          font-size: 0.88rem;
          font-weight: 650;
          color: var(--muted);
          margin-top: 6px;
        }
        .candidate-dash__stat-icon {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(13, 21, 28, 0.6);
        }
        .candidate-dash__stat-card--teal .candidate-dash__stat-icon {
          color: var(--accent-2);
          border-color: rgba(105, 210, 192, 0.3);
          background: rgba(105, 210, 192, 0.12);
        }
        .candidate-dash__stat-card--gold .candidate-dash__stat-icon {
          color: var(--accent);
          border-color: rgba(242, 184, 75, 0.3);
          background: rgba(242, 184, 75, 0.12);
        }
        .candidate-dash__stat-card--green .candidate-dash__stat-icon {
          color: var(--good);
          border-color: rgba(96, 212, 155, 0.3);
          background: rgba(96, 212, 155, 0.12);
        }
        .candidate-dash__links {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 24px;
        }
        .candidate-dash__link-btn {
          border-radius: 999px !important;
          padding: 10px 20px !important;
          font-size: 0.92rem !important;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .candidate-dash__link-btn:hover {
          transform: translateY(-2px);
          border-color: var(--accent-2) !important;
          box-shadow: 0 8px 24px rgba(105, 210, 192, 0.16);
          color: var(--text);
        }
        .candidate-dash__link-btn svg {
          transition: transform 0.2s ease;
        }
        .candidate-dash__link-btn:hover svg {
          transform: translateX(3px);
        }
        .candidate-dash__feed-wrap {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (prefers-reduced-motion: reduce) {
          .candidate-dash__hero, .candidate-dash__stat-card,
          .candidate-dash__link-btn, .candidate-dash__link-btn svg {
            transition: none !important;
            transform: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <section className="card candidate-hero candidate-dash__hero">
        <div className="candidate-hero__copy candidate-dash__hero-copy">
          <span className="pill info">Candidate workspace</span>
          <h1 className="candidate-dash__title">Welcome, {user?.name || 'candidate'}.</h1>
          <p className="candidate-dash__desc muted">
            Find practical opportunities, complete the work, and build proof you can share.
          </p>

          <div className="candidate-dash__stats grid three" aria-label="Candidate progress">
            <div className="card soft candidate-dash__stat-card candidate-dash__stat-card--teal">
              <div>
                <div className="candidate-dash__stat-val">{loading ? '—' : (stats.attempts ?? 0)}</div>
                <div className="candidate-dash__stat-label small">Attempts</div>
              </div>
              <div className="candidate-dash__stat-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="6"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
              </div>
            </div>

            <div className="card soft candidate-dash__stat-card candidate-dash__stat-card--gold">
              <div>
                <div className="candidate-dash__stat-val">{loading ? '—' : (stats.badges ?? 0)}</div>
                <div className="candidate-dash__stat-label small">Valid badges</div>
              </div>
              <div className="candidate-dash__stat-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
            </div>

            <div className="card soft candidate-dash__stat-card candidate-dash__stat-card--green">
              <div>
                <div className="candidate-dash__stat-val">{loading ? '—' : (stats.bestScore ?? '—')}</div>
                <div className="candidate-dash__stat-label small">Best score</div>
              </div>
              <div className="candidate-dash__stat-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="row candidate-dash__links">
            <Link className="btn ghost candidate-dash__link-btn" to="/profile">
              <span>View profile and results</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <Link className="btn ghost candidate-dash__link-btn" to="/leaderboard">
              <span>See verified leaderboard</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14"/>
                <path d="M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </div>

        <CandidateProofVisual />
      </section>

      <div className="candidate-dash__feed-wrap">
        <Feed />
      </div>
    </div>
  );
}
