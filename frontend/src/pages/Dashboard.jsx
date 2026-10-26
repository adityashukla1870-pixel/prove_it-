import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getOwnerKey } from '../lib/store.js';
import { useAsync } from '../lib/hooks.js';
import CandidatePanel from '../components/CandidatePanel.jsx';

function authenticityTone(label) {
  if (!label) return '';
  if (label.startsWith('High')) return 'good';
  if (label.startsWith('Medium')) return 'warn';
  if (label.startsWith('Low')) return 'bad';
  return 'info';
}

export default function Dashboard() {
  useEffect(() => {
    document.title = 'ProveIt - Dashboard';
  }, []);

  const { id } = useParams();
  const key = getOwnerKey(id);
  const { data: challenge, loading: challengeLoading, error: challengeError } = useAsync(
    () => api.getChallengeOwner(id, key),
    [id],
  );

  const [rows, setRows] = useState([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);
  const [rowsError, setRowsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyRow, setBusyRow] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  const shareLink = `${window.location.origin}/c/${id}`;

  const reloadRows = useCallback(async () => {
    try {
      const result = await api.leaderboard(id, key);
      setRows(result);
      setRowsError('');
    } catch (err) {
      setRowsError(err.message || 'Could not load the leaderboard.');
    } finally {
      setRowsLoaded(true);
    }
  }, [id, key]);

  useEffect(() => {
    reloadRows();
    const timer = setInterval(reloadRows, 8000);
    return () => clearInterval(timer);
  }, [reloadRows]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  async function toggleShortlist(event, row) {
    event.stopPropagation();
    setBusyRow(row.id);
    setActionError('');
    try {
      await api.shortlist(row.id, key);
      await reloadRows();
    } catch (err) {
      setActionError(err.message || 'Could not update the shortlist.');
    } finally {
      setBusyRow('');
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setActionError(err.message || 'Could not copy the candidate link.');
    }
  }

  if (challengeLoading || !rowsLoaded) {
    return (
      <div className="card center dash__loading" style={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (challengeError) {
    return (
      <div className="card dash__error-card">
        <div className="error" role="alert">{challengeError}</div>
      </div>
    );
  }

  if (!challenge) return null;

  const founderMode = challenge.mode === 'idea';
  const shortlisted = rows.filter((row) => row.shortlisted);
  const mentor = rows.find((row) => row.mentor);

  const totalCandidates = rows.length;
  const shortlistedCount = shortlisted.length;
  const avgScore = totalCandidates > 0
    ? Math.round(rows.reduce((sum, r) => sum + (Number(r.total) || 0), 0) / totalCandidates)
    : '—';

  return (
    <div className="dash-container overflow-x-hidden" style={{ overflowX: 'hidden' }}>
      <style>{`
        .dash-container {
          display: flex;
          flex-direction: column;
          gap: clamp(32px, 4.5vw, 56px);
          font-family: Satoshi, "Avenir Next", system-ui, -apple-system, sans-serif;
        }
        .dash__header {
          position: relative;
          overflow: hidden;
          padding: clamp(28px, 4vw, 44px);
          border: 1px solid rgba(168, 182, 186, 0.22);
          border-radius: var(--radius);
          background: radial-gradient(ellipse at 88% 12%, rgba(105, 210, 192, 0.16), transparent 50%),
                      radial-gradient(ellipse at 12% 88%, rgba(242, 184, 75, 0.12), transparent 48%),
                      linear-gradient(150deg, rgba(255, 255, 255, 0.035), transparent 60%),
                      var(--panel);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .dash__header:hover {
          transform: translateY(-2px);
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.28);
        }
        .dash__header-glow {
          position: absolute;
          top: -60px;
          right: -40px;
          width: 240px;
          height: 240px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(105, 210, 192, 0.22) 0%, rgba(242, 184, 75, 0.08) 50%, transparent 70%);
          filter: blur(28px);
          pointer-events: none;
        }
        .dash__header-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 56rem;
        }
        .dash__title {
          font-size: clamp(2rem, 3.8vw, 3rem);
          line-height: 1.14;
          letter-spacing: -0.03em;
          margin: 0;
          color: var(--text);
          text-wrap: balance;
        }
        .dash__header-badges {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dash__share-card {
          margin-top: 24px;
          padding: clamp(16px, 2.5vw, 22px);
          border: 1px solid rgba(105, 210, 192, 0.24);
          border-radius: 14px;
          background: rgba(18, 28, 37, 0.72);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .dash__share-card:hover {
          transform: translateY(-1px);
          border-color: rgba(105, 210, 192, 0.45);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }
        .dash__share-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.84rem;
          font-weight: 700;
          color: var(--accent-2);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .dash__share-input-row {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .dash__share-input {
          flex: 1;
          min-width: 240px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.9rem;
          background: #080d12;
          color: var(--text);
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 11px 14px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .dash__share-input:focus {
          border-color: var(--accent-2);
          box-shadow: 0 0 0 3px rgba(105, 210, 192, 0.16);
          outline: none;
        }
        .dash__copy-btn {
          min-width: 128px;
          font-weight: 700;
          border-radius: 10px;
          transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .dash__copy-btn:hover {
          transform: translateY(-2px);
          border-color: var(--accent-2);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }
        .dash__copy-btn--copied {
          border-color: var(--good) !important;
          background: rgba(96, 212, 155, 0.14) !important;
          color: var(--good) !important;
        }
        .dash__stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
          gap: 18px;
          grid-auto-flow: dense;
        }
        .dash__stat-card {
          position: relative;
          overflow: hidden;
          padding: 24px;
          border-radius: var(--radius);
          background: var(--panel);
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .dash__stat-card:hover {
          transform: translateY(-2px);
        }
        .dash__stat-card--teal {
          border: 1px solid rgba(105, 210, 192, 0.28);
          background: radial-gradient(circle at 100% 0%, rgba(105, 210, 192, 0.12), transparent 50%), var(--panel);
        }
        .dash__stat-card--teal:hover {
          border-color: var(--accent-2);
          box-shadow: 0 14px 36px rgba(105, 210, 192, 0.14);
        }
        .dash__stat-card--gold {
          border: 1px solid rgba(242, 184, 75, 0.28);
          background: radial-gradient(circle at 100% 0%, rgba(242, 184, 75, 0.12), transparent 50%), var(--panel);
        }
        .dash__stat-card--gold:hover {
          border-color: var(--accent);
          box-shadow: 0 14px 36px rgba(242, 184, 75, 0.14);
        }
        .dash__stat-card--green {
          border: 1px solid rgba(96, 212, 155, 0.28);
          background: radial-gradient(circle at 100% 0%, rgba(96, 212, 155, 0.12), transparent 50%), var(--panel);
        }
        .dash__stat-card--green:hover {
          border-color: var(--good);
          box-shadow: 0 14px 36px rgba(96, 212, 155, 0.14);
        }
        .dash__stat-val {
          font-size: clamp(2rem, 3.5vw, 2.75rem);
          font-weight: 850;
          letter-spacing: -0.04em;
          line-height: 1;
          color: var(--text);
          font-variant-numeric: tabular-nums;
        }
        .dash__stat-label {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
          margin-top: 6px;
        }
        .dash__stat-sub {
          font-size: 0.78rem;
          color: var(--muted);
          margin-top: 2px;
        }
        .dash__stat-icon {
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: var(--panel-2);
        }
        .dash__stat-card--teal .dash__stat-icon {
          color: var(--accent-2);
          border-color: rgba(105, 210, 192, 0.3);
          background: rgba(105, 210, 192, 0.1);
        }
        .dash__stat-card--gold .dash__stat-icon {
          color: var(--accent);
          border-color: rgba(242, 184, 75, 0.3);
          background: rgba(242, 184, 75, 0.1);
        }
        .dash__stat-card--green .dash__stat-icon {
          color: var(--good);
          border-color: rgba(96, 212, 155, 0.3);
          background: rgba(96, 212, 155, 0.1);
        }
        .dash__leaderboard-section {
          border: 1px solid rgba(168, 182, 186, 0.18);
          border-radius: var(--radius);
          background: var(--panel);
          padding: clamp(20px, 3vw, 32px);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.16);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .dash__leaderboard-section:hover {
          transform: translateY(-2px);
          box-shadow: 0 22px 54px rgba(0, 0, 0, 0.22);
        }
        .dash__table-wrap {
          overflow-x: auto;
          margin-top: 16px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: #0d151c;
        }
        .dash__table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .dash__table th {
          padding: 14px 14px;
          border-bottom: 1px solid var(--line);
          color: var(--muted);
          font-size: 0.74rem;
          font-weight: 780;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(27, 42, 52, 0.5);
        }
        .dash__table td {
          padding: 14px 14px;
          border-bottom: 1px solid rgba(48, 66, 75, 0.6);
          font-size: 0.92rem;
          vertical-align: middle;
        }
        .dash__table-row {
          cursor: pointer;
          transition: background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
        }
        .dash__table-row:nth-child(even) {
          background: rgba(255, 255, 255, 0.015);
        }
        .dash__table-row:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
          background: rgba(105, 210, 192, 0.05);
        }
        .dash__table-row--selected {
          background: var(--panel-2) !important;
          box-shadow: inset 3px 0 0 var(--accent-2);
        }
        .dash__shortlist-btn {
          width: 36px;
          height: 36px;
          padding: 0;
          display: inline-grid;
          place-items: center;
          border-radius: 9px;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .dash__shortlist-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }
        .dash__shortlist-btn--starred {
          border-color: var(--accent) !important;
          background: rgba(242, 184, 75, 0.16) !important;
          color: var(--accent) !important;
          animation: starPulse 2.4s infinite;
        }
        @keyframes starPulse {
          0% { box-shadow: 0 0 0 0 rgba(242, 184, 75, 0.45); }
          60% { box-shadow: 0 0 0 7px rgba(242, 184, 75, 0); }
          100% { box-shadow: 0 0 0 0 rgba(242, 184, 75, 0); }
        }
        .dash__badge-link {
          color: var(--accent-2);
          font-weight: 700;
          font-size: 0.88rem;
          padding: 4px 10px;
          border: 1px solid rgba(105, 210, 192, 0.3);
          border-radius: 8px;
          background: rgba(105, 210, 192, 0.08);
          transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
        }
        .dash__badge-link:hover {
          border-color: var(--accent-2);
          background: rgba(105, 210, 192, 0.18);
          color: var(--text);
        }
        .dash__team-section {
          padding: clamp(24px, 3.5vw, 36px);
          border: 1px solid rgba(105, 210, 192, 0.25);
          border-radius: var(--radius);
          background: radial-gradient(ellipse at 80% 50%, rgba(105, 210, 192, 0.08), transparent 60%),
                      radial-gradient(ellipse at 20% 80%, rgba(242, 184, 75, 0.08), transparent 50%),
                      var(--panel);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .dash__team-section:hover {
          transform: translateY(-2px);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.24);
        }
        .dash__team-banner {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 0.86rem;
          letter-spacing: 0.04em;
          border: 1px solid rgba(105, 210, 192, 0.2);
          color: var(--accent-2);
          margin-bottom: 16px;
        }
        .dash__team-avatars {
          display: flex;
          align-items: center;
          padding-left: 6px;
        }
        .dash__team-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid var(--panel);
          background: linear-gradient(135deg, var(--accent-2), var(--accent));
          color: #0b1118;
          font-weight: 800;
          font-size: 0.78rem;
          display: grid;
          place-items: center;
          margin-left: -10px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
          transition: transform 0.2s ease, z-index 0.2s ease;
          user-select: none;
        }
        .dash__team-avatar:first-child {
          margin-left: 0;
        }
        .dash__team-avatar:hover {
          transform: scale(1.2) translateY(-2px);
          z-index: 5;
        }
        @media (prefers-reduced-motion: reduce) {
          .dash__header, .dash__stat-card, .dash__leaderboard-section,
          .dash__team-section, .dash__table-row, .dash__shortlist-btn,
          .dash__copy-btn, .dash__team-avatar {
            transition: none !important;
            transform: none !important;
            animation: none !important;
          }
        }
      `}</style>

      <section className="card dash__header">
        <div className="dash__header-glow" aria-hidden="true" />
        <div className="dash__header-content">
          <div className="dash__header-badges">
            <span className="pill info">{founderMode ? 'Founder Mode' : 'Hiring'}</span>
            <span className={`pill ${challenge.status === 'live' ? 'good' : 'warn'}`}>{challenge.status}</span>
            <span className="pill">{challenge.timeLimitMin || 30}m challenge</span>
          </div>

          <h1 className="dash__title">{challenge.title}</h1>

          <div className="card soft dash__share-card">
            <label htmlFor="candidate-link" className="dash__share-label">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              Candidate link
            </label>
            <div className="dash__share-input-row">
              <input
                id="candidate-link"
                className="dash__share-input"
                readOnly
                value={shareLink}
                spellCheck={false}
              />
              <button
                className={`btn ghost dash__copy-btn ${copied ? 'dash__copy-btn--copied' : ''}`}
                type="button"
                onClick={copyLink}
              >
                {copied ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    <span>Copy link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="dash__stats" aria-label="Challenge metrics">
        <div className="card dash__stat-card dash__stat-card--teal">
          <div>
            <div className="dash__stat-val">{totalCandidates}</div>
            <div className="dash__stat-label">Total candidates</div>
            <div className="dash__stat-sub">Submissions evaluated</div>
          </div>
          <div className="dash__stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
        </div>

        <div className="card dash__stat-card dash__stat-card--gold">
          <div>
            <div className="dash__stat-val">{shortlistedCount}</div>
            <div className="dash__stat-label">Shortlisted</div>
            <div className="dash__stat-sub">{founderMode ? 'Teammates starred' : 'Top candidates'}</div>
          </div>
          <div className="dash__stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
        </div>

        <div className="card dash__stat-card dash__stat-card--green">
          <div>
            <div className="dash__stat-val">{avgScore}</div>
            <div className="dash__stat-label">Average score</div>
            <div className="dash__stat-sub">Across all submissions</div>
          </div>
          <div className="dash__stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
        </div>
      </section>

      <section className="card stack dash__leaderboard-section">
        <h2>{founderMode ? 'Ranked potential co-founders and teammates' : 'Ranked candidates'}</h2>
        {rowsError && <div className="error" role="alert">{rowsError}</div>}
        {rows.length === 0 && !rowsError ? (
          <p className="muted">No candidates yet. Share the link above.</p>
        ) : rows.length > 0 && (
          <div className="dash__table-wrap">
            <table className="table dash__table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Reasoning</th>
                  <th>Authenticity</th>
                  <th>Flags</th>
                  <th>Shortlist</th>
                  <th>Badge</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`clickable dash__table-row ${selectedId === row.id ? 'dash__table-row--selected' : ''}`}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td>{index + 1}</td>
                    <td><strong>{row.name}</strong></td>
                    <td><span style={{ color: 'var(--accent)', fontWeight: 800 }}>{row.total}</span></td>
                    <td>{row.reasoning}/{row.reasoningMax}</td>
                    <td>
                      {row.authenticity ? (
                        <span className={`pill ${authenticityTone(row.authenticity)}`}>{row.authenticity}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="row">
                        {row.flagged && <span className="pill warn">Needs human review</span>}
                        {row.rereviewRequested && <span className="pill info">Re-review requested</span>}
                        {row.mentor && <span className="pill good">Mentor: {row.mentor.name}</span>}
                      </div>
                    </td>
                    <td>
                      <button
                        className={`btn small dash__shortlist-btn ${row.shortlisted ? 'dash__shortlist-btn--starred' : ''}`}
                        type="button"
                        disabled={busyRow === row.id}
                        aria-label={row.shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
                        onClick={(event) => toggleShortlist(event, row)}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill={row.shortlisted ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    </td>
                    <td>
                      {row.badgeId && (
                        <Link
                          to={`/badge/${row.badgeId}`}
                          className="dash__badge-link"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Badge
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {actionError && <div className="error" role="alert">{actionError}</div>}
      </section>

      {selectedId && <CandidatePanel key={selectedId} sid={selectedId} ownerKey={key} onChanged={reloadRows} />}

      {shortlisted.length > 0 && (
        <section className="card stack dash__team-section">
          <div className="dash__team-banner">
            <strong>Idea → Team → Skills → Venture</strong>
          </div>
          <div><strong>Idea:</strong> {challenge.title}</div>
          <div className="dash__team-row row" style={{ gap: 16 }}>
            <strong>Team:</strong>
            <div className="dash__team-avatars">
              {shortlisted.map((row) => (
                <div key={row.id} className="dash__team-avatar" title={row.name}>
                  <span>{(row.name || 'C').slice(0, 2).toUpperCase()}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              {shortlisted.map((row) => <span className="pill info" key={row.id}>{row.name}</span>)}
            </div>
          </div>
          <div>
            <strong>Mentor:</strong> {mentor ? mentor.mentor.name : <span className="muted">Waiting for a mentor endorsement</span>}
          </div>
        </section>
      )}
    </div>
  );
}
