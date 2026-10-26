import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/hooks.js';
import { useAuth } from '../lib/auth.jsx';
import { getAccountRole } from '../lib/roles.js';

const fields = [
  ['name', 'Name', 'text'],
  ['headline', 'Headline', 'text'],
  ['college', 'College or university', 'text'],
  ['city', 'City', 'text'],
  ['linkedin', 'LinkedIn URL', 'url'],
  ['github', 'GitHub URL', 'url'],
];

function CheckIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UserIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TargetIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function AwardIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="6" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

function TrophyIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H8v4h8v-4h-1c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12v6c0 3.31-2.69 6-6 6s-6-2.69-6-6V4Z" />
    </svg>
  );
}

function SparkLineIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function MapPinIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function BuildingIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { data, loading, error, errorStatus, reload } = useAsync(() => api.me(), [user?.id]);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!data?.user) return;
    setDraft(data.user);
    setUser(data.user);
    document.title = `ProveIt - ${data.user.name}`;
  }, [data?.user, setUser]);

  if (!user) {
    return (
      <div className="profile-page overflow-x-hidden">
        <section className="profile__auth-state card">
          <div className="profile__auth-icon" aria-hidden="true">
            <UserIcon size={30} />
          </div>
          <h1>Your profile</h1>
          <p className="muted">Log in to see your attempts, performance statistics, and verified badges.</p>
          <div>
            <Link className="btn primary" to="/login?next=/profile">
              Log in
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="profile-page overflow-x-hidden">
        <div className="card center profile__loading">
          <span className="spinner" /> Loading your profile...
        </div>
      </div>
    );
  }

  if (errorStatus === 401 || errorStatus === 403) {
    return (
      <div className="profile-page overflow-x-hidden">
        <section className="profile__auth-state card">
          <div className="profile__auth-icon" aria-hidden="true">
            <LockIcon size={30} />
          </div>
          <h1>Session expired</h1>
          <p className="muted">Please log in again to view your profile.</p>
          <div>
            <button
              className="btn primary"
              type="button"
              onClick={async () => {
                await logout();
                navigate('/login?next=/profile', { replace: true });
              }}
            >
              Log in again
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="profile-page overflow-x-hidden">
        <section className="profile__auth-state card">
          <div className="error profile__alert profile__alert--error" role="alert" style={{ width: '100%' }}>
            <span className="profile__alert-icon">
              <AlertIcon size={18} />
            </span>
            <span>{error}</span>
          </div>
          <div>
            <button className="btn ghost" type="button" onClick={reload}>
              Try again
            </button>
          </div>
        </section>
      </div>
    );
  }

  const profile = draft || data?.user || user;
  const isCandidate = profile.role === 'candidate';
  const attempts = data?.attempts || [];
  const stats = data?.stats || {};
  const userInitial = (profile.name || profile.email || 'P').trim().charAt(0).toUpperCase();

  function update(field, value) {
    setDraft((current) => ({ ...(current || profile), [field]: value }));
    setMessage('');
    setSaveError('');
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setSaveError('');
    const body = Object.fromEntries(fields.map(([field]) => [field, String(profile[field] || '').trim()]));
    body.bio = String(profile.bio || '').trim();
    body.showOnLeaderboard = Boolean(profile.showOnLeaderboard);
    try {
      const result = await api.updateMe(body);
      setDraft(result.user);
      setUser(result.user);
      setMessage('Profile saved.');
      await reload();
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        await logout();
        navigate('/login?next=/profile', { replace: true });
      } else {
        setSaveError(requestError.message || 'Could not save your profile.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page overflow-x-hidden">
      <motion.section
        className="profile__hero"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <div className="profile__hero-glow" aria-hidden="true" />
        <div className="profile__avatar" aria-hidden="true">
          <span className="profile__avatar-initial">{userInitial}</span>
        </div>
        <div className="profile__hero-info">
          <div className="profile__hero-meta-top">
            <span className="pill info">{isCandidate ? 'Candidate profile' : 'Startup profile'}</span>
          </div>
          <h1>{isCandidate ? 'Your profile' : 'Company profile'}</h1>
          {profile.headline && (
            <p className="profile__hero-headline">{profile.headline}</p>
          )}
          <p className="muted">
            {profile.email} · Keep your professional context and ProveIt account details up to date.
          </p>
          {(profile.city || profile.college || profile.linkedin || profile.github) && (
            <div className="profile__hero-chips">
              {profile.city && (
                <span className="profile__chip">
                  <MapPinIcon />
                  <span>{profile.city}</span>
                </span>
              )}
              {profile.college && (
                <span className="profile__chip">
                  <BuildingIcon />
                  <span>{profile.college}</span>
                </span>
              )}
              {profile.linkedin && (
                <span className="profile__chip">
                  <a
                    href={profile.linkedin.startsWith('http') ? profile.linkedin : `https://${profile.linkedin}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    LinkedIn <ExternalLinkIcon />
                  </a>
                </span>
              )}
              {profile.github && (
                <span className="profile__chip">
                  <a
                    href={profile.github.startsWith('http') ? profile.github : `https://${profile.github}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    GitHub <ExternalLinkIcon />
                  </a>
                </span>
              )}
            </div>
          )}
        </div>
      </motion.section>

      {isCandidate && (
        <div className="profile__stats" aria-label="Performance statistics">
          <motion.div
            className="profile__stat-card profile__stat-card--teal"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.04 }}
          >
            <div className="profile__stat-label">
              <span>Attempts</span>
              <span className="profile__stat-icon" aria-hidden="true">
                <TargetIcon size={18} />
              </span>
            </div>
            <div className="profile__stat-value">{stats.attempts ?? 0}</div>
            <div className="profile__stat-sub">Completed &amp; in review</div>
          </motion.div>

          <motion.div
            className="profile__stat-card profile__stat-card--gold"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.08 }}
          >
            <div className="profile__stat-label">
              <span>Verified badges</span>
              <span className="profile__stat-icon" aria-hidden="true">
                <AwardIcon size={18} />
              </span>
            </div>
            <div className="profile__stat-value">{stats.badges ?? 0}</div>
            <div className="profile__stat-sub">Earned credentials</div>
          </motion.div>

          <motion.div
            className="profile__stat-card profile__stat-card--green"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.12 }}
          >
            <div className="profile__stat-label">
              <span>Best score</span>
              <span className="profile__stat-icon" aria-hidden="true">
                <TrophyIcon size={18} />
              </span>
            </div>
            <div className="profile__stat-value">
              {stats.bestScore ?? '—'}
              {stats.bestScore !== null && stats.bestScore !== undefined ? (
                <small> / 100</small>
              ) : null}
            </div>
            <div className="profile__stat-sub">Highest proven evaluation</div>
          </motion.div>

          <motion.div
            className="profile__stat-card profile__stat-card--accent-2"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, delay: 0.16 }}
          >
            <div className="profile__stat-label">
              <span>Average score</span>
              <span className="profile__stat-icon" aria-hidden="true">
                <SparkLineIcon size={18} />
              </span>
            </div>
            <div className="profile__stat-value">
              {stats.averageScore ?? '—'}
              {stats.averageScore !== null && stats.averageScore !== undefined ? (
                <small> / 100</small>
              ) : null}
            </div>
            <div className="profile__stat-sub">Across all submissions</div>
          </motion.div>
        </div>
      )}

      <motion.section
        className="profile__form-section"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: 'easeOut' }}
      >
        <div className="profile__form-header">
          <h2>{isCandidate ? 'Profile details' : 'Startup details'}</h2>
          <p className="muted small">
            Only supported profile fields are editable. Email, account role, and credentials stay protected.
          </p>
        </div>

        <form className="stack" onSubmit={save}>
          <div className="profile__form-group">
            <div className="profile__form-group-title">
              {isCandidate ? 'Personal context' : 'Organization context'}
            </div>
            <div className="profile__field-grid">
              {fields.slice(0, 4).map(([field, label, type]) => (
                <div className="profile__input-wrap" key={field}>
                  <label htmlFor={`profile-${field}`}>
                    {!isCandidate && field === 'college' ? 'Company or startup' : label}
                  </label>
                  <input
                    id={`profile-${field}`}
                    type={type}
                    value={profile[field] || ''}
                    onChange={(event) => update(field, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="profile__form-group">
            <div className="profile__form-group-title">Public profiles &amp; links</div>
            <div className="profile__field-grid">
              {fields.slice(4).map(([field, label, type]) => (
                <div className="profile__input-wrap" key={field}>
                  <label htmlFor={`profile-${field}`}>{label}</label>
                  <input
                    id={`profile-${field}`}
                    type={type}
                    value={profile[field] || ''}
                    onChange={(event) => update(field, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="profile__form-group">
            <div className="profile__form-group-title">Biography</div>
            <div className="profile__input-wrap">
              <label htmlFor="profile-bio">Bio</label>
              <textarea
                id="profile-bio"
                value={profile.bio || ''}
                maxLength={500}
                onChange={(event) => update('bio', event.target.value)}
              />
              <span className="profile__char-count">
                {(profile.bio || '').length} / 500 characters
              </span>
            </div>
          </div>

          {isCandidate && (
            <label className="profile__checkbox-card" htmlFor="profile-leaderboard">
              <input
                id="profile-leaderboard"
                type="checkbox"
                className="profile__checkbox-input"
                checked={Boolean(profile.showOnLeaderboard)}
                onChange={(event) => update('showOnLeaderboard', event.target.checked)}
              />
              <div className="profile__checkbox-label">
                <span>Show my supported badge information on the public leaderboard.</span>
                <span className="profile__checkbox-desc">
                  This can display your name, skill, score, level, and mentor name for qualifying badges.
                </span>
              </div>
            </label>
          )}

          {saveError && (
            <div className="error profile__alert profile__alert--error" role="alert">
              <span className="profile__alert-icon">
                <AlertIcon size={18} />
              </span>
              <span>{saveError}</span>
            </div>
          )}

          {message && (
            <div className="notice profile__alert profile__alert--success" role="status">
              <span className="profile__alert-icon">
                <CheckIcon size={18} />
              </span>
              <span>{message}</span>
            </div>
          )}

          <div>
            <button className="btn primary" type="submit" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner" /> Saving...
                </>
              ) : (
                'Save profile'
              )}
            </button>
          </div>
        </form>
      </motion.section>

      {isCandidate && (
        <motion.section
          className="profile__history"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.12, ease: 'easeOut' }}
        >
          <div className="profile__history-header">
            <h2>Your challenge history</h2>
            <p className="muted small">Scores and badges shown here come from your authenticated account.</p>
          </div>

          {!attempts.length ? (
            <div className="profile__history-empty">
              <div className="profile__history-empty-icon" aria-hidden="true">
                <TargetIcon size={30} />
              </div>
              <p className="muted">
                No challenge attempts yet.{' '}
                {getAccountRole(user) === 'candidate' ? (
                  <Link className="profile__action-link" to="/feed">
                    Explore open challenges &rarr;
                  </Link>
                ) : (
                  <Link className="profile__action-link" to="/startup/dashboard">
                    Return to your startup dashboard &rarr;
                  </Link>
                )}
              </p>
            </div>
          ) : (
            <div className="profile__history-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Challenge</th>
                    <th>Skill</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Result</th>
                    <th>Credential</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.submissionId}>
                      <td style={{ fontWeight: 650 }}>{attempt.challengeTitle || 'Challenge'}</td>
                      <td>{attempt.skill || '—'}</td>
                      <td>
                        <span className={`pill ${attempt.status === 'graded' ? 'good' : 'info'}`}>
                          {attempt.status}
                        </span>
                      </td>
                      <td>
                        <div className="profile__score-cell">
                          <span>
                            {attempt.total ?? '—'}
                            {attempt.total !== null && attempt.total !== undefined ? (
                              <span className="muted small"> / 100</span>
                            ) : (
                              ''
                            )}
                          </span>
                          {attempt.total !== null && attempt.total !== undefined && (
                            <div className="profile__score-bar-track" aria-hidden="true">
                              <div
                                className="profile__score-bar-fill"
                                style={{
                                  width: `${Math.min(Math.max(Number(attempt.total) || 0, 0), 100)}%`,
                                  background:
                                    Number(attempt.total) >= 70
                                      ? 'var(--good)'
                                      : Number(attempt.total) >= 50
                                      ? 'var(--accent)'
                                      : 'var(--bad)',
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {attempt.status === 'graded' ? (
                          <Link className="profile__action-link" to={`/result/${attempt.submissionId}`}>
                            View result
                          </Link>
                        ) : (
                          <Link className="profile__action-link" to={`/c/${attempt.challengeId}`}>
                            Continue
                          </Link>
                        )}
                      </td>
                      <td>
                        {attempt.badgeId ? (
                          <Link className="pill good profile__badge-link" to={`/badge/${attempt.badgeId}`}>
                            {attempt.level || 'View badge'}
                          </Link>
                        ) : (
                          <span className="muted">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
}
