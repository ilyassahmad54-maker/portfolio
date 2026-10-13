# Phase 6 — hosted integration preparation

The subsequently approved PostgreSQL Preview authentication option is documented in [preview-postgres-auth.md](preview-postgres-auth.md). It replaces the separate Redis requirement for that option and adds a separately tracked Preview-only migration 008. Production remains Redis; do not apply 008 to Production. Original CMS migrations 001–007 remain unchanged.

This is preparation, not a hosted validation result. No commit, push, deployment, hosted migration, resource provisioning or production environment change is authorized or performed. The latest user message ends at “Safety”; earlier restrictions remain in force.

## Repository and review

Remote refs/heads/main was checked directly through git ls-remote on 2026-10-12: ef4f651f26fb582e0ed24e0c16601b95dc48c342. HEAD and the branch merge base match that hash. Work remains on feature/supabase-portfolio-cms. Eight projects remain byte-for-byte unchanged in data.json, with Unemployment first and corrected RiskRadar second. Public assets, CV and original authentication routes/lib/admin.ts are unchanged. The unrelated credential-named Word file is excluded from review/backups and must not be staged. No secrets or environment files are included in preparation artifacts.

Review covered the source-loading paths, server/client separation, API input/session/CSRF/rate checks, SQL definitions and grants, Storage transport/validation/delivery, editor state/conflicts/imports, deployment tracing, and existing tests. Automated permissions tests supplement review but do not prove hosted compatibility.

Review found and corrected one public-image integration issue: unauthenticated image reads shared a session bucket named “none,” which could globally throttle unrelated visitors. Public images now retain their per-IP limit without that shared session bucket. Authenticated operations retain both IP/session limits; authentication implementation is unchanged.

## SQL migrations 001–007

| Migration | Reviewed hosted behavior |
| --- | --- |
| 001 | Creates three CMS-only NOLOGIN/NOBYPASSRLS roles, owner schema and default function-EXECUTE revocation; grants migration identity owner membership for subsequent SET LOCAL ROLE. Requires an approved project database administration identity with role/schema creation and membership-grant authority. |
| 002 | Generated immutable JSONB schema function; no pg_jsonschema extension dependency. |
| 003 | JSONB revisions, state, asset inventory and seed ledger; identity sequence, core SHA-256/gen_random_uuid, owner-only FORCE RLS, immutability triggers, seed advisory lock and restricted published-read/seed grants. |
| 004 | Immutable approved legacy asset manifest with FORCE RLS; baseline asset checksums retained. |
| 005 | Atomic save/publish/discard functions, row locking, optimistic state versions, immutable idempotency receipts; runtime function execution only. |
| 006 | Keyset history, revision reads and atomic restore creating a new revision. Independent saved drafts are preserved; a clean draft follows restoration. Draft revisions cannot be restore targets. |
| 007 | Immutable uploaded asset inventory, availability proofs and publish/restore trigger requiring verification younger than 30 seconds; runtime asset function grants only. |

All SECURITY DEFINER entry points are owned by portfolio_cms_owner (no BYPASSRLS), schema-qualified, and pin search_path to pg_catalog, pg_temp. All seven CMS tables use ENABLE and FORCE RLS with owner-only policies. Runtime receives exactly twelve function permissions, no table/sequence writes, no schema CREATE, no owner/seed membership. Shared helper functions remain inaccessible to runtime. History/receipts remain immutable. Functions use a single PostgreSQL statement/transaction per state change; failed statements cannot partially advance pointers. A timed-out network request can have committed, so retries must retain the original request identifier.

