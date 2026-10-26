import { Router } from 'express';
import mongoose from 'mongoose';
import { AdminAudit, Challenge, Submission, User } from '../models.js';
import { requireRole } from '../middleware.js';
import { asyncHandler } from '../util.js';
import { createFixedWindowLimiter } from '../rate-limit.js';

const router = Router();
const overviewLimiter = createFixedWindowLimiter({ windowMs: 15 * 60 * 1000, maxAttempts: 120, maxEntries: 1000 });
router.use(requireRole('admin'), (req, res, next) => {
  if (!overviewLimiter.consume(String(req.user._id))) return res.status(429).json({ error: 'Too many admin overview requests. Try again in a few minutes.' });
  next();
});

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function seriesPipeline(start, end, filter = {}) {
  return [
    { $match: { createdAt: { $gte: start, $lte: end }, ...filter } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, value: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];
}

router.get('/overview', asyncHandler(async (req, res) => {
  const requestedDays = Number.parseInt(req.query.days, 10);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers, candidates, startups, totalChallenges, liveChallenges, draftChallenges,
    totalSubmissions, periodUsers, periodChallenges, periodAttempts, statusRows,
    userSeries, challengeSeries, submissionSeries, reviewRequests, flaggedGrades,
    overriddenSubmissions, answeredSubmissions, activeBadgeRecords, revokedBadgeRecords,
    skillRows,
  ] = await Promise.all([
    User.countDocuments({ role: { $in: ['candidate', 'startup'] } }),
    User.countDocuments({ role: 'candidate' }),
    User.countDocuments({ role: 'startup' }),
    Challenge.countDocuments({}),
    Challenge.countDocuments({ status: 'live' }),
    Challenge.countDocuments({ status: 'draft' }),
    Submission.countDocuments({}),
    User.countDocuments({ role: { $in: ['candidate', 'startup'] }, createdAt: { $gte: start, $lte: end } }),
    Challenge.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Submission.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    Submission.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', value: { $sum: 1 } } },
    ]),
    User.aggregate(seriesPipeline(start, end, { role: { $in: ['candidate', 'startup'] } })),
    Challenge.aggregate(seriesPipeline(start, end)),
    Submission.aggregate(seriesPipeline(start, end)),
    Submission.countDocuments({ status: 'graded', rereviewRequested: true }),
    Submission.countDocuments({ status: 'graded', 'score.flagged': true }),
    Submission.countDocuments({ scoreOverrides: { $exists: true, $ne: [] } }),
    Submission.countDocuments({ status: 'answered' }),
    Submission.countDocuments({ badgeId: { $type: 'string', $ne: '' }, badgeStatus: 'valid' }),
    Submission.countDocuments({ badgeId: { $type: 'string', $ne: '' }, badgeStatus: 'revoked' }),
    Challenge.aggregate([
      { $match: { status: 'live', skill: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$skill', value: { $sum: 1 } } },
      { $sort: { value: -1, _id: 1 } },
      { $limit: 6 },
    ]),
  ]);

  const status = Object.fromEntries(statusRows.map((row) => [row._id, row.value]));
  const points = new Map();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    points.set(dayKey(date), { date: dayKey(date), users: 0, challenges: 0, attempts: 0 });
  }
  for (const row of userSeries) if (points.has(row._id)) points.get(row._id).users = row.value;
  for (const row of challengeSeries) if (points.has(row._id)) points.get(row._id).challenges = row.value;
  for (const row of submissionSeries) if (points.has(row._id)) points.get(row._id).attempts = row.value;

  await AdminAudit.create({ actorId: req.user._id, action: 'overview.read', details: { days } });

  res.json({
    generatedAt: new Date().toISOString(),
    period: { days, start: start.toISOString(), end: end.toISOString() },
    health: {
      api: 'online',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      aiMode: process.env.AI_MOCK === '1' ? 'mock' : [1, 2, 3].some((index) => ['BASE_URL', 'API_KEY', 'MODEL'].every((field) => process.env[`AI${index === 1 ? '' : index}_${field}`])) ? 'configured' : 'unconfigured',
    },
    totals: {
      users: { total: totalUsers, candidates, startups },
      challenges: { total: totalChallenges, live: liveChallenges, draft: draftChallenges },
      submissions: { total: totalSubmissions },
    },
    activity: {
      users: periodUsers,
      challenges: periodChallenges,
      attempts: periodAttempts,
      graded: status.graded || 0,
      completionRate: periodAttempts ? Math.round(((status.graded || 0) / periodAttempts) * 100) : 0,
      funnel: {
        started: status.started || 0,
        awaitingDefense: status.answered || 0,
        graded: status.graded || 0,
        expired: status.expired || 0,
      },
      daily: [...points.values()],
    },
    operations: {
      reReviewRequests: reviewRequests,
      flaggedGrades: flaggedGrades,
      submissionsWithOverrides: overriddenSubmissions,
      awaitingDefense: answeredSubmissions,
      activeBadgeRecords,
      revokedBadgeRecords,
      liveChallengeSkills: skillRows.map((row) => ({ skill: row._id, count: row.value })),
    },
  });
}));

export default router;
