# Preview portfolio seed precheck — 2026-10-13

Seed execution is paused before any database write. Target: portfolio-cms-preview / pocnnpfzjxjlyoisnjhp, service portfolio_preview_migration, feature/supabase-portfolio-cms.

All eight migration journal entries are applied_verified. Fresh read-only catalog/source comparisons passed for installed function bodies/signatures, role attributes/memberships, ownership, tables, FORCE RLS, policies, triggers, runtime grants and legacy metadata. Both runtime/auth permission audits passed. No new application objects or unexpected permissions were found.

Local data.json has exactly eight projects with unique IDs and the approved order. The raw data.json, approved canonical source, all migration files, schema/asset manifests and referenced assets match the protected approved backup. Raw source SHA-256: dccbcbaf39d3a26a709f8f7ad16ebdba5a7c72e6403b669880cf3e3bfb959e37. Canonical SHA-256: 940d8b8e91c19bc0e252048f6049a34b1766d8989af9e2bde1ac36fce0900a00. RiskRadar, Unemployment, profile and CV references remain unchanged.

Preview connection succeeds non-interactively with verify-full and TLS 1.3. The trusted CA and exact project-qualified pooler username remain configured. Internal pooler-to-database TLS is not established; no end-to-end TLS claim is made.

Database state: zero portfolio revisions, zero state rows, zero seed-ledger rows, ten exact legacy-asset metadata rows. Therefore no published revision/version exists yet. Auth/content tables are otherwise empty. Runtime has published-read EXECUTE and no direct table/sequence/schema CREATE privileges.

## Missing prerequisite

portfolio_cms_seed exists as the intended NOLOGIN group. portfolio_cms_preview_seed does not exist, and no restricted seed URL is available to the current tooling process. The migration administrator has owner membership and lacks SET/USAGE on the seed group. scripts/cms/seed-preview.cjs intentionally requires a seed-only login and rejects elevated/owner/runtime identities. Calling the SECURITY DEFINER seed directly as postgres would bypass this workflow's identity guard and is not used.

Prepared seed-only SQL: supabase/configuration/preview-seed-login.sql. SHA-256: c32f3b4538f9c7eee312ed2a8aa4f2e0b73e2b7fda9ea408f6a25a408643d9bc. It creates only portfolio_cms_preview_seed with LOGIN/INHERIT and NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, then grants portfolio_cms_seed membership. It refuses an existing login and unsafe/missing seed group. It does not provision a runtime login or administrator session. Provisioning/password configuration has NOT been executed.

A narrow provisioning approval was requested before continuing with the already-approved seed. A distinct password can be generated locally, stored only in a protected local passfile outside Git, and provided to the existing guarded seed tool in process memory. No password needs to be entered in chat.

## Guarded seed and verification once the prerequisite is authorized

Use the immutable approved backup with scripts/cms/seed-preview.cjs apply workflow. It validates backup/source and restricted identity, verifies TLS with the trusted CA, binds canonical JSON/hash parameters, and calls cms.seed_published. The existing SQL takes a transaction advisory lock, validates hash/size/schema, rejects unledgered or changed content, and atomically creates the revision, state pointers and one seed-specific cms.migration_ledger record. An identical retry returns the same revision and does not add another document.

Post-check exact JSON equality, eight IDs/order/all metadata, all legacy asset references/hashes, one seed revision, version 1, matching draft/published pointers, runtime read, direct-table denial and unchanged state on identical retry. The external eight-file execution-ledger.json must remain byte-for-byte unchanged; its pre-seed SHA-256 is 7406da9344fbf0ea2dc44bf2436b7a272ef468c98137a91cc2c4d3032a5f9b49. The distinct database cms.migration_ledger is the seed ledger: one row is expected from the approved seed and is not a modification of SQL migration history.

No seeding, credential provisioning, administrator sessions, Storage changes, Production access, Redis/Vercel/GitHub changes, commit/push or deployment occurred during this precheck. Storage policy authority remains a later unresolved gate.
