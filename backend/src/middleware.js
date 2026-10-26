import { Challenge, Submission, User } from './models.js';
import { asyncHandler, hashSecret, safeEqualHex } from './util.js';
import { getAccountRole } from './roles.js';

export function configuredAdminEmails() {
  return (process.env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

// Loads req.challenge from :id (404 if missing or bad id).
export const loadChallenge = asyncHandler(async (req, res, next) => {
  const ch = await Challenge.findById(req.params.id).select('+ownerKeyHash +ownerKey').catch(() => null);
  if (!ch) return res.status(404).json({ error: 'Challenge not found' });
  req.challenge = ch;
  next();
});

// Loads req.submission from :id and its req.challenge.
export const loadSubmission = asyncHandler(async (req, res, next) => {
  const sub = await Submission.findById(req.params.id).select('+candidateTokenHash').catch(() => null);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  req.submission = sub;
  req.challenge = await Challenge.findById(sub.challengeId).select('+ownerKeyHash +ownerKey');
  if (!req.challenge) return res.status(404).json({ error: 'Challenge not found' });
  next();
});

export const optionalUser = asyncHandler(async (req, res, next) => {
  req.user = null;
  req.authTokenHash = null;
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+([a-f0-9]{64})$/i);
  if (match) {
    const tokenHash = hashSecret(match[1]);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    try {
      req.user = await User.findOne({
        sessions: { $elemMatch: { hash: tokenHash, createdAt: { $gte: cutoff, $lte: now } } },
      }).select('+sessions');
      if (req.user) req.authTokenHash = tokenHash;
    } catch {
      req.user = null;
    }
  }
  next();
});

export const requireUser = [optionalUser, (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in' });
  next();
}];

export function requireRole(...roles) {
  return [...requireUser, (req, res, next) => {
    const role = getAccountRole(req.user.role);
    const configuredAdmin = role !== 'admin' || configuredAdminEmails().includes(String(req.user.email || '').toLowerCase());
    if (!configuredAdmin || !roles.includes(role)) {
      return res.status(403).json({ error: 'This account does not have permission for this area' });
    }
    next();
  }];
}

// The poster proves ownership with the header  x-owner-key: <ownerKey>
const checkOwner = asyncHandler(async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in as a startup' });
  if (getAccountRole(req.user.role) !== 'startup') return res.status(403).json({ error: 'Startup account required' });
  if (req.challenge.ownerUserId) {
    if (String(req.challenge.ownerUserId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'You do not own this challenge' });
    }
    return next();
  }
  const supplied = req.get('x-owner-key');
  if (!supplied) return res.status(403).json({ error: 'Owner key required' });
  const suppliedHash = hashSecret(supplied);
  const validHash = req.challenge.ownerKeyHash && safeEqualHex(suppliedHash, req.challenge.ownerKeyHash);
  const validLegacy = req.challenge.ownerKey && safeEqualHex(suppliedHash, hashSecret(req.challenge.ownerKey));
  if (!validHash && !validLegacy) return res.status(403).json({ error: 'Owner key required' });
  if (validLegacy && !validHash) {
    req.challenge.ownerKeyHash = suppliedHash;
    req.challenge.ownerKey = undefined;
    req.challenge.set('ownerKey', undefined);
    req.challenge.markModified('ownerKeyHash');
    await req.challenge.save();
  }
  next();
});

const checkCandidate = (req, res, next) => {
  if (req.user && getAccountRole(req.user.role) !== 'candidate') {
    return res.status(403).json({ error: 'Candidate account required' });
  }
  const supplied = req.get('x-candidate-token');
  const validToken = supplied && req.submission.candidateTokenHash
    && safeEqualHex(hashSecret(supplied), req.submission.candidateTokenHash);
  const validUser = req.user && req.submission.userId
    && String(req.user._id) === String(req.submission.userId);
  const allowed = req.user && req.submission.userId ? validUser : validToken;
  if (!allowed) return res.status(403).json({ error: 'Candidate session token required' });
  next();
};

export const requireOwner = [loadChallenge, optionalUser, checkOwner]; // routes where :id is a challenge id
export const requireOwnerOfSubmission = [loadSubmission, optionalUser, checkOwner]; // routes where :id is a submission id
export const requireCandidate = [loadSubmission, optionalUser, checkCandidate];
