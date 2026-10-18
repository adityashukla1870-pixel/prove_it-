import { Router } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Challenge, Submission, User } from '../models.js';
import { requireUser } from '../middleware.js';
import { asyncHandler, hashPassword, hashSecret, verifyPassword } from '../util.js';
import { isPubliclyValidBadge } from '../badge-state.js';
import { createFixedWindowLimiter } from '../rate-limit.js';
import { ACCOUNT_ROLES, getAccountRole } from '../roles.js';

const router = Router();
const windowMs = 15 * 60 * 1000;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const failedLoginByIdentity = createFixedWindowLimiter({ windowMs, maxAttempts: 5, maxEntries: 10000 });
const failedLoginByIp = createFixedWindowLimiter({ windowMs, maxAttempts: 25, maxEntries: 5000 });
const signupByIp = createFixedWindowLimiter({ windowMs, maxAttempts: 10, maxEntries: 5000 });

const requestIp = (req) => String(req.ip || req.socket?.remoteAddress || 'unknown');

function userView(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    headline: user.headline || '',
    college: user.college || '',
    city: user.city || '',
    bio: user.bio || '',
    linkedin: user.linkedin || '',
    github: user.github || '',
    role: getAccountRole(user.role),
    showOnLeaderboard: user.showOnLeaderboard,
    createdAt: user.createdAt,
  };
}

function addSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  user.sessions.push({ hash: hashSecret(token), createdAt: new Date() });
  user.sessions.sort((left, right) => right.createdAt - left.createdAt);
  user.sessions = user.sessions.slice(0, 5);
  return token;
}

router.post('/signup', asyncHandler(async (req, res) => {
  if (!signupByIp.consume(requestIp(req))) return res.status(429).json({ error: 'Too many account creation attempts. Try again in a few minutes.' });
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body.password;
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: 'Name must be between 2 and 80 characters' });
  if (!emailPattern.test(email)) return res.status(400).json({ error: 'Please provide a valid email address' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters' });
  if (!ACCOUNT_ROLES.includes(role)) return res.status(400).json({ error: 'Please choose candidate or startup as your account type' });
  if (body.showOnLeaderboard !== undefined && typeof body.showOnLeaderboard !== 'boolean') return res.status(400).json({ error: 'showOnLeaderboard must be a boolean' });
  if (await User.exists({ email })) return res.status(409).json({ error: 'Unable to create an account with these details' });

  const user = new User({ name, email, role, passwordHash: hashPassword(password), showOnLeaderboard: body.showOnLeaderboard ?? false });
  const token = addSession(user);
  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Unable to create an account with these details' });
    throw error;
  }
  res.status(201).json({ token, user: userView(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  const ip = requestIp(req);
  const key = `${ip}|${email}`;
  if (failedLoginByIdentity.isBlocked(key) || failedLoginByIp.isBlocked(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const user = emailPattern.test(email) ? await User.findOne({ email }).select('+passwordHash +sessions') : null;
  if (!user || !verifyPassword(password, user.passwordHash)) {
    failedLoginByIdentity.record(key);
    failedLoginByIp.record(ip);
    return res.status(401).json({ error: 'Incorrect email or password' });
  }

  failedLoginByIdentity.reset(key);
  failedLoginByIp.reset(ip);
  const token = addSession(user);
  await user.save();
  res.json({ token, user: userView(user) });
}));

router.post('/logout', requireUser, asyncHandler(async (req, res) => {
  req.user.sessions = req.user.sessions.filter((session) => session.hash !== req.authTokenHash);
  await req.user.save();
  res.json({ ok: true });
}));

router.get('/me', requireUser, asyncHandler(async (req, res) => {
  const submissions = await Submission.find({ userId: req.user._id }).sort({ startedAt: -1 }).lean();
  // A legacy/imported submission can contain a missing or malformed challenge
  // reference. It should not make session restoration fail for the whole app.
  const challengeIds = [...new Set(
    submissions
      .map((submission) => String(submission.challengeId || ''))
      .filter((challengeId) => mongoose.isValidObjectId(challengeId)),
  )];
  const challenges = challengeIds.length ? await Challenge.find({ _id: { $in: challengeIds } }).select('title skill').lean() : [];
  const challengeById = new Map(challenges.map((challenge) => [String(challenge._id), challenge]));
  const attempts = submissions.map((submission) => {
    const challenge = challengeById.get(String(submission.challengeId));
    const publiclyValidBadge = isPubliclyValidBadge(submission);
    return {
      submissionId: String(submission._id),
      challengeId: String(submission.challengeId),
      challengeTitle: challenge?.title || '',
      skill: challenge?.skill || '',
      status: submission.status,
      total: submission.score?.total ?? null,
      level: publiclyValidBadge ? submission.badge?.level || null : null,
      badgeId: publiclyValidBadge ? submission.badgeId : null,
      authenticity: submission.score?.authenticity?.level || null,
      issuedAt: publiclyValidBadge ? submission.badge?.issuedAt || null : null,
      mentor: publiclyValidBadge ? submission.badge?.mentor?.name || null : null,
      startedAt: submission.startedAt,
    };
  });
  const graded = submissions.filter((submission) => submission.status === 'graded' && Number.isFinite(Number(submission.score?.total)));
  const totals = graded.map((submission) => Number(submission.score.total));
  res.json({
    user: userView(req.user),
    attempts,
    stats: {
      attempts: attempts.length,
      badges: attempts.filter((attempt) => attempt.badgeId).length,
      bestScore: totals.length ? Math.max(...totals) : null,
      averageScore: totals.length ? Math.round(totals.reduce((sum, total) => sum + total, 0) / totals.length) : null,
    },
  });
}));

router.put('/me', requireUser, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const limits = { name: 80, headline: 120, college: 120, city: 80, bio: 500, linkedin: 200, github: 200 };
  for (const [field, max] of Object.entries(limits)) {
    if (!Object.hasOwn(body, field)) continue;
    if (typeof body[field] !== 'string') return res.status(400).json({ error: `${field} must be text` });
    const value = body[field].trim();
    if (value.length > max || (field === 'name' && value.length < 2)) {
      return res.status(400).json({ error: field === 'name' ? 'Name must be between 2 and 80 characters' : `${field} must be at most ${max} characters` });
    }
    if (['linkedin', 'github'].includes(field) && value && !value.startsWith('https://')) {
      return res.status(400).json({ error: `${field} must be empty or start with https://` });
    }
    req.user[field] = value;
  }
  if (Object.hasOwn(body, 'showOnLeaderboard')) {
    if (typeof body.showOnLeaderboard !== 'boolean') return res.status(400).json({ error: 'showOnLeaderboard must be a boolean' });
    req.user.showOnLeaderboard = body.showOnLeaderboard;
  }
  await req.user.save();
  res.json({ user: userView(req.user) });
}));

export default router;
