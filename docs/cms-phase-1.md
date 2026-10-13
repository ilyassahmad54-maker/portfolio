# CMS Phase 1: foundation and migration rehearsal

Status: local implementation only on `feature/supabase-portfolio-cms`.
No application content flow, admin routes, cookies, browser storage, Vercel settings,
or production data have been changed. Nothing in Phase 1 connects to a hosted service.

## Scope and preserved baseline

`data.json` remains the public source and emergency fallback. The baseline has eight
projects, with Unemployment first and the corrected RiskRadar JPEG second. The
validators do not coerce, strip, normalize, or reorder content. Existing `#` and empty
project links are valid placeholders. A migration is sourced from published data,
never an automatically discovered browser export.

`lib/cms/portfolio.schema.json` defines every existing field, including optional
fields from `types/portfolio.ts`. It rejects unknown fields and unsafe references.
The generated SQL embeds that same schema; `cms:schema:check` prevents drift.
The TypeScript and PostgreSQL format validators have parity tests.

Limits: 1 MiB content, 200 items per collection, 20,000 characters per long text,
and field-specific limits. The database applies the size cap to its JSONB text
representation (which includes formatting spaces), so it can reject a document
near the application size limit. Both comfortably accept the current content.
Future content-schema changes require a versioned SQL migration and validator update.

Allowed references:

- Existing `/assets/` PNG/JPEG/WebP/GIF images and future `/api/assets/<uuid>` images.
- No embedded/base64, blob, file, remote image, SVG, traversal, or encoded traversal paths.
- HTTPS web links without userinfo or nonstandard ports; empty/`#` project links.
- Formspree endpoints restricted to `https://formspree.io/f/<id>`.
- CV references restricted to `/cv.pdf` or local `/assets/*.pdf`.
- Email/phone social links and existing navigation anchors.

URLs are content references, not permission to perform arbitrary server-side fetches.
Asset existence and access checks for managed Storage references are Phase 2+ work.
React text escaping remains the rendering policy; arbitrary HTML is not introduced.

## SQL layout

Apply the three numbered files in `supabase/migrations/` in order using an approved,
isolated migration identity. Each file is transactional. A standard migration ledger
must apply each numbered schema migration once. These DDL files intentionally fail
on role/schema collisions instead of silently taking over existing objects.

- `202610120001`: three non-login privilege roles, private schema, validation helpers.
- `202610120002`: generated JSON Schema function.
- `202610120003`: revisions, state, assets, ledger, constraints, immutable history,
  protected seed function, and published-read function.

Application tables:

| Table | Purpose |
| --- | --- |
| `cms.portfolio_revisions` | Immutable JSONB snapshots; database-computed hash, sequence, operation, source revision, request ID, timestamp, actor label |
| `cms.portfolio_state` | Singleton published/draft revision pointers and optimistic version |
| `cms.portfolio_assets` | Metadata for future private Storage images; bucket/path/hash/type/size/dimensions |
| `cms.migration_ledger` | Immutable seed source hash and original seed revision |

The published pointer may reference only `seed`, `publish`, or `restore` revisions.
State updates must advance the version exactly once. Phase 2 will supply version-
checked transaction functions for workflow writes; no write capabilities are
granted to the runtime role in Phase 1.

Revision hashes are computed from PostgreSQL's stable JSONB text representation.
The seed's source hash uses the application's canonical JSON (sorted object keys,
unchanged arrays). They serve different purposes and are not compared directly.

## Permissions

| Role | Schema access | Capabilities |
| --- | --- | --- |
| `portfolio_cms_owner` | Owner, non-login | Owns CMS tables/functions; owner-only RLS policies; no superuser/BYPASSRLS flags |
| `portfolio_cms_runtime` | USAGE | EXECUTE `cms.read_published()` only |
| `portfolio_cms_seed` | USAGE | EXECUTE `cms.seed_published(text,text)` only |
| PUBLIC / anonymous clients | None | No CMS access |

All four tables enable **and force** RLS. No public table/sequence/function grants.
Functions pin `search_path` to `pg_catalog, pg_temp` and qualify CMS references.
SECURITY DEFINER entry points run as the non-login owner, whose explicit RLS policies
allow necessary work. Revisions/ledger reject UPDATE, DELETE and TRUNCATE.

The identity applying SQL needs role-creation and ownership-transfer permission;
it receives owner membership for migrations. This identity is privileged and must
never be used in Vercel runtime. An eventual dedicated login may be granted only
`portfolio_cms_runtime`, not owner or seed membership. Password provisioning is an
out-of-band setup step; migrations contain no credentials. Keep `cms` out of
Supabase's exposed Data API schemas. Storage bucket/policies are not created yet.

