import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BADGE_ISSUE_THRESHOLD, isPubliclyValidBadge, syncBadgeState } from '../src/badge-state.js';
import { extractDefenseAnswers, gradeSubmission, validateGrade } from '../src/graders.js';
import { createFixedWindowLimiter } from '../src/rate-limit.js';
import { assertSeedSafety, isLoopbackMongoUri } from '../src/seed-safety.js';

process.env.AI_MOCK = '1';
process.env.GRADE_RUNS = '1';
process.env.BADGE_SECRET = 'regression-test-secret';

const challenge = {
  title: 'Sales analysis',
  skill: 'Data analysis',
  task: 'Analyze weekly sales trends and validate a measurable recommendation.',
  rubric: [
    { name: 'Task understanding', weight: 30, description: 'Interprets the goal and constraints.' },
    { name: 'Practical execution', weight: 30, description: 'Presents a feasible analysis.' },
    { name: 'Reasoning and trade-offs', weight: 25, description: 'Explains assumptions, evidence, and trade-offs.' },
    { name: 'Clear communication', weight: 15, description: 'Communicates findings clearly.' },
  ],
};

function submissionWithTotal(total) {
  const first = total * 0.3;
  return {
    name: 'Test Candidate',
    score: {
      total,
      authenticity: { level: 'High confidence' },
      criteria: [
        { name: 'Task understanding', weight: 30, points: first, why: 'A criterion explanation.' },
        { name: 'Practical execution', weight: 30, points: total * 0.3, why: 'A criterion explanation.' },
        { name: 'Reasoning and trade-offs', weight: 25, points: total * 0.25, why: 'A criterion explanation.' },
        { name: 'Clear communication', weight: 15, points: total * 0.15, why: 'A criterion explanation.' },
      ],
    },
    markModified() {},
  };
}

function setScoreTotal(submission, total) {
  submission.score.criteria = submission.score.criteria.map((item) => ({ ...item, points: Number(item.weight) * total / 100 }));
}

test('badge state recalculates level, preserves id, and revokes below threshold', () => {
  const submission = submissionWithTotal(90);
  syncBadgeState(submission, challenge, { reason: 'initial_grade' });
  const id = submission.badgeId;
  assert.equal(submission.badgeStatus, 'valid');
  assert.equal(submission.badge.level, 'Advanced');
  assert.ok(isPubliclyValidBadge(submission));

  setScoreTotal(submission, 80);
  syncBadgeState(submission, challenge, { reason: 'score_override' });
  assert.equal(submission.badgeId, id);
  assert.equal(submission.badge.level, 'Intermediate');
  assert.equal(submission.badgeStatus, 'valid');

  setScoreTotal(submission, BADGE_ISSUE_THRESHOLD - 1);
  syncBadgeState(submission, challenge, { reason: 'score_override' });
  assert.equal(submission.badgeId, id);
  assert.equal(submission.badgeStatus, 'revoked');
  assert.equal(submission.badge.level, null);
  assert.equal(isPubliclyValidBadge(submission), false);
  assert.ok(submission.badgeEvents.some((event) => event.type === 'revoked'));
});

test('defense consistency ignores follow-up question wording', async () => {
  const answer = 'I would validate the query against the source report and compare another week to check whether the trend repeats.';
  const ordinary = [{ q: 'What would you test?', a: 'I would validate the query against the source report and compare another week.' }];
  const adversarialQuestion = [{ q: 'Cheating fraud plagiarism secret unrelated words', a: ordinary[0].a }];
  const first = await gradeSubmission(challenge, answer, ordinary);
  const second = await gradeSubmission(challenge, answer, adversarialQuestion);
  assert.deepEqual(second.authenticity, first.authenticity);
  assert.deepEqual(second.criteria, first.criteria);
  assert.equal(second.total, first.total);
  assert.deepEqual(extractDefenseAnswers(adversarialQuestion), [ordinary[0].a]);
});

