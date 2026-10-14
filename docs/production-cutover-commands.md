# Final release command sheet — approval required

Prepared 2026-10-14. **Do not run mutation commands until separate final approval.** Existing site stays live until promotion. No migrations/seeding, paid resources, Production Redis credential changes, or destructive data restore are included. Authoritative architecture: [same-project plan](production-zero-cost-readiness-2026-10-14.md).

## Manual gates — owner confirmations received

1. Supabase Dashboard → organization containing `portfolio-cms-preview` → Billing: confirm **Free**, no paid add-ons. Organization → Usage: confirm database, Storage and egress under included quotas; check each project if breakdown is shown. Existing SQL size ~12 MB and Storage ~4 MB do not prove current monthly egress or account billing. Never upgrade. [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase).
2. Upstash Console → existing Production Redis database → plan and Usage: confirm **Free**, current command/data/bandwidth limits not exceeded, no paid usage enabled. If PAYG/fixed is shown, report it; do not change plan or promise $0 usage. Vercel API confirms Hobby.
3. Finder → Go → Go to Folder: `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/offdevice-encrypted-20261014`. Copy this folder to existing owner-controlled off-device storage. Put the contents of `offdevice-recovery-20261014/recovery-key.txt` privately into your password manager; keep key separate from uploaded archive. Do not paste it in chat. Confirm both copies can be retrieved. The archive is AES-256-GCM encrypted with a random 256-bit key; successful round-trip and wrong-key denial were verified locally. User has confirmed off-Mac transfer and separate recovery-key storage; the agent has not independently accessed the destination copy.

Recovery commands (local only; paths are placeholders, no key value is passed):

```sh
cd /path/to/offdevice-encrypted-20261014
shasum -a 256 -c SHA256SUMS
node decrypt-backup.cjs portfolio-cms-backup.aesgcm /private/path/recovery-key.txt /private/path/recovered.tar.gz
mkdir -m 700 /private/path/recovered
# Extract only the authenticated, verified archive into a new private directory.
tar -xzf /private/path/recovered.tar.gz -C /private/path/recovered
```

Verify extracted `checksums.json` before use. Contains sensitive SQL session metadata; keep plaintext recovery private. Never execute historical seed/import SQL. Full platform dump is supplementary; managed Supabase schemas must not be blindly overwritten. Local CMS restore and cutover rehearsal passed.

## Approval boundary, freeze and configuration

After approval, stop CMS editing without clearing mobile browser drafts. Remove branch-scoped Preview database/Storage env delivery **before pushing**; otherwise Git integration can create another credential-bearing Preview. Record old deployment/domain assignment and disable automatic Production domain assignment before merging. This is an approved Vercel setting change, not a command run during preparation.

Recheck current revision/hash/draft. Preserve newer edits if any; take final database + all-object backup. Current baseline is revision 24 / nine projects / hash `134b502f8bce38446cebdb5710011e28d1ecafe50cddaab0b4bc4afa3e2f46b1`.

### SSL enforcement (only after specific approval)

Supported Dashboard procedure: project `pocnnpfzjxjlyoisnjhp` → Database Settings → SSL Configuration → **Enforce SSL on incoming connections** → enable/save. Expect a brief database restart; do this during the editing freeze while the old static Production site stays live. Existing verified client TLS does not mean platform enforcement is on.

Equivalent installed CLI commands:

```sh
supabase ssl-enforcement get --project-ref pocnnpfzjxjlyoisnjhp --experimental
# MUTATION: separate approval required.
supabase ssl-enforcement update --project-ref pocnnpfzjxjlyoisnjhp --enable-db-ssl-enforcement --experimental
supabase ssl-enforcement get --project-ref pocnnpfzjxjlyoisnjhp --experimental
```