Existing authentication remains unchanged. These SQL permissions do not implement
HTTP authorization: Phase 2 must validate the existing Redis session and CSRF
origin before invoking any future mutation functions.

## Local commands

```sh
npm run cms:schema:check
npm run test:cms
npm run cms:migration:dry-run
npm run cms:backup:verify -- /absolute/path/reported/by/dry-run
npm run test:auth
npm run test:content
npm run typecheck
npm run lint
npm run build
```

`cms:schema` regenerates the SQL schema if the JSON Schema is deliberately changed.
Never edit a generated or already-applied migration in a later deployed phase;
introduce a new versioned migration instead.

The dry-run is deliberately incapable of applying SQL. It reads no environment
variables or secrets, opens no database connection, and makes no network requests.
It creates a new private directory under the OS temporary directory containing:

- Original `data.json` bytes and canonical seed JSON.
- Every referenced public image and CV file.
- JSON Schema and numbered SQL migrations.
- Manifest with checksums, sizes, and exact ordered project report.

Source files are read-only. Backup verification detects missing files, modified
bytes, traversal paths, outside-root symlinks and mismatched project reports. Keep
a copy in a durable backup location before any hosted rollout: OS temporary
directories are not durable storage. Store the approved manifest hash separately
if tamper authenticity, rather than accidental corruption detection, is needed.

## Seed transaction and local rehearsal

Tests apply the actual SQL to an ephemeral PGlite PostgreSQL instance. PGlite is a
development dependency, not a production database adapter. No hosted resources,
credentials, environment variables, Docker daemon, or external database are needed.

An eventual approved seed runner will bind the verified canonical source and its
SHA-256 to `SELECT cms.seed_published($1, $2)` under the separate seed identity.
The function:

1. Takes a transaction-scoped advisory lock.
2. Validates checksum, payload size, complete schema and ID uniqueness.
3. Refuses unmarked pre-existing content.
4. Inserts the original immutable seed revision, both pointers, and ledger atomically.
5. Returns the original revision on identical retries without resetting later edits.
6. Rejects retries with changed source or inconsistent migration state.

Tests inject a failure after revision/state insertion and prove all inserts roll
back. They also test permissions, RLS flags, invalid data, immutable revisions,
state pointer/version constraints, asset metadata constraints, and retry behavior.
PGlite uses a single connection; multi-connection contention, Supabase-specific
roles, pooler behavior and actual Storage require isolated hosted/local-stack
integration tests before rollout. The advisory-lock concurrency behavior is not
claimed to have been exercised across separate connections in Phase 1.

Dependency audit during this phase reports seven high-severity entries in the
existing Tailwind/ESLint dependency chains, rooted in the `braces` advisory
GHSA-vfj7-8cjw-p6xm. None names the new PGlite dependency. The lockfile diff adds
only PGlite; existing dependency versions are unchanged. Do not run the suggested
force-fix (it proposes major Tailwind changes and an ESLint-config downgrade).
Track a scoped dependency remediation separately; passing functional checks is
not a clean dependency-security audit.

## Recovery and rollback boundary

- Failed seed: PostgreSQL automatically rolls back the whole seed statement; no
  partial revision/state/ledger survives. Retry only the same verified source.
- Failed numbered DDL migration: its transaction rolls back. Earlier successful
  numbered migrations remain; review and resume through the migration runner.
- Unexpected pre-existing state or changed seed hash: stop and investigate; never
  truncate, drop or overwrite content to force initialization.
- Phase 1 application rollback: the frontend still reads untouched `data.json`, so
  disabling/unshipping these unused foundation files changes no public content.
- Restoring an old **published CMS revision** will be an append-only transaction
  after the core publish workflow passes tests. It is intentionally not exposed
  by this phase. No destructive down-migration is supplied.
- Once CMS publishing exists, reverting to a JSON-only build can show an older
  baseline. Export and verify the current published snapshot before such a code
  rollback; prefer revision restoration through the CMS.

## Phase 2 gate and pending choices

Phase 1 supplies no HTTP endpoints, runtime database client, Storage integration,
or editor changes. Approval is required to proceed to Phase 2, which will add
protected draft/publish/discard APIs, session+origin validation, separate rate-limit
buckets and optimistic-concurrency handling. History/restore follows a passing
core workflow, as requested.

Confirm before implementing uploads: 4 MiB JPEG/PNG/WebP, maximum side 8192 pixels,
maximum 40 million pixels, and private bucket `portfolio-images`. Existing local
GIFs remain valid; new GIF/SVG uploads are excluded initially. These limits are
already represented in the proposed asset metadata table but are not active in
the current editor. No hosted SQL, secrets setup, commit, push, or deployment is
authorized by completion of this phase.
