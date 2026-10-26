# ProveIt

ProveIt is a two-part application for evaluating candidates through practical work and a spoken follow-up. Candidates complete a timed task, defend their answer, and can receive a score and a shareable verification badge. The repository keeps the React frontend and the Node API in separate folders.

## Repository layout

```text
prove it/
├── frontend/                 React 18 + Vite client
│   ├── src/
│   │   ├── components/       Candidate panel and defense step
│   │   ├── lib/              API client, local storage, shared hooks
│   │   └── pages/            Home, challenge, candidate, result, badge pages
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── backend/                  Express + Mongoose API
    ├── src/
    │   ├── routes/           Challenge, submission, and badge route modules
    │   ├── middleware.js     Database loaders and owner-key checks
    │   ├── models.js         Challenge and submission schemas
    │   ├── server.js          Express app and MongoDB startup
    │   └── util.js            Shared AI/data helpers
    ├── .env                  Local configuration and secrets
    ├── .env.example          Configuration template
    └── package.json
```

## Requirements

- Node.js 20 or newer (required by the current secure React Router release)
- npm
- MongoDB running locally or a MongoDB URI you can access

## First-time setup

Install each app’s dependencies from its own folder:

```sh
cd backend
npm install
cd ../frontend
npm install
```

The backend reads configuration from `backend/.env`. A local `.env` is already present in this checkout. For a fresh checkout, create it from the template:

```sh
cp backend/.env.example backend/.env
```

Set a private, long random value for `BADGE_SECRET` before using real badges. Keep `.env` private and do not commit it. The current local configuration uses `AI_MOCK=1` and leaves provider credentials empty.

The demo seed is deliberately more restrictive than normal local development. Run it only with a loopback MongoDB URI and explicit confirmations, for example `PROVEIT_ENV=local PROVEIT_SEED_CONFIRM=LOCAL_DEMO AI_MOCK=1 npm run seed` from `backend`. `AI_MOCK=1` by itself is not sufficient, and remote/production MongoDB URIs are rejected. Demo passwords and owner keys printed by the script are development-only.

### Environment variables

| Variable | Purpose | Default/template value |
| --- | --- | --- |
| `PORT` | Backend HTTP port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/proveit` |
| `BADGE_SECRET` | Secret used to sign/verify badges | Set a long random secret |
| `PUBLIC_URL` | Public frontend origin used by the backend | `http://localhost:5173` |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Primary OpenAI-compatible AI provider | Empty in the template |
| `AI2_BASE_URL`, `AI2_API_KEY`, `AI2_MODEL` | Optional fallback provider | Empty in the template |
| `AI3_BASE_URL`, `AI3_API_KEY`, `AI3_MODEL` | Optional third provider | Empty in the template |
| `AI_MOCK` | `1` uses canned AI responses; `0` allows provider calls | `1` for local demo setup |
| `AI_FALLBACK_MOCK` | Fall back to canned responses if all providers fail | `1` |
| `GRADE_RUNS` | Number of grading runs used for comparison | `3` |
| `AI_TIMEOUT_MS` | Timeout for an AI request | `45000` |

Provider base URLs in `.env.example` are examples; check the provider’s current documentation before configuring a live integration.

## Run locally

Start MongoDB first. Then run the backend in one terminal:

```sh
cd backend
npm run dev
```

Start the frontend in another terminal:

```sh
cd frontend
npm run dev
```

Vite serves the client at [http://localhost:5173](http://localhost:5173) and proxies `/api` requests to `http://localhost:5000`. The backend listens on port 5000 by default.

The frontend can also use a different API origin by setting `VITE_API_URL` in the frontend environment; leave it empty for the local Vite proxy.

Login and signup abuse protection uses bounded in-memory fixed-window counters. This is suitable for the existing single-instance/local setup; deployments with multiple API instances should place equivalent rate limiting at the shared edge or use shared storage so limits apply across instances.

## Health check

```sh
curl http://localhost:5000/api/health
```

Expected response with `AI_MOCK=1`:

```json
{"ok":true,"mock":true}
```

The server waits for a successful MongoDB connection before it starts listening. If MongoDB is unavailable, startup reports a `Mongo connection failed` message and exits; the health endpoint will not be available until the database is reachable.

## Admin access

Admin accounts are provisioned through the backend-only `ADMIN_EMAILS` allowlist. Create the operator account through normal signup first, add its exact email to `ADMIN_EMAILS` in `backend/.env`, then restart the API and sign in again. Startup promotes matching existing users and demotes admin accounts removed from the list. Admin cannot be selected at signup.

The read-only `/admin` overview is backed by `GET /api/admin/overview` and supports 7, 30, and 90-day activity windows. It reports aggregate account, challenge, submission, review, and badge-status counts. Dashboard reads are recorded in the `AdminAudit` collection. It does not expose candidate work or contact details; AI mode reports configuration only, not provider uptime.

## Frontend routes

| Route | Purpose |
| --- | --- |
| `/` | Public product landing page with authentication entry points |
| `/login` / `/register` | Authentication; registration requires a candidate or startup role |
| `/feed` / `/candidate/dashboard` | Candidate opportunities and progress |
| `/startup/dashboard` | Startup-owned challenge list and posting entry point |
| `/post` | Startup-only challenge creation |
| `/review/:id` | Startup-only review and publish flow |
| `/dashboard/:id` | Startup-only candidate review, shortlist, score adjustment, and endorsement |
| `/c/:id` | Candidate-only task and timed answer flow |
| `/result/:sid` | Candidate-only score, evidence, and next steps |
| `/badge/:badgeId` | Public badge verification page |
| `/profile` | Authenticated profile, statistics, and attempt history |
| `/leaderboard` | Public opt-in verified-badge rankings |
| `/admin` | Allowlisted admin-only aggregate monitoring dashboard |

Candidates and startups use the same authentication/session system, but the server-stored role selects the dashboard and API permissions. Existing users without a role are treated as candidates through the controlled schema default, so they are not locked out or promoted to startup accounts. New challenges also store their owning startup user ID; the existing owner key remains required for owner review routes and is stored in browser local storage alongside candidate sessions.

## Current implementation status

The Express app, MongoDB models, owner-key middleware, CORS/JSON setup, and health endpoint are implemented. The API includes challenge generation and publishing, candidate submissions and follow-up grading, owner review actions, skill-gap plans, and signed public badges. Set `AI_MOCK=1` for a demo without provider credentials; set `AI_FALLBACK_MOCK=1` to allow mock responses when configured providers fail.

## Troubleshooting

- **`Mongo connection failed: connect ECONNREFUSED 127.0.0.1:27017`**: Start MongoDB or update `MONGO_URI` in `backend/.env`.
- **Health check cannot connect to port 5000**: Confirm the backend started successfully and that `PORT` is not in use by another process.
- **Health response says `"mock":false`**: Set `AI_MOCK=1` in `backend/.env` and restart the backend. The health field only reports this setting; it does not confirm that AI providers are configured.
- **Frontend API requests return 404**: Confirm the backend started successfully and the frontend is using the correct API origin.
