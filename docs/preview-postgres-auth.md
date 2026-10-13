# Isolated Preview authentication state

Local implementation only. No hosted migrations, credentials, Production environment variables, commits, pushes or deployments changed. This document supersedes the Redis requirement in the Phase 5/6 Preview setup instructions for the approved PostgreSQL option. Existing CMS migrations 001–007, content, images, styling and authentication route handlers remain unchanged.

## Configuration and isolation

ADMIN_STATE_BACKEND accepts only redis or postgres. An unset value retains existing Redis behavior outside Preview, including Production. An unset/empty/invalid selection in Preview fails closed. PostgreSQL additionally requires VERCEL_ENV=preview and CMS_PREVIEW_AUTH_ENABLED=1; it is rejected for Production and ordinary local development. Local integration tests emulate an isolated Preview explicitly. Production must not receive the Preview enable flag. Redis selection with a PostgreSQL enable flag is ambiguous and rejected.

PostgreSQL Preview rejects the presence of UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN or CMS_PREVIEW_REDIS_HOST, including empty values. Remove those variables from Preview scope and ensure Vercel does not inherit Production credentials through All Environments. Do not remove or modify Production-scoped variables. Supabase URL and SQL pooler username/direct hostname must match the explicit isolated project reference; cache namespace must start preview-. The region/name alone are not identifiers: use the actual project reference from portfolio-cms-preview's dashboard.

Set these server-only values in Preview after separate deployment/configuration approval:

| Variable | Required value |
| --- | --- |
| ADMIN_STATE_BACKEND | postgres |
| CMS_PREVIEW_AUTH_ENABLED | 1 |
| ADMIN_PASSCODE | Distinct random Preview credential, at least 20 characters |
| SUPABASE_DATABASE_URL | Restricted portfolio_cms_preview_app login for the isolated project's transaction pooler |
| SUPABASE_URL | https://<isolated-project-ref>.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | Isolated project's Storage server credential |
| CMS_PREVIEW_PROJECT_REF | Actual isolated 20-character project reference |
| CMS_CACHE_NAMESPACE | preview-portfolio-cms (or another unique preview- namespace) |
| CMS_REQUIRE_DATABASE | 1 (Preview already enforces this automatically) |
| SUPABASE_DATABASE_CA | Optional trusted project PEM CA if needed for verified TLS |

Vercel supplies VERCEL_ENV=preview and NODE_ENV=production. Do not override VERCEL_ENV on Production. Do not use NEXT_PUBLIC for credentials. Existing Production backend remains Redis without changing its variables. Existing Redis key formats, TTLs, command transport, session policy, cookies and failure diagnostics remain unchanged for Redis selections.

## Authentication and rate policy

lib/admin.ts retains passcode comparison, random 256-bit opaque tokens, credential-rotation binding, existing same-origin checks and cookies. Only state operations branch through the selected adapter. Neither raw session tokens nor passcodes are sent to PostgreSQL: session token SHA-256 and credential SHA-256 are stored. A successful create is required before returning a session cookie. Sessions expire exactly one hour after database creation. Reads reject expired sessions independently of cleanup; logout deletes the hashed token; credential rotation immediately invalidates existing session fingerprints.

Production-build Preview cookies remain __Host-admin-session, Secure, HttpOnly, SameSite=Strict, Path=/, one-hour max age, no Domain. Every protected CMS operation still validates its own session. CSRF checks remain on mutations/login/logout. Failed reads, writes, rate checks, role checks and database timeouts deny access; no memory store, Redis fallback or permissive behavior exists for PostgreSQL Preview. Diagnostics include only fixed categories/stages, never upstream text, request parameters, IPs, tokens, passcodes or connection strings.

The login policy remains five attempts per IP per fifteen minutes, counting all attempts. SQL maintains first-attempt fixed windows equivalent to existing Redis INCR/EXPIRE. Existing CMS operation limits match TypeScript policy: published/draft/preview/state 120, save 30, publish/restore 5, discard/upload 10, history/revision 60, public images 240, authenticated image previews 120 per minute. Protected operations increment both hashed IP and hashed session buckets; public reads use only IP buckets. All increments for an operation share one SQL transaction; an error rolls back both buckets. Counts saturate at limit+1, preventing integer overflow without allowing additional attempts. A denial still commits its rate increment, matching Redis behavior.

## SQL permissions and hosted application plan

New SQL: supabase/preview-migrations/202610120008_preview_auth.sql, intentionally outside the unchanged CMS migration directory. Apply only to portfolio-cms-preview after separate approval, after migrations 001–007. DDL is one-time and should be tracked; do not blindly replay it or run it against Production. No startup/build code applies SQL.

The migration creates portfolio_preview_auth_owner (NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS) and private preview_auth schema. The migration identity receives owner membership only to administer the schema. Both sessions and rate_buckets use ENABLE/FORCE RLS with owner-only policies and expiry indexes. The application runtime must not be a member of this owner, CMS owner or seed role; the SQL driver independently checks this before executing application queries.

Runtime grants are exactly:

