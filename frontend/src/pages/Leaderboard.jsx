import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/hooks.js';

function Avatar({ name, place }) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`leader-avatar leader-avatar--${place || 'list'}`} aria-hidden="true">{initials}</span>;
}

function ProgressRing({ value }) {
  return <span className="leader-ring" style={{ '--progress': `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} aria-label={`${value} out of 100`}><span>{value}%</span></span>;
}

function LeaderboardSkeleton() {
  return <div className="leaderboard-skeleton" aria-label="Loading leaderboard" aria-live="polite">
    <div className="leader-skeleton-heading"><i /><i /><i /></div>
    <div className="leader-skeleton-podium">{[0, 1, 2].map((item) => <i key={item} />)}</div>
    <div className="leader-skeleton-list">{[0, 1, 2, 3].map((item) => <i key={item} />)}</div>
  </div>;
}

export default function Leaderboard() {
  const [skill, setSkill] = useState('');
  const { data, loading, error } = useAsync(() => api.leaderboard(skill || undefined), [skill]);

  useEffect(() => { document.title = 'ProveIt - Leaderboard'; }, []);

  if (loading) return <div className="leaderboard-page"><LeaderboardSkeleton /></div>;
  if (error) return <div className="leaderboard-page"><div className="leaderboard-error" role="alert">{error}</div></div>;

  const rows = data?.rows || [];
  const skills = data?.skills || [];
  const podium = rows.slice(0, 3);
  const remaining = rows.slice(3);

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-topbar">
        <Link className="leader-back" to="/" aria-label="Back to ProveIt">←</Link>
        <div className="leader-team-title">ProveIt <span>community</span></div>
        {skills.length > 0 ? <label className="leader-filter"><span className="sr-only">Filter by skill</span><select value={skill} onChange={(event) => setSkill(event.target.value)} aria-label="Filter leaderboard by skill"><option value="">All skills</option>{skills.map((item) => <option key={item} value={item}>{item}</option>)}</select></label> : <span className="leader-topbar-spacer" />}
      </header>

      <div className="leaderboard-content">
        <div className="leader-heading">
          <div><span className="leader-eyebrow">Verified work · community rankings</span><h1>Leaderboard</h1><p>Recognizing the people who put their skills to the test.</p></div>
          <span className="leader-period">PUBLIC · OPT-IN</span>
        </div>

        {rows.length === 0 ? <section className="leader-empty"><span className="leader-empty-icon">✦</span><h2>The podium is open</h2><p>No public verified badges match this view yet.</p></section> : <>
          {podium.length > 0 && <section className="leader-podium" aria-label="Top three candidates">
            {podium.map((row, index) => {
              const place = index + 1;
              return <article className={`podium-person podium-person--${place}`} key={`${row.userId}-${row.skill}`}>
                {place === 1 && <span className="podium-crown" aria-label="First place">✦</span>}
                <Avatar name={row.name} place={place} />
                <span className="podium-rank">{place === 1 ? '1ST PLACE' : place === 2 ? '2ND PLACE' : '3RD PLACE'}</span>
                <strong className="podium-name">{row.name}</strong>
                <span className="podium-skill">{row.skill || 'Verified skill'}</span>
                <div className="podium-block"><span className="podium-score">{row.total}<small> / 100</small></span><span className="podium-level">{row.level || 'Verified'}</span><Link className="leader-verify podium-verify" to={`/badge/${row.badgeId}`}>Verify badge ↗</Link></div>
              </article>;
            })}
          </section>}

          {remaining.length > 0 && <section className="leader-list" aria-label="More ranked candidates">
            <div className="leader-list-heading"><h2>Rankings</h2><span>{rows.length} VERIFIED RESULTS</span></div>
            {remaining.map((row) => <article className="leader-row" key={`${row.userId}-${row.skill}`}>
              <span className="leader-row-rank">{String(row.rank).padStart(2, '0')}</span>
              <Avatar name={row.name} />
              <div className="leader-row-person"><strong>{row.name}</strong><span>{row.skill || 'Verified skill'}{row.headline ? ` · ${row.headline}` : ''}</span></div>
              <span className="leader-row-score">{row.total}<small> / 100</small></span>
              <ProgressRing value={row.total} />
              <Link className="leader-verify" to={`/badge/${row.badgeId}`}>Verify <span aria-hidden="true">↗</span></Link>
            </article>)}
          </section>}
        </>}
        <p className="leader-privacy">Only candidates who opt in with a qualifying public badge appear here. Private submissions and rubric evidence stay private.</p>
      </div>
    </div>
  );
}
