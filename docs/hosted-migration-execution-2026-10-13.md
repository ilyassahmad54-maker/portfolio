# Supabase Preview CMS migration execution — 2026-10-13

**Result: all eight approved migrations committed and individually verified.**

Target: portfolio-cms-preview; project reference pocnnpfzjxjlyoisnjhp; service portfolio_preview_migration; session pooler aws-0-ap-northeast-2.pooler.supabase.com:5432; database postgres. Branch feature/supabase-portfolio-cms. User explicitly approved 001–008 including the ten migration 004 metadata inserts. No successful migration was replayed. Each original file retained its own BEGIN/COMMIT transaction and was run with psql -X -w -v ON_ERROR_STOP=1. SQL was read from the immutable approved backup.

## Mandatory safety gates

Readiness and preflight reports reviewed. Exact service, branch, trusted CA and verify-full checked before every migration. The immutable manifest hash and all eight source/backup SQL hashes matched approval. Fresh state and SQL privileges were confirmed before execution. No CMS/auth schemas/roles/tables/functions existed initially. No Production endpoint or service was used. The full hosted logical baseline below was produced and verified before the first migration. Recovery procedure and initial catalog were saved before execution. No broader runtime privileges were granted.

## Hosted logical baseline

Location: `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/hosted-baseline-20261013T174332Z`.

Full custom-format pg_dump archive: preview-database.dump, 366349 bytes.
Archive SHA-256: `91c7df2cc996ab09999e67cf318422bbd5a7e00ad4b91c5c990fb0d53ce8f692`.

pg_dump 18.6 completed successfully against server 17.11. pg_restore 18.6 listed the archive and read/decompressed all archive sections to /dev/null successfully; SHA-256 values were reread and verified. Role attributes and memberships were saved separately without password hashes. Files are protected locally outside Git; do not publish the archive. This is separate from the verified source/assets backup at `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9`.

No live restore drill was performed. The logical archive does not capture external Storage object bytes or role passwords, and is not a physical platform snapshot. Recovery preserves committed files and reconciles unknown outcomes; any restore into a compatible isolated Supabase environment requires reviewed managed-schema/extension/role handling and separate approval. No automatic cleanup, role/schema drop, or restore occurred.

## Execution ledger

Durable journal: `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/execution-ledger.json`.
Evidence directory: `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/controlled-execution-20261013`.

Every attempt records checksum, target, UTC times, exit code, COMMIT acknowledgment and verification path. Journal updates used atomic replacement and file/directory fsync. Pre-update ledger copies, individual psql logs and per-stage catalogs/verification reports are retained.

| Order | File | SHA-256 | Result |
| --- | --- | --- | --- |
| 001 | 202610120001_cms_foundation.sql | `bb0d8bb5156fb3c25c5494955063c4fa79872c84da6de9be520d9d04b5814412` | applied_verified |
| 002 | 202610120002_content_schema.sql | `95c16f205af06e94fda6ae21c127b8d7b78f51c669a822c85bc4de9cb5c4431b` | applied_verified |
| 003 | 202610120003_revisions_and_seed.sql | `de6d43b83addd55a186e87615a98245db02bef4207b04427f1f276f7139eda23` | applied_verified |
| 004 | 202610120004_legacy_assets.sql | `9036c482f443eee691428571368d5a314ef29caeb897911ea24a89cf9a375596` | applied_verified |
| 005 | 202610120005_content_workflow.sql | `ef045bc5c443a6d7d017824c11b0047824a3baa08b60a56cdb681ba3e43125b2` | applied_verified |
| 006 | 202610120006_revision_history.sql | `2024e1b14837ebbab8b92061fbae753d784a172998552998294597a461af2a20` | applied_verified |
| 007 | 202610120007_image_inventory.sql | `68f57b70f825247c98f846bc247fd0c7c77afb323bfb5989538c513807f12174` | applied_verified |
| 008 | 202610120008_preview_auth.sql | `71c87f03185f91c19a45918868b5d3512c884da823322ddbfd8a85260e702134` | applied_verified |

## Final verification

- Four new restricted NOLOGIN roles: portfolio_cms_owner, portfolio_cms_runtime, portfolio_cms_seed, portfolio_preview_auth_owner. All are NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOBYPASSRLS. No app/seed LOGIN identities were provisioned.
- cms and preview_auth have the intended restricted owners. Seven CMS tables and two authentication tables have ENABLE/FORCE RLS and exactly the intended owner-only policies.
- Twenty-nine functions match the approved SQL argument signatures, return types, source bodies, SECURITY DEFINER flags and owners. Search paths are pinned. No application function has PUBLIC EXECUTE.
- Runtime has exactly twelve CMS plus four auth function grants, schema USAGE only, no direct table or sequence permissions, no schema/database CREATE and no owner/seed membership. Seed has only cms.seed_published(text,text) in application schemas, with no direct data access.
- Both existing catalog audits (preview-runtime.sql and preview-auth.sql) passed all booleans with privilege functions explicitly evaluated for portfolio_cms_runtime. This verifies the NOLOGIN runtime role, not a future app login or live application behavior.
- Exactly fourteen expected indexes and one identity sequence. Expected triggers exist, including immutable history/receipts/asset inventory and publication asset verification. The receipt constraint includes restore after migration 006.
- cms.legacy_assets contains exactly the ten approved rows, each compared by path/hash/size with the immutable asset manifest. Every other CMS/auth table is empty. The eight portfolio projects were not seeded; defining the seed function did not execute it.
- Compared non-application schema/relation ownership, ACLs and RLS; existing role attributes/memberships; existing non-application function identities/ownership/ACLs/config; and non-application policies with the initial catalog. No unexpected changes were found in these audited categories.
- Final non-interactive Preview connection succeeded after installation: database postgres, role postgres, server 17.11, TLS 1.3 / TLS_AES_256_GCM_SHA384 / 256-bit. Service remains sslmode=verify-full with the trusted CA, preserving chain and hostname verification. PostgreSQL reports ssl=false on the internal pooler-to-database hop; end-to-end TLS is not claimed.

## Verification pause and errors

No SQL migration failed. After migration 001 committed, a local verifier initially required ADMIN, INHERIT and SET options on one membership row. PostgreSQL kept separate rows by grantor: supabase_admin granted ADMIN, while postgres explicitly granted owner INHERIT/SET. Execution paused before 002. A read-only grantor query established these were the expected effective rights, not additional runtime rights. The verifier was corrected to aggregate the intended membership options; exact objects/functions/permissions were rechecked and 001 was recorded applied_verified without rerunning it or changing SQL grants. The original pause evidence and reconciliation report remain in the journal/evidence directory. All subsequent checks passed.

## Scope boundary and remaining work

Stopped after migration and read-only verification. No portfolio-content seed, Storage bucket/object/policy mutation, credential/password change, Production connection, Redis request, Git commit/push, GitHub main update, Vercel change or deployment occurred.

Storage policy administration remains unresolved: storage.buckets/objects are managed by supabase_storage_admin, and the migration identity does not inherit their owner privileges. Do not transfer managed ownership or bypass this limitation. Bucket creation/policies, restricted app/seed login provisioning, content seeding, Preview environment changes, hosted integration tests and Vercel Preview deployment require separately approved scope. Current postgres is an elevated migration identity and must never become the runtime login. Keep cms/preview_auth outside exposed Data API schemas.

The installed schema is unseeded and not yet a working deployed CMS. No automatic execution task or migration replay was enabled. Preserve the external journal and backups; rerunning the eight apply-once files would conflict with existing objects.
