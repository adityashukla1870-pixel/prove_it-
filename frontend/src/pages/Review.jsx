import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { getOwnerKey } from '../lib/store.js';
import { useAsync } from '../lib/hooks.js';

let nextRowId = 0;
const withKey = (row) => ({ ...row, _k: `${Date.now()}-${nextRowId++}` });
const makeQuestion = () => ({ text: '', _k: `${Date.now()}-${nextRowId++}` });

export default function Review() {
  useEffect(() => {
    document.title = 'ProveIt - Review challenge';
  }, []);
  const { id } = useParams();
  const navigate = useNavigate();
  const key = getOwnerKey(id);
  const { data, loading, error: loadError } = useAsync(
    () => api.getChallengeOwner(id, key),
    [id],
  );
  const [form, setForm] = useState({ title: '', task: '', timeLimitMin: 30, rubric: [], seedQuestions: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const copiedFor = useRef('');
  const savedTimer = useRef(null);
  const total = form.rubric.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);

  useEffect(() => () => clearTimeout(savedTimer.current), []);
  useEffect(() => {
    if (!data || data.id !== id) return;
    if (data.status === 'live') {
      navigate(`/dashboard/${id}`, { replace: true });
      return;
    }
    if (copiedFor.current === id) return;
    copiedFor.current = id;
    setForm({
      title: data.title || '',
      task: data.task || '',
      timeLimitMin: data.timeLimitMin ?? 30,
      rubric: (data.rubric || []).map(withKey),
      seedQuestions: (data.seedQuestions || []).map((text) => ({ text, _k: `${Date.now()}-${nextRowId++}` })),
    });
  }, [data, id, navigate]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function payload() {
    return {
      title: form.title,
      task: form.task,
      timeLimitMin: Number(form.timeLimitMin),
      rubric: form.rubric.map(({ name, weight, description }) => ({ name, weight: Number(weight) || 0, description })),
      seedQuestions: form.seedQuestions.map(({ text }) => text),
    };
  }

  async function save(approve = false) {
    setBusy(true);
    setError('');
    setSaved(false);
    clearTimeout(savedTimer.current);
    try {
      await api.updateChallenge(id, payload(), key);
      if (approve) {
        await api.approveChallenge(id, key);
        navigate(`/dashboard/${id}`);
      } else {
        setSaved(true);
        savedTimer.current = setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      setError(err.message || 'Could not save the challenge. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading && (!data || data.id !== id)) return <div className="card center"><span className="spinner" /></div>;
  if (loadError && (!data || data.id !== id)) return <div className="error" role="alert">{loadError}</div>;
  if (!data || data.id !== id) return null;

  return (
    <div className="stack">
      <div className="notice stack">
        <div>AI drafted this challenge. Review everything and edit freely. Nothing goes live until you approve.</div>
        <div className="row">
          <span className="pill info">{data.skill}</span>
          <span className="pill info">{data.level}</span>
          <span className="pill info">{data.mode === 'idea' ? 'Founder Mode' : 'Hiring'}</span>
        </div>
      </div>

      <section className="card stack">
        <h2>Challenge</h2>
        <div className="grid two">
          <div><label htmlFor="challenge-title">Title</label><input id="challenge-title" value={form.title} onChange={(event) => updateField('title', event.target.value)} /></div>
          <div><label htmlFor="time-limit">Time limit (minutes)</label><input id="time-limit" type="number" min="15" max="60" value={form.timeLimitMin} onChange={(event) => updateField('timeLimitMin', event.target.value === '' ? '' : Number(event.target.value))} /></div>
        </div>
        <div><label htmlFor="challenge-task">Task (shown to candidates, markdown)</label><textarea id="challenge-task" className="code" value={form.task} onChange={(event) => updateField('task', event.target.value)} /></div>
      </section>

      <section className="card stack">
        <h2>Scoring rubric</h2>
        <div style={{ overflowX: "auto" }}><table className="table">
          <thead><tr><th>Criterion</th><th>Weight</th><th>What it measures</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {form.rubric.map((row, index) => (
              <tr key={row._k}>
                <td><input aria-label={`Criterion ${index + 1}`} value={row.name} onChange={(event) => setForm((current) => ({ ...current, rubric: current.rubric.map((item) => item._k === row._k ? { ...item, name: event.target.value } : item) }))} /></td>
                <td><input aria-label={`Weight ${index + 1}`} type="number" min="0" max="100" value={row.weight} onChange={(event) => setForm((current) => ({ ...current, rubric: current.rubric.map((item) => item._k === row._k ? { ...item, weight: event.target.value === '' ? '' : Number(event.target.value) } : item) }))} /></td>
                <td><input aria-label={`What it measures ${index + 1}`} value={row.description} onChange={(event) => setForm((current) => ({ ...current, rubric: current.rubric.map((item) => item._k === row._k ? { ...item, description: event.target.value } : item) }))} /></td>
                <td><button className="btn ghost small" type="button" disabled={busy} aria-label={`Remove criterion ${index + 1}`} onClick={() => updateField('rubric', form.rubric.filter((item) => item._k !== row._k))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="row">
          <button className="btn ghost small" type="button" disabled={busy} onClick={() => updateField('rubric', [...form.rubric, withKey({ name: '', weight: 0, description: '' })])}>Add criterion</button>
          <span>Total weight: <span className={`pill ${total === 100 ? 'good' : 'bad'}`}>{total} / 100</span>{total !== 100 && <span className="muted small"> must be 100</span>}</span>
        </div>
        <p className="muted small">Longer answers never earn more points. The AI grader also scores 'Reasoning Under Questioning' from the candidate's spoken follow-up answers.</p>
      </section>

      <section className="card stack">
        <h2>Interviewer's starting questions</h2>
        {form.seedQuestions.map((question, index) => (
          <div className="row" key={question._k}>
            <input aria-label={`Starting question ${index + 1}`} value={question.text} onChange={(event) => setForm((current) => ({ ...current, seedQuestions: current.seedQuestions.map((item) => item._k === question._k ? { ...item, text: event.target.value } : item) }))} />
            <button className="btn ghost small" type="button" disabled={busy} aria-label={`Remove question ${index + 1}`} onClick={() => updateField('seedQuestions', form.seedQuestions.filter((item) => item._k !== question._k))}>Remove</button>
          </div>
        ))}
        <button className="btn ghost small" type="button" disabled={busy} onClick={() => updateField('seedQuestions', [...form.seedQuestions, makeQuestion()])}>Add question</button>
        <p className="muted small">The AI uses these as inspiration, then asks questions specific to each candidate's own answer.</p>
      </section>

      {(loadError || error) && <div className="error" role="alert">{error || loadError}</div>}
      <div className="row between">
        <div className="row">
          <button className="btn ghost" type="button" disabled={busy} onClick={() => save()}>Save changes</button>
          {saved && <span className="pill good small">Saved</span>}
        </div>
        <div className="row">
          {busy && <span className="spinner" aria-label="Saving" />}
          <button className="btn primary" type="button" disabled={busy || total !== 100 || !form.title.trim() || !form.task.trim()} onClick={() => save(true)}>Approve &amp; publish</button>
        </div>
      </div>
    </div>
  );
}
