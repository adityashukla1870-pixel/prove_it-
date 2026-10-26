import mongoose from 'mongoose';

const { Schema } = mongoose;

const challengeSchema = new Schema(
  {
    mode: { type: String, enum: ['job', 'idea'], default: 'job' },
    posterName: String,
    sourceText: String,
    title: String,
    skill: String,
    level: String,
    timeLimitMin: { type: Number, default: 30 },
    task: String,
    rubric: [{ _id: false, name: String, weight: Number, description: String }],
    seedQuestions: [String],
    status: { type: String, enum: ['draft', 'live'], default: 'draft' },
    // New challenges are owned by the authenticated startup. Legacy records
    // can still be opened with their owner key and are migrated on use.
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    ownerKeyHash: { type: String, select: false },
    // Temporary compatibility for legacy records. Middleware migrates a valid key and unsets it.
    ownerKey: { type: String, select: false },
  },
  { timestamps: true },
);
challengeSchema.index({ status: 1, createdAt: -1 });

const submissionSchema = new Schema(
  {
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    name: String,
    email: String,
    startedAt: Date,
    deadline: Date,
    late: { type: Boolean, default: false },
    answer: { type: String, default: '' },
    questions: [String],
    qa: [{ _id: false, q: String, a: String }],
    status: { type: String, enum: ['started', 'answered', 'graded', 'expired'], default: 'started' },
    candidateTokenHash: { type: String, select: false },
    score: Schema.Types.Mixed,
    shortlisted: { type: Boolean, default: false },
    rereviewRequested: { type: Boolean, default: false },
    mentor: { name: String, note: String, at: Date },
    badge: Schema.Types.Mixed,
    badgeId: { type: String, index: true, sparse: true },
    badgeStatus: { type: String, enum: ['valid', 'revoked'] },
    badgeRevokedAt: Date,
    badgeEvents: [{ _id: false, type: { type: String }, reason: String, at: Date, total: Number, badgeId: String }],
    scoreOverrides: [{ _id: false, criterion: String, previousPoints: Number, newPoints: Number, note: String, at: Date }],
    badgeBreakdownPublic: { type: Boolean, default: false },
  },
  { timestamps: true },
);
submissionSchema.index({ createdAt: -1, status: 1 });
submissionSchema.index({ status: 1, rereviewRequested: 1 });
submissionSchema.index({ status: 1, 'score.flagged': 1 });
submissionSchema.index({ badgeStatus: 1, badgeId: 1 });

const userSchema = new Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    sessions: { type: [{ hash: String, createdAt: Date }], select: false },
    headline: { type: String, default: '' },
    college: { type: String, default: '' },
    city: { type: String, default: '' },
    bio: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    github: { type: String, default: '' },
    role: { type: String, enum: ['candidate', 'startup', 'admin'], default: 'candidate' },
    showOnLeaderboard: { type: Boolean, default: false },
  },
  { timestamps: true },
);
userSchema.index({ role: 1, createdAt: -1 });

const adminAuditSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  details: { days: { type: Number } },
}, { timestamps: { createdAt: true, updatedAt: false } });
adminAuditSchema.index({ createdAt: -1 });
adminAuditSchema.pre('save', function preventAuditRewrite(next) {
  if (!this.isNew) return next(new Error('Admin audit records are append-only'));
  next();
});
for (const operation of ['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  adminAuditSchema.pre(operation, function preventAuditMutation() {
    throw new Error('Admin audit records are append-only');
  });
}

export const Challenge = mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema);
export const Submission = mongoose.models.Submission || mongoose.model('Submission', submissionSchema);
export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const AdminAudit = mongoose.models.AdminAudit || mongoose.model('AdminAudit', adminAuditSchema);