```sql
GRANT USAGE ON SCHEMA preview_auth TO portfolio_cms_runtime;
GRANT EXECUTE ON FUNCTION preview_auth.create_session(text,text),
  preview_auth.read_session(text), preview_auth.revoke_session(text),
  preview_auth.consume_rate(text,text,text) TO portfolio_cms_runtime;
```

No direct table access or schema CREATE is granted. All four functions are SECURITY DEFINER, owned by the restricted auth owner and pin search_path=pg_catalog,pg_temp. PUBLIC and seed function privileges are revoked, including the default global PUBLIC execute grant for new owner functions. The owner-only bounded purge_expired function is not executable by runtime. Do not expose preview_auth through PostgREST.

Approved future sequence:

1. Review backup/source manifest, existing CMS migrations and separate Preview login/Storage configuration.
2. Under the approved isolated administration identity apply CMS 001–007, then Preview-only 008 with migration tracking and stop-on-error. Confirm Supabase administrator role-creation/membership authority first. Leave Production untouched.
3. Apply reviewed preview-logins.sql and private-images.sql if not already applied. Provision passwords securely outside source/chat. App login inherits portfolio_cms_runtime only; seed login inherits portfolio_cms_seed only. No new database connection secret is needed for auth.
4. Run the reviewed idempotent eight-project seed using the separate seed identity as documented in cms-phase-6.md. Never put the seed identity in Vercel.
5. Run cms:preview:check with securely loaded Preview variables, VERCEL_ENV=preview and CMS_PREVIEW_CHECK=isolated-preview. It now checks both CMS and auth catalogs, verified TLS/runtime identity and exact eight-project content.
6. After separate push/Preview deployment approval, run the opt-in hosted suite and manually verify login attempts, session expiry/rotation/logout, CSRF, database outage denial and multi-instance concurrency. Do not promote to Production.

Expired rows require periodic owner/admin maintenance, for example SELECT preview_auth.purge_expired(5000) under the isolated auth owner. Repeat bounded batches as needed during a maintenance window. No scheduler or cron extension has been provisioned. Expired rows cannot authenticate even if maintenance is delayed. No assets or revisions are deleted by this maintenance.

## Published content and tests

PostgreSQL Preview performs no Redis requests, including CMS rate limits and published backup writes. Preview already requires live database reads and deliberately has no Redis-backed public fallback; failure remains visible. Production's existing published Redis backup behavior is preserved. Adding a PostgreSQL copy of the same database's content would not help a database outage, so no redundant backup table is introduced. Durable source/database backups remain separate operational procedures.

Tests exercise existing Redis authentication and the actual PostgreSQL functions through restricted PGlite roles, including opaque hashes, session lifetime/rotation/revocation, concurrent requests, all CMS policies, malformed responses, partial transaction failure, RLS/grants, safe diagnostics and the existing route handlers. PGlite serializes transactions: hosted independent-connection contention remains a real integration gate, not a locally proven result. The existing driver deadline/TLS tests cover the reused transport. The opt-in hosted suite now sends concurrent invalid login attempts and checks the shared limit; it consumes the Preview login window, so wait fifteen minutes before another fresh login test. A timed-out session creation may leave an unreachable row until expiry; the client receives no cookie. An uncertain rate increment may count an attempt even if the request fails, intentionally conservative.

Database-backed rate checks increase PostgreSQL traffic and lock contention. A paused/unavailable free Supabase project blocks Preview authentication and public CMS APIs. This architecture preserves behavior but does not replace real Upstash transport tests for Production. Physical iPhone Safari, real hosted PostgreSQL/Storage, serverless concurrency and resource limits still require isolated integration testing.

## Changed files

- New adapter/selection: lib/admin-backend.ts, lib/admin-postgres.ts.
- Routing/configuration: lib/admin.ts; lib/cms/preview.ts, database.ts, security.ts, errors.ts, public-content.ts.
- SQL: separate Preview migration 008 and supabase/verification/preview-auth.sql.
- Tooling: scripts/cms/check-preview.cjs, prepare-preview.cjs, migration-plan.cjs (include Preview-only SQL in verified backups).
- Tests: tests/cms-postgres-auth.cjs; Redis concurrency case and VM module loading in tests/admin-auth.cjs/tests/helpers/cms-auth.cjs; explicit Redis selection in tests/cms-preview.cjs; opt-in hosted concurrent login attempts in tests/integration/preview.cjs.
- Documentation: this runbook; Phase 6 setup points here for the PostgreSQL option.

## Local verification results

- 109 CMS tests passed, including twelve PostgreSQL authentication/selection/permission cases and the existing CMS workflows.
- 11 Redis authentication tests and two content tests passed.
- TypeScript, lint, production build and git diff --check passed. Three production-browser regression tests passed; the real hosted suite remains opt-in and was confirmed skipped without approval flags.
- The final source manifest includes unchanged eight-project content and CMS migrations 001–007 plus separately listed Preview-only migration 008. No checked database/Redis secret identifiers or auth SQL appeared in generated client bundles.

All verification used local/mock services and isolated PGlite. No hosted Supabase resources or Production Upstash credentials were used. Stop for review before applying Preview-only SQL or changing hosted configuration.
