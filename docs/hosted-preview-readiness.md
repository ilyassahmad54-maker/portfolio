# Hosted Preview migration readiness — 2026-10-12

Preparation only for portfolio-cms-preview (Seoul). No hosted connection, migration, configuration change, commit, push or deployment was performed. This runbook supersedes the original Redis Preview setup in cms-phase-6.md; Production remains unchanged.

Approved read-only preflight target (dashboard-confirmed correction): project reference `pocnnpfzjxjlyoisnjhp`, PostgreSQL service `portfolio_preview_migration`. The earlier reference `pocnnpfzjxilyoisnjhp` was a transcription error and must not be used. This target correction does not authorize migrations or credential changes.

## Review and compatibility

All migrations use ordinary PostgreSQL features; no superuser-only extension or database ownership transfer is needed. Local PGlite testing now applies all eight migrations and the Preview login configuration as a non-superuser, non-database-owner administrator with CREATEROLE and CREATE on the database. Actual hosted administrator capabilities remain unverified.

CREATE ROLE requires CREATEROLE; granting newly created owner/runtime/seed roles requires the applicable ADMIN OPTION; CREATE SCHEMA AUTHORIZATION requires database CREATE and ability to assume the target owner. SET LOCAL ROLE in later files requires owner membership. Missing any of these is a stop condition. Existing role/schema names also stop installation intentionally. Never grant runtime CREATEROLE, database CREATE, owner membership or BYPASSRLS to bypass a failure.

The migration identity administers the two application owner roles. Neither application owner is LOGIN, superuser or BYPASSRLS. SECURITY DEFINER functions execute under those owners with search_path pinned to pg_catalog,pg_temp and qualified application objects. Owner-only policies permit their operations despite FORCE RLS. Runtime cannot alter functions, tables or policies. Global owner default PUBLIC function execution is revoked, as are existing application function grants before explicit grants. All seven CMS tables and both Preview authentication tables have ENABLE/FORCE RLS. No Supabase-managed schema ownership or database ownership is changed. Keep cms and preview_auth outside Data API exposed schemas.

DDL is apply-once, with one transaction per file. It is not an idempotent migration runner. Maintain a secure applied-version/checksum ledger outside the application seed ledger, recording each successful file before continuing. If interrupted, inspect catalog and ledger; resume only unapplied files. Do not blindly replay or drop roles/schemas. The content seed itself is idempotent and refuses changed source or unledgered pre-existing content.

## Exact execution order and dependencies

| Order | SQL | Dependency / purpose |
| --- | --- | --- |
| 1 | migrations/202610120001_cms_foundation.sql | Roles, schema, validation helpers, default grants |
| 2 | migrations/202610120002_content_schema.sql | Owner/schema; generated JSON schema |
| 3 | migrations/202610120003_revisions_and_seed.sql | Helpers/schema; revisions, state, inventory, ledger, seed/read functions |
| 4 | migrations/202610120004_legacy_assets.sql | CMS owner; approved legacy asset inventory |
| 5 | migrations/202610120005_content_workflow.sql | State/revisions/assets; draft/publish/discard and receipts |
| 6 | migrations/202610120006_revision_history.sql | Workflow/state/receipts; history and restore |
| 7 | migrations/202610120007_image_inventory.sql | Assets and workflow; verified upload inventory and publication proofs |
| 8 | preview-migrations/202610120008_preview_auth.sql | CMS runtime/seed roles; isolated sessions and atomic rate limits |
| 9 | configuration/preview-logins.sql | CMS roles; separate app/seed LOGIN identities |
| 10 | Dashboard/Storage API bucket creation, then configuration/private-images.sql | Storage service and anon/authenticated roles; independent of CMS seed |
| 11 | Reviewed seed tool | Complete migrations, secure seed password, verified backup |
| 12 | Runtime permission/content checks | Complete seed, app password, Preview-only configuration |

Migration 008 is deliberately outside the CMS migration directory and must be tracked/applied separately, only in Preview. Provision distinct login passwords securely after step 9; never store them in SQL or Vercel seed variables. No app startup/build runs migrations.

