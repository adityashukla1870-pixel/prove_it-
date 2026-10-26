import { Router } from 'express';
import { Challenge, Submission } from '../models.js';
import { requireOwner, requireRole } from '../middleware.js';
import { asyncHandler } from '../util.js';
import { generateChallenge } from '../graders.js';
import crypto from 'crypto';
import { hashSecret } from '../util.js';

const router = Router();
const challengeView = (challenge) => {
  const value = challenge.toObject();
  value.id = String(value._id);
  delete value._id;
  delete value.__v;
  delete value.ownerKey;
  delete value.ownerKeyHash;
  delete value.ownerUserId;
  return value;
};
const weightsTotal = (rubric) => rubric.reduce((sum, criterion) => sum + Number(criterion.weight), 0);

router.get('/', asyncHandler(async (req, res) => {
  const challenges = await Challenge.find({ status: 'live' })
    .sort({ createdAt: -1 })
    .select('title mode skill level timeLimitMin createdAt')
    .lean();
  res.json(challenges.map((challenge) => ({
    id: String(challenge._id),
    title: challenge.title,
    mode: challenge.mode,
    skill: challenge.skill,
    level: challenge.level,
    timeLimitMin: challenge.timeLimitMin,
    createdAt: challenge.createdAt,
  })));
}));

router.post('/generate', requireRole('startup'), asyncHandler(async (req, res) => {
  const { mode, text, posterName = '' } = req.body || {};
  if (!['job', 'idea'].includes(mode)) return res.status(400).json({ error: 'Mode must be job or idea' });
  if (typeof text !== 'string' || text.trim().length < 30) return res.status(400).json({ error: 'Please provide at least 30 characters of source text' });
  if (typeof posterName !== 'string') return res.status(400).json({ error: 'Poster name must be text' });
  let draft;
  try {
    draft = await generateChallenge({ mode, text: text.trim() });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Could not generate a challenge' });
  }
  const ownerKey = crypto.randomBytes(32).toString('hex');
  const challenge = await Challenge.create({ mode, posterName: posterName.trim(), sourceText: text.trim(), ...draft, status: 'draft', ownerUserId: req.user._id, ownerKeyHash: hashSecret(ownerKey) });
  res.status(201).json({ challenge: challengeView(challenge), ownerKey });
}));

router.get('/mine', requireRole('startup'), asyncHandler(async (req, res) => {
  const challenges = await Challenge.find({ ownerUserId: req.user._id })
    .sort({ createdAt: -1 })
    .select('title mode skill level timeLimitMin status createdAt')
    .lean();
  const counts = await Submission.aggregate([
    { $match: { challengeId: { $in: challenges.map((challenge) => challenge._id) } } },
    { $group: { _id: '$challengeId', count: { $sum: 1 } } },
  ]);
  const countByChallenge = new Map(counts.map((row) => [String(row._id), row.count]));
  res.json(challenges.map((challenge) => ({
    id: String(challenge._id),
    title: challenge.title,
    mode: challenge.mode,
    skill: challenge.skill,
    level: challenge.level,
    timeLimitMin: challenge.timeLimitMin,
    status: challenge.status,
    createdAt: challenge.createdAt,
    submissionCount: countByChallenge.get(String(challenge._id)) || 0,
  })));
}));

router.get('/:id/owner', requireOwner, (req, res) => res.json(challengeView(req.challenge)));

router.put('/:id', requireOwner, asyncHandler(async (req, res) => {
  const challenge = req.challenge;
  if (challenge.status !== 'draft') return res.status(409).json({ error: 'Only draft challenges can be edited' });
  const { title, task, timeLimitMin, rubric, seedQuestions } = req.body || {};
  if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Challenge title is required' });
  if (typeof task !== 'string' || !task.trim()) return res.status(400).json({ error: 'Challenge task is required' });
  if (!Number.isInteger(Number(timeLimitMin)) || Number(timeLimitMin) < 15 || Number(timeLimitMin) > 60) return res.status(400).json({ error: 'Time limit must be between 15 and 60 minutes' });
  if (!Array.isArray(rubric) || !rubric.length || rubric.some((item) => !String(item.name || '').trim() || !String(item.description || '').trim() || !Number.isFinite(Number(item.weight)) || Number(item.weight) < 0)) {
    return res.status(400).json({ error: 'Rubric criteria need a name, description, and valid weight' });
  }
  if (weightsTotal(rubric) !== 100) return res.status(400).json({ error: 'Rubric weights must add up to exactly 100' });
  if (!Array.isArray(seedQuestions) || seedQuestions.some((item) => typeof item !== 'string')) return res.status(400).json({ error: 'Starting questions must be text values' });
  challenge.title = title.trim();
  challenge.task = task.trim();
  challenge.timeLimitMin = Number(timeLimitMin);
  challenge.rubric = rubric.map(({ name, weight, description }) => ({ name: name.trim(), weight: Number(weight), description: description.trim() }));
  challenge.seedQuestions = seedQuestions.map((question) => question.trim()).filter(Boolean);
  await challenge.save();
  res.json(challengeView(challenge));
}));

