[OPEN] Debug Session: login-db-timeout

Date: 2026-07-02
Symptom:

- `POST /api/login` returns `500 Internal Server Error`
- Error detail mentions `Database query timeout after 15000ms`
- User suspects rate limiting, missing indexes, or another backend bottleneck

Scope:

- Affects login flow for users
- Secondary frontend font error (`fonts.gstatic.com ... ERR_NAME_NOT_RESOLVED`) appears unrelated to the server-side login timeout

Hypotheses:

- H1: The login path is blocked on a slow database query in auth or startup schema checks.
- H2: The login request is delayed by Redis/session-store interaction rather than the credential lookup itself.
- H3: Request throttling or middleware backlog is causing the request to stall before the controller finishes.
- H4: Database pool exhaustion or connection establishment latency is causing queries to hit the 15s timeout.
- H5: Missing indexes or lock contention on auth-related tables is making one of the login queries slow.

Plan:

1. Collect runtime evidence from the running server.
2. Identify the exact query or middleware stage consuming time.
3. Confirm or reject rate limiting, indexing, Redis, and pool-contention hypotheses.
4. Apply the smallest fix supported by evidence.

Status:

- Debug file initialized.

Evidence Collected:

- Debug server is active on `http://127.0.0.1:7777`.
- Backend `GET /api/ping` responds successfully, so the API process is up.
- Direct `POST /api/login` with local default `admin/admin` succeeds.
- Instrumented DB operations observed for successful login are all sub-100ms.
- No evidence of rate limiting so far; no `429` responses observed.
- `fonts.gstatic.com ... ERR_NAME_NOT_RESOLVED` appears unrelated to backend login timeout.

Interim Hypothesis Status:

- H1: Partially plausible, but not reproduced yet. No slow query seen in the default admin flow.
- H2: Not supported so far. Session creation completed during successful login.
- H3: Not supported so far. No rate-limit evidence; backend stays responsive.
- H4: Not supported so far. Pool is healthy and DB operations complete quickly in the reproduced case.
- H5: Still plausible for a specific non-default user path or first-login path, but unconfirmed.

Next Action:


User Feedback:
- Login currently succeeds but the user is automatically logged out after about 2 minutes.
- Data loading and navigation remain very slow.
- Browser still shows external font DNS failures, which are treated as secondary noise.

New Evidence:
- Server env has `ACCESS_TOKEN_EXPIRES_IN=3mins`.
- Client was relying on bearer-token fallback after login, which aligns with logout after a short interval if refresh is not performed.
- Added client-side token refresh on `401` via `/auth/refresh` while keeping the original DB instrumentation active.

Current Conclusion:
- No runtime evidence currently supports rate limiting as the cause of the login failure.
- No runtime evidence currently supports a persistent DB outage or globally missing indexes.
- Short-lived access tokens are a confirmed contributor to the auto-logout symptom.
- Original `DB_QUERY_TIMEOUT` is still not reproduced in the instrumented default-admin path and may be specific to a particular user or data path.
