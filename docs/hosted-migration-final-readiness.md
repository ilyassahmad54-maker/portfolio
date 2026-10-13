# Final hosted migration readiness — 2026-10-13

Prepared only. Execution is NOT approved and no migration was executed. Target: **portfolio-cms-preview**, reference **pocnnpfzjxjlyoisnjhp**, service **portfolio_preview_migration**, session pooler **aws-0-ap-northeast-2.pooler.supabase.com:5432**, database **postgres**. Working branch: feature/supabase-portfolio-cms.

## Backup and verification

Durable local backup (outside Git and temporary directories): `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9`.

Verified 34 immutable files: data.json with eight projects, canonical seed source, all 12 files under public/assets, CV, schema/asset manifests, all eight migration SQL files, existing configuration/verification SQL and readiness documentation. No .env, password files, private keys or database credentials were copied. Directories use 700 and backup files 600. Existing schema-generation and asset-generation checks passed.

`manifest.json` preserves the application's validated migration/seed manifest. `backup-inventory.json` covers the broader snapshot including all assets and the manifest itself. `SHA256SUMS` covers those files plus backup-inventory.json. Every recorded size/hash was reread and verified; source files were compared again to detect changes during backup. The existing validatePlan verifier also passed. This is a local source backup, **not a hosted database snapshot or off-device disaster-recovery copy**. Before hosted writes, confirm a restorable Preview database backup/snapshot or explicitly approve the fresh isolated-database recovery plan.

Manifest SHA-256: `6ddc4f4d11b4926a96258412e05aabbca6dc21850c46bfc694ffe463945f9bde`.
Inventory SHA-256: `d658f7c34797271b309402961eb3b6f0023dc296985202da6e1824f91ea864b8`.
Verification record: `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/verification.json`.

## Current hosted state and TLS

The read-only catalog preflight was repeated successfully. Server 17.11; current database/role postgres; no cms/preview_auth schemas, proposed six role names, application functions/tables/policies, or CMS/Supabase migration-history tables were found. All fresh-install permission/feature checks passed. Final non-interactive service-only connection succeeded over TLS 1.3 / TLS_AES_256_GCM_SHA384.

Service sslmode remains verify-full with the installed trusted Dashboard CA. Chain and exact endpoint hostname verification remain enabled. No password configuration was changed. Pooler-to-PostgreSQL still reports pg_stat_ssl.ssl=false. Server ssl=on does not establish upstream encryption. Client-to-pooler authenticated encryption is confirmed; an every-hop TLS requirement remains unresolved. Explicitly acknowledge this boundary before execution or obtain a supported verified direct-connection design. Do not weaken TLS or change platform enforcement as part of this procedure.

## Reviewed execution order and immutable checksums

Each file has its own BEGIN/COMMIT transaction. Names intentionally prevent blind replay. SQL/plpgsql, UUID, SHA-256, row locking, SECURITY DEFINER, restricted owners and FORCE RLS are supported by source/catalog review; real DDL/platform-trigger execution and contention have not been tested on this hosted database.

| Order | Migration | SHA-256 |
| --- | --- | --- |
| 001 | 202610120001_cms_foundation.sql | `bb0d8bb5156fb3c25c5494955063c4fa79872c84da6de9be520d9d04b5814412` |
| 002 | 202610120002_content_schema.sql | `95c16f205af06e94fda6ae21c127b8d7b78f51c669a822c85bc4de9cb5c4431b` |
| 003 | 202610120003_revisions_and_seed.sql | `de6d43b83addd55a186e87615a98245db02bef4207b04427f1f276f7139eda23` |
| 004 | 202610120004_legacy_assets.sql | `9036c482f443eee691428571368d5a314ef29caeb897911ea24a89cf9a375596` |
| 005 | 202610120005_content_workflow.sql | `ef045bc5c443a6d7d017824c11b0047824a3baa08b60a56cdb681ba3e43125b2` |
| 006 | 202610120006_revision_history.sql | `2024e1b14837ebbab8b92061fbae753d784a172998552998294597a461af2a20` |
| 007 | 202610120007_image_inventory.sql | `68f57b70f825247c98f846bc247fd0c7c77afb323bfb5989538c513807f12174` |
| 008 | 202610120008_preview_auth.sql | `71c87f03185f91c19a45918868b5d3512c884da823322ddbfd8a85260e702134` |