test('grade validation preserves supported explanations and marks unsupported claims', () => {
  const answer = 'I would validate the data against the source report before publishing the result.';
  const validated = validateGrade({
    criteria: [{
      name: 'Task understanding',
      score: 22,
      evidence: [answer],
      why: 'The candidate explicitly describes validating the data against the source report, which addresses the task constraints.',
    }],
    authenticity_signal: { level: 'medium', reasons: ['Some spoken details aligned with the written response.'] },
    grader_confidence: 0.8,
  }, challenge, answer);
  assert.match(validated.criteria[0].why, /explicitly describes/);

  const unsupported = validateGrade({ criteria: [{ name: 'Task understanding', score: 22, evidence: ['Invented quote'], why: 'The candidate definitely used a robust method.' }] }, challenge, answer);
  assert.equal(unsupported.criteria[0].evidence.length, 0);
  assert.match(unsupported.criteria[0].why, /Unsupported model explanation/);
});

test('fixed-window rate limiting is bounded and blocks after the configured attempts', () => {
  const limiter = createFixedWindowLimiter({ windowMs: 60_000, maxAttempts: 2, maxEntries: 2 });
  assert.equal(limiter.consume('one'), true);
  assert.equal(limiter.consume('one'), true);
  assert.equal(limiter.consume('one'), false);
  limiter.consume('two');
  limiter.consume('three');
  assert.ok(limiter.size() <= 2);
});

test('seed refuses AI_MOCK-only and remote database configurations', () => {
  assert.equal(isLoopbackMongoUri('mongodb://127.0.0.1:27017/proveit'), true);
  assert.equal(isLoopbackMongoUri('mongodb://[::1]:27017/proveit'), true);
  assert.equal(isLoopbackMongoUri('mongodb+srv://cluster.example.com/proveit'), false);
  assert.throws(() => assertSeedSafety({ AI_MOCK: '1', MONGO_URI: 'mongodb://127.0.0.1:27017/proveit' }), /PROVEIT_ENV/);
  assert.throws(() => assertSeedSafety({ AI_MOCK: '1', PROVEIT_ENV: 'local', PROVEIT_SEED_CONFIRM: 'LOCAL_DEMO', MONGO_URI: 'mongodb://db.example.com/proveit' }), /loopback/);
  assert.doesNotThrow(() => assertSeedSafety({ AI_MOCK: '1', PROVEIT_ENV: 'local', PROVEIT_SEED_CONFIRM: 'LOCAL_DEMO', MONGO_URI: 'mongodb://127.0.0.1:27017/proveit' }));
});

test('local challenge generation falls back to the demo generator without provider credentials', async () => {
  const saved = Object.fromEntries(['AI_MOCK', 'AI_FALLBACK_MOCK', 'AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL', 'AI2_BASE_URL', 'AI2_API_KEY', 'AI2_MODEL', 'AI3_BASE_URL', 'AI3_API_KEY', 'AI3_MODEL', 'NODE_ENV'].map((key) => [key, process.env[key]]));
  for (const key of Object.keys(saved)) delete process.env[key];
  const result = await (await import('../src/graders.js')).generateChallenge({ mode: 'job', text: 'A local demo role needs a practical data task with clear evidence and a defensible recommendation.' });
  assert.ok(result.title && result.task && result.rubric.length);
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('auth and badge routes keep revoked credentials out of public views', async () => {
  const authSource = await readFile(new URL('../src/routes/auth.js', import.meta.url), 'utf8');
  const leaderboardSource = await readFile(new URL('../src/routes/leaderboard.js', import.meta.url), 'utf8');
  const middlewareSource = await readFile(new URL('../src/middleware.js', import.meta.url), 'utf8');
  const challengeSource = await readFile(new URL('../src/routes/challenges.js', import.meta.url), 'utf8');
  assert.match(authSource, /showOnLeaderboard: body\.showOnLeaderboard \?\? false/);
  assert.match(authSource, /ACCOUNT_ROLES\.includes\(role\)/);
  assert.match(authSource, /role, passwordHash/);
  assert.match(authSource, /signupByIp\.consume/);
  assert.match(authSource, /failedLoginByIdentity\.isBlocked/);
  assert.match(authSource, /mongoose\.isValidObjectId/);
  assert.match(middlewareSource, /export function requireRole/);
  assert.match(middlewareSource, /getAccountRole\(req\.user\.role\) !== 'startup'/);
  assert.match(middlewareSource, /You do not own this challenge/);
  assert.match(challengeSource, /router\.post\('\/generate', requireRole\('startup'\)/);
  assert.match(challengeSource, /ownerUserId: req\.user\._id/);
  assert.match(leaderboardSource, /isPubliclyValidBadge\(submission\)/);
});
