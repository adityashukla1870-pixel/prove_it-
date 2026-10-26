import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import challenges from './routes/challenges.js';
import submissions from './routes/submissions.js';
import badges from './routes/badges.js';
import auth from './routes/auth.js';
import leaderboard from './routes/leaderboard.js';
import { Challenge, User } from './models.js';
import { hashSecret } from './util.js';
import { configuredAdminEmails } from './middleware.js';
import admin from './routes/admin.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, mock: process.env.AI_MOCK === '1' }));
app.use('/api/challenges', challenges);
app.use('/api/submissions', submissions);
app.use('/api/badges', badges);
app.use('/api/auth', auth);
app.use('/api/leaderboard', leaderboard);
app.use('/api/admin', admin);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/proveit')
  .then(async () => {
    // Accounts created before roles were introduced were candidate accounts; migrate them to the least-privileged role.
    await User.updateMany({ role: { $exists: false } }, { $set: { role: 'candidate' } });
    const adminEmails = configuredAdminEmails();
    await User.updateMany({ email: { $in: adminEmails } }, { $set: { role: 'admin' } });
    await User.updateMany({ role: 'admin', email: { $nin: adminEmails } }, { $set: { role: 'candidate' } });
    const legacy = await Challenge.find({ ownerKey: { $type: 'string' } }).select('+ownerKey +ownerKeyHash');
    for (const challenge of legacy) {
      if (!challenge.ownerKeyHash) challenge.ownerKeyHash = hashSecret(challenge.ownerKey);
      challenge.ownerKey = undefined;
      challenge.set('ownerKey', undefined);
      await challenge.save();
    }
    app.listen(port, () => console.log(`ProveIt API on :${port}`));
  })
  .catch((e) => {
    console.error('Mongo connection failed:', e.message);
    process.exit(1);
  });
