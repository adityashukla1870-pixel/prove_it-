// Start the backend with AI_MOCK=1 and MongoDB running: cd backend && AI_MOCK=1 npm run dev
// In another terminal, run: cd backend && npm run smoke (optional: API_URL=http://localhost:5000)

const baseUrl = (process.env.API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const failures = [];
let blocked = false;
const state = {};

async function request(method, path, { body, ownerKey, candidateToken, authToken } = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(ownerKey ? { 'x-owner-key': ownerKey } : {}), ...(candidateToken ? { 'x-candidate-token': candidateToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`${method} ${path}: ${error.message}`);
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

async function step(number, label, run) {
  if (blocked) {
    console.log(`FAIL ${number}/8 ${label}: skipped because an earlier step failed`);
    failures.push(label);
    return null;
  }
  try {
    const result = await run();
    console.log(`PASS ${number}/8 ${label}: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    blocked = true;
    failures.push(label);
    console.log(`FAIL ${number}/8 ${label}: ${error.message}`);
    return null;
  }
}

await step(1, 'Generate challenge', async () => {
  const account = await request('POST', '/auth/signup', {
    body: { name: 'Smoke Startup', email: `smoke-startup-${Date.now()}@example.test`, password: 'smoke-password-123', role: 'startup' },
  });
  if (account.user?.role !== 'startup' || !account.token) throw new Error(`Startup account was not created: ${JSON.stringify(account)}`);
  state.authToken = account.token;
  const candidate = await request('POST', '/auth/signup', {
    body: { name: 'Smoke Candidate', email: `smoke-candidate-${Date.now()}@example.test`, password: 'smoke-password-123', role: 'candidate' },
  });
  if (candidate.user?.role !== 'candidate' || !candidate.token) throw new Error(`Candidate account was not created: ${JSON.stringify(candidate)}`);
  state.candidateAuthToken = candidate.token;
  const result = await request('POST', '/challenges/generate', {
    authToken: state.authToken,
    body: {
      mode: 'job',
      text: 'Junior Data Analyst at a small online retail startup. Clean sales data, write SQL queries, build weekly spreadsheets, and explain trends to the founders.',
      posterName: 'ProveIt smoke test',
    },
  });
  if (!result.challenge?.id || !result.ownerKey) throw new Error(`Missing challenge id or owner key: ${JSON.stringify(result)}`);
  state.id = result.challenge.id;
  state.ownerKey = result.ownerKey;
  if (result.challenge.ownerKey || result.challenge.ownerKeyHash) throw new Error('Challenge response exposed the owner key or its hash');
  return { id: state.id, mode: result.challenge.mode, ownerKeyCaptured: true };
});

await step(2, 'Update draft', async () => {
  const result = await request('PUT', `/challenges/${state.id}`, {
    authToken: state.authToken,
    ownerKey: state.ownerKey,
    body: {
      title: 'Smoke test: explain a sales trend',
      task: 'Review a sample weekly sales report. Identify one meaningful trend, propose a follow-up analysis, and explain how you would validate the result with the founders.',
      timeLimitMin: 30,
      rubric: [
        { name: 'Data reasoning', weight: 30, description: 'Finds and explains a useful trend.' },
        { name: 'Technical approach', weight: 25, description: 'Chooses practical analysis methods.' },
        { name: 'Validation', weight: 25, description: 'Checks assumptions and data quality.' },
        { name: 'Communication', weight: 20, description: 'Explains findings clearly.' },
      ],
      seedQuestions: ['What evidence supports your trend?', 'How would you check that result?'],
    },
  });
  const totalWeight = result.rubric?.reduce((sum, item) => sum + Number(item.weight), 0);
  if (result.id !== state.id || result.status !== 'draft' || totalWeight !== 100) throw new Error(`Unexpected draft response: ${JSON.stringify(result)}`);
  return { id: result.id, status: result.status, totalWeight };
});

await step(3, 'Approve challenge', async () => {
  const result = await request('POST', `/challenges/${state.id}/approve`, { authToken: state.authToken, ownerKey: state.ownerKey });
  if (result.status !== 'live') throw new Error(`Expected status live, received: ${JSON.stringify(result)}`);
  return { id: result.id, status: result.status };
});

await step(4, 'Start submission', async () => {
  const anonymous = await fetch(`${baseUrl}/api/challenges/${state.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Anonymous Candidate', email: `anonymous-${Date.now()}@example.test` }) });
  if (anonymous.status !== 401) throw new Error(`Unauthenticated attempt start expected 401, got ${anonymous.status}`);
  const result = await request('POST', `/challenges/${state.id}/start`, {
    authToken: state.candidateAuthToken,
    body: { retry: false },
  });
  if (!result.id || !result.candidateToken || result.candidateTokenHash) throw new Error(`Missing submission id/token or leaked token hash: ${JSON.stringify(result)}`);
  state.submissionId = result.id;
  state.candidateToken = result.candidateToken;
  const unauthorized = await fetch(`${baseUrl}/api/submissions/${state.submissionId}`);
  if (unauthorized.status !== 403) throw new Error(`Unauthenticated submission read expected 403, got ${unauthorized.status}`);
  const duplicate = await fetch(`${baseUrl}/api/challenges/${state.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.candidateAuthToken}` }, body: JSON.stringify({ retry: false }) });
  const duplicateData = await duplicate.json();
  if (duplicate.status !== 409 || duplicateData.id || duplicateData.candidateToken) throw new Error(`Existing email was not safely rejected: ${duplicate.status} ${JSON.stringify(duplicateData)}`);
  const missing = await fetch(`${baseUrl}/api/submissions/not-a-real-id`);
  const missingData = await missing.json();
  if (missing.status !== 404 || typeof missingData.error !== 'string') throw new Error(`Missing-record error was not a JSON 404: ${missing.status} ${JSON.stringify(missingData)}`);
  return { id: result.id, status: result.status, unauthenticatedStart: anonymous.status, unauthenticatedRead: unauthorized.status, duplicateAttempt: duplicate.status };
});

await step(5, 'Submit answer and get follow-ups', async () => {
  const denied = await fetch(`${baseUrl}/api/submissions/${state.submissionId}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'A sufficiently long answer submitted without a session token.' }) });
  if (denied.status !== 403) throw new Error(`Unauthenticated answer expected 403, got ${denied.status}`);
  state.answer = 'I would first validate the weekly sales data for missing values and duplicate orders, then compare revenue by product and acquisition channel. I would use SQL to group comparable weeks, check the effect of promotions, and identify whether one category explains the change. I would put the clearest trend into a short spreadsheet chart, note the sample size, and compare the result against the source report. Before recommending action, I would ask the founders whether inventory, pricing, or a campaign changed during that period. I would then test the same pattern on another time window to see if it repeats and document any assumptions.';
  const result = await request('POST', `/submissions/${state.submissionId}/answer`, {
    candidateToken: state.candidateToken,
    authToken: state.candidateAuthToken,
    body: { answer: state.answer },
  });
  if (result.status !== 'answered' || !Array.isArray(result.questions) || result.questions.length < 2 || result.questions.length > 3) {
    throw new Error(`Expected answered status and 2-3 questions: ${JSON.stringify(result)}`);
  }
  state.questions = result.questions;
  return { status: result.status, questions: result.questions };
});

await step(6, 'Defend answers and grade', async () => {
  const empty = await fetch(`${baseUrl}/api/submissions/${state.submissionId}/defend`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-candidate-token': state.candidateToken }, body: JSON.stringify({ answers: state.questions.map(() => '   ') }) });
  if (empty.status !== 400) throw new Error(`Empty defense expected 400, got ${empty.status}`);
  const result = await request('POST', `/submissions/${state.submissionId}/defend`, {
    candidateToken: state.candidateToken,
    authToken: state.candidateAuthToken,
    body: { answers: state.questions.map((question, index) => `For question ${index + 1}, I would compare the SQL output to the source records, check whether promotions or inventory changed, and repeat the analysis on another week before recommending a decision.`) },
  });
  if (result.status !== 'graded' || !Number.isFinite(Number(result.score?.total))) throw new Error(`Expected graded status and numeric score: ${JSON.stringify(result)}`);
  if (result.score.total >= 70 && !result.badgeId) throw new Error(`Score ${result.score.total} qualifies but no badge was issued: ${JSON.stringify(result)}`);
  if ((result.score.criteria || []).some((criterion) => criterion.evidence.some((quote) => !state.answer.replace(/\s+/g, ' ').includes(quote)))) throw new Error('A score evidence quote is not present in the submitted answer');
  state.badgeId = result.badgeId;
  return { status: result.status, total: result.score.total, badgeId: result.badgeId || null };
});

await step(7, 'Verify public badge when issued', async () => {
  if (!state.badgeId) return { skipped: true, reason: 'No badge was issued for this score' };
  const result = await request('GET', `/badges/${state.badgeId}`);
  if (result.verified !== true || result.breakdownPublic !== false || result.criteria?.length
    || ['signature', 'candidateToken', 'candidateTokenHash', 'ownerKey', 'ownerKeyHash', 'answer', 'qa', 'questions'].some((key) => key in result)) {
    throw new Error(`Badge verification/privacy unexpected: ${JSON.stringify(result)}`);
  }
  return { badgeId: result.badgeId, verified: result.verified, breakdownPublic: result.breakdownPublic };
});

await step(8, 'Confirm submission appears on leaderboard', async () => {
  const result = await request('GET', `/challenges/${state.id}/leaderboard`, { authToken: state.authToken, ownerKey: state.ownerKey });
  const submission = result.find((row) => row.id === state.submissionId);
  if (!submission) throw new Error(`Submission ${state.submissionId} not present in response: ${JSON.stringify(result)}`);
  return { submissionId: submission.id, total: submission.total };
});

if (failures.length) {
  console.error(`Smoke test failed: ${failures.length} step(s) did not pass.`);
  process.exitCode = 1;
} else {
  console.log('All 8 smoke-test steps passed.');
}