router.post('/:id/approve', requireOwner, asyncHandler(async (req, res) => {
  const challenge = req.challenge;
  if (challenge.status !== 'draft') return res.status(409).json({ error: 'Challenge is already published' });
  if (!challenge.title?.trim() || !challenge.task?.trim() || !challenge.rubric?.length || weightsTotal(challenge.rubric) !== 100) {
    return res.status(400).json({ error: 'Add a title, task, and rubric weights totaling 100 before publishing' });
  }
  challenge.status = 'live';
  await challenge.save();
  res.json(challengeView(challenge));
}));

router.get('/:id/leaderboard', requireOwner, asyncHandler(async (req, res) => {
  const submissions = await Submission.find({ challengeId: req.challenge._id, status: 'graded' }).sort({ createdAt: 1 }).lean();
  submissions.sort((a, b) => (b.score?.total || 0) - (a.score?.total || 0));
  res.json(submissions.map((row) => ({
    id: String(row._id), name: row.name, email: row.email,
    total: row.score?.total ?? 0,
    reasoning: row.score?.reasoning ?? 0,
    reasoningMax: row.score?.reasoningMax ?? 0,
    authenticity: row.score?.authenticity?.level ?? null,
    flagged: Boolean(row.score?.flagged),
    shortlisted: Boolean(row.shortlisted),
    rereviewRequested: Boolean(row.rereviewRequested),
    mentor: row.mentor?.name ? { name: row.mentor.name, note: row.mentor.note } : null,
    badgeId: row.badgeId || null,
  })));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id).catch(() => null);
  if (!challenge || challenge.status !== 'live') return res.status(404).json({ error: 'Challenge not found or not published' });
  res.json({
    id: String(challenge._id), mode: challenge.mode, title: challenge.title,
    skill: challenge.skill, level: challenge.level, timeLimitMin: challenge.timeLimitMin,
    task: challenge.task,
    rubric: challenge.rubric.map(({ name, description }) => ({ name, description })),
    status: challenge.status,
  });
}));

router.post('/:id/start', requireRole('candidate'), asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id).catch(() => null);
  if (!challenge || challenge.status !== 'live') return res.status(404).json({ error: 'Challenge not found or not published' });
  const { retry = false } = req.body || {};
  const name = req.user ? req.user.name : req.body?.name;
  const email = req.user ? req.user.email : req.body?.email;
  if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ error: 'A valid email is required' });
  if (typeof retry !== 'boolean') return res.status(400).json({ error: 'Retry must be a boolean' });
  const normalizedEmail = email.trim().toLowerCase();
  if (!retry) {
    const existing = await Submission.exists({ challengeId: challenge._id, email: normalizedEmail });
    if (existing) return res.status(409).json({ error: 'Unable to start this attempt. Resume a saved session or choose a separate retry.' });
  }
  const startedAt = new Date();
  const candidateToken = crypto.randomBytes(32).toString('hex');
  const submission = await Submission.create({
    challengeId: challenge._id, ...(req.user ? { userId: req.user._id } : {}), name: name.trim(), email: normalizedEmail,
    startedAt, deadline: new Date(startedAt.getTime() + challenge.timeLimitMin * 60_000), status: 'started', candidateTokenHash: hashSecret(candidateToken),
  });
  res.status(201).json({ ...submissionView(submission), candidateToken });
}));

export function submissionView(submission) {
  const value = submission.toObject ? submission.toObject() : { ...submission };
  value.id = String(value._id || value.id);
  value.challengeId = String(value.challengeId?._id || value.challengeId);
  delete value._id;
  delete value.__v;
  delete value.candidateTokenHash;
  delete value.ownerKey;
  delete value.ownerKeyHash;
  return value;
}

export default router;
