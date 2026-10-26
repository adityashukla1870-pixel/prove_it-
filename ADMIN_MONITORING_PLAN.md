# Admin monitoring plan

## Goal

Give authorized operators a reliable overview of product health, challenge activity, grading flow, and badge integrity. Keep candidate work private and make every privileged action attributable.

## Current baseline

The app has `candidate`, `startup`, and an explicitly provisioned `admin` role. Admin access is granted from the server-only `ADMIN_EMAILS` allowlist at API startup; signup cannot choose or claim that role. The dashboard is read-only and uses aggregate reporting endpoints. Each overview read writes an append-only audit event. Startup users remain limited to their own challenges and submissions; public leaderboard data remains opt-in.

The current database can support aggregate counts for:

- Users by role and signup period (`User.createdAt`, `User.role`).
- Challenges by draft/live status, skill, and creation period (`Challenge.status`, `Challenge.skill`, timestamps).
- Submissions by started/answered/graded/expired status, challenge, and time (`Submission.status`, `challengeId`, `createdAt`).
- Grading quality signals such as flagged scores, re-review requests, score overrides, shortlist totals, and badge validity/revocation (`score.flagged`, `rereviewRequested`, `scoreOverrides`, `shortlisted`, badge fields/events).
- Operational request and AI-provider health, once server-side telemetry is added. These signals are not currently persisted as a dashboard data source.

## Admin dashboard

Use the supplied sculptural analytics direction for the operator workspace: muted sage environment, warm alabaster cards, soft inset controls, terracotta highlights, and teal for healthy flow. The leaderboard keeps its separate midnight palette and gold/teal accents.

Recommended dashboard sections:

1. **Health strip:** API availability, database connection, grading queue/latency, AI provider error rate, and last successful aggregation refresh.
2. **Activity overview:** new users, live challenges, started submissions, completion rate, and grading turnaround over selectable 7/30/90-day windows.
3. **Submission funnel:** started → answered → graded/expired, with breakdowns by challenge skill and date; show counts and rates, not candidate content.
4. **Review and integrity queue:** re-review requests, flagged grades, outstanding owner actions, score overrides, and revoked/invalid badge counts. Link to a restricted case view only where an operator has a defined support duty.
5. **Trends:** challenge engagement and grading latency over time, with clear empty, stale-data, and partial-outage states.

## Access and data safeguards

- Add `admin` as an explicit server-stored role. Do not accept role assignment from signup or profile-update payloads; provision the first operator through a controlled deployment/admin procedure.
- Protect every admin API route with authentication and a server-side `requireRole('admin')` check. Hiding a frontend route is not authorization.
- Return aggregate/allowlisted fields by default. Do not include passwords, session/token hashes, owner keys, candidate emails, raw answers, defense answers, rubric evidence, or private badge breakdowns in analytics responses.
- Use pagination and bounded time windows for detailed support cases. Require a reason for sensitive case access and record the actor, action, target ID, timestamp, and reason in an append-only audit log.
- Keep leaderboard opt-in and badge revocation state consistent with existing public badge rules. Avoid exposing small cohort slices that could identify a person.
- Apply least-privilege access, secure session handling, rate limits, and monitoring to admin endpoints. Review retention and deletion expectations before storing new telemetry.

## Delivery sequence

1. **Security foundation:** role provisioning and authorization tests; append-only admin audit events; define operator duties and field allowlists.
2. **Telemetry and aggregate API:** add bounded, indexed aggregate queries and operational telemetry. Document metric definitions, timezone, and refresh interval; never derive live health from static mock values.
3. **Read-only dashboard:** implemented at `/admin` with the health strip, activity overview, funnel, review signals, loading/error states, and responsive layouts. Data is queried from real aggregate endpoints with bounded 7/30/90-day windows.
4. **Restricted case tools:** add only the support actions operators need, with confirmation, reason capture, and audit events.
5. **Operational review:** validate access controls and data minimization, check aggregation cost against production-sized data, then enable the admin route for provisioned accounts.

## Initial metric definitions

- **Completion rate:** graded submissions ÷ started submissions in the selected cohort; display expired submissions separately and document whether retries count as separate attempts.
- **Grading turnaround:** median time from submission answer/defense completion to graded state. Add an explicit grading-completed timestamp before using this metric; current timestamps alone do not reliably identify that transition.
- **Re-review backlog:** graded submissions with `rereviewRequested` set, minus completed review events. A completion event does not currently exist, so add one before reporting a resolved backlog.
- **Badge integrity:** valid, revoked, and missing/invalid badge state counts from the authoritative badge validation rules, not merely the presence of a badge ID.

## Acceptance criteria

- A non-admin cannot read admin analytics by calling the API directly.
- Admin analytics contain no credentials, raw candidate work, or private identity fields beyond the approved operational need.
- Every privileged case view or mutation is recorded with actor, target, time, and reason.
- Metrics reconcile to documented database definitions and show their refresh time and selected period.
- Dashboard states distinguish zero activity from an API/database failure or stale aggregation.

## Provisioning the first admin

1. Create the operator account through the normal signup flow before its email is added to the allowlist.
2. Set `ADMIN_EMAILS` in the backend environment to the exact account email (comma-separated for multiple operators).
3. Restart the API. Startup promotes existing matching accounts and demotes admin roles removed from the allowlist.
4. Sign in again so the browser receives the server's current role, then open `/admin`.

Never expose `ADMIN_EMAILS` in frontend environment variables. An allowlisted email with no existing account is not created automatically.

The overview reports stored badge status records and AI configuration mode; it does not cryptographically revalidate every badge or measure AI provider availability/latency. The app currently has no persisted grading latency or AI provider error telemetry.
