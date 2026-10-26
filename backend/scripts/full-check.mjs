// Start the backend with AI_MOCK=1 and MongoDB running: cd backend && AI_MOCK=1 npm run dev
// In another terminal, run: cd backend && npm run full-check (optional: API_URL=http://localhost:5000)
import 'dotenv/config';
import mongoose from 'mongoose';
import { Challenge, Submission } from '../src/models.js';
import { gradeSubmission } from '../src/graders.js';
import { BADGE_ISSUE_THRESHOLD } from '../src/badge-state.js';
import { evidencePresent, hashSecret } from '../src/util.js';

const baseUrl = (process.env.API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const failures = [];
let blocked = false;
const state = {};
const totalSteps = 11;

async function request(method, path, { body, ownerKey, candidateToken, authToken } = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(ownerKey ? { 'x-owner-key': ownerKey } : {}), ...(candidateToken ? { 'x-candidate-token': candidateToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`${method} ${path}: ${error.cause?.message || error.message}`);
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: response.status, data };
}

await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/proveit');

function expect(result, status, label) {
  if (result.status !== status) throw new Error(`${label} expected HTTP ${status}, got ${result.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

const startupRequest = (method, path, options = {}) => request(method, path, { ...options, authToken: state.authToken });

async function step(number, label, run) {
  if (blocked) {
    console.log(`FAIL ${number}/${totalSteps} ${label}: skipped because an earlier step failed`);
    failures.push({ number, label });
    return;
  }
  try {
    const result = await run();
    console.log(`PASS ${number}/${totalSteps} ${label}: ${JSON.stringify(result)}`);
  } catch (error) {
    blocked = true;
    failures.push({ number, label });
    console.log(`FAIL ${number}/${totalSteps} ${label}: ${error.message}`);
  }
}

await step(1, 'Founder Mode end to end', async () => {
  const account = expect(await request('POST', '/auth/signup', { body: {
    name: 'Full Check Startup',
    email: `full-check-startup-${Date.now()}@example.test`,
    password: 'full-check-password-123',
    role: 'startup',
  } }), 201, 'Create full-check startup account');
  if (account.user?.role !== 'startup' || !account.token) throw new Error(`Startup account was not created: ${JSON.stringify(account)}`);
  state.authToken = account.token;
  const candidate = expect(await request('POST', '/auth/signup', { body: {
    name: 'Full Check Candidate',
    email: `full-check-candidate-${Date.now()}@example.test`,
    password: 'full-check-password-123',
    role: 'candidate',
  } }), 201, 'Create full-check candidate account');
  if (candidate.user?.role !== 'candidate' || !candidate.token) throw new Error(`Candidate account was not created: ${JSON.stringify(candidate)}`);
  state.candidateAuthToken = candidate.token;
  const generated = expect(await startupRequest('POST', '/challenges/generate', { body: {
    mode: 'idea',
    text: 'A neighborhood tiffin delivery service for university hostels, connecting students with nearby home cooks through weekly meal subscriptions and simple UPI payments.',
    posterName: 'Full check founder',
  } }), 201, 'Generate Founder Mode challenge');
  if (!generated.challenge?.id || !generated.ownerKey) throw new Error(`Missing challenge id or owner key: ${JSON.stringify(generated)}`);
  if (generated.challenge.ownerKey || generated.challenge.ownerKeyHash) throw new Error('Challenge response exposed an owner key or its hash');
  state.challengeId = generated.challenge.id;
  state.ownerKey = generated.ownerKey;

  const updated = expect(await startupRequest('PUT', `/challenges/${state.challengeId}`, { ownerKey: state.ownerKey, body: {
    title: 'Founder Mode: validate a tiffin delivery launch',
    task: 'Plan a small launch for a hostel tiffin service. Choose how to recruit cooks, test weekly subscriptions, measure repeat orders, and validate whether UPI payments and delivery operations are reliable.',
    timeLimitMin: 30,
    rubric: [
      { name: 'Customer insight', weight: 30, description: 'Uses student needs to shape the launch.' },
      { name: 'Execution plan', weight: 30, description: 'Builds a practical pilot and cook onboarding plan.' },
      { name: 'Measurement', weight: 20, description: 'Defines useful metrics and validation.' },
      { name: 'Risk handling', weight: 20, description: 'Anticipates operational and payment risks.' },
    ],
    seedQuestions: ['How would you know students will subscribe again?', 'What would you test before expanding?'],
  } }), 200, 'Update Founder Mode draft');
  if (updated.status !== 'draft' || updated.rubric?.reduce((sum, row) => sum + Number(row.weight), 0) !== 100) throw new Error(`Unexpected updated challenge: ${JSON.stringify(updated)}`);

  const approved = expect(await startupRequest('POST', `/challenges/${state.challengeId}/approve`, { ownerKey: state.ownerKey }), 200, 'Approve Founder Mode challenge');
  if (approved.status !== 'live') throw new Error(`Expected live status: ${JSON.stringify(approved)}`);
  state.email = candidate.user.email;
  const anonymousStart = await request('POST', `/challenges/${state.challengeId}/start`, { body: { name: 'Anonymous Candidate', email: `anonymous-${Date.now()}@example.test` } });
  if (anonymousStart.status !== 401) throw new Error(`Unauthenticated attempt start expected 401, got ${anonymousStart.status}`);
  const started = expect(await request('POST', `/challenges/${state.challengeId}/start`, { authToken: state.candidateAuthToken, body: { retry: false } }), 201, 'Start Founder Mode submission');
  if (!started.id || !started.candidateToken) throw new Error(`Missing submission id or candidate token: ${JSON.stringify(started)}`);
  state.submissionId = started.id;
  state.candidateToken = started.candidateToken;
  const persistedChallenge = await Challenge.findById(state.challengeId).select('+ownerKeyHash +ownerKey').lean();
  const persistedSubmission = await Submission.findById(state.submissionId).select('+candidateTokenHash').lean();
  if (!persistedChallenge?.ownerKeyHash || persistedChallenge.ownerKey || persistedChallenge.ownerKeyHash === state.ownerKey) throw new Error('Owner secret was not stored only as a hash');
  if (!persistedSubmission?.candidateTokenHash || persistedSubmission.candidateTokenHash === state.candidateToken) throw new Error('Candidate token was not stored only as a hash');
  const unauthorized = await request('GET', `/submissions/${state.submissionId}`);
  if (unauthorized.status !== 403) throw new Error(`Unauthenticated submission read expected 403, got ${unauthorized.status}`);
  const duplicate = await request('POST', `/challenges/${state.challengeId}/start`, { authToken: state.candidateAuthToken, body: { retry: false } });
  if (duplicate.status !== 409 || duplicate.data.id || duplicate.data.candidateToken) throw new Error(`Duplicate email exposed an attempt: ${JSON.stringify(duplicate)}`);
  state.answer = 'I would begin with two hostels and interview students about meal timing, price, dietary needs, and what makes them renew a subscription. I would onboard a small group of nearby cooks, agree on a limited menu and daily capacity, and run a one-week pilot. Students could order through a simple mobile form and pay with UPI. I would track delivery completion, late orders, refunds, repeat orders, and contribution margin by meal. I would compare the results across weekdays, ask students and cooks what failed, and verify payment records against orders before deciding whether to expand to another hostel.';
  const deniedAnswer = await request('POST', `/submissions/${state.submissionId}/answer`, { body: { answer: state.answer } });
  if (deniedAnswer.status !== 403) throw new Error(`Unauthenticated answer expected 403, got ${deniedAnswer.status}`);
  const answered = expect(await request('POST', `/submissions/${state.submissionId}/answer`, { authToken: state.candidateAuthToken, candidateToken: state.candidateToken, body: { answer: state.answer } }), 200, 'Submit Founder Mode answer');
  if (answered.status !== 'answered' || !Array.isArray(answered.questions) || answered.questions.length < 2 || answered.questions.length > 3) throw new Error(`Expected answered status and 2-3 questions: ${JSON.stringify(answered)}`);
  if (!answered.questions.some((question) => /hostels|students|meal|cooks|subscription/i.test(question))) throw new Error(`Follow-up did not reflect candidate-specific answer details: ${JSON.stringify(answered.questions)}`);
  const emptyDefense = await request('POST', `/submissions/${state.submissionId}/defend`, { authToken: state.candidateAuthToken, candidateToken: state.candidateToken, body: { answers: answered.questions.map(() => '   ') } });
  if (emptyDefense.status !== 400) throw new Error(`Empty defense should return HTTP 400, got ${emptyDefense.status}`);
  const unauthorizedDefense = await request('POST', `/submissions/${state.submissionId}/defend`, { body: { answers: answered.questions.map(() => 'A meaningful answer with multiple details and clear reasoning.') } });
  if (unauthorizedDefense.status !== 403) throw new Error(`Unauthenticated defense expected 403, got ${unauthorizedDefense.status}`);
  const graded = expect(await request('POST', `/submissions/${state.submissionId}/defend`, { authToken: state.candidateAuthToken, candidateToken: state.candidateToken, body: {
    answers: answered.questions.map((question, index) => `For follow-up ${index + 1}, I would compare order and payment records, check delivery timing and repeat purchases, speak with students and cooks about exceptions, and repeat the pilot before expanding.`),
  } }), 200, 'Defend Founder Mode answer');
  if (graded.status !== 'graded' || !Number.isFinite(Number(graded.score?.total))) throw new Error(`Expected graded status and numeric score: ${JSON.stringify(graded)}`);
  if (graded.score.total >= 70 && !graded.badgeId) throw new Error(`Score ${graded.score.total} qualifies but no badge was issued: ${JSON.stringify(graded)}`);
  if (graded.score.criteria.some((item) => item.evidence.some((quote) => !state.answer.replace(/\s+/g, ' ').includes(quote)))) throw new Error('A criterion contains fabricated evidence');
  state.score = graded.score;
  state.badgeId = graded.badgeId || null;
  return { challengeId: state.challengeId, submissionId: state.submissionId, status: graded.status, total: graded.score.total, authenticity: graded.score.authenticity, graderConfidence: graded.score.graderConfidence, badgeId: state.badgeId };
});

await step(2, 'Reject edits after publishing', async () => {
  const result = await startupRequest('PUT', `/challenges/${state.challengeId}`, { ownerKey: state.ownerKey, body: { title: 'Should not update', task: 'This edit must be rejected.', timeLimitMin: 30, rubric: [{ name: 'Criterion', weight: 100, description: 'A valid rubric.' }], seedQuestions: [] } });
  const data = expect(result, 409, 'Update published challenge');
  return { status: result.status, error: data.error };
});

await step(3, 'Keep draft challenge private', async () => {
  const generated = expect(await startupRequest('POST', '/challenges/generate', { body: { mode: 'job', text: 'Operations analyst to review a small delivery business pilot, clean order records, and explain patterns to the founding team.', posterName: 'Unpublished full check draft' } }), 201, 'Generate private draft');
  if (!generated.challenge?.id) throw new Error(`Missing draft id: ${JSON.stringify(generated)}`);
  state.draftId = generated.challenge.id;
  const get = await request('GET', `/challenges/${state.draftId}`);
  const start = await request('POST', `/challenges/${state.draftId}/start`, { authToken: state.candidateAuthToken, body: { retry: false } });
  if (get.status !== 404 || start.status !== 404) throw new Error(`Expected GET and start to return 404; got GET ${get.status}: ${JSON.stringify(get.data)}, start ${start.status}: ${JSON.stringify(start.data)}`);
  const expiredAttempt = expect(await request('POST', `/challenges/${state.challengeId}/start`, { authToken: state.candidateAuthToken, body: { retry: true } }), 201, 'Start deadline test attempt');
  await Submission.updateOne({ _id: expiredAttempt.id }, { $set: { deadline: new Date(Date.now() - 1000) } });
  const expiredAnswer = await request('POST', `/submissions/${expiredAttempt.id}/answer`, { candidateToken: expiredAttempt.candidateToken, body: { answer: 'This answer is long enough but the server deadline has passed.' } });
  const expiredState = await request('GET', `/submissions/${expiredAttempt.id}`, { candidateToken: expiredAttempt.candidateToken });
  if (expiredAnswer.status !== 410 || expiredState.data.status !== 'expired' || expiredState.data.questions?.length) throw new Error(`Expired attempt was not rejected before AI: ${JSON.stringify({ expiredAnswer, expiredState })}`);
  return { draftId: state.draftId, publicGet: get.status, publicStart: start.status, expiredAnswer: expiredAnswer.status, expiredStatus: expiredState.data.status };
});

await step(4, 'Enforce challenge owner key', async () => {
  const other = expect(await request('POST', '/auth/signup', { body: {
    name: 'Other Full Check Startup', email: `other-startup-${Date.now()}@example.test`, password: 'full-check-password-123', role: 'startup',
  } }), 201, 'Create second startup account');
  state.otherStartupAuthToken = other.token;
  const wrong = await request('GET', `/challenges/${state.challengeId}/owner`, { authToken: other.token });
  if (wrong.status !== 403) throw new Error(`Other startup expected HTTP 403, got ${wrong.status}: ${JSON.stringify(wrong.data)}`);
  const correctResult = await startupRequest('GET', `/challenges/${state.challengeId}/owner`);
  const correct = expect(correctResult, 200, 'Get challenge as its owner without a local key');
  const missing = await request('PUT', `/challenges/${state.challengeId}`, { body: { title: 'No', task: 'No', timeLimitMin: 30, rubric: [], seedQuestions: [] } });
  if (missing.status !== 401) throw new Error(`Missing authentication for edit expected HTTP 401, got ${missing.status}`);
  const legacyKey = 'legacy-owner-key-for-migration-check';
  const legacy = await Challenge.create({ title: 'Legacy owner key migration check', ownerKey: legacyKey });
  const migratedResponse = expect(await startupRequest('GET', `/challenges/${legacy.id}/owner`, { ownerKey: legacyKey }), 200, 'Migrate legacy owner key');
  const migrated = await Challenge.findById(legacy.id).select('+ownerKeyHash +ownerKey').lean();
  if (migrated.ownerKey || migrated.ownerKeyHash !== hashSecret(legacyKey) || migratedResponse.ownerKey || migratedResponse.ownerKeyHash) throw new Error('Legacy owner key was not safely migrated and removed');
  return { otherStartup: wrong.status, owningAccount: correctResult.status, challengeId: correct.id, missingAuthEdit: missing.status, legacyMigrated: true };
});

await step(5, 'Toggle shortlist twice', async () => {
  const first = expect(await startupRequest('POST', `/submissions/${state.submissionId}/shortlist`, { ownerKey: state.ownerKey }), 200, 'First shortlist toggle');
  const second = expect(await startupRequest('POST', `/submissions/${state.submissionId}/shortlist`, { ownerKey: state.ownerKey }), 200, 'Second shortlist toggle');
  if (Boolean(first.shortlisted) === Boolean(second.shortlisted)) throw new Error(`Expected shortlist to flip; got ${first.shortlisted} then ${second.shortlisted}`);
  return { first: Boolean(first.shortlisted), second: Boolean(second.shortlisted) };
});

await step(6, 'Override criterion and re-sign badge', async () => {
  const criteria = state.score?.criteria || [];
  const criterion = [...criteria].filter((row) => Number(row.weight) > 0).sort((a, b) => Number(b.weight) - Number(a.weight)).find((row) => {
    const sum = criteria.reduce((total, item) => total + Number(item.points || 0), 0);
    const before = Number(state.score.total);
    return [0, Number(row.weight), Number(row.weight) / 2].some((value) => Math.round(sum - Number(row.points || 0) + value) !== before);
  });
  if (!criterion) throw new Error(`No positive-weight criterion found in score: ${JSON.stringify(state.score)}`);
  const before = Number(state.score.total);
  const denied = await startupRequest('POST', `/submissions/${state.submissionId}/override`, { ownerKey: 'wrong-owner-key', body: { criterion: criterion.name, points: 0 } });
  if (denied.status !== 403) throw new Error(`Invalid owner override expected 403, got ${denied.status}`);
  const sum = criteria.reduce((total, item) => total + Number(item.points || 0), 0);
  const points = [0, Number(criterion.weight), Number(criterion.weight) / 2].find((value) => Math.round(sum - Number(criterion.points || 0) + value) !== before);
  const result = expect(await startupRequest('POST', `/submissions/${state.submissionId}/override`, { ownerKey: state.ownerKey, body: { criterion: criterion.name, points, note: 'Full-check override validation.' } }), 200, 'Override criterion');
  if (Number(result.score?.total) === before) throw new Error(`Override did not change total from ${before}: ${JSON.stringify(result.score)}`);
  const adjusted = result.score?.criteria?.find((row) => row.name === criterion.name);
  if (!adjusted?.overridden || Number(adjusted.points) !== points) throw new Error(`Override not reflected in criterion: ${JSON.stringify(adjusted)}`);
  state.score = result.score;
  if (state.badgeId) {
    state.badgePublic = Number(result.score.total) >= BADGE_ISSUE_THRESHOLD;
    if (!state.badgePublic) {
      const revoked = await request('GET', `/badges/${state.badgeId}`);
      if (revoked.status !== 404) throw new Error(`A badge below the issuance threshold should be hidden publicly: ${JSON.stringify(revoked)}`);
      return { criterion: criterion.name, oldTotal: before, newTotal: result.score.total, overridden: adjusted.overridden, invalidOwner: denied.status, badgeChecked: true, revoked: true };
    }
    const badge = expect(await request('GET', `/badges/${state.badgeId}`), 200, 'Read adjusted badge');
    if (badge.verified !== true || Number(badge.total) !== Number(result.score.total) || badge.breakdownPublic !== false || badge.criteria.length) throw new Error(`Adjusted badge verification/privacy unexpected: ${JSON.stringify(badge)}`);
    const visibility = expect(await request('POST', `/submissions/${state.submissionId}/badge-visibility`, { candidateToken: state.candidateToken, body: { public: true } }), 200, 'Publish badge breakdown');
    const publicBreakdown = expect(await request('GET', `/badges/${state.badgeId}`), 200, 'Read public badge breakdown');
    if (visibility.public !== true || !publicBreakdown.criteria?.length) throw new Error('Candidate-published badge breakdown was not returned');
    await request('POST', `/submissions/${state.submissionId}/badge-visibility`, { candidateToken: state.candidateToken, body: { public: false } });
    const badgeDoc = await Submission.findById(state.submissionId);
    const signedName = badgeDoc.badge.name;
    badgeDoc.badge.name = `${signedName} Tampered`;
    badgeDoc.markModified('badge');
    await badgeDoc.save();
    const tampered = expect(await request('GET', `/badges/${state.badgeId}`), 200, 'Read tampered badge');
    if (tampered.verified !== false) throw new Error(`Tampered badge should return verified false: ${JSON.stringify(tampered)}`);
    badgeDoc.badge.name = signedName;
    const signature = badgeDoc.badge.signature;
    badgeDoc.badge.signature = 'not-a-valid-signature';
    badgeDoc.markModified('badge');
    await badgeDoc.save();
    const malformed = expect(await request('GET', `/badges/${state.badgeId}`), 200, 'Read malformed badge signature');
    if (malformed.verified !== false) throw new Error(`Malformed badge signature should return verified false: ${JSON.stringify(malformed)}`);
    badgeDoc.badge.signature = signature;
    badgeDoc.markModified('badge');
    await badgeDoc.save();
  }
  return { criterion: criterion.name, oldTotal: before, newTotal: result.score.total, overridden: adjusted.overridden, invalidOwner: denied.status, badgeChecked: Boolean(state.badgeId) };
});

await step(7, 'Require owner key for mentor endorsement', async () => {
  const body = { mentorName: 'Full Check Mentor', note: 'Reviewed the candidate’s pilot plan and evidence checks.' };
  const missingKey = await request('POST', `/submissions/${state.submissionId}/mentor`, { body });
  if (missingKey.status !== 401) throw new Error(`Mentor request without authentication expected HTTP 401, got ${missingKey.status}: ${JSON.stringify(missingKey.data)}`);
  const wrongOwner = await request('POST', `/submissions/${state.submissionId}/mentor`, { authToken: state.otherStartupAuthToken, body });
  if (wrongOwner.status !== 403) throw new Error(`Mentor request from another startup expected HTTP 403, got ${wrongOwner.status}`);
  const result = expect(await startupRequest('POST', `/submissions/${state.submissionId}/mentor`, { body }), 200, 'Endorse submission as owning startup');
  if (result.mentor?.name !== body.mentorName || result.mentor?.note !== body.note) throw new Error(`Mentor details missing from response: ${JSON.stringify(result.mentor)}`);
  if (state.badgeId && state.badgePublic) {
    const badge = expect(await request('GET', `/badges/${state.badgeId}`), 200, 'Read endorsed badge');
    if (badge.verified !== true || badge.mentor?.name !== body.mentorName || badge.mentor?.note !== body.note) throw new Error(`Endorsed badge mismatch: ${JSON.stringify(badge)}`);
  }
  return { missingStartupAuth: missingKey.status, otherStartup: wrongOwner.status, mentor: result.mentor, badgeChecked: Boolean(state.badgeId) };
});

await step(8, 'Request human re-review', async () => {
  const denied = await request('POST', `/submissions/${state.submissionId}/rereview`);
  if (denied.status !== 403) throw new Error(`Unauthenticated re-review expected 403, got ${denied.status}`);
  const result = expect(await request('POST', `/submissions/${state.submissionId}/rereview`, { candidateToken: state.candidateToken }), 200, 'Request re-review');
  if (result.rereviewRequested !== true) throw new Error(`Expected rereviewRequested true: ${JSON.stringify(result)}`);
  return { rereviewRequested: result.rereviewRequested };
});

await step(9, 'Return skill-gap guide', async () => {
  const denied = await request('POST', `/submissions/${state.submissionId}/skill-gap`);
  if (denied.status !== 403) throw new Error(`Unauthenticated skill-gap expected 403, got ${denied.status}`);
  const result = expect(await request('POST', `/submissions/${state.submissionId}/skill-gap`, { candidateToken: state.candidateToken }), 200, 'Get skill-gap guide');
  if (!Array.isArray(result.gaps)) throw new Error(`Expected gaps array: ${JSON.stringify(result)}`);
  return { gaps: result.gaps.length };
});

await step(10, 'List approved public feed challenges', async () => {
  const result = expect(await request('GET', '/challenges'), 200, 'Get public challenge feed');
  if (!Array.isArray(result)) throw new Error(`Expected a challenge list: ${JSON.stringify(result)}`);
  const founder = result.find((challenge) => challenge.id === state.challengeId);
  if (!founder || founder.mode !== 'idea') throw new Error(`Founder Mode challenge missing from feed: ${JSON.stringify(result)}`);
  const smokeJob = result.find((challenge) => challenge.title === 'Smoke test: explain a sales trend');
  if (result.some((challenge) => challenge.id === state.draftId)) throw new Error(`Unpublished draft appeared in feed: ${JSON.stringify(result)}`);
  const publicChallenge = await request('GET', `/challenges/${state.challengeId}`);
  if (publicChallenge.status !== 200 || publicChallenge.data.seedQuestions || publicChallenge.data.sourceText || publicChallenge.data.ownerKeyHash || publicChallenge.data.rubric?.some((item) => 'weight' in item)) throw new Error(`Public challenge exposed private fields: ${JSON.stringify(publicChallenge.data)}`);
  return { founderModeListed: true, smokeJobListed: Boolean(smokeJob), draftExcluded: true, listed: result.length };
});

await step(11, 'Check mock grading semantics, exact evidence, and score consistency', async () => {
  process.env.AI_MOCK = '1';
  process.env.GRADE_RUNS = '3';
  const challenge = { title: 'Sales analysis', skill: 'Data analysis', task: 'Analyze weekly sales trends and validate a measurable recommendation.', rubric: [
    { name: 'Task understanding', weight: 30, description: 'Interprets the goal and constraints.' },
    { name: 'Practical execution', weight: 30, description: 'Presents a feasible analysis.' },
    { name: 'Reasoning and trade-offs', weight: 25, description: 'Explains assumptions, evidence, and trade-offs.' },
    { name: 'Clear communication', weight: 15, description: 'Communicates findings clearly.' },
  ] };
  const answer = 'I would compare weekly revenue by product and channel, check duplicate orders, and test whether promotions explain the sales change. I would verify the query against the source report and repeat the comparison on another week before recommending a change.';
  const defense = [{ q: 'What would you test?', a: 'I would validate the query against the source report and compare another week to check if the trend repeats.' }];
  const [base, padded] = await Promise.all([
    gradeSubmission(challenge, answer, defense),
    gradeSubmission(challenge, `${answer} ${'context '.repeat(80)}`, defense),
  ]);
  const sum = base.criteria.reduce((total, item) => total + item.points, 0);
  if (Math.abs(base.total - Math.round(sum)) > 0 || Math.abs(base.total - padded.total) > 4) throw new Error(`Length-only padding altered score or total mismatch: ${base.total}, ${padded.total}, sum=${sum}`);
  if (base.criteria.some((item) => item.evidence.some((quote) => !evidencePresent(quote, answer)))) throw new Error('Mock grader returned evidence not present in the answer');
  if (evidencePresent('compare weekly revenue by product and channel plus invented detail', answer)) throw new Error('Evidence checker accepted approximate overlap instead of an exact quote');
  if (!Number.isFinite(base.variance) || base.flagged !== (base.variance >= 25)) throw new Error(`Variance flag is inconsistent: ${JSON.stringify(base)}`);
  return { base: base.total, padded: padded.total, variance: base.variance, flagged: base.flagged, exactEvidenceOnly: true };
});

if (failures.length) {
  console.error(`Full check failed: ${failures.length} step(s) did not pass.`);
  process.exitCode = 1;
} else {
  console.log(`All ${totalSteps} full-check steps passed.`);
}
await mongoose.disconnect();
