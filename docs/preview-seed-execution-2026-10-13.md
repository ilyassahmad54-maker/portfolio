# Supabase Preview portfolio seed execution — 2026-10-13

**Result: restricted seed login provisioned; eight published projects seeded and identical retry verified.**

Target: portfolio-cms-preview, reference pocnnpfzjxjlyoisnjhp, session pooler aws-0-ap-northeast-2.pooler.supabase.com:5432, database postgres. Branch feature/supabase-portfolio-cms. All hosted writes were within the explicitly approved seed-login/password and guarded content-seed scope.

## Security and prechecks

Reviewed preview-seed-precheck-2026-10-13.md, the migration execution report, Phase 6 runbook, approved seed-only login SQL and existing guarded seed implementation. Before provisioning, all eight installed migrations were revalidated against approved hashes and catalog definitions. RLS, exact grants, owners, source/asset hashes, unique project IDs and empty published state passed. No seed content existed. Unemployment was first; RiskRadar used the corrected image path.

The exact Preview service remained sslmode=verify-full with the trusted Dashboard CA. Restricted seed psql connected non-interactively using that service with only the username/passfile overridden. The existing Postgres.js seed workflow also used rejectUnauthorized:true with the trusted CA and exact pooler hostname. Internal pooler-to-database TLS remains unproven/previously observed false; end-to-end TLS is not claimed.

## Seed-only login

Created only portfolio_cms_preview_seed using reviewed supabase/configuration/preview-seed-login.sql (SHA-256 c32f3b4538f9c7eee312ed2a8aa4f2e0b73e2b7fda9ea408f6a25a408643d9bc). LOGIN/INHERIT; NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS. Its only application-role membership is portfolio_cms_seed, without ADMIN OPTION. Automatic creator administration belongs to postgres and was verified separately; no runtime membership or owner membership was given to the seed login.

Generated a unique cryptographically random 384-bit password. Stored only in a dedicated PostgreSQL passfile under ~/.postgresql with mode 600, outside Git. The existing administrator .pgpass contents were hash-checked unchanged. No plaintext secret was printed, passed in command-line arguments, written into source code, included in execution logs or copied into evidence. Password provisioning used an anonymous stdin pipe without SQL echo; no secret-bearing diagnostics were printed. The guarded seed tool received its connection URI only in process memory.

The actual seed login passed all eight permission gates: safe attributes/identity, seed-only membership, exactly cms.seed_published(text,text) executable within cms/preview_auth, no direct table permissions, no sequence access, CMS USAGE without CREATE, no preview_auth access, and no database CREATE. Existing PUBLIC/core PostgreSQL functionality is unchanged; “only seed function” refers to application schemas. No runtime login or administrator session was created.

## Content and seed result

Used the unchanged scripts/cms/seed-preview.cjs apply workflow and approved durable backup. No source transformation or new project generation occurred. The tool validated source/backup hashes and restricted identity, used bound JSON/hash parameters, and called the existing SECURITY DEFINER seed function. PostgreSQL's transaction advisory lock and seed ledger guarded the atomic revision/state/ledger insertion; RLS was not disabled or weakened.

- Published project count: **8**, unique IDs, original order.
- Published revision: **d45097ec-1455-48d1-b3fd-e0e06bd36cd8**.
- Published version: **1**; revision sequence **1**.
- Draft pointer equals published pointer; one seed revision and one portfolio state row.
- All published JSON equals the original data.json semantically, including every section, project field, image/CV reference and order.
- Raw source SHA-256: `dccbcbaf39d3a26a709f8f7ad16ebdba5a7c72e6403b669880cf3e3bfb959e37`.
- Canonical source SHA-256: `940d8b8e91c19bc0e252048f6049a34b1766d8989af9e2bde1ac36fce0900a00`.
- Unemployment Data Analysis Dashboard remains first. Corrected RiskRadar image remains /assets/riskradar-6b4d1ab9f5bdadbcf9ae.jpg. Unemployment image, profile images and CV references match the approved backup.
- All ten legacy-asset metadata rows match by path/hash/size. Source asset bytes, SQL and manifests match the backup. No Storage upload or bucket configuration was performed.

## Idempotency and final permissions

Called the same guarded seed workflow once more with identical approved source/hash. It returned the exact same revision. Full pre-/post-retry snapshots of published JSON, all revision/state/seed-ledger rows and timestamps, legacy metadata and other application row counts were identical. No duplicate revisions/projects or content changes occurred.

Both runtime/auth catalog audits passed all fifteen booleans. Runtime retains its published-read function grant and cannot execute the seed function or modify application tables directly. Seed login cannot execute published-read, runtime or auth entry points and has no unexpected membership. No runtime login was provisioned; runtime verification evaluates the NOLOGIN group's effective catalog privileges rather than claiming a live runtime-login test.

Post-provisioning and final catalogs were compared for schemas, functions, tables, owners, ACLs, RLS, policies, triggers, constraints, indexes, role attributes and memberships. No unrelated objects/roles changed during seed. One comparison initially detected only nondeterministic row ordering of identical membership grants; a sorted comparison resolved it with no database changes or additional seed execution.

All eight external SQL migration ledger entries remain applied_verified and the file is byte-for-byte unchanged. SHA-256: `7406da9344fbf0ea2dc44bf2436b7a272ef468c98137a91cc2c4d3032a5f9b49`. The separate database cms.migration_ledger correctly contains one published-data-json-v1 seed record referencing the new revision and approved canonical checksum; it is not SQL migration execution history. Auth sessions/rate buckets, uploaded-asset inventory, asset proofs and operation receipts remain empty.

## Evidence and boundaries

Durable protected evidence: `/Users/mac/Desktop/portfolio-cms-backups/portfolio-cms-plan-pD0ZW9/seed-execution-20261013`. Includes pre/post content snapshots, identical-retry snapshot, provisioning outcome, seed result, actual-login permission gates, final role/catalog audits and source checksum records. It excludes the credential passfile/password. Source backup and hosted pre-migration logical baseline remain preserved in the parent directory.

No Production portfolio, Vercel Production, GitHub main, Production Upstash or Production Supabase was accessed or modified. No Storage bucket/object/policy change, runtime-login provisioning, administrator-session creation, destructive recovery, content deletion, commit, push or deployment occurred.

Stopped after seed verification. Storage policy authority is still unresolved and Storage configuration requires separate approval. Runtime login/environment provisioning and hosted application integration/deployment remain later work. The active seed credential is local-only and must never be deployed to Vercel. No automatic seed or deployment task was enabled.