Storage correction: private-images.sql no longer inserts into storage.buckets. Create portfolio-images privately through Dashboard/API, size 4194304, MIME types exactly image/jpeg,image/png,image/webp; the SQL asserts these values before adding restrictive policies. Existing mismatched bucket or policies require review. Policy DDL needs table-owner authority; storage objects belong to Supabase-managed roles, so the actual SQL identity may be refused. Use the supported Dashboard policy interface or obtain supported administration guidance; do not transfer managed ownership or grant application roles Storage administration. Check both policies remain RESTRICTIVE, and both tables have RLS. Never change other buckets or objects.

## Runtime permissions

portfolio_cms_preview_app inherits only portfolio_cms_runtime. In the application schemas it gets USAGE and these exact function signatures:

```text
cms.read_published()
cms.read_draft()
cms.read_state()
cms.save_draft(jsonb,bigint,uuid)
cms.publish_draft(bigint,uuid,uuid)
cms.discard_draft(bigint,uuid,boolean,uuid)
cms.list_revisions(integer,bigint)
cms.read_revision(uuid)
cms.restore_publication(uuid,bigint,uuid)
cms.register_asset(uuid,text,text,integer,integer,integer)
cms.read_asset(uuid,boolean)
cms.confirm_asset(uuid,text)
preview_auth.create_session(text,text)
preview_auth.read_session(text)
preview_auth.revoke_session(text)
preview_auth.consume_rate(text,text,text)
```

No direct application table/sequence access, schema CREATE, seed function, cleanup function, or owner membership. Seed login inherits only portfolio_cms_seed and can execute cms.seed_published(text,text); it is never deployed. Runtime cannot access private Storage tables through these grants. The server-only Storage credential has broader service privileges, so project isolation remains essential.

Supabase grants PUBLIC some access outside these schemas. Therefore “only approved functions” describes application schema permissions, not absence of core PostgreSQL functions/catalog access. Inspect unexpected role memberships and existing public/net function grants before acceptance. Do not revoke database CONNECT from PUBLIC or broadly revoke Supabase-managed defaults; that can break platform services.

## TLS and serverless connections

Copy the isolated project's exact transaction pooler host from Connect; do not derive it from Seoul. Use port 6543 and username portfolio_cms_preview_app.<project-ref>, database postgres, with a securely provisioned URL-encoded password. Runtime URLs reject query parameters: omit sslmode parameters; the driver explicitly requires TLS with certificate/hostname validation through rejectUnauthorized:true. If needed, supply the trusted project CA from the Dashboard through SUPABASE_DATABASE_CA; never disable verification.

Postgres.js uses prepare:false, at most two connections per warm instance, 5-second connection timeout, 20-second idle timeout and 8-second total query deadline. Each reserved connection awaits identity verification before its single function call, avoiding concurrent pipelining on that connection. No runtime session SET ROLE, temporary tables or session-level advisory locks. Mutations are single transactional PostgreSQL function calls. Transaction-mode compatibility and aggregate Vercel concurrency remain hosted test gates; per-instance max is not a global limit. Use direct or session pooler connections for migration tooling, not runtime transaction pooler connections.

## Preview environment variables

All credentials are server-only, scoped to Preview (preferably this feature branch). Never use NEXT_PUBLIC. Do not alter Production values.

| Variable | Configuration |
| --- | --- |
| ADMIN_STATE_BACKEND | postgres, explicitly |
| CMS_PREVIEW_AUTH_ENABLED | 1 |
| ADMIN_PASSCODE | Unique Preview random credential, minimum 20 characters |
| SUPABASE_DATABASE_URL | Isolated transaction pooler URL with restricted app login |
| SUPABASE_URL | https://<actual-20-character-project-ref>.supabase.co |
| SUPABASE_SERVICE_ROLE_KEY | Isolated project's server Storage credential |
| CMS_PREVIEW_PROJECT_REF | Actual isolated project reference, not project name |
| CMS_CACHE_NAMESPACE | preview-portfolio-cms or another unique preview- value |
| CMS_REQUIRE_DATABASE | 1; Preview already requires database success |
| SUPABASE_DATABASE_CA | Optional trusted PEM CA if required by the selected endpoint |
| VERCEL_ENV | Vercel-managed preview; do not override Production |
| NODE_ENV | Vercel-managed production for production builds |

UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN and CMS_PREVIEW_REDIS_HOST must be absent, including empty definitions, in Preview. Check All Environments inheritance without revealing values. PostgreSQL selection rejects their presence and never falls back to Redis. Missing/invalid/ambiguous backend settings, incorrect project targets and database failures deny authentication. Production retains Redis default and existing variables. This proves code isolation; actual Vercel scopes remain an unverified hosted gate.