Wait for healthy state and `database:true`. New Production runtime service below must be privately configured in `.pg_service.conf`/`.pgpass` with the new app role, exact project pooler and trusted CA; these are operator files outside Git, not new environment-variable names. Keep SSL verify-full/rejectUnauthorized. Test certificate validation and a non-TLS attempt with a simple read; the non-TLS attempt must fail. Store raw diagnostics privately and show only safe summaries. With pooled connections, `pg_stat_ssl` describes the server-side connection, so explicitly check the internal hop rather than assuming client TLS proves it.

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_production_runtime sslmode=verify-full' -X -v ON_ERROR_STOP=1 -c 'SELECT current_user, current_database();'
# Negative read-only probe: EXPECT connection refusal, never successful plaintext.
/usr/local/opt/libpq/bin/psql 'service=portfolio_production_runtime sslmode=disable' -X -v ON_ERROR_STOP=1 -c 'SELECT 1;'
/usr/local/opt/libpq/bin/psql 'service=portfolio_production_runtime sslmode=verify-full' -X -v ON_ERROR_STOP=1 -c 'SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid();'
```

STOP if verified TLS, enforcement, required internal-hop encryption or admin authority cannot be established. Do not buy network add-ons or relax verification. [Supported SSL procedure](https://supabase.com/docs/guides/platform/ssl-enforcement).

### SQL and Storage credentials (only after approval)

Use existing operator migration service; it is not a deployed credential. Guarded plan is locally tested, does not replay any migration/seed, and clears only obsolete Preview authentication sessions. No published revisions/content/objects are deleted.

```sh
/usr/local/opt/libpq/bin/psql service=portfolio_preview_migration -X -v ON_ERROR_STOP=1 -c "SET cms.cutover_approved='yes'" -f docs/production-readiness/zero-cost-cutover.sql
/usr/local/opt/libpq/bin/psql service=portfolio_preview_migration -X -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename IN ('portfolio_cms_preview_app','portfolio_cms_preview_seed') AND pid<>pg_backend_pid();"
/usr/local/opt/libpq/bin/psql service=portfolio_preview_migration -X -v ON_ERROR_STOP=1 -c "SELECT count(*) AS old_connections FROM pg_stat_activity WHERE usename IN ('portfolio_cms_preview_app','portfolio_cms_preview_seed');"
```

Require zero old sessions and successful termination. Membership/password/login revocations must be committed first. Recheck publication after all in-flight work ends. New `portfolio_cms_production_app` starts NOLOGIN. Set its unique password through interactive psql `\password portfolio_cms_production_app` (private prompt, not shell argument), then `ALTER ROLE portfolio_cms_production_app LOGIN;`. Configure private runtime service and Vercel URI. Never reuse Preview/seed/admin passwords.

```sh
/usr/local/opt/libpq/bin/psql service=portfolio_production_runtime -X -v ON_ERROR_STOP=1 -f supabase/verification/preview-runtime.sql
```

Require all nine generic CMS catalog gates true. Production role must have no Preview-auth schema/function privileges; the old app and seed identities must have no CMS authority. SQL refusal tests need no write attempts.

Dashboard → Project Settings → API Keys: inventory all consumers; create new named Production **secret key**, not a legacy JWT. Privately set it as `SUPABASE_SERVICE_ROLE_KEY` in Production only. Test new-key bucket/object GET, then disable obsolete legacy JWT-based API keys using supported Dashboard control. Creating a key alone does not revoke legacy keys. Require old-key denial and new-key success. New-key upload POST is exercised on staged CMS; no uploads/deletes are needed to test old-key denial. Stop if other applications depend on legacy keys. [API-key procedure](https://supabase.com/docs/guides/getting-started/api-keys).

Remove all remaining branch Preview variables; never assign Production credentials to Preview/Development/All Environments. Retained immutable deployments still contain old values; database membership/session revocation and legacy Storage-key disabling must make those values unusable. SSO protection or env removal alone is insufficient. Seven old CMS Preview deployments are inventoried in `evidence/zero-cost-inventory.json`. Do not claim they are revoked until post-transition denial checks pass.

Set Production variables from the table in the authoritative readiness report. Keep existing `ADMIN_PASSCODE` and both Upstash variables unchanged; `ADMIN_STATE_BACKEND=redis`, `CMS_REQUIRE_DATABASE=1`, distinct Production cache namespace, new restricted SQL login/new server key, trusted CA. All Preview auth/test/seed flags must be absent.

## Reviewed Git release (only after approval)

Proposed title: **Support revocable Supabase server keys for CMS Storage**.

Proposed commit includes only the adapter fix, its regression test, current report/checklist and command sheet, guarded cutover SQL and safe supporting evidence. Review these files first; credentials/backups/operator scripts remain outside Git. Older reports are historical and need not be added to this release. No `git add .`, force push or history rewrite.

```sh
cd /Users/mac/Desktop/portfolio
git switch feature/supabase-portfolio-cms
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git diff --check
npm run typecheck
npm run lint
npm run test:auth
npm run test:content
npm run test:cms
npm run test:browser
npm run build
git add lib/cms/storage.ts tests/cms-images.cjs docs/production-zero-cost-readiness-2026-10-14.md docs/production-deployment-checklist.md docs/production-cutover-commands.md docs/production-readiness/zero-cost-cutover.sql docs/production-readiness/evidence
git diff --cached --check
git diff --cached --stat
# Review full staged diff and run secret scan privately BEFORE committing.
git diff --cached
git commit -m "Support revocable Supabase server keys for CMS Storage"
git push origin feature/supabase-portfolio-cms
```

Record exact feature SHA, review full feature-versus-main application diff (CMS implementation already committed on feature). Ensure Preview env delivery removed and Production auto-domain assignment disabled. After reviewed merge approval:

```sh
git switch main
git merge --ff-only origin/main
git merge --ff-only feature/supabase-portfolio-cms
git push origin main
git rev-parse HEAD
```

If branch protection requires a PR, use the repository's protected PR workflow; do not bypass it. Stop if fast-forward fails or remote main changed. Do not automatically rebuild the Git integration deployment and another CLI production build simultaneously: inspect any merge-triggered staged build first and use that exact verified build if suitable. Otherwise use the explicit staged command below; no public aliases are assigned by it.

## Staged build, verification, promotion and rollback

Installed CLI is verified at the following path; no npx install or new service is needed:

```sh
CMS_VERCEL_CLI=/Users/mac/.npm/_npx/69f9afb961c37556/node_modules/vercel/dist/index.js
# MUTATION: creates staged PRODUCTION build with existing project's Production env.
node "$CMS_VERCEL_CLI" deploy --prod --skip-domain --project prj_8LYUIcb6Kk4uWMYf8AV7PbQUf2bc
```

Record actual deployment URL/ID and exact source SHA; confirm READY, target Production, correct env scopes and original public domains still on old deployment. CLI source uploads must match the reviewed commit; `.env*`, private backups and `docs/tests` are excluded by `.vercelignore`. Never supply secrets through `--env`, `--build-env`, `--token` or verbose debug output.

Set `CMS_STAGED_ID` to the actual returned ID (not known until approved deployment):

```sh
node "$CMS_VERCEL_CLI" inspect "$CMS_STAGED_ID"
```

Privately sign in with existing Production passcode. Check real Redis login/session/logout, SQL/Storage availability, all nine projects and image bytes, CV/contact/SEO, CSRF/unauthorized denial, draft image privacy, upload/save/preview/publish/history/restore, desktop/iPhone consistency and no client/log secrets. Avoid rate-limit bursts, intentional outages or load tests on Production Redis. Existing real isolated Redis SET/GET/DEL/EVAL/TTL/rate evidence is retained; exact Production token write/Lua permissions cannot be independently proven by read-only checks. Freeze edits, test only owned changes, restore exact current content, recheck hash/no unrelated draft, and take post-validation backup. Never disable the Preview integration harness Production guard.

Only after all gates pass and promotion is approved:

```sh
node "$CMS_VERCEL_CLI" promote "$CMS_STAGED_ID"
```

Check existing public URL `https://portfolio-woad-nu-owt4y7t889.vercel.app`, nine-project content, latest images, Redis admin/logout, CV/contact/SEO and runtime logs on both devices. Keep secrets out of logs/summaries.

