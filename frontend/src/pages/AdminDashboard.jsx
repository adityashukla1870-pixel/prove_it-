import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/hooks.js';

const number = (value) => new Intl.NumberFormat().format(Number(value) || 0);

function Metric({ label, value, note, tone = '' }) {
  return <article className={`admin-metric ${tone}`}><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article>;
}

function ActivityChart({ rows }) {
  const groupSize = Math.max(1, Math.ceil(rows.length / 30));
  const displayRows = [];
  for (let index = 0; index < rows.length; index += groupSize) {
    const group = rows.slice(index, index + groupSize);
    displayRows.push(group.reduce((sum, row) => ({
      date: group.length > 1 ? `${group[0].date} – ${group.at(-1).date}` : row.date,
      users: sum.users + row.users,
      challenges: sum.challenges + row.challenges,
      attempts: sum.attempts + row.attempts,
    }), { date: '', users: 0, challenges: 0, attempts: 0 }));
  }
  const peak = Math.max(1, ...displayRows.flatMap((row) => [row.users, row.challenges, row.attempts]));
  return <div className="admin-chart" role="img" aria-label={`Account signups, challenges, and attempts over ${rows.length} days`}>
    <div className="admin-chart__legend"><span><i className="admin-chart__users" />New accounts</span><span><i className="admin-chart__challenges" />Challenges</span><span><i className="admin-chart__attempts" />Attempts</span>{groupSize > 1 && <span>Totals per {groupSize} days</span>}</div>
    <div className="admin-chart__bars" style={{ gridTemplateColumns: `repeat(${displayRows.length}, minmax(0, 1fr))` }}>{displayRows.map((row) => <div className="admin-chart__day" key={row.date} title={`${row.date}: ${row.users} accounts, ${row.challenges} challenges, ${row.attempts} attempts`}>
      <i className="admin-chart__users" style={{ height: `${Math.max(2, row.users / peak * 100)}%` }} />
      <i className="admin-chart__challenges" style={{ height: `${Math.max(2, row.challenges / peak * 100)}%` }} />
      <i className="admin-chart__attempts" style={{ height: `${Math.max(2, row.attempts / peak * 100)}%` }} />
    </div>)}</div>
    <div className="admin-chart__dates"><span>{rows[0]?.date || '—'}</span><span>{rows.at(-1)?.date || '—'}</span></div>
  </div>;
}