Supabase's postgres identity is not a true superuser. Consequently role creation/ownership/membership must be verified using the actual isolated administrator before rollout; successful PGlite tests alone do not establish those hosted rights. SQL uses core PostgreSQL features available in supported modern Supabase versions. No extension, built-in Supabase role alteration, auth schema alteration or public database-wide CONNECT revocation is required. Do not expose cms in PostgREST's exposed schemas. Review other database-wide PUBLIC/default grants separately; CMS grants cannot remove privileges inherited from PUBLIC elsewhere. [Supabase role limitations](https://supabase.com/docs/guides/database/postgres/roles-superuser), [custom-role privilege inheritance](https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c).

Migrations are ordered one-time DDL, not rerunnable SQL. Use migration tracking; do not replay 001 against existing roles. Each file has its own transaction. If a later file fails, stop, inspect the version tracker and catalog, then resume only unapplied files. Never drop the schema or roles to force a retry. Original migration files are unchanged in Phase 6.

private-images.sql remains a separately approved Storage administration step. It asserts a private portfolio-images bucket, 4 MiB limit and exactly JPEG/PNG/WebP MIME types. Restrictive anon/authenticated policies block access even if broader permissive policies exist. It does not alter other buckets, enable public delivery or authorize deletion. Its policy DDL is apply-once; an existing incompatible bucket/policy requires review rather than replacement. Real Storage ownership/RLS and service-role bypass need hosted tests. Service-role credentials remain server-only and have broader project authority than this application needs; use an isolated project and tightly restrict access.

preview-logins.sql prepares separate passwordless LOGIN identities with runtime-only and seed-only memberships. Provision strong distinct passwords securely afterward. Seed identity never belongs in Vercel. Existing identities deliberately cause a refusal rather than silent privilege edits.

## Vercel PostgreSQL driver review

Use the shared transaction pooler endpoint copied from Supabase Connect, normally port 6543. Custom pooler usernames are role.project-ref. Migrations use a direct connection, or session pooler if IPv6 is unavailable. Runtime queries have prepare:false, max:2 per warm instance, five-second connect timeout, twenty-second idle timeout, thirty-minute maximum lifetime, and an eight-second total application deadline including acquisition. Reserved connections execute sequentially to avoid pipelining; there are no runtime session SET ROLE or session-dependent operations. Function-local SET settings and transaction/advisory locks expire with their transaction. Per-instance max:2 is not a global cap; measure aggregate serverless concurrency and project limits.

TLS uses rejectUnauthorized:true, never sslmode=disable or an insecure fallback. Optional SUPABASE_DATABASE_CA supplies the project's trusted PEM CA when required; malformed PEM is rejected. URL query parameters are deliberately rejected, so remove sslmode parameters and let these explicit driver options enforce TLS. Validate the selected pooler certificate/hostname in the real check. [Supabase connection/pooling guidance](https://supabase.com/docs/guides/database/connecting-to-postgres), [Postgres.js driver options](https://github.com/porsager/postgres#connection-options).

## Preview isolation and failure visibility

VERCEL_ENV=preview automatically requires a live validated database read: neither Redis nor data.json may hide a failed integration. Public API reports 503 on failure; the SSR page fails visibly. Production retains its prior emergency fallback behavior. CMS_REQUIRE_DATABASE=1 also enables strict behavior locally for integration checks.

Preview SQL/Storage access additionally requires non-secret allowlists: CMS_PREVIEW_PROJECT_REF (20-character isolated project ref), CMS_PREVIEW_REDIS_HOST (isolated Upstash REST hostname), CMS_CACHE_NAMESPACE (preview- prefix). The configured SQL target, Supabase HTTPS origin and Redis hostname must match. This detects configuration mismatches, but the operator must verify the allowlisted resources are actually separate from Production. No runtime code can prove account-level isolation from identifiers alone.

| Variable | Scope/purpose |
| --- | --- |
| SUPABASE_DATABASE_URL | Preview only; restricted portfolio_cms_preview_app connection |
| SUPABASE_URL | Preview only; exact isolated HTTPS project origin |
| SUPABASE_SERVICE_ROLE_KEY | Preview only; isolated Storage server credential |
| SUPABASE_DATABASE_CA | Optional trusted PEM CA; Preview/local tooling only |
| ADMIN_PASSCODE | Preview-only distinct admin credential, existing auth implementation |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN | Separate Preview Redis database, never shared production sessions/rate/cache |
| CMS_CACHE_NAMESPACE | Unique preview-<identifier>, 64 characters maximum |
| CMS_PREVIEW_PROJECT_REF / CMS_PREVIEW_REDIS_HOST | Explicit non-secret target allowlists |
| CMS_PREVIEW_SEED_DATABASE_URL | Local seed tooling only; never Vercel/runtime |
| CMS_SEED_APPROVAL | Local seed tooling only; isolated-preview explicitly allows --apply |
| CMS_PREVIEW_CHECK | Local read-only check only; isolated-preview |
| CMS_INTEGRATION_ORIGIN | Local test runner; exact immutable Preview HTTPS URL |
| CMS_INTEGRATION_ALLOW_WRITES | Local test runner; isolated-preview explicit write opt-in |
| CMS_PREVIEW_BYPASS | Optional local test runner deployment-protection bypass secret; never published |

Do not use NEXT_PUBLIC for any credential. Preserve existing Production-scoped variables, and check Vercel's inherited All Environments settings before adding Preview overrides. Keep deployment protection enabled. Preview canonical remains Production; configure Preview noindex and verify that header through deployment protection/settings.

## Backup, manifest and seed procedure

1. Run npm run cms:preview:prepare offline. It creates an owner-only temporary directory with the existing verified seed/asset/SQL backup, a source snapshot excluding env/credentials, and integration-manifest.json. Manifest records branch/base, all seven SQL hashes, every source snapshot hash, canonical seed hash, project IDs/order/categories/images and source sizes. Copy it to durable secure storage; temporary directories are not durable backups. Re-run preparation after any source change.
2. Validate with npm run cms:backup:verify -- /path/to/backup. Canonical eight-project SHA-256 must be 940d8b8e91c19bc0e252048f6049a34b1766d8989af9e2bde1ac36fce0900a00.
3. After separate hosted-change approval, provision isolated Supabase/Redis, apply migrations 001–007 under an administration identity with ON_ERROR_STOP/migration tracking, apply reviewed Storage configuration and preview-logins.sql, then provision passwords securely. For psql use a secured service definition (for example service=portfolio_preview_migration) and pgpass; do not put passwords in shell arguments, logs or chat. No migrations are performed by app startup/build.
4. npm run cms:preview:seed alone is a dry-run with no database access. Applying requires reviewed --apply --backup /path/to/backup plus the explicit seed approval flag, exact expected isolated project and restricted seed URL. It validates backup hashes/current baseline, binds canonical JSON/hash parameters, checks role privileges, and calls cms.seed_published once. Twenty-second deadline closes the client on timeout. The seed SQL advisory lock/ledger makes repeated or concurrent identical imports return the original revision without resetting later edits. Changed seed or pre-existing unledgered content is rejected.
5. Use securely loaded local Preview variables and VERCEL_ENV=preview, CMS_PREVIEW_CHECK=isolated-preview with npm run cms:preview:check. It tests actual TLS/driver, runtime identity, catalog/RLS/function permissions and exact eight-project baseline. No writes. It is expected to fail if the test database has already been deliberately edited; restore the baseline first.
6. Only after separate commit/push/Preview-deploy approval, deploy this feature branch to Vercel Preview. Never promote it to Production during Phase 6. Verify deployment variables and resource identifiers before allowing test mutations.

## Real integration suite and acceptance

npm run test:integration is skipped unless the explicit write opt-in is set. The suite refuses the production URL and requires a Preview-only response header plus source=database/readOnly=false. It requires exact eight-project baseline content and no saved unrelated draft before changing anything. Run on an exclusively reserved test database without other writers. It logs no request bodies/credentials and suppresses transport details on failure.

It exercises existing login, unauthorized/CSRF denial, real JPEG/PNG/WebP upload/byte delivery, draft-only public denial, save/preview isolation, idempotent save/publish/restore, history pagination/retrieval, concurrent writes (one 200, one 409), discard, rollback, retained historical image preview, and fresh desktop/mobile rendering, canonical metadata and PDF retrieval. It restores its baseline and discards only known test drafts; unknown revisions are not overwritten. Failures or lost responses can leave test revisions/private objects for manual review. No image deletion occurs. Archived private test uploads intentionally remain. Contact form structure is checked without sending messages; local production-browser testing separately intercepts Formspree submission.

Manual hosted acceptance still needs actual iPhone Safari, uploaded image rendering in admin/public browser views, mobile overflow/accessibility, Preview protection/noindex, database/Redis/Storage outages, native decoding resource limits, Vercel body/function limits and 30-second asset-proof latency. Upload policy permits 4 MiB file bytes; verify Vercel request overhead limits separately. Test concurrent independent instances, not just requests handled by one warm process. Preserve a database schema/data backup before and after integration; the offline source manifest cannot replace pg_dump or hosted backups. Roll back application testing by restoring the initial published revision, not deleting history or dropping tables. Production stays on its existing deployment.

## Local validation

97 CMS tests, ten authentication tests and two content tests passed during preparation. TypeScript, lint and production build passed. Three production-browser tests passed, including desktop/mobile consistency, editor workflows, CV bytes and intercepted contact submission. The hosted suite was confirmed skipped without opt-in and has not run against real Supabase/Vercel. No claim of hosted compatibility or readiness is final until the isolated checks pass.
