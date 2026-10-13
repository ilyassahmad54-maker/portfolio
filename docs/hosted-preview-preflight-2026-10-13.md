# Hosted Preview read-only preflight — 2026-10-13

Target: portfolio-cms-preview, reference pocnnpfzjxjlyoisnjhp. Branch: feature/supabase-portfolio-cms. No hosted writes, migrations, role creation, seeds, environment changes, commits, pushes or deployments were performed.

## Verified results

- Service portfolio_preview_migration: aws-0-ap-northeast-2.pooler.supabase.com, port 5432, database postgres, pooler username postgres.pocnnpfzjxjlyoisnjhp.
- PostgreSQL client 18.6. Non-interactive psql -X -w succeeded using the password file; ~/.pgpass mode is 600. No credential contents were printed or changed during this preflight.
- Backend current_user/session_user: postgres; database postgres; server 17.11. Project routing is established by the confirmed service host and project-qualified pooler username, not by the generic backend role/database names. SQL catalogs alone do not independently attest the Supabase dashboard project name.
- Client-to-pooler: TLS 1.3, TLS_AES_256_GCM_SHA384, 256-bit. Service sslmode=require encrypts but does not verify hostname. A verify-full test using sslrootcert=system failed certificate validation. No TLS configuration was weakened or changed.
- Pooler-to-PostgreSQL: this backend's pg_stat_ssl reports ssl=false, despite server ssl=on. Client TLS does not establish upstream TLS. End-to-end TLS is not proven; if required, obtain Supabase guidance or assess the project's direct endpoint with verified TLS before migration.
- Twelve schemas: auth, extensions, graphql, graphql_public, information_schema, pg_catalog, pg_toast, pgbouncer, public, realtime, storage, vault. No cms or preview_auth schema exists.
- Thirty roles inspected, with all memberships and ADMIN/INHERIT/SET flags. None of the six proposed CMS/auth/app/seed roles exists. postgres is not superuser; it has CREATEROLE, CREATEDB, REPLICATION and BYPASSRLS, owns the database, and can CREATE schemas. It must never be used as the CMS runtime identity.
- Installed extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1. Core sha256(bytea) and gen_random_uuid() exist. SQL/plpgsql are trusted and usable. No additional extension is required by 001–008.
- All existing hosted-preflight boolean gates passed: version, role creation, schema creation, fresh names, SHA-256, UUID and Storage client roles.
- No CMS/auth tables/functions or policies exist. supabase_migrations.schema_migrations and cms.migration_ledger are absent. There is no discovered CMS migration ledger to reconcile; absence of a ledger is not proof that no unrelated SQL was ever executed.
- Storage buckets/objects have RLS and are owned by supabase_storage_admin. postgres has neither inherited owner rights nor membership. No Storage policies or portfolio-images bucket exist. Treat private-images.sql policy installation as blocked under this identity pending a supported administrative path; do not transfer managed ownership.
- Seven event triggers inspected by name; the PUBLIC executable SECURITY DEFINER function rls_auto_enable is an event-trigger function, pins pg_catalog, and only auto-enables RLS in public. It does not replace explicit CMS/auth RLS. Other managed triggers were inventoried, not disabled or executed experimentally.

## Compatibility and remaining gates

CMS 001–007 and Preview auth 008 use available PostgreSQL features. Restricted NOLOGIN owners, explicit function grants, SECURITY DEFINER with pinned search_path, owner-only policies plus ENABLE/FORCE RLS, draft/publish transactions, immutable revisions, restore transactions, and hashed Preview sessions/rate buckets are compatible by source/catalog inspection. These are not hosted behavioral or concurrency test results.

PostgreSQL 17 automatically grants the creating CREATEROLE user ADMIN OPTION on new roles. createrole_self_grant is empty; files 001 and 008 explicitly grant owner membership back to the migration identity before schema creation/SET ROLE. The expected authority is available; actual DDL and platform-hook behavior remain untested because this preflight forbids writes.

Before execution:
1. Obtain the trusted CA from this Preview project's Dashboard Database Settings. Do not trust a certificate merely copied from the unverified connection. Test the exact pooler hostname with sslmode=verify-full and sslrootcert pointing to that CA. Only after success update this service's TLS fields, preserving other configuration. The system trust test failed; certificate/hostname verification is an open gate.
2. Decide whether the observed non-TLS upstream hop meets requirements. Changing client sslmode cannot encrypt that hop.
3. Prepare and verify a Preview backup, immutable source/asset manifest, and durable external migration checksum ledger. The CMS migration_ledger tracks content seeding, not eight SQL files.
4. Obtain separate execution approval covering the precise files/checksums below. Migration 004 includes INSERTs for ten legacy asset metadata rows. This is not portfolio-content seeding, but must be included explicitly in approval.
5. Resolve Storage policy authority separately before enabling image functionality. Create its private bucket through the supported Dashboard/Storage API, never by inserting Storage metadata directly.
6. Provision/review restricted login roles and passwords separately after schema installation; verify effective permissions with the existing preview-runtime.sql and preview-auth.sql audits. Keep cms and preview_auth outside exposed Data API schemas. Preview environment scopes, Storage credentials, transaction-pooler runtime TLS, backup procedures and hosted concurrency tests remain deployment gates.

## Exact future execution sequence — NOT executed