function Funnel({ values }) {
  const peak = Math.max(1, values.started, values.awaitingDefense, values.graded, values.expired);
  const steps = [
    ['Started', values.started, 'started'],
    ['Awaiting defense', values.awaitingDefense, 'waiting'],
    ['Graded', values.graded, 'graded'],
    ['Expired', values.expired, 'expired'],
  ];
  return <div className="admin-funnel">{steps.map(([label, value, tone]) => <div className="admin-funnel__row" key={label}>
    <div><span>{label}</span><strong>{number(value)}</strong></div>
    <span className="admin-funnel__track"><i className={`admin-funnel__fill admin-funnel__fill--${tone}`} style={{ width: `${Math.max(value ? 3 : 0, value / peak * 100)}%` }} /></span>
  </div>)}</div>;
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = useAsync(() => api.adminOverview(days), [days]);

  useEffect(() => { document.title = 'ProveIt - Admin overview'; }, []);

  if (loading && !data) return <div className="admin-page"><div className="admin-loading" aria-label="Loading admin overview"><i /><i /><i /><i /></div></div>;
  if (error && !data) return <div className="admin-page"><section className="admin-error" role="alert"><h1>Admin overview unavailable</h1><p>{error}</p><button className="btn" type="button" onClick={reload}>Try again</button></section></div>;
  if (!data) return null;

  const { totals, activity, operations, health } = data;
  const ready = health.database === 'connected';
  return <div className="admin-page">
    <header className="admin-header">
      <div><span className="admin-kicker">ProveIt operations</span><h1>Admin overview</h1><p>Platform activity and review signals, without candidate work or private profile data.</p></div>
      <div className="admin-header__controls"><label htmlFor="admin-range">Reporting window</label><select id="admin-range" value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><button className="admin-refresh" type="button" onClick={reload} disabled={loading} aria-label="Refresh overview">↻</button></div>
    </header>

    <section className="admin-health" aria-label="Service configuration">
      <div className="admin-health__title"><span className={`admin-pulse ${ready ? 'is-ready' : 'is-down'}`} />Service status</div>
      <div className="admin-health__item"><span>API</span><strong>Online</strong></div>
      <div className="admin-health__item"><span>Database</span><strong className={ready ? '' : 'is-alert'}>{ready ? 'Connected' : 'Disconnected'}</strong></div>
      <div className="admin-health__item"><span>AI mode</span><strong className={health.aiMode === 'unconfigured' ? 'is-alert' : ''}>{health.aiMode}</strong></div>
      <span className="admin-updated">Updated {new Date(data.generatedAt).toLocaleString()}</span>
    </section>

    <section className="admin-metrics" aria-label="Platform totals">
      <Metric label="Accounts" value={number(totals.users.total)} note={`${number(totals.users.candidates)} candidates · ${number(totals.users.startups)} startups`} />
      <Metric label="Live challenges" value={number(totals.challenges.live)} note={`${number(totals.challenges.draft)} drafts · ${number(totals.challenges.total)} total`} tone="admin-metric--terra" />
      <Metric label="Submission attempts" value={number(totals.submissions.total)} note="All time" tone="admin-metric--teal" />
      <Metric label="Graded in period" value={`${activity.completionRate}%`} note={`${number(activity.graded)} of ${number(activity.attempts)} attempts created in ${days} days`} tone="admin-metric--gold" />
    </section>

    <section className="admin-section admin-activity">
      <div className="admin-section__heading"><div><h2>Activity</h2><p>New accounts, challenges, and attempts per day</p></div><span>{number(activity.users)} accounts · {number(activity.challenges)} challenges · {number(activity.attempts)} attempts</span></div>
      <ActivityChart rows={activity.daily} />
    </section>

    <div className="admin-lower-grid">
      <section className="admin-section">
        <div className="admin-section__heading"><div><h2>Submission flow</h2><p>Current state of attempts created in the selected period</p></div></div>
        <Funnel values={activity.funnel} />
      </section>
      <section className="admin-section">
        <div className="admin-section__heading"><div><h2>Review signals</h2><p>Current operational counts</p></div></div>
        <div className="admin-ops-grid">
          <Metric label="Re-review requests" value={number(operations.reReviewRequests)} />
          <Metric label="Flagged grades" value={number(operations.flaggedGrades)} tone="admin-metric--terra" />
          <Metric label="Submissions with overrides" value={number(operations.submissionsWithOverrides)} />
          <Metric label="Awaiting defense" value={number(operations.awaitingDefense)} tone="admin-metric--gold" />
          <Metric label="Active badge records" value={number(operations.activeBadgeRecords)} tone="admin-metric--teal" />
          <Metric label="Revoked badge records" value={number(operations.revokedBadgeRecords)} tone="admin-metric--terra" />
        </div>
      </section>
    </div>

    <section className="admin-section admin-skills">
      <div className="admin-section__heading"><div><h2>Challenge demand</h2><p>Most common skills in live challenges</p></div></div>
      {operations.liveChallengeSkills.length ? <ul>{operations.liveChallengeSkills.map((item) => <li key={item.skill}><span>{item.skill}</span><strong>{number(item.count)}</strong></li>)}</ul> : <p className="admin-empty">No live challenges have a skill recorded.</p>}
    </section>

    <footer className="admin-footnote">Metrics refresh when this page is loaded. AI mode reports configuration only, not provider availability. “Awaiting defense” counts answered attempts before the defense step; grading runs synchronously after defense. Badge counts reflect stored status records.</footer>
  </div>;
}