Local tools only: CMS_PREVIEW_SEED_DATABASE_URL (restricted seed login), CMS_SEED_APPROVAL=isolated-preview, CMS_PREVIEW_CHECK=isolated-preview; integration tools also CMS_INTEGRATION_ORIGIN (exact Preview HTTPS URL), CMS_INTEGRATION_ALLOW_WRITES=isolated-preview and optional CMS_PREVIEW_BYPASS. Never put seed/admin database credentials or integration bypass secrets in client bundles.

## Commands prepared

Offline, no hosted connection:

```sh
npm run cms:schema:check
npm run cms:assets:check
npm run cms:migration:dry-run
npm run cms:preview:prepare
npm run cms:backup:verify -- /path/to/reviewed-backup
npm run cms:preview:seed
npm run test:cms
npm run test:auth
npm run test:content
npm run typecheck
npm run lint
npm run build
```

Future hosted commands — NOT executed or approved by this readiness review. Use a secured psql service definition with sslmode=verify-full and trusted sslrootcert, plus a protected password store or interactive prompt; no password-bearing arguments. First confirm the service targets the isolated project's exact reference.

```sh
psql 'service=portfolio_preview_migration' -X -v ON_ERROR_STOP=1 -f supabase/verification/hosted-preflight.sql
```

Apply each of the eight files in the table individually using the same psql command form, changing only -f to its full supabase/... path. Record success/checksum after each file. Then apply preview-logins.sql, securely provision passwords, create the private bucket via Dashboard/API, and apply private-images.sql. Preflight false/missing results require investigation; they must not be bypassed. A fresh-install name check is expected to become false after installation.

With securely loaded local Preview/seed variables and a reviewed backup:

```sh
CMS_SEED_APPROVAL=isolated-preview npm run cms:preview:seed -- --apply --backup /path/to/reviewed-backup
VERCEL_ENV=preview CMS_PREVIEW_CHECK=isolated-preview npm run cms:preview:check
CMS_INTEGRATION_ALLOW_WRITES=isolated-preview npm run test:integration
```

The check validates runtime TLS/identity, CMS/auth RLS and function permissions, and exact baseline content. The integration suite requires a separately approved deployed Preview URL, refuses Production, requires a Preview database response marker, and performs real mutations. It tests save/publish/discard/history/restore, image storage/delivery, conflicts and login limits; test artifacts/history remain preserved. Preview database outages produce visible failure rather than silently falling back to data.json/Redis. Reserve the database for the suite and back it up before/after; do not run with unrelated drafts.

## Acceptance blockers

Actual project reference/endpoint, verified CA chain, migration administrator role authority, Storage policy authority and effective PUBLIC grants have not been checked on hosted Supabase. Password provisioning, environment scopes and real multi-connection/serverless tests remain outstanding. Explicit approval is required before any hosted step or deployment. No credentials need to be shared in chat. Keep an external durable copy of the generated source/asset manifest; temporary local backups are not hosted database backups.

Sources: [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Postgres.js pooling warning](https://supabase.com/docs/guides/database/postgres-js), [hosted role restrictions](https://supabase.com/docs/guides/database/postgres/roles-superuser), [Storage metadata guidance](https://supabase.com/docs/guides/storage/schema/design), [PUBLIC privileges](https://supabase.com/docs/guides/troubleshooting/custom-role-inherits-privileges-that-were-not-explicitly-granted-ddaa1c).

## Local results and review delta

110 CMS tests, 11 existing Redis authentication tests and two content tests passed. TypeScript, lint, schema/asset generation checks, migration/seed dry-runs and production build passed. The non-superuser test was rerun after adding the read-only preflight and tightening audit signatures/membership checks, and passed. No real hosted integration suite was executed. data.json, existing public assets and authentication route handlers are unchanged against HEAD; the branch remains feature/supabase-portfolio-cms.

This review changes only this runbook, hosted-preflight.sql, preview-runtime.sql and preview-auth.sql catalog audits, private-images.sql setup instructions/verification, tests/cms-hosted-readiness.cjs and the bucket fixture in tests/cms-images.cjs. Migrations 001–008 and runtime application code did not require compatibility changes. The permission audits now check exact function signatures and reject unexpected runtime memberships/database ownership or CREATE privileges.