Use the session pooler service only after verified TLS is configured and the target is rechecked. Retain the existing password file; never pass passwords in arguments. Run one file per psql process; each file owns its transaction. Do not add --single-transaction. Stop on any nonzero exit; record each successful file/checksum durably before continuing. Do not blindly rerun a partially completed sequence. No cleanup DROP or ownership bypass is authorized.

First repeat the read-only identity and fresh-name preflight immediately before applying. Then run these commands individually in order, only after separate approval:

```sh
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/migrations/202610120001_cms_foundation.sql
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/migrations/202610120002_content_schema.sql
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/migrations/202610120003_revisions_and_seed.sql
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/migrations/202610120004_legacy_assets.sql
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/migrations/202610120005_content_workflow.sql
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/migrations/202610120006_revision_history.sql
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/migrations/202610120007_image_inventory.sql
/usr/local/opt/libpq/bin/psql "service=portfolio_preview_migration" -X -w -v ON_ERROR_STOP=1 -f supabase/preview-migrations/202610120008_preview_auth.sql
```

After 008, run catalog-only audits for ownership, exact grants, ENABLE/FORCE RLS, pinned function search paths and restricted memberships. Login provisioning, Storage configuration, portfolio-content seeding and deployment are separate approvals; none is implicit in these eight commands. Stop before all of them. Do not invoke a blanket Supabase migration push: 008 is intentionally in a separate directory, and all files are apply-once.

## Reviewed file checksums

| File | SHA-256 |
| --- | --- |
| 202610120001_cms_foundation.sql | `bb0d8bb5156fb3c25c5494955063c4fa79872c84da6de9be520d9d04b5814412` |
| 202610120002_content_schema.sql | `95c16f205af06e94fda6ae21c127b8d7b78f51c669a822c85bc4de9cb5c4431b` |
| 202610120003_revisions_and_seed.sql | `de6d43b83addd55a186e87615a98245db02bef4207b04427f1f276f7139eda23` |
| 202610120004_legacy_assets.sql | `9036c482f443eee691428571368d5a314ef29caeb897911ea24a89cf9a375596` |
| 202610120005_content_workflow.sql | `ef045bc5c443a6d7d017824c11b0047824a3baa08b60a56cdb681ba3e43125b2` |
| 202610120006_revision_history.sql | `2024e1b14837ebbab8b92061fbae753d784a172998552998294597a461af2a20` |
| 202610120007_image_inventory.sql | `68f57b70f825247c98f846bc247fd0c7c77afb323bfb5989538c513807f12174` |
| 202610120008_preview_auth.sql | `71c87f03185f91c19a45918868b5d3512c884da823322ddbfd8a85260e702134` |

Sources: [Supabase TLS setup](https://supabase.com/docs/guides/database/psql), [SSL modes and enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement), [PostgreSQL 17 role attributes](https://www.postgresql.org/docs/17/role-attributes.html).


## TLS completion — 2026-10-13

This update supersedes the earlier open client certificate-verification gate. The user downloaded prod-ca-2021.crt from the confirmed Preview project's Database Settings. The certificate parses as a single public X.509 root CA, contains no private key, has critical CA:TRUE and Certificate Sign/CRL Sign usage, passes self-signature verification, and is valid from 2021-04-28 through 2031-04-26. Subject/issuer: Supabase Root 2021 CA. DER SHA-256: 807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa. Trust provenance is the user's authenticated Dashboard download; filename/subject/self-signature alone do not establish trust. An attempted independent download from supabase.com/downloads/prod-ca-2021.crt returned 404 and was not used as evidence.

The exact aws-0-ap-northeast-2.pooler.supabase.com:5432 endpoint successfully connected with sslmode=verify-full and this CA, demonstrating libpq certificate-chain and hostname verification. A public root is shared infrastructure trust, not a project-specific identifier; project routing remains the confirmed project-qualified pooler username.

Installed CA: /Users/mac/.postgresql/certs/portfolio-preview-supabase-root-2021.crt (mode 600). Only portfolio_preview_migration sslmode and sslrootcert were updated, using an atomic service-file replacement. All other parsed service settings were checked unchanged; the password-file hash was verified unchanged without printing it. Password file remains mode 600.

The final service-only psql -X -w connection succeeded, with no TLS overrides: database postgres, role postgres, PostgreSQL 17.11, TLS 1.3 / TLS_AES_256_GCM_SHA384 / 256-bit client-to-pooler transport. All SQL used BEGIN READ ONLY and SELECT; no hosted resources were changed.

Client-to-pooler verified TLS is now satisfied for migration tooling. The current backend still reports pg_stat_ssl.ssl=false: pooler-to-PostgreSQL transport is not TLS in this observation. Server ssl=on only confirms server capability. This configuration does not demonstrate end-to-end TLS; requirements for encryption on every hop remain a separate gate requiring a supported provider answer or a verified direct-connection design. No enforcement setting was changed.

Other gates remain: backup/source manifest and durable migration tracking, separate approval for 001–008 including migration 004 legacy-asset metadata inserts, and the previously identified Storage-policy authority issue before image functionality. Restricted login provisioning, runtime permission audits, Preview environment configuration and hosted integration tests remain separate deployment steps. No migrations, Storage changes, credentials changes, commits, pushes or deployments occurred.