If validation fails and rollback authority is approved:

```sh
node "$CMS_VERCEL_CLI" rollback dpl_AwGUL8oQZSYUwFSDKy63L6fL4Fb2
```

Before promotion verify this is still the immediately previous eligible Production deployment (Hobby restriction); otherwise STOP and revise rollback plan. Staging itself may alter eligibility, so recheck after staged build and before promotion. Rollback changes application/domain routing, not Supabase data, Storage, project env or credential revocations. Old site can show eight legacy projects while nine-project CMS data remains preserved. Never restore Preview credentials, flush Redis, reseed or blindly overwrite managed schemas as rollback. Destructive database recovery needs separate approval.

Supported references: [staged deploy](https://vercel.com/docs/cli/deploy), [promotion](https://vercel.com/docs/deployments/promoting-a-deployment), [rollback](https://vercel.com/docs/instant-rollback).


## Final approval checkpoint — verified 18:34 UTC

Owner confirms billing needs no additional paid subscriptions and encrypted backup is off Mac with key separate. Local archive checksums were independently revalidated: 34 files plus encrypted archive; current publication matches backup. Nine projects at revision 24, no draft. Production domain resolves through Vercel control plane to `dpl_AwGUL8oQZSYUwFSDKy63L6fL4Fb2` in `prj_8LYUIcb6Kk4uWMYf8AV7PbQUf2bc`; branch main. Auto-domain assignment is currently TRUE and must be controlled before merge. Existing Production environment metadata is unchanged, Upstash remains Production-only. New Production CMS role/Storage key have not been provisioned. Seven Preview deployments still have valid old credentials today; do not claim future isolation until revocation and denial checks succeed.

**GO for approval-gated execution; not permission to begin.** Request explicit approval for the bounded $0 cutover including SSL restart, credential provisioning/revocation and Preview-session invalidation, Preview env removal, Production-only CMS env additions preserving passcode/Upstash, reviewed feature commit/push/main merge, staging/bounded validation, then public promotion only after every security/content/rollback gate passes; application rollback if needed. No migrations/seed, purchases, destructive restore or Production Redis load tests. Stop on insufficient authority, a charge requirement, changed/unpreserved content, or failed security/staging/rollback checks.


## Staging execution update — 2026-10-15

New Production-only Storage variable verified sensitive; value is intentionally not retrievable through the supported API. Original Production passcode/Upstash metadata unchanged. SSL enforcement and client/backend encryption/plaintext rejection passed. Auto-domain assignment is now false; original public alias unchanged. New distinct `portfolio_cms_production_app` login provisioned and verified with all nine generic runtime audit gates and exact nine-project content hash. Credentials preserved privately outside Git. Six CMS settings added Production-only; no Preview flags in Production.

Latest user conditions supersede earlier ordering: provision/verify replacements BEFORE old-access revocation. `production-provision.sql` is the creation phase; `zero-cost-cutover.sql` now requires the pre-existing verified Production login and performs only revocation/session invalidation. Neither is a migration/seed. The role is already created; never rerun provisioning.

Stage directly from the reviewed feature commit with --prod --skip-domain; no main merge is needed to complete staging. Do not switch the public domain or merge if that would publish an unverified release. Legacy keys and Preview logins stay active until staged replacement verification passes. Owner must disable legacy keys via supported Dashboard only after new-key GET/POST checks pass if Management API authority remains unavailable. Exact staged Production login needs the existing Production passcode privately supplied by owner; never reset it or mint a session by writing Redis directly.