001 creates the three CMS NOLOGIN roles/schema and validation helpers. 002 installs the generated content schema. 003 creates revision/state/assets/seed-ledger tables and read/seed functions; defining the seed function does not seed content. **004 inserts ten legacy-asset metadata rows (paths, hashes and sizes), including the CV; those INSERTs must be explicitly included in execution approval.** It does not upload images or seed portfolio content. 005 adds transactional draft/publish/discard workflow and receipts. 006 adds history/restoration. 007 adds verified image inventory functions. 008 creates the isolated Preview authentication owner/schema, sessions/rate buckets and restricted functions; it stays outside the main migrations directory and must be applied explicitly.

## Migration tracking

Prepared external journal: `execution-ledger.json` in the backup directory. All eight entries are **not_applied**, with exact file paths/checksums and empty attempts. This mutable journal is intentionally excluded from immutable checksum inventory. No hosted tracking table is created. cms.migration_ledger is a content-seed ledger and must not be repurposed.

Run only one migration at a time. Before launch append an attempt with UTC start time, target reference, SQL checksum, and status running/unknown. Save the ledger atomically using a sibling temporary file, flush/fsync, replace, and retain a dated copy of the prior journal. After psql exits, preserve its exit status and a mode-600 local transcript. Inspect output locally for unexpected platform messages before sharing; never log password/environment/service-file contents. Record COMMIT acknowledgment and catalog verification evidence. Only then mark the entry applied_verified, with UTC finish time and evidence paths, and proceed. Flush the journal and evidence to disk before the next file.

An interrupted process, lost connection near COMMIT, failed ledger write, or missing acknowledgment is **unknown**, never automatically failed or unapplied. The external ledger cannot be atomic with PostgreSQL COMMIT; catalog reconciliation is mandatory before retry. Never mark anything applied solely because an object name exists. Preserve the original manifest and SHA256SUMS unchanged.

## Pending commands — preparation only, do not run without execution approval

Use the immutable backup SQL rather than changing working-tree files. Revalidate all backup checksums and the service target/TLS immediately before starting. Run the existing hosted-preflight.sql in a READ ONLY transaction and inspect all gate results, not merely psql's exit code (false SELECT results do not cause ON_ERROR_STOP).

Commands below are individual steps, not a batch to paste. Stop on any nonzero exit; complete and verify the ledger step before the next command. -X disables psql startup files; -w forbids password prompting; ON_ERROR_STOP prevents continuing on SQL errors. Do not add --single-transaction because each file already owns its transaction. Do not run a blanket supabase db push.

Step 001; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/migrations/202610120001_cms_foundation.sql'
```

Record and reconcile the result before proceeding.

Step 002; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/migrations/202610120002_content_schema.sql'
```

Record and reconcile the result before proceeding.

Step 003; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/migrations/202610120003_revisions_and_seed.sql'
```

Record and reconcile the result before proceeding.

Step 004; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/migrations/202610120004_legacy_assets.sql'
```

Record and reconcile the result before proceeding.

Step 005; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/migrations/202610120005_content_workflow.sql'
```

Record and reconcile the result before proceeding.

Step 006; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/migrations/202610120006_revision_history.sql'
```

Record and reconcile the result before proceeding.

Step 007; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/migrations/202610120007_image_inventory.sql'
```

Record and reconcile the result before proceeding.

Step 008; start the journal attempt, then run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f '/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/supabase/preview-migrations/202610120008_preview_auth.sql'
```

Record and reconcile the result before proceeding.

## Post-migration read-only acceptance checks

Prepared `supabase/verification/post-migration-preseed.sql` is SELECT-only inside BEGIN READ ONLY. It is not executed now. After all eight files commit, run:

```sh
/usr/local/opt/libpq/bin/psql 'service=portfolio_preview_migration' -X -w -v ON_ERROR_STOP=1 -f supabase/verification/post-migration-preseed.sql
```

Inspect every returned row; this audit reports values and requires review, rather than treating a successful SQL exit as acceptance. Expected:

- Exactly four new NOLOGIN roles: CMS owner/runtime/seed and auth owner, all NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS. No app/seed LOGIN roles yet.
- cms owned by portfolio_cms_owner; preview_auth owned by portfolio_preview_auth_owner. Seven CMS and two auth tables, owned by their respective owners, all ENABLE/FORCE RLS with owner-only policies.
- Runtime gets schema USAGE, no schema CREATE/direct table or sequence access, exactly twelve CMS and four auth function signatures from the existing readiness allowlist. Seed gets only cms.seed_published(text,text) in application schemas. No PUBLIC function EXECUTE; SECURITY DEFINER functions have the proper restricted owner and pinned pg_catalog,pg_temp search_path.
- legacy_assets has exactly ten rows matching the backed-up lib/cms/legacy-assets.json and migration 004. All other application tables have zero rows before seeding/use.
- Owner memberships permit only the intended administrator; runtime/seed never inherit owners. No unexpected role attributes or transitive membership.

Also inspect sequences, indexes, constraints and triggers against each file, especially revision/ledger/receipt immutability, workflow constraints after 006, and recent-asset publication trigger after 007. Existing preview-runtime.sql and preview-auth.sql audits are intended for the actual restricted runtime login and should run only after separately approved login provisioning; do not run them as postgres and mistake elevated permissions for runtime permissions. No mutating function call, login attempt, upload, seed or behavioral integration test belongs to this read-only acceptance phase.

## Failure and recovery

1. Stop immediately; do not run later files or automatic cleanup. Preserve UTC times, exit status, COMMIT acknowledgment, file checksum and local evidence. Reconfirm target and verified TLS on reconnect.
2. If an error occurs before COMMIT and the session closes, transactional DDL/data for that file should roll back, including role creation. Earlier committed files remain. Prove expected prior state by catalog inspection before retry; never infer rollback from a network error alone.
3. If disconnect occurs during/after COMMIT or evidence is incomplete, mark unknown. Inspect all objects, definitions, ownership, grants, policies, constraints and triggers expected from that file. For 004 compare all ten metadata rows/hashes/sizes; for 006 inspect the altered receipt constraint and history functions; for 007 inspect replacement assets_publishable and added triggers/functions. Reconcile with preceding files and immutable SQL. Do not rerun until commit/rollback is unambiguous.
4. If committed exactly as expected, record applied_verified with the reconciliation evidence and resume only the first unapplied file. If fully rolled back, correct the diagnosed cause under separate approval if required, then rerun that one immutable file. If SQL changes, create a new reviewed manifest/checksum and approval; do not rewrite history.
5. Unexpected/partial catalog state requires manual investigation, not DROP/ALTER/GRANT bypasses. These are apply-once migrations, without automated down migrations. Never drop schemas/roles or restore the database without separate approval and a restorable backup. A fresh isolated-project rebuild is an alternative only after separate approval; it is not authorized here. Local content backup cannot restore unrelated hosted platform data.
6. Do not restore source files over the working tree merely because a database migration failed; source and database recovery are separate. Keep the immutable source backup and execution ledger preserved.

## Remaining gates and exact pending approvals

- Explicit approval to apply only the eight listed checksummed files to pocnnpfzjxjlyoisnjhp, including migration 004's ten metadata INSERTs, and perform catalog-only post-checks. No such execution approval has been given.
- Acknowledge the confirmed client TLS / observed non-TLS upstream boundary, or resolve an every-hop encryption requirement before execution.
- Confirm a hosted Preview backup/recovery baseline. The verified local backup is complete for source/assets, not a full hosted restore point. Keep another off-device copy if device-loss recovery is required.
- Storage policy authority remains unavailable to this login: storage.buckets/objects belong to supabase_storage_admin, and postgres has no owning-role membership/inheritance. This blocks the separate private-images.sql setup, not CMS/auth schema installation. Obtain a supported policy-administration path; never transfer managed ownership. Bucket creation/configuration needs separate approval.
- Login provisioning/passwords, Storage setup, portfolio-content seed, Preview environment changes, deployment and write integration tests each remain separate scopes. Do not infer them from migration approval.

## Production isolation

This procedure uses only the explicitly verified Preview PostgreSQL service. It contains no Production connection, Git commit/push, GitHub main update, Redis operation, Vercel operation, Storage mutation, environment rewrite or deployment. Production website, local main branch, GitHub main, Upstash Redis and Vercel Production configuration remain untouched. No execution automation or scheduled task was enabled. Stop here and wait for explicit approval.


## Execution outcome — 2026-10-13

The user subsequently approved controlled execution. All eight approved hashes were applied and verified. This historical preparation report is superseded for execution status by [the execution report](hosted-migration-execution-2026-10-13.md). Do not rerun the prepared apply-once commands. No seed, Storage, login provisioning or deployment was performed.
